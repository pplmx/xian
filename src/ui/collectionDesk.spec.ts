import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { collectionProgressOverview } from "@/core/collectionProgress";
import { readStyleCss } from "@/test/readStyleCss";
import {
  achievementDirectionMark,
  collectionCabinetCells,
  collectionCategoryMark,
  COLLECTION_CATEGORY_MARKS,
} from "./collectionDesk";

const ROOT = resolve(__dirname, "../..");

function source(rel: string): string {
  if (rel === "src/style.css") return readStyleCss();
  return readFileSync(resolve(ROOT, rel), "utf8");
}

function rule(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([\\s\\S]*?)\\n\\s*\\}`).exec(css)?.[1] ?? "";
}

describe("藏珍案 · 九册总印紧随页签,眼下可追与眼下新得各翻一卷", () => {
  it("九册各有单字印,藏珍格只搬运汇总读数而不重数条目", () => {
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
        complete: false,
        newCount: 0,
      },
    ]);
  });

  it("九册总印接在页签后,不再借卷首主视觉复写一份总案", () => {
    const view = source("src/views/CollectionView.vue");
    const cabinet = source("src/components/common/CollectionCabinet.vue");
    const tabs = view.indexOf("<InkTabs");
    const cabinetAfterTabs = view.indexOf("<CollectionCabinet", tabs);
    const achievementTarget = view.indexOf("data-achievement-jump");

    expect(view, "藏珍卷首要走 featured 开卷版式").toMatch(
      /<FolioPageHeader[\s\S]{0,300}\bfeatured\b/,
    );
    expect(view, "卷首不再放一块会推高手机首屏的主视觉").not.toContain("<template #visual>");
    expect(cabinetAfterTabs, "九册总印要落在页签之后").toBeGreaterThan(tabs);
    expect(achievementTarget, "最近的功名目标要直接接在总印之后").toBeGreaterThan(cabinetAfterTabs);
    expect(view, "格内九册直接读卷首汇总").toContain(
      "buildCollectionCabinetCells(collectionOverview.value.rows)",
    );
    expect(view, "功名总进度读同一份成就行").toContain(':achievement-done="doneCount"');
    expect(view, "藏珍总进度读同一份九册汇总").toContain(
      ':collection-known="collectionOverview.known"',
    );
    expect(view, "重复的成就总案标题已退场").not.toContain('title="成就谱"');
    expect(view, "重复的藏珍总案标题已退场").not.toContain('title="藏珍谱"');
    expect(cabinet, "总印本身要成为可读的总账,不能再整块藏出读屏").not.toContain(
      'data-collection-cabinet aria-hidden="true"',
    );
    expect(cabinet, "九册在手机上压成一条索引").toMatch(
      /\.collection-cabinet__grid\s*\{[\s\S]{0,180}grid-template-columns:\s*repeat\(9, minmax\(0, 1fr\)\)/,
    );
    expect(cabinet, "九册格内同时报册名与收录数").toContain("{{ cell.name }}");
    expect(cabinet, "九册格内同时报册名与收录数").toContain("{{ cell.known }}/{{ cell.total }}");
    expect(cabinet, "195px 档退回三列仍可读").toMatch(
      /@media \(max-width: 220px\)\s*\{[\s\S]{0,500}\.collection-cabinet__grid\s*\{[\s\S]{0,120}repeat\(3, minmax\(0, 1fr\)\)/,
    );
  });

  it("功名状只报最近三枚,动作标题取代重复总案,名称、条件与进度全摊开", () => {
    const view = source("src/views/CollectionView.vue");

    expect(view).toContain("data-achievement-hero");
    expect(view, "卷首主标题改为下一步动作").toContain('title="眼下可追"');
    expect(view, "不再复写功名总账").not.toContain(':score-value="doneCount"');
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
    expect(view).toContain("revealAchievement(row)");
    expect(view, "旧的同权重卡头已退场").not.toContain(
      'class="card-ink mt-2 px-4 py-3" data-achievement-hero',
    );
  });

  it("藏珍谱先报新得或将满,动作标题取代重复总案,三册入口共用同一份汇总", () => {
    const view = source("src/views/CollectionView.vue");

    expect(view).toContain("data-collection-hero");
    expect(view).toContain("collectionProgressOverviewFromCodex(");
    expect(view).toContain("眼下新得");
    expect(view).toContain("将满之册");
    expect(view, "九册尽收也要有自己的下一步").toContain("九册尽收");
    expect(view, "九册未开时不能假报将满").toContain("九册待启");
    expect(view).toContain("枚待看");
    expect(view).toContain('v-for="row in collectionHighlights"');
    expect(view).toContain(':data-collection-jump="row.key"');
    expect(view).toContain("revealCollectionCategory(row.key)");
    expect(view).toContain("data-collection-more-new");
    expect(view).toContain("toggleRemainingNewCategories");
    expect(view).toContain(':aria-expanded="collectionMoreNewOpen"');
    expect(view).toContain("收起余册");
    expect(view).toContain("collectionMoreNewCount");
    expect(view, "旧的三张同权重卡已退场").not.toContain(
      'class="card-ink mt-2 px-4 py-3" data-collection-hero',
    );
  });

  it("九册正文保留来源、尽收、分批与回翻,并继续从同一批 stage 条目出数", () => {
    const view = source("src/views/CollectionView.vue");
    const knownLoop = view.indexOf('v-for="entry in cat.knownVisible"');
    const moreButton = view.indexOf('data-collection-more="cat.key"');
    const unknownLoop = view.indexOf('v-for="entry in cat.unknownVisible"');

    expect(view).toContain(':data-collection-category="cat.key"');
    expect(view).toContain(':data-collection-category-toggle="cat.key"');
    expect(view).toContain(':data-collection-category-body="cat.key"');
    expect(view).toContain(':data-collection-start="cat.knownStart"');
    expect(view).toContain(':data-collection-shown="cat.knownShown"');
    expect(view).toContain(':data-collection-total="cat.knownTotal"');
    expect(view).toContain(':data-collection-prev="cat.key"');
    expect(view).toContain(':data-promised="Math.min(COLLECTION_RENDER_BATCH, cat.hiddenKnown)"');
    expect(view).toContain("catComplete(cat)");
    expect(view).toContain("此目已无未识之物");
    expect(view).toMatch(/every\(\(e\) => e\.stage >= 1\)/);
    expect(knownLoop).toBeGreaterThan(-1);
    expect(moreButton).toBeGreaterThan(knownLoop);
    expect(unknownLoop).toBeGreaterThan(moreButton);
  });

  it("手机先读最近一枚,620 起三枚最近成就并读,220 以下不把格架挤成竖排", () => {
    const css = source("src/style.css");
    const cabinet = source("src/components/common/CollectionCabinet.vue");
    const start = css.indexOf("/*\n   * 藏珍案");
    const end = css.indexOf("/*\n   * 器魂案", start);
    const collectionCss = css.slice(start, end);

    expect(start, "藏珍样式段要能定位到").toBeGreaterThan(-1);
    expect(end, "藏珍样式段要有明确结尾").toBeGreaterThan(start);
    expect(collectionCss).toMatch(
      /\.achievement-briefing__targets\s*\{[\s\S]{0,120}grid-template-columns:\s*minmax\(0, 1fr\)|\.achievement-briefing__targets\s*\{[\s\S]{0,120}display:\s*grid/,
    );
    expect(collectionCss, "手机的目标条件要完整换行,不能省略成半句").toMatch(
      /\.achievement-target__desc\s*\{[\s\S]{0,180}white-space:\s*normal/,
    );
    expect(collectionCss).toMatch(
      /@media \(min-width: 620px\)\s*\{[\s\S]{0,260}\.achievement-briefing__targets\s*\{[\s\S]{0,120}repeat\(3, minmax\(0, 1fr\)\)/,
    );
    expect(collectionCss).toMatch(
      /@media \(max-width: 220px\)\s*\{[\s\S]{0,1800}\.collection-briefing__highlights\s*\{[\s\S]{0,120}minmax\(0, 1fr\)/,
    );
    expect(collectionCss).toMatch(
      /@media \(max-width: 220px\)\s*\{[\s\S]{0,2200}\.collection-token\s*\{[\s\S]{0,80}max-width:\s*100%/,
    );
    expect(cabinet, "总印在 390 是单行,195 才退三列").toContain("@media (max-width: 220px)");
  });

  it("总印、行动席与九册卷目回到同一张开口账页,不再层层套框", () => {
    const css = source("src/style.css");
    const cabinet = source("src/components/common/CollectionCabinet.vue");
    const start = css.indexOf("/*\n   * 藏珍案");
    const end = css.indexOf("/*\n   * 器魂案", start);
    const collectionCss = css.slice(start, end);
    const briefing =
      /\.achievement-briefing,\s*\n\s*\.collection-briefing\s*\{([\s\S]*?)\n\s*\}/.exec(
        collectionCss,
      )?.[1];
    const volumes = /\.achievement-volume,\s*\n\s*\.collection-volume\s*\{([\s\S]*?)\n\s*\}/.exec(
      collectionCss,
    )?.[1];

    expect(briefing, "功名与藏珍卷首要共用一条开页规则").toMatch(/border:\s*0;/);
    expect(briefing, "卷首不再复制整块纸底").toContain("background: transparent;");
    expect(collectionCss, "卷首不再画四边内框").not.toContain(".achievement-briefing::before");
    expect(volumes, "方向卷目与九册册目只靠账线分组").toMatch(/border:\s*0;[\s\S]*?border-top:/);
    expect(
      rule(collectionCss, ".collection-highlight"),
      "卷首三册入口改成并读的账格,不是三张方卡",
    ).toMatch(/border:\s*0;[\s\S]*?border-left:/);
    expect(rule(collectionCss, ".collection-briefing__more"), "余册入口也只留账线").toMatch(
      /border:\s*0;[\s\S]*?border-top:/,
    );
    expect(rule(cabinet, ".collection-cabinet"), "九册总印只留上下账线").toMatch(
      /border:\s*0;[\s\S]*?border-block:/,
    );
    expect(rule(cabinet, ".collection-cabinet__cell"), "九册格改竖线分栏,不再九张方框").toMatch(
      /border:\s*0;[\s\S]*?border-left:/,
    );
  });

  it("桌面把总谱与卷目分成两页,两册页签共用同一张藏珍书桌", () => {
    const view = source("src/views/CollectionView.vue");

    expect(view, "藏珍根页本就走双页网格").toContain(
      '<div class="folio-page folio-page--stack stagger-in collection-page">',
    );
    expect(view, "页签跨两栏且保留成就 / 收藏同一份状态").toContain(
      'class="collection-tabs folio-span-all"',
    );
    expect(view, "功名状与功名卷目分据左右").toContain(
      'class="achievement-briefing" data-achievement-hero',
    );
    expect(view).toContain('class="achievement-volumes" data-achievement-volumes');
    expect(view, "藏珍谱与九册藏珍分据左右").toContain(
      'class="collection-briefing" data-collection-hero',
    );
    expect(view).toContain('class="collection-shelves" data-collection-shelves');
  });
});
