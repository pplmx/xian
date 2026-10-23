/**
 * 收徒结算与产出 —— 纯计算,把「弟子跑一趟值多少」写在这,界面/存档都引它。
 *
 * 产出的锚:历练给灵石走 stoneByTier(与战斗同一条经济);采药/采矿/参悟给的是
 * 洞府生产与悟道这些既有消耗品;寻宝则从可炼丹池按等级确定取一枚(不喂全局随机,
 * 可测、可复现)。天赋门类产出 ×APPRENTICE_TALENT_BONUS,不另立一套数值源。
 */
import type { GNum } from "@/types";
import { mulN } from "@/utils/gnum";
import { formatGN } from "@/utils/format";
import { stoneByTier } from "./formulas";
import { PILLS, pillDef } from "@/data/pills";
import {
  APPRENTICE_RECRUIT_TIER_AMOUNT,
  APPRENTICE_TALENT_BONUS,
  DISPATCH_ADVENTURE_FIXED_SCORE,
  DISPATCH_NEED_TARGET,
  apprenticeDef,
  taskDef,
  type ApprenticeSpec,
} from "@/data/apprentices";

/** 一名已收弟子(与 store 里同形;类型放 service 供两端共用) */
export interface OwnedApprentice {
  uid: string;
  archId: string;
  level: number;
  /** 累计完工趟数 —— 羁绊位阶的依据(纯 flavor,不给产出/时长加成) */
  bond: number;
  task: {
    spec: ApprenticeSpec;
    startAt: number;
    finishAt: number;
    /** 出发时的境界 —— 收割按出发档结算(离线/中途升境也不漂账;老档无此字段则退回当前境界) */
    rewardMajor?: number;
  } | null;
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
 * 收一名弟子要多少灵石 —— **唯一实现**。
 *
 * 从前这条式子写了两遍:store 的 recruit 里算一次(扣费),弟子页又算一次
 * (报价),两处注释都写着"与另一边同源"。那不是同源,是同一个公式的副本 ——
 * 改了一处,玩家看到的价格就和实际扣的钱分家,而两边各自都"算对了"。
 * 判据(singleSourceAudit)只盯着它 glob 里那几个文件,弟子页当时不在其中。
 */
export function apprenticeRecruitCost(major: number): GNum {
  return stoneByTier(major, APPRENTICE_RECRUIT_TIER_AMOUNT);
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

/* ---- 「各尽其长」一键派发 ---- */

/** 一键派发所需的一份库存快照(缺者分高:score = 目标水位 ÷ (现存量 + 1)) */
export interface DispatchNeedStock {
  herb: number;
  ore: number;
  wudao: number;
  dust: number;
}

function needScore(amount: number, water: number): number {
  return water / (Math.max(0, Math.floor(amount)) + 1);
}

/**
 * 取当前最缺的门:各资源短缺分最高者;历练取「器尘短缺分与灵石兜底分之较高」;
 * 并列最高(或无单门胜出)返回 null → 各自专职。确定性:只读快照、无随机。
 */
export function needTargetDoor(stock: DispatchNeedStock): ApprenticeSpec | null {
  const scores: Array<[ApprenticeSpec, number]> = [
    ["herb", needScore(stock.herb, DISPATCH_NEED_TARGET.herb)],
    ["ore", needScore(stock.ore, DISPATCH_NEED_TARGET.ore)],
    ["study", needScore(stock.wudao, DISPATCH_NEED_TARGET.wudao)],
    [
      "adventure",
      Math.max(needScore(stock.dust, DISPATCH_NEED_TARGET.dust), DISPATCH_ADVENTURE_FIXED_SCORE),
    ],
  ];
  let best: ApprenticeSpec | null = null;
  let bestScore = -Infinity;
  let unique = true;
  for (const [spec, s] of scores) {
    if (s > bestScore) {
      best = spec;
      bestScore = s;
      unique = true;
    } else if (s === bestScore) {
      unique = false;
    }
  }
  return unique ? best : null;
}

/**
 * 一键「各尽其长」:把每名闲置弟子确定性地派到当前最缺的门;目标分无差别则各自专职。
 * 返回要派发的 [uid → spec] 清单,由调用方逐个落库。
 */
export function dispatchAllToNeed(
  idle: Array<{ uid: string; talent: ApprenticeSpec }>,
  stock: DispatchNeedStock,
): Array<{ uid: string; spec: ApprenticeSpec }> {
  if (idle.length === 0) return [];
  const target = needTargetDoor(stock);
  if (target) return idle.map((x) => ({ uid: x.uid, spec: target }));
  return idle.map((x) => ({ uid: x.uid, spec: x.talent }));
}

/**
 * 一趟归来的账目文本(与派活期望同源,由 spoils 现算,不另写第二份);
 * 一路的奖励拼全,不早退漏掉灵石。App 启动与收徒页共用同一条通报格式化,
 * 免得启动静默收割那拍自己另写一份(此前归来在 App 重启路径整条不通报)。
 */
export function apprenticeReapText(spoils: TaskSpoils): string {
  const parts: string[] = [];
  if (spoils.herb) parts.push(`灵草 ×${spoils.herb}`);
  if (spoils.ore) parts.push(`玄铁 ×${spoils.ore}`);
  if (spoils.dust) parts.push(`器灵尘 ×${spoils.dust}`);
  if (spoils.wudao) parts.push(`悟道点 ×${spoils.wudao}`);
  if (spoils.stone) parts.push(`灵石 ${formatGN(spoils.stone)}`);
  if (spoils.pillId)
    parts.push(`${pillDef(spoils.pillId)?.name ?? spoils.pillId} ×${spoils.pillCount}`);
  return parts.join(" · ");
}
