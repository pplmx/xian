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
import type { Mods } from './attributes'
import type { Numeric } from './numeric'
import { numberNumeric } from './numeric'
import type { Rng } from './rng'
import type { EnemySkillDef } from './dungeons'

export interface Combatant<T> {
  id: string
  name: string
  hp: T
  maxHp: T
  attack: T
  defense: T
  /** 先手判定基础值 */
  speed: number
  mods: Mods
  skills?: EnemySkillDef[]
}

export interface BattleConfig {
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

  const rawDamage = (attacker: Combatant<T>, defender: Combatant<T>, mult: number, rng: Rng): number => {
    const atk = numeric.toNumber(attacker.attack)
    const def = numeric.toNumber(defender.defense)
    const base = atk <= 0 ? 0 : (atk * atk) / (atk + def)
    const jitter = 1 + rng.float(-variance, variance)
    const bonus = 1 + mod(attacker.mods, 'damageBonus')
    const reduction = Math.min(0.9, Math.max(0, mod(defender.mods, 'damageReduction')))
    const dmg = base * mult * jitter * bonus * (1 - reduction)
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
    const dealt = Math.min(damage, numeric.toNumber(defender.hp))
    defender.hp = numeric.max(numeric.zero, numeric.sub(defender.hp, numeric.from(damage)))
    events.push({
      round,
      actor: attacker.name,
      kind: isCrit ? 'crit' : kind,
      damage: dealt,
      text: `${attacker.name} ${label}${isCrit ? '重击' : '命中'} ${defender.name},造成 ${Math.round(dealt)} 伤害`
    })
    const lifesteal = Math.max(0, mod(attacker.mods, 'lifesteal'))
    if (lifesteal > 0 && dealt > 0) {
      const heal = Math.min(dealt * lifesteal, numeric.toNumber(numeric.sub(attacker.maxHp, attacker.hp)))
      if (heal > 0) {
        attacker.hp = numeric.add(attacker.hp, numeric.from(heal))
        events.push({ round, actor: attacker.name, kind: 'lifesteal', damage: 0, text: `${attacker.name} 汲取 ${Math.round(heal)} 生命` })
      }
    }
  }

  const alive = (c: Combatant<T>): boolean => numeric.cmp(c.hp, numeric.zero) > 0

  const build = (a: Combatant<T>, b: Combatant<T>): [Combatant<T>, Combatant<T>] => [
    { ...a, hp: a.hp },
    { ...b, hp: b.hp, maxHp: b.maxHp }
  ]

  return {
    /** 解算整场战斗。player 与 enemy 的 hp 会被就地消耗(返回值里也有) */
    resolve(player: Combatant<T>, enemy: Combatant<T>, rng: Rng): BattleResult<T> {
      const [p, e] = build(player, enemy)
      const events: BattleEvent[] = []
      const pSpeed = p.speed * (1 + mod(p.mods, 'speed'))
      const eSpeed = e.speed * (1 + mod(e.mods, 'speed'))
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
          const missing = numeric.toNumber(numeric.sub(c.maxHp, c.hp))
          const heal = Math.min(missing, numeric.toNumber(c.maxHp) * regen)
          if (heal > 0) {
            c.hp = numeric.add(c.hp, numeric.from(heal))
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
      return { win, rounds: round, playerHp: p.hp, enemyHp: e.hp, events }
    }
  }
}

export type CombatEngine<T = number> = ReturnType<typeof createCombatEngine<T>>
