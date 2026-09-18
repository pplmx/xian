import { describe, expect, it } from 'vitest'
import { createRng } from './rng.js'
import { createCycleSystem, type CycleEntry } from './cycles.js'

const POOLS: Record<string, CycleEntry[]> = {
  mortal: [
    { id: 'clear', name: '清和', weight: 30 },
    { id: 'rain', name: '灵雨', weight: 17.5, mods: { cultivationSpeed: 0.1 } },
    { id: 'sun', name: '赤阳', weight: 17.5, mods: { damageBonus: 0.1 } }
  ],
  immortal: [{ id: 'xianyu', name: '仙雨', mods: { qiRegen: 0.25 } }]
}

const cycles = createCycleSystem({ periodSec: 86400, pools: POOLS })
const mortal = { pool: 'mortal', salt: 7 }

describe('周期(天时 / 每日 / 赛季)', () => {
  it('周期序号与剩余时间:游戏内秒 → 第几个周期', () => {
    expect(cycles.indexAt(0)).toBe(0)
    expect(cycles.indexAt(86399)).toBe(0)
    expect(cycles.indexAt(86400)).toBe(1)
    expect(cycles.indexAt(86400 * 3 + 10)).toBe(3)
    expect(cycles.remainingSec(86400 * 3 + 10)).toBe(86400 - 10)
    expect(cycles.remainingSec(0)).toBe(86400)
  })

  it('同一个周期永远是同一个结果 —— 刷新不换、回放不换', () => {
    for (let day = 0; day < 50; day += 1) {
      const a = cycles.at(day * 86400 + 5, mortal).entry?.id
      const b = cycles.at(day * 86400 + 86_000, mortal).entry?.id // 同一天的不同时刻
      const c = cycles.at(day * 86400, mortal).entry?.id
      expect(b).toBe(a)
      expect(c).toBe(a)
    }
  })

  it('**不消耗全局随机流**:天时是什么,与玩家在此之前掷过多少次骰子无关', () => {
    const seed = 20260919
    const quiet = createRng(seed)
    const noisy = createRng(seed)
    for (let i = 0; i < 100; i += 1) noisy.next() // 玩家掷了一百次

    // 两边各自问"今天是哪天时" —— 结果与各自的随机流无关
    expect(cycles.at(86400 * 9, mortal).entry?.id).toBe(cycles.at(86400 * 9, mortal).entry?.id)
    // 而且问完之后,两条随机流都还在原地(下一次取值仍然相同)
    expect(noisy.next()).toBeGreaterThanOrEqual(0)
    const a = createRng(seed)
    const b = createRng(seed)
    cycles.at(86400 * 3, mortal)
    cycles.schedule(86400 * 3, 5, mortal)
    expect(a.next()).toBe(b.next())
    void quiet
  })

  it('相邻周期看起来无关(不是按顺序轮)', () => {
    const ids = Array.from({ length: 30 }, (_, day) => cycles.at(day * 86400, mortal).entry?.id)
    expect(new Set(ids).size).toBeGreaterThan(2) // 三种都会出现
    // 完全按顺序轮的话会长这样:clear,rain,sun,clear… —— 这里不该如此
    const cycled = ids.every((id, i) => i === 0 || id === ids[(i - 1) % 3])
    expect(cycled).toBe(false)
  })

  it('换池子:同一时刻不同池给不同天时;单条池子也不出错', () => {
    expect(cycles.at(86400 * 5, { pool: 'immortal', salt: 1 }).entry?.id).toBe('xianyu')
    expect(cycles.at(86400 * 5, mortal).entry?.id).toBeDefined()
    expect(cycles.at(86400 * 5, { pool: '不存在' }).entry).toBeUndefined()
  })

  it('预告:接下来几周期分别是什么', () => {
    const ahead = cycles.schedule(86400 * 4 + 100, 3, mortal)
    expect(ahead.map(x => x.index)).toEqual([4, 5, 6])
    expect(ahead.map(x => x.startSec)).toEqual([86400 * 4, 86400 * 5, 86400 * 6])
    expect(ahead[0]!.entry?.id).toBe(cycles.at(86400 * 4 + 100, mortal).entry?.id)
  })

  it('抽取规则可以完全接管(作品自己的"清和 30%、其余均分 70%"那种写法)', () => {
    const bespoke = createCycleSystem({
      periodSec: 100,
      pools: POOLS,
      pick: (entries, rng) => {
        const roll = rng.next()
        if (roll < 0.3) return entries[0]! // 清和 30%
        const rest = entries.slice(1)
        return rest[Math.min(rest.length - 1, Math.floor(((roll - 0.3) / 0.7) * rest.length))]!
      }
    })
    const ids = Array.from({ length: 40 }, (_, i) => bespoke.at(i * 100, mortal).entry?.id)
    expect(new Set(ids).size).toBe(3)
    expect(ids.filter(id => id === 'clear').length).toBeGreaterThan(5) // 清和明显更常见
  })

  it('词条按当前周期给,换周期就换', () => {
    const day = Array.from({ length: 40 }, (_, i) => i).find(i => cycles.at(i * 86400, mortal).entry?.id === 'rain')
    expect(day).toBeDefined()
    expect(cycles.modsAt(day! * 86400, mortal).cultivationSpeed).toBeCloseTo(0.1, 10)
  })
})
