/**
 * 妖气复聚 —— 一条世界节律的两头:旧主归来,与它归来之后能拿回什么
 *
 * 设计口径(见 core/regionRevival 的头注):
 *   一 钟从「最后一次与这片地界打交道」(战斗 / 镇压)起算,72 小时;
 *   二 够钟 → 该地界不再「已靖」,旧主归来(下一战即是它),镇压随之松开;
 *   三 不惩罚挂机:镇压资格永久,一键即可把收益接回来;「已靖」要再打一次才拿回;
 *   四 首领认知门槛按「见到它的机会」定档 —— 三次交手即洞悉(从前是 28 次,永远够不着)。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAdventureStore } from '@/stores/adventure'
import { usePlayerStore } from '@/stores/player'
import { useLoreStore } from '@/stores/lore'
import { settleRegionRevivals } from './regionRevival'
import { settleSuppressedRegions } from './suppress'
import { winsUntilRegionBoss } from './exploration'
import { ENEMY_LORE_BOSS_THRESHOLDS, ENEMY_LORE_THRESHOLDS, noteEnemy } from './loreService'
import { REVIVE_AFTER_HOURS } from './worldMemory'
import { ENEMIES } from '@/data/enemies'

const HOUR = 3600_000

/** 造一份"人间界已靖"的档:某处地界已靖、最后一次在那儿战斗是 hoursAgo 小时前 */
function clearedRegion(regionId: string, hoursAgo: number, opts: { suppressed?: boolean; clearedAt?: number } = {}) {
  const adventure = useAdventureStore()
  const player = usePlayerStore()
  const at = Date.now() - hoursAgo * HOUR
  adventure.cleared = [regionId]
  adventure.clearedAt = { [regionId]: opts.clearedAt ?? at }
  adventure.unlocked = [regionId]
  player.regionStats = {
    [regionId]: { totalFights: 12, avgRounds: 2, avgDamageTakenPct: 0.02, consecutiveWins: 12, lastUpdateAt: at }
  }
  if (opts.suppressed) {
    player.suppressedRegions = [regionId]
    player.suppressQualified = [regionId]
    player.suppressedSince = { [regionId]: at }
  }
  return { adventure, player }
}

describe('妖气复聚 · 旧主归来', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('已靖的地界放置超过 72 小时 → 旧主归来(不再已靖),下一战即是它', () => {
    const { adventure } = clearedRegion('hongmeng', REVIVE_AFTER_HOURS + 1)
    const returned = settleRegionRevivals()
    expect(returned).toEqual(['hongmeng'])
    expect(adventure.cleared).not.toContain('hongmeng')
    expect(adventure.revived).toContain('hongmeng')
    // 累计胜场早已过门槛,故归来之后下一战就是首领 —— 不必再刷十场
    expect(winsUntilRegionBoss(12, adventure.cleared.includes('hongmeng'))).toBe(0)
  })

  it('常去的地方妖气聚不起来:最近还打过就不复聚', () => {
    const { adventure } = clearedRegion('hongmeng', REVIVE_AFTER_HOURS - 1)
    expect(settleRegionRevivals()).toEqual([])
    expect(adventure.cleared).toContain('hongmeng')
    expect(adventure.revived).toEqual([])
  })

  it('钟按「最后一次打交道」算:守着不动的镇压,72 小时照样松', () => {
    const { adventure, player } = clearedRegion('hongmeng', REVIVE_AFTER_HOURS + 1, { suppressed: true })
    settleRegionRevivals()
    expect(player.suppressedRegions).toEqual([])
    expect(adventure.revived).toContain('hongmeng')
  })

  it('不惩罚挂机:复聚只收走「已靖」,镇压资格仍在 —— 一键就能把收益接回来', () => {
    const { player } = clearedRegion('hongmeng', REVIVE_AFTER_HOURS + 1, { suppressed: true })
    settleRegionRevivals()
    expect(player.suppressedRegions).toEqual([])
    expect(player.suppressQualified).toContain('hongmeng')
    player.suppressRegion('hongmeng')
    expect(player.suppressedRegions).toContain('hongmeng')
  })

  it('复聚过的不重复复聚(幂等);镇压中未靖的地界,够钟照样松开', () => {
    const { adventure, player } = clearedRegion('hongmeng', REVIVE_AFTER_HOURS + 1)
    expect(settleRegionRevivals()).toEqual(['hongmeng'])
    expect(settleRegionRevivals()).toEqual([])
    // 玩家没再靖就先把收益接回来 → 够钟时该松的仍然松
    player.suppressRegion('hongmeng')
    player.suppressedSince = { hongmeng: Date.now() - (REVIVE_AFTER_HOURS + 1) * HOUR }
    expect(settleRegionRevivals()).toEqual([])
    expect(player.suppressedRegions).toEqual([])
    expect(adventure.revived).toContain('hongmeng')
  })

  it('从未靖也没镇压的地界不参与(没有妖气可聚)', () => {
    const adventure = useAdventureStore()
    adventure.cleared = []
    adventure.unlocked = ['qingyun']
    expect(settleRegionRevivals()).toEqual([])
    expect(adventure.revived).toEqual([])
  })

  it('再靖一次即复「已靖」:复聚状态随之收掉,且重新起钟(不会立刻又复聚)', () => {
    const { adventure } = clearedRegion('hongmeng', REVIVE_AFTER_HOURS + 1)
    settleRegionRevivals()
    expect(adventure.markCleared('hongmeng')).toBe(true)
    expect(adventure.cleared).toContain('hongmeng')
    expect(adventure.revived).not.toContain('hongmeng')
    // 旧钟(72 小时前那一次)不许跟过来 —— 已靖即起新钟
    expect(settleRegionRevivals()).toEqual([])
  })

  it('离线斩下的首领也算数:已靖时刻落在 markCleared 上,不靠区域统计', () => {
    const adventure = useAdventureStore()
    const player = usePlayerStore()
    // Even with empty regionStats, markCleared must start the revival clock.
    player.regionStats = {}
    adventure.cleared = []
    adventure.unlocked = ['hongmeng']
    adventure.markCleared('hongmeng')
    expect(settleRegionRevivals()).toEqual([])
    expect(adventure.cleared).toContain('hongmeng')
  })

  it('坏档:复聚表里有生 id 或与已靖冲突的项,读档时按"已靖为准"修形', () => {
    const { adventure } = clearedRegion('hongmeng', 1)
    adventure.revived = ['hongmeng', 'nonsense_place'] as string[]
    adventure.sanitize()
    expect(adventure.revived).toEqual([])
  })

  /**
   * 接线判据 —— 复聚必须真被引擎走到,而不是只在单元里喊得响。
   *
   * 入库前的故障注入正是死在这里:把 settleSuppressedRegions 里那次结算摘掉,
   * 上面的用例一条都不红 —— 因为它们都直接调 settleRegionRevivals。
   * 而在线每 tick(engine.advance)与离线结算(settleOffline)走的都是
   * settleSuppressedRegions,那才是复聚真正被触发的那条路。
   */
  it('接线:镇压收益结算是复聚的入口(在线每 tick 与离线共用这一条)', () => {
    const { adventure } = clearedRegion('hongmeng', REVIVE_AFTER_HOURS + 1)
    settleSuppressedRegions(3600)
    expect(adventure.revived).toContain('hongmeng')
    expect(adventure.cleared).not.toContain('hongmeng')
  })

  it('复聚要跟着收益一起回给调用方 —— 归来卷轴得写得出这一行', () => {
    const { adventure } = clearedRegion('hongmeng', REVIVE_AFTER_HOURS + 1)
    const out = settleSuppressedRegions(3600)
    expect(out?.revived).toEqual(['hongmeng'])
    // 一处镇压都没有、只有复聚时,也要把话带出去(不能因为"没收益"就吞掉)
    expect(out).not.toBeNull()
    expect(adventure.revived).toContain('hongmeng')
  })
})

describe('妖气复聚 · 首领认知门槛', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  const boss = ENEMIES.find(e => e.isBoss)!

  it('首领三次交手即洞悉(门槛按"见到它的机会"定,不按复杂度)', () => {
    expect(ENEMY_LORE_BOSS_THRESHOLDS).toEqual([0, 1, 2, 3])
    expect(ENEMY_LORE_BOSS_THRESHOLDS[3]).toBeLessThan(ENEMY_LORE_THRESHOLDS[3]!)
    const lore = useLoreStore()
    noteEnemy(boss.id, true)
    expect(lore.enemyLoreOf(boss.id)).toBe(1)
    noteEnemy(boss.id, true)
    expect(lore.enemyLoreOf(boss.id)).toBe(2)
    noteEnemy(boss.id, true)
    expect(lore.enemyLoreOf(boss.id)).toBe(3)
    // 到此为止:普通敌人仍要 14 场,首领不再需要 28 场
    expect(lore.enemyLoreOf(boss.id)).toBeLessThanOrEqual(ENEMY_LORE_THRESHOLDS.length - 1)
  })

  it('三次交手不是一夜凑齐:一场只进一层(时间跨度由复聚的钟给)', () => {
    const lore = useLoreStore()
    const seen = vi.spyOn(lore, 'markEnemySeen')
    noteEnemy(boss.id, true)
    expect(seen).toHaveBeenCalledTimes(1)
    expect(lore.enemyLoreOf(boss.id)).toBe(1)
  })
})
