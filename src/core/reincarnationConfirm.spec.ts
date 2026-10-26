/**
 * 转世确认 —— 一辈子只有一次、且不可撤销的那次结算。
 *
 * 这是全仓最重的一段副作用:改玩家、清资源、清背包、清功法层数、清历练、重掷世界、
 * 立新题、归档道侣……而它此前**没有一条直接用例**:`player.rebirth()` 有测试,
 * `prepareReincarnation()` 也被人读过,但「确认之后世界变成什么样」没人钉过。
 *
 * 判据盯三件事(都在不可撤销的前提下):
 *   ① 该归零的归零、该带走的带走(旧世的钱与物一点不留,账目只增不减);
 *   ② 再点一次什么都不再发(连点确认、恢复流程都会走到这里);
 *   ③ 无论从哪一境转世都不抛错,出生境界严格等于「宿命传承」给出的地板。
 */
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { prepareReincarnation, confirmReincarnation } from "./reincarnation";
import { birthMajorFloor } from "./heritageEffects";
import { stageAt } from "@/data/samsara";

/*
 * 只把「重掷本世之界」换成直通 —— 它每掷一次要跑门禁重试(最多 200 轮),
 * 在 12 组随机状态里就是九秒;而这条用例核对的是道果/宿慧/阶名/名号,与换哪个世界无关。
 */
vi.mock("./mortalWorldService", async (importOriginal) => {
  const mod = await importOriginal<typeof import("./mortalWorldService")>();
  return { ...mod, rerollMortalWorld: () => null };
});
import { useGameStore } from "@/stores/game";
import { usePlayerStore } from "@/stores/player";
import { useResourcesStore } from "@/stores/resources";
import { useInventoryStore } from "@/stores/inventory";
import { useAdventureStore } from "@/stores/adventure";
import { useCultivationStore } from "@/stores/cultivation";
import { useUiStore } from "@/stores/ui";
import { gn, toNum } from "@/utils/gnum";

/** 一份「活过一世」的档:有钱、有物、在打、练过功法 */
function seedLife(major = 3): void {
  // 轮回视图经 uiPort 递给 ui store:不建它,sink 没接上,prepare 等于白准备
  useUiStore();
  const game = useGameStore();
  const player = usePlayerStore();
  const resources = useResourcesStore();
  const adventure = useAdventureStore();
  game.markStarted();
  player.major = major;
  player.sub = 2;
  player.age = 40;
  player.exp = gn(9_999_999);
  player.reincarnation.count = 1;
  player.reincarnation.daoFruit = 10;
  player.reincarnation.insight = 50;
  resources.spiritStone = gn(1_000_000);
  resources.herbs = { 1: 400, 2: 100, 3: 0, 4: 0, 5: 0 } as never;
  resources.ore = 300;
  resources.page = 200;
  resources.dust = 100;
  useCultivationStore().buffs = [{ id: "b", name: "药力", endsAt: Date.now() + 60_000 }] as never;
  adventure.session = {
    regionId: "qingyun",
    mode: "normal",
    startedAt: Date.now(),
    endsAt: Date.now() + 3600_000,
    nextBattleAt: 0,
    wins: 2,
    losses: 0,
    events: 0,
    stoneGain: gn(0),
    expGain: gn(0),
    itemGain: 0,
    wudaoGain: 0,
  } as never;
  adventure.unlocked = ["qingyun", "luoxia"];
  adventure.cleared = ["qingyun"];
}

describe("转世确认 · 不可撤销的那一次结算", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("账目只增不减,旧世的钱物一点不留", () => {
    seedLife();
    const player = usePlayerStore();
    const resources = useResourcesStore();
    const inventory = useInventoryStore();
    const adventure = useAdventureStore();
    const before = {
      count: player.reincarnation.count,
      fruit: player.reincarnation.daoFruit,
      insight: player.reincarnation.insight,
      lives: player.reincarnation.lives.length,
    };

    const view = prepareReincarnation();
    confirmReincarnation(null, null, "守拙散人");

    expect(player.reincarnation.count).toBe(before.count + 1);
    expect(player.reincarnation.daoFruit).toBe(before.fruit + view.daoFruitGained);
    expect(player.reincarnation.insight).toBe(before.insight + view.review.insightGained);
    expect(player.reincarnation.lives.length, "履历必须添一条").toBe(before.lives + 1);
    expect(player.dead).toBe(false);
    // 旧世的百万灵石必须清掉;之后只会有成就赏这类小钱落进来(实测 ~455)
    expect(toNum(resources.spiritStone), "旧世的灵石没清掉").toBeLessThan(1000);
    /*
     * 用大额旧值 + 小阈值来判「旧的一点没留」:转世之后成就赏会再发一点小钱
     * (实测灵石 ~455、灵草 10),拿 ==0 当判据会被这些**合法**的赏赐打红。
     */
    expect(resources.herb, "旧世的灵草没清掉").toBeLessThan(100);
    expect(resources.ore).toBe(0);
    expect(resources.page).toBe(0);
    expect(resources.dust).toBe(0);
    expect(inventory.items.length).toBe(0);
    expect(inventory.equippedArtifacts.length).toBe(0);
    expect(useCultivationStore().buffs.length, "本世增益随皮囊散去").toBe(0);
    expect(adventure.session, "在途历练随皮囊散去").toBeNull();
    expect(adventure.unlocked).toEqual(["qingyun"]);
    expect(adventure.cleared).toEqual([]);
    expect(player.name).toBe("守拙散人");
    expect(toNum(player.exp)).toBe(0);
  });

  it("再点一次:什么都不再发(连点与恢复流程都会走到这里)", () => {
    seedLife();
    const player = usePlayerStore();
    prepareReincarnation();
    confirmReincarnation(null, null);
    const snap = {
      count: player.reincarnation.count,
      fruit: player.reincarnation.daoFruit,
      insight: player.reincarnation.insight,
      lives: player.reincarnation.lives.length,
    };
    expect(() => confirmReincarnation(null, null)).not.toThrow();
    expect({
      count: player.reincarnation.count,
      fruit: player.reincarnation.daoFruit,
      insight: player.reincarnation.insight,
      lives: player.reincarnation.lives.length,
    }).toEqual(snap);
  });

  it("择一的天姿与立题都真的落账", () => {
    seedLife();
    const player = usePlayerStore();
    const view = prepareReincarnation();
    const talentId = view.talentChoices[0]!;
    const themeId = view.themeChoices[0]!;
    confirmReincarnation(talentId, themeId);
    expect(player.reincarnation.talents).toContain(talentId);
    expect(player.reincarnation.vow?.themeId, "立了题就得记下来").toBe(themeId);
  });

  it("从哪一境转世都不抛错,出生境界严格等于传承地板", () => {
    for (const major of [0, 1, 2, 5, 9, 14, 20]) {
      setActivePinia(createPinia());
      seedLife(major);
      const player = usePlayerStore();
      prepareReincarnation();
      expect(() => confirmReincarnation(null, null), `major=${major} 转世抛错`).not.toThrow();
      expect(player.major, `major=${major} 转世后境界不对`).toBe(
        birthMajorFloor(player.reincarnation.heritage),
      );
      expect(Number.isFinite(toNum(player.exp))).toBe(true);
    }
  });
});

describe("转世预告 · 许诺的数必须兑现", () => {
  /*
   * 转世弹窗给出的是**有约束力的许诺**:多少道果、多少宿慧、落到哪一阶、叫什么名号。
   * 玩家确认之前只能看到这些数,确认之后不可撤销。预告与结算各算一遍的地方,
   * 一旦分叉(改了一边忘了另一边),玩家拿到的就会与看到的不一样 —— 而它不可撤销。
   *
   * 这里用固定种子随机走 30 组状态(境界 × 宿慧 × 传承),逐条核对预告与实际之差。
   */
  function lcg(seed: number): () => number {
    let s = seed >>> 0;
    return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  }
  const HERITAGES = [
    "danxin",
    "yuanying",
    "baihuang",
    "tonggan",
    "shouzhuo",
    "daotong",
    "dubu",
    "daoben",
  ];

  it("道果 / 宿慧 / 阶名 / 名号:30 组随机状态下预告与结算逐条相同", () => {
    const rand = lcg(7);
    const fails: string[] = [];
    let fruitMoves = 0;
    for (let i = 0; i < 30; i += 1) {
      setActivePinia(createPinia());
      useUiStore();
      const game = useGameStore();
      const player = usePlayerStore();
      const res = useResourcesStore();
      useAdventureStore();
      game.markStarted();
      player.major = Math.floor(rand() * 21);
      player.sub = Math.floor(rand() * 3);
      player.age = 30 + Math.floor(rand() * 100);
      player.exp = gn(100000);
      player.reincarnation.count = 1 + Math.floor(rand() * 5);
      player.reincarnation.daoFruit = Math.floor(rand() * 100);
      player.reincarnation.insight = Math.floor(rand() * 3000);
      player.reincarnation.heritage = HERITAGES.filter(() => rand() < 0.25) as never;
      res.spiritStone = gn(10000);

      const fruit0 = player.reincarnation.daoFruit;
      const insight0 = player.reincarnation.insight;
      const view = prepareReincarnation();
      confirmReincarnation(null, null, view.nameDraft);

      const dFruit = player.reincarnation.daoFruit - fruit0;
      const dInsight = player.reincarnation.insight - insight0;
      const where = `#${i} major=${player.major} insight=${insight0}`;
      if (dFruit !== view.daoFruitGained)
        fails.push(`${where} 道果 ${dFruit} ≠ 预告 ${view.daoFruitGained}`);
      if (dInsight !== view.review.insightGained)
        fails.push(`${where} 宿慧 ${dInsight} ≠ 预告 ${view.review.insightGained}`);
      if (player.reincarnation.insight !== view.insightAfter)
        fails.push(`${where} 宿慧总量 ${player.reincarnation.insight} ≠ 预告 ${view.insightAfter}`);
      const stage = stageAt(player.reincarnation.insight);
      if (stage.name !== view.stageName)
        fails.push(`${where} 阶名 ${stage.name} ≠ 预告 ${view.stageName}`);
      if (player.name !== view.nameDraft) fails.push(`${where} 名号没落上`);
      if (dFruit > 0) fruitMoves += 1;
    }
    expect(fails.slice(0, 6)).toEqual([]);
    // 防空转:随机档里得真有一部分真的凝出道果,否则这条判据只在比 0 与 0
    expect(fruitMoves, "30 组里凝出道果的太少 —— 夹具没造出有效状态").toBeGreaterThan(8);
  });
});
