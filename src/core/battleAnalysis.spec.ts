import { describe, expect, it } from "vite-plus/test";
import type { CombatResult, CombatSideStats } from "@/types";
import { gn, gnZero } from "@/utils/gnum";
import { analyzeBattle, battleDataRows } from "./battleAnalysis";
import { runGauntlet } from "./gauntlet";
import { BUILD_PROFILES, buildSnap } from "./buildSim";
import { RandomService, mulberry32 } from "@/utils/random";
import { celestialFoeOrigin, celestialJudgement } from "./gauntlet";
import { BUILD_STYLES } from "./buildDetect";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function stats(partial: Partial<CombatSideStats>): CombatSideStats {
  return {
    dealt: gn(1000),
    taken: gn(2000),
    pierceTaken: gnZero(),
    biggestHitTaken: gn(100),
    healed: gnZero(),
    shieldAbsorbed: gnZero(),
    dodges: 0,
    missedHits: 0,
    hitsLanded: 20,
    counters: 0,
    combos: 0,
    crits: 2,
    skillCasts: 3,
    artifactProcs: 1,
    stunnedTurns: 0,
    ...partial,
  };
}

function result(win: boolean, player: CombatSideStats, rounds = 20): CombatResult {
  return { win, rounds, playerHpPct: win ? 0.6 : 0, log: [], stats: { player, enemy: stats({}) } };
}

describe("战斗分析", () => {
  it("无遥测的旧战报返回 null(向后兼容)", () => {
    expect(analyzeBattle({ win: false, rounds: 10, playerHpPct: 0, log: [] }, null)).toBeNull();
  });

  it("胜利不找茬 —— 不指责、也不劝你换打法", () => {
    /*
     * 这条原本断言 `findings.length === 0`,写的是当时「胜利不做归因」的实现。
     * 那个实现留下了缺口:界面早就铺好了 findings / directions 两段渲染,
     * 胜利时却永远是空的 —— 玩家赢了只看到一句「此战 N 回合而胜」,
     * 而赢了正是最该学到东西的一刻(战败时玩家自己会去翻原因,胜利时没这个动机)。
     *
     * 故胜利现在**会**给归因,但约束没变、而且更清楚了:
     *   · 不指责:不出现「落空」「乏力」「不是办法」这类败局措辞;
     *   · 不劝换:方向建议只属于败局 —— 硬推一条等于劝玩家换掉刚赢下来的打法;
     *   · 数据行照旧要够(那是归因的依据)。
     * 这条夹具的读数很平(气血 0.6 / 20 回合 / 无闪避无暴击),归因不会凭空多出来。
     */
    const a = analyzeBattle(result(true, stats({})), "gangdun")!;
    expect(a.directions.length, "胜局不给方向建议").toBe(0);
    expect(a.dataRows.length).toBeGreaterThan(5);
    const joined = a.findings.map((f) => f.text).join(" | ");
    for (const blame of ["落空", "乏力", "不是办法", "无以为继", "难以衔接"]) {
      expect(joined, `胜局归因里出现了败局措辞(«${blame}»)—— 赢了不找茬`).not.toContain(blame);
    }
  });

  it("真伤致败被点名,并指向不依赖护盾的方向", () => {
    const a = analyzeBattle(result(false, stats({ pierceTaken: gn(1200) })), "gangdun")!;
    expect(a.findings.some((f) => f.text.includes("真伤"))).toBe(true);
    // 方向不包含当前流派
    expect(a.directions.every((d) => d.styleName !== "罡盾流")).toBe(true);
    expect(a.directions.length).toBeGreaterThan(0);
  });

  it("高落空率触发命中告警", () => {
    const a = analyzeBattle(result(false, stats({ missedHits: 12, hitsLanded: 18 })), "lianji")!;
    expect(a.findings.some((f) => f.text.includes("落空"))).toBe(true);
  });

  it("重锤一击与久战乏力都能识别", () => {
    const big = analyzeBattle(result(false, stats({ biggestHitTaken: gn(900) })), null)!;
    expect(big.findings.some((f) => f.text.includes("重击"))).toBe(true);
    const long = analyzeBattle(result(false, stats({}), 40), null)!;
    expect(long.findings.some((f) => f.text.includes("回合"))).toBe(true);
  });

  it("无明显短板时给出兜底解释", () => {
    const a = analyzeBattle(result(false, stats({ healed: gn(600) }), 10), null)!;
    expect(a.findings.length).toBe(1);
    expect(a.findings[0]!.text.includes("道行")).toBe(true);
  });

  it("数据面板行完整", () => {
    const rows = battleDataRows(result(true, stats({})));
    expect(rows.map((r) => r.label)).toContain("真伤承伤占比");
    expect(rows.map((r) => r.label)).toContain("护盾吸收");
  });

  /**
   * 先手判定是一条阈值,不是连续收益。
   *
   * 从前词条写「出手速度提升 6%」,玩家自然会以为多打一点就多赚一点;真相是
   * 差一点就完全没有。故战后分析要把**两个数与差额**摆出来:既解释「你为什么后手」,
   * 也给出「再凑几个百分点能跨线」——解释原因、给方向,不替玩家做决定。
   */
  describe("先手判定", () => {
    const withFirst = (
      win: boolean,
      playerFirst: boolean,
      ps: number,
      es: number,
    ): CombatResult => ({
      ...result(win, stats({})),
      firstMove: { playerFirst, playerSpeed: ps, enemySpeed: es },
    });

    it("数据行用两个数说话(不再让人对着百分比猜)", () => {
      const rows = battleDataRows(withFirst(true, true, 1.06, 1.05));
      const row = rows.find((r) => r.label === "先手");
      expect(row, "战报里应当有一行先手读数").toBeDefined();
      expect(row!.value).toContain("1.06");
      expect(row!.value).toContain("1.05");
      expect(row!.value).toContain("抢先");
    });

    it("被抢先时给出「还差多少」,而不是笼统说速度不够", () => {
      const a = analyzeBattle(withFirst(false, false, 1.02, 1.1), null)!;
      const hit = a.findings.find((f) => f.text.includes("先手判定"));
      expect(hit, "被抢先应当被点名").toBeDefined();
      expect(hit!.text).toContain("8%");
      expect(hit!.text, "要说清这是一条阈值").toContain("阈值");
    });

    it("抢到了就不唠叨:胜利时不给先手告警", () => {
      const a = analyzeBattle(withFirst(true, true, 1.2, 1.05), null)!;
      expect(a.findings.some((f) => f.text.includes("先手判定"))).toBe(false);
    });

    it("旧战报(没有 firstMove)照常工作", () => {
      const rows = battleDataRows(result(true, stats({})));
      expect(rows.some((r) => r.label === "先手")).toBe(false);
      expect(analyzeBattle(result(false, stats({})), null)).not.toBeNull();
    });
  });
});

/**
 * 「每隔 N 回合」把敌人攻势抬到了几倍 —— 机制在跑,数值此前不带出。
 *
 * `core/combat` 里 `dmg = attack × factor × atkRamp` 真的把 `atkRamp` 乘进了伤害,
 * 而它从来不写进 `CombatResult`。玩家能读到的只有战报里一句
 * 「岁月为你加冕——长生印生效,气血与护盾俱增;敌人杀意亦涨。」——
 * 涨到几倍没有数字。与修好之前的先手判定是同一个形态
 * (那条也是「机制在跑、判定值丢弃」)。
 *
 * 实测那个倍率不小:6 回合的对局触发 3 次 × 每印 +15% = **1.45 倍**,
 * 也就是后半程敌人的每一击都重了一半 —— 而界面上一个字都没提。
 *
 * 判据四条,两侧都量:
 * 一 有这条规则时数据行必须出现,且报的是**倍率与次数**两个数;
 * 二 没有这条规则(或一次都没触发)时**不许**凭空印一行 —— 那等于说了件没发生的事;
 * 三 倍率与 `atkRamp` 同源(改 `enemyAtkGrowth` 文案跟着变);
 * 四 战报里那句重复触发的话要收短,长战不许被同一句淹掉。
 */
describe("每隔 N 回合 · 敌势渐涨的读数", () => {
  const withRamp = (procs: number, factor: number): CombatResult => ({
    ...result(true, stats({})),
    atkRamp: { procs, factor },
  });

  it("有这条规则时给出倍率与次数 —— 不只是「敌人杀意亦涨」", () => {
    const rows = battleDataRows(withRamp(3, 1.45));
    const row = rows.find((r) => r.label === "敌势渐涨");
    expect(row, "战报里应当有一行「敌势渐涨」").toBeDefined();
    expect(row!.value, "要报抬了多少(45%)").toContain("45%");
    expect(row!.value, "要报触发次数").toContain("3");
    expect(row!.value, "要报累计倍率").toContain("1.45");
  });

  it("倍率与 atkRamp 同源 —— 改涨幅,文案跟着变", () => {
    const rows = battleDataRows(withRamp(2, 1.3));
    const row = rows.find((r) => r.label === "敌势渐涨")!;
    expect(row.value).toContain("30%");
    expect(row.value).toContain("1.30");
    // 另一个值也该跟着走,不许写死
    const other = battleDataRows(withRamp(4, 1.6)).find((r) => r.label === "敌势渐涨")!;
    expect(other.value).toContain("60%");
    expect(other.value).toContain("4");
  });

  it("没有这条规则 / 一次没触发时不许凭空印一行", () => {
    // 字段缺席(旧存档、或这一场没有该规则)
    const withoutField = battleDataRows(result(true, stats({})));
    expect(withoutField.some((r) => r.label === "敌势渐涨")).toBe(false);
    // 字段在但一次都没触发:同样不该印
    const zeroProcs = battleDataRows(withRamp(0, 1));
    expect(zeroProcs.some((r) => r.label === "敌势渐涨")).toBe(false);
  });

  it("它排在「战前就定下的数」之后 —— 那是打着打着才变的", () => {
    /*
     * 先手与敌之加成解释「这一场一开始有多难」,敌势渐涨解释「后半程为什么更难」。
     * 两类数混在一起读,玩家会把后者也当成开局条件。
     */
    const rows = battleDataRows({
      ...withRamp(3, 1.45),
      firstMove: { playerFirst: true, playerSpeed: 1, enemySpeed: 1 },
    });
    const firstAt = rows.findIndex((r) => r.label === "先手");
    const rampAt = rows.findIndex((r) => r.label === "敌势渐涨");
    expect(firstAt, "先手行不见了").toBeGreaterThan(-1);
    expect(rampAt, "敌势渐涨行不见了").toBeGreaterThan(-1);
    expect(rampAt, "「渐涨」排在战前判定之前 —— 两类数混了").toBeGreaterThan(firstAt);
  });

  it("core 里战报那句要收短,长战不许被同一句淹掉", () => {
    /*
     * 这条规则在长战里触发七八次。每次都印一整句会把战报淹掉,
     * 而汇总已经由数据行给出 —— 故源码层钉住「第一次给全,之后压短」。
     */
    const raw = readFileSync(resolve(__dirname, "./combat.ts"), "utf8");
    const src = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(src, "要记触发次数").toContain("perRoundsProcs += 1");
    expect(src, "第一次与之后那句要分开").toMatch(
      /perRoundsProcs === 1[\s\S]{0,400}第 \$\{perRoundsProcs\} 次/,
    );
    expect(src, "倍率要带出战斗").toContain(
      "atkRamp: { procs: perRoundsProcs, factor: e.atkRamp }",
    );
  });
});

/**
 * 天界战报面板那一行 —— 与 `battleDataRows` 是两个渲染点,口径必须一致。
 *
 * `battleDataRows` 服务**历练页**的战后分析卡;天界远征的战报走
 * `GauntletPanel` 的逐场回放,那里根本没有分析卡(`analyzeBattle` 只在
 * `BattleIntelPanel` 里被调用,而后者只挂在历练页)。
 *
 * 也就是说:同一条「敌势渐涨」的读数,在天界只能长在战报面板上。
 * 这一组守它真的长上去了,且与 `battleDataRows` 报的是同一件事 ——
 * 两处各写一份格式,迟早有一处先改(本仓「不做两本账」)。
 */
describe("天界战报 · 敌势渐涨那一行", () => {
  const panelSrc = (): string => {
    const raw = readFileSync(
      resolve(__dirname, "../components/celestial/GauntletPanel.vue"),
      "utf8",
    );
    // 去掉注释:注释里引用这段字样是正常的,不该被当成实现
    return raw.replace(/<!--[\s\S]*?-->/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  };

  it("战报面板要有这一行的落点与读数", () => {
    const src = panelSrc();
    expect(src, "天界战报要有一行「敌势渐涨」的落点").toContain("data-fight-atk-ramp");
    expect(src, "要读该场战果里的 atkRamp").toContain("atkRamp");
    expect(src, "要报触发次数").toContain("procs");
  });

  it("没有这条规则时整行不出 —— 不许凭空印", () => {
    const src = panelSrc();
    // 守卫条件必须在模板上(v-if),否则空读数会占一行
    expect(src, "该行要有 v-if 守卫").toMatch(/v-if="atkRampText"/);
    expect(src, "守卫要判 procs > 0").toMatch(/procs\s*<=\s*0\)\s*return/);
  });

  it("两处渲染点报同一件事:增幅走 formatPercent、倍率给两位", () => {
    /*
     * 历练页那行在 `battleAnalysis` 里、天界这行在组件里,格式若各写一套,
     * 同一个数会在两页长得不一样。这条钉住两边都用同一套写法。
     */
    const analysis = readFileSync(resolve(__dirname, "./battleAnalysis.ts"), "utf8");
    for (const [label, src] of [
      ["battleAnalysis", analysis],
      ["GauntletPanel", panelSrc()],
    ] as [string, string][]) {
      expect(src, `${label} 的增幅该走 formatPercent`).toMatch(/formatPercent\(/);
      expect(src, `${label} 该报累计倍率(两位小数)`).toMatch(/toFixed\(2\)/);
      expect(src, `${label} 该报触发次数`).toContain("procs");
    }
  });

  it("源码层:战报行不许手写百分比(与全库同一口径)", () => {
    const src = panelSrc();
    expect(
      src,
      "手写 Math.round(x*100) 与 formatPercent 各写一份迟早分叉(uiLayering.spec 也会红)",
    ).not.toMatch(/Math\.round\([\s\S]{0,60}\* *100\)/);
  });
});

/**
 * 天界「此战之判」：只有战前判定不算判,还要有这一场打出来的归因。
 *
 * ## 缺口
 *
 * 天界战报浮层的第四章「此战之判」,注释写着「为什么难、下一次怎么办」,
 * 而它实际只渲染 `report.judgementLines` —— 那是**战前**就定下的数
 * (道之理解 / 境界压制),回答的是「这一界为什么难」。
 * 而「这一场为什么输、下一次改什么」一个字都没有。
 *
 * 历练页有(`BattleIntelPanel` 的 `analyzeBattle`),天界没有,
 * 而天界正是玩家最难、最需要下一步方向的地方。
 *
 * 卡在哪:`analyzeBattle` 要 `CombatResult.stats`(遥测),而 `GauntletFightRow`
 * 只带了 `logs` 与胜负回合 —— 没有 `stats` 它直接返回 null。故补这条的前提是
 * 把遥测顺着战报递上来。
 *
 * ## 判据守什么
 *
 * 一 战报行必须带遥测,且带出的值与 `resolveCombat` 同源(不是重算一份);
 * 二 面板必须真的把 `analyzeBattle` 接进来 —— 不然数据在、没人读;
 * 三 战前判定与战后归因**两类分开**,不许混成一串:
 *    前者回答「这一界为什么难」,后者回答「这一场为什么输」,难与输不是一件事;
 * 四 遥测与 `logs` 同一条纪律:不许写进持久化结构(道痕)。
 */
describe("天界战报 · 此战之判要有战后归因", () => {
  it("战报行带出遥测,且与 resolveCombat 同一份", () => {
    /*
     * 行为侧:真跑一次 gauntlet,核对行的 stats 与那一场 resolveCombat 的 stats 同源。
     * 只核「字段存在」会漏掉「另算一份」这种走偏。
     */
    const report = runGauntlet(
      buildSnap(BUILD_PROFILES[0]!),
      [
        {
          ...buildSnap(BUILD_PROFILES[0]!),
          isPlayer: false,
          name: "靶",
          attack: gn(1),
          maxHp: gn(1),
        },
      ],
      undefined,
      0,
      new RandomService(mulberry32(11)),
    );
    const row = report.rows[0]!;
    expect(row.stats, "战报行没带遥测 —— analyzeBattle 会直接返回 null").toBeDefined();
    expect(row.stats!.player, "玩家侧统计缺了").toBeDefined();
    expect(row.stats!.enemy, "敌人侧统计缺了").toBeDefined();
    // 真打过就该有数(至少出手次数不为 0)
    expect(row.stats!.player.hitsLanded + row.stats!.player.missedHits).toBeGreaterThan(0);
  });

  it("面板真的把 analyzeBattle 接进来了", () => {
    const src = readFileSync(
      resolve(__dirname, "../components/celestial/CelestialReportLedger.vue"),
      "utf8",
    );
    const code = src.replace(/<!--[\s\S]*?-->/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(code, "面板没接 analyzeBattle —— 数据在、没人读").toContain("analyzeBattle(");
    expect(code, "要读当前场的遥测").toContain("row.stats");
    expect(code, "归因要有落点").toContain("data-celestial-report-finding");
    expect(code, "方向要有落点").toContain("data-celestial-report-direction");
  });

  it("战前判定与战后归因两类分开 —— 难与输不是一件事", () => {
    const src = readFileSync(
      resolve(__dirname, "../components/celestial/CelestialReportLedger.vue"),
      "utf8",
    );
    // 两类行必须各带自己的 class,不许共用一种
    expect(src, "归因行要有自己的样式钩子").toContain("is-finding");
    expect(src, "方向行要有自己的样式钩子").toContain("is-direction");
    // 战前那些行不许被标成归因
    expect(src, "战前判定被标成了归因 —— 两类混了").not.toMatch(
      /judgementLines[\s\S]{0,200}data-celestial-report-finding/,
    );
  });

  it("遥测与 logs 同一条纪律:不许进持久化结构", () => {
    /*
     * `GauntletFightRow.logs` 的注释已经写明「不可写入道痕等持久化结构」——
     * 遥测必须遵守同一条。这条核类型注释里写明了,免得下一个人顺手存进道痕。
     */
    const gauntlet = readFileSync(resolve(__dirname, "./gauntlet.ts"), "utf8");
    const at = gauntlet.indexOf("stats?: { player: CombatSideStats");
    expect(at, "战报行上找不到遥测字段").toBeGreaterThan(-1);
    const doc = gauntlet.slice(Math.max(0, at - 900), at);
    expect(doc, "遥测的持久化约束没写进注释").toMatch(/不可写入道痕|别把它存进任何持久化/);
  });
});

/**
 * 方向要「冲着某条病因」去,不是流派广告。
 *
 * ## 缺口
 *
 * `directions[].reason` 此前直接取流派的固定 `desc` ——「生生不息,久战不衰;惧雷霆一击」。
 * 那是这条流派的**自我介绍**,不是「它为什么能解**你这一场**的困」。
 *
 * 两个后果:
 *
 * 一 **同一句话在不同败局里出现两次**。被真伤打穿与被人多打两下,界面都会推荐
 *    沐泽流,配同一句 desc —— 玩家读完仍不知道这条建议是冲着什么来的;
 * 二 **天界的方向栏几乎永远是空的**。`foeOriginFinding`(天界败局最常见的归因)的
 *    `styleHints` 是空数组,而界面把方向单独成一段(标题「可借力的方向(非唯一解)」);
 *    天界那句劝告(「换个方向而非继续堆,或再破一境」)只是被拼进了**病因**正文,
 *    于是玩家读到一句劝告,却没有「这是劝告」的标签。
 *
 * ## 判据守什么
 *
 * 一 每条方向都要引用**触发它的那条归因**原文,不只给流派 desc;
 * 二 两类不同败局给出的方向要**带着不同的证据** —— 同一句 desc 不算区分;
 * 三 天界的判定类归因要真的能产出方向(它就是上面第二条那个空的来源)。
 */
describe("方向 · 要说清冲着哪条病因", () => {
  const mkStats = (o: Partial<CombatSideStats> = {}): CombatSideStats => ({
    dealt: gn(1000),
    taken: gn(2000),
    pierceTaken: gnZero(),
    biggestHitTaken: gn(100),
    healed: gnZero(),
    shieldAbsorbed: gnZero(),
    dodges: 0,
    missedHits: 0,
    hitsLanded: 20,
    counters: 0,
    combos: 0,
    crits: 2,
    skillCasts: 3,
    artifactProcs: 0,
    stunnedTurns: 0,
    ...o,
  });

  it("每条方向都引用触发它的归因,不只报流派名与自述", () => {
    const a = analyzeBattle(
      {
        win: false,
        rounds: 12,
        playerHpPct: 0,
        log: [],
        stats: { player: mkStats({ pierceTaken: gn(1500) }), enemy: mkStats() },
      },
      "gangdun",
    )!;
    expect(a.directions.length, "这条败局该给方向").toBeGreaterThan(0);
    for (const d of a.directions) {
      expect(d.reason, `${d.styleName} 的方向没引用任何依据 —— 那是流派广告,不是处方`).toMatch(
        /冲着「.+」去的/,
      );
    }
  });

  it("不同病因给出的方向要带不同证据 —— 同一句 desc 不算区分", () => {
    /*
     * 这条是缺陷本体:改前两类败局的方向 reason 完全相同(都只是流派 desc),
     * 玩家分不出建议是不是冲着同一个原因。改后证据必须不同。
     */
    const pierce = analyzeBattle(
      {
        win: false,
        rounds: 12,
        playerHpPct: 0,
        log: [],
        stats: { player: mkStats({ pierceTaken: gn(1500) }), enemy: mkStats() },
      },
      "gangdun",
    )!;
    /*
     * 当前流派用 `beishui`:震慑那条告警只推罡盾流,而罡盾正是被「排除当前主流派」
     * 规则滤掉的那一个 —— 用 gangdun 会得到空方向,那是正确行为,不是缺陷。
     */
    const stun = analyzeBattle(
      {
        win: false,
        rounds: 12,
        playerHpPct: 0,
        log: [],
        stats: { player: mkStats({ stunnedTurns: 5 }), enemy: mkStats() },
      },
      "beishui",
    )!;
    const ev = (x: typeof pierce): string[] =>
      x.directions.map((d) => /冲着「(.+)」去的/.exec(d.reason)?.[1] ?? "");
    const pierceEv = ev(pierce).filter(Boolean);
    const stunEv = ev(stun).filter(Boolean);
    expect(pierceEv.length, "真伤败局没给出引用依据").toBeGreaterThan(0);
    expect(stunEv.length, "震慑败局没给出引用依据").toBeGreaterThan(0);
    expect(
      pierceEv.some((e) => stunEv.includes(e)),
      `两种不同病因引用了同一句依据(${pierceEv.join(" / ")}) —— 方向没跟着病因走`,
    ).toBe(false);
  });

  it("天界的判定类归因要能产出方向(方向栏此前在天界几乎永远空)", () => {
    /*
     * `foeOriginFinding` 是天界败局最常见的归因,而它的 `styleHints` 曾是空数组 ——
     * 于是「可借力的方向」那一栏在天界场景下永远是空的。
     */
    const heavy = { attackPct: 3, maxHpPct: 3, defensePct: 3 };
    const a = analyzeBattle(
      {
        win: false,
        rounds: 12,
        playerHpPct: 0,
        log: [],
        foeOrigin: celestialFoeOrigin(celestialJudgement(heavy as never, 9, 25)),
        stats: { player: mkStats(), enemy: mkStats() },
      },
      "gangdun",
    )!;
    expect(
      a.directions.length,
      "天界判定类败局没有给出任何方向 —— 「下一次怎么办」那一栏又是空的",
    ).toBeGreaterThan(0);
  });
});

/**
 * 闪避与被震慑是**事实读数**,不该只活在某条归因的触发条件后面。
 *
 * ## 缺口
 *
 * `CombatSideStats.dodges` 与 `stunnedTurns` 此前在界面上只有两条路能读到:
 * 胜局归因里 `dodges >= 3` 才会说「闪过 N 次」,败局告警里 `stunnedTurns >= 3`
 * 才会说「N 个回合被震慑打断」。于是 **1~2 次这两个数在任何地方都读不到**。
 *
 * 实测震慑并不罕见:六种构筑 × 三个带震慑的敌人 × 四档强度共 360 局,
 * **33% 的对局有震慑**;而 101 场**胜局**里有 61 场被打断过 ——
 * 六成胜局里玩家挨了震慑却一个字都看不到(败局告警只在败局出)。
 *
 * 判据守两件:
 * 一 不管次数多少,这一行都要在(它和「总输出 / 总承伤」同一层级);
 * 二 值要与遥测同源 —— 改一个数,文案跟着变。
 */
describe("数据行 · 闪避与被震慑不许只活在阈值后面", () => {
  const mkStats = (o: Partial<CombatSideStats> = {}): CombatSideStats => ({
    dealt: gn(1000),
    taken: gn(2000),
    pierceTaken: gnZero(),
    biggestHitTaken: gn(100),
    healed: gnZero(),
    shieldAbsorbed: gnZero(),
    dodges: 0,
    missedHits: 0,
    hitsLanded: 20,
    counters: 0,
    combos: 0,
    crits: 2,
    skillCasts: 3,
    artifactProcs: 0,
    stunnedTurns: 0,
    ...o,
  });

  it("1 次闪避、1 次被打断也要出现在数据行里", () => {
    /*
     * 这一条正是缺陷本体:改前 1~2 次两个阈值都够不着,
     * 于是这个读数在胜局与败局里都不出现。
     */
    const rows = battleDataRows({
      win: true,
      rounds: 8,
      playerHpPct: 0.6,
      log: [],
      stats: { player: mkStats({ dodges: 1, stunnedTurns: 1 }), enemy: mkStats() },
    });
    const row = rows.find((r) => r.label === "闪过 / 被打断");
    expect(row, "数据行里没有闪避与被震慑的读数 —— 1~2 次时哪都看不见").toBeDefined();
    expect(row!.value).toContain("1");
  });

  it("两个数与遥测同源 —— 改一个数,文案跟着变", () => {
    const rows = battleDataRows({
      win: false,
      rounds: 8,
      playerHpPct: 0,
      log: [],
      stats: { player: mkStats({ dodges: 4, stunnedTurns: 7 }), enemy: mkStats() },
    });
    const row = rows.find((r) => r.label === "闪过 / 被打断")!;
    expect(row.value, "闪避数没跟遥测").toContain("4");
    expect(row.value, "被震慑数没跟遥测").toContain("7");
  });

  it("胜局也要有这一行 —— 败局告警不覆盖胜局", () => {
    /*
     * 震慑的旧归因只在 `defeatFindings` 里,胜局走的是 `victoryFindings` ——
     * 那条路完全不看 `stunnedTurns`。实测六成胜局被打断过,却一个字都没有。
     */
    const win = battleDataRows({
      win: true,
      rounds: 9,
      playerHpPct: 0.8,
      log: [],
      stats: { player: mkStats({ stunnedTurns: 5 }), enemy: mkStats() },
    });
    expect(
      win.some((r) => r.label === "闪过 / 被打断"),
      "胜局没有闪避/被打断这一行 —— 六成胜局里玩家看不到自己被打断了几次",
    ).toBe(true);
  });
});

/**
 * 「一次手都没出过」那个分支不许按行号硬切。
 *
 * ## 缺口
 *
 * `battleDataRows` 末尾原本写着 `if (attempts === 0) return rows.slice(0, 6)`。
 * 意图是好的:被活活打死的那一场,「命中 / 落空」「暴击 / 连击 / 反击」
 * 「神通 / 法宝触发」必然是 0/0/0,报这些计数只是噪音。
 *
 * 但它按**行号**切,依赖「前 6 行恰好是那些该留的行」这个隐式事实。
 * 后来在列表末尾加了「闪过 / 被打断」—— 纯挨打时这一行被一起切掉了,
 * **而那正是最该看见它的场合**:你闪了几下、被打断几回合,
 * 直接决定下一场要不要堆命中或抗性。
 *
 * 判据两件:纯挨打时闪避/被打断必须在;而该被省掉的那三行仍不出现
 * (别为了修这个把噪音也放回来)。
 */
describe("数据行 · 没出过手时不许按行号硬切", () => {
  const noAttempts = (o: Partial<CombatSideStats> = {}): CombatSideStats => ({
    dealt: gn(1000),
    taken: gn(2000),
    pierceTaken: gnZero(),
    biggestHitTaken: gn(100),
    healed: gnZero(),
    shieldAbsorbed: gnZero(),
    dodges: 3,
    missedHits: 0,
    hitsLanded: 0,
    counters: 0,
    combos: 0,
    crits: 0,
    skillCasts: 0,
    artifactProcs: 0,
    stunnedTurns: 4,
    ...o,
  });

  it("被活活打死那场也要报闪避与被震慑", () => {
    const rows = battleDataRows({
      win: false,
      rounds: 5,
      playerHpPct: 0,
      log: [],
      stats: { player: noAttempts(), enemy: noAttempts() },
    });
    const row = rows.find((r) => r.label === "闪过 / 被打断");
    expect(row, "纯挨打时闪避/被打断被切掉了 —— 那正是最该看见它的场合").toBeDefined();
    expect(row!.value).toContain("3");
    expect(row!.value).toContain("4");
  });

  it("该省掉的 0/0/0 计数仍要省掉 —— 修上面那条不是把噪音放回来", () => {
    const rows = battleDataRows({
      win: false,
      rounds: 5,
      playerHpPct: 0,
      log: [],
      stats: { player: noAttempts(), enemy: noAttempts() },
    });
    for (const noisy of ["命中 / 落空", "暴击 / 连击 / 反击", "神通 / 法宝触发"]) {
      expect(
        rows.some((r) => r.label === noisy),
        `纯挨打时仍报了「${noisy}」—— 那一场这些计数必然是 0,只是噪音`,
      ).toBe(false);
    }
  });

  it("有出手时三行计数照常都在", () => {
    const rows = battleDataRows({
      win: true,
      rounds: 8,
      playerHpPct: 0.5,
      log: [],
      stats: { player: noAttempts({ hitsLanded: 12 }), enemy: noAttempts() },
    });
    for (const label of ["命中 / 落空", "暴击 / 连击 / 反击", "神通 / 法宝触发"]) {
      expect(
        rows.some((r) => r.label === label),
        `有出手时缺了「${label}」`,
      ).toBe(true);
    }
  });
});

/**
 * 流派 id 必须是**真实存在**的那六个 —— 曾经有三个 `"cangfeng"` 一路活到线上。
 *
 * ## 缺陷
 *
 * `AnalysisFinding.styleHints` 声明成 `string[]`,`BuildStyleDef.id` 也是 `string`。
 * 于是 `battleAnalysis` 里三处 `styleHints: ["cangfeng"]` 编译通过 ——
 * 而 `cangfeng`(藏锋)从来不是流派之一:`BUILD_STYLES` 只有六个
 * (beishui / gangdun / fanzhen / lianji / muze / fengmang)。
 *
 * 它没炸,靠的是一个巧合:那三处都在 `victoryFindings` 里,而胜局的 `directions`
 * 恒为 `[]`(见调用处注释:方向属于败局)。一旦有人让胜局也给方向,
 * `BUILD_STYLES.find(...)!.name` 就会在 `undefined` 上抛错 —— 那个 `!` 是谎。
 *
 * ## 判据守什么
 *
 * 一 **编译期**:`styleHints` 的类型是 `BuildStyleId`(联合类型),
 *    写一个不存在的 id 过不了 `tsc`。这条由类型系统守,判据断言它的存在;
 * 二 **运行期**:所有 `styleHints` 里的 id 都能在 `BUILD_STYLES` 里找到;
 * 三 **死数据**:胜局路径不许填 `styleHints` —— 填了也不读,只会误导下一个人。
 */
describe("流派 id · 指向的必须是真存在的流派", () => {
  it("每个 styleHints 里的 id 都能在 BUILD_STYLES 找到", () => {
    /*
     * 行为侧:把能触发各类归因的遥测都造一遍,收集实际出现的 hint。
     * 这比读源码稳 —— 它验的是「跑起来之后指向的东西存在」。
     */
    const seen = new Set<string>();
    const collect = (r: Parameters<typeof analyzeBattle>[0]): void => {
      const a = analyzeBattle(r, null);
      for (const f of a?.findings ?? []) for (const h of f.styleHints) seen.add(h);
    };
    const st = (o: Partial<CombatSideStats> = {}): CombatSideStats => ({
      dealt: gn(1000),
      taken: gn(2000),
      pierceTaken: gnZero(),
      biggestHitTaken: gn(100),
      healed: gnZero(),
      shieldAbsorbed: gnZero(),
      dodges: 0,
      missedHits: 0,
      hitsLanded: 20,
      counters: 0,
      combos: 0,
      crits: 0,
      skillCasts: 3,
      artifactProcs: 0,
      stunnedTurns: 0,
      ...o,
    });
    // 败局:真伤 / 落空 / 重击 / 长战 / 震慑
    collect({
      win: false,
      rounds: 40,
      playerHpPct: 0,
      log: [],
      stats: {
        player: st({
          pierceTaken: gn(1500),
          missedHits: 9,
          biggestHitTaken: gn(900),
          stunnedTurns: 4,
        }),
        enemy: st(),
      },
    });
    // 胜局:完胜 / 速杀 / 闪避 / 暴击
    collect({
      win: true,
      rounds: 3,
      playerHpPct: 0.9,
      log: [],
      stats: { player: st({ dodges: 6, crits: 9 }), enemy: st() },
    });

    expect(seen.size, "一条 hint 都没收到 —— 判据会空转").toBeGreaterThan(0);
    const valid = new Set<string>(BUILD_STYLES.map((s) => s.id));
    const unknown = [...seen].filter((id) => !valid.has(id));
    expect(
      unknown,
      `这些流派 id 在 BUILD_STYLES 里不存在 —— 一旦有代码去 find(...)!.name 就会崩:${unknown.join(", ")}`,
    ).toEqual([]);
  });

  it("类型层:styleHints 不许是宽 string[]", () => {
    /*
     * 源码层钉住类型的收窄。这条看着像「测类型」,但它守的是一个真实事故:
     * 宽类型让三个不存在的 id 活了很久。放宽回 `string[]` 会让同类错误再来一次。
     */
    const raw = readFileSync(resolve(__dirname, "./battleAnalysis.ts"), "utf8");
    const src = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(src, "styleHints 必须声明成 BuildStyleId[],不许退回 string[]").toMatch(
      /styleHints:\s*BuildStyleId\[\]/,
    );
    expect(src, "styleHints 退回宽类型了").not.toMatch(/styleHints:\s*string\[\]/);
  });

  it("胜局路径不许填 styleHints —— 填了也不读", () => {
    /*
     * 胜局 `directions` 恒为 `[]`,故 `victoryFindings` 里的 hint 是死数据。
     * 曾经那里有 7 处赋值(其中 3 处指向不存在的 `cangfeng`)。
     */
    const raw = readFileSync(resolve(__dirname, "./battleAnalysis.ts"), "utf8");
    const start = raw.indexOf("function victoryFindings(");
    const end = raw.indexOf("\n}\n", start);
    expect(start, "找不到 victoryFindings").toBeGreaterThan(-1);
    const body = raw
      .slice(start, end)
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    const filled = [...body.matchAll(/styleHints:\s*\[([^\]]*)\]/g)].filter(
      (m) => m[1]!.trim() !== "",
    );
    expect(
      filled.map((m) => m[0]),
      "胜局归因里填了 styleHints —— 胜局 directions 恒为 [],这些是死数据,只会误导下一个人",
    ).toEqual([]);
  });

  it("运行期兜底:找不到流派时跳过,不许在 `.name` 上抛", () => {
    /*
     * 类型收紧之后正常路径已经安全,但这条守的是「万一」:
     * 旧存档、将来新增的 hint 来源、或者类型被人放宽。找不到就跳过,不崩。
     */
    const raw = readFileSync(resolve(__dirname, "./battleAnalysis.ts"), "utf8");
    const src = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    /*
     * 断言写成「find(...) 之后紧跟 `!`」,允许中间换行 —— 格式化器会把长行拆开,
     * 只匹配同一行的写法会漏掉被拆开的那个。
     */
    const nonNullFind = /BUILD_STYLES\.find\([\s\S]{0,80}?\)\s*!/.test(src);
    expect(
      nonNullFind,
      "又用上非空断言了 —— 那个 `!` 曾经是谎(找不到流派就跳过,别在 .name 上抛)",
    ).toBe(false);
  });
});
