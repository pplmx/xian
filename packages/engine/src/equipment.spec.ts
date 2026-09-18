import { describe, expect, it } from 'vitest'
import type { EquipmentConfig } from './equipment'
import { createEquipmentSystem } from './equipment'
import { createRng } from './rng'

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
