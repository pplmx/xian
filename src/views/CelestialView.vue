<template>
  <div class="folio-page folio-page--stack stagger-in">
    <FolioPageHeader title="天 界" back-to="home" back-label="返回">
      <template #action>
        <div
          v-if="unlocked"
          class="flex items-center justify-end gap-2 tinylens:w-full tinylens:justify-between"
        >
          <span class="chip-ink border-cinnabar/50 text-[10px] text-cinnabar">此世消耗</span>
          <button class="text-left active:opacity-60" @click="openDaoSourceDialog()">
            <span class="block text-[10px] leading-tight text-ink-faint">叩问天道·试一试</span>
            <span class="block tabular font-kai text-[17px] leading-tight text-cinnabar">{{
              formatNum(endgame.daoSource)
            }}</span>
          </button>
        </div>
      </template>
    </FolioPageHeader>

    <!-- 未至真仙 -->
    <div v-if="!unlocked" class="card-ink px-6 py-16 text-center">
      <p class="font-kai text-[22px] tracking-[0.4em] text-ink">天 界</p>
      <p class="mt-4 t-body text-ink-faint">
        天门紧闭,仙光垂落而不可及。
        <br />
        修至
        <span class="text-cinnabar">真仙境</span>
        ,方见此界真容。
      </p>
    </div>

    <template v-else>
      <!-- 页签:长卷分册 -->
      <InkTabs v-model="celTab" :tabs="celTabRows" />

      <template v-if="celTab === 'dao'">
        <!-- 道途 -->
        <section>
          <SectionTitle title="道途" hint="此生一诺,来世另择" />
          <div v-if="currentDao" class="card-ink mt-2 px-4 py-3">
            <p class="flex items-center gap-3">
              <span
                class="grid h-10 w-10 place-items-center rounded-md bg-cinnabar/90 font-kai text-[20px] text-paper"
              >
                {{ currentDao.seal }}
              </span>
              <span class="font-kai text-[16px] tracking-widest text-ink">{{
                currentDao.name
              }}</span>
            </p>
            <p class="mt-2 t-body text-ink-soft">{{ currentDao.desc }}</p>
            <!--
              三组文字此前同为 11px,只靠颜色分(青/金/灰)—— 三色都是低饱和,
              并排时读作同一片淡字。改法:给每组一条**自己的小标题**,
              并让词条值与说明分成两档(值用 ink-soft、前缀用 faint),
              机制则整组套一层浅底,把「这一段是玩法」与「这一段是风味」分开。
            -->
            <p class="mt-2 text-[10px] text-ink-faint">行此道的代价与所得</p>
            <div class="mt-1 space-y-0.5">
              <p
                v-for="(r, i) in currentDao.ruleText"
                :key="i"
                class="flex gap-1.5 text-[11px] leading-relaxed"
              >
                <span class="shrink-0 text-ink-faint">·</span>
                <span class="min-w-0 text-qing">{{ r }}</span>
              </p>
            </div>
            <p v-if="currentDao.deepText.length" class="mt-2 text-[10px] text-ink-faint">
              此道的章法
            </p>
            <div
              v-if="currentDao.deepText.length"
              class="mt-1 space-y-1 rounded-md bg-paper-deep/60 px-2.5 py-2"
            >
              <p
                v-for="(r, i) in currentDao.deepText"
                :key="`d${i}`"
                class="flex gap-1.5 text-[11px] leading-relaxed"
              >
                <span class="shrink-0 text-gold-ink">◈</span>
                <span class="min-w-0 text-gold-ink">{{ r }}</span>
              </p>
            </div>
            <p v-if="swordInfo" class="mt-1.5 text-[11px] text-violet-ink tabular">
              当前剑意 {{ swordInfo.layers }}/{{ SWORD_PURITY_MAX_LAYERS }} 层({{
                swordInfo.checks
                  .filter((c) => c.ok)
                  .map((c) => c.name)
                  .join("、") || "尚无一纯"
              }})
            </p>
            <p v-if="daoStory" class="mt-1.5 font-kai t-body text-ink-soft">「{{ daoStory }}」</p>
          </div>
          <div v-else class="mt-2 grid grid-cols-2 gap-2.5">
            <button
              v-for="dao in DAO_PATHS"
              :key="dao.id"
              class="card-ink px-3 py-3 text-left active:scale-98"
              @click="pickDao(dao.id)"
            >
              <p class="flex items-center gap-2">
                <span
                  class="grid h-8 w-8 place-items-center rounded-md bg-cinnabar/85 font-kai text-[16px] text-paper"
                >
                  {{ dao.seal }}
                </span>
                <span class="t-card">{{ dao.name }}</span>
              </p>
              <p class="mt-1.5 text-[10px] leading-relaxed text-ink-faint">{{ dao.desc }}</p>
              <p v-for="(r, i) in dao.ruleText" :key="i" class="mt-0.5 text-[10px] text-qing">
                · {{ r }}
              </p>
              <p
                v-for="(r, i) in dao.deepText"
                :key="`d${i}`"
                class="mt-0.5 text-[10px] text-gold-ink"
              >
                ◈ {{ r }}
              </p>
            </button>
          </div>
        </section>

        <!-- 天道熔炉 / 器魂:两处入口 -->
        <section class="space-y-2">
          <button
            class="card-ink flex w-full items-center justify-between gap-3 px-4 py-3 text-left active:scale-99"
            @click="furnaceOpen = true"
          >
            <span
              class="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-cinnabar/85 font-kai text-[19px] text-paper"
              >炉</span
            >
            <span class="min-w-0 flex-1">
              <span class="block t-card">天道熔炉</span>
              <span class="block truncate text-[10px] leading-relaxed text-ink-faint"
                >前尘俗物,皆可熔作道源</span
              >
            </span>
            <span class="shrink-0 text-[11px] text-ink-faint">›</span>
          </button>

          <button
            class="card-ink flex w-full items-center justify-between gap-3 px-4 py-3 text-left active:scale-99"
            @click="goSouls()"
          >
            <span
              class="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-gold-ink/85 font-kai text-[19px] text-paper"
              >魂</span
            >
            <span class="min-w-0 flex-1">
              <span class="block t-card">器 魂</span>
              <span class="block truncate text-[10px] leading-relaxed text-ink-faint">
                凡器承不住天道,只余形意 · 已凝
                {{ soulPulse.activeCount }}/{{ soulPulse.slotTotal }}
              </span>
            </span>
            <span class="shrink-0 text-[11px] text-ink-faint">›</span>
          </button>
        </section>
      </template>

      <!--
        三个页签面板按激活页签互斥渲染(与拆分前 v-else-if 链一致)。
        拆分时一度改成无条件挂载 —— 未激活页签的 DOM 混进了浏览器自检:
        择契 chip 22.5px 过小、变数 chips 的多选组(0 条是合法初始态)被
        「每组恰有一个选中」的单选判据误拦。页签未激活不渲染,不只是省渲染。
      -->
      <ExpeditionPanel v-if="celTab === 'exped'" @outcome="handleOutcome" />

      <TrialPanel v-else-if="celTab === 'trial'" :daily="daily" @report="openReport" />

      <MarksPanel v-else-if="celTab === 'marks'" @report="openReport" />
    </template>

    <!-- 战报(远征终局 / 试炼 / 变数) -->
    <BaseModal
      :open="expedition !== null"
      :title="expedition?.title ?? ''"
      @close="expedition = null"
    >
      <template v-if="expedition">
        <p
          class="font-kai text-[14px] tracking-wider"
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
            class="flex items-center justify-between rounded bg-paper-deep/70 px-3 py-1.5 text-[11px]"
          >
            <span :class="row.win ? 'text-ink-soft' : 'text-cinnabar'">
              第{{ i + 1 }}战 · {{ row.foeName }} · {{ row.win ? "胜" : "负" }}
            </span>
            <span class="tabular text-[11px] text-ink-faint"
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
          class="mt-2 rounded-md bg-cinnabar/5 px-3 py-2"
        >
          <p class="font-kai text-[11px] tracking-widest text-cinnabar">此战之判</p>
          <p
            v-for="(line, i) in expedition.judgementLines"
            :key="i"
            class="mt-0.5 text-[10px] leading-relaxed text-ink-faint"
          >
            {{ line }}
          </p>
        </div>
        <p v-if="expedition.reward > 0" class="mt-2 text-[11px] text-gold-ink tabular">
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
        <p class="font-kai text-[14px] tracking-wider text-ink">{{ pendingDao.name }}</p>
        <p class="mt-1.5 t-body text-ink-soft">{{ pendingDao.desc }}</p>
        <p v-for="(r, i) in pendingDao.ruleText" :key="i" class="mt-0.5 text-[11px] text-qing">
          · {{ r }}
        </p>
        <p class="mt-3 border-l-2 border-cinnabar/60 pl-2 text-[11px] text-cinnabar">
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
      <div class="space-y-3 text-[11px] leading-relaxed">
        <p class="text-ink-soft">{{ daoSourceDialog().intro }}</p>
        <div>
          <p class="font-kai text-[11px] tracking-wider text-ink">用途</p>
          <p class="text-ink-faint">{{ daoSourceDialog().usages.join(" · ") }}</p>
        </div>
        <div>
          <p class="font-kai text-[11px] tracking-wider text-ink">获取</p>
          <p class="text-ink-faint">{{ daoSourceDialog().gains.join(" · ") }}</p>
        </div>
        <p class="border-l-2 border-cinnabar/60 pl-2 text-[11px] text-cinnabar">
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
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { usePlayerStore } from "@/stores/player";
import { useInventoryStore } from "@/stores/inventory";
import { useEndgameStore } from "@/stores/endgame";
import { DAO_PATHS, daoPathDef } from "@/data/endgame";
import { todayChallenge } from "@/core/dailyChallenge";
import { chooseDaoPath, endgameUnlocked } from "@/core/endgameService";
import { soulOverview } from "@/core/soulOverview";
import { currentDaoNarrative } from "@/core/identity";
import type { StepOutcome } from "@/core/expedition";
import { detectBuild } from "@/core/buildDetect";
import { foeOriginLines } from "@/core/battleAnalysis";
import { swordPurity, SWORD_PURITY_MAX_LAYERS } from "@/core/daoDepth";
import { formatNum, formatPercent } from "@/utils/format";
import FolioPageHeader from "@/components/common/FolioPageHeader.vue";
import SectionTitle from "@/components/common/SectionTitle.vue";
import InkTabs from "@/components/common/InkTabs.vue";
import BaseModal from "@/components/common/BaseModal.vue";
import GauntletPanel from "@/components/celestial/GauntletPanel.vue";
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

const player = usePlayerStore();

const inventory = useInventoryStore();
const endgame = useEndgameStore();

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

const router = useRouter();
const route = useRoute();
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

const currentDao = computed(() => (endgame.daoPath ? daoPathDef(endgame.daoPath) : undefined));

// ---- 页签:长卷分册(远征在途时落在远征册) ----
type CelTab = "dao" | "exped" | "trial" | "marks";
const CEL_TABS: { id: CelTab; label: string }[] = [
  { id: "dao", label: "道途" },
  { id: "exped", label: "远征" },
  { id: "trial", label: "试炼" },
  { id: "marks", label: "道痕" },
];
/**
 * 落哪一册:界域志的「奇门」可带 `?tab=exped` 直接落到远征册(择门就在那儿),
 * 其余按旧规矩 —— 远征在途落远征,否则落道途。
 */
const routeTab = CEL_TABS.find((t) => t.id === String(route.query.tab))?.id;
const celTab = ref<CelTab>(routeTab ?? (endgame.worldRun ? "exped" : "dao"));

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

// ---- 今日天道(daily 本体留主文件:页签朱点 celTabRows 与试炼面板同源) ----
const daily = computed(() => (unlocked.value && endgame.daoPath ? todayChallenge() : null));
</script>
