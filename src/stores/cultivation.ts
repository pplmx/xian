/** 修行状态 —— 功法(习得/装配)与 Buff */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { BuffInstance, CombatSkill, StatMods } from '@/types'
import { persistConfig } from '@/utils/storage'
import { gongfaDef } from '@/data/gongfa'
import { applyBuff, buffModSources, clearNegativeBuffList, pruneBuffList } from '@/core/engineBuffs'
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
        if (lv > 0) fixedLearned[id] = Math.floor(lv)
      }
      learned.value = fixedLearned
      if (typeof mainGongfa.value !== 'string' || !fixedLearned[mainGongfa.value]) mainGongfa.value = null
      subGongfa.value = asStringArray(subGongfa.value).filter(id => fixedLearned[id] !== undefined)
      buffs.value = asArray<BuffInstance>(buffs.value, [], b => !!b && typeof (b as BuffInstance).defId === 'string')
      gongfaBranch.value = asRecord<string>(gongfaBranch.value)
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

    const buffMods = computed<StatMods>(() => {
      // 生效状态的来源清单由库给出(顺序即实例顺序),合并仍是本作的属性汇总口径
      return mergeMods(buffModSources(buffs.value))
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
      buffs.value = applyBuff(buffs.value, defId, now)
    }

    function hasBuff(defId: string): boolean {
      return buffs.value.some(b => b.defId === defId)
    }

    /** 移除过期 Buff,返回是否有变化 */
    function pruneBuffs(now: number): boolean {
      const pruned = pruneBuffList(buffs.value, now)
      if (pruned.changed) buffs.value = pruned.list
      return pruned.changed
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
      clearNegativeBuffs,
      chooseBranch,
      sanitize
    }
  },
  { persist: persistConfig('cultivation') }
)
