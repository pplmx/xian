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
import type { EventDef } from "@/types";
import { add, gn, gte, mulN, sub, toNum } from "@/utils/gnum";
import { useResourcesStore } from "@/stores/resources";
import { useInventoryStore } from "@/stores/inventory";
import { useAdventureStore } from "@/stores/adventure";
import { useLoreStore } from "@/stores/lore";
import { usePlayerStore } from "@/stores/player";
import { useQuestsStore } from "@/stores/quests";
import { eventDef } from "@/data/events";
import { PILLS } from "@/data/pills";
import { resolveEventChoice } from "./eventEngine";
import { stoneByTier } from "./formulas";
import { track } from "./progress";

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
    player.major = 2;
    // 境界是在本用例里直接抬上来的:先让成就/主线结清,再取保底基线，
    // 免得那笔与授方无关的悟道混进要核对的 10 点。
    track("events");
    lore.recipeLore = Object.fromEntries(PILLS.filter((p) => p.recipe).map((p) => [p.id, 1]));
    const wudao = resources.wudao;
    const page = resources.page;

    const res = resolveEventChoice(recipeEvent(), 0, 4);

    expect(resources.wudao - wudao).toBe(10);
    expect(resources.page - page).toBe(6);
    expect(res.lines.join("\n")).toContain("已识尽");
  });
});
