import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

const source = readSource;

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
    const pulse = view.slice(view.indexOf("data-celestial-pulse"), view.indexOf("</LedgerPulse>"));
    /*
     * 总账不许回卷首。
     *
     * 它此前住在 `FolioPageHeader` 里,卷首因此 571px —— 占 736 首屏的 68%,
     * 全站单块最高的卷首。卷首答「这是哪一页」,这张总账答「今天先做哪一册」,
     * 属于正文第一件事;坊市页早就把同类总账放在 `</FolioPageHeader>` 之后。
     */
    const mastheadEnd = view.indexOf("</FolioPageHeader>");
    expect(mastheadEnd, "卷首要能定位到").toBeGreaterThan(-1);
    expect(
      view.indexOf("data-celestial-pulse"),
      "今日天门总账又搬回卷首了 —— 它会重新把首屏吃成只剩页头",
    ).toBeGreaterThan(mastheadEnd);

    expect(markers, "总账运行时落点只能有一个").toHaveLength(1);
    expect(view, "汇总仍走 core/celestialOverview 唯一一份").toContain("celestialOverview({");
    expect(view, "道途总数读数据源").toContain("total: DAO_PATHS.length");
    expect(view, "试炼总数读数据源").toContain("trialIds: TRIALS.map((trial) => trial.id)");
    expect(view, "道痕上限读机制常量").toContain("marksTotal: MAX_MARKS");
    expect(view, "总账四册可一键落位").toContain('v-for="row in celestialLedgerRows"');
    expect(view, "今日天门接共享此刻账").toContain("<LedgerPulse");
    expect(pulse, "先手动作读共享动作键").toContain("folio-ledger-pulse__action");
    expect(pulse, "四册账格由共享组件承担").toContain("<LedgerTally");
    expect(pulse, "手机账格交两列").toContain(':tally-columns="2"');
    expect(pulse, "桌面账格交四列").toContain(':tally-wide-columns="4"');
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

    expect(view, "道途册收成一册两章续卷").toContain(
      'class="celestial-dao-ledger" data-celestial-dao-ledger',
    );
    expect(
      [...view.matchAll(/data-celestial-chapter="([^"]+)"/g)].map((match) => match[1]),
      "道途、门径两章必须依次续排",
    ).toEqual(["dao", "gateways"]);
    expect(view, "两章共用统一章首").toMatch(/<FolioChapterHead[\s\S]*<FolioChapterHead/);
    expect(view, "道途章首报道此世真实道途").toContain(
      ':fact="currentDao ? `${currentDao.name} · 已定` : `${DAO_PATHS.length} 道待择`"',
    );
    expect(view, "门径章首报到器魂槽位真值").toContain(
      ':fact="`器魂 ${soulPulse.activeCount}/${soulPulse.slotTotal}`"',
    );
    expect(view, "正文不再另起通用节题").not.toContain("<SectionTitle");
    expect(view, "道途正文按已定与待择分流").toContain('<article v-if="currentDao"');
    expect(view, "规则与章法分栏").toContain('class="celestial-dao__columns"');
    expect(view, "剑意层数读纯函数").toContain("swordInfo.layers");
    expect(view, "剑意上限读机制常量").toContain("SWORD_PURITY_MAX_LAYERS");
    expect(view, "七道选择仍遍历 DAO_PATHS").toContain('v-for="dao in DAO_PATHS"');
    expect(view, "选择仍走二次确认").toContain('@click="pickDao(dao.id)"');
    expect(view, "熔炉与器魂仍是两处门径").toContain('class="celestial-gateway');
    expect(view, "器魂入口继续读同一份槽位账").toContain("soulPulse.activeCount");
  });

  it("远征册两章常在,空途先报未启程,世界行不再套卡壳", () => {
    const expedition = source("src/components/celestial/ExpeditionPanel.vue");
    const ledger = expedition.slice(0, expedition.indexOf("<BaseModal"));

    expect(expedition, "远征册收成一册续卷").toContain(
      'class="celestial-expedition-ledger" data-celestial-expedition-ledger',
    );
    expect(
      [...expedition.matchAll(/data-celestial-chapter="([^"]+)"/g)].map((match) => match[1]),
      "在途远征与特殊世界必须常驻并按序续排",
    ).toEqual(["run", "worlds"]);
    expect(expedition, "没有在途远征时首章仍要在场").toContain(
      '<section class="celestial-expedition-chapter" data-celestial-chapter="run" data-celestial-run>',
    );
    expect(expedition, "空途要给出可见的空态").toContain("data-celestial-run-empty");
    expect(expedition, "世界章首读世界数据源,不再另算可启程判据").toContain(
      "CELESTIAL_WORLDS.length + (endgame.voidWorld ? 1 : 0)",
    );
    expect(expedition).toContain("'虚门可窥' : '虚门待窥'");
    expect(expedition, "可启程界数只留总账一处判据").not.toContain("affordableWorldCount");
    expect(expedition, "世界候选不再另组一份账").not.toContain("worldCandidates");
    expect(expedition, "特殊世界逐界成开口账行").toContain('class="celestial-world-row"');
    expect(expedition, "虚界也沿同一组世界账行").toContain(
      'class="celestial-world-row celestial-world-row--void"',
    );
    expect(ledger, "远征正文不再套同权卡壳").not.toContain("card-ink");
  });

  it("道痕册用统一章首报卷内则数,主卷与今昔对照撤掉卡壳", () => {
    const marks = source("src/components/celestial/MarksPanel.vue");
    const ledger = marks.slice(0, marks.indexOf("<BaseModal"));

    expect(marks, "道痕正文收成一册续卷").toContain(
      'class="celestial-marks-ledger"\n    data-celestial-marks-ledger',
    );
    expect(marks, "道痕册只留一章真实落点").toContain('data-celestial-chapter="marks"');
    expect(marks, "章首走统一组件").toContain("<FolioChapterHead");
    expect(marks, "章首报卷内则数与上限同源").toContain(
      ':fact="`${endgame.marks.length} / ${MAX_MARKS} 则`"',
    );
    expect(marks, "今昔对照改开口账行").toContain('class="celestial-marks-compare"');
    expect(marks, "主卷改开口账行").toContain("celestial-marks-list");
    expect(marks, "空态也沿同一册面").toContain("celestial-marks-empty");
    expect(ledger, "主卷、对照与空态不再套卡壳").not.toContain("card-ink");
  });

  it("天道已变浮层把纪元变迁收成开口长账", () => {
    const marks = source("src/components/celestial/MarksPanel.vue");
    const layout = source("scripts/layout-check.mjs");
    const era = marks.slice(marks.indexOf("<BaseModal"), marks.indexOf("</BaseModal>"));

    expect(era, "纪元变迁要有稳定运行时落点").toContain("data-era-ledger");
    expect(era, "纪元变迁沿卷身上下账线续排").toContain(
      'class="mt-2.5 divide-y divide-ink/10 border-y border-ink/10"',
    );
    expect(era, "纪元条目与空态不再借通用纸卡").not.toContain("card-ink");
    expect(layout, "真浏览器要核纪元变迁浮层没有内层卡壳").toContain("data-era-ledger");
  });

  it("天道熔炉只在卷身续账,熔材行不再套第二张纸卡", () => {
    const furnace = source("src/components/celestial/FurnaceDialog.vue");
    const layout = source("scripts/layout-check.mjs");

    expect(furnace, "熔炉正文要有稳定落点").toContain("data-furnace-ledger");
    expect(furnace, "熔材行不再借通用纸卡").not.toContain("card-ink");
    expect(furnace, "熔炉动作行在 200% 档上下续排").toContain("tinylens:flex-col");
    expect(furnace, "熔炉动作键在 200% 档吃满整行").toContain("tinylens:w-full");
    expect(layout, "真浏览器要核熔炉浮层没有内层卡壳").toContain("data-furnace-ledger");
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

  it("天界正文收成开口卷册:外层不套卡,道途与门径只留分栏线", () => {
    const css = source("src/styles/pages/celestial.css");
    const expedition = source("src/components/celestial/ExpeditionPanel.vue");
    const book = css.match(/\.celestial-book\s*\{([\s\S]*?)\n  \}/)?.[1] ?? "";
    const card = css.match(/\.celestial-dao__card\s*\{([\s\S]*?)\n  \}/)?.[1] ?? "";
    const choice = css.match(/\.celestial-dao__choice\s*\{([\s\S]*?)\n  \}/)?.[1] ?? "";
    const gateway = css.match(/\.celestial-gateway\s*\{([\s\S]*?)\n  \}/)?.[1] ?? "";

    expect(book, "天界卷册又长回了四边框").toContain("border: 0;");
    expect(book, "天界卷册又铺了一层实底").toContain("background: transparent;");
    expect(book, "天界卷册又投出卡片阴影").toContain("box-shadow: none;");
    expect(card, "道途卡仍是四面封口的盒子").toContain("border-block:");
    expect(choice, "七道选项仍各套一只盒子").toContain("border-top:");
    expect(gateway, "两处门径仍各套一只盒子").toContain("border-top:");
    expect(expedition, "远征择路也改开口行").toContain('class="celestial-route-choice');
  });

  it("试炼域也收成一册四章,八场试炼与挑战书不再各套同权卡", () => {
    const trial = source("src/components/celestial/TrialPanel.vue");
    const css = source("src/styles/pages/celestial.css");
    const ledger = css.match(/\.celestial-trial-ledger\s*\{([\s\S]*?)\n  \}/)?.[1] ?? "";

    expect(trial, "试炼正文要有一册连续续卷").toContain(
      'class="celestial-trial-ledger" data-celestial-trial-ledger',
    );
    expect(
      [...trial.matchAll(/data-celestial-trial-chapter="([^"]+)"/g)].map((match) => match[1]),
      "四章必须按今日天道、变数、试炼、挑战书续排",
    ).toEqual(["daily", "mutation", "trials", "challenge"]);
    expect(trial, "章首走统一组件").toContain("<FolioChapterHead");
    expect(trial, "今日题、变数与挑战书都要有运行时落点").toContain("data-celestial-daily");
    expect(trial).toContain("data-celestial-mutation");
    expect(trial).toContain("data-celestial-challenge");
    expect(trial, "八场试炼仍逐项读取 TRIALS").toContain('v-for="(trial, index) in TRIALS"');
    expect(trial, "每场试炼要有稳定运行时门印").toContain(':data-celestial-trial="trial.id"');
    expect(trial, "试炼正文不再套旧卡壳").not.toContain("card-ink");
    expect(ledger, "续卷外层不封四边框").toContain("border-inline: 0;");
    expect(ledger, "续卷外层不铺卡底").toContain("background: transparent;");
    expect(ledger, "续卷外层不投卡影").toContain("box-shadow: none;");
    expect(css, "试炼名录要有稳定的八门印谱").toContain(".celestial-trial-roster");
  });

  it("八门试炼先选门印再读证道帖,不再把八份规则同时摊到底", () => {
    const trial = source("src/components/celestial/TrialPanel.vue");
    const css = source("src/styles/pages/celestial.css");
    const actions = trial.match(/data-celestial-trial-action/g) ?? [];

    expect(trial, "八门印谱要有独立运行时落点").toContain("data-celestial-trial-atlas");
    expect(trial, "每枚门印先读场次与纪录").toContain("data-celestial-trial-seal");
    expect(trial, "选中门印要报给读屏").toContain(':aria-pressed="selectedTrialId === trial.id"');
    expect(trial, "门印走 roving tabindex,不在移动端留八个 Tab 停点").toContain(
      ':tabindex="selectedTrialId === trial.id ? 0 : -1"',
    );
    expect(trial, "方向键可在八门间移印").toContain('@keydown="moveTrial($event, index)"');
    expect(trial, "下方只留一份证道帖").toContain("data-celestial-trial-detail");
    expect(trial, "换门印时整帖随选中项替换").toContain(':key="selectedTrial.id"');
    expect(trial, "默认先选最近一处未破门印").toContain(
      "TRIALS.find((trial) => !endgame.trialRecords[trial.id])",
    );
    expect(actions, "八门不能各挂一枚主按钮,整章只留一处应试").toHaveLength(1);
    expect(css, "手机先铺四列门印").toMatch(
      /\.celestial-trial-roster\s*\{[\s\S]{0,180}grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/,
    );
    expect(css, "桌面八门并成一排").toMatch(
      /@media \(min-width: 960px\)\s*\{[\s\S]*?\.celestial-trial-roster\s*\{[\s\S]{0,160}grid-template-columns:\s*repeat\(8, minmax\(0, 1fr\)\)/,
    );
    expect(css, "200% 缩放档门印退两列").toMatch(
      /@media \(max-width: 279px\)\s*\{[\s\S]*?\.celestial-trial-roster\s*\{[\s\S]{0,160}grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/,
    );
    expect(css, "门印仍是开口谱,不再长回卡片").toMatch(
      /\.celestial-trial-seal\s*\{[\s\S]{0,360}border-radius:\s*0;[\s\S]{0,360}box-shadow:\s*none;/,
    );
  });

  it("挑战书先选四程之一,当前只摊一程,约文与验约始终可见", () => {
    const trial = source("src/components/celestial/TrialPanel.vue");
    const css = source("src/styles/pages/celestial.css");

    expect(trial, "四程要有独立的立契约台").toContain("data-celestial-challenge-workbench");
    expect(trial, "四程入口走单选 tablist").toContain('role="tablist"');
    expect(trial, "四程逐项读取同一声明源").toContain('v-for="(step, index) in CHALLENGE_STEPS"');
    expect(trial, "每程要有稳定运行时入口").toContain("data-celestial-challenge-step");
    expect(trial, "当前程只留一个 tabpanel").toContain("data-celestial-challenge-panel");
    expect(trial, "四程入口走 roving tabindex").toContain(
      ':tabindex="challengeStep === step.id ? 0 : -1"',
    );
    expect(trial, "方向键可在四程间移步").toContain('@keydown="moveChallengeStep($event, index)"');
    expect(trial, "约文摘要把已选规则带出当前程").toContain("data-celestial-challenge-contract");
    expect(trial, "验约与立约不能藏进某一程").toContain("data-celestial-challenge-actions");
    expect(css, "手机四程铺两列").toMatch(
      /\.celestial-challenge-steps\s*\{[\s\S]{0,180}grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/,
    );
    expect(css, "960 起四程收成左栏,当前程在右展开").toMatch(
      /@media \(min-width: 960px\)\s*\{[\s\S]*?\.celestial-challenge-workbench\s*\{[\s\S]{0,200}grid-template-columns:\s*minmax\(8\.5rem, 0\.28fr\) minmax\(0, 1fr\)/,
    );
    expect(css, "200% 缩放档四程退单列").toMatch(
      /@media \(max-width: 220px\)\s*\{[\s\S]*?\.celestial-challenge-steps\s*\{[\s\S]{0,120}grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
  });

  it("天界战报收成一册证道战卷,四章同账且场次键盘同步战局与战报", () => {
    const view = source("src/views/CelestialView.vue");
    const report = source("src/components/celestial/CelestialReportLedger.vue");
    const gauntlet = source("src/components/celestial/GauntletPanel.vue");
    const css = source("src/styles/pages/celestial.css");
    const layout = source("scripts/layout-check.mjs");

    expect(view, "战报浮层改挂一册证道战卷").toContain('title="证道战卷"');
    expect(view, "战报正文交给独立战卷组件").toContain("<CelestialReportLedger");
    expect(view, "逐场摘要、判词与奖励不再留在主视图各拼一段").not.toContain("bg-paper-deep/70");
    expect(report, "战卷要有稳定运行时落点").toContain(
      'class="celestial-report-ledger" data-celestial-report-ledger',
    );
    expect(
      [...report.matchAll(/data-celestial-report-chapter="([^"]+)"/g)].map((match) => match[1]),
      "战果、战局、逐场与此战之判必须依次续排",
    ).toEqual(["result", "field", "fights", "judgement"]);
    expect(report.match(/<FolioChapterHead/g) ?? [], "四章共用同一章首").toHaveLength(4);
    expect(report, "战局由主文件持有当前场,场签与战报同源").toContain(':current="currentFight"');
    expect(report, "场签切换回写到战卷").toContain('@select="selectFight"');
    expect(report, "逐场账行要有稳定运行时落点").toContain("data-celestial-report-fight");
    expect(report, "逐场账行标出当前场").toContain(':data-current="currentFight === index');
    expect(report, "战果、逐场与判词不再另套圆角纸卡").not.toContain("rounded-[2px]");
    expect(gauntlet, "场次入口走单一 tablist").toContain('role="tablist"');
    expect(gauntlet, "每场是真正的 tab").toContain('role="tab"');
    expect(gauntlet, "选中场要报给读屏").toContain(':aria-selected="current === i"');
    expect(gauntlet, "场次走 roving tabindex").toContain(':tabindex="current === i ? 0 : -1"');
    expect(gauntlet, "方向键与 Home / End 在场次间移动").toContain(
      '@keydown="moveFight($event, i)"',
    );
    expect(gauntlet, "对阵仍是受控 tabpanel").toContain('role="tabpanel"');
    expect(gauntlet, "回放仍由暂停感知时钟推进").toContain("gameClock(");
    expect(gauntlet, "关动效仍直接给结果").toContain("settings.reduceMotion");
    expect(gauntlet, "日志颜色仍由同一张 KIND_COLOR 表决定").toContain("KIND_COLOR[entry.t]");
    expect(gauntlet, "伤害数字与暴击着色不得回退").toContain('v-if="entry.dmg"');
    expect(gauntlet, "旧场次芯片、对阵卡与日志框不再留下圆角卡壳").not.toContain("rounded-[2px]");
    expect(gauntlet, "旧通用纸卡不再混进战卷").not.toContain("card-ink");
    expect(css, "战卷只留上下账线,不铺侧框、圆角与卡底").toMatch(
      /\.celestial-report-ledger\s*\{[\s\S]{0,260}border:\s*0;[\s\S]{0,180}border-block:\s*1px solid;[\s\S]{0,180}border-radius:\s*0;[\s\S]{0,180}background:\s*transparent;[\s\S]{0,180}box-shadow:\s*none;/,
    );
    expect(css, "四章之间只留分段线").toMatch(
      /\.celestial-report-chapter\s*\+\s*\.celestial-report-chapter\s*\{[\s\S]{0,80}border-top:\s*1px solid/,
    );
    expect(css, "场签退成开口账格").toMatch(
      /\.celestial-fight-tab\s*\{[\s\S]{0,360}border-radius:\s*0;[\s\S]{0,220}background:\s*transparent;[\s\S]{0,120}box-shadow:\s*none;/,
    );
    expect(css, "当前场只用朱砂 inset 线,不重新长成实心胶囊").toMatch(
      /\.celestial-fight-tab\.is-selected\s*\{[\s\S]{0,180}box-shadow:\s*inset 0 -2px 0/,
    );
    expect(css, "对阵与战报退成同一张透明账页").toMatch(
      /\.celestial-gauntlet__station\s*\{[\s\S]{0,300}border:\s*0;[\s\S]{0,180}background:\s*transparent;/,
    );
    expect(css, "960 起对阵与战报并读").toMatch(
      /@media \(min-width: 960px\)\s*\{[\s\S]*?\.celestial-gauntlet__station\s*\{[\s\S]{0,220}grid-template-columns:\s*minmax\(0, 0\.42fr\) minmax\(0, 1fr\)/,
    );
    expect(css, "200% 缩放档场签退单列").toMatch(
      /@media \(max-width: 220px\)\s*\{[\s\S]*?\.celestial-fight-tabs\s*\{[\s\S]{0,120}grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
    expect(layout, "真浏览器要核证道战卷、场签与日志三档").toContain(
      "data-celestial-report-ledger",
    );
  });

  it("手机总账两栏,960 起四栏并读,220 以下星图读数与门径退单列", () => {
    const css = source("src/style.css");
    const start = css.indexOf(".celestial-pulse {");
    const end = css.indexOf("/*\n * 分段选择(.ink-choice)", start);
    const celestialCss = css.slice(start, end);
    const sharedHead = source("src/components/common/FolioChapterHead.vue");

    expect(start, "天界样式段要能定位到").toBeGreaterThan(-1);
    expect(end, "天界样式段要有明确结尾").toBeGreaterThan(start);
    expect(celestialCss).toMatch(
      /@media \(min-width: 960px\)\s*\{[\s\S]{0,900}\.celestial-dao__columns\s*\{[\s\S]{0,140}minmax\(0, 0\.92fr\)/,
    );
    expect(celestialCss).toMatch(
      /@media \(max-width: 220px\)\s*\{[\s\S]{0,1400}\.celestial-gateway\s*\{[\s\S]{0,120}grid-template-columns:\s*2rem minmax\(0, 1fr\)/,
    );
    expect(celestialCss, "世界账行手机与窄桌面先单列续读").toMatch(
      /\.celestial-world-ledger\s*\{[\s\S]{0,140}grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
    expect(celestialCss, "960 起世界账行两栏并读").toMatch(
      /@media \(min-width: 960px\)\s*\{[\s\S]{0,1200}\.celestial-world-ledger\s*\{[\s\S]{0,120}grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/,
    );
    expect(sharedHead, "手机与 200% 缩放时章内读数退到题名下方").toMatch(
      /@media \(max-width: 520px\)\s*\{[\s\S]{0,900}\.folio-chapter-head__tail\s*\{[\s\S]{0,160}grid-column:\s*2/,
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
  /*
   * 天道变数:「应 战」不许被它前面那三条变数文案推着走。
   *
   * 变数文案长短差三倍(「天时紧迫」7 字、「药石无灵」21 字),而三条各占一行
   * 且会折行。原先动作排在这三条**之后**:195 CSS px 下「应 战」随文案长短在
   * 1178~1209px 之间挪 31px,玩家每探一次天机就得重新找按钮。
   *
   * 动作只依赖「这条变数要花多少」(mutationDaoShort),不依赖那三条写多长,
   * 故它排在清单之前。判据在源码层钉顺序;真浏览器位移由 layout-check 的
   * 「变数按钮不许被变数文案推着走」量。
   */
  it("天道变数的「应 战」排在变数清单之前 —— 探一次换一副文案,按钮一步不动", () => {
    const trial = source("src/components/celestial/TrialPanel.vue");
    const mutationAt = trial.indexOf("data-celestial-mutation");
    const actionsAt = trial.indexOf("celestial-trial-actions", mutationAt);
    const rowsAt = trial.indexOf("celestial-trial-mutation__rows", mutationAt);

    expect(mutationAt, "天道变数那一章要有稳定落点").toBeGreaterThan(-1);
    expect(actionsAt, "变数那一章要有动作行").toBeGreaterThan(-1);
    expect(rowsAt, "变数清单要有稳定落点").toBeGreaterThan(-1);
    expect(actionsAt, "「应 战」又跑回变数清单后面了 —— 文案一长一短,按钮就上下挪").toBeLessThan(
      rowsAt,
    );
  });
});
