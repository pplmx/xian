/* eslint-disable no-console -- 离线对账表是给人看的 */
/**
 * 离线总结不许漏账 —— 变动了多少,就得说出多少
 *
 * 「归来」那个弹窗是玩家唯一一次看到离线期间发生了什么的机会。它漏掉一项,
 * 玩家就永远不知道自己拿到过(或失去过)什么:此前它报了修为/灵石/灵草/玄铁/
 * 悟道点/战斗/际遇/回收化尘,却没提**灵气回充**与**寿元流逝** —— 前者是白得的,
 * 后者是要命的(寿元归零就死了,而玩家只会发现「怎么忽然老了」)。
 *
 * 这里不重抄一份清单,而是**看真实差额**:跑一次 60 小时离线结算,
 * 拿每个资源的前后差去对摘要里报的数(灵气受上限约束,故对的是实际差额),
 * 再要求「凡变动过的东西,摘要里都有交代」。
 *
 * 故障注入:把 summary.qi / summary.ageYears 去掉,或把 ageYears 记成 0,本文件立刻红。
 */
import { describe, expect, it, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createPinia, setActivePinia } from 'pinia'
import { settleOffline } from './offline'
import { useGameStore } from '@/stores/game'
import { usePlayerStore } from '@/stores/player'
import { useResourcesStore } from '@/stores/resources'
import { useDongfuStore } from '@/stores/dongfu'
import { useAdventureStore } from '@/stores/adventure'
import { gn } from '@/utils/gnum'
import { EXPLORE_MODES } from '@/data/constants'

const GAP_HOURS = 60
const HOUR_MS = 3600 * 1000

/** 攒一份「每个离线产线都在动」的档 */
function setupBusySave(): void {
  const game = useGameStore()
  const player = usePlayerStore()
  const resources = useResourcesStore()
  const dongfu = useDongfuStore()
  const adventure = useAdventureStore()

  game.markStarted()
  game.lastActiveAt = Date.now() - GAP_HOURS * HOUR_MS

  player.major = 4
  player.sub = 0
  player.age = 120
  // 灵气留空,离线回充才看得见
  resources.setQi(0, player.qiCapValue)
  player.suppressedRegions = ['qingyun']
  dongfu.setLevel('mansion', 4) // 离线封顶抬到 60h 以上
  dongfu.setLevel('field', 10)
  dongfu.setLevel('alchemy', 10)
  dongfu.setLevel('library', 10)
  adventure.session = {
    regionId: 'qingyun',
    mode: 'normal',
    startedAt: Date.now() - GAP_HOURS * HOUR_MS,
    endsAt: Date.now() + 999 * HOUR_MS,
    nextBattleAt: 0,
    wins: 0,
    losses: 0,
    events: 0,
    stoneGain: gn(0),
    expGain: gn(0),
    itemGain: 0
  } as unknown as typeof adventure.session
  void EXPLORE_MODES
}

describe('离线总结 · 变动了多少就报多少', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('60 小时归来:资源差额与摘要逐项对得上,且每项变动都有交代', () => {
    setupBusySave()
    const player = usePlayerStore()
    const resources = useResourcesStore()
    const before = {
      exp: { ...player.exp },
      stone: { ...resources.spiritStone },
      qi: resources.qi,
      herb: resources.herb,
      ore: resources.ore,
      wudao: resources.wudao,
      age: player.age
    }

    const summary = settleOffline(Date.now())!
    expect(summary, '这一档应当结算出离线收益').not.toBeNull()

    const delta = {
      qi: resources.qi - before.qi,
      herb: resources.herb - before.herb,
      ore: resources.ore - before.ore,
      wudao: resources.wudao - before.wudao,
      age: player.age - before.age
    }
    console.log(
      `\n60h 归来:修为 +${summary.exp.m}e${summary.exp.e} · 灵石 +${summary.stone.m}e${summary.stone.e}` +
        ` · 灵气 +${summary.qi}(实 ${delta.qi}) · 灵草 +${summary.herb} · 玄铁 +${summary.ore}` +
        ` · 悟道 +${summary.wudao} · 战斗 ${summary.battles} · 寿元 -${summary.ageYears}`
    )

    // 一 资源类:摘要报的数就是实际差额(灵气取整,故容 1)
    expect(summary.qi, '灵气回充没报,或报的数不是实际差额').toBeCloseTo(delta.qi, 0)
    expect(summary.herb).toBe(delta.herb)
    expect(summary.ore).toBe(delta.ore)
    expect(summary.wudao).toBe(delta.wudao)
    // 二 寿元:流逝多少就报多少(它不受离线上限约束,按真实时长算)
    expect(summary.ageYears, '寿元流逝没报').toBeCloseTo(delta.age, 0)
    expect(summary.ageYears, '这一档闭关 60 小时,寿元不该一点没动').toBeGreaterThan(50)
    // 三 凡变动过的,摘要里都得有交代 —— 不许有「悄悄动了」的资源
    if (delta.qi > 0) expect(summary.qi, '灵气涨了但摘要没这一项').toBeGreaterThan(0)
    if (delta.qi > 0) expect(summary.notes.some(n => n.includes('寿元流逝')), '寿元流逝该有一句说明').toBe(true)
    const dialog = readFileSync(resolve(__dirname, '../components/offline/OfflineRewardDialog.vue'), 'utf8')
    expect(dialog, '归来卷轴必须把寿元流逝做成主行,不能只埋在 notes').toContain('s.ageYears')
    expect(dialog).toContain('寿元流逝')
  })

  /**
   * **寿元告警**:修为与灵气已改成不限时(挂得越久收益越多),但寿元是按现实时间走的 ——
   * 一次长缺席足以把人送到油尽灯枯的边上。只报"流逝了几年"不够,玩家要知道
   * "我还剩几年、危不危险"。阈值与顶栏那条同源(LIFESPAN_WARN_RATIO / CRITICAL)。
   */
  it('长缺席把寿元压到告警线内时,归来结算要明确报警', () => {
    setActivePinia(createPinia())
    const game = useGameStore()
    const player = usePlayerStore()
    game.markStarted()
    player.major = 0
    player.sub = 0
    player.age = 0
    // 炼气寿限约 150 载;缺席 140 小时 = 老 140 岁 → 剩余约 7%,落在告警线内
    game.lastActiveAt = Date.now() - 140 * 3600 * 1000
    const summary = settleOffline(Date.now())
    expect(summary, '离线未结算').not.toBeNull()
    const warn = summary!.notes.find(n => n.includes('寿元将尽') || n.includes('寿元已薄'))
    expect(warn, `寿元只剩 ${Math.round(player.lifespanRatio * 100)}% 却没报警:${summary!.notes.join(' / ')}`).toBeDefined()
    expect(warn!, '告警该给出剩余载数,而不只是"流逝了多少"').toMatch(/仅余\s*\d+\s*载/)
  })

  /**
   * 顶栏年龄是 floor,归来卷轴若 round,半小时出关会报「流逝 1 载」而顶栏数字没动;
   * 一个半小时会报 2 载而顶栏只进 1。差额必须跟顶栏同一把尺。
   */
  it('归来寿元按顶栏整数进位,不四舍五入', () => {
    setActivePinia(createPinia())
    const game = useGameStore()
    const player = usePlayerStore()
    game.markStarted()
    player.major = 0
    player.sub = 0
    player.age = 10
    game.lastActiveAt = Date.now() - 0.6 * HOUR_MS
    const short = settleOffline(Date.now())!
    expect(short.ageYears, '0.6 载不够顶栏翻一岁,卷轴不该报 1 载').toBe(0)
    expect(Math.floor(player.age)).toBe(10)

    setActivePinia(createPinia())
    const game2 = useGameStore()
    const player2 = usePlayerStore()
    game2.markStarted()
    player2.major = 0
    player2.sub = 0
    player2.age = 10
    game2.lastActiveAt = Date.now() - 1.6 * HOUR_MS
    const long = settleOffline(Date.now())!
    expect(long.ageYears, '1.6 载顶栏只进 1 岁,卷轴不该 round 成 2').toBe(1)
    expect(Math.floor(player2.age)).toBe(11)

    setActivePinia(createPinia())
    const game3 = useGameStore()
    const player3 = usePlayerStore()
    game3.markStarted()
    player3.major = 0
    player3.sub = 0
    player3.age = 10.7
    game3.lastActiveAt = Date.now() - 0.6 * HOUR_MS
    const tick = settleOffline(Date.now())!
    expect(tick.ageYears, '10.7 → 11.3 顶栏翻了一岁,卷轴得报 1').toBe(1)
    expect(Math.floor(player3.age)).toBe(11)
  })

  it('寿元告警剩余载数与顶栏 age/max 相减同源,不把 0.4 载 round 成 0', () => {
    setActivePinia(createPinia())
    const game = useGameStore()
    const player = usePlayerStore()
    game.markStarted()
    player.major = 0
    player.sub = 0
    // 顶栏会显示 floor(max-0.4)/max = (max-1)/max;round(0.4) 会谎报「仅余 0 载」
    player.age = player.lifespanMax - 0.4
    game.lastActiveAt = Date.now() - 5 * 60 * 1000 // 5 分钟,够弹窗、寿元几乎不动
    const summary = settleOffline(Date.now())!
    const warn = summary.notes.find(n => n.includes('寿元将尽') || n.includes('寿元已薄'))
    expect(warn, `${player.age.toFixed(1)}/${player.lifespanMax} 已在告警线内`).toBeDefined()
    expect(warn, '顶栏还剩 1 载,告警不该写成仅余 0 载').toMatch(/仅余\s*1\s*载/)
  })

  it('顶栏与归来卷轴共用 yearsShown 这一把尺', () => {
    const formatSrc = readFileSync(resolve(__dirname, '../utils/format.ts'), 'utf8')
    const offlineSrc = readFileSync(resolve(__dirname, './offline.ts'), 'utf8')
    const bar = readFileSync(resolve(__dirname, '../components/common/TopStatusBar.vue'), 'utf8')
    expect(formatSrc, '整数年必须有统一出口').toContain('export function yearsShown')
    expect(offlineSrc, '归来流逝年数必须走 yearsDeltaShown').toContain('yearsDeltaShown')
    expect(offlineSrc, '归来剩余年数必须走 yearsLeftShown').toContain('yearsLeftShown')
    expect(offlineSrc, '禁止再对寿元差额四舍五入').not.toContain('Math.round(player.age - ageBefore)')
    expect(offlineSrc, '禁止再对剩余寿元四舍五入').not.toContain('Math.round(player.lifespanMax - player.age)')
    expect(bar, '顶栏年龄必须走 yearsShown').toContain('yearsShown(player.age)')
  })

  it('封顶也不改变「报的就是实际差额」:洞府 0 级时灵草只按 8 小时结', () => {
    setupBusySave()
    const dongfu = useDongfuStore()
    dongfu.setLevel('mansion', 0)
    const resources = useResourcesStore()
    const herbBefore = resources.herb
    const summary = settleOffline(Date.now())!
    expect(summary.capped, '洞府 0 级时 60h 缺席应当被封顶').toBe(true)
    expect(summary.herb, '摘要报的灵草数 = 实际进账数').toBe(resources.herb - herbBefore)
    expect(summary.qi, '摘要报的灵气数 = 实际进账数').toBeCloseTo(resources.qi, -1)
  })
})
