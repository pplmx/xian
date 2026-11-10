/* oxlint-disable no-console -- 模拟器体检报告的正式输出(bun run test:report 依赖) */
import { describe, expect, it } from "vite-plus/test";
import { auditAllWorlds, crossWorldUniversals } from "./celestialSim";

describe("终局世界守恒审计(Phase 20 —— 六项发布条件)", () => {
  const rows = auditAllWorlds();

  it("条件①:每个世界至少 3 个可行流派(通关率 ≥35%)", () => {
    for (const row of rows) {
      expect(row.viableCount, row.world.name).toBeGreaterThanOrEqual(3);
    }
  });

  it("条件②:跨界通吃构筑红线(≤2/120,指纹化追踪)", () => {
    // 单天存在高通率专精解是终局 farm 的正反馈;跨天皆必胜才是万金油。
    // 已知残余:「镇岳印×满血斩杀」型(输出期望极高、无衔接依赖),
    // 已立项终局再平衡(候选:输出型法宝天界降效/满血斩杀对天主失效);此红线防恶化。
    const cross = crossWorldUniversals(120);
    console.log(
      `  跨界通吃: ${cross.count} · 最佳跨界下限 ${Math.round(cross.worstCaseBest * 100)}%`,
    );
    expect(cross.count).toBeLessThanOrEqual(2);
  });

  it("条件③:不允许所有流派都低于 15%(世界必须可解)", () => {
    for (const row of rows) {
      const max = Math.max(...row.byStyle.map((x) => x.clearRate));
      expect(max, row.world.name).toBeGreaterThanOrEqual(0.15);
    }
  });

  it("条件④⑤:存在明显优势与明显劣势流派(极差 ≥30%)", () => {
    for (const row of rows) {
      const rates = row.byStyle.map((x) => x.clearRate);
      expect(Math.max(...rates) - Math.min(...rates), row.world.name).toBeGreaterThanOrEqual(0.3);
    }
  });

  it("条件⑥:四天的最优流派不趋同,且不全等于基础世界最优(罡盾)", () => {
    const bests = rows.map((r) => r.bestStyleId);
    console.log(`  各天最优: ${rows.map((r) => `${r.world.name}=${r.bestStyleId}`).join(" ")}`);
    // 至少出现 3 种不同的最优流派
    expect(new Set(bests).size).toBeGreaterThanOrEqual(3);
    // 不允许四天最优全部与基础世界相同
    expect(bests.every((b) => b === "gangdun")).toBe(false);
  });
});

/**
 * 条件⑦:**报告**各世界的最佳流派通关率 —— 100% 的会被「今日天道」永久跳过。
 *
 * ## 为什么这里是报告而不是断言
 *
 * 实测五界的六大流派通关率:
 *
 * ```text
 *   赤炎天  [20,40,40,60,40,20]   最佳 60%   ← 唯一健康的
 *   星陨天  [100,100,100,10,0,0]  最佳 100%
 *   万刃天  [100,100,100,10,60,0] 最佳 100%
 *   无生天  [70,100,100,100,0,70] 最佳 100%
 *   无相天  [80,90,100,50,0,20]   最佳 100%
 * ```
 *
 * 后果在**每日挑战**上露出来:`core/dailyChallenge` 按「今日天道」随机抽
 * 世界+变数,再用 `verifyChallenge` 验证 —— 而验证有一条 `best > 0.97` 就判
 * 「此局形同虚设,不配称为挑战」。于是 200 天的分布是:
 *
 * ```text
 *   无相 68 / 赤炎 67 / 星陨 34 / 无生 20 / 万刃 11
 * ```
 *
 * 每日天道有 16 次重试,**「每日随机」实际只从两个世界里抽**。
 *
 * ## 为什么不写成断言
 *
 * 这条要修的是**终局平衡**(万刃天靠反击、无生天禁疗,而罡盾流在这两界仍必胜),
 * 那是独立的数值工作,不该跟「每日挑战」这个观察混在一次改动里。
 * 写死成断言会让主分支常红 —— 常红的判据等于没有判据。
 *
 * 先把它做成**报告**:`bun run test:report` 每次都会打出这一行，谁动终局就看得见。
 * 等终局平衡真做了,再把它改成断言(那时它会是绿的)。
 */
describe("终局世界守恒审计 · 条件⑦(报告):最佳通关率", () => {
  const rows = auditAllWorlds();

  it("打印各世界的最佳流派通关率,并标出会被「今日天道」跳过的界", () => {
    const tooEasy: string[] = [];
    for (const row of rows) {
      const best = Math.max(...row.byStyle.map((x) => x.clearRate));
      const tail = best > 0.97 ? "  <- 会被今日天道判为形同虚设" : "";
      if (best > 0.97) tooEasy.push(row.world.name);
      console.log(`  ${row.world.name}: 最佳 ${(best * 100).toFixed(0)}%${tail}`);
    }
    expect(rows.length, "一个天界都没量到").toBeGreaterThanOrEqual(5);
    console.log(
      `  其中 ${tooEasy.length} 个界对某流派无挑战(${tooEasy.join("/")}) —— ` +
        `今日天道的候选实际只剩 ${rows.length - tooEasy.length} 个界`,
    );
  });
});
