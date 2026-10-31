<template>
  <component
    :is="interactive ? 'button' : 'div'"
    class="folio-ledger-tally"
    :class="{ 'is-active': active, 'is-interactive': interactive }"
    :type="interactive ? 'button' : undefined"
    :aria-current="interactive && active ? 'page' : undefined"
    @click="interactive && emit('select')"
  >
    <span class="folio-ledger-tally__mark" aria-hidden="true">{{ mark }}</span>
    <span class="folio-ledger-tally__label">{{ label }}</span>
    <span class="folio-ledger-tally__value">
      <strong>{{ value }}</strong>
      <span v-if="hasTotal" class="folio-ledger-tally__total">/{{ total }}</span>
    </span>
    <span class="folio-ledger-tally__unit">{{ unit }}</span>
    <span v-if="detail" class="folio-ledger-tally__detail">{{ detail }}</span>
  </component>
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
    /** 只有需要切换页签的账格才落成按钮；纯读数保持 div，不伪造可点语义。 */
    interactive?: boolean;
  }>(),
  {
    total: "",
    unit: "",
    detail: "",
    active: false,
    interactive: false,
  },
);

const emit = defineEmits<{ select: [] }>();
const hasTotal = computed(() => props.total !== "");
</script>
