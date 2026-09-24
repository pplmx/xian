/**
 * 灵草五品(ISS-306)—— 灵草的品阶维度与灵石购价。
 *
 * 之前 `herb` 是单标量:新手村田埂的青芝与混沌海的道草是同一个数,于是
 * 「新手村的草还能炼混沌道祖的丹」「12 株草换 1 灵石」这类反直觉都能成立。
 * 分级把「珍贵」本身做进草里:来源在哪一界,采到的就是哪一品;方子要什么品、
 * 就用什么品;灵石要买草,得按品明码标价,×10 阶梯一路到一千万封顶。
 *
 * 唯一事实源:分档表在 `HERB_GRADE_BANDS`,`herbGradeOfMajor` 是唯一的换算口;
 * 业务代码不许再抄一段境界→品阶的 if 链(要新的界域就改这张表)。
 */
import { MAX_MAJOR, WORLD_BREAK_MAJOR } from './realms'

/** 灵草品阶:1 凡品 → 5 道品(混沌海之巅) */
export type HerbGrade = 1 | 2 | 3 | 4 | 5

export const HERB_GRADES: readonly HerbGrade[] = [1, 2, 3, 4, 5]

/** 品阶全名(界面与人话) */
export const HERB_GRADE_NAMES: Record<HerbGrade, string> = {
  1: '凡品灵草',
  2: '灵品灵草',
  3: '仙品灵草',
  4: '神品灵草',
  5: '道品灵草'
}

/** 品阶短名(列表里用) */
export const HERB_GRADE_SHORT: Record<HerbGrade, string> = {
  1: '凡品',
  2: '灵品',
  3: '仙品',
  4: '神品',
  5: '道品'
}

/**
 * 灵石购价(株)—— ×10 阶梯:1 千 → 1 万 → 10 万 → 100 万 → 1000 万。
 *
 * 这一串数字是「草比石贵的宣言」:石头是挂机油井,后期闲置;草是炼丹根本,
 * 高品稀缺。购价一律远超采集成本,不是给炼丹供料的常规渠道,而是
 * 「灵石多到没处花时才发现一颗道品草顶一条灵石矿」的泻口(烧钱不是印钱,
 * 故不设额度闸,价格本身就是闸)。
 */
export const HERB_BUY_PRICE: Record<HerbGrade, number> = {
  1: 1_000,
  2: 10_000,
  3: 100_000,
  4: 1_000_000,
  5: 10_000_000
}

/**
 * 品阶与境界的分档表:[起始 major, 结束 major, 品阶]。
 *
 * 人间界前中后期分两品(0~4 凡品 / 5~8 灵品),仙界 9~13 仙品,神界 14~17 神品,
 * 混沌海 18~20 道品 —— 五档对齐四大界域,混沌海的至高方子(道祖丹 20)只认道品。
 */
export const HERB_GRADE_BANDS: ReadonlyArray<readonly [number, number, HerbGrade]> = [
  [0, 4, 1],
  [5, 8, 2],
  [WORLD_BREAK_MAJOR, 13, 3],
  [14, 17, 4],
  [18, MAX_MAJOR, 5]
]

/** 某大境界的灵草品阶(跨境即换品 —— 灵草跟着人走,不在原地等) */
export function herbGradeOfMajor(major: number): HerbGrade {
  const m = Math.max(0, Math.min(MAX_MAJOR, major))
  for (const [from, to, grade] of HERB_GRADE_BANDS) {
    if (m >= from && m <= to) return grade
  }
  return 1
}
