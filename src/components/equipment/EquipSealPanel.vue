<script setup lang="ts">
/**
 * 封存操作面板 —— 词条行上的「封存 / 解除」一组(拆自 EquipmentDetailDialog)。
 *
 * 归属:封存的**操作**在这里(逐词条行内);封存的**价签**(页脚「封存一词 N」
 * 与短差)随重铸页脚块走 —— 同一 flex 行,拆开反而要跨面板拼一行。
 *
 * 语义与 core/reforge 同源:sealCost 定价、sealAffix / unsealAffix 动作;
 * 解除免费即时 —— 锁是花过的沉没成本,解开只是放弃槽位保护(见 reforge.unsealAffix
 * 的注释),与封存的付不起置灰纪律区分开。状态在 store 的自读 pinia:面板自读
 * ui.equipDetailUid + inventory,与宿主拿到同一份 inst。
 */
import { computed } from "vue";
import { useUiStore } from "@/stores/ui";
import { useInventoryStore } from "@/stores/inventory";
import { sealAffix, sealCost, unsealAffix } from "@/core/reforge";
import { useResourcesStore } from "@/stores/resources";
import { formatGN } from "@/utils/format";
import GameIcon from "@/components/common/GameIcon.vue";

const props = defineProps<{ affixId: string; name: string }>();

const ui = useUiStore();
const inventory = useInventoryStore();
const resources = useResourcesStore();

const inst = computed(() =>
  ui.equipDetailUid ? inventory.findItem(ui.equipDetailUid) : undefined,
);

const sealCostVal = computed(() => (inst.value ? sealCost(inst.value) : null));
/** 封存付得起吗 —— 成本与 sealAffix 同源(sealCost),仅灵石一道账,缺则置灰 */
const sealAffordable = computed(
  () => sealCostVal.value !== null && resources.hasStone(sealCostVal.value),
);

function isAffixSealed(id: string): boolean {
  return (inst.value?.sealedAffixIds ?? []).includes(id);
}

function canSealAffix(id: string): boolean {
  return inst.value !== undefined && sealCostVal.value !== null && !isAffixSealed(id);
}

function doSealAffix(): void {
  if (inst.value) sealAffix(inst.value.uid, props.affixId);
}

function doUnsealAffix(): void {
  if (inst.value) unsealAffix(inst.value.uid, props.affixId);
}
</script>

<template>
  <button
    v-if="canSealAffix(affixId)"
    class="min-h-[28px] shrink-0 rounded-md px-1.5 py-1 text-note text-qing active:scale-90 active:opacity-60"
    :class="{ '!text-ink-faint': !sealAffordable }"
    :disabled="!sealAffordable"
    :aria-label="`封存词条${name}`"
    :title="sealAffordable ? undefined : `尚差 ${formatGN(sealCostVal ?? 0)} 灵石`"
    @click="doSealAffix"
  >
    封存
  </button>
  <span v-else-if="isAffixSealed(affixId)" class="flex shrink-0 items-center gap-1">
    <span class="text-jade" role="img" aria-label="这条词条已封存">
      <GameIcon name="lock" :size="12" />
    </span>
    <!--
      解除封存:免费即时 —— 锁是花过的沉没成本,解开只是放弃这条槽位的保护,
      既不收费也不退款(见 reforge.unsealAffix 的注释)。故不做付不起置灰,
      与封存的账目纪律区分开。
    -->
    <button
      class="min-h-[28px] shrink-0 rounded-md px-1.5 py-1 text-note text-ink-faint hoverable:hover:text-qing active:scale-90 active:opacity-60"
      :aria-label="`解除封存词条${name}`"
      @click="doUnsealAffix"
    >
      解除
    </button>
  </span>
</template>
