/**
 * 宿慧阶的收益 —— 玩家看得见门槛，看不见换来什么
 *
 * ## 缺口（量出来的）
 *
 * 修仙录「宿慧阶梯」那一块的版式:
 *
 * ```text
 *   宿慧阶梯                          33 / 340
 *   熟知修仙界
 *   哪片林子里的东西会绕后,哪头妖物残血才发狂——你交过手,你记得。
 *   ▬▬▬▬▬▬░░░░░░░░░░░░░░░░░░
 *   尚差 307 宿慧入「熟知天界」
 * ```
 *
 * 而 `SamsaraStageDef` 有**五个收益字段**:
 *
 * ```text
 *   knownMaterialRank   睁眼即识的灵材阶位上限
 *   enemyInsight        战前看得见交手过敌人的机制
 *   heavenInsight       天劫与终局规则的细节提前可见
 *   themeFreeChoice     命题不再是抽三取一,而是全部已开的里挑
 *   keepOneGongfa       转世时可留一门功法层数不折半
 * ```
 *
 * 界面上**一个都没有显示**。（`knownMaterialRank` 在灵材那行顺带露了一句
 * 「睁眼即识 N 阶以下」,但那是「随身所知」的注脚,不是阶梯的说明;
 * 而 `heavenInsight` 更彻底:全仓没有任何产品代码读它 —— 写了但没接线。）
 *
 * 于是「尚差 307 宿慧入熟知天界」这句话只说了一半:差多少查得到,换来什么查不到。
 *
 * ## 补什么:阶梯下逐条列出这一阶的收益 + 下一阶的预告
 *
 * 三条口径:
 *
 *   · **报即将生效的,不报已过期的**。当前阶的收益已经在生效,列出来是给玩家
 *     确认「我现在有哪些」;但更要紧的是**下一阶** —— 那是他正在攒的东西。
 *     故两侧都报,各自标清是「此刻」还是「入阶后」。
 *   · **文案由字段现生**,不手写一张对照表。改 `SAMSARA_STAGES` 时界面跟着变,
 *     否则「改常数就撒谎」。
 *   · **`heavenInsight` 那句要说清它是什么**。玩家看到「天数可窥」不知道窥什么 ——
 *     它是「天劫与终局规则的细节提前可见」，而这两个词在别处(`TribulationPanel`
 *     的风险维度、终局规则的预览)都已有具体所指。
 *
 * ## 这一层只算，不读 store
 */
import { describe, expect, it } from "vite-plus/test";
import { stageBenefitLines } from "./stageBenefits";
import { SAMSARA_STAGES } from "@/data/samsara";

describe("宿慧阶的收益 · 纯函数", () => {
  it("首阶没有任何收益 —— 空数组，调用方整段不出", () => {
    const first = SAMSARA_STAGES[0]!;
    expect(stageBenefitLines(first)).toEqual([]);
  });

  it("每一阶报出的条数，等于它真正开着的字段数", () => {
    /*
     * 这是「不写第二本账」的机械形态:收益字段有几个是 true,就该报几条。
     * 若哪天给 `SamsaraStageDef` 加了第六个字段而忘了接上,
     * 这条会红 —— 但只在**有阶真开了它**时红,故下面还查了一遍全表。
     */
    for (const stage of SAMSARA_STAGES) {
      const flags = [
        stage.knownMaterialRank > 0,
        stage.enemyInsight,
        stage.heavenInsight,
        stage.themeFreeChoice,
        stage.keepOneGongfa,
      ].filter(Boolean).length;
      expect(stageBenefitLines(stage).length, `«${stage.name}» 的收益条数对不上`).toBe(flags);
    }
  });

  it("五个字段至少各被一阶开过 —— 否则那个字段是死机制", () => {
    /*
     * 这一条守的是**接线**,不只是文案:`heavenInsight` 此前全仓无人读,
     * 就是被这条口径抓出来的。若某字段从来没被任何一阶开过,它是死字段;
     * 若开了却没接进界面,这一层会把它报出来（因为条数会对上,但下面
     * 「都报得出来」那条会漏）。
     */
    expect(SAMSARA_STAGES.some((s) => s.knownMaterialRank > 0)).toBe(true);
    expect(SAMSARA_STAGES.some((s) => s.enemyInsight)).toBe(true);
    expect(SAMSARA_STAGES.some((s) => s.heavenInsight)).toBe(true);
    expect(SAMSARA_STAGES.some((s) => s.themeFreeChoice)).toBe(true);
    expect(SAMSARA_STAGES.some((s) => s.keepOneGongfa)).toBe(true);
  });

  it("每条都是能读懂的整句，不是字段名", () => {
    const top = SAMSARA_STAGES[SAMSARA_STAGES.length - 1]!;
    const lines = stageBenefitLines(top);
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      // 不许把 camelCase 字段名印给玩家
      expect(line, `把字段名印出来了:${line}`).not.toMatch(/[a-z]+[A-Z][a-zA-Z]*/);
      // 也不许漏出占位符
      expect(line).not.toMatch(/undefined|NaN|Infinity|\{\{/);
      expect(line.length, `太短了,读不出是什么:${line}`).toBeGreaterThan(6);
    }
  });

  it("灵材那一档报的是阶位数字，数字来自字段本身", () => {
    const heaven = SAMSARA_STAGES.find((s) => s.id === "st_heaven")!;
    const lines = stageBenefitLines(heaven);
    const material = lines.find((l) => l.includes("灵材"));
    expect(material, "该有一条讲灵材").toBeTruthy();
    expect(material!, "数字该来自 knownMaterialRank").toContain(String(heaven.knownMaterialRank));
  });

  it("天命可窥那句说清窥的是什么", () => {
    /*
     * 「天数可窥」四个字玩家看不懂 —— 得说清是天劫细节与终局规则。
     */
    const ancient = SAMSARA_STAGES.find((s) => s.id === "st_ancient")!;
    const line = stageBenefitLines(ancient).find((l) => l.includes("天劫"));
    expect(line, "该有一条讲天劫").toBeTruthy();
    expect(line!).toMatch(/天劫/);
    expect(line!).toMatch(/终局|规则/);
  });
});
