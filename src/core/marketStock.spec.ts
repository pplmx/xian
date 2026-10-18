/**
 * 坊市货架 —— 同款去重与确定性同源。
 *
 * 背景:两件「涉沼靴·精品9阶」并排挂着。两槽各自独立随机,抽到同一模板是正常概率,
 * 不是 bug;但货架摆两件同名同品,读起来像出了 bug —— 生成时撞款则 shift+1 重滚。
 *
 * 三条底线(任何一条破,坊市的账就不可信):
 *   · 同架装备槽互不同款(templateId+quality)
 *   · 同参数两次上货,整架逐位一致(确定性;预览与购买同源同一物靠它)
 *   · 旧档 slot 没有 seedShift 字段 → 视为 0 → 与原种子公式逐位一致(零迁移)
 */
import { describe, expect, it } from "vite-plus/test";
import { RandomService, mulberry32 } from "@/utils/random";
import { generateMarketStock, marketEquipInstance } from "@/core/marketService";
import type { MarketEquipSlot } from "@/data/market";

describe("坊市货架:同款去重", () => {
  it("同一架货里,装备槽不出现同名同品的第二件", () => {
    // 扫足够多的上货时刻与境界带:撞款是概率事件,一轮扫不到不代表去重有效,
    // 得让旧实现在同样参数下确实撞过(截图里的涉沼靴即实证),断言才有牙。
    let equipSlots = 0;
    for (let round = 0; round < 120; round += 1) {
      const major = (round % 20) + 1;
      const now = 1_700_000_000_000 + round * 86_400_000;
      const stock = generateMarketStock(major, new RandomService(mulberry32(round)), now);
      const keys = new Set<string>();
      for (const g of stock.goods) {
        if (g.kind !== "equipment") continue;
        equipSlots += 1;
        const inst = marketEquipInstance(g as MarketEquipSlot, now);
        const key = `${inst.templateId}:${inst.quality}`;
        expect(keys.has(key), `第 ${round} 轮 major ${major} 货架出现两件 ${key}`).toBe(false);
        keys.add(key);
      }
    }
    expect(equipSlots, "样本里得真的有装备槽,否则断言空转").toBeGreaterThan(50);
  });

  it("同参数两次上货,整架逐位一致(确定性)", () => {
    const major = 7;
    const now = 1_700_000_100_000;
    const a = generateMarketStock(major, new RandomService(mulberry32(42)), now);
    const b = generateMarketStock(major, new RandomService(mulberry32(42)), now);
    expect(JSON.stringify(a.goods)).toBe(JSON.stringify(b.goods));
    expect(a.stockedAt).toBe(b.stockedAt);
  });

  it("旧档 slot 无 seedShift → 与 shift=0 同一件(零迁移)", () => {
    const slot: MarketEquipSlot = {
      kind: "equipment",
      idx: 3,
      tier: 9,
      minQualityRank: 2,
      price: { m: 1, e: 4 },
      sold: false,
      // 故意不带 seedShift —— 模拟老存档读回的形状
    };
    const at = 1_700_000_200_000;
    const a = marketEquipInstance(slot, at);
    const b = marketEquipInstance({ ...slot, seedShift: 0 }, at);
    expect(a.templateId).toBe(b.templateId);
    expect(a.quality).toBe(b.quality);
    expect(JSON.stringify(a.affixes)).toBe(JSON.stringify(b.affixes));
  });

  it("预览与购买同源:同一 slot 反复再生是同一件", () => {
    const major = 12;
    const now = 1_700_000_300_000;
    const stock = generateMarketStock(major, new RandomService(mulberry32(7)), now);
    const equip = stock.goods.find((g) => g.kind === "equipment") as MarketEquipSlot | undefined;
    if (!equip) return; // 该轮没滚出装备槽,由第一例的 50+ 样本兜底
    const once = marketEquipInstance(equip, now);
    const twice = marketEquipInstance(equip, now);
    expect(once.templateId).toBe(twice.templateId);
    expect(once.quality).toBe(twice.quality);
    expect(JSON.stringify(once.affixes)).toBe(JSON.stringify(twice.affixes));
  });
});
