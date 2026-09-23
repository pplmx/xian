/**
 * 设施(洞府建筑)对库的接入 —— 内容(`data/buildings`)与口径仍住在本作,库只给骨架。
 *
 * 搬过来的是三件容易写歪的事:
 *   · **能不能升**:门槛不止一条(境界 / 已至顶层 / 受洞府等级所限),而判定的先后
 *     就是界面上先出现哪句话 —— 顺序与文案仍写在下面(内容),库只保证"能升"与
 *     "要花什么"出自同一次判定;
 *   · **等级上限取小**:自身上限与 `(洞府等级 + 1) × 5` 取小,且只封升级、不改已有等级;
 *   · **每小时产出**:速率写在这里的 `perHour`(灵田、藏经阁),零头怎么留、什么时候进位
 *     由库的 `accrue` 管 —— 一秒一次取整会把 1.5 悟道点/小时、2.4 玄铁/小时全部抹平。
 */
import type { BuildingId, GNum, StatMods } from '@/types'
import type { UpgradeInfo } from 'wanxiang-engine'
import { accrue, createFacilitySystem } from 'wanxiang-engine'
import { BUILDINGS, buildingDef } from '@/data/buildings'
import {
  FIELD_HERB_PER_HOUR,
  FIELD_ORE_PER_HOUR,
  LIBRARY_WUDAO_FLOOR_LEVEL,
  LIBRARY_WUDAO_MIN_PER_HOUR,
  LIBRARY_WUDAO_PER_HOUR
} from '@/data/constants'
import { buildingCost } from './formulas'

/** 藏经阁每级每小时悟道点 —— 低级(lv≤FLOOR_LEVEL)给保底起步(快赢3,ISS-303) */
export function libraryWudaoPerHour(lv: number): number {
  return lv <= LIBRARY_WUDAO_FLOOR_LEVEL
    ? Math.max(LIBRARY_WUDAO_MIN_PER_HOUR, lv * LIBRARY_WUDAO_PER_HOUR)
    : lv * LIBRARY_WUDAO_PER_HOUR
}

export interface FacilityCtx {
  /** 玩家当前境界 —— 只有"境界门槛"用得上它 */
  major: number
}

/**
 * 建筑效果与产出都与境界无关,故这两条读法不需要门槛信息。
 * 若哪天某座建筑的产出要看境界,得把 `major` 一路传进来(别让它悄悄算成 0)。
 */
const CTX_NO_REALM: FacilityCtx = { major: 0 }

/** 其余建筑的等级上限 = (洞府等级 + 1) × 5 —— 只写一处 */
export const BUILDING_LEVELS_PER_MANSION = 5
export function buildingLevelCapOf(mansionLevel: number): number {
  return (mansionLevel + 1) * BUILDING_LEVELS_PER_MANSION
}

/** 这一座的等级上限(洞府自己不受"由洞府决定"的那条限制) */
export function capOfBuilding(id: BuildingId, levels: Record<string, number>): number {
  const def = buildingDef(id)
  if (!def) return 0
  if (def.id === 'mansion') return def.maxLevel
  return Math.min(def.maxLevel, buildingLevelCapOf(levels.mansion ?? 0))
}

/** 每小时的产出:内容写"每小时多少",库负责按秒推进与留零头 */
const PER_HOUR: Partial<Record<BuildingId, (level: number) => Record<string, number>>> = {
  field: lv => ({ herb: lv * FIELD_HERB_PER_HOUR, ore: lv * FIELD_ORE_PER_HOUR }),
  library: lv => ({ wudao: libraryWudaoPerHour(lv) })
}

/** 建筑门槛里的境界说法(与迁移前的文案一致) */
const UNLOCK_REALM_NAMES = ['炼气', '筑基', '金丹']

const FACILITIES = createFacilitySystem<StatMods, FacilityCtx, GNum | number>({
  facilities: BUILDINGS.map(def => {
    const perHour = PER_HOUR[def.id]
    return {
      id: def.id,
      name: def.name,
      maxLevel: def.maxLevel,
      cap: levels => capOfBuilding(def.id, levels),
      capReason: '受洞府等级所限',
      // 顺序即界面的说法:先报"境界不够",再报"已至顶层"(与迁移前同一顺序)
      blocked: (_levels, level, ctx) =>
        ctx.major < def.unlockRealm
          ? `需 ${UNLOCK_REALM_NAMES[def.unlockRealm] ?? '更高'} 境`
          : level >= def.maxLevel
            ? '已至顶层'
            : undefined,
      costs: level => {
        const costs: Array<{ key: 'stone' | 'ore'; amount: number | GNum }> = [
          { key: 'stone', amount: buildingCost(def.costBase, level) }
        ]
        // 快赢·首级免玄铁(ISS-303):从 0 级升 1 级不掏玄铁。
        // 玄铁在 0~2 境是前期唯一卡建筑的资源(ratio≈0.3),首级豁免
        // 让玩家先把门面立起来,又不改 3 境后的曲线(那里玄铁本就过剩)。
        if (level > 0) costs.push({ key: 'ore', amount: def.costOre * (level + 1) })
        return costs
      },
      ...(def.mods ? { mods: (level: number) => def.mods!(level) } : {}),
      ...(perHour ? { perHour } : {})
    }
  })
})

/** "能不能升、为什么、下一级是几级、要花什么" —— 费用键仍是本作的两个(灵石 / 玄铁) */
export function buildingUpgradeInfoOf(
  id: BuildingId,
  levels: Record<string, number>,
  major: number
): UpgradeInfo<GNum | number> {
  return FACILITIES.upgradeInfo(levels, id, { major })
}

/** 建筑带来的属性来源(顺序即 BUILDINGS 顺序)—— 喂给本作的属性汇总 */
export function buildingModSources(levels: Record<string, number>): StatMods[] {
  return FACILITIES.modsOf(levels, CTX_NO_REALM)
}

/** 各建筑合计的每小时产出 */
export function buildingRates(levels: Record<string, number>): Record<string, number> {
  return FACILITIES.ratesOf(levels, CTX_NO_REALM)
}

/** 按秒推进产出:速率来自建筑等级,零头留在累加器里(见库的 `accrue`) */
export function produceOf(
  frac: Readonly<Record<string, number>>,
  levels: Record<string, number>,
  sec: number
): ReturnType<typeof accrue> {
  return accrue(frac, buildingRates(levels), sec)
}
