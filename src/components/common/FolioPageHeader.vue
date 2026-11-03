<template>
  <header
    class="folio-masthead relative overflow-hidden"
    :class="
      featured ? 'folio-masthead--featured px-4 pb-4 pt-4 tinylens:px-3' : 'px-4 py-3 tinylens:px-3'
    "
    data-folio-masthead
    :data-folio-featured="featured ? '' : undefined"
    :data-folio-ordinal="folioOrdinal"
  >
    <slot name="backdrop" />

    <!--
      册次水印 —— 全屏最大的那枚字,写汉字(与卷次小字「卷三」、章序「壹贰叁」、
      页签「乙丙」同一套序数语言)。此前它是「01」:页面上最大的字,
      也是唯一一处读得出来的阿拉伯序数。
      数字仍留在 data-folio-ordinal 上:那枚字是 aria-hidden 的纯装饰,
      但判据要能核「水印说的是第几册」—— 机器核对用数字,玩家看汉字,同源。
    -->
    <span
      class="folio-masthead__ordinal"
      :data-folio-ordinal-mark="folioOrdinalMarkValue"
      aria-hidden="true"
      >{{ folioOrdinalMarkValue }}</span
    >

    <div class="relative z-10 flex flex-wrap items-center gap-x-2 gap-y-1">
      <button
        v-if="backTo"
        type="button"
        class="tap-row -my-1.5 min-h-7 py-1.5 text-body text-ink-faint active:text-ink-soft"
        :aria-label="`返回${backLabel}`"
        @click="goBack(router, { name: backTo })"
      >
        ← {{ backLabel }}
      </button>
      <div data-folio-position class="flex min-w-0 items-center gap-1.5">
        <span
          class="folio-masthead__position shrink-0 text-note font-kai tracking-[0.2em] text-ink-faint compact:hidden"
          >{{ positionMark }}</span
        >
        <span class="sr-only" data-folio-section>{{ navigation?.sectionLabel ?? "玄枢" }}卷</span>
        <FolioIndexRail :items="chapterItems" label="本卷册目" />
      </div>
      <span
        class="h-px min-w-2 flex-1 bg-gradient-to-r from-ink/15 to-transparent"
        aria-hidden="true"
      />
      <span class="folio-masthead__book text-note text-ink-faint tinylens:hidden">{{
        navigation?.label ?? "未名之页"
      }}</span>
    </div>

    <div class="relative z-10 mt-2 flex flex-wrap items-start gap-3">
      <span
        class="folio-seal grid shrink-0 place-items-center"
        :class="featured ? 'h-11 w-11 tinylens:h-9 tinylens:w-9' : 'h-9 w-9'"
        aria-hidden="true"
      >
        <GameIcon :name="navigation?.icon ?? 'scroll'" :size="featured ? 20 : 17" />
      </span>
      <!--
        标题块保留 7rem 的可用宽度,空间不够时让右侧主视觉整块换到下一行。
        390 宽仍能与 140px 法球同排;更窄的 compact 档直接收起纯装饰法球,
        免得「洞府总览」被压成四行竖排。
      -->
      <div class="min-w-28 flex-1 compact:min-w-0">
        <h1
          class="font-kai leading-snug text-ink"
          :class="
            featured
              ? 'text-display tracking-[0.16em] tinylens:text-[19px]'
              : 'text-heading tracking-[0.18em]'
          "
        >
          {{ title }}
        </h1>
        <!--
          副题用 ink-soft 而不是 ink-faint:t-body 是 11px,11px 的淡墨在
          2100 页×视口的像素门里贴过线 —— 铸道案页头压着一层朱砂/石青光晕,
          底色被压暗后 ink-faint 只剩 4.41:1(需 4.5)。换深一档是 7.03:1,
          且它与标题之间仍拉开层次(小一号、非楷体、不占主线)。
        -->
        <p v-if="description" class="mt-1 t-body text-ink-soft">
          {{ description }}
        </p>
        <slot name="meta" />
      </div>
      <div
        v-if="$slots.visual"
        class="folio-masthead__visual ml-auto shrink-0 compact:hidden tinylens:hidden"
      >
        <slot name="visual" />
      </div>
      <div
        v-if="$slots.action"
        class="folio-masthead__action shrink-0 compact:w-full tinylens:w-full"
      >
        <slot name="action" />
      </div>
    </div>

    <div v-if="$slots.default" class="relative z-10 mt-3" data-folio-default>
      <slot />
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { goBack } from "@/router/goBack";
import { cnNumber } from "@/utils/format";
import { chapterRailItems } from "@/ui/folioIndexRail";
import { folioOrdinalMark } from "@/ui/folioOrdinal";
import { navigationPositionOf } from "@/ui/navigation";
import FolioIndexRail from "./FolioIndexRail.vue";
import GameIcon from "./GameIcon.vue";

const props = withDefaults(
  defineProps<{
    title: string;
    subtitle?: string;
    backTo?: string;
    backLabel?: string;
    /** 主册与人间共用的开卷版式:更大的册名、印章和可铺开的卷首正文 */
    featured?: boolean;
  }>(),
  { subtitle: "", backTo: "", backLabel: "返回", featured: false },
);

const route = useRoute();
const router = useRouter();
const position = computed(() => navigationPositionOf(route.name));
const navigation = computed(() => position.value?.entry);
const chapterItems = computed(() => chapterRailItems(route.name));
const positionMark = computed(() =>
  position.value
    ? `卷${cnNumber(position.value.sectionIndex + 1)} · ${position.value.section.label}`
    : "卷首",
);
const folioOrdinal = computed(() =>
  position.value ? String(position.value.entryIndex + 1).padStart(2, "0") : "00",
);
/**
 * 水印的汉字写法(见 ui/folioOrdinal)。
 *
 * 与 `folioOrdinal` 同源:两者都从 `position.entryIndex` 推出来,一个是给机器核对的
 * 「第几册」,一个是给眼睛看的写法。没有册目位置时(未登记的页)读「零」而不是空白 ——
 * 一枚空的水印会让卷首右上角出现一块没来由的凹陷。
 */
const folioOrdinalMarkValue = computed(() => folioOrdinalMark(position.value?.entryIndex ?? -1));
const description = computed(() => props.subtitle || navigation.value?.description || "");
</script>
