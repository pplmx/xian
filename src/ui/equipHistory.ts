/**
 * 一件器物的经历 —— 它被炼过几重、洗过几次、封存过几条。
 *
 * ## 缺口:账都记着,器评帖里却一条都读不到
 *
 * 每件装备身上早就有这几笔账(见 types 的 EquipmentInstance):
 *
 *   `level`          强化等级   —— 器评帖只印了眉题上一枚 `+N` 角标,没有一句人话
 *   `reforgeCount`   重铸次数   —— 只有**重铸面板**那一行读它
 *   `sealedAffixIds` 封存词条   —— 同上,只在重铸面板
 *   `invested`       累计投入   —— 只在分解返还与器魂警告里露面
 *
 * 于是玩家点开一件跟了自己几百场的旧器,看到的是「品质 + 词条 + 器铭」这一套
 * 出厂信息 —— 而它**经历过什么**,在详情页里一句都没有。
 *
 * 器铭讲的是「它生来是谁」(见 core/inscription);这里讲「它后来成了什么」。
 * 两件事,两处 —— 不把工序塞进铭文,也不把出身复述进行迹。
 *
 * ## 为什么这不是数值的第五种写法
 *
 * 这一行**不给任何加成、不参与任何判定**,只把已经记下的几笔账说成人话。
 * 与器铭同一条纪律:描述这一件,不替玩家做决定。故它读的每一个数都是既有字段,
 * 一个都不新增 —— 加字段就要迁移存档,而这条信息一行都不缺。
 *
 * ## 诚实口径
 *
 *   · 什么都没做过(新掉出来的一件)—— 整行不出,而不是印一句「尚无经历」占地方
 *   · 只有 `invested` —— 也不算经历:投入说的是「花了多少」,不是「做过什么工序」
 *   · 坏值(负数 / NaN / 封存条数超过词条数)—— 夹回合法范围,不印荒唐数
 */
import type { EquipmentInstance } from "@/types";

/** 一件器物做过的一道工序 */
export interface EquipHistoryLine {
  /** 稳定键:强化 / 重铸 / 封存 —— 界面按它取落点与排序 */
  id: "level" | "reforge" | "seal";
  /** 这一笔的人话 */
  text: string;
}

export interface EquipHistory {
  /** 做过的工序,按发生顺序重不重要排:先等级、再重铸、最后封存 */
  lines: EquipHistoryLine[];
  /** 是否真做过什么 —— 全为 0 时页面整段不出 */
  touched: boolean;
}

/** 非负整数;NaN / 负数一律当 0,小数取整 */
function count(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
}

/**
 * 封存上限 —— 与 `core/reforge` 的 `sealCapacity` 同一条口径:
 * 至少留一条可洗,故上限是「词条数 - 1」。单条词条的件封不了任何一条。
 *
 * 这里不 import core/reforge:那会把一条纯文案拖进整个重铸服务(它 import store)。
 * 口径只有这一行,且由本文件的用例与 reforge 的用例各钉一次 —— 两处都改才算改对。
 */
function sealCap(inst: EquipmentInstance): number {
  const affixes = Array.isArray(inst.affixes) ? inst.affixes.length : 0;
  return Math.max(0, count(affixes) - 1);
}

/**
 * 这一件经历过什么。
 *
 * 纯函数:只看这一件的字段,不读 store、不读时钟。
 * 同一件反复问,答案恒等 —— 器评帖每次打开都是同一句话。
 */
export function equipHistory(inst: EquipmentInstance | null | undefined): EquipHistory {
  if (!inst) return { lines: [], touched: false };
  const lines: EquipHistoryLine[] = [];

  const level = count(inst.level);
  if (level > 0) lines.push({ id: "level", text: `第 ${level} 重` });

  const reforges = count(inst.reforgeCount);
  if (reforges > 0) lines.push({ id: "reforge", text: `重铸 ${reforges} 次` });

  const cap = sealCap(inst);
  const sealed = Math.min(
    cap,
    count(Array.isArray(inst.sealedAffixIds) ? inst.sealedAffixIds.length : 0),
  );
  // 单条词条的件封不了任何一条 —— 那一笔整句不出,而不是印「封存 0/0」
  if (cap > 0 && sealed > 0) lines.push({ id: "seal", text: `封存 ${sealed}/${cap}` });

  return { lines, touched: lines.length > 0 };
}

/**
 * 一行话:几道工序用同一个分隔符并排。
 *
 * 没做过任何工序时返回空串 —— 调用方据此整段不出,与器铭、契语同一条规矩。
 */
export function equipHistoryText(inst: EquipmentInstance | null | undefined): string {
  return equipHistory(inst)
    .lines.map((line) => line.text)
    .join(" · ");
}
