/**
 * 计数器 → 行为：一张**满**的表，两处都读它。
 *
 * ## 由来
 *
 * 这张表原先只有半份，住在 `ui/mentorBehaviorAxes` 里，只收师承用得到的十个键。
 * 而「素行由哪些行为推出来」(`data/bondEvents` 的 `LEAN_COUNTERS`)另用五个键
 * (`tribulations` / `battles` / `upgrades` / `decomposed` / `gongfaLearned`)——
 * 那里没有说法。若照着师承那半张再抄一张，就是本仓反复修的「两本账」。
 *
 * 现在收在 `data/counterText`，类型是 `Record<CounterKey, string>`：
 * 新增一个计数器而忘了给它一个行为说法，`vue-tsc` 当场报错。
 * 但类型拦不住**反向**（表里留着已经消失的键），故这里补一条双向判据。
 *
 * ## 与 `achievementHint.spec` 的分工
 *
 * 那一份守的是 `COUNTER_DIRECTIONS`（成就的卷目分类），这一份守 `COUNTER_BEHAVIOR`
 * （玩家做了什么）。两者都是「计数器 → 中文」，但用途不同：改卷目分类不该改行为叙述。
 * 两份表都必须满 —— 只是满的理由不同。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { COUNTER_BEHAVIOR, counterBehavior } from "@/data/counterText";
import { MENTOR_WEIGHTS } from "@/core/mentorService";
import { LEAN_COUNTERS } from "@/data/bondEvents";
import type { CounterKey } from "@/types";

/** 从类型声明里扫出 CounterKey 的联合成员（同 achievementHint.spec 的写法） */
function counterKeysFromTypes(): string[] {
  const src = readFileSync(resolve(__dirname, "../types/index.ts"), "utf8");
  const start = src.indexOf("export type CounterKey =");
  expect(start, "types/index.ts 里找不到 CounterKey").toBeGreaterThanOrEqual(0);
  const end = src.indexOf("export type AchvCond", start);
  const block = src.slice(start, end > 0 ? end : undefined);
  return [...new Set([...block.matchAll(/["']([A-Za-z]+)["']/g)].map((m) => m[1]!))];
}

describe("计数器行为表 · 满、双向、两个消费者都读得到", () => {
  it("CounterKey 的每个键都有行为说法", () => {
    const declared = counterKeysFromTypes();
    expect(declared.length, "一个计数器都没扫到,断言形同虚设").toBeGreaterThan(10);
    const missing = declared.filter((k) => !(k in COUNTER_BEHAVIOR));
    expect(
      missing,
      `这些计数器没有行为说法 —— 用到它的界面只能印键名:${missing.join("、")}`,
    ).toEqual([]);
  });

  it("反向也不许多:表里不许留着已经消失的计数器", () => {
    const declared = new Set(counterKeysFromTypes());
    const dead = Object.keys(COUNTER_BEHAVIOR).filter((k) => !declared.has(k));
    expect(dead, `行为表里这些键已经不在 CounterKey 里了:${dead.join("、")}`).toEqual([]);
  });

  it("每条说法都是人话 —— 不许把它自己的键名原样印回来", () => {
    /*
     * 抄一条 `kills: "kills"` 进来,表是满的、双向也对，而玩家读到的是内部字段名。
     * `achievementHint.spec` 在师承那处守的就是这一条,这里照抄。
     */
    const bad = Object.entries(COUNTER_BEHAVIOR)
      .filter(([key, text]) => text === key || /^[a-z][A-Za-z]*$/.test(text))
      .map(([key]) => key);
    expect(bad, `这些条目的「说法」还是键名本身:${bad.join("、")}`).toEqual([]);
  });

  it("两个消费者用得到的键,表里都有 —— 这条挡的是「半张表各自长」", () => {
    /*
     * 师承与素行是这张表眼下仅有的两个消费者。若哪一个的权重表/行为表用了
     * 表里没有的键,那个键在界面上就退回成键名（`counterBehavior` 的兜底）。
     * 这里直接读两个消费者自己的表,而不是抄一份「它们用了哪些键」。
     */
    const usedByMentor = [...new Set(Object.values(MENTOR_WEIGHTS).flatMap((w) => Object.keys(w)))];
    const usedByLean = [...new Set(Object.values(LEAN_COUNTERS).flat())] as CounterKey[];
    const missing = [...usedByMentor, ...usedByLean].filter((k) => !(k in COUNTER_BEHAVIOR));
    expect(
      [...new Set(missing)],
      `这些键被师承/素行用到,而行为表里没有:${[...new Set(missing)].join("、")}`,
    ).toEqual([]);
  });

  it("兜底方向是安全的:表外键退回键名,不编一个中文", () => {
    // 宁可难看也不静默编——编一个「某事」会让缺口永远看不见
    expect(counterBehavior("not_a_counter" as CounterKey)).toBe("not_a_counter");
  });

  it("反空转:真取到了整张表", () => {
    expect(Object.keys(COUNTER_BEHAVIOR).length).toBe(counterKeysFromTypes().length);
  });
});
