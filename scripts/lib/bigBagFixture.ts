/**
 * 背包规模夹具 —— 从真实装备表取 14 阶模板生成,不在自检脚本里手抄 id。
 *
 * 手抄夹具曾把两件法宝 id 当装备塞进背包,300 件里只有 150 件通过清洗;
 * 运行时门于是把「150 件」当成 300 件量了很久。模板从这里来,再由浏览器端
 * `data-inventory-total` 对账实际入包件数,两个缺口各堵一层。
 */
import type { EquipmentInstance, QualityId } from "../../src/types";
import { EQUIPMENT_TEMPLATES } from "../../src/data/equipment";
import { AFFIXES } from "../../src/data/affixes";

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

/**
 * 词条转移候选夹具 —— 源件挂一条无部位、无品质门槛的词条,其余整包都是候选。
 * 源件固定成 14 阶武器,让现有的部位候选门与转移门共用同一份真实大行囊。
 */
export function makeAffixTransferBag(count: number) {
  const items = makeBigBagItems(count);
  const source = items[0];
  if (!source) throw new Error("转移候选夹具至少需要一件源装备");
  const weapon = EQUIPMENT_TEMPLATES.find(
    (template) => template.tier === BENCH_TIER && template.slot === "weapon",
  );
  if (!weapon) throw new Error(`${BENCH_TIER} 阶没有武器模板,转移候选夹具失效`);
  const affix = AFFIXES.find((def) => def.slots === undefined && def.minRank === undefined);
  if (!affix) throw new Error("词条表里没有无部位、无品质门槛的转移源词条");

  items[0] = {
    ...source,
    templateId: weapon.id,
    // 全部藏品按品阶→层级排序;源件排进首批,运行时门才能直接从背包卡打开详情,
    // 不必先叠一层部位候选弹窗再把背景里的旧读数算进来。
    quality: "heaven",
    affixes: [{ id: affix.id, roll: 0.8 }, ...source.affixes.filter((row) => row.id !== affix.id)],
  };
  return {
    items,
    sourceUid: source.uid,
    sourceSlot: weapon.slot,
    affixId: affix.id,
    affixName: affix.name,
    candidateCount: items.length - 1,
  };
}
