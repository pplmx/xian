/**
 * 排版自检的量法口径(layout-check 脚本不在常规 verify 链里跑,量法回归此前零信号)。
 *
 * 与 yunyin 同源:量法每失守一次,都是等某次假红/漏检才被发现 —— e17d46f(桌面档
 * 弹窗按钮被量成 26.3px)、e3caed1(灵根圆环 stagger 中段假越界)都是量法在抖,
 * 不是排版在坏。这里用静态判据把三条口径钉在源码上:
 *   1. 三把尺子(整页 / 弹窗 / 开局子集)量几何前都要注入动画禁令;
 *   2. 横向越界左右两侧都查(负边距推到左缘外的块不再漏检);
 *   3. 纯装饰层按**计算后的 pointer-events** 豁免,滚动轨(auto/scroll)内的内容算设计,
 *      overflow-hidden 不豁免。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SCRIPT = readFileSync(resolve(__dirname, "../../scripts/layout-check.mjs"), "utf-8");

describe("排版量法口径", () => {
  it("三把尺子都要注入动画禁令:整页 / 弹窗 / 开局子集", () => {
    // 只钉数量下限:将来新增尺子(如独立小目标量尺)忘了注入仍会红
    const injections = SCRIPT.match(/animation:none!important/g)?.length ?? 0;
    expect(injections, "整页 / 弹窗 / 开箱子集三处量尺都要注入").toBeGreaterThanOrEqual(3);
  });

  it("横向越界左右两侧都查,不只查右缘", () => {
    expect(SCRIPT).toContain("const leftOver = r.left < -1;");
    expect(SCRIPT).toContain("if (r.width <= 0 || (!rightOver && !leftOver)) return false;");
  });

  it("装饰层按计算后的 pointer-events 豁免;滚动轨算设计,hidden 不豁免", () => {
    // 不是按类名找 .pointer-events-none —— 自定义类关事件的装饰层会漏
    expect(SCRIPT).toContain('getComputedStyle(node).pointerEvents === "none"');
    // 滚动轨(auto/scroll)内本来就该越出取景;overflow-hidden 是「玩家滚不动」的事故层
    expect(SCRIPT).toContain('s.overflowX === "auto" || s.overflowX === "scroll"');
  });

  it("假按钮判据的豁免面要逐条写明 —— 否则页签与置灰键会被量成一片假红", () => {
    /*
     * layout-check 的 deadControls 扫「声明了按钮语义却按不动」的控件。它一旦误伤,
     * 逼人做的就不是修界面而是削判据 —— 所以豁免面要钉死在源码上:
     *   一 roving tabindex(role=tab 的未选中项 tabindex=-1 是规范做法,靠方向键漫游);
     *   二 置灰(原生 disabled / aria-disabled=true 会念出原因,不是假按钮);
     *   三 零盒子(看不见 = 读屏与截图都到不了)。
     * 反过来,判据本体也不许被"顺手简化"成只看 tabindex 一种情形:自绘 role=button
     * **根本没写 tabindex** 同样是键盘进不去(器魂页的空槽就是那样漏过去的)。
     */
    expect(SCRIPT).toContain('if (el.getAttribute("role") === "tab") return false;');
    expect(SCRIPT).toContain('if (el.hasAttribute("disabled")) return false;');
    expect(SCRIPT).toContain('if (el.getAttribute("aria-disabled") === "true") return false;');
    expect(SCRIPT).toContain("if (r.width <= 0 || r.height <= 0) return false;");
    // 判据本体:role=button 的「没写 tabindex」与「tabindex=-1」两种都要抓
    expect(SCRIPT).toContain(
      'if (el.getAttribute("role") === "button") return ti === null || ti === "-1";',
    );
    // 挂进两遍巡页共用的 problemsOf(不是只在某一个场景里生效)
    expect(SCRIPT).toContain("if (info.deadControls.length)");
  });
});
