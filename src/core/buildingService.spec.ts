/**
 * buildingUpgradeInfo —— 资源检查与「列差多少」
 *
 * 纪律:「付不起置灰 + 列差多少」。此前 canUpgrade 只查境界/顶层/洞府辖限
 * (库的同一次判定),灵石玄铁够不够不进判定:升不起时按钮仍可点、点了才弹
 * 一句宽泛的「灵石或玄铁不足」。补资源检查,reason 改为「尚差 X 石 · 玄铁
 * Y 块」(双缺合并一句),BuildingCard 按钮直显,不再让玩家点下去才被教训。
 */
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { useDongfuStore } from "@/stores/dongfu";
import { useResourcesStore } from "@/stores/resources";
import { usePlayerStore } from "@/stores/player";
import { gn } from "@/utils/gnum";
import { buildingUpgradeInfo } from "./buildingService";

/** 把聚灵阵撑到 3 级(高于首级,有玄铁成本;且远未到顶层/辖限) */
function buildArrayToLevel(lv: number): void {
  const dongfu = useDongfuStore();
  dongfu.setLevel("array", lv);
  // 境界与洞府辖限都不卡:炼气就能建,3 级远低于 (0+1)*5 辖限
  usePlayerStore().major = 0;
}

describe("buildingUpgradeInfo · 资源检查与列差", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("灵石不足:canUpgrade=false,reason 列出尚差石数", () => {
    buildArrayToLevel(3);
    const resources = useResourcesStore();
    resources.spiritStone = gn(0);
    resources.ore = 99999;

    const info = buildingUpgradeInfo("array");
    expect(info.canUpgrade).toBe(false);
    expect(info.reason).toContain("尚差");
    expect(info.reason).toMatch(/\d/);
    expect(info.reason).toContain("石");
  });

  it("玄铁不足:canUpgrade=false,reason 列出尚差铁数", () => {
    buildArrayToLevel(3);
    const resources = useResourcesStore();
    resources.spiritStone = gn(1e15);
    resources.ore = 0;

    const info = buildingUpgradeInfo("array");
    expect(info.canUpgrade).toBe(false);
    expect(info.reason).toContain("铁");
    expect(info.reason).toMatch(/\d/);
  });

  it("灵石玄铁都给足:canUpgrade=true(不被资源检查误拦)", () => {
    buildArrayToLevel(3);
    const resources = useResourcesStore();
    resources.spiritStone = gn(1e15);
    resources.ore = 99999;

    const info = buildingUpgradeInfo("array");
    expect(info.canUpgrade).toBe(true);
    expect(info.reason).toBe("");
  });

  it("灵石玄铁双缺:reason 一句里同时列石差与铁差(「 · 」粘连)", () => {
    buildArrayToLevel(3);
    const resources = useResourcesStore();
    resources.spiritStone = gn(0);
    resources.ore = 0;

    const info = buildingUpgradeInfo("array");
    expect(info.canUpgrade).toBe(false);
    expect(info.reason).toContain("石");
    expect(info.reason).toContain("铁");
    expect(info.reason).toContain("·");
  });
});
