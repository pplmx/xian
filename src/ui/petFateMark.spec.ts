/**
 * 灵兽谱 · 按命途聚的界面判据 —— 排序与标记两头都要钉住。
 *
 * ## 缺口(接 core/petFateOrder)
 *
 * `core/petFateOrder` 是纯排序:同种走法的灵兽聚在一起。但排序只有在界面**真的调它**
 * 时才生效 —— 一个写好了却没被引用的模块,谱上照旧按品阶打散。此处的判据守三件:
 *
 *   一 视图确实用 `orderPetsByFate` 排灵兽谱(而不是还在手写 sort);
 *   二 每行盖一枚「命途印」(`data-pet-fate-mark`),让「这一段是哪一种走法」可扫;
 *   三 命途印走数据层的性格名(`personalityName`),不在这里另拼第二份名字表。
 *
 * 「相伴置顶」这一条由 core 用例直接测排序结果,这里不重复量数据,只量接线。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

describe("灵兽谱 · 按命途聚的界面接线", () => {
  it("视图用共享的 orderPetsByFate 排灵兽谱", () => {
    const view = readSource("src/views/TitlesView.vue");
    expect(view, "要导入 core/petFateOrder 的排序函数").toContain(
      'import { orderPetsByFate } from "@/core/petFateOrder"',
    );
    expect(view, "分页窗口要读排好序的列表,不能读原始 petRows").toContain("petRowsOrdered");
  });

  it("每行盖一枚命途印,并带稳定落点供真浏览器复核", () => {
    const view = readSource("src/views/TitlesView.vue");
    expect(view, "命途印要有落点").toContain("data-pet-fate-mark");
    expect(view, "命途印要读数据层的性格名").toContain("row.personalityName");
  });

  it("行上带 data-fate,但只在已结缘那一档带 —— 未逢的是「???」,不替它认命途", () => {
    const view = readSource("src/views/TitlesView.vue");
    expect(view, "行上要带 data-fate").toContain(':data-fate="row.owned ? row.personality : null"');
  });

  it("卷首提示要报全四根排序键 —— 排序变了,提示不许还是旧的", () => {
    const view = readSource("src/views/TitlesView.vue");
    expect(view, "卷首提示未跟上新排序").toContain("按命途聚");
    expect(view, "卷首提示要报出「已契在前」这根排序键").toContain("已契在前");
    expect(view, "卷首提示要报出品阶键").toContain("品阶降序");
    expect(view, "旧提示「已契次之」应该退休").not.toContain("已契次之");
  });

  it("深浅刻度只有一个出处 —— 视图递 PET_ENTRY_DEPTH,不手写一份数字", () => {
    const desk = readSource("src/ui/titlesDesk.ts");
    // 刻度四档齐备,且与 petEntryState 那四个 state 同名(否则视图取不到值)
    for (const state of ["locked", "owned", "companion", "active"]) {
      expect(desk, `PET_ENTRY_DEPTH 少了 ${state} 这一档`).toMatch(new RegExp(`${state}:\\s*\\d`));
    }
    const view = readSource("src/views/TitlesView.vue");
    expect(view, "depthRank 要引共享刻度,不在视图里另写 0/1/2/3").toContain(
      "depthRank: PET_ENTRY_DEPTH[",
    );
  });
});
