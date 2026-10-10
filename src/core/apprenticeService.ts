/**
 * 收徒结算与产出 —— 纯计算,把「弟子跑一趟值多少」写在这,界面/存档都引它。
 *
 * 产出的锚:历练给灵石走 stoneByTier(与战斗同一条经济);采药/采矿/参悟给的是
 * 洞府生产与悟道这些既有消耗品;寻宝则从可炼丹池按等级确定取一枚(不喂全局随机,
 * 可测、可复现)。天赋门类产出 ×APPRENTICE_TALENT_BONUS,不另立一套数值源。
 */
import type { GNum } from "@/types";
import { mulN } from "@/utils/gnum";
import { stoneByTier } from "./formulas";
import { PILLS } from "@/data/pills";
import {
  APPRENTICE_TALENT_BONUS,
  apprenticeDef,
  taskDef,
  type ApprenticeSpec,
} from "@/data/apprentices";

/** 一名已收弟子(与 store 里同形;类型放 service 供两端共用) */
export interface OwnedApprentice {
  uid: string;
  archId: string;
  level: number;
  task: { spec: ApprenticeSpec; startAt: number; finishAt: number } | null;
}

/** 一趟任务的产出账(石头是大数,其余是小数;都未入账,由 store 应用) */
export interface TaskSpoils {
  herb?: number;
  ore?: number;
  dust?: number;
  wudao?: number;
  stone?: GNum;
  pillId?: string;
  pillCount?: number;
}

export function apprenticeTaskSeconds(spec: ApprenticeSpec): number {
  return taskDef(spec).seconds;
}

/**
 * 寻宝所得的丹:按**当前境界**从可炼丹里挑(与其余所有取丹路径一样守着
 * minRealm 的门,不能开局就让药童拾到高阶丹把境界门槛抄了近路)。
 * 该境界没有可炼丹时回退到全池 —— 宁可回退也不让寻宝落空、更不抛错。
 */
function pickSeekPill(major: number, level: number): string {
  const craftable = PILLS.filter((p) => p.recipe?.stoneBase != null);
  const pool = craftable.filter((p) => p.minRealm <= major);
  const src = pool.length > 0 ? pool : craftable;
  return src[(level * 7) % src.length]!.id;
}

function baseSpoils(major: number, level: number): Record<ApprenticeSpec, TaskSpoils> {
  return {
    herb: { herb: 4 + level * 2 },
    ore: { ore: 3 + level * 2 },
    adventure: { stone: stoneByTier(major, 3 + level), dust: 1 + level },
    seek: { pillId: pickSeekPill(major, level), pillCount: 1 },
    study: { wudao: 2 + level },
  };
}

/** 结算一趟任务:取基础账 × 天赋加成;与门派/装备互不相干 */
export function apprenticeSpoils(
  archId: string,
  spec: ApprenticeSpec,
  major: number,
  level: number,
): TaskSpoils {
  const def = apprenticeDef(archId);
  const base = baseSpoils(major, level)[spec]!;
  const mult = def && def.talent === spec ? APPRENTICE_TALENT_BONUS : 1;
  const out: TaskSpoils = {};
  for (const k of ["herb", "ore", "dust", "wudao"] as const) {
    const v = base[k];
    if (typeof v === "number") out[k] = Math.floor(v * mult);
  }
  if (base.stone) out.stone = mulN(base.stone, mult);
  if (base.pillId) {
    out.pillId = base.pillId;
    // 天赋加成作用于枚数:寻宝基座仅 1 枚,floor(1×1.25)=1 会让「寻宝灵童」的天赋整场失活
    // (开局白送的正是 talent='seek' 的 ap_lingtong)。整数枚数用 ceil,才在 1 枚基座上显出差值。
    out.pillCount = Math.max(1, Math.ceil((base.pillCount ?? 1) * mult));
  }
  return out;
}

/** 任务是否已完工(按墙钟) */
export function taskDone(appr: OwnedApprentice, now: number): boolean {
  return appr.task !== null && now >= appr.task.finishAt;
}
