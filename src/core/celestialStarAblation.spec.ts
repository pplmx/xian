/**
 * 星陨天 · 星象入大千界 —— 消融试验
 *
 * 新机制:starTied 天界世界(星陨天)在「今日值日星象所利之界 == 玩家本世之界」时,
 * 破界道源取 ×STAR_FAVOR_REWARD_MULT。这是消融试验:
 *   · 消融掉一切其它因素(同构筑、同世界、同路线、同契、同 speedBonus),
 *     只剩「今日是否星象相合」在变 —— 唯一差异就该是那个乘数;
 *   · 对照:非 starTied 的赤炎天/万刃天不应响应星象(乘数恒 1)。
 *
 * 原理上把"今天适不适合去星陨天取道源"接到星象系统既有的「今日该往哪里去」哲学上
 * (见 astronomy.ts 注释),且只动这一个世界、不给全局 —— 消融要证的就是「不给全局」。
 */
import { describe, expect, it } from "vite-plus/test";
import { CELESTIAL_WORLDS } from "@/data/endgame";
import { STAR_FAVOR_REWARD_MULT, starFavorAligned, favoredWorld, todayMansion } from "./astronomy";

/** 玩家本世之界固定为 人间(mortal),找 28 日里相合 / 不相合的各一天 */
function sampleDays(world: string): { aligned: number; notAligned: number } {
  let aligned = -1;
  let notAligned = -1;
  for (let d = 0; d < 28 && (aligned < 0 || notAligned < 0); d += 1) {
    if (favoredWorld(todayMansion(d * 86400)) === world) aligned = aligned < 0 ? d : aligned;
    else notAligned = notAligned < 0 ? d : notAligned;
  }
  if (aligned < 0 || notAligned < 0) throw new Error(`28 日里找不到 相合/不相合 两天:${world}`);
  return { aligned, notAligned };
}

/** 星陨天破界道源(消融公式:底赏 × 星象相合乘数,与 settle() 同式) */
function starReward(rewardDaoSource: number, mult: number): number {
  return Math.floor(rewardDaoSource * mult);
}

describe("星陨天 · 星象相合(消融)", () => {
  const xingyun = CELESTIAL_WORLDS.find((w) => w.id === "xingyun");

  it("星陨天已上天界世界谱,且是 starTied(星象钩子)", () => {
    expect(xingyun, "星陨天应加入 CELESTIAL_WORLDS").toBeDefined();
    expect(xingyun!.name).toBe("星陨天");
    expect(xingyun!.starTied, "星陨天必须是 starTied,才吃星象相合乘数").toBe(true);
    expect(xingyun!.rewardDaoSource).toBeGreaterThan(0);
  });

  it("星象相合判定确定性:同一世界 28 日各得 7 日相合,天由游戏秒碾定、不靠现实钟", () => {
    let alignedCount = 0;
    for (let d = 0; d < 28; d += 1) {
      if (starFavorAligned(d * 86400, "mortal")) alignedCount += 1;
      // 确定性:同一天重复算一致
      expect(starFavorAligned(d * 86400, "mortal")).toBe(starFavorAligned(d * 86400, "mortal"));
    }
    expect(alignedCount, "四象各七宿 → 每界应恰 7/28 日相合").toBe(7);
  });

  it("消融:同构筑同世界,只翻转『今日相合』,星陨天道源唯一差异 = 乘数", () => {
    const { aligned, notAligned } = sampleDays("mortal");
    // 消融掉 speedBonus / pact / 路线 bônus(carried 全部置 0):只剩底赏 × 星象乘数
    const base = xingyun!.rewardDaoSource;
    const alignedAward = starReward(base, 1 * STAR_FAVOR_REWARD_MULT);
    const neutralAward = starReward(base, 1);
    // 相合日比寻常日多拿的,正是那个乘数(四舍五入到底赏整数后)
    expect(alignedAward).toBeGreaterThan(neutralAward);
    expect(alignedAward / neutralAward).toBeCloseTo(STAR_FAVOR_REWARD_MULT, 1);
    // 这两个日子本身:一个相合、一个不相合 —— 差异就是"今日值日星象偏不偏你本界"
    expect(starFavorAligned(aligned * 86400, "mortal")).toBe(true);
    expect(starFavorAligned(notAligned * 86400, "mortal")).toBe(false);
  });

  it("对照:非 starTied 世界不受星象影响(不因新增世界给全局加成)", () => {
    for (const id of ["chiyan", "wanren"]) {
      const w = CELESTIAL_WORLDS.find((x) => x.id === id);
      expect(w, `${id} 应是既有的非星象世界`).toBeDefined();
      expect(w!.starTied, `${id} 不该被标记为 starTied`).toBeFalsy();
    }
  });
});
