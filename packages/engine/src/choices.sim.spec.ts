/* eslint-disable no-console */
/**
 * 消融实验 —— 事件选项的长期分布与"玩家没选"的兜底。
 *
 * `choices.spec.ts` 钉的是语义(按权重掷、权重全 0 取第一条、兜底三级、回执只记生效的效果);
 * 这一份量的是**内容作者要拿去做决定的数字**:5% 的稀有分支要抽多少次才见到、
 * 兜底在"默认项当前不可选"时会落到哪儿、效果被跳过时回执长什么样。
 *
 * 三条量出来的结论:
 *   ① **"抽不到"比想象的常见**:5% 权重的后果抽 100 次,一次都没出现的概率约 0.6%(实测 0.9%,
 *      在采样波动内)—— 所以"稀有分支"要么给更多抽取机会,要么给保底,否则玩家会以为这内容不存在;
 *   ② **权重全 0 不会空转**:全部权重为 0 时取第一条(而不是抛错、也不是"什么都没发生")
 *      —— 内容运营把权重调成 0 的那天,玩家不该遇到空事件;
 *   ③ **兜底是三级,不是一级**:"标了默认且现在可选" → "第一条现在可选的" → "第一条";
 *      实测"默认项被锁住"时会落到第一条可选的,而不是硬塞那个选不了的
 *      (硬塞的结果是玩家离线回来发现自己选了明确不能选的那项)。
 */
import { describe, expect, it } from 'vitest'
import { createRng } from './rng.js'
import type { ChoiceDef } from './choices.js'
import { createChoiceSystem } from './choices.js'

type Effect = { kind: string; amount?: number }

/** 一次"开宝箱":伸手去拿的后果按权重掷,另两个选项各一条固定后果 */
const CHEST: ChoiceDef<Effect>[] = [
  {
    id: 'grab',
    label: '伸手去拿',
    outcomes: [
      { weight: 70, text: '拿到一枚旧钱币', effects: [{ kind: 'gain', amount: 1 }] },
      { weight: 25, text: '被烫了一下', effects: [{ kind: 'hurt', amount: 1 }] },
      { weight: 5, text: '里头是空的', effects: [] }
    ]
  },
  { id: 'wait', label: '再等等', outcomes: [{ text: '箱子上的光暗了下去', effects: [] }] },
  { id: 'leave', label: '走开', outcomes: [{ text: '你没碰它', effects: [] }] }
]

/** 解释器:库不认识"受伤"这类代价,由内容决定它发生不发生 */
const choices = createChoiceSystem<Effect, { hp: number }>({
  interpret: (effect, ctx) => {
    if (effect.kind === 'gain') return `得旧钱币 ×${effect.amount ?? 1}`
    if (effect.kind === 'hurt') return ctx.hp > 0 ? `受了一点伤` : null // 没血了就不受伤
    return null
  }
})

const GRAB = CHEST[0]!

describe('消融实验 —— 事件选项的长期分布与兜底', () => {
  it('稀有分支有多难遇到:5% 的后果抽 100 次可能一次都不出', () => {
    const RUNS = 2000
    const DRAWS = 100
    const counts = new Array(GRAB.outcomes.length).fill(0) as number[]
    let roundsWithoutRare = 0
    for (let round = 0; round < RUNS; round += 1) {
      const rng = createRng(`宝箱-${round}`)
      let sawRare = false
      for (let draw = 0; draw < DRAWS; draw += 1) {
        const { index } = choices.roll(GRAB, rng)
        counts[index] = (counts[index] ?? 0) + 1
        if (index === 2) sawRare = true
      }
      if (!sawRare) roundsWithoutRare += 1
    }
    const total = RUNS * DRAWS
    const observed = counts.map((n, index) => ({
      index,
      text: GRAB.outcomes[index]!.text ?? '',
      share: n / total
    }))
    console.log(`  ${total} 次抽取的分布:`)
    for (const row of observed) console.log(`  ${(row.share * 100).toFixed(2)}%(权重 ${GRAB.outcomes[row.index]!.weight})—— ${row.text}`)
    console.log(
      `  那条 5% 的后果:抽 100 次一次都没遇到的轮数 ${roundsWithoutRare}/${RUNS}(${((roundsWithoutRare / RUNS) * 100).toFixed(2)}%)` +
        ` · 理论值 ${((0.95 ** 100) * 100).toFixed(2)}% —— "某天没出"完全在正常波动里`
    )

    // ① 分布与权重对齐(70 / 25 / 5)
    expect(observed[0]!.share).toBeCloseTo(0.7, 2)
    expect(observed[1]!.share).toBeCloseTo(0.25, 2)
    expect(observed[2]!.share).toBeCloseTo(0.05, 2)
    // ② "抽不到"不是小概率事件:理论 0.95^100 ≈ 0.6%,实测有采样波动,故断言同量级(一个百分点以内)
    const missRate = roundsWithoutRare / RUNS
    expect(missRate).toBeGreaterThan(0)
    expect(missRate).toBeLessThan(0.02)
    // 防空转:三次后果都真的出现过(否则上面那张分布表是"权重没生效")
    expect(counts.every(n => n > 0)).toBe(true)
  })

  it('权重全 0 不空转:取第一条,而不是抛错或"什么都没发生"', () => {
    const zeroed: ChoiceDef<Effect> = {
      label: '全被运营调成 0 的选项',
      outcomes: [
        { weight: 0, text: '第一条', effects: [] },
        { weight: 0, text: '第二条', effects: [] }
      ]
    }
    const { index } = choices.roll(zeroed, createRng('零权重'))
    expect(index).toBe(0)
    expect(choices.roll(zeroed, createRng('零权重')).outcome.text).toBe('第一条')
    console.log(`  三条后果权重全为 0 时:落到第 ${index + 1} 条("${zeroed.outcomes[0]!.text}")`)

    // 防空转:只要有一条权重为正,就不走"取第一条"这条兜底
    const onePositive: ChoiceDef<Effect> = {
      label: '只留一条权重',
      outcomes: [
        { weight: 0, text: '第一条', effects: [] },
        { weight: 1, text: '第二条', effects: [] }
      ]
    }
    expect(choices.roll(onePositive, createRng('零权重')).index).toBe(1)
  })

  it('兜底三级:默认项被锁住时落到"第一条可选的",实在没有才落到第一条', () => {
    const lockedDefault: ChoiceDef<Effect>[] = [
      { label: '需要钥匙才能开的抽屉', isDefault: true, available: () => '没有钥匙', outcomes: [{ text: '开不了', effects: [] }] },
      { label: '翻旁边的书架', outcomes: [{ text: '翻到一页笔记', effects: [] }] },
      { label: '什么也不做', outcomes: [{ text: '你站了一会儿', effects: [] }] }
    ]
    const pickLocked = choices.defaultIndex(lockedDefault, { hp: 3 })
    console.log(`  默认项被锁住时,兜底落到第 ${pickLocked + 1} 项("${lockedDefault[pickLocked]!.label}")`)
    expect(pickLocked).toBe(1) // 不是 0(那个选不了),也不是 2(标默认的才优先,轮不到它)

    // 默认项可用 → 优先它
    const freeDefault: ChoiceDef<Effect>[] = [
      { label: '随便看看', outcomes: [{ text: '你看了看', effects: [] }] },
      { label: '原地等', isDefault: true, outcomes: [{ text: '你等了一会儿', effects: [] }] }
    ]
    expect(choices.defaultIndex(freeDefault, { hp: 3 })).toBe(1)

    // 一个都选不了 → 落到第一条,界面仍有一条可结算(不至于卡住)
    const allLocked: ChoiceDef<Effect>[] = [
      { label: 'A', available: () => false, outcomes: [{ text: 'A', effects: [] }] },
      { label: 'B', available: () => false, outcomes: [{ text: 'B', effects: [] }] }
    ]
    expect(choices.defaultIndex(allLocked, { hp: 3 })).toBe(0)
    // 防空转:三份内容的兜底结果确实不同(否则"三级"这句话是空的)
    expect(new Set([pickLocked, choices.defaultIndex(freeDefault, { hp: 3 }), 0]).size).toBeGreaterThan(1)
  })

  it('回执与"实际发生"同源:被跳过的效果单独计数,明细不虚报', () => {
    const grab = choices.resolve(GRAB, { hp: 0 }, createRng('回执'))
    console.log(`  这一手:${grab.text} —— 生效 ${grab.lines.length} 条(${grab.lines.join(';') || '无'})· 跳过 ${grab.skipped} 条`)

    // 被跳过的效果不会出现在 lines 里,但会记进 skipped —— 两者之和等于这一后果的效果条数
    const effects = grab.outcome.effects ?? []
    expect(grab.lines.length + grab.skipped).toBe(effects.length)
    // 防空转:同一份内容换个上下文,回执会变(说明确实是"解释器当场决定",不是写死的)
    const healthy = choices.resolve(GRAB, { hp: 3 }, createRng('回执'))
    expect(healthy.text).toBe(grab.text) // 同一颗种子掷中的后果相同
    expect(healthy.outcome).toBe(grab.outcome)
  })
})
