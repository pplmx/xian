/**
 * 智能收纳 · 自动裁决的边界
 * 应有之物(O):品质达标的、流派核心的、组合技部件的、成套共鸣的、词条近满的,
 * 都算值得留;行囊满时挤掉的是最弱的那件无缘旧物。
 * 不该有的(X):把玩家练过的件(强化/重铸/封存)当垃圾自动扔掉 ——
 * 那是他自己花资源养起来的,工具没资格替他决定。
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { EquipmentInstance, QualityId } from '@/types'
import { BAG_CAPACITY } from '@/data/constants'
import { useSettingsStore } from '@/stores/settings'
import { useInventoryStore } from '@/stores/inventory'
import { acquireEquipment } from './loot'
import { compareEvictable, hasInvestment, keepVerdict, perfectRolls, shouldAutoRecycle, smartKeepImpact } from './smartKeep'

/** 夹具一律用「不带套」的青云道袍,免得套件规则混进别的判据 */
function mk(uid: string, quality: QualityId = 'mortal', opts: Partial<EquipmentInstance> = {}): EquipmentInstance {
  return {
    uid,
    templateId: 'b_qingyun',
    quality,
    tier: 3,
    level: 0,
    affixes: [],
    ...opts
  }
}

/** 智能收纳全开、品质线 灵品 */
function smartOn(): void {
  useSettingsStore().decomposeRanks = [] // 本文件测的是智能收纳那半边,不掺「一键分解勾选档」
  useSettingsStore().smartKeep = {
    enabled: true,
    minQuality: 3,
    minTier: 0,
    junkBelowLine: false,
    keepCoreAffix: true,
    keepComboPiece: true,
    keepPerfectRolls: true,
    keepSetPiece: true
  }
}

describe('智能收纳 · 自动裁决的边界', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    smartOn()
  })

  it('练过的件(强化/重铸/封存)一律当藏,且不进自动回收闸', () => {
    const cases: [string, Partial<EquipmentInstance>][] = [
      ['强化过', { level: 5 }],
      ['重铸过', { reforgeCount: 2 }],
      ['封存过词条', { sealedAffixIds: ['atk1'] }]
    ]
    for (const [why, patch] of cases) {
      const item = mk(`l_${why}`, 'mortal', patch)
      expect(hasInvestment(item), why).toBe(true)
      const v = keepVerdict(item)
      expect(v.keep, why).toBe(true)
      expect(v.reason, why).toMatch(/淬养/)
      expect(shouldAutoRecycle(item), why).toBe(false)
    }
  })

  it('未练过的凡品照旧判无缘', () => {
    expect(hasInvestment(mk('plain'))).toBe(false)
    expect(keepVerdict(mk('plain')).keep).toBe(false)
    expect(shouldAutoRecycle(mk('plain'))).toBe(true)
  })

  it('成套共鸣件当藏(机制优先于数值),关掉开关才放手', () => {
    const setPiece = mk('set1', 'mortal', { templateId: 'w_xuantie' }) // s_tiebi 铁壁共鸣
    const v = keepVerdict(setPiece)
    expect(v.keep).toBe(true)
    expect(v.reason).toContain('铁壁共鸣')
    useSettingsStore().smartKeep.keepSetPiece = false
    expect(keepVerdict(setPiece).keep).toBe(false)
  })

  it('词条条条近满当藏;有一条拉胯或干脆没词条都不算', () => {
    const perfect = mk('p_full', 'excellent', { affixes: [{ id: 'atk1', roll: 0.95 }, { id: 'def1', roll: 0.88 }] })
    const mixed = mk('p_mix', 'excellent', { affixes: [{ id: 'atk1', roll: 0.95 }, { id: 'def1', roll: 0.4 }] })
    const bare = mk('p_bare', 'excellent')
    expect(perfectRolls(perfect)).toBe(true)
    expect(keepVerdict(perfect).reason).toContain('近满')
    expect(perfectRolls(mixed)).toBe(false)
    expect(keepVerdict(mixed).keep).toBe(false)
    expect(perfectRolls(bare)).toBe(false)
    expect(keepVerdict(bare).keep).toBe(false)
    useSettingsStore().smartKeep.keepPerfectRolls = false
    expect(keepVerdict(perfect).keep).toBe(false)
  })

  /**
   * **实测事故的回归**:玩家在智能收纳里把保留线设在灵品,玄品却被自动回收了。
   *
   * 根因:自动回收闸里还有一条「一键分解勾选档一律回收」,排在所有保留规则之前 ——
   * 玩家在「一键分解」里勾过玄品,于是玄品在保留线**之上**也被扔掉。
   * 两个弹窗都能管同一件事,而玩家只记得自己设过的那个。
   *
   * 现在的口径:自动回收的**唯一政策入口是智能收纳**;「一键分解」只管手动那一次。
   * 线下"不看缘分"那股需求收进 junkBelowLine,且它排在保留线之后 —— 线上的件永不中招。
   */
  it('保留线以上永不被自动回收 —— 哪怕「一键分解」里勾了这一档(实测事故回归)', () => {
    const settings = useSettingsStore()
    settings.decomposeRanks = [0, 1, 4] // 玩家曾在手动分解里勾过玄品(rank 4)
    const profound = mk('xuan', 'profound', { tier: 25 }) // 玄品,在灵品(3)保留线之上
    expect(keepVerdict(profound).keep).toBe(true)
    expect(shouldAutoRecycle(profound), '保留线以上的件被「一键分解」的勾选扔掉了 —— 这正是实测的那个 bug').toBe(
      false
    )
    // 勾选仍然管手动批量那一次(它的本职)
    expect(settings.decomposeRanks.includes(4)).toBe(true)
  })

  it('线下不看缘分(junkBelowLine):救不回,但只管线下', () => {
    const settings = useSettingsStore()
    settings.smartKeep.junkBelowLine = true
    // 线下的成套件:从前靠"成套"救回,现在按玩家的显式声明判弃
    expect(keepVerdict(mk('set3', 'mortal', { templateId: 'w_xuantie' })).reason).toBe('线下不看缘分')
    // 线上的件不受它影响
    expect(keepVerdict(mk('above', 'spirit', { tier: 25 })).keep).toBe(true)
    // 关掉它,缘分规则照旧能救
    settings.smartKeep.junkBelowLine = false
    expect(keepVerdict(mk('set4', 'mortal', { templateId: 'w_xuantie' })).keep).toBe(true)
  })

  it('总闸:智能收纳未启用时,一键分解勾选档也不自动回收', () => {
    const settings = useSettingsStore()
    settings.smartKeep.enabled = false
    settings.decomposeRanks = [0, 1]
    expect(shouldAutoRecycle(mk('plain'))).toBe(false)
    expect(shouldAutoRecycle(mk('gated', 'mortal', { level: 3 }))).toBe(false)
  })

  it('挤位先挤最弱:练过的件不在候选里,同档先走层级低的', () => {
    const inventory = useInventoryStore()
    inventory.addEquipment(mk('lv', 'mortal', { level: 9, tier: 20 })) // 练过的,不可动
    inventory.addEquipment(mk('low_tier', 'mortal', { tier: 1 }))
    inventory.addEquipment(mk('mid_tier', 'mortal', { tier: 2 }))
    for (let i = 0; inventory.bagItems.length < BAG_CAPACITY; i += 1) {
      inventory.addEquipment(mk(`f${i}`, 'mortal', { tier: 8 }))
    }
    const incoming = mk('in', 'profound', { tier: 9 })
    acquireEquipment(incoming)
    expect(inventory.findItem('lv'), '练过的件被挤掉了').toBeDefined()
    expect(inventory.findItem('low_tier'), '没挤掉层级最低的那件').toBeUndefined()
    expect(inventory.findItem('in'), '新件没进去').toBeDefined()
    expect(inventory.bagItems.length).toBeLessThanOrEqual(BAG_CAPACITY)
  })

  it('比较键:品质 → 层级 → 词条,弱者在先', () => {
    const weak = mk('w', 'mortal', { tier: 1, affixes: [{ id: 'atk1', roll: 0.1 }] })
    const strong = mk('s', 'mortal', { tier: 1, affixes: [{ id: 'atk1', roll: 0.9 }] })
    const higherTier = mk('h', 'mortal', { tier: 5 })
    const betterQuality = mk('q', 'spirit', { tier: 1 })
    expect(compareEvictable(weak, strong)).toBeLessThan(0)
    expect(compareEvictable(weak, higherTier)).toBeLessThan(0)
    expect(compareEvictable(weak, betterQuality)).toBeLessThan(0)
  })
})

/**
 * 阶级下限与九档品质线 —— 玩家问的那两件事:
 *   「品质能不能多给几档,别只有灵品的下限」
 *   「能不能支持多少阶以下的全都回收」
 *
 * 场景都按真实用法写:到某个境界之后,旧地界的东西整批是废料,
 * 而"成色"(品质)与"哪一界的旧物"(阶级)是两把不同的尺子,得能分开用。
 */
describe('智能收纳 · 阶级下限与品质档位', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    smartOn()
  })

  it('品质线可拉满九档:定在「天品起保留」,则灵品当藏变当弃', () => {
    const settings = useSettingsStore()
    const spirit = mk('sp', 'spirit', { tier: 30 })
    // 默认(灵品起保留):灵品当藏
    expect(keepVerdict(spirit).keep).toBe(true)
    // 拉到天品(rank 6):灵品低于下限,而它没有流派/套件/满词条可依 —— 判弃
    settings.smartKeep.minQuality = 6
    expect(keepVerdict(spirit).keep).toBe(false)
    // 天品本身仍当藏
    expect(keepVerdict(mk('hv', 'heaven', { tier: 30 })).keep).toBe(true)
  })

  it('阶级下限:低于 N 阶的件一律回收 —— 哪怕它是高品/成套/近满(不问缘分)', () => {
    const settings = useSettingsStore()
    settings.smartKeep.minTier = 20
    // 低阶的仙品:品质远在线上,但"这是哪一界的旧物"这一条说了算
    const oldGodly = mk('old', 'immortal', { tier: 12 })
    const v = keepVerdict(oldGodly)
    expect(v.keep, '阶级下限是硬规则,不该被品质救回来').toBe(false)
    expect(v.reason).toContain('低于 20 阶')
    // 成套件同样救不回(它在缘分规则之前判)
    expect(keepVerdict(mk('oldset', 'mortal', { tier: 12, templateId: 'w_xuantie' })).keep).toBe(false)
    // 线以上的照旧:成色好就当藏,成色差交给缘分
    expect(keepVerdict(mk('new', 'spirit', { tier: 20 })).keep).toBe(true)
  })

  it('阶级下限动不了练过的件 —— 投入保护仍在最前面', () => {
    const settings = useSettingsStore()
    settings.smartKeep.minTier = 30
    const trained = mk('trained', 'mortal', { tier: 3, level: 7 })
    expect(keepVerdict(trained).keep, '练过的件被阶级下限扔掉了').toBe(true)
    expect(keepVerdict(trained).reason).toMatch(/淬养/)
    // 未练过的同阶同质件则按令回收
    expect(keepVerdict(mk('plain', 'mortal', { tier: 3 })).keep).toBe(false)
  })

  it('上锁的件不进自动回收闸(阶级下限也压不动它)', () => {
    const settings = useSettingsStore()
    settings.smartKeep.minTier = 30
    expect(shouldAutoRecycle(mk('locked', 'mortal', { tier: 3, locked: true }))).toBe(false)
    expect(shouldAutoRecycle(mk('free', 'mortal', { tier: 3 }))).toBe(true)
  })

  it('读数:按当前规则摊开"留几件、化几件、各因哪条规则"', () => {
    const settings = useSettingsStore()
    settings.smartKeep.minQuality = 5 // 地品起保留
    settings.smartKeep.minTier = 10 // 10 阶以下一律回收
    const items = [
      mk('keep_q', 'earth', { tier: 25 }), // 品质达标 + 阶级达标 → 留
      mk('keep_set', 'mortal', { tier: 25, templateId: 'w_xuantie' }), // 品质不够但成套 → 缘分救回
      mk('drop_t', 'immortal', { tier: 8 }), // 阶级不够 → 化尘(不问品质)
      mk('drop_q', 'mortal', { tier: 30 }), // 品质不够、无缘 → 化尘
      mk('locked', 'mortal', { tier: 1, locked: true }) // 上锁 → 不参与
    ]
    const impact = smartKeepImpact(items)
    expect(impact.candidates, '上锁的不该进候选').toBe(4)
    expect(impact.keep).toBe(2)
    expect(impact.recycle).toBe(2)
    const byReason = new Map(impact.byReason.map(r => [r.reason, r.count]))
    expect(byReason.get('低于 10 阶')).toBe(1)
    // 另一件按"缘分"判掉:新档无流派时判词是「道途未成,唯品质论」,有流派时才是「与道无缘」——
    // 两条都是"品质不够且无缘",故这里只认"不是阶级下限那条"
    const others = impact.byReason.filter(r => !r.reason.includes('低于'))
    expect(others.length, '品质那一路的判词该单独成一条').toBe(1)
    expect(others[0]!.count).toBe(1)
  })

  it('指令冲突时顺序固定:投入保护 > 阶级下限 > 品质下限 > 缘分规则', () => {
    const settings = useSettingsStore()
    settings.smartKeep.minTier = 20
    settings.smartKeep.minQuality = 6
    // 同一件同时命中多条:练过的低阶凡品 —— 只有"投入保护"该赢
    expect(keepVerdict(mk('a', 'mortal', { tier: 1, level: 1 })).reason).toMatch(/淬养/)
    // 未练过的低阶天品:阶级下限赢(尽管品质在线上)
    expect(keepVerdict(mk('b', 'heaven', { tier: 1 })).reason).toContain('低于 20 阶')
    // 高阶但品质不足:品质下限之后才轮到缘分
    expect(keepVerdict(mk('c', 'mortal', { tier: 25 })).reason).toBeTruthy()
  })
})
