<template>
  <header
    data-folio-head
    :data-folio-position="positionKey"
    class="app-masthead folio-head folio-head--aether relative z-20 shrink-0"
    :style="`padding-top: max(env(safe-area-inset-top), ${statusTopPad})`"
  >
    <!--
      天幕带只留一道极淡的星轨收口。它不再是一整条深墨书口，
      正文从纸面直接向上延伸，资源与身份像浮在页眉上的一行批注。
    -->
    <div class="folio-head__aether-thread absolute inset-x-0 -bottom-px" aria-hidden="true" />

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

      <div class="folio-head__position min-w-0">
        <span class="folio-head__position-volume">{{ positionMark }}</span>
        <span class="folio-head__position-rule" aria-hidden="true" />
        <span class="folio-head__position-entry truncate">{{ entryMark }}</span>
        <span class="folio-head__position-world">· {{ player.worldName }}</span>
      </div>

      <div class="folio-head__ledger flex shrink-0 items-center tabular">
        <TapNumber
          :value="resources.spiritStone"
          title="灵石"
          :rows="stoneDetailRows"
          data-resource-detail="stone"
          aria-haspopup="dialog"
          :aria-label="`灵石 ${formatGN(resources.spiritStone)}，查看精确值`"
          class="folio-head__ledger-entry folio-head__resource-number !mx-0 !my-0 !min-h-[40px] !min-w-[30px] !px-0.5 !no-underline compact:px-1"
        >
          <GameIcon
            name="gem"
            :size="13"
            class="folio-head__resource-icon folio-head__resource-icon--stone"
          />
          <span class="folio-head__resource-value">{{ formatGN(resources.spiritStone) }}</span>
        </TapNumber>
        <TapNumber
          :value="Math.floor(resources.qi)"
          title="灵气"
          :rows="qiDetailRows"
          :note="qiDetailNote"
          data-resource-detail="qi"
          aria-haspopup="dialog"
          :aria-label="`灵气 ${formatNum(Math.floor(resources.qi))}，查看精确值`"
          class="folio-head__ledger-entry folio-head__resource-number !mx-0 !my-0 !min-h-[40px] !min-w-[30px] !px-0.5 !no-underline compact:px-1"
        >
          <GameIcon
            name="wind"
            :size="13"
            class="folio-head__resource-icon folio-head__resource-icon--qi"
          />
          <span class="folio-head__resource-value">{{ formatNum(Math.floor(resources.qi)) }}</span>
        </TapNumber>
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
import { folioBookMark } from "@/ui/folioPosition";
import GameIcon from "./GameIcon.vue";
import TapNumber from "./TapNumber.vue";
import { useProgressEta } from "@/composables/useProgressEta";
import { formatDuration, formatRate } from "@/utils/format";
import { QI_BANK_MULT } from "@/data/constants";

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
/**
 * 顶栏那枚落点 —— 「第三册 · 行囊」。
 *
 * 此前是「03 · 行囊」:两位数字像页码,不像册次;而同一栏右侧的卷次
 * (`volumeMark`)已经是汉字。一句话里两种写法,而且一个像页码一个像册名。
 */
const entryMark = computed(() =>
  position.value
    ? `${folioBookMark(position.value.entryIndex)} · ${position.value.entry.label}`
    : "未名之页",
);
/**
 * 状态栏占位:原生实测有值(安卓,见 useNativeInsets)就用实测;没有就退回
 * 老的猜测 —— 原生 20px(沉浸式状态栏的近似)/ 网页 8px,web 渲染逐位不变。
 */
const { top: statusInset } = useNativeInsets();

/**
 * 灵气浮层的上下文 —— 与修炼页那份 `useProgressEta` 同构(同一套读数、同一套文案)。
 *
 * 此前顶栏这两枚数字点开只有一个「精确值 + 科学计数法」:玩家看得见 18.74亿,
 * 却看不到容量、回复速度、几时回满 —— 而这三样恰是「这个数该不该花」的全部依据。
 * 修炼页早就答得出,顶栏却答不出,同一个数在两处深浅不一。
 */
/**
 * 灵石浮层的上下文 —— 只有精确值等于没答。
 *
 * 它和灵气的区别在于:灵气有容量与回复速度可言,灵石没有上限、也不回复,
 * 玩家真正想知道的是「它花在哪」。这句用途不是解说的发挥:花钱的出口
 * 是 core 里调 spendStone 的那十处,列出的四类各自对应其中若干处。
 */
const stoneDetailRows = computed(() => [
  {
    label: "用途",
    text: "建造与升级、强化封存、炼丹、坊市购货",
    hint: "洞府营造、器坊、丹房、货架与悬赏",
  },
]);

const { rows: qiDetailRows, note: qiDetailNote } = useProgressEta({
  cap: () => player.qiCapValue,
  rate: () => player.qiRegenPerSec,
  isFull: () => resources.qi >= player.qiCapValue,
  gap: () => player.qiCapValue - resources.qi,
  remain: () => Math.max(0, Math.floor(player.qiCapValue - resources.qi)),
  capRow: { label: "标称容量", hint: "进度条与上限判定走的这条线" },
  banked: {
    value: () => Math.max(0, Math.floor(resources.qi) - Math.floor(player.qiCapValue)),
    label: "积余",
    hint: () =>
      `容量之外还在攒的部分;可积到 ${formatNum(player.qiBankCapValue)}(容量的 ${QI_BANK_MULT} 倍)`,
  },
  remainRow: { label: "还差", hint: () => `每秒 ${formatRate(player.qiRegenPerSec)}` },
  etaRow: { label: "预计回满", hint: "按当前回复速度" },
  fullText: "已满",
  rateEmptyText: "当前无回复",
  formatEta: (sec) => `约 ${formatDuration(sec)}`,
});
/** 年龄/寿元:两侧同一套缩写,单位(载)在模板里只写一次 */
const lifespan = computed(() => lifespanPair(player.age, player.lifespanMax));
const statusTopPad = computed(() =>
  statusInset.value > 0 ? `${statusInset.value}px` : Capacitor.isNativePlatform() ? "20px" : "8px",
);
</script>
