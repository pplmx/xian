/**
 * 预设冒烟 —— 两份内容包都要能装配、能跑完整一圈。
 *
 * 这份用例同时是"换皮"这条主张的判据:仙侠包与星港包的**机制键完全一致**,
 * 名字没有一处相同,而两边都能算出等级、掉出装备、打完副本。
 */
import { describe, expect, it } from 'vitest'
import { defineGame } from '../config'
import { emptyProgress } from '../dungeons'
import { createRng } from '../rng'
import { DEMO } from './demo'
import { XIUXIAN } from './xiuxian'

describe('内容包 —— 仙侠与星港', () => {
  it('仙侠包:四界二十一境,六层装备,一条副本链', () => {
    const game = defineGame(XIUXIAN)
    expect(game.realms.realms.length).toBe(21)
    expect(game.realms.worlds.map(w => w.name)).toEqual(['人间界', '仙界', '神界', '混沌海'])
    expect(game.realms.label(0, 2)).toBe('炼气·三层')
    expect(game.realms.label(20, 9)).toBe('混沌道祖·圆满')
    expect(game.equipment.slots.length).toBe(9)
    expect(game.equipment.qualities.length).toBe(9)
    expect(game.dungeons.chain().map(r => r.id)).toEqual(['qingyun', 'luoxia', 'heifeng', 'hantan', 'wanyao', 'guzhan'])
    // 每层九件都有本层内容,不掉档
    for (let tier = 1; tier <= 6; tier += 1) {
      for (const slot of game.equipment.slots) {
        expect(game.equipment.templatesAtTier(tier, slot.id).length).toBe(1)
      }
    }
  })

  it('星港包:名称全换,机制键一个不差', () => {
    const demo = defineGame(DEMO)
    const xian = defineGame(XIUXIAN)
    expect(demo.realms.label(0, 0)).toBe('见习船员 I 阶')
    expect(demo.attributes.name('attack')).toBe('火力')
    expect(demo.attributes.name('maxHp')).toBe('结构值')
    expect(demo.equipment.slots.map(s => s.name)).toEqual(['主武器', '舰桥', '装甲板', '推进器', '能源核心', '辅助模组'])
    // 机制键与仙侠包完全一致:换的只是名字
    expect(demo.attributes.defs.map(d => d.key)).toEqual(xian.attributes.defs.map(d => d.key))
    expect(new Set(demo.attributes.defs.map(d => d.name)).size).toBe(demo.attributes.defs.length)
  })

  it('星港包能跑完整一圈:修炼 → 进阶 → 掉装 → 装配 → 打副本 → 通关拿奖励', () => {
    const game = defineGame(DEMO)
    const rng = createRng('星港-1')

    // 1 修炼:加修为直到本层满
    let state = { major: 0, layer: 0, exp: 0 }
    state = game.realms.addExp(state, Number(game.realms.expCost(0, 0)))
    expect(game.realms.progress(state).ready).toBe(true)

    // 2 进阶(加成拉满;失败就再来一次 —— 试炼有概率,玩家本来就要重复尝试)
    let step = game.realms.attemptBreakthrough(state, { rng, bonusRate: 10 })
    for (let i = 0; i < 50 && !step.ok; i += 1) {
      step = game.realms.attemptBreakthrough(state, { rng, bonusRate: 10 })
    }
    expect(step.ok).toBe(true)
    expect(step.to).toBe('见习船员 II 阶')
    state = step.state

    // 3 掉装
    const loot = game.equipment.generate(rng, { tier: 1 })
    const resolved = game.equipment.resolve(loot)
    expect(resolved.template).toBeDefined()
    expect(Object.keys(resolved.flats).length).toBeGreaterThan(0)

    // 4 装配
    const loadout = game.equipment.equip({ equipped: {} }, loot)
    const stats = game.equipment.resolveLoadout(loadout, new Map([[loot.uid, loot]]))
    expect(Object.keys(stats.flats).length).toBeGreaterThan(0)

    // 5 打副本:玩家属性 = 境界基础 + 装备
    const base = game.realms.baseStats(state.major, state.layer)
    const computed = game.attributes.compute({
      base,
      flat: stats.flats,
      modSources: [stats.mods, resolved.mods]
    })
    const region = game.dungeons.firstRegion()
    const encounter = game.dungeons.nextEncounter(region.id, emptyProgress(), rng)
    const enemy = game.dungeons.snapshot(encounter.enemyId)
    const battle = game.combat.resolve(
      {
        id: 'player',
        name: '玩家',
        hp: computed.final.maxHp ?? 0,
        maxHp: computed.final.maxHp ?? 0,
        attack: computed.final.attack ?? 0,
        defense: computed.final.defense ?? 0,
        speed: 1 + (computed.mods.speed ?? 0),
        mods: computed.mods
      },
      { id: enemy.id, name: enemy.name, hp: enemy.hp, maxHp: enemy.hp, attack: enemy.attack, defense: enemy.defense, speed: enemy.speed, mods: enemy.mods, skills: enemy.skills },
      rng
    )
    expect(battle.events.length).toBeGreaterThan(0)
    expect(Number.isFinite(Number(battle.playerHp))).toBe(true)

    // 6 结算奖励与通关
    const outcome = game.dungeons.onVictory(region.id, { ...encounter, kind: 'boss' }, emptyProgress(), rng)
    expect(outcome.firstClear).toBe(true)
    expect(outcome.progress.cleared).toEqual([region.id])
    expect(outcome.rewards.map(r => r.id)).toContain('credit')
    expect(outcome.rewards.map(r => r.id)).toContain('exp')
  })

  it('仙侠包的装备名字与地界对应(一阶一名,看到名字就知道是哪一层)', () => {
    const game = defineGame(XIUXIAN)
    const tier1 = game.equipment.poolAtTier(1, 'weapon')[0]!
    const tier2 = game.equipment.poolAtTier(2, 'weapon')[0]!
    expect(tier1.name).toBe('青竹剑')
    expect(tier2.name).toBe('玄铁重剑')
    expect(game.equipment.template('t2_weapon_1')?.setId).toBe('s_tiebi')
  })
})
