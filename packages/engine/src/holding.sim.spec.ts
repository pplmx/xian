/* eslint-disable no-console */
/**
 * 消融实验 —— 背包满了之后会发生什么,以及"装配即腾位"到底腾出多少。
 *
 * `holding.spec.ts` 钉的是语义(收不下就退回由调用方折算、uid 重复即数据坏了、force 绕过容量、
 * 删件要清掉所有相关槽位);这一份量的是**玩家能感觉到的数**:装一身装备能多背几件、
 * 满仓时哪一类拒绝先报、强塞之后容量读数会不会"静默超载"。
 *
 * 三条量出来的结论:
 *   ① **装配是真腾位**:容量 20 的背包,装上 6 件之后能再收 6 件 ——
 *      所以"背包满了"与"装满了"是两件事,界面必须分开说;
 *   ② **两种拒绝的理由不同、优先级固定**:uid 重复先判(那是数据坏了,与满不满无关),
 *      再判容量;这两种在界面上给的提示完全不同,混起来就会被玩家当成 bug 报;
 *   ③ **`force` 是"明知超载也要收"**:收进来之后 `count > capacity` 一直成立 ——
 *      它是给"邮件补发 / 回收站"这类场景用的,不是"悄悄多留几件"。
 */
import { describe, expect, it } from 'vitest'
import { createHoldingSystem } from './holding.js'

interface Gear {
  uid: string
  quality: number
}

/** 容量 20;**已装配的件不占背包位**(这是大多数作品的口径) */
const bag = createHoldingSystem<Gear>({
  capacity: 20,
  counted: item => !new Set(assigned.flatMap(slot => Object.values(slot).filter(Boolean))).has(item.uid)
})

/** 装配表:槽位 → uid */
let assigned: Record<string, string | undefined>[] = []

const gear = (uid: string, quality = 1): Gear => ({ uid, quality })
const many = (count: number, from = 0): Gear[] => Array.from({ length: count }, (_, i) => gear(`g${from + i}`))

describe('消融实验 —— 背包满了会发生什么', () => {
  it('装配是真腾位:装上 6 件,背包就能再收 6 件', () => {
    let holding = bag.create(many(20))
    assigned = []
    console.log(`  满仓:${bag.count(holding)}/${bag.capacityOf(holding)} · 还剩 ${bag.spaceOf(holding)} 位`)
    expect(bag.isFull(holding)).toBe(true)

    // ① 装满但没装配 → 收不下
    const rejected = bag.add(holding, gear('new'))
    expect(rejected.ok).toBe(false)
    expect(rejected.reason).toBe('full')

    // 装上 6 件之后:这 6 件不再占背包位,于是能再收 6 件
    holding = bag.create([...many(20)])
    assigned = many(6).map((item, index) => ({ [`s${index}`]: item.uid }))
    console.log(`  装上 6 件之后:背包占位 ${bag.count(holding)}/${bag.capacityOf(holding)} · 还能收 ${bag.spaceOf(holding)} 件`)
    expect(bag.count(holding)).toBe(14)
    expect(bag.spaceOf(holding)).toBe(6)
    expect(bag.isFull(holding)).toBe(false)
    const again = bag.addMany(holding, many(6, 100))
    expect(again.added.length).toBe(6)
    expect(again.failed.length).toBe(0)
    // 防空转:第 7 件就收不下了(腾位是有限度的)
    expect(bag.add(again.holding, gear('overflow')).ok).toBe(false)
  })

  it('两种拒绝的理由与优先级:uid 重复先判,再判容量', () => {
    assigned = []
    const holding = bag.create(many(3))
    const duplicate = bag.add(holding, gear('g1'))
    console.log(`  重复 uid:${duplicate.reason} · 满仓:${bag.add(bag.create(many(20)), gear('x')).reason}`)

    // ② 数据坏了优先于容量:哪怕还有位置,重复 uid 也不收
    expect(duplicate.reason).toBe('duplicate')
    expect(bag.spaceOf(holding)).toBeGreaterThan(0)
    // 满仓时报的是 full
    expect(bag.add(bag.create(many(20)), gear('x')).reason).toBe('full')
    // 优先级的实证:既重复又满仓时,报的是 duplicate(而不是 full)
    const both = bag.add(bag.create(many(20)), gear('g7'))
    expect(both.reason).toBe('duplicate')
    console.log(`  既重复又满仓 → 报 ${both.reason}(先查身份,再查容量)`)
  })

  it('force 是"明知超载也要收":超载之后读数一直显示超了', () => {
    assigned = []
    const full = bag.create(many(20))
    const forced = bag.add(full, gear('mail'), { force: true })
    console.log(`  强塞一件之后:${bag.count(forced.holding)}/${bag.capacityOf(forced.holding)} · isFull=${bag.isFull(forced.holding)}`)

    // ③ force 收得下,但读数如实超载(不是"静默丢掉",也不是"悄悄扩容")
    expect(forced.ok).toBe(true)
    expect(bag.count(forced.holding)).toBe(21)
    expect(bag.count(forced.holding)).toBeGreaterThan(bag.capacityOf(forced.holding))
    expect(bag.spaceOf(forced.holding)).toBe(0) // 空间不会变成负数
    // 批量收时同样:force 之下全收,没 force 就按顺序收满即止
    const bulk = bag.addMany(full, many(5, 200))
    expect(bulk.added.length).toBe(0)
    expect(bulk.failed.map(f => f.reason)).toEqual(['full', 'full', 'full', 'full', 'full'])
    const bulkForced = bag.addMany(full, many(5, 200), { force: true })
    expect(bulkForced.added.length).toBe(5)
    // 防空转:同一批件、同样的起点,唯一的差别就是 force
    expect([...bulkForced.added.map(i => i.uid)]).toEqual(many(5, 200).map(i => i.uid))
  })

  it('删件必须清掉所有相关槽位:同一件被挂在两个槽上也要一起摘干净', () => {
    assigned = []
    // 一件被同时挂在两个槽上(异常状态:改内容 / 老档 / 别的 bug 留下的)
    const slots = { weapon: 'g1', ring: 'g1', body: 'g2' }
    const cleared = bag.unassignUid(slots, 'g1')
    console.log(`  摘掉 g1:清空的槽位 ${cleared.cleared.join('、')} · 剩下的表 ${JSON.stringify(cleared.slots)}`)

    expect(cleared.cleared.sort()).toEqual(['ring', 'weapon'])
    expect(cleared.slots).toEqual({ body: 'g2' })
    // 没挂在任何槽上的件:表原样返回(不产生新对象也无所谓,关键是 cleared 为空)
    expect(bag.unassignUid(slots, 'g9').cleared).toEqual([])
    // replace 是"件还是那件、数据变了":占位与槽位都不动
    const holding = bag.create([gear('g1', 1), gear('g2', 1)])
    const replaced = bag.replace(holding, gear('g1', 5))
    expect(replaced.found).toBe(true)
    expect(replaced.holding.items.find(i => i.uid === 'g1')!.quality).toBe(5)
    expect(bag.count(replaced.holding)).toBe(bag.count(holding))
    // 防空转:换一个不存在的 uid 时什么都不动(found=false)
    expect(bag.replace(holding, gear('nope')).found).toBe(false)
  })
})
