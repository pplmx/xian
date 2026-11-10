<template>
  <article
    class="dongfu-building"
    :class="{
      'is-built': level > 0,
      'is-ready': info.canUpgrade,
      'is-flashing': flashing,
    }"
    :data-dongfu-building-row="props.def.id"
    :data-state="info.canUpgrade ? 'ready' : level > 0 ? 'built' : 'empty'"
    @animationend.self="flashing = false"
  >
    <header class="dongfu-building__head">
      <span class="dongfu-building__mark" aria-hidden="true">
        <GameIcon :name="props.def.icon" :size="15" />
      </span>

      <div class="dongfu-building__identity">
        <div class="dongfu-building__name-row">
          <h4 class="dongfu-building__name">{{ props.def.name }}</h4>
          <span class="dongfu-building__level tabular">
            {{ level > 0 ? `${level}/${cap} 级` : "未启用" }}
          </span>
        </div>
        <div class="dongfu-building__progress track-ink" role="img" :aria-label="progressLabel">
          <span :style="{ width: levelProgress }" />
        </div>
      </div>

      <button
        type="button"
        class="dongfu-building__toggle"
        :aria-expanded="detailsOpen"
        :aria-controls="detailId"
        :aria-label="detailsOpen ? `收起${props.def.name}详情` : `展开${props.def.name}详情`"
        data-building-detail-toggle
        @click="detailsOpen = !detailsOpen"
      >
        <span aria-hidden="true">{{ detailsOpen ? "收" : "详" }}</span>
      </button>
    </header>

    <div class="dongfu-building__body">
      <div class="dongfu-building__facts">
        <p class="dongfu-building__fact">
          <span class="dongfu-building__fact-mark" aria-hidden="true">现</span>
          <span>{{ keepNumberUnit(primaryCurrent) }}</span>
        </p>
        <p v-if="primaryPreview" class="dongfu-building__fact dongfu-building__fact--next">
          <span class="dongfu-building__fact-mark" aria-hidden="true">将</span>
          <span>
            <span class="dongfu-building__next-label">{{
              preview.built ? "建成后" : `升至 ${preview.nextLevel} 级`
            }}</span>
            <span aria-hidden="true"> · </span>
            {{ keepNumberUnit(primaryPreview) }}
          </span>
        </p>
      </div>

      <button
        class="btn-ghost dongfu-building__action"
        data-building-action
        :disabled="!info.canUpgrade"
        @click="upgradeBuilding(props.def.id)"
      >
        <template v-if="info.canUpgrade">
          <span class="dongfu-building__action-verb">{{ level > 0 ? "升级" : "建造" }}</span>
          <span class="dongfu-building__action-cost tabular">{{ formatGN(info.stone) }} 石</span>
          <span v-if="info.ore > 0" class="dongfu-building__action-cost tabular"
            >· {{ info.ore }} 玄铁</span
          >
        </template>
        <template v-else>{{ keepNumberUnit(info.reason) }}</template>
      </button>
      <!--
        「受洞府等级所限」说清了原因,却答不了下一步。这条脚注补上——
        洞府要升到几级才放开这一次升级,由 core 的 mansionShortfallOf 现算。
        不并进按钮里:按钮上那句是「为什么按不得」,再加一句会把动作词挤折行;
        它是**出口**(去升洞府),故自成一行的注脚,与藏经阁的翻检线同位置。
      -->
      <p v-if="mansionGap" class="dongfu-building__gate" data-building-gate>
        <GameIcon name="home" :size="11" />
        <span>洞府升至 {{ mansionGap.needMansionLevel }} 级后,本级即可营建</span>
      </p>
    </div>

    <div v-show="detailsOpen" :id="detailId" class="dongfu-building__details">
      <div class="dongfu-building__detail-grid">
        <section class="dongfu-building__detail-column">
          <p class="dongfu-building__detail-label">当前效果</p>
          <div class="dongfu-building__detail-copy">
            <template v-if="level > 0">
              <p v-for="(line, i) in currentLines" :key="i">{{ keepNumberUnit(line) }}</p>
            </template>
            <p v-else>{{ props.def.desc }}</p>
          </div>
        </section>

        <section v-if="preview.lines.length" class="dongfu-building__detail-column">
          <p class="dongfu-building__detail-label dongfu-building__detail-label--next">
            {{ preview.built ? "建成后" : `升至 ${preview.nextLevel} 级` }}
          </p>
          <div class="dongfu-building__detail-copy">
            <p v-for="(line, i) in preview.lines" :key="i">{{ keepNumberUnit(line) }}</p>
          </div>
        </section>
      </div>

      <p v-if="beastCompanionName" class="dongfu-building__bond">
        <GameIcon name="paw" :size="11" />
        <span>居园相伴 · {{ beastCompanionName }}</span>
      </p>
      <p v-if="studyStatusLine" class="dongfu-building__study">
        <GameIcon name="book" :size="11" />
        <span>{{ studyStatusLine }}</span>
      </p>

      <section v-if="info.canUpgrade" class="dongfu-building__batch">
        <button
          class="btn-ghost dongfu-building__batch-action"
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
          <template v-else>
            <span class="whitespace-nowrap">连升×{{ BUILD_BATCH }}</span>
          </template>
        </button>

        <p
          v-if="batchPreview.lines.length && batch.levels > 1"
          class="dongfu-building__batch-preview"
        >
          <span class="text-ink-faint">升至 {{ batchPreview.nextLevel }} 级累积净得:</span>
          <span v-for="line in batchPreview.lines" :key="line" class="block">{{
            keepNumberUnit(line)
          }}</span>
        </p>
      </section>
    </div>
  </article>
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
import { mansionShortfallOf } from "@/core/engineFacilities";
import { formatDuration, formatGN } from "@/utils/format";
import GameIcon from "@/components/common/GameIcon.vue";
import { keepNumberUnit } from "@/utils/keepNumberUnit";

/** 连升一次至多升几级(与连炼×5 / 灵脉+5 同一种有界批量) */
const BUILD_BATCH = 5;

const props = defineProps<{ def: BuildingDef }>();

const dongfu = useDongfuStore();
const player = usePlayerStore();

const level = computed(() => dongfu.levels[props.def.id] ?? 0);
/** 实际可达上限:洞府全局闸门与自身品类上限取小,账行展现的是"提升到什么档"的依据 */
const cap = computed(() => dongfu.buildingCap(props.def.id));
const info = computed(() => buildingUpgradeInfo(props.def.id));
/**
 * 被洞府档住时,「洞府还差几级」的那一笔账。
 *
 * 账行平时只由 info.reason 说一句「受洞府等级所限」—— 那是原因,不是出路。
 * 这里读 core 的同一份判定(`mansionShortfallOf` 与 capOfBuilding 同源),
 * 不在视图里再算一遍洞府辖限的公式。
 *
 * 按 `info.blockedBy` 这枚**档位**分支,不按文案认:早先写成
 * `reason.includes("洞府")`,改一个字这条出口就静默消失,而没有任何门会红。
 */
const mansionGap = computed(() =>
  info.value.blockedBy === "mansion" ? mansionShortfallOf(props.def.id, dongfu.levels) : null,
);
const levelProgress = computed(() =>
  cap.value > 0 ? `${Math.min(1, level.value / cap.value) * 100}%` : "0%",
);
const progressLabel = computed(
  () => `${props.def.name} ${level.value}/${cap.value} 级，当前上限 ${cap.value} 级`,
);
/** 账面默认只露当前首项;完整效果在详情里 */
const currentLines = computed(() => (level.value > 0 ? props.def.effectText(level.value) : []));
const primaryCurrent = computed(() => currentLines.value[0] ?? props.def.desc);
/** 数字、量级与量词之间只许换行在分隔处,不许把「6 株」拆成两行 */

/** 连升整批会实际花掉的总账(只读预演,与 buildingUpgradeN 同一判定) —— 按下前把总数摊开 */
const batch = computed(() => buildingUpgradeBatchCost(props.def.id, BUILD_BATCH));
/** 连升整段的累积净得:与 batch 同一步数,从当前级直接 diff 到目标级(effectText 同源) */
const batchPreview = computed(() =>
  buildingUpgradePreview(props.def.id, level.value, cap.value, Math.max(1, batch.value.levels)),
);
/** 下一级增益预览:账面已显当前效果与代价,这里补「升上去会怎样」(effectText 同源,只报会变的行) */
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

// 升级落成:整行金光一闪(动画播完自清)
const flashing = ref(false);
const detailsOpen = ref(false);
const detailId = `building-detail-${props.def.id}`;
watch(level, (nv, ov) => {
  if (nv > ov) flashing.value = true;
});
</script>
