import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { mediaMatches } from "./useMediaQuery";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useMediaQuery · 只给结构性断点", () => {
  it("环境没有 window 或 matchMedia 时回落 false", () => {
    vi.stubGlobal("window", undefined);
    expect(mediaMatches("(min-width: 960px)")).toBe(false);

    vi.stubGlobal("window", {});
    expect(mediaMatches("(min-width: 960px)")).toBe(false);
  });

  it("把当前媒体查询结果原样交回", () => {
    vi.stubGlobal("window", {
      matchMedia: (query: string) => ({
        matches: query === "(min-width: 960px)",
      }),
    });

    expect(mediaMatches("(min-width: 960px)")).toBe(true);
    expect(mediaMatches("(min-width: 1100px)")).toBe(false);
  });
});
