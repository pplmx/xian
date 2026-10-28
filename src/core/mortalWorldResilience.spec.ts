/**
 * 本世之界也是存档的一部分。
 *
 * 生成成功时它是一棵完整的路线树;被手改、旧版本迁移或写入中断截断后,
 * `sanitize()` 若只检查「是个对象」,空链、坏层级或重复节点就会一路带到
 * 世界页与路线准入里。玩家看到的不是一句坏数据,而是整页白屏。
 *
 * 这里守两条:
 *   一 完整世界经过 JSON 往返后原样保留,路线进度不被误清;
 *   二 任一结构不完整的旧世界整体作废,下一世重新生成,而不是半信半疑地使用。
 */
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { useAdventureStore } from "@/stores/adventure";
import { generateMortalWorld, type MortalWorld } from "./mortalWorldGen";
import { worldView } from "./mortalWorldService";

function persisted(w: MortalWorld): MortalWorld {
  return JSON.parse(JSON.stringify(w)) as MortalWorld;
}

beforeEach(() => {
  setActivePinia(createPinia());
});

describe("本世之界 · 读档修形", () => {
  it("完整世界经存档往返后保持原样,本世路线进度也不丢", () => {
    const adventure = useAdventureStore();
    const w = generateMortalWorld(20261029);
    adventure.$patch({
      mortalWorld: persisted(w),
      mortalCleared: [w.chain[1]!.nodeId],
    });

    adventure.sanitize();

    expect(adventure.mortalWorld).toEqual(w);
    expect(adventure.mortalCleared).toEqual([w.chain[1]!.nodeId]);
    expect(() =>
      worldView(
        adventure.mortalWorld!,
        (id) => id,
        (nodeId) => adventure.mortalCleared.includes(nodeId),
      ),
    ).not.toThrow();
  });

  const BROKEN: { name: string; damage: (w: MortalWorld) => void }[] = [
    {
      name: "路线不是数组",
      damage: (w) => void ((w as unknown as { chain: unknown }).chain = "nope"),
    },
    {
      name: "路线为空",
      damage: (w) => void (w.chain = []),
    },
    {
      name: "节点是 null",
      damage: (w) => void ((w.chain as unknown[])[0] = null),
    },
    {
      name: "节点 id 重复",
      damage: (w) => void (w.chain[1]!.nodeId = w.chain[0]!.nodeId),
    },
    {
      name: "地界不存在",
      damage: (w) => void (w.chain[0]!.fromId = "no_such_region"),
    },
    {
      name: "层级坏成 NaN",
      damage: (w) => void (w.chain[0]!.tier = Number.NaN),
    },
    {
      name: "敌群不是数组",
      damage: (w) => void ((w.chain[0] as unknown as { enemies: unknown }).enemies = "nope"),
    },
    {
      name: "敌群含未登记敌人",
      damage: (w) => void w.chain[0]!.enemies.push("no_such_enemy"),
    },
    {
      name: "首领不存在",
      damage: (w) => void (w.chain[0]!.boss = "no_such_boss"),
    },
    {
      name: "事件标签含未登记项",
      damage: (w) => void w.chain[0]!.eventTags.push("no_such_tag"),
    },
    {
      name: "资源偏向不是本世池里的值",
      damage: (w) => void (w.bias = "无中生有"),
    },
    {
      name: "路线骨架不存在",
      damage: (w) => void (w.shapeId = "no_such_shape"),
    },
    {
      name: "世界规则不存在",
      damage: (w) => void (w.ruleId = "no_such_rule"),
    },
  ];

  for (const { name, damage } of BROKEN) {
    it(`${name}:整界作废,不把坏路线留给下一次渲染`, () => {
      const adventure = useAdventureStore();
      const w = persisted(generateMortalWorld(20261029));
      const staleNode = w.chain[0]!.nodeId;
      damage(w);
      adventure.$patch({ mortalWorld: w, mortalCleared: [staleNode] });

      expect(() => adventure.sanitize()).not.toThrow();

      expect(adventure.mortalWorld, "坏世界必须回落到「暂无世界」").toBeNull();
      expect(adventure.mortalCleared, "旧世界的节点进度不能挂到下一世").toEqual([]);
    });
  }
});
