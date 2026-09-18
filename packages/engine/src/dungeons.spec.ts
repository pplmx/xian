import { describe, expect, it } from 'vitest'
import { createDungeonSystem, emptyProgress } from './dungeons'
import { createRng } from './rng'

const CONFIG = {
  regions: [
    { id: 'r1', name: '一图', tier: 1, minRealm: 0, enemies: ['e1', 'e2'], boss: 'b1' },
    { id: 'r2', name: '二图', tier: 2, minRealm: 1, enemies: ['e3'], boss: 'b2', requireCleared: 'r1' },
    { id: 'r3', name: '三图', tier: 3, minRealm: 5, enemies: ['e4'], boss: 'b3', requireCleared: 'r2' }
  ],
  enemies: [
    { id: 'e1', name: '小怪甲', tier: 1, hpMult: 1, atkMult: 1, defMult: 1, speed: 1 },
    { id: 'e2', name: '小怪乙', tier: 1, hpMult: 1.2, atkMult: 0.8, defMult: 1.1, speed: 0.9 },
    { id: 'b1', name: '首领甲', tier: 1, hpMult: 3, atkMult: 1.2, defMult: 1.1, speed: 1, boss: true },
    { id: 'e3', name: '小怪丙', tier: 2, hpMult: 1.1, atkMult: 1.1, defMult: 1, speed: 1 },
    { id: 'b2', name: '首领乙', tier: 2, hpMult: 4, atkMult: 1.3, defMult: 1.2, speed: 1, boss: true },
    { id: 'e4', name: '小怪丁', tier: 3, hpMult: 1, atkMult: 1.2, defMult: 1, speed: 1 },
    { id: 'b3', name: '首领丙', tier: 3, hpMult: 5, atkMult: 1.4, defMult: 1.3, speed: 1, boss: true }
  ],
  bossProgress: 3,
  enemyPower: { baseHp: 100, baseAttack: 10, baseDefense: 5, tierGrowth: 2 },
  victoryRewards: [{ id: 'exp', name: '修为', base: 10, tierGrowth: 2 }]
}

describe('副本系统 —— 区域链/遭遇/首领门槛/通关奖励', () => {
  it('主线顺序由前置关系决定', () => {
    const sys = createDungeonSystem(CONFIG)
    expect(sys.chain().map(r => r.id)).toEqual(['r1', 'r2', 'r3'])
    expect(sys.firstRegion().id).toBe('r1')
  })

  it('解锁 = 等级够 + 前置已通', () => {
    const sys = createDungeonSystem(CONFIG)
    const none = emptyProgress()
    expect(sys.isUnlocked('r1', none, 0)).toBe(true)
    expect(sys.isUnlocked('r2', none, 1)).toBe(false)
    expect(sys.isUnlocked('r2', { ...none, cleared: ['r1'] }, 1)).toBe(true)
    expect(sys.isUnlocked('r2', { ...none, cleared: ['r1'] }, 0)).toBe(false)
    expect(sys.unlocked({ ...none, cleared: ['r1'] }, 1).map(r => r.id)).toEqual(['r1', 'r2'])
  })

  it('首领进度攒满必出首领,击败首领后重新计数', () => {
    const sys = createDungeonSystem(CONFIG)
    const rng = createRng(1)
    let progress = emptyProgress()
    const kinds: string[] = []
    for (let i = 0; i < 6; i += 1) {
      const encounter = sys.nextEncounter('r1', progress, rng)
      kinds.push(encounter.kind)
      progress = sys.onVictory('r1', encounter, progress, rng).progress
    }
    expect(kinds).toEqual(['normal', 'normal', 'boss', 'normal', 'normal', 'boss'])
  })

  it('通关只记第一次,奖励按层级放大', () => {
    const sys = createDungeonSystem(CONFIG)
    const rng = createRng(2)
    let progress = emptyProgress()
    const bossEncounter = { regionId: 'r1', kind: 'boss' as const, enemyId: 'b1' }
    const first = sys.onVictory('r1', bossEncounter, progress, rng)
    expect(first.firstClear).toBe(true)
    expect(progress.cleared).toEqual([])
    progress = first.progress
    expect(progress.cleared).toEqual(['r1'])
    const second = sys.onVictory('r1', bossEncounter, progress, rng)
    expect(second.firstClear).toBe(false)

    const r1exp = first.rewards.find(r => r.id === 'exp')!.amount
    const deep = sys.onVictory('r2', { regionId: 'r2', kind: 'boss', enemyId: 'b2' }, emptyProgress(), rng)
    const r2exp = deep.rewards.find(r => r.id === 'exp')!.amount
    expect(r2exp).toBeCloseTo(r1exp * 2, 6)
  })

  it('敌人快照按层级放大,并带上自己的词条', () => {
    const sys = createDungeonSystem(CONFIG)
    expect(Number(sys.snapshot('e1').hp)).toBeCloseTo(100, 6)
    expect(Number(sys.snapshot('e3').hp)).toBeCloseTo(110 * 2, 6)
    expect(Number(sys.snapshot('b3').hp)).toBeCloseTo(500 * 4, 6)
    expect(sys.snapshot('b3').boss).toBe(true)
  })
})
