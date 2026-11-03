import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { realmCodexCurrent, realmCodexWorldRows } from "@/core/realmCodex";
import {
  REALM_WORLD_MARKS,
  realmCodexAtlasRows,
  realmCodexChapter,
  realmCodexChapters,
  realmCodexOverview,
  realmCodexRealmEntries,
  realmCodexRealmState,
  realmCodexWorldMark,
} from "./realmCodexDesk";

const source = readSource;

function latestRule(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matches = [
    ...css.matchAll(new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([\\s\\S]*?)\\n\\s*\\}`, "g")),
  ];
  return matches.at(-1)?.[1] ?? "";
}

describe("界域案 · 四界先成谱,境界再逐格展开", () => {
  it("六册沿导航顺序共用一套卷次、题名与读法", () => {
    const chapters = realmCodexChapters();

    expect(chapters.map((chapter) => chapter.tab)).toEqual([
      "realm",
      "classics",
      "yi",
      "ziwei",
      "xiang",
      "qimen",
    ]);
    expect(chapters.map((chapter) => chapter.index)).toEqual(["壹", "贰", "叁", "肆", "伍", "陆"]);
    expect(chapters.map((chapter) => chapter.title)).toEqual([
      "界域",
      "典籍",
      "周易",
      "紫微",
      "星象",
      "奇门",
    ]);
    expect(chapters.every((chapter) => chapter.hint.length > 0)).toBe(true);
    expect(realmCodexChapter("xiang")).toEqual({
      tab: "xiang",
      index: "伍",
      title: "星象",
      hint: "值日之宿只利一方，先看今日所利",
    });
    expect(() => realmCodexChapter("unknown" as never)).toThrow("unknown realm codex chapter");
  });

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
    expect(view, "界域册给左右两页留稳定落点").toContain("data-realm-codex-desk");
    expect(view, "当前境与四界卷目归左页").toContain("realm-codex-desk__lead");
    expect(view, "境界谱归右页").toContain("realm-codex-desk__volumes");
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
      /@media \(min-width: 1100px\)\s*\{[\s\S]{0,500}\.realm-codex-desk\s*\{[\s\S]{0,180}grid-template-columns:\s*minmax\(21rem, 0\.9fr\) minmax\(0, 1\.1fr\)/,
    );
    expect(css).toMatch(
      /@media \(min-width: 1100px\)\s*\{[\s\S]{0,900}\.realm-codex-desk__lead \.realm-world-index__grid\s*\{[\s\S]{0,120}minmax\(0, 1fr\)/,
    );
    expect(css).toMatch(
      /@media \(max-width: 220px\)\s*\{[\s\S]{0,1400}\.realm-world-index__grid\s*\{[\s\S]{0,120}minmax\(0, 1fr\)/,
    );
  });

  it("此刻、四界卷目与境界谱摊在同一张开口账页,不把每层都包成方卡", () => {
    const css = source("src/style.css");
    const start = css.indexOf("/*\n   * 界域案");
    const end = css.indexOf("\n  @media (min-width: 620px)", start);
    const codexCss = css.slice(start, end);

    expect(latestRule(codexCss, ".realm-atlas"), "页首四界谱只留谱线").toMatch(/border:\s*0;/);
    expect(latestRule(codexCss, ".realm-now"), "当前境改成开口总账").toMatch(
      /border:\s*0;[\s\S]*?border-top:/,
    );
    expect(latestRule(codexCss, ".realm-now"), "当前境不再复制一张实底卡片").toContain(
      "background: transparent;",
    );
    expect(codexCss, "当前境不再画四边内框").not.toContain(".realm-now::before");
    expect(latestRule(codexCss, ".realm-world-index"), "四界卷目只留上下账线").toMatch(
      /border:\s*0;[\s\S]*?border-block:/,
    );
    expect(latestRule(codexCss, ".realm-volume"), "每界卷身不再套第二层方框").toMatch(
      /border:\s*0;[\s\S]*?border-top:/,
    );
    expect(latestRule(codexCss, ".realm-ledger"), "境界谱改连续账列").toMatch(/gap:\s*0;/);
    expect(latestRule(codexCss, ".realm-entry"), "境界格只留行间账线").toMatch(
      /border:\s*0;[\s\S]*?border-bottom:/,
    );
    expect(
      latestRule(codexCss, ".realm-entry__ordinal"),
      "开口卷面不再托浅纸底,小序号要升到可读的第二档墨",
    ).toContain("color: var(--color-ink-soft);");
  });

  it("六册收在同一张开口长账,典籍与术数四门不再逐段借通用纸片", () => {
    const view = source("src/views/RealmCodexView.vue");
    const css = source("src/styles/pages/realm-codex.css");
    const layout = source("scripts/layout-check.mjs");

    expect(view, "六册共用一个可识别、可切册的连续账页").toMatch(
      /data-realm-codex-folio[\s\S]{0,180}:data-chapter="codexTab"/,
    );
    for (const chapter of ["realm", "classics", "yi", "ziwei", "xiang", "qimen"]) {
      expect(view, `${chapter} 册要落在同一账页内`).toContain(
        `data-realm-codex-chapter="${chapter}"`,
      );
    }
    expect(view, "正文不再逐段复制通用的 card-ink 纸片").not.toContain("card-ink");
    expect(css, "外层只留上下账线").toMatch(
      /\.realm-codex-folio\s*\{[\s\S]{0,420}border:\s*0;[\s\S]{0,420}border-block:\s*1px solid/,
    );
    expect(css, "内册与账段撤掉四边卡、圆角、实底与投影").toMatch(
      /\.realm-codex-chapter,\s*\.realm-codex-section\s*\{[\s\S]{0,620}border:\s*0;[\s\S]{0,620}border-radius:\s*0;[\s\S]{0,620}background:\s*transparent;[\s\S]{0,620}box-shadow:\s*none;/,
    );
    expect(css, "账段之间只留分段线").toMatch(
      /\.realm-codex-section\s*\+\s*\.realm-codex-section\s*\{[\s\S]{0,120}border-top:\s*1px solid/,
    );
    expect(css, "账页不另画第二层内框").not.toMatch(
      /\.realm-codex-(?:folio|chapter|section)::before/,
    );
    expect(css, "极窄档的术数行退成单列,不靠固定列宽硬挤").toMatch(
      /@media \(max-width: 220px\)\s*\{[\s\S]{0,2400}\.realm-(?:hexagram-row|fate-row|mansion-row|qimen-row)\s*\{[\s\S]{0,140}grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
    expect(css, "命格之力在极窄档先报题再摊整行读数").toMatch(
      /\.realm-fate-power\s*\{[\s\S]{0,100}flex-wrap:\s*wrap;[\s\S]{0,220}\.realm-fate-power > span:first-child\s*\{[\s\S]{0,80}flex-basis:\s*100%/,
    );
    expect(css, "典籍的短境界链也守住 28px 横向触控面").toMatch(
      /\.realm-classic__realm\s*\{[\s\S]{0,80}min-inline-size:\s*28px;/,
    );
    expect(css, "两处展开键守住 28px 触控下限").toMatch(
      /\.realm-codex-disclosure\s*\{[\s\S]{0,180}min-(?:block-size|height):\s*28px;/,
    );
    expect(layout, "真浏览器门要逐册量连续账与极窄档").toContain("realmCodexChapterSheets");
  });

  it("六册各起同一枚章首,卷次、读法与章内真值同源", () => {
    const view = source("src/views/RealmCodexView.vue");
    const head = source("src/components/common/FolioChapterHead.vue");
    const css = source("src/styles/pages/realm-codex.css");
    const layout = source("scripts/layout-check.mjs");

    expect(view.match(/<FolioChapterHead\b/g), "六册每册只起一枚章首").toHaveLength(6);
    for (const chapter of ["realm", "classics", "yi", "ziwei", "xiang", "qimen"]) {
      expect(view, `${chapter} 册章首直读同一份卷次装配`).toContain(`v-bind="${chapter}Chapter"`);
      expect(view, `${chapter} 册章首必须报本册真值`).toContain(`:fact="${chapter}ChapterFact"`);
      expect(view, `${chapter} 册卷次来自统一装配`).toContain(`realmCodexChapter("${chapter}")`);
    }
    expect(view, "通用节题已从界域志退场").not.toMatch(
      /<SectionTitle\b|SectionTitle from "@\/components\/common\/SectionTitle.vue"/,
    );

    expect(view).toMatch(
      /const realmChapterFact = computed\([\s\S]{0,300}realmOverview\.value\.worldCount[\s\S]{0,180}realmOverview\.value\.total[\s\S]{0,180}realmOverview\.value\.passed/,
    );
    expect(view).toMatch(/const classicsChapterFact = computed\([\s\S]{0,180}CLASSICS\.length/);
    expect(view).toMatch(
      /const yiChapterFact = computed\([\s\S]{0,320}TRIGRAMS\.length[\s\S]{0,180}HEXAGRAMS\.length[\s\S]{0,220}currentReading\.value/,
    );
    expect(view).toMatch(
      /const ziweiChapterFact = computed\([\s\S]{0,300}PALACES\.length[\s\S]{0,160}STARS\.length[\s\S]{0,180}fateModsText\.value/,
    );
    expect(view).toMatch(
      /const xiangChapterFact = computed\([\s\S]{0,300}MANSIONS\.length[\s\S]{0,180}favoredWorldName\.value[\s\S]{0,180}mansionLuckText\(\)/,
    );
    expect(view).toMatch(
      /const qimenChapterFact = computed\([\s\S]{0,180}GATES\.length[\s\S]{0,120}QIMEN_PALACE_COUNT/,
    );

    expect(head).toContain("data-folio-chapter-head");
    expect(view).toContain(':data-chapter="realmChapter.tab"');
    expect(view.match(/data-realm-codex-chapter-head/g), "六册各留自己的巡页指纹").toHaveLength(6);
    expect(head).toContain("folio-chapter-head__index");
    expect(head).toContain("folio-chapter-head__title");
    expect(head).toContain("folio-chapter-head__hint");
    expect(head).toContain("folio-chapter-head__fact");

    expect(css, "六册章首共用界域志的石青强调").toMatch(
      /\.realm-codex-folio\s*\{[\s\S]{0,320}--folio-chapter-accent:\s*var\(--color-qing\)/,
    );
    expect(head, "390 与 200% 缩放时章内真值退到题名下方").toMatch(
      /@media \(max-width: 520px\)\s*\{[\s\S]{0,900}\.folio-chapter-head__tail\s*\{[\s\S]{0,120}grid-column:\s*2/,
    );
    expect(layout, "真浏览器门逐册量章号、题名、读法与真值").toContain("[data-folio-chapter-head]");
    expect(layout, "真浏览器门在 1280 再核章内真值回到右侧").toContain(
      "realmCodexChapterSheets(1280)",
    );
  });
});

/**
 * 卷首不复述索引按钮已经说过的境界范围。
 *
 * 界域卷目那排按钮各自写着「第 15–18 境」,而展开后的卷首又写了一遍 ——
 * 两处实测相距 85px(btnTop 670 / bodyTop 755),都在首屏,同一个范围在同一眼里
 * 读两遍。按钮给的是「这一卷覆盖哪些境界」的索引,卷首该说的是这一卷**是什么**。
 */
describe("卷首不复述索引的范围标签", () => {
  it("rangeLabel 与 status 都只出现在索引按钮里", () => {
    const view = readSource("src/views/RealmCodexView.vue");
    // 剥掉 HTML 注释:注释里提到 rangeLabel 是在解释它为何被删,不该算渲染
    const rendered = view
      .split("<!--")
      .map((chunk, i) => (i === 0 ? chunk : chunk.slice(chunk.indexOf("-->") + 3)))
      .join("");
    const hits = (rendered.match(/row\.rangeLabel/g) ?? []).length;
    expect(hits, "rangeLabel 只该在卷目按钮里出现一次").toBe(1);
    // status 同理:它就在上方 56px 的按钮里,卷首再写一遍是同一眼里的重复
    const statusHits = (rendered.match(/row\.status/g) ?? []).length;
    expect(statusHits, "status 也只该在卷目按钮里出现一次").toBe(1);
    // 防空转:确认真的读到了这个文件
    expect(rendered, "没取到 realm-world-index 按钮").toContain("data-world-toggle");
    expect(rendered, "卷首仍在").toContain("realm-volume__head");
  });
});

/**
 * 界域总述与章首 fact 读同一份来源。
 *
 * 总述此前读 `WORLDS.length` / `REALMS.length` 两个字面量,而章首 fact 读的是
 * 由 rows 折出来的 worldCount 与 total —— 两本账,首屏还重复(top 319 / 557)。
 */
describe("界域总述 · 与章首 fact 同源", () => {
  it("总述不读 WORLDS.length / REALMS.length 这类字面量", () => {
    const view = readSource("src/views/RealmCodexView.vue");
    // 剥注释:注释里写着「此前读的是 WORLDS.length」是在解释原因
    const index = view
      .slice(view.indexOf("data-realm-world-index"), view.indexOf("realm-world-index__grid"))
      .split("<!--")
      .map((chunk, i) => (i === 0 ? chunk : chunk.slice(chunk.indexOf("-->") + 3)))
      .join("");
    expect(index, "总述要读 realmOverview 那一份").toContain("realmOverview.worldCount");
    expect(index, "总述不许再读 WORLDS.length").not.toContain("WORLDS.length");
    expect(index, "总述不许再读 REALMS.length").not.toContain("REALMS.length");
  });

  it("防空转", () => {
    const view = readSource("src/views/RealmCodexView.vue");
    expect(view.indexOf("data-realm-world-index")).toBeGreaterThan(0);
    expect(view.indexOf("realm-world-index__grid")).toBeGreaterThan(
      view.indexOf("data-realm-world-index"),
    );
  });
});
