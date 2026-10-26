/**
 * 「归来一拍」的结算 —— 打开页面时,先把墙钟推过去的那段账结掉。
 *
 * 只读页(多标签的后来者)必须整体跳过。存储层的闸只挡落盘,挡不住内存里的结算:
 * 页面会照常把寄卖卖掉、把弟子摘回来的收获通报一遍,可这些永远不会进档 ——
 * 玩家在一张写着「进度不会保存」的页面上收到「灵石到账」的提示。
 * 与「只读页不启引擎」同一条理由:这一页的数字必须停在打开存档的那一刻。
 */
import { saveReader } from "@/core/singleWriter";
import { useApprenticeStore } from "@/stores/apprentice";
import { useBountyStore } from "@/stores/bounty";
import { useMarketStore } from "@/stores/market";
import { usePlayerStore } from "@/stores/player";

export interface ReturnSettlements {
  /** 到期自售的寄卖品名(用于一声通报) */
  sold: string[];
  /** 归来弟子与他们这一趟的收获 */
  reaped: ReturnType<ReturnType<typeof useApprenticeStore>["collectFinished"]>;
}

const NOTHING: ReturnSettlements = { sold: [], reaped: [] };

/** 只读页连内存里的归来结算都不跑 —— 它不是玩家真正在玩的那一页 */
export function settleReturn(now: number): ReturnSettlements {
  if (saveReader.value) return { ...NOTHING };
  const market = useMarketStore();
  const sold = market.collectConsign(now);
  market.sync(now);
  useBountyStore().sync(now);
  const apprentice = useApprenticeStore();
  apprentice.sync();
  const reaped = apprentice.collectFinished(now, usePlayerStore().major);
  return { sold, reaped };
}
