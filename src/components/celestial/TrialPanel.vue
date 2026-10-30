<template>
  <!-- 今日天道:程序生成的每日挑战 -->
  <section v-if="daily">
    <SectionTitle title="今日天道" hint="日出而题,日落而息" />
    <div class="card-ink mt-2 px-4 py-3">
      <p class="flex items-center gap-2">
        <span class="t-card">{{ dailyWorld?.name }}</span>
        <span class="tabular text-body text-ink-soft"
          >{{ daily.verdict.difficulty }} · 可行 {{ daily.verdict.viable }}/{{
            BUILD_PROFILES.length
          }}</span
        >
        <span class="ml-auto tabular text-body text-gold-ink">赏 {{ daily.verdict.reward }}</span>
      </p>
      <p class="mt-1 flex flex-wrap gap-x-3 text-note text-violet-ink">
        <span v-for="m in dailyMutators" :key="m!.id">◇ {{ m!.name }}:{{ m!.text }}</span>
        <span v-if="dailyPact" class="text-cinnabar">契·{{ dailyPact.name }}</span>
      </p>
      <button
        class="btn-seal mt-2 w-full !py-1.5 !text-body"
        :disabled="endgame.dailyDoneDay === daily.day || challengeDaoShort > 0"
        @click="goDaily"
      >
        <template v-if="challengeDaoShort > 0">尚差 {{ challengeDaoShort }} 道源</template>
        <template v-else-if="endgame.dailyDoneDay === daily.day">今日已成,明日再会</template>
        <template v-else>应 战(道源 {{ CHALLENGE_ENTRY_COST }})</template>
      </button>
    </div>
  </section>
  <!-- 未择道途时「今日天道」是为空的一格:区段常驻,别让玩家以为它消失了 ——
         择了道途它就在这儿(判据与上方 daily 同源) -->
  <section v-else>
    <SectionTitle title="今日天道" hint="日出而题,日落而息" />
    <div class="empty-note card-ink mt-2 px-4 py-4 text-center t-body text-ink-faint">
      今日天道随道途而定 —— 于道途一页择定「此世之路」后,自会在此展开。
    </div>
  </section>

  <!-- 天道变数 -->
  <section>
    <SectionTitle title="天道变数" hint="规则随机,每探一次天机便换一副面孔" />
    <div class="card-ink mt-2 px-4 py-3">
      <template v-if="mutationDraw.length">
        <p v-for="m in mutationRows" :key="m!.id" class="text-body text-violet-ink">
          ◇ {{ m!.name }}:{{ m!.text }}
        </p>
        <div class="mt-2 flex gap-2">
          <button
            class="btn-seal flex-1 !py-2 !text-body"
            :disabled="mutationDaoShort > 0"
            @click="goMutation"
          >
            <template v-if="mutationDaoShort > 0">尚差 {{ mutationDaoShort }} 道源</template>
            <template v-else
              >应 战(道源 {{ MUTATION_ENTRY_COST }} · 破解得 {{ MUTATION_BASE_REWARD }})</template
            >
          </button>
          <button class="btn-ghost !px-3 !text-body" @click="mutationDraw = rollMutators()">
            再探
          </button>
        </div>
      </template>
      <template v-else>
        <p class="t-body text-ink-faint">
          天道无常,规则无定。窥探本次变数,再决定是否应战——{{
            cnNumber(MUTATION_FIGHTS)
          }}连战,规则叠加。
        </p>
        <button
          class="btn-ghost mt-2 w-full !py-2 !text-body"
          @click="mutationDraw = rollMutators()"
        >
          窥探变数
        </button>
      </template>
    </div>
  </section>

  <!-- 天道试炼 -->
  <section>
    <SectionTitle title="天道试炼" hint="极限构筑的证道之地" />
    <div class="mt-2 space-y-2.5">
      <div v-for="trial in TRIALS" :key="trial.id" class="card-ink px-4 py-3">
        <p class="flex items-center gap-2">
          <span
            class="grid h-8 w-8 place-items-center rounded-[2px] bg-gold-ink/85 font-kai text-section text-paper"
          >
            {{ trial.seal }}
          </span>
          <span class="font-kai text-title tracking-[0.2em] text-ink">{{ trial.name }}</span>
          <span
            v-if="endgame.trialRecords[trial.id]"
            class="ml-auto tabular text-note text-gold-ink"
          >
            最佳 {{ endgame.trialRecords[trial.id]!.bestRounds }} 回合
          </span>
        </p>
        <p class="mt-1.5 t-body text-ink-faint">{{ trial.desc }}</p>
        <p class="mt-1 flex flex-wrap gap-x-3 text-note text-violet-ink">
          <span v-for="(r, i) in trial.ruleText" :key="i">{{ r }}</span>
        </p>
        <button
          class="btn-ghost mt-2.5 w-full !py-2 !text-title"
          :disabled="!endgame.daoPath || daoEntryShort(trial.entryCost) > 0"
          @click="goTrial(trial.id)"
        >
          <template v-if="!endgame.daoPath">先择道途,方可应试</template>
          <template v-else-if="daoEntryShort(trial.entryCost) > 0"
            >尚差 {{ daoEntryShort(trial.entryCost) }} 道源</template
          >
          <template v-else-if="endgame.trialRecords[trial.id]"
            >应 试(道源 {{ trial.entryCost }} · 已捷过,再战仅录纪录)</template
          >
          <template v-else
            >应 试(道源 {{ trial.entryCost }} · 首破得 {{ trial.rewardDaoSource }})</template
          >
        </button>
      </div>
    </div>
  </section>

  <!-- 天道挑战书:玩家定规则,天道定难度与赏格 -->
  <section>
    <!-- 天界秘境:真仙起,道源代价,与远征/试炼并列的一阶一次性内容 -->
    <SecretRealmCard gate="celestial" />

    <SectionTitle title="天道挑战书" hint="你定规则,天道定赏" />
    <div class="card-ink mt-2 px-4 py-3">
      <p class="text-body text-ink-faint">
        选界 · 叠变数(至多 {{ cnNumber(CHALLENGE_MAX_MUTATORS) }} 条)· 立契 ·
        命名。赏格由天道实测难度定价,无从作弊。
      </p>
      <div class="mt-2 flex flex-wrap gap-1.5">
        <button
          v-for="w in CELESTIAL_WORLDS"
          :key="w.id"
          class="chip-ink !py-1.5 !px-3"
          :class="
            draft.worldId === w.id
              ? 'border-cinnabar text-cinnabar'
              : 'border-ink/25 text-ink-faint'
          "
          @click="setDraftWorld(w.id)"
        >
          {{ w.name }}
        </button>
      </div>
      <div class="mt-1.5 flex flex-wrap gap-1.5">
        <button
          v-for="m in MUTATORS"
          :key="m.id"
          class="chip-ink !py-1.5 !px-3"
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
      <p v-if="selectedMutators.length" class="mt-1 text-note leading-relaxed text-violet-ink">
        {{ selectedMutators.map((m) => `${m.name}：${m.text}`).join("；") }}
      </p>
      <div class="mt-1.5 flex flex-wrap gap-1.5">
        <button
          class="chip-ink !py-1.5 !px-3"
          :class="draft.pactId === null ? 'border-jade text-jade' : 'border-ink/25 text-ink-faint'"
          :aria-pressed="draft.pactId === null"
          @click="setDraftPact(null)"
        >
          不立契
        </button>
        <button
          v-for="p in PACTS"
          :key="p.id"
          class="chip-ink !py-1.5 !px-3"
          :class="
            draft.pactId === p.id ? 'border-cinnabar text-cinnabar' : 'border-ink/25 text-ink-faint'
          "
          :title="p.ruleText"
          :aria-pressed="draft.pactId === p.id"
          @click="setDraftPact(p.id)"
        >
          {{ p.name }}
        </button>
      </div>
      <p v-if="challengePact" class="mt-1 text-note leading-relaxed text-ink-soft">
        立约「{{ challengePact.name }}」：{{ challengePact.ruleText }}
      </p>
      <input
        v-model="draft.name"
        maxlength="8"
        aria-label="为此挑战书命名(最多八个字)"
        class="mt-2 w-full rounded-[2px] border border-ink/20 bg-paper-deep/60 px-3 py-1.5 text-[16px] outline-none focus:border-cinnabar/50 t-card"
        placeholder="为此挑战书命名(如《无盾求生》)"
      />
      <div
        v-if="challengeVerdict"
        class="mt-2 rounded-[2px] px-3 py-2"
        :class="challengeVerdict.ok ? 'bg-paper-deep/70' : 'bg-cinnabar/10'"
      >
        <p v-if="challengeVerdict.ok" class="flex items-center justify-between text-body">
          <span class="text-ink-soft"
            >天道受此约:{{ challengeVerdict.difficulty }} · 可行流派
            {{ challengeVerdict.viable }}/{{ BUILD_PROFILES.length }}</span
          >
          <span class="tabular text-gold-ink">赏 道源 {{ challengeVerdict.reward }}</span>
        </p>
        <p v-else class="text-body text-cinnabar">{{ challengeVerdict.reason }}</p>
      </div>
      <div class="mt-2 flex gap-2">
        <button class="btn-ghost flex-1 !py-1.5 !text-body" @click="doVerify">验 约</button>
        <button
          class="btn-seal flex-1 !py-1.5 !text-body"
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
import SectionTitle from "@/components/common/SectionTitle.vue";
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

// ---- 天道挑战书 ----
const draft = ref<ChallengeDraft>({
  worldId: CELESTIAL_WORLDS[0]!.id,
  mutatorIds: [],
  pactId: null,
  name: "",
});
const challengeVerdict = ref<ChallengeVerdict | null>(null);
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
