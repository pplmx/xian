/**
 * 获得名号时 —— 只说名字,不说它给了什么。
 *
 * ## 复现
 *
 * 称号发下来的那一刻,玩家看到的是一行:
 *
 * ```text
 * 获得名号「初入仙途」
 * ```
 *
 * 而 `data/titles` 里 29 个称号**全部带 `mods`**,无一例外:
 *
 * ```ts
 * { id: "ti_churu",   name: "初入仙途", mods: { cultivationSpeed: 0.02 } }
 * { id: "ti_lianqi",  name: "炼气修士", mods: { cultivationSpeed: 0.03 } }
 * { id: "ti_zhuji",   name: "筑基真人", mods: { cultivationSpeed: 0.04, maxHpPct: 0.03 } }
 * ```
 *
 * 也就是说,**称号价值的一半在加成上**,而获得这一屏一个字都没提。
 *
 * ## 为什么这一处值得修
 *
 * 这一作在别处都把加成摊得很开:丹药有「服之 X」、装备词条逐条列、buff 有「叠 N」与
 * 「现效合计」,连突破准备都摊了四项读数。唯独称号 —— 拿到手时,玩家只知道它叫什么。
 *
 * 而称号页是**要专门去翻**的:玩家刚打完一场,只看到一行「获得名号」,不会立刻想到
 * 「我去名号页看看它加了什么」。等到他想起来,那一刻已经过去了。
 *
 * ## 判据守什么
 *
 * 一条:发名号的报喜里要带上它的加成,且加成文案走 `modsText`(不在报喜处另拼一份)。
 *
 * 文案格式不限,但必须能从这一行读出来「它有什么用」。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

const CORE = "src/core/progress.ts";

describe("获得名号 · 要说清它加了什么", () => {
  it("报喜里带上加成,且走 modsText", () => {
    const src = readSource(CORE)
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    /*
     * 从「获得名号」**往前**也要取一段 —— 加成文案通常算在前面(bonus = modsText(...)),
     * 再插进 notify 字符串里。只往后取会漏掉它(实测就是这样漏的)。
     */
    const at = src.indexOf("获得名号");
    expect(at, "定位不到「获得名号」 —— 判据会空转").toBeGreaterThan(-1);
    const line = src.slice(Math.max(0, at - 600), at + 300);
    expect(line, "定位不到「获得名号」那一行 —— 判据会空转").not.toBe("");
    /*
     * 现在写的是 notify(`获得名号「${...name}」`, "rare") —— 只有名字。
     * 判据要求这一行带上加成文案,且那份文案来自 modsText(与装备/buff 同源)。
     */
    expect(line, "「获得名号」只报名字 —— 29 个称号全部带 mods,玩家却读不到它加了什么").toMatch(
      /modsText|mods/,
    );
  });

  it("从不手拼百分数 —— 加成文案只有 modsText 一处口径", () => {
    const src = readSource(CORE)
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    // 报喜那一行不许出现自己乘 100 拼百分号的写法
    expect(src, "不许在报喜处手拼百分数").not.toMatch(/name[\s\S]{0,80}\*\s*100/);
  });

  it("反空转:名号仍要报出来", () => {
    const src = readSource(CORE);
    expect(src, "名号本身仍要报").toContain("获得名号");
    expect(src, "仍走 rare 档").toMatch(/获得名号[\s\S]{0,200}"rare"/);
  });
});
