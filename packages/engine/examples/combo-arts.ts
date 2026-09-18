/* eslint-disable no-console -- 示例程序就是要打印给人看 */
/**
 * 「内容驱动的东西怎么写」—— 三种流派组合技,全用库的钩子表达,库里没有它们的规则。
 *
 * 运行:`bun packages/engine/examples/combo-arts.ts`(或 `bun run examples`)
 *
 * 这三样是真实作品里长出来的机制,库里**故意没有实现**:
 *
 *   玄罡反震 —— 护盾被击破的刹那,立即一记强化反击(每场限两次)
 *   锋连诀   —— 满血会心时,追加一记追击(每场限一次)
 *   枯泽回春 —— 濒死时治疗增幅,但护盾随之消散一半(有得有失)
 *
 * 它们绑内容,所以留在作品侧;但需要的**能力**(知道破盾了 / 知道会心了 / 每回合推进)
 * 是通用的。这个示例就是那份"接口够不够表达真实战斗"的探路:三个都在,
 * 且一行规则都没进库。
 */
import { createCombatEngine, createRng, type BattleHookContext, type Combatant } from '../src/index.js'

const BOSS = {
  id: 'boss',
  name: '守关者',
  stats: { hp: 560, maxHp: 560, attack: 46, defense: 4, speed: 0.5 },
  mods: {}
}

const ME = {
  id: 'me',
  name: '我',
  stats: { hp: 400, maxHp: 400, attack: 34, defense: 8, speed: 2 },
  // 开局自带护盾:玄罡反震要有盾可破才有戏
  mods: { shieldOnStart: 0.2, critRate: 0.55, comboRate: 0 }
}

/** 每场限次的计数器放在本场抽屉里(引擎不解释它们,只保证跨回合还在) */
const once = (ctx: BattleHookContext<number>, key: string, limit: number): boolean => {
  const used = (ctx.state[key] as number | undefined) ?? 0
  if (used >= limit) return false
  ctx.state[key] = used + 1
  return true
}

const engine = createCombatEngine({
  variance: 0.05,
  maxRounds: 12,
  shield: {},
  followups: {},
  skillEffects: {},

  /** 内容驱动的反应:破盾反震 + 会心追击 */
  onEvent: (ctx: BattleHookContext<number>, event) => {
    const me = ctx.player
    const foe = ctx.enemy

    // 玄罡反震:我的盾被击破 → 立刻一记 1.4 倍反击(每场两次)
    if (event.kind === 'shieldbreak' && event.actor === me.name && once(ctx, 'xzCounter', 2)) {
      ctx.log('counter', '护盾砰然炸开,罡气反卷 —— 玄罡反震!', 0, me.name)
      ctx.strike(me, foe, { mult: 1.4, kind: 'counter', label: '玄罡反震', noCounter: true, noFollowups: true })
      return
    }

    // 锋连诀:满血会心 → 追加一记 0.7 倍追击(每场一次)
    const fullHp = ctx.num(me, 'hp') >= ctx.num(me, 'maxHp') - 1e-6
    if (event.kind === 'crit' && event.actor === me.name && fullHp && once(ctx, 'fenglian', 1)) {
      ctx.log('combo', '锋芒未敛,剑势连绵 —— 锋连诀!', 0, me.name)
      ctx.strike(me, foe, { mult: 0.7, kind: 'combo', label: '锋连诀', noCounter: true, noFollowups: true })
    }
  },

  /** 每回合推进的东西:枯泽回春(濒死治疗增幅,但护盾消散一半) */
  tickFn: (ctx: BattleHookContext<number>) => {
    const me = ctx.player
    const hpPct = ctx.num(me, 'hp') / Math.max(1, ctx.num(me, 'maxHp'))
    if (hpPct >= 0.35 || !once(ctx, 'kuze', 1)) return
    const before = ctx.shieldOf(me)
    const { applied } = ctx.heal(me, ctx.num(me, 'maxHp') * 0.18)
    // 有得有失:治疗增幅的代价是护盾消散一半(gainShield 收负数)
    const paid = ctx.gainShield(me, -before / 2)
    ctx.log(
      'regen',
      `灵光流转,枯泽回春:回复 ${Math.round(applied)} 生命${paid < 0 ? `,护盾消散 ${Math.round(-paid)}` : ''}`,
      applied,
      me.name
    )
  }
})

const battle = engine.resolve(ME as unknown as Combatant<number>, BOSS, createRng('组合技'))

console.log('—— 一场打下来,三种组合技各自出没出场 ——\n')
for (const event of battle.events) {
  const mark = event.kind === 'end' ? '■' : '·'
  console.log(`${mark} r${String(event.round).padStart(2)} ${event.text}`)
}

const text = battle.events.map(e => e.text).join('\n')
const fired = [
  ['玄罡反震', text.includes('玄罡反震')],
  ['锋连诀', text.includes('锋连诀')],
  ['枯泽回春', text.includes('枯泽回春')]
] as const
console.log(`\n${fired.map(([name, ok]) => `${ok ? '✓' : '✗'} ${name}`).join('  ')}`)
console.log(`结果:${battle.win ? '胜' : '败'} · ${battle.rounds} 回合 · 收场护盾 ${Math.round(battle.playerShield)}`)
console.log('\n这三个规则一行都没进库:库只给"破盾了 / 会心了 / 每回合结束"三个落点与一套原语。')
