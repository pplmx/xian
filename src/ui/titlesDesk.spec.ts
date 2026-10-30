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

describe("名兽案 · 名号与灵兽各成一册,卷首先报此刻", () => {
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

  it("卷首走双印谱,两册总案先摊当前与来路,清单仍只循环当前窗口", () => {
    const view = source("src/views/TitlesView.vue");
    const atlas = source("src/components/common/NameBeastAtlas.vue");

    expect(view, "名号页进入 featured 开卷版式").toMatch(
      /<FolioPageHeader[\s\S]{0,360}\bfeatured\b/,
    );
    expect(view, "卷首主视觉读同一份佩印与灵契").toMatch(
      /<template #visual>[\s\S]{0,220}<NameBeastAtlas/,
    );
    expect(view).toContain("nameBeastMeter(ownedCount.value, TITLES.length)");
    expect(view).toContain("nameBeastMeter(ownedPetCount.value, PETS.length)");
    expect(view).toContain("titleEntryState({ owned, worn })");
    expect(view).toContain("petEntryState({ owned, active })");
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
    expect(atlas, "双印谱是重复信息的视觉摘要,不重复进入读屏").toContain('aria-hidden="true"');
  });

  it("手机单列、620 起当前与来路并读,220 以下动作退整行", () => {
    const css = source("src/style.css");
    const start = css.indexOf("/*\n   * 名兽案");
    const end = css.indexOf("/*\n   * 道躯案", start);
    const titleCss = css.slice(start, end);

    expect(start, "名兽样式段要能定位到").toBeGreaterThan(-1);
    expect(end, "名兽样式段要有明确结尾").toBeGreaterThan(start);
    expect(titleCss).toMatch(
      /\.name-beast-ledger__grid\s*\{[\s\S]{0,160}grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
    expect(titleCss).toMatch(
      /@media \(min-width: 620px\)\s*\{[\s\S]{0,260}\.name-beast-ledger__grid\s*\{[\s\S]{0,120}repeat\(2, minmax\(0, 1fr\)\)/,
    );
    expect(titleCss).toMatch(
      /@media \(max-width: 220px\)\s*\{[\s\S]{0,1800}\.name-beast-ledger__grid\s*\{[\s\S]{0,100}minmax\(0, 1fr\)/,
    );
    expect(titleCss).toMatch(
      /@media \(max-width: 220px\)\s*\{[\s\S]{0,2400}\.name-ledger__action,[\s\S]{0,120}width:\s*100%/,
    );
  });
});
