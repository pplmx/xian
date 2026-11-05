/**
 * 每个落盘的 store 都要有 sanitize —— 存档是放置游戏的命脉。
 *
 * ## 为什么钉这一条
 *
 * 这个仓库有 17 个 store 落盘(`persist`),**每一个都有 `sanitize()`** ——
 * 现状是对的、执行得很彻底。但这件事**没有判据守着**:新写一个 store、忘了写
 * sanitize,静态门全绿、测试全绿。
 *
 * 而漏掉的代价很重:落盘的值会随存档穿过版本、穿过导入、穿过手改的 JSON。
 * 一个字段是 `NaN`、是 `undefined`、是被旧版本写成字符串的数字,进到界面就是
 * 「NaN 天前」这类东西 —— `saveBackup.spec` 的注释里写过同一句:
 *
 *   > 「NaN 天前」。sanitize 会修它,但界面不该赌 sanitize 已经跑过。
 *
 * 那句说的是界面,这里说的是**反过来**:界面之所以敢不赌,是因为每个 store 都
 * 真的 sanitize 过。这条判据守的就是那个前提。
 *
 * ## 判据口径
 *
 * 凡 `src/stores/*.ts` 里出现 `persist` 的,必须同时定义 `function sanitize`。
 *
 * 两个豁免,都写明理由:
 *   · `ui.ts` —— 纯界面态(弹窗开关、当前页签),不落盘,故不在扫描面里;
 *   · `.spec.ts` —— 测试文件不是 store。
 *
 * ## 为什么按「出现 persist」认人,而不是按文件清单
 *
 * 手写清单的通病是它不会自己长:新加一个 store 时没人想起来往表里补一行。
 * 上一轮「品阶不许只靠颜色」那条判据吃过的亏就在这里(逐个看 × 三次),
 * 改成一扫全库之后才收干净。这一条从一开始就按特征认人。
 */
import { describe, expect, it } from "vite-plus/test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "@/test/readSource";

const STORES = join(ROOT, "src/stores");

/** 纯界面态,不落盘 —— 它没有 persist,本就不会进扫描面,这里只是把话说清 */
const NOT_PERSISTED = new Set(["ui.ts"]);

describe("落盘的 store 都要有 sanitize", () => {
  it("凡有 persist 的 store,都定义了 sanitize", () => {
    const files = readdirSync(STORES).filter((n) => n.endsWith(".ts") && !n.endsWith(".spec.ts"));
    const missing: string[] = [];
    let scanned = 0;
    for (const name of files) {
      if (NOT_PERSISTED.has(name)) continue;
      const src = readFileSync(join(STORES, name), "utf8");
      // 去注释:注释里提到 persist 不算落盘
      const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
      if (!/\bpersist\b/.test(code)) continue;
      scanned += 1;
      if (!/function sanitize\s*\(/.test(code)) missing.push(name);
    }
    // 防空转:扫到的 store 数对不上,说明辨认规则坏了
    expect(scanned, "一个落盘 store 都没扫到 —— 辨认规则写错了").toBeGreaterThanOrEqual(10);
    expect(
      missing,
      `这些 store 落盘了却没有 sanitize —— 存档里一个 NaN 就会一路带进界面:\n  ${missing.join("\n  ")}`,
    ).toEqual([]);
  });

  it("反空转:认得出「落盘但没有 sanitize」的坏样本", () => {
    const bad = `export const useFooStore = defineStore("foo", () => { /* ... */ }, { persist: true });`;
    const good = `${bad}\nfunction sanitize(): void { /* 修字段 */ }`;
    const looksPersisted = (s: string) => /\bpersist\b/.test(s);
    const hasSanitize = (s: string) => /function sanitize\s*\(/.test(s);
    expect(looksPersisted(bad) && !hasSanitize(bad), "坏样本没被判出来").toBe(true);
    expect(looksPersisted(bad) && hasSanitize(good), "好样本被误判").toBe(true);
  });

  it("ui store 确实不落盘 —— 豁免要成立", () => {
    const src = readFileSync(join(STORES, "ui.ts"), "utf8");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(code, "ui store 说不落盘,就不该出现 persist").not.toMatch(/\bpersist\b/);
  });
});
