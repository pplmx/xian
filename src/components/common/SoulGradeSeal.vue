<template>
  <span
    class="inline-flex shrink-0 items-center justify-center rounded-[3px] border font-kai leading-none"
    :style="{
      width: `${size}px`,
      height: `${size}px`,
      borderColor: colorWithAlpha(tone, 0.45),
      background: colorWithAlpha(tone, 0.12),
      color: tone,
    }"
    :class="size >= 16 ? 'text-body' : 'text-[9px]'"
    :aria-label="`${gradeName}阶`"
    >{{ head }}</span
  >
</template>

<script setup lang="ts">
import { computed } from "vue";
import { soulGradeDef, soulGradeSeal } from "@/data/souls";
import { colorWithAlpha } from "@/ui/colorVar";

/**
 * 器魂阶的阴文章 —— 六阶的第二条区分线索,不靠颜色单打。
 *
 * ## 为什么器魂也要一枚章
 *
 * 九档品质那侧有一条写了很久的纪律(见 `ui/qualityTier`):
 *
 *   > 稀有档另有角章作形状线索 —— 色弱玩家不靠颜色也能分档。
 *
 * 装备格、功法书目、法宝行卡、候选件、坊市货架、灵兽谱、九佩都照做了。
 * 器魂此前只有阶色与阶名 —— 而六阶的倍率是 1.0 → 2.3,色弱玩家读不出那一格色的差别
 * 等于读不出强弱。
 *
 * ## 与 QualitySeal 分开成一个组件,而不是给它加一个 mode
 *
 * 两者的**界**不一样:九档那边只给稀有段(rank ≥ 6)盖章,器魂六阶则每一阶都盖
 * (六阶没有「稀有段」那回事,分档本来就是它的全部)。界不同,判据不同,
 * 硬塞进同一个组件会让两边都长出条件分支 —— 分成两个小组件,各自一眼可读。
 *
 * 画法完全一致(纸底 + 阶色字 + 细边):不新增第二套记号语言。
 */
const props = withDefaults(
  defineProps<{
    /** 器魂阶 rank(0 朦胧 … 5 化真) */
    grade: number;
    /** 章边长(px);行内用 14,格子上用 16~18 */
    size?: number;
  }>(),
  { size: 13 },
);

const def = computed(() => soulGradeDef(props.grade));
const gradeName = computed(() => def.value.name);
const tone = computed(() => def.value.color);
const head = computed(() => soulGradeSeal(props.grade));
</script>
