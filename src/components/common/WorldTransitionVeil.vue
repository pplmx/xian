<template>
  <!--
    世界变迁宣告:人间 → 仙界 → 神界 → 混沌,越过界膜那一刻的正式宣言。
    只动氛围层(光晕 + 一方印碑),pointer-events-none 不挡操作、absolute 不占几何;
    挂饰组件自带判据(announceWorldEntry 纯函数),视图不重复"要不要响"的判断。
  -->
  <Transition name="veil-fade">
    <div
      v-if="rite"
      class="pointer-events-none absolute inset-0 z-40 flex items-center justify-center"
      aria-hidden="true"
    >
      <span class="veil-glow" />
      <div class="veil-plaque animate-ink-pop">
        <p class="text-[11px] tracking-[0.5em] text-ink-faint">顿 开 界 膜</p>
        <p class="mt-1.5 font-kai text-[25px] leading-none tracking-[0.45em] text-cinnabar">{{ rite.name }}</p>
        <p class="mt-2 max-w-[230px] text-center text-[11px] leading-relaxed text-ink-soft">{{ rite.desc }}</p>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
  import { onUnmounted, ref, watch } from 'vue'
  import { usePlayerStore } from '@/stores/player'
  import { announceWorldEntry } from '@/core/worldRite'
  import type { WorldDef } from '@/data/realms'

  /** 此刻宣告的这一界;null = 无宣告在场 */
  const rite = ref<WorldDef | null>(null)
  /** window.setTimeout 的句柄(DOM 域返回 number;别用 Node 的 Timeout 类型) */
  let timer: number | undefined

  /**
   * 该响才响:判据完全交给 announceWorldEntry(上行大界 / 出生人间不响 / 转世回落不响)。
   * 立即 watch 关闭 —— 载入存档不该补一遍旧账,跨越只会发生在游玩途中。
   */
  watch(
    () => usePlayerStore().major,
    (next, prev) => {
      const w = announceWorldEntry(prev, next)
      if (!w) return
      rite.value = w
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        rite.value = null
      }, 2800)
    }
  )

  onUnmounted(() => {
    window.clearTimeout(timer)
  })
</script>
