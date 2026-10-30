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

  it("卷首走铸道盘，成路、五维、实战、快照与旧构筑都有独立账位", () => {
    const view = source("src/views/BuildView.vue");
    const atlas = source("src/components/build/BuildAtlas.vue");
    const layout = source("scripts/layout-check.mjs");

    expect(view).toMatch(/<FolioPageHeader[\s\S]{0,520}\bfeatured\b/);
    expect(view).toMatch(/<template #visual>[\s\S]{0,220}<BuildAtlas/);
    expect(view).toContain("buildStageMeter(");
    expect(view).toContain("buildCoreGaps(");
    expect(view).toContain("data-build-current");
    expect(view).toContain("data-build-formed");
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
    expect(layout).toContain('document.querySelector("[data-build-atlas]")');
    expect(layout).toContain('"__buildFormedFixture"');
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

  it("手机单列、620 两列、960 三列，220 以下行尾读数退整行", () => {
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
      /\.build-ledger__grid\s*\{[\s\S]{0,180}grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
    expect(buildCss).toMatch(
      /@media \(min-width: 620px\)\s*\{[\s\S]{0,900}\.build-ledger__grid\s*\{[\s\S]{0,120}repeat\(2, minmax\(0, 1fr\)\)/,
    );
    expect(buildCss).toMatch(
      /@media \(min-width: 960px\)\s*\{[\s\S]{0,420}\.build-ledger__grid--three\s*\{[\s\S]{0,120}repeat\(3, minmax\(0, 1fr\)\)/,
    );
    expect(buildCss).toMatch(
      /@media \(max-width: 220px\)\s*\{[\s\S]{0,2600}\.build-matchup__rate\s*\{[\s\S]{0,100}grid-column:\s*2/,
    );
  });
});
