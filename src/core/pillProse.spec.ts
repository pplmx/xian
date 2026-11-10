/**
 * 丹药文案不许写成药品说明书。
 *
 * ## 缺口(第 96 轮实测)
 *
 * 75 味丹药里,有 **13 味**的描述以「服之」开头:
 *
 * ```text
 *   聚气丹   服之灵气涌动,修为小进
 *   金刚液   服之肉身坚若金刚
 *   悟道丹   服之如聆道音
 *   永昌丹   服之添寿,岁月于我何有
 *   仙力丹   服之仙力贯体,出手重若崩山
 * ```
 *
 * 十三条全是「服之 + 效果」的句式 —— 不是写错,是**套路**。
 * 而同一张表里其他丹药明显写得有画面:
 *
 * ```text
 *   回灵丹     枯竭时的一口活水
 *   玄胎丹     玄胎暗结,未生先养 —— 养的是下一世的自己
 *   聚气散     最粗浅的灵药,聊胜于无
 * ```
 *
 * 十三味占全表 17%,玩家翻丹方录时每六味就撞见一条「服之……」。
 * 已全部重写,与其余 62 味同水准。
 *
 * ## 判据
 *
 * ① 「服之」开头的描述不许超过 1 条 —— 留一条是文风,十几条是模板;
 * ② 任何句式的开头两字都不许超过总数的 1/6 —— 防下一个套路;
 * ③ 反空转:描述都不为空、长度合理。
 *
 * 为什么是 1 而不是 0:文言里「服之」本身没错,偶尔一条是文风的一部分。
 * 错的是十三味都用它。
 */
import { describe, expect, it } from "vite-plus/test";
import { PILLS } from "@/data/pills";

describe("丹药文案 · 别写成药品说明书", () => {
  it("① 「服之」开头的描述不超过 1 条", () => {
    const hits = PILLS.filter((p) => p.desc.startsWith("服之")).map((p) => `${p.name}(${p.desc})`);
    expect(
      hits.length,
      `有 ${hits.length} 味药都用「服之」起头 —— 那是模板,不是文风:` + hits.slice(0, 6).join("、"),
    ).toBeLessThanOrEqual(1);
  });

  it("② 没有哪种开头两字占到总数的六分之一以上", () => {
    /*
     * 这条防的是**下一个**套路。重写时很容易把十三条「服之」换成十三条别的同样句式
     * (比如全改成「一口下去……」),那样只是换了个模板。
     */
    const counts = new Map<string, string[]>();
    for (const p of PILLS) {
      const key = p.desc.slice(0, 2);
      const list = counts.get(key) ?? [];
      list.push(p.name);
      counts.set(key, list);
    }
    const limit = Math.floor(PILLS.length / 6);
    const over = [...counts.entries()]
      .filter(([, names]) => names.length > limit)
      .map(([key, names]) => `「${key}」×${names.length}(${names.slice(0, 3).join("、")}…)`);
    expect(
      over,
      `这些开头用得太多(上限 ${limit} 条)—— 换个模板也算套路:` + over.join("、"),
    ).toEqual([]);
  });

  it("③ 反空转:描述非空、长度合理、名字唯一", () => {
    expect(PILLS.length, "丹药表空了").toBeGreaterThan(50);
    const bad: string[] = [];
    for (const p of PILLS) {
      if (!p.desc.trim()) bad.push(`${p.name} 没有描述`);
      if (p.desc.length < 4) bad.push(`${p.name} 的描述太短:「${p.desc}」`);
      if (p.desc.length > 60) bad.push(`${p.name} 的描述过长(${p.desc.length} 字)`);
    }
    expect(bad, bad.join("、")).toEqual([]);
    const names = PILLS.map((p) => p.name);
    expect(new Set(names).size, "丹药重名").toBe(names.length);
  });

  it("记录:重写完的十三条(看得出改了什么)", () => {
    /*
     * 这条不是判据,是**存档**。它把重写前后对照钉在这里,
     * 下一个人读到时能直接看出「说明书式」与「有画面」的差距在哪,
     * 而不必去翻 git 历史。
     *
     * 若这些文案以后又被改,这条会红 —— 那时请把新文案贴进来,
     * 而不是删掉这条。
     */
    const BEFORE = [
      "服之灵气涌动,修为小进",
      "服之肉身坚若金刚",
      "服之如聆道音",
      "服之鸿运当头,气运喷薄如沸",
      "服之罡气环身,盾出伤随",
      "服之如御星驰,一息千里",
      "服之乘风御虚,长空无碍",
      "服之心念澄澈,出手如神;炼丹时心有所得",
      "服之凝神定心;纵是炸炉,手法也不乱",
      "服之道韵加身",
      "服之添寿,岁月于我何有",
      "服之仙力贯体,出手重若崩山",
      "服之神魂安泰,气息绵长;凝神观炉,开炉多",
    ];
    const stillThere = PILLS.filter((p) => BEFORE.includes(p.desc)).map((p) => p.name);
    expect(stillThere, "这十三条旧文案又回来了:" + stillThere.join("、")).toEqual([]);
  });
});
