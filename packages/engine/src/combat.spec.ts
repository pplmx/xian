import { describe, expect, it } from 'vitest'
import { createCombatEngine } from './combat.js'
import { createRng } from './rng.js'

function fighter(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p',
    name: '甲',
    hp: 100,
    maxHp: 100,
    attack: 20,
    defense: 5,
    speed: 1,
    mods: {},
    ...overrides
  }
}

describe('战斗解算 —— 副本遭遇要分得出胜负', () => {
  it('同一种子同一场(可复现)', () => {
    const engine = createCombatEngine()
    const a = engine.resolve(fighter(), fighter({ id: 'e', name: '乙' }), createRng(5))
    const b = engine.resolve(fighter(), fighter({ id: 'e', name: '乙' }), createRng(5))
    expect(a).toEqual(b)
  })

  it('强者胜:数值碾压时必胜,且回合数不超上限', () => {
    const engine = createCombatEngine({ maxRounds: 20 })
    const result = engine.resolve(
      fighter({ attack: 500, hp: 9999, maxHp: 9999 }),
      fighter({ id: 'e', name: '乙', attack: 1, hp: 30, maxHp: 30, defense: 0 }),
      createRng(1)
    )
    expect(result.win).toBe(true)
    expect(result.rounds).toBeLessThanOrEqual(20)
    expect(Number(result.enemyHp)).toBeLessThanOrEqual(0)
  })

  it('打不完算守方胜(回合上限)', () => {
    const engine = createCombatEngine({ maxRounds: 3, minDamageRatio: 0 })
    const result = engine.resolve(
      fighter({ attack: 1, hp: 1000, maxHp: 1000 }),
      fighter({ id: 'e', name: '乙', attack: 1, hp: 1000, maxHp: 1000, defense: 0 }),
      createRng(2)
    )
    expect(result.win).toBe(false)
    expect(result.rounds).toBe(3)
  })

  it('闪避率把命中率压下去,事件里记成落空', () => {
    const engine = createCombatEngine({ variance: 0 })
    const result = engine.resolve(
      fighter(),
      fighter({ id: 'e', name: '乙', mods: { dodgeRate: 0.9 }, hp: 100, maxHp: 100 }),
      createRng(3)
    )
    expect(result.events.some(e => e.kind === 'dodge')).toBe(true)
  })

  it('暴击倍率与减伤都参与结算', () => {
    const engine = createCombatEngine({ variance: 0 })
    const plain = engine.resolve(
      fighter({ mods: {} }),
      fighter({ id: 'e', name: '乙', hp: 500, maxHp: 500, defense: 0 }),
      createRng(4)
    )
    const tanky = engine.resolve(
      fighter({ mods: {} }),
      fighter({ id: 'e', name: '乙', hp: 500, maxHp: 500, defense: 0, mods: { damageReduction: 0.5 } }),
      createRng(4)
    )
    const damageOf = (r: ReturnType<typeof engine.resolve>): number =>
      r.events.filter(e => e.kind === 'hit' || e.kind === 'crit').reduce((a, e) => a + e.damage, 0)
    expect(damageOf(tanky)).toBeLessThan(damageOf(plain))
  })

  it('吸血与回合回复都能把血量拉回来', () => {
    const engine = createCombatEngine()
    const result = engine.resolve(
      fighter({ attack: 200, hp: 50, maxHp: 500, mods: { lifesteal: 0.5 } }),
      fighter({ id: 'e', name: '乙', hp: 60, maxHp: 60, defense: 0 }),
      createRng(6)
    )
    expect(result.win).toBe(true)
    expect(result.events.some(e => e.kind === 'lifesteal')).toBe(true)
    expect(Number(result.playerHp)).toBeGreaterThan(50)
  })
})
