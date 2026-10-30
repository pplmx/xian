<template>
  <div
    class="card-ink flex flex-col px-3 py-3"
    :class="flashing ? 'card-flash' : ''"
    @animationend.self="flashing = false"
  >
    <div class="flex items-start gap-2">
      <span class="mt-0.5 shrink-0 text-ink-faint" aria-hidden="true">
        <GameIcon :name="props.def.icon" :size="14" />
      </span>
      <div class="min-w-0 flex-1">
        <p class="truncate font-kai text-title tracking-wider text-ink">
          {{ props.def.name }}
        </p>
        <div class="mt-1 flex items-center gap-1.5">
          <div class="track-ink h-1 min-w-0 flex-1 overflow-hidden rounded-full">
            <div class="bar-fill" :style="{ width: levelProgress }" />
          </div>
          <p
            :key="level"
            class="shrink-0 whitespace-nowrap text-note text-ink-faint animate-ink-pop"
          >
            {{ level > 0 ? `${level}/${cap} 级` : "未启用" }}
          </p>
          <button
            type="button"
            class="inline-flex min-h-[28px] min-w-[28px] shrink-0 items-center justify-center px-1 text-note text-ink-faint active:text-ink-soft"
            :aria-expanded="detailsOpen"
            :aria-controls="detailId"
            :aria-label="detailsOpen ? `收起${props.def.name}详情` : `展开${props.def.name}详情`"
            data-building-detail-toggle
            @click="detailsOpen = !detailsOpen"
          >
            {{ detailsOpen ? "收起" : "详情" }}
          </button>
        </div>
      </div>
    </div>

    <!--
      卡面只留两行决策摘要:当前最要紧的一项、下一级会变的一项。
      完整效果、联动与连升账都在下面的 disclosure 里,不再把双列卡铺成账本。
    -->
    <div class="mt-2 space-y-1 text-body leading-relaxed">
      <p class="text-ink-soft">{{ keepNumberUnits(primaryCurrent) }}</p>
      <p v-if="primaryPreview" class="text-gold-ink">
        <span class="font-kai tracking-wider">{{
          preview.built ? "建成后" : `升至 ${preview.nextLevel} 级`
        }}</span>
        <span class="text-ink-soft"> · {{ keepNumberUnits(primaryPreview) }}</span>
      </p>
    </div>

    <!--
      主升级键永远先于详情出现:卡上写多少料、点下去就扣多少料。
      连升是同一座建筑的批量动作,收进详情,避免双列卡同时摆两枚主键。
    -->
    <button
      class="btn-seal mt-2 min-h-[32px] w-full !py-1.5 !text-[12px]"
      data-building-action
      :disabled="!info.canUpgrade"
      @click="upgradeBuilding(props.def.id)"
    >
      <template v-if="info.canUpgrade">
        <span class="leading-tight">
          <span class="whitespace-nowrap">{{ level > 0 ? "升级" : "建造" }} ·</span>
          <span class="whitespace-nowrap tabular">{{ formatGN(info.stone) }} 石</span>
          <span v-if="info.ore > 0" class="whitespace-nowrap tabular">· {{ info.ore }} 玄铁</span>
        </span>
      </template>
      <template v-else
        ><span class="leading-tight">{{ keepNumberUnits(info.reason) }}</span></template
      >
    </button>

    <div v-show="detailsOpen" :id="detailId" class="mt-2 border-t border-ink/10 pt-2">
      <p class="font-kai text-note tracking-[0.2em] text-ink">当前效果</p>
      <div class="mt-0.5 space-y-0.5 text-note leading-relaxed text-ink-soft">
        <template v-if="level > 0">
          <p v-for="(line, i) in currentLines" :key="i">{{ keepNumberUnits(line) }}</p>
        </template>
        <p v-else>{{ props.def.desc }}</p>
      </div>

      <template v-if="preview.lines.length">
        <p class="mt-1 font-kai text-note tracking-wider text-gold-ink">
          {{ preview.built ? "建成后" : `升至 ${preview.nextLevel} 级` }}
        </p>
        <div class="space-y-0.5 text-note leading-relaxed text-ink-soft">
          <p v-for="(line, i) in preview.lines" :key="i">{{ keepNumberUnits(line) }}</p>
        </div>
      </template>

      <!-- 灵兽园:把当前相伴的灵兽报在园子里 —— 别的建筑都是数值,这里是活物 -->
      <p v-if="beastCompanionName" class="mt-1 flex items-center gap-1 text-note text-jade">
        <GameIcon name="paw" :size="11" />居园相伴 · {{ beastCompanionName }}
      </p>
      <!-- 藏经阁:下一张方子几时来 —— 丹方是全书唯一常驻被动流水,读数同开炉页(studyEta) -->
      <p v-if="studyStatusLine" class="mt-1 flex items-center gap-1 text-note text-gold-ink">
        <GameIcon name="book" :size="11" />{{ studyStatusLine }}
      </p>

      <!--
        连升:一次升到最多 ×5 级(或料尽/到顶即止)。取有界批量而非「一口气到顶」 ——
        玄铁是全局共用的硬料,连升不该有机会把兜里的玄铁一把烧光(连炼×5 / 灵脉+5 同手感)。
        总账在按下前摊开(与装备连强到顶同族):别让玩家对着「连升×5」就盲按。
      -->
      <div v-if="info.canUpgrade" class="mt-2">
        <button
          class="btn-ghost min-h-[28px] w-full !py-1 !text-note"
          :aria-label="`连升 ${BUILD_BATCH} 级`"
          :disabled="!info.canUpgrade"
          @click="buildingUpgradeN(props.def.id, BUILD_BATCH)"
        >
          <template v-if="batch.levels > 0">
            <span class="whitespace-nowrap">连升×{{ batch.levels }}</span>
            <span class="whitespace-nowrap tabular text-ink-soft">
              ·共 {{ formatGN(batch.stone) }} 石<span v-if="batch.ore > 0">
                {{ batch.ore }} 铁</span
              >
            </span>
          </template>
          <template v-else
            ><span class="whitespace-nowrap">连升×{{ BUILD_BATCH }}</span></template
          >
        </button>
        <!-- 连升整段的累积净得:钱的总账在按钮上,得的净得在这行 —— 两者同摆,一眼对上
             (batch.levels>1 才有意义;单步的净得卡面 preview 已报) -->
        <p
          v-if="batchPreview.lines.length && batch.levels > 1"
          class="mt-1 text-note leading-relaxed text-jade"
        >
          <span class="text-ink-faint">升至 {{ batchPreview.nextLevel }} 级累积净得:</span>
          <span v-for="line in batchPreview.lines" :key="line" class="block">{{
            keepNumberUnits(line)
          }}</span>
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { BuildingDef } from "@/types";
import { useDongfuStore } from "@/stores/dongfu";
import { usePlayerStore } from "@/stores/player";
import { petDef } from "@/data/pets";
import { pillDef } from "@/data/pills";
import {
  buildingUpgradeInfo,
  buildingUpgradeN,
  buildingUpgradePreview,
  buildingUpgradeBatchCost,
  upgradeBuilding,
} from "@/core/buildingService";
import { studyEta } from "@/core/loreService";
import { formatDuration, formatGN } from "@/utils/format";
import GameIcon from "@/components/common/GameIcon.vue";

/** 连升一次至多升几级(与连炼×5 / 灵脉+5 同一种有界批量) */
const BUILD_BATCH = 5;

const props = defineProps<{ def: BuildingDef }>();

const dongfu = useDongfuStore();
const player = usePlayerStore();

const level = computed(() => dongfu.levels[props.def.id] ?? 0);
/** 实际可达上限:洞府全局闸门与自身品类上限取小,洞府卡展现的是"提升到什么档"的依据 */
const cap = computed(() => dongfu.buildingCap(props.def.id));
const info = computed(() => buildingUpgradeInfo(props.def.id));
const levelProgress = computed(() =>
  cap.value > 0 ? `${Math.min(1, level.value / cap.value) * 100}%` : "0%",
);
/** 卡面默认只露当前首项;完整效果在详情里 */
const currentLines = computed(() => (level.value > 0 ? props.def.effectText(level.value) : []));
const primaryCurrent = computed(() => currentLines.value[0] ?? props.def.desc);
/** 数字、量级与量词之间只许换行在分隔处,不许把「6 株」拆成两行 */
function keepNumberUnits(text: string): string {
  return text.replace(
    /([\d,.]+(?:万|亿|兆)?)\s+(?=[石铁尘株张载年次件层场阶枚缕时日])/g,
    "$1\u00a0",
  );
}

/** 连升整批会实际花掉的总账(只读预演,与 buildingUpgradeN 同一判定) —— 按下前把总数摊开 */
const batch = computed(() => buildingUpgradeBatchCost(props.def.id, BUILD_BATCH));
/** 连升整段的累积净得:与 batch 同一步数,从当前级直接 diff 到目标级(effectText 同源) */
const batchPreview = computed(() =>
  buildingUpgradePreview(props.def.id, level.value, cap.value, Math.max(1, batch.value.levels)),
);
/** 下一级增益预览:卡面已显当前效果与代价,这里补「升上去会怎样」(effectText 同源,只报会变的行) */
const preview = computed(() => buildingUpgradePreview(props.def.id, level.value, cap.value));
const primaryPreview = computed(() => preview.value.lines[0] ?? "");
/** 灵兽园联动:洞府与宠物两系统彼此看见(只对 beast 这一座特例,其余建筑不理会) */
const beastCompanionName = computed(() =>
  props.def.id === "beast" && player.petId ? petDef(player.petId)?.name : undefined,
);
/**
 * 藏经阁的翻检线:丹方获取是全书唯一的常驻被动流水,得在它家门口报一声 ——
 * 升它之前,先看见它下一张方子几时来。读数与开炉页同一份 studyEta。
 */
const studyStatusLine = computed(() => {
  if (props.def.id !== "library") return "";
  const eta = studyEta();
  if (eta === null) return "";
  if (eta.nextInSec <= 0) return "丹方皆已了然,无书可翻";
  const when = formatDuration(Math.round(eta.nextInSec));
  return eta.nextIsNew
    ? `约 ${when} 后翻出新方`
    : `约 ${when} 后读通「${eta.readingId ? (pillDef(eta.readingId)?.name ?? eta.readingId) : ""}」`;
});

// 升级落成:整卡金光一闪(动画播完自清)
const flashing = ref(false);
const detailsOpen = ref(false);
const detailId = `building-detail-${props.def.id}`;
watch(level, (nv, ov) => {
  if (nv > ov) flashing.value = true;
});
</script>
