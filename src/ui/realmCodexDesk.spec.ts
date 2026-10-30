import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { realmCodexCurrent, realmCodexWorldRows } from "@/core/realmCodex";
import { readStyleCss } from "@/test/readStyleCss";
import {
  REALM_WORLD_MARKS,
  realmCodexAtlasRows,
  realmCodexOverview,
  realmCodexRealmEntries,
  realmCodexRealmState,
  realmCodexWorldMark,
} from "./realmCodexDesk";

const ROOT = resolve(__dirname, "../..");

function source(rel: string): string {
  if (rel === "src/style.css") return readStyleCss();
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("界域案 · 四界先成谱,境界再逐格展开", () => {
  it("四界各有一枚单字印,未知界退回首字而不另造分类", () => {
    expect(Object.keys(REALM_WORLD_MARKS)).toEqual(["mortal", "immortal", "god", "chaos"]);
    expect(new Set(Object.values(REALM_WORLD_MARKS)).size).toBe(4);
    expect(realmCodexWorldMark("mortal")).toBe("凡");
    expect(realmCodexWorldMark("immortal")).toBe("仙");
    expect(realmCodexWorldMark("unknown")).toBe("u");
  });

  it("四界卷目只搬运 core 的界序、境界数、已行境数与状态", () => {
    const rows = realmCodexWorldRows(9);
    const atlas = realmCodexAtlasRows(rows);

    expect(atlas.map((row) => row.mark)).toEqual(["凡", "仙", "神", "混"]);
    expect(atlas.map((row) => row.ordinal)).toEqual([1, 2, 3, 4]);
    expect(atlas.map((row) => row.rangeLabel)).toEqual([
      "第 1–9 境",
      "第 10–14 境",
      "第 15–18 境",
      "第 19–21 境",
    ]);
    expect(atlas.map((row) => row.status)).toEqual(["已渡 9/9", "行至 1/5", "未至", "未至"]);
    expect(atlas.map((row) => row.ratio)).toEqual([1, 0.2, 0, 0]);
    expect(atlas.map((row) => row.total)).toEqual(rows.map((row) => row.total));
  });

  it("卷首总账从同一份当前境与四界行汇总,不再重数一遍", () => {
    const rows = realmCodexWorldRows(9);
    const overview = realmCodexOverview(realmCodexCurrent(9), rows);

    expect(overview).toEqual({
      passed: 9,
      total: 21,
      remaining: 11,
      ratio: 10 / 21,
      worldPosition: 1,
      worldTotal: 5,
      worldIndex: 2,
      worldCount: 4,
    });
  });

  it("境界格三态只看当前大境界;坏档夹回首境,越界则全归已渡", () => {
    expect(realmCodexRealmState(8, 9)).toBe("past");
    expect(realmCodexRealmState(9, 9)).toBe("current");
    expect(realmCodexRealmState(10, 9)).toBe("future");
    expect(realmCodexRealmState(0, Number.NaN)).toBe("current");
    expect(realmCodexRealmState(0, -99)).toBe("current");
    expect(realmCodexRealmState(20, 999)).toBe("past");

    const entries = realmCodexRealmEntries(realmCodexWorldRows(9)[1]!, 9);
    expect(entries.map((entry) => entry.ordinal)).toEqual([10, 11, 12, 13, 14]);
    expect(entries.map((entry) => entry.state)).toEqual([
      "current",
      "future",
      "future",
      "future",
      "future",
    ]);
    expect(entries.map((entry) => entry.stateMark)).toEqual(["此", "待", "待", "待", "待"]);
    expect(entries.map((entry) => entry.stateLabel)).toEqual([
      "此刻",
      "未至",
      "未至",
      "未至",
      "未至",
    ]);
  });

  it("页面收成一枚四界谱:卷首报此刻,卷目可控四界,境界格再展开来路", () => {
    const view = source("src/views/RealmCodexView.vue");
    const atlas = source("src/components/common/RealmAtlas.vue");
    const css = source("src/style.css");

    expect(view, "界域志进入 featured 开卷版式").toMatch(
      /<FolioPageHeader[\s\S]{0,260}\bfeatured\b/,
    );
    expect(view, "页头主视觉读同一份四界谱").toMatch(/<template #visual>[\s\S]{0,180}<RealmAtlas/);
    expect(view).toContain("data-realm-current");
    expect(view).toContain("realmCodexOverview(currentRealm.value, worldRows.value)");
    expect(view).toContain("realmCodexAtlasRows(worldRows.value)");
    expect(view).toContain("realmCodexRealmEntries(row, player.major)");
    expect(view).toContain("data-realm-world-index");
    expect(view).toContain(':data-world-toggle="row.world.id"');
    expect(view).toContain(':data-world-state="row.state"');
    expect(view).toContain(':aria-expanded="isWorldOpen(row.world.id)"');
    expect(view).toContain(':aria-controls="worldBodyId(row.world.id)"');
    expect(view).toContain("data-realm-toggle");
    expect(view).toContain("data-realm-detail");
    expect(view).toContain(':aria-expanded="isRealmOpen(cell.def.id)"');
    expect(view).toContain(':aria-controls="realmBodyId(cell.def.id)"');
    expect(view).toContain("classicsOf(cell.def.id)");
    expect(view, "典籍互链跳回时要同时展开目标界与目标境").toContain("openRealms.value[id] = true");
    expect(atlas, "页头谱图纯视觉,不重复进入读屏").toContain('aria-hidden="true"');

    expect(css).toMatch(
      /\.realm-world-index__grid\s*\{[\s\S]{0,140}grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/,
    );
    expect(css).toMatch(
      /@media \(min-width: 620px\)\s*\{[\s\S]{0,1000}\.realm-world-index__grid\s*\{[\s\S]{0,120}repeat\(4, minmax\(0, 1fr\)\)[\s\S]{0,400}\.realm-ledger\s*\{[\s\S]{0,120}repeat\(2, minmax\(0, 1fr\)\)/,
    );
    expect(css).toMatch(
      /@media \(max-width: 220px\)\s*\{[\s\S]{0,1400}\.realm-world-index__grid\s*\{[\s\S]{0,120}minmax\(0, 1fr\)/,
    );
  });
});
