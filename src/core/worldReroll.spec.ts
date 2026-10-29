/* oxlint-disable no-console -- 价目表要打给人看 */
/**
 * 换一方天地 —— 道果出口的落地判据。
 *
 * fruitOutlets.spec 论证了「出口必须是花得掉、且不回到 StatMods」的东西;
 * 这里守它落地后的四条:余额真的下降、掷不出来不扣、不够时什么都不动、
 * 换到的世界里没有任何一处战力读数变化。
 */
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { usePlayerStore } from "@/stores/player";
import { useAdventureStore } from "@/stores/adventure";
import { ensureMortalWorld, rollMortalWorld } from "./mortalWorldService";
import { generateMortalWorld } from "./mortalWorldGen";
import { generateGatedMortal } from "./mortalGate";
import {
  WORLD_REROLL_FLOOR,
  WORLD_REROLL_RATE,
  worldRerollCost,
  worldRerollQuote,
  rerollWorldByFruit,
} from "./worldReroll";

vi.mock("./mortalGate", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./mortalGate")>();
  return { ...actual, generateGatedMortal: vi.fn(actual.generateGatedMortal) };
});

/** 把 store 里的三件事按出口的口径递进去 */
function reroll(): ReturnType<typeof rerollWorldByFruit> {
  const player = usePlayerStore();
  const adventure = useAdventureStore();
  return rerollWorldByFruit({
    daoFruit: player.reincarnation.daoFruit,
    spendFruit: (n) => player.spendDaoFruit(n),
    reroll: () => rollMortalWorld(),
    commit: (next) => adventure.setMortalWorld(next),
    sessionActive: adventure.sessionActive,
  });
}

function freshWorld() {
  const adventure = useAdventureStore();
  return adventure.mortalWorld;
}

describe("换一方天地 · 道果真的被花掉", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const player = usePlayerStore();
    player.reincarnation = { ...player.reincarnation, daoFruit: 100 } as never;
    player.major = 3;
  });

  it("够钱时:余额正好减 15,世界换了一个", () => {
    const player = usePlayerStore();
    const before = freshWorld();
    const beforeKey = before
      ? `${before.seed}/${before.bias}/${before.shapeId}/${before.chain.length}`
      : "none";
    const r = reroll();
    expect(r).toBe("ok");
    expect(player.reincarnation.daoFruit).toBe(100 - worldRerollCost(100));
    const after = freshWorld();
    expect(after, "掷完应该有世界").not.toBeNull();
    const afterKey = `${after!.seed}/${after!.bias}/${after!.shapeId}/${after!.chain.length}`;
    expect(afterKey, "换了钱却没换世界").not.toBe(beforeKey);
  });

  it("不够钱时:返回 poor,余额与世界一个字节都没动", () => {
    const player = usePlayerStore();
    player.reincarnation = { ...player.reincarnation, daoFruit: WORLD_REROLL_FLOOR - 1 } as never;
    const before = freshWorld();
    const beforeKey = before ? `${before.seed}/${before.bias}` : "none";
    expect(reroll()).toBe("poor");
    expect(player.reincarnation.daoFruit).toBe(WORLD_REROLL_FLOOR - 1);
    const after = freshWorld();
    expect(after ? `${after.seed}/${after.bias}` : "none").toBe(beforeKey);
  });

  it("扣款失败时:候选世界也不许先落地", () => {
    const adventure = useAdventureStore();
    const current = generateMortalWorld(93_000);
    const candidate = generateMortalWorld(94_000);
    adventure.setMortalWorld(current);
    const commit = vi.fn();

    const result = rerollWorldByFruit({
      daoFruit: 100,
      spendFruit: () => false,
      reroll: () => candidate,
      commit,
      sessionActive: false,
    });

    expect(result).toBe("poor");
    expect(commit, "扣款没成功却提交了候选世界").not.toHaveBeenCalled();
    expect(adventure.mortalWorld?.seed).toBe(current.seed);
  });

  it("掷不出新世界时:返回 unavailable,道果、世界与路线进度都不动", () => {
    const player = usePlayerStore();
    const adventure = useAdventureStore();
    expect(ensureMortalWorld()).not.toBeNull();
    const before = adventure.mortalWorld!;
    const beforeKey = `${before.seed}/${before.bias}/${before.shapeId}/${before.chain.length}`;
    adventure.markNodeCleared(before.chain[0]!.nodeId);
    const cleared = [...adventure.mortalCleared];

    vi.mocked(generateGatedMortal)
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(null);
    expect(reroll()).toBe("unavailable");

    expect(player.reincarnation.daoFruit).toBe(100);
    const after = adventure.mortalWorld;
    expect(after, "掷界失败不该把手里这一世也一起抹掉").not.toBeNull();
    expect(`${after!.seed}/${after!.bias}/${after!.shapeId}/${after!.chain.length}`).toBe(
      beforeKey,
    );
    expect(adventure.mortalCleared).toEqual(cleared);
  });

  it("换世界本身一个战力点都不加 —— 面板的变化全部来自扣掉的那 15 枚道果", () => {
    /*
     * 道果**本身**就在 StatMods 里(它给修炼速度与攻防血)—— 所以扣款必然让面板松动,
     * 那是「断边」该有的样子,不是出口在发战力。正确的对照是:同样扣 15 枚、不换世界,
     * 面板应当与换完世界一模一样。差一点,就说明重掷顺手塞了什么进去。
     */
    const player = usePlayerStore();
    expect(reroll()).toBe("ok");
    const afterReroll = JSON.stringify(player.finalStats);

    // 对照组:同一份起始状态,只扣款不换世界
    setActivePinia(createPinia());
    const control = usePlayerStore();
    control.reincarnation = { ...control.reincarnation, daoFruit: 100 } as never;
    control.major = 3;
    expect(control.spendDaoFruit(worldRerollCost(100))).toBe(true);
    expect(JSON.stringify(control.finalStats), "换世界不许顺带加战力").toBe(afterReroll);
  });

  it("反过来:道果不会因为换世界而变多(没有自供能)", () => {
    const player = usePlayerStore();
    /*
     * 两轮就够了:要证的是「每次都是净支出」,不是「能连换五次」。
     * 从前写的是五轮 —— 每轮都要真生成一个世界(过新颖度门),并行负载高时
     * 整条用例能顶到 20s 默认上限而偶发超时。少跑三轮不影响这条判据。
     */
    const gains: number[] = [];
    for (let i = 0; i < 2; i += 1) {
      const before = player.reincarnation.daoFruit;
      if (reroll() !== "ok") break;
      gains.push(player.reincarnation.daoFruit - before);
    }
    expect(gains.length).toBeGreaterThan(0);
    expect(
      gains.every((g) => g < 0),
      "每次都必须净支出",
    ).toBe(true);
  });
});

describe("换一方天地 · 定价跟着余额走(不是固定 15 枚)", () => {
  /*
   * fruitOutlets 论证过:固定定价 + 无上限余额 = 出口迟早变成免费按钮
   * (第 20 世手里几千枚道果时,15 枚什么都算不上)。第一版正是那个写法,
   * 这组判据钉住「跟着余额走」这一条。
   */
  it("起步价是地板:余额再少也只收 15 枚", () => {
    expect(worldRerollCost(0)).toBe(WORLD_REROLL_FLOOR);
    expect(worldRerollCost(WORLD_REROLL_FLOOR)).toBe(WORLD_REROLL_FLOOR);
  });

  it("攒得越多换一次越贵 —— 深修的人不能随手刷世界", () => {
    expect(worldRerollCost(1000)).toBeGreaterThan(worldRerollCost(100));
    expect(worldRerollCost(10000)).toBeGreaterThan(worldRerollCost(1000));
    // 自证:如果定价回到常数,这一条会当场红
    expect(worldRerollCost(10000)).toBeGreaterThan(WORLD_REROLL_FLOOR * 10);
  });

  it("价目表:各量级余额换一次要多少(含脏值兜底)", () => {
    const rows = [15, 50, 100, 300, 1000, 3000, 10000, 30000].map(
      (b) => `${b} → ${worldRerollCost(b)}`,
    );
    console.log(`\n换一方天地:余额 → 价(枚)\n  ${rows.join(" · ")}`);
    expect(worldRerollCost(30000)).toBeGreaterThan(worldRerollCost(3000));
    // 脏值不许算出负价:负数/NaN 一律落回起步价
    expect(worldRerollCost(-100)).toBe(WORLD_REROLL_FLOOR);
    expect(worldRerollCost(Number.NaN)).toBe(WORLD_REROLL_FLOOR);
    expect(worldRerollCost(Number.POSITIVE_INFINITY)).toBe(WORLD_REROLL_FLOOR);
  });

  it("坏档:余额是 NaN 时拒绝换世界,一个字节都不动", () => {
    const player = usePlayerStore();
    player.reincarnation = { ...player.reincarnation, daoFruit: Number.NaN } as never;
    const before = freshWorld();
    const beforeKey = before ? `${before.seed}/${before.bias}` : "none";
    expect(reroll()).toBe("poor");
    expect(Number.isNaN(player.reincarnation.daoFruit), "余额不许被写成别的值").toBe(true);
    const after = freshWorld();
    expect(after ? `${after.seed}/${after.bias}` : "none").toBe(beforeKey);
  });

  it("连换多次:付得起,但余额呈等比衰减 —— 永远不会变成零成本", () => {
    let balance = 2000;
    const costs: number[] = [];
    for (let i = 0; i < 60; i += 1) {
      const cost = worldRerollCost(balance);
      if (cost > balance) break;
      costs.push(cost);
      balance -= cost;
    }
    expect(costs.length, "两千枚应当换得起很多次").toBeGreaterThan(10);
    expect(balance, "连换之后余额必须真的降下去").toBeLessThan(2000 * 0.2);
    expect(costs.at(-1), "最后一笔仍在起步价之上").toBeGreaterThanOrEqual(WORLD_REROLL_FLOOR);
  });
});

describe("换一方天地 · 历练途中不换界", () => {
  /*
   * setMortalWorld 的第一件事是把本世路线进度清零(「换界即换路」)。
   * 途中换掉等于把玩家正在走的那条路抽走,而这一趟的所得还没结算 ——
   * 所以宁可拒绝,不制造说不清的损失。
   */
  it("有一趟历练在途中:返回 busy,道果与世界都不动", () => {
    const player = usePlayerStore();
    const adventure = useAdventureStore();
    player.reincarnation = { ...player.reincarnation, daoFruit: 100 } as never;
    adventure.session = {
      regionId: "qingyun",
      mode: "normal",
      wins: 1,
      endsAt: Date.now() + 6e4,
    } as never;
    const before = freshWorld();
    const beforeKey = before ? `${before.seed}/${before.bias}` : "none";
    expect(reroll()).toBe("busy");
    expect(player.reincarnation.daoFruit).toBe(100);
    const after = freshWorld();
    expect(after ? `${after.seed}/${after.bias}` : "none").toBe(beforeKey);
  });

  it("历练走完之后可以换 —— busy 不是永久闸", () => {
    const player = usePlayerStore();
    const adventure = useAdventureStore();
    player.reincarnation = { ...player.reincarnation, daoFruit: 100 } as never;
    adventure.session = {
      regionId: "qingyun",
      mode: "normal",
      wins: 1,
      endsAt: Date.now() + 6e4,
    } as never;
    expect(reroll()).toBe("busy");
    adventure.session = null as never;
    expect(reroll()).toBe("ok");
  });

  it("门槛报价与结算同源:历练中优先报 busy,缺钱与数值坏档都报 poor", () => {
    expect(worldRerollQuote(100, false)).toEqual({
      cost: WORLD_REROLL_FLOOR,
      shortfall: 0,
      blockedBy: null,
    });
    expect(worldRerollQuote(WORLD_REROLL_FLOOR - 3, false)).toEqual({
      cost: WORLD_REROLL_FLOOR,
      shortfall: 3,
      blockedBy: "poor",
    });
    expect(worldRerollQuote(WORLD_REROLL_FLOOR - 3, true)).toEqual({
      cost: WORLD_REROLL_FLOOR,
      shortfall: 3,
      blockedBy: "busy",
    });
    expect(worldRerollQuote(Number.NaN, true)).toEqual({
      cost: WORLD_REROLL_FLOOR,
      shortfall: WORLD_REROLL_FLOOR,
      blockedBy: "poor",
    });
  });

  // 真实生成门会跑若干候选；给它足够超时，判据本身不变。
  it("真实换界把四旧一现全部交给生成门,并在成功后把上一世移入历史", () => {
    const player = usePlayerStore();
    const adventure = useAdventureStore();
    player.reincarnation = { ...player.reincarnation, daoFruit: 100 } as never;
    const older = [1, 2, 3, 4].map((seed) => generateMortalWorld(80_000 + seed));
    const current = generateMortalWorld(90_000);
    adventure.$patch({
      mortalWorld: current,
      mortalWorldHistory: older,
    } as never);
    vi.mocked(generateGatedMortal).mockClear();

    expect(reroll()).toBe("ok");

    const call = vi.mocked(generateGatedMortal).mock.calls.at(-1);
    expect(call?.[1]?.map((w) => w.seed)).toEqual([...older, current].map((w) => w.seed));
    expect(adventure.mortalWorldHistory.map((w) => w.seed)).toEqual(
      [...older.slice(1), current].map((w) => w.seed),
    );
  }, 15_000);

  it("一个种子窗口过不了门时换起点再试,不把偶发失败丢给玩家", () => {
    const player = usePlayerStore();
    const adventure = useAdventureStore();
    player.reincarnation = { ...player.reincarnation, daoFruit: 100 } as never;
    const current = generateMortalWorld(91_000);
    const replacement = generateMortalWorld(92_000);
    adventure.$patch({ mortalWorld: current, mortalWorldHistory: [] } as never);
    vi.mocked(generateGatedMortal).mockClear();
    vi.mocked(generateGatedMortal)
      .mockReturnValueOnce(null)
      .mockReturnValueOnce({ report: { world: replacement } } as never);

    expect(reroll()).toBe("ok");

    const calls = vi.mocked(generateGatedMortal).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0]![0]).not.toBe(calls[1]![0]);
    expect(adventure.mortalWorld?.seed).toBe(replacement.seed);
  });
});

describe("手册里的价 · 与常数同源", () => {
  /*
   * 手册写着「按余额一成半、至少 15 枚」。这类数字最容易被忘:调了常量、文档没跟,
   * 玩家按手册算出来的价与实际扣款对不上 —— 与「改常数就撒谎」同一个病。
   */
  const DOC = readFileSync(resolve(__dirname, "../../docs/usage.md"), "utf8");
  const RATE_WORD: Record<string, string> = {
    "0.1": "一成",
    "0.15": "一成半",
    "0.2": "两成",
    "0.25": "两成半",
  };

  it("抽成与起步价都对得上", () => {
    const rateWord = RATE_WORD[String(WORLD_REROLL_RATE)];
    expect(rateWord, `抽成 ${WORLD_REROLL_RATE} 没有对应的中文说法,先补一张词表`).toBeDefined();
    expect(DOC, `手册没写「${rateWord}」`).toContain(rateWord!);
    expect(DOC, `手册写的起步价不是 ${WORLD_REROLL_FLOOR} 枚`).toContain(
      `至少 ${WORLD_REROLL_FLOOR} 枚`,
    );
  });
});
