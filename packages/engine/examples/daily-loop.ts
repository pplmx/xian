/* eslint-disable no-console -- 示例程序就是要打印给人看 */
/**
 * 第二种题材的完整小循环 —— 「书桌与日常」。
 *
 * 运行:`bun packages/engine/examples/daily-loop.ts`(或 `bun run examples`)
 *
 * 它一次用上最近做的四层,而且**没有一个字提到修仙**:
 *
 *   resources  精力 / 专注 / 零花钱 / 文具券(有上限、要取整、收支带来源)
 *   idle       离线三小时:先把时间账算清,再按步产出(精力到顶就不再进)
 *   holding    文具盒:容量、占位、替换
 *   triage     放学自动清理:哪些留、哪些换券,以及"关掉某条规则会少留几件"的读数
 *
 * 想要的读法:一个不写得像"游戏引擎文档"的、能被抄走的最小闭环 ——
 * 换掉名字与数值,它就是另一款游戏。
 */
import {
  compareBy,
  createHoldingSystem,
  createResourceSystem,
  createTriage,
  planIdle,
  runIdle,
  type ResourceEntry
} from '../src/index.js'

// ——— 1. 资源:键名与展示名分开,上限 / 取整 / 来源由你定 ———
const ledger = createResourceSystem({
  resources: [
    { key: 'energy', name: '精力', cap: 100, integer: true },
    { key: 'focus', name: '专注', cap: 60, integer: true },
    { key: 'money', name: '零花钱' },
    { key: 'voucher', name: '文具券', integer: true }
  ]
})

// ——— 2. 文具盒:容量 6,件件都有 uid ———
interface Stationery {
  uid: string
  name: string
  rarity: number // 0 普通 / 1 限定 / 2 珍藏
  level: number
  locked?: boolean
}

const box = createHoldingSystem<Stationery>({ capacity: 6 })

// ——— 3. 自动清理:规则链 + 与裁决同源的读数 ———
const cleanup = createTriage<Stationery>({
  rules: [
    { id: 'locked', label: '上了锁的自己留着', decide: s => (s.locked ? { keep: true, reason: '上了锁' } : undefined) },
    { id: 'invested', label: '练过的不动', decide: s => (s.level > 0 ? { keep: true, reason: '练过了' } : undefined) },
    { id: 'rare', label: '限定以上当藏', decide: s => (s.rarity >= 1 ? { keep: true, reason: '限定款' } : undefined) }
  ],
  fallback: { keep: false, reason: '普通款,换文具券' }
})

// ——— 4. 离线三小时:时间账 -> 逐步产出 ———
const plan = planIdle(3 * 3600_000, { stepMs: 600_000, capMs: 3 * 3600_000, efficiency: 1 })
console.log('—— 放学后三小时(人不在) ——')
console.log(
  `  时间账:计入 ${(plan.cappedMs / 3600_000).toFixed(1)}h · 有效 ${(plan.effectiveMs / 3600_000).toFixed(1)}h · ` +
    `${plan.steps} 步 · 超出未计 ${(plan.overflowMs / 3600_000).toFixed(1)}h`
)

/** 每一步的产出(这里让学生"边歇边写作业":精力回一点、专注涨一点) */
const perStep: ResourceEntry[] = [
  { key: 'energy', amount: 12, source: '休息' },
  { key: 'focus', amount: 6, source: '自习' }
]

let wallet = ledger.create({ energy: 40, focus: 10, money: 30 })
// 逐步产出:精力到 100 就进不去了 —— 一次乘完再加是算不出"中途到顶"的
const offline = ledger.produce(wallet, plan.steps, perStep)
wallet = offline.ledger
const offlineAudit = ledger.audit(offline.entries)
console.log(
  `  产出:${Object.entries(offlineAudit.byKey)
    .map(([key, row]) => `${ledger.name(key)} +${row.income}`)
    .join(' · ')}(精力到顶后不再进)`
)

// ——— 5. 花专注与零花钱买一支笔:买不起就整笔不扣 ———
const pen = { uid: 'p1', name: '金尖钢笔', rarity: 2, level: 0 }
const price: ResourceEntry[] = [
  { key: 'focus', amount: 8, source: '文具店' },
  { key: 'money', amount: 20, source: '文具店' }
]
const bought = ledger.pay(wallet, price)
console.log(
  bought.ok
    ? `  买了「${pen.name}」:专注 -8 · 零花钱 -20`
    : `  买不起「${pen.name}」:还缺 ${bought.shortfall.map(s => `${ledger.name(s.key)} ${s.short}`).join('、')}`
)
wallet = bought.ledger

// ——— 6. 一天掉两件文具,顺手过一遍自动清理 ———
const drops: Stationery[] = [
  pen,
  { uid: 'e1', name: '橡皮', rarity: 0, level: 0 },
  { uid: 'e2', name: '贴纸', rarity: 0, level: 0 },
  { uid: 'e3', name: '限定胶带', rarity: 1, level: 0 }
]
let holding = box.create([{ uid: 'old', name: '旧铅笔', rarity: 0, level: 0 }])
const added = box.addMany(holding, drops)
holding = added.holding
console.log(`  收到 ${added.added.length} 件${added.failed.length > 0 ? `,盒子满了退回 ${added.failed.length} 件` : ''}`)

const verdicts = box.list(holding).map(item => ({ item, verdict: cleanup.decide(item) }))
const keep = verdicts.filter(v => v.verdict.keep).map(v => `${v.item.name}(${v.verdict.reason})`)
const junk = verdicts.filter(v => !v.verdict.keep)
// 换掉的文具折算成券:收支照旧带来源
const recycled = ledger.grant(wallet, [{ key: 'voucher', amount: junk.length, source: '清文具盒' }])
wallet = recycled.ledger
console.log(`  自动清理:留下 ${keep.join('、')}${junk.length > 0 ? `;换券 ${junk.length} 件` : ''}`)

const impact = cleanup.impact(box.list(holding))
console.log(`  清理读数:候选 ${impact.candidates} 件 · 留 ${impact.keep} · 换券 ${impact.junk}`)
console.log(`    规则明细:${impact.byReason.map(r => `${r.reason}×${r.count}`).join(' / ')}`)

// ——— 7. 这一天的账:每个来源各给了多少 ———
const day = ledger.audit([...offline.entries, ...bought.entries, ...recycled.entries])
console.log('\n—— 今天这笔账 ——')
for (const [source, row] of Object.entries(day.bySource)) {
  console.log(`  ${source}:净 ${row.net > 0 ? '+' : ''}${row.net}`)
}
console.log(
  `  余额:${ledger.defs.map(def => `${def.name ?? def.key} ${ledger.numberOf(wallet, def.key)}`).join(' · ')}`
)

// 顺手展示"行囊满了先退谁"的排序骨架:普通款先退、同款先退练得浅的
const eviction = compareBy<Stationery>(
  (a, b) => a.rarity - b.rarity,
  (a, b) => a.level - b.level,
  (a, b) => a.name.localeCompare(b.name)
)
console.log(`\n盒子满了会先退:${[...box.list(holding)].sort(eviction)[0]?.name ?? '(空)'}`)

// 收尾:把用到的能力都真的用了一次(示例也是判据 —— 它进类型检查与两份自检)
console.log(
  `\n没有一行提到修仙:资源(${ledger.defs.length} 种) · 持有(${box.count(holding)}/${box.capacityOf(holding)}) · ` +
    `裁决(${cleanup.rules.length} 条规则) · 离线(${runIdle(plan, 0, n => n + 1)} 步)`
)
