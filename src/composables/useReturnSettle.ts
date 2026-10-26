/**
 * 「归来一拍」的结算 —— 打开页面时,先把墙钟推过去的那段账结掉。
 *
 * 这里只负责「打开页面这一拍要结哪些账」,不负责判断谁能结 —— 那道闸在各 store 的
 * `sync` / `collectConsign` / `collectFinished` 里:坊市页与收徒页也直接调这些方法
 * (还各有一个每秒的定时器),只在 App 这一处拦,等于只堵了正门。
 */
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

/** 打开页面这一拍要结的账(只读页由各 store 自己拦下,这里照调不误) */
export function settleReturn(now: number): ReturnSettlements {
  const market = useMarketStore();
  const sold = market.collectConsign(now);
  market.sync(now);
  useBountyStore().sync(now);
  const apprentice = useApprenticeStore();
  apprentice.sync();
  const reaped = apprentice.collectFinished(now, usePlayerStore().major);
  return { sold, reaped };
}
