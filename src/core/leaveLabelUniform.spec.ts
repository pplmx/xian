/**
 * 同一个动作，两个数据文件用了两个名字。
 *
 * ## 由来（第 496 轮）
 *
 * 查「选项名跨事件复用」时，排在最前的是:
 *
 * ```text
 *   「离开」  × 42   ← events.ts 的 leave() 助手
 *   「离去」  × 15   ← chains.ts 也有一个自己的 leave() 助手
 *   「转身离开」 × 4  ← 少数事件手写了第三种
 * ```
 *
 * 三种写法指的是**同一件事**（不参与、退出这个事件）。
 * 玩家在事件里看到的「离开 / 离去 / 转身离开」是三个不同的词，
 * 而它们的行为完全一样 —— 那让玩家以为有区别。
 *
 * ## 判据
 *
 * ① 「退出这个事件」这个动作只用一个词;
 * ② 反差:不是「所有选项名都得唯一」——「俯身细看」这类在两条事件里复用是正常的，
 *    它们是**不同的动作恰好同名**，而这一条只管那一个特定的退出选项;
 * ③ 反差:那句退出文案本身不必唯一（上一轮已经管过文案跨事件复用，
 *    而奇缘链内部共用出口是被允许的）。
 */
import { describe, expect, it } from "vite-plus/test";
import { EVENTS } from "@/data/events";

/** 语义上等价于「退出」的选项名 —— 现有三种写法 */
const LEAVE_WORDS = ["离开", "离去", "转身离开", "转身离去", "走开"];

describe("退出选项 · 一个动作只用一个词", () => {
  it("① 全表只用一种写法", () => {
    const used = new Map<string, number>();
    for (const e of EVENTS) {
      for (const c of e.choices) {
        if (LEAVE_WORDS.includes(c.label)) used.set(c.label, (used.get(c.label) ?? 0) + 1);
      }
    }
    expect(
      used.size,
      `出现了 ${used.size} 种「退出」写法：${[...used].map(([w, n]) => `${w}×${n}`).join("、")}`,
    ).toBe(1);
  });

  it("② 反差：其它选项名的复用不算问题", () => {
    /*
     * 这一条守的是①的边界 —— 它只挑出那几个「退出」同义词，
     * 而不是要求所有选项名唯一（「俯身细看」在两条事件里都是这个动作，那是正常的）。
     */
    const all = new Set<string>();
    for (const e of EVENTS) for (const c of e.choices) all.add(c.label);
    expect(all.size, "选项名种类太少 —— 判据②失去意义").toBeGreaterThan(100);
  });

  it("③ 反差：退出那句文案不必唯一", () => {
    const leaveTexts = new Set<string>();
    for (const e of EVENTS) {
      for (const c of e.choices) {
        if (!LEAVE_WORDS.includes(c.label)) continue;
        for (const o of c.outcomes) leaveTexts.add(o.text);
      }
    }
    /* 文案各不相同是好事，但判据①不要求它 —— 这里只断言「确实不止一句」 */
    expect(
      leaveTexts.size,
      "所有退出文案都一样 —— 那也是问题，但归上一轮那条判据管",
    ).toBeGreaterThan(50);
  });
});
