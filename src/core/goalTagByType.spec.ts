/**
 * 首页那一格标签，要按目标类型走。
 *
 * ## 由来（第 429 轮）
 *
 * 标签此前写死「当前道途」。而 `GoalType` 有八种 —— 前五种（突破 / 构筑 /
 * 推地界 / 采料 / 补装备）都还能读作「道途」，故一直没露馅。
 *
 * 第 428 轮补的三支让它露了：
 *
 * ```text
 *   立下此世的道途          写在「当前道途」下 —— 贴切（虽然它还没立）
 *   5 界已备道源            写在「当前道途」下 —— 完全不是道途，是远征
 *   今日天道与秘境尚可一探   写在「当前道途」下 —— 更远
 * ```
 *
 * 判据还查到一件事：**全仓没有一处读过 `goal.type`** —— 那个字段从被造出来
 * 起就只是类型标注。`HomeView` 这一处是它第一个消费者。
 *
 * ## 判据
 *
 * ① 那一格的标签是 `currentGoalTag`，不是写死的字面量；
 * ② 三支各有各的标签，且**互不相同** —— 三样性质不同的东西不该长得一样；
 * ③ 前五种仍写「当前道途」（它们确实是在说往哪条路上走）；
 * ④ 反差：标签表要覆盖全部 `GoalType` —— 将来加第九种时，这条会红。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { stripComments } from "@/test/stripComments";

const VUE = readFileSync(resolve(__dirname, "../views/HomeView.vue"), "utf-8");

/** 从 `currentGoalTag` 的 switch 里把 case 与返回值抽出来 */
function tagMap(): Map<string, string> {
  const at = VUE.indexOf("const currentGoalTag = computed(");
  expect(at, "找不到 currentGoalTag —— 判据要跟着改名").toBeGreaterThan(0);
  const end = VUE.indexOf("\n});", at);
  const body = VUE.slice(at, end);
  const out = new Map<string, string>();
  const re = /case "(\w+)":\s*(?:\/\/[^\n]*\n\s*)*return "([^"]+)";/g;
  for (const m of body.matchAll(re)) out.set(m[1]!, m[2]!);
  const dflt = /default:\s*(?:\/\/[^\n]*\n\s*)*return "([^"]+)";/.exec(body);
  if (dflt) out.set("__default", dflt[1]!);
  return out;
}

describe("首页 · 那一格标签按目标类型走", () => {
  it("标签读 currentGoalTag，不是写死的字面量", () => {
    /*
     * 要定位的是 **`data-home-goal` 那张卡**，不是首页上任意一个 `next-tag` ——
     * 初版直接找第一个 `home-deck__next-tag`，抓到的是「今日一步」那张（另一张卡），
     * 于是判据红在一个与它无关的地方。
     */
    const cardAt = VUE.indexOf("data-home-goal");
    expect(cardAt, "找不到 data-home-goal 那张卡").toBeGreaterThan(0);
    const tagAt = VUE.indexOf("home-deck__next-tag", cardAt);
    expect(tagAt, "那张卡里没有标签").toBeGreaterThan(0);
    const line = VUE.slice(tagAt, VUE.indexOf("\n", tagAt));
    expect(line, "标签还是写死的 —— 三样性质不同的目标会长得一样").toContain("currentGoalTag");
  });

  it("道途 / 远征 / 今日可做 三者互不相同", () => {
    const m = tagMap();
    const tags = ["path", "expedition", "endgame"].map((t) => m.get(t));
    for (const [i, t] of ["path", "expedition", "endgame"].entries()) {
      expect(tags[i], `${t} 没有自己的标签`).toBeDefined();
    }
    expect(
      new Set(tags).size,
      `三支的标签有重复:${tags.join(" / ")} —— 三样性质不同的东西不该长得一样`,
    ).toBe(3);
  });

  it("前五种仍写「当前道途」—— 它们确实在说往哪条路上走", () => {
    /*
     * 这五种走 `default`。若哪天有人给某一种单独写标签，这条会红 ——
     * 那时请把新的标签写进上一条的期望里，而不是让它悄悄变成第三种。
     */
    const m = tagMap();
    expect(m.get("__default"), "default 分支该是「当前道途」").toBe("当前道途");
  });

  it("反差：标签表要覆盖全部 GoalType —— 将来加第九种时会红", () => {
    /*
     * 从 `core/goal` 读 `GoalType` 的联合成员，逐个核对：
     * 要么在 switch 里有自己的 case，要么落进 default。
     *
     * 而 default 只该接「都是往哪条路上走」的那一批。故这条的实际口径是：
     * **凡不在 default 那一批里的，必须有 case。**
     */
    const goalSrc = stripComments(readFileSync(resolve(__dirname, "goal.ts"), "utf-8"));
    const at = goalSrc.indexOf("export type GoalType =");
    expect(at, "找不到 GoalType").toBeGreaterThan(0);
    const end = goalSrc.indexOf(";", at);
    const members = [...goalSrc.slice(at, end).matchAll(/"(\w+)"/g)].map((x) => x[1]!);
    expect(members.length, "GoalType 解析失败 —— 成员太少").toBeGreaterThanOrEqual(8);

    const m = tagMap();
    /*
     * 「落进 default 那一批」是显式登记的 —— 不是靠猜。
     * 加新类型时，改这里或加 case，两者都行；但**必须有人做一次决定**。
     */
    const FALLTHROUGH = new Set(["breakthrough", "equipment", "explore", "material", "build"]);
    const missing = members.filter((t) => !m.has(t) && !FALLTHROUGH.has(t));
    expect(
      missing,
      "这些 GoalType 既没有自己的标签、也不在「当前道途」那一批里 —— " +
        "加类型时要么给它写 case，要么显式登记进 FALLTHROUGH:" +
        missing.join(" / "),
    ).toEqual([]);
  });
});
