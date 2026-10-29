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
import { ENEMIES } from "@/data/enemies";
import { MORTAL_REGIONS, MORTAL_TIER_MAX, REGIONS } from "@/data/regions";
import {
  REGION_NAME_TIER_BAND,
  ROUTE_SHAPES,
  generateMortalWorld,
  type MortalWorld,
} from "./mortalWorldGen";
import { MORTAL_WORLD_HISTORY_LIMIT } from "./mortalWorldShape";
import {
  canEnterNode,
  mortalGenerationHistory,
  worldHistoryRows,
  worldView,
} from "./mortalWorldService";

function persisted(w: MortalWorld): MortalWorld {
  return JSON.parse(JSON.stringify(w)) as MortalWorld;
}

beforeEach(() => {
  setActivePinia(createPinia());
});

const HIGH_MOB = ENEMIES.find((e) => e.tier > MORTAL_TIER_MAX && e.archetype === undefined)!;
const HIGH_BOSS = ENEMIES.find((e) => e.tier > MORTAL_TIER_MAX && e.archetype !== undefined)!;

describe("本世之界 · 读档修形", () => {
  it("完整世界经存档往返后保持原样,本世路线进度也不丢", () => {
    const adventure = useAdventureStore();
    const w = generateMortalWorld(20261029);
    const cleared = w.chain.slice(0, 2).map((p) => p.nodeId);
    adventure.$patch({
      mortalWorld: persisted(w),
      mortalCleared: cleared,
    });

    adventure.sanitize();

    expect(adventure.mortalWorld).toEqual(w);
    expect(adventure.mortalCleared).toEqual(cleared);
    expect(() =>
      worldView(
        adventure.mortalWorld!,
        (id) => id,
        (nodeId) => adventure.mortalCleared.includes(nodeId),
      ),
    ).not.toThrow();
  });

  it("路线进度只留当前世界从首段起的连续前缀,乱序、重复和旧节点都截掉", () => {
    const adventure = useAdventureStore();
    const w = generateMortalWorld(20261029);
    const [first, second, , fourth] = w.chain;
    adventure.$patch({
      mortalWorld: persisted(w),
      mortalCleared: [
        fourth!.nodeId,
        "old_world_node",
        first!.nodeId,
        first!.nodeId,
        second!.nodeId,
      ],
    });

    adventure.sanitize();

    expect(adventure.mortalCleared).toEqual([first!.nodeId, second!.nodeId]);
  });

  it("断档进度不能越过前置节点授权后一段", () => {
    const adventure = useAdventureStore();
    const w = generateMortalWorld(20261029);
    const [first, , third, fourth] = w.chain;
    adventure.$patch({
      mortalWorld: persisted(w),
      mortalCleared: [first!.nodeId, third!.nodeId],
    });

    adventure.sanitize();

    expect(adventure.mortalCleared).toEqual([first!.nodeId]);
    expect(canEnterNode(third!.nodeId), "第三段的前置第二段未通,不能开放").toBe(false);
    expect(canEnterNode(fourth!.nodeId), "第四段更不能被断档进度带开").toBe(false);
  });

  it("完整世界保留胜场,路线外仍可凭旧链历练的地界也不丢", () => {
    const adventure = useAdventureStore();
    const w = generateMortalWorld(20261029);
    const outside = REGIONS.find((r) => !w.chain.some((p) => p.fromId === r.id))!;
    const wins = { [w.chain[0]!.fromId]: 8, [outside.id]: 3 };
    adventure.$patch({ mortalWorld: persisted(w), regionWins: wins });

    adventure.sanitize();

    expect(adventure.regionWins).toEqual(wins);
  });

  it("本来就没有世界栏的旧档,胜场不被误当成坏界清空", () => {
    const adventure = useAdventureStore();
    adventure.$patch({ mortalWorld: null, regionWins: { qingyun: 7 } });

    adventure.sanitize();

    expect(adventure.regionWins).toEqual({ qingyun: 7 });
  });

  it("历史世界逐棵修形:坏树剔除、当前世界去重,只留最近四世", () => {
    const adventure = useAdventureStore();
    const older = [1, 2, 3, 4, 5, 6].map((seed) => persisted(generateMortalWorld(30_000 + seed)));
    const current = persisted(generateMortalWorld(40_000));
    adventure.$patch({
      mortalWorld: current,
      mortalWorldHistory: [...older, current, { broken: true }, older.at(-1)!],
    } as never);

    adventure.sanitize();

    expect(adventure.mortalWorldHistory.map((w) => w.seed)).toEqual(
      older.slice(-MORTAL_WORLD_HISTORY_LIMIT).map((w) => w.seed),
    );
  });

  it("换界把上一世记进历史,刷新修形后仍在且不含当前世界", () => {
    const adventure = useAdventureStore();
    const first = generateMortalWorld(51_001);
    const second = generateMortalWorld(52_002);

    adventure.setMortalWorld(first);
    adventure.setMortalWorld(second);
    expect(adventure.mortalWorldHistory.map((w) => w.seed)).toEqual([first.seed]);

    adventure.sanitize();

    expect(adventure.mortalWorld?.seed).toBe(second.seed);
    expect(adventure.mortalWorldHistory.map((w) => w.seed)).toEqual([first.seed]);
  });

  it("生成门历史按种子去重、当前世界置后,并限制为四旧一现", () => {
    const pool = [1, 2, 3, 4, 5, 6].map((seed) => generateMortalWorld(60_000 + seed));
    const current = pool[2]!;

    const history = mortalGenerationHistory(pool, current);

    expect(history.map((w) => w.seed)).toEqual([
      pool[1]!.seed,
      pool[3]!.seed,
      pool[4]!.seed,
      pool[5]!.seed,
      current.seed,
    ]);
  });

  it("前尘山河按最近一世在前,字段仍走 worldView 的同一套翻译", () => {
    const older = generateMortalWorld(61_001);
    const newer = generateMortalWorld(62_002);
    const rows = worldHistoryRows([older, newer], (id) => id);
    const expected = worldView(newer, (id) => id);

    expect(rows.map((row) => row.seed)).toEqual([newer.seed, older.seed]);
    expect(rows[0]).toMatchObject({
      title: expected.title,
      summary: expected.summary,
      stages: expected.stages,
      tierText: expected.tierText,
      ruleText: expected.ruleText,
      biasText: expected.biasText,
    });
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
      name: "路线被截断",
      damage: (w) => void w.chain.pop(),
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
      name: "首段层级偏离骨架",
      damage: (w) => {
        const shape = ROUTE_SHAPES.find((x) => x.id === w.shapeId)!;
        w.chain[0]!.tier = shape.tiers[0] === 1 ? 2 : 1;
      },
    },
    {
      name: "后续段层级偏离骨架超过一格",
      damage: (w) => {
        const shape = ROUTE_SHAPES.find((x) => x.id === w.shapeId)!;
        w.chain[1]!.tier = shape.tiers[1]! + 2;
      },
    },
    {
      name: "地界与落座层级错位",
      damage: (w) => {
        const place = w.chain[0]!;
        const far = MORTAL_REGIONS.find(
          (r) =>
            !w.chain.some((p) => p.fromId === r.id) &&
            Math.abs(r.tier - place.tier) > REGION_NAME_TIER_BAND,
        )!;
        place.fromId = far.id;
      },
    },
    {
      name: "敌群不是数组",
      damage: (w) => void ((w.chain[0] as unknown as { enemies: unknown }).enemies = "nope"),
    },
    {
      name: "敌群混入界外妖物",
      damage: (w) => void w.chain[0]!.enemies.push(HIGH_MOB.id),
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
      name: "首领混入界外大能",
      damage: (w) => void (w.chain[0]!.boss = HIGH_BOSS.id),
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
      adventure.$patch({
        mortalWorld: w,
        mortalCleared: [staleNode],
        regionWins: { qingyun: 7, old_world_region: 3 },
      });

      expect(() => adventure.sanitize()).not.toThrow();

      expect(adventure.mortalWorld, "坏世界必须回落到「暂无世界」").toBeNull();
      expect(adventure.mortalCleared, "旧世界的节点进度不能挂到下一世").toEqual([]);
      expect(adventure.regionWins, "旧世界的叩门进度也必须跟世界一起作废").toEqual({});
    });
  }

  it("首领复用段从路线重建,坏掉的回退账不会把整界拖死", () => {
    const adventure = useAdventureStore();
    const w = persisted(generateMortalWorld(20261029));
    w.chain[1]!.boss = w.chain[0]!.boss;
    w.chain[1]!.archetype = w.chain[0]!.archetype;
    (w as unknown as { bossFallbackAt: unknown }).bossFallbackAt = [0, 0, 99];
    adventure.$patch({ mortalWorld: w });

    adventure.sanitize();

    expect(adventure.mortalWorld?.bossFallbackAt).toEqual([1]);
  });
});
