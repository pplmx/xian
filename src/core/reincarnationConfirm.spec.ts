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
import { generateMortalWorld } from "./mortalWorldGen";
import { stageAt } from "@/data/samsara";
import { GONGFA } from "@/data/gongfa";
import { rollLinggen } from "./linggenGen";
import { RandomService, mulberry32 } from "@/utils/random";

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

  it("掷不出新天地时,旧世界与旧路线也不许带进下一世", () => {
    seedLife();
    const adventure = useAdventureStore();
    const oldWorld = generateMortalWorld(95_000);
    adventure.setMortalWorld(oldWorld);
    adventure.markNodeCleared(oldWorld.chain[0]!.nodeId);

    prepareReincarnation();
    confirmReincarnation(null, null);

    expect(adventure.mortalWorld, "旧世界不能冒充新一世").toBeNull();
    expect(adventure.mortalCleared, "旧路线进度不能带进新一世").toEqual([]);
    expect(
      adventure.mortalWorldHistory.map((w) => w.seed),
      "掷不出新天地时,旧世界仍要进前尘与去重历史",
    ).toContain(oldWorld.seed);
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
      // 练过三部功法(层数各异):转世后「哪一门保层数」正是这条用例要核的预告之一
      const learned = useCultivationStore().learned;
      const learnedBefore = {
        [GONGFA[0]!.id]: 5,
        [GONGFA[1]!.id]: 2,
        [GONGFA[2]!.id]: 1,
      };
      Object.assign(learned, learnedBefore);

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
      // 功法预告:层数回一层 / 保一门 / 全带 —— 实际学到的层数必须与预告一致
      if (view.gongfaKeep.total !== 3) fails.push(`${where} 功法总数 ${view.gongfaKeep.total} ≠ 3`);
      const after = useCultivationStore().learned;
      for (const [id, lv] of Object.entries(learnedBefore)) {
        const want = view.gongfaKeep.keepAll
          ? lv
          : id === view.gongfaKeep.keepOneId
            ? view.gongfaKeep.keepOneLevel
            : 1;
        if (after[id] !== want) {
          fails.push(`${where} 功法 ${id} 实得 ${after[id]} 层,预告 ${want} 层`);
        }
      }
      if (dFruit > 0) fruitMoves += 1;
    }
    expect(fails.slice(0, 6)).toEqual([]);
    // 防空转:随机档里得真有一部分真的凝出道果,否则这条判据只在比 0 与 0
    expect(fruitMoves, "30 组里凝出道果的太少 —— 夹具没造出有效状态").toBeGreaterThan(8);
  });
});

/**
 * 历世履历的快照 —— 每一世记下的是那一世自己的灵根
 *
 * ## 缺口:转世看得见,翻旧账看不见
 *
 * 转世弹窗那一轮做完了「所见即所得」(`prepareReincarnation` 只 roll 一次,
 * confirm 用同一份,见 `stores/game.spec` 的 WYSIWYG 那一组)。可那时定下的
 * 交付 2 —— 历世履历带上灵根、能回望每世牌面 —— 停在计划上没落地:
 * `LifeRecord` 里没有灵根字段。
 *
 * 于是玩家转过几世,翻修仙录的历世履历,每一行都只有「旧境 X · 寿 N 载」;
 * 转世那一刻看到的天灵根,第二次转世之后就再也查不到了。
 *
 * ## 这一组盯三件事
 *
 *   ① 归档的是**本世**灵根(`rebirth` 之前那副),不是来世那副;
 *   ② 快照是拷贝 —— 之后改灵根不会把旧世的记录一起改写;
 *   ③ 灵根缺失时(老档 / 建号没走完)不抛错,也不编一副出来
 *      (`LifeRecord.linggen` 是可选字段)。
 *
 * 第 ②条不是洁癖:`rebirth` 里就是 `linggen.value = newLinggen`,
 * 若归档时塞的是 `player.linggen` 本体,每一世会共用同一个引用 ——
 * 十世履历一起显示成最新那一世的牌面。
 */
describe("历世履历 · 快照本世灵根", () => {
  beforeEach(() => setActivePinia(createPinia()));

  /** 建号那一副灵根 —— 与开局流程同一条路(`initCharacter` 必设灵根) */
  function seedLinggen(seed = 33) {
    seedLife();
    const player = usePlayerStore();
    player.initCharacter("测试道友", rollLinggen(new RandomService(mulberry32(seed))));
    return player;
  }

  it("归档的是本世那一副(转世前),不是来世那一副", () => {
    const player = seedLinggen(33);
    const thisLife = player.linggen!;
    const before = { grade: thisLife.gradeName, elements: thisLife.roots.map((r) => r.element) };

    const view = prepareReincarnation();
    const nextLife = JSON.parse(JSON.stringify(view.nextLinggen));
    confirmReincarnation(null, null);

    const lives = player.reincarnation.lives;
    expect(lives.length, "没有归档任何一世").toBe(1);
    const rec = lives[0]!;
    expect(rec.linggen, "履历里没有灵根字段").toBeDefined();
    expect(rec.linggen!.gradeName, "记成了来世那一副").toBe(before.grade);
    expect(
      rec.linggen!.roots.map((r) => r.element),
      "根也不同源",
    ).toEqual(before.elements);
    // 落账之后 player.linggen 已是来世那副(store 里过一层响应式代理,故比真值不比引用)
    expect(JSON.parse(JSON.stringify(player.linggen)), "来世灵根没落账").toEqual(nextLife);
  });

  it("快照是拷贝:之后改灵根不追改旧世的记录", () => {
    const player = seedLinggen(44);
    const thisLife = player.linggen!;
    const snapElements = thisLife.roots.map((r) => r.element);
    const snapAptitudes = thisLife.roots.map((r) => r.aptitude);

    prepareReincarnation();
    confirmReincarnation(null, null);

    const rec = player.reincarnation.lives[0]!;
    expect(rec.linggen!.roots, "履历与本世快照源共享同一个数组").not.toBe(thisLife.roots);
    // 篡改当年的灵根对象:旧世记录必须纹丝不动
    thisLife.roots.forEach((root) => {
      root.aptitude = 1;
    });
    thisLife.roots.length = 0;
    expect(
      rec.linggen!.roots.map((r) => r.element),
      "旧世记录跟着本世对象一起变了",
    ).toEqual(snapElements);
    expect(rec.linggen!.roots.map((r) => r.aptitude)).toEqual(snapAptitudes);
  });

  it("每一世各记各的:转到第三世,前两世的灵根不会被改成最新那副", () => {
    const player = seedLinggen(55);
    const grades: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      prepareReincarnation();
      grades.push(player.linggen!.gradeName);
      confirmReincarnation(null, null);
    }
    const recorded = player.reincarnation.lives.map((l) => l.linggen?.gradeName);
    expect(recorded, "三世各该留一笔").toHaveLength(3);
    for (const g of recorded) expect(g, "某一世没记下灵根").toBeTruthy();
    // 前两世记的必须等于当时那副 —— 逐世比对,而不是只看「都非空」
    expect(recorded.slice(0, 2)).toEqual(grades.slice(0, 2));
  });

  it("灵根缺失时不抛错,老存档那条路照走(可选字段)", () => {
    seedLife();
    const player = usePlayerStore();
    // 模拟老档 / 极端状态:建号流程没走完就有转世记录
    player.linggen = null;
    prepareReincarnation();
    expect(() => confirmReincarnation(null, null), "灵根缺失时转世抛错").not.toThrow();
    expect(player.reincarnation.lives[0]!.linggen, "没有灵根时不该编一副出来").toBeUndefined();
  });
});
