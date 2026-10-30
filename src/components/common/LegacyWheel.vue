<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  life: number;
  stageMark: string;
  stageRatio: number;
  loreRatio: number;
  fateRatio: number;
}>();

const TRACK_LENGTH = 27;
const ARC_STARTS = [0, 120, 240];

function ratio(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

const arcs = computed(() => [
  { key: "life", start: ARC_STARTS[0]!, length: TRACK_LENGTH * ratio(props.stageRatio) },
  { key: "lore", start: ARC_STARTS[1]!, length: TRACK_LENGTH * ratio(props.loreRatio) },
  { key: "fate", start: ARC_STARTS[2]!, length: TRACK_LENGTH * ratio(props.fateRatio) },
]);

const nodes = [
  { key: "life", label: "世", x: 70, y: 18 },
  { key: "lore", label: "识", x: 29, y: 106 },
  { key: "fate", label: "缘", x: 111, y: 106 },
] as const;
</script>

<template>
  <!--
    三生盘只做卷首主视觉：外圈同报宿慧阶梯、随身所知与未了缘，
    精确读数都在卷首 meta 与正文总案里，故整盘不重复进入读屏。
  -->
  <div class="legacy-wheel" data-legacy-wheel aria-hidden="true">
    <svg viewBox="0 0 140 140" role="presentation">
      <circle class="legacy-wheel__rim" cx="70" cy="70" r="66" />
      <circle
        class="legacy-wheel__ticks"
        cx="70"
        cy="70"
        r="61"
        pathLength="100"
        stroke-dasharray="0.8 3.2"
      />

      <g transform="rotate(-90 70 70)">
        <circle
          v-for="start in ARC_STARTS"
          :key="start"
          class="legacy-wheel__track"
          cx="70"
          cy="70"
          r="54"
          pathLength="100"
          :stroke-dasharray="`${TRACK_LENGTH} ${100 - TRACK_LENGTH}`"
          :stroke-dashoffset="-start"
        />
        <circle
          v-for="arc in arcs"
          :key="arc.key"
          class="legacy-wheel__arc"
          :class="`legacy-wheel__arc--${arc.key}`"
          cx="70"
          cy="70"
          r="54"
          pathLength="100"
          :stroke-dasharray="`${arc.length} ${100 - arc.length}`"
          :stroke-dashoffset="-arc.start"
        />
      </g>

      <circle class="legacy-wheel__inner" cx="70" cy="70" r="39" />
      <line
        v-for="node in nodes"
        :key="node.key"
        class="legacy-wheel__spoke"
        x1="70"
        y1="70"
        :x2="node.x"
        :y2="node.y"
      />

      <g
        v-for="node in nodes"
        :key="node.key"
        class="legacy-wheel__node"
        :class="`legacy-wheel__node--${node.key}`"
        :transform="`translate(${node.x} ${node.y})`"
      >
        <circle r="10.5" />
        <text y="3.5" text-anchor="middle">{{ node.label }}</text>
      </g>

      <rect class="legacy-wheel__seal" x="52" y="52" width="36" height="36" />
      <rect class="legacy-wheel__seal-inset" x="55.5" y="55.5" width="29" height="29" />
      <text
        class="legacy-wheel__seal-name"
        x="70"
        y="73"
        text-anchor="middle"
        dominant-baseline="middle"
      >
        {{ stageMark }}
      </text>
      <text class="legacy-wheel__life" x="70" y="99" text-anchor="middle">第 {{ life }} 世</text>
    </svg>
  </div>
</template>
