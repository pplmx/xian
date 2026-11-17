/**
 * 宿敌要在**选地界那一页**看得见，不是打起来才知道。
 *
 * ## 由来（第 480 轮）
 *
 * 宿敌系统本身完整:
 *
 * ```text
 *   worldMemory.recordLoss        败 ≥3 次 → 记为宿敌
 *   worldMemory.isNemesis         尚未雪耻时仍算
 *   worldMemory.markAvenged       赢一次 → 雪耻
 *   samsaraService                雪耻数进命题判据（函数名略）
 * ```
 *
 * 而它出现在界面的两处:
 *
 * ```text
 *   CombatPanel    这一场的对手是宿敌 → 标出来
 *   LegacyView     历世履历里的雪耻记录
 * ```
 *
 * **都在「已经打起来」之后或「已经过去」。** 而历练页——就是玩家**选去哪一处**
 * 的那一页——一个字都没有。
 *
 * 于是宿敌变成一个只能偶遇的东西:玩家记得「黑风林里那条狼咬死过我三次」，
 * 却没法在出发前看见「那处地界还在等我」。
 *
 * ## 判据
 *
 * ① 历练页的选地那一块里要能读到宿敌（至少一处 `nemesis` 相关引用）；
 * ② 反差：它读的是**尚未雪耻**那些（`isNemesis` 口径），不是全部历史;
 * ③ 反差：没有宿敌时不出那一行 —— 不许给每一处地界都挂一句「无宿敌」。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const VIEW = readFileSync(resolve(__dirname, "../views/AdventureView.vue"), "utf-8")
  .replace(/<!--[\s\S]*?-->/g, "")
  .replace(/\/\*[\s\S]*?\*\//g, "");

describe("宿敌 · 出发之前就该看得见", () => {
  it("① 历练页读到宿敌", () => {
    expect(VIEW, "历练页没有读宿敌 —— 玩家只能在打起来之后才知道").toMatch(/nemesis/i);
  });

  it("② 读的是「尚未雪耻」那一批，不是全部历史", () => {
    /*
     * `isNemesis` / `avengedAt` 那套口径：雪耻过的不该再被当成「还在等你」。
     * 这一条守的是语义 —— 若只把 `player.nemeses` 整表搬上来，已雪耻的也会出现。
     */
    expect(VIEW, "没有按「尚未雪耻」筛 —— 已雪耻的也会被当成还在等你").toMatch(
      /avengedAt|isNemesis/,
    );
  });

  it("③ 反差：没有宿敌时不出那一行", () => {
    /*
     * 那一行必须挂在条件里（v-if / 长度判断），不能无条件渲染 ——
     * 否则每一处地界都挂一句「无宿敌」，比不显示更糟。
     */
    const at = VIEW.search(/nemesis/i);
    expect(at, "找不到宿敌那一段 —— 判据会空转").toBeGreaterThan(0);
    const around = VIEW.slice(Math.max(0, at - 800), at + 400);
    expect(around, "宿敌那一行是无条件渲染的").toMatch(/v-if|\.length\s*[>!]|\?\s*/);
  });
});
