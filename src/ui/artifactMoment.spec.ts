/**
 * 法宝的「何时得来」—— 同一类事实,四处记了,第四处却读不出来。
 *
 * ## 现状:四册里三册都写着它,独缺法宝
 *
 * `quests.collect("artifact", id)` 与别的品类走的是**同一个入口**,`collectedMoment`
 * 里早就有 `"artifact:af_xxx" → { life, age }` 这一对读数(见 stores/quests 的 collect)。
 * 也就是说:数据一直在,只是行囊的法宝册从来没读过它。
 *
 * 而装备图鉴、丹药图鉴、灵兽谱、称号谱**都**读同一份道历
 * (`ui/codexMoment` 的 `codexMomentText`,第 7 / 27 / 34 轮陆续补齐)。
 * 三册都写了、第四册空着 —— 不是设计,是那几轮只沿着"图鉴"那条线补。
 *
 * ## 为什么法宝尤其该有
 *
 * 法宝是四类里**最稀缺**的一类(全表 45 件,神品只有 5 件),而且是
 * 「天降机缘」式地落进玩家手里(`loot.acquireArtifact` 那句提示就是"天降机缘")。
 * 这样一件东西躺在册子里,却说不清是刚得的还是上一世就在的,比装备更刺眼。
 *
 * ## 本轮只做一件:把它读出来
 *
 * 不新记任何字段、不新写历法 —— 复用 `codexMomentText`(旧档无读数时照实说
 * 「早年收录」)。判定与展示都放在行卡上,与灵兽谱、称号谱同一处位置、同一种写法。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

describe("法宝的何时得来 · 记下来", () => {
  it("收录法宝时记下那一刻 —— 走的是 collect 那一个入口,不另记一份", () => {
    const src = readSource("src/stores/quests.ts");
    const at = src.indexOf("function collect(");
    expect(at, "collect 要还在").toBeGreaterThan(0);
    const block = src.slice(at, src.indexOf("\n    function ", at + 10));
    expect(block, "收录时要记道历").toContain("collectedMoment");
    expect(block, "道历取自玩家自身").toContain("codexMomentOfPlayer(");
  });

  it("法宝确实走这个入口(不是另开一条不记时刻的路)", () => {
    const loot = readSource("src/core/loot.ts");
    expect(loot, "获得法宝要 collect").toMatch(/acquireArtifact|export function acquireArtifact/);
    expect(loot, "收集品类要是 artifact").toContain('collect("artifact"');
  });
});

describe("法宝的何时得来 · 读出来", () => {
  it("法宝册读同一份格式化,并有稳定落点", () => {
    const panel = readSource("src/components/inventory/ArtifactPanel.vue");
    expect(panel, "要读道历").toContain("codexMomentText(");
    expect(panel, "要有稳定落点供真浏览器复核").toContain("data-artifact-moment");
  });

  it("读的是 collectedMoment 里法宝那一路的键 —— 不另起一套键名", () => {
    const panel = readSource("src/components/inventory/ArtifactPanel.vue");
    expect(panel, "键名要与 collect 写的一致").toContain("collectedMoment");
    expect(panel, "要按品类前缀取").toContain("artifact:");
  });

  it("没有读数时不出那半句 —— 空值不许印成「第 NaN 世」", () => {
    const panel = readSource("src/components/inventory/ArtifactPanel.vue");
    // 行卡上那一行必须是 v-if 控制,而不是无条件渲染
    expect(panel).toMatch(/v-if="[^"]*(row\.)?momentText[^"]*"/);
  });
});

describe("法宝的何时得来 · 与其余三册同一口径", () => {
  it("四处都用同一个格式化函数,不许各写一份", () => {
    for (const file of ["src/views/TitlesView.vue", "src/components/inventory/ArtifactPanel.vue"]) {
      expect(readSource(file), `${file} 该走共享的道历文案`).toContain("codexMomentText");
    }
  });
});
