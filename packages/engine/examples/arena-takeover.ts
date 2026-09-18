/* eslint-disable no-console -- 示例程序就是要打印给人看 */
/**
 * 再把**另一种战斗口径**接进库 —— 「码头拳赛」:体力、连击、贴身反打。
 *
 * 运行:`bun packages/engine/examples/arena-takeover.ts`(或 `bun run examples`)
 *
 * 前一份 `combat-takeover.ts` 接的是"修仙那一套"(护盾 / 概率反击 / 追击);这一份故意换一套
 * **形状完全不同**的口径,用来回答一个问题:那三处主权(skillFn / strikeFn / actFn)到底是
 * "刚好合用",还是真能装下别的规则:
 *
 *   一 没有护盾,改成**体力**:每次出手先扣体力,体力不够这一回合只能**格挡**(减伤一次);
 *   二 没有概率反击,改成**确定性贴身反打**:力量高的一方打中之后,对方必定还一记;
 *   三 没有"追击",改成**连击**:连续命中到 3 的倍数时追加一记(状态记在本场抽屉里);
 *   四 伤害公式是"力量 ×(1 + 连击×0.2)× 浮动 − 护体×0.5",与库默认的
 *      `攻击²/(攻击+防御)` 毫无关系。
 *
 * 结论与上一份一样:**同 200 颗种子,胜负与回合数逐场相同**。库留下的只有回合调度与生命周期
 * (谁先手、几回合、何时分胜负、事件怎么记)。
 */
import { createCombatEngine, createRng, type Combatant, type Rng } from '../src/index.js'

// ——— 1 · 老口径:一份自己写的回合循环 ———

const MAX_ROUNDS = 30
const STAMINA_COST = 20
const STAMINA_REGEN = 8
/** 反打也要有体力垫着:体力见底的人只能挨 */
const COUNTER_COST = 10

interface Boxer {
  id: string
  name: string
  power: number
  tough: number
  hp: number
  maxHp: number
  agility: number
  stamina: number
  maxStamina: number
  /** 连续命中次数(打空则清零) */
  combo: number
  /** 这一回合是否只能格挡(体力不够) */
  guarding: boolean
}

const boxer = (b: Omit<Boxer, 'combo' | 'guarding'>): Boxer => ({ ...b, combo: 0, guarding: false })

/** 老口径的一次出手:浮动 → 重击 → 减伤;落地后结算连击与确定性反打 */
function jab(self: Boxer, foe: Boxer, rng: Rng, follow = true): void {
  const swing = rng.float(0.6, 1.4) // 先掷浮动
  const heavy = rng.chance(0.1 + self.power * 0.002) // 再判重击
  let raw = self.power * (1 + self.combo * 0.2) * swing
  if (heavy) raw *= 1.6
  if (foe.guarding) raw *= 0.7
  const dmg = Math.max(1, raw - foe.tough * 0.5)
  foe.hp = Math.max(0, foe.hp - dmg)
  foe.guarding = false // 格挡只管这一次
  self.combo = dmg > 0 ? self.combo + 1 : 0

  // 贴身反打:**不掷骰** —— 只要挨打方还有体力、且对方力量更高,就必定还一记
  if (foe.hp > 0 && self.power > foe.power && foe.stamina >= COUNTER_COST) {
    foe.stamina -= COUNTER_COST
    const back = Math.max(1, foe.power * (1 + foe.combo * 0.2) * rng.float(0.6, 1.4) - self.tough * 0.5)
    self.hp = Math.max(0, self.hp - back)
  }
  if (!follow) return
  // 连击奖励:每满 3 连追加一记(本身不再触发连击奖励)
  if (self.combo > 0 && self.combo % 3 === 0 && foe.hp > 0) jab(self, foe, rng, false)
}

function legacyBout(p: Boxer, e: Boxer, rng: Rng): { win: boolean; rounds: number } {
  let rounds = 0
  while (rounds < MAX_ROUNDS && p.hp > 0 && e.hp > 0) {
    rounds += 1
    // 回合开始:双方回体力
    for (const b of [p, e]) b.stamina = Math.min(b.maxStamina, b.stamina + STAMINA_REGEN)
    const order: [Boxer, Boxer][] = p.agility >= e.agility ? [[p, e], [e, p]] : [[e, p], [p, e]]
    for (const [self, foe] of order) {
      if (self.hp <= 0 || foe.hp <= 0) break
      if (self.stamina < STAMINA_COST) { self.guarding = true; continue } // 体力不够:格挡
      self.stamina -= STAMINA_COST
      jab(self, foe, rng)
    }
  }
  return { win: e.hp <= 0 && p.hp > 0, rounds }
}

// ——— 2 · 同一套口径,接进库 ———

/** 本场运行时状态:老口径把 combo / stamina / guarding 放在单位上,接管版放进库的抽屉 */
interface Runtime {
  stamina: number
  combo: number
  guarding: boolean
}

function toCombatant(b: Boxer): Combatant<number> {
  return {
    id: b.id,
    name: b.name,
    stats: { hp: b.hp, maxHp: b.maxHp, attack: b.power, defense: b.tough, speed: b.agility },
    // 体力相关的东西借 mods 与抽屉捎过去(库不解释这些键,内容自己读):
    // 起始值 / 上限走 mods,当前值 / 连击 / 格挡走本场抽屉
    mods: { stamina: b.stamina, maxStamina: b.maxStamina },
    skills: []
  }
}

function takeoverEngine() {
  return createCombatEngine({
    maxRounds: MAX_ROUNDS,
    variance: 0, // 浮动由我们自己掷
    /**
     * 出手:整段换成老口径那一套(浮动 → 重击 → 减伤 → 连击 → 确定性反打)。
     *
     * 注意这里**不碰**库的暴击:库默认的暴击倍率与浮动都被这套口径无视(variance 0、
     * 且完全不走 `ctx.damage`)—— 接管的就是"这一下怎么算"。
     */
    strikeFn: (ctx, rng) => {
      const runtimeOf = (unit: Combatant<number>): Runtime => {
        const table = (ctx.state.arena ??= {}) as Record<string, Runtime>
        table[unit.id] ??= { stamina: Number(unit.mods.stamina ?? 0), combo: 0, guarding: false }
        return table[unit.id]!
      }
      const hit = (self: Combatant<number>, foe: Combatant<number>, follow: boolean): void => {
        const me = runtimeOf(self)
        const rival = runtimeOf(foe)
        const swing = rng.float(0.6, 1.4)
        const heavy = rng.chance(0.1 + ctx.num(self, 'attack') * 0.002)
        let raw = ctx.num(self, 'attack') * (1 + me.combo * 0.2) * swing
        if (heavy) raw *= 1.6
        if (rival.guarding) raw *= 0.7
        const dmg = Math.max(1, raw - ctx.num(foe, 'defense') * 0.5)
        ctx.applyDamage(foe, dmg)
        rival.guarding = false
        me.combo = dmg > 0 ? me.combo + 1 : 0

        // 贴身反打:不掷骰 —— 只要挨打方还有体力、且对方力量更高,就必定还一记
        if (ctx.num(foe, 'hp') > 0 && ctx.num(self, 'attack') > ctx.num(foe, 'attack') && rival.stamina >= COUNTER_COST) {
          rival.stamina -= COUNTER_COST
          const back = Math.max(
            1,
            ctx.num(foe, 'attack') * (1 + rival.combo * 0.2) * rng.float(0.6, 1.4) - ctx.num(self, 'defense') * 0.5
          )
          ctx.applyDamage(self, back)
        }
        if (!follow) return
        if (me.combo > 0 && me.combo % 3 === 0 && ctx.num(foe, 'hp') > 0) hit(self, foe, false)
      }
      hit(ctx.attacker, ctx.defender, true)
      return true
    },
    /** 整回合:回体力 → 够就打(走上面那次出手)、不够就格挡 */
    actFn: ctx => {
      const table = (ctx.state.arena ??= {}) as Record<string, Runtime>
      table[ctx.self.id] ??= { stamina: Number(ctx.self.mods.stamina ?? 0), combo: 0, guarding: false }
      const me = table[ctx.self.id]!
      const maxStamina = Number(ctx.self.mods.maxStamina ?? 0)
      // 回合开始回体力(整回合归你之后,库不会替你做这一下)
      me.stamina = Math.min(maxStamina, me.stamina + STAMINA_REGEN)
      if (me.stamina < STAMINA_COST) {
        me.guarding = true // 体力不够:格挡,这一回合不出手
        ctx.log('skip', `${ctx.self.name} 收手格挡`)
        return true // 整回合我处理完了
      }
      me.stamina -= STAMINA_COST
      // 交给上面那次出手 —— 它才是"这一下怎么算"(strikeFn 是同一份实现)
      ctx.strike(ctx.self, ctx.foe, { mult: 1 })
      return true
    }
  })
}

// ——— 3 · 同一批种子跑两边 ———

const PLAYER = boxer({
  id: 'you',
  name: '你',
  power: 44,
  tough: 30,
  hp: 340,
  maxHp: 340,
  agility: 12,
  stamina: 60,
  maxStamina: 60
})
const RIVAL = boxer({
  id: 'rival',
  name: '码头老手',
  power: 46,
  tough: 24,
  hp: 360,
  maxHp: 360,
  agility: 11,
  stamina: 60,
  maxStamina: 60
})

const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1)
let same = 0
let legacyWins = 0
const roundHistogram = new Map<number, number>()
for (const seed of SEEDS) {
  const legacy = legacyBout(boxer({ ...PLAYER }), boxer({ ...RIVAL }), createRng(seed))
  const battle = takeoverEngine().resolve(toCombatant(PLAYER), toCombatant(RIVAL), createRng(seed))
  if (legacy.win === battle.win && legacy.rounds === battle.rounds) same += 1
  if (legacy.win) legacyWins += 1
  roundHistogram.set(legacy.rounds, (roundHistogram.get(legacy.rounds) ?? 0) + 1)
}
console.log(`—— 老口径 vs 接管版(${SEEDS.length} 颗种子 · 完全不同的那套拳赛规则)——`)
console.log(`  胜负与回合数逐场相同:${same}/${SEEDS.length}(${Math.round((same / SEEDS.length) * 100)}%)`)
console.log(`  其中老口径胜 ${legacyWins} 场(样本本身有胜负,不是一边倒)`)
console.log(
  `  回合数分布:${[...roundHistogram.entries()].sort((a, b) => a[0] - b[0]).map(([rounds, count]) => `${rounds} 回合 ×${count}`).join(' · ')}`
)

// ——— 4 · 一场详细战报 ———

const one = takeoverEngine().resolve(toCombatant(PLAYER), toCombatant(RIVAL), createRng(11))
console.log(`\n—— 抽一颗种子看过程(种子 11)——`)
for (const event of one.events.slice(0, 6)) console.log(`  第 ${event.round} 回合 ${event.kind}:${event.text}`)
console.log(`  ……共 ${one.rounds} 回合,${one.win ? '你赢' : '你没赢'}`)
