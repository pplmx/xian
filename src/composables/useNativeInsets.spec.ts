/**
 * 原生系统栏占位桥 —— readNativeInsets 的契约。
 *
 * 玩家反馈:安卓三键导航的老机型上,底部导航条整排被系统按钮盖住。
 * 根因:我们开了边到边,Android WebView 却不会把导航栏高度写进 CSS 的
 * env(safe-area-inset-bottom)(那个值在安卓恒为 0)。修法由原生量好真实
 * 占位,经 window.NativeApp 桥交给页面(见 MainActivity.java):
 *   底部只在「按钮真会挡住点按」时才非零(取 tappableElement,手势导航为 0);
 *   顶部是状态栏高度。
 *
 * 这里钉的是桥的**失效安全**:桥来自原生、值来自原生,页面约束不了它 ——
 * 任何一种坏输入都必须归零,而不是把布局撑爆或抛错白屏。
 */
import { describe, expect, it } from "vite-plus/test";
import { readNativeInsets } from "./useNativeInsets";

describe("readNativeInsets · 桥正常", () => {
  it("把原生给的两个数原样交出", () => {
    const r = readNativeInsets({ insetTop: () => 24, insetBottom: () => 48 });
    expect(r).toEqual({ top: 24, bottom: 48 });
  });

  it("手势导航:底部为 0 —— 内容照旧铺到横杠底下,不多垫", () => {
    const r = readNativeInsets({ insetTop: () => 24, insetBottom: () => 0 });
    expect(r.bottom).toBe(0);
  });
});

describe("readNativeInsets · 失效安全", () => {
  it("没有桥(网页 / iOS / 桌面):全 0", () => {
    expect(readNativeInsets(undefined)).toEqual({ top: 0, bottom: 0 });
    expect(readNativeInsets({})).toEqual({ top: 0, bottom: 0 });
  });

  it("桥方法抛错:归 0,不向外抛", () => {
    const r = readNativeInsets({
      insetTop: () => {
        throw new Error("JavaBridge 已销毁");
      },
      insetBottom: () => 48,
    });
    expect(r).toEqual({ top: 0, bottom: 48 });
  });

  it("坏值(负数 / NaN / Infinity / 字符串 / null)一律归 0,一个坏值撑不爆布局", () => {
    const bad = [
      -10,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      "48" as unknown as number,
      null as unknown as number,
    ];
    for (const v of bad) {
      const r = readNativeInsets({ insetTop: () => v, insetBottom: () => v });
      expect(r, `坏值 ${String(v)} 应归 0`).toEqual({ top: 0, bottom: 0 });
    }
  });

  it("故障注入:若不做归零,负数会直接穿出去(证明归零判据是活的)", () => {
    const raw = { insetBottom: () => -10 };
    expect(raw.insetBottom()).toBe(-10);
    expect(readNativeInsets(raw).bottom).toBe(0);
  });
});
