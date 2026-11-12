/**
 * 四十四处地界不该挤在三片天上。
 *
 * ## 量出来的现状
 *
 * 全站 44 处地界,取景后是这样分的:
 *
 *   星野 12 处   遗迹 9 处   宫阙 8 处   江海 5 处
 *   火域 4 处    林麓 3 处   山岳 1     雪原 1     虚空 1
 *
 * **29 处(66%)挤在三种地形上。** 玩家从「青云山麓」一路走到「大罗天阙」,
 * 十几次换地界里,有三分之二的次数头顶那片天没换。
 *
 * 根因不是某几处映射写错,是**图标只有 18 个、地界有 44 处**:一个图标平均要扛
 * 2.4 处地界,而图标到地形又是一对一。逐处写覆盖能修好眼前这几处,
 * 但下一批地界加进来还是会挤回去。
 *
 * ## 判据怎么落
 *
 * 不要求"处处不同"(九种地形装不下 44 处),要求的是**别六成挤在三片上**:
 *   · 每片地上不超过 8 处地界;
 *   · 且**每一种地形都要有地界用上**(九种全用,不许有闲置的)。
 *
 * 这两条合起来,是把分布从"三片吃六成"推开。
 */
import { describe, expect, it } from "vite-plus/test";
import { REGIONS } from "@/data/regions";
import { SCENE_TERRAINS, sceneTerrainOfRegion } from "@/ui/sceneTerrain";

function distribution(): Map<string, string[]> {
  const by = new Map<string, string[]>();
  for (const r of REGIONS) {
    const t = sceneTerrainOfRegion({ regionId: r.id, icon: r.icon });
    if (!by.has(t)) by.set(t, []);
    by.get(t)!.push(r.id);
  }
  return by;
}

describe("四十四处地界不该挤在三片天上", () => {
  it("判据确实扫得到东西(防空转)", () => {
    const dist = distribution();
    expect(dist.size, "一处地界都没归到地形上").toBeGreaterThan(0);
    expect(REGIONS.length, "地界表空了,判据形同虚设").toBeGreaterThan(20);
  });

  it("每片地上不超过八处地界", () => {
    const crowded = [...distribution()]
      .filter(([, ids]) => ids.length > 8)
      .map(([t, ids]) => `${t} 上挤了 ${ids.length} 处地界(${ids.slice(0, 4).join(", ")}…)`);
    expect(crowded, "同一片地上挤了九处以上 —— 玩家走十几处地界,大半时候头顶那片天没变").toEqual(
      [],
    );
  });

  it("九种地形都要有地界用上 —— 不许有闲置的", () => {
    /*
     * 闲置的地形是**白画的一种**:九种地形是一份一份画出来的,
     * 若某一两种没有任何地界用上,那几笔就是纯成本。
     * 现状山岳 / 雪原 / 虚空各只有一处 —— 刚好在线上,但都在。
     */
    const used = new Set(distribution().keys());
    const idle = SCENE_TERRAINS.filter((t) => !used.has(t));
    expect(idle, "这些地形一个地界都没用上 —— 那几笔画了白画").toEqual([]);
  });
});
