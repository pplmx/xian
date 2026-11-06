import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

const source = readSource;

describe("历练案 · 先看今日行旅,再把第一个可行方向摆到眼前", () => {
  it("卷首罗盘只报今日利方,路线进度继续读世界页同一份阶段视图", () => {
    const view = source("src/views/AdventureView.vue");
    const compass = source("src/components/adventure/AdventureCompass.vue");
    const ribbon = source("src/components/world/MortalWorldRibbon.vue");

    expect(view, "历练卷首要挂今日行旅罗盘").toMatch(
      /<template #visual>[\s\S]{0,180}<AdventureCompass/,
    );
    expect(view, "历练页必须真的接入罗盘组件").toContain(
      'import AdventureCompass from "@/components/adventure/AdventureCompass.vue"',
    );
    expect(view, "星象只从值日之宿推利方").toContain("favoredWorld(todayMansionDef.value)");
    expect(compass, "四界位置从境界数据取,不另抄一份界名").toContain("WORLDS");
    expect(compass, "纯视觉不重复读屏正文").toContain('aria-hidden="true"');
    expect(view, "路线进度仍读本世阶段判据").toContain("mortalStageStatuses(");
    expect(view, "路线仍从世界视图翻译").toContain("worldView(");
    expect(view, "历练页仍挂同一份行旅条").toContain("<MortalWorldRibbon");
    expect(ribbon, "行旅条保留稳定运行时落点").toContain("data-world-ribbon");
  });

  it("今日行旅把星象、所钟、三档概率与勿扰状态收成一张说明账", () => {
    const view = source("src/views/AdventureView.vue");
    const briefing =
      view.match(/<section[^>]*data-adventure-briefing[\s\S]*?<\/section>/)?.[0] ?? "";

    expect(briefing, "今日行旅要是续卷的第一章").toContain('data-adventure-chapter="briefing"');
    expect(briefing, "今日行旅章首仍写原名").toMatch(
      /class="adventure-register__title">今日行旅<\/h2>/,
    );
    expect(briefing, "今日行旅直接展示星象账").toContain("{{ mansionLine }}");
    expect(view, "星象仍从 todayMansion 现算").toContain("todayMansion(game.totalPlaySec)");
    expect(briefing, "利方概率由星象账直接摊开").toContain("{{ mansionLuckText() }}");
    expect(view, "读数文案只有一处实现(core/astronomy)").toMatch(
      /import \{[^}]*mansionLuckText[^}]*\} from "@\/core\/astronomy"/,
    );
    expect(briefing, "利方说明要写清他处不加").toContain("他处不加");
    expect(briefing, "途中三档仍走唯一档位表").toContain("EVENT_TIERS");
    expect(briefing, "每档概率按当前缘分状态现算").toContain("tierOddsText(t.id, chainPending)");
    expect(briefing, "所钟标签仍从 biasEffectOf 取").toContain("{{ biasLabel }}");
    expect(briefing, "所钟说明要收成一行,给 390 首屏的出发键留余量").toContain("只放大此路所得。");
    expect(briefing, "所钟行保留稳定判据落点").toContain("data-bias-hint");
    expect(briefing, "遇事勿扰要在出发前看得见").toContain("遇事勿扰开启");
    expect(briefing, "遇事勿扰要能就地关闭").toContain('@click="settings.dndEvents = false"');
  });

  it("首个可出发地界由统一准入与镇压态现算,并在列表里单独抬出来", () => {
    const view = source("src/views/AdventureView.vue");

    expect(view, "可往返列表仍从 visibleRegionRows 收口").toContain("visibleRegionRows(");
    expect(view, "首个可出发项不许把镇压收益中算进去").toContain(
      "visibleRows.value.find((row) => row.canEnter && !row.suppressed)?.id",
    );
    expect(view, "首项要有稳定运行时标记").toContain(
      ":data-adventure-next=\"row.id === nextActionableId ? '' : undefined\"",
    );
    expect(view, "首项要有独立视觉态").toContain(
      "'adventure-region--next': row.id === nextActionableId",
    );
    expect(view, "出发按钮仍只认统一准入").toContain('v-if="row.canEnter && !row.suppressed"');
    expect(view, "当前路线仍排在同界域最前").toContain(
      "Number(b.isRouteCurrent) - Number(a.isRouteCurrent)",
    );
  });

  it("石青渐变托出的首个地界用正文墨色,10px 地点描述不贴着 AA 线", () => {
    const view = source("src/views/AdventureView.vue");
    const css = source("src/styles/pages/adventure.css");

    expect(css, "首个地界确实铺了一层石青渐变").toMatch(
      /\.adventure-region--next\s*\{[\s\S]{0,150}linear-gradient\(115deg,\s*rgb\(var\(--color-qing-rgb\) \/ 0\.045\)/,
    );
    expect(view, "地点描述在渐变卡上必须用 ink-soft;ink-faint 只剩贴着 4.5:1 的余量").toMatch(
      // 行高由角色类 .t-note 给(等价于 text-note + leading-relaxed),判据只钉「有读数档行高」与墨色
      /<p\s+v-if="row\.canEnter"\s+class="mt-2 (?:t-note|text-note leading-relaxed) text-ink-soft"\s*>\s*\{\{\s*row\.def\.desc\s*\}\}/,
    );
  });

  it("主线地界先落地,秘境退到主线之后,规则留在页尾", () => {
    const view = source("src/views/AdventureView.vue");

    const regionsAt = view.indexOf("data-adventure-regions");
    const secretAt = view.indexOf("data-adventure-secret");
    const rulesAt = view.indexOf("data-adventure-rules");
    expect(regionsAt, "主线地界要有稳定落点").toBeGreaterThan(-1);
    expect(secretAt, "旁路秘境要有稳定落点").toBeGreaterThan(regionsAt);
    expect(rulesAt, "行旅规则要收在页尾").toBeGreaterThan(secretAt);
    expect(view.slice(regionsAt, secretAt), "主线章节要明说眼下可往").toMatch(
      /class="adventure-register__title">眼下可往<\/h2>/,
    );
    expect(view.slice(secretAt, rulesAt), "支线仍在主线之后挂真入口").toContain(
      "<SecretRealmCard embedded />",
    );
    expect(view.slice(rulesAt), "规则仍读同一份镇压阈值").toContain("SUPPRESS_THRESHOLDS.minWins");
  });

  it("地界沿山河线连续排布,沿线状态只翻译现有准入与镇压事实", () => {
    const view = source("src/views/AdventureView.vue");
    const css = source("src/styles/pages/adventure.css");
    const atlas =
      view.match(/<div[^>]*data-adventure-atlas[\s\S]*?<\/section>\s*<\/div>/)?.[0] ?? "";
    const stateAt = view.indexOf("function atlasStateOf");
    const groupAt = view.indexOf("/** 按界域分组展示");

    expect(view, "主线路要挂稳定的行旅图落点").toContain("data-adventure-atlas");
    expect(atlas, "每个界域要有地图章头").toContain('class="adventure-atlas__chapter"');
    expect(atlas, "地界要沿同一条轨道排列").toContain('class="adventure-atlas__trail"');
    expect(atlas, "每个停靠点保留运行时状态").toContain(':data-atlas-state="atlasStateOf(row)"');
    expect(atlas, "节点序号直接读当前可见顺序").toContain('String(rowIndex + 1).padStart(2, "0")');
    expect(atlas, "原区域卡落点不许在改版中丢失").toContain("data-region-card");
    expect(stateAt).toBeGreaterThan(-1);
    expect(groupAt).toBeGreaterThan(stateAt);
    const stateFn = view.slice(stateAt, groupAt);
    expect(stateFn, "行旅图只翻译路线事实").toContain("row.isRouteCurrent");
    expect(stateFn, "行旅图只翻译首个可行动事实").toContain("nextActionableId.value");
    expect(stateFn, "行旅图不许另判准入").not.toContain("canEnterRegion");
    expect(css, "地图用一条左侧轨道串起地界").toMatch(
      /\.adventure-atlas__stop\s*\{[\s\S]{0,180}grid-template-columns:\s*1\.35rem minmax\(0, 1fr\)/,
    );
    expect(css, "当前程在轨道上用石青抬出").toMatch(
      /data-atlas-state="current"[\s\S]{0,220}--color-qing-rgb/,
    );
    expect(css, "未至处只留虚线节点").toMatch(
      /data-atlas-state="locked"[\s\S]{0,100}border-style:\s*dashed/,
    );
    expect(css, "195 宽把节点移到卡上方,不给正文再挤一列").toMatch(
      /@media \(max-width: 220px\)\s*\{[\s\S]{0,1600}\.adventure-atlas__stop\s*\{[\s\S]{0,180}grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
  });

  it("途中三档与行旅之则收成两行「注」:默认合着,文案一字不少", () => {
    const view = source("src/views/AdventureView.vue");

    /*
     * 三档概率是参考、镇压规则是解释 —— 都不是此刻要做的决定。
     * 两处收成同一枚「注」原语:默认合着,点开一字不少;三档的缘起状态留在注外。
     */
    expect(view, "两处说明走同一枚注原语").toContain(
      'import FolioNote from "@/components/common/FolioNote.vue"',
    );
    expect(view, "三档挂在稳定落点上").toContain('<FolioNote name="adventure-tiers"');
    expect(view, "行旅之则挂在稳定落点上").toContain('<FolioNote name="adventure-rules"');
    expect(view, "三档仍读唯一档位表").toContain('v-for="t in EVENT_TIERS"');
    expect(view, "镇压规则仍读同一份常数").toContain("SUPPRESS_THRESHOLDS.minWins");
    expect(view, "三档的缘起状态仍留在注外").toContain('class="adventure-briefing__tier-head"');
  });

  it("今日行旅、山河路账、秘境与行旅之则共成一张开口长卷", () => {
    const view = source("src/views/AdventureView.vue");
    const css = source("src/styles/pages/adventure.css");
    const layout = source("scripts/layout-check.mjs");
    const chapters = [...view.matchAll(/data-adventure-chapter="([^"]+)"/g)].map(
      ([, chapter]) => chapter,
    );

    expect(view, "整册外框要成为唯一连续账页").toMatch(
      /<article\s+class="adventure-register folio-span-all"\s+data-adventure-register\s+data-adventure-folio\s+data-adventure-console\s*>/,
    );
    expect(chapters, "四章按玩家阅读顺序续排").toEqual(["briefing", "regions", "secret", "rules"]);
    expect(view, "两套案头与卡片皮都退出历练正文").not.toMatch(
      /<SectionTitle\b|adventure-briefing__sheet/,
    );
    expect(view, "秘境卡要以嵌入态接入同一续卷").toMatch(/<SecretRealmCard\s+embedded\s*\/>/);
    expect(css, "连续账页只留上下账线").toMatch(
      /\.adventure-register\s*\{[\s\S]{0,520}border:\s*0;[\s\S]{0,520}border-block:\s*1px solid/,
    );
    expect(css, "四章撤掉四边卡、圆角、底色与投影").toMatch(
      /\.adventure-register__chapter\s*\{[\s\S]{0,620}border:\s*0;[\s\S]{0,620}border-radius:\s*0;[\s\S]{0,620}background:\s*transparent;[\s\S]{0,620}box-shadow:\s*none;/,
    );
    expect(css, "章间只以分段线接续前账").toMatch(
      /\.adventure-register__chapter \+ \.adventure-register__chapter\s*\{[\s\S]{0,160}border-top:\s*1px solid/,
    );
    expect(css, "秘境嵌入正文后不再另起四边卡").toMatch(
      /\.adventure-secret__desk\s*\{[\s\S]{0,420}padding:\s*0;[\s\S]{0,420}border:\s*0;[\s\S]{0,420}border-radius:\s*0;[\s\S]{0,420}background:\s*transparent;[\s\S]{0,420}box-shadow:\s*none;/,
    );
    expect(layout, "真浏览器要核同一张历练续卷").toContain(
      'document.querySelector("[data-adventure-register]")',
    );
    expect(layout, "真浏览器要逐章核章序与章首").toContain(
      'document.querySelectorAll("[data-adventure-chapter]")',
    );
  });

  it("历练续卷手机单列、620 两栏、960 左账右山河,220 以下章态退整行", () => {
    const view = source("src/views/AdventureView.vue");
    const css = source("src/styles/pages/adventure.css");

    expect(css).toMatch(
      /\.adventure-register\s*\{[\s\S]{0,260}grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
    expect(css).toMatch(
      /@media \(min-width: 620px\)\s*\{[\s\S]{0,700}\.adventure-register\s*\{[\s\S]{0,140}repeat\(2, minmax\(0, 1fr\)\)/,
    );
    expect(css).toMatch(
      /@media \(min-width: 960px\)\s*\{[\s\S]{0,900}\.adventure-register\s*\{[\s\S]{0,140}repeat\(12, minmax\(0, 1fr\)\)/,
    );
    expect(view, "390 先收起重复正文的装饰罗盘,把首屏让给首个出发键").toMatch(
      /<template #visual>\s*<div class="phone:hidden">[\s\S]{0,260}<AdventureCompass/,
    );
    expect(css, "390 章首与卷间也要收薄,不能只靠藏一张图").toMatch(
      /@media \(max-width: 430px\)\s*\{[\s\S]{0,700}\.adventure-register__head\s*\{[\s\S]{0,100}padding-block:\s*0\.62rem 0\.48rem/,
    );
    expect(css, "桌面让山河主册占右侧大栏,今日账与旁路留左栏").toMatch(
      /@media \(min-width: 960px\)\s*\{[\s\S]{0,1600}\.adventure-register__chapter--regions\s*\{[\s\S]{0,180}grid-column:\s*5 \/ -1;[\s\S]{0,120}grid-row:\s*1 \/ span 3/,
    );
    expect(css).toMatch(
      /@media \(max-width: 220px\)\s*\{[\s\S]{0,2600}\.adventure-register__head\s*\{[\s\S]{0,220}grid-template-columns:\s*1\.7rem minmax\(0, 1fr\)/,
    );
    expect(css).toMatch(
      /@media \(max-width: 220px\)\s*\{[\s\S]{0,3000}\.adventure-register__state\s*\{[\s\S]{0,220}grid-column:\s*2;[\s\S]{0,120}justify-self:\s*start;[\s\S]{0,120}text-align:\s*left/,
    );
  });

  it("今日行旅与山河路账共成开口长卷,地界不再逐张套卡", () => {
    const view = source("src/views/AdventureView.vue");
    const css = source("src/styles/pages/adventure.css");
    const regionAt = view.indexOf("data-region-card");
    const regionEnd = view.indexOf("</article>", regionAt);
    const region = view.slice(regionAt, regionEnd);

    expect(regionAt, "地界行必须保留原运行时落点").toBeGreaterThan(-1);
    expect(region, "地界行不再套通用卡片皮").not.toContain("card-ink");
    expect(region, "一行先收图标、身份与主行动").toContain("adventure-region__lead");
    expect(region, "镇压与转收益是行内服务账,不是第二张卡").toContain("adventure-region__service");
    expect(region, "路况与说明要分栏但共用同一行").toContain("adventure-region__detail");
    expect(region).toContain("adventure-region__conditions");
    expect(region).toContain("adventure-region__reading");

    expect(css, "界域之间首尾相接,不再用组间距假装分册").toMatch(
      /\.adventure-atlas\s*\{[\s\S]{0,220}gap:\s*0;/,
    );
    expect(css, "每卷以账线续排").toMatch(
      /\.adventure-atlas__reach\s*\{[\s\S]{0,220}border-top:\s*1px solid/,
    );
    expect(css, "地界行本身不画第二层卡框").toMatch(
      /\.adventure-region\s*\{[\s\S]{0,420}border:\s*0;[\s\S]{0,420}border-radius:\s*0;[\s\S]{0,420}box-shadow:\s*none;/,
    );
    expect(css, "620px 起路况与地点说明并读").toMatch(
      /@media \(min-width: 620px\)[\s\S]{0,900}\.adventure-region__detail--paired\s*\{[\s\S]{0,180}grid-template-columns:\s*minmax\(0, 1\.1fr\) minmax\(0, 0\.9fr\)/,
    );
  });

  it("今日账把三档落成连续概率行,手机不靠三列硬挤,极窄档再拆行", () => {
    const css = source("src/styles/pages/adventure.css");
    const view = source("src/views/AdventureView.vue");

    expect(css, "卷首法球收在 124px,给 390 首屏的出发键留出安全间距").toMatch(
      /\.adventure-compass\s*\{[\s\S]{0,160}width:\s*124px/,
    );
    expect(view, "每一档都要留运行时落点").toContain(':data-event-tier="t.id"');
    expect(css, "三档常态是一条连续概率账,不再并成三列").toMatch(
      /\.adventure-briefing__tier\s*\{[\s\S]{0,260}?grid-template-areas:\s*"name brief odds"/,
    );
    expect(css, "概率读数不许折行").toMatch(
      /\.adventure-briefing__tier strong\s*\{[\s\S]{0,220}?white-space:\s*nowrap/,
    );
    expect(css, "320/375/390 共用同一条连续概率行").not.toContain("@media (max-width: 359px)");
    expect(css).toMatch(
      /\.adventure-region--next\s*\{[\s\S]{0,120}border-left-color:\s*rgb\(var\(--color-qing-rgb\)/,
    );
    expect(css).toMatch(
      /@media \(max-width: 220px\)\s*\{[\s\S]{0,1800}\.adventure-route__body\s*\{[\s\S]{0,120}flex-direction:\s*column/,
    );
    expect(css).toMatch(
      /@media \(max-width: 220px\)\s*\{[\s\S]{0,2200}\.adventure-briefing__tier\s*\{[\s\S]{0,160}?grid-template-areas:\s*"name"\s*"odds"\s*"brief"/,
    );
    expect(css).toMatch(
      /@media \(max-width: 220px\)\s*\{[\s\S]{0,2200}\.adventure-route__head\s*\{[\s\S]{0,120}grid-template-columns:\s*auto minmax\(0, 1fr\)/,
    );
    expect(css).toMatch(
      /@media \(max-width: 220px\)\s*\{[\s\S]{0,2600}\.adventure-route__link\s*\{[\s\S]{0,100}justify-self:\s*end/,
    );
  });

  it("战局谱收成一册连续战卷,会话、战局、战报与近战情报不再逐段套纸卡", () => {
    const css = source("src/styles/pages/adventure.css");
    const view = source("src/components/adventure/CombatPanel.vue");
    const intel = source("src/components/adventure/BattleIntelPanel.vue");
    const layout = source("scripts/layout-check.mjs");

    expect(view, "战场正文要有稳定长卷落点").toContain("data-combat-ledger");
    expect(css, "战卷只留上下账线,不铺侧框与圆角").toMatch(
      /\.combat-desk\s*\{[\s\S]{0,260}border:\s*0;[\s\S]{0,180}border-block:\s*1px solid;[\s\S]{0,180}border-radius:\s*0;/,
    );
    for (const [name, selector] of [
      ["征途簿", "\\.combat-session"],
      ["战局", "\\.combat-arena"],
    ] as const) {
      expect(css, `${name}不再自成第二张纸卡`).toMatch(
        new RegExp(
          `${selector}\\s*\\{[\\s\\S]{0,300}border:\\s*0;[\\s\\S]{0,180}border-radius:\\s*0;[\\s\\S]{0,180}background:\\s*transparent;[\\s\\S]{0,180}box-shadow:\\s*none;`,
        ),
      );
    }
    expect(css, "战报框退成透明账页").toMatch(
      /\.combat-report__scroll\.scroll-pane\s*\{[\s\S]{0,300}border:\s*0;[\s\S]{0,180}background:\s*transparent;/,
    );
    expect(intel, "近战情报仍保留稳定章节落点").toContain("data-battle-intel");
    expect(css, "近战情报沿战卷续排").toMatch(
      /\.combat-intel\s*\{[\s\S]{0,300}border:\s*0;[\s\S]{0,180}border-top:\s*1px solid;[\s\S]{0,180}background:\s*transparent;/,
    );
    expect(css, "所知与分析展开后仍是账页,不再套内层纸卡").toMatch(
      /\.combat-intel__paper\s*\{[\s\S]{0,320}border:\s*0;[\s\S]{0,180}border-top:\s*1px solid;[\s\S]{0,180}background:\s*transparent;/,
    );
    expect(css, "390 首屏把战绩独占一行,其余三格并读").toMatch(
      /\.combat-session__stats > div\[data-combat-stat="record"\]\s*\{[\s\S]{0,220}grid-column:\s*1 \/ -1;[\s\S]{0,160}display:\s*flex;/,
    );
    expect(layout, "真浏览器要核战卷不再逐段套卡").toContain("[data-combat-ledger]");
  });
});
