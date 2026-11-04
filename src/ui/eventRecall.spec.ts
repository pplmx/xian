/**
 * 见过第二次 —— 重复遇到同一事件时,该有一句「你想起上一次」。
 *
 * ## 缺口
 *
 * 九十五个事件里只有八个标了 `once`(见 data/events)。**其余八十七个可以反复出现**,
 * 而第二次、第五次遇到时,标题、正文、选项**一字不差**。
 *
 * 这不是 bug —— 放置游戏里重复是设计的一部分。但玩家的体感是:
 * 「怎么又是这个?」而界面上什么都不认账,仿佛这是第一次。
 *
 * 更要紧的是:`adventure.eventMemories` 里**已经记着**每一次的结果 ——
 * 完成次数 `times`、上次选择 `lastChoiceIdx`。这两样都躺在那儿,界面上一次都没用。
 *
 * ## 补什么
 *
 * 重复遇到时,正文下面多一句:
 *
 *   你想起上一次,自己走的是「抱起灵狐就走」;这已是第三次。
 *
 * —— 从 `eventMemories` 里取,不新存任何东西。第一次遇到时整句不出
 * (那是初遇,没什么可想的)。
 *
 * ## 为什么只加一句,不加"变体内容"
 *
 * 给八十七个事件各写两三套变体,是八十七乘三份文案,而且每一份都要与选项语义对得上。
 * 那是内容工程,不是这一轮能做完的。而**"承认这是重复"**这件事,一句就够 ——
 * 它改变的是玩家对重复的体感:从"系统没记住"变成"世界记得"。
 *
 * ## 与法度的关系
 *
 * 这句是**描述**,不影响抽题、不影响奖励、不含数字 —— 与器铭、契语、道记同一条口径。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

describe("见过第二次 · 那一句怎么算", () => {
  it("第一次遇到时不出 —— 初遇没什么可想的", async () => {
    const { recallText } = await import("@/ui/eventRecall");
    expect(recallText(null, () => "某选项")).toBe("");
    expect(recallText({ times: 0, lastChoiceIdx: 0 }, () => "某选项")).toBe("");
  });

  it("第二次起出,且说得出这是第几次", async () => {
    const { recallText } = await import("@/ui/eventRecall");
    const text = recallText({ times: 2, lastChoiceIdx: 1 }, (_i) => "抱起灵狐就走");
    expect(text).toContain("第");
    expect(text).toContain("次");
    // 次数是"这一次"的序号:已经完成过 2 次,这次是第 3 次
    expect(text).toContain("三");
  });

  it("记得上次走的是哪一条", async () => {
    const { recallText } = await import("@/ui/eventRecall");
    const text = recallText({ times: 1, lastChoiceIdx: 2 }, (i) =>
      i === 2 ? "绕道而行" : "径直穿过",
    );
    expect(text).toContain("绕道而行");
  });

  it("上次的选择认不出来时,只说次数,不编一个选项名", async () => {
    const { recallText } = await import("@/ui/eventRecall");
    const text = recallText({ times: 3, lastChoiceIdx: 9 }, () => undefined);
    expect(text).toContain("次");
    expect(text, "不该出现「上一次走的是」这种半句").not.toContain("上一次");
  });

  it("坏值一律不出声 —— 不印「第 NaN 次」", async () => {
    const { recallText } = await import("@/ui/eventRecall");
    for (const bad of [
      { times: Number.NaN, lastChoiceIdx: 0 },
      { times: -1, lastChoiceIdx: 0 },
      { times: 2, lastChoiceIdx: Number.NaN },
    ]) {
      const text = recallText(bad, () => "某选项");
      expect(text, `${JSON.stringify(bad)} 印出来了`).not.toContain("NaN");
    }
  });
});

describe("见过第二次 · 只做措辞,不动别处", () => {
  it("不 import store,也不碰奖励与抽取", () => {
    const src = readSource("src/ui/eventRecall.ts")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(src).not.toMatch(/from ["']@\/stores\//);
    expect(src).not.toMatch(/from ["']@\/core\//);
  });

  it("真接线:事件弹窗读它,且有稳定落点", () => {
    const dlg = readSource("src/components/adventure/EventDialog.vue");
    expect(dlg, "该读这一句").toContain("recallText(");
    expect(dlg, "要有落点").toContain("data-event-recall");
  });
});
