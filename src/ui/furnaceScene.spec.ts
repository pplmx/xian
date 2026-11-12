/**
 * 天道熔炉 —— 四种前尘俗物各熔各的,而四行只有名与数。
 *
 * ## 现状
 *
 * 「天道熔炉」把四种可熔资源列成四行(矿 / 残页 / 灵草 / 尘):存量、
 * 「熔尽本包 → N 道源」、确认条。212 行模板里一个 `<svg>` 都没有。
 *
 * ## 身份是现成的
 *
 * `data/endgame` 的 `FURNACE_RATES` 就是那四行(ore / page / herb / dust),各按
 * 自己的「一炉多少」折算。故按**这一味是什么**取景:
 *
 *   矿   per 25 → 山岳(从山里凿出来)
 *   残页 per 15 → 宫阙(书阁里散出的)
 *   灵草 per 60 → 林麓(长出来的)
 *   尘   per 80 → 遗迹(碾碎之后剩下的)
 *
 * 四味落四种,不共用 —— 四行并排时共用一张底就等于只有一种料。
 *
 * ## 判据守什么
 *
 *   一 四味各一副画,不许两味共用;
 *   二 取景读**这一行**(`rate.resource`),不是玩家脚下那片地;
 *   三 画不占布局:那一行是存量、按钮与确认条。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { FURNACE_RATES } from "@/data/endgame";
import { SCENE_TERRAINS, sceneTerrainOfFurnace, type SceneTerrain } from "@/ui/sceneTerrain";

const DLG = "src/components/celestial/FurnaceDialog.vue";

describe("天道熔炉 · 这一味熔得出什么", () => {
  it("四味各一副画 —— 不许两味共用", () => {
    expect(FURNACE_RATES.length, "熔炉该有四味").toBe(4);
    const seen = new Map<SceneTerrain, string>();
    for (const r of FURNACE_RATES) {
      const terrain = sceneTerrainOfFurnace(r.resource);
      expect(SCENE_TERRAINS, `${r.name} 落到一个不存在的地形`).toContain(terrain);
      const clash = seen.get(terrain);
      expect(clash, `${r.name} 与 ${clash} 画成了同一片(${terrain})`).toBeUndefined();
      seen.set(terrain, r.name);
    }
    expect(seen.size, "四味该有四种不同的画").toBe(4);
  });

  it("认不出的落回山岳兜底", () => {
    expect(sceneTerrainOfFurnace(null)).toBe("peaks");
    expect(sceneTerrainOfFurnace("no-such-resource")).toBe("peaks");
  });

  it("熔炉真接上了画,且按这一味取景", () => {
    const src = readSource(DLG);
    expect(src, "天道熔炉仍是纯文字 —— 四行只有名与数").toContain("<InkScene");
    const call = src.match(/sceneTerrainOfFurnace\(([^)]*)\)/)?.[1] ?? "";
    expect(call, "定位不到取景那一处 —— 判据会空转").not.toBe("");
    expect(call, "取景要读这一味").toMatch(/resource|rate/);
    expect(src, "不许退化成玩家脚下那片地").not.toMatch(
      /<InkScene[^>]*:world-id="player\.world\.id"/,
    );
  });

  it("画落在四行里,且不占布局", () => {
    const src = readSource(DLG);
    const row = src.match(/v-for="row in furnaceRows"[\s\S]*?\n        <\/div>/)?.[0] ?? "";
    expect(row, "定位不到熔炉那四行 —— 判据会空转").not.toBe("");
    expect(row, "画要落在每一行里").toContain("<InkScene");
    const css = readSource("src/styles/pages/celestial.css");
    const rule =
      (src.match(/\.furnace-row__scene\s*\{[\s\S]*?\n\s*\}/)?.[0] ?? "") ||
      (css.match(/\.furnace-row__scene\s*\{[\s\S]*?\n\s*\}/)?.[0] ?? "");
    expect(rule, "定位不到 .furnace-row__scene —— 判据会空转").not.toBe("");
    expect(rule, "画要脱离流").toMatch(/position:\s*absolute/);
    expect(rule, "画不接指针").toMatch(/pointer-events:\s*none/);
  });
});
