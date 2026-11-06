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
    expect(view, "续开件数与按钮文案同源").toContain(
      ':data-promised="nextRevealCount(cat.hiddenKnown, COLLECTION_RENDER_BATCH)"',
    );
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

  it("已达成收成一叠,默认合着,点开才铺赏格与达成记录", () => {
    const view = source("src/views/CollectionView.vue");
    const entry = source("src/components/collection/AchievementEntry.vue");
    const css = source("src/styles/pages/collection.css");

    /*
     * 一条功名只有一个渲染来源:在追与已成两叠共用同一枚组件。
     * 手抄两遍之后,进度条、赏格与读屏文案迟早漂成两套。
     */
    expect(entry, "行组件要带稳定落点").toContain(':data-achievement-id="row.def.id"');
    expect(entry, "达成行的赏格仍在行内").toContain("achievement-entry__reward");
    expect(view, "两叠共用同一枚行组件").toContain(
      'import AchievementEntry from "@/components/collection/AchievementEntry.vue"',
    );
    expect(view.match(/<AchievementEntry/g)?.length, "在追与已成各铺一次").toBe(2);
    expect(view, "手抄的行已退场").not.toContain('class="achievement-entry"');

    /*
     * 展开一组是来看「还差什么」的:达成行是档案,默认合着。
     * 收的是版面,不是内容 —— 每一行的条件、进度与赏格仍在,只是不抢这一屏。
     */
    expect(view, "在追与已成分开取数").toContain("activeRowsOf(g)");
    expect(view, "在追与已成分开取数").toContain("doneRowsOf(g)");
    expect(view, "已达成要有独立展开键").toContain("data-achievement-done-toggle");
    expect(view, "展开键要报开合状态").toContain(':aria-expanded="doneDirection === g.direction"');
    expect(view, "达成叠默认不见").toContain('v-show="doneDirection === g.direction"');
    expect(view, "默认合着").toMatch(/const doneDirection = ref<string \| null>\(null\)/);
    expect(view, "键上直接报枚数").toContain("已达成 {{ g.done }} 枚");
    expect(view, "换方向时不继承上一组的展开态").toMatch(
      /function toggleGroup[\s\S]{0,180}?doneDirection\.value = null/,
    );
    expect(view, "跳到别的方向时也收回达成叠").toMatch(
      /function revealAchievement[\s\S]{0,220}?doneDirection\.value = null/,
    );

    expect(css, "达成叠只留账线,不另起一张卡").toMatch(
      /\.achievement-scroll__done \{[\s\S]{0,220}?border: 0;/,
    );
    expect(css, "枚数用与章名同一支楷体").toMatch(
      /\.achievement-scroll__done-count \{[\s\S]{0,160}?font-family: var\(--font-kai\)/,
    );
  });

  it("一组只先铺一批「在追」—— 新号不该一开页就撞见十九行境界", () => {
    const view = source("src/views/CollectionView.vue");
    const css = source("src/styles/pages/collection.css");

    /*
     * 实测(390×844,新号夹具):整组一次铺开时 `/collection` 是 2550px = 3.02 屏,
     * 全站最长的一页。其中 1260px 是「境界精进」那 19 行 —— 第一行叫「金丹得道」,
     * 而玩家还在炼气。那是「以后再说」,不该与「现在能做什么」抢同一屏。
     *
     * 与九柜、名号谱、法宝册同一条纪律:先给一批,玩家显式续开再放下一批,
     * 排序与整份清单仍留在数据层。收的是版面,不是内容。
     */
    expect(view, "一组每次只铺一批").toMatch(/const ACHIEVEMENT_GROUP_BATCH = \d+/);
    expect(view, "在追按窗口取").toMatch(/active\.slice\(0, Math\.max\(ACHIEVEMENT_GROUP_BATCH/);
    expect(view, "要能算出这一组还剩几枚没铺").toContain("function groupHiddenOf(");
    expect(view, "续开只放一批,不放零头").toMatch(
      /Math\.min\(ACHIEVEMENT_GROUP_BATCH, groupHiddenOf\(group\)\)/,
    );
    expect(view, "续开键只在这组确实还有余量时出现").toContain('v-if="groupHiddenOf(g) > 0"');
    expect(view, "续开键带稳定落点").toContain(':data-achievement-more="g.direction"');
    expect(view, "续开键报下一批件数(与名号谱·法宝册同款 data-promised)").toContain(
      ':data-promised="nextGroupBatchOf(g)"',
    );
    expect(view, "换一路要回到首批,不继承上一路翻到第几批").toMatch(
      /function toggleGroup[\s\S]{0,260}?groupLimits\.value = \{\}/,
    );

    expect(css, "续开键用账线收口,不另起一张卡").toMatch(
      /\.achievement-scroll__more \{[\s\S]{0,260}?border-top:/,
    );
    expect(css, "续开键是行动色").toMatch(
      /\.achievement-scroll__more \{[\s\S]{0,420}?color: rgb\(var\(--color-cinnabar-rgb\)\)/,
    );
  });

  it("最近三策跳得到分批窗口之外的那一行 —— 跳不过去不许静默", () => {
    const view = source("src/views/CollectionView.vue");

    /*
     * 这一条是分批引入的回归,而且是**最坏的那种**:静默失败。
     *
     * 一组只先铺一批,而「最近三策」可能指向第 9 行以后 —— 那时
     * `[data-achievement-id]` 根本没进 DOM,`scrollIntoView` 拿 null 之后
     * `?.` 直接跳过:玩家点了「02 金丹得道」,页面上什么都没发生,控制台也没有
     * 一条错。判据因此必须钉住「先开窗、再滚动」这个顺序本身。
     */
    const revealStart = view.indexOf("function revealAchievement(row: AchievementRow): void {");
    const reveal = view.slice(revealStart, view.indexOf("const collectionCats", revealStart));
    expect(reveal, "跳转前要按目标位次把窗口开到它出现").toContain(
      "groupLimits.value = { ...groupLimits.value, [row.direction]: batch }",
    );
    expect(reveal, "窗口按批边界取整,不逐枚 +1").toContain(
      "Math.ceil((index + 1) / ACHIEVEMENT_GROUP_BATCH) * ACHIEVEMENT_GROUP_BATCH",
    );
    // 开窗在前、滚动在后 —— 反过来就还是「滚一个不存在的元素」。
    // 用最后一次出现:注释里也会写 scrollIntoView(解释这条判据守什么),不能撞上。
    expect(
      reveal.indexOf("groupLimits.value = "),
      "必须先开窗再 scrollIntoView,否则滚的是一个还没渲染的元素",
    ).toBeLessThan(reveal.lastIndexOf("scrollIntoView"));
    expect(reveal, "目标不在窗口里时要能算出来").toContain(
      "findIndex((r) => r.def.id === row.def.id)",
    );
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
