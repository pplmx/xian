/* eslint-disable no-console -- 示例程序就是要打印给人看 */
/**
 * 任务系统的完整小循环 —— 「自习室的一天」。
 *
 * 运行:`bun packages/engine/examples/quest-loop.ts`(或 `bun run examples`)
 *
 * 主线(`chain`)、今日(`tasks`)、一次性成就(`goals` + 一次性解锁)看着是三件事,
 * 其实是同一套东西的三种问法:**同一个计数器,问"走到哪一节了""今天干了多少""够不够格"**。
 * 这份示例把它们串起来,而且没有一个字提到修仙:
 *
 *   counters  计数器与基准快照 —— 生涯累计不动,本期多少用基准算
 *   tasks     今日三件:按当日增量结算(自动发放),换期幂等
 *   chain     主线三节:背词 → 连打三天 → 读完一本(一次结算可连推多节)
 *   goals     条件判据的唯一一份:主线、今日、成就、界面读数都读它
 *
 * 想要的读法:换掉名字与数字,它就是另一款游戏的"任务页"。
 */
import {
  createChain,
  createResourceSystem,
  createTaskBoard,
  deltaOf,
  deltaSince,
  evalGoal,
  goalProgress,
  snapshotOf,
  type GoalCond,
  type GoalEnv
} from '../src/index.js'

// ——— 0. 奖品:一张小账本(专注点) ———
const wallet = createResourceSystem({ resources: [{ key: 'focus', name: '专注点', integer: true }] })
let ledger = wallet.create()
const grant = (amount: number, source: string): void => {
  ledger = wallet.grant(ledger, [{ key: 'focus', amount, source }]).ledger
}
const focusTotal = (): number => wallet.numberOf(ledger, 'focus')

// ——— 1. 计数器:只增不减,生涯与本期共用 ———
let counters: Record<string, number> = { words: 0, reviews: 0, shares: 0, days: 0 }
const track = (key: string, n = 1): void => {
  counters = { ...counters, [key]: (counters[key] ?? 0) + n }
}

/** 条件判据的环境 —— 库不认识"词""复习",这些名字全由使用方给 */
const env = (): GoalEnv => ({
  counter: key => counters[key] ?? 0,
  level: () => Math.floor((counters.words ?? 0) / 50), // 这里把"等级"也定义成词的函数,纯属内容选择
  custom: key => key === 'book1' && (counters.books ?? 0) >= 1
})

// ——— 2. 今日三件:按当日增量结算 ———
const today = createTaskBoard({
  tasks: [
    { id: 't_words', name: '今日 20 词', counter: 'words', target: 20 },
    { id: 't_review', name: '复习一次', counter: 'reviews', target: 1 },
    { id: 't_share', name: '分享一次', counter: 'shares', target: 1 }
  ]
})
let day = today.rollover({ period: '', base: {}, claimed: [] }, counters, '2026-09-19')

// ——— 3. 主线三节:条件交给 goals,推进交给 chain ———
const mainline = createChain<{ env: GoalEnv }>({
  nodes: [
    { id: 'm_words', name: '背上 60 个词' },
    { id: 'm_days', name: '连着来三天' },
    { id: 'm_book', name: '读完第一本书' }
  ],
  maxSteps: 5,
  done: (node, ctx) => evalGoal(CONDS[node.id as keyof typeof CONDS] ?? { type: 'custom', key: 'never' }, ctx.env)
})
let mainIndex = { index: 0 }

const CONDS: Record<string, GoalCond> = {
  m_words: { type: 'counter', key: 'words', value: 60 },
  m_days: { type: 'counter', key: 'days', value: 3 },
  m_book: { type: 'custom', key: 'book1' }
}

/** 一次性成就:条件达成即解锁,只发一次 */
const ACHIEVEMENTS: { id: string; name: string; cond: GoalCond; focus: number }[] = [
  { id: 'a_100', name: '一百个词', cond: { type: 'counter', key: 'words', value: 100 }, focus: 5 },
  { id: 'a_book', name: '读到最后一页', cond: { type: 'custom', key: 'book1' }, focus: 8 }
]
const unlocked = new Set<string>()

// ——— 4. 几个动作 ———
const study = (words: number): void => {
  track('words', words)
  console.log(`  背了 ${words} 个词(累计 ${counters.words})`)
}
const review = (): void => {
  track('reviews')
  console.log('  复习了一遍旧词')
}
const share = (): void => {
  track('shares')
  console.log('  把今天的词单分享给了同桌')
}

/** 每做一件事就结算一次:今日该发的发,主线该推的推,成就该解锁的解锁 */
function settle(): void {
  const dayOut = today.settle(day, counters)
  day = dayOut.state
  for (const row of dayOut.settled) {
    const def = today.tasks.find(t => t.id === row.task.id)!
    grant(10, def.name ?? def.id)
    console.log(`  今日达成「${def.name}」+10 专注点`)
  }
  const mainOut = mainline.advance(mainIndex, { env: env() })
  mainIndex = mainOut.state
  for (const node of mainOut.advanced) console.log(`  主线推进「${node.name}」`)
  if (mainOut.capped) console.log('  (主线一轮推进到了守卫上限,下一拍继续)')
  for (const ach of ACHIEVEMENTS) {
    if (unlocked.has(ach.id) || !evalGoal(ach.cond, env())) continue
    unlocked.add(ach.id)
    grant(ach.focus, ach.name)
    console.log(`  成就解锁「${ach.name}」+${ach.focus} 专注点`)
  }
}

// ——— 5. 一天:三件小事 + 主线推进 ———
console.log('—— 第一天 ——')
study(12)
review()
settle()
study(10) // 累计 22:够今日 20,也够"背 60 个词"还差得远
share()
settle()
console.log(
  `  今日读数:${today
    .board(day, counters)
    .map(row => `${row.task.name} ${row.progress}/${row.task.target}${row.claimed ? '✓' : ''}`)
    .join(' · ')}`
)

// ——— 6. 换期:幂等(同一天再喊一次不会把今天的进度清掉) ———
const beforeBase = { ...day.base }
day = today.rollover(day, counters, '2026-09-19')
console.log(`  同一天再换一次期:基准没动(${JSON.stringify(day.base) === JSON.stringify(beforeBase)})`)
day = today.rollover(day, counters, '2026-09-20')
console.log(`  到了第二天:基准打在今天这一刻(${JSON.stringify(day.base)}),已领清空`)
console.log(`  今天还差多少:${today.board(day, counters).map(row => `${row.task.name} ${row.progress}/${row.task.target}`).join(' · ')}`)

// ——— 7. 三天之后:一次结算连推多节 ———
console.log('—— 三天之后 ——')
study(40) // 累计 62:够主线第一节了
track('days', 3) // 连着来了三天
track('books', 1) // 读完第一本
settle() // 这一次结算把三条主线一起推掉(chain 的"连推多节")
const wordsGoal = goalProgress(CONDS.m_words!, env())
console.log(
  `  主线读数:${mainIndex.index}/${mainline.nodes.length} 节 · 还剩 ${mainline.remaining(mainIndex)} 节` +
    `${wordsGoal ? `(背词 ${wordsGoal.current}/${wordsGoal.target})` : ''}`
)

// ——— 8. 本季多少:打一份基准快照,生涯累计不用动 ———
const seasonBase = snapshotOf(counters) // 开学那天打一份基准
console.log('—— 本季 ——')
study(45) // 累计 107:一百个词成就该解锁了
settle()
console.log(
  `  本季增量(生涯 ${counters.words} 词不动):${['words', 'reviews', 'shares', 'days', 'books']
    .map(key => `${key} +${deltaSince(seasonBase, counters, key)}`)
    .join(' · ')}`
)
// 只拿两个数比一比时用 deltaOf:例如"这一周比上一周多背了多少词"
const thisWeekWords = counters.words ?? 0
const lastWeekWords = thisWeekWords - 20
console.log(`  本周比上周多背 ${deltaOf(lastWeekWords, thisWeekWords)} 个词(deltaOf 只吃两个数,不需要快照)`)

// 收尾:把用到的能力都真的用了一次(示例也是判据 —— 它进类型检查与两份自检)
console.log(
  `\n没有一个字提到修仙:计数器(${Object.keys(counters).length} 个) · 今日(${today.tasks.length} 件) · ` +
    `主线(${mainIndex.index}/${mainline.nodes.length} 节) · 成就(${unlocked.size}/${ACHIEVEMENTS.length}) · 专注点 ${focusTotal()}`
)
