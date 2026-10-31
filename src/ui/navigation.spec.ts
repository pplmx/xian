import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { NAVIGATION_ENTRIES, NAVIGATION_SECTIONS, navigationPositionOf } from "./navigation";

const ROOT = resolve(__dirname, "../..");

describe("玄枢图 · 全站册目", () => {
  it("把已开的十七册各归一处,不重名、不重路", () => {
    expect(NAVIGATION_SECTIONS).toHaveLength(5);
    expect(NAVIGATION_ENTRIES).toHaveLength(17);
    expect(new Set(NAVIGATION_ENTRIES.map((e) => e.name)).size).toBe(17);
    expect(new Set(NAVIGATION_ENTRIES.map((e) => e.to)).size).toBe(17);
  });

  it("每一册都有可见说明,册目不是一排没有语义的入口", () => {
    for (const entry of NAVIGATION_ENTRIES) {
      expect(entry.label.length, `${entry.name} 缺册名`).toBeGreaterThan(0);
      expect(entry.shortLabel.length, `${entry.name} 缺书口短名`).toBeGreaterThan(0);
      expect(entry.shortLabel.length, `${entry.name} 的书口短名过长`).toBeLessThanOrEqual(2);
      expect(entry.description.length, `${entry.name} 缺一句说明`).toBeGreaterThan(5);
      expect(entry.icon.length, `${entry.name} 缺图标`).toBeGreaterThan(0);
      expect(entry.keywords.length, `${entry.name} 缺寻册旧叫法`).toBeGreaterThan(0);
      expect(
        entry.keywords.every((word) => word.trim().length > 0),
        `${entry.name} 有空关键词`,
      ).toBe(true);
    }
  });

  it("按路由名能找回所在册与分卷", () => {
    expect(navigationPositionOf("cultivation")?.entry).toMatchObject({
      label: "修炼",
      sectionLabel: "修行",
    });
    expect(navigationPositionOf("souls")?.entry).toMatchObject({
      label: "器魂",
      sectionLabel: "身外",
    });
    expect(navigationPositionOf("settings")?.entry).toMatchObject({
      label: "设置",
      sectionLabel: "天机",
    });
    expect(navigationPositionOf("not-a-route")).toBeUndefined();
    expect(navigationPositionOf(undefined)).toBeUndefined();
  });

  it("按册目能读出卷次与册次,供顶栏、卷首与弹窗共用", () => {
    expect(navigationPositionOf("home")).toMatchObject({
      sectionIndex: 0,
      entryIndex: 0,
    });
    expect(navigationPositionOf("souls")).toMatchObject({
      sectionIndex: 3,
      entryIndex: 2,
    });
    expect(navigationPositionOf("settings")).toMatchObject({
      sectionIndex: 4,
      entryIndex: 4,
    });
    expect(navigationPositionOf("not-a-route")).toBeUndefined();
    expect(navigationPositionOf(undefined)).toBeUndefined();
  });

  it("新壳层真的接上玄枢图,而不是只造了一份死数据", () => {
    const top = readFileSync(resolve(ROOT, "src/components/common/TopStatusBar.vue"), "utf8");
    const app = readFileSync(resolve(ROOT, "src/App.vue"), "utf8");
    const atlas = readFileSync(resolve(ROOT, "src/components/common/NavigationAtlas.vue"), "utf8");
    expect(top, "顶栏缺打开玄枢图的入口").toContain("data-atlas-trigger");
    expect(app, "应用外壳要统一挂载玄枢图").toContain("<NavigationAtlas");
    expect(atlas, "玄枢图要读同一份册目").toContain("NAVIGATION_SECTIONS");
    expect(atlas, "玄枢图要能直接去各页").toContain("<RouterLink");
    expect(atlas, "玄枢图要复用全站弹窗的焦点与返回键纪律").toContain("<BaseModal");
    expect(atlas, "运行时判据要能定位册目").toContain("data-nav-atlas");
    expect(atlas, "玄枢图要给出五卷总图而不只列单册").toContain("data-atlas-compass");
  });
});
