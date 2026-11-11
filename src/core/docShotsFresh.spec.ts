/**
 * 文档截图不能比它展示的界面更旧
 *
 * ## 缺口（实测）
 *
 * `images/app/*.webp` 是 README 与 `docs/usage.md` 的公开展示图，由
 * `scripts/shots.mjs` 从构建里重拍。但**没有任何东西提醒该重拍**。
 *
 * 实测一次：修行页那张图拍于 `00:06`，而 `CultivationView.vue` 在 `08:16`
 * 改过一次（修掉「还剩 100%」这个四舍五入报满的文案）。于是 README 上挂着的
 * 那张图，**展示的是一个已经修掉的 bug** —— 而且挂了八个小时没人发现。
 *
 * ## 判据怎么判「旧」
 *
 * 逐像素比对图文是否一致不现实（字体渲染、抗锯齿都会抖），而「这张图对应的
 * 界面改过没有」是 git 能回答的。故判据走 git:
 *
 * ```text
 *   图文件的最后一次提交时间  <  它展示的那几个源文件的最后一次提交时间
 *   → 红
 * ```
 *
 * 映射写在 `SHOT_SOURCES` 里 —— 每张图文对应哪几处源码。这一份是判据的**输入**,
 * 不是第二本账:它只说「这张图拍的是哪些页」,而页面怎么渲染仍归源码。
 *
 * ## 为什么不是在 pre-commit 拦
 *
 * 这条判据**不进 `verify`**:重拍截图要先 `bun run build` + 起浏览器,几分钟起步,
 * 提交前扛不住(与浏览器门同一档成本)。它作为普通 spec 存在,由人在改完 UI 后
 * 手动跑 —— 红了就跑 `bun scripts/shots.mjs`。
 *
 * ## 判据得能证明自己没空转
 *
 * 若 `SHOT_SOURCES` 里写的路径都不存在,或 git 查不到时间,判据会一路绿着。
 * 故第一件事是核**每一条映射的两侧都真能取到时间**。
 */
import { describe, expect, it } from "vite-plus/test";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * 每张文档图 → 它展示的界面源码。
 *
 * 只写**直接渲染那一页**的文件（视图 + 该页专用的组件与样式）。
 * 往这里加一条不算放宽:加了就代表那张图也要跟着那些文件重拍。
 */
const SHOT_SOURCES: Record<string, string[]> = {
  "images/app/welcome.webp": ["src/views/WelcomeView.vue", "src/views/CreateView.vue"],
  "images/app/create.webp": ["src/views/CreateView.vue"],
  "images/app/home.webp": ["src/views/HomeView.vue"],
  "images/app/cultivation.webp": ["src/views/CultivationView.vue"],
  "images/app/adventure.webp": ["src/views/AdventureView.vue"],
  "images/app/inventory.webp": ["src/views/InventoryView.vue"],
  "images/app/character.webp": ["src/views/CharacterView.vue"],
  // 图鉴与藏珍是同一页的两扇门,两张图都跟着它
  "images/app/codex.webp": ["src/views/CollectionView.vue", "src/views/RealmCodexView.vue"],
  "images/app/dongfu.webp": ["src/views/DongfuView.vue"],
  "images/app/world.webp": ["src/views/CelestialView.vue"],
};

/**
 * 这个路径有没有**未提交**的改动（工作区或暂存区）。
 *
 * 判据必须在 pre-commit 里也能跑:那时新图已经 staged、但还没有提交时间,
 * 纯按 `git log` 比会把「刚重拍完的图」判成旧图 —— 门因此永远过不去。
 * 故只要任一侧有未提交改动,这一对就不判。
 */
function hasUncommitted(path: string, root: string): boolean {
  try {
    const out = execFileSync("git", ["status", "--porcelain", "--", path], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return out.length > 0;
  } catch {
    return false;
  }
}

/** 某个路径最后一次提交的时间（秒）。查不到返回 null。 */
function lastCommitSec(path: string, root: string): number | null {
  try {
    const out = execFileSync("git", ["log", "-1", "--format=%ct", "--", path], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return out ? Number(out) : null;
  } catch {
    return null;
  }
}

const ROOT = resolve(process.cwd());

describe("文档截图 · 不得比界面更旧", () => {
  it("判据的前提:每条映射两侧都取得到时间", () => {
    /*
     * 这一条防空转:若路径写错、或仓库不在 git 里,下面的比对会永远相等。
     */
    expect(Object.keys(SHOT_SOURCES).length, "一张图都没登记").toBeGreaterThan(5);
    for (const [shot, sources] of Object.entries(SHOT_SOURCES)) {
      expect(existsSync(resolve(ROOT, shot)), `登记了不存在的图:${shot}`).toBe(true);
      expect(lastCommitSec(shot, ROOT), `查不到 ${shot} 的提交时间`).not.toBeNull();
      for (const src of sources) {
        expect(existsSync(resolve(ROOT, src)), `${shot} 登记的源码不存在:${src}`).toBe(true);
        expect(lastCommitSec(src, ROOT), `查不到 ${src} 的提交时间`).not.toBeNull();
      }
    }
  });

  it("判据的前提:git log 对不同的路径要给出不同的时间", () => {
    /*
     * 上一条只核了「取得到时间」,而**取得时间**和**取得有分辨力的时间**是两回事。
     *
     * `actions/checkout` 默认 `fetch-depth: 1`(浅克隆)。浅克隆里 `.git/shallow`
     * 的 graft 边界把历史截断,`git log -1 -- <任意路径>` 一律返回**边界那次提交**
     * 的时间 —— 于是「图的时间 < 源码的时间」两边恒等,这条判据无论图多旧都是绿的。
     *
     * 实测(2026-11-11,同一个提交 60600518 上,同一份代码):
     *
     *   完整历史克隆            × 红: welcome / codex / world 三张旧于界面
     *   `--depth 1` 浅克隆      ✓ 绿: 什么都没查出来
     *
     * 而当时三个 workflow 的 checkout 都没写 `fetch-depth`,CI 跑的就是后者。
     * 也就是说这条判据在 CI 上**从来没真正执行过**,它自己不知道。
     *
     * 故这里核的是分辨力本身:把 SHOT_SOURCES 里登记的全部路径各取一次时间,
     * 若**全都相等**,说明当前仓库的历史不够深(浅克隆 / graft 边界 / 单提交检出),
     * 判据此刻没有意义 —— 与其绿着骗人,不如红着说清原因。
     *
     * 为什么是「全等」而不是「至少有一对不同」:若只有一对不同,可能纯属巧合
     * (个别路径恰好在边界提交里被改过);全等才是历史被截断的确定特征。
     * 反过来说,只要有一个路径的时间与别的不同,历史就确实保留到了那之前。
     */
    const times = new Set<number>();
    for (const [shot, sources] of Object.entries(SHOT_SOURCES)) {
      times.add(lastCommitSec(shot, ROOT)!);
      for (const src of sources) times.add(lastCommitSec(src, ROOT)!);
    }
    expect(
      times.size,
      "git log 对所有登记路径给出了同一个时间 —— 当前仓库是浅克隆(graft 边界截断了历史)," +
        "这条判据此刻无论图多旧都会绿。CI 上请在 checkout 补 `fetch-depth: 0`;" +
        "本地可跑 `git fetch --unshallow`。" +
        `\n  取到的唯一时间:${[...times].join(", ") || "(无)"}`,
    ).toBeGreaterThan(1);
  });

  it("判据的前提:CI 的静态门是全历史检出", () => {
    /*
     * 上一条只能在本机发现「我现在跑在浅克隆里」。而 CI 上的浅克隆是**设计出来的**:
     * `actions/checkout` 默认 `fetch-depth: 1`,不显式覆盖就永远是浅克隆 ——
     * 上一条会在 CI 上红,但**红在初次改动之前**谁也看不到;等它红的时候,
     * 读的人只会以为是这次提交弄坏了什么。
     *
     * 故把「CI 必须全历史检出」本身也变成判据:它守的不是截图,是这条判据的立身之本。
     * 两者分工 —— 上一条问「我此刻有分辨力吗」,这一条问「CI 上还会有吗」。
     *
     * 为什么只钉 gate.yml:三个 workflow(build / deploy / publish)都经 `uses`
     * 引用它,改这一处就覆盖全部;各自 job 里的 checkout 只用于打包,不跑 vitest。
     * 这条接线本身由 `gateWiring.spec` 守着,若将来有人把 gate 拆开,那边会红。
     */
    const gate = readFileSync(join(ROOT, ".github/workflows/gate.yml"), "utf8");
    const lines = gate.split("\n");
    const at = lines.findIndex((l) => l.includes("uses: actions/checkout@"));
    expect(at, "gate.yml 里找不到 checkout 步骤 —— 这条判据的前提不成立了").toBeGreaterThan(0);

    /*
     * 从 checkout 那一行往下看 5 行,找 `fetch-depth: 0`。
     * 不去解析 YAML(仓库没有 YAML 依赖,为一条判据引一个不值得):
     * `with:` 块在 `- name:` 之下、下一个 `- ` 之上,几行之内必现。
     * 但「看 5 行」是个脆的写法,故先确认真的在块内 —— 若中间撞上另一个列表项,
     * 说明结构变了,判据宁可报错也不要静默失准。
     */
    let depth: string | null = null;
    for (let i = at + 1; i < Math.min(at + 6, lines.length); i += 1) {
      const line = lines[i]!;
      if (/^\s*-\s/.test(line)) break;
      const m = /^\s*fetch-depth:\s*(\S+)/.exec(line);
      if (m) {
        depth = m[1]!;
        break;
      }
    }
    expect(
      depth,
      "gate.yml 的 checkout 没有写 `fetch-depth: 0` —— CI 因此是浅克隆," +
        "`git log` 对所有路径返回同一个时间,`docShotsFresh` 那条截图判据在 CI 上永远不会变红。" +
        "\n  代价只是多拉几十秒历史(仓库 62 MB);判据本身在 `src/core/docShotsFresh.spec.ts`。",
    ).toBe("0");
  });

  it("图不比它展示的界面旧 —— 红了就跑 `bun scripts/shots.mjs`", () => {
    /*
     * 现实里总会有「改了一行注释也要重拍」的误报。判据不为此放宽容差:
     * 重拍一次是 `bun run build && bun scripts/shots.mjs`,几十秒的事;
     * 而挂着一张展示旧 bug 的图,是玩家第一眼看到的东西。
     */
    const stale = Object.entries(SHOT_SOURCES)
      .filter(([shot, sources]) => {
        /*
         * 任一侧还没提交就不判:pre-commit 时新图已 staged 但尚无提交时间,
         * 纯按 git log 比会把它判成旧图,门永远过不去。
         */
        if (hasUncommitted(shot, ROOT)) return false;
        return !sources.some((src) => hasUncommitted(src, ROOT));
      })
      .map(([shot, sources]) => {
        const shotAt = lastCommitSec(shot, ROOT)!;
        const newest = sources
          .map((src) => ({ src, at: lastCommitSec(src, ROOT)! }))
          .sort((a, b) => b.at - a.at)[0]!;
        return newest.at > shotAt ? { shot, src: newest.src } : null;
      })
      .filter((x): x is { shot: string; src: string } => x !== null)
      .map(({ shot, src }) => `${shot} 旧于 ${src}`);

    expect(
      stale,
      "这些文档图比它展示的界面旧了 —— 跑 `bun run build && bun scripts/shots.mjs` 重拍:" +
        `\n  ${stale.join("\n  ")}`,
    ).toEqual([]);
  });
});
