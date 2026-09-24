/**
 * 资源状态 —— 灵石(大数)与各类材料。
 *
 * 口径(cap / floor / 整数 / 大数)**不在这个文件里**,在 `core/engineResources` ——
 * 那里是本作对万象引擎资源层的定制:库只认结构,键名、名字与上下限由作品给。
 * 本文件只剩"状态怎么存"与"暴露哪几个动作",动作本身转发到那份定制上。
 *
 * 灵草(ISS-306):从单标量变**五品分档**(凡→道,见 data/herbGrades)。
 *   · `herbs` 是真实存量,`herb` 只是只读汇总(Σ 五档,给旧展示位用);
 *   · 收货默认按玩家当前境界定品(`grantHerbs(n)`);按方子购/耗则显式指品。
 */
import { defineStore } from 'pinia'
import { computed, ref, type Ref } from 'vue'
import type { GNum, SmallResourceId } from '@/types'
import { gn, gnZero } from '@/utils/gnum'
import { persistConfig } from '@/utils/storage'
import { HERB_GRADES, herbGradeOfMajor, type HerbGrade } from '@/data/herbGrades'
import {
  clampQi,
  gainSmall,
  gainStone,
  hasSmall as ledgerHasSmall,
  hasStone as ledgerHasStone,
  paySmall,
  payStone
} from '@/core/engineResources'
import { usePlayerStore } from './player'

function zeroHerbs(): Record<HerbGrade, number> {
  return { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
}

export const useResourcesStore = defineStore(
  'resources',
  () => {
    const spiritStone = ref<GNum>(gnZero())
    const qi = ref(0)
    /** 灵草五品存量:凡品 → 道品,各记各的 */
    const herbs = ref<Record<HerbGrade, number>>(zeroHerbs())
    const ore = ref(0)
    const page = ref(0)
    const dust = ref(0)
    /** 悟道点 —— 归入 smalls,是另一种资源,不在五品灵草里 */
    const wudao = ref(0)

    /** 只读汇总:全部品阶的灵草总和 —— 给旧展示位/读型消费者,不做写入 */
    const herb = computed(() => HERB_GRADES.reduce((s, g) => s + herbs.value[g], 0))

    /** 非灵草的 smalls(灵草走五品,不在这张账上) */
    const smallRefs = { wudao, ore, page, dust } as Record<Exclude<SmallResourceId, 'herb'>, Ref<number>>

    /** 当前材料与灵气的一份快照(定制层要整本账,而这里按 ref 存;灵草不在其中) */
    function smallValues(): Record<Exclude<SmallResourceId, 'herb'> | 'qi', number> {
      return { wudao: wudao.value, ore: ore.value, page: page.value, dust: dust.value, qi: qi.value }
    }

    function addStone(v: GNum): void {
      spiritStone.value = gainStone(spiritStone.value, v)
    }

    function spendStone(v: GNum): boolean {
      const paid = payStone(spiritStone.value, v)
      if (!paid.ok) return false
      spiritStone.value = paid.stone
      return true
    }

    function hasStone(v: GNum): boolean {
      return ledgerHasStone(spiritStone.value, v)
    }

    // ---- 灵草(五品) ----

    function herbOf(grade: HerbGrade): number {
      return herbs.value[grade]
    }

    function hasHerbs(grade: HerbGrade, n: number): boolean {
      return herbs.value[grade] >= n
    }

    /** 收草:不传品阶默认按玩家当前境界定品(就地捡的草 = 该界的草) */
    function grantHerbs(n: number, grade?: HerbGrade): void {
      const g = grade ?? herbGradeOfMajor(usePlayerStore().major)
      herbs.value = { ...herbs.value, [g]: herbs.value[g] + Math.max(0, n) }
    }

    /** 付草:某品阶够就扣、不够原样返回 */
    function spendHerbs(grade: HerbGrade, n: number): boolean {
      if (!Number.isFinite(n) || n < 0) return false
      if (hasHerbs(grade, n)) {
        herbs.value = { ...herbs.value, [grade]: herbs.value[grade] - n }
        return true
      }
      return false
    }

    // ---- 材料 / 点数(非灵草这类分级项走引擎账本) ----

    function addSmall(id: SmallResourceId, n: number): void {
      if (id === 'herb') {
        grantHerbs(n)
        return
      }
      const r = smallRefs[id]
      r.value = gainSmall(smallValues(), id, n)
    }

    function spendSmall(id: SmallResourceId, n: number): boolean {
      if (id === 'herb') return spendHerbs(herbGradeOfMajor(usePlayerStore().major), n)
      const r = smallRefs[id]
      const paid = paySmall(smallValues(), id, n)
      if (!paid.ok) return false
      r.value = paid.value
      return true
    }

    function hasSmall(id: SmallResourceId, n: number): boolean {
      if (id === 'herb') return hasHerbs(herbGradeOfMajor(usePlayerStore().major), n)
      return ledgerHasSmall(smallValues(), id, n)
    }

    function setQi(v: number, cap: number): void {
      // 灵气可「积余」到标称容量的 QI_BANK_MULT 倍:标称容量只是"满"的界线
      // (灵气充盈加成、突破耗时皆以它为基准),不是硬顶 —— 卡境期间灵气继续累积
      qi.value = clampQi(v, cap)
    }

    /** 存档修复:重建大数字段、补齐五品草的缺档、清非法值 */
    function sanitize(): void {
      spiritStone.value = gn(spiritStone.value)
      const dirty = { ...herbs.value }
      for (const g of HERB_GRADES) {
        const v = dirty[g]
        if (!Number.isFinite(v) || v < 0) dirty[g] = 0
        else dirty[g] = Math.floor(v)
      }
      herbs.value = dirty
      for (const key of Object.keys(smallRefs) as Exclude<SmallResourceId, 'herb'>[]) {
        const r = smallRefs[key]
        if (!Number.isFinite(r.value) || r.value < 0) r.value = 0
      }
      if (!Number.isFinite(qi.value)) qi.value = 0
    }

    return {
      spiritStone,
      qi,
      herbs,
      herb,
      ore,
      page,
      dust,
      wudao,
      herbOf,
      hasHerbs,
      grantHerbs,
      spendHerbs,
      addStone,
      spendStone,
      hasStone,
      addSmall,
      spendSmall,
      hasSmall,
      setQi,
      sanitize
    }
  },
  { persist: persistConfig('resources') }
)
