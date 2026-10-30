<template>
  <div class="flex items-baseline gap-2">
    <span class="shrink-0 text-body text-ink-faint">{{ label }}</span>
    <span class="font-kai text-section" :class="colorClass">{{ value }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

/**
 * 主读数行 —— 「题→用→读」三档结构里「用」的那一行(此页据以行动的结论)。
 *
 * 这是全库第四处同款版式的组件化:师承契合度、命格之力、今日利、道果凝后
 * 原先各自手写一段同样的 flex,措辞与层级迟早分叉。label 走 11px 淡字、
 * 值走 15px 楷体(字阶档内),颜色传语义色类名(如 text-jade / text-gold-ink)。
 *
 * 两端撑开的变体(label 左、值右)见 data-value-row 的 justify-between 用例 ——
 * 本组件是「挨着放」版:label 与值是一句话,撑开会被读成两栏互不相干。
 */
const props = defineProps<{
  label: string;
  value: string;
  /** 语义色类名(如 "text-jade"),缺省 ink */
  color?: string;
}>();

const colorClass = computed(() => props.color ?? "text-ink");
</script>
