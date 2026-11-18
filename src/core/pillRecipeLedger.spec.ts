/**
 * 丹方册的排法 —— 按境界排队,而不是一个平面。
 *
 * ## 缺口(这一轮)
 *
 * 开炉弹窗的方子清单此前是一个平面:现在料够的置顶,其余按丹方阶位从易到难
 * (见 `composables/useBrewing` 的行构造器末那个 `sort`)。那是「我今天能炼哪几炉」
 * 的排法,而玩家站在丹炉前问的是另一个问题:
 *
 * ```text
 *   我这境界该炼什么 / 下一境还差哪几张方子
 * ```
 *
 * 阶位与境界是两个轴。混在一个序列里之后,「炼气能炼的三张」与「混沌海才用得上
 * 的两张」隔着几十行 —— 实测 77 张可炼方里,境界 0 的 6 张与境界 20 的 2 张
 * 在同一个平面清单上,靠的是「料够不够」这个与境界无关的插队键。
 *
 * ## 判据守什么
 *
 * ① 分组依据是 `minRealm`,组按境界从低到高,不重不漏;
 * ② 组内已得在前,再按阶位从易到难;
 * ③ 默认展开玩家此刻那一境(不返回 null 指向空组);
 * ④ 全册的「已得 / 共几张」与 `lore.recipeMastery` 同一条判据 —— 掌握度 > 0 即得方;
 * ⑤ 无方之丹不进这一册(它炼不出来,进了就是一张永远点不动的行)。
 */
import { describe, expect, it } from "vite-plus/test";
import { PILLS } from "@/data/pills";
import { MAX_MAJOR, isWorldEntry } from "@/data/realms";
import { recipeCraft } from "@/data/crafting";
import { defaultOpenMajor, recipeLedger, type RecipeRealmGroup } from "./pillRecipeLedger";

const CRAFTABLE = PILLS.filter((p) => p.recipe !== undefined);

/** 一份「全部已得」的假掌握度 —— 只喂这一个参数,不碰 store */
const allKnown = (): number => 1;
/** 一份「一张都没得」的假掌握度 */
const noneKnown = (): number => 0;

function groupsOf(masteryOf: (id: string) => number): RecipeRealmGroup[] {
  return recipeLedger(masteryOf).groups;
}

describe("丹方册 · 按境界排队", () => {
  it("① 每一张可炼方都恰好落进它自己那一境,不重不漏", () => {
    const ledger = recipeLedger(allKnown);
    const placed = ledger.groups.flatMap((g) => g.entries.map((e) => e.def.id));
    expect(new Set(placed).size, "同一张方子被分进了两境").toBe(placed.length);
    expect(placed.sort(), "有可炼方没进册,或册里混进了无方之丹").toEqual(
      CRAFTABLE.map((p) => p.id).sort(),
    );
  });

  it("① 组按境界从低到高,且每组的方都是这一境的", () => {
    const groups = groupsOf(allKnown);
    const majors = groups.map((g) => g.major);
    expect(majors, "组序不是从低到高 —— 「下一境该炼什么」就无从读起").toEqual(
      [...majors].sort((a, b) => a - b),
    );
    for (const group of groups) {
      for (const entry of group.entries) {
        expect(entry.def.minRealm, `${entry.def.name} 落错了境`).toBe(group.major);
      }
    }
  });

  it("① 空境不出组 —— 册子只铺有方的那几境,章首不会出现在一片空白前面", () => {
    const groups = groupsOf(allKnown);
    expect(groups.length, "一个组都没有").toBeGreaterThan(0);
    expect(
      groups.every((g) => g.entries.length > 0),
      "有一个空组混进了册子 —— 章首会出现在一片空白前面",
    ).toBe(true);
    /*
     * 实测:21 境**每一境**都有可炼方(pillRealmGap 守着「人间界与仙界每境至少两味」),
     * 故今天不会出现空境。这一条仍要判,理由是内容会变:哪天真删空了某一境的方子,
     * 册子不该多出一章空白。组数 = 出现过的境界数,是这条口径的可判定形式。
     */
    const filled = new Set(CRAFTABLE.map((p) => p.minRealm));
    expect(groups.length, "组数与出现过的境界数对不上").toBe(filled.size);
  });

  it("② 组内已得在前,再按阶位从易到难", () => {
    // 一张隔一张地给掌握度:得上、得下,同组内必然既有已得也有未得
    const alternate = (id: string): number =>
      CRAFTABLE.findIndex((p) => p.id === id) % 2 === 0 ? 1 : 0;
    const ledger = recipeLedger(alternate);
    for (const group of ledger.groups) {
      const knownFlags = group.entries.map((e) => e.known);
      const firstUnknown = knownFlags.indexOf(false);
      if (firstUnknown >= 0) {
        expect(
          knownFlags.slice(firstUnknown).every((k) => !k),
          `${group.realmName}:未得的方插在了已得的中间 —— 头几行读不成动作`,
        ).toBe(true);
      }
      // 同一「已得 / 未得」段内,阶位不许回头
      const sortKey = (known: boolean): number[] =>
        group.entries.filter((e) => e.known === known).map((e) => e.rank);
      for (const key of [true, false]) {
        const ranks = sortKey(key);
        expect(ranks, `${group.realmName}:阶位没有从易到难排`).toEqual(
          [...ranks].sort((a, b) => a - b),
        );
      }
    }
  });

  it("② 阶位读的是 craftability 那一份(recipeCraft),不是界面自己数", () => {
    const ledger = recipeLedger(allKnown);
    for (const group of ledger.groups) {
      for (const entry of group.entries) {
        expect(entry.rank, `${entry.def.name} 的阶位与 recipeCraft 对不上`).toBe(
          recipeCraft(entry.def)!.rank,
        );
      }
    }
  });

  it("③ 默认展开玩家此刻那一境", () => {
    const groups = groupsOf(allKnown);
    const present = groups.map((g) => g.major);
    for (const major of present) {
      expect(defaultOpenMajor(groups, major), `境 ${major} 没有默认展开自己`).toBe(major);
    }
  });

  it("③ 册上缺了某一境时,退到下面最近的那一境,而不是留一个合着的空章", () => {
    /*
     * 今天的数据里 21 境都有可炼方,故这一支走不到 —— 它是**内容变动时的守卫**:
     * 若哪天某一境的方子被清空(或新增一境还没配内容),玩家停在那里时
     * 不能一个章都不展开。函数收 `groups` 这个参数,故这里直接给一份缺境的名录。
     */
    const sparse = groupsOf(allKnown).filter((g) => g.major === 2 || g.major === 7);
    expect(sparse.length, "取景失败:没有境界 2 与 7 的组").toBe(2);
    expect(defaultOpenMajor(sparse, 4), "缺境 4 时没退到境界 2").toBe(2);
    expect(defaultOpenMajor(sparse, 1), "玩家在最低组之前时应给最低那一组").toBe(2);
    expect(defaultOpenMajor(sparse, 20), "玩家在最末组之后时应给最高那一组").toBe(7);
  });

  it("③ 一册都没有方时默认展开返回 null,不指向一个不存在的组", () => {
    expect(defaultOpenMajor([], 5)).toBeNull();
    // 玩家在境界 0 而册上最低是境界 4:仍要给出最近的那一组,不能是 null
    const ledger = recipeLedger(allKnown);
    const groups = ledger.groups;
    const lowest = groups[0]!.major;
    expect(defaultOpenMajor(groups, -3), "边界境界被夹错了").toBe(lowest);
    expect(defaultOpenMajor(groups, MAX_MAJOR + 5), "越界境界被夹错了").toBe(
      groups[groups.length - 1]!.major,
    );
  });

  it("④ 全册计数与掌握度同一把尺:> 0 才算得方", () => {
    expect(recipeLedger(noneKnown).known, "一张都没得却报有").toBe(0);
    expect(recipeLedger(allKnown).known, "全得却报缺").toBe(CRAFTABLE.length);
    expect(recipeLedger(allKnown).total, "总册数不等于可炼方条数").toBe(CRAFTABLE.length);

    // 只给一张:计数与那一组都要跟着动
    const only = CRAFTABLE[0]!.id;
    const one = recipeLedger((id) => (id === only ? 1 : 0));
    expect(one.known).toBe(1);
    const group = one.groups.find((g) => g.entries.some((e) => e.def.id === only))!;
    expect(group.known).toBe(1);
    expect(group.total).toBeGreaterThan(1);
  });

  it("④ 掌握度恰好为 0 与极小正数分得开 —— 判据是 > 0,不是 >= 1", () => {
    // 藏经阁授下的新方掌握度是 0.15(见 loreService.NEW_RECIPE_START):
    // 若判成「通晓才算得」,刚翻出的方子会从册上消失
    const tiny = recipeLedger(() => 0.15);
    expect(tiny.known, "0.15 的掌握度没算作已得 —— 新翻出的方子会从册上消失").toBe(
      CRAFTABLE.length,
    );
    expect(recipeLedger(() => 0).known).toBe(0);
  });

  it("⑤ 无方之丹不进这一册,但册子报得出它们有几味", () => {
    const ledger = recipeLedger(allKnown);
    const ids = new Set(ledger.groups.flatMap((g) => g.entries.map((e) => e.def.id)));
    const noRecipe = PILLS.filter((p) => p.recipe === undefined);
    expect(noRecipe.length, "一味无方之丹都没有 —— 这条判据是空转的").toBeGreaterThan(0);
    for (const def of noRecipe) {
      expect(ids.has(def.id), `${def.name} 没有可炼方却进了丹方册`).toBe(false);
    }
    expect(ledger.noRecipe, "册子没报出无方之丹有几味").toBe(noRecipe.length);
  });

  it("册上每一章报得出的三个数与它的行对得上 —— 章首不另算一遍", () => {
    const ledger = recipeLedger(allKnown);
    for (const group of ledger.groups) {
      expect(group.total, `${group.realmName} 的总数与它的行数对不上`).toBe(group.entries.length);
      expect(group.known, `${group.realmName} 的已得数与行上的标记对不上`).toBe(
        group.entries.filter((e) => e.known).length,
      );
    }
    // 各章已得之和 = 全册已得;各章总数之和 = 全册总数
    expect(ledger.groups.reduce((n, g) => n + g.known, 0)).toBe(ledger.known);
    expect(ledger.groups.reduce((n, g) => n + g.total, 0)).toBe(ledger.total);
  });

  it("组首报得出界域,且只在跨界那一境报", () => {
    const groups = groupsOf(allKnown);
    for (const group of groups) {
      expect(group.worldName, `${group.realmName} 没报出所属界域`).not.toBe("");
      expect(group.realmName, `${group.realmName} 没报出境界名`).not.toBe("");
    }
    const worldFirsts = groups.filter((g) => g.worldFirst);
    expect(worldFirsts.length, "一册里没有一处界域起点 —— 界域名没处可说").toBeGreaterThan(0);
    // 界域起点必须真的是那一界的第一境 —— 与 data/realms 的 WORLDS 同源
    for (const group of groups) {
      expect(group.worldFirst, `${group.realmName} 的界域起点标记与 worldOf 对不上`).toBe(
        isWorldEntry(group.major),
      );
    }
  });

  it("反空转:组数少于可炼方条数 —— 否则「分组」只是个摆设", () => {
    const groups = groupsOf(allKnown);
    expect(groups.length, "每一张方各占一组,分组等于没分").toBeLessThan(CRAFTABLE.length);
    expect(groups.length, "只有一个组 —— 仍是个平面清单").toBeGreaterThan(1);
  });
});
