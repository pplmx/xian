/* eslint-disable no-console */
/**
 * 组合验收(第九条链)—— **推图一条线**:境界门槛 → 副本节奏 → 实战结算 → 世界记忆。
 *
 * 副本是这套内核点名的四套系统之一(等级 / 装备 / 属性 / **副本**),却一直没有验收链 ——
 * 它单独有用例(`dungeons.spec` + `dungeons.sim.spec`),但"和境界、记忆摆在一起还对不对"没人验过。
 * 这一份补上,并且只断言跨模块才看得出来的事:
 *
 *   一 **开图要两个条件同时满足**:等级够(境界系统给) + 前置已通(副本系统给)。
 *      两条前置的 `all` / `any` 是两种不同的结构(支线汇合 vs 任一即可),阶梯差得很明显;
 *   二 **进度条与实战同源**:`winsUntilBoss` 说"还差几胜"与实跑出来的第几场见首领必须一致 ——
 *      对不上的话,界面写"还差 1 场"而玩家打第 6 场才见到;
 *   三 **首领倒下即重新计数**:`cycle` 节奏下通关之后首领还会再来,`once` 则再也不出;
 *   四 **记忆会回落,但进度不会被清**:48 小时不打交道,繁荣度从 1.35 掉回 1.00 ——
 *      而副本进度、账本一位不动。这条是这一整条链最值钱的一条:
 *      "世界忘了你"与"世界退回原点"是两件事,混在一起写就会出现"回来发现图要重打";
 *   五 **奖励逐场入账,与配置曲线同源**:每场的奖励数额由内容曲线算,回执照抄不重算;
 *   六 **同种子可复现**。
 */
import { describe, expect, it } from 'vitest'
import { createCombatEngine } from './combat.js'
import { createDungeonSystem, emptyProgress, type DungeonProgress } from './dungeons.js'
import { createStageMemory } from './memory.js'
import { createRealmSystem } from './realms.js'
import { createResourceSystem } from './resources.js'
import { createRng } from './rng.js'

// ——— 1 · 境界:4 境 × 3 层(面板随境界涨,门槛就吃这一份) ———

const realms = createRealmSystem({
  worlds: [{ id: 'land', name: '人间', realms: ['布衣', '好手', '名宿', '宗师'] }],
  layerNames: ['初', '中', '高'],
  exp: { base: 100, layerGrowth: 2, realmGrowth: 4 },
  combat: { base: { attack: 30, defense: 12, maxHp: 240 }, layerGrowth: 1.35, realmGrowth: 2.1 },
  breakthrough: { layerBase: 0.9, layerDecay: 0.1, majorBase: 0.7, majorDecay: 0.05, min: 0.1, max: 0.95 }
})

// ——— 2 · 四处地界:一条主线 + 一条支线,最后的石城要两条都通 ———

const dungeons = createDungeonSystem({
  regions: [
    { id: 'pass', name: '山口', tier: 1, minRealm: 0, enemies: ['wolf', 'bandit'], boss: 'wolfKing' },
    { id: 'wood', name: '密林', tier: 2, minRealm: 1, requireCleared: 'pass', enemies: ['boar'], boss: 'spiderQueen' },
    { id: 'mine', name: '矿坑', tier: 2, minRealm: 1, requireCleared: 'pass', enemies: ['rat'], boss: 'ratKing' },
    {
      id: 'keep',
      name: '石城',
      tier: 3,
      minRealm: 2,
      requireCleared: ['wood', 'mine'],
      requireMode: 'all',
      enemies: ['guard'],
      boss: 'lord'
    }
  ],
  enemies: [
    { id: 'wolf', name: '野狼', tier: 1, hpMult: 1, atkMult: 1, defMult: 1, speed: 1 },
    { id: 'bandit', name: '山贼', tier: 1, hpMult: 1.1, atkMult: 1.1, defMult: 1, speed: 1 },
    { id: 'wolfKing', name: '狼王', tier: 1, hpMult: 2.4, atkMult: 1.4, defMult: 1.2, speed: 1, boss: true },
    { id: 'boar', name: '野猪', tier: 2, hpMult: 1.2, atkMult: 1.2, defMult: 1, speed: 1 },
    { id: 'spiderQueen', name: '蛛后', tier: 2, hpMult: 2.2, atkMult: 1.4, defMult: 1.1, speed: 1, boss: true },
    { id: 'rat', name: '石鼠', tier: 2, hpMult: 1, atkMult: 1, defMult: 1, speed: 1 },
    { id: 'ratKing', name: '鼠王', tier: 2, hpMult: 2, atkMult: 1.3, defMult: 1, speed: 1, boss: true },
    { id: 'guard', name: '守军', tier: 3, hpMult: 1.3, atkMult: 1.3, defMult: 1.2, speed: 1 },
    { id: 'lord', name: '城主', tier: 3, hpMult: 2.6, atkMult: 1.6, defMult: 1.3, speed: 1, boss: true }
  ],
  bossProgress: 4,
  bossRhythm: 'once',
  enemyPower: { baseHp: 120, baseAttack: 18, baseDefense: 6, tierGrowth: 2 },
  victoryRewards: [
    { id: 'coin', name: '铜钱', base: 10, tierGrowth: 2 },
    { id: 'herb', name: '草药', base: 1, chance: 0.5 }
  ],
  // 自己接管"这一场给什么":默认奖励照发,但**城印只在击败城主那一次**给
  // (这个钩子是整份配置级的,所以要连区域一起看 —— 每个区域的首领都会走到这里)
  rewardFn: ({ region, encounter, defaultRewards }) => [
    ...defaultRewards.map(r => ({ id: r.id, name: r.name, amount: Number(r.amount) })),
    ...(region.id === 'keep' && encounter.kind === 'boss' ? [{ id: 'seal', name: '城印', amount: 1 }] : [])
  ]
})

// ——— 3 · 世界记忆:打赢多少场决定繁荣,48 小时不打交道就回落 ———

const memory = createStageMemory({
  stages: [
    { id: 'wild', name: '荒僻' },
    { id: 'quiet', name: '安定', at: { count: 4 }, mult: 1.15 },
    { id: 'flourish', name: '繁盛', at: { count: 10 }, mult: 1.35 }
  ],
  decayAfterHours: 48
})

// ——— 4 · 实战:境界面板 × 副本敌人快照,一场一场打 ———

const battle = createCombatEngine({ variance: 0 })
const ledger = createResourceSystem({
  resources: [
    { key: 'coin', name: '铜钱', integer: true },
    { key: 'herb', name: '草药', integer: true },
    { key: 'seal', name: '城印', integer: true }
  ]
})

/** 打一场:境界面板当玩家本值,副本快照当敌人本值 —— 两边都是引擎给的形状 */
function fight(major: number, layer: number, enemyId: string, rng: ReturnType<typeof createRng>): boolean {
  const panel = realms.baseStats(major, layer)
  const foe = dungeons.snapshot(enemyId)
  return battle.resolve(
    {
      id: 'me',
      name: '我',
      stats: { attack: panel.attack ?? 0, defense: panel.defense ?? 0, hp: panel.maxHp ?? 0, maxHp: panel.maxHp ?? 0, speed: 1 },
      mods: {}
    },
    {
      id: foe.id,
      name: foe.name,
      stats: {
        attack: foe.stats.attack ?? 0,
        defense: foe.stats.defense ?? 0,
        hp: foe.stats.hp ?? 0,
        maxHp: foe.stats.maxHp ?? 0,
        speed: foe.stats.speed ?? 1
      },
      mods: foe.mods,
      skills: foe.skills
    },
    rng
  ).win
}

interface RunTrace {
  progress: DungeonProgress
  wallet: Record<string, number>
  battles: number
  wins: number
  bossSeenAt: Record<string, number>
  firstClearAt: Record<string, number>
  rewardsByKind: Record<string, number>
}

/** 推图:逐个区域打到通关(或子弹打光);每 2 场赢一次就"变强一点"(境界推进留给测试显式控制) */
function push(seed: string, order: readonly string[], maxBattles = 400): RunTrace {
  const rng = createRng(seed)
  let progress = emptyProgress()
  let wallet = ledger.create({ coin: 0, herb: 0, seal: 0 })
  const trace: RunTrace = {
    progress,
    wallet,
    battles: 0,
    wins: 0,
    bossSeenAt: {},
    firstClearAt: {},
    rewardsByKind: {}
  }
  let winsSoFar = 0
  for (let i = 0; i < maxBattles; i += 1) {
    // 目标清单上的地界全通了就收工(不是为了刷满子弹)
    if (order.every(id => progress.cleared.includes(id))) break
    // 境界跟着胜场推进:每 6 胜进一境、每 3 胜进一层(够不够强由境界表面板决定,不是硬闸门)
    const major = Math.min(realms.maxMajor, Math.floor(winsSoFar / 6))
    const layer = Math.min(realms.maxLayerOf(major), Math.floor((winsSoFar % 6) / 3))
    // 先推没通关且已开放的那一处;都推完了就回最强的一处刷(刷出胜场 → 面板涨 → 下一处才开)
    const pending = order.find(id => !progress.cleared.includes(id) && dungeons.isUnlocked(id, progress, major))
    const grind = [...order].reverse().find(id => dungeons.isUnlocked(id, progress, major))
    const regionId = pending ?? grind
    if (regionId === undefined) break

    const encounter = dungeons.nextEncounter(regionId, progress, rng)
    trace.battles += 1
    if (!fight(major, layer, encounter.enemyId, rng)) continue
    winsSoFar += 1
    trace.wins += 1
    const outcome = dungeons.onVictory(regionId, encounter, progress, rng)
    if (encounter.kind === 'boss' && trace.bossSeenAt[regionId] === undefined) {
      trace.bossSeenAt[regionId] = trace.battles
    }
    if (outcome.firstClear) trace.firstClearAt[regionId] = trace.battles
    progress = outcome.progress
    for (const reward of outcome.rewards) {
      const paid = ledger.grant(wallet, [{ key: reward.id, amount: reward.amount, source: regionId }])
      wallet = paid.ledger
      trace.rewardsByKind[reward.id] = (trace.rewardsByKind[reward.id] ?? 0) + Number(reward.amount)
    }
  }
  trace.progress = progress
  trace.wallet = wallet
  return trace
}

const EMPTY: DungeonProgress = { cleared: [], bossWins: {}, runs: {} }

describe('组合验收 —— 推图一条线:境界门槛、副本节奏、实战结算与世界记忆', () => {
  it('开图要等级与前置同时满足;两条前置的 all / any 是两种结构', () => {
    const afterPass: DungeonProgress = { cleared: ['pass'], bossWins: {}, runs: {} }
    // 等级不够:前置通了也不开
    expect(dungeons.isUnlocked('wood', afterPass, 0)).toBe(false)
    expect(dungeons.isUnlocked('wood', afterPass, 1)).toBe(true)
    // 前置没通:等级够了也不开
    expect(dungeons.isUnlocked('wood', EMPTY, 3)).toBe(false)
    // 石城要木?两条都通(all)
    const half: DungeonProgress = { cleared: ['pass', 'wood'], bossWins: {}, runs: {} }
    expect(dungeons.isUnlocked('keep', half, 3)).toBe(false)
    const full: DungeonProgress = { cleared: ['pass', 'wood', 'mine'], bossWins: {}, runs: {} }
    expect(dungeons.isUnlocked('keep', full, 2)).toBe(true)
    // 换成"任一即可"就是另一种结构:同一条存档,石城立刻开着
    const anyMode = createDungeonSystem({
      regions: [
        { id: 'pass', name: '山口', tier: 1, minRealm: 0, enemies: ['wolf'], boss: 'wolfKing' },
        { id: 'wood', name: '密林', tier: 2, minRealm: 1, requireCleared: 'pass', enemies: ['boar'], boss: 'spiderQueen' },
        { id: 'mine', name: '矿坑', tier: 2, minRealm: 1, requireCleared: 'pass', enemies: ['rat'], boss: 'ratKing' },
        {
          id: 'keep',
          name: '石城',
          tier: 3,
          minRealm: 2,
          requireCleared: ['wood', 'mine'],
          requireMode: 'any',
          enemies: ['guard'],
          boss: 'lord'
        }
      ],
      enemies: [],
      bossProgress: 4,
      enemyPower: { baseHp: 1, baseAttack: 1, baseDefense: 1, tierGrowth: 1 }
    })
    expect(anyMode.isUnlocked('keep', half, 2)).toBe(true)
    // 前置补票(读档修形):不看等级,只看"前置通过"
    expect(dungeons.prereqClosure(['pass'], ['pass', 'wood', 'mine']).sort()).toEqual(['keep', 'mine', 'pass', 'wood'])
  })

  it('进度条与实战同源:说"还差 1 胜"就真的下一场见首领', () => {
    const rng = createRng('同源')
    let progress = emptyProgress()
    const seen: number[] = []
    for (let battle = 1; battle <= 12; battle += 1) {
      const encounter = dungeons.nextEncounter('pass', progress, rng)
      if (encounter.kind === 'boss') seen.push(battle)
      // 每一场都赢(不计等级),只验节奏
      progress = dungeons.onVictory('pass', encounter, progress, rng).progress
    }
    // bossProgress 4、once 节奏:攒到 4 胜之后的那一场(第 5 场)见首领,通关后不再出
    // (与 dungeons.sim.spec 量的刻度一致:cycle 是第 4 场,once 是第 5 场)
    expect(seen).toEqual([5])
    // 通关之后还能回头刷:胜场继续累计,但这个区域再也不出首领(need = null)
    expect(dungeons.bossProgress('pass', progress).need).toBeNull()
    expect(dungeons.bossProgress('pass', progress).wins).toBe(7)
    expect(dungeons.winsUntilBoss(0, true)).toBeNull()
    expect(dungeons.winsUntilBoss(3, false)).toBe(1) // 界面:还差 1 胜
    // cycle 节奏:同一个配置换成循环,首领每 4 胜来一次(通关不清空它)
    const cycle = createDungeonSystem({
      regions: [{ id: 'pass', name: '山口', tier: 1, minRealm: 0, enemies: ['wolf'], boss: 'wolfKing' }],
      enemies: [{ id: 'wolf', name: '野狼', tier: 1, hpMult: 1, atkMult: 1, defMult: 1, speed: 1 }],
      bossProgress: 4,
      bossRhythm: 'cycle',
      enemyPower: { baseHp: 1, baseAttack: 1, baseDefense: 1, tierGrowth: 1 }
    })
    const seenCycle: number[] = []
    let p2 = emptyProgress()
    const rng2 = createRng('同源')
    for (let battle = 1; battle <= 12; battle += 1) {
      const encounter = cycle.nextEncounter('pass', p2, rng2)
      if (encounter.kind === 'boss') seenCycle.push(battle)
      p2 = cycle.onVictory('pass', encounter, p2, rng2).progress
    }
    expect(seenCycle).toEqual([4, 8, 12]) // 循环:通关之后还会再来
  })

  it('推图:境界够才推得动,前三处都能通关并拿到城印', () => {
    const trace = push('推图', ['pass', 'wood', 'mine', 'keep'])
    console.log(`  打了 ${trace.battles} 场 · 赢 ${trace.wins} 场 · 通关 ${Object.keys(trace.firstClearAt).join(' / ')}`)
    console.log(`  首次通关的场次:${Object.entries(trace.firstClearAt).map(([k, v]) => `${k}=第 ${v} 场`).join(' · ')}`)
    expect(trace.progress.cleared.sort()).toEqual(['keep', 'mine', 'pass', 'wood'])
    // 城印只在第一次击败城主那一次给(这一条走的是 rewardFn 这条接管路)
    expect(trace.wallet.seal).toBe(1)
    // 面板说话:刚出道的布衣硬闯石城必败,宗师圆满才打得过 —— 门槛不是摆设
    expect(fight(0, 0, 'lord', createRng('硬闯'))).toBe(false)
    expect(fight(realms.maxMajor, realms.maxLayerOf(realms.maxMajor), 'lord', createRng('硬闯'))).toBe(true)
    // 见过首领才可能通关:每个通关区域的"第一次见首领"都记在场次表里
    for (const regionId of trace.progress.cleared) expect(trace.bossSeenAt[regionId]).toBeGreaterThan(0)
  })

  it('奖励逐场入账:汇总与逐场之和一致,且数额与配置曲线同源', () => {
    const trace = push('推图', ['pass', 'wood', 'mine', 'keep'])
    // 独立复算:每场的铜钱 = 10 × 2^(tier-1);runs 记的是"打过几场",这一轮每场都赢,故 runs = 该处胜场
    const expectedCoin = ['pass', 'wood', 'mine', 'keep'].reduce((sum, regionId) => {
      const runs = trace.progress.runs[regionId] ?? 0
      const tier = dungeons.region(regionId)?.tier ?? 1
      return sum + runs * 10 * 2 ** (tier - 1)
    }, 0)
    console.log(`  铜钱 ${trace.wallet.coin}(按逐场曲线复算 ${expectedCoin})· 草药 ${trace.wallet.herb}`)
    expect(trace.wallet.coin).toBe(trace.rewardsByKind.coin)
    expect(trace.wallet.coin).toBe(expectedCoin)
    // 草药是 50% 概率的:拿到多少与"赢了多少场"不必相等,但绝不能超过赢的场次
    expect(trace.wallet.herb).toBeLessThanOrEqual(trace.wins)
  })

  it('记忆会回落,但进度与账本一位不动', () => {
    const trace = push('推图', ['pass', 'wood', 'mine', 'keep'])
    const wins = trace.wins
    const floreish = memory.stateOf({ count: wins })
    console.log(`  赢了 ${wins} 场 → ${floreish.name}(×${floreish.mult})`)
    expect(floreish.id).toBe('flourish')
    expect(floreish.mult).toBe(1.35)
    // 48 小时不打交道:回最低档
    const decayed = memory.stateOf({ count: wins, idleHours: 48 })
    expect(decayed.id).toBe('wild')
    expect(decayed.decayed).toBe(true)
    expect(decayed.mult).toBe(1)
    // 而进度与账本一位不动 —— "世界忘了你"不等于"世界退回原点"
    const again = push('推图', ['pass', 'wood', 'mine', 'keep'])
    expect(again.progress).toEqual(trace.progress)
    expect(again.wallet).toEqual(trace.wallet)
    // 钟的起点是"最后一次打交道":打完最后一场 10 小时后仍未过期,50 小时后过期
    const last = 1_700_000_000_000
    const touched = memory.touchedAt(last - 3_600_000, last, last - 7_200_000)
    expect(touched).toBe(last)
    expect(memory.hoursUntil(touched, last + 10 * 3_600_000, 48)).toBe(38)
    expect(memory.idleBeyond(touched, last + 50 * 3_600_000, 48)).toBe(true)
    expect(memory.idleBeyond(0, last + 999 * 3_600_000, 48)).toBe(false) // 从没打过交道的不算"够钟"
  })

  it('同种子可复现;换种子会不一样', () => {
    const a = push('推图', ['pass', 'wood', 'mine', 'keep'])
    const b = push('推图', ['pass', 'wood', 'mine', 'keep'])
    expect(b).toEqual(a)
    // 换种子必须真的会不一样:但单看两颗种子的某一个字段可能"碰巧一样"(草药是 50% 概率的),
    // 所以拿一排种子看分布 —— 都一样就说明随机源根本没进来
    const herbs = Array.from({ length: 8 }, (_, i) => push(`推图-${i + 1}`, ['pass', 'wood', 'mine', 'keep']).wallet.herb)
    console.log(`  八颗种子各自拿到的草药:${herbs.join(' / ')}(本颗种子 ${a.wallet.herb})`)
    expect(new Set(herbs).size).toBeGreaterThan(1)
    expect(push('推图-1', ['pass', 'wood', 'mine', 'keep'])).toEqual(push('推图-1', ['pass', 'wood', 'mine', 'keep']))
  })
})
