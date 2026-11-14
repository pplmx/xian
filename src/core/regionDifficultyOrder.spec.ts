/**
 * 区域的难度顺序：tier 与 minRealm 都必须单调不减。
 *
 * ## 由来（第 268 轮）
 *
 * 查「难度曲线是不是真的存在」，先把 44 个区域的 tier 与 minRealm 摊出来:
 *
 * ```text
 * tier      1,2,3,…,20,21,21,22,22,23,23,…,31,31,32,32
 * minRealm  0,0,1,1,1,2,2,3,3,3,4,4,…,19,19,20,20
 * ```
 *
 * 两条都严格递增，后来 tier 每档配两个区域。**曲线是平滑的。**
 *
 * ## 但没人守着
 *
 * `engineProgressionAudit.spec` 有五条很强的判据（格数、步长、换界形状、
 * 内容强度与战斗快照同源），但都不管「区域在列表里的顺序」。
 *
 * 而这件事**没有任何类型约束**:`tier` 是 `number`，`minRealm` 是 `number`，
 * 往 `REGIONS` 中间插一个 tier 更小的区域，编译不报、界面也不报 ——
 * 玩家只会看到「越往后越轻松」。
 *
 * ## 判据
 *
 * ① 防空转:区域数 >20、tier 跨度 >20;
 * ② tier 单调不减（允许相等:后期一档两个区域是有意的）;
 * ③ minRealm 单调不减;
 * ④ tier 的每一档都至少有一个区域（不许跳档）。
 *
 * ④ 是这条判据特有的一维:跳档意味着某个难度没有任何区域承接 ——
 * 玩家会在两个相邻区域之间遇到一段空档。
 */
import { describe, expect, it } from "vite-plus/test";
import { REGIONS } from "@/data/regions";

describe("区域难度顺序 · 越往后越难，不许回头", () => {
  it("扫得到足够多的区域与 tier 跨度（防空转）", () => {
    expect(REGIONS.length, "区域太少 —— 扫错地方了").toBeGreaterThan(20);
    const tiers = REGIONS.map((r) => r.tier);
    expect(Math.max(...tiers) - Math.min(...tiers), "tier 跨度太小").toBeGreaterThan(20);
  });

  it("tier 单调不减", () => {
    const drops: string[] = [];
    for (let i = 1; i < REGIONS.length; i += 1) {
      const prev = REGIONS[i - 1]!;
      const cur = REGIONS[i]!;
      if (cur.tier < prev.tier)
        drops.push(`${prev.name}(tier ${prev.tier}) → ${cur.name}(tier ${cur.tier})`);
    }
    expect(
      drops,
      "这些相邻区域的 tier 倒退了 —— 玩家会看到越往后越轻松:" + drops.join(" / "),
    ).toEqual([]);
  });

  it("minRealm 单调不减", () => {
    const drops: string[] = [];
    for (let i = 1; i < REGIONS.length; i += 1) {
      const prev = REGIONS[i - 1]!;
      const cur = REGIONS[i]!;
      if (cur.minRealm < prev.minRealm) {
        drops.push(`${prev.name}(需 ${prev.minRealm} 境) → ${cur.name}(需 ${cur.minRealm} 境)`);
      }
    }
    expect(
      drops,
      "这些相邻区域的境界门槛倒退了 —— 门槛先开后关，玩家会被挡在门外:" + drops.join(" / "),
    ).toEqual([]);
  });

  it("tier 不许跳档", () => {
    const tiers = new Set(REGIONS.map((r) => r.tier));
    const max = Math.max(...tiers);
    const missing: number[] = [];
    for (let t = 1; t <= max; t += 1) if (!tiers.has(t)) missing.push(t);
    expect(
      missing,
      "这些 tier 没有任何区域承接 —— 相邻两区之间会有一段难度空档:" + missing.join(" / "),
    ).toEqual([]);
  });
});
