<template>
  <RouterLink
    to="/world"
    class="adventure-route block active:scale-99"
    data-world-ribbon
    :aria-label="linkLabel"
  >
    <span class="adventure-route__head">
      <span class="adventure-route__seal" aria-hidden="true">
        <GameIcon name="cloud" :size="15" />
      </span>
      <span class="adventure-route__copy">
        <span class="adventure-route__eyebrow">本世行旅</span>
        <span class="adventure-route__title">
          {{ view?.title ?? "此世气象未明,一观便知" }}
        </span>
      </span>
      <span v-if="view" class="adventure-route__count">
        <strong class="tabular">{{ clearedCount }}</strong>
        <span aria-hidden="true">/</span>
        <span class="tabular">{{ view.stages }}</span>
        <small>程</small>
      </span>
      <span class="adventure-route__link">观 象 →</span>
    </span>

    <span v-if="view && view.places.length > 0" class="adventure-route__body">
      <span class="adventure-route__track" aria-hidden="true">
        <template v-for="(place, i) in view.places" :key="place.nodeId">
          <span class="adventure-route__step" :class="`is-${statusAt(i)}`">
            <span class="adventure-route__dot" />
          </span>
          <span
            v-if="i < view.places.length - 1"
            class="adventure-route__line"
            :class="{ 'is-walked': i < clearedCount - 1 }"
          />
        </template>
      </span>
      <span class="adventure-route__target">
        {{ currentPlace ? `眼下「${currentPlace.name}」` : "此世路线已尽" }}
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
</script>
