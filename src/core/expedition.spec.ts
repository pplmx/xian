/* oxlint-disable no-console -- 梯子表是给人看的 */
/**
 * 远征 · 端到端(终局的核心功能,此前只有零散判据碰过它)
 *
 * 这里走**真实路径**:花钱 → 开一趟 → 择路 → 打界主 → 结算,中间不绕开 store。
 * 盯三件事:
 *   一 **账目**:出发扣的道源,正是这一界写着的入界价;
 *   二 **梯子**:四重天界按锚点层级排成阶梯 —— 该境界的人打得动,
 *      差一大截的人打不动,高一境的人压着打(实测过锚点标定,见 celestialCaliber.spec);
 *   三 **判定看得见**:道之理解与境界压制的文案,战前预估与战报读同一份。
 */
import { describe, expect, it, beforeEach } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { usePlayerStore } from "@/stores/player";
import { useInventoryStore } from "@/stores/inventory";
import { useEndgameStore } from "@/stores/endgame";
import { CELESTIAL_WORLDS } from "@/data/endgame";
import { readFileSync, readdirSync } from "node:fs";
import { analyzeBattle } from "./battleAnalysis";
import { resolve } from "node:path";
import {
  forecastExpedition,
  startWorldExpedition,
  chooseRouteNode,
  challengeGuardian,
  challengeMutation,
  expeditionForecastFoes,
  sealCoreMods,
} from "./expedition";
import { detectBuild } from "./buildDetect";
import { celestialJudgementLines } from "./gauntlet";
import type { EquipSlot, EquipmentInstance } from "@/types";

const SLOTS: EquipSlot[] = [
  "weapon",
  "head",
  "body",
  "wrist",
  "belt",
  "boots",
  "necklace",
  "ring",
  "talisman",
];
/** 人间界顶配那一身(飞升时能带走的最好家当) */
const MORTAL_TOP = [
  "w_jiujie",
  "h_zichen",
  "b_taiqing",
  "wr_jieyun",
  "bl_yunlei",
  "bo_lingxu",
  "n_jiuzhuan",
  "r_ziyuan",
  "tl_yulei",
];
/** 混沌海那一身 */
const CHAOS_TOP = [
  "w_benyuan",
  "h_benyuan",
  "b_benyuanshen",
  "wr_benyuan",
  "bl_benyuan",
  "bo_benyuan",
  "n_hongmengzhu",
  "r_daozu",
  "tl_daozuzhuan",
];

function seated(
  major: number,
  tpls: string[],
  quality: EquipmentInstance["quality"],
  tier: number,
): void {
  const player = usePlayerStore();
  player.initCharacter("远征自检", { roots: [{ element: "wood", aptitude: 90 }] } as never);
  player.major = major;
  player.sub = 9;
  const inv = useInventoryStore();
  inv.items = tpls.map((templateId, i): EquipmentInstance => ({
    uid: `x${i}`,
    templateId,
    quality,
    tier,
    level: 5,
    affixes: [
      { id: "atk4", roll: 0.8 },
      { id: "hp4", roll: 0.6 },
      { id: "def4", roll: 0.6 },
    ],
  }));
  inv.items.forEach((it, i) => inv.equip(it.uid, SLOTS[i]!));
  const endgame = useEndgameStore();
  endgame.daoPath = "sword";
  endgame.addDaoSource(5000);
}

const world = (id: string) => CELESTIAL_WORLDS.find((w) => w.id === id)!;

beforeEach(() => setActivePinia(createPinia()));

describe("远征 · 账目", () => {
  it("出发扣的道源,正是这一界写着的入界价", () => {
    seated(9, MORTAL_TOP, "heaven", 20);
    const eg = useEndgameStore();
    const before = eg.daoSource;
    const chiyan = world("chiyan");
    const outcome = startWorldExpedition(chiyan.id, null);
    expect(outcome, "这一界开不起来(门槛或道源)").not.toBeNull();
    expect(before - eg.daoSource, "扣的道源与入界价对不上").toBe(chiyan.entryCost);
    expect(eg.worldRun?.worldId, "上路了却没记在 store 里").toBe(chiyan.id);
  });

  it("道源不足时不开船,也不记账", () => {
    seated(9, MORTAL_TOP, "heaven", 20);
    const eg = useEndgameStore();
    eg.daoSource = 1; // 连一界都进不去
    expect(startWorldExpedition("chiyan", null)).toBeNull();
    expect(eg.worldRun).toBeNull();
    expect(eg.daoSource, "不开船还扣了道源").toBe(1);
  });
});

describe("远征 · 梯子(锚点定标:该境界的人才打得动)", () => {
  const rate = (
    major: number,
    tpls: string[],
    quality: EquipmentInstance["quality"],
    tier: number,
    worldId: string,
  ): number => {
    setActivePinia(createPinia());
    seated(major, tpls, quality, tier);
    const f = forecastExpedition(worldId, null)!;
    // 星级是分档的,直接换算回可比较的量:★ 越多越有把握
    return f.stars.split("").filter((c) => c === "★").length;
  };

  it("真仙带一身人间界顶配,赤炎天可打;到不了无相天", () => {
    const chiyan = rate(9, MORTAL_TOP, "heaven", 20, "chiyan");
    const wuxiang = rate(9, MORTAL_TOP, "heaven", 20, "wuxiang");
    console.log(`\n真仙:赤炎天 ${"★".repeat(chiyan)} · 无相天 ${"★".repeat(wuxiang)}`);
    expect(chiyan, "真仙打不动赤炎天 —— 第一重天界就没人能进").toBeGreaterThanOrEqual(3);
    expect(wuxiang, "真仙也能闯无相天 —— 阶梯不存在了").toBeLessThan(chiyan);
  });

  it("混沌道祖带一身混沌海顶配,无相天可打", () => {
    const wuxiang = rate(20, CHAOS_TOP, "divine", 32, "wuxiang");
    console.log(`混沌道祖:无相天 ${"★".repeat(wuxiang)}`);
    expect(wuxiang, "走到阶梯尽头却打不动最后一界").toBeGreaterThanOrEqual(3);
  });

  it("同一境界下,装备越好越有把握(基础三维作数)", () => {
    /**
     * 选一对**没有两端饱和**的:真仙打赤炎天(锚在玄仙,本就是压着打),
     * 裸装够呛、披挂能打。若拿道祖打无相天来比,两边都是五星(顶格),
     * 这条判据就量不出东西了 —— 不是属性不作数,是刻度用完了。
     */
    const bare = rate(9, [], "heaven", 20, "chiyan");
    const geared = rate(9, MORTAL_TOP, "heaven", 20, "chiyan");
    console.log(
      `真仙打赤炎天:裸装 ${"★".repeat(bare) || "无"} → 一身人间界顶配 ${"★".repeat(geared)}`,
    );
    expect(geared, "换了更好的装备,胜算却没变 —— 基础属性又不作数了").toBeGreaterThan(bare);
  });
});

describe("远征 · 判定看得见", () => {
  it("战前预估给出道之理解与境界压制,且与判定函数同源", () => {
    seated(9, MORTAL_TOP, "heaven", 20);
    const chiyan = world("chiyan");
    const f = forecastExpedition(chiyan.id, null)!;
    const player = usePlayerStore();
    expect(f.judgementLines, "预估里没有判定文案").toEqual(
      celestialJudgementLines(player.celestialStats.mods, player.major, chiyan.anchorTier),
    );
    // 真仙去打锚在高一境的界,该有境界压制那一句
    expect(f.judgementLines.join("\n"), "低于锚点境界却没提境界压制").toContain("境界压制");
  });

  it("打得过的一次不该有判定文案(没有判定就不占字数)", () => {
    seated(20, CHAOS_TOP, "divine", 32);
    const chiyan = world("chiyan");
    const f = forecastExpedition(chiyan.id, null)!;
    expect(f.judgementLines, "道祖打第一重天界还被判定").toEqual([]);
  });

  it("打完一趟,战报带上这一界的判定", () => {
    seated(9, MORTAL_TOP, "heaven", 20);
    const chiyan = world("chiyan");
    // 一路打到终局:入界 → 三层 → 界主(中途败了也算终局)
    let outcome = startWorldExpedition(chiyan.id, null);
    let guard = 0;
    while (outcome && outcome.type === "advance" && guard < 12) {
      guard += 1;
      const run = useEndgameStore().worldRun;
      if (!run) break;
      outcome = run.layer >= 3 ? challengeGuardian() : chooseRouteNode(0);
    }
    expect(outcome, "这趟没走到终局也没败 —— 判据失去对象").not.toBeNull();
    expect(outcome!.type).not.toBe("advance");
    const player = usePlayerStore();
    expect(outcome!.judgementLines, "战报没交代这一战的判定").toEqual(
      celestialJudgementLines(player.celestialStats.mods, player.major, chiyan.anchorTier),
    );
  });
});

describe("远征 · 预估敌源与实战同构", () => {
  it("整程预估的敌序取自路线节点怪,而非世界入口的 world.foes", () => {
    const chiyan = world("chiyan");
    const shapes = expeditionForecastFoes(chiyan);
    // 1 进场 + 每条路线首个节点怪 + 1 门神 = 1+3+1 = 5 场
    expect(shapes.map((s) => s.name)).toEqual([
      "赤炎狱卒", // 进场 world.foes[0]
      "狱火统领", // 路线 0 节点 0
      "焚天巨魔", // 路线 1 节点 0
      "天火使者", // 路线 2 节点 0
      "赤炎天主", // 界主
    ]);
    // 第 2~4 场各来自各自路线的首个节点怪(不是把入口怪循环充数)
    expect(shapes[1]!.name).toBe(chiyan.routes[0]![0]!.foe.name);
    expect(shapes[2]!.name).toBe(chiyan.routes[1]![0]!.foe.name);
    expect(shapes[3]!.name).toBe(chiyan.routes[2]![0]!.foe.name);
    // 至少有一段路线的节点怪与入口怪不同名 —— 只要预估误取了入口怪,这里就会露馅
    const entryNames = new Set(chiyan.foes.map((f) => f.name));
    expect(chiyan.routes.some((r) => !entryNames.has(r[0].foe.name))).toBe(true);
  });

  it("玩家星级预估与可行流派共用同一份敌源(口径一致)", () => {
    const chiyan = world("chiyan");
    const shapes = expeditionForecastFoes(chiyan);
    // 旧实现 `world.foes[i % len]` 会把入口怪循环进第 2~4 场 —— 守卫钉住:那些场
    // 必须是各自的路线节点怪,不是入口怪重复
    expect(shapes[1]!.name).toBe(chiyan.routes[0]![0]!.foe.name);
    expect(shapes[3]!.name).toBe(chiyan.routes[2]![0]!.foe.name);
  });
});

describe("远征 · 逆命契封印摊开", () => {
  it("逆命契把当前主流派的核心词条转成负向快照(签前能摊开具体封印了谁)", () => {
    setActivePinia(createPinia());
    const player = usePlayerStore();
    player.initCharacter("逆命契自检", { roots: [{ element: "wood", aptitude: 90 }] } as never);
    player.major = 20;
    player.sub = 9;
    const inv = useInventoryStore();
    inv.items = CHAOS_TOP.map((templateId, i): EquipmentInstance => ({
      uid: `x${i}`,
      templateId,
      quality: "divine",
      tier: 32,
      level: 5,
      // shd2 罡罩(shieldOnStart)+ gs2 盾魂(shieldPower):罡盾流的一套确定性勾出
      affixes: [
        { id: "shd2", roll: 1 },
        { id: "gs2", roll: 1 },
      ],
    }));
    inv.items.forEach((it, i) => inv.equip(it.uid, SLOTS[i]!));
    useEndgameStore().daoPath = "sword";
    const build = detectBuild(player.celestialStats.mods)!;
    expect(build.style.id).toBe("gangdun");
    const sealed = sealCoreMods()!;
    expect(sealed, "主流派成形时逆命契不该没有可封印的词条").not.toBeNull();
    // 封印的正是当前流派的核心 stat,且恒为负向(归零成负模快照)
    for (const key of Object.keys(build.style.core)) {
      const cur = player.celestialStats.mods[key as keyof typeof player.celestialStats.mods] ?? 0;
      expect(sealed[key as keyof typeof sealed], `核心词条 ${key} 应被封印为负`).toBe(-cur);
    }
    // 至少封印了一个核心词条 —— 若 detectBuild 认得流派却空手而归,弹窗就摊不出东西
    expect(Object.keys(sealed).length).toBeGreaterThan(0);
  });

  it("没有主流派时逆命契无可封印(不误导玩家有空头封印)", () => {
    seated(9, [], "heaven", 20); // 裸装不成流派
    expect(sealCoreMods()).toBeNull();
  });
});

describe("远征 · 天道变数", () => {
  it("规则池里查不到的变数拒绝应战,且不扣道源(静默少一条规则是难度欺诈)", () => {
    seated(9, MORTAL_TOP, "heaven", 20);
    const eg = useEndgameStore();
    const before = eg.daoSource;
    expect(challengeMutation(["no_such_mutator"]), "未知变数应弹回让玩家重窥探").toBeNull();
    expect(eg.daoSource, "拒绝应战却扣了道源").toBe(before);
  });
});

/**
 * 预估里「几路可行」的**可比性** —— 六个流派必须站在同一条起跑线上。
 *
 * ## 缺口
 *
 * `forecastExpedition` 里原本只有**一个** `seededRng`,依次被这些推演共用:
 * 玩家 8 次 → 六流派各 5 次,一共消耗 38 段随机流。于是第 1 个流派用的是
 * 第 9~13 次随机数、第 6 个用第 33~37 次 —— **不同流派拿到的随机数不一样**。
 *
 * 「几路可行」正是玩家判断「我这个构筑打不打得动」的依据之一,
 * 而它里面混进了一层与构筑无关的偏差:流派在列表里的位置会影响它拿到什么运气。
 * 更麻烦的是它**看起来完全正常** —— 数字稳定、每次都一样,没有任何异常。
 *
 * ## 判据守什么
 *
 * 一 每条推演组各起独立流:`rngFor(salt)` 按组派生,源码层钉住不再共享一条;
 * 二 行为侧:同一世界同一契约连调两次,结果必须一样(确定性——派生子流也得是确定的);
 * 三 行为侧:六个流派的**顺序**不影响各自的可行判定。这条最接近缺陷本体:
 *     把流派列表倒过来算,同一流派必须给出同一个结论。
 *     共享一条流时它会红(顺序变了 → 分到的随机段变了 → 结论可能翻)。
 */
describe("预估 · 六个流派的推演不许共用一条随机流", () => {
  /**
   * 用文件里已有的 `seated(major, tpls, quality, tier)` 造一个**真打得起**的档。
   *
   * 只设 `major` 是不够的:没有装备与功法时 `celestialStats` 极低,
   * 所有世界都落到「九死一生 / 0 路可行」——那时「契约影响预估」这件事
   * 会被夹具的极端值掩盖(实测:签不签血契结果完全一样)。
   * 故这条组必须站在与梯子那组同一份满配夹具上。
   */
  const ready = (): void => seated(9, MORTAL_TOP, "heaven", 20);

  it("同一世界同一契约,连调两次结果一样(派生子流仍要确定)", () => {
    ready();
    for (const w of CELESTIAL_WORLDS.slice(0, 3)) {
      for (const pid of [null, "xue", "ji"]) {
        const a = forecastExpedition(w.id, pid);
        const b = forecastExpedition(w.id, pid);
        expect(a, `${w.id}/${pid ?? "无契约"} 第一次就没算出来`).not.toBeNull();
        expect(
          { d: a!.difficulty, s: a!.stars, v: a!.viableStyles },
          `${w.id}/${pid ?? "无契约"} 两次结果不同 —— 预估必须是确定的`,
        ).toEqual({ d: b!.difficulty, s: b!.stars, v: b!.viableStyles });
      }
    }
  });

  it("源码层:每条推演组各起独立流,不再共享一条 seededRng", () => {
    /*
     * 共享一条流时,缺陷的表现是「数字稳定但带一层与构筑无关的偏差」——
     * 行为判据很难抓住它(除非刚好有一格翻档)。故这条直接钉源码形状:
     * 推演必须经 `rngFor(...)` 取流,且六流派循环要带自己的下标。
     */
    const raw = readFileSync(resolve(__dirname, "./expedition.ts"), "utf8");
    const src = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(src, "推演要按组派生独立随机流").toContain("rngFor");
    expect(src, "六个流派要各用自己的子流").toMatch(
      /for \(const \[pi, profile\] of BUILD_PROFILES/,
    );
    expect(src, "流派推演要用 styleRng").toContain("styleRng");
    expect(src, "又退回共享一条流了 —— 流派在列表里的位置会影响它分到哪段随机数").not.toMatch(
      /const seededRng = new RandomService/,
    );
  });

  it("换契约要真的影响预估 —— 否则它读的不是同一场仗", () => {
    /*
     * 反向守住「作用面」:上面两条都在说可比性,这条说预估还认契约。
     * 若某次重构让契约不再进 `rules`,上面两条照样绿而这一条会红。
     */
    ready();
    const w = CELESTIAL_WORLDS[0]!;
    const none = forecastExpedition(w.id, null)!;
    // 血契「一切治疗无效」是最重的代价之一,理应把可行数或星级压低或至少不同
    const xue = forecastExpedition(w.id, "xue")!;
    const same = none.difficulty === xue.difficulty && none.stars === xue.stars;
    const sameViable = none.viableStyles === xue.viableStyles;
    expect(
      same && sameViable,
      `赤炎天:签血契与不签的预估完全一样(difficulty=${none.difficulty} stars=${none.stars} viable=${none.viableStyles})` +
        " —— 契约没进预估,玩家没法据它做选择",
    ).toBe(false);
  });
});

/**
 * 远征自己建的战果行,必须带足**战后归因**要的东西。
 *
 * ## 缺口
 *
 * 天界战报浮层的「此战之判」有两类行:战前判定(道之理解 / 境界压制)与
 * **战后归因**(`analyzeBattle`)。后者要 `CombatResult.stats`(遥测),
 * 没有就返回 null,那一章永远只有战前行。
 *
 * 试炼与天道变数走 `runGauntlet`,它的行天然带 `stats` —— 所以第 8 轮接归因时
 * 那两条路一验就过。**而远征这条自己建行**:
 *
 * ```ts
 * const row = { foeName, win, rounds, hpLeftPct };   // 只有这四个
 * ```
 *
 * 于是远征(天界最主要的玩法)的「此战之判」永远没有战后归因,
 * 而这件事**没有任何东西会报错**:类型上 `StepOutcome.row` 也手写了一份
 * 同样窄的形状,两边对齐得很整齐 —— 整齐地一起错。
 *
 * ## 判据守什么
 *
 * 一 远征首战的战果行必须带 `stats` 与 `foe`(行为侧,真开一趟);
 * 二 拿这一行真能算出归因(读不出就红);
 * 三 **源码层**:行形状只有一处定义(`FightOutcomeRow`),不许再手写窄形状 ——
 *    手写多份的代价是静默的,谁也不会报错,只是某些字段悄悄不存在。
 */
describe("远征 · 战果行要够战后归因用", () => {
  it("首战的行带遥测与敌人快照", () => {
    seated(9, MORTAL_TOP, "heaven", 20);
    const world = CELESTIAL_WORLDS[0]!;
    startWorldExpedition(world.id, null, null);
    const rows = useEndgameStore().worldRun?.rows ?? [];
    expect(rows.length, "开了一趟却没留下战果行").toBeGreaterThan(0);
    const row = rows[0]!;
    expect(row.stats, "行里没有遥测 —— 战后归因(analyzeBattle)会直接返回 null").toBeDefined();
    expect(row.stats!.player, "玩家侧统计缺了").toBeDefined();
    // 真打过就该有数
    expect(
      row.stats!.player.hitsLanded + row.stats!.player.missedHits,
      "遥测是空的 —— 有字段但没内容",
    ).toBeGreaterThan(0);
    expect(row.foe, "行里没有敌人快照 —— 归因读不到 origin(道之理解 / 境界压制)").toBeDefined();
  });

  it("拿这一行真能算出归因", () => {
    /*
     * 只核「字段存在」会漏掉「字段在但内容对不上」。
     * 这里走一遍真实调用:归因必须至少给出一条。
     */
    seated(9, MORTAL_TOP, "heaven", 20);
    startWorldExpedition(CELESTIAL_WORLDS[0]!.id, null, null);
    const row = useEndgameStore().worldRun?.rows[0];
    expect(row).toBeDefined();
    const analysis = analyzeBattle(
      {
        win: row!.win,
        rounds: row!.rounds,
        playerHpPct: row!.hpLeftPct,
        log: [],
        foeOrigin: row!.foe?.origin,
        stats: row!.stats!,
      },
      null,
    );
    expect(analysis, "这一行算不出归因 —— 天界「此战之判」又会只剩战前行").not.toBeNull();
    expect(analysis!.findings.length, "归因一条都没给").toBeGreaterThan(0);
  });

  it("战果行形状只有一处定义,不许再手写窄形状", () => {
    /*
     * 源码层:这个形状此前被手写了三遍(`GauntletFightRow` / `StepOutcome.row` /
     * `WorldRunState.rows`),三份都只有前四个字段。现在统一成 `types` 里的
     * `FightOutcomeRow`,`core/gauntlet` 反过来引用它。
     *
     * 判据盯住那条「手写四个字段」的字面 —— 它一旦在别处重现,就是又分了一份账。
     */
    /*
     * 只查「消费方」—— `types/index` 是形状的正规定义处,它当然要写出这四个字段。
     */
    const files = [resolve(__dirname, "./expedition.ts"), resolve(__dirname, "./gauntlet.ts")];
    const offenders: string[] = [];
    for (const file of files) {
      const raw = readFileSync(file, "utf8");
      const src = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      // 单行内联写出这四个字段 = 又手写了一份窄形状
      if (
        /foeName:\s*string;\s*win:\s*boolean;\s*rounds:\s*number;\s*hpLeftPct:\s*number/.test(src)
      ) {
        offenders.push(file.replace(/^.*\/src\//, "src/"));
      }
    }
    expect(
      offenders,
      "这些文件又手写了一份战果行窄形状 —— 手写多份的代价是静默的:" + offenders.join("、"),
    ).toEqual([]);
    // 防空转:共享形状必须真的在 types 里
    const typesSrc = readFileSync(resolve(__dirname, "../types/index.ts"), "utf8");
    expect(typesSrc, "共享形状没提到类型层").toContain("export interface FightOutcomeRow");
  });
});

/**
 * 「战果行」这个形状**只许有一处定义**。
 *
 * ## 这是第几份了
 *
 * 它先后被手写了四遍,每一份都只写自己以为需要的字段:
 *
 * | 位置 | 缺了什么 | 后果 |
 * | --- | --- | --- |
 * | `core/gauntlet.GauntletFightRow` | —(最全的一份) | 无 |
 * | `core/expedition.StepOutcome.row` | `foe` `stats` | 远征归因永远空 |
 * | `types.WorldRunState.rows` | `foe` `stats` | 同上 |
 * | `components/celestial/reportView.rows` | `atkRamp` | 天界战报读不到敌势渐涨 |
 *
 * **手写多份的代价始终是同一个:谁也不会报错,只是某些字段悄悄不存在。**
 * 前两份拼在一起,让「此战之判」的战后归因空了整整八轮才被发现;
 * 第三份让第 6 轮加的 `atkRamp` 读数在天界浮层上一直读不到。
 *
 * ## 判据
 *
 * 扫全仓源码(排除 spec),凡是在**内联对象类型**里同时写出
 * `foeName` / `win` / `rounds` / `hpLeftPct` 四个字段的,都算又分了一份账。
 * 唯一允许的落点是 `types.FightOutcomeRow` 本身,故扫描时把它排除。
 */
describe("战果行 · 形状只许有一处定义", () => {
  it("除类型层那处定义外,不许再有内联的四字段形状", () => {
    const root = resolve(__dirname, "../..");
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = resolve(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === "node_modules" || entry.name === "dist") continue;
          walk(full);
          continue;
        }
        if (!/\.(ts|vue)$/.test(entry.name) || entry.name.endsWith(".spec.ts")) continue;
        const raw = readFileSync(full, "utf8");
        const src = raw
          .replace(/<!--[\s\S]*?-->/g, "")
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/^\s*\/\/.*$/gm, "");
        /*
         * 判据只认**类型注解**(`foeName: string;`),不认赋值(`foeName: foe.name,`)——
         * 赋值处本来就该出现这些字段名,那是数据流,不是又分了一份类型。
         * 这也正是手写窄形状的定义:有人把「这几个字段各是什么类型」又抄了一遍。
         */
        const m =
          /foeName\s*:\s*string[\s\S]{0,240}?win\s*:\s*boolean[\s\S]{0,240}?rounds\s*:\s*number[\s\S]{0,240}?hpLeftPct\s*:\s*number/.exec(
            src,
          );
        if (!m) continue;
        // 类型层的正规定义处放行
        if (full.endsWith("/types/index.ts") && m.index >= src.indexOf("FightOutcomeRow")) continue;
        offenders.push(full.replace(root + "/", ""));
      }
    };
    walk(resolve(root, "src"));
    expect(
      offenders,
      "这些文件又手写了一份战果行形状 —— 手写多份的代价是静默的(某些字段悄悄不存在):" +
        offenders.join("、"),
    ).toEqual([]);
  });
});

/**
 * 战报浮层要读得到 `atkRamp` —— 统一形状顺带修好的第二处遗漏。
 *
 * ## 断在哪
 *
 * 第 6 轮给 `CombatResult.atkRamp` 做了读数,`GauntletPanel` 也写好了渲染
 * (`data-fight-atk-ramp`)。但那个面板的 `rows` 来自 `ReportView.rows`,
 * 而 `ReportView.rows` 是**手写的第三份战果行形状** —— 它没有 `atkRamp` 字段。
 *
 * 于是:数据在 `CombatResult` 里算出来了,`gauntlet` 与 `expedition` 也都带上了,
 * **到了浮层那一层被类型挡掉**。`GauntletPanel` 的 `row.atkRamp` 永远 undefined,
 * 「敌势渐涨」那一行 forever 不出现 —— 而没有任何东西会报错。
 *
 * 手写多份形状的代价又演示了一遍:第一份缺 `stats` 让归因空了八轮,
 * 第三份缺 `atkRamp` 让读数一次都没显示过。
 *
 * ## 判据
 *
 * 一 `ReportView.rows` 必须引用共享形状(不许再手写);
 * 二 链路三处都要带 `atkRamp`:`CombatResult` → `GauntletFightRow` → `ReportView.rows`
 *    (前两处已有判据,这里补最后一跳)。
 */
describe("战报浮层 · atkRamp 要读得到", () => {
  it("ReportView.rows 引用共享形状,不手写", () => {
    const src = readFileSync(
      resolve(__dirname, "../components/celestial/reportView.ts"),
      "utf8",
    ).replace(/\/\*[\s\S]*?\*\//g, "");
    expect(src, "ReportView.rows 该引用 FightOutcomeRow").toMatch(/rows:\s*FightOutcomeRow\[\]/);
    expect(
      src,
      "ReportView.rows 又手写了内联形状 —— 手写的那几份各自缺字段,缺过 stats 也缺过 atkRamp",
    ).not.toMatch(/rows:\s*\{\s*foeName/);
  });

  it("共享形状里有 atkRamp,且面板读的就是它", () => {
    const types = readFileSync(resolve(__dirname, "../types/index.ts"), "utf8");
    expect(types, "共享形状缺 atkRamp —— 浮层那一行又会永远不出现").toMatch(
      /atkRamp\?:\s*\{\s*procs:\s*number;\s*factor:\s*number\s*\}/,
    );
    const panel = readFileSync(
      resolve(__dirname, "../components/celestial/GauntletPanel.vue"),
      "utf8",
    ).replace(/<!--[\s\S]*?-->/g, "");
    expect(panel, "面板该读 atkRamp").toContain("atkRamp");
    expect(panel, "面板该有落点").toContain("data-fight-atk-ramp");
  });
});
