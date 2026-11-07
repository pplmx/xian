/**
 * 出行方式窗的**账目文案** —— 从「这一趟有多久」到「这一趟大概带回来什么」。
 *
 * ## 由来:单位错了两个数量级
 *
 * 原先窗里每个档位写着四行:
 *
 * ```text
 * 30分
 * 预计材料 ≈ 1.9 件
 * 装备 约 3.2 趟一件 · 丹药 约 12.5 趟一枚
 * 收益 ×1 · 敌势 ×1
 * ```
 *
 * 那三个期望值来自 `core/loot` 的 `expectedMaterialsPerRun` 等,算的是**一场胜战**
 * 的掉落(它们读的 `dropEntriesFor` 就是 `afterWin` 用的那张表)。可它们摆在一个
 * 时长旁边、措辞用「趟」,读起来是「整趟所得」。而一场「寻常游历」的整趟是
 * **126 场战斗**(见 `core/explorationPlan` 的规模账)——
 *
 * * 材料:1.9 件 vs 整趟约 240 件;
 * * 装备:「约 3.2 趟一件」让玩家以为跑三趟才出一件,实际一趟出三十来件;
 * * 丹药:同理,一趟十来枚而不是十二趟一枚。
 *
 * 差的不是四舍五入,是**把每场当成了整趟**。放在出行决策窗里,这直接改变了
 * 「值不值得多花时间」这个判断。
 *
 * ## 现在的写法
 *
 * 先报这一趟的**规模**(几场、每场间隔),再分两层报产出:每场与整趟。
 * 玩家要算的是「多花一倍时间,多拿多少」,那就得让「多拿多少」是整趟的数。
 *
 * 口径:凡「场」都指交战,际遇单独报(它不交战、掉落另算)。
 */
import { EXPLORE_MODES } from "@/data/constants";
import type { ExploreMode } from "@/types";
import type { ExploreTripPlan } from "@/core/explorationPlan";
import { formatDuration } from "@/utils/format";

/**
 * 期望读数的位数:**小数量留一位,大数量取整**。坏数写「—」,不把 NaN 递到屏上。
 *
 * 「整趟约 311.2 件装备」的那个 `.2` 是假精度 —— 它来自一个本身就有 ±20% 抖动的
 * 掉落表,写成三位有效数字只会让人以为精确到件。件数跨过 100 之后取整,
 * 10 以下才保留一位(「约 3.2 场一件」这种换算率要那一位)。
 */
function countText(v: number): string {
  if (!Number.isFinite(v)) return "—";
  if (Math.abs(v) >= 100) return String(Math.round(v));
  return String(Math.round(v * 10) / 10);
}

/** 期望「几场一次」转成「整趟约几件/几枚」;命中率为 0(给不出期望)时不编数 */
function perTrip(count: number | null, battles: number): string {
  if (count === null || !Number.isFinite(count) || count <= 0) return "—";
  return countText(battles / count);
}

export interface ExploreModeRow {
  id: ExploreMode;
  name: string;
  /** 风险词(安稳/小险/大凶/极险)—— 与档位同源,不在这里另判 */
  risk: string;
  /** 这一趟的实发时长(已含灵兽性格);「30分」会变成「33分」 */
  durationText: string;
  /** 整趟交手场次 */
  battles: number;
  /** 整趟际遇次数 */
  events: number;
  /** 遭遇间隔:「约每 12 秒一场」 */
  cadenceText: string;
  /** 整趟的材料期望件数 */
  materialsPerTrip: string;
  /** 整趟的装备期望件数 */
  equipPerTrip: string;
  /** 整趟的丹药期望枚数 */
  pillPerTrip: string;
  /** 每场材料期望(保留一位小数)—— 与上面同源,只是换个分母 */
  materialsPerBattle: string;
  rewardMult: number;
  dangerMult: number;
}

/**
 * 模式窗的四行账。
 *
 * `bucket` 是这一档的**每场**期望(= 核心那三个函数的结果,它们本来就是每场的),
 * `battles` 来自规模账 —— 两者的乘积/之比才是这一趟的读数。
 */
export function exploreModeRow(input: {
  plan: ExploreTripPlan;
  /** 每场材料期望件数 */
  materialsPerBattle: number;
  /** 每场出装备的期望「场数之一」—— 即「约 N 场一件」的那个 N */
  equipBattlesPerPiece: number | null;
  /** 每场出丹药的期望「场数之一」 */
  pillBattlesPerPiece: number | null;
  risk: string;
}): ExploreModeRow {
  const { plan } = input;
  const mode = EXPLORE_MODES[plan.mode];
  return {
    id: plan.mode,
    name: mode.name,
    risk: input.risk,
    durationText: formatDuration(plan.durationSec),
    battles: plan.battles,
    events: plan.events,
    cadenceText: `约每 ${countText(plan.cadenceSec)} 秒一场`,
    materialsPerBattle: countText(input.materialsPerBattle),
    materialsPerTrip: countText(input.materialsPerBattle * plan.battles),
    equipPerTrip: perTrip(input.equipBattlesPerPiece, plan.battles),
    pillPerTrip: perTrip(input.pillBattlesPerPiece, plan.battles),
    rewardMult: mode.rewardMult,
    dangerMult: mode.dangerMult,
  };
}

/**
 * 这一趟的规模一句话:「约 126 场 · 每 12 秒一场 · 途中约 24 次际遇」。
 *
 * 场次与际遇分开报:际遇不交战,掉落另算 —— 把它们并成「150 次遭遇」会让
 * 「一场战斗」与「一次际遇」看起来一样,而玩家关心的是其中哪一半给东西。
 */
export function tripScaleText(row: ExploreModeRow): string {
  const events = row.events > 0 ? ` · 途中约 ${row.events} 次际遇` : "";
  return `约 ${row.battles} 场 · ${row.cadenceText}${events}`;
}

/** 整趟产出一句话:「整趟约 装备 38 件 · 丹药 10 枚 · 材料 240 件」 */
export function tripHaulText(row: ExploreModeRow): string {
  return `整趟约 装备 ${row.equipPerTrip} 件 · 丹药 ${row.pillPerTrip} 枚 · 材料 ${row.materialsPerTrip} 件`;
}
