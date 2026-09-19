/* eslint-disable no-console -- 示例程序就是要打印给人看 */
/**
 * 等级体系的完整小循环 —— 「一梯三界」。
 *
 * 运行:`bun packages/engine/examples/realm-ladder.ts`(或 `bun run examples`)
 *
 * 前面几份示例用的是别人配好的境界表;这一份**从零写一张表**,顺带把 `realms` 与
 * `numeric` 这两层摆到台面上:
 *
 *   realms       境界表:世界(界域)分段 + 大境界 + 小层(逐境层数可以不同)
 *   numeric      数值适配层:同一张表,换成 bigint / 字符串大数实现就能接着用
 *   曲线         需求与面板都是"两段式":前段大倍率、后段转平,跨界那一下再×一档
 *   进阶         小层掷骰、大关走试炼(引擎只回答"这一步要不要试炼",判定留给调用方)
 *
 * 题材故意挑了个最普通的:**点心铺的学徒 → 宗师**。没有一行提到修仙 ——
 * 换掉名字与数字,它就是另一款游戏的等级骨架。
 */
import {
  clamp,
  createProgressionAudit,
  createRealmSystem,
  createRng,
  formatAmount,
  numberNumeric,
  progressText,
  type Numeric,
  type RealmState,
  type RealmSystem,
  type RealmSystemConfig
} from '../src/index.js'

// ——— 1 · 一张表:三个世界、七个大境界、每境五小层 ———

const LAYERS = ['见习', '上手', '熟练', '精通', '圆熟']

/** 整张表就是这一个函数返回的东西 —— 想改哪一档,改这里的数 */
function shopConfig(): RealmSystemConfig {
  return {
    worlds: [
      { id: 'shop', name: '本铺', realms: ['学徒', '伙计', '掌柜'] },
      { id: 'chain', name: '分号', realms: ['分号掌事', '总号掌事'] },
      { id: 'guild', name: '同业', realms: ['行首', '宗师'] }
    ],
    layerNames: LAYERS,
    labelFormat: '{realm}·{layer}',
    exp: { base: 100, layerGrowth: 1.5, realmGrowth: 2.4, lateRealmGrowth: 1.7, worldStepMult: 3 },
    combat: { base: { 声望: 10, 手速: 5 }, layerGrowth: 1.4, realmGrowth: 2.4, lateRealmGrowth: 1.9 },
    // 大关必须过考:引擎不掷这个骰子,只告诉你"这里要试炼"
    breakthrough: {
      layerBase: 0.85,
      layerDecay: 0.12,
      majorBase: 0.6,
      majorDecay: 0.05,
      min: 0.05,
      max: 0.95,
      majorRequiresTrial: true
    }
    // 没给 lifespan:这是一间铺子,没有"到点就死"这回事 —— 寿元返回 Infinity
  }
}

const shop = createRealmSystem(shopConfig(), numberNumeric)

console.log('—— 一份骨架,三种叫法 ——')
console.log(
  `${shop.worlds.map(w => `${w.name}(${w.start}~${w.end})`).join(' → ')} · 共 ${shop.realms.length} 境 · ` +
    `最多的那境 ${shop.maxLayer + 1} 小层 · 跨界点在第 ${shop.worldEntries().join('、')} 境`
)
console.log(
  `一行字:${shop.label(0, 0)} · ${shop.label(4, 3)} · ${shop.label(6, 4)} · ` +
    `寿元 ${formatAmount(shop.lifespanOf(0))}(没配 lifespan 就等于无限)`
)

// ——— 2 · 需求曲线:两段式 + 跨界大跃 ———

console.log('\n—— 每境首层的修为需求 ——')
console.log(shop.realms.map(r => `${r.name} ${formatAmount(shop.expCost(r.major, 0))}`).join(' → '))
const handWritten = createRealmSystem({ ...shopConfig(), exp: { realmGrowth: 1, costFn: () => 7777 } })
console.log(
  `换一条路也行:costFn 一给,引擎就照单全收(不插值、不缩放)—— 例:第 3 境第 2 层手工定 ` +
    `${handWritten.expCost(3, 2)}(接手曲线的系统只要认 realmGrowth 这个形状,数由你给)`
)

// ——— 3 · 一天一天地练,满了就进阶 ———

interface RunResult {
  day: number
  state: RealmState<number>
  okCount: number
  failCount: number
  trialCount: number
  stuckAt: string
  stuckDays: number
  milestones: string[]
}

/** 同一段循环,喂给哪张表都行 —— 这正是"引擎不认识你的题材"的样子 */
function run(sys: RealmSystem<number>, seed: string, maxDays = 400): RunResult {
  const rng = createRng(seed)
  const helpers = 3
  const bonus = clamp(0.02 * helpers, 0, 0.06) // 帮手加成封顶 6%:clamp 就在数值适配层里
  let state: RealmState<number> = { major: 0, layer: 0, exp: 0 }
  let day = 0
  let okCount = 0
  let failCount = 0
  let trialCount = 0
  let stuckAt = ''
  let stuckDays = 0
  const milestones: string[] = []
  const atTop = () => state.major === sys.maxMajor && state.layer === sys.maxLayerOf(state.major)
  const now = () => `${sys.label(state.major, state.layer)}`

  while (day < maxDays && !atTop()) {
    day++
    // 今天练多少:主要看面板手速,再加一点固定杂活
    const gain = Math.round(10 + (sys.baseStats(state.major, state.layer)['手速'] ?? 0) * 0.8)
    state = sys.addExp(state, gain)
    if (!sys.progress(state).ready) continue

    const res = sys.attemptBreakthrough(state, { rng, bonusRate: bonus })
    if (res.requiresTrial) {
      trialCount++
      // 大关的判定权在调用方:这里用一条自己的规矩 —— 帮手够多就考得过
      if (rng.chance(0.55 + 0.05 * helpers)) {
        state = { major: state.major + 1, layer: 0, exp: 0 }
        milestones.push(`第 ${day} 天:过考,${res.from} → ${now()}(第 ${trialCount} 次试炼)`)
      } else {
        failCount++
        stuckAt = res.from
        stuckDays++
      }
      continue
    }
    if (res.ok) {
      okCount++
      const from = res.from
      state = res.state
      if (sys.isWorldEntry(state.major)) milestones.push(`第 ${day} 天:跨界,${from} → ${now()}`)
      else if (state.layer === 0) milestones.push(`第 ${day} 天:升境,${from} → ${now()}`)
    } else {
      failCount++
      stuckAt = res.from
      stuckDays++
    }
  }
  return { day, state, okCount, failCount, trialCount, stuckAt, stuckDays, milestones }
}

// 上限给得宽:下面两张表都跑到封顶为止,天数本身才是最直观的那个数
const first = run(shop, '点心铺-学徒', 3000)

console.log('\n—— 一天一天地练 ——')
for (const line of first.milestones) console.log(`  ${line}`)
console.log(
  `小结:${first.day} 天(约 ${(first.day / 30).toFixed(1)} 个月)· 进阶成功 ${first.okCount} 次 · ` +
    `失败 ${first.failCount} 次 · 试炼 ${first.trialCount} 次 · ` +
    `走到 ${shop.label(first.state.major, first.state.layer)}(封顶)`
)
console.log(
  `卡关最多的一步是「${first.stuckAt}」:在那里耗了 ${first.stuckDays} 天 —— ` +
    `想让它别这么苦,拧数就行,公式一行都不用碰`
)
console.log(`进度一行字:${progressText(shop, first.state, v => formatAmount(v, 0))}`)
console.log(
  `面板(第 ${first.day} 天):${Object.entries(shop.baseStats(first.state.major, first.state.layer))
    .map(([k, v]) => `${k} ${formatAmount(v)}`)
    .join(' · ')}`
)

// ——— 4 · 拧一个数会怎样:后段倍率从 1.7 降到 1.2 ———

const gentler = createRealmSystem({
  ...shopConfig(),
  exp: { base: 100, layerGrowth: 1.5, realmGrowth: 2.4, lateRealmGrowth: 1.2, worldStepMult: 2 }
})
const second = run(gentler, '点心铺-学徒', 3000)
const finished = second.state.major === gentler.maxMajor && second.state.layer === gentler.maxLayerOf(gentler.maxMajor)

console.log('\n—— 只把"后段倍率"从 1.7 拧到 1.2、跨界那一档 3 拧到 2 ——')
console.log(
  `同一个种子、同一段循环:第一张表 ${first.day} 天封顶,这张 ${second.day} 天封顶` +
    `(${finished ? '' : '仍未到顶 —— '}进阶成功 ${second.okCount} 次 · 失败 ${second.failCount} 次)`
)
console.log(
  `差别只出在那一行数上:宗师·见习的需求从 ${formatAmount(shop.expCost(6, 0))} 降到 ` +
    `${formatAmount(gentler.expCost(6, 0))} —— 前段照旧陡,后段不再卡人`
)

// ——— 5 · 同一份骨架,换一套名字与数值层 ———

// 曲线体检:不用自己写循环,把这张表量一遍 —— 哪一格跳得最狠、换了界之后是什么手感
const audit = createProgressionAudit({
  realms: shop,
  power: (major, layer) => (shop.baseStats(major, layer)['手速'] ?? 0) + (shop.baseStats(major, layer)['声望'] ?? 0),
  // 内容强度:按"该层的推荐战力"给一个自己定的曲线(引擎不认识它怎么来的)
  contentPower: major => 20 * 3 ** major
})
const report = audit.summary()
console.log('—— 曲线体检(不用自己写循环) ——')
console.log(
  `共 ${report.steps} 格 · 需求跳得最狠:${report.biggestCostStep.label} ×${report.biggestCostStep.costStep.toFixed(2)} · ` +
    `面板跳得最狠:${report.biggestPowerStep.label} ×${report.biggestPowerStep.powerStep.toFixed(2)}`
)
console.log(
  `换界那两格:${report.worldSteps.map(s => `${s.label} 需求 ×${s.costStep.toFixed(1)} / 面板 ×${s.powerStep.toFixed(2)}`).join(' · ')}`
)
console.log(
  `第一次碾压内容:${report.firstCrush ? `${report.firstCrush.label}(玩家/内容 ${report.firstCrush.ratio!.toFixed(1)},判词 ${report.firstCrush.verdict})` : '一次都没有'}` +
    ` · 一共 ${report.crushing} 格被碾`
)
console.log(
  `  体检当场抓到一个真问题:换界那两格的需求倍数小于 1(换到新界反而更便宜)—— ` +
    `因为这张表的**层内**倍率 1.5 连着乘四层(≈5.06)已经超过跨大境界的 2.4。` +
    `要修就是两选一:层内倍率调小,或跨大境界/换界那一档调大(体检只报数,不动你的数值)。`
)

const numericImpl: Numeric<number> = numberNumeric // 想换大数实现,只要满足这个接口(加减乘除/比较/幂)
const alt = createRealmSystem({
  worlds: [{ id: 'camp', name: '训练营', realms: ['青铜', '白银', '黄金'] }],
  layerNames: ['Ⅰ', 'Ⅱ', 'Ⅲ'],
  labelFormat: '{realm} {layer}',
  exp: { base: 50, layerGrowth: 2, realmGrowth: 2 },
  combat: { base: { 战力: 100 }, layerGrowth: 1.5, realmGrowth: 2 },
  breakthrough: { layerBase: 0.9, layerDecay: 0.2, majorBase: 0.7, majorDecay: 0.1, min: 0.05, max: 0.95 }
})

console.log('\n—— 同一份骨架,换一套名字 ——')
console.log(
  `${alt.label(1, 2)} 需要 ${formatAmount(alt.expCost(1, 2))} 点 · 面板 战力 ${formatAmount(alt.baseStats(1, 2)['战力'] ?? 0)} · ` +
    `进阶率 ${(alt.breakthroughRate(1, 2) * 100).toFixed(0)}% · 数值层 ${numericImpl === numberNumeric ? 'number(默认)' : '自定义'}`
)

console.log(
  `\n没有一行提到修仙:一张表(${shop.realms.length} 境 × 最多 ${shop.maxLayer + 1} 层) · ` +
    `两条曲线(需求与面板) · 一次段位(学徒 → ${shop.label(shop.maxMajor, shop.maxLayerOf(shop.maxMajor))}) · ` +
    `${first.day} 天从 ${shop.label(0, 0)} 一路走到 ${shop.label(first.state.major, first.state.layer)}。`
)
