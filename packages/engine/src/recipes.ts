/**
 * 配方执行(炼制 / 合成 / 烧制)—— "开炉 → 扣料 → 掷成败 → 双成"。
 *
 * `crafting.ts` 管的是**成功率怎么算**(四乘区、越级惩罚、熟练度);这一层管的是
 * **一次开炉实际发生了什么**。五条口径,每条都踩过:
 *
 *   一 **"没开炉" ≠ "开炉失败"**:材料不足、门槛没过是**没发生** —— 不扣料、不掷骰、
 *      不计失败、不涨技艺。两件事混在一起写,玩家会看到"炼制失败"却不知道炉子压根没开,
 *      数据上还会把"没做的事"记成"做砸了"(本作用 `aborted` 单列这一档)。
 *   二 **失败不是白费**:失败时按内容给的"保下多少"逐条折减花费(手越稳赔得越少),
 *      而门槛费(如货币)通常不退 —— 所以**每一条花费各自说明**,不是一个总比例。
 *   三 **成功之后才掷双成**:额外产出的概率在**成功之后**再掷一次,并夹到上限
 *      (本作夹 0.8:加成再高也别把"双成"写成"必双")。
 *   四 **随机只在真开炉时消耗**:没开炉一颗骰子都不掷;开炉则先掷成败,成功了才掷双成。
 *   五 回报里带 **`spent`:这一次实际扣了什么** —— 调用方照着记账,不必再算一遍
 *      (再算一遍就会与回报分叉)。
 *
 * 单位由内容定:花费的数额库**只原样带出、不做算术** —— "失败时这一条实际扣多少"也让内容算
 * (取整、大数、折扣率都是作品的事),所以同一份骨架能配 `number`,也能配 `{m,e}` 那样的大数。
 */
import type { Rng } from './rng.js'

/** 一条花费(键名由内容定:灵草 / 灵石 / 材料……) */
export interface CraftCost<A = number> {
  key: string
  amount: A
}

export interface CraftOutcome<A = number> {
  /** 炉开了吗(材料不足 / 门槛没过 = 没开) */
  fired: boolean
  /** 没开炉时给人看的原因(开炉了就是 '') */
  reason: string
  /** 成没成(没开炉时为 false) */
  succeeded: boolean
  /** 这一次实际扣掉的花费(没开炉时为空) */
  spent: readonly CraftCost<A>[]
  /** 产出件数(失败与没开炉都是 0) */
  produced: number
  /** 是双成 / 额外产出吗 */
  extra: boolean
  /** 这一次实际用的成功率 */
  chance: number
}

export interface RecipeRunnerConfig<Ctx = unknown, A = number> {
  /** 这一条配方要花什么 */
  costs: (recipeId: string, ctx: Ctx) => readonly CraftCost<A>[]
  /** 成功率(通常是 `crafting` 那套四乘区的输出;库会把它夹到 [0,1]) */
  rate: (recipeId: string, ctx: Ctx) => number
  /**
   * 开炉门槛:不行就返回一句人话(本作是"不知此方 / 参悟不足"这类)。
   * 与 `affordable` 的**顺序**是:门槛 → 材料 —— 顺序即玩家先看到哪句话。
   */
  blocked?: (recipeId: string, ctx: Ctx) => string | undefined
  /** 材料够不够(库不认识资源账本,所以由调用方查):不足就返回一句人话 */
  affordable?: (recipeId: string, ctx: Ctx) => string | undefined
  /**
   * 失败时这一条**实际扣多少**(不给就全扣)。
   * 库不做算术:取整、大数、按技艺保下多少,都是内容的事。
   */
  spentOnFail?: (cost: CraftCost<A>, recipeId: string, ctx: Ctx) => A
  /** 双成(额外产出)的概率(未配 = 不会双成) */
  bonus?: (recipeId: string, ctx: Ctx) => number
  /** 双成概率的上限(默认 1) */
  bonusCap?: number
  /** 基础产出件数(默认 1);双成时再加 1 */
  baseYield?: (recipeId: string, ctx: Ctx) => number
}

export function createRecipeRunner<Ctx = unknown, A = number>(config: RecipeRunnerConfig<Ctx, A>) {
  const bonusCap = config.bonusCap ?? 1

  /** 只有"真开炉"才走这里:先掷成败,成功了才掷双成 */
  const run = (recipeId: string, ctx: Ctx, rng: Rng): CraftOutcome<A> => {
    const costs = config.costs(recipeId, ctx)
    const blocked = config.blocked?.(recipeId, ctx)
    const affordable = blocked === undefined ? config.affordable?.(recipeId, ctx) : undefined
    if (blocked !== undefined || affordable !== undefined) {
      return {
        fired: false,
        reason: (blocked ?? affordable)!,
        succeeded: false,
        spent: [],
        produced: 0,
        extra: false,
        chance: 0
      }
    }

    const raw = config.rate(recipeId, ctx)
    // 成功率一律夹到 [0,1]:叠出来的概率不该有 1.8 或 NaN 传到掷骰那一步
    const chance = Math.min(1, Math.max(0, Number.isFinite(raw) ? raw : 0))
    const succeeded = rng.chance(chance)
    const spent: CraftCost<A>[] = []
    for (const cost of costs) {
      if (succeeded) {
        spent.push(cost)
      } else {
        spent.push({ key: cost.key, amount: config.spentOnFail ? config.spentOnFail(cost, recipeId, ctx) : cost.amount })
      }
    }
    if (!succeeded) {
      return { fired: true, reason: '', succeeded: false, spent, produced: 0, extra: false, chance }
    }

    const rawBonus = config.bonus?.(recipeId, ctx) ?? 0
    const bonusChance = Math.min(bonusCap, Math.max(0, Number.isFinite(rawBonus) ? rawBonus : 0))
    const extra = bonusChance > 0 ? rng.chance(bonusChance) : false
    const base = Math.max(0, Math.floor(config.baseYield?.(recipeId, ctx) ?? 1))
    return { fired: true, reason: '', succeeded: true, spent, produced: base + (extra ? 1 : 0), extra, chance }
  }

  return { bonusCap, run }
}

export type RecipeRunner<Ctx = unknown, A = number> = ReturnType<typeof createRecipeRunner<Ctx, A>>
