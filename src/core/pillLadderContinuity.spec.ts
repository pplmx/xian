/**
 * 灵气丹在人间界中间断了一大片。
 *
 * ## 由来（第 500 轮）
 *
 * 查丹药的效果分布时，把每一族的「境界链」拉出来看:
 *
 * ```text
 *   修为丹   每境都有（20 味）
 *   灵气丹   境界 0, 0, 2, 6, 10, 11, 14, 18      ← 只有 8 味，中间隔着好几境
 *   寿元丹   境界 2, 4, 4, 5, 6, 12, 13, 14, 17, 19, 20
 * ```
 *
 * 灵气是核心资源（`qiPct` 直接回气）。而一位元婴（境 3）或化神（境 4）的玩家，
 * 想找一味回气的丹—— **一味都没有**。
 *
 * ## 判据
 *
 * ① 人间界（境 0~8）每一境至少有一味回气丹;
 * ② 反差:不要求每境都有寿元丹（寿元是稀缺的，隔几境有一味才合理）;
 * ③ 反差:回气丹的境界必须单调覆盖 —— 不许只补中间某一境而留下更早的空洞。
 */
import { describe, expect, it } from "vite-plus/test";
import { PILLS } from "@/data/pills";

/** 有回气效果的丹药 */
function qiPills() {
  return PILLS.filter(
    (p) => p.instant && !Array.isArray(p.instant) && "qiPct" in (p.instant as object),
  );
}

describe("丹药的境界链 · 回气不该断档", () => {
  it("① 人间界每一境至少有一味回气丹", () => {
    const realms = new Set(qiPills().map((p) => p.minRealm));
    const gaps: string[] = [];
    for (let m = 0; m <= 8; m += 1) {
      if (!realms.has(m)) gaps.push(`境 ${m}`);
    }
    expect(gaps, "这些境界没有回气丹 —— 玩家只能干等：" + gaps.join("、")).toEqual([]);
  });

  it("② 反差：不要求每境都有寿元丹", () => {
    /*
     * 寿元是稀缺资源，隔几境有一味才合理。
     * 这一条守的是①的边界 —— 免得后来者把判据扩成「每一族每境都要有」。
     */
    const ls = PILLS.filter(
      (p) => p.instant && !Array.isArray(p.instant) && "lifespanYears" in (p.instant as object),
    );
    const realms = new Set(ls.map((p) => p.minRealm));
    expect(ls.length, "寿元丹一味都没有 —— 那一族被删光了？").toBeGreaterThan(5);
    expect(realms.size, "寿元丹挤在同一个境界 —— 那也不好").toBeGreaterThan(3);
  });

  it("③ 反差：回气丹的境界要覆盖到高段，不只补中间", () => {
    const realms = qiPills().map((p) => p.minRealm);
    const max = Math.max(...realms);
    expect(max, `回气丹最高只到境 ${max} —— 界外没有回气手段`).toBeGreaterThanOrEqual(14);
  });
});
