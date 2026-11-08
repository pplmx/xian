<template>
  <section class="legacy-chapter-rail" aria-label="三生录分册">
    <div
      class="legacy-chapter-rail__tabs"
      role="tablist"
      aria-label="三生录分册"
      @keydown="onKeydown"
    >
      <button
        v-for="(tab, index) in tabs"
        :id="`legacy-tab-${tab.id}`"
        :key="tab.id"
        ref="tabEls"
        type="button"
        role="tab"
        :aria-selected="model === tab.id"
        :aria-controls="`legacy-panel-${tab.id}`"
        :tabindex="model === tab.id ? 0 : -1"
        class="legacy-chapter-rail__tab"
        :class="{ 'legacy-chapter-rail__tab--active': model === tab.id }"
        :data-legacy-rail-tab="tab.id"
        @click="model = tab.id"
      >
        <span class="legacy-chapter-rail__ordinal tabular" aria-hidden="true">
          {{ String(index + 1).padStart(2, "0") }}
        </span>
        <span class="legacy-chapter-rail__body">
          <span class="legacy-chapter-rail__line">
            <span class="legacy-chapter-rail__mark" aria-hidden="true">{{ tab.mark }}</span>
            <span class="legacy-chapter-rail__label">{{ tab.label }}</span>
          </span>
          <span class="legacy-chapter-rail__fact tabular" data-legacy-rail-fact>
            {{ tab.fact }}
          </span>
        </span>
      </button>
    </div>
  </section>
</template>

<script setup lang="ts" generic="T extends string">
import { computed, useTemplateRef } from "vue";

export interface LegacyRailTab<T extends string> {
  id: T;
  label: string;
  mark: string;
  fact: string;
}

const props = defineProps<{
  tabs: readonly LegacyRailTab<T>[];
}>();

const model = defineModel<T>({ required: true });

const activeIndex = computed(() =>
  Math.max(
    0,
    props.tabs.findIndex((tab) => tab.id === model.value),
  ),
);
const tabEls = useTemplateRef<HTMLButtonElement[]>("tabEls");

function focusTab(index: number): void {
  const target = tabEls.value?.[index];
  const tab = props.tabs[index];
  if (!target || !tab) return;
  model.value = tab.id;
  target.focus();
}

/** 方向键循环、Home/End 到首尾；选中态与焦点一起走。 */
function onKeydown(event: KeyboardEvent): void {
  const count = props.tabs.length;
  if (!count) return;
  let target = -1;
  if (event.key === "ArrowRight") target = (activeIndex.value + 1) % count;
  else if (event.key === "ArrowLeft") target = (activeIndex.value - 1 + count) % count;
  else if (event.key === "Home") target = 0;
  else if (event.key === "End") target = count - 1;
  if (target < 0) return;
  event.preventDefault();
  focusTab(target);
}
</script>
