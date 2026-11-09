import {
  heritageGroups,
  type HeritageGroup,
  type HeritageMode,
  type HeritageRow,
} from "@/core/samsaraAudit";

import { INSIGHT_PER_APTITUDE } from "@/data/samsara";
import { REINCARNATE_APTITUDE_FLOOR } from "@/data/constants";

/**
 * 资质硬封顶 —— `rollLinggen` 里每一根都是 `Math.min(100, …)`。
 *
 * 不在 `data/constants` 里另立一枚:`core/linggenGen` 直接把 100 写在两处
 * `Math.min` 里,那是「掷点上限」而不是可调参数。这里复述一次是为了让弹窗能说
 * 「离顶还差几步」;真去改掷点上限时,`linggenGrade.spec` 会先红。
 */
export const APTITUDE_CAP = 100;

export type ReincarnationStageId = "death" | "review" | "choice";
export type ReincarnationStageState = "done" | "current" | "upcoming";

export const REINCARNATION_STAGES: ReadonlyArray<{
  id: ReincarnationStageId;
  ordinal: string;
  name: string;
  note: string;
}> = [
  { id: "death", ordinal: "一", name: "辞世", note: "寿数已尽" },
  { id: "review", ordinal: "二", name: "回照", note: "只读不落账" },
  { id: "choice", ordinal: "三", name: "择生", note: "落子不可撤回" },
];

export function reincarnationStageState(
  stageIndex: number,
  activeIndex: number,
): ReincarnationStageState {
  if (stageIndex < activeIndex) return "done";
  if (stageIndex === activeIndex) return "current";
  return "upcoming";
}

export interface SamsaraLedgerGroup extends HeritageGroup {
  count: number;
  mark: string;
  tone: `is-${HeritageMode}`;
}

export interface SamsaraBalance {
  full: number;
  partial: number;
  reset: number;
  keep: number;
  total: number;
}

export interface SamsaraCriticalRow {
  id: string;
  name: string;
  mode: HeritageMode;
  power: HeritageRow["power"];
  detail: string;
  mark: string;
  groupTitle: string;
  tone: `is-${HeritageMode}`;
}

export interface ReincarnationConfirmGate {
  disabled: boolean;
  state: "blocked" | "ready" | "empty";
  short: string;
  detail: string;
}

const MODE_MARK: Record<HeritageMode, string> = {
  full: "留",
  partial: "折",
  reset: "散",
};

export function samsaraLedger(groups: HeritageGroup[] = heritageGroups()): SamsaraLedgerGroup[] {
  return groups.map((group) => ({
    ...group,
    count: group.rows.length,
    mark: MODE_MARK[group.mode],
    tone: `is-${group.mode}`,
  }));
}

export function samsaraBalance(ledger: SamsaraLedgerGroup[] = samsaraLedger()): SamsaraBalance {
  const count = (mode: HeritageMode) => ledger.find((group) => group.mode === mode)?.count ?? 0;
  const full = count("full");
  const partial = count("partial");
  const reset = count("reset");
  return {
    full,
    partial,
    reset,
    keep: full + partial,
    total: full + partial + reset,
  };
}

export function criticalSamsaraRows(
  ledger: SamsaraLedgerGroup[] = samsaraLedger(),
): SamsaraCriticalRow[] {
  return ledger.flatMap((group) =>
    group.rows
      .filter((row) => row.mode === "partial" || (row.mode === "reset" && row.power === "high"))
      .map((row) => ({
        id: row.id,
        name: row.name,
        mode: row.mode,
        power: row.power,
        detail: row.detail,
        mark: group.mark,
        groupTitle: group.title,
        tone: group.tone,
      })),
  );
}

export function reincarnationConfirmGate(
  choiceCount: number,
  chosen: string | null,
): ReincarnationConfirmGate {
  if (choiceCount === 0) {
    return {
      disabled: false,
      state: "empty",
      short: "先天之姿已尽，可直接落子",
      detail: "姿池已抽空，这一刻没有必须再选的项目。",
    };
  }
  if (!chosen) {
    return {
      disabled: true,
      state: "blocked",
      short: `先择一先天之姿（${choiceCount} 项可选）`,
      detail: "选定后才能落下此印；点选本身不会改写存档。",
    };
  }
  return {
    disabled: false,
    state: "ready",
    short: "此印一落，此生归档",
    detail: "道号、灵根、境界与天地都会换新；资源与外物随皮囊散去。",
  };
}

/**
 * 来世根骨的资质地板简报 —— 只算,不读 store。
 *
 * ## 为什么这件事要让玩家看见
 *
 * `aptitudeFloorNow()` = `max(次数 × 5, 宿慧 / 12)`,它把 `rollLinggen` 掷出的
 * 每一根资质整体抬高。也就是说玩家在「来世根骨」那一格里看到的 `水 63 木 44`
 * **已经是抬过的数** —— 而抬它的那一份从哪来、抬了多少,弹窗原文一个字都没说。
 *
 * 道果那条自动通道在弹窗里摊得很开(今生凝得 / 落账后共有 / 跨世用途),
 * 资质地板这条一分账都没有,两条跨世复利只剩一条能读(见 `core/compoundingAudit`)。
 *
 * ## 四件事,各答一个问题
 *
 *   `floor`       这一世是垫着多少掷的（玩家看不懂「资质怎么总是偏高」的答案）
 *   `source`      这份地板是哪条口径在顶（次数保底 / 宿慧折算）
 *   `toCap`       离封顶还差几步（这条维度有多短:第十九世即顶满）
 *   `insightToNext` 再攒多少宿慧能抬一格（「再攒一世值不值」的那一半答案）
 *
 * 全部取整、坏值归零:存档里读出来的东西不许把界面变成 `NaN`。
 */
export interface AptitudeFloorBrief {
  /** 地板值(垫在掷点上的那一份) */
  floor: number;
  /** 哪条口径在顶:`count` 次数保底 / `insight` 宿慧折算 */
  source: "count" | "insight";
  /** 金额封顶:资质掷点上限 */
  cap: number;
  /** 距封顶还差几步(已顶为 0) */
  toCap: number;
  /** 地板已到/越过封顶 —— 任何一次掷点都顶满 */
  capped: boolean;
  /** 按宿慧口径,再攒多少宿慧抬一格(0 < 返回值 ≤ INSIGHT_PER_APTITUDE) */
  insightToNext: number;
  /**
   * 没垫地板时,一根资质大概会是几分;垫上地板后又是几分。
   *
   * 玩家的困惑从来不是「地板是 36」,而是「**火 99 是我运气好还是攒出来的**」——
   * `rollLinggen` 掷的是 `[40, 100]` 均匀分布,地板整体平推上去。故简报给出两个
   * 期望值:不垫(`BASE_MIN..CAP` 的均值)与垫了(`min(cap, x + floor)` 的均值)。
   * 差值才是「攒宿慧真的换来了什么」。
   *
   * 到顶之后两者都封在 cap 上,差值收缩为 0 —— 与 `raisesRoll` 同一件事的两个口径。
   */
  expected: {
    /** 不垫地板时一根资质的期望(裸掷) */
    bare: number;
    /** 垫上这一份地板后一根资质的期望 */
    withFloor: number;
  };
  /**
   * 再攒宿慧之后,**掷出来的资质会不会跟着变**。
   *
   * 与「地板还能不能涨」是两件事:地板到顶(≥100)之后它照样能涨,
   * 而 `rollLinggen` 里每一根都是 `Math.min(100, 掷点 + 地板)` —— 已经顶死,
   * 涨地板不改变任何一根资质。真浏览器截图撞出来的正是这一幕:转过三世、
   * 宿慧 420,三根资质全是 100,而弹窗还写着「再攒 1 宿慧抬一格」。
   * 那不是四舍五入,是许诺了一个不会兑现的结果。
   */
  raisesRoll: boolean;
}

function nonNegInt(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
}

export function aptitudeFloorBrief(input: {
  /** 已完成的转世次数（`reincarnation.count`） */
  lives: unknown;
  /** 当前宿慧总额（含认知折算的那一份,见 `totalInsight()`） */
  insight: unknown;
}): AptitudeFloorBrief {
  const lives = nonNegInt(input.lives);
  const insight = nonNegInt(input.insight);
  const byCount = REINCARNATE_APTITUDE_FLOOR * (lives + 1);
  const byInsight = Math.floor(insight / INSIGHT_PER_APTITUDE);
  const floor = Math.max(byCount, byInsight);
  // 打平时说「次数」—— 它是保底那条,先于宿慧口径存在,不代表谁更强
  const source: AptitudeFloorBrief["source"] = byInsight > byCount ? "insight" : "count";
  const toCap = Math.max(0, APTITUDE_CAP - floor);
  const remainder = insight % INSIGHT_PER_APTITUDE;
  return {
    floor,
    source,
    cap: APTITUDE_CAP,
    toCap,
    capped: floor >= APTITUDE_CAP,
    // 整除时下一格还差满一整格;否则差一个余数
    insightToNext: remainder === 0 ? INSIGHT_PER_APTITUDE : INSIGHT_PER_APTITUDE - remainder,
    // 地板到顶之后掷点已经被 min(100) 顶死,再涨地板也换不来更高的资质
    raisesRoll: floor < APTITUDE_CAP,
    expected: {
      bare: expectedAptitude(0),
      withFloor: expectedAptitude(floor),
    },
  };
}

/**
 * 一根资质的期望 —— 与 `rollLinggen` 的 `Math.min(100, rng.int(40,100) + floor)` 同源。
 *
 * `rng.int(40, 100)` 是闭区间均匀整数,故「裸掷均值」就是 (40+100)/2 = 70;
 * 垫上地板后每一枚都被 `min(cap, …)` 截一下,均值靠逐点求和得出。
 * 取整到一位小数:玩家读的是「大概几分」,不需要更多位数。
 */
function expectedAptitude(floor: number): number {
  const ROLL_MIN = 40;
  const sum = (fn: (x: number) => number): number => {
    let total = 0;
    for (let x = ROLL_MIN; x <= APTITUDE_CAP; x += 1) total += fn(x);
    return total / (APTITUDE_CAP - ROLL_MIN + 1);
  };
  const mean = sum((x) => Math.min(APTITUDE_CAP, x + floor));
  return Math.round(mean * 10) / 10;
}
