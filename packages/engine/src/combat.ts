/**
 * 战斗解算 —— 副本系统的下半场:一场遭遇要能分出胜负,掉落与通关才有意义。
 *
 * 这是一套**够用的回合制骨架**,不是唯一的战斗规则:
 * 先手看速度、命中闪避按概率、暴击按暴击率与暴击伤害、吸血/减伤/回复各自生效、
 * 敌人技能按触发率插入。数值全部来自属性系统,故换皮(改属性名)不需要改这里。
 *
 * 设计上刻意"一次算完再回放":结算先跑完,日志只是记录。
 * 这样离线收益、批量模拟与界面播放共用同一份结果,不会出现两次算不一样的情况。
 */
import type { Mods } from './attributes.js'
import type { Numeric } from './numeric.js'
import { numberNumeric } from './numeric.js'
import type { Rng } from './rng.js'
import type { EnemySkillDef } from './dungeons.js'

/**
 * 战斗读哪几个键 —— **键名由作品定**。
 *
 * 默认是 `attack / defense / hp / maxHp / speed`,这是引擎的接口词;
 * 而一款游戏的"攻防血"叫火力/装甲/结构值,还是专注力/耐心/精力,都无所谓 ——
 * 把它们指过来即可,战斗逻辑一行不用改。
 */
export interface CombatKeys {
  /** 攻击键;默认 'attack' */
  attack?: string
  /** 防御键;默认 'defense' */
  defense?: string
  /** 当前生命键;默认 'hp' */
  hp?: string
  /** 生命上限键;默认 'maxHp' */
  maxHp?: string
  /** 先手键;默认 'speed' */
  speed?: string
}

export interface Combatant<T> {
  id: string
  name: string
  /** 本值表:键名由作品定,靠 `BattleConfig.keys` 告诉引擎哪个是攻/防/血/先手 */
  stats: Record<string, T>
  /** 词条(百分比/独立加成)—— 键名沿用引擎约定(见属性系统) */
  mods: Mods
  skills?: EnemySkillDef[]
}

export interface BattleConfig {
  /** 本值键名(默认 attack / defense / hp / maxHp / speed) */
  keys?: CombatKeys
  /**
   * 自己解释技能的 `effect`(**可选**)。
   *
   * 库**不认识** stun / drain / pierce / multi / bleed 这些标签 —— 它只把标签原样交过来,
   * 由你决定"定身"在这款游戏里到底意味着什么(也许你的题材里是"分心""伤口""没电了")。
   *
   *   返回 `true`  —— 这次出手你已经处理完(引擎不再按默认公式打这一下);
   *   返回别的(含什么都不返回)—— 引擎按默认出手(与不配这个钩子时逐位一致)。
   *
   * 给了它,**这一次出手的规则完全归你**:引擎不会在你之外再叠加任何东西。
   * 想基于默认改动(多打几下、伤害减半)就用 `ctx.strike(mult)`;
   * 想完全另算(穿甲/真伤)就用 `ctx.damage(mult)` + `ctx.applyDamage(target, 数额)`。
   */
  skillEffectFn?: <T>(ctx: SkillEffectContext<T>, rng: Rng) => boolean | void
  /**
   * 自己接管伤害公式(**可选**)。
   *
   * 默认是 `攻击² /(攻击+防御)` 再乘上浮动、增伤、减伤,并有"每击至少 × minDamageRatio"的地板。
   * 不同题材要的形状差别很大:减法型(攻−防)、除算型(攻/防)、查表型、带破甲与穿甲的混合型……
   * 给这个函数就完全接管 —— **地板与全部修正都归你**(引擎不再叠加任何东西),
   * 拿到的是已经判过闪避与暴击之后的一次出手(暴击倍率已并入 `mult`)。
   */
  damageFn?: <T>(ctx: DamageContext<T>, rng: Rng) => number
  /** 回合上限,默认 30(打不完算守方胜) */
  maxRounds?: number
  /** 暴击基础倍率,默认 1.5 */
  critMultiplier?: number
  /** 伤害浮动,默认 ±8% */
  variance?: number
  /** 每击最低伤害占攻击的比例,默认 5% */
  minDamageRatio?: number
  /** 每回合结束回复比例(双方各有 mods.regenPerRound 时按各自算) */
  regenBase?: number
}

export interface DamageContext<T> {
  attacker: Combatant<T>
  defender: Combatant<T>
  /** 攻击方本值(已按 keys 取好) */
  attack: number
  /** 防守方本值(已按 keys 取好) */
  defense: number
  /** 本次倍率:技能倍率 × 暴击倍率(普通出手时即暴击倍率) */
  mult: number
  /** 默认公式会用到的浮动幅度、增伤与减伤(自定义时可按需复用) */
  variance: number
  damageBonus: number
  damageReduction: number
}

/**
 * 技能效果的解释上下文 —— 引擎把自己内部用的那些原语摊开给你,而不是让你另起一套。
 *
 * 每个原语都对应引擎自己走的那条路,所以"你写的"与"引擎给的"不会两套口径:
 * `strike` 就是默认那一次出手(命中/暴击/吸血/日志全同源),`damage` 就是默认伤害公式的结果。
 */
export interface SkillEffectContext<T> {
  round: number
  /** 出手方(引擎内部的副本,直接改它不会污染调用方传进来的对象) */
  attacker: Combatant<T>
  /** 挨打方(同上) */
  defender: Combatant<T>
  /** 触发的那条技能定义(读 `skill.effect` 认标签、读 `skill.desc` 也行) */
  skill: EnemySkillDef
  /** 技能自带倍率(默认出手用的就是它) */
  mult: number
  /** 已按 `keys` 解析好的本值键名 */
  keys: Required<CombatKeys>
  /** 取本值(原样 T) */
  statOf: (c: Combatant<T>, key: string) => T
  /** 改本值:如"定身"把先手压到 0、"抽蓝"扣一项资源 */
  setStat: (c: Combatant<T>, key: string, value: T) => void
  /** 取本值(转成 number,便于比较与算数) */
  num: (c: Combatant<T>, key: string) => number
  /** 按默认规则打这一下(可换倍率);返回实际造成的伤害 */
  strike: (mult?: number) => number
  /** 只算伤害不落账(默认公式或 `damageFn` 的结果),给"穿甲/真伤"这类自己扣血的写法用 */
  damage: (mult?: number) => number
  /** 落账:扣目标当前生命并记一条日志;返回实际扣掉的值 */
  applyDamage: (target: Combatant<T>, amount: number) => number
  /** 让目标的下一次出手被跳过(定身/眩晕);重复调用不叠加 */
  skipNextTurn: (target: Combatant<T>) => void
  /** 记一条自己的日志(展示文本归你) */
  log: (kind: BattleEventKind, text: string, damage?: number, actor?: string) => void
  /** 本场共用的小抽屉:跨回合记状态(层数/冷却)用,引擎不解释它 */
  state: Record<string, unknown>
}

export type BattleEventKind =
  | 'hit'
  | 'crit'
  | 'dodge'
  | 'skill'
  | 'counter'
  | 'lifesteal'
  | 'regen'
  | 'skip'
  | 'end'

export interface BattleEvent {
  round: number
  /** 出手方名字 */
  actor: string
  kind: BattleEventKind
  damage: number
  text: string
}

export interface BattleResult<T> {
  win: boolean
  rounds: number
  playerHp: T
  enemyHp: T
  events: BattleEvent[]
}

function mod(mods: Mods, key: string): number {
  const v = mods[key]
  return typeof v === 'number' ? v : 0
}

export function createCombatEngine<T = number>(config: BattleConfig = {}, numeric: Numeric<T> = numberNumeric as unknown as Numeric<T>) {
  const maxRounds = config.maxRounds ?? 30
  const critMultiplier = config.critMultiplier ?? 1.5
  const variance = config.variance ?? 0.08
  const minDamageRatio = config.minDamageRatio ?? 0.05
  const regenBase = config.regenBase ?? 0
  const keys = {
    attack: config.keys?.attack ?? 'attack',
    defense: config.keys?.defense ?? 'defense',
    hp: config.keys?.hp ?? 'hp',
    maxHp: config.keys?.maxHp ?? 'maxHp',
    speed: config.keys?.speed ?? 'speed'
  }
  const stat = (c: Combatant<T>, key: string): T => c.stats[key] ?? numeric.zero
  const statNum = (c: Combatant<T>, key: string): number => numeric.toNumber(stat(c, key))
  const setStat = (c: Combatant<T>, key: string, value: T): void => {
    c.stats[key] = value
  }

  const rawDamage = (attacker: Combatant<T>, defender: Combatant<T>, mult: number, rng: Rng): number => {
    const atk = statNum(attacker, keys.attack)
    const def = statNum(defender, keys.defense)
    const damageBonus = mod(attacker.mods, 'damageBonus')
    const damageReduction = Math.min(0.9, Math.max(0, mod(defender.mods, 'damageReduction')))
    if (config.damageFn) {
      // 自己接管:地板与全部修正都归调用方,引擎不再叠加
      return config.damageFn({ attacker, defender, attack: atk, defense: def, mult, variance, damageBonus, damageReduction }, rng)
    }
    const base = atk <= 0 ? 0 : (atk * atk) / (atk + def)
    const jitter = 1 + rng.float(-variance, variance)
    const dmg = base * mult * jitter * (1 + damageBonus) * (1 - damageReduction)
    return Math.max(atk * minDamageRatio, dmg)
  }

  const strike = (
    attacker: Combatant<T>,
    defender: Combatant<T>,
    round: number,
    rng: Rng,
    events: BattleEvent[],
    skill?: EnemySkillDef
  ): number => {
    const kind: BattleEventKind = skill ? 'skill' : 'hit'
    const label = skill ? `【${skill.name}】` : ''
    const missChance = Math.max(0, Math.min(0.95, mod(defender.mods, 'dodgeRate') - mod(attacker.mods, 'accuracy')))
    if (rng.chance(missChance)) {
      events.push({ round, actor: attacker.name, kind: 'dodge', damage: 0, text: `${attacker.name} 出手,${defender.name} 闪开了` })
      return 0
    }
    const critRate = Math.max(0, Math.min(1, mod(attacker.mods, 'critRate')))
    const isCrit = !skill && rng.chance(critRate)
    const critMult = isCrit ? critMultiplier + mod(attacker.mods, 'critDamage') : 1
    const damage = rawDamage(attacker, defender, (skill?.mult ?? 1) * critMult, rng)
    const dealt = Math.min(damage, statNum(defender, keys.hp))
    setStat(defender, keys.hp, numeric.max(numeric.zero, numeric.sub(stat(defender, keys.hp), numeric.from(damage))))
    events.push({
      round,
      actor: attacker.name,
      kind: isCrit ? 'crit' : kind,
      damage: dealt,
      text: `${attacker.name} ${label}${isCrit ? '重击' : '命中'} ${defender.name},造成 ${Math.round(dealt)} 伤害`
    })
    const lifesteal = Math.max(0, mod(attacker.mods, 'lifesteal'))
    if (lifesteal > 0 && dealt > 0) {
      const heal = Math.min(dealt * lifesteal, statNum(attacker, keys.maxHp) - statNum(attacker, keys.hp))
      if (heal > 0) {
        setStat(attacker, keys.hp, numeric.add(stat(attacker, keys.hp), numeric.from(heal)))
        events.push({ round, actor: attacker.name, kind: 'lifesteal', damage: 0, text: `${attacker.name} 汲取 ${Math.round(heal)} 生命` })
      }
    }
    return dealt
  }

  const alive = (c: Combatant<T>): boolean => numeric.cmp(stat(c, keys.hp), numeric.zero) > 0

  /** 拷一份再打:调用方的对象不被就地改;本值表也要拷,否则两边共用同一张表 */
  const build = (a: Combatant<T>, b: Combatant<T>): [Combatant<T>, Combatant<T>] => [
    { ...a, stats: { ...a.stats } },
    { ...b, stats: { ...b.stats } }
  ]

  return {
    /** 解算整场战斗(不改动传进来的对象;结果里的 hp 在返回值与日志里) */
    resolve(player: Combatant<T>, enemy: Combatant<T>, rng: Rng): BattleResult<T> {
      const [p, e] = build(player, enemy)
      const events: BattleEvent[] = []
      /** 被"跳过下一次出手"的目标(技能效果解释器自己往里加) */
      const skipping = new Set<Combatant<T>>()
      /** 本场共用的小抽屉:钩子跨回合记状态用,引擎不解释 */
      const state: Record<string, unknown> = {}

      const applyDamage = (target: Combatant<T>, amount: number): number => {
        const dealt = Math.min(amount, statNum(target, keys.hp))
        if (!(dealt > 0)) return 0
        setStat(target, keys.hp, numeric.max(numeric.zero, numeric.sub(stat(target, keys.hp), numeric.from(amount))))
        return dealt
      }

      /** 技能效果解释器:把引擎内部的出手/伤害/落账原语摊开给调用方,而不是让他另起一套 */
      const runEffect = (attacker: Combatant<T>, defender: Combatant<T>, round: number, skill: EnemySkillDef): boolean => {
        const fn = config.skillEffectFn
        if (!fn) return false
        const emit = (kind: BattleEventKind, text: string, damage = 0, actor?: string): void => {
          events.push({ round, actor: actor ?? attacker.name, kind, damage, text })
        }
        const handled = fn(
          {
            round,
            attacker,
            defender,
            skill,
            mult: skill.mult,
            keys,
            statOf: stat,
            setStat,
            num: statNum,
            strike: (mult?: number): number => strike(attacker, defender, round, rng, events, { ...skill, mult: mult ?? skill.mult }),
            damage: (mult?: number): number => rawDamage(attacker, defender, mult ?? skill.mult, rng),
            applyDamage: (target: Combatant<T>, amount: number): number => {
              const dealt = applyDamage(target, amount)
              if (dealt > 0) emit('skill', `${attacker.name} 【${skill.name}】命中 ${target.name},造成 ${Math.round(dealt)} 伤害`, dealt)
              return dealt
            },
            skipNextTurn: (target: Combatant<T>): void => {
              skipping.add(target)
            },
            log: emit,
            state
          },
          rng
        )
        return handled === true
      }

      const pSpeed = statNum(p, keys.speed) * (1 + mod(p.mods, 'speed'))
      const eSpeed = statNum(e, keys.speed) * (1 + mod(e.mods, 'speed'))
      const playerFirst = pSpeed >= eSpeed
      let round = 0
      while (round < maxRounds && alive(p) && alive(e)) {
        round += 1
        const order: [Combatant<T>, Combatant<T>][] = playerFirst
          ? [
              [p, e],
              [e, p]
            ]
          : [
              [e, p],
              [p, e]
            ]
        for (const [attacker, defender] of order) {
          if (!alive(p) || !alive(e)) break
          if (skipping.delete(attacker)) {
            events.push({ round, actor: attacker.name, kind: 'skip', damage: 0, text: `${attacker.name} 这一回合没有出手` })
            continue
          }
          const skills = attacker.skills ?? []
          const usable = skills.filter(s => rng.chance(s.rate))
          const skill = usable.length > 0 ? rng.pick(usable) : undefined
          // 有技能且调用方给了效果解释器:由他决定这一次出手怎么算;他说"没处理"才走默认
          if (skill && runEffect(attacker, defender, round, skill)) continue
          strike(attacker, defender, round, rng, events, skill)
        }
        for (const c of [p, e]) {
          if (!alive(c)) continue
          const regen = regenBase + mod(c.mods, 'regenPerRound')
          if (regen <= 0) continue
          const missing = statNum(c, keys.maxHp) - statNum(c, keys.hp)
          const heal = Math.min(missing, statNum(c, keys.maxHp) * regen)
          if (heal > 0) {
            setStat(c, keys.hp, numeric.add(stat(c, keys.hp), numeric.from(heal)))
            events.push({ round, actor: c.name, kind: 'regen', damage: 0, text: `${c.name} 回复 ${Math.round(heal)} 生命` })
          }
        }
      }
      const win = alive(p) && !alive(e)
      events.push({
        round,
        actor: win ? p.name : e.name,
        kind: 'end',
        damage: 0,
        text: win ? `${p.name} 胜` : alive(e) ? `${e.name} 胜` : '两败俱伤'
      })
      return { win, rounds: round, playerHp: stat(p, keys.hp), enemyHp: stat(e, keys.hp), events }
    }
  }
}

export type CombatEngine<T = number> = ReturnType<typeof createCombatEngine<T>>
