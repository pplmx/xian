/**
 * 际遇选项的花费提示 —— 石头是梯度放缩的,手写的「需要灵石」从来不说要多少。
 *
 * 此前 EventDialog 直接把 choice.hint 渲染上屏:买妖丹写「需要较多灵石」,玩家
 * 按标签算账,真到掷骰掏钱才发现是梯度价。choiceHintText 按当前档位把花费
 * 现算出来 —— 同一花费报一个数,竞拍高低价报区间;若弹窗某个选项「可能」不
 * 掏钱(结算有免费出路),写「可能花费」不给玩家承诺。
 *
 * 这里守:①三种形状(单数 / 区间 / 可能)都由 xian 数据表的事件现算;②弹窗
 * 必须读 choiceHintText,不许再把 choice.hint 原样放上去(它含「需要灵石」,
 * 但从不含数字)。
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { EVENTS } from "@/data/events";
import { stoneByTier } from "@/core/formulas";
import { formatGN } from "@/utils/format";
import { choiceHintText } from "./eventText";

describe("choiceHintText", () => {
  it("同一花费只报一个数,竞拍那种高低价报区间", () => {
    const merchant = EVENTS.find((e) => e.id === "ev_merchant")!;
    const buy = merchant.choices[0]!;
    const text = choiceHintText(buy, 3);
    expect(text).toBe(`花费灵石 ${formatGN(stoneByTier(3, 30))}`);
    expect(text).not.toContain("需要灵石");

    const auction = EVENTS.find((e) => e.id === "ev_yaodan_auction")!;
    const bid = auction.choices[0]!;
    const bidText = choiceHintText(bid, 4);
    expect(bidText).toContain(formatGN(stoneByTier(4, 60)));
    expect(bidText).toContain(formatGN(stoneByTier(4, 80)));
    expect(bidText.startsWith("花费灵石")).toBe(true);

    const tea = EVENTS.find((e) => e.id === "ev_border_stall")!;
    const pay = tea.choices.find((c) => c.cond?.type === "stone")!;
    expect(choiceHintText(pay, 2)).toContain("可能花费灵石");
  });

  it("际遇弹窗用算出来的提示,不再直接渲染手写 hint", () => {
    const src = readFileSync(resolve(__dirname, "../components/adventure/EventDialog.vue"), "utf8");
    expect(src).toContain("choiceHintText(choice, tier)");
    expect(src).not.toContain("choice.hint");
  });
});
