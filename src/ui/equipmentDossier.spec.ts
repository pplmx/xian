import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");

function source(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("器评帖 · 装备详情先给身份与换装结论", () => {
  const dialog = source("src/components/equipment/EquipmentDetailDialog.vue");
  const candidates = source("src/components/inventory/SlotCandidatesDialog.vue");

  it("卷首摊开品阶、器形与战力差,不用自己从三围里心算", () => {
    expect(dialog).toContain("data-equipment-hero");
    expect(dialog).toContain("data-equipment-power");
    expect(dialog).toContain("本件战力");
    expect(dialog).toContain("equipPowerComparison");
    expect(dialog).toContain("qualityTextColor");
    expect(dialog).toContain("<QualitySeal");
  });

  it("工坊回到可滚正文,页脚只留随身动作", () => {
    const workshopAt = dialog.indexOf("data-equipment-workshop");
    const footerAt = dialog.indexOf("<template #footer>");

    expect(workshopAt, "工坊要有稳定落点").toBeGreaterThan(-1);
    expect(footerAt, "页脚动作区要在工坊之后").toBeGreaterThan(workshopAt);
    expect(dialog.slice(footerAt), "重铸长账不该继续占住页脚").not.toContain("<EquipReforgePanel");
    expect(dialog.slice(footerAt), "页脚仍要保留分解二步确认").toContain("<EquipDecomposePanel");
  });

  it("器评帖在弹窗里收成一册开口长卷,器首、战力、器性与工坊不各套四边框", () => {
    const css = source("src/styles/pages/inventory.css");
    const layout = source("scripts/layout-check.mjs");
    const rule = (selector: string) =>
      css.match(new RegExp(`${selector.replaceAll(".", "\\.")}\\s*\\{[\\s\\S]*?\\}`))?.[0] ?? "";
    const hero = rule(".equip-dossier__hero");
    const power = rule(".equip-dossier__power");
    const sheet = rule(".equip-dossier__sheet");
    const ledger = rule(".equip-dossier__line-ledger");
    const workshop = rule(".equip-dossier__workshop");

    expect(hero, "器首撤掉四边框").toMatch(/border:\s*0;/);
    expect(hero, "品阶只由左侧短笔落印").toMatch(/border-left:\s*3px solid/);
    expect(css, "器首不再补第二道内角线").not.toContain(".equip-dossier__hero::after");
    for (const [name, section] of [
      ["战力", power],
      ["器性", sheet],
      ["流派旧账", ledger],
      ["工坊", workshop],
    ] as const) {
      expect(section, `${name}撤掉四边框`).toMatch(/border:\s*0;/);
      expect(section, `${name}不铺实底`).toMatch(/background:\s*(?:transparent|linear-gradient)/);
    }
    expect(power, "战力只留上下账线").toMatch(/border-block:\s*1px solid/);
    expect(sheet, "器性沿上账线续排").toMatch(/border-top:\s*1px solid/);
    expect(ledger, "流派旧账沿上账线续排").toMatch(/border-top:\s*1px solid/);
    expect(workshop, "工坊只留器色上缘").toMatch(/border-top:\s*2px solid/);
    expect(layout, "真浏览器要核器评帖不再逐段套框").toContain("[data-equipment-dossier]");
  });

  it("工坊展开的重铸、自动重铸与词条转移都沿账线续排,不再套第二层四边卡", () => {
    const css = source("src/styles/pages/inventory.css");
    const reforge = source("src/components/equipment/EquipReforgePanel.vue");
    const transfer = source("src/components/equipment/AffixTransferPanel.vue");
    const batch = source("src/components/common/BatchSpendLedger.vue");
    const layout = source("scripts/layout-check.mjs");

    expect(reforge, "自动重铸要有稳定落点供真浏览器复核").toContain("data-equipment-auto-reforge");
    expect(reforge, "自动重铸不再自成一张四边卡").not.toMatch(
      /data-equipment-auto-reforge[\s\S]{0,120}rounded-\[2px\] border border-ink\/15/,
    );
    expect(reforge, "封存价签是账栏,不再伪装成一枚按钮").toContain("data-equipment-seal-price");
    expect(reforge, "封存价签只留分隔线,不铺圆角方底").not.toMatch(
      /data-equipment-seal-price[\s\S]{0,180}rounded-\[2px\] border px-2/,
    );
    expect(transfer, "词条转移要有稳定落点供真浏览器复核").toContain(
      "data-equipment-affix-transfer",
    );
    expect(transfer, "词条转移不再自成一张四边卡").not.toMatch(
      /data-equipment-affix-transfer[\s\S]{0,160}rounded-sm border border-ink\/10/,
    );

    const batchRule = batch.match(/\.batch-spend-ledger\s*\{[\s\S]*?\}/)?.[0] ?? "";
    expect(batchRule, "连强预算只留上下账线与左侧短笔").toMatch(/border:\s*0;/);
    expect(batchRule).toMatch(/border-block:\s*1px solid/);
    expect(batchRule).toMatch(/border-left:\s*2px solid/);
    expect(batchRule).toMatch(/border-radius:\s*0;/);

    expect(layout, "真浏览器要核工坊展开区不再套四边卡").toContain("data-equipment-auto-reforge");
    expect(layout).toContain("data-equipment-affix-transfer");
    expect(css, "器评帖样式入口保留").toContain(".equip-dossier__workshop");
  });

  it("换装对比与分解返还只在语义边界换行,数字和量词不拆两行", () => {
    const dialog = source("src/components/equipment/EquipmentDetailDialog.vue");
    const layout = source("scripts/layout-check.mjs");

    expect(dialog, "换装对照要有稳定落点").toContain("data-equipment-compare");
    expect(dialog, "当前同槽战力要整段不折").toMatch(
      /data-equipment-compare-value[\s\S]{0,80}whitespace-nowrap/,
    );
    expect(dialog, "分解返还行要允许在标签与代价之间换行").toMatch(
      /data-equipment-salvage[\s\S]{0,180}flex-wrap/,
    );
    expect(dialog, "分解代价按器灵尘与灵石分段,段内不折").toMatch(
      /data-equipment-salvage-cost[\s\S]{0,160}whitespace-nowrap/,
    );
    expect(layout, "1280 桌面要真量这些数字的渲染行数").toContain("data-equipment-compare-value");
    expect(layout).toContain("data-equipment-salvage-cost");
  });

  it("候选与详情共用同一份战力判据", () => {
    const candidates = source("src/components/inventory/SlotCandidatesDialog.vue");
    expect(candidates).toContain("equipPowerComparison");
    expect(dialog).toContain("equipPowerComparison");
  });

  it("装备域不再长出 9 / 12px 私档；16px 只留给输入框防 iOS 缩放", () => {
    const files = [
      "src/components/equipment/EquipmentDetailDialog.vue",
      "src/components/equipment/EquipUpgradePanel.vue",
      "src/components/equipment/EquipReforgePanel.vue",
      "src/components/equipment/EquipWhatIfPanel.vue",
      "src/components/equipment/EquipSealPanel.vue",
      "src/components/equipment/EquipDecomposePanel.vue",
      "src/components/equipment/EquipNotePanel.vue",
      "src/components/equipment/AffixTransferPanel.vue",
    ];

    for (const file of files) {
      const off = [...source(file).matchAll(/text-\[(\d+)px\]/g)]
        .map((m) => Number(m[1]))
        .filter((size) => size !== 16);
      expect(off, `${file} 冒出了不成行的私档字号`).toEqual([]);
    }
  });

  it("器评卷首在极窄档退回单列,不把战力差挤到品阶旁边", () => {
    const css = source("src/styles/pages/inventory.css");
    expect(css).toMatch(
      /\.equip-dossier__hero\s*\{[\s\S]{0,520}grid-template-columns:\s*auto minmax\(0, 1fr\) auto/,
    );
    expect(css).toMatch(
      /@media \(max-width: 220px\)\s*\{[\s\S]{0,1600}\.equip-dossier__hero\s*\{[\s\S]{0,220}grid-template-columns:\s*auto minmax\(0, 1fr\)/,
    );
    expect(css, "195px 下器印与锁钮占第一行,身份栏退到第二行整宽").toMatch(
      /@media \(max-width: 220px\)\s*\{[\s\S]{0,2600}\.equip-dossier__identity\s*\{[\s\S]{0,120}grid-column:\s*1 \/ -1;[\s\S]{0,80}grid-row:\s*2;/,
    );
  });

  it("部位候选在 195px 下把正文、战差与换装动作分行,零宽正文不许再出现", () => {
    const css = source("src/styles/pages/inventory.css");

    expect(candidates).toContain("slot-candidate-row__body");
    expect(candidates).toContain("slot-candidate-row__delta");
    expect(candidates).toContain("slot-candidate-row__action");
    expect(candidates, "正文在 195px 退出 grow 并占满图标右侧").toContain(
      "tinylens:grow-0 tinylens:basis-[calc(100%_-_1.75rem)]",
    );
    expect(candidates, "战差在 195px 退到正文下一行").toContain(
      "tinylens:basis-[calc(100%_-_1.75rem)]",
    );
    expect(css, "候选行在 195px 必须允许换行").toMatch(
      /@media \(max-width: 220px\)\s*\{[\s\S]{0,4000}\.slot-candidate-row\s*\{[\s\S]{0,80}flex-wrap:\s*wrap;/,
    );
    expect(css).toMatch(
      /@media \(max-width: 220px\)\s*\{[\s\S]{0,4400}\.slot-candidate-row__action\s*\{[\s\S]{0,120}width:\s*100%;/,
    );
  });

  it("工坊在 195 宽不再内缩,短动作与候选续开只走一行", () => {
    const css = source("src/styles/pages/inventory.css");
    const reforge = source("src/components/equipment/EquipReforgePanel.vue");
    const transfer = source("src/components/equipment/AffixTransferPanel.vue");

    expect(css).toMatch(
      /@media \(max-width: 220px\)\s*\{[\s\S]{0,2600}\.equip-dossier__workshop\s*\{[\s\S]{0,180}padding-inline:\s*0/,
    );
    expect(reforge).toContain(
      'class="btn-ghost min-h-[28px] w-full whitespace-nowrap !py-1 !text-body"',
    );
    expect(transfer).toContain("tinylens:pt-2");
    expect(transfer).toContain("chip-ink !whitespace-nowrap");
  });
});
