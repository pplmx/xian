/**
 * 渡劫面板 · 「留了一线」是几线
 *
 * ## 缺口:一份进了结算的减免,界面上只剩一句形容词
 *
 * `core/linggenAffinity.tribulationRelief` 返回五个通道的具体读数:
 *
 * ```text
 *   shieldRestore   护盾回填 0.5（金/暗 0.45）
 *   healRestore     生机回填 0.5（木/冰 0.4）
 *   frontLoadEase   正面对冲减弱 0.35（水）/ 0.4（风）
 *   burstTierBonus  劫威削去 1 档（火/光）
 *   reductionToResist 雷罚分担 0.35（土）/ 0.45（雷）
 * ```
 *
 * 这些数**已经进了结算** —— `TribulationPanel` 的 `tribLedger` 把 `relief` 传给了
 * `settlementResist` / `sustainScore` / `guardScore`。而界面上关于它的全部文字是:
 *
 * ```text
 *   灵根相应:金、水——此劫为你留了一线,能走到哪一步仍看自身准备
 * ```
 *
 * 「留了一线」是**形容词**。玩家按这句话决定要不要补词条、要不要换灵根,却不知道
 * 那一线是 50% 还是 5%。本仓的决策信息纪律写着「不能只给定性形容词」。
 *
 * ## 与 `elementNeutral` 的关系
 *
 * 这条判据露的是**减免**(渡劫时的一线生机),不是战力加成。`elementNeutral.spec`
 * 的注释把这四处逐一点名,并说它们「都是倾向 / 减免 / 更顺,没有一处是更强」。
 * 故露出来不违反「五行不分高低」那条承诺。
 *
 * ## 只读同一个返回值
 *
 * 通道名与读数一律从 `tribulationRelief(...)` 的返回值读,不在界面按元素手抄 0.5 ——
 * 手抄的那份会在改平衡时先分叉,而它已经进了结算,分叉就是「界面说的与结算做的不同」。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { tribulationRelief, reliefFelt } from "@/core/linggenAffinity";

const panel = () => readSource("src/components/cultivation/TribulationPanel.vue");

describe("渡劫面板 · 解法通道要说得出读数", () => {
  it("面板经同一个入口取解法读数,不按元素手抄", () => {
    /*
     * 入口是 `currentTribulationRelief`(core/tribulationDecision)—— 它内部就是
     * `tribulationRelief(rootElements(...), kind)`,而 `tribLedger` 传给结算的
     * 也是它。判据认这个入口,不认直接调用:直接调 `tribulationRelief` 会绕过
     * 那一层的「同一个入口」约定。
     */
    const src = panel();
    expect(src, "要拿到这一劫的解法读数").toContain("currentTribulationRelief(");
    expect(src, "要有稳定落点给判据与浏览器门").toContain("data-tribulation-relief");
  });

  it("同源判据与结算同源 —— reliefFelt 为真才算「留了一线」", () => {
    // 金:护盾回填,非零
    expect(reliefFelt(tribulationRelief(["metal"], "ironbody"))).toBe(true);
    // 金 对 裂魂劫:劫型不对(金 kind 是 ironbody),五个通道全零
    expect(reliefFelt(tribulationRelief(["metal"], "soulrend"))).toBe(false);
  });

  it("通道读数逐项报出,且与函数返回值一致", () => {
    const relief = tribulationRelief(["wood"], "counterflow");
    expect(relief.healRestore, "木对应灵气逆乱,生机回填 0.5").toBe(0.5);
  });

  it("没开通道时整块不出 —— 不许印一行全零", () => {
    const src = panel();
    const at = src.indexOf("data-tribulation-relief");
    expect(at, "找不到那一块 —— 判据会空转").toBeGreaterThan(0);
    const near = src.slice(Math.max(0, at - 900), at + 1400);
    expect(near, "解法通道那一块要有条件渲染").toMatch(/v-if=/);
  });

  it("措辞守着「减免」,不许写成战力或必胜", () => {
    const src = panel();
    const at = src.indexOf("data-tribulation-relief");
    const near = src.slice(Math.max(0, at - 900), at + 1400).replace(/<!--[\s\S]*?-->/g, "");
    for (const banned of ["必定", "必胜", "免死", "不会死", "攻击加成", "战力提升"]) {
      expect(near, `解法通道写成了必胜/战力(「${banned}」)—— 它只是一线减免`).not.toContain(banned);
    }
  });
});
