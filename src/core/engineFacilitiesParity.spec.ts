/**
 * 设施对账 —— 洞府建筑的"能不能升"与"每小时产出"搬进库之后,一位不差。
 *
 * 与 engineParity 同一条纪律:下面 `legacy*` 是**迁移前那两段实现的原样冻结**
 * (`core/buildingService.buildingUpgradeInfo` 的门槛与费用、`stores/dongfu.produce` 的
 * 产出推进),与 `core/engineFacilities` 用同一组输入跑,逐字段比。比三件玩家看得见的事:
 *
 *   ① 门槛:**先报哪一句话**必须一样(境界不够 vs 已至顶层 vs 受洞府等级所限);
 *   ② 费用:灵石是大数(GNum),用 `formatExact` 逐位比 —— 曲线错一点,长线就崩;
 *   ③ 产出:**零头**必须一样。1.5 悟道点/小时、2.4 玄铁/小时这类小数速率,一旦哪一处
 *      改成"每次取整再累加",整条产线就会被悄悄抹平(而且只在长时间挂机后才看得出来)。
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { BuildingId } from '@/types'
import { BUILDINGS, buildingDef } from '@/data/buildings'
import {
  FIELD_HERB_PER_HOUR,
  FIELD_ORE_PER_HOUR,
  LIBRARY_WUDAO_PER_HOUR
} from '@/data/constants'
import { buildingUpgradeInfo } from './buildingService'
import { buildingCost } from './formulas'
import { produceOf } from './engineFacilities'
import { formatExact } from '@/utils/format'
import { useDongfuStore } from '@/stores/dongfu'
import { usePlayerStore } from '@/stores/player'
import { useResourcesStore } from '@/stores/resources'

type LevelMap = Record<BuildingId, number>

/** 迁移前的"能不能升"(冻结) */
function legacyUpgradeInfo(id: BuildingId, levels: LevelMap, major: number, levelCap: number) {
  const def = buildingDef(id)!
  const lv = levels[id] ?? 0
  const stone = buildingCost(def.costBase, lv)
  const ore = def.costOre * (lv + 1)
  let canUpgrade = true
  let reason = ''
  if (major < def.unlockRealm) {
    canUpgrade = false
    reason = `需 ${['炼气', '筑基', '金丹'][def.unlockRealm] ?? '更高'} 境`
  } else if (lv >= def.maxLevel) {
    canUpgrade = false
    reason = '已至顶层'
  } else if (id !== 'mansion' && lv >= levelCap) {
    canUpgrade = false
    reason = '受洞府等级所限'
  }
  return { canUpgrade, reason, stone, ore, nextLevel: lv + 1 }
}

/** 迁移前的产出推进(冻结):按设施各加一份,再按键把整数发出去 */
function legacyProduce(
  fracIn: Record<string, number>,
  levels: LevelMap,
  dtSec: number
): { frac: Record<string, number>; whole: Record<string, number> } {
  const frac = { herb: fracIn.herb ?? 0, ore: fracIn.ore ?? 0, wudao: fracIn.wudao ?? 0 }
  const fieldLv = levels.field
  const libLv = levels.library
  if (fieldLv > 0) {
    frac.herb += (fieldLv * FIELD_HERB_PER_HOUR * dtSec) / 3600
    frac.ore += (fieldLv * FIELD_ORE_PER_HOUR * dtSec) / 3600
  }
  if (libLv > 0) {
    frac.wudao += (libLv * LIBRARY_WUDAO_PER_HOUR * dtSec) / 3600
  }
  const whole: Record<string, number> = {}
  for (const key of ['herb', 'ore', 'wudao'] as const) {
    const emit = Math.floor(frac[key])
    if (emit >= 1) {
      frac[key] -= emit
      whole[key] = emit
    }
  }
  return { frac, whole }
}

const zeroLevels = (): LevelMap => ({ mansion: 0, array: 0, alchemy: 0, forge: 0, field: 0, library: 0, beast: 0 })

const levelCases: [string, LevelMap][] = [
  ['全 0 级', zeroLevels()],
  ['洞府 1 级(其余上限 10)', { ...zeroLevels(), mansion: 1 }],
  ['满洞府 + 各建筑满级', { ...zeroLevels(), mansion: 4, array: 20, alchemy: 10, forge: 10, field: 15, library: 12, beast: 8 }],
  ['洞府卡住其余建筑(洞府 1 级、灵兽园已 5 级)', { ...zeroLevels(), mansion: 1, beast: 5 }],
  ['超上限的坏档(洞府 0 级、灵兽园 8 级)', { ...zeroLevels(), beast: 8 }]
]

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('设施对账 —— 能不能升 / 为什么 / 要花什么', () => {
  it('七座建筑 × 五组等级 × 四档境界:门槛文案、下一级与费用逐位相同', () => {
    for (const [label, levels] of levelCases) {
      for (const major of [0, 1, 2, 3]) {
        for (const def of BUILDINGS) {
          useDongfuStore().levels = { ...levels }
          usePlayerStore().major = major
          const mine = buildingUpgradeInfo(def.id)
          const cap = (levels.mansion + 1) * 5
          const frozen = legacyUpgradeInfo(def.id, levels, major, cap)
          const where = `${label} · ${def.name} · 境界 ${major}`
          expect(mine.canUpgrade, where).toBe(frozen.canUpgrade)
          expect(mine.reason, where).toBe(frozen.reason)
          expect(mine.nextLevel, where).toBe(frozen.nextLevel)
          expect(mine.ore, where).toBe(frozen.ore)
          expect(formatExact(mine.stone), `${where} 的灵石费`).toBe(formatExact(frozen.stone))
        }
      }
    }
  })

  it('先说哪一句也钉住:境界不够时,即使已经到顶也先报境界', () => {
    useDongfuStore().levels = { ...zeroLevels(), mansion: 4, library: 12 }
    usePlayerStore().major = 0 // 藏经阁需筑基
    expect(buildingUpgradeInfo('library').reason).toBe('需 筑基 境')
    usePlayerStore().major = 2
    expect(buildingUpgradeInfo('library').reason).toBe('已至顶层')
  })

  it('受洞府所限那一档:洞府 1 级 → 其余建筑止步 10 级(灵兽园自身上限更小,取小)', () => {
    usePlayerStore().major = 3
    useDongfuStore().levels = { ...zeroLevels(), mansion: 1, beast: 5, array: 10 }
    expect(buildingUpgradeInfo('beast').canUpgrade).toBe(true) // 灵兽园上限 8,还没到
    expect(buildingUpgradeInfo('array').canUpgrade).toBe(false)
    expect(buildingUpgradeInfo('array').reason).toBe('受洞府等级所限')
    expect(buildingUpgradeInfo('mansion').canUpgrade).toBe(true) // 洞府自己不受此限
  })
})

describe('设施对账 —— 每小时产出与零头', () => {
  const dtCases = [0, 1, 7, 60, 900, 3600, 12345.7]

  it('五组等级 × 七档时长:累加器与发出去的整数逐位相同', () => {
    for (const [label, levels] of levelCases) {
      for (const dt of dtCases) {
        const start = { herb: 0, ore: 0, wudao: 0 }
        const mine = produceOf(start, levels, dt)
        const frozen = legacyProduce(start, levels, dt)
        expect(mine.frac, `${label} · ${dt}s`).toEqual(frozen.frac)
        expect(mine.whole, `${label} · ${dt}s`).toEqual(frozen.whole)
      }
    }
  })

  it('连推 600 次(每秒一拍):零头一点点攒,整数一份份发,总量与冻结口径一致', () => {
    const levels: LevelMap = { ...zeroLevels(), field: 3, library: 7 }
    let mine = { herb: 0, ore: 0, wudao: 0 }
    let frozen = { herb: 0, ore: 0, wudao: 0 }
    let mineTotal = { herb: 0, ore: 0, wudao: 0 }
    let frozenTotal = { herb: 0, ore: 0, wudao: 0 }
    for (let i = 0; i < 600; i += 1) {
      const a = produceOf(mine, levels, 1)
      const b = legacyProduce(frozen, levels, 1)
      mine = a.frac as typeof mine
      frozen = b.frac as typeof frozen
      mineTotal = { herb: mineTotal.herb + (a.whole.herb ?? 0), ore: mineTotal.ore + (a.whole.ore ?? 0), wudao: mineTotal.wudao + (a.whole.wudao ?? 0) }
      frozenTotal = { herb: frozenTotal.herb + (b.whole.herb ?? 0), ore: frozenTotal.ore + (b.whole.ore ?? 0), wudao: frozenTotal.wudao + (b.whole.wudao ?? 0) }
    }
    expect(mine).toEqual(frozen)
    expect(mineTotal).toEqual(frozenTotal)
    // 十分钟的量对得上:灵田 3 级 = 18 灵草/小时、7.2 玄铁/小时;藏经阁 7 级 = 10.5 悟道/小时
    expect(mineTotal).toEqual({ herb: 3, ore: 1, wudao: 1 })
  })

  it('拆了设施也要把攒下的零头发出来(不然那份就一直烂在累加器里)', () => {
    const dangling = { herb: 1.2, ore: 0.4, wudao: 0 }
    expect(produceOf(dangling, zeroLevels(), 0)).toEqual(legacyProduce(dangling, zeroLevels(), 0))
    expect(produceOf(dangling, zeroLevels(), 0).whole).toEqual({ herb: 1 })
  })

  it('走一遍真 store:产出的数进的就是财货库存,累加器也按冻结口径留下', () => {
    const dongfu = useDongfuStore()
    const resources = useResourcesStore()
    dongfu.levels = { ...zeroLevels(), field: 3, library: 7 }
    resources.herb = 0
    resources.ore = 0
    resources.wudao = 0
    dongfu.produce(600)
    const frozen = legacyProduce({ herb: 0, ore: 0, wudao: 0 }, dongfu.levels, 600)
    expect(dongfu.frac).toEqual(frozen.frac)
    expect(resources.herb).toBe(frozen.whole.herb ?? 0)
    expect(resources.ore).toBe(frozen.whole.ore ?? 0)
    expect(resources.wudao).toBe(frozen.whole.wudao ?? 0)
    // 600 秒 = 十分钟:灵田 3 级该出 3 株灵草(18/小时),玄铁 1 块(7.2/小时),悟道 1 点(10.5/小时)
    expect(resources.herb).toBe(3)
    expect(resources.ore).toBe(1)
    expect(resources.wudao).toBe(1)
  })
})
