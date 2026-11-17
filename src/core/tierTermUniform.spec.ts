/**
 * 区域层级该叫「阶」，而不是「层」。
 *
 * ## 由来（第 532 轮）
 *
 * 查「境」与「层」的用法是否统一时，发现这一处:
 *
 * ```text
 *   ui/itemText.ts:57   `${t.tier} 阶`              ← 装备
 *   ui/itemText.ts:81   `${a.fromTier} 阶起可现世`  ← 法宝
 *   ui/codex.ts:464     `到第 ${def.fromTier} 层（…）起才可能掉落。`   ← 同一件事叫「层」
 * ```
 *
 * ## 为什么这是问题
 *
 * 本作里「层」**专指境界小层**（如「金丹·三层」），而 `fromTier` 是**区域层级**
 * （tier 1~32，对应 32 处地界）。同一个字指两件事，玩家会问：
 * 「到第 9 层」是修到金丹九层，还是打到第 9 号地界？
 *
 * 而且它是**我自己引入的** —— 第 514 轮改 `codex.ts` 那句时写了「层」。
 *
 * ## 判据
 *
 * ① 报告区域层级的地方用「阶」，不用「层」;
 * ② 反差：「层」仍然可以用于境界小层（那是它本来该指的东西）;
 * ③ 反差：tier 的说法要与「品质」分开 —— 品质用「品」，层级用「阶」，境界小层用「层」。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const UI = resolve(__dirname, "../ui");

describe("术语 · 区域层级叫「阶」不叫「层」", () => {
  it("① 报告 fromTier / tier 的地方用「阶」", () => {
    const offenders: string[] = [];
    for (const f of ["codex.ts", "itemText.ts"]) {
      const src = readFileSync(resolve(UI, f), "utf8");
      /*
       * 找 `${…tier…} 层` 与 `第 ${…tier…} 层` 这类 —— 它们说的是区域层级。
       */
      /*
       * 找 `第 ${…tier…} 层` 与 `${…tier…} 层`。
       * 正则第一版写成 `` `[^`]{0,40}(?:fromTier|\.tier)[^`]{0,20}层[^`]{0,20}` `` ——
       * 而真句子里 `fromTier` 后面紧跟 `} 层（`，中间隔着反引号内的一切，
       * 那个模式匹配不到，于是判据空转。改成直接找「tier 变量 + 层」。
       */
      for (const m of src.matchAll(/\$\{[^}]{0,40}(?:fromTier|\.tier)[^}]{0,20}\}\s*层/g)) {
        offenders.push(`${f}: …${m[0]}…`);
      }
    }
    expect(
      offenders,
      "这些地方把区域层级说成了「层」—— 而「层」在本作里专指境界小层：" + offenders.join("；"),
    ).toEqual([]);
  });

  it("② 反差：「层」仍然可以用于境界小层", () => {
    /*
     * 这一条守的是①的边界 —— 不许把「层」从全仓删掉。
     * 境界小层（金丹·三层）本来就该叫「层」。
     */
    /*
     * 境界小层的叫法在 `data/realms` 与 `core/realmLadder` 一带 ——
     * 直接去那里找「层」这个词，确认它没有被一起清掉。
     */
    const ladder = readFileSync(resolve(__dirname, "../data/realms.ts"), "utf8");
    const hasLayer = ladder.includes("层") || ladder.includes("重");
    const layerNames = readFileSync(resolve(__dirname, "../core/realmLadder.ts"), "utf8");
    expect(
      hasLayer || layerNames.includes("层"),
      "境界小层不再叫「层」或「重」—— 那它该叫什么",
    ).toBe(true);
  });

  it("③ 反差：三个概念各用一个字 —— 品 / 阶 / 层", () => {
    const item = readFileSync(resolve(UI, "itemText.ts"), "utf8");
    /* 品质用「品」 */
    expect(item, "品质不再用「品」—— 三个概念会挤在一起").toMatch(/qualityDef\(.*\)\.name|品/);
    /* 区域层级用「阶」 */
    expect(item, "区域层级不再用「阶」").toContain("阶");
  });
});
