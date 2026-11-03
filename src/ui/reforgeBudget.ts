/**
 * 重铸预算总账 —— 按下「开洗」之前,先把这一押要花多少说清楚。
 *
 * ## 问题:单价有了,总价没有
 *
 * 自动重铸那一块写着「至多洗 50 次」、写着「每洗 器灵尘×12 · 灵石 800」,
 * 也逐条写着「按当前门槛,约 20 次」—— 唯独没有把三者乘起来:
 * **这一押最多花掉多少**。
 *
 * 玩家要决定的是「押不押」,而决定这个问题要的是总价与最好/最坏结果,
 * 不是单价。单看「每洗 12 尘」会觉得便宜,乘上 50 次才是真的数。
 * 本仓对决策信息的要求就写在这里(`AGENTS.md`):给决定前把数字摊开,
 * 不能只给定性形容词。
 *
 * ## 为什么是「至多」而不是「预计」
 *
 * 自动重铸是**提前收手**的:命中即停、付不起即停、预算用完即停。
 * 所以「至多洗 N 次」对应的正是**上界**,那是能算准的那个数;
 * 而「预计花多少」要按命中概率加权,那是另一个数(逐条的「约 N 次」已经给了)。
 * 两个数混成一句就会自相矛盾 —— 故这里明写「至多」。
 *
 * ## 也报「够不够」
 *
 * 只说「至多花 600 尘」还不够:玩家手上可能只有 400。于是同一行里报出
 * 手上有多少、够不够洗满这个预算。这不是新账 —— 尘与灵石都从资源 store 直读,
 * 单价从 `core/reforge.reforgeCost` 直读,本模块只做乘法。
 */
import { gnZero, isZero, mulN, subClamp } from "@/utils/gnum";
import type { GNum } from "@/types";

export interface ReforgeBudgetCost {
  /** 每次重铸的单价 */
  dust: number;
  stone: GNum;
}

export interface ReforgeBudgetHolding {
  dust: number;
  stone: GNum;
}

export interface ReforgeBudget {
  /** 最多洗几次(已夹到合法区间,与按钮提交时同一口径) */
  rolls: number;
  /** 这一押最多花掉的器灵尘 */
  dust: number;
  /** 这一押最多花掉的灵石 */
  stone: GNum;
  /** 按预算洗满还差多少尘(0 = 够) */
  dustShort: number;
  /** 按预算洗满还差多少灵石(0 = 够) */
  stoneShort: GNum;
  /** 够不够洗满这个预算 */
  enough: boolean;
}

/** 自动重铸一次的预算上界 —— 与面板输入框的 max 同一个数,只在这里写一次 */
export const REFORGE_BUDGET_MAX = 500;

/** 把玩家手打的预算夹回 [1, REFORGE_BUDGET_MAX];坏值按 1 */
export function clampReforgeRolls(raw: unknown): number {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n)) return 1;
  return Math.min(REFORGE_BUDGET_MAX, Math.max(1, n));
}

/**
 * 这一押的总账。
 *
 * @param rolls  至多洗几次(坏值按 1 夹)
 * @param cost   每一次的单价(取自 core/reforge,不在这里另算)
 * @param holding 手上有多少
 */
export function reforgeBudget(
  rolls: unknown,
  cost: ReforgeBudgetCost | null | undefined,
  holding: ReforgeBudgetHolding,
): ReforgeBudget | null {
  if (!cost) return null;
  const n = clampReforgeRolls(rolls);
  const dust = Math.max(0, cost.dust) * n;
  const stone = mulN(cost.stone, n);
  const haveDust = Math.max(0, holding.dust);
  const haveStone = holding.stone ?? gnZero();
  const dustShort = Math.max(0, dust - haveDust);
  const stoneShort = subClamp(stone, haveStone);
  return {
    rolls: n,
    dust,
    stone,
    dustShort,
    stoneShort,
    enough: dustShort === 0 && isZero(stoneShort),
  };
}

/**
 * 总账那一句话。
 *
 * 形如「洗满 50 次至多 器灵尘×600 · 灵石 4万;手上有 400 尘,够洗 33 次」。
 * 付不齐时把那半句换成差多少 —— 与全库「灰钮要写差多少」同一条纪律。
 */
export function reforgeBudgetLine(budget: ReforgeBudget, format: (v: GNum) => string): string {
  const head = `洗满 ${budget.rolls} 次至多 器灵尘×${budget.dust}`;
  const stonePart = isZero(budget.stone) ? "" : ` · 灵石 ${format(budget.stone)}`;
  if (budget.enough) return `${head}${stonePart}`;
  const shorts: string[] = [];
  if (budget.dustShort > 0) shorts.push(`器灵尘×${budget.dustShort}`);
  if (!isZero(budget.stoneShort)) shorts.push(`灵石 ${format(budget.stoneShort)}`);
  return `${head}${stonePart};尚差 ${shorts.join(" · ")}`;
}
