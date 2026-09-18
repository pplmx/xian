/* eslint-disable no-console -- 示例程序就是要打印给人看 */
/**
 * 一条"技艺 → 采料 → 开炉 → 成品"的完整小循环 —— 「药庐二十炉」。
 *
 * 运行:`bun packages/engine/examples/craft-loop.ts`(或 `bun run examples`)
 *
 * 这份示例把五个此前**没有任何示例**的层串起来(它们都只有判据与文档):
 *
 *   skills        技艺:等级曲线 + 每级给什么 + 满级择一条路(不带任何题材)
 *   companions    帮手:性格系数(这里的"药童"把 dropLuck 借给采药)
 *   drops         采药:这一次给不给、给几份(概率先归一、可封顶)
 *   crafting      成算:四乘区相乘 —— 火候 / 备料 / 辨药,再加"越级"那一条陡峭曲线
 *   recipes       开炉:材料不足是**没开炉**(不扣料不掷骰)、开炉失败按条保料、成功之后才掷双成
 *
 * 二十炉跑完,你会看到:技艺涨了之后成功率怎么变、保料把"亏"变成了"慢"、以及双成到底值多少。
 */
import {
  composeCraftRate,
  createCompanionSystem,
  createDropTable,
  createRecipeRunner,
  createResourceSystem,
  createRng,
  createSettlement,
  createSkillSystem,
  type CraftFormula,
  type Ledger
} from '../src/index.js'

// ——— 1 · 技艺:两条线,练满各择一条路 ———

const skills = createSkillSystem({
  skills: [
    {
      id: 'fire',
      name: '火候',
      kind: '主技',
      maxLevel: 5,
      // 乘区输入是"归一后的水平"(0~1):入门 0.5,练到 5 级就是满
      baseMods: { heat: 0.5 }, // 入门就会的
      perLevelMods: { heat: 0.12 }, // 每级练出来的
      costs: [
        { key: 'herb', base: 2, growth: 1.4 }, // 拿草药练手
        { key: 'coin', base: 0, levelStep: 2, discountable: false }
      ],
      branches: [
        { id: 'steady', name: '稳火', mods: { heat: 0.08 }, desc: '文火慢煎' },
        { id: 'fierce', name: '猛火', mods: { heat: 0.08, yield: 0.1 }, desc: '一炉双成' }
      ]
    },
    {
      id: 'sight',
      name: '辨药',
      kind: '辅技',
      maxLevel: 4,
      baseMods: { lore: 0.4 },
      perLevelMods: { lore: 0.15 },
      costs: [{ key: 'herb', base: 1, growth: 1.3 }]
    }
  ]
})

// ——— 2 · 帮手:一只药童,性格系数借给采药 ———

const helpers = createCompanionSystem({
  neutral: { dropLuck: 0, riskMult: 1 },
  traits: [{ id: 'sharp', name: '眼尖', mods: { dropLuck: 0.35 } }],
  companions: [{ id: 'boy', name: '药童', traitId: 'sharp' }]
})

// ——— 3 · 采药:这一趟给不给、给几份 ———

const herbPicking = createDropTable([
  { key: 'herb', chance: 0.75, count: [1, 3] as const },
  { key: 'rare', chance: 0.3, chanceCap: 0.6, count: 1 },
  { key: 'bug', chance: 0.15, count: 1 } // 虫蛀的,开炉时按"备料不足"处理
])

// ——— 4 · 成算:四乘区相乘 + 越级 ———

const FORMULA: CraftFormula = {
  baseRate: 0.9,
  levers: {
    heat: { floor: 0.25, span: 0.75 }, // 火候
    prep: { floor: 0.4, span: 0.6 }, // 备料(用充足度当输入)
    lore: { floor: 0.3, span: 0.7 } // 辨药
  },
  overReach: { key: 'over', spec: { table: [1, 0.6, 0.35, 0.18], decay: 0.5 } }
}

// ——— 5 · 开炉:材料不足是"没开炉",开炉失败按条保料 ———

const ledger = createResourceSystem({
  resources: [
    { key: 'herb', name: '草药', integer: true },
    { key: 'rare', name: '灵药', integer: true },
    { key: 'coin', name: '铜钱', integer: true },
    { key: 'pill', name: '成品', integer: true }
  ]
})
const settlement = createSettlement({ resources: ledger })

const furnace = createRecipeRunner<{ heat: number; lore: number; over: number; wallet: Ledger<number> }, number>({
  costs: () => [
    { key: 'herb', amount: 2 },
    { key: 'rare', amount: 1 }
  ],
  // 成功率就是 crafting 那套四乘区(备料按"手上够不够"给一个充足的数)
  rate: (_id, ctx) => composeCraftRate({ heat: ctx.heat, prep: 0.85, lore: ctx.lore, over: ctx.over }, FORMULA),
  // 材料不足:没开炉(不扣料、不掷骰、不计失败)
  affordable: (_id, ctx) =>
    ledger.numberOf(ctx.wallet, 'herb') >= 2 && ledger.numberOf(ctx.wallet, 'rare') >= 1 ? undefined : '材料不足',
  // 失败保料:草药保一半、灵药全赔(比例逐条给,不是一个总比例)
  spentOnFail: cost => (cost.key === 'herb' ? 1 : 0),
  bonus: () => 0.45,
  bonusCap: 0.8
})

// ——— 6 · 跑二十炉 ———

const ROUNDS = 24

const rng = createRng('药庐-1')
let wallet = ledger.create({ herb: 12, rare: 5, coin: 40, pill: 0 })
/** 技艺等级:用库的成本曲线算"第 N 级要多少料",这里直接给一个上升的节奏 */
let fireLevel = 1
let sightLevel = 1

const levelValue = (id: string, level: number, key: string): number => {
  const mods = skills.modsAt(id, level)
  return Number(mods[key] ?? 0)
}

console.log(`—— 药庐${ROUNDS === 24 ? '二十四' : String(ROUNDS)}炉 ——`)
let brewed = 0
let fired = 0
let superb = 0
let gathered = 0
let starved = 0
let refundedHerb = 0
for (let round = 1; round <= ROUNDS; round += 1) {
  // 采药:药童的性格系数直接喂给掉落表的概率倍率(这就是"性格"与"数值"的交界)
  const luck = Number(helpers.effectsOf('boy').dropLuck ?? 0)
  const picked = herbPicking.roll(rng, { chanceMult: 1 + luck })
  const gained: Record<string, number> = {}
  for (const hit of picked) gained[hit.key] = (gained[hit.key] ?? 0) + hit.count
  if (Object.keys(gained).length > 0) {
    const got = settlement.settle(wallet, {
      grants: Object.entries(gained).map(([key, amount]) => ({ key, amount, source: '采药' }))
    })
    wallet = got.ledger
    gathered += 1
  }

  // 每 4 炉练一次技艺(练技艺也要材料:成本由库的成本曲线给)
  let studied = ''
  if (round % 4 === 0) {
    const target = fireLevel <= sightLevel ? 'fire' : 'sight'
    const level = target === 'fire' ? fireLevel : sightLevel
    const cost = skills.costAt(target, level)
    const paid = ledger.pay(
      wallet,
      cost.map(c => ({ key: c.key, amount: c.amount, source: '练技艺' }))
    )
    if (paid.ok) {
      wallet = paid.ledger
      if (target === 'fire') fireLevel += 1
      else sightLevel += 1
      studied = ` · 练了「${skills.def(target)?.name}」到 ${target === 'fire' ? fireLevel : sightLevel} 级`
    }
  }

  // 开炉
  const heat = levelValue('fire', fireLevel, 'heat')
  const lore = levelValue('sight', sightLevel, 'lore')
  const outcome = furnace.run('pill', { heat, lore, over: 0, wallet }, rng)
  if (!outcome.fired) {
    starved += 1
    console.log(`  第 ${String(round).padStart(2, ' ')} 炉:${outcome.reason}(草药 ${ledger.numberOf(wallet, 'herb')} / 灵药 ${ledger.numberOf(wallet, 'rare')})${studied}`)
    continue
  }
  fired += 1
  refundedHerb += Number(outcome.spent.find(s => s.key === 'herb')?.amount ?? 0)
  for (const spent of outcome.spent) {
    wallet = ledger.pay(wallet, [spent], { partial: true }).ledger
  }
  if (outcome.succeeded) {
    brewed += outcome.produced
    if (outcome.extra) superb += 1
    wallet = settlement.settle(wallet, {
      grants: [{ key: 'pill', amount: outcome.produced, source: '开炉' }]
    }).ledger
  }
  console.log(
    `  第 ${String(round).padStart(2, ' ')} 炉:成功率 ${(outcome.chance * 100).toFixed(0)}% → ` +
      `${outcome.succeeded ? `成丹 ${outcome.produced} 颗${outcome.extra ? '(双成)' : ''}` : `失败了(草药退回 ${outcome.spent.find(s => s.key === 'herb')?.amount ?? 0})`}` +
      ` · 草药 ${ledger.numberOf(wallet, 'herb')} / 灵药 ${ledger.numberOf(wallet, 'rare')}` +
      ` · 成品 ${ledger.numberOf(wallet, 'pill')}${studied}`
  )
}

console.log(
  `\n${ROUNDS} 炉小结:采到料的 ${gathered} 趟 · 真开炉 ${fired} 次 · 没开炉 ${starved} 次(不扣料、不掷骰)` +
    ` · 成丹 ${brewed} 颗(双成 ${superb} 次)` +
    ` · 技艺 火候 ${fireLevel} 级 / 辨药 ${sightLevel} 级`
)
console.log(
  `  失败那几次一共退回草药 ${refundedHerb} 株(保料把"亏"变成"慢") · ` +
    `这 ${ROUNDS} 炉下来最贵的一味是灵药:它只出不进地用完了 —— 这就是"瓶颈在哪"要看的数`
)
console.log(
  `  当前成功率(不越级):${(composeCraftRate({ heat: levelValue('fire', fireLevel, 'heat'), prep: 0.85, lore: levelValue('sight', sightLevel, 'lore'), over: 0 }, FORMULA) * 100).toFixed(1)}%` +
    ` —— 技艺每涨一级,这一炉就稳一分;满级还能再择一条路:${skills.availableBranches('fire', []).map(b => b.name).join(' / ')}`
)
console.log('没有一行提到修仙:技艺是曲线、帮手是系数、采药是掉率、开炉是乘区相乘 —— 四层各管一段。')
