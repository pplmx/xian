import { describe, expect, it } from "vite-plus/test";
import type { CombatResult, CombatSideStats } from "@/types";
import { gn, gnZero } from "@/utils/gnum";
import { analyzeBattle, battleDataRows } from "./battleAnalysis";
import { runGauntlet } from "./gauntlet";
import { BUILD_PROFILES, buildSnap } from "./buildSim";
import { RandomService, mulberry32 } from "@/utils/random";
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
