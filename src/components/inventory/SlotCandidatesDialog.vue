<template>
  <!-- 部位候选列表 -->
  <BaseModal
    :open="slotName !== null"
    :title="slotName ? EQUIP_SLOT_NAMES[slotName] : ''"
    @close="emit('close')"
  >
    <div v-if="pickerRows.length" class="space-y-1.5">
      <div
        v-for="row in pickerRows"
        :key="row.item.uid"
        class="flex items-center gap-2.5 rounded-md px-2.5 py-2"
        :class="row.equipped ? 'bg-jade/10' : 'bg-paper-deep/70'"
      >
        <GameIcon
          :name="row.template.icon"
          :size="16"
          :style="{ color: qualityDef(row.item.quality).color }"
        />
        <button class="min-w-0 grow text-left active:opacity-70" @click="openDetail(row.item.uid)">
          <span class="flex min-w-0 items-center gap-1">
            <!-- 天/仙/神名前盖品阶阴文章:稀有档的第二条线索,不靠颜色单打(见 qualityTier) -->
            <QualitySeal
              v-if="isRareQuality(row.item.quality)"
              :quality="row.item.quality"
              :size="14"
              class="shrink-0"
            />
            <span
              class="min-w-0 truncate font-kai text-[14px]"
              :style="{ color: qualityDef(row.item.quality).color }"
            >
              {{ row.template.name }}
              <template v-if="row.item.level > 0">+{{ row.item.level }}</template>
            </span>
          </span>
          <span class="block text-[10px] text-ink-faint">
            <!-- 条数带分母:这一件还剩多少条可涨,一眼看得出(上限来自品质表) -->
            {{ qualityDef(row.item.quality).name }} · {{ row.item.tier }} 阶 · 词条
            {{ row.item.affixes.length }}/{{ qualityDef(row.item.quality).affixes[1] }}
          </span>
        </button>
        <!--
          换装决策的行级读数:这一件跟身上那件差多少战力,picker 层就该看见 ——
          不用每件点开详情才知道值不值得换(与人物页战力同一个数,pScore 线性差)。
        -->
        <span
          v-if="row.delta !== null"
          class="shrink-0 text-[10px] tabular"
          :class="row.deltaCls"
          :title="`vs 当前佩戴:${row.deltaText}`"
          >{{ row.deltaText }}</span
        >
        <button
          v-if="row.equipped"
          class="btn-ghost shrink-0 !px-2.5 !py-1 !text-[11px]"
          @click="unequipSlot()"
        >
          卸下
        </button>
        <button
          v-else
          class="btn-seal shrink-0 !px-2.5 !py-1 !text-[11px]"
          @click="equipItem(row.item.uid)"
        >
          换上
        </button>
      </div>
    </div>
    <p v-else class="py-8 text-center text-[11px] text-ink-faint">
      此部位尚无藏品,去历练中寻些机缘吧
    </p>
    <p class="mt-2 text-center text-[10px] text-ink-faint">点名称可查看详情与对比</p>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed } from "vue";
import BaseModal from "@/components/common/BaseModal.vue";
import GameIcon from "@/components/common/GameIcon.vue";
import QualitySeal from "@/components/common/QualitySeal.vue";
import { useInventoryStore } from "@/stores/inventory";
import { useUiStore } from "@/stores/ui";
import { qualityDef } from "@/data/qualities";
import { isRareQuality } from "@/ui/qualityTier";
import { EQUIP_SLOT_NAMES, equipmentTemplate } from "@/data/equipment";
import { equippablePower } from "@/core/equipBest";
import { formatGN } from "@/utils/format";
import type { EquipSlot, EquipmentInstance } from "@/types";

const props = defineProps<{ slotName: EquipSlot | null }>();
// pickerSlot(页面状态)留 InventoryView,这里只回传 close —— 弹窗不许越手改别人的账。
const emit = defineEmits<{ close: [] }>();

const inventory = useInventoryStore();
const ui = useUiStore();

/** 当前部位的候选:佩戴中的置顶,其余按品质/层级降序 */
const pickerRows = computed(() => {
  const slot = props.slotName;
  if (!slot) return [];
  const equippedUid = inventory.equipped[slot];
  // 这一槽当下的佩戴件 —— 每个候选的「战 ±N」都与它比(powerScore 是线性合计,
  // 换装的战力差 = 新件三围分 − 旧件三围分,与人物页战力同一个数,无需重算总属性)
  const occupant = equippedUid ? inventory.items.find((i) => i.uid === equippedUid) : undefined;
  // 战力差要走真实战力(平铺 × 词条%、会心联乘),与「一键穿最强」equippablePower 同源;
  // 只比三围会让一件平铺高、零词条的件压过满掷暴击/吸血的件,列表数字与实穿打架
  const powerOf = (i: EquipmentInstance): number => equippablePower(i);
  return inventory.items
    .map((item) => ({ item, template: equipmentTemplate(item.templateId) }))
    .filter(
      (
        row,
      ): row is {
        item: (typeof inventory.items)[number];
        template: NonNullable<ReturnType<typeof equipmentTemplate>>;
      } => !!row.template && row.template.slot === slot,
    )
    .map((row) => {
      const equipped = row.item.uid === equippedUid;
      // 佩戴中底行不报差(它自己就是基线);空槽的候选也不报(皆收益,无对比对象)
      const delta = !equipped && occupant ? powerOf(row.item) - powerOf(occupant) : null;
      const deltaText =
        delta === null
          ? ""
          : delta > 0
            ? `战 +${formatGN(Math.round(delta))}`
            : delta < 0
              ? `战 -${formatGN(Math.round(-delta))}`
              : "战 同";
      const deltaCls =
        delta === null
          ? ""
          : delta > 0
            ? "text-jade"
            : delta < 0
              ? "text-cinnabar"
              : "text-ink-faint";
      return { ...row, equipped, delta, deltaText, deltaCls };
    })
    .sort((a, b) => {
      if (a.equipped !== b.equipped) return Number(b.equipped) - Number(a.equipped);
      const dq = qualityDef(b.item.quality).rank - qualityDef(a.item.quality).rank;
      return dq !== 0 ? dq : b.item.tier - a.item.tier;
    });
});

function equipItem(uid: string): void {
  if (props.slotName) inventory.equip(uid, props.slotName);
}

function unequipSlot(): void {
  if (props.slotName) inventory.unequip(props.slotName);
}

/** 详情弹窗是全局的(ui.equipDetailUid)—— 装备卡与候选行写的是同一个入口,无第二本账 */
function openDetail(uid: string): void {
  ui.equipDetailUid = uid;
}
</script>
