/**
 * 方向键那套规则只能有一份实现 —— `InkTabs` 曾经自己写了一份。
 *
 * ## 由来（第 208 轮，查键盘可达性）
 *
 * 实测 8 个页面的 tablist 方向键都工作（`ArrowRight` 焦点与选中同步移动）。
 * 顺着查实现，发现**两套**:
 *
 * ```text
 * src/composables/useTabKeys.ts   tabKeyTarget(key, current, count) → 纯函数，6 条判据
 * src/components/common/InkTabs.vue
 *   if (e.key === "ArrowRight") target = (activeIdx.value + 1) % n;
 *   else if (e.key === "ArrowLeft") target = (activeIdx.value - 1 + n) % n;
 *   else if (e.key === "Home") target = 0;
 *   else if (e.key === "End") target = n - 1;
 * ```
 *
 * 而 `useTabKeys` 的注释里写着它**为什么存在**:「少个 `+count` 会算出 -1，
 * 焦点被送到列表末尾 —— 而屏幕上什么都看不出来」。
 *
 * 同一套规则两处实现，就是仓库纪律里说的「两本账」:
 * 改了一处、漏了另一处，而**两边都不会红**。
 *
 * ## 这条判据守什么
 *
 * `InkTabs` 的键盘处理要读 `tabKeyTarget`，不许自己再算一遍取模。
 *
 * 不钉怎么接（在 `onKeydown` 里调、还是包一层）—— 只核「它没有第二份取模逻辑」。
 *
 * ## 故障注入
 *
 * 把 `InkTabs` 改回手写取模 → 「没有自己再写一份」红（点名「右移取模 / 左移取模」）。
 * 把键盘处理换成只认 Home → 「它确实读了那个纯函数」与上一条同时红。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { stripComments } from "@/test/stripComments";
import { tabKeyTarget } from "@/composables/useTabKeys";

const INK_TABS = "src/components/common/InkTabs.vue";

describe("方向键 · 只能有一份实现", () => {
  it("判据的前提还在 —— 纯函数与那个组件", () => {
    const src = stripComments(readSource(INK_TABS));
    expect(src, "找不到 InkTabs 的键盘处理").toContain("onKeydown");
    // 纯函数还在，且行为符合预期（这是下面几条的基准）
    expect(tabKeyTarget("ArrowRight", 0, 4).index, "纯函数行为变了").toBe(1);
    expect(tabKeyTarget("ArrowLeft", 0, 4).index, "左移到头该回最后一个").toBe(3);
    expect(tabKeyTarget("Home", 2, 4).index).toBe(0);
    expect(tabKeyTarget("End", 1, 4).index).toBe(3);
  });

  it("InkTabs 没有自己再写一份取模", () => {
    const src = stripComments(readSource(INK_TABS));
    /*
     * 判那件事:键盘处理里不许出现「自己算索引」的痕迹。
     * 认三种痕迹:`+ 1) % `、`- 1 + `、以及直接赋值 `target = 0` / `target = n - 1`。
     *
     * 这些正是 `tabKeyTarget` 内部做的事 —— 出现在组件里就说明有第二份。
     */
    const idx = src.indexOf("function onKeydown");
    expect(idx, "找不到 onKeydown").toBeGreaterThan(-1);
    const end = src.indexOf("\n}", idx);
    const body = src.slice(idx, end);

    const handRolled: string[] = [];
    if (/\(\s*\w+(?:\.value)?\s*\+\s*1\s*\)\s*%\s*n/.test(body)) handRolled.push("右移取模");
    if (/\(\s*\w+(?:\.value)?\s*-\s*1\s*\+\s*n\s*\)\s*%/.test(body)) handRolled.push("左移取模");
    if (/target\s*=\s*n\s*-\s*1/.test(body)) handRolled.push("End 手算");

    expect(
      handRolled,
      "InkTabs 自己又写了一份方向键规则（" +
        handRolled.join(" / ") +
        "）—— 而 `useTabKeys.tabKeyTarget` 已经是这份规则的唯一实现，" +
        "它的注释里写着「少个 +count 会算出 -1，焦点被送到列表末尾,而屏幕上什么都看不出来」。" +
        "改一处漏一处，两边都不会红",
    ).toEqual([]);
  });

  it("它确实读了那个纯函数", () => {
    /*
     * 防空转的第二层:光「没有手写」不够 —— 得真的接上了 `tabKeyTarget`。
     */
    const src = stripComments(readSource(INK_TABS));
    expect(
      src,
      "InkTabs 既没有手写取模、也没有读 tabKeyTarget —— 那方向键是坏的（或判据要跟着改）",
    ).toContain("tabKeyTarget");
  });
});
