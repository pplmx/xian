<template>
  <div class="folio-page folio-page--stack stagger-in">
    <!-- 读屏起手句:创角踏入仙途后补念「你已入此世…」,只在那一趟有值(CreateView 交接、读完即清) -->
    <p aria-live="polite" class="sr-only">{{ bootLine }}</p>
    <!--
      iOS 上「加进主屏幕」这件事得主动说一次:不说,玩家不会知道七天不打开就会丢档。
      只在 iOS 且未安装时出现,「知道了」之后永不再露(设置页里还留着一份常驻的,随时可查)。
    -->
    <InstallToHomeNotice />

    <FolioPageHeader data-home-hero title="洞府总览" subtitle="今日天时、主线与日课" featured>
      <template #backdrop>
        <!-- 远山:墨色随世界微染(异地即异色,仍 8% 极淡、只在氛围层) -->
        <svg
          class="pointer-events-none absolute inset-x-0 bottom-0 h-28 w-full text-[color:var(--world-mountain)] opacity-8"
          viewBox="0 0 400 110"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
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
      </template>
      <template #visual>
        <div class="relative h-35 w-35">
          <!-- 落地影:球浮着也得有个「歇脚处」 —— 远山同色的淡淡一痕,把球按回画里 -->
          <span
            class="pointer-events-none absolute bottom-0 left-1/2 h-1.5 w-12 -translate-x-1/2 rounded-[50%] bg-[var(--world-mountain)] opacity-20"
            aria-hidden="true"
          />
          <CultivationOrb :active="true" :full="player.expFull" :progress="player.expProgress">
            <span class="text-[17px]">☯</span>
          </CultivationOrb>
        </div>
      </template>
      <template #meta>
        <p
          class="mt-1 font-kai text-body"
          :class="player.lifespanRatio < LIFESPAN_WARN_RATIO ? 'text-cinnabar' : 'text-ink-soft'"
        >
          {{ statusText }}
        </p>
      </template>

      <!-- 今日天时:确定性环境,影响当日产出与渡劫 -->
      <div class="border-t border-ink/10 pt-2.5">
        <div class="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <GameIcon name="sparkles" :size="13" class="shrink-0 text-gold-ink" />
          <span class="shrink-0 whitespace-nowrap font-kai text-body tracking-widest text-ink">{{
            weather.name
          }}</span>
          <span class="countdown-slot ml-1 shrink-0 text-note text-ink-faint tabular">{{
            weatherLeft
          }}</span>
        </div>
        <p class="mt-0.5 text-note leading-relaxed text-ink-soft [word-break:keep-all]">
          {{ weather.desc }}<span v-if="tomorrowWeather">{{ tomorrowBrief }}</span>
        </p>
        <!--
          天时的影响是确定性数值,却只写在散文里(「灵气恢复与修炼皆有裨益」) ——
          渡劫前一天该不该等天时,靠一句「皆有裨益」算不出来。
          效果行照 mods 真值摊开;渡劫倍率 >1 再挂一句险。
        -->
        <p v-if="weatherModText" class="mt-0.5 text-note text-ink-soft tabular">
          {{ weatherModText
          }}<span v-if="weatherTribulation"> · 今日渡劫 ×{{ weatherTribulation }}</span>
        </p>
      </div>
    </FolioPageHeader>

    <!--
      首页案头 —— 先把「今天做什么」收成一张账,再把两处长期门径压成书签。

      旧版把第一步 / 当前目标 / 天界 / 主线 / 日课 / 洞府各摆一张同权重卡,
      第一眼没有主次,日课一长就把真正的下一步推得很远。现在:
        壹 今日行止:只放系统递到眼前的那一步(第一步优先于常规目标);
        贰 主线:长期方向、阶段进度与奖励;
        叁 日课:今天的可结清事项,进度、奖励和完成态同格摊开。
      三项仍读原来的事实源,没有新增存档字段,也没有替玩家改目标。
    -->
    <section class="folio-span-all">
      <SectionTitle title="修行志" hint="今日先做一件,余下交给挂机" />
      <div class="home-desk mt-2" data-home-desk>
        <article class="home-desk__lead" data-home-focus>
          <header class="home-desk__label">
            <span class="home-desk__ordinal">壹</span>
            <span>今日行止</span>
            <span class="home-desk__rule" aria-hidden="true" />
          </header>

          <RouterLink
            v-if="firstStep"
            :to="firstStep.to"
            class="home-desk__lead-link active:scale-99"
          >
            <span class="home-desk__lead-seal" aria-hidden="true">始</span>
            <span class="min-w-0">
              <span class="home-desk__lead-title">{{ firstStep.text }}</span>
              <span class="home-desk__lead-copy">{{ firstStep.hint }}</span>
            </span>
            <span class="home-desk__lead-action">{{ firstStep.label }} →</span>
          </RouterLink>

          <component
            :is="currentGoal?.to ? RouterLink : 'div'"
            v-else-if="currentGoal"
            :to="currentGoal?.to"
            :class="currentGoal?.to ? 'active:scale-99' : ''"
            class="home-desk__lead-link"
            data-home-goal
          >
            <span class="home-desk__lead-seal" aria-hidden="true">向</span>
            <span class="min-w-0">
              <span class="home-desk__lead-title">{{ currentGoal.text }}</span>
              <span v-if="currentGoal.hint" class="home-desk__lead-copy">{{
                currentGoal.hint
              }}</span>
            </span>
            <span class="home-desk__lead-action">
              <template v-if="currentGoal.progress !== undefined">{{
                formatPercent(currentGoal.progress, 0)
              }}</template>
              <template v-else-if="currentGoal.to">前往 →</template>
            </span>
          </component>

          <div v-else class="home-desk__quiet">
            <p>眼下没有系统递来的下一步。</p>
            <p>修为、历练、行囊与人物都在底栏,按自己的路走。</p>
          </div>

          <p v-if="firstStep && currentGoal" class="home-desk__after">
            <span>其后</span>
            <span>{{ currentGoal.text }}</span>
            <span v-if="currentGoal.progress !== undefined" class="tabular">{{
              formatPercent(currentGoal.progress, 0)
            }}</span>
          </p>
        </article>

        <article class="home-desk__main" data-home-mainquest>
          <header class="home-desk__label">
            <span class="home-desk__ordinal">贰</span>
            <span>主线</span>
            <span class="home-desk__rule" aria-hidden="true" />
            <span class="home-desk__meta tabular"
              >{{ quests.mainIdx + 1 }}/{{ MAIN_QUESTS.length }}</span
            >
          </header>
          <template v-if="mainQuest">
            <h3 class="home-desk__main-title">{{ mainQuest.name }}</h3>
            <p class="home-desk__copy">{{ mainQuest.desc }}</p>
            <div class="home-desk__reward">
              <span>赏</span>
              <span class="tabular">{{ rewardText(mainQuest.reward) }}</span>
              <span>{{
                mainQuest.cond.type === "realm"
                  ? "达成时按新境界折灵石 · 自动领赏"
                  : "达成后自动领赏"
              }}</span>
            </div>
            <p v-if="mainProgress" class="home-desk__progress-line">
              <span :class="mainProgress.done ? 'text-jade' : 'text-ink-soft'">{{
                mainProgress.text
              }}</span>
              <span v-if="mainProgress.ratio !== null" class="tabular text-ink-faint">{{
                formatPercent(mainProgress.ratio, 0)
              }}</span>
            </p>
            <ProgressBar
              v-if="mainProgress?.ratio !== null && mainProgress?.ratio !== undefined"
              class="mt-1.5"
              :value="mainProgress.ratio"
              :height="4"
              :color="mainProgress.done ? 'var(--color-jade)' : 'var(--color-cinnabar)'"
            />
          </template>
          <p v-else class="home-desk__quiet">主线已尽,前路由你自己书写。</p>
        </article>

        <article class="home-desk__daily" data-home-daily>
          <header class="home-desk__label">
            <span class="home-desk__ordinal">叁</span>
            <span>今日日课</span>
            <span class="home-desk__rule" aria-hidden="true" />
            <span class="home-desk__meta tabular">{{ dailyDoneCount }}/{{ dailyRows.length }}</span>
          </header>
          <ProgressBar
            v-if="dailyRows.length"
            class="mt-1.5"
            :value="dailyRatio"
            :height="3"
            :color="dailyAllDone ? 'var(--color-jade)' : 'var(--color-cinnabar)'"
          />
          <ul v-if="dailyRows.length" class="home-desk__daily-list">
            <li
              v-for="(t, index) in dailyRows"
              :key="t.id"
              class="home-desk__daily-row"
              :class="{ 'is-done': t.done }"
              :data-daily-row="t.id"
              :data-daily-done="t.done ? 'true' : 'false'"
            >
              <span class="home-desk__daily-mark" aria-hidden="true">{{
                t.done ? "✓" : String(index + 1).padStart(2, "0")
              }}</span>
              <span class="min-w-0">
                <span class="home-desk__daily-copy" :class="{ 'line-through': t.done }">{{
                  keepNumberUnit(t.desc)
                }}</span>
                <span class="home-desk__daily-reward tabular">得 {{ rewardText(t.reward) }}</span>
              </span>
              <span
                class="home-desk__daily-count tabular"
                :class="t.done ? 'text-jade' : 'text-ink-soft'"
              >
                {{ t.done ? "已成" : `${t.progress}/${t.target}` }}
              </span>
              <span class="home-desk__daily-track" aria-hidden="true">
                <span
                  :style="{
                    width: `${Math.min(100, (t.progress / Math.max(1, t.target)) * 100)}%`,
                  }"
                />
              </span>
            </li>
          </ul>
          <p v-else class="home-desk__quiet">今日没有排定日课。</p>
          <p v-if="dailyAllDone" class="home-desk__all-done">
            <span class="chip-ink border-jade/60 text-note text-jade">今日已毕</span>
            日课全做完了,该收的都收了 —— 可安心挂机
          </p>
        </article>
      </div>
    </section>

    <section class="home-passages folio-span-all">
      <SectionTitle title="门径" hint="家业与天界,各有下一步" />
      <div class="home-passages__grid mt-2" data-home-passages>
        <RouterLink to="/dongfu" class="home-passage active:scale-99" data-home-dongfu>
          <span class="home-passage__seal" aria-hidden="true">府</span>
          <span class="min-w-0">
            <span class="home-passage__eyebrow">家业</span>
            <span class="home-passage__title">洞府营造</span>
            <span class="home-passage__copy">经营家业,道途更稳</span>
            <span class="home-passage__ledger">
              <span class="tabular text-gold-ink">离线 {{ offlineHrs }} 时</span>
              <span class="tabular">已营 {{ dongfu.builtCount }}/{{ BUILDINGS.length }}</span>
              <span v-if="player.major >= VEIN_UNLOCK_MAJOR" class="tabular"
                >灵脉 {{ dongfu.veinTotal }} 点</span
              >
            </span>
          </span>
          <span class="home-passage__action">入府 →</span>
        </RouterLink>

        <RouterLink
          v-if="player.major >= WORLD_BREAK_MAJOR"
          to="/celestial"
          class="home-passage home-passage--celestial active:scale-99"
          data-home-celestial
        >
          <span class="home-passage__seal animate-breathe" aria-hidden="true">天</span>
          <span class="min-w-0">
            <span class="home-passage__eyebrow">天界已开</span>
            <span class="home-passage__title">
              天道与道途
              <span v-if="dailyPending" class="home-passage__notice">今日天道未做</span>
            </span>
            <span class="home-passage__copy [word-break:keep-all]">
              道途 · 特殊世界 · 天道熔炉 · 试炼 · 道痕
            </span>
          </span>
          <span class="home-passage__action">踏天 →</span>
        </RouterLink>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import "@/styles/pages/home.css";
import { computed, ref, onMounted } from "vue";
import { RouterLink } from "vue-router";
import { usePlayerStore } from "@/stores/player";
import { useUiStore } from "@/stores/ui";
import { useDongfuStore } from "@/stores/dongfu";
import { BUILDINGS } from "@/data/buildings";
import { useAdventureStore } from "@/stores/adventure";
import { useCultivationStore } from "@/stores/cultivation";
import { useEndgameStore } from "@/stores/endgame";
import { useQuestsStore } from "@/stores/quests";
import { useNow } from "@/composables/useNow";
import { MAIN_QUESTS } from "@/data/quests";
import { VEIN_UNLOCK_MAJOR } from "@/data/constants";
import { LIFESPAN_WARN_RATIO } from "@/data/constants";
import { WORLD_BREAK_MAJOR } from "@/data/realms";
import { todayWeather, upcomingWeather, weatherRemainingSec } from "@/core/weather";
import { formatCountdown, formatPercent } from "@/utils/format";
import { generateCurrentGoal, type Goal } from "@/core/goal";
import { currentMainQuestProgress } from "@/core/questProgress";
import { currentFirstStep, homeStatusText } from "@/core/firstStep";
import { rewardText } from "@/core/progress";
import { modsText } from "@/data/statNames";
import { isRetreating } from "@/core/earlyGameService";
import { dailyRowsOf, dailyStateOf } from "@/core/engineDailies";
import { todayChallenge } from "@/core/dailyChallenge";
import { mainQuestAt } from "@/core/engineChain";
import FolioPageHeader from "@/components/common/FolioPageHeader.vue";
import SectionTitle from "@/components/common/SectionTitle.vue";
import GameIcon from "@/components/common/GameIcon.vue";
import ProgressBar from "@/components/common/ProgressBar.vue";
import CultivationOrb from "@/components/common/CultivationOrb.vue";
import InstallToHomeNotice from "@/components/common/InstallToHomeNotice.vue";

const player = usePlayerStore();
const ui = useUiStore();
/** 创角→首页的读屏起手句:灵根鉴定定格播报被路由跳转切断了,这里补念(读完即清) */
const bootLine = ref("");
onMounted(() => {
  if (ui.worldEnter) {
    bootLine.value = ui.worldEnter;
    ui.worldEnter = null;
  }
});
const dongfu = useDongfuStore();
/** 洞府入口右侧实况:离线可攒小时 + 已营座数 —— 座数读 store 的 builtCount(与洞府页同源) */
const offlineHrs = computed(() => dongfu.offlineCapHours);
/** 灵脉投资弹窗 —— 卡片自洞府页移来,紧随洞府营造 */
const adventure = useAdventureStore();
const cultivation = useCultivationStore();
const endgame = useEndgameStore();
/** 天界的今日天道还没做(每日挑战,过了今日就丢)—— 首页那一行要报出来 */
const dailyPending = computed(() => {
  if (player.major < WORLD_BREAK_MAJOR || !endgame.daoPath) return false;
  const d = todayChallenge();
  return !!d && endgame.dailyDoneDay !== d.day;
});
const quests = useQuestsStore();
const now = useNow();

// Phase 29 修行目标:只给方向,不替玩家做决定(goal.ts 此前零展示,接线摆上主页)
const currentGoal = computed<Goal | null>(() => generateCurrentGoal(player));
/** 新手第一步(开局这一段才有;给不给完全由存档推出来,没有"已看过"字段) */
const firstStep = computed(() => currentFirstStep());

const statusText = computed(() =>
  homeStatusText({
    dead: player.dead,
    exploringSecret: Boolean(player.secretRealm && !player.secretRealm.finished),
    expedition: Boolean(endgame.worldRun),
    sessionActive: adventure.sessionActive,
    regionName: adventure.currentRegion?.name ?? "",
    injured: cultivation.hasBuff("injury"),
    retreating: isRetreating(),
    expFull: player.expFull,
  }),
);

// Phase 31 A1:今日天时(确定性,refreshed 每游戏日)
const weather = computed(() => todayWeather());
/** 天时的确定效果(照 mods 真值摊开;清和这类无词条的不显行) */
const weatherModText = computed(() => modsText(weather.value.mods));
/** 渡劫倍率 >1 才挂"更险"(仅雷鸣/仙劫日等) */
const weatherTribulation = computed(() =>
  weather.value.tribulationMult > 1 ? weather.value.tribulationMult : null,
);
/**
 * 天时的两个读数(来自库的周期层):
 *   还有多久换 —— 天时是每天一次的确定性环境,玩家该知道它什么时候变;
 *   明日是什么 —— 预告让"今天该做什么"变成可以规划的事,而不是开盲盒。
 *
 * 措辞用「尚需修行」而不是「还有」:天时的周期序号来自 `totalPlaySec`
 * (游戏内已游玩时长),不是墙钟 —— 挂机一晚不换天,只在真玩的那段时间里走。
 * 这是 DEC-120 的纪律(序号来自游戏内时长、不碰现实时间:改系统时间/跨时区/
 * 挂机一夜都不该换天)。写成「还有 5 小时」会让玩家以为关掉页面五小时回来天就变了,
 * 而实际一秒都没走 —— 措辞要说清这是「还要修多久」,不是「现实还要等多久」。
 */
const weatherLeft = computed(() => {
  void now.value;
  return `尚需修行 ${formatCountdown(weatherRemainingSec())}`;
});
const tomorrowWeather = computed(() => upcomingWeather(2)[1]);
/**
 * 下一天时的影响也摊开(与今日同源 modsText;渡劫倍率 >1 才挂更险)——
 * 渡劫前该不该等它要看得见。措辞用「下一天时」而不是「明日」:
 * 它按游玩时长翻页(见上面 weatherLeft 的注释),写成「明日」会被读成
 * 「现实明天」,而挂机一夜并不会换来它。
 */
const tomorrowBrief = computed(() => {
  const t = tomorrowWeather.value;
  if (!t) return "";
  const mod = modsText(t.mods);
  const trib = t.tribulationMult > 1 ? ` · 渡劫×${t.tribulationMult}` : "";
  return ` · 下一天时${t.name}${mod ? `(${mod}${trib})` : ""}`;
});

const mainQuest = computed(() => mainQuestAt(quests.mainIdx));
/** 主线的进度读数(与发赏判定同源) */
const mainProgress = computed(() => currentMainQuestProgress());

const dailyRows = computed(() =>
  // 与发赏判定同源:进度 = 今日增量,`done` = 本期已经结算过
  dailyRowsOf(dailyStateOf(quests.daily), quests.counters),
);
/** 今日日课是否全毕:三条各结清才算(不给唯一解 —— 没定义日课就不报) */
const dailyAllDone = computed(
  () => dailyRows.value.length > 0 && dailyRows.value.every((r) => r.done),
);
const dailyDoneCount = computed(() => dailyRows.value.filter((r) => r.done).length);
const dailyRatio = computed(() =>
  dailyRows.value.length ? dailyDoneCount.value / dailyRows.value.length : 0,
);
/** 两列日课里「3 次」不许拆成两行:只锁数字与紧随其后的量词,其余文案照常折行。 */
function keepNumberUnit(text: string): string {
  return text.replace(/(\d[\d,.]*)\s+(?=[石铁尘株张载年次件层场阶枚缕时日])/g, "$1\u00a0");
}
</script>
