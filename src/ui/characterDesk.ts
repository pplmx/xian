import { isSoftCapped, modOf } from "@/core/statsCalc";
import { STAT_NAMES } from "@/data/statNames";
import { formatPercent } from "@/utils/format";
import type { AnyStatKey, StatMods, StatSourceRow } from "@/types";

export type CharacterChapterKey = "foundation" | "modifiers" | "catalog";

export interface CharacterChapter {
  key: CharacterChapterKey;
  index: string;
  title: string;
  hint: string;
}

const CHAPTERS: readonly CharacterChapter[] = [
  {
    key: "foundation",
    index: "壹",
    title: "道躯总案",
    hint: "三围折成战力,灵根定下行路",
  },
  {
    key: "modifiers",
    index: "贰",
    title: "行藏周天",
    hint: "修行、历练、斗法与百艺,四类收成一册,拆卷再看逐项来路",
  },
  {
    key: "catalog",
    index: "叁",
    title: "卷末云笈",
    hint: "道途、缘法、行迹,九处去向一页可寻",
  },
];

export function characterChapters(): [CharacterChapter, CharacterChapter, CharacterChapter] {
  return [
    characterChapter("foundation"),
    characterChapter("modifiers"),
    characterChapter("catalog"),
  ];
}

export function characterChapter(key: CharacterChapterKey): CharacterChapter {
  const chapter = CHAPTERS.find((entry) => entry.key === key);
  if (!chapter) throw new Error(`unknown character chapter: ${key}`);
  return { ...chapter };
}

interface CharacterModifierGroupSeed {
  key: "practice" | "journey" | "combat" | "craft";
  mark: string;
  title: string;
  hint: string;
  keys: readonly AnyStatKey[];
}

/**
 * 行藏四类只在这里装配一次。
 *
 * `STAT_NAMES` 是属性键的完整事实源;下面四组必须逐个覆盖它,漏一枚就会让
 * 面板重新出现「引擎里有、界面上找不到」的暗词条。判据见 characterDesk.spec。
 */
const GROUP_SEEDS: readonly CharacterModifierGroupSeed[] = [
  {
    key: "practice",
    mark: "修",
    title: "修行",
    hint: "吐纳、破境、寿元与劫数",
    keys: [
      "cultivationSpeed",
      "qiRegen",
      "breakthroughRate",
      "tribulationResist",
      "lifespanPct",
      "breakRefund",
    ],
  },
  {
    key: "journey",
    mark: "历",
    title: "历练",
    hint: "行旅、掉落、际遇与资粮",
    keys: [
      "luck",
      "explorationSpeed",
      "dropRate",
      "doubleDropRate",
      "eventLuck",
      "expGain",
      "spiritStoneGain",
    ],
  },
  {
    key: "combat",
    mark: "战",
    title: "斗法",
    hint: "攻防、暴击、连击与护盾",
    keys: [
      "attackPct",
      "defensePct",
      "maxHpPct",
      "critRate",
      "critDamage",
      "speed",
      "damageBonus",
      "damageReduction",
      "armorPen",
      "firstStrike",
      "counterRate",
      "lifesteal",
      "shieldOnStart",
      "executeDamage",
      "regenPerRound",
      "dodgeRate",
      "accuracy",
      "lowHpReduction",
      "comboRate",
      "stunRate",
      "lowHpDamage",
      "fullHpDamage",
      "shieldPower",
      "comboDamage",
      "counterDamage",
      "overhealShield",
    ],
  },
  {
    key: "craft",
    mark: "艺",
    title: "百艺",
    hint: "丹器、灵兽与容量",
    keys: ["alchemyYield", "craftExpGain", "craftSalvage", "forgeDiscount", "qiCapPct", "beastPct"],
  },
];

export interface CharacterModifierRow {
  key: AnyStatKey;
  label: string;
  value: number;
  capped: boolean;
  sourceCount: number;
  hasOnTop: boolean;
}

export interface CharacterModifierGroup {
  key: CharacterModifierGroupSeed["key"];
  mark: string;
  title: string;
  hint: string;
  keys: readonly AnyStatKey[];
  rows: CharacterModifierRow[];
}

export interface CharacterModifierSummary {
  active: number;
  groups: number;
  softCapped: number;
}

/**
 * 把最终属性与来源明细收成行藏四类。
 *
 * 空组保留在返回值里,因为分组本身是稳定结构;页面只在组内有真值时铺开。
 * 数值、软上限与来源数都不在这里重算,统一读 finalStats 的同一份账。
 */
export function characterModifierDesk(
  mods: StatMods,
  breakdown: readonly StatSourceRow[],
): CharacterModifierGroup[] {
  return GROUP_SEEDS.map((group) => ({
    key: group.key,
    mark: group.mark,
    title: group.title,
    hint: group.hint,
    keys: group.keys,
    rows: group.keys
      .map((key) => ({
        key,
        label: STAT_NAMES[key],
        value: modOf(mods, key),
        capped: isSoftCapped(mods, key),
        sourceCount: breakdown.filter((source) => (source.mods[key] ?? 0) !== 0).length,
        hasOnTop: breakdown.some(
          (source) => source.onTop === true && (source.mods[key] ?? 0) !== 0,
        ),
      }))
      .filter((row) => row.value !== 0),
  }));
}

export function characterModifierSummary(
  groups: readonly CharacterModifierGroup[],
): CharacterModifierSummary {
  const rows = groups.flatMap((group) => group.rows);
  return {
    active: rows.length,
    groups: groups.filter((group) => group.rows.length > 0).length,
    softCapped: rows.filter((row) => row.capped).length,
  };
}

/**
 * 一组行藏收成一行账时的那条抬头读数。
 *
 * 取组内前 `limit` 项,而不是按数值大小重排 —— `GROUP_SEEDS` 的键序就是重要度序
 * (修炼速度、攻击、气血这类先写),换一个组、换一份存档,读到的都是同一批位置,
 * 玩家第二次打开不用重新找。数值格式与行内同一枚 `formatPercent`,不另造口径。
 */
export function modifierGroupHeadline(group: CharacterModifierGroup, limit = 2): string {
  return group.rows
    .slice(0, limit)
    .map((row) => `${row.label} ${row.value > 0 ? "+" : ""}${formatPercent(row.value)}`)
    .join(" · ");
}
