<script setup lang="ts">
/**
 * 收徒 —— 后台游历的 idle 层。弟子离线跑腿,按墙钟走工,归来带回资材。
 *
 * 结算与产出在 core/apprenticeService(纯)、stores/apprentice(入账编排)。
 * 本页只做:展示弟子与在途任务、派活、收徒、一拍 collectFinished。
 */
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import { goBack } from "@/router/goBack";
import { useApprenticeStore, type ApprenticeReap } from "@/stores/apprentice";
import { usePlayerStore } from "@/stores/player";
import { useResourcesStore } from "@/stores/resources";
import {
  APPRENTICE_TASKS,
  APPRENTICE_MAX_LEVEL,
  BOND_TITLES,
  apprenticeDef,
  apprenticeSlots,
  bondTitle,
  taskDef,
  type ApprenticeSpec,
} from "@/data/apprentices";
import {
  apprenticeSpoils,
  apprenticeTaskSeconds,
  type OwnedApprentice,
} from "@/core/apprenticeService";
import { stoneByTier } from "@/core/formulas";
import { pillDef } from "@/data/pills";
import { formatCountdown, formatGN } from "@/utils/format";
import { toNum } from "@/utils/gnum";
import { notify } from "@/core/notify";

const router = useRouter();
const appr = useApprenticeStore();
const player = usePlayerStore();
const resources = useResourcesStore();

const now = ref(Date.now());
let timer: number | undefined;

/** 一趟归来的账目文本(与派活期望同源,由 spoils 现算,不另写第二份) */
function reapText(r: ApprenticeReap): string {
  const s = r.spoils;
  if (s.herb) return `灵草 ×${s.herb}`;
  if (s.ore) return `玄铁 ×${s.ore}`;
  if (s.dust) return `器灵尘 ×${s.dust}`;
  if (s.wudao) return `悟道点 ×${s.wudao}`;
  if (s.stone) return `灵石 ${formatGN(s.stone)}`;
  if (s.pillId) return `${pillDef(s.pillId)?.name ?? s.pillId} ×${s.pillCount}`;
  return "";
}

/** 弟子归来要有一声:资材不是静默入账的 → 每条通报「XX 归来,带回…」 */
function announceReaps(reaped: ApprenticeReap[]): void {
  for (const r of reaped) notify(`「${r.name}」归来,带回 ${reapText(r)}`, "success");
}

onMounted(() => {
  appr.sync();
  // 离线归来/开页那一拍若有完工,照报 —— 玩家回来不该只知道数变了
  announceReaps(appr.collectFinished(Date.now(), player.major));
  timer = window.setInterval(() => {
    now.value = Date.now();
    announceReaps(appr.collectFinished(now.value, player.major));
  }, 1000);
});
onUnmounted(() => {
  if (timer !== undefined) window.clearInterval(timer);
});

const slots = computed(() => apprenticeSlots(player.major));

function secondsLeft(finishAt: number): number {
  return Math.max(0, Math.ceil((finishAt - now.value) / 1000));
}
function send(uid: string, spec: (typeof APPRENTICE_TASKS)[number]["spec"]): void {
  appr.dispatch(uid, spec, Date.now());
}

/** 收徒成本与槽位 —— 与 store.recruit 同源(stoneByTier(major,30)/apprenticeSlots) */
const recruitCost = computed(() => stoneByTier(player.major, 30));
const slotsFull = computed(() => appr.apprentices.length >= slots.value);
const recruitShort = computed(() =>
  Math.max(0, toNum(recruitCost.value) - toNum(resources.spiritStone)),
);

/** 派活期望产出 —— 由 apprenticeSpoils 现算(天赋门类 ×1.25),不与结算双写 */
function taskYield(a: OwnedApprentice, spec: ApprenticeSpec): string {
  const s = apprenticeSpoils(a.archId, spec, player.major, a.level);
  const talent = apprenticeDef(a.archId)?.talent === spec;
  const tag = talent ? "·天赋×1.25" : "";
  const base = s.herb
    ? `灵草 ~${s.herb}`
    : s.ore
      ? `玄铁 ~${s.ore}`
      : s.dust
        ? `器灵尘 ~${s.dust}`
        : s.wudao
          ? `悟道点 ~${s.wudao}`
          : s.stone
            ? `灵石 ~${formatGN(s.stone)}`
            : s.pillId
              ? `${pillDef(s.pillId)?.name ?? s.pillId} ~${s.pillCount}`
              : "";
  return base + tag;
}

function doRecruit(): void {
  const r = appr.recruit(player.major);
  if (r === "full")
    notify(`槽位已满(${appr.apprentices.length}/${slots.value}),收不下新弟子`, "warn");
  else if (r === "poor") notify("灵石不足,收徒不成", "warn");
}

/** 「各尽其长」一键派发 —— 按库存读最缺的门,把闲置弟子都派过去 */
function doDispatchAll(): void {
  const idle = appr.apprentices.filter((x) => !x.task);
  if (idle.length === 0) {
    notify("弟子都在路上,无需再派", "info");
    return;
  }
  const n = appr.dispatchAllToNeed(Date.now(), {
    herb: resources.herb,
    ore: resources.ore,
    wudao: resources.wudao,
    dust: resources.dust,
  });
  notify(n > 0 ? `${n} 名弟子各尽其长,已派往最缺的门` : "暂无闲置弟子可派", "success");
}
const hasIdle = computed(() => appr.apprentices.some((x) => !x.task));
</script>

<template>
  <div class="stagger-in space-y-4 px-4 pb-6 pt-4">
    <!-- 抬头 -->
    <div class="card-ink flex items-center justify-between gap-2 px-4 py-3">
      <button
        class="tap-row -my-1.5 py-1.5 text-left text-[12px] text-ink-faint active:text-ink-soft"
        @click="goBack(router, { name: 'dongfu' })"
      >
        ← 返回
      </button>
      <div class="min-w-0 text-center">
        <p class="font-kai text-[15px] tracking-[0.3em] text-ink">门庭有徒</p>
        <p class="text-[10px] text-ink-faint">弟子跑腿,资材自来 · {{ slots }} 槽</p>
      </div>
      <button
        class="btn-seal !px-2 !py-1 text-[11px]"
        :disabled="slotsFull || recruitShort > 0"
        @click="doRecruit"
      >
        {{
          slotsFull
            ? `已收满 ${appr.apprentices.length}/${slots}`
            : recruitShort > 0
              ? `收徒 · 尚差 ${formatGN(recruitShort)} 石`
              : `收徒 ${formatGN(recruitCost)} 石`
        }}
      </button>
    </div>

    <!-- 弟子 -->
    <div v-if="appr.apprentices.length" class="space-y-2">
      <button class="btn-seal w-full !py-1 text-[11px]" :disabled="!hasIdle" @click="doDispatchAll">
        {{ hasIdle ? "各尽其长 · 派闲置弟子去最缺的门" : "弟子都在路上" }}
      </button>
      <div
        v-for="a in appr.apprentices"
        :key="a.uid"
        class="rounded-lg border border-ink/10 bg-paper-deep/60 px-3 py-2"
      >
        <div class="flex items-center gap-2">
          <span class="font-kai text-[13px] text-ink">{{
            apprenticeDef(a.archId)?.name ?? a.archId
          }}</span>
          <span class="text-[10px] text-ink-faint">Lv{{ a.level }}/{{ APPRENTICE_MAX_LEVEL }}</span>
          <span
            v-if="a.bond >= BOND_TITLES[1]!.min"
            class="rounded bg-cinnabar/10 px-1.5 py-0.5 text-[10px] text-cinnabar"
            :title="`羁绊 ${a.bond} 趟(完工趟数,纯称谓不带加成)`"
            >{{ bondTitle(a.bond) }}</span
          >
          <span class="ml-auto text-[10px] text-ink-faint">{{
            apprenticeDef(a.archId)?.desc ?? ""
          }}</span>
        </div>

        <!-- 在途 -->
        <div v-if="a.task" class="mt-1.5 flex items-center gap-2 text-[11px]">
          <span class="rounded bg-ink/5 px-1.5 py-0.5">{{ taskDef(a.task.spec).name }}</span>
          <span class="tabular text-ink-faint"
            >归期
            <span class="countdown-slot">{{
              formatCountdown(secondsLeft(a.task.finishAt))
            }}</span></span
          >
        </div>

        <!-- 闲置:可派活 -->
        <div v-else class="mt-1.5">
          <p class="mb-1 text-[10px] text-ink-faint">派去:</p>
          <div class="flex flex-wrap gap-1">
            <button
              v-for="t in APPRENTICE_TASKS"
              :key="t.spec"
              class="rounded border border-ink/10 px-2 py-1 text-[10px] hover:border-cinnabar"
              :title="t.desc"
              @click="send(a.uid, t.spec)"
            >
              <span class="block"
                >{{ t.name }}({{ Math.round(apprenticeTaskSeconds(t.spec) / 60) }}分)</span
              >
              <span class="block text-ink-faint">{{ taskYield(a, t.spec) }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
    <p v-else class="py-3 text-center text-[11px] text-ink-faint">
      尚无一徒 —— 开局白送一名,或再收。
    </p>

    <!-- 收徒成本说明 -->
    <p class="text-[10px] leading-relaxed text-ink-faint">
      收徒一次耗灵石(按当前境界)。弟子天赋门类的产出 ×1.25。到时辰归来,久不在线亦照算。
    </p>
  </div>
</template>
