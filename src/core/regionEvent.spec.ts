/**
 * Phase 31.0 A2:区域动态事件 —— 临时异象,自动过期
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { REGION_EVENTS, regionEventDef, currentRegionEvent } from './regionEvent'
import { usePlayerStore } from '@/stores/player'

describe('区域动态事件(regionEvent)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('事件表完整:妖潮/灵脉暴动/古墓/商队', () => {
    expect(REGION_EVENTS.map(e => e.id)).toEqual(['yaochao', 'lingmai', 'gumu', 'shangdui'])
    for (const ev of REGION_EVENTS) {
      expect(ev.desc).toBeTruthy()
      expect(regionEventDef(ev.id)?.name).toBe(ev.name)
    }
  })

  it('事件按区域生效,过期自动清理', () => {
    const player = usePlayerStore()
    player.setRegionEvent({ regionId: 'qingyun', eventId: 'yaochao', endsAt: Date.now() + 60_000 })
    expect(currentRegionEvent('qingyun')?.eventId).toBe('yaochao')
    expect(currentRegionEvent('luoxia')).toBeNull()
    // 过期
    player.setRegionEvent({ regionId: 'qingyun', eventId: 'gumu', endsAt: Date.now() - 1000 })
    expect(currentRegionEvent('qingyun')).toBeNull()
    expect(player.regionEvent).toBeNull()
  })

  it('妖潮更险更多掉落,灵脉无额外危险', () => {
    const yaochao = regionEventDef('yaochao')!
    expect(yaochao.dangerMult).toBeGreaterThan(1)
    expect(yaochao.rewardMult).toBeGreaterThan(1)
    const lingmai = regionEventDef('lingmai')!
    expect(lingmai.dangerMult).toBe(1)
  })

  it('同一个机制换界域换叫法,但倍率一条不动', () => {
    // 人间界有「过路商队」,混沌海里没有 —— 文案按界域取,数值只此一份
    const mortal = regionEventDef('shangdui', 0)!
    const chaos = regionEventDef('shangdui', 20)!
    expect(mortal.name).toBe('商队遇袭')
    expect(chaos.name).not.toBe(mortal.name)
    expect(chaos.rewardMult).toBe(mortal.rewardMult)
    expect(chaos.dangerMult).toBe(mortal.dangerMult)
    expect(chaos.eventMult).toBe(mortal.eventMult)
    for (const id of REGION_EVENTS.map(e => e.id)) {
      for (const major of [9, 14, 20]) {
        const def = regionEventDef(id, major)!
        expect(def.desc, `${id} 在 ${major} 境没有自己的说法`).toBeTruthy()
        expect(def.name, `${id} 在 ${major} 境还用人间界的名字`).not.toBe(regionEventDef(id)!.name)
      }
    }
  })
})
