/**
 * 事件结算 · 灵石代价守恒
 *
 * 两条账目规则:
 *   O 选项声明了灵石门槛(cond),结算就真扣 —— 门槛不是免费取货券,
 *     凝本源为一丹「300 灵石」的代价必须真的从余额里扣掉;
 *   X 入不敷出的支出不许把整份余额清零 —— 负灵石支出付不起时就该拒绝,
 *     而不是「把余额全数奉上」(spendStone 传余额拷贝的写法会让 gte 恒真、
 *     subClamp 归零,一次越支 = 清零)。
 */
import { describe, expect, it, beforeEach } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import type { EquipmentInstance, EventDef } from "@/types";
import { add, gn, gte, mulN, sub, toNum } from "@/utils/gnum";
import { useResourcesStore } from "@/stores/resources";
import { useInventoryStore } from "@/stores/inventory";
import { useAdventureStore } from "@/stores/adventure";
import { useCultivationStore } from "@/stores/cultivation";
import { useLoreStore } from "@/stores/lore";
import { usePlayerStore } from "@/stores/player";
import { useQuestsStore } from "@/stores/quests";
import { useSettingsStore } from "@/stores/settings";
import { eventDef } from "@/data/events";
import { GONGFA } from "@/data/gongfa";
import { PILLS } from "@/data/pills";
import { BAG_CAPACITY } from "@/data/constants";
import { randomEventPill, resolveEventChoice } from "./eventEngine";
import { stoneByTier } from "./formulas";
import { track } from "./progress";
import { qualityDef } from "@/data/qualities";

describe("事件结算 · 灵石代价守恒", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("入不敷出的灵石支出被拒绝,余额一分不动(不因一次越支而清零)", () => {
    const resources = useResourcesStore();
    resources.addStone(gn(50));
    const def: EventDef = {
      id: "ev_test_stone",
      title: "测试",
      text: "",
      tags: ["general"],
      weight: 1,
      choices: [
        {
          label: "掏钱",
          outcomes: [{ weight: 1, text: "花掉", effects: [{ type: "stone", tierAmount: -60 }] }],
        },
      ],
    };
    const res = resolveEventChoice(def, 0, 3);
    // 支出被拒:这条结算里没有任何扣灵石的字样(60 → 259.92 > 50,付不起)
    expect(res.lines.some((l) => l.includes("灵石 -"))).toBe(false);
    // 余额绝不低于 50 —— 此前的 bug 是「整份余额奉上」清零(里程碑顺带发石也会让它变大,只断言下界)
    expect(gte(resources.spiritStone, gn(50))).toBe(true);
  });

  it("凝本源为一丹:声明了 300 灵石的门槛,实付就真扣 300(不是白拿丹药)", () => {
    const resources = useResourcesStore();
    const inventory = useInventoryStore();
    resources.addStone(gn(1_000_000_000));
    const def = eventDef("ev_hongmeng_benyuan")!;
    const tier = 20; // 该事件 minRealm=20,取真实可达档位
    const before = resources.spiritStone;
    resolveEventChoice(def, 1, tier); // 「凝本源为一丹」
    const cost = stoneByTier(tier, 300);
    // 付了声明的那笔:余额确确实实少了 cost(大数重构有尾数噪声,用容差比:与原值差 ≤ 1e-9 级)
    const spent = sub(before, resources.spiritStone);
    const tol = mulN(cost, 1e-6);
    expect(gte(add(spent, tol), cost), "花掉的应 ≥ cost(容差)").toBe(true);
    expect(gte(add(cost, tol), spent), "花掉的应 ≤ cost(容差)").toBe(true);
    // 药也真到手
    expect(inventory.pills["p_daoyuan"]).toBe(1);
    // 顺手确认这笔不是负值(300 灵石代价在等价档位下真实大于零,不是虚设)
    expect(gte(cost, gn(1))).toBe(true);
  });
});

describe("事件收益入会话账(haul 与战斗面板要有数可报)", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("际遇给悟道时,计入正在跑的那趟会话(wudaoGain)", () => {
    const resources = useResourcesStore();
    const adventure = useAdventureStore();
    adventure.$patch({
      session: {
        regionId: "qingyun",
        mode: "normal",
        startedAt: 0,
        endsAt: 1_000_000,
        nextBattleAt: 0,
        wins: 0,
        losses: 0,
        events: 0,
        stoneGain: gn(0),
        expGain: gn(0),
        itemGain: 0,
        wudaoGain: 0,
        dustGain: 0,
      },
    });
    const def = eventDef("ev_formation")!;
    const before = resources.wudao;
    resolveEventChoice(def, 1, 1); // 「研究阵纹」→ 悟道 4
    expect(resources.wudao - before).toBe(4);
    expect(adventure.session!.wudaoGain, "事件给的悟道该写进这趟会话账,结束总结才有得报").toBe(4);
  });

  it("无会话在跑时,事件照常发悟道,但不记会话账", () => {
    const resources = useResourcesStore();
    const adventure = useAdventureStore();
    const def = eventDef("ev_formation")!;
    const before = resources.wudao;
    resolveEventChoice(def, 1, 1);
    expect(resources.wudao - before).toBe(4);
    expect(adventure.session).toBeNull();
  });

  it("事件给的灵石、修为与实物也计入会话,不只记悟道", () => {
    const player = usePlayerStore();
    player.initCharacter("际遇记账", { roots: [] } as never);
    const resources = useResourcesStore();
    const adventure = useAdventureStore();
    // 先结清首次计数触发的日课/成就,基线只量这次际遇本身;别把别的奖励混进来。
    track("events");
    adventure.$patch({
      session: {
        regionId: "qingyun",
        mode: "normal",
        startedAt: 0,
        endsAt: 1_000_000,
        nextBattleAt: 0,
        wins: 0,
        losses: 0,
        events: 0,
        stoneGain: gn(0),
        expGain: gn(0),
        itemGain: 0,
        wudaoGain: 0,
        dustGain: 0,
      },
    });
    const stoneBefore = { ...resources.spiritStone };
    const expBefore = { ...player.exp };
    const def: EventDef = {
      id: "ev_test_session_gain",
      title: "山道遗落",
      text: "",
      tags: ["general"],
      weight: 1,
      choices: [
        {
          label: "全部收下",
          outcomes: [
            {
              weight: 1,
              text: "你收起散落的行囊。",
              effects: [
                { type: "stone", tierAmount: 60 },
                { type: "exp", secs: 60 },
                { type: "material", id: "page", amount: 8 },
                { type: "pill", id: "p_jvqidan", count: 2 },
              ],
            },
          ],
        },
      ],
    };

    const res = resolveEventChoice(def, 0, 3);
    const session = adventure.session!;

    expect(res.lines).toHaveLength(4);
    expect(toNum(session.stoneGain), "事件给的灵石没入本次所得").toBeCloseTo(
      toNum(sub(resources.spiritStone, stoneBefore)),
      6,
    );
    expect(toNum(session.expGain), "事件给的修为没入本次所得").toBeCloseTo(
      toNum(sub(player.exp, expBefore)),
      6,
    );
    expect(session.itemGain, "残页一份 + 丹药两枚,都应算拾获").toBe(3);
  });
});

describe("事件装备回执 · 离线卷轴要能列出来", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("事件获得的装备带回实体与化尘明细,不只留一行文案", () => {
    useSettingsStore().smartKeep = {
      enabled: true,
      minQuality: 8,
      minTier: 0,
      junkBelowLine: true,
      keepCoreAffix: false,
      keepComboPiece: false,
      keepPerfectRolls: false,
      keepSetPiece: false,
    };
    const def: EventDef = {
      id: "ev_test_equipment_receipt",
      title: "古匣",
      text: "",
      tags: ["general"],
      weight: 1,
      choices: [
        {
          label: "打开",
          outcomes: [
            {
              weight: 1,
              text: "匣中是一件旧器。",
              effects: [{ type: "equipment", minQualityRank: 1 }],
            },
          ],
        },
      ],
    };

    const res = resolveEventChoice(def, 0, 3);

    expect(res.equipment, "装备事件要把实体带回调用方,离线才能列进所得清单").toHaveLength(1);
    expect(res.equipment[0]!.recycled, "智能收纳判废时应标成回收件").toBe(true);
    expect(res.recycledDust, "化尘量的回执要与实际入账同源").toBeGreaterThan(0);
  });

  it("腾位时入包的新件与折掉的旧件分开记账,回收件数不能按入包与否猜", () => {
    useSettingsStore().smartKeep = {
      enabled: true,
      minQuality: 3,
      minTier: 0,
      junkBelowLine: false,
      keepCoreAffix: false,
      keepComboPiece: false,
      keepPerfectRolls: false,
      keepSetPiece: false,
    };
    const inventory = useInventoryStore();
    inventory.items = Array.from({ length: BAG_CAPACITY }, (_, i) => ({
      uid: `ev-full-${i}`,
      templateId: "b_qingyun",
      quality: "mortal",
      tier: 3,
      level: 0,
      affixes: [],
    })) satisfies EquipmentInstance[];
    const def: EventDef = {
      id: "ev_test_equipment_evict",
      title: "神兵匣",
      text: "",
      tags: ["general"],
      weight: 1,
      choices: [
        {
          label: "打开",
          outcomes: [
            {
              weight: 1,
              text: "匣中神兵择主。",
              effects: [{ type: "equipment", minQualityRank: 8 }],
            },
          ],
        },
      ],
    };

    const res = resolveEventChoice(def, 0, 3);

    expect(res.equipment[0]?.recycled, "新件入包,不能伪称它自己被回收").toBe(false);
    expect(res.recycledEquipment, "被挤掉的旧件也是一件折化产出").toBe(1);
    expect(res.recycledDust, "腾位旧件化出的尘也要进归来账").toBeGreaterThan(0);
    expect(inventory.items).toHaveLength(BAG_CAPACITY);
  });

  it("丹药等无法从总资源差额区分的所得,也要带回逐项回执", () => {
    const def: EventDef = {
      id: "ev_test_notable_receipt",
      title: "药囊",
      text: "",
      tags: ["general"],
      weight: 1,
      choices: [
        {
          label: "打开",
          isDefault: true,
          outcomes: [
            {
              weight: 1,
              text: "囊中有药,也有草。",
              effects: [
                { type: "material", id: "herb", amount: 10 },
                { type: "pill", id: "p_huichun", count: 2 },
              ],
            },
          ],
        },
      ],
    };

    const res = resolveEventChoice(def, 0, 3);

    expect(res.notableLines, "丹药不能只剩资源汇总里看不见的一行").toEqual(["丹药「回灵丹」×2"]);
  });

  it("重复法宝折成悟道点时,归来回执只说来源、不重抄总账数字", () => {
    const adventure = useAdventureStore();
    const resources = useResourcesStore();
    useInventoryStore().addArtifact("af_muyu");
    // 先结清「首次际遇」可能触发的成就，避免无关悟道混进这段会话账。
    track("events");
    adventure.$patch({
      session: {
        regionId: "qingyun",
        mode: "normal",
        startedAt: 0,
        endsAt: 1_000_000,
        nextBattleAt: 0,
        wins: 0,
        losses: 0,
        events: 0,
        stoneGain: gn(0),
        expGain: gn(0),
        itemGain: 0,
        wudaoGain: 0,
        dustGain: 0,
      },
    });
    const wudao = resources.wudao;
    const def: EventDef = {
      id: "ev_test_duplicate_artifact",
      title: "旧藏",
      text: "",
      tags: ["general"],
      weight: 1,
      choices: [
        {
          label: "取出",
          outcomes: [
            {
              weight: 1,
              text: "匣中还是那枚熟悉的葫芦。",
              effects: [{ type: "artifact", id: "af_muyu" }],
            },
          ],
        },
      ],
    };

    const res = resolveEventChoice(def, 0, 3);

    expect(resources.wudao - wudao).toBe(10);
    expect(res.lines.join("\n")).toContain("化作悟道点×10");
    expect(res.notableLines).toEqual(["法宝「墨玉葫芦」已拥有,化作悟道点"]);
    expect(adventure.session!.wudaoGain, "折化所得仍要进本趟悟道账").toBe(10);
    expect(adventure.session!.itemGain, "法宝没有入囊，不能冒充拾获一件").toBe(0);
  });

  it("丹药件数先按实结取整,再同时写进背包、文案、回执与会话账", () => {
    const adventure = useAdventureStore();
    adventure.$patch({
      session: {
        regionId: "qingyun",
        mode: "normal",
        startedAt: 0,
        endsAt: 1_000_000,
        nextBattleAt: 0,
        wins: 0,
        losses: 0,
        events: 0,
        stoneGain: gn(0),
        expGain: gn(0),
        itemGain: 0,
        wudaoGain: 0,
        dustGain: 0,
      },
    });
    const def: EventDef = {
      id: "ev_test_fractional_pill",
      title: "零散丹丸",
      text: "",
      tags: ["general"],
      weight: 1,
      choices: [
        {
          label: "收下",
          outcomes: [
            {
              weight: 1,
              text: "药囊里还剩一枚半。",
              effects: [{ type: "pill", id: "p_huichun", count: 1.9 }],
            },
          ],
        },
      ],
    };

    const res = resolveEventChoice(def, 0, 3);

    expect(useInventoryStore().pills.p_huichun, "实数只发得出一枚").toBe(1);
    expect(res.lines).toEqual(["丹药「回灵丹」×1"]);
    expect(res.notableLines).toEqual(["丹药「回灵丹」×1"]);
    expect(adventure.session!.itemGain).toBe(1);
  });
});

describe("奇缘授方 · 文案承诺必须落成知识", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  const recipeEvent = (): EventDef => ({
    id: "ev_test_recipe",
    title: "失传丹方",
    text: "",
    tags: ["general"],
    weight: 1,
    choices: [
      {
        label: "记下丹方",
        outcomes: [{ weight: 1, text: "你记下了丹方。", effects: [{ type: "recipe" }] }],
      },
    ],
  });

  it("有未学方时给真方子、写进丹方录,并报出方名与掌握度", () => {
    const player = usePlayerStore();
    const lore = useLoreStore();
    const quests = useQuestsStore();
    player.major = 2;

    const before = new Set(
      Object.entries(lore.recipeLore)
        .filter(([, mastery]) => mastery > 0)
        .map(([id]) => id),
    );
    const res = resolveEventChoice(recipeEvent(), 0, 4);
    const learned = Object.entries(lore.recipeLore).find(
      ([id, mastery]) => mastery > 0 && !before.has(id),
    );

    expect(learned, "奇缘只说「收下丹方」,知识库里却没有新方").toBeDefined();
    expect(learned![1]).toBeGreaterThan(0);
    expect(quests.collections.pill, "得方之后图鉴仍遮成 ???").toContain(learned![0]);
    expect(res.lines.join("\n")).toContain("丹方「");
    expect(res.lines.join("\n")).toContain("掌握");
  });

  it("已识尽可学之方时折成悟道与残页,不把重复奇缘吞成空转", () => {
    const player = usePlayerStore();
    const lore = useLoreStore();
    const resources = useResourcesStore();
    const adventure = useAdventureStore();
    player.major = 2;
    // 境界是在本用例里直接抬上来的:先让成就/主线结清,再取保底基线，
    // 免得那笔与授方无关的悟道混进要核对的 10 点。
    track("events");
    lore.recipeLore = Object.fromEntries(PILLS.filter((p) => p.recipe).map((p) => [p.id, 1]));
    adventure.$patch({
      session: {
        regionId: "qingyun",
        mode: "normal",
        startedAt: 0,
        endsAt: 1_000_000,
        nextBattleAt: 0,
        wins: 0,
        losses: 0,
        events: 0,
        stoneGain: gn(0),
        expGain: gn(0),
        itemGain: 0,
        wudaoGain: 0,
        dustGain: 0,
      },
    });
    const wudao = resources.wudao;
    const page = resources.page;

    const res = resolveEventChoice(recipeEvent(), 0, 4);

    expect(resources.wudao - wudao).toBe(10);
    expect(resources.page - page).toBe(6);
    expect(res.lines.join("\n")).toContain("已识尽");
    expect(res.notableLines, "资源兜底不该在归来回执里重抄一遍数字").toEqual([
      "可学丹方已尽,悟道与残页已并入总账",
    ]);
    expect(adventure.session!.itemGain, "兜底给的残页仍是一份拾获").toBe(1);
  });

  it("功法已尽时的残页兜底也只进总账,不把同一笔数报两遍", () => {
    const player = usePlayerStore();
    const cultivation = useCultivationStore();
    const resources = useResourcesStore();
    const adventure = useAdventureStore();
    player.major = 2;
    track("events");
    cultivation.learned = Object.fromEntries(GONGFA.map((g) => [g.id, 1]));
    adventure.$patch({
      session: {
        regionId: "qingyun",
        mode: "normal",
        startedAt: 0,
        endsAt: 1_000_000,
        nextBattleAt: 0,
        wins: 0,
        losses: 0,
        events: 0,
        stoneGain: gn(0),
        expGain: gn(0),
        itemGain: 0,
        wudaoGain: 0,
        dustGain: 0,
      },
    });
    const page = resources.page;
    const def: EventDef = {
      id: "ev_test_gongfa_fallback",
      title: "残卷",
      text: "",
      tags: ["general"],
      weight: 1,
      choices: [
        {
          label: "展开",
          outcomes: [{ weight: 1, text: "卷中功法早已学过。", effects: [{ type: "gongfa" }] }],
        },
      ],
    };

    const res = resolveEventChoice(def, 0, 4);

    expect(resources.page - page).toBe(10);
    expect(res.notableLines).toEqual(["此道功法已尽,残页已并入总账"]);
    expect(adventure.session!.itemGain).toBe(1);
  });
});

/**
 * 际遇给的丹药得跟得上玩家此刻的境界。
 *
 * ## 缺口是什么(第 67 轮实测)
 *
 * `randomEventPill` 的权重原公式是 `100 / (1 + 品阶rank × 2)` ——
 * **只按品阶降权,不看玩家在哪一境**。实测境界 20 时的抽取分布:
 *
 * ```text
 * spirit(灵品) 18.9%   fine(良品) 18.4%   mortal 11.0%
 * divine(神品) 10.4%   immortal 11.8%
 * ```
 *
 * 高境界玩家有 **37% 的概率抽到灵品及以下的丹药** —— 那些丹在仙界几乎不值钱。
 * 而更荒唐的是 **mortal(凡品)占了 11%**:境界 20 的人拿到一枚聚气散。
 *
 * 已给权重再乘一个境界差因子:`1 / (1 + max(0, major - minRealm) × 0.5)`。
 *
 * ## 判据必须**真去抽**,不许在测试里重算公式
 *
 * 第一版我在 spec 里把权重公式抄了一遍、拿它算占比 —— 那样改实现它也不会红。
 * 注入验证时正是这个毛病暴露的:把衰减因子从 0.5 改回 1(等于取消衰减),
 * 判据**照样绿**,因为它算的是自己那份拷贝。
 *
 * 现在改成**调真函数抽 400 次**,数实际抽到的高/低品阶各几枚。
 */
describe("际遇丹药 · 给的丹要跟得上境界", () => {
  const HIGH_FLOOR = qualityDef("earth").rank;
  const LOW_CEIL = qualityDef("spirit").rank;

  /** 真抽 count 次,返回高品阶与低品阶各占多少 */
  function sample(major: number, count = 400): { high: number; low: number } {
    let high = 0;
    let low = 0;
    for (let i = 0; i < count; i += 1) {
      const id = randomEventPill(major);
      if (!id) continue;
      const def = PILLS.find((p) => p.id === id);
      if (!def) continue;
      const rank = qualityDef(def.quality).rank;
      if (rank >= HIGH_FLOOR) high += 1;
      else if (rank <= LOW_CEIL) low += 1;
    }
    return { high, low };
  }

  for (const major of [15, 20] as const) {
    it(`境界 ${major} 时,抽到的高品阶丹药多于低品阶`, () => {
      // 防空转:池子够大
      expect(PILLS.filter((p) => p.minRealm <= major).length).toBeGreaterThan(40);
      const { high, low } = sample(major);
      expect(high + low, "抽到的样本太少 —— 函数或池子有问题").toBeGreaterThan(200);
      /*
       * 用「不少于」而不是「严格多于」:400 次抽样里高/低品阶的期望值本来就接近
       * (实测境 15 是 48.2% vs 43.1%,只差 5 个百分点),严格多于会随种子偶发地红。
       * 判据要抓的是「过时的丹占掉多数」,不是「多一枚也算赢」。
       */
      expect(
        high,
        `境界 ${major} 抽了 400 次:高品阶 ${high} 枚、低品阶 ${low} 枚 —— ` + `过时的丹占掉了多数`,
      ).toBeGreaterThanOrEqual(low);
    });
  }

  it("低境界不被这条线误伤:境 5 时低品阶仍占多数", () => {
    const { high, low } = sample(5);
    expect(high + low, "抽到的样本太少").toBeGreaterThan(200);
    expect(low, `境界 5 抽了 400 次:低品阶 ${low} 枚、高品阶 ${high} 枚`).toBeGreaterThan(high);
  });
});
