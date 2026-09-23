/**
 * 资源状态 —— 灵石(大数)与各类材料。
 *
 * 口径(cap / floor / 整数 / 大数)**不在这个文件里**,在 `core/engineResources` ——
 * 那里是本作对万象引擎资源层的定制:库只认结构,键名、名字与上下限由作品给。
 * 本文件只剩"状态怎么存"与"暴露哪几个动作",动作本身转发到那份定制上。
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { GNum, SmallResourceId } from '@/types'
import { gn, gnZero } from '@/utils/gnum'
import { persistConfig } from '@/utils/storage'
import {
  clampQi,
  gainSmall,
  gainStone,
  hasSmall as ledgerHasSmall,
  hasStone as ledgerHasStone,
  paySmall,
  payStone
} from '@/core/engineResources'

export const useResourcesStore = defineStore(
  'resources',
  () => {
    const spiritStone = ref<GNum>(gnZero())
    const qi = ref(0)
    const wudao = ref(0)
    const herb = ref(0)
    const ore = ref(0)
    const page = ref(0)
    const dust = ref(0)

    // 快赢1(ISS-303):灵草→灵石 兑换额度 —— 每大境界可兑换的灵草株数已用/所属境界。
    // 跨境界由 herbExchangeService.herbExchangeQuotaLeft 判断并自动重置。
    const herbExchangeUsed = ref(0)
    const herbExchangeRealm = ref(0)

    const smallRefs = { wudao, herb, ore, page, dust }

    /** 当前材料与灵气的一份快照(定制层要整本账,而这里按 ref 存) */
    function smallValues(): Record<SmallResourceId | 'qi', number> {
      return { wudao: wudao.value, herb: herb.value, ore: ore.value, page: page.value, dust: dust.value, qi: qi.value }
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

    function addSmall(id: SmallResourceId, n: number): void {
      const r = smallRefs[id]
      r.value = gainSmall(smallValues(), id, n)
    }

    function spendSmall(id: SmallResourceId, n: number): boolean {
      const r = smallRefs[id]
      const paid = paySmall(smallValues(), id, n)
      if (!paid.ok) return false
      r.value = paid.value
      return true
    }

    function hasSmall(id: SmallResourceId, n: number): boolean {
      return ledgerHasSmall(smallValues(), id, n)
    }

    function setQi(v: number, cap: number): void {
      // 灵气可「积余」到标称容量的 QI_BANK_MULT 倍:标称容量只是"满"的界线
      // (灵气充盈加成、突破耗时皆以它为基准),不是硬顶 —— 卡境期间灵气继续累积
      qi.value = clampQi(v, cap)
    }

    /** 存档修复:重建大数字段 */
    function sanitize(): void {
      spiritStone.value = gn(spiritStone.value)
      for (const key of Object.keys(smallRefs) as SmallResourceId[]) {
        const r = smallRefs[key]
        if (!Number.isFinite(r.value)) r.value = 0
      }
      if (!Number.isFinite(qi.value)) qi.value = 0
    }

    return {
      spiritStone,
      qi,
      wudao,
      herb,
      ore,
      page,
      dust,
      herbExchangeUsed,
      herbExchangeRealm,
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
