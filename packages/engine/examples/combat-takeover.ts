/* eslint-disable no-console -- 示例程序就是要打印给人看 */
/**
 * 把**另一套战斗口径**整段接进库 —— 三处主权(skillFn / strikeFn / actFn)的用法。
 *
 * 运行:`bun packages/engine/examples/combat-takeover.ts`(或 `bun run examples`)
 *
 * 场景很常见:你已经有一款作品的战斗实现,想把它接到库里(为了统一的存档、事件与回合调度),
 * 但**不想改它的任何一条口径**。库里为此留了三处主权:
 *
 *   skillFn  选哪一招整段交给你(默认是"每个技能各掷一颗再抽一个")
 *   strikeFn 整次出手怎么打交给你(默认公式与顺序都在库里)
 *   actFn    整回合的节奏交给你(何时回血、何时出手)
 *
 * 这份示例先写一份**"老口径"**(下面 `legacyFight`,就是那种自己写的回合循环),
 * 再用三处主权把同一套口径接进库,最后**用同一批种子跑两边**:胜负与回合数必须逐场相同 ——
 * 这就是"接过来"该有的样子。
 *
 * 两条容易踩的坑也写在代码里(它们是真踩过的):
 *   一 **词条为 0 的骰子也要照掷**(老口径每次出手后都掷反击 / 追击 / 震慑);
 *   二 **别把某一部分写重**(库默认加的东西,接管之后就不能再加一次 —— 暴击基数就是一处)。
 */
import { createCombatEngine, createRng, type Combatant, type Rng } from '../src/index.js'

// ——— 1 · 老口径:一份自己写的回合战斗 ———

interface Skill {
  name: string
  mult: number
  rate: number
}

interface Unit {
  name: string
  atk: number
  def: number
  hp: number
  maxHp: number
  speed: number
  crit: number
  /** 开局护盾(最大生命的比例) */
  shieldPct: number
  /** 反击概率 */
  counter: number
  skills: readonly Skill[]
  /** 运行时字段 */
  shield: number
}

function unit(u: Omit<Unit, 'shield'>): Unit {
  return { ...u, shield: u.maxHp * u.shieldPct }
}

/** 老口径的一次出手:先掷浮动、再判暴击;打完之后无条件掷反击 / 追击 / 震慑三颗 */
function legacyStrike(self: Unit, foe: Unit, mult: number, rng: Rng, canFollow = true): void {
  if (rng.chance(0)) return // 闪避(这份口径里恒 0,但骰子照掷)
  let factor = mult
  factor *= 1 + rng.float(-0.1, 0.1) // 先掷浮动
  const crit = rng.chance(0.05 + self.crit) // 再判暴击
  if (crit) factor *= 1.5
  const red = Math.min(0.75, foe.def / (foe.def + self.atk * 1.15))
  factor *= 1 - red
  const dmg = self.atk * Math.max(0.02, factor)
  const absorbed = Math.min(foe.shield, dmg)
  foe.shield -= absorbed
  foe.hp = Math.max(0, foe.hp - (dmg - absorbed))
  // 出手之后:反击 → 追击 → 震慑(**词条为 0 也照掷**,漏一颗后面全乱)
  if (foe.hp > 0 && rng.chance(foe.counter)) legacyStrike(foe, self, 0.5, rng, false)
  if (!canFollow) return
  if (foe.hp > 0 && rng.chance(0)) legacyStrike(self, foe, 0.6, rng, false) // 追击
  if (foe.hp > 0) rng.chance(0) // 震慑
}

/** 老口径的一整场战斗 */
function legacyFight(p: Unit, e: Unit, rng: Rng, maxRounds = 40): { win: boolean; rounds: number } {
  let rounds = 0
  while (rounds < maxRounds && p.hp > 0 && e.hp > 0) {
    rounds += 1
    const order: [Unit, Unit][] = p.speed >= e.speed ? [[p, e], [e, p]] : [[e, p], [p, e]]
    for (const [self, foe] of order) {
      if (self.hp <= 0 || foe.hp <= 0) break
      self.hp = Math.min(self.maxHp, self.hp + self.maxHp * 0.05) // 回合开头回血 5%
      let mult = 1
      for (const s of self.skills) {
        // 按序选技:第一个命中即用(不把后面的技能也掷一遍)
        if (rng.chance(s.rate)) {
          mult = s.mult
          break
        }
      }
      legacyStrike(self, foe, mult, rng)
    }
  }
  return { win: e.hp <= 0 && p.hp > 0, rounds }
}

// ——— 2 · 同一套口径,接进库 ———

/** 把一份 Unit 变成库认识的战斗单位(本值键名由库的 keys 约定,默认就是这一套) */
function toCombatant(u: Unit, id: string): Combatant<number> {
  return {
    id,
    name: u.name,
    stats: { hp: u.hp, maxHp: u.maxHp, attack: u.atk, defense: u.def, speed: u.speed },
    // 注意:这里**不写** regenPerRound —— 老口径的回血发生在"自己回合开头"(见 actFn),
    // 而库的默认回血在回合末:两边都开着就成了回两次血(又一处"写重")
    mods: { critRate: u.crit, shieldOnStart: u.shieldPct, counterRate: u.counter },
    skills: u.skills.map(s => ({ name: s.name, mult: s.mult, rate: s.rate }))
  }
}

/**
 * 接管版:三处主权把老口径整段搬过来。
 *
 * 注意 `critRate` 在这里**不带**库默认的那 0.05 —— 暴击基数由 `strikeFn` 自己加;
 * 两边各加一次就成了 0.30(真踩过:第一手就差一个暴击倍率,后面全乱)。
 */
function takeoverEngine() {
  return createCombatEngine({
    variance: 0,
    maxRounds: 40,
    critMultiplier: 1, // 库的默认值不参与:暴击倍率在 strikeFn 里自己算
    shield: { capRatio: 1 }, // 开局护盾照老口径给,不再二次封顶
    skillFn: (ctx, rng) => {
      for (const s of ctx.skills) if (rng.chance(s.rate)) return s
      return null // 一个都没中:这一回合不出技能(就是普通一击)
    },
    strikeFn: (ctx, rng) => {
      /** 老口径的一次出手(含出手后那三颗与反击的递归) */
      const hit = (rng: Rng, self: Combatant<number>, foe: Combatant<number>, mult: number, canFollow: boolean): void => {
        if (rng.chance(0)) return
        let factor = mult
        factor *= 1 + rng.float(-0.1, 0.1)
        const crit = rng.chance(0.05 + (self.mods.critRate ?? 0))
        if (crit) factor *= 1.5
        const atk = ctx.num(self, 'attack')
        const def = ctx.num(foe, 'defense')
        const red = Math.min(0.75, def / (def + atk * 1.15))
        factor *= 1 - red
        ctx.applyDamage(foe, atk * Math.max(0.02, factor))
        if (ctx.num(foe, 'hp') > 0 && rng.chance(foe.mods.counterRate ?? 0)) hit(rng, foe, self, 0.5, false)
        if (!canFollow) return
        if (ctx.num(foe, 'hp') > 0 && rng.chance(0)) hit(rng, self, foe, 0.6, false)
        if (ctx.num(foe, 'hp') > 0) rng.chance(0)
      }
      // 随机源就是本场那一支(钩子的第二个参数):接力之后随机流不断
      hit(rng, ctx.attacker, ctx.defender, ctx.opts.mult ?? 1, true)
      return true
    },
    actFn: ctx => {
      // 回合开头回血(整回合归你之后,库不会替你做这一下)
      const missing = ctx.num(ctx.self, 'maxHp') - ctx.num(ctx.self, 'hp')
      if (missing > 0) ctx.heal(ctx.self, ctx.num(ctx.self, 'maxHp') * 0.05)
      return false // 选技能与出手仍走库的默认流程(它已经会用上面两处主权)
    }
  })
}

// ——— 3 · 同一批种子跑两边 ———

const PLAYER = unit({
  name: '你',
  atk: 44,
  def: 10,
  hp: 560,
  maxHp: 560,
  speed: 2,
  crit: 0.2,
  shieldPct: 0.2,
  counter: 0,
  skills: []
})
const ENEMY = unit({
  name: '山精',
  atk: 36,
  def: 11,
  hp: 540,
  maxHp: 540,
  speed: 1,
  crit: 0.15,
  shieldPct: 0.15,
  counter: 0.2,
  skills: [{ name: '连击', mult: 1.3, rate: 0.35 }]
})

const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1)
let same = 0
for (const seed of SEEDS) {
  const legacy = legacyFight(unit({ ...PLAYER }), unit({ ...ENEMY }), createRng(seed))
  const battle = takeoverEngine().resolve(toCombatant(PLAYER, 'player'), toCombatant(ENEMY, 'enemy'), createRng(seed))
  if (legacy.win === battle.win && legacy.rounds === battle.rounds) same += 1
}
console.log(`—— 老口径 vs 接管版(${SEEDS.length} 颗种子)——`)
console.log(`  胜负与回合数逐场相同:${same}/${SEEDS.length}(${Math.round((same / SEEDS.length) * 100)}%)`)

// ——— 4 · 一场详细战报(事件文本来自接管层) ———

const one = takeoverEngine().resolve(toCombatant(PLAYER, 'player'), toCombatant(ENEMY, 'enemy'), createRng(7))
console.log(`\n—— 抽一颗种子看过程(种子 7)——`)
for (const event of one.events.slice(0, 6)) console.log(`  第 ${event.round} 回合 ${event.kind}:${event.text}`)
console.log(`  ……共 ${one.rounds} 回合,${one.win ? '你胜' : '你没赢'}`)

console.log(
  `\n库留下的只有回合调度与生命周期(谁先手 / 几回合 / 何时分胜负 / 事件怎么记):` +
    `三处主权接上之后,同一批种子下结果与老口径逐场相同。`
)
