/**
 * 功法详情 —— 十一行五行、三类门径,而那一屏只有一行小字说「火属性」。
 *
 * ## 现状
 *
 * 点开一部功法,弹窗报品阶、品评、一句风味、效果、悟道分支与按钮 ——
 * 474 行模板里一个 `<svg>` 都没有。五行的身份只在眉题那一行挂着一枚 chip:
 *
 * ```text
 * [主修] [火属性] [同源 ×2.2]           第 3/9 层
 * ```
 *
 * 而这一作里**五行是构筑的一半**:同一部功法五行不同,与之同源的灵根、
 * 藏经阁的参悟权重、与其它功法的相生相克全都跟着变。`data/linggen` 的
 * `ELEMENTS` 有十一行(金木水火土 + 风雷冰光暗混沌),每一行是一整套不同的修行。
 *
 * ## 判据守什么
 *
 *   一 十一行五行各有各的画,不许共用一张底;
 *   二 无五行的那一部(纯体术 / 心法,59 部里有一大半)落到**门径**那一档:
 *      它的身份是「主修 / 辅修 / 秘术」而不是五行 —— 不许一律落同一片兜底山;
 *   三 取景读**这一部功法**,不是玩家脚下那片地;
 *   四 画不占布局:这一窗正文是效果、悟道分支与按钮。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { ELEMENTS } from "@/data/linggen";
import { GONGFA } from "@/data/gongfa";
import { SCENE_TERRAINS, sceneTerrainOfGongfa, type SceneTerrain } from "@/ui/sceneTerrain";

const DLG = "src/components/cultivation/GongfaDialog.vue";

describe("功法详情 · 这一门属什么", () => {
  it("十一行五行各有各的画 —— 不许共用一张底", () => {
    const seen = new Map<SceneTerrain, string>();
    for (const id of Object.keys(ELEMENTS)) {
      const terrain = sceneTerrainOfGongfa(id, "main");
      expect(SCENE_TERRAINS, `${id} 落到一个不存在的地形`).toContain(terrain);
      seen.set(terrain, `${seen.get(terrain) ?? ""}${id} `);
    }
    /*
     * 十一行、九种地形:必然有重复。要求的是**九种地形全用上** ——
     * 留一种空着,说明两个五行白白挤在同一片。
     */
    expect(seen.size, `十一行五行只用到 ${seen.size} 种地形,九种该用满`).toBe(
      SCENE_TERRAINS.length,
    );
  });

  it("没有五行的那一部按门径取景 —— 不许一律落同一片兜底山", () => {
    /*
     * 92 部功法里有 59 部没有 element(纯体术 / 心法)。它们的身份是
     * 「主修 / 辅修 / 秘术」,而这三类是三种不同的装配规则(主修占唯一主修席、
     * 辅修与秘术都占辅修席)。三者画成同一片,等于那 59 部共用一张底。
     */
    const seen = new Set<SceneTerrain>();
    for (const type of ["main", "sub", "secret"] as const) {
      seen.add(sceneTerrainOfGongfa(null, type));
    }
    expect(seen.size, "三类门径该有三副不同的长相").toBe(3);
  });

  it("92 部功法各自都分得到画", () => {
    for (const def of GONGFA) {
      const terrain = sceneTerrainOfGongfa(def.element, def.type);
      expect(SCENE_TERRAINS, `「${def.name}」落到一个不存在的地形`).toContain(terrain);
    }
    /*
     * 落地的那一片不许只有一种:92 部功法如果全画成同一片,
     * 这一轮就等于没做。
     */
    const buckets = new Set(GONGFA.map((d) => sceneTerrainOfGongfa(d.element, d.type)));
    expect(buckets.size, `92 部功法只落在 ${buckets.size} 种地形上`).toBeGreaterThanOrEqual(8);
  });

  it("弹窗真接上了画,且按这一部功法取景", () => {
    const src = readSource(DLG);
    expect(src, "功法详情仍是纯文字 —— 474 行模板里一个 svg 都没有").toContain("<InkScene");
    const call = src.match(/sceneTerrainOfGongfa\(([^)]*)\)/)?.[1] ?? "";
    expect(call, "定位不到取景那一处 —— 判据会空转").not.toBe("");
    expect(call, "取景要读这一部功法").toContain("def");
    expect(src, "不许退化成玩家脚下那片地").not.toMatch(
      /<InkScene[^>]*:world-id="player\.world\.id"/,
    );
  });

  it("画不占布局", () => {
    const src = readSource(DLG);
    /*
     * 样式落在组件内的 scoped 块里 —— `InkScene` 的高度规则是带 data-v 的 scoped 规则,
     * 同一个 data-v 上写反而更稳(上一轮在器评帖上踩过 height 被盖过、画撑满整帖)。
     */
    const rule = src.match(/\.gongfa-detail__scene\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(rule, "定位不到 .gongfa-detail__scene —— 判据会空转").not.toBe("");
    /*
     * 必须**脱离流**钉在面板顶,不能当流里的一块:这一窗的面板是 `flex flex-col`,
     * 画若照流排,就落在品评与风味之间 —— 实测截图里正是一条山夹在
     * 「炼得成形,已有章法」与「取青木生生不息之意」中间,像一条被压扁的横幅。
     */
    expect(rule, "画要脱离流").toMatch(/position:\s*absolute/);
    expect(rule, "画要钉在面板顶").toMatch(/top:\s*0/);
    expect(rule, "画不接指针").toMatch(/pointer-events:\s*none/);
    /*
     * 高度走 `--ink-scene-h`:这一层同时就是 `.ink-scene` 本身,它自带
     * `height: var(--ink-scene-h, 100%)`,直接写 height 会被组件内那条盖过
     * (上一轮在器评帖上踩过,画撑满整帖)。
     */
    expect(rule, "高度要走 --ink-scene-h").toMatch(/--ink-scene-h:/);
    expect(rule, "别直接写 height").not.toMatch(/(^|\n)\s*height:\s*[0-9]/);
  });
});
