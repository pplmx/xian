/**
 * 称号的道历 —— 得它的那一刻,要写得出来。
 *
 * ## 问题:同一类事实,图鉴记了,称号没记
 *
 * 图鉴每一条都有「第 N 世 · M 岁」的收录读数(见 ui/codexMoment,第 7 轮补的)。
 * 而称号只有个 id 数组(`quests.titlesOwned`)—— 玩家有一排功名,却分不出
 * 哪个是刚才得的、哪个是上一世就挂在那里的。
 *
 * 这两件事是同一类事实:「何时得到它的」。一处记了,一处没记,不是设计,
 * 是那次只改了图鉴那一条路。
 *
 * ## 复用什么,不做什么
 *
 * `CodexMoment` 与 `codexMomentText` 直接复用 —— 道历的算法、旧档的诚实口径
 * (「早年收录」)、坏值的处理,全都已经在那一份里定过了。这里只做一件事:
 * **给称号也记一份**,并在界面上读出来。
 *
 * 不另写一套历法:那会与「第 N 世 + 年岁」变成两套并行的纪元(两本账)。
 *
 * ## 旧档怎么办
 *
 * 已经到手的称号没有这一对读数。照实说「早年收录」—— 与图鉴同一条口径,
 * 不补一个现实日期,也不假装是这一世得的。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { codexMomentText } from "./codexMoment";

describe("称号的道历 · 记下来", () => {
  it("授称号时同时记一份道历 —— 与图鉴同一个字段形状", () => {
    const src = readSource("src/stores/quests.ts");
    const ownAt = src.indexOf("function ownTitle(");
    expect(ownAt, "ownTitle 要还在").toBeGreaterThan(0);
    const block = src.slice(ownAt, src.indexOf("\n    function ", ownAt + 10));
    expect(block, "授称号时要记时刻").toContain("titleMoments");
    expect(block, "道历取自玩家自身,不另记一份钟").toContain("codexMomentOfPlayer(");
  });

  it("旧档里已到手的称号不会被编一个时刻", () => {
    const src = readSource("src/stores/quests.ts");
    // 修复/读档那一段只保留仍然合法的 id,不补造 moments
    expect(src, "读档不该补造时刻").not.toContain("titlesOwned.value.map((id) => [id,");
  });
});

describe("称号的道历 · 读出来", () => {
  it("同一个格式化函数 —— 称号与图鉴说的是同一种时间", () => {
    const view = readSource("src/views/TitlesView.vue");
    expect(view, "称号页要读道历").toContain("codexMomentText(");
    expect(view, "要有稳定落点供真浏览器复核").toContain("data-title-moment");
  });

  it("没有时刻的称号说「早年收录」,不装成这一世得的", () => {
    expect(codexMomentText(null)).toBe("早年收录");
    expect(codexMomentText(undefined)).toBe("早年收录");
  });

  it("有时刻的照实印「第 N 世 · M 岁」", () => {
    expect(codexMomentText({ life: 3, age: 42 })).toBe("第 3 世 · 42 岁");
  });
});
