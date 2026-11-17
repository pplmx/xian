/**
 * 天象系补四则 —— 它是「每处地界摊到几则」最后剩下的那一处。
 *
 * ## 由来（第 486 轮）
 *
 * 前四轮按「每处地界摊到几则」逐个补:
 *
 * ```text
 * 第 482 轮  ice       4 → 7
 * 第 483 轮  sword/fire 4/5 → 7/8
 * 第 484 轮  dark      9 → 13
 * 第 485 轮  god / immortal  10/14 → 13/17
 * 第 486 轮  sky       15 / 10 处 = 1.5   ← 一直是最低，上一轮特意留到现在
 * ```
 *
 * `sky` 横跨 **10 处地界、tier 17~32、minRealm 7~20** —— 从星陨荒原一路铺到鸿蒙本源。
 * 它是覆盖最广的一个标签，也是唯一一个跨了三个界域的。
 *
 * ## 判据
 *
 * ① 四则都在表里，且带 sky 标签；
 * ② 不带 `general`（与第 485 轮同一条纪律）；
 * ③ 每条至少两个选项；
 * ④ 境界带合法（min ≤ max ≤ MAX_MAJOR）。
 */
import { describe, expect, it } from "vite-plus/test";
import { EVENTS } from "@/data/events";
import { MAX_MAJOR, REALMS } from "@/data/realms";

const SKY_IDS = [
  "ev_xingyun_shi",
  "ev_tianwaitian_jing",
  "ev_luotian_xingchao",
  "ev_hongmeng_zhiyin",
];

describe("天象系 · 补四则", () => {
  it("① 四则都在表里，且带 sky 标签", () => {
    for (const id of SKY_IDS) {
      const e = EVENTS.find((x) => x.id === id);
      expect(e, `${id} 不在事件表里`).toBeDefined();
      expect(e!.tags, `${id} 没带 sky 标签`).toContain("sky");
    }
  });

  it("② 不带 general —— 界外内容不许混进通用池", () => {
    for (const id of SKY_IDS) {
      const e = EVENTS.find((x) => x.id === id)!;
      expect(e.tags, `${id} 带了 general —— 它能出现在全图`).not.toContain("general");
    }
  });

  it("③ 每条至少两个选项", () => {
    for (const id of SKY_IDS) {
      const e = EVENTS.find((x) => x.id === id)!;
      expect(e.choices.length, `${id} 只有一个选项`).toBeGreaterThanOrEqual(2);
    }
  });

  it("④ 境界带合法：min ≤ max ≤ 境界表上限", () => {
    expect(REALMS.length, "境界表读不到 —— 判据会空转").toBeGreaterThan(1);
    for (const id of SKY_IDS) {
      const e = EVENTS.find((x) => x.id === id)!;
      const min = e.minRealm ?? 0;
      if (e.maxRealm !== undefined) {
        expect(
          e.maxRealm,
          `${id} 的境界带是空的（min > max）—— 玩家一次也遇不到`,
        ).toBeGreaterThanOrEqual(min);
        expect(e.maxRealm, `${id} 的 maxRealm 越出境界表`).toBeLessThanOrEqual(MAX_MAJOR);
      }
      expect(min, `${id} 的 minRealm 越出境界表`).toBeLessThanOrEqual(MAX_MAJOR);
    }
  });
});
