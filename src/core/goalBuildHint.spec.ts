/**
 * 核心词条已经凑齐时，不该还说「继续寻找关键装备」。
 *
 * ## 由来（第 195 轮，查中后期玩家是否「没事可做」）
 *
 * `core/goal` 的流派分支:
 *
 * ```ts
 * const core = Math.min(build.coreValues.length, build.coreTotal);
 * const total = Math.max(1, build.coreTotal);
 * return {
 *   text: `完善「${style}」流派`,
 *   progress: Math.min(1, core / total),
 *   hint: `当前已凑出 ${core}/${total} 个核心词条,继续寻找关键装备`,
 *   ...
 * };
 * ```
 *
 * 而 `detectBuild` 里:
 *
 * ```ts
 * coreValues: best.terms.filter((term) => term.value > 0),  // 只留已有贡献的
 * coreTotal: best.terms.length,                              // 全量
 * ```
 *
 * 于是当玩家把这一路的核心词条**全凑齐**（`core === total`，进度 1.0）时，
 * 首页那张卡仍然写着「**继续寻找关键装备**」—— 而已经没有下一件可找了。
 *
 * ## 为什么这算缺陷
 *
 * 这是首页最显眼的那一格（「当前道途」），玩家每天打开都看它。
 * 一个进度已经 100% 的目标，提示语却指向下一步动作 —— 而那个动作不存在。
 * 玩家会去找，找不到，然后怀疑是不是自己漏了什么。
 *
 * 这一仓的纪律里写着「决策信息完整」与「界面上出现的每个数字都与结算同源」。
 * 进度条说满了、提示语说还差 —— 这两句在打架。
 *
 * ## 这条判据守什么
 *
 * `core === total` 时，`hint` 必须换一句（不说「继续寻找」）。
 * 不钉新文案的内容 —— 该说什么由写的人定（完成后指向流派大成、
 * 指向换一路、或指向别的目标）。
 *
 * ## 故障注入
 *
 * 把 `hint: done ? A : B` 换回单句「继续寻找关键装备」→
 * 「行为」那条当场红（它直接读 `generateCurrentGoal` 的输出）。
 * 同时「凑齐与没凑齐给出的是两句不同的话」也红。
 */
import { describe, expect, it } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { readSource } from "@/test/readSource";
import { stripComments } from "@/test/stripComments";
import { generateCurrentGoal } from "./goal";
import { usePlayerStore } from "@/stores/player";

const SRC = "src/core/goal.ts";

describe("道途 · 核心词条凑齐之后的提示语", () => {
  it("判据的前提还在 —— 流派分支与那两个数", () => {
    const src = stripComments(readSource(SRC));
    for (const anchor of ["build.coreValues.length", "build.coreTotal", "完善「"]) {
      expect(src, `判据的前提没了：${anchor} —— 判据该跟着改，不是删掉`).toContain(anchor);
    }
  });

  it("凑齐时提示语换一句，不再说「继续寻找」", () => {
    const src = stripComments(readSource(SRC));
    /*
     * 判那件事:流派分支里必须有一处**按 core 与 total 是否相等**分岔的地方，
     * 且「继续寻找关键装备」这句不能是唯一那句。
     *
     * 做法:取出流派分支的代码块（从 `const build = detectBuild` 到该 return 的分号），
     * 看里面有没有 `core === total` / `core >= total` 之类的比较。
     */
    const start = src.indexOf("const build = detectBuild");
    expect(start, "找不到流派分支").toBeGreaterThan(-1);
    const end = src.indexOf('destination: { to: "/build"', start);
    expect(end, "找不到流派分支的去路").toBeGreaterThan(start);
    const block = src.slice(start, end);

    expect(
      block,
      "流派分支里没有区分「凑齐了没有」—— 于是凑齐时仍然说「继续寻找关键装备」，" +
        "而首页那张卡的进度条已经是 100%。玩家会去找，找不到，然后怀疑是不是漏了什么",
    ).toMatch(/core\s*[=>=]{2,3}\s*total|core\s*<\s*total/);
  });

  it("行为:凑齐时首页那张卡说的是「已齐」而不是「继续寻找」", () => {
    /*
     * 这条是**行为判据** —— 直接调 `generateCurrentGoal`,看真实输出的那句话。
     * 上面两条只看源码形状;一条源码判据挡不住「分支写了但接错」。
     *
     * 做法:建一个空档（不会检出流派）,再伪造 `finalStats.mods` 让
     * `detectBuild` 认出流派,并把那一路的核心词条全部顶到参考值以上。
     */
    setActivePinia(createPinia());
    const player = usePlayerStore();
    player.initCharacter("凑齐探针", { roots: [] } as never);

    // 前提自检:空档不该检出流派，否则下面那条测不到「凑齐」这件事
    expect(generateCurrentGoal(player)?.type, "空档就检出了流派 —— 前提不对").not.toBe("build");

    /*
     * 把背水流那一路的两个核心词条顶到参考值以上（`core` 表见 BUILD_STYLES）,
     * 于是 `detectBuild` 认出这条路、且 `coreValues.length === coreTotal`。
     */
    const mods = player.finalStats.mods as Record<string, number>;
    mods.lowHpDamage = 0.9;
    mods.lowHpReduction = 0.9;

    const goal = generateCurrentGoal(player);
    expect(goal?.type, "把核心词条顶满了却没检出流派 —— 前提要重做").toBe("build");
    expect(goal!.progress, "进度该是满的").toBe(1);
    expect(
      goal!.hint,
      "核心词条已经凑齐了，提示语还在说「继续寻找关键装备」—— 而那一句指向的下一步不存在。" +
        "首页那张卡的进度条已经是 100%，两句话在打架",
    ).not.toMatch(/继续寻找/);
    expect(goal!.text, "凑齐之后标题还是「完善⋯⋯」—— 已经没什么可完善的了").not.toMatch(/^完善/);
  });

  it("凑齐与没凑齐给出的是两句不同的话", () => {
    /*
     * 防空转的第二层:光有比较还不够 —— 若两支说同一句，玩家读到的还是一样。
     *
     * 第一版数 `hint:` 出现的次数，而实现写成了三元 `hint: done ? A : B`
     * —— 一个 `hint:` 标签、两句文案，判据误判成「只有一句」（实测）。
     * 改成数**流派分支里出现的文案串数**。
     */
    const src = stripComments(readSource(SRC));
    const start = src.indexOf("const build = detectBuild");
    const end = src.indexOf('destination: { to: "/build"', start);
    const block = src.slice(start, end);
    // 模板串（`…`）与普通串（"…"）都算一句文案
    const texts = [...block.matchAll(/`[^`]*`|"[^"]{6,}"/g)].map((m) => m[0]);
    expect(
      texts.length,
      "流派分支里的文案只有一种 —— 无论凑没凑齐都说同一句，那玩家的处境变了而提示没变",
    ).toBeGreaterThanOrEqual(3); // text 两支 + hint 两支，至少三条不同串
    // 「继续寻找」只许出现在一支里
    const stillSeeking = texts.filter((t) => t.includes("继续寻找"));
    expect(
      stillSeeking.length,
      `「继续寻找」出现在 ${stillSeeking.length} 处 —— 它该只属于「还没凑齐」那一支`,
    ).toBeLessThanOrEqual(1);
  });
});
