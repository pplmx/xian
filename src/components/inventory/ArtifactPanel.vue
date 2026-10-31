<template>
  <section
    class="artifact-desk"
    data-artifact-overview
    :data-artifact-owned="artifactSummary.total"
    :data-artifact-carried="artifactSummary.carried"
    :data-artifact-slots-count="artifactSummary.slots"
    :data-artifact-ready="artifactSummary.ready"
    :data-artifact-short="artifactSummary.short"
    :data-artifact-maxed="artifactSummary.maxed"
  >
    <div class="artifact-desk__head">
      <span class="artifact-desk__seal" aria-hidden="true">{{ artifactDeskSeal }}</span>
      <div class="artifact-desk__copy">
        <p class="artifact-desk__eyebrow">法宝阵位</p>
        <p class="artifact-desk__title">{{ artifactDeskLead.title }}</p>
        <p class="artifact-desk__detail">{{ artifactDeskLead.detail }}</p>
      </div>
      <p class="artifact-desk__position tabular">
        <span>随身</span>
        <strong>{{ artifactSummary.carried }}</strong>
        <span>/ {{ artifactSummary.slots }}</span>
      </p>
    </div>

    <div class="artifact-desk__seats" role="list" aria-label="法宝位">
      <div
        v-for="(seat, index) in equippedSeatRows"
        :key="seat.defId ?? `empty-${index}`"
        class="artifact-desk__seat"
        :class="{ 'is-filled': seat.def && seat.owned }"
        role="listitem"
        data-artifact-seat
        :data-artifact-seat-filled="seat.def && seat.owned ? 'true' : 'false'"
      >
        <span class="artifact-desk__seat-index">法 {{ index + 1 }}</span>
        <span class="artifact-desk__seat-name">{{ seat.def?.name ?? "空悬" }}</span>
        <span class="artifact-desk__seat-meta tabular">
          {{ seat.owned ? artifactLevelLabel(seat.owned.level) : "待入位" }}
        </span>
      </div>
    </div>

    <div class="artifact-desk__ledger">
      <div class="artifact-desk__reading" data-artifact-summary="ready">
        <span>可炼</span>
        <strong class="tabular">{{ artifactSummary.ready }}</strong>
        <small>{{ artifactSummary.ready ? "料已备齐" : "暂无一件" }}</small>
      </div>
      <div class="artifact-desk__reading" data-artifact-summary="short">
        <span>欠料</span>
        <strong class="tabular">{{ artifactSummary.short }}</strong>
        <small>{{ artifactSummary.short ? "卡片列差额" : "无待补" }}</small>
      </div>
      <div class="artifact-desk__reading" data-artifact-summary="maxed">
        <span>满重</span>
        <strong class="tabular">{{ artifactSummary.maxed }}</strong>
        <small>共 {{ artifactSummary.total }} 件</small>
      </div>
    </div>

    <p class="artifact-desk__rule">
      祭炼一重,被动与神通各强 {{ formatPercent(ARTIFACT_LEVEL_BONUS) }},至多
      {{ cnNumber(ARTIFACT_MAX_LEVEL) }} 重;封顶后不再涨,卡片会标明只涨哪一部分。
      <span v-if="artifactSlots < ARTIFACT_MAX_SLOTS">
        {{ artifactUnlockRealm }}境开启第{{ cnNumber(ARTIFACT_MAX_SLOTS) }}法宝位。
      </span>
    </p>
  </section>
  <div
    v-if="artifactRows.length"
    class="artifact-ledger"
    :data-artifact-total="artifactRows.length"
    :data-artifact-shown="artifactPage.shown"
    :data-artifact-start="artifactPage.start"
  >
    <div class="artifact-ledger__head">
      <span class="artifact-ledger__title">法宝全册</span>
      <span class="artifact-ledger__hint">按品阶降序 · 祭炼高者在前</span>
      <span class="artifact-ledger__count tabular">
        现看 {{ artifactPage.start + 1 }}–{{ artifactPage.shown }} / 共 {{ artifactRows.length }}
      </span>
    </div>
    <div class="inventory-artifact-list">
      <!--
      法宝行卡的品阶晕染:边框随档加深(qualityTier 同源),天/仙/神另有角章。
      底色**固定 6%**(不随档):法宝行是多行文字密卡(名/描述/被动/神通 11-14px),
      进阶档的 10% 与稀有档的 13% 底会把文字对比度压破 AA(货架 4.35:1 的同一教训,
      见 MarketView shelfTier)—— 档位线索由边框与角章承担,底色退回弱晕。
    -->
      <div
        v-for="row in artifactPage.visible"
        :key="row.def.id"
        :data-artifact-row="row.def.id"
        tabindex="-1"
        class="card-ink artifact-card relative px-4 py-3"
        :style="{
          borderColor: colorWithAlpha(
            qualityDef(row.def.quality).color,
            tierOf(row.def.quality).border,
          ),
          background: colorWithAlpha(qualityDef(row.def.quality).color, 0.06),
        }"
      >
        <!-- 佩戴中的法宝盖「随」章(玉色,与装备格的「佩」同族) —— 靠按钮文字区分太隐晦 -->
        <span
          v-if="row.equipped"
          class="absolute left-2 top-2 rounded-sm bg-jade/6 px-[3px] font-kai text-note leading-[1.4] text-jade"
          >随</span
        >
        <!-- 天/仙/神右上盖品阶阴文章 —— 与装备/丹药同一套视觉语言(见 qualityTier) -->
        <span v-if="isRareQuality(row.def.quality)" class="absolute right-2 top-2 leading-none">
          <QualitySeal :quality="row.def.quality" :size="16" />
        </span>
        <div class="artifact-card__head flex flex-wrap items-center gap-x-2 gap-y-1">
          <GameIcon
            :name="row.def.icon"
            :size="18"
            :style="{ color: qualityDef(row.def.quality).color }"
          />
          <span class="font-kai text-title" :style="{ color: qualityDef(row.def.quality).color }">{{
            row.def.name
          }}</span>
          <QualityTag :quality="row.def.quality" />
          <!-- 「重」而不是「阶」:阶是地界与装备层级的词,法宝这一头说的是祭炼了几重 -->
          <span class="ml-auto shrink-0 tabular text-body text-gold-ink">{{
            artifactLevelLabel(row.owned.level)
          }}</span>
        </div>
        <!-- 祭炼进度条:离满重还有多远,2px 细条(与成就组头同一根尺) -->
        <ProgressBar
          class="mt-1.5"
          :value="row.owned.level / ARTIFACT_MAX_LEVEL"
          color="var(--color-gold-ink)"
          :height="2"
        />
        <p class="artifact-card__description">{{ row.def.desc }}</p>
        <dl class="artifact-card__ledger">
          <div class="artifact-card__fact">
            <dt>被动</dt>
            <dd>{{ passiveLines(row.def.id, row.owned.level).join(" · ") }}</dd>
          </div>
          <!--
            神通说明按品阶与祭炼等级现算:效果随「品阶 × (1+0.08×重数)」走,
            文案不能停在基线那一句
            (见 data/artifacts.artifactActiveText —— 战斗与这句话读的是同一个函数)
          -->
          <div class="artifact-card__fact">
            <dt>神通「{{ row.def.active.name }}」</dt>
            <dd>{{ artifactActiveText(row.def, row.owned.level) }}</dd>
          </div>
          <!--
            下一重给多少:按钮只报代价,玩家得自己按 ×1.08 心算 —— 而「值不值」
            正是按下之前要想清楚的事(数值由 artifactNextLevelGain 算,含封顶提示)。
          -->
          <div v-if="nextGainText(row.def.id, row.owned.level)" class="artifact-card__fact">
            <dt>下一重</dt>
            <dd class="tabular">{{ nextGainText(row.def.id, row.owned.level) }}</dd>
          </div>
        </dl>
        <div class="artifact-card__actions flex gap-2 tinylens:flex-col">
          <button
            class="btn-seal flex-1 !py-1.5 !text-body"
            :class="{ '!bg-ink-faint': row.equipped }"
            @click="toggleArtifact(row.def.id)"
          >
            {{ row.equipped ? "收回法宝" : "祭炼随身" }}
          </button>
          <button
            v-if="row.upCost"
            class="btn-ghost flex-1 !py-1.5 !text-body tabular"
            :disabled="!row.upAffordable"
            @click="refineArtifact(row.def.id)"
          >
            <!--
            两种代价都要写出来:炼化既扣悟道点、也扣灵石(见 forge.artifactUpCost),
            而按钮此前只报悟道 —— 玩家按标签算账,回头发现灵石也少了一大截。
          -->
            炼化(悟道点 {{ row.upCost.wudao }} · 灵石 {{ formatGN(row.upCost.stone) }})
          </button>
        </div>
        <!-- 付不起就把缺摆出来:灰按钮只说不许,不告诉差多少等于没说完 -->
        <p v-if="row.upCost && !row.upAffordable" class="mt-1.5 text-note text-cinnabar tabular">
          尚差 悟道点 {{ Math.max(0, row.upCost.wudao - resources.wudao) }} · 灵石
          {{ formatGN(Math.max(0, toNum(row.upCost.stone) - toNum(resources.spiritStone))) }}
        </p>
      </div>
    </div>
    <div v-if="artifactPage.hidden > 0 || artifactPage.start > 0" class="mt-3 flex flex-wrap gap-2">
      <button
        v-if="artifactPage.start > 0"
        data-artifact-prev
        class="btn-ghost min-w-0 flex-1 !py-2 !text-body tinylens:basis-full tinylens:whitespace-nowrap"
        :aria-label="previousArtifactText"
        @click="showPreviousArtifacts"
      >
        {{ previousArtifactText }}
      </button>
      <button
        v-if="artifactPage.hidden > 0"
        data-artifact-more
        class="btn-ghost min-w-0 flex-1 !py-2 !text-body tinylens:basis-full tinylens:whitespace-nowrap"
        :aria-label="moreArtifactText"
        :data-promised="Math.min(ARTIFACT_RENDER_BATCH, artifactPage.hidden)"
        @click="showMoreArtifacts"
      >
        {{ moreArtifactText }}
      </button>
    </div>
  </div>
  <div v-else class="artifact-empty" data-artifact-empty>
    <span class="artifact-empty__seal" aria-hidden="true">空</span>
    <p class="artifact-empty__title">尚无法宝随身</p>
    <p class="artifact-empty__copy">
      法宝多出自际遇与强敌之手。得到第一件后,这里会摊开随身位、祭炼下一重与两种代价。
    </p>
  </div>
  <p v-if="player.petId" class="mt-4 text-center text-body text-ink-faint">
    灵兽相伴,可在「名号」页更替
  </p>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import GameIcon from "@/components/common/GameIcon.vue";
import QualityTag from "@/components/common/QualityTag.vue";
import QualitySeal from "@/components/common/QualitySeal.vue";
import ProgressBar from "@/components/common/ProgressBar.vue";
import { isRareQuality, qualityTierStyle as tierOf } from "@/ui/qualityTier";
import { colorWithAlpha } from "@/ui/colorVar";
import { useInventoryStore } from "@/stores/inventory";
import { useResourcesStore } from "@/stores/resources";
import { usePlayerStore } from "@/stores/player";
import { useUiStore } from "@/stores/ui";
import { qualityDef } from "@/data/qualities";
import {
  artifactActiveText,
  artifactDef,
  artifactLevelLabel,
  artifactNextLevelGain,
  artifactValue,
  ARTIFACT_LEVEL_BONUS,
  ARTIFACT_MAX_LEVEL,
  ARTIFACT_MAX_SLOTS,
  ARTIFACT_SLOT_UNLOCK_MAJOR,
  artifactSlotsFor,
} from "@/data/artifacts";
import { artifactSlotBonus } from "@/core/heritageEffects";
import { artifactDeskSummary } from "@/core/artifactDesk";
import { REALMS } from "@/data/realms";
import { artifactUpCost, upgradeArtifact } from "@/core/forge";
import {
  firstNewVisibleIndex,
  listWindow,
  nextListLimit,
  previousListLimit,
  previousListStep,
} from "@/core/listRender";
import { cnNumber, formatGN, formatPercent, formatSignedPercent } from "@/utils/format";
import { toNum } from "@/utils/gnum";
import { STAT_NAMES } from "@/data/statNames";
import type { AnyStatKey } from "@/types";

const inventory = useInventoryStore();
const resources = useResourcesStore();
const player = usePlayerStore();
const ui = useUiStore();

const artifactSlots = computed(
  () => artifactSlotsFor(player.major) + artifactSlotBonus(player.reincarnation.heritage),
);
/** 开第二法宝位的那一境的名字 —— 门槛挪动时文案跟着走,不手写「元婴」 */
const artifactUnlockRealm = computed(() => REALMS[ARTIFACT_SLOT_UNLOCK_MAJOR]?.name ?? "");

const artifactRows = computed(() =>
  inventory.artifacts
    .map((a) => {
      const def = artifactDef(a.defId);
      if (!def) return null;
      const upCost = artifactUpCost(a.defId);
      return {
        owned: a,
        def,
        upCost,
        // 炼化既花悟道也花灵石:按下之前就得看得出付不付得起(见 forge.artifactUpCost)
        upAffordable:
          !upCost || (resources.wudao >= upCost.wudao && resources.hasStone(upCost.stone)),
        equipped: inventory.equippedArtifacts.includes(a.defId),
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    // 与行囊同一套排法:品质降序 → 祭炼高的在前(此前按入手先后排,越捡越乱)
    .sort(
      (a, b) =>
        qualityDef(b.def.quality).rank - qualityDef(a.def.quality).rank ||
        b.owned.level - a.owned.level ||
        a.def.name.localeCompare(b.def.name),
    ),
);

const artifactSummary = computed(() =>
  artifactDeskSummary(
    artifactRows.value.map((row) => ({
      equipped: row.equipped,
      hasUpgrade: row.upCost !== null,
      affordable: row.upAffordable,
    })),
    artifactSlots.value,
  ),
);

const equippedSeatRows = computed(() =>
  Array.from({ length: artifactSlots.value }, (_, index) => {
    const defId = inventory.equippedArtifacts[index] ?? null;
    return {
      defId,
      def: defId ? artifactDef(defId) : undefined,
      owned: defId ? inventory.artifacts.find((artifact) => artifact.defId === defId) : undefined,
    };
  }),
);

const artifactDeskSeal = computed(() =>
  artifactSummary.value.total === 0 ? "空" : artifactSummary.value.emptySlots > 0 ? "悬" : "满",
);

const artifactDeskLead = computed(() => {
  const summary = artifactSummary.value;
  if (summary.total === 0) {
    return {
      title: "尚无一件法宝随身",
      detail: "先认位次与祭炼;得到第一件后,全册会在这里摊开随身取舍与下一重收益。",
    };
  }
  if (summary.emptySlots > 0) {
    return {
      title: `还有 ${summary.emptySlots} 个法宝位空悬`,
      detail: `全册存 ${summary.stored} 件;从下方选一件随身,或先把已在位者炼高一重。`,
    };
  }
  return {
    title: "法宝位已满",
    detail: `随身 ${summary.carried} 件,另存 ${summary.stored} 件;换入新法宝会替下最早随身的一件。`,
  };
});

const ARTIFACT_RENDER_BATCH = 6;
const ARTIFACT_RENDER_WINDOW = ARTIFACT_RENDER_BATCH * 2;
const artifactLimit = ref(ARTIFACT_RENDER_BATCH);
const artifactPage = computed(() =>
  listWindow(artifactRows.value, artifactLimit.value, ARTIFACT_RENDER_WINDOW),
);
const moreArtifactText = computed(() => {
  const next = Math.min(ARTIFACT_RENDER_BATCH, artifactPage.value.hidden);
  return `再看 ${next} 件 · 余 ${artifactPage.value.hidden}`;
});
const previousArtifactText = computed(
  () =>
    `前一批 ${previousListStep(
      artifactPage.value.shown,
      artifactRows.value.length,
      ARTIFACT_RENDER_BATCH,
    )} 件`,
);

function focusArtifactRow(index = 0): void {
  void nextTick(() => {
    const rows = document.querySelectorAll<HTMLElement>("[data-artifact-row]");
    rows[Math.min(Math.max(0, index), rows.length - 1)]?.focus();
  });
}

function focusArtifactRowById(defId: string): void {
  void nextTick(() => {
    const selector = `[data-artifact-row="${CSS.escape(defId)}"]`;
    const row = document.querySelector<HTMLElement>(selector);
    if (row) {
      row.focus();
      return;
    }
    // 炼化升高祭炼等级后会改同品阶内的次序,卡片可能跨出当前滑窗。
    // 把它新位置所在批次的末尾设为上限,前后移动都能重新把它纳入窗口。
    const index = artifactRows.value.findIndex((candidate) => candidate.def.id === defId);
    if (index < 0) return;
    const pageEnd = Math.ceil((index + 1) / ARTIFACT_RENDER_BATCH) * ARTIFACT_RENDER_BATCH;
    artifactLimit.value = Math.min(artifactRows.value.length, pageEnd);
    void nextTick(() => document.querySelector<HTMLElement>(selector)?.focus());
  });
}

function showMoreArtifacts(): void {
  const shownBefore = artifactPage.value.shown;
  const shownAfter = nextListLimit(shownBefore, artifactRows.value.length, ARTIFACT_RENDER_BATCH);
  artifactLimit.value = shownAfter;
  focusArtifactRow(firstNewVisibleIndex(shownBefore, shownAfter, ARTIFACT_RENDER_WINDOW));
}

function showPreviousArtifacts(): void {
  artifactLimit.value = previousListLimit(
    artifactPage.value.shown,
    artifactRows.value.length,
    ARTIFACT_RENDER_BATCH,
  );
  focusArtifactRow();
}

function toggleArtifact(defId: string): void {
  const result = inventory.toggleArtifact(defId, artifactSlots.value);
  if (result === "replaced") ui.toast("法宝位已满,替换了最早祭炼的一件", "info");
  focusArtifactRowById(defId);
}

function refineArtifact(defId: string): void {
  if (upgradeArtifact(defId)) focusArtifactRowById(defId);
}

function passiveLines(defId: string, level: number): string[] {
  const def = artifactDef(defId);
  if (!def) return [];
  // 与属性汇总(store/inventory)同源:卡片上写多少,身上加的就是多少
  return Object.entries(artifactValue(def, level).passive).map(
    ([k, v]) => `${STAT_NAMES[k as AnyStatKey] ?? k} ${formatSignedPercent(v as number)}`,
  );
}

/** 神通主体那个数说的是什么(用药名之外的话:威力 / 护盾 / 破解…) */
const ACTIVE_NOUNS: Record<string, string> = {
  damage: "威力",
  drain: "威力",
  heal: "回复",
  shield: "护盾",
  weaken: "削弱",
  sunder: "破甲",
  purge: "挣脱",
};

/**
 * 祭炼下一重的账:被动逐项 + 神通主体 + 吸命回补,到顶的标「已至上限」。
 * 已达满重(artifactNextLevelGain 返回 null)时不显示这一行。
 */
function nextGainText(defId: string, level: number): string {
  const def = artifactDef(defId);
  const gain = def ? artifactNextLevelGain(def, level) : null;
  if (!gain) return "";
  const parts = gain.passive.map(
    (p) => `${STAT_NAMES[p.key] ?? p.key} ${formatPercent(p.from)} → ${formatPercent(p.to)}`,
  );
  if (gain.active) {
    const noun = ACTIVE_NOUNS[def!.active.effect.type] ?? "效果";
    /**
     * 零重就顶到封顶的那几件(神鞭的破甲、神魔镜的回补…)再炼也不会更高,
     * 写「50% → 50%(已至上限)」等于让人自己看出来 —— 直接说清只涨被动。
     */
    const alreadyCapped = gain.active.capped && Math.abs(gain.active.to - gain.active.from) < 1e-9;
    parts.push(
      alreadyCapped
        ? `神通${noun}已至上限(${formatPercent(gain.active.to)}),祭炼只涨被动`
        : `神通${noun} ${formatPercent(gain.active.from)} → ${formatPercent(gain.active.to)}${gain.active.capped ? "(已至上限)" : ""}`,
    );
  } else {
    parts.push("神通不随祭炼变");
  }
  if (gain.heal) {
    parts.push(
      `回补 ${formatPercent(gain.heal.from)} → ${formatPercent(gain.heal.to)}${gain.heal.capped ? "(已至上限)" : ""}`,
    );
  }
  return parts.join(" · ");
}
</script>
