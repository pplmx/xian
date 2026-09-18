/**
 * 灵脉服务 —— Phase 30.3
 * 投点规则:总容量 100;主脉独占 70;副脉各 ≤30。
 * 主脉可迁移(付费换向),已投点数不回收——方向选择有代价但不锁死。
 *
 * 规则本身已搬进公共库(`core/engineVeins` 是接入层):这里只留"要花多少灵石、
 * 钱够不够、要不要提示"。判定顺序与文案(含"未开放时不吭声")都在接入层里。
 */
import type { GNum } from '@/types'
import type { VeinId } from '@/data/veins'
import { veinDef } from '@/data/veins'
import { VEIN_UNLOCK_MAJOR } from '@/data/constants'
import {
  investVeinIn,
  switchVeinMainIn,
  veinCapOf,
  veinPointCostAt,
  veinStateOf,
  veinSwitchCostAt
} from './engineVeins'
import { playerTier } from './progress'
import { usePlayerStore } from '@/stores/player'
import { useDongfuStore } from '@/stores/dongfu'
import { useResourcesStore } from '@/stores/resources'
import { useUiStore } from '@/stores/ui'

/** 灵脉是否开放(金丹起) */
export function veinsUnlocked(): boolean {
  return usePlayerStore().major >= VEIN_UNLOCK_MAJOR
}

/** 某条脉当前可投上限 */
export function veinCap(id: VeinId): number {
  const dongfu = useDongfuStore()
  return veinCapOf(veinStateOf(dongfu.veinPoints, dongfu.veinMain), id)
}

/** 单点投资成本(按玩家当前层级) */
export function veinPointCost(): GNum {
  return veinPointCostAt(playerTier())
}

/** 主脉迁移费 */
export function veinSwitchCost(): GNum {
  return veinSwitchCostAt(playerTier())
}

/**
 * 向某条脉投一点。
 * 未定主脉时,首次投点的脉自动成为主脉。
 */
export function investVein(id: VeinId): boolean {
  const dongfu = useDongfuStore()
  const resources = useResourcesStore()
  const ui = useUiStore()
  const info = investVeinIn(veinStateOf(dongfu.veinPoints, dongfu.veinMain), id, {
    major: usePlayerStore().major,
    tier: playerTier()
  })
  if (!info.can) {
    // 空字符串 = 这个门槛不该打扰玩家(未开放就是这样)
    if (info.reason !== '') ui.toast(info.reason, 'warn')
    return false
  }
  const cost = info.costs[0]!.amount
  if (!resources.hasStone(cost)) {
    ui.toast('灵石不足', 'warn')
    return false
  }
  resources.spendStone(cost)
  // 整份写回:点数 + 主脉(首投自动认主由库决定,投成功才认)
  dongfu.setVeinState(info.state)
  return true
}

/** 迁移主脉:付费换向;原主脉点数保留(超出副脉上限的部分不再可投,但效果不失) */
export function switchMainVein(id: VeinId): boolean {
  const dongfu = useDongfuStore()
  const resources = useResourcesStore()
  const ui = useUiStore()
  const info = switchVeinMainIn(veinStateOf(dongfu.veinPoints, dongfu.veinMain), id, {
    major: usePlayerStore().major,
    tier: playerTier()
  })
  // 未开放 / 已经在主位:静默(迁移前也是不提示)
  if (!info.can) return false
  const cost = info.costs[0]!.amount
  if (!resources.hasStone(cost)) {
    ui.toast('灵石不足,迁脉非小事', 'warn')
    return false
  }
  resources.spendStone(cost)
  dongfu.setVeinState(info.state)
  ui.toast(`主脉改走「${veinDef(id).name}」`, 'success')
  return true
}
