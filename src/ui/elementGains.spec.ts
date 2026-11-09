/**
 * 灵根牌面 · 把「亲近」说成数
 *
 * ## 缺口:一份写了数字的收益表,界面只念得出形容词
 *
 * `data/linggenAffinity` 的 `ELEMENT_AFFINITY` 表里每一项都有实打实的倍率:
 *
 * ```text
 *   gongfaWeight  2.2（特殊根 2.6）  —— 同源功法被参悟到的权重
 *   fortuneWeight 2.5（特殊根 2.8）  —— 同源机缘撞见的权重
 *   relief        护盾回填 0.5 / 生机回填 0.5 / 正面对冲减弱 0.35 …
 * ```
 *
 * 界面只说「草木功法亲近你」「你懂得以柔卸力」。那是**定性形容词**,而本仓的
 * 决策信息纪律写的是:「不能只给定性形容词（『皆有裨益』『更容易』不算数）」。
 *
 * 于是玩家读不出:亲近是 1.1 倍还是 3 倍?渡劫那一线到底能卸掉多少?
 * 这些数全都在数据表里现成,只是没有一处把它们念出来。
 *
 * ## 为什么可以露,而五行仍「不分高低」
 *
 * `core/elementNeutral.spec` 承诺的是**五行不进战力、不进属性合并** ——
 * 它禁的是「火系攻击 +5%」那类数值高低。而 `gongfaWeight` / `fortuneWeight`
 * 是**倾向**(更容易遇到,不是更强),`relief` 是**减免**(渡劫时的一线生机)。
 * `elementNeutral.spec` 的注释里已经把这四处逐一点名,并说它们「都是倾向 / 减免 /
 * 更顺,没有一处是更强」。故露出来不违反那条承诺 —— 恰恰是把它说清楚:
 * 两条权重倍的都写着「更容易遇到,不是只有你能遇到」。
 *
 * ## 只读表,不重算
 *
 * 倍率与减免一律从 `ELEMENT_AFFINITY` 现读,不在界面手抄一遍数字 ——
 * 手抄的那份在改平衡时会立刻变成谎话。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { ELEMENT_AFFINITY } from "@/data/linggenAffinity";
import { elementGains } from "./elementGains";

const view = () => readSource("src/views/CharacterView.vue");

describe("灵根牌面 · 每条倾向都说得出数", () => {
  it("给得出每一系的功法与机缘权重 —— 与数据表同源", () => {
    const rows = elementGains(["water"]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.element).toBe("water");
    expect(rows[0]!.gongfaWeight).toBe(ELEMENT_AFFINITY.water.gongfaWeight);
    expect(rows[0]!.fortuneWeight).toBe(ELEMENT_AFFINITY.water.fortuneWeight);
  });

  it("特殊根读它自己那一档(2.6 / 2.8),不套普根的 2.2 / 2.5", () => {
    const [thunder] = elementGains(["thunder"]);
    expect(thunder!.gongfaWeight).toBe(2.6);
    expect(thunder!.fortuneWeight).toBe(2.8);
  });

  it("渡劫那一线也报成一句人话 —— 护盾回填 / 生机回填 / 对冲减弱各说得出", () => {
    const [metal] = elementGains(["metal"]);
    expect(metal!.relief).not.toBeNull();
    expect(metal!.relief!.text, "金属的解法是护盾回填").toMatch(/护盾/);
    // 数值从表里现读,不写死
    expect(metal!.relief!.text).toContain(
      String(Math.round(ELEMENT_AFFINITY.metal.relief.shieldRestore! * 100)),
    );
  });

  it("没有解法通道时不编一句 —— relief 为 null", () => {
    /*
     * 眼下十一个元素都配了 relief,故「没有」这一档只能用一个**剥掉 relief 的**输入验 ——
     * 判据要守的是「表里没写时不许硬造一句」,而不是「现在恰好都有」。
     */
    const rows = elementGains(["light"]);
    expect(rows[0]!.relief, "表里有 relief,就该报出来").not.toBeNull();

    // 用一个空 ELEMENT_AFFINITY 覆写来验「没写时不编」
    const emptyTable = { ...ELEMENT_AFFINITY, light: { ...ELEMENT_AFFINITY.light, relief: {} } };
    const none = elementGains(["light"], emptyTable);
    expect(none[0]!.relief, "表里没写解法通道时不许硬造一句").toBeNull();
  });

  it("同一系重复(理论上不该有)只出一次 —— 按元素去重", () => {
    const rows = elementGains(["water", "water"]);
    expect(rows).toHaveLength(1);
  });

  it("认不得的元素 id 被剔掉,不印一行空白", () => {
    const rows = elementGains(["water", "bogus" as never]);
    expect(rows.map((r) => r.element)).toEqual(["water"]);
  });

  it("空灵根 → 空数组(界面据此整块不出)", () => {
    expect(elementGains([])).toEqual([]);
  });
});

describe("道躯页 · 把这份数接进灵根注", () => {
  it("灵根注读 elementGains,且给出稳定落点", () => {
    const src = view();
    expect(src, "人物页要读这份收益简报").toContain("elementGains(");
    expect(src, "要有稳定落点给判据与浏览器门").toContain("data-character-element-gains");
  });

  it("不手抄倍率 —— 数字从表里现读", () => {
    /*
     * 只扫**收益那一块**:全文件扫会把别处无关的数字(甚至我自己写的注释里
     * 「印成 ××2.2」这个反例)一起算进来 —— 判据的范围要贴着它守的东西。
     */
    const src = view();
    const at = src.indexOf("data-character-element-gains");
    expect(at, "找不到收益块 —— 判据会空转").toBeGreaterThan(0);
    const block = src.slice(at, at + 2400);
    // 去掉注释再扫:说明里写反例是正常的,模板表达式里不许出现字面倍率
    const code = block.replace(/<!--[\s\S]*?-->/g, "");
    expect(code, "不许把 2.2 / 2.5 这类字面倍率写进收益块").not.toMatch(
      /2\.2\b|2\.5\b|2\.6\b|2\.8\b/,
    );
    expect(code, "数字要走 multText(row.gongfaWeight) 之类的现读").toMatch(
      /multText\(row\.(gongfaWeight|fortuneWeight)\)/,
    );
  });

  it("仍守着「五行只定亲近之路」—— 收益那一格的措辞不许说成更强", () => {
    const src = view();
    const at = src.indexOf("data-character-element-gains");
    /*
     * **剥掉注释再查** —— 这一块的说明里正写着「不是『更强』」(那是在解释纪律),
     * 连同注释一起扫会把反例当成违规,判据就成了「谁把话说清楚谁红」。
     * 只查**渲染给玩家看的字**。
     */
    const near = src.slice(Math.max(0, at - 1200), at + 2400).replace(/<!--[\s\S]*?-->/g, "");
    for (const banned of ["更强", "战力提升", "伤害提高", "攻击加成"]) {
      expect(
        near,
        `收益写成了数值高低(「${banned}」)—— 与 elementNeutral 的承诺相悖`,
      ).not.toContain(banned);
    }
    expect(near, "要说清是「更容易遇到」而不是「更强」").toMatch(/更容易|权重|亲和/);
  });
});
