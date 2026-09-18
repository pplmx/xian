/**
 * 掉落表对账 —— "这一场给不给、给几份"交给库的掉落层之后,随机流与掉落清单一字不差。
 *
 * 与 engineParity 同一条纪律:掉落判定不再手写 `if (rng.chance(...))`,而是走
 * `createDropTable`,所以这份判据把**迁移前的那段判定原样冻结**在下面(legacyDrops),
 * 用同一颗种子跑两遍,比三件事:
 *
 *   ① **随机调用逐条相同**(方法 + 参数 + 先后)—— 掉落表只是另一种写法,不该让同一场
 *      战斗的"第 7 颗骰子"变成别的东西。最容易踩的正是这条:生成装备自己还要掷骰,
 *      若等整表掷完再统一生成,后面的判定就整体挪位了;
 *   ② 战报文案逐条相同(残页 / 装备 / 丹药 / 法宝,含"福缘深厚,战利品翻倍!");
 *   ③ 拾获件数相同。
 *
 * 另有三条数字口径单独钉住 —— 它们是**本作的选择**,不是库的实现细节:
 *   · 概率进判定前先归一:叠过 1 的钳到 1,装备另封 90%;
 *   · 首领第一抽必出装备,且开保底**不改变掷骰次数**(只改写这一次的结果);
 *   · "战利品翻倍"在装备上是**多抽一次**,在材料/残页上翻的是**份数**。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { RegionDef } from '@/types'
import type { Rng } from 'wanxiang-engine'
import { createRng } from 'wanxiang-engine'
import { regionDef } from '@/data/regions'
import { afterWin, acquireArtifact, acquireEquipment, randomDropArtifact, randomDropPill } from './loot'
import { generateEquipment } from './equipGen'
import { harvestMaterials } from './loreService'
import { personalityEffects } from './petPersonality'
import { modOf } from './statsCalc'
import { collect } from './progress'
import { usePlayerStore } from '@/stores/player'
import { useResourcesStore } from '@/stores/resources'
import { useInventoryStore } from '@/stores/inventory'
import { useSettingsStore } from '@/stores/settings'
import { PILLS } from '@/data/pills'
import {
  ARTIFACT_DROP_CHANCE,
  EQUIP_DROP_CHANCE,
  PAGE_DROP_CHANCE,
  PILL_DROP_CHANCE
} from '@/data/constants'
import { mulberry32, RandomService, rng } from '@/utils/random'

/** 随机调用的流水账:`chance(0.5)`、`int(1,3)` … 逐条记,顺序就是真相 */
let calls: string[] = []

/**
 * 把全局随机源换成**可复现且会记账**的一支 —— 两边都从同一颗种子开始,
 * 于是"两边是不是掷了同一串骰子"变成了可以直接比对的两份流水。
 */
function seedRng(seed: number): void {
  calls = []
  const inner = new RandomService(mulberry32(seed))
  vi.spyOn(rng, 'next').mockImplementation(() => {
    calls.push('next()')
    return inner.next()
  })
  vi.spyOn(rng, 'int').mockImplementation((min, max) => {
    calls.push(`int(${min},${max})`)
    return inner.int(min, max)
  })
  vi.spyOn(rng, 'float').mockImplementation((min, max) => {
    calls.push(`float(${min},${max})`)
    return inner.float(min, max)
  })
  vi.spyOn(rng, 'chance').mockImplementation(p => {
    calls.push(`chance(${p})`)
    return inner.chance(p)
  })
  vi.spyOn(rng, 'pick').mockImplementation(<T>(arr: readonly T[]): T => {
    calls.push(`pick(${arr.length})`)
    return inner.pick(arr)
  })
  vi.spyOn(rng, 'weighted').mockImplementation(<T>(items: readonly T[], weightOf: (item: T) => number): T => {
    calls.push(`weighted(${items.length})`)
    return inner.weighted(items, weightOf)
  })
}

/** 一场干净的仗:行囊空、不化尘、不自动收纳 —— 两边的起点必须一模一样 */
function freshBattle(): void {
  setActivePinia(createPinia())
  useSettingsStore().decomposeRanks = []
  useSettingsStore().smartKeep.enabled = false
  usePlayerStore().initCharacter('掉落对账', { roots: [] } as never)
}

/**
 * 迁移前的掉落判定(**整段冻结在这,当尺子用**)。
 *
 * 与迁移前 `afterWin` 的掉落段逐字一致:概率钳制写成局部 `capChance`、装备保底写成
 * `|| (isBoss && i === 0)` 短路、丹药与法宝各自一个 `if`。灵石浮动那一颗骰子也照抄:
 * 它不参与掉落判定,但它是随机流的一部分 —— 少了它,两边的"下一颗骰子"就不是同一颗。
 * 灵石/修为本身不掷骰,故这里只比掉落(它们另有 engineSettlementParity 看着)。
 */
function legacyDrops(region: RegionDef, rewardMult: number, isBoss: boolean): { lines: string[]; items: number } {
  const player = usePlayerStore()
  const resources = useResourcesStore()
  const inventory = useInventoryStore()
  const mods = player.finalStats.mods
  const lines: string[] = []
  let items = 0
  const tier = region.tier
  const capChance = (p: number): number => Math.min(1, Math.max(0, p))
  const doubled = rng.chance(capChance(modOf(mods, 'doubleDropRate'))) ? 2 : 1
  if (doubled === 2) lines.push('福缘深厚,战利品翻倍!')

  rng.float(0.8, 1.2) // 灵石浮动:不参与掉落,但占着随机流里的那一格

  // 材料 —— 数量进财货库存,同时抽出"你到底捡到了什么"推进认知
  if (rng.chance(0.5)) {
    const n = rng.int(1, 3) * doubled
    resources.addSmall('herb', n)
    harvestMaterials(tier, 'herb', n)
  }
  if (rng.chance(0.35)) {
    const n = rng.int(1, 2) * doubled
    resources.addSmall('ore', n)
    harvestMaterials(tier, 'ore', n)
  }
  if (rng.chance(capChance(PAGE_DROP_CHANCE * rewardMult))) {
    const n = rng.int(1, 2) * doubled
    resources.addSmall('page', n)
    lines.push(`功法残页×${n}`)
    items += 1
  }

  // 装备 —— 品质 luck 并入灵兽性格的掉落倾向
  const luck = modOf(mods, 'luck') + personalityEffects(player.petId).dropLuck
  const equipChance = EQUIP_DROP_CHANCE * rewardMult * (1 + modOf(mods, 'dropRate')) * (isBoss ? 2.5 : 1)
  for (let i = 0; i < doubled; i += 1) {
    if (rng.chance(Math.min(0.9, equipChance)) || (isBoss && i === 0)) {
      const inst = generateEquipment(tier, rng, { luck, minQualityRank: isBoss ? 1 : 0 })
      lines.push(acquireEquipment(inst).line)
      items += 1
    }
  }

  // 丹药
  if (rng.chance(capChance(PILL_DROP_CHANCE * rewardMult * (isBoss ? 3 : 1)))) {
    const pillId = randomDropPill(player.major)
    if (pillId) {
      inventory.addPill(pillId, 1)
      collect('pill', pillId)
      const def = PILLS.find(p => p.id === pillId)
      lines.push(`丹药「${def?.name ?? ''}」`)
      items += 1
    }
  }

  // 法宝(稀有)
  if (rng.chance(capChance(ARTIFACT_DROP_CHANCE * (isBoss ? 6 : 1) * (1 + luck)))) {
    const artId = randomDropArtifact(tier)
    if (artId) {
      lines.push(acquireArtifact(artId))
      items += 1
    }
  }

  return { lines, items }
}

/** 同一颗种子、同一场仗:now = 现在的 afterWin,legacy = 上面冻结的旧判定 */
function runSeeded(
  seed: number,
  region: RegionDef,
  rewardMult: number,
  isBoss: boolean,
  impl: 'now' | 'legacy'
): { calls: string[]; lines: string[]; items: number } {
  freshBattle()
  seedRng(seed)
  const out = impl === 'now' ? afterWin(region, rewardMult, isBoss) : legacyDrops(region, rewardMult, isBoss)
  return { calls: [...calls], lines: out.lines, items: out.items }
}

const chancesOf = (log: string[]): number[] =>
  log.filter(c => c.startsWith('chance(')).map(c => Number(c.slice('chance('.length, -1)))

describe('掉落表对账 —— 逐颗骰子、逐条文案与迁移前一致', () => {
  const cases: [string, number, boolean][] = [
    ['普通战斗', 1, false],
    ['倍率 1.9 的路线', 1.9, false],
    ['首领战', 1, true],
    ['首领 + 倍率 1.4', 1.4, true]
  ]

  beforeEach(() => {
    freshBattle()
  })

  for (const [label, rewardMult, isBoss] of cases) {
    for (const seed of [1, 20260919]) {
      it(`${label}·种子 ${seed}:随机流与掉落清单一致`, () => {
        const region = regionDef('qingyun')!
        const now = runSeeded(seed, region, rewardMult, isBoss, 'now')
        const old = runSeeded(seed, region, rewardMult, isBoss, 'legacy')
        expect(now.calls).toEqual(old.calls)
        expect(now.lines).toEqual(old.lines)
        expect(now.items).toBe(old.items)
        // 表别被掷空了:翻倍 + 五类掉落至少六次概率判定都在场
        expect(chancesOf(now.calls).length).toBeGreaterThanOrEqual(6)
      })
    }
  }
})

describe('概率进判定前归一 —— 叠过 1 的只是必中,不是"更必中"', () => {
  beforeEach(() => {
    freshBattle()
  })

  it('倍率堆到天上:残页/丹药钳到 1,装备封在 0.9,法宝也不出 [0,1]', () => {
    const region = regionDef('qingyun')!
    const run = runSeeded(11, region, 10, true, 'now')
    // 判定顺序 = 声明顺序:翻倍 → 灵草 → 灵矿 → 残页 → 装备 → 丹药 → 法宝
    const chances = chancesOf(run.calls)
    expect(chances[3]).toBe(1) // 残页 0.12 × 10 = 1.2 → 1
    expect(chances[4]).toBe(0.9) // 装备 0.3 × 10 × 2.5 = 7.5 → 上限 0.9
    expect(chances[5]).toBe(1) // 丹药 0.08 × 10 × 3 = 2.4 → 1
    expect(chances[6]).toBeLessThanOrEqual(1) // 法宝 0.015 × 6 = 0.09,一律过一遍归一
  })

  it('倍率正常时不触顶:各条就是各自的基础概率(该吃词条的那条照吃)', () => {
    const region = regionDef('qingyun')!
    const chances = chancesOf(runSeeded(11, region, 1, false, 'now').calls)
    const player = usePlayerStore()
    const mods = player.finalStats.mods
    expect(chances[3]).toBeCloseTo(PAGE_DROP_CHANCE, 12) // 残页:基础概率 × 倍率,不吃词条
    expect(chances[4]).toBeCloseTo(EQUIP_DROP_CHANCE * (1 + modOf(mods, 'dropRate')), 12)
    expect(chances[4]).toBeLessThan(0.9) // 没越过上限就不封顶 —— 封顶只在触到它时生效
    expect(chances[5]).toBeCloseTo(PILL_DROP_CHANCE, 12)
    const luck = modOf(mods, 'luck') + personalityEffects(player.petId).dropLuck
    expect(chances[6]).toBeCloseTo(ARTIFACT_DROP_CHANCE * (1 + luck), 12)
  })
})

describe('首领第一抽必出 —— 保底是改写结果,不是跳过骰子', () => {
  beforeEach(() => {
    freshBattle()
  })

  it('概率全不中的极端情形:首领仍出一件装备,普通战斗一件不出', () => {
    const region = regionDef('qingyun')!
    const chanceSpy = vi.spyOn(rng, 'chance').mockReturnValue(false)
    const boss = afterWin(region, 1, true)
    const bossChances = chanceSpy.mock.calls.length
    freshBattle()
    chanceSpy.mockClear()
    const plain = afterWin(region, 1, false)
    expect(boss.items).toBe(1) // 保底那一件
    expect(plain.items).toBe(0)
    expect(boss.lines.length).toBe(1)
    expect(plain.lines).toEqual([])
    // 保底开不开,掷骰次数一样(7 条判定:x 翻倍 + 材料 2 + 残页 + 装备 + 丹药 + 法宝)
    expect(bossChances).toBe(7)
    expect(chanceSpy.mock.calls.length).toBe(7)
  })
})

describe('战利品翻倍的两副面孔 —— 装备多抽一次,材料/残页翻份数', () => {
  beforeEach(() => {
    freshBattle()
  })

  it('装备:翻倍 → 多掷一次(而不是一份变两份)', () => {
    const region = regionDef('qingyun')!
    let first = true
    const chanceSpy = vi.spyOn(rng, 'chance').mockImplementation(() => {
      if (first) {
        first = false
        return true // 只让"翻倍"这一颗落定,后面的概率全不中
      }
      return false
    })
    const summary = afterWin(region, 1, true)
    // 8 次概率判定:翻倍 + 材料 2 + 残页 + **装备 2 次** + 丹药 + 法宝
    expect(chanceSpy.mock.calls.length).toBe(8)
    // 第一抽被保底顶上 → 一件;第二抽落空 → 不再来一件。若把翻倍理解成"份数 ×2",
    // 这里会是两件且只掷 7 次 —— 本作要的是前一种
    expect(summary.items).toBe(1)
    expect(summary.lines[0]).toBe('福缘深厚,战利品翻倍!')
  })

  it('残页:翻倍翻的是份数(命中一次,份数乘二)', () => {
    const region = regionDef('qingyun')!
    // 让"翻倍"(概率 0)与残页(0.12)落定,其余全不中;份数固定抽 2
    vi.spyOn(rng, 'chance').mockImplementation(p => p === 0 || p === PAGE_DROP_CHANCE)
    vi.spyOn(rng, 'int').mockReturnValue(2)
    const summary = afterWin(region, 1, false) // 普通战斗:不牵涉装备保底
    expect(summary.lines).toEqual(['福缘深厚,战利品翻倍!', `功法残页×${2 * 2}`])
    expect(summary.items).toBe(1) // 命中一次算一件拾获
  })
})

/** 只为一件事:上面的流水账与库自己的随机源对得上(这份对账跑得起来的前提) */
describe('流水账本身可信', () => {
  it('记的就是库视角的那串数:与 createRng 同种子逐值一致', () => {
    seedRng(42)
    const seen = [rng.chance(0.5), rng.int(1, 3), rng.float(0, 1)]
    const expected = createRng(42)
    expect(seen).toEqual([expected.chance(0.5), expected.int(1, 3), expected.float(0, 1)])
    expect(calls).toEqual(['chance(0.5)', 'int(1,3)', 'float(0,1)'])
  })

  it('本作的随机服务与库的 Rng 同形 —— 掉落表接得进来就靠这条', () => {
    const asEngineRng: Rng = rng
    expect(typeof asEngineRng.weighted).toBe('function')
  })
})
