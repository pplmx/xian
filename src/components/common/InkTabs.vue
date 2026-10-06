<template>
  <!-- 吸顶外壳:滚到顶就钉住,内容从底下穿过(尺寸与遮罩见 .tab-rail) -->
  <div class="tab-rail">
    <div
      class="card-ink relative flex overflow-hidden p-1"
      role="tablist"
      aria-label="页签"
      @keydown="onKeydown"
    >
      <!-- 墨块滑动指示:随选中页签平滑游走 -->
      <span
        class="pointer-events-none absolute inset-y-1 left-1 rounded-md bg-ink shadow transition-transform duration-300"
        :style="{
          width: `calc((100% - 8px) / ${tabs.length})`,
          transform: `translateX(${activeIdx * 100}%)`,
          transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
        }"
      />
      <button
        v-for="t in tabs"
        :key="t.id"
        ref="tabEls"
        role="tab"
        :aria-selected="model === t.id"
        :tabindex="model === t.id ? 0 : -1"
        class="relative z-10 flex-1 rounded-md py-1.5 font-kai text-[13px] tracking-[0.2em] transition-colors duration-200"
        :class="model === t.id ? 'text-paper' : 'text-ink-faint active:text-ink-soft'"
        @click="model = t.id"
      >
        {{ t.label }}
        <span
          v-if="t.dot"
          class="absolute right-1.5 top-1 h-1.5 w-1.5 rounded-full bg-cinnabar"
          :class="model === t.id ? '' : 'animate-breathe'"
        />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts" generic="T extends string">
import { computed, ref } from "vue";

const props = defineProps<{
  tabs: readonly { id: T; label: string; dot?: boolean }[];
}>();

const model = defineModel<T>({ required: true });

const activeIdx = computed(() =>
  Math.max(
    0,
    props.tabs.findIndex((t) => t.id === model.value),
  ),
);
/** v-for 里的模板引用:同序数组,配合箭头键做焦点漫游 */
const tabEls = ref<(HTMLButtonElement | null)[]>([]);

/** 把焦点与选中一起移到第 i 个页签(roving tabindex 的落点) */
function focusTab(i: number): void {
  const target = tabEls.value[i];
  if (!target) return;
  model.value = props.tabs[i]!.id;
  target.focus();
}

/** 键盘漫游:←/→ 循环、Home/End 到头尾;方向键 preventDefault,免得替页面翻动 */
function onKeydown(e: KeyboardEvent): void {
  const n = props.tabs.length;
  let target = -1;
  if (e.key === "ArrowRight") target = (activeIdx.value + 1) % n;
  else if (e.key === "ArrowLeft") target = (activeIdx.value - 1 + n) % n;
  else if (e.key === "Home") target = 0;
  else if (e.key === "End") target = n - 1;
  if (target >= 0) {
    e.preventDefault();
    focusTab(target);
  }
}
</script>
