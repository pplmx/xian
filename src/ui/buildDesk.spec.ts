import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { BUILD_STYLES, buildAffinityRows } from "@/core/buildDetect";
import { buildCoreGaps, buildStageMeter } from "./buildDesk";

const source = readSource;

/**
 * 去掉注释,只留代码。
 *
 * 下面几条判据按「从 `const stageGapText` 切到下一个 `const`」的方式取一段源码
 * 再断言。切出来的那段**包含说明注释**,而注释里为了讲清来龙去脉会引用旧文案
 * (「距成形还差 25% 契合」)。于是「正文该保留缺口明细」这条 `/还差/` 断言
 * 可以靠注释里的引文满足 —— 真把正文字面量删掉,判据照样绿。
 *
 * 实测过:把 `stageGapText` 的返回值改成「下一条识别线…未过」(不含「还差」),
 * `expect(gap).toMatch(/还差/)` 仍通过,因为上面那段注释里写着「还差多少」
 * 与「距成形还差 25% 契合」。这正是本仓反复记的那类假绿。
 *
 * 故凡「按切片断言源码」的判据都先过这一层。保留换行,方便报错时对行。
 */
function stripComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

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
    /*
     * 缺口明细现在只在**正文那一句**里(stageGapText)—— 章首改报识别线汇总,
     * 见下面那组「章首 fact 与正文缺口不许是同一句话」。故判据跟着落到正文那一块:
     * 意图没变(不许另减一本账),落点随设计挪。
     */
    const src = view();
    const block = src.slice(src.indexOf("const stageGapText"), src.indexOf("const powerRating"));
    expect(block, "缺口要读 stageMeter 那一份").toContain("stageMeter");
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

describe("铸道案 · 章首 fact 与正文缺口不许是同一句话", () => {
  /*
   * 实测(`layout-check`,959×1024):
   *
   *   ✗ [959x1024] /build 首屏把同一句说了两遍:«25%»
   *
   * 两个来源在同一章里:
   *   @章首 fact   stageFactText → 「距下一形态还差 25%」
   *   @正文 build-copy stageGapText → 「距成形还差 25% 契合」
   *
   * 章首那颗位置本来就该报**这一章独有的汇总**,正文再摊细则 —— 反过来做,
   * 同一章开头一句、正文一句,读起来像两个不同的数(措辞还不一样:
   * 「下一形态」与「成形」),而它们其实是同一个 25%。
   *
   * 这条与卷首那组「账首报最近契合、台账报雏形线」是同一条纪律:
   * 两处相邻的读数席,不许报同一件事。
   */
  it("章首报识别线的汇总,正文报缺口明细 —— 两处不许都是「还差 N%」", () => {
    const src = source("src/views/BuildView.vue");
    const fact = stripComments(
      src.slice(src.indexOf("const stageFactText"), src.indexOf("const stageGapText")),
    );
    const gap = stripComments(
      src.slice(src.indexOf("const stageGapText"), src.indexOf("const powerRating")),
    );

    expect(fact.trim().length, "章首 fact 定位不到 —— 判据会空转").toBeGreaterThan(0);
    expect(gap.trim().length, "正文缺口定位不到 —— 判据会空转").toBeGreaterThan(0);

    /*
     * 正文那一句保留「还差 N% 契合」:它才是明细。
     *
     * 断言落在**返回值**上(`return \`…还差…\``),不是「这一段里出现过还差」——
     * 后者被注释满足过一次(见 `stripComments` 的说明),而那正是这条判据
     * 本轮差点整片假绿的由来。
     */
    expect(gap, "正文的返回值该保留缺口明细(还差 N 契合)").toMatch(/return\s*`[^`]*还差/);
    // 章首那一句不许再算同一个「还差 N%」
    expect(
      fact,
      "章首与正文都说「还差 N%」—— 同一章开头与正文各念一遍,而它们是同一个数",
    ).not.toMatch(/还差/);
  });

  it("章首改报「过了几条识别线」—— 那是正文没有的汇总", () => {
    const src = source("src/views/BuildView.vue");
    const fact = stripComments(
      src.slice(src.indexOf("const stageFactText"), src.indexOf("const stageGapText")),
    );
    // 注释里提到「识别线」不算数 —— 它必须真出现在返回值里
    expect(fact, "章首要读识别线那一份(过线数 / 总条数)").toMatch(/return\s*`[^`]*识别线/);
    expect(fact, "过线数要真数一遍 stageSteps,不许写死分母").toContain("stageSteps");
  });
});

describe("铸道案 · 章首 fact 不许复述列表首行", () => {
  /*
   * 实测(1280×800 展品档,layout-check 连跑三遍时红过一次):
   *
   *   ✗ [1280x800] /build 首屏把同一句说了两遍:«最弱 0%»
   *
   * 两处来源:
   *   @600  章首 fact        `最弱 ${formatPercent(weakestMatchup?.winRate, 0)}`
   *   @711  build-matchup__rate  `formatPercent(row.winRate, 0)`(列表首行)
   *
   * 而 `weakestMatchup = matchupSorted[0]`,列表也按 `matchupSorted` 渲染 ——
   * 首行与章首 fact **必然**是同一个数。相距 111px,同屏。
   *
   * 章首那句 eyebrow 自己写着「只报方向」,故 fact 该报的是**方向性的汇总**
   * (几类过半),而不是把列表第一行的百分比抄一遍。
   */
  it("章首 fact 报汇总(几类过半),不抄列表首行的百分比", () => {
    const view = source("src/views/BuildView.vue");

    // 章首那行 fact 不许再直接念 weakestMatchup.winRate
    // 定位到「实战面」那个章首块里的 :fact(这一页有多个 :fact,别抓错)
    const battleBlock = view.slice(view.indexOf("data-build-battle"));
    const factLine = battleBlock.match(/:fact="`[^`]+`"/)?.[0] ?? "";
    expect(factLine, "定位不到章首 fact —— 判据会空转").not.toBe("");
    expect(
      factLine,
      "章首 fact 又在念 weakestMatchup.winRate —— 它与对局列表首行是同一个数,同屏说两遍",
    ).not.toContain("weakestMatchup");

    // 但要真报一个汇总读数,不能留空
    expect(factLine, "章首 fact 要报「几类过半」这类汇总").toMatch(/过半|通过|胜/);
  });
});
