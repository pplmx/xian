<template>
  <!-- 一键分解:勾选品质(记忆勾选) -->
  <BaseModal :open="decomposeOpen" title="一键分解" @close="emit('close-decompose')">
    <!--
      这段文案此前承诺了两件事(手动筛选 + 自动回收),于是和「智能收纳」的保留线打架:
      玩家把保留线设在灵品,却因为这里勾过玄品而被自动扔掉玄品。现在这一页只管手动那一次。
    -->
    <p class="t-body text-ink-faint">
      勾选要分解的品质,已佩戴与上锁的装备不受影响。勾选会被记住,但<b class="text-ink"
        >只管这一页的手动分解</b
      >
      —— 掉落时的自动去留由「智能收纳」说了算(见上一页):那里定的「此品质起一律保留」是硬承诺,
      这里的勾选压不动它。
    </p>
    <div class="mt-2 space-y-1">
      <label
        v-for="row in decomposeRows"
        :key="row.rank"
        class="flex items-center gap-2.5 rounded-md px-2.5 py-1.5"
        :class="settings.decomposeRanks.includes(row.rank) ? 'bg-paper-deep/80' : ''"
      >
        <input
          type="checkbox"
          class="h-4 w-4 accent-cinnabar"
          :checked="settings.decomposeRanks.includes(row.rank)"
          @change="toggleRank(row.rank)"
        />
        <span class="font-kai text-title" :style="{ color: row.color }">{{ row.name }}</span>
        <span class="ml-auto tabular text-body text-ink-faint">
          现存 {{ row.count }} 件
          <template v-if="row.count > 0">· {{ row.text }}</template>
        </span>
      </label>
    </div>
    <p v-if="decomposeTotal > 0" class="mt-2 text-right text-body text-cinnabar tabular">
      共 {{ decomposeTotal }} 件 → {{ batchYieldText(decomposePlanned) }}
    </p>
    <template #footer>
      <button class="btn-seal w-full" :disabled="decomposeTotal === 0" @click="confirmDecompose">
        分 解{{ decomposeTotal > 0 ? `(${decomposeTotal} 件)` : "" }}
      </button>
    </template>
  </BaseModal>

  <!-- 智能收纳弹窗入口共用分解弹窗下方 -->
  <BaseModal :open="smartOpen" title="智能收纳" @close="emit('close-smart')">
    <p class="t-body text-ink-faint">
      开启后,新掉落先过智能裁决:无缘之物直接化尘不入包;行囊满时,值得收藏的新件会挤掉包内最弱的无缘旧物(品质低的先走,同档看层级与词条)。识别不只看品质:流派核心词条、组合技部件、成套共鸣件、条条近满的词条都算值得留。
    </p>
    <p class="mt-1 t-body text-ink-faint">
      你强化过、重铸过、封存过词条的件,自动收纳一律不动 ——
      要扔得你自己动手(单件分解,或勾选该品质的一键分解)。
    </p>
    <label class="mt-2 flex items-center justify-between py-1.5">
      <span class="text-title text-ink-soft">启用智能收纳</span>
      <input v-model="settings.smartKeep.enabled" type="checkbox" class="h-4 w-4 accent-cinnabar" />
    </label>
    <!--
      品质下限:九档全给(凡→神)。从前只列灵/玄/地三档,于是"想更严一点"无处可选 ——
      而玩家真正想说的常常是"天品以下都别留"。
    -->
    <div class="py-1.5">
      <div class="flex items-baseline justify-between">
        <span class="text-body text-ink-soft">此品质起一律保留</span>
        <span class="text-note text-ink-faint">低于它才交给缘分裁决</span>
      </div>
      <!-- 选中的档位只靠 borderColor 表达,读屏需要显式的按压态(与 SettingsView 的 theme/battleSpeed 同一范式) -->
      <div class="mt-1.5 flex flex-wrap gap-1" role="group" aria-label="品质保留线">
        <button
          v-for="q in KEEP_QUALITY_CHOICES"
          :key="q.rank"
          class="chip-ink"
          :aria-pressed="settings.smartKeep.minQuality === q.rank"
          :style="
            settings.smartKeep.minQuality === q.rank ? { color: q.color, borderColor: q.color } : {}
          "
          :class="settings.smartKeep.minQuality === q.rank ? '' : 'border-ink/25 text-ink-faint'"
          @click="settings.smartKeep.minQuality = q.rank"
        >
          {{ q.name }}
        </button>
      </div>
    </div>
    <!--
      阶级下限:与品质下限是两条独立的废料定义 —— 品质管"这件成色如何",
      阶级管"这是哪一界的旧物"。它是无条件回收(不看缘分),所以给足读数与警示。
    -->
    <div class="py-1.5">
      <div class="flex items-baseline justify-between">
        <span class="text-body text-ink-soft">此阶以下一律回收</span>
        <span
          class="text-note"
          :class="settings.smartKeep.minTier > 0 ? 'text-cinnabar' : 'text-ink-faint'"
        >
          {{
            settings.smartKeep.minTier > 0
              ? `低于 ${settings.smartKeep.minTier} 阶:不问缘分`
              : "未启用"
          }}
        </span>
      </div>
      <div class="mt-1.5 flex items-center gap-2" role="group" aria-label="此阶以下回收的下限">
        <button
          class="chip-ink !px-3"
          :disabled="settings.smartKeep.minTier <= 0"
          aria-label="降低回收下限"
          @click="bumpMinTier(-1)"
        >
          −
        </button>
        <span class="tabular w-14 text-center font-kai text-section text-ink">
          {{ settings.smartKeep.minTier > 0 ? `${settings.smartKeep.minTier} 阶` : "关" }}
        </span>
        <button
          class="chip-ink !px-3"
          :disabled="settings.smartKeep.minTier >= 32"
          aria-label="提高回收下限"
          @click="bumpMinTier(1)"
        >
          ＋
        </button>
        <span class="ml-1 text-note text-ink-faint"> 你当前可到 {{ playerTier }} 阶 </span>
      </div>
    </div>
    <!--
      「线下不看缘分」:承接从前藏在「一键分解」里的那股需求(显式废料声明),
      但把它收回政策弹窗、并排在保留线之后 —— 线上的件永远不受它影响。
    -->
    <label class="flex items-center justify-between py-1.5">
      <span class="text-body text-ink-soft">
        线下不看缘分,一律回收
        <span class="block text-note text-ink-faint">低于保留线的件不再由核心词条/套件救回</span>
      </span>
      <input
        v-model="settings.smartKeep.junkBelowLine"
        type="checkbox"
        class="h-4 w-4 accent-cinnabar"
      />
    </label>
    <!--
      读数:按**当前**规则体检行囊 —— 收纳最吓人的地方是"看不见",
      所以这里摊开"会扔几件、各因哪条规则",调开关时数字跟着动。
    -->
    <div
      v-if="settings.smartKeep.enabled"
      class="mt-1 rounded-md bg-paper-deep/60 px-2.5 py-2 text-note"
    >
      <p class="text-ink-soft tabular">
        依当前规则:行囊 {{ impact.candidates }} 件中留 {{ impact.keep }} 件 · 化尘
        {{ impact.recycle }} 件
      </p>
      <p
        v-for="row in impact.byReason"
        :key="row.reason"
        class="mt-0.5 flex justify-between tabular"
      >
        <span class="text-ink-faint">{{ row.reason }}</span>
        <span class="text-cinnabar">{{ row.count }} 件</span>
      </p>
      <p v-if="impact.byReason.length === 0" class="mt-0.5 text-ink-faint">
        眼下没有会被自动判掉的件
      </p>
    </div>
    <label class="flex items-center justify-between py-1.5">
      <span class="text-body text-ink-soft">保留主流派核心词条件</span>
      <input
        v-model="settings.smartKeep.keepCoreAffix"
        type="checkbox"
        class="h-4 w-4 accent-cinnabar"
      />
    </label>
    <label class="flex items-center justify-between py-1.5">
      <span class="text-body text-ink-soft">保留组合技部件(副体系词条)</span>
      <input
        v-model="settings.smartKeep.keepComboPiece"
        type="checkbox"
        class="h-4 w-4 accent-cinnabar"
      />
    </label>
    <label class="flex items-center justify-between py-1.5">
      <span class="text-body text-ink-soft">保留成套共鸣件(机制优先)</span>
      <input
        v-model="settings.smartKeep.keepSetPiece"
        type="checkbox"
        class="h-4 w-4 accent-cinnabar"
      />
    </label>
    <label class="flex items-center justify-between py-1.5">
      <span class="text-body text-ink-soft">保留词条近满件</span>
      <input
        v-model="settings.smartKeep.keepPerfectRolls"
        type="checkbox"
        class="h-4 w-4 accent-cinnabar"
      />
    </label>
    <template #footer>
      <!-- 一键清理二步确认:整包报废,按一下不该就此了结 -->
      <template v-if="!cleanConfirm">
        <button class="btn-ghost w-full !text-body" @click="cleanConfirm = true">
          依此规则清理行囊(未锁定的无缘之物化尘)
        </button>
      </template>
      <template v-else>
        <p class="mb-2 text-center text-body text-cinnabar">
          将把行囊中未锁定的无缘之物尽数化尘,共 {{ cleanPlanned.count }} 件,拿回
          {{ batchYieldText(cleanPlanned) }}——此举不可逆,仍要清理?
        </p>
        <div class="flex gap-2">
          <button class="btn-ghost flex-1 !text-body" @click="cleanConfirm = false">再想想</button>
          <button class="btn-seal flex-1 !text-body" @click="smartClean()">清理化尘</button>
        </div>
      </template>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import BaseModal from "@/components/common/BaseModal.vue";
import { useInventoryStore } from "@/stores/inventory";
import { usePlayerStore } from "@/stores/player";
import { useSettingsStore } from "@/stores/settings";
import { useUiStore } from "@/stores/ui";
import { QUALITIES } from "@/data/qualities";
import { maxTierForMajor } from "@/data/regions";
import { batchYieldText, decomposeBatch, decomposeByRanks, decomposePreview } from "@/core/forge";
import { salvageOf } from "@/core/salvage";
import { smartKeepImpact, smartRecycleTargets } from "@/core/smartKeep";
import { add, gnZero } from "@/utils/gnum";

defineProps<{ decomposeOpen: boolean; smartOpen: boolean }>();
// decomposeOpen / smartOpen(页面状态)留 InventoryView,这里只回传两个 close
// —— 弹窗不许越手改别人的账。
const emit = defineEmits<{ "close-decompose": []; "close-smart": [] }>();

const inventory = useInventoryStore();
const player = usePlayerStore();
const settings = useSettingsStore();
const ui = useUiStore();

function batchDecompose(): void {
  // 总账那一条由服务自己报(逐件弹提示只会互相顶掉)
  if (decomposeByRanks(settings.decomposeRanks) === 0) ui.toast("无可分解之物", "info");
}

// ---- 一键分解弹窗 ----
/** 各品质档的现存件数与分解返还(与服务同一套算法:弹窗上写多少就是真给多少) */
const decomposeRows = computed(() =>
  QUALITIES.map((q) => {
    const got = decomposePreview([q.rank]);
    return {
      rank: q.rank,
      name: q.name,
      color: q.color,
      count: got.count,
      text: batchYieldText(got),
    };
  }),
);

const decomposeTotal = computed(() =>
  decomposeRows.value
    .filter((r) => settings.decomposeRanks.includes(r.rank))
    .reduce((sum, r) => sum + r.count, 0),
);

/** 已勾选那几档的总账 */
const decomposePlanned = computed(() => decomposePreview(settings.decomposeRanks));

function toggleRank(rank: number): void {
  const adding = !settings.decomposeRanks.includes(rank);
  settings.decomposeRanks = adding
    ? [...settings.decomposeRanks, rank].sort((a, b) => a - b)
    : settings.decomposeRanks.filter((r) => r !== rank);
  // 勾选只是「标记该档为废料」——行囊内现存同类不在此刻销毁,待玩家点「分 解」确认。
  // (智能收纳开启后,拾取到该档才会自动回收——那是不占行囊的入包裁决,与行囊内已存之物无关;未开启则照常入包。)
}

function confirmDecompose(): void {
  batchDecompose();
  emit("close-decompose");
}

// ---- 智能收纳 ----
/**
 * 品质下限的九档全给(凡→神)—— 只列灵/玄/地那三档时,"想更严一点"无处可选。
 * 名字与配色都取自品质表,不在这里另抄一份。
 */
const KEEP_QUALITY_CHOICES = QUALITIES.map((q) => ({ rank: q.rank, name: q.name, color: q.color }));

/** 玩家当前能到的最深层级 —— 给阶级下限一个参照(区域表的唯一口径) */
const playerTier = computed(() => maxTierForMajor(player.major));

function bumpMinTier(delta: number): void {
  settings.smartKeep.minTier = Math.max(0, Math.min(32, settings.smartKeep.minTier + delta));
  cleanConfirm.value = false;
}

/** 按当前规则的体检读数(与裁决同一口径,见 core/smartKeep.smartKeepImpact) */
const impact = computed(() => smartKeepImpact(inventory.bagItems));

/** 待清理件数(确认提示用)—— 与读数同源 */
const cleanCount = computed(() => impact.value.recycle);

/**
 * 待清理的预期收益:与真下手的 smartClean 用同一套目标(未上锁 + 裁决无缘)、
 * 同一份 salvageOf —— 只算不花,把「会拿回多少器灵尘 / 退多少灵石」在按下前摊开
 * (与一键分解的 decomposePreview 同一纪律)。
 */
const cleanPlanned = computed(() => {
  let dust = 0;
  let stone = gnZero();
  for (const it of smartRecycleTargets(inventory.bagItems)) {
    const g = salvageOf(it);
    dust += g.dust;
    stone = add(stone, g.stone);
  }
  return { count: cleanCount.value, dust, stone };
});

/** 清理确认态:按一次按钮先落在「再想想/清理化尘」上 */
const cleanConfirm = ref(false);

function smartClean(): void {
  cleanConfirm.value = false;
  const got = decomposeBatch(smartRecycleTargets(inventory.bagItems));
  // 级别与一键换装同族(InventoryView):有化尘 = 正结果 success,空转 = 中性 info
  ui.toast(
    got.count > 0
      ? `收纳毕:${got.count} 件无缘之物化尘,${batchYieldText(got)}`
      : "行囊中皆是有缘之物",
    got.count > 0 ? "success" : "info",
  );
  emit("close-smart");
}
</script>
