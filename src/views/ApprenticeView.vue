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
import { formatCountdown, formatGN } from "@/utils/format";
import { toNum } from "@/utils/gnum";
import { notify } from "@/core/notify";
import FolioPageHeader from "@/components/common/FolioPageHeader.vue";
import GameIcon from "@/components/common/GameIcon.vue";
import ProgressBar from "@/components/common/ProgressBar.vue";

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
function bondNext(bond: number): { name: string; remaining: number } | null {
  for (const t of BOND_TITLES) {
    if (bond < t.min) return { name: t.name, remaining: t.min - bond };
  }
  return null;
}

/** 收徒成本与槽位 —— 直接问 service 那一处实现(不再在这里算一遍同一式子) */
const recruitCost = computed(() => apprenticeRecruitCost(player.major));
const slotsFull = computed(() => pulse.value.total >= slots.value);
const recruitShort = computed(() =>
  Math.max(0, toNum(recruitCost.value) - toNum(resources.spiritStone)),
);

/** 派活期望产出 —— 由 apprenticeSpoils 现算(天赋门类 ×1.25),不与结算双写 */
function taskYield(a: OwnedApprentice, spec: ApprenticeSpec): string {
  const s = apprenticeSpoils(a.archId, spec, player.major, a.level);
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
const nextReturnText = computed(() => {
  const at = pulse.value.nextReturnAt;
  if (at === null) return "无人在途";
  if (at <= now.value) return "即将归来";
  const spec = pulse.value.nextReturnSpec;
  return `${spec ? taskDef(spec).name : "差事"} ${formatCountdown(secondsLeft(at))}`;
});

function taskProgress(a: OwnedApprentice): number {
  return a.task ? apprenticeTaskProgress(a.task, now.value) : 0;
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
  <div class="stagger-in space-y-4 px-4 pb-6 pt-4">
    <FolioPageHeader
      title="门庭有徒"
      :subtitle="`弟子跑腿,资材自来 · ${slots} 槽`"
      back-to="dongfu"
      back-label="返回"
    >
      <template #action>
        <button
          class="btn-seal min-h-[28px] !px-2 !py-1 whitespace-nowrap text-[11px] tinylens:w-full"
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
    </FolioPageHeader>

    <!-- 弟子 -->
    <div v-if="appr.apprentices.length" class="space-y-2">
      <!-- 卷首先报门庭此刻:谁在家、谁在路上、最近何时回来;一键派发也收在这里。 -->
      <div
        class="card-ink px-3 py-2.5"
        data-apprentice-pulse
        :data-apprentice-total="pulse.total"
        :data-apprentice-idle="pulse.idle"
        :data-apprentice-away="pulse.away"
      >
        <div class="flex items-baseline justify-between gap-2">
          <span class="font-kai text-[14px] tracking-[0.22em] text-ink">门庭今日</span>
          <span class="text-[10px] text-ink-faint">共 {{ pulse.total }} 名弟子</span>
        </div>
        <div
          class="mt-2 grid grid-cols-3 divide-x divide-ink/10 text-center tinylens:grid-cols-1 tinylens:divide-x-0 tinylens:divide-y tinylens:divide-ink/10"
        >
          <p class="px-1 py-1">
            <span class="block text-[10px] text-ink-faint">在途</span>
            <span class="block text-[11px] tabular text-ink-soft" data-apprentice-away
              >{{ pulse.away }} 人</span
            >
          </p>
          <p class="px-1 py-1">
            <span class="block text-[10px] text-ink-faint">闲置</span>
            <span
              class="block text-[11px] tabular"
              :class="pulse.idle > 0 ? 'text-cinnabar' : 'text-ink-soft'"
              data-apprentice-idle
              >{{ pulse.idle }} 人</span
            >
          </p>
          <p class="px-1 py-1">
            <span class="block text-[10px] text-ink-faint">最近归来</span>
            <span class="block text-[11px] tabular text-ink-soft" data-apprentice-next-return>{{
              nextReturnText
            }}</span>
          </p>
        </div>
        <button
          class="btn-seal mt-2 min-h-[28px] w-full !py-1 text-[11px]"
          :disabled="!hasIdle"
          @click="doDispatchAll"
        >
          {{ hasIdle ? dispatchLabel : "弟子都在路上" }}
        </button>
      </div>
      <div
        v-for="a in appr.apprentices"
        :key="a.uid"
        class="rounded-lg border border-ink/10 bg-paper-deep/60 px-3 py-2"
      >
        <!-- 极窄档(≤220 CSS px):「名字 + 等级 + 羁绊 + 天赋描述」一行塞不下,描述被压到
             10px 一字一行 —— 允许换行,描述整块落到下一行。320 / 390 两档不动。 -->
        <div class="flex flex-wrap items-center gap-2">
          <span class="font-kai text-[14px] text-ink">{{
            apprenticeDef(a.archId)?.name ?? a.archId
          }}</span>
          <span class="text-[10px] text-ink-faint">Lv{{ a.level }}/{{ APPRENTICE_MAX_LEVEL }}</span>
          <span
            v-if="a.bond > 0"
            class="rounded bg-cinnabar/6 px-1.5 py-0.5 text-[10px] text-cinnabar"
            :title="
              bondNext(a.bond)
                ? `羁绊 ${a.bond} 趟 · 距「${bondNext(a.bond)!.name}」还差 ${bondNext(a.bond)!.remaining} 趟(完工趟数,纯称谓不带加成)`
                : `羁绊 ${a.bond} 趟(完工趟数,纯称谓不带加成)`
            "
            >{{ bondTitle(a.bond) }} · {{ a.bond }} 趟</span
          >
          <span v-if="bondNext(a.bond)" class="whitespace-nowrap text-[10px] text-ink-faint"
            >距离「{{ bondNext(a.bond)!.name }}」{{ bondNext(a.bond)!.remaining }} 趟</span
          >
          <span class="ml-auto text-[10px] text-ink-faint">{{
            apprenticeDef(a.archId)?.desc ?? ""
          }}</span>
        </div>

        <!-- 在途 -->
        <div v-if="a.task" class="mt-1.5" :data-apprentice-task-progress="taskProgress(a)">
          <div class="flex items-center gap-2 text-[11px]">
            <span class="rounded bg-ink/5 px-1.5 py-0.5">{{ taskDef(a.task.spec).name }}</span>
            <span class="tabular text-ink-faint"
              >归期
              <span class="countdown-slot">{{
                formatCountdown(secondsLeft(a.task.finishAt))
              }}</span></span
            >
          </div>
          <ProgressBar
            class="mt-1.5"
            :value="taskProgress(a)"
            color="var(--color-jade)"
            :height="4"
            role="progressbar"
            :aria-label="`${taskDef(a.task.spec).name}进度`"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-valuenow="taskProgress(a) * 100"
          />
        </div>

        <!-- 闲置:可派活 -->
        <div v-else class="mt-1.5">
          <p class="mb-1 text-[10px] text-ink-faint">派去:</p>
          <div class="grid grid-cols-2 gap-1.5 tinylens:grid-cols-1">
            <button
              v-for="t in APPRENTICE_TASKS"
              :key="t.spec"
              class="flex min-h-[44px] w-full items-center gap-1.5 rounded-md border px-1.5 py-1 text-left transition-colors active:scale-[0.98]"
              :class="
                isTaskOpen(a.uid, t.spec)
                  ? 'border-cinnabar/35 bg-cinnabar/4'
                  : 'border-ink/10 bg-paper/35 hoverable:hover:border-cinnabar'
              "
              :aria-expanded="isTaskOpen(a.uid, t.spec)"
              @click="tapTask(a.uid, t.spec)"
            >
              <span
                class="shrink-0"
                :class="isTaskOpen(a.uid, t.spec) ? 'text-cinnabar' : 'text-ink-faint'"
              >
                <GameIcon :name="t.icon" :size="15" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="flex items-baseline justify-between gap-1">
                  <span class="font-kai text-[11px] tracking-[0.05em] text-ink">{{ t.name }}</span>
                  <span class="shrink-0 text-[10px] tabular text-ink-faint"
                    >{{ Math.round(apprenticeTaskSeconds(t.spec) / 60) }} 分</span
                  >
                </span>
                <span class="mt-0.5 block text-[10px] leading-relaxed text-ink-faint">{{
                  taskYield(a, t.spec)
                }}</span>
              </span>
            </button>
          </div>
          <!-- 任务说明点开直出(与适配理由/天赋芯片同族)::title 在手机上是死提示。
               第一tap 展开,再点同一枚即派出 —— 派出锁人 30~90 分钟,顺手变成两步。 -->
          <p
            v-if="tappedTask && tappedTask.uid === a.uid"
            class="mt-1 text-[10px] leading-relaxed text-ink-faint"
          >
            「{{ taskDef(tappedTask.spec).name }}」{{ taskDef(tappedTask.spec).desc }} ——
            再点一次「{{ taskDef(tappedTask.spec).name }}」即派出
          </p>
        </div>
        <!-- 真传:跨世之缘只对最高羁绊开放 —— 养出真传的玩家该看得见这条,不藏注释 -->
        <p v-if="a.bond >= BOND_TRUECODE_MIN" class="mt-1.5 text-[10px] text-gold-ink">
          真传 —— 转世时凝一缕跨世之缘,来世情谊随魂而来
        </p>
        <!-- 未到真传也要把这条机制与门槛摊明:冲「跨世之缘」的人在达成前就该知道它存在、差几趟 -->
        <p v-else class="mt-1.5 text-[10px] text-ink-faint">
          抵达「真传」({{ BOND_TRUECODE_MIN }} 趟)后,转世时凝一缕跨世之缘,来世情谊随魂而来
        </p>
      </div>
    </div>
    <p v-else class="py-3 text-center text-[11px] text-ink-faint">
      尚无一徒 —— 开局白送一名,或再收。
    </p>

    <!-- 收徒成本说明 -->
    <p class="text-[10px] leading-relaxed text-ink-faint">
      收徒一次耗灵石(按当前境界)。弟子天赋门类的产出 ×{{
        APPRENTICE_TALENT_BONUS
      }}。到时辰归来,久不在线亦照算。
    </p>
    <!--
      等级从哪来:升级由完工趟数驱动(每收割一趟 +1,封顶 20),机制里没有
      「半格进度」可言 —— 故不编一条「距下次升级」的假进度,把来源说清楚。
      羁绊(趟数)已逐档摊在弟子卡上,与升级同源同长。
    -->
    <p class="text-[10px] leading-relaxed text-ink-faint">
      弟子每完工一趟升一级(封顶 {{ APPRENTICE_MAX_LEVEL }} 级),等级越高,一趟带回的越多。
    </p>
  </div>
</template>
