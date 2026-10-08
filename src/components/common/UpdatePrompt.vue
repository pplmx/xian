<script setup lang="ts">
/**
 * 版本更新提示 —— PWA 有新版已就绪时,浮一条「点击刷新」。
 * 判据与监听在 App.vue(useServiceWorkerUpdate):这里只负责把「刷新」按钮亮出来。
 */
defineProps<{ visible: boolean }>();
defineEmits<{ refresh: [] }>();
</script>

<template>
  <Transition name="page-fade">
    <div
      v-if="visible"
      class="absolute left-0 right-0 top-2 z-[60] mx-auto flex max-w-xs items-center gap-2 rounded-lg border border-cinnabar/40 bg-paper-deep/95 px-3 py-2 shadow-lg backdrop-blur"
      role="status"
    >
      <span class="flex-1 text-[11px] text-ink">新版本已就绪,存好了再刷新即可。</span>
      <button class="btn-seal !px-2.5 !py-1 text-[11px]" @click="$emit('refresh')">刷 新</button>
    </div>
  </Transition>
</template>
