import { describe, expect, it } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { useBrewing } from "./useBrewing";
import { useInventoryStore } from "@/stores/inventory";
import { useLoreStore } from "@/stores/lore";
import { pillDef } from "@/data/pills";
import { recipeCraft } from "@/data/crafting";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * 炉前的存货账 —— 方子行亮「存 N」,增益丹亮「药力状态」。
 *
 * 缺口:开炉弹窗此前只摊「把握 / 双成 / 代价 / 短差」,不摊行囊里已存几枚 ——
 * 玩家看着 92% 把握按下炼制,行囊里可能已躺着 8 枚增益丹且药力顶满,
 * 炼出来就是白占一格。服用侧(丹匣详情)早有 buffOverflowOf 置灰,
 * 炼制侧却是半盲:决策的两半(炼 vs 不炼)只给了一半的数。
 *
 * 判据同源:存货读 inventory.pills(与丹匣同一份账,不另数一遍);
 * 顶满读 buffOverflowOf + 响应式钟 now.value(与服用侧/修行快捷卡同一把尺、同一把钟)。
 */

/** 让某方子「已知」:与 pillBatch.spec 同一播种手法(addRecipeMastery + 材料认知) */
function knowRecipe(id: string): void {
  const lore = useLoreStore();
  lore.addRecipeMastery(id, 0.8);
  for (const mid of recipeCraft(pillDef(id)!)!.materials) lore.advanceLore(mid, 3);
}

describe("炉前存货账(存 N · 药力状态)", () => {
  it("方子行带 stock:读 inventory.pills,与丹匣同源,不另数一遍", () => {
    setActivePinia(createPinia());
    const inv = useInventoryStore();
    const { recipes } = useBrewing();
    knowRecipe("p_ningshen");
    expect(recipes.value.map((r) => r.def.id)).toContain("p_ningshen");

    const row = () => recipes.value.find((r) => r.def.id === "p_ningshen")!;
    // 存货为 0 时 stock = 0;存 3 枚后 stock = 3 —— 读的是同一份账
    expect(row().stock).toBe(inv.pills["p_ningshen"] ?? 0);
    inv.addPill("p_ningshen", 3);
    expect(row().stock).toBe(3);
    expect(row().stock).toBe(inv.pills["p_ningshen"] ?? 0);
    // 增益丹(凝神丹)的药力状态字段存在且取值合法;即时丹为 null(无药力可言)
    expect(["none", "partial", "full"]).toContain(row().overflow);
  });

  it("顶满判据读响应式钟 —— 药效到期后「已顶」自己亮回来,不许停在一次读出的灰里", () => {
    // 与 c5cadb2(丹药顶满判据随钟走)同一条纪律:这里的判定必须读 useNow().value。
    // 源码钉:useBrewing 的行构造器里不许出现一次性 Date.now() 作为顶满判据。
    setActivePinia(createPinia());
    const src = readFileSync(join(__dirname, "useBrewing.ts"), "utf8");
    expect(src).toContain("buffOverflowOf(cult.buffs, def.buffId, now.value)");
    expect(src, "useBrewing 引入 useNow 作响应式钟").toContain('from "@/composables/useNow"');
    // 顶满/将顶的措辞与服用侧同族,不另起一套黑话
    expect(src).toContain("已顶");
    expect(src).toContain("将顶");
  });
});
