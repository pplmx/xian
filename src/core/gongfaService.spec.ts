import { describe, it, expect, beforeEach } from "vite-plus/test";
import { setActivePinia, createPinia } from "pinia";
import { GONGFA } from "@/data/gongfa";
import {
  learnGongfa,
  learnRandomGongfa,
  syncLearnedGongfa,
  upgradeGongfaAll,
} from "./gongfaService";
import { useCultivationStore } from "@/stores/cultivation";
import { useQuestsStore } from "@/stores/quests";
import { useResourcesStore } from "@/stores/resources";

describe("功法习得漏斗", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("首次习得同时写功法、图鉴与计数,重复习得不再记账", () => {
    const cultivation = useCultivationStore();
    const quests = useQuestsStore();

    expect(learnGongfa("m_taixuan")).toBe(true);
    expect(cultivation.learned.m_taixuan).toBe(1);
    expect(quests.collections.gongfa).toContain("m_taixuan");
    expect(quests.counter("gongfaLearned")).toBe(1);

    expect(learnGongfa("m_taixuan")).toBe(false);
    expect(quests.collections.gongfa).toEqual(["m_taixuan"]);
    expect(quests.counter("gongfaLearned")).toBe(1);
  });

  it("随机习得走同一漏斗,指定与抽取两条分支都不漏记", () => {
    const quests = useQuestsStore();

    expect(learnRandomGongfa("m_lihuo")).toBe("离火焚天诀");
    expect(quests.collections.gongfa).toContain("m_lihuo");
    expect(quests.counter("gongfaLearned")).toBe(1);

    const randomName = learnRandomGongfa();
    const randomDef = GONGFA.find((g) => g.name === randomName);
    expect(randomDef, "随机习得必须返回功法库里真实存在的一部").toBeDefined();
    expect(quests.collections.gongfa).toContain(randomDef!.id);
    expect(quests.counter("gongfaLearned")).toBe(2);
  });

  it("旧档只补未录功法,重复补账不把计数越垒越高", () => {
    const cultivation = useCultivationStore();
    const quests = useQuestsStore();
    cultivation.learn("m_taixuan");
    cultivation.learn("m_lihuo");
    quests.collect("gongfa", "m_taixuan");
    quests.inc("gongfaLearned");

    expect(syncLearnedGongfa()).toBe(1);
    expect(quests.collections.gongfa).toEqual(["m_taixuan", "m_lihuo"]);
    expect(quests.counter("gongfaLearned")).toBe(2);

    expect(syncLearnedGongfa()).toBe(0);
    expect(quests.counter("gongfaLearned")).toBe(2);
  });
});

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
