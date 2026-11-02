import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { collectionProgressOverview } from "@/core/collectionProgress";
import {
  achievementDirectionMark,
  collectionCabinetCells,
  collectionCategoryMark,
  COLLECTION_CATEGORY_MARKS,
} from "./collectionDesk";

const source = readSource;

function rule(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([\\s\\S]*?)\\n\\s*\\}`).exec(css)?.[1] ?? "";
}

describe("藏珍双阁 · 功名入榜，九柜纳珍", () => {
  it("九柜各有单字印，柜格只搬运汇总读数并保留缺口", () => {
    const overview = collectionProgressOverview([
      { key: "equip", name: "装备图鉴", known: 3, total: 10, newCount: 1 },
      { key: "pet", name: "灵兽册", known: 2, total: 4, newCount: 0 },
    ]);

    expect(Object.keys(COLLECTION_CATEGORY_MARKS).sort()).toEqual(
      [
        "artifact",
        "branch",
        "equip",
        "event",
        "gongfa",
        "material",
        "pet",
        "pill",
        "talent",
      ].sort(),
    );
    expect(new Set(Object.values(COLLECTION_CATEGORY_MARKS)).size).toBe(9);
    expect(collectionCategoryMark("equip")).toBe("器");
    expect(collectionCategoryMark("unknown")).toBe("u");
    expect(achievementDirectionMark("历练征战")).toBe("战");
    expect(achievementDirectionMark("新方向")).toBe("新");

    expect(collectionCabinetCells(overview.rows)).toEqual([
      {
        key: "equip",
        name: "装备图鉴",
        mark: "器",
        known: 3,
        total: 10,
        ratio: 0.3,
        remaining: 7,
        complete: false,
        newCount: 1,
      },
      {
        key: "pet",
        name: "灵兽册",
        mark: "兽",
        known: 2,
        total: 4,
        ratio: 0.5,
        remaining: 2,
        complete: false,
        newCount: 0,
      },
    ]);
  });

  it("卷首后是一对阁门，不再用一排小页签平分成就与收藏", () => {
    const view = source("src/views/CollectionView.vue");

    expect(view).not.toContain("<InkTabs");
    expect(view).not.toContain("collection-tabs");
    expect(view).toContain('class="collection-gates folio-span-all"');
    expect(view).toContain('role="tablist"');
    expect(view).toContain('aria-label="藏珍双阁"');
    expect(view).toContain(':data-collection-gate="gate.id"');
    expect(view).toContain(':aria-selected="tab === gate.id"');
    expect(view).toContain("功名榜");
    expect(view).toContain("藏珍阁");
    expect(view, "可见阁名之外仍保留玄枢图的原分册叫法").toContain("成就");
    expect(view, "可见阁名之外仍保留玄枢图的原分册叫法").toContain("收藏");
    expect(view).toContain("data-collection-gate-fact");
    expect(view).toContain('@keydown="onGateKeydown"');
  });

  it("藏珍阁把九册变成真柜格，柜面直接报名、数、余量或新得", () => {
    const view = source("src/views/CollectionView.vue");
    const cabinet = source("src/components/common/CollectionCabinet.vue");

    expect(view).toContain("<CollectionCabinet");
    expect(view).toContain(':cells="collectionCabinetCells"');
    expect(view).toContain(':selected-key="selectedCollectionKey"');
    expect(view).toContain('@select="setCollectionCategoryOpen($event, true)"');
    expect(view).toContain("data-collection-hero");
    expect(view).toContain("collectionCabinetCells = computed");
    expect(view).toContain("visibleCats.value");

    expect(cabinet).toContain("data-collection-cabinet");
    expect(cabinet).toContain(':data-collection-category="cell.key"');
    expect(cabinet).toContain(':data-collection-category-toggle="cell.key"');
    expect(cabinet).toContain(':aria-expanded="selectedKey === cell.key"');
    expect(cabinet).toContain(':aria-controls="`collection-category-body-${cell.key}`"');
    expect(cabinet).toContain("emit('select', cell.key)");
    expect(cabinet).toContain(':data-collection-start="cell.knownStart"');
    expect(cabinet).toContain(':data-collection-shown="cell.knownShown"');
    expect(cabinet).toContain(':data-collection-total="cell.knownTotal"');
    expect(cabinet).toContain("{{ cell.name }}");
    expect(cabinet).toContain("{{ cell.known }}/{{ cell.total }}");
    expect(cabinet).toContain("cell.newCount > 0");
    expect(cabinet).toContain("cell.remaining");
    expect(cabinet, "柜格是按钮，不是只读汇总").toContain("<button");
    expect(cabinet, "柜格不能再整块藏出读屏").not.toContain(
      'data-collection-cabinet aria-hidden="true"',
    );
  });

  it("藏珍只抽开一柜，柜屉统一呈现来源、条目、新得与前后分批", () => {
    const view = source("src/views/CollectionView.vue");
    const knownLoop = view.indexOf('v-for="entry in cat.knownVisible"');
    const moreButton = view.indexOf('data-collection-more="cat.key"');
    const unknownLoop = view.indexOf('v-for="entry in cat.unknownVisible"');

    expect(view).toContain("data-collection-shelves");
    expect(view).toContain("data-collection-category-body");
    expect(view, "合上的柜屉不留在 DOM 里").toContain('v-if="isCollectionCategoryOpen(cat.key)"');
    expect(view, "合上的柜体只留空壳给 aria-controls").toContain(
      'v-show="isCollectionCategoryOpen(cat.key)"',
    );
    expect(view).toContain("data-collection-tray");
    expect(view).toContain(':data-collection-prev="cat.key"');
    expect(view).toContain(':data-promised="Math.min(COLLECTION_RENDER_BATCH, cat.hiddenKnown)"');
    expect(view).toContain("selectedCollectionKey");
    expect(view).toContain("initialOpenKeys[0]");
    expect(view).toContain("catComplete(cat)");
    expect(view).toContain("此目已无未识之物");
    expect(view).toMatch(/every\(\(e\) => e\.stage >= 1\)/);
    expect(knownLoop).toBeGreaterThan(-1);
    expect(moreButton).toBeGreaterThan(knownLoop);
    expect(unknownLoop).toBeGreaterThan(moreButton);

    expect(view, "旧的三张同权重新得卡已退场").not.toContain("collection-briefing__highlights");
    expect(view, "旧的第四册一键展开已退场").not.toContain("data-collection-more-new");
    expect(view, "柜面本身已经会报新得，不再另造跳转短名单").not.toContain("data-collection-jump");
  });

  it("功名榜把方向收成榜牌，最近三策可跳到对应方向卷", () => {
    const view = source("src/views/CollectionView.vue");

    expect(view).toContain("data-achievement-hero");
    expect(view).toContain("data-achievement-volumes");
    expect(view).toContain('class="achievement-wall"');
    expect(view).toContain("nearestAchievementRows(achievementRows.value, 3)");
    expect(view).toContain('v-for="(row, index) in nearestAchievements"');
    expect(view).toContain(':data-achievement-jump="row.def.id"');
    expect(view).toContain(':data-achievement-jump-direction="row.direction"');
    expect(view).toContain("{{ row.def.name }}");
    expect(view).toContain("{{ row.def.desc }}");
    expect(view).toContain("{{ row.label }}");
    expect(view).toContain("data-achievement-group-toggle");
    expect(view).toContain(':aria-expanded="isGroupOpen(g.direction)"');
    expect(view).toContain(':aria-controls="groupBodyId(gi)"');
    expect(view, "只留当前一路卷轴在 DOM 里").toContain('v-if="isGroupOpen(g.direction)"');
    expect(view, "合上的方向卷只留空壳给 aria-controls").toContain(
      'v-show="isGroupOpen(g.direction)"',
    );
    expect(view).toContain("revealAchievement(row)");
    expect(view, "方向只留一枚榜牌，不再铺成通用账行").toContain("achievement-plaque");
    expect(view, "未达成者的条件仍直接露出来").toContain("{{ row.def.desc }}");
  });

  it("九柜是三列柜架，功名榜同排榜牌，极窄档退回两列仍可读", () => {
    const css = source("src/style.css");
    const cabinet = source("src/components/common/CollectionCabinet.vue");
    const start = css.indexOf("/*\n   * 藏珍双阁");
    const end = css.indexOf("/*\n   * 器魂案", start);
    const collectionCss = css.slice(start, end);

    expect(start, "藏珍样式段要能定位到").toBeGreaterThan(-1);
    expect(end, "藏珍样式段要有明确结尾").toBeGreaterThan(start);
    expect(rule(collectionCss, ".collection-gates"), "双阁门是两扇大门，不是一排小签").toMatch(
      /display:\s*grid;[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/,
    );
    expect(rule(collectionCss, ".collection-gate"), "门前只留账线，不叠实心胶囊").toMatch(
      /border:\s*0;[\s\S]*?border-left:/,
    );
    expect(cabinet, "九柜在常宽排成三列柜架").toMatch(
      /\.collection-cabinet__wall\s*\{[\s\S]{0,180}grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/,
    );
    expect(cabinet, "柜格只靠柜线分格，不再九张方卡").toMatch(
      /\.collection-cabinet__drawer\s*\{[\s\S]{0,220}border:\s*0;[\s\S]{0,180}border-top:/,
    );
    expect(collectionCss, "功名榜与九柜同用三列扫读").toMatch(
      /\.achievement-wall\s*\{[\s\S]{0,180}grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/,
    );
    expect(collectionCss, "桌面把行动页与柜架页并读").toMatch(
      /@media \(min-width: 960px\)\s*\{[\s\S]{0,360}\.collection-register\s*\{[\s\S]{0,180}grid-template-columns:/,
    );
    expect(collectionCss).toMatch(
      /@media \(max-width: 220px\)\s*\{[\s\S]{0,900}\.collection-gates\s*\{[\s\S]{0,120}minmax\(0, 1fr\)/,
    );
    expect(cabinet).toMatch(
      /@media \(max-width: 240px\)\s*\{[\s\S]{0,500}\.collection-cabinet__wall\s*\{[\s\S]{0,120}repeat\(2, minmax\(0, 1fr\)\)/,
    );
    expect(cabinet).toMatch(
      /@media \(max-width: 430px\)\s*\{[\s\S]{0,260}\.collection-cabinet__reading\s*\{[\s\S]{0,100}grid-column:\s*2/,
    );
    expect(collectionCss).toMatch(
      /@media \(max-width: 220px\)\s*\{[\s\S]{0,1400}\.achievement-wall\s*\{[\s\S]{0,120}repeat\(2, minmax\(0, 1fr\)\)/,
    );
  });

  it("藏珍与功名同住一张开口册页，桌面左右并读，章首只报一件事", () => {
    const view = source("src/views/CollectionView.vue");
    const css = source("src/style.css");
    const start = css.indexOf("/*\n   * 藏珍双阁");
    const end = css.indexOf("/*\n   * 器魂案", start);
    const collectionCss = css.slice(start, end);

    expect(view).toContain(
      '<article class="collection-register folio-span-all" data-collection-register>',
    );
    expect(view).toContain('class="collection-register__chapter achievement-briefing"');
    expect(view).toContain('class="collection-register__chapter achievement-volumes"');
    expect(view).toContain('class="collection-register__chapter collection-briefing"');
    expect(view).toContain('class="collection-register__chapter collection-shelves"');
    expect(view.match(/<FolioChapterHead\b/g)).toHaveLength(4);
    expect(view).toContain('index="壹"');
    expect(view).toContain('index="贰"');

    expect(rule(collectionCss, ".collection-register__chapter"), "两章只做续卷分章").toMatch(
      /border:\s*0;[\s\S]*?background:\s*transparent;/,
    );
    expect(collectionCss).toMatch(
      /\.collection-register__chapter \+ \.collection-register__chapter\s*\{[\s\S]{0,120}border-top:/,
    );
    expect(collectionCss).toMatch(
      /@media \(min-width: 960px\)\s*\{[\s\S]{0,560}\.collection-register\s*\{[\s\S]{0,180}grid-template-columns:\s*minmax\(0, 0\.92fr\) minmax\(0, 1\.08fr\)/,
    );
  });
});
