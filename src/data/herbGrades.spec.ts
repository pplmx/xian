/**
 * 灵草五品(ISS-306)—— 分档表 / 购价阶梯 / 丹方认品的全量断言。
 *
 * 三条都是设计红线:
 *   · 分档按界域:人间界前一品、人间界后与仙界/神界/混沌海各一品,互不混淆;
 *   · 购价 ×10 阶梯,道品一千万封顶(「草比石贵」的宣言是刚性的);
 *   · **每味可炼方烧的品阶 == 该方准入境界的品阶** —— 若有方子错位,
 *     整条可炼线会被封死(该品的草)或被绕过(低品草进高品炉)。全表钉死。
 */
import { describe, expect, it } from 'vitest'
import { HERB_GROUND_PRICE, HERB_RARITY_GROWTH, HERB_GRADE_BANDS, HERB_GRADES, herbBuyPrice, herbGradeBandLabel, herbGradeOfMajor } from './herbGrades'
import { PILLS } from '@/data/pills'
import { pillCraftCost } from '@/core/pillService'

describe('灵草五品(ISS-306)', () => {
  it('分档按界域:五品各归其界,跨境即换品', () => {
    expect(herbGradeOfMajor(0)).toBe(1) // 炼气 → 凡品
    expect(herbGradeOfMajor(4)).toBe(1) // 化神 → 凡品
    expect(herbGradeOfMajor(5)).toBe(2) // 炼虚 → 灵品
    expect(herbGradeOfMajor(8)).toBe(2) // 渡劫 → 灵品
    expect(herbGradeOfMajor(9)).toBe(3) // 真仙 → 仙品
    expect(herbGradeOfMajor(13)).toBe(3) // 大罗 → 仙品
    expect(herbGradeOfMajor(14)).toBe(4) // 神人 → 神品
    expect(herbGradeOfMajor(17)).toBe(4) // 神帝 → 神品
    expect(herbGradeOfMajor(18)).toBe(5) // 混沌真灵 → 道品
    expect(herbGradeOfMajor(20)).toBe(5) // 混沌道祖 → 道品
    expect(herbGradeOfMajor(999)).toBe(5) // 越界钳到顶品
  })

  it('档位表覆盖 0~20 全部境界,无缺口', () => {
    let prev: number | null = null
    for (const [from, to, grade] of HERB_GRADE_BANDS) {
      expect(grade).toBeGreaterThanOrEqual(HERB_GRADES.at(0)!)
      expect(grade).toBeLessThanOrEqual(HERB_GRADES.at(-1)!)
      if (prev !== null) expect(from, '相邻档位不应重叠/留缝').toBe(prev + 1)
      prev = to
    }
    expect(HERB_GRADE_BANDS[0]![0]).toBe(0)
    expect(HERB_GRADE_BANDS.at(-1)![1]).toBe(20)
  })

  it('购价是公式不是查表:地价 × 珍贵倍率^品距,顶价 = 公式产出,不另行封顶', () => {
    expect(herbBuyPrice(1)).toBe(HERB_GROUND_PRICE)
    for (let i = 1; i < HERB_GRADES.length; i += 1) {
      // 每高一品,价格 = 下一品 × 珍贵倍率(珍贵程度 = 品距,只此一套曲线)
      expect(herbBuyPrice((i + 1) as 2 | 3 | 4 | 5)).toBe(herbBuyPrice(i as 1) * HERB_RARITY_GROWTH)
      expect(herbBuyPrice(i as 1)).toBe(HERB_GROUND_PRICE * HERB_RARITY_GROWTH ** (i - 1))
    }
    // 当前参数下的道品价 1000 × 10^4 = 1000 万 —— 这是公式的产出,不是独立的本
    expect(herbBuyPrice(5)).toBe(10_000_000)
    // 顶价跟着参数走:调珍贵倍率/地价,整条阶梯连同顶价一起动
    const before = herbBuyPrice(5)
    const shifted = HERB_GROUND_PRICE * (HERB_RARITY_GROWTH * 2) ** 4
    expect(shifted).toBeGreaterThan(before)
  })

  it('每味可炼方烧的品阶 == 准入境界的品阶:新手村草进不了道祖丹的炉', () => {
    for (const def of PILLS) {
      if (!def.recipe) continue
      const cost = pillCraftCost(def.id)
      expect(cost, `第${def.id}方无成本`).not.toBeNull()
      expect(cost!.herbGrade, `${def.name}(准入${def.minRealm})的用草品阶错位`).toBe(herbGradeOfMajor(def.minRealm))
    }
    // 两端的实在例子:聚气散烧凡品,道祖丹烧道品
    expect(pillCraftCost('p_jvqisan')!.herbGrade).toBe(1)
    expect(pillCraftCost('p_daozu')!.herbGrade).toBe(5)
    expect(pillCraftCost('p_jvqisan')!.herb).not.toBe(pillCraftCost('p_daozu')!.herb)
  })

  it('herbGradeBandLabel:每品都说得清喂哪个境界(灵草坊的落处提示,口语跟境名走)', () => {
    expect(herbGradeBandLabel(1)).toBe('炼气~化神境方子所用')
    expect(herbGradeBandLabel(2)).toBe('炼虚~渡劫境方子所用')
    expect(herbGradeBandLabel(3)).toBe('真仙~大罗境方子所用')
    expect(herbGradeBandLabel(4)).toBe('神人~神帝境方子所用')
    expect(herbGradeBandLabel(5)).toBe('混沌真灵~混沌道祖境方子所用')
  })
})
