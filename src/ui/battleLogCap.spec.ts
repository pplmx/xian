/**
 * 战报「最多留几行」这个数，写在了五个地方 —— 而它们必须永远相等。
 *
 * ## 由来（第 193 轮，顺着上一轮的「裸数没有名字与来由」扫）
 *
 * `CombatPanel` 里有五处写着同一个上限:
 *
 * ```text
 * 431  displayed 只留最近 100 行,长战斗的 total 会更大 —— 取两者的小值比较
 * 432  Math.min(total, 100)          ← 判「是否读完」
 * 434  Math.min(log.length ?? 0, 100) ← 报「共几行」
 * 686  entries.slice(-100)           ← 即时出结果时截断
 * 705  displayed.value.slice(-99)     ← 逐行回放时追加（-99 + 1 = 100）
 * ```
 *
 * 五处、两种写法（`100` 与 `99`），**彼此没有任何关联**。
 * 改 `686` 那处而不改 `705`，回放时就会长到 101 行、与「共 100 行」对不上;
 * 改 `432` 而不改 `434`，进度条会永远走不满。
 *
 * ## 为什么 `-99` 是容易漏的那一处
 *
 * 别处的 `100` 一眼能看出是「上限」，而 `slice(-99)` 读起来像另一个数 ——
 * 但它的意思正是「留 99 行再加 1 行 = 100」。这种「差一」的写法最容易在改上限时被漏掉。
 *
 * ## 这条判据守什么
 *
 * ① 上限是**具名常量**;
 * ② 那五处都读同一个常量（不许再有裸 `100` 或裸 `99` 参与这件事）;
 * ③ 常量旁边写清来由。
 *
 * ## 故障注入
 *
 * 把 `slice(-(BATTLE_LOG_MAX - 1))` 换回裸数 `slice(-99)` → 「是具名常量」那条红。
 * 把常量上方那块注释整块删掉 → 「写清了来由」那条红。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { stripComments } from "@/test/stripComments";

const PANEL = "src/components/adventure/CombatPanel.vue";

describe("战报上限 · 五处必须是同一个数", () => {
  it("上限是具名常量，不是散在五处的裸数", () => {
    const src = stripComments(readSource(PANEL));
    /*
     * 认「参与战报上限这件事」的裸数:`slice(-100)`、`slice(-99)`、
     * `Math.min(..., 100)`。注释里那句「只留最近 100 行」不算（已剥注释）。
     */
    const bare: string[] = [];
    if (/entries\.slice\(-\d+\)/.test(src)) bare.push("entries.slice(-N)");
    if (/displayed\.value\.slice\(-\d+\)/.test(src)) bare.push("displayed.value.slice(-N)");
    if (/Math\.min\([^)]*,\s*\d{2,}\)/.test(src)) bare.push("Math.min(..., N)");

    expect(
      bare,
      "战报上限还是裸数 —— 它同时决定了「截断到几行」「共几行」「是否读完」三件事，" +
        "而这三处分在五处、两种写法（100 与 -99）。改一处漏一处，进度条就永远走不满或内容对不上",
    ).toEqual([]);
  });

  it("那个常量真的存在，且被三处以上引用", () => {
    const src = stripComments(readSource(PANEL));
    const m = /const (BATTLE_LOG_MAX\w*)\s*=\s*(\d+)/.exec(src);
    expect(m, "没有给战报上限起名字").not.toBeNull();
    const name = m![1]!;
    const uses = [...src.matchAll(new RegExp(`\\b${name}\\b`, "g"))].length;
    /* 声明 1 次 + 至少 4 处使用（判读完 / 报总数 / 即时截断 / 回放追加） */
    expect(uses, `常量 ${name} 只出现 ${uses} 次 —— 那五处里还有没改过来的`).toBeGreaterThanOrEqual(
      4,
    );
  });

  it("上限是正数且在合理区间（防空转 + 防手滑）", () => {
    const src = stripComments(readSource(PANEL));
    const m = /const BATTLE_LOG_MAX\w*\s*=\s*(\d+)/.exec(src);
    expect(m, "找不到常量").not.toBeNull();
    const n = Number(m![1]);
    /* 少于 20 行读不出战斗经过;多于 500 行在手机上滑不完、也没人看 */
    expect(n, "战报上限太小 —— 读不出这场是怎么打的").toBeGreaterThanOrEqual(20);
    expect(n, "战报上限太大 —— 长战斗在手机上滑不完，也没人真的翻到第 400 行").toBeLessThanOrEqual(
      500,
    );
  });

  it("常量旁边写清了来由", () => {
    const src = readSource(PANEL);
    /*
     * 只看**紧邻上面的那块注释** —— 第一版取 `idx - 600` 的窗口，
     * 于是把别处的「行」字也扫进来了:把这段注释整块删掉，判据照样绿（实测）。
     */
    const decl = src.indexOf("const BATTLE_LOG_MAX");
    expect(decl, "找不到常量").toBeGreaterThan(-1);
    // 往回找最近的一个 `/**`，且中间不许出现别的语句
    const docStart = src.lastIndexOf("/**", decl);
    expect(docStart, "常量上方没有注释块").toBeGreaterThan(-1);
    const between = src.slice(docStart, decl);
    // 注释块与常量之间只能是空白
    expect(
      between.trimEnd().endsWith("*/"),
      "常量上方最近的那块注释与它之间还隔着别的代码 —— 那不算「旁边」",
    ).toBe(true);
    expect(between, "上限旁边没有一句来由 —— 下一个人改它时只能猜「为什么是 100」").toMatch(
      /为什么/,
    );
  });
});
