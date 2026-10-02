import { describe, expect, it } from 'vitest'
import { announceWorldEntry } from './worldRite'
import { WORLDS } from '@/data/realms'

describe('世界变迁宣告 —— 只记上行跨界的那一刻', () => {
  it('越过人间→仙界(9)该宣告仙界', () => {
    expect(announceWorldEntry(8, 9)?.id).toBe('immortal')
    expect(announceWorldEntry(8, 9)?.name).toBe('仙界')
  })

  it('越过仙界→神界(14)与神界→混沌(18)各自宣告对应界', () => {
    expect(announceWorldEntry(13, 14)?.id).toBe('god')
    expect(announceWorldEntry(17, 18)?.id).toBe('chaos')
  })

  it('同界内的常规突破不宣告(9 之内的每一境都不算迁入)', () => {
    expect(announceWorldEntry(4, 5)).toBeNull()
    expect(announceWorldEntry(0, 1)).toBeNull()
  })

  it('出生即人间(0)不宣告 — 那是初始世界不是迁入', () => {
    expect(announceWorldEntry(-1, 0)).toBeNull()
    expect(announceWorldEntry(0, 0)).toBeNull()
  })

  it('转世回落 / 原地踏步不宣告 — 那是此世已了的另一声', () => {
    expect(announceWorldEntry(12, 0)).toBeNull()
    expect(announceWorldEntry(18, 18)).toBeNull()
  })

  it('宣告的一定是世界首格(与 isWorldEntry 同口径)', () => {
    for (const w of WORLDS) {
      const res = announceWorldEntry(w.start - 1, w.start)
      if (w.id === 'mortal') expect(res).toBeNull()
      else expect(res?.id).toBe(w.id)
    }
  })
})
