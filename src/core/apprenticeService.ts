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
import { QUALITIES } from "@/data/qualities";
import {
  APPRENTICE_MAX_LEVEL,
  APPRENTICE_RECRUIT_TIER_AMOUNT,
  apprenticeYieldMult,
  DISPATCH_ADVENTURE_FIXED_SCORE,
  DISPATCH_NEED_TARGET,
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
 * 寻宝所得的丹:按**当前境界与弟子等级**从可炼丹里挑。
 *
 * ## 两条约束
 *
 * 一 **境界门**:与其余所有取丹路径一样守着 `minRealm` —— 不能开局就让药童
 *    拾到高阶丹把境界门槛抄了近路。该境界没有可炼丹时回退到全池(宁可回退,
 *    也不让寻宝落空、更不抛错)。
 *
 * 二 **等级只许抬、不许降**(本轮修)。原先是 `src[(level * 7) % src.length]` ——
 *    在池长上循环取模。而池子是**按强度大致递增**排的,于是等级一涨,
 *    取到的位置可能绕回池头:实测同一境界下 Lv13 给「真仙丹」(minRealm 9),
 *    Lv14 却是「定心丹」(minRealm 4),Lv20 又落回 minRealm 0 的 fine 丹。
 *    20 级里 **8 级是退步** —— 一个「升级」的动作有近一半的步子在往下走,
 *    而界面把等级当正数在报。
 *
 * ## 怎么抬
 *
 * 把「这一档能拿到的最强那一批」当作可选区:先按 (minRealm, 品阶) 升序排,
 * 取**前 capacity 名**里的一个 —— capacity 随等级长。于是:
 *
 * ```text
 *   等级低 → 只在最前面几名里挑（还是从弱到强）
 *   等级高 → 候选区一直往后伸，最强的那几味也进得来
 * ```
 *
 * 名次由 `(level * 7) % capacity` 定 —— 保留原实现那种「同一等级恒得同一味」
 * 的确定性(预览与结算逐位相等,不能有随机),但取模的**分母是候选区长**而不是全池长,
 * 故名次只会随着 capacity 增长而落到更强的位置上,不会绕回池头。
 */
function pickSeekPill(major: number, level: number): string {
  const craftable = PILLS.filter((p) => p.recipe?.stoneBase != null);
  const pool = craftable.filter((p) => p.minRealm <= major);
  const src = pool.length > 0 ? pool : craftable;
  /*
   * 按 (minRealm, 品阶, id) 升序 —— id 兜底保证全序稳定,同一条池子每次排出来一样。
   * 与 `data/pills` 的书写顺序解耦:内容是随时会加删的,而「谁比谁强」是语义。
   */
  const ordered = [...src].sort(
    (a, b) =>
      a.minRealm - b.minRealm ||
      qualityRankOf(a.quality) - qualityRankOf(b.quality) ||
      a.id.localeCompare(b.id),
  );
  /*
   * 名次 = 等级映射到池子**靠后**的那一段,而不是取模。
   *
   * ## 为什么不能用取模
   *
   * 第一版改法用 `(level * 7) % capacity` —— 保留了确定性,但取模本身就会绕回:
   * 实测 20 级里仍有 **3 级退步**。绕回不是「偶尔运气不好」,是取模的定义:
   * 名次一旦超过分母就从头开始。**只要分母是有限的,升级就必然有退步的那一级。**
   *
   * ## 现在怎么算
   *
   * 把等级线性映射到「池子的后 60%」:
   *
   * ```text
   *   起点 = floor(len * 0.4)          低等级从池子四成处起步（不至于只给最弱的）
   *   跨度 = max(1, len - 起点)        剩下的每一名都留给等级
   *   名次 = 起点 + floor((level-1) / 19 * (跨度-1))
   * ```
   *
   * 于是 `level` 单调不减则名次单调不减，名次单调不减则品阶单调不降。
   * 满级(20)正好落在池尾最强的那一味上,1 级落在四成处。
   *
   * 确定性照旧:同一 (境界, 等级) 恒得同一味,预览与结算逐位相等。
   */
  const start = Math.min(ordered.length - 1, Math.floor(ordered.length * 0.4));
  const span = Math.max(1, ordered.length - start);
  const maxLevel = APPRENTICE_MAX_LEVEL - 1;
  const t = maxLevel > 0 ? Math.min(maxLevel, Math.max(0, Math.round(level) - 1)) / maxLevel : 0;
  const idx = Math.min(ordered.length - 1, start + Math.floor(t * (span - 1)));
  return ordered[idx]!.id;
}

/** 品阶名 → 档位序号;认不出的按最低档(宁可低估,不越界) */
function qualityRankOf(quality: string): number {
  const i = QUALITIES.findIndex((q) => q.id === quality);
  return i < 0 ? 0 : i;
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
  const base = baseSpoils(major, level)[spec]!;
  /*
   * 倍率只有一个来源(`data/apprentices.apprenticeYieldMult`):天赋门类 × 品质。
   *
   * 从前这里就地写 `def.talent === spec ? APPRENTICE_TALENT_BONUS : 1`,品质完全不参与 ——
   * 于是「凡品采药童子」与「灵品寻宝灵童」的产出只差天赋那 1.25,品质只用来染色。
   * 现在倍率的算式收在数据层一处,界面预览与结算都调它(见 ApprenticeView 的派活期望产出)。
   */
  const mult = apprenticeYieldMult(archId, spec);
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

/** 门庭卷首的一份真值：在途、闲置与最近一单归期。 */
export interface ApprenticeOverview {
  total: number;
  idle: number;
  away: number;
  nextReturnAt: number | null;
  nextReturnSpec: ApprenticeSpec | null;
}

/**
 * 弟子列表只在这里汇总一次。页签、朱点、按钮与卷首读数若各数一遍，
 * 迟早会出现「写着 2 人闲置，点派发却说无人在家」的两本账。
 */
export function apprenticeOverview(apprentices: readonly OwnedApprentice[]): ApprenticeOverview {
  let idle = 0;
  let nextReturnAt: number | null = null;
  let nextReturnSpec: ApprenticeSpec | null = null;
  for (const appr of apprentices) {
    if (!appr.task) {
      idle += 1;
      continue;
    }
    if (nextReturnAt === null || appr.task.finishAt < nextReturnAt) {
      nextReturnAt = appr.task.finishAt;
      nextReturnSpec = appr.task.spec;
    }
  }
  return {
    total: apprentices.length,
    idle,
    away: apprentices.length - idle,
    nextReturnAt,
    nextReturnSpec,
  };
}

export interface ApprenticeRosterEntry {
  apprentice: OwnedApprentice;
  away: boolean;
}

/**
 * 值日簿顺序：候差在前，在途按归期从近到远。
 *
 * 页面分组若自己再排一遍，卷首说「最近归来」而正文第一张在途卡却不是同一个人，
 * 玩家会以为归期算错了。顺序也只在这里定一次；原数组不动，空闲弟子保持收录顺序。
 */
export function apprenticeRoster(apprentices: readonly OwnedApprentice[]): ApprenticeRosterEntry[] {
  return apprentices
    .map((apprentice, index) => ({ apprentice, away: apprentice.task !== null, index }))
    .sort((a, b) => {
      if (a.away !== b.away) return a.away ? 1 : -1;
      if (a.away && b.away) {
        const delta = a.apprentice.task!.finishAt - b.apprentice.task!.finishAt;
        if (delta !== 0) return delta;
      }
      return a.index - b.index;
    })
    .map(({ apprentice, away }) => ({ apprentice, away }));
}

/** 差事进度按墙钟线性推进；坏时长也不把 NaN 送进界面。 */
export function apprenticeTaskProgress(
  task: Pick<NonNullable<OwnedApprentice["task"]>, "startAt" | "finishAt">,
  now: number,
): number {
  if (!Number.isFinite(now)) return 0;
  const span = task.finishAt - task.startAt;
  if (!Number.isFinite(span) || span <= 0) return now >= task.finishAt ? 1 : 0;
  return Math.max(0, Math.min(1, (now - task.startAt) / span));
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

export type DispatchNeedSpec = "herb" | "ore" | "study" | "adventure";

export interface DispatchNeedRow {
  spec: DispatchNeedSpec;
  /** 分数对应的库存来源；null 表示历练走灵石兜底分,不是器尘库存。 */
  resource: "herb" | "ore" | "wudao" | "dust" | null;
  stock: number;
  waterline: number;
  score: number;
}

export interface ApprenticeDispatchPlan {
  target: ApprenticeSpec | null;
  topScore: number;
  /** 与 topScore 同分的门；唯一目标时为空。 */
  tiedSpecs: DispatchNeedSpec[];
  rows: DispatchNeedRow[];
}

/**
 * 一键派发的完整依据。按钮目标、四门存底展示与商店派发都只读这一份计划,
 * 免得界面另减一遍 score: 玩家看见的最高门,必须就是按钮会派去的门。
 */
export function apprenticeDispatchPlan(stock: DispatchNeedStock): ApprenticeDispatchPlan {
  const herb = Math.max(0, Math.floor(stock.herb));
  const ore = Math.max(0, Math.floor(stock.ore));
  const wudao = Math.max(0, Math.floor(stock.wudao));
  const dust = Math.max(0, Math.floor(stock.dust));
  const herbScore = needScore(herb, DISPATCH_NEED_TARGET.herb);
  const oreScore = needScore(ore, DISPATCH_NEED_TARGET.ore);
  const studyScore = needScore(wudao, DISPATCH_NEED_TARGET.wudao);
  const dustScore = needScore(dust, DISPATCH_NEED_TARGET.dust);
  const adventureUsesDust = dustScore >= DISPATCH_ADVENTURE_FIXED_SCORE;
  const adventureScore = adventureUsesDust ? dustScore : DISPATCH_ADVENTURE_FIXED_SCORE;
  const rows: DispatchNeedRow[] = [
    {
      spec: "herb",
      resource: "herb",
      stock: herb,
      waterline: DISPATCH_NEED_TARGET.herb,
      score: herbScore,
    },
    {
      spec: "ore",
      resource: "ore",
      stock: ore,
      waterline: DISPATCH_NEED_TARGET.ore,
      score: oreScore,
    },
    {
      spec: "study",
      resource: "wudao",
      stock: wudao,
      waterline: DISPATCH_NEED_TARGET.wudao,
      score: studyScore,
    },
    {
      spec: "adventure",
      resource: adventureUsesDust ? "dust" : null,
      stock: adventureUsesDust ? dust : 0,
      waterline: adventureUsesDust ? DISPATCH_NEED_TARGET.dust : 0,
      score: adventureScore,
    },
  ];
  const topScore = Math.max(...rows.map((row) => row.score));
  const leaders = rows.filter((row) => row.score === topScore);
  return {
    target: leaders.length === 1 ? leaders[0]!.spec : null,
    topScore,
    tiedSpecs: leaders.length > 1 ? leaders.map((row) => row.spec) : [],
    rows,
  };
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
  const target = apprenticeDispatchPlan(stock).target;
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
