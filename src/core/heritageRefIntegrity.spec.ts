/**
 * 反向检查：core 里写的传承 id 必须在 data 里真的存在。
 *
 * ## 由来（第 262 轮）
 *
 * `HeritageId` 的类型是 **`string`**（`src/data/heritage.ts:29`），不是字面量联合 ——
 * 于是拼错一个 id，`vue-tsc` 一个字都不会说。而它的消费方式全是 `includes()`:
 *
 * ```ts
 * return owned.includes("yuanying") ? 1 : 0;
 * ```
 *
 * 拼成 `"yuanyin"` 的后果是**静默的**:`includes` 返回 false，那个天赋永远不生效，
 * 玩家点满传承却什么也没得到，界面不会有任何提示。
 *
 * ## 既有的那条判据只查一个方向
 *
 * `heritageEffects.spec` 的「每个传承 id 都在 core/stores 里有消费点（不是空头支票）」
 * 查的是:
 *
 * ```text
 * data 里的每个 id  → 有没有被 core/stores 提到
 * ```
 *
 * 反过来那一半没人查:
 *
 * ```text
 * core 里写的 id  → 在 data 里存不存在
 * ```
 *
 * 这条补的就是那一半。两条合起来，`HeritageId = string` 这个类型缺口才算被填上。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { readdirSync } from "node:fs";
import { HERITAGE_DEFS } from "@/data/heritage";

/** core / stores / composables 下的非 spec 源码。 */
function sourceText(): string {
  const root = resolve(__dirname, "..");
  const parts: string[] = [];
  for (const dir of ["core", "stores", "composables"]) {
    let names: string[];
    try {
      names = readdirSync(join(root, dir));
    } catch {
      continue;
    }
    for (const f of names) {
      if (!f.endsWith(".ts") || f.endsWith(".spec.ts")) continue;
      parts.push(readFileSync(join(root, dir, f), "utf8"));
    }
  }
  return parts.join("\n");
}

/**
 * 从源码里抽出所有**疑似传承 id** 的字面量。
 *
 * 只看两种形态 —— 它们都是「拿一个 id 去比对」的写法:
 * `consumeHeritageUse("xxx")` 与 `heritage.includes("xxx")` / `owned.includes("xxx")`。
 * 不做全局扫描:那会把普通字符串也当成 id，误报一片。
 */
function heritageIdLiterals(text: string): { id: string; where: string }[] {
  const out: { id: string; where: string }[] = [];
  const patterns: [RegExp, string][] = [
    [/consumeHeritageUse\(\s*"([a-z]+)"/g, "consumeHeritageUse"],
    [/\b(?:heritage|owned|ownedHeritage\(\))\.includes\(\s*"([a-z]+)"/g, "includes"],
    [/\bowned\.includes\(\s*"([a-z]+)"/g, "includes"],
  ];
  for (const [re, where] of patterns) {
    for (const m of text.matchAll(re)) out.push({ id: m[1]!, where });
  }
  return out;
}

describe("传承引用 · core 里写的 id 必须真的存在", () => {
  it("扫得到足够多的传承 id 与调用点（防空转）", () => {
    expect(HERITAGE_DEFS.length, "一个传承都没扫到").toBeGreaterThan(4);
    const literals = heritageIdLiterals(sourceText());
    expect(
      literals.length,
      "一个传承 id 字面量都没扫到 —— 写法变了，这条判据会永远绿",
    ).toBeGreaterThan(4);
  });

  it("每个被硬编码的传承 id 都在 HERITAGE_DEFS 里", () => {
    const known = new Set(HERITAGE_DEFS.map((d) => d.id));
    const bad = heritageIdLiterals(sourceText())
      .filter((l) => !known.has(l.id))
      .map((l) => `${l.where}("${l.id}")`);
    expect(
      [...new Set(bad)],
      "这些传承 id 在 data 里不存在 —— 那条天赋永远不生效，而玩家不会有任何提示:" +
        [...new Set(bad)].join(" / "),
    ).toEqual([]);
  });

  it("凭空造一个拼错的 id 会被抓住（自检：判据本身有效）", () => {
    const known = new Set(HERITAGE_DEFS.map((d) => d.id));
    const probe = heritageIdLiterals('owned.includes("yuanyin"); consumeHeritageUse("nope");');
    expect(probe.length, "抽取函数对探针无效 —— 它认不出这些写法").toBeGreaterThan(0);
    expect(probe.filter((p) => !known.has(p.id)).length).toBeGreaterThan(1);
  });
});
