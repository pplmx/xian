/**
 * 历世足迹 —— 十世履历摆成一条线,才看得出「我这一路走到哪」
 *
 * ## 缺口:每一世都记了,但没有一处把它们连起来看
 *
 * `LifeRecord` 里每一世都记着终点大境界、终寿、本世宿慧。修仙录把这些**逐行**排成
 * 履历,于是玩家读到的是十组彼此独立的数。
 *
 * 而放置游戏里最自然的一个问题恰好需要横向看:**「我的路有没有在变长」** ——
 * 上一世走到元婴就寿尽了,这一世到合体,下一世能不能再深一层?十行逐条读要自己比较
 * 十次,而这件事有现成的答案:终点境界的走向、终寿与宿慧。
 *
 * ## 只报「走向」,不报「好坏」
 *
 * 本作没有「这一世打得不好」这种评价 —— 转世是主动选择,短命的一世可能是为了早点
 * 换一手灵根。故这一层只给**事实**:最高走到哪一境、平均终寿多少、宿慧累计。
 * 一个「评分」「评级」都不给。
 *
 * ## 读不出就不进那一条统计,不拿 0 冒充
 *
 * `major` / `age` / `insight` 在类型上必填,但老存档可能被 sanitize 成 0 或缺失。
 * 0 境 = 凡人、0 岁 = 没活过,两个都是会被玩家误读的数。故每一项都先判可用:
 * 读不出的世照样算「一世」,只是不进那一条统计。
 *
 * ## 这一层只算,不读 store
 *
 * 与 `ui/lifeLinggen`、`ui/lifeLinggenSpread` 同一条纪律:收参数、给纯值。
 */
import type { LifeRecord } from "@/data/samsara";

/** 足迹上的一个点 —— 一世 */
export interface LifeFootprintPoint {
  /** 第几世(1 起) */
  index: number;
  /** 终点大境界;读不出为 null */
  major: number | null;
  /** 终点境界名 */
  realmLabel: string;
  /** 终寿;读不出为 null */
  age: number | null;
  /** 本世所得宿慧;读不出为 null */
  insight: number | null;
}

export type LifeFootprintState =
  /** 一世都没有 —— 整块不出 */
  | "none"
  /** 只有一世 —— 有足迹,但没有「走向」可言 */
  | "single"
  /** 两世以上 —— 可看走向 */
  | "ready";

export type LifeFootprintTrend = "up" | "down" | "flat" | null;

export interface LifeFootprint {
  state: LifeFootprintState;
  /** 世数(读得出世序的都算) */
  lives: number;
  /** 按世序升序 */
  points: LifeFootprintPoint[];
  /** 终点境界最高的那一世;打平取**更早**那一世。读不出境界的世不参与 */
  best: LifeFootprintPoint | null;
  /** 末世减首世的终点境界差;不足两世或任一端读不出时为 null */
  majorDelta: number | null;
  /** 走向:up / down / flat;不足两世或任一端读不出时为 null */
  trend: LifeFootprintTrend;
  /**
   * 走向的一句人话(如「比首世深 2 境」);没有走向时为空串。
   *
   * 放在这里而不是模板里拼:同一句话若在视图里写,它会与 `trend` / `majorDelta`
   * 各算一遍,改口径时必有一处先撒谎。
   */
  trendText: string;
  /** 平均终寿(只按读得出的世算);一世都读不出时为 null */
  averageAge: number | null;
  /** 参与均寿计算的世数 —— 界面要说清「按几世算的」 */
  ageSamples: number;
  /** 宿慧累计(只加读得出的世) */
  insightTotal: number;
}

const EMPTY: LifeFootprint = {
  state: "none",
  lives: 0,
  points: [],
  best: null,
  majorDelta: null,
  trend: null,
  averageAge: null,
  ageSamples: 0,
  insightTotal: 0,
  trendText: "",
};

/** 世序:有限的、>= 1 的整数 */
function validIndex(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const n = Math.trunc(value);
  return n >= 1 ? n : null;
}

/** 读数:有限的、>= 0 的数(缺 / NaN / 负值都读不出) */
function readNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value >= 0 ? value : null;
}

/**
 * 由历世归档算出足迹。
 *
 * 输入是整份归档(`LifeRecord[]`),过滤与取值口径全收在这一处 ——
 * 视图不再自己先滤一遍,否则两处迟早分叉。
 */
export function lifeFootprint(lives: readonly LifeRecord[]): LifeFootprint {
  const points: LifeFootprintPoint[] = [];
  for (const record of lives) {
    const index = validIndex(record?.index);
    if (index === null) continue;
    points.push({
      index,
      major: readNumber(record.major),
      realmLabel: typeof record.realmLabel === "string" ? record.realmLabel : "",
      age: readNumber(record.age),
      insight: readNumber(record.insight),
    });
  }
  if (points.length === 0) return EMPTY;
  // 世序升序 —— 履历本身是倒排的,足迹要「从第一世到最后」
  points.sort((a, b) => a.index - b.index);

  /*
   * 最高那一世:**严格大于**才替换,故打平留下更早的那一世。
   * `>` 而不是 `>=` 是有意的 —— 同一境界,先到的先算。
   */
  let best: LifeFootprintPoint | null = null;
  for (const point of points) {
    if (point.major === null) continue;
    if (best === null || point.major > best.major!) best = point;
  }

  /*
   * 走向只看**首世与末世**,不看中间 —— 「这一路是往上还是往下」问的是两端,
   * 中间某一世走得浅(比如为了换灵根)不该改变结论。
   * 任一端读不出境界时不给走向:用一个缺值的端点算出来的差值会撒谎。
   */
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const majorDelta =
    points.length >= 2 && first.major !== null && last.major !== null
      ? last.major - first.major
      : null;
  const trend: LifeFootprintTrend =
    majorDelta === null ? null : majorDelta > 0 ? "up" : majorDelta < 0 ? "down" : "flat";

  // 均寿只按读得出的世算 —— 0 岁不该拉低平均
  const ages = points.map((p) => p.age).filter((v): v is number => v !== null && v > 0);
  const averageAge =
    ages.length > 0 ? Math.round((ages.reduce((s, v) => s + v, 0) / ages.length) * 10) / 10 : null;

  const insightTotal = points
    .map((p) => p.insight)
    .filter((v): v is number => v !== null)
    .reduce((s, v) => s + v, 0);

  /*
   * 走向的一句人话 —— 与 `trend` 同一个 `majorDelta`,不另算一遍。
   * 持平说「与首世同一境」而不说「深 0 境」:后者像是没读到数。
   */
  const trendText =
    majorDelta === null
      ? ""
      : majorDelta > 0
        ? `比首世深 ${majorDelta} 境`
        : majorDelta < 0
          ? `比首世浅 ${-majorDelta} 境`
          : "与首世同一境";

  return {
    state: points.length >= 2 ? "ready" : "single",
    lives: points.length,
    points,
    best,
    majorDelta,
    trend,
    trendText,
    averageAge,
    ageSamples: ages.length,
    insightTotal,
  };
}
