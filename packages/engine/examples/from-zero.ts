/* eslint-disable no-console -- 示例程序就是要打印给人看 */
/**
 * 从零装一个世界 —— 「边境邮差」。
 *
 * 运行:`bun packages/engine/examples/from-zero.ts`(或 `bun run examples`)
 *
 * 这一份**不引用任何内容包**(`presets/*` 一个都不 import),全部内容都写在下面这一百来行里 ——
 * 它是给"我要接一套自己的数值系统"的人的**抄写起点**:复制这个文件,把名字与数字换成你的,
 * 就是你的游戏。前面几份示例演示的是"库能做什么",这一份演示"最短要写多少"。
 *
 * 题材:一个送信人,从平原路走到山路。脚力 / 耐力 / 体力 = 攻 / 防 / 血,
 * 靴子·邮包·帽子 = 三个槽位,路途上的阻碍 = 敌人。全部只是配置。
 */
import { attributeDefs } from '../src/index.js'
import { createRng, defineGame, emptyProgress, generateTemplates } from '../src/index.js'
import type { GameConfig, QualityDef, SlotDef } from '../src/index.js'

// ——— 1 · 槽位与品质:引擎只要求"有序、有 id、有权重" ———

const SLOTS: SlotDef[] = [
  { id: 'weapon', name: '靴子', order: 1 },
  { id: 'head', name: '帽子', order: 2 },
  { id: 'body', name: '邮包', order: 3 }
]

const QUALITIES: QualityDef[] = [
  { id: 'cloth', name: '粗布', rank: 0, mult: 1.0, affixes: [0, 1], fromTier: 1, toTier: 8, weight: 300 },
  { id: 'stout', name: '结实', rank: 1, mult: 1.5, affixes: [1, 2], fromTier: 1, toTier: 10, weight: 90 },
  { id: 'custom', name: '定制', rank: 2, mult: 2.3, affixes: [2, 3], fromTier: 4, toTier: 12, weight: 10 }
]

// ——— 2 · 整份内容:attributeDefs 只管改名,机制键一个没动 ———

const CONFIG: GameConfig = {
  name: '边境邮差(从零装配示例)',
  version: '0.1.0',

  attributes: {
    defs: attributeDefs({
      rename: {
        attack: '脚力',
        defense: '耐力',
        maxHp: '体力',
        attackPct: '脚力加成',
        defensePct: '耐力加成',
        maxHpPct: '体力加成',
        critRate: '准点率',
        critDamage: '准点威力',
        dodgeRate: '抄近路',
        cultivationSpeed: '认路速度',
        breakthroughRate: '升任把握',
        luck: '运气'
      }
    })
  },

  realms: {
    // 两段"路",每段两个"职级" —— 与"四界二十一境"完全同构
    worlds: [
      { id: 'plain', name: '平原路', realms: ['送信学徒', '熟路邮差'] },
      { id: 'mount', name: '山路', realms: ['翻山邮差', '急件信使'] }
    ],
    layerNames: ['第一段', '第二段', '第三段'],
    labelFormat: '{realm}·{layer}',
    exp: { base: 25, realmGrowth: 5, lateFrom: 2, lateRealmGrowth: 2.6, layerGrowth: 1.3, worldStepMult: 1.9 },
    combat: { base: { attack: 11, defense: 6, maxHp: 110 }, realmGrowth: 3.2, lateFrom: 2, lateRealmGrowth: 3.0, layerGrowth: 1.12 },
    breakthrough: { layerBase: 0.94, layerDecay: 0.04, majorBase: 0.72, majorDecay: 0.07, min: 0.2, max: 0.98 }
    // 这一款不配寿元 —— 送信人没有"到点就死"的设计(要写就补 lifespan)
  },

  equipment: {
    slots: SLOTS,
    qualities: QUALITIES,
    templates: generateTemplates({
      slots: SLOTS,
      baseBySlot: {
        weapon: { attack: 5 },
        head: { defense: 3, maxHp: 8 },
        body: { defense: 4, maxHp: 16 }
      },
      tiers: [
        ['旧布鞋', '草帽', '帆布邮包'],
        ['加厚布鞋', '油布帽', '双层邮包'],
        ['量脚皮靴', '防风帽', '防水邮包']
      ]
    }),
    affixes: [
      { id: 'swift', name: '疾行', key: 'attackPct', min: 3, max: 8, weight: 100, desc: '脚力提升 {v}%' },
      { id: 'wear', name: '耐磨', key: 'defensePct', min: 3, max: 8, weight: 80, desc: '耐力提升 {v}%' },
      { id: 'thirst', name: '耐渴', key: 'maxHpPct', min: 4, max: 10, weight: 80, desc: '体力提升 {v}%' },
      { id: 'ontime', name: '赶巧', key: 'critRate', min: 2, max: 5, weight: 45, minRank: 1, desc: '准点率提升 {v}%' }
    ],
    power: { tierGrowth: 2.0, baseFactor: 0.6, qualityExponent: 1.6 },
    affixValueScale: 100
  },

  dungeons: {
    regions: [
      { id: 'plainroad', name: '平原官道', tier: 1, minRealm: 0, desc: '尘土与车辙', enemies: ['mud', 'dog'], boss: 'flooded' },
      { id: 'mountain', name: '盘山道', tier: 2, minRealm: 1, desc: '风从垭口灌下来', enemies: ['slip', 'wind'], boss: 'snow', requireCleared: 'plainroad' }
    ],
    enemies: [
      { id: 'mud', name: '烂泥路', tier: 1, hpMult: 1, atkMult: 1, defMult: 1, speed: 1 },
      { id: 'dog', name: '追人的土狗', tier: 1, hpMult: 0.85, atkMult: 1.15, defMult: 0.75, speed: 1.25, skills: [{ name: '扑咬', mult: 1.4, rate: 0.3 }] },
      { id: 'flooded', name: '冲垮的桥', tier: 1, hpMult: 3.0, atkMult: 1.25, defMult: 1.2, speed: 1, boss: true, skills: [{ name: '急流', mult: 1.8, rate: 0.32, effect: 'multi' }] },
      { id: 'slip', name: '碎石坡', tier: 2, hpMult: 1.15, atkMult: 1.1, defMult: 0.95, speed: 0.95 },
      { id: 'wind', name: '垭口横风', tier: 2, hpMult: 1, atkMult: 1.2, defMult: 0.85, speed: 1.3, mods: { dodgeRate: 0.08 }, skills: [{ name: '迷眼', mult: 1.45, rate: 0.3, effect: 'stun' }] },
      { id: 'snow', name: '封山风雪', tier: 2, hpMult: 3.8, atkMult: 1.35, defMult: 1.25, speed: 1.05, boss: true, skills: [{ name: '风雪连程', mult: 1.75, rate: 0.34, effect: 'multi' }] }
    ],
    bossProgress: 3,
    bossRhythm: 'once',
    enemyPower: { baseHp: 110, baseAttack: 11, baseDefense: 6, tierGrowth: 2.05 },
    victoryRewards: [
      { id: 'exp', name: '经验', base: 18, tierGrowth: 1.8 },
      { id: 'money', name: '报酬', base: 6, tierGrowth: 1.6 },
      { id: 'gear', name: '行头', base: 1, chance: 0.3 }
    ]
  }
}

// ——— 3 · 装配并跑一圈:修炼 → 掉装 → 遭遇 → 通关 ———

const game = defineGame(CONFIG)
const rng = createRng('边境邮差')

console.log(`【${game.name}】`)
console.log(`境界:${game.realms.realms.map(r => r.name).join(' → ')}`)
console.log(
  `属性名:${['attack', 'defense', 'maxHp', 'critRate'].map(k => `${k}=${game.attributes.name(k)}`).join('、')}`
)
console.log(`槽位:${game.equipment.slots.map(s => s.name).join('、')} · 品质:${game.equipment.qualities.map(q => q.name).join(' ')}`)

let state = { major: 0, layer: 0, exp: 0 }
for (let step = 0; step < 5; step += 1) {
  state = game.realms.addExp(state, Number(game.realms.expCost(state.major, state.layer)))
  let result = game.realms.attemptBreakthrough(state, { rng, bonusRate: 0.1 })
  for (let i = 0; i < 20 && !result.ok && result.reason === 'failed'; i += 1) {
    result = game.realms.attemptBreakthrough(state, { rng, bonusRate: 0.1 })
  }
  if (!result.ok) {
    console.log(`升任失败(${result.reason}),停在 ${game.realms.label(state.major, state.layer)}`)
    break
  }
  state = result.state
  console.log(`升任 → ${result.to}(把握 ${(result.rate * 100).toFixed(1)}%)`)
}

const inventory = new Map<string, ReturnType<typeof game.equipment.generate>>()
let loadout: { equipped: Record<string, string | undefined> } = { equipped: {} }
for (let i = 0; i < 6; i += 1) {
  const item = game.equipment.generate(rng, { tier: Math.max(1, state.major + 1), luck: 0.2 })
  inventory.set(item.uid, item)
  loadout = game.equipment.equip(loadout, item)
  const resolved = game.equipment.resolve(item)
  console.log(`行头:${resolved.quality.name} ${resolved.template?.name} ${resolved.affixLines.map(l => l.name).join('/') || '(无词条)'}`)
}

const equipped = game.equipment.resolveLoadout(loadout, inventory)
const stats = game.attributes.compute({
  base: game.realms.baseStats(state.major, state.layer),
  flat: equipped.flats,
  modSources: [equipped.mods]
})

const region = game.dungeons.firstRegion()
let progress = emptyProgress()
let cleared = 0
for (let step = 0; step < 8; step += 1) {
  const encounter = game.dungeons.nextEncounter(region.id, progress, rng)
  const foe = game.dungeons.snapshot(encounter.enemyId)
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
  const won = battle.win
  console.log(`遭遇 ${foe.name}:${won ? '通过' : '没过去'}(${battle.rounds} 回合 · 事件 ${battle.events.length} 条)`)
  if (!won) break
  const victory = game.dungeons.onVictory(region.id, encounter, progress, rng)
  progress = victory.progress
  if (victory.firstClear) {
    cleared += 1
    console.log(`  ${region.name} 通关:${victory.rewards.map(r => `${r.name} ×${r.amount}`).join('、')}`)
  }
}

console.log(
  `\n从零到这一步:${CONFIG.name} —— 一共写了 ${CONFIG.realms.worlds.length} 段路 / ` +
    `${game.realms.realms.length} 个职级 / ${CONFIG.equipment.affixes.length} 条词条 / ` +
    `${CONFIG.dungeons.enemies.length} 个阻碍,通关 ${cleared} 处。`
)
console.log('没有引用任何内容包(不 import presets/*):这份文件本身就是"抄写起点"。')
