<template>
  <div class="batch-spend-ledger" :data-tone="tone">
    <span class="batch-spend-ledger__seal font-kai text-note" aria-hidden="true">{{ seal }}</span>
    <div class="batch-spend-ledger__copy">
      <p class="text-body leading-relaxed text-ink"><slot name="title" /></p>
      <p class="tabular text-note leading-relaxed text-ink-faint"><slot name="detail" /></p>
    </div>
    <span
      class="batch-spend-ledger__status text-note"
      :class="tone === 'cinnabar' ? 'text-cinnabar' : 'text-qing'"
      >{{ status }}</span
    >
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    seal: string;
    status: string;
    tone?: "qing" | "cinnabar";
  }>(),
  { tone: "qing" },
);
</script>

<style scoped>
.batch-spend-ledger {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.35rem 0.6rem;
  margin-top: 0.45rem;
  padding: 0.45rem 0.6rem;
  border: 1px solid rgb(var(--color-ink-rgb) / 0.13);
  border-left: 2px solid rgb(var(--color-qing-rgb) / 0.62);
  border-radius: 2px;
  background: rgb(var(--color-paper-deep-rgb) / 0.42);
}

.batch-spend-ledger[data-tone="cinnabar"] {
  border-left-color: rgb(var(--color-cinnabar-rgb) / 0.62);
}

.batch-spend-ledger__seal {
  display: grid;
  width: 1.35rem;
  height: 1.35rem;
  place-items: center;
  border: 1px solid rgb(var(--color-ink-rgb) / 0.22);
  border-radius: 2px;
  color: rgb(var(--color-ink-soft-rgb));
}

.batch-spend-ledger__copy {
  min-width: 0;
}

.batch-spend-ledger__status {
  white-space: nowrap;
}

@media (max-width: 220px) {
  .batch-spend-ledger {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .batch-spend-ledger__status {
    grid-column: 2;
    justify-self: start;
  }
}
</style>
