/**
 * 法宝数值的聚焦直测 —— 钉死「唯一出口」的公式本身。
 *
 * artifactEffects.spec 拿说明文案对账(长得像不像)、artifactLadder.spec 断言单调性
 * (梯子不倒挂),这一份钉的是**精确算式**:
 *
 *   · artifactQualityMult / artifactLevelMult:倍率公式与越界钳制;
 *   · artifactValue:神魔镜(divine / drain)在 0 重与 9 重的**黄金数值**,
 *     含吸命回补顶到封顶的行为;
 *   · artifactNextLevelGain:每一级的结构(升到第几级、被动恰好 ×1.08、封顶要标出来);
 *   · artifactSlotsFor / artifactLevelLabel:门槛与文案的单一出口。
 *
 * 黄金数是用 `Math.pow(9.5, 0.5)` 现算后写死的 —— 改公式、改品质倍率、改祭炼增幅,
 * 这一份就当场红,而不是等平衡性悄悄漂掉。
 */
import { describe, expect, it } from 'vitest'
import { artifactDef, artifactLevelLabel, artifactLevelMult, artifactNextLevelGain, artifactQualityMult, artifactSlotsFor, artifactValue, ARTIFACT_LEVEL_BONUS, ARTIFACT_MAX_LEVEL } from './artifacts'

const SHENMO = artifactDef('af_shenmojing')! // 神魔镜:divine · drain(2.6 / 0.6)
const MUYU = artifactDef('af_muyu')! // 墨玉葫芦:mortal · heal(0.12)
const LIHUO = artifactDef('af_lihuo')! // 离火珠:mortal · damage(2.2)

/** 黄金参照:sqrt(9.5) 的相关小数(现算后写死) */
const S95 = 3.08220700148449

describe('artifactQualityMult · 品质倍率的开方', () => {
  it('凡品 1.0 → 1.0;神品 9.5 → sqrt(9.5)', () => {
    expect(artifactQualityMult('mortal')).toBeCloseTo(1, 12)
    expect(artifactQualityMult('divine')).toBeCloseTo(S95, 10)
  })

  it('神品不是 9.5 倍而是 sqrt —— 品阶两级,倍率才两级(而非指数爆炸)', () => {
    expect(artifactQualityMult('divine')).toBeLessThan(artifactQualityMult('divine') * artifactQualityMult('divine'))
  })
})

describe('artifactLevelMult · 祭炼倍率与钳制', () => {
  it('0 重 = 1.0;每重 +8%(1 + level × 0.08)', () => {
    expect(artifactLevelMult(0)).toBeCloseTo(1, 12)
    expect(artifactLevelMult(1)).toBeCloseTo(1 + ARTIFACT_LEVEL_BONUS, 12)
    expect(artifactLevelMult(9)).toBeCloseTo(1 + 9 * ARTIFACT_LEVEL_BONUS, 12) // 1.72
  })

  it('越界钳回:负级 / 超出上限 / 小数不进位', () => {
    expect(artifactLevelMult(-3)).toBeCloseTo(1, 12)
    expect(artifactLevelMult(12)).toBeCloseTo(1 + ARTIFACT_MAX_LEVEL * ARTIFACT_LEVEL_BONUS, 12)
    expect(artifactLevelMult(3.7)).toBeCloseTo(1 + 3 * ARTIFACT_LEVEL_BONUS, 12)
  })
})

describe('artifactValue · 神魔镜(divine)黄金数值', () => {
  it('0 重:被动与主体都 × sqrt(9.5),吸命回补顶到 100% 封顶', () => {
    const v = artifactValue(SHENMO, 0)
    expect(v.passive.accuracy).toBeCloseTo(0.06 * S95, 9) // 0.184932…
    expect(v.passive.damageBonus).toBeCloseTo(0.05 * S95, 9) // 0.154110…
    expect(v.active.amount).toBeCloseTo(2.6 * S95, 9) // 8.013738…
    // 0.6 × sqrt(9.5) ≈ 1.85 → 顶在 ARTIFACT_DRAIN_HEAL_CAP = 1
    expect(v.active.heal).toBeCloseTo(1, 9)
  })

  it('9 重:整体再 ×1.72(被动与主体各乘,不回补仍顶 1)', () => {
    const v = artifactValue(SHENMO, 9)
    const l9 = S95 * 1.72
    expect(v.passive.accuracy).toBeCloseTo(0.06 * l9, 9)
    expect(v.passive.damageBonus).toBeCloseTo(0.05 * l9, 9)
    expect(v.active.amount).toBeCloseTo(2.6 * l9, 9)
    expect(v.active.heal).toBeCloseTo(1, 9)
  })

  it('凡品(mortal,×1)不放大:离火珠 0 重被动就是表的基底', () => {
    expect(artifactValue(LIHUO, 0).passive.attackPct).toBeCloseTo(0.05, 9)
    expect(artifactValue(MUYU, 0).active.amount).toBeCloseTo(0.12, 9)
  })
})

describe('artifactNextLevelGain · 升阶结构', () => {
  it('每一级:被动恰好 ×(1 + 8%),主体同比例,level 指向下一级', () => {
    const g = artifactNextLevelGain(SHENMO, 0)!
    expect(g.level).toBe(1)
    expect(g.passive[0]!.to / g.passive[0]!.from).toBeCloseTo(1 + ARTIFACT_LEVEL_BONUS, 9)
    expect(g.active!.from).toBeCloseTo(2.6 * S95, 9)
    expect(g.passive).toHaveLength(2) // accuracy + damageBonus
  })

  it('吸命回补已顶封顶:下一级标 capped(heal 不会更大了)', () => {
    // 神魔镜 0 重回补已 =1,升阶后仍是 1 → capped 要如实标出来,文案才不撒谎
    const g = artifactNextLevelGain(SHENMO, 0)!
    expect(g.heal!.capped).toBe(true)
    expect(g.heal!.to).toBeCloseTo(1, 9)
  })

  it('满重无下一级:返回 null', () => {
    expect(artifactNextLevelGain(SHENMO, ARTIFACT_MAX_LEVEL)).toBeNull()
  })
})

describe('artifactSlotsFor · 法宝位门槛', () => {
  it('元婴(第 3 大境界)起开第二席,之前的只有一席', () => {
    expect(artifactSlotsFor(0)).toBe(1)
    expect(artifactSlotsFor(2)).toBe(1)
    expect(artifactSlotsFor(3)).toBe(2)
    expect(artifactSlotsFor(9)).toBe(2)
  })
})

describe('artifactLevelLabel · 祭炼等级的说法', () => {
  it('「祭炼 X/9 重」,越界钳回', () => {
    expect(artifactLevelLabel(0)).toBe(`祭炼 0/${ARTIFACT_MAX_LEVEL} 重`)
    expect(artifactLevelLabel(9)).toBe(`祭炼 9/${ARTIFACT_MAX_LEVEL} 重`)
    expect(artifactLevelLabel(12)).toBe(`祭炼 ${ARTIFACT_MAX_LEVEL}/${ARTIFACT_MAX_LEVEL} 重`)
  })
})
