/* oxlint-disable no-console -- 秘境是过程性验收,打印层间推进 */
/**
 * 短期秘境验收(Phase 34.9)
 *
 * Phase 31 留下了骨架:状态与目录都在,却没有任何入口 —— 玩家进不去,
 * player.secretRealm 永远是 null,而轮回清单还交代着它的去留(与奇遇连锁同一种病)。
 *
 * 本轮把玩法接上,故这里钉四件事:
 *   一 进得去:门槛、代价、一次性(已在秘境中不许再进);
 *   二 规则是真的:随机规则与秘境自带规则必须落到既有 CombatRules 上,不是纯文本;
 *   三 推得动:三层递进,层间按本境规则回血/损血;败两次被逐出;
 *   四 出得来:通关给宝藏并清空状态;放弃也清空,但已得战利不退。
 */
import { describe, expect, it, beforeEach } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { gn, toNum } from "@/utils/gnum";
import { mulberry32, RandomService } from "@/utils/random";
import { SECRET_REALMS, SECRET_RULES } from "@/data/secretRealms";
import { usePlayerStore } from "@/stores/player";
import { useResourcesStore } from "@/stores/resources";
import { useEndgameStore } from "@/stores/endgame";
import {
  SECRET_LAYERS,
  SECRET_MAX_LOSSES,
  abandonRealm,
  availableRealms,
  currentRealm,
  enterSecretRealm,
  entryCostOf,
  entryCostText,
  fightSecretLayer,
  realmUnlock,
  secretFightRules,
  secretLayerFoe,
  secretLayerPreview,
  secretLayerReward,
  tierOfMajor,
} from "./secretRealm";

beforeEach(() => {
  setActivePinia(createPinia());
});

/** 备好一个够格又有钱的玩家 */
function ready(major = 3): void {
  usePlayerStore().major = major;
  useResourcesStore().addStone(gn(1_000_000_000));
}

describe("秘境 · 进得去", () => {
  it("元婴(≥3)起有秘境可探,金丹之前没有", () => {
    const player = usePlayerStore();
    player.major = 2;
    expect(realmUnlock()).toBe(false);
    expect(availableRealms()).toEqual([]);
    player.major = 3;
    expect(realmUnlock()).toBe(true);
    expect(availableRealms().length).toBeGreaterThanOrEqual(2);
  });

  it("进入要付灵石;付不出则拒绝且不落状态", () => {
    const resources = useResourcesStore();
    usePlayerStore().major = 3;
    const def = SECRET_REALMS[0]!;
    expect(enterSecretRealm(def.id).ok).toBe(false);
    expect(currentRealm()).toBeNull();

    resources.addStone(
      (entryCostOf(def, 3) as { kind: "stone"; stone: ReturnType<typeof gn> }).stone,
    );
    const before = resources.spiritStone.m;
    expect(enterSecretRealm(def.id).ok).toBe(true);
    expect(currentRealm()?.realmId).toBe(def.id);
    expect(resources.spiritStone.m).toBeLessThan(before);
  });

  it("秘境是一次性的:已在其中不许再进;门槛不够的进不去", () => {
    ready(3);
    expect(enterSecretRealm("sr_kurong").ok).toBe(true);
    expect(enterSecretRealm("sr_kurong").ok).toBe(false);
    abandonRealm();
    expect(enterSecretRealm("sr_kuye").ok).toBe(false); // 门槛 4
    expect(enterSecretRealm("nope").ok).toBe(false);
  });

  it("入口代价按地界层级折算 —— 高境界不是只贵一点", () => {
    const def = SECRET_REALMS[0]!;
    expect(tierOfMajor(3)).toBeGreaterThan(0);
    expect((entryCostOf(def, 9) as { stone: { m: number } }).stone.m).toBeGreaterThan(
      (entryCostOf(def, 3) as { stone: { m: number } }).stone.m,
    );
  });
});

describe("秘境 · 规则是真的", () => {
  it("规则池里每条都能落到既有的战斗规则上(不是纯文本)", () => {
    expect(SECRET_RULES.length).toBeGreaterThanOrEqual(5);
    for (const r of SECRET_RULES) {
      expect(r.text.length).toBeGreaterThan(1);
      expect(Object.keys(r.rules).length, `${r.text} 没有任何可生效的规则`).toBeGreaterThan(0);
    }
  });

  it("进入时掷 1~2 条随机规则,不重复", () => {
    for (let i = 0; i < 20; i += 1) {
      setActivePinia(createPinia());
      ready(3);
      enterSecretRealm("sr_kurong");
      const st = currentRealm()!;
      expect(st.rules.length).toBeGreaterThanOrEqual(1);
      expect(st.rules.length).toBeLessThanOrEqual(2);
      expect(new Set(st.rules).size).toBe(st.rules.length);
      for (const text of st.rules) expect(SECRET_RULES.some((r) => r.text === text)).toBe(true);
    }
  });

  it("本境规则与随机规则都并进战斗(逐条隔离验证,不吃随机掷的运气)", () => {
    // 用固定状态逐条验:随机规则是掷出来的,拿真实一跳去断言会时红时绿
    const base = {
      realmId: "sr_kurong",
      enteredAt: 0,
      layer: 1,
      wins: 0,
      losses: 0,
      spoils: [],
      rules: [] as string[],
      carriedHpPct: 1,
      finished: false,
    };
    // 枯荣古境自带:治疗 ×2
    expect(secretFightRules(base).healMult).toBe(2);
    // 随机规则并入:回合上限
    expect(secretFightRules({ ...base, rules: ["回合上限 20"] }).maxRounds).toBe(20);
    // 两条规则叠乘(合并是乘区,不是覆盖):×2 与「治疗减半」相遇即回落到 ×1
    expect(secretFightRules({ ...base, rules: ["治疗减半"] }).healMult).toBe(1);
    // 层数递进:第三层比第一层更凶
    const l1 = secretFightRules(base, 1);
    const l3 = secretFightRules(base, SECRET_LAYERS);
    expect(l3.enemyAtkMult!).toBeGreaterThan(l1.enemyAtkMult!);
    expect(l3.enemyHpMult!).toBeGreaterThan(l1.enemyHpMult!);
  });
});

describe("秘境 · 推得动、出得来", () => {
  it("一直打到结束:状态必被清空,且结算次数有限", () => {
    ready(3);
    enterSecretRealm("sr_kurong");
    let guard = 0;
    let cleared = false;
    while (currentRealm() && guard < 20) {
      const r = fightSecretLayer();
      expect(r).not.toBeNull();
      if (r!.cleared) cleared = true;
      guard += 1;
    }
    expect(guard).toBeLessThan(20);
    expect(currentRealm()).toBeNull();
    console.log(`\n秘境 ${cleared ? "通关" : "被逐出"} · 共 ${guard} 次结算`);
  });

  it("层间按本境规则变法:枯荣古境每层之末损血", () => {
    ready(3);
    enterSecretRealm("sr_kurong");
    expect(currentRealm()!.carriedHpPct).toBe(1);
    fightSecretLayer();
    const st = currentRealm();
    if (st) {
      expect(st.carriedHpPct).toBeLessThan(1);
      expect(st.carriedHpPct).toBeGreaterThan(0);
    }
  });

  it("败满两次被逐出,状态清空", () => {
    ready(3);
    enterSecretRealm("sr_kurong");
    const st = currentRealm()!;
    usePlayerStore().setSecretRealm({ ...st, carriedHpPct: 0.05 });
    let results = 0;
    while (currentRealm() && results < 10) {
      fightSecretLayer();
      results += 1;
    }
    expect(currentRealm()).toBeNull();
    expect(SECRET_MAX_LOSSES).toBe(2);
  });

  it("放弃即出,状态清空(已得战利不退)", () => {
    ready(3);
    enterSecretRealm("sr_kurong");
    abandonRealm();
    expect(currentRealm()).toBeNull();
  });

  it("坏档修形:层数/气血/规则越界都夹回来,认不得的秘境直接作废", () => {
    const player = usePlayerStore();
    // 层数 99(否则一路「通关」)、气血 5(战斗开局算成 NaN)、规则里混进不存在的一条
    player.setSecretRealm({
      realmId: "sr_kurong",
      enteredAt: -1,
      layer: 99,
      wins: -3,
      losses: 9,
      spoils: ["旧的一行", 42 as never],
      rules: ["治疗减半", "不存在的规则"],
      carriedHpPct: 5,
      finished: "yes" as never,
    } as never);
    player.sanitize();
    const fixed = currentRealm()!;
    expect(fixed.layer).toBe(SECRET_LAYERS);
    expect(fixed.carriedHpPct).toBe(1);
    expect(fixed.losses).toBe(SECRET_MAX_LOSSES);
    expect(fixed.wins).toBe(0);
    expect(fixed.rules).toEqual(["治疗减半"]);
    expect(fixed.spoils).toEqual(["旧的一行"]);
    expect(fixed.finished).toBe(false);
    expect(fixed.enteredAt).toBeGreaterThanOrEqual(0);

    // 认不得的秘境 id → 直接作废,免得留一份永远结算不完的状态
    player.setSecretRealm({ ...fixed, realmId: "sr_nope" } as never);
    player.sanitize();
    expect(currentRealm()).toBeNull();
  });

  it("秘境有非 spec 的入口 —— 骨架之所以叫骨架,就是因为没人接它", () => {
    // 这条正是本轮之前缺的那一环:core 里一切齐备,却没有一处 UI 调它
    const files = [
      resolve(__dirname, "../components/adventure/SecretRealmCard.vue"),
      resolve(__dirname, "../views/AdventureView.vue"),
    ];
    const corpus = files
      .map((f) => readFileSync(f, "utf8"))
      .join("\n")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(corpus).toContain("enterSecretRealm(");
    expect(corpus).toContain("fightSecretLayer(");
    expect(corpus).toContain("abandonRealm(");
  });
});

describe("秘境 · 两阶(凡境灵石 / 天界道源)", () => {
  it("凡境册真仙前就有,天界册要真仙(≥9)", () => {
    const player = usePlayerStore();
    player.major = 3;
    expect(realmUnlock("mortal")).toBe(true);
    expect(realmUnlock("celestial")).toBe(false);
    expect(availableRealms("celestial")).toEqual([]);
    player.major = 9;
    expect(realmUnlock("celestial")).toBe(true);
    expect(availableRealms("celestial").length).toBeGreaterThanOrEqual(2);
    // 两册互不串门
    expect(availableRealms("mortal").every((r) => r.gate === "mortal")).toBe(true);
    expect(availableRealms("celestial").every((r) => r.gate === "celestial")).toBe(true);
  });

  it("天界秘境付的是道源:够则扣,不够则拒绝", () => {
    const player = usePlayerStore();
    const endgame = useEndgameStore();
    player.major = 9;
    const def = availableRealms("celestial")[0]!;
    expect(enterSecretRealm(def.id).ok).toBe(false);
    expect(currentRealm()).toBeNull();

    endgame.addDaoSource(100);
    const before = endgame.daoSource;
    expect(enterSecretRealm(def.id).ok).toBe(true);
    const cost = entryCostOf(def, 9) as { kind: "daoSource"; daoSource: number };
    expect(endgame.daoSource).toBe(before - cost.daoSource);
  });

  it("代价文案与货币一致(界面上不手写)", () => {
    const mortal = SECRET_REALMS.find((r) => r.gate === "mortal")!;
    const celestial = SECRET_REALMS.find((r) => r.gate === "celestial")!;
    expect(entryCostText(mortal, 9)).toContain("灵石");
    expect(entryCostText(celestial, 9)).toContain("道源");
  });
});

describe("秘境 · 敌人按玩家缩放(与远征/试炼同法)", () => {
  /**
   * 副本敌若按层级绝对值生成,一个刚飞升、尚未换装的真仙会撞上 tier 21 的绝对数值 ——
   * 付了道源,两场被逐出。故这里钉「玩家相对」口径:敌我力量比值由敌人自身倍率决定,
   * 不随境界陡增(同一名裸装玩家,真仙与神人两处秘境应当同量级)。
   */
  const state = {
    realmId: "sr_xingchen",
    enteredAt: 0,
    layer: 1,
    wins: 0,
    losses: 0,
    spoils: [],
    rules: [],
    carriedHpPct: 1,
    finished: false,
  };

  it("敌我比值由敌人倍率决定,不随境界陡增", () => {
    const player = usePlayerStore();
    const ratioAt = (major: number): number => {
      player.major = major;
      const foe = secretLayerFoe(state);
      return toNum(foe.snap.attack) / toNum(player.finalStats.attack);
    };
    const r9 = ratioAt(9);
    const r14 = ratioAt(14);
    expect(Number.isFinite(r9) && Number.isFinite(r14)).toBe(true);
    expect(r9).toBeGreaterThan(0);
    expect(
      Math.max(r9, r14) / Math.min(r9, r14),
      "两界敌我比值量级不同 —— 敌人还在按层级绝对值生成",
    ).toBeLessThan(3);
  });

  it("敌人倍率有上界:裸装玩家吃力是设计,但不该出现「绝对数值墙」", () => {
    // 裸装(无装备无功法)去打秘境本就该吃亏;这里钉的是"吃亏有上限":
    // 敌人攻击不超过玩家的 5 倍,且结算文案始终有效 —— 而不是按层级绝对值碾压。
    // 快照只按玩家缩放、不随层叠加(层级凶险在 secretFightRules),故直接传 state。
    const player = usePlayerStore();
    for (const major of [3, 9, 14, 20]) {
      player.major = major;
      const foe = secretLayerFoe(state);
      const ratio = toNum(foe.snap.attack) / toNum(player.finalStats.attack);
      expect(ratio, `major ${major} 的秘境敌人攻击是玩家的 ${ratio.toFixed(1)} 倍`).toBeLessThan(5);
      expect(Number.isFinite(toNum(foe.snap.maxHp))).toBe(true);
    }
    // 真打一场也要有可读结果(不崩、不空)
    player.major = 9;
    ready(9);
    useEndgameStore().addDaoSource(100); // 天界秘境付的是道源
    expect(enterSecretRealm("sr_xingchen").ok).toBe(true);
    const r = fightSecretLayer();
    expect(r).not.toBeNull();
    expect(r!.lines.length).toBeGreaterThan(0);
    for (const line of r!.lines) expect(line).not.toContain("NaN");
  });

  it("层级递进的凶险只在规则里:敌人快照不随层叠乘", () => {
    // 回归(曾双重加码):secretLayerFoe 把 1+0.12×(层-1) 烘焙进快照,
    // secretFightRules 又在规则里给 enemyHpMult,resolveCombat 叠乘 —— 第 2 层
    // 起 HP 每层 ×1.25。钉死:快照与层无关,层梯子只在 secretFightRules 一处。
    const player = usePlayerStore();
    player.major = 9;
    // 同一颗种子抽同一个敌人,才能比「同一敌人」跨层的快照;否则随机选敌让对照失真
    const l1 = secretLayerFoe({ ...state, layer: 1 }, new RandomService(mulberry32(7)));
    const lmax = secretLayerFoe(
      { ...state, layer: SECRET_LAYERS },
      new RandomService(mulberry32(7)),
    );
    expect(toNum(lmax.snap.maxHp)).toBe(toNum(l1.snap.maxHp));
    expect(toNum(lmax.snap.attack)).toBe(toNum(l1.snap.attack));
    expect(secretFightRules({ ...state, layer: SECRET_LAYERS }).enemyHpMult!).toBeGreaterThan(
      secretFightRules({ ...state, layer: 1 }).enemyHpMult ?? 0,
    );
  });
});

describe("秘境 · 战利倍率算得出对", () => {
  it("同一层级同一层数下,灵石战利与本境倍率成正比", () => {
    const a = secretLayerReward(10, 1, 1.2);
    const b = secretLayerReward(10, 1, 1.5);
    expect(toNum(b.stone) / toNum(a.stone)).toBeCloseTo(1.5 / 1.2, 6);
  });

  it("层数越深灵石越厚,材料只随层数(不吃倍率,免得几条产线被拉平)", () => {
    const l1 = secretLayerReward(10, 1, 1.4);
    const l3 = secretLayerReward(10, 3, 1.4);
    expect(toNum(l3.stone)).toBeGreaterThan(toNum(l1.stone));
    expect(l1.material).toBe(3);
    expect(l3.material).toBe(5);
    // 材料与倍率无关:同一层数下换倍率,材料数不变
    expect(secretLayerReward(10, 2, 9).material).toBe(secretLayerReward(10, 2, 0.1).material);
  });

  it("层级单调:同层同倍率下,高一层的战利必然更厚", () => {
    // 注意这里不写「高一层的第一层 > 低一层的第三层」——那是我一开始想当然的判据,
    // 实测 11 层×1.2 倍(1.59万)< 10 层×1.5 倍第 3 层(1.74万)。
    // 深层的厚赏压过上一层的薄层是**设计允许**的(奖励深度),故只钉单调性。
    for (let tier = 3; tier < 30; tier += 1) {
      expect(toNum(secretLayerReward(tier + 1, 2, 1.2).stone)).toBeGreaterThan(
        toNum(secretLayerReward(tier, 2, 1.2).stone),
      );
    }
  });
});

describe("秘境 · 战前预览与实战同源", () => {
  const BANDS = ["胜算在握", "约有七成胜算", "五五之数,凶险参半", "凶多吉少"];

  it("进境即掷定本层敌人落档,预览与实战读同一份;战利与层数/倍率同源", () => {
    ready(3);
    expect(enterSecretRealm("sr_kurong").ok).toBe(true);
    const st = currentRealm()!;
    expect(st.foe, "进境应已掷定本层敌人").toBeDefined();
    const pv = secretLayerPreview(st);
    // 预览==实战:敌人就是已落档的那一份,不重掷
    expect(pv.foe).toEqual(st.foe);
    expect(BANDS).toContain(pv.winText);
    // 战利与 secretLayerReward 同源:灵石随层数与本境倍率,材料只随层数
    const def = SECRET_REALMS.find((r) => r.id === "sr_kurong")!;
    expect(pv.reward).toEqual(secretLayerReward(tierOfMajor(3), st.layer, def.rewardMult));
  });

  it("再入一层后,新一轮预览敌人已随层落档(仍是同一份,不重掷)", () => {
    ready(3);
    enterSecretRealm("sr_kurong");
    let guard = 0;
    while (currentRealm() && guard < 5) {
      const st = currentRealm()!;
      expect(st.foe, "每一层都应已掷定敌人").toBeDefined();
      expect(secretLayerPreview(st).foe, "预览(再入前)与已落档敌人同一份").toEqual(st.foe);
      fightSecretLayer();
      guard += 1;
    }
  });

  it("旧档缺 foe:战时兜底现掷,预览给莫测占位而非崩", () => {
    ready(3);
    const player = usePlayerStore();
    player.setSecretRealm({
      realmId: "sr_kurong",
      enteredAt: 0,
      layer: 1,
      wins: 0,
      losses: 0,
      spoils: [],
      rules: [],
      carriedHpPct: 1,
      finished: false,
      // 无 foe —— 模拟旧档
    } as never);
    const st = currentRealm()!;
    expect(st.foe).toBeUndefined();
    expect(secretLayerPreview(st).foe).toBeNull();
    expect(secretLayerPreview(st).winText).toBe("莫测");
    // 战时不崩:兜底现掷出一个可读敌人
    const r = fightSecretLayer();
    expect(r).not.toBeNull();
    expect(r!.lines.length).toBeGreaterThan(0);
    for (const line of r!.lines) expect(line).not.toContain("NaN");
  });
});
