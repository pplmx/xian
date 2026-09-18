import { describe, expect, it } from 'vitest'
import { createDungeonSystem, emptyProgress } from './dungeons.js'
import { createRng } from './rng.js'

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

  it('once 节奏:攒够胜场出一次首领,通关后此地再无首领', () => {
    const once = createDungeonSystem({ ...CONFIG, bossRhythm: 'once' as const })
    const rng = createRng(11)
    let progress = emptyProgress()
    const kinds: string[] = []
    for (let i = 0; i < 6; i += 1) {
      const encounter = once.nextEncounter('r1', progress, rng)
      kinds.push(encounter.kind)
      progress = once.onVictory('r1', encounter, progress, rng).progress
    }
    // 攒够 3 胜之后的那一战才是首领(与"还差几胜"的读数一致:还差 0 胜时下一战即首领)
    expect(kinds).toEqual(['normal', 'normal', 'normal', 'boss', 'normal', 'normal'])
    expect(progress.cleared).toEqual(['r1'])
    expect(once.winsUntilBoss(3, true)).toBeNull()
  })

  it('winsUntilBoss:两种节奏下的门槛语义', () => {
    const cycle = createDungeonSystem(CONFIG)
    // cycle:每 3 胜一次,门槛之上循环
    expect(cycle.winsUntilBoss(0)).toBe(3)
    expect(cycle.winsUntilBoss(2)).toBe(1)
    expect(cycle.winsUntilBoss(3)).toBe(3)
    expect(cycle.winsUntilBoss(5)).toBe(1)
    const once = createDungeonSystem({ ...CONFIG, bossRhythm: 'once' as const })
    // once:攒够就出,门槛之上不出现负数;通关后为 null
    expect(once.winsUntilBoss(0)).toBe(3)
    expect(once.winsUntilBoss(3)).toBe(0)
    expect(once.winsUntilBoss(9)).toBe(0)
    expect(once.winsUntilBoss(0, true)).toBeNull()
  })

  it('前置补票:只看"前置是否已通",不看等级,也不吞掉不认识的历史 id', () => {
    const sys = createDungeonSystem(CONFIG)
    expect(sys.prereqClosure(['r1'], ['r1'])).toEqual(['r1', 'r2'])
    expect(sys.prereqClosure(['r1'], ['r1', 'r2'])).toEqual(['r1', 'r2', 'r3'])
    // 补过再补是同一份(幂等)
    expect(sys.prereqClosure(['r1', 'r2'], ['r1'])).toEqual(['r1', 'r2'])
    // 不认识的历史 id 保留
    expect(sys.prereqClosure(['r1', '旧地界'], ['r1'])).toEqual(['r1', '旧地界', 'r2'])
    // 幂等:算到不动点
    const once = sys.prereqClosure(sys.prereqClosure(['r1'], ['r1', 'r2']), ['r1', 'r2'])
    expect(once).toEqual(['r1', 'r2', 'r3'])
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
    // 快照给的是**本值表**(与战斗的输入同形),键名是引擎的接口词
    expect(Number(sys.snapshot('e1').stats.hp)).toBeCloseTo(100, 6)
    expect(Number(sys.snapshot('e3').stats.hp)).toBeCloseTo(110 * 2, 6)
    expect(Number(sys.snapshot('b3').stats.hp)).toBeCloseTo(500 * 4, 6)
    expect(Number(sys.snapshot('e1').stats.maxHp)).toBeCloseTo(100, 6)
    expect(sys.snapshot('b3').boss).toBe(true)
  })

  it('奖励数额可以自己接管(给 amount 时不看 base/tierGrowth,概率仍生效)', () => {
    const custom = createDungeonSystem({
      ...CONFIG,
      victoryRewards: [
        { id: 'score', name: '分', amount: tier => tier * 10 },
        { id: 'rare', name: '稀有', amount: () => 1, chance: 0 }
      ]
    })
    const rng = createRng(5)
    const out = custom.onVictory('r1', { regionId: 'r1', kind: 'boss', enemyId: 'b1' }, emptyProgress(), rng)
    expect(out.rewards.find(r => r.id === 'score')?.amount).toBe(10)
    expect(out.rewards.some(r => r.id === 'rare')).toBe(false) // chance 0 → 不给
  })

  it('敌人数值曲线可以自己接管(scaleFn 完全接管层级系数)', () => {
    const custom = createDungeonSystem({
      ...CONFIG,
      enemyPower: { baseHp: 100, baseAttack: 10, baseDefense: 5, tierGrowth: 99, scaleFn: tier => tier }
    })
    // 层级 1 系数 1、层级 3 系数 3 —— 完全不看 tierGrowth
    expect(Number(custom.snapshot('e1').stats.hp)).toBeCloseTo(100, 6)
    expect(Number(custom.snapshot('e4').stats.hp)).toBeCloseTo(100 * 3, 6)
  })

  it('多条前置:默认"全部已通",也可声明"任一已通即可"', () => {
    const all = createDungeonSystem({
      ...CONFIG,
      regions: [
        { id: 'r1', name: '一图', tier: 1, minRealm: 0, enemies: ['e1'], boss: 'b1' },
        { id: 'r2', name: '二图', tier: 1, minRealm: 0, enemies: ['e1'], boss: 'b1' },
        {
          id: 'r3',
          name: '汇合点',
          tier: 2,
          minRealm: 0,
          enemies: ['e3'],
          boss: 'b2',
          requireCleared: ['r1', 'r2']
        }
      ]
    })
    const none = emptyProgress()
    expect(all.isUnlocked('r3', none, 0)).toBe(false)
    expect(all.isUnlocked('r3', { ...none, cleared: ['r1'] }, 0)).toBe(false)
    expect(all.isUnlocked('r3', { ...none, cleared: ['r1', 'r2'] }, 0)).toBe(true)
    // 补票同理:只补该补的
    expect(all.prereqClosure(['r1'], ['r1'])).toEqual(['r1'])
    expect(all.prereqClosure(['r1'], ['r1', 'r2'])).toEqual(['r1', 'r3'])

    const any = createDungeonSystem({
      ...CONFIG,
      regions: [
        { id: 'r1', name: '一图', tier: 1, minRealm: 0, enemies: ['e1'], boss: 'b1' },
        { id: 'r2', name: '二图', tier: 1, minRealm: 0, enemies: ['e1'], boss: 'b1' },
        { id: 'r3', name: '汇合点', tier: 2, minRealm: 0, enemies: ['e3'], boss: 'b2', requireCleared: ['r1', 'r2'], requireMode: 'any' }
      ]
    })
    expect(any.isUnlocked('r3', { ...none, cleared: ['r2'] }, 0)).toBe(true)
    // 主线顺序仍按第一条前置排:r3 排在 r1 之后
    expect(any.chain().map(r => r.id)).toEqual(['r1', 'r3', 'r2'])
  })
})
