import { describe, expect, it } from 'vitest'
import { attributeDefs, createAttributeSystem } from './attributes.js'
import { createDungeonSystem, dungeonContentPower, emptyProgress, type EnemySnapshot } from './dungeons.js'
import { createProgressionAudit } from './progression.js'
import { createRealmSystem, type RealmSystemConfig } from './realms.js'
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

  it('遭遇调度可以自己接管:指定敌人、强制出首领、或返回 null 交回默认', () => {
    // 前两场必是 e2,第三场必出首领,其余交回默认
    const sys = createDungeonSystem({
      ...CONFIG,
      encounterFn: ({ region, progress }) => {
        const runs = progress.runs[region.id] ?? 0
        if (runs === 0 || runs === 1) return { kind: 'normal', enemyId: 'e2' }
        if (runs === 2) return { kind: 'boss' }
        return null
      }
    })
    const rng = createRng(1)
    let progress = emptyProgress()
    const seen: string[] = []
    for (let i = 0; i < 4; i += 1) {
      const enc = sys.nextEncounter('r1', progress, rng)
      seen.push(enc.enemyId)
      progress = sys.onVictory('r1', enc, progress, rng).progress
    }
    expect(seen.slice(0, 2)).toEqual(['e2', 'e2'])
    expect(seen[2]).toBe('b1') // 首领
    expect(seen[3]).toBeTruthy() // 交回默认
    // 返回 { kind:'normal' } 但不指定敌人 → 从本区普通池里挑
    const anyNormal = createDungeonSystem({ ...CONFIG, encounterFn: () => ({ kind: 'normal' }) })
    expect(['e1', 'e2']).toContain(anyNormal.nextEncounter('r1', emptyProgress(), createRng(3)).enemyId)
  })

  it('奖励可自己接管:能读到默认奖励再决定,返回 null 就用默认', () => {
    // 首领双倍、普通遭遇按默认
    const sys = createDungeonSystem({
      ...CONFIG,
      rewardFn: ({ encounter, defaultRewards }) =>
        encounter.kind === 'boss' ? defaultRewards.map(r => ({ id: r.id, name: r.name, amount: r.amount * 2 })) : null
    })
    const rng = createRng(9)
    const normal = sys.onVictory('r1', { regionId: 'r1', kind: 'normal', enemyId: 'e1' }, emptyProgress(), rng)
    const boss = sys.onVictory('r1', { regionId: 'r1', kind: 'boss', enemyId: 'b1' }, emptyProgress(), rng)
    const base = createDungeonSystem(CONFIG)
    const baseNormal = base.onVictory('r1', { regionId: 'r1', kind: 'normal', enemyId: 'e1' }, emptyProgress(), createRng(9))
    expect(normal.rewards).toEqual(baseNormal.rewards) // 返回 null → 默认
    expect(Number(boss.rewards.find(r => r.id === 'exp')!.amount)).toBeCloseTo(
      Number(base.onVictory('r1', { regionId: 'r1', kind: 'boss', enemyId: 'b1' }, emptyProgress(), createRng(9)).rewards.find(r => r.id === 'exp')!.amount) * 2,
      6
    )
    // 完全另起一套也行
    const custom = createDungeonSystem({ ...CONFIG, rewardFn: () => [{ id: 'star', name: '星', amount: 7 }] })
    expect(custom.onVictory('r1', { regionId: 'r1', kind: 'normal', enemyId: 'e1' }, emptyProgress(), createRng(1)).rewards).toEqual([
      { id: 'star', name: '星', amount: 7 }
    ])
  })
})

/**
 * 内容强度 —— **体检的另一半**。
 *
 * 成长体检要两把尺子:玩家那一侧在等级表里,内容这一侧其实也在内容表里(区域的层级与
 * 推荐境界)。手写一条 `20 * 3 ** major` 的曲线等于把已经写好的那一半抄一遍 ——
 * 抄错了还看不出来,体检会拿一条错的曲线告诉你"内容没被碾"。这里钉的就是"别再手写":
 * 口径、退化路径、以及"体检真的在逐格用它"。
 */

/** 一个看得出单调的保底口径(真实作品该接属性系统的 `compute().power`) */
const crudePower = (snap: EnemySnapshot<number>): number =>
  Number(snap.stats.hp) + Number(snap.stats.attack)

/** 一张最小境界表(3 境 × 2 层,面板每层 ×2)—— 只用来把体检接起来 */
const ladder = (): RealmSystemConfig => ({
  worlds: [{ id: 'w', name: '一界', realms: ['一重', '二重', '三重'] }],
  layerNames: ['上', '下'],
  exp: { base: 100, layerGrowth: 2, realmGrowth: 3, lateRealmGrowth: 3 },
  combat: { base: { attack: 10 }, layerGrowth: 2, realmGrowth: 3, lateRealmGrowth: 3 },
  breakthrough: { layerBase: 0.9, layerDecay: 0.1, majorBase: 0.6, majorDecay: 0.1, min: 0.1, max: 0.9 }
})

describe('内容强度 —— 直接从副本区域表读', () => {
  it('默认口径:该境界能打到的最强那一处区域,取它的首领', () => {
    const sys = createDungeonSystem(CONFIG)
    const content = dungeonContentPower({ dungeons: sys, powerOf: crudePower })
    expect(content(0)).toBeCloseTo(crudePower(sys.snapshot('b1')), 10)
    expect(content(1)).toBeCloseTo(crudePower(sys.snapshot('b2')), 10)
    expect(content(5)).toBeCloseTo(crudePower(sys.snapshot('b3')), 10)
  })

  it('这一境还没配内容:读数向下沿用,不凭空外推', () => {
    const sys = createDungeonSystem(CONFIG)
    const content = dungeonContentPower({ dungeons: sys, powerOf: crudePower })
    // 三图的 minRealm 是 5 —— 第 2~4 境区域表里没有新东西,能打到的最强一处仍是二图
    for (const major of [2, 3, 4]) expect(content(major)).toBeCloseTo(crudePower(sys.snapshot('b2')), 10)
    // 而且单调不减:内容不会因为你升了境界而变软
    const series = [0, 1, 4, 5, 9].map(content)
    expect(series).toEqual([...series].sort((a, b) => a - b))
  })

  it('接属性系统:与玩家那一侧同源(compute().power 的口径)', () => {
    const sys = createDungeonSystem(CONFIG)
    const attributes = createAttributeSystem({ defs: attributeDefs({}) })
    const content = dungeonContentPower({ dungeons: sys, attributes })
    expect(content(0)).toBeCloseTo(Number(attributes.compute({ base: sys.snapshot('b1').stats }).power), 10)
  })

  it('挑哪一处、挑哪只敌人都能自己接管', () => {
    const sys = createDungeonSystem(CONFIG)
    const content = dungeonContentPower({
      dungeons: sys,
      powerOf: crudePower,
      regionOf: () => sys.region('r1'),
      enemyOf: region => region.enemies[0]
    })
    expect(content(9)).toBeCloseTo(crudePower(sys.snapshot('e1')), 10)
  })

  it('接上体检:每一格的"玩家 ÷ 内容"就是拿这张区域表算的', () => {
    const sys = createDungeonSystem(CONFIG)
    const realms = createRealmSystem(ladder())
    const content = dungeonContentPower({ dungeons: sys, powerOf: crudePower })
    const power = (major: number, layer: number): number => Number(realms.baseStats(major, layer)['attack'] ?? 0)
    const audit = createProgressionAudit({ realms, power, contentPower: content })
    // 逐格对账:体检没有缓存第二次、也没有把内容当成"全局一个数"
    for (const step of audit.steps) {
      expect(step.ratio).toBeCloseTo(power(step.major, step.layer) / content(step.major), 10)
    }
    // 内容厚薄一改,碾压格数当场跟着变 —— 这一条是"体检真的在读它"的判据
    const soft = createProgressionAudit({ realms, power, contentPower: major => content(major) / 100 })
    const hard = createProgressionAudit({ realms, power, contentPower: major => content(major) / 10 })
    expect(soft.summary().crushing).toBeGreaterThan(hard.summary().crushing)
  })

  it('不给口径就报错:不知道拿什么当战力', () => {
    const sys = createDungeonSystem(CONFIG)
    expect(() => dungeonContentPower({ dungeons: sys })).toThrow(
      '内容强度:要么给 powerOf,要么给 attributes —— 不给就不知道拿什么当战力'
    )
  })

  it('区域表是空的 / 这处一只敌人都没有:点名报错,而不是给个 NaN', () => {
    const empty = createDungeonSystem({ regions: [], enemies: [] })
    const emptyContent = dungeonContentPower({ dungeons: empty, powerOf: crudePower })
    expect(() => emptyContent(0)).toThrow('内容强度:这个境界没有可用的区域 —— 第 0 境界')
    const broken = createDungeonSystem({
      regions: [{ id: 'x', name: '空图', tier: 1, minRealm: 0, enemies: ['nope'], boss: 'gone' }],
      enemies: []
    })
    const brokenContent = dungeonContentPower({ dungeons: broken, powerOf: crudePower })
    expect(() => brokenContent(0)).toThrow('内容强度:这处区域没有可用的敌人 —— x')
  })
})
