/**
 * 九项技艺 —— 宿慧里权重最大的一项，界面上最看不见
 *
 * ## 缺口（量出来的）
 *
 * `samsaraService.loreInsight` 把宿慧折成五项，其中**技艺那一项权重最大**:
 *
 * ```text
 *   认得灵材      每味 3 点（通晓再 +5）
 *   通晓丹方      每张 4 点
 *   读通器谱      每张 1 点
 *   九项技艺      熟练度之和（0~900）÷ 20  → 最高 45 点
 *   洞悉敌手      每种 2 点
 * ```
 *
 * 而技艺在界面上只有两处**局部**显示:
 *   `EquipReforgePanel`     —— 只报「铭纹」一项（重铸要用它）
 *   `EquipmentDetailDialog` —— 装备详情里顺带列几条
 *
 * 修仙录「随身所知」四行里有灵材 / 丹方 / 器谱 / 敌手，**没有技艺那一行**。
 * 于是玩家看不到「我这世练出了什么手艺」，也不知道它是宿慧的主要来源。
 *
 * ## 三条口径
 *
 *   · **报境地名，不报裸数字**。`crafting.ts` 的注释写着「用叙事分档代替裸数字，
 *     避免玩家把技艺读成等级」；这一行沿用同一份 `skillStageName` / `skillStages`，
 *     不在界面另切一套桶。
 *   · **报「折多少宿慧」，不报「熟练度之和」**。后者是内部量，前者才是玩家关心的。
 *     折算读 `INSIGHT_SKILL_DIV`，不在这里再除一遍（「不做两本账」）。
 *   · **按 `SKILLS` 原序排**，不按熟练度高低。技艺没有强弱之分（各有各的用处），
 *     顺序与丹房、重铸面板里一致。
 *
 * ## 只列动过的技艺
 *
 * 九项全零时整块不出 —— 与器谱进度、敌手谱同一条纪律。
 */
import {
  SKILLS,
  skillLevelFromExp,
  DAO_NAMES,
  skillNextStageName,
  skillStageName,
  skillStageProgress,
  type SkillId,
} from "@/data/crafting";
import { INSIGHT_SKILL_DIV } from "@/data/samsara";

/** 技艺进度里的一行 */
export interface SkillInsightRow {
  id: SkillId;
  name: string;
  /** 累积经验（内部量，界面不用它，判据要用） */
  exp: number;
  /** 熟练度 0~100 */
  level: number;
  /** 境地名（生疏 → 大成） */
  stage: string;
  /** 下一境地的名字；已到顶为 null */
  nextStage: string | null;
  /** 离下一境地的进度 0~1；已到顶为 1 */
  progress: number;
  /**
   * 所属的道（识材道 / 炼丹道 / 灵火道 / 炼器道）。
   *
   * 同一份数据在炼丹界面已经显示了（`BrewingDialog` 的 `daoName` 列），
   * 而宿慧这一页原先只报技艺名 —— 两处对同一件事的呈现不一致。
   */
  daoName: string;
}

export interface SkillInsightDesk {
  rows: SkillInsightRow[];
  /** 九项熟练度之和 ÷ INSIGHT_SKILL_DIV —— 这一世技艺折多少宿慧 */
  insight: number;
  /** 动过的技艺有几项 */
  activeCount: number;
}

/** 坏值按没练过处理 */
function validExp(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return 0;
  return raw > 0 ? raw : 0;
}

const EMPTY: SkillInsightDesk = { rows: [], insight: 0, activeCount: 0 };

/**
 * 由技艺经验表算出进度。
 *
 * 顺序沿用 `SKILLS` 原序 —— 技艺无强弱，排「谁练得多」会把它们读成名次。
 */
export function skillInsightDesk(skillExp: Readonly<Record<string, number>>): SkillInsightDesk {
  const rows: SkillInsightRow[] = [];
  let levelSum = 0;
  for (const def of SKILLS) {
    const exp = validExp(skillExp[def.id]);
    // 与 `loreInsight` 同一份曲线：不加这一项的 0 分也算「没练过」，不列
    const level = skillLevelFromExp(exp);
    levelSum += level;
    if (exp <= 0) continue;
    rows.push({
      id: def.id,
      name: def.name,
      exp,
      level,
      stage: skillStageName(level),
      // 三者读同一份 SKILL_STAGES（见 data/crafting），不会分叉
      nextStage: skillNextStageName(level),
      progress: skillStageProgress(level),
      daoName: DAO_NAMES[def.dao],
    });
  }
  if (rows.length === 0) return EMPTY;
  return {
    rows,
    // 与 `loreInsight` 同一份除数与同一份 floor 口径
    insight: Math.floor(levelSum / INSIGHT_SKILL_DIV),
    activeCount: rows.length,
  };
}
