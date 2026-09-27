/**
 * 一键换装 · 每槽换上当前最强的一件 —— 自 yunyin-xiuxian 吸收(玩家反馈驱动)。
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
 */
import { useInventoryStore } from '@/stores/inventory'
import { qualityDef } from '@/data/qualities'
import { equipmentTemplate } from '@/data/equipment'
import { resolveEquipStats } from './equipGen'
import { POWER_STAT_WEIGHTS } from './powerRating'
import { toNum } from '@/utils/gnum'
import type { AnyStatKey, EquipmentInstance, EquipSlot } from '@/types'

const SLOT_COURIER: EquipSlot[] = [
  'weapon',
  'head',
  'body',
  'wrist',
  'belt',
  'boots',
  'necklace',
  'ring',
  'talisman'
]

/** 气血按 1/6 折算进战力:续命值钱,但不如攻防那么直接 */
const HP_FLAT_WEIGHT = 1 / 6

function qualityRank(i: EquipmentInstance): number {
  return qualityDef(i.quality).rank
}

function rollSum(i: EquipmentInstance): number {
  return i.affixes.reduce((s, x) => s + x.roll, 0)
}

/**
 * 一件装备的真实战斗价值 = 平铺 + 词条战力。
 *
 * 平铺是引擎解析后的三围(层级 × 品质^1.8 × 强化全在里头,见 equipGen.resolveEquipStats);
 * 词条按战力面板同一张权重表折算,会心按联乘单列(与 ratePower 同口径)。
 * 成长类词条(修炼速度等)不在权重表上,战力不因它增减 —— 一键不为了修速换装。
 */
export function equippablePower(i: EquipmentInstance): number {
  const r = resolveEquipStats(i)
  const f = r.flats
  let value = toNum(f.attack) + toNum(f.defense) + toNum(f.maxHp) * HP_FLAT_WEIGHT
  const critRate = r.mods.critRate ?? 0
  const critDamage = r.mods.critDamage ?? 0
  value += critRate * (1 + critDamage)
  for (const [k, raw] of Object.entries(r.mods)) {
    if (k === 'critRate' || k === 'critDamage' || raw === undefined) continue
    value += (POWER_STAT_WEIGHTS[k as AnyStatKey] ?? 0) * raw
  }
  return value
}

/** a 是否严格强于 b(真实战力为主,同分回退到粗排 —— 不两败打转) */
function stronger(a: EquipmentInstance, b: EquipmentInstance): boolean {
  const pa = equippablePower(a)
  const pb = equippablePower(b)
  if (pa !== pb) return pa > pb
  return betterEquip(a, b)
}

/** 旧序的粗排(品质 → 层级 → 强化 → 词条成色)。现作「同战力」的稳定裁决 */
export function betterEquip(a: EquipmentInstance, b: EquipmentInstance): boolean {
  const qa = qualityRank(a)
  const qb = qualityRank(b)
  if (qa !== qb) return qa > qb
  if (a.tier !== b.tier) return a.tier > b.tier
  if (a.level !== b.level) return a.level > b.level
  return rollSum(a) > rollSum(b)
}

/** 该槽该穿的最强一件(该槽无任何可穿戴时返回 null) */
export function bestEquipFor(slot: EquipSlot): EquipmentInstance | null {
  const inventory = useInventoryStore()
  const pool = inventory.items.filter(i => equipmentTemplate(i.templateId)?.slot === slot)
  if (pool.length === 0) return null
  return pool.reduce((a, b) => (stronger(b, a) ? b : a))
}

/** 一键换装单槽:换上最强一件,已是则不动。返回是否真的换了 */
export function equipBestFor(slot: EquipSlot): boolean {
  const inventory = useInventoryStore()
  const best = bestEquipFor(slot)
  if (!best) return false
  if (inventory.equipped[slot] === best.uid) return false
  inventory.equip(best.uid, slot)
  return true
}

/** 一键换装全部可穿槽(法宝另走 equippedArtifacts,不在这九个里) */
export function equipAllBest(): number {
  let changed = 0
  for (const slot of SLOT_COURIER) {
    if (equipBestFor(slot)) changed += 1
  }
  return changed
}

/**
 * 一键穿齐某共鸣套。每槽换上该套**已持有里最强**的一件(真实战力为主,同分
 * 回退粗排);已穿的那件更强就不动 —— 穿套装绝不降级。返回换上几件。
 */
export function equipSetCombo(setId: string): number {
  const inventory = useInventoryStore()
  const bestPerSlot = new Map<EquipSlot, EquipmentInstance>()
  for (const it of inventory.items) {
    const tpl = equipmentTemplate(it.templateId)
    if (!tpl || tpl.set !== setId) continue
    const cur = bestPerSlot.get(tpl.slot)
    if (!cur || stronger(it, cur)) bestPerSlot.set(tpl.slot, it)
  }
  let changed = 0
  for (const [slot, piece] of bestPerSlot) {
    if (inventory.equipped[slot] === piece.uid) continue
    const occupant = inventory.equipped[slot] ? inventory.findItem(inventory.equipped[slot]!) : undefined
    if (occupant && stronger(occupant, piece)) continue
    inventory.equip(piece.uid, slot)
    changed += 1
  }
  return changed
}
