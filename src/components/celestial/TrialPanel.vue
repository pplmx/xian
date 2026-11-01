<template>
  <div class="celestial-trial-ledger" data-celestial-trial-ledger>
    <!-- 壹 · 今日天道:程序生成的每日挑战 -->
    <section
      class="celestial-trial-chapter"
      data-celestial-trial-chapter="daily"
      data-celestial-daily
    >
      <CelestialChapterHead
        index="壹"
        title="今日天道"
        hint="日出而题,日落而息"
        :fact="daily ? (endgame.dailyDoneDay === daily.day ? '今日已成' : '今日待战') : '待择道途'"
      />
      <div v-if="daily" class="celestial-trial-daily">
        <div class="celestial-trial-daily__head">
          <div class="celestial-trial-daily__identity">
            <span class="celestial-trial-eyebrow">今日界</span>
            <p class="celestial-trial-daily__world text-title">{{ dailyWorld?.name }}</p>
            <p class="celestial-trial-daily__meta tabular text-note">
              {{ daily.verdict.difficulty }} · 可行 {{ daily.verdict.viable }}/{{
                BUILD_PROFILES.length
              }}
              · 赏 {{ daily.verdict.reward }}
            </p>
          </div>
          <button
            class="celestial-trial-action celestial-trial-action--primary"
            :disabled="endgame.dailyDoneDay === daily.day || challengeDaoShort > 0"
            @click="goDaily"
          >
            <template v-if="challengeDaoShort > 0">尚差 {{ challengeDaoShort }} 道源</template>
            <template v-else-if="endgame.dailyDoneDay === daily.day">今日已成,明日再会</template>
            <template v-else>应 战(道源 {{ CHALLENGE_ENTRY_COST }})</template>
          </button>
        </div>
        <p
          v-if="dailyMutators.length || dailyPact"
          class="celestial-trial-daily__omens"
          data-celestial-daily-omens
        >
          <span v-for="m in dailyMutators" :key="m!.id" class="celestial-trial-omen">
            <span aria-hidden="true">◇</span>
            <span>{{ m!.name }}</span>
            <span class="celestial-trial-omen__text">{{ m!.text }}</span>
          </span>
          <span v-if="dailyPact" class="celestial-trial-omen celestial-trial-omen--pact">
            <span aria-hidden="true">契</span>
            <span>{{ dailyPact.name }}</span>
            <span class="celestial-trial-omen__text">{{ dailyPact.ruleText }}</span>
          </span>
        </p>
      </div>
      <!-- 未择道途时「今日天道」是为空的一格:区段常驻,别让玩家以为它消失了 ——
           择了道途它就在这儿(判据与上方 daily 同源) -->
      <section v-else>
        <p class="celestial-trial-empty" data-celestial-daily-empty>
          今日天道随道途而定 —— 于道途一页择定「此世之路」后,自会在此展开。
        </p>
      </section>
    </section>

    <!-- 贰 · 天道变数 -->
    <section
      class="celestial-trial-chapter"
      data-celestial-trial-chapter="mutation"
      data-celestial-mutation
    >
      <CelestialChapterHead
        index="贰"
        title="天道变数"
        hint="规则随机,每探一次天机便换一副面孔"
        :fact="mutationDraw.length ? `已窥 ${mutationRows.length} 条` : '待窥'"
      />
      <div v-if="mutationDraw.length" class="celestial-trial-mutation">
        <div class="celestial-trial-mutation__rows">
          <p v-for="m in mutationRows" :key="m!.id" class="celestial-trial-omen">
            <span aria-hidden="true">◇</span>
            <span>{{ m!.name }}</span>
            <span class="celestial-trial-omen__text">{{ m!.text }}</span>
          </p>
        </div>
        <div class="celestial-trial-actions">
          <button
            class="celestial-trial-action celestial-trial-action--primary"
            :disabled="mutationDaoShort > 0"
            @click="goMutation"
          >
            <template v-if="mutationDaoShort > 0">尚差 {{ mutationDaoShort }} 道源</template>
            <template v-else
              >应 战(道源 {{ MUTATION_ENTRY_COST }} · 破解得 {{ MUTATION_BASE_REWARD }})</template
            >
          </button>
          <button class="celestial-trial-action" @click="mutationDraw = rollMutators()">
            再探
          </button>
        </div>
      </div>
      <div v-else class="celestial-trial-mutation celestial-trial-mutation--empty">
        <p class="celestial-trial-copy">
          天道无常,规则无定。窥探本次变数,再决定是否应战——{{
            cnNumber(MUTATION_FIGHTS)
          }}连战,规则叠加。
        </p>
        <button class="celestial-trial-action" @click="mutationDraw = rollMutators()">
          窥探变数
        </button>
      </div>
    </section>

    <!-- 叁 · 天道试炼 -->
    <section
      class="celestial-trial-chapter"
      data-celestial-trial-chapter="trials"
      data-celestial-trials
    >
      <CelestialChapterHead
        index="叁"
        title="天道试炼"
        hint="极限构筑的证道之地"
        :fact="`${trialWins} / ${TRIALS.length} 已破`"
      />
      <div class="celestial-trial-roster">
        <article
          v-for="trial in TRIALS"
          :key="trial.id"
          class="celestial-trial-row"
          :data-celestial-trial="trial.id"
        >
          <span class="celestial-trial-row__seal" aria-hidden="true">{{ trial.seal }}</span>
          <div class="celestial-trial-row__copy">
            <header class="celestial-trial-row__head">
              <h3 class="celestial-trial-row__name text-title">{{ trial.name }}</h3>
              <span
                v-if="endgame.trialRecords[trial.id]"
                class="celestial-trial-row__record tabular"
              >
                最佳 {{ endgame.trialRecords[trial.id]!.bestRounds }} 回合
              </span>
              <span v-else class="celestial-trial-row__record">未破</span>
            </header>
            <p class="celestial-trial-row__desc text-body">{{ trial.desc }}</p>
            <p class="celestial-trial-row__rules">
              <span v-for="(r, i) in trial.ruleText" :key="i">{{ r }}</span>
            </p>
          </div>
          <div class="celestial-trial-row__decision">
            <p class="celestial-trial-row__cost tabular">
              道源 {{ trial.entryCost }} ·
              {{
                endgame.trialRecords[trial.id]
                  ? "已捷,再战仅录纪录"
                  : `首破得 ${trial.rewardDaoSource}`
              }}
            </p>
            <button
              class="celestial-trial-action"
              :disabled="!endgame.daoPath || daoEntryShort(trial.entryCost) > 0"
              :aria-label="trialActionLabel(trial)"
              data-celestial-trial-action
              @click="goTrial(trial.id)"
            >
              <template v-if="!endgame.daoPath">先择道途</template>
              <template v-else-if="daoEntryShort(trial.entryCost) > 0"
                >尚差 {{ daoEntryShort(trial.entryCost) }} 道源</template
              >
              <template v-else-if="endgame.trialRecords[trial.id]">再 试</template>
              <template v-else>应 试</template>
            </button>
          </div>
        </article>
      </div>
    </section>

    <!-- 肆 · 天道挑战书:玩家定规则,天道定难度与赏格 -->
    <section
      class="celestial-trial-chapter"
      data-celestial-trial-chapter="challenge"
      data-celestial-challenge
    >
      <CelestialChapterHead
        index="肆"
        title="天道挑战书"
        hint="你定规则,天道定赏"
        :fact="challengeFact"
      />

      <!-- 天界秘境:真仙起,道源代价,与远征/试炼并列的一阶一次性内容 -->
      <div class="celestial-trial-secret">
        <SecretRealmCard gate="celestial" />
      </div>

      <div class="celestial-challenge-form">
        <p class="celestial-trial-copy">
          选界 · 叠变数(至多 {{ cnNumber(CHALLENGE_MAX_MUTATORS) }} 条)· 立契 ·
          命名。赏格由天道实测难度定价,无从作弊。
        </p>

        <section class="celestial-challenge-step">
          <header class="celestial-challenge-step__head">
            <span class="celestial-challenge-step__ordinal" aria-hidden="true">一</span>
            <h3>择界</h3>
            <span>本挑战落在哪一重天</span>
          </header>
          <div class="celestial-challenge-options" role="group" aria-label="选择挑战星界">
            <button
              v-for="w in CELESTIAL_WORLDS"
              :key="w.id"
              class="chip-ink celestial-challenge-option"
              :class="
                draft.worldId === w.id
                  ? 'border-cinnabar text-cinnabar'
                  : 'border-ink/25 text-ink-faint'
              "
              :aria-pressed="draft.worldId === w.id"
              @click="setDraftWorld(w.id)"
            >
              {{ w.name }}
            </button>
          </div>
        </section>

        <section class="celestial-challenge-step">
          <header class="celestial-challenge-step__head">
            <span class="celestial-challenge-step__ordinal" aria-hidden="true">二</span>
            <h3>叠变数</h3>
            <span
              >至多 {{ cnNumber(CHALLENGE_MAX_MUTATORS) }} 条 · 已选
              {{ draft.mutatorIds.length }}</span
            >
          </header>
          <div class="celestial-challenge-options" role="group" aria-label="选择天道变数">
            <button
              v-for="m in MUTATORS"
              :key="m.id"
              class="chip-ink celestial-challenge-option"
              :class="
                draft.mutatorIds.includes(m.id)
                  ? 'border-violet-ink text-violet-ink'
                  : draftFull
                    ? 'border-ink/15 text-ink-faint'
                    : 'border-ink/25 text-ink-faint'
              "
              :title="
                draft.mutatorIds.includes(m.id)
                  ? m.text
                  : draftFull
                    ? `至多 ${cnNumber(CHALLENGE_MAX_MUTATORS)} 条,已选满`
                    : m.text
              "
              :aria-pressed="draft.mutatorIds.includes(m.id)"
              :disabled="!draft.mutatorIds.includes(m.id) && draftFull"
              @click="toggleDraftMutator(m.id)"
            >
              {{ m.name }}
            </button>
          </div>
          <!-- 变数已选的,把效果正文亮出来 —— 手机没有 hover,赌约规则得看得见 -->
          <p
            v-if="selectedMutators.length"
            class="celestial-challenge-selection celestial-challenge-selection--mutation"
          >
            {{ selectedMutators.map((m) => `${m.name}：${m.text}`).join("；") }}
          </p>
        </section>

        <section class="celestial-challenge-step">
          <header class="celestial-challenge-step__head">
            <span class="celestial-challenge-step__ordinal" aria-hidden="true">三</span>
            <h3>立契</h3>
            <span>不立契也可验约</span>
          </header>
          <div class="celestial-challenge-options" role="group" aria-label="选择天道契约">
            <button
              class="chip-ink celestial-challenge-option"
              :class="
                draft.pactId === null ? 'border-jade text-jade' : 'border-ink/25 text-ink-faint'
              "
              :aria-pressed="draft.pactId === null"
              @click="setDraftPact(null)"
            >
              不立契
            </button>
            <button
              v-for="p in PACTS"
              :key="p.id"
              class="chip-ink celestial-challenge-option"
              :class="
                draft.pactId === p.id
                  ? 'border-cinnabar text-cinnabar'
                  : 'border-ink/25 text-ink-faint'
              "
              :title="p.ruleText"
              :aria-pressed="draft.pactId === p.id"
              @click="setDraftPact(p.id)"
            >
              {{ p.name }}
            </button>
          </div>
          <p v-if="challengePact" class="celestial-challenge-selection">
            立约「{{ challengePact.name }}」：{{ challengePact.ruleText }}
          </p>
        </section>

        <section class="celestial-challenge-step celestial-challenge-step--name">
          <header class="celestial-challenge-step__head">
            <span class="celestial-challenge-step__ordinal" aria-hidden="true">四</span>
            <h3>命名</h3>
            <span>八字以内,写进道痕</span>
          </header>
          <input
            v-model="draft.name"
            maxlength="8"
            aria-label="为此挑战书命名(最多八个字)"
            class="celestial-challenge-name text-[16px]"
            placeholder="为此挑战书命名(如《无盾求生》)"
          />
        </section>

        <div
          v-if="challengeVerdict"
          class="celestial-challenge-verdict"
          :class="{ 'is-blocked': !challengeVerdict.ok }"
          data-celestial-challenge-verdict
        >
          <p v-if="challengeVerdict.ok">
            <span
              >天道受此约:{{ challengeVerdict.difficulty }} · 可行流派
              {{ challengeVerdict.viable }}/{{ BUILD_PROFILES.length }}</span
            >
            <strong class="tabular">赏 道源 {{ challengeVerdict.reward }}</strong>
          </p>
          <p v-else>{{ challengeVerdict.reason }}</p>
        </div>

        <div class="celestial-challenge-actions">
          <button class="celestial-trial-action" @click="doVerify">验 约</button>
          <button
            class="celestial-trial-action celestial-trial-action--primary"
            :disabled="!endgame.daoPath || !challengeVerdict?.ok || challengeDaoShort > 0"
            @click="doUndertake"
          >
            <template v-if="!endgame.daoPath">先择道途</template>
            <template v-else-if="challengeDaoShort > 0">尚差 {{ challengeDaoShort }} 道源</template>
            <template v-else>立 约(道源 {{ CHALLENGE_ENTRY_COST }})</template>
          </button>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useEndgameStore } from "@/stores/endgame";
import { CELESTIAL_WORLDS, TRIALS } from "@/data/endgame";
import { PACTS, pactDef } from "@/data/pacts";
import { MUTATORS, mutatorDef } from "@/data/mutators";
import { undertakeDaily, type DailyChallenge } from "@/core/dailyChallenge";
import {
  challengeMutation,
  MUTATION_BASE_REWARD,
  MUTATION_ENTRY_COST,
  MUTATION_FIGHTS,
  rollMutators,
} from "@/core/expedition";
import { challengeTrial } from "@/core/endgameService";
import {
  CHALLENGE_ENTRY_COST,
  CHALLENGE_MAX_MUTATORS,
  undertakeChallenge,
  verifyChallenge,
  type ChallengeDraft,
  type ChallengeVerdict,
} from "@/core/challenge";
import { BUILD_PROFILES } from "@/core/buildSim";
import { cnNumber } from "@/utils/format";
import { useDaoEntry } from "@/composables/useDaoEntry";
import CelestialChapterHead from "@/components/celestial/CelestialChapterHead.vue";
import SecretRealmCard from "@/components/adventure/SecretRealmCard.vue";
import type { ReportView } from "@/components/celestial/reportView";

/**
 * 试炼面板:今日天道/天道变数/天道试炼/天道挑战书,整域自洽(自读 pinia)。
 * daily 由主文件传入(它同时供页签朱点 celTabRows 用,单源不重算);
 * 开战结果经 emit("report") 交主文件统一开战报。
 */
const props = defineProps<{ daily: DailyChallenge | null }>();
const emit = defineEmits<{ report: [ReportView] }>();
const endgame = useEndgameStore();
const { daoEntryShort } = useDaoEntry();
/** 今日天道/挑战书入口同价:门票都取自 CHALLENGE_ENTRY_COST */
const challengeDaoShort = computed(() => daoEntryShort(CHALLENGE_ENTRY_COST));
/** 天道变数入口的道源短差 */
const mutationDaoShort = computed(() => daoEntryShort(MUTATION_ENTRY_COST));
/** 试炼章头只报已破场次;逐场记录仍以 trialRecords 为唯一真值 */
const trialWins = computed(
  () => TRIALS.filter((trial) => endgame.trialRecords[trial.id] !== undefined).length,
);

// ---- 天道变数 ----
const mutationDraw = ref<string[]>([]);
const mutationRows = computed(() =>
  mutationDraw.value.map((id) => mutatorDef(id)).filter((m) => m !== undefined),
);

function goMutation(): void {
  const result = challengeMutation(mutationDraw.value);
  if (!result) return;
  mutationDraw.value = [];
  emit("report", {
    title: "天道变数",
    cleared: result.report.cleared,
    markText: result.report.cleared
      ? `${cnNumber(MUTATION_FIGHTS)}战全捷,共 ${result.report.totalRounds} 回合`
      : `止步第 ${result.report.fightsWon + 1} 战`,
    rows: result.report.rows,
    reward: result.rewardDaoSource,
  });
}

// ---- 试炼 ----
function goTrial(id: string): void {
  const result = challengeTrial(id);
  if (result) {
    emit("report", {
      title: result.title,
      cleared: result.report.cleared,
      markText: result.markText,
      rows: result.report.rows,
      reward: result.rewardDaoSource,
    });
  }
}

function trialActionLabel(trial: (typeof TRIALS)[number]): string {
  if (!endgame.daoPath) return `${trial.name}:先择道途`;
  const short = daoEntryShort(trial.entryCost);
  if (short > 0) return `${trial.name}:尚差 ${short} 道源`;
  return endgame.trialRecords[trial.id]
    ? `${trial.name}:再试 · 道源 ${trial.entryCost}`
    : `${trial.name}:应试 · 道源 ${trial.entryCost}`;
}

// ---- 天道挑战书 ----
const draft = ref<ChallengeDraft>({
  worldId: CELESTIAL_WORLDS[0]!.id,
  mutatorIds: [],
  pactId: null,
  name: "",
});
const challengeVerdict = ref<ChallengeVerdict | null>(null);
const challengeFact = computed(() => {
  if (!endgame.daoPath) return "待择道途";
  if (!challengeVerdict.value) return "待验约";
  return challengeVerdict.value.ok ? `赏 ${challengeVerdict.value.reward} 道源` : "此约不可立";
});
/** 已选变数(把效果正文亮到行内,移动端不靠 hover) */
const selectedMutators = computed(() =>
  MUTATORS.filter((m) => draft.value.mutatorIds.includes(m.id)),
);
const challengePact = computed(() =>
  draft.value.pactId ? (pactDef(draft.value.pactId) ?? null) : null,
);
/** 变数已选满(至多三条):未选中的芯片应置灰,不许静默点不动 */
const draftFull = computed(() => draft.value.mutatorIds.length >= CHALLENGE_MAX_MUTATORS);

function setDraftWorld(id: string): void {
  draft.value = { ...draft.value, worldId: id };
  challengeVerdict.value = null;
}

function setDraftPact(id: string | null): void {
  draft.value = { ...draft.value, pactId: id };
  challengeVerdict.value = null;
}

function toggleDraftMutator(id: string): void {
  const has = draft.value.mutatorIds.includes(id);
  if (!has && draft.value.mutatorIds.length >= CHALLENGE_MAX_MUTATORS) return;
  draft.value = {
    ...draft.value,
    mutatorIds: has
      ? draft.value.mutatorIds.filter((m) => m !== id)
      : [...draft.value.mutatorIds, id],
  };
  challengeVerdict.value = null;
}

function doVerify(): void {
  challengeVerdict.value = verifyChallenge(draft.value);
}

function doUndertake(): void {
  if (!challengeVerdict.value?.ok) return;
  const result = undertakeChallenge(draft.value, challengeVerdict.value);
  challengeVerdict.value = null;
  if (result) {
    emit("report", {
      title: result.title,
      cleared: result.report.cleared,
      markText: result.markText,
      rows: result.report.rows,
      reward: result.rewardDaoSource,
    });
  }
}

const dailyWorld = computed(() =>
  props.daily ? celestialWorldDefLocal(props.daily.draft.worldId) : null,
);
const dailyMutators = computed(() =>
  props.daily
    ? props.daily.draft.mutatorIds.map((id) => mutatorDef(id)).filter((m) => m !== undefined)
    : [],
);
const dailyPact = computed(() =>
  props.daily?.draft.pactId ? pactDef(props.daily.draft.pactId) : undefined,
);
function celestialWorldDefLocal(id: string) {
  return CELESTIAL_WORLDS.find((w) => w.id === id);
}

function goDaily(): void {
  if (!props.daily) return;
  const result = undertakeDaily(props.daily);
  if (result) {
    emit("report", {
      title: result.title,
      cleared: result.report.cleared,
      markText: result.markText,
      rows: result.report.rows,
      reward: result.rewardDaoSource,
    });
  }
}
</script>
