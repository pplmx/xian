/**
 * 天界远征 —— 六个特殊规则世界,六幅写成文字的长相,一行画都没有。
 *
 * ## 现状
 *
 * 远征册第二章「特殊规则世界」把六界摊成六行:赤炎天、星陨天、万刃天、无生天、
 * 无相天,再加一道「虚界之门」。每一行的 desc 都把那一界的长相写得很足:
 *
 *   赤炎天 —— 「天穹燃烧,雷火贯体」
 *   星陨天 —— 「星斗倾颓,陨石如雨」
 *   万刃天 —— 「亿万飞刃永不停歇」
 *   无生天 —— 「此界拒绝生机」
 *   无相天 —— 「万物无相,出手落空」
 *
 * 全是字。而这六行恰恰是玩家**择界启程**的那一屏:要选去哪儿,却看不到那儿长什么样。
 *
 * ## 为什么这一处的身份是现成的
 *
 * `sceneTerrain` 的分派顺序是「地界图标 → 标签 → 世界」。天界六界既不是地界
 * (没有 `RegionDef.icon`),也不在任何一界(WORLDS 只有人间/仙/神/混沌)——
 * 它们是**天界自己的一层世界**。故照 `sceneTerrainOfTribulation` 已有的做法
 * 单开一支:天界 id → 地形。这与「渡劫按劫型取景」是同一条纪律 ——
 * 一屏的身份由它自己是什么决定,不靠脚下那片地兜底。
 *
 * ## 判据守什么
 *
 *   一 六界各有各的画,不许共用一张底(那就等于没有);
 *   二 取景读天界自己的 id,不是玩家所在的界;
 *   三 虚界之门也有画(它是程序生成的那种,id 不在常量表里,故要单独给一路)。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { CELESTIAL_WORLDS } from "@/data/endgame";
import { SCENE_TERRAINS, sceneTerrainOfCelestial, type SceneTerrain } from "@/ui/sceneTerrain";

const PANEL = "src/components/celestial/ExpeditionPanel.vue";

describe("天界远征 · 一界一景", () => {
  it("六个天界各有各的画 —— 不许共用一张底", () => {
    const seen = new Map<SceneTerrain, string>();
    for (const world of CELESTIAL_WORLDS) {
      const terrain = sceneTerrainOfCelestial(world.id);
      expect(SCENE_TERRAINS, `${world.name} 落到一个不存在的地形`).toContain(terrain);
      /*
       * 共用一张底等于没有:玩家要选去哪儿,而两界画成同一片天,
       * 那一栏就还是六个色块加六行字。故逐界去重。
       */
      const clash = seen.get(terrain);
      expect(clash, `${world.name} 与 ${clash} 画成了同一片天(${terrain})`).toBeUndefined();
      seen.set(terrain, world.name);
    }
    expect(seen.size, "天界六界该有六副长相").toBe(CELESTIAL_WORLDS.length);
  });

  it("认不出的天界落到虚空兜底,不像「一处寻常风景」", () => {
    /*
     * 虚界之门是程序生成的,id 不在 CELESTIAL_WORLDS 里。它自己的 seal 是「虚」,
     * 该画成虚空 —— 而不是随便落回山岳(那会让「虚界」看起来像青云山麓)。
     */
    expect(sceneTerrainOfCelestial("void")).toBe("void");
    expect(sceneTerrainOfCelestial(null)).toBe("void");
    expect(sceneTerrainOfCelestial("no-such-world")).toBe("void");
  });

  it("远征册那一屏真接上了画,且按天界 id 取景", () => {
    const panel = readSource(PANEL);
    expect(panel, "特殊规则世界仍是纯文字 —— 六行字,一行画都没有").toContain("<InkScene");
    /*
     * 取景必须读**这一行那一个世界**,不是玩家所在的界:玩家此刻在神界,
     * 而赤炎天照样该画成火域。写死 `player.world.id` 会让六行共用一张底。
     */
    expect(panel, "取景要读这一行那个世界").toMatch(
      /<InkScene[\s\S]{0,200}:terrain="sceneTerrainOfCelestial\((world|endgame)[^)]*\)"/,
    );
  });
});
