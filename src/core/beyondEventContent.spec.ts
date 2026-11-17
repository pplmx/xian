/**
 * 界外补六则 —— 按「每处地界摊到几则」重排之后，最薄的三处都在界外。
 *
 * ## 由来（第 485 轮）
 *
 * 前一轮换了一个量法（每处地界摊到几则），补完人间界的 dark 之后重新排:
 *
 * ```text
 * 标签      事件数   地界数   每处摊到
 * sky        12       10      1.2     ← 最薄
 * god        10        8      1.3
 * immortal   14       10      1.4
 * chaos      12        6      2.0
 * ```
 *
 * 三处全是**界外标签**。而人间界那几处（ice/sword/fire）已经补到 7~8。
 *
 * 这一轮补 `god` 与 `immortal`（`sky` 留待下一轮 —— 它的问题与前两者不同：
 * 它覆盖 10 处地界且跨三个界域）。
 *
 * ## 判据
 *
 * ① 六条都在表里，各带 god / immortal 标签；
 * ② 每条都**不带 `general`** —— 界外内容混进通用池会一路漏到人间界；
 * ③ 每条至少两个选项；
 * ④ 境界带从 minRealm 9 起（界外），且不越出境界表。
 */
import { describe, expect, it } from "vite-plus/test";
import { EVENTS } from "@/data/events";
import { MAX_MAJOR } from "@/data/realms";

const GOD_IDS = ["ev_shenji_luori", "ev_tiangong_yiwang", "ev_shenge_jiumeng"];
const IMMORTAL_IDS = ["ev_xianmen_shouye", "ev_yunhai_canzhao", "ev_jinyu_wupai"];

describe("界外 · god 与 immortal 各补三则", () => {
  it("① 六条都在表里，各带 god / immortal 标签", () => {
    for (const id of GOD_IDS) {
      const e = EVENTS.find((x) => x.id === id);
      expect(e, `${id} 不在事件表里`).toBeDefined();
      expect(e!.tags, `${id} 没带 god 标签`).toContain("god");
    }
    for (const id of IMMORTAL_IDS) {
      const e = EVENTS.find((x) => x.id === id);
      expect(e, `${id} 不在事件表里`).toBeDefined();
      expect(e!.tags, `${id} 没带 immortal 标签`).toContain("immortal");
    }
  });

  it("② 每条都不带 general —— 界外内容混进通用池会一路漏到人间界", () => {
    for (const id of [...GOD_IDS, ...IMMORTAL_IDS]) {
      const e = EVENTS.find((x) => x.id === id)!;
      expect(e.tags, `${id} 带了 general —— 它能出现在全图`).not.toContain("general");
    }
  });

  it("③ 每条至少两个选项", () => {
    for (const id of [...GOD_IDS, ...IMMORTAL_IDS]) {
      const e = EVENTS.find((x) => x.id === id)!;
      expect(e.choices.length, `${id} 只有一个选项`).toBeGreaterThanOrEqual(2);
    }
  });

  it("④ 境界带从界外起，且不越出境界表", () => {
    for (const id of [...GOD_IDS, ...IMMORTAL_IDS]) {
      const e = EVENTS.find((x) => x.id === id)!;
      expect(
        e.minRealm ?? 0,
        `${id} 的 minRealm 低于 9 —— 那是人间界，不该挂在 god/immortal 上`,
      ).toBeGreaterThanOrEqual(9);
      if (e.maxRealm !== undefined) {
        expect(e.maxRealm, `${id} 的 maxRealm 越出境界表`).toBeLessThanOrEqual(MAX_MAJOR);
        expect(
          e.maxRealm,
          `${id} 的境界带是空的（minRealm > maxRealm）—— 玩家一次也遇不到`,
        ).toBeGreaterThanOrEqual(e.minRealm ?? 0);
      }
    }
  });
});
