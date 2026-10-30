import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { mortalStageStatuses, type PlaceView } from "@/core/mortalWorldService";
import { worldDeskMeter } from "./worldDesk";
import { readStyleCss } from "@/test/readStyleCss";

const ROOT = resolve(__dirname, "../..");

function source(rel: string): string {
  if (rel === "src/style.css") return readStyleCss();
  return readFileSync(resolve(ROOT, rel), "utf8");
}

function places(count: number): PlaceView[] {
  return Array.from({ length: count }, (_, index) => ({
    nodeId: `node-${index}`,
    regionId: `region-${index}`,
    name: ["寒潭", "落霞", "古原", "云关"][index] ?? `地界${index}`,
    terrain: "山地",
    x: index * 20,
    y: 30,
    r: 4,
    eventLevel: 2,
    bossName: `镇守${index}`,
  }));
}

describe("本世山河案 · 卷首山图与路线账同读一份阶段结果", () => {
  it("未行时以首段作眼下，已行两段后报第三程，全通后收成全程已行", () => {
    const route = places(4);

    expect(worldDeskMeter(route, mortalStageStatuses(["0", "1", "2", "3"], []))).toMatchObject({
      total: 4,
      cleared: 0,
      remaining: 4,
      ratio: 0,
      currentIndex: 0,
      currentName: "寒潭",
      currentOrdinal: "第 1 程",
      atlasMark: "寒",
    });

    expect(
      worldDeskMeter(route, mortalStageStatuses(["0", "1", "2", "3"], ["0", "1"])),
    ).toMatchObject({
      cleared: 2,
      remaining: 2,
      ratio: 0.5,
      currentIndex: 2,
      currentName: "古原",
      currentOrdinal: "第 3 程",
      atlasMark: "古",
    });

    expect(
      worldDeskMeter(route, mortalStageStatuses(["0", "1", "2", "3"], ["0", "1", "2", "3"])),
    ).toMatchObject({
      cleared: 4,
      remaining: 0,
      ratio: 1,
      currentIndex: -1,
      currentName: "全程已行",
      currentOrdinal: "全程已行",
      atlasMark: "山",
    });
  });

  it("阶段结果缺项或空世界时不造负数，也不把空盘当已行", () => {
    const route = places(2);
    expect(worldDeskMeter([], [])).toMatchObject({
      total: 0,
      cleared: 0,
      remaining: 0,
      ratio: 0,
      currentIndex: -1,
      atlasMark: "山",
    });
    expect(worldDeskMeter(route, [{ state: "cleared" }])).toMatchObject({
      total: 2,
      cleared: 1,
      remaining: 1,
      currentIndex: -1,
    });
  });

  it("卷首山图、全图、路线账与前尘册各有稳定落点", () => {
    const view = source("src/views/MortalWorldView.vue");
    const atlas = source("src/components/world/WorldAtlas.vue");
    const map = source("src/components/world/MortalRouteMap.vue");
    const layout = source("scripts/layout-check.mjs");

    expect(view).toContain("worldDeskMeter(");
    expect(view).toContain("data-world-desk");
    expect(view).toContain("data-world-current");
    expect(view).toContain("<WorldAtlas");
    expect(view).toContain("<MortalRouteMap");
    expect(view).toContain("data-world-history");
    expect(view).toContain("worldHistoryRows(");
    expect(view).toContain('v-if="canDepart(p.regionId)"');
    expect(view).toMatch(
      /function canDepart\(regionId: string\): boolean \{\s*return canEnterRegion\(regionId\);/,
    );
    expect(atlas).toContain("data-world-atlas");
    expect(atlas).toContain('aria-hidden="true"');
    expect(map).toContain("world-route-map");
    expect(map).not.toContain("card-ink");
    expect(layout).toContain("taskWorldDesk");
    expect(layout).toContain('document.querySelector("[data-world-desk]")');
  });

  it("手机单列、桌面山河与路线并读，200% 缩放档把行尾读数退整行", () => {
    const css = source("src/style.css");
    const start = css.indexOf("/*\n   * 本世山河案");
    const end = css.indexOf("/*\n   * 铸道案", start);
    const worldCss = css.slice(start, end);

    expect(start, "本世山河案样式段要能定位到").toBeGreaterThan(-1);
    expect(end, "本世山河案样式段要有明确结尾").toBeGreaterThan(start);
    expect(worldCss).toMatch(
      /\.world-page \.folio-masthead__book\s*\{[\s\S]{0,80}color:\s*rgb\(var\(--color-ink-soft-rgb\)\)/,
    );
    expect(worldCss).toMatch(
      /\.world-ledger__body\s*\{[\s\S]{0,180}grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
    expect(worldCss).toMatch(
      /@media \(min-width: 620px\)\s*\{[\s\S]{0,700}\.world-masthead__brief\s*\{[\s\S]{0,150}grid-template-columns:/,
    );
    expect(worldCss).toMatch(
      /@media \(min-width: 760px\)\s*\{[\s\S]{0,500}\.world-ledger__body\s*\{[\s\S]{0,120}grid-template-columns:\s*minmax\(0, 0\.88fr\) minmax\(0, 1\.12fr\)/,
    );
    expect(worldCss).toMatch(
      /@media \(max-width: 220px\)\s*\{[\s\S]{0,2600}\.world-history__row\s*\{[\s\S]{0,100}grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
    expect(worldCss).toMatch(
      /\.world-route-map__legend\s*\{[\s\S]{0,220}color:\s*var\(--color-ink-soft\)/,
    );
    expect(worldCss).toMatch(
      /\.world-masthead__reroll p\s*\{[\s\S]{0,120}color:\s*var\(--color-ink-soft\)/,
    );
    expect(worldCss).toMatch(/\.world-stage__depart\s*\{[\s\S]{0,120}min-width:\s*3rem/);
  });
});
