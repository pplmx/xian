/* eslint-disable no-console -- 示例程序就是要打印给人看 */
/**
 * 一个"会变的世界"的小循环 —— 「行商十二日」。
 *
 * 运行:`bun packages/engine/examples/world-loop.ts`(或 `bun run examples`)
 *
 * 这份示例专门演示四层**彼此配合**的东西 —— 它们此前在库里都有判据、却没有一份跑得起来的示例:
 *
 *   cycles      每天换一次行情(确定性:同一个游戏日永远同一种行情,不消耗全局随机流)
 *   choices     路上遇到的事:按权重掷后果,效果由内容解释,玩家没选时有兜底
 *   points      挣到的"门道点"往三条路上投(总容量 + 主位/副位两档上限)
 *   memory      走过的地方攒名声:计数与"守着多少小时"两路门槛取先到,久了不去会回落
 *
 * 一整份内容都在下面,没有一个字提到修仙,也没提抽卡 —— 它就是"出门、遇事、加点、留名"。
 */
import {
  createChoiceSystem,
  createCycleSystem,
  createPointPool,
  createRng,
  createResourceSystem,
  createStageMemory
} from '../src/index.js'

// ——— 1 · 每天换一次的"行情"(确定性轮换) ———

interface Market {
  id: string
  name: string
  weight: number
  /** 这一天的买卖加成 */
  mult: number
}

const MARKETS: Market[] = [
  { id: 'fair', name: '集市日', weight: 30, mult: 1.4 },
  { id: 'usual', name: '平常日', weight: 40, mult: 1 },
  { id: 'quiet', name: '冷清日', weight: 20, mult: 0.7 },
  { id: 'storm', name: '风雨日', weight: 10, mult: 0.4 }
]

const markets = createCycleSystem({
  periodSec: 86_400, // 一个游戏日
  pools: { road: MARKETS }
})

// ——— 2 · 路途上的事(抉择) ———

type Effect = { kind: 'gain' | 'lose'; amount: number }

const TRAVELS = [
  {
    id: 'fork',
    label: '岔路口',
    outcomes: [
      { weight: 50, text: '走官道,顺当', effects: [{ kind: 'gain', amount: 8 } as Effect] },
      { weight: 35, text: '抄小路,省了半天', effects: [{ kind: 'gain', amount: 12 } as Effect] },
      { weight: 15, text: '小路塌方,赔了货', effects: [{ kind: 'lose', amount: 6 } as Effect] }
    ]
  },
  {
    id: 'stranger',
    label: '路边有人搭话',
    outcomes: [
      { weight: 60, text: '换了点消息', effects: [{ kind: 'gain', amount: 4 } as Effect] },
      { weight: 40, text: '被赊了一笔账', effects: [{ kind: 'lose', amount: 3 } as Effect] }
    ],
    isDefault: true
  },
  {
    id: 'shortcut',
    label: '抄近路(要有本钱)',
    available: (ctx: unknown) => ((ctx as { coin: number }).coin >= 20 ? true : '本钱不够 20,走不起'),
    outcomes: [{ weight: 1, text: '两天当一天走', effects: [{ kind: 'gain', amount: 20 } as Effect] }]
  }
]

const travels = createChoiceSystem<Effect, { coin: number }>({
  // 效果怎么解释由内容定:这里只是给每个效果一句人话(界面/战报直接用)
  interpret: effect => (effect.kind === 'gain' ? `进项 +${effect.amount}` : `折损 ${effect.amount}`)
})

// ——— 3 · 门道点:三条路,总容量 6,主位 4、副位 2 ———

const trades = createPointPool<string, { day: number }>({
  total: 6,
  mainCap: 4,
  sideCap: 2,
  mainCapReason: '主位已经练满',
  sideCapReason: '这一门只能做副业',
  fullReason: '门道点已经分完',
  branches: [
    { id: 'haggle', name: '砍价', effect: points => `砍价 ${points} 级` },
    { id: 'routes', name: '认路', effect: points => `认路 ${points} 级` },
    { id: 'luck', name: '遇合', mainCap: 2, effect: points => `遇合 ${points} 级` }
  ]
})

// ——— 4 · 名声:两路门槛取先到,久不去会回落 ———

const fame = createStageMemory({
  stages: [
    { id: 'unknown', name: '生面孔', mult: 1 },
    { id: 'known', name: '混个脸熟', at: { count: 3, hours: 12 }, mult: 1.05 },
    { id: 'friend', name: '熟客', at: { count: 8, hours: 36 }, mult: 1.15 }
  ],
  decayAfterHours: 48
})

// ——— 5 · 跑十二天 ———

const ledger = createResourceSystem({ resources: [{ key: 'coin', name: '本钱', integer: true }] })
const rng = createRng('行商-1')

let wallet = ledger.create({ coin: 24 })
let points = { points: {} as Record<string, number>, main: null as string | null }
let visits = 0
let lastVisitHour = 0
let hours = 0
const DAYS = 12

console.log('—— 行商十二日 ——')
for (let day = 1; day <= DAYS; day += 1) {
  hours = (day - 1) * 24
  const market = markets.at(hours * 3600, { pool: 'road' }).entry as Market
  const remaining = markets.remainingSec(hours * 3600) / 3600

  // 路上遇到一件事:按权重掷后果(有默认项,所以"没选"也有事发生)
  const encounter = TRAVELS[day % TRAVELS.length]!
  const pick = travels.resolve(encounter, { coin: ledger.numberOf(wallet, 'coin') }, rng)
  // 后果里的效果是**结构**(kind + amount),行情只乘在金额上 —— 不必回去解析文案
  const effect = pick.outcome.effects?.[0]
  const delta = effect ? Math.round(effect.amount * market.mult) * (effect.kind === 'gain' ? 1 : -1) : 0
  const settled = ledger.apply(wallet, [{ key: 'coin', amount: delta, source: `第 ${day} 天 · ${market.name}` }])
  wallet = settled.ledger
  visits += 1
  lastVisitHour = hours

  // 第 3、6、9、12 天把攒下的门道点投出去(先主位、满了再副位)
  let invested = ''
  if (day % 3 === 0) {
    for (const branch of ['haggle', 'routes', 'luck']) {
      const info = trades.investInfo(points, branch, { day })
      if (!info.can) continue
      points = trades.invest(points, branch, { day }).state
      invested = ` · 投了「${trades.branchOf(branch)?.name}」`
      break
    }
  }

  // 名声:计数(来过几次)与"守着多少小时"两路门槛取先到;每天出门,所以没闲置
  const standing = fame.stateOf({ count: visits, hours: hours, idleHours: 24 })
  console.log(
    `  第 ${String(day).padStart(2, ' ')} 天:${market.name}(×${market.mult},还有 ${remaining.toFixed(0)} 小时换) · ` +
      `${encounter.label} → ${pick.text}(${delta >= 0 ? '+' : ''}${delta}) · 本钱 ${ledger.numberOf(wallet, 'coin')}` +
      `${invested} · 名声「${standing.name}」`
  )
}

// 第 13 天起不再出门:名声会回落(48 小时不去就掉回最低档)
console.log('\n—— 歇了三天之后 ——')
const idleNow = fame.stateOf({ count: visits, hours, idleHours: 72 })
const lastVisitMs = lastVisitHour * 3_600_000
console.log(
  `  名声:歇 40 小时还是「${fame.stateOf({ count: visits, hours, idleHours: 40 }).name}」,` +
    `歇 72 小时变成「${idleNow.name}」(decayed=${idleNow.decayed})`
)
console.log(
  `  歇 40 小时时,离回落线还剩 ${fame.hoursUntil(lastVisitMs, lastVisitMs + 40 * 3_600_000, 48).toFixed(0)} 小时;` +
    `歇满 72 小时是否已过线:${fame.idleBeyond(lastVisitMs, lastVisitMs + 72 * 3_600_000, 48)}(到点是硬回落,没有过渡档)`
)

console.log(
  `\n十二天小结:行情共 ${new Set(Array.from({ length: DAYS }, (_, i) => (markets.at(i * 86_400, { pool: 'road' }).entry as Market).id)).size} 种 · ` +
    `门道 ${trades.totalOf(points)}/${trades.total} 点(${trades.effectsOf(points).join('、') || '还没投'}) · ` +
    `本钱 ${ledger.numberOf(wallet, 'coin')}`
)
console.log('没有一行提到修仙:行情是周期、遇事是抉择、加点是指数、名声会回落 —— 四层各管一段。')
