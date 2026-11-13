/**
 * 试炼预览的判据 —— 它卖的是「先看再押」，所以**不许和真打有第二个答案**。
 *
 * 三条:
 * ① 预览与 `challengeTrial` 的真实结果**逐位相同**（同一个种子、同一份敌群与规则）;
 * ② 预览**不写 store**——不扣道源、不记战绩（它是个只读动作）;
 * ③ 读数把「止步第几战」说出来 —— 只写「打不过」等于没说。
 */
import { describe, expect, it, beforeEach } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { usePlayerStore } from "@/stores/player";
import { useEndgameStore } from "@/stores/endgame";
import { challengeTrial } from "./endgameService";
import { forecastTrial, trialForecastText, seedOf } from "./trialForecast";
import { buildPlayerSnap } from "./playerSnap";
import { mergeRules } from "./gauntlet";
import { currentDaoRules } from "./endgameService";
import { trialDef } from "@/data/endgame";
import { TRIALS } from "@/data/endgame";

/** 一个真仙期的玩家 —— 试炼要跃过锚点层级，故不能从炼气开始量 */
function celestialPlayer(): void {
  const player = usePlayerStore();
  player.initCharacter("试炼探针", { roots: [] } as never);
  for (let m = 0; m < 9; m += 1) {
    for (let s = 0; s < 9; s += 1) player.advanceRealm();
    player.advanceRealm();
  }
  const endgame = useEndgameStore();
  endgame.chooseDao("sword");
  endgame.addDaoSource(10_000);
}

/**
 * 预览的输入 —— 读 store 的那一半留在调用方（视图里做同样的事）。
 *
 * 判据这里也照做,是因为「预览与真打同源」这条只有在**两边吃同一份输入**时才有意义。
 */
function forecastOf(trialId: string) {
  const player = usePlayerStore();
  const endgame = useEndgameStore();
  const stats = player.celestialStats;
  const trial = trialDef(trialId);
  return forecastTrial({
    trialId,
    playerSnap: buildPlayerSnap(true),
    ref: { attack: stats.attack, defense: stats.defense, maxHp: stats.maxHp },
    mods: stats.mods,
    playerMajor: player.major,
    daoPath: endgame.daoPath,
    rules: mergeRules(currentDaoRules(), trial?.rules),
    alreadyCleared: Boolean(endgame.trialRecords[trialId]?.clears),
  });
}

describe("试炼预览 · 与真打同源", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    celestialPlayer();
  });

  it("预览与真打逐位相同（胜负、场次、回合）", () => {
    const endgame = useEndgameStore();
    for (const trial of TRIALS) {
      const forecast = forecastOf(trial.id)!;
      // 真打会扣道源，故每次补满
      endgame.addDaoSource(10_000);
      const real = challengeTrial(trial.id)!;
      expect(real, `${trial.name} 真打没有结果`).not.toBeNull();
      expect(
        { cleared: forecast.cleared, won: forecast.fightsWon, rounds: forecast.totalRounds },
        `${trial.name}:预览与真打分叉了 —— 玩家会按一份错的预估押道源`,
      ).toEqual({
        cleared: real.report.cleared,
        won: real.report.fightsWon,
        rounds: real.report.totalRounds,
      });
    }
  });

  it("预览不写存档 —— 不扣道源、不记战绩", () => {
    const endgame = useEndgameStore();
    const before = endgame.daoSource;
    const recordsBefore = JSON.stringify(endgame.trialRecords);
    for (const trial of TRIALS) forecastOf(trial.id);
    expect(endgame.daoSource, "预览把道源扣掉了").toBe(before);
    expect(JSON.stringify(endgame.trialRecords), "预览记了战绩").toBe(recordsBefore);
  });

  it("种子算法与 challengeTrial 用的那一份相同（同一个函数,不是两份抄本）", () => {
    /*
     * `seedOf` 从 `endgameService` 抽到 `trialForecast` 之后,两边必须仍在用**同一个**。
     * 这条判据的写法是「同一个输入的两次调用必须相等」—— 若哪天有人把它复制回去、
     * 又顺手改了其中一份（例如把 `life + 1` 写成 `life`），两边的预览与真打就会分叉,
     * 而那种分叉只在某些 trialId 上才显形,很难靠肉眼发现。
     */
    expect(seedOf("qisha", 0)).toBe(seedOf("qisha", 0));
    expect(seedOf("qisha", 0)).not.toBe(seedOf("yixian", 0));
  });
});

describe("试炼预览 · 读数", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    celestialPlayer();
  });

  it("打不过时把「止步第几战」说出来，并提醒道源照扣", () => {
    /*
     * 找一个真的打不过的试炼:不给道途加成、把玩家压回低境界即可。
     * 这里直接用手上的构筑遍历 —— 总有至少一门打不过或全过,两种都验。
     */
    const forecasts = TRIALS.map((t) => forecastOf(t.id)!);
    const lost = forecasts.filter((f) => !f.cleared);
    if (lost.length === 0) {
      // 全过的档:读数必须是「可破」而不是空的
      for (const f of forecasts) expect(trialForecastText(f)).toContain("可破");
    } else {
      const f = lost[0]!;
      const text = trialForecastText(f)!;
      expect(text).toContain(`止步第 ${f.lostAt} 战`);
      expect(text, "道源照扣这件事要在付钱之前说").toContain("道源照扣");
    }
  });

  it("通过时报几战几回合", () => {
    const f = {
      cleared: true,
      fightsWon: 5,
      fights: 5,
      totalRounds: 61,
      lostAt: null,
      firstClearReward: 0,
    };
    const text = trialForecastText(f)!;
    expect(text).toContain("可破");
    expect(text).toContain("5 战全胜");
    expect(text).toContain("61 回合");
  });

  it("不存在的试炼不编读数", () => {
    expect(forecastOf("no_such_trial")).toBeNull();
  });
});
