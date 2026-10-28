/**
 * 全丹方规模夹具 —— 开炉弹窗的长列表门需要终局真实体量。
 *
 * 54 张方子每张都摊代价、成品、把握、双成、存货、短板与两枚动作;
 * 这里从内容表算出已知方与各品灵草的充足存量,不手抄 id、不另写件数。
 * 只用于自检,不参与游戏运行。
 */
import { HERB_GRADES, herbGradeOfMajor, type HerbGrade } from "../../src/data/herbGrades";
import { PILLS } from "../../src/data/pills";

const RECIPE_ROWS = PILLS.filter((pill) => pill.recipe);

export const FULL_RECIPE_COUNT = RECIPE_ROWS.length;
export const FULL_RECIPE_SEARCH_NAME = RECIPE_ROWS[0]?.name ?? "";

export function fullRecipeSlices() {
  const maxHerbByGrade: Record<HerbGrade, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const pill of RECIPE_ROWS) {
    const grade = herbGradeOfMajor(pill.minRealm);
    maxHerbByGrade[grade] = Math.max(maxHerbByGrade[grade], pill.recipe?.herb ?? 0);
  }

  return {
    lore: {
      recipeLore: Object.fromEntries(RECIPE_ROWS.map((pill) => [pill.id, 1])),
    },
    resources: {
      spiritStone: { m: 9, e: 30 },
      // 单炼与连炼都要留在可炼态;六倍最高单炉耗量足以撑过门里的动作探针。
      herbs: Object.fromEntries(HERB_GRADES.map((grade) => [grade, maxHerbByGrade[grade] * 6])),
    },
  };
}
