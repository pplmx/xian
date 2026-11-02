<template>
  <header class="character-chapter-head" data-folio-chapter-head>
    <span class="character-chapter-head__index" aria-hidden="true">{{ index }}</span>
    <div class="character-chapter-head__copy">
      <h2 class="character-chapter-head__title">{{ title }}</h2>
      <p class="character-chapter-head__hint">{{ hint }}</p>
    </div>
    <p v-if="fact" class="character-chapter-head__fact tabular">{{ fact }}</p>
  </header>
</template>

<script setup lang="ts">
defineProps<{
  index: string;
  title: string;
  hint: string;
  fact?: string;
}>();
</script>

<style scoped>
.character-chapter-head {
  display: grid;
  min-width: 0;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.55rem;
  border-bottom: 1px solid rgb(var(--color-ink-rgb) / 0.095);
  padding-bottom: 0.58rem;
}

.character-chapter-head__index {
  display: grid;
  min-width: 1.7rem;
  height: 1.7rem;
  place-items: center;
  border-left: 2px solid rgb(var(--character-accent-rgb, var(--color-cinnabar-rgb)) / 0.72);
  color: var(--character-accent);
  font-family: var(--font-kai);
  font-size: var(--type-note);
  line-height: 1;
}

.character-chapter-head__copy {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.02rem 0.55rem;
}

.character-chapter-head__title {
  margin: 0;
  color: rgb(var(--color-ink-rgb));
  font-family: var(--font-kai);
  font-size: var(--type-section);
  font-weight: 400;
  letter-spacing: 0.18em;
  line-height: 1.3;
}

.character-chapter-head__hint {
  min-width: 0;
  color: rgb(var(--color-ink-faint-rgb));
  font-size: var(--type-note);
  line-height: 1.45;
}

.character-chapter-head__fact {
  justify-self: end;
  color: rgb(var(--color-qing-rgb));
  font-family: var(--font-kai);
  font-size: var(--type-note);
  line-height: 1.4;
  text-align: right;
  white-space: nowrap;
}

@media (max-width: 220px) {
  .character-chapter-head {
    grid-template-columns: auto minmax(0, 1fr);
    align-items: start;
    gap: 0.38rem;
  }

  .character-chapter-head__fact {
    grid-column: 2;
    justify-self: start;
    text-align: left;
  }

  .character-chapter-head__copy {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
