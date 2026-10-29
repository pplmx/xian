<template>
  <section
    class="card-ink relative overflow-hidden px-3 pb-3 pt-3"
    data-world-route-map
    aria-labelledby="world-route-heading"
  >
    <!-- 纸下的远山只做地势,不承载信息;真正的路线与状态由下面的 SVG 和文字同源表达 -->
    <svg
      class="pointer-events-none absolute inset-x-0 bottom-0 h-24 w-full text-[color:var(--world-mountain)] opacity-8"
      viewBox="0 0 300 96"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d="M0 96 L24 62 L46 78 L77 40 L102 76 L137 50 L167 84 L198 35 L226 73 L254 55 L278 77 L300 48 L300 96 Z"
        fill="currentColor"
      />
      <path
        d="M0 96 L38 76 L67 88 L106 67 L144 91 L180 72 L217 89 L257 70 L300 82 L300 96 Z"
        fill="currentColor"
        opacity="0.52"
      />
    </svg>

    <div class="relative">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <h2 id="world-route-heading" class="font-kai text-[14px] tracking-[0.24em] text-ink">
            山河行旅图
          </h2>
          <p class="mt-0.5 text-[10px] leading-relaxed text-ink-faint">
            高处境深 · 远处路长 · 点大处事多
          </p>
        </div>
        <div class="shrink-0 text-right">
          <p class="font-kai text-[14px] text-ink tabular">
            {{ clearedCount }}<span class="text-[10px] text-ink-faint"> / {{ places.length }}</span>
          </p>
          <p class="mt-0.5 text-[10px] text-ink-faint">程已行</p>
        </div>
      </div>

      <div class="relative mt-2">
        <svg
          class="h-20 w-full overflow-visible"
          viewBox="0 0 300 64"
          role="img"
          :aria-label="mapLabel"
        >
          <g aria-hidden="true">
            <line
              v-for="y in [8, 32, 56]"
              :key="y"
              x1="8"
              :x2="292"
              :y1="y"
              :y2="y"
              stroke="rgb(var(--color-ink-rgb) / 0.1)"
              stroke-width="0.7"
              stroke-dasharray="1 5"
            />
          </g>

          <path
            :d="routePath"
            fill="none"
            stroke="rgb(var(--color-ink-rgb) / 0.2)"
            stroke-width="1.4"
            stroke-linecap="round"
            stroke-dasharray="2 5"
          />
          <path
            v-if="progressPath"
            :d="progressPath"
            fill="none"
            class="text-jade"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
          />

          <g v-for="(p, i) in places" :key="p.nodeId" :class="nodeTone(i)">
            <circle
              v-if="statusAt(i) === 'cleared'"
              :cx="p.x"
              :cy="p.y"
              :r="p.r + 3"
              fill="none"
              stroke="currentColor"
              stroke-width="0.8"
              stroke-opacity="0.34"
            />
            <circle
              v-else-if="statusAt(i) === 'current'"
              :cx="p.x"
              :cy="p.y"
              :r="p.r + 4"
              fill="none"
              stroke="currentColor"
              stroke-width="1"
              stroke-opacity="0.45"
              class="animate-breathe"
              :style="{ transformOrigin: `${p.x}px ${p.y}px` }"
            />
            <circle
              v-else
              :cx="p.x"
              :cy="p.y"
              :r="p.r + 2"
              fill="none"
              stroke="currentColor"
              stroke-width="0.8"
              stroke-opacity="0.3"
              stroke-dasharray="1.5 2"
            />

            <circle
              :cx="p.x"
              :cy="p.y"
              :r="p.r"
              :style="{
                fill:
                  statusAt(i) === 'blocked' ? 'rgb(var(--color-paper-lifted-rgb))' : 'currentColor',
              }"
              :stroke="statusAt(i) === 'blocked' ? 'currentColor' : 'none'"
              stroke-width="1"
            />
            <path
              v-if="statusAt(i) === 'cleared'"
              :d="checkPath(p.x, p.y)"
              fill="none"
              stroke="var(--color-paper-lifted)"
              stroke-width="1.15"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <circle
              v-else-if="statusAt(i) === 'current'"
              :cx="p.x"
              :cy="p.y"
              r="1.15"
              fill="var(--color-paper-lifted)"
            />
          </g>
        </svg>
      </div>

      <div class="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-ink-faint">
        <span class="inline-flex items-center gap-1">
          <span class="h-2 w-2 rounded-full bg-jade" aria-hidden="true" />已通
        </span>
        <span class="inline-flex items-center gap-1">
          <span class="relative h-2 w-2 rounded-full bg-qing" aria-hidden="true">
            <span class="absolute inset-[2px] rounded-full bg-paper" />
          </span>
          <span>眼下</span>
        </span>
        <span class="inline-flex items-center gap-1">
          <span
            class="h-2 w-2 rounded-full border border-dashed border-ink/30"
            aria-hidden="true"
          />未至
        </span>
        <span class="ml-auto tabular">{{ tierText }}</span>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { MortalStageStatus, PlaceView } from "@/core/mortalWorldService";
import { clearedRoutePath, smoothRoutePath } from "@/ui/routeMap";

const props = defineProps<{
  places: PlaceView[];
  statuses: MortalStageStatus[];
  tierText: string;
}>();

const routePath = computed(() => smoothRoutePath(props.places));
const clearedCount = computed(
  () => props.statuses.filter((status) => status.state === "cleared").length,
);
const progressPath = computed(() => clearedRoutePath(props.places, clearedCount.value));
const currentPlace = computed(
  () => props.places[props.statuses.findIndex((status) => status.state === "current")],
);
const mapLabel = computed(() => {
  const parts = [`本世路线共 ${props.places.length} 段`, `已通 ${clearedCount.value} 段`];
  if (currentPlace.value) parts.push(`眼下可往「${currentPlace.value.name}」`);
  return `${parts.join(", ")}。${props.tierText}。`;
});

function statusAt(index: number): MortalStageStatus["state"] {
  return props.statuses[index]?.state ?? "blocked";
}

function nodeTone(index: number): string {
  const state = statusAt(index);
  if (state === "cleared") return "text-jade";
  if (state === "current") return "text-qing";
  return "text-ink-faint";
}

function checkPath(x: number, y: number): string {
  return `M ${x - 2} ${y} L ${x - 0.45} ${y + 1.45} L ${x + 2.25} ${y - 1.65}`;
}
</script>
