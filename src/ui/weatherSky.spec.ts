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
