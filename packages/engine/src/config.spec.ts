import { describe, expect, it } from "vite-plus/test";
import type { GameConfig } from "./config.js";
import { emptyProgress, type DungeonConfig } from "./dungeons.js";
import type { EquipmentConfig } from "./equipment.js";
import { defineGame, validateGame } from "./config.js";
import { createRng } from "./rng.js";

/**
 * 用例要**逐字段拧**这两层(改一个槽位、塞一个环),所以这里把类型写实:
 * `GameConfig` 允许 `equipment: null`(那表示这款游戏没有这一层),而这份夹具两层都有。
 */
type SolidGameConfig = GameConfig & {
  equipment: EquipmentConfig<number>;
  dungeons: DungeonConfig<number>;
};

function baseConfig(): SolidGameConfig {
  return {
    name: "测试世界",
    attributes: {
      defs: [
        { key: "attack", name: "攻击", kind: "flat" },
        { key: "defense", name: "防御", kind: "flat" },
        { key: "maxHp", name: "生命上限", kind: "flat" },
        { key: "attackPct", name: "攻击加成", kind: "percent", appliesTo: "attack" },
      ],
    },
    realms: {
      worlds: [{ id: "a", name: "世界", realms: ["一境", "二境"] }],
      exp: { base: 10, realmGrowth: 2, layerGrowth: 1.5 },
      combat: { base: { attack: 10, defense: 5, maxHp: 100 }, realmGrowth: 2, layerGrowth: 1.2 },
      breakthrough: {
        layerBase: 0.9,
        layerDecay: 0.05,
        majorBase: 0.6,
        majorDecay: 0.05,
        min: 0.1,
        max: 1,
      },
      lifespan: { base: 100, growth: 2, worldStepMult: 3 },
    },
    equipment: {
      slots: [{ id: "weapon", name: "武器" }],
      qualities: [{ id: "common", name: "凡品", rank: 0, mult: 1, affixes: [0, 1], weight: 1 }],
      templates: [{ id: "w1", name: "木棍", slot: "weapon", tier: 1, base: { attack: 5 } }],
      affixes: [{ id: "a1", name: "锋锐", key: "attackPct", min: 1, max: 3, weight: 1 }],
      power: { tierGrowth: 2 },
    },
    dungeons: {
      regions: [{ id: "r1", name: "一图", tier: 1, minRealm: 0, enemies: ["e1"], boss: "b1" }],
      enemies: [
        { id: "e1", name: "小怪", tier: 1, hpMult: 1, atkMult: 1, defMult: 1, speed: 1 },
        {
          id: "b1",
          name: "首领",
          tier: 1,
          hpMult: 3,
          atkMult: 1.2,
          defMult: 1,
          speed: 1,
          boss: true,
        },
      ],
    },
  };
}

describe("世界装配 —— 交叉校验", () => {
  it("干净配置没有 error", () => {
    const issues = validateGame(baseConfig());
    expect(issues.filter((i) => i.level === "error")).toEqual([]);
  });

  it("装备模板指向未定义的槽位 → 报错", () => {
    const cfg = baseConfig();
    cfg.equipment.templates[0]!.slot = "ghost";
    expect(validateGame(cfg).some((i) => i.code === "EQUIP_TEMPLATE_SLOT")).toBe(true);
    expect(() => defineGame(cfg)).toThrow(/EQUIP_TEMPLATE_SLOT/);
  });

  it("词条挂在未登记的属性键上 → 报错", () => {
    const cfg = baseConfig();
    cfg.equipment.affixes[0]!.key = "不存在";
    expect(validateGame(cfg).some((i) => i.code === "EQUIP_AFFIX_KEY")).toBe(true);
  });

  it("区域引用了不存在的敌人/首领 → 报错", () => {
    const cfg = baseConfig();
    cfg.dungeons.regions[0]!.enemies = ["nobody"];
    cfg.dungeons.regions[0]!.boss = "nobody2";
    const codes = validateGame(cfg).map((i) => i.code);
    expect(codes).toContain("DUNGEON_REGION_ENEMY");
    expect(codes).toContain("DUNGEON_REGION_BOSS");
  });

  it("区域链条成环 → 报错", () => {
    const cfg = baseConfig();
    cfg.dungeons.regions.push({
      id: "r2",
      name: "二图",
      tier: 1,
      minRealm: 0,
      enemies: ["e1"],
      boss: "b1",
      requireCleared: "r3",
    });
    cfg.dungeons.regions.push({
      id: "r3",
      name: "三图",
      tier: 1,
      minRealm: 0,
      enemies: ["e1"],
      boss: "b1",
      requireCleared: "r2",
    });
    expect(validateGame(cfg).some((i) => i.code === "DUNGEON_REGION_CYCLE")).toBe(true);
  });

  it("多条前置:逐条校验存在性,成环也照样查得出来", () => {
    const cfg = baseConfig();
    cfg.dungeons.regions.push({
      id: "r2",
      name: "二图",
      tier: 1,
      minRealm: 0,
      enemies: ["e1"],
      boss: "b1",
    });
    cfg.dungeons.regions.push({
      id: "r3",
      name: "三图",
      tier: 1,
      minRealm: 0,
      enemies: ["e1"],
      boss: "b1",
      requireCleared: ["r1", "nobody"],
    });
    const codes = validateGame(cfg).map((i) => i.code);
    expect(codes).toContain("DUNGEON_REGION_CHAIN");

    const cyc = baseConfig();
    cyc.dungeons.regions.push({
      id: "r2",
      name: "二图",
      tier: 1,
      minRealm: 0,
      enemies: ["e1"],
      boss: "b1",
      requireCleared: ["r3"],
    });
    cyc.dungeons.regions.push({
      id: "r3",
      name: "三图",
      tier: 1,
      minRealm: 0,
      enemies: ["e1"],
      boss: "b1",
      requireCleared: ["r2"],
    });
    expect(validateGame(cyc).some((i) => i.code === "DUNGEON_REGION_CYCLE")).toBe(true);
  });

  it("逐境层数可不同:某一境自己给了 layers 就用它,其余仍用全局那套", () => {
    const cfg = baseConfig();
    cfg.realms.worlds = [
      { id: "a", name: "世界", realms: [{ name: "一境", layers: ["上", "下"] }, "二境"] },
    ];
    const game = defineGame(cfg);
    expect(game.realms.layersOf(0)).toEqual(["上", "下"]);
    // 没写 layers 的仍用全局那套
    expect(game.realms.layersOf(1)).toEqual(game.realms.layerNames);
    expect(game.realms.maxLayerOf(0)).toBe(1);
    expect(game.realms.maxLayerOf(1)).toBe(game.realms.layerNames.length - 1);
  });

  it("区域推荐等级超出境界范围 → 报错", () => {
    const cfg = baseConfig();
    cfg.dungeons.regions[0]!.minRealm = 99;
    expect(validateGame(cfg).some((i) => i.code === "DUNGEON_REGION_REALM")).toBe(true);
  });

  it("本层某部位没有内容 → 警告;strict 时挡住装配", () => {
    const cfg = baseConfig();
    cfg.equipment.slots.push({ id: "armor", name: "护甲" });
    const issues = validateGame(cfg);
    expect(issues.some((i) => i.code === "EQUIP_SLOT_EMPTY")).toBe(true);
    expect(() => defineGame(cfg)).not.toThrow();
    expect(() => defineGame(cfg, { strict: true })).toThrow(/EQUIP_SLOT_EMPTY/);
  });

  it("首领没标 boss:true → 警告", () => {
    const cfg = baseConfig();
    cfg.dungeons.enemies.find((e) => e.id === "b1")!.boss = false;
    expect(validateGame(cfg).some((i) => i.code === "DUNGEON_BOSS_FLAG")).toBe(true);
  });

  it("装配后四套系统都能直接用", () => {
    const game = defineGame(baseConfig());
    expect(game.realms.label(0, 0)).toBe("一境·一层");
    expect(game.attributes.name("attack")).toBe("攻击");
    expect(game.equipment.slots.length).toBe(1);
    expect(game.dungeons.firstRegion().id).toBe("r1");
  });
});

/**
 * 门面可以只装一半 —— 「这款游戏没有装备 / 没有副本」也是一句话。
 *
 * 为什么值得单独立判据:库要能被拿去搭完全不同的题材(读书打卡、经营、日常),
 * 而"没有战斗、没有装备"的那些作品不该被迫编两张空表、更不该拿到一句
 * `Cannot read properties of undefined`。这里钉三件事:
 *   ① 没有的那一层写 `null` —— 装得起来,门面里那一层是**有意义的空**(0 槽 0 件 / 0 区域);
 *   ② 真去用空的那一层 —— **当场说明白**(而不是给回一个 undefined);
 *   ③ **省略**不是"没有":省了一节就是配置写错了,装配时给一句人话。
 */
describe("门面可以只装一半", () => {
  const halfAssembled = (): GameConfig => ({ ...baseConfig(), equipment: null, dungeons: null });

  it("只写等级与属性,照样装出一个世界;没有的那两层是空系统", () => {
    const game = defineGame(halfAssembled());
    expect(game.realms.realms.length).toBe(2);
    expect(game.attributes.name("attack")).toBe("攻击");
    // 空系统:读数是有意义的空,不是 undefined
    expect(game.equipment.slots).toEqual([]);
    expect(game.equipment.qualities).toEqual([]);
    expect(game.equipment.poolAtTier(1)).toEqual([]);
    expect(game.dungeons.regions).toEqual([]);
    expect(game.dungeons.unlocked(emptyProgress(), 0)).toEqual([]);
    // "这层到底有没有"看配置里那句话就够了
    expect(game.config.equipment).toBeNull();
    expect(game.config.dungeons).toBeNull();
  });

  it("真去用空的那一层:当场说明白,而不是回一个 undefined", () => {
    const game = defineGame(halfAssembled());
    const rng = createRng(7);
    expect(() => game.equipment.generate(rng, { tier: 1 })).toThrow(
      "装备系统:没有任何可掉落的槽位",
    );
    expect(() => game.equipment.quality("common")).toThrow("装备系统:品质表是空的,没有可用的品质");
    expect(() => game.equipment.rollQuality(1, rng)).toThrow(
      "装备系统:品质表是空的,没有可用的品质",
    );
    expect(() => game.dungeons.firstRegion()).toThrow("副本系统:区域表是空的,没有第一处区域");
    // 空链是读得懂的空答案:没有副本这一层时,"这一条链"就是空的
    expect(game.dungeons.chain()).toEqual([]);
  });

  it("省了一节 ≠ 没有这一层:装配时给一句人话,不是 Cannot read properties of undefined", () => {
    const missing = { ...baseConfig() } as Record<string, unknown>;
    delete missing.equipment;
    const issues = validateGame(missing as unknown as GameConfig);
    expect(issues.map((i) => i.code)).toContain("CONFIG_SECTION_MISSING");
    expect(issues.some((i) => i.message.includes("配置里缺了 equipment 这一节"))).toBe(true);
    expect(() => defineGame(missing as unknown as GameConfig)).toThrow(
      /配置里缺了 equipment 这一节/,
    );
  });

  it("形状写坏了(少了 affixes / power):一样是装配报错,不是崩掉", () => {
    const broken = {
      ...baseConfig(),
      equipment: { slots: [], qualities: [], templates: [] },
    } as unknown as GameConfig;
    const codes = validateGame(broken).map((i) => i.code);
    expect(codes.filter((code) => code === "CONFIG_FIELD_SHAPE").length).toBe(2);
    expect(() => defineGame(broken)).toThrow(/CONFIG_FIELD_SHAPE/);
  });
});

describe("配置校验 · id 重复要逐节都抓得到", () => {
  /*
   * `validateGame` 里同一套「查重 → 报错」写了七遍(槽位 / 品质 / 模板 / 词条 /
   * 套装 / 敌人 / 区域),每遍都把 `duplicates(...)` 调两次(判空一次、拼消息一次)。
   * 收敛成一个辅助函数之前,先把**七处都得报**钉住 —— 否则收敛时漏掉一节,
   * 那节的重复 id 从此没人管,而配置作者拿到的是「装配后行为诡异」而不是一条报错。
   */
  const cases: {
    name: string;
    code: string;
    mutate: (c: ReturnType<typeof baseConfig>) => void;
  }[] = [
    {
      name: "槽位",
      code: "EQUIP_SLOT_DUPLICATE",
      mutate: (c) => c.equipment.slots.push({ ...c.equipment.slots[0]! }),
    },
    {
      name: "品质",
      code: "EQUIP_QUALITY_DUPLICATE",
      mutate: (c) => c.equipment.qualities.push({ ...c.equipment.qualities[0]! }),
    },
    {
      name: "装备模板",
      code: "EQUIP_TEMPLATE_DUPLICATE",
      mutate: (c) => c.equipment.templates.push({ ...c.equipment.templates[0]! }),
    },
    {
      name: "词条",
      code: "EQUIP_AFFIX_DUPLICATE",
      mutate: (c) => c.equipment.affixes.push({ ...c.equipment.affixes[0]! }),
    },
    {
      name: "套装",
      code: "EQUIP_SET_DUPLICATE",
      mutate: (c) => {
        c.equipment.sets = [{ id: "s1", name: "套一", bonuses: [] } as never];
        c.equipment.sets.push({ ...c.equipment.sets[0]! });
      },
    },
    {
      name: "敌人",
      code: "DUNGEON_ENEMY_DUPLICATE",
      mutate: (c) => c.dungeons.enemies.push({ ...c.dungeons.enemies[0]! }),
    },
    {
      name: "区域",
      code: "DUNGEON_REGION_DUPLICATE",
      mutate: (c) => c.dungeons.regions.push({ ...c.dungeons.regions[0]! }),
    },
  ];

  for (const c of cases) {
    it(`${c.name} id 重复 → ${c.code}`, () => {
      const cfg = baseConfig();
      c.mutate(cfg);
      const issues = validateGame(cfg);
      expect(
        issues.some((i) => i.code === c.code),
        `没报出 ${c.code}`,
      ).toBe(true);
      // 报错里要带上重复的那个 id,否则配置作者不知道是哪个
      const hit = issues.find((i) => i.code === c.code)!;
      expect(hit.message).toContain("重复");
    });
  }
});

describe("配置校验 · 装备那一段的 17 个错误码都要报得出来", () => {
  /*
   * 这一段(231–316 行)即将整块抽成一个 `validateEquipment()`,抽取前后行为必须一致。
   * 现有判据只覆盖了其中一半(SLOT_EMPTY / TEMPLATE_SLOT / AFFIX_KEY / 七处 DUPLICATE),
   * 另外那些 `min > max` / 件数门槛 < 1 / 权重为 0 / 层级槽位留空 —— 一条都没有。
   * 抽完如果漏掉其中一条,配置作者拿到的是「装配后行为诡异」而不是一句报错。
   *
   * 这里逐码来一遍:每条只做最小改动,确认报出**指定的那个码**。
   */
  const cases: {
    code: string;
    level: "error" | "warning";
    mutate: (c: ReturnType<typeof baseConfig>) => void;
  }[] = [
    {
      code: "EQUIP_SET_EMPTY",
      level: "warning",
      mutate: (c) => (c.equipment.sets = [{ id: "s1", name: "套一", bonuses: [] }]),
    },
    {
      code: "EQUIP_SET_PIECES",
      level: "error",
      mutate: (c) =>
        (c.equipment.sets = [{ id: "s1", name: "套一", bonuses: [{ pieces: 0, mods: {} }] }]),
    },
    {
      code: "EQUIP_TEMPLATE_SET",
      level: "error",
      mutate: (c) => (c.equipment.templates[0]!.setId = "ghost"),
    },
    {
      code: "EQUIP_AFFIX_SLOT",
      level: "error",
      mutate: (c) => (c.equipment.affixes[0]!.slots = ["ghost"]),
    },
    {
      code: "EQUIP_AFFIX_RANGE",
      level: "error",
      mutate: (c) => {
        c.equipment.affixes[0]!.min = 5;
        c.equipment.affixes[0]!.max = 1;
      },
    },
    {
      code: "EQUIP_AFFIX_WEIGHT",
      level: "warning",
      mutate: (c) => (c.equipment.affixes[0]!.weight = 0),
    },
    {
      code: "EQUIP_QUALITY_AFFIX_RANGE",
      level: "error",
      mutate: (c) => (c.equipment.qualities[0]!.affixes = [2, 0]),
    },
    {
      code: "EQUIP_QUALITY_WEIGHT",
      level: "warning",
      mutate: (c) => (c.equipment.qualities[0]!.weight = 0),
    },
    {
      code: "EQUIP_TIER_SLOT_GAP",
      level: "warning",
      mutate: (c) => c.equipment.slots.push({ id: "armor", name: "护甲" }),
    },
  ];

  for (const c of cases) {
    it(`${c.code} 报得出来(${c.level})`, () => {
      const cfg = baseConfig();
      c.mutate(cfg);
      const hit = validateGame(cfg).find((i) => i.code === c.code);
      expect(hit, `没报出 ${c.code}`).toBeTruthy();
      expect(hit!.level, `${c.code} 的级别不对`).toBe(c.level);
    });
  }
});

describe("配置校验 · 副本那一段的 13 个错误码都要报得出来", () => {
  /*
   * 这一段(332–411 行)即将整块抽成 `validateDungeons()`,抽取前后行为必须一致。
   * 现有判据覆盖了其中 8 个,另外 5 个一条都没有:ENEMY_HP、ENEMY_TIER、
   * REGION_MODE、REGION_NO_ENEMY、REGION_TIER —— 抽完漏掉哪一条,配置作者
   * 拿到的都是「进副本后行为诡异」而不是一句报错。
   */
  const cases: {
    code: string;
    level: "error" | "warning";
    mutate: (c: ReturnType<typeof baseConfig>) => void;
  }[] = [
    {
      code: "DUNGEON_REGION_NO_ENEMY",
      level: "warning",
      mutate: (c) => (c.dungeons.regions[0]!.enemies = []),
    },
    {
      code: "DUNGEON_REGION_MODE",
      level: "warning",
      mutate: (c) => {
        c.dungeons.regions[0]!.requireMode = "any";
        c.dungeons.regions[0]!.requireCleared = ["r1"];
      },
    },
    {
      code: "DUNGEON_REGION_TIER",
      level: "error",
      mutate: (c) => (c.dungeons.regions[0]!.tier = 0),
    },
    {
      code: "DUNGEON_ENEMY_TIER",
      level: "error",
      mutate: (c) => (c.dungeons.enemies[0]!.tier = 0),
    },
    {
      code: "DUNGEON_ENEMY_HP",
      level: "warning",
      mutate: (c) => (c.dungeons.enemies[0]!.hpMult = 0),
    },
  ];

  for (const c of cases) {
    it(`${c.code} 报得出来(${c.level})`, () => {
      const cfg = baseConfig();
      c.mutate(cfg);
      const hit = validateGame(cfg).find((i) => i.code === c.code);
      expect(hit, `没报出 ${c.code}`).toBeTruthy();
      expect(hit!.level, `${c.code} 的级别不对`).toBe(c.level);
    });
  }
});
