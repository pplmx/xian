/* eslint-disable no-console */
/**
 * 数字基线 —— **曲线不许悄悄变**。
 *
 * 库对使用者的承诺里有这么一条(见 CHANGELOG 的版本口径):
 * *"数值曲线本身不承诺不变,但**默认值与旧行为**在未显式配置时保持逐位一致。"*
 * 这一份就是把这句话做成判据 —— 三份内容包(`xiuxian` / `demo` / `daily`)与一批
 * **吃默认值**的配置,各自把数字压成一个**摘要**,写死在下面。
 *
 * 为什么用摘要而不是把几千个数字全列出来:全列没人 review,摘要**任何一位变了都会变**;
 * 同时也留了几行**可读的门面数值**(第一境第一层要多少、宗师面板多少、保底第几抽出),
 * 让人在 diff 里一眼看出"变的是哪一块"。改数字会把这条用例弄红,那就对了 ——
 * 有意改的时候**显式更新摘要 + 在 CHANGELOG 写清为什么**,顺手就是一次"这是不是破坏性变更"的自问。
 *
 * 覆盖到的默认面(改这些默认值都会红):
 *   · `DEFAULT_LAYER_NAMES` / 缺省 `lifespan`(→∞)、缺省 `labelFormat`
 *   · 递减阶梯默认 `[1, 0.75, 0.5, 0.25]`、战力权重默认 `{ attack: 3, defense: 2, maxHp: 0.15 }`
 *   · 装备的 `outOfBand` / `qualityTierShift` / `levelBonus` / `affixValueScale`、品质窗口
 *   · 副本默认 `bossProgress = 8` 与 `bossRhythm = 'cycle'`、敌人层级缩放
 *   · 战斗默认(浮动 / 暴击 / 地板伤害 / 回合上限)与一次完整对局
 *   · 经济体检的默认阈值 0.7 / 3 / 10(四档判词的分界)
 *   · 离线的默认效率(1)与"不设上限就不截"
 */
import { describe, expect, it } from 'vitest'
import { createAttributeSystem, type AttributeSystemConfig } from './attributes.js'
import { defineGame, type GameConfig } from './config.js'
import { createDungeonSystem } from './dungeons.js'
import { createEconomyReadings } from './economy.js'
import { planIdle } from './idle.js'
import { createRealmSystem } from './realms.js'
import { createRng, seedFromString } from './rng.js'
import { DAILY } from './presets/daily.js'
import { DEMO } from './presets/demo.js'
import { XIUXIAN } from './presets/xiuxian.js'

/**
 * 摘要:同一份数据 → 同一个字符串。用两个不同的盐各哈希一次再拼上长度,
 * 32 位不够看这件事在这里不是问题(要拦的是"悄悄变了",不是"有人来找茬")。
 */
const digest = (rows: unknown): string => {
  const text = JSON.stringify(rows)
  return `${seedFromString(text).toString(16)}-${seedFromString(`基线:${text}`).toString(16)}-${text.length}`
}

/** 把数字揉成"不会因为浮点打印差异而抖"的样子:保留 10 位有效数字 */
const n = (value: unknown): number => Number(Number(value).toPrecision(10))

/** 等级表:名目 / 需求 / 三维 / 成功率 / 寿元 —— 一层一行 */
const realmRows = (config: GameConfig<number>): unknown[][] => {
  const sys = createRealmSystem(config.realms)
  const rows: unknown[][] = []
  for (let major = 0; major <= sys.maxMajor; major += 1) {
    for (let layer = 0; layer <= sys.maxLayerOf(major); layer += 1) {
      const stats = sys.baseStats(major, layer)
      rows.push([
        sys.label(major, layer),
        n(sys.expCost(major, layer)),
        n(stats.attack),
        n(stats.defense),
        n(stats.maxHp),
        n(sys.breakthroughRate(major, layer)),
        sys.lifespanOf(major)
      ])
    }
  }
  return rows
}

/** 属性面:一组固定的来源,记录合并后的词条与最终面板 */
const attributeRows = (config: AttributeSystemConfig) => {
  const attrs = createAttributeSystem(config)
  const sources = [
    { attackPct: 0.12, defensePct: 0.08 },
    { attackPct: 0.09, critRate: 0.05 },
    { attackPct: 0.07, maxHpPct: 0.15 },
    { attackPct: 0.05, damageBonus: 0.1 },
    { attackPct: 0.03, dodgeRate: 0.04 }
  ]
  const merged = attrs.mergeMods(sources)
  const stats = attrs.compute({
    base: { attack: 100, defense: 80, maxHp: 1000 } as Record<string, number>,
    flat: { attack: 20, defense: 10 },
    modSources: sources,
    sourceNames: sources.map((_, i) => `来源${i}`),
    onTop: [{ name: '全局', mult: { attack: 1.1, maxHp: 1.05 } }]
  })
  return {
    // 带上展示名:换名字也是使用者的改动之一(内容包之间的差别就在这里)
    merged: Object.fromEntries(Object.entries(merged).sort().map(([k, v]) => [k, attrs.name(k), n(v)])),
    final: Object.fromEntries(Object.entries(stats.final).sort().map(([k, v]) => [k, n(v)])),
    total: Object.fromEntries(Object.entries(stats.total).sort().map(([k, v]) => [k, n(v)])),
    core: [...attrs.coreKeys],
    softCapped: ['attackPct', 'critRate'].map(key => attrs.isSoftCapped(merged, key)),
    depth: n(attrs.modDepth(merged))
  }
}

/** 装备面:层 1~12 各掷一件(固定种子),记录模板 / 品质 / 词条 */
const equipmentRows = (config: GameConfig<number>) => {
  let uid = 0
  const game = defineGame(config, { newUid: () => `u${(uid += 1)}` })
  const rng = createRng('基线-装备')
  const rows: unknown[] = []
  for (let tier = 1; tier <= 12; tier += 1) {
    const item = game.equipment.generate(rng, { tier })
    rows.push([
      item.templateId,
      item.qualityId,
      item.tier,
      item.affixes.map(a => [a.id, n(a.roll)]),
      n(game.equipment.resolve(item).flats.attack ?? 0),
      n(game.equipment.resolve(item).mods.attackPct ?? 0)
    ])
  }
  return rows
}

/**
 * 副本面:区域表 + 每个敌人的快照数值 + 首领节奏(攒几场见首领)。
 *
 * `config.dungeons!` 这个断言在基线里是安全的:读的三份内容包两层都写着
 * (`GameConfig` 允许 null,那是"这款游戏没有这一层")。
 */
const dungeonRows = (config: GameConfig<number>) => {
  const sys = createDungeonSystem(config.dungeons!)
  const regions = sys.regions.map(r => [r.id, r.tier, r.minRealm, r.boss, r.enemies.length])
  const enemies = sys.enemies.map(e => {
    const snap = sys.snapshot(e.id)
    return [e.id, e.tier, e.boss === true, n(snap.stats.hp), n(snap.stats.attack), n(snap.stats.defense)]
  })
  // 默认节奏(不写 bossProgress / bossRhythm 时):每 8 胜一次首领,循环
  const rhythm = Array.from({ length: 20 }, (_, wins) => sys.winsUntilBoss(wins, false))
  return { regions, enemies, rhythm, chain: sys.chain().map(r => r.id) }
}

/** 战斗面:一次固定对局(默认公式 + 默认浮动),记录胜负 / 回合 / 事件条数 */
const combatRow = (config: GameConfig<number>) => {
  const game = defineGame(config)
  const panel = game.realms.baseStats(0, 0)
  // 拿第一处地界的第一个敌人:名字随内容包变,这里不写死
  const first = game.dungeons.firstRegion()
  const foe = game.dungeons.snapshot(first.enemies[0]!)
  const result = game.combat.resolve(
    {
      id: 'me',
      name: '我',
      stats: {
        attack: panel.attack ?? 0,
        defense: panel.defense ?? 0,
        hp: panel.maxHp ?? 0,
        maxHp: panel.maxHp ?? 0,
        speed: 1
      },
      mods: {}
    },
    {
      id: foe.id,
      name: foe.name,
      stats: {
        attack: foe.stats.attack ?? 0,
        defense: foe.stats.defense ?? 0,
        hp: foe.stats.hp ?? 0,
        maxHp: foe.stats.maxHp ?? 0,
        speed: foe.stats.speed ?? 1
      },
      mods: foe.mods
    },
    createRng('基线-战斗')
  )
  return [result.win, result.rounds, n(result.playerHp), n(result.enemyHp), result.events.length]
}

/** 默认值面:体检阈值分界 / 离线默认效率 / 不设上限就不截 */
const defaultRows = () => {
  const readings = createEconomyReadings()
  const verdicts = [0.6999, 0.7, 0.7001, 3, 3.0001, 10, 10.0001, Number.POSITIVE_INFINITY].map(ratio => [
    n(ratio === Number.POSITIVE_INFINITY ? 999 : ratio),
    readings.verdictOf(ratio)
  ])
  const idle = planIdle(8 * 3600_000, { stepMs: 60_000, capMs: 6 * 3600_000 })
  const uncapped = planIdle(8 * 3600_000, { stepMs: 60_000 })
  return {
    verdicts,
    idle: [idle.cappedMs, idle.effectiveMs, idle.steps, idle.overflowMs, idle.capped],
    uncapped: [uncapped.cappedMs, uncapped.steps, uncapped.capped]
  }
}

/** 一份"全部吃默认值"的等级表:不写 layerNames(用默认十层)、不写 lifespan(→∞) */
const defaultsRealm = realmRows({
  ...DEMO,
  realms: {
    worlds: [{ id: 'plain', name: '一条线', realms: ['初', '中', '高'] }],
    exp: { base: 100, layerGrowth: 2, realmGrowth: 5 },
    combat: { base: { attack: 10, defense: 6, maxHp: 100 }, layerGrowth: 1.5, realmGrowth: 3 },
    breakthrough: { layerBase: 0.9, layerDecay: 0.05, majorBase: 0.6, majorDecay: 0.05, min: 0.1, max: 0.95 }
  }
})

describe('数字基线 —— 曲线不许悄悄变', () => {
  it('内容包 xiuxian / demo / daily:等级表逐格数字冻结', () => {
    const digests = {
      xiuxian: digest(realmRows(XIUXIAN)),
      demo: digest(realmRows(DEMO)),
      daily: digest(realmRows(DAILY))
    }
    const rows = { xiuxian: realmRows(XIUXIAN).length, demo: realmRows(DEMO).length, daily: realmRows(DAILY).length }
    console.log(`  三个内容包的等级表格数:${JSON.stringify(rows)}`)
    console.log(`  门面数值:${XIUXIAN.realms.worlds[0]!.name} 第一层需求 ${createRealmSystem(XIUXIAN.realms).expCost(0, 0)}`)
    // 有意改曲线时:更新下面三行摘要 + 在 CHANGELOG 写清"为什么改、对使用者意味着什么"
    expect(digests).toEqual({
      xiuxian: '9f3b6d43-732077aa-16140',
      demo: '8c219e83-153b38ba-1304',
      daily: '846c5627-8650310e-3152'
    })
  })

  it('全默认等级表:默认十层名目 + 缺省寿元无限', () => {
    console.log(`  默认小层名目:${defaultsRealm[0]![0]} · 末格:${defaultsRealm[defaultsRealm.length - 1]![6]}`)
    expect(digest(defaultsRealm)).toBe('a7789efd-be448cc8-1440')
  })

  it('属性面:递减阶梯与战力权重的默认值', () => {
    console.log(`  合并后:${JSON.stringify(attributeRows(DEMO.attributes))}`)
    expect(digest(attributeRows(DEMO.attributes))).toBe('aeb5b91b-5f8bbdfa-306')
    expect(digest(attributeRows(DAILY.attributes))).toBe('a80577cf-95128480-307')
  })

  it('装备面:层 1~12 的模板 / 品质 / 词条与结算', () => {
    console.log(`  第 1 层:${JSON.stringify(equipmentRows(DEMO)[0])}`)
    expect(digest(equipmentRows(DEMO))).toBe('aec8c54c-d21a2305-770')
    expect(digest(equipmentRows(XIUXIAN))).toBe('b668c394-f8f6f0e5-726')
  })

  it('副本面:区域 / 敌人快照 / 默认首领节奏', () => {
    console.log(`  默认节奏(前 10 胜):${dungeonRows(DEMO).rhythm.slice(0, 10).join(',')}`)
    expect(digest(dungeonRows(DEMO))).toBe('3a16269c-3b59263-565')
    expect(digest(dungeonRows(XIUXIAN))).toBe('261668b-bbff56a0-1105')
  })

  it('战斗面:默认公式下的一场完整对局', () => {
    console.log(`  demo 第一场:[胜, 回合, 我剩血, 敌剩血, 事件数] = ${JSON.stringify(combatRow(DEMO))}`)
    expect(digest(combatRow(DEMO))).toBe('fa7b87a1-821c4c94-26')
    expect(digest(combatRow(XIUXIAN))).toBe('2e5e7ab9-94ee9c40-26')
  })

  it('默认值面:体检四档分界 / 离线默认效率 / 不设上限就不截', () => {
    console.log(`  体检分界:${JSON.stringify(defaultRows().verdicts)}`)
    expect(digest(defaultRows())).toBe('552f6f6a-a823a68f-220')
  })
})
