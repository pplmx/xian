/**
 * 历世灵根横向对照 —— 十世履历摆在一起,才看得出「攒宿慧换来了什么」
 *
 * ## 缺口:每一世都记了,但没有一处能横向比
 *
 * 转世灵根那两轮把每一世的灵根记进了 `LifeRecord.linggen`(见 `ui/lifeLinggen`),
 * 历世履历逐行也印得出来。但玩家真正会问的不是「第三世是什么根」,而是
 * **「我这一路抽到的根,在变好吗」**。逐行读十世要自己心算十次。
 *
 * 而这件事有现成的答案 —— 它不是新机制,是把已经记下的数据摆成一眼能读的形状:
 *
 *   · 资质地板随宿慧上浮(`aptitudeFloorNow`),每一世的期望资质单调上升
 *   · 根数越少倍率越高(`COUNT_FACTOR`:单根 1.6 对五根 0.9)
 *   · 品阶名来自根数与均资质(`gradeName`)
 *
 * ## 只算已记下的,不补造
 *
 * 老存档的 `LifeRecord` 没有 linggen 那一栏。那些世**不进对照** ——
 * 与「历世履历不许凭空印一行」同一条规矩。一世的灵根都没记时,整块对照不出。
 *
 * ## 均值,不是最强那一根
 *
 * 五根灵根里有一根 95、其余 40,它就是杂灵根;单根 95 是天灵根。
 * `growthMult` 用的是**均资质**(见 `rollLinggen`),故这里也取均值 ——
 * 取最大值会让「五根里恰好有一根高分」冒充成一副好牌。
 *
 * ## 这一层只算,不读 store
 *
 * 与 `ui/legacyDesk`、`ui/lifeLinggen` 同一条纪律:收参数、给纯值。
 */
import { lifeLinggen, type LifeLinggenRow } from "./lifeLinggen";
import type { LifeRecord } from "@/data/samsara";

/** 一个可对照的世 —— 那一世记过灵根 */
export interface LifeLinggenPoint {
  /** 第几世(1 起) */
  index: number;
  /** 品阶名 */
  grade: string;
  /** 徽记用的逐根数据(与历世履历同一份翻译) */
  roots: LifeLinggenRow["roots"];
  /** 均资质 —— 与 `growthMult` 同一个口径(按根数平均) */
  average: number;
}

export type LifeLinggenSpreadState =
  /** 一世都没记过灵根 —— 整块不出 */
  | "none"
  /** 只记了一世 —— 有数据,但没有「变化」可说 */
  | "single"
  /** 两世以上 —— 可对照 */
  | "spread";

export interface LifeLinggenSpread {
  state: LifeLinggenSpreadState;
  /** 记过灵根的世,按世序升序 */
  points: LifeLinggenPoint[];
  /** 最早那一世(没有记过则 null) */
  first: LifeLinggenPoint | null;
  /** 最晚那一世 */
  last: LifeLinggenPoint | null;
  /** 首末均资质之差;不足两世时为 null(说「涨了 0」是废话) */
  delta: number | null;
  /** 均资质最高的那一世;打平取**更早**的那一世(先到先得) */
  best: LifeLinggenPoint | null;
}

const EMPTY: LifeLinggenSpread = {
  state: "none",
  points: [],
  first: null,
  last: null,
  delta: null,
  best: null,
};

/** 世序与资质都要是有限的非负整数 —— 与历世履历同一套口径 */
function validIndex(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const n = Math.trunc(value);
  return n >= 1 ? n : null;
}

/**
 * 由历世归档算出横向对照。
 *
 * 输入是 `LifeRecord[]`(整份归档),内部只取记过灵根的那几世 ——
 * 故调用方不必自己先过滤一遍(过滤口径若分散在两处,迟早会分叉)。
 */
export function lifeLinggenSpread(lives: readonly LifeRecord[]): LifeLinggenSpread {
  const points: LifeLinggenPoint[] = [];
  for (const record of lives) {
    const index = validIndex(record?.index);
    if (index === null) continue;
    const row = lifeLinggen(record.linggen);
    if (!row) continue;
    // 均资质按**读得出的那几根**算:`lifeLinggen` 已经剔掉认不得的五行 id
    const aptitudes = row.roots
      .map((root) => root.aptitude)
      .filter((value): value is number => value !== null);
    if (aptitudes.length === 0) continue;
    const average = aptitudes.reduce((sum, value) => sum + value, 0) / aptitudes.length;
    points.push({ index, grade: row.grade, roots: row.roots, average });
  }
  if (points.length === 0) return EMPTY;
  // 世序升序 —— 履历本身是倒排的,这里要「从第一世到最后一世」的顺序
  points.sort((a, b) => a.index - b.index);

  const first = points[0]!;
  const last = points[points.length - 1]!;
  /*
   * 最好那一世:**严格大于**才替换,故打平时留下更早的那一世。
   * 用 `>` 而不是 `>=` 是有意的 —— 同样的均资质,先到的先算。
   */
  let best = first;
  for (const point of points) {
    if (point.average > best.average) best = point;
  }
  return {
    state: points.length >= 2 ? "spread" : "single",
    points,
    first,
    last,
    delta: points.length >= 2 ? last.average - first.average : null,
    best,
  };
}
