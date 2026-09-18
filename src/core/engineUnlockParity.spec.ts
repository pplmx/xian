/**
 * 成就解锁对账 —— "一次性解锁"搬进库之后,解几枚、按什么顺序、发什么,一位不差。
 *
 * 与 engineParity 同一条纪律:`legacyScan` / `legacyUnlock` 是**迁移前那两段实现的原样
 * 冻结**(`core/progress.checkAchievements` 的扫描 + `unlockAchievement` 的去重与发奖),
 * 与现在的实现(库的登记簿 + 扫描)在同一组玩家状态下各跑一遍,比三件事:
 *   ① 新解锁了哪几枚、按什么顺序;② 成就表本身;③ 提示语与顺序(「成就达成「…」」)。
 *
 * 条件的判定本身不在这份对账里 —— 那是 `goals` 那一层的事(见 engineParity 与
 * questProgress.spec),两边都用同一份 `evalCond`,这里比的是**解锁的记账**。
 *
 * 另钉一条口径:**显式解锁也要去重** —— 状态型成就(寿元告急 / 灵石百万)由周期检查
 * 每拍触发,少了去重就会每拍发一次奖;迁移前这份去重在 store 里,现在收进库的登记簿。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ACHIEVEMENTS } from '@/data/achievements'
import { checkAchievements, checkCustomAchievement, checkQualityAchievement, evalCond, trackRealm } from './progress'
import { achievementStateOf, scanAchievements } from './engineUnlocks'
import { formatExact } from '@/utils/format'
import { usePlayerStore } from '@/stores/player'
import { useQuestsStore } from '@/stores/quests'
import { useResourcesStore } from '@/stores/resources'
import { useUiStore } from '@/stores/ui'

/** 迁移前的扫描(冻结):跳过已解开、品质型与"状态型 custom" */
function legacyScan(achieved: readonly string[]): string[] {
  const newly: string[] = []
  for (const def of ACHIEVEMENTS) {
    if (achieved.includes(def.id)) continue
    if (def.cond.type === 'quality') continue
    if (def.cond.type === 'custom' && !/^realm_\d+_\d+$/.test(def.cond.key)) continue
    if (evalCond(def.cond)) newly.push(def.id)
  }
  return newly
}

/** 迁移前的显式解锁(冻结):认不出或已解开都不发 */
function legacyUnlock(achieved: readonly string[], id: string): boolean {
  const def = ACHIEVEMENTS.find(a => a.id === id)
  return !!def && !achieved.includes(id)
}

/** 造一个档次不同的玩家:境界 + 各类计数 */
function shapePlayer(major: number, counters: Record<string, number> = {}, sub = 0): void {
  usePlayerStore().major = major
  usePlayerStore().sub = sub
  useQuestsStore().counters = { ...counters }
}

/** 把 ACHIEVEMENTS 里出现过的计数键都给足,用来一口气满足很多枚 */
function richCounters(value = 1e6): Record<string, number> {
  const out: Record<string, number> = {}
  for (const def of ACHIEVEMENTS) if (def.cond.type === 'counter') out[def.cond.key] = value
  return out
}

const toasts: string[] = []

beforeEach(() => {
  setActivePinia(createPinia())
  toasts.length = 0
  vi.spyOn(useUiStore(), 'toast').mockImplementation(msg => void toasts.push(msg))
})

describe('成就解锁对账 —— 解几枚、按什么顺序、发什么', () => {
  const scenarios: [string, number, Record<string, number>, number][] = [
    ['刚开局(炼气境)', 0, {}, 0],
    ['炼气一层 + 少量计数', 0, { kills: 3 }, 0],
    ['境界拉满 + 计数给足', 20, richCounters(), 9],
    ['小层圆满那类(custom realm_x_y)也要认', 0, {}, 9]
  ]

  for (const [label, major, counters, sub] of scenarios) {
    it(`${label}:新解锁的条目与顺序和冻结口径一致`, () => {
      shapePlayer(major, counters, sub)
      const quests = useQuestsStore()
      const frozen = legacyScan(quests.achieved)
      checkAchievements()
      expect(quests.achieved, label).toEqual(frozen)
      expect(toasts, label).toEqual(frozen.map(id => `成就达成「${ACHIEVEMENTS.find(a => a.id === id)!.name}」`))
    })
  }

  it('扫描与登记簿同源:库挑出的条目就是本作解开的那些', () => {
    shapePlayer(20, richCounters())
    const quests = useQuestsStore()
    const out = scanAchievements(achievementStateOf(quests.achieved), def => {
      if (def.cond.type === 'quality') return false
      if (def.cond.type === 'custom' && !/^realm_\d+_\d+$/.test(def.cond.key)) return false
      return evalCond(def.cond)
    })
    expect(out.newly.map(def => def.id)).toEqual(legacyScan(quests.achieved))
    checkAchievements()
    expect(quests.achieved).toEqual(out.state.unlocked)
  })

  it('重复扫描不重复发奖:第二次一枚都不解,奖励与战报都不再增加', () => {
    shapePlayer(20, richCounters())
    const quests = useQuestsStore()
    const resources = useResourcesStore()
    checkAchievements()
    const afterFirst = [...quests.achieved]
    const stone = formatExact(resources.spiritStone)
    const toastCount = toasts.length
    expect(afterFirst.length).toBeGreaterThan(0)
    checkAchievements()
    checkAchievements()
    expect(quests.achieved).toEqual(afterFirst)
    expect(formatExact(resources.spiritStone)).toBe(stone)
    expect(toasts.length).toBe(toastCount)
  })

  it('显式解锁也去重:状态型成就每拍来敲门,也只发一次奖', () => {
    const quests = useQuestsStore()
    const resources = useResourcesStore()
    const key = ACHIEVEMENTS.map(a => a.cond)
      .filter((c): c is { type: 'custom'; key: string } => c.type === 'custom')
      .map(c => c.key)
      .find(k => !/^realm_\d+_\d+$/.test(k))
    if (!key) return // 这一版内容没有状态型成就
    checkCustomAchievement(key)
    const after = [...quests.achieved]
    const stone = formatExact(resources.spiritStone)
    const toastCount = toasts.length
    expect(after.length).toBeGreaterThan(0)
    for (let i = 0; i < 20; i += 1) checkCustomAchievement(key)
    expect(quests.achieved).toEqual(after)
    expect(toasts.length).toBe(toastCount)
    expect(formatExact(resources.spiritStone)).toBe(stone)
  })

  it('品质型成就:由装备品质显式触发,重复调用每枚只报一次', () => {
    const quests = useQuestsStore()
    const ranks = ACHIEVEMENTS.filter(a => a.cond.type === 'quality').map(a => (a.cond as { rank: number }).rank)
    if (ranks.length === 0) return // 这一版内容没有品质型成就
    checkQualityAchievement(Math.min(...ranks))
    const after = [...quests.achieved]
    expect(after.length).toBeGreaterThan(0)
    checkQualityAchievement(Math.max(...ranks))
    checkQualityAchievement(Math.max(...ranks) + 99)
    expect(new Set(toasts).size).toBe(toasts.length) // 一枚只报一次喜
    expect(quests.achieved.length).toBeGreaterThanOrEqual(after.length)
    expect(quests.achieved.slice(0, after.length)).toEqual(after)
  })

  it('境界型:trackRealm 与自动扫描共用同一份账(不重复解、不重复发)', () => {
    shapePlayer(3, {})
    const quests = useQuestsStore()
    const resources = useResourcesStore()
    trackRealm()
    const after = [...quests.achieved]
    const stone = formatExact(resources.spiritStone)
    trackRealm()
    checkAchievements()
    expect(quests.achieved).toEqual(after)
    expect(formatExact(resources.spiritStone)).toBe(stone)
  })

  it('认不出的 id 不当成解锁:伪造一枚不存在的成就不会进账', () => {
    const quests = useQuestsStore()
    const before = [...quests.achieved]
    expect(legacyUnlock(before, '根本没有这枚')).toBe(false)
    checkCustomAchievement('根本没有这个状态键')
    expect(quests.achieved).toEqual(before)
    expect(toasts).toEqual([])
  })
})
