/**
 * 器魂三格的印 / 状态 / 单位,各说一件事 —— 第一格的「席」重复了三遍。
 *
 * ## 复现
 *
 * 器魂页卷首那三格读出来是:
 *
 *     席 三席 0/3 席        闲 闲置 0 缕        凝 可凝 3/3 件
 *
 * 第一格里 `mark`(印)是「席」、`label`(状态)是「三席」、`unit`(量词)又是「席」——
 * 同一个字出现三次,而这一格真正该说的是「**用了几席**」。
 * 另两格都是干净的「印 + 状态 + 量词」:闲/闲置/缕、凝/可凝/件。
 *
 * ## 为什么这不是纯审美
 *
 * `LedgerTally` 是三个页面共用的账格组件(`SoulsView` / `CelestialView` /
 * `MarketChapterRail`)。天界那边的四格用的是「印 + 状态 + 判断短语」
 * (道/道途/道已定、征/远征/界已破),每个字都在传信息。
 * 器魂这三格里唯一重复的那一格,恰好也是玩家最先看到的一格。
 *
 * ## 改法
 *
 * 只改 `label`:三席 → 已用。于是三格结构一致(印 / 状态 / 量词),
 * 读作「席 已用 0/3 席」—— 印说明是哪一本账、状态说明这个数是什么、
 * 量词说明单位。下面那行 detail 照旧报「尚空 3 席 / 三席俱满」。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

/** 从源里抠出器魂三格的 mark / label / unit */
function soulTallyFields(): { id: string; mark: string; label: string; unit: string }[] {
  const src = readSource("src/views/SoulsView.vue");
  const rows: { id: string; mark: string; label: string; unit: string }[] = [];
  const re = /id: "(\w+)" as const,\s*mark: "([^"]*)",\s*label: "([^"]*)",[\s\S]*?unit: "([^"]*)"/g;
  for (const m of src.matchAll(re)) {
    rows.push({ id: m[1]!, mark: m[2]!, label: m[3]!, unit: m[4]! });
  }
  return rows;
}

describe("器魂三格 · 印 / 状态 / 单位各说一件事", () => {
  it("抠得出三格 —— 不然下面的判据全是空转", () => {
    const rows = soulTallyFields();
    expect(rows.length, "器魂账格应有 3 个").toBe(3);
    expect(rows.map((r) => r.id).sort()).toEqual(["active", "idle", "refine"]);
  });

  /*
   * 真正该守的是**状态**别去复述印或量词。
   * 印与量词同字是合法的 —— 「席」这本账数的就是席(另两格「闲/缕」「凝/件」
   * 只是碰巧用字不同,不是规矩)。原先 label 写「三席」正是复述了印与量词。
   */
  it("状态不复述印,也不复述量词", () => {
    for (const row of soulTallyFields()) {
      /*
       * 只拦**整词相同**与**量词整字出现在状态里**。
       * 「闲·闲置」是自然的搭配(闲置就是闲的那一态),不算复述;
       * 而「席·三席·席」里状态把印和量词各念了一遍,那才是冗余。
       */
      expect(row.label, `「${row.id}」格的状态与印完全相同`).not.toBe(row.mark);
      if (row.unit && row.unit !== row.mark) {
        expect(row.label, `「${row.id}」格的状态复述了量词「${row.unit}」`).not.toContain(row.unit);
      }
      if (row.unit === row.mark) {
        // 印与量词同字时,状态里出现这个字就是重复(「三席」之于「席」)
        expect(
          row.label,
          `「${row.id}」格的印与量词同为「${row.mark}」,状态不该再出现它`,
        ).not.toContain(row.unit);
      }
    }
  });

  it("第一格说的是「用了多少席」,不是再念一遍「三席」", () => {
    const active = soulTallyFields().find((r) => r.id === "active")!;
    expect(active.mark, "印仍是「席」——它标的是这本账").toBe("席");
    expect(active.unit, "量词仍是「席」").toBe("席");
    expect(
      active.label,
      `状态该说这个数是什么(已用),而不是重复印与量词(实见「${active.label}」)`,
    ).toBe("已用");
  });
});
