/**
 * 本世回照 —— 把一世的账收成一句话。
 *
 * ## 为什么要有它（第 555 轮）
 *
 * 历世履历每一行现在报的是:**终点第几境 · 终寿几岁 · 立了什么题 · 结局如何 ·
 * 签过什么契 · 那副灵根**。全是「这一世是什么」，没有一句「这一世做了什么」。
 *
 * 而玩家翻履历时真正在找的是后者。`data/samsara` 的 `LifeRecord` 里也没有这一栏 ——
 * 它记的是账，不是话。
 *
 * ## 它不是「生成叙事」
 *
 * 这一句的每一个零件都来自履历里已有的字段，**不引入任何新数据**、
 * 不掷任何随机数、不读时间。同样的履历永远得到同样的一句 ——
 * 与 `flavorTextNoNumbers` 那条纪律一致:叙述里不许出现会被常数改动的数。
 *
 * ## 为什么复用 `LifeRecord` 而不另存一句话
 *
 * 另存一句就得在转世那一刻写，而那一刻界面上还有别的事在发生（宿慧落袋、
 * 灵根快照、契入履历）。**同一份数据说两遍就是两本账** ——
 * 而这一句完全可以从已有字段推出来。
 */
import type { LifeRecord } from "@/data/samsara";
import { lifeThemeDef } from "@/data/lifeThemes";
import { lifeTrialDef } from "@/data/lifeTrials";

/** 结局的三种说法 —— 与履历行的 `resultText` 同源，不另起一套 */
const RESULT_CLAUSE: Record<string, string> = {
  done: "把题走到底了",
  unfinished: "题没走完",
  broken: "半途破了题",
};

/**
 * 一世的回照。
 *
 * 组装顺序按「分量」排:先说他做成了什么，再说他没能做成什么，最后说这一世的去处。
 * 一条都凑不出来时返回空串 —— 界面据此不出这一行，而不是印一句空话。
 */
export function lifeEpitaph(rec: LifeRecord): string {
  const parts: string[] = [];

  /* ① 命题:这一世给自己立的题，及它的结局 */
  const theme = rec.themeId ? lifeThemeDef(rec.themeId) : undefined;
  if (theme) {
    const clause = RESULT_CLAUSE[rec.themeResult ?? "unfinished"];
    if (clause) parts.push(`立「${theme.name}」之题，${clause}`);
  }

  /* ② 逆旅契:自己挑的逆境 —— 只入履历，不进任何计算 */
  const trial = rec.trialId ? lifeTrialDef(rec.trialId) : undefined;
  if (trial) parts.push(`自己挑了「${trial.name}」这道逆境`);

  /* ③ 灵根:这一世抓到的牌。只在记过时不省略 —— 老档没有这一栏 */
  const grade = rec.linggen?.gradeName;
  if (grade) parts.push(`带了${grade}入世`);

  return parts.join("，") + (parts.length > 0 ? "。" : "");
}
