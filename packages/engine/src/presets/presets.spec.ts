/**
 * 预设冒烟 —— 两份内容包都要能装配、能跑完整一圈。
 *
 * 这份用例同时是"换皮"这条主张的判据:仙侠包与星港包的**机制键完全一致**,
 * 名字没有一处相同,而两边都能算出等级、掉出装备、打完副本。
 */
import { describe, expect, it } from 'vitest'
import { defineGame } from '../config.js'
import { emptyProgress } from '../dungeons.js'
import { createRng } from '../rng.js'
import { DEMO } from './demo.js'
import { XIUXIAN } from './xiuxian.js'
import { DAILY, DAILY_COMPANIONS, DAILY_COOKING, DAILY_SKILLS } from './daily.js'
import { MINIMAL } from './minimal.js'
import { composeCraftRate } from '../crafting.js'
import { createCompanionSystem } from '../companions.js'
import { createSkillSystem } from '../skills.js'

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
        stats: {
          hp: computed.final.maxHp ?? 0,
          maxHp: computed.final.maxHp ?? 0,
          attack: computed.final.attack ?? 0,
          defense: computed.final.defense ?? 0,
          speed: 1 + (computed.mods.speed ?? 0)
        },
        mods: computed.mods
      },
      { id: enemy.id, name: enemy.name, stats: enemy.stats, mods: enemy.mods, skills: enemy.skills },
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

describe('内容包 —— 书桌与日常(跨题材通用性的判据)', () => {
  it('同一套内核装出一款学习/日常游戏:学段与周次、专注与精力、文具与书桌', () => {
    const game = defineGame(DAILY)
    expect(game.realms.worlds.map(w => w.name)).toEqual(['小学', '中学', '高中'])
    expect(game.realms.realms.length).toBe(9)
    expect(game.realms.label(0, 0)).toBe('启蒙班·第一周')
    expect(game.realms.label(8, 5)).toBe('高三·期末')
    expect(game.attributes.name('attack')).toBe('专注力')
    expect(game.attributes.name('maxHp')).toBe('精力')
    expect(game.attributes.name('cultivationSpeed')).toBe('学习效率')
    expect(game.equipment.slots.map(s => s.name)).toEqual(['文具', '耳机', '书桌', '小摆件'])
    expect(game.equipment.qualities.map(q => q.name)).toEqual(['地摊货', '文具店', '限定款'])
    expect(game.dungeons.chain().map(r => r.name)).toEqual(['图书馆', '自习室', '教室'])
    expect(game.dungeons.enemy('finalexam')?.name).toBe('期末考试')
  })

  it('换的只是名字:机制键与仙侠包**一个不差**,改过名的键名字全不一样', () => {
    const daily = defineGame(DAILY)
    const xian = defineGame(XIUXIAN)
    // 机制键完全一致 —— 这是"同一套内核"的硬证据
    expect(daily.attributes.defs.map(d => d.key)).toEqual(xian.attributes.defs.map(d => d.key))
    // 逐键比展示名:本包显式改过名的那些,名字必须与仙侠包不同
    const xianName = new Map(xian.attributes.defs.map(d => [d.key, d.name]))
    const renamed = daily.attributes.defs.filter(d => (xianName.get(d.key) ?? d.key) !== d.name)
    expect(renamed.length).toBeGreaterThanOrEqual(12)
    expect(renamed.map(d => d.name)).toContain('专注力')
    expect(renamed.map(d => d.name)).toContain('学习效率')
    // 展示名不重复(免得面板上两条词条同名)
    expect(new Set(daily.attributes.defs.map(d => d.name)).size).toBe(daily.attributes.defs.length)
  })

  it('这款学习游戏能跑完整一圈:自习 → 升学 → 换文具 → 去图书馆 → 期末考 → 通关', () => {
    const game = defineGame(DAILY)
    const rng = createRng('书桌')

    // 自习(加"理解")→ 升学
    let state = { major: 0, layer: 0, exp: 0 }
    state = game.realms.addExp(state, Number(game.realms.expCost(0, 0)))
    let step = game.realms.attemptBreakthrough(state, { rng, bonusRate: 1 })
    for (let i = 0; i < 50 && !step.ok; i += 1) step = game.realms.attemptBreakthrough(state, { rng, bonusRate: 1 })
    expect(step.ok).toBe(true)
    expect(step.to).toBe('启蒙班·第二周')
    state = step.state

    // 换文具
    const loot = game.equipment.generate(rng, { tier: 1, luck: 0.2 })
    const item = game.equipment.resolve(loot)
    expect(item.template).toBeDefined()
    const equipped = game.equipment.resolveLoadout(game.equipment.equip({ equipped: {} }, loot), new Map([[loot.uid, loot]]))
    const stats = game.attributes.compute({ base: game.realms.baseStats(state.major, state.layer), flat: equipped.flats, modSources: [equipped.mods, item.mods] })
    expect(Number(stats.final.maxHp ?? 0)).toBeGreaterThan(0)

    // 去图书馆:遇到阻碍 → 打一场 → 通关拿奖励
    const region = game.dungeons.firstRegion()
    expect(region.name).toBe('图书馆')
    const encounter = game.dungeons.nextEncounter(region.id, emptyProgress(), rng)
    const foe = game.dungeons.snapshot(encounter.enemyId)
    expect(foe.name.length).toBeGreaterThan(0)
    const battle = game.combat.resolve(
      {
        id: 'me',
        name: '我',
        stats: {
          hp: stats.final.maxHp ?? 0,
          maxHp: stats.final.maxHp ?? 0,
          attack: stats.final.attack ?? 0,
          defense: stats.final.defense ?? 0,
          speed: 1
        },
        mods: stats.mods
      },
      { id: foe.id, name: foe.name, stats: foe.stats, mods: foe.mods, skills: foe.skills },
      rng
    )
    expect(Number.isFinite(Number(battle.playerHp))).toBe(true)
    const outcome = game.dungeons.onVictory(region.id, { ...encounter, kind: 'boss' }, emptyProgress(), rng)
    expect(outcome.firstClear).toBe(true)
    expect(outcome.rewards.map(r => r.name)).toContain('理解')
    expect(outcome.rewards.map(r => r.name)).toContain('零花钱')
  })

  it('学科、朋友的性子、做饭都能用同一套系统装出来', () => {
    const skills = createSkillSystem(DAILY_SKILLS)
    expect(skills.modsAt('math', 6).attackPct).toBeCloseTo(0.04 + 0.02 * 5, 10)
    expect(skills.costAt('math', 3).map(c => c.key)).toEqual(['homework', 'notebook'])
    expect(skills.branchesOf('math').map(b => b.id)).toEqual(['drill', 'insight'])
    expect(skills.sourcesOf([{ skillId: 'math', level: 6, branchId: 'insight' }]).length).toBe(2)

    const companions = createCompanionSystem(DAILY_COMPANIONS)
    expect(companions.effectsOf('deskmate').dropLuck).toBeCloseTo(0.05, 10)
    expect(companions.effectsOf('cat').lossReduction).toBeCloseTo(0.04, 10)
    expect(companions.modsOf('deskmate')).toEqual({ attackPct: 0.03 })
    expect(companions.effectsOf(null).dropLuck).toBe(0)

    // 做饭:三项全满、不做超过能力的菜时贴着基准率
    const perfect = composeCraftRate({ heat: 1, prep: 1, seasoning: 1, dishRank: 0 }, DAILY_COOKING)
    expect(perfect).toBeCloseTo(0.95, 10)
    const hard = composeCraftRate({ heat: 0.5, prep: 0.5, seasoning: 0.4, dishRank: 2 }, DAILY_COOKING)
    expect(hard).toBeGreaterThan(0)
    expect(hard).toBeLessThan(0.4)
  })
})

/**
 * 只装两层的那一份 —— 「没有战斗、没有装备的题材」在库里不是二等公民。
 *
 * 这份内容包的意义不是"再来一份样例",而是把通用性放到最硬的地方试一次:
 * **用得上几层就装几层**,不必为了"这游戏没有副本"去编一张空表,更不该在装配时崩掉。
 */
describe('内容包 —— 只装两层的那一份(最小内容包)', () => {
  it('没有装备与副本的世界照样装得起来、跑得动', () => {
    const game = defineGame(MINIMAL)
    expect(game.config.equipment).toBeNull()
    expect(game.config.dungeons).toBeNull()
    expect(game.realms.label(0, 0)).toBe('学徒·粗活')
    expect(game.realms.label(3, 2)).toBe('名师·绝活')
    // 机制键没换,换的只是展示名
    expect(game.attributes.name('attack')).toBe('手感')
    expect(game.attributes.name('maxHp')).toBe('名气')

    // 升级这条主链看得见:满足需求 → 进阶 → 面板抬起来
    const before = Number(game.realms.baseStats(0, 0)['attack'] ?? 0)
    const state = game.realms.addExp({ major: 0, layer: 0, exp: 0 }, Number(game.realms.expCost(0, 0)))
    expect(game.realms.progress(state).ready).toBe(true)
    let step = game.realms.attemptBreakthrough(state, { rng: createRng('工坊'), bonusRate: 10 })
    for (let i = 0; i < 50 && !step.ok; i += 1) {
      step = game.realms.attemptBreakthrough(state, { rng: createRng(`工坊-${i}`), bonusRate: 10 })
    }
    expect(step.ok).toBe(true)
    expect(Number(game.realms.baseStats(step.state.major, step.state.layer)['attack'] ?? 0)).toBeGreaterThan(before)

    // 空的那两层:空链是读得懂的空答案;取第一处则当场说明白
    expect(game.dungeons.chain()).toEqual([])
    expect(() => game.dungeons.firstRegion()).toThrow('副本系统:区域表是空的,没有第一处区域')
  })
})
