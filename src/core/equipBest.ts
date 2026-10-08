/**
 * 一键换装 · 每槽换上当前最强的一件 —— 玩家反馈驱动。
 *
 * 「最强」= **真实战斗价值**(equippablePower):基础攻/防/血平铺(引擎按层级曲线 ×
 * 品质^1.8 × 强化加成现算,血按 1/6 折算续命)+ 词条战力(权重与战力面板同一张
 * POWER_STAT_WEIGHTS,会心按「会心 ×(1+会心伤)」联乘)。
 *
 * 旧口径按「品质 → 层级 → 强化 → 词条」粗排,把**强化满、阶数高**的装备压在高品位
 * 新鲜胚子之下 —— 玩家眼里最强的没上身。粗排 betterEquip 降级为「同战力」的稳定
 * 裁决(保证不两败打转),不再是主判。
 *
 * 纯方便性功能:**只改装配**,不分解、不炼化、不卖任何一件;换下来的旧件自动回行囊
 * (inventory.equip 的 bag.assign 语义)。同一件已经是该槽最强时不动(幂等)。
 *
 * 这一层**不认识 store**:要改的背包以 `EquipInventory` 端口传进来(视图传
 * `useInventoryStore()` 即可)。于是选哪一件/该不该换的**判断**是纯函数,
 * 测它不必先起一套 Pinia;真正落库那一下仍由 store 的 `equip` 做。
 */
import { qualityDef } from "@/data/qualities";
import { equipmentTemplate } from "@/data/equipment";
import { resolveEquipStats } from "./equipGen";
import { POWER_STAT_WEIGHTS } from "./powerRating";
import { toNum } from "@/utils/gnum";
import type { AnyStatKey, EquipmentInstance, EquipSlot } from "@/types";

const SLOT_COURIER: EquipSlot[] = [
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

/** 气血按 1/6 折算进战力:续命值钱,但不如攻防那么直接 */
const HP_FLAT_WEIGHT = 1 / 6;

function qualityRank(i: EquipmentInstance): number {
  return qualityDef(i.quality).rank;
}

function rollSum(i: EquipmentInstance): number {
  return i.affixes.reduce((s, x) => s + x.roll, 0);
}

/**
 * 一件装备的真实战斗价值 = 平铺 × (1 + 词条加权分)。
 *
 * 平铺是引擎解析后的三围(层级 × 品质^1.8 × 强化全在里头,见 equipGen.resolveEquipStats);
 * 词条按战力面板同一张权重表折算(百分比分,pct 尺度,会心按联乘单列)。
 *
 * 词条项**乘回这件装备自己的平铺**而不是裸加 —— 否则 5% 攻击这种 0.05 的百分比
 * 加到 ~1e6 的平铺上等于 1e7 分之五,排序里纯是噪声,「词条算战力」就成了空话。
 * 乘回基准后,一条 +5% 攻击正好值这件装备平铺的 5%:同阶/邻阶里词条能翻转胜负,
 * 跨阶层级(约 1.9×/阶)仍然主导 —— 与「真实战力」的直觉一致。
 * 成长类词条(修炼速度等)不在权重表上,分项为 0 —— 一键不为了修速换装。
 */
export function equippablePower(i: EquipmentInstance): number {
  const r = resolveEquipStats(i);
  const f = r.flats;
  // toNum 在 e>308 返回 Infinity(见 utils/gnum)。坏档 / 异常模板把平铺写爆时先夹回 0,
  // 别让 Infinity 战力混进 multi 件全平手、一键换装退化成语义变味的比较(与 yunyin 同纪律)。
  const finite = (n: number): number => (Number.isFinite(n) ? n : 0);
  const base =
    finite(toNum(f.attack)) + finite(toNum(f.defense)) + finite(toNum(f.maxHp)) * HP_FLAT_WEIGHT;
  const critRate = r.mods.critRate ?? 0;
  const critDamage = r.mods.critDamage ?? 0;
  // 面板的百分比分(pct 尺度):会心联乘单列,其余键按权重表折
  let pct = critRate * (1 + critDamage);
  for (const [k, raw] of Object.entries(r.mods)) {
    if (k === "critRate" || k === "critDamage" || raw === undefined) continue;
    pct += (POWER_STAT_WEIGHTS[k as AnyStatKey] ?? 0) * raw;
  }
  return base * (1 + pct);
}

/** a 是否严格强于 b(真实战力为主,同分回退到粗排 —— 不两败打转) */
function stronger(a: EquipmentInstance, b: EquipmentInstance): boolean {
  const pa = equippablePower(a);
  const pb = equippablePower(b);
  if (pa !== pb) return pa > pb;
  return betterEquip(a, b);
}

/** 旧序的粗排(品质 → 层级 → 强化 → 词条成色)。现作「同战力」的稳定裁决 */
export function betterEquip(a: EquipmentInstance, b: EquipmentInstance): boolean {
  const qa = qualityRank(a);
  const qb = qualityRank(b);
  if (qa !== qb) return qa > qb;
  if (a.tier !== b.tier) return a.tier > b.tier;
  if (a.level !== b.level) return a.level > b.level;
  return rollSum(a) > rollSum(b);
}

/**
 * 要改的那本背包 —— core 只认这个形状,不认 Pinia。
 * `useInventoryStore()` 天然满足它(字段是解包后的值,方法是同名的那些)。
 */
export interface EquipInventory {
  items: readonly EquipmentInstance[];
  equipped: Partial<Record<EquipSlot, string>>;
  equip(uid: string, slot: EquipSlot): void;
  findItem(uid: string): EquipmentInstance | undefined;
}

/** 该槽该穿的最强一件(该槽无任何可穿戴时返回 null) */
export function bestEquipFor(inv: EquipInventory, slot: EquipSlot): EquipmentInstance | null {
  const pool = inv.items.filter((i) => equipmentTemplate(i.templateId)?.slot === slot);
  if (pool.length === 0) return null;
  return pool.reduce((a, b) => (stronger(b, a) ? b : a));
}

/** 一键换装单槽:换上最强一件,已是则不动。返回是否真的换了 */
export function equipBestFor(inv: EquipInventory, slot: EquipSlot): boolean {
  const best = bestEquipFor(inv, slot);
  if (!best) return false;
  if (inv.equipped[slot] === best.uid) return false;
  inv.equip(best.uid, slot);
  return true;
}

/** 一键换装全部可穿槽(法宝另走 equippedArtifacts,不在这九个里) */
export function equipAllBest(inv: EquipInventory): number {
  let changed = 0;
  for (const slot of SLOT_COURIER) {
    if (equipBestFor(inv, slot)) changed += 1;
  }
  return changed;
}

/**
 * 一键穿齐某共鸣套。每槽换上该套**已持有里最强**的一件(真实战力为主,同分
 * 回退粗排);已穿的那件更强就不动 —— 穿套装绝不降级。返回换上几件。
 */
export function equipSetCombo(inv: EquipInventory, setId: string): number {
  const bestPerSlot = new Map<EquipSlot, EquipmentInstance>();
  for (const it of inv.items) {
    const tpl = equipmentTemplate(it.templateId);
    if (!tpl || tpl.set !== setId) continue;
    const cur = bestPerSlot.get(tpl.slot);
    if (!cur || stronger(it, cur)) bestPerSlot.set(tpl.slot, it);
  }
  let changed = 0;
  for (const [slot, piece] of bestPerSlot) {
    if (inv.equipped[slot] === piece.uid) continue;
    const occupant = inv.equipped[slot] ? inv.findItem(inv.equipped[slot]!) : undefined;
    if (occupant && stronger(occupant, piece)) continue;
    inv.equip(piece.uid, slot);
    changed += 1;
  }
  return changed;
}
