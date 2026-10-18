import { computed } from "vue";
import { useResourcesStore } from "@/stores/resources";
import { useUiStore } from "@/stores/ui";
import {
  HERB_GRADES,
  HERB_GRADE_NAMES,
  HERB_GRADE_SHORT,
  herbBuyPrice,
  herbGradeBandLabel,
  type HerbGrade,
} from "@/data/herbGrades";
import { buyHerbs } from "@/core/herbMarketService";
import { formatGN } from "@/utils/format";
import { gn, toNum } from "@/utils/gnum";

/**
 * 灵草坊(ISS-306)的账本 —— InventoryView(入口)与 HerbShopDialog(弹窗)同源调用。
 * 与炼丹无关(灵石购草,只进不出),故不进 useBrewing,单开一域;
 * 逐品持有读数走 resources.herbOf —— 与 useBrewing.herbGradeHeld 是同一个底层,不另抄一套。
 */
export function useHerbShop() {
  const resources = useResourcesStore();
  const ui = useUiStore();

  const marketRows = computed(() =>
    HERB_GRADES.map((g) => {
      const price = herbBuyPrice(g);
      return {
        grade: g,
        name: HERB_GRADE_NAMES[g],
        held: resources.herbOf(g),
        // 这品草喂哪个境界的方子:十倍一翻的贵价,落处得写明白(读分档表,不另写)
        usage: herbGradeBandLabel(g),
        price, // 单价 :number,模板里走 formatGN 排版(千→「1,000」,万→「1000万」)
        // 可买性与购入口径同款(hasStone = buyHerbs 的判定);买十是十株的门槛,
        // 拿单株价放行只会出现「买10 亮着、点了才弹灵石不足」(曾真这么坏过)
        affordable: resources.hasStone(gn(price)),
        affordable10: resources.hasStone(gn(price * 10)),
        // 尚差:灰按钮不告诉差多少等于没说完(法宝炼化同款句式)
        short: Math.max(0, price - toNum(resources.spiritStone)),
        short10: Math.max(0, price * 10 - toNum(resources.spiritStone)),
      };
    }),
  );

  function buyOne(grade: HerbGrade) {
    const r = buyHerbs(grade, 1);
    if (r.ok)
      ui.toast(
        `灵草坊:花 ${formatGN(r.costPerHerb)} 灵石,得 ${HERB_GRADE_SHORT[grade]}灵草×${r.herbs}`,
        "info",
      );
    else if (r.reason === "noStone") ui.toast("灵石不足", "warn");
  }
  function buyTen(grade: HerbGrade) {
    const r = buyHerbs(grade, 10);
    if (r.ok)
      ui.toast(
        `灵草坊:花 ${formatGN(r.costPerHerb * 10)} 灵石,得 ${HERB_GRADE_SHORT[grade]}灵草×${r.herbs}`,
        "info",
      );
    else if (r.reason === "noStone") ui.toast("灵石不足", "warn");
  }

  return { marketRows, buyOne, buyTen };
}
