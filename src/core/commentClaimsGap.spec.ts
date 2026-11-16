/**
 * 注释说「还没做」，而实现已经做了。
 *
 * ## 由来（第 445 轮）
 *
 * `core/economySim.ts` 的文件头写着：
 *
 * ```text
 *   本模型尚未把熔炉出口计入，故界外读到的高闲置是「没有出口模型」的读数
 * ```
 *
 * 而熔炉出口**早就在那份模型里**（同文件 `furnace` 段与 `daoFruitHoursOutside`），
 * `economySim.spec` 的文件头也写着「现已入模型（ISS-210 结清）」。
 *
 * ```text
 *   源码注释     「还没计入」
 *   spec 文件头  「已计入，ISS-210 结清」
 *   实现         第 329~371 行确实在算熔炉出口
 * ```
 *
 * **两本账，错的是源码那一本。** 它与 `commentScaleClaims`（注释里的数字过时）
 * 是一对：那一份管「数错了」，这一份管「状态错了」。
 *
 * ## 这条判据守什么
 *
 * 扫 `src/core/*.ts` 的文件头与块注释，找出「尚未 / 还没 / 未计入 / 待补」这类
 * **声称某件事没做**的短语，再看同一文件里有没有对应的实现痕迹。
 *
 * 口径刻意保守：只查「注释声称未做 × 同文件里那件事的标识符确实存在」这一种组合，
 * 不做语义理解。误报率高于漏报率是可以接受的 —— 它是一条**提醒**，不是铁律。
 */
import { describe, expect, it } from "vite-plus/test";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * 「声称未做」的短语与它对应的实现线索。
 *
 * 每一条都是**具体的一对**：左边是注释里可能出现的说法，右边是「做了」的证据。
 * 不加泛化规则 —— 泛化会让这条判据变成噪音源。
 */
const PAIRS: { gap: RegExp; done: RegExp; what: string }[] = [
  {
    gap: /尚未(?:把|将)?[^\n]{0,12}熔炉[^\n]{0,8}(?:计入|纳入|模型)/,
    done: /daoFruitHoursOutside|furnace/i,
    what: "熔炉出口",
  },
];

describe("注释声称未做 · 实现是否已经做了", () => {
  const files = readdirSync(resolve(__dirname, "."))
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".spec.ts"))
    .map((f) => ({ name: f, src: readFileSync(resolve(__dirname, f), "utf-8") }));

  it("没有「注释说没做、而同文件里已经做了」的组合", () => {
    /*
     * ## 引用旧说法不算
     *
     * 初版直接对整份文件跑 `gap` 正则 —— 于是**记录这次修正的那段注释本身**
     * 被判成命中:「它原来说『本模型尚未把熔炉出口计入…』」。
     *
     * 判据自己把「引用」当成了「声称」。故先把带引用标记的句子剔掉：
     * 一处注释若在讲「原来/此前/改过一次」，它说的是历史，不是当下状态。
     */
    const NON_CLAIM = /原来说|原来写|此前(?:是|写|说)|改过一次|曾(?:写|说|是)|旧说法|旧稿|过时/;
    const hits: string[] = [];
    for (const { name, src } of files) {
      /*
       * 逐句去判，而不是整份文件 —— 一句引用不该让整个文件脱罪，
       * 一句声称也不该被别处的引用牵连。
       */
      const sentences = src.split(/[。\n]/).filter((line) => !NON_CLAIM.test(line));
      const body = sentences.join("\n");
      for (const p of PAIRS) {
        if (p.gap.test(body) && p.done.test(src)) {
          hits.push(`${name}：注释说「${p.what}」尚未完成，而同文件里已有实现痕迹`);
        }
      }
    }
    expect(
      hits,
      "这些文件的注释落后于实现 —— 读到它的人会以为那件事没做而跳过那一栏：" + hits.join("；"),
    ).toEqual([]);
  });

  it("反差：这些短语本身是允许出现的 —— 判据只查「同文件又有实现」", () => {
    /*
     * 「尚未」是个正常的词。判据若把它一律禁掉，会把「尚未解锁时显示…」
     * 这类正当用法也打成错误。故这条显式记录口径：**只在同文件里同时出现
     * 实现痕迹时才算问题**。
     */
    const withPhrase = files.filter((f) => /尚未|还没|未计入/.test(f.src));
    expect(withPhrase.length, "全仓没有一处「尚未」—— 判据在空转").toBeGreaterThan(0);
  });
});
