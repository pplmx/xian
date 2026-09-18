/**
 * 「星港纪元」内容包 —— 一份**完全换过皮**的最小世界。
 *
 * 它存在的理由只有一个:证明"换一套名字就能变成另一款游戏"不是口号。
 * 与仙侠包相比,这里名称全变(等级叫舱位等级、装备叫舰载模块、属性叫火力/装甲/结构值、
 * 副本叫星区),而机制、公式、系统**一行没改** —— 因为改的只是这份配置。
 */
import type { GameConfig } from '../config.js'
import { attributeDefs } from '../attributes.js'
import type { QualityDef, SlotDef } from '../equipment.js'
import { generateTemplates } from '../equipment.js'

export const DEMO_SLOTS: SlotDef[] = [
  { id: 'weapon', name: '主武器', icon: 'crosshair', order: 1 },
  { id: 'head', name: '舰桥', icon: 'radar', order: 2 },
  { id: 'body', name: '装甲板', icon: 'shield', order: 3 },
  { id: 'boots', name: '推进器', icon: 'rocket', order: 4 },
  { id: 'necklace', name: '能源核心', icon: 'battery', order: 5 },
  { id: 'ring', name: '辅助模组', icon: 'chip', order: 6 }
]

export const DEMO_QUALITIES: QualityDef[] = [
  { id: 'civil', name: '民用', rank: 0, mult: 1.0, affixes: [0, 1], fromTier: 1, toTier: 6, weight: 4000, color: '#7C8794' },
  { id: 'milspec', name: '军规', rank: 1, mult: 1.4, affixes: [1, 2], fromTier: 1, toTier: 8, weight: 2000, color: '#4E7A8C' },
  { id: 'craft', name: '精工', rank: 2, mult: 2.0, affixes: [2, 3], fromTier: 2, toTier: 10, weight: 600, color: '#3F7A5C' },
  { id: 'experimental', name: '试验型', rank: 3, mult: 3.0, affixes: [3, 4], fromTier: 4, toTier: 12, weight: 90, color: '#8A6BC4' },
  { id: 'prototype', name: '原型机', rank: 4, mult: 4.5, affixes: [4, 5], fromTier: 7, toTier: 12, weight: 8, color: '#C4A24A' }
]

const DEMO_AFFIXES: {
  id: string
  name: string
  key: string
  min: number
  max: number
  desc: string
  weight?: number
  minRank?: number
  slots?: string[]
  decimals?: number
}[] = [
  { id: 'fire1', name: '炽焰弹头', key: 'attackPct', min: 3, max: 7, desc: '火力提升 {v}%' },
  { id: 'armor1', name: '复合夹层', key: 'defensePct', min: 4, max: 8, desc: '装甲提升 {v}%' },
  { id: 'hull1', name: '自愈舱壁', key: 'maxHpPct', min: 4, max: 9, desc: '结构值提升 {v}%' },
  { id: 'crit1', name: '火控联动', key: 'critRate', min: 2, max: 5, weight: 70, slots: ['weapon', 'ring'], desc: '会心提升 {v}%' },
  { id: 'dodge1', name: '机动规避', key: 'dodgeRate', min: 2, max: 5, weight: 60, slots: ['boots', 'head'], desc: '规避提升 {v}%' },
  { id: 'shield1', name: '相位护罩', key: 'shieldOnStart', min: 4, max: 10, weight: 40, minRank: 2, slots: ['necklace', 'body'], desc: '开战护罩提升 {v}%' },
  { id: 'sci1', name: '科研阵列', key: 'cultivationSpeed', min: 5, max: 12, weight: 80, desc: '科研速度提升 {v}%' },
  { id: 'luck1', name: '顺风航道', key: 'luck', min: 3, max: 8, weight: 50, slots: ['necklace', 'ring'], desc: '运气提升 {v}%' }
]

export const DEMO: GameConfig = {
  name: '星港纪元(示例内容包)',
  version: '0.1.0',
  attributes: {
    // 只改名字:机制键一个没动,公式照旧
    defs: attributeDefs({
      rename: {
        attack: '火力',
        defense: '装甲',
        maxHp: '结构值',
        attackPct: '火力增幅',
        defensePct: '装甲增幅',
        maxHpPct: '结构增幅',
        critRate: '会心率',
        critDamage: '会心伤害',
        dodgeRate: '规避率',
        cultivationSpeed: '科研速度',
        qiRegen: '能量恢复',
        breakthroughRate: '突破概率',
        spiritStoneGain: '信用点获取',
        explorationSpeed: '巡航速度'
      }
    })
  },
  realms: {
    // 等级体系换名:舱位等级,一条直线(只有一个"世界"),小层只有 5 级
    worlds: [
      { id: 'fleet', name: '舰队编制', realms: ['见习船员', '正式船员', '战术官', '舰长', '舰队提督'] }
    ],
    layerNames: ['I 阶', 'II 阶', 'III 阶', 'IV 阶', 'V 阶'],
    // 显示模板也换一种写法(不再用「·」)
    labelFormat: '{realm} {layer}',
    exp: { base: 60, realmGrowth: 8, layerGrowth: 1.5 },
    combat: { base: { attack: 10, defense: 6, maxHp: 120 }, realmGrowth: 3.0, layerGrowth: 1.12 },
    breakthrough: { layerBase: 0.9, layerDecay: 0.02, majorBase: 0.7, majorDecay: 0.06, min: 0.2, max: 0.97 },
    lifespan: { base: 200, growth: 2.2, worldStepMult: 3 }
  },
  equipment: {
    slots: [...DEMO_SLOTS],
    qualities: [...DEMO_QUALITIES],
    templates: generateTemplates({
      slots: [...DEMO_SLOTS],
      baseBySlot: {
        weapon: { attack: 24 },
        head: { defense: 6, maxHp: 20 },
        body: { defense: 10, maxHp: 40 },
        boots: { defense: 3, maxHp: 16 },
        necklace: { maxHp: 26 },
        ring: { attack: 5 }
      },
      tiers: [
        ['磁轨炮', '侦察舰桥', '标准装甲板', '化学推进器', '燃料电池', '测距模组'],
        ['等离子炮', '指挥舰桥', '复合装甲板', '离子推进器', '聚变电池', '火控模组'],
        ['反物质炮', '战术舰桥', '纳米装甲板', '曲速推进器', '零点电池', '相位模组']
      ]
    }),
    affixes: DEMO_AFFIXES.map(a => ({
      ...a,
      weight: a.weight ?? 100,
      rarity: (a.weight ?? 100) >= 90 ? 'common' : (a.weight ?? 100) >= 45 ? 'rare' : 'epic'
    })),
    sets: [
      {
        id: 's_fleet',
        name: '舰队制式',
        bonuses: [{ pieces: 2, mods: { damageBonus: 0.06 }, desc: '两件:伤害 +6%' }]
      }
    ],
    power: { tierGrowth: 2.4, baseFactor: 0.6, qualityExponent: 1.6, levelBonus: 0.1 },
    affixValueScale: 100
  },
  dungeons: {
    regions: [
      { id: 'home', name: '母港星域', tier: 1, minRealm: 0, enemies: ['pirate_scout', 'drone'], boss: 'pirate_leader' },
      { id: 'belt', name: '小行星带', tier: 2, minRealm: 1, enemies: ['miner_rig', 'pirate_raider'], boss: 'belt_queen', requireCleared: 'home' },
      { id: 'nebula', name: '暗物质星云', tier: 3, minRealm: 2, enemies: ['void_hunter', 'nebula_swarm'], boss: 'void_leviathan', requireCleared: 'belt' }
    ],
    enemies: [
      { id: 'pirate_scout', name: '海盗侦察艇', tier: 1, hpMult: 0.8, atkMult: 1.0, defMult: 0.7, speed: 1.2, skills: [{ name: '骚扰射击', mult: 1.4, rate: 0.25 }] },
      { id: 'drone', name: '失控无人机', tier: 1, hpMult: 1.0, atkMult: 0.9, defMult: 1.0, speed: 1.0 },
      { id: 'pirate_leader', name: '海盗头目舰', tier: 1, hpMult: 3.0, atkMult: 1.3, defMult: 1.1, speed: 1.0, boss: true, skills: [{ name: '舷侧齐射', mult: 1.8, rate: 0.3 }] },
      { id: 'miner_rig', name: '武装采矿平台', tier: 2, hpMult: 1.4, atkMult: 1.0, defMult: 1.3, speed: 0.8 },
      { id: 'pirate_raider', name: '海盗突击舰', tier: 2, hpMult: 1.0, atkMult: 1.25, defMult: 0.9, speed: 1.25, skills: [{ name: '掠袭撞击', mult: 1.7, rate: 0.28 }] },
      { id: 'belt_queen', name: '′蜂后′母舰', tier: 2, hpMult: 4.2, atkMult: 1.2, defMult: 1.4, speed: 0.95, boss: true, mods: { regenPerRound: 0.02 }, skills: [{ name: '无人机潮', mult: 1.5, rate: 0.4, effect: 'multi' }] },
      { id: 'void_hunter', name: '虚空猎手', tier: 3, hpMult: 1.1, atkMult: 1.35, defMult: 0.8, speed: 1.3, mods: { dodgeRate: 0.12 }, skills: [{ name: '相位突袭', mult: 1.9, rate: 0.3 }] },
      { id: 'nebula_swarm', name: '星云虫群', tier: 3, hpMult: 1.6, atkMult: 1.1, defMult: 1.0, speed: 1.0 },
      { id: 'void_leviathan', name: '虚空利维坦', tier: 3, hpMult: 5.5, atkMult: 1.5, defMult: 1.5, speed: 0.9, boss: true, skills: [{ name: '引力吞噬', mult: 2.2, rate: 0.32, effect: 'drain' }] }
    ],
    bossProgress: 6,
    enemyPower: { baseHp: 140, baseAttack: 11, baseDefense: 6, tierGrowth: 2.3 },
    victoryRewards: [
      { id: 'exp', name: '科研数据', base: 60, tierGrowth: 2.0 },
      { id: 'credit', name: '信用点', base: 20, tierGrowth: 2.2 },
      { id: 'module', name: '模块', base: 1, chance: 0.28 }
    ]
  },
  combat: { maxRounds: 25, critMultiplier: 1.6, variance: 0.1 }
}
