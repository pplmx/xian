import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { nameBeastMeter, petEntryState, titleEntryState } from "./titlesDesk";
import { readStyleCss } from "@/test/readStyleCss";

const ROOT = resolve(__dirname, "../..");

function source(rel: string): string {
  if (rel === "src/style.css") return readStyleCss();
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("名兽案 · 双契总览直接接卷首,当前、可追与全谱各归一处", () => {
  it("两册进度只做同一把尺:夹取坏数、全收才圆满", () => {
    expect(nameBeastMeter(0, 0)).toEqual({
      owned: 0,
      total: 0,
      ratio: 0,
      complete: false,
    });
    expect(nameBeastMeter(3, 10)).toEqual({
      owned: 3,
      total: 10,
      ratio: 0.3,
      complete: false,
    });
    expect(nameBeastMeter(12, 10)).toEqual({
      owned: 10,
      total: 10,
      ratio: 1,
      complete: true,
    });
    expect(nameBeastMeter(-3, 10).owned).toBe(0);
    expect(nameBeastMeter(3.9, 10.9).owned).toBe(3);
    expect(nameBeastMeter(Number.NaN, Number.POSITIVE_INFINITY)).toEqual({
      owned: 0,
      total: 0,
      ratio: 0,
      complete: false,
    });
  });

  it("名号与灵兽的行态分开命名,当前选择永远压过收藏态", () => {
    expect(titleEntryState({ owned: false, worn: false })).toEqual({
      state: "locked",
      mark: "未",
      label: "未获得",
    });
    expect(titleEntryState({ owned: true, worn: false })).toEqual({
      state: "owned",
      mark: "藏",
      label: "已收藏",
    });
    expect(titleEntryState({ owned: true, worn: true })).toEqual({
      state: "active",
      mark: "佩",
      label: "佩戴中",
    });

    expect(petEntryState({ owned: false, active: false })).toEqual({
      state: "locked",
      mark: "未",
      label: "未结缘",
    });
    expect(petEntryState({ owned: true, active: false })).toEqual({
      state: "owned",
      mark: "契",
      label: "已结缘",
    });
    expect(petEntryState({ owned: true, active: true })).toEqual({
      state: "active",
      mark: "伴",
      label: "相伴中",
    });
  });

  it("卷首后直接接可读双契总览,不再用页签和重复主视觉占两层", () => {
    const view = source("src/views/TitlesView.vue");
    const switcher = source("src/components/common/NameBeastSwitch.vue");

    expect(view, "名号页进入 featured 开卷版式").toMatch(
      /<FolioPageHeader[\s\S]{0,360}\bfeatured\b/,
    );
    expect(view, "卷首不再塞一块会重复报数的纯装饰主视觉").not.toContain("<template #visual>");
    expect(view, "独立页签退场，双契总览本身承担切册").not.toContain("<InkTabs");
    expect(view, "双契总览紧随卷首，并继续驱动同一条路由页签").toMatch(
      /<FolioPageHeader[\s\S]{0,900}<NameBeastSwitch[\s\S]{0,240}v-model="tab"/,
    );
    expect(view).toContain(':choices="nameBeastChoices"');
    expect(view).toContain("nameBeastMeter(ownedCount.value, TITLES.length)");
    expect(view).toContain("nameBeastMeter(ownedPetCount.value, PETS.length)");
    expect(view).toContain("titleEntryState({ owned, worn })");
    expect(view).toContain("petEntryState({ owned, active })");
    expect(switcher, "双契总览要真的是两个可键盘漫游的页签").toContain('role="tablist"');
    expect(switcher).toContain('role="tab"');
    expect(switcher).toContain(':aria-selected="model === choice.id"');
    expect(switcher).toContain("data-name-beast-tab");
    expect(switcher).toContain("ArrowRight");
    expect(switcher).toContain("ArrowLeft");
    expect(switcher).toContain("Home");
    expect(switcher).toContain("End");
    expect(switcher).toContain(':aria-controls="`${choice.id}-panel`"');
    expect(view).toContain('id="title-panel"');
    expect(view).toContain('id="pet-panel"');
    expect(view).toContain('aria-labelledby="title-tab"');
    expect(view).toContain('aria-labelledby="pet-tab"');
    expect(switcher, "总览里的当前名、计数与下一步要直接进入读屏").toContain(
      "{{ choice.currentName }}",
    );
    expect(switcher).toContain("{{ choice.count }}/{{ choice.total }}");
    expect(switcher).toContain("{{ choice.note }}");
    expect(view).toContain("data-title-ledger");
    expect(view).toContain("data-pet-ledger");
    expect(view).toContain("data-title-current");
    expect(view).toContain("data-pet-current");
    expect(view).toContain("data-title-guide");
    expect(view).toContain("此刻佩印");
    expect(view).toContain("此刻相伴");
    expect(view).toContain("结缘册");
    expect(view).toContain('v-for="row in titlePage.visible"');
    expect(view).toContain('v-for="row in petPage.visible"');
    expect(view, "名号谱与灵兽谱继续只循环当前窗口").not.toContain('v-for="row in titleRows"');
  });

  it("双契总览、此刻与全谱并回连续纸面,不再一页套三层边框", () => {
    const view = source("src/views/TitlesView.vue");
    const switcher = source("src/components/common/NameBeastSwitch.vue");
    const css = source("src/style.css");
    const start = css.indexOf("/*\n   * 名兽案");
    const end = css.indexOf("/*\n   * 道躯案", start);
    const titleCss = css.slice(start, end);

    expect(view).toContain("data-name-beast-focus");
    expect(view).toContain("data-name-beast-book");
    expect(view, "此刻与下一印要有纸面边栏索引").toContain("name-beast-focus__index");
    expect(switcher, "双契总览也要落册次索引").toContain("name-beast-switch__ordinal");
    expect(titleCss, "总览是一条纸面索引,不是两张卡").toMatch(
      /\.name-beast-switch\s*\{[\s\S]{0,260}border-top:\s*1px solid/,
    );
    expect(titleCss).toMatch(
      /\.name-beast-switch__tab\s*\{[\s\S]{0,320}border:\s*0;[\s\S]{0,320}border-radius:\s*0;[\s\S]{0,320}background:\s*transparent;/,
    );
    expect(titleCss, "名谱本身不再画第二道外框").toMatch(
      /\.name-beast-ledger\s*\{[\s\S]{0,360}border:\s*0;[\s\S]{0,360}border-radius:\s*0;[\s\S]{0,360}box-shadow:\s*none;/,
    );
    expect(titleCss).toMatch(/\.name-beast-ledger::before\s*\{[\s\S]{0,80}display:\s*none;/);
    expect(titleCss, "桌面双页由中缝收口,不靠两张卡分隔").toMatch(
      /@media \(min-width: 960px\)[\s\S]{0,900}\.name-beast-tab > \.name-beast-focus\s*\{[\s\S]{0,180}border-right:\s*1px solid/,
    );
    expect(titleCss).not.toMatch(
      /\.name-beast-ledger\s*\{[\s\S]{0,360}border:\s*1px solid rgb\(var\(--color-ink-rgb\) \/ 0\.14\)/,
    );
  });

  it("名号与灵兽各收成一册两章,章首同报章号、读法与章内真值", () => {
    const view = source("src/views/TitlesView.vue");
    const head = source("src/components/common/FolioChapterHead.vue");
    const titleCss = source("src/styles/pages/titles.css");

    expect(view).toContain(
      '<article class="name-beast-register folio-span-all" data-name-beast-register>',
    );
    expect(view).toContain('data-name-beast-chapter="focus"');
    expect(view).toContain('data-name-beast-chapter="index"');
    expect(view).toContain("<FolioChapterHead");
    expect(view).toContain('index="壹"');
    expect(view).toContain('index="贰"');
    expect(view, "章首接管标题后旧总账头应退场").not.toContain("<LedgerHeader");
    expect(head).toContain("data-folio-chapter-head");
    expect(head).toContain("folio-chapter-head__index");
    expect(head).toContain("folio-chapter-head__hint");
    expect(head).toContain("folio-chapter-head__fact");
    expect(titleCss).toMatch(
      /\.name-beast-register\s*\{[\s\S]{0,320}border-top:\s*1px solid[\s\S]{0,160}border-bottom:\s*1px solid/,
    );
    expect(titleCss).toMatch(
      /\.name-beast-register__chapter \+ \.name-beast-register__chapter\s*\{[\s\S]{0,100}border-top:/,
    );
    expect(titleCss).toMatch(
      /@media \(min-width: 960px\)\s*\{[\s\S]{0,700}\.name-beast-tab\s*\{[\s\S]{0,180}grid-template-columns:\s*minmax\(18rem, 0\.74fr\) minmax\(0, 1\.26fr\)/,
    );
  });

  it("390 双契并读、小屏退回单册、620 聚焦双栏、960 总览与全谱摊成两页", () => {
    const css = source("src/style.css");
    const start = css.indexOf("/*\n   * 名兽案");
    const end = css.indexOf("/*\n   * 道躯案", start);
    const titleCss = css.slice(start, end);

    expect(start, "名兽样式段要能定位到").toBeGreaterThan(-1);
    expect(end, "名兽样式段要有明确结尾").toBeGreaterThan(start);
    expect(titleCss).toMatch(
      /\.name-beast-switch__grid\s*\{[\s\S]{0,180}grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/,
    );
    expect(titleCss, "320 仍把双契并排,只收掉册次与长注").toMatch(
      /@media \(max-width: 359px\)\s*\{[\s\S]{0,900}\.name-beast-switch__note\s*\{[\s\S]{0,80}display:\s*none/,
    );
    expect(titleCss, "窄于 280 才退回单册").toMatch(
      /@media \(max-width: 279px\)\s*\{[\s\S]{0,180}\.name-beast-switch__grid\s*\{[\s\S]{0,100}minmax\(0, 1fr\)/,
    );
    expect(titleCss).toMatch(
      /\.name-beast-focus__panels\s*\{[\s\S]{0,180}grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
    expect(titleCss).toMatch(
      /@media \(min-width: 620px\)\s*\{[\s\S]{0,260}\.name-beast-focus__panels\s*\{[\s\S]{0,120}repeat\(2, minmax\(0, 1fr\)\)/,
    );
    expect(titleCss).toMatch(
      /@media \(min-width: 960px\)\s*\{[\s\S]{0,360}\.name-beast-tab\s*\{[\s\S]{0,180}grid-template-columns:\s*minmax\(18rem, 0\.74fr\) minmax\(0, 1\.26fr\)/,
    );
    expect(titleCss).toMatch(
      /@media \(min-width: 960px\)\s*\{[\s\S]{0,700}\.name-beast-tab\s*>\s*\.name-beast-focus \.name-beast-focus__panels\s*\{[\s\S]{0,120}minmax\(0, 1fr\)/,
    );
    expect(titleCss).toMatch(
      /@media \(max-width: 220px\)\s*\{[\s\S]{0,700}\.name-beast-switch__grid\s*\{[\s\S]{0,100}minmax\(0, 1fr\)/,
    );
    expect(titleCss).toMatch(
      /@media \(max-width: 220px\)\s*\{[\s\S]{0,2400}\.name-ledger__action,[\s\S]{0,120}width:\s*100%/,
    );
  });
});
