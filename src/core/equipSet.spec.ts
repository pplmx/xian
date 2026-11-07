/**
 * Phase 31.0 S5:装备共鸣 —— 机制组合而非数值堆叠
 */
import { describe, it, expect } from "vite-plus/test";
import { activeSets, setCounts, hasActiveSet, equipSetDef, EQUIP_SETS } from "./equipSet";
import { EQUIPMENT_TEMPLATES } from "@/data/equipment";
import type { EquipmentInstance, QualityId } from "@/types";

function inst(uid: string, templateId: string): EquipmentInstance {
  return { uid, templateId, quality: "fine" as QualityId, tier: 3, level: 0, affixes: [] };
}

describe("装备共鸣(equipSet)", () => {
  it("组定义完整:铁壁/星斗,含机制钩子", () => {
    expect(equipSetDef("s_tiebi")?.hook).toBe("ironwall");
    expect(equipSetDef("s_xingdou")?.hook).toBe("astral");
  });

  /**
   * 每一套共鸣必须是**独一份的机制** —— 两个套共用同一个 hook,玩家凑齐它们拿到的
   * 是同一个效果,那第二套存在的意义只剩名字。
   *
   * 实测(本轮审计):五套只挂了两个 hook ——
   *
   * | 套 | hook | 实际效果 |
   * | --- | --- | --- |
   * | 铁壁共鸣(阶 2/4/6) | ironwall | 致命伤首次保留 1 点气血 |
   * | 神铠共鸣(阶 28/28/28) | ironwall | **同一个** |
   * | 星斗共鸣(阶 8/14) | astral | 开战 +5% 最大气血盾 |
   * | 仙甲共鸣(阶 23/23/23) | astral | **同一个** |
   * | 混沌共鸣(阶 31/31/31) | astral | **同一个** |
   *
   * 于是 28 阶的神铠与 2 阶的铁壁是同一个机制,31 阶的混沌与 8 阶的星斗也是 ——
   * 越到后期,玩家凑齐一套更难,拿到的却和早期一模一样。文案(「受到致命伤害时,
   * 首次保留 1 点气血」)一个字没改,只是换了名字。
   *
   * 这条判据钉的是:不同套不许共用 hook。要加套,就得给新机制。
   */
  it("不同共鸣组不许共用同一个机制钩子", () => {
    const byHook = new Map<string, string[]>();
    for (const set of EQUIP_SETS) {
      const list = byHook.get(set.hook) ?? [];
      list.push(set.name);
      byHook.set(set.hook, list);
    }
    const shared = [...byHook.entries()]
      .filter(([, names]) => names.length > 1)
      .map(([hook, names]) => `${hook}: ${names.join(" / ")}`);
    expect(shared, "这些共鸣组共用同一个机制 —— 凑齐不同的套拿到一样的效果,套名就只剩名字").toEqual(
      [],
    );
  });

  it("同 set 两件触发共鸣,单件不触发", () => {
    const one = [inst("a", "w_xuantie")];
    expect(activeSets(one).length).toBe(0);
    const two = [inst("a", "w_xuantie"), inst("b", "h_xuantie")];
    const sets = activeSets(two);
    expect(sets.length).toBe(1);
    expect(sets[0]!.id).toBe("s_tiebi");
    expect(hasActiveSet(two, "ironwall")).toBe(true);
  });

  it("不同 set 互不干扰,各自计件(同槽位只算后装的那件)", () => {
    const tiebi = [inst("a", "w_xuantie"), inst("b", "h_xuantie")];
    const xingdou = [inst("c", "h_xingchen"), inst("d", "b_xingluo")];
    expect(activeSets(tiebi).map((s) => s.id)).toEqual(["s_tiebi"]);
    expect(activeSets(xingdou).map((s) => s.id)).toEqual(["s_xingdou"]);
    // 两件都戴在头上的方案不存在(装配是一槽一件):库按槽位归并,后一件顶掉前一件
    const both = [
      inst("a", "w_xuantie"),
      inst("b", "h_xuantie"),
      inst("c", "h_xingchen"),
      inst("d", "b_xingluo"),
    ];
    expect(activeSets(both).map((s) => s.id)).toEqual(["s_xingdou"]);
  });

  it("已装备统计正确(未装备的不计)", () => {
    const counts = setCounts([inst("a", "w_xuantie"), inst("b", "b_xuanwu")]);
    expect(counts.get("s_tiebi")).toBe(2);
  });

  it("每件带 set 的装备都指向一个真实存在的共鸣定义", () => {
    // 扩界新增的仙甲/神铠/混沌套件若忘了登记,共鸣会静默失效——
    // 界面上写着"套装",打起来却什么也不发生,正是最难被发现的暗伤
    for (const t of EQUIPMENT_TEMPLATES) {
      if (!t.set) continue;
      const def = equipSetDef(t.set);
      expect(def, `${t.name}(${t.id}) 引用了不存在的共鸣 ${t.set}`).toBeDefined();
      expect(def!.effectDesc.length).toBeGreaterThan(0);
    }
  });

  it("每个共鸣都有足够多的部件可以真的触发(不能是凑不齐的空套)", () => {
    const pieces = new Map<string, number>();
    for (const t of EQUIPMENT_TEMPLATES) {
      if (!t.set) continue;
      pieces.set(t.set, (pieces.get(t.set) ?? 0) + 1);
    }
    for (const [setId, n] of pieces) {
      const def = equipSetDef(setId)!;
      expect(
        n,
        `${def.name} 只有 ${n} 件,达不到触发所需的 ${def.required} 件`,
      ).toBeGreaterThanOrEqual(def.required);
    }
  });
});
