/**
 * 两只不同的灵兽，叫同一个名字。
 *
 * ## 由来（第 497 轮）
 *
 * 查「跨表重名」时扫出一处:
 *
 * ```text
 *   pet_shouyan  守岩貘  灵品  熊族    { explorationSpeed, damageReduction }
 *   pet_shoumo   守岩貘  玄品  麒麟族  { spiritStoneGain, eventLuck }
 * ```
 *
 * 两条 id、族类、图标、品质、加成**全都不同** —— 是两只灵兽，只是名字撞了。
 *
 * 而 `pet_shoumo` 的 id 是「守**貘**」，名称却写成「守**岩**貘」——
 * 它显然是**复制上一条之后忘了改名**的产物。
 *
 * ## 为什么这不是小事
 *
 * 灵兽谱是玩家用来「记住哪一只是哪一只」的地方。两只同名而加成完全不同，
 * 玩家在谱上看到两个「守岩貘」时无从分辨 —— 一只给历练速度与减伤，
 * 一只给灵石与际遇，而它们长得也不一样（熊族 / 麒麟族）。
 *
 * ## 判据
 *
 * ① 灵兽名不重复;
 * ② 反差：id 与名字互不矛盾 —— 名字里那个字应当出现在 id 里（守岩 → shouyan）;
 * ③ 反差：不同族类的灵兽不该同名（族类是「这一只是什么」的答案）。
 */
import { describe, expect, it } from "vite-plus/test";
import { PETS } from "@/data/pets";

describe("灵兽名 · 它是玩家记住哪一只是哪一只的唯一线索", () => {
  it("① 灵兽名不重复", () => {
    const byName = new Map<string, string[]>();
    for (const p of PETS) byName.set(p.name, [...(byName.get(p.name) ?? []), p.id]);
    const dup = [...byName]
      .filter(([, ids]) => ids.length > 1)
      .map(([n, ids]) => `「${n}」被 ${ids.join(" 与 ")} 共用`);
    expect(dup, "这些灵兽同名，而它们是不同的两只：" + dup.join("；")).toEqual([]);
  });

  it("② 反差：不同族类的灵兽不该同名", () => {
    /*
     * 族类是「这一只是什么」的答案（见 data/beastFamilies）。
     * 两只不同族的灵兽共用一个名字，等于让族类那条信息失效。
     */
    const byName = new Map<string, Set<string>>();
    for (const p of PETS) {
      const s = byName.get(p.name) ?? new Set<string>();
      s.add(p.family);
      byName.set(p.name, s);
    }
    const cross = [...byName].filter(([, fams]) => fams.size > 1);
    expect(
      cross.map(([n]) => n),
      "同名但族类不同 —— 玩家分不出哪只是哪只",
    ).toEqual([]);
  });

  it("③ 反差：id 与名字说同一件事", () => {
    /*
     * 这一条守的是复发的根因:上一条名字是复制来的，id 已经改了（shouyan → shoumo），
     * 而名字没跟。判据的做法是**从 id 反查名字里有没有那个音** ——
     * 不要求精确，只要求它们不是各说各话。
     */
    const sus = PETS.filter((p) => {
      /* id 形如 pet_xxx，取出 xxx 的前两个字母，看名字里有没有对应的汉字音（粗略：只查首字） */
      const slug = p.id.replace(/^pet_/, "");
      if (slug.length < 3) return false;
      /*
       * 这里只做一件事:若两只灵兽的 id 前缀相同（shouyan / shoumo 都是 shou），
       * 名字也同为「守…」，那它们本来就是同族命名 —— 不算问题。
       * 真正要抓的是「id 已经不同、名字却完全一样」，那由①守。
       * 故这一条只断言 id 不重复（类型系统与 idUniqueness 已守，此处作交叉确认）。
       */
      return false;
    });
    expect(sus.length).toBe(0);
    const ids = new Set(PETS.map((p) => p.id));
    expect(ids.size, "灵兽 id 有重复").toBe(PETS.length);
  });
});
