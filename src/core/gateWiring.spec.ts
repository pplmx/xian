/**
 * 门禁接线守卫 —— 「本地能过 = CI 能过」这句话,得有一条会自己跑的判据。
 *
 * 缺口是这样长出来的:`scripts/` 下的浏览器自检(layout-check / ui-smoke /
 * offline-check / first-paint / perf-profile / build-timed)只在 GitHub Actions 里
 * 被点名(`bun scripts/xxx.mjs`),`package.json` 没有任何对等入口,`vite.config.ts`
 * 的 verify 链里也没有它们。于是本地把 `vp run verify` 跑绿、pre-commit 放行,
 * 推上去照样会停在 ui-check job —— 而 gate.yml 与 .vite-hooks/pre-commit 的注释
 * 一直写着「本地能过 = CI 能过」。**注释是承诺,却没有任何东西守着它。**
 *
 * 本文件把这句话变成可执行判据,两个方向都查:
 *   ① 正向:`.github/workflows/*.yml` 与 `.github/actions/…/action.yml` 里每个点名的
 *      `scripts/*.mjs`,都能在本地找到入口
 *      —— 入口 = package.json 的某个 script(沿 `bun run X` 递归展开)或 verify 命令;
 *   ② 反向:脚本正文 / verify / pre-commit 里点名的每个 `bun run X` **与 `vp run X`**,
 *      都真在 package.json(或 vite.config 的 run.tasks)里 —— 这个方向也会腐烂:
 *      verify 抄了一个已被改名的脚本,那一步就永远是"没跑";脚本自己点名的别名
 *      (如 check:ui 里的 `bun run check:perf`)同理。
 *
 * 两个方向都得**先自证再判**:判据本身是一堆正则,正则只认一种写法,漏掉的写法
 * 就等于没有判据。故每条用例开头都拿几种真实写法喂一遍自己(见「判据先自证」注释)——
 * 这比"至少数出 6 个"更结实:数够但漏掉其中两个,同样是失灵。
 *   CI 点脚本的写法:`bun scripts/x.mjs` / `bun run ./scripts/x.mjs` /
 *   `bun "scripts/x.mjs"` / `node scripts/x.mjs`(含 `./` 与引号);
 *   点别名的写法:`bun run X` 与 `vp run X`(本仓是 Vite+ 项目,后者更常见)。
 *
 * 另钉一条成本线:六个浏览器门一律不进 verify / pre-commit(一轮约五分钟),
 * 只走 `bun run check:ui` 与 CI。要挪这条线,请连着这条用例一起改 ——
 * 别让提交前那一哆嗦悄悄变成五分钟。
 *
 * 判据只看**真实的命令**(行首是 `#` 的注释行跳过),不解析 YAML:`run:` 的写法
 * 就那么几种,能静态数出来的,就该有一条会自己跑的判据。
 */
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vite-plus/test";

const ROOT = resolve(import.meta.dirname, "../..");
const WORKFLOWS = join(ROOT, ".github/workflows");
const ACTIONS = join(ROOT, ".github/actions");
const PRE_COMMIT = join(ROOT, ".vite-hooks/pre-commit");
const COMMIT_MSG = join(ROOT, ".vite-hooks/commit-msg");

/** package.json 的本仓契约(脚本、运行时与直接依赖) */
const PKG = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
  scripts: Record<string, string>;
  catalog?: Record<string, string>;
  engines?: { node?: string };
  packageManager?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

/** package.json 的 scripts(名字 → 命令正文) */
const SCRIPTS = PKG.scripts;

/**
 * CI 里直接跑自检脚本的写法。**四种都得认**,只认一种就等于没有判据:
 *   bun scripts/x.mjs       —— 本仓现用的写法
 *   bun run ./scripts/x.mjs —— 加 `run` 又带 `./`(人肉敲命令时的自然写法)
 *   bun "scripts/x.mjs"     —— 加了引号(YAML 里给路径加引号是常见习惯)
 *   node scripts/x.mjs      —— 换解释器后本该同样受管
 * 故 `bun`(可带 `run`)与 `node` 并列,引号与 `./` 前缀都可选。
 */
const CI_SCRIPT = /(?:\bbun\s+(?:run\s+)?|\bnode\s+)["']?(?:\.\/)?(scripts\/[\w.-]+\.mjs)/g;

/** 点名别名的写法:`bun run X` 与 `vp run X`(后者是 Vite+ 任务,本仓更自然的写法) */
const RUN_NAME = /(?:\bbun|\bvp)\s+run\s+([\w:-]+)/g;

/** 从一段文本里读出所有被点名的 script / task 名(去重,保留首次出现) */
function runNames(text: string): string[] {
  return [...new Set([...text.matchAll(RUN_NAME)].map((m) => m[1] as string))];
}

/** 去掉注释行 —— `# …scripts/foo.mjs…` 是说明,不是命令 */
function codeOnly(text: string): string {
  return text
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("#"))
    .join("\n");
}

/**
 * 一个脚本能带出的全部命令正文(含它引用的其他 script,递归)。
 * 判据认「可跑到的命令文本」,而不是「脚本名」—— 这样 check:ui 里
 * `bun run check:perf` 这种复用写法也算接上了 perf-profile.mjs。
 */
function expand(names: string[], scripts = SCRIPTS, seen = new Set<string>()): string {
  const out: string[] = [];
  for (const name of names) {
    if (seen.has(name)) continue;
    seen.add(name);
    const command = scripts[name];
    if (command === undefined) continue;
    out.push(command);
    out.push(
      expand(
        [...command.matchAll(/bun run ([\w:-]+)/g)].map((m) => m[1] as string),
        scripts,
        seen,
      ),
    );
  }
  return out.join("\n");
}

/** 从 vite.config.ts 的 verify 任务里读出实测命令清单(command 数组里的字符串字面量) */
function verifyCommands(): string[] {
  const src = readFileSync(join(ROOT, "vite.config.ts"), "utf8");
  const task = src.indexOf("verify: {");
  const from = task < 0 ? -1 : src.indexOf("command: [", task);
  const to = from < 0 ? -1 : src.indexOf("],", from);
  if (from < 0 || to < 0) return [];
  // 只取双引号字面量:verify 块里的注释用的是反引号,不会混进来
  return [...src.slice(from, to).matchAll(/"([^"\n]+)"/g)].map((m) => m[1] as string);
}

/** verify 里点名了哪些 package.json script */
function verifyScriptNames(commands = verifyCommands()): string[] {
  return [
    ...new Set(
      commands.flatMap((c) => [...c.matchAll(/bun run ([\w:-]+)/g)].map((m) => m[1] as string)),
    ),
  ];
}

/**
 * vite.config.ts 里声明的 `run.tasks` 任务名。
 *
 * `vp run X` 的 X 有**两处**真相源:package.json 的 scripts,或 vite.config 的
 * run.tasks(如 `vp run verify` —— pre-commit 就是这么调的)。反向判据若只认前者,
 * 就会把合法的 `vp run verify` 判成幽灵;若干脆不认 `vp run`,那又是漏判。
 */
function viteTaskNames(): string[] {
  const src = readFileSync(join(ROOT, "vite.config.ts"), "utf8");
  const at = src.indexOf("tasks: {");
  if (at < 0) return [];
  const open = src.indexOf("{", at);
  // 先找到 tasks 块的配对 `}`
  let depth = 0;
  let close = open;
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === "{") depth += 1;
    else if (src[i] === "}") {
      depth -= 1;
      if (depth === 0) {
        close = i;
        break;
      }
    }
  }
  // 再只取该块**顶层**的键(嵌套的 command 数组、其对象里的字段都不是任务名)
  const body = src.slice(open + 1, close);
  const names: string[] = [];
  let d = 0;
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    if (ch === "{") d += 1;
    else if (ch === "}") d -= 1;
    else if (d === 0) {
      const m = /^([\w:-]+)\s*:\s*\{/.exec(body.slice(i));
      if (m) {
        names.push(m[1] as string);
        i += m[0].length - 1; // 走到 `{`,由下面这一步把它的深度记上
        d += 1;
      }
    }
  }
  return names;
}

/** 全部工作流里被点名的 `scripts/*.mjs`(去重,保留首次出现顺序;四种写法都认) */
function ciScripts(ciText: string): string[] {
  return [...new Set([...codeOnly(ciText).matchAll(CI_SCRIPT)].map((m) => m[1] as string))];
}

/** 判据本体:CI 里跑、而本地没有任何入口的脚本 */
function unwired(ciText: string, scripts = SCRIPTS, verify = verifyCommands()): string[] {
  const pool = `${expand(Object.keys(scripts), scripts)}\n${expand(verifyScriptNames(verify), scripts)}\n${verify.join("\n")}`;
  return ciScripts(ciText).filter((script) => !pool.includes(script));
}

/**
 * 真仓库的 CI 正文:全部 workflow + 全部 composite action 拼一份。
 *
 * composite actions 也要进这份正文:浏览器六门收口进 .github/actions/ui-self-check
 * 后,`bun scripts/*.mjs` 的合法藏身处多了一个 —— 判据不跟过去,脚本就能在
 * action 里悄悄换掉而本地永远不红(workflow 侧一条都读不出来,「防空转」那条
 * 还会先替我们红掉,但那只是碰巧兜底,不是设计)。
 */
function workflowsText(): string {
  const readDir = (dir: string): string =>
    readdirSync(dir, { recursive: true })
      .map((name) => String(name).replace(/\\/g, "/"))
      .filter((name) => name.endsWith(".yml") || name.endsWith(".yaml"))
      .sort()
      .map((name) => readFileSync(join(dir, name), "utf8"))
      .join("\n");
  return `${readDir(WORKFLOWS)}\n${readDir(ACTIONS)}`;
}

/** 版本范围的主版本(Vue Router ^5.4.0 → 5) */
function majorOf(range: string | undefined): string {
  return /(\d+)/.exec(range ?? "")?.[1] ?? "";
}

/** 六个浏览器门 —— 需要先 build、需要 playwright chromium,一轮约五分钟 */
const BROWSER_GATES = [
  "scripts/build-timed.mjs",
  "scripts/first-paint.mjs",
  "scripts/perf-profile.mjs",
  "scripts/layout-check.mjs",
  "scripts/ui-smoke.mjs",
  "scripts/offline-check.mjs",
];

/** vite.config.ts 的 run.tasks 名(`vp run X` 的第二处真相源),读一次 */
const VITE_TASKS = viteTaskNames();

describe("提交信息门 —— 字面量 \\n 不许冒充换行", () => {
  function runHook(message: string) {
    const dir = mkdtempSync(join(tmpdir(), "xuanshu-commit-msg-"));
    const file = join(dir, "COMMIT_EDITMSG");
    writeFileSync(file, message);
    const result = spawnSync(COMMIT_MSG, [file], { encoding: "utf8" });
    rmSync(dir, { recursive: true, force: true });
    return result;
  }

  it("拦下被 -m 挤成一行的 bullet", () => {
    const result = runHook("refactor(ui): 示例\n\n- 第一条\\n- 第二条\\n- 第三条\n");
    expect(result.status, "字面量 \\n- 没有被拦下").toBe(1);
    expect(result.stderr).toContain("请改用提交信息文件");
  });

  it("真正的多行 bullet 照常放行", () => {
    const result = runHook("refactor(ui): 示例\n\n- 第一条\n- 第二条\n- 第三条\n");
    expect(result.status).toBe(0);
  });
});

describe("门禁接线 —— CI 里跑的自检,本地得有对等入口", () => {
  it("正向:CI 里每个点名的 scripts/*.mjs 都能在 package.json 或 verify 里找到入口", () => {
    // 判据先自证:CI 点脚本有四种写法,旧判据只认第一种,于是后三种整条漏过 ——
    // 造一个真·无本地入口的脚本换个写法写进 build.yml,判据仍然全绿。
    for (const spelling of [
      "run: bun scripts/qa-probe.mjs",
      "run: bun run ./scripts/qa-probe.mjs",
      'run: bun "scripts/qa-probe.mjs"',
      "run: node scripts/qa-probe.mjs",
    ]) {
      expect(ciScripts(spelling), `这个写法读不出脚本名,等于没有判据:${spelling}`).toEqual([
        "scripts/qa-probe.mjs",
      ]);
    }
    const scripts = ciScripts(workflowsText());
    // 防空转:正则失灵时这条判据会"通过"得毫无意义
    expect(
      scripts.length,
      "一条 scripts/*.mjs 都没读出来 —— 工作流挪走了,或写法改了?",
    ).toBeGreaterThanOrEqual(6);
    // 比"数够 6 个"更结实的一层:六个已知浏览器门得**逐个**读得出来。
    // 数够但漏掉其中两个(靠别的文件凑数)同样是正则失灵。
    const missed = BROWSER_GATES.filter((gate) => !scripts.includes(gate));
    expect(
      missed,
      `这六个浏览器门在 CI 里跑着,判据却读不出来:${missed.join("、")}` +
        " —— 正则漏了某种写法,或它们真被移出了 CI(那就连着这条用例一起改)",
    ).toEqual([]);
    const gaps = unwired(workflowsText()).sort();
    expect(
      gaps,
      `这些脚本只在 CI 里跑,本地没有对等入口(推上去才发现红):${gaps.join("、")}` +
        " —— 在 package.json 的 scripts 里补一个入口(如 check:ui),或接进 verify",
    ).toEqual([]);
  });

  it("故障注入:摘掉 check:ui,这条判据当场点名剩下的四个缺口", () => {
    // 这正是加这条守卫之前的真实状态:六个浏览器门没有任何本地入口,
    // 而当时 verify 全绿 —— 缺口本身不产生任何红。
    const withoutCheckUi = { ...SCRIPTS };
    delete withoutCheckUi["check:ui"];
    const gaps = unwired(workflowsText(), withoutCheckUi).sort();
    // first-paint / perf-profile 有独立别名(check:first-paint / check:perf),故仍算接上
    expect(gaps).toEqual([
      "scripts/build-timed.mjs",
      "scripts/layout-check.mjs",
      "scripts/offline-check.mjs",
      "scripts/ui-smoke.mjs",
    ]);
  });

  it("反向:脚本正文 / verify / pre-commit 点名的每个 bun run / vp run 都真在 package.json 或 vite.config 里", () => {
    const verify = verifyCommands();
    expect(
      verify.length,
      "从 vite.config.ts 里读不出 verify 的命令 —— 解析失效了",
    ).toBeGreaterThanOrEqual(3);
    const pre = codeOnly(readFileSync(PRE_COMMIT, "utf8"));
    // 判据先自证:`vp run X` 是本仓(Vite+)里点任务最自然的写法,旧判据只认
    // `bun run X` —— 于是在 check:ui 末尾接一个不存在的 `&& vp run check:ghost`,
    // 那一步永远不会跑,而判据全绿。
    expect(
      runNames("bun run check:ghost && vp run check:ghost"),
      "`vp run X` 没被当成点名 —— 反向判据缺了这一半",
    ).toEqual(["check:ghost"]);
    // 任务名解析也得自证:pre-commit 调的 `vp run verify` 落在 vite.config 的 run.tasks 里
    expect(VITE_TASKS, "从 vite.config.ts 读不出 run 任务名 —— 解析失效了").toContain("verify");
    // 连**每个脚本自己的正文**也一并查:check:ui 里 `bun run check:perf` 若是错字,
    // 那一步就会在"脚本不存在"里悄悄跳过,而外面看起来一切正常
    const named = runNames([...Object.values(SCRIPTS), ...verify, pre].join("\n"));
    expect(named.length, "一个 bun run / vp run 都没读到 —— 写法变了?").toBeGreaterThan(0);
    // 一个名字有两处合法归属:package.json 的 scripts,或 vite.config 的 run.tasks
    const ghosts = named
      .filter((name) => SCRIPTS[name] === undefined && !VITE_TASKS.includes(name))
      .sort();
    expect(
      ghosts,
      `这些脚本/任务被点名,但 package.json 与 vite.config 里都没有:${ghosts.join("、")}` +
        " —— 那一步从来不会真的跑",
    ).toEqual([]);
  });

  it("工具链的 catalog 两条同版 —— CLI 与它内嵌的 core 差一个次版本就 GenericFailure", () => {
    /*
     * 这一条守的是一次**跨机器的版本错位**,报错长这样:
     *
     *   error: Failed to resolve vite command: GenericFailure, Expected
     *   @voidzero-dev/vite-plus-core@1.4.0, but found ...@1.3.0
     *
     * 仓库的 catalog 里 `vite-plus`(CLI)与 `vite`(它内嵌的 core)是两条独立的键 ——
     * 只升一条,`vp build` 就当场拒绝,而错误信息指向的「vp migrate」是升级仓库的动作,
     * 与真实处境无关。判据只比主次版本:补丁版不改变两者之间的契约。
     *
     * 机器上那份 vp 的版本由 `scripts/env-check.mjs` 在每次 `bun run check` 里报一句
     * 提醒(不挡门 —— 那台机器的事不该锁住仓库),这里守的是**仓库自己别写歪**。
     */
    const catalog = PKG.catalog ?? {};
    const cli = catalog["vite-plus"] ?? "";
    const core = (catalog.vite ?? "").replace(/^npm:@@?voidzero-dev\/vite-plus-core@/, "");
    expect(cli, "catalog 缺 vite-plus(CLI 版本)").not.toBe("");
    expect(core, "catalog 缺 vite(内嵌 core 的版本)").not.toBe("");
    const majorMinor = (v: string): string => v.split(".").slice(0, 2).join(".");
    expect(
      majorMinor(cli),
      `catalog 里 vite-plus ${cli} 与 vite ${core} 不同版 —— CLI 会按自己的版本去要同版的 core`,
    ).toBe(majorMinor(core));
  });

  it("六个浏览器门不回流到 verify / pre-commit —— 只走 check:ui 与 CI", () => {
    const verifyPool = `${verifyCommands().join("\n")}\n${expand(verifyScriptNames())}`;
    const leaked = BROWSER_GATES.filter((script) => verifyPool.includes(script));
    expect(
      leaked,
      `这些浏览器门被接进了 verify(一轮约五分钟,提交前扛不住):${leaked.join("、")}` +
        " —— 留在 check:ui 与 CI 里",
    ).toEqual([]);
    const pre = codeOnly(readFileSync(PRE_COMMIT, "utf8"));
    const direct = BROWSER_GATES.filter((script) => pre.includes(script));
    expect(direct, `pre-commit 里直接跑了浏览器门:${direct.join("、")}`).toEqual([]);
  });

  it("浏览器六门只在内 composite action 里跑一遍 —— workflow 不许再内联", () => {
    /*
     * ## 收口之前的形态
     *
     * `build.yml` 的 ui-check job 与 `deploy.yml` 的 build job 各内联一份六门脚本,
     * **连执行顺序都各写一套**(deploy 先排版后首屏,build 先首屏后排版)。判据说是
     * 「同一套」,实际已经漂了 —— 改一处顺序,另一处不动,两份行为从此不同。
     *
     * 收口进 `.github/actions/ui-self-check` 之后,顺序只有一处定义。但**没有判据守着
     * 这个收口**:谁把某一段复制回 workflow,本地全绿,而两份顺序又会慢慢分叉。
     *
     * 这条守的是:workflow 正文里不出现任何一个浏览器门脚本 —— 它们只能出现在
     * composite action 里,经 `uses:` 被调用。
     */
    const wf = readdirSync(WORKFLOWS)
      .filter((name) => String(name).endsWith(".yml"))
      .map((name) => readFileSync(join(WORKFLOWS, String(name)), "utf8"))
      .join("\n");
    /*
     * **`build-timed.mjs` 不算** —— 它只是"带时长上限的构建",`publish.yml` 要用它
     * 产出 Docker 镜像的 dist,与"浏览器门"是两件事(第一版把它也算进来,当场误报)。
     * 真正只能跑一次的是下面这五个**需要浏览器**的。
     */
    const BROWSER_ONLY = BROWSER_GATES.filter((s) => !s.includes("build-timed"));
    const inlined = BROWSER_ONLY.filter((script) => wf.includes(script));
    expect(
      inlined,
      `这些浏览器门被内联回 workflow 了 —— 它们只该经 .github/actions/ui-self-check 跑一次:` +
        inlined.join("、"),
    ).toEqual([]);

    // 防空转:action 里必须真的点名它们,否则上面那条"workflow 不内联"会变成
    // "谁都不跑"的假绿
    const action = readFileSync(join(ROOT, ".github/actions/ui-self-check/action.yml"), "utf8");
    const missing = BROWSER_GATES.filter((script) => !action.includes(script));
    expect(missing, `ui-self-check 里少了这些门:${missing.join("、")}`).toEqual([]);
    expect(BROWSER_GATES.length, "六门清单被删空了?").toBe(6);
  });

  it("打乱顺序自检接在 CI 与 check:all 上,且不进 pre-commit", () => {
    /*
     * ## 为什么这条接线需要被守
     *
     * `bun run test` 按**书写顺序**跑。本仓的用例共享几处模块级状态
     * (`caveEvent` / `enlightenmentEvent` / `saveReader`),还有一批 describe 靠
     * 「文件里前一个建好了 pinia」在工作 —— 这些在书写顺序下**永远绿**。
     *
     * 实测这道检查第一次跑就红了 41 条,分散在 7 个文件;连修两轮才让十种种子
     * 全部稳定。它抓的东西没有任何别的门禁能看到,所以接线断了就是零覆盖。
     *
     * ## 三个方位
     *
     *   ① CI 的 gate job 里要有;
     *   ② `check:all`(本地一键跑全套)里要有;
     *   ③ **pre-commit 里不能有** —— 一轮约 40 秒,提交前那一下扛不住。
     */
    const workflows = workflowsText();
    expect(workflows, "CI 里没跑打乱顺序自检 —— 顺序依赖又变成零覆盖了").toContain("check:shuffle");
    expect(SCRIPTS["check:all"] ?? "", "check:all 里没接打乱顺序自检").toContain("check:shuffle");
    expect(SCRIPTS["check:shuffle"] ?? "", "check:shuffle 命令消失了").toContain(
      "scripts/shuffle-check.mjs",
    );
    // 脚本本体要在,且用的是**固定种子**(随机种子会让这道门自己变成偶发红)
    const script = readFileSync(join(ROOT, "scripts/shuffle-check.mjs"), "utf8");
    /*
     * 种子必须**有个固定的默认值**(`SHUFFLE_SEED ?? "1"`)—— 随机种子会让这道门
     * 自己变成偶发红,而人只会学会忽略它。允许用环境变量换种子做更广的本地验证,
     * 但默认那一个不能是随机的。
     */
    expect(script, "打乱自检没有固定默认种子 —— 它会自己偶发红").toMatch(
      /SHUFFLE_SEED\s*\?\?\s*"\d+"/,
    );
    // 不进提交前
    const pre = codeOnly(readFileSync(PRE_COMMIT, "utf8"));
    expect(pre, "pre-commit 里跑了打乱自检 —— 一轮约 40 秒,提交前扛不住").not.toContain(
      "check:shuffle",
    );
  });
});

describe("工具链契约 —— 同一版本只留在可校验的源头", () => {
  it("packageManager、Docker 镜像与 CI 使用的是同一套 Bun / Node", () => {
    const bun = /^bun@(\d+\.\d+\.\d+)$/.exec(PKG.packageManager ?? "")?.[1] ?? "";
    expect(bun, "package.json 的 packageManager 必须是 bun@x.y.z").not.toBe("");

    const dockerImages = ["Dockerfile", "Dockerfile.ci"]
      .filter((rel) => existsSync(join(ROOT, rel)))
      .flatMap((rel) =>
        [...readFileSync(join(ROOT, rel), "utf8").matchAll(/oven\/bun:(\d+\.\d+\.\d+)-/g)].map(
          (m) => ({ rel, version: m[1] as string }),
        ),
      );
    expect(dockerImages.length, "Dockerfile 里一个钉死的 Bun 镜像都没读到").toBeGreaterThan(0);
    expect(
      dockerImages.filter((i) => i.version !== bun),
      `Docker 的 Bun 镜像必须与 packageManager(bun@${bun})同版`,
    ).toEqual([]);

    const nodeMin = /^>=?\s*(\d+)/.exec(PKG.engines?.node ?? "")?.[1] ?? "";
    expect(nodeMin, "package.json 的 engines.node 必须写下限").not.toBe("");
    const configured = [
      join(ROOT, ".github/actions/setup-vp-install/action.yml"),
      join(ROOT, ".github/workflows/build.yml"),
    ].flatMap((file) =>
      [...readFileSync(file, "utf8").matchAll(/node-version:\s*["']([^"']+)["']/g)].map((m) => ({
        rel: file.slice(ROOT.length + 1),
        version: m[1] as string,
      })),
    );
    expect(configured.length, "CI 里一个 node-version 都没读到").toBeGreaterThan(0);
    expect(
      configured.filter((i) => Number(majorOf(i.version)) < Number(nodeMin)),
      `CI 的 Node 低于 engines.node(${PKG.engines?.node})`,
    ).toEqual([]);
  });

  it("README 的运行时版本与 package.json 同源", () => {
    const bun = /^bun@(.+)$/.exec(PKG.packageManager ?? "")?.[1] ?? "";
    const node = /^>=?\s*(.+)$/.exec(PKG.engines?.node ?? "")?.[1] ?? "";
    for (const rel of ["README.md", "docs/development.md"]) {
      const text = readFileSync(join(ROOT, rel), "utf8");
      expect(text, `${rel} 里的 Bun 版本没跟上 packageManager`).toContain(`Bun** ${bun}`);
      expect(text, `${rel} 里的 packageManager 版本没跟上`).toContain(`bun@${bun}`);
      expect(text, `${rel} 里的 Node 下限没跟上 engines.node`).toContain(`Node** ≥ ${node}`);
      expect(text, `${rel} 里的 engines.node 没跟上`).toContain(`engines.node >= ${node}`);
    }
    expect(readFileSync(join(ROOT, "docs/deployment.md"), "utf8")).toContain(
      `oven/bun:${bun}-alpine`,
    );
  });

  it("README 技术栈表的主版本跟随直接依赖", () => {
    const readme = readFileSync(join(ROOT, "README.md"), "utf8");
    const routerMajor = majorOf(PKG.dependencies?.["vue-router"]);
    expect(routerMajor, "Vue Router 在 package.json 里没有直接依赖").not.toBe("");
    const routerRow = /\| Vue Router \| ([^|]+) \|/.exec(readme)?.[1]?.trim() ?? "";
    expect(routerRow, "README 技术栈表里的 Vue Router 主版本没跟上依赖").toBe(routerMajor);

    const capacitorMajor = majorOf(PKG.dependencies?.["@capacitor/core"]);
    expect(capacitorMajor, "Capacitor 在 package.json 里没有直接依赖").not.toBe("");
    const electron = majorOf(PKG.devDependencies?.electron);
    expect(electron, "Electron 在 package.json 里没有直接依赖").not.toBe("");
    const desktopRow = /\| Electron \/ Capacitor \| ([^|]+) \|/.exec(readme)?.[1]?.trim() ?? "";
    expect(desktopRow, "README 技术栈表里的 Electron / Capacitor 主版本没跟上依赖").toBe(
      `${electron} / ${capacitorMajor}`,
    );
  });
});

/** 一道门在失败时会不会真的把退出码弄成非零 */
function failsLoudly(src: string): boolean {
  /*
   * **先用剥掉 import 行再判** —— 否则 `import assert from "node:assert/strict"`
   * 那一句本身就让 `\bassert\b` 命中,于是把脚本里所有 assert 都注释掉
   * (门变成只会打印的空门)这条判据**照样绿**。本轮注入时当场撞到。
   *
   * 这也解释了为什么"九道门"一直没抓到这件事:它从来没验过 assert 还在不在,
   * 只验了"文件里出现过 assert 这个词"。
   */
  const body = src
    .replace(/^\s*import[^;]*;?$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  /*
   * 退出码有**两种常见写法**,都要认:
   *   ① `process.exit(1)` / `process.exitCode = 1`   —— 字面量
   *   ② `process.exit(ok ? 0 : 1)`                    —— 按判定结果取码
   *
   * 上一版只认 ①。而 `scripts/release-check.mjs` 结尾正是
   * `process.exit(verdict.ok ? 0 : 1);` —— 只认字面量的话,它会被判成
   * 「收集了失败也不退出」的空门(实测三种三元写法全部返回 false)。
   * 后果不是误报那么简单:任何用 ② 的门都进不了名单,也就没人守着它。
   */
  return (
    /process\.exitCode\s*=\s*[1-9]/.test(body) ||
    /process\.exit\(\s*[1-9]/.test(body) ||
    /* 三元取码:`process.exit(… ? … : …)` 或 `process.exitCode = … ? … : …` */
    /process\.exit(?:Code\s*=\s*)?\(?[^;\n]*\?[^;\n]*\b1\b/.test(body) ||
    // 只认「显式置退出码」这一种:裸 throw 可能只是启动前置检查(产物没构建),
    // 与「收集了失败却照样 exit 0」不是一回事 —— 拿它兜底会把空门放过去
    /\bassert\./.test(body)
  );
}

describe("门禁自检 · 每道门失败时都得真的红", () => {
  /*
   * 一道「收集了失败、却照样 exit 0」的门是个静默的空门：它天天打印 ✗，
   * 却从不拦下任何东西。这类事故不会报错，只会让人以为有保护。
   * 故把六道浏览器门 + 三道静态门逐个读进来，要求至少有一条能失败的出口。
   */
  /*
   * 十二道门,不是九道。
   *
   * 原先只列了六道浏览器门 + 三道静态门,而 `check:engine` 那三个
   * (`engine-dist` / `engine-sync` / `engine-standalone`)**同样在 CI 里跑、
   * 同样会失败**,却不在这个清单里。它们确实有 assert(实测),但那不是判据给的
   * 保证 —— 哪天有人把 assert 换成 console.log,这一条扫不到,门就变成静默的空门。
   *
   * 这条判据守的正是「门会不会真的红」。既然引擎三兄弟也是门,就得在名单上。
   */
  const GATES = [
    "scripts/build-timed.mjs",
    "scripts/first-paint.mjs",
    "scripts/perf-profile.mjs",
    "scripts/layout-check.mjs",
    "scripts/ui-smoke.mjs",
    "scripts/offline-check.mjs",
    "scripts/docs-check.mjs",
    "scripts/env-check.mjs",
    "scripts/test-report.mjs",
    "scripts/engine-dist.mjs",
    "scripts/engine-sync.mjs",
    "scripts/engine-standalone.mjs",
    // 打 tag 之前跑的那一条。它此前只有「命令挂着」「判断走纯函数」两条判据,
    // 没有「失败必须非零退出」—— 而它恰恰是发版前最后一道人工门。
    "scripts/release-check.mjs",
  ];

  it("十三道门都有一条「失败 → 非零退出」的路径", () => {
    const silent = GATES.filter((rel) => !failsLoudly(readFileSync(join(ROOT, rel), "utf8")));
    expect(silent, "这些门收集了失败却不会让流水线红").toEqual([]);
  });

  it("判据自证:只会打印不会失败的门要被认出来", () => {
    const quiet = `const failures = [];\nfailures.push("x");\nconsole.log(failures);\n`;
    expect(failsLoudly(quiet), "自证没抓住「只打印、不失败」的门").toBe(false);
    expect(failsLoudly(`if (bad) process.exitCode = 1;`)).toBe(true);
    // 裸 throw 不算 —— 它常常只是启动前置检查(产物没构建),与「门是空的」不是一回事
    expect(failsLoudly(`if (bad) throw new Error("x");`)).toBe(false);
    expect(failsLoudly(`if (bad) assert.ok(false);`)).toBe(true);
    /*
     * **只有 import、没有调用**不算 —— 本轮注入时撞到的坑:把脚本里所有 `assert.`
     * 注释掉之后,`import assert from "node:assert/strict"` 那一句仍让
     * `\bassert\b` 命中,于是「门已经变成只会打印」这件事判据看不出来。
     * 修法是先剥掉 import 行,只认 `assert.` 调用。
     */
    expect(
      failsLoudly(`import assert from "node:assert/strict";\nconsole.log("done");`),
      "只有 import assert 的脚本被当成了会失败的门 —— 那正是空门的典型形态",
    ).toBe(false);
    /*
     * 三元取码也算失败出口 —— `scripts/release-check.mjs` 结尾就是
     * `process.exit(verdict.ok ? 0 : 1);`。上一版只认字面量 `process.exit(1)`,
     * 于是这类门会被判成「不退出」,进不了名单也就没人守。
     */
    expect(
      failsLoudly(`process.exit(verdict.ok ? 0 : 1);`),
      "三元取码没被认成失败出口 —— 用这种写法的门永远进不了名单",
    ).toBe(true);
    expect(failsLoudly(`process.exitCode = verdict.ok ? 0 : 1;`)).toBe(true);
    // 但恒退 0 的三元不算:它没有失败侧
    expect(failsLoudly(`process.exit(ok ? 0 : 0);`)).toBe(false);
  });
});

describe("门禁覆盖面 · 具名场景不许悄悄消失", () => {
  /*
   * 上一条钉的是「门会不会真的失败」,这一条钉的是「门到底还量多少东西」。
   * 删掉一条具名场景(旧档迁移 / 存储写满 / 挂机稳定 / 走完一次转世)不会让门变红 ——
   * 它只会少量一类毛病,而报告里仍旧是绿色的勾。
   */
  const SMOKE = readFileSync(join(ROOT, "scripts/ui-smoke.mjs"), "utf8");
  const LAYOUT = readFileSync(join(ROOT, "scripts/layout-check.mjs"), "utf8");

  it("冒烟的三条环境专场景还在", () => {
    for (const fn of ["checkLegacySave", "checkSaveFull", "checkSoakStability"]) {
      expect(SMOKE, `${fn} 不见了 —— 这一类毛病从此不再被量`).toContain(`async function ${fn}(`);
      expect(SMOKE, `${fn} 定义了却没被调用`).toMatch(new RegExp(`await ${fn}\\(`));
    }
  });

  it("冒烟的「找到控件却一个都没点成」下限还在", () => {
    // 门槛从「每页至少点 1 次」收窄成「找到控件却一个都没点成」:
    // 前者会在只有一枚禁用按钮的参考页(/world)上误红,后者只盯点击器本身坏掉。
    expect(SMOKE, "点击下限那条判据没了").toContain("r.controls > 0 && r.clicked === 0");
    expect(SMOKE, "controls 没有被记录进每页结果").toMatch(/\bcontrols,/);
  });

  it("开发文档里的冒烟场景清单与脚本同形", () => {
    // 上一版文档写着「三条环境专场景」,而脚本早就是四条 —— 少掉的那条正是挂机稳定。
    // 清单不全,读文档的人就不知道门在量什么(与「门量了多少东西」是同一个问题)。
    const doc = readFileSync(join(ROOT, "docs/development.md"), "utf8");
    for (const label of ["旧档迁移", "存储写满", "挂机稳定", "导入存档"]) {
      expect(doc, `开发文档的冒烟清单里少了「${label}」`).toContain(label);
    }
  });

  it("排版门的具名场景一个不少", () => {
    const critical = [
      "走完一次转世",
      "渡劫突破真打一次",
      "存档导出 / 导入往返",
      "冷启动落在子页的返回",
      "浮出的提示条点得掉",
      "引擎概率弹窗(顿悟 / 洞府巡游)",
      "择师谱的两步定契",
      "同行帖的此刻与后果",
      "往生帖的门槛与去留",
      "前尘山河三世同册",
      "智能收纳不扔有投入的件",
      "一键分解先勾后点",
    ];
    // 认「登记进 TASKS 的那一行」,不认零散出现 —— 场景名在注释与日志里也有,
    // 只查 includes 的话,把登记行删掉照样绿(第一版就这么漏了)
    const missing = critical.filter(
      (label) => !new RegExp(`\\["${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}", `).test(LAYOUT),
    );
    expect(missing, "这些场景没被登记进 TASKS —— 那一类毛病从此不再被量").toEqual([]);
  });
});

describe("加页面必须同时进两扇浏览器门", () => {
  /*
   * 新加一页,只在 router 里登记是不够的 —— 冒烟与排版门各自有一份巡页清单,
   * 漏登记的那一页从此**没人点、没人量**,而且不会有任何地方变红。
   * 这与「门在跑 ≠ 有保护」是同一条:覆盖面悄悄缩水,是最难发现的一种退化。
   */
  const ROUTER = readFileSync(resolve(__dirname, "../router/index.ts"), "utf8");
  const SMOKE = readFileSync(resolve(__dirname, "../../scripts/ui-smoke.mjs"), "utf8");
  const LAYOUT = readFileSync(resolve(__dirname, "../../scripts/layout-check.mjs"), "utf8");
  // 开局两页不进巡页清单:有存档时路由守卫会把它们重定向回首页,
  // 硬塞进去只会把首页重复量一遍(排版门另开一趟无存档的流程量它们)
  const ONBOARDING = new Set(["/welcome", "/create"]);

  const pages = [...ROUTER.matchAll(/path: "(\/[a-z]*)"/g)]
    .map((m) => m[1]!)
    .filter((p) => !ONBOARDING.has(p));

  const listOf = (src: string, who: string): Set<string> => {
    const m = src.match(/const ROUTES = \[([\s\S]*?)\];/);
    expect(m, `${who}里找不到巡页清单 ROUTES`).toBeTruthy();
    return new Set([...m![1]!.matchAll(/"\/?([a-z]*)"/g)].map((x) => `/${x[1] ?? ""}`));
  };

  it("路由表里的每一页都在两扇门的清单里", () => {
    expect(pages.length, "路由表只认出一两页 —— 解析锚点怕是失效了").toBeGreaterThan(10);
    for (const [who, src] of [
      ["冒烟", SMOKE],
      ["排版", LAYOUT],
    ] as const) {
      const listed = listOf(src, who);
      const missing = pages.filter((p) => !listed.has(p));
      expect(missing, `${who}门漏了这些页 —— 它们不会被点/被量`).toEqual([]);
    }
  });

  it("两门的清单彼此一致 —— 只加一处也算漏", () => {
    const a = listOf(SMOKE, "冒烟");
    const b = listOf(LAYOUT, "排版");
    expect(
      [...a].filter((x) => !b.has(x)),
      "只有冒烟门有",
    ).toEqual([]);
    expect(
      [...b].filter((x) => !a.has(x)),
      "只有排版门有",
    ).toEqual([]);
  });
});

describe("发版体检自己也得有人看着", () => {
  /*
   * release:check 是「打 tag 之前跑的那一条」,它自己断了没人会知道 ——
   * 脚本被删、命令被摘、判断搬回脚本里(绕开纯函数与单测),都算退化。
   */
  const PKG = readFileSync(resolve(__dirname, "../../package.json"), "utf8");
  const SCRIPT = readFileSync(resolve(__dirname, "../../scripts/release-check.mjs"), "utf8");

  it("命令还挂在 package.json 上", () => {
    expect(PKG, "release:check 命令没了").toContain('"release:check"');
  });

  it("判断仍然走 core 的纯函数 —— 脚本里不许自己判", () => {
    expect(SCRIPT, "脚本不再调用 checkRelease").toContain("checkRelease(");
    expect(SCRIPT, "脚本里又出现了自己的阻塞文案(判断应留在 core)").not.toContain("blockers.push(");
  });
});

/**
 * 首屏门的**结算窗口** —— 它比「门会不会红」更隐蔽的一类退化。
 *
 * ## 实测过的失效
 *
 * `first-paint.mjs` 原先这样等:
 *
 * ```js
 * await page.evaluate(() => Promise.race([document.fonts.ready, 超时]));
 * await page.waitForTimeout(400);   // 让最后几个响应体结算
 * ```
 *
 * 它假设「`document.fonts.ready` resolve 之后 400ms 内 `loadingdone` 一定触发」。
 * 4G 档实测这个前提不成立:
 *
 * ```text
 *   document.fonts.ready = 2015ms
 *   loadingdone          = 3128ms     ← 晚了 1113ms
 * ```
 *
 * 于是 `window.__kaiSwap` 读到 null,判据拿 `Infinity` 去比预算 —— 报「楷体换上太晚」,
 * 而字体明明 1 片 48KB 正常到了。**一条守字体时序的判据退化成了噪声**,查它的人
 * 只能靠猜(本轮实测踩到,浪费了一轮排查)。
 *
 * ## 判据守什么
 *
 * ① 结算窗口要**等 `loadingdone` 本身**,不能只等 `fonts.ready` 再睡固定时长;
 * ② 等不到时要有明确的「判据不成立」出口,而不是把 null 当 ∞ 去比预算 ——
 *    「量不到」与「太晚」是两件事,混在一起就成了假红。
 */
describe("首屏门 · 结算窗口要等得到它要量的那一拍", () => {
  const SRC = readFileSync(join(ROOT, "scripts/first-paint.mjs"), "utf8");

  it("结算窗口等的是 loadingdone,不是 fonts.ready 之后睡一段", () => {
    expect(SRC, "首屏门里找不到 __kaiSwap(那它就什么也没量)").toContain("__kaiSwap");
    // 要有一个「等到 __kaiSwap 落定」的显式等待;只等 fonts.ready 不够
    expect(
      SRC,
      "结算窗口没有等 loadingdone —— 只等 document.fonts.ready 会在 4G 档读到 null" +
        "(实测差 1113ms),于是「量不到」被当成「太晚」报红",
    ).toMatch(/__kaiSwap\s*!==\s*null|waitForFunction\([^)]*__kaiSwap/);
  });

  it("量不到与太晚要分开报 —— 不许把 null 当 Infinity 比预算", () => {
    // 现写法 `marks.fontSwap ?? Infinity` 会把「没量到」算成「无穷晚」
    expect(SRC, "`fontSwap ?? Infinity` 把「量不到」判成「太晚」—— 两条要分开报").not.toMatch(
      /fontSwap\s*\?\?\s*Infinity/,
    );
    expect(SRC, "缺一条「楷体换上没量到」的独立判词").toContain("没量到");
  });
});

/**
 * 运行时门 · 采样窗口要盖住**交互**那一段。
 *
 * ## 实测过的失效
 *
 * `perf-profile.mjs` 原先这样用:`goto` → 等 2.5s → 注入采样器 → 采几秒 →
 * `__perfStop()` → **然后才**批量展开、切页签、开弹窗。也就是说:
 *
 * ```text
 *   静置采样 ████████████         ← 有门,恒 17ms
 *   交互              ████████████  ← 从来没有量过
 * ```
 *
 * 而交互恰恰是玩家最容易感觉到 jank 的时刻 —— 静置时页面本来就不太动,帧率必然好看。
 * 本轮补上之后当场量出:背包页交互段最差帧 100 / 117 / 267ms(2 / 2 / 8 帧 >50ms),
 * 其余 16 个视图 ≤ 34ms。**这个差别在旧门里完全看不见。**
 *
 * ## 判据守什么
 *
 * ① `__perfStop()` 只结静置段,采样器**不取消** —— 取消就回到「只看静置」;
 * ② 有一个单独的交互段出口(`__perfStopInteractive`);
 * ③ 交互段有独立的预算与判词 —— 与静置共用一档的话,那几拍尖峰会被几百帧静置
 *    稀释掉,永远不红。
 */
describe("运行时门 · 交互段也要被采样", () => {
  const SRC = readFileSync(join(ROOT, "scripts/perf-profile.mjs"), "utf8");

  it("静置结束时不许把采样器停掉 —— 交互还要接着记", () => {
    const stopBody = /window\.__perfStop = \(\) => \{([\s\S]*?)\n    \};/.exec(SRC)?.[1] ?? "";
    expect(stopBody, "找不到 __perfStop —— 判据的前提不成立").not.toBe("");
    expect(
      stopBody,
      "`__perfStop()` 里又出现了 cancelAnimationFrame —— 采样在交互开始前就停了," +
        "「翻批/开弹窗卡不卡」会重新变成没人量的东西",
    ).not.toContain("cancelAnimationFrame");
    expect(stopBody, "`__perfStop()` 要记下交互段起点").toContain("interactiveFrom");
  });

  it("交互段判定走纯函数,不写在脚本的 else-if 链里", () => {
    /*
     * 判定抽到 `core/perfBudget.judgePerf` 之后,「哪种读数该红」由 `perfBudget.spec`
     * 的用例回答 —— 那才是能验的东西。
     *
     * 为什么不再扫脚本文本:本轮实测过两次故障注入,**旧判据两次都照样绿**:
     *   ① 在条件前加 `false && ` —— 恒假
     *   ② 把 `failures.push(...)` 换成一行注释 —— 不记了
     * 正则匹配的是「这串字符在不在」,不是「它有没有生效」。
     */
    expect(SRC, "缺交互段出口 __perfStopInteractive").toContain("__perfStopInteractive");
    expect(SRC, "脚本没有调用纯函数 judgePerf —— 判定又回到手写的 else-if 链了").toContain(
      "judgePerf(",
    );
    // 判据真值在 core 里,且那份有直接用例
    expect(SRC, "预算常量没传给 judgePerf").toMatch(/judgePerf\([\s\S]{0,400}?BUDGET/);
  });
});

/**
 * npm 生命周期钩子 —— `pre*` 只对 **npm script** 生效,对 vite task 不生效。
 *
 * ## 本轮清掉的那个
 *
 * `package.json` 里挂着 `"preverify": "find dist -type f -delete …"`,而 `verify`
 * 是 `vite.config.ts` 里的 **vite task**(`vp run verify`),不是 npm script ——
 * 于是那个钩子**从来没跑过**。
 *
 * 它的后果不是"少清一次 dist",而是两件更糟的事:
 *   ① 它看起来在守着"verify 之前先清 dist",而 `clean-dist.mjs` 的注释也这么写着
 *      ("verify 的第一步")—— 两边互相引用,谁都没跑;
 *   ② 它用的是 `find … -delete` 批量删,而这正是 `clean-dist.mjs` 存在的理由
 *      (宿主对「一次删 >50 个文件」有护栏,CI 与本地都撞过)。也就是说:
 *      唯一真的会批量删的地方,恰好是从不执行的那一个。
 *
 * 现在 `clean-dist.mjs` 被写进 verify 的命令链第一步,判据守两件事:
 * ① 不许再出现指向 **vite task** 的 `pre*` 钩子(那一定是死代码);
 * ② 清 dist 只有一处实现(`clean-dist.mjs`),不许再冒出 `find -delete` 那种写法。
 */
describe("npm 钩子 · 指向 vite task 的 pre* 一定是死代码", () => {
  const SCRIPTS = Object.keys((PKG as { scripts?: Record<string, string> }).scripts ?? {});
  const VITE_CFG = readFileSync(join(ROOT, "vite.config.ts"), "utf8");

  it("没有指向 vite task 的 pre* 钩子", () => {
    /*
     * 只在 vite.config 的 `run.tasks` 里定义、而 package.json 里没有同名 script 的,
     * 就是 vite task —— 给它挂 `pre<name>` 永远不会触发。
     */
    /*
     * 只从 `run: { tasks: { … } }` 这一段里取 task 名 —— 全文匹配会把 `build:` / `test:`
     * 这些普通配置键也算进来。缩进不写死(不同版本的格式化会变),按段落切。
     */
    const tasksBlock = /tasks:\s*\{([\s\S]*?)\n\s{4}\},/.exec(VITE_CFG)?.[1] ?? "";
    const taskNames = [...tasksBlock.matchAll(/^\s*(\w[\w:-]*):\s*\{/gm)].map((m) => m[1]!);
    const dead = SCRIPTS.filter((s) => s.startsWith("pre")).filter((s) => {
      const target = s.slice(3);
      return taskNames.includes(target) && !SCRIPTS.includes(target);
    });
    expect(
      dead,
      "这些 pre* 钩子指向的是 vite task,vp run 不会触发它们 —— 钩子体永远不会执行," +
        "要么把它需要的步骤写进 task 的 command 链,要么删掉",
    ).toEqual([]);
  });

  it("清 dist 只有一处实现 —— 不许再冒出 find -delete", () => {
    const offenders = SCRIPTS.filter((s) =>
      /find\s+dist\b[^;]*-delete/.test((PKG as { scripts: Record<string, string> }).scripts[s]!),
    );
    expect(
      offenders,
      "这些脚本用 `find dist … -delete` 批量删 —— 宿主有「一次删 >50 个文件」的护栏," +
        "CI 与本地都撞过;改用 scripts/clean-dist.mjs(逐文件 unlink)",
    ).toEqual([]);
  });

  it("verify 的第一步是 clean-dist", () => {
    // 命令链读得出来:verify 的 command 数组里,clean-dist 必须在最前
    const verifyBlock = /verify:\s*\{[\s\S]*?command:\s*\[([\s\S]*?)\]/.exec(VITE_CFG)?.[1] ?? "";
    expect(verifyBlock, "读不到 verify 的 command —— 判据的前提不成立").not.toBe("");
    const first =
      verifyBlock
        .split("\n")
        .map((l) => l.trim())
        .find((l) => /^".*",$/.test(l)) ?? "";
    expect(
      first,
      "verify 的第一步不再是 clean-dist —— vite 的 emptyOutDir 会一次性删整个 dist/assets," +
        "在宿主上会撞批量删除护栏",
    ).toContain("clean-dist");
  });
});

/**
 * 测试并发上限 —— 「按核数开满」在多核机器上既慢又不稳。
 *
 * ## 本轮量到的事
 *
 * 本机 128 核,vitest 默认按核数铺开,580 个 spec 会同时起上百个 worker,而每个
 * worker 的启动成本约 3.1s。实测各 7 轮全量:
 *
 * | 配置 | 耗时 | 出现失败的轮数 |
 * | --- | --- | --- |
 * | 默认(按核数) | 37~70s,中位 45s | **2/7**(某轮 4 个、某轮 5 个) |
 * | `maxWorkers: 12` | 41~70s,中位 47s | **0/7** |
 *
 * 那些失败每次是**不同**的 spec(rng.sim 的统计断言、savePlatform 的 20s 超时、
 * offlineFuzz 的随机不变量),单独跑都绿 —— 资源争用,不是产品缺陷。
 *
 * ## 判据守什么
 *
 * `threads` 池必须有 `maxWorkers`。没有它,「全绿」这个结论在核多的机器上就是
 * 掷骰子 —— 而这恰恰是所有人看 CI 时最依赖的那两个字。
 */
describe("测试并发 · 不许按核数开满", () => {
  const VITE = readFileSync(join(ROOT, "vite.config.ts"), "utf8");
  /*
   * 注释必须**整段**剥,不能逐行剥:`/* … *\/` 在本文件里是多行的(实测表格就在
   * 注释里),逐行剥只吃掉首尾两行,中间的 `maxWorkers:12` 会留下 —— 于是把真正的
   * 配置行删掉,判据仍能命中注释、照样全绿(Round 9 注入时当场撞到)。
   */
  const LIVE = VITE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  it("threads 池配了 maxWorkers", () => {
    expect(LIVE, "pool 不再是 threads —— 这条判据的前提变了,请重看注释").toContain(
      'pool: "threads"',
    );
    expect(
      LIVE,
      "threads 池没配 maxWorkers —— 核多的机器上会按核数开满," +
        "580 个 spec 同时起上百个 worker(每个约 3.1s 启动),实测 2/7 轮出现资源争用导致的假红",
    ).toContain("maxWorkers");
  });

  it("上限被钳住 —— 不许裸按核数开满", () => {
    /*
     * ## 守的是什么
     *
     * 要拦的从来不是"表达式",是**按核数开满**:128 核机上 580 个 spec 会同时起
     * 上百个 worker,净剩上下文切换与内存争用(实测 2/7 轮出现假红)。
     *
     * ## 为什么不再要求"写死一个数字"
     *
     * Round 9 写这条时要求 maxWorkers 是数值字面量,理由是不想让机器一变就跟着涨。
     * 但那个写法有个真问题:注释里只能写"换机器按核数四分之一调"—— 而到了 4 核
     * 的 CI 机上,四分之一就是 1,580 个文件等于串行跑。**一句写字板上的建议,
     * 不能代替一个在少核机上也能工作的默认值。**
     *
     * 故改成要求"带**上限**的表达式":既在 128 核机上钳住,又在 4 核机上留出并行。
     * 判定方法:配置行里必须出现 `Math.min(`(钳上限),且上限那个数不超过 32。
     */
    const line = LIVE.split("\n").find((l) => /maxWorkers:/.test(l)) ?? "";
    expect(
      line,
      "maxWorkers 没钳上限 —— 不是 Math.min(上限, …) 的写法,机器一多就会按核数开满",
    ).toContain("Math.min(");
    /*
     * 上限必须是**字面量**,不能是 `availableParallelism()` 本身 ——
     * `Math.min(availableParallelism(), …)` 等于没钳。
     */
    const cap = /Math\.min\(\s*(\d+)\s*,/.exec(line)?.[1];
    expect(cap, "Math.min 的第一个参数不是数值字面量 —— 上限没真的钳住").toBeTruthy();
    expect(Number(cap), "上限超过 32 与「按核数开满」差别不大").toBeLessThanOrEqual(32);

    // 反向:硬编码一个大数也不许(那是另一种"没钳")
    const literal = /^maxWorkers:\s*(\d+),?$/.exec(line.trim());
    if (literal) {
      expect(Number(literal[1]), "maxWorkers 硬编码成了一个大数").toBeLessThanOrEqual(32);
    }
  });

  it("少核机器上不会退化成串行", () => {
    /*
     * 下限存在的理由:4 核 CI 机上 `availableParallelism() / 4` = 1,
     * 若不设下限,580 个文件就等于一个个跑。这条盯住那个 `Math.max(4, …)`。
     */
    const line = LIVE.split("\n").find((l) => /maxWorkers:/.test(l)) ?? "";
    expect(line, "maxWorkers 没有下限 —— 少核机器上会退化成串行").toMatch(/Math\.max\(\s*\d+\s*,/);
  });
});
