/**
 * 修行画像 —— 一屏「别人眼里的你」,而全屏的辨识物是一枚称谓首字。
 *
 * ## 现状
 *
 * 修行画像(`IdentityDialog`)是人物页里最"像一张画"的一屏:此世称谓、一句
 * 由真实行迹归纳的叙事、行为特征词、道龄,再往下是「此身所历」——师承、道途、
 * 流派、悟道。这一屏讲的正是「这些年你活成了什么样子」。
 *
 * 而它 639 行模板里一个 `<svg>` 都没有:辨识物只有一枚楷体的**称谓首字**。
 *
 * ## 身份是现成的
 *
 * `buildIdentity()` 归纳四样东西,其中**道途**本来就有自己的形象
 * (`data/endgame` 的 `DAO_PATHS`,八条各有 desc):
 *
 *   剑道   「一剑破万法。极致的锋锐,换走厚重的余地」
 *   镇岳道 「以身为岳,先立于不败」
 *   长生道 「不争一时之胜,只求万世长存」
 *   天机道 「窥破天机,亦被天机所窥」
 *   杀伐道 「以战证道。你我皆利刃,先断者输」
 *   连珠道 「一击连着一击,流水不复,断者自乱」
 *   借势道 「他强由他强,我借其势,反手一击」
 *   血河道 「残血见真章。以血换血,越残越凶」
 *
 * 八条道途是八种完全不同的活法 —— 而画像上一条都看不见。
 *
 * ## 判据守什么
 *
 *   一 画像有画,且按**这一世的道途**取景(不是玩家脚下那一片地):
 *      这是「你是谁」的一屏,不是「你在哪」的一屏;
 *   二 八条道途各有各的画,不许共用一张底;
 *   三 未定道途时落回山岳兜底 —— 这一处没有「认不出」的语义(还没选而已),
 *      与道侣那条回 null 不同。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { DAO_PATHS } from "@/data/endgame";
import { SCENE_TERRAINS, sceneTerrainOfDao, type SceneTerrain } from "@/ui/sceneTerrain";

const DLG = "src/components/character/IdentityDialog.vue";

describe("修行画像 · 这一世活成了哪片天", () => {
  it("八条道途各有各的画 —— 不许共用一张底", () => {
    const seen = new Map<SceneTerrain, string>();
    for (const dao of DAO_PATHS) {
      const terrain = sceneTerrainOfDao(dao.id);
      expect(SCENE_TERRAINS, `${dao.name} 落到一个不存在的地形`).toContain(terrain);
      const clash = seen.get(terrain);
      expect(clash, `${dao.name} 与 ${clash} 画成了同一片(${terrain})`).toBeUndefined();
      seen.set(terrain, dao.name);
    }
    expect(seen.size, `八条道途该有八副长相,现在只有 ${seen.size} 种`).toBe(DAO_PATHS.length);
  });

  it("未定道途落到山岳兜底", () => {
    /*
     * 与道侣那条(`sceneTerrainOfAxis` 回 null)相反:那里「随处可遇」是一个答案,
     * 这里「还没选」不是 —— 画像总要画点什么,而修士未择道时就在山门里。
     */
    expect(sceneTerrainOfDao(null)).toBe("peaks");
    expect(sceneTerrainOfDao("no-such-dao")).toBe("peaks");
  });

  it("画像真接上了画,且按这一世的道途取景", () => {
    const dlg = readSource(DLG);
    expect(dlg, "修行画像仍是纯文字 —— 639 行模板里一个 svg 都没有").toContain("<InkScene");
    /*
     * 取景读**道途**,不读玩家脚下那一片地:这一屏是「你是谁」,
     * 不是「你在哪」。写死 `player.world.id` 会让八条道途共用一片天。
     */
    expect(dlg, "取景要读这一世的道途").toContain("sceneTerrainOfDao");
    expect(dlg, "取景要读这一世的道途").toMatch(/sceneTerrainOfDao\(/);
    expect(dlg, "不许退化成玩家脚下那片地").not.toMatch(
      /<InkScene[^>]*:world-id="player\.world\.id"/,
    );
  });
});
