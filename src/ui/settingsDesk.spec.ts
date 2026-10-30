import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { backupDesk, diagDesk, settingVolume, soundDesk, themeDesk } from "./settingsDesk";
import { readStyleCss } from "@/test/readStyleCss";

const ROOT = resolve(__dirname, "../..");
const DAY = 86400000;
const NOW = Date.UTC(2026, 9, 30, 12, 0, 0);

function source(rel: string): string {
  if (rel === "src/style.css") return readStyleCss();
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("天机案 · 设置卷首与三案同读此刻", () => {
  it("音量只做一把尺:坏数归零、越界夹住、显示取整", () => {
    expect(settingVolume(50.4)).toBe(50);
    expect(settingVolume(50.6)).toBe(51);
    expect(settingVolume(-9)).toBe(0);
    expect(settingVolume(120)).toBe(100);
    expect(settingVolume(Number.NaN)).toBe(0);
    expect(settingVolume(Number.POSITIVE_INFINITY)).toBe(100);
  });

  it("声息摘要同时报两条声道,静音不拿旧音量冒充正在播放", () => {
    expect(soundDesk(true, 50, true, 70)).toEqual({
      music: 50,
      sfx: 70,
      active: 2,
      level: 0.6,
      quiet: false,
      label: "乐 50 · 音 70",
    });
    expect(soundDesk(false, 50, true, 70)).toMatchObject({
      active: 1,
      level: 0.35,
      quiet: false,
      label: "乐静 · 音 70",
    });
    expect(soundDesk(false, 50, false, 70)).toEqual({
      music: 50,
      sfx: 70,
      active: 0,
      level: 0,
      quiet: true,
      label: "乐静 · 音静",
    });
  });

  it("观照与存续各有自己的印态,备份旧了与从未备份都不冒充安好", () => {
    expect(themeDesk("auto")).toEqual({ label: "跟随系统", mark: "随", level: 0.55 });
    expect(themeDesk("light")).toEqual({ label: "日间", mark: "日", level: 1 });
    expect(themeDesk("dark")).toEqual({ label: "夜间", mark: "夜", level: 1 });
    expect(themeDesk("broken" as "auto").label).toBe("跟随系统");

    expect(backupDesk(0, NOW)).toEqual({
      state: "never",
      mark: "未",
      label: "尚未备份",
      detail: "从未导出",
      level: 0,
    });
    expect(backupDesk(NOW - 20 * DAY, NOW)).toEqual({
      state: "stale",
      mark: "旧",
      label: "备份已旧",
      detail: "20 天前",
      level: 0.45,
    });
    expect(backupDesk(NOW - DAY, NOW)).toEqual({
      state: "fresh",
      mark: "安",
      label: "备份尚新",
      detail: "1 天前",
      level: 1,
    });
  });

  it("留痕计数封顶,零条与有记录给相反印态", () => {
    expect(diagDesk(0, 20)).toEqual({
      state: "clear",
      count: 0,
      mark: "净",
      label: "未留痕",
      level: 0,
    });
    expect(diagDesk(3, 20)).toEqual({
      state: "recorded",
      count: 3,
      mark: "录",
      label: "留痕 3 条",
      level: 0.15,
    });
    expect(diagDesk(30, 20)).toMatchObject({ count: 20, level: 1 });
    expect(diagDesk(Number.NaN, Number.POSITIVE_INFINITY)).toMatchObject({
      count: 0,
      level: 0,
    });
  });

  it("卷首走天机盘,正文把声息、观照、行止、存续、留痕与索引收成同一册", () => {
    const view = source("src/views/SettingsView.vue");
    const compass = source("src/components/common/SettingsCompass.vue");
    const layout = source("scripts/layout-check.mjs");

    expect(view, "设置页进入 featured 开卷版式").toMatch(
      /<FolioPageHeader[\s\S]{0,520}\bfeatured\b/,
    );
    expect(view, "卷首主视觉读同一份声息、观照与存续").toMatch(
      /<template #visual>[\s\S]{0,260}<SettingsCompass/,
    );
    expect(view).toContain("soundDesk(settings.musicOn");
    expect(view).toContain("themeDesk(settings.theme)");
    expect(view).toContain("backupDesk(settings.lastExportAt, now.value)");
    expect(view).toContain("diagDesk(diag.errors.length, DIAG_MAX)");
    expect(view).toContain("data-settings-current");
    expect(view).toContain("data-settings-console");
    expect(view).toContain('data-settings-group="sound"');
    expect(view).toContain('data-settings-group="sight"');
    expect(view).toContain('data-settings-group="conduct"');
    expect(view).toContain("data-settings-archive");
    expect(view).toContain("data-settings-trail");
    expect(view).toContain("data-settings-index");
    expect(view).toContain("存档版本 v{{ SAVE_VERSION }}");
    expect(view).toContain("上次导出备份");
    expect(view).toContain("导出存档");
    expect(view).toContain("遇事勿扰");
    expect(view).toContain("整体替换");
    expect(compass, "天机盘是重复信息的视觉摘要,不重复进入读屏").toContain('aria-hidden="true"');
    expect(layout, "真浏览器要核卷首与总案确实落在设置页").toContain(
      'document.querySelector("[data-settings-current]")',
    );
    expect(layout).toContain('document.querySelector("[data-settings-console]")');
  });

  it("手机单列、620 两列、960 三列,220 以下动作与选项退整行", () => {
    const css = source("src/style.css");
    const start = css.indexOf("/*\n   * 天机案");
    const end = css.indexOf("/*\n * 开关(.toggle-ink)", start);
    const settingsCss = css.slice(start, end);

    expect(start, "天机样式段要能定位到").toBeGreaterThan(-1);
    expect(end, "天机样式段要有明确结尾").toBeGreaterThan(start);
    expect(settingsCss).toMatch(
      /\.settings-console__grid\s*\{[\s\S]{0,160}grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
    expect(settingsCss).toMatch(
      /@media \(min-width: 620px\)\s*\{[\s\S]{0,300}\.settings-console__grid\s*\{[\s\S]{0,120}repeat\(2, minmax\(0, 1fr\)\)/,
    );
    expect(settingsCss).toMatch(
      /@media \(min-width: 960px\)\s*\{[\s\S]{0,360}\.settings-console__grid\s*\{[\s\S]{0,120}repeat\(3, minmax\(0, 1fr\)\)/,
    );
    expect(settingsCss).toMatch(
      /@media \(max-width: 220px\)\s*\{[\s\S]{0,2200}\.settings-archive__actions,[\s\S]{0,140}\.settings-trail__actions\s*\{[\s\S]{0,100}minmax\(0, 1fr\)/,
    );
    expect(settingsCss).toMatch(
      /@media \(max-width: 220px\)\s*\{[\s\S]{0,2600}\.settings-segment\s*\{[\s\S]{0,100}flex-basis:\s*100%/,
    );
  });
});
