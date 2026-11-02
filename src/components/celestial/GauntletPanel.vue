<template>
  <div class="celestial-gauntlet" data-celestial-gauntlet>
    <!-- 场次是战局唯一入口:方向键、Home / End 与点按都在这里换场。 -->
    <div v-if="rows.length > 1" class="celestial-fight-tabs" role="tablist" aria-label="逐场战局">
      <button
        v-for="(fight, i) in rows"
        :id="`celestial-fight-tab-${i}`"
        :key="i"
        type="button"
        role="tab"
        class="celestial-fight-tab"
        :class="{ 'is-selected': current === i, 'is-loss': !fight.win }"
        data-celestial-fight-tab
        :aria-selected="current === i"
        aria-controls="celestial-fight-station"
        :tabindex="current === i ? 0 : -1"
        :aria-label="`第 ${i + 1} 场 · ${fight.win ? '胜' : '负'} · ${fight.foeName}`"
        @click="selectFight(i)"
        @keydown="moveFight($event, i)"
      >
        <span class="celestial-fight-tab__ordinal">第 {{ i + 1 }} 战</span>
        <span class="celestial-fight-tab__verdict">{{ fight.win ? "胜" : "负" }}</span>
        <span class="celestial-fight-tab__foe">{{ fight.foeName }}</span>
      </button>
    </div>

    <div
      v-if="row"
      id="celestial-fight-station"
      class="celestial-gauntlet__station"
      role="tabpanel"
      :aria-labelledby="rows.length > 1 ? `celestial-fight-tab-${current}` : undefined"
      :data-celestial-fight-current="current"
      tabindex="0"
    >
      <!-- 对阵只报当场真值,不再套第二张纸卡。 -->
      <div class="celestial-gauntlet__duel">
        <div class="celestial-gauntlet__names">
          <span class="celestial-gauntlet__player">{{ playerName }}</span>
          <span class="celestial-gauntlet__round tabular"
            >第 {{ current + 1 }} 战 · {{ row.rounds }} 回合</span
          >
          <span class="celestial-gauntlet__foe">{{ row.foeName }}</span>
        </div>
        <div class="celestial-gauntlet__bars">
          <ProgressBar :value="php" class="flex-1" :height="6" color="var(--color-jade)" />
          <ProgressBar :value="ehp" class="flex-1" :height="6" color="var(--color-cinnabar)" />
        </div>
      </div>

      <div class="celestial-gauntlet__report">
        <header class="celestial-gauntlet__log-head">
          <span>战报</span>
          <small class="tabular">{{ displayed.length }} / {{ logs.length }} 行</small>
        </header>
        <div
          ref="logBox"
          class="scroll-pane celestial-gauntlet__log"
          role="log"
          aria-label="战斗回放"
          aria-live="polite"
          aria-relevant="additions text"
          data-celestial-fight-log
        >
          <p
            v-for="(entry, i) in displayed"
            :key="i"
            class="celestial-gauntlet__line text-body"
            :class="KIND_COLOR[entry.t]"
            :data-log-kind="entry.t"
          >
            <span>{{ entry.text }}</span>
            <strong
              v-if="entry.dmg"
              class="celestial-gauntlet__damage tabular"
              :class="entry.t === 'crit' ? 'text-cinnabar' : ''"
              >{{ entry.dmg }}</strong
            >
          </p>
          <p v-if="displayed.length === 0" class="celestial-gauntlet__empty text-body">此战无录</p>
        </div>
      </div>

      <div class="celestial-gauntlet__controls">
        <span class="celestial-gauntlet__count tabular"
          >{{ displayed.length }} / {{ logs.length }}</span
        >
        <button v-if="!finished" class="celestial-gauntlet__playback" @click="skip()">略过</button>
        <button v-else class="celestial-gauntlet__playback" @click="replay()">重播</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, useTemplateRef, watch } from "vue";
import type { CombatLogEntry } from "@/types";
import type { GauntletFightRow } from "@/core/gauntlet";
import { COMBAT_PLAYBACK_BASE_MS, COMBAT_PLAYBACK_MIN_MS } from "@/data/constants";
import { useSettingsStore } from "@/stores/settings";
import { gameClock } from "@/composables/useGameClock";
import ProgressBar from "@/components/common/ProgressBar.vue";

const props = defineProps<{
  rows: GauntletFightRow[];
  playerName: string;
  current: number;
}>();
const emit = defineEmits<{ select: [index: number] }>();

const settings = useSettingsStore();

const displayed = ref<CombatLogEntry[]>([]);
const php = ref(1);
const ehp = ref(1);
const logBox = useTemplateRef<HTMLElement>("logBox");
/** 战报逐条回放的起表收口:gameClock(暂停冻结)—— 心跳停着时回放也停,恢复后续播 */
let timer: (() => void) | undefined;

const row = computed(() => props.rows[props.current] ?? props.rows[0]);
const logs = computed(() => row.value?.logs ?? []);
const finished = computed(() => displayed.value.length >= logs.value.length);

const KIND_COLOR: Record<CombatLogEntry["t"], string> = {
  atk: "text-ink-soft",
  skill: "text-qing",
  crit: "text-cinnabar",
  shield: "text-gold-ink",
  heal: "text-jade",
  dodge: "text-ink-faint",
  proc: "text-violet-ink",
  info: "text-ink-faint",
  win: "text-jade font-kai",
  lose: "text-cinnabar font-kai",
};

function stop(): void {
  if (timer !== undefined) {
    timer();
    timer = undefined;
  }
}

/** 按日志里的血量快照推进血条(战报自带 php/ehp,不必重算战斗) */
function applyEntry(entry: CombatLogEntry): void {
  if (typeof entry.php === "number") php.value = entry.php;
  if (typeof entry.ehp === "number") ehp.value = entry.ehp;
}

async function scrollToEnd(): Promise<void> {
  await nextTick();
  if (logBox.value) logBox.value.scrollTop = logBox.value.scrollHeight;
}

function play(): void {
  stop();
  displayed.value = [];
  php.value = 1;
  ehp.value = 1;
  const all = logs.value;
  if (all.length === 0) return;
  // 关动效时直接给结果,不逐条播
  if (settings.reduceMotion) {
    skip();
    return;
  }
  let i = 0;
  const interval = Math.max(COMBAT_PLAYBACK_MIN_MS, COMBAT_PLAYBACK_BASE_MS / settings.battleSpeed);
  // gameClock(暂停冻结):回放是已结算战局的「演出」,心跳停着(重置/导入确认)
  // 就该跟着停 —— 与 useNow 的倒计时同一条口径,手写 interval 在此收口。
  timer = gameClock(() => {
    const entry = all[i];
    if (!entry) {
      stop();
      return;
    }
    displayed.value = [...displayed.value, entry];
    applyEntry(entry);
    void scrollToEnd();
    i += 1;
    if (i >= all.length) stop();
  }, interval);
}

function skip(): void {
  stop();
  displayed.value = [...logs.value];
  for (const entry of logs.value) applyEntry(entry);
  void scrollToEnd();
}

function replay(): void {
  play();
}

function selectFight(i: number): void {
  if (i === props.current) return;
  emit("select", i);
}

function moveFight(event: KeyboardEvent, index: number): void {
  let next = index;
  if (event.key === "ArrowRight" || event.key === "ArrowDown") {
    next = (index + 1) % props.rows.length;
  } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
    next = (index - 1 + props.rows.length) % props.rows.length;
  } else if (event.key === "Home") {
    next = 0;
  } else if (event.key === "End") {
    next = props.rows.length - 1;
  } else {
    return;
  }
  event.preventDefault();
  emit("select", next);
  const tabs = (event.currentTarget as HTMLElement).closest(".celestial-fight-tabs");
  void nextTick(() => {
    tabs?.querySelectorAll<HTMLButtonElement>("[data-celestial-fight-tab]")[next]?.focus();
  });
}

// 换场或换一份战报都从头播;当前场由战卷持有,这里只负责演出。
watch([() => props.rows, () => props.current], play, { immediate: true });

onUnmounted(stop);
</script>
