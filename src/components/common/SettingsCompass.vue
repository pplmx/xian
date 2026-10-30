<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  soundLevel: number;
  sightLevel: number;
  keepLevel: number;
  quiet: boolean;
  backupState: "never" | "stale" | "fresh";
}>();

const TRACK_LENGTH = 27;
const ARC_STARTS = [0, 34, 68];

function ratio(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

const arcs = computed(() => [
  {
    key: "sound",
    start: ARC_STARTS[0]!,
    length: TRACK_LENGTH * ratio(props.soundLevel),
  },
  {
    key: "sight",
    start: ARC_STARTS[1]!,
    length: TRACK_LENGTH * ratio(props.sightLevel),
  },
  {
    key: "keep",
    start: ARC_STARTS[2]!,
    length: TRACK_LENGTH * ratio(props.keepLevel),
  },
]);

const nodes = [
  { key: "sound", label: "声", x: 70, y: 18 },
  { key: "sight", label: "观", x: 29, y: 106 },
  { key: "keep", label: "守", x: 111, y: 106 },
] as const;
</script>

<template>
  <!--
    天机盘只做卷首主视觉：外圈三段同报声息、观照与存续的强弱，
    精确读数都在标题下的 meta 与正文三案里，故整盘不重复进入读屏。
  -->
  <div
    class="settings-compass"
    data-settings-compass
    :data-sound="quiet ? 'quiet' : 'on'"
    :data-backup="backupState"
    aria-hidden="true"
  >
    <svg viewBox="0 0 140 140" role="presentation">
      <circle class="settings-compass__rim" cx="70" cy="70" r="66" />
      <circle
        class="settings-compass__ticks"
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
          class="settings-compass__track"
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
          class="settings-compass__arc"
          :class="`settings-compass__arc--${arc.key}`"
          cx="70"
          cy="70"
          r="54"
          pathLength="100"
          :stroke-dasharray="`${arc.length} ${100 - arc.length}`"
          :stroke-dashoffset="-arc.start"
        />
      </g>

      <circle class="settings-compass__inner" cx="70" cy="70" r="39" />
      <line
        v-for="node in nodes"
        :key="node.key"
        class="settings-compass__spoke"
        x1="70"
        y1="70"
        :x2="node.x"
        :y2="node.y"
      />

      <g
        v-for="node in nodes"
        :key="node.key"
        class="settings-compass__node"
        :class="`settings-compass__node--${node.key}`"
        :transform="`translate(${node.x} ${node.y})`"
      >
        <circle r="10.5" />
        <text y="3.5" text-anchor="middle">{{ node.label }}</text>
      </g>

      <rect class="settings-compass__seal" x="52" y="52" width="36" height="36" />
      <rect class="settings-compass__seal-inset" x="55.5" y="55.5" width="29" height="29" />
      <text
        class="settings-compass__seal-name"
        x="70"
        y="73"
        text-anchor="middle"
        dominant-baseline="middle"
      >
        枢
      </text>
    </svg>
  </div>
</template>
