<script setup lang="ts">
/**
 * 重铸面板 —— 页脚「重铸与封存」块(Phase 30.1)整体(拆自 EquipmentDetailDialog)。
 *
 * 归属:重铸(一键直达,无两步确认——用户拍板连贯性优先)、封存价签与短差(行内
 * 「封存/解除」操作在 EquipSealPanel,逐词条行用)、重铸说明与已重铸/已封存
 * 计数、自动重铸(多选停止词条 + 最低值 + 预算 + 开洗)、以及词条转移的
 * 入口开关(转移本体在 AffixTransferPanel —— 入口与它同处一列,拆到两个
 * 组件再拼一列毫无收益,故开关随本面板)。
 *
 * 状态在 store 的自读 pinia:自读 ui.equipDetailUid + inventory,与宿主拿到
 * 同一份 inst;成本/上限/封存容量全读 core/reforge 与品质表,不持第二份账。
 * 换一件装备(或行囊里没了这件)即收起自动重铸与转移面板
 * (原宿主 watch(inst) 的语义,随块搬入)。
 */
import { computed, ref, watch } from "vue";
import { useUiStore } from "@/stores/ui";
import { useInventoryStore } from "@/stores/inventory";
import { useResourcesStore } from "@/stores/resources";
import { affixDef } from "@/data/affixes";
import { qualityDef } from "@/data/qualities";
import { skillStageName } from "@/data/crafting";
import {
  expectedReforgesFor,
  autoReforge,
  reforgeEquipment,
  reforgeCost,
  sealCapacity,
  sealCost,
  inscribeRollFloor,
  reforgeAffixPool,
  type ReforgeTarget,
} from "@/core/reforge";
import { formatGN, formatPercent } from "@/utils/format";
import { toNum, subClamp } from "@/utils/gnum";
import { useLoreStore } from "@/stores/lore";
import AffixTransferPanel from "./AffixTransferPanel.vue";

const ui = useUiStore();
const inventory = useInventoryStore();
const resources = useResourcesStore();
const lore = useLoreStore();

const inst = computed(() =>
  ui.equipDetailUid ? inventory.findItem(ui.equipDetailUid) : undefined,
);

// ---- 重铸与封存 (Phase 30.1) ----
const reforgeCostVal = computed(() => (inst.value ? reforgeCost(inst.value) : null));
/** 付不起即灰:重铸要器灵尘与灵石两道账,缺一不可(与 forge.upgradeEquipment 同口径) */
const reforgeAffordable = computed(() => {
  const c = reforgeCostVal.value;
  if (!c) return false;
  return resources.hasSmall("dust", c.dust) && resources.hasStone(c.stone);
});
const sealCostVal = computed(() => (inst.value ? sealCost(inst.value) : null));
/** 封存付得起吗 —— 成本与 sealAffix 同源(sealCost),仅灵石一道账,缺则置灰 */
const sealAffordable = computed(
  () => sealCostVal.value !== null && resources.hasStone(sealCostVal.value),
);
/** 封存短额:走 GNum 指数感知减法(subClamp,与天道熔炉同款),差多少明说「尚差 N 灵石」 */
const sealShortfall = computed(() =>
  sealCostVal.value === null ? 0 : toNum(subClamp(sealCostVal.value, resources.spiritStone)),
);
/** 这一件按品质能有多少条词条:上限来自品质表,不在界面里另写一份 */
const affixCap = computed(() => (inst.value ? qualityDef(inst.value.quality).affixes[1] : 0));
/** 铭纹决定新词条掷点下限;阶段名与技艺进度条同源,不给重铸面板再造一套等级名 */
const inscribeLevel = computed(() => lore.skillLevel("inscribe"));
const inscribeFloor = computed(() => inscribeRollFloor(inscribeLevel.value));
const inscribeStage = computed(() => skillStageName(inscribeLevel.value));

function doReforge(): void {
  if (inst.value) reforgeEquipment(inst.value.uid);
}

// ---- 自动重铸(玩家反馈:一键重铸多次,洗到指定词条就停) ----
const autoOpen = ref(false);
const transferOpen = ref(false);
const autoBudget = ref(50);
/** 预算越界输入(手打 0 / 600)不静默按 500 洗:提交时即夹到 [1,500],让
 * 「至多洗 N 次」显示与实跑 clampAutoBudget 同口径 —— 预览与实发不许脱节。 */
function clampAutoBudget(): void {
  const raw = Math.floor(Number(autoBudget.value) || 0);
  autoBudget.value = Math.min(500, Math.max(1, raw));
}
/** 停止条件:任一命中即停;minRoll 给「数值范围」那一嘴 */
const autoTargets = ref<ReforgeTarget[]>([]);
/** 首洗成本判付不起:自动重铸每洗与单次重铸同源(reforgeCost),缺一道账即灰 */
const autoAffordable = computed(() => {
  const c = reforgeCostVal.value;
  if (!c) return false;
  return resources.hasSmall("dust", c.dust) && resources.hasStone(c.stone);
});

/**
 * 可选的停止词条:当前装备**真能洗到**的那些 —— 与重铸抽取池同规则
 * (槽位匹配 + 品质门槛不高于当前),而不是全 113 条里按权重取前 24。
 * 否则连「想洗的词条在 24 名开外」都选不进去,自动重铸就等于承诺了
 * 一份它兑现不了的面板。
 */
const affixOptions = computed(() => {
  if (!inst.value) return [];
  return [...reforgeAffixPool(inst.value)].sort((a, b) => b.weight - a.weight);
});

/** 选中目标按当前阈值与铭纹保底重算约几次;null = 当前不可能命中 */
function autoTriesOf(target: ReforgeTarget): number | null {
  return triesOf(target.affixId, target.minRoll ?? 0);
}
const autoReachable = computed(() => autoTargets.value.some((t) => autoTriesOf(t) !== null));

function isAutoTarget(id: string): boolean {
  return autoTargets.value.some((t) => t.affixId === id);
}

function toggleAutoTarget(id: string): void {
  if (isAutoTarget(id)) autoTargets.value = autoTargets.value.filter((t) => t.affixId !== id);
  // 默认先求「高值」(≥50%);拉到底 0% 即回到「出现就行」
  else if (autoTargets.value.length < 3)
    autoTargets.value = [...autoTargets.value, { affixId: id, minRoll: 0.5 }];
}

function closeAuto(): void {
  autoOpen.value = false;
  autoTargets.value = [];
}

function runAutoReforge(): void {
  if (!inst.value) return;
  const targets = autoTargets.value;
  const budget = Math.min(500, Math.max(1, Math.floor(autoBudget.value || 0)));
  const out = autoReforge(inst.value.uid, targets, budget);
  const cost = `花 器灵尘×${out.dust} · 灵石 ${formatGN(out.stone)}`;
  // 「没洗到目标」不等于「没洗动」:每次重铸词条都尽数重掷,结账要报清现在这一身落在哪
  const wanted = autoTargets.value.map((t) => affixDef(t.affixId)?.name ?? t.affixId).join("、");
  const now = out.affixIds.map((id) => affixDef(id)?.name ?? id).join("、") || "空";
  if (out.stop === "target" && out.hit) {
    ui.toast(
      `洗出「${affixDef(out.hit.id)?.name ?? out.hit.id}」值 ${formatPercent(out.hit.roll, 0)} —— 共洗 ${out.rolls} 次,${cost}`,
      "success",
    );
  } else if (out.stop === "budget") {
    ui.toast(
      `定好的次数用完了:连洗 ${out.rolls} 次,未能撞上「${wanted}」。如今这一身是:${now},${cost}`,
      "warn",
    );
  } else if (out.stop === "broke") {
    if (out.rolls === 0) {
      ui.toast(`灵石或器灵尘未足,难开这一炉,${cost}`, "warn");
    } else {
      ui.toast(`灵石/器灵尘见底,洗了 ${out.rolls} 次即止;今一身为 ${now},${cost}`, "warn");
    }
  } else if (out.stop === "unreachable") {
    ui.toast("这些目标当前不会命中:封存词条不会重掷,或阈值已到 100%;分文未动", "warn");
  } else {
    // frozen 一档兼两种收法:无位可洗(全封存/无词条),或装备已不在行囊
    const gone = inst.value !== undefined && !inventory.findItem(inst.value.uid);
    ui.toast(gone ? "此物已不在行囊,重铸无从谈起" : "此物已无未封存词条,无从重铸", "info");
  }
  // 结账即收板:结果已写在 toast 与装备词条上,想再调条件重开一次即可
  closeAuto();
}

/**
 * 重铸与自动重铸**一键直达,没有两步确认**(用户拍板 2026-10-18:每次都要
 * 先「武装」再确认,连洗几批时严重影响连贯性)。
 * 误触的代价经过权衡后可接受:重掷的是未封存词条(封存可提前保护),
 * 洗完的结果也明写进 toast —— 不像分解那样不可逆地失去整件。
 * 换一件装备(或这件已不在行囊)仍会收起两块展开面板。
 */
watch(inst, () => {
  autoOpen.value = false;
  transferOpen.value = false;
  autoTargets.value = [];
});

/** 洗到这一条的平均次数(只给次数,不给概率) */
function triesOf(id: string, minRoll = 0): number | null {
  const it = inst.value;
  return it ? expectedReforgesFor(it, id, { minRoll, rollFloor: inscribeFloor.value }) : null;
}
</script>

<template>
  <!--
    自动重铸:洗到指定词条即停(玩家反馈,可多选、可给最低值)。
    注意它**不属于**上方的天机推演(修士实验室) —— 那是真仙+未装备才有的
    v-if="canWhatIf" 段;重铸是凡人也在用的功能,若嵌在里面,普通玩家点开
    开关只会变字、词条格子与「开洗」永远不渲染(实测即玩家反馈的「没生效」)。
  -->
  <div
    v-if="autoOpen && reforgeCostVal"
    class="mt-3 rounded-md border border-ink/15 bg-paper-deep/50 px-3 py-2"
  >
    <p class="mb-1 text-[11px] text-ink-soft">洗到这些词条出现就停(任一命中即停,至多 3 条)</p>
    <div class="scroll-pane grid max-h-36 grid-cols-3 gap-1 overflow-y-auto">
      <button
        v-for="af in affixOptions"
        :key="af.id"
        class="rounded px-1 py-1 text-[10px] leading-tight active:opacity-60"
        :aria-pressed="isAutoTarget(af.id)"
        :class="
          isAutoTarget(af.id) ? 'border border-cinnabar text-cinnabar' : 'bg-ink/4 text-ink-faint'
        "
        @click="toggleAutoTarget(af.id)"
      >
        {{ af.name
        }}<span v-if="triesOf(af.id)" class="mt-0.5 block text-[9px] text-ink-soft"
          >约 {{ triesOf(af.id) }} 次</span
        >
      </button>
    </div>
    <div v-if="autoTargets.length" class="mt-1.5 space-y-1">
      <div v-for="t in autoTargets" :key="t.affixId" class="space-y-0.5 text-[10px] text-ink-faint">
        <p class="flex items-center gap-2">
          <span class="w-10 shrink-0 font-kai text-ink-soft">{{
            affixDef(t.affixId)?.name ?? t.affixId
          }}</span>
          <input
            v-model.number="t.minRoll"
            type="range"
            min="0"
            max="1"
            step="0.05"
            class="grow accent-cinnabar"
          />
          <span class="w-12 shrink-0 text-right tabular"
            >≥{{ formatPercent(t.minRoll ?? 0, 0) }}</span
          >
        </p>
        <p
          class="pl-12 text-[9px] tabular"
          :class="autoTriesOf(t) === null ? 'text-cinnabar' : 'text-ink-soft'"
        >
          <template v-if="autoTriesOf(t) === null">不会命中</template>
          <template v-else>按当前门槛,约 {{ autoTriesOf(t) }} 次</template>
        </p>
      </div>
    </div>
    <div class="mt-1.5 flex items-center gap-2">
      <span class="text-[10px] text-ink-faint tabular">至多洗</span>
      <input
        v-model.number="autoBudget"
        type="number"
        min="1"
        max="500"
        aria-label="自动重铸至多洗几次"
        class="w-16 rounded border border-ink/15 bg-paper/70 px-1 py-0.5 text-[16px] tabular"
        @change="clampAutoBudget"
      />
      <span class="text-[10px] text-ink-faint tabular"
        >次 · 每洗 器灵尘×{{ reforgeCostVal.dust }} · 灵石
        {{ formatGN(reforgeCostVal.stone) }}</span
      >
      <button
        class="btn-ghost ml-auto !px-3 !py-1 !text-[11px]"
        :disabled="!autoTargets.length || !autoReachable || !autoAffordable"
        :title="
          !autoTargets.length
            ? '先点一条要洗到的词条'
            : !autoReachable
              ? '这些目标当前不会命中'
              : autoAffordable
                ? undefined
                : '灵石或器灵尘不足'
        "
        @click="runAutoReforge"
      >
        开 洗
      </button>
    </div>
    <!-- 首洗就付不起,预告就把它摆出来(与重铸/封存同款):灰钮不许只有 broke toast -->
    <p v-if="autoTargets.length && !autoAffordable" class="mt-1 text-[10px] text-cinnabar tabular">
      尚差 器灵尘×{{ Math.max(0, reforgeCostVal.dust - resources.dust) }} · 灵石
      {{ formatGN(Math.max(0, toNum(reforgeCostVal.stone) - toNum(resources.spiritStone))) }}
    </p>
    <p v-if="autoTargets.length && !autoReachable" class="mt-1 text-[10px] text-cinnabar">
      这些目标不会命中:封存词条不重掷,或阈值已到 100%。
    </p>
  </div>
  <!-- 重铸与封存 (Phase 30.1) -->
  <template v-if="reforgeCostVal || sealCostVal">
    <div class="flex gap-2 text-[11px]">
      <button
        v-if="reforgeCostVal"
        class="btn-ghost flex-1 !py-1"
        :disabled="!reforgeAffordable"
        @click="doReforge"
      >
        重铸词条
        <span class="ml-1 tabular text-[10px] text-ink-faint">
          器灵尘×{{ reforgeCostVal.dust }} · 灵石 {{ formatGN(reforgeCostVal.stone) }}
        </span>
      </button>
      <div
        v-if="sealCostVal"
        class="flex flex-1 items-center justify-center rounded-md border px-2 py-1"
        :class="
          sealAffordable
            ? 'border-qing/20 bg-qing/5 text-qing'
            : 'border-ink/10 bg-ink/4 text-ink-faint'
        "
      >
        封存一词 {{ formatGN(sealCostVal) }}
      </div>
    </div>
    <!-- 付不起就把缺摆出来(与强化同款):重铸同样器灵尘+灵石两道账,缺谁明说谁 -->
    <p v-if="reforgeCostVal && !reforgeAffordable" class="mt-1 text-[10px] text-cinnabar tabular">
      尚差 器灵尘×{{ Math.max(0, reforgeCostVal.dust - resources.dust) }} · 灵石
      {{ formatGN(Math.max(0, toNum(reforgeCostVal.stone) - toNum(resources.spiritStone))) }}
    </p>
    <!-- 封存只算灵石一道账:付不起同样置灰+列差,不许只有点了才听见 toast -->
    <p v-if="sealCostVal && !sealAffordable" class="mt-1 text-[10px] text-cinnabar tabular">
      封存尚差 {{ formatGN(sealShortfall) }} 灵石
    </p>
    <!--
      重铸到底做什么,得在按下之前说清:条数与数值一并重掷(封存的不动),
      不限次数、成本只随「阶数」与「封存数」走 —— 与旧版"越洗越贵、上限十次"不同。
    -->
    <p v-if="reforgeCostVal" class="text-center text-[10px] leading-relaxed text-ink-faint">
      重掷未封存的词条:条数(≤{{ affixCap }} 条)与数值一并重掷,封存的不动 ·
      不限次数,成本随阶数与封存数走
    </p>
    <p v-if="reforgeCostVal" class="text-center text-[10px] text-qing tabular">
      铭纹·{{ inscribeStage }}:新词条掷点 ≥ {{ formatPercent(inscribeFloor, 0) }},封存不受
    </p>
    <p v-if="inst" class="text-center text-[10px] text-ink-faint tabular">
      已重铸 {{ inst.reforgeCount ?? 0 }} 次 · 已封存 {{ (inst.sealedAffixIds ?? []).length }}/{{
        sealCapacity(inst)
      }}
    </p>
    <button
      v-if="reforgeCostVal"
      class="btn-ghost w-full !py-1 !text-[11px]"
      :aria-expanded="autoOpen"
      @click="autoOpen = !autoOpen"
    >
      {{ autoOpen ? "收起自动重铸" : "自动重铸 · 洗到指定词条即停" }}
    </button>
    <button
      class="btn-ghost w-full !py-1 !text-[11px]"
      :aria-expanded="transferOpen"
      @click="transferOpen = !transferOpen"
    >
      {{ transferOpen ? "收起词条转移" : "词条转移 · 抽一条给别的装备" }}
    </button>
    <AffixTransferPanel v-if="transferOpen && inst" :source="inst" @close="transferOpen = false" />
  </template>
</template>
