<template>
  <div class="flex items-baseline gap-2 px-1">
    <!--
      双笔 —— 研墨是两落:一笔主(随世界换色)、一笔副(只留一道墨痕)。

      原先只有一根 3px 竖条。单看没毛病,可与全库上百处「列表项题头」摆在一起就不够
      分了 —— 竖条太轻,章节与行目读着同一级。并置两笔之后,同一个元素立刻读作「笔杆」:
      主笔是落下的那道,副笔是提笔时带出的余墨,粗细一正一副,和朱砂/墨的层次一致。

      两笔共用一个 brush-bar:入场时一起自上而下长出来,不会一笔先到一笔后到。
    -->
    <span class="brush-bar flex h-3 shrink-0 items-stretch gap-0.5" aria-hidden="true">
      <span class="w-0.75 rounded bg-[var(--world-bar)]" />
      <span class="w-px rounded bg-ink/20" />
    </span>
    <h2 class="font-kai text-[15px] tracking-[0.25em] text-ink">{{ title }}</h2>
    <span v-if="hint" class="shrink-0 tabular text-[11px] text-ink-faint">{{ hint }}</span>
    <!--
      尾线 —— 把这一节与下一节分开的那一手。

      书籍排版的章节头从来不靠字号划分,靠的是「标题 + 一条把行拉满的线」:线一走完,
      正文才开始。这里同理 —— 有它,章节是版面的一块;没它,标题只是一行加粗的字。

      窄屏上它先让位(min-w-1):章节名与 hint 是信息,这条线只是手势,
      让到底也不会少读到什么。故它取 flex-1 却只保底 4px,不用 shrink-0 死守。
    -->
    <span
      class="h-px min-w-1 flex-1 self-center bg-gradient-to-r from-ink/15 to-transparent"
      aria-hidden="true"
    />
  </div>
</template>

<script setup lang="ts">
defineProps<{ title: string; hint?: string }>();
</script>
