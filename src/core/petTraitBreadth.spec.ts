/**
 * 灵兽性格：四种太少，四十只灵兽只分成四堆。
 *
 * ## 现状：40 只灵兽、4 种性格
 *
 * `data/pets` 的 40 只灵兽摊在四种性格上（慢稳 14 · 好战 10 · 贪宝 8 · 谨慎 8），
 * 平均每种十只。而性格系统存在的理由写在 `core/petPersonality` 开头:
 *
 *   > 灵兽不只是数值加成:性格决定历练时的行为倾向。
 *   > 玩家选伙伴 = 选路线风格,而非单纯"哪个数值高"。
 *
 * 十只灵兽共用一种走法时,「选伙伴 = 选走法」就退化成「先看数值,再看凑不凑得上
 * 性格」—— 因为同类里挑哪只,走法一样。
 *
 * ## 加两种,不加新维度
 *
 * 四种性格各有四维系数(历练时长 / 危险度 / 掉落品质 / 护主免败),
 * 键名由本作定、引擎只负责叠加(见 packages/engine 的 companions)。
 *
 * 这次**只加两种性格,不新增维度**:新性格复用那四个键,取一组与现有四档错开的系数。
 * 加维度意味着引擎侧接口、判据、文案全要动,而这一步只需拓宽可选空间。
 *
 * | 性格 | 走法 |
 * | --- | --- |
 * | 疾行 | 快 —— 时长压到 0.88,代价是危险度略升 |
 * | 守拙 | 稳 —— 时长拉到 115,危险降得最多、护主也最高,但几乎不掉好东西 |
 *
 * ## 判据守什么
 *
 * 一 表的条数与 id 集合 = 声明的那六种(不许加了数据忘了类型);
 * 二 每种性格**至少有一只灵兽在用** —— 加了却不分配,等于界面上永远见不到;
 * 三 六种的系数两两不同 —— 两种性格若一模一样,那只是一种。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { PETS } from "@/data/pets";
import { PERSONALITY_NAMES, PET_TRAITS, personalityDesc } from "@/data/petTraits";

describe("灵兽性格 · 六种", () => {
  it("性格表正好六条,且与类型声明对得上", () => {
    expect(PET_TRAITS).toHaveLength(6);
    const ids = PET_TRAITS.map((t) => t.id).sort();
    expect(ids).toEqual(["cautious", "fierce", "greedy", "rapid", "steady", "wary"]);
  });

  it("每种都有名字与一句说明 —— 界面上要能读", () => {
    for (const trait of PET_TRAITS) {
      const name = PERSONALITY_NAMES[trait.id as keyof typeof PERSONALITY_NAMES];
      expect(name, `${trait.id} 缺名字`).toBeTruthy();
      expect(name.length, `${trait.id} 的名字要短(进得去一行)`).toBeLessThanOrEqual(4);
      const desc = personalityDesc(trait.id as never);
      expect(desc, `${trait.id} 缺说明`).toBeTruthy();
      expect(desc.length, `${trait.id} 的说明要够一句话`).toBeGreaterThan(4);
    }
  });

  it("每种性格都真的有灵兽在用 —— 加了不分配就等于没加", () => {
    const used = new Set(PETS.map((p) => p.personality));
    const unused = PET_TRAITS.map((t) => t.id).filter((id) => !used.has(id as never));
    expect(unused, `这些性格没有任何灵兽在用:${unused.join(" / ")}`).toEqual([]);
  });

  it("六种的系数两两不同 —— 两种性格一样,那只是一种", () => {
    const seen = new Map<string, string>();
    for (const trait of PET_TRAITS) {
      const key = JSON.stringify(trait.mods);
      const prev = seen.get(key);
      expect(prev, `${trait.id} 的系数与 ${prev} 完全相同`).toBeUndefined();
      seen.set(key, trait.id);
    }
  });

  it("types 里那份 PetPersonality 与表的 id 集合一致 —— 两处各写一份,不许漂", () => {
    // types 不许 import data,所以性格 id 在两处各有一份;只改一处会在这里红,
    // 而不是等到 data/pets 里那些新性格报「不可赋值」才发现
    const types = readSource("src/types/index.ts");
    const at = types.indexOf("export type PetPersonality =");
    expect(at, "types 里该有 PetPersonality").toBeGreaterThan(0);
    const line = types.slice(at, types.indexOf(";", at));
    const declared = [...line.matchAll(/"([a-z]+)"/g)].map((m) => m[1]!).sort();
    expect(declared, "types 与 data/petTraits 的性格 id 分家了").toEqual(
      PET_TRAITS.map((t) => t.id).sort(),
    );
  });

  it("危险度与掉落运气不许同时更优 —— 每种走法都要付点代价", () => {
    // 参照档:贪宝(危险 +5%、掉落 +0.06)是最"赌"的一种
    for (const trait of PET_TRAITS) {
      const danger = trait.mods.dangerMult ?? 0;
      const luck = trait.mods.dropLuck ?? 0;
      const bothBetter = danger < 1 && luck > 0.06;
      expect(bothBetter, `${trait.id} 既更安全又更能掉好东西 —— 那就没有取舍了`).toBe(false);
    }
  });
});
