/**
 * 成就报喜的品阶印 —— 「神物自晦」与「初有积蓄」不该长得一样。
 *
 * ## 缺口:同一屏里两条「rare」,分量差着量级
 *
 * `progress.announceAchievement` 对**所有**成就发同一条提示:
 *
 *     notify(`成就达成「${def.name}」`, "rare")
 *
 * 而「rare」这一族的提示早就按品阶分层了(见 ui/flashTier / ui/rareSfx / ui/toastLife):
 * 有品阶印的那条会盖一枚印、闪一道带该档颜色的光、响对应的一响、停更久。
 *
 * 于是:
 *
 *   拾得一件神品装备 —— `notify(pickup, "rare", inst.quality)` → 有「神」印、神品的光与声
 *   成就「神物自晦」—— `notify(..., "rare")`                 → 什么都没有,与「初有积蓄」同款
 *
 * 而「神物自晦」的达成条件**就是**获得一件神品装备 —— 它是同一件事的报喜,
 * 却比那件装备本身的提示轻一整个量级。
 *
 * ## 做法:从条件里读出品阶,而不是在数据里再抄一栏
 *
 * 成就定义里已经有 `cond: { type: "quality", rank }`(见 data/achievements)。
 * 那一档名字与颜色全在品质表里,故这里只做一次「rank → QualityId」的翻译,
 * 不新增字段、不往 45 条成就里各抄一遍品质 id。
 *
 * ## 只管品质型成就
 *
 * 其余成就(累计击杀、境界、自定条件)没有"品阶"这回事 —— 给它们编一个印
 * 就是在撒谎。故 `achievementSealOf` 对非品质条件一律返回 undefined,
 * 提示条退回与改造前逐位相同的模样。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { qualityDef } from "@/data/qualities";
import { achievementSealOf } from "./achievementSeal";
import type { AchievementDef } from "@/types";

const ach = (cond: AchievementDef["cond"]): AchievementDef => ({
  id: "a_test",
  name: "测试",
  desc: "",
  cond,
});

describe("成就报喜的品质印 · 品质型成就", () => {
  it("品质条件读得出对应那一档 —— 神品成就盖「神」印", () => {
    expect(achievementSealOf(ach({ type: "quality", rank: 8 }))).toBe("divine");
  });

  it("天品 / 仙品成就各读各的档", () => {
    expect(achievementSealOf(ach({ type: "quality", rank: 6 }))).toBe("heaven");
    expect(achievementSealOf(ach({ type: "quality", rank: 7 }))).toBe("immortal");
  });

  it("凡品那档也读得出 —— 不是只有高档才配印", () => {
    expect(achievementSealOf(ach({ type: "quality", rank: 0 }))).toBe("mortal");
  });
});

describe("成就报喜的品阶印 · 其余成就一枚都不盖", () => {
  it("累计型成就不盖印 —— 十件装备没有「品阶」这回事", () => {
    expect(
      achievementSealOf(ach({ type: "counter", key: "equipsGained", value: 10 })),
    ).toBeUndefined();
  });

  it("境界型成就不盖印", () => {
    expect(achievementSealOf(ach({ type: "realm", major: 5 }))).toBeUndefined();
  });

  it("自定型成就不盖印", () => {
    expect(achievementSealOf(ach({ type: "custom", key: "first_dao" }))).toBeUndefined();
  });
});

describe("成就报喜的品阶印 · 坏值不撒谎", () => {
  it("越界的 rank 夹到两端,不印出一档不存在的品质", () => {
    expect(achievementSealOf(ach({ type: "quality", rank: 999 }))).toBe("divine");
    expect(achievementSealOf(ach({ type: "quality", rank: -5 }))).toBe("mortal");
  });

  it("NaN rank 落回凡品,不抛错", () => {
    expect(achievementSealOf(ach({ type: "quality", rank: Number.NaN }))).toBe("mortal");
  });

  it("读出来的 id 在品质表里查得到 —— 不会印出一枚空的章", () => {
    for (let rank = 0; rank <= 8; rank += 1) {
      const id = achievementSealOf(ach({ type: "quality", rank }));
      expect(id, `rank ${rank} 读不出品质 id`).toBeTruthy();
      expect(qualityDef(id!).name.length, `rank ${rank} 查不到档名`).toBeGreaterThan(0);
    }
  });
});

describe("成就报喜的品阶印 · 只是分类", () => {
  it("不 import store / core / DOM —— 与 flashTier / rareSfx 同一条纪律", () => {
    const src = readSource("src/ui/achievementSeal.ts")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(src).not.toMatch(/from ["']@\/stores\//);
    expect(src).not.toMatch(/from ["']@\/core\//);
  });

  it("真接线:报喜那一处把印递进去", () => {
    const src = readSource("src/core/progress.ts");
    expect(src, "报喜要读品阶印").toContain("achievementSealOf(");
    // 旧写法:不带第三参的 rare 提示
    expect(src, "品质成就的报喜不该还是无条件无印").not.toMatch(
      /notify\(`成就达成「\$\{def\.name\}」`, "rare"\);/,
    );
  });
});
