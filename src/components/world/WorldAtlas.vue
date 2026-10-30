<script setup lang="ts">
import { computed } from "vue";
import type { MortalStageStatus } from "@/core/mortalWorldService";

const props = defineProps<{
  statuses: MortalStageStatus[];
  cleared: number;
  total: number;
  mark: string;
  tierText: string;
}>();

const ARC_SPAN = 12;

const segments = computed(() => {
  const count = Math.max(1, props.total);
  const step = 100 / count;
  return Array.from({ length: props.total }, (_, index) => {
    const state = props.statuses[index]?.state ?? "blocked";
    return {
      index,
      angle: (index * 360) / count,
      start: index * step + 1.4,
      active: state === "cleared" || state === "current",
      current: state === "current",
    };
  });
});
</script>

<template>
  <!--
    山河盘只做卷首方向感：每段路的通、眼下与未至都来自正文同一份阶段结果，
    精确地名、镇守、层级与准入理由都在路线账里，故整盘不重复进读屏。
  -->
  <div
    class="world-atlas"
    data-world-atlas
    :data-cleared="cleared"
    :data-total="total"
    aria-hidden="true"
  >
    <svg viewBox="0 0 160 160" role="presentation">
      <path
        class="world-atlas__terrain world-atlas__terrain--far"
        d="M4 126 C22 110 33 115 48 98 C63 81 76 94 90 86 C107 76 119 94 134 88 C145 84 153 92 158 101 V158 H4 Z"
      />
      <path
        class="world-atlas__terrain world-atlas__terrain--near"
        d="M4 137 C20 125 36 130 53 116 C70 102 85 116 101 108 C117 99 130 112 143 108 C151 105 156 110 158 116 V158 H4 Z"
      />

      <circle class="world-atlas__rim" cx="80" cy="80" r="68" />
      <circle
        class="world-atlas__ticks"
        cx="80"
        cy="80"
        r="63"
        pathLength="100"
        stroke-dasharray="0.6 3.4"
      />

      <g transform="rotate(-90 80 80)">
        <circle
          v-for="segment in segments"
          :key="`track-${segment.index}`"
          class="world-atlas__track"
          cx="80"
          cy="80"
          r="57"
          pathLength="100"
          :stroke-dasharray="`${ARC_SPAN} ${100 - ARC_SPAN}`"
          :stroke-dashoffset="-segment.start"
        />
        <circle
          v-for="segment in segments"
          :key="`arc-${segment.index}`"
          class="world-atlas__arc"
          :class="{ 'is-active': segment.active, 'is-current': segment.current }"
          cx="80"
          cy="80"
          r="57"
          pathLength="100"
          :stroke-dasharray="`${segment.active ? ARC_SPAN : 0} ${100 - ARC_SPAN}`"
          :stroke-dashoffset="-segment.start"
        />
      </g>

      <g
        v-for="segment in segments"
        :key="segment.index"
        class="world-atlas__node"
        :class="{ 'is-active': segment.active, 'is-current': segment.current }"
        :transform="`rotate(${segment.angle} 80 80)`"
      >
        <circle cx="80" cy="20" r="5.5" />
        <text x="80" y="22" text-anchor="middle">{{ segment.index + 1 }}</text>
      </g>

      <circle class="world-atlas__inner" cx="80" cy="80" r="43" />
      <rect class="world-atlas__seal" x="57" y="57" width="46" height="46" />
      <rect class="world-atlas__seal-inset" x="61" y="61" width="38" height="38" />
      <text class="world-atlas__mark" x="80" y="88" text-anchor="middle">{{ mark }}</text>
      <text class="world-atlas__progress" x="80" y="112" text-anchor="middle">
        {{ cleared }} / {{ total }}
      </text>
    </svg>
    <span class="world-atlas__caption">{{ tierText }}</span>
  </div>
</template>

<style scoped>
.world-atlas {
  position: relative;
  display: grid;
  width: 9.6rem;
  height: 9.6rem;
  place-items: center;
  color: var(--color-ink-faint);
  isolation: isolate;
}

.world-atlas::before {
  position: absolute;
  inset: 5px;
  border: 1px solid rgb(var(--color-ink-rgb) / 0.055);
  border-radius: 50%;
  background:
    radial-gradient(circle at 50% 42%, rgb(var(--color-paper-rgb) / 0.84), transparent 58%),
    rgb(var(--color-paper-deep-rgb) / 0.14);
  box-shadow: inset 0 0 30px rgb(var(--color-ink-rgb) / 0.025);
  content: "";
}

.world-atlas svg {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.world-atlas__terrain {
  stroke: none;
}

.world-atlas__terrain--far {
  fill: rgb(var(--color-ink-rgb) / 0.035);
}

.world-atlas__terrain--near {
  fill: rgb(var(--color-ink-rgb) / 0.06);
}

.world-atlas__rim,
.world-atlas__ticks,
.world-atlas__track,
.world-atlas__arc,
.world-atlas__inner,
.world-atlas__seal,
.world-atlas__seal-inset {
  fill: none;
}

.world-atlas__rim {
  stroke: rgb(var(--color-ink-rgb) / 0.14);
  stroke-width: 1;
}

.world-atlas__ticks {
  stroke: rgb(var(--color-ink-rgb) / 0.17);
  stroke-width: 0.8;
}

.world-atlas__track {
  stroke: rgb(var(--color-ink-rgb) / 0.1);
  stroke-width: 3;
}

.world-atlas__arc {
  stroke: rgb(var(--color-ink-rgb) / 0.16);
  stroke-width: 3;
}

.world-atlas__arc.is-active {
  stroke: rgb(var(--color-jade-rgb) / 0.76);
}

.world-atlas__arc.is-current {
  stroke: rgb(var(--color-qing-rgb) / 0.86);
}

.world-atlas__inner {
  stroke: rgb(var(--color-ink-rgb) / 0.07);
}

.world-atlas__node circle {
  fill: rgb(var(--color-paper-lifted-rgb) / 0.9);
  stroke: rgb(var(--color-ink-rgb) / 0.18);
  stroke-width: 0.8;
}

.world-atlas__node text {
  fill: var(--color-ink-faint);
  font-family: var(--font-song);
  font-size: 5.5px;
}

.world-atlas__node.is-active circle {
  fill: rgb(var(--color-jade-rgb) / 0.07);
  stroke: rgb(var(--color-jade-rgb) / 0.55);
}

.world-atlas__node.is-active text {
  fill: var(--color-jade);
}

.world-atlas__node.is-current circle {
  fill: rgb(var(--color-qing-rgb) / 0.08);
  stroke: rgb(var(--color-qing-rgb) / 0.7);
}

.world-atlas__node.is-current text {
  fill: var(--color-qing);
}

.world-atlas__seal {
  fill: rgb(var(--color-cinnabar-rgb) / 0.045);
  stroke: rgb(var(--color-cinnabar-rgb) / 0.42);
}

.world-atlas__seal-inset {
  stroke: rgb(var(--color-cinnabar-rgb) / 0.16);
  stroke-width: 0.8;
}

.world-atlas__mark {
  fill: var(--color-cinnabar);
  font-family: var(--font-kai);
  font-size: 21px;
}

.world-atlas__progress {
  fill: var(--color-ink-faint);
  font-family: var(--font-song);
  font-size: 7px;
}

.world-atlas__caption {
  position: absolute;
  z-index: 2;
  bottom: 0.12rem;
  color: var(--color-ink-faint);
  font-size: var(--type-note);
  line-height: 1.3;
}

@media (max-width: 220px) {
  .world-atlas {
    width: 7.4rem;
    height: 7.4rem;
  }
}
</style>
