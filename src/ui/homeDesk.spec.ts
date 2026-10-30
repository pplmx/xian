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

describe("首页案头 · 先给今日一步，再摊长期账", () => {
  it("三栏案头与两处门径各有唯一运行时落点", () => {
    const home = homeTemplate();
    const markers = [
      "data-home-desk",
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
  });

  it("第一步优先，当前目标只在第一步退场后接管", () => {
    const home = homeTemplate();

    expect(home).toMatch(/<RouterLink\s+v-if="firstStep"/);
    expect(home).toMatch(/v-else-if="currentGoal"/);
    expect(home).toContain("data-home-goal");
    expect(home).toMatch(/v-if="firstStep && currentGoal"[\s\S]{0,260}currentGoal\.text/);
    expect(home).toContain("{{ firstStep.label }} →");
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

  it("桌面让日课横跨整张案头，不再把长账塞进右半页", () => {
    const css = source("src/style.css");
    const homeStart = css.indexOf(".home-desk {");
    const homeCss = css.slice(homeStart, css.indexOf("  /*\n   * 开关", homeStart));
    const desktop = /@media \(min-width: 960px\) \{([\s\S]*?)\n  \}/.exec(homeCss)?.[1] ?? "";

    expect(desktop).toMatch(
      /\.home-desk \{[\s\S]{0,180}?grid-template-columns: minmax\(0, 1\.04fr\) minmax\(0, 0\.96fr\)/,
    );
    expect(desktop).toMatch(/\.home-desk__daily \{[\s\S]{0,100}?grid-column: 1 \/ -1/);
    expect(desktop).toMatch(
      /\.home-desk__daily-list \{[\s\S]{0,120}?repeat\(auto-fit, minmax\(11rem, 1fr\)\)/,
    );
    expect(desktop).not.toMatch(/\.home-desk__lead \{[\s\S]{0,120}grid-row: 1 \/ span 2/);
  });

  it("320 小屏收起纯装饰法球，390 仍保留同排主视觉", () => {
    const masthead = source("src/components/common/FolioPageHeader.vue");
    const tailwind = source("tailwind.config.js");

    expect(masthead).toContain("min-w-28 flex-1 compact:min-w-0");
    expect(masthead).toContain("compact:hidden tinylens:hidden");
    expect(tailwind).toContain('addVariant("compact", "@media (max-width: 359px)")');
  });
});
