/**
 * 丹方阶位的读法 —— 同一个字段，不许有两种意思。
 *
 * ## 矛盾
 *
 * `PillDef.alchemyLevel` 在两条路上被读了两次，意思不同：
 *
 *   `data/crafting.recipeCraft`  —— 读作**阶位**（这张方子有多难），
 *                                   注释明写「旧口径里是解锁所需丹炉等级，
 *                                   此处改读为丹方阶位」。
 *   `core/loreService.seedLoreIfNeeded`
 *                                —— 仍当作**丹炉门槛**：`alchemyLevel <= dongfu.alchemyLevel`
 *                                   才把这张方子补进老档。
 *
 * 同一份数据、同一个字段，一处说「不是开关」，一处拿它当开关。
 * 而 `studiableRecipes` 的注释更直接：「两道限制都不是『解锁开关』（那是 Phase 32.3
 * 废掉的旧口径）」—— 那两道路径读的是**境界**与**阶位上限**，与炉子等级无关。
 *
 * ## 后果
 *
 * 26 张方子的 `alchemyLevel` 是 10，而炼丹炉满级恰好是 10。于是：
 *   新档按 `studiableRecipes` 正常翻方（不看炉子）；
 *   而老档走 `seedLoreIfNeeded` 补账，炉子没满级的那 26 张**一张都不补**。
 * 同一个玩家、同一份境界，只因为「档是新是旧」，能翻到的方子不一样。
 *
 * ## 这一轮怎么修
 *
 * 把 `seedLoreIfNeeded` 改成与 `studiableRecipes` **同一条判据**：
 * 境界 ≤ 当前，阶位 ≤ 可承受阶位 + 够一够的余量。炉子等级不再是方的门槛
 * ——它本来就只是「炉子的产能」，`data/buildings` 里写得很清楚
 * （`alchemyYield: lv * ALCHEMY_YIELD_PER_LEVEL`）。
 */

/** 丹方的两道门槛 —— 与 studiableRecipes 同一份口径 */
export interface RecipeGate {
  /** 这张方子写给谁看 */
  minRealm: number;
  /** 这张方子有多难(阶位) */
  rank: number;
}

export interface RecipeGateInput {
  /** 当下大境界 */
  major: number;
  /** 当下读得懂的阶位上限(含「够一够」的余量) */
  ceiling: number;
}

/**
 * 这张方子此刻够不够得着。
 *
 * **不看丹炉等级** —— 那不是方的门槛,是炉子的产能。
 */
export function recipeReachable(gate: RecipeGate, input: RecipeGateInput): boolean {
  if (!Number.isFinite(gate.minRealm) || !Number.isFinite(gate.rank)) return false;
  if (!Number.isFinite(input.major) || !Number.isFinite(input.ceiling)) return false;
  return gate.minRealm <= input.major && gate.rank <= input.ceiling;
}
