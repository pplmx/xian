/**
 * 器魂三席 —— 每一席装的魂各有一副长相,而三席只有一枚印章字。
 *
 * ## 现状
 *
 * 器魂页 `SoulsView`(992 行)的「三席」是这块界面的主角:每一席嵌着一枚器魂,
 * 席上只有一枚楷体印章字(锋 / 盾 / 棘 / 连 / 泽 / 背)+ 一个颜色。
 * 装了「锋魂」还是「泽魂」,玩家只能靠那一个字的笔画去认。
 *
 * ## 身份是现成的,而且正好六种
 *
 * `src/data/souls.ts` 有六种器魂类型,每一种都写着它**是什么形状的魂**:
 *
 *   锋 fengmang —— 一往无前的那一分锐
 *   盾 gangdun  —— 罡气的形状
 *   棘 fanzhen  —— 把力还回去
 *   连 lianji   —— 出手从来不止一次
 *   泽 muze     —— 魂里存着一点不肯断的生机
 *   背 beishui  —— 越绝境越亮
 *
 * 六种正好对上六种地形,不共用 —— 同席换一枚魂,画就该换一片地。
 *
 * ## 判据守什么
 *
 *   一 六种魂各一副画,不许两种共用;
 *   二 取景读**这一席的魂**(`soulAt(i).type`),不是「这一页属于哪一界」;
 *   三 画不占布局:席上还有印章字、名与按钮。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { SOUL_TYPES } from "@/data/souls";
import { SCENE_TERRAINS, sceneTerrainOfSoul, type SceneTerrain } from "@/ui/sceneTerrain";

const VIEW = "src/views/SoulsView.vue";

describe("器魂三席 · 这一席装着什么样的魂", () => {
  it("六魂各一副画 —— 不许两种共用", () => {
    expect(SOUL_TYPES.length, "器魂该有六种类型").toBe(6);
    const seen = new Map<SceneTerrain, string>();
    for (const t of SOUL_TYPES) {
      const terrain = sceneTerrainOfSoul(t.id);
      expect(SCENE_TERRAINS, `${t.name} 落到一个不存在的地形`).toContain(terrain);
      const clash = seen.get(terrain);
      expect(clash, `${t.name} 与 ${clash} 画成了同一片(${terrain})`).toBeUndefined();
      seen.set(terrain, t.name);
    }
    expect(seen.size, "六魂该有六种不同的画").toBe(6);
  });

  it("认不出的落回山岳兜底", () => {
    expect(sceneTerrainOfSoul(null)).toBe("peaks");
    expect(sceneTerrainOfSoul("no-such-soul")).toBe("peaks");
  });

  it("三席真接上了画,且按这一席的魂取景", () => {
    const src = readSource(VIEW);
    expect(src, "器魂三席仍是纯文字 —— 装什么魂只有一枚印章字").toContain("<InkScene");
    /*
     * 取调用的**整行**,不是 `[^)]*` —— 实参里本来就带括号(`soulAt(i)!.type`),
     * 按到第一个 `)` 截断只拿到 `soulAt(i`,判据会空报。实测就是这么红的。
     */
    const call = src.match(/[^\n]*sceneTerrainOfSoul\([^\n]*/)?.[0] ?? "";
    expect(call, "定位不到取景那一处 —— 判据会空转").not.toBe("");
    expect(call, "取景要读这一席的魂").toMatch(/type/);
    expect(src, "不许退化成当前世界").not.toMatch(/<InkScene[^>]*:world-id="player\.world\.id"/);
  });

  it("画落在三席里,且不占布局", () => {
    const src = readSource(VIEW);
    const seat = src.match(/v-for="i in SOUL_SLOTS"[\s\S]*?<\/div>\s*<\/div>/)?.[0] ?? "";
    expect(seat, "定位不到器魂三席 —— 判据会空转").not.toBe("");
    expect(seat, "画要落在每一席里").toContain("<InkScene");
    const css = readSource("src/styles/pages/souls.css");
    const cls = src.match(/class="([a-z][a-z0-9-]*__scene)"/)?.[1] ?? "";
    expect(cls, "定位不到画那一层的类名").not.toBe("");
    const rule =
      (src.match(new RegExp(`\\.${cls}\\s*\\{[\\s\\S]*?\\n\\s*\\}`))?.[0] ?? "") ||
      (css.match(new RegExp(`\\.${cls}\\s*\\{[\\s\\S]*?\\n\\s*\\}`))?.[0] ?? "");
    expect(rule, `定位不到 .${cls} 的规则`).not.toBe("");
    expect(rule, "画要脱离流").toMatch(/position:\s*absolute/);
    expect(rule, "画不接指针").toMatch(/pointer-events:\s*none/);
  });
});
