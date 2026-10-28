/**
 * 旧档启动补账 —— 开局曾直接调用 cultivation.learn,没有录图鉴、没有记修习数。
 * 读档修形后必须由引擎启动链路补上,且不能把已录条目重复计数。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { useCultivationStore } from "@/stores/cultivation";
import { useGameStore } from "@/stores/game";
import { useQuestsStore } from "@/stores/quests";
import { engine } from "./engine";

function stubBrowserApis(): void {
  const noop = (): void => undefined;
  vi.stubGlobal("document", {
    visibilityState: "visible",
    addEventListener: noop,
    removeEventListener: noop,
  });
  vi.stubGlobal("window", {
    setInterval: () => 1,
    clearInterval: noop,
    addEventListener: noop,
    removeEventListener: noop,
  });
}

describe("启动自愈 · 旧档功法图鉴", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    stubBrowserApis();
  });

  afterEach(() => {
    engine.stop();
    vi.unstubAllGlobals();
  });

  it("旧档已有太玄经但漏录时,启动后补齐图鉴与修习计数", () => {
    const cultivation = useCultivationStore();
    const game = useGameStore();
    const quests = useQuestsStore();
    cultivation.learn("m_taixuan");
    game.markStarted();

    engine.start();

    expect(quests.collections.gongfa).toContain("m_taixuan");
    expect(quests.counter("gongfaLearned")).toBe(1);
  });
});
