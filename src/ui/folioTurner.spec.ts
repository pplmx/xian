import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { readStyleCss } from "@/test/readStyleCss";
import { NAVIGATION_ENTRIES } from "./navigation";
import { folioTurnNeighborsOf } from "./folioTurner";

const ROOT = resolve(__dirname, "../..");

describe("卷末翻页签 · 每册都有前后去处", () => {
  it("按玄枢图册序取相邻两册,不复造第二份页面顺序", () => {
    const home = folioTurnNeighborsOf("home");
    expect(home).toMatchObject({
      index: 0,
      total: NAVIGATION_ENTRIES.length,
      next: { name: "cultivation" },
    });
    expect(home?.previous).toBeUndefined();

    const cultivation = folioTurnNeighborsOf("cultivation");
    expect(cultivation?.previous?.name).toBe("home");
    expect(cultivation?.next?.name).toBe("character");

    const settings = folioTurnNeighborsOf("settings");
    expect(settings?.previous?.name).toBe("legacy");
    expect(settings?.next).toBeUndefined();
  });

  it("未入册的开局页不铺翻页签", () => {
    expect(folioTurnNeighborsOf("welcome")).toBeNull();
    expect(folioTurnNeighborsOf("create")).toBeNull();
    expect(folioTurnNeighborsOf(undefined)).toBeNull();
  });

  it("页面外壳接入同一枚翻页签", () => {
    const app = readFileSync(resolve(ROOT, "src/App.vue"), "utf8");
    expect(app, "游戏页末尾要挂卷末翻页签").toContain("<FolioTurner");
    expect(app).toContain('import FolioTurner from "@/components/common/FolioTurner.vue"');
  });

  it("翻页签用真实链接、中文方向与可访问名,不用可点 div 假装导航", () => {
    const turner = readFileSync(resolve(ROOT, "src/components/common/FolioTurner.vue"), "utf8");
    expect(turner).toContain("data-folio-turner");
    expect(turner).toContain("folioTurnNeighborsOf");
    expect(turner).toContain("<RouterLink");
    expect(turner).toContain("aria-label");
    expect(turner).not.toContain('role="button"');
  });

  it("窄屏退一列,桌面沿用读卷、案卷与双页的同一份宽度", () => {
    const css = readStyleCss();
    expect(css).toContain(".folio-turner");
    expect(css).toMatch(
      /\.app-shell\[data-folio-layout="wide"\]\s+\.folio-turner\s*\{[\s\S]{0,120}?max-width:\s*60rem/,
    );
    expect(css).toMatch(
      /\.app-shell\[data-folio-layout="spread"\]\s+\.folio-turner\s*\{[\s\S]{0,120}?max-width:\s*66rem/,
    );
    expect(css).toMatch(
      /@media \(max-width: 220px\)[\s\S]{0,800}?\.folio-turner__grid\s*\{[\s\S]{0,120}?grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
  });
});
