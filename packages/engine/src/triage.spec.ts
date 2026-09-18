import { describe, expect, it } from 'vitest'
import { compareBy, createTriage } from './triage.js'

interface Piece {
  uid: string
  locked?: boolean
  tier: number
  quality: number
  core?: boolean
}

describe('分流裁决 —— 留还是不留', () => {
  const rules = [
    { id: 'tierFloor', label: '低于 5 阶一律回收', decide: (p: Piece) => (p.tier < 5 ? { keep: false, reason: `低于 5 阶` } : undefined) },
    { id: 'qualityLine', label: '良品以上当藏', decide: (p: Piece) => (p.quality >= 2 ? { keep: true, reason: '良品当藏' } : undefined) },
    { id: 'coreAffix', label: '含流派核心词条', decide: (p: Piece) => (p.core ? { keep: true, reason: '含核心词条' } : undefined) }
  ]
  const triage = createTriage<Piece>({
    rules,
    skip: p => p.locked === true,
    fallback: { keep: false, reason: '与道无缘' }
  })

  it('第一条表态的说了算 —— 顺序就是政策', () => {
    // 6 阶、凡品、无核心:质量线不表态、核心不表态 → 兜底回收
    expect(triage.decide({ uid: 'a', tier: 6, quality: 1 })).toEqual({ keep: false, rule: 'fallback', reason: '与道无缘' })
    // 6 阶良品:质量线当藏
    expect(triage.decide({ uid: 'b', tier: 6, quality: 2 })).toEqual({ keep: true, rule: 'qualityLine', reason: '良品当藏' })
    // 3 阶良品:阶级线排在前面,先判"低于 5 阶一律回收" —— 哪怕成色好、还带核心词条
    expect(triage.decide({ uid: 'c', tier: 3, quality: 5, core: true })).toEqual({
      keep: false,
      rule: 'tierFloor',
      reason: '低于 5 阶'
    })
  })

  it('豁免的件不参与裁决,也不算进读数', () => {
    const frozen = triage.decide({ uid: 'x', tier: 1, quality: 0, locked: true })
    expect(frozen).toEqual({ keep: true, rule: 'skip', reason: '不参与自动裁决' })
    const impact = triage.impact([
      { uid: 'x', tier: 1, quality: 0, locked: true },
      { uid: 'y', tier: 9, quality: 4 }
    ])
    expect(impact.candidates).toBe(1) // 上锁那件不算候选
    expect(impact.keep).toBe(1)
  })

  it('读数与裁决共用同一条链:每一条规则各判掉多少,看得见', () => {
    const impact = triage.impact([
      { uid: 'a', tier: 3, quality: 5 }, // 阶级线判掉
      { uid: 'b', tier: 4, quality: 0 }, // 阶级线判掉
      { uid: 'c', tier: 9, quality: 1 }, // 兜底判掉
      { uid: 'd', tier: 9, quality: 3 } // 留下
    ])
    expect(impact.candidates).toBe(4)
    expect(impact.keep).toBe(1)
    expect(impact.junk).toBe(2 + 1)
    expect(impact.byReason).toEqual([
      { reason: '低于 5 阶', count: 2 },
      { reason: '与道无缘', count: 1 }
    ])
    // 读数里的每一条都来自裁决本身(不是另算一遍)
    expect(triage.partition([{ uid: 'a', tier: 3, quality: 5 }]).verdicts[0]!.verdict.reason).toBe('低于 5 阶')
  })

  it('全部不表态时用兜底(默认回收)', () => {
    const quiet = createTriage<number>({ rules: [{ id: 'never', decide: () => undefined }] })
    expect(quiet.decide(1)).toEqual({ keep: false, rule: 'fallback', reason: '无一条规则认领' })
    const generous = createTriage<number>({
      rules: [{ id: 'never', decide: () => undefined }],
      fallback: { keep: true, reason: '说不清就留着' }
    })
    expect(generous.decide(1).keep).toBe(true)
  })

  it('挤位比较:一串比较器依次比,前一层分出胜负就不再往下', () => {
    const compare = compareBy<Piece>(
      (a, b) => a.quality - b.quality,
      (a, b) => a.tier - b.tier,
      (a, b) => a.uid.localeCompare(b.uid)
    )
    expect(compare({ uid: 'a', tier: 9, quality: 1 }, { uid: 'b', tier: 1, quality: 3 })).toBeLessThan(0) // 先比成色
    expect(compare({ uid: 'a', tier: 1, quality: 3 }, { uid: 'b', tier: 9, quality: 3 })).toBeLessThan(0) // 成色同 → 比层级
    const sorted = [{ uid: 'b', tier: 1, quality: 3 }, { uid: 'a', tier: 9, quality: 1 }].sort(compare)
    expect(sorted.map(p => p.uid)).toEqual(['a', 'b'])
  })
})
