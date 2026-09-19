import { describe, expect, it } from 'vitest'
import type { GameConfig } from './config.js'
import { emptyProgress, type DungeonConfig } from './dungeons.js'
import type { EquipmentConfig } from './equipment.js'
import { defineGame, validateGame } from './config.js'
import { createRng } from './rng.js'

/**
 * 用例要**逐字段拧**这两层(改一个槽位、塞一个环),所以这里把类型写实:
 * `GameConfig` 允许 `equipment: null`(那表示这款游戏没有这一层),而这份夹具两层都有。
 */
type SolidGameConfig = GameConfig & { equipment: EquipmentConfig<number>; dungeons: DungeonConfig<number> }

function baseConfig(): SolidGameConfig {
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

  it('多条前置:逐条校验存在性,成环也照样查得出来', () => {
    const cfg = baseConfig()
    cfg.dungeons.regions.push({ id: 'r2', name: '二图', tier: 1, minRealm: 0, enemies: ['e1'], boss: 'b1' })
    cfg.dungeons.regions.push({ id: 'r3', name: '三图', tier: 1, minRealm: 0, enemies: ['e1'], boss: 'b1', requireCleared: ['r1', 'nobody'] })
    const codes = validateGame(cfg).map(i => i.code)
    expect(codes).toContain('DUNGEON_REGION_CHAIN')

    const cyc = baseConfig()
    cyc.dungeons.regions.push({ id: 'r2', name: '二图', tier: 1, minRealm: 0, enemies: ['e1'], boss: 'b1', requireCleared: ['r3'] })
    cyc.dungeons.regions.push({ id: 'r3', name: '三图', tier: 1, minRealm: 0, enemies: ['e1'], boss: 'b1', requireCleared: ['r2'] })
    expect(validateGame(cyc).some(i => i.code === 'DUNGEON_REGION_CYCLE')).toBe(true)
  })

  it('逐境层数可不同:某一境自己给了 layers 就用它,其余仍用全局那套', () => {
    const cfg = baseConfig()
    cfg.realms.worlds = [{ id: 'a', name: '世界', realms: [{ name: '一境', layers: ['上', '下'] }, '二境'] }]
    const game = defineGame(cfg)
    expect(game.realms.layersOf(0)).toEqual(['上', '下'])
    // 没写 layers 的仍用全局那套
    expect(game.realms.layersOf(1)).toEqual(game.realms.layerNames)
    expect(game.realms.maxLayerOf(0)).toBe(1)
    expect(game.realms.maxLayerOf(1)).toBe(game.realms.layerNames.length - 1)
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

/**
 * 门面可以只装一半 —— 「这款游戏没有装备 / 没有副本」也是一句话。
 *
 * 为什么值得单独立判据:库要能被拿去搭完全不同的题材(读书打卡、经营、日常),
 * 而"没有战斗、没有装备"的那些作品不该被迫编两张空表、更不该拿到一句
 * `Cannot read properties of undefined`。这里钉三件事:
 *   ① 没有的那一层写 `null` —— 装得起来,门面里那一层是**有意义的空**(0 槽 0 件 / 0 区域);
 *   ② 真去用空的那一层 —— **当场说明白**(而不是给回一个 undefined);
 *   ③ **省略**不是"没有":省了一节就是配置写错了,装配时给一句人话。
 */
describe('门面可以只装一半', () => {
  const halfAssembled = (): GameConfig => ({ ...baseConfig(), equipment: null, dungeons: null })

  it('只写等级与属性,照样装出一个世界;没有的那两层是空系统', () => {
    const game = defineGame(halfAssembled())
    expect(game.realms.realms.length).toBe(2)
    expect(game.attributes.name('attack')).toBe('攻击')
    // 空系统:读数是有意义的空,不是 undefined
    expect(game.equipment.slots).toEqual([])
    expect(game.equipment.qualities).toEqual([])
    expect(game.equipment.poolAtTier(1)).toEqual([])
    expect(game.dungeons.regions).toEqual([])
    expect(game.dungeons.unlocked(emptyProgress(), 0)).toEqual([])
    // "这层到底有没有"看配置里那句话就够了
    expect(game.config.equipment).toBeNull()
    expect(game.config.dungeons).toBeNull()
  })

  it('真去用空的那一层:当场说明白,而不是回一个 undefined', () => {
    const game = defineGame(halfAssembled())
    const rng = createRng(7)
    expect(() => game.equipment.generate(rng, { tier: 1 })).toThrow('装备系统:没有任何可掉落的槽位')
    expect(() => game.equipment.quality('common')).toThrow('装备系统:品质表是空的,没有可用的品质')
    expect(() => game.equipment.rollQuality(1, rng)).toThrow('装备系统:品质表是空的,没有可用的品质')
    expect(() => game.dungeons.firstRegion()).toThrow('副本系统:区域表是空的,没有第一处区域')
    // 空链是读得懂的空答案:没有副本这一层时,"这一条链"就是空的
    expect(game.dungeons.chain()).toEqual([])
  })

  it('省了一节 ≠ 没有这一层:装配时给一句人话,不是 Cannot read properties of undefined', () => {
    const missing = { ...baseConfig() } as Record<string, unknown>
    delete missing.equipment
    const issues = validateGame(missing as unknown as GameConfig)
    expect(issues.map(i => i.code)).toContain('CONFIG_SECTION_MISSING')
    expect(issues.some(i => i.message.includes('配置里缺了 equipment 这一节'))).toBe(true)
    expect(() => defineGame(missing as unknown as GameConfig)).toThrow(/配置里缺了 equipment 这一节/)
  })

  it('形状写坏了(少了 affixes / power):一样是装配报错,不是崩掉', () => {
    const broken = {
      ...baseConfig(),
      equipment: { slots: [], qualities: [], templates: [] }
    } as unknown as GameConfig
    const codes = validateGame(broken).map(i => i.code)
    expect(codes.filter(code => code === 'CONFIG_FIELD_SHAPE').length).toBe(2)
    expect(() => defineGame(broken)).toThrow(/CONFIG_FIELD_SHAPE/)
  })
})
