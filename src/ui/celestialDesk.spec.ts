import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");

function source(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("天界案 · 天门星图先立意,四册再落到总账", () => {
  it("卷首星图读四册真值,整图不重复进入读屏", () => {
    const view = source("src/views/CelestialView.vue");
    const map = source("src/components/celestial/CelestialGateMap.vue");

    expect(view, "天界卷首要走 featured 开卷版式").toMatch(
      /<FolioPageHeader[\s\S]{0,260}\bfeatured\b/,
    );
    expect(view, "天门星图要进独立主视觉槽").toMatch(
      /<template v-if="unlocked" #visual>[\s\S]{0,180}<CelestialGateMap/,
    );
    expect(view, "星图按当前册点亮天门").toContain(':active="celTab"');
    expect(view, "星图世界读数走卷首总账").toContain(
      ':worlds-cleared="celestialPulse.worldsCleared"',
    );
    expect(view, "星图今日天道走同一份总账").toContain(':daily-state="celestialPulse.dailyState"');
    expect(map, "纯视觉摘要不重复读屏正文").toContain('aria-hidden="true"');
    expect(map, "四册方位各自有真实运行时状态").toContain(
      ":class=\"{ 'is-active': active === 'marks' }\"",
    );
    expect(map, "星图收在 390 卷首的一屏内").toMatch(/width:\s*150px;[\s\S]{0,60}height:\s*124px;/);
  });

  it("今日天门把道途、远征、试炼与道痕收成一张总账并可直接切册", () => {
    const view = source("src/views/CelestialView.vue");
    const markers = view.match(/data-celestial-pulse(?![-\\w])/g) ?? [];
    const pulse = view.slice(
      view.indexOf("data-celestial-pulse"),
      view.indexOf("</FolioPageHeader>"),
    );

    expect(markers, "总账运行时落点只能有一个").toHaveLength(1);
    expect(view, "汇总仍走 core/celestialOverview 唯一一份").toContain("celestialOverview({");
    expect(view, "道途总数读数据源").toContain("total: DAO_PATHS.length");
    expect(view, "试炼总数读数据源").toContain("trialIds: TRIALS.map((trial) => trial.id)");
    expect(view, "道痕上限读机制常量").toContain("marksTotal: MAX_MARKS");
    expect(view, "总账四册可一键落位").toContain('v-for="row in celestialLedgerRows"');
    expect(pulse, "总账带道途运行时落点").toContain(":data-celestial-pulse-dao=");
    expect(pulse, "总账带远征运行时落点").toContain(":data-celestial-pulse-exped=");
    expect(pulse, "总账带试炼运行时落点").toContain(":data-celestial-pulse-trial=");
    expect(pulse, "总账带道痕运行时落点").toContain(":data-celestial-pulse-marks=");
    expect(pulse, "今日天门必须给出一条先手").toContain("celestialLead.title");
  });

  it("先手按在途远征、未择道途、今日天道与可启程道源依次落位", () => {
    const view = source("src/views/CelestialView.vue");
    const lead = view.slice(
      view.indexOf("const celestialLead = computed"),
      view.indexOf("const router"),
    );

    expect(lead, "在途远征先续行").toContain("if (endgame.worldRun && activeRunWorld.value)");
    expect(lead, "未择道途先定道").toContain("if (!pulse.daoChosen)");
    expect(lead, "今日天道可战则先应题").toContain('pulse.dailyState === "ready"');
    expect(lead, "有足够道源则先报可启程界数").toContain("if (affordableExpeditions.value > 0)");
    expect(lead, "今日已过时仍给再炼去向").toContain('pulse.dailyState === "done"');
    expect(lead, "先手只带路,不直接开战").not.toContain("openPrep(");
  });

  it("道途正文摊开代价、章法与剑意,七道选择仍读同一份数据源", () => {
    const view = source("src/views/CelestialView.vue");

    expect(view, "道途正文按已定与待择分流").toContain('<article v-if="currentDao"');
    expect(view, "规则与章法分栏").toContain('class="celestial-dao__columns"');
    expect(view, "剑意层数读纯函数").toContain("swordInfo.layers");
    expect(view, "剑意上限读机制常量").toContain("SWORD_PURITY_MAX_LAYERS");
    expect(view, "七道选择仍遍历 DAO_PATHS").toContain('v-for="dao in DAO_PATHS"');
    expect(view, "选择仍走二次确认").toContain('@click="pickDao(dao.id)"');
    expect(view, "熔炉与器魂仍是两处门径").toContain('class="celestial-gateway');
    expect(view, "器魂入口继续读同一份槽位账").toContain("soulPulse.activeCount");
  });

  it("远征、试炼与道痕面板仍按当前册互斥挂载,不把未激活状态混进页面", () => {
    const view = source("src/views/CelestialView.vue");

    expect(view, "远征面板按远征册挂载").toContain(
      '<ExpeditionPanel v-if="celTab === \'exped\'" @outcome="handleOutcome" />',
    );
    expect(view, "试炼面板按试炼册挂载").toContain(
      '<TrialPanel v-else-if="celTab === \'trial\'" :daily="daily" @report="openReport" />',
    );
    expect(view, "道痕面板按道痕册挂载").toContain(
      '<MarksPanel v-else-if="celTab === \'marks\'" @report="openReport" />',
    );
    expect(view, "今日天道只从日题纯函数取").toContain("todayChallenge()");
    expect(view, "远征世界从真实世界解析").toContain("resolveWorld(endgame.worldRun.worldId)");
  });

  it("手机总账两栏,960 起四栏并读,220 以下星图读数与门径退单列", () => {
    const css = source("src/style.css");
    const start = css.indexOf(".celestial-pulse {");
    const end = css.indexOf("/*\n * 开关", start);
    const celestialCss = css.slice(start, end);

    expect(start, "天界样式段要能定位到").toBeGreaterThan(-1);
    expect(end, "天界样式段要有明确结尾").toBeGreaterThan(start);
    expect(celestialCss).toMatch(
      /\.celestial-pulse__tallies\s*\{[\s\S]{0,120}grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/,
    );
    expect(celestialCss).toMatch(
      /@media \(min-width: 960px\)\s*\{[\s\S]{0,300}\.celestial-pulse__tallies\s*\{[\s\S]{0,120}repeat\(4, minmax\(0, 1fr\)\)/,
    );
    expect(celestialCss).toMatch(
      /@media \(min-width: 960px\)\s*\{[\s\S]{0,900}\.celestial-dao__columns\s*\{[\s\S]{0,140}minmax\(0, 0\.92fr\)/,
    );
    expect(celestialCss).toMatch(
      /@media \(max-width: 220px\)\s*\{[\s\S]{0,900}\.celestial-pulse__tallies\s*\{[\s\S]{0,100}grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
    expect(celestialCss).toMatch(
      /@media \(max-width: 220px\)\s*\{[\s\S]{0,1400}\.celestial-gateway\s*\{[\s\S]{0,120}grid-template-columns:\s*2rem minmax\(0, 1fr\)/,
    );
  });

  it("卷首册名过对比度,320 道源独占一行,195 世界名不被右侧行程挤竖", () => {
    const masthead = source("src/components/common/FolioPageHeader.vue");
    const expedition = source("src/components/celestial/ExpeditionPanel.vue");
    const css = source("src/style.css");

    expect(masthead, "顶栏册名要有稳定落点").toContain("folio-masthead__book");
    expect(masthead, "动作槽要有稳定落点").toContain("folio-masthead__action");
    expect(css, "天界册名改用中墨压住渐变纸").toMatch(
      /\.celestial-page \.folio-masthead__book\s*\{[\s\S]{0,80}color:\s*rgb\(var\(--color-ink-soft-rgb\)\)/,
    );
    expect(masthead, "320 道源动作退整行").toContain("compact:w-full");
    expect(expedition, "世界卡头部允许换行").toContain(
      'class="celestial-world__head flex flex-wrap items-center gap-2"',
    );
    expect(expedition, "世界名不参与压缩").toContain(
      'class="shrink-0 font-kai text-title tracking-[0.2em] text-ink"',
    );
    expect(expedition, "极窄档行程退到下一行").toContain("tinylens:ml-0 tinylens:basis-full");
  });
});
