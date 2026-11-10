<template>
  <!--
    宽档:这是全作**内容最多的一扇浮层**(器性 + 词条 + 换装流派 + 工坊四块)。
    桌面分两栏之后,默认档 34rem 每栏只剩 200 出头,词条名一字一行 ——
    实测卷身 1.53 屏,差一点够不到判据的 1.5 上限。宽档在桌面给 52rem。
  -->
  <BaseModal :open="inst !== undefined" :title="template?.name ?? ''" top wide @close="close">
    <div
      v-if="inst && template && resolved"
      class="equip-dossier"
      data-equipment-dossier
      :style="dossierStyle"
    >
      <header class="equip-dossier__hero" data-equipment-hero>
        <span class="equip-dossier__sigil" aria-hidden="true">
          <GameIcon :name="template.icon" :size="30" />
          <QualitySeal
            v-if="rare"
            :quality="inst.quality"
            :size="17"
            class="equip-dossier__quality-seal"
          />
        </span>
        <div class="equip-dossier__identity">
          <p class="equip-dossier__eyebrow">
            <span class="equip-dossier__quality">{{ qualityName }}</span>
            <!-- 品评 —— 这一档凭什么(见 data/qualityVerdicts);与品阶名同处眉题,不另起一行 -->
            <span
              v-if="verdictLine"
              class="equip-dossier__verdict-line"
              data-equipment-verdict-line
              >{{ verdictLine }}</span
            >
            <span>{{ EQUIP_SLOT_NAMES[template.slot] }}</span>
            <span>{{ worldNameOfTier(inst.tier) }}</span>
            <span class="tabular">{{ inst.tier }} 阶</span>
            <span v-if="inst.level > 0" class="text-gold-ink tabular">+{{ inst.level }}</span>
            <span>{{ isEquipped ? "本槽在佩" : "收在行囊" }}</span>
          </p>
          <p class="equip-dossier__desc">{{ template.desc }}</p>
          <!--
            器铭 —— 「这一件」的出身,不是这一类的通名。
            同品同名的件在别处毫无分别(见 core/inscription 的注释);这里给它一枚铭名、
            一句铭文与一道读词条掷点的成色刻度。只有灵品以上才有,故灵品以下整段不出。
            器类与界域不在此复述:眉题上一行已经报过,同一屏说两遍正是本仓刚清掉的那类。
          -->
          <p v-if="inscription" class="equip-dossier__inscription" data-equipment-inscription>
            <span class="equip-dossier__inscription-title font-kai">
              「{{ inscription.title }}」
            </span>
            <span class="equip-dossier__inscription-verse">{{ inscription.verse.text }}</span>
            <span class="equip-dossier__inscription-temper" data-equipment-inscription-temper>
              <span>成色</span>
              <strong class="tabular">{{ inscription.temper }}</strong>
              <span class="equip-dossier__inscription-units">/100</span>
              <!--
                成色的话 —— 67 是什么水平?(见 ui/temperGrade)
                一个既像分数、又没有任何标尺的数,是界面里最容易让人误读的东西;
                评语把它翻译成人能用的判断。
              -->
              <span class="equip-dossier__temper-grade" data-equipment-temper-grade>{{
                temperGradeText(inscription.temper)
              }}</span>
            </span>
          </p>
          <!--
            行迹 —— 它**经历过什么**(见 ui/equipHistory)。
            器铭讲的是「它生来是谁」,这一行讲「它后来成了什么」:炼过几重、洗过几次、
            封存过几条。四笔账早就记在实例上了,只是器评帖一直没读 ——
            玩家点开一件跟了自己几百场的旧器,此前看到的全是出厂信息。
            什么都没做过的一件整段不出,不占地方。
          -->
          <p v-if="historyText" class="equip-dossier__history" data-equipment-history>
            <span class="equip-dossier__history-caption">行迹</span>
            <span class="equip-dossier__history-text tabular">{{ historyText }}</span>
          </p>
        </div>
        <button
          class="equip-dossier__lock"
          :aria-label="inst.locked ? '解锁' : '锁定'"
          :aria-pressed="inst.locked"
          @click="toggleLock"
        >
          <GameIcon :name="inst.locked ? 'lock' : 'unlock'" :size="15" />
          <span>{{ inst.locked ? "已锁" : "未锁" }}</span>
        </button>
      </header>

      <section class="equip-dossier__power" data-equipment-power>
        <div class="equip-dossier__score">
          <span class="equip-dossier__caption">本件战力</span>
          <strong class="font-kai tabular">{{ candidatePowerText }}</strong>
          <small>平铺三围 + 词条折算</small>
        </div>
        <div class="equip-dossier__verdict" :data-verdict="powerComparison?.verdict">
          <span class="equip-dossier__caption">{{ powerVerdictLabel }}</span>
          <strong class="font-kai tabular">{{ powerDeltaText }}</strong>
          <small v-if="compareTarget" data-equipment-compare>
            当前「{{ compareTarget.name }}」
            <span data-equipment-compare-value class="whitespace-nowrap tabular">{{
              incumbentPowerText
            }}</span>
          </small>
          <small v-else-if="isEquipped">此槽当前穿的就是这一件</small>
          <small v-else>空槽可直接补位</small>
        </div>
      </section>

      <EquipNotePanel class="equip-dossier__note" />

      <p v-if="setInfo" class="equip-dossier__resonance">
        <span class="font-kai" :class="setInfo.active ? 'text-jade' : 'text-violet-ink'">
          共鸣「{{ setInfo.def.name }}」{{ setInfo.count }}/{{ setInfo.def.required }}
        </span>
        <span class="text-ink-faint">
          {{ setInfo.def.effectDesc
          }}<template v-if="setInfo.def.hook === 'astral'">
            · 开战护盾 +{{ formatPercent(ASTRAL_SET_SHIELD) }} 最大气血</template
          >
        </span>
        <!-- 还差哪一件、以及下一步该做什么(见 ui/resonanceGap) -->
        <span
          v-if="setInfo.gap.line"
          class="equip-dossier__resonance-gap"
          data-equipment-resonance-gap
        >
          {{ setInfo.gap.line }}
        </span>
      </p>

      <section class="equip-dossier__sheet" data-equipment-stats>
        <header class="equip-dossier__section-head">
          <span>器性</span>
          <small>{{ compareTarget ? "括号内为此件相对当前佩戴的增减" : "本件直接并入道躯" }}</small>
        </header>
        <div class="equip-dossier__stat-list">
          <p v-for="row in flatRows" :key="row.label" class="equip-dossier__stat">
            <span class="text-ink-soft">{{ row.label }}</span>
            <span class="tabular text-ink">
              {{ row.value }}
              <span
                v-if="row.diff"
                class="ml-1 text-body"
                :class="row.up ? 'text-jade' : 'text-cinnabar'"
                >({{ row.diff }})</span
              >
            </span>
          </p>
          <p v-for="row in fixedModRows" :key="row.label" class="equip-dossier__stat">
            <span class="text-ink-soft">{{ row.label }}</span>
            <span class="tabular text-qing">{{ row.value }}</span>
          </p>
        </div>
      </section>

      <section
        v-if="resolved.affixLines.length"
        class="equip-dossier__sheet equip-dossier__sheet--affix"
        data-equipment-affixes
      >
        <header class="equip-dossier__section-head">
          <span>词条</span>
          <small class="tabular">
            {{ inst.affixes.length }} / {{ affixCap }} 条 · {{ qualityName }}上限
          </small>
        </header>
        <ul class="equip-dossier__affixes">
          <li
            v-for="(line, i) in resolved.affixLines"
            :key="line.id"
            class="equip-dossier__affix"
            :class="i > 0 ? 'equip-dossier__affix--divided' : ''"
            :style="{ borderLeft: `2px solid ${AFFIX_RARITY_META[line.rarity].color}` }"
          >
            <span
              class="shrink-0 font-kai text-title"
              :style="{ color: AFFIX_RARITY_META[line.rarity].color }"
            >
              「{{ line.name }}」
            </span>
            <span
              class="shrink-0 text-note"
              :style="{ color: AFFIX_RARITY_META[line.rarity].color }"
            >
              {{ AFFIX_RARITY_META[line.rarity].name }}
            </span>
            <span
              class="ml-auto min-w-0 text-right text-body leading-snug text-ink-soft tinylens:order-3 tinylens:basis-full tinylens:text-left"
            >
              {{ line.before }}<span class="tabular font-medium text-ink">{{ line.value }}</span
              >{{ line.after }}
            </span>
            <EquipSealPanel class="tinylens:order-2" :affix-id="line.id" :name="line.name" />
          </li>
        </ul>
        <p class="equip-dossier__footnote">排序:稀有度(传世 → 常见)→ 掷点;左侧色边即这一条的成色</p>
      </section>

      <section v-if="buildPreview" class="equip-dossier__line-ledger">
        <header class="equip-dossier__section-head">
          <span>换装后的流派</span>
          <small>此件会改写的构筑形状</small>
        </header>
        <p class="equip-dossier__build-row">
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
      </section>

      <section v-if="forgeSkills.length" class="equip-dossier__line-ledger">
        <header class="equip-dossier__section-head">
          <span>炼器进度</span>
          <small>在铁砧前看得见它怎么长</small>
        </header>
        <div class="space-y-1">
          <p
            v-for="s in forgeSkills"
            :key="s.id"
            class="flex items-center gap-2 text-note text-ink-faint"
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
      </section>

      <EquipUpgradePanel />
      <EquipWhatIfPanel />

      <section class="equip-dossier__workshop" data-equipment-workshop>
        <header class="equip-dossier__section-head">
          <span>工坊</span>
          <small>重铸、封存与词条转移</small>
        </header>
        <EquipReforgePanel />
      </section>
    </div>

    <template #footer>
      <div class="flex flex-col gap-2" data-equipment-actions>
        <p
          v-if="salvage"
          data-equipment-salvage
          class="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 text-body text-ink-faint"
        >
          <span data-value-nowrap class="whitespace-nowrap"
            >分解返还{{ inst?.level ? `(${refundRateText()})` : "" }}</span
          >
          <span data-equipment-salvage-cost class="flex flex-wrap justify-end gap-x-1.5 tabular">
            <span data-value-nowrap class="whitespace-nowrap"
              >器灵尘×{{ formatGN(salvage.dust) }}</span
            >
            <span v-if="!isZero(salvage.stone)" data-value-nowrap class="whitespace-nowrap"
              >· 灵石 {{ formatGN(salvage.stone) }}</span
            >
          </span>
        </p>
        <div class="flex gap-2 tinylens:flex-col">
          <button class="btn-seal flex-1" @click="toggleEquip">
            {{ isEquipped ? "卸 下" : "装 备" }}
          </button>
          <button
            v-if="upCost"
            class="btn-ghost flex-1"
            :disabled="!upAffordable"
            :title="upAffordable ? undefined : upShortText"
            @click="doUpgrade"
          >
            强 化
          </button>
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
import { EQUIPMENT_TEMPLATES, equipmentTemplate, EQUIP_SLOT_NAMES } from "@/data/equipment";
import { equipSetDef, setCounts, ASTRAL_SET_SHIELD } from "@/core/equipSet";
import { resonanceGap, templatesOfSet } from "@/ui/resonanceGap";
import { temperGradeText } from "@/ui/temperGrade";
import { equipPowerComparison } from "@/core/equipBest";
import { worldNameOfTier } from "@/core/formulas";
import { inscriptionFor } from "@/core/inscription";
import { equipHistoryText } from "@/ui/equipHistory";
import { resolveEquipStats } from "@/core/equipGen";
import { equipUpgradeCost, upgradeEquipment } from "@/core/forge";
import { useResourcesStore } from "@/stores/resources";
import { refundRateText, salvageOf } from "@/core/salvage";
import { detectBuild } from "@/core/buildDetect";
import { qualityDef } from "@/data/qualities";
import { qualityVerdict } from "@/data/qualityVerdicts";
import { usePlayerStore } from "@/stores/player";
import { formatGN, formatPercent, formatSignedPercent } from "@/utils/format";
import { toNum } from "@/utils/gnum";
import { isZero, sub } from "@/utils/gnum";
import type { AnyStatKey, GNum } from "@/types";
import { AFFIX_RARITY_META, STAT_NAMES } from "@/data/statNames";
import BaseModal from "@/components/common/BaseModal.vue";
import QualitySeal from "@/components/common/QualitySeal.vue";
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
import { colorWithAlpha } from "@/ui/colorVar";
import { isRareQuality, qualityTextColor, qualityTierStyle } from "@/ui/qualityTier";

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
/**
 * 器铭 —— 这一件的出身(见 core/inscription)。灵品以下为 null,卷首整段不出。
 * 与战力、词条、工坊都不联动:它是「这一件是谁」,不是第二条选件依据。
 */
const inscription = computed(() => (inst.value ? inscriptionFor(inst.value) : null));
/**
 * 这一件的行迹 —— 炼过几重、洗过几次、封存过几条(见 ui/equipHistory)。
 * 与器铭并排两件事:上面那句讲它生来是谁,这一行讲它后来成了什么。
 */
const historyText = computed(() => equipHistoryText(inst.value));
const isEquipped = computed(() =>
  inst.value && template.value ? inventory.equipped[template.value.slot] === inst.value.uid : false,
);

/** 对比对象:同部位当前佩戴件。已穿着本件或空槽时不造对照。 */
const compareTarget = computed(() => {
  if (!inst.value || !template.value || isEquipped.value) return null;
  const curUid = inventory.equipped[template.value.slot];
  if (!curUid || curUid === inst.value.uid) return null;
  const item = inventory.findItem(curUid);
  if (!item) return null;
  return { item, name: equipmentTemplate(item.templateId)?.name ?? "当前佩戴" };
});

/**
 * 器评总账 —— 候选列表、详情卷首与页脚动作都认同一份真实战力差。
 * 空槽不拿 0 冒充涨幅；已穿本件则明确报在佩。
 */
const powerComparison = computed(() =>
  inst.value ? equipPowerComparison(inst.value, compareTarget.value?.item) : null,
);
const candidatePowerText = computed(() =>
  powerComparison.value ? formatGN(Math.round(powerComparison.value.candidatePower)) : "—",
);
const incumbentPowerText = computed(() =>
  powerComparison.value?.incumbentPower !== null &&
  powerComparison.value?.incumbentPower !== undefined
    ? formatGN(Math.round(powerComparison.value.incumbentPower))
    : "—",
);
const powerVerdictLabel = computed(() => {
  if (isEquipped.value) return "在本槽";
  const verdict = powerComparison.value?.verdict;
  if (verdict === "empty") return "空槽可补";
  if (verdict === "up") return "换装后更强";
  if (verdict === "down") return "换装后更弱";
  if (verdict === "even") return "两件持平";
  return "换装对比";
});
const powerDeltaText = computed(() => {
  const delta = powerComparison.value?.delta;
  if (delta === null || delta === undefined) return isEquipped.value ? "在佩" : "可补位";
  if (delta === 0) return "持平";
  const amount = formatGN(Math.round(Math.abs(delta)));
  return `${delta > 0 ? "+" : "-"}${amount}`;
});

const upCost = computed(() => (inst.value ? equipUpgradeCost(inst.value.uid) : null));
/** 付不起即灰:强化要器灵尘与灵石两道账,缺一不可(与 forge.upgradeEquipment 同口径)。
 *  页脚「强 化」钮专用;主文的价签/连强账在 EquipUpgradePanel(同一核心函数,两处必同账) */
const upAffordable = computed(() => {
  const c = upCost.value;
  if (!c) return false;
  return resources.hasSmall("dust", c.dust) && resources.hasStone(c.stone);
});

/**
 * 付不起时报出**还差多少**。
 *
 * 这个页脚按钮与 `EquipUpgradePanel`(主文价签)读的是同一个
 * `equipUpgradeCost`,但玩家在这里按下时就看不见那边 —— 灰着不说差什么,
 * 等于「决策信息不完整」(见 AGENTS.md「按钮付不起要列出尚差」)。
 * 与 `EquipSealPanel` 的封存钮同一写法:能付就不显示 title,付不起才报。
 */
const upShortText = computed(() => {
  const c = upCost.value;
  if (!c) return undefined;
  const parts: string[] = [];
  const shortDust = c.dust - resources.dust;
  const shortStone = toNum(c.stone) - toNum(resources.spiritStone);
  if (shortDust > 0) parts.push(`器灵尘×${formatGN(shortDust)}`);
  if (shortStone > 0) parts.push(`灵石×${formatGN(shortStone)}`);
  return parts.length ? `尚差 ${parts.join(" · ")}` : undefined;
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
  /*
   * 还差哪一件(见 ui/resonanceGap)。
   *
   * 只报一个「1/2」等于把三种截然不同的局面说成一种:差的那件在行囊里(换上即可)、
   * 见过但手上没有(去刷)、连见都没见过(先探到那一带)。下一步完全不同,
   * 而玩家此前要自己去装备图鉴里翻才知道是哪一件。
   */
  const wornIds = inventory.equippedItems.map((it) => it.templateId);
  const bagIds = inventory.items.map((it) => it.templateId);
  const seenIds = Object.keys(loreStore.equipLore);
  const gap = resonanceGap(
    def,
    wornIds,
    bagIds,
    seenIds,
    templatesOfSet(setId, EQUIPMENT_TEMPLATES),
  );
  return { def, count, active: count >= def.required, gap };
});

/** 这一件按品质能有多少条词条:上限来自品质表,不在界面里另写一份 */
const affixCap = computed(() => (inst.value ? qualityDef(inst.value.quality).affixes[1] : 0));
const quality = computed(() => (inst.value ? qualityDef(inst.value.quality) : null));
const qualityName = computed(() => quality.value?.name ?? "");
/** 品评一句话(见 data/qualityVerdicts);认不得的档给空串,整格不出 */
const verdictLine = computed(() => (inst.value ? qualityVerdict(inst.value.quality) : ""));
const rare = computed(() => (inst.value ? isRareQuality(inst.value.quality) : false));
const dossierStyle = computed<Record<string, string>>(() => {
  const q = quality.value;
  const item = inst.value;
  if (!q || !item) return {} as Record<string, string>;
  const tier = qualityTierStyle(item.quality);
  return {
    "--equip-tone": q.color,
    "--equip-text": qualityTextColor(item.quality),
    "--equip-wash": colorWithAlpha(q.color, tier.bg),
    "--equip-edge": colorWithAlpha(q.color, tier.border),
  };
});

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
