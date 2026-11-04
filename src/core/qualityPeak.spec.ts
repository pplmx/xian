import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { qualityDef } from "@/data/qualities";
import { achievementProgressRows } from "@/core/achievementProgress";
import type { AchievementDef } from "@/types";

/**
 * 品质成就的进度读数 —— 它是「持有过最高的那一件」,不是「此刻包里最高的那一件」。
 *
 * ## 复现出来的事故
 *
 * 成就谱上「天品或更高 / 仙品或更高 / 神品」这几行的进度条,读的是
 * `inventory.items` 里**此刻**最高的那件(见 views/CollectionView 与 TitlesView 的
 * `maxQualityRank`)。而分解会 `inventory.removeEquipment(uid)` —— 把那一件从
 * items 里拿掉。
 *
 * 于是:得一件神品 → 进度 8/8 → 把它分解 → 进度掉回 0/8。
 *
 * 更糟的是**已解锁的成就是不会掉回去的**(quests.achieved 只增)。所以玩家会看到
 * 同一屏上「神物自晦 ✓ 已达成」与「天品 0/6 尚未达成」并存 —— 两张卡互相打脸。
 *
 * ## 为什么「持有过」才是对的
 *
 * 成就是**一次性事实**:"我曾得一件天品"。这类事实本该只增不减,与
 * `core/peakRealm`(历世最远那一境)同一条规矩 —— 那里已经写明「只增不减,
 * 转世折回起点不会把足迹抹掉」。品质这一处漏了。
 *
 * ## 本模块只做一件事
 *
 * 把「当前持有」与「历史最高」折成一个只增不减的读数。判定仍在别处(engineUnlocks)。
 */

describe("品质读数 · 只增不减", () => {
  it("分解掉那一件之后,读数不许回落", () => {
    // 直接量纯函数:上一次记到 8(神品),这一次包里空了 —— 仍该读 8
    const peak = 8;
    const current = 0;
    const merged = mergeQualityPeak(peak, current);
    expect(merged, "分解不该让「曾得神品」这件事消失").toBe(8);
  });

  it("新得一件更高的,读数抬上去", () => {
    expect(mergeQualityPeak(6, 8)).toBe(8);
  });

  it("包里只剩低档时,读数停在历史最高,不跟着降", () => {
    expect(mergeQualityPeak(8, 2)).toBe(8);
  });

  it("坏值(负 / NaN / 越界)夹回合法档位 —— 不印出第 99 档", () => {
    expect(mergeQualityPeak(Number.NaN, Number.NaN)).toBe(0);
    expect(mergeQualityPeak(-5, -3)).toBe(0);
    expect(mergeQualityPeak(999, 0)).toBe(qualityDef("divine").rank);
  });
});

describe("品质读数 · 成就行读同一份", () => {
  it("品质型成就的 label 说「已持」,不因为包里没有就退回 0", () => {
    const def = {
      id: "a_q6",
      name: "天命之子",
      desc: "",
      cond: { type: "quality", rank: 6 },
    } as AchievementDef;
    const rows = achievementProgressRows([def], {
      achieved: [],
      counters: {},
      major: 0,
      // 历史最高是神品,此刻包里没有 —— label 仍该说已持
      maxQualityRank: 8,
    });
    expect(rows[0]?.label).toContain("已持");
    expect(rows[0]?.gap).toBe(0);
  });
});

describe("品质读数 · 真接线", () => {
  it("两个视图都改读只增不减的那份,不再各自 reduce inventory.items", () => {
    for (const file of ["src/views/CollectionView.vue", "src/views/TitlesView.vue"]) {
      const src = readSource(file);
      expect(src, `${file} 该走共享的只增读数`).toContain("peakQualityFromStores(");
      // 旧写法:就地 reduce 当前背包
      expect(src, `${file} 不许再就地 reduce inventory.items 算品质`).not.toMatch(
        /inventory\.items\.reduce\(\s*\(max,\s*item\)\s*=>\s*Math\.max\(max,\s*qualityDef\(item\.quality\)\.rank/,
      );
    }
  });
});

// ---- 被测的两枚纯函数(放在 spec 里先钉形状,实现落 src/core/qualityPeak) ----
import { mergeQualityPeak } from "@/core/qualityPeak";
