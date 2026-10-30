<template>
  <!--
    道躯命盘只做卷首主视觉：外圈是攻 / 防 / 血折成战力的三段，
    内圈五点是灵根。精确读数都在正文「道躯总案」里，故整盘不重复进读屏。
  -->
  <div class="character-sigil" data-character-sigil aria-hidden="true">
    <svg viewBox="0 0 140 140" role="presentation">
      <circle class="character-sigil__rim" cx="70" cy="70" r="66" />
      <circle
        class="character-sigil__ticks"
        cx="70"
        cy="70"
        r="61"
        pathLength="100"
        stroke-dasharray="0.8 3.2"
      />
      <g transform="rotate(-90 70 70)">
        <circle
          v-for="arc in arcs"
          :key="arc.label"
          class="character-sigil__arc"
          cx="70"
          cy="70"
          r="56"
          pathLength="100"
          :stroke="arc.color"
          :stroke-dasharray="`${arc.length} ${100 - arc.length}`"
          :stroke-dashoffset="-arc.offset"
        />
      </g>

      <circle class="character-sigil__inner" cx="70" cy="70" r="47" />
      <g v-for="root in rootNodes" :key="root.element">
        <circle
          class="character-sigil__root"
          cx="70"
          cy="70"
          r="40"
          :transform="`rotate(${root.angle} 70 70)`"
          :stroke="root.color"
        />
        <circle
          class="character-sigil__root-dot"
          :cx="root.x"
          :cy="root.y"
          r="8.5"
          :style="{ color: root.color }"
        />
        <text
          class="character-sigil__root-mark"
          :x="root.x"
          :y="root.y + 0.5"
          text-anchor="middle"
          dominant-baseline="middle"
          :style="{ fill: root.color }"
        >
          {{ root.mark }}
        </text>
      </g>

      <rect class="character-sigil__seal" x="52" y="49" width="36" height="36" />
      <rect class="character-sigil__seal-inset" x="55.5" y="52.5" width="29" height="29" />
      <text
        class="character-sigil__name"
        x="70"
        y="69"
        text-anchor="middle"
        dominant-baseline="middle"
      >
        {{ nameMark }}
      </text>
      <text class="character-sigil__mult" x="70" y="83" text-anchor="middle">
        ×{{ growthMult.toFixed(2) }}
      </text>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { SpiritRoot } from "@/types";
import { ELEMENTS } from "@/data/linggen";

const props = defineProps<{
  name: string;
  growthMult: number;
  roots: SpiritRoot[];
  segments: { label: string; share: number; color: string }[];
}>();

const ROOT_ANGLES = [-90, -18, 54, 126, 198];

const nameMark = computed(() => Array.from(props.name.trim())[0] ?? "道");

const arcs = computed(() => {
  let offset = 0;
  return props.segments.map((segment) => {
    const length = Math.max(0, Math.min(100, segment.share * 100));
    const arc = { ...segment, length, offset };
    offset += length;
    return arc;
  });
});

const rootNodes = computed(() =>
  props.roots.slice(0, ROOT_ANGLES.length).map((root, index) => {
    const angle = ROOT_ANGLES[index]!;
    const rad = (angle * Math.PI) / 180;
    return {
      element: root.element,
      angle,
      x: 70 + Math.cos(rad) * 40,
      y: 70 + Math.sin(rad) * 40,
      mark: ELEMENTS[root.element].char,
      color: ELEMENTS[root.element].color,
    };
  }),
);
</script>

<style scoped>
.character-sigil {
  position: relative;
  display: grid;
  width: 140px;
  height: 140px;
  flex: none;
  place-items: center;
  isolation: isolate;
}

.character-sigil::before,
.character-sigil::after {
  position: absolute;
  border-radius: 50%;
  content: "";
  pointer-events: none;
}

.character-sigil::before {
  inset: 12px;
  border: 1px solid rgb(var(--color-ink-rgb) / 0.07);
  background:
    radial-gradient(circle at 42% 36%, rgb(var(--color-paper-rgb) / 0.84), transparent 47%),
    rgb(var(--color-paper-deep-rgb) / 0.34);
  box-shadow:
    inset 0 0 26px rgb(var(--color-ink-rgb) / 0.04),
    0 5px 18px rgb(var(--shadow-ink-rgb) / 0.08);
}

.character-sigil::after {
  inset: 25px;
  border: 1px dashed rgb(var(--color-ink-rgb) / 0.1);
}

.character-sigil svg {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.character-sigil__rim,
.character-sigil__ticks,
.character-sigil__arc,
.character-sigil__inner,
.character-sigil__root {
  fill: none;
}

.character-sigil__rim {
  stroke: rgb(var(--color-ink-rgb) / 0.11);
  stroke-width: 1;
}

.character-sigil__ticks {
  stroke: rgb(var(--color-ink-rgb) / 0.22);
  stroke-width: 1.2;
}

.character-sigil__arc {
  stroke-linecap: butt;
  stroke-width: 4.5;
  opacity: 0.84;
}

.character-sigil__inner {
  stroke: rgb(var(--color-ink-rgb) / 0.08);
  stroke-width: 0.8;
}

.character-sigil__root {
  stroke-dasharray: 2 4;
  stroke-width: 0.8;
  opacity: 0.36;
}

.character-sigil__root-dot {
  fill: rgb(var(--color-paper-lifted-rgb) / 0.94);
  stroke: currentColor;
  stroke-width: 1.1;
}

.character-sigil__root-mark {
  font-family: var(--font-kai);
  font-size: 9px;
  font-weight: 600;
}

.character-sigil__seal {
  fill: rgb(var(--color-paper-lifted-rgb) / 0.62);
  stroke: rgb(var(--color-cinnabar-rgb) / 0.58);
  stroke-width: 1;
}

.character-sigil__seal-inset {
  fill: none;
  stroke: rgb(var(--color-cinnabar-rgb) / 0.16);
  stroke-width: 0.7;
}

.character-sigil__name {
  fill: rgb(var(--color-cinnabar-rgb));
  font-family: var(--font-kai);
  font-size: 19px;
  font-weight: 500;
}

.character-sigil__mult {
  fill: rgb(var(--color-ink-faint-rgb));
  font-family: var(--font-kai);
  font-size: 7px;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
}
</style>
