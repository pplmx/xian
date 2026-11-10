import type { FightOutcomeRow } from "@/types";

/**
 * 天界战报弹窗的统一载荷:远征/试炼/天道变数/今日挑战/忆战/重写/立约
 * 全部走这一个形状。定义单独成文件,主文件与各拆出面板共用同一份类型 ——
 * 面板 emit report、主文件 openReport 收,不许两边各写一份结构。
 */
export interface ReportView {
  title: string;
  cleared: boolean;
  markText: string;
  /**
   * 逐场摘要 —— **直接引用 `FightOutcomeRow`,不在这里再手写一份**。
   *
   * 这个形状此前被手写了四遍(加上 `GauntletFightRow` / `StepOutcome.row` /
   * `WorldRunState.rows`),而且每一份都**只写自己以为需要的字段**:
   * 这一份当初就没写 `atkRamp`,上一轮修远征那处时也差点又漏一份。
   *
   * 手写多份的代价始终是同一个:**谁也不会报错,只是某些字段悄悄不存在**。
   * 故这里改成引用类型层那一处定义;将来战报要加读数,只改 `FightOutcomeRow`。
   */
  rows: FightOutcomeRow[];
  reward: number;
  judgementLines?: string[];
}
