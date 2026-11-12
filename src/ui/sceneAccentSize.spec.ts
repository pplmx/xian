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

/** 一条 SVG 路径的包围盒(单位)—— 数字成对出现,偶位是 x、奇位是 y */
function pathBox(d: string): { w: number; h: number } {
  const nums = d.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < nums.length; i += 2) xs.push(nums[i]!);
  for (let i = 1; i < nums.length; i += 2) ys.push(nums[i]!);
  if (xs.length === 0 || ys.length === 0) return { w: 0, h: 0 };
  return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
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
      const sizes = accents.map((a) => pathBox(STROKE[a.kind]).h * a.scale * k);
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

  it("点景不许拉成一根线 —— 宽与扁两头都要有分寸", () => {
    /*
     * 高度够、宽度够,合起来仍可能是一根线:`bird` 是 18×3.4 单位 ——
     * 宽而极扁,在 45px 的格子里渲染成 5.8×1.1px,读作「一道横线」而不是「两只雀」。
     *
     * 这不是说鸟必须画成方块 —— 鸟本来就该扁。钉的是**比例别失控**:
     * 一枚点景的宽高比超过 6:1 时,它在这一档里已经不是一个可辨的记号了。
     * (云 28×6 = 4.7:1、水纹 26×6.4 = 4:1 都在限内;鸟 18×3.4 = 5.3:1 也在 ——
     *  故这条判据眼下应当是绿的,它的价值是**防以后**把某一笔越画越扁。)
     */
    const tooFlat: string[] = [];
    for (const terrain of SCENE_TERRAINS) {
      for (const a of sceneOf(terrain).accents) {
        const { w, h } = pathBox(STROKE[a.kind]);
        if (h === 0) continue;
        const ratio = w / h;
        if (ratio > 6) {
          tooFlat.push(`${terrain} 的 ${a.kind} 宽高比 ${ratio.toFixed(1)}:1(${w}×${h} 单位)`);
        }
      }
    }
    expect(tooFlat, "这几笔被拉成了线 —— 在窄格里读不出形状").toEqual([]);
  });
});
