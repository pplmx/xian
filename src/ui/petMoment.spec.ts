/**
 * 契兽的道历 —— 何时与它结的缘。
 *
 * ## 是什么让我又找到这里
 *
 * 第 27 轮给称号补「得它的那一刻」时,判据是这么写的:图鉴有、称号没有,
 * 同一类事实一处记了、一处没记。当时只修了称号那条。
 *
 * 这次顺着同一根线看了一下:`quests.petCompanions` 同样只是个 id 数组 ——
 * 玩家有一园灵兽,却分不出哪只是**这一世**结的缘、哪只是上辈子就跟着的。
 *
 * ## 这作里「何时的」为什么重要
 *
 * 转世会把灵兽清零(见 `player.rebirth()`,第 29 轮的代价清单里写着「灵兽随皮囊散去」)。
 * 故一只灵兽**不可能是跨世留下的** —— 但玩家记不住这一点。谱上二十只并排,
 * 没有时间读数时,"哪只是我这辈子刚遇见的"这个问题在界面上无解。
 *
 * ## 只做一件事
 *
 * 与称号同一条路:结缘时用 `codexMomentOfPlayer` 记一份道历,谱上读出来。
 * 不新写历法、不新写格式化 —— 那两份已经在 `ui/codexMoment` 里定过了。
 *
 * ## 旧档
 *
 * 已经收在谱里的灵兽没有这一对读数。照实说「早年结缘」—— 与图鉴、称号同一条口径,
 * **不补造**。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

describe("契兽的道历 · 记下来", () => {
  it("结缘时同时记一份道历 —— 与称号、图鉴同一个取数函数", () => {
    const src = readSource("src/stores/quests.ts");
    const at = src.indexOf("function recordPetCompanion(");
    expect(at, "recordPetCompanion 要还在").toBeGreaterThan(0);
    const block = src.slice(at, src.indexOf("\n    function ", at + 10));
    expect(block, "结缘时要记时刻").toContain("petMoments");
    /*
     * 守**行为**,不守写法:道历必须由调用方传进来(取自玩家自身),本函数只负责存,
     * 不许自己造一份钟。
     *
     * 原先断言的是「函数体里出现 codexMomentOfPlayer(」—— 那是在钉实现细节。
     * 这条依赖已经改成参数传入(为了让 quests 不再 import player,解开
     * quests 与 player 那个环),同样的契约换了写法,断言就红了。
     */
    expect(block, "道历要从参数拿(由调用方从玩家自身取)").toMatch(/moment:\s*CodexMoment/);
    expect(block, "不许自己造一份钟 —— 道历必须来自玩家").not.toContain("Date.now()");
  });

  it("旧档里已在谱上的灵兽不会被编一个时刻", () => {
    const src = readSource("src/stores/quests.ts");
    // 读档修复只保留仍合法的 id,不补造 moments
    const at = src.indexOf("petCompanions.value = uniqueKnown(");
    expect(at, "读档修复那一段要还在").toBeGreaterThan(0);
    const block = src.slice(at, at + 900);
    expect(block, "修复不该补造时刻").not.toContain("petMoments.value = {");
  });

  it("时刻跟着名单一起落盘", () => {
    const src = readSource("src/stores/quests.ts");
    expect(src, "要暴露给界面").toContain("petMoments,");
  });
});

describe("契兽的道历 · 读出来", () => {
  it("灵兽谱读同一份格式化,且有稳定落点", () => {
    const view = readSource("src/views/TitlesView.vue");
    expect(view, "要读道历").toContain("codexMomentText(");
    expect(view, "要有稳定落点供真浏览器复核").toContain("data-pet-moment");
  });

  it("「早年的」与「这一世的」用同一种说法 —— 不另造一套词", () => {
    /*
     * 称号那侧用的是 codexMomentText,没有时刻时说「早年收录」。
     * 灵兽这边若另写一句「早年结缘」,两处就成了两套说法 —— 而玩家分不出
     * 「收录」「结缘」是不是同一个意思。故这里也走同一个函数。
     */
    const view = readSource("src/views/TitlesView.vue");
    // 不许在模板里手写「早年结缘」这类自造词
    expect(view).not.toContain("早年结缘");
  });
});
