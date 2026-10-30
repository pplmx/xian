<template>
  <!--
    一张「往里走」的卡 —— 人物页那九张,以及全库另外十几处,本来逐字重复同一套骨架:
      card-ink flex items-center gap-3 px-4 py-3 / 16px 题头图 / 14px 楷体名
      / 10px 淡副行 / 11px 动作词。

    重复的代价不是行数,是**漂移**:同一套骨架手抄九遍之后,某一张的 py 变成 2.5、
    某一枚的图标变成 15px、某一张副行忘了 tabular —— 而这些都没人会觉得是 bug。
    收成一件之后,"入口卡长什么样"只有一个答案。

    三个部件各就各位,顺序固定为 图 → 文(名 / 副行) → 动作词:
      · **动作词**是这卡的语气(展卷 / 参详 / 观想 / 拜师),按 tone 上色;
      · **副行**是这卡此刻的状态,一律 10px 淡字 —— 它是注解,不是标题;
      · **徽标**是「有事在等你说」的那一枚(卦在身 / 有话说),塞在名号前面。

    用 RouterLink 还是 button 由 `to` 决定:能走就走,不能走就是按钮。
  -->
  <component
    :is="to ? RouterLink : 'button'"
    :to="to"
    class="card-ink flex w-full items-start gap-3 px-4 py-3 text-left active:scale-99"
    v-bind="to ? {} : { type: 'button' }"
  >
    <!--
      图标顶对齐到卡名那一行、而不是整张卡垂直居中。
      卡里是「一行名 + 一行副」时居中看着没问题;副行一到两行,居中就把图标
      压到两行之间,读着像它属于副行。顶对齐后图标永远站在卡名旁边。
      mt 那一行把 16px 的图标抬到 14px 楷体名的小字面中心。
    -->
    <GameIcon :name="icon" :size="16" class="mt-1 shrink-0" :class="TONE[tone].icon" />
    <span class="min-w-0 grow">
      <!--
        卡名与动作词同一基线 —— 动作词是卡名的语气,不是副行的尾巴。
        此前它挂在整张卡的右侧垂直居中,视觉上贴着副行,读起来像副行的一部分;
        副行一长,它又把副行挤成两行(截图里「修行画像」那张就是这样)。
      -->
      <span class="flex items-baseline justify-between gap-2">
        <span class="min-w-0 font-kai text-title tracking-[0.25em] text-ink">{{ title }}</span>
        <span class="shrink-0 text-body" :class="TONE[tone].text">{{ action }} →</span>
      </span>
      <span
        class="mt-0.5 block text-note text-ink-faint"
        :class="clampSub ? 'line-clamp-2 leading-relaxed' : 'truncate'"
      >
        <span
          v-if="badge"
          class="chip-ink mr-1 border-current align-middle text-note"
          :class="TONE[tone].text"
          >{{ badge }}</span
        ><slot name="sub">{{ sub }}</slot>
      </span>
    </span>
  </component>
</template>

<script setup lang="ts">
import { RouterLink } from "vue-router";
import GameIcon from "@/components/common/GameIcon.vue";

/**
 * 五个色调 —— 与人物页那九张卡原本各自的色一一对应:
 * 朱砂=道途(路数)、墨=记录(来历)、青=缘法(人)、玉=名号(身份)、
 * 金=藏珍、紫=轮回(跨世)。色调不是装饰,它让「这张卡在讲哪一类事」
 * 在读到字之前就分得开。
 */
const TONE = {
  cinnabar: { icon: "text-cinnabar", text: "text-cinnabar" },
  ink: { icon: "text-ink-soft", text: "text-ink-soft" },
  qing: { icon: "text-qing", text: "text-qing" },
  jade: { icon: "text-jade", text: "text-jade" },
  gold: { icon: "text-gold-ink", text: "text-gold-ink" },
  violet: { icon: "text-violet-ink", text: "text-violet-ink" },
} as const;

withDefaults(
  defineProps<{
    /** 题头图标名(见 GameIcon 的图标表) */
    icon: string;
    /** 卡名 —— 楷体,卡里唯一的主文案 */
    title: string;
    /** 副行(此刻状态的读数 / 一句话交代)。也可用 #sub 插槽塞更复杂的结构 */
    sub?: string;
    /** 动作词,自动缀「→」:参详 / 展卷 / 观想 …… */
    action: string;
    /** 目标路由;不给就是按钮(要 @click) */
    to?: string;
    /** 色族,默认墨色 */
    tone?: keyof typeof TONE;
    /** 副行前面那枚「有事在等你说」的徽标 */
    badge?: string;
    /** 副行给两行(画像叙述这类会拦腰断句的长句);默认单行截断 */
    clampSub?: boolean;
  }>(),
  { sub: "", to: undefined, tone: "ink", badge: "", clampSub: false },
);
</script>
