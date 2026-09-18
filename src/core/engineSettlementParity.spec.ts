/**
 * 结算回执对账 —— "本次所得"必须是一个**真的加到账本上的数**。
 *
 * 这条判据盯的是一个真实翻过车的现象:历练会话从前自己按 `stoneByTier(tier, 10×模式倍率)`
 * 记了一份"本次所得",漏了福缘(翻倍)、区域事件与首领倍率 —— 于是界面写"本次所得 120",
 * 而玩家回背包只多了 100,追问也没人答得上来。
 *
 * 现在 `afterWin` 返回的 `stone` 直接取自落账时的**实际发生额**(库的 settlement 回执)。
 * 这里把可验证的那条钉住:**回执里的数,必须在这次结算给账本的进项里出现过** ——
 * 谁哪天又"顺手另算一份期望值",这条会先红。
 *
 * (不与"钱包净增量"直接比:同一次结算里成就解锁、装备化尘折返都会另外进账,
 *  那是别的账,不是"这一笔奖励"。)
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { afterWin } from './loot'
import { regionDef } from '@/data/regions'
import { usePlayerStore } from '@/stores/player'
import { useResourcesStore } from '@/stores/resources'
import { useInventoryStore } from '@/stores/inventory'
import { useSettingsStore } from '@/stores/settings'
import { stoneByTier } from './formulas'
import { rng } from '@/utils/random'
import { formatExact } from '@/utils/format'
import { sub } from '@/utils/gnum'
import { modOf } from './statsCalc'

/**
 * 把这一场变成完全确定的:概率全不中(于是只有灵石这一笔进项)、浮动取 1。
 * 这样"账本增量"就等于"这一笔奖励",同源与否一测便知。
 */
function freezeBattle(): void {
  useSettingsStore().decomposeRanks = []
  useSettingsStore().smartKeep.enabled = false
  useInventoryStore().items = []
  vi.spyOn(rng, 'chance').mockReturnValue(false)
  vi.spyOn(rng, 'float').mockReturnValue(1)
  vi.spyOn(rng, 'int').mockReturnValue(1)
}

describe('结算回执对账 —— "本次所得"与账本实际增量', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    usePlayerStore().initCharacter('同源校验', { roots: [] } as never)
  })

  it('给定随机值:回执 = 冻结公式算出的那一笔 = 账本实际增量', () => {
    const resources = useResourcesStore()
    const region = regionDef('qingyun')!
    // 首领那一档另有一笔:保底装备会带出成就解锁,成就奖励也进账本 —— 那是别的账,
    // 故首领只比"回执 = 冻结公式"(普通档才比"回执 = 账本增量")。
    const cases: [string, number, boolean, boolean][] = [
      ['普通战斗', 1, false, true],
      ['首领战', 1, true, false],
      ['倍率 1.9 的路线', 1.9, false, true],
      ['首领 + 高倍率', 1.4, true, false]
    ]
    for (const [label, rewardMult, isBoss, sameAsLedger] of cases) {
      freezeBattle()
      const before = { ...resources.spiritStone }
      const summary = afterWin(region, rewardMult, isBoss)
      const actual = sub(resources.spiritStone, before)
      // 冻结口径(迁移前的算法):灵石 = stoneByTier(层级, 10 × 浮动 × 倍率 × 首领 × 翻倍 × 增益)
      const gain = 1 + modOf(usePlayerStore().finalStats.mods, 'spiritStoneGain')
      const expected = stoneByTier(region.tier, 10 * 1 * rewardMult * (isBoss ? 4 : 1) * 1 * gain)
      expect(formatExact(summary.stone), `${label} 的回执`).toBe(formatExact(expected))
      if (sameAsLedger) {
        // 同源:回执里的数就是账本里多出来的那一笔(这一档没有别的进项)
        expect(formatExact(actual), `${label} 的账本增量`).toBe(formatExact(summary.stone))
      }
    }
    vi.restoreAllMocks()
  })

  it('翻倍(福缘深厚)时也一样:翻倍只改这一场的量,不改"同源"', () => {
    const resources = useResourcesStore()
    const region = regionDef('qingyun')!
    freezeBattle()
    // 让"翻倍判定"命中(它是这次结算里的第一次 chance 调用)
    vi.mocked(rng.chance).mockReturnValueOnce(true).mockReturnValue(false)
    const before = { ...resources.spiritStone }
    const summary = afterWin(region, 1, false)
    const actual = sub(resources.spiritStone, before)
    expect(summary.lines.some(line => line.includes('翻倍'))).toBe(true)
    const expected = stoneByTier(region.tier, 10 * 1 * 1 * 1 * 2 * (1 + modOf(usePlayerStore().finalStats.mods, 'spiritStoneGain')))
    expect(formatExact(summary.stone)).toBe(formatExact(expected))
    expect(formatExact(actual)).toBe(formatExact(summary.stone))
    vi.restoreAllMocks()
  })

  it('这一笔不会是 0,也不会在别处再算一次(账本增量恰好等于回执)', () => {
    const resources = useResourcesStore()
    freezeBattle()
    const before = { ...resources.spiritStone }
    const summary = afterWin(regionDef('qingyun')!, 1, false)
    expect(formatExact(summary.stone)).not.toBe('0')
    expect(formatExact(sub(resources.spiritStone, before))).toBe(formatExact(summary.stone))
    vi.restoreAllMocks()
  })
})
