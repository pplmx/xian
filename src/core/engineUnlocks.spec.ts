/**
 * 成就登记簿的四条口径 —— 文件头把它们列得很清楚,而此前一条判据都没有。
 *
 * ## 文件头原文
 *
 * > 搬过来的是四条口径:**只登记一次**、**一次扫描可解多条且顺序即声明顺序**、
 * > **未达成不登记**、**显式解锁同样去重** —— 状态型成就(寿元告急 / 灵石百万)
 * > 由周期检查反复触发,少了去重就会每拍发一次奖。
 *
 * 四条都写着「为什么」,唯独没有东西在守它们。第 87~88 轮扫「导出函数没被任何
 * spec 提到」时,`achievementIdsOf` / `unlockAchievementById` / `scanAchievements` /
 * `achievementCounts` 四个全在名单里 —— 而这个模块**连 spec 文件都没有**。
 *
 * ## 最要紧的是第 ④ 条
 *
 * 前三条是解锁逻辑的常识,第四条不是:状态型成就(「寿元告急」「灵石百万」)由
 * 周期检查**反复触发**,每拍都会来问一次「该不该发」。少了去重,玩家会每拍得一次奖。
 *
 * 这不是理论风险 —— 文件头那句「少了去重就会每拍发一次奖」是记下来的事故。
 */
import { describe, expect, it } from "vite-plus/test";
import { ACHIEVEMENTS } from "@/data/achievements";
import {
  achievementCounts,
  achievementIdsOf,
  achievementStateOf,
  scanAchievements,
  unlockAchievementById,
} from "./engineUnlocks";

/** 一枚已知成就,用作样本 */
const SAMPLE = ACHIEVEMENTS[0]!;

describe("成就登记簿 · 四条口径", () => {
  it("① 只登记一次:同一枚解锁两次,第二次不再算新解", () => {
    const empty = achievementStateOf([]);
    const first = unlockAchievementById(empty, SAMPLE.id);
    expect(first.unlocked, "第一次解锁没成功 —— 后面的判据全在空转").toBe(true);
    expect(first.def?.id, "解锁返回的定义与传入的 id 不一致").toBe(SAMPLE.id);

    const second = unlockAchievementById(first.state, SAMPLE.id);
    expect(second.unlocked, "同一枚成就被解锁了两次 —— 会重复发奖").toBe(false);
    expect(achievementIdsOf(second.state), "重复解锁让 id 表里多出一条").toEqual([SAMPLE.id]);
  });

  it("② 一次扫描可解多条,且顺序即声明顺序", () => {
    const empty = achievementStateOf([]);
    const { newly } = scanAchievements(empty, () => true);
    expect(
      newly.length,
      `全通过扫描只解出 ${newly.length} 条 / 共 ${ACHIEVEMENTS.length} —— 一次扫描放不出多条`,
    ).toBe(ACHIEVEMENTS.length);

    /*
     * 「顺序即声明顺序」是给人看的:解锁播报按这个顺序弹,
     * 若它跟着 Map 的插入顺序漂,同一批成就在两次游戏里的报喜次序会不一样。
     */
    const declared = ACHIEVEMENTS.filter((a) => newly.some((n) => n.id === a.id)).map((a) => a.id);
    expect(
      newly.map((n) => n.id),
      "扫描结果的顺序不是 ACHIEVEMENTS 的声明顺序",
    ).toEqual(declared);
  });

  it("③ 未达成不登记", () => {
    const empty = achievementStateOf([]);
    const { state, newly } = scanAchievements(empty, () => false);
    expect(newly, "判据全 false 却解出了成就").toEqual([]);
    expect(achievementIdsOf(state), "判据全 false 却在状态里留下了记录").toEqual([]);
  });

  it("④ 显式解锁同样去重 —— 状态型成就会反复来问", () => {
    /*
     * 这一条最要紧。状态型成就(「寿元告急」「灵石百万」)由周期检查每拍触发;
     * 若显式解锁路径不去重,玩家会**每拍得一次奖**。
     *
     * 用「连问五次」来模拟周期检查,只有第一次该算新解。
     */
    let state = achievementStateOf([]);
    let unlocks = 0;
    for (let tick = 0; tick < 5; tick += 1) {
      const out = unlockAchievementById(state, SAMPLE.id);
      state = out.state;
      if (out.unlocked) unlocks += 1;
    }
    expect(unlocks, `连问五次解出了 ${unlocks} 次 —— 状态型成就会每拍发一次奖`).toBe(1);
    expect(achievementIdsOf(state).length, "连问五次后状态里有多条记录").toBe(1);
  });

  it("未知 id 不解锁,也不改状态", () => {
    const empty = achievementStateOf([]);
    const out = unlockAchievementById(empty, "不存在的成就id");
    expect(out.unlocked, "未知 id 被解开了").toBe(false);
    expect(out.def, "未知 id 返回了定义").toBeNull();
    expect(achievementIdsOf(out.state), "未知 id 改了状态").toEqual([]);
  });

  it("计数读数自洽:已解 + 未解 = 总数", () => {
    const empty = achievementStateOf([]);
    const c0 = achievementCounts(empty);
    expect(c0.done, "空状态却已解过").toBe(0);
    expect(c0.total, "总数与 ACHIEVEMENTS 不一致").toBe(ACHIEVEMENTS.length);
    expect(c0.remaining, "空状态的剩余数不等于总数").toBe(ACHIEVEMENTS.length);

    const one = unlockAchievementById(empty, SAMPLE.id);
    const c1 = achievementCounts(one.state);
    expect(c1.done).toBe(1);
    expect(c1.done + c1.remaining, "已解 + 未解 ≠ 总数 —— 两处读数会互相矛盾").toBe(c1.total);
  });

  it("状态往返:存档里存的是 id 数组,读回来还是同一批", () => {
    const empty = achievementStateOf([]);
    const { state } = scanAchievements(empty, () => true);
    const ids = achievementIdsOf(state);
    expect(ids.length).toBe(ACHIEVEMENTS.length);
    // 再把这个 id 数组读回状态,计数必须一致 —— 存档只有这三个环节
    const roundTripped = achievementStateOf(ids);
    expect(
      achievementCounts(roundTripped).done,
      "id 数组读回状态后已解数变了 —— 存档往返会丢成就",
    ).toBe(achievementCounts(state).done);
  });

  it("反空转:成就表非空,id 唯一", () => {
    expect(ACHIEVEMENTS.length, "成就表空了").toBeGreaterThan(10);
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size, "成就 id 有重复 —— 登记簿按 id 建索引会静默丢条目").toBe(ids.length);
  });
});
