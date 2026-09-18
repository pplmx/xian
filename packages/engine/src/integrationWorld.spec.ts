/* eslint-disable no-console */
/**
 * 组合验收(第七条链)—— **会变的世界**:每天换一种行情,抽到的事要切题,玩家的选择要算数。
 *
 * `examples/world-loop.ts` 证明这条循环**跑得起来**;这一份证明它**账对得上**,而且钉住三件
 * 跨模块才看得出来的事:
 *
 *   一 **周期不消耗全局随机流**:行情由"周期序号 → 内部种子"派生,所以整条链里只有
 *      内容池与抉择在掷骰。把"问今天是什么行情"与"问接下来三天"的次数翻几倍,整条链的账目
 *     必须**一位不变** —— 这条是"同一颗种子跑两遍结果一样"在多模块下的样子;
 *   二 **切题是真的**:抽到的牌要么没有场所标签(通用),要么与当天行情的标签有交集 ——
 *      否则玩家会在"晴天"里读到"暴雨冲垮了桥";
 *   三 **一次性牌只碰一次**:30 天里抽到过的 `once` 牌不会再出现(内容池按"见过"排除)。
 *
 * 另外两条通用不变量也一并验:**同种子两遍逐字段一致**、**账目守恒**(每天效果的金额之和 = 账本增量)。
 */
import { describe, expect, it } from 'vitest'
import { createRng } from './rng.js'
import { createCycleSystem } from './cycles.js'
import { drawFrom } from './deck.js'
import type { DeckEntry } from './deck.js'
import { createChoiceSystem } from './choices.js'
import { createResourceSystem } from './resources.js'
import { createSettlement } from './settlement.js'

// ——— 内容:四种行情 —— 每天一种(确定性轮换) ———

interface Weather {
  id: string
  name: string
  weight: number
  /** 场所标签:内容池按它切题 */
  tags: readonly string[]
}

const WEATHERS: Weather[] = [
  { id: 'clear', name: '晴', weight: 35, tags: ['野外', '晒场'] },
  { id: 'rain', name: '雨', weight: 30, tags: ['野外', '屋檐'] },
  { id: 'wind', name: '风', weight: 25, tags: ['野外', '高处'] },
  { id: 'fog', name: '雾', weight: 10, tags: ['野外', '水边'] }
]

const cycles = createCycleSystem({ periodSec: 86_400, pools: { world: WEATHERS } })

// ——— 内容:事件池 —— 一张牌一处场所,两张一次性 ———

interface Card extends DeckEntry {
  name: string
  /** 这一张的效果(由抉择层解释) */
  effects: readonly { kind: 'gain' | 'lose'; amount: number }[]
}

const CARDS: Card[] = [
  { id: 'herb', name: '采到药', weight: 100, tags: ['野外'], effects: [{ kind: 'gain', amount: 6 }] },
  { id: 'cave', name: '崖洞避风', weight: 60, tags: ['高处'], effects: [{ kind: 'gain', amount: 4 }] },
  { id: 'boat', name: '渡船过雾', weight: 60, tags: ['水边'], effects: [{ kind: 'gain', amount: 5 }] },
  { id: 'raincoat', name: '屋檐下躲雨', weight: 60, tags: ['屋檐'], effects: [{ kind: 'gain', amount: 3 }] },
  { id: 'market', name: '晒场赶集', weight: 60, tags: ['晒场'], effects: [{ kind: 'gain', amount: 7 }] },
  { id: 'generic', name: '路边的野果', weight: 40, effects: [{ kind: 'gain', amount: 2 }] },
  { id: 'relic', name: '雨后的古井', weight: 12, tags: ['野外'], once: true, effects: [{ kind: 'gain', amount: 20 }] },
  { id: 'storm', name: '狂风折断的树', weight: 8, tags: ['野外'], once: true, effects: [{ kind: 'lose', amount: 15 }] }
]

// ——— 内容:抉择 —— 同一张牌有"拿"与"绕开"两条路 ——

const choices = createChoiceSystem<{ kind: 'gain' | 'lose'; amount: number }, { brave: boolean }>({
  interpret: effect => (effect.kind === 'gain' ? `进项 +${effect.amount}` : `折损 ${effect.amount}`)
})

const ledger = createResourceSystem({ resources: [{ key: 'coin', name: '铜钱', integer: true }] })
const settlement = createSettlement({ resources: ledger })

interface DayRow {
  day: number
  weather: string
  card: string
  line: string
  delta: number
}

interface ChainResult {
  days: DayRow[]
  coin: number
  /** 见过的牌子(一次性牌按它排除) */
  seen: string[]
  weathers: string[]
  /** 整条链消耗的随机数(用来验"问行情不掷骰") */
  draws: number
}

/** 跑 30 天:每天问行情 → 抽一张切题的牌 → 掷一次后果 → 落账 */
function runWorld(seed: string, noise = 0): ChainResult {
  const inner = createRng(seed)
  let draws = 0
  /** 数骰子的包装:把"谁在消耗随机流"变成可数的东西 */
  const rng = {
    next: () => (draws += 1, inner.next()),
    int: (min: number, max: number) => (draws += 1, inner.int(min, max)),
    float: (min: number, max: number) => (draws += 1, inner.float(min, max)),
    chance: (p: number) => (draws += 1, inner.chance(p)),
    pick: <T>(arr: readonly T[]) => (draws += 1, inner.pick(arr)),
    weighted: <T>(items: readonly T[], weightOf: (item: T) => number) => (draws += 1, inner.weighted(items, weightOf))
  }

  const days: DayRow[] = []
  const seen: string[] = []
  const weathers: string[] = []
  let wallet = ledger.create({ coin: 0 })

  for (let day = 0; day < 30; day += 1) {
    const at = cycles.at(day * 86_400, { pool: 'world' })
    const weather = at.entry as Weather
    weathers.push(weather.id)
    // noise:多问几次"今天是什么"与"接下来三天"(不该影响任何账目)
    for (let n = 0; n < noise; n += 1) {
      cycles.at(day * 86_400, { pool: 'world' })
      cycles.schedule(day * 86_400, 3, { pool: 'world' })
    }

    const card = drawFrom(CARDS, { level: 1, tags: weather.tags, seen }, rng)
    if (!card) break
    if (card.once) seen.push(card.id)

    // 一张牌两条路:状态好就"拿",否则"绕开"(后果按权重掷)
    const brave = ledger.numberOf(wallet, 'coin') >= 0
    const pick = choices.resolve(
      {
        id: card.id,
        label: card.name,
        outcomes: [
          { weight: 70, text: `${card.name} · 上手`, effects: card.effects },
          { weight: 30, text: `${card.name} · 白忙一场`, effects: [] }
        ],
        isDefault: true
      },
      { brave },
      rng
    )
    const effect = pick.outcome.effects?.[0]
    const delta = effect ? effect.amount * (effect.kind === 'gain' ? 1 : -1) : 0
    const settled = settlement.settle(wallet, { grants: [{ key: 'coin', amount: delta, source: card.name }] })
    wallet = settled.ledger
    days.push({ day, weather: weather.name, card: card.name, line: pick.text, delta })
  }

  return { days, coin: ledger.numberOf(wallet, 'coin'), seen, weathers, draws }
}

describe('组合验收 —— 会变的世界:行情、切题与选择的账', () => {
  it('问行情不掷骰:把"问今天"与"问预告"翻 8 倍,整条链一位不变', () => {
    const once = runWorld('会变的世界')
    const noisy = runWorld('会变的世界', 8)
    console.log(`  30 天:行情 ${[...new Set(once.weathers)].join('/')} · 抽到 ${once.days.length} 次 · 铜钱 ${once.coin} · 掷骰 ${once.draws}`)
    console.log(`  多问 8 倍"今天/预告"之后:铜钱 ${noisy.coin} · 掷骰 ${noisy.draws}(应当完全相同)`)

    // 一 周期不消耗随机流:多问只影响"被问过几次",不影响任何账目与随机消耗
    expect(noisy.draws).toBe(once.draws)
    expect(noisy.coin).toBe(once.coin)
    expect(noisy.days).toEqual(once.days)
    // 防空转:这条链里确实在掷骰(否则上面比的是两个 0)
    expect(once.draws).toBeGreaterThan(once.days.length)
  })

  it('切题是真的:抽到的牌要么通用,要么与当天行情的标签有交集', () => {
    const result = runWorld('切题')
    const byId = new Map(CARDS.map(card => [card.id, card]))
    const mismatched = result.days.filter(row => {
      const card = [...byId.values()].find(c => c.name === row.card)!
      const weather = WEATHERS.find(w => w.name === row.weather)!
      const tags = card.tags ?? []
      return tags.length > 0 && !tags.some(tag => weather.tags.includes(tag))
    })
    console.log(`  30 天里不切题的 ${mismatched.length} 次(应为 0)`)

    // 二 切题:有场所标签的牌必须与当天行情相交
    expect(mismatched).toEqual([])
    // 防空转:样本里既有通用牌也有带标签的牌(否则"切题"这条判据没有内容)
    expect(result.days.some(row => row.card === '路边的野果')).toBe(true)
    expect(result.days.some(row => row.card !== '路边的野果')).toBe(true)
  })

  it('一次性牌只碰一次:30 天里抽到过的不再出现', () => {
    const result = runWorld('一次性')
    const onceIds = CARDS.filter(card => card.once).map(card => card.id)
    const names = new Set(result.days.map(row => row.card))
    const repeated = onceIds.filter(id => {
      const name = CARDS.find(card => card.id === id)!.name
      return result.days.filter(row => row.card === name).length > 1
    })
    console.log(`  一次性牌 ${onceIds.length} 张,本次遇到 ${onceIds.filter(id => names.has(CARDS.find(c => c.id === id)!.name)).length} 张,重复 ${repeated.length} 次`)

    // 三 一次性牌不重复
    expect(repeated).toEqual([])
    // 防空转:确实遇到过一次性牌(否则"不重复"是空话)
    expect(onceIds.some(id => names.has(CARDS.find(card => card.id === id)!.name))).toBe(true)
    expect(result.seen.length).toBeGreaterThan(0)
  })

  it('账目守恒 + 同种子可复现', () => {
    const first = runWorld('守恒')
    const second = runWorld('守恒')
    const sum = first.days.reduce((acc, row) => acc + row.delta, 0)
    console.log(`  30 天效果之和 ${sum} · 账本余额 ${first.coin}(应当相等)`)

    // 账目守恒:每天效果的金额之和 = 账本增量(这一条链上没有上限截断,所以应当严格相等)
    expect(first.coin).toBe(sum)
    // 同种子两遍逐字段一致
    expect(second).toEqual(first)
    // 换一颗种子就不同(否则上面那条是碰巧)
    expect(runWorld('换种子')).not.toEqual(first)
  })
})
