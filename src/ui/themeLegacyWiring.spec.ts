/**
 * 命途词条必须真的进 `finalStats` —— 否则它只是数据里的一行字。
 *
 * ## 为什么这条在 ui/ 而不在 core/
 *
 * 它要读 `player.finalStats`（Pinia）。`layeringAudit` 的 `CORE_PINIA_SPECS`
 * 只许减，故这类「接线后的行为」放 ui/ 层。
 *
 * ## 判据
 *
 * ① 没有达成过命题时，那一份词条是空的;
 * ② 达成了「登顶」之后，减伤 +6% 真的出现在面板上;
 * ③ 同一个命题达成两次不加倍。
 */
import { describe, expect, it, beforeEach } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { usePlayerStore } from "@/stores/player";
import { themeLegacyMods } from "@/core/themeMods";

describe("命途词条 · 从存档到面板", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("① 没达成过命题时，那一份是空的", () => {
    const player = usePlayerStore();
    expect(
      themeLegacyMods(player.reincarnation.lives),
      "初始状态就有词条 —— 那它不是「达成的回报」",
    ).toEqual({});
    /* 反空转：面板本身得算得出来 */
    expect(player.finalStats).toBeTruthy();
  });

  it("② 达成「登顶」之后，减伤 +6% 出现在面板上", () => {
    const player = usePlayerStore();
    const before = player.finalStats.mods.damageReduction ?? 0;
    player.reincarnation.lives = [
      {
        index: 1,
        themeId: "lt_dacheng",
        themeResult: "done",
      } as unknown as (typeof player.reincarnation.lives)[number],
    ];
    const delta = themeLegacyMods(player.reincarnation.lives);
    expect(delta.damageReduction, "登顶没给减伤 —— data 里那个 0.06 没被读到").toBeCloseTo(0.06, 6);
    /*
     * 面板要跟着涨。`finalStats.mods` 是合并后的值，减伤不受软阈值影响，
     * 故这一份应当整份透传上去。
     */
    const after = player.finalStats.mods.damageReduction ?? 0;
    expect(after, "面板上没涨 —— 那一份没进 modSources").toBeGreaterThan(before);
  });

  it("③ 同一个命题达成两次不加倍", () => {
    const player = usePlayerStore();
    player.reincarnation.lives = [
      {
        index: 1,
        themeId: "lt_dacheng",
        themeResult: "done",
      } as unknown as (typeof player.reincarnation.lives)[number],
      {
        index: 2,
        themeId: "lt_dacheng",
        themeResult: "done",
      } as unknown as (typeof player.reincarnation.lives)[number],
    ];
    expect(
      themeLegacyMods(player.reincarnation.lives).damageReduction,
      "同一条命题给了两次 —— Set 去重没生效",
    ).toBeCloseTo(0.06, 6);
  });
});
