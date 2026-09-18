/* eslint-disable no-console */
/**
 * 消融实验 —— 洗练一次到底洗出什么。
 *
 * `equipment.spec.ts` 钉的是语义(与 `generate` 共用同一处掷词条、按品质区间掷条数、
 * 保留的条目原样留下、门槛按品质/层级/部位筛);这一份量的是**玩家能感觉到的数**:
 * 洗一次至少给几条新的、锁住两条之后条数怎么变、门槛把池子排空时会怎样、同一件上会不会撞名。
 *
 * 三条量出来的结论:
 *   ① **"至少给一条新的"是硬保底**:锁住 N 条之后目标条数取"品质区间"与"N + 1"里较大的那个
 *      —— 实测锁 2 条(凡品区间 1~2)时必定洗出 3 条,不会出现"洗了等于没洗";
 *   ② **但池子被门槛排空时,这条保底失效**:部位 / 品阶 / 层级把候选筛空之后,给不出新的,
 *      于是只保留你锁的那些 —— 这是"允许洗了等于没洗"的唯一入口,要不要允许由内容决定;
 *   ③ **同一件上不会撞名**:洗 200 次、每次若干条,同名重复出现 0 次(池子按已选 id 排除);
 *      且洗出来的数值覆盖 `min~max` 全区间,均值落在中点上(默认线性曲线)。
 */
import { describe, expect, it } from 'vitest'
import { createRng } from './rng.js'
import type { AffixRoll, QualityDef, SlotDef } from './equipment.js'
import { createEquipmentSystem, generateTemplates } from './equipment.js'

const SLOTS: SlotDef[] = [
  { id: 'weapon', name: '武器', order: 1 },
  { id: 'head', name: '护具', order: 2 }
]

const QUALITIES: QualityDef[] = [
  { id: 'plain', name: '凡品', rank: 0, mult: 1, affixes: [1, 2], fromTier: 1, toTier: 8, weight: 300 },
  { id: 'fine', name: '良品', rank: 1, mult: 1.5, affixes: [2, 3], fromTier: 1, toTier: 10, weight: 100 }
]

const system = createEquipmentSystem({
  slots: SLOTS,
  qualities: QUALITIES,
  templates: generateTemplates({
    slots: SLOTS,
    baseBySlot: { weapon: { attack: 5 }, head: { defense: 3, maxHp: 8 } },
    tiers: [['铁剑', '皮帽'], ['精钢剑', '铁盔']]
  }),
  affixes: [
    { id: 'sharp', name: '锋利', key: 'attackPct', min: 4, max: 12, weight: 100, desc: '攻击 +{v}%' },
    { id: 'guard', name: '坚固', key: 'defensePct', min: 4, max: 12, weight: 100, desc: '防御 +{v}%' },
    { id: 'vital', name: '厚重', key: 'maxHpPct', min: 5, max: 15, weight: 100, desc: '气血 +{v}%' },
    { id: 'edge', name: '开刃', key: 'critRate', min: 2, max: 6, weight: 60, slots: ['weapon'], desc: '暴击 +{v}%' },
    { id: 'focus', name: '凝神', key: 'critDamage', min: 5, max: 15, weight: 40, minRank: 1, desc: '暴伤 +{v}%' }
  ],
  power: { tierGrowth: 2, baseFactor: 0.6, qualityExponent: 1.6 },
  affixValueScale: 100,
  maxAffixCount: 4
})

const PLAIN = QUALITIES[0]!
const FINE = QUALITIES[1]!

/** 洗 n 次(同一件、同参数),把结果摊平便于统计;`affixes` 是这件洗之前的词条 */
function wash(
  times: number,
  opts: Omit<Parameters<typeof system.rerollAffixes>[1], 'rng'> & { seed?: string; affixes?: AffixRoll[] }
): AffixRoll[][] {
  const { seed = '洗练', affixes = [], ...rest } = opts
  return Array.from({ length: times }, (_, i) => system.rerollAffixes(affixes, { ...rest, rng: createRng(`${seed}-${i}`) }))
}

describe('消融实验 —— 洗练一次洗出什么', () => {
  it('"至少给一条新的"是硬保底:锁两条 → 必定三条', () => {
    // 不锁:条数在品质区间内掷(凡品 1~2)
    const bare = wash(400, { quality: PLAIN, tier: 1, slot: 'weapon' })
    const bareCounts = [1, 2, 3].map(n => bare.filter(r => r.length === n).length)
    console.log(`  不锁任何条(凡品区间 1~2):1 条 ${bareCounts[0]} 次 · 2 条 ${bareCounts[1]} 次 · 3 条 ${bareCounts[2]} 次`)

    // 锁定两条:目标条数取 max(品质区间, 保留数 + 1) —— 凡品区间 1~2,所以必定 3 条
    const locked = wash(200, {
      quality: PLAIN,
      tier: 1,
      slot: 'weapon',
      affixes: [
        { id: 'sharp', roll: 0.5 },
        { id: 'guard', roll: 0.5 }
      ],
      keep: ['sharp', 'guard']
    })
    console.log(`  锁住锋利 + 坚固:条数分布 ${[2, 3, 4].map(n => `${n} 条 ×${locked.filter(r => r.length === n).length}`).join(' · ')}`)
    expect(bareCounts[2]).toBe(0) // 不锁时不会超过品质区间上限(2)
    expect(bareCounts[0]! + bareCounts[1]!).toBe(400)
    expect(locked.every(r => r.length === 3)).toBe(true)
    // 锁住的两条原样留下(连掷点都不重掷)
    for (const result of locked.slice(0, 5)) {
      expect(result.find(a => a.id === 'sharp')).toEqual({ id: 'sharp', roll: 0.5 })
      expect(result.find(a => a.id === 'guard')).toEqual({ id: 'guard', roll: 0.5 })
    }
    // 防空转:两条锁住的 id 确实在结果里(否则上面只是"长度为 3")
    expect(locked[0]!.filter(a => a.id === 'sharp' || a.id === 'guard').length).toBe(2)
  })

  it('池子被门槛排空时,"至少一条新的"失效 —— 这是唯一"洗了等于没洗"的入口', () => {
    // 只给武器用的词条,却按"护具"洗:候选池为空
    const weaponOnly = createEquipmentSystem({
      slots: SLOTS,
      qualities: QUALITIES,
      templates: generateTemplates({
        slots: SLOTS,
        baseBySlot: { weapon: { attack: 5 }, head: { defense: 3 } },
        tiers: [['铁剑', '皮帽']]
      }),
      affixes: [{ id: 'edge', name: '开刃', key: 'critRate', min: 2, max: 6, weight: 60, slots: ['weapon'], desc: '暴击 +{v}%' }],
      power: { tierGrowth: 2, baseFactor: 0.6, qualityExponent: 1.6 },
      affixValueScale: 100
    })
    const kept: AffixRoll[] = [{ id: 'edge', roll: 0.5 }]
    const washed = weaponOnly.rerollAffixes(kept, {
      rng: createRng('排空'),
      quality: PLAIN,
      tier: 1,
      slot: 'head',
      keep: ['edge']
    })
    console.log(`  池子被部位筛空:结果 ${JSON.stringify(washed)}(只留下锁住的那条)`)

    // ② 给不出新的就只保留锁住的 —— 契约明说这是允许的,要不要允许由作品决定
    expect(washed).toEqual(kept)
    // 防空转:换个部位(有候选)立刻能洗出新的
    const ok = weaponOnly.rerollAffixes(kept, { rng: createRng('排空'), quality: FINE, tier: 6, slot: 'weapon', keep: [] })
    expect(ok.length).toBeGreaterThan(0)
  })

  it('同一件不撞名,数值覆盖全区间', () => {
    const results = wash(200, { quality: FINE, tier: 6, slot: 'weapon' })
    const flat = results.flat()
    const duplicates = results.filter(result => new Set(result.map(a => a.id)).size !== result.length).length
    console.log(`  洗 200 次(良品、6 层、武器):出现同名重复的 ${duplicates} 次 · 词条总次数 ${flat.length}`)

    // ③ 池子按已选 id 排除,同一件不会撞名
    expect(duplicates).toBe(0)
    // 洗出来的条目确实来自配置的池子(不出现编造的词条)
    expect(flat.every(a => system.affix(a.id) !== undefined)).toBe(true)
    // 良品专属词条(凝神 minRank 1)能出,凡品洗不出来
    const fineIds = new Set(flat.map(a => a.id))
    const plainFlat = wash(200, { quality: PLAIN, tier: 6, slot: 'weapon' }).flat()
    console.log(`  良品能洗出:${[...fineIds].join('、')} —— 凡品:${[...new Set(plainFlat.map(a => a.id))].join('、')}`)
    expect(fineIds.has('focus')).toBe(true)
    expect(new Set(plainFlat.map(a => a.id)).has('focus')).toBe(false)
    // 掷点覆盖 0~1 两端附近,均值落在中点(默认线性曲线)
    const rolls = flat.map(a => a.roll)
    const mean = rolls.reduce((a, b) => a + b, 0) / rolls.length
    console.log(`  掷点:最小 ${Math.min(...rolls).toFixed(3)} · 最大 ${Math.max(...rolls).toFixed(3)} · 均值 ${mean.toFixed(3)}`)
    expect(Math.min(...rolls)).toBeLessThan(0.1)
    expect(Math.max(...rolls)).toBeGreaterThan(0.9)
    expect(mean).toBeCloseTo(0.5, 1)
  })

  it('纯函数:洗的是词条构成,不动出身(品质 / 层级 / 部位)', () => {
    const before: AffixRoll[] = [{ id: 'sharp', roll: 0.2 }]
    const frozen = JSON.stringify(before)
    const after = system.rerollAffixes(before, { rng: createRng('纯函数'), quality: PLAIN, tier: 1, slot: 'weapon', keep: [] })
    console.log(`  入参 ${frozen} → 结果 ${JSON.stringify(after)}`)

    // 入参不被改动(纯函数)
    expect(JSON.stringify(before)).toBe(frozen)
    expect(after).not.toBe(before)
    // 洗出来的实例仍带着原来的品质与层级(这些字段不在 reroll 的职责里)
    const instance = system.generate(createRng('掉一件'), { tier: 3, slot: 'weapon' })
    const washed = system.rerollAffixes(instance.affixes, { rng: createRng('洗一件'), quality: system.quality('plain'), tier: instance.tier, slot: 'weapon' })
    expect(system.resolve({ ...instance, affixes: washed }).quality.id).toBe(instance.qualityId)
    expect(system.resolve({ ...instance, affixes: washed }).template?.id).toBe(instance.templateId)
    // 防空转:词条确实换了(否则上面两条是"没洗也成立")
    expect(washed.length).toBeGreaterThan(0)
  })
})
