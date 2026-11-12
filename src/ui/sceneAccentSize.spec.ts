/**
 * 点景在**真实显示尺寸**下要认得出来 —— 画了 1×3 像素等于没画。
 *
 * ## 这一条是量出来的
 *
 * 上一轮把「画有多大」纳入了审计(最小可见高度),这一轮往下再问一层:
 * **画里的东西有多大**。真浏览器量藏珍页那十只柜屉(每格 119px 宽、画 45px 高):
 *
 *   ember(火星)   1×3 px
 *   pine (松)     4×5 px
 *   wave (水纹)   11×2 px
 *   boat (舟)     12×6 px
 *   pagoda(塔)    13×7 px
 *
 * 1×3 与 4×5 那两枚,玩家根本认不出那是火星与松 —— 而它们正是「火域」与「林麓」
 * 两档唯一的辨识记号。画在代码里、在 390 宽的整页上都在,唯独在这些小格里不成形。
 *
 * ## 判据怎么算
 *
 * 不猜「基准高 14 单位」—— 那是我第一版的估计,对 `flake`(2.2 单位)与
 * `ember`(6 单位)完全错。改为**从真实路径算包围盒**:把 `STROKE` 里的 `d`
 * 里的坐标都取出来,求 y 的极差;乘上这枚点景的 `scale`(已含 `ACCENT_UNIT`),
 * 就是它在 viewBox 里的高度(单位)。再按容器高换算成 px。
 *
 * 判据钉:**每档地形至少有一枚点景,在全站最矮那档容器里仍不低于 4px**。
 * 低于 4px 时,一枚记号在屏幕上只剩一两个像素,读不出「那是松 / 塔 / 舟」。
 */
import { describe, expect, it } from "vite-plus/test";
import { SCENE_TERRAINS, STROKE, sceneOf } from "@/ui/sceneTerrain";

/** 一条 SVG 路径的包围盒高度(单位)—— 取全部数字对里的 y 极差 */
function pathHeight(d: string): number {
  const nums = d.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  const ys: number[] = [];
  /* 数字是成对的 x y;弧命令后面也跟一对终点坐标,按同样的读法落进去即可 */
  for (let i = 1; i < nums.length; i += 2) ys.push(nums[i]!);
  return ys.length ? Math.max(...ys) - Math.min(...ys) : 0;
}

/** 全站最矮的一档容器(藏珍柜屉的画只有 45px 高) */
const TIGHTEST_BOX_PX = 45;
const VIEWBOX_H = 160;

describe("点景在真实显示尺寸下要认得出来", () => {
  it("每档地形都有一枚够大的点景 —— 不许全是米粒", () => {
    const k = TIGHTEST_BOX_PX / VIEWBOX_H;
    const tooSmall: string[] = [];
    for (const terrain of SCENE_TERRAINS) {
      const accents = sceneOf(terrain).accents;
      const sizes = accents.map((a) => pathHeight(STROKE[a.kind]) * a.scale * k);
      const biggest = Math.max(...sizes);
      /*
       * 门槛 6px,不是 4px。4px 是照着「包围盒非空」定的 —— 实测判据在 4px 时全绿,
       * 而浏览器里 ember 仍是 2×5、pine 仍是 4×5:包围盒有了,形状还是糊的。
       * 一枚记号要在屏幕上读出「那是松 / 塔 / 舟」,至少得占 6px 高。
       */
      if (biggest < 6) {
        tooSmall.push(
          `${terrain} 最大一枚只有 ${biggest.toFixed(1)}px(在 ${TIGHTEST_BOX_PX}px 高的格里)`,
        );
      }
    }
    expect(tooSmall, "这几档在窄格里认不出点景 —— 只剩山骨,等于没画").toEqual([]);
  });
});
