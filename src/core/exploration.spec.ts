/**
 * 历练 —— 战斗与中断路径
 *
 * 聚焦 Phase 31.0 S4 灵兽性格的「败北保护」:
 * 慢稳/谨慎的灵兽带 lossReduction(降低失败率),败北时低概率护住玩家,
 * 免于重伤、不计败绩、历练继续。此前 lossReduction 只在 petPersonality 里
 * 定义了数值,从未接入 runBattle —— 描述即承诺,不生效就是欺骗。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createPinia, setActivePinia } from 'pinia'
import { usePlayerStore } from '@/stores/player'
import { useAdventureStore } from '@/stores/adventure'
import { useGameStore } from '@/stores/game'
import { engine, enginePaused } from './engine'
import { useCultivationStore } from '@/stores/cultivation'
import { gnZero, sub, toNum } from '@/utils/gnum'
import { useResourcesStore } from '@/stores/resources'
import { EVENT_AUTO_RESOLVE_SECONDS, EXPLORE_BOSS_AFTER_WINS } from '@/data/constants'
import { tickExploration, startExploration, winsUntilRegionBoss } from './exploration'
import {
  startRetreat,
  getCurrentEnlightenment,
  mayTriggerEnlightenment,
  dismissEnlightenment,
  prepareBreakthrough,
  breakthroughPrepState,
  getRetreatRemainingSec
} from './earlyGameService'
import { currentRegionEvent } from './regionEvent'
import { hoursUntilRevive, REVIVE_AFTER_HOURS } from './worldMemory'

/**
 * 与 petPersonality.EFFECTS 里的 cautious 值保持一致(见 petPersonality.spec)。
 * 假 rng 用这个精确值来识别「败北保护那一掷」,测试不依赖调用顺序:
 * 只有 lossReduction 这一掷会被放行,其余 chance 一律为否
 * (事件跳掉、邂逅不触发、残魂不显现),从而干净地走到败北分支。
 */
const CAUTIOUS_LOSS_REDUCTION = 0.04

const { protect, combatWin } = vi.hoisted(() => ({ protect: { value: false }, combatWin: { value: false } }))

vi.mock('@/utils/random', async importOriginal => {
  const mod = await importOriginal<typeof import('@/utils/random')>()
  return {
    ...mod,
    rng: {
      next: () => 0.5,
      int: (_a: number, b: number) => b,
      float: (a: number, _b: number) => a,
      pick: <T,>(arr: readonly T[]): T => arr[0]!,
      weighted: <T,>(arr: readonly T[]): T => arr[0]!,
      chance: (p: number): boolean =>
        protect.value === true && Math.abs(p - CAUTIOUS_LOSS_REDUCTION) < 1e-9
    }
  }
})

// resolveCombat 恒为可控胜负(默认败),makeEnemySnap 恒为占位敌
vi.mock('./combat', async importOriginal => {
  const mod = await importOriginal<typeof import('./combat')>()
  return {
    ...mod,
    resolveCombat: () => (combatWin.value ? { win: true, rounds: 5, playerHpPct: 0.9 } : { win: false, rounds: 5, playerHpPct: 0.4 }),
    makeEnemySnap: () => ({ hp: 100, def: 10, atk: 10 })
  }
})

function forgeSession(now: number): void {
  useAdventureStore().setSession({
    regionId: 'qingyun',
    mode: 'normal',
    startedAt: now - 5000,
    endsAt: now + 60000,
    nextBattleAt: now - 1,
    wins: 0,
    losses: 0,
    events: 0,
    stoneGain: gnZero(),
    expGain: gnZero(),
    itemGain: 0,
    wudaoGain: 0
  })
}

describe('灵兽性格 · 败北保护(lossReduction 接入 runBattle)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    protect.value = false
    combatWin.value = false
  })

  it('谨慎灵兽败北时护住:不加重伤、不计败绩、历练继续', () => {
    const player = usePlayerStore()
    player.initCharacter('护主', { roots: [] } as never)
    player.setPet('pet_yueying') // cautious → lossReduction 0.04
    const now = Date.now()
    forgeSession(now)

    protect.value = true // 放行败北保护那一掷

    tickExploration(now)

    const cultivation = useCultivationStore()
    const adventure = useAdventureStore()
    expect(cultivation.buffs.some(b => b.defId === 'injury')).toBe(false)
    expect(adventure.session).not.toBeNull()
    expect(adventure.session?.losses).toBe(0)
  })

  it('无灵兽败北照常:受重伤、计败绩、中止历练', () => {
    const player = usePlayerStore()
    player.initCharacter('无护', { roots: [] } as never)
    const now = Date.now()
    forgeSession(now)

    tickExploration(now)

    const cultivation = useCultivationStore()
    const adventure = useAdventureStore()
    expect(cultivation.buffs.some(b => b.defId === 'injury')).toBe(true)
    expect(adventure.session).toBeNull() // stopExploration('defeat') 已清空
    expect(adventure.lastBattle?.result.win).toBe(false)
  })

  it('好战灵兽(lossReduction=0)败北不护:与无灵兽一致', () => {
    const player = usePlayerStore()
    player.initCharacter('莽打', { roots: [] } as never)
    player.setPet('pet_huoque') // fierce → lossReduction 0
    const now = Date.now()
    forgeSession(now)

    protect.value = true // 即使放行掷点,0 的概率也恒不护

    tickExploration(now)

    const cultivation = useCultivationStore()
    const adventure = useAdventureStore()
    expect(cultivation.buffs.some(b => b.defId === 'injury')).toBe(true)
    expect(adventure.session).toBeNull()
  })
})

describe('连胜(TASK-022 接线 · runBattle 胜负驱动 player.winStreak)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    protect.value = false
    combatWin.value = false
  })

  it('战场得胜让连胜 +1', () => {
    const player = usePlayerStore()
    player.initCharacter('连胜测试', { roots: [] } as never)
    const now = Date.now()
    forgeSession(now)

    combatWin.value = true
    tickExploration(now)

    expect(player.winStreak).toBe(1)
  })

  it('真正的败北重置连胜(3→0);灵兽护住的那次不重置', () => {
    const player = usePlayerStore()
    player.initCharacter('连胜测试', { roots: [] } as never)
    player.setPet('pet_yueying') // cautious → lossReduction 0.04
    player.winStreak = 3
    const now = Date.now()
    forgeSession(now)

    protect.value = true // 败北被护住:不算败 → 连胜保留
    tickExploration(now)
    expect(player.winStreak).toBe(3)
    expect(useAdventureStore().session).not.toBeNull()

    // 再来一场真正的败北(无灵兽保护):连胜清空
    player.setPet('pet_huoque') // fierce → lossReduction 0
    protect.value = false
    player.winStreak = 5
    forgeSession(now)
    tickExploration(now)
    expect(player.winStreak).toBe(0)
  })

  it('连胜档赏的悟道并入本趟会话账(haul 要有数可报)', () => {
    const player = usePlayerStore()
    player.initCharacter('连胜测试', { roots: [] } as never)
    player.winStreak = 2 // 再胜一场 → 3 档,赏悟道 1
    combatWin.value = true
    const now = Date.now()
    forgeSession(now)
    tickExploration(now)
    expect(player.winStreak).toBe(3)
    expect(useAdventureStore().session!.wudaoGain, '3 档赏的悟道该写进这一趟的会话账,结束总结才有得报').toBe(1)
  })
})

/**
 * 镇压资格只在**首次**达成时自动接管(DEC-018):
 * 若每次优势取胜都自动转成收益态,玩家就没法自由选择「这一世我要历练它」。
 */
describe('镇压资格首次自动、此后自由', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    protect.value = false
    combatWin.value = true
  })

  it('首次达成条件 → 自动转收益并记下资格;停取后再胜,不再自动接管', () => {
    const player = usePlayerStore()
    player.initCharacter('镇守', { roots: [] } as never)
    // 已达镇压条件的一地
    const stats = { totalFights: 30, avgRounds: 2, avgDamageTakenPct: 0.03, consecutiveWins: 30, lastUpdateAt: Date.now() }
    player.regionStats.qingyun = { ...stats }

    const now = Date.now()
    forgeSession(now)
    tickExploration(now)
    expect(player.suppressedRegions, '首次达成应自动转收益').toContain('qingyun')
    expect(player.suppressQualified).toContain('qingyun')

    // 玩家改主意:停取收益,重新历练此地
    player.unsuppressRegion('qingyun')
    player.regionStats.qingyun = { ...stats }
    const now2 = Date.now() + 60_000
    forgeSession(now2)
    tickExploration(now2)
    expect(player.suppressedRegions, '已取得资格后不该再被自动接管').not.toContain('qingyun')
    expect(player.suppressQualified).toContain('qingyun')
  })
})

describe('闭关禁令:闭关期间不得进入历练(Phase 28 接线后)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    protect.value = false
    combatWin.value = false
  })

  it('startExploration 在闭关中被拒,不产生会话(拒绝原因显式而非静默)', () => {
    const player = usePlayerStore()
    player.initCharacter('闭关测试', { roots: [] } as never)
    startRetreat()
    expect(startExploration('qingyun', 'normal')).toBe(false)
    expect(useAdventureStore().session).toBeNull()
    expect(useCultivationStore().hasBuff('retreat')).toBe(true)
  })

  it('起新一程前清掉历史残留的待处理事件(坏档边缘:会话没了、事件串还在)', () => {
    setActivePinia(createPinia())
    const adventure = useAdventureStore()
    const player = usePlayerStore()
    player.initCharacter('清事件测试', { roots: [] } as never)
    // 坏档形态:sanitize 把非法会话修成 null,却留下一个认为合法的 pendingEventId
    adventure.$patch({ session: null, pendingEventId: 'ev_spring', pendingEventSince: Date.now() })
    adventure.sanitize()
    // 复现这一形态:会话确为 null,事件串仍在
    expect(adventure.session).toBeNull()
    expect(adventure.pendingEventId).toBe('ev_spring')
    // 踏入新一程:残留事件必须被清掉,不能带到新会话里派 wrong-tier 的 autoResolve
    expect(startExploration('qingyun', 'normal')).toBe(true)
    expect(adventure.pendingEventId).toBeNull()
    expect(adventure.pendingEventSince).toBe(0)
  })
})

/**
 * 会话账目与战报 —— 与 afterWin 的真实入账同源。
 *
 * 从前会话自己按 stoneByTier(tier, 10×modeMult) 记一份灵石(漏了福缘/区域事件/首领倍率),
 * expGain 从头到尾恒为 0,itemGain 数的是掉落**文案行数**(连「战利品翻倍!」也算一件)。
 * 于是「本次所得」和行囊里真正多出来的东西对不上 —— 这几个字段本来就是为了给玩家看。
 */
describe('会话账目 · 与真实入账同源', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    protect.value = false
    combatWin.value = true
  })

  it('得胜后会话累计的灵石/修为,等于行囊与修为的真实增量', () => {
    const adventure = useAdventureStore()
    const player = usePlayerStore()
    const resources = useResourcesStore()
    player.initCharacter('记账', { roots: [] } as never)

    const now = Date.now()
    forgeSession(now)
    // 第一战会带上首胜成就这类一次性奖励,不能拿来对账;比第二战的增量才干净
    tickExploration(now)
    const s1 = adventure.session!
    const stoneBefore = { ...resources.spiritStone }
    const expBefore = { ...player.exp }
    adventure.setSession({ ...s1, nextBattleAt: now - 1 })
    tickExploration(now)

    const s = adventure.session!
    expect(s.wins).toBe(2)
    expect(toNum(sub(s.stoneGain, s1.stoneGain)), '会话灵石账应等于行囊增量').toBeCloseTo(
      toNum(sub(resources.spiritStone, stoneBefore)),
      6
    )
    expect(toNum(sub(s.expGain, s1.expGain)), '会话修为账应等于修为增量').toBeCloseTo(
      toNum(sub(player.exp, expBefore)),
      6
    )
    expect(toNum(s.stoneGain), '战斗确有产出,别把账记成 0').toBeGreaterThan(0)
    expect(toNum(s.expGain)).toBeGreaterThan(0)
  })

  it('战报带上本战掉落明细(原文案不再算作拾获件数)', () => {
    const adventure = useAdventureStore()
    const player = usePlayerStore()
    player.initCharacter('战报', { roots: [] } as never)

    const now = Date.now()
    forgeSession(now)
    tickExploration(now)

    // 假 rng 把所有概率判定压成否:本战无实物掉落,但明细栏必须存在且为空表
    expect(Array.isArray(adventure.lastBattle?.loot)).toBe(true)
    expect(adventure.session!.itemGain, '无实物掉落时件数为 0(旧实现会把提示行算成一件)').toBe(0)
  })
})

describe('首领门槛 · 界面提示与战斗判定同源', () => {
  it('未靖地界:差多少胜一目了然,满门槛即为 0', () => {
    expect(winsUntilRegionBoss(0, false)).toBe(EXPLORE_BOSS_AFTER_WINS)
    expect(winsUntilRegionBoss(3, false)).toBe(EXPLORE_BOSS_AFTER_WINS - 3)
    expect(winsUntilRegionBoss(EXPLORE_BOSS_AFTER_WINS, false)).toBe(0)
    expect(winsUntilRegionBoss(EXPLORE_BOSS_AFTER_WINS + 5, false), '门槛之上不出现负数').toBe(0)
  })

  it('已靖地界:不再有首领,提示返回 null', () => {
    expect(winsUntilRegionBoss(0, true)).toBeNull()
  })

  /**
   * **玩家实测的回归**:涉险(危险 ×2.1)/深入(×1.45)几乎刷不到首领,只有安稳能,
   * 于是下一片地界永远不开。
   *
   * 根因:门槛读的是**本趟胜场**(s.wins),而战败会结束整趟(stopExploration('defeat')),
   * 连胜随之归零 —— 难模式里输一场就全赔。首领该是"对这一地界熟到能叩门",
   * 不是"一趟不输",故进度改为按地界累计(regionWins),换世才清空。
   */
  it('首领进度按地界累计:一趟战败不清零,下一趟接着算', () => {
    setActivePinia(createPinia())
    const adventure = useAdventureStore()
    const region = 'qingyun'
    expect(adventure.winsIn(region)).toBe(0)
    // 第一趟赢 7 场后战败(会话结束)
    adventure.addRegionWins(region, 7)
    adventure.setSession(null)
    expect(adventure.winsIn(region), '战败不该把叩门进度清零').toBe(7)
    // 第二趟再赢 3 场:累计到门槛,首领就在下一战
    adventure.addRegionWins(region, 3)
    expect(winsUntilRegionBoss(adventure.winsIn(region), false)).toBe(0)
    // 换一片天地:门路重新蹚(与 mortalCleared 同规则)
    adventure.setMortalWorld(null)
    expect(adventure.winsIn(region)).toBe(0)
  })

  it('累计胜场是持久的、且坏档值会被修回(它决定首领何时出现)', () => {
    setActivePinia(createPinia())
    const adventure = useAdventureStore()
    adventure.addRegionWins('qingyun', 2)
    // 损坏存档:负数 / NaN / 字符串一律不算数
    adventure.$patch({ regionWins: { qingyun: -5, luoxia: Number.NaN, heifeng: 'x' as unknown as number } })
    adventure.sanitize()
    expect(adventure.winsIn('qingyun')).toBe(0)
    expect(adventure.winsIn('luoxia')).toBe(0)
    expect(adventure.winsIn('heifeng')).toBe(0)
  })
})

describe('引擎暂停 · 历练墙上的截止时刻', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    engine.resume()
  })
  afterEach(() => {
    engine.resume()
    dismissEnlightenment()
    vi.restoreAllMocks()
  })

  it('resume 把 endsAt / nextBattleAt 按暂停时长往后推', () => {
    const t0 = 1_700_000_000_000
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(t0)
    useGameStore().markStarted()
    forgeSession(t0)
    const before = { ...useAdventureStore().session! }

    engine.pause()
    expect(enginePaused.value).toBe(true)
    nowSpy.mockReturnValue(t0 + 12_000)
    engine.resume()
    expect(enginePaused.value).toBe(false)

    const after = useAdventureStore().session!
    expect(after.endsAt, '暂停期间墙上的截止时刻必须跟着挪').toBe(before.endsAt + 12_000)
    expect(after.nextBattleAt).toBe(before.nextBattleAt + 12_000)
  })

  it('重复 pause / resume 不叠加', () => {
    const t0 = 1_700_000_000_000
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(t0)
    useGameStore().markStarted()
    forgeSession(t0)
    const endsAt = useAdventureStore().session!.endsAt
    engine.pause()
    engine.pause()
    nowSpy.mockReturnValue(t0 + 5_000)
    engine.resume()
    engine.resume()
    expect(useAdventureStore().session!.endsAt).toBe(endsAt + 5_000)
  })

  it('useNow 在引擎暂停时不再推进墙上读数', () => {
    const src = readFileSync(resolve(__dirname, '../composables/useNow.ts'), 'utf8')
    expect(src).toContain('enginePaused')
    expect(src).toContain('enginePause')
  })

  it('resume 把 Buff / 问卦 / 区域事件按暂停时长往后推', () => {
    const t0 = 1_700_000_000_000
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(t0)
    useGameStore().markStarted()
    const cult = useCultivationStore()
    const player = usePlayerStore()
    cult.addBuff('retreat', t0)
    const buffEnds = cult.buffs.find(b => b.defId === 'retreat')!.endsAt
    player.setRegionEvent({ regionId: 'qingyun', eventId: 'yaochao', endsAt: t0 + 60_000 })
    player.setDivination({
      hexagram: '乾',
      upper: 'qian',
      lower: 'qian',
      changed: null,
      changing: 0,
      changingAt: [],
      lines: [7, 7, 7, 7, 7, 7],
      castAt: t0,
      expiresAt: t0 + 600_000
    })

    engine.pause()
    nowSpy.mockReturnValue(t0 + 20_000)
    engine.resume()

    expect(cult.buffs.find(b => b.defId === 'retreat')!.endsAt).toBe(buffEnds + 20_000)
    expect(player.regionEvent?.endsAt).toBe(t0 + 80_000)
    expect(player.divination?.expiresAt).toBe(t0 + 620_000)
  })

  it('resume 把镇压 / 已靖起点往后推,复聚倒计时不因暂停缩短', () => {
    const t0 = 1_700_000_000_000
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(t0)
    useGameStore().markStarted()
    const player = usePlayerStore()
    const adventure = useAdventureStore()
    player.suppressRegion('qingyun')
    player.regionStats = {
      qingyun: { totalFights: 20, avgRounds: 2, avgDamageTakenPct: 0.02, consecutiveWins: 20, lastUpdateAt: t0 }
    }
    adventure.$patch({ cleared: ['qingyun'], clearedAt: { qingyun: t0 } })

    expect(hoursUntilRevive(player.suppressedSince.qingyun, t0)).toBeCloseTo(REVIVE_AFTER_HOURS, 6)

    engine.pause()
    nowSpy.mockReturnValue(t0 + 3_600_000)
    engine.resume()

    expect(player.suppressedSince.qingyun).toBe(t0 + 3_600_000)
    expect(adventure.clearedAt.qingyun).toBe(t0 + 3_600_000)
    expect(player.regionStats.qingyun?.lastUpdateAt).toBe(t0 + 3_600_000)
    expect(hoursUntilRevive(player.suppressedSince.qingyun, t0 + 3_600_000), '暂停一小时后复聚倒计时仍是整段').toBeCloseTo(
      REVIVE_AFTER_HOURS,
      6
    )
  })

  it('resume 把待处理际遇起点往后推,暂停超时不自动代选', () => {
    const t0 = 1_700_000_000_000
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(t0)
    useGameStore().markStarted()
    const player = usePlayerStore()
    player.initCharacter('际遇', { roots: [] } as never)
    forgeSession(t0)
    const adventure = useAdventureStore()
    adventure.setPendingEvent('ev_spring', t0)

    const pauseMs = (EVENT_AUTO_RESOLVE_SECONDS + 10) * 1000
    engine.pause()
    nowSpy.mockReturnValue(t0 + pauseMs)
    engine.resume()

    expect(adventure.pendingEventSince).toBe(t0 + pauseMs)
    tickExploration(t0 + pauseMs)
    expect(adventure.pendingEventId, '暂停把 120 秒窗口耗尽时不得代选').toBe('ev_spring')
  })

  it('暂停中顿悟窗口不过期,resume 后截止时刻跟着挪', () => {
    const t0 = 1_700_000_000_000
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(t0)
    vi.spyOn(Math, 'random').mockReturnValue(0.001)
    useGameStore().markStarted()
    mayTriggerEnlightenment()
    const ev = getCurrentEnlightenment()
    expect(ev, '应当触发一扇顿悟').not.toBeNull()
    const expires = ev!.expiresAt

    engine.pause()
    nowSpy.mockReturnValue(t0 + 90_000)
    expect(getCurrentEnlightenment(), '暂停中不得因墙上时钟把窗口收掉').not.toBeNull()
    engine.resume()
    const after = getCurrentEnlightenment()
    expect(after, '挪完截止后窗口还在').not.toBeNull()
    expect(after!.expiresAt).toBe(expires + 90_000)
  })

  it('暂停中墙上时钟越过 expiresAt / endsAt / readyAt 也不散、不清、不转就绪', () => {
    const t0 = 1_700_000_000_000
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(t0)
    useGameStore().markStarted()
    const player = usePlayerStore()
    player.setRegionEvent({ regionId: 'qingyun', eventId: 'yaochao', endsAt: t0 + 30_000 })
    player.setDivination({
      hexagram: '乾',
      upper: 'qian',
      lower: 'qian',
      changed: null,
      changing: 0,
      changingAt: [],
      lines: [7, 7, 7, 7, 7, 7],
      castAt: t0,
      expiresAt: t0 + 60_000
    })
    expect(prepareBreakthrough('meditate')).toBe(true)
    startRetreat()
    expect(getRetreatRemainingSec()).toBe(300)

    engine.pause()
    nowSpy.mockReturnValue(t0 + 200_000)
    // Force the divination computed to re-run (it keys off play-time, not Date.now).
    useGameStore().addPlayTime(1)

    expect(player.activeDivination, '暂停中卦力不得因墙上时钟散掉').not.toBeNull()
    expect(currentRegionEvent('qingyun'), '暂停中不得清掉区域事件').not.toBeNull()
    expect(player.regionEvent, '过期清理路径不得在暂停中写掉存档').not.toBeNull()
    const prep = breakthroughPrepState()
    expect(prep.sitting, '静坐不得在暂停中被墙上时钟判成就绪').toBe(true)
    expect(prep.ready).toBe(false)
    expect(getRetreatRemainingSec(), '闭关剩余也要冻住').toBe(300)

    engine.resume()
    expect(player.activeDivination, '挪完截止后卦还在').not.toBeNull()
    expect(currentRegionEvent('qingyun'), '挪完截止后区域事件还在').not.toBeNull()
    expect(breakthroughPrepState().sitting, '挪完截止后仍在静坐').toBe(true)
    expect(getRetreatRemainingSec()).toBe(300)
  })
})
