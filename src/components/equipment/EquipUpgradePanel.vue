<script setup lang="ts">
/**
 * 强化面板 —— 「强化 +N / 上限」「每级加成」「尚差」「连强到顶」一组
 * (拆自 EquipmentDetailDialog)。
 *
 * 状态在 store 的自读 pinia:面板自读 ui.equipDetailUid + inventory,与宿主
 * 拿到同一份 inst;成本与预览全走 core/forge(equipUpgradeCost /
 * planEquipmentUpgradeAll / upgradeEquipmentAll),面板不持任何独立账。宿主页脚的
 * 「强 化」按钮另有
 * upCost/upAffordable 两条同名 computed —— 两处读的是**同一个核心函数**,
 * 同一 uid 必得同一账,不存在第二份真值;拆开是为了面板自成一体、宿主页脚
 * 不依赖子面板的内部状态。
 */
import { computed } from "vue";
import { useUiStore } from "@/stores/ui";
import { useInventoryStore } from "@/stores/inventory";
import { useResourcesStore } from "@/stores/resources";
import {
  equipLevelCap,
  equipUpgradeCost,
  planEquipmentUpgradeAll,
  upgradeEquipmentAll,
} from "@/core/forge";
import { EQUIP_LEVEL_BONUS } from "@/data/constants";
import { formatGN, formatPercent } from "@/utils/format";
import { toNum } from "@/utils/gnum";
import BatchSpendLedger from "@/components/common/BatchSpendLedger.vue";

const ui = useUiStore();
const inventory = useInventoryStore();
const resources = useResourcesStore();

const inst = computed(() =>
  ui.equipDetailUid ? inventory.findItem(ui.equipDetailUid) : undefined,
);

const upCost = computed(() => (inst.value ? equipUpgradeCost(inst.value.uid) : null));
/** 付不起即灰:强化要器灵尘与灵石两道账,缺一不可(与 forge.upgradeEquipment 同口径) */
const upAffordable = computed(() => {
  const c = upCost.value;
  if (!c) return false;
  return resources.hasSmall("dust", c.dust) && resources.hasStone(c.stone);
});
/** 连强本轮总账:库存能连几档、吃多少、止于料尽还是满级。 */
const upgradePlan = computed(() => (inst.value ? planEquipmentUpgradeAll(inst.value.uid) : null));
const batchActionLabel = computed(() => {
  if (!upAffordable.value) return "连强到顶 · 当前材料不足";
  if (!upgradePlan.value) return "连强到顶";
  const stop = upgradePlan.value.ended === "broke" ? "连强料尽" : "连强到顶";
  return `${stop} · ${upgradePlan.value.count} 档 · 耗 器灵尘 ${upgradePlan.value.dust} · 灵石 ${formatGN(upgradePlan.value.stone)}`;
});

/** 连强:按本轮计划点到器灵尘/灵石见底或满级(forge.upgradeEquipmentAll 同账)。 */
function doUpgradeAll(): void {
  if (inst.value) upgradeEquipmentAll(inst.value.uid);
}
</script>

<template>
  <template v-if="inst && upCost">
    <div class="ink-divider my-3" />
    <p class="flex items-center justify-between text-body text-ink-faint">
      <span>强化 +{{ inst.level + 1 }} / 上限 {{ equipLevelCap() }}</span>
      <span class="tabular">器灵尘×{{ upCost.dust }} · 灵石 {{ formatGN(upCost.stone) }}</span>
    </p>
    <!-- 代价有了,这一级给什么也要在 —— 基础攻防血按 (1+级数×12%) 叠乘,读 EPQUIP_LEVEL_BONUS 不手写 -->
    <p class="mt-0.5 text-note text-ink-faint">
      强化每级:基础攻防血 ×(1 + 级数 ×{{ formatPercent(EQUIP_LEVEL_BONUS, 0) }})
    </p>
    <!-- 付不起就把缺摆出来:灰按钮只说不许,不告诉差多少等于没说完(与法宝炼化同款) -->
    <p v-if="!upAffordable" class="mt-1 text-note text-cinnabar tabular">
      尚差 器灵尘×{{ Math.max(0, upCost.dust - resources.dust) }} · 灵石
      {{ formatGN(Math.max(0, toNum(upCost.stone) - toNum(resources.spiritStone))) }}
    </p>
    <!--
      连强不是「一路到满级」的承诺:材料只够几档时,本轮就只做几档。
      预告、按钮文案与结算同读 planEquipmentUpgradeAll。
    -->
    <BatchSpendLedger
      v-if="upgradePlan && upgradePlan.count > 0"
      id="equip-batch-plan"
      seal="铸"
      :status="upgradePlan.ended === 'max' ? '可至满级' : '料尽止'"
      :tone="upgradePlan.ended === 'max' ? 'qing' : 'cinnabar'"
      data-equip-batch-plan
      :data-equip-batch-count="upgradePlan.count"
      :data-equip-batch-from="upgradePlan.fromLevel"
      :data-equip-batch-to="upgradePlan.toLevel"
      :data-equip-batch-dust="upgradePlan.dust"
      :data-equip-batch-ended="upgradePlan.ended"
    >
      <template #title>
        本轮连强至 +{{ upgradePlan.toLevel }}，共 {{ upgradePlan.count }} 档
      </template>
      <template #detail>
        耗 器灵尘×{{ upgradePlan.dust }} · 灵石 {{ formatGN(upgradePlan.stone) }}
      </template>
    </BatchSpendLedger>
    <button
      class="btn-ghost mt-2 w-full !py-1.5 !text-body"
      :disabled="!upAffordable"
      :aria-label="batchActionLabel"
      :aria-describedby="upgradePlan && upgradePlan.count > 0 ? 'equip-batch-plan' : undefined"
      @click="doUpgradeAll"
    >
      <template v-if="upAffordable && upgradePlan">
        {{
          upgradePlan.ended === "broke"
            ? `连强料尽 · ${upgradePlan.count} 档`
            : `连强到顶 · ${upgradePlan.count} 档`
        }}
      </template>
      <template v-else>连强到顶</template>
    </button>
  </template>
</template>
