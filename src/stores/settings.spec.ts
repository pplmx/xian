/**
 * 设置 · reduceMotion 的系统偏好播种契约。
 *
 * 系统级开了「减少动效」(prefers-reduced-motion: reduce)的玩家,style.css 的
 * 媒体查询能把 CSS 动画压死,但战斗回放是 JS 驱动的(setInterval 逐行投入),
 * 只认应用内的 settings.reduceMotion —— 若它永远 false 起步,关系统动效的人
 * 每次开打照样被迫逐条看。故 reduceMotion 的**默认值**必须从系统偏好播种;
 * 播种之后,持久化档与应用内开关说了算(老玩家显式关掉的偏好不被覆盖)。
 *
 * 其余设置项(音量/主题/分解品质等)的失效安全各自在 sanitize 与消费方 spec
 * 里钉,此处不重复。
 */
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { useSettingsStore } from "./settings";

function stubMatchMedia(matches: boolean): void {
  vi.stubGlobal("window", {
    matchMedia: (query: string) => ({
      matches: query.includes("prefers-reduced-motion") ? matches : false,
    }),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("settings.reduceMotion · 系统偏好播种", () => {
  it("系统开了减少动效:应用内默认值随之打开", () => {
    setActivePinia(createPinia());
    stubMatchMedia(true);
    const settings = useSettingsStore();
    expect(settings.reduceMotion).toBe(true);
  });

  it("系统没开(或探测不了):维持 false,行为不变", () => {
    setActivePinia(createPinia());
    stubMatchMedia(false);
    const settings = useSettingsStore();
    expect(settings.reduceMotion).toBe(false);
  });

  it("环境没有 window(node / 未来宿主):不抛,回落 false", () => {
    setActivePinia(createPinia());
    vi.stubGlobal("window", undefined);
    const settings = useSettingsStore();
    expect(settings.reduceMotion).toBe(false);
  });
});
