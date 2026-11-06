<template>
  <article :data-achievement-id="row.def.id" class="achievement-entry">
    <span
      class="achievement-entry__state"
      :class="{
        'is-done': row.done,
        'is-live': !row.done && row.target !== null,
      }"
    >
      {{ row.done ? "成" : row.percent === null ? "未" : `${row.percent}%` }}
    </span>
    <div class="achievement-entry__copy">
      <div class="achievement-entry__line">
        <p class="text-body" :class="row.done ? 'text-ink' : 'text-ink-soft'">
          {{ row.def.name }}
        </p>
        <span
          class="achievement-entry__progress tabular"
          :class="row.done ? 'text-gold-ink' : 'text-qing'"
          >{{ row.label }}</span
        >
      </div>
      <p class="achievement-entry__desc">{{ row.def.desc }}</p>
      <ProgressBar
        v-if="!row.done && row.target !== null"
        class="achievement-entry__meter"
        :value="row.ratio"
        color="var(--color-cinnabar)"
        :height="2"
      />
      <!-- 达成才现赏:名目成时、所获同露 —— 称号是成就赏的大头,一颗不漏 -->
      <p v-if="row.done && row.rewardText" class="achievement-entry__reward tabular">
        {{ row.rewardText }}
      </p>
    </div>
  </article>
</template>

<script setup lang="ts">
import type { AchievementProgressRow } from "@/core/achievementProgress";
import ProgressBar from "@/components/common/ProgressBar.vue";

/**
 * 一条功名 —— 未达成与已达成共用同一行账。
 *
 * 抽成组件是因为「在追」与「已成」两叠各要铺一次同一行;手抄两遍之后,
 * 进度条、赏格与读屏文案迟早漂成两套。样式仍住 collection.css(页面级纸面),
 * 组件只负责结构与数据接线。
 */
defineProps<{ row: AchievementProgressRow & { rewardText: string } }>();
</script>
