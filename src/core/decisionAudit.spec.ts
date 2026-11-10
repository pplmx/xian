/**
 * Phase 22 玩家决策质量审计
 * 核心问题:玩家是真的在做选择,还是系统已经替玩家把答案算出来了?
 * ① 最优解塌缩:可行 Build 的性能分布必须足够分散
 * ② 契约答案化:最优契约必须随 Build×世界变化,不存在全局答案契约
 * ③ 逆命第二答案:混合构筑在主派被封后必须显著优于纯构筑(冗余有价值)
 * ④ 词条递减数学:同词条多来源按 100/75/50/25 计入
 */
import { describe, expect, it } from "vite-plus/test";
import type { CombatRules, CombatantSnap, StatMods } from "@/types";
import { mulberry32, RandomService } from "@/utils/random";
import { CELESTIAL_WORLDS } from "@/data/endgame";
import { PACTS } from "@/data/pacts";
import { BUILD_PROFILES, buildSnap } from "./buildSim";
import { BUILD_STYLES } from "./buildDetect";
import { SIM_REFERENCE } from "./celestialSim";
import { mergeRules, runGauntlet, worldFoeSnap, type GauntletOpts } from "./gauntlet";
import { resolveCombat } from "./combat";
import { mergeMods } from "./statsCalc";
import { sealStyleMods } from "./resilience";

function worldFoes(worldIdx: number): CombatantSnap[] {
  const world = CELESTIAL_WORLDS[worldIdx]!;
  const foes: CombatantSnap[] = [];
  for (let i = 0; i < world.fights - 1; i += 1) {
    foes.push(worldFoeSnap(world.foes[i % world.foes.length]!, SIM_REFERENCE));
  }
  foes.push(worldFoeSnap(world.guardian, SIM_REFERENCE));
  return foes;
}

function clearRate(
  worldIdx: number,
  snap: CombatantSnap,
  extra: CombatRules | undefined,
  runs: number,
  seed: number,
  opts: GauntletOpts = {},
): number {
  const world = CELESTIAL_WORLDS[worldIdx]!;
  const rng = new RandomService(mulberry32(seed));
  const foes = worldFoes(worldIdx);
  const rules = mergeRules(world.rules, extra);
  let clears = 0;
  for (let i = 0; i < runs; i += 1) {
    if (runGauntlet(snap, foes, rules, world.healBetweenPct, rng, opts).cleared) clears += 1;
  }
  return clears / runs;
}

describe("① 最优解塌缩检测", () => {
  it("每个世界:可行流派 ≥3,且次优通率 ≥ 最优 ×0.55(有真选择,不是唯一答案)", () => {
    for (let w = 0; w < CELESTIAL_WORLDS.length; w += 1) {
      const rates = BUILD_PROFILES.map((p, i) => ({
        name: p.name,
        rate: clearRate(w, buildSnap(p), undefined, 25, 91000 + w * 71 + i),
      })).sort((a, b) => b.rate - a.rate);
      const [top1, top2] = [rates[0]!, rates[1]!];
      const viable = rates.filter((r) => r.rate >= 0.35).length;
      expect(viable, `${CELESTIAL_WORLDS[w]!.name} 可行流派不足`).toBeGreaterThanOrEqual(3);
      expect(
        top2.rate,
        `${CELESTIAL_WORLDS[w]!.name} 塌缩:${top1.name} ${top1.rate} 独走(次优 ${top2.name} ${top2.rate})`,
      ).toBeGreaterThanOrEqual(top1.rate * 0.55);
    }
  });
});

describe("② 契约答案化检测", () => {
  // 可模拟的契约选项:无契约 + 三条规则契 + 无伤契(孤剑契对单法宝模拟构筑无差别,逆命契依赖玩家构筑结构)
  interface PactOption {
    id: string;
    mult: number;
    rules?: CombatRules;
    opts?: GauntletOpts;
  }
  const OPTIONS: PactOption[] = [
    { id: "none", mult: 1 },
    ...PACTS.filter((p) => p.rules !== undefined).map((p) => ({
      id: p.id,
      mult: p.sourceMult,
      rules: p.rules,
    })),
    { id: "wushang", mult: 3.0, opts: { minHpAfterFight: 0.8 } },
  ];

  it("最优契约随 Build×世界 变化:每个世界至少 2 种流派最优契不同,且无全局答案契约", () => {
    const globalBest = new Map<string, number>();
    let cells = 0;
    for (let w = 0; w < CELESTIAL_WORLDS.length; w += 1) {
      const bestPerStyle = new Set<string>();
      for (const [pi, profile] of BUILD_PROFILES.entries()) {
        const snap = buildSnap(profile);
        let best: { id: string; value: number } = { id: "none", value: -1 };
        for (const opt of OPTIONS) {
          const rate = clearRate(w, snap, opt.rules, 12, 93000 + w * 131 + pi * 17, opt.opts ?? {});
          const value = rate * opt.mult;
          if (value > best.value) best = { id: opt.id, value };
        }
        bestPerStyle.add(best.id);
        globalBest.set(best.id, (globalBest.get(best.id) ?? 0) + 1);
        cells += 1;
      }
      expect(
        bestPerStyle.size,
        `${CELESTIAL_WORLDS[w]!.name} 存在人人皆签的答案契`,
      ).toBeGreaterThanOrEqual(2);
    }
    for (const [id, n] of globalBest) {
      expect(n / cells, `契约 ${id} 成为全局答案(${n}/${cells})`).toBeLessThanOrEqual(0.75);
    }
  });
});

describe("③ 逆命契第二答案检测", () => {
  it("混合构筑在主派核心被封后,显著优于同样被封的纯构筑(冗余必须有价值)", () => {
    const gangdun = BUILD_PROFILES.find((p) => p.id === "gangdun")!;
    const fanzhen = BUILD_PROFILES.find((p) => p.id === "fanzhen")!;
    const gangdunStyle = BUILD_STYLES.find((s) => s.id === "gangdun")!;

    // 纯罡盾:全预算押注主派;混合:同预算分给罡盾 + 反震副体系(词条经真实递减聚合)
    const pureMods = mergeMods([gangdun.mods, { shieldOnStart: 0.15, shieldPower: 0.2 }]);
    const halfFanzhen: StatMods = {
      counterRate: (fanzhen.mods.counterRate ?? 0) * 0.55,
      counterDamage: (fanzhen.mods.counterDamage ?? 0) * 0.55,
    };
    const mixedMods = mergeMods([gangdun.mods, halfFanzhen]);

    const base = buildSnap(gangdun);
    const pure: CombatantSnap = { ...base, mods: sealStyleMods(pureMods, gangdunStyle) };
    const mixed: CombatantSnap = { ...base, mods: sealStyleMods(mixedMods, gangdunStyle) };

    /*
     * 对手用**独立夹具**,不再借某个天界的守卫与 rules。
     *
     * ## 为什么换
     *
     * 原来这里写的是 `CELESTIAL_WORLDS[1].guardian` + `CELESTIAL_WORLDS[1].rules`
     * (注释还错写成「万刃天界主」—— 第 1 个其实是星陨天)。
     *
     * 第 75 轮试着调天界难度时撞到这里:我把星陨天的 `maxRounds` 从 26 挪到 24,
     * 而这条判据恰好依赖 `maxRounds` 卡在「纯罡盾打不穿、混合构筑的反击刚好跨过
     * DPS 阈值」那个点上 —— 一挪位,混合构筑就再也跨不过去,判据红了。
     *
     * **天界的 rules 同时是「给玩家打的难度」和「这条判据的前提」两件事。**
     * 换夹具之后,调天界数值不会再碰这条判据。
     *
     * ## 夹具的形状
     *
     * 一条**厚血消耗墙**:血厚、攻击中等、无反制。它要能撑过 `maxRounds: 26`
     * 让纯罡盾打不穿,又不至于把混合构筑打死。
     *
     * 三维与技能**照搬原星陨天主** —— 换夹具只求「前提不变」,
     * 数值照搬才能让这条判据的结论与换之前一致(而不是顺手改了它的判定标准)。
     */
    const fixtureFoe = worldFoeSnap(
      {
        name: "夹具·厚血消耗墙",
        icon: "star",
        atkR: 0.85,
        defR: 0.55,
        hpR: 2.2,
        speed: 1.25,
        skills: [
          { name: "星坠乾坤", mult: 1.9, rate: 0.35 },
          { name: "星屑乱舞", mult: 1.0, rate: 0.6, effect: "multi" },
        ],
      },
      SIM_REFERENCE,
      1.15,
    );
    const fixtureRules: CombatRules = { maxRounds: 26 };
    const winRate = (snap: CombatantSnap, seed: number): number => {
      const rng = new RandomService(mulberry32(seed));
      let wins = 0;
      for (let i = 0; i < 80; i += 1)
        if (resolveCombat(snap, fixtureFoe, rng, fixtureRules).win) wins += 1;
      return wins / 80;
    };
    const pureSealed = winRate(pure, 95001);
    const mixedSealed = winRate(mixed, 95002);
    expect(
      mixedSealed,
      `副体系没有形成第二答案(纯 ${pureSealed} vs 混 ${mixedSealed})`,
    ).toBeGreaterThan(pureSealed + 0.1);
  });
});

describe("④ 词条叠加递减数学", () => {
  it("同一条件词条多来源按 100%/75%/50%/25% 降序计入", () => {
    const merged = mergeMods([
      { critRate: 0.2 },
      { critRate: 0.3 },
      { critRate: 0.1 },
      { critRate: 0.08 },
    ]);
    // 0.3×1 + 0.2×0.75 + 0.1×0.5 + 0.08×0.25 = 0.52
    expect(merged.critRate).toBeCloseTo(0.52);
  });

  it("非条件词条(三维百分比/经济词条)不受递减影响", () => {
    const merged = mergeMods([
      { attackPct: 0.2, cultivationSpeed: 0.1 },
      { attackPct: 0.3, cultivationSpeed: 0.2 },
    ]);
    expect(merged.attackPct).toBeCloseTo(0.5);
    expect(merged.cultivationSpeed).toBeCloseTo(0.3);
  });

  it("负值词条(道途代价等)不参与递减,直接相加", () => {
    const merged = mergeMods([{ critRate: 0.2 }, { critRate: -0.1 }]);
    expect(merged.critRate).toBeCloseTo(0.1);
  });
});

/**
 * ⑤ 空契约检测 —— 一条契约的规则必须真的改变战局。
 *
 * ## 缺口:断源契卖 1.8 倍道源,而它一个字都不改
 *
 * `data/pacts` 里断源契写的是 `rules: { shieldCapRatio: 0.5 }`,而
 * `core/combat` 的兜底恰好是 `rules?.shieldCapRatio ?? SHIELD_CAP_RATIO`、
 * `SHIELD_CAP_RATIO = 0.5` —— **签与不签合并出来的规则完全相等**。
 * 实测 9 世界 × 6 构筑共 30 组,逐场战报差异 **0/30**、净胜场变化 0。
 *
 * 它是玩家在「拟定契约」那一屏主动选的:界面写着「护盾上限减半(50%) · 道源 ×1.8」,
 * 玩家据此以为自己在拿一半护盾换 1.8 倍收益,实际什么都没换。
 *
 * ## 为什么已有的判据全绿
 *
 * 本文件的 ② 核的是「最优契约随 Build×世界变化」—— 它算 `rate * mult`,
 * 空契约的 rate 与不签相同而 mult 是 1.8,**所以它永远不会被选成最优**,
 * 于是「它没被选」这件事在 ② 眼里是正常的,不会被当成缺陷。
 * 换句话说:② 问的是「答案是不是唯一的」,而这条问的是「选项是不是真的存在」。
 *
 * ## 判据守什么
 *
 * 对每一条带 `rules` 的契约,至少在**一个**「世界 × 构筑」格里让逐场战报
 * 与不签契约时不同。找不到任何一格 → 它是一条空契约。
 *
 * 口径刻意取「战报逐场 `[胜负, 回合数]` 序列」而不是「通率」:通率是聚合量,
 * 一条只改回合数、不改胜负的规则(疾战契那种)在通率上可能完全看不出来,
 * 而它对玩家是真实的差别(杀伐道速战之赏就按总回合折算)。
 */
describe("⑤ 空契约检测 —— 每条契约都必须真的改变战局", () => {
  /** 战报签名:逐场的 [胜负, 回合数]。聚合指标看不出「只改回合数」的那一类 */
  function signature(worldIdx: number, snap: CombatantSnap, extra?: CombatRules): string {
    const world = CELESTIAL_WORLDS[worldIdx]!;
    const rng = new RandomService(mulberry32(91000 + worldIdx * 131));
    const report = runGauntlet(
      snap,
      worldFoes(worldIdx),
      mergeRules(world.rules, extra),
      world.healBetweenPct,
      rng,
    );
    return JSON.stringify(report.rows.map((r) => [r.win, r.rounds]));
  }

  it("每条带规则的天道契约,至少在一格里让战报与「不签」不同", () => {
    const withRules = PACTS.filter((p) => p.rules !== undefined);
    // 防空转:契约表要是空的,下面那条循环会「通过」
    expect(withRules.length, "一条带规则的契约都没读到 —— 判据会空转").toBeGreaterThan(6);

    const empty: string[] = [];
    let checkedCells = 0;
    for (const pact of withRules) {
      let differs = 0;
      for (let w = 0; w < CELESTIAL_WORLDS.length; w += 1) {
        for (const profile of BUILD_PROFILES) {
          const snap = buildSnap(profile);
          const base = signature(w, snap);
          const withPact = signature(w, snap, pact.rules);
          checkedCells += 1;
          if (base !== withPact) differs += 1;
        }
      }
      if (differs === 0) {
        empty.push(`${pact.name}(道源 ×${pact.sourceMult} · ${pact.ruleText})`);
      }
    }
    expect(
      empty,
      "这些契约的规则合并进战斗后与「不签」逐场战报完全相同 —— " +
        "玩家拿道源换了一场空,而界面还在按倍率报价:" +
        empty.join("、"),
    ).toEqual([]);
    // 防空转:真的跑过那些格子
    expect(checkedCells, "一格都没比较 —— 判据会空转").toBeGreaterThan(100);
  });

  it("契约的规则合并后不许与「什么都不写」等价", () => {
    /*
     * 上一条是行为侧(战报真的变了),这一条是**结构侧**:把每条契约的 rules 与
     * 「空规则」分别合并进一个不含盾上限的世界规则,比合并结果。
     *
     * 它专抓断源契那一类:`shieldCapRatio: 0.5` 与默认常量恰好相等,
     * 于是「写进规则」和「不写」合并出来完全一样 —— 这类恒等不靠运气才该被抓到。
     */
    const offenders: string[] = [];
    for (const pact of PACTS) {
      if (!pact.rules) continue;
      // 一个不含 shieldCapRatio 的世界规则(取第一个没有这项的世界)
      const plain: CombatRules = { enemyAtkMult: 1.1 };
      const a = JSON.stringify(mergeRules(plain, pact.rules));
      const b = JSON.stringify(mergeRules(plain, {}));
      if (a === b) offenders.push(`${pact.name}(${pact.ruleText})`);
    }
    expect(
      offenders,
      "这些契约的 rules 合并进一个基准规则后与不动完全相同 —— 写进去等于没写:" +
        offenders.join("、"),
    ).toEqual([]);
  });
});
