/**
 * 存档形状修复 —— 实现已搬进公共库(见 packages/engine 的 saveShape)。
 *
 * 这些判据与具体游戏无关:凡是"从外部读回来的数据"(存档、导入、云同步)都要过一遍。
 * 故它们在库里实现与自测,本文件只做转出 —— 各 store 的 import 一行不用改。
 */
import type { GNum } from "@/types";
import { gn, gnZero } from "@/utils/gnum";

export {
  asArray,
  asFiniteNumber,
  asNumberRecord,
  asObjectOrNull,
  asRecord,
  asRecordOf,
  asStringArray,
} from "wanxiang-engine";

/**
 * 存档里某个 GNum 价坏了就归零(买卖贪便宜亦无妨 —— 上货/换版会重填,不会真以零成交)。
 * 坊市与悬赏两店共用,别各写一份(前者写坏了后者照样漏)。
 */
export function asPrice(v: unknown): GNum {
  if (!v || typeof v !== "object" || !("m" in v) || !("e" in v)) return gnZero();
  const shaped = v as { m: unknown; e: unknown };
  const m = shaped.m;
  const e = shaped.e;
  if (typeof m === "number" && typeof e === "number" && Number.isFinite(m) && Number.isFinite(e))
    return gn({ m, e });
  return gnZero();
}
