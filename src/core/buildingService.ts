/**
 * 洞府建筑服务 —— 升级
 */
import type { BuildingId, GNum } from '@/types'
import { buildingDef } from '@/data/buildings'
import { gnZero } from '@/utils/gnum'
import { buildingUpgradeInfoOf } from './engineFacilities'
import { track } from './progress'
import { usePlayerStore } from '@/stores/player'
import { useResourcesStore } from '@/stores/resources'
import { useDongfuStore } from '@/stores/dongfu'
import { useUiStore } from '@/stores/ui'

export interface BuildingUpgradeInfo {
  canUpgrade: boolean
  reason: string
  stone: GNum
  ore: number
  nextLevel: number
}

export function buildingUpgradeInfo(id: BuildingId): BuildingUpgradeInfo {
  const dongfu = useDongfuStore()
  const player = usePlayerStore()
  // 门槛、上限与费用出自库的同一次判定(core/engineFacilities 里是本作的顺序与文案)
  const info = buildingUpgradeInfoOf(id, dongfu.levels, player.major)
  return {
    canUpgrade: info.can,
    reason: info.reason,
    stone: (info.costs.find(c => c.key === 'stone')?.amount ?? gnZero()) as GNum,
    ore: (info.costs.find(c => c.key === 'ore')?.amount ?? 0) as number,
    nextLevel: info.nextLevel
  }
}

export function upgradeBuilding(id: BuildingId): boolean {
  const dongfu = useDongfuStore()
  const resources = useResourcesStore()
  const ui = useUiStore()
  const def = buildingDef(id)!
  const info = buildingUpgradeInfo(id)
  if (!info.canUpgrade) {
    ui.toast(info.reason, 'warn')
    return false
  }
  if (!resources.hasStone(info.stone) || !resources.hasSmall('ore', info.ore)) {
    ui.toast('灵石或玄铁不足', 'warn')
    return false
  }
  resources.spendStone(info.stone)
  resources.spendSmall('ore', info.ore)
  dongfu.setLevel(id, info.nextLevel)
  track('buildingUpgrades')
  ui.toast(`${def.name}升至 ${info.nextLevel} 级`, 'success')
  return true
}
