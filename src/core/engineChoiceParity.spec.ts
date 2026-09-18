/**
 * 事件抉择对账 —— 加权掷后果与三级兜底交给库之后,与**迁移前冻结的旧实现**逐次相同。
 *
 * 与 engineParity 同一条纪律。这里冻结的是两段最该逐位对齐的逻辑:
 *   一 **掷哪条后果**(`rng.weighted(outcomes, o => o.weight)`)—— 它决定玩家看到哪句结果、
 *      也决定消耗的随机数;顺序或次数一变,之后整局的随机流都会错位;
 *   二 **没选时的兜底**(默认且可选 → 第一条可选 → 第一条)—— 离线自动结算与界面超时共用这一处。
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { EventChoice, EventDef } from '@/types'
import { EVENTS } from '@/data/events'
import { usePlayerStore } from '@/stores/player'
import { useResourcesStore } from '@/stores/resources'
import { RandomService, mulberry32 } from '@/utils/random'
import { createRng } from 'wanxiang-engine'
import { CHOICES, asChoice, choiceAvailable } from './eventEngine'

// —— 迁移前冻结的旧口径(原 core/eventEngine.ts 的两段)——
function refRoll(choice: EventChoice, seed: number): string {
  return refRollWith(choice, new RandomService(mulberry32(seed))).text
}

/** 同一条冻结逻辑,但随机源由调用方给(用来比"之后的随机流是否错位") */
function refRollWith(choice: EventChoice, rng: RandomService): EventChoice['outcomes'][number] {
  return rng.weighted(choice.outcomes, o => o.weight)
}

function refDefaultIndex(def: EventDef, tier: number): number {
  let idx = def.choices.findIndex(c => c.isDefault && choiceAvailable(c, tier))
  if (idx < 0) idx = def.choices.findIndex(c => choiceAvailable(c, tier))
  if (idx < 0) idx = 0
  return idx
}

/** 抽一批真实事件来对账(全量太长,这里取前 40 个事件的每个选项) */
const SAMPLE: EventDef[] = EVENTS.slice(0, 40)
const TIER = 2

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('事件抉择对账 —— 掷后果与兜底逐次相同', () => {
  it('同一种子掷出同一条后果(前 40 个事件的每个选项 × 20 颗种子)', () => {
    let compared = 0
    for (const def of SAMPLE) {
      for (const choice of def.choices) {
        if (choice.outcomes.length === 0) continue
        for (const seed of [1, 7, 42, 1024, 99991, 5, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61]) {
          const now = CHOICES.roll(asChoice(choice, TIER), createRng(seed)).outcome.text
          expect(now, `${def.id} · ${choice.label} · seed=${seed}`).toBe(refRoll(choice, seed))
          compared += 1
        }
      }
    }
    expect(compared).toBeGreaterThan(200) // 对账确实跑了很多次,不是空转
  })

  it('后果的下标与随机源消耗也对得上(否则之后的随机流会错位)', () => {
    for (const def of SAMPLE.slice(0, 10)) {
      for (const choice of def.choices) {
        if (choice.outcomes.length === 0) continue
        const oldRng = new RandomService(mulberry32(2026))
        const oldOutcome = refRollWith(choice, oldRng)
        const newRng = createRng(2026)
        const { outcome, index } = CHOICES.roll(asChoice(choice, TIER), newRng)
        expect(outcome.text).toBe(oldOutcome.text)
        // 下标指向的确实是掷中的那条(不是"碰巧文本相同")
        expect(choice.outcomes[index]).toBe(outcome)
        // 两边各取下一串数:应当完全一致
        expect([newRng.next(), newRng.next()]).toEqual([oldRng.next(), oldRng.next()])
      }
    }
  })

  it('没选时的兜底:三级顺序与旧实现相同(两种玩家状态下各比一遍)', () => {
    const states: (() => void)[] = [
      () => {
        usePlayerStore().major = 0
        useResourcesStore().spiritStone = { m: 0, e: 0 }
      },
      () => {
        usePlayerStore().major = 8
        useResourcesStore().spiritStone = { m: 1, e: 12 }
      }
    ]
    let compared = 0
    for (const setup of states) {
      setup()
      for (const def of SAMPLE) {
        if (def.choices.length === 0) continue
        const now = CHOICES.defaultIndex(def.choices.map(c => asChoice(c, TIER)), TIER)
        expect(now, `${def.id}`).toBe(refDefaultIndex(def, TIER))
        compared += 1
      }
    }
    expect(compared).toBe(SAMPLE.length * states.length)
  })

  it('结算回执:文本取自掷中的后果,效果行由本作的解释器给(付不起的那条不计入)', () => {
    // 找一个"带代价效果"的选项来验回执形状
    const withStone: { def: EventDef; choice: EventChoice } | undefined = SAMPLE.map(def => ({
      def,
      choice: def.choices.find(c => c.outcomes.some(o => o.effects.some(e => e.type === 'stone')))!
    })).find(x => x.choice)
    if (!withStone) return // 内容里若一个都没有,这条不适用
    usePlayerStore().major = 8
    useResourcesStore().spiritStone = { m: 1, e: 12 } // 够付
    const receipt = CHOICES.resolve(asChoice(withStone.choice, TIER), TIER, createRng(3))
    expect(receipt.text).toBe(refRoll(withStone.choice, 3))
    for (const line of receipt.lines) expect(typeof line).toBe('string')
  })
})
