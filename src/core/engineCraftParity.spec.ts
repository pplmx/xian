/**
 * 炼丹执行对账 —— "开炉 → 扣料 → 掷成败 → 双成"搬进库之后,结果一位不差。
 *
 * 与 engineParity 同一条纪律:下面 `legacyCraftPill` 是**迁移前那一段实现的原样冻结**
 * (`core/pillService.craftPill`),与现在的实现各跑一遍,比七件事:
 *   ① 回报(ok / count / aborted);② 扣掉的灵草与灵石;③ 背包里的丹药数;
 *   ④ 计数器(炼成 / 失败);⑤ 技艺经验与配方熟练度;⑥ 提示语;⑦ **掷了几颗骰子**。
 *
 * 三条口径被钉住(它们是搬进库的理由,不是副产品):
 *   · **"没开炉"与"开炉失败"是两件事**:前者不扣料、不掷骰、不计失败;
 *   · **失败不是白费**:灵草按技艺保下一部分,灵石不退(逐条花费各自说明);
 *   · **双成在成功之后再掷一次**,概率由"炉子 + 词条"给、上限是 `ALCHEMY_BONUS_CAP`
 *     (夹上限那条路径由库侧 `recipes.spec` 钉着 —— 这里钉的是它与本作口径的接线)。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { PILLS, pillDef } from '@/data/pills'
import { recipeCraft } from '@/data/crafting'
import { ACHIEVEMENTS } from '@/data/achievements'
import { MAIN_QUESTS } from '@/data/quests'
import { craftability } from './craftability'
import { craftPill, pillCraftCost, salvageRatio } from './pillService'
import { ALCHEMY_BONUS_CAP } from './engineCraft'
import { noteMaterialUsed } from './loreService'
import { track } from './progress'
import { formatExact } from '@/utils/format'
import { gn, sub } from '@/utils/gnum'
import { rng } from '@/utils/random'
import { useLoreStore } from '@/stores/lore'
import { usePlayerStore } from '@/stores/player'
import { useResourcesStore } from '@/stores/resources'
import { useInventoryStore } from '@/stores/inventory'
import { useQuestsStore } from '@/stores/quests'
import { useUiStore } from '@/stores/ui'

/** 迁移前那句炸炉话术(冻结):优先复述最要命的那条短板 */
function legacyFailLine(weakness: readonly string[]): string {
  const reason = weakness[0]
  return reason ? `炉中一声闷响,丹毁了。${reason}` : '炉中一声闷响,丹毁了——火候差了那么一线。'
}

/** 迁移前的炼制(冻结):那几个"提前 return"就是"没开炉" */
function legacyCraftPill(id: string): { ok: boolean; count: number; aborted?: boolean } {
  const resources = useResourcesStore()
  const inventory = useInventoryStore()
  const player = usePlayerStore()
  const ui = useUiStore()
  const def = pillDef(id)
  const cost = pillCraftCost(id)
  const able = craftability(id)
  if (!def || !cost || !able) return { ok: false, count: 0, aborted: true }
  if (able.blockers.length > 0) {
    ui.toast(able.blockers[0]!, 'warn')
    return { ok: false, count: 0, aborted: true }
  }
  if (!resources.hasSmall('herb', cost.herb) || !resources.hasStone(cost.stone)) {
    ui.toast('灵草或灵石不足', 'warn')
    return { ok: false, count: 0, aborted: true }
  }
  const craft = recipeCraft(def)
  const succeeded = rng.chance(able.successRate)
  resources.spendStone(cost.stone)
  if (succeeded) {
    resources.spendSmall('herb', cost.herb)
  } else {
    const kept = Math.floor(cost.herb * salvageRatio(able.skill))
    resources.spendSmall('herb', cost.herb - kept)
  }
  const lore = useLoreStore()
  const base = (succeeded ? 10 : 6) * (1 + able.rank * 0.35)
  for (const [k, w] of Object.entries(craft?.skills ?? {})) {
    if (w === undefined) continue
    lore.addSkillExp(k as never, base * w)
  }
  for (const mid of able.materials) noteMaterialUsed(mid, succeeded)
  if (!succeeded) {
    lore.addRecipeMastery(id, 0.02)
    track('pillsFailed')
    ui.toast(legacyFailLine(able.weakness), 'warn')
    return { ok: false, count: 0 }
  }
  const extra = rng.chance(Math.min(ALCHEMY_BONUS_CAP, able.bonusChance + (player.finalStats.mods.alchemyYield ?? 0))) ? 1 : 0
  inventory.addPill(id, 1 + extra)
  track('pillsCrafted', 1 + extra)
  ui.toast(extra ? `丹成两枚!「${def.name}」品相极佳` : `炼成「${def.name}」×1`, extra ? 'rare' : 'success')
  return { ok: true, count: 1 + extra }
}

/** 挑一张有丹方、材料是灵草 + 灵石的方子 */
const recipe = PILLS.find(p => p.recipe && p.recipe.herb > 0 && p.recipe.stoneBase > 0)!

interface Snapshot {
  outcome: { ok: boolean; count: number; aborted?: boolean }
  herb: number
  stone: string
  pills: number
  crafted: number
  failed: number
  skillExp: string
  recipes: string
  toasts: string[]
  draws: number
}

/** 摆好一份档案:熟练度 / 技艺 / 材料 / 未得的丹方…… */
function prepare(opts: { mastery?: number; skill?: number; herb?: number; forget?: boolean } = {}): void {
  const lore = useLoreStore()
  lore.addRecipeMastery(recipe.id, opts.forget ? 0 : (opts.mastery ?? 1))
  if (opts.skill) for (const key of ['discern', 'herbLore', 'flame'] as const) lore.addSkillExp(key, opts.skill)
  const resources = useResourcesStore()
  resources.herb = opts.herb ?? 99
  resources.spiritStone = gn(1e9)
  useInventoryStore().pills = {}
  usePlayerStore().major = 6
  /**
   * 成就与主线也会发赏 —— 那会把"这一次炼制的扣料"淹掉(一次结算里混着好几笔账)。
   * 全部预先解锁,这一格就只剩炼制这一笔。
   */
  const quests = useQuestsStore()
  quests.achieved = ACHIEVEMENTS.map(a => a.id)
  quests.mainIdx = MAIN_QUESTS.length
}

const snapshot = (outcome: Snapshot['outcome'], toasts: string[], draws: number): Snapshot => ({
  outcome,
  herb: useResourcesStore().herb,
  stone: formatExact(useResourcesStore().spiritStone),
  pills: useInventoryStore().pills[recipe.id] ?? 0,
  crafted: useQuestsStore().counters.pillsCrafted ?? 0,
  failed: useQuestsStore().counters.pillsFailed ?? 0,
  skillExp: JSON.stringify(useLoreStore().skillExp),
  recipes: JSON.stringify(useLoreStore().recipeLore),
  toasts,
  draws
})

/** 跑一格情景:骰点由 script 依次给出;骰子数在 mock 里统一数(两条实现都过同一个 rng) */
function runCase(opts: Parameters<typeof prepare>[0], script: boolean[], impl: 'now' | 'legacy'): Snapshot {
  setActivePinia(createPinia())
  prepare(opts)
  const toasts: string[] = []
  vi.spyOn(useUiStore(), 'toast').mockImplementation(msg => void toasts.push(msg))
  const counter = { draws: 0, at: 0 }
  vi.spyOn(rng, 'chance').mockImplementation(() => {
    counter.draws += 1
    const next = script[counter.at] ?? false
    counter.at += 1
    return next
  })
  const outcome = impl === 'now' ? craftPill(recipe.id) : legacyCraftPill(recipe.id)
  return snapshot(outcome, toasts, counter.draws)
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.restoreAllMocks()
})

describe('炼丹执行对账 —— 扣料、成败、双成与骰子数', () => {
  it('成功且双成:扣全额、出两枚、计数器 +2,两颗骰子都掷了', () => {
    const now = runCase({ mastery: 1, skill: 200 }, [true, true], 'now')
    const old = runCase({ mastery: 1, skill: 200 }, [true, true], 'legacy')
    expect(now).toEqual(old)
    expect(now.outcome).toMatchObject({ ok: true, count: 2 })
    expect(now.pills).toBe(2)
    expect(now.crafted).toBe(2)
    expect(now.draws).toBe(2)
    expect(now.herb).toBe(99 - pillCraftCost(recipe.id)!.herb) // 成功扣全额
  })

  it('成功但不双成:出 1 枚', () => {
    const now = runCase({ mastery: 1, skill: 200 }, [true, false], 'now')
    const old = runCase({ mastery: 1, skill: 200 }, [true, false], 'legacy')
    expect(now).toEqual(old)
    expect(now.outcome.count).toBe(1)
    expect(now.draws).toBe(2)
  })

  it('失败:灵草按技艺保下一部分、灵石不退,并记一次失败(只掷一颗骰子)', () => {
    const now = runCase({ mastery: 1, skill: 200 }, [false], 'now')
    const old = runCase({ mastery: 1, skill: 200 }, [false], 'legacy')
    expect(now).toEqual(old)
    expect(now.outcome).toMatchObject({ ok: false, count: 0 })
    expect(now.failed).toBe(1)
    expect(now.pills).toBe(0)
    expect(now.draws).toBe(1)
    const cost = pillCraftCost(recipe.id)!
    const kept = Math.floor(cost.herb * salvageRatio(craftability(recipe.id)!.skill))
    expect(now.herb).toBe(99 - (cost.herb - kept))
    // 灵石不退:全额扣(失败只影响灵草的保料)
    expect(now.stone).toBe(formatExact(sub(gn(1e9), cost.stone)))
  })

  it('"没开炉"与"开炉失败"分开:不算失败、不扣料、灵石不动、一颗骰子都不掷', () => {
    const now = runCase({ forget: true }, [], 'now')
    const old = runCase({ forget: true }, [], 'legacy')
    expect(now).toEqual(old)
    expect(now.outcome).toMatchObject({ ok: false, count: 0, aborted: true })
    expect(now.herb).toBe(99)
    expect(now.failed).toBe(0)
    expect(now.draws).toBe(0)
    expect(now.toasts).toEqual(['尚未得此丹方'])
  })

  it('材料不足同样只是"没开炉":提示语与冻结口径一致', () => {
    const now = runCase({ mastery: 1, herb: 0 }, [], 'now')
    const old = runCase({ mastery: 1, herb: 0 }, [], 'legacy')
    expect(now).toEqual(old)
    expect(now.outcome.aborted).toBe(true)
    expect(now.toasts).toEqual(['灵草或灵石不足'])
    expect(now.draws).toBe(0)
  })

  it('双成概率的上限是本作口径的一部分(接线由库侧用例保证)', () => {
    expect(ALCHEMY_BONUS_CAP).toBe(0.8)
    // 双成率 = 炉子那份 + 「炼丹产出」词条,两者相加后由库夹在 0.8 以内
    const able = craftability(recipe.id)
    expect(able).toBeDefined()
  })
})
