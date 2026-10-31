import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { readStyleCss } from "@/test/readStyleCss";

const ROOT = resolve(__dirname, "../..");

function source(rel: string): string {
  if (rel === "src/style.css") return readStyleCss();
  return readFileSync(resolve(ROOT, rel), "utf8");
}

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

    expect(briefing, "今日行旅要有独立章节").toContain('title="今日行旅"');
    expect(briefing, "今日行旅直接展示星象账").toContain("{{ mansionLine }}");
    expect(view, "星象仍从 todayMansion 现算").toContain("todayMansion(game.totalPlaySec)");
    expect(briefing, "利方概率由星象账直接摊开").toContain("{{ describeMansionLuck }}");
    expect(view, "利方概率直接读引擎常数").toContain("formatPercent(MANSION_EVENT_LUCK, 0)");
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

  it("主线地界先落地,秘境退到主线之后,规则留在页尾", () => {
    const view = source("src/views/AdventureView.vue");

    const regionsAt = view.indexOf("data-adventure-regions");
    const secretAt = view.indexOf("data-adventure-secret");
    const rulesAt = view.indexOf("data-adventure-rules");
    expect(regionsAt, "主线地界要有稳定落点").toBeGreaterThan(-1);
    expect(secretAt, "旁路秘境要有稳定落点").toBeGreaterThan(regionsAt);
    expect(rulesAt, "行旅规则要收在页尾").toBeGreaterThan(secretAt);
    expect(view.slice(regionsAt, secretAt), "主线章节要明说眼下可往").toContain('title="眼下可往"');
    expect(view.slice(secretAt, rulesAt), "支线仍在主线之后挂真入口").toContain(
      "<SecretRealmCard />",
    );
    expect(view.slice(rulesAt), "规则仍读同一份镇压阈值").toContain("SUPPRESS_THRESHOLDS.minWins");
  });

  it("今日账把三档落成连续概率行,手机不靠三列硬挤,极窄档再拆行", () => {
    const css = source("src/styles/pages/adventure.css");
    const view = source("src/views/AdventureView.vue");

    expect(css, "卷首法球收在 124px,给 390 首屏的出发键留出安全间距").toMatch(
      /\.adventure-compass\s*\{[\s\S]{0,160}width:\s*124px/,
    );
    expect(css).toMatch(
      /\.adventure-briefing__sheet\s*\{[\s\S]{0,180}grid-template-columns:\s*minmax\(0, 1fr\)/,
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
      /@media \(max-width: 220px\)\s*\{[\s\S]{0,1200}\.adventure-route__body\s*\{[\s\S]{0,120}flex-direction:\s*column/,
    );
    expect(css).toMatch(
      /@media \(max-width: 220px\)\s*\{[\s\S]{0,1800}\.adventure-briefing__tier\s*\{[\s\S]{0,160}?grid-template-areas:\s*"name"\s*"odds"\s*"brief"/,
    );
    expect(css).toMatch(
      /@media \(max-width: 220px\)\s*\{[\s\S]{0,1800}\.adventure-route__head\s*\{[\s\S]{0,120}grid-template-columns:\s*auto minmax\(0, 1fr\)/,
    );
    expect(css).toMatch(
      /@media \(max-width: 220px\)\s*\{[\s\S]{0,2200}\.adventure-route__link\s*\{[\s\S]{0,100}justify-self:\s*end/,
    );
  });
});
