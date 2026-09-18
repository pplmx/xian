/**
 * 世界记忆服务(Phase 30.9)—— 区域兴衰 / 宿敌 / 事件余波
 *
 * S1: 区域兴衰 — 玩家长期行为改变区域状态(混乱→稳定→繁盛)
 * S2: 宿敌记忆 — 同一敌人败我 ≥3 次标记宿敌,击败触发雪耻
 * S3: 事件余波 — 已完事件在再次遭遇时产生轻微文本/效果变化
 *
 * 原则:不新增货币 / 不新增境界 / 不改变核心经济 / 不引入高频操作 / 不破坏挂机
 * 全部为「记录与展示」层,数值影响极轻(材料掉落微调、无强制 debuff)
 */
import type { RegionProsperity, RegionRecall, NemesisRecord, EventMemory } from '@/types'
import { usePlayerStore } from '@/stores/player'
import { REGION_MEMORY, REVIVE_AFTER_HOURS } from './engineMemory'

// ============ S1: 区域兴衰 ============

// 档位与门槛住在 core/engineMemory(那是本作对库"档位机"的定制);这里转出,
// 调用方与用例的 import 一行不用改
export { DECAY_HOURS, FLOURISH_HOURS, FLOURISH_WINS, REVIVE_AFTER_HOURS, STABLE_HOURS, STABLE_WINS } from './engineMemory'

/**
 * 妖气复聚的钟 —— 「这片地界多久没被打理了」。
 *
 * 起点是**最后一次与它打交道**:在该地界战斗,或把它镇压下来,两者取较晚的那个。
 *
 * 从前这个钟只在镇压中的地界上走(读 suppressedSince),于是「已靖却从不镇压」的地界
 * 永远不复聚 —— 那里的旧主再也不会回来,首领认知永远停在「眼熟」,而妖气复聚本该是
 * 世界自己的节律,不是镇压的附属品。收成一个起点之后,两种地界同一套节律:
 * 常去的地方妖气聚不起来,放着不管的地方旧主会回来。
 */
export function regionTouchedAt(
  lastFightAt: number | undefined,
  suppressedAt: number | undefined,
  clearedAt: number | undefined
): number {
  // 钟的起点 = 最后一次与它打交道(战斗 / 镇压 / 通关,取最晚)
  return REGION_MEMORY.touchedAt(lastFightAt, suppressedAt, clearedAt)
}

/** 该地界此刻是否该复聚(纯函数;钟没走过 —— 从未打过交道 —— 不算) */
export function isRegionRevived(touchedAt: number, now: number): boolean {
  return REGION_MEMORY.idleBeyond(touchedAt, now, REVIVE_AFTER_HOURS)
}

/**
 * 距妖气复聚(镇压自动解除)还剩多少小时;未镇压或已过期返回 0。
 *
 * 复聚是确定的期限,却从不预告:玩家只会看到某天镇压「突然没了」。
 * 界面据此把期限写成倒计时(与 isReviving 同一个阈值,不另立一份)。
 */
export function hoursUntilRevive(suppressedAt: number | undefined, now: number = Date.now()): number {
  if (suppressedAt === undefined) return 0
  return REGION_MEMORY.hoursUntil(suppressedAt, now, REVIVE_AFTER_HOURS)
}

interface RegionStateInput {
  totalWins: number
  hasSuppressed: boolean
  suppressedAt?: number
  lastActivityAt: number
  now: number
}

/** 派生区域兴衰状态(纯函数,无副作用) */
export function deriveProsperity(input: RegionStateInput): RegionRecall {
  // 守土时长:镇压后守了多久(与「打赢过多少场」是两条路)
  const heldHours = input.suppressedAt !== undefined ? REGION_MEMORY.hoursBetween(input.suppressedAt, input.now) : 0
  // 档位机由库给:多路门槛取先到、没镇压过就停在最低档、太久没来就回落
  const stage = REGION_MEMORY.stateOf({
    count: input.totalWins,
    hours: heldHours,
    idleHours: REGION_MEMORY.hoursBetween(input.lastActivityAt, input.now),
    eligible: input.hasSuppressed
  })
  const prosperity = stage.id as RegionProsperity
  return {
    prosperity,
    since: input.suppressedAt ?? input.lastActivityAt,
    totalWins: input.totalWins,
    hasSuppressed: input.hasSuppressed,
    suppressedAt: input.suppressedAt
  }
}

const PROSPERITY_NAMES: Record<RegionProsperity, string> = {
  chaos: '混乱',
  stable: '稳定',
  flourish: '繁盛'
}

export function prosperityName(p: RegionProsperity): string {
  return PROSPERITY_NAMES[p]
}

/**
 * 区域繁荣度对「被动产出」的微调:
 * 镇压后的安定收益随繁荣度变化 —— 混乱 100% / 稳定 105% / 繁盛 110%。
 * 守满一日由混乱走到繁盛,约 +10%:仍属"轻"(产出大头在层级与时长),
 * 但"守得住"从此看得见回报,不再只是一个 ±2% 的装饰。
 */
export function prosperityYieldMult(p: RegionProsperity): number {
  // 系数写在档位表里(见 core/engineMemory)—— 档位与它的回报在同一处,不会再分家
  return REGION_MEMORY.stages.find(stage => stage.id === p)?.mult ?? 1
}

// ============ S2: 宿敌记忆 ============

/** 标记为宿敌所需败北次数 */
export const NEMESIS_THRESHOLD = 3

/** 由敌人图鉴 id 组装宿敌记录(内部用;首次败北即 lossCount=1) */
function makeNemesis(enemyId: string, enemyName: string, regionId: string, now: number): NemesisRecord {
  return { enemyId, enemyName, regionId, lossCount: 1, lastLossAt: now }
}

/** 记录一次败北:更新宿敌计数,新增或累加 */
export function recordLoss(
  nemeses: NemesisRecord[],
  enemyId: string,
  enemyName: string,
  regionId: string,
  now: number,
  threshold = NEMESIS_THRESHOLD
): { list: NemesisRecord[]; becameNemesis: boolean } {
  const existing = nemeses.find(n => n.enemyId === enemyId)
  if (existing) {
    const next = { ...existing, lossCount: existing.lossCount + 1, lastLossAt: now }
    return {
      list: nemeses.map(n => (n.enemyId === enemyId ? next : n)),
      becameNemesis: next.lossCount >= threshold
    }
  }
  const created = makeNemesis(enemyId, enemyName, regionId, now)
  return {
    list: [...nemeses.slice(-49), created],
    becameNemesis: created.lossCount >= threshold
  }
}

/** 是否已为宿敌(雪耻未完成) */
export function isNemesis(nemeses: NemesisRecord[], enemyId: string): boolean {
  const n = nemeses.find(x => x.enemyId === enemyId)
  return n !== undefined && n.lossCount >= NEMESIS_THRESHOLD && n.avengedAt === undefined
}

/** 首次雪耻:记录击破宿敌时间 */
export function markAvenged(nemeses: NemesisRecord[], enemyId: string, now: number): NemesisRecord[] {
  return nemeses.map(n => (n.enemyId === enemyId && n.avengedAt === undefined ? { ...n, avengedAt: now } : n))
}

// ============ S3: 事件余波 ============

/** 再次遭遇已完成事件时,触发「余波」文案的概率 */
export const AFTERMATH_CHANCE = 0.2

/** 记录事件已完成:更新计数与最近选择 */
export function recordEvent(
  memories: Record<string, EventMemory>,
  eventId: string,
  choiceIdx: number,
  now: number
): Record<string, EventMemory> {
  const cur = memories[eventId]
  const next: EventMemory = cur
    ? { ...cur, times: cur.times + 1, lastAt: now, lastChoiceIdx: choiceIdx }
    : { eventId, times: 1, lastAt: now, lastChoiceIdx: choiceIdx, aftermathSeen: false }
  return { ...memories, [eventId]: next }
}

/** 余波触发条件(纯函数):完成过(≥2次)且已完事件即可 */
export function shouldTriggerAftermath(memories: Record<string, EventMemory>, eventId: string, rand: number): boolean {
  const m = memories[eventId]
  if (!m || m.times < 1) return false
  return rand < AFTERMATH_CHANCE
}

/** 余波文案生成(纯函数) */
export function aftermathText(eventTitle: string, kind: 'good' | 'echo' | 'silence'): string {
  switch (kind) {
    case 'good':
      return `${eventTitle}的痕迹依旧温存,你感到一丝久违的暖意。`
    case 'echo':
      return `${eventTitle}的余韵未散,往事如画卷般在眼前展开。`
    case 'silence':
      return `${eventTitle}已然远去,只余一片寂静。`
  }
}

// ============ 通用查询(供 UI 使用) ============

/** 当前区域兴衰(UI 用) */
export function regionRecallFor(regionId: string): RegionRecall {
  const player = usePlayerStore()
  const stats = player.regionStats[regionId]
  const now = Date.now()
  return deriveProsperity({
    totalWins: stats?.totalFights ?? 0,
    hasSuppressed: player.suppressedRegions.includes(regionId),
    // 「镇压后稳定多久」的起点是镇压时刻,suppressedSince;不能拿最近战斗时间 lastUpdateAt 充数
    // —— 否则镇压后继续刷战,`since` 会随战斗一路前移,「此地已稳定 N 小时」越算越短
    suppressedAt: player.suppressedSince[regionId],
    lastActivityAt: stats?.lastUpdateAt ?? now,
    now
  })
}

// ============ 宿敌残魂(Phase 31.4)============

/** 残魂再现概率(低,3%) */
export const ECHO_GHOST_CHANCE = 0.03

/**
 * 宿敌残魂:已雪耻的宿敌以"历史形态"再现。
 * 纯叙事:改变战报前缀与敌人名冠("残魂"字样),不改属性与奖励。
 * 每次遭遇独立判定,低概率。
 */
export function ghostOf(nemeses: NemesisRecord[], enemyId: string): NemesisRecord | null {
  const n = nemeses.find(x => x.enemyId === enemyId)
  // 只有已雪耻(avengedAt)的宿敌才有残魂形态
  if (!n || n.avengedAt === undefined) return null
  return n
}

/** 残魂战报前缀(叙事) */
export function ghostTitle(n: NemesisRecord): string {
  return `残魂·${n.enemyName}`
}

/** 残魂引导语 (战报第一行前) */
export function ghostLeadIn(n: NemesisRecord): string {
  return `你曾${n.lossCount}败于此,又将此敌斩于剑下。如今一道残魂再度拦路——它似乎仍记得你。`
}
