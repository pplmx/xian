import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { readStyleCss } from "@/test/readStyleCss";

const ROOT = resolve(__dirname, "../..");

function source(rel: string): string {
  if (rel === "src/style.css") return readStyleCss();
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("宽屏册页 · 从手机单叶展开成桌面双页", () => {
  it("只有信息能成对阅读的主册展开,其余页仍是一张较窄的单叶", async () => {
    const { folioLayoutOf } = await import("./folioSpread");

    expect(folioLayoutOf("cultivation")).toBe("spread");
    expect(folioLayoutOf("character")).toBe("spread");
    expect(folioLayoutOf("inventory")).toBe("spread");
    expect(folioLayoutOf("collection")).toBe("spread");
    for (const route of [
      "home",
      "adventure",
      "world",
      "celestial",
      "souls",
      "dongfu",
      "market",
      "apprentice",
      "build",
      "titles",
      "legacy",
      "codex",
    ]) {
      expect(folioLayoutOf(route), `${route} 应铺成宽案`).toBe("wide");
    }
    expect(folioLayoutOf("settings")).toBe("single");
    expect(folioLayoutOf(undefined)).toBe("single");
  });

  it("外壳同时认识游戏态与当前页版式,不把欢迎页撑成桌面书桌", () => {
    const app = source("src/App.vue");

    expect(app).toContain("folioLayoutOf");
    expect(app).toContain(":data-game-shell=\"game.started ? 'desk' : 'leaf'\"");
    expect(app).toContain(':data-folio-layout="folioLayout"');
  });

  it("桌面游戏外壳放宽,读卷收 48rem、案卷收 60rem、双页收 66rem", () => {
    const css = source("src/style.css");

    expect(css).toMatch(/@media \(min-width: 960px\)/);
    expect(css).toContain('.app-shell[data-game-shell="desk"]');
    expect(css).toContain("max-width: 88rem");
    expect(css).toContain("max-width: 48rem");
    expect(css).toMatch(
      /\.app-shell\[data-folio-layout="wide"\] \.folio-page\s*\{[\s\S]{0,120}?max-width:\s*60rem/,
    );
    expect(css).toContain("max-width: 66rem");
  });

  it("620~959 铺成一张留出页边的平装单叶,底栏留到 960 才退场", () => {
    const css = source("src/style.css");

    expect(css, "平板与横屏不再把正文锁在 430px 手机栏里").toMatch(
      /@media \(min-width: 620px\) and \(max-width: 959px\)\s*\{[\s\S]{0,180}?\.app-shell\s*\{[\s\S]{0,140}?width:\s*calc\(100% - 2rem\);[\s\S]{0,80}?max-width:\s*60rem;/,
    );
    expect(css, "高屏平板仍要给上下书口留白,矮横屏才让高度优先").toMatch(
      /@media \(min-width: 620px\) and \(min-height: 561px\)\s*\{[\s\S]{0,180}?\.app-shell\s*\{[\s\S]{0,120}?height:\s*calc\(var\(--app-shell-height\) - 2rem\);/,
    );
    expect(css, "底栏仍由 960 的桌面书脊断点收走").toMatch(
      /@media \(min-width: 960px\)[\s\S]*?\.app-shell\[data-game-shell="desk"\] \[data-folio-dock\][\s\S]{0,120}?display:\s*none;/,
    );
  });

  it("双页是真正的两栏网格,中缝只画一道装饰线,窄屏仍退回单列", () => {
    const css = source("src/style.css");

    expect(css).toMatch(
      /\.app-shell\[data-folio-layout="spread"\] \.folio-page--stack \{[\s\S]{0,500}?display: grid;/,
    );
    expect(css).toMatch(/grid-template-columns:\s*minmax\(0, 1\.08fr\) minmax\(0, 0\.92fr\)/);
    expect(css).toMatch(
      /\.app-shell\[data-folio-layout="spread"\] \.folio-page--stack::before \{[\s\S]{0,400}?left: 50%;/,
    );
    expect(css).toContain(".folio-span-all");
  });

  it("首页在宽案内自排双列仪表盘；人物页三章续卷整册跨两栏", () => {
    const home = source("src/views/HomeView.vue");
    const homeCss = source("src/styles/pages/home.css");
    const character = source("src/views/CharacterView.vue");

    expect(home).toContain('<div class="home-deck__board">');
    expect(home).not.toContain('class="folio-page--stack');
    expect(homeCss).toMatch(
      /@media \(min-width: 620px\) \{[\s\S]{0,900}?\.home-deck__board \{[\s\S]{0,120}?grid-template-columns: minmax\(0, 1\.03fr\) minmax\(0, 0\.97fr\)/,
    );
    expect(character).toMatch(
      /<article class="character-register folio-span-all" data-character-register>/,
    );
    expect(character).toMatch(
      /<section\s+class="character-register__chapter character-afterword"\s+data-character-chapter="catalog"\s+data-character-afterword/,
    );
  });

  it("修炼页让行功账与下一步同排双页,四章仍在一册续卷里", () => {
    const view = source("src/views/CultivationView.vue");

    expect(view).toContain('<article class="cultivation-register folio-span-all"');
    expect(view).toContain('class="cultivation-register__main"');
    expect(view).toMatch(/<section\s+class="cultivation-register__chapter cultivation-ledger"/);
    expect(view).toMatch(/<section\s+class="cultivation-register__chapter cultivation-next"/);
    expect(view).toContain("data-cultivation-ledger");
    expect(view).toContain("data-cultivation-next");
  });

  it("行囊在续卷里把九佩与藏品并读,四册页签共用同一张书桌", () => {
    const view = source("src/views/InventoryView.vue");

    expect(view).toContain('<div class="folio-page folio-page--stack stagger-in">');
    expect(view).toContain('class="inventory-tabs folio-span-all mt-3"');
    expect(view).toMatch(
      /<article\s+class="inventory-register folio-span-all"[\s\S]{0,120}?data-inventory-register\b/,
    );
    expect(view.match(/data-inventory-register-tab=/g)).toHaveLength(4);
    expect(view).toContain('class="inventory-register__lower"');
    expect(view).toMatch(
      /class="inventory-register__chapter inventory-equipment"[\s\S]{0,100}?data-inventory-equipment/,
    );
    expect(view).toContain('class="inventory-register__chapter inventory-collection"');
    expect(view).toMatch(
      /class="inventory-register folio-span-all"[\s\S]{0,160}?data-inventory-register-tab="pill"/,
    );
    expect(view).toMatch(
      /class="inventory-register folio-span-all"[\s\S]{0,160}?data-inventory-register-tab="material"/,
    );
    expect(view).toMatch(
      /class="inventory-register folio-span-all"[\s\S]{0,160}?data-inventory-register-tab="artifact"/,
    );
    expect(view).toContain('class="inventory-register__chapter inventory-artifacts"');
  });

  it("真浏览器门在 1280 档核外壳宽度、双栏、宽案与读卷宽度,避免只靠源码自证", () => {
    const layout = source("scripts/layout-check.mjs");

    expect(layout, "768 宽要单独成为一档真浏览器视口").toContain(
      '{ width: 768, height: 1024, tag: "768x1024", dpr: 1 }',
    );
    expect(layout, "620 宽叶下界要单独成为一档").toContain(
      '{ width: 620, height: 900, tag: "620x900", dpr: 2 }',
    );
    expect(layout, "959 宽叶上界要单独成为一档").toContain(
      '{ width: 959, height: 1024, tag: "959x1024", dpr: 1 }',
    );
    expect(layout, "四档宽叶要共用同一份视口名单").toContain(
      'const TABLET_LEAF_TAGS = new Set(["620x900", "768x1024", "844x390", "959x1024"]);',
    );
    expect(layout, "620 档按外壳可用宽收束,不把 640 写死").toContain(
      "Math.min(640, shellWidth - 18)",
    );
    expect(layout, "平板宽叶必须逐页计数,不能只改 CSS").toContain("tabletLeafSeen");
    expect(layout, "平板仍是一条手机窄栏要当场报红").toContain("平板宽叶仍收成手机窄栏");
    expect(layout).toContain("desktopFolioSeen");
    expect(layout).toContain("双页册没有真的展开");
    expect(layout).toContain("案卷没有铺开");
    expect(layout).toContain("读卷册在桌面上拉得过宽");
    expect(layout).toContain("卷末目录没有三组并读");
    expect(layout).toContain("行囊九佩与藏品没有并读");
    expect(layout).toContain("行囊丹药册没有并读");
    expect(layout).toContain("藏珍总谱与卷目没有并读");
    expect(layout).toContain("nameBeastDeskSpread");
    expect(layout).toContain("名兽案总案与全谱没有摊成左右两页");
    expect(layout).toContain("realmCodexDeskSpread");
    expect(layout).toContain("界域志当前卷与境界谱没有摊成左右两页");
  });

  it("藏珍双阁同住一册,960 宽才让行动章与榜/柜章左右并读", () => {
    const view = source("src/views/CollectionView.vue");
    const css = source("src/styles/pages/collection.css");

    expect(view).toContain(
      '<article class="collection-register folio-span-all" data-collection-register>',
    );
    expect(view).toContain('class="collection-gates folio-span-all"');
    expect(view).toContain('data-collection-chapter="lead"');
    expect(view).toContain('data-collection-chapter="volumes"');
    expect(view).toMatch(
      /<article class="collection-register[\s\S]*?data-achievement-hero[\s\S]*?data-achievement-volumes[\s\S]*?data-collection-hero[\s\S]*?data-collection-shelves[\s\S]*?<\/article>/,
    );
    expect(css).toMatch(
      /@media \(min-width: 960px\)\s*\{[\s\S]{0,360}\.collection-register\s*\{[\s\S]{0,160}grid-template-columns:\s*minmax\(0, 0\.92fr\) minmax\(0, 1\.08fr\)/,
    );
  });
});
