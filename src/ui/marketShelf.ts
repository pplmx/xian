import { EQUIP_SLOT_NAMES, equipmentTemplate } from "@/data/equipment";
import { qualityDef } from "@/data/qualities";
import { qualityVerdict } from "@/data/qualityVerdicts";
import { temperGradeText } from "@/ui/temperGrade";
import { AFFIX_RARITY_META, modsText } from "@/data/statNames";
import { equipPowerComparison } from "@/core/equipBest";
import { equipSetDef } from "@/core/equipSet";
import { resolveEquipStats } from "@/core/equipGen";
import { worldNameOfTier } from "@/core/formulas";
import { inscriptionFor, type Inscription } from "@/core/inscription";
import { formatGN } from "@/utils/format";
import { isZero, sub } from "@/utils/gnum";
import { isRareQuality, qualityTextColor } from "./qualityTier";
import type { EquipmentInstance, EquipmentTemplate, QualityId } from "@/types";

export type MarketEquipTone = "empty" | "up" | "down" | "even";

export interface MarketEquipFlatRow {
  label: string;
  value: string;
  diff: string;
  tone: "up" | "down" | "";
}

export interface MarketEquipAffixRow {
  id: string;
  name: string;
  desc: string;
  rarity: keyof typeof AFFIX_RARITY_META;
  rarityName: string;
  color: string;
}

export interface MarketEquipView {
  item: EquipmentInstance;
  template: EquipmentTemplate;
  quality: QualityId;
  qualityName: string;
  /** 这一档的品评(见 data/qualityVerdicts)—— 买前验货与详情页读同一句 */
  verdict: string;
  /** 成色的话(见 ui/temperGrade)—— 67 是什么水平,买之前就该看得懂 */
  temperGrade: string;
  color: string;
  textColor: string;
  rare: boolean;
  name: string;
  meta: string;
  desc: string;
  power: number;
  powerText: string;
  incumbentPowerText: string;
  compareText: string;
  deltaText: string;
  tone: MarketEquipTone;
  flatRows: MarketEquipFlatRow[];
  affixRows: MarketEquipAffixRow[];
  fixedModsText: string;
  setText: string;
  /**
   * 器铭 —— 买之前就该看见它的出身(与详情页同一份快照,见 core/inscription)。
   * 灵品以下为 null,验货签不出这一段。
   */
  inscription: Inscription | null;
}

function signedGNum(value: ReturnType<typeof sub>): string {
  if (isZero(value)) return "";
  return `${value.m > 0 ? "+" : "-"}${formatGN({ m: Math.abs(value.m), e: value.e })}`;
}

/**
 * 坊市兵刃的买前验货账。
 *
 * 装备在货架上只有名字与价格时，玩家必须买回行囊才看得见三围、词条与它比
 * 当前佩戴强多少 —— 那是一笔无法撤回的盲买。这里把详情页与部位候选已经在用的
 * 两份判据直接搬到摊签上：`equipPowerComparison` 算换装差，
 * `resolveEquipStats` 给平铺、词条与固有。
 */
export function marketEquipView(
  item: EquipmentInstance,
  incumbent?: EquipmentInstance,
  setCount = 0,
): MarketEquipView | null {
  const template = equipmentTemplate(item.templateId);
  if (!template) return null;

  const quality = qualityDef(item.quality);
  const resolved = resolveEquipStats(item);
  const incumbentResolved = incumbent ? resolveEquipStats(incumbent) : null;
  const comparison = equipPowerComparison(item, incumbent);
  const incumbentName = incumbent
    ? (equipmentTemplate(incumbent.templateId)?.name ?? "当前佩戴")
    : "";
  const incumbentLabel =
    incumbent && incumbentName
      ? `${incumbentName}${incumbent.level > 0 ? ` +${incumbent.level}` : ""}`
      : "";
  const set = template.set ? equipSetDef(template.set) : undefined;
  const inscription = inscriptionFor(item);

  const flatRows: MarketEquipFlatRow[] = [];
  for (const key of ["attack", "defense", "maxHp"] as const) {
    const mine = resolved.flats[key];
    const theirs = incumbentResolved?.flats[key];
    const diff = theirs ? sub(mine, theirs) : null;
    if (isZero(mine) && (!diff || isZero(diff))) continue;
    flatRows.push({
      label: key === "attack" ? "攻击" : key === "defense" ? "防御" : "气血",
      value: `+${formatGN(mine)}`,
      diff: diff ? signedGNum(diff) : "",
      tone: diff ? (diff.m > 0 ? "up" : diff.m < 0 ? "down" : "") : "",
    });
  }

  const deltaText =
    comparison.verdict === "empty"
      ? "空槽无对照"
      : comparison.verdict === "up"
        ? `+${formatGN(Math.round(Math.abs(comparison.delta ?? 0)))} 战力`
        : comparison.verdict === "down"
          ? `-${formatGN(Math.round(Math.abs(comparison.delta ?? 0)))} 战力`
          : "战力持平";

  return {
    item,
    template,
    quality: item.quality,
    qualityName: quality.name,
    verdict: qualityVerdict(item.quality),
    temperGrade: inscription ? temperGradeText(inscription.temper) : "",
    color: quality.color,
    textColor: qualityTextColor(item.quality),
    rare: isRareQuality(item.quality),
    name: template.name,
    meta: `${EQUIP_SLOT_NAMES[template.slot]} · ${worldNameOfTier(item.tier)}`,
    desc: template.desc,
    power: comparison.candidatePower,
    powerText: formatGN(Math.round(comparison.candidatePower)),
    incumbentPowerText:
      comparison.incumbentPower === null ? "" : formatGN(Math.round(comparison.incumbentPower)),
    compareText: incumbent ? `较当前「${incumbentLabel}」` : "此槽空悬，可直接入佩",
    deltaText,
    tone: comparison.verdict,
    flatRows,
    affixRows: resolved.affixLines.map((line) => ({
      id: line.id,
      name: line.name,
      desc: line.desc,
      rarity: line.rarity,
      rarityName: AFFIX_RARITY_META[line.rarity].name,
      color: AFFIX_RARITY_META[line.rarity].color,
    })),
    fixedModsText: modsText(template.fixedMods ?? {}),
    setText: set
      ? `共鸣「${set.name}」当前 ${setCount}/${set.required} 件 · ${set.effectDesc}`
      : "",
    inscription,
  };
}
