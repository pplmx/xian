<template>
  <button
    type="button"
    class="inventory-item"
    :class="{
      'is-equipped': equipped,
      'is-new': isNew,
      'is-locked': item.locked,
    }"
    :data-uid="item.uid"
    :data-equipment-new="isNew ? 'true' : undefined"
    :aria-label="label"
    @click="emit('open', item.uid)"
  >
    <span class="inventory-item__sigil" aria-hidden="true">
      <GameIcon :name="template?.icon ?? 'sword'" :size="20" :style="{ color: quality.color }" />
    </span>

    <span class="inventory-item__name" :style="{ color: quality.color }">{{ displayName }}</span>
    <span class="inventory-item__meta">{{ metaText }}</span>
    <span
      v-if="marksText"
      class="inventory-item__marks"
      :class="{ 'is-new': isNew, 'is-worn': !isNew && equipped }"
    >
      <!--
        新得的那一枚弹一下(见 uiLayering 的「两枚新徽章都有入场动画」)。
        动画跟着一个用不着的旧组件(EquipmentCard)沉了下去:行囊换成本组件之后,
        那一枚留在原地,玩家打开行囊看到的新件是静态的。
        `new-pop` 走独立 scale 属性、不碰 transform,故挨着它的排版不会横跳。
        只挂「新得」——「佩」「锁」「共」是状态,不该在落地时跳。
      -->
      <span v-if="isNew" class="inventory-item__marks-pop animate-new-pop">{{ marksText }}</span>
      <template v-else>{{ marksText }}</template>
    </span>
  </button>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { EquipmentInstance } from "@/types";
import { EQUIP_SLOT_NAMES, equipmentTemplate } from "@/data/equipment";
import { qualityDef } from "@/data/qualities";
import { equipSetDef } from "@/core/equipSet";
import GameIcon from "@/components/common/GameIcon.vue";

const props = defineProps<{
  item: EquipmentInstance;
  equipped?: boolean;
  isNew?: boolean;
}>();
const emit = defineEmits<{ open: [uid: string] }>();

const template = computed(() => equipmentTemplate(props.item.templateId));
const quality = computed(() => qualityDef(props.item.quality));
const slotName = computed(() =>
  template.value ? EQUIP_SLOT_NAMES[template.value.slot] : "未知器位",
);
const setName = computed(() =>
  template.value?.set ? (equipSetDef(template.value.set)?.name ?? "") : "",
);
const displayName = computed(
  () =>
    `${template.value?.name ?? "未知器物"}${props.item.level > 0 ? ` +${props.item.level}` : ""}`,
);
const metaText = computed(() =>
  [
    slotName.value,
    `${props.item.tier} 阶`,
    quality.value.name,
    setName.value ? `共鸣 ${setName.value}` : "",
    props.item.note ? `标记 ${props.item.note}` : "",
  ]
    .filter(Boolean)
    .join(" · "),
);
const marksText = computed(() =>
  [props.equipped ? "在佩" : "", props.isNew ? "新得" : "", props.item.locked ? "已锁" : ""]
    .filter(Boolean)
    .join(" · "),
);

const label = computed(() => {
  const bits = [
    `${quality.value.name}·${template.value?.name ?? "未知器物"}`,
    slotName.value,
    `${props.item.tier} 阶`,
  ];
  if (props.item.level > 0) bits.push(`强化 +${props.item.level}`);
  if (props.equipped) bits.push("佩戴中");
  if (props.isNew) bits.push("本次新得");
  if (props.item.locked) bits.push("已锁定");
  if (setName.value) bits.push(`共鸣${setName.value}`);
  if (props.item.note) bits.push(`标记${props.item.note}`);
  return bits.join(" ");
});
</script>
