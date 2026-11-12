/**
 * 灵草坊 —— 五品灵草明码标价,而五行只有数字与名。
 *
 * ## 现状
 *
 * 「灵草坊」把五品灵草列成五行(凡品 → 道品):一枚数字印、品名、持有、
 * 单价、买 1 / 买 10。94 行模板里一个 `<svg>` 都没有。
 *
 * ## 这一处不新立表 —— 直接复用开炉炼丹那条
 *
 * `sceneTerrainOfHerbGrade` 是开炉炼丹那一轮建的(五品各对应一段境界带:
 * 凡品=炼气~化神、灵品=炼虚~渡劫、仙品=真仙~大罗、神品=神人~神帝、
 * 道品=混沌真灵~混沌道祖)。同一味草在「炼丹」与「买草」两处必须长在同一片地上 ——
 * 两处各立一张表,同一个品阶会在两个窗里长出两片天。
 *
 * ## 判据守什么
 *
 *   一 五行按品阶取景,且**复用** `sceneTerrainOfHerbGrade`(不许另起一份);
 *   二 取景读**这一行**(`row.grade`),不是玩家脚下那片地;
 *   三 画不占布局:那行是品名、持有、单价与两个按钮。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

const DLG = "src/components/inventory/HerbShopDialog.vue";

describe("灵草坊 · 这一品草长在哪片地上", () => {
  it("五行按品阶取景,且复用炼丹那条表", () => {
    const src = readSource(DLG);
    expect(src, "灵草坊仍是纯文字 —— 五行只有数字与名").toContain("<InkScene");
    /*
     * 必须复用 `sceneTerrainOfHerbGrade` —— 与开炉炼丹同一片地。
     * 若这里另写一张「品阶 → 地形」的表,同一味草会在两个窗里长得不一样。
     */
    expect(src, "取景要复用炼丹那条").toContain("sceneTerrainOfHerbGrade");
    const call = src.match(/sceneTerrainOfHerbGrade\(([^)]*)\)/)?.[1] ?? "";
    expect(call, "定位不到取景那一处 —— 判据会空转").not.toBe("");
    expect(call, "取景要读这一行").toMatch(/grade/);
    expect(src, "不许退化成玩家脚下那片地").not.toMatch(
      /<InkScene[^>]*:world-id="player\.world\.id"/,
    );
  });

  it("画落在五行里,且不占布局", () => {
    const src = readSource(DLG);
    const row = src.match(/v-for="row in marketRows"[\s\S]*?<\/div>\s*<\/div>/)?.[0] ?? "";
    expect(row, "定位不到灵草坊那五行 —— 判据会空转").not.toBe("");
    expect(row, "画要落在每一行里").toContain("<InkScene");
    const css = readSource("src/styles/pages/inventory.css");
    const rule =
      (src.match(/\.herb-shop__scene\s*\{[\s\S]*?\n\s*\}/)?.[0] ?? "") ||
      (css.match(/\.herb-shop__scene\s*\{[\s\S]*?\n\s*\}/)?.[0] ?? "");
    expect(rule, "定位不到 .herb-shop__scene —— 判据会空转").not.toBe("");
    expect(rule, "画要脱离流").toMatch(/position:\s*absolute/);
    expect(rule, "画不接指针").toMatch(/pointer-events:\s*none/);
  });
});
