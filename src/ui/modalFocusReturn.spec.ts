/**
 * 弹窗关掉之后，焦点要还回原处 —— 键盘用户不会「掉到页面顶端」。
 *
 * ## 由来（第 207 轮，查无障碍的焦点管理）
 *
 * `BaseModal` 里有一段实现:
 *
 * ```ts
 * lastFocused = document.activeElement as HTMLElement | null;
 * // …
 * const back = lastFocused;
 * lastFocused = null;
 * void nextTick(() => {
 *   if (back && back.isConnected) back.focus();
 * });
 * ```
 *
 * 注释写着「记住是谁打开的,关闭后把焦点还回去(键盘用户不会"掉到页面顶端")」。
 *
 * 实测（角色页 →「修行画像展卷」→ 收卷）:
 *
 * ```text
 * 触发      修行画像展卷 › 「问剑」
 * 关闭后   BUTTON:修行画像展卷 › 「问剑」
 * ```
 *
 * **实现是对的。**
 *
 * ## 但它没有判据
 *
 * `modalDepth.spec` 查的是层级（谁能盖住谁），不看焦点。
 * 全仓 spec 里 `lastFocused` 一次都没出现。
 *
 * 而这一段是**只要有人重构 `BaseModal` 就会丢**的那种代码 —— 它不影响视觉，
 * 不影响鼠标玩家，测试里也看不见，只有键盘用户会突然发现焦点跑到了页面顶端。
 *
 * ## 这条判据守什么
 *
 * ① 打开时记下 `document.activeElement`;
 * ② 关闭时把它 `focus()` 回去;
 * ③ 回去之前核一次 `isConnected`（那一颗按钮可能已经因为列表刷新而不在了）;
 * ④ 焦点送进去时有一个可聚焦的落点（panel 或 `initialFocus`）。
 *
 * 不钉实现细节 —— 记在 `ref` 还是 `WeakRef`、在 `watch` 还是 `onUnmounted` 都行。
 *
 * ## 故障注入
 *
 * 把 `back.isConnected` 那个核删掉 → 「还回去之前核一次 isConnected」红。
 * 整段焦点返还删掉 → 「关闭时把焦点送回去」与上一条同时红。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { stripComments } from "@/test/stripComments";

const MODAL = "src/components/common/BaseModal.vue";

describe("弹窗 · 焦点要还回原处", () => {
  it("判据的前提还在 —— 那个组件与它的开合监听", () => {
    const src = stripComments(readSource(MODAL));
    expect(src, "找不到 BaseModal 的开合监听").toContain("() => props.open");
    expect(src, "找不到 panelRef").toContain("panelRef");
  });

  it("打开时记下了触发者", () => {
    const src = stripComments(readSource(MODAL));
    expect(
      src,
      "打开弹窗时没有记下 document.activeElement —— 关闭之后不知道该把焦点还给谁，" +
        "键盘用户会掉到页面顶端",
    ).toMatch(/document\.activeElement/);
  });

  it("关闭时把焦点送回去", () => {
    const src = stripComments(readSource(MODAL));
    /*
     * 判那件事:源码里有一处 `.focus()`，它的对象是「记下来的那个元素」。
     * 认两种写法:`back.focus()` / `lastFocused.focus()` / `saved?.focus()`。
     */
    const restores = [...src.matchAll(/(\w+)\.focus\(\)/g)].map((m) => m[1]!);
    expect(restores.length, "一处 focus() 都没有").toBeGreaterThan(0);
    /*
     * 其中至少一处不是 `panel` / `first` / `last`（那三个是**送进去**与**循环**用的），
     * 而是那个被记下来的变量。
     */
    const restoreTargets = restores.filter(
      (n) => !["panel", "first", "last", "preferred"].includes(n),
    );
    expect(
      restoreTargets.length,
      "只有把焦点送进弹窗（panel/first/last）的写法，没有把它还回去的 —— " +
        "关闭后焦点会留在被移除的节点上，落到 body",
    ).toBeGreaterThan(0);
  });

  it("还回去之前核一次 isConnected —— 那颗按钮可能已经不在列表里了", () => {
    /*
     * 防空转的第二层:直接 `back.focus()` 在目标已从 DOM 移除时是空操作，
     * 焦点仍然会掉到 body。故要核一句 `isConnected`。
     */
    const src = stripComments(readSource(MODAL));
    expect(
      src,
      "还焦点之前没有核 isConnected —— 若那一颗按钮已经因为列表刷新而不在了，" +
        "focus() 是空操作，焦点照样掉到 body，而判据看起来还是绿的",
    ).toContain("isConnected");
  });
});
