/**
 * 每一世用了多久 —— 履历记着归档时刻，却从没算过这件事。
 *
 * ## 它答的是第三个走向
 *
 * ```text
 *   境界走向   比首世深 2 境
 *   终寿走向   比首世多活了 120 载
 *   世数节奏   ？                        ← 此前没人答
 * ```
 *
 * 而「我越玩越快了吗」正是十世回望时最会问的那一句。
 *
 * ## 判据
 *
 * ① 相邻两世的归档时刻之差就是那一世的时长;
 * ② 第一世不入统计 —— 它没有前一个戳;
 * ③ 倒挂 / 零 / 缺值一律跳过，不填 0（填 0 会伪造出「快得离谱」的一世）;
 * ④ 不足两段时不给走向;
 * ⑤ 最快那一世打平取更早 —— 与 `best` / 境界走向同一条口径。
 */
import { describe, expect, it } from "vite-plus/test";
import type { LifeRecord } from "@/data/samsara";
import { lifePace } from "@/ui/lifePace";

const HOUR = 3_600_000;

function rec(index: number, at: number): LifeRecord {
  return {
    index,
    major: 2,
    realmLabel: "筑基",
    age: 100,
    themeId: null,
    themeResult: null,
    insight: 0,
    at,
  };
}

describe("世数节奏 · 每一世用了多久", () => {
  it("① 相邻两世的归档时刻之差就是那一世的时长", () => {
    const r = lifePace([rec(1, 0 + HOUR), rec(2, 0 + HOUR * 4), rec(3, 0 + HOUR * 9)]);
    expect(r.spans.length, "两段都该算出来").toBe(2);
    expect(r.spans[0]!.index, "第一段该记在第二世名下 —— 那是它的时长").toBe(2);
    expect(r.spans[0]!.ms).toBe(HOUR * 3);
    expect(r.spans[1]!.index).toBe(3);
    expect(r.spans[1]!.ms).toBe(HOUR * 5);
  });

  it("② 第一世不入统计", () => {
    const r = lifePace([rec(1, HOUR)]);
    expect(r.state, "只有一世时算不出任何一段").toBe("none");
    expect(r.spans).toEqual([]);
  });

  it("③ 倒挂 / 零 / 缺值一律跳过，不填 0", () => {
    /*
     * 第 2 世时间戳倒挂、第 3 世缺 at —— 两段都不该出现。
     * 若把倒挂填成 0，界面会说「第 2 世只用了 0 时」，那是伪造。
     */
    const r = lifePace([
      rec(1, HOUR * 10),
      rec(2, HOUR * 5), // 倒挂
      { ...rec(3, 0), at: Number.NaN } as LifeRecord, // 缺值
      rec(4, HOUR * 20),
    ]);
    /*
     * 第 3 世缺时间戳 → 3→4 那一段也**没有起点**，故一段都算不出。
     * 若拿 2 的戳（倒挂的那个）去减 4，会得出一个假的「第 4 世用了 15 时」。
     */
    expect(r.spans, "倒挂与缺值都该被跳过，一段不剩").toEqual([]);
  });

  it("④ 不足两段时不给走向", () => {
    const one = lifePace([rec(1, HOUR), rec(2, HOUR * 3)]);
    expect(one.state).toBe("single");
    expect(one.deltaMs, "只有一段却给了走向").toBeNull();
    expect(one.trendText).toBe("");
  });

  it("⑤ 快慢方向与打平口径", () => {
    const faster = lifePace([rec(1, HOUR), rec(2, HOUR * 11), rec(3, HOUR * 13)]);
    expect(faster.trend, "后一世更短就是快了").toBe("faster");
    expect(faster.trendText).toBe("末世比首世快了 8 时");

    const slower = lifePace([rec(1, HOUR), rec(2, HOUR * 3), rec(3, HOUR * 13)]);
    expect(slower.trend).toBe("slower");
    expect(slower.trendText).toBe("末世比首世慢了 8 时");

    const even = lifePace([rec(1, HOUR), rec(2, HOUR * 5), rec(3, HOUR * 9)]);
    expect(even.trend).toBe("even");
    expect(even.trendText).toBe("与首世同速");

    /* 打平取更早 */
    const tie = lifePace([rec(1, HOUR), rec(2, HOUR * 4), rec(3, HOUR * 7), rec(4, HOUR * 10)]);
    expect(tie.fastest!.index, "三段一样快时应取最早那一世").toBe(2);
  });
});
