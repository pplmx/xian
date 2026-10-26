/**
 * Boss 机制家族 —— 标签必须对得上机制。
 *
 * `bossArchetypes.ts` 里的八张家族表只是**分类与标签**:真正打架用的词条/技能/阶段写在
 * 每个首领自己的 def 里(见 `data/enemies`)。标签唯一露给玩家的地方是「见过三次之后」
 * 的家族名与印记(`ui/enemyLore`:「狂暴型 · 狂」)——正因为它只是标签,才更容易飘:
 * 给一个没有门机制的首领写「门槛型」,代码不会报错,玩家会看不懂这一场在考什么。
 *
 * 判据:每个家族列一条**签名机制**(写在下方 SIGNATURES 里),家族成员身上至少要有一样。
 * 签名取的是"这个家族靠什么让人记住",不是模板里的字段名 —— 家族表里的 coreMods 只是
 * 参考,各家首领的写法可以不同(例如狂暴型的辨识度来自高倍率技能与暴击,而不是某一条词条)。
 */
import { describe, expect, it } from "vite-plus/test";
import { ENEMIES } from "@/data/enemies";
import { ARCHETYPES } from "./bossArchetypes";
import type { BossArchetype, EnemyDef } from "@/types";

const BOSSES = ENEMIES.filter((e) => e.isBoss);

const hasMod = (b: EnemyDef, key: string): boolean => key in (b.mods ?? {});

/** 每个家族"让人记住"的那点什么 —— 至少有一条要在成员身上成立 */
const SIGNATURES: Record<BossArchetype, { why: string; ok: (b: EnemyDef) => boolean }> = {
  berserk: {
    why: "越打越狠:高攻、暴击,或一发高倍率技能",
    ok: (b) =>
      ["damageBonus", "critRate", "critDamage", "armorPen"].some((k) => hasMod(b, k)) ||
      b.atkMult >= 1.3 ||
      (b.skills ?? []).some((s) => s.mult >= 2.0),
  },
  counter: { why: "反手还击", ok: (b) => hasMod(b, "counterRate") || hasMod(b, "counterDamage") },
  spellbane: { why: "硬吃法术:减伤", ok: (b) => hasMod(b, "damageReduction") },
  truedmg: { why: "穿透真伤", ok: (b) => (b.skills ?? []).some((s) => s.effect === "pierce") },
  attrition: {
    why: "跟你耗:每回合回血或吸血",
    ok: (b) => hasMod(b, "regenPerRound") || hasMod(b, "lifesteal"),
  },
  threshold: {
    why: "开场一道门:护盾或减伤",
    ok: (b) => hasMod(b, "shieldOnStart") || hasMod(b, "damageReduction"),
  },
  antiheal: { why: "越打你越回不上来", ok: (b) => hasMod(b, "lifesteal") },
  evasive: { why: "打不中", ok: (b) => hasMod(b, "dodgeRate") },
};

describe("Boss 家族标签 · 覆盖与自洽", () => {
  it("每个首领都有家族,非首领一个都不带", () => {
    const missing = BOSSES.filter((b) => !b.archetype).map((b) => b.id);
    expect(missing, "首领没有家族标签:玩家看到的是空标签").toEqual([]);
    const strays = ENEMIES.filter((e) => !e.isBoss && e.archetype).map((e) => e.id);
    expect(strays, "非首领不该带家族标签").toEqual([]);
  });

  it("八个家族都有人,没有空家族", () => {
    const used = new Set(BOSSES.map((b) => b.archetype));
    const empty = (Object.keys(ARCHETYPES) as BossArchetype[]).filter((k) => !used.has(k));
    expect(empty, "家族表里有没人用的家族 —— 标签体系出现了死位").toEqual([]);
  });

  it("标签不是空话:每个首领身上都能找到本家族的签名机制", () => {
    const lies = BOSSES.filter((b) => !SIGNATURES[b.archetype!].ok(b)).map(
      (b) =>
        `${b.id}(${b.archetype}/${ARCHETYPES[b.archetype!].name}):` +
        `身上找不到「${SIGNATURES[b.archetype!].why}」`,
    );
    expect(lies, "标签与机制对不上 —— 改标签或补机制,别让玩家去猜").toEqual([]);
  });

  it("判据自证:把神帝改回「门槛型」,签名判据当场红", () => {
    // 这一条正是本轮实测到的错标(tier 29 的神帝没有护盾,却挂着 threshold)
    const godEmperor = BOSSES.find((b) => b.id === "e_god_emperor")!;
    const flipped: EnemyDef = { ...godEmperor, archetype: "threshold" };
    expect(SIGNATURES.threshold.ok(flipped), "自证没抓住错标:判据放空了").toBe(false);
    expect(SIGNATURES.truedmg.ok(godEmperor), "神帝的真伤穿透没被认出来").toBe(true);
  });
});
