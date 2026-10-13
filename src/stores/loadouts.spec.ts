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
import { useLoadoutsStore } from "./loadouts";
import type { Loadout } from "@/types";

const base: Loadout = {
  id: "a",
  name: "剑修",
  seal: "剑",
  mainGongfa: null,
  subGongfa: [],
  artifactIds: [],
  equipment: {},
  savedAt: 0,
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
      savedAt: 100,
    };
    loadouts.list = [good, { ...base, id: "h", equipment: {} }];
    loadouts.sanitize();
    expect(loadouts.list.map((l) => l.id)).toEqual(["g", "h"]);
  });
});
