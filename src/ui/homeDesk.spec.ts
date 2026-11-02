import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { readStyleCss } from "@/test/readStyleCss";

const ROOT = resolve(__dirname, "../..");

function source(rel: string): string {
  if (rel === "src/style.css") return readStyleCss();
  return readFileSync(resolve(ROOT, rel), "utf8");
}

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
    expect(view).toContain('v-for="(t, index) in dailyRows"');
    expect(view).toContain("keepNumberUnit(t.desc)");
    expect(view).toContain("得 {{ rewardText(t.reward) }}");
    expect(view).toMatch(/t\.progress \/ Math\.max\(1, t\.target\)/);
    expect(view).toContain('t.done ? "已成" : `${t.progress}/${t.target}`');
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
    expect(home).not.toContain('role="button"');
    expect(home).not.toContain("<button");
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
