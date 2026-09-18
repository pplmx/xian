/* eslint-disable no-console */
/**
 * 事件境界带审计 —— 「这件事在哪一境还说得通」
 *
 * 起因是一句玩家一眼就能看穿的谎:元婴修士被一窝蚂蚁咬成重伤。
 * 追下去发现不是那一条事件写错了,而是**整套事件只有一个半截门槛**:
 *
 *   一、只有 minRealm,没有上限 —— 人间界的乡野小事躺在 'general' 标签里,
 *       从炼气一路漏到混沌海;
 *   二、只有普通事件读它,机缘(ft_)只按区域标签选 —— 而界外区域同样带
 *       'general',于是道祖也会撞见「幼兽认主」「失传丹方」。
 *
 * 本文件把修好之后的口径钉成判据:
 *   数据侧:境界带合法;人间界的际遇/机缘不越过人间界
 *   引擎侧:池子只发带内的东西(拿真引擎做蒙特卡洛,不重抄一遍判据)
 *   密度侧:band 收紧之后不许把某一处地界抽成空池
 *   尺度侧:界外的寿元奖励必须按当前境界折算(写死八百载对金仙是句空话)
 */
import { describe, expect, it, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { EVENTS, FORTUNE_EVENTS, eventDef } from '@/data/events'
import { MORTAL_REGIONS, REGIONS } from '@/data/regions'
import { MAX_MAJOR, WORLD_BREAK_MAJOR, worldOf } from '@/data/realms'
import { mulberry32, RandomService } from '@/utils/random'
import { eventInRealmBand, pickEventFor, regionEventPoolFor } from './eventEngine'
import { DEFAULT_OFFLINE_EVENT_IDS } from './offline'
import { chainOfEvent } from '@/data/chains'
import { usePlayerStore } from '@/stores/player'

/** 池子里至少要有这么多条,才不叫「某处地界没事件可撞」 */
const MIN_POOL = 4

const POOL_EVENTS = EVENTS.filter(e => chainOfEvent(e.id) === null)

/** 当前境界之外的界域名 —— 写给断言里的失败信息 */
const worldName = (major: number): string => worldOf(major).name

/**
 * 「与境界无关」的那几条 —— 天地自然与道心之事,故不设上限。
 *
 *   天地自然:灵泉、雷雨、流星、深谷琴音、石桌残局、夜遇同道、
 *             面壁人影、青石上的老者、醉卧仙人、驮碑老龟
 *   道之考验:心魔叩关、问道石
 *
 * 它们是审计名单:一条事件要么像其余同类那样**声明上限**(它的规模只撑到某一境),
 * 要么在这里写明"我为什么通行全境"。名单不常驻 —— 事件改了性质就得销账,
 * 所以下面还有一条反查(名单里的每一条都必须真的没设上限)。
 */
const TIMELESS_EVENTS = [
  'ev_spring',
  'ev_thunder_bath',
  'ev_falling_star',
  'ev_qin_sound',
  'ev_face_wall',
  'ev_chess',
  'ev_night_talk',
  'ev_old_man',
  'ev_wine_immortal',
  'ev_turtle',
  'ev_heart_demon',
  'ev_dao_stone'
] as const

describe('事件境界带 · 数据自洽', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('每一条事件的境界带都合法:上限不低于下限,且不越出境界表', () => {
    for (const ev of [...EVENTS, ...FORTUNE_EVENTS]) {
      if (ev.minRealm !== undefined) {
        expect(ev.minRealm, `${ev.id} 的 minRealm 越出境界表`).toBeLessThanOrEqual(MAX_MAJOR)
        expect(ev.minRealm, `${ev.id} 的 minRealm 为负`).toBeGreaterThanOrEqual(0)
      }
      if (ev.maxRealm !== undefined) {
        expect(ev.maxRealm, `${ev.id} 的 maxRealm 越出境界表`).toBeLessThanOrEqual(MAX_MAJOR)
        if (ev.minRealm !== undefined) {
          expect(ev.maxRealm, `${ev.id} 的带是空的(minRealm > maxRealm)`).toBeGreaterThanOrEqual(ev.minRealm)
        }
      }
    }
  })

  it('人间界的际遇不越过人间界:界外另有界外的池子', () => {
    // 只有「家安在人间界」的事件才该收口 —— 界外事件本来就带 minRealm 9+,
    // 它们不在这一条的范围里。
    const mortal = POOL_EVENTS.filter(ev => !ev.tags.some(t => ['immortal', 'god', 'chaos'].includes(t)))
    const unbounded = mortal.filter(ev => ev.maxRealm === undefined || ev.maxRealm > WORLD_BREAK_MAJOR - 1)
    expect(
      unbounded.map(e => e.id).sort(),
      '有事件不设上限,会一路漏到仙界/神界/混沌海 —— 要么声明上限,要么进 TIMELESS_EVENTS 并说明理由'
    ).toEqual([...TIMELESS_EVENTS].sort())
  })

  it('不设上限的名单不常驻:名单里的每一条都还在,且真的没设上限', () => {
    for (const id of TIMELESS_EVENTS) {
      const def = eventDef(id)
      expect(def, `名单里的 ${id} 已经不存在了,销账`).toBeDefined()
      expect(def!.maxRealm, `${id} 已经声明上限了,不该再留在「通行全境」名单里`).toBeUndefined()
    }
  })

  it('机缘按界域分池:人间界的五条收在渡劫以内,界外的三条不受上限', () => {
    const mortalFortune = FORTUNE_EVENTS.filter(ev => ev.maxRealm !== undefined)
    expect(mortalFortune.length, '人间界机缘一条都没收口').toBeGreaterThanOrEqual(5)
    for (const ev of mortalFortune) {
      expect(ev.maxRealm, `${ev.id} 的上限越过了人间界`).toBeLessThanOrEqual(WORLD_BREAK_MAJOR - 1)
    }
    for (const ev of FORTUNE_EVENTS) {
      const worldTag = ev.tags.find(t => ['immortal', 'god', 'chaos'].includes(t))
      if (!worldTag) continue
      expect(ev.maxRealm, `${ev.id} 是界外机缘,不该再设上限把自己关掉`).toBeUndefined()
    }
  })

  it('人间界机缘只挂在人间界的地界上', () => {
    const mortalTags = new Set(MORTAL_REGIONS.flatMap(r => r.eventTags))
    for (const ev of FORTUNE_EVENTS.filter(e => e.maxRealm !== undefined)) {
      expect(ev.tags.some(t => mortalTags.has(t)), `${ev.id} 收了上限,却挂不到人间界任何地界`).toBe(true)
    }
  })

  it('离线兜底池也不许绕开境界带', () => {
    // 兜底池不经过 regionEventPoolFor(它本来就是在空池时才被用上),
    // 于是它自己必须是"任何境界都拿得出手"的那几条。
    for (const id of DEFAULT_OFFLINE_EVENT_IDS) {
      const def = eventDef(id)
      expect(def, `离线兜底池里的 ${id} 查不到`).toBeDefined()
      expect(def!.maxRealm, `${id} 有境界带上限,却进了离线兜底池 —— 高境界离线会撞见它`).toBeUndefined()
      expect(def!.minRealm, `${id} 有境界门槛,却进了离线兜底池`).toBeUndefined()
    }
  })
})

describe('事件境界带 · 池子不被抽空', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('每一处地界,在能进它的每一个境界段都有足够的事件可撞', () => {
    const player = usePlayerStore()
    const rows: string[] = []
    let worst = Number.POSITIVE_INFINITY
    let worstAt = ''
    for (const region of REGIONS) {
      for (let major = region.minRealm; major <= MAX_MAJOR; major += 1) {
        player.major = major
        const n = regionEventPoolFor(region).length
        if (n < worst) {
          worst = n
          worstAt = `${region.name}(t${region.tier}) @ ${worldName(major)}`
        }
        if (n < MIN_POOL) rows.push(`${region.name}(t${region.tier} ${region.eventTags.join('/')}) @ ${major} → ${n} 条`)
      }
    }
    console.log(`\n最薄的一处池子:${worst} 条 —— ${worstAt}`)
    expect(rows, `境界带把地界抽空了:\n${rows.join('\n')}`).toEqual([])
  })

  it('界外的每一界域都有自己的际遇池(不是只剩人间界漏下来的那几条)', () => {
    const player = usePlayerStore()
    for (let major = WORLD_BREAK_MAJOR; major <= MAX_MAJOR; major += 1) {
      const regions = REGIONS.filter(r => r.minRealm === major)
      const own = regions.some(r => {
        player.major = major
        return regionEventPoolFor(r).some(ev => (ev.minRealm ?? 0) >= WORLD_BREAK_MAJOR)
      })
      expect(own, `${worldName(major)}(${major}) 一处地界都没有本界域自己的际遇`).toBe(true)
    }
  })

  it('收口没把谁收死:每一条事件都还有地方能撞见', () => {
    // 境界带上限若比"带这个标签的地界的最低境界"还低,这条事件就成了死内容 ——
    // 玩家永远不会遇到,数据却还躺在表里。
    const dead: string[] = []
    for (const ev of POOL_EVENTS) {
      const reachable = REGIONS.some(region => {
        if (!ev.tags.some(t => region.eventTags.includes(t))) return false
        for (let major = region.minRealm; major <= MAX_MAJOR; major += 1) {
          if (eventInRealmBand(ev, major)) return true
        }
        return false
      })
      if (!reachable) dead.push(ev.id)
    }
    expect(dead, `这些事件被境界带关死了,玩家一次也遇不到:\n${dead.join('\n')}`).toEqual([])
  })
})

describe('事件境界带 · 抽不到带外的东西', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('蚁穴藏珍在元婴不再出现 —— 用户报的那一条', () => {
    const player = usePlayerStore()
    const region = REGIONS.find(r => r.id === 'miwu')! // 迷雾沼泽:元婴起可进,带 forest
    player.major = 3
    expect(regionEventPoolFor(region).map(e => e.id), '蚁穴又漏进元婴的池子了').not.toContain('ev_ant_nest')
    player.major = 1
    const byId = new Set(regionEventPoolFor(region).map(e => e.id))
    // 筑基期在万妖林/黑风林能撞见;迷雾沼泽要元婴才进,所以这里只证明「带内还拿得到」
    expect(byId.size).toBeGreaterThan(0)
  })

  it('凡俗尺度的几条事件不会落到元婴以上', () => {
    const countryside = ['ev_ant_nest', 'ev_beggar', 'ev_lost_monk', 'ev_market_day', 'ev_broken_cart', 'ev_pearl']
    for (const id of countryside) {
      const def = eventDef(id)!
      expect(def.maxRealm, `${id} 没有上限,会落到高境界`).toBeDefined()
      expect(eventInRealmBand(def, 3), `${id} 在元婴仍算带内`).toBe(false)
    }
  })

  it('蒙特卡洛:真引擎抽出来的事件,永远落在当前境界的带里', () => {
    const player = usePlayerStore()
    const rand = new RandomService(mulberry32(20260918))
    let picks = 0
    for (const region of REGIONS) {
      for (let major = region.minRealm; major <= MAX_MAJOR; major += 1) {
        player.major = major
        player.eventChains = {}
        for (let i = 0; i < 30; i += 1) {
          const picked = pickEventFor(region, rand)
          if (!picked) continue
          picks += 1
          expect(
            eventInRealmBand(picked, major),
            `${picked.id}(${picked.minRealm ?? 0}~${picked.maxRealm ?? '∞'})被抽给了 ${major} ${worldName(major)} 的 ${region.name}`
          ).toBe(true)
        }
      }
    }
    expect(picks, '一次事件都没抽出来,判据形同虚设').toBeGreaterThan(100)
  })

  it('机缘同理:人间界的机缘不出人间界,界外机缘不在人间界冒头', () => {
    const player = usePlayerStore()
    const rand = new RandomService(mulberry32(20260919))
    for (const region of REGIONS) {
      for (const major of [0, 3, WORLD_BREAK_MAJOR, 14, MAX_MAJOR]) {
        if (major < region.minRealm) continue
        player.major = major
        for (let i = 0; i < 40; i += 1) {
          const picked = pickEventFor(region, rand)
          if (!picked || !picked.id.startsWith('ft_')) continue
          expect(eventInRealmBand(picked, major), `${picked.id} 越带出现在 ${region.name} @ ${worldName(major)}`).toBe(
            true
          )
          const isHigh = picked.tags.some(t => ['immortal', 'god', 'chaos'].includes(t))
          if (major < WORLD_BREAK_MAJOR) expect(isHigh, `${picked.id} 是界外机缘,却落进 ${region.name}`).toBe(false)
        }
      }
    }
  })
})

describe('寿元奖励 · 界外按当前境界折算', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('界外事件的寿元奖励写成比例,不写死年数', () => {
    const boundary = WORLD_BREAK_MAJOR
    for (const ev of [...EVENTS, ...FORTUNE_EVENTS]) {
      const low = ev.minRealm ?? 0
      if (low < boundary) continue
      for (const ch of ev.choices) {
        for (const out of ch.outcomes) {
          for (const eff of out.effects) {
            if (eff.type !== 'lifespan') continue
            expect(eff.pct, `${ev.id} 在界外写死了 ${eff.years} 载寿元`).toBeDefined()
          }
        }
      }
    }
  })

  it('比例写法真的按当前境界结算(元婴当年吃一颗仙桃,不是外门杂役的水平)', () => {
    const player = usePlayerStore()
    player.major = 11 // 金仙
    const before = player.lifespanMax
    // 取事件里的比例写法本身,不重抄数字
    const ev = eventDef('ev_yaochi_xianpai')!
    const pct = ev.choices[0]!.outcomes.find(o => o.effects.some(e => e.type === 'lifespan'))!.effects.find(
      e => e.type === 'lifespan'
    ) as { pct?: number }
    player.addLifespan(Math.round(player.lifespanMax * pct.pct!))
    expect(player.lifespanMax, '金仙吃了一颗仙桃,寿元却没动').toBeGreaterThan(before * 1.01)
  })
})
