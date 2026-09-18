/** 历练状态 —— 区域解锁 / 历练会话 / 待处理事件 / 最近战报 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { AdventureSession, CombatResult } from '@/types'
import { persistConfig } from '@/utils/storage'
import { regionDef, unlockClosure } from '@/data/regions'
import { gn } from '@/utils/gnum'
import { asFiniteNumber, asNumberRecord, asObjectOrNull, asRecord, asStringArray } from '@/utils/saveShape'

export interface LastBattleView {
  enemyName: string
  enemyIcon: string
  /** 敌人定义 id(供适配度展示;旧存档可能缺失) */
  enemyId?: string
  isBoss: boolean
  result: CombatResult
  at: number
  /**
   * 这一场的战利品明细(残页/装备/丹药/法宝;翻倍提示也在内)。
   * 线上一向只把掉落条数记进会话、把文案丢掉,玩家打完看不到自己得了什么。
   * 旧存档没有这一栏,消费方按缺省空数组处理。
   */
  loot?: string[]
}

export const useAdventureStore = defineStore(
  'adventure',
  () => {
    const unlocked = ref<string[]>(['qingyun'])
    /**
     * 本世之界(Phase 34)—— 这一世的世界气象。
     *
     * 由 mortalWorldGen 生成并过四门验收,转世时重新生成。
     * 目前只承载展示:让玩家在打第一场之前就知道「这一世不是上一世那一套」。
     * 实际历练仍走 REGIONS,两者通过 fromId 对应
     */
    const mortalWorld = ref<import('@/core/mortalWorldGen').MortalWorld | null>(null)
    /**
     * 本世已通的路线节点。
     *
     * 与 cleared(旧 REGIONS 通关记录)分开:本世路线的推进只认这里,
     * 转世换界时清空 —— 新的天地要从第一段重新走
     */
    const mortalCleared = ref<string[]>([])
    const cleared = ref<string[]>([])
    /**
     * 各地界的「已靖时刻」—— 妖气从这一刻起重新聚(见 core/regionRevival 的钟)。
     *
     * 为什么要单独记这个:已靖可能发生在**离线结算**里,而离线那条路不写区域统计
     * (见 offline.ts 只推进会话与斩杀,不碰 regionStats),于是"最后一次在当地战斗"
     * 会停在很久以前 —— 拿它当钟,离线斩下的首领回来时立刻就会被判成复聚。
     * 已靖本身就是一次打交道,故给它一个自己的、在 markCleared 里落下的时刻。
     */
    const clearedAt = ref<Record<string, number>>({})
    /**
     * 妖气复聚 —— 当前「旧主归来、尚未再靖」的地界(见 core/regionRevival)。
     *
     * 与 cleared 互斥:一地不在两处。它要落盘,因为"这块地现在还有没有旧主"是
     * 世界状态(玩家下次打开游戏得看到同一件事)。
     */
    const revived = ref<string[]>([])
    /**
     * 各地界的**累计胜场** —— 区域之主的门槛认它,不是"这一趟"的连胜。
     *
     * 玩家实测:涉险(危险 ×2.1)/深入(×1.45)模式几乎刷不到首领,只有安稳能,
     * 于是下一片地界永远不开。根因是门槛绑在**单趟连胜**上 —— 而战败会结束整趟
     * (stopExploration('defeat')),连胜随之归零,难模式里输一场就全赔。
     * 首领该是"对这一地界熟到能叩门",不是"一趟不输" —— 故改成按地界累计。
     * 与 mortalCleared 一样随换世清空:换了天地,旧地界的门路要重新蹚。
     */
    const regionWins = ref<Record<string, number>>({})
    const session = ref<AdventureSession | null>(null)
    const pendingEventId = ref<string | null>(null)
    const pendingEventSince = ref(0)
    const seenOnceEvents = ref<string[]>([])
    const lastBattle = ref<LastBattleView | null>(null)
    /** Phase 30.9 世界记忆:已完成事件的结果记录 */
    const eventMemories = ref<Record<string, import('@/types').EventMemory>>({})

    /** 存档修复:历练会话/解锁表/事件记忆被写坏会让历练页在渲染期抛错 */
    function sanitize(): void {
      unlocked.value = asStringArray(unlocked.value)
      if (unlocked.value.length === 0) unlocked.value = ['qingyun']
      mortalCleared.value = asStringArray(mortalCleared.value)
      cleared.value = asStringArray(cleared.value)
      /**
       * 复聚表:只留表上认得、且此刻确实没靖的那些。两者同时出现(坏档或旧版本
       * 写坏)时以 cleared 为准 —— 「已靖」是更硬的事实,复聚只是它的反面。
       */
      revived.value = asStringArray(revived.value).filter(id => regionDef(id) !== undefined && !cleared.value.includes(id))
      // 已靖时刻:只留此刻确实已靖的那些(与 cleared 同一份事实,不许多出一份)
      const clearedAtRaw = asNumberRecord(clearedAt.value, 0)
      const clearedAtNext: Record<string, number> = {}
      for (const id of cleared.value) {
        const at = clearedAtRaw[id]
        if (at !== undefined && at > 0) clearedAtNext[id] = at
      }
      clearedAt.value = clearedAtNext
      /**
       * 前置已靖 → 此地已开:补票(见 data/regions.unlockClosure)。
       *
       * 解锁从前是**事件式**的(击败那一刻写一次),而扩界会把新地界挂在早已被清掉的
       * 前置之后 —— 那种存档再也没机会等到那一次事件(首领已靖不复现)。放在这里补,
       * 是因为读档修形是唯一的入口:开局(engine.start → sanitizeOfflineInputs)与
       * 导入存档都会过它,玩家不需要做任何事。
       */
      applyUnlockClosure()
      // 累计胜场:形状不对就修成"全是有限非负数",坏值一律归零(它决定首领何时出现)
      const winsRaw = asRecord<unknown>(regionWins.value)
      const wins: Record<string, number> = {}
      for (const [id, n] of Object.entries(winsRaw)) {
        const v = Math.floor(asFiniteNumber(n, 0, 0))
        if (v > 0) wins[id] = v
      }
      regionWins.value = wins
      session.value = asObjectOrNull<AdventureSession>(session.value)
      /**
       * 历练会话是引擎每 tick 都要读的活状态:endsAt/nextBattleAt 若为 NaN,
       * 历练会永远不停(或立刻结束);regionId 认不得则整场都取不到区域。
       * 故除形状外,值也要修 —— 认不得的区域直接结束会话,不硬撑。
       */
      if (session.value) {
        const s = session.value
        const regionOk = !!regionDef(s.regionId)
        const endsAt = asFiniteNumber(s.endsAt, 0, 0)
        if (!regionOk || endsAt <= 0) {
          session.value = null
        } else {
          session.value = {
            ...s,
            mode: s.mode === 'deep' || s.mode === 'risky' ? s.mode : 'normal',
            startedAt: asFiniteNumber(s.startedAt, 0, 0),
            endsAt,
            nextBattleAt: asFiniteNumber(s.nextBattleAt, 0, 0),
            wins: Math.floor(asFiniteNumber(s.wins, 0, 0)),
            losses: Math.floor(asFiniteNumber(s.losses, 0, 0)),
            events: Math.floor(asFiniteNumber(s.events, 0, 0)),
            itemGain: Math.floor(asFiniteNumber(s.itemGain, 0, 0)),
            // 两个 GNum 累加器经 gn() 归一:null/原始数字/坏对象一律归零。
            // 漏掉这步的话,损坏档首胜时 exploration 的 add(s.stoneGain,…) 会在 .m 上炸,
            // 被 tickSafe 吞掉后每场胜利都抛、历练永久卡死
            stoneGain: gn(s.stoneGain),
            expGain: gn(s.expGain)
          }
        }
      }
      pendingEventId.value = typeof pendingEventId.value === 'string' ? pendingEventId.value : null
      pendingEventSince.value = asFiniteNumber(pendingEventSince.value, 0, 0)
      seenOnceEvents.value = asStringArray(seenOnceEvents.value)
      // 战报的 loot 是新增栏:形状不对就清成空表,别让损坏档在战报渲染里炸
      const lb = asObjectOrNull<LastBattleView>(lastBattle.value)
      lastBattle.value = lb ? { ...lb, loot: lb.loot === undefined ? undefined : asStringArray(lb.loot) } : null
      eventMemories.value = asRecord(eventMemories.value)
      mortalWorld.value = asObjectOrNull(mortalWorld.value)
    }

    const sessionActive = computed(() => session.value !== null)
    const currentRegion = computed(() => (session.value ? regionDef(session.value.regionId) : undefined))

    function setSession(s: AdventureSession | null): void {
      session.value = s
    }

    /**
     * 按不变量补齐解锁表(前置已靖 → 此地已开),返回**这一次新开的**那些。
     *
     * 在线(击败前置之首)与读档(补票)两条路都过这一个方法 —— 规则只写一处,
     * 免得下次扩界时其中一条又忘了走(那正是这次这个 bug 的形状)。
     */
    function applyUnlockClosure(): string[] {
      const before = new Set(unlocked.value)
      const next = unlockClosure(unlocked.value, cleared.value)
      unlocked.value = next
      return next.filter(id => !before.has(id))
    }

    function markCleared(regionId: string): boolean {
      if (cleared.value.includes(regionId)) return false
      cleared.value = [...cleared.value, regionId]
      // 已靖即起钟:妖气从这一刻重新聚(离线斩首也走这里,故离线也认得这个起点)
      clearedAt.value = { ...clearedAt.value, [regionId]: Date.now() }
      // 再靖:这处地界的「妖气复聚」随之收掉(它不再等旧主归来,而是已经归过了)
      if (revived.value.includes(regionId)) revived.value = revived.value.filter(id => id !== regionId)
      return true
    }

    /**
     * 妖气复聚:该地界不再「已靖」,旧主归来(见 core/regionRevival)。
     *
     * 只动这两项:镇压资格(suppressQualified)是永久的 —— 松开镇压由 core 那边
     * 单独做,玩家一键就能把收益接回来,复聚不构成对挂机的惩罚。
     */
    function markRevived(regionId: string): boolean {
      if (revived.value.includes(regionId)) return false
      cleared.value = cleared.value.filter(id => id !== regionId)
      const nextAt = { ...clearedAt.value }
      delete nextAt[regionId]
      clearedAt.value = nextAt
      revived.value = [...revived.value, regionId]
      return true
    }

    /** 记一场胜 —— 区域之主的门槛按这个累计,与"这一趟"无关 */
    function addRegionWins(regionId: string, n = 1): void {
      if (n <= 0) return
      regionWins.value = { ...regionWins.value, [regionId]: (regionWins.value[regionId] ?? 0) + n }
    }

    /** 某地界的累计胜场(界面与结算都读它,不各自再数一遍) */
    function winsIn(regionId: string): number {
      return regionWins.value[regionId] ?? 0
    }

    function setPendingEvent(id: string | null, now: number): void {
      pendingEventId.value = id
      pendingEventSince.value = id ? now : 0
    }

    function markEventSeen(id: string): void {
      if (!seenOnceEvents.value.includes(id)) {
        seenOnceEvents.value = [...seenOnceEvents.value, id]
      }
    }

    function recordBattle(view: LastBattleView): void {
      lastBattle.value = view
    }

    function setMortalWorld(w: import('@/core/mortalWorldGen').MortalWorld | null): void {
      mortalWorld.value = w
      // 换界即换路:本世进度不跨界继承
      mortalCleared.value = []
      // 门路也是本世的:换一片天地,旧地界的叩门资格不再作数
      regionWins.value = {}
    }

    /** 标记本世某节点已通;已通过则返回 false */
    function markNodeCleared(nodeId: string): boolean {
      if (mortalCleared.value.includes(nodeId)) return false
      mortalCleared.value = [...mortalCleared.value, nodeId]
      return true
    }

    return {
      mortalWorld,
      mortalCleared,
      regionWins,
      setMortalWorld,
      markNodeCleared,
      unlocked,
      cleared,
      clearedAt,
      revived,
      session,
      pendingEventId,
      pendingEventSince,
      seenOnceEvents,
      lastBattle,
      eventMemories,
      sessionActive,
      currentRegion,
      setSession,
      applyUnlockClosure,
      markCleared,
      markRevived,
      addRegionWins,
      winsIn,
      setPendingEvent,
      markEventSeen,
      recordBattle,
      sanitize
    }
  },
  { persist: persistConfig('adventure') }
)
