/**
 * 提示条最多同时几条 —— 一个没有名字、也没有来由的数。
 *
 * ## 由来（第 192 轮，查「状态变化但玩家不知道」的反面:说得太多）
 *
 * `useUiStore().toast` 里有一行:
 *
 * ```ts
 * toasts.value = [...toasts.value.slice(-4), { id, text, kind, ... }];
 * ```
 *
 * `slice(-4)` 加一条 = **同时最多 5 条**。这个上限是对的:密集操作时
 * 屏幕上不该堆十几条提示。但它有两个问题:
 *
 * 1. **没有名字** —— 读代码的人要自己算「-4 + 1 = 5」;
 * 2. **没有来由** —— 为什么是 5 而不是 4 或 6，没有一句解释。
 *
 * ## 而它确实需要一条判据
 *
 * 这一轮实测:连发 8 条提示后，屏幕上是 5 条、底缘到 237px（屏高 844px），
 * 不遮挡主要内容。**§如果把 4 改成 40，页面不会被判据拦住** —— 而那时
 * 五条一屏的提示会把正文整片盖住。
 *
 * ## 这条判据守什么
 *
 * ① 上限存在且不超过 6 条（超过这个数，提示会盖住正文）；
 * ② 上限是**具名常量**，不是散在调用处的魔法数；
 * ③ 常量旁边写清它的来由。
 *
 * ## 故障注入
 *
 * 把常量改成 `TOAST_MAX = 40` → 「上限不超过 6 条」红。
 * 把调用处换回裸数 `slice(-4)` → 「具名常量」那条红。
 * 把常量旁那段来由删掉 → 「写清了来由」那条红。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { stripComments } from "@/test/stripComments";

const STORE = "src/stores/ui.ts";

describe("提示条 · 同时最多几条", () => {
  it("上限是具名常量，不是散在调用处的魔法数", () => {
    const src = stripComments(readSource(STORE));
    /*
     * 认两种写法:`const TOAST_MAX = 5` 声明 + 用 `slice(-(TOAST_MAX - 1))`
     * 或 `slice(-TOAST_MAX)` 之类。从前是裸的 `slice(-4)`。
     */
    expect(
      src,
      "提示条上限还是个裸数 `slice(-4)` —— 读代码的人要自己算「-4 + 1 = 5」，" +
        "而改它的时候没有一处可以把「为什么是 5」写下来",
    ).not.toMatch(/toasts\.value\.slice\(-\d\)/);
    expect(src, "没有给上限起名字").toMatch(/const TOAST_MAX\w*\s*=/);
  });

  it("上限不超过 6 条 —— 再多会盖住正文", () => {
    const src = stripComments(readSource(STORE));
    const m = /const TOAST_MAX\w*\s*=\s*(\d+)/.exec(src);
    expect(m, "找不到上限常量").not.toBeNull();
    const max = Number(m![1]);
    /*
     * 实测:5 条时底缘到 237px,屏高 844px。按每条约 46px 估，
     * 6 条约 300px，已经在正文第一屏里了。故上限卡在 6。
     */
    expect(
      max,
      "提示条上限太大 —— 密集操作时会盖住正文，而玩家会以为界面卡住了",
    ).toBeLessThanOrEqual(6);
    expect(max, "上限太小(只有 1~2 条)—— 同时发生的两件事会互相顶掉").toBeGreaterThanOrEqual(3);
  });

  it("常量旁边写清了来由", () => {
    const src = readSource(STORE);
    const idx = src.indexOf("TOAST_MAX");
    expect(idx, "找不到上限常量").toBeGreaterThan(-1);
    const around = src.slice(Math.max(0, idx - 500), idx + 200);
    expect(
      /为什么|来由|盖住|遮挡|屏|实测/,
      "上限旁边没有一句来由 —— 下一个人改它时只能猜",
    ).toBeTruthy();
    expect(around, "常量旁边没有说明它为什么是这个数").toMatch(/为什么|来由|盖住|遮挡|实测/);
  });
});
