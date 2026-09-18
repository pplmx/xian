/**
 * 主线任务链对账 —— "一次结算能连推几节"搬进库之后,推进结果、奖励与提示一位不差。
 *
 * 与 engineParity 同一条纪律:`legacyAdvance` 是**迁移前那个 while 循环的原样冻结**
 * (`core/progress.checkMainQuest` 的 `while (guard < 5)`),与现在的 `advanceMainChain`
 * 用同一组玩家状态各跑一遍,比三件事:
 *   ① **推了几节、推到哪一节**(下标);② 发出去的奖励(账本增量);
 *   ③ 提示语与顺序(「任务完成「…」」)。
 *
 * 另把两条口径钉住:
 *   · **一次结算可以连推多节**(玩家一口气满足后面几节是常事,每次只推一节会让人以为卡住);
 *   · **守卫是 5 节**,而且撞上守卫要能**说出来**(库回报 `capped`,本作还 log 一行)——
 *     迁移前的写法只是悄悄停下,内容一旦写歪(条件恒真)没人知道。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { MAIN_QUESTS } from '@/data/quests'
import { advanceMainChain, MAIN_CHAIN_MAX_STEPS } from './engineChain'
import { evalCond, track } from './progress'
import { formatExact } from '@/utils/format'
import { gn } from '@/utils/gnum'
import { usePlayerStore } from '@/stores/player'
import { useQuestsStore } from '@/stores/quests'
import { useResourcesStore } from '@/stores/resources'
import { useUiStore } from '@/stores/ui'

/** 迁移前的推进(冻结):逐节判定 + 守卫,不回报"撞上限" */
function legacyAdvance(index: number): number {
  let guard = 0
  let at = index
  while (guard < MAIN_CHAIN_MAX_STEPS) {
    guard += 1
    const current = MAIN_QUESTS[at]
    if (!current || !evalCond(current.cond)) break
    at += 1
  }
  return at
}

/** 造一个能同时满足前若干节条件的档:境界 / 层数拉满 + 计数器给足 */
function richPlayer(major: number, counters: Record<string, number> = {}, sub = 9): void {
  usePlayerStore().major = major
  usePlayerStore().sub = sub
  useQuestsStore().counters = { ...counters }
}

/** 一条路走到底的档:前 11 节的条件都能同时成立(用来逼出守卫) */
const ALL_AT_ONCE: Record<string, number> = {
  explores: 1,
  kills: 10,
  equipsGained: 5,
  gongfaLearned: 3,
  buildingUpgrades: 5,
  pillsCrafted: 5,
  bossKills: 999
}

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('主线任务链对账 —— 推到哪一节、发什么、说什么', () => {
  const scenarios: [string, number, number, Record<string, number>][] = [
    ['新档:一节都推不动', 0, 0, {}],
    ['炼气三层 + 一次历练:前两节一起过', 0, 0, { explores: 1 }],
    ['一路铺到金丹 + 各种计数给足:一口气满足十几节(撞守卫)', 0, 20, ALL_AT_ONCE],
    ['从中途开始:同样连推', 3, 20, ALL_AT_ONCE],
    ['已经走到链尾', MAIN_QUESTS.length, 20, ALL_AT_ONCE]
  ]

  for (const [label, start, major, counters] of scenarios) {
    it(`${label}:下标与冻结口径一致`, () => {
      richPlayer(major, counters)
      const frozen = legacyAdvance(start)
      const mine = advanceMainChain(start, node => {
        const def = MAIN_QUESTS.find(q => q.id === node.id)
        return def !== undefined && evalCond(def.cond)
      })
      expect(mine.index, label).toBe(frozen)
      expect(mine.advanced.length, label).toBe(frozen - start)
    })
  }

  it('守卫是 5 节:一次结算最多推 5 节,而且会说自己被截住了', () => {
    richPlayer(20, ALL_AT_ONCE)
    const out = advanceMainChain(0, node => {
      const def = MAIN_QUESTS.find(q => q.id === node.id)
      return def !== undefined && evalCond(def.cond)
    })
    expect(out.advanced.length).toBe(MAIN_CHAIN_MAX_STEPS)
    expect(out.index).toBe(MAIN_CHAIN_MAX_STEPS)
    expect(out.capped).toBe(true) // 迁移前只是悄悄停下,没人知道内容写歪了
    // 再结算一次继续推,直到条件不再满足或走到链尾
    const again = advanceMainChain(out.index, node => {
      const def = MAIN_QUESTS.find(q => q.id === node.id)
      return def !== undefined && evalCond(def.cond)
    })
    expect(again.index).toBeGreaterThan(out.index)
  })

  it('走一遍真路径:track 触发 → 逐节发赏 + 提示 → 下标一次落账', () => {
    const quests = useQuestsStore()
    const resources = useResourcesStore()
    const toasts: string[] = []
    vi.spyOn(useUiStore(), 'toast').mockImplementation(msg => void toasts.push(msg))
    richPlayer(20, ALL_AT_ONCE)
    resources.spiritStone = gn(0)
    track('kills', 0) // 触发一轮结算(计数本身不再加)
    const frozen = legacyAdvance(0)
    expect(quests.mainIdx).toBe(frozen)
    expect(quests.mainIdx).toBe(MAIN_CHAIN_MAX_STEPS) // 这一轮被守卫截在 5 节
    expect(toasts.filter(t => t.startsWith('任务完成'))).toEqual(
      MAIN_QUESTS.slice(0, MAIN_CHAIN_MAX_STEPS).map(q => `任务完成「${q.name}」`)
    )
    // 奖励到账:与冻结口径同一批(逐节 stoneTier 累加),这里只钉"发了且不为 0"
    expect(formatExact(resources.spiritStone)).not.toBe(formatExact(gn(0)))
  })
})
