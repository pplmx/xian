import { useEndgameStore } from "@/stores/endgame";

/**
 * 道源入口短差(付不起置灰+列差):与 spendDaoSource 拒绝臂同口径。
 * 天道各入口(远征/虚界/天道变数/今日挑战/试炼/忆战重写)共用一份 ——
 * CelestialView 拆分后这些入口散在主文件与各面板里,同一行 Math.max
 * 只许活在这一处,不许各文件手抄(同一逻辑只许一份)。
 */
export function useDaoEntry() {
  const endgame = useEndgameStore();
  /** 道源入口差多少(付不起置灰+列差):与 spendDaoSource 拒绝臂同口径 */
  function daoEntryShort(cost: number): number {
    return Math.max(0, cost - endgame.daoSource);
  }
  return { daoEntryShort };
}
