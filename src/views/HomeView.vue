<template>
  <div class="stagger-in space-y-4 px-4 pb-6 pt-4">
    <!--
      iOS 上「加进主屏幕」这件事得主动说一次:不说,玩家不会知道七天不打开就会丢档。
      只在 iOS 且未安装时出现,「知道了」之后永不再露(设置页里还留着一份常驻的,随时可查)。
    -->
    <InstallToHomeNotice />

    <!-- 人物水墨主视觉 -->
    <div class="card-ink relative overflow-hidden px-4 pb-4 pt-5">
      <!-- 远山 -->
      <svg class="pointer-events-none absolute inset-x-0 bottom-0 h-28 w-full text-ink/8" viewBox="0 0 400 110" preserveAspectRatio="none">
        <path
          class="drift-far"
          d="M0 110 L60 40 Q80 20 100 45 L150 95 L200 30 Q215 12 235 38 L300 100 L340 55 Q355 38 372 60 L400 90 L400 110 Z"
          fill="currentColor"
        />
        <path
          class="drift-near"
          d="M0 110 L40 80 L110 105 L180 70 L260 108 L330 80 L400 105 L400 110 Z"
          fill="currentColor"
          opacity="0.6"
        />
      </svg>
      <div class="relative z-10 flex items-start justify-between">
        <div class="min-w-0 flex-1">
          <p class="text-[11px]" :class="player.lifespanRatio < LIFESPAN_WARN_RATIO ? 'text-cinnabar' : 'text-ink-faint'">
            {{ statusText }}
          </p>
          <!-- 今日天时:确定性环境,影响当日产出与渡劫 -->
          <div class="mt-3 flex items-center gap-1.5">
            <GameIcon name="sparkles" :size="13" class="shrink-0 text-gold-ink" />
            <span class="font-kai text-[12px] tracking-widest text-ink">{{ weather.name }}</span>
            <span class="ml-1 text-[10px] text-ink-faint tabular">{{ weatherLeft }}</span>
          </div>
          <p class="mt-0.5 text-[10px] leading-relaxed text-ink-faint">
            {{ weather.desc }}<span v-if="tomorrowWeather"> · 明日{{ tomorrowWeather.name }}</span>
          </p>
        </div>
        <!-- 修炼法球 · 灵气法阵环绕 -->
        <div class="relative mr-1 -mt-1 h-35 w-35 shrink-0">
          <CultivationOrb :active="true" :full="player.expFull" :progress="player.expProgress">
            <span class="text-[17px]">☯</span>
          </CultivationOrb>
        </div>
      </div>
    </div>

    <!--
      第一步(只在开局这一段出现,见 core/firstStep):目标 / 主线 / 每日三块各指一个页签,
      却没人告诉新玩家先点哪儿 —— 这张卡把「历练 → 修为 → 突破」这条线说出来,并把入口递到手上。
    -->
    <RouterLink
      v-if="firstStep"
      :to="firstStep.to"
      class="card-ink flex items-center gap-3 border-cinnabar/40 px-4 py-3 active:scale-99"
    >
      <GameIcon name="footprints" :size="14" class="shrink-0 text-cinnabar" />
      <span class="min-w-0 flex-1">
        <span class="block font-kai text-[13px] tracking-wider text-ink">{{ firstStep.text }}</span>
        <span class="mt-0.5 block text-[10px] leading-relaxed text-ink-faint">{{ firstStep.hint }}</span>
      </span>
      <span class="shrink-0 text-[11px] text-cinnabar">{{ firstStep.label }} →</span>
    </RouterLink>

    <!-- Phase 29 修行目标:只给方向,不替玩家做决定(goal.ts 此前零展示,接线摆上主页) -->
    <div v-if="currentGoal" class="card-ink flex items-center gap-3 px-4 py-3">
      <GameIcon name="scroll" :size="14" class="shrink-0 text-jade" />
      <div class="min-w-0 flex-1">
        <p class="flex items-baseline justify-between gap-2">
          <span class="font-kai text-[13px] tracking-wider text-ink">{{ currentGoal.text }}</span>
          <span v-if="currentGoal.progress !== undefined" class="shrink-0 text-[10px] text-ink-faint tabular">
            {{ Math.round(currentGoal.progress * 100) }}%
          </span>
        </p>
        <p v-if="currentGoal.hint" class="mt-0.5 text-[10px] leading-relaxed text-ink-faint">{{ currentGoal.hint }}</p>
      </div>
    </div>

    <!-- 天界入口(真仙) -->
    <RouterLink
      v-if="player.major >= WORLD_BREAK_MAJOR"
      to="/celestial"
      class="card-ink flex items-center gap-3 border-cinnabar/40 px-4 py-3 active:scale-99"
    >
      <span class="grid h-9 w-9 place-items-center rounded-md bg-cinnabar/90 font-kai text-[17px] text-paper animate-breathe">天</span>
      <span class="min-w-0 grow">
        <span class="block font-kai text-[14px] tracking-[0.25em] text-ink">天界已开</span>
        <span class="block text-[10px] text-ink-faint">道途 · 特殊世界 · 天道熔炉 · 试炼 · 道痕</span>
      </span>
      <span class="text-[11px] text-cinnabar">踏天 →</span>
    </RouterLink>

    <!-- 修行志(任务) -->
    <section>
      <SectionTitle title="修行志" />
      <div class="card-ink mt-2 px-4 py-3">
        <template v-if="mainQuest">
          <p class="flex items-center justify-between">
            <span class="font-kai text-[13px] tracking-wider text-ink">{{ mainQuest.name }}</span>
            <span class="text-[10px] text-ink-faint">主线 {{ quests.mainIdx + 1 }}/{{ MAIN_QUESTS.length }}</span>
          </p>
          <p class="mt-0.5 text-[11px] text-ink-faint">{{ mainQuest.desc }}(达成后自动领赏)</p>
          <!--
            主线只给"要做什么"不够 —— 新手第一天靠它当路线图,得知道自己走到哪了。
            进度文案与发赏判定同源(core/questProgress 读 progress.evalCond)。
          -->
          <p v-if="mainProgress" class="mt-1 flex items-center justify-between tabular text-[11px]">
            <span :class="mainProgress.done ? 'text-jade' : 'text-ink-faint'">{{ mainProgress.text }}</span>
            <span v-if="mainProgress.ratio !== null" class="ml-2 h-1 w-16 shrink-0 overflow-hidden rounded-full bg-ink/10">
              <span
                class="block h-full rounded-full"
                :class="mainProgress.done ? 'bg-jade' : 'bg-cinnabar/70'"
                :style="{ width: `${Math.round(mainProgress.ratio * 100)}%` }"
              />
            </span>
          </p>
        </template>
        <p v-else class="text-[12px] text-ink-faint">主线已尽,前路由你自己书写。</p>
        <div class="ink-divider my-2.5" />
        <div class="space-y-1.5">
          <p v-for="t in dailyRows" :key="t.id" class="flex items-center justify-between text-[12px]">
            <span :class="t.done ? 'text-ink-faint line-through' : 'text-ink-soft'">{{ t.desc }}</span>
            <span class="tabular text-[11px]" :class="t.done ? 'text-jade' : 'text-ink-faint'">
              {{ t.done ? '已成' : `${t.progress}/${t.target}` }}
            </span>
          </p>
        </div>
      </div>
    </section>

    <!-- 洞府入口 -->
    <RouterLink to="/dongfu" class="card-ink flex items-center justify-between gap-3 px-4 py-3 active:scale-99">
      <span class="min-w-0 flex-1">
        <span class="block font-kai text-[14px] tracking-widest text-ink">洞府营造</span>
        <span class="block truncate text-[10px] leading-relaxed text-ink-faint">经营家业,道途更稳</span>
      </span>
      <span class="shrink-0 text-[12px] text-ink-faint">›</span>
    </RouterLink>

    <!-- 灵脉投资:金丹后开放,紧随洞府营造 -->
    <button
      v-if="player.major >= VEIN_UNLOCK_MAJOR"
      class="card-ink flex w-full items-center justify-between gap-3 px-4 py-3 text-left active:scale-99"
      @click="veinOpen = true"
    >
      <span class="min-w-0 flex-1">
        <span class="block font-kai text-[14px] tracking-widest text-ink">灵脉投资</span>
        <span class="block truncate text-[10px] leading-relaxed text-ink-faint">引灵脉入洞府,择一主脉而修</span>
      </span>
      <span class="shrink-0 text-[12px] text-ink-faint">›</span>
    </button>

    <!-- 灵脉弹窗:组件自带标题卡,故不画标题;但对话框自己仍要有可访问名 -->
    <BaseModal :open="veinOpen" title="" aria-label="灵脉" wide @close="veinOpen = false">
      <VeinInvestCard />
      <template #footer>
        <button class="btn-seal w-full" @click="veinOpen = false">收 起</button>
      </template>
    </BaseModal>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { usePlayerStore } from '@/stores/player'
  import { useAdventureStore } from '@/stores/adventure'
  import { useCultivationStore } from '@/stores/cultivation'
  import { useEndgameStore } from '@/stores/endgame'
  import { useQuestsStore } from '@/stores/quests'
  import { useNow } from '@/composables/useNow'
  import { MAIN_QUESTS } from '@/data/quests'
  import { VEIN_UNLOCK_MAJOR } from '@/data/constants'
  import { LIFESPAN_WARN_RATIO } from '@/data/constants'
  import { WORLD_BREAK_MAJOR } from '@/data/realms'
  import { todayWeather, upcomingWeather, weatherRemainingSec } from '@/core/weather'
  import { formatDuration } from '@/utils/format'
  import { generateCurrentGoal, type Goal } from '@/core/goal'
  import { currentMainQuestProgress } from '@/core/questProgress'
  import { currentFirstStep, homeStatusText } from '@/core/firstStep'
  import { isRetreating } from '@/core/earlyGameService'
  import { dailyRowsOf, dailyStateOf } from '@/core/engineDailies'
  import { mainQuestAt } from '@/core/engineChain'
  import SectionTitle from '@/components/common/SectionTitle.vue'
  import BaseModal from '@/components/common/BaseModal.vue'
  import VeinInvestCard from '@/components/dongfu/VeinInvestCard.vue'
  import GameIcon from '@/components/common/GameIcon.vue'
  import CultivationOrb from '@/components/common/CultivationOrb.vue'
  import InstallToHomeNotice from '@/components/common/InstallToHomeNotice.vue'

  const player = usePlayerStore()
  /** 灵脉投资弹窗 —— 卡片自洞府页移来,紧随洞府营造 */
  const veinOpen = ref(false)
  const adventure = useAdventureStore()
  const cultivation = useCultivationStore()
  const endgame = useEndgameStore()
  const quests = useQuestsStore()
  const now = useNow()

  // Phase 29 修行目标:只给方向,不替玩家做决定(goal.ts 此前零展示,接线摆上主页)
  const currentGoal = computed<Goal | null>(() => generateCurrentGoal(player))
  /** 新手第一步(开局这一段才有;给不给完全由存档推出来,没有"已看过"字段) */
  const firstStep = computed(() => currentFirstStep())

  const statusText = computed(() =>
    homeStatusText({
      dead: player.dead,
      exploringSecret: Boolean(player.secretRealm && !player.secretRealm.finished),
      expedition: Boolean(endgame.worldRun),
      sessionActive: adventure.sessionActive,
      regionName: adventure.currentRegion?.name ?? '',
      injured: cultivation.hasBuff('injury'),
      retreating: isRetreating()
    })
  )

  // Phase 31 A1:今日天时(确定性,refreshed 每游戏日)
  const weather = computed(() => todayWeather())
  /**
   * 天时的两个读数(来自库的周期层):
   *   还有多久换 —— 天时是每天一次的确定性环境,玩家该知道它什么时候变;
   *   明日是什么 —— 预告让"今天该做什么"变成可以规划的事,而不是开盲盒。
   */
  const weatherLeft = computed(() => {
    void now.value
    return `还有 ${formatDuration(weatherRemainingSec())}`
  })
  const tomorrowWeather = computed(() => upcomingWeather(2)[1])

  const mainQuest = computed(() => mainQuestAt(quests.mainIdx))
  /** 主线的进度读数(与发赏判定同源) */
  const mainProgress = computed(() => currentMainQuestProgress())

  const dailyRows = computed(() =>
    // 与发赏判定同源:进度 = 今日增量,`done` = 本期已经结算过
    dailyRowsOf(dailyStateOf(quests.daily), quests.counters)
  )
</script>
