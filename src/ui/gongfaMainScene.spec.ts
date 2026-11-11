/**
 * 藏经阁的主修席 —— 这一部书立在你身上,而它只有一行字。
 *
 * ## 现状
 *
 * 功法那一章最上面是**主修席**:一枚「主」字、书名、第几层 · 品阶、流派徽章、
 * 「可升层」与「看功法」。那是这一章**最显眼的一格** —— 一目了然「我这一世以哪一部立身」。
 *
 * 而功法详情弹窗上一轮已经按五行取景了(`sceneTerrainOfGongfa`),主修席却没有:
 * 同一个身份,点开之后看得见、点开之前看不见。
 *
 * ## 判据守什么
 *
 *   一 主修席有画,且**复用**详情那条表(两处各画各的,同一部书会长成两片天);
 *   二 取景读**这一部主修**(`mainDef`),不是玩家脚下那片地;
 *   三 画不占布局:这一格是 48px 高的按钮行,画占布局会把「看功法」挤走。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

const SEC = "src/components/cultivation/GongfaSection.vue";

describe("藏经阁 · 主修席也该有那片天", () => {
  it("主修席有画,且复用功法详情那条表", () => {
    const src = readSource(SEC);
    expect(src, "主修席仍是纯文字 —— 点开之后看得见,点开之前看不见").toContain("<InkScene");
    expect(src, "取景要复用详情那一条").toContain("sceneTerrainOfGongfa");
    const call = src.match(/sceneTerrainOfGongfa\(([^)]*)\)/)?.[1] ?? "";
    expect(call, "定位不到取景那一处 —— 判据会空转").not.toBe("");
    expect(call, "取景要读这一部主修").toContain("mainDef");
    expect(src, "不许退化成玩家脚下那片地").not.toMatch(
      /<InkScene[^>]*:world-id="player\.world\.id"/,
    );
  });

  it("画落在主修席那一格内", () => {
    const src = readSource(SEC);
    /*
     * 画必须在**主修席那一格**里,不是整章一张底:这一章底下还有门类签与书目,
     * 整章铺一张底等于把「我以哪一部立身」这句话稀释成背景。
     */
    const card = src.match(/v-if="mainDef"[\s\S]*?<\/button>/)?.[0] ?? "";
    expect(card, "定位不到主修席那一格 —— 判据会空转").not.toBe("");
    expect(card, "画要落在主修席里").toContain("<InkScene");
  });

  it("画不占布局", () => {
    const src = readSource(SEC);
    const css = readSource("src/styles/pages/cultivation.css");
    const rule =
      (src.match(/\.cultivation-gongfa__main-scene\s*\{[\s\S]*?\n\}/)?.[0] ?? "") ||
      (css.match(/\.cultivation-gongfa__main-scene\s*\{[\s\S]*?\n  \}/)?.[0] ?? "");
    expect(rule, "定位不到 .cultivation-gongfa__main-scene —— 判据会空转").not.toBe("");
    expect(rule, "画要脱离流").toMatch(/position:\s*absolute/);
    expect(rule, "画不接指针").toMatch(/pointer-events:\s*none/);
  });
});
