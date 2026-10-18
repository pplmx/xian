<template>
  <span
    class="inline-flex shrink-0 items-center justify-center rounded-[3px] border font-kai leading-none"
    :style="{
      ...boxStyle,
      borderColor: colorWithAlpha(tone, 0.45),
      background: colorWithAlpha(tone, 0.12),
      color: tone,
    }"
    :class="sizeClass"
    :aria-label="`${qualityName}档`"
    >{{ qualityName.charAt(0) }}</span
  >
</template>

<script setup lang="ts">
import { computed } from "vue";
import { qualityDef } from "@/data/qualities";
import type { QualityId } from "@/types";
import { colorWithAlpha } from "@/ui/colorVar";

/**
 * 品阶阴文小章 —— 高品阶的第二条区分线索,不靠颜色单打。
 *
 * 九档品阶的颜色里,良品(jade)与精品(qing)同属青绿系,纸面上几乎难分;
 * 而色弱玩家更是一条色带都读不出档。章是**形状线索**:天/仙/神这类
 * 高档位,名字首字盖一枚小章,扫一眼格子就知道「这几件不一样」。
 *
 * 用阴文(纸底 + 品阶色字 + 细边)而不是色底 + 纸字:品阶色不全是深色
 * (藤黄天品当底压不住纸字,见 palette.spec 印面节的教训);而品阶色
 * 当字色的对比度全库已由 AA 判据保证(两套主题、两张纸 ≥4.5:1)。
 */
const props = withDefaults(
  defineProps<{
    quality: QualityId;
    /** 章边长(px);行内用 14,格子上用 16~18 */
    size?: number;
  }>(),
  { size: 14 },
);

const qualityName = computed(() => qualityDef(props.quality).name);
const tone = computed(() => qualityDef(props.quality).color);
const sizeClass = computed(() => (props.size >= 16 ? "text-[11px]" : "text-[9px]"));
const boxStyle = computed(() => ({ width: `${props.size}px`, height: `${props.size}px` }));
</script>
