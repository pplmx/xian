/**
 * 自动回收 —— 装备入包前的第一道闸(Phase 26.2)
 * 应有之物(O):无论在线(战斗掉落/事件/镇压)还是离线(挂机结算),
 * 一切装备在进入行囊前都要先过一遍回收裁决;
 * 命中回收规则(分解勾选档 / 智能收纳判无缘)的,不入包、直接化尘。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { rng } from "@/utils/random";
import {
  expectedMaterialsPerBattle,
  expectedEquipmentBattlesPerPiece,
  expectedPillBattlesPerPiece,
  afterWin,
  acquireEquipment,
  ARTIFACT_NEAR_BONUS,
  ARTIFACT_NEAR_WINDOW,
  artifactDropWeight,
  randomDropArtifact,
} from "./loot";
import { planEquipmentUpgradeAll, upgradeEquipment, upgradeEquipmentAll } from "./forge";
import { ARTIFACTS, artifactDef, artifactValue } from "@/data/artifacts";
import type { ArtifactDef, StatMods } from "@/types";
import { regionDef } from "@/data/regions";
import { usePlayerStore } from "@/stores/player";
import { shouldAutoRecycle } from "./smartKeep";
import { useInventoryStore } from "@/stores/inventory";
import { useResourcesStore } from "@/stores/resources";
import { useSettingsStore } from "@/stores/settings";
import { qualityDef } from "@/data/qualities";
import { useUiStore } from "@/stores/ui";
import { upgradeCost } from "./formulas";
import { ARTIFACT_DROP_CHANCE, BAG_CAPACITY, DECOMPOSE_DUST } from "@/data/constants";
import { useLoreStore } from "@/stores/lore";
import { useQuestsStore } from "@/stores/quests";
import { gn, toNum } from "@/utils/gnum";
import type { EquipmentInstance, QualityId } from "@/types";

describe("自动回收 · 装备入包前的第一道闸", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  // 一件好判的凡俗道袍:不带套、无词条 —— 判定只看品质。
  // (此前用 generateEquipment 随手生成的件:模板可能成套、词条可能条条近满,
  //  于是「这件算不算垃圾」被随机模板搅浑,判据不再只测它想测的那条规则。)
  let seq = 0;
  function mk(quality: QualityId): EquipmentInstance {
    seq += 1;
    return { uid: `u${seq}`, templateId: "b_qingyun", quality, tier: 3, level: 0, affixes: [] };
  }

  function bagUids(): string[] {
    return useInventoryStore().items.map((it) => it.uid);
  }

  // ISS-030:rng.chance 不钳制(rand()<p),法宝 ×6×luck / doubleDropRate 等倍率堆叠
  // 一旦把 p 堆出 (0,1) 就会变成"必然掉落"或"永不掉落"。此不变量兜住任何未来平衡数据。
  it("ISS-030:afterWin 里每个概率输入都钳在 [0,1] 内", () => {
    const player = usePlayerStore();
    player.initCharacter("概率钳制", { roots: [] } as never);
    const spy = vi.spyOn(rng, "chance").mockImplementation((p: number) => {
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
      return false;
    });
    try {
      const region = regionDef("qingyun")!;
      afterWin(region, 1, true);
      expect(spy).toHaveBeenCalled();
    } finally {
      vi.restoreAllMocks();
    }
  });

  it("重复法宝折化的悟道写进掉落回执,不是只进资源账", () => {
    const player = usePlayerStore();
    player.initCharacter("法宝折算对账", { roots: [] } as never);
    const inventory = useInventoryStore();
    const resources = useResourcesStore();
    inventory.addArtifact("af_muyu");
    const before = resources.wudao;

    try {
      // 只放行法宝那一掷:重复获得墨玉葫芦应折 10 悟道,其余掉落都不掺进来。
      vi.spyOn(rng, "chance").mockImplementation((p) => p > 0 && p < ARTIFACT_DROP_CHANCE * 1.25);
      vi.spyOn(rng, "weighted").mockImplementation(<T>(items: readonly T[]) => items[0]!);
      const drops = afterWin(regionDef("qingyun")!, 1, false);
      const gained = resources.wudao - before;
      expect(gained, "重复法宝本身应折 10 悟道").toBe(10);
      expect((drops as { wudao?: number }).wudao, "掉落回执必须与资源账报同一份悟道").toBe(gained);
      expect(drops.items, "折化后的法宝没有新增实物,不能记成拾获一件").toBe(0);
    } finally {
      vi.restoreAllMocks();
    }
  });

  it("智能收纳开启时,凡良(分解勾选档)拾取即化尘,不入行囊,器灵尘到账", () => {
    useSettingsStore().smartKeep.enabled = true;
    const resources = useResourcesStore();
    for (const q of ["mortal", "fine"] as const) {
      const dustBefore = resources.dust;
      const item = mk(q);
      const line = acquireEquipment(item).line;
      expect(bagUids()).not.toContain(item.uid);
      expect(resources.dust).toBe(dustBefore + (DECOMPOSE_DUST[qualityDef(q).rank] ?? 1));
      expect(line).toContain("自动回收");
      expect(line).toContain("器灵尘");
    }
  });

  it("总闸:智能收纳未开启时,凡良(默认分解勾选档)照常入包,不再自动回收", () => {
    expect(useSettingsStore().smartKeep.enabled).toBe(false);
    for (const q of ["mortal", "fine"] as const) {
      const item = mk(q);
      acquireEquipment(item);
      expect(bagUids()).toContain(item.uid);
    }
  });

  it("灵品及以上(未勾分解,亦足保留线)照常入包", () => {
    const item = mk("spirit");
    acquireEquipment(item);
    expect(bagUids()).toContain(item.uid);
  });

  it("上锁的分解档装备不会被误回收", () => {
    const item = mk("mortal");
    item.locked = true;
    acquireEquipment(item);
    expect(bagUids()).toContain(item.uid);
  });

  it("智能收纳开启后,低于保留线又无核心词条的精品也会化尘", () => {
    useSettingsStore().smartKeep.enabled = true;
    const resources = useResourcesStore();
    const item = mk("excellent"); // 精品 rank2,非勾选档 → 交由智能收纳裁决
    acquireEquipment(item);
    expect(bagUids()).not.toContain(item.uid);
    expect(resources.dust).toBeGreaterThanOrEqual(DECOMPOSE_DUST[2] ?? 1);
  });

  it("新手馈赠(forceKeep)不受回收规则影响,必入包", () => {
    const starter = mk("mortal");
    acquireEquipment(starter, { forceKeep: true });
    expect(bagUids()).toContain(starter.uid);
  });

  it("行囊满时,保留下来的新件仍按老规矩腾退包内无缘旧件", () => {
    useSettingsStore().smartKeep.enabled = true;
    const inventory = useInventoryStore();
    // 塞满 120 件凡品(老规矩积压的垃圾)
    for (let i = 0; i < 120; i += 1) inventory.addEquipment(mk("mortal"));
    expect(inventory.bagFull).toBe(true);
    const keep = mk("spirit");
    acquireEquipment(keep);
    expect(bagUids()).toContain(keep.uid);
    expect(inventory.items.length).toBeLessThanOrEqual(120);
  });

  it("回收裁决无随机性:同件装备重复判定结果一致(在线/离线一致的基础)", () => {
    useSettingsStore().smartKeep.enabled = true;
    const junk = mk("mortal");
    expect(shouldAutoRecycle(junk)).toBe(true);
    expect(shouldAutoRecycle({ ...junk, uid: "dummy" })).toBe(true);
    expect(shouldAutoRecycle(mk("spirit"))).toBe(false);
  });
});

/**
 * 法宝掉落的取样口径 —— 「高界该掉高界的东西」不能只写在注释里。
 *
 * 池子本身一直是「fromTier ≤ 当前层级」(旧法宝仍可能掉,图鉴要补齐),
 * 但权重从前只按品质折算:凡品 40 对神品 7.7,于是到了混沌海,
 * 掉出来的多半还是人间界的墨玉葫芦 —— 本界域的法宝反而撞不见。
 * 现加一层就近加成(见 loot.artifactDropWeight),此处钉住它的三条承诺:
 * 同品质下近者更重、旧物不被关掉、高层级时高界之物占多数。
 */
describe("法宝掉落 · 高界的池子该像高界", () => {
  it("池子不关门:凡层级可及的法宝,权重都大于零", () => {
    for (const tier of [1, 10, 20, 26, 32]) {
      const reachable = ARTIFACTS.filter((a) => a.fromTier <= tier);
      expect(reachable.length).toBeGreaterThan(0);
      for (const a of reachable) {
        expect(artifactDropWeight(a, tier), `${a.name} 在 ${tier} 阶被完全关掉了`).toBeGreaterThan(
          0,
        );
      }
    }
  });

  it("同品质下,同层级的那件明显更重(约二十一倍)", () => {
    /**
     * 从表里找一对「同一档品阶、一件刚好在本阶、另一件已出就近窗口」的真实法宝,
     * 而不是写死两个 id —— 品阶重排之后,这一对会自己换人,判据仍旧成立。
     */
    const pair = ARTIFACTS.map((near) => ({
      near,
      old: ARTIFACTS.find(
        (b) => b.quality === near.quality && near.fromTier - b.fromTier >= ARTIFACT_NEAR_WINDOW,
      ),
    })).find((p): p is { near: ArtifactDef; old: ArtifactDef } => p.old !== undefined);
    expect(pair, "池子里没有一对同品质、相隔 ≥ 就近窗口的法宝 —— 判据失去对象").toBeDefined();
    const { near, old } = pair!;
    const tier = near.fromTier;
    const ratio = artifactDropWeight(near, tier) / artifactDropWeight(old, tier);
    // 同阶 ×(1 + 幅度 × 窗口),出了窗口只剩它自己 —— 比例就是窗口那一条的幅度
    const expected = 1 + ARTIFACT_NEAR_BONUS * ARTIFACT_NEAR_WINDOW;
    expect(
      ratio,
      `同品质的「${near.name}」只比 ${ARTIFACT_NEAR_WINDOW} 阶前的「${old.name}」重 ${ratio.toFixed(2)} 倍`,
    ).toBeCloseTo(expected, 6);
  });

  it("到混沌海走一趟,掉出来的大半是仙/神/混沌之物", () => {
    let high = 0;
    const n = 1200;
    for (let i = 0; i < n; i += 1) {
      const id = randomDropArtifact(32);
      expect(id, "32 阶抽不出任何法宝").toBeTruthy();
      if (artifactDef(id!)!.fromTier >= 21) high += 1;
    }
    // 实测约 0.61(品阶重排前后都是这个量级;没有就近加成时约 0.40)——
    // 阈值留足余量,免得这条统计判据自己变得时红时绿
    expect(high / n, `${n} 次里只有 ${high} 次抽到仙界以上的法宝`).toBeGreaterThan(0.55);
  });
});

/**
 * 品阶阶梯 —— 名头是名头,稀缺是稀缺,强度是强度,各管各的。
 *
 * 品阶不是装饰标签:它同时定掉落权重(artifactDropWeight)与数值倍率
 * (data/artifacts.artifactQualityMult)。从前它按 fromTier 机械排成一条不降的
 * 阶梯,于是混沌钟/造化玉碟这些生于神话顶点的至宝,只因其初见窗口在 t19/20,
 * 就被打成了精品。如今反着来:名头定品质 —— 至宝榜必为神品;稀缺由品质权重兜底;
 * 「那一窗的强度」由基底重校保住,不许名头越窗。
 *
 * 钉住三条:
 *   一 至宝榜(混沌钟/造化玉碟/混沌开天斧/鸿蒙尺/神魔镜)必为神品,且神品留给
 *      至宝榜(全表不超六件)——「神品」二字仍携带信息;
 *   二 每个界域的池子里,神品的权重占比都是个位数百分比(按件数也算一遍);
 *   三 换品阶不动有效强度:被动预算与重排前逐位相等(见「重排不动强度」)。
 */
describe("法宝品阶 · 稀缺标签", () => {
  it("至宝榜必为神品 —— 名头定品阶,不由掉落层机械排", () => {
    const apex = new Set(["混沌钟", "造化玉碟", "混沌开天斧", "鸿蒙尺", "神魔镜"]);
    const wrong = ARTIFACTS.filter((a) => apex.has(a.name) && a.quality !== "divine");
    expect(
      wrong,
      `至宝榜被降了格:${wrong.map((a) => `${a.name}=${qualityDef(a.quality).name}`).join("、")}`,
    ).toEqual([]);
    expect(
      ARTIFACTS.filter((a) => a.quality === "divine").length,
      "神品超过六件,「神品」二字失去信息量",
    ).toBeLessThanOrEqual(6);
    expect(
      ARTIFACTS.filter((a) => a.quality === "divine").length,
      "一件神品都没有,梯队缺了顶",
    ).toBeGreaterThan(0);
  });

  it("重排不动强度 —— 品相与稀缺换了,那一窗的强度预算原样保留", () => {
    /**
     * 混沌钟/造化玉碟由精品(×1.265)抬上神品(×3.082)、混沌开天斧/鸿蒙尺由天品
     * (×2.236)抬上神品:基底同步重校,于是玩家看到的有效被动与重排前逐位相等 ——
     * 名头给了稀缺与品相,不给越窗强度。
     */
    const eff = (id: string, key: keyof StatMods): number =>
      artifactValue(artifactDef(id)!, 0).passive[key] ?? 0;
    expect(eff("af_hundun", "attackPct")).toBeCloseTo(0.1606, 3);
    expect(eff("af_hundun", "defensePct")).toBeCloseTo(0.1606, 3);
    expect(eff("af_zaohua", "cultivationSpeed")).toBeCloseTo(0.2846, 3);
    expect(eff("af_hundunfu", "attackPct")).toBeCloseTo(0.1789, 3);
    expect(eff("af_hongmengchi", "armorPen")).toBeCloseTo(0.1342, 3);
  });

  it("每个界域的池子里,神品都只占个位数百分比(按权重与按件数都算一遍)", () => {
    let maxShare = 0;
    let maxTier = 0;
    for (let tier = 1; tier <= 32; tier += 1) {
      const pool = ARTIFACTS.filter((a) => a.fromTier <= tier);
      const total = pool.reduce((sum, a) => sum + artifactDropWeight(a, tier), 0);
      const divine = pool.filter((a) => a.quality === "divine");
      const share = divine.reduce((sum, a) => sum + artifactDropWeight(a, tier), 0) / total;
      /**
       * 至宝「初见面」的窗(混沌钟 t19/造化玉碟 t20 的近邻五阶)允许相对可见:
       * 就近加成把这两阶的权重顶到 ~11% —— 玩家正是在这里第一次撞见神话至宝。
       * 离开初见窗立刻稀回个位数:稀缺性仍在,只是不再把至宝压死。
       */
      const inPeakWindow = divine.some(
        (a) => Math.max(0, tier - a.fromTier) <= ARTIFACT_NEAR_WINDOW,
      );
      if (inPeakWindow) {
        expect(share, `${tier} 阶(至宝初见窗)神品占了 ${(share * 100).toFixed(1)}%`).toBeLessThan(
          0.15,
        );
        expect(
          divine.length / pool.length,
          `${tier} 阶(至宝初见窗)${divine.length}/${pool.length} 是神品`,
        ).toBeLessThan(0.2);
      } else {
        expect(share, `${tier} 阶(无至宝近邻)神品却占了 ${(share * 100).toFixed(1)}%`).toBeLessThan(
          0.1,
        );
        expect(
          divine.length / pool.length,
          `${tier} 阶(无至宝近邻)${divine.length}/${pool.length} 是神品`,
        ).toBeLessThan(0.1);
      }
      if (share > maxShare) {
        maxShare = share;
        maxTier = tier;
      }
    }
    expect(
      ARTIFACTS.filter((a) => a.quality === "divine").length,
      "一件神品都没有 —— 阶梯缺了顶端",
    ).toBeGreaterThan(0);
    expect(
      maxShare,
      `神品在 ${maxTier} 阶占比最高,为 ${(maxShare * 100).toFixed(1)}%`,
    ).toBeLessThan(0.15);
  });
});

/**
 * 装备见闻 —— 图鉴的收录深度就靠这一笔。
 *
 * 装备图鉴此前只有「见没见过」两态;深度取自 lore.equipLore,而写它的地方
 * 只有一处:acquireEquipment(装备入账的唯一漏斗)。这里守三件事:
 * 拾得即记、只记更好的一件、以及**被化尘的那件也算见过**(图鉴记的是见闻,不是家当)。
 */
describe("装备见闻 · 入账那一刻就记下成色", () => {
  /*
   * 每个用例都用**同一件模板** `w_xuantie` 造装备,而断言读的是 lore store 里
   * 那一条记录 —— 它跨用例共享同一个 Pinia 实例。不打乱顺序时恰好按"先 15 阶、
   * 后确认不拉低"的顺序跑,看着没事;**一 shuffle 就露馅**:后一条先跑会留下
   * tier 20 的记录,前一条当场读成 `{ q: 8, t: 20 }`(实测)。
   *
   * 修法是让每个用例从干净 store 起跑,而不是靠"文件里的书写顺序"当隔离。
   */
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  function mkItem(
    uid: string,
    quality: QualityId,
    tier: number,
    templateId = "w_xuantie",
  ): EquipmentInstance {
    return { uid, templateId, quality, tier, level: 0, affixes: [] };
  }

  it("拾得一件就记下它的品质与层级", () => {
    acquireEquipment(mkItem("a", "heaven", 15), { quiet: true, forceKeep: true });
    expect(useLoreStore().equipSeen("w_xuantie")).toEqual({
      q: qualityDef("heaven").rank,
      t: 15,
      u: 0,
    });
  });

  it("后来更差的一件不拉低记录,更好的一件才刷新", () => {
    acquireEquipment(mkItem("a", "fine", 4), { quiet: true, forceKeep: true });
    acquireEquipment(mkItem("b", "heaven", 15), { quiet: true, forceKeep: true });
    acquireEquipment(mkItem("c", "mortal", 2), { quiet: true, forceKeep: true });
    expect(useLoreStore().equipSeen("w_xuantie"), "差的一件把好记录顶掉了").toEqual({
      q: qualityDef("heaven").rank,
      t: 15,
      u: 0,
    });
    acquireEquipment(mkItem("d", "divine", 20), { quiet: true, forceKeep: true });
    expect(useLoreStore().equipSeen("w_xuantie")).toEqual({
      q: qualityDef("divine").rank,
      t: 20,
      u: 0,
    });
  });

  it("被自动回收(化尘)的那件也算见过 —— 图鉴记的是见闻,不是家当", () => {
    useSettingsStore().smartKeep.enabled = true;
    // 换个模板:lore 分片在测试之间会随 localStorage 留着,别让前两条的账串味
    const res = acquireEquipment(mkItem("a", "mortal", 7, "w_qingshuang"), { quiet: true });
    expect(res.bagged, "这一件本该被回收").toBe(false);
    expect(useLoreStore().equipSeen("w_qingshuang"), "化成尘的那件也该记在见闻里").toEqual({
      q: qualityDef("mortal").rank,
      t: 7,
      u: 0,
    });
  });

  /**
   * 「亲手用过」与「见过什么成色」分开记:成色靠运气(要撞上天品),
   * 而用不用它由玩家自己决定 —— 图鉴第二档因此是可推进的(见 ui/codex 的装备梯子)。
   */
  it("装备上身即算上手;强化也算;两者都写进见闻的 u", () => {
    const lore = useLoreStore();
    const inv = useInventoryStore();
    const res = useResourcesStore();
    // 直接摆一件进包:这条判据测的是「上手」怎么记,不想被自动回收与满包规则搅进来
    const item: EquipmentInstance = {
      uid: "used-1",
      templateId: "w_hanfeng",
      quality: "fine",
      tier: 3,
      level: 0,
      affixes: [],
    };
    inv.items = [...inv.items, item];
    expect(lore.equipSeen("w_hanfeng")?.u ?? 0, "还没上身,不算用过").toBe(0);
    inv.equip("used-1", "weapon");
    expect(lore.equipSeen("w_hanfeng")?.u, "装备上身即上手").toBe(1);

    // 强化也记:这是另一条能推进图鉴那一档的路
    res.addSmall("dust", 10_000);
    res.addStone(gn(1e12));
    const before = lore.equipSeen("w_qingshuang")?.u ?? 0;
    expect(before).toBe(0);
    inv.items = [
      ...inv.items,
      {
        uid: "used-2",
        templateId: "w_qingshuang",
        quality: "heaven",
        tier: 3,
        level: 0,
        affixes: [],
      },
    ];
    expect(upgradeEquipment("used-2"), "强化应当成功(素材已给足)").toBe(true);
    expect(lore.equipSeen("w_qingshuang")?.u, "强化过也算上手").toBe(1);
  });

  it("确权直收只做原子入包:满包失败时不折算、不记图鉴与获得计数", () => {
    setActivePinia(createPinia());
    const inventory = useInventoryStore();
    const resources = useResourcesStore();
    const quests = useQuestsStore();
    const lore = useLoreStore();
    inventory.items = Array.from({ length: BAG_CAPACITY }, (_, i) => ({
      uid: `full-${i}`,
      templateId: "w_zhuqing",
      quality: "mortal" as const,
      tier: 1,
      level: 0,
      affixes: [],
    }));
    const dustBefore = resources.dust;
    const stoneBefore = resources.spiritStone;
    const item = mkItem("exact-keep", "divine", 24, "w_zhuqing");

    const blocked = acquireEquipment(item, { quiet: true, keepExactly: true });

    expect(blocked.bagged).toBe(false);
    expect(resources.dust, "买来的东西收不下时不能偷偷化尘").toBe(dustBefore);
    expect(resources.spiritStone, "也不能产生灵石返还").toEqual(stoneBefore);
    expect(quests.counter("equipsGained")).toBe(0);
    expect(quests.collections.equip).not.toContain("w_zhuqing");
    expect(lore.equipSeen("w_zhuqing"), "未成交就不该写成已获得").toBeUndefined();

    inventory.items = [];
    expect(acquireEquipment(item, { quiet: true, keepExactly: true }).bagged).toBe(true);
    expect(quests.counter("equipsGained")).toBe(1);
    expect(quests.collections.equip).toContain("w_zhuqing");
    expect(lore.equipSeen("w_zhuqing")).toEqual({ q: 8, t: 24, u: 0 });
  });
});

describe("forge · 连强本轮总账预览与实付同账", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("料足时,预览的本轮累计恰好等于 upgradeEquipmentAll 实际扣掉的账(到顶)", () => {
    const inv = useInventoryStore();
    const res = useResourcesStore();
    const uid = "rest-1";
    inv.items = [
      { uid, templateId: "w_qingshuang", quality: "heaven", tier: 3, level: 1, affixes: [] },
    ];
    // 料给足,连强不会中途 broke —— 这样预算与实付都该是「一路到顶」的同一笔
    res.addSmall("dust", 10_000_000);
    res.addStone(gn(1e15));
    const preview = planEquipmentUpgradeAll(uid);
    if (!preview) throw new Error("当前未满级,应给出预算");
    const batch = upgradeEquipmentAll(uid);
    expect(batch.ended, "料足应一路到顶").toBe("max");
    expect(batch.count).toBe(preview.count);
    expect(batch.dust).toBe(preview.dust);
    expect(toNum(batch.stone)).toBe(toNum(preview.stone));
  });

  it("料只够本轮一部分时,预告与实付同样在料尽处止", () => {
    const inv = useInventoryStore();
    const res = useResourcesStore();
    const uid = "rest-partial";
    inv.items = [
      { uid, templateId: "w_qingshuang", quality: "heaven", tier: 3, level: 1, affixes: [] },
    ];
    const first = upgradeCost(1, 3, qualityDef("heaven").rank, 0);
    res.addSmall("dust", first.dust);
    res.addStone(gn(1e15));
    const plan = planEquipmentUpgradeAll(uid);
    if (!plan) throw new Error("当前未满级,应给出本轮预算");
    const batch = upgradeEquipmentAll(uid);
    expect(plan).toMatchObject({ fromLevel: 1, count: 1, ended: "broke" });
    expect(batch.count).toBe(plan.count);
    expect(batch.dust).toBe(plan.dust);
    expect(toNum(batch.stone)).toBe(toNum(plan.stone));
  });

  it("已满级时没有本轮预算可给", () => {
    const inv = useInventoryStore();
    inv.items = [
      {
        uid: "rest-full",
        templateId: "w_qingshuang",
        quality: "heaven",
        tier: 3,
        level: 99,
        affixes: [],
      },
    ];
    expect(planEquipmentUpgradeAll("rest-full")).toBeNull();
  });
});

describe("派发前的材料期望 · 每场,只给件数不给概率", () => {
  const run = (rewardMult: number) =>
    expectedMaterialsPerBattle({
      mods: {} as never,
      rewardMult,
      isBoss: false,
      luck: 0,
    });

  it("默认档下是一个正数,且已经过一位小数取整", () => {
    const v = run(1);
    expect(v).toBeGreaterThan(0);
    expect(Math.round(v * 10) / 10).toBe(v);
  });

  it("倍率越高期望越高 —— 收益 ×N 真的换来东西", () => {
    expect(run(1.6)).toBeGreaterThan(run(1));
  });

  it("自证:同参数两次调用结果一致(不偷吃随机数)", () => {
    expect(run(1.3)).toBe(run(1.3));
  });

  it("一位小数是**四舍五入**,不是向下取整 —— 边界值钉死", () => {
    /*
     * 上面那条只断言「结果等于它自己取整后的样子」,那对 `Math.floor` 同样成立 ——
     * 变异测试把 `Math.round` 全换成 `Math.floor`,整个 loot.spec **全绿**。
     * 而差异是真的:route 外边两种取整在上述取值下会给出不同读数(1.7 vs 1.8)。
     *
     * 这条按**具体值**断言,取整方式一变就红。
     */
    expect(run(1), "默认档材料期望").toBe(1.7);
    expect(run(1.5), "×1.5 档要进位到 1.8(向下取整会给 1.7)").toBe(1.8);
    expect(run(2), "×2 档要进位到 1.9(向下取整会给 1.8)").toBe(1.9);
  });
});

describe("派发前的装备期望 · 用场数说话,不是趟数", () => {
  it("倍率越高,需要的场数越少,且恒 ≥ 1", () => {
    const slow = expectedEquipmentBattlesPerPiece({
      mods: {} as never,
      rewardMult: 1,
      isBoss: false,
    })!;
    const fast = expectedEquipmentBattlesPerPiece({
      mods: {} as never,
      rewardMult: 1.6,
      isBoss: false,
    })!;
    expect(fast).toBeLessThan(slow);
    expect(fast).toBeGreaterThanOrEqual(1);
  });

  it("一位小数是四舍五入 —— 边界值钉死", () => {
    /*
     * 同样的问题:上面只测单调性与 ≥1,`Math.floor` 替换后照样绿。
     * 下面的值在两种取整下不同(实测 ×1.2 档:round 2.8 / floor 2.7)。
     */
    const at = (rewardMult: number) =>
      expectedEquipmentBattlesPerPiece({ mods: {} as never, rewardMult, isBoss: false })!;
    expect(at(1)).toBe(3.3);
    expect(at(1.2), "×1.2 档要进位到 2.8(向下取整会给 2.7)").toBe(2.8);
    expect(at(1.6), "×1.6 档要进位到 2.1(向下取整会给 2.0)").toBe(2.1);
  });

  it("自证:同参数两次一致", () => {
    const a = expectedEquipmentBattlesPerPiece({
      mods: {} as never,
      rewardMult: 1.2,
      isBoss: false,
    });
    expect(a).toBe(
      expectedEquipmentBattlesPerPiece({ mods: {} as never, rewardMult: 1.2, isBoss: false }),
    );
  });
});

describe("派发前的丹药期望 · 与装备同口径", () => {
  it("倍率越高场数越少,且恒 ≥ 1", () => {
    const slow = expectedPillBattlesPerPiece({ rewardMult: 1, isBoss: false })!;
    const fast = expectedPillBattlesPerPiece({ rewardMult: 1.6, isBoss: false })!;
    expect(fast).toBeLessThan(slow);
    expect(fast).toBeGreaterThanOrEqual(1);
  });

  it("首领战比普通战更密 —— ×3 真的换来了更少的场数", () => {
    const normal = expectedPillBattlesPerPiece({ rewardMult: 1, isBoss: false })!;
    const boss = expectedPillBattlesPerPiece({ rewardMult: 1, isBoss: true })!;
    expect(boss).toBeLessThan(normal);
  });
});

/**
 * 拾得提示的门槛 —— **灵品及以上才弹 rare**。
 *
 * ## 为什么补这一条
 *
 * 变异测试扫 `loot.ts` 时,把 `q.rank >= 3` 改成 `> 3` 之后**整套判据全绿**,
 * 而这个改动会让「灵品」(rank 正好 3)的装备不再弹提示 —— 玩家打完一场、
 * 捡到一件灵品,什么回应都没有。`loot.spec.ts` 此前**一条 notify 都没测过**。
 *
 * ## 同时钉住「那个 3 是什么」
 *
 * 同一函数里另一处写的是 `q.rank >= qualityDef("heaven").rank`(具名),而这里写裸 `3`。
 * 两者并存既读不出语义,品质表一调 rank 还会静默错位。故判据按**品质名**断言,不按数字。
 */
describe("拾得提示 · 灵品及以上才弹 rare", () => {
  /*
   * 假定时器:**toast 自带 setTimeout(ttl) 自动清理**。用真定时器时,前面用例
   * 排下的 timer 会在后面用例执行时触发、把 toast 删掉,数出来的差值忽大忽小
   * (实测同一门槛下数到 3 / 0 / 1 三种)。这里只测"调用瞬间弹了什么",
   * 不关心它多久消失 —— 那是 toastLifeMs 的事,另有判据。
   */
  /*
   * 这里原先只起了假定时器,**没建 Pinia** —— 靠的是文件里前面那些 describe
   * 留下的活动实例。不打乱顺序时没事,一 shuffle 就炸:
   * `getActivePinia() was called but there was no active Pinia`。
   * 每个 describe 自己建一个,别依赖书写顺序。
   */
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());
  /** 走一次入包,返回本轮弹了几条 rare */
  let seq = 0;
  /*
   * 用**前后差值**而不是清空再数:ui store 的 toasts 是 ref(上限 5 条),
   * `toasts.length = 0` 改的是数组实例、不触发替换,数出来会是历史残留。
   * 数差值也不依赖 store 的内部上限。
   */
  /*
   * 只数**拾得那一条**,不数所有 rare —— 入包会连带触发名号与成就(「获得名号
   * 『初入仙途』」「成就达成『初窥仙途』」,都是 rare),那些是别的系统的正常产出。
   * 实测一次入包总共 3 条 rare,其中只有 1 条是拾得;按总数断言会数到 3 而误判。
   */
  const acquire = (quality: QualityId, quiet = false): number => {
    seq += 1;
    const before = useUiStore().toasts.filter((t) => t.text.includes("拾得")).length;
    acquireEquipment(
      { uid: `notice${seq}`, templateId: "b_qingyun", quality, tier: 3, level: 0, affixes: [] },
      { quiet },
    );
    return useUiStore().toasts.filter((t) => t.text.includes("拾得")).length - before;
  };

  it("灵品(rank 3)要弹 —— 它正是那道门槛本身", () => {
    expect(acquire("spirit"), "灵品掉落没有任何回应 —— 门槛是不是被改成了 > 3").toBe(1);
  });

  it("精品(rank 2)不弹 —— 门槛之下", () => {
    expect(acquire("excellent")).toBe(0);
  });

  it("玄品 / 地品 / 天品都在门槛之上", () => {
    /*
     * 逐个**单独起 isolate** 断言,不连跑三次:ui store 的 toasts 上限 5 条,
     * 一次入包会连带名额/成就共 3 条,连跑三次就挤掉了前一批(实测 earth 数到 0)。
     * 这条判据要测的是"该品质弹不弹",与队列容量无关。
     */
    for (const quality of ["profound", "earth", "heaven"] as QualityId[]) {
      setActivePinia(createPinia());
      expect(acquire(quality), `${quality} 该弹提示`).toBe(1);
    }
  });

  it("quiet 时不弹 —— 离线结算不该在玩家回来时刷一串提示", () => {
    expect(acquire("heaven", true), "quiet 分支仍弹了提示").toBe(0);
  });
});
