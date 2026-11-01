<template>
  <header class="opening-chapter-head">
    <span class="opening-chapter-head__index" aria-hidden="true">{{ index }}</span>
    <div class="opening-chapter-head__copy">
      <p class="opening-chapter-head__eyebrow">{{ eyebrow }}</p>
      <h2 class="opening-chapter-head__title">{{ title }}</h2>
      <p class="opening-chapter-head__hint">{{ hint }}</p>
    </div>
    <p v-if="fact" class="opening-chapter-head__fact tabular">{{ fact }}</p>
  </header>
</template>

<script setup lang="ts">
defineProps<{
  index: string;
  eyebrow: string;
  title: string;
  hint: string;
  fact?: string;
}>();
</script>

<style scoped>
.opening-chapter-head {
  display: grid;
  min-width: 0;
  grid-template-columns: 1.42rem minmax(0, 1fr) auto;
  align-items: start;
  gap: 0.22rem 0.62rem;
  border-top: 1px solid rgb(var(--color-qing-rgb) / 0.36);
  padding: 0.68rem 0 0.56rem;
}

.opening-chapter-head__index {
  display: grid;
  width: 1.35rem;
  height: 1.35rem;
  place-items: center;
  border-left: 2px solid rgb(var(--color-cinnabar-rgb) / 0.72);
  color: var(--color-cinnabar);
  font-family: var(--font-kai);
  font-size: var(--type-note);
  line-height: 1;
}

.opening-chapter-head__copy {
  display: grid;
  min-width: 0;
  gap: 0.08rem;
}

.opening-chapter-head__eyebrow {
  color: var(--color-ink-faint);
  font-size: var(--type-note);
  letter-spacing: 0.16em;
  line-height: 1.45;
}

.opening-chapter-head__title {
  color: var(--color-ink);
  font-family: var(--font-kai);
  font-size: var(--type-heading);
  font-weight: 400;
  letter-spacing: 0.08em;
  line-height: 1.42;
}

.opening-chapter-head__hint {
  color: var(--color-ink-faint);
  font-size: var(--type-note);
  line-height: 1.58;
}

.opening-chapter-head__fact {
  justify-self: end;
  color: var(--color-qing);
  font-family: var(--font-kai);
  font-size: var(--type-note);
  line-height: 1.45;
  text-align: right;
  white-space: nowrap;
}

@media (max-width: 220px) {
  .opening-chapter-head {
    grid-template-columns: 1.35rem minmax(0, 1fr);
  }

  .opening-chapter-head__fact {
    grid-column: 2;
    justify-self: start;
    text-align: left;
  }
}
</style>
