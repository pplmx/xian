import { describe, it, expect, beforeEach } from "vite-plus/test";
import { setActivePinia, createPinia } from "pinia";
import { GONGFA } from "@/data/gongfa";
import { upgradeGongfaAll } from "./gongfaService";
import { useCultivationStore } from "@/stores/cultivation";
import { useResourcesStore } from "@/stores/resources";

describe("功法进修", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("修到顶:一次修到圆满,层数到上限、逐层同账", () => {
    const cultivation = useCultivationStore();
    const resources = useResourcesStore();
    const def = GONGFA[0]!;
    cultivation.learn(def.id);
    cultivation.learned[def.id] = 3; // 从第 3 层开修
    const wudaoBefore = 1_000_000;
    const pageBefore = 1_000_000;
    resources.wudao = wudaoBefore;
    resources.page = pageBefore;
    const res = upgradeGongfaAll(def.id);
    expect(res.ended).toBe("max");
    expect(cultivation.learned[def.id]).toBe(def.maxLevel);
    expect(res.count).toBe(def.maxLevel - 3);
    // 花了账,但没有越权掏到负数
    expect(resources.wudao).toBeGreaterThanOrEqual(0);
    expect(resources.page).toBeGreaterThanOrEqual(0);
    expect(res.wudao).toBe(wudaoBefore - resources.wudao);
    expect(res.page).toBe(pageBefore - resources.page);
  });

  it("修到顶料尽止:悟道点/残页只够几条就只修几条,不越权烧", () => {
    const cultivation = useCultivationStore();
    const resources = useResourcesStore();
    const def = GONGFA[0]!;
    cultivation.learn(def.id);
    cultivation.learned[def.id] = 2;
    resources.wudao = 1; // 几乎不够
    resources.page = 9999;
    const res = upgradeGongfaAll(def.id);
    expect(res.ended).toBe("broke");
    // 只够第一层就只修一层,余量不为负
    expect(cultivation.learned[def.id]).toBe(2 + res.count);
    expect(res.count).toBeGreaterThanOrEqual(0);
    expect(resources.wudao).toBeGreaterThanOrEqual(0);
    expect(resources.page).toBeGreaterThanOrEqual(0);
  });
});
