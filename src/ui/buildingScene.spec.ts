/**
 * 洞府营造 —— 七座建筑各占一张卡,而卡面只有一枚 15px 图标。
 *
 * ## 现状
 *
 * 洞府页把七座建筑(洞府 / 聚灵阵 / 炼丹炉 / 炼器台 / 灵田 / 藏经阁 / 灵兽园)
 * 各做成一张卡:图标、名、等级、进度条、详情开关。244 行模板里一个 `<svg>` 都没有 ——
 * 七张卡的区别只有那枚图标与几个数。
 *
 * ## 身份是现成的
 *
 * `data/buildings` 的七座各自管一摊事,而地形可以按**这一座营在哪儿**取景:
 *
 *   洞府   —— 住处本身                → 山岳(依山而居)
 *   聚灵阵 —— 引气入内的法阵          → 星野(接天)
 *   炼丹炉 —— 火与炉                  → 火域
 *   炼器台 —— 锻与淬                  → 雪原(淬火之寒)
 *   灵田   —— 种灵草                  → 林麓
 *   藏经阁 —— 藏书                    → 宫阙(阁)
 *   灵兽园 —— 养兽                    → 江海(放养之地,水草丰处)
 *
 * 七座落七种,不共用 —— 七张卡并排时,共用一张底就等于只有一种建筑。
 *
 * ## 判据守什么
 *
 *   一 七座各一副画,不许两座共用;
 *   二 取景读**这一座**(`def.id`),不是玩家脚下那片地;
 *   三 画不占布局:卡面是图标、等级、进度条与详情开关。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { BUILDINGS } from "@/data/buildings";
import { SCENE_TERRAINS, sceneTerrainOfBuilding, type SceneTerrain } from "@/ui/sceneTerrain";

const ROW = "src/components/dongfu/BuildingLedgerRow.vue";

describe("洞府营造 · 这一座营在哪儿", () => {
  it("七座各一副画 —— 不许两座共用", () => {
    expect(BUILDINGS.length, "洞府该有七座").toBe(7);
    const seen = new Map<SceneTerrain, string>();
    for (const b of BUILDINGS) {
      const terrain = sceneTerrainOfBuilding(b.id);
      expect(SCENE_TERRAINS, `${b.name} 落到一个不存在的地形`).toContain(terrain);
      const clash = seen.get(terrain);
      expect(clash, `${b.name} 与 ${clash} 画成了同一片(${terrain})`).toBeUndefined();
      seen.set(terrain, b.name);
    }
    expect(seen.size, "七座该有七种不同的画").toBe(7);
  });

  it("认不出的建筑落到山岳兜底", () => {
    expect(sceneTerrainOfBuilding(null)).toBe("peaks");
    expect(sceneTerrainOfBuilding("no-such-building")).toBe("peaks");
  });

  it("建筑卡真接上了画,且按这一座取景", () => {
    const src = readSource(ROW);
    expect(src, "洞府建筑卡仍是纯文字 —— 七张卡只有图标与数字不同").toContain("<InkScene");
    const call = src.match(/sceneTerrainOfBuilding\(([^)]*)\)/)?.[1] ?? "";
    expect(call, "定位不到取景那一处 —— 判据会空转").not.toBe("");
    expect(call, "取景要读这一座").toMatch(/def\b|props\.def/);
    expect(src, "不许退化成玩家脚下那片地").not.toMatch(
      /<InkScene[^>]*:world-id="player\.world\.id"/,
    );
  });

  it("画不占布局", () => {
    const src = readSource(ROW);
    const css = readSource("src/styles/pages/dongfu.css");
    const rule =
      (src.match(/\.dongfu-building__scene\s*\{[\s\S]*?\n\s*\}/)?.[0] ?? "") ||
      (css.match(/\.dongfu-building__scene\s*\{[\s\S]*?\n\s*\}/)?.[0] ?? "");
    expect(rule, "定位不到 .dongfu-building__scene —— 判据会空转").not.toBe("");
    expect(rule, "画要脱离流").toMatch(/position:\s*absolute/);
    expect(rule, "画不接指针").toMatch(/pointer-events:\s*none/);
  });
});
