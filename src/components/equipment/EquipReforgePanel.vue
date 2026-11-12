<script setup lang="ts">
/**
 * 重铸面板 —— 页脚「重铸与封存」块(Phase 30.1)整体(拆自 EquipmentDetailDialog)。
 *
 * 归属:重铸(一键直达,无两步确认——用户拍板连贯性优先)、封存价签与短差(行内
 * 「封存/解除」操作在 EquipSealPanel,逐词条行用)、重铸说明与已重铸/已封存
 * 计数、自动重铸(多选停止词条 + 最低值 + 预算 + 开洗)、以及词条转移的
 * 入口开关(转移本体在 AffixTransferPanel —— 入口与它同处一列,拆到两个
 * 组件再拼一列毫无收益,故开关随本面板)。
 *
 * 状态在 store 的自读 pinia:自读 ui.equipDetailUid + inventory,与宿主拿到
 * 同一份 inst;成本/上限/封存容量全读 core/reforge 与品质表,不持第二份账。
 * 换一件装备(或行囊里没了这件)即收起自动重铸与转移面板
 * (原宿主 watch(inst) 的语义,随块搬入)。
 */
import { computed, ref, watch } from "vue";
import { useUiStore } from "@/stores/ui";
import { useInventoryStore } from "@/stores/inventory";
import { useResourcesStore } from "@/stores/resources";
import { affixDef } from "@/data/affixes";
import { qualityDef } from "@/data/qualities";
import { skillStageName } from "@/data/crafting";
import {
  BLUEPRINT_MASTERY_PER_REFORGE,
  BLUEPRINT_ROLL_BONUS_MAX,
  REFORGE_ROLL_MAX,
} from "@/data/constants";
import {
  blueprintRollBonus,
  effectiveReforgeRollFloor,
  expectedReforgesFor,
  autoReforge,
  reforgeEquipment,
  reforgeCost,
  sealCapacity,
  sealCost,
  inscribeRollFloor,
  reforgeAffixPool,
  type ReforgeTarget,
} from "@/core/reforge";
import { formatGN, formatPercent } from "@/utils/format";
import {
  clampReforgeRolls,
  reforgeBudget,
  reforgeBudgetLine,
  REFORGE_BUDGET_MAX,
} from "@/ui/reforgeBudget";
import { toNum, subClamp } from "@/utils/gnum";
import { useLoreStore } from "@/stores/lore";
import { blueprintReforgesUntilMastered } from "@/core/blueprintMastery";
import { INSIGHT_PER_BLUEPRINT } from "@/data/samsara";
import AffixTransferPanel from "./AffixTransferPanel.vue";

const ui = useUiStore();
const inventory = useInventoryStore();
const resources = useResourcesStore();
const lore = useLoreStore();

const inst = computed(() =>
  ui.equipDetailUid ? inventory.findItem(ui.equipDetailUid) : undefined,
);

// ---- 重铸与封存 (Phase 30.1) ----
const reforgeCostVal = computed(() => (inst.value ? reforgeCost(inst.value) : null));
/** 付不起即灰:重铸要器灵尘与灵石两道账,缺一不可(与 forge.upgradeEquipment 同口径) */
const reforgeAffordable = computed(() => {
  const c = reforgeCostVal.value;
  if (!c) return false;
  return resources.hasSmall("dust", c.dust) && resources.hasStone(c.stone);
});
const sealCostVal = computed(() => (inst.value ? sealCost(inst.value) : null));
/** 封存付得起吗 —— 成本与 sealAffix 同源(sealCost),仅灵石一道账,缺则置灰 */
const sealAffordable = computed(
  () => sealCostVal.value !== null && resources.hasStone(sealCostVal.value),
);
/** 封存短额:走 GNum 指数感知减法(subClamp,与天道熔炉同款),差多少明说「尚差 N 灵石」 */
const sealShortfall = computed(() =>
  sealCostVal.value === null ? 0 : toNum(subClamp(sealCostVal.value, resources.spiritStone)),
);
/** 这一件按品质能有多少条词条:上限来自品质表,不在界面里另写一份 */
const affixCap = computed(() => (inst.value ? qualityDef(inst.value.quality).affixes[1] : 0));
/** 铭纹决定新词条掷点下限;阶段名与技艺进度条同源,不给重铸面板再造一套等级名 */
const inscribeLevel = computed(() => lore.skillLevel("inscribe"));
const inscribeFloor = computed(() => inscribeRollFloor(inscribeLevel.value));
const inscribeStage = computed(() => skillStageName(inscribeLevel.value));
/** 器谱逐模板:洗这一件会精进这张图,不会顺带看懂别的装备 */
const blueprintMastery = computed(() =>
  inst.value ? lore.blueprintMastery(inst.value.templateId) : 0,
);
const blueprintBonus = computed(() => blueprintRollBonus(blueprintMastery.value));
const blueprintReforgesLeft = computed(() =>
  blueprintReforgesUntilMastered(blueprintMastery.value),
);
/** 实际喂给重铸判定的保底:铭纹与器谱相加后封顶,与 core/reforge 同源 */
const reforgeFloor = computed(() =>
  effectiveReforgeRollFloor(inscribeLevel.value, blueprintMastery.value),
);

function doReforge(): void {
  if (inst.value) reforgeEquipment(inst.value.uid);
}

// ---- 自动重铸(玩家反馈:一键重铸多次,洗到指定词条就停) ----
const autoOpen = ref(false);
const transferOpen = ref(false);
const autoBudget = ref(50);
/** 预算越界输入(手打 0 / 600)不静默按 500 洗:提交时即夹到 [1,500],让
 * 「至多洗 N 次」显示与实跑 clampAutoBudget 同口径 —— 预览与实发不许脱节。 */
function clampAutoBudget(): void {
  const raw = Math.floor(Number(autoBudget.value) || 0);
  autoBudget.value = clampReforgeRolls(raw);
}
/** 停止条件:任一命中即停;minRoll 给「数值范围」那一嘴 */
const autoTargets = ref<ReforgeTarget[]>([]);
/**
 * 同屏可选几条 —— 上限与「至多 N 条」那句文案共读这一枚。
 * 从前两边各写一个 3:调上限那天文案就开始撒谎(AGENTS「改常数就撒谎」)。
 */
const AUTO_TARGET_LIMIT = 3;
/** 新选中的目标默认求「高值」:拉到底 0% 即回到「出现就行」 */
const AUTO_TARGET_DEFAULT_ROLL = 0.5;
/** 首洗成本判付不起:自动重铸每洗与单次重铸同源(reforgeCost),缺一道账即灰 */
const autoAffordable = computed(() => {
  const c = reforgeCostVal.value;
  if (!c) return false;
  return resources.hasSmall("dust", c.dust) && resources.hasStone(c.stone);
});

/**
 * 可选的停止词条:当前装备**真能洗到**的那些 —— 与重铸抽取池同规则
 * (槽位匹配 + 品质门槛不高于当前),而不是全 113 条里按权重取前 24。
 * 否则连「想洗的词条在 24 名开外」都选不进去,自动重铸就等于承诺了
 * 一份它兑现不了的面板。
 */
const affixOptions = computed(() => {
  if (!inst.value) return [];
  return [...reforgeAffixPool(inst.value)].sort((a, b) => b.weight - a.weight);
});

/** 选中目标按当前阈值与铭纹保底重算约几次;null = 当前不可能命中 */
function autoTriesOf(target: ReforgeTarget): number | null {
  return triesOf(target.affixId, target.minRoll ?? 0);
}
const autoReachable = computed(() => autoTargets.value.some((t) => autoTriesOf(t) !== null));

/**
 * 这一押的总账(见 ui/reforgeBudget)。
 *
 * 面板上原本有三样分散的读数:预算「至多洗 N 次」、单价「每洗 尘×12 · 石 800」、
 * 逐条的「约 M 次」—— 唯独没有把它们乘起来的那一个数:这一押**最多花掉多少**。
 * 玩家要决定的是「押不押」,而那个问题要的是总价。
 *
 * 价目仍取自 core/reforge(同一个 reforgeCostVal),这里只做乘法。
 */
const autoBudgetCost = computed(() =>
  reforgeBudget(
    autoBudget.value,
    reforgeCostVal.value
      ? { dust: reforgeCostVal.value.dust, stone: reforgeCostVal.value.stone }
      : null,
    { dust: resources.dust, stone: resources.spiritStone },
  ),
);

function isAutoTarget(id: string): boolean {
  return autoTargets.value.some((t) => t.affixId === id);
}

function toggleAutoTarget(id: string): void {
  if (isAutoTarget(id)) autoTargets.value = autoTargets.value.filter((t) => t.affixId !== id);
  // 默认先求「高值」;拉到底 0% 即回到「出现就行」
  else if (autoTargets.value.length < AUTO_TARGET_LIMIT)
    autoTargets.value = [...autoTargets.value, { affixId: id, minRoll: AUTO_TARGET_DEFAULT_ROLL }];
}

function closeAuto(): void {
  autoOpen.value = false;
  autoTargets.value = [];
}

function runAutoReforge(): void {
  if (!inst.value) return;
  const targets = autoTargets.value;
  const budget = clampReforgeRolls(autoBudget.value);
  const out = autoReforge(inst.value.uid, targets, budget);
  const cost = `花 器灵尘×${out.dust} · 灵石 ${formatGN(out.stone)}`;
  // 「没洗到目标」不等于「没洗动」:每次重铸词条都尽数重掷,结账要报清现在这一身落在哪
  const wanted = autoTargets.value.map((t) => affixDef(t.affixId)?.name ?? t.affixId).join("、");
  const now = out.affixIds.map((id) => affixDef(id)?.name ?? id).join("、") || "空";
  if (out.stop === "target" && out.hit) {
    ui.toast(
      `洗出「${affixDef(out.hit.id)?.name ?? out.hit.id}」值 ${formatPercent(out.hit.roll, 0)} —— 共洗 ${out.rolls} 次,${cost}`,
      "success",
    );
  } else if (out.stop === "budget") {
    ui.toast(
      `定好的次数用完了:连洗 ${out.rolls} 次,未能撞上「${wanted}」。如今这一身是:${now},${cost}`,
      "warn",
    );
  } else if (out.stop === "broke") {
    if (out.rolls === 0) {
      ui.toast(`灵石或器灵尘未足,难开这一炉,${cost}`, "warn");
    } else {
      ui.toast(`灵石/器灵尘见底,洗了 ${out.rolls} 次即止;今一身为 ${now},${cost}`, "warn");
    }
  } else if (out.stop === "unreachable") {
    ui.toast(
      `这些目标当前不会命中:封存词条不会重掷,或阈值已到 ${formatPercent(REFORGE_ROLL_MAX, 0)};分文未动`,
      "warn",
    );
  } else {
    // frozen 一档兼两种收法:无位可洗(全封存/无词条),或装备已不在行囊
    const gone = inst.value !== undefined && !inventory.findItem(inst.value.uid);
    ui.toast(gone ? "此物已不在行囊,重铸无从谈起" : "此物已无未封存词条,无从重铸", "info");
  }
  // 结账即收板:结果已写在 toast 与装备词条上,想再调条件重开一次即可
  closeAuto();
}

/**
 * 重铸与自动重铸**一键直达,没有两步确认**(用户拍板 2026-10-18:每次都要
 * 先「武装」再确认,连洗几批时严重影响连贯性)。
 * 误触的代价经过权衡后可接受:重掷的是未封存词条(封存可提前保护),
 * 洗完的结果也明写进 toast —— 不像分解那样不可逆地失去整件。
 * 换一件装备(或这件已不在行囊)仍会收起两块展开面板。
 */
watch(inst, () => {
  autoOpen.value = false;
  transferOpen.value = false;
  autoTargets.value = [];
});

/** 洗到这一条的平均次数(只给次数,不给概率) */
function triesOf(id: string, minRoll = 0): number | null {
  const it = inst.value;
  return it ? expectedReforgesFor(it, id, { minRoll, rollFloor: reforgeFloor.value }) : null;
}
</script>

<template>
  <!--
    工坊这一段按「动作在前、账目在后」重排(2026-11-12)。

    原先的顺序是:重铸/封存 → 五段居中的散文 → 两个折叠钮 → 自动重铸面板。
    由此有两处会自己推着自己跑:
      一 重铸会**连条数一起重掷**(凡品 1 条、仙品 8 条,见 data/qualities 的
         affixes 区间),而重铸钮就排在词条账下面 —— 每按一次,按钮被自己长出来的
         词条往下顶,实测同一件在 796px 与 1008px 之间来回跳,幅度 212px;
      二 自动重铸的折叠钮排在**它自己的面板之上那五段散文上**,收起/展开会让
         钮本身挪位;面板里的「开 洗」又被上面的滑杆往下推。
    故现在的顺序是:动作行(重铸 / 封存价)→ 炉验账 → 两枚折叠钮 → 各自的展开正文。
    每个钮都排在它自己展开的正文**之前**(disclosure 的标准摆法),也没有一枚
    排在会随操作变长的那一摞之后 —— 反复按的那几枚钮,位置只由「这一件是什么」
    决定,不再由它们自己的结果决定。
  -->
  <!-- 重铸与封存 (Phase 30.1) -->
  <template v-if="reforgeCostVal || sealCostVal">
    <div class="flex gap-2 text-body tinylens:flex-col">
      <button
        v-if="reforgeCostVal"
        class="btn-ghost flex-1 !py-1 tinylens:flex-col"
        :disabled="!reforgeAffordable"
        @click="doReforge"
      >
        重铸词条
        <span class="ml-1 tabular text-note text-ink-faint tinylens:ml-0">
          器灵尘×{{ formatGN(reforgeCostVal.dust) }} · 灵石 {{ formatGN(reforgeCostVal.stone) }}
        </span>
      </button>
      <div
        v-if="sealCostVal"
        data-equipment-seal-price
        class="flex flex-1 items-center justify-center border-l px-2 py-1 tinylens:border-l-0 tinylens:border-t"
        :class="sealAffordable ? 'border-qing/40 text-qing' : 'border-ink/15 text-ink-faint'"
      >
        封存一词 {{ formatGN(sealCostVal) }}
      </div>
    </div>
    <!-- 付不起就把缺摆出来(与强化同款):重铸同样器灵尘+灵石两道账,缺谁明说谁 -->
    <p v-if="reforgeCostVal && !reforgeAffordable" class="mt-1 text-note text-cinnabar tabular">
      尚差 器灵尘×{{ formatGN(Math.max(0, reforgeCostVal.dust - resources.dust)) }} · 灵石
      {{ formatGN(Math.max(0, toNum(reforgeCostVal.stone) - toNum(resources.spiritStone))) }}
    </p>
    <!-- 封存只算灵石一道账:付不起同样置灰+列差,不许只有点了才听见 toast -->
    <p v-if="sealCostVal && !sealAffordable" class="mt-1 text-note text-cinnabar tabular">
      封存尚差 {{ formatGN(sealShortfall) }} 灵石
    </p>

    <!--
      炉验 —— 这一炉按什么规矩走、你手上已经攒了什么。

      从前这四笔是五段 `text-center` 的散文:整块浮层的正文都是左对齐的账
      (器性、行迹、共鸣缺口),只有这一坨居中,读起来像一条横幅广告;而且
      五行里有两行各说一遍器谱。改成左题签 + 右账目的定义列表:与器性、行迹
      同一套排法,行高收掉一半,信息一条不少 —— 样式在
      `styles/pages/inventory.css` 的 `.equip-forge-ledger`。
    -->
    <dl v-if="reforgeCostVal" class="equip-forge-ledger" data-equipment-forge-ledger>
      <dt>掷点保底</dt>
      <dd>
        <span class="tabular equip-forge-ledger__value"
          >新词条 ≥ {{ formatPercent(reforgeFloor, 0) }}</span
        >
        <span class="equip-forge-ledger__aside tabular"
          >铭纹·{{ inscribeStage }} {{ formatPercent(inscribeFloor, 0) }} ＋ 器谱
          {{ formatPercent(blueprintBonus, 0) }}</span
        >
      </dd>
      <dt>器谱</dt>
      <dd>
        <span class="tabular equip-forge-ledger__value">{{
          formatPercent(blueprintMastery, 0)
        }}</span>
        <span class="equip-forge-ledger__aside tabular"
          >每洗 +{{ formatPercent(BLUEPRINT_MASTERY_PER_REFORGE, 0) }} ·
          <template v-if="blueprintReforgesLeft > 0">再 {{ blueprintReforgesLeft }} 次</template>
          <template v-else>已</template>读通 · 保底再 +{{
            formatPercent(BLUEPRINT_ROLL_BONUS_MAX, 0)
          }}
          · 宿慧 +{{ INSIGHT_PER_BLUEPRINT }}</span
        >
      </dd>
      <dt>这一炉</dt>
      <dd>
        <span
          >条数 ≤ <span class="tabular">{{ affixCap }}</span> 与数值一并重掷</span
        >
        <span class="equip-forge-ledger__aside">封存的不动 · 不计次数</span>
        <template v-if="inst">
          <!--
            「N 次」「N/M」各自锁成一段:195 CSS px 下整句会折行,数字与量词
            若被拆开就成了「已封存 」+ 换行 +「0/2」—— 判据量到过这一条。
          -->
          <span class="equip-forge-ledger__aside tabular"
            ><span class="equip-forge-ledger__value">已重铸 {{ inst.reforgeCount ?? 0 }} 次</span>
            · 已封存
            <span class="equip-forge-ledger__value"
              >{{ (inst.sealedAffixIds ?? []).length }}/{{ sealCapacity(inst) }}</span
            ></span
          >
        </template>
      </dd>
    </dl>

    <!--
      折叠钮一律排在它自己展开的正文之前 —— 收放时钮本身一步不动。
      从前自动重铸的面板在钮**上方**:收起/展开,钮自己跟着上下一整块。
      两枚并排(极窄档 tinylens 上下叠),它们上面是炉验账,高度与词条条数无关。
    -->
    <div class="mt-1 flex gap-2 tinylens:flex-col">
      <button
        v-if="reforgeCostVal"
        class="btn-ghost min-h-[28px] flex-1 whitespace-nowrap !py-1 !text-body"
        :aria-expanded="autoOpen"
        :title="autoOpen ? undefined : '洗到指定词条即停'"
        @click="autoOpen = !autoOpen"
      >
        {{ autoOpen ? "收起自动重铸" : "自动重铸" }}
      </button>
      <button
        class="btn-ghost min-h-[28px] flex-1 whitespace-nowrap !py-1 !text-body"
        :aria-expanded="transferOpen"
        @click="transferOpen = !transferOpen"
      >
        {{ transferOpen ? "收起词条转移" : "词条转移 · 移至别件" }}
      </button>
    </div>

    <!--
      自动重铸:洗到指定词条即停(玩家反馈,可多选、可给最低值)。
      注意它**不属于**天机推演(修士实验室) —— 那是真仙+未装备才有的
      v-if="canWhatIf" 段;重铸是凡人也在用的功能,若嵌在里面,普通玩家点开
      开关只会变字、词条格子与「开洗」永远不渲染(实测即玩家反馈的「没生效」)。
    -->
    <div
      v-if="autoOpen && reforgeCostVal"
      data-equipment-auto-reforge
      class="mt-2 border-t border-ink/10 pt-2.5"
    >
      <p class="mb-1 text-body text-ink-soft">
        洗到这些词条出现就停(任一命中即停,至多 {{ AUTO_TARGET_LIMIT }} 条)
      </p>
      <!-- 多选格是定高滚动框:再多候选也只占 max-h-36,不推动下面那排「开 洗」 -->
      <div class="scroll-pane grid max-h-36 grid-cols-3 gap-1 overflow-y-auto tinylens:grid-cols-2">
        <button
          v-for="af in affixOptions"
          :key="af.id"
          class="rounded-[2px] px-1 py-1 text-note leading-tight active:opacity-60"
          :aria-pressed="isAutoTarget(af.id)"
          :class="
            isAutoTarget(af.id) ? 'border border-cinnabar text-cinnabar' : 'bg-ink/4 text-ink-faint'
          "
          @click="toggleAutoTarget(af.id)"
        >
          {{ af.name
          }}<span v-if="triesOf(af.id)" class="mt-0.5 block text-note text-ink-soft"
            >约 {{ triesOf(af.id) }} 次</span
          >
        </button>
      </div>
      <!--
        开洗这一排在多选格**之下、逐条阈值之上**:它上面那两块高度都是定的
        (说明一行 + 定高滚动框),故这一排不会被自己选中的东西推着走;
        而逐条阈值往下长,长的是它下面那片地方。
      -->
      <div class="mt-1.5 flex flex-wrap items-center gap-2">
        <label class="flex min-w-0 items-center gap-1">
          <span class="text-note text-ink-faint tabular">至多洗</span>
          <input
            v-model.number="autoBudget"
            type="number"
            min="1"
            :max="REFORGE_BUDGET_MAX"
            aria-label="自动重铸至多洗几次"
            class="w-16 min-w-0 rounded-[2px] border border-ink/15 bg-paper/70 px-1 py-0.5 text-[16px] tabular"
            @change="clampAutoBudget"
          />
          <span class="text-note text-ink-faint tabular">次</span>
        </label>
        <button
          class="btn-ghost ml-auto shrink-0 whitespace-nowrap !px-3 !py-1 !text-body"
          :disabled="!autoTargets.length || !autoReachable || !autoAffordable"
          :title="
            !autoTargets.length
              ? '先点一条要洗到的词条'
              : !autoReachable
                ? '这些目标当前不会命中'
                : autoAffordable
                  ? undefined
                  : '灵石或器灵尘不足'
          "
          @click="runAutoReforge"
        >
          开 洗
        </button>
      </div>
      <p class="mt-1 text-note tabular" data-equipment-reforge-budget>
        <span class="text-ink-faint"
          >每洗 器灵尘×{{ formatGN(reforgeCostVal.dust) }} · 灵石
          {{ formatGN(reforgeCostVal.stone) }}</span
        >
        <!--
          总账这一行:至多洗几次、这一押最多花多少、手上够不够。
          从前只有单价与逐条的「约 N 次」—— 单看「每洗 12 尘」会觉得便宜,
          乘上 50 次才是真的要花掉的数。
        -->
        <span
          v-if="autoBudgetCost"
          class="mt-0.5 block"
          :class="autoBudgetCost.enough ? 'text-ink-soft' : 'text-cinnabar'"
          data-equipment-reforge-budget-total
        >
          {{ reforgeBudgetLine(autoBudgetCost, formatGN) }}
        </span>
      </p>
      <!-- 首洗就付不起,预告就把它摆出来(与重铸/封存同款):灰钮不许只有 broke toast -->
      <p v-if="autoTargets.length && !autoAffordable" class="mt-1 text-note text-cinnabar tabular">
        尚差 器灵尘×{{ formatGN(Math.max(0, reforgeCostVal.dust - resources.dust)) }} · 灵石
        {{ formatGN(Math.max(0, toNum(reforgeCostVal.stone) - toNum(resources.spiritStone))) }}
      </p>
      <p v-if="autoTargets.length && !autoReachable" class="mt-1 text-note text-cinnabar">
        这些目标不会命中:封存词条不重掷,或阈值已到 {{ formatPercent(REFORGE_ROLL_MAX, 0) }}。
      </p>
      <!-- 选中之后的阈值明细:逐条往下长,长的是「开 洗」之下那一片 -->
      <div v-if="autoTargets.length" class="mt-1.5 space-y-1">
        <div v-for="t in autoTargets" :key="t.affixId" class="space-y-0.5 text-note text-ink-faint">
          <p class="flex items-center gap-2">
            <span class="w-10 shrink-0 font-kai text-ink-soft">{{
              affixDef(t.affixId)?.name ?? t.affixId
            }}</span>
            <input
              v-model.number="t.minRoll"
              type="range"
              min="0"
              :max="REFORGE_ROLL_MAX"
              step="0.05"
              :aria-label="`自动重铸:${affixDef(t.affixId)?.name ?? t.affixId} 保留阈值`"
              class="min-w-0 grow accent-cinnabar"
            />
            <span class="w-12 shrink-0 text-right tabular"
              >≥{{ formatPercent(t.minRoll ?? 0, 0) }}</span
            >
          </p>
          <p
            class="pl-12 text-note tabular"
            :class="autoTriesOf(t) === null ? 'text-cinnabar' : 'text-ink-soft'"
          >
            <template v-if="autoTriesOf(t) === null">不会命中</template>
            <template v-else>按当前门槛,约 {{ autoTriesOf(t) }} 次</template>
          </p>
        </div>
      </div>
    </div>

    <AffixTransferPanel v-if="transferOpen && inst" :source="inst" @close="transferOpen = false" />
  </template>
</template>
