/**
 * 突破成功要有**文字**反馈 —— 音效与界面数字变化不够。
 *
 * ## 由来（第 189 轮，中后期数值反馈）
 *
 * `attemptBreakthrough` 成功之后做了很多事:境界 +1、清负面 buff、记成就、
 * 播一声音效、跨世界时记里程碑……**唯独没有一句话**。
 *
 * ```ts
 * playSfx(info.isMajor ? "majorBreak" : "breakthrough");
 * ```
 *
 * 整个函数里只有两处 `notify`:失败原因(warn)与首次跨境界门槛的公告(rare)。
 * 同境内逐层突破——也就是九次里的八次——**静默完成**。
 *
 * ## 为什么这算缺陷
 *
 * 突破是这一作最核心的动作（`AGENTS.md` 的「决策信息完整」与「让看不见的机制可见」）。
 * 玩家对它的期待是「我做了一件大事」,而拿到的反馈是:
 *
 * - 一声音效 —— 关了声音就没有;
 * - 境界名从「元婴·五层」变成「元婴·六层」—— 得盯着那一行才看得见;
 * - 修为扣掉了 —— 那是**损失**感,不是**成就**感。
 *
 * 而别处同类动作都有文字:吃药有「服下 …」、强化有「「X」强化至 +N」、
 * 连强有「连强至 +N」。**唯独最重的那个没有。**
 *
 * ## 这条判据守什么
 *
 * 突破成功的分支里必须有 `notify(`,且**不能只靠音效**。
 *
 * 刻意不钉文案内容 —— 那句话该怎么说由写的人定(境界名现取、跨境界时另有公告),
 * 判据只要求「有这么一句」。钉死文案会变成第二本账。
 *
 * ## 故障注入
 *
 * 删掉那句 `if (!announcement) notify(...)` → 「同境内逐层突破也要有一句话」当场红。
 * 把 `advanceRealm` 改名 → 「前提还在」先红（并提示改判据而不是删判据）。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { stripComments } from "@/test/stripComments";

const SRC = "src/core/breakthrough.ts";

describe("突破 · 成功之后要有一句话", () => {
  it("判据的前提还在 —— 那三个锚点都还在", () => {
    const src = stripComments(readSource(SRC));
    for (const anchor of ["if (success) {", "player.advanceRealm()", "playSfx("]) {
      expect(src, `判据的前提没了：${anchor} —— 判据该跟着改，不是删掉`).toContain(anchor);
    }
  });

  it("同境内逐层突破也要有一句话 —— 不能只在首次跨门槛时才有", () => {
    /*
     * 第一版写成「成功分支里有一处 notify」→ **判据绿了，而我判断错了**。
     *
     * 成功分支里确实有 `if (announcement) notify(...)`,但那句只在
     * **首次跨入门槛**时触发（`firstUnlockAnnouncement(from, to)` 在 from===to 时返回 null）。
     * 而同境内逐层突破占九次里的八次 —— 那八次是静默的。
     *
     * 故判据要核的是:**有没有一处不依赖 `announcement` 的 notify**。
     */
    const src = stripComments(readSource(SRC));
    const start = src.indexOf("if (success) {");
    const end = src.indexOf("trackRealm()", start);
    expect(start, "找不到成功分支").toBeGreaterThan(-1);
    expect(end, "找不到 trackRealm 调用").toBeGreaterThan(start);
    const block = src.slice(start, end + "trackRealm()".length);

    /*
     * 把所有 notify 调用抓出来，看有没有一条**不在 `if (announcement)` 之下**的。
     * 做法:逐行扫，记最近一次条件是否提到 announcement。
     */
    /*
     * 口径:一句 notify 算「无条件」的前提是它**不在 `if (announcement)` 之下**。
     *
     * `if (!announcement) notify(...)` 是**正当的**——它正是「首次跨门槛说那句、
     * 其余情况说这句」的二选一，两种情况都有话。第一版把它也判成「无条件分支」，
     * 于是实现写了 `if (!announcement)` 之后判据就绿了 —— 那是对的,但判据没验证到它。
     *
     * 故这里只排除**正条件** `if (announcement)`；带 `!` 的算符合条件的反支。
     */
    const lines = block.split("\n");
    const unconditional: string[] = [];
    let guardedByAnnouncement = false;
    for (const line of lines) {
      if (/^\s*if \(announcement\)/.test(line)) guardedByAnnouncement = true;
      if (/notify\(/.test(line)) {
        if (!guardedByAnnouncement) unconditional.push(line.trim());
        guardedByAnnouncement = false; // 一行 if 管一行
      }
    }

    expect(
      unconditional.length,
      "突破成功的反馈只挂在 `if (announcement)` 之下 —— 那句只在**首次跨境界门槛**时触发，" +
        "而同境内逐层突破占九次里的八次，那八次是静默的。" +
        "吃药有「服下…」、强化有「强化至 +N」、连强有「连强至 +N」，唯独最重的这个没有",
    ).toBeGreaterThan(0);
  });

  it("那句 notify 不是失败分支混进来的（位置要在 advanceRealm 之后）", () => {
    /*
     * 防空转的第二层:若有人把失败那条 `notify(info.reason, "warn")` 挪进这个窗口，
     * 上面那条会绿，而玩家依旧收不到成功反馈。故核**advanceRealm 之后**。
     */
    const src = stripComments(readSource(SRC));
    const adv = src.indexOf("player.advanceRealm()");
    expect(adv, "找不到 advanceRealm").toBeGreaterThan(-1);
    const tail = src.slice(adv, src.indexOf("trackRealm()", adv));
    expect(
      tail,
      "advanceRealm 之后没有 notify —— 成功反馈要么没有，要么发在了突破之前（那时玩家还没成）",
    ).toMatch(/notify\(/);
  });
});
