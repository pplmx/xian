/**
 * 区域动态事件(Phase 31.0 A2)
 *
 * 区域临时进入异常状态(30 分钟 ~ 2 小时),改变敌人组成/掉落/生态。
 * 低频、自动过期,不做 MMO 打卡。与 Build/区域生态/世界记忆衔接。
 *
 * 事件:
 *   yaochao   妖潮 —— 多段敌人↑,掉落↑,危险↑
 *   lingmai   灵脉暴动 —— 修为获取↑,灵气恢复↑
 *   gumu      古墓开启 —— 事件率↑,稀有掉落↑
 *   shangdui  商队遇袭 —— 灵石掉落↑,战斗节奏快
 *
 * 机制只有四套,界域各有各的叫法:人间界有「过路商队」,混沌海里没有 ——
 * 那里只有掠夺者留下的残局。文案按界域取(worlds),倍率与触发方式一律共用,
 * 免得为了一句 flavor 把同一套机制在界外再实现一遍。
 */
import { usePlayerStore } from '@/stores/player'
import { rng } from '@/utils/random'
import { worldOf } from '@/data/realms'
import type { RegionDef, WorldId } from '@/types'

export type RegionEventId = 'yaochao' | 'lingmai' | 'gumu' | 'shangdui'

export interface RegionEventState {
  regionId: string
  eventId: RegionEventId
  /** 结束时间戳 */
  endsAt: number
}

export interface RegionEventDef {
  id: RegionEventId
  /** 人间界的名字与说明(= 默认文案) */
  name: string
  desc: string
  /** 掉落倍率 */
  rewardMult: number
  /** 敌人危险倍率 */
  dangerMult: number
  /** 事件触发率修正 */
  eventMult: number
  /** 界外文案:这一套机制在仙界/神界/混沌海叫什么(缺省沿用上面两条) */
  worlds?: Partial<Record<WorldId, { name: string; desc: string }>>
}

export const REGION_EVENTS: RegionEventDef[] = [
  {
    id: 'yaochao',
    name: '妖潮',
    desc: '妖气翻涌,群妖躁动。多段敌人更多,掉落更丰,也更凶险。',
    rewardMult: 1.2,
    dangerMult: 1.15,
    eventMult: 1,
    worlds: {
      immortal: { name: '仙兽成群', desc: '云海之间仙兽成群出没,仙材散落,凶险亦增。' },
      god: { name: '神兽踏界', desc: '神域法则激荡,神兽踏界而行,沿途神材散落。' },
      chaos: { name: '凶兽潮', desc: '混沌中凶兽成群涌动,真灵碎片散落一地,凶险倍增。' }
    }
  },
  {
    id: 'lingmai',
    name: '灵脉暴动',
    desc: '地底灵脉喷薄,天地灵气大盛。',
    rewardMult: 1,
    dangerMult: 1,
    eventMult: 1,
    worlds: {
      immortal: { name: '仙灵喷薄', desc: '云海之下仙灵喷薄而出,仙灵之气大盛。' },
      god: { name: '神机流转', desc: '神域灵机流转如意,神息大盛。' },
      chaos: { name: '本源涌动', desc: '混沌本源涌动不息,万道之气大盛。' }
    }
  },
  {
    id: 'gumu',
    name: '古墓开启',
    desc: '尘封古墓裂开一道缝隙,际遇与凶险并存。',
    rewardMult: 1.15,
    dangerMult: 1.05,
    eventMult: 1.5,
    worlds: {
      immortal: { name: '仙冢现世', desc: '一座仙人冢现于云海,仙藏与禁制并存。' },
      god: { name: '神藏现世', desc: '神域古藏现世,神物与神威并存。' },
      chaos: { name: '古祭开启', desc: '比天地更早的古祭裂开一道缝隙,际遇与凶险并存。' }
    }
  },
  {
    id: 'shangdui',
    name: '商队遇袭',
    desc: '过路商队遭袭,遍地灵石遗落,亦有匪徒潜伏。',
    rewardMult: 1.25,
    dangerMult: 1.1,
    eventMult: 1,
    worlds: {
      immortal: { name: '仙使失期', desc: '押送仙材的仙使迟迟未至,云海间仙材散落,亦有劫修潜伏。' },
      god: { name: '神使失期', desc: '押送神材的神使失了期,荒野上神材散落,亦有劫神潜伏。' },
      chaos: { name: '掠夺者', desc: '混沌中来去无常的掠夺者刚刚走脱,只留下一地未曾卷走的真灵之物。' }
    }
  }
]

const BY_ID = new Map(REGION_EVENTS.map(e => [e.id, e]))

/**
 * 取一套区域事件。传了 major 就返回**该界域的叫法**(人间界文案是默认)。
 * 倍率永远取同一条数据 —— 换的只是名字与说法,不是难度。
 */
export function regionEventDef(id: RegionEventId, major?: number): RegionEventDef | undefined {
  const def = BY_ID.get(id)
  if (!def || major === undefined) return def
  const override = def.worlds?.[worldOf(major).id]
  return override ? { ...def, ...override } : def
}

/** 事件持续时间(分钟,30~120) */
const DURATION_MIN = [30, 60, 90, 120] as const

/** 当前生效的区域事件(未过期;被过期清理) */
export function currentRegionEvent(regionId: string): RegionEventState | null {
  const player = usePlayerStore()
  const now = Date.now()
  const ev = player.regionEvent
  if (!ev || ev.regionId !== regionId) return null
  if (ev.endsAt <= now) {
    // 过期自动清理
    player.setRegionEvent(null)
    return null
  }
  return ev
}

/** 尝试为某区域生成一次事件(低频:引擎周期性调用,按概率) */
export function rollRegionEvent(region: RegionDef): RegionEventState | null {
  const player = usePlayerStore()
  const now = Date.now()
  // 已有未过期事件则不重复
  const cur = player.regionEvent
  if (cur && cur.endsAt > now) return null
  // 低频概率:每小时约一次(配合引擎 30s 周期 → 约 0.85% / 检查)
  if (!rng.chance(0.0085)) return null
  const eventId = rng.pick(REGION_EVENTS.map(e => e.id))
  const durationMin = rng.pick(DURATION_MIN) ?? 60
  const state: RegionEventState = {
    regionId: region.id,
    eventId,
    endsAt: now + durationMin * 60_000
  }
  player.setRegionEvent(state)
  return state
}
