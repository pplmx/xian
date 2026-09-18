/* eslint-disable no-console */
/**
 * 消融实验 —— 默认伤害公式的刻度:攻防比怎么换成"几回合打完"。
 *
 * `combat.spec.ts` 钉的是语义(护盾、反击、追击、三处主权、逐位对账);这一份量的是**默认公式的手感**
 * —— 内容作者在"攻防血三个数摆多少"之前,需要知道这套除算公式给出的节奏:
 *
 *   ① **每击伤害 ≈ 攻² /(攻 + 防)**:面对 100 防,攻 50 / 100 / 200 各打 16.67 / 50 / 133.33
 *      —— **攻击翻倍时伤害涨到 2.67 倍**(不是两倍),除算型公式对攻击更敏感;
 *   ② **回合数由"每击占比"决定**:打一个 1000 血的靶子,攻=防时 20 回合、攻翻倍 8 回合、
 *      攻四倍只要 4 回合 —— 这就是"堆一波攻能把副本从拉锯变成速通"的原因;
 *   ③ **有地板**:`minDamageRatio` 默认 5%,所以"攻击远低于防御"也打得出伤害
 *      (实测攻 10 / 防 10000 时每击仍是 0.5),不会出现"永远打不动"的死局。
 */
import { describe, expect, it } from 'vitest'
import { createRng } from './rng.js'
import type { Combatant } from './combat.js'
import { createCombatEngine } from './combat.js'

const engine = createCombatEngine({ variance: 0, critMultiplier: 1 }) // 关掉浮动与暴击,先把公式看清楚

const fighter = (id: string, attack: number, defense: number, maxHp: number): Combatant<number> => ({
  id,
  name: id,
  stats: { hp: maxHp, maxHp, attack, defense, speed: 1 },
  mods: {}
})

/** 打一场,返回回合数与胜者 */
const duel = (me: Combatant<number>, foe: Combatant<number>, seed = 1) =>
  engine.resolve(me, foe, createRng(seed))

describe('消融实验 —— 默认伤害公式的刻度', () => {
  it('每击伤害 ≈ 攻² /(攻+防):攻击翻倍时伤害涨到三倍多', () => {
    const rows = [50, 100, 200].map(attack => {
      // 挨打方:防 100、血厚到打不死,攻击 0(不会还手)—— 这样量到的是"攻 → 每击伤害"的纯曲线
      const battle = duel(fighter('me', attack, 100, 100_000), fighter('foe', 0, 100, 100_000))
      const dealt = 100_000 - battle.enemyHp
      return { attack, hit: dealt / battle.rounds }
    })
    for (const row of rows) {
      console.log(`  攻击 ${row.attack} / 防 100:每回合打掉 ${row.hit.toFixed(2)}`)
    }

    // ① 除算公式:攻=防时每击 = 攻/2 = 50;攻翻倍(200)时 = 200²/300 = 133.33(≈2.67 倍)
    expect(rows[0]!.hit).toBeCloseTo((50 * 50) / (50 + 100), 1)
    expect(rows[1]!.hit).toBeCloseTo((100 * 100) / (100 + 100), 1)
    expect(rows[2]!.hit).toBeCloseTo((200 * 200) / (200 + 100), 1)
    expect(rows[2]!.hit / rows[1]!.hit).toBeGreaterThan(2.5)
    // 防空转:三档攻击确实给出了三个不同的伤害
    expect(new Set(rows.map(r => r.hit.toFixed(2))).size).toBe(3)
  })

  it('回合数由"每击占比"决定:攻防相当拉锯,攻击压制速通', () => {
    const cases = [
      { label: '攻=防(100 打 100)', attack: 100, defense: 100 },
      { label: '攻·1.5(150 打 100)', attack: 150, defense: 100 },
      { label: '攻·2(200 打 100)', attack: 200, defense: 100 },
      { label: '攻·4(400 打 100)', attack: 400, defense: 100 }
    ]
    const rows = cases.map(c => {
      // 打一个固定的靶子:防 100、血 1000;自己血厚到不会被反打打死 —— 只量"几回合能打穿"
      const battle = duel(fighter('me', c.attack, 100, 100_000), fighter('foe', 0, c.defense, 1000))
      return { ...c, rounds: battle.rounds }
    })
    for (const row of rows) console.log(`  ${row.label}(靶子 1000 血):${row.rounds} 回合打穿`)

    // ② 攻=防时每击 50 → 20 回合;攻翻倍每击 133 → 8 回合;攻四倍每击 320 → 4 回合
    expect(rows[0]!.rounds).toBe(20)
    expect(rows[2]!.rounds).toBe(8)
    expect(rows[3]!.rounds).toBe(4)
    expect(rows[2]!.rounds).toBeLessThan(rows[0]!.rounds)
    expect(rows[2]!.rounds).toBeLessThan(10)
    // 防空转:四档确实给出了不同的节奏
    expect(new Set(rows.map(r => r.rounds)).size).toBeGreaterThan(2)
  })

  it('地板是"攻击的 5%":攻击远低于防御也打得出伤害', () => {
    const weak = fighter('me', 10, 0, 100_000)
    const wall = fighter('foe', 0, 10_000, 100_000)
    const battle = duel(weak, wall)
    const hit = (100_000 - battle.enemyHp) / battle.rounds
    console.log(`  攻 10 / 防 10000:公式值 ${((10 * 10) / (10 + 10_000)).toFixed(4)} → 实际每击 ${hit.toFixed(3)}(地板 = 攻击 × 5%)`)

    // ③ 除算结果小到几乎为 0,但地板把它抬到 攻击 × 5% = 0.5
    expect(hit).toBeCloseTo(10 * 0.05, 3)
    expect(hit).toBeGreaterThan((10 * 10) / (10 + 10_000))
    // 防空转:把地板调成 0 就真的"打不动"(证明那条地板在起作用)
    const noFloor = createCombatEngine({ variance: 0, critMultiplier: 1, minDamageRatio: 0 })
    const withoutFloor = noFloor.resolve(fighter('me', 10, 0, 100_000), fighter('foe', 0, 10_000, 100_000), createRng(1))
    const hitNoFloor = (100_000 - withoutFloor.enemyHp) / withoutFloor.rounds
    expect(hitNoFloor).toBeLessThan(hit)
  })

  it('回合上限是"守方胜":两边都打不穿时不会无限打', () => {
    const capped = createCombatEngine({ variance: 0, critMultiplier: 1, maxRounds: 10, minDamageRatio: 0 })
    const battle = capped.resolve(fighter('me', 10, 0, 100_000), fighter('foe', 0, 10_000, 100_000), createRng(1))
    console.log(`  上限 10 回合、双方都打不穿:实际 ${battle.rounds} 回合,胜负 = ${battle.win ? '玩家胜' : '玩家未胜'}`)

    // 打到上限就停,并且算"没赢"(守方胜)—— 不会无限循环
    expect(battle.rounds).toBe(10)
    expect(battle.win).toBe(false)
    // 防空转:放开上限就继续打(证明上面停住是因为上限)
    const open = createCombatEngine({ variance: 0, critMultiplier: 1, maxRounds: 40, minDamageRatio: 0 })
    const longer = open.resolve(fighter('me', 10, 0, 100_000), fighter('foe', 0, 10_000, 100_000), createRng(1))
    expect(longer.rounds).toBeGreaterThan(10)
  })
})
