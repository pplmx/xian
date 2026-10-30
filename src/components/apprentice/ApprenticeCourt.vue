<template>
  <!--
    门庭图只给「谁在家、谁在路上」的方位感；姓名、等级、归期与产出都在正文值日簿里，
    故整图不重复进入读屏。
  -->
  <div class="apprentice-court" data-apprentice-court aria-hidden="true">
    <svg viewBox="0 0 168 146" role="presentation">
      <path class="apprentice-court__wall" d="M9 111 V47 H159 V111" />
      <path class="apprentice-court__wall-shadow" d="M15 105 V53 H153 V105" />
      <path class="apprentice-court__gate" d="M75 111 V94 H93 V111 M70 111 H98" />
      <path class="apprentice-court__roof" d="M66 77 L84 61 L102 77 Z" />
      <path class="apprentice-court__hall" d="M72 76 H96 V101 H72 Z" />
      <text class="apprentice-court__hall-mark" x="84" y="89" text-anchor="middle">门</text>

      <path
        v-for="cell in placedCells"
        :key="`path-${cell.node.uid}`"
        class="apprentice-court__way"
        :class="{ 'is-away': !cell.node.idle }"
        :d="`M84 87 L${cell.x} ${cell.y}`"
      />

      <g
        v-for="cell in placedCells"
        :key="cell.node.uid"
        class="apprentice-court__person"
        :class="cell.node.idle ? 'is-idle' : 'is-away'"
      >
        <circle class="apprentice-court__person-disc" :cx="cell.x" :cy="cell.y" r="10" />
        <circle
          v-if="!cell.node.idle"
          class="apprentice-court__person-progress"
          :cx="cell.x"
          :cy="cell.y"
          r="10"
          pathLength="100"
          :stroke-dasharray="`${cell.node.progress} ${100 - cell.node.progress}`"
          :transform="`rotate(-90 ${cell.x} ${cell.y})`"
        />
        <text
          class="apprentice-court__person-mark"
          :x="cell.x"
          :y="cell.y + 0.5"
          text-anchor="middle"
          dominant-baseline="middle"
        >
          {{ cell.node.mark }}
        </text>
        <circle
          v-if="cell.node.idle"
          class="apprentice-court__ready-dot"
          :cx="cell.x + 7.2"
          :cy="cell.y - 7.2"
          r="2.1"
        />
      </g>

      <g v-for="cell in emptyCells" :key="cell.key" class="apprentice-court__empty">
        <circle :cx="cell.x" :cy="cell.y" r="9" />
        <path :d="`M${cell.x - 2.5} ${cell.y} H${cell.x + 2.5}`" />
      </g>
    </svg>

    <span class="apprentice-court__caption">
      <span>门庭 {{ nodes.length }}/{{ slots }}</span>
      <span class="tabular">候 {{ idle }} · 途 {{ away }}</span>
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

type CourtNode = {
  uid: string;
  mark: string;
  idle: boolean;
  /** 在途进度 0~100；候差节点不使用 */
  progress: number;
};

const props = defineProps<{
  nodes: CourtNode[];
  slots: number;
  idle: number;
  away: number;
}>();

const SLOT_POSITIONS = [
  { x: 41, y: 58 },
  { x: 83, y: 39 },
  { x: 127, y: 58 },
  { x: 54, y: 101 },
  { x: 114, y: 101 },
] as const;

const placedCells = computed(() =>
  props.nodes.slice(0, SLOT_POSITIONS.length).map((node, i) => ({
    ...SLOT_POSITIONS[i]!,
    node: {
      ...node,
      progress: Math.max(0, Math.min(100, node.progress)),
    },
  })),
);

const emptyCells = computed(() =>
  SLOT_POSITIONS.slice(props.nodes.length, props.slots).map((cell, i) => ({
    ...cell,
    key: `empty-${i}`,
  })),
);
</script>

<style scoped>
.apprentice-court {
  position: relative;
  display: grid;
  width: 168px;
  height: 146px;
  place-items: center;
  isolation: isolate;
}

.apprentice-court::before {
  position: absolute;
  inset: 13px 8px 18px;
  border: 1px solid rgb(var(--color-ink-rgb) / 0.07);
  border-radius: 43% 43% 8% 8%;
  background:
    linear-gradient(180deg, rgb(var(--color-paper-rgb) / 0.72), transparent 66%),
    rgb(var(--color-paper-deep-rgb) / 0.14);
  box-shadow: inset 0 0 24px rgb(var(--color-ink-rgb) / 0.03);
  content: "";
}

.apprentice-court svg {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.apprentice-court__wall,
.apprentice-court__wall-shadow,
.apprentice-court__gate,
.apprentice-court__roof,
.apprentice-court__hall,
.apprentice-court__way {
  fill: none;
}

.apprentice-court__wall {
  stroke: rgb(var(--color-ink-rgb) / 0.16);
  stroke-width: 1;
}

.apprentice-court__wall-shadow {
  stroke: rgb(var(--color-ink-rgb) / 0.045);
  stroke-dasharray: 2 4;
  stroke-width: 5;
}

.apprentice-court__gate {
  stroke: rgb(var(--color-cinnabar-rgb) / 0.28);
  stroke-width: 1;
}

.apprentice-court__roof {
  fill: rgb(var(--color-ink-rgb) / 0.045);
  stroke: rgb(var(--color-ink-rgb) / 0.22);
  stroke-width: 0.9;
}

.apprentice-court__hall {
  fill: rgb(var(--color-paper-lifted-rgb) / 0.9);
  stroke: rgb(var(--color-cinnabar-rgb) / 0.3);
  stroke-width: 0.9;
}

.apprentice-court__hall-mark {
  fill: rgb(var(--color-cinnabar-rgb));
  font-family: var(--font-kai);
  font-size: 10px;
}

.apprentice-court__way {
  stroke: rgb(var(--color-ink-rgb) / 0.1);
  stroke-dasharray: 1.4 3;
  stroke-width: 0.8;
}

.apprentice-court__way.is-away {
  stroke: rgb(var(--color-qing-rgb) / 0.26);
  stroke-dasharray: 3 3;
}

.apprentice-court__person-disc {
  fill: rgb(var(--color-paper-lifted-rgb) / 0.94);
  stroke: rgb(var(--color-ink-rgb) / 0.22);
  stroke-width: 0.9;
}

.apprentice-court__person-mark {
  fill: rgb(var(--color-ink-soft-rgb));
  font-family: var(--font-kai);
  font-size: 8px;
}

.apprentice-court__person.is-idle .apprentice-court__person-disc {
  stroke: rgb(var(--color-cinnabar-rgb) / 0.36);
}

.apprentice-court__person.is-away .apprentice-court__person-disc {
  fill: rgb(var(--color-paper-rgb) / 0.72);
  stroke: rgb(var(--color-qing-rgb) / 0.42);
  stroke-dasharray: 2 2;
}

.apprentice-court__person-progress {
  fill: none;
  stroke: rgb(var(--color-qing-rgb) / 0.72);
  stroke-linecap: butt;
  stroke-width: 1.6;
}

.apprentice-court__ready-dot {
  fill: rgb(var(--color-cinnabar-rgb));
  stroke: rgb(var(--color-paper-lifted-rgb));
  stroke-width: 0.9;
}

.apprentice-court__empty circle {
  fill: none;
  stroke: rgb(var(--color-ink-rgb) / 0.09);
  stroke-dasharray: 2 2;
  stroke-width: 0.8;
}

.apprentice-court__empty path {
  stroke: rgb(var(--color-ink-rgb) / 0.13);
  stroke-width: 0.8;
}

.apprentice-court__caption {
  position: absolute;
  z-index: 2;
  right: 0.1rem;
  bottom: 0.06rem;
  display: flex;
  gap: 0.42rem;
  color: rgb(var(--color-ink-faint-rgb));
  font-family: var(--font-kai);
  font-size: var(--type-note);
  letter-spacing: 0.08em;
}

.apprentice-court__caption span:last-child {
  color: rgb(var(--color-ink-soft-rgb));
}

@media (prefers-reduced-motion: no-preference) {
  .apprentice-court__person {
    animation: apprentice-court-arrive 0.4s ease-out both;
  }

  .apprentice-court__person:nth-of-type(2) {
    animation-delay: 0.05s;
  }

  .apprentice-court__person:nth-of-type(3) {
    animation-delay: 0.1s;
  }

  .apprentice-court__person:nth-of-type(4) {
    animation-delay: 0.15s;
  }

  .apprentice-court__person:nth-of-type(5) {
    animation-delay: 0.2s;
  }
}

@keyframes apprentice-court-arrive {
  from {
    opacity: 0;
    transform: translateY(2px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
