/**
 * 转世那一刻,也该看见「你陪这一号人物走了多久」。
 *
 * ## 缺口:道龄只接进了一处
 *
 * `game.totalPlaySec` 是「**活跃游玩**时长」的存档事实(缺席时段不进它,
 * 见 core/engine 的注释);第 10 轮把它接进了「修行画像」,标签随量级变
 * (初入此世 / 道龄 / 伴道)。
 *
 * 而**转世对话框没接**。那是「这一世结束了」的一屏,header 里写着:
 *
 *     第 3 世 · 寿数已尽
 *     行世 320 载,止步于真仙。皮囊坐化,神魂仍可再启一程。
 *     道果 12 枚
 *
 * 「行世 320 载」是**这一世**的寿数(游戏内时间)。而「你陪他走了多久」是
 * 另一件事 —— 恰好在"这一世结束"的时刻最该被看见,却一个字都没有。
 *
 * ## 措辞必须说清是累计
 *
 * 两件不同的量放在同一屏,最容易误读:`player.age` 是本世的,`totalPlaySec`
 * 是全账号的。若只写「伴道 45 天」,玩家会以为"这一世玩了 45 天"。
 * 故文案里要带「至今」一类明确的累计标记。
 *
 * ## 判据守什么
 *
 * 一 转世那一屏读得到道龄读数(与修行画像同一份 `ui/companionTime`);
 * 二 那一行必须带累计标记,不许与本世寿数混为一谈。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { companionTimeText, companionTimeLabel } from "./companionTime";

describe("转世一屏 · 道龄也要出现", () => {
  it("真的读 companionTime —— 与修行画像同一份口径,不另算", () => {
    const src = readSource("src/components/character/ReincarnationDialog.vue");
    expect(src, "转世屏要读道龄文案").toContain("companionTimeText");
    expect(src, "还要读它的标签").toContain("companionTimeLabel");
  });

  it("读的是 game.totalPlaySec,不是本世寿数", () => {
    const src = readSource("src/components/character/ReincarnationDialog.vue");
    expect(src, "要读账号级的活跃游玩时长").toContain("totalPlaySec");
  });

  it("有稳定落点供真浏览器复核", () => {
    const src = readSource("src/components/character/ReincarnationDialog.vue");
    expect(src, "要有 data-reincarnation-companion 落点").toContain("data-reincarnation-companion");
  });

  it("带累计标记 —— 不许与本世「行世 N 载」混为一谈", () => {
    const src = readSource("src/components/character/ReincarnationDialog.vue");
    const at = src.indexOf("data-reincarnation-companion");
    expect(at, "落点要还在").toBeGreaterThan(0);
    // 那一块前后两百字里要有「至今」这类累计词
    const block = src.slice(Math.max(0, at - 400), at + 400);
    expect(block, "道龄那一行要说清是累计(如「至今」),否则玩家会以为是本世寿数").toMatch(
      /至今|累计|一共|总共/,
    );
  });
});

describe("转世一屏 · 文案由同一份函数给", () => {
  it("修行画像与转世屏读同一对函数", () => {
    const profile = readSource("src/components/character/IdentityDialog.vue");
    const rebirth = readSource("src/components/character/ReincarnationDialog.vue");
    for (const fn of ["companionTimeText", "companionTimeLabel"]) {
      expect(profile, `修行画像没读 ${fn}`).toContain(fn);
      expect(rebirth, `转世屏没读 ${fn}`).toContain(fn);
    }
  });

  it("函数本身仍然分档 —— 两处不会各自漂", () => {
    // 短、中、长三档各给一个不同的说法
    expect(companionTimeLabel(30)).not.toBe(companionTimeLabel(45 * 86400));
    expect(companionTimeText(45 * 86400)).toContain("天");
  });
});
