/**
 * 离线普通战产出的模式倍率 —— 行为层回归。
 *
 * offlineParity.spec 是文本契约(断言源码含某串),只管「乘式字面还在」;
 * 这里真跑 settleOffline,验证模式倍率**真的进产出**。
 *
 * 历史偏差:xian 的离线残页写死 `wins * 0.15`、装备掉落没乘 `modeDef.rewardMult` ——
 * 「深入探寻(×1.4)/涉险求机(×1.9)/长线云游(×2.4)」的加成对离线残页、装备
 * 完全落空,只对灵石/修为两行生效;在线 afterWin 却把 mode×regReward 全折进
 * rewardMult 参数。玩家离线挂完回来,装备/残页的量和模式无关 — 离在线不同源。
 *
 * 确定性:产出全正比于 wins,而 wins 来自 sampleWinRateRaw(含 rng)。把 rng 与
 * sampleWinRateRaw 都 mock 成固定响应,于是整条链路每一步都确定 ——
 * 残页/装备的产出就只差 modeDef.rewardMult 一个因子:deep(×1.4)/normal(×1),
 * 与 RNG 无关,断言便不 flaky。
 *
 * 注意:mock 掉胜率意味着深探/寻常的「危险差」不再改变胜率 —— 那不是本测试
 * 要守的东西(危险耦合由 offlineScope/battleFactor 守),本测试只专注
 * 「倍率进产出」这一件事。
 */
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { setActivePinia, createPinia } from "pinia";
import { settleOffline } from "./offline";
import { recordWinStreakBatch } from "./earlyGameService";
import { useGameStore } from "@/stores/game";
import { usePlayerStore } from "@/stores/player";
import { useAdventureStore } from "@/stores/adventure";
import { useResourcesStore } from "@/stores/resources";
import { useInventoryStore } from "@/stores/inventory";
import { EXPLORE_BATTLE_INTERVAL } from "@/data/constants";
import { gn, sub, toNum } from "@/utils/gnum";

// rng 全响应固定:概率判定处处 0.5、pick 恒取首项 —— 序列确定
vi.mock("@/utils/random", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/utils/random")>();
  return {
    ...mod,
    rng: {
      next: () => 0.5,
      int: (a: number, _b: number) => a,
      float: (a: number, _b: number) => a,
      pick: <T>(arr: readonly T[]): T => arr[0]!,
      weighted: <T>(arr: readonly T[]): T => arr[0]!,
      chance: (): boolean => true,
    },
  };
});

// 胜率 mock 成固定 0.5:wins = round(battles×0.5),与模式的危险差无关。
// 否则 deep 危险高→胜率低→wins 少,会把倍率差淹没(初版测试正是栽在这)
vi.mock("./combat", async (importOriginal) => {
  const mod = await importOriginal<typeof import("./combat")>();
  return {
    ...mod,
    sampleWinRateRaw: () => 0.5,
  };
});

const SESSION_HOURS = 2;

function seedSession(mode: "normal" | "deep" | "risky" | "prolonged"): void {
  const game = useGameStore();
  const player = usePlayerStore();
  const adventure = useAdventureStore();
  game.markStarted();
  const started = Date.now() - SESSION_HOURS * 3600 * 1000;
  game.lastActiveAt = started;
  game.totalPlaySec = 60 * 60; // 本日第 1 小时,避开跨天时序
  player.major = 2; // 筑基境,打得动一阶区域
  player.exp = { m: 0, e: 0 };
  adventure.setSession({
    regionId: "qingyun",
    mode,
    startedAt: started,
    endsAt: started + SESSION_HOURS * 3600 * 1000,
    nextBattleAt: started + EXPLORE_BATTLE_INTERVAL * 1000,
    wins: 0,
    losses: 0,
    events: 0,
    stoneGain: gn(0),
    expGain: gn(0),
    itemGain: 0,
    wudaoGain: 0,
  });
}

interface Yields {
  page: number;
  equipChanceCount: number;
}

/** mock 后全链路确定:同输入必得同产出 */
function runOnce(mode: "normal" | "deep"): Yields {
  setActivePinia(createPinia());
  seedSession(mode);
  const beforePage = useResourcesStore().page;
  const beforeDust = useResourcesStore().dust;
  settleOffline(Date.now());
  return {
    page: Math.max(0, useResourcesStore().page - beforePage),
    // 装备按期望计件(equipCount),实际生成受 rng 与 6 件 cap 约束;取器灵尘增量对比最稳
    equipChanceCount: Math.max(0, useResourcesStore().dust - beforeDust),
  };
}

/**
 * 同一次离线、同一颗世界种子,只把「本世偏向」换掉 —— 其余全同(链路已 mock 确定)。
 * 只给最薄的一份世界:`placeContent` 在 chain 里找不到节点就回落 REGIONS,
 * 这里要的只是 `bias` 一个字段。
 */
function runWithBias(bias: string | undefined): { stone: number; herb: number; page: number } {
  setActivePinia(createPinia());
  seedSession("normal");
  useAdventureStore().setMortalWorld(bias ? ({ bias, chain: [] } as never) : null);
  const res = useResourcesStore();
  const before = { stone: toNum(res.spiritStone), herb: res.herb, page: res.page };
  settleOffline(Date.now());
  return {
    stone: toNum(res.spiritStone) - before.stone,
    herb: res.herb - before.herb,
    page: res.page - before.page,
  };
}

describe("离线普通战产出吃模式倍率(确定性)", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  /**
   * 断言「deep 约为 normal 的 1.4 倍」。这里用区间而非精确比:
   * 产出都过 Math.round(整数取整),1.4 倍因子落在 ±1 取整噪声里,
   * 精确 1.4 断言会因 round 错位而假红。区间 [×1.3, ×1.5] 把 round 噪声包住,
   * 又足以区分「倍率生效(≈1.4)」与「倍率缺失(=1)」两个世界。
   */
  it("「深入探寻」(×1.4) 残页产出约为「寻常游历」(×1) 的 1.4 倍(±取整噪声)", () => {
    const deep = runOnce("deep");
    const normal = runOnce("normal");
    expect(normal.page).toBeGreaterThan(0);
    expect(deep.page).toBeGreaterThanOrEqual(Math.round(normal.page * 1.3));
    expect(deep.page).toBeLessThanOrEqual(Math.round(normal.page * 1.5));
  });

  it("装备掉落同样按模式倍率约 1.4 放大", () => {
    const deep = runOnce("deep");
    const normal = runOnce("normal");
    expect(normal.equipChanceCount).toBeGreaterThan(0);
    expect(deep.equipChanceCount).toBeGreaterThanOrEqual(Math.round(normal.equipChanceCount * 1.3));
    expect(deep.equipChanceCount).toBeLessThanOrEqual(Math.round(normal.equipChanceCount * 1.5));
  });
});

describe("离线 events 封顶 40 不蒸发超额遭遇 · 非事即战闭合", () => {
  it("events 估超 40 封顶时,超额那半落成战斗,遭遇=事+战全数闭合", () => {
    setActivePinia(createPinia());
    // 2h 全程(默认离线上限≥2h→封顶不砍):历练按 0.9 挂机折扣(effSec),speed=1
    // → encounters = floor(7200×0.9/12) = 540
    seedSession("normal");
    const s = settleOffline(Date.now());
    // events 估 ≈ 540×0.16 = 86,只实际结算 40(封顶)
    expect(s!.events, "事件只实际结算 40 个封顶").toBe(40);
    // 非事即战:超额那 46 场(86→40)必须落成战斗,不许凭空蒸发 ——
    // 旧实现 battles 按「未封顶的 events」取差,events>40 时遭遇=事+战少了(544<600)
    expect(s!.battles + s!.events, "遭遇 = 事 + 战,全数闭合").toBe(540);
  });

  it("际遇写进会话的收益,不被离线收尾的旧会话覆盖", () => {
    setActivePinia(createPinia());
    seedSession("normal");
    const adventure = useAdventureStore();
    const resources = useResourcesStore();
    // 夜遇同道默认彻夜长谈,首项固定给 5 点悟道;rng mock 保证必走首项。
    adventure.setPendingEvent("ev_night_talk", useGameStore().lastActiveAt);
    const wudaoBefore = resources.wudao;

    settleOffline(Date.now())!;

    expect(resources.wudao, "预置的待决际遇应先真实结算").toBeGreaterThan(wudaoBefore);
    expect(
      adventure.session!.wudaoGain,
      "事件收益已写进当前会话;收尾若拿结算前的旧 session 展开就会把它覆盖成 0",
    ).toBeGreaterThanOrEqual(5);
  });
});

describe("离线整批结算的战后记账(连胜赏格 / 宿敌 / 雪耻)", () => {
  /**
   * 与在线同一本账的三族:在线逐场 recordWin/recordLoss(连胜 + 赏格)、
   * recordLoss(宿敌)、markAvenged(雪耻);离线整段结算此前整段漏记 ——
   * 挂一夜连胜纹丝不动、被打死几回不算宿敌、打赢了宿敌征战录仍写「尚为宿敌」。
   * 确定性基建同上(rng 恒真、胜率 mock 0.5):mock 后 battles>0、wins=round(battles×0.5)
   * → 既有胜场也有败场,三族记账都会走到。
   */
  it("离线连胜整批推进并发放跨档赏格;卷轴写明发了哪几档", () => {
    setActivePinia(createPinia());
    seedSession("normal");
    const player = usePlayerStore();
    player.initCharacter("挂机记账", { roots: [] } as never);
    player.winStreak = 2; // 挂机前已 2 连胜,这一批 wins 再接上就该跨过 3 与 5 两档
    const s = settleOffline(Date.now())!;
    expect(s).not.toBeNull();
    expect(player.winStreak, "败场存在 → 连胜收尾归零(与在线一败即止同一条)").toBe(0);
    // 数额到账走 recordWinStreakBatch 的专项用例(见下);这里守行为面:
    // 卷轴逐档写明赏格,别让玩家只看见数字凭空多了一截
    expect(s!.notes.join("\n")).toContain("连胜 3 场");
    expect(s!.notes.join("\n")).toContain("连胜 5 场");
    expect(s!.notes.join("\n")).toContain("悟道点 +1");
  });

  it("离线连胜赏格也并入会话账:灵石与悟道都不漏", () => {
    const run = (startStreak: number) => {
      setActivePinia(createPinia());
      seedSession("normal");
      const player = usePlayerStore();
      player.initCharacter("离线连胜对账", { roots: [] } as never);
      player.winStreak = startStreak;
      settleOffline(Date.now())!;
      return useAdventureStore().session!;
    };

    // 从 100 起不会再跨档;从 0 起这一段会跨 3/5/10,两档差应正是赏格合计。
    const noReward = run(100);
    const rewarded = run(0);
    expect(toNum(sub(rewarded.stoneGain, noReward.stoneGain)), "三档灵石合计 160").toBeCloseTo(
      160,
      6,
    );
    expect(rewarded.wudaoGain - noReward.wudaoGain, "三档悟道合计 8").toBe(8);
  });

  it("离线重复法宝折化的悟道也并入会话账", () => {
    const run = (alreadyOwned: boolean) => {
      setActivePinia(createPinia());
      seedSession("normal");
      const player = usePlayerStore();
      player.initCharacter("离线法宝对账", { roots: [] } as never);
      // 避开连胜赏格这条独立的悟道来源。
      player.winStreak = 100;
      if (alreadyOwned) useInventoryStore().addArtifact("af_muyu");
      const resources = useResourcesStore();
      const before = resources.wudao;
      settleOffline(Date.now())!;
      return {
        resourceGain: resources.wudao - before,
        sessionGain: useAdventureStore().session!.wudaoGain,
      };
    };

    const fresh = run(false);
    const duplicate = run(true);
    expect(duplicate.resourceGain - fresh.resourceGain, "只多一次重复折化,资源账应多 10 悟道").toBe(
      10,
    );
    expect(duplicate.sessionGain - fresh.sessionGain, "会话账也要多这 10 点,不能只在资源账里").toBe(
      10,
    );
  });

  it("离线历练照在线攒道侣机会点:只补记账,三维与待决事件原样", () => {
    setActivePinia(createPinia());
    seedSession("normal");
    const player = usePlayerStore();
    player.initCharacter("机会点记账", { roots: [] } as never);
    // 一段完整的在途关系:胜一回 + 败一回 → 机会点 +2;其余一概不动
    player.setBond({
      daoluId: "d_test",
      metAt: Date.now() - 1000,
      fallen: false,
      doneEvents: [],
      fate: 5,
      trust: 5,
      accord: 5,
      shared: 0,
      opportunities: 1,
      nextEventAt: 6,
      pendingEventId: null,
      intentPending: false,
      intent: null,
    } as unknown as Parameters<typeof player.setBond>[0]);
    settleOffline(Date.now())!;
    const b = player.bond!;
    expect(b.opportunities, "胜一回 + 败一回 → 机会点 +2").toBe(3);
    expect(b.fate, "缘分不该被离线推进").toBe(5);
    expect(b.trust, "信任同上").toBe(5);
    expect(b.accord, "契合同上").toBe(5);
    expect(b.pendingEventId, "不替玩家抽待决之事").toBeNull();
  });

  it("离线普通战补丹药与法宝掉落通道:期望为正、真入囊、不替玩家祭上", () => {
    setActivePinia(createPinia());
    seedSession("normal");
    const player = usePlayerStore();
    const inventory = useInventoryStore();
    player.initCharacter("掉落记账", { roots: [] } as never);
    const pillsBefore = Object.values(inventory.pills).reduce((a, b) => a + b, 0);
    const artsBefore = inventory.artifacts.length;
    const s = settleOffline(Date.now())!;
    expect(s!.wins, "确定性基建下必有胜场").toBeGreaterThan(0);
    // 丹药:PILL_DROP_CHANCE=0.08 × 倍率,wins 数百 → 期望件数必 >0 且真入了丹匣
    const pillsAfter = Object.values(inventory.pills).reduce((a, b) => a + b, 0);
    expect(pillsAfter, "丹药掉落通道整段缺席 → 期望恒 0;现在真入袋了").toBeGreaterThan(pillsBefore);
    // 法宝:0.015×wins 期望 >0;只入囊,祭炼位仍空(装配由玩家亲手)
    expect(
      inventory.artifacts.length,
      "法宝掉落通道同样缺席 → 现在按同一把幸运尺折算",
    ).toBeGreaterThan(artsBefore);
    expect(inventory.equippedArtifacts.length, "祭炼位不许被离线自动装上").toBe(0);
  });

  it("离线历练也记「独行」破题:祭着法宝打一夜,题须破、卷轴有交代", () => {
    setActivePinia(createPinia());
    seedSession("normal");
    const player = usePlayerStore();
    const inventory = useInventoryStore();
    player.initCharacter("破题记账", { roots: [] } as never);
    // 立下「独行」之誓(未破)+ 祭上一件法宝(先入囊再上祭炼位)
    player.setVow({
      themeId: "lt_zejian",
      at: Date.now() - 1000,
      base: {},
      baseBranches: 0,
      baseAvenged: 0,
      broken: false,
    });
    inventory.addArtifact("af_muyu");
    inventory.toggleArtifact(inventory.artifacts[0]!.defId, 2);
    expect(inventory.equippedArtifacts.length, "预置:法宝已祭上").toBe(1);
    settleOffline(Date.now())!;
    expect(player.reincarnation.vow?.broken, "祭着法宝出手一整夜 → 破题").toBe(true);
  });

  it("recordWinStreakBatch:只发这一批跨过的档;带败场收尾归零", () => {
    setActivePinia(createPinia());
    seedSession("normal");
    const player = usePlayerStore();
    const resources = useResourcesStore();
    player.initCharacter("赏格专项", { roots: [] } as never);
    player.winStreak = 2;
    const stoneBefore = toNum(resources.spiritStone);
    const wudaoBefore = resources.wudao;
    // 6 胜接上 → 跨 3 与 5 两档,发 20+40 石 / 1+2 悟道;2 败收尾归零
    const granted = recordWinStreakBatch(6, 2);
    expect(
      granted.map((g) => g.streak),
      "跨过的档逐一点名",
    ).toEqual([3, 5]);
    expect(toNum(resources.spiritStone) - stoneBefore, "两档灵石合计 60").toBe(60);
    expect(resources.wudao - wudaoBefore, "两档悟道合计 3").toBe(3);
    expect(player.winStreak, "带败场 → 归零").toBe(0);
    // 已发过的档不重发:再接 4 胜(0→4),只该补第 3?不 —— 归零后再从 0 数,跨 3 一档
    const granted2 = recordWinStreakBatch(4, 0);
    expect(
      granted2.map((g) => g.streak),
      "归零后重数,只跨 3",
    ).toEqual([3]);
    expect(player.winStreak, "无败场 → 保留 4").toBe(4);
    // 顶档之上不再有赏格
    player.winStreak = 10;
    const granted3 = recordWinStreakBatch(5, 0);
    expect(granted3, "10 档之后没有更多赏格").toEqual([]);
    expect(player.winStreak).toBe(15);
  });

  it("离线败场整批记宿敌:败绩合计与本趟败场同源", () => {
    setActivePinia(createPinia());
    seedSession("normal");
    const player = usePlayerStore();
    player.initCharacter("挂机记账", { roots: [] } as never);
    const s = settleOffline(Date.now())!;
    const losses = s!.battles - s!.wins;
    expect(losses, "确定性基建下本趟必有败场(胜率 0.5)").toBeGreaterThan(0);
    // 本段败场整批记进宿敌账:lossCount = 本段败场(rng 恒 pick 首项 → 恒同一敌)
    const rec = player.nemeses[0];
    expect(rec, "宿敌账有入账").not.toBeUndefined();
    expect(rec!.lossCount, "败绩合计 = 本段败场").toBe(losses);
    expect(rec!.enemyName.length, "记的是名号,不是空壳").toBeGreaterThan(0);
  });

  it("离线打赢仍在账上的宿敌:markAvenged 清账,卷轴报雪耻", () => {
    setActivePinia(createPinia());
    seedSession("normal");
    const player = usePlayerStore();
    player.initCharacter("雪耻记账", { roots: [] } as never);
    // 预置:这一敌已在账上败了三次(宿敌成账、未雪耻)
    player.setNemeses([
      {
        enemyId: "e_wolf",
        enemyName: "赤目野狼",
        regionId: "qingyun",
        lossCount: 3,
        lastLossAt: Date.now() - 1000,
      },
    ]);
    const s = settleOffline(Date.now())!;
    expect(s!.wins, "确定性基建下本趟必有胜场").toBeGreaterThan(0);
    const rec = player.nemeses.find((n) => n.enemyId === "e_wolf");
    // rng 恒 pick 首项 → 本段战的就是这只;净胜为正即等于在它手下赢过 → 清账
    expect(rec?.avengedAt, "雪耻落值").toBeGreaterThan(0);
    expect(s!.notes.join("\n"), "卷轴要报雪耻,别让征战录永远写着尚为宿敌").toContain("【雪耻】");
  });
});

describe("离线普通战 · 本世资源偏向也要进账", () => {
  /*
   * 上一版只把偏向接进了 afterWin,而离线只有首领战走 afterWin —— 占大头的普通战
   * 是按期望整段结算的,一条都没乘。结果「矿脉深厚」在离线只对首领生效,卷轴却
   * 写着「离线已计入」。这组用例正是那条不一致的回归。
   */
  it("灵石充盈:灵石约 +15%,灵草一分不动", () => {
    const plain = runWithBias(undefined);
    const stoneBias = runWithBias("灵石充盈");
    expect(plain.stone, "先得真有产出,否则判据空转").toBeGreaterThan(0);
    const ratio = stoneBias.stone / plain.stone;
    /*
     * 不能断言 ≈1.15:这段灵石增量里混着**非战斗产线**(实测历大约占四成),
     * 战斗那份的 +15% 被摊薄成 +6%。判据只问两件事:偏向生效了(> 1.04)、
     * 且没有重复乘(< 1.2)—— 缺了乘区就是 1.000,乘两遍会到 1.2 以上。
     */
    expect(ratio, `实得 ${ratio.toFixed(3)} —— 偏向没进离线普通战?`).toBeGreaterThan(1.04);
    expect(ratio, `实得 ${ratio.toFixed(3)} —— 像是乘了两遍`).toBeLessThan(1.2);
    expect(stoneBias.herb, "灵石偏向不该动灵草").toBe(plain.herb);
  });

  it("草木丰饶:灵草变多,灵石不变 —— 偏向只放大自己那条渠道", () => {
    const plain = runWithBias(undefined);
    const herbBias = runWithBias("草木丰饶");
    expect(herbBias.herb).toBeGreaterThan(plain.herb);
    expect(herbBias.stone).toBe(plain.stone);
  });
});
