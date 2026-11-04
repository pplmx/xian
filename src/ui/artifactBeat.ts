/**
 * 神通的节拍 —— 一件法宝多久出手一次,该写在它的说明里。
 *
 * ## 问题:说明只说「做什么」,不说「多久一次」
 *
 * 法宝谱上每一件的主动神通都写着效果(「每 N 回合…」的那部分**不在**文案里):
 *
 *   神通 · 焚天诀
 *   对敌造成相当于其气血上限 12% 的伤害
 *
 * 而战斗里真正决定它值多少的是那条 `interval`:同样的效果,每 2 回合一次与
 * 每 5 回合一次是两件不同的东西。数据里明明有(`def.active.interval`),
 * 只有战斗那一侧读它 —— `combat.ts` 的 `round % art.active.interval !== 0`。
 *
 * ## 为什么不能直接写「每 N 回合」
 *
 * `interval === 1` 的几件(定身类)语义是**随身常在**,不是「每 1 回合出手一次」:
 * 那条注释写得很清楚(见 data/artifacts 的 `interval 记 1` 那条)。若一律套
 * 「每 1 回合」,玩家会以为它要等到第二回合才生效 —— 与事实相反。
 *
 * 故这里分成三种说法:
 *   interval ≤ 1  → 「随身常在」(不按回合计)
 *   interval = 2  → 「每 2 回合」(最常见的一档)
 *   interval > 2  → 「每 N 回合」
 *
 * ## 与结算同源
 *
 * 这里只读 `def.active.interval`,不另存一份节拍表 —— 调平衡的人改数据,
 * 文案自己跟着变。
 */
import type { ArtifactDef } from "@/types";

/**
 * 节拍的一句话。
 *
 * 坏值(0 / 负 / NaN)按「随身常在」处理:那种数据在战斗里会让
 * `round % 0` 变成 NaN 而永不触发,是 bug 而非节拍 —— 文案不该替它编一个回合数。
 */
export function artifactBeatText(def: Pick<ArtifactDef, "active">): string {
  const raw = def.active?.interval;
  const n = typeof raw === "number" && Number.isFinite(raw) ? Math.floor(raw) : 1;
  if (n <= 1) return "随身常在";
  return `每 ${n} 回合`;
}

/**
 * 「随身常在」的那几件:它们的 desc 里通常已经写了「常在」,再补一句节拍
 * 会变成同屏说两遍。故调用方据这个谓词决定要不要把节拍摆出来。
 */
export function artifactBeatIsAlways(def: Pick<ArtifactDef, "active">): boolean {
  return artifactBeatText(def) === "随身常在";
}
