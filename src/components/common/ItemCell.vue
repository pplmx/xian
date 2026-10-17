<template>
  <button
    class="relative aspect-square rounded-md border transition-transform active:scale-95"
    :class="plain ? 'border-ink/15 bg-ink/[0.03]' : ''"
    :style="
      plain
        ? undefined
        : {
            borderColor: colorWithAlpha(tone, 0.33),
            background: colorWithAlpha(tone, 0.06),
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
        class="w-full truncate text-center text-[10px] leading-tight"
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

    <!-- 右下:数量/等级这类读数,统一贴这条基线 -->
    <span
      v-if="foot"
      class="absolute bottom-0.5 right-1 text-[10px] leading-none tabular"
      :class="plain ? 'text-ink-soft' : 'text-ink-soft'"
    >
      {{ foot }}
    </span>
  </button>
</template>

<script setup lang="ts">
import GameIcon from "@/components/common/GameIcon.vue";
import { colorWithAlpha } from "@/ui/colorVar";

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
withDefaults(
  defineProps<{
    icon: string;
    name: string;
    /** 品质色(plain 时忽略) */
    tone?: string;
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
  { tone: "", foot: "", plain: false, iconClass: "", size: 20, label: "" },
);
const emit = defineEmits<{ open: [] }>();
</script>
