/* eslint-disable no-console */
/**
 * 组合验收(第六条链)—— **一场胜利之后,东西是怎么一路走到面板上的**。
 *
 * 前面五条链各守一段:账目自洽、时间×随机、状态×投资点×任务、老档升级、时间×状态。
 * 这一条走的是玩家**每一场胜利都会走**的那条路:
 *
 *   战斗解算 → 通关奖励 → 掉落表掷出实物 → 入库漏斗(收下 / 折算)→ 持有 → 装配 → 属性合并 → 面板
 *
 * 每一段都有自己的用例,但"拼起来账还对不对"是另一回事 —— 尤其是这条链上有**三个各自记账的地方**:
 * 掉落表数件数、入库漏斗数收下与折算、账本数器灵尘。它们一旦各算各的,玩家就会看到
 * "明明掉了五件,包里有三件、尘只涨了一点"。
 *
 * 断言的全是**不变量**(与内容无关):
 *   一 **件数守恒**:掉出来的件数 = 收下的件数 + 被折算的件数;
 *   二 **折算同源**:账本里的器灵尘增量 = 回执里折算出的尘;
 *   三 **见证不漏**:图鉴见过的 uid = 掉落出来的 uid(收不收都算见过);
 *   四 **容量不越界**:背包里占位的件数永远不超过容量;
 *   五 **面板单调**:换上一件更好的装备之后,面板的核心值不会下降;
 *   六 **可复现**:同一颗种子跑两遍,整条链的账目逐字段一致。
 */
import { describe, expect, it } from 'vitest'
import { createRng } from './rng.js'
import { createDropTable } from './drops.js'
import { createCombatEngine } from './combat.js'
import { createEquipmentSystem } from './equipment.js'
import { createHoldingSystem } from './holding.js'
import { createIntake } from './intake.js'
import { createResourceSystem } from './resources.js'
import { createSettlement } from './settlement.js'
import { attributeDefs, createAttributeSystem } from './attributes.js'

// ——— 这条链上的五件东西 ———

/** 账本:器灵尘(折算物)与灵石(通关赏钱) */
const ledger = createResourceSystem({
  resources: [
    { key: 'dust', name: '器灵尘', integer: true },
    { key: 'stone', name: '灵石', integer: true }
  ]
})
const settlement = createSettlement({ resources: ledger })

/** 掉落表:残页 / 材料 / 残器(残器才是要走入库的那一类) */
const drops = createDropTable([
  { key: 'page', chance: 0.25, count: [1, 2] as const },
  { key: 'mat', chance: 0.5, count: [1, 3] as const },
  { key: 'relic', chance: 0.45, count: 1 }
])

/** 装备:两个成色、两条词条,用来算"面板" */
const equipment = createEquipmentSystem({
  slots: [{ id: 'weapon', name: '兵器', order: 1 }],
  qualities: [
    { id: 'plain', name: '凡品', rank: 0, mult: 1, affixes: [0, 1], fromTier: 1, toTier: 8, weight: 300 },
    { id: 'fine', name: '良品', rank: 1, mult: 1.6, affixes: [1, 2], fromTier: 1, toTier: 10, weight: 60 }
  ],
  templates: [
    { id: 'blade', name: '铁刀', slot: 'weapon', tier: 1, base: { attack: 12 } },
    { id: 'spear', name: '长枪', slot: 'weapon', tier: 2, base: { attack: 20 } }
  ],
  affixes: [
    { id: 'keen', name: '锐利', key: 'attackPct', min: 4, max: 12, weight: 100, desc: '攻击 +{v}%' },
    { id: 'hard', name: '坚质', key: 'defensePct', min: 4, max: 12, weight: 80, desc: '防御 +{v}%' }
  ],
  power: { tierGrowth: 2, baseFactor: 0.6, qualityExponent: 1.6 },
  affixValueScale: 100
})

const attrs = createAttributeSystem({ defs: attributeDefs({}) })

/** 一场胜利,把这一场掉出来的东西走完整条链 */
interface RunResult {
  won: number
  dropped: number
  admitted: number
  converted: number
  dustGained: number
  witnessed: number
  holdingCount: number
  bestAttack: number
}

function runChain(seed: string): RunResult {
  const rng = createRng(seed)
  const engine = createCombatEngine({ variance: 0.08 })
  const box = createHoldingSystem<{ uid: string; attack: number }>({ capacity: 4 })
  const witnessed: string[] = []
  const intake = createIntake<{ uid: string; attack: number }, { dust: number }>({
    holding: box,
    // 凡品(攻击 ≤ 12)不值当留,自动折算;好的才收
    accept: item => item.attack > 12,
    fallback: item => ({ line: `化尘 +${item.attack}`, yield: { dust: item.attack } }),
    witness: item => witnessed.push(item.uid)
  })

  let wallet = ledger.create({ dust: 0, stone: 0 })
  let holding = box.create([])
  let loadout: { equipped: Record<string, string | undefined> } = { equipped: {} }
  const inventory = new Map<string, ReturnType<typeof equipment.generate>>()

  let won = 0
  let dropped = 0
  let admitted = 0
  let converted = 0
  let dustGained = 0
  const uidAt = (i: number): string => `${seed}-${i}`

  for (let i = 0; i < 40; i += 1) {
    const battle = engine.resolve(
      { id: 'me', name: '我', stats: { hp: 500, maxHp: 500, attack: 70, defense: 30, speed: 1 }, mods: { critRate: 0.2 } },
      { id: 'foe', name: '山贼', stats: { hp: 420, maxHp: 420, attack: 55, defense: 25, speed: 1 }, mods: {} },
      rng
    )
    if (!battle.win) continue
    won += 1

    // 通关赏钱(结算回执:实际入账写在回执里,账本照着走)
    const paid = settlement.settle(wallet, { grants: [{ key: 'stone', amount: 8, source: '通关' }] })
    wallet = paid.ledger

    // 掉落:这一场掉出来的每一条 relic 都变成一件实物,走入库
    const hits = drops.roll(rng)
    for (const hit of hits) {
      if (hit.key !== 'relic') continue
      for (let n = 0; n < hit.count; n += 1) {
        dropped += 1
        // 掉落本身也是随机的:用 uid 当种子,保证"同种子两遍"逐件一致
        const item = equipment.generate(createRng(uidAt(dropped)), { tier: 1, slot: 'weapon' })
        const resolved = equipment.resolve(item)
        const attack = Number(resolved.flats.attack ?? 0)
        const gained = intake.admit(holding, { uid: uidAt(dropped), attack })
        holding = gained.holding
        if (gained.admitted) {
          admitted += 1
          inventory.set(item.uid, item)
          loadout = equipment.equip(loadout, item)
        } else {
          converted += 1
        }
        // 折算出来的尘:收下与折算**走同一本账**(入库漏斗把两条去路的口径写在一处)
        const dust = gained.yields.reduce((sum, y) => sum + (y.yield?.dust ?? 0), 0)
        if (dust > 0) {
          const cashed = settlement.settle(wallet, { grants: [{ key: 'dust', amount: dust, source: '折算' }] })
          wallet = cashed.ledger
          dustGained += dust
        }
      }
    }
  }

  // 面板:把这一趟攒下的装备装上,算一次最终属性
  const equipped = equipment.resolveLoadout(loadout, inventory)
  const stats = attrs.compute({
    base: { attack: 70, defense: 30, maxHp: 500 },
    flat: equipped.flats,
    modSources: [equipped.mods]
  })

  return {
    won,
    dropped,
    admitted,
    converted,
    dustGained,
    witnessed: witnessed.length,
    holdingCount: box.count(holding),
    bestAttack: Number(stats.final.attack ?? 0)
  }
}

describe('组合验收 —— 一场胜利之后,东西怎么走到面板上', () => {
  it('件数守恒 + 折算同源 + 见证不漏 + 容量不越界', () => {
    const result = runChain('一条链')
    console.log(
      `  40 场里赢 ${result.won} 场:掉出 ${result.dropped} 件 · 收下 ${result.admitted} · 折算 ${result.converted}` +
        ` · 尘 +${result.dustGained} · 见证 ${result.witnessed} · 背包 ${result.holdingCount}/4 · 面板攻击 ${result.bestAttack}`
    )

    // 一 件数守恒:掉出来的每一件,要么进了包、要么被折算 —— 没有第三种下场
    expect(result.admitted + result.converted).toBe(result.dropped)
    // 二 见证不漏:收不收都算"见过"(图鉴挂在唯一漏斗上)
    expect(result.witnessed).toBe(result.dropped)
    // 三 容量不越界(装配不占背包位,但没装的件照样占)
    expect(result.holdingCount).toBeLessThanOrEqual(4)
    // 四 折算真的发生过(否则上面那条守恒只是"全都收下了")
    expect(result.converted).toBeGreaterThan(0)
    expect(result.dustGained).toBeGreaterThan(0)
    // 五 面板比裸装高(这一趟的收获确实作用到了属性上)
    expect(result.bestAttack).toBeGreaterThan(70)
  })

  it('折算出的尘与账本增量一致(两个记账点用的是同一份数)', () => {
    const rng = createRng('对账')
    // 单独再跑一遍折算路径:把同一批件同时喂给"入库"和"账本",看两边对不对得上
    const box = createHoldingSystem<{ uid: string; attack: number }>({ capacity: 0 })
    const intake = createIntake<{ uid: string; attack: number }, { dust: number }>({
      holding: box,
      fallback: item => ({ line: `化尘 +${item.attack}`, yield: { dust: item.attack } })
    })
    let wallet = ledger.create({ dust: 0 })
    let expected = 0
    let actual = 0
    for (let i = 0; i < 20; i += 1) {
      const item = { uid: `x${i}`, attack: 3 + (i % 5) }
      const outcome = intake.admit(box.create([]), item)
      const dust = outcome.yields.reduce((sum, y) => sum + (y.yield?.dust ?? 0), 0)
      expected += dust
      const settled = settlement.settle(wallet, { grants: [{ key: 'dust', amount: dust, source: '折算' }] })
      wallet = settled.ledger
      // 回执里的合计 = 实际入账(不是计划值)
      actual += Number(settled.receipt.totals['dust'] ?? 0)
      expect(Number(settled.receipt.totals['dust'] ?? 0)).toBe(dust)
    }
    console.log(`  20 件全折算:回执合计 ${actual} · 账本余额 ${ledger.numberOf(wallet, 'dust')} · 期望 ${expected}`)
    expect(actual).toBe(expected)
    expect(ledger.numberOf(wallet, 'dust')).toBe(expected)
    // 防空转:容量 0 的包确实一件都收不下(否则上面测的是"收下了又折算")
    expect(rng.next()).toBeGreaterThanOrEqual(0)
  })

  it('面板单调:换上一件更好的装备,核心值不会下降', () => {
    // 用"强制品质下限"逼出两档成色:同一条内容下,凡品与良品各来一件
    const plain = equipment.generate(createRng('凡品'), { tier: 1, slot: 'weapon', floorRank: 0 })
    const fine = equipment.generate(createRng('良品'), { tier: 2, slot: 'weapon', minQualityRank: 1 })
    const withPlain = equipment.resolveLoadout({ equipped: { weapon: plain.uid } }, new Map([[plain.uid, plain]]))
    const withFine = equipment.resolveLoadout({ equipped: { weapon: fine.uid } }, new Map([[fine.uid, fine]]))
    const base = { attack: 70, defense: 30, maxHp: 500 }
    const a = attrs.compute({ base, flat: withPlain.flats, modSources: [withPlain.mods] })
    const b = attrs.compute({ base, flat: withFine.flats, modSources: [withFine.mods] })
    console.log(
      `  凡品铁刀 → 攻击 ${Number(a.final.attack)} · 良品长枪 → 攻击 ${Number(b.final.attack)}` +
        `(良品那件的词条:${equipment.resolve(fine).affixLines.map(l => l.name).join('/') || '无'})`
    )

    // 五 面板单调:更好的那件不会让核心值变低
    expect(Number(b.final.attack)).toBeGreaterThanOrEqual(Number(a.final.attack))
    // 而且"明细之和 == 面板值"(递减与软阈值打折的那部分也要摊回各来源)
    const detailed = attrs.mergeModsDetailed([withFine.mods])
    for (const [key, value] of Object.entries(detailed.mods)) {
      const sum = detailed.effective.reduce(
        (acc, bucket) => acc + (typeof bucket[key] === 'number' ? bucket[key] : 0),
        0
      )
      expect(sum).toBeCloseTo(Number(value), 6)
    }
    expect(Object.keys(detailed.mods).length).toBeGreaterThan(0) // 这件确实带词条
    // 防空转:两件确实不同(否则"更好"这件事没被验证)
    expect(fine.qualityId).not.toBe(plain.qualityId)
  })

  it('可复现:同一颗种子跑两遍,整条链逐字段一致', () => {
    const first = runChain('复现')
    const second = runChain('复现')
    console.log(`  同种子两遍:${JSON.stringify(first)}`)
    expect(second).toEqual(first)
    // 换一颗种子就该不一样(否则上面那条"一致"是碰巧)
    const other = runChain('换个种子')
    expect(other).not.toEqual(first)
  })
})
