import { useEndgameStore } from "@/stores/endgame";
import { useResourcesStore } from "@/stores/resources";
import { daoSourceFillPlan, type DaoSourceFillPlan } from "@/ui/daoSourceFill";
import { toNum } from "@/utils/gnum";

/**
 * 道源入口短差(付不起置灰+列差):与 spendDaoSource 拒绝臂同口径。
 * 天道各入口(远征/虚界/天道变数/今日挑战/试炼/忆战重写)共用一份 ——
 * CelestialView 拆分后这些入口散在主文件与各面板里,同一行 Math.max
 * 只许活在这一处,不许各文件手抄(同一逻辑只许一份)。
 */
export function useDaoEntry() {
  const endgame = useEndgameStore();
  const resources = useResourcesStore();

  /** 道源入口差多少(付不起置灰+列差):与 spendDaoSource 拒绝臂同口径 */
  function daoEntryShort(cost: number): number {
    return Math.max(0, cost - endgame.daoSource);
  }

  /**
   * 「尚差 N 道源」之后呢 —— 差多少说完了，怎么补也要说。
   *
   * ## 为什么放在这里
   *
   * 道源不会自己长:没有挂机产出，只能靠熔炉与远征主动去挣。而天界有
   * 15 处「尚差 N 道源」，一句都没说下一步 —— 玩家手上是一个**不知道怎么填的坑**。
   * 答案其实就在同一页（天道熔炉，一次给 5 缕），但那需要先知道"熔炉能换道源"。
   *
   * 放在这里而不是各面板里，与 `daoEntryShort` 同一条理由:补法要看**同一个缺口**，
   * 而缺口只有一处算。各面板各拼一句，迟早出现「尚差 20」配「熔尽尚差 8」。
   *
   * ## 什么都不差时给 null
   *
   * 没有坑就不用指路 —— 否则每个付得起的入口旁边都挂一句"去熔炉"，
   * 那是噪音，而且会让玩家以为还差点什么。
   */
  function daoFill(cost: number): DaoSourceFillPlan | null {
    return daoSourceFillPlan(daoEntryShort(cost), {
      // 灵石是 GNum(大数),熔炉那条路按份计价 —— 取数值那一侧
      stone: toNum(resources.spiritStone),
      ore: resources.ore,
      page: resources.page,
      herb: resources.herb,
      dust: resources.dust,
    });
  }

  return { daoEntryShort, daoFill };
}
