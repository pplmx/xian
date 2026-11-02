<template>
  <div class="celestial-trial-ledger" data-celestial-trial-ledger>
    <!-- 壹 · 今日天道:程序生成的每日挑战 -->
    <section
      class="celestial-trial-chapter"
      data-celestial-trial-chapter="daily"
      data-celestial-daily
    >
      <FolioChapterHead
        data-celestial-chapter-head
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
      <FolioChapterHead
        data-celestial-chapter-head
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
      <FolioChapterHead
        data-celestial-chapter-head
        index="叁"
        title="天道试炼"
        hint="极限构筑的证道之地"
        :fact="`${trialWins} / ${TRIALS.length} 已破`"
      />
      <div class="celestial-trial-atlas" data-celestial-trial-atlas>
        <div class="celestial-trial-roster" role="group" aria-label="八场天道试炼">
          <button
            v-for="(trial, index) in TRIALS"
            :key="trial.id"
            type="button"
            class="celestial-trial-seal"
            :class="{
              'is-selected': selectedTrialId === trial.id,
              'is-cleared': Boolean(endgame.trialRecords[trial.id]),
            }"
            :data-celestial-trial="trial.id"
            data-celestial-trial-seal
            :aria-pressed="selectedTrialId === trial.id"
            :aria-controls="`celestial-trial-detail`"
            :aria-label="trialSealLabel(trial)"
            :tabindex="selectedTrialId === trial.id ? 0 : -1"
            @click="selectTrial(trial.id)"
            @keydown="moveTrial($event, index)"
          >
            <span class="celestial-trial-seal__glyph" aria-hidden="true">{{ trial.seal }}</span>
            <span class="celestial-trial-seal__name">{{ trial.name }}</span>
            <span class="celestial-trial-seal__record tabular">
              {{
                endgame.trialRecords[trial.id]
                  ? `最佳 ${endgame.trialRecords[trial.id]!.bestRounds} 回`
                  : "未破"
              }}
            </span>
          </button>
        </div>

        <Transition name="trial-dossier" mode="out-in">
          <article
            :key="selectedTrial.id"
            id="celestial-trial-detail"
            class="celestial-trial-dossier"
            :data-celestial-trial-detail="selectedTrial.id"
          >
            <header class="celestial-trial-dossier__head">
              <span class="celestial-trial-dossier__seal" aria-hidden="true">{{
                selectedTrial.seal
              }}</span>
              <div class="celestial-trial-dossier__identity">
                <p class="celestial-trial-eyebrow">
                  第 {{ selectedTrialIndex + 1 }} 门 ·
                  {{ endgame.trialRecords[selectedTrial.id] ? "已破" : "未破" }}
                </p>
                <h3 class="celestial-trial-dossier__name text-title">
                  {{ selectedTrial.name }}
                </h3>
              </div>
              <span class="celestial-trial-dossier__record tabular">
                {{
                  endgame.trialRecords[selectedTrial.id]
                    ? `最佳 ${endgame.trialRecords[selectedTrial.id]!.bestRounds} 回合`
                    : "尚无战绩"
                }}
              </span>
            </header>

            <div class="celestial-trial-dossier__body">
              <div class="celestial-trial-dossier__copy">
                <p class="celestial-trial-dossier__desc text-body">{{ selectedTrial.desc }}</p>
                <p class="celestial-trial-dossier__rules text-note">
                  <span v-for="(rule, i) in selectedTrial.ruleText" :key="i">{{ rule }}</span>
                </p>
              </div>
              <div class="celestial-trial-dossier__decision">
                <p class="celestial-trial-dossier__cost text-note tabular">
                  道源 {{ selectedTrial.entryCost }} ·
                  {{
                    endgame.trialRecords[selectedTrial.id]
                      ? "已捷,再战仅录纪录"
                      : `首破得 ${selectedTrial.rewardDaoSource}`
                  }}
                </p>
                <button
                  class="celestial-trial-action"
                  :disabled="!endgame.daoPath || daoEntryShort(selectedTrial.entryCost) > 0"
                  :aria-label="trialActionLabel(selectedTrial)"
                  data-celestial-trial-action
                  @click="goTrial(selectedTrial.id)"
                >
                  <template v-if="!endgame.daoPath">先择道途</template>
                  <template v-else-if="daoEntryShort(selectedTrial.entryCost) > 0"
                    >尚差 {{ daoEntryShort(selectedTrial.entryCost) }} 道源</template
                  >
                  <template v-else-if="endgame.trialRecords[selectedTrial.id]">再 试</template>
                  <template v-else>应 试</template>
                </button>
              </div>
            </div>
          </article>
        </Transition>
      </div>
    </section>

    <!-- 肆 · 天道挑战书:玩家定规则,天道定难度与赏格 -->
    <section
      class="celestial-trial-chapter"
      data-celestial-trial-chapter="challenge"
      data-celestial-challenge
    >
      <FolioChapterHead
        data-celestial-chapter-head
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
          四程立契:先择界,再叠至多 {{ cnNumber(CHALLENGE_MAX_MUTATORS) }} 条变数,随后立契、
          命名。约文与天道验价始终留在台下,赏格由实测难度定价,无从作弊。
        </p>

        <div class="celestial-challenge-workbench" data-celestial-challenge-workbench>
          <div
            ref="challengeWorkbench"
            class="celestial-challenge-steps"
            role="tablist"
            aria-label="天道挑战书四程"
          >
            <button
              v-for="(step, index) in CHALLENGE_STEPS"
              :id="`celestial-challenge-tab-${step.id}`"
              :key="step.id"
              type="button"
              role="tab"
              class="celestial-challenge-step-tab"
              :class="{ 'is-selected': challengeStep === step.id }"
              :data-celestial-challenge-step="step.id"
              :aria-selected="challengeStep === step.id"
              :aria-controls="`celestial-challenge-panel-${step.id}`"
              :aria-label="challengeStepLabel(step)"
              :tabindex="challengeStep === step.id ? 0 : -1"
              @click="selectChallengeStep(step.id)"
              @keydown="moveChallengeStep($event, index)"
            >
              <span class="celestial-challenge-step-tab__ordinal" aria-hidden="true">{{
                step.ordinal
              }}</span>
              <span class="celestial-challenge-step-tab__title">{{ step.title }}</span>
              <span class="celestial-challenge-step-tab__value tabular">{{
                challengeStepValue(step.id)
              }}</span>
            </button>
          </div>

          <section
            :id="`celestial-challenge-panel-${challengeStep}`"
            class="celestial-challenge-step"
            role="tabpanel"
            :aria-labelledby="`celestial-challenge-tab-${challengeStep}`"
            :data-celestial-challenge-panel="challengeStep"
            tabindex="0"
          >
            <header class="celestial-challenge-step__head">
              <span class="celestial-challenge-step__ordinal" aria-hidden="true">{{
                currentChallengeStep.ordinal
              }}</span>
              <h3>{{ currentChallengeStep.title }}</h3>
              <span>{{ currentChallengeStep.hint }}</span>
            </header>

            <div v-if="challengeStep === 'world'" class="celestial-challenge-step__body">
              <div class="celestial-challenge-options" role="group" aria-label="选择挑战星界">
                <button
                  v-for="w in CELESTIAL_WORLDS"
                  :key="w.id"
                  type="button"
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
            </div>

            <div v-else-if="challengeStep === 'mutators'" class="celestial-challenge-step__body">
              <p class="celestial-challenge-step__note">
                至多 {{ cnNumber(CHALLENGE_MAX_MUTATORS) }} 条 · 已选
                {{ draft.mutatorIds.length }}
              </p>
              <div class="celestial-challenge-options" role="group" aria-label="选择天道变数">
                <button
                  v-for="m in MUTATORS"
                  :key="m.id"
                  type="button"
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
            </div>

            <div v-else-if="challengeStep === 'pact'" class="celestial-challenge-step__body">
              <div class="celestial-challenge-options" role="group" aria-label="选择天道契约">
                <button
                  type="button"
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
                  type="button"
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
            </div>

            <div v-else class="celestial-challenge-step__body">
              <input
                v-model="draft.name"
                maxlength="8"
                aria-label="为此挑战书命名(最多八个字)"
                class="celestial-challenge-name text-[16px]"
                placeholder="为此挑战书命名(如《无盾求生》)"
              />
            </div>

            <div class="celestial-challenge-step-nav">
              <button
                type="button"
                class="celestial-challenge-step-nav__button"
                :disabled="currentChallengeStepIndex === 0"
                @click="shiftChallengeStep(-1)"
              >
                上一程
              </button>
              <span class="tabular"
                >第 {{ currentChallengeStepIndex + 1 }} / {{ CHALLENGE_STEPS.length }} 程</span
              >
              <button
                type="button"
                class="celestial-challenge-step-nav__button"
                :disabled="currentChallengeStepIndex === CHALLENGE_STEPS.length - 1"
                @click="shiftChallengeStep(1)"
              >
                下一程
              </button>
            </div>
          </section>
        </div>

        <div class="celestial-challenge-contract" data-celestial-challenge-contract>
          <p class="celestial-challenge-contract__head">
            <span>此刻约文</span>
            <strong
              >{{ challengeWorld.name }} · {{ challengePact?.name ?? "不立契" }} ·
              {{ draft.name.trim() ? `《${draft.name.trim()}》` : "未命名" }}</strong
            >
          </p>
          <p
            v-if="selectedMutators.length"
            class="celestial-challenge-selection celestial-challenge-selection--mutation"
          >
            {{ selectedMutators.map((m) => `${m.name}：${m.text}`).join("；") }}
          </p>
          <p v-else class="celestial-challenge-contract__note">未叠变数 · 只按本界原始规则验约</p>
          <p v-if="challengePact" class="celestial-challenge-selection">
            立约「{{ challengePact.name }}」：{{ challengePact.ruleText }}
          </p>
        </div>

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

        <div class="celestial-challenge-actions" data-celestial-challenge-actions>
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
import { computed, nextTick, ref } from "vue";
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
import FolioChapterHead from "@/components/common/FolioChapterHead.vue";
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
/**
 * 八门先读谱、后读帖:默认落在最近一处未破门印上,全破后再回到第一门。
 * 选中只改眼前证道帖,不会自行开战或写存档。
 */
const selectedTrialId = ref(
  TRIALS.find((trial) => !endgame.trialRecords[trial.id])?.id ?? TRIALS[0]!.id,
);
const selectedTrial = computed(
  () => TRIALS.find((trial) => trial.id === selectedTrialId.value) ?? TRIALS[0]!,
);
const selectedTrialIndex = computed(() =>
  Math.max(
    0,
    TRIALS.findIndex((trial) => trial.id === selectedTrial.value.id),
  ),
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

function selectTrial(id: string): void {
  selectedTrialId.value = id;
}

function trialSealLabel(trial: (typeof TRIALS)[number]): string {
  const record = endgame.trialRecords[trial.id];
  const state = record ? `最佳 ${record.bestRounds} 回合` : "未破";
  return `${trial.name} · ${state}`;
}

/**
 * 门印是一组单选按钮:方向键 / Home / End 在八门间移印,
 * Tab 只停当前门印,避免手机外接键盘要连按八次才走到证道帖。
 */
function moveTrial(event: KeyboardEvent, index: number): void {
  let next = index;
  if (event.key === "ArrowRight" || event.key === "ArrowDown") {
    next = (index + 1) % TRIALS.length;
  } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
    next = (index - 1 + TRIALS.length) % TRIALS.length;
  } else if (event.key === "Home") {
    next = 0;
  } else if (event.key === "End") {
    next = TRIALS.length - 1;
  } else {
    return;
  }
  event.preventDefault();
  selectedTrialId.value = TRIALS[next]!.id;
  const roster = (event.currentTarget as HTMLElement).closest("[data-celestial-trial-atlas]");
  void nextTick(() => {
    roster?.querySelectorAll<HTMLButtonElement>("[data-celestial-trial-seal]")[next]?.focus();
  });
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
const CHALLENGE_STEPS = [
  { id: "world", ordinal: "一", title: "择界", hint: "本挑战落在哪一重天" },
  { id: "mutators", ordinal: "二", title: "叠变数", hint: "规则越叠越险,赏格随实测难度上浮" },
  { id: "pact", ordinal: "三", title: "立契", hint: "立约改打法;不立契也可验约" },
  { id: "name", ordinal: "四", title: "命名", hint: "八字以内,写进道痕" },
] as const;
type ChallengeStepId = (typeof CHALLENGE_STEPS)[number]["id"];
const challengeWorkbench = ref<HTMLElement | null>(null);
const challengeStep = ref<ChallengeStepId>("world");
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
const challengeWorld = computed(
  () => CELESTIAL_WORLDS.find((world) => world.id === draft.value.worldId) ?? CELESTIAL_WORLDS[0]!,
);
const currentChallengeStepIndex = computed(() =>
  Math.max(
    0,
    CHALLENGE_STEPS.findIndex((step) => step.id === challengeStep.value),
  ),
);
const currentChallengeStep = computed(
  () => CHALLENGE_STEPS[currentChallengeStepIndex.value] ?? CHALLENGE_STEPS[0]!,
);

function challengeStepValue(id: ChallengeStepId): string {
  if (id === "world") return challengeWorld.value.name;
  if (id === "mutators") return `${draft.value.mutatorIds.length} / ${CHALLENGE_MAX_MUTATORS}`;
  if (id === "pact") return challengePact.value?.name ?? "不立契";
  return draft.value.name.trim() || "未名";
}

function challengeStepLabel(step: (typeof CHALLENGE_STEPS)[number]): string {
  return `${step.title} · ${challengeStepValue(step.id)}`;
}

function focusChallengeStep(index: number): void {
  void nextTick(() => {
    challengeWorkbench.value?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[index]?.focus();
  });
}

function selectChallengeStep(id: ChallengeStepId): void {
  challengeStep.value = id;
}

function moveChallengeStep(event: KeyboardEvent, index: number): void {
  let next = index;
  if (event.key === "ArrowRight" || event.key === "ArrowDown") {
    next = (index + 1) % CHALLENGE_STEPS.length;
  } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
    next = (index - 1 + CHALLENGE_STEPS.length) % CHALLENGE_STEPS.length;
  } else if (event.key === "Home") {
    next = 0;
  } else if (event.key === "End") {
    next = CHALLENGE_STEPS.length - 1;
  } else {
    return;
  }
  event.preventDefault();
  challengeStep.value = CHALLENGE_STEPS[next]!.id;
  focusChallengeStep(next);
}

function shiftChallengeStep(delta: number): void {
  const next = Math.max(
    0,
    Math.min(CHALLENGE_STEPS.length - 1, currentChallengeStepIndex.value + delta),
  );
  if (next === currentChallengeStepIndex.value) return;
  challengeStep.value = CHALLENGE_STEPS[next]!.id;
  focusChallengeStep(next);
}

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
