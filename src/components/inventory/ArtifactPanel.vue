<template>
  <div
    class="artifact-register"
    data-artifact-register
    :data-artifact-total="artifactRows.length"
    :data-artifact-shown="artifactPage.shown"
    :data-artifact-start="artifactPage.start"
    :data-artifact-empty="artifactRows.length === 0 ? '' : undefined"
  >
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
          :data-artifact-seat-id="seat.defId ?? ''"
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
          <small>{{ artifactSummary.short ? "逐件列差额" : "无待补" }}</small>
        </div>
        <div class="artifact-desk__reading" data-artifact-summary="maxed">
          <span>满重</span>
          <strong class="tabular">{{ artifactSummary.maxed }}</strong>
          <small>共 {{ artifactSummary.total }} 件</small>
        </div>
      </div>

      <p class="artifact-desk__rule">
        祭炼一重,被动与神通各强 {{ formatPercent(ARTIFACT_LEVEL_BONUS) }},至多
        {{ cnNumber(ARTIFACT_MAX_LEVEL) }} 重;封顶后不再涨,账行会标明只涨哪一部分。
        <span v-if="artifactSlots < ARTIFACT_MAX_SLOTS">
          {{ artifactUnlockRealm }}境开启第{{ cnNumber(ARTIFACT_MAX_SLOTS) }}法宝位。
        </span>
      </p>
    </section>

    <section
      v-if="artifactRows.length"
      class="artifact-ledger"
      aria-labelledby="artifact-ledger-title"
    >
      <div class="artifact-ledger__head">
        <h3 id="artifact-ledger-title" class="artifact-ledger__title">法宝全册</h3>
        <span class="artifact-ledger__hint">按品阶降序 · 祭炼高者在前</span>
        <span class="artifact-ledger__count tabular">
          现看 {{ artifactPage.start + 1 }}–{{ artifactPage.shown }} / 共 {{ artifactRows.length }}
        </span>
      </div>
      <div class="inventory-artifact-list">
        <!--
          每件法宝是一条连续账行:品阶只落左缘短笔、名字与稀有角章,
          不再逐件套四边框纸卡。正文与动作在 720px 起左右分读。
        -->
        <article
          v-for="(row, index) in artifactPage.visible"
          :key="row.def.id"
          :data-artifact-row="row.def.id"
          tabindex="-1"
          class="artifact-row"
          :style="{
            '--artifact-tone': qualityDef(row.def.quality).color,
            '--artifact-edge': colorWithAlpha(
              qualityDef(row.def.quality).color,
              tierOf(row.def.quality).border,
            ),
          }"
        >
          <div class="artifact-row__head">
            <span class="artifact-row__order tabular" aria-hidden="true">
              {{ String(artifactPage.start + index + 1).padStart(2, "0") }}
            </span>
            <GameIcon :name="row.def.icon" :size="18" :style="{ color: 'var(--artifact-tone)' }" />
            <span class="artifact-row__name">{{ row.def.name }}</span>
            <QualityTag :quality="row.def.quality" />
            <span v-if="row.seat" class="artifact-row__carried">随身 · 法 {{ row.seat }}</span>
            <span class="artifact-row__level tabular">{{
              artifactLevelLabel(row.owned.level)
            }}</span>
            <QualitySeal
              v-if="isRareQuality(row.def.quality)"
              :quality="row.def.quality"
              :size="16"
            />
          </div>
          <ProgressBar
            class="artifact-row__progress"
            :value="row.owned.level / ARTIFACT_MAX_LEVEL"
            color="var(--color-gold-ink)"
            :height="2"
          />
          <div class="artifact-row__body">
            <div class="artifact-row__read">
              <p class="artifact-row__description">{{ row.def.desc }}</p>
              <dl class="artifact-row__ledger">
                <div class="artifact-row__fact">
                  <dt>被动</dt>
                  <dd>{{ passiveLines(row.def.id, row.owned.level).join(" · ") }}</dd>
                </div>
                <!--
                  神通说明按品阶与祭炼等级现算:效果随「品阶 × (1+0.08×重数)」走,
                  文案不能停在基线那一句
                  (见 data/artifacts.artifactActiveText —— 战斗与这句话读的是同一个函数)
                -->
                <div class="artifact-row__fact">
                  <dt>神通「{{ row.def.active.name }}」</dt>
                  <dd>
                    {{ artifactActiveText(row.def, row.owned.level) }}
                    <!--
                      节拍 —— 多久出手一次(见 ui/artifactBeat)。
                      同样的效果,每 2 回合一次与每 5 回合一次是两件不同的东西,
                      而这条只活在战斗那一侧(`round % interval === 0`),界面上一直没写。
                    -->
                    <span class="artifact-row__beat tabular" data-artifact-beat>{{
                      artifactBeatText(row.def)
                    }}</span>
                  </dd>
                </div>
                <!--
                  下一重给多少:按钮只报代价,玩家得自己按 ×1.08 心算 —— 而「值不值」
                  正是按下之前要想清楚的事(数值由 artifactNextLevelGain 算,含封顶提示)。
                -->
                <div v-if="nextGainText(row.def.id, row.owned.level)" class="artifact-row__fact">
                  <dt>下一重</dt>
                  <dd class="tabular">{{ nextGainText(row.def.id, row.owned.level) }}</dd>
                </div>
              </dl>
            </div>
            <div class="artifact-row__decision">
              <p
                v-if="row.replaced"
                :id="`artifact-swap-${row.def.id}`"
                class="artifact-row__swap"
                data-artifact-swap
              >
                满位换入 · 将替下 法 {{ row.replaced.seat }}「{{ row.replaced.def.name }}」
              </p>
              <div class="artifact-row__actions" data-artifact-actions>
                <button
                  class="btn-seal artifact-row__action"
                  :class="{ '!bg-ink-faint': row.equipped }"
                  :aria-describedby="row.replaced ? `artifact-swap-${row.def.id}` : undefined"
                  @click="toggleArtifact(row.def.id)"
                >
                  {{ row.equipped ? "收回法宝" : "祭炼随身" }}
                </button>
                <button
                  v-if="row.upCost"
                  class="btn-ghost artifact-row__action artifact-row__action--cost tabular"
                  :disabled="!row.upAffordable"
                  @click="refineArtifact(row.def.id)"
                >
                  <!--
                  两种代价都要写出来:炼化既扣悟道点、也扣灵石(见 forge.artifactUpCost),
                  而按钮此前只报悟道 —— 玩家按标签算账,回头发现灵石也少了一大截。
                -->
                  <span class="artifact-row__cost-segment"
                    >炼化 · 悟道点 {{ row.upCost.wudao }}</span
                  >
                  <span class="artifact-row__cost-segment"
                    >· 灵石 {{ formatGN(row.upCost.stone) }}</span
                  >
                </button>
              </div>
              <!-- 付不起就把缺摆出来:灰按钮只说不许,不告诉差多少等于没说完 -->
              <p
                v-if="row.upCost && !row.upAffordable"
                class="artifact-row__shortfall tabular"
                data-artifact-shortfall
              >
                <span class="artifact-row__shortfall-segment"
                  >尚差 悟道点 {{ Math.max(0, row.upCost.wudao - resources.wudao) }}</span
                >
                <span class="artifact-row__shortfall-segment"
                  >· 灵石
                  {{
                    formatGN(Math.max(0, toNum(row.upCost.stone) - toNum(resources.spiritStone)))
                  }}</span
                >
              </p>
            </div>
          </div>
        </article>
      </div>
      <div v-if="artifactPage.hidden > 0 || artifactPage.start > 0" class="artifact-ledger__pager">
        <button
          v-if="artifactPage.start > 0"
          data-artifact-prev
          class="btn-ghost artifact-ledger__page-action"
          :aria-label="previousArtifactText"
          @click="showPreviousArtifacts"
        >
          {{ previousArtifactText }}
        </button>
        <button
          v-if="artifactPage.hidden > 0"
          data-artifact-more
          class="btn-ghost artifact-ledger__page-action"
          :aria-label="moreArtifactText"
          :data-promised="artifactPromise"
          @click="showMoreArtifacts"
        >
          {{ moreArtifactText }}
        </button>
      </div>
    </section>
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
import { artifactBeatText } from "@/ui/artifactBeat";
import { artifactSlotBonus } from "@/core/heritageEffects";
import { artifactDeskSummary, planArtifactPlacement } from "@/core/artifactDesk";
import { REALMS } from "@/data/realms";
import { artifactUpCost, upgradeArtifact } from "@/core/forge";
import {
  firstNewVisibleIndex,
  listWindow,
  nextListLimit,
  nextRevealCount,
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
      const placement = planArtifactPlacement(
        inventory.equippedArtifacts,
        a.defId,
        artifactSlots.value,
      );
      const replacedDef = placement.removedId ? artifactDef(placement.removedId) : undefined;
      const seatIndex = inventory.equippedArtifacts.indexOf(a.defId);
      return {
        owned: a,
        def,
        upCost,
        // 炼化既花悟道也花灵石:按下之前就得看得出付不付得起(见 forge.artifactUpCost)
        upAffordable:
          !upCost || (resources.wudao >= upCost.wudao && resources.hasStone(upCost.stone)),
        equipped: inventory.equippedArtifacts.includes(a.defId),
        seat: seatIndex >= 0 ? seatIndex + 1 : null,
        replaced:
          placement.action === "replaced" && replacedDef
            ? { def: replacedDef, seat: (placement.removedIndex ?? 0) + 1 }
            : null,
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
      title: "尚无法宝随身",
      detail: "先去历练战利与际遇里寻第一件;得到后,这里会按位次摊开随身取舍、祭炼收益与两笔代价。",
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
/** 这一批真正放出多少件 —— 按钮文案与 data-promised 共用,不许各算一遍 */
const artifactPromise = computed(() =>
  nextRevealCount(artifactPage.value.hidden, ARTIFACT_RENDER_BATCH),
);
const moreArtifactText = computed(() => {
  const next = artifactPromise.value;
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
  const plan = planArtifactPlacement(inventory.equippedArtifacts, defId, artifactSlots.value);
  const replaced = plan.removedId ? artifactDef(plan.removedId) : undefined;
  const result = inventory.toggleArtifact(defId, artifactSlots.value);
  if (result === "replaced") {
    ui.toast(
      replaced
        ? `法宝位已满,已替下 法 ${(plan.removedIndex ?? 0) + 1}「${replaced.name}」`
        : "法宝位已满,已替下最早随身的一件",
      "info",
    );
  }
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
