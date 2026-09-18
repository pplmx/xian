/**
 * 功法服务 —— 参悟 / 习得 / 升级
 */
import { rng } from '@/utils/random'
import { GONGFA, gongfaDef } from '@/data/gongfa'
import { qualityDef } from '@/data/qualities'
import { COMPREHEND_PAGE_COST } from '@/data/constants'
import { GONGFA_SYSTEM } from './engineWorld'
import { gongfaAffinity, rootElements } from './linggenAffinity'
import { collect, track } from './progress'
import { usePlayerStore } from '@/stores/player'
import { useResourcesStore } from '@/stores/resources'
import { useCultivationStore } from '@/stores/cultivation'
import { useDongfuStore } from '@/stores/dongfu'
import { useUiStore } from '@/stores/ui'

/** 随机习得一部功法(事件/掉落),返回功法名;无可学返回 null */
export function learnRandomGongfa(specificId?: string): string | null {
  const player = usePlayerStore()
  const cultivation = useCultivationStore()
  if (specificId) {
    const def = gongfaDef(specificId)
    if (def && cultivation.learn(specificId)) {
      collect('gongfa', specificId)
      track('gongfaLearned')
      return def.name
    }
    return null
  }
  const pool = GONGFA.filter(g => g.minRealm <= player.major + 1 && !cultivation.learned[g.id])
  if (pool.length === 0) return null
  // Phase 32.2:同源功法更容易参悟到(倾向,非独占)——
  // 无对应灵根者权重仍为原值,任何功法都拿得到,只是撞见的概率不同。
  const elements = rootElements(player.linggen?.roots)
  const picked = rng.weighted(pool, g => (100 / (1 + qualityDef(g.quality).rank * 1.5)) * gongfaAffinity(g.element, elements))
  cultivation.learn(picked.id)
  collect('gongfa', picked.id)
  track('gongfaLearned')
  return picked.name
}

/** 藏经阁参悟:消耗残页随机习得 */
export function comprehendGongfa(): boolean {
  const resources = useResourcesStore()
  const ui = useUiStore()
  if (!resources.hasSmall('page', COMPREHEND_PAGE_COST)) {
    ui.toast('功法残页不足', 'warn')
    return false
  }
  const player = usePlayerStore()
  const cultivation = useCultivationStore()
  const pool = GONGFA.filter(g => g.minRealm <= player.major + 1 && !cultivation.learned[g.id])
  if (pool.length === 0) {
    ui.toast('当前境界的功法已尽数参悟', 'info')
    return false
  }
  resources.spendSmall('page', COMPREHEND_PAGE_COST)
  const name = learnRandomGongfa()
  if (name) {
    ui.toast(`残卷拼合,你参悟出《${name}》`, 'rare')
    return true
  }
  return false
}

/** 功法升级消耗 */
export function gongfaUpgradeCost(id: string): { wudao: number; page: number } | null {
  const cultivation = useCultivationStore()
  const def = gongfaDef(id)
  const lv = cultivation.learned[id]
  if (!def || !lv || lv >= def.maxLevel) return null
  // 寒冥灵脉:参悟悟道点折扣(Phase 30.3)
  const discount = Math.min(0.5, useDongfuStore().insightDiscount)
  // 消耗曲线由公共库算(见 core/engineWorld 的 GONGFA_SYSTEM):
  // 悟道点 = 基数 × 倍率^等级 ×(1-折扣);残页 = 等级 ×(1 + 品质序 × 0.5),下限 1
  const costs = GONGFA_SYSTEM.costAt(id, lv, { discount })
  return {
    wudao: costs.find(c => c.key === 'wudao')?.amount ?? 0,
    page: costs.find(c => c.key === 'page')?.amount ?? 0
  }
}

export function upgradeGongfa(id: string): boolean {
  const resources = useResourcesStore()
  const cultivation = useCultivationStore()
  const ui = useUiStore()
  const cost = gongfaUpgradeCost(id)
  if (!cost) return false
  if (!resources.hasSmall('wudao', cost.wudao) || !resources.hasSmall('page', cost.page)) {
    ui.toast('悟道点或残页不足', 'warn')
    return false
  }
  resources.spendSmall('wudao', cost.wudao)
  resources.spendSmall('page', cost.page)
  cultivation.upgrade(id)
  const def = gongfaDef(id)
  ui.toast(`《${def?.name}》修炼至第 ${cultivation.learned[id]} 层`, 'success')
  return true
}
