/**
 * 定下道途 —— 此世最后一次读到它,而那一屏只有字。
 *
 * ## 通病:同一条信息,后一步比前一步更薄
 *
 * 道途选择页的道途列表里,每一条都摊着名、desc、ruleText、deepText(章法)。
 * 点「定下」之后蹦出来的确认弹窗——**此世最后一次能读到这处道途的地方**
 * (点下去就锁到转世)——此前只有名、desc、规则与章法,一笔画都没有。
 *
 * 这不是新问题,`docs/design.md` 里记着同一个形状出现过多次(器魂三席看得见、
 * 点进详情看不见)。上一轮刚给器魂详情补上,这一轮轮到道途确认。
 *
 * ## 身份是现成的
 *
 * 全站已有 `sceneTerrainOfDao(daoId)`(八条道途各一片地,玄枢图与道途选择读同一份),
 * 确认弹窗拿的就是 `pendingDao`,它有 `id`。故这一条不新立映射,只要求复用。
 *
 * ## 判据守什么
 *
 *   一 确认弹窗里真接上了画,且读的是 `pendingDao.id`;
 *   二 复用 `sceneTerrainOfDao`,不许另写一份;
 *   三 画不占布局:这一窗是名、desc、规则、章法与两个按钮。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { DAO_PATHS } from "@/data/endgame";
import { sceneTerrainOfDao, SCENE_TERRAINS } from "@/ui/sceneTerrain";

const VIEW = "src/views/CelestialView.vue";

describe("定下道途 · 这一屏也要有画", () => {
  it("八条道途各一片地(判据的前提:这张表分得开)", () => {
    const terrains = DAO_PATHS.map((d) => sceneTerrainOfDao(d.id));
    for (const t of terrains) expect(SCENE_TERRAINS).toContain(t);
    /*
     * 不要求八条全不同(地只有九种,而道途的意象有两处确实相近),
     * 但至少要铺开到五种 —— 否则「按道途取景」这句话本身没有意义。
     */
    expect(
      new Set(terrains).size,
      "八条道途取景只铺开不到五种 —— 按道途取景名不副实",
    ).toBeGreaterThanOrEqual(5);
  });

  it("确认弹窗里真接上了画,且读这一条道途", () => {
    const src = readSource(VIEW);
    const raw = src.match(/:open="pendingDao !== undefined"[\s\S]*?<\/BaseModal>/)?.[0] ?? "";
    expect(raw, "定位不到「定下道途」确认弹窗 —— 判据会空转").not.toBe("");
    /* 先剥注释再验:说明里会引用那段写法(上一轮正是在这里栽过一次) */
    const dialog = raw.replace(/<!--[\s\S]*?-->/g, "");
    expect(dialog, "确认弹窗仍是纯文字 —— 此世最后一次读到它,却没有画").toContain("<InkScene");
    expect(dialog, "取景要读这一条道途").toMatch(/sceneTerrainOfDao\s*\(\s*pendingDao[^)]*id/);
  });

  it("画不占布局", () => {
    const src = readSource(VIEW);
    const raw = src.match(/:open="pendingDao !== undefined"[\s\S]*?<\/BaseModal>/)?.[0] ?? "";
    const dialog = raw.replace(/<!--[\s\S]*?-->/g, "");
    const cls = dialog.match(/class="([a-z][a-z0-9-]*__scene)"/)?.[1] ?? "";
    expect(cls, "定位不到那一层画的类名 —— 判据会空转").not.toBe("");
    const css = readSource("src/styles/pages/celestial.css");
    const rule =
      (src.match(new RegExp(`\\.${cls}\\s*\\{[\\s\\S]*?\\n\\s*\\}`))?.[0] ?? "") ||
      (css.match(new RegExp(`\\.${cls}\\s*\\{[\\s\\S]*?\\n\\s*\\}`))?.[0] ?? "");
    expect(rule, `定位不到 .${cls} 的规则`).not.toBe("");
    expect(rule, "画要脱离流").toMatch(/position:\s*absolute/);
    expect(rule, "画不接指针").toMatch(/pointer-events:\s*none/);
  });
});
