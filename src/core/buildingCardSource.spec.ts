/**
 * 建筑卡面数字单源 —— mods 与 effectText 不许各写一份
 *
 * 起因:同一文件的相邻两行,一边写「修炼速度 卡面 +4%」,一边写
 * `cultivationSpeed: lv * 0.04`。数字差一倍、一方改一方忘 —— 卡面撒谎
 * 而没有任何门会红。灵脉轮(veinText)把同样的问题收掉后,建筑轮照旧。
 *
 * 判据两条:
 *   ① 源审计:数据表里不许再手写 `+${lv * 数字}%` 这种百分比字面量
 *     (它必然与 mods 里的 /100 版本相邻双写);
 *   ② 行为一致:卡面每一行出现的百分数,与该建筑 mods(lv) 的对应词条逐位相等
 *     (formatSignedPercent 同口径),挡「改表不改卡」的一半。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { BUILDINGS } from "@/data/buildings";
import { BUILDING_LEVELS_PER_MANSION } from "@/data/constants";
import { buildingLevelCapOf } from "./engineFacilities";
import { STAT_NAMES } from "@/data/statNames";
import { formatSignedPercent } from "@/utils/format";
import type { AnyStatKey } from "@/types";

describe("建筑卡面 · mods 与 effectText 数字单源", () => {
  it("数据表不许再手写 +${lv * N}% 这类百分比字面量(现改读 mods)", () => {
    const src = readFileSync(resolve(__dirname, "../data/buildings.ts"), "utf8");
    // 百分比字面量「+${lv * 4}%」这类,在单源之后就该绝迹
    expect(src, "卡面百分比不能再用 lv 手乘,应读 mods/常量").not.toMatch(
      /\$\{[^}]*lv \* 1?0?\.?\d+[^}]*\} *%/,
    );
  });

  it("卡面每一行的百分数 = mods(lv) 的对应词条(逐级抽查)", () => {
    for (const b of BUILDINGS) {
      if (!b.mods) continue;
      for (const lv of [1, 2, 5, Math.max(1, Math.floor(b.maxLevel / 2))]) {
        const mods = b.mods(lv);
        const text = b.effectText(lv).join("\n");
        for (const [key, raw] of Object.entries(mods)) {
          if (!raw) continue;
          const label = STAT_NAMES[key as AnyStatKey];
          if (!label) continue;
          const pct = formatSignedPercent(raw as number);
          expect(
            text,
            `${b.name} Lv${lv}:「${label}」卡面应显示 ${pct}(与 mods 一致),实际没有这行`,
          ).toContain(pct);
          expect(text, `${b.name} Lv${lv}:「${label}」该读出词条名`).toContain(label);
        }
      }
    }
  });

  /**
   * 「其余建筑等级上限 +5/级」曾是卡面上手写的字面量,而真值是
   * `core/engineFacilities` 的 `(洞府等级 + 1) × 5` —— 两本账谁也不管谁。
   *
   * 它躲过了上面两条:百分比正则只认 `%`,而这一行是「+5/级」;
   * 行为判据只比 mods 里的词条,而这条上限**不进 StatMods**(它是闸门,不是加成)。
   * `exportReach.spec` 的基线里躺着那个导出的名字,是它「除定义处无人引用」的机械证据。
   *
   * 判据两侧都量:① 卡面印出来的数 == 常数的数;② 卡面那行不许再出现裸数字 ——
   * 只核①会被「常数改回 5、字面量也正好写 5」蒙混,②才挡得住第二本账。
   */
  it("洞府卡面「其余建筑等级上限 +N/级」读的是判定的那一枚常数", () => {
    const mansion = BUILDINGS.find((b) => b.id === "mansion")!;
    const capLine = mansion.effectText(1).find((line) => line.includes("其余建筑等级上限"));
    expect(capLine, "洞府卡面丢了「其余建筑等级上限」那一行 —— 判据会空转").toBeDefined();
    expect(
      capLine,
      "卡面的每级抬升数与 BUILDING_LEVELS_PER_MANSION 对不上 —— 改常数就撒谎",
    ).toContain(`+${BUILDING_LEVELS_PER_MANSION}/级`);

    // ② 源模板里那一行不许再写裸数字 —— 只允许 `${常数}` 插值
    const src = readFileSync(resolve(__dirname, "../data/buildings.ts"), "utf8");
    const capSrc = src.match(/^\s*`其余建筑等级上限[^`]*`,?$/m)?.[0];
    expect(capSrc, "数据表里定位不到那一行 —— 判据会空转").toBeDefined();
    expect(capSrc, "卡面这一行要由常数插值出来,不许写死数字").toContain(
      "${BUILDING_LEVELS_PER_MANSION}",
    );
    expect(
      capSrc!.replace(/\$\{[^}]*\}/g, ""),
      "卡面这行还写着手写数字 —— 改常数只会改到判定那一侧,卡面就撒谎",
    ).not.toMatch(/\d/);

    // ③ 换算侧真的读同一枚常数:改常数,闸门跟着变
    expect(buildingLevelCapOf(0)).toBe(BUILDING_LEVELS_PER_MANSION);
    expect(buildingLevelCapOf(1)).toBe(2 * BUILDING_LEVELS_PER_MANSION);
  });
});
