/* eslint-disable no-console -- 示例程序就是要打印给人看 */
/**
 * 快速开始 —— 与 README「快速开始」那一节逐行对应。
 *
 * 运行:`bun packages/engine/examples/quickstart.ts`(或 `bun run examples`)
 *
 * 它装配一个**自己的**小世界(不用任何现成内容包),然后走完:
 * 修炼 → 进阶 → 掉装 → 装配 → 遭遇 → 通关结算。
 *
 * 示例里用相对路径 `../src/index.js` 指向源码,这样在没有 dist 的时候也能跑、
 * 也能被类型检查;你在自己的项目里写的是包名 `wanxiang-engine`(见 README)。
 */
import { attributeDefs, createRng, defineGame, emptyProgress } from '../src/index.js'

const game = defineGame({
  name: '我的游戏',

  // 属性:只改展示名,机制键不动
  attributes: {
    defs: attributeDefs({ rename: { attack: '术法', defense: '护体', maxHp: '气血', critRate: '会心率' } })
  },

  // 等级:世界(界域)与每界境界名;层名与显示模板都可换
  realms: {
    worlds: [
      { id: 'mortal', name: '尘世', realms: ['引气', '凝元', '化形'] },
      { id: 'heaven', name: '天界', realms: ['登天', '斩道'] }
    ],
    layerNames: ['一重', '二重', '三重', '圆满'],
    labelFormat: '{realm}·{layer}',
    exp: { base: 40, realmGrowth: 19, layerGrowth: 1.32, worldStepMult: 2 },
    combat: { base: { attack: 12, defense: 7, maxHp: 150 }, realmGrowth: 3.8, layerGrowth: 1.09 },
    breakthrough: { layerBase: 0.95, layerDecay: 0.03, majorBase: 0.78, majorDecay: 0.05, min: 0.15, max: 0.98 },
    lifespan: { base: 150, growth: 3, worldStepMult: 100 }
  },

  // 装备:槽位 / 品质 / 模板 / 词条 / 套装
  equipment: {
    slots: [
      { id: 'weapon', name: '兵刃' },
      { id: 'body', name: '战袍' }
    ],
    qualities: [{ id: 'common', name: '凡品', rank: 0, mult: 1, affixes: [0, 1], weight: 100 }],
    templates: [
      { id: 'w1', name: '青竹剑', slot: 'weapon', tier: 1, base: { attack: 10 } },
      { id: 'b1', name: '粗布衣', slot: 'body', tier: 1, base: { defense: 4, maxHp: 20 } }
    ],
    affixes: [{ id: 'atk1', name: '锋锐', key: 'attackPct', min: 2, max: 5, weight: 100, desc: '攻击提升 {v}%' }],
    power: { tierGrowth: 1.9, baseFactor: 0.5, qualityExponent: 1.8 },
    affixValueScale: 100
  },

  // 副本:区域链 + 敌人表
  dungeons: {
    regions: [{ id: 'r1', name: '后山', tier: 1, minRealm: 0, enemies: ['e1'], boss: 'b1' }],
    enemies: [
      { id: 'e1', name: '野狼', tier: 1, hpMult: 1, atkMult: 1, defMult: 1, speed: 1 },
      { id: 'b1', name: '狼王', tier: 1, hpMult: 3, atkMult: 1.2, defMult: 1, speed: 1, boss: true }
    ],
    bossProgress: 8,
    victoryRewards: [{ id: 'exp', name: '修为', base: 40, tierGrowth: 1.9 }]
  }
})

console.log(`【${game.name}】`)
console.log('世界:', game.realms.worlds.map(w => w.name).join(' / '))
console.log('境界:', game.realms.realms.map(r => r.name).join(' → '))
console.log('显示名:', ['attack', 'defense', 'maxHp', 'critRate'].map(k => `${k}=${game.attributes.name(k)}`).join('、'))
console.log('----')

const rng = createRng('一局')
let state = { major: 0, layer: 0, exp: 0 }
state = game.realms.addExp(state, Number(game.realms.expCost(state.major, state.layer)))
// 进阶是有概率的:失败就再来一次 —— 游戏里这一步通常还要提示玩家"差在哪"
let step = game.realms.attemptBreakthrough(state, { rng })
let tries = 1
while (!step.ok && tries < 50) {
  step = game.realms.attemptBreakthrough(step.state, { rng, bonusRate: 1 })
  tries += 1
}
console.log(step.ok ? `第 ${tries} 次尝试进阶到 ${step.to}` : `试了 ${tries} 次仍失败(${step.reason})`)
state = step.ok ? step.state : state
console.log('现在:', game.realms.label(state.major, state.layer), '· 寿元', game.realms.lifespanOf(state.major))

const loot = game.equipment.generate(rng, { tier: 1 })
const item = game.equipment.resolve(loot)
console.log(
  '掉落:',
  item.quality.name,
  item.template?.name ?? '(无模板)',
  item.affixLines.length > 0 ? item.affixLines.map(l => l.desc).join('、') : '(这次没有词条)'
)

const progress = emptyProgress()
const encounter = game.dungeons.nextEncounter('r1', progress, rng)
const foe = game.dungeons.snapshot(encounter.enemyId)
const stats = game.attributes.compute({
  base: game.realms.baseStats(state.major, state.layer),
  flat: item.flats,
  modSources: [item.mods]
})
const battle = game.combat.resolve(
  {
    id: 'p',
    name: '我',
    mods: stats.mods,
    stats: {
      hp: stats.final.maxHp!,
      maxHp: stats.final.maxHp!,
      attack: stats.final.attack!,
      defense: stats.final.defense!,
      speed: 1
    }
  },
  { id: foe.id, name: foe.name, stats: foe.stats, mods: foe.mods, skills: foe.skills },
  rng
)
console.log(`遭遇 ${foe.name}:${battle.win ? '胜' : '败'},${battle.rounds} 回合`)
console.log('结算:', battle.events[battle.events.length - 1]!.text)

// 首领那一场给什么,可以直接看结算结果
const outcome = game.dungeons.onVictory('r1', { ...encounter, kind: 'boss' }, progress, rng)
console.log(
  `通关 ${game.dungeons.region('r1')!.name}:`,
  outcome.rewards.map(r => `${r.name ?? r.id}×${r.amount}`).join('、'),
  outcome.firstClear ? '(首次通关)' : ''
)
