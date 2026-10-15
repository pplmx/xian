/** 天道变数(Phase 21)—— 随机规则池,每次试炼抽取数条组合;主题标签供世界语义审计(Phase 25) */
import type { MutatorDef } from "@/types";

/** 变数主题轴:生成世界时须语义聚焦,不许大杂烩 */
export type MutatorTheme = "survival" | "tempo" | "lethality" | "evasion" | "endurance";

export const MUTATOR_THEMES: Record<string, MutatorTheme> = {
  heal_down: "survival",
  shield_thin: "survival",
  foe_dodge: "evasion",
  time_tight: "tempo",
  blood_surge: "lethality",
  foe_bulk: "endurance",
  killing_air: "lethality",
  heaven_wrath: "lethality",
  foe_onslaught: "lethality",
  time_thinning: "tempo",
};

/** 主题 → 界名意象 */
export const THEME_IDENTITY: Record<MutatorTheme, string> = {
  survival: "生机断绝",
  tempo: "天时如刀",
  lethality: "杀气沸腾",
  evasion: "虚影幢幢",
  endurance: "磐石难移",
};

export const MUTATORS: MutatorDef[] = [
  { id: "heal_down", name: "生机凋敝", text: "治疗效率 -75%", rules: { healMult: 0.25 } },
  { id: "shield_thin", name: "盾薄如纸", text: "护盾上限 25%", rules: { shieldCapRatio: 0.25 } },
  {
    id: "foe_dodge",
    name: "敌影幢幢",
    text: "敌人闪避 +25%",
    rules: { enemyExtraMods: { dodgeRate: 0.25 } },
  },
  { id: "time_tight", name: "天时紧迫", text: "回合上限 32", rules: { maxRounds: 32 } },
  {
    id: "blood_surge",
    name: "血气翻涌",
    text: "敌我暴击伤害皆 +60%",
    rules: { playerExtraMods: { critDamage: 0.6 }, enemyExtraMods: { critDamage: 0.6 } },
  },
  { id: "foe_bulk", name: "敌体魁伟", text: "敌人生命 +28%", rules: { enemyHpMult: 1.28 } },
  {
    id: "killing_air",
    name: "杀气盈天",
    text: "敌我攻击皆 +25%",
    rules: { playerAtkMult: 1.25, enemyAtkMult: 1.25 },
  },
  {
    id: "heaven_wrath",
    name: "天罚加身",
    text: "敌人暴击率 +15%",
    rules: { enemyExtraMods: { critRate: 0.15 } },
  },
  {
    id: "foe_onslaught",
    name: "敌势如潮",
    text: "敌人攻击 +18%",
    rules: { enemyAtkMult: 1.18 },
  },
  {
    id: "time_thinning",
    name: "天时流尽",
    text: "回合上限 30",
    rules: { maxRounds: 30 },
  },
  {
    id: "foe_rear",
    name: "垂死反扑",
    text: "敌人气血垂危时攻势 +50%",
    rules: { enemyExtraMods: { lowHpDamage: 0.5 } },
  },
  {
    id: "foe_swift",
    name: "逐影之势",
    text: "敌人速度 +25%",
    rules: { enemyExtraMods: { speed: 0.25 } },
  },
  {
    id: "foe_wrath",
    name: "煞气冲天",
    text: "敌人会心 +12%",
    rules: { enemyExtraMods: { critRate: 0.12 } },
  },
  {
    id: "foe_leech",
    name: "饥渴之爪",
    text: "敌人吸血 +15%",
    rules: { enemyExtraMods: { lifesteal: 0.15 } },
  },
  {
    id: "foe_iron",
    name: "铜皮铁骨",
    text: "敌人防御 +25%",
    rules: { enemyExtraMods: { defensePct: 0.25 } },
  },
  {
    id: "foe_combo",
    name: "连击如潮",
    text: "敌人连击率 +18%",
    rules: { enemyExtraMods: { comboRate: 0.18 } },
  },
  {
    id: "foe_penetrate",
    name: "破甲难防",
    text: "敌人破防 +30%",
    rules: { enemyExtraMods: { armorPen: 0.3 } },
  },
];

export function mutatorDef(id: string): MutatorDef | undefined {
  return MUTATORS.find((m) => m.id === id);
}
