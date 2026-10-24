<template>
  <!--
    可点的大数 —— 缩写照旧(排版不动),点一下看它到底是多少。
    下划线只画在数字上(点线),不抢视觉;点开的行为交给全局浮层,故这里不改任何布局。
  -->
  <!--
    命中区取 30px 而不是 28:自检量到 27.9 也会算「不到 28」(亚像素),留 2px 余量。
    负外边距把多出来的高度从行距里抵掉,视觉上仍是原来那一行字。

    **宽度也要够**:一个三位缩写(「5.7」)实测只有 17.5px 宽,高度给足了照样点不准 ——
    28px 是触控下限的两个轴,不是只有高度那一个。横向补到 28 用负外边距抵掉
    (`-mx-1.5 px-1.5`):多出来的 12px 从行距里让出去,下划线仍只画在数字上,
    与旁边的「/ 所需」之间的视觉间隔一分不变。
  -->
  <button
    type="button"
    class="-mx-1.5 -my-1 inline-flex min-h-[30px] min-w-[28px] items-center justify-center px-1.5 tabular underline decoration-dotted decoration-ink/35 underline-offset-2 active:opacity-60"
    @click="open"
  >
    <slot>{{ formatGN(value) }}</slot>
  </button>
</template>

<script setup lang="ts">
import { useUiStore } from "@/stores/ui";
import { formatGN } from "@/utils/format";
import type { GNum } from "@/types";

const props = defineProps<{
  /** 被点的那个数 */
  value: GNum | number;
  /** 浮层标题(如「修为」) */
  title: string;
  /** 同族的其它读数(所需 / 还需 / 每秒…)—— 按传入顺序排在"精确值"之后 */
  rows?: { label: string; value?: GNum | number; text?: string; hint?: string }[];
  /** 一句人话(如「按当前速率还需 3 天 2 时」) */
  note?: string;
}>();

const ui = useUiStore();

function open(): void {
  ui.numberDetail = {
    title: props.title,
    // 第一行永远是"这个数本身",其余由调用方给 —— 这样每个接入点都能说自己那一族的口径
    rows: [{ label: "精确值", value: props.value }, ...(props.rows ?? [])],
    note: props.note,
  };
}
</script>
