<template>
  <!-- 道痕 -->
  <section>
    <SectionTitle title="道痕" :hint="`历代修行履历 · ${endgame.marks.length} 则`" />
    <!-- 卷满六十则:最古之痕将被覆去 —— 该给一句,不然玩家不知道自己最早的履历会无声消失 -->
    <p v-if="endgame.marksFull" class="mt-1.5 px-1 text-[10px] text-amber-ink">
      卷已写满 {{ MAX_MARKS }} 则 —— 后续每一战,都会覆去最古的一道痕
    </p>
    <div class="mt-2 flex items-center justify-between px-1">
      <p class="text-[10px] tabular text-ink-faint">
        规则纪元 {{ RULESET_VERSION }} · 天道共改过 {{ RULESET_CHANGELOG.length }} 次
      </p>
      <button class="font-kai text-[10px] text-qing active:scale-95" @click="openEra(null)">
        纪元变迁史 →
      </button>
    </div>
    <!-- 今昔之比:与过去的自己对话 -->
    <div v-if="legacy.length" class="card-ink mt-2 px-4 py-3">
      <p class="mb-1.5 font-kai text-[11px] tracking-[0.3em] text-ink-faint">今昔之比</p>
      <div v-for="lc in legacy" :key="lc.targetName" class="mb-2 last:mb-0">
        <p class="text-[11px] text-ink-soft tabular">
          {{ lc.targetName }}:第{{ lc.earlyLife }}世({{ lc.earlyBuild }}){{ lc.earlyText }}
          <span class="mx-1 text-ink-faint">→</span>
          第{{ lc.lateLife }}世({{ lc.lateBuild }})
          <span class="text-jade">{{ lc.lateText }}</span>
        </p>
        <p v-if="lc.diffLines.length" class="text-[10px] text-qing tabular">
          {{ lc.diffLines.join(" · ") }}
        </p>
      </div>
    </div>
    <div
      v-if="endgame.marks.length"
      class="scroll-pane card-ink mt-2 max-h-64 divide-y divide-ink/6 overflow-y-auto px-4"
    >
      <div
        v-for="(mark, i) in endgame.marks"
        :key="i"
        class="flex items-center gap-2 py-2"
        :class="rewriteConfirm === i ? 'flex-wrap' : ''"
      >
        <span class="shrink-0 font-kai text-[11px] text-ink-faint">第{{ mark.life }}世</span>
        <span class="shrink-0 text-[11px] text-violet-ink">{{
          mark.daoPathId ? daoPathDef(mark.daoPathId)?.name : "无道"
        }}</span>
        <span
          class="min-w-0 truncate font-kai text-[11px]"
          :class="mark.cleared ? 'text-ink' : 'text-ink-faint'"
        >
          {{ mark.targetName }}{{ mark.cleared ? "·破" : "·殁" }}
        </span>
        <span class="ml-auto shrink-0 tabular text-[10px] text-ink-faint"
          >{{ mark.rounds }}回合 · {{ mark.buildName }}</span
        >
        <button
          v-if="isStaleRuleset(mark.ruleset)"
          class="shrink-0 rounded border border-cinnabar/50 bg-cinnabar/6 px-1 py-0.5 font-kai text-[10px] text-cinnabar active:scale-90"
          :title="`录于旧纪 ${mark.ruleset},天道已变`"
          @click="openEra(mark)"
        >
          变
        </button>
        <button
          v-if="mark.replay"
          class="shrink-0 rounded border border-gold-ink/40 px-1.5 py-0.5 font-kai text-[10px] text-gold-ink active:scale-90"
          title="以当年的构筑重打此战"
          @click="goReplay(mark)"
        >
          忆
        </button>
        <!-- 重写要花道源,代价内联在按钮上(不再是 hover 专属),触控面放大,并加一步确认 -->
        <template v-if="mark.cleared && mark.replay && rewriteConfirm === i">
          <button
            class="shrink-0 rounded border border-cinnabar/50 bg-cinnabar/6 px-2 py-1 font-kai text-[10px] text-cinnabar active:scale-90"
            @click="rewriteConfirm = null"
          >
            再想想
          </button>
          <button
            class="shrink-0 rounded bg-cinnabar px-2 py-1 font-kai text-[10px] text-paper active:scale-90"
            @click="doRewrite(mark)"
          >
            确认重写
          </button>
          <!--
              判胜规则原本只挂在「写」的 :title 上 —— 而这一步**花的是道源**,
              触屏玩家读不到 hover 就等于「先付钱,判据事后才知道」。
              放进确认态:点「确认重写」之前必先看见这句。整行在确认态才 flex-wrap,
              平时那行还是原来的一行(不为了这一段去改所有行的排版)。
            -->
          <p class="w-full text-[10px] leading-relaxed text-ink-faint">
            判胜 —— 以今日之你重打此战,
            <span class="text-ink-soft">快过 {{ mark.rounds }} 回合</span>
            即【胜于旧我】;此次花 {{ REWRITE_ENTRY_COST }} 道源,不破不退。
          </p>
        </template>
        <button
          v-else-if="mark.cleared && mark.replay"
          class="shrink-0 rounded border border-cinnabar/40 px-2 py-1 font-kai text-[10px] text-cinnabar active:scale-90"
          :title="`以今日之你重打此战,快过 ${mark.rounds} 回合即【胜于旧我】`"
          :class="{ 'border-ink/15 !text-ink-faint': rewriteShort > 0 }"
          :disabled="rewriteShort > 0"
          @click="rewriteConfirm = i"
        >
          <template v-if="rewriteShort > 0">尚差 {{ rewriteShort }} 道源</template>
          <template v-else>写(道源{{ REWRITE_ENTRY_COST }})</template>
        </button>
      </div>
    </div>
    <p v-else class="empty-note card-ink mt-2 px-4 py-4 text-center text-[11px] text-ink-faint">
      此页尚白。你在天界的每一战,都会留下痕迹。
    </p>
  </section>

  <!-- 天道已变:旧纪道痕为何不能按老眼光看 -->
  <BaseModal :open="eraOpen" title="天道已变" @close="eraOpen = false">
    <p v-if="eraMark" class="t-body text-ink-soft">
      此战录于规则纪元 <span class="tabular text-cinnabar">{{ eraMark.ruleset }}</span
      >,今为 <span class="tabular">{{ RULESET_VERSION }}</span
      >。同界同契,当年的你依当年的规矩取胜 —— 如今再忆,规矩已换。
    </p>
    <p v-else class="t-body text-ink-soft">
      纪元变迁史只记改变战斗规则本身的变更,内容增删不入此列。
    </p>
    <div class="mt-2.5 space-y-2">
      <div v-for="c in eraChanges" :key="c.version" class="card-ink px-3 py-2">
        <p class="font-kai text-[11px] tabular text-cinnabar">纪元 {{ c.version }}</p>
        <p class="mt-0.5 t-body text-ink-soft">{{ c.note }}</p>
      </div>
      <p
        v-if="!eraChanges.length"
        class="card-ink px-3 py-3 text-center text-[11px] text-ink-faint"
      >
        {{ eraMark ? "此后天道未再改过规矩 —— 当年的打法,今日依旧算数。" : "尚无变更记录。" }}
      </p>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useEndgameStore } from "@/stores/endgame";
import { MAX_MARKS } from "@/stores/endgame";
import { daoPathDef } from "@/data/endgame";
import { legacyComparisons } from "@/core/compare";
import { replayMark, rewriteMark, REWRITE_ENTRY_COST } from "@/core/endgameService";
import {
  RULESET_CHANGELOG,
  RULESET_VERSION,
  isStaleRuleset,
  rulesetChangesSince,
} from "@/data/ruleset";
import { useDaoEntry } from "@/composables/useDaoEntry";
import SectionTitle from "@/components/common/SectionTitle.vue";
import BaseModal from "@/components/common/BaseModal.vue";
import type { ReportView } from "@/components/celestial/reportView";

// 道痕面板:主文件只在 unlocked 时渲染本组件,历世对照不再重复判 unlocked
const emit = defineEmits<{ report: [ReportView] }>();
const endgame = useEndgameStore();
const { daoEntryShort } = useDaoEntry();
/** 忆战重写差多少(付不起置灰):REWRITE_ENTRY_COST 同源 */
const rewriteShort = computed(() => daoEntryShort(REWRITE_ENTRY_COST));

// ---- 忆战:与过去的自己重临此界 ----
function goReplay(mark: (typeof endgame.marks)[number]): void {
  const result = replayMark(mark);
  if (result) {
    emit("report", {
      title: result.title,
      cleared: result.report.cleared,
      markText: result.markText,
      rows: result.report.rows,
      reward: 0,
    });
  }
}

// ---- 重写此痕:以今日之你,快过当年 ----
/** 重写确认态(按道痕索引):写入要花道源,需要看明白再点。
 *  重写花道源重打一场,成果不可退 —— 属「不可逆失去资源」的两步武装确认族:
 *  确认词「确认+动词」、取消词一律「再想想」(确认模式分级见 EquipDecomposePanel 文件头)。 */
const rewriteConfirm = ref<number | null>(null);
function goRewrite(mark: (typeof endgame.marks)[number]): void {
  const result = rewriteMark(mark);
  if (result) {
    emit("report", {
      title: result.title,
      cleared: result.report.cleared,
      markText: result.markText,
      rows: result.report.rows,
      reward: 0,
    });
  }
}
function doRewrite(mark: (typeof endgame.marks)[number]): void {
  rewriteConfirm.value = null;
  goRewrite(mark);
}

const legacy = computed(() => legacyComparisons(endgame.marks));

// 规则纪元:旧纪道痕为何与今日不可同日而语(纪元变迁史同出一源,视图不手抄)
const eraOpen = ref(false);
const eraMark = ref<(typeof endgame.marks)[number] | null>(null);
const eraChanges = computed(() =>
  eraMark.value ? rulesetChangesSince(eraMark.value.ruleset) : RULESET_CHANGELOG,
);
function openEra(mark: (typeof endgame.marks)[number] | null): void {
  eraMark.value = mark;
  eraOpen.value = true;
}
</script>
