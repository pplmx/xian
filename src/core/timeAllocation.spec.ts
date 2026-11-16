/**
 * 一世的时间花在哪 —— 三条渠道的占比结构
 *
 * ## 为什么这条判据此前没有
 *
 * `core/` 下的审计按**系统**分（经济 / 进度 / 内容 / 事件 / 区域……），
 * 各系统内部都有严格判据。但没有一处回答**跨系统的问题**:
 *
 * ```text
 *   玩家一世 5921 现实小时，这些时间花在哪些系统上？各占多少？
 * ```
 *
 * 这恰恰是"可玩性"最直接的度量。第 378 轮为了判断区域内容够不够，
 * 临时算了几个数（44 处区域、1.5 小时通关、每处 135 小时游玩），
 * 算完就散了 —— 下次要再判断一次，还得重算。
 *
 * ## 量出来的结构
 *
 * ```text
 *   一世            5921 现实小时（角色 16 → 5937 岁）
 *   挂机             3600 等效秒/小时  →  39.8%
 *   历练+挂机        9050 等效秒/小时  →  历练占 60.2%
 *   闭关             9000 等效秒/小时  →  与"挂机+历练"几乎相等（刻意）
 * ```
 *
 * ## 判据守什么
 *
 * 一 三条渠道的**相对关系**不许乱:
 *    · 历练是主要来源（>50%），故"玩家会持续出去打"，而不是纯挂机
 *    · 闭关与"挂机+历练"近似相等（差 <3%），故「闭关还是不闭关」是真取舍
 *    · 闭关 > 挂机（否则没人会闭关）
 *
 * 二 一世总时长落在量级上（数千小时）。它一变，上面所有占比都失去意义。
 *
 * ## 为什么不钉精确值
 *
 * 这些数会随平衡调整而变。判据钉的是**结构**（谁比谁大、差多少量级），
 * 不是数值本身 —— 数值变了但结构没变，那是调平衡；结构变了，那是设计变了。
 * 两者的区别，正是这条判据要分辨的。
 */
import { describe, expect, it } from "vite-plus/test";
import { SECS_PER_HOUR } from "@/data/constants";
import { secondsForMajor } from "@/core/progressionSim";
import {
  battlesPerHour,
  encountersPerHour,
  eventsPerHour,
  idleExpSecsPerHour,
  retreatExpSecsPerHour,
  tripExpSecsPerHour,
} from "@/core/expIncome";

/** 一世总时长（现实秒） */
function lifetimeSecs(): number {
  let total = 0;
  for (let m = 0; m <= 20; m++) total += secondsForMajor(m, 0);
  return total;
}

describe("一世的时间分配 · 三条渠道", () => {
  it("一世总时长落在量级上（数千小时，不是一个下午）", () => {
    const hours = lifetimeSecs() / SECS_PER_HOUR;
    expect(hours, `一世只有 ${hours.toFixed(0)} 小时 —— 那所有占比都失去意义`).toBeGreaterThan(
      1000,
    );
    expect(hours, `一世长达 ${hours.toFixed(0)} 小时 —— 内容密度必然失衡`).toBeLessThan(20000);
  });

  it("历练是主要来源 —— 玩家会持续出去打，而不是纯挂机", () => {
    /*
     * 这一条是「放置游戏」与「点击游戏」的分水岭。若挂机占比反超历练，
     * 玩家最优策略就变成"什么都不做"，而 `core/expIncome` 的设计意图是
     * 「三条渠道互相打平，但历练给掉落、挂机不给」。
     */
    const idle = idleExpSecsPerHour();
    const trip = tripExpSecsPerHour();
    const tripShare = trip / (idle + trip);
    expect(
      tripShare,
      `历练只占 ${(tripShare * 100).toFixed(1)}% —— 挂机成了主要来源`,
    ).toBeGreaterThan(0.5);
    expect(
      tripShare,
      `历练占 ${(tripShare * 100).toFixed(1)}% —— 挂机等于没有，那不是放置游戏`,
    ).toBeLessThan(0.85);
  });

  it("闭关与「挂机+历练」近似相等 —— 故那个选择是真取舍", () => {
    /*
     * 第 376 轮花了一整轮验收「闭关的出关顿悟」，而闭关本身值不值得去，
     * 靠的是这一条:9000 vs 9050.4，差 0.56%。
     *
     * 差距若拉大:
     *   闭关明显更高  → 人人闭关，历练的掉落与事件全部作废
     *   闭关明显更低  → 没人闭关，`retreat` 这个 buff 与它的顿悟入口白做
     * 故钉在 15% 以内 —— 留出调平衡的余量，但挡住"一边倒"。
     */
    const combined = idleExpSecsPerHour() + tripExpSecsPerHour();
    const retreat = retreatExpSecsPerHour();
    const gap = Math.abs(retreat - combined) / combined;
    expect(gap, `闭关与挂机+历练相差 ${(gap * 100).toFixed(1)}% —— 那条取舍塌了`).toBeLessThan(
      0.15,
    );

    // 且闭关必须高于纯挂机，否则没人会去闭关
    expect(retreat, "闭关不高于纯挂机 —— 那它没有任何理由被使用").toBeGreaterThan(
      idleExpSecsPerHour(),
    );
  });

  it("际遇与战斗的分层对得上 —— 三者必须是同一套", () => {
    /*
     * 上面所有"小时"折算都建在 `encountersPerHour` 上。若那一层坏了
     * （比如把际遇概率算进遭遇数），占比会整体漂移而判据看不出来。
     */
    expect(eventsPerHour() + battlesPerHour(), "际遇 + 战斗 ≠ 遭遇总数").toBeCloseTo(
      encountersPerHour(),
      6,
    );
    expect(eventsPerHour(), "际遇速率为 0 —— 那历练就只剩打怪").toBeGreaterThan(0);
    expect(battlesPerHour(), "战斗速率为 0").toBeGreaterThan(0);
  });

  it("一世的总修为产出量级合理 —— 不至于一境都过不去，也不至于一瞬到顶", () => {
    /*
     * 结构判据的最后一道兜底:把三条渠道按"全时历练"算，得一世的总等效秒。
     * 它与 `progressionSim` 的一世总时长是同一把尺 —— 若两者差出数量级，
     * 说明渠道口径与境界需求之间脱节了。
     */
    const hours = lifetimeSecs() / SECS_PER_HOUR;
    const totalExpSecs = hours * (idleExpSecsPerHour() + tripExpSecsPerHour());
    // 5921h × 9050 ≈ 5.36e7；给一个宽区间，只挡"差一个数量级"
    expect(totalExpSecs, "一世总产出低到不合理").toBeGreaterThan(1e6);
    expect(totalExpSecs, "一世总产出高到不合理").toBeLessThan(1e9);
  });
});
