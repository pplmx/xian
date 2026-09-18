import { describe, expect, it } from 'vitest'
import { createCombatEngine } from './combat.js'
import { createRng } from './rng.js'

function fighter(overrides: Record<string, unknown> = {}) {
  // 本值收进一张表:键名是引擎的接口词,换题材时用 BattleConfig.keys 指过去
  const { hp, maxHp, attack, defense, speed, ...rest } = overrides as Record<string, number | undefined> & Record<string, unknown>
  return {
    id: 'p',
    name: '甲',
    stats: { hp: hp ?? 100, maxHp: maxHp ?? 100, attack: attack ?? 20, defense: defense ?? 5, speed: speed ?? 1 },
    mods: {},
    ...rest
  }
}

describe('战斗解算 —— 副本遭遇要分得出胜负', () => {
  it('同一种子同一场(可复现)', () => {
    const engine = createCombatEngine()
    const a = engine.resolve(fighter(), fighter({ id: 'e', name: '乙' }), createRng(5))
    const b = engine.resolve(fighter(), fighter({ id: 'e', name: '乙' }), createRng(5))
    expect(a).toEqual(b)
  })

  it('强者胜:数值碾压时必胜,且回合数不超上限', () => {
    const engine = createCombatEngine({ maxRounds: 20 })
    const result = engine.resolve(
      fighter({ attack: 500, hp: 9999, maxHp: 9999 }),
      fighter({ id: 'e', name: '乙', attack: 1, hp: 30, maxHp: 30, defense: 0 }),
      createRng(1)
    )
    expect(result.win).toBe(true)
    expect(result.rounds).toBeLessThanOrEqual(20)
    expect(Number(result.enemyHp)).toBeLessThanOrEqual(0)
  })

  it('打不完算守方胜(回合上限)', () => {
    const engine = createCombatEngine({ maxRounds: 3, minDamageRatio: 0 })
    const result = engine.resolve(
      fighter({ attack: 1, hp: 1000, maxHp: 1000 }),
      fighter({ id: 'e', name: '乙', attack: 1, hp: 1000, maxHp: 1000, defense: 0 }),
      createRng(2)
    )
    expect(result.win).toBe(false)
    expect(result.rounds).toBe(3)
  })

  it('闪避率把命中率压下去,事件里记成落空', () => {
    const engine = createCombatEngine({ variance: 0 })
    const result = engine.resolve(
      fighter(),
      fighter({ id: 'e', name: '乙', mods: { dodgeRate: 0.9 }, hp: 100, maxHp: 100 }),
      createRng(3)
    )
    expect(result.events.some(e => e.kind === 'dodge')).toBe(true)
  })

  it('暴击倍率与减伤都参与结算', () => {
    const engine = createCombatEngine({ variance: 0 })
    const plain = engine.resolve(
      fighter({ mods: {} }),
      fighter({ id: 'e', name: '乙', hp: 500, maxHp: 500, defense: 0 }),
      createRng(4)
    )
    const tanky = engine.resolve(
      fighter({ mods: {} }),
      fighter({ id: 'e', name: '乙', hp: 500, maxHp: 500, defense: 0, mods: { damageReduction: 0.5 } }),
      createRng(4)
    )
    const damageOf = (r: ReturnType<typeof engine.resolve>): number =>
      r.events.filter(e => e.kind === 'hit' || e.kind === 'crit').reduce((a, e) => a + e.damage, 0)
    expect(damageOf(tanky)).toBeLessThan(damageOf(plain))
  })

  it('吸血与回合回复都能把血量拉回来', () => {
    const engine = createCombatEngine()
    const result = engine.resolve(
      fighter({ attack: 200, hp: 50, maxHp: 500, mods: { lifesteal: 0.5 } }),
      fighter({ id: 'e', name: '乙', hp: 60, maxHp: 60, defense: 0 }),
      createRng(6)
    )
    expect(result.win).toBe(true)
    expect(result.events.some(e => e.kind === 'lifesteal')).toBe(true)
    expect(Number(result.playerHp)).toBeGreaterThan(50)
  })

  it('本值键名由作品定:叫火力/装甲/结构值/迅捷,战斗逻辑一行不用改', () => {
    const engine = createCombatEngine({
      keys: { attack: 'power', defense: 'armor', hp: 'hull', maxHp: 'hullMax', speed: 'agility' }
    })
    const me = {
      id: 'me',
      name: '舰',
      stats: { power: 200, armor: 4, hull: 300, hullMax: 300, agility: 2 },
      mods: {}
    }
    const foe = {
      id: 'foe',
      name: '靶',
      stats: { power: 10, armor: 0, hull: 40, hullMax: 40, agility: 1 },
      mods: {}
    }
    const result = engine.resolve(me, foe, createRng(9))
    expect(result.win).toBe(true)
    expect(Number(result.enemyHp)).toBeLessThanOrEqual(0)
    expect(Number(result.playerHp)).toBeLessThanOrEqual(300)
    // 传进去的对象不被就地改动(内部拷一份再打)
    expect(me.stats.hull).toBe(300)
    expect(foe.stats.hull).toBe(40)
  })

  it('伤害公式可自己接管:减法型、除算型、查表型都行(地板也归调用方)', () => {
    // 减法型:攻 − 防,至少 1
    const subtractive = createCombatEngine({
      variance: 0,
      damageFn: ctx => Math.max(1, ctx.attack * ctx.mult - ctx.defense)
    })
    const me = { id: 'me', name: '甲', stats: { attack: 50, defense: 5, hp: 100, maxHp: 100, speed: 2 }, mods: {} }
    const foe = { id: 'foe', name: '乙', stats: { attack: 5, defense: 20, hp: 90, maxHp: 90, speed: 1 }, mods: {} }
    const battle = subtractive.resolve(me, foe, createRng(1))
    expect(battle.win).toBe(true)
    // 每击 50−20=30,90 血正好三击;同一种子可复现
    const again = subtractive.resolve(me, foe, createRng(1))
    expect(again.events).toEqual(battle.events)
    // 只数我方出手:90 血 / 每击 30 = 三击(对方那几下不计)
    expect(battle.events.filter(e => e.actor === '甲' && (e.kind === 'hit' || e.kind === 'crit')).length).toBe(3)

    // 自定义公式里也能读到默认会给的那几样(浮动/增伤/减伤)
    const seen: number[] = []
    const probe = createCombatEngine({
      damageFn: ctx => {
        seen.push(ctx.damageBonus, ctx.damageReduction, ctx.variance)
        return 1
      }
    })
    probe.resolve(
      { id: 'a', name: '甲', stats: { attack: 10, defense: 0, hp: 100, maxHp: 100, speed: 1 }, mods: { damageBonus: 0.5 } },
      { id: 'b', name: '乙', stats: { attack: 1, defense: 0, hp: 100, maxHp: 100, speed: 1 }, mods: { damageReduction: 0.25 } },
      createRng(2)
    )
    expect(seen[0]).toBeCloseTo(0.5, 10)
    expect(seen[1]).toBeCloseTo(0.25, 10)
    expect(seen[2]).toBeCloseTo(0.08, 10)
  })

  it('技能效果解释器不配(或返回空)时:出手规则与原来逐位一致', () => {
    const foe = () =>
      fighter({ id: 'e', name: '乙', attack: 8, defense: 0, hp: 120, maxHp: 120, skills: [{ name: '扑击', mult: 1.5, rate: 1, effect: 'stun' }] })
    const base = createCombatEngine({ variance: 0 })
    const withFn = createCombatEngine({ variance: 0, skillEffectFn: () => undefined })
    const a = base.resolve(fighter({ attack: 30 }), foe(), createRng(7))
    const b = withFn.resolve(fighter({ attack: 30 }), foe(), createRng(7))
    expect(b.events).toEqual(a.events)
    // 钩子只在配了的时候才被调用
    let called = 0
    createCombatEngine({
      variance: 0,
      skillEffectFn: () => {
        called += 1
      }
    }).resolve(fighter({ attack: 30 }), foe(), createRng(7))
    expect(called).toBeGreaterThan(0)
  })

  it('选技能的主权:按序掷、第一个命中即用(默认是"全掷一遍再抽一个")', () => {
    const foe = () =>
      fighter({
        id: 'e',
        name: '乙',
        attack: 8,
        defense: 0,
        hp: 200,
        maxHp: 200,
        skills: [
          { name: '探路', mult: 0, rate: 0 },
          { name: '扑击', mult: 1.5, rate: 1 }
        ]
      })
    // 本作式:按序掷,第一个命中就用它 —— 第二个技能那一颗骰子根本不用掷
    const sequential = createCombatEngine({
      variance: 0,
      skillFn: (ctx, rng) => {
        for (const s of ctx.skills) if (rng.chance(s.rate)) return s
        return null
      }
    })
    const out = sequential.resolve(fighter({ attack: 30 }), foe(), createRng(7))
    expect(out.events.some(e => e.text.includes('扑击'))).toBe(true)
    expect(out.events.some(e => e.text.includes('探路'))).toBe(false)
    // 随机消耗与默认那套不同 —— 这正是"调参数对齐不了、必须整段接管"的原因
    const counted = () => {
      const base = createRng(7)
      let draws = 0
      return {
        rng: {
          ...base,
          chance: (p: number) => (draws += 1, base.chance(p)),
          pick: <U>(arr: readonly U[]): U => (draws += 1, base.pick(arr))
        },
        draws: () => draws
      }
    }
    const withDefault = counted()
    createCombatEngine({ variance: 0 }).resolve(fighter({ attack: 30 }), foe(), withDefault.rng)
    const withSequential = counted()
    sequential.resolve(fighter({ attack: 30 }), foe(), withSequential.rng)
    // 默认每回合"每个技能各掷一颗 + 抽一个",按序掷只掷到命中为止 —— 总消耗必然不同
    expect(withSequential.draws()).toBeLessThan(withDefault.draws())
  })

  it('选技能返回 null:这一回合不出技能(普通出手),而不是"交回默认"', () => {
    const foe = () =>
      fighter({
        id: 'e',
        name: '乙',
        attack: 8,
        defense: 0,
        hp: 120,
        maxHp: 120,
        skills: [{ name: '扑击', mult: 1.5, rate: 1 }]
      })
    const noSkill = createCombatEngine({ variance: 0, skillFn: () => null })
    const out = noSkill.resolve(fighter({ attack: 30 }), foe(), createRng(3))
    expect(out.events.some(e => e.kind === 'skill')).toBe(false)
    expect(out.events.some(e => e.kind === 'hit' || e.kind === 'crit')).toBe(true)
  })

  it('选技能不返回时交回默认:与不配这个钩子逐位一致', () => {
    const foe = () =>
      fighter({ id: 'e', name: '乙', attack: 8, defense: 0, hp: 120, maxHp: 120, skills: [{ name: '扑击', mult: 1.5, rate: 0.5 }] })
    const base = createCombatEngine({ variance: 0 }).resolve(fighter({ attack: 30 }), foe(), createRng(11))
    const withFn = createCombatEngine({ variance: 0, skillFn: () => undefined }).resolve(fighter({ attack: 30 }), foe(), createRng(11))
    expect(withFn.events).toEqual(base.events)
    expect(withFn.win).toBe(base.win)
  })

  it('整次出手的主权:自己掷、自己扣(返回值就是自己落账的那一份)', () => {
    const seen: string[] = []
    const custom = createCombatEngine({
      variance: 0,
      strikeFn: (ctx, rng) => {
        seen.push(`${ctx.opts.kind ?? 'hit'}:${ctx.opts.skill?.name ?? '普攻'}`)
        // 固定真伤:不看攻防、不看浮动,自己掷一次决定是否暴击
        const crit = rng.chance(0.25)
        const dealt = ctx.applyDamage(ctx.defender, crit ? 40 : 20, { bypassShield: true })
        ctx.log(crit ? 'crit' : 'hit', `${ctx.attacker.name} 一记真伤,造成 ${dealt}`, dealt)
        return true
      }
    })
    const out = custom.resolve(
      fighter({ attack: 30 }),
      fighter({ id: 'e', name: '乙', attack: 8, defense: 0, hp: 100, maxHp: 100 }),
      createRng(5)
    )
    expect(seen.length).toBeGreaterThan(0)
    expect(out.events.every(e => e.damage === 0 || e.damage === 20 || e.damage === 40)).toBe(true)
    expect(out.events.some(e => e.text.includes('真伤'))).toBe(true)
  })

  it('整次出手不返回时交回默认:与不配这个钩子逐位一致', () => {
    const foe = () => fighter({ id: 'e', name: '乙', attack: 8, defense: 0, hp: 120, maxHp: 120 })
    const base = createCombatEngine({ variance: 0 }).resolve(fighter({ attack: 30 }), foe(), createRng(13))
    const withFn = createCombatEngine({ variance: 0, strikeFn: () => undefined }).resolve(fighter({ attack: 30 }), foe(), createRng(13))
    expect(withFn.events).toEqual(base.events)
    expect(withFn.win).toBe(base.win)
  })

  it('技能效果可基于默认改:多打几下、伤害翻倍,并且本场有个跨回合的抽屉', () => {
    // 玩家的技能:第一次按默认打,之后每次都翻倍(用 state 记"这是第几次")
    const engine = createCombatEngine({
      variance: 0,
      skillEffectFn: ctx => {
        const times = (ctx.state.times as number | undefined) ?? 0
        ctx.state.times = times + 1
        ctx.strike(times === 0 ? undefined : ctx.mult * 2)
        return true
      }
    })
    const me = fighter({ attack: 30, hp: 500, maxHp: 500, skills: [{ name: '连击', mult: 1, rate: 1 }] })
    const foe = fighter({ id: 'e', name: '乙', attack: 1, defense: 0, hp: 400, maxHp: 400, speed: 0 })
    const battle = engine.resolve(me, foe, createRng(11))
    const hits = battle.events.filter(e => e.kind === 'skill').map(e => e.damage)
    // 攻 30 / 防 0 → 默认每击 30;第一次 30,第二次 60,第三次 60……
    expect(hits[0]).toBeCloseTo(30, 6)
    expect(hits[1]).toBeCloseTo(60, 6)
    expect(battle.win).toBe(true)
  })

  it('技能效果可以完全另起一套:定身(跳过出手)+ 固定真伤,引擎不再补打一下', () => {
    const engine = createCombatEngine({
      variance: 0,
      skillEffectFn: ctx => {
        if (ctx.skill.effect !== 'stun') return
        ctx.skipNextTurn(ctx.defender)
        ctx.applyDamage(ctx.defender, 25)
        ctx.log('skill', `${ctx.attacker.name} 定住了 ${ctx.defender.name}`)
        return true
      }
    })
    const me = fighter({ attack: 30, hp: 500, maxHp: 500, skills: [{ name: '定身术', mult: 1, rate: 1, effect: 'stun' }] })
    const foe = fighter({ id: 'e', name: '乙', attack: 1, defense: 0, hp: 500, maxHp: 500, speed: 0 })
    const battle = engine.resolve(me, foe, createRng(3))
    const first = battle.events[0]!
    // 真伤是 25,不是默认公式那 30 —— 说明这一次出手完全由调用方说了算
    expect(first.damage).toBe(25)
    expect(first.text).toContain('命中')
    // 挨打方的下一次出手被跳过(记成 skip,而不是"命中")
    expect(battle.events.some(e => e.kind === 'skip' && e.actor === '乙')).toBe(true)
    // 每回合正好一条出手事件:定身那张没被"引擎再按默认补打一下"
    const firstRound = battle.events.filter(e => e.round === 1)
    expect(firstRound.filter(e => e.damage > 0).length).toBe(1)
    expect(battle.win).toBe(true)
  })

  it('护盾池:开局按词条凝盾、先于生命挨打、总量被上限夹住', () => {
    const engine = createCombatEngine({ variance: 0, shield: { capRatio: 0.5 } })
    const mk = (startPct: number) =>
      engine.resolve(
        fighter({ attack: 30, defense: 0, hp: 200, maxHp: 200, speed: 2, mods: { shieldOnStart: startPct } }),
        fighter({ id: 'e', name: '乙', attack: 10, defense: 0, hp: 500, maxHp: 500, speed: 1 }),
        createRng(21)
      )

    // 开局盾 = 最大生命 × 25% = 50;敌方每击 10,先被盾吃掉 → 生命不掉
    const mild = mk(0.25)
    expect(mild.events[0]!.kind).toBe('shield')
    expect(mild.events[0]!.text).toContain('吸收 50')
    const firstEnemyHit = mild.events.find(e => e.actor === '乙' && e.kind === 'hit')!
    expect(firstEnemyHit.damage).toBe(0)
    expect(firstEnemyHit.text).toContain('护盾挡下 10')

    // 上限 50%:写 500% 也只凝 100
    expect(mk(5).events[0]!.text).toContain('吸收 100')

    // 没配 shield 就没有护盾这回事(默认不变)
    const plain = createCombatEngine({ variance: 0 }).resolve(
      fighter({ attack: 30, defense: 0, hp: 200, maxHp: 200, speed: 2, mods: { shieldOnStart: 5 } }),
      fighter({ id: 'e', name: '乙', attack: 10, defense: 0, hp: 500, maxHp: 500, speed: 1 }),
      createRng(21)
    )
    expect(plain.events.some(e => e.kind === 'shield')).toBe(false)
    expect(plain.playerShield).toBe(0)
    expect(plain.events.find(e => e.actor === '乙' && e.kind === 'hit')!.damage).toBe(10)
  })

  it('溢疗成盾:补不满的那部分按词条转成护盾', () => {
    const engine = createCombatEngine({ variance: 0, shield: {}, regenBase: 0.1 })
    const battle = engine.resolve(
      fighter({ attack: 30, hp: 500, maxHp: 500, speed: 2, mods: { overhealShield: 0.5 } }),
      fighter({ id: 'e', name: '乙', attack: 1, defense: 0, hp: 500, maxHp: 500, speed: 1 }),
      createRng(3)
    )
    // 满血时每回合"回"10% = 50,全溢出 → 转 25 点护盾
    const shieldEvents = battle.events.filter(e => e.kind === 'shield')
    expect(shieldEvents.length).toBeGreaterThan(0)
    expect(shieldEvents[0]!.text).toContain('吸收 25')
    expect(battle.playerShield).toBeGreaterThan(0)
  })

  it('反击:打一记回去,且这一记不再引发反击(否则会链到天上)', () => {
    const engine = createCombatEngine({ variance: 0, followups: {} })
    const battle = engine.resolve(
      fighter({ attack: 30, defense: 0, hp: 500, maxHp: 500, speed: 2, mods: { counterRate: 1 } }),
      fighter({ id: 'e', name: '乙', attack: 10, defense: 0, hp: 500, maxHp: 500, speed: 1, mods: { counterRate: 1 } }),
      createRng(7)
    )
    // 第一回合:双方各挨一次打 → 各反击一次;反击本身不再被反(否则会链到天上)
    const round1 = battle.events.filter(e => e.round === 1 && e.kind === 'counter')
    expect(round1.length).toBe(2)
    expect(round1[0]!.actor).toBe('乙')
    // 反击倍率 0.5:乙攻 10 → 5
    expect(round1[0]!.damage).toBeCloseTo(5, 6)
    // 整场里也没有"反击接反击"的链
    for (let i = 1; i < battle.events.length; i += 1) {
      if (battle.events[i]!.kind === 'counter') expect(battle.events[i - 1]!.kind).not.toBe('counter')
    }

    // 不配 followups:一次反击也没有(默认不变)
    const plain = createCombatEngine({ variance: 0 }).resolve(
      fighter({ attack: 30, hp: 500, maxHp: 500 }),
      fighter({ id: 'e', name: '乙', attack: 10, defense: 0, hp: 500, maxHp: 500, mods: { counterRate: 1 } }),
      createRng(7)
    )
    expect(plain.events.some(e => e.kind === 'counter')).toBe(false)
  })

  it('追击:概率触发一记打折出手,同样不再引发反击', () => {
    const engine = createCombatEngine({ variance: 0, followups: {} })
    const battle = engine.resolve(
      fighter({ attack: 30, hp: 500, maxHp: 500, speed: 2, mods: { comboRate: 1, comboDamage: 0 } }),
      fighter({ id: 'e', name: '乙', attack: 10, defense: 0, hp: 500, maxHp: 500, speed: 1, mods: { counterRate: 1 } }),
      createRng(11)
    )
    const combo = battle.events.find(e => e.kind === 'combo')!
    expect(combo.actor).toBe('甲')
    expect(combo.damage).toBeCloseTo(18, 6) // 30 × 0.6
    // 追击打完之后,没有"乙反击追击"这一出:追击本身不吃反击
    const afterCombo = battle.events[battle.events.indexOf(combo) + 1]!
    expect(afterCombo.kind).not.toBe('counter')
  })

  it('穿甲标签只在你开了"标签解释"之后才算数', () => {
    const mk = (skillEffects?: { pierceTags?: readonly string[] } | true) =>
      createCombatEngine({ variance: 0, shield: {}, ...(skillEffects === undefined ? {} : { skillEffects }) }).resolve(
        fighter({
          attack: 30,
          hp: 300,
          maxHp: 300,
          speed: 2,
          mods: { shieldOnStart: 0.5 },
          skills: [{ name: '破甲斩', mult: 1, rate: 1, effect: 'pierce' }]
        }),
        fighter({ id: 'e', name: '乙', attack: 1, defense: 0, hp: 300, maxHp: 300, speed: 1, mods: { shieldOnStart: 0.5 } }),
        createRng(5)
      )
    // 没开标签解释:pierce 只是标签,照旧被护盾吃掉
    expect(mk().events.find(e => e.kind === 'skill' && e.actor === '甲')!.damage).toBe(0)
    // 开了:`bypassShield` 生效,伤害落在生命上
    expect(mk({}).events.find(e => e.kind === 'skill' && e.actor === '甲')!.damage).toBeGreaterThan(0)
  })

  it('技能标签的默认解释:多段 / 震慑 / 吸取 / 加盾 / 放血', () => {
    const run = (effect: string) =>
      createCombatEngine({ variance: 0, shield: {}, skillEffects: {} }).resolve(
        fighter({
          attack: 30,
          hp: 500,
          maxHp: 500,
          speed: 2,
          skills: [{ name: '试招', mult: 1, rate: 1, effect }]
        }),
        fighter({ id: 'e', name: '乙', attack: 1, defense: 0, hp: 500, maxHp: 500, speed: 1 }),
        createRng(9)
      )

    // multi:第一回合 = 主手一击 + 两段 45% 追打 = 三记技能事件
    expect(run('multi').events.filter(e => e.round === 1 && e.kind === 'skill' && e.actor === '甲').length).toBe(3)
    // stun:震慑到下一回合 —— 乙出现"没有出手"
    expect(run('stun').events.some(e => e.kind === 'skip' && e.actor === '乙')).toBe(true)
    // drain:吸取回血(开打之后总会被蹭掉血,于是这一路必然出得来)
    expect(run('drain').events.some(e => e.kind === 'lifesteal')).toBe(true)
    // shield:给自己加盾(开局那一次不算,看第 1 回合施放后加的)
    expect(run('shield').events.filter(e => e.kind === 'shield' && e.actor === '甲').length).toBeGreaterThan(0)
    // bleed:按攻击放血 —— 每次出手后额外掉 9 点
    const bleed = run('bleed').events.filter(e => e.kind === 'skill' && e.text.includes('血流不止'))
    expect(bleed.length).toBeGreaterThan(0)
    expect(bleed[0]!.damage).toBeCloseTo(9, 6)
  })

  it('护盾与反击都不配时,结算与从前逐位一致(只有多了两个恒为 0 的读数)', () => {
    const build11 = () =>
      createCombatEngine({ variance: 0 }).resolve(
        fighter({ attack: 25, hp: 300, maxHp: 300, mods: { critRate: 0.5 } }),
        fighter({ id: 'e', name: '乙', attack: 12, defense: 3, hp: 260, maxHp: 260, mods: { dodgeRate: 0.1, counterRate: 1 } }),
        createRng(13)
      )
    const now = build11()
    expect(now.playerShield).toBe(0)
    expect(now.enemyShield).toBe(0)
    expect(now.events.some(e => ['shield', 'counter', 'combo'].includes(e.kind))).toBe(false)
    // 同一份配置两次结果一致(结算仍是纯函数)
    expect(build11().events).toEqual(now.events)
  })

  it('回合钩子:每回合结束叫一次,拿得到原语与本场抽屉(流血 / 层数 / 阶段都落在这儿)', () => {
    const ticks: number[] = []
    const engine = createCombatEngine({
      variance: 0,
      maxRounds: 4,
      tickFn: (ctx, rng) => {
        ticks.push(ctx.round)
        // 第一回合末挂上"每回合掉 5 点"的流血,层数放在本场抽屉里
        const stacks = (ctx.state.bleed as number | undefined) ?? 0
        ctx.state.bleed = stacks + 1
        const lost = ctx.applyDamage(ctx.enemy, 5 * ((ctx.state.bleed as number) ?? 1))
        if (lost > 0) ctx.log('skill', `${ctx.enemy.name} 因流血又损 ${lost} 生命`, lost, ctx.player.name)
        expect(rng.float(0, 1)).toBeGreaterThanOrEqual(0) // 钩子里也能用随机源
        expect(typeof ctx.over()).toBe('boolean')
      }
    })
    const battle = engine.resolve(
      fighter({ attack: 0, hp: 500, maxHp: 500 }),
      fighter({ id: 'e', name: '乙', attack: 1, defense: 0, hp: 9999, maxHp: 9999 }),
      createRng(17)
    )
    expect(ticks).toEqual([1, 2, 3, 4])
    const bleedHits = battle.events.filter(e => e.text.includes('因流血'))
    expect(bleedHits.length).toBe(4)
    expect(bleedHits.map(e => e.damage)).toEqual([5, 10, 15, 20]) // 层数累加
    expect(Number(battle.enemyHp)).toBe(9999 - 50)
  })

  it('事件反应:能做出"会心即追加一记"的流派组合技,且钩子不会自己喂自己', () => {
    let triggered = 0
    const engine = createCombatEngine({
      variance: 0,
      onEvent: (ctx, event) => {
        if (event.kind !== 'crit' || event.actor !== ctx.player.name) return
        triggered += 1
        // 组合技形状:自己的出手会心时,追加一记 0.7 倍的追击
        ctx.strike(ctx.player, ctx.enemy, { mult: 0.7, label: '剑势连绵' })
      }
    })
    const battle = engine.resolve(
      fighter({ attack: 30, hp: 500, maxHp: 500, mods: { critRate: 1 } }),
      fighter({ id: 'e', name: '乙', attack: 1, defense: 0, hp: 9999, maxHp: 9999 }),
      createRng(19)
    )
    // 每一次会心都追加一记 —— 但追加的那一记自己会心时**不再**触发(防递归)
    const crits = battle.events.filter(e => e.kind === 'crit' && e.actor === '甲').length
    const followups = battle.events.filter(e => e.text.includes('剑势连绵')).length
    expect(triggered).toBeGreaterThan(1)
    expect(followups).toBe(triggered) // 一次触发一记,没有级联
    // 追加的那一记同样是命中、也会心(带 critRate 1),但它没有再去触发钩子 ——
    // 否则每一记都会再长出一记,followups 会指数级膨胀
    expect(crits).toBeGreaterThan(triggered)
  })

  it('不配 tickFn / onEvent 时,结算与从前逐位一致', () => {
    const build = (extra = {}) =>
      createCombatEngine({ variance: 0, ...extra }).resolve(
        fighter({ attack: 30, hp: 400, maxHp: 400, mods: { critRate: 1 } }),
        fighter({ id: 'e', name: '乙', attack: 9, defense: 2, hp: 380, maxHp: 380 }),
        createRng(23)
      )
    const bare = build()
    expect(build({ onEvent: () => {} }).events).toEqual(bare.events)
    expect(build({ tickFn: () => {} }).events).toEqual(bare.events)
  })

  it('护盾被击破的那一刻有事件 —— "破盾才触发"的机制不必再去猜', () => {
    const battle = createCombatEngine({ variance: 0, shield: {} }).resolve(
      fighter({ attack: 10, defense: 0, hp: 300, maxHp: 300, speed: 1, mods: { shieldOnStart: 0.05 } }),
      fighter({ id: 'e', name: '乙', attack: 40, defense: 0, hp: 500, maxHp: 500, speed: 2 }),
      createRng(29)
    )
    const breaking = battle.events.filter(e => e.kind === 'shieldbreak')
    expect(breaking.length).toBe(1)
    expect(breaking[0]!.actor).toBe('甲') // 事件记在**盾碎的那一方**头上
    expect(breaking[0]!.round).toBe(1)
  })

  it('加盾原语也收负数(扣盾):"濒死时护盾消散一半"这类代价表达得出来', () => {
    const drained: number[] = []
    const battle = createCombatEngine({
      variance: 0,
      maxRounds: 2,
      shield: {},
      tickFn: ctx => {
        if (ctx.round !== 1) return
        drained.push(ctx.shieldOf(ctx.player))
        drained.push(ctx.gainShield(ctx.player, -40)) // 扣 40,返回实际变化量(负数)
      }
    }).resolve(
      fighter({ attack: 10, defense: 0, hp: 300, maxHp: 300, speed: 2, mods: { shieldOnStart: 0.5 } }),
      fighter({ id: 'e', name: '乙', attack: 0, defense: 0, hp: 200, maxHp: 200, speed: 1 }),
      createRng(31)
    )
    expect(drained[0]).toBe(150) // 开局盾 = 300 × 50%
    expect(drained[1]).toBe(-40)
    expect(battle.playerShield).toBe(110)
  })
})
