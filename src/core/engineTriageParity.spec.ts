/**
 * 智能收纳对账 —— 裁决链交给库的分流层之后,与**迁移前冻结的旧实现**逐字相同。
 *
 * 与 engineParity 同一条纪律。下面 `refKeepVerdict` 是从旧 `core/smartKeep.ts`
 * 原样抄下来的那条 if 链(迁移前的样子)。
 *
 * 这一处尤其要比**理由文案**:收纳规则的意义一半在"凭什么"——
 * 留是"良品当藏",扔是"低于 5 阶"还是"道途未成,唯品质论",玩家要能看懂。
 * 读数(几条规则各判掉多少)也一并比:它与裁决共用同一个 `decide`,不该出现两套数字。
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { EquipmentInstance, QualityId } from '@/types'
import { useSettingsStore } from '@/stores/settings'
import { usePlayerStore } from '@/stores/player'
import { equipmentTemplate } from '@/data/equipment'
import { qualityDef } from '@/data/qualities'
import { equipSetDef } from './equipSet'
import { BUILD_STYLES, detectBuild } from './buildDetect'
import { matchComboArt } from '@/data/comboArts'
import { resolveEquipStats } from './equipGen'
import {
  compareEvictable,
  hasInvestment,
  keepVerdict,
  perfectRolls,
  shouldAutoRecycle,
  smartKeepImpact,
  type KeepVerdict
} from './smartKeep'

// —— 迁移前冻结的旧口径(原 core/smartKeep.ts 的 keepVerdict)——
function refKeepVerdict(item: EquipmentInstance): KeepVerdict {
  const cfg = useSettingsStore().smartKeep
  const q = qualityDef(item.quality)
  if (hasInvestment(item)) return { keep: true, reason: '已淬养,留待你自己定夺' }
  if (cfg.minTier > 0 && item.tier < cfg.minTier) return { keep: false, reason: `低于 ${cfg.minTier} 阶` }
  if (q.rank >= cfg.minQuality) return { keep: true, reason: `${q.name}当藏` }
  if (cfg.junkBelowLine) return { keep: false, reason: '线下不看缘分' }
  const setId = equipmentTemplate(item.templateId)?.set
  if (cfg.keepSetPiece && setId) return { keep: true, reason: `「${equipSetDef(setId)?.name ?? '成套'}」套件` }
  if (cfg.keepPerfectRolls && perfectRolls(item)) return { keep: true, reason: '词条近满' }
  const build = detectBuild(usePlayerStore().finalStats.mods)
  if (!build) return { keep: false, reason: '道途未成,唯品质论' }
  const mods = resolveEquipStats(item).mods
  if (cfg.keepCoreAffix) {
    for (const key of Object.keys(build.style.core)) {
      if ((mods[key as keyof typeof mods] ?? 0) > 0) return { keep: true, reason: `含${build.style.name}核心词条` }
    }
  }
  if (cfg.keepComboPiece) {
    for (const style of BUILD_STYLES) {
      if (style.id === build.style.id) continue
      const art = matchComboArt(build.style.id, style.id)
      if (!art) continue
      for (const key of Object.keys(style.core)) {
        if ((mods[key as keyof typeof mods] ?? 0) > 0) return { keep: true, reason: `「${art.name}」组合技部件` }
      }
    }
  }
  return { keep: false, reason: '与道无缘' }
}

const mk = (uid: string, quality: QualityId, opts: Partial<EquipmentInstance> = {}): EquipmentInstance => ({
  uid,
  templateId: 'b_qingyun',
  quality,
  tier: 3,
  level: 0,
  affixes: [],
  ...opts
})

/** 全开 + 品质线灵品 */
function smartOn(patch: Partial<ReturnType<typeof useSettingsStore>['smartKeep']> = {}): void {
  useSettingsStore().decomposeRanks = []
  useSettingsStore().smartKeep = {
    enabled: true,
    minQuality: 3,
    minTier: 0,
    junkBelowLine: false,
    keepCoreAffix: true,
    keepComboPiece: true,
    keepPerfectRolls: true,
    keepSetPiece: true,
    ...patch
  }
}

/** 造一个"有流派"的档:罡盾流的核心词条给足 */
function gangdunBuild(): void {
  usePlayerStore().finalStats.mods = { shieldOnStart: 0.25, shieldPower: 0.3 }
}

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('智能收纳对账 —— 裁决与迁移前逐字相同', () => {
  const items: EquipmentInstance[] = [
    mk('plain6', 'mortal', { tier: 6 }),
    mk('fine9', 'fine', { tier: 9 }),
    mk('divine3', 'divine', { tier: 3 }),
    mk('tierBelow', 'divine', { tier: 6 }),
    mk('invested', 'mortal', { tier: 9, level: 2 }),
    mk('reforged', 'mortal', { tier: 9, reforgeCount: 1 }),
    mk('sealed', 'mortal', { tier: 9, sealedAffixIds: ['atk1'] }),
    mk('locked', 'mortal', { tier: 1, locked: true }),
    mk('perfect', 'mortal', { tier: 9, affixes: [{ id: 'atk1', roll: 1 }, { id: 'def1', roll: 0.99 }] }),
    mk('setPiece', 'mortal', { tier: 9, templateId: 'b_qingyun' })
  ]

  it('同一批件 × 六套开关:keep 与**理由文案**逐字相同', () => {
    const configs: [string, () => void][] = [
      ['全开', () => smartOn()],
      ['线下不看缘分', () => smartOn({ junkBelowLine: true })],
      ['阶级下限 9', () => smartOn({ minTier: 9 })],
      ['品质线凡品', () => smartOn({ minQuality: 0 })],
      ['只留成套与满值', () => smartOn({ keepCoreAffix: false, keepComboPiece: false })],
      ['什么都不留(收纳关)', () => smartOn({ minQuality: 99, minTier: 0, keepSetPiece: false, keepPerfectRolls: false })]
    ]
    for (const [label, setup] of configs) {
      setup()
      for (const item of items) {
        expect(keepVerdict(item), `${label} · ${item.uid}`).toEqual(refKeepVerdict(item))
      }
    }
  })

  it('有流派时:核心词条与组合技部件两条缘分规则也对得上', () => {
    gangdunBuild()
    smartOn()
    // 用真实词条 id:gs1 = 罡盾(shieldPower,罡盾流核心),cnt1 = 反击(counterRate,反震流核心)
    const withCore = mk('core', 'mortal', { tier: 9, affixes: [{ id: 'gs1', roll: 0.5 }] })
    const withCombo = mk('combo', 'mortal', { tier: 9, affixes: [{ id: 'cnt1', roll: 0.5 }] })
    expect(keepVerdict(withCore)).toEqual(refKeepVerdict(withCore))
    expect(keepVerdict(withCombo)).toEqual(refKeepVerdict(withCombo))
    // 两条至少有一条真的命中了缘分规则(否则这条对账在空转)
    expect(refKeepVerdict(withCore).reason + refKeepVerdict(withCombo).reason).toMatch(/核心词条|组合技部件/)
  })

  it('读数(按理由分组的件数)也对得上', () => {
    smartOn({ minTier: 9 })
    const impact = smartKeepImpact(items)
    const ref = (() => {
      let keep = 0
      let recycle = 0
      const counts = new Map<string, number>()
      for (const item of items) {
        if (item.locked) continue
        const v = refKeepVerdict(item)
        if (v.keep) keep += 1
        else {
          recycle += 1
          counts.set(v.reason, (counts.get(v.reason) ?? 0) + 1)
        }
      }
      return {
        candidates: keep + recycle,
        keep,
        recycle,
        byReason: [...counts.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count)
      }
    })()
    expect(impact).toEqual(ref)
  })

  it('自动回收的闸门(收纳开关 + 上锁豁免)也对得上', () => {
    const sample = mk('s', 'mortal', { tier: 9 })
    useSettingsStore().smartKeep = { ...useSettingsStore().smartKeep, enabled: false }
    expect(shouldAutoRecycle(sample)).toBe(false)
    smartOn()
    for (const item of items) {
      expect(shouldAutoRecycle(item), item.uid).toBe(item.locked ? false : !refKeepVerdict(item).keep)
    }
  })

  it('挤位次序对得上:成色 → 层级 → 词条,三层依次比', () => {
    const refCompare = (a: EquipmentInstance, b: EquipmentInstance): number => {
      const qa = qualityDef(a.quality).rank
      const qb = qualityDef(b.quality).rank
      if (qa !== qb) return qa - qb
      if (a.tier !== b.tier) return a.tier - b.tier
      return a.affixes.reduce((s, x) => s + x.roll, 0) - b.affixes.reduce((s, x) => s + x.roll, 0)
    }
    for (const a of items) {
      for (const b of items) {
        expect(Math.sign(compareEvictable(a, b)), `${a.uid} vs ${b.uid}`).toBe(Math.sign(refCompare(a, b)))
      }
    }
  })
})
