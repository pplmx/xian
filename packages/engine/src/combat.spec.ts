import { describe, expect, it } from 'vitest'
import { createCombatEngine } from './combat.js'
import { createRng } from './rng.js'

function fighter(overrides: Record<string, unknown> = {}) {
  // 本值收进一张表:键名是引擎的接口词,换题材时用 BattleConfig.keys 指过去
  const { hp, maxHp, attack, defense, speed, ...rest } = overrides as Record<string, number | undefined> & Record<string, unknown>
  return {
    id: 'p',
    name: '甲',
    stats: { hp: hp ?? 100, maxHp: maxHp ?? 100, attack: attack ?? 20, defense: defense ?? 5, speed: speed ?? 1 },
    mods: {},
    ...rest
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

  it('本值键名由作品定:叫火力/装甲/结构值/迅捷,战斗逻辑一行不用改', () => {
    const engine = createCombatEngine({
      keys: { attack: 'power', defense: 'armor', hp: 'hull', maxHp: 'hullMax', speed: 'agility' }
    })
    const me = {
      id: 'me',
      name: '舰',
      stats: { power: 200, armor: 4, hull: 300, hullMax: 300, agility: 2 },
      mods: {}
    }
    const foe = {
      id: 'foe',
      name: '靶',
      stats: { power: 10, armor: 0, hull: 40, hullMax: 40, agility: 1 },
      mods: {}
    }
    const result = engine.resolve(me, foe, createRng(9))
    expect(result.win).toBe(true)
    expect(Number(result.enemyHp)).toBeLessThanOrEqual(0)
    expect(Number(result.playerHp)).toBeLessThanOrEqual(300)
    // 传进去的对象不被就地改动(内部拷一份再打)
    expect(me.stats.hull).toBe(300)
    expect(foe.stats.hull).toBe(40)
  })

  it('伤害公式可自己接管:减法型、除算型、查表型都行(地板也归调用方)', () => {
    // 减法型:攻 − 防,至少 1
    const subtractive = createCombatEngine({
      variance: 0,
      damageFn: ctx => Math.max(1, ctx.attack * ctx.mult - ctx.defense)
    })
    const me = { id: 'me', name: '甲', stats: { attack: 50, defense: 5, hp: 100, maxHp: 100, speed: 2 }, mods: {} }
    const foe = { id: 'foe', name: '乙', stats: { attack: 5, defense: 20, hp: 90, maxHp: 90, speed: 1 }, mods: {} }
    const battle = subtractive.resolve(me, foe, createRng(1))
    expect(battle.win).toBe(true)
    // 每击 50−20=30,90 血正好三击;同一种子可复现
    const again = subtractive.resolve(me, foe, createRng(1))
    expect(again.events).toEqual(battle.events)
    // 只数我方出手:90 血 / 每击 30 = 三击(对方那几下不计)
    expect(battle.events.filter(e => e.actor === '甲' && (e.kind === 'hit' || e.kind === 'crit')).length).toBe(3)

    // 自定义公式里也能读到默认会给的那几样(浮动/增伤/减伤)
    const seen: number[] = []
    const probe = createCombatEngine({
      damageFn: ctx => {
        seen.push(ctx.damageBonus, ctx.damageReduction, ctx.variance)
        return 1
      }
    })
    probe.resolve(
      { id: 'a', name: '甲', stats: { attack: 10, defense: 0, hp: 100, maxHp: 100, speed: 1 }, mods: { damageBonus: 0.5 } },
      { id: 'b', name: '乙', stats: { attack: 1, defense: 0, hp: 100, maxHp: 100, speed: 1 }, mods: { damageReduction: 0.25 } },
      createRng(2)
    )
    expect(seen[0]).toBeCloseTo(0.5, 10)
    expect(seen[1]).toBeCloseTo(0.25, 10)
    expect(seen[2]).toBeCloseTo(0.08, 10)
  })
})
