<template>
  <header
    data-folio-head
    class="app-masthead folio-head relative z-20 shrink-0 border-b border-transparent bg-paper-deep/90 px-4 py-2 backdrop-blur short:py-1 tinylens:px-2"
    :style="`padding-top: max(env(safe-area-inset-top), ${statusTopPad})`"
  >
    <!--
      底缘那道渐隐墨线 —— 与底栏上缘同一句写法,两栏因此成一对「书页的上下切口」。

      这里只换画法、不动边框职责:border-b 的宽度与颜色原先一起承担「一条实线」的职责,
      现在让宽度留着(transparent)、线交给 .ink-divider 画 —— 线的两头收了口,
      不再是齐着屏幕边的框线;卷目栏的高度由下方那一行自己承担。
    -->
    <div class="ink-divider absolute inset-x-0 -bottom-px" aria-hidden="true" />
    <!--
      窄屏不许折行:320 宽时右组的「9 兆」「25.33 亿」与左组的「3000/1000 亿载」
      曾被压成两行,顶栏从 46px 涨到 58px,数字看着像乱码。故右组 shrink-0(整组
      不参与收缩)、每格 whitespace-nowrap(数不许断行),让左组先让位:
      名字 truncate、境界行 overflow-hidden,被裁掉的尾巴只能是卷目/世界这类闲格。
    -->
    <div
      class="folio-head__body relative flex min-w-0 items-center justify-between gap-2 overflow-hidden"
    >
      <div class="flex min-w-0 items-center gap-2 overflow-hidden">
        <button
          type="button"
          data-atlas-trigger
          class="atlas-trigger flex h-8 w-8 shrink-0 flex-col items-center justify-center gap-0.5 border border-ink/20 font-kai text-ink-soft active:scale-90"
          aria-label="打开玄枢图"
          @click="atlasOpen = true"
        >
          <span class="atlas-trigger__char text-[14px] leading-none">玄</span>
          <span class="atlas-trigger__mark text-[10px] leading-none">枢</span>
        </button>
        <div class="folio-head__identity min-w-0 leading-tight">
          <p class="truncate font-kai text-[14px] tracking-[0.14em] text-ink">
            {{ player.name }}
          </p>
          <p class="flex items-center gap-1.5 whitespace-nowrap text-[10px] text-ink-faint">
            <span class="min-w-0 flex-1 truncate">{{ player.realmName }}</span>
            <span class="h-3 w-px shrink-0 bg-ink/15" aria-hidden="true" />
            <!-- 年龄:寿元将尽时转朱砂,顶栏常驻便于随时察觉 -->
            <span
              class="tabular shrink-0"
              :class="player.lifespanRatio < LIFESPAN_WARN_RATIO ? 'text-cinnabar' : ''"
            >
              {{ lifespan.age }}/{{ lifespan.max }}载
            </span>
          </p>
        </div>
        <div
          data-desktop-context
          class="folio-head__desktop-context min-w-0 items-center gap-2 whitespace-nowrap"
        >
          <span class="font-kai text-[11px] tracking-[0.16em] text-cinnabar">{{
            positionMark
          }}</span>
          <span class="h-3 w-px shrink-0 bg-ink/15" aria-hidden="true" />
          <span class="min-w-0 truncate font-kai text-[14px] tracking-[0.12em] text-ink">{{
            entryMark
          }}</span>
          <span class="text-[10px] text-ink-faint">· {{ player.worldName }}</span>
        </div>
      </div>
      <div class="folio-head__ledger flex shrink-0 items-center text-[11px] text-ink-soft tabular">
        <span
          class="folio-head__ledger-entry flex items-center gap-1 whitespace-nowrap"
          title="灵石"
        >
          <GameIcon name="gem" :size="13" class="text-gold-ink" />
          {{ formatGN(resources.spiritStone) }}
        </span>
        <span
          class="folio-head__ledger-entry flex items-center gap-1 whitespace-nowrap"
          title="灵气"
        >
          <GameIcon name="wind" :size="13" class="text-qing" />
          {{ formatNum(Math.floor(resources.qi)) }}
        </span>
        <!-- 只有图标的入口必须自带名字:否则读屏只会念「链接」,自动化也点不着它 -->
        <RouterLink
          to="/settings"
          aria-label="设置"
          class="folio-head__settings -my-2 -mr-2 flex min-h-[40px] min-w-[40px] items-center justify-center p-1.5 text-ink-faint active:scale-90 tinylens:hidden"
        >
          <GameIcon name="settings" :size="15" />
        </RouterLink>
      </div>
    </div>

    <!-- 卷目栏:只报「我在哪一卷」与「此世何界」,不重复页面里的大标题。 -->
    <div
      :data-folio-position="positionKey"
      class="masthead-route mt-1.5 flex items-center gap-1.5 border-t border-ink/10 pt-1 text-[10px] text-ink-faint short:hidden"
    >
      <span class="shrink-0 font-kai tracking-[0.18em] text-cinnabar">{{ positionMark }}</span>
      <span aria-hidden="true">·</span>
      <span class="min-w-0 truncate font-kai tracking-[0.12em] text-ink-soft">{{ entryMark }}</span>
      <span class="ml-auto min-w-0 truncate text-right">
        {{ player.worldName }}
        <template v-if="player.reincarnation.count > 0">
          · {{ player.reincarnation.count }} 世
        </template>
      </span>
    </div>

    <NavigationAtlas :open="atlasOpen" @close="atlasOpen = false" />
  </header>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute } from "vue-router";
import { usePlayerStore } from "@/stores/player";
import { useResourcesStore } from "@/stores/resources";
import { cnNumber, formatGN, formatNum, lifespanPair } from "@/utils/format";
import { LIFESPAN_WARN_RATIO } from "@/data/constants";
import { Capacitor } from "@capacitor/core";
import { useNativeInsets } from "@/composables/useNativeInsets";
import { navigationPositionOf } from "@/ui/navigation";
import GameIcon from "./GameIcon.vue";
import NavigationAtlas from "./NavigationAtlas.vue";

const player = usePlayerStore();
const resources = useResourcesStore();
const route = useRoute();
const atlasOpen = ref(false);
const position = computed(() => navigationPositionOf(route.name));
const positionKey = computed(() =>
  position.value ? `${position.value.sectionIndex + 1}-${position.value.entryIndex + 1}` : "",
);
const positionMark = computed(() =>
  position.value
    ? `卷${cnNumber(position.value.sectionIndex + 1)} · ${position.value.section.label}`
    : "玄枢",
);
const entryMark = computed(() =>
  position.value
    ? `${String(position.value.entryIndex + 1).padStart(2, "0")} ${position.value.entry.label}`
    : "未名之页",
);
/**
 * 状态栏占位:原生实测有值(安卓,见 useNativeInsets)就用实测;没有就退回
 * 老的猜测 —— 原生 20px(沉浸式状态栏的近似)/ 网页 8px,web 渲染逐位不变。
 */
const { top: statusInset } = useNativeInsets();
/** 年龄/寿元:两侧同一套缩写,单位(载)在模板里只写一次 */
const lifespan = computed(() => lifespanPair(player.age, player.lifespanMax));
const statusTopPad = computed(() =>
  statusInset.value > 0 ? `${statusInset.value}px` : Capacitor.isNativePlatform() ? "20px" : "8px",
);
</script>
