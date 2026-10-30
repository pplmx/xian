<template>
  <!--
    器魂阵只报三席有没有形意、闲置与可凝各有多少；
    具体名字、词条、来源与代价都在正文和两处门径里，故整图不重复进入读屏。
  -->
  <div class="soul-forge-map" data-soul-forge-map aria-hidden="true">
    <svg viewBox="0 0 176 138" role="presentation">
      <path class="soul-forge-map__links" d="M52 34 88 72 124 34M52 34 88 101 124 34" />
      <circle class="soul-forge-map__orbit" cx="88" cy="68" r="48" />
      <circle class="soul-forge-map__orbit is-inner" cx="88" cy="68" r="31" />

      <circle class="soul-forge-map__core" cx="88" cy="68" r="15" />
      <text class="soul-forge-map__core-mark" x="88" y="72" text-anchor="middle">魂</text>

      <g
        v-for="(seat, index) in seats"
        :key="index"
        class="soul-forge-map__seat"
        :class="{ 'is-filled': seat.filled }"
        :style="{ color: seat.color }"
      >
        <circle class="soul-forge-map__seat-ring" :cx="seat.x" :cy="seat.y" r="13" />
        <text class="soul-forge-map__seat-mark" :x="seat.x" :y="seat.y + 4" text-anchor="middle">
          {{ seat.mark }}
        </text>
      </g>

      <circle class="soul-forge-map__spark is-idle" cx="38" cy="83" r="2" />
      <circle class="soul-forge-map__spark is-refine" cx="139" cy="83" r="2" />
      <circle class="soul-forge-map__star" cx="65" cy="20" r="0.8" />
      <circle class="soul-forge-map__star" cx="111" cy="18" r="1" />
      <circle class="soul-forge-map__star" cx="30" cy="55" r="0.7" />
      <circle class="soul-forge-map__star" cx="146" cy="52" r="0.8" />
    </svg>

    <span class="soul-forge-map__caption">
      <span class="tabular">席 {{ filledCount }}/{{ seats.length }}</span>
      <span class="tabular">闲 {{ idleCount }}</span>
      <span class="tabular">凝 {{ affordableRefines }}/{{ refinableCount }}</span>
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

interface SoulSeatMark {
  mark: string;
  color: string;
  filled: boolean;
  x: number;
  y: number;
}

const props = defineProps<{
  seats: readonly SoulSeatMark[];
  idleCount: number;
  refinableCount: number;
  affordableRefines: number;
}>();

const filledCount = computed(() => props.seats.filter((seat) => seat.filled).length);
</script>

<style scoped>
.soul-forge-map {
  position: relative;
  display: grid;
  width: 154px;
  height: 128px;
  place-items: center;
  isolation: isolate;
}

.soul-forge-map::before {
  position: absolute;
  inset: 5px 5px 17px;
  border: 1px solid rgb(var(--color-ink-rgb) / 0.07);
  border-radius: 50%;
  background:
    radial-gradient(circle at 50% 42%, rgb(var(--color-gold-ink-rgb) / 0.045), transparent 52%),
    radial-gradient(circle at 50% 68%, rgb(var(--color-qing-rgb) / 0.035), transparent 58%),
    rgb(var(--color-paper-deep-rgb) / 0.08);
  box-shadow: inset 0 0 26px rgb(var(--color-ink-rgb) / 0.025);
  content: "";
}

.soul-forge-map svg {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.soul-forge-map__links,
.soul-forge-map__orbit,
.soul-forge-map__seat-ring {
  fill: none;
}

.soul-forge-map__links {
  stroke: rgb(var(--color-qing-rgb) / 0.16);
  stroke-dasharray: 1.2 3;
  stroke-width: 0.8;
}

.soul-forge-map__orbit {
  stroke: rgb(var(--color-ink-rgb) / 0.08);
  stroke-dasharray: 1.5 4;
  stroke-width: 0.8;
}

.soul-forge-map__orbit.is-inner {
  stroke: rgb(var(--color-gold-ink-rgb) / 0.16);
  stroke-dasharray: 2 3;
}

.soul-forge-map__core {
  fill: rgb(var(--color-paper-lifted-rgb) / 0.94);
  stroke: rgb(var(--color-gold-ink-rgb) / 0.42);
  stroke-width: 0.9;
}

.soul-forge-map__core-mark,
.soul-forge-map__seat-mark {
  font-family: var(--font-kai);
  text-anchor: middle;
}

.soul-forge-map__core-mark {
  fill: rgb(var(--color-gold-ink-rgb));
  font-size: 9px;
}

.soul-forge-map__seat-ring {
  fill: rgb(var(--color-paper-rgb) / 0.76);
  stroke: rgb(var(--color-ink-rgb) / 0.2);
  stroke-width: 0.9;
}

.soul-forge-map__seat.is-filled .soul-forge-map__seat-ring {
  fill: rgb(var(--color-paper-lifted-rgb) / 0.86);
  stroke: currentColor;
}

.soul-forge-map__seat-mark {
  fill: rgb(var(--color-ink-faint-rgb));
  font-size: 8px;
}

.soul-forge-map__seat.is-filled .soul-forge-map__seat-mark {
  fill: currentColor;
}

.soul-forge-map__spark {
  fill: rgb(var(--color-paper-rgb) / 0.84);
  stroke: rgb(var(--color-ink-rgb) / 0.2);
  stroke-width: 0.6;
}

.soul-forge-map__spark.is-refine {
  stroke: rgb(var(--color-cinnabar-rgb) / 0.55);
}

.soul-forge-map__star {
  fill: rgb(var(--color-qing-rgb) / 0.46);
}

.soul-forge-map__caption {
  position: absolute;
  z-index: 2;
  bottom: 0;
  display: flex;
  width: 100%;
  justify-content: center;
  gap: 0.42rem;
  color: rgb(var(--color-ink-faint-rgb));
  font-size: var(--type-note);
  line-height: 1.4;
  white-space: nowrap;
}
</style>
