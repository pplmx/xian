import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { readStyleCss } from "@/test/readStyleCss";
import { chapterRailItems, volumeRailItems } from "./folioIndexRail";

const ROOT = resolve(__dirname, "../..");

function source(rel: string): string {
  if (rel === "src/style.css") return readStyleCss();
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("书口签 · 五卷与同卷诸册都能直接翻", () => {
  it("五卷签读全站目录，当前卷留落点，各卷落到首册", () => {
    const items = volumeRailItems("souls");

    expect(items.map((item) => item.mark)).toEqual(["修", "道", "行", "身", "天"]);
    expect(items.filter((item) => item.active).map((item) => item.key)).toEqual(["belongings"]);
    expect(items.map((item) => item.to)).toEqual([
      "/",
      "/dongfu",
      "/adventure",
      "/inventory",
      "/celestial",
    ]);
  });

  it("册口签只列当前一卷，当前册唯一，未知路由不臆造册目", () => {
    expect(chapterRailItems("souls").map((item) => item.key)).toEqual([
      "inventory",
      "collection",
      "souls",
    ]);
    expect(
      chapterRailItems("souls")
        .filter((item) => item.active)
        .map((item) => item.key),
    ).toEqual(["souls"]);
    expect(chapterRailItems("welcome")).toEqual([]);
  });

  it("顶栏与卷首共用同一枚书口签，不各抄一份册目", () => {
    const component = source("src/components/common/FolioIndexRail.vue");
    const top = source("src/components/common/TopStatusBar.vue");
    const masthead = source("src/components/common/FolioPageHeader.vue");

    expect(component, "书口签要真的可跳转").toContain("<RouterLink");
    expect(component, "当前签要有读屏落点").toContain(":aria-current");
    expect(component, "读屏落点要用 location 语义").toContain("'location'");
    expect(component, "每枚签要有完整读屏名").toContain(":aria-label");
    expect(top, "顶栏五卷签读共享构造器").toContain("volumeRailItems");
    expect(top, "顶栏要挂五卷签").toContain('kind="volume"');
    expect(masthead, "卷首册签读共享构造器").toContain("chapterRailItems");
    expect(masthead, "卷首要挂本卷册签").toContain('label="本卷册目"');
  });

  it("签条像书口而不是胶囊，195px 仍收得住", () => {
    const css = source("src/style.css");

    expect(css).toContain(".folio-index-rail__tab");
    expect(css).toContain(".folio-index-rail__tab[data-folio-rail-current]");
    expect(css, "当前签只以朱砂落款").toMatch(
      /\.folio-index-rail__tab\[data-folio-rail-current\][\s\S]{0,500}?color:\s*rgb\(var\(--color-cinnabar-rgb\)\)/,
    );
    expect(css).toMatch(
      /@media \(max-width: 220px\)[\s\S]{0,500}?\.folio-index-rail__tab[\s\S]{0,180}?width: 1\.25rem;/,
    );
  });
});
