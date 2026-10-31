import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");

function source(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("器评帖 · 装备详情先给身份与换装结论", () => {
  const dialog = source("src/components/equipment/EquipmentDetailDialog.vue");

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
    expect(transfer).toContain("tinylens:p-2");
    expect(transfer).toContain("chip-ink !whitespace-nowrap");
  });
});
