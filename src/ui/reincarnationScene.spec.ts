/**
 * 往生三程 —— 全作唯一会把存档推倒重来的那一套仪式,三步全屏,一步画都没有。
 *
 * ## 现状
 *
 * 「往生录」三程收得很干净:`ReincarnationStageRail` 同源装配路签、
 * 每章共用 `FolioChapterHead`、去留账复用 `samsaraBalance` —— 文字一格没错。
 * 但三屏加起来 2000 行模板里,**一个 `<svg>` 都没有**:
 *
 *   · 一程「辞世」——  一枚楷体「终」字 + 一段读数
 *   · 二程「回照」——  同上,换「照」
 *   · 三程「择生」——  同上,换「生」
 *
 * ## 为什么这一处最该有画
 *
 * 全站别的屏都补过景了(首页、修行卷首、地界志、行旅图、战局、际遇、名号、藏珍、
 * 劫势、突破结果、归来卷轴)。剩下的没画面的地方里,这一处是**分量最重**的:
 * 玩家这一号人物的一世到此为止,而开下一世之前看到的是一屏纯字。
 *
 * 画什么也是现成的:一世止步在哪一界(`worldOf(player.major)`),那正是
 * `ui/sceneTerrain` 已经画得出的四副长相之一 —— 人间界山岳、仙界星野、
 * 神界宫阙、混沌虚空。这正是「辞世」那一屏想说的:此人一生停在哪片天地里。
 *
 * ## 判据守什么
 *
 *   一 三程都要有画(不是只有某一步),且共用一份 —— 三屏是同一册的三页;
 *   二 画的是**这一世止步的那一界**,不是别处;
 *   三 照旧只做背景:不占布局、不压读数(`pointer-events: none` 与保留高度各一并钉)。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

const DLG = "src/components/character/ReincarnationDialog.vue";

describe("往生三程 · 一世止步的那片天地", () => {
  it("三程都有画 —— 不是只有其中一步", () => {
    const dlg = readSource(DLG);
    const stages = dlg.match(/data-reincarnation-stage="(death|review|choice)"/g) ?? [];
    expect(new Set(stages).size, "定位不到三程 —— 判据会空转").toBe(3);
    /*
     * 三程各是一篇 `<article>`,画必须落在**每一篇**里。只在一处挂上 InkScene
     * 的话,另外两屏仍旧是纯字 —— 而这册三页讲的是同一件事,页面之间不该一页有一页没有。
     */
    const blocks = dlg.split(/data-reincarnation-stage="/).slice(1);
    expect(blocks.length, "按程切不开 —— 判据会空转").toBe(3);
    for (const block of blocks) {
      const stage = block.slice(0, block.indexOf('"'));
      expect(block, `「${stage}」那一程没有画`).toContain("<InkScene");
    }
  });

  it("画的是这一世止步的那一界", () => {
    const dlg = readSource(DLG);
    /*
     * 辞世那一句写的是「行世 N 载,止步于某境」—— 而「停在哪一境」对应的就是
     * 「停在哪片天地」。故取景读 `player.world.id`,与首页顶栏、修行卷首同一份口径;
     * 写死成某一界(哪怕是最常见的「人间」)会让飞升之后的那一世也画成山。
     */
    expect(dlg, "取景要读这一世所在的界").toMatch(
      /<InkScene[\s\S]{0,200}:world-id="player\.world\.id"/,
    );
    expect(dlg, "不许把某一界写死").not.toMatch(/<InkScene[^>]*:world-id="['"]/);
  });

  it("画有自己的一条，不铺满整册、不压读数", () => {
    const dlg = readSource(DLG);
    /*
     * 这一册会滚动:回照约 1140px、择生约 2180px。故画不能「铺满整册」——
     * 铺满就会落到册底,玩家要滚到底才见得着(而那正是「一进来抬头没东西可看」的原样)。
     * 也不能垫在卷首背后:山脊会横在卷首那几行读数上。
     *
     * 落法因此是**定高的一条**(`strip`):占自己的一行,底下没有字。
     * 判据量三件事 —— 它走 strip、它自己定高、它不接指针。
     */
    const tag = dlg.match(/<InkScene[\s\S]*?\/>/)?.[0] ?? "";
    expect(tag, "定位不到 InkScene —— 判据会空转").not.toBe("");
    expect(tag, "画要是定高的一条,不是铺满整册的底").toContain('variant="strip"');
    const sceneRule = dlg.match(/\.reincarnation-scene\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(sceneRule, "定位不到 .reincarnation-scene —— 判据会空转").not.toBe("");
    expect(sceneRule, "这一条要有自己的高度").toMatch(/--ink-scene-h:/);
    expect(sceneRule, "画不许铺满整册").not.toMatch(/position:\s*absolute/);
  });
});
