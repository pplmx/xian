/**
 * 夜色随天时 —— 首页那片星空,该跟着今日天时变。
 *
 * ## 现状
 *
 * 首页顶上有「今日天时 · 凝霜 · 尚余 2:14」这一行 —— 信息是对的,也是及时的。
 * 但那片星空**永远一个样**:十一颗金星、同样的亮度、同样的呼吸。
 *
 * 而本作的天时是有性情的:
 *
 *   灵雨    细雨润物
 *   赤阳    烈日当空
 *   月蚀    月色被吞
 *   雷鸣    雷声隐隐
 *   清和    天光正好
 *   罡风    风刃割面
 *   凝霜    寒气渐重
 *   霞光    云霞满天
 *   天朗    一碧如洗
 *
 * 玩家读到「月蚀」两个字,抬头看到一片明亮的星空 —— 那两个字就白写了。
 *
 * ## 做什么
 *
 * 把天时折成**夜色的三个读数**:星的颜色、星的亮度、星的多寡。
 * 只影响首页那片装饰用的星空,不影响任何数值、判定、掉落。
 *
 * 十二种各写一套是内容工程;而"夜色有个调子"这件事,三档就够:
 *
 *   沉  —— 月蚀、罡风、仙劫日、雷鸣:星稀而晦
 *   暖  —— 赤阳、霞光、紫气东来:星偏赤金、偏浓
 *   清  —— 清和、天朗、凝霜、灵雨、仙雨:星清明
 *
 * ## 为什么这值得做
 *
 * 这是本作里**唯一一个完全没有功能的东西**。它不提示、不奖励、不判定 ——
 * 只是让"今天"与"昨天"在抬头时不一样。
 *
 * 放置游戏最缺的往往不是内容而是**此刻感**:玩家每次打开看到的都是同一屏。
 * 而一行天时文字与一片跟着变的夜色,后者才让人觉得"现在是此刻,不是任意时刻"。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

describe("夜色随天时 · 三档怎么分", () => {
  it("月蚀时星稀而晦 —— 那是本作最暗的一夜", async () => {
    const { skyOfWeather } = await import("@/ui/weatherSky");
    const clear = skyOfWeather("tianlang");
    const eclipse = skyOfWeather("yueshi");
    expect(eclipse.stars, "月蚀该比天朗星少").toBeLessThan(clear.stars);
    expect(eclipse.brightness, "月蚀该比天朗暗").toBeLessThan(clear.brightness);
  });

  it("赤阳时星偏赤金、偏浓", async () => {
    const { skyOfWeather } = await import("@/ui/weatherSky");
    const clear = skyOfWeather("tianlang");
    const sun = skyOfWeather("chiyang");
    expect(sun.brightness, "赤阳该比天朗亮").toBeGreaterThan(clear.brightness);
    expect(sun.tint, "赤阳该另有一色").not.toBe(clear.tint);
  });

  it("清和天朗凝霜灵雨仙雨同属一档 —— 不各写一套", async () => {
    const { skyOfWeather } = await import("@/ui/weatherSky");
    const ids = ["qinghe", "tianlang", "ningshuang", "lingyu", "xianyu"];
    const first = skyOfWeather(ids[0]!);
    for (const id of ids.slice(1)) {
      expect(skyOfWeather(id), `${id} 该与清和同档`).toEqual(first);
    }
  });

  it("十二种天时都有落处 —— 不留一个默认到别处去", async () => {
    const { skyOfWeather, SKY_TIERS } = await import("@/ui/weatherSky");
    const ids = [
      "lingyu",
      "chiyang",
      "yueshi",
      "leiming",
      "qinghe",
      "gangfeng",
      "ningshuang",
      "xiaguang",
      "tianlang",
      "xianyu",
      "ziqi",
      "xianjie",
    ];
    for (const id of ids) {
      const sky = skyOfWeather(id);
      expect(SKY_TIERS, `${id} 落到了表外的档`).toContain(sky.tier);
    }
  });

  it("认不得的天时给最平常的那一档 —— 不抛错、不空白", async () => {
    const { skyOfWeather } = await import("@/ui/weatherSky");
    const fallback = skyOfWeather("no_such_weather");
    expect(fallback.tier).toBeTruthy();
    expect(skyOfWeather(undefined)).toEqual(fallback);
  });
});

describe("夜色随天时 · 只做装饰", () => {
  it("不 import store 或 core —— 它不该知道任何玩法", () => {
    const src = readSource("src/ui/weatherSky.ts")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(src).not.toMatch(/from ["']@\/stores\//);
    expect(src).not.toMatch(/from ["']@\/core\//);
  });

  it("真接线:首页那片星空读它,且有稳定落点", () => {
    const home = readSource("src/views/HomeView.vue");
    expect(home, "该读夜色").toContain("skyOfWeather(");
    expect(home, "要有落点").toContain("data-home-sky");
  });
});

describe("夜色随天时 · 飞升之后的天也不该和人间一样", () => {
  /**
   * ## 复现:神界与混沌海的六种天时全都落到默认档
   *
   * `weather.ts` 里一共 18 种天时,分属四界:
   *
   *   人界 9   灵雨 赤阳 月蚀 雷鸣 清和 罡风 凝霜 霞光 天朗
   *   仙界 3   仙雨 紫气东来 仙劫日
   *   神界 3   神辉 法则潮 神威日
   *   混沌海 3  混沌潮 本源涌动 道音
   *
   * 而 `BY_WEATHER` 只写了前十二种。神界与混沌海那六种**一个都没进去** ——
   * 它们全走 `?? CLEAR` 兜底。
   *
   * 于是玩家飞升神界,顶上写着「今日天时 · 神辉」,抬头还是人间界「天朗」
   * 那片一模一样的星空。**飞升最该有的体感——「世界变了」——正是在这里失守的**:
   * 界域名、境界名、天时名全变了,只有那片天没变。
   *
   * 这与本文件开头那段话直接矛盾:
   *
   *   > 玩家读到「月蚀」两个字,抬头看到一片明亮的星空 —— 那两个字就白写了。
   *
   * 只不过这次白写的是「神辉」「混沌潮」「道音」。
   */
  const CROSS_WORLD: Record<string, string> = {
    shenhui: "神辉",
    faze: "法则潮",
    shenwei: "神威日",
    hundunchao: "混沌潮",
    benyuan: "本源涌动",
    daoyin: "道音",
  };

  it("神界与混沌海的六种天时都认得出 —— 不许落到默认档", async () => {
    /*
     * 判「认不认得」用 `knowsWeather`,不用「返回值与兜底档是否相同」——
     * 后者分不出「归清」与「没进表」(两者都返回 CLEAR):道音归清是对的,
     * 神辉走兜底是漏的,而它们读出来一模一样。
     */
    const { knowsWeather } = await import("@/ui/weatherSky");
    const missed = Object.keys(CROSS_WORLD).filter((id) => !knowsWeather(id));
    expect(
      missed.map((id) => `${CROSS_WORLD[id]}(${id})`),
      "这些天时没进表,走的是兜底档 —— 飞升之后抬头还是人间界那片天",
    ).toEqual([]);
  });

  it("十八种天时每一种都有落处", async () => {
    const { skyOfWeather, SKY_TIERS } = await import("@/ui/weatherSky");
    const all = [
      "lingyu",
      "chiyang",
      "yueshi",
      "leiming",
      "qinghe",
      "gangfeng",
      "ningshuang",
      "xiaguang",
      "tianlang",
      "xianyu",
      "ziqi",
      "xianjie",
      "shenhui",
      "faze",
      "shenwei",
      "hundunchao",
      "benyuan",
      "daoyin",
    ];
    expect(all.length, "天数变了 —— 这张表要跟着改").toBe(18);
    for (const id of all) {
      expect(SKY_TIERS, `${id} 落到了表外的档`).toContain(skyOfWeather(id).tier);
    }
  });

  it("十八种天时全都进表 —— 一个都不许走兜底", async () => {
    const { knowsWeather, skyOfWeather } = await import("@/ui/weatherSky");
    const all = [
      "lingyu",
      "chiyang",
      "yueshi",
      "leiming",
      "qinghe",
      "gangfeng",
      "ningshuang",
      "xiaguang",
      "tianlang",
      "xianyu",
      "ziqi",
      "xianjie",
      "shenhui",
      "faze",
      "shenwei",
      "hundunchao",
      "benyuan",
      "daoyin",
    ];
    const missed = all.filter((id) => !knowsWeather(id));
    expect(missed, `这些天时走的是兜底档:${missed.join(" ")}`).toEqual([]);
    // 反空转:认不得的确实认得出来是认不得
    expect(knowsWeather("no_such_weather"), "判据不认得「认不得」就等于没在判").toBe(false);
    expect(knowsWeather(undefined)).toBe(false);
    // 兜底仍然给最平常那一档(不抛错、不空白)
    expect(skyOfWeather("no_such_weather").tier).toBe(skyOfWeather("tianlang").tier);
  });

  it("飞升之后的天与人间界的不一样 —— 至少有一条读数不同", async () => {
    const { skyOfWeather } = await import("@/ui/weatherSky");
    // 人间界最平常的一档
    const mortal = skyOfWeather("tianlang");
    const reads = (s: { tint: string; brightness: number; stars: number }) =>
      `${s.tint}|${s.brightness}|${s.stars}`;
    /*
     * 六种里面至少要有四种读起来与「天朗」不同 ——
     * 神辉与本源涌动着偏暖、法则潮与混沌潮偏沉、神威日偏沉,道音偏清。
     * 不要求六种两两不同(三档本来就是给「有个调子」用的),
     * 但要求**跨界的整体不能再是人间界那一片**。
     */
    const distinct = Object.keys(CROSS_WORLD).filter(
      (id) => reads(skyOfWeather(id)) !== reads(mortal),
    );
    expect(
      distinct.length,
      `飞升 heavens 六种天时里只有 ${distinct.length} 种与人间界「天朗」不同 —— 抬头看不出换了世界`,
    ).toBeGreaterThanOrEqual(4);
  });
});
