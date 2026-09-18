/* eslint-disable no-console -- 示例程序就是要打印给人看 */
/**
 * 收集与抽取的完整小循环 —— 「星屑集册」。
 *
 * 运行:`bun packages/engine/examples/collect-loop.ts`(或 `bun run examples`)
 *
 * 前面几份示例走的是"等级 → 掉装 → 副本"那条骨架;这一份换成**抽卡收集**类玩法,
 * 把库较新的几层真正用进内容里:
 *
 *   deck        内容池:按场所标签切题、一次性(抽到就不再出现)、带权重
 *   pity        跨次保底:软保底(越抽越容易)+ 第 12 抽必出,而且**保底照样掷骰**
 *   codex       集册:照面累计升档、只记见过的最好一件
 *   intake      重复的怎么办:收下 / 折算成星屑(各条去路共用一条折算账)
 *   resources   账本:金币、星屑、券(上限 / 取整 / 收支带来源)
 *   settlement  每次结算给一份**实际入账**的回执(与界面上的数字同源)
 *   tasks       今日三件:抽 10 次 / 抽到一件限定 / 花掉 30 金币(按增量结算)
 *   unlocks     一次性成就:集齐三种、抽满 30 次
 *   economy     体检:哪个资源是瓶颈、哪个只进不出
 *
 * 整份程序没有一个字提到修仙 —— 换掉名字与数字,它就是另一款游戏的"抽卡 + 图鉴 + 日常"。
 */
import {
  createCodex,
  createEconomyReadings,
  createHoldingSystem,
  createIntake,
  createPityCounter,
  createResourceSystem,
  createRng,
  createSettlement,
  createTaskBoard,
  createUnlockRegistry,
  drawFrom,
  drawMany,
  snapshotOf,
  deltaSince,
  softChance,
  type DeckEntry
} from '../src/index.js'

// ——— 1 · 内容池:三种卡,按场所切题,一次性 ———

interface Card extends DeckEntry {
  name: string
  rarity: number // 0 常驻 / 1 限定 / 2 典藏
}

const CARDS: Card[] = [
  { id: 'c_pin', name: '铜徽章', weight: 100, rarity: 0, tags: ['市集'] },
  { id: 'c_coin', name: '旧钱币', weight: 80, rarity: 0, tags: ['市集', '遗迹'] },
  { id: 'c_marble', name: '玻璃珠', weight: 70, rarity: 0, tags: ['市集'] },
  { id: 'c_lamp', name: '长明灯', weight: 40, rarity: 1, tags: ['遗迹'], min: 2, once: true },
  { id: 'c_star', name: '星屑结晶', weight: 6, rarity: 2, tags: ['遗迹', '星空'], min: 4, once: true }
]

// ——— 2 · 账本与结算 ———

const ledger = createResourceSystem({
  resources: [
    { key: 'coin', name: '金币', integer: true },
    { key: 'shard', name: '星屑', integer: true },
    { key: 'ticket', name: '券', integer: true }
  ]
})
const settlement = createSettlement({ resources: ledger })

// ——— 3 · 集册:照面两次算"眼熟",四次算"认得" ———
const codex = createCodex({
  stages: [
    { name: '初见', at: 0 },
    { name: '眼熟', at: 2 },
    { name: '认得', at: 4 }
  ]
})

// ——— 4 · 重复的怎么办:收得下就收,重复的折成星屑(两条去路共用一条折算账) ———
interface Owned {
  uid: string
  id: string
  rarity: number
}
const box = createHoldingSystem<Owned>({ capacity: 6 })
const intake = createIntake<Owned, { shard: number }>({
  holding: box,
  accept: (item, holding) => !holding.items.some(o => o.id === item.id),
  fallback: item => ({ line: `重复的收进星屑×${item.rarity + 1}`, yield: { shard: item.rarity + 1 } })
})

// ——— 5 · 保底:软保底 + 第 12 抽必出 ———
// `resetOn: 'pity'` 是"自然出货不消耗保底额度"的口径(计数只被必出清掉);
// 想要更常见的那种"出货即清账",把这一行去掉即可 —— 两种作品都有,所以它是配置。
const pity = createPityCounter({ hardAt: 12, resetOn: 'pity' })
const SOFT = { step: 0.05, cap: 0.4, from: 6 }

// ——— 6 · 今日三件 + 一次性成就 ———
const tasks = createTaskBoard({
  tasks: [
    { id: 't_pull', name: '今日抽 10 次', counter: 'pulls', target: 10 },
    { id: 't_rare', name: '抽到一件限定', counter: 'rares', target: 1 },
    { id: 't_spend', name: '花掉 30 金币', counter: 'spent', target: 30 }
  ]
})
const unlocks = createUnlockRegistry({
  entries: [
    { id: 'u_three', name: '集齐三种' },
    { id: 'u_thirty', name: '抽满三十次' }
  ]
})
const readings = createEconomyReadings({ labels: { idle: '只进不出' } })

// ——— 7 · 跑一遍 ———

const rng = createRng('星屑-1')
let wallet = ledger.create({ coin: 90 })
let counters: Record<string, number> = { pulls: 0, rares: 0, spent: 0 }
let book = codex.create()
let day = tasks.rollover({ period: 'D1', base: {}, claimed: [] }, counters, 'D1')
let pityState = { counters: {} as Record<string, number> }
const seenOnce: string[] = []
let owned = box.create([])
let pityHits = 0
/** 起点快照:同一份计数既回答"生涯抽了多少",也回答"这一轮抽了多少" */
const base = snapshotOf(counters)

const lines: string[] = []
for (let pull = 1; pull <= 24; pull += 1) {
  // 抽一次花 3 金币:钱不够就整笔不扣(账本自己会说)
  const paid = ledger.pay(wallet, [{ key: 'coin', amount: 3, source: '抽取' }])
  if (!paid.ok) {
    lines.push(`第 ${pull} 抽:金币不够,收手`)
    break
  }
  wallet = paid.ledger
  counters = { ...counters, spent: (counters.spent ?? 0) + 3, pulls: (counters.pulls ?? 0) + 1 }

  // 保底:这一抽的概率由"软保底 + 第 12 抽必出"决定
  const chance = pity.chanceOf(pityState, 'main', 0.18, SOFT)
  const roll = pity.roll(pityState, 'main', rng, 0.18, SOFT)
  pityState = roll.state
  const hit = roll.hit
  if (roll.pity) pityHits += 1

  // 抽到什么由内容池决定:切题靠 tags 相交、等级不够的牌不进池(min)、一次性抽到就不再出现
  const card = hit ? drawFrom(CARDS, { level: 4, tags: ['遗迹'], seen: seenOnce }, rng) : null
  if (!card) {
    lines.push(`第 ${pull} 抽:空手(这一抽概率 ${(chance * 100).toFixed(0)}%)`)
    continue
  }
  if (card.once) seenOnce.push(card.id)
  if (card.rarity >= 1) counters = { ...counters, rares: (counters.rares ?? 0) + 1 }

  // 集册:照面累计(抽到一次算一次)
  const observed = codex.observe(book, card.id)
  book = observed.state

  // 入库:收得下就收,重复的折算成星屑 —— 两条去路共用一条折算账
  const took = intake.admit(owned, { uid: `u${pull}`, id: card.id, rarity: card.rarity })
  owned = took.holding
  const shardGain = took.yields.reduce((sum, y) => sum + (y.yield?.shard ?? 0), 0)
  if (shardGain > 0) {
    const settled = settlement.settle(wallet, { grants: [{ key: 'shard', amount: shardGain, source: '重复折算' }] })
    wallet = settled.ledger
  }
  lines.push(
    `第 ${pull} 抽:${card.name}${roll.pity ? '(保底)' : ''}${observed.advanced ? ` ——集册进「${observed.name}」` : ''}` +
      `${shardGain > 0 ? ` · ${took.lines.join(' / ')}` : ''}`
  )
}

console.log('—— 二十四抽 ——')
for (const line of lines) console.log(`  ${line}`)

// 今日三件:按**增量**结算(计数只增不减,进度 = 当前 − 期初基准)
const settledDay = tasks.settle(day, counters)
day = settledDay.state
console.log(`\n今日三件:${tasks.board(day, counters).map(r => `${r.task.name} ${r.progress}/${r.task.target}${r.claimed ? '✓' : ''}`).join(' · ')}`)

// 一次性成就:达成即解锁(只解锁一次)
const got = unlocks.scan({ unlocked: [] }, entry =>
  entry.id === 'u_three'
    ? Object.keys(book.seen).length >= 3 // 集册里够三种
    : (counters.pulls ?? 0) >= 30
)
console.log(`成就:${got.newly.map(e => e.name).join('、') || '(还没够)'}`)

// 经济体检:星屑只进不出 → "只进不出"这一档要能说出来,而不是显示成"刚刚好"
const report = readings.read([
  { key: 'coin', income: 90, sink: counters.spent ?? 0 },
  { key: 'shard', income: ledger.numberOf(wallet, 'shard'), sink: 0, note: '星屑还没有出口' }
])
console.log(
  `体检:${report.map(r => `${r.key}=${r.verdict}${r.note ? `(${r.note})` : ''}`).join(' · ')}`
)

// 一次给几样:开盒 / 开局天赋这类"一口气抽 N 张、这一轮不重复"的用法
const bundle = drawMany(CARDS, { level: 4, tags: ['市集'], seen: seenOnce }, rng, 3)
console.log(`开盒三张(一轮不重复):${bundle.map(c => c.name).join(' / ')}`)

// 软保底曲线本身也是公开的:想知道"下一抽的自然概率是多少"直接问它
console.log(
  `软保底曲线(从第 ${SOFT.from} 抽起每抽 +5%,封顶 +${SOFT.cap * 100}%):` +
    [
      `第 ${SOFT.from} 抽 ${(softChance(0.18, SOFT.from, SOFT) * 100).toFixed(1)}%`,
      `第 ${SOFT.from + 4} 抽 ${(softChance(0.18, SOFT.from + 4, SOFT) * 100).toFixed(1)}%`
    ].join(' · ')
)

console.log(
  `\n没有一行提到修仙:内容池(${CARDS.length} 张,其中一次性 ${CARDS.filter(c => c.once).length} 张) · ` +
    `抽了 ${counters.pulls} 次 · 集册 ${Object.keys(book.seen).length} 种 · 账本 ` +
    `${ledger.defs.map(d => `${d.name} ${ledger.numberOf(wallet, d.key)}`).join(' / ')} · ` +
    `保底出货 ${pityHits} 次 · 本段增量(自快照起)抽数 +${deltaSince(base, counters, 'pulls')}`
)
