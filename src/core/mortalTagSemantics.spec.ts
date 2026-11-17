/**
 * 本世路线的事件标签，不该与那块地方完全不相干。
 *
 * ## 由来（第 462 轮）
 *
 * 第 461 轮修了首领与地界的语义绑定。这一轮去看**同一条链上的另一个字段**：
 * `eventTags` —— 它决定玩家在这里遇到什么故事。
 *
 * 实测 20 世 252 段：
 *
 * ```text
 *   与地界原生 eventTags 重合   19.4%
 *   一个原生标签都没用上的段     70 段
 * ```
 *
 * 具体长这样：
 *
 * ```text
 *   九幽魔渊  原生[general,dark] → 实际[ruin,ice]          魔渊里讲冰与废墟
 *   天外天    原生[general,sky]  → 实际[thunder,ice,ruin]  天外天里讲冰霜废墟
 *   鸿蒙裂隙  原生[general,sky]  → 实际[water]             虚空里讲水
 * ```
 *
 * ## 与 `contentTakeover` 的边界
 *
 * 那四条验收要求的是「同 fromId、不同 seed → **允许**产生不同 event」——
 * 从没说过「可以完全不相干」。**换过一批故事是对的，换到与这块地方无关就是错。**
 *
 * 故口径只保**至少一个**原生标签：保多了，本世事件池会退回成静态区域表，
 * 「不同 seed 产生不同 event」那条验收就变弱了。
 *
 * 改后：重合率 19.4% → 51.2%，全外来段 70 → 0。
 *
 * ## 判据
 *
 * ① 每一段至少有一个标签来自该地界的原生 eventTags；
 * ② 反差：标签仍不是静态表 —— 同一 fromId 在不同世界里允许不同；
 * ③ 反差：标签数量仍由节奏曲线决定。
 */
import { describe, expect, it } from "vite-plus/test";
import { generateMortalWorld } from "./mortalWorldGen";
import { REGIONS } from "@/data/regions";

const NATIVE = new Map(REGIONS.map((r) => [r.id, new Set(r.eventTags)]));
const SEEDS = Array.from({ length: 16 }, (_, i) => i * 61 + 1);

describe("本世事件标签 · 不该与那块地方完全不相干", () => {
  it("① 每一段至少有一个原生标签", () => {
    const foreign: string[] = [];
    for (const seed of SEEDS) {
      for (const c of generateMortalWorld(seed).chain) {
        const native = NATIVE.get(c.fromId);
        if (!native || native.size === 0) continue;
        const hit = c.eventTags.filter((t) => native.has(t)).length;
        if (c.eventTags.length > 0 && hit === 0) {
          foreign.push(
            `seed ${seed} 的「${c.name}」：原生[${[...native].join(",")}] → 实际[${c.eventTags.join(",")}]`,
          );
        }
      }
    }
    expect(
      foreign,
      "这段路上的故事与这块地方完全不相干：" + foreign.slice(0, 4).join("；"),
    ).toEqual([]);
  });

  it("② 反差：标签仍不是静态表 —— 同一地界在不同世界里可以不同", () => {
    /*
     * 保原生标签不能退化成「直接抄 REGIONS」。各世界的**标签集合**
     * 不该全都相同 —— 取一个出现多次的地界，看它在不同世里的标签是否变过。
     */
    const byRegion = new Map<string, Set<string>>();
    for (const seed of SEEDS) {
      for (const c of generateMortalWorld(seed).chain) {
        const sig = [...c.eventTags].sort().join("|");
        if (!byRegion.has(c.fromId)) byRegion.set(c.fromId, new Set());
        byRegion.get(c.fromId)!.add(sig);
      }
    }
    const varied = [...byRegion.values()].filter((s) => s.size > 1).length;
    expect(varied, "所有地界在各世里的事件标签都固定了 —— 内容接管退化成静态表").toBeGreaterThan(0);
  });

  it("③ 反差：标签数量仍由节奏曲线决定", () => {
    /*
     * 「保一个原生标签」不该改变段与段之间的标签数差异 —— 那是节奏原型在管。
     */
    const counts = new Set<number>();
    for (const seed of SEEDS) {
      for (const c of generateMortalWorld(seed).chain) counts.add(c.eventTags.length);
    }
    expect(counts.size, "各段的标签数全一样了 —— 节奏曲线没生效").toBeGreaterThan(1);
  });
});
