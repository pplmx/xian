/**
 * 突破失败那一屏 —— 「伤势要先调息」得说清有多重、多久。
 *
 * ## 缺口:最该知道代价的一屏,只有一句定性的话
 *
 * 渡劫失败时,这一作做了三件事:取走准备加成、挂上「重伤」buff、扣一截修为。
 * 失败弹窗的 `nextStep` 把三件都报到了:
 *
 * ```text
 * 修为折损 10% · 伤势要先调息 · 下一次突破仍需重新准备
 * ```
 *
 * 三句都对,但**「伤势」这一句只有定性**。而它实际是:
 *
 * ```text
 * 重伤  150 秒  { cultivationSpeed: -0.5, attackPct: -0.2, defensePct: -0.2 }
 * ```
 *
 * 也就是说玩家接下来**两分半钟里修炼速度砍半、攻防各降两成** —— 而这一屏是全屏弹窗,
 * 正盖在修行页那些「静坐调息 / 聚气丹」按钮上面,玩家在这里看不到 buff 列表。
 *
 * ## 为什么这一处值得修
 *
 * `AGENTS.md` 的「决策信息完整」写着:
 *
 * > 给决策前把数字摊开(奖励、代价、把握、生效时长、成功率),不能只给定性形容词
 * > (「皆有裨益」「更容易」不算数)。
 *
 * 而这里是**已经付了代价之后**的第一屏 —— 玩家最需要知道自己损失了什么、要多久才回来。
 * 同一份纪律在别处都执行得很好(突破成功率摊了期望次数、渡劫面板摊了四项准备读数),
 * 唯独这一句停在形容词。
 *
 * ## 判据守什么
 *
 * 一条:失败弹窗的「下一步」里提到伤势时,要给出**时长或数值**,不能只说「要先调息」。
 *
 * 不规定措辞与排版 —— 只要求那一句不再是纯形容词。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

const CORE = "src/core/breakthrough.ts";

describe("突破失败 · 伤势要说清有多重", () => {
  it("「伤势」那一句要带数字", () => {
    const src = readSource(CORE)
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    /*
     * 找 push 进 parts 的那句伤势 —— 它必须含插值,不能是写死的形容词。
     * 现在的写法是 parts.push("伤势要先调息") —— 纯常量字符串,判据抓它。
     */
    // 那句可能写成单行,也可能被 format 折成多行 —— 取到闭合的括号为止
    const injuryPush = src.match(/parts\.push\([\s\S]{0,260}?伤势[\s\S]{0,240}?\)\s*;?/)?.[0] ?? "";
    expect(injuryPush, "定位不到「伤势」那一句 —— 判据会空转").not.toBe("");
    expect(injuryPush, `「${injuryPush}」只有定性 —— 玩家不知道自己接下来多久、慢多少`).toMatch(
      /\$\{/,
    );
  });

  it("伤势的时长与效果从数据取,不手抄", () => {
    // 只看代码:注释里为了讲清缘由会引用具体数值,那不是「手抄进文案」
    const src = readSource(CORE)
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    // 时长要引 INJURY_DURATION(或直接从 buff 定义取),不许写 150
    expect(src, "伤势时长要从常量取").toMatch(/INJURY_DURATION|injuryBuff|buffDef\(\s*["']injury/);
    expect(src, "不许在文案里手写 150").not.toMatch(/150\s*秒/);
  });

  it("反空转:三件事仍要各报一句", () => {
    const src = readSource(CORE)
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    // 修为折损、伤势、重新准备 —— 缺一个都是"玩家要自己回想刚才少了什么"
    expect(src, "修为折损仍要报").toContain("修为折损");
    expect(src, "重新准备仍要报").toContain("下一次突破仍需重新准备");
  });
});
