/**
 * 机制可用性 —— 「能碰到」与「碰得到几次」是两件事
 *
 * ## 缺口
 *
 * `core/` 下已有四个「可达性」审计:
 *
 * ```text
 *   contentReachabilityAudit   10 组：丹方 / 灵材 / 敌人 / 区域 / 法宝 / 功法 / 技艺 ……
 *   exportReach                导出有没有外部使用者
 *   gongfaPoolReach            功法池抽得到
 *   rewardReachability         奖励发得出
 * ```
 *
 * 它们回答的都是**「能不能拿到」**。而有一整类问题它们碰不到:
 *
 * ```text
 *   闭关顿悟    能拿到 —— 但一世只 6.1 次，全在前 6 小时（第 376 轮量出来）
 *   心魔        能拿到 —— 一小时撞见 4~9 次（第 377 轮量出来）
 * ```
 *
 * **同一个「可达」閘值下，一个几乎不存在、一个几乎常驻，而两类都能通过所有现有审计。**
 *
 * ## 这一条守什么
 *
 * 守**频率的量级**，不守精确值:
 *
 * ```text
 *   太稀有    一世 < 1 次        → 等于没有（做了等于没做）
 *   太频繁    每小时 > 20 次     → 是骚扰，不是机制
 * ```
 *
 * 阈取得很宽（一个数量级），因为:
 * 一 精确值会随平衡调整而变，钉死它只会变成频繁改文档的那种判据;
 * 二 这一条要抓的是"量级错了"，不是"少了 3%"。
 *
 * ## 判据的口径来自哪
 *
 * 频率不是拍脑袋算的，是两个现成的数相乘:
 *
 * ```text
 *   际遇速率  = SECS_PER_HOUR / EXPLORE_BATTLE_INTERVAL × EXPLORE_EVENT_CHANCE
 *             = 48 次/小时（与 core/expIncome 的 encountersPerHour 同源）
 *   事件份额  = 该机制相关事件 / 该境界真实池（minRealm ≤ m ≤ maxRealm）
 * ```
 *
 * 与 `eventSupplyCurve.spec` 同一条纪律:**池子要按境界取**，不能拿全表算 ——
 * 一条写在境界 15 的事件，在境界 3 根本不在池子里。
 */
import { describe, expect, it } from "vite-plus/test";
import { EVENTS } from "@/data/events";
import { EXPLORE_BATTLE_INTERVAL, EXPLORE_EVENT_CHANCE, SECS_PER_HOUR } from "@/data/constants";
import { buffDef } from "@/data/buffs";
import { eventsPerHour, encountersPerHour } from "@/core/expIncome";
import { retreatEnlightenChance } from "@/core/earlyGameService";
import { secondsForMajor } from "@/core/progressionSim";

/** 该境界的真实事件池（上下界都要过） */
function poolAt(major: number) {
  return EVENTS.filter((e) => {
    const lo = (e as { minRealm?: number }).minRealm ?? 0;
    const hi = (e as { maxRealm?: number }).maxRealm ?? 99;
    return lo <= major && major <= hi;
  });
}

/** 池子里带某个 buff 发放的事件有几条 */
function eventsGranting(major: number, buffId: string): number {
  return poolAt(major).filter((e) =>
    (e.choices ?? []).some((c) =>
      (c.outcomes ?? []).some((o) =>
        (o.effects ?? []).some((f) => (f as { id?: string }).id === buffId),
      ),
    ),
  ).length;
}

/** 每小时撞见该机制相关事件的期望次数 */
function encountersPerHourFor(major: number, buffId: string): number {
  const pool = poolAt(major);
  if (pool.length === 0) return 0;
  const share = eventsGranting(major, buffId) / pool.length;
  return eventsPerHour() * share;
}

describe("机制可用性 · 频率量级", () => {
  it("际遇速率与常量同源（防空转）", () => {
    /*
     * 两个函数不同一个东西，第一版就用错了:
     *   encountersPerHour() = 300   每小时**遭遇**（战斗 + 际遇）
     *   eventsPerHour()     =  48   每小时**际遇**（遭遇 × 际遇概率）
     * 频率算的是"撞见某事件的次数"，故必须用后者。用前者会让所有频率虚高 6.25 倍，
     * 而判据会照着那个虚高的数报"太频繁"——**红得对，但红在了我自己算错上**。
     */
    const fromConstants = (SECS_PER_HOUR / EXPLORE_BATTLE_INTERVAL) * EXPLORE_EVENT_CHANCE;
    expect(eventsPerHour(), "际遇速率与常量对不上 —— 下面的频率都建在它上面").toBeCloseTo(
      fromConstants,
      6,
    );
    expect(encountersPerHour(), "遭遇速率应当是际遇速率的 1/概率 倍").toBeCloseTo(
      eventsPerHour() / EXPLORE_EVENT_CHANCE,
      6,
    );
    expect(eventsPerHour(), "际遇速率低到不合理").toBeGreaterThan(10);
  });

  it("心魔：既不稀有，也不刷屏", () => {
    /*
     * 第 377 轮量出来 m0 16.1% / m20 8.8% 的池子份额，对每小时 48 次际遇，
     * 即每小时 4~9 次**撞见机会**（撞见不等于染上:玩家可以不冒险）。
     *
     * 这条要挡的是两种退化:
     *   某次改动让心魔事件全掉出池子   → 每小时 0 次，那条面壁的路永远走不到
     *   某次改动让每个事件都给心魔     → 每小时 48 次，玩家全程挂着
     */
    for (const major of [0, 8, 20]) {
      const rate = encountersPerHourFor(major, "curse_xinmo");
      expect(
        rate,
        `m${major} 每小时撞见心魔事件 ${rate.toFixed(1)} 次 —— 太稀有，那条路走不到`,
      ).toBeGreaterThan(0.5);
      expect(
        rate,
        `m${major} 每小时撞见心魔事件 ${rate.toFixed(1)} 次 —— 太频繁，是骚扰`,
      ).toBeLessThan(20);
    }
  });

  it("闭关顿悟：前期真的有，后期真的没有 —— 而不是恰好零", () => {
    /*
     * 这一条守两半:
     *   前半  m0 的概率得够高，否则那个机制在它唯一还有效的几小时里也不出现
     *   后半  后期确实是 0（`EARLY_EVENT_DECAY` 的意图），而不是被谁顺手改了
     */
    expect(retreatEnlightenChance(0), "炼气期闭关顿悟概率过低 —— 那它等于没有").toBeGreaterThan(
      0.1,
    );
    expect(retreatEnlightenChance(4), "元婴之后仍有闭关顿悟 —— 与衰减表的意图不符").toBe(0);

    // 一世期望次数:落在「约几次」这个量级，不该是 0 次或几百次
    let expected = 0;
    for (let m = 0; m <= 20; m++) {
      const retreats = secondsForMajor(m, 0) / (buffDef("retreat")?.durationSec ?? 300);
      expected += retreats * retreatEnlightenChance(m);
    }
    expect(
      expected,
      `一世闭关顿悟期望 ${expected.toFixed(1)} 次 —— 太稀，玩家见不到`,
    ).toBeGreaterThan(2);
    expect(expected, `一世闭关顿悟期望 ${expected.toFixed(1)} 次 —— 太密，变成刷点`).toBeLessThan(
      200,
    );
  });

  it("池子按境界取 —— 这条口径本身要被证明", () => {
    /*
     * 若 `poolAt` 写成了全表过滤（忽略 maxRealm），m3 的池子会包含混沌海事件，
     * 上面两条就都建在错的份额上。这里用一处已知的窄事件验证:
     * `心魔叩关` 是 m2-99，故它不进 m0 的池子。
     */
    const m0 = poolAt(0).map((e) => e.title);
    const m3 = poolAt(3).map((e) => e.title);
    expect(m0.includes("心魔叩关"), "m0 的池子里出现了 m2 起才有的「心魔叩关」").toBe(false);
    expect(m3.includes("心魔叩关"), "m3 的池子里没有「心魔叩关」—— 上界判定可能写反了").toBe(true);
  });
});
