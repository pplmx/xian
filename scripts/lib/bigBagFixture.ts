/**
 * 背包规模夹具 —— 从真实装备表取 14 阶模板生成,不在自检脚本里手抄 id。
 *
 * 手抄夹具曾把两件法宝 id 当装备塞进背包,300 件里只有 150 件通过清洗;
 * 运行时门于是把「150 件」当成 300 件量了很久。模板从这里来,再由浏览器端
 * `data-inventory-total` 对账实际入包件数,两个缺口各堵一层。
 */
import type { EquipmentInstance, QualityId } from "../../src/types";
import { EQUIPMENT_TEMPLATES } from "../../src/data/equipment";

const BENCH_TIER = 14;
const QUALITIES: QualityId[] = ["mortal", "spirit", "earth", "heaven"];

export function makeBigBagItems(count: number): EquipmentInstance[] {
  const templates = EQUIPMENT_TEMPLATES.filter((item) => item.tier === BENCH_TIER);
  if (templates.length === 0) throw new Error(`${BENCH_TIER} 阶没有装备模板,背包夹具失效`);
  const size = Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0;
  return Array.from({ length: size }, (_, i) => ({
    uid: `big_${i}`,
    templateId: templates[i % templates.length]!.id,
    quality: QUALITIES[i % QUALITIES.length]!,
    tier: BENCH_TIER,
    level: 0,
    affixes: [
      { id: "bs3", roll: 1 },
      { id: "low2", roll: 1 },
    ],
  }));
}
