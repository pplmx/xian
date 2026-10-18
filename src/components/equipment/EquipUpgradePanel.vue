<script setup lang="ts">
/**
 * 强化面板 —— 「强化 +N / 上限」「每级加成」「尚差」「连强到顶」一组
 * (拆自 EquipmentDetailDialog)。
 *
 * 状态在 store 的自读 pinia:面板自读 ui.equipDetailUid + inventory,与宿主
 * 拿到同一份 inst;成本与预览全走 core/forge(equipUpgradeCost / upgradeRestCost /
 * upgradeEquipmentAll),面板不持任何独立账。宿主页脚的「强 化」按钮另有
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
  upgradeEquipmentAll,
  upgradeRestCost,
} from "@/core/forge";
import { EQUIP_LEVEL_BONUS } from "@/data/constants";
import { formatGN, formatPercent } from "@/utils/format";
import { toNum } from "@/utils/gnum";

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
/** 连强到顶的总账:从当前级一路到满级要吃多少(纯读预览,与 upgradeEquipmentAll 同算法) */
const restUpgrade = computed(() =>
  inst.value ? upgradeRestCost(inst.value.uid) : ("max" as const),
);

/** 连强到顶:一次点到器灵尘/灵石见底或满级(forge.upgradeEquipmentAll 已合一条总账) */
function doUpgradeAll(): void {
  if (inst.value) upgradeEquipmentAll(inst.value.uid);
}
</script>

<template>
  <template v-if="inst && upCost">
    <div class="ink-divider my-3" />
    <p class="flex items-center justify-between text-[12px] text-ink-faint">
      <span>强化 +{{ inst.level + 1 }} / 上限 {{ equipLevelCap() }}</span>
      <span class="tabular">器灵尘×{{ upCost.dust }} · 灵石 {{ formatGN(upCost.stone) }}</span>
    </p>
    <!-- 代价有了,这一级给什么也要在 —— 基础攻防血按 (1+级数×12%) 叠乘,读 EPQUIP_LEVEL_BONUS 不手写 -->
    <p class="mt-0.5 text-[10px] text-ink-faint">
      强化每级:基础攻防血 ×(1 + 级数 ×{{ formatPercent(EQUIP_LEVEL_BONUS, 0) }})
    </p>
    <!-- 付不起就把缺摆出来:灰按钮只说不许,不告诉差多少等于没说完(与法宝炼化同款) -->
    <p v-if="!upAffordable" class="mt-1 text-[10px] text-cinnabar tabular">
      尚差 器灵尘×{{ Math.max(0, upCost.dust - resources.dust) }} · 灵石
      {{ formatGN(Math.max(0, toNum(upCost.stone) - toNum(resources.spiritStone))) }}
    </p>
    <!-- 连强到顶:一次点到器灵尘/灵石见底或满级,不必逐级点(合一条总账)。
         批量动作照例把总账摊在按下前(与 decomposeBatch/decomposePreview 同族);
         只有一级可点时上行已报下一级,不重复 -->
    <p
      v-if="restUpgrade !== 'max' && restUpgrade.count > 1"
      class="mt-1 text-[10px] text-ink-faint tabular"
    >
      连强到顶共需({{ restUpgrade.count }} 级)器灵尘×{{ restUpgrade.dust }} · 灵石
      {{ formatGN(restUpgrade.stone) }}
    </p>
    <button
      class="btn-ghost mt-2 w-full !py-1.5 !text-[12px]"
      :disabled="!upAffordable"
      @click="doUpgradeAll"
    >
      连强到顶
    </button>
  </template>
</template>
