<template>
  <!-- 图标一律是正文的装饰陪衬(文字已把含义说全),不许让读屏去念路径;
        焦点也不该落在装饰性 SVG 上 —— 与全站 brush-bar/远山同款的 aria-hidden -->
  <component
    :is="icon"
    :size="props.size"
    :stroke-width="1.8"
    aria-hidden="true"
    focusable="false"
  />
</template>

<script setup lang="ts">
import { computed } from "vue";
import { iconOf } from "@/ui/inkIcons";

const props = withDefaults(defineProps<{ name: string; size?: number }>(), { size: 16 });

const icon = computed(() => iconOf(props.name));
</script>
