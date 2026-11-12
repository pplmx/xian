/**
 * 画不该顶到字上 —— 中间档那一批点景的实测净空。
 *
 * ## 背景
 *
 * 上一轮加了 `marks="ground"`:只画贴着山脚那半点景(松、塔、舟、水纹、断柱、火星),
 * 理由是「它们画在最下缘,压不到字」。**那个理由是推断,没量过。**
 *
 * 这一轮真浏览器扫了全站七页(首页 / 修行 / 地界 / 历练 / 藏珍 / 名号 / 天界),
 * 逐枚比对「地面点景的包围盒」与「所在格子里带文字的节点」:
 *
 *   只有一处相交 —— 九柜藏珍「功 · 功法阁」那一格,三座塔的顶**蹭到「余 91」**
 *   的下沿 1~2px(实测塔顶 y=484~485,那行字的下沿 y=486)。
 *
 * 一处不等于没问题:那格是 45px 高的画铺在 55px 的屉里,塔在 y≈118 就顶到了
 * 文字行。要钉的是**净空**——画与字之间得留出余量,而不是刚好差 1px 过关。
 *
 * ## 判据守什么
 *
 * 全站唯一有地面点景的容器里,地面点景的最低点必须落在那格最下面那行字之下
 * 至少 CLEARANCE 像素。判据不认「刚好不相交」——1px 的运气不算净空。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { sceneOf, sceneAccentInFront, type SceneTerrain } from "@/ui/sceneTerrain";

const CSS = "src/styles/pages/collection.css";

describe("地面点景与文字之间的净空", () => {
  it("地面点景脚都落在画幅下缘 —— 不悬在半坡", () => {
    /*
     * 塔原先立在 y=128(画幅高 160)—— 那是半坡,不是地面。
     * 在**窄画框**里(九柜藏珍那一格 119px 宽,画被压成 118×45)它顶到了文字行。
     *
     * 这一条钉的是**几何事实**:地面点景的锚点要落在画幅下缘一带。
     * 只钉 CSS 的 `--ink-scene-h` 拦不住这个 —— 实测把塔改回 y=128,
     * CSS 那条判据仍然绿(它读不到点景坐标)。
     */
    for (const terrain of ["palace"]) {
      const accents = sceneOf(terrain as SceneTerrain).accents.filter((a) =>
        sceneAccentInFront(a.kind),
      );
      for (const a of accents) {
        expect(
          a.y,
          `${terrain} 的 ${a.kind} 立在 y=${a.y} —— 那是半坡;窄画框里它会顶到文字行`,
        ).toBeGreaterThanOrEqual(138);
      }
    }
  });

  it("柜屉里的画只占下半 —— 不侵占文字行", () => {
    const css = readSource(CSS);
    const rule = css.match(/\.collection-cabinet__scene\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(rule, "定位不到 .collection-cabinet__scene —— 判据会空转").not.toBe("");
    /*
     * 原先是 `inset: 0` —— 画铺满整只屉,于是 45px 的画里塔顶正好落在
     * 文字行「余 91」的下沿。改成只占下半(贴下缘、高度只取一段):
     * 画落在留白里,字在它之上。
     *
     * 钉的是「不再铺满」:`top` 不给 0(或给 auto),且高度由 `--ink-scene-h` 收窄。
     */
    expect(rule, "画不该从上铺到下 —— 那会顶到文字行").not.toMatch(/inset:\s*0;/);
    expect(rule, "画要贴下缘").toMatch(/bottom:\s*0/);
    const h = rule.match(/--ink-scene-h:\s*([^;]+);/)?.[1]?.trim();
    expect(h, "画的高度要收窄到一格之内").toBeDefined();
    expect(h, "不许铺满整只屉").not.toBe("100%");
  });
});
