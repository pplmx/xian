/**
 * 仙侠内容包 —— 用云隐修仙录的名目装出一整个世界。
 *
 * 这份预设有两个用处:
 *   一 拿来就能跑:想要一款修仙放置游戏,直接 `defineGame(XIUXIAN)` 就有了骨架;
 *   二 当"换皮怎么做"的范例:凡是名字,都在这一处配置里,机制那边一行没改。
 *
 * 这里**只收名目,不搬数值史**:境界曲线给了与云隐同源的参数,
 * 装备只到 6 层(手写的 288 件不是公共库该背的包袱 —— 那是作品的内容量)。
 */
import type { GameConfig } from '../config'
import { attributeDefs } from '../attributes'
import type { AffixDef, QualityDef, SlotDef, TemplateDef } from '../equipment'
import { generateTemplates } from '../equipment'

/** 四大界域 · 21 大境界(名目与云隐修仙录一致) */
const WORLDS = [
  ['mortal', '人间界', '炼气', '筑基', '金丹', '元婴', '化神', '炼虚', '合体', '大乘', '渡劫'],
  ['immortal', '仙界', '真仙', '玄仙', '金仙', '太乙', '大罗'],
  ['god', '神界', '神人', '神将', '神王', '神帝'],
  ['chaos', '混沌海', '混沌真灵', '混沌神魔', '混沌道祖']
] as const

/** 九个装备槽位 */
export const XIUXIAN_SLOTS: SlotDef[] = [
  { id: 'weapon', name: '兵器', icon: 'sword', order: 1 },
  { id: 'head', name: '头冠', icon: 'crown', order: 2 },
  { id: 'body', name: '道袍', icon: 'shirt', order: 3 },
  { id: 'wrist', name: '护腕', icon: 'watch', order: 4 },
  { id: 'belt', name: '束带', icon: 'link', order: 5 },
  { id: 'boots', name: '履靴', icon: 'footprints', order: 6 },
  { id: 'necklace', name: '颈饰', icon: 'gem', order: 7 },
  { id: 'ring', name: '指环', icon: 'circle-dot', order: 8 },
  { id: 'talisman', name: '符箓', icon: 'scroll', order: 9 }
]

/** 九档品质(凡品 → 神品),倍率与词条区间沿用云隐修仙录 */
export const XIUXIAN_QUALITIES: QualityDef[] = [
  { id: 'mortal', name: '凡品', rank: 0, mult: 1.0, affixes: [0, 1], fromTier: 1, toTier: 12, weight: 5000, color: '#857F70' },
  { id: 'fine', name: '良品', rank: 1, mult: 1.25, affixes: [1, 2], fromTier: 1, toTier: 16, weight: 3000, color: '#6E8B74' },
  { id: 'excellent', name: '精品', rank: 2, mult: 1.6, affixes: [2, 3], fromTier: 2, toTier: 20, weight: 1500, color: '#4F7699' },
  { id: 'spirit', name: '灵品', rank: 3, mult: 2.1, affixes: [2, 4], fromTier: 4, toTier: 24, weight: 400, color: '#7B5EA7' },
  { id: 'profound', name: '玄品', rank: 4, mult: 2.8, affixes: [3, 5], fromTier: 8, toTier: 27, weight: 80, color: '#A85C3F' },
  { id: 'earth', name: '地品', rank: 5, mult: 3.7, affixes: [4, 6], fromTier: 12, toTier: 29, weight: 15, color: '#B07D2B' },
  { id: 'heaven', name: '天品', rank: 6, mult: 5.0, affixes: [4, 7], fromTier: 16, toTier: 32, weight: 2.5, color: '#C9A227' },
  { id: 'immortal', name: '仙品', rank: 7, mult: 6.8, affixes: [5, 8], fromTier: 20, toTier: 32, weight: 0.5, color: '#3E8E8B' },
  { id: 'divine', name: '神品', rank: 8, mult: 9.5, affixes: [6, 9], fromTier: 24, toTier: 32, weight: 0.05, color: '#A83F39' }
]

/** 每层九件,名字从该层的地界长出来(与云隐「一阶一名」同一条规矩) */
const TIER_NAMES: { tier: number; region: string; names: string[]; set?: string }[] = [
  {
    tier: 1,
    region: '青云山麓',
    names: ['青竹剑', '桃木簪', '麻布道袍', '藤纹护腕', '粗布腰带', '芒鞋', '木珠串', '铜戒', '平安符']
  },
  {
    tier: 2,
    region: '落霞谷',
    set: 's_tiebi',
    names: ['玄铁重剑', '落霞巾', '霞纹道袍', '落霞腕缚', '晚照带', '踏霞履', '霞石坠', '落霞环', '晚照符']
  },
  {
    tier: 3,
    region: '黑风林',
    names: ['黑风剑', '黑风巾', '风林道袍', '风藤护腕', '黑风束带', '林行靴', '风铃串', '黑藤戒', '聚风符']
  },
  {
    tier: 4,
    region: '寒潭幽窟',
    set: 's_tiebi',
    names: ['寒锋剑', '玄铁冠', '寒潭甲', '霜纹护腕', '幽潭带', '踏霜靴', '寒玉坠', '潭光戒', '凝霜符']
  },
  {
    tier: 5,
    region: '万妖林',
    names: ['妖骨长刀', '妖羽冠', '妖皮软甲', '妖筋护腕', '兽皮腰带', '兽踪靴', '妖牙串', '兽牙戒', '驱妖符']
  },
  {
    tier: 6,
    region: '古战场遗迹',
    set: 's_tiebi',
    names: ['战痕刀', '铁脊冠', '玄武甲', '残甲护腕', '兵戈带', '踏阵靴', '旧箭坠', '断戟戒', '血战符']
  }
]

/** 词条名目与云隐同源:改的是名字,机制键照旧 */
type AffixSeed = Omit<AffixDef, 'rarity' | 'weight'> & { weight?: number }

const XIUXIAN_AFFIXES: AffixSeed[] = [
  { id: 'atk1', name: '锋锐', key: 'attackPct', min: 2, max: 5, desc: '攻击提升 {v}%' },
  { id: 'atk2', name: '破军', key: 'attackPct', min: 5, max: 10, weight: 60, minRank: 2, desc: '攻击提升 {v}%' },
  { id: 'def1', name: '坚壁', key: 'defensePct', min: 3, max: 6, desc: '防御提升 {v}%' },
  { id: 'def2', name: '磐石', key: 'defensePct', min: 6, max: 12, weight: 60, minRank: 2, desc: '防御提升 {v}%' },
  { id: 'hp1', name: '蕴生', key: 'maxHpPct', min: 3, max: 6, desc: '生命上限提升 {v}%' },
  { id: 'hp2', name: '厚土', key: 'maxHpPct', min: 6, max: 12, weight: 60, minRank: 2, desc: '生命上限提升 {v}%' },
  { id: 'crit1', name: '会心', key: 'critRate', min: 1, max: 3, weight: 90, slots: ['weapon', 'necklace', 'ring', 'talisman'], desc: '暴击率提升 {v}%' },
  { id: 'cdmg1', name: '重击', key: 'critDamage', min: 8, max: 15, weight: 90, decimals: 0, slots: ['weapon', 'necklace', 'ring', 'talisman'], desc: '暴击伤害提升 {v}%' },
  { id: 'dmg1', name: '破妄', key: 'damageBonus', min: 3, max: 6, weight: 90, slots: ['weapon', 'necklace', 'ring', 'talisman'], desc: '造成伤害提升 {v}%' },
  { id: 'red1', name: '云甲', key: 'damageReduction', min: 2, max: 5, weight: 90, slots: ['head', 'body', 'wrist', 'belt', 'boots'], desc: '受到伤害降低 {v}%' },
  { id: 'cult1', name: '静心', key: 'cultivationSpeed', min: 3, max: 6, weight: 100, desc: '修炼速度提升 {v}%' },
  { id: 'qi1', name: '聚灵', key: 'qiRegen', min: 4, max: 8, weight: 90, desc: '灵气恢复提升 {v}%' },
  { id: 'luck1', name: '福缘', key: 'luck', min: 2, max: 5, weight: 80, slots: ['necklace', 'ring', 'talisman'], desc: '气运提升 {v}%' },
  { id: 'exp1', name: '疾行', key: 'explorationSpeed', min: 4, max: 8, weight: 80, slots: ['boots', 'necklace', 'ring', 'talisman'], desc: '历练速度提升 {v}%' },
  { id: 'dodge1', name: '缥缈', key: 'dodgeRate', min: 1, max: 3, weight: 70, slots: ['head', 'body', 'boots'], desc: '闪避提升 {v}%' },
  { id: 'ls1', name: '噬血', key: 'lifesteal', min: 1, max: 3, weight: 40, minRank: 3, slots: ['weapon'], desc: '吸血提升 {v}%' },
  { id: 'ctr1', name: '反震', key: 'counterRate', min: 3, max: 6, weight: 45, minRank: 2, slots: ['body', 'wrist', 'belt'], desc: '反击概率提升 {v}%' },
  { id: 'sh1', name: '罡盾', key: 'shieldOnStart', min: 3, max: 8, weight: 35, minRank: 3, slots: ['talisman', 'body'], desc: '开战护盾提升 {v}%' },
  { id: 'fs1', name: '雷霆', key: 'firstStrike', min: 4, max: 9, weight: 35, minRank: 3, slots: ['weapon', 'boots'], desc: '首回合伤害提升 {v}%' },
  { id: 'regen1', name: '回春', key: 'regenPerRound', min: 1, max: 3, weight: 40, minRank: 2, slots: ['body', 'necklace'], desc: '每回合回复 {v}%' }
]

export const XIUXIAN: GameConfig = {
  name: '仙路(仙侠内容包)',
  version: '0.1.0',
  attributes: {
    defs: attributeDefs({})
  },
  realms: {
    worlds: WORLDS.map(([id, name, ...realms]) => ({ id, name, realms: [...realms] })),
    layerNames: ['一层', '二层', '三层', '四层', '五层', '六层', '七层', '八层', '九层', '圆满'],
    labelFormat: '{realm}·{layer}',
    exp: { base: 40, realmGrowth: 19, lateFrom: 9, lateRealmGrowth: 4.6, layerGrowth: 1.32, worldStepMult: 2 },
    combat: { base: { attack: 12, defense: 7, maxHp: 150 }, realmGrowth: 3.8, lateFrom: 9, lateRealmGrowth: 4.6, layerGrowth: 1.09 },
    breakthrough: { layerBase: 0.95, layerDecay: 0.03, majorBase: 0.78, majorDecay: 0.05, min: 0.15, max: 0.98 },
    lifespan: {
      byWorld: {
        mortal: { base: 150, growth: 3.0 },
        immortal: { base: 100_000_000, growth: 3.2 },
        god: { base: 100_000_000_000, growth: 4.5 },
        chaos: { base: 50_000_000_000_000, growth: 4.5 }
      }
    }
  },
  equipment: {
    slots: [...XIUXIAN_SLOTS],
    qualities: [...XIUXIAN_QUALITIES],
    templates: generateTemplates({
      slots: [...XIUXIAN_SLOTS],
      tiers: TIER_NAMES.map(t => ({ names: t.names, desc: `${t.region}之物` })),
      setsByTier: TIER_NAMES.map(t => t.set)
    }) as TemplateDef[],
    affixes: XIUXIAN_AFFIXES.map(a => ({
      id: a.id,
      name: a.name,
      key: a.key,
      min: a.min,
      max: a.max,
      weight: a.weight ?? 100,
      minRank: a.minRank,
      slots: a.slots,
      decimals: a.decimals ?? 1,
      rarity: (a.weight ?? 100) >= 90 ? 'common' : (a.weight ?? 100) >= 45 ? 'rare' : (a.weight ?? 100) >= 20 ? 'epic' : 'legendary',
      desc: a.desc
    })),
    sets: [
      {
        id: 's_tiebi',
        name: '铁壁',
        desc: '人间界的两套共鸣之一:重甲成组,硬吃伤害',
        bonuses: [
          { pieces: 2, mods: { damageReduction: 0.05, defensePct: 0.05 }, desc: '两件:减伤 +5%、防御 +5%' },
          { pieces: 3, mods: { counterRate: 0.08 }, desc: '三件:反击 +8%' }
        ]
      }
    ],
    power: { tierGrowth: 1.9, baseFactor: 0.5, qualityExponent: 1.8, levelBonus: 0.12 },
    // 词条按百分点书写(「攻击提升 4.2%」),入属性时统一 ÷100
    affixValueScale: 100
  },
  dungeons: {
    regions: [
      { id: 'qingyun', name: '青云山麓', tier: 1, minRealm: 0, desc: '云雾缭绕的山麓,初入仙途者的试炼之地', icon: 'mountain', enemies: ['e_wolf', 'e_boar'], boss: 'e_wolfking', rewards: [{ id: 'herb', name: '灵草', base: 1, tierGrowth: 1.2, chance: 0.3 }] },
      { id: 'luoxia', name: '落霞谷', tier: 2, minRealm: 0, desc: '每逢黄昏,满谷霞光如焚', icon: 'sunset', enemies: ['e_sparrow', 'e_stoneape'], boss: 'e_python', requireCleared: 'qingyun' },
      { id: 'heifeng', name: '黑风林', tier: 3, minRealm: 1, desc: '林中黑风终年不散,吹人骨髓生寒', icon: 'trees', enemies: ['e_bwolf', 'e_vine'], boss: 'e_bwking', requireCleared: 'luoxia' },
      { id: 'hantan', name: '寒潭幽窟', tier: 4, minRealm: 1, desc: '幽潭之下别有洞天,寒气砭骨', icon: 'droplets', enemies: ['e_snake', 'e_bat'], boss: 'e_icejiao', requireCleared: 'heifeng' },
      { id: 'wanyao', name: '万妖林', tier: 5, minRealm: 1, desc: '万妖聚居之地,机缘与凶险并存', icon: 'trees', enemies: ['e_fox', 'e_bear'], boss: 'e_forestlord', requireCleared: 'hantan' },
      { id: 'guzhan', name: '古战场遗迹', tier: 6, minRealm: 2, desc: '上古大战的残迹,怨气凝而不散', icon: 'sword', enemies: ['e_ghost', 'e_bonesoldier'], boss: 'e_oldgeneral', requireCleared: 'wanyao' }
    ],
    enemies: [
      { id: 'e_wolf', name: '赤目野狼', tier: 1, icon: 'paw', hpMult: 0.9, atkMult: 1.0, defMult: 0.8, speed: 1.0, skills: [{ name: '撕咬', mult: 1.4, rate: 0.25 }] },
      { id: 'e_boar', name: '山间野猪', tier: 1, icon: 'paw', hpMult: 1.2, atkMult: 0.9, defMult: 1.0, speed: 0.85, skills: [{ name: '猪突', mult: 1.6, rate: 0.18 }] },
      { id: 'e_wolfking', name: '独角妖狼', tier: 1, icon: 'skull', hpMult: 2.8, atkMult: 1.3, defMult: 0.85, speed: 1.15, boss: true, archetype: 'berserk', skills: [{ name: '裂空爪', mult: 1.8, rate: 0.3 }], tags: ['人间界'] },
      { id: 'e_sparrow', name: '落霞灵雀', tier: 2, icon: 'bird', hpMult: 0.8, atkMult: 1.1, defMult: 0.7, speed: 1.25, skills: [{ name: '霞光啄', mult: 1.5, rate: 0.25 }] },
      { id: 'e_stoneape', name: '谷中石猿', tier: 2, icon: 'paw', hpMult: 1.3, atkMult: 1.0, defMult: 1.2, speed: 0.9, skills: [{ name: '投石', mult: 1.5, rate: 0.2 }] },
      { id: 'e_python', name: '霞光巨蟒', tier: 2, icon: 'skull', hpMult: 4.0, atkMult: 1.1, defMult: 1.5, speed: 1.0, boss: true, archetype: 'counter', mods: { counterRate: 0.25 }, skills: [{ name: '绞缠', mult: 1.2, rate: 0.4, effect: 'multi' }] },
      { id: 'e_bwolf', name: '黑风狼', tier: 3, icon: 'paw', hpMult: 1.0, atkMult: 1.1, defMult: 0.9, speed: 1.15, skills: [{ name: '黑风爪', mult: 1.5, rate: 0.25 }] },
      { id: 'e_vine', name: '噬人藤', tier: 3, icon: 'leaf', hpMult: 1.4, atkMult: 0.9, defMult: 1.2, speed: 0.7, skills: [{ name: '缠绕吸血', mult: 1.3, rate: 0.3, effect: 'drain' }] },
      { id: 'e_bwking', name: '黑风妖王', tier: 3, icon: 'skull', hpMult: 3.2, atkMult: 1.6, defMult: 1.6, speed: 1.05, boss: true, archetype: 'spellbane', mods: { damageReduction: 0.15 }, skills: [{ name: '黑风啸', mult: 1.8, rate: 0.3 }] },
      { id: 'e_snake', name: '寒潭水蛇', tier: 4, icon: 'droplets', hpMult: 1.0, atkMult: 1.1, defMult: 0.9, speed: 1.1, skills: [{ name: '寒毒', mult: 1.4, rate: 0.28, effect: 'bleed' }] },
      { id: 'e_bat', name: '幽窟蝙蝠', tier: 4, icon: 'bird', hpMult: 0.85, atkMult: 1.15, defMult: 0.8, speed: 1.3, skills: [{ name: '音波', mult: 1.4, rate: 0.25, effect: 'stun' }] },
      { id: 'e_icejiao', name: '玄冰蛟', tier: 4, icon: 'skull', hpMult: 3.4, atkMult: 1.5, defMult: 1.3, speed: 1.1, boss: true, archetype: 'truedmg', skills: [{ name: '冰封吐息', mult: 1.6, rate: 0.35, effect: 'pierce' }] },
      { id: 'e_fox', name: '三尾灵狐', tier: 5, icon: 'paw', hpMult: 0.95, atkMult: 1.2, defMult: 0.85, speed: 1.25, mods: { dodgeRate: 0.15 }, skills: [{ name: '魅惑', mult: 1.5, rate: 0.25, effect: 'stun' }] },
      { id: 'e_bear', name: '铁背妖熊', tier: 5, icon: 'paw', hpMult: 1.5, atkMult: 1.05, defMult: 1.3, speed: 0.8, skills: [{ name: '熊霸一击', mult: 1.8, rate: 0.22 }] },
      { id: 'e_forestlord', name: '万妖林主', tier: 5, icon: 'skull', hpMult: 4.6, atkMult: 1.2, defMult: 1.4, speed: 0.95, boss: true, archetype: 'attrition', mods: { regenPerRound: 0.015 }, skills: [{ name: '万妖齐鸣', mult: 2.0, rate: 0.3 }] },
      { id: 'e_ghost', name: '战场怨魂', tier: 6, icon: 'ghost', hpMult: 0.9, atkMult: 1.25, defMult: 0.7, speed: 1.2, skills: [{ name: '怨念侵蚀', mult: 1.5, rate: 0.3, effect: 'pierce' }] },
      { id: 'e_bonesoldier', name: '白骨兵卒', tier: 6, icon: 'bone', hpMult: 1.3, atkMult: 1.05, defMult: 1.25, speed: 0.9, skills: [{ name: '骨刀劈砍', mult: 1.6, rate: 0.24 }] },
      { id: 'e_oldgeneral', name: '上古兵主', tier: 6, icon: 'skull', hpMult: 5.0, atkMult: 1.5, defMult: 1.5, speed: 1.0, boss: true, archetype: 'truedmg', skills: [{ name: '兵戈之威', mult: 2.1, rate: 0.32, effect: 'pierce' }] }
    ],
    bossProgress: 8,
    enemyPower: { baseHp: 150, baseAttack: 12, baseDefense: 7, tierGrowth: 1.9 },
    victoryRewards: [
      { id: 'exp', name: '修为', base: 40, tierGrowth: 1.9 },
      { id: 'stone', name: '灵石', base: 12, tierGrowth: 1.9 },
      { id: 'equipment', name: '装备', base: 1, chance: 0.3 }
    ]
  },
  combat: { maxRounds: 30, critMultiplier: 1.5, variance: 0.08 }
}
