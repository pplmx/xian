/**
 * 师承的「行为契合」—— 报了分数，却没报分数怎么来的
 *
 * ## 缺口:玩家看得到 -0.6，看不到是什么扣的
 *
 * `core/mentorService` 用一张权重表把玩家的行为计数器折算成契合度:
 *
 * ```text
 *   swordsman（剑修）  kills +1 · bossKills +2 · breakthroughs +0.5 · pillsCrafted -0.6
 *   alchemist（丹修）  pillsCrafted +1 · pillsUsed +1 · kills -0.8
 *   arraymaster（阵师）buildingUpgrades +0.4 · offlineClaims +0.5 · explores -0.8
 *   hunter（猎户）     explores +1 · equipsGained +1 · events +0.5 · buildingUpgrades -0.6
 * ```
 *
 * 而 `MentorDialog` 只印一个数(「行为契合 0.35」)与一句师尊评价。玩家读到
 * 「剑意未纯。你心中有剑,手里却无剑。」时,**看不出是自己丹药炼多了** ——
 * 那条 `-0.6` 的权重只活在代码里。
 *
 * 这违反本仓「决策信息完整」那条:给判断之前把依据摊开,不能只给结论。
 * 更要紧的是**负权重**:加分项玩家迟早会撞对,减分项却是无声的 ——
 * 他可能一直在做让师承更远的事,还以为是别的原因。
 *
 * ## 报什么:两侧都要报,而且报的是**行为**,不是权重数
 *
 * 玩家不需要知道 `kills` 的权重是 `1` 还是 `2`(那是内部归一化的细节),
 * 他要知道的是「这条师承看重什么、忌讳什么」。故:
 *
 *   · **向** —— 与师承同向的行为(「斩妖除魔」「破境精进」)
 *   · **背** —— 与师承相左的行为(「炼丹服丹」)
 *
 * 权重数值不外露:改平衡时那些数会动,而「看重什么」不会。
 *
 * ## 这一层只算，不读 store
 *
 * 计数器的名字 → 人话的映射放在这里,权重表仍只有 `mentorService` 一份 ——
 * 两处各写一份「什么加分」迟早对不上。
 */
import { describe, expect, it } from "vite-plus/test";
import { mentorBehaviorAxes } from "./mentorBehaviorAxes";

describe("师承行为轴 · 纯函数", () => {
  it("四个师承都读得出「向」与「背」两侧", () => {
    for (const id of ["swordsman", "alchemist", "arraymaster", "hunter"] as const) {
      const axes = mentorBehaviorAxes(id);
      expect(axes, `${id} 读不出行为轴`).not.toBeNull();
      expect(axes!.toward.length, `${id} 没报同向行为`).toBeGreaterThan(0);
      expect(axes!.against.length, `${id} 没报相左行为 —— 那正是无声的一半`).toBeGreaterThan(0);
    }
  });

  it("报的是人话,不是计数器键名", () => {
    /*
     * `kills` / `pillsCrafted` 是内部键名。玩家读「kills 加分」等于没读。
     */
    const axes = mentorBehaviorAxes("swordsman")!;
    const all = [...axes.toward, ...axes.against].join(" ");
    for (const key of ["kills", "bossKills", "breakthroughs", "pillsCrafted"]) {
      expect(all, `把计数器键名直接印出来了 —— ${key}`).not.toContain(key);
    }
    expect(all, "要读得出「斩」「丹」这类的行为").toMatch(/斩|丹|破境|炼/);
  });

  it("剑修的忌讳里必须有炼丹 —— 那是它唯一的负权重", () => {
    /*
     * 权重表里 `swordsman.pillsCrafted = -0.6`,是全表里剑修唯一的减分项。
     * 这一条最该被说出来:玩家一边炼丹一边疑惑师尊为何冷淡,正是这个缺口的样子。
     */
    const axes = mentorBehaviorAxes("swordsman")!;
    expect(axes.against.join(" "), "剑修的忌讳里没有炼丹 —— 那 -0.6 就还是无声的").toMatch(/丹/);
  });

  it("丹修的忌讳里必须有厮杀 —— 与剑修正好相反", () => {
    const axes = mentorBehaviorAxes("alchemist")!;
    expect(axes.against.join(" "), "丹修的忌讳里没有厮杀").toMatch(/杀|斩|战/);
  });

  it("两侧不重叠 —— 同一件事不能既加分又扣分", () => {
    for (const id of ["swordsman", "alchemist", "arraymaster", "hunter"] as const) {
      const axes = mentorBehaviorAxes(id)!;
      const overlap = axes.toward.filter((t) => axes.against.includes(t));
      expect(overlap, `${id} 的同一件事同时出现在两侧`).toEqual([]);
    }
  });

  it("没有师承时返回 null —— 不造一份空的轴", () => {
    expect(mentorBehaviorAxes(null)).toBeNull();
  });
});
