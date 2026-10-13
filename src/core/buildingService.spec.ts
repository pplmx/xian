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
import { buildingUpgradeInfo, buildingUpgradePreview } from "./buildingService";
import { buildingDef, BUILDINGS } from "@/data/buildings";

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

describe("buildingUpgradePreview · 升级/建造的增益预览", () => {
  /** 预览行必须是 effectText(nextLevel) 的子集,且与当前行字面不同(同源不抄第二份) */
  it("预览行是下一级 effectText 的字面变化子集", () => {
    for (const def of BUILDINGS) {
      for (let lv = 0; lv <= def.maxLevel; lv++) {
        const prev = buildingUpgradePreview(def.id, lv);
        if (prev.nextLevel > def.maxLevel) {
          expect(prev.lines).toEqual([]);
          continue;
        }
        const cur = lv > 0 ? def.effectText(lv) : [];
        const nxt = def.effectText(prev.nextLevel);
        for (const line of prev.lines) {
          expect(nxt).toContain(line); // 是下一级文案的子集
        }
        // 字面没变(或对齐位置相同)的行不被当成增益搬上来
        for (let i = 0; i < nxt.length; i++) {
          if (nxt[i] === cur[i]) {
            expect(prev.lines).not.toContain(nxt[i]);
          }
        }
      }
    }
  });

  it("藏经阁:只报会变的行,平铺说明行不进预览", () => {
    // 藏经阁第三行「日夜翻检…」是散文,不随级变
    const prev = buildingUpgradePreview("library", 3);
    expect(prev.nextLevel).toBe(4);
    expect(prev.lines.some((l) => l.startsWith("日夜翻检"))).toBe(false);
    expect(prev.lines.length).toBeGreaterThan(0);
  });

  it("炼丹炉:第二行散文排除,只剩双成率一行", () => {
    const prev = buildingUpgradePreview("alchemy", 3);
    expect(prev.lines).toHaveLength(1);
    expect(prev.lines[0]).toContain("双成率");
  });

  it("炼器台:强化的档位行在没到档时不报(每 2 级才涨一次,偶数级起不涨)", () => {
    // 强化上限 = floor(lv/2):2→3 档没变(floor1→1),只有省耗那一行占用预览
    const prev = buildingUpgradePreview("forge", 2);
    expect(prev.nextLevel).toBe(3);
    expect(prev.lines.some((l) => l.startsWith("强化"))).toBe(false);
    expect(prev.lines.some((l) => l.startsWith("炼器省耗"))).toBe(true);
  });

  it("首建(0→1):没有当前效果,预览=整张下一级效果", () => {
    const prev = buildingUpgradePreview("mansion", 0);
    expect(prev.built).toBe(true);
    expect(prev.nextLevel).toBe(1);
    expect(prev.lines).toEqual(buildingDef("mansion")!.effectText(1));
  });

  it("满级:没有下一级,预览为空", () => {
    const def = buildingDef("mansion")!;
    const prev = buildingUpgradePreview("mansion", def.maxLevel);
    expect(prev.nextLevel).toBe(def.maxLevel + 1);
    expect(prev.lines).toEqual([]);
  });
});

it("效果行不出双符号(++/+-):effectText 是给玩家看的,不该出现「++4%」这种", () => {
  for (const def of BUILDINGS) {
    for (let lv = 0; lv <= def.maxLevel; lv++) {
      for (const line of def.effectText(lv)) {
        expect(line, `${def.id}@${lv}: ${line}`).not.toMatch(/[+-]{2,}/);
      }
    }
  }
});
