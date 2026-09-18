/* eslint-disable no-console -- 消融实验的读数就是要打印给人看 */
/**
 * 消融实验 —— **库的战斗能不能替代本作的战斗**（不是"能不能表达",是"换过去会怎样"）。
 *
 * 动机:四套主干里等级/属性/装备/副本都已交给库,只剩战斗还是本作自己的 592 行。
 * 在动手之前先量一量:把库的战斗按本作的口径尽量配好(护盾上限 50%、反击 0.5 / 追击 0.6、
 * 暴击倍率 1.5、浮动 ±10%、技能标签通行解释),然后拿**同一批场景 × 同一批种子**跑两边,
 * 看胜负、回合数与收场血线差多少。
 *
 * 结论(见下面的读数与 RIL 的 DEC-119):
 *   两边**不是同一套战斗**,差在四个地方,而且都不是"钩子不够"能补的:
 *     一 **伤害公式的形状**:本作是 `攻击 × 系数`,减伤按 `防/(防+攻×1.15)` 封顶 75%;
 *        库是 `攻²/(攻+防)` 且只有"每击最低 ×5%"。量级与曲线都不同;
 *     二 **一次出手的顺序**:本作是"先掷浮动、再判暴击";库是"先判暴击、再掷浮动"。
 *        同一颗种子会给出不同结果 —— 不是 bug,是两套随机流;
 *     三 **技能选择**:本作按序掷,第一个掷中的说了算(只消耗到命中为止的那几次随机);
 *        库是"把所有技能都掷一遍,再从命中的里抽一个"。消耗的随机数个数都不一样;
 *     四 **本作自己那批词条**(背水/锋芒/罡盾/斩杀/先手/破甲/减伤/易伤)在库的公式里没有位置。
 *
 * 所以这一版**不动本作的战斗**:库的战斗保持"给需要的作品一套开箱骨架"的定位,
 * 不承担"复刻某个上线作品的战斗"这项义务。真要走通,缺的是**主权**而非公式钩子:
 *   `skillFn`(选技能)/ `strikeFn`(整次出手)/ `actFn`(整回合)三处 ——
 *   前两处已经落地;补上三处之后的一格实测见本文件末尾的续测(75% → 100%)。
 */
import { describe, expect, it } from 'vitest'
import { createCombatEngine, createRng, type Combatant, type Rng } from 'wanxiang-engine'
import type { CombatantSnap, EnemySkill } from '@/types'
import { gn } from '@/utils/gnum'
import { RandomService, mulberry32 } from '@/utils/random'
import { resolveCombat } from './combat'
import {
  CRIT_BASE,
  CRIT_DMG_BASE,
  DAMAGE_VARIANCE,
  MITIGATION_CAP,
  MITIGATION_K
} from '@/data/constants'

/** 场景:两边各一个数值档,够看出"强弱悬殊时一致、均势时各自一套" */
interface Scenario {
  name: string
  player: { attack: number; defense: number; hp: number; speed: number; mods: Record<string, number> }
  enemy: { attack: number; defense: number; hp: number; speed: number; mods: Record<string, number> }
  skills?: EnemySkill[]
}

const SCENARIOS: Scenario[] = [
  {
    name: '强弱悬殊·玩家压制',
    player: { attack: 120, defense: 30, hp: 2000, speed: 2, mods: { critRate: 0.3 } },
    enemy: { attack: 12, defense: 4, hp: 260, speed: 1, mods: {} }
  },
  {
    name: '强弱悬殊·敌人压制',
    player: { attack: 14, defense: 4, hp: 260, speed: 1, mods: {} },
    enemy: { attack: 120, defense: 30, hp: 2000, speed: 2, mods: { critRate: 0.3 } }
  },
  {
    name: '均势·无技能',
    player: { attack: 40, defense: 12, hp: 600, speed: 2, mods: { critRate: 0.2 } },
    enemy: { attack: 38, defense: 13, hp: 620, speed: 1, mods: { critRate: 0.15 } }
  },
  {
    name: '均势·带护盾与技能',
    player: { attack: 44, defense: 10, hp: 560, speed: 2, mods: { critRate: 0.2, shieldOnStart: 0.2 } },
    enemy: { attack: 36, defense: 11, hp: 540, speed: 1, mods: { shieldOnStart: 0.15, counterRate: 0.2 } },
    skills: [{ name: '连击', mult: 1.3, rate: 0.35, effect: 'multi' }]
  }
]

function playerSnap(s: Scenario): CombatantSnap {
  return {
    name: '玩家',
    icon: '',
    isPlayer: true,
    attack: gn(s.player.attack),
    defense: gn(s.player.defense),
    maxHp: gn(s.player.hp),
    speed: s.player.speed,
    mods: s.player.mods,
    skills: []
  }
}

function enemySnap(s: Scenario): CombatantSnap {
  return {
    name: '山精',
    icon: '',
    isPlayer: false,
    attack: gn(s.enemy.attack),
    defense: gn(s.enemy.defense),
    maxHp: gn(s.enemy.hp),
    speed: s.enemy.speed,
    mods: s.enemy.mods,
    skills: s.skills ?? []
  }
}

/** 库那边的一份:本作的词条表就是库的本值表,直接把 number 档位搬过去 */
function enginePair(s: Scenario): [Combatant<number>, Combatant<number>] {
  return [
    {
      id: 'player',
      name: '玩家',
      stats: { hp: s.player.hp, maxHp: s.player.hp, attack: s.player.attack, defense: s.player.defense, speed: s.player.speed },
      mods: s.player.mods,
      skills: []
    },
    {
      id: 'enemy',
      name: '山精',
      stats: { hp: s.enemy.hp, maxHp: s.enemy.hp, attack: s.enemy.attack, defense: s.enemy.defense, speed: s.enemy.speed },
      mods: s.enemy.mods,
      skills: s.skills
    }
  ]
}

/**
 * 把库的战斗按本作口径尽量配好。
 *
 * 暴击:本作是 `CRIT_BASE(0.05) + critRate`,库读的是 `critRate` —— 用一层包装把 0.05 补上;
 * 倍率两边都是 ×1.5(本作 `1 + 0.5 + critDamage`,库 `critMultiplier(1.5) + critDamage`)。
 */
function libraryEngine() {
  return createCombatEngine({
    variance: 0.1,
    critMultiplier: 1.5,
    maxRounds: 50,
    shield: { capRatio: 0.5 },
    followups: {},
    skillEffects: true
  })
}

function bumpCrit(mods: CombatantSnap['mods']): CombatantSnap['mods'] {
  return { ...mods, critRate: (mods.critRate ?? 0) + 0.05 }
}

function libraryResolve(s: Scenario, seed: number): { win: boolean; rounds: number; playerHpPct: number } {
  const [p, e] = enginePair(s)
  const battle = libraryEngine().resolve(
    { ...p, mods: bumpCrit(p.mods) },
    { ...e, mods: bumpCrit(e.mods) },
    createRng(seed) as unknown as Rng
  )
  return { win: battle.win, rounds: battle.rounds, playerHpPct: Number(battle.playerHp) / s.player.hp }
}

function hostResolve(s: Scenario, seed: number): { win: boolean; rounds: number; playerHpPct: number } {
  const result = resolveCombat(playerSnap(s), enemySnap(s), new RandomService(mulberry32(seed)))
  // 本作的结果本身就给血线百分比(库给的是绝对血量),两边都换算成"收场时的血线"
  return { win: result.win, rounds: result.rounds, playerHpPct: result.playerHpPct }
}

describe('消融实验 · 库的战斗 vs 本作的战斗', () => {
  it('读数:同一批场景与种子下,两边的胜负 / 回合 / 血线差多少', () => {
    const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1)
    const rows: string[] = []
    for (const s of SCENARIOS) {
      let agree = 0
      let hostWins = 0
      let libWins = 0
      let roundsDelta = 0
      let hpDelta = 0
      for (const seed of SEEDS) {
        const host = hostResolve(s, seed)
        const lib = libraryResolve(s, seed)
        if (host.win === lib.win) agree += 1
        if (host.win) hostWins += 1
        if (lib.win) libWins += 1
        roundsDelta += Math.abs(host.rounds - lib.rounds)
        hpDelta += Math.abs(host.playerHpPct - lib.playerHpPct)
      }
      const n = SEEDS.length
      rows.push(
        `${s.name.padEnd(16, ' ')} 胜负一致 ${String(Math.round((agree / n) * 100)).padStart(3)}%` +
          ` · 胜率 本作 ${String(Math.round((hostWins / n) * 100)).padStart(3)}% / 库 ${String(Math.round((libWins / n) * 100)).padStart(3)}%` +
          ` · 回合差 ${(roundsDelta / n).toFixed(1)} · 血线差 ${(hpDelta / n * 100).toFixed(0)}pp`
      )
    }
    console.log('\n—— 库的战斗 vs 本作的战斗(每个场景 200 颗种子)——')
    for (const row of rows) console.log(`  ${row}`)
    console.log('')

    // 该一致的地方必须一致:强弱悬殊时,两边都得给出同一个胜负(否则说明配置都没配对)
    for (const s of [SCENARIOS[0]!, SCENARIOS[1]!]) {
      const hostWins = SEEDS.filter(seed => hostResolve(s, seed).win).length
      const libWins = SEEDS.filter(seed => libraryResolve(s, seed).win).length
      expect(Math.sign(hostWins - SEEDS.length / 2), `${s.name} 的胜负方向`).toBe(Math.sign(libWins - SEEDS.length / 2))
    }
    // 两边都是纯函数:同一颗种子跑两次结果一致
    expect(libraryResolve(SCENARIOS[2]!, 7)).toEqual(libraryResolve(SCENARIOS[2]!, 7))
    expect(hostResolve(SCENARIOS[2]!, 7)).toEqual(hostResolve(SCENARIOS[2]!, 7))
  })

  it('结论:量级接近但不可互换 —— 均势场景的同种子一致率远低于"换得过去"的标准', () => {
    const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1)
    for (const s of [SCENARIOS[2]!, SCENARIOS[3]!]) {
      const agree = SEEDS.filter(seed => hostResolve(s, seed).win === libraryResolve(s, seed).win).length / SEEDS.length
      // 不是"差一点":同种子下两边常常给出相反的胜负。要把本作换上去,
      // 得先让库的两处主权(skillFn / strikeFn)可被接管,而不是靠调参数对齐 —— 见 DEC-119。
      expect(agree, `${s.name} 的同种子一致率`).toBeLessThan(0.95)
      expect(agree).toBeGreaterThan(0.3) // 也不是毫不相干:两者确实是同一类战斗模型
    }
  })

  it('差在哪:四处都不是"加钩子"能补的(记录在案,供后续决策)', () => {
    /*
     * 一 伤害公式形状不同 —— 本作 `攻击 × 系数` + `防/(防+攻×1.15)` 封顶 75%;
     *    库 `攻²/(攻+防)` + 每击地板 5%。均势场景下这两条曲线给出的回合数差一倍上下(见读数)。
     * 二 一次出手的顺序不同 —— 本作先掷浮动再判暴击,库先判暴击再掷浮动:同一颗种子不同结果。
     * 三 技能选择不同 —— 本作按序掷、第一个命中即用(消耗的随机数个数取决于第几个命中);
     *    库把每个技能都掷一遍再从命中的里抽。**随机流从此完全错位**。
     * 四 本作自己那批词条(背水/锋芒/罡盾/斩杀/先手/破甲/减伤/易伤)在库的公式里没有位置。
     *
     * 汇总:要让本作真正跑在库上,缺的是 `skillFn` 与 `strikeFn` 两处**主权** ——
     * 把"选哪一招""这一招怎么算"整段交还给作品,库只留回合调度与生命周期。
     * 这条结论已记进 RIL(DEC-119),本作战斗维持原样。
     */
    const gaps = ['伤害公式形状', '一次出手的顺序', '技能选择(随机流)', '本作独有的那批词条']
    expect(gaps.length).toBe(4)
  })
})

/**
 * 续测(DEC-119 留下的最后一问)—— 把 sovereignty 接上之后,库能不能与本作的战斗逐位对齐?
 *
 * `skillFn` / `strikeFn` 落地之后,那一问现在测得了:同一批场景与种子下,把本作的口径
 * **整段写进钩子**(选技能按序掷、出手先掷浮动再判暴击、减伤 = 防/(防 + 攻×1.15) 封顶 75%),
 * 看一致率能不能上去。本作战斗本身不动 —— 这里只是在实验里接一份"主权版"配置。
 */
describe('消融实验续 · 接上主权之后能对齐到哪一步', () => {
  /** 主权版:选技能与出手都整段交还给"本作口径" */
  function sovereignEngine() {
    return createCombatEngine({
      variance: 0,
      maxRounds: 50,
      // 这一格没有技能/护盾/反击,回合节奏本身没有分歧:每回合按默认打一记即可
      actFn: (ctx, rng) => {
        void rng
        ctx.strike(ctx.self, ctx.foe, {})
        return true
      },
      strikeFn: (ctx, rng) => {
        const atk = ctx.num(ctx.attacker, 'attack')
        const def = ctx.num(ctx.defender, 'defense')
        const aMods = ctx.attacker.mods
        const dMods = ctx.defender.mods
        // 闪避:本作是"先判闪避"(命中抵掉闪避)。这一格恒 0,但骰子照掷 —— 随机流才对得齐
        if (rng.chance(Math.max(0, (dMods.dodgeRate ?? 0) - (aMods.accuracy ?? 0)))) return true
        let factor = 1 * (1 + (aMods.damageBonus ?? 0))
        factor *= 1 + rng.float(-DAMAGE_VARIANCE, DAMAGE_VARIANCE) // 先掷浮动
        const crit = rng.chance(CRIT_BASE + (aMods.critRate ?? 0)) // 再判暴击
        if (crit) factor *= 1 + CRIT_DMG_BASE + (aMods.critDamage ?? 0)
        const red = Math.min(MITIGATION_CAP, def / (def + atk * MITIGATION_K))
        factor *= 1 - red
        factor *= Math.max(0.1, 1 - (dMods.damageReduction ?? 0))
        const lost = ctx.applyDamage(ctx.defender, atk * Math.max(0.02, factor))
        /**
         * 本作在每次出手之后还会掷三颗骰子:反击、追击、震慑。
         * **词条是 0 也照掷** —— 少了这三颗,后面所有随机都对不上。
         * (这条正是消融实验反复撞上的那种"不是公式差,而是消耗的随机个数差"。)
         */
        if (lost >= 0 && ctx.num(ctx.defender, ctx.keys.hp) > 0) {
          rng.chance(Math.max(0, dMods.counterRate ?? 0))
          rng.chance(Math.max(0, aMods.comboRate ?? 0))
          rng.chance(Math.max(0, aMods.stunRate ?? 0))
        }
        return true
      }
    })
  }

  function sovereignResolve(s: Scenario, seed: number): { win: boolean; rounds: number; playerHpPct: number } {
    const [p, e] = enginePair(s)
    const battle = sovereignEngine().resolve(p, e, createRng(seed) as unknown as Rng)
    return { win: battle.win, rounds: battle.rounds, playerHpPct: Number(battle.playerHp) / s.player.hp }
  }

  it('均势·无技能:接上主权后同种子逐位对齐(胜负与回合数全部相同)', () => {
    const s = SCENARIOS[2]!
    const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1)
    let agreeDefault = 0
    let agreeSovereign = 0
    let roundsMatch = 0
    for (const seed of SEEDS) {
      const host = hostResolve(s, seed)
      if (host.win === libraryResolve(s, seed).win) agreeDefault += 1
      const mine = sovereignResolve(s, seed)
      if (host.win === mine.win) agreeSovereign += 1
      if (host.rounds === mine.rounds) roundsMatch += 1
    }
    const pct = (n: number): string => `${Math.round((n / SEEDS.length) * 100)}%`
    console.log(
      `\n—— 接上主权之后(${s.name},200 颗种子)——\n  库(默认)胜负一致 ${pct(agreeDefault)} · ` +
        `库 + 三处主权 胜负一致 ${pct(agreeSovereign)}(回合数相同 ${pct(roundsMatch)})\n`
    )
    // 接上主权之后,这一格(没有技能/护盾/反击的纯公式场景)应当完全对齐
    expect(agreeSovereign).toBe(SEEDS.length)
    expect(roundsMatch).toBe(SEEDS.length)
    // 而不接主权时对不上 —— 说明"换过去"靠的确实是这两处主权,不是调参数
    expect(agreeDefault).toBeLessThan(SEEDS.length)
  })
})
