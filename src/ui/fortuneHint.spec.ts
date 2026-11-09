/**
 * 机缘弹窗 · 把「为什么偏偏撞见这一件」说出来
 *
 * ## 缺口:一条已经生效的加权,玩家从头到尾看不见
 *
 * `core/eventEngine` 抽机缘牌时走的是:
 *
 * ```ts
 * weightMultiplier: (entry) => fortuneAffinity(entry.def.element, elements)
 * ```
 *
 * 也就是说**与灵根同源的机缘权重更高**(普根 2.5 / 特殊根 2.8 / 混沌 3.2)。
 * 这段代码有注释、有判据、在真实抽取里生效 —— 而玩家那一头,弹窗里连一个「同源」
 * 的字样都没有(实测:`EventDialog.vue` 里 `element` 出现 0 次)。
 *
 * 于是「灵根 → 机缘 → 师承 → 流派」这条因果链的起点是隐形的:玩家不知道
 * 这一次撞见与自己那副根有关,也就不会把灵根当成一回事。
 *
 * ## 措辞:是「更容易撞见」,不是「只有你能遇到」
 *
 * `affinityMult` 的注释写得很清楚:「注意是『更容易遇到』,不是『只有你能遇到』——
 * 无此灵根者权重仍为 1,路没有被关掉。」文案必须守住这一句,否则会变成
 * 「你这副根才配撞上」,那是另一套机制(门槛),而它不是。
 *
 * ## 只读同一个函数
 *
 * 是否同源一律读 `fortuneAffinity(...) > 1`(与抽取那条路同一个函数),
 * 不按元素去表里手比一遍 —— 比出来的那一份会在改权重时先分叉。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { fortuneAffinity } from "@/core/linggenAffinity";

const dlg = () => readSource("src/components/adventure/EventDialog.vue");

describe("机缘弹窗 · 同源那一句", () => {
  it("弹窗读 fortuneAffinity,不自己比元素", () => {
    const src = dlg();
    expect(src, "要读机缘亲和函数").toContain("fortuneAffinity(");
    expect(src, "要有稳定落点给判据与浏览器门").toContain("data-event-fortune-affinity");
  });

  it("同源判据与抽取同源 —— 倍率大于 1 才算", () => {
    /*
     * 直接验那个函数的口径,免得弹窗与引擎各写一份:
     * 同源给 > 1,非同源给 1(不是 0,不是罚)。
     */
    expect(fortuneAffinity("water", ["water"])).toBeGreaterThan(1);
    expect(fortuneAffinity("fire", ["water"])).toBe(1);
    expect(fortuneAffinity(undefined, ["water"])).toBe(1);
  });

  it("若弹窗不带 element,整句不出 —— 不许印一行空的", () => {
    const src = dlg();
    const at = src.indexOf("data-event-fortune-affinity");
    expect(at, "找不到那一格 —— 判据会空转").toBeGreaterThan(0);
    const near = src.slice(Math.max(0, at - 700), at + 700);
    // 必须有条件渲染(没有元素 / 不同源时不出)
    expect(near, "同源那一句要有条件,不许无条件印").toMatch(/v-if=/);
  });

  it("措辞守「更容易撞见」,不许写成门槛或独占", () => {
    const src = dlg();
    const at = src.indexOf("data-event-fortune-affinity");
    const near = src.slice(Math.max(0, at - 900), at + 1100).replace(/<!--[\s\S]*?-->/g, "");
    for (const banned of ["只有你", "独有", "才配", "专属机缘", "必定"]) {
      expect(near, `同源写成了门槛/独占(「${banned}」)—— 无此灵根者权重仍是 1`).not.toContain(
        banned,
      );
    }
    expect(near, "要说清是更容易撞见").toMatch(/更容易|权重/);
  });

  it("元素名后面接「系」,不许出现「与你金·属灵根」那种断错", () => {
    /*
     * 初版写的是 `与你{{ name }}属灵根同源`,渲染成「与你金属灵根同源」——
     * 「金」+「属灵根」会先断成「金·属灵根」,读起来像另一种东西。
     * 元素名后接「系」:金系灵根 / 水系灵根 / 雷系灵根,都不歧义。
     */
    const src = dlg();
    const at = src.indexOf("data-event-fortune-affinity");
    const near = src.slice(Math.max(0, at - 900), at + 1400).replace(/<!--[\s\S]*?-->/g, "");
    expect(near, "元素名后要接「系」").toMatch(/\}\}\s*系灵根|\}\}系/);
    expect(near, "不许写成「与你 X 属灵根」").not.toMatch(/\}\}\s*属灵根/);
  });

  it("倍率走 multText —— 与人物页、功法章同一套写法", () => {
    const src = dlg();
    expect(src, "倍率要用 multText").toContain("multText");
  });
});
