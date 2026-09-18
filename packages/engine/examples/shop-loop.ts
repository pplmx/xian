/* eslint-disable no-console -- 示例程序就是要打印给人看 */
/**
 * 经营模拟的完整小循环 —— 「一角点心铺」。
 *
 * 运行:`bun packages/engine/examples/shop-loop.ts`(或 `bun run examples`)
 *
 * 组装指南的四条配方里,这一份补的是**配方 D · 经营模拟**的整套骨架:
 *
 *   facilities  产线:灶台每小时出点心、柜台每小时卖几份、招牌每小时涨口碑 —— 三处都是"每小时"的速率
 *   accrue      零头不丢:不够一份的产出留在累加器里,够了整数才发(一秒一秒算也不会丢光)
 *   resources   账本:铜钱 / 点心(有上限)/ 口碑,收支带来源、超上限要截得明白
 *   settlement  每次落账给一份**实际入账**的回执(被上限截掉多少单独一栏,不与计划值混)
 *   idle        离线账:过去 8 小时里多少算数、按什么效率算、拆几步、余下多少留给下次
 *   economy     体检:哪个资源是瓶颈(进得比出得快)。**这一份的结论直接决定先升哪个设施**
 *   triage      自动清理:临期货的清仓规则链,以及"关掉某一条会少扔几件"的读数
 *   tasks       今日三件:卖出 10 份 / 进账 30 文 / 升一次设施(按增量结算)
 *
 * 整份程序没有一个字提到修仙,也没有一句话抽卡 —— 它就是"一产一销,谁卡住谁"。
 * 换成工坊、农场、矿场、书房,同一份骨架换个名字就能用。
 */
import {
  accrue,
  createEconomyReadings,
  createFacilitySystem,
  createResourceSystem,
  createSettlement,
  createTaskBoard,
  createTriage,
  deltaSince,
  planIdle,
  snapshotOf
} from '../src/index.js'

// ——— 1 · 账本:铜钱(整数)、点心(整数、上限 8 —— 铺面就这么大)、口碑 ———

const ledger = createResourceSystem({
  resources: [
    { key: 'coin', name: '铜钱', integer: true },
    { key: 'snack', name: '点心', integer: true, cap: 8 },
    { key: 'fame', name: '口碑', integer: true }
  ]
})
const settlement = createSettlement({ resources: ledger })

// ——— 2 · 产线:三座设施,产出都写"每小时多少" ———

interface ShopCtx {
  /** 口碑:决定"别的设施能升到几级"(见下面的 `cap`) */
  fame: number
}

const shop = createFacilitySystem<string, ShopCtx>({
  facilities: [
    {
      id: 'stove',
      name: '灶台',
      maxLevel: 5,
      // 别人给的上限:口碑越好,客人越多,灶台才值得升 —— 与"自家上限"取小
      cap: (_levels, ctx) => 1 + Math.floor(ctx.fame / 3),
      capReason: '口碑还撑不起更大的场面(先去把招牌做响)',
      costs: level => [{ key: 'coin', amount: 20 * (level + 1) }],
      perHour: level => ({ snack: 3.2 * level }),
      mods: level => `灶台 ${level} 级:每小时 ${(3.2 * level).toFixed(1)} 份点心`
    },
    {
      id: 'counter',
      name: '柜台',
      maxLevel: 5,
      cap: (_levels, ctx) => 1 + Math.floor(ctx.fame / 3),
      capReason: '口碑还撑不起更大的场面(先去把招牌做响)',
      costs: level => [{ key: 'coin', amount: 20 * (level + 1) }],
      // "卖"也是一条产线的速率:每小时最多出手几份
      perHour: level => ({ sell: 1 * level }),
      mods: level => `柜台 ${level} 级:每小时卖得动 ${level} 份`
    },
    {
      id: 'signboard',
      name: '招牌',
      maxLevel: 3,
      // 招牌自己**不受口碑所限**(否则"想涨口碑得先有口碑",死锁)
      costs: level => [{ key: 'coin', amount: 15 * (level + 1) }],
      perHour: level => ({ fame: 0.8 * level })
    }
  ]
})

// ——— 3 · 清理规则链:临期的先出、卖得起价的留着 ———

interface Batch {
  name: string
  qty: number
  /** 放了多少天 */
  age: number
  /** 卖相(0~1) */
  looks: number
  price: number
}

const cleanup = createTriage<Batch>({
  rules: [
    { id: 'signature', label: '招牌点心,留着', decide: b => (b.name.includes('招牌') ? true : undefined) },
    {
      id: 'stale',
      label: '隔夜且卖相一般,清掉',
      decide: b => (b.age >= 1 && b.looks < 0.6 ? { keep: false, reason: '隔夜卖相差' } : undefined)
    },
    { id: 'pricey', label: '卖得起价,留着', decide: b => (b.price >= 5 ? true : undefined) }
  ],
  fallback: { keep: true, reason: '没规矩管它,先留着' }
})

const backroom: Batch[] = [
  { name: '招牌桂花糕', qty: 3, age: 2, looks: 0.4, price: 6 },
  { name: '白糖糕', qty: 4, age: 1, looks: 0.3, price: 3 },
  { name: '枣泥酥', qty: 2, age: 2, looks: 0.5, price: 4 },
  { name: '新蒸的米糕', qty: 5, age: 0, looks: 0.9, price: 3 }
]

// ——— 4 · 今日三件 ———

const tasks = createTaskBoard({
  tasks: [
    { id: 't_sell', name: '卖出 4 份点心', counter: 'sold', target: 4 },
    { id: 't_coin', name: '进账 12 文', counter: 'earned', target: 12 },
    { id: 't_up', name: '升一次设施', counter: 'upgrades', target: 1 }
  ]
})

const readings = createEconomyReadings({ labels: { tight: '瓶颈', healthy: '顺畅', surplus: '过剩', idle: '只进不出' } })

// ——— 5 · 跑一遍:离线 8 小时,一步步补账 ———

let levels: Record<string, number> = { stove: 1, counter: 1, signboard: 0 }
let wallet = ledger.create({ coin: 40, snack: 7, fame: 3 })
let frac: Record<string, number> = {}
let counters: Record<string, number> = { sold: 0, earned: 0, upgrades: 0, clipped: 0 }
let day = tasks.rollover({ period: 'D1', base: {}, claimed: [] }, counters, 'D1')
const base = snapshotOf(counters)

const ctxOf = (): ShopCtx => ({ fame: ledger.numberOf(wallet, 'fame') })

const plan = planIdle(8 * 3600_000, { stepMs: 3600_000, capMs: 6 * 3600_000, efficiency: 0.8, maxSteps: 24 })
console.log('—— 离线八小时(回来补账)——')
console.log(
  `  时长账:过去 ${(plan.elapsedMs / 3600_000).toFixed(1)}h · 计入 ${(plan.cappedMs / 3600_000).toFixed(1)}h` +
    `${plan.capped ? `(铺子只装得下这么多,剩下的 ${(plan.overflowMs / 3600_000).toFixed(1)}h 没算)` : ''}` +
    ` · 效率 ${(plan.effectiveMs / plan.cappedMs).toFixed(2)} → 有效 ${(plan.effectiveMs / 3600_000).toFixed(1)}h` +
    ` · 拆 ${plan.steps} 步 + 余 ${(plan.remainderMs / 60_000).toFixed(0)} 分钟留给下次`
)

const hoursPerStep = plan.stepMs / 3600_000
for (let step = 1; step <= plan.steps; step += 1) {
  const ctx = ctxOf()
  const rates = shop.ratesOf(levels, ctx)
  // 零头留在累加器里:3.2 份/小时,这一步只会发 3 份,剩下的 0.2 份下次带上
  const made = accrue(frac, rates, plan.stepMs / 1000)
  frac = made.frac
  const granted = settlement.settle(
    wallet,
    { grants: Object.entries(made.whole).map(([key, amount]) => ({ key, amount, source: '铺子产出' })) }
  )
  wallet = granted.ledger
  const clipped = granted.receipt.clipped.snack ?? 0

  // 卖:能卖多少 = min(柜台一小时卖得动的量 × 这一步几小时, 手上还有多少存货)
  const sellRate = (rates.sell ?? 0) * hoursPerStep
  const want = Math.min(Math.floor(sellRate), ledger.numberOf(wallet, 'snack'))
  let earned = 0
  if (want > 0) {
    const paid = ledger.pay(wallet, [{ key: 'snack', amount: want, source: '柜台售出' }])
    wallet = paid.ledger
    earned = want * 3
    const cashed = settlement.settle(wallet, { grants: [{ key: 'coin', amount: earned, source: '柜台进账' }] })
    wallet = cashed.ledger
  }
  counters = {
    ...counters,
    sold: (counters.sold ?? 0) + want,
    earned: (counters.earned ?? 0) + earned,
    clipped: (counters.clipped ?? 0) + clipped
  }
  console.log(
    `  第 ${step} 步:出 ${made.whole.snack ?? 0} 份(零头留 ${(frac.snack ?? 0).toFixed(2)})` +
      `${clipped > 0 ? ` · 摆不下了扔掉 ${clipped} 份` : ''}` +
      ` · 卖出 ${want} 份 · 进账 ${earned} 文`
  )
}

console.log(
  `  小计:卖 ${counters.sold} 份 · 进账 ${counters.earned} 文 · 上限截掉 ${counters.clipped} 份 · ` +
    `余额 ${ledger.defs.map(d => `${d.name} ${ledger.numberOf(wallet, d.key)}`).join(' / ')}`
)

// 体检:点心**生产 3.2 份/小时、只能卖 1 份/小时** —— 出口才是瓶颈,不是产量
const before = readings.read([
  { key: '点心', income: 3.2, sink: 1, note: '按 1 级灶台 / 1 级柜台算' }
])
console.log(
  `\n体检(升级之前):点心 ${before[0]!.verdict} —— 进 3.2 / 出 1(比值 ${before[0]!.ratio.toFixed(1)}),` +
    `生产比卖得快,多出来的只能扔`
)

// 同一笔钱有两条路:升灶台(更过剩)还是升柜台(把出口撑开)?先各算一遍再花
const options = [
  { pick: 'stove', label: '升灶台', income: 3.2 * 2, sink: 1 },
  { pick: 'counter', label: '升柜台', income: 3.2, sink: 2 * 1 }
]
console.log('\n—— 同样 40 文,先升哪个?两种选择各算一遍 ——')
for (const option of options) {
  const reading = readings.read([{ key: '点心', income: option.income, sink: option.sink }])[0]!
  console.log(
    `  ${option.label}:进 ${option.income.toFixed(1)} / 出 ${option.sink.toFixed(1)} → ${reading.verdict}` +
      `(每步仍扔掉 ${Math.max(0, option.income - option.sink).toFixed(1)} 份)`
  )
}

const chosen = options[1]!
const info = shop.upgradeInfo(levels, chosen.pick, ctxOf())
const paid = ledger.pay(wallet, info.costs)
if (paid.ok) {
  wallet = paid.ledger
  levels = { ...levels, [chosen.pick]: info.nextLevel }
  counters = { ...counters, upgrades: (counters.upgrades ?? 0) + 1 }
}
console.log(
  `${chosen.label}:花 ${info.costs.map(c => `${c.amount} ${ledger.name(c.key)}`).join('、')}(剩 ${ledger.numberOf(wallet, 'coin')} 文)` +
    ` → ${shop.modsOf(levels, ctxOf()).join(' · ')}`
)

// 再问一次同一座设施:口碑只够升到 2 级 —— 门槛不止"要花多少钱",还有别人给的上限
const again = shop.upgradeInfo(levels, chosen.pick, ctxOf())
console.log(
  `再升一次:${again.can ? '可以' : `不行 —— ${again.reason}(要花 ${again.costs.map(c => c.amount).join('/')})`}`
)
// 下一步该往哪走:口碑是"别人给的上限",而招牌是唯一不被口碑所限的那一座
const signboard = shop.upgradeInfo(levels, 'signboard', ctxOf())
console.log(
  `  往远处看:招牌升 1 级要 ${signboard.costs.map(c => `${c.amount} ${ledger.name(c.key)}`).join('、')},` +
    `每小时 +0.8 口碑 —— 口碑到 6,灶台与柜台才谈得上 3 级`
)

// 清理:临期的扔掉,招牌与高价留着;关掉"隔夜清理"这条规则会少扔几件,读数看得出来
const impact = cleanup.impact(backroom)
const withoutStale = createTriage<Batch>({ rules: cleanup.rules.filter(r => r.id !== 'stale'), fallback: { keep: true, reason: '先留着' } })
console.log(
  `\n清理:留 ${impact.keep} 批 / 扔 ${impact.junk} 批` +
    `(${impact.byReason.map(r => `${r.reason}×${r.count}`).join('、')})` +
    ` —— 关掉"隔夜清理"就会变成扔 ${withoutStale.impact(backroom).junk} 批`
)
for (const decision of cleanup.partition(backroom).verdicts) {
  console.log(`  ${decision.item.name}:${decision.verdict.keep ? '留' : '扔'} —— ${decision.verdict.reason}`)
}

// 今日三件:按增量结算(计数只增不减,进度 = 当前 − 期初基准)
const settledDay = tasks.settle(day, counters)
day = settledDay.state
console.log(
  `\n今日三件:${tasks.board(day, counters).map(r => `${r.task.name} ${r.progress}/${r.task.target}${r.claimed ? '✓' : ''}`).join(' · ')}`
)

console.log(
  `\n没有一行提到修仙:${shop.facilities.length} 座设施 · 离线段增量(自快照起)卖出 +${deltaSince(base, counters, 'sold')} 份 /` +
    ` 进账 +${deltaSince(base, counters, 'earned')} 文 · 库房 ${backroom.length} 批 · 口碑 ${ledger.numberOf(wallet, 'fame')}`
)
