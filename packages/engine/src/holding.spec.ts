import { describe, expect, it } from 'vitest'
import { createHoldingSystem } from './holding.js'

interface Item {
  uid: string
  name: string
}

const item = (uid: string, name = uid): Item => ({ uid, name })

describe('持有(背包)—— 手里那一堆怎么管', () => {
  it('库不规定你持有的是什么,只要求每件有 uid', () => {
    const bag = createHoldingSystem<Item>()
    const holding = bag.create([item('a'), item('b')])
    expect(bag.list(holding).length).toBe(2)
    expect(bag.find(holding, 'b')?.uid).toBe('b')
    expect(bag.has(holding, 'c')).toBe(false)
    expect([...bag.indexOf(holding).keys()]).toEqual(['a', 'b'])
  })

  it('背包满了就不收(返回 full,由调用方决定折算成什么)', () => {
    const bag = createHoldingSystem<Item>({ capacity: 2 })
    const holding = bag.create([item('a'), item('b')])
    expect(bag.isFull(holding)).toBe(true)
    const rejected = bag.add(holding, item('c'))
    expect(rejected.ok).toBe(false)
    expect(rejected.reason).toBe('full')
    expect(bag.list(rejected.holding).length).toBe(2) // 原样

    const one = bag.create([item('a')])
    expect(bag.add(one, item('b')).ok).toBe(true)
    expect(bag.spaceOf(one)).toBe(1)
  })

  it('"什么算占位"由作品给 —— 已装配的不占背包,是这一条的最常见写法', () => {
    const equipped = new Set(['a'])
    const bag = createHoldingSystem<Item>({ capacity: 2, counted: it => !equipped.has(it.uid) })
    const holding = bag.create([item('a'), item('b'), item('c')])
    expect(bag.count(holding)).toBe(2) // a 已装配,不占位
    expect(bag.isFull(holding)).toBe(true)
    // 装配件可以 force 收进来(先装配、不占背包位)
    const forced = bag.add(holding, item('d'), { force: true })
    expect(forced.ok).toBe(true)
  })

  it('容量可以现算(洞府升级 / 行囊扩展)', () => {
    const bag = createHoldingSystem<Item>({ capacity: holding => 2 + holding.items.length })
    expect(bag.capacityOf(bag.create())).toBe(2)
    expect(bag.capacityOf(bag.create([item('a')]))).toBe(3)
  })

  it('uid 是身份:重复不收(数据坏了要当场知道,而不是长出两件同号的)', () => {
    const bag = createHoldingSystem<Item>()
    const holding = bag.create([item('a')])
    const dup = bag.add(holding, item('a', '另一件'))
    expect(dup.ok).toBe(false)
    expect(dup.reason).toBe('duplicate')
  })

  it('取走一件、替换一件(强化 / 重铸走替换:件还是那件,数据变了)', () => {
    const bag = createHoldingSystem<Item>()
    const holding = bag.create([item('a'), item('b')])
    const taken = bag.remove(holding, 'a')
    expect(taken.removed?.uid).toBe('a')
    expect(taken.holding.items.map(i => i.uid)).toEqual(['b'])
    expect(bag.remove(holding, '不存在').holding).toBe(holding) // 没有就原样返回

    const upgraded = bag.replace(holding, item('b', '强化过的'))
    expect(upgraded.found).toBe(true)
    expect(bag.find(upgraded.holding, 'b')?.name).toBe('强化过的')
    expect(bag.replace(holding, item('zzz')).found).toBe(false)
  })

  it('装配联动:删一件要把所有槽位上的它摘掉,否则装配表里会留悬空 uid', () => {
    const bag = createHoldingSystem<Item>()
    let slots = bag.assign({}, 'weapon', 'a')
    slots = bag.assign(slots, 'ring', 'b')
    slots = bag.assign(slots, 'talisman', 'a')
    expect([...bag.assignedUids(slots)].sort()).toEqual(['a', 'b'])

    const off = bag.unassignUid(slots, 'a')
    expect(off.cleared.sort()).toEqual(['talisman', 'weapon'])
    expect(off.slots).toEqual({ ring: 'b' })

    const slotOff = bag.unassignSlot(slots, 'ring')
    expect(slotOff).toEqual({ weapon: 'a', talisman: 'a' })
    expect(bag.unassignUid(slots, '不存在').slots).toBe(slots)
  })

  it('批量:收一批时把收不下的挑出来(掉落一次来五件时不用自己写循环)', () => {
    const bag = createHoldingSystem<Item>({ capacity: 2 })
    const result = bag.addMany(bag.create(), [item('a'), item('b'), item('c'), item('d')])
    expect(result.added.map(i => i.uid)).toEqual(['a', 'b'])
    expect(result.failed.map(f => `${f.item.uid}:${f.reason}`)).toEqual(['c:full', 'd:full'])
  })
})
