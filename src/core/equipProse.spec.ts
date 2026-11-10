/**
 * 装备文案 · 同一部位里不许成套用同一句式。
 *
 * ## 缺口(第 97 轮实测)
 *
 * 288 件装备,按部位分组后查「同一部位的文案是否成套」,发现四条腰带
 * 用了完全相同的句式:
 *
 * ```text
 *   幽潭带   带扣是一枚潭底石,凉意不散
 *   兵戈带   带扣是一枚旧箭镞
 *   残锋带   带扣是半截断剑的剑格
 *   星陨带   带扣是整块陨石磨的
 * ```
 *
 * 四条全是「带扣是 X」,而其余 28 条各不相同:
 *
 * ```text
 *   粗布腰带   寻常布带,束衣而已
 *   赤炎带     带身赤红,像刚从炉里取出来
 *   幽潮带     带面会自己渗出潮气
 * ```
 *
 * 已重写这四条。
 *
 * ## 探针做粗了两次
 *
 * 第一版查「同部位内前 3 字重复」,报了四组,但其中三组是**误报**:
 *
 * ```text
 *   腕甲上   魔渊腕甲「腕甲上刻着镇压的铭文」
 *            玉京腕甲「腕甲上錾着天兵的番号」
 *            罗天腕甲「腕甲上錾着周天星度」      ← 内容各不相同
 *
 *   履下无   天外履「履下无尘」 / 无极履「履下无路」 / 本源履「履下无路无尘」
 *                                                ← 这是**刻意的排比**
 *
 *   符上画   幻海符「画的是海市」/ 星陨符「画着一条下坠的星轨」
 *            神兵符「画着列阵的次序」            ← 内容各不相同
 * ```
 *
 * 第二版去掉部位词再比前 2 字,又报了 `妖庭×5` —— 而那是**同一区域的装备**
 * (妖庭甲 / 妖庭环 / 妖庭符),主题命名一致本来就是设计。
 *
 * ## 所以判据只用一种最不容易误伤的形态
 *
 * **同一部位内,不许有两条文案的「句式骨架」完全相同** ——
 * 骨架 = 把可替换的名词挖掉后剩下的部分。这里用一个保守的实现:
 * 取每条文案在**同一部位内**的「首 4 字 + 末 4 字」作为键。
 *
 * 只报**首尾都撞**的,不报只撞开头或只撞结尾的。这样:
 *
 * - 「腕甲上刻着…」与「腕甲上錾着…」:首 4 字同为「腕甲上刻」? 不,「腕甲上錾」不同 → 不报 ✓
 * - 「带扣是一枚潭底石」与「带扣是一枚旧箭镞」:首 4 字「带扣是一」+ 末 4 字…不同 → 仍可能漏
 *
 * 保守判据会漏,但**不会误伤**。这比反过来好:误伤会逼人改掉本来好的文案。
 */
import { describe, expect, it } from "vite-plus/test";
import { EQUIPMENT_TEMPLATES } from "@/data/equipment";

/** 把一条文案压成「首 4 字 | 末 4 字」的骨架键 */
function skeleton(desc: string): string {
  const d = desc.trim();
  if (d.length <= 8) return d;
  return `${d.slice(0, 4)}|${d.slice(-4)}`;
}

describe("装备文案 · 同部位不许成套用同一句式", () => {
  it("同一部位内,没有两条文案的首尾骨架完全相同", () => {
    const bySlot = new Map<string, typeof EQUIPMENT_TEMPLATES>();
    for (const t of EQUIPMENT_TEMPLATES) {
      const list = bySlot.get(t.slot) ?? [];
      list.push(t);
      bySlot.set(t.slot, list);
    }

    const dupes: string[] = [];
    for (const [slot, list] of bySlot) {
      const groups = new Map<string, string[]>();
      for (const t of list) {
        if (!t.desc) continue;
        const key = skeleton(t.desc);
        const g = groups.get(key) ?? [];
        g.push(t.name);
        groups.set(key, g);
      }
      for (const [key, names] of groups) {
        if (names.length >= 2) dupes.push(`${slot}「${key}」→ ${names.join("、")}`);
      }
    }
    expect(
      dupes,
      "同一部位里有文案成套用同一句式 —— 玩家连看几件就会发现是个模板:" + dupes.join(" / "),
    ).toEqual([]);
  });

  it("记录:重写完的四条腰带(看得出改了什么)", () => {
    /*
     * 与 `pillProse.spec` 里那条同性质 —— 不是判据,是存档。
     * 把重写前的原文钉住,它们若回来就红;下一个人读到时能直接看出差距。
     */
    const BEFORE = [
      "带扣是一枚潭底石,凉意不散",
      "带扣是一枚旧箭镞",
      "带扣是半截断剑的剑格",
      "带扣是整块陨石磨的",
    ];
    const still = EQUIPMENT_TEMPLATES.filter((t) => BEFORE.includes(t.desc ?? "")).map(
      (t) => t.name,
    );
    expect(still, "这四条旧文案又回来了:" + still.join("、")).toEqual([]);
  });

  it("反空转:装备表规模正常,文案非空", () => {
    expect(EQUIPMENT_TEMPLATES.length, "装备表空了").toBeGreaterThan(200);
    const empty = EQUIPMENT_TEMPLATES.filter((t) => !t.desc || !t.desc.trim()).map((t) => t.name);
    expect(empty, "这些装备没有描述:" + empty.slice(0, 5).join("、")).toEqual([]);
    // 部位分组不该塌成一组
    const slots = new Set(EQUIPMENT_TEMPLATES.map((t) => t.slot));
    expect(slots.size, "部位只有一种 —— 分组的判据失去意义").toBeGreaterThanOrEqual(6);
  });

  it("同一部位内,前 6 字完全相同的两条也不许有", () => {
    /*
     * 上一条要求「首尾都撞」才报,对「开头一样但结尾不同」是放行的 ——
     * 那是为了不误伤「腕甲上刻着…」/「腕甲上錾着…」这类**内容确实不同**的写法。
     *
     * 这一条换个角度补:前 **6** 字相同,基本可以断定是同一条句式骨架
     * (6 个字足够装下「带扣是一枚」这样的完整起句,而「腕甲上刻」只有 4 字)。
     *
     * 第一版写的是「某 3 字开头超过该部位三成」—— 那个阈值的实测上限是 11/32,
     * 而最集中的部位也只有 2 次,**判据永远绿、什么也守不住**。已换成这条。
     */
    const bySlot = new Map<string, typeof EQUIPMENT_TEMPLATES>();
    for (const t of EQUIPMENT_TEMPLATES) {
      const list = bySlot.get(t.slot) ?? [];
      list.push(t);
      bySlot.set(t.slot, list);
    }
    const collisions: string[] = [];
    for (const [slot, list] of bySlot) {
      const groups = new Map<string, string[]>();
      for (const t of list) {
        const d = (t.desc ?? "").trim();
        if (d.length < 6) continue;
        const k = d.slice(0, 6);
        const g = groups.get(k) ?? [];
        g.push(t.name);
        groups.set(k, g);
      }
      for (const [k, names] of groups) {
        if (names.length >= 2) collisions.push(`${slot}「${k}…」→ ${names.join("、")}`);
      }
    }
    expect(
      collisions,
      "同一部位里有文案前 6 字完全相同 —— 前 6 字足够装下一条完整起句,那是同一个模板:" +
        collisions.join(" / "),
    ).toEqual([]);
  });
});
