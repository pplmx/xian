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

export type BattleEventKind = 'hit' | 'crit' | 'dodge' | 'skill' | 'counter' | 'lifesteal' | 'regen' | 'end'

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
  ): void => {
    const kind: BattleEventKind = skill ? 'skill' : 'hit'
    const label = skill ? `【${skill.name}】` : ''
    const missChance = Math.max(0, Math.min(0.95, mod(defender.mods, 'dodgeRate') - mod(attacker.mods, 'accuracy')))
    if (rng.chance(missChance)) {
      events.push({ round, actor: attacker.name, kind: 'dodge', damage: 0, text: `${attacker.name} 出手,${defender.name} 闪开了` })
      return
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
          const skills = attacker.skills ?? []
          const usable = skills.filter(s => rng.chance(s.rate))
          const skill = usable.length > 0 ? rng.pick(usable) : undefined
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
