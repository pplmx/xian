/**
 * 共鸣的「还差哪一件」。
 *
 * ## 问题:界面上只有一个分数
 *
 * 器评帖里写着「共鸣『铁壁共鸣』1/2」,然后没了。玩家看完这一行能知道的事只有
 * 「不够」—— 差哪一件、那一件在哪儿、我现在有没有见过,全都要自己去装备图鉴里翻。
 * 而本仓对决策信息的要求是明确的(`AGENTS.md` 的「决策信息完整」):置灰要写差多少,
 * 给决定前要把数字摊开。
 *
 * 共鸣比一般置灰更吃亏:它不是一次动作,而是要**凑齐一组**。凑不齐的原因可能是
 * 「还差一件胸甲」,也可能是「两件都在包里、只是没穿」,还可能是「根本还没见过那一件」——
 * 三种情况的下一步完全不同(去找、换上、继续刷),而界面用同一个「1/2」把它们抹平了。
 *
 * ## 这个模块只做一件事:把缺的那几件说出来
 *
 * 输入:共鸣定义 + 已穿件数(来自 `core/equipSet`,库算的)+ 玩家见过/拥有的装备。
 * 输出:还差几件、差的是哪几件(按槽位排)。
 *
 * 它**不改数值、不改判定**:能不能共鸣仍由 `core/equipSet` 的库调用说了算,
 * 这里只是把同一个事实讲成人话。写错也不会让战斗结果变。
 *
 * ## 三种「差」要分开说
 *
 *   owned   —— 这件在行囊里(没穿):下一步是「换上」
 *   seen    —— 见过、也在图鉴里,但手上没有:下一步是「去刷」
 *   unknown —— 连见都没见过:下一步是「先探到那一带有货」
 *
 * 混成一句「还差 1 件」就等于把三种局面说成一种。
 */
import { EQUIP_SLOT_NAMES } from "@/data/equipment";
import type { EquipSetDef } from "@/data/equipSets";
import type { EquipmentTemplate } from "@/types";

/** 「还差这一件」的三种处境 */
export type MissingPieceState = "owned" | "seen" | "unknown";

export interface MissingPiece {
  /** 装备模板 id */
  templateId: string;
  /** 装备名 */
  name: string;
  /** 槽位名(「胸甲」「头冠」这类人话) */
  slotName: string;
  state: MissingPieceState;
}

export interface ResonanceGap {
  /** 还差几件(0 = 已共鸣) */
  short: number;
  /** 差的都是哪几件,按槽位序排 */
  pieces: MissingPiece[];
  /** 一句话 · 供界面直接用;已满时为空串 */
  line: string;
}

/**
 * 槽位的展示序。
 *
 * 不在这里手抄一份槽位名单 —— 名单是 `data/equipment` 的事(它涨一个槽位,
 * 这里就该跟着有),本模块只规定**先看哪里**:先兵器,再护身,最后佩饰。
 * 抄一份的后果是真实的:第一版手抄时漏了 `necklace`,而类型检查当场打红 ——
 * 那正是「两本账」第一次对不上的样子。
 */
const SLOT_RANK: Record<string, number> = {
  weapon: 0,
  head: 1,
  body: 2,
  wrist: 3,
  belt: 4,
  boots: 5,
  necklace: 6,
  ring: 7,
  talisman: 8,
  artifact: 9,
};

function slotRank(slot: string): number {
  return SLOT_RANK[slot] ?? 99;
}

/**
 * 把「这套有哪些件」与「我手上有什么」对成一句人话。
 *
 * @param def       共鸣定义(名字与所需件数从这里来,不另抄)
 * @param equipped  已在身上的模板 id
 * @param owned     行囊里有的模板 id(没穿)
 * @param seen      见过/收录过的模板 id
 * @param templates 这套的全部模板(由调用方从装备表筛出,本模块不自己筛)
 */
export function resonanceGap(
  def: EquipSetDef,
  equipped: readonly string[],
  owned: readonly string[],
  seen: readonly string[],
  templates: readonly EquipmentTemplate[],
): ResonanceGap {
  const worn = new Set(equipped);
  const bag = new Set(owned);
  const known = new Set(seen);
  const pieces: MissingPiece[] = [];
  const sorted = [...templates].sort(
    (a, b) => slotRank(a.slot) - slotRank(b.slot) || a.tier - b.tier,
  );
  for (const tpl of sorted) {
    if (worn.has(tpl.id)) continue;
    pieces.push({
      templateId: tpl.id,
      name: tpl.name,
      slotName: EQUIP_SLOT_NAMES[tpl.slot] ?? tpl.slot,
      state: bag.has(tpl.id) ? "owned" : known.has(tpl.id) ? "seen" : "unknown",
    });
  }
  /*
   * 「还差几件」用定义里的件数减已穿,而不是「这个套有几件没穿」——
   * 一套三件、身上穿两件就已共鸣,那第三件不该被算进缺口。
   */
  const short = Math.max(0, def.required - worn.size);
  const gap = pieces.slice(0, Math.max(short, 0));
  return { short, pieces: gap, line: short === 0 ? "" : gapLine(def, short, gap) };
}

function gapLine(def: EquipSetDef, short: number, pieces: readonly MissingPiece[]): string {
  const head = `还差 ${short} 件凑成「${def.name}」`;
  if (pieces.length === 0) return head;
  const rows = pieces.map((p) => {
    const mark =
      p.state === "owned" ? "(在行囊,换上即可)" : p.state === "seen" ? "(见过,去刷)" : "(未曾见)";
    return `${p.slotName}·${p.name}${mark}`;
  });
  return `${head}:${rows.join("、")}`;
}

/** 一套的全部模板 —— 与装备表同源,不在这里另抄一份名单 */
export function templatesOfSet(
  setId: string,
  all: readonly EquipmentTemplate[],
): EquipmentTemplate[] {
  return all.filter((tpl) => tpl.set === setId);
}
