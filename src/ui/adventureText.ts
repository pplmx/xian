/**
 * 历练会话的战绩文案 —— 界面与收尾播报唯一出处
 *
 * 由来:会话的 wins/losses 一直并存,收尾却只渲染胜场 —— 「胜 2 场」
 * 分不出是两战全胜还是九战两胜,而这恰恰是「这趟值不值得再来」与
 * 「胜+负 ≥3 才算走过一趟」(track("explores") 的门槛)要看的数。
 *
 * 口径:全胜时只说胜场,不摆「负 0 场」;坏数先判 isFinite 再夹到 0
 * (Math.max(0, NaN) 仍是 NaN,直接拼进文案会吐 NaN 场)。
 */
import type { AdventureSession } from "@/types";

/** 会话战绩一行:全胜只报胜场,有负场才并列两本账 */
export function sessionRecordText(s: Pick<AdventureSession, "wins" | "losses">): string {
  const wins = Number.isFinite(s.wins) ? Math.max(0, Math.floor(s.wins)) : 0;
  const losses = Number.isFinite(s.losses) ? Math.max(0, Math.floor(s.losses)) : 0;
  if (losses <= 0) return `胜 ${wins} 场`;
  return `胜 ${wins} 场 · 负 ${losses} 场`;
}
