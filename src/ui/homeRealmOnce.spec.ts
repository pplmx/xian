/**
 * 首页首屏 —— 「真仙·四层」不该在一屏里说两遍。
 *
 * ## 复现
 *
 * 首页首屏有两处报同一个境界名:
 *
 * ```text
 * 右上角  真仙·四层                       ← 卷首 meta(@78)
 * 法球下  修为 0%  真仙·四层              ← 修为读数(@259)
 * ```
 *
 * 两处都在首屏、都完整、都同源(`player.realmName`)。而本仓有一条明确的纪律
 * (见 `docs/design.md` 的卷首瘦身一节,以及「同一屏把同一句说了两遍」那组判据):
 * 同一个读数不该在同一眼里出现两次。
 *
 * ## 这一处该留哪一个
 *
 * **留法球下那一处。** 理由:
 *
 *   · 右上角那处(装饰性境界抬头)是**装饰性抬头** —— 它旁边的「玄枢 · 洞府 /
 *     仙界」已经交代了所在世界,境界名只是重复一次身份;
 *   · 法球下那处是**读数的一部分** —— 它紧挨「修为 0%」,而那个百分比脱离境界就
 *     没有意义(0% 的什么?哪一境的 0%?)。两者是一句话,拆不开。
 *
 * ## 判据守什么
 *
 * 一条:首屏不许两处渲染 `player.realmName`。
 *
 * 不钉具体改哪一处(版式归版式),只钉「两处都在首屏」这件事本身 ——
 * 保留法球那一处是这一轮的取舍,若将来换个做法(比如把境界名挪进法球内部
 * 作为图形的一部分),只要首屏仍只有一处就仍然合规。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

const HOME = "src/views/HomeView.vue";

describe("首页首屏 · 境界名只说一遍", () => {
  it("首屏不许两处渲染 realmName", () => {
    const src = readSource(HOME);
    /*
     * 数的是**模板里的渲染点**(`{{ player.realmName }}` 或绑定),
     * 不是注释里提到这个词。故先剔除注释。
     */
    const tpl = src.slice(0, src.indexOf("<script")).replace(/<!--[\s\S]*?-->/g, "");
    const hits = (tpl.match(/player\.realmName/g) ?? []).length;
    expect(
      hits,
      `首页首屏渲染了 ${hits} 次 realmName —— 「真仙·四层」在右上角与法球下各一次,同一眼里说两遍`,
    ).toBeLessThanOrEqual(1);
  });

  it("留下的那处在法球读数里(与修为百分比同一句)", () => {
    /*
     * 境界名该与「修为 X%」绑在一起 —— 百分比脱离境界没有意义。
     * 这一条防的是「删对了次数、删错了位置」:把法球那一处删掉、
     * 留右上角那个装饰性抬头,虽然也满足第一条,却让读数失去语境。
     */
    const src = readSource(HOME);
    const caption = src.match(/home-deck__orb-caption[\s\S]{0,400}/)?.[0] ?? "";
    expect(caption, "定位不到修为读数那一块 —— 判据会空转").not.toBe("");
    expect(caption, "修为百分比旁边的境界名要留着").toContain("player.realmName");
  });

  it("反空转:修行状态仍然报得出来", () => {
    const src = readSource(HOME);
    expect(src, "「修炼中」那类状态不许一起删掉").toMatch(/修炼中|修行|statusText/);
  });
});
