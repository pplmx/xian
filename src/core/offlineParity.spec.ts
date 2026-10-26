/**
 * 离线历练与在线历练的「规则同源」红线
 *
 * 历史偏差一:在线 runBattle 把本世逆旅契(lifeTrialRules)并进每场历练战斗,
 * 离线 settleOffline 的普通战与首领战却只传 currentDaoRules —— 四张契
 * (孤行/疾行/残躯/逆锋)的加难在本世最大的时段(离线挂机)里完全不生效,
 * 同一本世、同一地界,离线胜率与在线系统性分叉。危险因子当年就是这么漏的
 * (见 battleFactor.spec),照 HYP-015 的同一条判据抽成 explorationRules,
 * 在线/离线共用一份实现,禁止离线再内联 currentDaoRules。
 *
 * 历史偏差二:离线事件自动结算用硬编码 5 个 general 事件池,不读本世路线节点 ——
 * 敌群已走 placeContent(「敌群取自本世路线节点」),事件也必须走同一条路,
 * 经 regionEventPoolFor 尊重本世 eventTags / minRealm / once。
 */
import { describe, expect, it, beforeEach } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { resetWorld } from "./parityShared";
import { explorationRules } from "./exploration";
import { settleOffline } from "./offline";
import { usePlayerStore } from "@/stores/player";
import { useGameStore } from "@/stores/game";
import { useAdventureStore } from "@/stores/adventure";
import { useLoreStore } from "@/stores/lore";

const src = (f: string) => resolve(__dirname, f);

describe("离线历练 · 战斗规则与在线同源(逆旅契)", () => {
  beforeEach(resetWorld);

  it("逆旅契合并只此一份:在线与离线都经 explorationRules,离线不再内联 currentDaoRules", () => {
    const exploration = readFileSync(src("./exploration.ts"), "utf8");
    const offline = readFileSync(src("./offline.ts"), "utf8");
    // 逆旅契规则在此实现,在线调用点不另起炉灶
    expect(exploration).toContain("lifeTrialRules()");
    // 离线普通战与首领战都走共用函数
    expect(offline).toContain("explorationRules");
    // 前车之鉴:离线只带 currentDaoRules 就会漏契 —— 此调法再不得出现在离线结算
    expect(offline).not.toContain("currentDaoRules()");
  });

  it("签下逆锋契后,explorationRules 并入敌攻/敌命加成", () => {
    usePlayerStore().setLifeTrial({ trialId: "tr_ni", at: 0, paid: 48 });
    const rules = explorationRules();
    expect(rules?.enemyAtkMult).toBeCloseTo(1.3, 10);
    expect(rules?.enemyHpMult).toBeCloseTo(1.2, 10);
  });

  it("未签契且未择道途时,explorationRules 为空(不叠加任何规则)", () => {
    expect(explorationRules()).toBeUndefined();
  });
});

describe("离线历练 · doubleDropRate 与在线同源", () => {
  it("离线普通战结算并入福缘词条:doubleDropRate 按期望值乘入灵石/修为/材料/装备", () => {
    const offline = readFileSync(src("./offline.ts"), "utf8");
    // 词条不能只对在线 afterWin 生效 —— 离线普通战公式必须读到它(首领战走 afterWin 天然生效)
    expect(offline).toContain('modOf(mods, "doubleDropRate")');
    // 期望值乘子(doubleMult)要真的乘进了四处产出公式(stones/exp/materials/equip)
    expect(offline).toContain("* doubleMult");
  });
});

describe("离线历练 · 事件池与在线同源(本世路线)", () => {
  it("离线事件走 placeContent 的 regionEventPoolFor,不再只剩硬编码通用池", () => {
    const offline = readFileSync(src("./offline.ts"), "utf8");
    expect(offline).toContain("regionEventPoolFor");
    expect(offline).toContain("placeContent(region.id).eventTags");
    // 但世界事件不能无条件自动结算:身份/永久构筑类(pet/gongfa/artifact/lifespan)
    // 会被 isOfflineSafeEvent 拦下 —— 它在离线作用域红线段言(offlineScope)里被真实验证
    expect(offline).toContain("isOfflineSafeEvent");
    expect(offline).toContain("OFFLINE_SAFE_EFFECTS");
  });
});

describe("离线历练 · 区域事件加丰与加难成对(regReward)", () => {
  it("离线普通战与首领战的奖励都并上 regionEventReward,不再只有危险", () => {
    const offline = readFileSync(src("./offline.ts"), "utf8");
    // 与 danger 同源:妖潮/古墓/商队在加难的同时也加丰(奖励倍率进石头/修为/掉落数)
    expect(offline).toContain("regionEventReward");
    // 第四个参数是本世资源偏向:离线首领战也要与在线同口径(见 core/mortalBias)
    expect(offline).toMatch(
      /afterWin\(\s*region,\s*modeDef\.rewardMult \* OFFLINE_BOSS_REWARD_MULT \* regionEventReward,\s*true,\s*currentWorldBias\(\),\s*\)/,
    );
    expect(offline).toContain("modeDef.rewardMult * regionEventReward");
    expect(offline).toMatch(
      /EQUIP_DROP_CHANCE\s*\*\s*modeDef\.rewardMult\s*\*\s*regionEventReward/,
    );
    // 残页与在线同源:在线 page 掉落判定是 rng.chance(PAGE_DROP_CHANCE * rewardMult),
    // rewardMult 参数含 mode×reg —— 离线残页若只写死 0.15、不吃模式倍率,高收益模式赌残页就落空
    // 用允许换行/空白的正则,别锁死单行写法:本轮给 page 乘区补 biasChanceMult 时
    // 把这行折成了多行,字面量判据当场误红 —— 判据该管「乘式还在」,不该管换行
    expect(offline).toMatch(
      /PAGE_DROP_CHANCE\s*\*\s*1\.5\s*\*\s*modeDef\.rewardMult\s*\*\s*regionEventReward/,
    );
  });
});

describe("离线历练 · 战后语义与在线同源", () => {
  beforeEach(resetWorld);

  it("离线普通战写入图鉴照面与区域统计,并走镇压判定", () => {
    const offline = readFileSync(src("./offline.ts"), "utf8");
    expect(offline).toContain("noteEnemyMany");
    expect(offline).toContain("applyRegionWinBatch");
    expect(offline).toContain("checkSuppression");
    expect(offline).toContain("noteEnemy(bossDef.id, bossResult.win)");
  });

  /**
   * 镇压达成的回执两处(普通战/首领战)要与在线同源 —— 在线报的是
   * suppressRateLine 的产出账(灵石/时 × 物产),离线若只喊一句
   * 「将自动产出资源」,同一件大事两套口径,玩家算不出挂机一夜值多少。
   */
  it("离线镇压达成的回执报产出账,与在线 suppressRateLine 同源", () => {
    const offline = readFileSync(src("./offline.ts"), "utf8");
    expect(offline).toContain("suppressRateLine");
    expect(offline, "空话口径不许再出现").not.toContain("此地将自动产出资源");
  });

  /**
   * 会话的胜负两本账要与在线同源:在线每胜一场 wins+1、每败一场 losses+1
   * (首领也在同一条 runBattle 路),离线整段结算却只写 wins —— 挂机一夜回来
   * 「此行胜 2 场」判不出打过 5 场,「胜+负 ≥3 才算走过一趟」的门槛也永远差着。
   */
  it("离线会话账记胜负两本:普通战整批、首领胜败各一场", () => {
    const offline = readFileSync(src("./offline.ts"), "utf8");
    // 会话推进处:两本账都进 setSession
    expect(offline).toMatch(/wins: session\.wins \+ sessionWins/);
    expect(offline).toMatch(/losses: session\.losses \+ sessionLosses/);
    // 首领两臂各记一场(在线同一口径:胜败都是一场)
    expect(offline).toContain("sessionWins += 1");
    expect(offline).toContain("sessionLosses += 1");
  });

  it("挂机归来后 regionStats / 图鉴照面随胜场推进", () => {
    const game = useGameStore();
    const player = usePlayerStore();
    const adventure = useAdventureStore();
    const lore = useLoreStore();
    game.markStarted();
    game.lastActiveAt = Date.now() - 60 * 3600 * 1000;
    player.major = 4;
    player.sub = 0;
    adventure.session = {
      regionId: "qingyun",
      mode: "normal",
      startedAt: Date.now() - 60 * 3600 * 1000,
      endsAt: Date.now() + 999 * 3600 * 1000,
      nextBattleAt: 0,
      wins: 0,
      losses: 0,
      events: 0,
      stoneGain: { m: 0, e: 0 },
      expGain: { m: 0, e: 0 },
      itemGain: 0,
    } as typeof adventure.session;

    const summary = settleOffline(Date.now());
    expect(summary, "这一档应当结算出离线收益").not.toBeNull();
    expect(summary!.wins, "60 小时挂机不该一场没赢").toBeGreaterThan(0);
    // summary.wins is regular fights only; a boss kill writes one extra region fight
    const bossExtra = summary!.notes.some((n) => n.includes("斩于剑下")) ? 1 : 0;
    expect(player.regionStats.qingyun?.totalFights, "离线胜场必须写入 regionStats").toBe(
      summary!.wins + bossExtra,
    );
    expect(player.regionWins.qingyun, "离线胜场必须写入区域兴衰").toBe(summary!.wins + bossExtra);
    const seen = Object.values(lore.enemySeen).reduce((n, v) => n + v, 0);
    expect(seen, "离线交手必须推进敌人图鉴").toBeGreaterThan(0);
  });
});
