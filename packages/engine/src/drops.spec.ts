import { describe, expect, it } from 'vitest'
import type { Rng } from './rng.js'
import { createRng } from './rng.js'
import type { DropEntry } from './drops.js'
import { createDropTable } from './drops.js'

/** 会数骰子的随机源 —— "随机流有没有变"这种事,数出来比看着像不像可靠 */
function counter(seed: number): { rng: Rng; draws: () => number } {
  const base = createRng(seed)
  let draws = 0
  return {
    rng: {
      next: () => {
        draws += 1
        return base.next()
      },
      int: (min, max) => {
        draws += 1
        return base.int(min, max)
      },
      float: (min, max) => {
        draws += 1
        return base.float(min, max)
      },
      chance: p => {
        draws += 1
        return base.chance(p)
      },
      pick: arr => {
        draws += 1
        return base.pick(arr)
      },
      weighted: (items, weightOf) => {
        draws += 1
        return base.weighted(items, weightOf)
      }
    },
    draws: () => draws
  }
}

const one = (entry: Partial<DropEntry>, key = 'k'): DropEntry => ({ key, chance: 1, ...entry })

describe('掉落表 —— "这一场给不给、给几份"', () => {
  it('概率先钳到 [0,1]:叠过 1 的只是必中,不是"更必中";负数永不中', () => {
    const table = createDropTable([one({ chance: 1.8 }), one({ chance: 3 }, 'b'), one({ chance: -0.5 }, 'c')])
    const { rng } = counter(1)
    const over = table.effectiveChance(table.entries[0]!, {})
    // 钳到 1:再叠多少都是 1(而不是留个 1.8 让人以为"触发概率更大")
    expect(over).toBe(1)
    expect(table.effectiveChance(table.entries[1]!, { chanceMult: 9 })).toBe(1)
    expect(table.effectiveChance(table.entries[2]!, {})).toBe(0)
    const hits = table.roll(rng, {})
    expect(hits.map(h => h.key)).toEqual(['k', 'b'])
    // 必中也要真掷一次:概率判定是"掷出多少"与"要多高"的比较,不是跳过掷骰
    const single = counter(1)
    table.rollOne(table.entries[0]!, single.rng, {})
    expect(single.draws()).toBe(1)
  })

  it('chanceCap 另设上限:叠到多高也不超过它', () => {
    const entry = one({ chance: 0.6, chanceCap: 0.9 })
    const table = createDropTable([entry])
    expect(table.effectiveChance(entry, {})).toBeCloseTo(0.6, 12)
    expect(table.effectiveChance(entry, { chanceMult: 2 })).toBeCloseTo(0.9, 12) // 1.2 → 0.9
    expect(table.effectiveChance(entry, { chanceMult: 1.1 })).toBeCloseTo(0.66, 12) // 未触顶就不动
  })

  it('保底:开 guarantee 时这一条的**第一次**尝试必中,且保底不改随机流', () => {
    const table = createDropTable([one({ chance: 0, guaranteed: true, attempts: 3 })])
    const entry = table.entries[0]!
    const off = counter(5)
    expect(table.rollOne(entry, off.rng, {}).hits).toBe(0)
    const on = counter(5)
    const hit = table.rollOne(entry, on.rng, { guarantee: true })
    expect(hit.hits).toBe(1) // attempts 三次都没中,但第一次被保底顶上
    // 开不开保底,掷骰次数一样 —— 后面的随机结果不该因为开了保底而整体位移
    expect(on.draws()).toBe(off.draws())
  })

  it('保底也可以没开:默认关,条目不 guaranteed 时 guarantee 无效', () => {
    const table = createDropTable([one({ chance: 0, guaranteed: true }), one({ chance: 0 }, 'b')])
    const { rng } = counter(9)
    expect(table.roll(rng, {}).map(h => h.key)).toEqual([])
    const plain = counter(9)
    expect(table.rollOne(table.entries[1]!, plain.rng, { guarantee: true }).hits).toBe(0)
  })

  it('attempts 默认不吃 countMult("翻倍"翻的是份数),开了 scalesWithAttempts 才多掷几次', () => {
    const entry = one({ chance: 1, attempts: 2, count: 1 })
    const table = createDropTable([entry])
    expect(table.rollOne(entry, counter(3).rng, {}).hits).toBe(2)
    const doubled = table.rollOne(entry, counter(3).rng, { countMult: 2 })
    expect(doubled.hits).toBe(2) // 掷骰次数不变:概率的含义不该被"翻倍"改写
    expect(doubled.count).toBe(4) // 2 次命中 × 每次 2 份
    const scaled = one({ chance: 1, attempts: 2, count: 1, scalesWithAttempts: true, scalesWithCount: false })
    expect(createDropTable([scaled]).rollOne(scaled, counter(3).rng, { countMult: 5 }).hits).toBe(10)
  })

  it('count 支持闭区间,且只在命中时才掷那一颗骰子', () => {
    const table = createDropTable([one({ chance: 0, count: [1, 3] })])
    const miss = counter(4)
    expect(table.rollOne(table.entries[0]!, miss.rng, {}).count).toBe(0)
    expect(miss.draws()).toBe(1) // 没中就不抽份数
    const range = one({ chance: 1, count: [2, 4] })
    const hit = createDropTable([range]).rollOne(range, counter(4).rng, {})
    expect(hit.count).toBeGreaterThanOrEqual(2)
    expect(hit.count).toBeLessThanOrEqual(4)
  })

  it('份数吃 countMult,倍率不会重复叠加(命中一次,一份乘一次)', () => {
    const entry = one({ chance: 1, count: [3, 3] })
    const seen: number[] = []
    createDropTable([entry]).rollOne(entry, counter(6).rng, { countMult: 2, onHit: (_e, n) => seen.push(n) })
    expect(seen).toEqual([6])
    const flat = one({ chance: 1, count: [3, 3], scalesWithCount: false })
    expect(createDropTable([flat]).rollOne(flat, counter(6).rng, { countMult: 9 }).count).toBe(3)
  })

  it('roll 的顺序即声明顺序,未命中的条目不出现在结果里', () => {
    const table = createDropTable([
      one({ chance: 1 }, 'first'),
      one({ chance: 0 }, 'skip'),
      one({ chance: 1 }, 'second')
    ])
    expect(table.roll(counter(2).rng, {}).map(h => h.key)).toEqual(['first', 'second'])
    expect(table.roll(counter(2).rng, {}).map(h => h.hits)).toEqual([1, 1])
  })

  it('命中当场处理:回调里再掷的骰子,顺序与手写实现逐个一致', () => {
    const table = createDropTable([one({ chance: 1, attempts: 2, count: 1 })])
    const viaTable = counter(7)
    const rolled: number[] = []
    table.rollOne(table.entries[0]!, viaTable.rng, {
      onHit: () => {
        rolled.push(viaTable.rng.next()) // 假装"生成装备":命中后自己还要掷骰
      }
    })
    // 手写:`掷、中、掷` 重复两遍 —— 表若攒到最后再生成,这里就会错位
    const manual = counter(7)
    const expected: number[] = []
    for (let i = 0; i < 2; i += 1) {
      manual.rng.chance(1)
      expected.push(manual.rng.next())
    }
    expect(rolled).toEqual(expected)
    expect(viaTable.draws()).toBe(manual.draws())
  })

  it('整表掷也走同一套:onHit 逐条按声明顺序触发', () => {
    const table = createDropTable([one({ chance: 1, count: 2 }, 'a'), one({ chance: 0 }, 'b'), one({ chance: 1 }, 'c')])
    const log: string[] = []
    table.roll(counter(8).rng, { onHit: (entry, n) => log.push(`${entry.key}:${n}`) })
    expect(log).toEqual(['a:2', 'c:1'])
  })

  it('纯函数:表不改条目,也不留状态(同一张表可重复掷)', () => {
    const entries: DropEntry[] = [one({ chance: 1, count: [1, 2] })]
    const snapshot = JSON.stringify(entries)
    const table = createDropTable(entries)
    table.roll(counter(11).rng, { chanceMult: 3, countMult: 2, guarantee: true })
    expect(JSON.stringify(entries)).toBe(snapshot)
    expect(table.roll(counter(11).rng, {}).length + table.roll(counter(11).rng, {}).length).toBe(2)
  })
})
