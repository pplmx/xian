<script setup lang="ts">
/**
 * 版本更新提示 —— PWA 有新版已就绪时,浮一条「点击刷新」。
 * 判据与监听在 App.vue(useServiceWorkerUpdate):这里只负责把「刷新」按钮亮出来。
 *
 * 提供「稍后」。这条横幅原先**只有**「刷 新」一个键,而 `updateReady` 在
 * App.vue 里只有写成 true 的那一处、没有任何写回 false 的路径 —— 于是它一旦亮起
 * 就永久挂在屏幕顶上,直到玩家真的刷新。玩家若此刻正在一场战斗/一次突破的中间,
 * 那条横幅就成了一块擦不掉的膏药:它不是错误,却也赶不走。
 *
 * 「稍后」只收起**这一版**的提示(记在 localStorage,见 useServiceWorkerUpdate 的
 * `SEEN_VERSION_KEY`):同一版不再打扰,真的发了下一版仍会亮。
 */
defineProps<{ visible: boolean }>();
defineEmits<{ refresh: []; later: [] }>();
</script>

<template>
  <Transition name="page-fade">
    <div
      v-if="visible"
      class="absolute left-0 right-0 top-2 z-[60] mx-auto flex max-w-xs items-center gap-2 rounded-sm border border-cinnabar/40 bg-paper-deep/95 px-3 py-2 shadow-lg backdrop-blur"
      role="status"
    >
      <span class="flex-1 text-body text-ink">新版本已就绪,存好了再刷新即可。</span>
      <button class="btn-seal !px-2.5 !py-1 text-body" @click="$emit('refresh')">刷 新</button>
      <button
        class="shrink-0 px-1 text-note text-ink-faint active:text-ink-soft"
        aria-label="稍后再刷新"
        @click="$emit('later')"
      >
        稍后
      </button>
    </div>
  </Transition>
</template>
