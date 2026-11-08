/**
 * 切页的滚动归零与跳读焦点 —— 两处注释里写明、却没有判据守着的设计决定。
 *
 * ## 一、滚动归零必须挂在 `before-enter`
 *
 * `main` 是常驻元素,路由切换只替换它的子组件,它自身从不重建 —— `scrollTop`
 * 会被下一个页面原样继承。故要在切页时归零。
 *
 * 但**挂在哪一刻很讲究**,注释里写着:
 *
 *   > 挂在 before-enter 而非 watch(route):out-in 模式下这一刻旧页面已完全离场,
 *   > 归零不会让正在播离场动画的旧页面突然跳回顶部。
 *
 * 改成 `watch(route)` 不会报错,只是离场动画会跳一下 —— 而 `router` 自己的
 * `scrollBehavior` 在这里也不顶用(它操作 window,而外层 `.app-shell` +
 * `overflow-hidden` 让 window 根本不产生滚动)。
 *
 * ## 二、跳读要 `preventScroll: true`
 *
 * 「跳读」是给键盘用户的快捷入口,只该移动焦点。若忘了 `preventScroll`,
 * 浏览器会把元素滚进视野 —— 玩家按一下跳读,当前阅读位置就丢了。
 *
 * 这两条都是**读代码看不出来、跑起来才怪**的那类,故用静态断言钉住。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");
const APP = readFileSync(join(ROOT, "src/App.vue"), "utf-8");
const CODE = APP.replace(/<!--[\s\S]*?-->/g, "")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");

describe("切页过渡 · 滚动归零挂在 before-enter", () => {
  it("Transition 上挂的是 before-enter,不是别的钩子", () => {
    const transition = CODE.split("\n").find((l) => l.includes("<Transition")) ?? "";
    expect(transition, "App.vue 里找不到 <Transition>").toBeTruthy();
    expect(
      transition,
      "滚动归零没挂在 before-enter 上 —— out-in 模式下这一钩子才保证旧页面已离场;" +
        "换成 watch(route) 会让离场动画跳回顶部",
    ).toContain('@before-enter="resetScroll"');
  });

  it("没有改用 watch(route) 归零 —— router 的 scrollBehavior 在这里不顶用", () => {
    /*
     * `.app-shell` + `overflow-hidden` 让 window 不产生滚动,`scrollBehavior`
     * 操作的是 window,所以它管不到这一层。用 watch 又会撞上离场动画。
     */
    expect(CODE, "出现了对 route 的 watch —— 滚动归零应当只走 before-enter").not.toMatch(
      /watch\(\s*\(\)\s*=>\s*route\b/,
    );
  });
});

describe("跳读 · 只移动焦点,不改阅读位置", () => {
  it("focus 带 preventScroll", () => {
    const fn = CODE.slice(CODE.indexOf("function focusFolioMain"));
    const body = fn.slice(0, fn.indexOf("\n}") + 2);
    expect(body, "找不到 focusFolioMain 的函数体").toContain("focus(");
    expect(
      body,
      "focus 少了 preventScroll —— 浏览器会把元素滚进视野,玩家按一下跳读就丢掉当前阅读位置",
    ).toContain("preventScroll: true");
  });
});
