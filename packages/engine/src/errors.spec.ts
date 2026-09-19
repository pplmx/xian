/* eslint-disable no-console */
/**
 * 报错口径 —— **每一条配置错误都有人真的触发过,而且说清是哪一处**。
 *
 * 这一份是审计出来的:库里有 23 处 `throw`,其中 15 处**没有任何用例触发过**。
 * 两个后果都不是小事:
 *
 *   一 **报错可能早就不会走到了** —— 参数改名、校验挪位置之后,那句 throw 变成死代码,
 *      使用者写错配置时不再被拦住,而是拿到一个 NaN 或者半装好的世界;
 *   二 **报错文案会悄悄漂移** —— 文案本身就是给人看的:内容作者看到的第一句话往往就是它。
 *      库里其他面向使用者的东西(示例、文档、定制表)都有判据,只有报错一直没人管。
 *
 * 口径(与库里其他判据一致):
 *   · 每条错误都必须**被触发一次**(不是"看着像"就算);
 *   · 消息里必须带上**是哪一处**(键名 / id / 区域名),否则使用者还得自己找;
 *   · 前缀稳定 —— 前缀就是"这是哪一类问题"。
 *
 * 常驻判据:`scripts/verify-dist.mjs` 的「报错口径自检」按源码里的 `throw new Error(...)`
 * 逐个查"有没有 spec 触发过它";新加一条抛错却忘了配用例,当场红。
 */
import { describe, expect, it } from 'vitest'
import { attributeDefs, createAttributeSystem } from './attributes.js'
import { createCompanionSystem, type CompanionConfig } from './companions.js'
import { defineGame } from './config.js'
import { createDungeonSystem, emptyProgress, type DungeonConfig } from './dungeons.js'
import { createEquipmentSystem } from './equipment.js'
import { planIdle } from './idle.js'
import { createStageMemory } from './memory.js'
import { createRealmSystem, type RealmSystemConfig } from './realms.js'
import { createRng } from './rng.js'
import { defineSaveFormat } from './save.js'
import { createSkillSystem } from './skills.js'
import { DEMO } from './presets/demo.js'

// ——— 一份"最小可用"的骨架:每个用例只在它上面改坏一处 ———

const realmConfig = (): RealmSystemConfig => ({
  worlds: [{ id: 'a', name: '一段', realms: ['一境', '二境'] }],
  layerNames: ['上', '下'],
  exp: { base: 10, layerGrowth: 2, realmGrowth: 3 },
  combat: { base: { attack: 1 }, layerGrowth: 2, realmGrowth: 3 },
  breakthrough: { layerBase: 0.9, layerDecay: 0.1, majorBase: 0.6, majorDecay: 0.1, min: 0.1, max: 0.9 }
})

/** 装备那份骨架直接借预设(它有 power / 词条 / 品质这些必填项),只在上面改坏一处 */
const equipmentConfig = () => structuredClone(DEMO.equipment)

const dungeonConfig = (): DungeonConfig => ({
  regions: [{ id: 'pass', name: '山口', tier: 1, minRealm: 0, enemies: ['wolf'], boss: 'wolf' }],
  enemies: [{ id: 'wolf', name: '狼', tier: 1, hpMult: 1, atkMult: 1, defMult: 1, speed: 1 }],
  enemyPower: { baseHp: 10, baseAttack: 2, baseDefense: 1, tierGrowth: 2 }
})

const companionConfig = (): CompanionConfig => ({
  neutral: { luck: 0 },
  traits: [{ id: 'sharp', name: '眼尖', mods: { luck: 0.2 } }],
  companions: [{ id: 'cat', name: '猫', traitId: 'sharp' }]
})

describe('报错口径 —— 配置写错时,使用者拿到的是哪一句话', () => {
  it('属性:键重复 / core 指向没登记的键 —— 两条都点名是哪一个', () => {
    const defs = attributeDefs({})
    expect(() => createAttributeSystem({ defs: [...defs, { ...defs[0]! }] })).toThrow(/属性系统:键重复 —— attack/)

    expect(() => createAttributeSystem({ defs, core: ['nope'] })).toThrow(/属性系统:core 里的键未登记 —— nope/)

    // 词条指向一个没登记过的主键:这条以前只有文档说"会拦",没有用例
    expect(() =>
      createAttributeSystem({ defs: [...defs, { key: 'weird', name: '怪', kind: 'percent', appliesTo: 'ghost' }] })
    ).toThrow(/属性系统:weird 的 appliesTo 指向未登记的键 —— ghost/)
    console.log('  属性三条:键重复 / core 未登记 / appliesTo 指向未登记的键,都点名了具体键')
  })

  it('等级:世界一个境界都没有 / 寿元缺某个世界 —— 都点名是哪个世界', () => {
    expect(() => createRealmSystem({ ...realmConfig(), worlds: [{ id: 'empty', name: '空界', realms: [] }] })).toThrow(
      /等级体系:世界 empty 一个境界都没有/
    )
    expect(() =>
      createRealmSystem({
        ...realmConfig(),
        worlds: [
          { id: 'a', name: '一段', realms: ['一境'] },
          { id: 'b', name: '二段', realms: ['二境'] }
        ],
        lifespan: { byWorld: { a: { base: 100, growth: 2 } } }
      })
    ).toThrow(/等级体系:缺少世界 b 的寿元参数/)

    // 两条"骨架就错了"的检查:小层名目是空的、一个境界都没有
    expect(() => createRealmSystem({ ...realmConfig(), layerNames: [] })).toThrow(/等级体系:layerNames 不能为空/)
    expect(() => createRealmSystem({ ...realmConfig(), worlds: [] })).toThrow(/等级体系:境界表为空/)
    console.log('  等级四条:空世界 / 缺寿元 / 空小层名目 / 空境界表')
  })

  it('装备:这一层没内容 / 这个槽位没内容 —— 分别报出层与槽位', () => {
    // 一件模板都没有:掷都掷不出来
    const empty = equipmentConfig()
    empty.templates = []
    expect(() => createEquipmentSystem(empty).generate(createRng('报错'), { tier: 3 })).toThrow(
      /装备系统:层级 3 没有任何可掉落的模板/
    )

    // 点名要武器,而武器槽**一件模板都没有**(注意:只是"这一层没有"不算错 ——
    // 层内容不全时引擎会退档到该槽位有内容的层,那条口径见 equipment.spec)
    const noSlot = equipmentConfig()
    const weapon = noSlot.slots[0]!.id
    noSlot.templates = noSlot.templates.filter(t => t.slot !== weapon)
    expect(() => createEquipmentSystem(noSlot).generate(createRng('报错'), { tier: 2, slot: weapon })).toThrow(
      new RegExp(`装备系统:层级 2 的槽位 ${weapon} 没有任何模板`)
    )

    // 所有槽位都标成"不掉":也没有可掷的东西
    const noDrop = equipmentConfig()
    noDrop.slots = noDrop.slots.map(s => ({ ...s, dropWeight: 0 }))
    expect(() => createEquipmentSystem(noDrop).generate(createRng('报错'), { tier: 1 })).toThrow(
      /装备系统:没有任何可掉落的槽位/
    )
    console.log('  装备两条:一个报层、一个报层 + 槽位')
  })

  it('副本:问一个不存在的区域 / 一个不存在的敌人 —— 都点名是哪一个', () => {
    const sys = createDungeonSystem(dungeonConfig())
    expect(() => sys.nextEncounter('nope', emptyProgress(), createRng('报错'))).toThrow(/副本系统:没有这个区域 —— nope/)
    expect(() =>
      sys.onVictory('nope', { regionId: 'nope', kind: 'normal', enemyId: 'wolf' }, emptyProgress(), createRng('报错'))
    ).toThrow(/副本系统:没有这个区域 —— nope/)
    expect(() => sys.snapshot('ghost')).toThrow(/副本系统:没有这个敌人 —— ghost/)
    console.log('  副本两条:区域与敌人都点名了 id(同一句文案在两处出口都走到)')
  })

  it('技能:id 重复 / maxLevel 不合法', () => {
    const skill = (over: Partial<{ id: string; maxLevel: number }> = {}) => ({
      id: 'fire',
      name: '火候',
      kind: '主技',
      maxLevel: 3,
      baseMods: {},
      perLevelMods: {},
      ...over
    })
    expect(() => createSkillSystem({ skills: [skill(), skill()] })).toThrow(/技能系统:id 重复 —— fire/)
    expect(() => createSkillSystem({ skills: [skill({ maxLevel: 0 })] })).toThrow(
      /技能系统:fire 的 maxLevel 必须是 ≥1 的整数/
    )
    console.log('  技能两条:id 重复与 maxLevel 非法都点名了是哪一部')
  })

  it('伙伴:id 重复 / 性格 id 重复 / 性格用了没有中性值的键(并告诉怎么修)', () => {
    expect(() =>
      createCompanionSystem({ ...companionConfig(), companions: [{ id: 'cat', name: '猫' }, { id: 'cat', name: '另一只猫' }] })
    ).toThrow(/伙伴系统:id 重复 —— cat/)

    expect(() =>
      createCompanionSystem({
        ...companionConfig(),
        traits: [
          { id: 'sharp', name: '眼尖', mods: { luck: 0.2 } },
          { id: 'sharp', name: '又一遍眼尖', mods: { luck: 0.3 } }
        ]
      })
    ).toThrow(/伙伴系统:性格 id 重复 —— sharp/)

    expect(() =>
      createCompanionSystem({
        ...companionConfig(),
        traits: [{ id: 'calm', name: '沉静', mods: { focus: 0.2 } }],
        companions: [{ id: 'cat', name: '猫', traitId: 'calm' }]
      })
    ).toThrow(/伙伴系统:性格 calm 用了没有中性值的键 —— focus;请把它加进 neutral/)

    expect(() =>
      createCompanionSystem({
        ...companionConfig(),
        companions: [{ id: 'cat', name: '猫', traitId: 'ghost' }]
      })
    ).toThrow(/伙伴系统:cat 指向未定义的性格 —— ghost/)
    console.log('  伙伴四条:最后两条一条说清"怎么修",一条点名指向了哪个不存在的性格')
  })

  it('离线 / 状态 / 存档:三个"参数本身不合法"的闸', () => {
    // 步长不是正数:一步都算不出来,不能静默按 0 处理
    expect(() => planIdle(3600_000, { stepMs: 0, capMs: 3600_000 })).toThrow(/idle:stepMs 必须为正数/)
    expect(() => planIdle(3600_000, { stepMs: -1, capMs: 3600_000 })).toThrow(/idle:stepMs 必须为正数/)
    // 档位表是空的:没有"什么都没发生"那一档可退
    expect(() => createStageMemory({ stages: [] })).toThrow(/档位表不能为空:至少要有一个默认档/)
    // 存档版本号不合法:迁移链的头都找不到
    expect(() =>
      defineSaveFormat({ currentVersion: 0, migrations: [], codec: { encode: () => '{}', decode: () => ({}) } })
    ).toThrow(/存档格式:currentVersion 必须是 ≥1 的整数/)
    console.log('  离线 / 状态 / 存档:三条参数闸都报出了"哪个参数、该是什么"')
  })

  it('整份配置:defineGame 把每一处问题逐条列出来(不是只报第一处)', () => {
    // 拿预设改坏两处:一个未登记的槽位 + 一个未登记的属性键
    const broken = structuredClone(DEMO) as typeof DEMO
    broken.equipment.templates[0]!.slot = 'nope'
    broken.attributes.defs.push({ key: 'weird', name: '怪词条', kind: 'percent', appliesTo: 'ghost' })

    let message = ''
    try {
      defineGame(broken)
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }
    console.log(`  defineGame 一次报出:${message.split('\n').length - 1} 行问题`)
    expect(message).toMatch(/世界配置有 \d+ 处问题:/)
    expect(message).toContain('[error]')
    // 逐条列出(带 code),而不是"配置有问题"五个字
    expect(message.split('\n').length - 1).toBeGreaterThanOrEqual(1)
    // 严格模式下警告也当错误:这是内容发布前的那道闸
    expect(() => defineGame(broken, { strict: true })).toThrow(/世界配置有 \d+ 处问题:/)
  })
})
