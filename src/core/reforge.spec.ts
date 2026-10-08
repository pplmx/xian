/* oxlint-disable no-console -- 成本表是给人看的 */
/**
 * 重铸与封存 —— 成本只看「阶数」与「封存数」,重铸连条数一起重掷
 *
 * 旧口径是「品质倍率 × 1.5^次数,上限 10 次」。两处都换掉了:
 *   一 **不限次数**:能不能继续炼,不该由一个与装备无关的计数器决定;
 *   二 **成本只随两件事走**:它有多高阶(与强化/封存同一条 stoneByTier 经济)、
 *      你封存了几个词条(封存是保护,保护得越多,重掷剩下部分越贵)。
 * 而「重铸」的动作也换了:旧版只**换掉一条**词条、条数不动;现在把未封存的
 * 词条推倒重来 —— **条数按品质区间重掷**(至少给一条新的),数值全部重掷。
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createPinia, setActivePinia } from "pinia";
import {
  reforgeCost,
  reforgeEquipment,
  reforgeableAffixIds,
  sealCapacity,
  sealCost,
  sealAffix,
  unsealAffix,
} from "./reforge";
import { REFORGE_DUST_BASE, REFORGE_SEAL_LOAD, REFORGE_STONE_BASE } from "@/data/constants";
import { qualityDef } from "@/data/qualities";
import { rng } from "@/utils/random";
import { useInventoryStore } from "@/stores/inventory";
import { useResourcesStore } from "@/stores/resources";
import { gn } from "@/utils/gnum";
import type { EquipmentInstance } from "@/types";

const stoneOf = (g: { m: number; e: number }): number => g.m * Math.pow(10, g.e);

const base: EquipmentInstance = {
  uid: "u1",
  templateId: "w_zhuqing",
  quality: "excellent",
  tier: 3,
  level: 0,
  affixes: [
    { id: "atk1", roll: 0.5 },
    { id: "def1", roll: 0.5 },
  ],
  reforgeCount: 0,
};

describe("重铸成本 · 只看阶数与封存数", () => {
  it("不限次数:洗到第两百次仍可重铸,且价格与第一次相同", () => {
    const first = reforgeCost({ ...base, reforgeCount: 0 })!;
    const late = reforgeCost({ ...base, reforgeCount: 200 })!;
    expect(late, "不该再有次数上限").not.toBeNull();
    expect(stoneOf(late.stone), "次数不进公式").toBeCloseTo(stoneOf(first.stone), 6);
    expect(late.dust).toBe(first.dust);
  });

  it("品质不进公式:凡品与神品洗一次同价(贵贱由阶数与封存数说)", () => {
    const mortal = reforgeCost({ ...base, quality: "mortal" })!;
    const divine = reforgeCost({ ...base, quality: "divine" })!;
    expect(stoneOf(divine.stone)).toBeCloseTo(stoneOf(mortal.stone), 6);
  });

  it("阶数定价:灵石 = stoneByTier(阶) × 基础,与强化同一条经济", () => {
    const t3 = reforgeCost({ ...base, tier: 3 })!;
    const t10 = reforgeCost({ ...base, tier: 10 })!;
    console.log(
      `\n  重铸灵石:3 阶 ${stoneOf(t3.stone).toExponential(2)} → 10 阶 ${stoneOf(t10.stone).toExponential(2)}`,
    );
    expect(stoneOf(t10.stone)).toBeGreaterThan(stoneOf(t3.stone) * 5);
    // 未封存时正好是「基础 × 阶数倍率」
    const t3NoSeal = reforgeCost({ ...base, tier: 3 })!;
    expect(t3NoSeal.dust).toBe(REFORGE_DUST_BASE);
    expect(REFORGE_STONE_BASE).toBeGreaterThan(0);
  });

  it("封存溢价:每封一条,灵石与器灵尘各上浮 REFORGE_SEAL_LOAD", () => {
    const three = { ...base, affixes: [...base.affixes, { id: "hp1", roll: 0.5 }] };
    const one = reforgeCost({ ...three, sealedAffixIds: ["atk1"] })!;
    const two = reforgeCost({ ...three, sealedAffixIds: ["atk1", "def1"] })!;
    expect(stoneOf(two.stone) / stoneOf(one.stone)).toBeCloseTo(
      (1 + 2 * REFORGE_SEAL_LOAD) / (1 + REFORGE_SEAL_LOAD),
      6,
    );
    expect(two.dust).toBe(Math.round(REFORGE_DUST_BASE * (1 + 2 * REFORGE_SEAL_LOAD)));
  });

  it('全部封存就没得重铸了 —— 这是唯一一种"不能再炼"', () => {
    expect(reforgeCost({ ...base, sealedAffixIds: ["atk1", "def1"] })).toBeNull();
    expect(sealCapacity(base), "封存上限 = 词条数 − 1(至少留一个可重掷位)").toBe(1);
    expect(sealCost({ ...base, sealedAffixIds: ["atk1"] })).toBeNull();
  });
});

describe("重铸动作 · 条数与数值一起重掷", () => {
  beforeEach(() => setActivePinia(createPinia()));
  afterEach(() => vi.restoreAllMocks());

  /** 摆一件装备与足够的资源(重铸要真扣账) */
  function setup(inst: EquipmentInstance): void {
    useInventoryStore().items = [inst];
    const res = useResourcesStore();
    res.addStone(gn(1e30));
    res.addSmall("dust", 100_000);
  }

  it("条数按品质区间重掷:上限拉满时,词条数真的变多", () => {
    const inst: EquipmentInstance = {
      ...base,
      uid: "count-up",
      quality: "profound", // 玄品:3~4 条
      affixes: [{ id: "atk1", roll: 0.5 }],
    };
    setup(inst);
    // 让条数掷到上限、且新词条挑得出
    vi.spyOn(rng, "int").mockReturnValue(qualityDef("profound").affixes[1]);
    expect(reforgeEquipment("count-up")).toBe(true);
    const after = useInventoryStore().findItem("count-up")!;
    expect(after.affixes.length).toBe(qualityDef("profound").affixes[1]);
    expect(after.affixes.length).toBeGreaterThan(inst.affixes.length);
    expect(after.reforgeCount, "次数仍记着(只是不进公式)").toBe(1);
  });

  it("封存的原样保留,其余词条全部重掷(掷点重来)", () => {
    const inst: EquipmentInstance = {
      ...base,
      uid: "sealed-keep",
      quality: "profound",
      affixes: [
        { id: "atk1", roll: 0.1 },
        { id: "def1", roll: 0.2 },
        { id: "hp1", roll: 0.3 },
      ],
      sealedAffixIds: ["atk1"],
    };
    setup(inst);
    // 把新掷点钉成一个一眼可辨的值:未封存的那几条若还带着从前的 0.2/0.3,就说明没重掷
    vi.spyOn(rng, "weighted").mockImplementation(
      ((items: readonly unknown[]) => items[0]) as never,
    );
    vi.spyOn(rng, "next").mockReturnValue(0.99);
    expect(reforgeEquipment("sealed-keep")).toBe(true);
    const after = useInventoryStore().findItem("sealed-keep")!;
    const kept = after.affixes.find((a) => a.id === "atk1");
    expect(kept, "封存的那条必须还在").toBeDefined();
    expect(kept!.roll, "封存的掷点不动").toBe(0.1);
    for (const a of after.affixes.filter((x) => x.id !== "atk1")) {
      expect(a.roll, `${a.id} 还是旧掷点,说明没重掷`).toBe(0.99);
    }
    const [min, max] = qualityDef("profound").affixes;
    expect(after.affixes.length).toBeGreaterThanOrEqual(min);
    expect(after.affixes.length).toBeLessThanOrEqual(max);
    expect(new Set(after.affixes.map((a) => a.id)).size, "同一件里不该有重复词条").toBe(
      after.affixes.length,
    );
  });

  it("每次重铸至少给一条新的:封存到只剩一个位时也不会空转", () => {
    const inst: EquipmentInstance = {
      ...base,
      uid: "one-slot",
      quality: "excellent", // 精品 2~3 条
      affixes: [
        { id: "atk1", roll: 0.5 },
        { id: "def1", roll: 0.5 },
      ],
      sealedAffixIds: ["atk1"],
    };
    setup(inst);
    expect(reforgeEquipment("one-slot")).toBe(true);
    const after = useInventoryStore().findItem("one-slot")!;
    const [min, max] = qualityDef("excellent").affixes;
    // 条数按品质区间重掷(精品 2~3),但封存的那条一定还在、且至少补一条新的
    expect(after.affixes.length).toBeGreaterThanOrEqual(min);
    expect(after.affixes.length).toBeLessThanOrEqual(max);
    expect(after.affixes.some((a) => a.id === "atk1")).toBe(true);
    expect(
      after.affixes.some((a) => a.id !== "atk1"),
      "至少要有一条新的",
    ).toBe(true);
  });

  it("不止一条可洗:一掷定一份词条构成,而不是只换一条", () => {
    const inst: EquipmentInstance = {
      ...base,
      uid: "multi",
      quality: "heaven", // 4~5 条
      affixes: [
        { id: "atk1", roll: 0.5 },
        { id: "def1", roll: 0.5 },
        { id: "hp1", roll: 0.5 },
        { id: "crit1", roll: 0.5 },
      ],
    };
    setup(inst);
    vi.spyOn(rng, "int").mockReturnValue(qualityDef("heaven").affixes[1]);
    reforgeEquipment("multi");
    const after = useInventoryStore().findItem("multi")!;
    expect(after.affixes.length).toBe(qualityDef("heaven").affixes[1]);
    expect(new Set(after.affixes.map((a) => a.id)).size, "同一件里不该有重复词条").toBe(
      after.affixes.length,
    );
  });

  it("资源不足时不动装备、不记账", () => {
    const inst: EquipmentInstance = { ...base, uid: "poor" };
    useInventoryStore().items = [inst];
    expect(reforgeEquipment("poor")).toBe(false);
    expect(useInventoryStore().findItem("poor")!.reforgeCount).toBe(0);
  });

  it("封存要付费,且封满之后不再可封", () => {
    const inst: EquipmentInstance = { ...base, uid: "seal" };
    useInventoryStore().items = [inst];
    const res = useResourcesStore();
    res.addStone(gn(1e30));
    expect(sealAffix("seal", "atk1")).toBe(true);
    expect(useInventoryStore().findItem("seal")!.sealedAffixIds).toEqual(["atk1"]);
    expect(sealAffix("seal", "def1"), "只剩一条可重掷位,封不了").toBe(false);
  });
});

describe("解除封存(解锁)· 免费即时,与封存共用同一份 sealedAffixIds", () => {
  beforeEach(() => setActivePinia(createPinia()));
  afterEach(() => vi.restoreAllMocks());

  /** 摆一件装备与足够的资源(封存要真扣账;解锁不扣,但账目要能对比) */
  function setup(inst: EquipmentInstance): void {
    useInventoryStore().items = [inst];
    useResourcesStore().addStone(gn(1e30));
  }

  it("封存后可解锁:sealedAffixIds 去掉该条,词条重回可重掷位", () => {
    const inst: EquipmentInstance = {
      ...base,
      uid: "u-unseal",
      affixes: [
        { id: "atk1", roll: 0.5 },
        { id: "def1", roll: 0.5 },
        { id: "hp1", roll: 0.5 },
      ],
    };
    setup(inst);
    expect(sealAffix("u-unseal", "atk1")).toBe(true);
    let cur = useInventoryStore().findItem("u-unseal")!;
    expect(cur.sealedAffixIds).toEqual(["atk1"]);
    expect(reforgeableAffixIds(cur)).not.toContain("atk1");

    expect(unsealAffix("u-unseal", "atk1"), "已封存则解封成功").toBe(true);
    cur = useInventoryStore().findItem("u-unseal")!;
    expect(cur.sealedAffixIds).toEqual([]);
    expect(reforgeableAffixIds(cur), "解锁后该词条重回可重掷位").toContain("atk1");
  });

  it("reforgeCost 随封存数升、随解锁降:解锁后成本回落", () => {
    const inst: EquipmentInstance = {
      ...base,
      uid: "u-cost",
      affixes: [
        { id: "atk1", roll: 0.5 },
        { id: "def1", roll: 0.5 },
        { id: "hp1", roll: 0.5 },
      ],
    };
    setup(inst);
    sealAffix("u-cost", "atk1");
    const sealedCost = reforgeCost(useInventoryStore().findItem("u-cost")!)!;
    unsealAffix("u-cost", "atk1");
    const unsealedCost = reforgeCost(useInventoryStore().findItem("u-cost")!)!;
    expect(stoneOf(unsealedCost.stone)).toBeLessThan(stoneOf(sealedCost.stone));
    expect(unsealedCost.dust).toBeLessThan(sealedCost.dust);
  });

  it("解锁 no-op 安全:本就未封存的条解封返回 false 且不动实例", () => {
    const inst: EquipmentInstance = { ...base, uid: "u-nop" };
    setup(inst);
    expect(unsealAffix("u-nop", "def1")).toBe(false);
    expect(useInventoryStore().findItem("u-nop")!.sealedAffixIds ?? []).toEqual([]);
  });

  it("解锁免费、不退款:灵石一分不动,只是放弃槽位保护", () => {
    const inst: EquipmentInstance = {
      ...base,
      uid: "u-free",
      affixes: [
        { id: "atk1", roll: 0.5 },
        { id: "def1", roll: 0.5 },
      ],
    };
    setup(inst);
    const res = useResourcesStore();
    expect(sealAffix("u-free", "atk1")).toBe(true); // 封存会真扣一笔
    const before = stoneOf(res.spiritStone);
    expect(unsealAffix("u-free", "atk1")).toBe(true);
    expect(stoneOf(res.spiritStone), "解锁不退款也不收费").toBe(before);
  });

  it("解锁减少封存,天然不违反「至少留一可重掷位」:解锁后重铸恢复", () => {
    const inst: EquipmentInstance = {
      ...base,
      uid: "u-cap",
      affixes: [
        { id: "atk1", roll: 0.5 },
        { id: "def1", roll: 0.5 },
      ],
    };
    setup(inst);
    expect(sealAffix("u-cap", "atk1")).toBe(true); // 已是上限 1/1
    expect(sealCost(useInventoryStore().findItem("u-cap")!), "封满不可再封").toBeNull();
    expect(unsealAffix("u-cap", "atk1")).toBe(true);
    expect(
      reforgeCost(useInventoryStore().findItem("u-cap")!),
      "解锁后不再全封存,重铸恢复可用",
    ).not.toBeNull();
    expect(sealCost(useInventoryStore().findItem("u-cap")!), "空出位子,又可再封").not.toBeNull();
  });
});

describe("界面与判定同源 · 条数上限不写死", () => {
  const dialog = readFileSync(
    resolve(__dirname, "../components/equipment/EquipmentDetailDialog.vue"),
    "utf8",
  );

  it("词条条数上限取自品质表,不在模板里写死数字", () => {
    expect(dialog, "上限应读 qualityDef(...).affixes[1]").toContain(
      "qualityDef(inst.value.quality).affixes[1]",
    );
    expect(dialog, "封存上限应读 sealCapacity(与判定同一处)").toContain("sealCapacity(");
    expect(dialog, "不该再出现「重铸次数 x/10」这类写死的分母").not.toMatch(/重铸次数\s*\{\{/);
  });

  it("已封存词条有「解除封存」入口,且与核心同源(unsealAffix)", () => {
    expect(dialog, "界面应调用 unsealAffix(与核心同一处)").toContain("unsealAffix");
    expect(dialog, "解除按钮文案").toMatch(/解除/);
  });
});
