/* eslint-disable no-console */
/**
 * 消融实验 —— 打几场见首领、以及敌人随层级陡多少。
 *
 * `dungeons.spec.ts` 钉的是语义(首领进度怎么攒、节奏 cycle 与 once 的区别、通关链怎么解、奖励怎么发);
 * 这一份量的是**内容作者的刻度**:同一份 `bossProgress` 在两种节奏下**差一场**、
 * 敌人强度随层级怎么涨、概率奖励实际出现多少、首通与刷本各拿到什么。
 *
 * 三条量出来的结论:
 *   ① **`bossProgress` 一样,两种节奏差一场**:同样填 4,`cycle` 是**第 4 场**见首领,
 *      `once` 是**第 5 场**(前者"攒够就换",后者"攒满才换")—— 差一场,玩家能感觉出来;
 *   ② **首领倒下即重新计数**:打过首领之后又是一轮 4 场普通遭遇(不是"见过一次之后次次见");
 *      `once` 通关之后更是**再也没有首领**(刷本变纯刷素材);
 *   ③ **层级倍率是乘出来的**:`tierGrowth` 管底子,每条敌人自己的 `hpMult/atkMult/defMult`
 *      再乘上去 —— 高一级的敌人血厚一倍多,首领再乘一层,量出来才看得清"这一级难多少"。
 */
import { describe, expect, it } from 'vitest'
import { createRng } from './rng.js'
import type { DungeonConfig } from './dungeons.js'
import { createDungeonSystem, emptyProgress } from './dungeons.js'

const CONFIG: DungeonConfig = {
  regions: [
    { id: 'plain', name: '平原', tier: 1, minRealm: 0, enemies: ['grunt', 'runner'], boss: 'plainBoss' },
    { id: 'hill', name: '山地', tier: 2, minRealm: 1, enemies: ['goat'], boss: 'hillBoss', requireCleared: 'plain' }
  ],
  enemies: [
    { id: 'grunt', name: '拦路小兵', tier: 1, hpMult: 1, atkMult: 1, defMult: 1, speed: 1 },
    { id: 'runner', name: '跑得快的', tier: 1, hpMult: 0.8, atkMult: 1.2, defMult: 0.9, speed: 1.3 },
    { id: 'plainBoss', name: '平原首领', tier: 1, hpMult: 3, atkMult: 1.3, defMult: 1.2, speed: 1, boss: true },
    { id: 'goat', name: '山道岩羊', tier: 2, hpMult: 1.1, atkMult: 1.1, defMult: 1, speed: 1.2 },
    { id: 'hillBoss', name: '山地首领', tier: 2, hpMult: 3.5, atkMult: 1.4, defMult: 1.3, speed: 1, boss: true }
  ],
  bossProgress: 4,
  bossRhythm: 'once',
  enemyPower: { baseHp: 100, baseAttack: 10, baseDefense: 6, tierGrowth: 2.1 },
  victoryRewards: [
    { id: 'exp', name: '经验', base: 20, tierGrowth: 1.8 },
    { id: 'gear', name: '装备', base: 1, chance: 0.3 }
  ]
}

const sim = (rhythm: 'cycle' | 'once'): ReturnType<typeof createDungeonSystem<number>> =>
  createDungeonSystem<number>({ ...CONFIG, bossRhythm: rhythm })

/** 连打若干场,返回每一场的类型(遇到首领就按"打赢并结算"推进) */
function runEncounterSequence(
  system: ReturnType<typeof createDungeonSystem<number>>,
  battles: number
): ('normal' | 'boss')[] {
  const rng = createRng('副本')
  let progress = emptyProgress()
  const kinds: ('normal' | 'boss')[] = []
  for (let i = 0; i < battles; i += 1) {
    const encounter = system.nextEncounter('plain', progress, rng)
    kinds.push(encounter.kind)
    progress = system.onVictory('plain', encounter, progress, rng).progress
  }
  return kinds
}

const at = (kinds: readonly string[]): number[] => kinds.flatMap((kind, index) => (kind === 'boss' ? [index + 1] : []))

describe('消融实验 —— 打几场见首领、敌人陡多少', () => {
  it('同样的 bossProgress,两种节奏差一场:cycle 第 4 场、once 第 5 场', () => {
    const once = runEncounterSequence(sim('once'), 10)
    const cycle = runEncounterSequence(sim('cycle'), 10)
    console.log(`  once :${once.join(' ')} —— 首领出现在第 ${at(once).join('、')} 场`)
    console.log(`  cycle:${cycle.join(' ')} —— 首领出现在第 ${at(cycle).join('、')} 场`)

    // ① 同一份内容,两种节奏的"第几场见首领"差一场 —— 这是最容易写错的一格
    expect(at(once)).toEqual([5])
    expect(at(cycle)).toEqual([4, 8])
    // ② once 通关之后不再有首领(刷本变纯刷素材);cycle 通关不改变节奏
    expect(once.slice(5).every(kind => kind === 'normal')).toBe(true)
    expect(at(runEncounterSequence(sim('cycle'), 12))).toEqual([4, 8, 12])
    // 防空转:两种节奏的序列确实不同(否则上面两组断言是在比同一个东西)
    expect(once.slice(0, 5)).not.toEqual(cycle.slice(0, 5))
  })

  it('首领倒下即重新计数:下一轮又要攒满一遍', () => {
    const kinds = runEncounterSequence(sim('cycle'), 9)
    // 第 4 场首领之后,第 5~7 场又是普通,第 8 场才是下一个首领
    expect(kinds.slice(4, 8)).toEqual(['normal', 'normal', 'normal', 'boss'])
    console.log(`  首领之后的三场:${kinds.slice(4, 7).join(' → ')}(第 8 场才是下一个首领)`)

    // 进度读数与序列一致:wins 在 0..bossProgress 之间来回
    const rng = createRng('进度读数')
    let progress = emptyProgress()
    const seen: { wins: number; need: number | null }[] = []
    for (let i = 0; i < 6; i += 1) {
      const before = sim('cycle').bossProgress('plain', progress)
      seen.push(before)
      const encounter = sim('cycle').nextEncounter('plain', progress, rng)
      progress = sim('cycle').onVictory('plain', encounter, progress, rng).progress
    }
    console.log(`  每一场之前的读数(已赢几场 / 还差几场):${seen.map(s => `${s.wins}/${s.need}`).join(' · ')}`)
    expect(seen[0]!.wins).toBe(0)
    expect(seen[4]!.wins).toBe(0) // 首领那一场之后重新计数
    // 防空转:读数确实在变(不是一直 0)
    expect(new Set(seen.map(s => s.wins)).size).toBeGreaterThan(1)
  })

  it('敌人强度:层级倍率 × 各自系数,一级差多少看得见', () => {
    const system = sim('once')
    const rows = CONFIG.enemies.map(def => {
      const snap = system.snapshot(def.id)
      return {
        name: def.name,
        tier: def.tier,
        boss: def.boss === true,
        hp: snap.stats.hp ?? 0,
        attack: snap.stats.attack ?? 0,
        defense: snap.stats.defense ?? 0
      }
    })
    console.log('  敌人快照(hp / 攻 / 防)')
    const num = (value: number): string => String(Number(value.toFixed(1)))
    for (const row of rows) {
      console.log(
        `  ${row.name.padEnd(6, ' ')} T${row.tier}${row.boss ? ' 首领' : '    '} → ${num(row.hp)} / ${num(row.attack)} / ${num(row.defense)}`
      )
    }

    const grunt = rows.find(r => r.name === '拦路小兵')!
    const goat = rows.find(r => r.name === '山道岩羊')!
    const boss = rows.find(r => r.name === '平原首领')!
    // ③ 层级倍率:100 → 210(2.1 倍),再乘各自的 hpMult
    expect(grunt.hp).toBe(100)
    expect(goat.hp).toBeCloseTo(100 * 2.1 * 1.1, 6)
    // 首领是自己那一级再乘 3 倍血
    expect(boss.hp).toBe(300)
    // 防空转:同级的两个普通敌人因为系数不同而不同(说明 hpMult 一类确实参与)
    const runner = rows.find(r => r.name === '跑得快的')!
    expect(runner.hp).toBe(80)
    expect(runner.attack).toBeGreaterThan(grunt.attack)
    // 层级是陡的:高一级的血量是低一级的两倍多
    expect(goat.hp).toBeGreaterThan(grunt.hp * 2)
  })

  it('通关奖励:首通只有一次,概率项实测三成', () => {
    const system = sim('once')
    const rng = createRng('奖励')
    let progress = emptyProgress()
    let firstClears = 0
    let runs = 0
    let gearRuns = 0
    for (let i = 0; i < 2000; i += 1) {
      const encounter = { regionId: 'plain', kind: 'boss' as const, enemyId: 'plainBoss' }
      const outcome = system.onVictory('plain', encounter, progress, rng)
      progress = outcome.progress
      runs += 1
      if (outcome.firstClear) firstClears += 1
      if (outcome.rewards.some(r => r.id === 'gear')) gearRuns += 1
    }
    console.log(`  连打 ${runs} 次首领:首通 ${firstClears} 次 · 掉落"装备" ${gearRuns} 次(${((gearRuns / runs) * 100).toFixed(1)}%)`)

    // 首通只算一次(哪怕再打 1999 次)
    expect(firstClears).toBe(1)
    // 概率项实测对齐 30%
    expect(gearRuns / runs).toBeCloseTo(0.3, 1)
    // 固定项每次都发:经验 = base × growth^(tier-1),tier 1 就是 20
    const exp = system.onVictory('plain', { regionId: 'plain', kind: 'normal', enemyId: 'grunt' }, emptyProgress(), rng)
    expect(exp.rewards.find(r => r.id === 'exp')!.amount).toBe(20)
  })
})
