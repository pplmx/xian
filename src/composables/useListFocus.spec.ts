/**
 * 分批翻页后的焦点落点 —— 一件小事,但夹错索引看不出来。
 *
 * 原来的四份实现里,索引夹取写法几乎相同却又各自手写:夹错了会把焦点送到
 * 列表末尾(屏幕上看不出异常,读屏用户却已经离开了刚翻到的那一页)。
 * 这里把夹取规则钉死。
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vite-plus/test";
import { nextTick } from "vue";
import { focusListRow } from "./useListFocus";

/** 造一份假的 DOM:按选择器返回若干可聚焦行,并记下谁被聚焦 */
function stubDom(count: number): { focused: () => number } {
  const rows = Array.from({ length: count }, (_, i) => ({
    focus: (): void => {
      last = i;
    },
  }));
  let last = -1;
  vi.stubGlobal("document", {
    querySelectorAll: () => rows,
  });
  return { focused: () => last };
}

describe("focusListRow · 翻页后的焦点落点", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("按索引把焦点交给对应那一行", async () => {
    const dom = stubDom(5);
    focusListRow("[data-row]", 3);
    await nextTick();
    expect(dom.focused()).toBe(3);
  });

  it("索引默认 0 —— 回翻到第一批时落在首件", async () => {
    const dom = stubDom(5);
    focusListRow("[data-row]");
    await nextTick();
    expect(dom.focused()).toBe(0);
  });

  it("越界夹到末件,负数夹到首件(不抛、不落到 undefined)", async () => {
    const over = stubDom(5);
    focusListRow("[data-row]", 99);
    await nextTick();
    expect(over.focused()).toBe(4);

    const under = stubDom(5);
    focusListRow("[data-row]", -3);
    await nextTick();
    expect(under.focused()).toBe(0);
  });

  it("空列表什么都不做 —— 列表可能已经清空,不是错误", async () => {
    vi.stubGlobal("document", { querySelectorAll: () => [] });
    expect(() => focusListRow("[data-row]", 0)).not.toThrow();
    await nextTick();
  });

  it("没有 document(纯逻辑环境)也不抛", async () => {
    vi.stubGlobal("document", undefined);
    expect(() => focusListRow("[data-row]", 0)).not.toThrow();
    await nextTick();
  });
});
