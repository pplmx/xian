/**
 * 炼丹执行对库的接入 —— 成功率仍由 `core/craftability` 算、花费与保料仍是本作口径,
 * 库只给"开炉 → 扣料 → 掷成败 → 双成"这一串**顺序与边界**(见 packages/engine 的 recipes)。
 *
 * 这里定三件事:
 *   · **"没开炉"与"开炉失败"分开**:门槛没过 / 材料不足都走 `fired: false`
 *     (不扣料、不掷骰、不计失败)—— 从前这点隐含在几个"提前 return"里,现在是一个明确的回报;
 *   · **失败时灵草按技艺保下一部分、灵石不退**:逐条花费各自说明(算术仍在本作:要取整);
 *   · **双成在成功之后再掷一次,且夹在 0.8**:那行 `Math.min(0.8, …)` 的意图
 *     ("加成再高也别必双")现在是库的参数。
 */
import type { GNum } from '@/types'
import type { CraftCost, CraftOutcome } from 'wanxiang-engine'
import type { Rng } from 'wanxiang-engine'
import { createRecipeRunner } from 'wanxiang-engine'
import { craftability } from './craftability'
import { pillCraftCost, salvageRatio } from './pillService'
import { modOf } from './statsCalc'
import { usePlayerStore } from '@/stores/player'

/** 双成概率的上限:加成再高也别把"双成"写成"必双" */
export const ALCHEMY_BONUS_CAP = 0.8

/** 一次开炉的上下文:配方 id + 账本够不够(账本由调用方查,库不认识资源) */
export interface CraftCtx {
  pillId: string
  canPay: boolean
}

/** 双成概率 = 炉子给的那份 + 「炼丹产出」词条 */
export function alchemyBonus(pillId: string): number {
  const able = craftability(pillId)
  if (!able) return 0
  return able.bonusChance + modOf(usePlayerStore().finalStats.mods, 'alchemyYield')
}

const RUNNER = createRecipeRunner<CraftCtx, number | GNum>({
  costs: (_id, ctx) => {
    const cost = pillCraftCost(ctx.pillId)
    return cost ? [{ key: 'herb', amount: cost.herb }, { key: 'stone', amount: cost.stone }] : []
  },
  rate: (_id, ctx) => craftability(ctx.pillId)?.successRate ?? 0,
  // 顺序即玩家先看到哪句话:先"知不知此方",再"料够不够"
  blocked: (_id, ctx) => craftability(ctx.pillId)?.blockers[0],
  affordable: (_id, ctx) => (ctx.canPay ? undefined : '灵草或灵石不足'),
  // 失败时灵草按技艺保下一部分(手越稳赔得越少),灵石不退
  spentOnFail: (cost, _id, ctx) =>
    cost.key === 'herb'
      ? (cost.amount as number) - Math.floor((cost.amount as number) * salvageRatio(craftability(ctx.pillId)?.skill ?? 0))
      : cost.amount,
  bonus: (_id, ctx) => alchemyBonus(ctx.pillId),
  bonusCap: ALCHEMY_BONUS_CAP
})

/** 开一次炉:成功率、扣料与双成全部出自库的同一次判定 */
export function runCraft(recipeId: string, ctx: CraftCtx, rng: Rng): CraftOutcome<number | GNum> {
  return RUNNER.run(recipeId, ctx, rng)
}

/** 从回报里取某一条实际扣的数额(调用方照着记账) */
export function spentOf(out: CraftOutcome<number | GNum>, key: string): number | GNum | undefined {
  return (out.spent as readonly CraftCost<number | GNum>[]).find(cost => cost.key === key)?.amount
}
