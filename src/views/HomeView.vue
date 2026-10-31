<template>
  <div class="home-deck folio-page stagger-in" data-page-rhythm="command-deck">
    <!-- 读屏起手句:创角踏入仙途后补念「你已入此世…」,只在那一趟有值(CreateView 交接、读完即清) -->
    <p aria-live="polite" class="sr-only">{{ bootLine }}</p>
    <!--
      iOS 上「加进主屏幕」这件事得主动说一次:不说,玩家不会知道七天不打开就会丢档。
      只在 iOS 且未安装时出现,「知道了」之后永不再露(设置页里还留着一份常驻的,随时可查)。
    -->
    <InstallToHomeNotice />

    <!--
      首页不再复读一张册页封面。上半屏是游戏指挥台:
      当前身份 / 修行状态 / 今日天时 / 修为法球 / 今日一步,先让玩家知道“现在该做什么”。
    -->
    <section class="home-deck__hero" data-home-hero>
      <div class="home-deck__hero-art" aria-hidden="true">
        <span v-for="i in 11" :key="i" class="home-deck__star" :style="{ '--star': i }" />
        <svg viewBox="0 0 420 160" preserveAspectRatio="none">
          <path
            class="home-deck__hero-mountain"
            style="fill: var(--world-mountain)"
            d="M0 160 L42 113 L86 137 L139 82 L196 139 L252 96 L312 146 L356 106 L420 145 L420 160 Z"
          />
          <path d="M0 160 L64 132 L126 153 L198 119 L270 157 L338 126 L420 150 L420 160 Z" />
        </svg>
      </div>

      <header class="home-deck__hero-top">
        <p class="home-deck__eyebrow">
          <span>玄枢 · 洞府</span>
          <span aria-hidden="true">/</span>
          <span>{{ player.worldName }}</span>
        </p>
        <span class="home-deck__realm">{{ player.realmName }}</span>
      </header>

      <div class="home-deck__stage">
        <div class="home-deck__identity">
          <h1>洞府总览</h1>
          <p
            class="home-deck__status"
            :class="{ 'is-alert': player.lifespanRatio < LIFESPAN_WARN_RATIO }"
          >
            <span class="home-deck__status-dot" aria-hidden="true" />
            {{ statusText }}
          </p>
          <div class="home-deck__weather-line">
            <GameIcon name="sparkles" :size="14" />
            <strong>{{ weather.name }}</strong>
            <span class="countdown-slot tabular">{{ weatherLeft }}</span>
          </div>
          <p class="home-deck__weather-copy">{{ weather.desc }}</p>
          <p v-if="tomorrowWeather" class="home-deck__tomorrow">{{ tomorrowBrief }}</p>
          <div v-if="weatherEffects.length || weatherTribulation" class="home-deck__effects">
            <span v-for="effect in weatherEffects" :key="effect">{{ effect }}</span>
            <span v-if="weatherTribulation" class="is-danger"
              >今日渡劫 ×{{ weatherTribulation }}</span
            >
          </div>
        </div>

        <div class="home-deck__orb">
          <span class="home-deck__orb-halo" aria-hidden="true" />
          <span
            class="home-deck__orb-shadow"
            style="background: var(--world-mountain)"
            aria-hidden="true"
          />
          <CultivationOrb :active="true" :full="player.expFull" :progress="player.expProgress">
            <span class="text-[17px]">☯</span>
          </CultivationOrb>
          <p class="home-deck__orb-caption">
            <span>{{
              player.expFull ? "修为圆满" : `修为 ${formatPercent(player.expProgress, 1)}`
            }}</span>
            <span>{{ player.realmName }}</span>
          </p>
        </div>
      </div>

      <div class="home-deck__next-slot" data-home-focus>
        <RouterLink v-if="firstStep" :to="firstStep.to" class="home-deck__next active:scale-99">
          <span class="home-deck__next-tag">今日一步</span>
          <span class="home-deck__next-body">
            <span class="home-deck__next-title">{{ firstStep.text }}</span>
            <span class="home-deck__next-copy">{{ firstStep.hint }}</span>
          </span>
          <span class="home-deck__next-action">{{ firstStep.label }} →</span>
        </RouterLink>

        <component
          :is="currentGoal?.to ? RouterLink : 'div'"
          v-else-if="currentGoal"
          :to="currentGoal?.to"
          :class="currentGoal?.to ? 'active:scale-99' : ''"
          class="home-deck__next"
          data-home-goal
        >
          <span class="home-deck__next-tag">当前道途</span>
          <span class="home-deck__next-body">
            <span class="home-deck__next-title">{{ currentGoal.text }}</span>
            <span v-if="currentGoal.hint" class="home-deck__next-copy">{{ currentGoal.hint }}</span>
          </span>
          <span class="home-deck__next-action">
            <template v-if="currentGoal.progress !== undefined">{{
              formatPercent(currentGoal.progress, 0)
            }}</template>
            <template v-else-if="currentGoal.to">前往 →</template>
          </span>
        </component>

        <div v-else class="home-deck__quiet">
          <span>静</span>
          <p>眼下没有系统递来的下一步。修为、历练、行囊与人物都在底栏,按自己的路走。</p>
        </div>

        <p v-if="firstStep && currentGoal" class="home-deck__after">
          <span>其后</span>
          <span>{{ currentGoal.text }}</span>
          <span v-if="currentGoal.progress !== undefined" class="tabular">{{
            formatPercent(currentGoal.progress, 0)
          }}</span>
        </p>
      </div>
    </section>

    <div class="home-deck__board">
      <article class="home-card home-card--quest" data-home-mainquest>
        <header class="home-card__head">
          <span class="home-card__index">壹</span>
          <h2>长期道途</h2>
          <span class="home-card__rule" aria-hidden="true" />
          <span class="home-card__count tabular"
            >{{ quests.mainIdx + 1 }}/{{ MAIN_QUESTS.length }}</span
          >
        </header>
        <template v-if="mainQuest">
          <div class="home-card__body">
            <p class="home-card__eyebrow">当前主线</p>
            <h3 class="home-card__title">{{ mainQuest.name }}</h3>
            <p class="home-card__copy">{{ mainQuest.desc }}</p>
          </div>
          <div v-if="mainProgress" class="home-quest__meter">
            <div class="home-quest__meter-line">
              <span :class="mainProgress.done ? 'text-jade' : 'text-ink-soft'">{{
                mainProgress.text
              }}</span>
              <strong v-if="mainProgress.ratio !== null" class="tabular">{{
                formatPercent(mainProgress.ratio, 0)
              }}</strong>
            </div>
            <ProgressBar
              v-if="mainProgress.ratio !== null && mainProgress.ratio !== undefined"
              :value="mainProgress.ratio"
              :height="6"
              :color="mainProgress.done ? 'var(--color-jade)' : 'var(--color-cinnabar)'"
            />
          </div>
          <div class="home-quest__reward">
            <p class="home-card__eyebrow">过关赏格</p>
            <p class="home-quest__reward-value tabular">{{ rewardText(mainQuest.reward) }}</p>
            <p class="home-quest__reward-note">
              {{
                mainQuest.cond.type === "realm"
                  ? "达成时按新境界折灵石 · 自动领赏"
                  : "达成后自动领赏"
              }}
            </p>
          </div>
        </template>
        <p v-else class="home-card__quiet">主线已尽,前路由你自己书写。</p>
      </article>

      <article
        class="home-card home-card--daily"
        :class="{ 'is-complete': dailyAllDone }"
        data-home-daily
      >
        <header class="home-card__head">
          <span class="home-card__index">贰</span>
          <h2>今日日课</h2>
          <span class="home-card__rule" aria-hidden="true" />
          <span class="home-card__count tabular">{{ dailyDoneCount }}/{{ dailyRows.length }}</span>
        </header>
        <div class="home-daily__summary">
          <div
            class="home-daily__ring"
            :style="{ '--home-daily-angle': `${dailyRatio * 360}deg` }"
            aria-hidden="true"
          >
            <span>{{ dailyDoneCount }}</span>
            <small>/{{ dailyRows.length }}</small>
          </div>
          <div>
            <p class="home-daily__summary-title">
              {{ dailyAllDone ? "今日功课已结" : dailyDoneCount ? "还差几笔" : "今日从头开账" }}
            </p>
            <p class="home-daily__summary-copy">
              {{
                dailyAllDone ? "该收的都收了,可安心挂机。" : "每笔进度与奖励同格摊开,做完自动入账。"
              }}
            </p>
          </div>
        </div>
        <ul v-if="dailyRows.length" class="home-daily__list">
          <li
            v-for="(t, index) in dailyRows"
            :key="t.id"
            class="home-daily__row"
            :class="{ 'is-done': t.done }"
            :data-daily-row="t.id"
            :data-daily-done="t.done ? 'true' : 'false'"
          >
            <span class="home-daily__mark" aria-hidden="true">{{
              t.done ? "✓" : String(index + 1).padStart(2, "0")
            }}</span>
            <span class="home-daily__body">
              <span class="home-daily__copy" :class="{ 'line-through': t.done }">{{
                keepNumberUnit(t.desc)
              }}</span>
              <span class="home-daily__reward tabular">得 {{ rewardText(t.reward) }}</span>
            </span>
            <span class="home-daily__count tabular" :class="{ 'is-done': t.done }">
              {{ t.done ? "已成" : `${t.progress}/${t.target}` }}
            </span>
            <span class="home-daily__track" aria-hidden="true">
              <span
                :style="{
                  width: `${Math.min(100, (t.progress / Math.max(1, t.target)) * 100)}%`,
                }"
              />
            </span>
          </li>
        </ul>
        <p v-else class="home-card__quiet">今日没有排定日课。</p>
        <p v-if="dailyAllDone" class="home-daily__all-done">
          <span>今日已毕</span>
          日课全做完了,该收的都收了 —— 可安心挂机
        </p>
      </article>
    </div>

    <section class="home-deck__passages" data-home-passages>
      <header class="home-deck__section-head">
        <div>
          <span>叁</span>
          <h2>门径</h2>
        </div>
        <p>家业与天界,各有下一步</p>
      </header>
      <div class="home-passages__grid">
        <RouterLink to="/dongfu" class="home-passage active:scale-99" data-home-dongfu>
          <span class="home-passage__seal" aria-hidden="true">府</span>
          <span class="home-passage__body">
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
          <span class="home-passage__body">
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
/** 同一个 modsText 拆成可扫读的短签,不另造第二套天时说明。 */
const weatherEffects = computed(() => weatherModText.value.split(" · ").filter(Boolean));
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
