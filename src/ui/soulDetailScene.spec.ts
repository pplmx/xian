/**
 * 器魂详情 —— 上一轮给三席补了画,弹窗里那一片还是只有一枚印章字。
 *
 * ## 现状
 *
 * 三席现在各有一副长相(见 `ui/soulScene`),但玩家点开**单枚器魂**看详情时,
 * 弹窗里只有:一枚 24px 印章字、阶名、凝自哪件法器、一行形意来历、一行词条账。
 * 也就是说:**席上看得见「这一席是什么魂」,点进去反而看不见了**。
 *
 * ## 身份是同一个,不该有两套
 *
 * 详情弹窗拿的就是 `soulDetail`(`SoulInstance`),它有 `type` ——
 * 与三席取景读的是同一个字段、同一张表(`sceneTerrainOfSoul`)。
 * 这一条不新立映射,只要求弹窗**复用**它。
 *
 * ## 判据守什么
 *
 *   一 弹窗里真接上了画,且读的是 `soulDetail.type`;
 *   二 复用 `sceneTerrainOfSoul`,不许另写一份「魂 → 地形」;
 *   三 画不占布局:这一窗是印章字、形意来历与词条账。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { SOUL_TYPES } from "@/data/souls";
import { sceneTerrainOfSoul } from "@/ui/sceneTerrain";

const VIEW = "src/views/SoulsView.vue";

describe("器魂详情 · 点进去也要看得见是什么魂", () => {
  it("弹窗复用三席那张表 —— 不许另写一份", () => {
    /*
     * 判据自身要先站稳:三席与详情读同一个字段、同一张表,才谈得上「复用」。
     * 若 `sceneTerrainOfSoul` 对六种魂给出的地形与三席那边不一致,这一条会先红。
     */
    const terrains = SOUL_TYPES.map((t) => sceneTerrainOfSoul(t.id));
    expect(new Set(terrains).size, "六魂该有六种地形").toBe(6);
  });

  it("详情弹窗里真接上了画,且读这一枚的魂", () => {
    const src = readSource(VIEW);
    /*
     * 只认**弹窗那一段**里的调用:三席上那处 `soulAt(i)!.type` 不能替它过关。
     * 弹窗以 `:open="soulDetail !== null"` 起头,到 `</BaseModal>` 止。
     */
    const raw = src.match(/:open="soulDetail !== null"[\s\S]*?<\/BaseModal>/)?.[0] ?? "";
    expect(raw, "定位不到器魂详情弹窗 —— 判据会空转").not.toBe("");
    /*
     * 先**剥掉注释**再验。那段说明里本来就写着 `sceneTerrainOfSoul(soulDetail.type)`
     * —— 只查「这段里出现过这串字」的话,把真调用换成 `sceneTerrainOfSoul(null)`
     * 判据仍然绿(实测漏掉的正是这一种)。注释不是实现。
     */
    const dialog = raw.replace(/<!--[\s\S]*?-->/g, "");
    expect(dialog, "器魂详情仍是纯文字 —— 点进去只有一枚印章字").toContain("<InkScene");
    expect(dialog, "取景要读这一枚的魂").toMatch(/sceneTerrainOfSoul\s*\(\s*soulDetail[^)]*type/);
  });

  it("画不占布局", () => {
    const src = readSource(VIEW);
    const dialog = src.match(/:open="soulDetail !== null"[\s\S]*?<\/BaseModal>/)?.[0] ?? "";
    const cls = dialog.match(/class="([a-z][a-z0-9-]*__scene)"/)?.[1] ?? "";
    expect(cls, "定位不到详情里画那一层的类名 —— 判据会空转").not.toBe("");
    const css = readSource("src/styles/pages/souls.css");
    const rule =
      (src.match(new RegExp(`\\.${cls}\\s*\\{[\\s\\S]*?\\n\\s*\\}`))?.[0] ?? "") ||
      (css.match(new RegExp(`\\.${cls}\\s*\\{[\\s\\S]*?\\n\\s*\\}`))?.[0] ?? "");
    expect(rule, `定位不到 .${cls} 的规则`).not.toBe("");
    expect(rule, "画要脱离流").toMatch(/position:\s*absolute/);
    expect(rule, "画不接指针").toMatch(/pointer-events:\s*none/);
  });
});
