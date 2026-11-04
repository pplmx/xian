/**
 * 成色的话 —— 一个 0~100 的数字,要说得清它在同档里算好还是差。
 *
 * ## 问题:成色只是一个孤零零的数
 *
 * 器评帖上写着「成色 67 / 100」。67 是什么水平?玩家没有对照:
 * 满掷才算好?及格就行?同品的另一件是 82,差多少?
 *
 * 更糟的是这个数看着像分数 —— 而它其实是**词条掷点的均值**(见 core/inscription
 * 的注释:它刻意不叫「评分」,因为它不参与任何排序或选哪一件)。一个既像分数、
 * 又没有任何标尺的数,是界面里最容易让人误读的东西。
 *
 * ## 补什么:一句评语,与它并列摆在数字旁边
 *
 * 「成色 67 / 100 · 中上」—— 档位把那个数翻译成人能用的判断。
 * 七档:下下 / 下 / 中下 / 中 / 中上 / 上 / 上上,余量留给「满」与「坯」两个端点。
 *
 * ## 边界为什么这样定
 *
 * 掷点是**均匀**的(见 equipGen 的 roll 生成),所以「中」不是 50 而是 50——
 * 均匀分布下中位数即 50。档位按等距切,不按正态切:把均匀分布当正态切,
 * 「中」会覆盖一大半而两端几乎不出现,评语就失去了分辨力。
 *
 * ## 它不进任何判定
 *
 * 这里只产出一个词。能不能用、值不值钱、要不要分解 —— 一件都不归它管,
 * 与器铭本体同一条纪律(见 core/inscription 的「描述而不决定」)。
 */

import { clampPercent } from "@/utils/unitRatio";

/** 成色档位 —— 七档评语,外加「满」与「坯」两个端点 */
export type TemperGradeId =
  | "raw"
  | "low"
  | "lowMid"
  | "midLow"
  | "mid"
  | "midHigh"
  | "high"
  | "perfect";

export interface TemperGrade {
  id: TemperGradeId;
  /** 评语(两字) */
  label: string;
  /** 下界(含) */
  from: number;
}

/**
 * 档位的**唯一定义**。
 *
 * 顺序即高低:从最低档往上排,查表时取最后一个「from ≤ 成色」的档。
 * 满与坯单独两端:100 是满,0 是还没淬过的坯 —— 那不是「差」,是「还没开始」。
 */
export const TEMPER_GRADES: readonly TemperGrade[] = [
  { id: "raw", label: "坯", from: 0 },
  { id: "low", label: "下下", from: 1 },
  { id: "lowMid", label: "下", from: 20 },
  { id: "midLow", label: "中下", from: 35 },
  { id: "mid", label: "中", from: 50 },
  { id: "midHigh", label: "中上", from: 65 },
  { id: "high", label: "上", from: 80 },
  { id: "perfect", label: "满", from: 100 },
];

/*
 * 档宽的说明(写完再核一遍,别让它只是口头上"等距"):
 *
 *   坯     0        —— 端点,不是一档
 *   下下   1..19     —— 19 宽
 *   下     20..34    —— 15
 *   中下   35..49    —— 15
 *   中     50..64    —— 15
 *   中上   65..79    —— 15
 *   上     80..99    —— 20
 *   满     100       —— 端点
 *
 * 中间五档等距(各 15),两端各留一段较宽的过渡带:1..19 与 80..99 比中间宽,
 * 是因为「刚出坯」与「将近掷满」这两种局面值得多给一点分辨力 —— 玩家最容易
 * 在这两处问「算不算好」。这不是"忘了对齐",是把宽度有意分给两端(判据核的是
 * 中间五段等距 + 两端更宽,见 temperGrade.spec)。
 */

/**
 * 某一道成色落在哪一档。
 *
 * 坏值按 0(坯)—— 一个算不出来的成色,最诚实的说法是「还没开始」,
 * 而不是随便给个「中」装作知道。
 */
export function temperGrade(temper: number): TemperGrade {
  // 0~100 的夹取全仓只此一份(utils/unitRatio 的 clampPercent),不在这里重写一遍
  const v = clampPercent(temper);
  let hit = TEMPER_GRADES[0]!;
  for (const grade of TEMPER_GRADES) {
    if (v >= grade.from) hit = grade;
    else break;
  }
  return hit;
}

/** 那半句并排评语:「中上」;落在坯或满时改口成能懂的短句 */
export function temperGradeText(temper: number): string {
  const grade = temperGrade(temper);
  if (grade.id === "raw") return "尚未淬出";
  if (grade.id === "perfect") return "掷满";
  return grade.label;
}
