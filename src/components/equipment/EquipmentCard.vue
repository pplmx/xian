<template>
  <button
    class="relative aspect-square rounded-md border transition-transform active:scale-95"
    :style="{ borderColor: colorWithAlpha(quality.color, 0.33), background: colorWithAlpha(quality.color, 0.06) }"
    :data-uid="props.item.uid"
    :aria-label="label"
    @click="emit('open', props.item.uid)"
  >
    <!-- 角标:佩戴 / 上锁 -->
    <span v-if="props.equipped" class="absolute left-0.5 top-0.5 font-kai text-[8px] leading-none text-jade">佩</span>
    <span v-if="props.item.locked" class="absolute right-0.5 top-0.5 leading-none text-ink-faint">
      <GameIcon name="lock" :size="8" />
    </span>
    <!-- 共鸣件:方格背包里也得看得出这一件拴着一条机制(两件才亮,见 core/equipSet) -->
    <span
      v-if="setName"
      class="absolute bottom-0.5 left-1 font-kai text-[8px] leading-none text-violet-ink"
      :title="`共鸣「${setName}」`"
    >
      共
    </span>
    <!-- 新入包、还没开过背包看它:顶部中央挂「新」(佩在左、锁在右,这格谁都不占) -->
    <span v-if="isNew" class="absolute left-1/2 top-0.5 -translate-x-1/2 font-kai text-[8px] leading-none text-cinnabar animate-new-pop">
      新
    </span>

    <!-- 主图标 -->
    <span class="flex h-full w-full flex-col items-center justify-center gap-0.5 px-1">
      <GameIcon :name="template?.icon ?? 'sword'" :size="20" :style="{ color: quality.color }" />
      <span class="w-full truncate text-center text-[9px] leading-tight" :style="{ color: quality.color }">
        {{ template?.name ?? '?' }}
      </span>
    </span>

    <!-- 强化等级:右下角,格子背包的惯例位置 -->
    <span v-if="props.item.level > 0" class="absolute bottom-0.5 right-1 text-[9px] leading-none text-gold-ink tabular">
      +{{ props.item.level }}
    </span>

    <!-- 玩家标记:同名装备按流派区分(详情弹窗里写,见 noteDraft)。 -->
    <span
      v-if="props.item.note"
      class="absolute bottom-0.5 left-6 right-6 truncate text-center text-[8px] leading-none text-ink-faint"
    >
      {{ props.item.note }}
    </span>
  </button>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import type { EquipmentInstance } from '@/types'
  import { equipmentTemplate } from '@/data/equipment'
  import { qualityDef } from '@/data/qualities'
  import { colorWithAlpha } from '@/ui/colorVar'
  import { equipSetDef } from '@/core/equipSet'
  import { useInventoryStore } from '@/stores/inventory'
  import GameIcon from '@/components/common/GameIcon.vue'

  const props = defineProps<{ item: EquipmentInstance; equipped?: boolean }>()
  const emit = defineEmits<{ open: [uid: string] }>()

  const inventory = useInventoryStore()
  /** 顶部中央那枚「新」:新入包、还没开过背包看它(账在 inventory store,见 inventorySeen.spec) */
  const isNew = computed(() => inventory.isNewItem(props.item.uid))

  const template = computed(() => equipmentTemplate(props.item.templateId))
  const quality = computed(() => qualityDef(props.item.quality))
  const setName = computed(() => (template.value?.set ? equipSetDef(template.value.set)?.name ?? '' : ''))
  /** Visible name is truncated; lock / worn / set marks are 8px chips. Spell the full card. */
  const label = computed(() => {
    const bits = [`${quality.value.name}·${template.value?.name ?? '未知'}`]
    if (props.item.level > 0) bits.push(`+${props.item.level}`)
    if (props.equipped) bits.push('佩戴中')
    if (props.item.locked) bits.push('已锁定')
    if (setName.value) bits.push(`共鸣${setName.value}`)
    if (props.item.note) bits.push(`标记${props.item.note}`)
    return bits.join(' ')
  })
</script>
