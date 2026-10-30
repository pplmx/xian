<script setup lang="ts">
/**
 * 收徒 —— 后台游历的 idle 层。弟子离线跑腿,按墙钟走工,归来带回资材。
 *
 * 结算与产出在 core/apprenticeService(纯)、stores/apprentice(入账编排)。
 * 本页只做:展示弟子与在途任务、派活、收徒、一拍 collectFinished。
 */
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useApprenticeStore, type ApprenticeReap } from "@/stores/apprentice";
import { usePlayerStore } from "@/stores/player";
import { useResourcesStore } from "@/stores/resources";
import {
  APPRENTICE_TASKS,
  APPRENTICE_MAX_LEVEL,
  APPRENTICE_TALENT_BONUS,
  BOND_TITLES,
  BOND_TRUECODE_MIN,
  apprenticeDef,
  apprenticeSlots,
  bondTitle,
  taskDef,
  type ApprenticeSpec,
} from "@/data/apprentices";
import {
  apprenticeOverview,
  apprenticeRoster,
  apprenticeRecruitCost,
  apprenticeSpoils,
  apprenticeTaskProgress,
  apprenticeTaskSeconds,
  apprenticeReapText,
  needTargetDoor,
  type DispatchNeedStock,
  type OwnedApprentice,
} from "@/core/apprenticeService";
import { pillDef } from "@/data/pills";
import { qualityDef } from "@/data/qualities";
import { formatCountdown, formatGN } from "@/utils/format";
import { toNum } from "@/utils/gnum";
import { notify } from "@/core/notify";
import FolioPageHeader from "@/components/common/FolioPageHeader.vue";
import SectionTitle from "@/components/common/SectionTitle.vue";
import GameIcon from "@/components/common/GameIcon.vue";
import ProgressBar from "@/components/common/ProgressBar.vue";
import ApprenticeCourt from "@/components/apprentice/ApprenticeCourt.vue";

const appr = useApprenticeStore();
const player = usePlayerStore();
const resources = useResourcesStore();

const now = ref(Date.now());
let timer: number | undefined;

/** 弟子归来要有一声:资材不是静默入账的 → 每条通报「XX 归来,带回…」(格式化走共享 apprenticeReapText) */
function announceReaps(reaped: ApprenticeReap[]): void {
  for (const r of reaped)
    notify(`「${r.name}」归来,带回 ${apprenticeReapText(r.spoils)}`, "success");
}

onMounted(() => {
  appr.sync();
  // 离线归来/开页那一拍若有完工,照报 —— 玩家回来不该只知道数变了
  announceReaps(appr.collectFinished(Date.now(), player.major));
  /*
   * 墙钟域,**不走** useGameClock(暂停冻结):弟子按墙钟走工(离线照算),
   * 归来收割与 App.vue 启动那一拍是同一条墙钟口径 —— 重置/导入确认开着的
   * 几分钟里完工的趟,恢复后第一拍照收,不该被游戏钟吞掉。每秒刷的归期
   * 倒计时也随这枚表走(本页是墙钟域,倒计时不随暂停冻结)。
   */
  timer = window.setInterval(() => {
    now.value = Date.now();
    announceReaps(appr.collectFinished(now.value, player.major));
  }, 1000);
});
onUnmounted(() => {
  if (timer !== undefined) window.clearInterval(timer);
});

const slots = computed(() => apprenticeSlots(player.major));
/** 门庭卷首、派发按钮与朱点共用的唯一汇总。 */
const pulse = computed(() => apprenticeOverview(appr.apprentices));
/** 值日簿顺序也在 service 定一次:候差在前,在途按最近归期排。 */
const roster = computed(() => apprenticeRoster(appr.apprentices));
const idleRows = computed(() => roster.value.filter((row) => !row.away));
const awayRows = computed(() => roster.value.filter((row) => row.away));
const rosterGroups = computed(() =>
  [
    { key: "idle", mark: "壹", title: "候差", hint: "可即刻派活", rows: idleRows.value },
    { key: "away", mark: "贰", title: "在途", hint: "按归期先后", rows: awayRows.value },
  ].filter((group) => group.rows.length > 0),
);

const TALENT_MARKS: Record<ApprenticeSpec, string> = {
  herb: "药",
  ore: "矿",
  adventure: "剑",
  seek: "缘",
  study: "悟",
};

const courtNodes = computed(() =>
  roster.value.map(({ apprentice: a }) => {
    const talent = apprenticeDef(a.archId)?.talent ?? "adventure";
    return {
      uid: a.uid,
      mark: TALENT_MARKS[talent],
      idle: !a.task,
      progress: a.task ? apprenticeTaskProgress(a.task, now.value) * 100 : 0,
    };
  }),
);

function secondsLeft(finishAt: number): number {
  return Math.max(0, Math.ceil((finishAt - now.value) / 1000));
}
function send(uid: string, spec: (typeof APPRENTICE_TASKS)[number]["spec"]): void {
  appr.dispatch(uid, spec, Date.now());
}

/**
 * 下一档羁绊称谓与距它的趟数 —— 称谓梯只显「道童→…→真传」的方向,不说清「离下一档还差几趟」;
 * 而真传那档还带跨世之缘(有实际转世收益)的隐藏机制,冲它的人该在达成前就看得见门槛与方向。
 * 返回 null 表示已到真传(封顶,无下一档)。
 */
function bondNext(
  bond: number,
): { name: string; remaining: number; from: number; threshold: number } | null {
  for (const t of BOND_TITLES) {
    if (bond < t.min) {
      const from =
        [...BOND_TITLES].reverse().find((step) => step.min <= bond)?.min ?? BOND_TITLES[0]!.min;
      return { name: t.name, remaining: t.min - bond, from, threshold: t.min };
    }
  }
  return null;
}

function bondProgress(a: OwnedApprentice): number {
  const next = bondNext(a.bond);
  if (!next) return 100;
  const span = next.threshold - next.from;
  return span <= 0 ? 0 : Math.max(0, Math.min(1, ((a.bond - next.from) / span) * 100));
}

/** 收徒成本与槽位 —— 直接问 service 那一处实现(不再在这里算一遍同一式子) */
const recruitCost = computed(() => apprenticeRecruitCost(player.major));
const slotsFull = computed(() => pulse.value.total >= slots.value);
const recruitShort = computed(() =>
  Math.max(0, toNum(recruitCost.value) - toNum(resources.spiritStone)),
);

/** 派活期望产出 —— 由 apprenticeSpoils 现算(天赋门类读常量),不与结算双写 */
function taskYield(a: OwnedApprentice, spec: ApprenticeSpec, major = player.major): string {
  const s = apprenticeSpoils(a.archId, spec, major, a.level);
  const talent = apprenticeDef(a.archId)?.talent === spec;
  const tag = talent ? `·天赋×${APPRENTICE_TALENT_BONUS}` : "";
  const parts: string[] = [];
  // 产出一律确定(寻宝取丹是 (level*7)%len 的哈希,无随机)—— 预览与归来通报(apprenticeReapText)
  // 逐位相等,标「~」会让人以为有波动,反倒撒谎;去掉,给确定值
  if (s.herb) parts.push(`灵草 ${s.herb}`);
  if (s.ore) parts.push(`玄铁 ${s.ore}`);
  if (s.dust) parts.push(`器灵尘 ${s.dust}`);
  if (s.wudao) parts.push(`悟道点 ${s.wudao}`);
  if (s.stone) parts.push(`灵石 ${formatGN(s.stone)}`);
  if (s.pillId) parts.push(`${pillDef(s.pillId)?.name ?? s.pillId} ${s.pillCount}`);
  const base = parts.join(" · ");
  return base + tag;
}

function doRecruit(): void {
  const r = appr.recruit(player.major);
  if (r === "full") notify(`槽位已满(${pulse.value.total}/${slots.value}),收不下新弟子`, "warn");
  else if (r === "poor") notify("灵石不足,收徒不成", "warn");
}

/** 给「各尽其长」的库存快照 —— 与派发实际入账同一份数(needTargetDoor 只读快照、无随机) */
function dispatchStock(): DispatchNeedStock {
  return {
    herb: resources.herb,
    ore: resources.ore,
    wudao: resources.wudao,
    dust: resources.dust,
  };
}

/**
 * 「各尽其长」一键派发 —— 按库存读最缺的门,把闲置弟子都派过去。
 * 报结果要照实说:门有分晓就说派去哪个门(needTargetDoor 同源),无单门胜出(并列)
 * 就退回「各就本职」—— 不许按钮喊「最缺的门」、实际却各自专职,两句话对不上。
 */
function doDispatchAll(): void {
  const idle = appr.apprentices.filter((x) => !x.task);
  if (idle.length === 0) {
    notify("弟子都在路上,无需再派", "info");
    return;
  }
  const target = needTargetDoor(dispatchStock());
  const n = appr.dispatchAllToNeed(Date.now(), dispatchStock());
  if (n <= 0) {
    notify("暂无闲置弟子可派", "info");
    return;
  }
  notify(
    target ? `${n} 名弟子已派往「${taskDef(target).name}」` : `${n} 名弟子各就本职`,
    "success",
  );
}
const hasIdle = computed(() => pulse.value.idle > 0);
/** 按钮文案与派发判定同源:有单门胜出报「派去最缺的门」,并列退回「各就本职」 */
const dispatchLabel = computed(() => {
  const target = needTargetDoor(dispatchStock());
  const idle = pulse.value.idle;
  return target
    ? `派闲置 ${idle} 人 · 去「${taskDef(target).name}」`
    : `派闲置 ${idle} 人 · 各就本职`;
});

/** 卷首只报最近一单；逐单归期仍在各自卡上。 */
const nextReturn = computed(() => {
  const at = pulse.value.nextReturnAt;
  if (at === null) return { at, route: "", countdown: "无人在途" };
  const spec = pulse.value.nextReturnSpec;
  const who = roster.value.find((row) => row.away)?.apprentice;
  const name = who ? (apprenticeDef(who.archId)?.name ?? "弟子") : "弟子";
  const task = spec ? taskDef(spec).name : "差事";
  return {
    at,
    route: `${name} · ${task}`,
    countdown: at <= now.value ? "即将归来" : formatCountdown(secondsLeft(at)),
  };
});
const nextReturnText = computed(() =>
  nextReturn.value.at === null
    ? nextReturn.value.countdown
    : `${nextReturn.value.route} ${nextReturn.value.countdown}`,
);

function taskProgress(a: OwnedApprentice): number {
  return a.task ? apprenticeTaskProgress(a.task, now.value) : 0;
}

function taskTalent(a: OwnedApprentice, spec: ApprenticeSpec): boolean {
  return apprenticeDef(a.archId)?.talent === spec;
}

function qualityText(a: OwnedApprentice): string {
  const q = apprenticeDef(a.archId)?.quality;
  return q ? qualityDef(q).name : "凡品";
}

function talentOf(a: OwnedApprentice): ApprenticeSpec {
  return apprenticeDef(a.archId)?.talent ?? "adventure";
}

function talentText(a: OwnedApprentice): string {
  return taskDef(talentOf(a)).name;
}

/**
 * 派活任务说明点按展开 —— 与适配理由/天赋芯片同族(「点一下展开一行」)。
 *
 * 任务描述此前只挂在 :title 上,手机没有 hover,那是谁也看不见的死提示;而派出
 * 又是把弟子锁走 30~90 分钟的半承诺。故同一枚按钮改两步:第一下展开说明
 * (aria-expanded 报给读屏),再点一下才真派出 —— 说明看得见,误触也不再直接锁人。
 */
const taskTap = ref<string | null>(null); // `${uid}:${spec}`

function taskKey(uid: string, spec: ApprenticeSpec): string {
  return `${uid}:${spec}`;
}

function isTaskOpen(uid: string, spec: ApprenticeSpec): boolean {
  return taskTap.value === taskKey(uid, spec);
}

function tapTask(uid: string, spec: ApprenticeSpec): void {
  if (isTaskOpen(uid, spec)) {
    taskTap.value = null;
    send(uid, spec);
  } else {
    taskTap.value = taskKey(uid, spec);
  }
}

/** 当前展开说明的那一单(跨弟子只开一份;拆 key 是为了让说明行能读回任务名) */
const tappedTask = computed<{ uid: string; spec: ApprenticeSpec } | null>(() => {
  if (!taskTap.value) return null;
  const i = taskTap.value.indexOf(":");
  return { uid: taskTap.value.slice(0, i), spec: taskTap.value.slice(i + 1) as ApprenticeSpec };
});
</script>

<template>
  <div class="folio-page folio-page--stack stagger-in">
    <FolioPageHeader
      title="门庭有徒"
      :subtitle="`弟子跑腿,资材自来 · 本境 ${slots} 席`"
      back-to="dongfu"
      back-label="返回"
      featured
    >
      <template #visual>
        <ApprenticeCourt :nodes="courtNodes" :slots="slots" :idle="pulse.idle" :away="pulse.away" />
      </template>

      <template #action>
        <button
          class="btn-seal min-h-[28px] !px-2 !py-1 whitespace-nowrap text-body tinylens:w-full"
          :disabled="slotsFull || recruitShort > 0"
          @click="doRecruit"
        >
          {{
            slotsFull
              ? `已收满 ${pulse.total}/${slots}`
              : recruitShort > 0
                ? `收徒 · 尚差 ${formatGN(recruitShort)} 石`
                : `收徒 ${formatGN(recruitCost)} 石`
          }}
        </button>
      </template>

      <!-- 卷首先总账,值日簿随后逐人摊开;一键派发必须是这一块里的第一枚按钮。 -->
      <div
        class="apprentice-pulse"
        data-apprentice-pulse
        :data-apprentice-total="pulse.total"
        :data-apprentice-idle="pulse.idle"
        :data-apprentice-away="pulse.away"
      >
        <header class="apprentice-pulse__head">
          <span class="apprentice-pulse__seal" aria-hidden="true">庭</span>
          <span class="apprentice-pulse__heading">
            <span class="apprentice-pulse__eyebrow">今日门庭</span>
            <span class="apprentice-pulse__title text-heading">一册值日</span>
          </span>
          <span class="apprentice-pulse__position tabular">
            {{ pulse.total }} / {{ slots }} 席
          </span>
        </header>

        <div class="apprentice-pulse__body">
          <div class="apprentice-pulse__tallies">
            <div class="apprentice-pulse__tally">
              <span class="apprentice-pulse__label">候差</span>
              <strong class="apprentice-pulse__value tabular" data-apprentice-idle>{{
                pulse.idle
              }}</strong>
              <span class="apprentice-pulse__unit">人</span>
            </div>
            <div class="apprentice-pulse__tally">
              <span class="apprentice-pulse__label">在途</span>
              <strong class="apprentice-pulse__value tabular" data-apprentice-away>{{
                pulse.away
              }}</strong>
              <span class="apprentice-pulse__unit">人</span>
            </div>
            <div class="apprentice-pulse__next">
              <span class="apprentice-pulse__label">最近归来</span>
              <strong
                class="apprentice-pulse__next-value tabular"
                data-apprentice-next-return
                :aria-label="`最近归来 ${nextReturnText}`"
              >
                <template v-if="nextReturn.at !== null">
                  <span class="apprentice-pulse__next-route">{{ nextReturn.route }}</span>
                  <span class="apprentice-pulse__next-countdown">{{ nextReturn.countdown }}</span>
                </template>
                <template v-else>{{ nextReturn.countdown }}</template>
              </strong>
            </div>
          </div>

          <button
            class="btn-seal apprentice-pulse__dispatch"
            :disabled="!hasIdle"
            :aria-label="hasIdle ? dispatchLabel : '弟子都在路上'"
            @click="doDispatchAll"
          >
            {{ hasIdle ? dispatchLabel : "弟子都在路上" }}
          </button>
        </div>

        <p class="apprentice-pulse__foot">
          候差者可按库存一令齐发；各自的本命门类与逐单进度,都摊在下面值日簿里。
        </p>
      </div>
    </FolioPageHeader>

    <section class="folio-span-all apprentice-roster-section" data-apprentice-roster>
      <SectionTitle
        title="值日簿"
        :hint="`候差 ${idleRows.length} · 在途 ${awayRows.length} · 在途按归期先后`"
      />

      <div class="apprentice-roster">
        <div v-if="roster.length === 0" class="apprentice-roster__empty">
          <span class="apprentice-roster__empty-seal" aria-hidden="true">庭</span>
          <p>尚无一徒 —— 开局白送一名,或从卷首再收一名。</p>
        </div>

        <section
          v-for="group in rosterGroups"
          :key="group.key"
          class="apprentice-roster__group"
          :data-apprentice-group="group.key"
        >
          <header class="apprentice-roster__group-head">
            <span class="apprentice-roster__group-index tabular">{{ group.mark }}</span>
            <span class="apprentice-roster__group-title text-section">{{ group.title }}</span>
            <span class="apprentice-roster__group-hint">{{ group.hint }}</span>
            <span class="apprentice-roster__group-count tabular"> {{ group.rows.length }} 人 </span>
          </header>

          <div class="apprentice-roster__list">
            <article
              v-for="{ apprentice: a, away } in group.rows"
              :key="a.uid"
              class="apprentice-roster__row"
              :data-apprentice-row="a.uid"
              :data-apprentice-status="away ? 'away' : 'idle'"
              :data-apprentice-task-progress="away ? taskProgress(a) : undefined"
            >
              <div class="apprentice-roster__identity flex flex-wrap items-center gap-2">
                <span class="apprentice-roster__mark" aria-hidden="true">{{
                  TALENT_MARKS[talentOf(a)]
                }}</span>
                <span class="apprentice-roster__name text-title font-kai">{{
                  apprenticeDef(a.archId)?.name ?? a.archId
                }}</span>
                <span class="apprentice-roster__quality">{{ qualityText(a) }}</span>
                <span class="apprentice-roster__talent">
                  <GameIcon :name="taskDef(talentOf(a)).icon" :size="12" />
                  本命 · {{ talentText(a) }}
                </span>
                <span class="apprentice-roster__level tabular"
                  >Lv{{ a.level }}/{{ APPRENTICE_MAX_LEVEL }}</span
                >
                <span class="apprentice-roster__status" :class="away ? 'is-away' : 'is-idle'">{{
                  away ? "在途" : "候差"
                }}</span>
              </div>

              <p class="apprentice-roster__desc">
                {{ apprenticeDef(a.archId)?.desc ?? "" }}
              </p>

              <div class="apprentice-roster__bond" :data-apprentice-bond-progress="bondProgress(a)">
                <span class="apprentice-roster__bond-title"
                  >{{ bondTitle(a.bond) }} · {{ a.bond }} 趟</span
                >
                <template v-if="bondNext(a.bond)">
                  <span class="apprentice-roster__bond-next"
                    >距「{{ bondNext(a.bond)!.name }}」{{ bondNext(a.bond)!.remaining }} 趟</span
                  >
                  <span class="apprentice-roster__bond-track" aria-hidden="true">
                    <span :style="{ width: `${bondProgress(a)}%` }" />
                  </span>
                </template>
                <span v-else class="apprentice-roster__bond-done">羁绊已至真传</span>
              </div>

              <div v-if="away && a.task" class="apprentice-roster__task">
                <div class="apprentice-roster__task-head">
                  <span class="apprentice-roster__task-name font-kai">{{
                    taskDef(a.task.spec).name
                  }}</span>
                  <span v-if="taskTalent(a, a.task.spec)" class="apprentice-roster__task-talent"
                    >本命加成</span
                  >
                  <span class="apprentice-roster__task-eta tabular"
                    >归期
                    <span class="countdown-slot">{{
                      formatCountdown(secondsLeft(a.task.finishAt))
                    }}</span></span
                  >
                </div>
                <ProgressBar
                  class="apprentice-roster__task-bar"
                  :value="taskProgress(a)"
                  color="var(--color-qing)"
                  :height="4"
                  role="progressbar"
                  :aria-label="`${taskDef(a.task.spec).name}进度`"
                  aria-valuemin="0"
                  aria-valuemax="100"
                  :aria-valuenow="taskProgress(a) * 100"
                />
                <p class="apprentice-roster__task-yield">
                  归来可得
                  <span>{{ taskYield(a, a.task.spec, a.task.rewardMajor ?? player.major) }}</span>
                </p>
              </div>

              <div v-else class="apprentice-roster__dispatch">
                <p class="apprentice-roster__dispatch-note">遣往 · 先看说明,再点同一门一次即派出</p>
                <div class="grid grid-cols-2 gap-1.5 tinylens:grid-cols-1">
                  <button
                    v-for="t in APPRENTICE_TASKS"
                    :key="t.spec"
                    class="apprentice-task-choice flex min-h-[44px] w-full items-center gap-1.5 border px-1.5 py-1 text-left transition-colors active:scale-[0.98]"
                    :class="
                      isTaskOpen(a.uid, t.spec)
                        ? 'border-cinnabar/35 bg-cinnabar/4'
                        : 'border-ink/10 bg-paper/35 hoverable:hover:border-cinnabar'
                    "
                    :aria-expanded="isTaskOpen(a.uid, t.spec)"
                    :data-apprentice-talent="taskTalent(a, t.spec) ? '' : undefined"
                    @click="tapTask(a.uid, t.spec)"
                  >
                    <span
                      class="apprentice-task-choice__icon shrink-0"
                      :class="isTaskOpen(a.uid, t.spec) ? 'text-cinnabar' : 'text-ink-faint'"
                    >
                      <GameIcon :name="t.icon" :size="15" />
                    </span>
                    <span class="min-w-0 flex-1">
                      <span
                        class="apprentice-task-choice__top flex items-baseline justify-between gap-1"
                      >
                        <span class="apprentice-task-choice__name font-kai">{{ t.name }}</span>
                        <span v-if="taskTalent(a, t.spec)" class="apprentice-task-choice__talent"
                          >本命</span
                        >
                        <span class="apprentice-task-choice__time shrink-0 text-note tabular"
                          >{{ Math.round(apprenticeTaskSeconds(t.spec) / 60) }} 分</span
                        >
                      </span>
                      <span class="apprentice-task-choice__yield">{{ taskYield(a, t.spec) }}</span>
                    </span>
                  </button>
                </div>
                <!-- 手机没有 hover:任务说明必须第一下点开,第二次才真的锁人出发。 -->
                <p
                  v-if="tappedTask && tappedTask.uid === a.uid"
                  class="apprentice-roster__task-note"
                >
                  「{{ taskDef(tappedTask.spec).name }}」{{ taskDef(tappedTask.spec).desc }} ——
                  再点一次「{{ taskDef(tappedTask.spec).name }}」即派出
                </p>
              </div>
            </article>
          </div>
        </section>
      </div>
    </section>

    <section class="folio-span-all apprentice-rules-section">
      <SectionTitle title="门规" hint="界面读数与结算同源" />
      <div class="apprentice-rules">
        <article class="apprentice-rules__item">
          <span class="apprentice-rules__index tabular" aria-hidden="true">壹</span>
          <div>
            <h3 class="apprentice-rules__title">收徒与席位</h3>
            <p class="apprentice-rules__copy">
              本境开 {{ slots }} 席；价签按当前境界现算,槽满即止。
            </p>
          </div>
        </article>
        <article class="apprentice-rules__item">
          <span class="apprentice-rules__index tabular" aria-hidden="true">贰</span>
          <div>
            <h3 class="apprentice-rules__title">本命天赋</h3>
            <p class="apprentice-rules__copy">
              本命门类产出 ×{{ APPRENTICE_TALENT_BONUS }},时长仍按任务簿。
            </p>
          </div>
        </article>
        <article class="apprentice-rules__item">
          <span class="apprentice-rules__index tabular" aria-hidden="true">叁</span>
          <div>
            <h3 class="apprentice-rules__title">等级与羁绊</h3>
            <p class="apprentice-rules__copy">
              每完工一趟升一级(封顶
              {{ APPRENTICE_MAX_LEVEL }}
              级),等级越高带回越多；羁绊只记称谓,不另加产出。抵达「真传」({{ BOND_TRUECODE_MIN }}
              趟)后,转世时凝一缕跨世之缘,来世情谊随魂而来。
            </p>
          </div>
        </article>
        <article class="apprentice-rules__item">
          <span class="apprentice-rules__index tabular" aria-hidden="true">肆</span>
          <div>
            <h3 class="apprentice-rules__title">墙钟与归来</h3>
            <p class="apprentice-rules__copy">
              差事按墙钟走,关闭页面亦照算；归来自动入账,并逐名通报带回之物。
            </p>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>
