<template>
  <header class="folio-chapter-head section-title" data-folio-chapter-head>
    <!--
      栏号签 —— 一章只留一枚。

      页框本来就会给出 01、02 的序号，旧版又在旁边并置「世界色主笔 + 墨色副笔」，
      同一处章节头于是出现三重记号。这里把三者收进一枚签：签面写页内序号，右侧内嵌
      世界色书脊与一道墨色副线。换界时仍跟着世界换色，但不再多挂两颗空节点。
    -->
    <span data-folio-section-mark class="folio-section-mark mt-0.5 shrink-0" aria-hidden="true" />
    <div class="folio-chapter-head__copy">
      <span v-if="eyebrow" class="folio-chapter-head__eyebrow">{{ eyebrow }}</span>
      <div class="folio-chapter-head__title-row">
        <h2 class="folio-chapter-head__title">{{ title }}</h2>
        <!--
          hint 不取 shrink-0:它是次要读数,极端窄档(200% 缩放的有效视口 ~195px)下
          章节名 + 一段长 hint 会一起把这一行顶到 200px 以外(实测 /codex 与 /dongfu 越界)。
          允许它让位、必要时整块落到第二行 —— 字一个不少，行也不再压出边。
        -->
        <span v-if="hint" class="folio-chapter-head__hint tabular">{{ hint }}</span>
      </div>
    </div>
    <!--
      尾线 —— 把这一节与下一节分开的那一手。

      书籍排版的章节头从来不靠字号划分,靠的是「标题 + 一条把行拉满的线」:线一走完,
      正文才开始。这里同理 —— 有它,章节是版面的一块;没它,标题只是一行加粗的字。

      窄屏上它先让位(min-w-1):章节名与 hint 是信息,这条线只是手势,
      让到底也不会少读到什么。故它取 flex-1 却只保底 4px,不用 shrink-0 死守。
    -->
    <span class="folio-chapter-head__rule" aria-hidden="true" />
    <div v-if="$slots.actions" class="folio-chapter-head__actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
  eyebrow?: string;
  hint?: string;
}>();
</script>
