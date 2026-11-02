<template>
  <nav class="reincarnation-stages" data-reincarnation-stage-rail aria-label="往生三程">
    <div
      v-for="(stage, index) in REINCARNATION_STAGES"
      :key="stage.id"
      class="reincarnation-stage"
      :class="`is-${reincarnationStageState(index + 1, step)}`"
      :data-reincarnation-stage-state="reincarnationStageState(index + 1, step)"
      :aria-current="reincarnationStageState(index + 1, step) === 'current' ? 'step' : undefined"
    >
      <span class="reincarnation-stage__ordinal font-kai" aria-hidden="true">{{
        stage.ordinal
      }}</span>
      <span class="reincarnation-stage__copy">
        <strong>{{ stage.name }}</strong>
        <small>{{ stage.note }}</small>
      </span>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { REINCARNATION_STAGES, reincarnationStageState } from "@/ui/reincarnationDesk";

defineProps<{ step: 1 | 2 | 3 }>();
</script>

<style scoped>
.reincarnation-stages {
  --reincarnation-line: rgb(var(--color-ink-rgb) / 0.14);
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-bottom: 0.82rem;
  border-block: 1px solid var(--reincarnation-line);
}

.reincarnation-stage {
  display: grid;
  min-width: 0;
  grid-template-columns: 1.2rem minmax(0, 1fr);
  align-items: center;
  gap: 0.28rem;
  border-bottom: 2px solid transparent;
  padding: 0.46rem 0.42rem;
  color: var(--color-ink-faint);
}

.reincarnation-stage + .reincarnation-stage {
  border-left: 1px dashed var(--reincarnation-line);
}

.reincarnation-stage.is-current {
  border-bottom-color: rgb(var(--color-cinnabar-rgb) / 0.72);
  color: var(--color-ink);
}

.reincarnation-stage.is-done {
  color: var(--color-ink-soft);
}

.reincarnation-stage__ordinal {
  display: grid;
  width: 1.2rem;
  height: 1.2rem;
  place-items: center;
  border-left: 2px solid currentColor;
  color: var(--color-ink-faint);
  font-size: var(--type-note);
  line-height: 1;
}

.reincarnation-stage.is-current .reincarnation-stage__ordinal {
  color: var(--color-cinnabar);
}

.reincarnation-stage.is-done .reincarnation-stage__ordinal {
  color: var(--color-ink-soft);
}

.reincarnation-stage.is-upcoming .reincarnation-stage__ordinal {
  border-left-style: dashed;
}

.reincarnation-stage__copy {
  display: grid;
  min-width: 0;
  gap: 0.08rem;
}

.reincarnation-stage__copy strong {
  overflow-wrap: anywhere;
  color: inherit;
  font-family: var(--font-kai);
  font-size: var(--type-body);
  font-weight: 400;
  letter-spacing: 0.08em;
}

.reincarnation-stage__copy small {
  overflow-wrap: anywhere;
  color: var(--color-ink-faint);
  font-size: var(--type-note);
  line-height: 1.35;
}

@media (max-width: 220px) {
  .reincarnation-stages {
    grid-template-columns: minmax(0, 1fr);
  }

  .reincarnation-stage + .reincarnation-stage {
    border-top: 1px dashed var(--reincarnation-line);
    border-left: 0;
  }
}
</style>
