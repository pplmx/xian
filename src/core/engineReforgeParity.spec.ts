/**
 * 重铸对账 —— 本作的"洗练"交给库重掷词条之后,与**迁移前冻结的旧实现**逐位相等。
 *
 * 与 engineParity / engineResourceParity / engineHoldingParity 同一条纪律。
 * 下面 `refReroll` 是从旧 `core/reforge.ts` 原样抄下来的那段循环(迁移前的样子)。
 *
 * 为什么必须逐位比:重掷会消耗随机源,顺序或次数一变,整局之后的随机序列都跟着错位 ——
 * 那种漂移在界面上一时看不出来,却会让"同一存档、同一操作"给出不同结果。
 */
import { describe, expect, it } from 'vitest'
import type { AffixRoll, EquipmentInstance, QualityId } from '@/types'
import { RandomService, mulberry32 } from '@/utils/random'
import { AFFIXES } from '@/data/affixes'
import { equipmentTemplate } from '@/data/equipment'
import { qualityDef } from '@/data/qualities'
import { ENGINE_WORLD } from './engineWorld'

// —— 迁移前冻结的旧口径(原 core/reforge.ts 里那段重掷循环)——
function refReroll(
  inst: Pick<EquipmentInstance, 'affixes' | 'tier' | 'quality' | 'templateId' | 'sealedAffixIds'>,
  rng: RandomService
): AffixRoll[] {
  const template = equipmentTemplate(inst.templateId)
  const quality = qualityDef(inst.quality)
  const sealed = new Set(inst.sealedAffixIds ?? [])
  const kept = inst.affixes.filter(a => sealed.has(a.id))
  const [minCount, maxCount] = quality.affixes
  const wantCount = Math.max(kept.length + 1, Math.min(maxCount, rng.int(minCount, maxCount)))
  const used = new Set([...kept.map(a => a.id)])
  const fresh: AffixRoll[] = []
  let guard = 0
  while (fresh.length < wantCount - kept.length && guard < 50) {
    guard += 1
    const pool = AFFIXES.filter(
      a =>
        !used.has(a.id) &&
        (a.minRank === undefined || quality.rank >= a.minRank) &&
        (a.slots === undefined || template === undefined || a.slots.includes(template.slot))
    )
    if (pool.length === 0) break
    const picked = rng.weighted(pool, a => a.weight)
    used.add(picked.id)
    fresh.push({ id: picked.id, roll: rng.next() })
  }
  return [...kept, ...fresh]
}

/** 新口径:交给库的 equipment.rerollAffixes(池子与生成共用一处实现) */
function nowReroll(
  inst: Pick<EquipmentInstance, 'affixes' | 'tier' | 'quality' | 'templateId' | 'sealedAffixIds'>,
  rng: RandomService
): AffixRoll[] {
  const template = equipmentTemplate(inst.templateId)
  return ENGINE_WORLD.equipment.rerollAffixes(inst.affixes, {
    rng,
    quality: qualityDef(inst.quality),
    tier: inst.tier,
    slot: template?.slot,
    keep: inst.sealedAffixIds ?? []
  })
}

const instance = (quality: QualityId, tier: number, templateId: string, affixes: AffixRoll[], sealed?: string[]) => ({
  affixes,
  tier,
  quality,
  templateId,
  sealedAffixIds: sealed
})

const CASES: [string, ReturnType<typeof instance>][] = [
  ['凡品·未封存', instance('mortal', 1, 'wq1', [{ id: 'atk1', roll: 0.3 }, { id: 'def1', roll: 0.6 }])],
  ['良品·封一条', instance('fine', 3, 'wq3', [{ id: 'atk1', roll: 0.1 }, { id: 'hp1', roll: 0.9 }], ['atk1'])],
  ['神品·多条', instance('divine', 8, 'wq8', [{ id: 'crit1', roll: 0.5 }], [])],
  ['空词条(全都要新掷)', instance('excellent', 5, 'wq5', [])]
]

describe('重铸对账 —— 洗练口径与迁移前逐位相同', () => {
  it('同一批种子、同一件装备:重掷出的词条与掷点逐条相同', () => {
    for (const [label, sample] of CASES) {
      for (const seed of [1, 7, 42, 1024, 99991]) {
        const old = refReroll(sample, new RandomService(mulberry32(seed)))
        const now = nowReroll(sample, new RandomService(mulberry32(seed)))
        expect(now, `${label} · seed=${seed}`).toEqual(old)
      }
    }
  })

  it('随机源消耗一致 —— 否则整局之后的随机序列都会错位', () => {
    for (const [label, sample] of CASES) {
      const a = new RandomService(mulberry32(2026))
      const b = new RandomService(mulberry32(2026))
      refReroll(sample, a)
      nowReroll(sample, b)
      // 走同样的步数之后,再取一串数应当完全相同
      expect(
        Array.from({ length: 5 }, () => b.next()),
        `${label} 之后的随机流`
      ).toEqual(Array.from({ length: 5 }, () => a.next()))
    }
  })

  it('封存的那几条原样不动(连掷点都不变)', () => {
    const sample = CASES[1]![1]
    const next = nowReroll(sample, new RandomService(mulberry32(3)))
    expect(next[0]).toEqual({ id: 'atk1', roll: 0.1 })
  })
})
