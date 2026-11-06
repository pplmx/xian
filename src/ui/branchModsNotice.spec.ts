/**
 * 悟道择一 —— 一次不可逆的选择,只说选了什么,不说它给了什么。
 *
 * ## 复现
 *
 * 功法修满之后要在几条道里择一。选中之后,提示写的是:
 *
 * ```text
 * 已悟道「杀伐」
 * ```
 *
 * 而 `data/gongfaBranches` 里每条道都有话:
 *
 * ```ts
 * { name: "杀伐", desc: "太玄入杀道,攻伐更烈", mods: { attackPct: 0.10, damageBonus: 0.05 } }
 * ```
 *
 * ## 为什么这一处值得修
 *
 * 悟道是**一次性且不可逆**的:满级之后各择一条,择过就定了(转世才另算)。
 * 玩家在这一刻最想知道的是「我选了它,它给了我什么」—— 而这正是提示里唯一没说的。
 *
 * 这一作在别处都把加成摊得很开:装备词条逐条列、buff 有「现效合计」、丹药有「服之 X」,
 * 连称号的报喜都在上一轮补齐了加成。悟道是同一类东西,而且代价更重(不可逆)。
 *
 * 顺带:`desc` 那句话本来就是为这一刻写的 —— 「太玄入杀道,攻伐更烈」讲的正是这条道的
 * 取向,在功法和悟道弹窗里已经显示过一次,但在**定下来的那一秒**没有再说。
 *
 * ## 判据守什么
 *
 * 一条:悟道的报喜要带上它的效果,且文案走 `modsText`(与装备/称号/buff 同一口径)。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

const DIALOG = "src/components/cultivation/GongfaDialog.vue";

describe("悟道择一 · 要说清它给了什么", () => {
  it("悟道的报喜带上效果,且走 modsText", () => {
    const src = readSource(DIALOG)
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/\/\/.*$/gm, "");
    const at = src.indexOf("已悟道");
    expect(at, "定位不到「已悟道」 —— 判据会空转").toBeGreaterThan(-1);
    // 加成可能算在前面(走 modsText),故前后都取
    const around = src.slice(Math.max(0, at - 700), at + 300);
    expect(around, "「已悟道」只报名字 —— 悟道一次性且不可逆,玩家读不到它给了什么").toMatch(
      /modsText/,
    );
  });

  it("不手拼百分数 —— 加成文案只有一处口径", () => {
    const src = readSource(DIALOG)
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/\/\/.*$/gm, "");
    const at = src.indexOf("已悟道");
    const around = src.slice(Math.max(0, at - 400), at + 400);
    expect(around, "不许在报喜处手拼 ×100 的百分数").not.toMatch(/\*\s*100/);
  });

  it("反空转:仍要报出选中的是哪一条道", () => {
    const src = readSource(DIALOG);
    expect(src, "道名仍要报").toContain("已悟道");
    expect(src, "仍走 rare 档").toMatch(/已悟道[\s\S]{0,200}"rare"/);
  });
});
