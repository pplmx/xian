/**
 * 词条转移文案 —— 每种「接不了」的落位提示,与核心同一份翻译。
 *
 * 从 core/affixTransfer 抽出(那里只留判据):文案与判据分离,便于逐条钉字;
 * 也是 eventText / codex 等「界面文案独立可测」的一类 —— 判据变了但忘了改嘴,这里红。
 */
import { affixDef } from "@/data/affixes";
import type { TransferBlock } from "@/core/affixTransfer";

/** 单词条落位文案:为什么一条转不过去(主按钮/候选的禁用提示用同一份) */
export function transferBlockText(block: TransferBlock, affixId: string): string {
  const name = affixDef(affixId)?.name ?? affixId;
  switch (block) {
    case "same":
      return "源件与目标件是同一件";
    case "noAffix":
      return `源件没有「${name}」这条`;
    case "noTemplate":
      return "目标件的件形失效";
    case "slot":
      return `目标部位容不下「${name}」`;
    case "rank":
      return `「${name}」需要更高品质的载体`;
    case "dup":
      return `「${name}」在目标上已有更高或持平的一条`;
    case "noLanding":
      return "要顶替的词条不在目标上";
    case "full":
      return "目标词条已满,先顶替一条才能新增";
    case "stack":
      return "同件上不可再叠这条递减属性";
    case "sealFull":
      return "目标已封满,须留一个可重掷位才能同时封存";
  }
}

/** 转移花费缺哪一样的简语(主按钮禁用悬停用) */
export const TRANSFER_NEEDS_TEXT: Record<"stone" | "dust", string> = {
  stone: "灵石不足",
  dust: "器灵尘不足",
};
