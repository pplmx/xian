/**
 * 成色的话 —— 一个数字要说得清它是好是差。
 *
 * 判据六组:
 *   一 七档等距:均匀掷点下按等距切,不按正态切;
 *   二 两端改口:0 读「尚未淬出」、100 读「掷满」—— 那不是"最差/最好",是端点;
 *   三 单调:成色涨,档位只涨不落;
 *   四 全区间都有话说:0..100 每一个整数都落在一档里,没有缝隙;
 *   五 不进任何判定:本模块只产出一个词;
 *   六 真接线:器评帖把它并排摆在数字旁。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { TEMPER_GRADES, temperGrade, temperGradeText } from "./temperGrade";

describe("成色的话 · 等距分档", () => {
  it("七档评语 + 坯与满两个端点", () => {
    expect(TEMPER_GRADES).toHaveLength(8);
    expect(TEMPER_GRADES.map((g) => g.label)).toEqual([
      "坯",
      "下下",
      "下",
      "中下",
      "中",
      "中上",
      "上",
      "满",
    ]);
  });

  it("中间五档等距,两端各留一段更宽的过渡带", () => {
    /*
     * 判据刻意不是「处处等宽」:1..19 与 80..99 有意比中间宽 —— 玩家最容易在
     * 「刚出坯」与「将近掷满」这两处问「这算不算好」,那里值得多给一点分辨力。
     * 要守的是:中间五段彼此等距(说明按均匀掷点切,不是按正态),两端不窄于中间。
     */
    const middle = [20, 35, 50, 65, 80];
    const widths = middle.slice(1).map((v, i) => v - middle[i]!);
    expect(new Set(widths).size, `中间档宽不均:${widths.join(",")}`).toBe(1);
    const lowEdge = 20 - 1;
    const highEdge = 100 - 80;
    expect(lowEdge, "低端过渡带不该比中间窄").toBeGreaterThanOrEqual(widths[0]!);
    expect(highEdge, "高端过渡带不该比中间窄").toBeGreaterThanOrEqual(widths[0]!);
  });

  it("坏值按坯 —— 算不出来的成色最诚实的说法是「还没开始」", () => {
    expect(temperGrade(Number.NaN).id).toBe("raw");
    expect(temperGrade(-5).id).toBe("raw");
    expect(temperGrade(999).id).toBe("perfect");
  });
});

describe("成色的话 · 两端改口", () => {
  it("0 读「尚未淬出」而不是「下下」", () => {
    expect(temperGradeText(0)).toBe("尚未淬出");
  });

  it("100 读「掷满」而不是「上上」", () => {
    expect(temperGradeText(100)).toBe("掷满");
  });

  it("中间各档读两字评语", () => {
    expect(temperGradeText(1)).toBe("下下");
    expect(temperGradeText(20)).toBe("下");
    expect(temperGradeText(35)).toBe("中下");
    expect(temperGradeText(50)).toBe("中");
    expect(temperGradeText(67)).toBe("中上");
    expect(temperGradeText(80)).toBe("上");
    expect(temperGradeText(99)).toBe("上");
  });
});

describe("成色的话 · 单调且无缝隙", () => {
  it("0..100 每一个整数都落在一档里,且成色涨档位只涨不落", () => {
    let prev = -1;
    for (let v = 0; v <= 100; v += 1) {
      const idx = TEMPER_GRADES.findIndex((g) => g.id === temperGrade(v).id);
      expect(idx, `成色 ${v} 落到了比上一档更低的档`).toBeGreaterThanOrEqual(prev);
      prev = idx;
    }
    expect(prev, "成色 100 该落在最后一档").toBe(TEMPER_GRADES.length - 1);
  });

  it("每一档都真的取得到", () => {
    const hit = new Set<number>();
    for (let v = 0; v <= 100; v += 1) hit.add(temperGrade(v).from);
    expect(hit.size, "有档位永远取不到 —— 那是白写的").toBe(TEMPER_GRADES.length);
  });
});

describe("成色的话 · 不进任何判定", () => {
  it("模块不 import 结算 / 属性 / 排序 —— 它只产出一个词", () => {
    /*
     * 判据认的是 **import**,不是「这份文件里出现过这几个字」——
     * 注释里正当提到 core/inscription 的纪律(描述而不决定)不该被打红。
     * 这条上一轮已经在别处栽过一次,同一个形状不再犯第二次。
     */
    const src = readSource("src/ui/temperGrade.ts");
    for (const banned of ["statsCalc", "equipGen", "core/inscription", "powerRating"]) {
      expect(src, `成色的话不该 import ${banned}`).not.toMatch(
        new RegExp(`import[^;]*from ["'][^"']*${banned.replace("/", "\\/")}`),
      );
    }
    /*
     * 它只许 import **工具层**(utils/)—— 那是纯函数原语(如 clampPercent),
     * 不是游戏机制。不许 import 的是 core/ data/ stores/ 这几层:
     * 那才是「进判定」会走的路。
     */
    const imports = [...src.matchAll(/^import[^;]*from ["']([^"']+)["']/gm)].map((m) => m[1]!);
    for (const from of imports) {
      expect(from, `成色的话不该 import ${from}`).toMatch(/^@\/utils\//);
    }
  });
});

describe("成色的话 · 真接线", () => {
  it("器评帖把它并排摆在数字旁", () => {
    const dialog = readSource("src/components/equipment/EquipmentDetailDialog.vue");
    expect(dialog, "要读成色的话").toContain("temperGradeText(");
    expect(dialog, "要有稳定落点供真浏览器复核").toContain("data-equipment-temper-grade");
  });

  it("坊市验货签也读同一句 —— 买之前就该看得懂", () => {
    /*
     * 装配在 ui/marketShelf(摊签的视图模型),不是视图本身 —— 那里已经把
     * 品评、器铭、对比等每一次验货要用的东西装好,成色的话与它们同处最合适。
     * 故判据认的是「这一份装配读它 + 视图真的用上了那个字段」,不认某个文件里的字面。
     */
    const shelf = readSource("src/ui/marketShelf.ts");
    const market = readSource("src/views/MarketView.vue");
    expect(shelf, "摊签视图模型要生成成色的话").toContain("temperGradeText(");
    expect(market, "视图要真把它摆出来").toContain("temperGrade");
  });
});
