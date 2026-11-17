/**
 * 两个事件共用一个标题 —— 而它们还可能同时出现在同一场历练里。
 *
 * ## 由来（第 494 轮）
 *
 * 这一轮在查内容一致性时扫出唯一一处重名:
 *
 * ```text
 *   old_man_stone_1  「青石上的老者」  tags=chain   —— 奇缘链的第一节
 *   ev_old_man       「青石上的老者」  tags=general —— 通用池里的事件
 * ```
 *
 * 两条内容不同（前者是石上老者开口问路，后者身旁放着个酒葫芦在打盹），
 * 但标题一样。玩家先后遇到时只会记得「这个事件我见过」，而其实读的是两篇。
 *
 * 标题是玩家用来记住一次际遇的唯一线索 —— 重名等于让两条内容互相抵消。
 *
 * ## 判据
 *
 * ① 全事件表里标题不重复；
 * ② 反差：副标题/正文可以相似，只有标题要求唯一 —— 标题是索引，正文是内容。
 */
import { describe, expect, it } from "vite-plus/test";
import { EVENTS } from "@/data/events";

describe("事件标题 · 它是玩家记住一次际遇的唯一线索", () => {
  it("① 全表标题不重复", () => {
    const byTitle = new Map<string, string[]>();
    for (const e of EVENTS) {
      byTitle.set(e.title, [...(byTitle.get(e.title) ?? []), e.id]);
    }
    const dup = [...byTitle]
      .filter(([, ids]) => ids.length > 1)
      .map(([t, ids]) => `「${t}」被 ${ids.join(" 与 ")} 共用`);
    expect(dup, "这些标题被两个事件共用 —— 玩家会以为见过：" + dup.join("；")).toEqual([]);
  });

  it("② 反差：正文可以相似，只有标题要求唯一", () => {
    /*
     * 这一条守的是①自己的边界 —— 免得后来者把判据扩成「正文也不许像」，
     * 那会把大量同一题材的事件判成重复（酒仙与醉叟本就该像）。
     */
    expect(EVENTS.length, "事件表读不到").toBeGreaterThan(100);
    const bodies = EVENTS.map((e) => e.text);
    expect(new Set(bodies).size, "所有正文都一样？那是数据出错了").toBeGreaterThan(50);
  });
});
