/**
 * 每个计数器都必须有人累加 —— 否则引用它的成就永远拿不到。
 *
 * ## 由来（第 258 轮）
 *
 * `achievementHint.spec` 已经双向守着「计数器键 ↔ 方向表」:
 *
 * ```text
 * ① CounterKey 里的每个键,COUNTER_DIRECTIONS 里都有
 * ② 方向上不许有已经消失的键
 * ```
 *
 * 但它守的是「有没有一句话说明往哪走」，不是「那个数会不会涨」。
 *
 * 一个计数器只要在 `CounterKey` 联合里声明了，`track(key)` 就编译得过;
 * 而如果**没有任何地方真的调 `track("那个键")`**，它的值永远是 0 ——
 * 引用它的成就在游戏里永远灰着，玩家找不到任何提示说「这个拿不到」。
 *
 * ## 这条判据守什么
 *
 * 扫 `src` 下所有非 spec 源码，找出所有 `track("键")` / `track("键", n)` 的字面量调用，
 * 要求 `CounterKey` 的每个键至少出现一次。
 *
 * 它不检查语义是否正确（某处该记 1 却记了 2 之类）—— 那是各模块自己的判据。
 * 它只保证:**没有一条计数器是死的。**
 *
 * ## 什么时候可以放宽
 *
 * 若某个键是「预留、尚未接线」的，把它加进 `PENDING` 并写明理由与打算接的时机。
 * 名单不常驻:一旦有人接上，第二条判据会红，逼着把它删掉。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ROOT, readSource, walkFiles } from "@/test/readSource";

/** 已声明但尚未接线的键 —— 加一条要写明理由。 */
const PENDING = new Map<string, string>([]);

/** 从 `types/index.ts` 的 `CounterKey` 联合里取出全部键。 */
function counterKeysFromTypes(): string[] {
  const src = readFileSync(resolve(ROOT, "src/types/index.ts"), "utf8");
  const start = src.indexOf("export type CounterKey");
  expect(start, "找不到 CounterKey 的声明 —— 类型名变了").toBeGreaterThan(0);
  const rest = src.slice(start);
  const end = rest.indexOf(";");
  expect(end, "CounterKey 的声明没有分号 —— 解析会越界").toBeGreaterThan(0);
  const block = rest.slice(0, end);
  return [...new Set([...block.matchAll(/["']([A-Za-z]+)["']/g)].map((m) => m[1]!))];
}

/** 所有真的被调用的计数器键（只认字面量）。 */
function trackedKeys(): Set<string> {
  const out = new Set<string>();
  for (const file of walkFiles("src", (f) => f.endsWith(".ts") && !f.endsWith(".spec.ts"))) {
    const src = readSource(file);
    for (const m of src.matchAll(/\btrack\(\s*["']([A-Za-z]+)["']/g)) out.add(m[1]!);
  }
  return out;
}

describe("计数器接线 · 没有一条是死的", () => {
  it("扫得到足够多的键与调用点（防空转）", () => {
    expect(counterKeysFromTypes().length, "一个计数器都没扫到").toBeGreaterThan(10);
    expect(trackedKeys().size, "一个 track() 调用都没扫到 —— 函数改名了?").toBeGreaterThan(10);
  });

  it("每个 CounterKey 都至少有一处 track() 调用", () => {
    const declared = counterKeysFromTypes();
    const wired = trackedKeys();
    const dead = declared.filter((k) => !wired.has(k) && !PENDING.has(k));
    expect(
      dead,
      "这些计数器没有任何地方累加 —— 引用它的成就永远拿不到，玩家也看不到任何解释:" +
        dead.join(" / "),
    ).toEqual([]);
  });

  it("PENDING 里不许留已经接上的键（名单不常驻）", () => {
    const wired = trackedKeys();
    const nowWired = [...PENDING.keys()].filter((k) => wired.has(k));
    expect(
      nowWired,
      "这些键已经有人接线了 —— 把它们从 PENDING 里删掉:" + nowWired.join(" / "),
    ).toEqual([]);
  });

  it("PENDING 的每一条都写了理由", () => {
    for (const [key, why] of PENDING) {
      expect(why.length, `${key} 没写为什么可以先不接线`).toBeGreaterThan(10);
    }
  });
});
