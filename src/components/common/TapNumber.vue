<template>
  <!--
    可点的大数 —— 缩写照旧(排版不动),点一下看它到底是多少。
    下划线只画在数字上(点线),不抢视觉;点开的行为交给全局浮层,故这里不改任何布局。
  -->
  <!--
    命中区取 30px 而不是 28:自检量到 27.9 也会算「不到 28」(亚像素),留 2px 余量。
    负外边距把多出来的高度从行距里抵掉,视觉上仍是原来那一行字。
  -->
  <button
    type="button"
    class="-my-1 inline-flex min-h-[30px] items-center tabular underline decoration-dotted decoration-ink/35 underline-offset-2 active:opacity-60"
    @click="open"
  >
    <slot>{{ formatGN(value) }}</slot>
  </button>
</template>

<script setup lang="ts">
  import { useUiStore } from '@/stores/ui'
  import { formatGN } from '@/utils/format'
  import type { GNum } from '@/types'

  const props = defineProps<{
    /** 被点的那个数 */
    value: GNum | number
    /** 浮层标题(如「修为」) */
    title: string
    /** 同族的其它读数(所需 / 还需 / 每秒…)—— 按传入顺序排在"精确值"之后 */
    rows?: { label: string; value?: GNum | number; text?: string; hint?: string }[]
    /** 一句人话(如「按当前速率还需 3 天 2 时」) */
    note?: string
  }>()

  const ui = useUiStore()

  function open(): void {
    ui.numberDetail = {
      title: props.title,
      // 第一行永远是"这个数本身",其余由调用方给 —— 这样每个接入点都能说自己那一族的口径
      rows: [{ label: '精确值', value: props.value }, ...(props.rows ?? [])],
      note: props.note
    }
  }
</script>
