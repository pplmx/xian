<template>
  <!-- 天道熔炉 -->
  <BaseModal :open="open" title="天道熔炉" @close="emit('close')">
    <p class="mb-2 t-body text-ink-faint">前尘俗物,皆可熔作道源。</p>
    <div class="card-ink divide-y divide-ink/7 px-4">
      <div v-for="row in furnaceRows" :key="row.rate.resource" class="py-2.5">
        <div class="flex items-center justify-between gap-2">
          <span class="text-[11px] text-ink-soft"
            >{{ row.rate.name }}(存 {{ formatNum(row.have) }})</span
          >
          <!-- 全熔防误触:文案亮出『整包』与可得道源(不再是『按 25:1 换』的可兑换暗示),再按一下才熔 -->
          <button
            class="btn-ghost !px-3 !py-1 !text-[11px] tabular"
            :disabled="furnacePreview(row.rate) <= 0"
            @click="furnaceConfirm = row.rate.resource"
          >
            熔尽本包 → {{ furnacePreview(row.rate) }} 道源
          </button>
        </div>
        <div
          v-if="furnaceConfirm === row.rate.resource"
          class="mt-1.5 rounded-md bg-cinnabar/5 px-3 py-2"
        >
          <p class="text-[10px] leading-relaxed text-cinnabar">
            将
            <span class="tabular"
              >{{ row.rate.name }} ×{{ formatNum(furnacePreview(row.rate) * row.rate.per) }}</span
            >
            熔作道源,共 <span class="tabular">+{{ furnacePreview(row.rate) }}</span> 缕
            <template v-if="row.have % row.rate.per > 0"
              >,余
              <span class="tabular">{{
                formatNum(row.have - furnacePreview(row.rate) * row.rate.per)
              }}</span>
              保留</template
            >
            —— 此举不可逆,熔去的这些再无炼丹/锻造/参悟之途。
          </p>
          <div class="mt-1.5 flex justify-end gap-2">
            <button class="btn-ghost !px-3 !py-1 !text-[11px]" @click="furnaceConfirm = null">
              再想想
            </button>
            <button class="btn-seal !px-3 !py-1 !text-[11px] tabular" @click="doFurnace(row.rate)">
              确认熔尽
            </button>
          </div>
        </div>
      </div>
      <div class="flex items-center justify-between py-2.5">
        <span class="text-[11px] text-ink-soft"
          >灵石(存 {{ formatGN(resources.spiritStone) }})</span
        >
        <!-- 灵石不足置灰+列差:值与差异都现算(与熔尽本包/其余消费点同款纪律) -->
        <button
          class="btn-ghost !px-3 !py-1 !text-[11px] tabular"
          :disabled="stoneShort > 0"
          @click="furnaceConvertStone()"
        >
          <template v-if="stoneShort > 0">尚差 {{ formatGN(stoneShort) }} 石</template>
          <template v-else
            >{{ formatGN(furnaceStoneCost()) }} → {{ FURNACE_STONE_DAO_SOURCE }} 道源</template
          >
        </button>
      </div>
      <div class="py-2.5">
        <div class="flex items-center justify-between">
          <span class="text-[11px] text-ink-soft">道源凝道果(跨世保留)</span>
          <!-- 道源不足置灰+列差:差多少现算(与灵石行同款) -->
          <button
            class="btn-ghost !px-3 !py-1 !text-[11px] tabular"
            :disabled="daoShort > 0"
            @click="doCondense()"
          >
            <template v-if="daoShort > 0">尚差 {{ daoShort }} 道源</template>
            <template v-else>{{ DAO_SOURCE_PER_FRUIT }} 道源 → 道果 +1</template>
          </button>
        </div>
        <!--
          主读数:凝一枚,下世收益变多少 —— 站在这一行的人就问这一件事,此前却把
          「凝后 +N%」埋在 10px 小字注脚里(与命格之力/今日利同款病,三档范式见
          RealmCodexView 紫微/星象册的重排注释)。提成主值行:标签淡字 + 主读数
          楷体放大(弹窗字阶 14;页面册是 15)。当前/有效存量与「边际收益渐减」
          是口径旁注,降回 10px 一行。
        -->
        <div data-value-row class="mt-1 flex items-baseline gap-2">
          <span class="shrink-0 text-[11px] text-ink-faint">凝一枚</span>
          <span class="font-kai text-[14px] text-gold-ink tabular"
            >下世有效 {{ fruitInfo.nextEffectiveText }} 枚(+{{ fruitInfo.deltaPct }}%)</span
          >
        </div>
        <p class="mt-0.5 text-[10px] leading-relaxed text-ink-faint tabular">
          当前 {{ fruitInfo.total }} 枚 · 有效 {{ fruitInfo.effectiveText }} 枚 · 边际收益渐减
        </p>
      </div>
    </div>
    <template #footer>
      <button class="btn-seal w-full" @click="emit('close')">收 炉</button>
    </template>
  </BaseModal>

  <!-- 首次凝道果:把「跨世保留的到底是什么」讲一次 -->
  <BaseModal :open="fruitDialogOpen" title="道果" @close="fruitDialogOpen = false">
    <div class="space-y-2.5 text-[11px] leading-relaxed">
      <p class="text-ink-soft">{{ fruitDialog.intro }}</p>
      <div>
        <p class="font-kai text-[11px] tracking-wider text-ink">用途</p>
        <p class="text-ink-faint">{{ fruitDialog.usages.join(" · ") }}</p>
      </div>
      <div>
        <p class="font-kai text-[11px] tracking-wider text-ink">来处</p>
        <p class="text-ink-faint">{{ fruitDialog.gains.join(" · ") }}</p>
      </div>
      <p class="border-l-2 border-violet-ink/60 pl-2 text-[11px] text-violet-ink">
        {{ fruitDialog.lifecycle }}
      </p>
    </div>
    <template #footer>
      <button class="btn-seal w-full" @click="fruitDialogOpen = false">知道了</button>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useResourcesStore } from "@/stores/resources";
import { usePlayerStore } from "@/stores/player";
import { useEndgameStore } from "@/stores/endgame";
import {
  DAO_SOURCE_PER_FRUIT,
  FURNACE_RATES,
  FURNACE_STONE_DAO_SOURCE,
  type FurnaceRate,
} from "@/data/endgame";
import {
  condenseDaoFruit,
  furnaceConvert,
  furnaceConvertStone,
  furnaceStoneCost,
} from "@/core/endgameService";
import {
  daoFruitDialog,
  fruitMarginalInfo,
  markFruitTutorialSeen,
  shouldShowFruitTutorial,
} from "@/core/resourceGuidance";
import { formatGN, formatNum } from "@/utils/format";
import { subClamp, toNum } from "@/utils/gnum";
import BaseModal from "@/components/common/BaseModal.vue";

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const resources = useResourcesStore();
const player = usePlayerStore();
const endgame = useEndgameStore();

/** 熔炉全熔确认态(按资源键)。熔炉弹窗关闭即复位,不残留旧行 */
const furnaceConfirm = ref<FurnaceRate["resource"] | null>(null);
watch(
  () => props.open,
  (open) => {
    if (!open) furnaceConfirm.value = null;
  },
);
/** 全熔一包可得道源(预览,与 furnaceConvert 同口径 floor(have/per)) */
function furnacePreview(rate: FurnaceRate): number {
  return Math.floor(resources[rate.resource] / rate.per);
}
/** 熔灵石差多少(付不起置灰):现算,不点下去才知道缺 */
/**
 * 灵石→道源 尚差:必须走 GNum 指数感知减法 —— 尾数直接相减(.m - .m)会丢掉指数,
 * 跨数量级时错置灰(6.1 万价、30 万持有曾被判成「差 3 石」)且报「尚差」错三位数。
 * subClamp = 与 spendStone 同一本账的减法并保底零,toNum 落成普通数
 * 给模板的 `> 0` 比较与 formatGN 显示(判据与消费点同源)。
 */
const stoneShort = computed(() => toNum(subClamp(furnaceStoneCost(), resources.spiritStone)));
/** 凝道果差多少(付不起置灰):与 spendDaoSource 拒绝臂同口径 */
const daoShort = computed(() => Math.max(0, DAO_SOURCE_PER_FRUIT - endgame.daoSource));
function doFurnace(rate: FurnaceRate): void {
  furnaceConfirm.value = null;
  furnaceConvert(rate);
}
const fruitInfo = computed(() => fruitMarginalInfo());

/**
 * 凝道果 —— 首次成功时把「道果是什么」讲一次。
 *
 * shouldShowFruitTutorial / daoFruitDialog 写好了却无人调用:
 * 玩家第一次凝出道果(整套轮回经济的核心货币)时,没有任何解释。
 */
const fruitDialogOpen = ref(false);
const fruitDialog = computed(() => daoFruitDialog());
function doCondense(): void {
  const before = player.reincarnation.daoFruit;
  // 标志序陷阱:condenseDaoFruit 在首次成功时自己就置 daoFruitTutorialSeen=true
  // (endgameService),若在它之后才读 shouldShowFruitTutorial(),判定恒为假,
  // 这条「首次凝道果」教学弹窗就永不弹出 —— 必须先于凝果采样.
  const firstFruit = shouldShowFruitTutorial();
  condenseDaoFruit();
  if (player.reincarnation.daoFruit === before) return;
  if (firstFruit) {
    fruitDialogOpen.value = true;
    markFruitTutorialSeen();
  }
}

const furnaceRows = computed(() =>
  FURNACE_RATES.map((rate) => ({ rate, have: resources[rate.resource] })),
);
</script>
