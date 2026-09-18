/* eslint-disable no-console -- 示例程序就是要打印给人看 */
/**
 * 最小可玩示例 —— 「星港纪元」:换一套名字,跑完整一圈。
 *
 * 运行:`bun packages/engine/examples/minimal.ts`
 *
 * 这份示例刻意只做四件事:装配世界、修炼进阶、掉装装配、打副本通关。
 * 它不依赖 Vue/Pinia,也不需要任何界面 —— 引擎是纯逻辑层,
 * 界面、存档、离线结算都由使用方自己决定。
 */
import { createRng, defineGame, emptyProgress, planIdle, runIdle } from '../src/index'
import { DEMO } from '../src/presets/demo'

const game = defineGame(DEMO)
const rng = createRng('星港-示例')

console.log(`【${game.name}】`)
console.log('世界:', game.realms.worlds.map(w => w.name).join(' / '))
console.log('境界:', game.realms.realms.map(r => r.name).join(' → '))
console.log('属性名(示例):', ['attack', 'defense', 'maxHp', 'critRate'].map(k => `${k}=${game.attributes.name(k)}`).join('、'))
console.log('装备槽:', game.equipment.slots.map(s => s.name).join('、'))
console.log('品质:', game.equipment.qualities.map(q => q.name).join(' '))
console.log('----')

// 1. 修炼与进阶
let state = { major: 0, layer: 0, exp: 0 }
for (let step = 0; step < 6; step += 1) {
  const cost = Number(game.realms.expCost(state.major, state.layer))
  state = game.realms.addExp(state, cost)
  let result = game.realms.attemptBreakthrough(state, { rng, bonusRate: 0.1 })
  for (let i = 0; i < 20 && !result.ok && result.reason === 'failed'; i += 1) {
    result = game.realms.attemptBreakthrough(state, { rng, bonusRate: 0.1 })
  }
  if (!result.ok) {
    console.log(`进阶失败(${result.reason}),停在 ${game.realms.label(state.major, state.layer)}`)
    break
  }
  state = result.state
  console.log(`进阶 → ${result.to}(成功率 ${(result.rate * 100).toFixed(1)}%)`)
}

// 2. 掉装与装配
const inventory = new Map<string, ReturnType<typeof game.equipment.generate>>()
let loadout = { equipped: {} as Record<string, string | undefined> }
for (let i = 0; i < 6; i += 1) {
  const item = game.equipment.generate(rng, { tier: Math.max(1, state.major + 1), luck: 0.2 })
  inventory.set(item.uid, item)
  loadout = game.equipment.equip(loadout, item)
  const resolved = game.equipment.resolve(item)
  console.log(`掉落:${resolved.quality.name} ${resolved.template?.name} ${resolved.affixLines.map(l => l.name).join('/') || '(无词条)'}`)
}
const equipped = game.equipment.resolveLoadout(loadout, inventory)

// 3. 打副本:一路推到通关
const base = game.realms.baseStats(state.major, state.layer)
const stats = game.attributes.compute({ base, flat: equipped.flats, modSources: [equipped.mods] })
let progress = emptyProgress()
let region = game.dungeons.firstRegion()
console.log('----')
console.log(`战力结算:${game.attributes.describe(stats.mods).join(' ') || '(无词条)'}`)
for (let run = 0; run < 40 && progress.cleared.length < game.dungeons.regions.length; run += 1) {
  const encounter = game.dungeons.nextEncounter(region.id, progress, rng)
  const enemy = game.dungeons.snapshot(encounter.enemyId)
  const battle = game.combat.resolve(
    {
      id: 'player',
      name: '玩家',
      hp: stats.final.maxHp ?? 0,
      maxHp: stats.final.maxHp ?? 0,
      attack: stats.final.attack ?? 0,
      defense: stats.final.defense ?? 0,
      speed: 1,
      mods: stats.mods
    },
    { id: enemy.id, name: enemy.name, hp: enemy.hp, maxHp: enemy.hp, attack: enemy.attack, defense: enemy.defense, speed: enemy.speed, mods: enemy.mods, skills: enemy.skills },
    rng
  )
  if (!battle.win) {
    console.log(`\u2717 ${region.name} 的 ${enemy.name} 打不过(${battle.rounds} 回合),先回去修炼`)
    break
  }
  const outcome = game.dungeons.onVictory(region.id, encounter, progress, rng)
  progress = outcome.progress
  const lootText = outcome.rewards.map(r => `${r.name ?? r.id}×${Number(r.amount).toFixed(0)}`).join('、')
  console.log(`\u2713 ${region.name} · ${encounter.kind === 'boss' ? '首领' : '遭遇'} ${enemy.name}(${battle.rounds} 回合)${lootText ? ` → ${lootText}` : ''}`)
  if (outcome.firstClear) {
    console.log(`  ※ ${region.name} 已通关`)
    const next = game.dungeons.chain().find(r => r.requireCleared === region.id && game.dungeons.isUnlocked(r.id, progress, state.major))
    if (next) region = next
  }
}

console.log('----')
console.log(`已通关:${progress.cleared.map(id => game.dungeons.region(id)?.name).join('、') || '(无)'}`)

// 4. 离线推进:回来之后该补多少 —— 时长账由库算,每一步产出什么由游戏自己定
const idle = planIdle(8 * 3600_000, { stepMs: 10 * 60_000, capMs: 6 * 3600_000, efficiency: 0.9 })
const banked = runIdle(idle, 0, (total, _i, stepMs) => total + stepMs)
console.log('----')
console.log(
    `离线 8 小时(上限 6 小时、效率 0.9):计入 ${(idle.cappedMs / 3600_000).toFixed(1)}h · ` +
    `有效 ${(idle.effectiveMs / 3600_000).toFixed(1)}h · ${idle.steps} 步 · ` +
    `超出未计 ${(idle.overflowMs / 3600_000).toFixed(1)}h · 不足一步的余量 ${Math.round(idle.remainderMs / 60_000)} 分`
)
console.log(`逐步累积(示例:每步 10 分钟)= ${(banked / 3600_000).toFixed(2)}h`)
