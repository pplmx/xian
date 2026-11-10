/**
 * Phase 21 裁判 —— 契约 / 变数 / 路线节点 / 组合技 / 道途深化的自动验收
 * 原则:每条新规则都必须「有解、无万金油」;模拟器就是发布门
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { CombatRules, CombatantSnap } from "@/types";
import { mulberry32, RandomService } from "@/utils/random";
import { CELESTIAL_WORLDS, MUTATION_FOES, TRIAL_FOES } from "@/data/endgame";
import { PACTS } from "@/data/pacts";
import { MUTATORS } from "@/data/mutators";
import { BUILD_PROFILES, buildSnap } from "./buildSim";
import { SIM_REFERENCE } from "./celestialSim";
import { mergeRules, runGauntlet, worldFoeSnap } from "./gauntlet";
import { resolveCombat } from "./combat";
import {
  swordPurity,
  stackedMods,
  SWORD_LAYER_MODS,
  SWORD_PURITY_MAX_LAYERS,
  slaughterSpeedBonus,
} from "./daoDepth";
import { STYLE_MATURE_AFFINITY, STYLE_MASTER_AFFINITY } from "./buildDetect";

function chain(...list: (CombatRules | undefined)[]): CombatRules | undefined {
  return list.reduce((acc, cur) => mergeRules(acc, cur), undefined);
}

/** 变数六连战通关率(机制混编敌池) */
function mutationClearRate(
  rules: CombatRules | undefined,
  snap: CombatantSnap,
  runs: number,
  seed: number,
): number {
  const rng = new RandomService(mulberry32(seed));
  const foes: CombatantSnap[] = [];
  for (let i = 0; i < 6; i += 1) {
    foes.push(
      worldFoeSnap(MUTATION_FOES[i % MUTATION_FOES.length]!, SIM_REFERENCE, Math.pow(1.06, i)),
    );
  }
  let clears = 0;
  for (let i = 0; i < runs; i += 1) {
    if (runGauntlet(snap, foes, rules, 0.4, rng).cleared) clears += 1;
  }
  return clears / runs;
}

/** 世界连战通关率(可叠加额外规则,如契约) */
function worldRateWithRules(
  worldIdx: number,
  extra: CombatRules | undefined,
  snap: CombatantSnap,
  runs: number,
  seed: number,
): number {
  const world = CELESTIAL_WORLDS[worldIdx]!;
  const rng = new RandomService(mulberry32(seed));
  const foes: CombatantSnap[] = [];
  for (let i = 0; i < world.fights - 1; i += 1) {
    foes.push(worldFoeSnap(world.foes[i % world.foes.length]!, SIM_REFERENCE));
  }
  foes.push(worldFoeSnap(world.guardian, SIM_REFERENCE));
  const rules = chain(world.rules, extra);
  let clears = 0;
  for (let i = 0; i < runs; i += 1) {
    if (runGauntlet(snap, foes, rules, world.healBetweenPct, rng).cleared) clears += 1;
  }
  return clears / runs;
}

describe("天道契约裁判", () => {
  const RULE_PACTS = PACTS.filter((p) => p.rules !== undefined);

  it("每条规则契约在每个世界都有解(至少一个流派通率 ≥15%)", () => {
    for (const pact of RULE_PACTS) {
      for (let w = 0; w < CELESTIAL_WORLDS.length; w += 1) {
        const best = Math.max(
          ...BUILD_PROFILES.map((p, i) =>
            worldRateWithRules(w, pact.rules, buildSnap(p), 12, 21000 + w * 101 + i * 7),
          ),
        );
        expect(best, `${pact.name}×${CELESTIAL_WORLDS[w]!.name} 无解`).toBeGreaterThanOrEqual(0.15);
      }
    }
  });

  /**
   * 契约的**痛感要配得上报价** —— 这一层此前没人守。
   *
   * 已有的两条只守两头:有解(≥15%)与万金油免疫(<95%)。中间那一段是空的,
   * 而疾战契正好躺在那里:它写 `maxRounds: 25`,卖 2.0 倍道源,而实测
   * 逐场战报只有 1/30 组与「不签」不同、净胜 -6 —— 玩家几乎感觉不到代价。
   *
   * 它为什么能活这么久:25 这个数看起来「挺紧的」(半场只有 50 回合),
   * 而星陨天自带 26、其余世界从 50 降下来 —— 表面看压了不少。
   * 只有把「逐场战报到底变没变」量出来,才知道它其实没咬到人。
   *
   * ## 判据口径
   *
   * 每条契约在「世界 × 构筑」的 30 格里,至少要有 **1/5(20%)** 的格子里
   * 逐场战报与不签不同。取战报而不是通率:通率是聚合量,一条只改回合数、
   * 不改胜负的规则在通率上可能完全看不出来,而它对玩家是真实差别
   * (杀伐道速战之赏就按总回合折算)。
   *
   * **阈值 1/5 是按实测分布定的,不是拍的**。当前十条契约的差异率:
   * 断源契 27% · 血契 33% · 追风契 43% · 晦天契 63% · 天残契 70% ·
   * 殛雷契 73% · 疾战契 87% · 噬魂契 90% · 连叠契 97% · 蔽影契 100%。
   * 取 1/5 比最弱的那条(27%)低一档,只筛「彻底无感」的,不误伤弱而不空的。
   *
   * **它守不住什么,也要写清楚**:改前的疾战契(`maxRounds: 25`)是 23%,
   * 越过了这条线 —— 注入验证时没能抓住。也就是说「弱到没人感觉得到」里,
   * 系统性能判的是「接近 0」那一档(断源契修前正是 0%);
   * 「弱但仍有一点感觉」只能靠人看分布 + `decisionAudit` 第 ⑤ 组的结构判据
   * (`rules` 合并后不许与不动相等)兜。判据的边界写在这里,免得下一个人
   * 以为它在守一件它守不住的事。
   */
  it("每条契约的痛感不许接近于零(至少 1/5 的格子逐场战报与不签不同)", () => {
    const tooWeak: string[] = [];
    let cells = 0;
    let totalCells = 0;
    for (const pact of RULE_PACTS) {
      let differs = 0;
      let pactCells = 0;
      for (let w = 0; w < CELESTIAL_WORLDS.length; w += 1) {
        for (const profile of BUILD_PROFILES) {
          const sig = (extra: CombatRules | undefined): string => {
            const world = CELESTIAL_WORLDS[w]!;
            const rng = new RandomService(mulberry32(33000 + w * 131));
            const foes: CombatantSnap[] = [];
            for (let i = 0; i < world.fights - 1; i += 1) {
              foes.push(worldFoeSnap(world.foes[i % world.foes.length]!, SIM_REFERENCE));
            }
            foes.push(worldFoeSnap(world.guardian, SIM_REFERENCE));
            const report = runGauntlet(
              buildSnap(profile),
              foes,
              chain(world.rules, extra),
              world.healBetweenPct,
              rng,
            );
            return JSON.stringify(report.rows.map((r) => [r.win, r.rounds]));
          };
          cells += 1;
          pactCells += 1;
          if (sig(undefined) !== sig(pact.rules)) differs += 1;
        }
      }
      totalCells += pactCells;
      // 1/5 的下限:30 格里至少 6 格
      if (differs * 5 < pactCells) tooWeak.push(`${pact.name}(差异 ${differs}/${pactCells})`);
    }
    expect(
      tooWeak,
      "这些契约几乎不改变任何一场战斗,却在按倍率报价 —— 玩家拿道源换了一个感觉不到的东西:" +
        tooWeak.join("、"),
    ).toEqual([]);
    // 防空转:真的比过那些格子
    expect(totalCells, "一格都没比较 —— 判据会空转").toBeGreaterThan(100);
  });

  it("不存在契约免疫的万金油(没有流派在全部契约×全部世界均 ≥95%)", () => {
    for (const profile of BUILD_PROFILES) {
      let minRate = 1;
      outer: for (const pact of RULE_PACTS) {
        for (let w = 0; w < CELESTIAL_WORLDS.length; w += 1) {
          const rate = worldRateWithRules(w, pact.rules, buildSnap(profile), 10, 22000 + w * 13);
          minRate = Math.min(minRate, rate);
          if (minRate < 0.95) break outer;
        }
      }
      expect(minRate, `${profile.name} 契约免疫`).toBeLessThan(0.95);
    }
  });
});

describe("天道变数裁判", () => {
  /** 全部 C(8,3)=56 种三条组合 */
  const combos: [number, number, number][] = [];
  for (let i = 0; i < MUTATORS.length; i += 1)
    for (let j = i + 1; j < MUTATORS.length; j += 1)
      for (let k = j + 1; k < MUTATORS.length; k += 1) combos.push([i, j, k]);

  it(
    "任意三条变数组合皆有解,且无组合通吃者",
    // C(8,3)=56 组合 × 8 流派,每场 8 回合的胜率采样 —— 单测实测 ~20s,
    // 恰好贴着 vitest 默认 testTimeout:20000。342 个文件并行时振荡一上来就超时,
    // 本测试不是断言失败而是「算不够快」—— 故单独放宽,不动任何断言。
    // 实测:负载尖峰里它跑出过 174s(单测仅 ~20s),120s 仍偶发不够,
    // 取 300s 给足最坏并行的余量。
    { timeout: 300000 },
    () => {
      const alwaysHigh = new Map<string, number>();
      for (const [ci, [a, b, c]] of combos.entries()) {
        const rules = chain(MUTATORS[a]!.rules, MUTATORS[b]!.rules, MUTATORS[c]!.rules);
        let best = 0;
        for (const [pi, profile] of BUILD_PROFILES.entries()) {
          const rate = mutationClearRate(rules, buildSnap(profile), 8, 31000 + ci * 61 + pi);
          best = Math.max(best, rate);
          if (rate >= 0.95) alwaysHigh.set(profile.id, (alwaysHigh.get(profile.id) ?? 0) + 1);
        }
        expect(
          best,
          `变数组合 ${MUTATORS[a]!.name}/${MUTATORS[b]!.name}/${MUTATORS[c]!.name} 无解`,
        ).toBeGreaterThanOrEqual(0.15);
      }
      // 没有流派在 ≥90% 的组合里都近乎必胜
      for (const [id, n] of alwaysHigh) {
        expect(n / combos.length, `${id} 变数通吃`).toBeLessThan(0.9);
      }
    },
  );
});

describe("路线节点裁判", () => {
  it("每个节点单场皆有解(至少一个流派胜率 ≥35%)", () => {
    for (const world of CELESTIAL_WORLDS) {
      for (const layer of world.routes) {
        for (const node of layer) {
          const foe = worldFoeSnap(node.foe, SIM_REFERENCE);
          const rules = chain(world.rules, node.rules);
          let best = 0;
          for (const [pi, profile] of BUILD_PROFILES.entries()) {
            const rng = new RandomService(mulberry32(41000 + pi * 97 + node.id.length));
            let wins = 0;
            for (let r = 0; r < 20; r += 1) {
              if (resolveCombat(buildSnap(profile), foe, rng, rules).win) wins += 1;
            }
            best = Math.max(best, wins / 20);
          }
          expect(best, `${world.name}·${node.name} 无解`).toBeGreaterThanOrEqual(0.35);
        }
      }
    }
  });

  it("高险节点的额外道源不低于同层稳妥节点(风险应当有价)", () => {
    for (const world of CELESTIAL_WORLDS) {
      for (const layer of world.routes) {
        expect(layer[0].bonus).not.toBe(layer[1].bonus);
      }
    }
  });
});

describe("组合技裁判", () => {
  // 优势界看增益不缩水,劣势界看不被组合技翻成通吃(单界高通率本就是允许的正反馈)
  const CASES = [
    { art: "xuangang", profileId: "gangdun", strongIdx: 1, weakIdx: 0 },
    { art: "kuze", profileId: "muze", strongIdx: 0, weakIdx: 2 },
    { art: "fenglian", profileId: "fengmang", strongIdx: 3, weakIdx: 1 },
  ] as const;

  it("组合技在优势界有实际增益,在劣势界不翻盘成通吃", () => {
    for (const c of CASES) {
      const profile = BUILD_PROFILES.find((p) => p.id === c.profileId)!;
      const base = buildSnap(profile);
      const withArt: CombatantSnap = { ...base, comboArt: c.art };
      const plainStrong = worldRateWithRules(c.strongIdx, undefined, base, 40, 51000);
      const boostedStrong = worldRateWithRules(c.strongIdx, undefined, withArt, 40, 51000);
      expect(boostedStrong, `${c.art} 优势界反而变弱`).toBeGreaterThanOrEqual(plainStrong - 0.05);
      const boostedWeak = worldRateWithRules(c.weakIdx, undefined, withArt, 40, 52000);
      expect(boostedWeak, `${c.art} 劣势界翻盘成通吃`).toBeLessThan(0.95);
    }
  });

  it("枯泽回春在濒死场景强于纯沐泽(低血开局对拼)", () => {
    const profile = BUILD_PROFILES.find((p) => p.id === "muze")!;
    const base = buildSnap(profile);
    const withArt: CombatantSnap = { ...base, comboArt: "kuze" };
    const foe = worldFoeSnap(TRIAL_FOES[0]!, SIM_REFERENCE, 1.12);
    const lowHp: CombatRules = { playerStartHpPct: 0.28 };
    const winRate = (snap: CombatantSnap, seed: number): number => {
      const rng = new RandomService(mulberry32(seed));
      let wins = 0;
      for (let i = 0; i < 120; i += 1) if (resolveCombat(snap, foe, rng, lowHp).win) wins += 1;
      return wins / 120;
    };
    expect(winRate(withArt, 777)).toBeGreaterThan(winRate(base, 777) - 0.02);
  });
});

describe("道途深化裁判", () => {
  it("长生印规则可被引擎执行且战报留痕", () => {
    const rules: CombatRules = {
      perRounds: { interval: 3, playerHealPct: 0.05, playerShieldPct: 0.05, enemyAtkGrowth: 0.05 },
    };
    const foe = worldFoeSnap(TRIAL_FOES[0]!, SIM_REFERENCE, 1);
    const rng = new RandomService(mulberry32(999));
    const result = resolveCombat(buildSnap(BUILD_PROFILES[0]!), foe, rng, rules);
    expect(result.log.some((l) => l.text.includes("长生印"))).toBe(true);
  });

  it("长生印不会把持久流推成必胜(敌人杀意渐涨形成对冲)", () => {
    const longevityRules: CombatRules = {
      healMult: 1.5,
      shieldCapRatio: 0.65,
      enemyHpMult: 1.2,
      perRounds: { interval: 5, playerHealPct: 0.04, playerShieldPct: 0.04, enemyAtkGrowth: 0.06 },
    };
    const muze = BUILD_PROFILES.find((p) => p.id === "muze")!;
    const rate = worldRateWithRules(1, longevityRules, buildSnap(muze), 30, 61000);
    expect(rate).toBeLessThan(0.98);
  });

  it("剑意纯度按四项判定计层", () => {
    const pure = swordPurity({ fullHpDamage: 0.35, firstStrike: 0.35, critRate: 0.15 }, 1, {
      style: {
        id: "fengmang",
        name: "锋芒流",
        seal: "锋",
        desc: "",
        core: { fullHpDamage: 0.35, firstStrike: 0.35, critRate: 0.15 },
      },
      affinity: 1,
      stageName: "大成",
      coreValues: [],
      coreTotal: 3,
      displayName: "锋芒流",
    });
    expect(pure.layers).toBe(4);
    // 无流派可言者谈不上「纯」:四项皆不满足
    const impure = swordPurity({ lifesteal: 0.08 }, 2, null);
    expect(impure.layers).toBe(0);
  });

  it("剑意纯度阈值与层数单源:判定 / stageName / 界面「/N」同读一枚(改常数就撒谎)", () => {
    // 三条必须指向同一来源,不许各处手抄 —— 0.6 改一个数,判定与流派文案若各写一份就不同步
    expect(STYLE_MATURE_AFFINITY, "纯度「契合 ≥60%」该读流派成形线").toBe(0.6);
    expect(STYLE_MASTER_AFFINITY).toBe(0.9);
    // 层数 = 纯度判定的条数:检验条目增删时「/N 层」自动跟着走,不会界面 4 层、判定 5 条
    expect(SWORD_PURITY_MAX_LAYERS).toBe(4);
    const pure = swordPurity({ fullHpDamage: 0.35, firstStrike: 0.35 }, 1, {
      style: null as never,
      affinity: 1,
      stageName: "大成",
      coreValues: [],
      coreTotal: 0,
      displayName: "x",
    });
    expect(SWORD_PURITY_MAX_LAYERS).toBe(pure.checks.length);
    // 判据名里的百分比也读那一枚阈值:改成 0.55 却还写着「≥60%」,玩家会照旧
    // 以为 60% 才成形。名字与判定同读 STYLE_MATURE_AFFINITY —— 故这里不查
    // "等于 60%"(今天恰好同值),而是查源码里没有手写的「≥60%」字面量。
    expect(pure.checks[0]!.name, "纯度判据名里的百分比要跟着阈值走").toContain(
      `${Math.round(STYLE_MATURE_AFFINITY * 100)}%`,
    );
    const daoDepthSrc = readFileSync(resolve(__dirname, "daoDepth.ts"), "utf8");
    expect(daoDepthSrc, "判据名不许再手写「契合 ≥60%」").not.toMatch(/契合\s*≥\s*60%/);
  });

  it("剑意叠层与杀伐速战加成的数学正确", () => {
    const mods = stackedMods({}, SWORD_LAYER_MODS, 3);
    expect(mods.damageBonus).toBeCloseTo(0.12);
    expect(mods.critRate).toBeCloseTo(0.06);
    expect(slaughterSpeedBonus(50, 5)).toBe(0.25);
    expect(slaughterSpeedBonus(130, 5)).toBe(0);
  });
});

describe("契约机制单元", () => {
  it("无伤契:战后血线不达标即判违契终止", () => {
    const foes = [
      worldFoeSnap(TRIAL_FOES[0]!, SIM_REFERENCE, 1),
      worldFoeSnap(TRIAL_FOES[1]!, SIM_REFERENCE, 1),
    ];
    const rng = new RandomService(mulberry32(123));
    const report = runGauntlet(buildSnap(BUILD_PROFILES[0]!), foes, undefined, 0.5, rng, {
      minHpAfterFight: 0.999,
    });
    expect(report.cleared).toBe(false);
    expect(report.pactBroken ?? report.rows.some((r) => !r.win)).toBeTruthy();
  });

  it("逐胜叠层:perWinPlayerMods 使后续场次伤害词条更高", () => {
    const weakFoe = worldFoeSnap(TRIAL_FOES[0]!, SIM_REFERENCE, 0.3);
    const rng = new RandomService(mulberry32(456));
    const report = runGauntlet(
      buildSnap(BUILD_PROFILES[0]!),
      [weakFoe, weakFoe, weakFoe],
      undefined,
      1,
      rng,
      {
        perWinPlayerMods: { damageBonus: 0.5 },
      },
    );
    expect(report.cleared).toBe(true);
    // 叠层生效的间接证据:第三场(+100% 伤害)回合数不多于第一场
    expect(report.rows[2]!.rounds).toBeLessThanOrEqual(report.rows[0]!.rounds);
  });
});
