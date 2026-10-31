<template>
  <div class="folio-page folio-page--stack stagger-in celestial-page">
    <FolioPageHeader
      title="天界"
      subtitle="道源叩天门 · 四册证道"
      back-to="home"
      back-label="返回"
      featured
    >
      <template v-if="unlocked" #visual>
        <CelestialGateMap
          :active="celTab"
          :dao-chosen="celestialPulse.daoChosen"
          :dao-seal="currentDao?.seal ?? '门'"
          :worlds-cleared="celestialPulse.worldsCleared"
          :worlds-total="celestialPulse.worldsTotal"
          :run-active="celestialPulse.activeRun"
          :daily-state="celestialPulse.dailyState"
          :marks-count="celestialPulse.marksCount"
          :marks-total="celestialPulse.marksTotal"
          :marks-full="celestialPulse.marksFull"
        />
      </template>

      <template v-if="unlocked" #action>
        <div class="celestial-source">
          <span class="celestial-source__label">此世道源</span>
          <button type="button" class="celestial-source__button" @click="openDaoSourceDialog()">
            <span>叩问天道 · 试一试</span>
            <strong class="tabular">{{ formatNum(endgame.daoSource) }}</strong>
          </button>
        </div>
      </template>

      <LedgerPulse
        v-if="unlocked"
        class="celestial-pulse"
        data-celestial-pulse
        :seal="celestialLead.mark"
        eyebrow="今日天门"
        :title="celestialLead.title"
        :description="celestialLead.detail"
        :tally-columns="2"
        :tally-wide-columns="4"
      >
        <template #actions>
          <button
            type="button"
            class="folio-ledger-pulse__action"
            @click="celTab = celestialLead.tab"
          >
            去看{{ celestialLeadLabel }}
          </button>
        </template>

        <template #tallies>
          <LedgerTally
            v-for="row in celestialLedgerRows"
            :key="row.id"
            :mark="row.mark"
            :label="row.label"
            :value="row.value"
            :total="row.total"
            :unit="row.unit"
            :detail="row.detail"
            :active="celTab === row.id"
            interactive
            :data-celestial-pulse-dao="row.id === 'dao' ? row.value : undefined"
            :data-celestial-pulse-exped="row.id === 'exped' ? row.value : undefined"
            :data-celestial-pulse-trial="row.id === 'trial' ? row.value : undefined"
            :data-celestial-pulse-marks="row.id === 'marks' ? row.value : undefined"
            @select="celTab = row.id"
          />
        </template>
      </LedgerPulse>
    </FolioPageHeader>

    <!-- 未至真仙:封卷页把门限、当前境界与下一步一起摊开 -->
    <UnopenedFolio
      v-if="!unlocked"
      title="天界"
      eyebrow="天门未启"
      lead="仙光垂落而不可及。先走完凡界诸境,再叩天门。"
      hint="这一册不催你提前攒道源;破境之后,道途、远征、试炼与道痕会在此展开。"
      :current-realm="player.realmName"
      :current-major="player.major"
      :gate-realm="realmDef(WORLD_BREAK_MAJOR).name"
      :gate-major="WORLD_BREAK_MAJOR"
    />

    <template v-else>
      <!-- 页签:长卷分册 -->
      <InkTabs v-model="celTab" :tabs="celTabRows" />

      <div class="celestial-book" :data-celestial-book="celTab">
        <template v-if="celTab === 'dao'">
          <!-- 道途:此世已定则摊开代价、章法与剑意；未定则先列七道 -->
          <section class="celestial-dao">
            <div class="celestial-dao__head">
              <SectionTitle title="道途" hint="此生一诺，来世另择" />
              <span class="celestial-dao__state">{{ currentDao ? "此世已定" : "七道待择" }}</span>
            </div>

            <article v-if="currentDao" class="celestial-dao__card">
              <header class="celestial-dao__identity">
                <span class="celestial-dao__seal" aria-hidden="true">{{ currentDao.seal }}</span>
                <div class="celestial-dao__name">
                  <p>{{ currentDao.name }}</p>
                  <span>此世道途 · 转世另择</span>
                </div>
              </header>
              <p class="celestial-dao__desc">{{ currentDao.desc }}</p>

              <div class="celestial-dao__columns">
                <section class="celestial-dao__rules">
                  <p class="celestial-dao__caption">行此道的代价与所得</p>
                  <p v-for="(r, i) in currentDao.ruleText" :key="i" class="celestial-dao__line">
                    <span aria-hidden="true">·</span>
                    <span>{{ r }}</span>
                  </p>
                </section>
                <section v-if="currentDao.deepText.length" class="celestial-dao__deep">
                  <p class="celestial-dao__caption">此道的章法</p>
                  <p
                    v-for="(r, i) in currentDao.deepText"
                    :key="`d${i}`"
                    class="celestial-dao__line"
                  >
                    <span aria-hidden="true">◇</span>
                    <span>{{ r }}</span>
                  </p>
                </section>
              </div>

              <div v-if="swordInfo" class="celestial-dao__purity">
                <p>
                  <span>当前剑意</span>
                  <strong class="tabular"
                    >{{ swordInfo.layers }}/{{ SWORD_PURITY_MAX_LAYERS }} 层</strong
                  >
                </p>
                <span class="celestial-dao__track" aria-hidden="true">
                  <span
                    :style="{
                      width: `${(swordInfo.layers / SWORD_PURITY_MAX_LAYERS) * 100}%`,
                    }"
                  />
                </span>
                <p class="celestial-dao__purity-note">
                  {{
                    swordInfo.checks
                      .filter((c) => c.ok)
                      .map((c) => c.name)
                      .join("、") || "尚无一纯"
                  }}
                </p>
              </div>
              <p v-if="daoStory" class="celestial-dao__story">「{{ daoStory }}」</p>
            </article>

            <div v-else class="celestial-dao__choices">
              <button
                v-for="dao in DAO_PATHS"
                :key="dao.id"
                type="button"
                class="celestial-dao__choice hoverable:hover:border-cinnabar"
                @click="pickDao(dao.id)"
              >
                <span class="celestial-dao__choice-head">
                  <span class="celestial-dao__seal" aria-hidden="true">{{ dao.seal }}</span>
                  <span class="celestial-dao__choice-name">{{ dao.name }}</span>
                </span>
                <span class="celestial-dao__choice-desc">{{ dao.desc }}</span>
                <span v-for="(r, i) in dao.ruleText" :key="i" class="celestial-dao__choice-rule">
                  · {{ r }}
                </span>
                <span
                  v-for="(r, i) in dao.deepText"
                  :key="`d${i}`"
                  class="celestial-dao__choice-deep"
                >
                  ◇ {{ r }}
                </span>
              </button>
            </div>
          </section>

          <!-- 天道熔炉 / 器魂:两处门径 -->
          <section class="celestial-gateways">
            <button
              type="button"
              class="celestial-gateway hoverable:hover:border-cinnabar"
              @click="furnaceOpen = true"
            >
              <span class="celestial-gateway__mark" aria-hidden="true">炉</span>
              <span class="celestial-gateway__copy">
                <span class="celestial-gateway__name">天道熔炉</span>
                <span class="celestial-gateway__note">前尘俗物，皆可熔作道源</span>
              </span>
              <span class="celestial-gateway__arrow" aria-hidden="true">›</span>
            </button>

            <button
              type="button"
              class="celestial-gateway hoverable:hover:border-cinnabar"
              @click="goSouls()"
            >
              <span class="celestial-gateway__mark is-soul" aria-hidden="true">魂</span>
              <span class="celestial-gateway__copy">
                <span class="celestial-gateway__name">器魂</span>
                <span class="celestial-gateway__note">
                  凡器承不住天道，只余形意 · 已凝
                  {{ soulPulse.activeCount }}/{{ soulPulse.slotTotal }}
                </span>
              </span>
              <span class="celestial-gateway__arrow" aria-hidden="true">›</span>
            </button>
          </section>
        </template>

        <!--
          三个页签面板按激活页签互斥渲染(与拆分前 v-else-if 链一致)。
          未激活页签的 DOM 混进浏览器自检会误伤触控与选中态判据。
        -->
        <ExpeditionPanel v-if="celTab === 'exped'" @outcome="handleOutcome" />

        <TrialPanel v-else-if="celTab === 'trial'" :daily="daily" @report="openReport" />

        <MarksPanel v-else-if="celTab === 'marks'" @report="openReport" />
      </div>
    </template>

    <!-- 战报(远征终局 / 试炼 / 变数) -->
    <BaseModal
      :open="expedition !== null"
      :title="expedition?.title ?? ''"
      @close="expedition = null"
    >
      <template v-if="expedition">
        <p
          class="font-kai text-title tracking-wider"
          :class="expedition.cleared ? 'text-jade' : 'text-cinnabar'"
        >
          {{ expedition.markText }}
        </p>

        <!-- 战斗过程:与历练同样逐回合播放 -->
        <div class="mt-2">
          <GauntletPanel :rows="expedition.rows" :player-name="player.name" />
        </div>

        <!-- 逐场摘要:场次多时限高滚动,不把弹窗撑到 82vh 上限 -->
        <div class="scroll-pane mt-2 max-h-40 space-y-1 overflow-y-auto">
          <p
            v-for="(row, i) in expedition.rows"
            :key="i"
            class="flex items-center justify-between rounded-[2px] bg-paper-deep/70 px-3 py-1.5 text-body"
          >
            <span :class="row.win ? 'text-ink-soft' : 'text-cinnabar'">
              第{{ i + 1 }}战 · {{ row.foeName }} · {{ row.win ? "胜" : "负" }}
            </span>
            <span class="tabular text-body text-ink-faint"
              >{{ row.rounds }}回合 · 余血{{ formatPercent(row.hpLeftPct, 0) }}</span
            >
          </p>
        </div>
        <!--
          输也要输得明白:敌人一侧的判定(道之理解 / 境界压制)与战前预估同源,
          连同"怎么办"一并写在这里 —— 战报不是判决书,是下一次出发的依据。
        -->
        <div
          v-if="expedition.judgementLines?.length"
          class="mt-2 rounded-[2px] bg-cinnabar/5 px-3 py-2"
        >
          <p class="font-kai text-body tracking-widest text-cinnabar">此战之判</p>
          <p
            v-for="(line, i) in expedition.judgementLines"
            :key="i"
            class="mt-0.5 text-note leading-relaxed text-ink-faint"
          >
            {{ line }}
          </p>
        </div>
        <p v-if="expedition.reward > 0" class="mt-2 text-body text-gold-ink tabular">
          <GameIcon name="sparkles" :size="12" class="inline" />
          道源 +{{ expedition.reward }}
        </p>
      </template>
      <template #footer>
        <button class="btn-seal w-full" @click="expedition = null">收 卷</button>
      </template>
    </BaseModal>

    <!-- 天道熔炉(弹窗本体在 components/celestial/FurnaceDialog.vue,含首次凝道果弹窗) -->
    <FurnaceDialog :open="furnaceOpen" @close="furnaceOpen = false" />

    <!-- 道途选择确认:一世只此一次,点了就锁到转世 -->
    <BaseModal :open="pendingDao !== undefined" title="定下道途" @close="pendingDaoId = null">
      <template v-if="pendingDao">
        <p class="font-kai text-title tracking-wider text-ink">{{ pendingDao.name }}</p>
        <p class="mt-1.5 t-body text-ink-soft">{{ pendingDao.desc }}</p>
        <p v-for="(r, i) in pendingDao.ruleText" :key="i" class="mt-0.5 text-body text-qing">
          · {{ r }}
        </p>
        <p class="mt-3 border-l-2 border-cinnabar/60 pl-2 text-body text-cinnabar">
          道途既定,此世不再更改;误选须待兵解转世方能重择
        </p>
      </template>
      <template #footer>
        <div class="flex gap-2">
          <button class="btn-ghost flex-1" @click="pendingDaoId = null">再想想</button>
          <button class="btn-seal flex-1 !bg-cinnabar-deep" @click="confirmDao">道心已定</button>
        </div>
      </template>
    </BaseModal>

    <!-- Phase 30.9 S2:道源说明弹窗 -->
    <BaseModal :open="daoSourceDialogOpen" title="道源" @close="daoSourceDialogOpen = false">
      <div class="space-y-3 text-body leading-relaxed">
        <p class="text-ink-soft">{{ daoSourceDialog().intro }}</p>
        <div>
          <p class="font-kai text-body tracking-wider text-ink">用途</p>
          <p class="text-ink-faint">{{ daoSourceDialog().usages.join(" · ") }}</p>
        </div>
        <div>
          <p class="font-kai text-body tracking-wider text-ink">获取</p>
          <p class="text-ink-faint">{{ daoSourceDialog().gains.join(" · ") }}</p>
        </div>
        <p class="border-l-2 border-cinnabar/60 pl-2 text-body text-cinnabar">
          {{ daoSourceDialog().lifecycle }}
        </p>
      </div>
      <template #footer>
        <button class="btn-seal w-full" @click="daoSourceDialogOpen = false">知道了</button>
      </template>
    </BaseModal>

    <!-- Phase 30.9 S4:首次登真仙·终局导览(弹窗本体在 components/celestial/TutorialDialog.vue) -->
    <TutorialDialog :open="tutorialOpen" @close="tutorialOpen = false" />
  </div>
</template>

<script setup lang="ts">
import "@/styles/pages/celestial.css";
import { computed, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { usePlayerStore } from "@/stores/player";
import { useInventoryStore } from "@/stores/inventory";
import { MAX_MARKS, useEndgameStore } from "@/stores/endgame";
import {
  CELESTIAL_WORLDS,
  DAO_PATHS,
  EXPEDITION_ROUTE_LAYERS,
  TRIALS,
  daoPathDef,
} from "@/data/endgame";
import { realmDef, WORLD_BREAK_MAJOR } from "@/data/realms";
import { todayChallenge } from "@/core/dailyChallenge";
import { chooseDaoPath, endgameUnlocked } from "@/core/endgameService";
import { celestialOverview } from "@/core/celestialOverview";
import { soulOverview } from "@/core/soulOverview";
import { currentDaoNarrative } from "@/core/identity";
import { resolveWorld, type StepOutcome } from "@/core/expedition";
import { detectBuild } from "@/core/buildDetect";
import { BUILD_PROFILES } from "@/core/buildSim";
import { foeOriginLines } from "@/core/battleAnalysis";
import { swordPurity, SWORD_PURITY_MAX_LAYERS } from "@/core/daoDepth";
import { formatNum, formatPercent } from "@/utils/format";
import FolioPageHeader from "@/components/common/FolioPageHeader.vue";
import LedgerPulse from "@/components/common/LedgerPulse.vue";
import LedgerTally from "@/components/common/LedgerTally.vue";
import UnopenedFolio from "@/components/common/UnopenedFolio.vue";
import SectionTitle from "@/components/common/SectionTitle.vue";
import InkTabs from "@/components/common/InkTabs.vue";
import BaseModal from "@/components/common/BaseModal.vue";
import GauntletPanel from "@/components/celestial/GauntletPanel.vue";
import CelestialGateMap from "@/components/celestial/CelestialGateMap.vue";
import FurnaceDialog from "@/components/celestial/FurnaceDialog.vue";
import TutorialDialog from "@/components/celestial/TutorialDialog.vue";
import MarksPanel from "@/components/celestial/MarksPanel.vue";
import TrialPanel from "@/components/celestial/TrialPanel.vue";
import ExpeditionPanel from "@/components/celestial/ExpeditionPanel.vue";
import type { ReportView } from "@/components/celestial/reportView";
import GameIcon from "@/components/common/GameIcon.vue";
import {
  daoSourceDialog,
  shouldShowEndgameTutorial,
  markEndgameTutorialSeen,
  markResourceDialogSeen,
} from "@/core/resourceGuidance";
import { useRouteTab } from "@/composables/useRouteTab";
import { CELESTIAL_CHAPTERS } from "@/ui/navigation";

const player = usePlayerStore();

const inventory = useInventoryStore();
const endgame = useEndgameStore();

const currentDao = computed(() => (endgame.daoPath ? daoPathDef(endgame.daoPath) : undefined));

/** 天界入口与器魂页共用同一份槽位账。 */
const soulPulse = computed(() =>
  soulOverview({
    activeSouls: endgame.activeSouls,
    soulList: endgame.soulList,
    items: inventory.items,
    equippedUids: inventory.equippedUids,
    daoSource: endgame.daoSource,
  }),
);

const unlocked = computed(() => endgameUnlocked());

/** 今日天道同时供卷首总账、页签朱点与试炼面板使用。 */
const daily = computed(() => (unlocked.value && endgame.daoPath ? todayChallenge() : null));

const activeRunWorld = computed(() =>
  endgame.worldRun ? resolveWorld(endgame.worldRun.worldId) : undefined,
);
const dailyWorld = computed(() =>
  daily.value ? resolveWorld(daily.value.draft.worldId) : undefined,
);
const expeditionWorlds = computed(() => [
  ...CELESTIAL_WORLDS,
  ...(endgame.voidWorld ? [endgame.voidWorld] : []),
]);
const affordableExpeditions = computed(
  () => expeditionWorlds.value.filter((world) => endgame.daoSource >= world.entryCost).length,
);

/** 天界四册只在卷首汇一次；面板里的逐项明细继续各报各的。 */
const celestialPulse = computed(() =>
  celestialOverview({
    daoChosen: endgame.daoPath !== null,
    worldIds: expeditionWorlds.value.map((world) => world.id),
    worldClears: endgame.worldClears,
    worldRun: endgame.worldRun,
    trialIds: TRIALS.map((trial) => trial.id),
    trialRecords: endgame.trialRecords,
    daily: daily.value,
    dailyDoneDay: endgame.dailyDoneDay,
    marksCount: endgame.marks.length,
    marksTotal: MAX_MARKS,
  }),
);

const dailyStateText = computed(() => {
  if (celestialPulse.value.dailyState === "ready") return "今日可应";
  if (celestialPulse.value.dailyState === "done") return "今日已成";
  return "择道后开题";
});

/** 四册总账与星图共用这一份读数；每一栏都能直接翻到对应册页。 */
const celestialLedgerRows = computed(() => [
  {
    id: "dao" as const,
    mark: currentDao.value?.seal ?? "道",
    label: "道途",
    value: celestialPulse.value.daoChosen ? 1 : 0,
    total: DAO_PATHS.length,
    unit: celestialPulse.value.daoChosen ? "道已定" : "道待择",
    detail: currentDao.value?.name ?? "此世一诺，转世另择",
  },
  {
    id: "exped" as const,
    mark: "征",
    label: "远征",
    value: celestialPulse.value.worldsCleared,
    total: celestialPulse.value.worldsTotal,
    unit: "界已破",
    detail:
      endgame.worldRun && activeRunWorld.value
        ? `${activeRunWorld.value.name} · 已历 ${celestialPulse.value.runFights}/${EXPEDITION_ROUTE_LAYERS + 2} 战`
        : `${affordableExpeditions.value} 界可启程`,
  },
  {
    id: "trial" as const,
    mark: "试",
    label: "试炼",
    value: celestialPulse.value.trialsCleared,
    total: celestialPulse.value.trialsTotal,
    unit: "试已破",
    detail: dailyStateText.value,
  },
  {
    id: "marks" as const,
    mark: "痕",
    label: "道痕",
    value: celestialPulse.value.marksCount,
    total: celestialPulse.value.marksTotal,
    unit: "痕在卷",
    detail: celestialPulse.value.marksFull
      ? "下一战覆去最古一痕"
      : `还可记 ${celestialPulse.value.marksRemaining} 则`,
  },
]);

/** 先手只带路，不替玩家做决定；每一句仍读四册同一份总账。 */
const celestialLead = computed(() => {
  const pulse = celestialPulse.value;
  if (endgame.worldRun && activeRunWorld.value) {
    const nextFight = Math.min(EXPEDITION_ROUTE_LAYERS + 2, pulse.runFights + 1);
    return {
      tab: "exped" as const,
      mark: "续行",
      title: `${activeRunWorld.value.name} · 第 ${nextFight}/${EXPEDITION_ROUTE_LAYERS + 2} 战`,
      detail: `已历 ${pulse.runFights} 战 · 携血 ${formatPercent(endgame.worldRun.carriedHpPct, 0)} · 可回凡界整备`,
    };
  }
  if (!pulse.daoChosen) {
    return {
      tab: "dao" as const,
      mark: "定道",
      title: "先定此世道途",
      detail: `${DAO_PATHS.length} 道各有一得，也各有代价；落子后须待转世再选`,
    };
  }
  if (pulse.dailyState === "ready" && daily.value && dailyWorld.value) {
    return {
      tab: "trial" as const,
      mark: "应题",
      title: "今日天道尚待应战",
      detail: `${dailyWorld.value.name} · 赏 ${daily.value.verdict.reward} 道源 · 可行 ${daily.value.verdict.viable}/${BUILD_PROFILES.length} 流派`,
    };
  }
  if (affordableExpeditions.value > 0) {
    return {
      tab: "exped" as const,
      mark: "启程",
      title: `${affordableExpeditions.value} 界已备道源`,
      detail: `现有道源 ${formatNum(endgame.daoSource)} · 择契、看路、再叩天门`,
    };
  }
  if (pulse.dailyState === "done") {
    return {
      tab: "trial" as const,
      mark: "再炼",
      title: "今日天道已成",
      detail: `试炼已破 ${pulse.trialsCleared}/${pulse.trialsTotal} · 变数与挑战书仍可再战`,
    };
  }
  return {
    tab: "marks" as const,
    mark: "阅痕",
    title: "四册暂歇",
    detail: `道痕 ${pulse.marksCount}/${pulse.marksTotal} · 再看一眼来路，或去熔炉换些道源`,
  };
});

const router = useRouter();
function goSouls(): void {
  router.push({ name: "souls" });
}

// Phase 30.9:道源说明弹窗 / 首次终局教学(熔炉与道果在 components/celestial/FurnaceDialog.vue)
const daoSourceDialogOpen = ref(false);
const furnaceOpen = ref(false);
const tutorialOpen = ref(false);
// 首次进入天界(已解锁且未见过教学):自动弹终局导览
watch(
  () => unlocked.value,
  (v) => {
    if (v && shouldShowEndgameTutorial()) {
      tutorialOpen.value = true;
      markEndgameTutorialSeen();
    }
  },
  { immediate: true },
);
function openDaoSourceDialog(): void {
  daoSourceDialogOpen.value = true;
  markResourceDialogSeen();
}

// ---- 页签:长卷分册(远征在途时落在远征册) ----
const CEL_TABS = CELESTIAL_CHAPTERS;
const celestialLeadLabel = computed(
  () => CEL_TABS.find((tab) => tab.id === celestialLead.value.tab)?.label ?? "道途",
);
/**
 * 落哪一册:玄枢寻册或别册可带 `?tab=` 直达分册;没有指定时,
 * 远征在途落远征,否则落道途。
 */
const celTab = useRouteTab(CELESTIAL_CHAPTERS, endgame.worldRun ? "exped" : "dao");

/**
 * 页签行:两处**有当下**的挂朱点 ——
 *   远征:一趟没走完(worldRun 在);
 *   试炼:今日天道的每日挑战还没做(日出而题,过了今日就白丢)。
 * 道途 / 道痕没有「在跑」的状态,不挂。
 */
const celTabRows = computed(() =>
  CEL_TABS.map((t) => ({
    ...t,
    dot:
      (t.id === "exped" && !!endgame.worldRun) ||
      (t.id === "trial" && !!daily.value && endgame.dailyDoneDay !== daily.value.day),
  })),
);

/** 剑道:当前剑意层数与纯度构成 */
const swordInfo = computed(() => {
  if (endgame.daoPath !== "sword") return null;
  return swordPurity(
    player.celestialStats.mods,
    inventory.currentArtifacts.length,
    detectBuild(player.celestialStats.mods),
  );
});

/** 道途选择二段式:先弹确认,再落一子。道途一世只定一次,误触即被锁死到转世 */
const pendingDaoId = ref<(typeof DAO_PATHS)[number]["id"] | null>(null);
const pendingDao = computed(() =>
  pendingDaoId.value ? daoPathDef(pendingDaoId.value) : undefined,
);

function pickDao(id: (typeof DAO_PATHS)[number]["id"]): void {
  pendingDaoId.value = id;
}

function confirmDao(): void {
  if (pendingDaoId.value) chooseDaoPath(pendingDaoId.value);
  pendingDaoId.value = null;
}

// ---- 战报弹窗(统一形状;类型单源在 components/celestial/reportView.ts,与各面板共用) ----
const expedition = ref<ReportView | null>(null);

/**
 * 开战报 —— 判定归因只此一处。
 *
 * 远征的文案带玩家自己的构筑厚度(见 core/gauntlet.celestialJudgementLines),
 * 试炼/变数/忆战/重写/挑战没有那一份,就照敌人快照上的来源说明讲
 * (worldFoeSnap 一路带下来)。两条路给的都是同一件事:这一战为什么变难。
 */
function openReport(o: {
  title: string;
  cleared: boolean;
  markText: string;
  rows: ReportView["rows"];
  reward: number;
  judgementLines?: string[];
}): void {
  expedition.value = {
    ...o,
    judgementLines: o.judgementLines ?? foeOriginLines(o.rows[0]?.foe?.origin),
  };
}

function handleOutcome(outcome: StepOutcome | null, title: string): void {
  if (!outcome || outcome.type === "advance") return;
  const rows = outcome.finalRows ?? [outcome.row];
  openReport({
    title,
    cleared: outcome.type === "cleared",
    markText:
      outcome.type === "cleared"
        ? `全程 ${rows.length} 战功成`
        : outcome.type === "pactBroken"
          ? `契约崩碎于第 ${rows.length} 战`
          : `止步第 ${rows.length} 战`,
    rows,
    reward: outcome.rewardDaoSource,
    judgementLines: outcome.judgementLines,
  });
}

/** 道途行为叙事(本世道痕 ≥2 则方语) */
const daoStory = computed(() => currentDaoNarrative());
</script>
