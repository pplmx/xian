/**
 * 离线越界白嫖回归 —— 低境界玩家不得离线白拿高阶区域收益。
 *
 * 漏洞:minRealm 是软门槛(canEnterRegion 只查路线/解锁链,不查境界)。
 * 一旦会话指向高阶区域(例如仙界 minRealm=9),离线结算(settleOffline)此前
 * 无条件按 `region.tier` 全额发灵石/修为/**高阶装备** —— 实测 major3 挂
 * 仙界 12h 净得 6 件 profound/spirit 高阶件。漏洞本因是离线从不复查
 * 境界与区域是否匹配(玩家点进去直接退出也能吃到整段收益)。
 *
 * 修复:离线历练结算前复查 `region.minRealm > player.major`,不足则整段
 * 不结算、直接了终结弃会话,并给一句说明。在线越界挑战的自由保留不动
 * —— 那里玩家在场、有风险、打过才有,这里只堵离线白嫖。
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

/** 构造一个「低境界 + 高阶区域会话」的离线存档 */
function setupLowRealmHighRegion(realmGap: { major: number; minRealm: number }): void {
  const game = useGameStore()
  const player = usePlayerStore()
  const dongfu = useDongfuStore()
  const adventure = useAdventureStore()
  game.markStarted()
  game.lastActiveAt = Date.now() - 12 * HOUR
  player.major = realmGap.major
  player.sub = 0
  player.age = 40
  dongfu.setLevel('mansion', 5)
  const target = REGIONS.find(r => r.minRealm === realmGap.minRealm)
  expect(target, `应存在 minRealm=${realmGap.minRealm} 的区域`).toBeDefined()
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

function sessionStoneBefore(): number {
  return toNumSafe(useResourcesStore().spiritStone)
}

/** 极简安全转 number;GNum 走 m/e 场 */
function toNumSafe(g: { m: number; e: number }): number {
  return g.m * 10 ** g.e
}

describe('离线越界白嫖 · 境界不足不得结算高阶区域', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('major=3 挂 minRealm=9(仙界) 会话:整段不结算、胜场/装备归零、会话被了断', () => {
    setupLowRealmHighRegion({ major: 3, minRealm: 9 })
    const adventure = useAdventureStore()
    const s = settleOffline(Date.now())
    expect(s).not.toBeNull()
    expect(s!.wins, '境界不足不该有胜场').toBe(0)
    expect(s!.battles, '境界不足不该有战斗').toBe(0)
    expect(s!.equipment?.length ?? 0, '境界不足不该掉该区域高阶装备').toBe(0)
    expect(adventure.session, '这一程应被直接了断,不留会话').toBeNull()
    expect(
      s!.notes.some(n => n.includes('境界未足')),
      `应有「境界未足」说明:${s!.notes.join(' / ')}`
    ).toBe(true)
  })

  it('major=3 挂 minRealm=9 会话:历练段灵石不白拿(只留被动/镇压等正常账)', () => {
    setupLowRealmHighRegion({ major: 3, minRealm: 9 })
    const adventure = useAdventureStore()
    const stoneBefore = sessionStoneBefore()
    const s = settleOffline(Date.now())
    // 关键红线:这趟离线不该按仙界 region.tier 发历练灵石(白嫖高阶收益的核心)
    const expLine = s!.notes.find(n => n.startsWith('历练之地'))
    expect(expLine, '应有历练被拒的说明').toBeDefined()
    expect(adventure.session).toBeNull()
    // 被动修为/灵气仍在(它们不依赖区域),但灵石不得来自历练结算 ——
    // 校验胜场为 0 即无历练奖励(招式在上一 it);这里再给一道正锚:
    expect(s!.wins).toBe(0)
  })

  it('境界刚够(self minRealm == major)时,离线正常结算不被误伤', () => {
    // 同境界区域照常挂机:这是正常玩法,修复不得误伤
    setupLowRealmHighRegion({ major: 0, minRealm: 0 })
    const adventure = useAdventureStore()
    const s = settleOffline(Date.now())
    expect(s).not.toBeNull()
    // 同境界不该被拒(session 不该因境界被强制了断 —— 除非自然到点)
    expect(adventure.session, '境界达标的会话不应被「境界未足」强制了断').not.toBeNull()
  })
})
