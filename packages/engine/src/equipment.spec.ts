import { describe, expect, it } from 'vitest'
import type { Numeric } from './numeric.js'
import type { EquipmentConfig } from './equipment.js'
import { createEquipmentSystem } from './equipment.js'
import { createRng } from './rng.js'

const CONFIG: EquipmentConfig = {
  slots: [
    { id: 'weapon', name: '兵器', order: 1 },
    { id: 'body', name: '护甲', order: 2 },
    { id: 'ring', name: '指环', order: 3 }
  ],
  qualities: [
    { id: 'common', name: '凡品', rank: 0, mult: 1, affixes: [0, 1], fromTier: 1, toTier: 3, weight: 100 },
    { id: 'fine', name: '良品', rank: 1, mult: 1.5, affixes: [1, 2], fromTier: 1, toTier: 4, weight: 10 },
    { id: 'divine', name: '神品', rank: 2, mult: 3, affixes: [2, 3], fromTier: 4, toTier: 6, weight: 1 }
  ],
  templates: [
    { id: 'w1', name: '铜剑', slot: 'weapon', tier: 1, base: { attack: 10 } },
    { id: 'b1', name: '布衣', slot: 'body', tier: 1, base: { defense: 5, maxHp: 20 } },
    { id: 'r1', name: '铜戒', slot: 'ring', tier: 1, base: { attack: 2 }, setId: 's1' },
    { id: 'w2', name: '铁剑', slot: 'weapon', tier: 2, base: { attack: 12 } },
    { id: 'b2', name: '皮甲', slot: 'body', tier: 2, base: { defense: 6, maxHp: 24 } },
    { id: 'r2', name: '铁戒', slot: 'ring', tier: 2, base: { attack: 3 }, setId: 's1' }
  ],
  affixes: [
    { id: 'a_atk', name: '锋锐', key: 'attackPct', min: 1, max: 5, weight: 100, desc: '攻击提升 {v}%' },
    { id: 'a_crit', name: '会心', key: 'critRate', min: 1, max: 3, weight: 50, slots: ['weapon', 'ring'], desc: '暴击率提升 {v}%' },
    { id: 'a_hp', name: '厚土', key: 'maxHpPct', min: 2, max: 6, weight: 50, minRank: 1, slots: ['body'], desc: '生命上限提升 {v}%' }
  ],
  sets: [{ id: 's1', name: '铜铁套', bonuses: [{ pieces: 2, mods: { damageBonus: 0.05 }, desc: '两件:增伤 +5%' }] }],
  power: { tierGrowth: 2, baseFactor: 1, qualityExponent: 1, levelBonus: 0.1 }
}

describe('装备系统 —— 槽位/品质/模板/词条/套装', () => {
  it('层级系数表可以是宿主自己的数值类型(Numeric.of 原样收下,不经过 double)', () => {
    // 一个最小的大数壳:只为验证"引擎确实用它自己的数在算,而不是先投影成 number"
    type Box = { m: number; e: number }
    const at = (a: Box, b: Box): { a: Box; b: Box; e: number } => {
      const e = Math.max(a.e, b.e)
      return { a: { m: a.m * 10 ** (a.e - e), e }, b: { m: b.m * 10 ** (b.e - e), e }, e }
    }
    const box: Numeric<Box> = {
      zero: { m: 0, e: 0 },
      one: { m: 1, e: 0 },
      from: n => ({ m: n, e: 0 }),
      of: v => (typeof v === 'number' ? { m: v, e: 0 } : v),
      add: (a, b) => {
        const x = at(a, b)
        return { m: x.a.m + x.b.m, e: x.e }
      },
      sub: (a, b) => {
        const x = at(a, b)
        return { m: x.a.m - x.b.m, e: x.e }
      },
      mul: (a, b) => ({ m: a.m * b.m, e: a.e + b.e }),
      mulN: (a, k) => ({ m: a.m * k, e: a.e }),
      div: (a, b) => ({ m: a.m / b.m, e: a.e - b.e }),
      pow: (a, k) => ({ m: a.m ** k, e: 0 }),
      powN: (base, k) => ({ m: base ** k, e: 0 }),
      cmp: (a, b) => (a.m < b.m ? -1 : a.m > b.m ? 1 : 0),
      max: (a, b) => (a.m > b.m ? a : b),
      toNumber: a => a.m * 10 ** a.e,
      format: a => String(a.m)
    }
    const sys = createEquipmentSystem<Box>(
      { ...CONFIG, power: { ...CONFIG.power, tierFactors: [{ m: 5, e: 0 }, { m: 2, e: 1 }] } },
      box,
      () => 'uid'
    )
    // 基 10 × 层级系数 {m:2, e:1}(即 20)= {m:20, e:1}
    // —— **指数保住了**,说明表里的宿主数值原样进了运算,没有被先投影成 double
    const resolved = sys.resolve({ uid: 'u', templateId: 'w1', qualityId: 'common', tier: 2, level: 0, affixes: [] })
    expect(resolved.flats.attack).toEqual({ m: 20, e: 1 })
    expect(box.toNumber(resolved.flats.attack!)).toBe(200)
  })

  it('按层精确取池,不累积', () => {
    const sys = createEquipmentSystem(CONFIG)
    expect(sys.templatesAtTier(1, 'weapon').map(t => t.id)).toEqual(['w1'])
    expect(sys.templatesAtTier(2, 'weapon').map(t => t.id)).toEqual(['w2'])
    expect(sys.poolAtTier(2, 'weapon').map(t => t.id)).toEqual(['w2'])
    // 该层某部位没有本层模板时退到最近的一层(兜底,不该被走到)
    expect(sys.poolAtTier(5, 'weapon').map(t => t.id)).toEqual(['w2'])
  })

  it('词条筛选:部位与品质下限都生效', () => {
    const sys = createEquipmentSystem(CONFIG)
    const rng = createRng(7)
    for (let i = 0; i < 200; i += 1) {
      const inst = sys.generate(rng, { tier: 1, slot: 'weapon' })
      const quality = sys.quality(inst.qualityId)
      for (const roll of inst.affixes) {
        const def = sys.affix(roll.id)!
        expect(def.slots === undefined || def.slots.includes('weapon')).toBe(true)
        expect(def.minRank === undefined || quality.rank >= def.minRank).toBe(true)
        expect(roll.roll).toBeGreaterThanOrEqual(0)
        expect(roll.roll).toBeLessThan(1)
      }
      expect(inst.affixes.length).toBeGreaterThanOrEqual(quality.affixes[0])
      expect(inst.affixes.length).toBeLessThanOrEqual(quality.affixes[1])
    }
  })

  it('品质窗口:低层抽不到高层品质(神品只在 4 层以上)', () => {
    const sys = createEquipmentSystem(CONFIG)
    const rng = createRng(11)
    for (let i = 0; i < 500; i += 1) {
      const inst = sys.generate(rng, { tier: 1, slot: 'weapon' })
      expect(sys.quality(inst.qualityId).rank).toBeLessThan(2)
    }
  })

  it('显式指定品质下限时不吃窗口(剧情性的高品掉落)', () => {
    const sys = createEquipmentSystem(CONFIG)
    const rng = createRng(3)
    const inst = sys.generate(rng, { tier: 1, slot: 'weapon', minQualityRank: 2 })
    expect(inst.qualityId).toBe('divine')
  })

  it('同一种子生成同一件(概率逻辑可复现)', () => {
    const strip = (x: { uid: string }): Record<string, unknown> => {
      const copy: Record<string, unknown> = { ...x }
      delete copy.uid
      return copy
    }
    const a = createEquipmentSystem(CONFIG).generate(createRng(42), { tier: 2, slot: 'body' })
    const b = createEquipmentSystem(CONFIG).generate(createRng(42), { tier: 2, slot: 'body' })
    expect(strip(a)).toEqual(strip(b))
    // uid 由调用方注入时可以完全确定
    let n = 0
    const sys = createEquipmentSystem(CONFIG, undefined, () => `uid-${(n += 1)}`)
    expect(sys.generate(createRng(1), { tier: 1, slot: 'weapon' }).uid).toBe('uid-1')
    expect(sys.generate(createRng(1), { tier: 1, slot: 'weapon' }).uid).toBe('uid-2')
  })

  it('数值:平铺 = 模板基数 × 层级系数 × 品质倍率;强化按级加成', () => {
    const sys = createEquipmentSystem(CONFIG)
    const rng = createRng(5)
    const inst = sys.generate(rng, { tier: 2, slot: 'weapon', minQualityRank: 1 })
    const resolved = sys.resolve(inst)
    const factor = 1.5 ** 1 // qualityExponent 1,mult 1.5
    expect(Number(resolved.flats.attack)).toBeCloseTo(12 * 2 * factor, 6)
    const upgraded = sys.resolve({ ...inst, level: 2 })
    expect(Number(upgraded.flats.attack)).toBeCloseTo(12 * 2 * factor * 1.2, 6)
  })

  it('强化加成曲线可自己接管:levelBonusFn 返回并到 1 上的比例', () => {
    const sys = createEquipmentSystem({
      ...CONFIG,
      power: { ...CONFIG.power, levelBonusFn: level => Math.sqrt(level) * 0.1 }
    })
    const inst = { uid: 'u', templateId: 'w1', qualityId: 'common', tier: 1, level: 4, affixes: [] }
    const resolved = sys.resolve(inst)
    // 基 10 × 层级系数 1 × 品质 1 ×(1 + √4 × 0.1)= 12
    expect(Number(resolved.flats.attack)).toBeCloseTo(10 * 1.2, 6)
  })

  it('词条条数与权重也能自己接管:按层级给保底条数、按情境偏袒某几条', () => {
    const sys = createEquipmentSystem({
      ...CONFIG,
      maxAffixCount: 3,
      affixCountFn: (_quality, tier) => (tier >= 2 ? 3 : 1), // 高层保底三条
      affixWeightFn: (affix, _quality, tier) => (affix.id === 'a_crit' && tier >= 2 ? 10000 : 0)
    })
    const low = sys.generate(createRng(1), { tier: 1, slot: 'weapon' })
    expect(low.affixes.length).toBe(1)
    const high = sys.generate(createRng(2), { tier: 2, slot: 'weapon' })
    // 兵器位在配置里只有两条合法词条(a_atk / a_crit),要三条也只能给两条 —— 取尽即止
    expect(high.affixes.length).toBe(2)
    // 权重被接管后:除 a_crit 外全为 0,故它必在其中
    expect(high.affixes.map(a => a.id)).toContain('a_crit')
    // 超过上限时被 maxAffixCount 封顶
    const greedy = createEquipmentSystem({ ...CONFIG, maxAffixCount: 2, affixCountFn: () => 99 })
    expect(greedy.generate(createRng(3), { tier: 1, slot: 'weapon' }).affixes.length).toBeLessThanOrEqual(2)
  })

  it('词条数值 = min + (max-min) × roll,并按稀有度给出展示行', () => {
    const sys = createEquipmentSystem(CONFIG)
    const def = sys.affix('a_atk')!
    expect(sys.affixValue(def, 0)).toBe(1)
    expect(sys.affixValue(def, 1)).toBe(5)
    expect(sys.affixValue(def, 0.5)).toBe(3)
    const line = sys.resolve({
      uid: 'x',
      templateId: 'w1',
      qualityId: 'common',
      tier: 1,
      level: 0,
      affixes: [{ id: 'a_atk', roll: 0.5 }]
    }).affixLines[0]!
    expect(line.before).toBe('攻击提升 ')
    expect(line.value).toBe('3.0')
    expect(line.after).toBe('%')
  })

  it('词条取值曲线可自己接管:凸曲线让"掷得满"更值钱', () => {
    const sys = createEquipmentSystem({
      ...CONFIG,
      affixes: CONFIG.affixes.map(a => (a.id === 'a_atk' ? { ...a, valueCurve: (roll: number) => a.min + (a.max - a.min) * roll * roll } : a))
    })
    const def = sys.affix('a_atk')!
    // min 1 / max 5:线性中档是 3;平方曲线中档是 1 + 4×0.25 = 2
    expect(sys.affixValue(def, 0.5)).toBeCloseTo(2, 10)
    expect(sys.affixValue(def, 1)).toBeCloseTo(5, 10)
    expect(sys.affixValue(def, 0)).toBeCloseTo(1, 10)
  })

  it('词条数值的书写单位可配置:百分点书写时 ÷100 入属性', () => {
    const points = createEquipmentSystem({ ...CONFIG, affixValueScale: 100 })
    const instance = { uid: 'x', templateId: 'w1', qualityId: 'common', tier: 1, level: 0, affixes: [{ id: 'a_atk', roll: 0.5 }] }
    const resolved = points.resolve(instance)
    expect(resolved.mods.attackPct).toBeCloseTo(0.03, 10)
    // 展示仍是百分点写法
    expect(resolved.affixLines[0]!.value).toBe('3.0')
    const fine = createEquipmentSystem(CONFIG)
    expect(fine.resolve(instance).mods.attackPct).toBeCloseTo(3, 10)
  })

  it('装配:装到对应槽位,汇总平铺、词条与套装', () => {
    const sys = createEquipmentSystem(CONFIG)
    const rng = createRng(9)
    const ring1 = sys.generate(rng, { tier: 1, slot: 'ring' })
    const ring2 = sys.generate(rng, { tier: 2, slot: 'ring' })
    const body = sys.generate(rng, { tier: 1, slot: 'body' })
    const byUid = new Map([
      [ring1.uid, ring1],
      [ring2.uid, ring2],
      [body.uid, body]
    ])
    let loadout = sys.equip({ equipped: {} }, ring1)
    loadout = sys.equip(loadout, ring2)
    loadout = sys.equip(loadout, body)
    // 两个戒指只有一个槽位,后来的顶掉先前的
    expect(loadout.equipped['ring']).toBe(ring2.uid)
    const stats = sys.resolveLoadout(loadout, byUid)
    expect(Number(stats.flats.attack)).toBeCloseTo(Number(sys.resolve(ring2).flats.attack), 6)
    expect(stats.sets.length).toBe(0)
  })

  it('套装:达到件数才生效', () => {
    const sys = createEquipmentSystem(CONFIG)
    const ring2 = sys.generate(createRng(9), { tier: 2, slot: 'ring' })
    const byUid = new Map([[ring2.uid, ring2]])
    const stats = sys.resolveLoadout({ equipped: { ring: ring2.uid } }, byUid)
    expect(stats.sets).toEqual([])

    const weapon = { uid: 'w', templateId: 'w1', qualityId: 'common', tier: 1, level: 0, affixes: [] }
    const fake = createEquipmentSystem({
      ...CONFIG,
      templates: CONFIG.templates.map(t => (t.id === 'w1' ? { ...t, setId: 's1' } : t))
    })
    const s = fake.resolveLoadout({ equipped: { ring: ring2.uid, weapon: 'w' } }, new Map([[ring2.uid, ring2], ['w', weapon]]))
    expect(s.sets[0]?.name).toBe('铜铁套')
    expect(s.mods.damageBonus).toBeCloseTo(0.05, 10)
    expect(s.sets[0]?.pieces).toBe(2)
    expect(sys.sets[0]?.id).toBe('s1')
  })
})
