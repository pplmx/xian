<template>
  <BaseModal :open="view !== null" :title="view?.title ?? '数值'" @close="close">
    <template v-if="view">
      <!--
        一行一个读数,而不是"现有 / 所需"挤在同一行:
        大数在窄屏上本来就要折行,两行摆开(现有在上、所需在下)才看得清谁是谁,
        也才留得住每三位一个逗号的完整数字。
      -->
      <div class="space-y-2">
        <div v-for="(row, i) in view.rows" :key="i" class="rounded-md bg-paper-deep/60 px-3 py-2">
          <p class="flex items-baseline justify-between gap-2">
            <span class="shrink-0 text-[11px] text-ink-faint">{{ row.label }}</span>
            <span v-if="row.text" class="shrink-0 text-[13px] text-ink tabular">{{ row.text }}</span>
            <span v-else class="shrink-0 text-[11px] text-ink-ghost tabular">{{ formatGN(row.value!) }}</span>
          </p>
          <p v-if="row.text" class="mt-0.5 text-right text-[10px] leading-snug text-ink-faint">
            {{ row.hint ?? '由当前速率推算,会随构筑与加成变化' }}
          </p>
          <p v-else class="mt-0.5 break-all text-right font-kai text-[15px] leading-snug text-ink tabular">
            {{ row.value === undefined ? '' : formatExact(row.value) }}
          </p>
          <p v-if="row.hint && !row.text" class="mt-0.5 text-right text-[10px] text-ink-faint">{{ row.hint }}</p>
          <!--
            大数的"量级"读数:到了兆/京以上,玩家真正能横比的是数量级,而不是第几位数字。
            只在数够大时补这一句(小数字给了只会变成噪音)。
          -->
          <p v-else-if="row.value !== undefined && magnitudeOf(row.value)" class="mt-0.5 text-right text-[10px] text-ink-ghost tabular">
            {{ magnitudeOf(row.value!) }}
          </p>
        </div>
      </div>
      <p v-if="view.note" class="mt-2 rounded-md bg-ink/4 px-2.5 py-2 text-[11px] leading-relaxed text-ink-soft">
        {{ view.note }}
      </p>
      <!--
        诚实说明:大数只带约 15 位有效数字,再往后是量级而不是精度。
        不写这句的话,那串尾部的 0 会被读成"精确到个位" —— 那是骗人。
      -->
      <p class="mt-2 text-[10px] leading-relaxed text-ink-ghost">
        数值以有效数字存储(约 15 位);超过 24 位的改用科学计数法,不再补零充当精度。
        同一页里的小号数字是缩写(万/亿/兆/京…),方便横比。
      </p>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { useUiStore } from '@/stores/ui'
  import { formatExact, formatGN, formatScientific } from '@/utils/format'
  import { gn } from '@/utils/gnum'
  import type { GNum } from '@/types'
  import BaseModal from '@/components/common/BaseModal.vue'

  const ui = useUiStore()
  const view = computed(() => ui.numberDetail)

  /** 数够大(兆以上)时补一句科学计数法 —— 量级才是能横比的那个量 */
  function magnitudeOf(v: GNum | number): string | null {
    const g = gn(v)
    return g.m !== 0 && g.e >= 12 ? formatScientific(g) : null
  }

  function close(): void {
    ui.numberDetail = null
  }
</script>
