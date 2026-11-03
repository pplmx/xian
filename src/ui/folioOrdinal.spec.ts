/**
 * 册次水印 —— 卷首最大的那枚字与全作的序数语言同一套。
 *
 * 判据四组:
 *   一 写汉字:第 1 册「一」、第 10 册「十」而不是「一十」、第 17 册「十七」;
 *   二 不另写一份转写:实现走 utils/format 的 cnNumber,不在本模块重造;
 *   三 坏值有话说:0、负数、NaN 都退成「零」,不印空白;
 *   四 真接线:卷首同时给出汉字(视觉)与数字(机器核对),两者同源。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { folioOrdinalMark } from "./folioOrdinal";

describe("册次水印 · 写汉字", () => {
  it("第 1~9 册读一到九", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8].map(folioOrdinalMark)).toEqual([
      "一",
      "二",
      "三",
      "四",
      "五",
      "六",
      "七",
      "八",
      "九",
    ]);
  });

  it("第 10 册读「十」而不是「一十」", () => {
    expect(folioOrdinalMark(9)).toBe("十");
  });

  it("第 11~19 册读十一到十九", () => {
    expect(folioOrdinalMark(10)).toBe("十一");
    expect(folioOrdinalMark(16)).toBe("十七");
  });

  it("全作十七页:每一页的水印都是非空的汉字", () => {
    for (let i = 0; i < 17; i += 1) {
      const mark = folioOrdinalMark(i);
      expect(mark.length, `第 ${i + 1} 册的水印是空的`).toBeGreaterThan(0);
      expect(mark, `第 ${i + 1} 册的水印里混进了阿拉伯数字`).not.toMatch(/[0-9]/);
    }
  });

  it("小数向下取整 —— 册次是整数", () => {
    expect(folioOrdinalMark(2.9)).toBe("三");
  });
});

describe("册次水印 · 坏值有话说", () => {
  it("NaN / -1 / -Infinity 都退成「零」,不印空白", () => {
    for (const bad of [Number.NaN, -1, -5, Number.NEGATIVE_INFINITY]) {
      expect(folioOrdinalMark(bad), `${bad} 的水印不该是空白`).toBe("零");
    }
  });
});

describe("册次水印 · 不另写一份转写", () => {
  it("实现走 cnNumber,不在本模块重造数字转汉字", () => {
    const src = readSource("src/ui/folioOrdinal.ts");
    expect(src, "要读 format 的 cnNumber").toContain("cnNumber");
    // 自己写一张数字表就是第二本账
    expect(src, "不该自带一张汉字数字表").not.toMatch(/["']零一二三四五六七八九["']/);
  });
});

describe("册次水印 · 真接线", () => {
  it("卷首的视觉写法读它,数字仍留给机器核对", () => {
    const masthead = readSource("src/components/common/FolioPageHeader.vue");
    expect(masthead, "水印要读汉字写法").toContain("folioOrdinalMark(");
    expect(masthead, "数字要留在 data 属性上供核对").toContain(":data-folio-ordinal=");
  });

  it("汉字与数字同源:都从册目位置来,不各算一份", () => {
    const masthead = readSource("src/components/common/FolioPageHeader.vue");
    // 两处都要读 position,不许一处读 position、另一处数别的
    const usesPosition = (masthead.match(/position\.value/g) ?? []).length;
    expect(usesPosition, "水印两项都该从 position 推出来").toBeGreaterThanOrEqual(2);
  });
});
