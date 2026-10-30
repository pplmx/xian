<template>
  <!--
    天门星图只报四册此刻有没有事可做；精确数目、缺口与倒计时都在正文总账里。
    故整图不重复进入读屏。
  -->
  <div class="celestial-gate-map" data-celestial-gate-map aria-hidden="true">
    <svg viewBox="0 0 176 150" role="presentation">
      <circle class="celestial-gate-map__orbit" cx="88" cy="75" r="52" />
      <circle class="celestial-gate-map__orbit is-inner" cx="88" cy="75" r="36" />
      <path class="celestial-gate-map__spokes" d="M88 39V25M124 75H133M88 111V125M52 75H43" />

      <path class="celestial-gate-map__gate" d="M72 91V70Q88 51 104 70V91" />
      <path class="celestial-gate-map__gate-line" d="M78 91V72Q88 60 98 72V91" />
      <circle class="celestial-gate-map__core" cx="88" cy="75" r="13" />
      <text class="celestial-gate-map__core-mark" x="88" y="79" text-anchor="middle">
        {{ daoSeal }}
      </text>

      <g class="celestial-gate-map__station is-dao" :class="{ 'is-active': active === 'dao' }">
        <circle class="celestial-gate-map__station-ring" cx="88" cy="25" r="11" />
        <circle
          class="celestial-gate-map__station-dot"
          :class="{ 'is-lit': daoChosen }"
          cx="97"
          cy="17"
          r="2.2"
        />
        <text class="celestial-gate-map__station-mark" x="88" y="29" text-anchor="middle">道</text>
      </g>

      <g class="celestial-gate-map__station is-exped" :class="{ 'is-active': active === 'exped' }">
        <circle class="celestial-gate-map__station-ring" cx="145" cy="75" r="11" />
        <circle
          class="celestial-gate-map__station-dot"
          :class="{ 'is-lit': runActive || worldsCleared > 0 }"
          cx="154"
          cy="67"
          r="2.2"
        />
        <text class="celestial-gate-map__station-mark" x="145" y="79" text-anchor="middle">征</text>
      </g>

      <g class="celestial-gate-map__station is-trial" :class="{ 'is-active': active === 'trial' }">
        <circle class="celestial-gate-map__station-ring" cx="88" cy="125" r="11" />
        <circle
          class="celestial-gate-map__station-dot"
          :class="{ 'is-lit': dailyState === 'ready', 'is-done': dailyState === 'done' }"
          cx="97"
          cy="117"
          r="2.2"
        />
        <text class="celestial-gate-map__station-mark" x="88" y="129" text-anchor="middle">试</text>
      </g>

      <g class="celestial-gate-map__station is-marks" :class="{ 'is-active': active === 'marks' }">
        <circle class="celestial-gate-map__station-ring" cx="31" cy="75" r="11" />
        <circle
          class="celestial-gate-map__station-dot"
          :class="{ 'is-lit': marksCount > 0, 'is-done': marksFull }"
          cx="40"
          cy="67"
          r="2.2"
        />
        <text class="celestial-gate-map__station-mark" x="31" y="79" text-anchor="middle">痕</text>
      </g>

      <circle class="celestial-gate-map__star" cx="61" cy="43" r="1" />
      <circle class="celestial-gate-map__star" cx="119" cy="51" r="0.8" />
      <circle class="celestial-gate-map__star" cx="111" cy="108" r="1.1" />
      <circle class="celestial-gate-map__star" cx="58" cy="101" r="0.7" />
    </svg>

    <span class="celestial-gate-map__caption">
      <span>道 {{ daoChosen ? "定" : "待" }}</span>
      <span class="tabular">征 {{ worldsCleared }}/{{ worldsTotal }}</span>
      <span>{{
        dailyState === "ready" ? "试 待" : dailyState === "done" ? "试 成" : "试 候"
      }}</span>
      <span class="tabular">痕 {{ marksCount }}/{{ marksTotal }}</span>
    </span>
  </div>
</template>

<script setup lang="ts">
import type { CelestialDailyState } from "@/core/celestialOverview";

withDefaults(
  defineProps<{
    active: "dao" | "exped" | "trial" | "marks";
    daoChosen: boolean;
    daoSeal: string;
    worldsCleared: number;
    worldsTotal: number;
    runActive: boolean;
    dailyState: CelestialDailyState;
    marksCount: number;
    marksTotal: number;
    marksFull: boolean;
  }>(),
  { daoSeal: "门" },
);
</script>

<style scoped>
.celestial-gate-map {
  position: relative;
  display: grid;
  width: 150px;
  height: 124px;
  place-items: center;
  isolation: isolate;
}

.celestial-gate-map::before {
  position: absolute;
  inset: 9px 8px 20px;
  border: 1px solid rgb(var(--color-ink-rgb) / 0.07);
  border-radius: 50%;
  background:
    radial-gradient(circle at 50% 42%, rgb(var(--color-qing-rgb) / 0.045), transparent 52%),
    linear-gradient(180deg, rgb(var(--color-paper-rgb) / 0.66), transparent 74%),
    rgb(var(--color-paper-deep-rgb) / 0.1);
  box-shadow: inset 0 0 28px rgb(var(--color-ink-rgb) / 0.025);
  content: "";
}

.celestial-gate-map svg {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.celestial-gate-map__orbit,
.celestial-gate-map__spokes,
.celestial-gate-map__gate,
.celestial-gate-map__gate-line,
.celestial-gate-map__station-ring {
  fill: none;
}

.celestial-gate-map__orbit {
  stroke: rgb(var(--color-ink-rgb) / 0.08);
  stroke-dasharray: 1.5 4;
  stroke-width: 0.8;
}

.celestial-gate-map__orbit.is-inner {
  stroke: rgb(var(--color-qing-rgb) / 0.14);
  stroke-dasharray: 2 3;
}

.celestial-gate-map__spokes {
  stroke: rgb(var(--color-qing-rgb) / 0.18);
  stroke-dasharray: 1 2.5;
  stroke-width: 0.8;
}

.celestial-gate-map__gate {
  stroke: rgb(var(--color-ink-rgb) / 0.24);
  stroke-width: 1.15;
}

.celestial-gate-map__gate-line {
  stroke: rgb(var(--color-qing-rgb) / 0.24);
  stroke-width: 0.8;
}

.celestial-gate-map__core {
  fill: rgb(var(--color-paper-lifted-rgb) / 0.92);
  stroke: rgb(var(--color-cinnabar-rgb) / 0.38);
  stroke-width: 0.9;
}

.celestial-gate-map__core-mark,
.celestial-gate-map__station-mark {
  font-family: var(--font-kai);
  text-anchor: middle;
}

.celestial-gate-map__core-mark {
  fill: rgb(var(--color-cinnabar-rgb));
  font-size: 8px;
}

.celestial-gate-map__station-ring {
  fill: rgb(var(--color-paper-rgb) / 0.72);
  stroke: rgb(var(--color-ink-rgb) / 0.18);
  stroke-width: 0.9;
  transition:
    fill 0.16s ease,
    stroke 0.16s ease;
}

.celestial-gate-map__station-mark {
  fill: rgb(var(--color-ink-soft-rgb));
  font-size: 8px;
  transition: fill 0.16s ease;
}

.celestial-gate-map__station.is-active .celestial-gate-map__station-ring {
  fill: rgb(var(--color-cinnabar-rgb) / 0.055);
  stroke: rgb(var(--color-cinnabar-rgb) / 0.55);
}

.celestial-gate-map__station.is-active .celestial-gate-map__station-mark {
  fill: rgb(var(--color-cinnabar-rgb));
}

.celestial-gate-map__station-dot {
  fill: rgb(var(--color-paper-rgb) / 0.8);
  stroke: rgb(var(--color-ink-rgb) / 0.2);
  stroke-width: 0.7;
}

.celestial-gate-map__station-dot.is-lit {
  fill: rgb(var(--color-cinnabar-rgb));
  stroke: rgb(var(--color-cinnabar-rgb));
}

.celestial-gate-map__station-dot.is-done {
  fill: rgb(var(--color-qing-rgb));
  stroke: rgb(var(--color-qing-rgb));
}

.celestial-gate-map__star {
  fill: rgb(var(--color-qing-rgb) / 0.46);
}

.celestial-gate-map__caption {
  position: absolute;
  z-index: 2;
  bottom: 0;
  display: flex;
  width: 100%;
  justify-content: center;
  gap: 0.3rem;
  color: rgb(var(--color-ink-faint-rgb));
  font-size: var(--type-note);
  line-height: 1.4;
  white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
  .celestial-gate-map__station-ring,
  .celestial-gate-map__station-mark {
    transition-duration: 0.01ms;
  }
}
</style>
