/* eslint-disable no-console -- 示例程序就是要打印给人看 */
/**
 * 第二种题材的完整小循环 —— 「书桌与日常」。
 *
 * 运行:`bun packages/engine/examples/daily-loop.ts`(或 `bun run examples`)
 *
 * 它一次用上六层,而且**没有一个字提到修仙**:
 *
 *   resources  精力 / 专注 / 零花钱 / 文具券(有上限、要取整、收支带来源)
 *   idle       离线三小时:先把时间账算清,再按步产出(精力到顶就不再进)
 *   holding    文具盒:容量、占位、替换
 *   triage     放学自动清理:哪些留、哪些换券,以及"关掉某条规则会少留几件"的读数
 *   buffs      状态:自习的「专注」叠时长、熬夜的「瞌睡」按分类清掉、下一次变化在什么时候
 *   facilities 设施:书桌与台灯(门槛给一句人话、上限由书桌定、每小时产出留零头)
 *
 * 想要的读法:一个不写得像"游戏引擎文档"的、能被抄走的最小闭环 ——
 * 换掉名字与数值,它就是另一款游戏。
 */
import {
  accrue,
  compareBy,
  createBuffSystem,
  createFacilitySystem,
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

// ——— 6. 状态:自习的「专注」与熬夜的「瞌睡」 ———
/**
 * 时间单位由这一处声明(这份示例用秒,游戏里用 `Date.now()` 就写 `clock: 'ms'`)。
 *
 * 两条口径值得看清楚:
 *   · 同一条状态再来一次是**叠时长**,不是刷新 —— 还剩 15 分钟时又上一节自习,
 *     该有 40 分钟(15 + 25),而不是被清零重算成 25;
 *   · "清除负面"只认你给的分类:库里不认识什么是负面,`clear(list, 'loss')` 才剪得掉。
 */
const mood = createBuffSystem<{ focusGain: number }>({
  defs: [
    { id: 'focus', durationSec: 25 * 60, kind: 'gain', mods: { focusGain: 0.2 }, maxDurationSec: 90 * 60 },
    { id: 'sleepy', durationSec: 120 * 60, kind: 'loss', mods: { focusGain: -0.4 } }
  ]
})
const studyAt = 19 * 3600 // 晚上七点,以"今天过了多少秒"当时钟
let moodState = mood.apply([], 'sleepy', studyAt).instances
moodState = mood.apply(moodState, 'focus', studyAt).instances
const afterTenMin = studyAt + 600
const again = mood.apply(moodState, 'focus', afterTenMin)
console.log('—— 状态:现在还挂着什么 ——')
console.log(`  自习一节:专注 25 分(10 分钟后就只剩 ${(mood.remainingSec(moodState, 'focus', afterTenMin) / 60).toFixed(0)} 分)`)
console.log(
  `  再上一节:专注还剩 ${(mood.remainingSec(again.instances, 'focus', afterTenMin) / 60).toFixed(0)} 分` +
    `(叠上去的;若是刷新,只有 25 分)`
)
let stacked = moodState
for (let i = 0; i < 4; i += 1) stacked = mood.apply(stacked, 'focus', afterTenMin).instances
console.log(`  连上四节:封在 ${(mood.remainingSec(stacked, 'focus', afterTenMin) / 60).toFixed(0)} 分(设了上限)`)
const washed = mood.clear(stacked, 'loss')
console.log(`  洗把脸:清掉 ${washed.removed} 条负面(增益留着)`)
const next = mood.nextExpiry(washed.instances, afterTenMin)
console.log(
  `  下一次状态变化:${next ? `${next.id} 在 ${(next.afterSec / 60).toFixed(0)} 分后` : '(没有)'}`
)
moodState = washed.instances

// ——— 7. 设施:书桌与台灯 ———
/**
 * 三件事交给库,口径由这份内容给:
 *   · 能不能升:台灯得先把灯泡买回来(门槛返回一句人话,界面直接显示);
 *   · 上限取小:台灯的上限是「书桌等级 + 1」,到顶时给的说法也由内容给;
 *   · 每小时产出:台灯每级 1.5 点专注 —— 开 50 分钟只够发 1 点,零头留着接着攒。
 */
const desk = createFacilitySystem<{ quiet: number }, { bulb: boolean }, number>({
  facilities: [
    {
      id: 'desk',
      name: '书桌',
      maxLevel: 4,
      costs: level => [{ key: 'money', amount: 10 + level * 10 }],
      mods: level => ({ quiet: level * 0.1 })
    },
    {
      id: 'lamp',
      name: '台灯',
      maxLevel: 3,
      cap: levels => (levels.desk ?? 0) + 1,
      capReason: '先把书桌升上去',
      blocked: (_levels, _level, ctx) => (ctx.bulb ? undefined : '还没买灯泡'),
      costs: level => [{ key: 'money', amount: 10 + level * 5 }],
      perHour: level => ({ focus: level * 1.5 })
    }
  ]
})
const deskLevels = { desk: 1, lamp: 1 }
const lampInfo = desk.upgradeInfo(deskLevels, 'lamp', { bulb: true })
console.log('—— 书桌一角 ——')
console.log(
  `  台灯:${lampInfo.can ? `可以升到 ${lampInfo.nextLevel} 级,花 ${lampInfo.costs[0]!.amount} 零花钱` : lampInfo.reason}` +
    ` · ${desk.upgradeInfo(deskLevels, 'lamp', { bulb: false }).reason}`
)
const light = accrue({}, desk.ratesOf(deskLevels, { bulb: true }), 50 * 60)
console.log(
  `  开灯 50 分钟:进 ${light.whole.focus ?? 0} 点专注,零头 ${(light.frac.focus ?? 0).toFixed(2)} 留着` +
    ` · 升到 2 级就是 ${desk.ratesOf({ desk: 1, lamp: 2 }, { bulb: true }).focus} 点/小时` +
    ` · 再想升:${desk.upgradeInfo({ desk: 1, lamp: 2 }, 'lamp', { bulb: true }).reason}`
)

// ——— 8. 一天掉两件文具,顺手过一遍自动清理 ———
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

// ——— 9. 这一天的账:每个来源各给了多少 ———
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
    `裁决(${cleanup.rules.length} 条规则) · 离线(${runIdle(plan, 0, n => n + 1)} 步) · ` +
    `状态(${mood.active(moodState, afterTenMin).length} 条生效) · ` +
    `设施(${desk.facilities.length} 座 · 台灯 ${desk.levelOf(deskLevels, 'lamp')} 级)`
)
