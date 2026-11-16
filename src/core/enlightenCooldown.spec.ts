/**
 * 顿悟的频次闸 —— 玩家看不到「还要等多久」。
 *
 * ## 缺口（第 412 轮，第三个同形状的缺口）
 *
 * `enlightenmentAt` 是顿悟的频次闸：`Date.now() - enlightenmentAt < 300000` 时
 * 这一拍不掷。实测这个数在界面上出现 **0 次** —— 玩家只知道「顿悟是随机的」，
 * 不知道「现在能不能碰上」。
 *
 * 而这两件事的体感相反：
 *
 * ```text
 *   冷却中     等下去有意义，但还要等
 *   冷却已过   每一拍都在掷（8% × 境界存在感）
 * ```
 *
 * 前一种等下去就有，后一种要一直等 —— 而它们在界面上长得一模一样。
 *
 * ## 判据
 *
 * ① 读数与结算**同一个算式**（不在这里另写一遍 300000）；
 * ② 冷却已过时返回 0，不是负数；
 * ③ 界面真的印出来了，且是插值不是写死的话；
 * ④ 只在冷却中显示 —— 已可触发时再写一句，会把「随时可能」变成一条待办；
 * ⑤ 用的是游戏钟（`gameNowSec` 那套 1 秒心跳），不是裸 `Date.now()` ——
 *    后者在 computed 里不会自己重算，倒计时会停在打开页面那一刻。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const CORE = readFileSync(resolve(__dirname, "earlyGameService.ts"), "utf-8");
const CARD = readFileSync(resolve(__dirname, "../components/cultivation/RetreatCard.vue"), "utf-8");

describe("顿悟 · 还要等多久才能再遇上", () => {
  it("读数与结算用同一个冷却常数，不各写一遍", () => {
    /*
     * 结算那一道闸写的是 `Date.now() - player.enlightenmentAt < 300000`。
     * 若新加的读数自己写一个 300000，两处哪天改一处就会分叉 ——
     * 而分叉的后果是「界面说可以了，实际还不行」，那比不说更糟。
     *
     * 这条钉的是**两处都出现同一个常数**，且读数读的是 `player.enlightenmentAt`。
     */
    const start = CORE.indexOf("export function enlightenmentCooldownMs");
    expect(start, "找不到 enlightenmentCooldownMs").toBeGreaterThan(0);
    const body = CORE.slice(start, start + 500);
    expect(body, "读数没有读 player.enlightenmentAt").toMatch(/player\.enlightenmentAt/);
    expect(body, "读数里没有那 5 分钟").toMatch(/300000/);

    // 闸门那一侧也必须是同一个数 —— 两边一起看才算钉住
    const gate = CORE.indexOf("function enlightenmentGateOpen");
    expect(gate, "找不到 enlightenmentGateOpen").toBeGreaterThan(0);
    const gateBody = CORE.slice(gate, gate + 900);
    expect(gateBody, "闸门那一侧的冷却常数变了 —— 读数的 300000 也要跟着改").toMatch(/300000/);
  });

  it("冷却已过时返回 0，不是负数", () => {
    /*
     * 若返回负数，界面会印出「顿悟尚需 -3 秒」或者一个倒计时到负数的怪东西。
     * 判据读源码的形状：函数体里必须有一个 `left > 0 ? left : 0` 的夹。
     */
    const start = CORE.indexOf("export function enlightenmentCooldownMs");
    const body = CORE.slice(start, start + 500);
    expect(body, "没有把负数夹成 0").toMatch(/left\s*>\s*0\s*\?\s*left\s*:\s*0/);
  });

  it("界面真的印出来了，且是插值不是写死的话", () => {
    expect(CARD, "闭关卡里没有那一行").toMatch(/data-enlighten-cooldown/);
    /*
     * 与第 410/411 轮同一个教训:钉名字不算数,要钉那个值真的进了正文。
     */
    expect(CARD, "倒计时没有插值 —— 它会是一句永远不变的话").toMatch(
      /formatCountdown\(enlightenCooldownSec\)/,
    );
  });

  it("只在冷却中显示 —— 已可触发时不说", () => {
    const at = CARD.indexOf("data-enlighten-cooldown");
    expect(at, "找不到那一行").toBeGreaterThan(0);
    const before = CARD.slice(Math.max(0, at - 700), at);
    expect(before, "没有「冷却中才显示」的守卫").toMatch(/v-if="[^"]*enlightenCooldownMs > 0/);
  });

  it("用的是游戏钟，不是裸 Date.now()", () => {
    /*
     * 裸 `Date.now()` 在 computed 里不会自己重算:倒计时会停在打开页面那一刻,
     * 而那是一个**看起来在走、其实不动**的读数 —— 比不显示更糟。
     * 本组件已有 `retreatRemaining` 用 `gameNowSec` 那套 1 秒心跳,这里跟它一致。
     */
    const start = CARD.indexOf("const enlightenCooldownMs");
    expect(start, "找不到 enlightenCooldownMs 的 computed").toBeGreaterThan(0);
    const body = CARD.slice(start, start + 400);
    expect(body, "读数没有接游戏钟 —— 倒计时会停在打开页面那一刻").toMatch(/gameNowSec/);
    expect(body, "读数里出现了裸 Date.now() —— 它不会自己重算").not.toMatch(/Date\.now\(\)/);
  });
});
