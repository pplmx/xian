<template>
  <button
    class="relative aspect-square rounded-[2px] border transition-transform active:scale-95"
    :class="plain ? 'border-ink/15 bg-ink/[0.03]' : ''"
    :style="
      plain
        ? undefined
        : {
            borderColor: colorWithAlpha(tone, intensity.border),
            background: colorWithAlpha(tone, intensity.bg),
          }
    "
    :aria-label="label"
    @click="emit('open')"
  >
    <!--
      格心:图标 + 名字。上下各留出一条读数带(top 标记 / bottom 数量),
      故用 py-3 把内容压到正中,而不是 pb 单边 —— 单边会让整块浮在上半格。
    -->
    <span class="flex h-full w-full flex-col items-center justify-center gap-1 px-1 py-3">
      <GameIcon
        :name="icon"
        :size="size"
        :class="plain ? iconClass : undefined"
        :style="plain ? undefined : { color: tone }"
      />
      <span
        class="w-full truncate text-center text-note leading-tight"
        :class="plain ? 'text-ink-soft' : undefined"
        :style="plain ? undefined : { color: tone }"
      >
        {{ name }}
      </span>
    </span>

    <!-- 左下:标记(可选,如「共」「锁」) -->
    <span v-if="$slots.mark" class="absolute bottom-0.5 left-1 leading-none">
      <slot name="mark" />
    </span>

    <!-- 右下:数量/等级这类读数,统一贴这条基线(plain 与否同色 —— 色调只染图标与名字) -->
    <span
      v-if="foot"
      class="absolute bottom-0.5 right-1 text-note leading-none tabular text-ink-soft"
    >
      {{ foot }}
    </span>

    <!--
      右上:品阶阴文小章(天/仙/神才盖) —— 高档位的第二条区分线索。
      九档的颜色里良品与精品同属青绿系,纸面上几乎难分;章是形状线索,
      色弱玩家也读得出「这几件不一样」。强度分级见 qualityTierOf。
    -->
    <span v-if="rare" class="absolute right-0.5 top-0.5 leading-none">
      <QualitySeal :quality="quality!" :size="14" />
    </span>
  </button>
</template>

<script setup lang="ts">
import { computed } from "vue";
import GameIcon from "@/components/common/GameIcon.vue";
import QualitySeal from "@/components/common/QualitySeal.vue";
import { colorWithAlpha } from "@/ui/colorVar";
import type { QualityId } from "@/types";
import { isRareQuality, qualityTierStyle } from "@/ui/qualityTier";

/**
 * 格匣 —— 背包里三种格子(装备 / 丹药 / 材料)共用的骨架。
 *
 * 由来:这三处此前各写了一遍「aspect-square 的按钮 + 居中图标与名字 + 右下读数」,
 * 于是三处的边距、角标位置、字号彼此不同 —— 同一个页面里,玩家得学三种规矩。
 * 收成一件之后,格子只有一套度量,改一处全局生效。
 *
 * 两种底色:
 *   · 品质底色(默认) —— 装备与丹药按品质染边与底,色即品阶;
 *   · plain —— 材料没有品质档,走墨色中性底。
 */
const props = withDefaults(
  defineProps<{
    icon: string;
    name: string;
    /** 品质色(plain 时忽略) */
    tone?: string;
    /** 品阶 id —— 传入即按档分级:晕染强度随档升,天/仙/神盖角章 */
    quality?: QualityId;
    /** 右下读数:数量 / 强化等级 */
    foot?: string;
    /** 走墨色中性底(材料这类无品质的) */
    plain?: boolean;
    /** 图标色 class(plain 时用,如 "text-jade") */
    iconClass?: string;
    /** 图标尺寸 */
    size?: number;
    /** 读屏用的完整说明(名字会被截断) */
    label?: string;
  }>(),
  { tone: "", quality: undefined, foot: "", plain: false, iconClass: "", size: 20, label: "" },
);
const emit = defineEmits<{ open: [] }>();

/** 三档晕染强度与稀有档判定,同源 qualityTier(格匣与装备格共用一份,不许两本账) */
const intensity = computed(() =>
  props.quality ? qualityTierStyle(props.quality) : { border: 0.33, bg: 0.06 },
);
const rare = computed(() => !!props.quality && isRareQuality(props.quality));
</script>
