<template>
  <p
    class="mt-1.5 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 rounded-md border border-cinnabar/20 bg-cinnabar/4 px-2 py-1 text-note leading-relaxed text-cinnabar tabular"
  >
    <GameIcon name="wind" :size="11" class="shrink-0" />
    <span class="font-kai">尚差 {{ formatNum(short) }} 灵气</span>
    <span class="text-ink-faint">· 按当前回复{{ eta }}</span>
  </p>
</template>

<script setup lang="ts">
import { formatNum } from "@/utils/format";
import GameIcon from "@/components/common/GameIcon.vue";

defineProps<{
  /** 还差多少灵气(整数) */
  short: number;
  /** 按当前回复速度折算的人话,如「约 2分31秒」 */
  eta: string;
}>();
</script>
