import { describe, expect, it } from "vite-plus/test";
import { PILLS } from "@/data/pills";
import { herbGradeOfMajor } from "@/data/herbGrades";
import { EXPLORE_BATTLE_INTERVAL } from "@/data/constants";
import { pillFamily, craftBattlesOf, pillGainSecAt } from "@/core/pillValue";

/**
 * 带内 exp 线无每-成本倒挂(issue #84 同类)。
 *
 * 同品草带的草同价,玩家真正在这几味之间做取舍;若高一味的每-成本反超低一味,
 * 就是「高一味却更不划算」的陷阱 —— 低一味反而成为最优解,高一味是死内容。
 * 这条守卫把修为可炼线按品草带拆开,断言 perKsec 随境界单调不涨。
 *
 * perKsec = (炼成一枚的期望战斗场次 × 每场 12 秒) ÷ 该丹准入境界的药力(等效秒)。
 *
 * 相对容差 1e-3(0.1%):吸收同一带内「相持」线上的模型取整噪声。
 */
describe("带内 exp 线无每-成本倒挂", () => {
  it("同品草带内,修为可炼丹的每-成本随境界单调不涨", () => {
    const TOL = 1e-3;
    const expCraft = PILLS.filter(
      (p) => pillFamily(p) === "exp" && p.recipe && p.instant?.expSecs,
    ).sort((a, b) => a.minRealm - b.minRealm);
    expect(expCraft.length).toBeGreaterThan(0);
    let prevGrade: number | null = null;
    let prevPk = 0;
    let prevName = "";
    for (const p of expCraft) {
      const grade = herbGradeOfMajor(p.minRealm);
      const pk = (craftBattlesOf(p) * EXPLORE_BATTLE_INTERVAL) / pillGainSecAt(p, p.minRealm);
      if (prevGrade !== grade) {
        prevGrade = grade;
        prevPk = pk;
        prevName = p.name;
        continue;
      }
      expect(
        pk,
        `${p.name}(r${p.minRealm}) 的每-成本 ${pk.toFixed(3)} 高于同名草带内更早的 ${prevName} ${prevPk.toFixed(3)},是同带倒挂`,
      ).toBeLessThanOrEqual(prevPk + TOL);
      prevPk = pk;
      prevName = p.name;
    }
  });
});
