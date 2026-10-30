/**
 * 流派识别 —— 从最终属性推断玩家当前构筑,供 Build 面板展示
 */
import type { AnyStatKey, StatMods } from "@/types";
import { artifactDef } from "@/data/artifacts";
import { gongfaDef } from "@/data/gongfa";
import { talentDef } from "@/data/talents";
import { useCultivationStore } from "@/stores/cultivation";
import { useInventoryStore } from "@/stores/inventory";
import { usePlayerStore } from "@/stores/player";
import { modOf } from "./statsCalc";

export interface BuildStyleDef {
  id: string;
  name: string;
  /** 印章单字 */
  seal: string;
  desc: string;
  /** 核心词条 → 满契合参考值 */
  core: Partial<Record<AnyStatKey, number>>;
}

export const BUILD_STYLES: BuildStyleDef[] = [
  {
    id: "beishui",
    name: "背水流",
    seal: "背",
    desc: "身陷绝境,战意愈炽;濒死缠斗,最擅攻坚",
    core: { lowHpDamage: 0.5, lowHpReduction: 0.3 },
  },
  {
    id: "gangdun",
    name: "罡盾流",
    seal: "盾",
    desc: "罡气为盾,愈守愈强;硬撼高爆发之敌",
    core: { shieldOnStart: 0.25, shieldPower: 0.3 },
  },
  {
    id: "fanzhen",
    name: "反震流",
    seal: "棘",
    desc: "以彼之力,还施彼身;多段之敌自取灭亡",
    core: { counterRate: 0.3, counterDamage: 0.5 },
  },
  {
    id: "lianji",
    name: "连击流",
    seal: "连",
    desc: "快剑连绵,不留喘息;唯疾影难缠",
    core: { comboRate: 0.3, comboDamage: 0.4 },
  },
  {
    id: "muze",
    name: "沐泽流",
    seal: "泽",
    desc: "生生不息,久战不衰;惧雷霆一击",
    core: { lifesteal: 0.08, regenPerRound: 0.025, overhealShield: 0.5 },
  },
  {
    id: "fengmang",
    name: "锋芒流",
    seal: "锋",
    desc: "锋芒毕露,先发制人;收割脆敌如探囊",
    core: { fullHpDamage: 0.35, firstStrike: 0.35, critRate: 0.15 },
  },
];

export interface BuildDetection {
  style: BuildStyleDef;
  /** 0~1 契合度 */
  affinity: number;
  stageName: string;
  /** 核心词条当前数值 */
  coreValues: { key: AnyStatKey; value: number }[];
  /** 副体系(混合流派;修行无职业,道路可以不纯) */
  secondary?: { style: BuildStyleDef; affinity: number };
  /** 展示名:纯派为「罡盾流」,混合为「罡盾·反震」 */
  displayName: string;
}

export interface BuildTermProgress {
  key: AnyStatKey;
  value: number;
  /** 该词条按 100% 契合折算时的参考值 */
  reference: number;
  /** 0~1，单条词条对契合度的贡献比例 */
  ratio: number;
}

export interface BuildAffinityRow {
  style: BuildStyleDef;
  /** 0~1，核心词条贡献的平均值 */
  affinity: number;
  terms: BuildTermProgress[];
  /** 已留下非零词条的条数 */
  activeTerms: number;
}

/** 副体系判定门槛 */
const SECONDARY_MIN_AFFINITY = 0.3;
/** 雏形判定线 —— 未达此线的册页会展示道途发现页 */
export const STYLE_EMERGENCE_AFFINITY = 0.25;
/** 流派成形 / 大成判定线 —— 判定、stageName 与纯度文案同读这一枚(AGENTS「改常数就撒谎」) */
export const STYLE_MATURE_AFFINITY = 0.6;
export const STYLE_MASTER_AFFINITY = 0.9;

function shortName(style: BuildStyleDef): string {
  return style.name.replace(/流$/, "");
}

/**
 * 各路当前契合度与核心词条缺口。
 *
 * 识别与「道途未成」发现页必须读同一份计算：否则页面说「还差 4%」，
 * 识别却可能按另一套算法提前成路。排序只按契合度降序，同分保留书目顺序。
 */
export function buildAffinityRows(mods: StatMods): BuildAffinityRow[] {
  return BUILD_STYLES.map((style, index) => {
    const keys = Object.keys(style.core) as AnyStatKey[];
    const terms = keys.map((key) => {
      const value = modOf(mods, key);
      const reference = style.core[key] ?? 1;
      return {
        key,
        value,
        reference,
        ratio: Math.min(1, value / reference),
      };
    });
    return {
      style,
      affinity: terms.reduce((sum, term) => sum + term.ratio, 0) / terms.length,
      terms,
      activeTerms: terms.filter((term) => term.value > 0).length,
      index,
    };
  })
    .sort((a, b) => b.affinity - a.affinity || a.index - b.index)
    .map((row) => ({
      style: row.style,
      affinity: row.affinity,
      terms: row.terms,
      activeTerms: row.activeTerms,
    }));
}

/** 识别当前流派;不足雏形返回 null */
export function detectBuild(mods: StatMods): BuildDetection | null {
  const rows = buildAffinityRows(mods);

  const best = rows[0]!;
  if (best.affinity < STYLE_EMERGENCE_AFFINITY) return null;

  const second = rows[1]!;
  const hasSecondary = second.affinity >= SECONDARY_MIN_AFFINITY;
  return {
    style: best.style,
    affinity: best.affinity,
    stageName:
      best.affinity >= STYLE_MASTER_AFFINITY
        ? "大成"
        : best.affinity >= STYLE_MATURE_AFFINITY
          ? "成形"
          : "雏形",
    coreValues: best.terms
      .map(({ key, value }) => ({ key, value }))
      .filter((term) => term.value > 0),
    secondary: hasSecondary ? { style: second.style, affinity: second.affinity } : undefined,
    displayName: hasSecondary
      ? `${shortName(best.style)}·${shortName(second.style)}`
      : best.style.name,
  };
}

/** 列出当前构筑中贡献了核心词条的来源(功法/法宝/天赋名) */
export function buildSources(style: BuildStyleDef): string[] {
  const cultivation = useCultivationStore();
  const inventory = useInventoryStore();
  const player = usePlayerStore();
  const coreKeys = new Set(Object.keys(style.core));
  const names: string[] = [];

  const hasCore = (mods: StatMods | undefined): boolean => {
    if (!mods) return false;
    return Object.keys(mods).some((k) => coreKeys.has(k));
  };

  const equippedGongfa = [cultivation.mainGongfa, ...cultivation.subGongfa].filter(
    (x): x is string => !!x,
  );
  for (const id of equippedGongfa) {
    const def = gongfaDef(id);
    if (def && (hasCore(def.baseMods) || hasCore(def.perLevelMods))) names.push(`《${def.name}》`);
  }
  for (const art of inventory.currentArtifacts) {
    const def = artifactDef(art.defId);
    if (def && hasCore(def.passive)) names.push(`「${def.name}」`);
  }
  for (const id of player.reincarnation.talents) {
    const def = talentDef(id);
    if (def && hasCore(def.mods)) names.push(`天赋·${def.name}`);
  }
  return names;
}
