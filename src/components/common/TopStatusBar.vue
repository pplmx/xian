<template>
  <header
    data-folio-head
    :data-folio-position="positionKey"
    class="app-masthead folio-head folio-head--ribbon relative z-20 shrink-0 border-b border-transparent"
    :style="`padding-top: max(env(safe-area-inset-top), ${statusTopPad})`"
  >
    <!--
      书口带的底缘仍由同一道渐隐线收口。border-b 保留透明宽度，
      避免实线再叠一条线；深色带上的线改用奶油墨，夜间与日间都看得见。
    -->
    <div class="ink-divider absolute inset-x-0 -bottom-px" aria-hidden="true" />

    <div class="folio-head__body relative flex min-w-0 items-center gap-2 overflow-hidden">
      <div class="folio-head__identity-wrap flex min-w-0 items-center gap-2 overflow-hidden">
        <button
          type="button"
          data-atlas-trigger
          class="atlas-trigger flex h-9 w-9 shrink-0 items-center justify-center font-kai active:scale-90"
          aria-label="打开玄枢图寻册"
          aria-haspopup="dialog"
          @click="emit('openAtlas')"
        >
          <span class="atlas-trigger__char" aria-hidden="true">玄</span>
          <span class="atlas-trigger__volume tabular" aria-hidden="true">{{ volumeMark }}</span>
        </button>
        <div class="folio-head__identity min-w-0">
          <p class="folio-head__name truncate font-kai">{{ player.name }}</p>
          <p class="folio-head__meta">
            <span class="folio-head__realm tinylens:hidden">{{ player.realmName }}</span>
            <span
              class="folio-head__lifespan tabular compact:hidden"
              :data-lifespan-warning="player.lifespanRatio < LIFESPAN_WARN_RATIO ? '' : undefined"
            >
              {{ lifespan.age }}/{{ lifespan.max }}载
            </span>
          </p>
        </div>
      </div>

      <div data-desktop-context class="folio-head__position min-w-0">
        <span class="folio-head__position-volume">{{ positionMark }}</span>
        <span class="folio-head__position-rule" aria-hidden="true" />
        <span class="folio-head__position-entry truncate">{{ entryMark }}</span>
        <span class="folio-head__position-world">· {{ player.worldName }}</span>
      </div>

      <div class="folio-head__ledger flex shrink-0 items-center tabular">
        <span
          class="folio-head__ledger-entry flex items-center whitespace-nowrap compact:px-1"
          title="灵石"
          :aria-label="`灵石 ${formatGN(resources.spiritStone)}`"
        >
          <GameIcon
            name="gem"
            :size="13"
            class="folio-head__resource-icon folio-head__resource-icon--stone"
          />
          <span>{{ formatGN(resources.spiritStone) }}</span>
        </span>
        <span
          class="folio-head__ledger-entry flex items-center whitespace-nowrap compact:px-1"
          title="灵气"
          :aria-label="`灵气 ${formatNum(Math.floor(resources.qi))}`"
        >
          <GameIcon
            name="wind"
            :size="13"
            class="folio-head__resource-icon folio-head__resource-icon--qi"
          />
          <span>{{ formatNum(Math.floor(resources.qi)) }}</span>
        </span>
        <!-- 只有图标的入口必须自带名字:否则读屏只会念「链接」,自动化也点不着它 -->
        <RouterLink
          to="/settings"
          aria-label="设置"
          class="folio-head__settings flex min-h-[40px] min-w-[40px] items-center justify-center active:scale-90 tinylens:hidden"
        >
          <GameIcon name="settings" :size="15" />
        </RouterLink>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { usePlayerStore } from "@/stores/player";
import { useResourcesStore } from "@/stores/resources";
import { cnNumber, formatGN, formatNum, lifespanPair } from "@/utils/format";
import { LIFESPAN_WARN_RATIO } from "@/data/constants";
import { Capacitor } from "@capacitor/core";
import { useNativeInsets } from "@/composables/useNativeInsets";
import { navigationPositionOf } from "@/ui/navigation";
import GameIcon from "./GameIcon.vue";

const emit = defineEmits<{ openAtlas: [] }>();
const player = usePlayerStore();
const resources = useResourcesStore();
const route = useRoute();
const position = computed(() => navigationPositionOf(route.name));
const positionKey = computed(() =>
  position.value ? `${position.value.sectionIndex + 1}-${position.value.entryIndex + 1}` : "",
);
const positionMark = computed(() =>
  position.value
    ? `卷${cnNumber(position.value.sectionIndex + 1)} · ${position.value.section.label}`
    : "玄枢",
);
const volumeMark = computed(() =>
  position.value ? cnNumber(position.value.sectionIndex + 1) : "玄",
);
const entryMark = computed(() =>
  position.value
    ? `${String(position.value.entryIndex + 1).padStart(2, "0")} · ${position.value.entry.label}`
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
