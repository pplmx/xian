<template>
  <p class="mb-1 font-kai text-[10px] tracking-[0.5em] text-ink-faint">{{ text }}</p>
</template>

<script setup lang="ts">
/**
 * 宽排楷体组标 —— 分组清单的组头(「入 账」「十 二 宫」「主 星」)。
 *
 * 归来卡、紫微册三处同款版式的组件化:tracking 0.5em 的留白当分隔,
 * 与页签同一支水墨口气。组内条目紧随其下,组与组之间用 ink-divider 分。
 */
defineProps<{ text: string }>();
</script>
