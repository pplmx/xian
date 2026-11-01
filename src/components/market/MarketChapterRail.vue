<template>
  <div class="tab-rail market-chapter-rail" data-market-chapter-rail>
    <div
      ref="tabsRoot"
      class="market-chapter-rail__tabs"
      role="tablist"
      aria-label="坊市分册"
      @keydown="onKeydown"
    >
      <LedgerTally
        v-for="tab in tabs"
        :id="`market-tab-${tab.id}`"
        :key="tab.id"
        :mark="tab.mark"
        :label="tab.label"
        :value="tab.value"
        :total="tab.total"
        :unit="tab.unit"
        :detail="tab.detail"
        :active="model === tab.id"
        :aria-controls="`market-panel-${tab.id}`"
        :data-market-chapter-tab="tab.id"
        :data-market-chapter-fact="tab.detail"
        :data-market-chapter-value="tab.value"
        :data-market-chapter-total="tab.total ?? ''"
        :data-market-pulse-goods="tab.id === 'shelf' ? tab.value : undefined"
        :data-market-pulse-bounties="tab.id === 'bounty' ? tab.value : undefined"
        :data-market-pulse-consign="tab.id === 'sell' ? tab.value : undefined"
        tabbed
        @select="model = tab.id"
      />
    </div>
  </div>
</template>

<script setup lang="ts" generic="T extends string">
import { computed, nextTick, useTemplateRef } from "vue";
import LedgerTally from "@/components/common/LedgerTally.vue";

interface MarketChapterTab<T extends string> {
  id: T;
  mark: string;
  label: string;
  value: string | number;
  total?: string | number;
  unit?: string;
  detail: string;
}

const props = defineProps<{
  tabs: readonly MarketChapterTab<T>[];
}>();

const model = defineModel<T>({ required: true });
const tabsRoot = useTemplateRef<HTMLDivElement>("tabsRoot");

const activeIndex = computed(() =>
  Math.max(
    0,
    props.tabs.findIndex((tab) => tab.id === model.value),
  ),
);

function focusTab(index: number): void {
  const tab = props.tabs[index];
  if (!tab) return;
  model.value = tab.id;
  void nextTick(() => {
    tabsRoot.value?.querySelectorAll<HTMLElement>('[role="tab"]')[index]?.focus();
  });
}

/** 方向键循环、Home/End 到首尾；形状、焦点、选中与地址一起走。 */
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
