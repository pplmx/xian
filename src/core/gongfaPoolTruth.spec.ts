/**
 * 「参悟池尚余 N 部」—— 那个 N 必须是**参悟真的会抽的池子**。
 *
 * ## 由来（第 159 轮，功法页）
 *
 * 真仙期打开修行页的功法章，主修签下面读到的是一行:
 *
 * ```text
 * 此门已习 0 部 · 参悟池尚余 24 部
 * ```
 *
 * 那一行贴在**主修**签底下，读起来是「还有 24 部主修可以参悟」。
 * 而参悟这件事根本不分门:
 *
 * ```ts
 * // core/gongfaService.comprehendGongfa / learnRandomGongfa
 * const pool = GONGFA.filter((g) => g.minRealm <= player.major + 1 && !cultivation.learned[g.id]);
 * const picked = rng.weighted(pool, (g) => gongfaDrawWeight(g, elements, player.major));
 * ```
 *
 * 池子里没有 `g.type === ...` 这一条。实测同一份存档:
 *
 * ```text
 * major 0   全池 25 部（主修 12 + 辅修 13）        主修签报 12
 * major 5   全池 50 部（主修 20 + 辅修 21 + 秘术 9） 主修签报 20
 * major 9   全池 62 部（主修 24 + 辅修 25 + 秘术 13） 主修签报 24
 * ```
 *
 * 也就是说，主修签底下那个数**只有全池的 39%**，而它是玩家判断
 * 「再点几次能把主修补上」的唯一读数。实际点下去，抽到的可能是辅修或秘术。
 *
 * ## 判据
 *
 * ① 主修/辅修/秘术三签报的**必须是同一个数**（它们本就是同一个池子）;
 * ② 那个数要等于 `comprehendGongfa` 真正过滤出来的池子大小;
 * ③ 不许再用 `g.type === t` 去算「逐门余量」—— 那是这条错的来源。
 */
import { describe, expect, it } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { usePlayerStore } from "@/stores/player";
import { useCultivationStore } from "@/stores/cultivation";
import { GONGFA } from "@/data/gongfa";
import { readSource } from "@/test/readSource";

const SECTION = readSource("src/components/cultivation/GongfaSection.vue");

/** 参悟真正会抽的池子 —— 与 `core/gongfaService` 里的过滤逐字一致 */
function comprehendPool(): string[] {
  const player = usePlayerStore();
  const cult = useCultivationStore();
  return GONGFA.filter((g) => g.minRealm <= player.major + 1 && !cult.learned[g.id]).map(
    (g) => g.id,
  );
}

describe("参悟池 · 报的必须是参悟真的会抽的那个池子", () => {
  it("池子随境界增长,且不等于任何单一门类", () => {
    setActivePinia(createPinia());
    const player = usePlayerStore();
    player.initCharacter("池探针", { roots: [] } as never);
    const seen: number[] = [];
    for (const major of [0, 5, 9]) {
      while (player.major < major) player.advanceRealm();
      const pool = comprehendPool();
      seen.push(pool.length);
      const byType = new Map<string, number>();
      for (const id of pool) {
        const def = GONGFA.find((g) => g.id === id)!;
        byType.set(def.type, (byType.get(def.type) ?? 0) + 1);
      }
      // 池子**跨门类** —— 任一门类的数目都不等于全池（这正是那行字会撒谎的原因）
      for (const [type, count] of byType) {
        expect(count, `境 ${major} 的「${type}」恰等于全池 —— 判据失去了意义`).not.toBe(
          pool.length,
        );
      }
    }
    expect(seen, "参悟池该随境界变多").toEqual([...seen].sort((a, b) => a - b));
    expect(new Set(seen).size, "三个境界的池子不该一样大").toBeGreaterThan(1);
  });

  it("视图不再按门类过滤参悟池", () => {
    /*
     * 判的是那件事：算「参悟池尚余」时**不许**出现 `g.type === t`。
     * 原先写的是 `GONGFA.filter((g) => g.type === t && g.minRealm <= ... && !learned)`
     * 逐门各算一份 —— 那就是这条错的来源。
     */
    expect(SECTION, "参悟池不该按门类过滤").not.toMatch(/g\.type\s*===\s*t/);
    expect(SECTION, "池子大小要读同一个数").toMatch(/comprehendLeft|comprehendPoolLeft/);
  });

  it("三签报的是同一个数（同一个池子不分门）", () => {
    setActivePinia(createPinia());
    const player = usePlayerStore();
    player.initCharacter("池探针", { roots: [] } as never);
    while (player.major < 9) player.advanceRealm();
    /*
     * 三签共用 `comprehendLeft` 之后，「逐门余量」这个概念不存在了。
     * 判据落在模板上：三签那一段不许再引用 `gongfaPoolLeft[...]`（按门取数）。
     */
    expect(SECTION, "三签不许再按门取余量").not.toContain("gongfaPoolLeft[gongfaCat]");
  });
});
