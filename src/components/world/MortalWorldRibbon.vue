<template>
  <RouterLink
    to="/world"
    class="block pb-2 active:scale-99"
    data-world-ribbon
    :aria-label="linkLabel"
  >
    <span class="flex items-center gap-2.5">
      <span class="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-qing/6 text-qing">
        <GameIcon name="cloud" :size="15" />
      </span>
      <span class="min-w-0 grow">
        <span class="block font-kai text-[14px] tracking-[0.2em] text-ink">本世之界</span>
        <span class="block truncate text-[10px] leading-relaxed text-ink-faint">
          {{ view?.title ?? "此世气象未明,一观便知" }}
        </span>
      </span>
      <span class="shrink-0 text-[11px] text-qing">观 象 →</span>
    </span>

    <span v-if="view && view.places.length > 0" class="mt-2 block">
      <span class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[10px]">
        <span class="text-qing tabular">{{ clearedCount }}/{{ view.stages }} 程</span>
        <span class="min-w-0 truncate text-ink-faint">
          {{ currentPlace ? `眼下「${currentPlace.name}」` : "此世路线已尽" }}
        </span>
      </span>
      <span class="mt-1.5 flex items-center" aria-hidden="true">
        <template v-for="(place, i) in view.places" :key="place.nodeId">
          <span
            class="relative h-2 w-2 shrink-0 rounded-full"
            :class="dotClass(i)"
            :style="dotStyle(i)"
          >
            <span
              v-if="statusAt(i) === 'current'"
              class="absolute inset-[2px] rounded-full bg-paper"
            />
          </span>
          <span
            v-if="i < view.places.length - 1"
            class="h-px min-w-1 grow"
            :class="i < clearedCount - 1 ? 'bg-jade' : 'bg-ink/15'"
          />
        </template>
      </span>
    </span>
  </RouterLink>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { RouterLink } from "vue-router";
import type { MortalStageStatus, WorldView } from "@/core/mortalWorldService";
import GameIcon from "@/components/common/GameIcon.vue";

const props = defineProps<{
  view: WorldView | null;
  statuses: MortalStageStatus[];
}>();

const clearedCount = computed(
  () => props.statuses.filter((status) => status.state === "cleared").length,
);
const currentPlace = computed(
  () => props.view?.places[props.statuses.findIndex((status) => status.state === "current")],
);
const linkLabel = computed(() => {
  if (!props.view) return "本世之界,此世气象未明,观象";
  const parts = [`本世之界,${props.view.title}`, `${clearedCount.value}/${props.view.stages} 程`];
  if (currentPlace.value) parts.push(`眼下可往${currentPlace.value.name}`);
  else parts.push("此世路线已尽");
  return `${parts.join(",")}。观象`;
});

function statusAt(index: number): MortalStageStatus["state"] {
  return props.statuses[index]?.state ?? "blocked";
}

function dotClass(index: number): string {
  const state = statusAt(index);
  if (state === "cleared") return "bg-jade";
  if (state === "current") return "bg-qing";
  return "border border-dashed border-ink/30 bg-paper";
}

function dotStyle(index: number): Record<string, string> | undefined {
  const state = statusAt(index);
  return state === "current"
    ? { boxShadow: "0 0 0 2px rgb(var(--color-qing-rgb) / 0.16)" }
    : undefined;
}
</script>
