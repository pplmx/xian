/**
 * 刚进仙界那一境，可用事件从 73 则掉到 35 则。
 *
 * ## 由来（第 518 轮）
 *
 * 继续用「把一族内容摊在轴上」这条量法。摊了六族:敌人 tier 32/32、法宝 fromTier 32/32、
 * 灵兽七档全有、功法品阶（档案第 13244 行早有专节），事件按境界带 46 则 vs 87 则。
 *
 * 前四族都不薄。第五族那个「46 vs 87」我一开始读成「仙界前段偏薄」——
 * 而真正的入口在别处:
 *
 * ```text
 *   EventDef 的门是 minRealm ≤ 当前境界 ≤ maxRealm（eventEngine 第 56 行）。
 *   minRealm 是**下界**，从那一境起一直可用；而人间界的事件带 maxRealm 上限，
 *   进仙界之后就不再出现。
 * ```
 *
 * 故按「某一境当场能抽到多少则」重算:
 *
 * ```text
 *   境 0   63 则
 *   境 3   78 则
 *   境 6   73 则
 *   境 9   35 则   ← 掉了一半
 *   境 12  48 则
 *   境 15  62 则
 *   境 18  66 则
 *   境 20  72 则
 * ```
 *
 * **这是一处断层**：玩家刚跨进仙界，看得见的事件池从 73 掉到 35。
 * 而跨界的正是本作最郑重的一步（三处跨界入口都要渡劫）。
 *
 * ## 判据
 *
 * ① 相邻两境的可用事件数不许腰斩（跌超四成即为断层）;
 * ② 反差：数量少不一定坏 —— 仙界内容更精（长事件、连锁多），故只判**跌幅**不判绝对值;
 * ③ 反差：maxRealm 是正常的（人间的事到了仙界不该再撞见），不许为了凑数把它删掉。
 */
import { describe, expect, it } from "vite-plus/test";
import { EVENTS } from "@/data/events";

/** 某一境当场能抽到的事件数（与 eventEngine 第 56 行同一口径） */
function availableAt(realm: number): number {
  return EVENTS.filter((e) => {
    const min = (e as unknown as { minRealm?: number }).minRealm ?? 0;
    const max = (e as unknown as { maxRealm?: number }).maxRealm ?? 99;
    return min <= realm && max >= realm;
  }).length;
}

describe("境界带 · 越过那一境时，池子不许腰斩", () => {
  it("① 相邻两境的可用事件数跌幅不超过四成", () => {
    const cliffs: string[] = [];
    for (let r = 1; r <= 20; r += 1) {
      const prev = availableAt(r - 1);
      const cur = availableAt(r);
      if (prev === 0) continue;
      const drop = (prev - cur) / prev;
      if (drop > 0.4) {
        cliffs.push(`境 ${r - 1}→${r}: ${prev} → ${cur} 则（跌 ${Math.round(drop * 100)}%）`);
      }
    }
    expect(
      cliffs,
      "这些境界之间可用事件腰斩 —— 玩家刚跨过去就只剩一半的事可撞见：" + cliffs.join("；"),
    ).toEqual([]);
  });

  it("② 反差：只判跌幅，不判绝对值", () => {
    /*
     * 仙界的内容更精（长事件、连锁多），35 则未必比 63 则差。
     * 这一条守的是①的边界 —— 不许把「数量少」本身当成缺陷。
     */
    const anyRealm = availableAt(20);
    expect(anyRealm, "终局一境什么都抽不到").toBeGreaterThan(0);
  });

  it("③ 反差：maxRealm 是正常的，不许为了凑数删掉它", () => {
    /*
     * 人间的事到了仙界不该再撞见 —— 那是设计，不是缺陷。
     * 这条断言确认「有上限」这件事仍在（否则①的分母会一直变大，判据失去意义）。
     */
    const withMax = EVENTS.filter(
      (e) => (e as unknown as { maxRealm?: number }).maxRealm !== undefined,
    );
    expect(withMax.length, "没有任何事件设 maxRealm —— 那跨界的断层判定无从谈起").toBeGreaterThan(
      EVENTS.length / 10,
    );
  });
});
