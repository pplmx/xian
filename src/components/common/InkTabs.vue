<template>
  <!-- 吸顶外壳:滚到顶就钉住,内容从底下穿过(尺寸与遮罩见 .tab-rail) -->
  <div class="tab-rail" data-folio-tabs>
    <div
      class="folio-tab-index relative flex overflow-hidden"
      role="tablist"
      aria-label="页签"
      @keydown="onKeydown"
    >
      <!--
        书口索引签 —— 一排连续的小册页口,不是一枚浮在卡片里的胶囊。
        底边朱砂短线随当前册游走;选中签只铺一层淡纸,不压成实心墨块。

        页签标签全是 2 字(界域/典籍/周易/紫微/星象/奇门…,六个页面各一组)。常态字距
        0.2em 是这枚索引签的呼吸,但 200% 缩放档(195 CSS px)下 6 枚页签每枚只剩 26px,
        2 字 14px 加字距要 34px —— 于是每个标签都折成两行(实测 6 枚全折)。极窄档收到
        11px 并去掉字距,320 / 390 两档读数不动。
      -->
      <span
        class="folio-tab-index__marker pointer-events-none absolute bottom-0 left-0 h-0.5 bg-cinnabar/70 transition-transform duration-300"
        aria-hidden="true"
        :style="{
          width: `calc(100% / ${tabs.length})`,
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
        class="folio-tab-index__tab relative z-10 min-w-0 flex-1 py-2 font-kai text-title tracking-[0.2em] transition-colors duration-200 tinylens:text-body tinylens:tracking-normal tinylens:whitespace-nowrap"
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
import { tabKeyTarget } from "@/composables/useTabKeys";

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

/**
 * 键盘漫游:←/→ 循环、Home/End 到头尾;方向键 preventDefault,免得替页面翻动。
 *
 * 规则本身读 `useTabKeys.tabKeyTarget` —— 那是这份规则的**唯一实现**。
 * 这里从前手写了一份同样的取模，而两者都不会在对方的改动下变红:
 * `tabKeyTarget` 的注释里写着「少个 `+count` 会算出 -1，焦点被送到列表末尾,
 * 而屏幕上什么都看不出来」—— 那样的 bug 若只在一处被抓到，另一处照样会犯。
 */
function onKeydown(e: KeyboardEvent): void {
  const { index, handled } = tabKeyTarget(e.key, activeIdx.value, props.tabs.length);
  if (!handled) return;
  e.preventDefault();
  focusTab(index);
}
</script>
