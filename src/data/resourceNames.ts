/**
 * 资源显示名唯一权威。
 *
 * 灵石 / 悟道点 / 灵草 / 玄铁 / 功法残页 / 器灵尘 / 灵气 的名字此前散落在
 * engineResources、suppress、eventEngine、InventoryView、endgame 至少 5 处手抄,
 * 改一处其余不跟(已见一处含悟道点、一处不含)。全称在此定一次,各处统一 import。
 *
 * 口径(uiLayering:956 钉的):散文/面板/结算读数用全称;紧凑按钮与「尚差」位用
 * 简称(石/铁/…)—— 简称仍由各消费点各自约定,不在本文件重复登记;
 * 只在全称需要统一处(结算、面板、readouts)用 RESOURCE_LABELS。
 */
import type { SmallResourceId } from "@/types";

export type ResourceId = SmallResourceId | "stone" | "qi";

/** 显示全称:散文、面板、结算读数一律用它 */
export const RESOURCE_LABELS: Record<ResourceId, string> = {
  stone: "灵石",
  wudao: "悟道点",
  herb: "灵草",
  ore: "玄铁",
  page: "功法残页",
  dust: "器灵尘",
  qi: "灵气",
};
