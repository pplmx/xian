<script setup lang="ts">
/**
 * 天机推演面板 —— 反事实换装推演(真仙可用,拆自 EquipmentDetailDialog)。
 *
 * 归属:推演入口钮、四界局面预览、主要变化与「只述局面,不替你定夺」脚注,
 * 连同 whatIf 报表状态 / canWhatIf 判定 / runWhatIf 动作与「换一件就清空上一份
 * 推演」的 watch,整体在此。推演的账全在 core/lab(whatIfEquip),面板零持账。
 *
 * 状态在 store 的自读 pinia:自读 ui.equipDetailUid + inventory,与宿主拿到
 * 同一份 inst;canWhatIf 要的 isEquipped 也由面板自算(同一核心判据:
 * inventory.equipped[slot] === uid,与宿主同源同值)。
 */
import { computed, ref, watch } from "vue";
import { useUiStore } from "@/stores/ui";
import { useInventoryStore } from "@/stores/inventory";
import { equipmentTemplate } from "@/data/equipment";
import { endgameUnlocked } from "@/core/endgameService";
import { whatIfEquip, type WhatIfReport } from "@/core/lab";
import { formatPercent } from "@/utils/format";

const ui = useUiStore();
const inventory = useInventoryStore();

const inst = computed(() =>
  ui.equipDetailUid ? inventory.findItem(ui.equipDetailUid) : undefined,
);
const isEquipped = computed(() => {
  const t = inst.value ? equipmentTemplate(inst.value.templateId) : undefined;
  return inst.value && t ? inventory.equipped[t.slot] === inst.value.uid : false;
});

// ---- 修士实验室:反事实换装推演 ----
const whatIf = ref<WhatIfReport | null>(null);
const canWhatIf = computed(
  () => endgameUnlocked() && !isEquipped.value && inst.value !== undefined,
);

function runWhatIf(): void {
  if (inst.value) whatIf.value = whatIfEquip(inst.value.uid);
}

watch(inst, () => {
  whatIf.value = null;
});
</script>

<template>
  <!-- 修士实验室:反事实换装推演(真仙可用) -->
  <template v-if="inst && canWhatIf">
    <div class="ink-divider my-3" />
    <button v-if="!whatIf" class="btn-ghost w-full !py-1.5 !text-[12px]" @click="runWhatIf">
      天机推演 · 若换此装,四天局面如何?
    </button>
    <template v-else>
      <p class="mb-1.5 font-kai text-[12px] tracking-[0.3em] text-ink-faint">天机推演</p>
      <p class="text-[11px] text-ink-soft tabular">
        构筑:{{ whatIf.buildBefore?.displayName ?? "未成路" }}
        <span class="text-ink-faint">→</span>
        {{ whatIf.buildAfter?.displayName ?? "流派散去" }}
      </p>
      <div class="mt-1 space-y-0.5">
        <p v-for="w in whatIf.worlds" :key="w.name" class="flex justify-between text-[11px]">
          <span class="text-ink-faint">{{ w.name }}</span>
          <span class="tabular">
            <span class="text-ink-faint">{{ w.beforeText }}</span>
            <span class="mx-1 text-ink-faint">→</span>
            <span
              :class="
                w.trend === 'up'
                  ? 'text-jade'
                  : w.trend === 'down'
                    ? 'text-cinnabar'
                    : 'text-ink-soft'
              "
            >
              {{ w.afterText }}
            </span>
          </span>
        </p>
      </div>
      <p v-if="whatIf.modChanges.length" class="mt-1 text-[10px] text-qing tabular">
        主要变化:{{
          whatIf.modChanges
            .map((c) => `${c.label} ${c.delta > 0 ? "+" : ""}${formatPercent(c.delta, 0)}`)
            .join(" · ")
        }}
      </p>
      <p class="mt-0.5 text-[10px] text-ink-faint">推演只述局面,不替你定夺。</p>
    </template>
  </template>
</template>
