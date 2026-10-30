<template>
  <section class="folio-ledger-pulse" data-folio-ledger-pulse>
    <LedgerHeader
      :title="title"
      :seal="seal"
      :eyebrow="eyebrow"
      :description="description"
      :meta="meta"
      :score-label="scoreLabel"
      :score-value="scoreValue"
      :score-suffix="scoreSuffix"
      :variant="variant"
    >
      <template v-if="$slots.eyebrow" #eyebrow>
        <slot name="eyebrow" />
      </template>
      <template v-if="$slots.title" #title>
        <slot name="title" />
      </template>
      <template v-if="$slots.description" #description>
        <slot name="description" />
      </template>
      <template v-if="$slots.meta" #meta>
        <slot name="meta" />
      </template>
      <template v-if="$slots.actions" #actions>
        <slot name="actions" />
      </template>
      <template v-if="$slots.identity" #body>
        <slot name="identity" />
      </template>
    </LedgerHeader>

    <div class="folio-ledger-pulse__body">
      <div
        v-if="$slots.tallies"
        class="folio-ledger-pulse__tallies"
        :data-columns="tallyColumns"
        :data-wide-columns="tallyWideColumns"
      >
        <slot name="tallies" />
      </div>
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
import LedgerHeader from "./LedgerHeader.vue";

withDefaults(
  defineProps<{
    title: string;
    seal?: string;
    eyebrow?: string;
    description?: string;
    meta?: string;
    scoreLabel?: string;
    scoreValue?: string | number;
    scoreSuffix?: string;
    variant?: "ledger" | "index";
    tallyColumns?: 1 | 2 | 3 | 4;
    tallyWideColumns?: 1 | 2 | 3 | 4;
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
    tallyColumns: 3,
    tallyWideColumns: 3,
  },
);
</script>
