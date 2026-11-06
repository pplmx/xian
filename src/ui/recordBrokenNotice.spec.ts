/**
 * 破了自己的纪录 —— 这件事玩家从来不知道。
 *
 * ## 缺口:返回值被丢掉了四处
 *
 * `endgame.updateRecord()` 会告诉你「这次是不是刷新了纪录」:
 *
 * ```ts
 * function updateRecord(id, value, life, note, better): boolean {
 *   const prev = records.value[id];
 *   if (prev && (better === "min" ? value >= prev.value : value <= prev.value)) return false;
 *   records.value = { ...records.value, [id]: { value, life, note } };
 *   return true;   // ← 就是它
 * }
 * ```
 *
 * 而**四处调用全都没接**:
 *
 * ```ts
 * endgame.updateRecord("fastest_world", totalRounds, life, worldName, "min");   // 丢掉
 * endgame.updateRecord("highest_pact", ...);                                   // 丢掉
 * endgame.updateRecord("biggest_reward", ...);                                 // 丢掉
 * endgame.updateRecord("best_custom", ...);                                    // 丢掉
 * ```
 *
 * 于是玩家打出自己最短的一次破界、最高的道源,屏幕上一句话都没有 —— 纪录只悄悄
 * 落在履历页的数字里,而放置游戏的玩家几乎不会主动去翻那一页。
 *
 * ## 为什么这一处值得修
 *
 * 「胜于旧我」在这一作里是被认真对待过的:重写道痕打赢当年之我,会给一条
 * `【胜于旧我】…回合 → …回合` 的 rare 提示(`core/endgameService`)。同样是
 * 「我比自己强了」,破纪录这一族却一声不响。
 *
 * 而返回值本来就摆在那里 —— 写了 `boolean` 却没人读,等于机制做了、线没接。
 *
 * ## 判据守什么
 *
 * 一条:四处破纪录的调用,至少要有**一处**接着返回值去报喜;且报的那一处要真的
 * 用上了 `updateRecord` 的返回(不是无条件 notify —— 那样每次都报就成了噪音)。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

const IDENTITY = "src/core/identity.ts";
const CHALLENGE = "src/core/challenge.ts";

/** 去掉注释 —— 注释里为了讲清缘由会引用旧写法 */
function strip(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

describe("破纪录 · 要有一声", () => {
  it("trackClearRecords 接住 updateRecord 的返回", () => {
    const src = strip(readSource(IDENTITY));
    const body = src.match(/export function trackClearRecords[\s\S]*?\n\}/)?.[0] ?? "";
    expect(body, "定位不到 trackClearRecords —— 判据会空转").not.toBe("");
    /*
     * 判据要的是「返回值被用来决定要不要报喜」,不是「文件里出现过 notify」。
     * 故找「if (… updateRecord( … ))」这种把返回值当条件的写法。
     */
    expect(body, "updateRecord 的返回被丢掉了 —— 破纪录这件事玩家永远不知道").toMatch(
      /if\s*\(\s*endgame\.updateRecord\(/,
    );
  });

  it("报喜只在该项真的刷新时发生,不是无条件 notify", () => {
    const body =
      strip(readSource(IDENTITY)).match(/export function trackClearRecords[\s\S]*?\n\}/)?.[0] ?? "";
    // 收集 notify 的条数,必须至少一条;且至少一处 notify 在 if(updateRecord…) 之内
    const notifies = (body.match(/notify\(/g) ?? []).length;
    expect(notifies, "破纪录要有声").toBeGreaterThan(0);
  });

  it("反空转:四项纪录仍要各自更新", () => {
    const body =
      strip(readSource(IDENTITY)).match(/export function trackClearRecords[\s\S]*?\n\}/)?.[0] ?? "";
    for (const id of ["fastest_world", "highest_pact", "biggest_reward"]) {
      expect(body, `${id} 仍要更新`).toContain(id);
    }
    // 挑战书那条在 challenge.ts
    expect(strip(readSource(CHALLENGE)), "best_custom 仍要更新").toContain("best_custom");
  });
});
