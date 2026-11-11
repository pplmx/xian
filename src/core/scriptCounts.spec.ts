/**
 * `scripts/` 下注释里的数字 —— 第四类文本载体。
 *
 * ## 缺口(第 120 轮实测)
 *
 * 「数字会过时」这件事,此前在三种载体里各撞到一次:
 *
 * ```text
 *   第 105~110 轮   docs/*.md               6 处
 *   第 109~110 轮   src/ 的代码注释          2 处(后来 115~117 又补 8 处汉字)
 *   第 119 轮       用例名(it 的第一个参数)   3 处
 * ```
 *
 * 这轮问:**还有别的文本载体吗?** 查了 `describe` 块名(0 处)之后,扫到
 * `scripts/` 下的 `.mjs` —— 19 个脚本,`layout-check.mjs` 一份就有 46 处汉字数字。
 *
 * 实测过时 4 处:
 *
 * ```text
 *   layout-check.mjs:2227   (三十顶名号、四十只灵兽逐条查)   → 29 / 44
 *   layout-check.mjs:30036  长到四十只                        → 44
 *   layout-check.mjs:160    名号与灵兽两册共 69 条            → 73(29 + 44)
 *   layout-check.mjs:30033  69 条终局清单的两册回看           → 73
 * ```
 *
 * **`69 条` 那两处尤其典型**:那是「称号 + 灵兽」的和。两个数各自变过
 * (称号 30→29、灵兽 40→44),和却停在 69 —— **合计最容易停在旧值上**,
 * 因为改单个表时没人会顺手去加一遍。
 *
 * ## 判据
 *
 * ① 脚本里「N 顶」的 N 必须等于称号数;
 * ② 脚本里「N 只」且谈灵兽时,N 必须等于灵兽数;
 * ③ 脚本里「名号与灵兽两册共 N 条」的 N 必须等于称号数 + 灵兽数。
 *
 * ③ 是这轮新学到的:**对合计数要有单独的判据**,不能指望它跟着分项变。
 */
import { describe, expect, it } from "vite-plus/test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "@/test/readSource";
import { PETS } from "@/data/pets";
import { TITLES } from "@/data/titles";

/** 汉字数字(十一 ~ 九十九)与阿拉伯数字 → number */
function toNumber(raw: string): number | null {
  if (/^\d+$/.test(raw)) return Number(raw);
  const D: Record<string, number> = {
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
  if (!raw.includes("十")) return D[raw] ?? null;
  const [head, tail] = raw.split("十");
  const tens = head ? (D[head] ?? NaN) : 1;
  const ones = tail ? (D[tail] ?? NaN) : 0;
  return Number.isNaN(tens) || Number.isNaN(ones) ? null : tens * 10 + ones;
}

/** 读取 `scripts/` 下所有 .mjs */
function scriptTexts(): { file: string; text: string }[] {
  return readdirSync(join(ROOT, "scripts"))
    .filter((f) => f.endsWith(".mjs"))
    .map((f) => ({ file: f, text: readFileSync(join(ROOT, "scripts", f), "utf8") }));
}

describe("scripts/ 里的数字", () => {
  it("① 脚本里「N 顶」等于称号数", () => {
    const wrong: string[] = [];
    let hits = 0;
    for (const { file, text } of scriptTexts()) {
      /*
       * 只查「N 顶」后面**不是「栏」**的。
       *
       * 第一版没排除,于是 `layout-check.mjs` 那份按序号排列的判据清单里
       * 「二十七 顶栏底栏钉死」「三十 顶栏不许折行」两行当场误报 ——
       * 那是序号 + 顶栏(顶部的栏),不是「N 顶称号」。
       */
      for (const m of text.matchAll(
        /([一二三四五六七八九]?十[一二三四五六七八九]|[一二三四五六七八九]?十)\s*顶(?!栏)/g,
      )) {
        const n = toNumber(m[1]!);
        if (n === null) continue;
        hits += 1;
        if (n !== TITLES.length)
          wrong.push(`${file}: 「${m[0].trim()}」,称号实际 ${TITLES.length}`);
      }
    }
    expect(wrong, "脚本注释里的「N 顶」与称号数不符:" + wrong.join("、")).toEqual([]);
    expect(hits, "一处都没找到 —— 说法改了,判据要跟着改").toBeGreaterThanOrEqual(1);
  });

  it("② 脚本里谈灵兽的「N 只」等于灵兽数", () => {
    const wrong: string[] = [];
    let hits = 0;
    for (const { file, text } of scriptTexts()) {
      for (const line of text.split("\n")) {
        if (!line.includes("灵兽")) continue;
        for (const m of line.matchAll(
          /([一二三四五六七八九]?十[一二三四五六七八九]|[一二三四五六七八九]?十)只/g,
        )) {
          const n = toNumber(m[1]!);
          if (n === null) continue;
          hits += 1;
          // 「四十只全盖上」这类假设语气不在判据范围内:它不声明总数
          if (/假如|若|如果/.test(line)) continue;
          if (n !== PETS.length) wrong.push(`${file}: 「${m[0]}」,灵兽实际 ${PETS.length}`);
        }
      }
    }
    expect(wrong, "脚本注释里的「N 只」与灵兽数不符:" + wrong.join("、")).toEqual([]);
    expect(hits, "一处都没找到").toBeGreaterThanOrEqual(1);
  });

  it("③ 「名号与灵兽两册共 N 条」的 N 等于两表之和", () => {
    /*
     * 这条是本轮学到的:**合计要有单独的判据**。
     *
     * 29 + 44 = 73,而脚本里写的是 69 —— 两个加数各自变过,和没跟上。
     * 改单张表的人不会顺手加一遍,所以合计永远需要自己那条线。
     */
    const sum = TITLES.length + PETS.length;
    expect(sum, "称号 + 灵兽的总数不对").toBe(73);

    const wrong: string[] = [];
    let hits = 0;
    for (const { file, text } of scriptTexts()) {
      for (const m of text.matchAll(/名号与灵兽两册共\s*(\d+)\s*条/g)) {
        hits += 1;
        if (Number(m[1]) !== sum) wrong.push(`${file}: 写 ${m[1]} 条,实际 ${sum}`);
      }
      for (const m of text.matchAll(/(\d+)\s*条终局清单的两册回看/g)) {
        hits += 1;
        if (Number(m[1]) !== sum) wrong.push(`${file}: 写 ${m[1]} 条,实际 ${sum}`);
      }
    }
    expect(wrong, "「名号与灵兽两册共 N 条」与两表之和不符:" + wrong.join("、")).toEqual([]);
    expect(hits, "一处都没找到 —— 说法改了,判据要跟着改").toBeGreaterThanOrEqual(1);
  });

  it("④ 汉字数字解析器本身要对", () => {
    expect(toNumber("十")).toBe(10);
    expect(toNumber("四十")).toBe(40);
    expect(toNumber("四十四")).toBe(44);
    expect(toNumber("七十三")).toBe(73);
    expect(toNumber("69")).toBe(69);
    expect(toNumber("猫")).toBeNull();
  });

  it("反空转:脚本都读得到,数量正常", () => {
    const scripts = scriptTexts();
    expect(scripts.length, "scripts/ 下没扫到 .mjs").toBeGreaterThanOrEqual(10);
    for (const { file, text } of scripts) {
      expect(text.length, `${file} 是空的`).toBeGreaterThan(100);
    }
    expect(TITLES.length).toBeGreaterThan(10);
    expect(PETS.length).toBeGreaterThan(10);
  });
});
