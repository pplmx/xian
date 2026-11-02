<template>
  <section class="name-beast-switch" data-name-beast-switch :aria-label="label">
    <div
      class="name-beast-switch__grid"
      role="tablist"
      aria-label="名号与灵兽册"
      @keydown="onKeydown"
    >
      <button
        v-for="(choice, index) in choices"
        :id="`${choice.id}-tab`"
        :key="choice.id"
        ref="tabEls"
        type="button"
        role="tab"
        data-name-beast-tab
        :data-kind="choice.id"
        :aria-label="`${choice.label}：${choice.currentName}，${choice.count}/${choice.total}，${choice.note}`"
        :aria-selected="model === choice.id"
        :aria-controls="`${choice.id}-panel`"
        :tabindex="model === choice.id ? 0 : -1"
        class="name-beast-switch__tab"
        :class="{ 'name-beast-switch__tab--active': model === choice.id }"
        @click="model = choice.id"
      >
        <span class="name-beast-switch__ordinal" aria-hidden="true">
          {{ String(index + 1).padStart(2, "0") }}
        </span>
        <span class="name-beast-switch__mark" aria-hidden="true">{{ choice.mark }}</span>
        <span class="name-beast-switch__body">
          <span class="name-beast-switch__eyebrow">
            {{ choice.eyebrow }}
            <span v-if="choice.dot" class="name-beast-switch__dot" aria-hidden="true" />
          </span>
          <span class="name-beast-switch__line">
            <span class="name-beast-switch__name">{{ choice.currentName }}</span>
            <span class="name-beast-switch__count tabular"
              >{{ choice.count }}/{{ choice.total }}</span
            >
          </span>
          <span class="name-beast-switch__track" aria-hidden="true">
            <span :style="{ width: widthOf(choice.ratio) }" />
          </span>
          <span class="name-beast-switch__note">{{ choice.note }}</span>
        </span>
        <span v-if="choice.complete" class="name-beast-switch__complete">尽收</span>
      </button>
    </div>
  </section>
</template>

<script setup lang="ts" generic="T extends string">
import { computed, useTemplateRef } from "vue";
import { percentWidth } from "@/utils/unitRatio";
import type { NameBeastChoice } from "@/ui/titlesDesk";

const props = withDefaults(
  defineProps<{
    choices: readonly NameBeastChoice<T>[];
    label?: string;
  }>(),
  { label: "名号与灵兽双契总览" },
);

const model = defineModel<T>({ required: true });

const activeIndex = computed(() =>
  Math.max(
    0,
    props.choices.findIndex((choice) => choice.id === model.value),
  ),
);
const tabEls = useTemplateRef<HTMLButtonElement[]>("tabEls");

function widthOf(ratio: number): string {
  return percentWidth(ratio);
}

function focusTab(index: number): void {
  const choice = props.choices[index];
  const target = tabEls.value?.[index];
  if (!choice || !target) return;
  model.value = choice.id;
  target.focus();
}

function onKeydown(event: KeyboardEvent): void {
  const count = props.choices.length;
  if (count === 0) return;
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
