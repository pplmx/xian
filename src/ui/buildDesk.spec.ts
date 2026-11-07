import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { BUILD_STYLES, buildAffinityRows } from "@/core/buildDetect";
import { buildCoreGaps, buildStageMeter } from "./buildDesk";

const source = readSource;

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

  it("成路后收成一册铸道续卷，阶梯、下一步、形状、实战、快照与旧筑各有章位", () => {
    const view = source("src/views/BuildView.vue");
    const atlas = source("src/components/build/BuildAtlas.vue");
    const chapterHead = source("src/components/common/FolioChapterHead.vue");
    const layout = source("scripts/layout-check.mjs");
    const stageAt = view.indexOf("data-build-stage");
    const nextAt = view.indexOf("data-build-next");
    const shapeAt = view.indexOf("data-build-shape");

    expect(view).toMatch(/<FolioPageHeader[\s\S]{0,520}\bfeatured\b/);
    expect(view).toMatch(/<template #visual>[\s\S]{0,220}<BuildAtlas/);
    expect(view).toContain("buildStageMeter(");
    expect(view).toContain("buildCoreGaps(");
    expect(view).toContain("data-build-current");
    expect(view).toContain("data-build-formed");
    expect(view).toContain("data-build-register");
    expect(view).toContain("<FolioChapterHead");
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
    expect(stageAt, "道途阶梯要能定位").toBeGreaterThan(-1);
    expect(nextAt, "下一步要能定位").toBeGreaterThan(-1);
    expect(shapeAt, "五维形状要能定位").toBeGreaterThan(-1);
    expect(stageAt, "手机先读当前阶段").toBeLessThan(nextAt);
    expect(nextAt, "下一步要排在五维展开之前").toBeLessThan(shapeAt);
    expect(layout).toContain('document.querySelector("[data-build-atlas]")');
    expect(layout).toContain('document.querySelector("[data-build-register]")');
    expect(layout).toContain('querySelectorAll("[data-build-chapter]")');
    expect(layout).toContain("nextTop");
    expect(layout).toContain("shapeTop");
    expect(layout).toContain('"__buildFormedFixture"');
    expect(chapterHead).toContain("data-folio-chapter-head");
    expect(chapterHead).toContain("{{ index }}");
    expect(chapterHead).toContain("{{ title }}");
    expect(chapterHead).toContain("{{ hint }}");
    expect(chapterHead).toContain("{{ fact }}");
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

  it("续卷手机单列、620 两列、960 前三章并读，220 以下章态退整行", () => {
    const css = source("src/style.css");
    const sharedHead = source("src/components/common/FolioChapterHead.vue");
    const start = css.indexOf("/*\n   * 铸道案");
    const end = css.indexOf("/*\n   * 道途未成", start);
    const buildCss = css.slice(start, end);

    expect(start, "铸道样式段要能定位到").toBeGreaterThan(-1);
    expect(end, "铸道样式段要有明确结尾").toBeGreaterThan(start);
    expect(buildCss).toMatch(
      /\.build-page \.folio-masthead__book\s*\{[\s\S]{0,80}color:\s*rgb\(var\(--color-ink-soft-rgb\)\)/,
    );
    expect(buildCss, "卷首眉读要升到第二档墨,别在渐变纸上贴着 AA 下限").toMatch(
      /\.build-masthead__meta\s*\{[\s\S]{0,180}color:\s*var\(--color-ink-soft\)/,
    );
    expect(buildCss).toMatch(
      /\.build-register\s*\{[\s\S]{0,360}grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
    expect(buildCss).toMatch(
      /@media \(min-width: 620px\)\s*\{[\s\S]{0,1100}\.build-register\s*\{[\s\S]{0,160}repeat\(2, minmax\(0, 1fr\)\)/,
    );
    expect(buildCss).toMatch(
      /@media \(min-width: 960px\)\s*\{[\s\S]{0,600}\.build-register\s*\{[\s\S]{0,160}repeat\(3, minmax\(0, 1fr\)\)/,
    );
    expect(buildCss).toMatch(
      /@media \(max-width: 220px\)\s*\{[\s\S]{0,3000}\.build-matchup__rate\s*\{[\s\S]{0,100}grid-column:\s*2/,
    );
    expect(buildCss).toMatch(
      /\.build-page \.folio-masthead__visual\s*\{[\s\S]{0,220}position:\s*absolute/,
    );
    expect(buildCss, "390 的铸道盘要退成卷首水印").toContain("right: -2.8rem");
    expect(buildCss, "桌面要恢复铸道盘栏位").toMatch(
      /@media \(min-width: 620px\)\s*\{[\s\S]{0,220}\.build-page \.folio-masthead__visual\s*\{[\s\S]{0,100}position:\s*static/,
    );
    expect(buildCss, "两列时阶梯与下一步先并读，五维再续整行").toMatch(
      /@media \(min-width: 620px\)\s*\{[\s\S]{0,1800}grid-template-areas:[\s\S]{0,180}"stage next"[\s\S]{0,160}"shape shape"/,
    );
    expect(buildCss, "三列时按阅读顺序恢复阶梯 / 下一步 / 五维").toMatch(
      /@media \(min-width: 960px\)\s*\{[\s\S]{0,1000}\.build-register\s*\{[\s\S]{0,260}grid-template-areas:\s*"stage next shape"/,
    );
    expect(buildCss, "桌面铸道格里的章首保持等高").toMatch(
      /\.build-register__chapter > \.folio-chapter-head\s*\{[\s\S]{0,100}min-height:\s*5\.5rem/,
    );
    expect(sharedHead, "手机与 200% 缩放时章内真值退到章名下一行").toMatch(
      /@media \(max-width: 520px\)\s*\{[\s\S]{0,900}\.folio-chapter-head__tail\s*\{[\s\S]{0,120}grid-column:\s*2/,
    );
    expect(buildCss, "核心缺口的小字要在渐变纸上与墨色混合后仍读得清").toMatch(
      /\.build-core__gap\s*\{[\s\S]{0,120}color:\s*color-mix\(in srgb,\s*var\(--color-cinnabar\)\s*64%,\s*var\(--color-ink\)\s*36%\)/,
    );
  });
});

/**
 * 章首那颗「事实」不复述卷首已经报过的契合值。
 *
 * 它此前写的也是「契合 N%」,而卷首 meta 与下面的阶段行各有一枚 ——
 * 同一块里同一个数出现三次(实测 top 168 / 269 两枚相距 100px,都在首屏)。
 * 章首该答的是「离下一级还多远」,不是把当前值再念一遍。
 */
describe("铸道章首 · 报缺口不复述当前值", () => {
  const view = () => readSource("src/views/BuildView.vue");

  it("章首的 fact 不再是一个契合百分比", () => {
    const src = view();
    const chapterHead = src.slice(
      src.indexOf("data-build-chapter-head"),
      src.indexOf("build-register__body"),
    );
    expect(chapterHead, "章首 fact 不该再写「契合 N%」").not.toMatch(/:fact="`契合/);
    expect(chapterHead, "章首 fact 要读那个算缺口的 computed").toContain(':fact="stageFactText"');
  });

  it("缺口读 stageMeter 那一份,不另减一遍", () => {
    const src = view();
    const block = src.slice(src.indexOf("const stageFactText"), src.indexOf("const stageGapText"));
    expect(block, "要读 stageMeter.gap").toContain("stageMeter.value.gap");
    expect(block, "不许自己再写 target - aff —— 那是第二本账").not.toContain("target - aff");
  });

  it("防空转", () => {
    const src = view();
    expect(src).toContain("stageFactText");
    expect(src.indexOf("data-build-chapter-head")).toBeGreaterThan(0);
    expect(src.indexOf("build-register__body")).toBeGreaterThan(
      src.indexOf("data-build-chapter-head"),
    );
  });
});

describe("铸道案 · 同一个契合度不许在首屏说两遍", () => {
  /*
   * 实测(`layout-check` 连跑四遍,其中一遍红):
   *
   *   ✗ [320] /build 首屏把同一句说了两遍:«6%»
   *
   * 两个来源:
   *   @251  LedgerHeader 的 :score-value → formatPercent(closest.affinity, 0)
   *   @500  build-discovery__ledger 第三行 → formatPercent(closest.affinity, 0)
   *
   * 只要 hasTrace 为真,两处**必然**是同一个数;偶发是因为台账第三行
   * 有时落在 320×568 的首屏之外。终局里读者会看到「最近契合 6%」
   * 与「契合 6%」同屏,中间只隔两行台账。
   *
   * 账首报的是「最近那条路有多契合」(摘要),台账那格该报的是
   * **雏形线**——账首从来没有这个数,它正好解释第四行「距雏形」怎么算出来的。
   */
  it("账首报最近契合,台账那格只报雏形线 —— 两处不许同源", () => {
    const discovery = source("src/components/build/BuildDiscovery.vue");

    const head = discovery.match(/:score-value="([^"]+)"/)?.[1] ?? "";
    expect(head, "账首那句 score 定位不到 —— 判据会空转").toContain("closest.affinity");

    // 台账第三行(「契合」/「雏形线」那一格)不许再念一遍 closest.affinity
    // 注释也算进来会误伤:说明里提到这个字段名是正常的,只有模板表达式才算
    const ledger = (discovery.match(/data-build-ledger([\s\S]*?)<\/div>/)?.[1] ?? "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    expect(ledger.trim().length, "台账定位不到 —— 判据会空转").toBeGreaterThan(0);
    expect(
      (ledger.match(/closest\.affinity/g) ?? []).length,
      "台账里又念了一遍 closest.affinity —— 它与账首的 score 是同一个数,首屏会说两遍",
    ).toBe(0);
    // 无词条那一档仍要说出雏形线是多少,别把这一格留空
    expect(ledger, "台账那格要报雏形线(有词条/无词条都得有数)").toContain(
      "STYLE_EMERGENCE_AFFINITY",
    );
  });
});
