/**
 * 那一块章 —— 条件与内容是同一件事,不该各写一遍。
 *
 * ## 连续两轮踩同一个坑
 *
 * 第 42 轮给宿敌加「旧仇已雪」,挂进了 `.combat-combatant__chips` 那块。那块的条件是:
 *
 *   `v-if="battle && (battle.isBoss || isNemesisFoe || shownTraits.length)"`
 *
 * 而雪耻一过 `isNemesisFoe` 就是 false —— 挂进去永远显示不出来。探针量到
 * `chipsWrap` 为 0 才发现,移出块外才通。
 *
 * 第 43 轮加「初见」章,**又挂进了同一块**,又是同样的原因(寻常凶物三条都不满足)。
 *
 * ## 根因不是"忘了",是那个条件本身
 *
 * 那个 v-if 列的是**每一枚章的条件之或**。于是每加一枚章,都得记着回来把条件也改一遍 ——
 * 而漏改时没有任何东西会报错:组件照样编译、类型全对、单测全绿,只是屏幕上没有。
 *
 * 修法只有一条:**块的条件与内容由同一处决定**。也就是让那段 v-if 读一个
 * computed,而那个 computed 与块内各章的条件**用同一批 flag**。
 *
 * ## 这一轮做什么
 *
 * 把块内那几枚章的条件收进一个 `combatantChips`(纯函数、可测、返回该显示哪几枚),
 * 块的 v-if 与块内的 v-for 都读它。加一枚新章时只有一处要动,漏了会当场红。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

describe("章与条件 · 同一处决定", () => {
  it("面板不再自己罗列「哪几枚章的条件之或」", () => {
    const panel = readSource("src/components/adventure/CombatPanel.vue");
    /*
     * 那个 v-if 的字面形状就是病灶:一串 `||` 里混着三种互不相干的判断。
     * 改成一个 computed 之后,模板里不该再有这串。
     */
    expect(panel, "不该再手写那串条件之或").not.toMatch(
      /battle\.isBoss \|\| isNemesisFoe \|\| shownTraits\.length/,
    );
    expect(panel, "该读一个 computed").toContain("combatantChips");
  });
});

describe("章与条件 · 纯函数决定哪几枚", () => {
  it("什么都没有时返回空 —— 那时整块不渲染,不留一条空行", async () => {
    const { chipsOf } = await import("@/ui/combatChips");
    expect(
      chipsOf({ isBoss: false, nemesis: "", traits: [], firstSight: false, avenged: "" }),
    ).toEqual([]);
  });

  it("每一枚章自报家门,不靠外面的顺序猜", async () => {
    const { chipsOf } = await import("@/ui/combatChips");
    const chips = chipsOf({
      isBoss: true,
      nemesis: "宿敌 · 已败三次",
      traits: ["tough"],
      firstSight: true,
      avenged: "",
    });
    expect(chips.map((c) => c.id)).toEqual(["boss", "nemesis", "trait:tough", "firstSight"]);
  });

  it("加一枚新章时,条件跟着它走 —— 不会出现「有内容但不显示」", async () => {
    /*
     * 这是本轮真正要守住的那条:块显示与否由 `chipsOf(...)` 的**结果**决定。
     * 故「有没有内容」与「显不显示」在构造上不可能不一致。
     */
    const { chipsOf } = await import("@/ui/combatChips");
    const onlyOne = chipsOf({
      isBoss: false,
      nemesis: "",
      traits: [],
      firstSight: false,
      avenged: "旧仇已雪",
    });
    expect(onlyOne.length, "只有雪耻一句时,块仍要有内容(否则那句话无处可放)").toBe(1);
    expect(onlyOne[0]!.id).toBe("avenged");
  });

  it("空字符串的章不算内容 —— 不因为没有文案就占一行", async () => {
    const { chipsOf } = await import("@/ui/combatChips");
    expect(
      chipsOf({ isBoss: false, nemesis: "  ", traits: [], firstSight: false, avenged: "" }),
    ).toEqual([]);
  });
});

describe("章与条件 · 不碰结算", () => {
  it("只做选择,不 import store 或 core", () => {
    const src = readSource("src/ui/combatChips.ts")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(src).not.toMatch(/from ["']@\/stores\//);
    expect(src).not.toMatch(/from ["']@\/core\//);
  });
});
