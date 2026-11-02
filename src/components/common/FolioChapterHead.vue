<template>
  <header class="folio-chapter-head" :data-size="size" data-folio-chapter-head>
    <span class="folio-chapter-head__index" aria-hidden="true">{{ index }}</span>
    <div class="folio-chapter-head__copy">
      <p v-if="eyebrow" class="folio-chapter-head__eyebrow">{{ eyebrow }}</p>
      <div class="folio-chapter-head__copy-line">
        <h2 class="folio-chapter-head__title">{{ title }}</h2>
        <p class="folio-chapter-head__hint">{{ hint }}</p>
      </div>
    </div>
    <div v-if="fact || $slots.actions" class="folio-chapter-head__tail">
      <p v-if="fact" class="folio-chapter-head__fact">{{ fact }}</p>
      <div v-if="$slots.actions" class="folio-chapter-head__actions">
        <slot name="actions" />
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    index: string;
    title: string;
    hint: string;
    fact?: string;
    eyebrow?: string;
    size?: "section" | "heading";
  }>(),
  {
    fact: undefined,
    eyebrow: undefined,
    size: "section",
  },
);
</script>

<style scoped>
.folio-chapter-head {
  display: grid;
  min-width: 0;
  /* Keep short facts from collapsing to one glyph per line before the mobile wrap. */
  grid-template-columns: 1.45rem minmax(0, 1fr) minmax(6.5rem, auto);
  align-items: start;
  gap: 0.24rem 0.55rem;
  border-bottom: 1px solid rgb(var(--color-ink-rgb) / 0.075);
  padding: 0.64rem 0.05rem 0.5rem;
}

.folio-chapter-head__index {
  display: grid;
  width: 1.35rem;
  height: 1.35rem;
  place-items: center;
  border-left: 2px solid rgb(var(--folio-chapter-accent-rgb, var(--color-cinnabar-rgb)) / 0.7);
  color: var(--folio-chapter-accent, var(--color-cinnabar));
  font-family: var(--font-kai);
  font-size: var(--type-note);
  line-height: 1;
}

.folio-chapter-head__copy {
  display: grid;
  min-width: 0;
  gap: 0.04rem;
}

.folio-chapter-head__eyebrow {
  color: var(--folio-chapter-accent, var(--color-cinnabar));
  font-family: var(--font-kai);
  font-size: var(--type-note);
  letter-spacing: 0.12em;
  line-height: 1.35;
}

.folio-chapter-head__copy-line {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.08rem 0.5rem;
}

.folio-chapter-head__title {
  margin: 0;
  color: rgb(var(--color-ink-rgb));
  font-family: var(--font-kai);
  font-size: var(--type-section);
  font-weight: 400;
  letter-spacing: 0.13em;
  line-height: 1.35;
}

.folio-chapter-head[data-size="heading"] .folio-chapter-head__title {
  font-size: var(--type-heading);
  letter-spacing: 0.1em;
}

.folio-chapter-head__hint {
  min-width: 0;
  color: rgb(var(--color-ink-faint-rgb));
  font-size: var(--type-note);
  line-height: 1.52;
  overflow-wrap: anywhere;
}

.folio-chapter-head__tail {
  display: flex;
  min-width: 0;
  max-width: min(32rem, 55%);
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.2rem 0.55rem;
}

.folio-chapter-head__fact {
  min-width: 0;
  color: rgb(var(--color-qing-rgb));
  font-family: var(--font-kai);
  font-size: var(--type-note);
  font-variant-numeric: tabular-nums;
  line-height: 1.45;
  overflow-wrap: anywhere;
  text-align: right;
}

.folio-chapter-head__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.12rem 0.55rem;
}

@media (max-width: 520px) {
  .folio-chapter-head {
    grid-template-columns: 1.35rem minmax(0, 1fr);
  }

  .folio-chapter-head__tail {
    grid-column: 2;
    justify-self: start;
    justify-content: flex-start;
    max-width: none;
  }

  .folio-chapter-head__fact {
    text-align: left;
    white-space: normal;
  }
}

@media (max-width: 220px) {
  .folio-chapter-head {
    gap: 0.2rem 0.4rem;
    padding-inline: 0;
  }
}
</style>
