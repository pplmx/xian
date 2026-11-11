/**
 * 部位候选帖 —— 同一件装备的另一半:挑的时候只有一张清单。
 *
 * ## 现状
 *
 * 行囊里按部位摊开候选(`SlotCandidatesDialog`)时,弹窗标题就是那个部位名
 * (「武器」/「衣袍」/「头冠」…),底下是一张几十行的清单。336 行模板里
 * 一个 `<svg>` 都没有 —— 这一窗的辨识物只有标题那两个字。
 *
 * ## 为什么这一处现成
 *
 * 器评帖上一轮已经按**席位**取景了(`sceneTerrainOfSlot`)。这一窗更简单:
 * 它**整扇就是关于一个部位的** —— 标题、清单、每一件都在说同一件事。
 * 而玩家在这里做的事(从一堆候选里挑一件)与器评帖(看一件的详情)是同一件事的两半。
 *
 * 故不新立一套表,直接用器评帖那一条 —— 两处若各画各的,同一个部位在两个窗里
 * 会长得不一样。
 *
 * ## 判据守什么
 *
 *   一 这一窗有画,且**复用**器评帖那张表(不许另起一份);
 *   二 取景读**这一窗的部位**(`slotName`),不是玩家脚下那片地;
 *   三 画不占布局:这一窗正文是候选清单,画推下去就少看几件。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

const DLG = "src/components/inventory/SlotCandidatesDialog.vue";

describe("部位候选帖 · 与器评帖同一片天", () => {
  it("这一窗有画,且复用器评帖那张表", () => {
    const src = readSource(DLG);
    expect(src, "部位候选帖仍是纯文字 —— 辨识物只有标题那两个字").toContain("<InkScene");
    /*
     * 必须复用 `sceneTerrainOfSlot`,不许另起一份表:同一个部位在
     * 「候选中挑一件」与「看一件详情」两个窗里长出两片天,读起来就是两份底稿。
     */
    expect(src, "取景要复用器评帖那条").toContain("sceneTerrainOfSlot");
    const call = src.match(/sceneTerrainOfSlot\(([^)]*)\)/)?.[1] ?? "";
    expect(call, "定位不到取景那一处 —— 判据会空转").not.toBe("");
    expect(call, "取景要读这一窗的部位").toContain("slotName");
    expect(src, "不许退化成玩家脚下那片地").not.toMatch(
      /<InkScene[^>]*:world-id="player\.world\.id"/,
    );
  });

  it("画不占布局", () => {
    const src = readSource(DLG);
    const rule = src.match(/\.slot-candidate__scene\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(rule, "定位不到 .slot-candidate__scene —— 判据会空转").not.toBe("");
    /*
     * 这一窗正文是**几十行的候选清单** —— 画占布局就等于少看几件。
     * 故脱离流、钉在面板顶(与功法详情同一条落法:那一窗面板是 flex,流里的画会
     * 夹在读数中间)。
     */
    expect(rule, "画要脱离流").toMatch(/position:\s*absolute/);
    expect(rule, "画要钉在面板顶").toMatch(/top:\s*0/);
    expect(rule, "画不接指针").toMatch(/pointer-events:\s*none/);
  });
});
