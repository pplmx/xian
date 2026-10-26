/* oxlint-disable no-console -- 价目表要打给人看 */
/**
 * 换一方天地 —— 道果出口的落地判据。
 *
 * fruitOutlets.spec 论证了「出口必须是花得掉、且不回到 StatMods」的东西;
 * 这里守它落地后的四条:余额真的下降、掷不出来不扣、不够时什么都不动、
 * 换到的世界里没有任何一处战力读数变化。
 */
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { usePlayerStore } from "@/stores/player";
import { useAdventureStore } from "@/stores/adventure";
import { rerollMortalWorld } from "./mortalWorldService";
import { WORLD_REROLL_FLOOR, worldRerollCost, rerollWorldByFruit } from "./worldReroll";

/** 把 store 里的三件事按出口的口径递进去 */
function reroll(): ReturnType<typeof rerollWorldByFruit> {
  const player = usePlayerStore();
  return rerollWorldByFruit({
    daoFruit: player.reincarnation.daoFruit,
    spendFruit: (n) => player.spendDaoFruit(n),
    reroll: () => rerollMortalWorld(),
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
    const gains: number[] = [];
    for (let i = 0; i < 5; i += 1) {
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
