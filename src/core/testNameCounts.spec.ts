/**
 * 用例名里的数字 —— 第 109~117 三轮都漏掉的一层。
 *
 * ## 缺口(第 119 轮实测)
 *
 * 第 109~110 轮扫的是**代码注释**里的数字;第 115~117 轮扫的是**文档**里的汉字数字。
 * 这轮顺手扫了第三处:**用例名**(`it("...")` 的第一个参数)。
 *
 * 实测 12 处带汉字数字的用例名,其中两处过时:
 *
 * ```text
 *   src/data/petVows.spec.ts    「契语不重复:四十只是四十句话」    → 实为 44
 *   src/core/uiLayering.spec.ts 「三十顶全齐的圆满」                → 实为 29
 *   src/ui/codex.spec.ts        「七十七条分支都挂得上一部实有的功法」→ 实为 199
 * ```
 *
 * 三处都只出现在**用例名**里。而用例名是玩家看不到、开发者天天看的东西 ——
 * 它比注释更常被读(`bun run test` 的输出就是它)。
 *
 * ## 为什么这层一直没被扫到
 *
 * - 第 109~110 轮的正则只扫**注释行**(`^\s*(\*|//)`)—— 用例名是代码字符串;
 * - 第 115~117 轮只扫 `docs/*.md`。
 *
 * 「用例名」是第三类文本:既不在注释里,也不在文档里。
 *
 * ## 判据
 *
 * 不扫全部数字(用例名里「一位数与十位」这种是泛指),只钉**已经错过的那几个说法**:
 *
 * ① 用例名里出现「N 只」且上下文谈灵兽/契语 → N 必须等于 `PETS.length`;
 * ② 用例名里出现「N 顶」→ N 必须等于 `TITLES.length`;
 * ③ 用例名里出现「N 条…分支」→ N 必须等于 `GONGFA_BRANCHES.length`。
 *
 * 三条都是**具体的说法**,不会误伤;而它们覆盖了全部 `.spec.ts`,治得住「抄到第四处」。
 */
import { describe, expect, it } from "vite-plus/test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "@/test/readSource";
import { PETS } from "@/data/pets";
import { TITLES } from "@/data/titles";
import { GONGFA_BRANCHES } from "@/data/gongfaBranches";

/** 汉字数字(一 ~ 九百九十九)→ 阿拉伯数字 */
function cn(raw: string): number | null {
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
  if (!raw.includes("十") && !raw.includes("百")) {
    return D[raw] ?? (Number.isNaN(Number(raw)) ? null : Number(raw));
  }
  let total = 0;
  let section = 0;
  for (const ch of raw) {
    if (ch === "百") {
      total += (section || 1) * 100;
      section = 0;
    } else if (ch === "十") {
      total += (section || 1) * 10;
      section = 0;
    } else if (D[ch] !== undefined) {
      section = D[ch]!;
    } else {
      return null;
    }
  }
  return total + section;
}

/** 收集所有 spec 的正文 */
function specTexts(): { file: string; text: string }[] {
  const out: { file: string; text: string }[] = [];
  const walk = (d: string): void => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === "tp") continue;
      const full = join(d, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.name.endsWith(".spec.ts")) continue;
      out.push({
        file: full.replace(ROOT, "").replace(/^\/+/, ""),
        text: readFileSync(full, "utf8"),
      });
    }
  };
  walk(join(ROOT, "src"));
  return out;
}

/** 取一个文件里所有 `it("...")` 的名字 */
function testNames(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/\bit\(\s*"((?:[^"\\]|\\.)*)"/g)) out.push(m[1]!);
  return out;
}

describe("用例名里的数字", () => {
  it("① 「N 只」且谈灵兽/契语时,N 等于灵兽数", () => {
    const wrong: string[] = [];
    let hits = 0;
    for (const { file, text } of specTexts()) {
      if (file.endsWith("testNameCounts.spec.ts")) continue;
      for (const name of testNames(text)) {
        if (!/灵兽|契语/.test(name)) continue;
        for (const m of name.matchAll(
          /([一二三四五六七八九]{0,1}十[一二三四五六七八九]{0,1})只/g,
        )) {
          const n = cn(m[1]!);
          if (n === null) continue;
          hits += 1;
          if (n !== PETS.length) wrong.push(`${file}: 「${name}」写 ${n} 只,实际 ${PETS.length}`);
        }
      }
    }
    expect(wrong, "用例名里的「N 只」与灵兽数不符:" + wrong.join("、")).toEqual([]);
    expect(hits, "一处都没找到 —— 判据在空转").toBeGreaterThanOrEqual(1);
  });

  it("② 「N 顶」的 N 等于称号数", () => {
    const wrong: string[] = [];
    let hits = 0;
    for (const { file, text } of specTexts()) {
      if (file.endsWith("testNameCounts.spec.ts")) continue;
      for (const name of testNames(text)) {
        for (const m of name.matchAll(
          /([一二三四五六七八九]{0,1}十[一二三四五六七八九]{0,1})顶/g,
        )) {
          const n = cn(m[1]!);
          if (n === null) continue;
          hits += 1;
          if (n !== TITLES.length)
            wrong.push(`${file}: 「${name}」写 ${n} 顶,实际 ${TITLES.length}`);
        }
      }
    }
    expect(wrong, "用例名里的「N 顶」与称号数不符:" + wrong.join("、")).toEqual([]);
    expect(hits, "一处都没找到").toBeGreaterThanOrEqual(1);
  });

  it("③ 「N 条…分支」的 N 等于悟道分支数", () => {
    const wrong: string[] = [];
    let hits = 0;
    for (const { file, text } of specTexts()) {
      if (file.endsWith("testNameCounts.spec.ts")) continue;
      for (const name of testNames(text)) {
        /*
         * 必须同时含「都 / 全部 / 全」这类**全称词**才算总数声明。
         * 第一版只查「name 含分支」,于是「悟道是一条路,不是一件神装」
         * 「撞一条可能巧合」这些**泛指**全被当成「说分支总数是 1」—— 一次误报 4 处。
         */
        if (!name.includes("分支")) continue;
        /*
         * 数字**紧跟**全称词才算(「一百九十九条分支都…」/「全 199 条」)。
         * 只查 name 里有没有「全」字会误伤「全撞就是复刻」这种 ——
         * 那个「全」修饰的是「撞」,不是数字。
         */
        if (
          !/(条[^ ]{0,4}(?:都|全部|全)|全(?:部)?\s*(?:\d+|[一二三四五六七八九十百]+)\s*条)/.test(
            name,
          )
        ) {
          continue;
        }
        // 汉字或阿拉伯数字都可以
        for (const m of name.matchAll(/([一二三四五六七八九十百]{1,4}|\d+)\s*条/g)) {
          const n = cn(m[1]!);
          if (n === null) continue;
          hits += 1;
          if (n !== GONGFA_BRANCHES.length) {
            wrong.push(`${file}: 「${name}」写 ${n} 条,实际 ${GONGFA_BRANCHES.length}`);
          }
        }
      }
    }
    expect(wrong, "用例名里的「N 条…分支」与分支数不符:" + wrong.join("、")).toEqual([]);
    expect(hits, "一处都没找到").toBeGreaterThanOrEqual(1);
  });

  it("④ 汉字数字解析器本身要对(含百位)", () => {
    expect(cn("十")).toBe(10);
    expect(cn("四十")).toBe(40);
    expect(cn("四十四")).toBe(44);
    expect(cn("一百九十九")).toBe(199);
    expect(cn("七十七")).toBe(77);
    expect(cn("猫")).toBeNull();
  });

  it("反空转:扫到了足够多的 spec 与用例名", () => {
    const specs = specTexts();
    expect(specs.length, "一个 spec 都没扫到").toBeGreaterThan(300);
    const totalNames = specs.reduce((n, s) => n + testNames(s.text).length, 0);
    expect(totalNames, "扫到的用例名太少 —— 提取逻辑坏了").toBeGreaterThan(1000);
  });
});
