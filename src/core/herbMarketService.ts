/**
 * 灵草坊 —— 灵石购草(ISS-306,反转快赢1 / ISS-303 的「灵草→灵石」兑换)。
 *
 * 方向:只有灵石→灵草,没有灵草→灵石。灵草远比灵石珍贵 —— 草是炼丹根本、
 * 高品稀缺;石头是挂机油井、后期闲置。购价 ×10 阶梯一路到一千万封顶
 * (HERB_BUY_PRICE),不是给炼丹供料的渠道,而是「灵石多到没处花时发现
 * 一颗道品草顶一条灵石矿」的泻口。烧钱不是印钱,故**不设额度闸**,
 * 价格本身就是闸:买得起的自然买得起,买不起的也不会靠它发家。
 *
 * 结算以「株」为单位,单价 × 株数,一次结清;灵石不够即拒绝,不拆单。
 */
import { gn, mulN } from '@/utils/gnum'
import { HERB_BUY_PRICE, type HerbGrade } from '@/data/herbGrades'
import { useResourcesStore } from '@/stores/resources'

export interface HerbBuyResult {
  ok: boolean
  grade: HerbGrade
  herbs: number
  costPerHerb: number
  reason?: 'noStone' | 'badGrade' | 'badAmount'
}

export function herbBuyPrice(grade: HerbGrade): number {
  return HERB_BUY_PRICE[grade]
}

/** 灵石买草:单价 × 株数,一次结清;草入对应品阶,灵石够才成交 */
export function buyHerbs(grade: HerbGrade, herbs: number): HerbBuyResult {
  const resources = useResourcesStore()
  if (!HERB_BUY_PRICE[grade]) return { ok: false, grade, herbs: 0, costPerHerb: 0, reason: 'badGrade' }
  if (!Number.isInteger(herbs) || herbs < 1) return { ok: false, grade, herbs: 0, costPerHerb: HERB_BUY_PRICE[grade], reason: 'badAmount' }
  const cost = mulN(gn(HERB_BUY_PRICE[grade]), herbs)
  if (!resources.hasStone(cost)) return { ok: false, grade, herbs: 0, costPerHerb: HERB_BUY_PRICE[grade], reason: 'noStone' }
  if (!resources.spendStone(cost)) return { ok: false, grade, herbs: 0, costPerHerb: HERB_BUY_PRICE[grade], reason: 'noStone' }
  resources.grantHerbs(herbs, grade)
  return { ok: true, grade, herbs, costPerHerb: HERB_BUY_PRICE[grade] }
}

/**
 * 方向闸:本模块**没有**草→石 的出入口(旧的 exchangeHerbForStone 已删)。
 *
 * 反方向(灵石→草)只有 buyHerbs 一个口;若有人把「草→石」加回来,它要么
 * 成为没人调用的死导出(被 deadExportAudit 拦),要么被 herbMarketService.spec
 * 的模块表面断言当场揪出。双向各有一道机械检查,方向从此钉死。
 */
