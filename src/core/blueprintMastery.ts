/**
 * 器谱掌握度 —— 「读到几分」与「是否读通」的唯一口径。
 *
 * 掌握度是 0~1 的连续值,但宿慧、轮回录、图鉴、铁砧进度与重铸保底都只该认
 * 同一个「读通」门槛。这个模块不碰 store,供这几条读写路径共用。
 */
import { BLUEPRINT_MASTERY_PER_REFORGE } from "@/data/constants";

const MASTERED = 1;
const FLOAT_EPSILON = 1e-9;

/** 坏档与越界值都夹回 0~1;NaN / Infinity 按尚未研读处理 */
export function clampBlueprintMastery(mastery: number): number {
  if (!Number.isFinite(mastery)) return 0;
  return Math.max(0, Math.min(MASTERED, mastery));
}

/** 只有满掌握才算读通 */
export function isBlueprintMastered(mastery: number): boolean {
  return clampBlueprintMastery(mastery) >= MASTERED;
}

/**
 * 按当前每次成功重铸的增量,还需几次才读通。
 *
 * 向上取整并扣一个极小浮点余量:0.98 明确只差一次,不会因 0.02 的二进制误差
 * 被算成两次。非法增量返回 Infinity,界面不能把「不会增长」冒充成「已读通」。
 */
export function blueprintReforgesUntilMastered(
  mastery: number,
  perReforge = BLUEPRINT_MASTERY_PER_REFORGE,
): number {
  const current = clampBlueprintMastery(mastery);
  if (current >= MASTERED) return 0;
  if (!Number.isFinite(perReforge) || perReforge <= 0) return Number.POSITIVE_INFINITY;
  return Math.ceil((MASTERED - current) / perReforge - FLOAT_EPSILON);
}
