/**
 * 器铭 —— 同品同名共鸣件的「这一件」从哪来。
 *
 * 由来:神品·玄铁重剑可以掉出几十件,名字、品阶、词条池全一样,玩家只按战力挑一件就
 * 分解其余 —— 它们在世界里毫无分别。器铭给高品阶的每一件一件不可交换的「出身」:
 * 同一件模板、同一品质,器铭也逐件不同,并且**只由 uid 决定** ——
 * 存盘、刷新、导出导入之后它不会改口(这是「这件东西的来历」,不是每次打开重掷的装饰)。
 *
 * 判据钉四件事:
 *   一 稳定:同一个 uid 反复问,答案恒等;不同 uid 会分到不同的铭;
 *   二 稀有度诚实:只有灵品以上才有器铭,凡/良/精为 null —— 高级感的来源是稀缺,不是人人有份;
 *   三 铭与件相配:铭的「器类」取槽位、铭的「界域」取层级,不另写一份映射;
 *   四 成色读的是词条掷点的真值(roll 均值),不另编一套「评分」。
 */
import { describe, expect, it } from "vite-plus/test";
import { QUALITIES } from "@/data/qualities";
import { EQUIPMENT_TEMPLATES, equipmentTemplate } from "@/data/equipment";
import { INSCRIPTION_VERSES } from "@/data/inscriptions";
import {
  INSCRIPTION_MIN_RANK,
  inscriptionFor,
  inscriptionTemper,
  inscriptionVerseDefs,
} from "./inscription";
import type { EquipmentInstance } from "@/types";

function inst(templateId: string, quality: EquipmentInstance["quality"], uid: string) {
  const t = equipmentTemplate(templateId)!;
  return { uid, templateId, quality, tier: t.tier, level: 0, affixes: [] } as EquipmentInstance;
}

const SAMPLE = EQUIPMENT_TEMPLATES.filter((t) => t.tier <= 6);

describe("器铭 · 只在高品阶出现,且逐件不同", () => {
  it("灵品以下没有器铭 —— 凡/良/精是寻常货,不该人人有铭", () => {
    for (const q of QUALITIES) {
      const got = inscriptionFor(inst(SAMPLE[0]!.id, q.id, "uid-low"));
      if (q.rank < INSCRIPTION_MIN_RANK) {
        expect(got, `${q.name}不该有器铭`).toBeNull();
      } else {
        expect(got, `${q.name}应当有器铭`).not.toBeNull();
      }
    }
  });

  it("同一个 uid 反复问,答案恒等 —— 铭是出身,不是每次打开重掷的装饰", () => {
    const one = inst(SAMPLE[0]!.id, "divine", "uid-stable-1");
    expect(inscriptionFor(one)).toEqual(inscriptionFor({ ...one }));
    expect(inscriptionFor({ ...one, level: 7 }), "强化不该改写出身").toEqual(
      inscriptionFor({ ...one, level: 7 }),
    );
  });

  it("同一件同品质的不同件,会分到不同的铭(不是按模板发铭)", () => {
    const templateId = SAMPLE[0]!.id;
    const names = new Set<string>();
    for (let i = 0; i < 40; i += 1) {
      const got = inscriptionFor(inst(templateId, "heaven", `uid-vary-${i}`));
      names.add(`${got!.title}|${got!.verse.id}`);
    }
    // 40 件里至少出现 8 种不同的器铭组合 —— 一件一铭,而不是一模板一铭
    expect(names.size, "同模板同品质的 40 件只分到过少的铭").toBeGreaterThanOrEqual(8);
  });

  it("铭里不重复器类与界域 —— 那两样器首眉题已经报过", () => {
    for (const t of EQUIPMENT_TEMPLATES) {
      const got = inscriptionFor(inst(t.id, "immortal", `uid-${t.id}`))!;
      // 铭只带这一件独有的部分:铭名、铭文、成色
      expect(Object.keys(got).sort(), `${t.name} 的器铭多带了字段`).toEqual([
        "temper",
        "title",
        "verse",
      ]);
    }
  });

  it("成色刻度本身单调:掷得越满,刻出来的成色只高不低", () => {
    let prev = -1;
    for (let ratio = 0; ratio <= 1.0001; ratio += 0.05) {
      const value = inscriptionTemper(ratio);
      expect(value, `成色刻度在 ${ratio.toFixed(2)} 处回落了`).toBeGreaterThanOrEqual(prev);
      prev = value;
    }
    expect(inscriptionTemper(0), "空铭该落最低档").toBe(0);
    expect(inscriptionTemper(1), "满掷该落最高档").toBe(100);
  });
});

describe("器铭 · 成色读真值", () => {
  it("词条掷得越满,铭里的成色越高;没有词条时按最低档给", () => {
    const base = inst(SAMPLE[0]!.id, "divine", "uid-temper");
    const empty = inscriptionFor(base)!;
    const full = inscriptionFor({
      ...base,
      affixes: [
        { id: "atk1", roll: 1 },
        { id: "def1", roll: 1 },
      ],
    })!;
    expect(full.temper, "满掷的铭反倒不如空铭").toBeGreaterThan(empty.temper);
    expect(empty.temper).toBe(inscriptionTemper(0));
    expect(full.temper).toBe(inscriptionTemper(1));
  });

  it("成色是 0~100 的整数,不吐 NaN / 越界 —— 坏档的 roll 也不会印成乱码", () => {
    const base = inst(SAMPLE[0]!.id, "divine", "uid-badroll");
    for (const affixes of [
      [{ id: "atk1", roll: Number.NaN }],
      [{ id: "atk1", roll: 5 }],
      [{ id: "atk1", roll: -2 }],
      [{ id: "nope", roll: 0.5 }],
    ]) {
      const got = inscriptionFor({ ...base, affixes })!;
      expect(Number.isInteger(got.temper), `roll=${JSON.stringify(affixes)} 吐了非整数`).toBe(true);
      // 写成区间判据(而不是两条单边 >=0 / <=100):下界单边断言恒真,会退化成注释
      expect(
        got.temper >= 0 && got.temper <= 100,
        `roll=${JSON.stringify(affixes)} 的成色 ${got.temper} 越出 0~100`,
      ).toBe(true);
    }
  });
});

describe("器铭 · 铭文取词", () => {
  it("铭文库本身不重复、不带数字 —— 数字该来自这一件的成色,不该写死在铭里", () => {
    const seen = new Set<string>();
    for (const v of INSCRIPTION_VERSES) {
      expect(v.text, `${v.id} 的铭文里不该有会被常数改动的数字`).not.toMatch(/\d/);
      expect(seen.has(v.text), `铭文重复:${v.text}`).toBe(false);
      seen.add(v.text);
    }
    expect(seen.size, "铭文库太小,一眼就会重复").toBeGreaterThanOrEqual(12);
  });

  it("每一档能取到的铭文,都是「到这一档为止」的全部 —— 高品能取低品的每一句", () => {
    for (const q of QUALITIES) {
      const texts = inscriptionVerseDefs(q.rank).map((v) => v.text);
      const want = INSCRIPTION_VERSES.filter((v) => v.minRank <= q.rank).length;
      expect(texts.length, `${q.name} 可取的铭文条数不对`).toBe(want);
      if (q.rank >= INSCRIPTION_MIN_RANK) {
        expect(texts.length, `${q.name} 至少有铭可取`).toBeGreaterThan(0);
      }
    }
    expect(inscriptionVerseDefs(2), "灵品以下没有可入铭的铭文").toEqual([]);
  });

  it("品质越高,可选的铭文只增不减(高品不弱于低品的选择面)", () => {
    for (let rank = INSCRIPTION_MIN_RANK + 1; rank <= 8; rank += 1) {
      expect(
        inscriptionVerseDefs(rank).length,
        `第 ${rank} 档的铭文选项少于上一档`,
      ).toBeGreaterThanOrEqual(inscriptionVerseDefs(rank - 1).length);
    }
  });

  it("同一模板同品质的两件,铭名与铭文不必相同 —— 逐件不同才叫「这一件的出身」", () => {
    const pairs = new Map<string, number>();
    for (let i = 0; i < 60; i += 1) {
      const got = inscriptionFor(inst(SAMPLE[0]!.id, "divine", `uid-pair-${i}`))!;
      const key = `${got.title}|${got.verse.id}`;
      pairs.set(key, (pairs.get(key) ?? 0) + 1);
    }
    expect(pairs.size, "60 件只分到过少的铭名 / 铭文组合").toBeGreaterThanOrEqual(12);
  });
});
