/**
 * 天道试炼 —— 十门各有各的规则,而档案上只有一枚印字。
 *
 * ## 现状
 *
 * 天界「试炼」那一册:左边八枚印连成一排,右边是选中的那一门的档案
 * (第 N 门 · 已破/未破 · 名 · 最佳 N 回合 · desc · ruleText · 道源 · 应试键)。
 * 777 行模板里一个 `<svg>` 都没有。
 *
 * ## 身份是现成的,而且写得很有画面
 *
 * `data/endgame` 的十条 `TRIALS` 每一门都写着它是什么场面:
 *
 *   七杀 —— 「七场连战,不得换装,场场增强」      → 一条路走到底,越走越窄
 *   一线 —— 「开局气血仅余三成半」                → 站在崖边
 *   无回 —— 「此地一切治疗无效」                  → 断掉来路
 *   照影 —— 「对手借你的力回敬,出手越密吃回越多」→ 镜与影
 *   惊雷 —— 「天雷封界,敌如惊雷而至」            → 雷雨
 *   追云 —— 「云巅罡风如刀」                      → 云上
 *   绝境 —— 「敌如饿虎相逼,尖牙利爪撕开甲胄」    → 荒野
 *   消磨 —— 「敌身披重甲、饮血而战」              → 铁壁
 *   澄心 —— 「敌不还手,只是站着」                → 静水
 *   终末 —— 「场场都是界主」                      → 尽头
 *
 * ## 判据守什么
 *
 *   一 十门各有各的画,不许共用一张底(十门是十种完全不同的考法);
 *   二 取景读**这一门**(`selectedTrial`),不是玩家脚下那片地,也不是「天界」这一层;
 *   三 画不占布局:档案那一格正文是 desc 与规则行。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { TRIALS } from "@/data/endgame";
import { SCENE_TERRAINS, sceneTerrainOfTrial, type SceneTerrain } from "@/ui/sceneTerrain";

const PANEL = "src/components/celestial/TrialPanel.vue";

describe("天道试炼 · 这一门是什么场面", () => {
  it("十门把九种地形用满 —— 唯一那一对共用必须写得出理由", () => {
    /*
     * 九种地形装十门,必有**一对**共用 —— 这一条不假装它们全不同。
     * 故钉三件事:
     *   一 九种地形**全都用上**(留一种空着,等于十门里有一对白白挤在同一片);
     *   二 只该有**一对**共用(再多就说明表是随手配的);
     *   三 共用的那一对只能是表里写明的那一对(惊雷 / 追云 —— 两门都是「天上的事」)。
     */
    const byTerrain = new Map<SceneTerrain, string[]>();
    for (const trial of TRIALS) {
      const terrain = sceneTerrainOfTrial(trial.id);
      expect(SCENE_TERRAINS, `${trial.name} 落到一个不存在的地形`).toContain(terrain);
      byTerrain.set(terrain, [...(byTerrain.get(terrain) ?? []), trial.id]);
    }
    expect(byTerrain.size, `十门只用到 ${byTerrain.size} 种地形 —— 九种该用满`).toBe(
      SCENE_TERRAINS.length,
    );
    const shared = [...byTerrain.entries()].filter(([, ids]) => ids.length > 1);
    expect(shared.length, "十门九地形,只该有一对共用").toBe(1);
    expect(shared[0]![1].sort(), "共用的必须是惊雷与追云 —— 两门都是「天上的事」").toEqual([
      "jinglei",
      "zhuifeng",
    ]);
  });

  it("认不出的试炼落到虚空兜底 —— 不冒充寻常风景", () => {
    /*
     * 试炼是**天界考法**,没有一门是「寻常山野」。故兜底给虚空
     * (与 `sceneTerrainOfTribulation` 同一条纪律:认不出的落到最不像风景的那一种)。
     */
    expect(sceneTerrainOfTrial(null)).toBe("void");
    expect(sceneTerrainOfTrial("no-such-trial")).toBe("void");
  });

  it("试炼册真接上了画,且按这一门取景", () => {
    const src = readSource(PANEL);
    expect(src, "试炼册仍是纯文字 —— 777 行模板里一个 svg 都没有").toContain("<InkScene");
    const call = src.match(/sceneTerrainOfTrial\(([^)]*)\)/)?.[1] ?? "";
    expect(call, "定位不到取景那一处 —— 判据会空转").not.toBe("");
    expect(call, "取景要读这一门").toMatch(/selectedTrial/);
    expect(src, "不许退化成玩家脚下那片地").not.toMatch(
      /<InkScene[^>]*:world-id="player\.world\.id"/,
    );
  });

  it("画不占布局", () => {
    const src = readSource(PANEL);
    const css = readSource("src/styles/pages/celestial.css");
    const rule =
      (src.match(/\.celestial-trial-dossier__scene\s*\{[\s\S]*?\n\}/)?.[0] ?? "") ||
      (css.match(/\.celestial-trial-dossier__scene\s*\{[\s\S]*?\n  \}/)?.[0] ?? "");
    expect(rule, "定位不到 .celestial-trial-dossier__scene —— 判据会空转").not.toBe("");
    expect(rule, "画要脱离流").toMatch(/position:\s*absolute/);
    expect(rule, "画不接指针").toMatch(/pointer-events:\s*none/);
  });
});
