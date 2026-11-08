/**
 * 炼丹的**纯数字** —— 成本与保料比例。
 *
 * ## 为什么单独一个文件
 *
 * 这两个函数原住在 `pillService` 里,而 `engineCraft` 要调它们(开炉要算成本)、
 * `pillService` 又要调 `engineCraft`(开炉本身在那里)—— 两个模块互相 import,
 * 构成 `importCycles` 里的一个环。
 *
 * 拆出来之后依赖是单向的:`engineCraft` / `pillService` / 界面 **都** 向这里取数,
 * 而这里只依赖 `data/`(丹方表、区域表、灵草档),不认识任何 store、不碰随机数。
 *
 * 判断依据很简单:这两个函数**没有任何状态**——同样的输入永远同样的输出。
 * 它们本来就该住在数据层旁边,只是当初写在了服务模块里。
 */
import { pillDef } from "@/data/pills";
import { maxTierForMajor } from "@/data/regions";
import { herbGradeOfMajor, type HerbGrade } from "@/data/herbGrades";
import { stoneByTier } from "./formulas";
import type { GNum } from "@/types";

export interface PillCraftCost {
  /** 这张方子烧几株灵草 */
  herb: number;
  /** 这张方子烧哪个品阶的灵草:凡品聚气散到道品道祖丹,各按自己的界 */
  herbGrade: HerbGrade;
  stone: GNum;
}

export function pillCraftCost(id: string): PillCraftCost | null {
  const def = pillDef(id);
  if (!def?.recipe) return null;
  /**
   * 灵石开销按这张方子**准入境界能拿到的最高层级**折算。
   *
   * 从前这里自写 `minRealm × 2 + 1`,界外就飞出区域表了:第 18 境的方子算出层级 37,
   * 而玩家在混沌海能到的最高层级是 32 —— 一张方子的价格凭空高出 322 倍(1.9^5),
   * 于是界外炼丹被自己的报价挡在门外(ISS-211)。层级只有一个事实源:区域表。
   */
  const tier = maxTierForMajor(def.minRealm);
  return {
    herb: def.recipe.herb,
    herbGrade: herbGradeOfMajor(def.minRealm),
    stone: stoneByTier(tier, def.recipe.stoneBase / 10),
  };
}

/**
 * 失手时按技艺随机保下的残料比例:手越稳,赔得越少。
 *
 * 导出供界面与 `core/pillValue.ts` 折算炼制代价 —— 那边若另抄一份,两处口径迟早分叉。
 */
export function salvageRatio(skill: number): number {
  return 0.2 + 0.3 * Math.min(1, skill / 100);
}
