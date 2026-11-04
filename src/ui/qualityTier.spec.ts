/**
 * 品阶的视觉强度 —— 三段为主,最贵的那一段内部分三层。
 *
 * 判据六组:
 *   一 三段仍是三段:凡良精 / 灵玄地 各一个值,档内一致;
 *   二 稀有段内部分层:天 < 仙 < 神,边与底都严格递增;
 *   三 天品保持原值 —— 已经发到玩家眼里的那一档不许动;
 *   四 单调:rank 涨,强度只涨不落(九档全序);
 *   五 顶格是 1.00,不越界;
 *   六 与盖章那条界同源:同一批 rank ≥ 6 的既盖章也在稀有段里。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { QUALITIES } from "@/data/qualities";
import { isRareQuality, qualityTierStyle } from "./qualityTier";

const styleOfRank = (rank: number) => {
  const q = QUALITIES.find((x) => x.rank === rank);
  expect(q, `没有 rank ${rank} 这一档`).toBeDefined();
  return qualityTierStyle(q!.id);
};

describe("品阶强度 · 三段仍是三段", () => {
  it("凡良精共用一个值 —— 档内一致", () => {
    const rows = [0, 1, 2].map(styleOfRank);
    for (const row of rows) expect(row).toEqual({ border: 0.33, bg: 0.06 });
  });

  it("灵玄地共用一个值", () => {
    for (const rank of [3, 4, 5]) expect(styleOfRank(rank)).toEqual({ border: 0.55, bg: 0.1 });
  });
});

describe("品阶强度 · 稀有段内部分层", () => {
  it("天 < 仙 < 神,边与底都严格递增", () => {
    const tian = styleOfRank(6);
    const xian = styleOfRank(7);
    const shen = styleOfRank(8);
    expect(xian.border).toBeGreaterThan(tian.border);
    expect(shen.border).toBeGreaterThan(xian.border);
    expect(xian.bg).toBeGreaterThan(tian.bg);
    expect(shen.bg).toBeGreaterThan(xian.bg);
  });

  it("天品保持原值 —— 已经发到玩家眼里的那一档不许动", () => {
    expect(styleOfRank(6)).toEqual({ border: 0.85, bg: 0.13 });
  });

  it("三档两两不同 —— 摆在一起看得出差别", () => {
    const rows = [6, 7, 8].map(styleOfRank);
    const keys = rows.map((r) => `${r.border}/${r.bg}`);
    expect(new Set(keys).size, "顶三阶里有两档长得一样").toBe(3);
  });
});

describe("品阶强度 · 全序单调且不越界", () => {
  it("rank 涨,边与底都只涨不落", () => {
    let prevBorder = -1;
    let prevBg = -1;
    for (let rank = 0; rank <= 8; rank += 1) {
      const { border, bg } = styleOfRank(rank);
      expect(border, `rank ${rank} 的边比上一档更淡`).toBeGreaterThanOrEqual(prevBorder);
      expect(bg, `rank ${rank} 的底比上一档更淡`).toBeGreaterThanOrEqual(prevBg);
      prevBorder = border;
      prevBg = bg;
    }
  });

  it("顶格是 1.00,底不超过 0.25 —— 不越界", () => {
    for (let rank = 0; rank <= 8; rank += 1) {
      const { border, bg } = styleOfRank(rank);
      expect(border).toBeLessThanOrEqual(1);
      expect(bg).toBeLessThanOrEqual(0.25);
    }
    expect(styleOfRank(8).border).toBe(1);
  });

  it("九档全部有值,且都是有限数", () => {
    for (const q of QUALITIES) {
      const { border, bg } = qualityTierStyle(q.id);
      expect(Number.isFinite(border) && Number.isFinite(bg), `${q.name} 的强度不是有限数`).toBe(
        true,
      );
    }
  });
});

describe("品阶强度 · 与盖章那条界同源", () => {
  it("盖章的那批正是稀有段 —— 同一条 rank ≥ 6", () => {
    for (const q of QUALITIES) {
      const rare = isRareQuality(q.id);
      const inLadder = q.rank >= 6;
      expect(rare, `${q.name} 的盖章判定与稀有段分岔了`).toBe(inLadder);
    }
  });

  it("强度只有一处定义 —— 界面不各写一份", () => {
    const src = readSource("src/ui/qualityTier.ts");
    // 档值表在这里;调用方只读函数
    expect(src).toContain("RARE_LADDER");
    /*
     * 唯一真正消费这份强度的是器评帖(它写进 --equip-edge / --equip-wash)。
     * 行囊格匣走 ledger 模式(细线网格),刻意不铺品阶色 —— 故这里不拿 ItemCell 断言
     * "必须读强度",那会把一个**设计选择**当成缺失。
     */
    const dossier = readSource("src/components/equipment/EquipmentDetailDialog.vue");
    expect(dossier, "器评帖该读共享强度").toContain("qualityTierStyle(");
    expect(dossier, "不该自己写 0.85 / 0.13").not.toMatch(/border:\s*0\.85/);
  });
});
