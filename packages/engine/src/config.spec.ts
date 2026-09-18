import { describe, expect, it } from 'vitest'
import type { GameConfig } from './config'
import { defineGame, validateGame } from './config'

function baseConfig(): GameConfig {
  return {
    name: '测试世界',
    attributes: {
      defs: [
        { key: 'attack', name: '攻击', kind: 'flat' },
        { key: 'defense', name: '防御', kind: 'flat' },
        { key: 'maxHp', name: '生命上限', kind: 'flat' },
        { key: 'attackPct', name: '攻击加成', kind: 'percent', appliesTo: 'attack' }
      ]
    },
    realms: {
      worlds: [{ id: 'a', name: '世界', realms: ['一境', '二境'] }],
      exp: { base: 10, realmGrowth: 2, layerGrowth: 1.5 },
      combat: { base: { attack: 10, defense: 5, maxHp: 100 }, realmGrowth: 2, layerGrowth: 1.2 },
      breakthrough: { layerBase: 0.9, layerDecay: 0.05, majorBase: 0.6, majorDecay: 0.05, min: 0.1, max: 1 },
      lifespan: { base: 100, growth: 2, worldStepMult: 3 }
    },
    equipment: {
      slots: [{ id: 'weapon', name: '武器' }],
      qualities: [{ id: 'common', name: '凡品', rank: 0, mult: 1, affixes: [0, 1], weight: 1 }],
      templates: [{ id: 'w1', name: '木棍', slot: 'weapon', tier: 1, base: { attack: 5 } }],
      affixes: [{ id: 'a1', name: '锋锐', key: 'attackPct', min: 1, max: 3, weight: 1 }],
      power: { tierGrowth: 2 }
    },
    dungeons: {
      regions: [{ id: 'r1', name: '一图', tier: 1, minRealm: 0, enemies: ['e1'], boss: 'b1' }],
      enemies: [
        { id: 'e1', name: '小怪', tier: 1, hpMult: 1, atkMult: 1, defMult: 1, speed: 1 },
        { id: 'b1', name: '首领', tier: 1, hpMult: 3, atkMult: 1.2, defMult: 1, speed: 1, boss: true }
      ]
    }
  }
}

describe('世界装配 —— 交叉校验', () => {
  it('干净配置没有 error', () => {
    const issues = validateGame(baseConfig())
    expect(issues.filter(i => i.level === 'error')).toEqual([])
  })

  it('装备模板指向未定义的槽位 → 报错', () => {
    const cfg = baseConfig()
    cfg.equipment.templates[0]!.slot = 'ghost'
    expect(validateGame(cfg).some(i => i.code === 'EQUIP_TEMPLATE_SLOT')).toBe(true)
    expect(() => defineGame(cfg)).toThrow(/EQUIP_TEMPLATE_SLOT/)
  })

  it('词条挂在未登记的属性键上 → 报错', () => {
    const cfg = baseConfig()
    cfg.equipment.affixes[0]!.key = '不存在'
    expect(validateGame(cfg).some(i => i.code === 'EQUIP_AFFIX_KEY')).toBe(true)
  })

  it('区域引用了不存在的敌人/首领 → 报错', () => {
    const cfg = baseConfig()
    cfg.dungeons.regions[0]!.enemies = ['nobody']
    cfg.dungeons.regions[0]!.boss = 'nobody2'
    const codes = validateGame(cfg).map(i => i.code)
    expect(codes).toContain('DUNGEON_REGION_ENEMY')
    expect(codes).toContain('DUNGEON_REGION_BOSS')
  })

  it('区域链条成环 → 报错', () => {
    const cfg = baseConfig()
    cfg.dungeons.regions.push({ id: 'r2', name: '二图', tier: 1, minRealm: 0, enemies: ['e1'], boss: 'b1', requireCleared: 'r3' })
    cfg.dungeons.regions.push({ id: 'r3', name: '三图', tier: 1, minRealm: 0, enemies: ['e1'], boss: 'b1', requireCleared: 'r2' })
    expect(validateGame(cfg).some(i => i.code === 'DUNGEON_REGION_CYCLE')).toBe(true)
  })

  it('区域推荐等级超出境界范围 → 报错', () => {
    const cfg = baseConfig()
    cfg.dungeons.regions[0]!.minRealm = 99
    expect(validateGame(cfg).some(i => i.code === 'DUNGEON_REGION_REALM')).toBe(true)
  })

  it('本层某部位没有内容 → 警告;strict 时挡住装配', () => {
    const cfg = baseConfig()
    cfg.equipment.slots.push({ id: 'armor', name: '护甲' })
    const issues = validateGame(cfg)
    expect(issues.some(i => i.code === 'EQUIP_SLOT_EMPTY')).toBe(true)
    expect(() => defineGame(cfg)).not.toThrow()
    expect(() => defineGame(cfg, { strict: true })).toThrow(/EQUIP_SLOT_EMPTY/)
  })

  it('首领没标 boss:true → 警告', () => {
    const cfg = baseConfig()
    cfg.dungeons.enemies.find(e => e.id === 'b1')!.boss = false
    expect(validateGame(cfg).some(i => i.code === 'DUNGEON_BOSS_FLAG')).toBe(true)
  })

  it('装配后四套系统都能直接用', () => {
    const game = defineGame(baseConfig())
    expect(game.realms.label(0, 0)).toBe('一境·一层')
    expect(game.attributes.name('attack')).toBe('攻击')
    expect(game.equipment.slots.length).toBe(1)
    expect(game.dungeons.firstRegion().id).toBe('r1')
  })
})
