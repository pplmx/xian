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
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vite-plus/test";

const ROOT = resolve(import.meta.dirname, "../..");
const WORKFLOWS = join(ROOT, ".github/workflows");
const ACTIONS = join(ROOT, ".github/actions");
const PRE_COMMIT = join(ROOT, ".vite-hooks/pre-commit");

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
  return (
    /process\.exitCode\s*=\s*[1-9]/.test(src) ||
    /process\.exit\(\s*[1-9]/.test(src) ||
    // 只认「显式置退出码」这一种:裸 throw 可能只是启动前置检查(产物没构建),
    // 与「收集了失败却照样 exit 0」不是一回事 —— 拿它兜底会把空门放过去
    /\bassert\b/.test(src)
  );
}

describe("门禁自检 · 每道门失败时都得真的红", () => {
  /*
   * 一道「收集了失败、却照样 exit 0」的门是个静默的空门：它天天打印 ✗，
   * 却从不拦下任何东西。这类事故不会报错，只会让人以为有保护。
   * 故把六道浏览器门 + 三道静态门逐个读进来，要求至少有一条能失败的出口。
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
  ];

  it("九道门都有一条「失败 → 非零退出」的路径", () => {
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
