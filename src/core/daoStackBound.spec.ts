/**
 * 道途逐胜叠层的**量级边界** —— 它走的是不经 `mergeMods` 的直加路径。
 *
 * ## 为什么要专门守它
 *
 * `core/daoDepth` 的 `stackedMods` 与 `core/statsCalc` 的 `mergeMods` 是两条
 * **不同的合并路径**,语义也不同:
 *
 * ```text
 *   mergeMods    多个来源     按 DIMINISH_KEYS 100/75/50/25% 递减 + SOFT_CAPS
 *   stackedMods  同一来源多层  线性直加,两道防线都不经过
 * ```
 *
 * 第 81 轮核过这件事:`docs/design.md` 说「其余词条线性叠加,不收敛」,
 * 而 `stackedMods` 正是那种「同一来源的逐层累加」,所以**直加是对的**。
 *
 * ## 但直加必须有边界
 *
 * `SWORD_PER_WIN` 与 `SWORD_LAYER_MODS` 都含 `critRate`(在 `DIMINISH_KEYS` 里),
 * 且 `SWORD_PER_WIN` 的 `damageBonus` **不在任何防线里**,而它直接乘进伤害:
 *
 * ```ts
 * factor = mult * (1 + damageBonus) * (1 - attacker.weaken)
 * ```
 *
 * 若哪天远征层数从 3 改成 20,`damageBonus` 会到 0.80(伤害 ×1.8)而没人拦 ——
 * 因为它绕过了 `mergeMods`。这条判据量的是**现实叠层数下的量级**。
 *
 * ## 现在的实际量级
 *
 * 远征 3 层 → 最多叠 2 层 → `critRate +0.04` / `damageBonus +0.08`(伤害 ×1.08)。
 * 远在安全区。判据把这条线钉住:层数或每层数值一改,它就会告诉你会涨到多少。
 */
import { describe, expect, it } from "vite-plus/test";
import { EXPEDITION_ROUTE_LAYERS } from "@/data/endgame";
import { DIMINISH_KEYS } from "@/data/constants";
import { SLAUGHTER_PER_WIN, SWORD_LAYER_MODS, SWORD_PER_WIN, stackedMods } from "./daoDepth";

/** 现实中最多能叠几层:走完全程的层数减去最后那层守卫 */
const MAX_STACKS = EXPEDITION_ROUTE_LAYERS - 1;

describe("道途叠层 · 量级边界", () => {
  it("剑道逐胜叠到满层时,伤害乘数不超过 1.2", () => {
    const mods = stackedMods({}, SWORD_PER_WIN, MAX_STACKS);
    const mult = 1 + (mods.damageBonus ?? 0);
    expect(
      mult,
      `剑道叠满 ${MAX_STACKS} 层时伤害 ×${mult.toFixed(2)} —— ` +
        `stackedMods 不经 SOFT_CAPS,再往上调层数会直接失控`,
    ).toBeLessThanOrEqual(1.2);
  });

  it("杀伐道逐胜叠到满层时,伤害乘数不超过 1.2", () => {
    const mods = stackedMods({}, SLAUGHTER_PER_WIN, MAX_STACKS);
    const mult = 1 + (mods.damageBonus ?? 0);
    expect(mult, `杀伐道叠满时伤害 ×${mult.toFixed(2)}`).toBeLessThanOrEqual(1.2);
  });

  it("critRate 叠到满层时不超过 SOFT_CAPS 的上限 0.75", () => {
    /*
     * `critRate` 在 `DIMINISH_KEYS` 与 `SOFT_CAPS` 里(0.75 / 0.5),
     * 但 `stackedMods` 绕过了它们。战斗里 `rng.chance` 对 >1 的输入会饱和到 100%,
     * 所以不会崩;但要守住「叠层本身不该摸到那个天花板」。
     */
    for (const [label, layer] of [
      ["剑意", SWORD_LAYER_MODS],
      ["剑道逐胜", SWORD_PER_WIN],
    ] as const) {
      const mods = stackedMods({}, layer, MAX_STACKS);
      expect(
        mods.critRate ?? 0,
        `${label}叠满 ${MAX_STACKS} 层时 critRate=${(mods.critRate ?? 0).toFixed(2)} —— 摸到天花板了`,
      ).toBeLessThanOrEqual(0.3);
    }
  });

  it("stackedMods 不改原对象", () => {
    // 它被 `runSnap` 每层调用一次,若改原对象会把叠层累加成指数
    const base = { critRate: 0.1 };
    stackedMods(base, SWORD_PER_WIN, 3);
    expect(base.critRate, "stackedMods 改了传入的 base —— 每层调用会累加成指数").toBe(0.1);
  });

  it("层数为 0 或负时原样返回", () => {
    const base = { critRate: 0.1 };
    expect(stackedMods(base, SWORD_PER_WIN, 0)).toEqual(base);
    expect(stackedMods(base, SWORD_PER_WIN, -1)).toEqual(base);
  });

  it("反空转:叠层的键真的与递减集合有交集 —— 这条判据守的是真问题", () => {
    /*
     * 若哪天 `SWORD_PER_WIN` 换成了不含递减键的词条,「绕过 mergeMods」这件事
     * 就不再值得担心。这条会提醒:是时候重写上面几条了。
     */
    const diminish = new Set<string>(DIMINISH_KEYS as readonly string[]);
    const overlap = Object.keys(SWORD_PER_WIN).filter((k) => diminish.has(k));
    expect(
      overlap.length,
      "剑道逐胜叠层已经不含任何递减词条 —— 这份判据的前提没了,该重写",
    ).toBeGreaterThan(0);
  });
});
