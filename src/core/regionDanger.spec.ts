/**
 * 地界凶险 —— 三十处区域挤在同一个「绝地」上。
 *
 * ## 问题:刻度的上限撞到了
 *
 * `RegionDef.danger` 的类型是 `1 | 2 | 3 | 4 | 5`,名字表 `DANGER_NAMES` 是
 * 平缓 / 寻常 / 凶险 / 大凶 / 绝地 —— 五档。而区域一共 44 处、层级 1~32:
 *
 * ```text
 * 危险=1: 2 处  危险=2: 3 处  危险=3: 4 处  危险=4: 5 处  危险=5: 30 处
 * ```
 *
 * 从 tier 15(九幽魔渊,境界 6)起,danger 再没变过,一直到 tier 32 的道祖悟道崖。
 * **29 处区域的凶险读数完全相同**:
 *
 *   · 选地卡上那一行报的是同一句「绝地」;
 *   · 敌势里那一项乘的是同一个 `1 + (5-1) × 0.05 = 1.20`;
 *   · 玩家在人间界末段看到「绝地」,到了混沌海最深处还是「绝地」。
 *
 * 这不是设计取舍 —— 类型只给了五档,写不下去了。tier 主导强度(`enemyGearFactor`
 * 按 tier 指数增长),所以它不致命;但「地界凶险」这一项在 29 处区域上是**死刻度**,
 * 玩家看得见、却不再给任何信息。
 *
 * ## 判据守什么
 *
 * 1. 高界区域的凶险档必须能继续递进(刻度的档数要够用);
 * 2. 最高一档不许一枝独大 —— 单一档位覆盖超过全表一半,那一档就不再是「最险的少数」。
 *
 * 它不规定每处该填几 —— 那是内容设计的事;它只钉住「这一项还有分辨力」。
 */
import { describe, expect, it } from "vite-plus/test";
import { REGIONS, DANGER_NAMES } from "@/data/regions";

/** 档位名去掉开头那个占位空串 */
const MAX_DANGER = DANGER_NAMES.length - 1;

describe("地界凶险刻度", () => {
  it("最高一档不许覆盖超过全表一半的区域", () => {
    const atTop = REGIONS.filter((r) => r.danger === MAX_DANGER).length;
    const share = atTop / REGIONS.length;
    expect(
      share,
      `「${DANGER_NAMES[MAX_DANGER]}」覆盖了 ${atTop}/${REGIONS.length} 处区域(${(share * 100).toFixed(0)}%)` +
        ` —— 超过一半时它就不再是「最险的少数」,而成了默认值`,
    ).toBeLessThanOrEqual(0.5);
  });

  it("tier 20 之后仍有凶险递进", () => {
    /*
     * 高界（tier 20 之后)是终局那一段:玩家一路打到混沌海,若凶险读数一直不动,
     * 这一项对他就彻底没有信息了。判据要求**那一段内部至少有两次档位变化**,
     * 不是要求每一 tier 都不同 —— 每两个 tier 一处变化就够。
     */
    const late = REGIONS.filter((r) => r.tier >= 20).sort((a, b) => a.tier - b.tier);
    const changes = late.filter((r, i) => i > 0 && r.danger !== late[i - 1]!.danger).length;
    expect(
      changes,
      `tier 20 之后的 ${late.length} 处区域里凶险档只变了 ${changes} 次 —— 终局那一段的「地界凶险」是死刻度`,
    ).toBeGreaterThanOrEqual(2);
  });
});
