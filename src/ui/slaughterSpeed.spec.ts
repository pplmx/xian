/**
 * 速战之赏的读数 —— 机制一直在跑,玩家侧一个字都没有。
 *
 * ## 缺口
 *
 * 杀伐道有三档速战之赏(`core/daoDepth` 的 `SLAUGHTER_SPEED_TIERS`),
 * 结算在 `core/expedition` 里真加道源。而在途面板报的是
 * 「已历 N 战 · 沿途道源 +X · 携血 Y% · 杀意 N 层」—— **不报总回合、不报档位**。
 * 玩家打完只知道 toast 尾巴多了一句「(含杀伐速战之赏)」,永远不知道
 * 自己差几回合能跳下一档,也就无法决定「这一重要不要硬闯」。
 *
 * 顺带一处两本账:`core/expedition` 里写 `const RUN_FIGHTS = 5`,
 * 而视图里同一件事写成 `EXPEDITION_ROUTE_LAYERS + 2`。层数改成 4 那天,
 * 界面报「四重」而速战仍按 5 场折算,两个数都自洽、没有任何门会红。
 *
 * ## 判据守什么
 *
 * 一 读数与判定同源:档位阈值不许在 ui 里重写一遍(`SLAUGHTER_SPEED_TIERS` 是唯一来源);
 * 二 差多少要可执行:报「每场均 N 回合」而不是总回合 —— 玩家能影响的是每场打多快;
 * 三 边界:最高档说「已至最速」,不编一个「下一档」;非杀伐道不给任何读数;
 * 四 总场数单源:`EXPEDITION_RUN_FIGHTS === EXPEDITION_ROUTE_LAYERS + 2`。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { SLAUGHTER_SPEED_TIERS, slaughterSpeedBonus, slaughterSpeedTierOf } from "@/core/daoDepth";
import { EXPEDITION_ROUTE_LAYERS, EXPEDITION_RUN_FIGHTS } from "@/data/endgame";
import { speedTierReadout } from "./slaughterSpeed";

/** 5 场为基准(与 EXPEDITION_RUN_FIGHTS 同值,但断言时用真常量) */
const FIGHTS = EXPEDITION_RUN_FIGHTS;
const run = (totalRounds: number) => ({ totalRounds });

describe("速战之赏 · 档位读数", () => {
  it("读数的档位与判定同源 —— 不许在 ui 里重写 12/18/24", () => {
    // 逐档各给一个恰好落在档内的总回合,读出的赏格必须等于判定的赏格
    let checked = 0;
    for (const tier of SLAUGHTER_SPEED_TIERS) {
      const total = (tier.maxPerFight - 1) * FIGHTS; // 每场均 max-1 回合,必进这一档
      const adjudged = slaughterSpeedBonus(total, FIGHTS);
      const readout = speedTierReadout(run(total), FIGHTS, "slaughter");
      expect(readout, `第 ${tier.maxPerFight} 档读不到读数`).not.toBeNull();
      expect(readout!.bonus, `每场均 ${tier.maxPerFight - 1} 回合时读数与判定不一致`).toBe(
        adjudged,
      );
      checked += 1;
    }
    // 防空转:三档都真跑到了
    expect(checked, "一档都没核到 —— 判据会空转").toBe(SLAUGHTER_SPEED_TIERS.length);
  });

  it("差多少要可执行:报的是每场均回合,并给出下一档的门槛", () => {
    // 每场均 20 回合:进 24 档(+8%),下一档是 18 回合(+15%)
    const total = 20 * FIGHTS;
    const readout = speedTierReadout(run(total), FIGHTS, "slaughter")!;
    expect(readout.bonus).toBe(0.08);
    expect(readout.maxed).toBe(false);
    expect(readout.text, "该报出每场均回合数,玩家才知道差多少").toContain("20");
    expect(readout.text, "该报下一档门槛").toContain("18");
    expect(readout.text, "该报下一档赏格").toContain("15%");
    // 读到的是每场均,不是总回合 —— 总回合 100 不该原样出现
    expect(readout.text).not.toContain(String(total));
  });

  it("最高档说「已至最速」,不编一个下一档", () => {
    const readout = speedTierReadout(run(5 * FIGHTS), FIGHTS, "slaughter")!;
    expect(readout.bonus).toBe(0.25);
    expect(readout.maxed).toBe(true);
    expect(readout.text).toContain("已至最速");
    expect(readout.text, "最高档不许再报一个下一档门槛").not.toContain("压到");
  });

  it("一档未进也要给出路 —— 不是「不行」两个字", () => {
    const readout = speedTierReadout(run(30 * FIGHTS), FIGHTS, "slaughter")!;
    expect(readout.bonus).toBe(0);
    expect(readout.text).toContain("未入档");
    expect(readout.text, "一档未进时要报最容易那档的门槛").toContain("24");
  });

  it("不是杀伐道就一个字都不给;没有在途远征也不给", () => {
    expect(speedTierReadout(run(20 * FIGHTS), FIGHTS, "sword")).toBeNull();
    expect(speedTierReadout(run(20 * FIGHTS), FIGHTS, null)).toBeNull();
    expect(speedTierReadout(null, FIGHTS, "slaughter")).toBeNull();
  });

  it("坏数不抛错:NaN / 负数 / 场数为 0", () => {
    const nan = speedTierReadout({ totalRounds: Number.NaN }, FIGHTS, "slaughter");
    expect(nan).not.toBeNull();
    expect(Number.isFinite(nan!.perFight)).toBe(true);
    /*
     * 负数总回合要被夹成 0,**而不是原样带出去** —— 判据写成「等于 0」而不是
     * 「>= 0」:后者恒真(perFight 由 Math.max(0, …) 产出),守不住任何东西
     * (本仓 `tautologyGuard.spec` 会当场点名)。
     */
    expect(speedTierReadout({ totalRounds: -5 }, FIGHTS, "slaughter")!.perFight).toBe(0);
    // 场数为 0 时按 1 场折算,不许除零出 Infinity
    const zero = speedTierReadout(run(30), 0, "slaughter");
    expect(zero).not.toBeNull();
    expect(Number.isFinite(zero!.perFight)).toBe(true);
  });

  it("判定本身在边界上不许抖:恰好等于阈值算没进档(< 而不是 ≤)", () => {
    /*
     * 判定写的是 `perFight < maxPerFight`。恰好等于 12 不算进 25% 那档 ——
     * 读数与判定必须同一个不等号,否则玩家会看到「已入档」而实际拿不到。
     */
    const exactly12 = 12 * FIGHTS;
    expect(slaughterSpeedBonus(exactly12, FIGHTS)).toBe(0.15); // 等于 12 → 落到 18 档
    const readout = speedTierReadout(run(exactly12), FIGHTS, "slaughter")!;
    expect(readout.bonus).toBe(0.15);
    // 少 1 回合才进最高档
    expect(slaughterSpeedBonus(11 * FIGHTS, FIGHTS)).toBe(0.25);
  });
});

describe("远征总场数 · 一处算,两处读", () => {
  it("EXPEDITION_RUN_FIGHTS 等于「入界 + 各重 + 界主」", () => {
    expect(EXPEDITION_RUN_FIGHTS).toBe(EXPEDITION_ROUTE_LAYERS + 2);
  });

  it("core 里不许再出现裸的 RUN_FIGHTS = 数字", () => {
    /*
     * 此前 `core/expedition` 写 `const RUN_FIGHTS = 5`,而视图写
     * `EXPEDITION_ROUTE_LAYERS + 2`。层数从 3 改 4 那天,界面报「四重」,
     * 速战之赏仍按 5 场折算(通道悄悄放宽 20%),两个数都自洽、没有门会红。
     */
    const source = readFileSync(resolve(__dirname, "../core/expedition.ts"), "utf8");
    expect(
      source,
      "core/expedition 里又写死了总场数 —— 它必须读 EXPEDITION_RUN_FIGHTS",
    ).not.toMatch(/RUN_FIGHTS\s*=\s*\d/);
    expect(source, "core/expedition 该读 data 层那一份").toContain("EXPEDITION_RUN_FIGHTS");
  });

  it("层数与档位是同一套口径:改层数,速战的分母跟着变", () => {
    /*
     * 这条是上面那条的**行为侧**:把场数换成 EXPEDITION_RUN_FIGHTS 之后,
     * 每场均回合的分母就随层数走了。若谁把 core 改回写死的 5,
     * 层数存在时这里算出的每场均回合会与读数的口径对不上。
     */
    const total = 60;
    const withRunFights = slaughterSpeedTierOf(total, EXPEDITION_RUN_FIGHTS)!;
    expect(withRunFights.perFight).toBeCloseTo(total / EXPEDITION_RUN_FIGHTS, 10);
  });
});
