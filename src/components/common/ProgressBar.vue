<template>
  <div class="track-ink w-full" :style="{ height: `${props.height}px` }">
    <div class="bar-fill" :style="{ width, background: props.color }" />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { percentWidth } from "@/utils/unitRatio";

const props = withDefaults(
  defineProps<{
    /** 0~1 */
    value: number;
    color?: string;
    height?: number;
  }>(),
  { color: "var(--color-jade)", height: 6 },
);

/**
 * 宽度走 unitRatio:脏值(NaN / Infinity)归零。
 * 裸夹取时 NaN 会一路穿到 `width: NaN%` —— 浏览器整条样式丢掉,
 * 进度条**消失**且控制台干净,而调用方拿脏值是真实会发生的事
 * (坏档 / 除零的比值)。
 */
const width = computed(() => percentWidth(props.value));
</script>
