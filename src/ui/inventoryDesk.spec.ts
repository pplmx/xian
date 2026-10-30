import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { readStyleCss } from "@/test/readStyleCss";

const ROOT = resolve(__dirname, "../..");

function source(rel: string): string {
  if (rel === "src/style.css") return readStyleCss();
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("行囊案 · 先盘九佩,再问本批新得与可换", () => {
  it("卷首九佩匣读取同一份席名与佩戴事实,只做不重复读屏的视觉摘要", () => {
    const view = source("src/views/InventoryView.vue");
    const reliquary = source("src/components/inventory/InventoryReliquary.vue");

    expect(view, "行囊卷首要挂九佩匣").toMatch(
      /<template #visual>[\s\S]{0,180}<InventoryReliquary/,
    );
    expect(view, "九佩匣必须真的接进行囊页").toContain(
      'import InventoryReliquary from "@/components/inventory/InventoryReliquary.vue"',
    );
    expect(view, "匣内已佩席由槽位事实现算").toContain(':filled-slots="filledEquipSlots"');
    expect(view, "九席顺序只由页面同一份槽位表提供").toContain(':slots="SLOTS"');
    expect(view, "容量继续读同一枚行囊上限").toContain(':capacity="BAG_CAPACITY"');
    expect(reliquary, "席名只从装备事实源取").toContain("EQUIP_SLOT_NAMES");
    expect(reliquary, "九席必须真的按三乘三排布").toContain("GRID_POINTS.length");
    expect(reliquary, "已佩与空席要有可辨别状态").toContain(
      `:class="{ 'is-filled': node.filled }"`,
    );
    expect(reliquary, "纯视觉摘要不重复读屏正文").toContain('aria-hidden="true"');
  });

  it("本批检点把新得、可换、共鸣与两个管理入口收成一张账", () => {
    const view = source("src/views/InventoryView.vue");
    const briefing =
      view.match(/<section[^>]*data-inventory-overview[\s\S]*?<\/section>/)?.[0] ?? "";

    expect(briefing, "检点账要有独立标题").toContain('class="inventory-briefing__title"');
    expect(briefing, "检点账要报真实行囊件数").toContain(
      ':data-inventory-bag-count="inventory.bagItems.length"',
    );
    expect(briefing, "检点账要报真实新得数").toContain(
      ':data-inventory-new-count="inventory.newItemCount"',
    );
    expect(briefing, "新得入口仍与藏品范围同一份状态").toContain("data-inventory-new-toggle");
    expect(briefing, "新得入口要能看出当前是否只看新得").toContain(
      `:aria-pressed="itemScope === 'new'"`,
    );
    expect(briefing, "可换槽位仍逐槽读取统一换装清单").toContain(
      ':data-inventory-upgrade-slot="row.slot"',
    );
    expect(briefing, "一键换装仍报会动几槽").toContain(':disabled="upgradeRows.length === 0"');
    expect(briefing, "共鸣行仍逐组摊开真实计数").toContain("{{ s.count }}/{{ s.def.required }}");
    expect(briefing, "共鸣仍调用同一套穿齐逻辑").toContain('@click="wearSetOf(s.def.id)"');
    expect(briefing, "智能收纳入口仍在检点账").toContain('@click="smartOpen = true"');
    expect(briefing, "批量分解入口仍在检点账").toContain('@click="decomposeOpen = true"');

    expect(view, "可换槽由核心换装清单唯一计算").toContain(
      "const upgradeRows = computed(() => equipUpgrades(inventory));",
    );
    expect(view, "共鸣计数仍读已佩真值").toContain(
      "const counts = setCounts(inventory.equippedItems);",
    );
    expect(view, "一键换装仍调用核心动作").toContain("const n = equipAllBest(inventory);");
    expect(view, "穿齐一组仍调用核心动作").toContain("const n = equipSetCombo(inventory, setId);");
  });

  it("阅读顺序从检点、九佩走到藏品;丹房先于丹匣,材簿按用途分两组", () => {
    const view = source("src/views/InventoryView.vue");

    const briefingAt = view.indexOf("data-inventory-overview");
    const equipmentAt = view.indexOf("data-inventory-equipment");
    const collectionAt = view.indexOf("data-inventory-total");
    expect(briefingAt, "检点账要有稳定落点").toBeGreaterThan(-1);
    expect(equipmentAt, "九佩要有稳定落点").toBeGreaterThan(briefingAt);
    expect(collectionAt, "全部藏品要排在九佩之后").toBeGreaterThan(equipmentAt);
    expect(view.slice(equipmentAt, collectionAt), "九佩要报真实已佩数").toContain(
      ':hint="`${equippedCount} / ${SLOTS.length} 已佩`"',
    );
    expect(view.slice(collectionAt), "藏品仍保留分批窗口与回翻").toContain(
      'v-for="row in itemPage.visible"',
    );

    const workshopAt = view.indexOf("data-inventory-workshop");
    const pillCabinetAt = view.indexOf('class="inventory-pill-cabinet"');
    expect(workshopAt, "丹房要有稳定落点").toBeGreaterThan(collectionAt);
    expect(pillCabinetAt, "丹匣要排在丹房之后").toBeGreaterThan(workshopAt);
    expect(view.slice(workshopAt, pillCabinetAt), "丹房仍直通开炉与灵草坊").toContain(
      'class="inventory-workshop__grid"',
    );
    expect(view.slice(pillCabinetAt), "丹匣仍逐味读取持有数").toContain(':foot="`×${row.count}`"');

    const craftAt = view.indexOf('data-inventory-material-group="craft"');
    const stockAt = view.indexOf('data-inventory-material-group="stock"');
    expect(craftAt, "炼制之材要有稳定落点").toBeGreaterThan(pillCabinetAt);
    expect(stockAt, "修行所积要排在炼制之后").toBeGreaterThan(craftAt);
    expect(view, "材簿分组键继续读资源事实源").toContain("RESOURCE_LABELS.herb");
    expect(view, "材簿按同一组键分为两组").toContain(
      "materialGrid.value.filter((m) => CRAFT_KEYS.includes(m.name))",
    );
  });

  it("手机上检点单列,360 起并读,220 以下把九佩、丹房与材簿放开", () => {
    const css = source("src/style.css");
    const start = css.indexOf("/*\n   * 行囊案");
    const end = css.indexOf("/*\n * 开关(.toggle-ink)", start);
    const inventoryCss = css.slice(start, end);

    expect(start, "行囊样式段要能定位到").toBeGreaterThan(-1);
    expect(end, "行囊样式段要有明确结尾").toBeGreaterThan(start);
    expect(inventoryCss).toMatch(
      /\.inventory-briefing__sheet\s*\{[\s\S]{0,180}grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
    expect(inventoryCss).toMatch(
      /\.inventory-equipment__grid\s*\{[\s\S]{0,120}repeat\(3, minmax\(0, 1fr\)\)/,
    );
    expect(inventoryCss).toMatch(
      /\.inventory-briefing__new-toggle\s*\{[\s\S]{0,420}white-space:\s*nowrap/,
    );
    expect(inventoryCss).toMatch(
      /@media \(min-width: 360px\)\s*\{[\s\S]{0,260}\.inventory-briefing__sheet\s*\{[\s\S]{0,150}minmax\(0, 0\.88fr\) minmax\(0, 1\.12fr\)/,
    );
    expect(inventoryCss).toMatch(
      /@media \(min-width: 960px\)\s*\{[\s\S]{0,420}\.inventory-materials__groups\s*\{[\s\S]{0,120}repeat\(2, minmax\(0, 1fr\)\)/,
    );
    expect(inventoryCss).toMatch(
      /@media \(max-width: 220px\)\s*\{[\s\S]{0,1100}\.inventory-equipment__grid,[\s\S]{0,120}\.inventory-workshop__grid,[\s\S]{0,120}\.inventory-materials__groups\s*\{[\s\S]{0,100}grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
    expect(inventoryCss).toMatch(
      /@media \(max-width: 220px\)\s*\{[\s\S]{0,1400}\.inventory-collection__grid,[\s\S]{0,120}\.inventory-pill-cabinet__grid,[\s\S]{0,120}\.inventory-material-group__grid\s*\{[\s\S]{0,100}repeat\(2, minmax\(0, 1fr\)\)/,
    );
  });
});
