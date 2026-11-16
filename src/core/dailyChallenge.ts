/**
 * 今日天道(Phase 27)—— 程序生成的每日挑战
 * 按日期种子确定性生成(刷新不换题),复用挑战书的验证与定价管线,零人工维护
 */
import { mulberry32, RandomService } from "@/utils/random";
import { CELESTIAL_WORLDS } from "@/data/endgame";
import { MUTATORS } from "@/data/mutators";
import { PACTS } from "@/data/pacts";
import {
  verifyChallenge,
  undertakeChallenge,
  type ChallengeDraft,
  type ChallengeVerdict,
} from "./challenge";
import { recordMilestone } from "./identity";
import type { ExpeditionResult } from "./endgameService";
import { useEndgameStore } from "@/stores/endgame";
import { todayLocalNum } from "@/utils/time";
import { notify } from "./notify";

export interface DailyChallenge {
  day: number;
  draft: ChallengeDraft;
  verdict: ChallengeVerdict;
}

/**
 * 今日的日号。必须跟日课 / 洞府巡游同一套本地日历:
 * UTC 日会在 UTC+8 的早上八点才翻页,玩家会在本地「今天」里看见两套天道,
 * 或是午夜已了日课却仍卡在「昨日天道已成」。
 */
export function todayNumber(): number {
  return todayLocalNum();
}

export interface DailyCandidate {
  /** 第几个候选（0 起） */
  index: number;
  worldId: string;
  /** 裁判的驳回理由；通过则为 null */
  rejected: string | null;
}

/**
 * 今日天道的候选轨迹 —— **为什么是这一个界**（第 426 轮）。
 *
 * ## 缺口
 *
 * `todayChallenge` 会顺延最多 16 次候选，直到裁判通过。而界面上只印了
 * 「今日天道：<界名> · 赏 N 道源 · 可行 M/6 流派」——
 * **看不出今天为什么落在这一界**。
 *
 * 而这个信息对玩家是有用的：
 *
 * ```text
 *   第 0 个候选  星陨天   驳回：此局形同虚设,不配称为挑战
 *   第 1 个候选  万刃天   驳回：此局形同虚设,不配称为挑战
 *   第 2 个候选  赤炎天   通过
 * ```
 *
 * 读出来的是：「今天这一界是被挑过的 —— 不是随便掷的」。
 * 而若某天真的一次都没过（`todayChallenge` 返回 null），
 * 这条轨迹也是**唯一能说清为什么**的东西。
 *
 * ## 为什么单开一个读取器，而不是让 `todayChallenge` 返回两样
 *
 * `todayChallenge` 的返回值被七处消费（界面、守卫、结算），改签名会牵动它们。
 * 而这条轨迹只在**一个地方**要（界面的说明行）—— 故单开。
 * 两处都走同一个 `candidatesFor`，故不会各算一套。
 */
export function dailyCandidates(): DailyCandidate[] {
  const day = todayNumber();
  const out: DailyCandidate[] = [];
  for (let t = 0; t < 16; t += 1) {
    const draft = draftAt(day, t);
    const verdict = verifyChallenge(draft);
    out.push({
      index: t,
      worldId: draft.worldId,
      rejected: verdict?.ok ? null : (verdict?.reason ?? "无从判定"),
    });
    if (verdict?.ok) break;
  }
  return out;
}

/** 第 t 个候选的草案 —— `todayChallenge` 与 `dailyCandidates` 共用这一处 */
function draftAt(day: number, t: number): ChallengeDraft {
  const rng = new RandomService(mulberry32(day * 131 + t * 977));
  const world = CELESTIAL_WORLDS[rng.int(0, CELESTIAL_WORLDS.length - 1)]!;
  const pool = [...MUTATORS];
  const mutatorIds: string[] = [];
  for (let i = 0; i < 2 && pool.length; i += 1) {
    mutatorIds.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]!.id);
  }
  const pactId = rng.chance(0.35) ? PACTS[rng.int(0, PACTS.length - 1)]!.id : null;
  return { worldId: world.id, mutatorIds, pactId, name: `今日天道` };
}

/** 生成今日天道:日期种子确定性;裁判不受(无解/虚设)则顺延候选 */
export function todayChallenge(): DailyChallenge | null {
  const day = todayNumber();
  for (let t = 0; t < 16; t += 1) {
    // 草案生成只有一份（`draftAt`）—— 与 `dailyCandidates` 共用，两边不会各掷一套
    const draft = draftAt(day, t);
    const verdict = verifyChallenge(draft);
    if (verdict?.ok) return { day, draft, verdict };
  }
  return null;
}

/** 应战今日天道:当日限领一次赏,失败可自费重试 */
export function undertakeDaily(daily: DailyChallenge): ExpeditionResult | null {
  const endgame = useEndgameStore();
  if (endgame.dailyDoneDay === daily.day) {
    notify("今日天道已了,明日再会", "info");
    return null;
  }
  const result = undertakeChallenge(daily.draft, daily.verdict, { isDaily: true });
  if (result?.report.cleared) {
    endgame.markDailyDone(daily.day);
    recordMilestone("first_daily");
  }
  return result;
}

/**
 * 今日天道的候选摘要 —— **一句话说清「为什么是这一界」**。
 *
 * 只在需要时给：候选一次就过（最常见）时返回 null ——
 * 那种情况下「今天为什么是这一界」的答案是「没什么特别」，
 * 而多印一句「第 0 个候选即通过」只会让人以为背后有文章。
 *
 * 顺延过才值得说：
 *
 * ```text
 *   今日掠过 2 处：星陨天（此局形同虚设）、万刃天（此局形同虚设）→ 落于赤炎天
 * ```
 */
export function dailySkipNote(): string | null {
  const rows = dailyCandidates();
  const passed = rows.findIndex((r) => r.rejected === null);
  if (passed <= 0) return null; // 一次即过，或一个都没过
  const skipped = rows.slice(0, passed);
  const names = skipped.map((r) => worldNameOf(r.worldId));
  const why = skipped[0]!.rejected ?? "";
  /*
   * 被跳过的几处理由可能不同，只为「都一样」的那种补一句理由 ——
   * 混着说会变成一串噪声，而玩家真正要读的是「今天这一界不是随手给的」。
   */
  const sameReason = skipped.every((r) => r.rejected === why);
  const tail = sameReason ? `（${why}）` : "";
  return `今日掠过 ${names.length} 处：${names.join("、")}${tail} → 落于${worldNameOf(rows[passed]!.worldId)}`;
}

/** 世界名 —— 找不到时退回 id（宁可露 id，也不印 undefined） */
function worldNameOf(id: string): string {
  return CELESTIAL_WORLDS.find((w) => w.id === id)?.name ?? id;
}
