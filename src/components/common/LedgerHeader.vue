<template>
  <header class="folio-ledger-head" data-folio-ledger-head :data-variant="variant">
    <span v-if="seal && variant !== 'index'" class="folio-ledger-head__seal" aria-hidden="true">
      {{ seal }}
    </span>
    <div class="folio-ledger-head__identity">
      <p v-if="eyebrow" class="folio-ledger-head__eyebrow">{{ eyebrow }}</p>
      <h2 class="folio-ledger-head__title">{{ title }}</h2>
      <p v-if="description" class="folio-ledger-head__description">{{ description }}</p>
      <slot name="body" />
    </div>
    <div v-if="meta || hasScore || $slots.meta || $slots.actions" class="folio-ledger-head__aside">
      <p v-if="meta" class="folio-ledger-head__meta tabular">{{ meta }}</p>
      <p v-if="hasScore" class="folio-ledger-head__score tabular">
        <span v-if="scoreLabel">{{ scoreLabel }}</span>
        <strong>{{ scoreValue }}</strong>
        <span v-if="scoreSuffix">{{ scoreSuffix }}</span>
      </p>
      <slot name="meta" />
      <slot name="actions" />
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    title: string;
    seal?: string;
    eyebrow?: string;
    description?: string;
    meta?: string;
    scoreLabel?: string;
    scoreValue?: string | number;
    scoreSuffix?: string;
    /** index 用于长列表页内小账头；ledger 用于一张账的总案头 */
    variant?: "ledger" | "index";
  }>(),
  {
    seal: "",
    eyebrow: "",
    description: "",
    meta: "",
    scoreLabel: "",
    scoreValue: "",
    scoreSuffix: "",
    variant: "ledger",
  },
);

const hasScore = computed(() => props.scoreValue !== "");
</script>
