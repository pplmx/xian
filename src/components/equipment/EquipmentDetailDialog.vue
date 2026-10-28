<template>
  <BaseModal :open="inst !== undefined" :title="template?.name ?? ''" top @close="close">
    <div v-if="inst && template && resolved">
      <div class="flex items-center gap-2">
        <QualityTag :quality="inst.quality" />
        <!-- 界域 + 阶位:同一句「23 阶」在人间界与仙界完全不是一回事,故写清是哪一界 -->
        <span class="text-[11px] text-ink-faint">
          {{ EQUIP_SLOT_NAMES[template.slot] }} · {{ worldNameOfTier(inst.tier) }} ·
          {{ inst.tier }} 阶
        </span>
        <span v-if="inst.level > 0" class="text-[11px] text-gold-ink tabular"
          >+{{ inst.level }}</span
        >
        <button
          class="-m-1.5 flex min-h-[28px] min-w-[28px] items-center justify-center p-1.5 text-ink-faint active:scale-90"
          :aria-label="inst.locked ? '解锁' : '锁定'"
          @click="toggleLock"
        >
          <GameIcon :name="inst.locked ? 'lock' : 'unlock'" :size="15" />
        </button>
      </div>
      <p class="mt-2 t-body text-ink-faint">{{ template.desc }}</p>
      <!-- 备注子面板:标记输入/清除随面板走(EquipNotePanel,自读同一份 inst) -->
      <EquipNotePanel />
      <!--
        共鸣是机制而非数值,但装备卡片此前一个字都不提:玩家在「要不要换掉这件」时,
        看不到它身上拴着一条会断的机制(见 core/equipSet)。
      -->
      <p v-if="setInfo" class="mt-1.5 text-[11px] leading-relaxed">
        <span class="font-kai" :class="setInfo.active ? 'text-jade' : 'text-violet-ink'">
          共鸣「{{ setInfo.def.name }}」{{ setInfo.count }}/{{ setInfo.def.required }}
        </span>
        <span class="ml-1 text-ink-faint"
          >{{ setInfo.def.effectDesc
          }}<template v-if="setInfo.def.hook === 'astral'">
            · 开战护盾 +{{ formatPercent(ASTRAL_SET_SHIELD) }} 最大气血</template
          ></span
        >
      </p>
      <div class="ink-divider my-3" />
      <p v-if="compareTarget" class="mb-1.5 text-[10px] text-ink-faint tabular">
        对比当前佩戴:「{{ compareTarget.name }}」(绿升红降)
      </p>
      <div class="space-y-1.5">
        <p v-for="row in flatRows" :key="row.label" class="flex justify-between text-[14px]">
          <span class="text-ink-soft">{{ row.label }}</span>
          <span class="tabular text-ink">
            {{ row.value }}
            <span
              v-if="row.diff"
              class="ml-1 text-[11px]"
              :class="row.up ? 'text-jade' : 'text-cinnabar'"
              >({{ row.diff }})</span
            >
          </span>
        </p>
        <p v-for="row in fixedModRows" :key="row.label" class="flex justify-between text-[14px]">
          <span class="text-ink-soft">{{ row.label }}</span>
          <span class="tabular text-qing">{{ row.value }}</span>
        </p>
      </div>
      <template v-if="resolved.affixLines.length">
        <div class="ink-divider my-3" />
        <!--
          条数上限按品质给(凡品 0~1 · 神品 6~9),这是玩家最该看见的一件事:
          一件装备的"上限"就在它的品质里,而重铸可以重掷条数 —— 只有把它摊在明面上,
          「要不要为这件洗下去」才算得清。
        -->
        <p
          class="mb-1.5 flex items-baseline justify-between font-kai text-[14px] tracking-[0.3em] text-ink-faint"
        >
          <span>词 条</span>
          <span class="text-[10px] tracking-normal tabular">
            {{ inst.affixes.length }} / {{ affixCap }} 条
            <span class="ml-1 text-ink-faint">({{ qualityName }}上限)</span>
          </span>
        </p>
        <!--
          词条一条一行:名目与稀有度在左、效果在右、**数值单独加粗**(见 resolveEquipStats
          的 before/value/after)。一件神品能挂九条,所以这一列要能扫:
          左边一列名目对齐、右边一列数字对齐,行与行之间不夹长度不一的句子。

          分成九行之后,原来「一条一个色块」的排法会把整张卡片压塌 ——
          色块摞起来,装备本身的层次反而看不见。改成整体一块底 + 行间细分隔线,
          稀有度交给左侧那道色边(与名目同色):一眼看得出哪条是撞上的大运,
          又不至于九块颜色抢戏。
        -->
        <ul class="overflow-hidden rounded-md bg-violet-ink/6">
          <li
            v-for="(line, i) in resolved.affixLines"
            :key="line.id"
            class="flex flex-wrap items-center gap-2 py-1.5 pl-2 pr-1.5"
            :class="i > 0 ? 'border-t border-violet-ink/15' : ''"
            :style="{ borderLeft: `2px solid ${AFFIX_RARITY_META[line.rarity].color}` }"
          >
            <span
              class="shrink-0 font-kai text-[14px]"
              :style="{ color: AFFIX_RARITY_META[line.rarity].color }"
            >
              「{{ line.name }}」
            </span>
            <span
              class="shrink-0 text-[9px]"
              :style="{ color: AFFIX_RARITY_META[line.rarity].color }"
            >
              {{ AFFIX_RARITY_META[line.rarity].name }}
            </span>
            <span
              class="ml-auto min-w-0 text-right text-[11px] leading-snug text-ink-soft tinylens:order-3 tinylens:basis-full tinylens:text-left"
            >
              {{ line.before }}<span class="tabular font-medium text-ink">{{ line.value }}</span
              >{{ line.after }}
            </span>
            <!-- 封存/解除操作组随面板走(EquipSealPanel,自读同一份 inst) -->
            <EquipSealPanel class="tinylens:order-2" :affix-id="line.id" :name="line.name" />
          </li>
        </ul>
        <p class="mt-1 text-[10px] leading-relaxed text-ink-faint">
          排序:稀有度(传世 → 常见)→ 掷点;左侧色边即这一条的成色
        </p>
      </template>
      <template v-if="buildPreview">
        <div class="ink-divider my-3" />
        <p class="flex items-center justify-between text-[14px]">
          <span class="text-ink-faint">装备后流派</span>
          <span class="tabular">
            <template v-if="buildPreview.before">
              <span class="text-ink-soft"
                >{{ buildPreview.before.displayName }}
                {{ formatPercent(buildPreview.before.affinity, 0) }}</span
              >
            </template>
            <template v-else><span class="text-ink-faint">未成路</span></template>
            <span class="mx-1 text-ink-faint">→</span>
            <template v-if="buildPreview.after">
              <span
                class="font-kai"
                :class="
                  buildPreview.after.affinity >= (buildPreview.before?.affinity ?? 0)
                    ? 'text-jade'
                    : 'text-cinnabar'
                "
              >
                {{ buildPreview.after.displayName }}
                {{ formatPercent(buildPreview.after.affinity, 0) }}
              </span>
            </template>
            <template v-else><span class="text-cinnabar">流派散去</span></template>
          </span>
        </p>
      </template>
      <!--
        炼器技艺的进度就该露在铁砧前:锻打/铭纹的经验正是在这里(强化/重铸)长的,
        此前却只在炼丹弹窗的全局技艺表里看得到 —— 在炼器的地方看不见自己在长,
        等于没长。两行小进度,与技艺表同源(skillLevel/skillStageName/skillStageProgress),
        不做第二份出处的判定。
      -->
      <div v-if="forgeSkills.length" class="ink-divider my-3" />
      <div v-if="forgeSkills.length" class="space-y-1">
        <p
          v-for="s in forgeSkills"
          :key="s.id"
          class="flex items-center gap-2 text-[10px] text-ink-faint"
        >
          <span class="w-10 shrink-0 font-kai text-ink-soft">{{ s.name }}</span>
          <span class="w-12 shrink-0 tabular" :class="s.active ? 'text-jade' : ''">{{
            s.stage
          }}</span>
          <ProgressBar
            :value="s.progress"
            :color="s.active ? 'var(--color-jade)' : 'var(--color-ink-faint)'"
            :height="3"
            class="flex-1"
          />
          <span class="w-7 shrink-0 text-right tabular">{{ formatPercent(s.progress, 0) }}</span>
        </p>
      </div>
      <!-- 强化子面板:价签/加成/短差/连强总账随面板走(EquipUpgradePanel,自读同一份 inst) -->
      <EquipUpgradePanel />
      <p v-if="salvage" class="mt-1 flex items-center justify-between text-[11px] text-ink-faint">
        <span>分解返还{{ inst.level > 0 ? `(${refundRateText()})` : "" }}</span>
        <span class="tabular">
          器灵尘×{{ salvage.dust }}
          <template v-if="!isZero(salvage.stone)"> · 灵石 {{ formatGN(salvage.stone) }}</template>
        </span>
      </p>
      <!-- 天机推演子面板:入口/四界局面/主要变化随面板走(EquipWhatIfPanel,自读同一份 inst) -->
      <EquipWhatIfPanel />
    </div>
    <template #footer>
      <div class="flex flex-col gap-2">
        <!--
          重铸与封存子面板:两步武装/封存价签/自动重铸/词条转移入口,整块随面板走
          (EquipReforgePanel,自读同一份 inst;武装态互斥,分家只会造出跨面板接线)。
        -->
        <EquipReforgePanel />
        <div class="flex gap-2 tinylens:flex-col">
          <button class="btn-seal flex-1" @click="toggleEquip">
            {{ isEquipped ? "卸 下" : "装 备" }}
          </button>
          <button
            v-if="upCost"
            class="btn-ghost flex-1"
            :disabled="!upAffordable"
            @click="doUpgrade"
          >
            强 化
          </button>
          <!-- 分解二步确认子面板:武装→确认/再想想随面板走(EquipDecomposePanel);分解成功由面板 emit,宿主关弹窗 -->
          <EquipDecomposePanel @decomposed="close" />
        </div>
      </div>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useUiStore } from "@/stores/ui";
import { useInventoryStore } from "@/stores/inventory";
import { equipmentTemplate, EQUIP_SLOT_NAMES } from "@/data/equipment";
import { equipSetDef, setCounts, ASTRAL_SET_SHIELD } from "@/core/equipSet";
import { worldNameOfTier } from "@/core/formulas";
import { resolveEquipStats } from "@/core/equipGen";
import { equipUpgradeCost, upgradeEquipment } from "@/core/forge";
import { useResourcesStore } from "@/stores/resources";
import { refundRateText, salvageOf } from "@/core/salvage";
import { detectBuild } from "@/core/buildDetect";
import { qualityDef } from "@/data/qualities";
import { usePlayerStore } from "@/stores/player";
import { formatGN, formatPercent, formatSignedPercent } from "@/utils/format";
import { isZero, sub } from "@/utils/gnum";
import type { AnyStatKey, GNum } from "@/types";
import { AFFIX_RARITY_META, STAT_NAMES } from "@/data/statNames";
import BaseModal from "@/components/common/BaseModal.vue";
import QualityTag from "@/components/common/QualityTag.vue";
import EquipNotePanel from "./EquipNotePanel.vue";
import EquipSealPanel from "./EquipSealPanel.vue";
import EquipUpgradePanel from "./EquipUpgradePanel.vue";
import EquipWhatIfPanel from "./EquipWhatIfPanel.vue";
import EquipDecomposePanel from "./EquipDecomposePanel.vue";
import EquipReforgePanel from "./EquipReforgePanel.vue";
import GameIcon from "@/components/common/GameIcon.vue";
import ProgressBar from "@/components/common/ProgressBar.vue";
import { useLoreStore } from "@/stores/lore";
import { SKILLS, skillStageName, skillStageProgress } from "@/data/crafting";
import { isBlueprintMastered } from "@/core/blueprintMastery";

const ui = useUiStore();
const inventory = useInventoryStore();
const player = usePlayerStore();
const resources = useResourcesStore();

const loreStore = useLoreStore();

/**
 * 炼器技艺进度:锻打/铭纹正是在这个界面(强化/重铸)里长的;
 * 器谱则按当前装备模板单独精进 —— 三行都露在铁砧前。
 */
const forgeSkills = computed(() => {
  const ids = new Set(["smithing", "inscribe"]);
  const skills = SKILLS.filter((s) => ids.has(s.id)).map((s) => {
    const lv = loreStore.skillLevel(s.id);
    return {
      id: s.id,
      name: s.name,
      stage: skillStageName(lv),
      progress: skillStageProgress(lv),
      active: skillStageName(lv) !== "生疏",
    };
  });
  const mastery = inst.value ? loreStore.blueprintMastery(inst.value.templateId) : 0;
  return [
    ...skills,
    {
      id: "blueprint",
      name: "器谱",
      stage: isBlueprintMastered(mastery) ? "通晓" : mastery > 0 ? "研读" : "未读",
      progress: mastery,
      active: mastery > 0,
    },
  ];
});

const inst = computed(() =>
  ui.equipDetailUid ? inventory.findItem(ui.equipDetailUid) : undefined,
);
const template = computed(() =>
  inst.value ? equipmentTemplate(inst.value.templateId) : undefined,
);
const resolved = computed(() => (inst.value ? resolveEquipStats(inst.value) : null));
const isEquipped = computed(() =>
  inst.value && template.value ? inventory.equipped[template.value.slot] === inst.value.uid : false,
);
const upCost = computed(() => (inst.value ? equipUpgradeCost(inst.value.uid) : null));
/** 付不起即灰:强化要器灵尘与灵石两道账,缺一不可(与 forge.upgradeEquipment 同口径)。
 *  页脚「强 化」钮专用;主文的价签/连强账在 EquipUpgradePanel(同一核心函数,两处必同账) */
const upAffordable = computed(() => {
  const c = upCost.value;
  if (!c) return false;
  return resources.hasSmall("dust", c.dust) && resources.hasStone(c.stone);
});
/** 分解返还:底材 + 强化投入的配比(文案走 refundRateText,与 DECOMPOSE_REFUND_RATE 同源,不手写「八成」) */
const salvage = computed(() => (inst.value ? salvageOf(inst.value) : null));

/**
 * 这件装备所属的共鸣与其当前件数(只数已佩戴的 —— 共鸣看的是挂载,不是行囊)。
 * 未佩戴时也照实显示「1/2」,让玩家在按下装备之前就看得见差几件。
 */
const setInfo = computed(() => {
  const setId = template.value?.set;
  if (!setId) return null;
  const def = equipSetDef(setId);
  if (!def) return null;
  const count = setCounts(inventory.equippedItems).get(setId) ?? 0;
  return { def, count, active: count >= def.required };
});

/** 这一件按品质能有多少条词条:上限来自品质表,不在界面里另写一份 */
const affixCap = computed(() => (inst.value ? qualityDef(inst.value.quality).affixes[1] : 0));
const qualityName = computed(() => (inst.value ? qualityDef(inst.value.quality).name : ""));

// ---- 装备标记子面板见 EquipNotePanel.vue(草稿/写回随面板走,宿主不再持状态) ----

/** 换装流派预览:契合度 当前 → 装备后 */
const buildPreview = computed(() => {
  if (!inst.value || !template.value || isEquipped.value) return null;
  const slot = template.value.slot;
  const mods = { ...player.finalStats.mods };
  const applyDelta = (source: Record<string, number | undefined>, sign: 1 | -1): void => {
    for (const k in source) {
      const key = k as keyof typeof mods;
      mods[key] = (mods[key] ?? 0) + sign * (source[k] ?? 0);
    }
  };
  const currentUid = inventory.equipped[slot];
  if (currentUid) {
    const currentItem = inventory.findItem(currentUid);
    if (currentItem) applyDelta(resolveEquipStats(currentItem).mods, -1);
  }
  applyDelta(resolveEquipStats(inst.value).mods, 1);
  const before = detectBuild(player.finalStats.mods);
  const after = detectBuild(mods);
  if (!before && !after) return null;
  return { before, after };
});

const flatRows = computed(() => {
  const r = resolved.value;
  if (!r) return [];
  // 与当前佩戴同部位件对比(自身已佩则不对比)
  const cur = compareTarget.value;
  const curFlats = cur ? resolveEquipStats(cur.item).flats : null;
  const rows: { label: string; value: string; diff: string; up: boolean }[] = [];
  const push = (label: string, mine: GNum, theirs: GNum | null): void => {
    if (isZero(mine) && (theirs === null || isZero(theirs))) return;
    let diff = "";
    let up = true;
    if (theirs !== null) {
      const d = sub(mine, theirs);
      up = d.m >= 0;
      if (!isZero(d)) diff = `${up ? "+" : "-"}${formatGN({ m: Math.abs(d.m), e: d.e })}`;
    }
    rows.push({ label, value: `+${formatGN(mine)}`, diff, up });
  };
  push("攻击", r.flats.attack, curFlats?.attack ?? null);
  push("防御", r.flats.defense, curFlats?.defense ?? null);
  push("气血", r.flats.maxHp, curFlats?.maxHp ?? null);
  return rows;
});

/** 对比对象:同部位当前佩戴件 */
const compareTarget = computed(() => {
  if (!inst.value || !template.value || isEquipped.value) return null;
  const curUid = inventory.equipped[template.value.slot];
  if (!curUid || curUid === inst.value.uid) return null;
  const item = inventory.findItem(curUid);
  if (!item) return null;
  return { item, name: equipmentTemplate(item.templateId)?.name ?? "当前佩戴" };
});

const fixedModRows = computed(() => {
  const t = template.value;
  if (!t?.fixedMods) return [];
  return Object.entries(t.fixedMods).map(([k, v]) => ({
    label: STAT_NAMES[k as AnyStatKey] ?? k,
    value: formatSignedPercent(v as number),
  }));
});

function close(): void {
  ui.equipDetailUid = null;
}

function toggleEquip(): void {
  if (!inst.value || !template.value) return;
  if (isEquipped.value) {
    inventory.unequip(template.value.slot);
  } else {
    inventory.equip(inst.value.uid, template.value.slot);
  }
}

function doUpgrade(): void {
  if (inst.value) upgradeEquipment(inst.value.uid);
}

// 连强到顶的账与动作在 EquipUpgradePanel.vue(宿主页脚只留单级「强 化」)
// 分解二步确认在 EquipDecomposePanel.vue(分解成功 emit('decomposed'),宿主关弹窗)
// 重铸/自动重铸/词条转移入口在 EquipReforgePanel.vue(武装态互斥,整块随面板走)

function toggleLock(): void {
  if (!inst.value) return;
  inventory.replaceItem({ ...inst.value, locked: !inst.value.locked });
}
</script>
