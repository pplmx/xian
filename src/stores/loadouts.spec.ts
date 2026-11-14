/**
 * 构筑快照(loadouts)的坏档自修
 *
 * sanitize 曾只校验外层 id:一个"id 是字符串、内部写坏"的存档(equipment 为 null、
 * subGongfa 不是数组、artifactIds 缺字段)能溜过滤镜,却在 applyLoadout 里
 * Object.keys(equipment)/subGongfa.filter/artifactIds.filter 三连崩 —— 切换构筑直接散架。
 * 契约:嵌套形状不可用的整条丢弃,只留 applyLoadout 吃得动的。
 */
import { describe, it, expect, beforeEach } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { MAX_LOADOUTS, useLoadoutsStore } from "./loadouts";
import type { Loadout } from "@/types";

const base: Loadout = {
  id: "a",
  name: "剑修",
  seal: "剑",
  mainGongfa: null,
  subGongfa: [],
  artifactIds: [],
  equipment: {},
  // savedAt 已删（全仓零读取，见 core/typeFieldCoverage）
};

describe("构筑快照自修", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("嵌套形状写坏的整条丢弃,只留 applyLoadout 吃得动的", () => {
    const loadouts = useLoadoutsStore();
    loadouts.list = [
      base,
      { ...base, id: "b", equipment: null as unknown as Loadout["equipment"] },
      { ...base, id: "c", subGongfa: 5 as unknown as string[] },
      { ...base, id: "d", artifactIds: undefined as unknown as string[] },
      { ...base, id: "e", equipment: [] as unknown as Loadout["equipment"] },
    ];
    loadouts.sanitize();
    expect(loadouts.list.map((l) => l.id)).toEqual(["a"]);
  });

  it("合法构筑原样保留(空 equipment / 空数组都放行)", () => {
    const loadouts = useLoadoutsStore();
    const good: Loadout = {
      id: "g",
      name: "体修",
      seal: "体",
      mainGongfa: "gongfa_jin",
      subGongfa: ["gongfa_mu"],
      artifactIds: ["zhaohun"],
      equipment: { weapon: "uid-1" },
      // savedAt 已删（全仓零读取，见 core/typeFieldCoverage）
    };
    loadouts.list = [good, { ...base, id: "h", equipment: {} }];
    loadouts.sanitize();
    expect(loadouts.list.map((l) => l.id)).toEqual(["g", "h"]);
  });
});

describe("删除构筑 · remove", () => {
  /*
   * `remove` 与它唯一的调用方 `core/loadoutService.deleteLoadout` 此前**没有任何用例**
   * —— 而它是玩家点「删除构筑 → 确认删除」时真正改存档的那一步。删错了不会报错,
   * 只是少一条或多一条,玩家下次想换装才发现。
   */
  beforeEach(() => setActivePinia(createPinia()));

  /** 复用上面的 base,只换 id 与名字 */
  const at = (id: string, name: string) => ({ ...base, id, name });

  it("只删指定的那一条,其余原样", () => {
    const store = useLoadoutsStore();
    store.list = [at("a", "剑修"), at("b", "丹修"), at("c", "体修")];
    store.remove("b");
    expect(store.list.map((l) => l.id)).toEqual(["a", "c"]);
  });

  it("删到空也正常 —— 空列表不该留下哨兵项", () => {
    const store = useLoadoutsStore();
    store.list = [at("only", "唯一")];
    store.remove("only");
    expect(store.list).toEqual([]);
  });

  it("id 不存在时什么都不变 —— 重复点「确认删除」是安全的", () => {
    const store = useLoadoutsStore();
    store.list = [at("a", "剑修")];
    store.remove("no-such-id");
    expect(store.list.map((l) => l.id)).toEqual(["a"]);
  });

  it("重复删同一条:第二次是空操作,不会误伤别的", () => {
    const store = useLoadoutsStore();
    store.list = [at("a", "剑修"), at("b", "丹修")];
    store.remove("a");
    store.remove("a");
    expect(store.list.map((l) => l.id)).toEqual(["b"]);
  });

  it("删完还能再加回来 —— 上限不该被已删除的项占着", () => {
    const store = useLoadoutsStore();
    store.list = Array.from({ length: MAX_LOADOUTS }, (_, i) => at(`x${i}`, `构筑${i}`));
    expect(store.add(at("overflow", "加不进去")), "满了该拒绝").toBe(false);
    store.remove("x0");
    expect(store.add(at("overflow", "腾出来就能加")), "删掉一条后该能再加").toBe(true);
    expect(store.list.length).toBe(MAX_LOADOUTS);
  });
});
