/**
 * 洞府灵脉 —— Phase 30.3
 * 一条主脉(70 点)+ 若干副脉(各 ≤30 点),总容量 100:不能全部点满,方向即取舍。
 */
import type { StatMods } from "@/types";

export type VeinId = "gather" | "craft" | "alchemy" | "insight" | "guard" | "xuanhuang" | "yize";

export interface VeinDef {
  id: VeinId;
  name: string;
  seal: string;
  desc: string;
  /** 每点带来的属性加成(悟道脉走参悟折扣,不在此表) */
  perPoint: StatMods;
}

export const VEINS: VeinDef[] = [
  {
    id: "gather",
    name: "青木灵脉",
    seal: "聚",
    desc: "灵气汇流,修行事半功倍",
    perPoint: { cultivationSpeed: 0.004 },
  },
  {
    id: "craft",
    name: "赤炎灵脉",
    seal: "炼",
    desc: "地火淬器,强化耗材更省",
    perPoint: { forgeDiscount: 0.003 },
  },
  {
    id: "alchemy",
    name: "玉髓灵脉",
    seal: "丹",
    desc: "药气氤氲,炉中常出双丹",
    perPoint: { alchemyYield: 0.005 },
  },
  {
    id: "insight",
    name: "寒冥灵脉",
    seal: "悟",
    desc: "静水映月,功法进修所费更少",
    perPoint: {},
  },
  {
    id: "guard",
    name: "庚金灵脉",
    seal: "守",
    desc: "庚金固本,气血绵长",
    perPoint: { maxHpPct: 0.002 },
  },
  {
    id: "xuanhuang",
    name: "玄黄灵脉",
    seal: "坚",
    desc: "玄黄之气,卸力三分",
    perPoint: { damageReduction: 0.002 },
  },
  {
    id: "yize",
    name: "云泽灵脉",
    seal: "泽",
    desc: "云蒸霞蔚,灵气回涌不息",
    perPoint: { qiRegen: 0.003 },
  },
];

/** 悟道脉每点参悟折扣 */
export const INSIGHT_DISCOUNT_PER_POINT = 0.004;

/**
 * 参悟折扣的绝对上限 —— 不导出:对外只给封顶后的结果(见 insightDiscountOf)。
 * 从前功法结算与灵脉卡片各写一遍 `Math.min(0.5, …)`,改上限那天两边会分家。
 */
const INSIGHT_DISCOUNT_CAP = 0.5;

/**
 * 已投点数 → 参悟折扣(已封顶)。
 *
 * 唯一的换算入口:store 的 insightDiscount(结算真正读的那个数)、灵脉效果行
 * 与灵脉卡片的「当前加成」都从这一处来 —— 卡片上写的百分比与功法实扣的折扣
 * 因此不可能各说一套。
 */
export function insightDiscountOf(points: number): number {
  return Math.min(INSIGHT_DISCOUNT_CAP, Math.max(0, points) * INSIGHT_DISCOUNT_PER_POINT);
}

export function veinDef(id: VeinId): VeinDef {
  return VEINS.find((v) => v.id === id)!;
}
