/**
 * buildingUpgradeInfo —— 资源检查与「列差多少」
 *
 * 纪律:「付不起置灰 + 列差多少」。此前 canUpgrade 只查境界/顶层/洞府辖限
 * (库的同一次判定),灵石玄铁够不够不进判定:升不起时按钮仍可点、点了才弹
 * 一句宽泛的「灵石或玄铁不足」。补资源检查,reason 改为「尚差 X 石 · 玄铁
 * Y 块」(双缺合并一句),BuildingLedgerRow 按钮直显,不再让玩家点下去才被教训。
 */
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { useDongfuStore } from "@/stores/dongfu";
import { useResourcesStore } from "@/stores/resources";
import { usePlayerStore } from "@/stores/player";
import { useQuestsStore } from "@/stores/quests";
import { gn, toNum } from "@/utils/gnum";
import {
  buildingUpgradeInfo,
  buildingUpgradePreview,
  buildingUpgradeN,
  buildingUpgradeBatchCost,
} from "./buildingService";
import { buildingDef, BUILDINGS } from "@/data/buildings";
import { mansionShortfallOf } from "./engineFacilities";

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

/**
 * `blockedBy` —— reason 是哪一档门槛给的。
 *
 * 「被洞府档住时要补一条出口」只有那一档才成立,而档位若按中文文案去认
 * (`reason.includes("洞府")`),改一个字出口就静默消失。故档位由 core 给出。
 *
 * 判据把**四档各走一遍**,且两侧都量:该是哪档就是哪档、不该串档。
 * 只核「能升时是 none」会漏掉「全都被标成同一档」这种更坏的情形。
 */
describe("buildingUpgradeInfo · blockedBy 是档位,不是文案", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  const rich = (): void => {
    const resources = useResourcesStore();
    resources.spiritStone = gn(1e15);
    resources.ore = 999999;
  };

  it("能升 → none", () => {
    buildArrayToLevel(1);
    rich();
    expect(buildingUpgradeInfo("array").blockedBy).toBe("none");
  });

  it("境界不够 → realm", () => {
    useDongfuStore().levels = { ...useDongfuStore().levels, library: 0 };
    usePlayerStore().major = 0; // 藏经阁需筑基
    rich();
    const info = buildingUpgradeInfo("library");
    expect(info.canUpgrade).toBe(false);
    expect(info.blockedBy).toBe("realm");
  });

  it("已至顶层 → top", () => {
    usePlayerStore().major = 9;
    useDongfuStore().levels = { ...useDongfuStore().levels, mansion: 4, beast: 8 };
    rich();
    const info = buildingUpgradeInfo("beast");
    expect(info.canUpgrade).toBe(false);
    expect(info.blockedBy).toBe("top");
  });

  it("受洞府所限 → mansion(且只有这一档才给得出「还差几级」)", () => {
    usePlayerStore().major = 9;
    useDongfuStore().levels = { ...useDongfuStore().levels, mansion: 1, array: 10 };
    rich();
    const info = buildingUpgradeInfo("array");
    expect(info.canUpgrade).toBe(false);
    expect(info.blockedBy).toBe("mansion");
    expect(mansionShortfallOf("array", useDongfuStore().levels)?.needMansionLevel).toBe(2);
  });

  it("资源不够 → resources(它盖过能升那一档,不等于「能升」)", () => {
    buildArrayToLevel(1);
    const resources = useResourcesStore();
    resources.spiritStone = gn(0);
    resources.ore = 0;
    const info = buildingUpgradeInfo("array");
    expect(info.canUpgrade).toBe(false);
    expect(info.blockedBy).toBe("resources");
  });

  it("改文案不改档位 —— 这是它存在的理由", () => {
    /*
     * 把库给的那句 capReason 真的换掉(**在源码层**改不了),故换一条路验证形状:
     * `blockedBy` 必须由「洞府辖限这个事实」推出,而不是由 reason 里的某个字推出。
     *
     * 两条互补的实测:
     *   ① 同一档门槛,把洞府升一级让它不再成立 → 档位跟着变(不是恒为 mansion);
     *   ② 文案里没有「洞府」二字的那两档(realm / top)不会被误归进来。
     * 若实现退回 `reason.includes("洞府")`,①仍会过、②也会过 —— 但它挡不住
     * 「文案一改就断」;真正的保障是这条判据**读的是 blockedBy 而不是 reason**,
     * 而 blockedBy 的类型是五档枚举,没有「按文案猜」的余地。
     */
    usePlayerStore().major = 9;
    useDongfuStore().levels = { ...useDongfuStore().levels, mansion: 1, array: 10 };
    rich();
    expect(buildingUpgradeInfo("array").blockedBy).toBe("mansion");

    // ① 洞府升到 2 级:不再被档住,档位当场离开 mansion
    useDongfuStore().levels = { ...useDongfuStore().levels, mansion: 2 };
    expect(buildingUpgradeInfo("array").blockedBy).toBe("none");

    // ② 另外两档的文案里没有「洞府」二字,各归各档
    usePlayerStore().major = 0;
    useDongfuStore().levels = { ...useDongfuStore().levels, library: 0 };
    expect(buildingUpgradeInfo("library").blockedBy).toBe("realm");
    usePlayerStore().major = 9;
    useDongfuStore().levels = { ...useDongfuStore().levels, beast: 8 };
    expect(buildingUpgradeInfo("beast").blockedBy).toBe("top");
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

  /**
   * 连升 N 级买的是整段:单步预告只讲「再升一层又添 X」,玩家得拿看不到的
   * 逐级增量自己加总。批量预览从当前级直接 diff 到目标级(effectText 是
   * 累计值,两张表相减即整段净得),与单步共用同一套「只报会变的行」。
   */
  it("连升整段预览:从当前级直接 diff 到目标级,报累积净得", () => {
    const def = buildingDef("mansion")!;
    // 0→2(两步,不越 maxLevel):与首建同义(当前效果为空表),整张 2 级效果
    const two = buildingUpgradePreview("mansion", 0, undefined, 2);
    expect(two.nextLevel).toBe(2);
    expect(two.lines).toEqual(def.effectText(2));
    // 从 1 级升到 3 级:预览指向 3,行 = effectText(3) 相对 effectText(1) 变化的行
    const prev = buildingUpgradePreview("mansion", 1, undefined, 2);
    expect(prev.nextLevel).toBe(3);
    const cur = def.effectText(1);
    const to = def.effectText(3);
    expect(prev.lines).toEqual(to.filter((line, i) => line !== cur[i]));
    // 步数 1 退化为单步(与不传一致)
    expect(buildingUpgradePreview("mansion", 1, undefined, 1).lines).toEqual(
      buildingUpgradePreview("mansion", 1).lines,
    );
    // 越过上限:整段预览为空(卡面已有到顶理由,不画画不了的饼)
    expect(buildingUpgradePreview("mansion", 3, undefined, 5).lines).toEqual([]);
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

describe("buildingUpgradeN · 一键连升 ×5", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    usePlayerStore().major = 0; // 聚灵阵 0 境可建,不受境界门槛拦
  });

  it("灵石/玄铁充足:连升到洞府辖限停下(0 级洞府 → 聚灵阵止步 5 级)", () => {
    const dongfu = useDongfuStore();
    const resources = useResourcesStore();
    resources.ore = 1e9;
    resources.spiritStone = gn(1e15);
    const res = buildingUpgradeN("array");
    expect(dongfu.levels["array"]).toBe(dongfu.buildingCap("array"));
    expect(res.levelsGained).toBe(dongfu.levels["array"]);
    expect(toNum(res.stone)).toBeGreaterThan(0);
  });

  it("无料:一级不动,返回 0 级进的空账", () => {
    const dongfu = useDongfuStore();
    const res = buildingUpgradeN("array");
    expect(res.levelsGained).toBe(0);
    expect(toNum(res.stone)).toBe(0);
    expect(dongfu.levels["array"]).toBe(0);
  });

  it("料到即止:买到烧光为止,不欠账(灵石不为负),也不越到顶", () => {
    const dongfu = useDongfuStore();
    const resources = useResourcesStore();
    resources.ore = 100000;
    resources.spiritStone = gn(200);
    const res = buildingUpgradeN("array");
    expect(res.levelsGained).toBeGreaterThan(0);
    expect(res.levelsGained).toBeLessThan(dongfu.buildingCap("array"));
    expect(toNum(resources.spiritStone)).toBeGreaterThanOrEqual(0);
    expect(dongfu.levels["array"]).toBe(res.levelsGained);
  });

  it("连升批量按实升级数计账(升几级计几笔,与逐级同口径)", () => {
    buildArrayToLevel(1);
    useResourcesStore().spiritStone = gn(1e15);
    useResourcesStore().ore = 999999;
    const r = buildingUpgradeN("array", 5);
    expect(r.levelsGained).toBeGreaterThan(1);
    // 曾把连升整批只 track 一次:升 5 级却只算 1 次「升级建筑」,比逐级慢 5 倍
    const quests = useQuestsStore();
    expect(quests.counter("buildingUpgrades")).toBe(r.levelsGained);
  });

  it("连升的成本预演(buildingUpgradeBatchCost)与真花(buildingUpgradeN)同一判定、同一账", () => {
    buildArrayToLevel(1);
    // 料到即止的那档最考验口径:预演要跟实花对齐,不是先画个「×5」再烧光
    useResourcesStore().spiritStone = gn(200);
    useResourcesStore().ore = 100000;
    const preview = buildingUpgradeBatchCost("array", 5);
    const res = buildingUpgradeN("array", 5);
    // 预演该批会升几级、花多少 —— 正是按下后实际会发生的数
    expect(preview.levels, "预演批级数与实升不符").toBe(res.levelsGained);
    expect(toNum(preview.stone), "预演石账与实花不符").toBe(toNum(res.stone));
    expect(preview.ore, "预演玄铁账与实花不符").toBe(res.ore);
    expect(toNum(useResourcesStore().spiritStone), "真花后灵石不为负").toBeGreaterThanOrEqual(0);
  });
});
