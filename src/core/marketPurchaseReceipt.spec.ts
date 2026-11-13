/**
 * 花钱的动作必须有一句「买到了什么」。
 *
 * ## 由来（第 190 轮，系统扫「哪些动作没有文字反馈」）
 *
 * 市场购入实测:
 *
 * ```text
 * 点「购入」前    货 6/6
 * 点「购入」后    货 5/6      ← 买成功了
 * toast           （空）
 * ```
 *
 * 查 `MarketView.buySlot`:
 *
 * ```ts
 * function buySlot(idx: number): void {
 *   const r = market.buy(idx);
 *   if (r === "poor") notify("灵石不足,购入不成", "warn");
 *   else if (r === "bagfull") notify("行囊已满,灵石已退回", "warn");
 *   else if (r === "expired") notify("货架刚换新,请按新货再买", "warn");
 * }
 * ```
 *
 * **三条失败都有话说,成功那条没有。** 玩家花掉灵石、货架少一件,而屏幕上
 * 一句确认也没有 —— 只有盯着那个 6/6 变成 5/6 才知道买成了。
 *
 * ## 为什么这算缺陷
 *
 * 同类的花钱动作都有回执:建筑升级「聚灵阵升至 6 级」、吃药「服下 …」、
 * 强化「「X」强化至 +N」、连强「连强至 +N」。**唯独买东西没有。**
 *
 * 而它比别的更需要:购入之后货架换位、灵石变化、有时物品进背包，
 * 三处同时动 —— 玩家没有一个锚点确认「刚才那一下真的成了」。
 *
 * ## 这条判据守什么
 *
 * `buySlot` 必须有一条**成功分支**（不是某个失败分支的 else）。
 * 不钉文案 —— 那句话该说什么由写的人定（货名、花了多少、进了哪里）。
 *
 * ## 故障注入
 *
 * 删掉那句 `else if (r === "ok") notify(...)` → 前两条当场红。
 * 把回执改成 `notify("购入成功")`（不带变量）→ 第三条红。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { stripComments } from "@/test/stripComments";

const VIEW = "src/views/MarketView.vue";

describe("市场购入 · 花钱要有回执", () => {
  it("判据的前提还在 —— buySlot 与那三个失败分支", () => {
    const src = stripComments(readSource(VIEW));
    expect(src, "找不到 buySlot").toContain("function buySlot(");
    for (const r of ["poor", "bagfull", "expired"]) {
      expect(src, `失败分支 ${r} 没了 —— 前提变了，判据该跟着改`).toContain(`"${r}"`);
    }
  });

  it("buySlot 有一条成功分支（不是失败分支的 else）", () => {
    const src = stripComments(readSource(VIEW));
    const start = src.indexOf("function buySlot(");
    expect(start, "找不到 buySlot").toBeGreaterThan(-1);
    const end = src.indexOf("\n}", start);
    expect(end, "buySlot 没有正常结束").toBeGreaterThan(start);
    const body = src.slice(start, end);

    /*
     * 判「成功」这件事:函数里必须有一处 notify，且它**不在**那三条失败判断的
     * `else if (r === ...)` 之下。
     *
     * 做法:逐行扫，凡 `if (r === "…")` / `else if (r === "…")` 之后的 notify 记为失败分支；
     * 剩下的 notify 才算成功回执。
     */
    /*
     * 只把这些**结果码**算失败 —— `"ok"`、`"missing"` 之类不算:
     * 前者是成功，后者是「那格没了」（本质也是失败，但这一条不负责判它）。
     *
     * 第一版把所有 `if (r === "…")` 都当失败分支，于是实现写了
     * `else if (r === "ok") notify(...)` 之后判据仍然红 —— **判据把成功当成了失败**。
     */
    const FAILURE_CODES = /r\s*===\s*"(poor|bagfull|expired|sold)"/;
    const lines = body.split("\n");
    const successNotifies: string[] = [];
    let onFailureBranch = false;
    for (const line of lines) {
      if (/(else\s+)?if\s*\(/.test(line)) onFailureBranch = FAILURE_CODES.test(line);
      if (/notify\(/.test(line) && !onFailureBranch) successNotifies.push(line.trim());
      if (/notify\(/.test(line)) onFailureBranch = false;
    }

    expect(
      successNotifies.length,
      "购入成功没有一句回执 —— 灵石花掉、货架少一件，而屏幕上什么也没发生。" +
        "建筑升级有「升至 N 级」、吃药有「服下…」、强化有「强化至 +N」，唯独买东西没有",
    ).toBeGreaterThan(0);
  });

  it("那句回执说得出「买了什么」—— 不是一句「购入成功」", () => {
    /*
     * 与上一条分开:只说「购入成功」也算有回执，但对玩家没有信息量 ——
     * 他刚点的是哪一格、花了多少、东西进哪了，都不在里面。
     * 判据要求那句 notify 的模板串里引用了至少一个变量。
     */
    const src = stripComments(readSource(VIEW));
    const start = src.indexOf("function buySlot(");
    const end = src.indexOf("\n}", start);
    const body = src.slice(start, end);
    const FAILURE_CODES = /r\s*===\s*"(poor|bagfull|expired|sold)"/;
    const success: string[] = [];
    let onFailureBranch = false;
    for (const line of body.split("\n")) {
      if (/(else\s+)?if\s*\(/.test(line)) onFailureBranch = FAILURE_CODES.test(line);
      if (/notify\(/.test(line) && !onFailureBranch) success.push(line.trim());
      if (/notify\(/.test(line)) onFailureBranch = false;
    }

    if (success.length === 0) {
      expect.fail("没有成功回执，这一条无从判起");
    }
    const mentionsSomething = success.some((l) => /\$\{/.test(l));
    expect(
      mentionsSomething,
      `回执里没有任何变量 —— «${success.join(" / ")}»。说一句「购入成功」等于没说:` +
        "玩家刚点的是哪一格、花了多少、东西进哪了，都不在里面",
    ).toBe(true);
  });
});
