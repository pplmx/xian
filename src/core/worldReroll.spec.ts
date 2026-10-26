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
import { WORLD_REROLL_FRUIT, rerollWorldByFruit } from "./worldReroll";

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
    expect(player.reincarnation.daoFruit).toBe(100 - WORLD_REROLL_FRUIT);
    const after = freshWorld();
    expect(after, "掷完应该有世界").not.toBeNull();
    const afterKey = `${after!.seed}/${after!.bias}/${after!.shapeId}/${after!.chain.length}`;
    expect(afterKey, "换了钱却没换世界").not.toBe(beforeKey);
  });

  it("不够钱时:返回 poor,余额与世界一个字节都没动", () => {
    const player = usePlayerStore();
    player.reincarnation = { ...player.reincarnation, daoFruit: WORLD_REROLL_FRUIT - 1 } as never;
    const before = freshWorld();
    const beforeKey = before ? `${before.seed}/${before.bias}` : "none";
    expect(reroll()).toBe("poor");
    expect(player.reincarnation.daoFruit).toBe(WORLD_REROLL_FRUIT - 1);
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
    expect(control.spendDaoFruit(WORLD_REROLL_FRUIT)).toBe(true);
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
      gains.every((g) => g === -WORLD_REROLL_FRUIT),
      "每次都必须净支出 15",
    ).toBe(true);
  });
});
