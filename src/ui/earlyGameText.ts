/**
 * 顿悟 / 洞府巡游选项的数值行 —— 界面唯一出处
 *
 * 由来:这两处选项文案曾把手抄的数值当成唯一显示来源(「修炼速度 +20%」
 * 「获得 120 修为,但修炼速度 -15%(5 分钟)」),而真值在别处 ——
 * buffs.ts 的 `mods`、选项自己的 `reward` / `penalty`。两本账各自都"对",
 * 于是改常数那一夜,界面就开始撒谎,而且没有任何一处会红。
 *
 * 现在分开写:data/earlyGame.ts 的 `desc` / `effect` 只留风味(不带一个数字),
 * 数值一律由本文件从数据派生 —— 改 `{ cultivationSpeed: 0.2 }`,界面跟着变。
 *
 * 三条口径:
 *   一 词条文字走 ui/statNames 的 `modsText`(全库独一份格式器,不自造);
 *   二 时长走 data/timeUnits —— 真落在道门时制表上的说古语(一炷香(30 分钟)),
 *      落不在表上的只说现代时长(5 分钟):「将近一刻(5 分钟)」自相矛盾,
 *      古语可以模糊,但模糊必须写在明处(见 timeUnits 头注释);
 *   三 报数必须报全:奖励 + 惩罚并列一行,玩家一眼看得完。
 */
import { buffDef } from "@/data/buffs";
import { RESOURCE_LABELS } from "@/data/resourceNames";
import { classicalDuration, modernDuration } from "@/data/timeUnits";
import type { CaveEvent, EnlightenmentOption } from "@/types";
import { modsText } from "../data/statNames";

type CaveOption = CaveEvent["options"][number];

/**
 * 时长:古语只在**确实落在**道门时制表上时才用。
 *
 * `classicalDuration(300)` 给的是「将近一刻(5 分钟)」—— 古语说"将近一刻"、
 * 括号里却是 5 分钟,自相矛盾。这类落不在表上的值只说现代时长(同一模块的
 * modernDuration),数字仍是同一份真相,不另立第二套换算。
 */
export function durationText(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return "";
  const classical = classicalDuration(sec);
  const approximate = classical.startsWith("将近") || classical.includes("有余");
  return approximate ? modernDuration(sec) : classical;
}

/** 一味 buff 的数值行:词条 + 持续时长(读 buff 本体,不读文案) */
export function buffEffectText(buffId: string): string {
  const def = buffDef(buffId);
  if (!def) return "";
  const nums = modsText(def.mods);
  const dur = durationText(def.durationSec);
  return [nums, dur].filter(Boolean).join(" · ");
}

/** 顿悟选项的数值行:挂 buff 的读 buff 本体,即时奖励的读 reward */
export function enlightenmentEffectText(opt: EnlightenmentOption): string {
  if (opt.buffId) return buffEffectText(opt.buffId);
  if (opt.reward) return `${RESOURCE_LABELS.wudao} +${opt.reward.value}`;
  return "";
}

/** 巡游奖励里"一次性入袋"的那几种,报数用的名字 */
const REWARD_LABELS: Record<"exp" | "stone" | "herb" | "wudao", string> = {
  exp: "修为",
  stone: RESOURCE_LABELS.stone,
  herb: RESOURCE_LABELS.herb,
  wudao: RESOURCE_LABELS.wudao,
};

/**
 * 洞府巡游选项的数值行:奖励 → reward(或 buff 本体),惩罚 → `cave_penalty_*` 的 mods。
 *
 * 惩罚 buff 的 id 由 `penalty.type` 派生(与 earlyGameService.chooseCaveOption
 * 的 `addBuff` 同一口径),故这里读到的就是玩家真会中的那一味。
 */
export function caveOptionEffectText(opt: CaveOption): string {
  const parts: string[] = [];
  const reward = opt.reward;
  if (reward) {
    if (reward.type === "buff") {
      parts.push(buffEffectText(reward.value as string));
    } else if (typeof reward.value === "number" && reward.value > 0) {
      parts.push(`${REWARD_LABELS[reward.type as keyof typeof REWARD_LABELS]} +${reward.value}`);
    }
  }
  if (opt.penalty) parts.push(buffEffectText(`cave_penalty_${opt.penalty.type}`));
  // 零奖励 / 无奖励无惩罚 = 这一次什么都不会发生,如实说
  return parts.filter(Boolean).join(" · ") || "无事发生";
}
