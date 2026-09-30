/**
 * 灵脉效果行 —— 数字只从 perPoint / INSIGHT_DISCOUNT_PER_POINT 现算。
 *
 * 此前这条文案写在数据表 veins.ts 的 effectText 闭包里,手写「p * 0.4」——
 * 那其实是 perPoint×100 的另一份;寒冥灵脉的「0.4」更是 INSIGHT_DISCOUNT_PER_POINT
 * 的复制。改每点加成那天若只动一处,卡片就撒谎。故收进这一处:
 * 数据表回归纯声明,数字从表里现算,界面只拿现成的行。
 *
 * 本文件只做映射与文案,不读 store、不改状态 —— 需要状态时调用方传进来。
 */
import type { AnyStatKey } from '@/types'
import { INSIGHT_DISCOUNT_PER_POINT, type VeinDef } from '@/data/veins'
import { formatPercent, formatSignedPercent } from '@/utils/format'
import { STAT_NAMES } from './statNames'

/** 灵脉效果行:每点加成 × 当前点数,一条脉一行话 */
export function veinEffectText(def: VeinDef, points: number): string {
  const parts: string[] = []
  for (const [key, raw] of Object.entries(def.perPoint)) {
    const val = raw * points
    // 一律走 STAT_NAMES + formatSignedPercent:省耗词条(forgeDiscount)已改名「炼器省耗」,
    // 正号读起来就是「省 +X%」,不再需要为它单开 -X% 特例 —— 显示层默认从此对
    parts.push(`${STAT_NAMES[key as AnyStatKey] ?? key} ${formatSignedPercent(val)}`)
  }
  // 寒冥灵脉的 perPoint 是空对象,效果走参悟折扣这条专用通道,别把它写死在 strings 里(见 INSIGHT_DISCOUNT_PER_POINT)
  if (def.id === 'insight') {
    parts.push(`功法进修悟道点 -${formatPercent(points * INSIGHT_DISCOUNT_PER_POINT)}`)
  }
  return parts.join(' · ')
}
