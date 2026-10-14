<template>
  <div
    class="card-ink flex flex-col px-3 py-3"
    :class="flashing ? 'card-flash' : ''"
    @animationend.self="flashing = false"
  >
    <div class="flex items-start justify-between gap-2">
      <p class="min-w-0 truncate font-kai text-[14px] tracking-wider text-ink">
        {{ props.def.name }}
      </p>
      <p :key="level" class="shrink-0 text-[10px] text-ink-faint animate-ink-pop">
        {{ level > 0 ? `${level}/${cap} 级` : "未启用" }}
      </p>
    </div>
    <!-- 每项效果一行一条:320px 双列卡里散文不再堆成 4~5 行高墙,两列高度也齐 -->
    <div class="mt-2 grow space-y-0.5 text-[11px] leading-relaxed text-ink-faint">
      <template v-if="level > 0">
        <p v-for="(line, i) in props.def.effectText(level)" :key="i">{{ line }}</p>
      </template>
      <p v-else>{{ props.def.desc }}</p>
    </div>
    <!--
      下一级增益预览:卡面已显当前效果与代价,只补「升上去会怎样」——
      与 effectText 同源,只报字面会变的行(平铺说明、未触发的档都不算增益)。
      首建(0→1)没有当前效果,预览就是「建成后」的整张效果。
      标签一行、每条变更行各占一行块(与当前效果的渲染同构),
      这样「数字与量词」(每小时产灵草 X 株)不会被一行挤到跨行拆开。
    -->
    <p v-if="preview.lines.length" class="mt-1 font-kai text-[10px] tracking-wider text-gold-ink">
      {{ preview.built ? "建成后" : `升至 ${preview.nextLevel} 级` }}
    </p>
    <div v-if="preview.lines.length" class="space-y-0.5 text-[10px] leading-relaxed text-ink-soft">
      <p v-for="(line, i) in preview.lines" :key="i">{{ line }}</p>
    </div>
    <!-- 灵兽园:把当前相伴的灵兽报在园子里 —— 别的建筑都是数值,这里是活物 -->
    <p v-if="beastCompanionName" class="mt-1 flex items-center gap-1 text-[10px] text-jade">
      <GameIcon name="paw" :size="11" />居园相伴 · {{ beastCompanionName }}
    </p>
    <!-- 藏经阁:下一张方子几时来 —— 丹方是全书唯一常驻被动流水,读数同开炉页(studyEta) -->
    <p v-if="studyStatusLine" class="mt-1 flex items-center gap-1 text-[10px] text-gold-ink">
      <GameIcon name="book" :size="11" />{{ studyStatusLine }}
    </p>
    <div class="mt-2 flex flex-col gap-1">
      <button
        class="btn-ghost w-full !py-1.5 !text-[12px]"
        :disabled="!info.canUpgrade"
        @click="upgradeBuilding(props.def.id)"
      >
        <!--
          数与量词必须黏在一起:窄屏(320)上卡片只有 ~140px,浏览器会在数字与「石」之间断行,
          于是按钮读成「升级 · 2,798 / 石 50铁」—— 单价被拆成两半。
          每个「数 + 量词」各自 nowrap,换行只发生在分隔符处。

          外面这层 span 也是必须的:btn-ghost 是 flex 容器,散落的文本节点会各自成为
          flex item 并**竖着堆**(实测直接把「升 / 级 / · / 317 石」排成一列)。
          收进一个 inline 文本块里,它们才按普通行内规则折行。
        -->
        <template v-if="info.canUpgrade">
          <span class="leading-tight">
            <span class="whitespace-nowrap">{{ level > 0 ? "升级" : "建造" }} ·</span>
            <span class="whitespace-nowrap tabular">{{ formatGN(info.stone) }} 石</span>
            <span v-if="info.ore > 0" class="whitespace-nowrap tabular">· {{ info.ore }} 玄铁</span>
          </span>
        </template>
        <template v-else
          ><span class="whitespace-nowrap">{{ info.reason }}</span></template
        >
      </button>
      <!-- 连升:一次升到最多 ×5 级(或料尽/到顶即止)。取有界批量而非「一口气到顶」 ——
           玄铁是全局共用的硬料,连升不该有机会把兜里的玄铁一把烧光(连炼×5 / 灵脉+5 同手感)。
           独立一行而不是并排:卡片是 2 列窄卡(200% 放大后内宽仅 ~84px),并排会把
           主按钮挤到折行/越界 —— 与灵脉投资那行(整宽区)不同,这里只能上下叠。 -->
      <button
        v-if="info.canUpgrade"
        class="btn-ghost min-h-[28px] w-full !py-1 !text-[10px]"
        aria-label="连升 5 级"
        :disabled="!info.canUpgrade"
        @click="buildingUpgradeN(props.def.id, BUILD_BATCH)"
      >
        <span class="whitespace-nowrap">连升×{{ BUILD_BATCH }}</span>
      </button>
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
/** 下一级增益预览:卡面已显当前效果与代价,这里补「升上去会怎样」(effectText 同源,只报会变的行) */
const preview = computed(() => buildingUpgradePreview(props.def.id, level.value, cap.value));
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
watch(level, (nv, ov) => {
  if (nv > ov) flashing.value = true;
});
</script>
