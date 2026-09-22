/**
 * 连战解算(纯函数)的聚焦直测 —— celestialCaliber.spec 测「口径对得上」,
 * 这一份钉的是 mergeRules 与 runGauntlet 的**机制本身**:
 *
 *   · mergeRules:封顶取小 / 倍率相乘 / 词条相加的三档合并语义与缺省穿透;
 *   · runGauntlet:承血携带、场间恢复、每胜叠层、契约违逆、开局血线;
 *   · celestialJudgementLines:三样判定的文案分支与确实无判定时留白。
 *
 * 战斗用「碾压必胜 / 必败」这类确定场景锚定,不调数值临界点。
 */
import { describe, expect, it } from 'vitest'
import { gn } from '@/utils/gnum'
import { mulberry32, RandomService } from '@/utils/random'
import type { CombatantSnap, CombatRules, StatMods } from '@/types'
import { celestialJudgementLines, mergeRules, runGauntlet, worldFoeSnap, CELESTIAL_BASE_DEPTH, type ReferenceStats } from './gauntlet'

function playerSnap(power: number): CombatantSnap {
  return {
    name: '测试道人',
    icon: 'user',
    isPlayer: true,
    attack: gn(30 * power),
    defense: gn(15 * power),
    maxHp: gn(400 * power),
    speed: 1,
    mods: {},
    skills: [{ name: '试剑', mult: 1.6, rate: 0.25 }]
  }
}

const REF: ReferenceStats = { attack: gn(1000), defense: gn(600), maxHp: gn(5000) }
const foe = (name: string, atkR: number, hpR: number): CombatantSnap =>
  worldFoeSnap({ name, icon: 'foe', atkR, defR: 1, hpR, speed: 1, mods: {}, skills: [] }, REF)

describe('mergeRules · 三档合并语义', () => {
  it('缺省穿透:单边规则原样返回,两边都没有才 undefined', () => {
    const only = { maxRounds: 9 }
    expect(mergeRules(undefined, only)).toBe(only)
    expect(mergeRules(only, undefined)).toBe(only)
    expect(mergeRules(undefined, undefined)).toBeUndefined()
  })

  it('封顶类取小:maxRounds 与 shieldCapRatio 都按更严的来', () => {
    const a: CombatRules = { maxRounds: 50, shieldCapRatio: 0.5 }
    const b: CombatRules = { maxRounds: 20, shieldCapRatio: 0.4 }
    const m = mergeRules(a, b)!
    expect(m.maxRounds).toBe(20)
    expect(m.shieldCapRatio).toBe(0.4)
    // 单边声明时另一边按默认(∞ / 1)参与取小
    expect(mergeRules(a, { maxRounds: 10 })!.maxRounds).toBe(10)
    expect(mergeRules(a, {})!.maxRounds).toBe(50)
  })

  it('倍率类相乘:攻/防/血/治疗乘区逐项乘', () => {
    const a: CombatRules = { playerAtkMult: 1.2, enemyHpMult: 1.5 }
    const b: CombatRules = { playerAtkMult: 1.5, enemyAtkMult: 0.8, healMult: 0.5 }
    const m = mergeRules(a, b)!
    expect(m.playerAtkMult).toBeCloseTo(1.8, 10)
    expect(m.enemyAtkMult).toBeCloseTo(0.8, 10)
    expect(m.enemyHpMult).toBeCloseTo(1.5, 10)
    expect(m.healMult).toBeCloseTo(0.5, 10)
  })

  it('词条类相加:双方额外词条逐键求和,缺侧按 0', () => {
    const a: CombatRules = { playerExtraMods: { comboRate: 0.1 } }
    const b: CombatRules = { playerExtraMods: { comboRate: 0.05, critRate: 0.2 }, enemyExtraMods: { damageBonus: 1.5 } }
    const m = mergeRules(a, b)!
    expect(m.playerExtraMods!.comboRate).toBeCloseTo(0.15, 10) // 0.1+0.05 是浮点,不 toBe
    expect(m.playerExtraMods!.critRate).toBeCloseTo(0.2, 10)
    expect(m.enemyExtraMods!.damageBonus).toBeCloseTo(1.5, 10)
  })

  it('startHpPct 取小(残血进复合场更严),perRounds 取先声明的', () => {
    const a: CombatRules = { playerStartHpPct: 0.9, perRounds: { interval: 3, playerHealPct: 0.1, playerShieldPct: 0.1, enemyAtkGrowth: 0.05 } }
    const b: CombatRules = { playerStartHpPct: 0.5, perRounds: { interval: 2, playerHealPct: 0.2, playerShieldPct: 0.2, enemyAtkGrowth: 0.1 } }
    const m = mergeRules(a, b)!
    expect(m.playerStartHpPct).toBe(0.5)
    expect(m.perRounds).toEqual(a.perRounds)
  })
})

describe('runGauntlet · 连战机制', () => {
  it('碾压全场:cleared、fightsWon= 场数、每场都记入 rows', () => {
    const foes = [foe('小卒', 1, 1), foe('副将', 1.2, 1.2), foe('界主', 1.5, 1.5)]
    const report = runGauntlet(playerSnap(100), foes, undefined, 1, new RandomService(mulberry32(7)))
    expect(report.cleared).toBe(true)
    expect(report.fightsWon).toBe(foes.length)
    expect(report.rows).toHaveLength(foes.length)
    expect(report.rows.every(r => r.win)).toBe(true)
    expect(report.totalRounds).toBeGreaterThan(0)
  })

  it('败于某场即止:退回已胜场数,胜负行如实标记', () => {
    const foes = [foe('小卒', 1, 1), foe('天将', 9, 9), foe('界主', 1.2, 1.2)]
    const report = runGauntlet(playerSnap(100), foes, undefined, 1, new RandomService(mulberry32(7)))
    expect(report.cleared).toBe(false)
    expect(report.fightsWon).toBe(1)
    expect(report.rows).toHaveLength(2)
    expect(report.rows[0]!.win).toBe(true)
    expect(report.rows[1]!.win).toBe(false)
  })

  it('契约违逆提前终止:过完无伤线即 pactBroken,不领下一场', () => {
    const report = runGauntlet(playerSnap(100), [foe('纠缠者', 1.4, 1.4)], undefined, 1, new RandomService(mulberry32(3)), {
      minHpAfterFight: 0.999
    })
    expect(report.pactBroken).toBe(true)
    expect(report.cleared).toBe(false)
    expect(report.rows).toHaveLength(1)
  })

  it('开局血线钳制:playerStartHpPct 上限压制每场起始气血', () => {
    const report = runGauntlet(playerSnap(100), [foe('小卒', 0.8, 0.8), foe('副将', 1, 1)], { playerStartHpPct: 0.35 }, 0.5, new RandomService(mulberry32(5)))
    expect(report.cleared, '碾压档被钳到 35% 血也应能过小卒').toBe(true)
    for (const row of report.rows) {
      expect(row.hpLeftPct, '起始血线封顶 0.35,任何一场都该 ≤ 它').toBeLessThanOrEqual(0.35 + 1e-9)
    }
  })

  it('承血携带:场间零恢复时,后续场次起始气血不高于上一场胜后', () => {
    const foes = [foe('小卒', 0.6, 0.6), foe('副将', 1.2, 1.2)]
    const report = runGauntlet(playerSnap(100), foes, undefined, 0, new RandomService(mulberry32(9)))
    expect(report.cleared).toBe(true)
    expect(report.rows[1]!.hpLeftPct).toBeLessThanOrEqual(report.rows[0]!.hpLeftPct + 1e-9)
  })

  it('每胜叠层不进反退就是坏实现:perWinPlayerMods 不该让总战绩更差', () => {
    const p = playerSnap(14)
    const foes = [foe('小卒', 1, 1), foe('副将', 1.3, 1.3)]
    const plain = runGauntlet(p, foes, undefined, 1, new RandomService(mulberry32(11)))
    const stacked = runGauntlet(p, foes, undefined, 1, new RandomService(mulberry32(11)), {
      perWinPlayerMods: { attackPct: 3 }
    })
    expect(stacked.fightsWon).toBeGreaterThanOrEqual(plain.fightsWon)
  })
})

describe('celestialJudgementLines · 文案分支', () => {
  // lowHpDamage 计入构筑深度(非 percent / noDepth),5.2 = 基准 2.6 的两倍
  const heavy: StatMods = { lowHpDamage: CELESTIAL_BASE_DEPTH * 2 }
  const bigMajor = 20
  const anchor = 10

  it('浅构筑且境界到了:没有判定就不该占字数', () => {
    expect(celestialJudgementLines({}, bigMajor, anchor)).toEqual([])
  })

  it('厚构筑:道之理解(加厚 + 增减伤)双双成文,末行给方向', () => {
    const lines = celestialJudgementLines(heavy, bigMajor, anchor)
    expect(lines[0]).toContain('道之理解')
    expect(lines[0]).toContain('×2.00') // 深度 2× 基准 → 加厚系数 2.0
    expect(lines[1]).toContain('+15%') // 超出基准一倍 × 0.15,封顶 0.35 未到
    expect(lines[lines.length - 1]).toContain('换个方向')
  })

  it('境界未到:境界压制独立成文,且不与道之理解混写', () => {
    const lines = celestialJudgementLines({}, 0, anchor)
    expect(lines.join('\n')).toContain('境界压制')
    expect(lines.join('\n')).toContain('+25%') // CELESTIAL_SUPPRESS_BONUS
  })
})
