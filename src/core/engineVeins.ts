/**
 * 灵脉投资点对库的接入 —— 内容(`data/veins`)与口径仍住在本作,库只给骨架。
 *
 * 搬过来的是"加点系统"的四条结构规则(见库的 `points.ts`):
 *   总容量 100(方向即取舍)/ 主脉 70 与副脉 30 两档上限 / 换主脉只换方向不作废已投点数 /
 *   **投不成什么都不改**(含"首投自动认主"只能在投成功那一次生效 —— 迁移前这里有个坑:
 *   点了却没灵石的那一次,主脉会被悄悄定在没投成的那条脉上)。
 *
 * 每点效果仍由本作口径给:单纯"每点 × 点数"相加,不走属性汇总的递减。
 */
import type { GNum, StatMods } from '@/types'
import type { PointState, SwitchOutcome, InvestOutcome } from 'wanxiang-engine'
import { createPointPool } from 'wanxiang-engine'
import type { VeinId } from '@/data/veins'
import { VEINS } from '@/data/veins'
import {
  VEIN_MAIN_CAPACITY,
  VEIN_POINT_STONE,
  VEIN_SIDE_CAP,
  VEIN_TOTAL_CAPACITY,
  VEIN_UNLOCK_MAJOR
} from '@/data/constants'
import { stoneByTier } from './formulas'

/** 门槛看境界,费用看玩家层级(两者都由调用方给 —— 库不认识"境界"是什么) */
export interface VeinCtx {
  major: number
  tier: number
}

/** 每点效果 × 已投点数 */
function scalePerPoint(perPoint: StatMods, points: number): StatMods {
  const out: StatMods = {}
  for (const key of Object.keys(perPoint) as (keyof StatMods)[]) out[key] = (perPoint[key] ?? 0) * points
  return out
}

const VEIN_POOL = createPointPool<StatMods, VeinCtx, GNum>({
  branches: VEINS.map(def => ({ id: def.id, name: def.name, effect: points => scalePerPoint(def.perPoint, points) })),
  total: VEIN_TOTAL_CAPACITY,
  mainCap: VEIN_MAIN_CAPACITY,
  sideCap: VEIN_SIDE_CAP,
  fullReason: '灵脉容量已尽,唯有取舍',
  mainCapReason: '主脉已至圆满',
  sideCapReason: '副脉有其上限,欲再进须立为主脉',
  // 未开放时**不说理由**:界面本来就不显示灵脉,迁移前也不提示
  blocked: (_state, _id, ctx) => (ctx.major >= VEIN_UNLOCK_MAJOR ? undefined : ''),
  costs: (_state, _id, ctx) => [{ key: 'stone', amount: veinPointCostAt(ctx.tier) }],
  switchCosts: (_state, _id, ctx) => [{ key: 'stone', amount: veinSwitchCostAt(ctx.tier) }]
})

/** 本作的点数账 → 库的状态(点数 + 主脉) */
export function veinStateOf(points: Record<VeinId, number>, main: VeinId | null): PointState {
  return { points, main }
}

/** 已投总点数(按账上所有键算) */
export function veinTotalOf(state: PointState): number {
  return VEIN_POOL.totalOf(state)
}

/** 这一条当前可投上限(主脉 70 / 副脉 30) */
export function veinCapOf(state: PointState, id: VeinId): number {
  return VEIN_POOL.capOf(state, id)
}

/** 单点投资成本(按玩家当前层级) */
export function veinPointCostAt(tier: number): GNum {
  return stoneByTier(tier, VEIN_POINT_STONE)
}

/** 主脉迁移费 */
export function veinSwitchCostAt(tier: number): GNum {
  return stoneByTier(tier, VEIN_POINT_STONE * 20)
}

/** 投一点:门槛、容量、上限与费用出自库的同一次判定(投不成时状态原样返回) */
export function investVeinIn(state: PointState, id: VeinId, ctx: VeinCtx): InvestOutcome<GNum> {
  return VEIN_POOL.invest(state, id, ctx)
}

/** 换主脉:只有方向变,已投点数一条都不动 */
export function switchVeinMainIn(state: PointState, id: VeinId, ctx: VeinCtx): SwitchOutcome<GNum> {
  return VEIN_POOL.switchMain(state, id, ctx)
}

/** 灵脉带来的属性加成(悟道脉走参悟折扣,不在此表) */
export function veinModsOf(state: PointState): StatMods {
  const out: StatMods = {}
  for (const mods of VEIN_POOL.effectsOf(state)) {
    for (const key of Object.keys(mods) as (keyof StatMods)[]) out[key] = (out[key] ?? 0) + (mods[key] ?? 0)
  }
  return out
}
