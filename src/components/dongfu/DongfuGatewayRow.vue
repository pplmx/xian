<template>
  <component
    :is="to ? RouterLink : 'button'"
    :to="to"
    v-bind="to ? {} : { type: 'button' }"
    class="dongfu-gateway"
    :style="{ '--dongfu-gateway-tone': TONE[tone] }"
  >
    <span class="dongfu-gateway__mark" aria-hidden="true">
      <GameIcon :name="icon" :size="17" />
    </span>
    <span class="dongfu-gateway__copy">
      <span class="dongfu-gateway__head">
        <span class="dongfu-gateway__title">{{ title }}</span>
        <span class="dongfu-gateway__action">{{ action }} <span aria-hidden="true">›</span></span>
      </span>
      <span class="dongfu-gateway__sub">{{ sub }}</span>
    </span>
    <span class="dongfu-gateway__fact tabular">{{ fact }}</span>
  </component>
</template>

<script setup lang="ts">
import { RouterLink } from "vue-router";
import GameIcon from "@/components/common/GameIcon.vue";

const TONE = {
  cinnabar: "var(--color-cinnabar)",
  ink: "var(--color-ink-soft)",
  qing: "var(--color-qing)",
  jade: "var(--color-jade)",
  gold: "var(--color-gold-ink)",
} as const;

withDefaults(
  defineProps<{
    icon: string;
    title: string;
    sub: string;
    fact: string;
    action: string;
    to?: string;
    tone?: keyof typeof TONE;
  }>(),
  { to: undefined, tone: "ink" },
);
</script>

<style scoped>
.dongfu-gateway {
  display: grid;
  min-width: 0;
  grid-template-columns: 2.2rem minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.7rem;
  padding: 0.72rem 0.8rem;
  color: inherit;
  text-align: left;
  text-decoration: none;
  transition: background-color 0.12s ease;
}

.dongfu-gateway:hover {
  background: rgb(var(--color-ink-rgb) / 0.025);
}

.dongfu-gateway + .dongfu-gateway {
  border-top: 1px solid rgb(var(--color-ink-rgb) / 0.085);
}

.dongfu-gateway__mark {
  display: grid;
  width: 2.2rem;
  height: 2.2rem;
  place-items: center;
  border: 1px solid currentColor;
  background: rgb(var(--color-paper-rgb) / 0.32);
  color: var(--dongfu-gateway-tone);
}

.dongfu-gateway__copy {
  display: block;
  min-width: 0;
}

.dongfu-gateway__head {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.08rem 0.55rem;
}

.dongfu-gateway__title {
  color: rgb(var(--color-ink-rgb));
  font-family: var(--font-kai);
  font-size: var(--type-title);
  letter-spacing: 0.14em;
  line-height: 1.4;
}

.dongfu-gateway__action {
  flex: none;
  color: var(--dongfu-gateway-tone);
  font-size: var(--type-note);
  white-space: nowrap;
}

.dongfu-gateway__sub {
  display: block;
  margin-top: 0.1rem;
  overflow-wrap: anywhere;
  color: rgb(var(--color-ink-faint-rgb));
  font-size: var(--type-note);
  line-height: 1.55;
}

.dongfu-gateway__fact {
  justify-self: end;
  color: rgb(var(--color-cinnabar-rgb));
  font-size: var(--type-body);
  line-height: 1.45;
  text-align: right;
  white-space: nowrap;
}

@media (max-width: 360px) {
  .dongfu-gateway {
    grid-template-columns: 2.1rem minmax(0, 1fr);
  }

  .dongfu-gateway__fact {
    grid-column: 2;
    justify-self: start;
    white-space: normal;
  }
}

@media (max-width: 220px) {
  .dongfu-gateway {
    gap: 0.55rem;
    padding-inline: 0.65rem;
  }

  .dongfu-gateway__mark {
    width: 1.9rem;
    height: 1.9rem;
  }

  .dongfu-gateway__head {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
