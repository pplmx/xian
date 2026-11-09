/**
 * 历世履历 · 每一世都该有道历
 *
 * ## 缺口:同一页里,一处有道历、另一处没有
 *
 * `LifeRecord.at` 是那一世的归档时刻。同一份 `LifeRecord[]` 在修仙录里被用在两处:
 *
 * ```text
 *   长恨录(未了之缘)   formatDate(l.at)   → 印了日期
 *   历世履历            ——                → 一个字都没有
 * ```
 *
 * 于是玩家读到「第 3 世 · 元婴境 · 寿 210 载」,却不知道那是**什么时候**的事。
 * 一份十世的履历没有年份,回望时少了一条最自然的索引:我上一次转世是几天前?
 *
 * ## 为什么带年份,而不复用 `formatDate`
 *
 * `formatDate` 给的是「M月D日」—— 那是给**本世**的近事用的(长恨录只记这一世的缘)。
 * 历世履历横跨十世、可能跨年;只印「3月5日」会让两个不同年份的世看起来挨着。
 * 故另给 `lifeDateText`,带年份。
 *
 * ## 读不出就不印,不拿 0 冒充
 *
 * `at` 在类型上必填,但老存档可能是 0 或缺失。`new Date(0)` 会给出一个真实存在
 * 但错误的日期(1970 年)—— 那比不印更糟。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { lifeDateText } from "./lifeDate";

const view = () => readSource("src/views/LegacyView.vue");

describe("道历 · 纯函数", () => {
  it("时间戳 → 带年份的一句道历", () => {
    // 2026-03-05(本地时区,故按本地构造再回读,避免时区把日子挪掉)
    const ts = new Date(2026, 2, 5, 12, 0, 0).getTime();
    expect(lifeDateText(ts)).toBe("2026 年 3 月 5 日");
  });

  it("0 / 负数 / NaN / Infinity / 非数 → 空串,不印 1970 年", () => {
    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, "123", null, undefined]) {
      expect(lifeDateText(bad), `«${String(bad)}» 该读不出`).toBe("");
    }
  });

  it("跨年:不同年份的两个世不会印成同一天", () => {
    const a = new Date(2025, 2, 5, 12).getTime();
    const b = new Date(2026, 2, 5, 12).getTime();
    expect(lifeDateText(a)).not.toBe(lifeDateText(b));
    expect(lifeDateText(a)).toContain("2025");
    expect(lifeDateText(b)).toContain("2026");
  });

  it("个位月/日不加前导零,与全站的日期写法一致", () => {
    const ts = new Date(2026, 0, 9, 12).getTime();
    expect(lifeDateText(ts)).toBe("2026 年 1 月 9 日");
  });
});

describe("历世履历 · 逐世道历", () => {
  it("履历行印出归档时刻,且给出稳定落点", () => {
    const src = view();
    const rowAt = src.indexOf("data-life-row");
    expect(rowAt, "找不到履历行 —— 判据会空转").toBeGreaterThan(0);
    const row = src.slice(rowAt, rowAt + 4500);
    expect(row, "履历行要印道历").toContain("data-life-date");
    expect(row, "道历要走那个纯函数").toContain("l.dateText");
  });

  it("行数据里真的备好了道历那一项", () => {
    const src = view();
    const rowsAt = src.indexOf("const lifeRows");
    expect(rowsAt, "找不到 lifeRows").toBeGreaterThan(0);
    const rows = src.slice(rowsAt, rowsAt + 3000);
    expect(rows, "lifeRows 要为每一行备一个道历读数").toContain("dateText");
    expect(rows, "道历读的是那一世自己的 at").toContain("lifeDateText(l.at)");
  });

  it("读不出时刻时整条不出 —— 0 会印成 1970 年", () => {
    const src = view();
    const at = src.indexOf("data-life-date");
    const near = src.slice(Math.max(0, at - 900), at + 700);
    expect(near, "道历要有条件渲染").toMatch(/v-if=/);
  });
});
