<script setup lang="ts">
import { computed } from "vue";
import type { BuildAffinityRow } from "@/core/buildDetect";

const props = defineProps<{
  rows: BuildAffinityRow[];
  centerSeal: string;
  stageLabel: string;
  activeId?: string;
}>();

const ARC_SPAN = 13;

function ratio(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

const segments = computed(() => {
  const step = props.rows.length > 0 ? 100 / props.rows.length : 100;
  return props.rows.map((row, index) => ({
    ...row,
    angle: (index * 360) / Math.max(1, props.rows.length),
    start: index * step + 1.6,
    arc: ARC_SPAN * ratio(row.affinity),
  }));
});

const formed = computed(() => props.stageLabel !== "未成");
</script>

<template>
  <!--
    铸道盘只做卷首主视觉：六枚路印、六段契合弧与中心当前路印都来自同一份
    流派契合行。精确路名、缺口、星级与对局都在正文完整出现，故整盘不重进读屏。
  -->
  <div class="build-atlas" :class="{ 'is-formed': formed }" data-build-atlas aria-hidden="true">
    <svg viewBox="0 0 220 220" role="presentation">
      <circle class="build-atlas__rim" cx="110" cy="110" r="104" />
      <circle
        class="build-atlas__ticks"
        cx="110"
        cy="110"
        r="99"
        pathLength="100"
        stroke-dasharray="0.7 3.3"
      />

      <g transform="rotate(-90 110 110)">
        <circle
          v-for="(row, index) in segments"
          :key="`track-${row.style.id}`"
          class="build-atlas__track"
          cx="110"
          cy="110"
          r="91"
          pathLength="100"
          :stroke-dasharray="`${ARC_SPAN} ${100 - ARC_SPAN}`"
          :stroke-dashoffset="-((index * 100) / segments.length + 1.6)"
        />
        <circle
          v-for="row in segments"
          :key="`arc-${row.style.id}`"
          class="build-atlas__arc"
          :class="{ 'is-active': row.activeTerms > 0 }"
          cx="110"
          cy="110"
          r="91"
          pathLength="100"
          :stroke-dasharray="`${row.arc} ${100 - row.arc}`"
          :stroke-dashoffset="-row.start"
        />
      </g>

      <circle class="build-atlas__inner" cx="110" cy="110" r="62" />

      <g
        v-for="row in segments"
        :key="row.style.id"
        class="build-atlas__node"
        :class="{
          'is-active': row.activeTerms > 0,
          'is-leading': row.style.id === activeId,
        }"
        :transform="`rotate(${row.angle} 110 110)`"
      >
        <line class="build-atlas__spoke" x1="110" y1="72" x2="110" y2="46" />
        <circle cx="110" cy="31" r="14" />
        <text x="110" y="35" text-anchor="middle">{{ row.style.seal }}</text>
      </g>

      <rect class="build-atlas__seal" x="83" y="82" width="54" height="54" />
      <rect class="build-atlas__seal-inset" x="87" y="86" width="46" height="46" />
      <text class="build-atlas__seal-name" x="110" y="115" text-anchor="middle">
        {{ centerSeal }}
      </text>
      <text class="build-atlas__stage" x="110" y="145" text-anchor="middle">
        {{ stageLabel }}
      </text>
    </svg>
  </div>
</template>
