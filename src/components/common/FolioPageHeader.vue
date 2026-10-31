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

    <span class="folio-masthead__ordinal" aria-hidden="true">{{ folioOrdinal }}</span>

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
        class="folio-seal grid shrink-0 place-items-center border border-ink/20 text-ink-soft"
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
        <p v-if="description" class="mt-1 t-body text-ink-faint">
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
import { navigationPositionOf } from "@/ui/navigation";
import FolioIndexRail from "./FolioIndexRail.vue";
import GameIcon from "./GameIcon.vue";

const props = withDefaults(
  defineProps<{
    title: string;
    subtitle?: string;
    backTo?: string;
    backLabel?: string;
    /** 主五册的开卷版式:更大的册名、印章和可铺开的卷首正文 */
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
const description = computed(() => props.subtitle || navigation.value?.description || "");
</script>
