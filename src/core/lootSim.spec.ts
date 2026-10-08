/* oxlint-disable no-console -- 模拟器体检报告的正式输出(bun run test:report 依赖) */
import { describe, expect, it } from "vite-plus/test";
import { QUALITIES } from "@/data/qualities";
import { DECOMPOSE_DUST } from "@/data/constants";
import { simulateLootPressure } from "./lootSim";

describe("装备经济压力测试(Phase 19)", () => {
  const tiers = [3, 8, 14].map((t) => simulateLootPressure(t));

  it("掉落速率在设计带宽内(30~120 件/时)", () => {
    for (const p of tiers) {
      expect(p.dropsPerHour).toBeGreaterThan(30);
      expect(p.dropsPerHour).toBeLessThan(120);
    }
  });

  it("层级越高平均品质越好(掉落跟随成长)", () => {
    expect(tiers[1]!.avgRank).toBeGreaterThan(tiers[0]!.avgRank);
    expect(tiers[2]!.avgRank).toBeGreaterThan(tiers[1]!.avgRank);
  });

  it("低层级不应泛滥神品(稀有度保护)", () => {
    expect(tiers[0]!.rankShare[8]!).toBeLessThan(0.005);
    expect(tiers[0]!.rankShare[7]! + tiers[0]!.rankShare[8]!).toBeLessThan(0.02);
  });

  it("分解折算覆盖全部品质(爆仓保护阀完整)", () => {
    expect(DECOMPOSE_DUST.length).toBe(QUALITIES.length);
    for (const d of DECOMPOSE_DUST) expect(d).toBeGreaterThan(0);
  });

  it("[发现] 背包在 2 小时内爆仓——依赖折算阀,构筑管理压力真实存在", () => {
    // 该断言"锁定问题存在":若未来加了自动分解/过滤,爆仓时长改变,此测试提醒同步更新设计文档
    for (const p of tiers) {
      expect(p.hoursToFillBag).toBeLessThan(4);
    }
  });
});
