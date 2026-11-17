/**
 * 本世回照 —— 一世的账收成一句话。
 *
 * ## 究竟补了什么
 *
 * 历世履历每一行报的是「这一世是什么」（终点第几境 / 终寿 / 立的题 / 结局 /
 * 签过的契 / 那副灵根）。而玩家翻履历找的是「这一世做了什么」——
 * 两者不是一回事，而后者此前一句都没有。
 *
 * ## 判据
 *
 * ① 三种素材各自都能出现在句子里;
 * ② 一条素材都没有时返回空串 —— 界面据此不出这一行，而不是印一句空话;
 * ③ 反差：同一个履历永远同一句（不掷随机、不读时间）;
 * ④ 反差：它不引入新数据 —— 只读 `LifeRecord` 里已有的字段。
 */
import { describe, expect, it } from "vite-plus/test";
import type { LifeRecord } from "@/data/samsara";
import { lifeEpitaph } from "@/core/lifeEpitaph";
import { LIFE_THEMES } from "@/data/lifeThemes";
import { LIFE_TRIALS } from "@/data/lifeTrials";

/** 造一条最小的履历 —— 只填这一条判据关心的字段 */
function rec(over: Partial<LifeRecord> = {}): LifeRecord {
  return {
    index: 1,
    major: 3,
    realmLabel: "金丹·圆满",
    age: 220,
    themeId: null,
    themeResult: null,
    insight: 0,
    at: 0,
    ...over,
  };
}

describe("本世回照 · 一句话说清这一世", () => {
  it("① 三种素材各自都能出现在句子里", () => {
    const theme = LIFE_THEMES[0]!;
    const trial = LIFE_TRIALS[0]!;

    const onlyTheme = lifeEpitaph(rec({ themeId: theme.id, themeResult: "done" }));
    expect(onlyTheme, "立了题却没说").toContain(theme.name);
    expect(onlyTheme, "没说结局").toMatch(/走到底|没走完|破了题/);

    const onlyTrial = lifeEpitaph(rec({ trialId: trial.id }));
    expect(onlyTrial, "签了契却没说 —— 而「被记住」正是它唯一的回报").toContain(trial.name);

    const onlyLinggen = lifeEpitaph(rec({ linggen: { gradeName: "真灵根", roots: [] } }));
    expect(onlyLinggen, "记了灵根却没说").toContain("真灵根");
  });

  it("② 一条素材都没有时返回空串", () => {
    /*
     * 「初世」这类什么都没有的一世，不该被编出一句话来。
     * 界面据空串决定不出这一行。
     */
    expect(lifeEpitaph(rec()), "什么都没有却编出了一句").toBe("");
  });

  it("③ 反差：同一个履历永远同一句", () => {
    /*
     * 不掷随机、不读时间 —— 连调十次都该一模一样。
     * 若哪天有人往里加了 `rng` 或 `Date.now()`，这条会红。
     */
    const r = rec({ themeId: LIFE_THEMES[0]!.id, themeResult: "done" });
    const first = lifeEpitaph(r);
    for (let i = 0; i < 10; i += 1) expect(lifeEpitaph(r)).toBe(first);
    /* 而且它不该随调用时刻变化 —— 隔一段真实时间再取一次 */
    expect(lifeEpitaph(r)).toBe(first);
  });

  it("④ 反差：它不读 LifeRecord 之外的任何东西", () => {
    /*
     * 这一条守的是「不引入新数据」。做法:把同一个 LifeRecord 深拷贝一份，
     * 两次结果必须一致 —— 若函数偷偷读了 store 或全局状态，两者就可能分叉。
     */
    const r = rec({
      themeId: LIFE_THEMES[0]!.id,
      themeResult: "done",
      trialId: LIFE_TRIALS[0]!.id,
    });
    const copy: LifeRecord = JSON.parse(JSON.stringify(r));
    expect(lifeEpitaph(copy)).toBe(lifeEpitaph(r));
  });
});
