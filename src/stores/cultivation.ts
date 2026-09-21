/** 修行状态 —— 功法(习得/装配)与 Buff */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { BuffInstance, CombatSkill, StatMods } from '@/types'
import { persistConfig } from '@/utils/storage'
import { gongfaDef } from '@/data/gongfa'
import { applyBuff, activeBuffsOf, clearNegativeBuffList, pruneBuffList } from '@/core/engineBuffs'
import { gongfaBranchDef } from '@/data/gongfaBranches'
import { GONGFA_SYSTEM } from '@/core/engineWorld'
import { mergeMods } from '@/core/statsCalc'
import { asArray, asNumberRecord, asRecord, asStringArray } from '@/utils/saveShape'

/** 功法在某等级下的属性 */
export function gongfaModsAt(id: string, level: number): StatMods {
  // 成长曲线由公共库算(见 core/engineWorld 的 GONGFA_SYSTEM):
  // 第 N 级 = 基础词条 + 每级词条 × (N-1),只有每级键在 1 级时也会以 0 出现
  return GONGFA_SYSTEM.modsAt(id, level) as StatMods
}

export const useCultivationStore = defineStore(
  'cultivation',
  () => {
    /** 已习得功法:id → 等级 */
    const learned = ref<Record<string, number>>({})
    const mainGongfa = ref<string | null>(null)
    const subGongfa = ref<string[]>([])
    const buffs = ref<BuffInstance[]>([])
    /** Phase 31 A3:功法悟道分支(gongfaId → branchId,满级后择一) */
    const gongfaBranch = ref<Record<string, string>>({})

    /**
     * 存档修复:功法表/分支表被写坏时,属性汇总会在渲染期 Object.entries(null) 抛错。
     * 形状不对就修回可用值 —— 见 utils/saveShape 与 storeResilience.spec。
     */
    function sanitize(): void {
      const fixedLearned: Record<string, number> = {}
      for (const [id, lv] of Object.entries(asNumberRecord(learned.value, 0))) {
        if (lv > 0 && gongfaDef(id)) fixedLearned[id] = Math.floor(lv)
      }
      learned.value = fixedLearned
      if (typeof mainGongfa.value !== 'string' || !fixedLearned[mainGongfa.value]) mainGongfa.value = null
      subGongfa.value = asStringArray(subGongfa.value).filter(id => fixedLearned[id] !== undefined)
      buffs.value = asArray<BuffInstance>(buffs.value, [], b => !!b && typeof (b as BuffInstance).defId === 'string')
      const nextBranch: Record<string, string> = {}
      for (const [gid, bid] of Object.entries(asRecord<string>(gongfaBranch.value))) {
        const def = gongfaBranchDef(bid)
        if (def && def.gongfaId === gid && fixedLearned[gid]) nextBranch[gid] = bid
      }
      gongfaBranch.value = nextBranch
    }

    const gongfaMods = computed<StatMods>(() => {
      const sources: StatMods[] = []
      if (mainGongfa.value && learned.value[mainGongfa.value]) {
        sources.push(gongfaModsAt(mainGongfa.value, learned.value[mainGongfa.value]!))
      }
      for (const id of subGongfa.value) {
        if (learned.value[id]) sources.push(gongfaModsAt(id, learned.value[id]!))
      }
      // Phase 31 A3:悟道分支追加词条(选过的功法)
      for (const [gid, bid] of Object.entries(gongfaBranch.value)) {
        const def = gongfaBranchDef(bid)
        if (def?.gongfaId === gid) sources.push(def.mods)
      }
      return mergeMods(sources)
    })

    /**
     * 状态读取用的时钟 —— 由**心跳**推进(引擎每拍 `pruneBuffs(now)`、施加状态时也校正一次)。
     * 为什么不在这里读 `Date.now()`:computed 只认响应式依赖,读一个不随心跳变化的
     * 时间戳会让它"只记住第一次算出的结果",到期的状态一直挂在身上;而在 getter 里
     * 顺手 `useGameStore()` 之类的懒创建会往响应式系统里写东西,把整条属性链打成"每次读都重算"。
     *
     * 判据是"到期时刻 > 时钟",与心跳剪枝共用库里的同一处判定
     * (ISS-231:从前这里问的是"列表里有没有",到期到下一拍之间那一秒仍会被算进属性)。
     */
    const buffClock = ref(Date.now())

    /** 此刻真正生效的状态(过期即散) */
    const activeBuffs = computed(() => activeBuffsOf(buffs.value, buffClock.value))

    const buffMods = computed<StatMods>(() => {
      // 生效状态的来源清单由库给出(顺序即实例顺序),合并仍是本作的属性汇总口径
      return mergeMods(activeBuffs.value.map(view => view.def.mods as StatMods))
    })

    /** 主修功法附带的战斗技能 */
    const mainSkill = computed<CombatSkill | null>(() => {
      if (!mainGongfa.value) return null
      const def = gongfaDef(mainGongfa.value)
      return def?.skill ? { ...def.skill } : null
    })

    function learn(id: string): boolean {
      if (learned.value[id]) return false
      learned.value = { ...learned.value, [id]: 1 }
      const def = gongfaDef(id)
      if (def?.type === 'main' && !mainGongfa.value) mainGongfa.value = id
      return true
    }

    function upgrade(id: string): void {
      const lv = learned.value[id]
      if (!lv) return
      learned.value = { ...learned.value, [id]: lv + 1 }
    }

    function equipMain(id: string): void {
      if (learned.value[id]) mainGongfa.value = id
    }

    function toggleSub(id: string, maxSlots: number): boolean {
      if (subGongfa.value.includes(id)) {
        subGongfa.value = subGongfa.value.filter(x => x !== id)
        return true
      }
      if (subGongfa.value.length >= maxSlots) return false
      if (!learned.value[id]) return false
      subGongfa.value = [...subGongfa.value, id]
      return true
    }

    /**
     * 施加状态 —— 叠时长的口径(而不是"取较长者"的刷新)已搬进公共库,
     * 本作只保留内容与换算(`core/engineBuffs`):同一状态重复施加时,
     * 「药力化开」承诺的时长足额兑现;已过期的实例以 now 为基准。
     */
    function addBuff(defId: string, now: number): void {
      buffClock.value = now
      buffs.value = applyBuff(buffs.value, defId, now)
    }

    function hasBuff(defId: string): boolean {
      return activeBuffs.value.some(view => view.def.id === defId)
    }

    /** 移除过期 Buff,返回是否有变化 */
    function pruneBuffs(now: number): boolean {
      const pruned = pruneBuffList(buffs.value, now)
      if (pruned.changed) buffs.value = pruned.list
      // 身上有状态才推进时钟:没状态时不必让整条属性链每秒重算
      if (buffs.value.length > 0) buffClock.value = now
      return pruned.changed
    }

    /** Slide every instance's endsAt (engine pause: wall clocks must not expire). */
    function shiftBuffEnds(pausedMs: number): void {
      if (pausedMs <= 0 || buffs.value.length === 0) return
      buffs.value = buffs.value.map(b => ({ ...b, endsAt: b.endsAt + pausedMs }))
    }

    function clearNegativeBuffs(): void {
      buffs.value = clearNegativeBuffList(buffs.value)
    }

    // Phase 31 A3:选择功法悟道分支(满级后一次,不可改)
    function chooseBranch(gongfaId: string, branchId: string): boolean {
      const full = (learned.value[gongfaId] ?? 0) >= (gongfaDef(gongfaId)?.maxLevel ?? 9)
      const def = gongfaBranchDef(branchId)
      if (!full || !def || def.gongfaId !== gongfaId) return false
      if (gongfaBranch.value[gongfaId]) return false
      gongfaBranch.value = { ...gongfaBranch.value, [gongfaId]: branchId }
      return true
    }

    return {
      learned,
      mainGongfa,
      subGongfa,
      buffs,
      activeBuffs,
      gongfaBranch,
      gongfaMods,
      buffMods,
      mainSkill,
      learn,
      upgrade,
      equipMain,
      toggleSub,
      addBuff,
      hasBuff,
      pruneBuffs,
      shiftBuffEnds,
      clearNegativeBuffs,
      chooseBranch,
      sanitize
    }
  },
  { persist: persistConfig('cultivation') }
)
