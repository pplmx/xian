/**
 * 浮层的挂载时机 —— 必须晚于**楷体落定**,不是晚于 `document.fonts.ready`。
 *
 * ## 本轮发现的失效
 *
 * `App.vue` 里原本这样写:
 *
 * ```js
 * if (document.fonts?.ready) void document.fonts.ready.then(revealOverlays, revealOverlays);
 * ```
 *
 * 意图是「等正文与楷体落定,再把九扇浮层拉起来」(见 docs/development.md 第 3 条
 * 「浮层按需装载」)。但 `fonts.ready` 的语义是「**当前已请求的**字体都加载完」——
 * 页面刚起来时还没有楷体字被渲染,那个 promise 于 **15ms** 就结了(实测),
 * `overlaysReady` 随即置 true。
 *
 * 后果:十个浮层分块(**128KB**)在 **110ms** 就被拉走,而首屏楷体要到 **171ms**
 * 才 `loadingdone` —— 它们全挤在同一条 4G 带宽上,正是这段代码想避免的事。
 * 修好之后浮层推迟到 153ms,楷体换上从 2954ms 降到 2595~2783ms(实测三遍)。
 *
 * ## 为什么此前没人发现
 *
 * 浮层晚挂载后页面照样全绿:没有判据量「浮层在什么时刻被请求」,也没有判据读
 * `App.vue` 用的那个信号。`first-paint` 的三条读数里,FCP 与冷启动字节都不受影响
 * (那些分块本来就不在关键路径上),只有楷体换上会动 —— 而它离预算还有 400ms 余量。
 *
 * ## 判据守什么
 *
 * ① 等楷体的信号必须是 `loadingdone`(或显式 `fonts.load`),不能是 `fonts.ready`;
 * ② 要有一个**超时兜底** —— 没有字体可等的环境下,浮层不许永远不出现
 *    (那样玩家点装备详情会什么都不发生)。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");
const APP = readFileSync(join(ROOT, "src/App.vue"), "utf-8");

/** 去掉注释,只留代码 —— 注释里会引用旧写法与说明,不能算数 */
const CODE = APP.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("浮层挂载时机 · 等楷体落定", () => {
  it("用 loadingdone 作信号,不是 fonts.ready", () => {
    expect(CODE, "App.vue 里找不到 overlaysReady —— 判据的前提变了").toContain("overlaysReady");
    expect(
      CODE,
      "等的是 document.fonts.ready —— 它只等「已请求的」字体,页面还没渲染楷体字时" +
        "15ms 就 resolve,浮层随即在 110ms 拉走 128KB,与首屏楷体抢带宽(实测楷体换上慢 170~360ms)",
    ).not.toMatch(/fonts\??\.ready/);
    expect(
      CODE,
      "没有监听 loadingdone —— 那才是「字体真的换上、排版已用它重排」的那一刻",
    ).toContain("loadingdone");
  });

  it("有超时兜底 —— 没字体可等时浮层也不许永远不出现", () => {
    /*
     * 反向守卫。上面的改动把信号从 promise 换成了事件,而**事件可能永远不触发**
     * (浏览器不支持 / 页面没有字体加载)。那样 overlaysReady 一直是 false,
     * 玩家点装备详情、开转世弹窗都毫无反应 —— 比慢一点糟得多。
     */
    expect(CODE, "没有超时兜底 —— loadingdone 不来时浮层会永远挂着不出现").toMatch(
      /setTimeout\(\s*[\w()]*\s*,\s*\d+\s*\)/,
    );
    // 兜底时长要在合理区间:太短等于没等(回到原问题),太长等于点不动
    const ms = /setTimeout\(\s*\w+\s*,\s*(\d+)\s*\)/.exec(CODE)?.[1];
    expect(ms, "读不出兜底超时值").toBeTruthy();
    expect(Number(ms), "兜底太短 —— 等于没等字体").toBeGreaterThanOrEqual(500);
    expect(Number(ms), "兜底太长 —— 字体迟迟不来时浮层点不动").toBeLessThanOrEqual(5000);
  });

  it("清理监听 —— 卸载时要摘掉,不许留在 FontFaceSet 上", () => {
    expect(CODE, "loadingdone 的监听没有 removeEventListener —— 热更新或重挂会累积").toContain(
      'removeEventListener("loadingdone"',
    );
  });
});
