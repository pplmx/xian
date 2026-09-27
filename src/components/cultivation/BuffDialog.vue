<template>
  <BaseModal :open="def !== undefined" :title="def?.name ?? ''" @close="close">
    <template v-if="def">
      <p class="flex items-center gap-2">
        <span class="grid h-9 w-9 shrink-0 place-items-center rounded-md" :class="isInjury ? 'bg-cinnabar/6 text-cinnabar' : 'bg-jade/6 text-jade'">
          <GameIcon :name="def.icon" :size="17" />
        </span>
        <span>
          <span class="block font-kai text-[14px] tracking-widest text-ink">{{ def.name }}</span>
          <span class="block text-[11px]" :class="isInjury ? 'text-cinnabar' : 'text-jade'">{{ kindText }}</span>
        </span>
      </p>

      <p class="mt-2.5 text-[12px] leading-relaxed text-ink-faint">{{ def.desc }}</p>

      <div class="ink-divider my-3" />

      <p class="mb-1.5 text-[11px] tracking-widest text-ink-faint">效果</p>
      <div class="space-y-1">
        <p v-for="row in modRows" :key="row.key" class="flex justify-between text-[13px]">
          <span class="text-ink-soft">{{ row.label }}</span>
          <span class="tabular" :class="row.good ? 'text-jade' : 'text-cinnabar'">{{ row.text }}</span>
        </p>
      </div>

      <!--
        现效合计:修速四味可同刻叠加(聚灵+星驰+御风+本源 ≈ +265%,见 core/pillValue I2),
        单颗弹窗只报各颗自己的数,叠加吃到几成得自己心算 —— 这里把引擎合并的真值摊开,
        与人物页「丹药与增益」行同一个数(读 cultivation.buffMods,不在弹窗另算)。
      -->
      <p v-if="stackRows.length" class="mb-1 mt-3 text-[10px] tracking-widest text-ink-faint">现效合计 · 所有状态同刻在效</p>
      <div v-if="stackRows.length" class="space-y-1">
        <p v-for="r in stackRows" :key="r.key" class="flex justify-between text-[12px]">
          <span class="text-ink-soft">{{ r.label }}</span>
          <span class="tabular" :class="r.total < 0 ? 'text-cinnabar' : 'text-jade'">{{ formatPercent(r.total) }}</span>
        </p>
      </div>

      <div class="ink-divider my-3" />

      <p class="flex justify-between text-[13px]">
        <span class="text-ink-soft">剩余</span>
        <!-- 剩余每秒在走:定宽(见 utils/format.formatCountdown),否则这一行的数字一直在跳 -->
        <span class="countdown-slot tabular">{{ formatCountdown(remainSec) }}</span>
      </p>
      <p class="mt-1 flex justify-between text-[13px]">
        <span class="text-ink-soft">全程</span>
        <span class="tabular text-ink-faint">{{ formatDuration(def.durationSec) }}</span>
      </p>
      <!--
        有上限的状态(可消耗的那一类)把上限明写出来:这是**明改不是暗改** ——
        玩家看得到"还能攒到多久",也就不会在"吃了没变"时以为坏了(见 core/engineBuffs 的上限口径)。
      -->
      <p v-if="capSec" class="mt-1 flex justify-between text-[13px]">
        <span class="text-ink-soft">至多可攒</span>
        <span class="tabular text-ink-faint">{{ formatDuration(capSec) }}(单颗 {{ capMult }} 倍)</span>
      </p>
      <ProgressBar class="mt-2" :value="remainRatio" :color="isInjury ? 'var(--color-cinnabar)' : 'var(--color-jade)'" :height="6" />
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { useUiStore } from '@/stores/ui'
  import { useCultivationStore } from '@/stores/cultivation'
  import { useNow } from '@/composables/useNow'
  import { buffDef } from '@/data/buffs'
  import { buffCapSec, buffStackHints, CONSUMABLE_BUFF_CAP_MULT } from '@/core/engineBuffs'
  import { STAT_NAMES } from '@/ui/statNames'
  import { formatCountdown, formatDuration, formatPercent } from '@/utils/format'
  import type { AnyStatKey, StatMods } from '@/types'
  import BaseModal from '@/components/common/BaseModal.vue'
  import ProgressBar from '@/components/common/ProgressBar.vue'
  import GameIcon from '@/components/common/GameIcon.vue'

  const ui = useUiStore()
  const cultivation = useCultivationStore()
  const now = useNow()

  const def = computed(() => (ui.buffDetailId ? buffDef(ui.buffDetailId) : undefined))
  const isInjury = computed(() => def.value?.kind === 'injury')
  /** 有上限的状态才显示那一行;**上限是"能攒多久"的封顶**,不是覆盖全程的封顶 */
  const capSec = computed(() => (ui.buffDetailId ? buffCapSec(ui.buffDetailId) : undefined))
  const capMult = CONSUMABLE_BUFF_CAP_MULT

  const KIND_TEXT: Record<string, string> = {
    pill: '丹药之效',
    blessing: '天赐之福',
    injury: '负面状态'
  }
  const kindText = computed(() => KIND_TEXT[def.value?.kind ?? ''] ?? '')

  /** 剩余秒数(随引擎实时递减) */
  const remainSec = computed(() => {
    const id = ui.buffDetailId
    if (!id) return 0
    const inst = cultivation.buffs.find(b => b.defId === id)
    return inst ? Math.max(0, (inst.endsAt - now.value) / 1000) : 0
  })

  const remainRatio = computed(() => {
    const total = def.value?.durationSec ?? 0
    return total > 0 ? Math.min(1, remainSec.value / total) : 0
  })

  /** Buff 词条全为比率;正向增益记绿,减益记朱 */
  const modRows = computed(() =>
    Object.entries(def.value?.mods ?? {}).map(([key, value]) => {
      const v = value as number
      return { key, label: STAT_NAMES[key as AnyStatKey] ?? key, text: formatPercent(v), good: v > 0 }
    })
  )

  /** 现效合计行:词条里还有别的状态在供(叠加/对冲)的,给出合并后的真值 */
  const stackRows = computed(() => {
    const id = ui.buffDetailId
    const def = id ? buffDef(id) : undefined
    if (!def) return []
    return buffStackHints(def.mods as StatMods, cultivation.buffMods).map(r => ({
      key: r.key,
      label: STAT_NAMES[r.key] ?? r.key,
      total: r.total
    }))
  })

  function close(): void {
    ui.buffDetailId = null
  }
</script>
