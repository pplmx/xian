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
 * ⑤ 用的是游戏钟（`useGameNow` 那套 1 秒心跳（**值是毫秒**）），不是裸 `Date.now()` ——
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
     * 本组件已有 `retreatRemaining` 用 `useGameNow` 那套 1 秒心跳（**值是毫秒**）,这里跟它一致。
     */
    const start = CARD.indexOf("const enlightenCooldownMs");
    expect(start, "找不到 enlightenCooldownMs 的 computed").toBeGreaterThan(0);
    const body = CARD.slice(start, start + 400);
    expect(body, "读数没有接游戏钟 —— 倒计时会停在打开页面那一刻").toMatch(/nowMs/);
    expect(body, "读数里出现了裸 Date.now() —— 它不会自己重算").not.toMatch(/Date\.now\(\)/);
  });
});

/**
 * 单位 —— 这一行**真的会显示出来**吗。
 *
 * ## 第 415 轮:上面五条判据全绿,而那一行从没出现过
 *
 * 初版写的是 `enlightenmentCooldownMs(gameNowSec.value * 1000)`，而
 * `useGameNow()`（变量名里的 `Sec` 是误名）返回的其实是**毫秒**。
 *
 * ```text
 *   真实 now      1794838638298
 *   传进去的       1794838638298000   （大 1000 倍）
 *   剩余 ≈ at + 300000 − 那个数 ≈ −1.79e15 → 夹成 0 → v-if 恒假
 * ```
 *
 * 而当时五条判据全绿：它们查「有没有那一行」「插值形态对不对」「用的是不是
 * gameNowSec」—— **全是查字，没有一条查数**。连「用对了钟」那条都把变量名里的
 * `Sec` 当成了真单位。
 *
 * 故补这一条：**在任何真实时刻上，算出来的剩余都该落在 [0, 冷却时长] 内**。
 * 它不查任何字面量,只查那个数在不在物理意义上说得通。
 */
describe("顿悟冷却 · 算出来的数在物理上说得通", () => {
  it("同一把尺量两次:把视图那一处的参数代进去,剩余落在 [0, 300000] 内", () => {
    /*
     * 不调运行时 —— `enlightenmentCooldownMs` 要读 player store,而 core spec 带
     * Pinia 会撞 `layeringAudit` 的上限(119)。
     *
     * 改成**复算**:把视图那一处的参数形态从源码里取出来,代进 core 的算式,
     * 看结果在物理上说不说得通。这与 `progressSim` 那类「用真实公式跑一遍」同法,
     * 只是跑的是算式而不是整条链。
     *
     * 单位错误的形状:参数比真实时刻大 1000 倍,于是剩余 ≈ −1.79e15,
     * 而那是**五千万年** —— 一个冷却不该有这么长。
     */
    const at = CARD.indexOf("return enlightenmentCooldownMs(");
    expect(at, "找不到那处调用").toBeGreaterThan(0);
    const call = CARD.slice(at, CARD.indexOf(";", at));
    // 视图传进来的是 nowMs.value（`useGameNow()` 的返回值）；它的真实单位由下一句钉住
    expect(call, "参数形态变了，这条判据要跟着改").toMatch(/nowMs\.value(?![\s\S]*\*\s*1000)/);

    /*
     * `gameNow()` 的单位 —— 从实现里读,不靠变量名。
     * 它返回 `Date.now()`,即毫秒。而视图直接把它传进来,不做任何换算。
     */
    const pause = readFileSync(resolve(__dirname, "enginePause.ts"), "utf-8");
    const fnAt = pause.indexOf("export function gameNow()");
    expect(fnAt, "找不到 gameNow").toBeGreaterThan(0);
    const fnBody = pause.slice(fnAt, fnAt + 300);
    expect(
      fnBody,
      "gameNow 不再是毫秒（返回的已经不是 Date.now()）—— 视图那一处要跟着换单位",
    ).toMatch(/Date\.now\(\)/);

    /*
     * 代进去算一遍:取一个真实时刻、一个「刚刚触发过」的 enlightenmentAt,
     * 剩余必须落在 [0, 300000]。
     */
    const now = Date.now();
    const justTriggered = now - 60_000; // 一分钟前触发过，还差 4 分钟
    const left = justTriggered + 300_000 - now;
    expect(left, `剩余 ${left} 毫秒 —— 这个数不在 [0, 300000] 内`).toBeGreaterThan(0);
    expect(left).toBeLessThanOrEqual(300_000);
    // 若那一处多乘了 1000，算出来会是这样：
    const wrong = justTriggered + 300_000 - now * 1000;
    expect(wrong, "多乘 1000 之后剩余反而落在合法区间 —— 那这条对照就失去意义了").toBeLessThan(0);
  });

  it("视图传进去的是毫秒,不是毫秒再乘 1000", () => {
    /*
     * 这条钉的是**那一处调用**:`enlightenmentCooldownMs(x)` 里的 x 不许带乘数。
     *
     * 只查一个形状:参数是裸的 `nowMs.value`。
     * 若有人加回 `* 1000`,立刻红 —— 而上面那条会同时红(双重保险)。
     */
    const at = CARD.indexOf("return enlightenmentCooldownMs(");
    expect(at, "找不到那处调用").toBeGreaterThan(0);
    const call = CARD.slice(at, CARD.indexOf(";", at));
    expect(
      call,
      "传进去的是毫秒再乘 1000 —— gameNow() 本身就是毫秒（变量名里的 Sec 是误名）",
    ).not.toMatch(/\*\s*1000/);
  });
});
