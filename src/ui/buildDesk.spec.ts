import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { BUILD_STYLES, buildAffinityRows } from "@/core/buildDetect";
import { buildCoreGaps, buildStageMeter } from "./buildDesk";
import { readStyleCss } from "@/test/readStyleCss";

const ROOT = resolve(__dirname, "../..");

function source(rel: string): string {
  if (rel === "src/style.css") return readStyleCss();
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("铸道案 · 六路、形状与下一步同读此刻", () => {
  it("契合按雏形 / 成形 / 大成三段推进，坏数归零、顶阶走满", () => {
    expect(buildStageMeter(0.1)).toMatchObject({
      stage: "未成",
      floor: 0,
      ceiling: 0.25,
      gap: 0.15,
    });
    expect(buildStageMeter(0.4)).toMatchObject({
      stage: "雏形",
      floor: 0.25,
      ceiling: 0.6,
    });
    expect(buildStageMeter(0.4).ratio).toBeCloseTo(0.15 / 0.35);
    expect(buildStageMeter(0.4).gap).toBeCloseTo(0.2);
    expect(buildStageMeter(0.75)).toMatchObject({
      stage: "成形",
      floor: 0.6,
      ceiling: 0.9,
      ratio: 0.5,
    });
    expect(buildStageMeter(0.75).gap).toBeCloseTo(0.15);
    expect(buildStageMeter(0.95)).toEqual({
      stage: "大成",
      floor: 0.9,
      ceiling: null,
      ratio: 1,
      gap: 0,
    });
    expect(buildStageMeter(Number.NaN)).toMatchObject({ stage: "未成", ratio: 0, gap: 0.25 });
  });

  it("下一步只取真实核心词条缺口，贡献越低越先补", () => {
    const row = buildAffinityRows({
      lowHpDamage: 0.5,
      lowHpReduction: 0.1,
      shieldOnStart: 0.1,
    }).find((candidate) => candidate.style.id === "beishui")!;
    const gaps = buildCoreGaps(row);

    expect(gaps[0]).toMatchObject({ key: "lowHpReduction", value: 0.1 });
    expect(gaps[0]!.gap).toBeCloseTo(0.2);
    expect(gaps).toHaveLength(1);
    expect(gaps.every((term) => term.reference > 0)).toBe(true);
  });

  it("成路后收成一册铸道续卷，阶梯、下一步、形状、实战、快照与旧筑各有章位", () => {
    const view = source("src/views/BuildView.vue");
    const atlas = source("src/components/build/BuildAtlas.vue");
    const chapterHead = source("src/components/build/BuildChapterHead.vue");
    const layout = source("scripts/layout-check.mjs");
    const stageAt = view.indexOf("data-build-stage");
    const nextAt = view.indexOf("data-build-next");
    const shapeAt = view.indexOf("data-build-shape");

    expect(view).toMatch(/<FolioPageHeader[\s\S]{0,520}\bfeatured\b/);
    expect(view).toMatch(/<template #visual>[\s\S]{0,220}<BuildAtlas/);
    expect(view).toContain("buildStageMeter(");
    expect(view).toContain("buildCoreGaps(");
    expect(view).toContain("data-build-current");
    expect(view).toContain("data-build-formed");
    expect(view).toContain("data-build-register");
    expect(view).toContain("<BuildChapterHead");
    expect(view).toContain("data-build-stage");
    expect(view).toContain("data-build-shape");
    expect(view).toContain("data-build-next");
    expect(view).toContain("data-build-battle");
    expect(view).toContain("data-build-loadouts");
    expect(view).toContain("data-build-compare");
    expect(view).toContain("data-compare-candidate");
    expect(view).toContain("data-compare-result");
    expect(atlas).toContain("data-build-atlas");
    expect(atlas).toContain('aria-hidden="true"');
    expect(stageAt, "道途阶梯要能定位").toBeGreaterThan(-1);
    expect(nextAt, "下一步要能定位").toBeGreaterThan(-1);
    expect(shapeAt, "五维形状要能定位").toBeGreaterThan(-1);
    expect(stageAt, "手机先读当前阶段").toBeLessThan(nextAt);
    expect(nextAt, "下一步要排在五维展开之前").toBeLessThan(shapeAt);
    expect(layout).toContain('document.querySelector("[data-build-atlas]")');
    expect(layout).toContain('document.querySelector("[data-build-register]")');
    expect(layout).toContain('querySelectorAll("[data-build-chapter]")');
    expect(layout).toContain("nextTop");
    expect(layout).toContain("shapeTop");
    expect(layout).toContain('"__buildFormedFixture"');
    expect(chapterHead).toContain("data-build-chapter-head");
    expect(chapterHead).toContain("{{ index }}");
    expect(chapterHead).toContain("{{ title }}");
    expect(chapterHead).toContain("{{ hint }}");
    expect(chapterHead).toContain("{{ fact }}");
  });

  it("六路谱不再重复一张大轮盘，路数与流派全部从事实源来", () => {
    const discovery = source("src/components/build/BuildDiscovery.vue");

    expect(discovery).toContain("data-build-discovery");
    expect(discovery).toContain("data-build-ledger");
    expect(discovery).toContain('v-for="(row, index) in rows"');
    expect(discovery).toContain(':data-build-path="row.style.id"');
    expect(discovery).not.toContain("build-discovery__wheel");
    expect(discovery).not.toMatch(new RegExp(BUILD_STYLES.map((style) => style.name).join("|")));
  });

  it("续卷手机单列、620 两列、960 前三章并读，220 以下章态退整行", () => {
    const css = source("src/style.css");
    const start = css.indexOf("/*\n   * 铸道案");
    const end = css.indexOf("/*\n   * 道途未成", start);
    const buildCss = css.slice(start, end);

    expect(start, "铸道样式段要能定位到").toBeGreaterThan(-1);
    expect(end, "铸道样式段要有明确结尾").toBeGreaterThan(start);
    expect(buildCss).toMatch(
      /\.build-page \.folio-masthead__book\s*\{[\s\S]{0,80}color:\s*rgb\(var\(--color-ink-soft-rgb\)\)/,
    );
    expect(buildCss).toMatch(
      /\.build-register\s*\{[\s\S]{0,360}grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
    expect(buildCss).toMatch(
      /@media \(min-width: 620px\)\s*\{[\s\S]{0,1100}\.build-register\s*\{[\s\S]{0,160}repeat\(2, minmax\(0, 1fr\)\)/,
    );
    expect(buildCss).toMatch(
      /@media \(min-width: 960px\)\s*\{[\s\S]{0,600}\.build-register\s*\{[\s\S]{0,160}repeat\(3, minmax\(0, 1fr\)\)/,
    );
    expect(buildCss).toMatch(
      /@media \(max-width: 220px\)\s*\{[\s\S]{0,3000}\.build-matchup__rate\s*\{[\s\S]{0,100}grid-column:\s*2/,
    );
    expect(buildCss).toMatch(
      /\.build-page \.folio-masthead__visual\s*\{[\s\S]{0,220}position:\s*absolute/,
    );
    expect(buildCss, "390 的铸道盘要退成卷首水印").toContain("right: -2.8rem");
    expect(buildCss, "桌面要恢复铸道盘栏位").toMatch(
      /@media \(min-width: 620px\)\s*\{[\s\S]{0,220}\.build-page \.folio-masthead__visual\s*\{[\s\S]{0,100}position:\s*static/,
    );
    expect(buildCss, "两列时阶梯与下一步先并读，五维再续整行").toMatch(
      /@media \(min-width: 620px\)\s*\{[\s\S]{0,1800}grid-template-areas:[\s\S]{0,180}"stage next"[\s\S]{0,160}"shape shape"/,
    );
    expect(buildCss, "三列时按阅读顺序恢复阶梯 / 下一步 / 五维").toMatch(
      /@media \(min-width: 960px\)\s*\{[\s\S]{0,1000}\.build-register\s*\{[\s\S]{0,260}grid-template-areas:\s*"stage next shape"/,
    );
    expect(buildCss, "章首在极窄档把读数退到章名下一行").toMatch(
      /@media \(max-width: 220px\)\s*\{[\s\S]{0,1400}\.build-chapter-head\s*\{[\s\S]{0,220}grid-template-columns:\s*auto minmax\(0, 1fr\)/,
    );
    expect(buildCss, "核心缺口的小字要在渐变纸上与墨色混合后仍读得清").toMatch(
      /\.build-core__gap\s*\{[\s\S]{0,120}color:\s*color-mix\(in srgb,\s*var\(--color-cinnabar\)\s*72%,\s*var\(--color-ink\)\s*28%\)/,
    );
  });
});
