/**
 * 九佩的品阶角章 —— 行囊主页那九张席位卡,也该有形状线索。
 *
 * ## 缺口:同一套装备,主视图没有角章,候选弹窗却有
 *
 * `ui/qualityTier` 写死了规矩:「稀有档另有 QualitySeal 角章作形状线索 ——
 * 色弱玩家不靠颜色也能分档」。库里各处都照做了,连**同一套装备**的另一处也照做了:
 *
 *   `SlotCandidatesDialog`(点开某一席看的候选清单)—— 天/仙/神 盖角章 ✓
 *   `InventoryView` 的九佩席位卡(主页那九张)        —— 只有名字的字色   ✗
 *
 * 于是玩家在主页扫这九张卡时,分不出哪一张是天品;点开候选清单才看得到章。
 * 同一件装备,在两处长得不一样。
 *
 * ## 为什么主页那九张更要紧
 *
 * 候选清单是「换装时」才打开的;九佩是**每局都在眼前**的那一屏 ——
 * 而且九张并排,颜色相近的邻格挨得最近(良品 jade 与精品 qing 同属青绿系)。
 * 颜色是顺序标尺、章是离散标记;九宫格里尤其需要后者。
 *
 * ## 本轮只补这一处
 *
 * 直接用现成的 `QualitySeal`,判定走共享的 `isRareQuality` —— 不新造记号、
 * 不另立阈值。位置沿用其他名册的规矩:贴在名字前,`shrink-0`。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

describe("九佩角章 · 与其余名册同一枚", () => {
  it("行囊主页导入了共享的品阶角章与稀有判定", () => {
    const view = readSource("src/views/InventoryView.vue");
    expect(view, "要导入 QualitySeal").toContain(
      'import QualitySeal from "@/components/common/QualitySeal.vue"',
    );
    expect(view, "稀有判定要与其余各册同源").toContain("isRareQuality(");
  });

  it("九佩席位卡上真有那一枚,并有稳定落点", () => {
    const view = readSource("src/views/InventoryView.vue");
    const at = view.indexOf("inventory-seat__piece-name");
    expect(at, "席位卡的名字段要还在").toBeGreaterThan(0);
    // 章必须落在席位卡那一块里(不是别处顺手加了一枚)
    const cardStart = view.lastIndexOf('data-equip-slot="row.slot"', at);
    const block = view.slice(Math.max(0, cardStart), at + 400);
    expect(block, "席位卡上要盖品阶章").toContain("<QualitySeal");
    expect(block, "章要带稳定落点").toContain("data-inventory-seat-seal");
  });

  it("不许自己手写 rank 阈值 —— 界在哪一档只由 qualityTier 一处决定", () => {
    const view = readSource("src/views/InventoryView.vue");
    expect(view).not.toMatch(/rank\s*>=\s*6/);
  });

  it("候选弹窗那一处保持原样 —— 本次只补主视图", () => {
    const dialog = readSource("src/components/inventory/SlotCandidatesDialog.vue");
    expect(dialog, "候选清单本来就有角章").toContain("<QualitySeal");
    expect(dialog).toContain("isRareQuality(");
  });
});

describe("九佩角章 · 只在稀有档出现", () => {
  it("判定走 qualityTier 的共享谓词,不另写一份", () => {
    const view = readSource("src/views/InventoryView.vue");
    // 章必须挂在 isRareQuality 的条件上(v-if),否则人人有章
    const at = view.indexOf("data-inventory-seat-seal");
    expect(at).toBeGreaterThan(0);
    const block = view.slice(Math.max(0, at - 400), at);
    expect(block, "章的显隐要由 isRareQuality 决定").toContain("isRareQuality");
  });
});
