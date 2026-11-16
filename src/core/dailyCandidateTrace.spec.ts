/**
 * 今日天道 · 「为什么是这一界」要说得出来。
 *
 * ## 缺口（第 426 轮）
 *
 * `todayChallenge` 会顺延最多 16 次候选，直到裁判通过。而界面上只印了
 *
 * ```text
 *   今日天道：无相天 · 赏 N 道源 · 可行 4/6 流派
 * ```
 *
 * **看不出今天为什么落在这一界。** 而实测当天就是被挑过的：
 *
 * ```text
 *   #0 星陨天   驳回：此局近乎无解,天道不受此约
 *   #1 赤炎天   驳回：此局近乎无解,天道不受此约
 *   #2 无相天   通过
 * ```
 *
 * 玩家读到「今日 · 无相天」时，会以为那是掷出来的 —— 而它其实是被挑过的。
 * 差的那一句是：「今天掠过 2 处…→ 落于无相天」。
 *
 * ## 判据
 *
 * ① 一次即过时 `dailySkipNote` 返回 `null` —— 不多印一句废话；
 * ② 顺延过时，那句话要点名**跳过了哪几处**与**落在哪**；
 * ③ 两个读取器（`todayChallenge` / `dailyCandidates`）看到的是**同一批候选**
 *    —— 各掷一套的话，界面说的与玩家应战的会是两回事；
 * ④ 每天都不掷骰：同一天问多次，答案一模一样（日期种子确定性）；
 * ⑤ 反差：候选为空（全被驳回）时不返回一句话 —— 那时该报的是「今日无题」，
 *    不是「掠过 N 处」。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { dailyCandidates, dailySkipNote, todayChallenge } from "./dailyChallenge";
import { stripComments } from "@/test/stripComments";

describe("今日天道 · 候选轨迹", () => {
  it("同一天问两次，候选完全一样（不掷骰）", () => {
    const a = dailyCandidates();
    const b = dailyCandidates();
    expect(a, "同一天的候选两次不一样 —— 它该是日期确定的").toEqual(b);
  });

  it("候选轨迹与真正的今日天道指向同一界", () => {
    /*
     * ③ 这条是**接线**：若两处各掷一套，`todayChallenge` 给的界
     * 与 `dailyCandidates` 末尾那一处会对不上，而那意味着
     * 界面在描述一个玩家不会遇到的天道。
     */
    const rows = dailyCandidates();
    const today = todayChallenge();
    if (!today) {
      // 今天一个都没过：轨迹该全是驳回
      expect(
        rows.every((r) => r.rejected !== null),
        "今天无题，却有一条候选被标为通过",
      ).toBe(true);
      return;
    }
    const passed = rows.find((r) => r.rejected === null);
    expect(passed, "今日有题，而候选轨迹里没有一条通过 —— 两处各掷了一套").toBeDefined();
    expect(passed!.worldId, "候选轨迹的界与真正的今日天道不是同一个").toBe(today.draft.worldId);
    // 通过之后不该再有候选（顺延到通过就停）
    expect(rows[rows.length - 1]!.rejected, "通过了之后还在继续掷").toBeNull();
  });

  it("一次即过时不印那句话", () => {
    const rows = dailyCandidates();
    const passedAt = rows.findIndex((r) => r.rejected === null);
    if (passedAt === 0) {
      expect(dailySkipNote(), "今天第一次候选就过，却还在说「掠过 N 处」—— 那是废话").toBeNull();
    } else {
      /*
       * 今天顺延过 —— 「一次即过」这一条对今天不适用。
       *
       * 这里原本写的是 `expect(passedAt === 0 || passedAt > 0).toBe(true)`，
       * 而那是个**恒真断言**（lint 也点了名：oxc/double-comparisons）——
       * 判据里出现恒真断言，等于把「今天不适用」伪装成「今天通过了」。
       *
       * 改成明说：今天确实顺延过，由下面那条反向覆盖。
       */
      expect(passedAt, "今日没有一个候选通过 —— 那是另一种情形").toBeGreaterThan(0);
    }
  });

  it("顺延过时，那句话要点名跳过了哪几处、落在哪", () => {
    const rows = dailyCandidates();
    const passedAt = rows.findIndex((r) => r.rejected === null);
    const note = dailySkipNote();
    if (passedAt <= 0) {
      expect(note, "没有顺延，不该有那句话").toBeNull();
      return;
    }
    expect(note, "顺延了却没有说明 —— 玩家会以为这一界是随手掷出来的").not.toBeNull();
    expect(note, `被跳过 ${passedAt} 处，而那句话里的数对不上`).toContain(`掠过 ${passedAt} 处`);
    /*
     * 落在哪：那句话末尾要点名最终那一界。世界名从数据取 ——
     * 这里只查「以 → 落于开头的那一段存在」，名字本身由 ④ 的接线保证。
     */
    expect(note, "那句话没说最终落在哪").toMatch(/→ 落于\S+/);
  });

  it("反差：跳过的那几处，理由要带出来（理由一致时才合并）", () => {
    const rows = dailyCandidates();
    const passedAt = rows.findIndex((r) => r.rejected === null);
    if (passedAt <= 0) return;
    const skipped = rows.slice(0, passedAt);
    const note = dailySkipNote()!;
    const sameReason = skipped.every((r) => r.rejected === skipped[0]!.rejected);
    if (sameReason) {
      expect(note, "跳过的理由一致，那句话却没把理由带出来").toContain(skipped[0]!.rejected!);
    } else {
      expect(note, "理由不一致时不该只印第一条理由（会误导）").not.toContain("（");
    }
  });

  it("世界名不许漏出 undefined", () => {
    const note = dailySkipNote();
    if (note === null) return;
    expect(note, "那句话里漏出了占位符").not.toMatch(/undefined|NaN|\[object/);
  });

  it("接线：界面上真的读了那句话", () => {
    /*
     * 第 388 轮那类「逻辑对、没人调」。这里只查一个形状：
     * `CelestialView` 里出现了 `dailySkip`，且它进了 detail 那一行。
     */
    const vue = readFileSync(resolve(__dirname, "../views/CelestialView.vue"), "utf-8");
    expect(vue, "界面没有读 dailySkipNote").toMatch(/dailySkipNote/);
    const code = stripComments(vue);
    expect(code, "那段说明进了模板却没进 detail 那一行").toMatch(/dailySkip\.value/);
  });
});
