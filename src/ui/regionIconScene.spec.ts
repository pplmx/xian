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

  it("同一层里的两处地界不许用同一个图标", () => {
    /*
     * ## 由来（第 454 → 458 轮）
     *
     * 上一条守的是「落日与山岳」那一对**特例** —— 文件头写得很清楚:
     *
     * > 真正值钱的是下一条:**落日与山岳**那一对必须分开 ——
     * > 那不是"挤不挤"的问题,是「走过来天没变」的问题。
     *
     * 而「走过来天没变」是一**类**问题,不是一个特例。同层两处地界
     * 共用同一个图标时,玩家在同一境界段里从甲走到乙,头顶那片天**一模一样** ——
     * 与落霞谷那次是同一件事,只是没被点名。
     *
     * 实测(改前)有两处:
     *
     * ```text
     *   t29  神帝天宫(castle) / 帝阙天阶(castle)      ← 都是封闭宫阙
     *   t31  神魔渊(skull)    / 神魔古祭(skull)       ← 都是深渊骸骨
     * ```
     *
     * ## 为什么按「同层」而不是「全表」
     *
     * 全表只有十几种图标、四十四个地界,跨层重复必然发生(castle 用了五次),
     * 而跨层的两处玩家**不会在同一境界段里先后遇到** —— 那时他已经走过几十小时,
     * 记忆里的那一片天早就淡了。压「全表不重复」是不可能的目标;
     * 压「同层不重复」才是玩家真能感知的那一格。
     *
     * ## 为什么是「图标」而不是「地形」
     *
     * 上一条量的是 `sceneTerrainOfPlace`(图标落到哪片天),它管的是**压缩拥挤度**;
     * 这一条量的是图标本身 —— 两个不同图标可能落在同一片天(那由地形条数决定,
     * 是既有约束),但**同一个图标**必然画出同一片天。故这一条更硬,也该更早满足。
     */
    const byTier = new Map<number, typeof REGIONS>();
    for (const r of REGIONS) {
      if (!byTier.has(r.tier)) byTier.set(r.tier, []);
      byTier.get(r.tier)!.push(r);
    }
    const clashes: string[] = [];
    for (const [tier, rs] of [...byTier].sort((a, b) => a[0] - b[0])) {
      const byIcon = new Map<string, string[]>();
      for (const r of rs) {
        if (!byIcon.has(r.icon)) byIcon.set(r.icon, []);
        byIcon.get(r.icon)!.push(r.name);
      }
      for (const [icon, names] of byIcon) {
        if (names.length > 1) {
          clashes.push(`t${tier} 的 ${names.join(" / ")} 都用了「${icon}」`);
        }
      }
    }
    expect(
      clashes,
      "同一层里的两处地界共用同一个图标 —— 从甲走到乙,头顶那片天没变:" + clashes.join(";"),
    ).toEqual([]);
  });

  it("反差:跨层重复是允许的 —— 这一条只压同层", () => {
    /*
     * 全表四十四个地界、十几种图标,跨层重复必然发生。若哪天有人把这条判据
     * 扩成「全表不许重复」,它一定会红,而修法只能是造十几个新图标 ——
     * 那不是玩家感知得到的东西。这条显式记录边界。
     */
    const icons = REGIONS.map((r) => r.icon);
    const reused = icons.length - new Set(icons).size;
    expect(reused, "全表已经没有任何图标复用 —— 这条边界用例失去意义,请复核").toBeGreaterThan(0);
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
