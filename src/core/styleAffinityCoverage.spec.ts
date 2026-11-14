/**
 * 每个流派都得在克制矩阵里有一行 —— 缺了会静默退化成「3 星、无理由」。
 *
 * ## 由来（第 263 轮）
 *
 * `core/buildAdvisor.ts` 里有两张按流派 id 索引的表:
 *
 * ```ts
 * const STYLE_TRAIT_AFFINITY: Record<string, Record<EcoTrait, number>> = { beishui: {…}, … };
 * const STYLE_BOSS_AFFINITY: Record<string, number> = { beishui: 2, … };
 * ```
 *
 * 键类型是**裸 `string`**，而权威流派表在 `data/souls.ts` 的 `SoulTypeId`
 * （`"beishui" | "gangdun" | …` 六类）。两边没有类型约束。
 *
 * 而消费侧的兜底把它变成了**静默降级**:
 *
 * ```ts
 * const affinity = STYLE_TRAIT_AFFINITY[styleId];
 * if (!affinity) return { stars: 3, reasons: [] };   // 中性，看起来完全正常
 * ```
 *
 * 于是「新加一个流派、忘了补矩阵」这件事，界面上表现为那个流派**永远 3 星、没有任何理由**
 * —— 玩家看到的是一个中性的评价，不会想到那是漏配。
 *
 * ## 判据
 *
 * ① 防空转:`SOUL_TYPES` 不止两个、两张表都不空;
 * ② `SOUL_TYPES` 的每个 id 在 `STYLE_TRAIT_AFFINITY` 里有整行（四个特性键齐全）;
 * ③ `SOUL_TYPES` 的每个 id 在 `STYLE_BOSS_AFFINITY` 里有值;
 * ④ 反向也不许多:两张表里不许有 `SOUL_TYPES` 之外的键（改名后的残骸）。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ROOT } from "@/test/readSource";
import { SOUL_TYPES } from "@/data/souls";

const TRAITS = ["burst", "multi", "pierce", "dodge"] as const;

/** 从源码里解析出两张表的键与（可选）整行内容 —— 它们不是导出的，只能读文本。 */
function tables(): { traitKeys: string[]; traitRows: Map<string, string[]>; bossKeys: string[] } {
  const src = readFileSync(resolve(ROOT, "src/core/buildAdvisor.ts"), "utf8");

  const traitStart = src.indexOf("const STYLE_TRAIT_AFFINITY");
  const traitEnd = src.indexOf("\n};", traitStart);
  expect(traitStart, "找不到 STYLE_TRAIT_AFFINITY —— 表名变了").toBeGreaterThan(0);
  expect(traitEnd, "找不到 STYLE_TRAIT_AFFINITY 的结束 —— 解析会越界").toBeGreaterThan(0);
  const traitBlock = src.slice(traitStart, traitEnd);

  const traitRows = new Map<string, string[]>();
  const traitKeys: string[] = [];
  for (const m of traitBlock.matchAll(/^\s{2}([a-z]+):\s*\{([^}]*)\}/gm)) {
    const key = m[1]!;
    traitKeys.push(key);
    traitRows.set(
      key,
      [...m[2]!.matchAll(/([a-z]+):/g)].map((x) => x[1]!),
    );
  }

  const bossStart = src.indexOf("const STYLE_BOSS_AFFINITY");
  const bossEnd = src.indexOf("\n};", bossStart);
  expect(bossStart, "找不到 STYLE_BOSS_AFFINITY —— 表名变了").toBeGreaterThan(0);
  expect(bossEnd, "找不到 STYLE_BOSS_AFFINITY 的结束").toBeGreaterThan(0);
  const bossBlock = src.slice(bossStart, bossEnd);
  const bossKeys = [...bossBlock.matchAll(/^\s{2}([a-z]+):\s*-?\d/gm)].map((m) => m[1]!);

  return { traitKeys, traitRows, bossKeys };
}

describe("流派克制矩阵 · 每个流派都得有一行", () => {
  it("扫得到流派与两张表（防空转）", () => {
    expect(SOUL_TYPES.length, "一个流派都没扫到").toBeGreaterThan(2);
    const t = tables();
    expect(t.traitKeys.length, "STYLE_TRAIT_AFFINITY 一行都没解析出来 —— 写法变了").toBeGreaterThan(
      2,
    );
    expect(t.bossKeys.length, "STYLE_BOSS_AFFINITY 一行都没解析出来").toBeGreaterThan(2);
  });

  it("每个流派在 STYLE_TRAIT_AFFINITY 里都有整行", () => {
    const { traitRows } = tables();
    const missing: string[] = [];
    const incomplete: string[] = [];
    for (const s of SOUL_TYPES) {
      const row = traitRows.get(s.id);
      if (!row) missing.push(s.id);
      else {
        const lack = TRAITS.filter((tr) => !row.includes(tr));
        if (lack.length) incomplete.push(`${s.id} 缺 ${lack.join("/")}`);
      }
    }
    expect(
      missing,
      "这些流派在克制矩阵里没有整行 —— 它们的适配评级会静默退化成「3 星、无理由」:" +
        missing.join(" / "),
    ).toEqual([]);
    expect(
      incomplete,
      "这些流派的矩阵行缺特性 —— 那一维会被当成 0:" + incomplete.join(" / "),
    ).toEqual([]);
  });

  it("每个流派在 STYLE_BOSS_AFFINITY 里都有值", () => {
    const { bossKeys } = tables();
    const known = new Set(bossKeys);
    const missing = SOUL_TYPES.filter((s) => !known.has(s.id)).map((s) => s.id);
    expect(
      missing,
      "这些流派没有首领克制值 —— 会兜到 0，面对首领的理由缺一条:" + missing.join(" / "),
    ).toEqual([]);
  });

  it("反向也不许多：表里不许有已消失的流派", () => {
    const declared = new Set<string>(SOUL_TYPES.map((s) => s.id));
    const t = tables();
    const dead = [...new Set([...t.traitKeys, ...t.bossKeys])].filter((k) => !declared.has(k));
    expect(dead, "这两张表里还留着已经不存在的流派 id:" + dead.join(" / ")).toEqual([]);
  });
});
