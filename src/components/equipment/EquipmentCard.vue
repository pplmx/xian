<template>
  <button
    class="relative aspect-square rounded-[2px] border transition-transform active:scale-95"
    :style="{
      borderColor: colorWithAlpha(quality.color, tier.border),
      background: colorWithAlpha(quality.color, tier.bg),
    }"
    :data-uid="props.item.uid"
    :data-equipment-new="isNew ? 'true' : undefined"
    :aria-label="label"
    @click="emit('open', props.item.uid)"
  >
    <!--
      角标不再散在四角。四列格子里 8px 的「佩/共/新」原来是四粒认不出的墨点,
      而且和名字抢同一条视觉边。改成顶部一条标记带:
      左侧「佩」用玉色实底(它是状态),右侧「共」用紫色描边(它是属性),
      「新」仍挂正中朱砂。三样都还在,只是排成了一条读得懂的线。
      天/仙/神在标记带右侧再盖一枚品阶阴文小章 —— 形状线索,色弱也分得出档。
    -->
    <span class="absolute inset-x-0 top-0 flex items-start justify-between px-1 pt-0.5">
      <span
        v-if="props.equipped"
        class="rounded-sm bg-jade/6 px-[3px] font-kai text-note leading-[1.4] text-jade"
        >佩</span
      >
      <span class="ml-auto flex items-center gap-0.5">
        <QualitySeal v-if="rare" :quality="props.item.quality" :size="13" />
        <span
          v-if="props.item.locked"
          class="leading-none text-ink-faint"
          aria-hidden="true"
          title="已锁定"
        >
          <GameIcon name="lock" :size="9" />
        </span>
      </span>
    </span>
    <!-- 新入包、还没开过背包看它 -->
    <span
      v-if="isNew"
      class="absolute left-1/2 top-0.5 -translate-x-1/2 font-kai text-note leading-none text-cinnabar animate-new-pop"
    >
      新
    </span>

    <!-- 主图标 + 名字:上下各留一条基线带(top-0 标记带 / bottom-0 数值带)后居中 -->
    <span class="flex h-full w-full flex-col items-center justify-center gap-1 px-1 py-4">
      <GameIcon :name="template?.icon ?? 'sword'" :size="22" :style="{ color: quality.color }" />
      <span
        class="w-full truncate text-center text-note leading-tight"
        :style="{ color: quality.color }"
      >
        {{ template?.name ?? "?" }}
      </span>
    </span>

    <!-- 底边:左「共」(共鸣),右强化等级 —— 两样都是数值性的,故都走右下这条基线 -->
    <span
      v-if="setName || props.item.level > 0"
      class="absolute inset-x-0 bottom-0.5 flex items-center justify-between px-1"
    >
      <span
        v-if="setName"
        class="font-kai text-note leading-none text-violet-ink"
        :title="`共鸣「${setName}」`"
        >共</span
      >
      <span
        v-if="props.item.level > 0"
        class="ml-auto text-note leading-none text-gold-ink tabular"
      >
        +{{ props.item.level }}
      </span>
    </span>

    <!-- 玩家标记:同名装备按流派区分(详情弹窗里写,见 noteDraft)。 -->
    <span
      v-if="props.item.note"
      class="absolute inset-x-1 bottom-4 truncate text-center text-note leading-none text-ink-faint"
    >
      {{ props.item.note }}
    </span>
  </button>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { EquipmentInstance } from "@/types";
import { equipmentTemplate } from "@/data/equipment";
import { qualityDef } from "@/data/qualities";
import { colorWithAlpha } from "@/ui/colorVar";
import { equipSetDef } from "@/core/equipSet";
import GameIcon from "@/components/common/GameIcon.vue";
import QualitySeal from "@/components/common/QualitySeal.vue";
import { isRareQuality, qualityTierStyle } from "@/ui/qualityTier";

const props = defineProps<{ item: EquipmentInstance; equipped?: boolean; isNew?: boolean }>();
const emit = defineEmits<{ open: [uid: string] }>();

/** 顶部中央那枚「新」由父级统一算好:几百张卡不再各自订阅库存单例 */
const isNew = computed(() => props.isNew === true);

const template = computed(() => equipmentTemplate(props.item.templateId));
const quality = computed(() => qualityDef(props.item.quality));
const tier = computed(() => qualityTierStyle(props.item.quality));
const rare = computed(() => isRareQuality(props.item.quality));
const setName = computed(() =>
  template.value?.set ? (equipSetDef(template.value.set)?.name ?? "") : "",
);
/** Visible name is truncated; lock / worn / set marks are 8px chips. Spell the full card. */
const label = computed(() => {
  const bits = [`${quality.value.name}·${template.value?.name ?? "未知"}`];
  if (props.item.level > 0) bits.push(`+${props.item.level}`);
  if (props.equipped) bits.push("佩戴中");
  if (props.item.locked) bits.push("已锁定");
  if (setName.value) bits.push(`共鸣${setName.value}`);
  if (props.item.note) bits.push(`标记${props.item.note}`);
  return bits.join(" ");
});
</script>
