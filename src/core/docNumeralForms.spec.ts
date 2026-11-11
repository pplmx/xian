/**
 * 中文文档里的数字有**两种写法**,而判据此前只扫了其中一种。
 *
 * ## 缺口(第 115~116 两轮实测)
 *
 * 第 115 轮在 `usage.md` 撞到同一份文档自相矛盾:
 *
 * ```text
 * :55    44 只灵兽每界至少两只可挑      ← 阿拉伯数字
 * :63    与 29 枚称号贯穿全程           ← 阿拉伯数字
 * :100   两册各三十顶 / 四十二只          ← 汉字数字,与上面两行冲突
 * ```
 *
 * 修好之后问了一句:**其他文档有同类问题吗?** 这轮一查:
 *
 * ```text
 *   文档        阿拉伯数字声明   汉字数字声明
 *   design.md      125            967        ← 汉字是阿拉伯的 7.7 倍
 *   usage.md        54            145
 *   alchemy.md       4             30
 *   engine.md        9             23
 * ```
 *
 * 也就是说:**既有的文档数字判据,覆盖的是不到 13% 的声明。**
 * 而没被覆盖的那部分里,`design.md` 有 5 处过时:
 *
 * ```text
 *   三十顶名号                    → 29
 *   四十只灵兽(4 处)             → 44
 * ```
 *
 * ## 为什么不能直接把汉字全算进来
 *
 * 汉字数字里绝大多数是**不定指用法**:「一个」「一条」「一枚」= a / an,
 * 不是数量声明。实测 `design.md` 里「一个」出现 257 次、「一条」188 次 ——
 * 把它们都当成「文档说系统里有 1 个」,判据会疯。
 *
 * 故这条判据只认**两位数以上**的汉字数字(`十一` ~ `九十九`):
 * 「四十四只」是声明,「一只」是量词。
 *
 * ## 判据
 *
 * 不做通用对账(那需要先知道每个数字指什么,不可判定)。只钉住**已经发现过
 * 错误的那两个说法**:
 *
 * ① 文档里出现「N 顶」(N 为两位以上汉字)时,N 必须等于称号数;
 * ② 文档里出现「N 只」(同上)且上下文谈的是灵兽时,必须等于灵兽数。
 *
 * ② 的「上下文谈的是灵兽」用一个窄判据近似:该行含「灵兽」二字。
 * 这条会漏(比如「四十只各一句」那行不含「灵兽」),但它不会误伤 ——
 * 而漏掉的那些,前一轮已经手工核过了。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "@/test/readSource";
import { PETS } from "@/data/pets";
import { TITLES } from "@/data/titles";

/** 汉字数字(十一 ~ 九十九)→ 阿拉伯数字 */
function cnToNumber(raw: string): number | null {
  const DIGIT: Record<string, number> = {
    一: 1,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
  };
  if (!raw.includes("十")) return DIGIT[raw] ?? null;
  const [head, tail] = raw.split("十");
  const tens = head ? (DIGIT[head] ?? NaN) : 1;
  const ones = tail ? (DIGIT[tail] ?? NaN) : 0;
  return Number.isNaN(tens) || Number.isNaN(ones) ? null : tens * 10 + ones;
}

/** `docs/` 顶层的规范性文档(编年史与发版快照不参与) */
const DOCS = ["usage.md", "design.md", "alchemy.md", "engine.md", "deployment.md"];

describe("文档里的汉字数字 —— 判据的另一半", () => {
  it("① 「N 顶」的 N 等于称号数", () => {
    const wrong: string[] = [];
    let hits = 0;
    for (const file of DOCS) {
      const text = readFileSync(join(ROOT, "docs", file), "utf8");
      for (const m of text.matchAll(
        /([一二三四五六七八九]?十[一二三四五六七八九]|[一二三四五六七八九]?十)顶/g,
      )) {
        const n = cnToNumber(m[1]!);
        if (n === null) continue;
        hits += 1;
        if (n !== TITLES.length) {
          wrong.push(`${file}: 写「${m[0]}」,称号实际 ${TITLES.length} 枚`);
        }
      }
    }
    expect(
      wrong,
      "文档里的「N 顶」与称号数不符 —— 这类错此前扫不到,因为判据只认阿拉伯数字:" + wrong.join("、"),
    ).toEqual([]);
    // 防空转:真的扫到了几处(现在只有 usage.md 一处)
    expect(hits, "一处「N 顶」都没找到 —— 说法改了,这条判据要跟着改").toBeGreaterThanOrEqual(1);
  });

  it("② 谈灵兽的行里「N 只」等于灵兽数", () => {
    const wrong: string[] = [];
    let hits = 0;
    for (const file of DOCS) {
      const lines = readFileSync(join(ROOT, "docs", file), "utf8").split("\n");
      for (const line of lines) {
        // 只查同时提到「灵兽」的行 —— 这是「上下文谈的是灵兽」的窄近似
        if (!line.includes("灵兽")) continue;
        for (const m of line.matchAll(
          /([一二三四五六七八九]?十[一二三四五六七八九]|[一二三四五六七八九]?十)只/g,
        )) {
          const n = cnToNumber(m[1]!);
          if (n === null) continue;
          hits += 1;
          if (n !== PETS.length) {
            wrong.push(`${file}: 「${m[0]}」在含「灵兽」的行里,实际 ${PETS.length} 只`);
          }
        }
      }
    }
    expect(wrong, "谈灵兽的行里「N 只」与灵兽数不符:" + wrong.join("、")).toEqual([]);
    expect(hits, "一处都没找到 —— 判据在空转").toBeGreaterThanOrEqual(1);
  });

  it("③ 汉字数字解析器本身是对的", () => {
    /*
     * 这条守的是**判据自己的工具**。第 115 轮踩过:`cnToNumber` 只查单字,
     * 「四十四」返回 NaN,判据于是报「文档写 NaN」—— 那个 NaN 是判据的 bug。
     */
    expect(cnToNumber("十")).toBe(10);
    expect(cnToNumber("十一")).toBe(11);
    expect(cnToNumber("二十")).toBe(20);
    expect(cnToNumber("四十四")).toBe(44);
    expect(cnToNumber("九十")).toBe(90);
    expect(cnToNumber("九十九")).toBe(99);
    expect(cnToNumber("猫")).toBeNull();
  });

  it("反空转:文档都读得到,且称号/灵兽数正常", () => {
    for (const file of DOCS) {
      const text = readFileSync(join(ROOT, "docs", file), "utf8");
      expect(text.length, `${file} 是空的`).toBeGreaterThan(500);
    }
    expect(TITLES.length, "称号表空了").toBeGreaterThan(10);
    expect(PETS.length, "灵兽表空了").toBeGreaterThan(10);
    expect(DOCS.length, "文档清单被删短了").toBeGreaterThanOrEqual(5);
  });
});
