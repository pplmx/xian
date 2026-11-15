/**
 * 闭关的尽头有机缘 —— 顿悟不该只挂在打赢之后
 *
 * ## 由来
 *
 * 顿悟（`ENLIGHTENMENT_OPTIONS`，7 种）目前只有**一个**触发点:
 * `recordWin()` —— 打赢一场之后 `mayTriggerEnlightenment()`。
 *
 * 而「闭关」在修仙题材里恰恰是最该出顿悟的时候:收摄心神、周天运转、
 * 忽然有所悟。它现在是一个纯数值 buff（5 分钟、修炼速度 +150%、
 * 禁外出历练），闭完就完了 —— 期间**没有任何事可能发生**。
 *
 * ```text
 *   原来的闭关   点下去 → 等 5 分钟 → 回到原处，只是修速快了一阵
 *   该有的闭关   点下去 → 等 5 分钟 → 出关时可能带回来一点什么
 * ```
 *
 * ## 为什么不能直接复用 mayTriggerEnlightenment
 *
 * 它是「打赢之后掷一次」，而闭关是「5 分钟结束掷一次」。两个调用点直接并排写，
 * 会有两个问题:
 *
 * ```text
 *   一 冷却被绕过    mayTriggerEnlightenment 的 5 分钟冷却写在它自己里面，
 *                    闭关 5 分钟正好踩线 —— 看起来没问题，但玩家可以
 *                    「闭关结束立刻再闭关」，两次都可能中，而冷却本意是限频
 *   二 概率口径不同   战斗是"每场一次遭遇"，闭关是"每 5 分钟一次"。
 *                    两个 8% 的含义完全不同（一场战斗约 15 秒）
 * ```
 *
 * 故闭关这一侧单独给一个概率，并且**明确按「一次闭关」计**，而不是按分钟折算 ——
 * 后者会让"一直闭关"和"一直打怪"的期望产出趋同，读起来像在偷偷鼓励挂机。
 *
 * ## 判据守什么
 *
 * 一 闭关结束会掷一次（不是只有战斗掷）；
 * 二 概率是**自己那一份**（与战斗的 8% 分开，改一个不会误伤另一个）；
 * 三 境界越高越少（复用 `EARLY_EVENT_DECAY`，与战斗那条同源）——
 *    真仙之后不再出，否则终局玩家每 5 分钟被弹一次窗；
 * 四 冷却仍然有效（不因为多了一个入口就变成可刷）。
 */
import { describe, expect, it, beforeEach } from "vite-plus/test";
import { setActivePinia, createPinia } from "pinia";
import { readSource } from "@/test/readSource";
import {
  RETREAT_ENLIGHTEN_CHANCE,
  retreatEnlightenChance,
  mayTriggerRetreatEnlightenment,
} from "./earlyGameService";
import { usePlayerStore } from "@/stores/player";

describe("闭关的尽头有机缘", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("概率是闭关自己的一份，不与战斗那个 8% 共用", () => {
    /*
     * 两个入口的"一次"不是同一个东西:战斗一次约 15 秒（每 12 秒一遭遇），
     * 闭关一次 5 分钟。同一个数在两边含义差 20 倍。
     */
    expect(RETREAT_ENLIGHTEN_CHANCE, "闭关那一份概率没有独立常量").toBeGreaterThan(0);
    expect(RETREAT_ENLIGHTEN_CHANCE, "闭关概率高到离谱 —— 5 分钟必出一次").toBeLessThan(0.5);
  });

  it("境界越高越少，元婴之后不再出 —— 与战斗那条共用同一张衰减表", () => {
    /*
     * `EARLY_EVENT_DECAY.enlightenment` 的曲线是 1.0 / 0.7 / 0.35 / 0.1 / 0，
     * 到元婴之后归零。那条曲线是**有意的设计**（顿悟是前期玩法），
     * 故闭关这一侧照它走，不自作主张把后半程续上。
     *
     * 判据因此钉的是"跟着那张表"，不是"每一境都得出"。
     */
    const early = retreatEnlightenChance(0);
    const mid = retreatEnlightenChance(3);
    const late = retreatEnlightenChance(4);
    const apex = retreatEnlightenChance(9);
    expect(early, "第 0 境算出来的概率是 0 —— 那它永远不会发生").toBeGreaterThan(0);
    expect(mid, "境界高了反而更容易顿悟").toBeLessThan(early);
    expect(late, "元婴之后仍会顿悟 —— 与 EARLY_EVENT_DECAY 那张表对不上").toBe(0);
    expect(apex, "界外仍会顿悟 —— 终局玩家会被反复弹窗").toBe(0);
  });

  it("冷却仍然有效：连着两次闭关，第二次不许再出", () => {
    /*
     * 这一条挡的是"多开一个入口就绕过冷却"。`mayTriggerEnlightenment` 的 5 分钟
     * 冷却写在它自己里面，而闭关恰好 5 分钟 —— 若这里不查，
     * 「闭完立刻再闭」就变成两次机会。
     */
    const player = usePlayerStore();
    // 刚出过一次顿悟
    player.setEnlightenmentAt(Date.now());
    expect(
      mayTriggerRetreatEnlightenment(1),
      "冷却期内闭关仍掷中了 —— 那玩家可以靠反复闭关刷顿悟",
    ).toBe(false);
  });

  it("闭关结束真的会掷 —— 调用点在心跳里，且在 buff 过期那一拍", () => {
    /*
     * 源码级锚点。第一版这条判据只在 `earlyGameService.ts` 里找出 1 处
     * （那是定义），于是红 —— 红得对:我确实还没接。
     *
     * 实际调用点在 `core/engine.ts` 的心跳里，因为"出关"这件事只有
     * **buff 过期那一拍**知道（见那边的注释:放在 `startRetreat` 侧会把
     * 5 分钟切成两段）。故这条判据要跨两个文件看。
     */
    const svc = readSource("src/core/earlyGameService.ts");
    expect(svc, "闭关顿悟没有定义").toMatch(/export function mayTriggerRetreatEnlightenment/);

    const engine = readSource("src/core/engine.ts");
    expect(engine, "心跳里没有调用它 —— 只有定义，永远碰不到").toContain(
      "mayTriggerRetreatEnlightenment(",
    );
    /*
     * 且必须在**过期判定之后**（`expiredNames` 那一行在后面就取不到）。
     * 用一个宽松但有效的顺序断言:调用点的位置要在 `expiredBuffNamesOf` 之后。
     */
    const expiredAt = engine.indexOf("expiredBuffNamesOf(cultivation.buffs");
    const callAt = engine.indexOf("mayTriggerRetreatEnlightenment(");
    expect(expiredAt, "找不到过期判定那一行").toBeGreaterThan(-1);
    expect(callAt, "调用点在过期判定之前 —— 那时还不知道闭关结束了").toBeGreaterThan(expiredAt);
  });

  it("坏输入给它 0，不给 NaN —— NaN 会让 `Math.random() > NaN` 恒假，顿悟彻底不出", () => {
    /*
     * `>= 0` 那种写法被 `tautologyGuard` 判成恒真（它确实恒真:函数就是 return 0）。
     * 但真正要钉的不是"非负"，而是**不是 NaN** —— 若哪天有人把
     * `if (!Number.isFinite(major)) return 0` 改成算术表达式，NaN 会静默
     * 传下去:`Math.random() > NaN` 恒为 false，于是这一次永远不中。
     * 那是"功能静默失效"，比抛错难查得多。
     */
    expect(retreatEnlightenChance(Number.NaN), "NaN 传了出去").toBe(0);
    expect(retreatEnlightenChance(-1), "负数境界给了个正概率 —— 越界值被当成了第 0 境").toBe(0);
    expect(retreatEnlightenChance(-1), "负数境界给了 NaN").not.toBeNaN();
  });
});
