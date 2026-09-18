/**
 * 主线进度读数 —— 新手第一天唯一的路线图,不该只有"要做什么"
 *
 * 实测缺口:首页把主线的名字与说明摆着,却不给进度;而每日任务有 3/10。
 * 于是玩家看不出"这一趟历练算不算数""还差几个敌人"。
 *
 * 本文件守两件事:
 *   ① 三种条件(击杀计数 / 突破境界 / 突破到某境界某层)都能翻成人话;
 *   ② **读数里的"成了吗"与发赏判定同一份**(progress.evalCond)——
 *      界面说成了、领赏时不算,或反之,都是欺骗。
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { questProgressOf } from './questProgress'
import { evalCond } from './progress'
import { usePlayerStore } from '@/stores/player'
import { useQuestsStore } from '@/stores/quests'
import { MAIN_QUESTS } from '@/data/quests'

describe('主线进度读数', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('计数类:报「已 X/Y」,到线即成', () => {
    const quests = useQuestsStore()
    const cond = { type: 'counter', key: 'kills', value: 10 } as const
    expect(questProgressOf(cond)!.text).toBe('已 0/10')
    quests.inc('kills', 3)
    const mid = questProgressOf(cond)!
    expect(mid.text, '击杀计数没有如实反映').toBe('已 3/10')
    expect(mid.done).toBe(false)
    expect(mid.ratio).toBeCloseTo(0.3, 6)
    quests.inc('kills', 7)
    const done = questProgressOf(cond)!
    expect(done.done, '到线了却没算成').toBe(true)
    expect(done.text).toBe('已成(10/10)')
  })

  it('境界类:未至时说清"尚在何处、需至何处",已至即成', () => {
    const player = usePlayerStore()
    player.$patch({ major: 0, sub: 0 })
    const cond = { type: 'realm', major: 1 } as const
    const before = questProgressOf(cond)!
    expect(before.done).toBe(false)
    expect(before.text).toContain('尚在 炼气')
    expect(before.text).toContain('需至 筑基')
    player.$patch({ major: 1 })
    expect(questProgressOf(cond)!.text).toBe('已至 筑基')
  })

  it('「突破到某境界某层」:层数要一起比 —— 炼气二层不算达成炼气三层', () => {
    const player = usePlayerStore()
    // 主线 q_start 的条件就是 realm_0_2(突破至炼气三层)
    const cond = { type: 'custom', key: 'realm_0_2' } as const
    player.$patch({ major: 0, sub: 1 })
    expect(questProgressOf(cond)!.done, '炼气二层被算成炼气三层').toBe(false)
    player.$patch({ sub: 2 })
    const hit = questProgressOf(cond)!
    expect(hit.done).toBe(true)
    expect(hit.text).toContain('已至')
    // 境界超过之后仍算达成(老档回头看不该变成"没成")
    player.$patch({ major: 3, sub: 0 })
    expect(questProgressOf(cond)!.done).toBe(true)
  })

  it('认不出的条件不硬编:状态型键(寿元/灵石)返回 null', () => {
    expect(questProgressOf({ type: 'custom', key: 'stone1m' })).toBeNull()
    expect(questProgressOf({ type: 'quality', rank: 5 })).toBeNull()
  })

  it('读数里的"成了吗"与发赏判定同源(逐条对账全 32 条主线)', () => {
    const player = usePlayerStore()
    const quests = useQuestsStore()
    // 造一个"中期存档":金丹五层 + 一堆计数
    player.$patch({ major: 2, sub: 5 })
    for (const [k, v] of [
      ['kills', 12],
      ['explores', 4],
      ['bossKills', 2],
      ['upgrades', 7]
    ] as const) {
      quests.inc(k, v)
    }
    let checked = 0
    for (const def of MAIN_QUESTS) {
      const view = questProgressOf(def.cond)
      if (!view) continue
      checked += 1
      expect(view.done, `${def.name}:读数说 ${view.text},而发赏判定是 ${evalCond(def.cond)}`).toBe(evalCond(def.cond))
    }
    expect(checked, '一条主线都没扫到,断言形同虚设').toBeGreaterThan(25)
  })
})
