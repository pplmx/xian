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
      chipsOf({
        isBoss: false,
        nemesis: "",
        traits: [],
        family: "",
        firstSight: false,
        avenged: "",
      }),
    ).toEqual([]);
  });

  it("每一枚章自报家门,不靠外面的顺序猜", async () => {
    const { chipsOf } = await import("@/ui/combatChips");
    const chips = chipsOf({
      isBoss: true,
      nemesis: "宿敌 · 已败三次",
      traits: ["tough"],
      family: "",
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
      family: "",
      firstSight: false,
      avenged: "旧仇已雪",
    });
    expect(onlyOne.length, "只有雪耻一句时,块仍要有内容(否则那句话无处可放)").toBe(1);
    expect(onlyOne[0]!.id).toBe("avenged");
  });

  it("空字符串的章不算内容 —— 不因为没有文案就占一行", async () => {
    const { chipsOf } = await import("@/ui/combatChips");
    expect(
      chipsOf({
        isBoss: false,
        nemesis: "  ",
        traits: [],
        family: "",
        firstSight: false,
        avenged: "",
      }),
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

/**
 * 族类章 —— 29 个族类各有一个词，而它此前从未上过界面。
 *
 * ## 由来（第 436 轮）
 *
 * `BEAST_FAMILIES` 里每个族类都有 `name`（注释：「族类在人话里的名字」）——
 * 而 **全仓没有一处读它**。敌人与灵兽的界面上只出现图标（`beastIcon`），
 * 玩家读不出「这一族叫什么」。
 *
 * 图标是抽象符号，名字才是可理解的概念。故补一个 `beastFamilyName()` 并接进
 * 这一块章 —— 放在这一块而不是另起一行，是因为这一块的条件与内容同源
 * （见 `combatChips.ts` 的文件头），另起一行会重新引入那个坑。
 *
 * ## 判据
 *
 * ① 族类章在「身份」那一侧（首领 / 宿敌之后、词条之前）—— 它属于「这是谁」；
 * ② 空串不占位；
 * ③ `beastFamilyName()` 对 29 个族类都给出非空的名字；
 * ④ 反差：`covers` 那个字段**不该**被拿来当族名 —— 它是给写数据的人看的归类说明。
 */
describe("族类章 · 29 个族名要上得了界面", () => {
  const base = {
    isBoss: false,
    nemesis: "",
    traits: [] as string[],
    family: "",
    firstSight: false,
    avenged: "",
  };

  it("① 族类章在身份那一侧：首领 → 宿敌 → 族类 → 词条", async () => {
    const { chipsOf } = await import("@/ui/combatChips");
    const ids = chipsOf({
      ...base,
      isBoss: true,
      nemesis: "宿敌 · 已败三次",
      family: "狼",
      traits: ["tough"],
    }).map((c) => c.id);
    expect(ids, "族类章的位置不对 —— 它是身份，不是这一场的词条").toEqual([
      "boss",
      "nemesis",
      "family",
      "trait:tough",
    ]);
  });

  it("② 空串不占位", async () => {
    const { chipsOf } = await import("@/ui/combatChips");
    expect(chipsOf({ ...base, family: "  " }), "空族名占了一枚章").toEqual([]);
  });

  it("③ beastFamilyName 对每个族类都给出非空的名字", async () => {
    const { BEAST_FAMILIES, beastFamilyName } = await import("@/data/beastFamilies");
    const families = Object.keys(BEAST_FAMILIES);
    expect(families.length, "族类太少 —— 判据量不到东西").toBeGreaterThanOrEqual(20);
    const empty: string[] = [];
    for (const f of families) {
      const name = beastFamilyName(f as never);
      if (!name.trim()) empty.push(f);
      /*
       * 而且它与 `covers` 不是同一句话 —— 后者是「狼;妖狼、火狼、霜狼一类」，
       * 那种带分号与顿号的长句不是给玩家看的族名。
       */
      expect(name, `族名「${name}」不该是同表里那句 covers`).not.toContain("；");
      expect(name, `族名「${name}」太长 —— 它是标签，不是说明`).not.toContain(";");
    }
    expect(empty, "这些族类没有名字:" + empty.join("、")).toEqual([]);
  });

  it("④ 反差：族名不许拿 covers 冒充", async () => {
    const { BEAST_FAMILIES, beastFamilyName } = await import("@/data/beastFamilies");
    const same: string[] = [];
    for (const [f, def] of Object.entries(BEAST_FAMILIES)) {
      if (beastFamilyName(f as never) === (def as { covers: string }).covers) same.push(f);
    }
    expect(
      same,
      "这些族类的名字直接用了 covers —— 那一个是给写数据的人看的归类说明，不是给玩家的词:" +
        same.join("、"),
    ).toEqual([]);
  });
});
