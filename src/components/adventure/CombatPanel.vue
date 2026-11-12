<template>
  <div class="combat-desk" data-combat-desk data-combat-ledger>
    <section class="combat-session" data-combat-session aria-label="征途簿">
      <header class="combat-session__head">
        <div class="combat-session__identity">
          <span class="combat-session__seal" aria-hidden="true">战</span>
          <div class="combat-session__copy">
            <p class="combat-session__eyebrow">征途簿 · {{ modeName }}</p>
            <h1 class="combat-session__region" data-combat-region>{{ region?.name }}</h1>
          </div>
        </div>
        <p class="combat-session__clock" data-combat-clock>
          <span>余</span>
          <strong class="countdown-slot tabular">{{ formatCountdown(timeLeft) }}</strong>
        </p>
      </header>

      <p
        v-if="bossHint"
        class="combat-session__goal"
        data-combat-goal
        :class="bossSoon ? 'is-urgent' : ''"
      >
        {{ bossHint }}
      </p>

      <div class="combat-session__stats" data-combat-stats>
        <div v-for="stat in sessionStats" :key="stat.id" :data-combat-stat="stat.id">
          <span>{{ stat.label }}</span>
          <strong class="tabular">{{ stat.value }}</strong>
        </div>
      </div>

      <div v-if="streakLine || gains" class="combat-session__gains">
        <p v-if="streakLine" class="is-gold tabular">{{ streakLine }}</p>
        <p v-if="gains" class="tabular">
          本次所得 <span>灵石</span>
          <strong class="text-gold-ink">+{{ gains.stone }}</strong>
          <span>修为</span>
          <strong class="text-jade">+{{ gains.exp }}</strong>
          <!--
            器灵尘 —— 行囊满或智能留取把某件判为不值留时,那件当场折成尘。
            它是"玩家没看见就已经没了"的那部分,这一行是唯一能知道它变成了什么的地方。
            与悟道点同一条纪律(见 types 的 AdventureSession.wudaoGain 注释)。
          -->
          <template v-if="gains.dust > 0">
            <span>器灵尘</span>
            <strong class="text-qing" data-combat-dust>+{{ formatGN(gains.dust) }}</strong>
          </template>
        </p>
      </div>
    </section>

    <section class="combat-arena" data-combat-arena aria-label="战局">
      <header class="combat-arena__head">
        <span>战局</span>
        <small>敌我 · 回放 · 近战情报</small>
      </header>

      <!--
        这一处地界的山水 —— 战局是全作停留时间最长的一屏,而它此前完全是一张
        白纸上的字。底图读当前地界的图标(见 ui/sceneTerrain),故在雪岭里打
        与在江边打,抬头看见的不是同一幅画。

        只做背景(veil):绝对定位、pointer-events:none、不占布局。战局这一块的
        每一寸都排着名号、气血、章与战报,任何一寸被挤走都会把「战报进首屏」
        那条判据撞红(390 上战报顶必须 < 屏高 − 76)。
      -->
      <InkScene
        class="combat-arena__scene"
        :world-id="player.world.id"
        :icon="region?.icon"
        :marks="'ground'"
      />
      <div class="combat-arena__body">
        <div class="combat-duel">
          <div
            class="combat-combatant combat-combatant--foe"
            data-combat-foe
            :class="[
              shakeCls.e,
              strikeCls.e,
              flickerCls.e,
              shieldCls.e,
              defeated === 'e' ? 'foe-defeated' : '',
            ]"
          >
            <div :key="battle?.at" class="enemy-enter">
              <div class="combat-combatant__line">
                <span
                  class="combat-combatant__icon"
                  :class="battle?.isBoss ? 'is-boss animate-glow-pulse' : ''"
                >
                  <GameIcon :name="battle?.enemyIcon ?? 'paw'" :size="18" />
                </span>
                <div class="combat-combatant__body">
                  <p class="combat-combatant__name">
                    <template v-if="battle">
                      <span
                        data-foe-name
                        class="whitespace-nowrap"
                        :class="battle?.isBoss ? 'text-cinnabar' : ''"
                        >{{ battle.enemyName }}</span
                      >
                    </template>
                    <template v-else>
                      <span class="whitespace-nowrap">搜寻猎物中</span>
                      <span class="ink-dots text-ink-faint">
                        <span />
                        <span />
                        <span />
                      </span>
                      <!--
                        「下一战还要多久」—— 这个数一直都在会话里(nextBattleAt),
                        六处写、零处读。于是屏上只有一句「搜寻猎物中」加三点省略号,
                        分不出「正在等」与「卡住了」。首战固定等 12 秒,四小时档要等
                        一千多次,每一回都只能干看着。

                        倒数到 0 时不写「0 秒」—— 那一瞬正是战斗开打、敌人名字换上来的
                        同一拍,写个 0 只会闪一下;低于 1 秒就整句收起。
                      -->
                      <span
                        v-if="nextBattleIn > 0"
                        data-combat-next
                        class="combat-combatant__next tabular"
                      >
                        <span class="countdown-slot">{{ formatCountdown(nextBattleIn) }}</span>
                        <span class="combat-combatant__next-unit">后现身</span>
                      </span>
                    </template>
                    <span v-if="foeAdaptation" class="combat-combatant__stars">
                      <button
                        type="button"
                        class="tap-row -my-2 -ml-1 px-1 active:opacity-60"
                        :aria-expanded="adaptTap === foeAdaptation.stars"
                        @click="
                          adaptTap = adaptTap === foeAdaptation.stars ? null : foeAdaptation.stars
                        "
                      >
                        {{ starsText(foeAdaptation.stars) }}
                      </button>
                    </span>
                  </p>
                  <p v-if="adaptReveal" class="combat-combatant__reason tabular">
                    {{ adaptReveal }}
                  </p>
                  <!--
                    这一块的显示与否 = `combatantChips` 是否为空,块内渲染的也是它。
                    从前这里写的是 `isBoss || isNemesisFoe || shownTraits.length` ——
                    那串「每一枚章的条件之或」正是第 42 / 43 轮两次踩坑的根因:
                    加一枚新章忘了改它,屏幕上一片空白,而编译、类型、单测全绿。
                    现在条件与内容同源,构造上不可能不一致(见 ui/combatChips)。
                  -->
                  <p v-if="combatantChips.length" class="combat-combatant__chips">
                    <span
                      v-for="chip in combatantChips"
                      :key="chip.id"
                      class="chip-ink text-note"
                      :class="chipClass(chip)"
                      :data-combat-nemesis="chip.id === 'nemesis' ? '' : undefined"
                      :data-combat-first-sight="chip.id === 'firstSight' ? '' : undefined"
                      :data-combat-nemesis-avenged="chip.id === 'avenged' ? '' : undefined"
                      >{{ chipText(chip) }}</span
                    >
                  </p>
                  <ProgressBar
                    :value="ehp"
                    color="var(--color-cinnabar)"
                    :height="7"
                    class="combat-combatant__bar"
                  />
                </div>
              </div>
              <div
                v-if="battle?.isBoss"
                class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
              >
                <span class="boss-reveal combat-boss-reveal font-kai">此地之主 · 现身</span>
              </div>
            </div>
            <span
              v-for="f in floats.filter((x) => x.side === 'e')"
              :key="f.id"
              class="combat-float tabular font-kai"
              :class="
                f.crit
                  ? 'animate-float-crit combat-float--crit'
                  : 'animate-float-dmg combat-float--foe'
              "
            >
              {{ f.text }}
            </span>
          </div>

          <div class="combat-duel__axis" aria-hidden="true">
            <span>敌</span>
            <i />
            <span>我</span>
          </div>

          <div
            class="combat-combatant combat-combatant--player"
            data-combat-player
            :class="[
              shakeCls.p,
              strikeCls.p,
              flickerCls.p,
              shieldCls.p,
              defeated === 'p' ? 'foe-defeated' : '',
            ]"
          >
            <div class="combat-combatant__line">
              <span
                class="combat-combatant__icon"
                :class="defeated === 'e' ? 'foe-victorious' : ''"
              >
                <GameIcon name="user" :size="18" />
              </span>
              <div class="combat-combatant__body">
                <p class="combat-combatant__name">{{ player.name }}</p>
                <ProgressBar
                  :value="php"
                  color="var(--color-jade)"
                  :height="7"
                  class="combat-combatant__bar"
                  :class="hpBelowLine ? 'ring-1 ring-cinnabar/40' : ''"
                />
                <p
                  v-if="hpBelowLine"
                  class="combat-combatant__warning"
                  :class="lowHpGimmick ? 'text-cinnabar' : 'text-ink-faint'"
                >
                  {{ lowHpGimmick ? "三成以下 · 背水/破釜类效果此刻生效" : "气血已降至三成以下" }}
                </p>
              </div>
            </div>
            <span
              v-for="f in floats.filter((x) => x.side === 'p')"
              :key="f.id"
              class="combat-float tabular font-kai"
              :class="
                f.crit
                  ? 'animate-float-crit combat-float--crit'
                  : 'animate-float-dmg combat-float--player'
              "
            >
              {{ f.text }}
            </span>
          </div>
        </div>

        <div class="combat-report" data-combat-report>
          <header class="combat-report__head">
            <div>
              <span>战报</span>
              <small v-if="battleLogTotal > 0" class="tabular">
                {{ Math.min(displayed.length, battleLogTotal) }} / {{ battleLogTotal }} 行
              </small>
              <small v-else>山风掠过,四下无声</small>
            </div>
            <button
              v-if="!playbackDone"
              type="button"
              class="combat-report__skip tap-row"
              @click="skipPlayback"
            >
              跳过播放 »
            </button>
          </header>
          <div
            ref="logBox"
            class="scroll-pane combat-report__scroll"
            :class="playbackDone ? 'is-done' : 'is-playing'"
            role="log"
            aria-label="战斗回放"
            aria-live="polite"
            aria-relevant="additions text"
          >
            <p
              v-for="(entry, i) in displayed"
              :key="i"
              data-battle-log
              class="combat-report__line text-body"
              :data-log-kind="entry.t"
              :data-log-quality="logQualityAttr(entry.quality)"
              :style="entry.quality ? logQualityStyle(entry.quality) : undefined"
            >
              <span>{{ entry.text }}</span>
              <strong
                v-if="entry.dmg"
                class="combat-report__damage tabular"
                :class="entry.t === 'crit' ? 'text-cinnabar' : ''"
                >{{ entry.dmg }}</strong
              >
            </p>
            <p v-if="displayed.length === 0" class="combat-report__empty text-body">
              山风掠过,四下无声……
            </p>
          </div>
        </div>

        <BattleIntelPanel />
      </div>
    </section>

    <!--
      收兵回府 —— 本作**唯一**会退出历练的动作,从前一键即走。

      按下去之前没有任何地方说得出「这一趟算不算数」,而按下之后只有一条 2.6 秒的
      提示条飘过去。而门槛确实存在(见 EXPLORE_TRIP_MIN_BATTLES):不满 3 场的收兵
      **不计入**「完成历练」—— 而成就「行万里路 / 踏遍山河」、日课「每日历练」、
      人生主题全读那个计数。玩家攒了 2 场手动收兵,以为走完一趟,实际什么也没算。

      同仓别的不可逆动作都做了二段式并摊开后果(远征「确认中道而返」、秘境「确认弃境」),
      只有这个最高频的是一键走。现在补齐,并把「本趟几场、算不算」摊在确认行里 ——
      这个数用 sessionRecordText,与收尾播报同一份实现,不另拼一遍。
    -->
    <div class="combat-actions">
      <template v-if="!leaveArmed">
        <button class="btn-ghost combat-actions__stop text-body" @click="leaveArmed = true">
          收兵回府
        </button>
      </template>
      <template v-else>
        <p class="combat-actions__ask text-note" data-combat-leave-ask>
          {{ leaveAskText }}
        </p>
        <div class="combat-actions__armed">
          <button class="btn-ghost flex-1 text-body" @click="leaveArmed = false">再想想</button>
          <button class="btn-seal flex-1 text-body" data-combat-leave-confirm @click="confirmLeave">
            确认收兵
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, useTemplateRef, watch, onUnmounted } from "vue";
import { useAdventureStore } from "@/stores/adventure";
import { usePlayerStore } from "@/stores/player";
import { useSettingsStore } from "@/stores/settings";
import { stopExploration, winsUntilRegionBoss } from "@/core/exploration";
import {
  COMBAT_PLAYBACK_BASE_MS,
  COMBAT_PLAYBACK_MIN_MS,
  EXPLORE_MODES,
  EXPLORE_TRIP_MIN_BATTLES,
  LOW_HP_THRESHOLD,
} from "@/data/constants";
import { WIN_STREAK_REWARDS } from "@/data/earlyGame";
import { formatCountdown, formatGN } from "@/utils/format";
import { useNow } from "@/composables/useNow";
import {
  detectionAdaptation,
  enemyTraits,
  starsText,
  TRAIT_NAMES,
  type RegionEcology,
} from "@/core/buildAdvisor";
import { detectBuild } from "@/core/buildDetect";
import { sessionRecordText, sessionStatRows } from "@/ui/adventureText";
import { enemyDef } from "@/data/enemies";
import { enemyLoreView } from "@/ui/enemyLore";
import type { CombatLogEntry } from "@/types";
import ProgressBar from "@/components/common/ProgressBar.vue";
import GameIcon from "@/components/common/GameIcon.vue";
import BattleIntelPanel from "@/components/adventure/BattleIntelPanel.vue";
import InkScene from "@/components/common/InkScene.vue";
import { nemesisAvengedText, nemesisChipText } from "@/ui/nemesisChip";
import { chipsOf, type CombatChip } from "@/ui/combatChips";
import { logQualityTone } from "@/ui/combatLogTone";
import { qualityDef } from "@/data/qualities";
import type { QualityId } from "@/types";

/**
 * 战报一行的品阶色 —— 只用在该档真写着色的那几个 token 上。
 *
 * 与 flashTier / toastLife 同一条理由:品质表里是 `var(--color-*)` 调色板 token,
 * 纯函数求不了值,故由界面在这里取一次。
 * 寻常档(color 为 ink-faint 那类)不描色 —— 战报密排几十行,人人有色就等于无色。
 */
/**
 * 品阶落点 —— **只有真染了色才挂**。
 *
 * 凡品与老战报都走 `plain`(不着色),它们的行上不该有 `data-log-quality`:
 * 那道属性是"这一行比寻常重"的记号,人人有记号就等于没有记号。
 */
function logQualityAttr(quality: QualityId | undefined): string | undefined {
  if (!quality) return undefined;
  const tone = logQualityTone(quality);
  return tone === "plain" ? undefined : tone;
}

function logQualityStyle(quality: QualityId): Record<string, string> | undefined {
  const tone = logQualityTone(quality);
  if (tone === "plain") return undefined;
  return { "--log-quality": qualityDef(quality).color };
}

const adventure = useAdventureStore();
const player = usePlayerStore();
const settings = useSettingsStore();
const now = useNow();

const displayed = ref<CombatLogEntry[]>([]);

/**
 * 回放是否已经播完 —— 战报框的「高度」由它决定。
 *
 * 框从前是死高 `h-48`:播放中不许跳是对的(逐行投入,高度一变整页在抖),
 * 可**播完之后仍占着 192px**,三行的战斗底下留着三行半的虚空 ——
 * 一屏里最大的一块留白,恰好什么也没说。
 *
 * 故播完就换成 `max-h-48`:内容多长框多长,超过照旧滚。空战报(还没开打)
 * 走 `displayed.length === 0`,此时不为 done,仍是死高,占位文案不会塌。
 */
const playbackDone = computed(() => {
  const total = battle.value?.result.log.length ?? 0;
  // displayed 只留最近 100 行,长战斗的 total 会更大 —— 取两者的小值比较
  return total > 0 && displayed.value.length >= Math.min(total, 100);
});
const battleLogTotal = computed(() => Math.min(battle.value?.result.log.length ?? 0, 100));

const php = ref(1);
const ehp = ref(1);
const floats = ref<{ id: number; text: string; side: "p" | "e"; crit: boolean }[]>([]);
const shakeCls = ref<{ p: string; e: string }>({ p: "", e: "" });
/** 闪避侧移:躲开 ≠ 挨打 —— 受击方不震颤,而是身形一晃侧让(见 flicker 帧) */
const flickerCls = ref<{ p: string; e: string }>({ p: "", e: "" });
/** 护盾成形:开启护盾的一方筑起金色屏壁(见 shield-rise 帧) */
const shieldCls = ref<{ p: string; e: string }>({ p: "", e: "" });
/**
 * 攻击方的横踏:浮伤与震颤都在受击方,「谁在出手」此前毫无动作 ——
 * 同一因果环只剩下受击那半边,这半边(出手)补上才成环。
 */
const strikeCls = ref<{ p: string; e: string }>({ p: "", e: "" });
const defeated = ref<"p" | "e" | null>(null);
const logBox = useTemplateRef<HTMLElement>("logBox");

let playTimer: number | undefined;
let floatSeq = 1;

const session = computed(() => adventure.session);
const region = computed(() => adventure.currentRegion);
const battle = computed(() => adventure.lastBattle);
const timeLeft = computed(() =>
  session.value ? Math.max(0, (session.value.endsAt - now.value) / 1000) : 0,
);
const modeName = computed(() => (session.value ? EXPLORE_MODES[session.value.mode].name : ""));

/**
 * 距下一场交手的秒数。
 *
 * `nextBattleAt` 是会话里早就存着的绝对时间戳(引擎每 tick 拿它比对),
 * 但界面从来没读过它 —— 于是「搜寻猎物中」那种等待看上去与「卡住了」一模一样。
 * 与整趟倒计时共用 `useNow` 的秒级心跳,故它真的在走。
 *
 * 已经到点(`<= 0`)时返回 0,由模板整句收起:那一拍正是战斗换上新敌人名的同一帧。
 */
/**
 * 收兵的第二步是否已武装 —— 与远征「中道而返」、秘境「弃境」同一条交互纪律。
 * 「收兵」是本作唯一会退出历练的动作,而它有一个玩家看不见的门槛(满 3 场才计一次)。
 */
const leaveArmed = ref(false);

/**
 * 武装之后的确认行:这一趟打了什么、算不算数。
 *
 * 门槛从 `EXPLORE_TRIP_MIN_BATTLES` 现取,与结算里 `track("explores")` 同一个数 ——
 * 文案里写死的「3」会在改常数那天变成假话。
 */
const leaveAskText = computed(() => {
  const s = session.value;
  if (!s) return "";
  const fought = s.wins + s.losses;
  const record = sessionRecordText(s);
  if (fought >= EXPLORE_TRIP_MIN_BATTLES) {
    return `本趟${record} —— 已足 ${EXPLORE_TRIP_MIN_BATTLES} 场,收兵计为一次历练;余下时段不再交兵。`;
  }
  return `本趟${record} —— 未满 ${EXPLORE_TRIP_MIN_BATTLES} 场,收兵不计为一次历练(成就与日课都不认)。`;
});

function confirmLeave(): void {
  leaveArmed.value = false;
  stopExploration("manual");
}

const nextBattleIn = computed(() => {
  const s = session.value;
  if (!s) return 0;
  return Math.max(0, Math.ceil((s.nextBattleAt - now.value) / 1000));
});
const sessionStats = computed(() => sessionStatRows(session.value));

/** 连胜与下一档赏赐:冲档要有距离感 —— 3/5/10 档的赏赐发给谁,先得让人看得见自己在几连胜 */
const streakLine = computed(() => {
  const s = player.winStreak;
  if (s <= 0) return "";
  const next = WIN_STREAK_REWARDS.find((r) => r.streak > s);
  return next
    ? `连胜 ${s} 场 · 距下一档赏赐还差 ${next.streak - s} 场`
    : `连胜 ${s} 场 · 已至连胜终赏`;
});

/**
 * 背水血线:我方生命跌过三成 —— 血条转危色,顺带把「此刻谁在生效」说出来。
 * 阈值只从 combat.ts 的 LOW_HP_THRESHOLD 取,视图这边不写第二份 0.3;
 * 破釜丹(buff_pofu)与背水一击系词缀都挂在 lowHpDamage / lowHpReduction 上,
 * 有其一,即说明这套效果此刻真的在咬人 —— 不再是白挂着却看不见的隐形 buff。
 */
const hpBelowLine = computed(() => php.value > 0 && php.value < LOW_HP_THRESHOLD);
const lowHpGimmick = computed(() => {
  const m = player.finalStats.mods;
  return (m.lowHpDamage ?? 0) > 0 || (m.lowHpReduction ?? 0) > 0;
});

/** 本次历练已得(灵石/修为)—— 取自会话里如实累计的入账数,不是期望值 */
const gains = computed(() => {
  const s = session.value;
  if (!s) return null;
  return {
    stone: formatGN(s.stoneGain),
    exp: formatGN(s.expGain),
    /*
     * 器灵尘保留原始值(判空用),展示时与灵石/修为走同一个 formatGN。
     * 「本次所得」是一场会话的**累计**,而最长的长线云游是 4 小时(上千场),
     * 累计到五位数是正常量级;那时灵石写着「+1.2亿」、尘写着「+123456」,
     * 同一行读起来是两个世界。
     */
    dust: Math.max(0, Math.floor(s.dustGain ?? 0)),
  };
});

/** 距区域之主还差几胜(已靖的地界不再提示) */
const bossIn = computed(() => {
  const s = session.value;
  const r = region.value;
  if (!s || !r) return null;
  // 门槛认的是这一地界的**累计**胜场(战败结束整趟,但进度不清零)—— 见 core/exploration
  return winsUntilRegionBoss(adventure.winsIn(r.id), adventure.cleared.includes(r.id));
});
const bossSoon = computed(() => bossIn.value !== null && bossIn.value <= 0);
const bossHint = computed(() => {
  const n = bossIn.value;
  if (n === null) return null;
  return n > 0 ? `距此地之主还差 ${n} 胜` : "此地之主将现 —— 下一战即是首领";
});

/** 当前敌人的机制特性标签 */
const foeTraits = computed(() => {
  const id = battle.value?.enemyId;
  if (!id) return [];
  const def = enemyDef(id);
  return def ? enemyTraits(def) : [];
});

/** 此物所知的认知层读数(敌名行/标签行的「眼熟门」与适配星级都挡在这道门上);
 *  情报面板的展开块自持一份(enemyLoreView 是纯读函数,两处同源不算两本账) */
const lore = computed(() => {
  const id = battle.value?.enemyId;
  return id ? enemyLoreView(id) : null;
});

/**
 * 认得它,才谈得上"知道它会怎么打"。
 * 交过一场手即达「眼熟」,所以这道门只挡第一次照面 —— 那一次本就该是未知的。
 */
const foeKnown = computed(() => (lore.value?.stage ?? 0) >= 1);

const shownTraits = computed(() => (foeKnown.value ? foeTraits.value : []));

/** 适配星级点开的理由(与方向理由同族,换敌复位) */
const adaptTap = ref<number | null>(null);
const adaptReveal = computed(() =>
  adaptTap.value === null || !foeAdaptation.value ? null : foeAdaptation.value.reasons.join(" · "),
);

/** 宿敌标记:此敌曾败我 ≥3 次且尚未雪耻 */

/** 这一场的对手在宿敌账上的记录 —— 章与雪耻那句都从它取 */
const nemesisRecord = computed(() => {
  const id = battle.value?.enemyId;
  if (!id) return null;
  return player.nemeses.find((n) => n.enemyId === id) ?? null;
});
/** 未雪耻时的章文案(不到门槛或已雪耻时为空,章不渲染) */
const nemesisChip = computed(() =>
  nemesisRecord.value ? nemesisChipText(nemesisRecord.value) : "",
);
/** 这一场的对手是不是头一回遇见 —— 判定是纯的,登记在结算处 */
const firstSight = computed(() => battle.value?.firstSight === true);

/**
 * 该显示哪几枚章 —— 块的显示与否与块内的内容**都读它**。
 * 这一处是本轮的重点:从前那个 v-if 是"每枚章条件之或",加一枚章忘了改就是一片空白。
 */
const combatantChips = computed(() =>
  chipsOf({
    isBoss: Boolean(battle.value?.isBoss),
    nemesis: nemesisChip.value,
    traits: shownTraits.value,
    firstSight: firstSight.value,
    avenged: nemesisAvenged.value,
  }),
);

/** 每枚章的样式 —— 与原来那几枚各写一份 class 的观感一致 */
function chipClass(chip: CombatChip): string {
  switch (chip.id) {
    case "boss":
      return "border-cinnabar/60 text-cinnabar";
    case "nemesis":
      return "border-cinnabar/80 bg-cinnabar/6 text-cinnabar";
    case "firstSight":
    case "avenged":
      return "border-jade/60 text-jade";
    default:
      return "border-violet-ink/50 text-violet-ink";
  }
}

/** 每枚章写什么字 */
function chipText(chip: CombatChip): string {
  switch (chip.id) {
    case "boss":
      return "首领";
    case "nemesis":
      return nemesisChip.value;
    case "firstSight":
      return "初见";
    case "avenged":
      return nemesisAvenged.value;
    default:
      return chip.traitId ? (TRAIT_NAMES[chip.traitId as keyof typeof TRAIT_NAMES] ?? "") : "";
  }
}
/** 雪耻之后那一句 */
const nemesisAvenged = computed(() =>
  nemesisRecord.value ? nemesisAvengedText(nemesisRecord.value) : "",
);

/** 当前构筑对此敌的适配(战力之外的胜负参考) */
const foeAdaptation = computed(() => {
  const b = battle.value;
  if (!b || !foeKnown.value) return null;
  const build = detectBuild(player.finalStats.mods);
  if (!build) return null;
  const eco: RegionEcology = { burst: 0, multi: 0, pierce: 0, dodge: 0 };
  for (const t of foeTraits.value) eco[t] = 2;
  return detectionAdaptation(build, eco, b.isBoss);
});

function stopPlayback(): void {
  if (playTimer !== undefined) {
    window.clearInterval(playTimer);
    playTimer = undefined;
  }
}

function playBattle(instant = false): void {
  const b = battle.value;
  if (!b) return;
  // 关动效时直接给结果,不逐条播 —— 与 GauntletPanel 同一待遇。此回放是 JS 驱动
  // (setInterval 逐行投入),style.css 的 .reduce-motion 只压 CSS 动画,盖不住它,
  // 所以得在这里显式判。不然每次历练开打,关动效的人也被迫逐条看。
  if (settings.reduceMotion && !instant) {
    playBattle(true);
    return;
  }
  stopPlayback();
  defeated.value = null;
  const entries = b.result.log;
  if (instant) {
    displayed.value = entries.slice(-100);
    const last = entries[entries.length - 1];
    php.value = last?.php ?? 1;
    ehp.value = last?.ehp ?? 1;
    defeated.value = b.result.win ? "e" : "p";
    return;
  }
  displayed.value = [];
  php.value = 1;
  ehp.value = 1;
  let idx = 0;
  const interval = Math.max(COMBAT_PLAYBACK_MIN_MS, COMBAT_PLAYBACK_BASE_MS / settings.battleSpeed);
  playTimer = window.setInterval(() => {
    const entry = entries[idx];
    if (!entry) {
      stopPlayback();
      defeated.value = b.result.win ? "e" : "p";
      return;
    }
    displayed.value = [...displayed.value.slice(-99), entry];
    php.value = entry.php;
    ehp.value = entry.ehp;
    if (entry.dmg) {
      const id = floatSeq;
      floatSeq += 1;
      floats.value = [
        ...floats.value.slice(-5),
        {
          id,
          text: `-${entry.dmg}`,
          side: entry.side === "p" ? "e" : "p",
          crit: entry.t === "crit",
        },
      ];
      setTimeout(() => {
        floats.value = floats.value.filter((f) => f.id !== id);
      }, 900);
      // 受击方原样震颤(既有),攻击方同步横踏 —— 出手与挨打才成一对
      triggerShake(entry.side === "p" ? "e" : "p", entry.t === "crit");
      triggerStrike(entry.side);
    }
    // 闪避:攻击方照常横踏(出手是出手了),受击方却身形一晃侧让而非挨震 ——
    // 躲开和被打中是两种画面,不许让闪避也走震颤(那是"打中了"的反馈)
    if (entry.t === "dodge") {
      triggerStrike(entry.side);
      triggerFlicker(entry.side === "p" ? "e" : "p");
    }
    // 护盾成形:开启护盾的一方筑起屏壁 —— 给一道金色环光(shield 行无出手方,只亮护盾方)
    if (entry.t === "shield" && (entry.side === "p" || entry.side === "e")) {
      triggerShield(entry.side);
    }
    requestAnimationFrame(() => {
      logBox.value?.scrollTo({ top: logBox.value.scrollHeight });
    });
    idx += 1;
  }, interval);
}

/** 受击方短促震颤(暴击更重);先清类、下一帧再挂,保证连击时动画也能重放 */
function triggerShake(side: "p" | "e", hard: boolean): void {
  shakeCls.value = { ...shakeCls.value, [side]: "" };
  requestAnimationFrame(() => {
    shakeCls.value = { ...shakeCls.value, [side]: hard ? "hit-shake-hard" : "hit-shake" };
  });
}

/** 护盾成形:护盾方筑起金色屏壁(与 triggerShake 同款的重放手法,连叠可重放) */
function triggerShield(side: "p" | "e"): void {
  shieldCls.value = { ...shieldCls.value, [side]: "" };
  requestAnimationFrame(() => {
    shieldCls.value = { ...shieldCls.value, [side]: "shield-rise" };
  });
}

/** 闪避侧移:受击方身形一晃侧让(与 triggerShake 同款的重放手法,连避可重放) */
function triggerFlicker(side: "p" | "e"): void {
  flickerCls.value = { ...flickerCls.value, [side]: "" };
  requestAnimationFrame(() => {
    flickerCls.value = { ...flickerCls.value, [side]: "flicker" };
  });
}

/** 攻击方朝敌阵横踏一步(与 triggerShake 同款的重放手法);sys 行没有出手方,不动 */
function triggerStrike(side: CombatLogEntry["side"]): void {
  if (side !== "p" && side !== "e") return;
  strikeCls.value = { ...strikeCls.value, [side]: "" };
  requestAnimationFrame(() => {
    strikeCls.value = { ...strikeCls.value, [side]: side === "p" ? "strike-p" : "strike-e" };
  });
}

/** 跳过播放,直接呈现战果 */
function skipPlayback(): void {
  playBattle(true);
}

watch(
  () => battle.value?.at,
  (at, oldAt) => {
    if (at !== undefined && at !== oldAt) {
      playBattle(false);
      adaptTap.value = null;
    }
  },
);

onMounted(() => {
  if (battle.value) playBattle(true);
});

onUnmounted(stopPlayback);
</script>
