import { isWorldEntry, worldOf, type WorldDef } from "@/data/realms";

/**
 * 世界变迁宣告判据 —— 「进入了一个新的世界」要不要有那一声响。
 *
 * 只认**上行跨过大界**的那一刻(人间 → 仙界 → 神界 → 混沌):
 *  · nextMajor 已是某一界的第一境(isWorldEntry 即世界首格:9 / 14 / 18);
 *    —— 世界入口恒是首格,故这已蕴含「上一境不在这个世界」;
 *  · 不宣告出生即人间(major 0 是初始世界,不是"迁入");
 *  · 不宣告转世回落(走向人间界) —— 那是「此世已了」的另一声,已有轮回 toast。
 *
 * 把判据收成纯函数而不是散在视图里:界面只负责"该响就响",
 * 要不要响、响的是哪一界,单测钉死,别让视图自己猜。
 */
export function announceWorldEntry(prevMajor: number, nextMajor: number): WorldDef | null {
  if (nextMajor <= prevMajor) return null;
  if (!isWorldEntry(nextMajor)) return null;
  const w = worldOf(nextMajor);
  if (w.id === "mortal") return null;
  return w;
}
