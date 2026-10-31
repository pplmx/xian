/**
 * 成就/称号启动自愈。
 *
 * 老档或导入档可能境界已高、成就与称号却停在旧版本。周期补扫要等引擎跑满
 * 30 秒才第一次执行，直接打开名号页会先看到「已至真仙 · 尚差 0」却仍「未获得」。
 * 启动链路应在首帧渲染前把这类累计事实补齐，而不是让玩家盯着一条看似死路的进度。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { useGameStore } from "@/stores/game";
import { usePlayerStore } from "@/stores/player";
import { useQuestsStore } from "@/stores/quests";
import { useUiStore } from "@/stores/ui";
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

describe("启动自愈 · 成就与称号", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    stubBrowserApis();
    useUiStore();
  });

  afterEach(() => {
    engine.stop();
    vi.unstubAllGlobals();
  });

  it("高境老档在启动时补齐境界成就与对应名号,不留给名号页显示尚差 0", () => {
    const player = usePlayerStore();
    const quests = useQuestsStore();
    const game = useGameStore();

    player.initCharacter("测试道友", { roots: [] } as never);
    player.major = 9;
    player.sub = 3;
    quests.setAchieved([]);
    game.markStarted();

    engine.start();

    expect(quests.hasAchieved("a_r0"), "炼气成就应在启动补扫中解锁").toBe(true);
    expect(quests.hasAchieved("a_r9"), "真仙成就应在启动补扫中解锁").toBe(true);
    expect(quests.titlesOwned, "已达成成就对应的名号应同步回填").toEqual(
      expect.arrayContaining([
        "ti_churu",
        "ti_zhuji",
        "ti_jindan",
        "ti_yuanying",
        "ti_huashen",
        "ti_lianxu",
        "ti_heti",
        "ti_dacheng",
        "ti_dujie",
        "ti_zhenxian",
      ]),
    );
  });
});
