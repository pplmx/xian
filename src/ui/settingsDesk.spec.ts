import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { backupDesk, diagDesk, settingVolume, soundDesk, themeDesk } from "./settingsDesk";

const DAY = 86400000;
const NOW = Date.UTC(2026, 9, 30, 12, 0, 0);

const source = readSource;

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

  it("卷首走天机盘,正文把声息、观照、行止、存续、留痕与索引收成六章续卷", () => {
    const view = source("src/views/SettingsView.vue");
    const compass = source("src/components/common/SettingsCompass.vue");
    const layout = source("scripts/layout-check.mjs");
    const chapters = [...view.matchAll(/data-settings-chapter="([^"]+)"/g)].map(
      ([, chapter]) => chapter,
    );

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
    expect(view).toContain("data-settings-register");
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
    expect(chapters, "六章顺序就是玩家从上往下读的顺序").toEqual([
      "sound",
      "sight",
      "conduct",
      "archive",
      "trail",
      "index",
    ]);
    expect(view, "旧的三层卡壳与通用案头都已退场").not.toMatch(
      /<SectionTitle\b|<LedgerHeader\b|settings-console__grid/,
    );
    expect(compass, "天机盘是重复信息的视觉摘要,不重复进入读屏").toContain('aria-hidden="true"');
    expect(layout, "真浏览器要核卷首与续卷确实落在设置页").toContain(
      'document.querySelector("[data-settings-current]")',
    );
    expect(layout).toContain('document.querySelector("[data-settings-register]")');
    expect(layout).toContain('document.querySelector("[data-settings-console]")');
  });

  it("手机逐章续排、620 两列、960 三列,220 以下章态、动作与选项退整行", () => {
    const css = source("src/style.css");
    const start = css.indexOf("/*\n   * 天机案");
    const end = css.indexOf("/*\n * 分段选择(.ink-choice)", start);
    const settingsCss = css.slice(start, end);

    expect(start, "天机样式段要能定位到").toBeGreaterThan(-1);
    expect(end, "天机样式段要有明确结尾").toBeGreaterThan(start);
    expect(settingsCss).toMatch(
      /\.settings-register\s*\{[\s\S]{0,260}grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
    expect(settingsCss).toMatch(
      /@media \(min-width: 620px\)\s*\{[\s\S]{0,380}\.settings-register\s*\{[\s\S]{0,140}repeat\(2, minmax\(0, 1fr\)\)/,
    );
    expect(settingsCss).toMatch(
      /@media \(min-width: 960px\)\s*\{[\s\S]{0,480}\.settings-register\s*\{[\s\S]{0,140}repeat\(12, minmax\(0, 1fr\)\)/,
    );
    expect(settingsCss).toMatch(
      /@media \(max-width: 220px\)\s*\{[\s\S]{0,2400}\.settings-register__head\s*\{[\s\S]{0,220}grid-template-columns:\s*1\.7rem minmax\(0, 1fr\)/,
    );
    expect(settingsCss).toMatch(
      /@media \(max-width: 220px\)\s*\{[\s\S]{0,3200}\.settings-archive__actions,[\s\S]{0,160}\.settings-trail__actions\s*\{[\s\S]{0,100}minmax\(0, 1fr\)/,
    );
    expect(css).toMatch(
      /@media \(max-width: 220px\)\s*\{[\s\S]{0,900}\.ink-choice__option\s*\{[\s\S]{0,100}flex-basis:\s*100%/,
    );
  });

  it("六组设置选择共用可点账签,不再留 38×22 的小号开关", () => {
    const view = source("src/views/SettingsView.vue");
    const choice = source("src/components/common/InkChoice.vue");
    const css = source("src/style.css");

    expect(view.match(/<InkChoice\b/g) ?? [], "声息/观照/行止共六组选择").toHaveLength(6);
    expect(view, "设置页不再保留原生 checkbox").not.toContain('type="checkbox"');
    expect(view, "旧开关类名不得回流").not.toContain("toggle-ink");
    expect(choice, "每个选项都报同一个 aria-pressed 事实").toContain(
      ':aria-pressed="modelValue === option.value"',
    );
    expect(choice, "每组选择都有可读组名").toContain('role="group" :aria-label="label"');
    expect(css, "选项触达高度抬到 40px").toMatch(
      /\.ink-choice__option\s*\{[\s\S]{0,180}min-height:\s*40px;/,
    );
    expect(css, "旧 toggle-ink 样式整层退场").not.toContain(".toggle-ink");
  });

  it("存续与留痕动作守住 28px,极窄档仍逐枚占满整行", () => {
    const css = source("src/styles/pages/settings.css");

    expect(css, "存续、留痕与清档动作都要守住触控下限").toMatch(
      /\.settings-archive__actions button,[\s\S]{0,180}\.settings-trail__actions button,[\s\S]{0,180}\.settings-archive__acknowledge,[\s\S]{0,180}\.settings-archive__reset\s*\{[\s\S]{0,180}min-(?:block-size|height):\s*28px;/,
    );
    expect(css, "触控下限不能只量高不量宽").toMatch(
      /\.settings-archive__actions button,[\s\S]{0,220}min-inline-size:\s*28px;/,
    );
    expect(css).toMatch(
      /@media \(max-width: 220px\)\s*\{[\s\S]{0,2600}\.settings-archive__actions,[\s\S]{0,140}\.settings-trail__actions\s*\{[\s\S]{0,100}grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
  });

  it("桌面把存续、留痕与卷末并读,手机仍按原顺序单列", () => {
    const view = source("src/views/SettingsView.vue");
    const css = source("src/style.css");
    const layout = source("scripts/layout-check.mjs");
    const start = css.indexOf("/*\n   * 天机案");
    const end = css.indexOf("/*\n * 分段选择(.ink-choice)", start);
    const settingsCss = css.slice(start, end);

    expect(view).toContain("data-settings-afterword");
    expect(view, "存续、留痕与索引同住续卷的后三章").toMatch(
      /<div class="settings-register__afterword" data-settings-afterword>[\s\S]{0,50000}data-settings-chapter="archive"[\s\S]{0,50000}data-settings-chapter="trail"[\s\S]{0,50000}data-settings-chapter="index"/,
    );
    expect(settingsCss).toMatch(
      /\.settings-register__afterword\s*\{[\s\S]{0,120}display:\s*contents/,
    );
    expect(settingsCss).toMatch(
      /@media \(min-width: 620px\)\s*\{[\s\S]{0,1200}\.settings-register__chapter--archive\s*\{[\s\S]{0,120}grid-column:\s*1 \/ -1/,
    );
    expect(settingsCss).toMatch(
      /@media \(min-width: 620px\)\s*\{[\s\S]{0,1400}\.settings-register__chapter--trail\s*\{[\s\S]{0,120}grid-column:\s*1/,
    );
    expect(settingsCss).toMatch(
      /@media \(min-width: 960px\)\s*\{[\s\S]{0,1600}\.settings-register__chapter--archive\s*\{[\s\S]{0,120}grid-column:\s*1 \/ span 7;[\s\S]{0,120}grid-row:\s*2 \/ span 2/,
    );
    expect(layout).toContain("存续、留痕与卷末没有在桌面上并读");
  });

  it("说明类浮层只留卷身分段线,关于与数值体系不再各铺一摞纸卡", () => {
    const about = source("src/components/common/AboutDialog.vue");
    const progression = source("src/components/common/ProgressionDialog.vue");
    const layout = source("scripts/layout-check.mjs");

    expect(about, "关于浮层外框要有独立落点").toContain("data-about-surface");
    expect(about, "关于浮层要有稳定落点").toContain("data-about-ledger");
    expect(progression, "数值体系外框要有独立落点").toContain("data-progression-surface");
    expect(progression, "数值体系浮层要有稳定落点").toContain("data-progression-ledger");
    expect(about, "关于浮层不再借通用纸卡").not.toContain("card-ink");
    expect(progression, "数值体系不再逐段借通用纸卡").not.toContain("card-ink");
    expect(layout, "真浏览器要核关于浮层没有内层卡壳").toContain("data-about-ledger");
    expect(layout, "真浏览器要核关于外框没有纸卡壳").toContain("data-about-surface");
    expect(layout, "真浏览器要核数值体系没有内层卡壳").toContain("data-progression-ledger");
    expect(layout, "真浏览器要核数值体系外框没有纸卡壳").toContain("data-progression-surface");
  });

  it("整册收成一张开口长账,六章只共用章首与分段线", () => {
    const view = source("src/views/SettingsView.vue");
    const css = source("src/styles/pages/settings.css");

    expect(view, "整册外框要成为唯一连续账页").toMatch(
      /<article\s+class="settings-register folio-span-all"\s+data-settings-register\s+data-settings-folio\s+data-settings-console\s*>/,
    );
    expect(view, "每章都从同一枚章首起笔").toMatch(
      /data-settings-chapter="sound"[\s\S]{0,500}<header class="settings-register__head" data-folio-chapter-head>/,
    );
    expect(
      view.match(/class="settings-archive__reset[^"]*"/)?.[0] ?? "",
      "清档键不能再让 w-full 盖掉自身宽度,给账页多出一条横向滚动",
    ).not.toContain("w-full");
    expect(css, "连续账页只留上下账线").toMatch(
      /\.settings-register\s*\{[\s\S]{0,520}border:\s*0;[\s\S]{0,520}border-block:\s*1px solid/,
    );
    expect(css, "六章撤掉四边卡、圆角、底色与投影").toMatch(
      /\.settings-register__chapter\s*\{[\s\S]{0,620}border:\s*0;[\s\S]{0,620}border-radius:\s*0;[\s\S]{0,620}background:\s*transparent;[\s\S]{0,620}box-shadow:\s*none;/,
    );
    expect(css, "章间只以分段线接续前账").toMatch(
      /\.settings-register__chapter \+ \.settings-register__chapter\s*\{[\s\S]{0,120}border-top:\s*1px solid/,
    );
    expect(css, "卷末索引也摊成开口账行").toMatch(
      /\.settings-index\s*\{[\s\S]{0,320}border:\s*0;[\s\S]{0,320}background:\s*transparent;[\s\S]{0,320}box-shadow:\s*none;/,
    );
  });

  it("上次备份只报一次,状态与时间各守自己的账格", () => {
    const view = source("src/views/SettingsView.vue");
    const exportRow = view.slice(
      view.indexOf('data-settings-save-stat="export"'),
      view.indexOf('data-settings-save-stat="backup"'),
    );

    expect(exportRow.match(/backupReadout\.detail/g)).toHaveLength(1);
    expect(exportRow, "导出时间不拿状态标签再冒充一遍").not.toContain("backupReadout.label");
  });
});
