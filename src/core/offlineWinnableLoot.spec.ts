/**
 * 离线历练「打不打得过」结算回归 —— 离线只给「真能打赢」的号结算胜场与掉落。
 *
 * 漏洞:minRealm 是软门槛(canEnterRegion 不查境界),而离线结算此前按 `region.tier`
 * 全额折算收益 —— 实测 major3 挂仙界 12h 净得 6 件 profound/spirit 高阶件。
 * 更早的一版修复用「境界门槛」一刀切,但那会误伤**真打得过**高阶区域的号
 * (玩家在场能越阶刷,离线凭本事刷同样合理),杠杆选错。
 *
 * 正确口径(本文件):离线收益只看「打不打得过」。胜率用 `sampleWinRateRaw`
 * (不套 0.08 保底)—— 取样全负(打不过)这一程零胜、零掉落;真打得过的号
 * (哪怕越阶)照常结算。在线越界挑战的自由与此同源,一并保留。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { settleOffline } from './offline'
import { useGameStore } from '@/stores/game'
import { usePlayerStore } from '@/stores/player'
import { useDongfuStore } from '@/stores/dongfu'
import { useAdventureStore } from '@/stores/adventure'
import { useResourcesStore } from '@/stores/resources'
import { gn } from '@/utils/gnum'
import { REGIONS } from '@/data/regions'
import type { AdventureSession } from '@/stores/adventure'

const HOUR = 3600 * 1000

/** 构造「指定境界 + 指定 minRealm 区域」的离线存档会话 */
function setupSession(major: number, minRealm: number): void {
  const game = useGameStore()
  const player = usePlayerStore()
  const dongfu = useDongfuStore()
  const adventure = useAdventureStore()
  game.markStarted()
  game.lastActiveAt = Date.now() - 12 * HOUR
  player.major = major
  player.sub = 0
  player.age = 40
  dongfu.setLevel('mansion', 5)
  const target = REGIONS.find(r => r.minRealm === minRealm)
  expect(target, `应存在 minRealm=${minRealm} 的区域`).toBeDefined()
  adventure.session = {
    regionId: target!.id,
    mode: 'normal',
    startedAt: Date.now() - 12 * HOUR,
    endsAt: Date.now() + 999 * HOUR,
    nextBattleAt: 0,
    wins: 0,
    losses: 0,
    events: 0,
    stoneGain: gn(0),
    expGain: gn(0),
    itemGain: 0
  } as unknown as AdventureSession
}

describe('离线历练 · 打不打得过才结算收益', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('打不过(major3 挂仙界):取样全负 → 零胜、零高阶掉落,会话不被境界强制了断', () => {
    setupSession(3, 9)
    const adventure = useAdventureStore()
    const s = settleOffline(Date.now())
    expect(s).not.toBeNull()
    expect(s!.wins, '打不过不该有胜场').toBe(0)
    expect(s!.battles, '确实发生了战斗(只是全负)').toBeGreaterThan(0)
    expect(s!.equipment?.length ?? 0, '打不过不该白拿该区域高阶装备').toBe(0)
    // 关键:不再用「境界门槛」强制了断会话 —— 挂高阶只因打不过而零收益,会话仍在
    expect(adventure.session, '打不过不应被「境界门槛」强制了断会话').not.toBeNull()
    expect(
      s!.notes.some(n => n.includes('无一胜绩')),
      `应有「打不过、无一胜绩」的说明:${s!.notes.join(' / ')}`
    ).toBe(true)
  })

  it('打不过的高阶历练不会掉出该区域高阶装备(装备账为零)', () => {
    setupSession(3, 9)
    const stoneBefore = useResourcesStore().spiritStone
    const s = settleOffline(Date.now())
    // 装备是白嫖核心,严格为 0 —— 能打赢才有装备,来源从来不是「境界够不够」
    expect(s!.equipment?.length ?? 0).toBe(0)
    // 历练胜场为 0,故历练段不产生 stone;若事件/被动给了少量灵石,也非来自历练胜场
    expect(s!.wins).toBe(0)
  })

  it('能打过的号(同境正常挂机)正常结算、有胜场有掉落 —— 不靠境界门槛误伤', () => {
    setupSession(5, 3)
    const adventure = useAdventureStore()
    const s = settleOffline(Date.now())
    expect(s).not.toBeNull()
    // 打得过就结算:胜场该有,而不是被 minRealm 一刀切
    expect(s!.wins, '能打赢的正常挂机该有胜场').toBeGreaterThan(0)
    // 有能力打赢的人,按胜利累积胜场与掉落(离线只认「打得过」,不看境界)
    expect(s!.equipment?.length ?? 0, '能打赢就有装备产出').toBeGreaterThan(0)
    expect(adventure.session, '能打的会话进入正常行程,不被强制了断').not.toBeNull()
  })
})
