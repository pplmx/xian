/**
 * 道龄 —— 「这一号人物,你陪他走了多久」。
 *
 * ## 缺口:一条从没被读过的存档事实
 *
 * `game.totalPlaySec` 是「**活跃游玩**时长」的存档事实,而且语义被刻意钉死过
 * (见 core/engine 的注释):缺席时段只走离线那本账,**不进**它 ——
 * 挂机一晚不换天、不白得八小时。它同时是天时、值日宿与际遇概率的派生源
 * (DEC-120:序号只由游戏内时长决定)。
 *
 * 而这条事实**从来没有被展示过**:全仓对它只有一处读取(
 * `ExpeditionPanel` 的星宿对齐),界面上一个字都没有。
 *
 * 于是玩家玩了三个月,看不到任何"我陪这一号人物走过多久"的读数 ——
 * 而这恰恰是放置类游戏最该有的那种感觉:角色是你养出来的,时间是你投进去的。
 *
 * ## 为什么放在「修行画像」而不是顶栏
 *
 * 顶栏是**此刻**的读数(灵石、灵气、寿元),每一秒都在变。
 * 道龄是**累计**事实,变了也没有意义去看 —— 它属于"这一号人物是谁"那一页。
 * 与「行年」把散落的道历收成一册同一条取向:累计的东西集中在一处读。
 *
 * ## 只说人话,不给精确到秒的数字
 *
 * 秒级读数在累计语境里是噪音:玩了 37 小时的玩家不关心多出来的 12 分钟。
 * 故按量级取整(见 `companionTimeText`),并给一句随量级变化的说法 ——
 * 一炷香的陪伴与三个月的陪伴,不该是同一个句子。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { companionTimeText, companionTimeLabel } from "./companionTime";

describe("道龄 · 按量级说人话", () => {
  it("几十秒:说「才开始」,不报一个精确到秒的数", () => {
    const text = companionTimeText(50);
    expect(text).not.toMatch(/\d+\s*秒/);
    expect(text.length).toBeGreaterThan(0);
  });

  it("几小时:报小时,不带秒", () => {
    const text = companionTimeText(3 * 3600 + 1234);
    expect(text).toContain("3");
    expect(text).toContain("小时");
    expect(text).not.toMatch(/\d+\s*秒/);
  });

  it("几天:报天,且不再带小时", () => {
    const text = companionTimeText(3 * 86400 + 5000);
    expect(text).toContain("天");
    expect(text).not.toContain("小时");
  });

  it("同一量级内四舍五入 —— 5 天 20 小时说「6 天」,不说「5 天」", () => {
    expect(companionTimeText(5 * 86400 + 20 * 3600)).toContain("6");
  });

  it("逐级递增,不出现「0 天」这种空话", () => {
    for (const sec of [0, 59, 60, 3600, 86399, 86400, 30 * 86400, 365 * 86400]) {
      const text = companionTimeText(sec);
      expect(text, `${sec} 秒读出了空串`).not.toBe("");
      expect(text, `${sec} 秒读出了「0 天」`).not.toMatch(/^0\s*天/);
    }
  });

  it("坏值一律说「未记」,不印出 NaN", () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, -100]) {
      const text = companionTimeText(bad);
      expect(text).not.toMatch(/NaN|Infinity|-/);
      expect(text.length).toBeGreaterThan(0);
    }
  });
});

describe("道龄 · 标签随量级变", () => {
  it("刚开始与走过很久,标签不是同一个词", () => {
    const early = companionTimeLabel(60);
    const late = companionTimeLabel(90 * 86400);
    expect(early).not.toBe(late);
  });

  it("标签都是短词,进得去画像那一行", () => {
    for (const sec of [0, 3600, 30 * 86400, 365 * 86400]) {
      const label = companionTimeLabel(sec);
      expect(label.length, `「${label}」太长`).toBeLessThanOrEqual(6);
      expect(label.length).toBeGreaterThan(0);
    }
  });
});

describe("道龄 · 只是读数", () => {
  it("不 import store / core / DOM —— 与 flashTier / toastLife 同一条纪律", () => {
    const src = readSource("src/ui/companionTime.ts")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(src).not.toMatch(/from ["']@\/stores\//);
    expect(src).not.toMatch(/from ["']@\/core\//);
  });

  it("真接线:修行画像读它,并有稳定落点", () => {
    const dlg = readSource("src/components/character/IdentityDialog.vue");
    expect(dlg, "画像要读道龄").toContain("companionTimeText(");
    expect(dlg, "要有稳定落点").toContain("data-identity-companion");
  });

  it("读的是 game.totalPlaySec —— 那条被钉死语义的事实,不另算一份", () => {
    const dlg = readSource("src/components/character/IdentityDialog.vue");
    expect(dlg).toContain("totalPlaySec");
  });
});
