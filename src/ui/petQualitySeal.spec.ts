/**
 * 灵兽谱的形状线索 —— 高档那几只,不能只靠颜色分。
 *
 * ## 缺口:四份名册里,只有灵兽谱没有那枚角章
 *
 * `ui/qualityTier` 的注释把规矩写死了:
 *
 *   > 稀有档另有 QualitySeal 角章作形状线索 —— 色弱玩家不靠颜色也能分档。
 *
 * 各处也确实都照做了:装备格(`ItemCell`)、功法书目(`GongfaSection`)、法宝行卡
 * (`ArtifactPanel`)、候选件、坊市货架 —— 天品起都盖一枚阴文小章。
 *
 * 唯独**灵兽谱**没有:四十只并排,高档那十一只与精品那五只的区别,只剩名字的字色。
 * 而灵兽谱恰恰是最该有的一处 —— 它是唯一一张**全部排在一起**的长名册
 * (四十只同屏滚动),颜色相近的邻行挨得最近。
 *
 * ## 为什么必须是形状,不能只加深颜色
 *
 * 良品(jade)与精品(qing)同属青绿系,纸面上几乎难分(见 QualitySeal 的注释);
 * 色弱玩家更是一条色带都读不出档。颜色是**顺序标尺**,章是**离散标记** ——
 * 前者要比较,后者扫一眼就有。两者并存,才既排得开也认得出。
 *
 * ## 本轮只补这一处,不新造记号
 *
 * 直接用现成的 `QualitySeal`(纸底 + 品阶色字 + 细边),位置与功法书目那一枚同款
 * (名字前、`shrink-0`)。不新增组件、不新增样式类 —— 有新记号就有第二套语言。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

describe("灵兽谱的形状线索 · 与其余四份名册同一枚章", () => {
  it("灵兽谱导入了共享的品阶角章", () => {
    const view = readSource("src/views/TitlesView.vue");
    expect(view, "要导入共享的 QualitySeal").toContain(
      'import QualitySeal from "@/components/common/QualitySeal.vue"',
    );
  });

  it("角章只在天品以上出现 —— 人人有章等于人人无章", () => {
    const view = readSource("src/views/TitlesView.vue");
    // 判定必须走共享的 isRareQuality,而不是自己写 rank >= 6 的第二本账
    expect(view, "稀有档判定要与其余各册同源").toContain("isRareQuality(");
  });

  it("逐行与相伴面板都盖 —— 两处都在讲「这是哪一档」", () => {
    const view = readSource("src/views/TitlesView.vue");
    const seals = view.match(/<QualitySeal\b/g) ?? [];
    expect(seals.length, "灵兽的两处该各有一枚章").toBeGreaterThanOrEqual(2);
  });

  it("角章带稳定落点,供真浏览器复核", () => {
    const view = readSource("src/views/TitlesView.vue");
    expect(view, "逐行那枚要有落点").toContain("data-pet-quality-seal");
  });
});

describe("灵兽谱的形状线索 · 口径不许写第二份", () => {
  it("不应自己手写 rank 阈值 —— 界在哪一档由 qualityTier 一处决定", () => {
    const view = readSource("src/views/TitlesView.vue");
    // 允许 qualityDef(...).rank 用于排序;但不许拿它当"是否稀有"的判定
    expect(view, "稀有档判定要复用共享谓词").not.toMatch(/rank\s*>=\s*6/);
  });
});
