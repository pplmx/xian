/**
 * 灵脉效果行 —— 数值只从 perPoint / INSIGHT_DISCOUNT_PER_POINT 现算。
 *
 * 此前这条文案写在数据表 veins.ts 的 effectText 闭包里,手写「p * 0.4」——
 * 那其实是 perPoint(cultivationSpeed 0.004)×100 的另一份;寒冥灵脉的
 * 「p * 0.4」更是 INSIGHT_DISCOUNT_PER_POINT 的复制。改每点加成那天若只
 * 动一处,卡片就会撒谎。故这里守:①输出与 perPoint 同源;②符号钉死
 * (forgeDiscount 正值是「省」,显示「-X%」,不许照抄「+X%」);③数据表
 * 回归纯声明,不许再背效果文案闭包。
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { INSIGHT_DISCOUNT_PER_POINT, veinDef } from '@/data/veins'
import { formatPercent } from '@/utils/format'
import { veinEffectText } from './veinText'

describe('灵脉效果行', () => {
  it('炼器脉的数值与 perPoint×点数同源(非整数路径也直接对账常量)', () => {
    // 3 点 → 0.003×3 = 0.009 → 0.9%;手写「×0.3」若与 perPoint 脱钩,这里不会说谎
    const raw = veinDef('craft').perPoint.forgeDiscount!
    expect(veinEffectText(veinDef('craft'), 3)).toBe(`炼器消耗 -${formatPercent(3 * raw)}`)
  })

  it('青木/玉髓走标准词条名与带符号格式', () => {
    expect(veinEffectText(veinDef('gather'), 10)).toBe('修炼速度 +4%')
    expect(veinEffectText(veinDef('alchemy'), 10)).toBe('炼丹双成率 +5%')
  })

  it('炼器减的是消耗:正值显示成「-」而不是「+」,免得读成「多花 X%」', () => {
    const t = veinEffectText(veinDef('craft'), 10)
    expect(t).toContain('炼器消耗 -3%')
    expect(t, '「炼器消耗 +X%」对玩家读起来是"花销变多",机制却是省耗').not.toMatch(/炼器消耗 \+/)
  })

  it('寒冥灵脉的折扣读 INSIGHT_DISCOUNT_PER_POINT 常量,不写死倍数', () => {
    const t = veinEffectText(veinDef('insight'), 15)
    expect(t).toBe(`功法进修悟道点 -${formatPercent(15 * INSIGHT_DISCOUNT_PER_POINT)}`)
  })

  it('数据表回归纯声明:veins.ts 不许再带效果文案闭包或手写乘数', () => {
    const src = readFileSync(resolve(__dirname, '../data/veins.ts'), 'utf8')
    expect(src, '效果文案已挪进 ui/veinText,数据表里再出现 effectText 即回归').not.toContain('effectText')
    expect(src, '手写「×0.4」这类乘数一旦回来,改 perPoint 那天卡片就撒谎').not.toMatch(/\* 0\.\d/)
  })
})
