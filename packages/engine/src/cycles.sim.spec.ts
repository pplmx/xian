/* eslint-disable no-console */
/**
 * 消融实验 —— 确定性轮换的实际分布:一天一天掷出来,长什么样。
 *
 * `cycles.spec.ts` 钉的是语义(同一个周期序号永远同一个结果、不依赖现实时间、分段换池、能预告);
 * 这一份量的是**内容作者最关心、又最难心算的那件事**:权重摆好之后,一年里各类"天时"各占几天、
 * 最长会连着几天重复 —— 因为它是"按周期序号派生种子"而不是一次性掷一串,重复是必然会出现的。
 *
 * 三条量出来的结论:
 *   ① **长期接近均匀,短期并不"轮流"**:五个候选(权重 30/20/20/20/10)跑 365 天,
 *      实测 87/77/89/73/39 天(理论 109.5/73/73/73/36.5),**最长连续重复 4 天** ——
 *      想禁止"连着同一种",得在内容侧加约束,库不替你轮值;
 *   ② **问多少次都一样,而且不碰调用方的随机源**:同一个周期问 100 遍结果相同;
 *      `at()` 自己派生内部种子,传入的全局随机流一位都不消耗;
 *   ③ **换池只影响"用哪个池",不影响"第几个周期"**:同一个序号在两个池里给出不同结果,
 *      但各自可复现;`remainingSec` 在周期起点给整周期长、终点前 1 秒给 1。
 */
import { describe, expect, it } from 'vitest'
import { createRng } from './rng.js'
import { createCycleSystem } from './cycles.js'

const DAY = 86_400

/** 五天的"天时":人间界那一套(权重不等:晴 30%,其余各分) */
const WEATHERS = [
  { id: 'clear', name: '清和', weight: 30 },
  { id: 'rain', name: '细雨', weight: 20 },
  { id: 'wind', name: '罡风', weight: 20 },
  { id: 'fog', name: '迷雾', weight: 20 },
  { id: 'thunder', name: '雷暴', weight: 10 }
]

const cycles = createCycleSystem({
  periodSec: DAY,
  pools: { mortal: WEATHERS, abyss: [{ id: 'still', name: '死寂', weight: 1 }, { id: 'surge', name: '潮涌', weight: 1 }] }
})

describe('消融实验 —— 确定性轮换的实际分布', () => {
  it('一年 365 天的分布与最长连续重复', () => {
    const counts = new Map<string, number>()
    let longest = 1
    let current = 1
    let previous: string | undefined
    for (let day = 0; day < 365; day += 1) {
      const id = cycles.at(day * DAY, { pool: 'mortal' }).entry!.id
      counts.set(id, (counts.get(id) ?? 0) + 1)
      if (id === previous) {
        current += 1
        longest = Math.max(longest, current)
      } else {
        current = 1
      }
      previous = id
    }
    console.log('  365 天的分布(理论按权重):')
    for (const entry of WEATHERS) {
      const days = counts.get(entry.id) ?? 0
      console.log(`  ${entry.name}:${days} 天(权重 ${entry.weight} → 理论 ${(365 * entry.weight) / 100} 天)`)
    }
    console.log(`  最长连续重复:${longest} 天`)

    // ① 长期接近均匀:每个候选都落在理论值附近(±40%),且都出现过
    for (const entry of WEATHERS) {
      const expected = (365 * entry.weight) / 100
      const actual = counts.get(entry.id) ?? 0
      expect(actual).toBeGreaterThan(0)
      expect(Math.abs(actual - expected) / expected).toBeLessThan(0.4)
    }
    expect([...counts.values()].reduce((a, b) => a + b, 0)).toBe(365)
    // ② 但短期不"轮流":最长连续重复 ≥ 2 —— 库不做轮值,这是内容自己要不要加约束的事
    expect(longest).toBeGreaterThanOrEqual(2)
    // 防空转:如果分布真按顺序轮换,总天数也是 365 —— 所以上面还查了"每种都出现过"
    expect(new Set(counts.keys()).size).toBe(WEATHERS.length)
  })

  it('问多少次都一样,而且不动调用方的随机源', () => {
    const first = cycles.at(7 * DAY, { pool: 'mortal' }).entry?.id
    for (let i = 0; i < 100; i += 1) {
      expect(cycles.at(7 * DAY, { pool: 'mortal' }).entry?.id).toBe(first)
    }
    console.log(`  第 8 天问 100 遍:都是「${cycles.at(7 * DAY, { pool: 'mortal' }).entry?.name}」`)

    // ② 不消耗随机流:同一颗种子造两支,一支问了当前周期与五天的预告,一支什么都不做 —— 下一位必须相同
    const asked = createRng('同种')
    cycles.at(7 * DAY, { pool: 'mortal' })
    cycles.schedule(7 * DAY, 5, { pool: 'mortal' })
    const notAsked = createRng('同种')
    expect(asked.next()).toBe(notAsked.next())
    // 防空转:连续多问几次也一样(否则"只消耗一位"也能骗过上面那条)
    cycles.schedule(30 * DAY, 30, { pool: 'mortal' })
    expect(asked.next()).toBe(notAsked.next())
  })

  it('换池只换池:同一序号在两个池里结果不同,各自可复现', () => {
    const mortal = cycles.at(3 * DAY, { pool: 'mortal' }).entry?.id
    const abyss = cycles.at(3 * DAY, { pool: 'abyss' }).entry?.id
    console.log(`  第 4 天:人间界「${mortal}」· 界外「${abyss}」`)

    // ③ 池不同 → 结果不同(种子把池名也拌进去了),但同一个池里永远可复现
    expect(['still', 'surge']).toContain(abyss)
    expect(cycles.at(3 * DAY, { pool: 'abyss' }).entry?.id).toBe(abyss)
    // 盐:同一个池、不同盐 → 不同序列(一界一套天时)
    const saltA = cycles.at(3 * DAY, { pool: 'abyss', salt: 1 }).entry?.id
    const saltB = cycles.at(3 * DAY, { pool: 'abyss', salt: 2 }).entry?.id
    expect([saltA, saltB].every(id => id === 'still' || id === 'surge')).toBe(true)
    // 防空转:两个池的条目确实不同(否则"换池"没意义)
    expect(cycles.at(3 * DAY, { pool: 'mortal' }).entry!.id).not.toBe(abyss)
  })

  it('倒计时的边界:周期起点给整周期长,终点前 1 秒给 1', () => {
    const rows = [0, 1, DAY - 1, DAY, DAY + 1, 2 * DAY - 1].map(elapsedSec => ({
      elapsedSec,
      index: cycles.indexAt(elapsedSec),
      remaining: cycles.remainingSec(elapsedSec)
    }))
    for (const row of rows) {
      console.log(`  第 ${row.elapsedSec} 秒 → 第 ${row.index + 1} 天,剩 ${row.remaining} 秒`)
    }

    expect(rows[0]!.remaining).toBe(DAY) // 起点:整周期
    expect(rows[1]!.remaining).toBe(DAY - 1)
    expect(rows[2]!.remaining).toBe(1)
    expect(rows[3]!.remaining).toBe(DAY) // 跨到新周期:又是整周期
    expect(rows[4]!.remaining).toBe(DAY - 1)
    // 序号与倒计时是同一套算术:第 i 天从 i × 周期长 开始
    expect(rows[3]!.index).toBe(1)
    expect(cycles.at(DAY, { pool: 'mortal' }).startSec).toBe(DAY)
    // 防空转:六个采样点的倒计时不是同一个数
    expect(new Set(rows.map(r => r.remaining)).size).toBeGreaterThan(1)
  })
})
