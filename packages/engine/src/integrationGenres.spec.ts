/* eslint-disable no-console */
/**
 * 组合验收(第十条链)—— **同一段代码,三份内容包**。
 *
 * 库里那句"换一套名称与数值,就能搭出自己的游戏"此前只有一条弱判据:`verify-dist` 会把三份
 * 内容包各装配一遍,确认它们**装得起来**。但"装得起来"不等于"同一段玩法代码跑得通" ——
 * 尤其是三份包把**本值键名全换了**:修仙叫 `attack/defense/maxHp`,星港叫 `火力/装甲/结构值`,
 * 学习题材叫 `专注力/…`。任何一处偷偷按名字取键,都会在这里露出来。
 *
 * 所以这一条链不写内容,只写**一段通用流程**,然后对三份包各跑一遍:
 *
 *   装配 → 修为满一层 → 进阶 → 掉一件装 → 装配 → 打一场 → 通关奖励 → 入账 → 计数与任务 →
 *   存档编码 → 解码 → 再跑一遍
 *
 * 断言的全是**与题材无关的不变量**:
 *   一 **装得起来、跑得通**:三份包都走完全程,而且都用各自的门面(不碰任何具体键名);
 *   二 **面板单调**:境界往上走一格之后,面板里的每个数都不许变小;
 *   三 **账目守恒**:每一次"给了什么"都记进账本,且账本增量 == 回执合计;
 *   四 **存档往返**:编码再解码之后的状态逐字段相同(存档不挑题材);
 *   五 **同种子可复现**:三份包各自再跑一遍,逐字段一致 —— 换内容不该带来"随机的样子不一样"。
 */
import { describe, expect, it } from 'vitest'
import { defineGame, type Game, type GameConfig } from './config.js'
import { createRng } from './rng.js'
import { createResourceSystem, type Ledger } from './resources.js'
import { defineSaveFormat, decodeSave, encodeSave } from './save.js'
import { DAILY } from './presets/daily.js'
import { DEMO } from './presets/demo.js'
import { XIUXIAN } from './presets/xiuxian.js'

interface RunResult {
  name: string
  /** 各境界的面板(核心键 → 数值),用来验单调 */
  panels: Record<string, number>[]
  /** 账本里每一样东西最终有多少 */
  wallet: Ledger<number>
  /** 回执合计(与实际入账同源) */
  receipt: Record<string, number>
  /** 走过的遭遇与胜负 */
  battles: { enemy: string; win: boolean }[]
  /** 掉出来并装上的那件 */
  equipped: string | null
  /** 进度与计数 */
  progress: { cleared: number; exp: number }
}

/** 一段与题材无关的通用流程:所有键名都从 `game` 的门面里取 */
function runGenre<T>(config: GameConfig<T>, seed: string): RunResult {
  const game: Game<T> = defineGame(config)
  const rng = createRng(seed)
  const ledger = createResourceSystem({
    resources: [
      { key: 'coin', name: '通货', integer: true },
      { key: 'exp', name: '成长值', integer: true }
    ]
  })
  let wallet = ledger.create({ coin: 0, exp: 0 })
  const receipt: Record<string, number> = {}

  // 一 · 各境界的面板(按境界序号走,不碰任何键名)
  const panels: Record<string, number>[] = []
  for (let major = 0; major <= game.realms.maxMajor; major += 1) {
    const stats = game.realms.baseStats(major, 0)
    const row: Record<string, number> = {}
    for (const [key, value] of Object.entries(stats)) row[key] = Number(value)
    panels.push(row)
  }

  // 二 · 从第一格推到"修为满 + 进阶"
  let state = { major: 0, layer: 0, exp: 0 as T }
  state = game.realms.addExp(state, game.realms.expCost(0, 0))
  const breakthrough = game.realms.attemptBreakthrough(state, { rng })
  if (breakthrough.ok) state = breakthrough.state

  // 三 · 掉一件装并装上(门面会自己处理槽位与品质)
  const dropped = game.equipment.generate(rng, { tier: 1 })
  const equipped = game.equipment.resolve(dropped).template?.name ?? null

  // 四 · 打一场:玩家面板 × 副本快照 —— 两边都是各自门面给的形状
  const region = game.dungeons.firstRegion()
  const encounter = game.dungeons.nextEncounter(region.id, { cleared: [], bossWins: {}, runs: {} }, rng)
  const playerStats = game.realms.baseStats(state.major, state.layer)
  const foe = game.dungeons.snapshot(encounter.enemyId)
  const panel = game.attributes.compute({ base: playerStats as Record<string, T> })
  /**
   * 两份本值表:玩家那份自带内容键(`attributes.compute` 按配置给的键返回),
   * 敌人那份**永远是引擎键**(副本那一层的接口词是 attack/defense/hp/maxHp/speed)。
   * 换键名的作品就在这一层做一次映射 —— 映射之后的表才是战斗引擎要的形状。
   * 这里不写死任何键名,只照着配置里的 `combat.keys` 走。
   */
  const keys = config.combat?.keys ?? {}
  const rename = (table: Record<string, unknown>): Record<string, unknown> => {
    if (!keys.attack) return table
    const out: Record<string, unknown> = {}
    for (const [role, key] of Object.entries(keys)) out[key as string] = table[role]
    return out
  }
  const player = panel.final as Record<string, unknown>
  const enemy = rename(foe.stats as Record<string, unknown>)
  const battle = game.combat.resolve(
    { id: 'player', name: '玩家', stats: player as Record<string, T>, mods: {} },
    { id: foe.id, name: foe.name, stats: enemy as Record<string, T>, mods: foe.mods, skills: foe.skills },
    rng
  )

  // 五 · 通关奖励:走库的掉落表与结算(拿配置里的通用奖励定义)
  const outcome = game.dungeons.onVictory(region.id, encounter, { cleared: [], bossWins: {}, runs: {} }, rng)
  for (const reward of outcome.rewards) {
    const applied = ledger.apply(wallet, [{ key: 'coin', amount: Number(reward.amount), source: '通关' }])
    wallet = applied.ledger
    receipt.coin = (receipt.coin ?? 0) + (applied.entries[0]?.applied ?? 0)
  }
  const grew = ledger.apply(wallet, [{ key: 'exp', amount: state.exp as unknown as number, source: '修为' }])
  wallet = grew.ledger
  receipt.exp = (receipt.exp ?? 0) + (grew.entries[0]?.applied ?? 0)

  return {
    name: game.name,
    panels,
    wallet,
    receipt,
    battles: [{ enemy: foe.name, win: battle.win }],
    equipped,
    progress: { cleared: outcome.progress.cleared.length, exp: Number(state.exp) }
  }
}

const GENRES: { id: string; config: GameConfig<number> }[] = [
  { id: 'xiuxian', config: XIUXIAN },
  { id: 'demo', config: DEMO },
  { id: 'daily', config: DAILY }
]

/**
 * 第四份"内容包":**键名也换掉**的那种。
 *
 * 三份预设改的是**展示名**(攻击 → 火力 → 专注力),机器键仍是 `attack/defense/maxHp`;
 * 而真正"连键名一起换"的作品要靠 `BattleConfig.keys` 指路。这一份就把它跑一遍 ——
 * 顺带露出一个真实的接缝:**副本给的敌人快照永远用引擎键**(attack/defense/hp),
 * 换键名的作品要在这一层自己映射(下面那三行就是)。
 */
const CUSTOM_KEYS: GameConfig<number> = {
  name: '棋院联赛(键名也换掉)',
  attributes: {
    defs: [
      { key: 'power', name: '棋力', kind: 'flat' },
      { key: 'guard', name: '定力', kind: 'flat' },
      { key: 'vitality', name: '心神', kind: 'flat' },
      { key: 'powerPct', name: '棋力增幅', kind: 'percent', appliesTo: 'power' }
    ],
    core: ['power', 'guard', 'vitality']
  },
  realms: {
    worlds: [{ id: 'hall', name: '棋院', realms: ['启蒙', '入门', '人段', '神段'] }],
    layerNames: ['一', '二', '三'],
    exp: { base: 80, layerGrowth: 1.6, realmGrowth: 3 },
    combat: { base: { power: 20, guard: 10, vitality: 200, speed: 1 }, layerGrowth: 1.4, realmGrowth: 2.5 },
    breakthrough: { layerBase: 0.9, layerDecay: 0.05, majorBase: 0.7, majorDecay: 0.05, min: 0.1, max: 0.95 }
  },
  equipment: {
    slots: [{ id: 'board', name: '棋盘' }],
    qualities: [{ id: 'common', name: '常用', rank: 0, mult: 1, affixes: [0, 1], weight: 100 }],
    templates: [{ id: 'board1', name: '榧木盘', slot: 'board', tier: 1, base: { power: 5, guard: 3 } }],
    affixes: [],
    power: { tierGrowth: 2, baseFactor: 1, qualityExponent: 1, levelBonus: 0.1 }
  },
  dungeons: {
    regions: [{ id: 'room', name: '棋室', tier: 1, minRealm: 0, enemies: ['rival'], boss: 'rival' }],
    enemies: [{ id: 'rival', name: '对手', tier: 1, hpMult: 1, atkMult: 1, defMult: 1, speed: 1 }],
    enemyPower: { baseHp: 100, baseAttack: 15, baseDefense: 5, tierGrowth: 2 }
  },
  // 键名映射:引擎按这里去认"哪个键是攻/防/血"
  combat: { keys: { attack: 'power', defense: 'guard', hp: 'vitality', maxHp: 'vitality', speed: 'speed' } }
}

describe('组合验收 —— 同一段代码,三份内容包', () => {
  it('四份内容包都跑得通同一条链:三份换展示名,第四份连键名一起换', () => {
    const all = [...GENRES, { id: 'custom', config: CUSTOM_KEYS }]
    const results = all.map(genre => ({
      genre: genre.id,
      run: runGenre(genre.config, '同一条链'),
      attackName: defineGame(genre.config).attributes.name('attack')
    }))
    for (const { genre, run } of results) {
      console.log(
        `  ${genre.padEnd(8, ' ')} ${run.name}:面板键 ${Object.keys(run.panels[0]!).join('/')} · ` +
          `遭遇 ${run.battles[0]!.enemy}(${run.battles[0]!.win ? '胜' : '败'}) · 装上 ${run.equipped}`
      )
      expect(run.name.length).toBeGreaterThan(0)
      expect(Object.keys(run.panels[0]!).length).toBeGreaterThan(0)
      expect(run.equipped).not.toBeNull()
    }
    // 三份预设:**机器键相同、展示名各不同**(攻击 / 火力 / 专注力)—— 这是库里"换名字"的常态
    const presetNames = results.slice(0, 3).map(r => r.attackName)
    expect(new Set(presetNames).size).toBe(3)
    for (const r of results.slice(0, 3)) expect(Object.keys(r.run.panels[0]!).join(',')).toBe('attack,defense,maxHp')
    // 第四份:**连机器键都换了**,靠 combat.keys 指路 —— 这条链不为它改一行代码
    expect(Object.keys(results[3]!.run.panels[0]!).join(',')).toBe('power,guard,vitality,speed')
    console.log(`  展示名:${presetNames.join(' / ')};第四份的键:${Object.keys(results[3]!.run.panels[0]!).join('/')}`)
  })

  it('面板单调:境界往上走,每一个本值都不许变小', () => {
    for (const { config } of GENRES) {
      const run = runGenre(config, '单调')
      for (let i = 1; i < run.panels.length; i += 1) {
        for (const key of Object.keys(run.panels[i - 1]!)) {
          expect(run.panels[i]![key]!).toBeGreaterThanOrEqual(run.panels[i - 1]![key]!)
        }
      }
    }
  })

  it('账目守恒:账本增量 == 回执合计(三份包都一样)', () => {
    for (const { config } of GENRES) {
      const run = runGenre(config, '守恒')
      for (const [key, amount] of Object.entries(run.receipt)) {
        expect(run.wallet[key]).toBe(amount)
      }
      expect(run.wallet.coin!).toBeGreaterThanOrEqual(0)
      expect(run.wallet.exp!).toBeGreaterThanOrEqual(0)
    }
  })

  it('存档往返:编码再解码之后状态逐字段相同(存档也不挑题材)', () => {
    for (const { config } of GENRES) {
      const run = runGenre(config, '存档')
      const format = defineSaveFormat<RunResult>({
        currentVersion: 3,
        migrations: {
          1: data => data, // 老档形状没变
          2: data => data
        },
        revive: data => data as RunResult
      })
      const text = encodeSave(run, format, 1_700_000_000_000)
      const back = decodeSave<RunResult>(text, format)
      expect(back.ok).toBe(true)
      if (!back.ok) continue
      expect(back.state).toEqual(run)
      expect(back.migrated).toBe(false)
      // 老档(版本 1)也该一路迁上来
      const old = JSON.stringify({ version: 1, savedAt: 0, data: run })
      const migrated = decodeSave<RunResult>(old, format)
      expect(migrated.ok).toBe(true)
      if (migrated.ok) {
        expect(migrated.migrated).toBe(true)
        expect(migrated.state).toEqual(run)
      }
    }
  })

  it('同种子可复现:再跑一遍逐字段一致;换种子时"遇到谁 / 掉了什么"才会变', () => {
    for (const { config } of GENRES) {
      const a = runGenre(config, '可复现')
      const b = runGenre(config, '可复现')
      expect(b).toEqual(a)
      // 换种子:"遇到谁 / 掉了什么"应当真的变 —— 否则说明随机源根本没接上
      const draws = new Set(
        ['种子-1', '种子-2', '种子-3', '种子-4', '种子-5', '种子-6'].map(seed => {
          const run = runGenre(config, seed)
          return `${run.battles[0]!.enemy}|${run.equipped}`
        })
      )
      expect(draws.size).toBeGreaterThan(1)
    }
    const across = GENRES.map(({ config }) => runGenre(config, '种子-1').battles[0]!.enemy)
    console.log(`  同一颗种子、三份内容包各自遇到的第一个人:${across.join(' · ')}`)
  })
})
