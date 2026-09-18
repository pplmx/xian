/* eslint-disable no-console */
/**
 * 组合验收(第八条链)—— **一炉丹药的账**:技艺 → 采料 → 开炉 → 入库 → 体检。
 *
 * `examples/craft-loop.ts` 证明这条循环**跑得起来**;这一份证明它**账对得上**,
 * 而且钉住几件只有把五个模块摆在一起才看得出来的事:
 *
 *   一 **没开炉 ≠ 开炉失败**:材料不足的那一炉既不动账本,也不掷骰子 ——
 *      随机流一位都不能少。这一条最值钱:随机流错位之后,后面每一炉的结果都跟着错,
 *      而现象只是"最近成丹的手感不太对";
 *   二 **回执与公式同源**:每一炉回报的成功率,必须等于拿同一份输入再算一遍
 *      `composeCraftRate` 的结果(不是"差不多");而且技艺涨一级,成功率不下降;
 *   三 **失败逐条保料**:失败那一炉扣多少,由 `spentOnFail` 逐条说了算 ——
 *      草药保一半、灵药全赔这类规则,账本明细里必须逐键对得上;
 *   四 **双成只在成功之后**:产出件数 = 成功次数 + 双成次数,失败与没开炉都不产出;
 *   五 **体检与账本同源**:`economy` 的判词必须与账本明细的进/出比一致;
 *      并且"只出不进"的灵药是瓶颈、"只进不出"的成品是烂在手里 —— 这两件事要看得出来;
 *   六 **同种子可复现**:整条链跑两遍,账本、每炉成功率、产出逐字段一致。
 */
import { describe, expect, it } from 'vitest'
import { composeCraftRate, type CraftFormula } from './crafting.js'
import { createCompanionSystem } from './companions.js'
import { createDropTable } from './drops.js'
import { createEconomyReadings } from './economy.js'
import { createRecipeRunner } from './recipes.js'
import { createResourceSystem, type AppliedEntry, type Ledger } from './resources.js'
import { createRng } from './rng.js'
import { createSettlement } from './settlement.js'
import { createSkillSystem } from './skills.js'

// ——— 这条链上的五件东西(名字与数值都是内容,引擎一行不认识) ———

const skills = createSkillSystem({
  skills: [
    {
      id: 'fire',
      name: '火候',
      kind: '主技',
      maxLevel: 4,
      baseMods: { heat: 0.5 },
      perLevelMods: { heat: 0.12 },
      costs: [
        { key: 'herb', base: 2, growth: 1.4 },
        { key: 'coin', base: 0, levelStep: 2, discountable: false }
      ],
      branches: [{ id: 'steady', name: '稳火', mods: { heat: 0.08 } }]
    },
    {
      id: 'sight',
      name: '辨药',
      kind: '辅技',
      maxLevel: 3,
      baseMods: { lore: 0.4 },
      perLevelMods: { lore: 0.15 },
      costs: [{ key: 'herb', base: 1, growth: 1.3 }]
    }
  ]
})

const helpers = createCompanionSystem({
  neutral: { dropLuck: 0 },
  traits: [{ id: 'sharp', name: '眼尖', mods: { dropLuck: 0.35 } }],
  companions: [{ id: 'boy', name: '药童', traitId: 'sharp' }]
})

const picking = createDropTable([
  // 采药只采得到草药:灵药得靠别的来源 —— "它只出不进"这件事就是从这里开始的
  { key: 'herb', chance: 0.75, count: [1, 3] as const }
])

const FORMULA: CraftFormula = {
  baseRate: 0.9,
  levers: {
    heat: { floor: 0.25, span: 0.75 },
    prep: { floor: 0.4, span: 0.6 },
    lore: { floor: 0.3, span: 0.7 }
  },
  overReach: { key: 'over', spec: { table: [1, 0.6, 0.35, 0.18], decay: 0.5 } }
}

const ledger = createResourceSystem({
  resources: [
    { key: 'herb', name: '草药', integer: true },
    { key: 'rare', name: '灵药', integer: true },
    { key: 'coin', name: '铜钱', integer: true },
    { key: 'pill', name: '成品', integer: true }
  ]
})
const settlement = createSettlement({ resources: ledger })

interface Ctx {
  heat: number
  lore: number
  over: number
  wallet: Ledger<number>
}

const COSTS = [
  { key: 'herb', amount: 2 },
  { key: 'rare', amount: 1 }
]

/** 草药保一半、灵药全赔 —— "逐条给比例"就是这一层的形状 */
const keptOnFail = (cost: { key: string; amount: number }): number => (cost.key === 'herb' ? 1 : 0)

const furnace = createRecipeRunner<Ctx, number>({
  costs: () => COSTS,
  rate: (_id, ctx) => composeCraftRate({ heat: ctx.heat, prep: 0.85, lore: ctx.lore, over: ctx.over }, FORMULA),
  affordable: (_id, ctx) =>
    ledger.numberOf(ctx.wallet, 'herb') >= 2 && ledger.numberOf(ctx.wallet, 'rare') >= 1 ? undefined : '材料不足',
  spentOnFail: cost => keptOnFail(cost),
  bonus: () => 0.45,
  bonusCap: 0.8
})

const levelValue = (id: string, level: number, key: string): number => Number(skills.modsAt(id, level)[key] ?? 0)

// ——— 把整条链跑一遍(确定性:等级推进规则也写在里面) ———

interface RoundTrace {
  round: number
  fired: boolean
  succeeded: boolean
  chance: number
  spent: { key: string; amount: number }[]
  produced: number
  extra: boolean
}

function runOnce(seed: string, rounds = 24) {
  const rng = createRng(seed)
  let wallet = ledger.create({ herb: 12, rare: 5, coin: 40, pill: 0 })
  const opened = { ...wallet }
  const entries: AppliedEntry<number>[] = []
  const traces: RoundTrace[] = []
  let fireLevel = 1
  let sightLevel = 1
  let starved = 0

  for (let round = 1; round <= rounds; round += 1) {
    // 采药:帮手的"眼尖"直接当概率倍率喂给掉落表
    const luck = Number(helpers.effectsOf('boy').dropLuck ?? 0)
    const picked = picking.roll(rng, { chanceMult: 1 + luck })
    if (picked.length > 0) {
      const applied = ledger.apply(
        wallet,
        picked.map(hit => ({ key: hit.key, amount: hit.count, source: '采药' }))
      )
      wallet = applied.ledger
      entries.push(...applied.entries)
    }

    // 每 4 炉练一次技艺(练技艺花的料也是账本上的开销)
    if (round % 4 === 0) {
      const target = fireLevel <= sightLevel ? 'fire' : 'sight'
      const level = target === 'fire' ? fireLevel : sightLevel
      const paid = ledger.pay(
        wallet,
        skills.costAt(target, level).map(c => ({ key: c.key, amount: c.amount, source: '练技艺' }))
      )
      if (paid.ok) {
        wallet = paid.ledger
        entries.push(...paid.entries)
        if (target === 'fire') fireLevel += 1
        else sightLevel += 1
      }
    }

    const ctx: Ctx = {
      heat: levelValue('fire', fireLevel, 'heat'),
      lore: levelValue('sight', sightLevel, 'lore'),
      over: 0,
      wallet
    }
    const outcome = furnace.run('pill', ctx, rng)
    traces.push({ round, ...outcome, spent: outcome.spent.map(s => ({ ...s })) })
    if (!outcome.fired) {
      starved += 1
      continue
    }
    // 回报里说扣什么就扣什么 —— 调用方不再自己算一遍。
    // 这里刻意不给 partial:材料够不够是调用方判的(affordable),扣料是 `pay` 判的 ——
    // 两处判据必须同源,否则会出现"说能开炉,扣料时却扣不动"
    const paid = ledger.pay(
      wallet,
      outcome.spent.map(s => ({ key: s.key, amount: s.amount, source: '开炉' }))
    )
    expect(paid.ok).toBe(true)
    wallet = paid.ledger
    entries.push(...paid.entries)
    if (outcome.succeeded) {
      const plan = [{ key: 'pill', amount: outcome.produced, source: '开炉' }]
      const applied = ledger.apply(wallet, plan)
      // 同一笔再走一次"结算回执"那条路:回执说的实际入账,必须与账本自己落账的结果一致
      const viaReceipt = settlement.settle(wallet, { grants: plan })
      expect(viaReceipt.receipt.totals.pill).toBe(applied.entries[0]!.applied)
      expect(viaReceipt.ledger.pill).toBe(applied.ledger.pill)
      wallet = applied.ledger
      entries.push(...applied.entries)
    }
  }

  return { wallet, opened, entries, traces, fireLevel, sightLevel, starved }
}

const sumByKey = (rows: { key: string; amount: number }[]): Record<string, number> => {
  const out: Record<string, number> = {}
  for (const row of rows) out[row.key] = (out[row.key] ?? 0) + row.amount
  return out
}

describe('组合验收 —— 一炉丹药的账:技艺、采料、开炉、入库与体检', () => {
  it('没开炉:不扣料、不掷骰 —— 随机流一位都不能少', () => {
    const spentRng = createRng('空炉')
    const controlRng = createRng('空炉')
    const wallet = ledger.create({ herb: 1, rare: 0, coin: 0, pill: 0 }) // 缺料
    const before = { ...wallet }

    const outcome = furnace.run('pill', { heat: 0.62, lore: 0.55, over: 0, wallet }, spentRng)
    expect(outcome.fired).toBe(false)
    expect(outcome.reason).toBe('材料不足')
    expect(outcome.spent).toEqual([])
    expect(outcome.chance).toBe(0)
    // 调用方照着 spent 记账:空数组 ⇒ 账本一位未动
    expect(wallet).toEqual(before)
    // 没开炉就没掷骰:与一颗没被碰过的同名种子,下一个随机数必须相同
    expect(spentRng.next()).toBe(controlRng.next())
  })

  it('回执与公式同源,且技艺涨一级成功率不下降', () => {
    const rich = ledger.create({ herb: 99, rare: 99, coin: 99, pill: 0 })
    const rates: number[] = []
    for (const level of [1, 2, 3, 4]) {
      const ctx: Ctx = { heat: levelValue('fire', level, 'heat'), lore: 0.55, over: 0, wallet: rich }
      const expected = composeCraftRate({ heat: ctx.heat, prep: 0.85, lore: ctx.lore, over: 0 }, FORMULA)
      const outcome = furnace.run('pill', ctx, createRng('同源'))
      expect(outcome.chance).toBeCloseTo(Math.min(1, Math.max(0, expected)), 12)
      rates.push(expected)
    }
    expect(rates).toEqual([...rates].sort((a, b) => a - b)) // 单调不降
    expect(rates[3]!).toBeGreaterThan(rates[0]!) // 而且真的涨了,不是"恰好没跌"
  })

  it('技艺成本曲线:越练越贵,满级不再要钱', () => {
    const costs = [1, 2, 3].map(level => skills.costAt('fire', level)[0]!.amount)
    expect(costs).toEqual([...costs].sort((a, b) => a - b))
    expect(costs[2]!).toBeGreaterThan(costs[0]!)
    expect(skills.costAt('fire', 4)).toEqual([]) // maxLevel
  })

  it('失败逐条保料 + 扣料明细与账本逐键对得上', () => {
    const trace = runOnce('药庐-1')
    const audit = ledger.audit(trace.entries)

    // 逐炉规则:成了全额扣(草药 2 / 灵药 1),败了按 spentOnFail(草药保一半 → 扣 1,灵药全赔 → 扣 0)
    for (const round of trace.traces) {
      if (!round.fired) continue
      expect(round.spent).toEqual(
        round.succeeded
          ? [
              { key: 'herb', amount: 2 },
              { key: 'rare', amount: 1 }
            ]
          : [
              { key: 'herb', amount: 1 },
              { key: 'rare', amount: 0 }
            ]
      )
    }
    // 账本明细里"开炉"这一条的每一笔,必须与逐炉 spent 逐键对得上(不是另一套算法)
    const fired = trace.traces.filter(r => r.fired)
    expect(audit.bySource['开炉']?.expense).toBe(
      fired.reduce((sum, r) => sum + r.spent.reduce((s, c) => s + c.amount, 0), 0)
    )
    const posted = (source: string): Record<string, number> => {
      const out: Record<string, number> = {}
      for (const entry of trace.entries) {
        if (entry.source !== source || entry.applied >= 0) continue
        out[entry.key] = (out[entry.key] ?? 0) + -entry.applied
      }
      return out
    }
    expect(posted('开炉')).toEqual(sumByKey(fired.flatMap(r => r.spent)))
    // 逐档规则再单独点名一次:成功全额、失败草药保一半(灵药全赔)
    const ok = fired.filter(r => r.succeeded)
    const failed = fired.filter(r => !r.succeeded)
    // 防空转:这条链必须真的走过"成了"与"败了"两种结局,否则上面两条断言是空跑
    expect(ok.length).toBeGreaterThan(0)
    expect(failed.length).toBeGreaterThan(0)
    expect(trace.starved).toBeGreaterThan(0) // 材料不足那一档也要真的发生过
    expect(sumByKey(ok.flatMap(r => r.spent))).toEqual({ herb: ok.length * 2, rare: ok.length })
    expect(sumByKey(failed.flatMap(r => r.spent))).toEqual({ herb: failed.length * 1, rare: 0 })
    // 练技艺也要花钱:草药与铜钱各记一条
    expect(Object.keys(posted('练技艺')).sort()).toEqual(['coin', 'herb'])
    // 灵药只出不进,采不到就没了 —— 没开炉那一档的成因必须与体检读数一致
    expect(trace.wallet.rare).toBe(0)
    // 守恒:期末 − 期初 = 明细净额(逐键)
    for (const def of ledger.defs) {
      const net = Number(audit.byKey[def.key]?.net ?? 0)
      expect(trace.wallet[def.key]! - trace.opened[def.key]!).toBe(net)
    }
  })

  it('双成只在成功之后:产出 = 成功次数 + 双成次数', () => {
    const trace = runOnce('药庐-1')
    const fired = trace.traces.filter(r => r.fired)
    const succeeded = fired.filter(r => r.succeeded)
    const extra = succeeded.filter(r => r.extra)
    expect(succeeded.length).toBeGreaterThan(0)
    expect(extra.length).toBeGreaterThan(0) // 双成这条支路也得真的走一次
    for (const round of fired) {
      if (!round.succeeded) expect(round.produced).toBe(0)
      else expect(round.produced).toBe(round.extra ? 2 : 1)
      if (!round.fired) expect(round.extra).toBe(false)
    }
    expect(extra.length).toBeLessThanOrEqual(succeeded.length)
    expect(trace.wallet.pill).toBe(succeeded.length + extra.length)
  })

  it('体检与账本同源:瓶颈与"烂在手里"都要读出来', () => {
    const trace = runOnce('药庐-1')
    const audit = ledger.audit(trace.entries)
    const readings = createEconomyReadings()
    const flows = ledger.defs.map(def => ({
      key: def.key,
      income: Number(audit.byKey[def.key]?.income ?? 0),
      sink: Number(audit.byKey[def.key]?.expense ?? 0)
    }))
    const read = readings.read(flows)
    const manual = (ratio: number): string =>
      ratio < 0.7 ? 'tight' : ratio <= 3 ? 'healthy' : ratio <= 10 ? 'surplus' : 'idle'
    for (const row of read) expect(row.verdictId).toBe(manual(row.ratio))
    // 灵药只出不进(采药采不到它)→ 瓶颈;成品只进不出(还没卖)→ 烂在手里;
    // 铜钱只出不进(练技艺花掉)→ 也是瓶颈。这三件事就是体检要替内容作者看出来的
    const rare = read.find(r => r.key === 'rare')!
    expect(rare.income).toBe(0)
    expect(rare.sink).toBeGreaterThan(0)
    expect(rare.ratio).toBe(0)
    expect(rare.verdictId).toBe('tight')
    const pill = read.find(r => r.key === 'pill')!
    expect(pill.sink).toBe(0)
    expect(pill.ratio).toBe(Number.POSITIVE_INFINITY)
    expect(pill.verdictId).toBe('idle')
    expect(read.find(r => r.key === 'coin')?.verdictId).toBe('tight')
    expect(readings.summary(read).tight).toContain('rare')
    expect(readings.summary(read).idle).toContain('pill')
  })

  it('同种子可复现:整条链跑两遍逐字段一致', () => {
    const a = runOnce('药庐-1')
    const b = runOnce('药庐-1')
    expect(b).toEqual(a)
    const c = runOnce('药庐-2')
    expect(c).not.toEqual(a) // 换个种子就该不一样,否则"可复现"是假的
  })
})
