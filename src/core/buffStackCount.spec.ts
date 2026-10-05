/**
 * buffStackCount —— 弹窗「已叠 N 份」的推导(纯显示层,不动 schema)。
 *
 * 起因(BuffDialog 念不通):叠 2 颗聚灵丹后 剩余 40 分,而「全程」一行印的是
 * **单颗** 20 分 —— 剩余看着比全程还长,玩家以为坏了。其实丹药增益的叠法是
 * "加上"(extend)+「至多可攒」封顶(2× 单颗,ISS-232),所以份数可由
 * 剩余 ÷ 单颗时长直接归:剩一轮 = 1 份,封顶 = 2 份。
 *
 * 为什么只对有上限的(丹药增益)报份数:文档说「只列状态来源」,而没有上限的
 * 状态(闭关/重伤/事件祝福)不吃叠法,报个数反而是错的。
 */
import { describe, expect, it } from "vite-plus/test";
import { PILLS } from "@/data/pills";
import { buffDef } from "@/data/buffs";
import { applyBuff, activeBuffsOf, buffStackCount } from "./engineBuffs";
import type { BuffInstance } from "@/types";

describe("buffStackCount:弹窗「已叠 N 份」", () => {
  it("一份时归 1:刚服一颗,份数恒为 1(不多报)", () => {
    const pill = PILLS.find((p) => !!p.buffId)!;
    const defId = pill.buffId!;
    const single = buffDef(defId)!.durationSec;

    const list = applyBuff([] as BuffInstance[], defId, 0);
    const remain = activeBuffsOf(list, 0).find((b) => b.def.id === defId)!.remainingSec;
    expect(remain).toBeCloseTo(single, 6);
    expect(buffStackCount(defId, remain)).toBe(1);
  });

  it("叠到封顶归 2:同一时刻连服两颗,剩余=2×单颗 → 已叠 2 份", () => {
    const pill = PILLS.find((p) => !!p.buffId)!;
    const defId = pill.buffId!;
    const single = buffDef(defId)!.durationSec;

    const once = applyBuff([] as BuffInstance[], defId, 0);
    const twice = applyBuff(once, defId, 0);
    const remain = activeBuffsOf(twice, 0).find((b) => b.def.id === defId)!.remainingSec;
    expect(remain).toBeCloseTo(single * 2, 6);
    expect(buffStackCount(defId, remain)).toBe(2);
  });

  it("剩 1.5 份仍按 2 报:两颗都在,只是第一颗在流逝", () => {
    const pill = PILLS.find((p) => !!p.buffId)!;
    const defId = pill.buffId!;
    const single = buffDef(defId)!.durationSec;

    const once = applyBuff([] as BuffInstance[], defId, 0);
    const twice = applyBuff(once, defId, 0);
    // 叠两颗后过掉半颗的时长:剩余 1.5×单颗 —— 两颗都还在,第一颗只剩一半
    const elapsed = single * 0.5 * 1000;
    const remain = activeBuffsOf(twice, elapsed).find((b) => b.def.id === defId)!.remainingSec;
    expect(remain / single).toBeGreaterThan(1);
    expect(buffStackCount(defId, remain)).toBe(2);
  });

  it("没有上限的状态不报份数:闭关/重伤/事件祝福 → 1(UI 据此不显示那行)", () => {
    for (const defId of ["retreat", "injury", "bless_qingfeng"]) {
      expect(buffStackCount(defId, buffDef(defId)!.durationSec)).toBe(1);
    }
  });
});
