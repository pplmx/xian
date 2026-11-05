/**
 * 门庭四门存底 —— 那个 `/` 表示的是「目标水位」,不是「上限」。
 *
 * ## 复现:同一个符号,两种意思
 *
 * 门庭页的四门存底,一行写着:
 *
 * ```html
 * {{ row.stock }}<small>/{{ row.waterline }}</small>
 * ```
 *
 * 渲染出来是「灵草 **360/30**」。而 `waterline` 来自 `DISPATCH_NEED_TARGET` ——
 * 那是**派差的水位线**:「库存到这条线才算够」,是一个目标值,不是容量上限。
 *
 * 问题在于:这个游戏里 `/` 在其余**每一处**都读作「当前 / 上限」——
 *
 * ```text
 * Lv1/20          等级上限
 * 门庭 1/3 席     席位上限
 * 10/21 境        境界总数
 * 16/66           图鉴收集数
 * ```
 *
 * 于是「灵草 360/30」会被读成「有 360,而上限是 30」—— 一个**溢出到十倍**的
 * 危险信号,或者干脆读成算错了。而真相是「手里 360,派差的水位线是 30」,
 * 库存充足、没有任何问题。
 *
 * ## 为什么这一处值得修
 *
 * 四门存底是玩家**派差时看的那一屏**:派谁去哪一门,取决于哪一门缺料。
 * 而这一格是整个判断的读数来源。把「水位」读成「上限」,玩家会以为灵草爆仓、
 * 转而去派别的门 —— 决策直接歪掉。
 *
 * ## 判据守什么
 *
 * 一条:存底那一格不许用裸 `/` 连接库存与水位线 —— 必须把「水位」这个意思
 * 写出来(「水位 30」「目标 30」都行)。
 *
 * 不规定具体措辞,只要求它不再与全站的「当前/上限」形状撞车。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

const VIEW = "src/views/ApprenticeView.vue";

describe("门庭存底 · `/` 不许把「水位」冒充成「上限」", () => {
  it("存底那一格不用裸斜杠连接库存与水位线", () => {
    const src = readSource(VIEW).replace(/<!--[\s\S]*?-->/g, "");
    const cell = src.match(/apprentice-depot__value[\s\S]{0,400}/)?.[0] ?? "";
    expect(cell, "定位不到存底那一格 —— 判据会空转").not.toBe("");
    expect(
      cell,
      "库存与水位线之间用了裸 `/` —— 全站其余每一处 `/` 都读作「当前/上限」,这里会被读成溢出或算错",
    ).not.toMatch(/\{\{\s*row\.stock\s*\}\}\s*<small>\s*\//);
  });

  it("「水位」这个意思要写出来", () => {
    const src = readSource(VIEW).replace(/<!--[\s\S]*?-->/g, "");
    const cell = src.match(/apprentice-depot__value[\s\S]{0,400}/)?.[0] ?? "";
    expect(cell, "存底格要把 waterline 的语义说出来").toMatch(
      /水位|目标|够用|需\s*\{{\s*row\.waterline/,
    );
  });

  it("反空转:水位线的数值仍是 row.waterline,不手抄", () => {
    const src = readSource(VIEW).replace(/<!--[\s\S]*?-->/g, "");
    const cell = src.match(/apprentice-depot__value[\s\S]{0,400}/)?.[0] ?? "";
    expect(cell, "仍要读 row.waterline").toContain("row.waterline");
  });
});
