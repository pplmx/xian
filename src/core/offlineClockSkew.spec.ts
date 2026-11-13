/**
 * 时钟回拨 —— `lastActiveAt` 落在未来时，离线结算该**什么都不给**。
 *
 * ## 由来（第 171 轮，并发与时间这一侧）
 *
 * 玩家的系统时钟会往回跳:手机自动校时、时区切换、双系统切换、手改时间。
 * 一旦 `lastActiveAt` 比当前时刻还晚，`settleOffline` 那行算式就是:
 *
 * ```ts
 * const dtSec = Math.max(0, (nowMs - game.lastActiveAt) / 1000);
 * if (dtSec < 1) return null;
 * ```
 *
 * `Math.max(0, …)` 把它压成 0，于是 `dtSec < 1` 直接返回 null —— **什么都不给**。
 * 这是对的:时钟往回跳不该换来一份离线收益，也不该把存档算坏。
 *
 * 但这条**没有判据**。现有的 `offlineFuzz.spec` 里 `lastActiveAt` 一律是
 * `Date.now() - hours * 3600_000`（永远在过去），故「未来」那一支从来没被走过。
 * 实测把它塞到 +365 天，页面照常渲染、无异常 —— 但那是**偶然**，不是被判据钉住的事实。
 *
 * ## 这条判据守什么
 *
 * ① 未来时间戳不产生任何离线产出（不是「少给」，是**一点都没有**）;
 * ② 也不写坏存档：境界、修为、资源都不动;
 * ③ 结算之后 `lastActiveAt` 要被拉回现在 —— 否则玩家会**永远**等不到离线收益
 *    （每一次启动都判定「未来」，每一天都白过）。
 */
import { describe, expect, it } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { settleOffline } from "./offline";
import { useGameStore } from "@/stores/game";
import { usePlayerStore } from "@/stores/player";
import { useResourcesStore } from "@/stores/resources";
import { toNum } from "@/utils/gnum";
import { readSource } from "@/test/readSource";

const HOUR = 3600_000;

/** 造一个「已经在玩」的档 */
function startedPlayer(): void {
  setActivePinia(createPinia());
  const player = usePlayerStore();
  player.initCharacter("时钟探针", { roots: [] } as never);
  const game = useGameStore();
  game.started = true;
}

describe("时钟回拨 · 离线结算不许从未来凭空取钱", () => {
  it("lastActiveAt 在未来 365 天:什么都不给", () => {
    startedPlayer();
    const game = useGameStore();
    const resources = useResourcesStore();
    const player = usePlayerStore();
    const now = Date.now();
    game.lastActiveAt = now + 365 * 24 * HOUR;

    const beforeStone = toNum(resources.spiritStone);
    const beforeExp = toNum(player.exp);

    const receipt = settleOffline(now);

    expect(receipt, "未来时间戳不该产出一份离线账").toBeNull();
    expect(toNum(resources.spiritStone), "灵石不该变").toBe(beforeStone);
    expect(toNum(player.exp), "修为不该变").toBe(beforeExp);
  });

  it("往回跳 1 秒也算未来(边界):仍不给", () => {
    startedPlayer();
    const game = useGameStore();
    const now = Date.now();
    // 恰好 1 秒之后 —— `dtSec` 会被压成 0 并返回 null
    game.lastActiveAt = now + 1000;
    expect(settleOffline(now), "差 1 秒也是未来").toBeNull();
  });

  it("结算之后 lastActiveAt 被拉回现在 —— 否则永远等不到收益", () => {
    /*
     * 这一条是**真正要紧**的那条:未来时间戳若原样留在存档里，
     * 玩家每一次启动都会判定「离线时长 = 负 → 跳过」，于是**每一天都白过**,
     * 而界面上不会有任何异常 —— 只是永远没有离线收益。
     *
     * 第一版只调了 `settleOffline(now)` 就断言 —— **那是判据写错了地方**。
     * 把时间戳拉回现在的是**启动链路**（`engine.boot` 在 `settleOffline` 之后
     * 无条件 `game.stampActive(now)`，见 core/engine），不是结算函数本身。
     * 判据要量的是「玩家走一遍启动之后」的状态,故这里复现那一步。
     */
    startedPlayer();
    const game = useGameStore();
    const now = Date.now();
    game.lastActiveAt = now + 365 * 24 * HOUR;

    settleOffline(now);
    // 启动链路的下一步（core/engine 的 boot）：无条件盖章
    game.stampActive(now);

    expect(
      game.lastActiveAt,
      "启动之后 lastActiveAt 还停在未来 —— 玩家会永远等不到离线收益",
    ).toBeLessThanOrEqual(now);

    /*
     * **接线**那一半：启动链路必须真的盖这一章。
     * 上面那一段是我自己调的 `stampActive`，所以把 `engine.boot` 里那一行删掉
     * 它照样绿（实测如此）—— 判据只看了一个它自己搭的场景。
     * 故这里直接核源码：`boot` 里要有那一次无条件盖章。
     */
    const engineSrc = readSource("src/core/engine.ts");
    /*
     * 核的是**启动那一处**，不是「全文里有这串字」——
     * 第一版写成 `/game\.stampActive\(now\);/`，而同一文件里 `onVisibility`、
     * `onUnload` 也有盖章，于是把 boot 那行删掉它照样绿（实测如此）。
     * 这里锚住它**紧邻的两行**：`this.lastTickAt = now` 只在 boot 里出现。
     */
    expect(
      engineSrc,
      "boot 里要无条件盖章（紧邻 lastTickAt 那一处）—— 否则时钟回拨后永远等不到离线收益",
    ).toMatch(/game\.stampActive\(now\);\s*\n\s*this\.lastTickAt = now;/);
  });

  it("正常方向仍然给（判据没有把正常路径一起关掉）", () => {
    startedPlayer();
    const game = useGameStore();
    const now = Date.now();
    game.lastActiveAt = now - 8 * HOUR;
    const receipt = settleOffline(now);
    expect(receipt, "8 小时离线该有一份账").not.toBeNull();
  });
});
