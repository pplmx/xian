/**
 * 开炉炼丹 —— 一炉一炉挑方子,而那一屏只有一串方名。
 *
 * ## 现状
 *
 * 开炉炼丹(`BrewingDialog`)是炼丹的主场:灵草五品的持有、炉前增益、几十张方子
 * 摆成一张清单。445 行模板里一个 `<svg>` 都没有。
 *
 * ## 身份是现成的,而且它本来就在这一屏上
 *
 * 每张方子都带着 `cost.herbGrade` —— 五品灵草,而五品各自对应一段境界带
 * (`HERB_GRADE_BANDS`,那一句「炼气~化神境的方子所用」正是从它反查出来的):
 *
 *   凡品 —— 炼气 ~ 化神       (人间界前半)
 *   灵品 —— 炼虚 ~ 渡劫       (人间界后半)
 *   仙品 —— 真仙 ~ 大罗       (仙界)
 *   神品 —— 神人 ~ 神帝       (神界)
 *   道品 —— 混沌真灵 ~ 混沌道祖 (混沌海)
 *
 * 五品对齐四大界域 —— 故取景不必另立一套:`sceneTerrainOfPlace` 的
 * 「世界 → 地形」那条表已经写着这四个界域长什么样。
 *
 * ## 判据守什么
 *
 *   一 五品各有各的画,不许共用一张底(五品是五种不同的草、五个不同的界域);
 *   二 取景读**这一炉要哪一品的草**,不是玩家脚下那片地;
 *   三 画不占布局:这一窗正文是几十张方子的清单。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { HERB_GRADES } from "@/data/herbGrades";
import { SCENE_TERRAINS, sceneTerrainOfHerbGrade, type SceneTerrain } from "@/ui/sceneTerrain";

const DLG = "src/components/inventory/BrewingDialog.vue";

describe("开炉炼丹 · 这一炉要哪一品的草", () => {
  it("五品灵草各有各的画 —— 不许共用一张底", () => {
    const seen = new Map<SceneTerrain, number>();
    for (const g of HERB_GRADES) {
      const terrain = sceneTerrainOfHerbGrade(g);
      expect(SCENE_TERRAINS, `${g} 品落到一个不存在的地形`).toContain(terrain);
      seen.set(terrain, g);
    }
    /*
     * 五品对应五个界域(人间界前/后、仙界、神界、混沌海),但地形是按**界域**分的,
     * 人间界那两品落在同一族山上是可以的 —— 真正不能接受的是五品只有一两种画。
     */
    expect(
      seen.size,
      `五品灵草只落在 ${seen.size} 种地形上 —— 至少该有四种`,
    ).toBeGreaterThanOrEqual(4);
  });

  it("认不出的品阶落到山岳兜底", () => {
    expect(sceneTerrainOfHerbGrade(null)).toBe("peaks");
    expect(sceneTerrainOfHerbGrade(0)).toBe("peaks");
    expect(sceneTerrainOfHerbGrade(9)).toBe("peaks");
  });

  it("开炉那一屏真接上了画,且按这一炉的灵草品阶取景", () => {
    const src = readSource(DLG);
    expect(src, "开炉炼丹仍是纯文字 —— 几十张方子摆成一张清单").toContain("<InkScene");
    const call = src.match(/sceneTerrainOfHerbGrade\(([^)]*)\)/)?.[1] ?? "";
    expect(call, "定位不到取景那一处 —— 判据会空转").not.toBe("");
    /*
     * 取景要读**当前选中/正在读的那一炉**的灵草品阶,不是任意一个常数。
     * 这一窗的正文是几十张方子,画说的是「你手上这一炉是哪一品的草」。
     */
    expect(call, "取景要读这一炉的灵草品阶").toMatch(/herbGrade/);
    expect(src, "不许退化成玩家脚下那片地").not.toMatch(
      /<InkScene[^>]*:world-id="player\.world\.id"/,
    );
  });

  it("画是一小片、不占整行", () => {
    const src = readSource(DLG);
    const rule = src.match(/\.brew-scene\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(rule, "定位不到 .brew-scene —— 判据会空转").not.toBe("");
    /*
     * 这一处的落法与「卷首一条」不同:这一窗是**几十张方子**的清单,
     * 给每一方一条横幅会把清单拉成两倍长。故画是行右侧**一小片定宽定高**的格子,
     * 与行首那枚 18px 图标同一个意思,只是画得出「哪一品、哪个境界」。
     *
     * 要钉的是它**不自作主张长大**:定宽、定高、不参与弹性伸缩。
     */
    expect(rule, "画要有定宽").toMatch(/width:\s*[0-9.]+rem/);
    expect(rule, "画要有定高").toMatch(/height:\s*[0-9.]+rem/);
    expect(rule, "画不参与弹性伸缩").toMatch(/flex:\s*none/);
    expect(rule, "画不接指针").toMatch(/pointer-events:\s*none/);
  });
});
