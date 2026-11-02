import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { readStyleCss } from "@/test/readStyleCss";
import { artifactDeskSummary, planArtifactPlacement } from "@/core/artifactDesk";
import { inventoryChapter, inventoryChapters } from "@/ui/inventoryDesk";

const ROOT = resolve(__dirname, "../..");

function source(rel: string): string {
  if (rel === "src/style.css") return readStyleCss();
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("行囊案 · 先盘九佩,再问本批新得与可换", () => {
  it("行囊四册只由同一份装配表给出顺序与章名", () => {
    expect(inventoryChapters().map(({ key, index, title }) => ({ key, index, title }))).toEqual([
      { key: "briefing", index: "壹", title: "今日检点" },
      { key: "seats", index: "贰", title: "九佩" },
      { key: "collection", index: "叁", title: "藏品" },
    ]);
    expect(
      inventoryChapters("pill").map(({ key, index, title }) => ({ key, index, title })),
    ).toEqual([
      { key: "workshop", index: "壹", title: "丹房" },
      { key: "cabinet", index: "贰", title: "丹匣" },
    ]);
    expect(
      inventoryChapters("material").map(({ key, index, title }) => ({ key, index, title })),
    ).toEqual([
      { key: "craft", index: "壹", title: "炉材" },
      { key: "stock", index: "贰", title: "账材" },
    ]);
    expect(
      inventoryChapters("artifact").map(({ key, index, title }) => ({ key, index, title })),
    ).toEqual([{ key: "artifact", index: "壹", title: "法宝" }]);
    expect(inventoryChapter("seats")).toMatchObject({
      index: "贰",
      hint: "九席随身,空悬与可换各归其位",
    });

    const copy = inventoryChapters();
    copy[0]!.title = "改过的章名";
    expect(inventoryChapter("briefing").title).toBe("今日检点");
    expect(() => inventoryChapter("unknown" as never)).toThrow("unknown inventory chapter");
  });

  it("法宝阵账把位次、可炼、欠料与满重收成一份真数", () => {
    const summary = artifactDeskSummary(
      [
        { equipped: true, hasUpgrade: false, affordable: false },
        { equipped: true, hasUpgrade: true, affordable: true },
        { equipped: false, hasUpgrade: true, affordable: false },
      ],
      2,
    );

    expect(summary).toEqual({
      total: 3,
      carried: 2,
      stored: 1,
      slots: 2,
      emptySlots: 0,
      ready: 1,
      short: 1,
      maxed: 1,
    });
    expect(
      artifactDeskSummary([{ equipped: true, hasUpgrade: true, affordable: false }], 3),
      "位次未满时,空位与欠料要分开报",
    ).toMatchObject({ carried: 1, stored: 0, slots: 3, emptySlots: 2, short: 1 });
    expect(artifactDeskSummary([], 0), "坏数值也要收成可读的零账").toEqual({
      total: 0,
      carried: 0,
      stored: 0,
      slots: 0,
      emptySlots: 0,
      ready: 0,
      short: 0,
      maxed: 0,
    });
  });

  it("法宝满位时先把会让位的那一件算清", () => {
    expect(planArtifactPlacement(["af_a", "af_b"], "af_c", 2)).toEqual({
      action: "replaced",
      removedId: "af_a",
      removedIndex: 0,
    });
    expect(planArtifactPlacement(["af_a"], "af_c", 2)).toEqual({
      action: "equipped",
      removedId: null,
      removedIndex: null,
    });
    expect(planArtifactPlacement(["af_a", "af_b"], "af_b", 2)).toEqual({
      action: "unequipped",
      removedId: "af_b",
      removedIndex: 1,
    });
    expect(planArtifactPlacement([], "af_c", 0)).toEqual({
      action: "blocked",
      removedId: null,
      removedIndex: null,
    });
  });

  it("卷首容量总印读取同一份席名与佩戴事实,不把精确件数再说一遍", () => {
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
    expect(reliquary, "总印只画容量弧,不再写第二份精确件数").not.toContain(
      "{{ bagCount }} / {{ capacity }}",
    );
    expect(view, "卷首元信息不再与检点账重复报已佩数").not.toContain("已佩 <strong");
  });

  it("今日检点把新得、可换、共鸣与两个管理入口收成首章", () => {
    const view = source("src/views/InventoryView.vue");
    const briefing =
      view.match(/<section[^>]*data-inventory-overview[\s\S]*?<\/section>/)?.[0] ?? "";

    expect(briefing, "检点账改用行囊续卷章首").toContain("<InventoryChapterHead");
    expect(briefing, "检点章序号读装配表").toContain(':index="briefingChapter.index"');
    expect(briefing, "检点账要有独立标题").toContain(':title="briefingChapter.title"');
    expect(briefing, "标题后的副读仍读装配表").toContain(':hint="briefingChapter.hint"');
    expect(briefing, "两个管理入口收进章节头动作席").toMatch(
      /<template #actions>[\s\S]{0,220}aria-label="智能收纳设置"/,
    );
    expect(briefing, "旧的自绘标题不再保留").not.toContain("inventory-briefing__title");
    expect(briefing, "旧的第二层卡纸不再保留").not.toContain("inventory-briefing__sheet");
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
    expect(briefing, "一键换装只留行内短笔,不再铺满整张账纸").not.toContain(
      "inventory-briefing__wear inventory",
    );

    expect(view, "可换槽由核心换装清单唯一计算").toContain(
      "const upgradeRows = computed(() => equipUpgrades(inventory));",
    );
    expect(view, "共鸣计数仍读已佩真值").toContain(
      "const counts = setCounts(inventory.equippedItems);",
    );
    expect(view, "一键换装仍调用核心动作").toContain("const n = equipAllBest(inventory);");
    expect(view, "穿齐一组仍调用核心动作").toContain("const n = equipSetCombo(inventory, setId);");
  });

  it("装备签从今日检点、九佩走到藏品", () => {
    const view = source("src/views/InventoryView.vue");
    const equipmentStart = view.indexOf('data-inventory-register-tab="equip"');
    const pillStart = view.indexOf('data-inventory-register-tab="pill"');
    const equipmentView = view.slice(equipmentStart, pillStart);

    expect(equipmentStart).toBeGreaterThan(-1);
    expect(pillStart).toBeGreaterThan(equipmentStart);
    expect(equipmentView).toContain('class="inventory-register folio-span-all"');
    expect(equipmentView).toContain("data-inventory-register");
    const briefingAt = equipmentView.indexOf("data-inventory-overview");
    const equipmentAt = equipmentView.indexOf("data-inventory-equipment");
    const collectionAt = equipmentView.indexOf("data-inventory-total");
    expect(briefingAt, "检点账要有稳定落点").toBeGreaterThan(-1);
    expect(equipmentAt, "九佩要有稳定落点").toBeGreaterThan(briefingAt);
    expect(collectionAt, "全部藏品要排在九佩之后").toBeGreaterThan(equipmentAt);
    expect(equipmentView.slice(equipmentAt, collectionAt), "九佩要报真实已佩数").toContain(
      ':fact="`${equippedCount} / ${SLOTS.length} 已佩`"',
    );
    expect(
      [...equipmentView.matchAll(/data-inventory-chapter="([^"]+)"/g)].map((match) => match[1]),
      "三章必须按检点、九佩、藏品续排",
    ).toEqual(["briefing", "seats", "collection"]);
    expect(equipmentView.slice(collectionAt), "藏品仍保留分批窗口与回翻").toContain(
      'v-for="row in itemPage.visible"',
    );
    expect(equipmentView, "藏品不再套回独立装备卡").toContain("InventoryCollectionRow");
    expect(equipmentView, "藏品行仍接收同一份新得判据").toContain(':is-new="row.isNew"');
  });

  it("丹药、材料与法宝签也收进同一张行囊续卷,不再借通用节题或旧卡壳", () => {
    const view = source("src/views/InventoryView.vue");
    const layout = source("scripts/layout-check.mjs");
    const pillStart = view.indexOf('data-inventory-register-tab="pill"');
    const materialStart = view.indexOf('data-inventory-register-tab="material"');
    const artifactStart = view.indexOf('data-inventory-register-tab="artifact"');
    const detailStart = view.indexOf("<!-- 丹药详情 -->");
    const pill = view.slice(pillStart, materialStart);
    const material = view.slice(materialStart, artifactStart);
    const artifact = view.slice(artifactStart, detailStart);

    expect(pillStart).toBeGreaterThan(-1);
    expect(materialStart).toBeGreaterThan(pillStart);
    expect(artifactStart).toBeGreaterThan(materialStart);
    expect(detailStart).toBeGreaterThan(artifactStart);
    expect(view, "通用章节题头已从行囊页退场").not.toContain("<SectionTitle");
    expect(view, "通用章节题头 import 也已撤掉").not.toContain(
      'import SectionTitle from "@/components/common/SectionTitle.vue"',
    );
    expect(
      view.match(/data-inventory-register-tab="(?:equip|pill|material|artifact)"/g),
    ).toHaveLength(4);
    expect(view.match(/<InventoryChapterHead\b/g), "四签八章各用同一枚章首").toHaveLength(8);

    expect(
      [...pill.matchAll(/data-inventory-chapter="([^"]+)"/g)].map((match) => match[1]),
    ).toEqual(["workshop", "cabinet"]);
    expect(
      [...material.matchAll(/data-inventory-chapter="([^"]+)"/g)].map((match) => match[1]),
    ).toEqual(["craft", "stock"]);
    expect(
      [...artifact.matchAll(/data-inventory-chapter="([^"]+)"/g)].map((match) => match[1]),
    ).toEqual(["artifact"]);

    expect(pill, "丹房章真值读丹方与当前主修灵草持有").toContain(':fact="pillWorkshopFact"');
    expect(pill, "丹匣章真值读同一份丹味与总枚数").toContain(':fact="pillCabinetFact"');
    expect(pill, "丹房仍直通开炉与灵草坊").toContain('class="inventory-workshop__grid"');
    expect(pill, "丹房入口不重报章首已有的丹方与灵草数").not.toContain(
      "已知丹方 ${recipes.length}",
    );
    expect(pill, "丹匣仍逐味读取持有数").toContain(':foot="`×${row.count}`"');
    expect(pill, "丹药格子改用账页式格").toContain("ledger");
    expect(pill, "旧丹房卡片壳已撤").not.toContain("inventory-workshop__card");

    expect(material, "炉材章真值读同一份材料分组").toContain(
      ':fact="`${craftMaterials.length} 类`"',
    );
    expect(material, "账材章真值读同一份材料分组").toContain(
      ':fact="`${stockMaterials.length} 类`"',
    );
    expect(view, "材簿分组键继续读资源事实源").toContain("RESOURCE_LABELS.herb");
    expect(view, "材簿按同一组键分为两组").toContain(
      "materialGrid.value.filter((m) => CRAFT_KEYS.includes(m.name))",
    );
    expect(material, "旧分组卡与重复小标题已撤").not.toContain("inventory-material-group__head");

    expect(artifact, "法宝章真值直读库存与随身数").toContain(':fact="artifactChapterFact"');
    expect(artifact, "法宝面板仍挂在章内").toContain("<ArtifactPanel />");
    expect(view, "丹匣总枚数由同一份丹味清单归总").toContain(
      "const pillTotal = computed(() => pillRows.value.reduce((sum, row) => sum + row.count, 0));",
    );
    expect(view, "丹匣章真值不另造一份持有数").toContain(
      "const pillCabinetFact = computed(() => `${pillRows.value.length} 味 · ${pillTotal.value} 枚`);",
    );
    expect(layout, "真浏览器门要逐签核对同一册续卷").toContain(
      "async function taskInventoryTabRegisters()",
    );
    expect(layout, "新门要挂进排版自检清单").toContain(
      '["背包四签同住一册续卷", taskInventoryTabRegisters]',
    );
  });

  it("藏品行仍是单一按钮,截断之外的状态都进可访问名", () => {
    const row = source("src/components/inventory/InventoryCollectionRow.vue");

    expect(row, "清单行只保留一个按钮").toMatch(/^<template>\s*<button/m);
    expect(row, "每行带稳定 uid 给分页与焦点复用").toContain(':data-uid="item.uid"');
    expect(row, "新得仍用稳定属性接运行时门").toContain(
      ":data-equipment-new=\"isNew ? 'true' : undefined\"",
    );
    expect(row, "完整可访问名包含佩、新、锁、共鸣与标记").toContain("佩戴中");
    expect(row).toContain("本次新得");
    expect(row).toContain("已锁定");
    expect(row).toContain("共鸣${setName.value}");
    expect(row).toContain("标记${props.item.note}");
    expect(row, "清单行不订阅整只库存 store").not.toContain('from "@/stores/inventory"');
  });

  it("桌面把检点、九佩与藏品续在同一册,九佩和藏品仍左右并读", () => {
    const view = source("src/views/InventoryView.vue");
    const artifacts = source("src/components/inventory/ArtifactPanel.vue");
    const css = source("src/styles/pages/inventory.css");

    expect(view, "行囊根页要接入双页网格").toContain(
      '<div class="folio-page folio-page--stack stagger-in">',
    );
    expect(view, "页签跨两栏且保留原页签状态").toContain(
      'class="inventory-tabs folio-span-all mt-3"',
    );
    expect(view, "三章同住一张开口续卷").toContain("data-inventory-register");
    expect(view, "九佩与藏品在续卷下半并读").toContain('class="inventory-register__lower"');
    expect(view, "九佩有稳定落点").toMatch(
      /class="inventory-register__chapter inventory-equipment"[\s\S]{0,100}?data-inventory-equipment/,
    );
    expect(view, "藏品有稳定落点").toMatch(
      /class="inventory-register__chapter inventory-collection"/,
    );
    expect(view, "丹房与丹匣同排双页").toContain("inventory-workshop");
    expect(view, "丹匣与丹房同排且仍读同一份持有数").toMatch(
      /class="inventory-register__chapter inventory-pill-cabinet"[\s\S]{0,100}?data-inventory-pill-cabinet/,
    );
    expect(view, "材簿两章同住一件续卷").toContain('data-inventory-register-tab="material"');
    expect(view, "法宝册要有统一章节头与跨栏落点").toContain(
      'class="inventory-register__chapter inventory-artifacts"',
    );
    expect(view).toContain(':title="artifactChapter.title"');
    expect(artifacts, "法宝卡改挂可响应的语义清单").toContain(
      '<div class="inventory-artifact-list">',
    );
    expect(css).toMatch(
      /@media \(min-width: 960px\)\s*\{[\s\S]*\.inventory-register__lower\s*\{[\s\S]{0,120}minmax\(0, 0\.86fr\) minmax\(0, 1\.14fr\)/,
    );
    expect(css).toMatch(
      /\.inventory-artifact-list\s*\{[\s\S]{0,160}grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
    expect(css).toMatch(/\.inventory-artifact-list\s*\{[\s\S]{0,160}gap:\s*0;/);
    expect(css).toMatch(
      /\.app-shell\[data-folio-layout="spread"\]\s+\.inventory-pill-cabinet__grid\s+\.inventory-cell--ledger:nth-child\(3n\)\s*\{\s*border-right:\s*0;/,
    );
    expect(css).toMatch(
      /@media \(min-width: 960px\)\s*\{[\s\S]*\.inventory-register__lower--material\s*\{[\s\S]{0,120}repeat\(2, minmax\(0, 1fr\)\)/,
    );
  });

  it("法宝册收成一页阵位长账,空态只留一处", () => {
    const panel = source("src/components/inventory/ArtifactPanel.vue");
    const css = source("src/style.css");

    expect(panel, "阵账与全册要有同一处稳定落点").toContain("data-artifact-register");
    expect(panel, "法宝册先要有稳定阵账落点").toContain("data-artifact-overview");
    expect(panel, "阵账读数走 core 的同一份汇总").toContain("artifactDeskSummary");
    expect(panel, "阵账逐位列出随身法宝").toContain("data-artifact-seat");
    expect(panel, "席位要带出可核对的法宝 id").toContain("data-artifact-seat-id");
    expect(panel, "可炼 / 欠料 / 满重要各有稳定读数").toContain('data-artifact-summary="ready"');
    expect(panel).toContain('data-artifact-summary="short"');
    expect(panel).toContain('data-artifact-summary="maxed"');
    expect(panel, "全册行要把被动、神通与下一重分行摊开").toContain("artifact-row__ledger");
    expect(panel, "全册不再逐件套 card-ink 卡壳").not.toContain("card-ink");
    expect(panel, "空册只由同一个阵账说明,不再另铺第二块空态").not.toContain(
      'class="artifact-empty"',
    );
    expect(panel, "空册标记要跟着同一处阵账落点").toContain(":data-artifact-empty=");
    expect(panel, "祭炼规则与法宝位门槛仍读同一组常数").toContain("ARTIFACT_LEVEL_BONUS");
    expect(panel).toContain("ARTIFACT_MAX_SLOTS");
    expect(panel).toContain("artifactUnlockRealm");
    expect(panel, "满位换入必须走与 store 同一份让位计划").toContain("planArtifactPlacement");
    expect(panel, "按下前要先点名会被替下的法宝").toContain("data-artifact-swap");
    expect(panel, "成功回执同样点名已替下的法宝").toContain("已替下 法");
    expect(panel, "两笔炼化代价各成不拆词的账段").toContain("artifact-row__cost-segment");
    expect(panel, "欠料差额也不许把资源词拆行").toContain("artifact-row__shortfall-segment");
    expect(css, "法宝位只沿阵账线分栏,不再各自套四边框").toMatch(
      /\.artifact-desk__seat\s*\{[\s\S]{0,420}border:\s*0;[\s\S]{0,220}border-radius:\s*0;[\s\S]{0,220}background:\s*transparent;/,
    );
    expect(css, "全册每件是连续账行而不是纸卡").toMatch(
      /\.artifact-row\s*\{[\s\S]{0,520}border:\s*0;[\s\S]{0,220}border-top:\s*1px solid/,
    );
  });

  it("手机上检点仍是一册账,360 起读数并读,220 以下整册退单列", () => {
    const css = source("src/style.css");
    const start = css.indexOf("/*\n   * 行囊续卷");
    const end = css.indexOf("/*\n * 开关(.toggle-ink)", start);
    const inventoryCss = css.slice(start, end);

    expect(start, "行囊续卷样式段要能定位到").toBeGreaterThan(-1);
    expect(end, "行囊样式段要有明确结尾").toBeGreaterThan(start);
    expect(inventoryCss).toMatch(/\.inventory-register\s*\{[\s\S]{0,180}border-top:\s*1px solid/);
    expect(inventoryCss).toMatch(
      /\.inventory-equipment__grid\s*\{[\s\S]{0,120}repeat\(3, minmax\(0, 1fr\)\)/,
    );
    expect(inventoryCss, "九席是账线切开的格子,不是九张同权卡").toMatch(
      /\.inventory-seat\s*\{[\s\S]{0,420}border-radius:\s*0/,
    );
    expect(inventoryCss, "藏品改成连续清单行").toMatch(
      /\.inventory-item\s*\{[\s\S]{0,420}border-radius:\s*0/,
    );
    expect(inventoryCss, "主行动只占账行一段").toMatch(
      /\.inventory-briefing__wear\s*\{[\s\S]{0,260}max-width:\s*72%/,
    );
    expect(inventoryCss, "丹房入口退成账行而非四边卡").toMatch(
      /\.inventory-workshop__entry\s*\{[\s\S]{0,420}border-radius:\s*0;[\s\S]{0,180}background:\s*transparent/,
    );
    expect(inventoryCss, "材簿分组不再套第二层卡壳").toMatch(
      /\.inventory-material-group\s*\{\s*min-width:\s*0;\s*\}/,
    );
    expect(inventoryCss, "丹药与材料格只用账页分栏线").toMatch(
      /\.inventory-cell--ledger\s*\{[\s\S]{0,360}border-radius:\s*0;[\s\S]{0,160}background:\s*transparent/,
    );
    expect(inventoryCss).toMatch(
      /@media \(min-width: 360px\)\s*\{[\s\S]{0,260}\.inventory-briefing__summary\s*\{[\s\S]{0,150}repeat\(3, minmax\(0, 1fr\)\)/,
    );
    expect(inventoryCss).toMatch(
      /@media \(min-width: 960px\)\s*\{[\s\S]{0,420}\.inventory-register__lower--material\s*\{[\s\S]{0,120}repeat\(2, minmax\(0, 1fr\)\)/,
    );
    const tinyStart = inventoryCss.indexOf("@media (max-width: 220px)");
    const tinyCss = inventoryCss.slice(tinyStart);
    expect(tinyStart, "220 以下的窄档要能定位到").toBeGreaterThan(-1);
    expect(tinyCss).toMatch(
      /\.inventory-briefing__summary,[\s\S]{0,180}\.inventory-register__lower,[\s\S]{0,180}\.inventory-equipment__grid,[\s\S]{0,120}\.inventory-workshop__grid\s*\{[\s\S]{0,100}grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
    expect(tinyCss).toMatch(
      /\.inventory-pill-cabinet__grid,[\s\S]{0,120}\.inventory-material-group__grid\s*\{[\s\S]{0,100}repeat\(2, minmax\(0, 1fr\)\)/,
    );
    expect(tinyCss, "藏品行在极窄档仍是一列清单").toMatch(
      /\.inventory-collection__grid\s*\{[\s\S]{0,120}grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
    expect(tinyCss, "章内真值在 200% 缩放下退到章名下方").toMatch(
      /\.inventory-chapter-head__tail\s*\{[\s\S]{0,120}grid-column:\s*1/,
    );
  });
});
