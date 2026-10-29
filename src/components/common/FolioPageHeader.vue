<template>
  <header class="folio-masthead card-ink relative overflow-hidden px-4 py-3" data-folio-masthead>
    <div class="relative z-10 flex flex-wrap items-center gap-x-3 gap-y-1">
      <button
        v-if="backTo"
        type="button"
        class="tap-row -my-1.5 min-h-7 py-1.5 text-[11px] text-ink-faint active:text-ink-soft"
        :aria-label="`返回${backLabel}`"
        @click="goBack(router, { name: backTo })"
      >
        ← {{ backLabel }}
      </button>
      <span class="text-[10px] font-kai tracking-[0.28em] text-cinnabar" data-folio-section>
        {{ navigation?.sectionLabel ?? "玄枢" }}
      </span>
      <span
        class="h-px min-w-2 flex-1 bg-gradient-to-r from-ink/15 to-transparent"
        aria-hidden="true"
      />
      <span class="text-[10px] text-ink-faint">{{ navigation?.label ?? "未名之页" }}</span>
    </div>

    <div class="relative z-10 mt-2 flex flex-wrap items-start gap-3">
      <span
        class="folio-seal grid h-9 w-9 shrink-0 place-items-center border border-ink/20 text-ink-soft"
        aria-hidden="true"
      >
        <GameIcon :name="navigation?.icon ?? 'scroll'" :size="17" />
      </span>
      <div class="min-w-0 flex-1">
        <h1 class="font-kai text-[18px] leading-snug tracking-[0.18em] text-ink">{{ title }}</h1>
        <p v-if="description" class="mt-1 t-body text-ink-faint">
          {{ description }}
        </p>
        <slot name="meta" />
      </div>
      <div v-if="$slots.action" class="shrink-0 tinylens:w-full">
        <slot name="action" />
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { goBack } from "@/router/goBack";
import { navigationEntryOf } from "@/ui/navigation";
import GameIcon from "./GameIcon.vue";

const props = withDefaults(
  defineProps<{
    title: string;
    subtitle?: string;
    backTo?: string;
    backLabel?: string;
  }>(),
  { subtitle: "", backTo: "", backLabel: "返回" },
);

const route = useRoute();
const router = useRouter();
const navigation = computed(() => navigationEntryOf(route.name));
const description = computed(() => props.subtitle || navigation.value?.description || "");
</script>
