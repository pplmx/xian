/**
 * 批量炼丹 / 批量服丹 —— 与连点完全等价,只把提示合为一条
 *
 * 高界玩家逐枚逐炉点按是实打实的苦:批量是连点的宏,不是另一条结算路径。
 * 故这一组判据的核心是「等价」—— 批量 N 的账(出丹/耗材/技艺/计数/保料)
 * 必须与连点 N 次分毫不差,不许封装两层口径。
 *
 * 本作特有的两道收口也在这里钉死:
 *   一 增益丹(带 buffId)批量连服是陷阱 —— 药力一顶,后面的全白吃,
 *      usePillBatch 对它们退化为单服,UI 也不许挂批量按钮(涉策 buffOverflowOf);
 *   二 炸炉的保料账不许在批量合并提示时丢 —— 单炉口粮与批量总额对得上,
 *      残料总额必须进同一条提示(本作「炸炉报保料数字」的契约延伸到批量)。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { craftPillBatch, craftPill, usePillBatch, usePill } from './pillService'
import { alchemyBonusCapped, ALCHEMY_BONUS_CAP } from './engineCraft'
import { craftability } from './craftability'
import { useCultivationStore } from '@/stores/cultivation'
import { buffDef } from '@/data/buffs'
import * as audio from './audio'
import { pillDef } from '@/data/pills'
import { recipeCraft } from '@/data/crafting'
import { ACHIEVEMENTS } from '@/data/achievements'
import { MAIN_QUESTS } from '@/data/quests'
import { useResourcesStore } from '@/stores/resources'
import { useInventoryStore } from '@/stores/inventory'
import { useLoreStore } from '@/stores/lore'
import { usePlayerStore } from '@/stores/player'
import { useQuestsStore } from '@/stores/quests'
import { useUiStore } from '@/stores/ui'
import { toNum } from '@/utils/gnum'

const SRC = resolve(__dirname, '..')

/** rng 的固定返回:0 → 所有概率判定都成;0.999 → 都不成(成败不掷运气,账才对得上) */
let mockRand = 0
vi.mock('@/utils/random', async importOriginal => {
  const mod = await importOriginal<typeof import('@/utils/random')>()
  return { ...mod, rng: new mod.RandomService(() => mockRand) }
})

/** 最低阶可炼方子:材料便宜,端到端好跑 */
const CR = 'p_jvqisan'
/** 炸炉保料要能真出数:草价 × 最低保料率 ≥ 1(4×0.2 会取整归零,6×0.2=1.2 才行) */
const FAIL = 'p_huichun'
/** 即时修为丹:expFixed 无随机,连服账最好对 */
const XP = 'p_jvqidan'
/** 增益丹:连服禁止,必须退化为单服 */
const BUF = 'p_ningshen'

function settleRewards(): void {
  const quests = useQuestsStore()
  quests.$patch({ achieved: ACHIEVEMENTS.map(a => a.id), mainIdx: MAIN_QUESTS.length - 1 })
}

function knowRecipe(id: string): void {
  const lore = useLoreStore()
  lore.addRecipeMastery(id, 0.8)
  for (const mid of recipeCraft(pillDef(id)!)!.materials) lore.advanceLore(mid, 3)
}

function giveMaterials(): void {
  const resources = useResourcesStore()
  resources.addSmall('herb', 400)
  resources.addStone({ m: 1, e: 9 })
}

describe('批量服丹', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockRand = 0
    settleRewards()
    useInventoryStore().addPill(XP, 20)
  })

  it('足量连服:吃足 count 枚,修为恰好等于枚数 × 单枚', () => {
    const player = usePlayerStore()
    const inventory = useInventoryStore()
    const before = toNum(player.exp)
    const eaten = usePillBatch(XP, 5)
    expect(eaten).toBe(5)
    expect(inventory.pills[XP]).toBe(15)
    expect(toNum(player.exp) - before).toBe(5 * 80)
  })

  it('存量不足:吃到没有就停,并报「仅存 N 枚」', () => {
    useInventoryStore().$patch({ pills: { [XP]: 3 } })
    const ui = useUiStore()
    const toast = vi.spyOn(ui, 'toast')
    const eaten = usePillBatch(XP, 5)
    expect(eaten).toBe(3)
    expect(toNum(usePlayerStore().exp)).toBeCloseTo(3 * 80, 5)
    expect(String(toast.mock.calls.at(-1)?.[0])).toContain('仅存 3 枚')
  })

  it('一颗都没有:吞下提示,返回 0', () => {
    useInventoryStore().$patch({ pills: { [XP]: 0 } })
    expect(usePillBatch(XP, 5)).toBe(0)
  })

  it('增益丹连服退化为单服 —— 药力顶限之外不许烧丹', () => {
    useInventoryStore().addPill(BUF, 5)
    const ui = useUiStore()
    vi.spyOn(ui, 'toast')
    const eaten = usePillBatch(BUF, 5)
    expect(eaten, '增益丹批量连服必须收口成 1 枚').toBe(1)
    expect(useInventoryStore().pills[BUF]).toBe(4)
  })

  it('与连点 N 次完全等价:修为入账逐位一致', () => {
    setActivePinia(createPinia())
    settleRewards()
    useInventoryStore().addPill(XP, 20)
    for (let i = 0; i < 5; i++) usePill(XP)
    const point = toNum(usePlayerStore().exp)
    setActivePinia(createPinia())
    settleRewards()
    useInventoryStore().addPill(XP, 20)
    usePillBatch(XP, 5)
    expect(toNum(usePlayerStore().exp)).toBe(point)
  })
})

describe('批量炼丹', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    settleRewards()
  })

  it('全成:批量 5 炉与连点 5 炉的入包、耗材、计数分毫不差', () => {
    mockRand = 0
    knowRecipe(CR)
    giveMaterials()
    for (let i = 0; i < 5; i++) craftPill(CR)
    const pointPills = useInventoryStore().pills[CR] ?? 0
    const pointHerb = 400 - useResourcesStore().herb
    const pointStone = toNum({ m: 1, e: 9 }) - toNum(useResourcesStore().spiritStone)
    const pointCrafted = useQuestsStore().counter('pillsCrafted')

    setActivePinia(createPinia())
    mockRand = 0
    settleRewards()
    knowRecipe(CR)
    giveMaterials()
    const out = craftPillBatch(CR, 5)
    expect(out.rounds).toBe(5)
    expect(out.failed).toBe(0)
    expect(useInventoryStore().pills[CR] ?? 0).toBe(pointPills)
    expect(400 - useResourcesStore().herb).toBe(pointHerb)
    expect(toNum({ m: 1, e: 9 }) - toNum(useResourcesStore().spiritStone)).toBe(pointStone)
    expect(useQuestsStore().counter('pillsCrafted')).toBe(pointCrafted)
  })

  it('全败:炸炉数与保料账与连点逐位一致,残料总额进合并提示', () => {
    mockRand = 0.999
    knowRecipe(FAIL)
    giveMaterials()
    const probe = craftPill(FAIL)
    expect(probe.ok).toBe(false)
    expect((probe.salvaged ?? 0) > 0, '失败炉应当有保料 —— 否则这条判据失去意义').toBe(true)
    // 探针已烧掉一炉的料,补上再与「先探针后连点」对齐口径
    giveMaterials()
    const herbAfterProbe = useResourcesStore().herb
    for (let i = 0; i < 5; i++) craftPill(FAIL)
    const pointHerb = herbAfterProbe - useResourcesStore().herb

    setActivePinia(createPinia())
    mockRand = 0.999
    settleRewards()
    knowRecipe(FAIL)
    giveMaterials()
    const ui = useUiStore()
    const toast = vi.spyOn(ui, 'toast')
    const sfx = vi.spyOn(audio, 'playSfx')
    const out = craftPillBatch(FAIL, 5)
    expect(out.rounds).toBe(5)
    expect(out.failed).toBe(5)
    expect(400 - useResourcesStore().herb).toBe(pointHerb)
    expect(useQuestsStore().counter('pillsFailed')).toBe(5)
    expect(String(toast.mock.calls.at(-1)?.[0])).toContain('残料保回')
    // quiet 逐炉不出声,音效只有批量那一条(全败 = fail 一声,不叠 6 声)
    expect(sfx.mock.calls.length).toBe(1)
    expect(sfx.mock.calls[0]?.[0]).toBe('fail')
  })

  it('材料只够一炉:烧完即止,不赊不缺', () => {
    mockRand = 0
    knowRecipe(CR)
    const resources = useResourcesStore()
    // 灵草只给一炉的量,灵石给足(让截断只发生在草上)
    resources.addSmall('herb', 4)
    resources.addStone({ m: 1, e: 9 })
    const out = craftPillBatch(CR, 5)
    expect(out.rounds).toBe(1)
    expect(out.made).toBeGreaterThanOrEqual(1)
    expect(resources.herb).toBeLessThan(4)
  })

  it('一份材料都不够:不开炉,阻塞理由交给一次非静默开炉说明', () => {
    mockRand = 0
    knowRecipe(CR)
    const resources = useResourcesStore()
    const ui = useUiStore()
    const toast = vi.spyOn(ui, 'toast')
    const out = craftPillBatch(CR, 5)
    expect(out.rounds).toBe(0)
    expect(out.made).toBe(0)
    // 阻塞理由只由那一次非静默开炉说明,不许 quiet 炉与 fallback 各弹一遍
    expect(toast.mock.calls.length, '空手也要让人知道差在哪').toBe(1)
    expect(resources.herb).toBe(0)
  })

  it('炉前双成率 = 炉子份 + 炼丹产出词条,夹 0.8 —— 开炉幕读数与掷骰同一口径', () => {
    mockRand = 0
    knowRecipe(CR)
    const base = alchemyBonusCapped(CR)
    expect(base).toBeCloseTo(Math.min(ALCHEMY_BONUS_CAP, craftability(CR)!.bonusChance), 9)
    // 安神入胃:alchemyYield 立刻顶进 finalStats.mods —— 双成读数原地涨它应给的那一截
    useCultivationStore().addBuff('buff_huohou', Date.now())
    const lift = alchemyBonusCapped(CR) - base
    expect(lift).toBeCloseTo(buffDef('buff_huohou')?.mods?.alchemyYield ?? 0, 9)
    expect(lift).toBeGreaterThan(0)
    expect(base + lift).toBeLessThanOrEqual(ALCHEMY_BONUS_CAP)
  })
})

describe('批量炼丹 · UI 收口', () => {
  it('连炼挂在批量开炉上;连服只在即时丹上挂(增益丹不许批量按钮)', () => {
    const src = readFileSync(join(SRC, 'views/InventoryView.vue'), 'utf8')
    expect(src).toContain('craftBatch(r.def.id)')
    expect(src).toContain('连服 ×5')
    expect(src).toContain('!def.buffId')
  })

  it('开炉幕挂出炼丹增益:三味状态丹的炼丹面在炉前可见,文案走 buff→modsText(不许另写一份)', () => {
    const src = readFileSync(join(SRC, 'views/InventoryView.vue'), 'utf8')
    for (const buffId of ['buff_huohou', 'buff_chengxin', 'buff_dingxin']) {
      expect(src, `${buffId} 没接进开炉幕的炼丹增益`).toContain(buffId)
    }
    expect(src).toContain('炼丹增益')
    expect(src).toContain('modsText')
  })

  it('开炉幕把双成率也亮出来:配方行报双成读数,走 alchemyBonusCapped 同一口径', () => {
    const src = readFileSync(join(SRC, 'views/InventoryView.vue'), 'utf8')
    expect(src).toContain('const doubleRate = alchemyBonusCapped(id)')
    expect(src).toContain('formatPercent(r.doubleRate)')
    expect(src).toContain(' 双成')
  })
})
