/**
 * 历练预览的两句免责 —— 它们是这份预览的使用说明，不是装饰。
 *
 * ## 由来（第 300 轮）
 *
 * `AdventureView.vue` 出发前有一块预览（`data-adventure-preview`），
 * 列出各流派与此地的相性星级。而它夹着两句极要紧的话:
 *
 * ```html
 * <p>此地相性（机制契合度，<strong>并非胜率</strong>）：</p>
 * …
 * <p>战力 X · <strong>装备成色、词条与临场随机仍定成败</strong></p>
 * ```
 *
 * 没有这两句，那块星级就会被读成「我有几成把握」:
 *
 * ```text
 * 第一句防的是「星级 = 胜率」     —— 相性讲的是机制契合，与数值无关
 * 第二句防的是「战力高 = 稳赢」   —— 装备成色、词条、临场随机都在里面
 * ```
 *
 * 而两者都不是措辞问题:前者的失败是「按一个不该用于判断的数去判断」，
 * 后者的失败是「以为算得清，其实算不清」。
 *
 * ## 为什么需要判据
 *
 * ```text
 * 类型系统      模板里的一句话，管不到
 * 浏览器巡游    layout-check 与 ui-smoke 都不看文案内容
 * 既有判据      零（「并非胜率」全仓只有一处，就是它自己）
 * ```
 *
 * 这两句一旦被删，`preview.recs` 的星级还在、界面照样好看，**不会有任何门红**。
 *
 * ## 判据
 *
 * ① 预览块还在（`data-adventure-preview`）;
 * ② 「并非胜率」那句还在;
 * ③ 「仍定成败」那句还在，且点到了装备成色 / 词条 / 临场随机三样;
 * ④ 防空转:这块里确实有星级渲染（`starsText(`）。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

const SRC = readSource("src/views/AdventureView.vue");

/** 只取预览块那一段 —— 同一页别处也有 `starsText(` 调用。 */
function previewBlock(): string {
  const start = SRC.indexOf("data-adventure-preview");
  expect(start, "找不到历练预览块 —— 它被删了或被改名").toBeGreaterThan(0);
  // 块尾:从 start 往后找第一个 `</div>` 之后仍属本块的边界。
  // 用「下一处 data- 属性」作上界太脆，改用固定长度切片再断言内容。
  const end = SRC.indexOf("preview.recs", start);
  expect(end, "找不到 preview.recs —— 相性列表的写法变了").toBeGreaterThan(start);
  return SRC.slice(start, SRC.indexOf("</div>", end) + 6);
}

describe("历练预览 · 两句免责必须在", () => {
  it("预览块与星级渲染都还在（防空转）", () => {
    const block = previewBlock();
    expect(block.length, "预览块太短 —— 切片错位置了").toBeGreaterThan(300);
    expect(block, "这块里没有星级渲染 —— 找错地方了").toContain("starsText(");
  });

  it("「并非胜率」那句还在", () => {
    const block = previewBlock();
    expect(block, "「并非胜率」不见了 —— 星级会被读成「我有几成把握」:").toContain("并非胜率");
  });

  it("「仍定成败」那句还在，且点到了三样", () => {
    const block = previewBlock();
    expect(block, "「仍定成败」不见了 —— 玩家会以为这数算得清").toContain("仍定成败");
    const missing = ["装备成色", "词条", "临场随机"].filter((s) => !block.includes(s));
    expect(
      missing,
      "这句没有点全三样 —— 少一样，玩家就少知道一个变数:" + missing.join(" / "),
    ).toEqual([]);
  });
});
