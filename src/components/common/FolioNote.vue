<template>
  <div class="folio-note" :data-folio-note="name">
    <button
      type="button"
      class="folio-note__toggle tap-row"
      :aria-expanded="open"
      :aria-controls="bodyId"
      @click="open = !open"
    >
      <span class="folio-note__arrow" aria-hidden="true">{{ open ? "▾" : "▸" }}</span>
      <span class="folio-note__label">{{ label }}</span>
    </button>
    <div v-show="open" :id="bodyId" class="folio-note__body" :data-folio-note-body="name">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";

/**
 * 一条「注」—— 规则解释与背景说明的默认归处。
 *
 * 本仓已经三次遇到同一件事:行藏底下的算法边界、器魂的「怎么个章法」、
 * 门庭的四条门规。它们都是**解释**,不是此刻的读数;摊在正文里只会把页面拖长。
 * 这枚原语把「默认收起 / 点开再读 / 收的是版面不是内容」固化成一条:
 *   · 带 aria-expanded / aria-controls,读屏知道它可开可合;
 *   · 正文默认不见(v-show,初值 false);
 *   · 文案一个字不删,开合只动版面。
 *
 * `name` 是稳定落点(判据与布局自检据此定位),`label` 是那行抬头。
 */
const props = defineProps<{ name: string; label: string }>();

const open = ref(false);
const bodyId = `folio-note-${props.name}`;
</script>

<style scoped>
.folio-note {
  min-width: 0;
}

.folio-note__toggle {
  display: flex;
  width: 100%;
  min-width: 0;
  min-height: 28px;
  align-items: center;
  gap: 0.35rem;
  border: 0;
  background: transparent;
  padding: 0.35rem 0.1rem;
  color: rgb(var(--color-ink-faint-rgb));
  font-size: var(--type-note);
  line-height: 1.5;
  text-align: left;
}

.folio-note__toggle:active {
  opacity: 0.6;
}

.folio-note__arrow {
  flex-shrink: 0;
  color: rgb(var(--color-ink-faint-rgb));
}

.folio-note__label {
  min-width: 0;
  overflow-wrap: anywhere;
}

.folio-note__body {
  padding-top: 0.2rem;
}
</style>
