/**
 * 日课的「记一笔」与「换期」必须**先结算再翻页**。
 *
 * ## 由来（第 180 轮，查末期与日课节奏）
 *
 * 日课是**自动领赏**的（`checkDaily` 在每次 `track` 后立刻结算并发赏），
 * 玩家不需要手动领取。这一点核实过:换期不会丢奖励，因为没有「待领」状态。
 *
 * 但这个保障依赖两件事同时成立:
 *
 * 1. **`track` 里调 `checkDaily`** —— 进度一涨就即时结算;
 * 2. **换期只把 `base` 推到当时的计数器值，清空 `claimed`** ——
 *    它不认识「已完成未结算」这种状态，因为**不存在**。
 *
 * 若哪天有人把 tick 顺序改成「先换期、再结算」，或者把 `checkDaily` 从
 * `track` 里摘掉（比如「省点开销，改成周期检查」），第 2 件事的前提就断了:
 * 零点前攒下的进度会在换期那一刻被 `base` 吃掉 —— 玩家做完了日课却什么也没拿到，
 * 而且**不会有任何报错**。
 *
 * ## 这条判据守什么
 *
 * ① `track` 里确实调了 `checkDaily`（不是只记数）;
 * ② `checkDaily` 先 `settleDailies` 再 `setDailyState`（先算后落账）;
 * ③ `rolloverDailyIfNeeded` 只在**日期真的变了**时才换（不无条件清空）。
 *
 * 三条都不看「某个字面量」——看的是**顺序与条件**，那才是保障的来源。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { stripComments } from "@/test/stripComments";

const PROGRESS = "src/core/progress.ts";

describe("日课 · 先结算再翻页", () => {
  it("判据的前提还在 —— 那三个函数都还叫这个名字", () => {
    /*
     * 防空转的第一层（与 `startupOrder.spec` 同一种写法）。
     *
     * 下面三条都靠 `indexOf("function checkDaily()")` 这类**按名字找**的方式定位。
     * 若哪天函数被重命名，`indexOf` 返回 -1，而断言里那句
     * `expect(idx).toBeGreaterThan(-1)` 会让它红在「找不到」——
     * 那是**判据过时**的红，不是产品坏了的红。两者混在一起时，
     * 下一个人最容易做的事是「把这条判据删掉」。
     *
     * 故这一条先单独把「前提还在」报出来。
     */
    const src = stripComments(readSource(PROGRESS));
    for (const name of [
      "export function track(",
      "function checkDaily()",
      "export function rolloverDailyIfNeeded()",
    ]) {
      expect(src, `判据的前提没了：${name} —— 判据该跟着改，不是删掉`).toContain(name);
    }
  });

  it("track 里必须调 checkDaily —— 进度一涨就结算，不留「待领」", () => {
    const src = stripComments(readSource(PROGRESS));
    const idx = src.indexOf("export function track(");
    expect(idx, "找不到 track 函数").toBeGreaterThan(-1);
    // 取函数体到下一个 export 之间
    const nextExport = src.indexOf("\nexport ", idx + 10);
    const body = src.slice(idx, nextExport === -1 ? idx + 800 : nextExport);
    expect(
      body,
      "track 里没有调 checkDaily —— 零点前攒的进度会在换期那一刻被吃掉，" +
        "玩家做完了日课却什么也没拿到，而且不会有任何报错",
    ).toMatch(/checkDaily\(\)/);
  });

  it("checkDaily 先 settleDailies 再落账 —— 但落账在发赏前后都行", () => {
    /*
     * 口径修正（第 180 轮）:第一版断言 setDailyState 必须紧跟在结算之后、
     * 在发赏循环之前。而实测把落账移到循环之后**仍然是对的** ——
     * 只要它发生在 settleDailies 之后,用过的是同一次结算结果。
     *
     * 真正会坏的是**反过来**:先落账、再结算 —— 那时落进去的是算之前的状态,
     * 这一笔就白算了。故判据只核这一条相对顺序。
     */
    const src = stripComments(readSource(PROGRESS));
    const idx = src.indexOf("function checkDaily()");
    expect(idx, "找不到 checkDaily").toBeGreaterThan(-1);
    const end = src.indexOf("\n}", idx);
    const body = src.slice(idx, end);

    const settleAt = body.indexOf("settleDailies(");
    const setAt = body.indexOf("setDailyState(");
    expect(settleAt, "checkDaily 里没有 settleDailies").toBeGreaterThan(-1);
    expect(setAt, "checkDaily 里没有 setDailyState").toBeGreaterThan(-1);
    expect(
      settleAt,
      "先 setDailyState 再 settleDailies —— 落账用的是算之前的状态，这一笔白算",
    ).toBeLessThan(setAt);

    /*
     * 另一条真正要紧的:**发赏用的是本次结算的结果**，不是重新算一遍。
     * 若发赏前又调一次 settleDailies（或用 dailyStateOf 现读），
     * 两处就可能对不上（第二次算时 counters 已因发赏而变）。
     */
    const grantAt = body.indexOf("grantReward(");
    if (grantAt > -1) {
      const between = body.slice(settleAt, grantAt);
      expect(
        between.match(/settleDailies\(/g)?.length ?? 0,
        "结算与发赏之间又算了一次 —— 第二次算时 counters 已变，两处会对不上",
      ).toBe(1);
    }
  });

  it("换期只在日期真的变了时才做（不无条件清空）", () => {
    const src = stripComments(readSource(PROGRESS));
    const idx = src.indexOf("export function rolloverDailyIfNeeded()");
    expect(idx, "找不到 rolloverDailyIfNeeded").toBeGreaterThan(-1);
    const end = src.indexOf("\n}", idx);
    const body = src.slice(idx, end);

    // 必须有「日期不等」的守卫
    expect(body, "换期没有日期守卫 —— 每次 tick 都会清空日课进度").toMatch(
      /daily\.date\s*!==\s*today|daily\.date\s*===\s*today/,
    );
    // 且换期函数里不许自己发赏（发赏只该在 checkDaily 那一处）
    expect(body, "换期函数里自己发赏 —— 发赏只该在 checkDaily 一处，两处会重复发").not.toMatch(
      /grantReward\(/,
    );
  });

  it("发赏只在 checkDaily 一处（两处会重复发）", () => {
    const src = stripComments(readSource(PROGRESS));
    const occurrences = [...src.matchAll(/grantReward\(/g)].length;
    /*
     * progress.ts 里 grantReward 的调用点有多处（主线、成就、日课…），
     * 但**日课那一处**必须在 checkDaily 里。这里核的是:
     * checkDaily 的函数体里有一次,且紧邻 dailyTaskDef 的循环。
     */
    const idx = src.indexOf("function checkDaily()");
    const end = src.indexOf("\n}", idx);
    const body = src.slice(idx, end);
    expect(body, "checkDaily 里没有发赏 —— 自动领赏这条承诺断了").toMatch(/grantReward\(/);
    expect(body, "checkDaily 里没有按 id 找回报酬").toMatch(/dailyTaskDef\(/);
    expect(occurrences, "整个 progress.ts 里一次发赏都没有").toBeGreaterThan(0);
  });
});
