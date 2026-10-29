<template>
  <!-- 吸顶外壳:滚到顶就钉住,内容从底下穿过(尺寸与遮罩见 .tab-rail) -->
  <div class="tab-rail">
    <div
      class="card-ink relative flex overflow-hidden p-1"
      role="tablist"
      aria-label="页签"
      @keydown="onKeydown"
    >
      <!--
        淡纸底滑动指示:随选中页签平滑游走;底边一枚朱砂小印负责「当前」,
        不把整枚页签压成实心墨块。

        页签标签全是 2 字(界域/典籍/周易/紫微/星象/奇门…,六个页面各一组)。常态字距
        0.2em 是这枚墨块的呼吸,但 200% 缩放档(195 CSS px)下 6 枚页签每枚只剩 26px,
        2 字 14px 加字距要 34px —— 于是每个标签都折成两行(实测 6 枚全折)。极窄档收到
        11px 并去掉字距,320 / 390 两档读数不动。
      -->
      <span
        class="pointer-events-none absolute inset-y-1 left-1 rounded-md border border-ink/10 bg-paper-deep/70 shadow-sm transition-transform duration-300"
        aria-hidden="true"
        :style="{
          width: `calc((100% - 8px) / ${tabs.length})`,
          transform: `translateX(${activeIdx * 100}%)`,
          transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
        }"
      >
        <span
          class="absolute bottom-1 left-1/2 h-0.5 w-4 -translate-x-1/2 rounded-full bg-cinnabar/70"
        />
      </span>
      <button
        v-for="t in tabs"
        :key="t.id"
        ref="tabEls"
        role="tab"
        :aria-selected="model === t.id"
        :tabindex="model === t.id ? 0 : -1"
        class="relative z-10 flex-1 rounded-md py-1.5 font-kai text-[14px] tracking-[0.2em] tinylens:text-[11px] tinylens:tracking-normal tinylens:whitespace-nowrap transition-colors duration-200"
        :class="model === t.id ? 'text-ink' : 'text-ink-faint active:text-ink-soft'"
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
import { computed, useTemplateRef } from "vue";

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
const tabEls = useTemplateRef<HTMLButtonElement[]>("tabEls");

/** 把焦点与选中一起移到第 i 个页签(roving tabindex 的落点) */
function focusTab(i: number): void {
  const target = tabEls.value?.[i];
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
