import type { CombatantSnap, CombatSideStats } from "@/types";

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
   * 逐场摘要;`foe` 带着那一场敌人的加成来源(旧记录可能没有)。
   *
   * `stats` 是那一场的战斗遥测,给「此战之判」的战后归因用。与 `logs` 同一条纪律:
   * 战报是即时浮层、不写进道痕,故可以带 —— 但**别把它存进任何持久化结构**。
   */
  rows: {
    foeName: string;
    win: boolean;
    rounds: number;
    hpLeftPct: number;
    foe?: CombatantSnap;
    stats?: { player: CombatSideStats; enemy: CombatSideStats };
  }[];
  reward: number;
  judgementLines?: string[];
}
