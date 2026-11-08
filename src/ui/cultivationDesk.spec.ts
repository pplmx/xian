describe("卷首灵气一格:别只写「见下文」", () => {
  /*
   * 修行页 1942px(2.30 屏),其中「还差多少」这件事实**说了三遍**:
   *
   *   卷首灵气格  「未充盈 · 见下文还差多少」   0 个数字,纯指路
   *   账首 hint    「充盈还差约 3分42秒」        时间口径
   *   灵气条主行    「距灵气充盈尚差 9.866亿」    数量口径
   *
   * 后两条各答各的(还差多久 / 还差多少),都该留;第一条什么也没说 ——
   * 卷首这一格已经报了「灵气 0%」,再补一句「见下文」等于占着一行位置指路。
   *
   * 该报的是**这一格自己的实质**:充盈之后拿到什么。那是玩家看一眼就想要的答案,
   * 也是下面两处都没说的(它们只报差多少,不报「值不值得等」)。
   */
  it("未充盈时报「充盈后能拿到什么」,不写「见下文」", () => {
    const view = readSource("src/views/CultivationView.vue");
    /*
     * 只在**模板表达式**里查:注释里提到这句话是记录来由(说明「原先写的是它」),
     * 那是该留的;要拦的是它被写进渲染路径。
     */
    /*
     * **三种引号都要拦** —— 第一版只写 `"[^"]*见下文还差多少[^"]*"`,只认双引号。
     * 而本视图有 23 处反引号中文(模板字面量),把同一句话写成 `` `见下文还差多少` ``
     * 判据就看不见了(注入验证当场撞到)。单引号同理。
     *
     * 注释里的那句是**来由记录**(「原先写的是它」),该留 —— 故只查被引号包住的形态,
     * 三种引号各一条。
     */
    for (const re of [
      /"[^"]*见下文还差多少[^"]*"/,
      /'[^']*见下文还差多少[^']*'/,
      /`[^`]*见下文还差多少[^`]*`/,
    ]) {
      expect(view, `不许再拿「见下文还差多少」当渲染文案(没拦住 ${re.source})`).not.toMatch(re);
    }
    expect(view, "要报充盈之后的收益").toContain("充盈后修炼 +${formatPercent(QI_RICH_BONUS)}");
  });
});

import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { cultivationChapter, cultivationChapters } from "@/ui/cultivationDesk";

const source = readSource;

describe("修炼案 · 四章收成一册行功续卷", () => {
  it("章序只装配一次:修行、下一步、随身、功法四章不缺不乱", () => {
    expect(cultivationChapters().map((chapter) => chapter.key)).toEqual([
      "practice",
      "next",
      "support",
      "gongfa",
    ]);
    expect(cultivationChapters().map((chapter) => chapter.title)).toEqual([
      "修 行",
      "下一步",
      "随身",
      "功法",
    ]);
    expect(cultivationChapter("next")).toMatchObject({
      index: "贰",
      hint: "关口看把握,闭关看当下",
    });
  });

  it("卷首改成随主题换纸的内观台,用周天盘承接境界、阶段与修为进度", () => {
    const view = source("src/views/CultivationView.vue");
    const dial = source("src/components/cultivation/CultivationDial.vue");
    const css = source("src/styles/pages/cultivation.css");

    expect(view, "修炼卷首要有稳定的周天盘落点").toMatch(
      /<template #visual>[\s\S]{0,160}<CultivationDial\s*\/>/,
    );
    expect(view, "周天盘必须真的接进修炼页").toContain(
      'import CultivationDial from "@/components/cultivation/CultivationDial.vue"',
    );
    expect(view, "卷首运行时要能定位修行阶段").toContain("data-cultivation-stage");
    expect(view, "阶段标签要能按状态换色").toContain(':data-phase="stage.key"');
    expect(view, "内观台先给余程、行速与灵气").toContain("data-cultivation-stage-readout");
    expect(view, "阶段判据必须住在 core").toContain('from "@/core/cultivationStage"');
    expect(dial, "周天盘刻度与界域志共用 realmLadderPoints").toContain("realmLadderPoints");
    expect(dial, "内圈进度必须读真实修为进度").toContain("player.expProgress");
    expect(dial, "境数由刻度现算,不许手写 21").toContain("points.length");
    expect(dial, "正进度不许被一位小数抹成 0%").toContain('"<0.1%"');
    expect(dial, "暗场与纸面共用一枚盘,只切换已定义的色组").toContain(':data-tone="tone"');
    expect(dial, "周天盘按 140px 实尺寸留位").toMatch(
      /\.cultivation-dial\s*\{[\s\S]{0,1000}?width:\s*140px;[\s\S]{0,80}?height:\s*140px;/,
    );
    expect(dial, "纯视觉不重复读屏正文").toContain('aria-hidden="true"');
    expect(css, "内观台要随纸面昼夜翻转").toContain(
      "linear-gradient(124deg, rgb(var(--color-paper-deep-rgb)), rgb(var(--color-paper-dark-rgb)))",
    );
    expect(css, "内观台不许再覆盖成固定书口色组").not.toContain("--chrome-");
    expect(source("scripts/layout-check.mjs"), "修行卷首的昼夜底色要由真浏览器量").toContain(
      '"[data-cultivation-stage]"',
    );
  });

  it("同一个读数不在首屏出现两遍 —— 行速归内观台,灵气格留独有信息", () => {
    /*
     * 「此刻行速」曾经在同屏出现两处:卷首内观台一格、正文行功账的计量条一格,
     * 连「基础 N · 加成 M」都一字不差。390×844 实测两处都在首屏(top 332 与 676),
     * 玩家同一眼里读到两遍同一个数。
     *
     * 分工应当是:行速归内观台(那里本就是「余程 / 行速 / 灵气」三格);
     * 行功账里的灵气格保留 —— 它有内观台没有的东西(充盈还差多少、引气静养的入口)。
     */
    const view = source("src/views/CultivationView.vue");
    // 行速只在卷首那一格出现(注释里提到旧位置不算)
    const rendered = view.replace(/<!--[\s\S]*?-->/g, "");
    /*
     * 判据只盯**同屏常驻**的那两处。行速在源码里另有两处正当出现:
     *   · 点开「来路」后的算式结果(要按一下才看到,是解释而非复读);
     *   · 修为详情的 hint(在浮层里)。
     * 故这里量的是「行功账的计量条里还有没有它」,不是全文件出现次数。
     */
    // 行功账里只剩灵气一格
    expect(rendered, "行功账的计量条不该再复读行速").not.toMatch(
      /cultivation-ledger__meters[\s\S]{0,900}?此刻行速/,
    );
    expect(rendered, "灵气格要保留(它有内观台没有的独有信息)").toContain(
      'cultivation-ledger__meter-label">灵气',
    );
  });

  it("正文从卷首直接续到一张行功账,章首由同一份章序落位", () => {
    const view = source("src/views/CultivationView.vue");
    const register =
      view.match(/<article class="cultivation-register[\s\S]*?<\/article>/)?.[0] ?? "";

    expect(register, "正文四章同住一册续卷").toContain("data-cultivation-register");
    expect(view, "修行账要有独立运行时指纹").toContain("data-cultivation-ledger");
    expect(view, "修行账改用续卷章首").toContain("<FolioChapterHead");
    expect(view, "章首标题仍从章序读取修行").toContain(':title="practiceChapter.title"');
    // 读数走 realmOrdinalText():分母只认 REALMS.length 一处。
    // 从前这里钉的是拼接式 `第 ${player.major + 1} / ${REALMS.length} 境`,
    // 而全站另有三处同款读数各写一遍 —— 抽出来之后,钉的是「读同一份」。
    expect(view, "境界位置收进章首右侧读数席").toContain(':fact="realmOrdinalText(player.major)"');
    expect(view, "旧的自绘印章章首不再保留").not.toContain("cultivation-ledger__seal");
    expect(view, "修为主值要有独立落点").toContain("data-cultivation-primary");
    expect(view, "灵气与速度要有次读数区").toContain("data-cultivation-meters");
    expect(view, "进度条仍读同一条修为进度").toContain(':value="player.expProgress"');
    expect(view, "修为主值仍点开同一份详情").toContain(':rows="expDetailRows"');
    expect(view, "灵气仍点开同一份详情").toContain(':rows="qiDetailRows"');
    expect(view, "主进度属信息层,与行速、灵气同用石青").toContain(
      'color="var(--color-qing)" :height="10"',
    );
  });

  it("破境、闭关、随身与功法都沿同一账线续排,正文不再套卡片壳", () => {
    const view = source("src/views/CultivationView.vue");
    const register =
      view.match(/<article class="cultivation-register[\s\S]*?<\/article>/)?.[0] ?? "";
    const next = view.match(/<section[^>]*data-cultivation-next[\s\S]*?<\/section>/)?.[0] ?? "";
    const gongfa = source("src/components/cultivation/GongfaSection.vue");
    const breakthrough = source("src/components/cultivation/BreakthroughCard.vue");
    const retreat = source("src/components/cultivation/RetreatCard.vue");
    const tribulation = source("src/components/cultivation/TribulationPanel.vue");

    expect(next, "下一步章首从同一章序读取").toContain(':title="nextChapter.title"');
    expect(next, "破境卡仍留在下一步章节").toContain("<BreakthroughCard />");
    expect(next, "闭关卡仍留在下一步章节").toContain("<RetreatCard />");
    expect(next, "两项行动收进同一条账列").toContain('class="cultivation-next__rows"');
    expect(view, "状态与速服也是续卷的一章").toContain('data-cultivation-chapter="support"');
    expect(view, "功法章接在随身之后").toMatch(
      /<GongfaSection\s+class="cultivation-register__chapter cultivation-gongfa"/,
    );
    expect(register, "整册正文不再借 card-ink").not.toContain("card-ink");
    for (const [name, panel] of [
      ["破境", breakthrough],
      ["闭关", retreat],
      ["劫势", tribulation],
      ["功法", gongfa],
    ] as const) {
      expect(panel, `${name}不再套通用卡片壳`).not.toContain("card-ink");
    }
    expect(breakthrough, "破境是一条行功账行").toContain('data-cultivation-action="breakthrough"');
    expect(retreat, "闭关是一条行功账行").toContain('data-cultivation-action="retreat"');
  });

  it("续卷只留上下账线,主键是朱砂短笔而非整行色带", () => {
    const css = source("src/style.css");

    expect(css, "续卷只由上下账线收束").toMatch(
      /\.cultivation-register\s*\{[\s\S]{0,260}border-top:\s*1px solid[\s\S]{0,120}border-bottom:\s*1px solid/,
    );
    expect(css, "桌面仍把修行与下一步并读").toMatch(
      /\.cultivation-register__main\s*\{[\s\S]{0,260}grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
    expect(css, "行动主键不铺满账行").toMatch(
      /\.cultivation-action__primary\s*\{[\s\S]{0,520}width:\s*fit-content;[\s\S]{0,260}max-width:\s*72%/,
    );
    expect(css, "账行本身不整行铺底").toMatch(
      /\.cultivation-action\s*\{[\s\S]{0,280}background:\s*transparent;/,
    );
    expect(css, "极窄档仍按单列续排").toMatch(
      /@media \(max-width: 220px\)\s*\{[\s\S]{0,1800}\.cultivation-action__primary/,
    );
  });

  it("下一步始终单列承接两条行动,极窄档不横向溢出", () => {
    const css = source("src/style.css");

    expect(css).toMatch(
      /\.cultivation-next__rows\s*\{[\s\S]{0,160}grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
    expect(css).toMatch(/@media \(max-width: 220px\)\s*\{[\s\S]{0,1800}\.cultivation-next__rows/);
  });

  it("真浏览器门核四章续账、零卡壳与朱砂短笔", () => {
    const layout = source("scripts/layout-check.mjs");

    expect(layout, "修行续卷要有独立真渲染任务").toContain("async function taskCultivationFold()");
    expect(layout, "运行时先定位整册续卷").toContain(
      'document.querySelector("[data-cultivation-register]")',
    );
    expect(layout, "四章要逐章核到").toContain(
      'register?.querySelectorAll("[data-cultivation-chapter]")',
    );
    expect(layout, "续卷里不许再有卡片壳").toContain(
      'register?.querySelectorAll(".card-ink").length',
    );
    expect(layout, "主键宽度要真量").toContain("[data-cultivation-primary-action]");
    expect(layout, "行动色要真读 computed color").toContain("getComputedStyle(button).color");
    expect(layout, "信息层要回到石青").toContain("chapterFactColors");
    expect(layout, "修行首屏任务要挂进巡页").toContain(
      '["修行续卷的四章与行动层", taskCultivationFold]',
    );
  });
});
