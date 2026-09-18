/**
 * 装备共鸣(Phase 31.0 S5)
 *
 * 不是数值堆叠式的套装(2件+10%):同组多件触发**机制效果**,
 * 成为 Build 组件(如:铁壁 = 首次致命伤保留 1 点气血)。
 * 组内装备要求件数宽松(挂载中的同 set 件数 ≥2 即共鸣)。
 */
import type { EquipmentInstance } from '@/types'
import type { EquipmentInstance as EngineEquipmentInstance } from '@engine/index'
import { equipmentTemplate } from '@/data/equipment'
import type { EquipSetDef } from '@/data/equipSets'
import { equipSetDef } from '@/data/equipSets'
import { ENGINE_WORLD } from './engineWorld'
import { toEngineInstance } from './equipGen'

// 内容住在 data/equipSets(装配与查询都要读),这里原样转出,调用方不必改 import
export type { EquipSetDef } from '@/data/equipSets'
export { EQUIP_SETS, equipSetDef } from '@/data/equipSets'

/** astral 共鸣:开战时护盾 = 最大生命的 5%(并入快照盾 mod,共三层同一常量) */
export const ASTRAL_SET_SHIELD = 0.05

/**
 * 已装备件 → 库的装配输入(槽位 → uid + uid → 实例)。
 *
 * 「同组几件、哪些 hook 生效」这条规则由库的装备系统算
 * (见 ENGINE_WORLD.equipment.resolveLoadout);本文件只留**内容**:
 * 共鸣叫什么、机制文案是什么、hook 是哪一个。
 */
function loadoutOf(equipped: EquipmentInstance[]): {
  loadout: { equipped: Record<string, string | undefined> }
  byUid: Map<string, EngineEquipmentInstance>
} {
  const byUid = new Map<string, EngineEquipmentInstance>(equipped.map(it => [it.uid, toEngineInstance(it)]))
  const slots: Record<string, string> = {}
  for (const it of equipped) {
    const tpl = equipmentTemplate(it.templateId)
    if (tpl) slots[tpl.slot] = it.uid
  }
  return { loadout: { equipped: slots }, byUid }
}

/** 已装备件中,同 set 的件数统计 */
export function setCounts(equipped: EquipmentInstance[]): Map<string, number> {
  const { loadout, byUid } = loadoutOf(equipped)
  const stats = ENGINE_WORLD.equipment.resolveLoadout(loadout, byUid)
  return new Map(stats.sets.map(s => [s.id, s.pieces]))
}

/** 当前激活的共鸣(件数达标)列表 */
export function activeSets(equipped: EquipmentInstance[]): EquipSetDef[] {
  const { loadout, byUid } = loadoutOf(equipped)
  const stats = ENGINE_WORLD.equipment.resolveLoadout(loadout, byUid)
  const out: EquipSetDef[] = []
  for (const set of stats.sets) {
    const def = equipSetDef(set.id)
    // 库给出的 active 里带着生效的 hook;本作的共鸣定义恰好一条 hook,对上才算激活
    if (def && set.active.some(a => a.hook === def.hook)) out.push(def)
  }
  return out
}

/** 是否已激活指定机制(供战斗引擎查) */
export function hasActiveSet(equipped: EquipmentInstance[], hook: EquipSetDef['hook']): boolean {
  return activeSets(equipped).some(s => s.hook === hook)
}
