/**
 * 排版自检的量法口径(layout-check 脚本不在常规 verify 链里跑,量法回归此前零信号)。
 *
 * 与 yunyin 同源:量法每失守一次,都是等某次假红/漏检才被发现 —— e17d46f(桌面档
 * 弹窗按钮被量成 26.3px)、e3caed1(灵根圆环 stagger 中段假越界)都是量法在抖,不是排版在坏。
 * 这里用静态判据把量法口径钉在源码上:
 *   1. 各处量尺量几何前都要注入动画禁令;
 *   2. 横向越界左右两侧都查(负边距推到左缘外的块不再漏检);
 *   3. 纯装饰层按**计算后的 pointer-events** 豁免,滚动轨(auto/scroll)内的内容算设计,
 *      overflow-hidden 不豁免;
 *   4. 控件的「声明 = 行为」两条:假按钮的豁免面、控件套控件的宿主与排除项,
 *      以及各自的活信号(量不到东西时不许静默变绿)。
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

  it("缩放档(200%)要判竖排与短标签折行 —— 这一档此前只判四条", () => {
    /*
     * 195 CSS px(390 按 200%)是 AGENTS 明写要防折行的那一档,而 zoomProblems 只判
     * 横向溢出 / 外壳被滚偏 / 越界元素 / 主值行折行四条 —— 竖排与按钮折行一直没接,
     * 实测 14 个页面在这一档把标题与属性名压成一字一行,门一路全绿。
     *
     * 现在两条接上了,但**按钮折行只算短标签**(≤6 字):整宽长文案按钮(「散尽修为,
     * 重入轮回(清空存档)」这类)折行是读得出来的正常换行,不该判红 —— 一条会误伤
     * 正常排版的判据,逼人做的不是修界面而是削判据。
     */
    expect(SCRIPT).toContain("文字被挤成竖排(200%)");
    expect(SCRIPT).toContain("短动作标签被折行(200%)");
    // 短标签的判据要真的按字数筛(而不是把整张折行表都报上来)
    // 用 Array.from 而不是 [...text]:按码点数字数,别把代理对拆成两半
    // (oxlint 的 no-misused-spread 也指着这条)
    expect(SCRIPT).toMatch(/Array\.from\(text\)\.length <= 6/);
    expect(SCRIPT).toContain("info.verticalTexts?.length");
  });

  it("缩放档要量后期档 —— 空档量不出「长数字 + 满屏内容」在 195 宽上什么样", () => {
    /*
     * 主巡页那一遍用的是刚建号的空档:灵石几百、行囊两件、没有在途秘境。195 CSS px 上
     * 最容易出事的恰恰是反过来的组合 —— 神人境的九位数灵石、成套装备、在途秘境全挤在
     * 一个 195 宽的布局视口里。这一遍与 320 那一遍同一个理由(空档量不出满屏内容),
     * 只是那一遍的视口还没窄到 195。
     *
     * 两条都要钉:后期档真的量了缩放档(而不是只有空档那一遍),以及它自己的账要并进
     * failures —— 只 push 进 zoomFails 而不落进 failures 的读数,报告里根本不会出现。
     */
    expect(SCRIPT).toContain("200% 缩放档上版面坏了(后期档)");
    expect(SCRIPT).toMatch(/\[390-late\] \$\{route\} → \$\{zoomBad\.join/);
  });

  it("只在某个时刻弹一次的浮层也要过缩放档 —— 巡页永远碰不到它们", () => {
    /*
     * 本作有整整一族「只在某一步出现」的浮层:归来卷轴、渡劫结果、转世三步
     * (寿元将尽 / 此生已矣 / 轮回)。它们由 clearOverlays 收掉,或在巡页之前根本没触发,
     * 于是 200% 那一档**一页都量不到它们** —— 归来卷轴就是这么一路绿着的
     * (面板内宽 113px 时收益行各自折两行)。
     *
     * 钉三件事:
     *   一 尺子只有一份(measureDialogZoom + dialogZoomProblems),不许每个场景各写一遍;
     *   二 四类场景都真的调了它(归来卷轴 / 渡劫结果 / 转世的每一步);
     *   三 读数要并进 failures —— 只算不报的判据等于没有。
     */
    expect(SCRIPT).toContain("async function measureDialogZoom(");
    expect(SCRIPT).toContain("function dialogZoomProblems(");
    expect(SCRIPT).toContain("problems.push(`数值被标签挤折:");
    // 四类场景各调一次:数调用点而不是数场景名,场景改名时这条会红
    // (格式化会把长调用折成两行,故允许中间有换行)
    const calls = SCRIPT.match(/dialogZoomProblems\(\s*await measureDialogZoom\(/g) ?? [];
    expect(calls.length, "归来卷轴 / 渡劫结果 / 转世每一步都要量").toBeGreaterThanOrEqual(3);
    expect(SCRIPT).toMatch(/归来卷轴在 200% 下坏了/);
    expect(SCRIPT).toMatch(/转世「\$\{label\}」在 200% 下坏了/);
    expect(SCRIPT).toMatch(/渡劫结果在 200% 下坏了/);
    /*
     * 点得开的那些弹窗(装备详情 / 丹房 / 器魂 / 灵脉)另有一个任务:巡页不会去点它们,
     * 缩放档那一遍自然也碰不到 —— 实测丹房方子卡三列并排时中间只剩 42px,
     * 器魂详情两枚页脚键在空格处断成两行。这条钉住那个任务真的存在、且点不开时报红
     * (判据没量到东西时不许静默变绿)。
     */
    expect(SCRIPT).toContain("async function taskDialogZoom(");
    expect(SCRIPT).toMatch(/浮层「\$\{label\}」点不开/);
    expect(SCRIPT).toMatch(/\[195\] 浮层「\$\{label\}」在 200% 下坏了/);
    expect(SCRIPT).toMatch(/\["浮层在 200% 缩放档\(点得开的那几扇\)", taskDialogZoom\]/);
    // 与页面上那一套同一把尺子:禁用态的原因句不算折行
    expect(SCRIPT).toMatch(/if \(el\.hasAttribute\("disabled"\)\) continue; \/\/ 禁用态是原因句/);
  });

  it("控件套控件的判据:宿主按按钮语义选,内层排除 -1,且带活信号", () => {
    /*
     * layout-check 的 nestedControls 报的是「读屏只念得出外层那一个」。三个口径都要钉:
     *   一 宿主只认按钮语义(button / [role=button] / a[href])—— role=tab 一类
     *      组合控件天然带子件,把它们当宿主会一片假红;
     *   二 内层要排除 tabindex=-1 的(roving tabindex 的未选中页签、装饰性 tabindex),
     *      并且只算看得见的盒子;
     *   三 这条判据不许空转:扫到过几枚宿主要累计成 controlHostsSeen,为 0 就报故障
     *      (与 data-value-row / 200% 档 / 像素采样同一套防法)。
     */
    expect(SCRIPT).toContain(
      'const hosts = [...document.querySelectorAll("button, [role=button], a[href]")]',
    );
    expect(SCRIPT).toContain('if (el.getAttribute("tabindex") === "-1") return false;');
    expect(SCRIPT).toContain("if (!inner.length) continue;");
    expect(SCRIPT).toContain("if (info.nestedControls?.items.length)");
    expect(SCRIPT).toContain("controlHostsSeen += info.nestedControls?.hosts ?? 0;");
    expect(SCRIPT).toContain("if (controlHostsSeen === 0)");
  });
});
