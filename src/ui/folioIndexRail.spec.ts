import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { readStyleCss } from "@/test/readStyleCss";
import { chapterRailItems } from "./folioIndexRail";

const ROOT = resolve(__dirname, "../..");

function source(rel: string): string {
  if (rel === "src/style.css") return readStyleCss();
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("书口签 · 同卷诸册都能直接翻", () => {
  it("册口签只列当前一卷，当前册唯一，未知路由不臆造册目", () => {
    expect(chapterRailItems("souls").map((item) => item.key)).toEqual([
      "inventory",
      "collection",
      "souls",
    ]);
    expect(chapterRailItems("souls").map((item) => item.shortLabel)).toEqual([
      "行囊",
      "藏珍",
      "器魂",
    ]);
    expect(
      chapterRailItems("souls")
        .filter((item) => item.active)
        .map((item) => item.key),
    ).toEqual(["souls"]);
    expect(chapterRailItems("welcome")).toEqual([]);
  });

  it("顶栏只报当前位置，卷首保留同卷册签，跳转不再叠成第三层", () => {
    const component = source("src/components/common/FolioIndexRail.vue");
    const top = source("src/components/common/TopStatusBar.vue");
    const masthead = source("src/components/common/FolioPageHeader.vue");

    expect(component, "书口签要真的可跳转").toContain("<RouterLink");
    expect(component, "当前签要有读屏落点").toContain(":aria-current");
    expect(component, "读屏落点要用 location 语义").toContain("'location'");
    expect(component, "每枚签要有完整读屏名").toContain(":aria-label");
    expect(component, "书口签可容纳时要露出短册名").toContain("folio-index-rail__label");
    expect(top, "顶栏要有单一位置签").toContain("data-folio-position");
    expect(top, "顶栏位置已经收进书口带，不再另起第二行").not.toContain("data-folio-trail");
    expect(top, "顶栏不再挂五卷跳转").not.toContain("volumeRailItems");
    expect(top, "顶栏不再渲染第二排书口签").not.toContain("<FolioIndexRail");
    expect(masthead, "卷首册签读共享构造器").toContain("chapterRailItems");
    expect(masthead, "卷首要挂本卷册签").toContain('label="本卷册目"');
  });

  it("签条像书口而不是胶囊，195px 仍收得住且触达不缩水", () => {
    const css = source("src/style.css");

    expect(css).toContain(".folio-index-rail__tab");
    expect(css).toContain(".folio-index-rail__label");
    expect(css).toContain(".folio-index-rail__tab[data-folio-rail-current]");
    expect(css, "当前签只以朱砂落款").toMatch(
      /\.folio-index-rail__tab\[data-folio-rail-current\][\s\S]{0,500}?color:\s*rgb\(var\(--color-cinnabar-rgb\)\)/,
    );
    expect(css).toMatch(
      /@media \(max-width: 220px\)[\s\S]{0,500}?\.folio-index-rail__tab[\s\S]{0,180}?width: 1\.75rem;/,
    );
    expect(css, "书口签触达下限不得低于 28px").toMatch(
      /\.folio-index-rail__tab\s*\{[\s\S]{0,180}?min-width:\s*1\.75rem;[\s\S]{0,80}?min-height:\s*1\.75rem;/,
    );
    expect(css, "短册名在 390px 起才铺开").toMatch(
      /@media \(min-width: 390px\)[\s\S]{0,160}?\.folio-index-rail--chapter \.folio-index-rail__label/,
    );
  });
});
