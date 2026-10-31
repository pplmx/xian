/**
 * 展品档必须是一份「启动补扫前后不变」的自洽存档。
 *
 * 它是截图与 UI 自检的共同底稿。若 fixture 的境界早已超过成就/名号记录,
 * 页面会先显示「已至真仙 · 尚差 0」却仍未获得,把测试夹具的问题伪装成产品死路。
 */
import { describe, expect, it, vi } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { useGameStore } from "@/stores/game";
import { useInventoryStore } from "@/stores/inventory";
import { usePlayerStore } from "@/stores/player";
import { useQuestsStore } from "@/stores/quests";
import { useResourcesStore } from "@/stores/resources";
import { useUiStore } from "@/stores/ui";
// @ts-expect-error 截图夹具是无类型的 mjs,这里只读取它的公开工厂
import { showcaseSlices } from "../../scripts/lib/saveFixture.mjs";
import { checkStateAchievements } from "./progress";

describe("截图展品档 · 启动补扫不制造第二本账", () => {
  it("高境展品档的成就、名号与当前状态一致,补扫不会再改档或报喜", () => {
    setActivePinia(createPinia());
    const slices = showcaseSlices("light");
    useGameStore().$patch(slices.game);
    usePlayerStore().$patch(slices.player);
    useResourcesStore().$patch(slices.resources);
    useInventoryStore().$patch(slices.inventory);
    useQuestsStore().$patch(slices.quests);

    const quests = useQuestsStore();
    const before = {
      achieved: [...quests.achieved],
      titlesOwned: [...quests.titlesOwned],
      mainIdx: quests.mainIdx,
    };
    const toast = vi.spyOn(useUiStore(), "toast");

    checkStateAchievements();

    expect(quests.achieved, "展品档已有成就应与可判定状态一致").toEqual(before.achieved);
    expect(quests.titlesOwned, "展品档已达成成就对应的名号应齐").toEqual(before.titlesOwned);
    expect(quests.mainIdx, "展品档的主线不应在启动时被补推进").toBe(before.mainIdx);
    expect(toast, "自洽夹具不应在启动时补发成就或名号报喜").not.toHaveBeenCalled();
  });
});
