/* eslint-disable no-console */
/**
 * 消融实验 —— 折算账:被拒的、被挤掉的、收不下的,各留下什么。
 *
 * `intake.spec.ts` 钉的是语义(先见证再裁决、满了先腾位、腾位失败不追回、三条去路共用一条折算账);
 * 这一份量的是**玩家与内容都会问的那几个数**:一次入库一共折算了几件、腾位赚了还是亏了,
 * 以及"见证"独立于"收纳"之后,图鉴为什么不会漏记。
 *
 * 三条量出来的结论:
 *   ① **一次入库可能折算"两件"**:满了又值得留时,新来的被收下、旧件被挤掉 ——
 *      折算账里记的是**被挤掉那件**(不是新来的),这一条写反了就是"玩家看着自己那件没了,
 *      账上却说新来的被折算了";
 *   ② **腾位是"有代价的置换"**:被挤掉的件也要走折算(同一本账),所以一次入库的
 *      净收益 = 新件的价值 − 被挤掉件的折算损失;折算率低的时候,腾位可能不划算;
 *   ③ **见证与收纳是两件事**:被规则拒收的件**也进了图鉴** —— 玩家明明看见过它,
 *      不能因为"没进包"就不算见过。
 */
import { describe, expect, it } from 'vitest'
import { createHoldingSystem } from './holding.js'
import { createIntake } from './intake.js'

interface Gear {
  uid: string
  quality: number
}

const bag = createHoldingSystem<Gear>({ capacity: 3 })

/** 图鉴:见证过的都记一笔 */
const witnessed: string[] = []

const intake = createIntake<Gear, { dust: number }>({
  holding: bag,
  // 凡品(quality 0)按规则自动折算,不进包
  accept: item => item.quality > 0,
  // 满了的时候:新件比包内最差那件好,就挤掉最差的那件
  evictable: (items, incoming) => {
    const worst = [...items].sort((a, b) => a.quality - b.quality)[0]
    return worst && incoming.quality > worst.quality ? worst : undefined
  },
  fallback: item => ({ line: `化尘 +${item.quality + 1}`, yield: { dust: item.quality + 1 } }),
  witness: item => witnessed.push(item.uid)
})

const gear = (uid: string, quality: number): Gear => ({ uid, quality })
const dustOf = (result: { yields: { yield?: { dust: number } }[] }): number =>
  result.yields.reduce((sum, y) => sum + (y.yield?.dust ?? 0), 0)

describe('消融实验 —— 折算账:被拒的、被挤掉的、收不下的', () => {
  it('满了又值得留:新件收下、旧件被挤掉,折算记的是被挤掉那件', () => {
    const packed = bag.create([gear('a', 1), gear('b', 1), gear('c', 1)])
    const result = intake.admit(packed, gear('new', 3))
    console.log(`  塞满 3 件(品质 1)→ 来一件品质 3:${result.admitted ? '收下' : '没收下'} · ${result.lines.join(' / ')}`)

    // ① 收下了,而且被挤掉的是包内最差的那件(不是新来的)
    expect(result.admitted).toBe(true)
    expect(result.evicted?.uid).toBe('a')
    expect(result.reason).toBeUndefined()
    expect(result.yields.map(y => y.item.uid)).toEqual(['a'])
    // 包里的构成:新件进来了,被挤掉的那件走了
    expect(bag.list(result.holding).map(i => i.uid)).toEqual(['b', 'c', 'new'])
    // 防空转:如果新件不值得留,就不该挤位(那条路在下一个用例里)
    expect(result.yields.length).toBeGreaterThan(0)
  })

  it('腾位是有代价的置换:净收益 = 新件价值 − 被挤掉件的折算损失', () => {
    const packed = bag.create([gear('w1', 1), gear('w2', 4), gear('w3', 1)])
    const result = intake.admit(packed, gear('mid', 2))
    const gain = dustOf(result)
    console.log(`  塞满 3 件(品质 1/4/1)→ 来一件品质 2:${result.admitted ? '收下' : '没收下'} · 折算 ${gain} 尘`)

    // ② 新件(2)比最差的(1)好 → 挤掉一件 1;折算 = 那件 1 的折算值(2 尘)
    expect(result.evicted?.quality).toBe(1)
    expect(gain).toBe(2)
    // 净变化:包里多了品质 2、少了品质 1 —— 收益是"战力上的一点",代价是折算掉的 2 尘
    expect(bag.count(result.holding)).toBe(3) // 件数不变(置换,不是净增)
    expect(bag.list(result.holding).some(i => i.uid === 'mid')).toBe(true)
    // 防空转:拿一件不值得留的(品质 1 对品质 1)来,就不该发生置换
    const tie = intake.admit(bag.create([gear('x', 1), gear('y', 1), gear('z', 1)]), gear('same', 1))
    expect(tie.admitted).toBe(false)
    expect(tie.reason).toBe('full')
  })

  it('被规则拒收的件照样进图鉴:见证与收纳是两件事', () => {
    witnessed.length = 0
    const result = intake.admit(bag.create([]), gear('junk', 0))
    console.log(`  凡品被规则拒收:${result.admitted ? '收下' : `没收下(${result.reason})`} · 见证记录 ${witnessed.length} 条 · ${result.lines.join(' / ')}`)

    // ③ 拒收走的是折算(不是丢弃),而"见过"已经记下了
    expect(result.admitted).toBe(false)
    expect(result.reason).toBe('rejected')
    expect(witnessed).toEqual(['junk'])
    expect(dustOf(result)).toBe(1)
    // 防空转:收下的件也会被见证(否则"见证"可能只在拒收时走)
    const admitted = intake.admit(bag.create([]), gear('good', 2))
    expect(admitted.admitted).toBe(true)
    expect(witnessed).toEqual(['junk', 'good'])
  })

  it('收不下且不值得留:走折算,不腾位', () => {
    const packed = bag.create([gear('p', 4), gear('q', 4), gear('r', 4)])
    const result = intake.admit(packed, gear('weak', 2))
    console.log(`  塞满三件品质 4 → 来一件品质 2:${result.admitted ? '收下' : `没收下(${result.reason})`} · ${result.lines.join(' / ')}`)

    // 收不下 → 折算新来的那件(而不是挤掉一件好的)
    expect(result.admitted).toBe(false)
    expect(result.reason).toBe('full')
    expect(result.evicted).toBeUndefined()
    expect(result.yields.map(y => y.item.uid)).toEqual(['weak'])
    // 包没被动过
    expect(bag.list(result.holding).map(i => i.uid)).toEqual(['p', 'q', 'r'])
    // 防空转:同一件如果值得留,结果完全不同(上上个用例已证)
    expect(dustOf(result)).toBe(3)
  })
})
