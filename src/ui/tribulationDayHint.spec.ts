/**
 * 「劫随天时变」—— 这是渡劫前最该被知道、却一直没人说的一件事。
 *
 * ## 起因
 *
 * `rollTribulation` 的注释与 `data/tribulations` 的文件头都写着:
 *
 * > 每次大境界天劫在突破前派生一个"劫型"(确定性:**境界 + 今日天时**作种子)
 *
 * 也就是说「今天渡劫撞雷鸣、换一天可能撞别样」**是实现里就有的机制**。
 * 而界面上从来没有一处说出这件事:
 *
 * ```text
 *   破境卡      「此劫 · 雷鸣劫 · 劫势 可渡」
 *                ↑ 只报**今天**会撞什么,不说"这个答案每天会变"
 *   渡劫面板    「今日天时 · 凝霜」—— 只报天时本身,不报它与劫型的关系
 * ```
 *
 * 于是玩家读到的是「我面对的是雷鸣劫」,而不是「**我在哪一天渡劫**决定了撞什么」。
 * 前者是命运,后者是决策 —— 而本作所有别的决策点都在摊数字(见 AGENTS.md 的
 * 「决策信息完整」)。这一处是漏的。
 *
 * ## 这条判据守什么
 *
 * 它不钉文案措辞,只钉**这件事有没有出口**:
 *
 * 一 纯函数 `tribulationDayHint` 能报出「今天是什么劫、换天时会变成什么」;
 * 二 它报的**必须是从同一份派生里来的**(调 `tribulationKindFor`,不另写公式)——
 *    否则界面上的"换个日子会撞 X"就是第二本账,而那种账本作栽过很多次;
 * 三 破境卡上真的渲染了这一行(源码锚点),不是只有函数没人调。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tribulationDayHint } from "./heavenInsightPreview";
import { tribulationKindFor } from "@/core/tribulationDecision";
import { WEATHERS, WORLD_WEATHERS } from "@/core/weather";
import { tribulationDef } from "@/data/tribulations";

const ROOT = resolve(__dirname, "../..");

describe("劫随天时变 · 那一行说得出「换一天会怎样」", () => {
  it("报得出今天是什么劫、未来的日子还有哪几种", () => {
    /*
     * 「未来几天」由调用方给（界面有 `upcomingWeather`）—— 这一层只负责
     * 把「今天这种 → 以后那几种」翻译成一句人话。不读 store,故可纯测。
     *
     * 注意 `upcoming` 是**去重后**的（见下一条）:三天里若两天撞同一个劫型,
     * 就只列一次。故这里不断言长度等于天数,只断言每一格都指向真实劫型。
     */
    const hint = tribulationDayHint(3, "lingyu", ["leiming", "chiyang", "qinghe"]);
    expect(hint, "拿不到「换天时会怎样」的读数").toBeTruthy();
    expect(hint!.today).toBe(tribulationDef(tribulationKindFor(3, "lingyu")).name);
    expect(hint!.upcoming.length, "未来几天的劫型没报出来").toBeGreaterThan(0);
    expect(hint!.upcoming.length, "去重之后不可能多于天数").toBeLessThanOrEqual(3);
    for (const u of hint!.upcoming) {
      expect(u.kind, "报了一个不存在的劫型").toBeTruthy();
      expect(u.name, "劫型没有名字").toBeTruthy();
    }
    // 今天那一劫不该在「以后还会有」里重复出现 —— 它是"还有哪几种**别的**"
    expect(hint!.upcoming.map((u) => u.kind)).not.toContain(tribulationKindFor(3, "lingyu"));
  });

  it("未来几天里出现的劫型,与届时真会撞的是同一条 —— 不做两本账", () => {
    /*
     * 这是整件事的地基,与 `heavenInsightPreview.spec` 的「预览 === 结算」同一条纪律:
     * 界面上写「换个日子会撞 X」,那一天真去渡劫就必须是 X。
     * 故这一层**必须**走 `tribulationKindFor`,不许自己再算一次。
     */
    const future = ["leiming", "yueshi", "gangfeng"] as const;
    const hint = tribulationDayHint(5, "lingyu", [...future])!;
    for (const [i, wid] of future.entries()) {
      expect(hint.upcoming[i]!.kind, `第 ${i + 1} 天报的劫型与真派生不一致`).toBe(
        tribulationKindFor(5, wid),
      );
    }
  });

  it("今天之后每一种劫型只列一次 —— 同一件事不说三遍", () => {
    /*
     * 5 种劫型对 9 条天时,未来三天里常常有两天撞同一个劫型。
     * 逐天列会把「雷鸣 / 雷鸣 / 铁躯」摊出来 —— 那不是信息,是噪音。
     * 按出现顺序去重:玩家要的是「还有哪几种可能」,不是"第几天是什么"。
     */
    const hint = tribulationDayHint(0, "lingyu", [
      "leiming",
      "chiyang",
      "ningshuang",
      "tianshuang" as never,
    ]);
    // 上面最后一个 id 不对,但它只影响"那天取不到天时",不该抛错
    expect(hint).toBeTruthy();
    const kinds = hint!.upcoming.map((u) => u.kind);
    expect(new Set(kinds).size, "同一种劫型被列了多遍").toBe(kinds.length);
  });

  it("没有未来几天（或到顶）时给 null,不编一行空话", () => {
    expect(tribulationDayHint(3, "lingyu", [])).toBeNull();
    expect(tribulationDayHint(Number.NaN, "lingyu", ["leiming"])).toBeNull();
  });

  it("破境卡真的把这一行渲染出来了 —— 不是只有函数没人调", () => {
    /*
     * 与 `mechanismVisibility.spec` 同一条纪律:该露的机制必须在**某个界面**上
     * 有一个玩家可见的锚点。函数写得再对,没人调就等于没有。
     */
    const card = readFileSync(
      join(ROOT, "src/components/cultivation/BreakthroughCard.vue"),
      "utf8",
    );
    expect(card, "破境卡没有接「劫随天时变」这一行").toContain("tribulationDayHint");
  });

  it("天数池里的天时都认得出 —— 派生对全部 WeatherId 有定义", () => {
    // 这一条防"某条天时取不到定义就抛错"。派生对任意字符串都该给一个劫型。
    for (const w of [...WEATHERS, ...Object.values(WORLD_WEATHERS).flat()]) {
      expect(() => tribulationKindFor(4, w.id), `天时「${w.name}」派生抛错`).not.toThrow();
    }
  });
});
