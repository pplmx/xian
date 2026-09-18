/**
 * 「书桌与日常」内容包 —— 一份**与修仙无关**的题材,用来验通用性。
 *
 * 同一套内核,换一套名字就变成另一种游戏:
 *
 *   境界(炼气→渡劫)  →  学段(小学→高中)
 *   小层(一层→圆满)   →  周次/月考/期末
 *   修为与修为需求     →  理解与作业量
 *   攻防血             →  专注力/耐心/精力
 *   装备(兵器道袍)     →  文具/耳机/书桌/小摆件
 *   副本(区域与首领)   →  场所与阻碍(图书馆的习题、自习室的困倦、期末考试)
 *   功法               →  学科(数学/语文……)与学习方法
 *   炼制               →  做饭(菜谱 + 厨艺)
 *   伙伴性格           →  朋友的性子(学霸/乐天)
 *
 * 全部只是配置。凡是对不上号的词,都是本作自己的叫法,不是引擎的要求 ——
 * 引擎认识的只有:世界分段、层级、词条、槽位、品质、权重、区间、区间里的那几张牌。
 */
import type { GameConfig } from '../config.js'
import type { CompanionConfig } from '../companions.js'
import type { CraftFormula } from '../crafting.js'
import type { SkillConfig } from '../skills.js'
import type { QualityDef, SlotDef } from '../equipment.js'
import { attributeDefs } from '../attributes.js'
import { generateTemplates } from '../equipment.js'

export const DAILY_SLOTS: SlotDef[] = [
  { id: 'weapon', name: '文具', order: 1 },
  { id: 'head', name: '耳机', order: 2 },
  { id: 'body', name: '书桌', order: 3 },
  { id: 'ring', name: '小摆件', order: 4 }
]

export const DAILY_QUALITIES: QualityDef[] = [
  { id: 'stall', name: '地摊货', rank: 0, mult: 1.0, affixes: [0, 1], fromTier: 1, toTier: 8, weight: 300 },
  { id: 'shop', name: '文具店', rank: 1, mult: 1.5, affixes: [1, 2], fromTier: 1, toTier: 10, weight: 100 },
  { id: 'limited', name: '限定款', rank: 2, mult: 2.4, affixes: [2, 3], fromTier: 4, toTier: 12, weight: 12 }
]

/** 学段与周次:与"界域/小层"完全同构,只是叫法不同 */
export const DAILY: GameConfig = {
  name: '书桌与日常(日常/学习内容包)',
  version: '0.1.0',
  attributes: {
    defs: attributeDefs({
      rename: {
        attack: '专注力',
        defense: '耐心',
        maxHp: '精力',
        attackPct: '专注加成',
        defensePct: '耐心加成',
        maxHpPct: '精力加成',
        critRate: '灵感率',
        critDamage: '灵感威力',
        dodgeRate: '走神避开',
        cultivationSpeed: '学习效率',
        breakthroughRate: '升学把握',
        qiRegen: '休息恢复',
        luck: '运气',
        dropRate: '收获率',
        explorationSpeed: '通勤速度',
        expGain: '学习所得'
      }
    })
  },
  realms: {
    // 三段"学段",每段三个年级 —— 与"四界二十一境"是同一个结构
    worlds: [
      { id: 'primary', name: '小学', realms: ['启蒙班', '识字班', '算术班'] },
      { id: 'middle', name: '中学', realms: ['初一', '初二', '初三'] },
      { id: 'high', name: '高中', realms: ['高一', '高二', '高三'] }
    ],
    // 小层改叫周次与考试:引擎只要求"有序的一串名字"
    layerNames: ['第一周', '第二周', '第三周', '月考', '期中', '期末'],
    labelFormat: '{realm}·{layer}',
    exp: { base: 30, realmGrowth: 6, lateFrom: 3, lateRealmGrowth: 3.2, layerGrowth: 1.25, worldStepMult: 1.8 },
    combat: { base: { attack: 10, defense: 6, maxHp: 100 }, realmGrowth: 3.4, lateFrom: 3, lateRealmGrowth: 3.2, layerGrowth: 1.1 },
    breakthrough: { layerBase: 0.95, layerDecay: 0.03, majorBase: 0.75, majorDecay: 0.06, min: 0.2, max: 0.98 },
    // 这一款**不配寿元** —— 学习/日常题材里没有"到点就死"的设计。
    // 库允许省略,`lifespanOf` 返回 Infinity;要写"青春有限"的题材再配上即可。
  },
  equipment: {
    slots: DAILY_SLOTS,
    qualities: DAILY_QUALITIES,
    templates: generateTemplates({
      slots: DAILY_SLOTS,
      baseBySlot: {
        weapon: { attack: 6 },
        head: { defense: 3, maxHp: 10 },
        body: { defense: 4, maxHp: 18 },
        ring: { attack: 2, maxHp: 6 }
      },
      tiers: [
        ['中性笔', '有线耳机', '旧书桌', '橡皮章'],
        ['钢笔', '降噪耳机', '木质书桌', '幸运摆件'],
        ['金尖钢笔', '监听耳机', '升降书桌', '护身符']
      ]
    }),
    affixes: [
      { id: 'focus', name: '聚神', key: 'attackPct', min: 3, max: 8, weight: 100, desc: '专注力提升 {v}%' },
      { id: 'steady', name: '稳手', key: 'defensePct', min: 3, max: 8, weight: 80, desc: '耐心提升 {v}%' },
      { id: 'stamina', name: '续航', key: 'maxHpPct', min: 4, max: 10, weight: 80, desc: '精力提升 {v}%' },
      { id: 'spark', name: '灵光', key: 'critRate', min: 2, max: 5, weight: 45, minRank: 1, desc: '灵感率提升 {v}%' },
      { id: 'routine', name: '规律', key: 'cultivationSpeed', min: 4, max: 9, weight: 90, desc: '学习效率提升 {v}%' }
    ],
    power: { tierGrowth: 2.0, baseFactor: 0.6, qualityExponent: 1.6 },
    affixValueScale: 100
  },
  dungeons: {
    // 区域 = 去的场所;敌人 = 挡在那儿的阻碍;首领 = 这一处的顶点
    regions: [
      { id: 'library', name: '图书馆', tier: 1, minRealm: 0, desc: '安静得能听见翻页声', enemies: ['quiz', 'noise'], boss: 'finalexam' },
      { id: 'cram', name: '自习室', tier: 2, minRealm: 1, desc: '灯亮到很晚', enemies: ['sleepy', 'phone'], boss: 'mockexam', requireCleared: 'library' },
      { id: 'classroom', name: '教室', tier: 3, minRealm: 3, desc: '粉笔灰在光里飘', enemies: ['groupwork', 'deadline'], boss: 'finalthesis', requireCleared: 'cram' }
    ],
    enemies: [
      { id: 'quiz', name: '随堂习题', tier: 1, hpMult: 1, atkMult: 1, defMult: 1, speed: 1, skills: [{ name: '小题连击', mult: 1.3, rate: 0.3, effect: 'multi' }] },
      { id: 'noise', name: '邻座闲聊', tier: 1, hpMult: 0.8, atkMult: 1.1, defMult: 0.7, speed: 1.2, skills: [{ name: '分心', mult: 1.4, rate: 0.25, effect: 'stun' }] },
      { id: 'finalexam', name: '期末考试', tier: 1, hpMult: 3.2, atkMult: 1.3, defMult: 1.2, speed: 1, boss: true, skills: [{ name: '大题压轴', mult: 1.9, rate: 0.3 }] },
      { id: 'sleepy', name: '困倦', tier: 2, hpMult: 1.1, atkMult: 1.15, defMult: 0.9, speed: 0.9, skills: [{ name: '眼皮打架', mult: 1.5, rate: 0.28, effect: 'stun' }] },
      { id: 'phone', name: '手机诱惑', tier: 2, hpMult: 1, atkMult: 1.25, defMult: 0.8, speed: 1.3, mods: { dodgeRate: 0.1 }, skills: [{ name: '一条推送', mult: 1.4, rate: 0.35, effect: 'drain' }] },
      { id: 'mockexam', name: '模拟考', tier: 2, hpMult: 4.0, atkMult: 1.35, defMult: 1.3, speed: 1.05, boss: true, skills: [{ name: '连考三场', mult: 1.7, rate: 0.35, effect: 'multi' }] },
      { id: 'groupwork', name: '小组作业', tier: 3, hpMult: 1.4, atkMult: 1.2, defMult: 1.1, speed: 0.95, skills: [{ name: '分工不清', mult: 1.5, rate: 0.3 }] },
      { id: 'deadline', name: '截止日期', tier: 3, hpMult: 1.2, atkMult: 1.5, defMult: 0.9, speed: 1.35, skills: [{ name: '今夜通宵', mult: 1.8, rate: 0.32, effect: 'pierce' }] },
      { id: 'finalthesis', name: '毕业答辩', tier: 3, hpMult: 5, atkMult: 1.5, defMult: 1.4, speed: 1, boss: true, skills: [{ name: '追问三连', mult: 2.0, rate: 0.35, effect: 'multi' }] }
    ],
    bossProgress: 4,
    bossRhythm: 'once',
    enemyPower: { baseHp: 100, baseAttack: 10, baseDefense: 6, tierGrowth: 2.1 },
    victoryRewards: [
      { id: 'exp', name: '理解', base: 20, tierGrowth: 1.8 },
      { id: 'money', name: '零花钱', base: 5, tierGrowth: 1.6 },
      { id: 'tool', name: '文具', base: 1, chance: 0.25 }
    ]
  }
}

/** 学科(即"技能/功法"那一套):练到满级再择一种学法 */
export const DAILY_SKILLS: SkillConfig = {
  skills: [
    {
      id: 'math',
      name: '数学',
      kind: '主科',
      maxLevel: 6,
      baseMods: { attackPct: 0.04 },
      perLevelMods: { attackPct: 0.02, critRate: 0.005 },
      costs: [
        { key: 'homework', base: 8, growth: 1.4 },
        { key: 'notebook', base: 0, levelStep: 1, discountable: false }
      ],
      branches: [
        { id: 'drill', name: '题海', mods: { attackPct: 0.05 }, desc: '多做题,见效快' },
        { id: 'insight', name: '悟理', mods: { critRate: 0.03 }, desc: '少做题,想得深' }
      ]
    },
    { id: 'language', name: '语文', kind: '主科', maxLevel: 4, baseMods: { maxHpPct: 0.05 }, perLevelMods: { maxHpPct: 0.02 } }
  ]
}

/** 朋友/宠物的性子(即"伙伴性格") */
export const DAILY_COMPANIONS: CompanionConfig = {
  neutral: { exploreDurMult: 1, dangerMult: 1, dropLuck: 0, lossReduction: 0 },
  traits: [
    { id: 'bookish', name: '学霸', mods: { dropLuck: 0.05, exploreDurMult: 1.05 }, desc: '资料多,进度稳' },
    { id: 'sunny', name: '乐天', mods: { lossReduction: 0.04, dangerMult: 0.98 }, desc: '心态好,翻车少' },
    { id: 'clingy', name: '黏人', mods: { exploreDurMult: 1.15, dropLuck: 0.02 }, desc: '总想一起,走得慢' }
  ],
  companions: [
    { id: 'deskmate', name: '同桌', traitId: 'bookish', mods: { attackPct: 0.03 } },
    { id: 'cat', name: '窗台的猫', traitId: 'sunny', mods: { maxHpPct: 0.03 } },
    { id: 'junior', name: '学弟', traitId: 'clingy' }
  ]
}

/**
 * 做饭(即"炼制"):**乘区的名字与个数都由这一款说了算** ——
 * 火候 / 备料 / 调味 三区,再加"硬做难的菜"这一项越级。
 * 与修仙包的"掌握 / 认知 / 技艺"毫无关系,却用的是同一段公式。
 */
export const DAILY_COOKING: CraftFormula = {
  baseRate: 0.95,
  levers: {
    heat: { floor: 0.25, span: 0.75 },
    prep: { floor: 0.4, span: 0.6 },
    seasoning: { floor: 0.3, span: 0.7 }
  },
  overReach: { key: 'dishRank', spec: { table: [1, 0.65, 0.4, 0.2], decay: 0.5 } }
}
