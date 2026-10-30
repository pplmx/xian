<template>
  <button
    type="button"
    class="folio-ledger-tally"
    :class="{ 'is-active': active }"
    :aria-current="active ? 'page' : undefined"
    @click="emit('select')"
  >
    <span class="folio-ledger-tally__mark" aria-hidden="true">{{ mark }}</span>
    <span class="folio-ledger-tally__label">{{ label }}</span>
    <span class="folio-ledger-tally__value">
      <strong>{{ value }}</strong>
      <span v-if="hasTotal" class="folio-ledger-tally__total">/{{ total }}</span>
    </span>
    <span class="folio-ledger-tally__unit">{{ unit }}</span>
    <span v-if="detail" class="folio-ledger-tally__detail">{{ detail }}</span>
  </button>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    mark: string;
    label: string;
    value: string | number;
    total?: string | number;
    unit?: string;
    detail?: string;
    active?: boolean;
  }>(),
  {
    total: "",
    unit: "",
    detail: "",
    active: false,
  },
);

const emit = defineEmits<{ select: [] }>();
const hasTotal = computed(() => props.total !== "");
</script>
