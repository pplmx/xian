import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

const source = readSource;

function homeTemplate(): string {
  return source("src/views/HomeView.vue").split("<script setup")[0] ?? "";
}

describe("首页指挥台 · 先给今日一步，再摊长期账", () => {
  it("主题纸面主舞台、长期道途、日课与门径各有唯一运行时落点", () => {
    const home = homeTemplate();
    const markers = [
      "data-home-hero",
      "data-home-focus",
      "data-home-mainquest",
      "data-home-daily",
      "data-home-passages",
      "data-home-dongfu",
      "data-home-celestial",
    ];

    for (const marker of markers) {
      expect(home.match(new RegExp(marker, "g")), `${marker} 应只出现一次`).toHaveLength(1);
    }
    expect(home, "旧案头别名不该继续漂在 DOM 里").not.toContain("data-home-desk");
  });

  it("今日一步优先，当前目标只在今日一步退场后接管", () => {
    const home = homeTemplate();

    expect(home).toMatch(/<RouterLink\s+v-if="firstStep"/);
    expect(home).toMatch(/v-else-if="currentGoal"/);
    expect(home).toContain("data-home-goal");
    expect(home).toMatch(/v-if="firstStep && currentGoal"[\s\S]{0,260}currentGoal\.text/);
    expect(home).toContain("{{ firstStep.label }} →");
    expect(home).toContain("今日一步");
  });

  it("系统递来的当前道途都带目的册，进度与去处同屏但不伪造第二套读数", () => {
    const home = homeTemplate();
    const css = source("src/styles/pages/home.css");

    expect(home).toContain(":is=\"currentGoal.destination ? RouterLink : 'div'\"");
    expect(home).toContain(':to="currentGoal.destination?.to"');
    expect(home).toContain("currentGoal.destination.label");
    expect(css).toMatch(
      /\.home-deck__next-cue\s*\{[\s\S]{0,120}?color:\s*rgb\(var\(--color-cinnabar-rgb\)\)/,
    );
    expect(css).toMatch(
      /@media \(max-width: 220px\) \{[\s\S]{0,1200}?\.home-deck__next \{[\s\S]{0,180}?grid-template-areas:\s*"tag"\s*"body"\s*"action"/,
    );
  });

  it("今日一步占位时，其后那条道途仍可直达目的册", () => {
    const home = homeTemplate();
    const css = source("src/styles/pages/home.css");

    expect(home).toContain("data-home-goal-after");
    expect(home).toMatch(
      /v-if="firstStep && currentGoal"[\s\S]{0,260}?currentGoal\.destination \? RouterLink : 'p'/,
    );
    expect(home).toMatch(
      /data-home-goal-after[\s\S]{0,700}?currentGoal\.destination\.label[\s\S]{0,80}?→/,
    );
    expect(css).toMatch(
      /\.home-deck__after-action\s*\{[\s\S]{0,180}?color:\s*rgb\(var\(--color-ink-rgb\)\)/,
    );
    expect(css).toMatch(
      /a\.home-deck__after\s*\{[\s\S]{0,180}?min-height:\s*28px[\s\S]{0,80}?text-decoration:\s*none/,
    );
  });

  it("主舞台身份、天时与修为法球同屏，天时读 mods 真值且倒数走定宽槽", () => {
    const view = source("src/views/HomeView.vue");
    const home = homeTemplate();

    expect(home).toContain("<h1>洞府总览</h1>");
    expect(home).toContain("{{ player.realmName }}");
    expect(home).toContain("{{ statusText }}");
    expect(home).toContain("<CultivationOrb");
    expect(home).toContain("formatPercent(player.expProgress, 1)");
    expect(view).toContain("const weatherModText = computed(() => modsText(weather.value.mods));");
    expect(view).toContain('weatherModText.value.split(" · ").filter(Boolean)');
    expect(home).toContain('v-for="effect in weatherEffects"');
    expect(view).toContain("formatCountdown(weatherRemainingSec())");
    expect(home).toContain("countdown-slot");
    expect(view).not.toContain("formatDuration(weatherRemainingSec())");
  });

  it("日课完成数、比例、逐项奖励与进度都从同一组 dailyRows 现算", () => {
    const view = source("src/views/HomeView.vue");

    expect(view).toContain(
      "const dailyDoneCount = computed(() => dailyRows.value.filter((r) => r.done).length);",
    );
    expect(view).toContain(
      "dailyRows.value.length ? dailyDoneCount.value / dailyRows.value.length : 0",
    );
    expect(view).toContain("dailyRowsOf(dailyStateOf(quests.daily), quests.counters)");
    expect(view).toMatch(/\{\{ dailyDoneCount \}\}\/\{\{ dailyRows\.length \}\}/);
    expect(view).toContain("keepNumberUnit(t.desc)");
    expect(view).toContain("得 {{ rewardText(t.reward) }}");
    expect(view).toMatch(/t\.progress \/ Math\.max\(1, t\.target\)/);
    expect(view).toContain("{{ t.progress }}/{{ t.target }}");
  });

  it("日课分两叠:未做的留在页上,已做的收成一叠 —— 收的是版面,不是内容", () => {
    const view = source("src/views/HomeView.vue");
    const css = source("src/styles/pages/home.css");

    /*
     * 八行同权铺开常驻 571px —— 占首页 39%,而其中已经做完的那几行不再回答
     * 「今天该做什么」。这与藏珍的「已达成」、洞府的「七作」、道躯的「行藏」
     * 是同一条分层纪律的第四处。
     */
    expect(view, "两叠从同一组 dailyRows 分出").toContain(
      "dailyOrderedRows.value.filter((row) => !row.done)",
    );
    expect(view, "已成那一叠从同一组 dailyRows 分出").toContain(
      "dailyOrderedRows.value.filter((row) => row.done)",
    );
    expect(view, "行号是它在今天八笔里的位次,不是本叠里的位次").toContain(
      "dailyRows.value.map((row, index) => ({ ...row, ordinal: index + 1 }))",
    );
    expect(view, "未做的逐行仍铺在页上").toContain('v-for="t in dailyPendingRows"');
    expect(view, "已成收成一叠").toContain('v-for="t in dailyDoneRows"');
    expect(view, "达成叠默认合着").toMatch(/const dailyDoneOpen = ref\(false\)/);
    expect(view, "达成叠由 v-show 收起(行仍在 DOM)").toContain('v-show="dailyDoneOpen"');
    expect(view, "展开键要报开合状态").toContain(':aria-expanded="dailyDoneOpen"');
    expect(view, "展开键要指向自己那一叠").toContain('aria-controls="home-done-stack"');
    expect(view, "两叠的每一行仍带同一种日课指纹").toContain(':data-daily-row="t.id"');
    expect(view, "赏格与进度一字不少").toContain("得 {{ rewardText(t.reward) }}");
    expect(css, "达成叠要有自己的样式入口").toContain(".home-daily__done-toggle");
  });

  it("主线与门径仍报决策真值，不给假按钮或另写一套数", () => {
    const home = homeTemplate();

    expect(home).toContain("{{ mainQuest.name }}");
    expect(home).toContain("{{ rewardText(mainQuest.reward) }}");
    expect(home).toContain("mainProgress.text");
    expect(home).toContain("formatPercent(mainProgress.ratio, 0)");
    expect(home).toContain("离线 {{ offlineHrs }} 时");
    expect(home).toContain("已营 {{ dongfu.builtCount }}/{{ BUILDINGS.length }}");
    expect(home).toContain("今日天道未做");
    /*
     * 首页不摆「假按钮」——写着一个动作用、按下去什么都不发生的那种。
     *
     * 原判据是「模板里一个 <button> 都没有」,那是**当年**的近似:当时首页确实
     * 全是只读账行,一个真动作用都没有。现在日课的「已成 N 笔」要开合一叠档案,
     * 那是一枚真控件(有 aria-expanded / aria-controls / 真的会变),不是假按钮。
     * 故判据收到它真正要守的那件事上:页上的 <button> 必须都带开合或跳转语义 ——
     * 不许出现没有任何 ARIA、点了也不走的裸按钮。
     */
    const buttons = [...home.matchAll(/<button\b[^>]*>/g)].map((m) => m[0]);
    for (const tag of buttons) {
      const isReal =
        /aria-expanded=/.test(tag) ||
        /@click=/.test(tag) ||
        /:to=/.test(tag) ||
        /disabled/.test(tag);
      expect(isReal, `首页出现了一枚只挂着样子、没有动作语义的 <button>:${tag.slice(0, 90)}`).toBe(
        true,
      );
    }
    expect(home, "首页仍不许摆 role=button 的假控件").not.toContain('role="button"');
  });

  it("620px 起道途与日课并读，今日一步横排报签，359px 以下先收装饰法球", () => {
    const css = source("src/styles/pages/home.css");

    expect(css).toMatch(
      /\.home-deck\s*\{[\s\S]{0,100}?display:\s*flex;[\s\S]{0,100}?flex-direction:\s*column/,
    );
    expect(css).toMatch(
      /\.home-deck__next\s*\{[\s\S]{0,220}?grid-template-areas:\s*"tag action"\s*"body body"/,
    );
    expect(css).not.toContain("writing-mode: vertical-rl");
    expect(css).toMatch(
      /@media \(min-width: 620px\) \{[\s\S]{0,900}?\.home-deck__board \{[\s\S]{0,120}?grid-template-columns: minmax\(0, 1\.03fr\) minmax\(0, 0\.97fr\)/,
    );
    expect(css).toMatch(
      /@media \(max-width: 359px\) \{[\s\S]{0,900}?\.home-deck__stage \{[\s\S]{0,100}?grid-template-columns: minmax\(0, 1fr\)/,
    );
    expect(css).toMatch(
      /@media \(max-width: 359px\) \{[\s\S]{0,900}?\.home-deck__orb \{[\s\S]{0,60}?display: none/,
    );
  });

  it("门径眉题不借装饰青压字，夜间也保持正文可读", () => {
    const homeCss = source("src/styles/pages/home.css");

    expect(homeCss).toMatch(
      /\.home-passage__eyebrow\s*\{[\s\S]{0,120}color:\s*rgb\(var\(--color-ink-soft-rgb\)\)/,
    );
    expect(homeCss).not.toMatch(
      /\.home-passage__eyebrow\s*\{[\s\S]{0,120}color:\s*rgb\(var\(--color-qing-rgb\)\)/,
    );
  });

  it("洞府指挥台与当前道途随主题换纸,日间不留暗场、夜间不落浅卡", () => {
    const homeCss = source("src/styles/pages/home.css");
    const hero = homeCss.match(/\.home-deck__hero\s*\{[\s\S]*?\n  \}/)?.[0] ?? "";
    const next = homeCss.match(/\.home-deck__next\s*\{[\s\S]*?\n  \}/)?.[0] ?? "";

    expect(hero, "洞府卷首要从主题纸色起笔").toContain("rgb(var(--color-paper-deep-rgb))");
    expect(hero, "洞府卷首不许再用固定书口黑").not.toContain("--chrome-");
    expect(next, "当前道途要落在主题纸面上").toContain("rgb(var(--color-paper-rgb) / 0.96)");
    expect(next, "当前道途正文要随主题落在墨色").toContain("color: rgb(var(--color-ink-rgb))");
    expect(next, "当前道途不许再是一张固定浅卡").not.toContain("--chrome-");
  });

  it("真浏览器门同时量日间与夜间的洞府、当前道途和修行卷首", () => {
    const layout = source("scripts/layout-check.mjs");

    expect(layout).toContain("async function taskThemeStageSurfaces()");
    expect(layout).toContain('["洞府与修行的晨昏纸面", taskThemeStageSurfaces]');
  });
});
