/**
 * 风味文字不许带数值 —— 三处都这么写,但只有一处有判据。
 *
 * ## 声明在同一条纪律上,守卫却只有一份
 *
 * 这三处数据文件各自写着同一句话:
 *
 * - `data/earlyGame.ts`  「`desc` / `effect` 只写**风味**,一个数字都不许带」
 * - `data/inscriptions.ts`「每句都不带数字:铭文是叙事,数字该来自这一件自己的成色」
 * - `data/petVows.ts`    「每句都不带数字:数字该来自 `mods` 与 `petTraitText`」
 *
 * 理由是一致的:同一个数若既写在结算里又抄进文案,改常数那天文案就开始撒谎
 * (AGENTS「界面上出现的每个数字都与结算同源」)。
 *
 * 而实测只有铭文那条有判据(`core/inscription.spec` 的「铭文库本身不重复、
 * 不带数字」),早游戏与灵兽誓词两头空着 —— 与第 23 轮那处同一形态:
 * 规矩写了,没人守。
 *
 * ## 只禁阿拉伯数字,不禁汉字
 *
 * 灵兽誓词里有「一坐下去,脚下的土都实了**三分**」——「三分」是文学虚指
 * (实了三分 = 很实),不是数值承诺,把它判成红会是误伤。
 * 真正的风险是 `+8%` / `3 分钟` 这类阿拉伯数字读数:它们长得就像结算真值,
 * 抄进文案才有撒谎的余地。故判据只认 ASCII 数字。
 *
 * ## 扫描口径
 *
 * 从**源码文本**取字段值(不走运行时),这样连对象字面量里被注释掉的历史句
 * 也不会漏。只取 `desc:` / `effect:` 之后的字符串字面量,以及 petVows 那种
 * 「键: "句子"」的映射值。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

/** 取出「字段名: "值"」形态里所有值的字符串 */
function fieldValues(src: string, field: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`\\b${field}:\\s*"([^"]*)"`, "g");
  for (const m of src.matchAll(re)) out.push(m[1]!);
  return out;
}

/** petVows 那种 `pet_xxx: "句子",` 的映射值 */
function vowValues(src: string): string[] {
  const out: string[] = [];
  const re = /^\s*(pet_[a-z_]+):\s*"([^"]*)",?\s*$/gm;
  for (const m of src.matchAll(re)) out.push(m[2]!);
  return out;
}

/** 只认 ASCII 数字 —— 汉字数字是文学虚指,不算数值承诺 */
function hasAsciiDigit(text: string): boolean {
  return /[0-9]/.test(text);
}

describe("风味文字 · 不许带数值", () => {
  it("早游戏的顿悟选项 desc 不带阿拉伯数字", () => {
    const src = readSource("src/data/earlyGame.ts");
    const bad = fieldValues(src, "desc").filter(hasAsciiDigit);
    expect(
      bad,
      `这些 desc 里写了数字 —— 数值该由 ui/earlyGameText 从 buffId 现算:\n  ${bad.join("\n  ")}`,
    ).toEqual([]);
  });

  it("灵兽誓词不带阿拉伯数字", () => {
    const src = readSource("src/data/petVows.ts");
    const bad = vowValues(src).filter(hasAsciiDigit);
    expect(
      bad,
      `这些誓词里写了数字 —— 数字该来自 mods 与 petTraitText:\n  ${bad.join("\n  ")}`,
    ).toEqual([]);
  });

  it("铭文不带阿拉伯数字 —— 与 inscription.spec 同一口径,这里补上文本侧", () => {
    const src = readSource("src/data/inscriptions.ts");
    // 铭文句在 { id, minRank, text } 这个形状里,取 text 那一栏
    const texts = fieldValues(src, "text");
    expect(texts.length, "一条铭文都没取到 —— 取值口径要跟着数据结构走").toBeGreaterThan(0);
    const bad = texts.filter(hasAsciiDigit);
    expect(bad, `这些铭文里写了数字:\n  ${bad.join("\n  ")}`).toEqual([]);
  });

  it("反空转:三处都真取到了文字 —— 取空了这条判据就没意义", () => {
    const early = fieldValues(readSource("src/data/earlyGame.ts"), "desc");
    const vows = vowValues(readSource("src/data/petVows.ts"));
    expect(early.length, "早游戏 desc 一条都没取到").toBeGreaterThan(0);
    expect(vows.length, "灵兽誓词一条都没取到").toBeGreaterThan(0);
  });

  it("汉字数字不算违规 —— 「实了三分」是虚指,不是数值承诺", () => {
    // 这条同时锁住上面三条判据的口径:它们只禁 ASCII 数字
    const vows = vowValues(readSource("src/data/petVows.ts"));
    const withChineseNumeral = vows.filter((v) => /[一二三四五六七八九十百千万]/.test(v));
    expect(
      withChineseNumeral.length,
      "灵兽誓词里原本就有汉字数字的句子(如「实了三分」),它们是合法风味写法",
    ).toBeGreaterThan(0);
  });
});
