<template>
  <div class="ink-choice" role="group" :aria-label="label" :data-ink-choice="name">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      class="ink-choice__option"
      :aria-pressed="modelValue === option.value"
      @click="choose(option.value)"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
type InkChoiceOption = {
  value: string;
  label: string;
};

const props = defineProps<{
  modelValue: string;
  label: string;
  name: string;
  options: readonly InkChoiceOption[];
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

function choose(value: string): void {
  if (value !== props.modelValue) emit("update:modelValue", value);
}
</script>
