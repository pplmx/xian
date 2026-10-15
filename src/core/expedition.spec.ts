/* oxlint-disable no-console -- 梯子表是给人看的 */
/**
 * 远征 · 端到端(终局的核心功能,此前只有零散判据碰过它)
 *
 * 这里走**真实路径**:花钱 → 开一趟 → 择路 → 打界主 → 结算,中间不绕开 store。
 * 盯三件事:
 *   一 **账目**:出发扣的道源,正是这一界写着的入界价;
 *   二 **梯子**:四重天界按锚点层级排成阶梯 —— 该境界的人打得动,
 *      差一大截的人打不动,高一境的人压着打(实测过锚点标定,见 celestialCaliber.spec);
 *   三 **判定看得见**:道之理解与境界压制的文案,战前预估与战报读同一份。
 */
import { describe, expect, it, beforeEach } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { usePlayerStore } from "@/stores/player";
import { useInventoryStore } from "@/stores/inventory";
import { useEndgameStore } from "@/stores/endgame";
import { CELESTIAL_WORLDS } from "@/data/endgame";
import {
  forecastExpedition,
  startWorldExpedition,
  chooseRouteNode,
  challengeGuardian,
  challengeMutation,
  expeditionForecastFoes,
  sealCoreMods,
} from "./expedition";
import { detectBuild } from "./buildDetect";
import { celestialJudgementLines } from "./gauntlet";
import type { EquipSlot, EquipmentInstance } from "@/types";

const SLOTS: EquipSlot[] = [
  "weapon",
  "head",
  "body",
  "wrist",
  "belt",
  "boots",
  "necklace",
  "ring",
  "talisman",
];
/** 人间界顶配那一身(飞升时能带走的最好家当) */
const MORTAL_TOP = [
  "w_jiujie",
  "h_zichen",
  "b_taiqing",
  "wr_jieyun",
  "bl_yunlei",
  "bo_lingxu",
  "n_jiuzhuan",
  "r_ziyuan",
  "tl_yulei",
];
/** 混沌海那一身 */
const CHAOS_TOP = [
  "w_benyuan",
  "h_benyuan",
  "b_benyuanshen",
  "wr_benyuan",
  "bl_benyuan",
  "bo_benyuan",
  "n_hongmengzhu",
  "r_daozu",
  "tl_daozuzhuan",
];

function seated(
  major: number,
  tpls: string[],
  quality: EquipmentInstance["quality"],
  tier: number,
): void {
  const player = usePlayerStore();
  player.initCharacter("远征自检", { roots: [{ element: "wood", aptitude: 90 }] } as never);
  player.major = major;
  player.sub = 9;
  const inv = useInventoryStore();
  inv.items = tpls.map((templateId, i): EquipmentInstance => ({
    uid: `x${i}`,
    templateId,
    quality,
    tier,
    level: 5,
    affixes: [
      { id: "atk4", roll: 0.8 },
      { id: "hp4", roll: 0.6 },
      { id: "def4", roll: 0.6 },
    ],
  }));
  inv.items.forEach((it, i) => inv.equip(it.uid, SLOTS[i]!));
  const endgame = useEndgameStore();
  endgame.daoPath = "sword";
  endgame.addDaoSource(5000);
}

const world = (id: string) => CELESTIAL_WORLDS.find((w) => w.id === id)!;

beforeEach(() => setActivePinia(createPinia()));

describe("远征 · 账目", () => {
  it("出发扣的道源,正是这一界写着的入界价", () => {
    seated(9, MORTAL_TOP, "heaven", 20);
    const eg = useEndgameStore();
    const before = eg.daoSource;
    const chiyan = world("chiyan");
    const outcome = startWorldExpedition(chiyan.id, null);
    expect(outcome, "这一界开不起来(门槛或道源)").not.toBeNull();
    expect(before - eg.daoSource, "扣的道源与入界价对不上").toBe(chiyan.entryCost);
    expect(eg.worldRun?.worldId, "上路了却没记在 store 里").toBe(chiyan.id);
  });

  it("道源不足时不开船,也不记账", () => {
    seated(9, MORTAL_TOP, "heaven", 20);
    const eg = useEndgameStore();
    eg.daoSource = 1; // 连一界都进不去
    expect(startWorldExpedition("chiyan", null)).toBeNull();
    expect(eg.worldRun).toBeNull();
    expect(eg.daoSource, "不开船还扣了道源").toBe(1);
  });
});

describe("远征 · 梯子(锚点定标:该境界的人才打得动)", () => {
  const rate = (
    major: number,
    tpls: string[],
    quality: EquipmentInstance["quality"],
    tier: number,
    worldId: string,
  ): number => {
    setActivePinia(createPinia());
    seated(major, tpls, quality, tier);
    const f = forecastExpedition(worldId, null)!;
    // 星级是分档的,直接换算回可比较的量:★ 越多越有把握
    return f.stars.split("").filter((c) => c === "★").length;
  };

  it("真仙带一身人间界顶配,赤炎天可打;到不了无相天", () => {
    const chiyan = rate(9, MORTAL_TOP, "heaven", 20, "chiyan");
    const wuxiang = rate(9, MORTAL_TOP, "heaven", 20, "wuxiang");
    console.log(`\n真仙:赤炎天 ${"★".repeat(chiyan)} · 无相天 ${"★".repeat(wuxiang)}`);
    expect(chiyan, "真仙打不动赤炎天 —— 第一重天界就没人能进").toBeGreaterThanOrEqual(3);
    expect(wuxiang, "真仙也能闯无相天 —— 阶梯不存在了").toBeLessThan(chiyan);
  });

  it("混沌道祖带一身混沌海顶配,无相天可打", () => {
    const wuxiang = rate(20, CHAOS_TOP, "divine", 32, "wuxiang");
    console.log(`混沌道祖:无相天 ${"★".repeat(wuxiang)}`);
    expect(wuxiang, "走到阶梯尽头却打不动最后一界").toBeGreaterThanOrEqual(3);
  });

  it("同一境界下,装备越好越有把握(基础三维作数)", () => {
    /**
     * 选一对**没有两端饱和**的:真仙打赤炎天(锚在玄仙,本就是压着打),
     * 裸装够呛、披挂能打。若拿道祖打无相天来比,两边都是五星(顶格),
     * 这条判据就量不出东西了 —— 不是属性不作数,是刻度用完了。
     */
    const bare = rate(9, [], "heaven", 20, "chiyan");
    const geared = rate(9, MORTAL_TOP, "heaven", 20, "chiyan");
    console.log(
      `真仙打赤炎天:裸装 ${"★".repeat(bare) || "无"} → 一身人间界顶配 ${"★".repeat(geared)}`,
    );
    expect(geared, "换了更好的装备,胜算却没变 —— 基础属性又不作数了").toBeGreaterThan(bare);
  });
});

describe("远征 · 判定看得见", () => {
  it("战前预估给出道之理解与境界压制,且与判定函数同源", () => {
    seated(9, MORTAL_TOP, "heaven", 20);
    const chiyan = world("chiyan");
    const f = forecastExpedition(chiyan.id, null)!;
    const player = usePlayerStore();
    expect(f.judgementLines, "预估里没有判定文案").toEqual(
      celestialJudgementLines(player.celestialStats.mods, player.major, chiyan.anchorTier),
    );
    // 真仙去打锚在高一境的界,该有境界压制那一句
    expect(f.judgementLines.join("\n"), "低于锚点境界却没提境界压制").toContain("境界压制");
  });

  it("打得过的一次不该有判定文案(没有判定就不占字数)", () => {
    seated(20, CHAOS_TOP, "divine", 32);
    const chiyan = world("chiyan");
    const f = forecastExpedition(chiyan.id, null)!;
    expect(f.judgementLines, "道祖打第一重天界还被判定").toEqual([]);
  });

  it("打完一趟,战报带上这一界的判定", () => {
    seated(9, MORTAL_TOP, "heaven", 20);
    const chiyan = world("chiyan");
    // 一路打到终局:入界 → 三层 → 界主(中途败了也算终局)
    let outcome = startWorldExpedition(chiyan.id, null);
    let guard = 0;
    while (outcome && outcome.type === "advance" && guard < 12) {
      guard += 1;
      const run = useEndgameStore().worldRun;
      if (!run) break;
      outcome = run.layer >= 3 ? challengeGuardian() : chooseRouteNode(0);
    }
    expect(outcome, "这趟没走到终局也没败 —— 判据失去对象").not.toBeNull();
    expect(outcome!.type).not.toBe("advance");
    const player = usePlayerStore();
    expect(outcome!.judgementLines, "战报没交代这一战的判定").toEqual(
      celestialJudgementLines(player.celestialStats.mods, player.major, chiyan.anchorTier),
    );
  });
});

describe("远征 · 预估敌源与实战同构", () => {
  it("整程预估的敌序取自路线节点怪,而非世界入口的 world.foes", () => {
    const chiyan = world("chiyan");
    const shapes = expeditionForecastFoes(chiyan);
    // 1 进场 + 每条路线首个节点怪 + 1 门神 = 1+3+1 = 5 场
    expect(shapes.map((s) => s.name)).toEqual([
      "赤炎狱卒", // 进场 world.foes[0]
      "狱火统领", // 路线 0 节点 0
      "焚天巨魔", // 路线 1 节点 0
      "天火使者", // 路线 2 节点 0
      "赤炎天主", // 界主
    ]);
    // 第 2~4 场各来自各自路线的首个节点怪(不是把入口怪循环充数)
    expect(shapes[1]!.name).toBe(chiyan.routes[0]![0]!.foe.name);
    expect(shapes[2]!.name).toBe(chiyan.routes[1]![0]!.foe.name);
    expect(shapes[3]!.name).toBe(chiyan.routes[2]![0]!.foe.name);
    // 至少有一段路线的节点怪与入口怪不同名 —— 只要预估误取了入口怪,这里就会露馅
    const entryNames = new Set(chiyan.foes.map((f) => f.name));
    expect(chiyan.routes.some((r) => !entryNames.has(r[0].foe.name))).toBe(true);
  });

  it("玩家星级预估与可行流派共用同一份敌源(口径一致)", () => {
    const chiyan = world("chiyan");
    const shapes = expeditionForecastFoes(chiyan);
    // 旧实现 `world.foes[i % len]` 会把入口怪循环进第 2~4 场 —— 守卫钉住:那些场
    // 必须是各自的路线节点怪,不是入口怪重复
    expect(shapes[1]!.name).toBe(chiyan.routes[0]![0]!.foe.name);
    expect(shapes[3]!.name).toBe(chiyan.routes[2]![0]!.foe.name);
  });
});

describe("远征 · 逆命契封印摊开", () => {
  it("逆命契把当前主流派的核心词条转成负向快照(签前能摊开具体封印了谁)", () => {
    setActivePinia(createPinia());
    const player = usePlayerStore();
    player.initCharacter("逆命契自检", { roots: [{ element: "wood", aptitude: 90 }] } as never);
    player.major = 20;
    player.sub = 9;
    const inv = useInventoryStore();
    inv.items = CHAOS_TOP.map((templateId, i): EquipmentInstance => ({
      uid: `x${i}`,
      templateId,
      quality: "divine",
      tier: 32,
      level: 5,
      // shd2 罡罩(shieldOnStart)+ gs2 盾魂(shieldPower):罡盾流的一套确定性勾出
      affixes: [
        { id: "shd2", roll: 1 },
        { id: "gs2", roll: 1 },
      ],
    }));
    inv.items.forEach((it, i) => inv.equip(it.uid, SLOTS[i]!));
    useEndgameStore().daoPath = "sword";
    const build = detectBuild(player.celestialStats.mods)!;
    expect(build.style.id).toBe("gangdun");
    const sealed = sealCoreMods()!;
    expect(sealed, "主流派成形时逆命契不该没有可封印的词条").not.toBeNull();
    // 封印的正是当前流派的核心 stat,且恒为负向(归零成负模快照)
    for (const key of Object.keys(build.style.core)) {
      const cur = player.celestialStats.mods[key as keyof typeof player.celestialStats.mods] ?? 0;
      expect(sealed[key as keyof typeof sealed], `核心词条 ${key} 应被封印为负`).toBe(-cur);
    }
    // 至少封印了一个核心词条 —— 若 detectBuild 认得流派却空手而归,弹窗就摊不出东西
    expect(Object.keys(sealed).length).toBeGreaterThan(0);
  });

  it("没有主流派时逆命契无可封印(不误导玩家有空头封印)", () => {
    seated(9, [], "heaven", 20); // 裸装不成流派
    expect(sealCoreMods()).toBeNull();
  });
});

describe("远征 · 天道变数", () => {
  it("规则池里查不到的变数拒绝应战,且不扣道源(静默少一条规则是难度欺诈)", () => {
    seated(9, MORTAL_TOP, "heaven", 20);
    const eg = useEndgameStore();
    const before = eg.daoSource;
    expect(challengeMutation(["no_such_mutator"]), "未知变数应弹回让玩家重窥探").toBeNull();
    expect(eg.daoSource, "拒绝应战却扣了道源").toBe(before);
  });
});
