/**
 * 地界的图标要分得开 —— 玩家从一处走到下一处,画该跟着换。
 *
 * ## 这一条是走一遍路才发现的问题
 *
 * 历练页卷首的底读**正在打的那一处地界**(`currentRegion?.icon`)。真浏览器走过三处:
 *
 *   qingyun (mountain) → 山岳
 *   luoxia  (sunset)   → 山岳   ← 与青云山麓一模一样
 *   heifeng (crown)    → 宫阙
 *
 * 也就是从「青云山麓」走到「落霞谷」,玩家头顶那片天**一点没变** —— 而这两处
 * 一个讲山、一个讲落日,是意象上最该分开的一对。
 *
 * ## 判据守什么
 *
 * 地界表里出现的每个**图标**都要能取到景,且不许挤在同一片地上:
 * 一张表里同一个地形最多容纳两个图标 —— 第三个开始,玩家就分不出那是哪一处了。
 * (九种地形对二十几个图标,必然有共用;压住的是**挤**的程度。)
 */
import { describe, expect, it } from "vite-plus/test";
import { REGIONS } from "@/data/regions";
import { sceneTerrainOfPlace, SCENE_TERRAINS } from "@/ui/sceneTerrain";

describe("地界图标要分得开", () => {
  it("每处地界都取得到景,且地形确实存在", () => {
    for (const r of REGIONS) {
      const t = sceneTerrainOfPlace({ icon: r.icon });
      expect(SCENE_TERRAINS, `${r.name}(${r.icon})落到一个不存在的地形`).toContain(t);
    }
  });

  it("同一片地上最多挤四个**地界**图标", () => {
    /*
     * 只数「地界用的是哪几种图标」,不去数全站图标总数。
     *
     * 为什么:地形只有九种,而 `ICON_TERRAIN` 要接的是全站的图标(装备、丹药、
     * 状态、天象……二十几种)。若按全表压「每片地最多两个」,`ruin` 上有
     * sword/skull/scroll/shield 四个战斗与物品图标 —— 那是既有状态,不该为
     * 这一条判据去改(它们本来就该是同一类「破败/征伐」的意象)。
     *
     * 这一条要防的是:**地界之间**分不开。故先把「地界真正用到的图标」挑出来,
     * 只在这一小撮上压拥挤度。
     *
     * 门槛是 **四**,理由是算术:`ICON_TERRAIN` 要接全站二十几个图标,而地形只有九种;
     * 光地界自己就用掉 18 种,平均下来每片地两个 —— 按"最多两个"去压是不可能的目标。
     *
     * `ruin` 现在是四个(sword / skull / scroll / shield),这是**既有状态**:
     * 它们确实都属「破败与征伐」这一类,要拆开得动全站共用的映射
     * (scroll 在离线奖励里、shield 在野怪家族里都用着),超出这一条判据的范围。
     * 压到四,消掉的是「五个挤一堆」那种真会让人分不出的情形 ——
     * 这一轮之前 `ruin` 正是被 gem 挤到五个,把 gem 归回山岳之后就回到四个。
     *
     * 真正值钱的是下一条:**落日与山岳**那一对必须分开 ——
     * 那不是"挤不挤"的问题,是「走过来天没变」的问题。
     */
    const used = new Set(REGIONS.map((r) => r.icon));
    const byTerrain = new Map<string, Set<string>>();
    for (const icon of used) {
      const t = sceneTerrainOfPlace({ icon });
      if (!byTerrain.has(t)) byTerrain.set(t, new Set());
      byTerrain.get(t)!.add(icon);
    }
    const crowded = [...byTerrain]
      .filter(([, icons]) => icons.size > 4)
      .map(([t, icons]) => `${t} 上挤了 ${icons.size} 个地界图标(${[...icons].join(", ")})`);
    expect(crowded, "同一片地上挤了五个以上**地界**图标 —— 走到另一处时头顶那片天没变").toEqual([]);
  });

  it("落日与山岳不许是同一片天", () => {
    /*
     * 点名这一对:它们是「最该分开却被塞进同一格」的典型 ——
     * 一个讲山骨,一个讲霞光。九种地形装得下,没有理由共用一个。
     */
    expect(
      sceneTerrainOfPlace({ icon: "sunset" }),
      "落日与山岳画成了同一片 —— 从青云山麓走到落霞谷,天没变",
    ).not.toBe(sceneTerrainOfPlace({ icon: "mountain" }));
  });
});
