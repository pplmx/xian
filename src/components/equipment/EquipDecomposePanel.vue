<script setup lang="ts">
/**
 * 分解二步确认面板 —— 垃圾桶→确认分解→再想想 的武装态一组(拆自 EquipmentDetailDialog)。
 *
 * 归属:页脚动作行里分解钮的两步确认(武装→确认/再想想)与 doDecompose。
 * 一件淬养过的装备(强化/封存/重铸)误触垃圾桶不该直接没 —— 与重铸的
 * 先武装再确认同一族纪律。主文的「分解返还」价签不在此(它是展示行,
 * 与强化投入的账连在一起,留宿主)。
 *
 * 确认模式分级(2026-10 交互统一):误触代价**不可逆失去整件**的动作用
 * 两步武装确认,确认词「确认+动词」、取消词全库一律「再想想」;可逆/
 * 可自愈的消费动作(重铸/强化/服丹/闭关/买卖)一键直达加就地护栏。
 * 家族全表见 uiLayering「破坏性二次确认话术统一」判据注释。
 *
 * 状态在 store 的自读 pinia:自读 ui.equipDetailUid + inventory,与宿主拿到
 * 同一份 inst;置灰依据(isEquipped / locked)由面板自算。分解成功后
 * emit('decomposed'),由宿主关弹窗(关弹窗还要顺带收起词条转移面板,
 * 那是宿主自己的状态)。
 */
import { computed, ref } from "vue";
import { useUiStore } from "@/stores/ui";
import { useInventoryStore } from "@/stores/inventory";
import { equipmentTemplate } from "@/data/equipment";
import { decomposeEquipment } from "@/core/forge";
import GameIcon from "@/components/common/GameIcon.vue";

const emit = defineEmits<{ decomposed: [] }>();

const ui = useUiStore();
const inventory = useInventoryStore();

const inst = computed(() =>
  ui.equipDetailUid ? inventory.findItem(ui.equipDetailUid) : undefined,
);
const isEquipped = computed(() => {
  const t = inst.value ? equipmentTemplate(inst.value.templateId) : undefined;
  return inst.value && t ? inventory.equipped[t.slot] === inst.value.uid : false;
});

const decomposeArm = ref<string | null>(null);

function doDecompose(): void {
  if (!inst.value) return;
  if (decomposeEquipment(inst.value.uid)) {
    decomposeArm.value = null;
    emit("decomposed");
  }
}
</script>

<template>
  <!-- 分解二步确认:一件淬养过的装备(强化/封存/重铸)误触垃圾桶不该直接没 -->
  <template v-if="inst">
    <template v-if="decomposeArm !== inst.uid">
      <button
        class="btn-ghost px-3"
        :disabled="isEquipped || inst.locked"
        :title="isEquipped ? '佩戴中,卸下后再分解' : '已锁定,解锁后再分解'"
        aria-label="分解这件装备"
        @click="decomposeArm = inst.uid"
      >
        <GameIcon name="trash" :size="15" />
      </button>
    </template>
    <template v-else>
      <button class="btn-seal !px-2.5 !text-body" @click="doDecompose">确认分解</button>
      <button class="btn-ghost px-2 text-body text-ink-faint" @click="decomposeArm = null">
        再想想
      </button>
    </template>
  </template>
</template>
