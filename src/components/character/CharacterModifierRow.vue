<template>
  <button
    type="button"
    class="character-modifier-row"
    :class="{ 'is-active': active }"
    :data-character-modifier="row.key"
    :data-character-modifier-capped="row.capped ? '' : undefined"
    :aria-expanded="active"
    @click="emit('select', row.key)"
  >
    <span class="character-modifier-row__name">
      {{ row.label }}
      <span v-if="row.capped" class="character-modifier-row__cap">软</span>
      <span v-if="row.hasOnTop" class="character-modifier-row__on-top">另乘</span>
    </span>
    <span class="character-modifier-row__sources">
      <template v-if="row.sourceCount > 1">{{ row.sourceCount }} 源</template>
      <template v-else-if="row.sourceCount === 1">单源</template>
      <template v-else>合算</template>
    </span>
    <span
      class="character-modifier-row__value tabular"
      :class="row.value > 0 ? 'text-qing' : 'text-cinnabar'"
    >
      {{ row.value > 0 ? "+" : "" }}{{ formatPercent(row.value) }}
    </span>
    <span class="character-modifier-row__arrow" aria-hidden="true">›</span>
  </button>
</template>

<script setup lang="ts">
import type { AnyStatKey } from "@/types";
import type { CharacterModifierRow } from "@/ui/characterDesk";
import { formatPercent } from "@/utils/format";

defineProps<{
  row: CharacterModifierRow;
  active: boolean;
}>();

const emit = defineEmits<{ select: [key: AnyStatKey] }>();
</script>
