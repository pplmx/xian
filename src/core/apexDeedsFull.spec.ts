/**
 * 「8 条已满」这一格，永远到不了 8 —— 三条永远 full:false。
 *
 * ## 由来（第 167 轮，终局那一屏）
 *
 * 三生录到顶时的「此世功业」列八条，末尾一句汇总:
 *
 * ```text
 * 界域 4/4 界     敌手 认得 0 种     器谱 读通 0 张
 * 破界 0 次       碑记 1/14 枚       试炼 0/10 门
 * 道痕 0/60 则    功法 0/92 部
 * 0 / 8 条已满        ← 这一句
 * ```
 *
 * 八条里，`enemy` / `blueprint` / `clear` 三条的 `full` 被**写死成 `false`**:
 *
 * ```ts
 * { id: "enemy", label: "敌手", value: `认得 ${n} 种`, full: false, key: 0.5 },
 * ```
 *
 * 理由写在上面那条注释里 ——「没有总数的可靠口径（敌手按区域生成、器谱按装备模板），
 * **编一个分母比不报更糟**」。那个判断是对的，但结论下错了:
 * **「不报比例」不等于「永远不算达成」**。
 *
 * 于是 `8` 那个分母是假的:玩家把敌手全认遍、器谱全读通、破界全踏破，
 * 那一句仍是 `5 / 8 条已满`。终局最该收束成一句「我这一世成了什么」的地方，
 * 永远欠三条。
 *
 * ## 判据
 *
 * ① 每条功业都有**可判定的达成条件**（`full` 不许是字面 `false`）;
 * ② 没有分母的那三条，达成条件由**来源自己的口径**给（不编分母）;
 * ③ 全都做到时，汇总真的读 `8 / 8`。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { apexDeeds, apexDeedSummary } from "./apexDeeds";

const SRC = readSource("src/core/apexDeeds.ts");

/** 一个「什么都做到了」的终局读数 */
const ALL_DONE = {
  trialsCleared: 200,
  trialsTotal: 20,
  marks: 60,
  marksCap: 60,
  worldsCrossed: 4,
  worldsTotal: 4,
  gongfaLearned: 92,
  gongfaTotal: 92,
  enemiesKnown: 999,
  blueprintsMastered: 999,
  worldClears: 99,
  milestonesDone: 14,
  milestonesTotal: 14,
} as const;

describe("此世功业 · 八条都要能满", () => {
  it("不许有写死 full:false 的条目", () => {
    /*
     * 判的是那件事:每条的 `full` 都是**算出来的**，不是字面常量。
     * 「编一个分母比不报更糟」仍然成立 —— 但那是「不报比例」，不是「不算达成」。
     */
    expect(SRC, "还有写死 full: false 的条目").not.toMatch(/full:\s*false/);
  });

  it("没有分母的三条，达成条件来自各自的口径", () => {
    /*
     * 敌手 / 器谱 / 破界都从「有没有」判：认得至少一种、读通至少一张、
     * 破过至少一次。这不是编分母 —— 是「这件事发生过没有」。
     */
    expect(SRC, "敌手要能判达成").toMatch(/enemiesKnown\s*>\s*0/);
    expect(SRC, "器谱要能判达成").toMatch(/blueprintsMastered\s*>\s*0/);
    expect(SRC, "破界要能判达成").toMatch(/worldClears\s*>\s*0/);
  });

  it("全都做到时，汇总读 8 / 8", () => {
    const deeds = apexDeeds(ALL_DONE);
    expect(deeds.length, "仍是八条").toBe(8);
    const sum = apexDeedSummary(deeds);
    expect(sum.done, `汇总只到 ${sum.done}/${sum.total} —— 终局最该收束的那一句永远欠几条`).toBe(8);
    expect(sum.total).toBe(8);
  });

  it("一条都没做时，汇总读 0 / 8（不是「靠 full:false 凑出来的 0」）", () => {
    const deeds = apexDeeds({
      trialsCleared: 0,
      trialsTotal: 20,
      marks: 0,
      marksCap: 60,
      worldsCrossed: 0,
      worldsTotal: 4,
      gongfaLearned: 0,
      gongfaTotal: 92,
      enemiesKnown: 0,
      blueprintsMastered: 0,
      worldClears: 0,
      milestonesDone: 0,
      milestonesTotal: 14,
    });
    expect(apexDeedSummary(deeds).done).toBe(0);
  });
});
