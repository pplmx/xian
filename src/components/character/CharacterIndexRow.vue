<template>
  <component
    :is="to ? RouterLink : 'button'"
    :to="to"
    v-bind="to ? {} : { type: 'button' }"
    class="character-index__row active:bg-ink/5"
    :style="{ '--character-index-tone': TONE[tone] }"
  >
    <span class="character-index__mark" aria-hidden="true">
      <GameIcon :name="icon" :size="16" />
    </span>
    <span class="character-index__copy">
      <span class="character-index__head">
        <span class="character-index__title">{{ title }}</span>
        <span class="character-index__action">{{ action }} <span aria-hidden="true">›</span></span>
      </span>
      <span class="character-index__sub">
        <span v-if="badge" class="character-index__badge">{{ badge }}</span>
        {{ sub }}
      </span>
    </span>
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
  violet: "var(--color-violet-ink)",
} as const;

withDefaults(
  defineProps<{
    icon: string;
    title: string;
    action: string;
    sub?: string;
    to?: string;
    tone?: keyof typeof TONE;
    badge?: string;
  }>(),
  { sub: "", to: undefined, tone: "ink", badge: "" },
);
</script>
