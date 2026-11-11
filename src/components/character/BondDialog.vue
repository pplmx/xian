<template>
  <!-- 道侣弹窗:在世时读同行帖,无人时读历世同行。 -->
  <BaseModal
    :open="open"
    size="wide"
    :title="modalTitle"
    :aria-label="
      bondDef && bond
        ? `同行帖，${bondDef.name}，${STAGE_NAMES[bond.stage]}`
        : '缘法，此生未遇同行，历世履历仍可回看'
    "
    @close="emit('close')"
  >
    <article v-if="bondDef && bond" class="bond-folio stagger-in" data-bond-view="active">
      <!--
        她那片地 —— 这一帖讲了 1334 行「这个人是谁」,而全帖的辨识物原先只有
        一枚楷体的**姓名首字**:十位道侣里有两位都姓「沈」,那枚字就是一样的。

        画什么不用另立一套:`DaoluDef.terrains` 早就写着「她会在哪一种地貌遇见」
        (沈青璃=林泽山岳 / 厉孤=火域废墟 / 苍冥=幽冥天象)。这份表一直被
        `exploration` 用来决定「这片地上能不能遇见她」,界面上一个字都没露过 ——
        而它正好是「这一帖该配哪片天」的答案。

        她「随处可遇」时 `terrains` 是空的,那时整块不出:空表不是缺数据,是答案,
        给它兜底一片山就等于替玩家编一个她的故乡。

        落法是背景层:这一帖正文全是读数(此刻要答的事、四道刻度、同行履历),
        把画排进流里会把它们往下推 —— 故只垫在纸底下。
      -->
      <InkScene
        v-if="herTerrain"
        class="bond-scene"
        :terrain="herTerrain"
        :marks="false"
        aria-hidden="true"
      />

      <header class="bond-head">
        <span class="bond-head__seal font-kai" aria-hidden="true">{{
          bondDef.name.slice(0, 1)
        }}</span>
        <div class="bond-head__identity">
          <p class="bond-head__eyebrow">此世同行 · {{ STAGE_NAMES[bond.stage] }}</p>
          <h2 class="bond-head__title">
            <span>{{ bondDef.name }}</span>
            <span class="bond-head__lean"
              >{{ TEMPER_NAMES[bondDef.temper] }} · {{ LEAN_NAMES[bondDef.lean] }}道</span
            >
          </h2>
          <p class="bond-head__brief">{{ bondDef.brief }}</p>
          <p class="bond-head__meta">
            共历 {{ bond.shared }} 次
            <span v-if="bond.fallen" class="bond-head__state is-danger">已殁</span>
            <span v-else-if="bond.departed" class="bond-head__state">已离</span>
            <span v-else class="bond-head__state is-qing">仍在同行</span>
          </p>
        </div>
      </header>

      <section v-if="herIntent || pendingEvent || lastEventText" class="bond-now" data-bond-now>
        <div class="bond-section-head">
          <span class="bond-section-head__mark font-kai" aria-hidden="true">此</span>
          <div>
            <p class="bond-section-head__title">此刻要答的事</p>
            <p class="bond-section-head__hint">先把她的话与后果摊开，再落子。</p>
          </div>
        </div>

        <section v-if="herIntent" class="bond-intent" data-bond-intent>
          <p class="bond-kicker">她开了口</p>
          <blockquote class="bond-quote">{{ herIntent.line }}</blockquote>
          <p class="bond-line"><span>她所求</span>{{ herIntent.wish }}</p>
          <p v-if="herIntentSparks" class="bond-line bond-line--faint">
            <span>因何而起</span>{{ herIntentSparks }}
          </p>
          <div class="bond-choice-list">
            <button
              v-for="r in intentPreviews"
              :key="r.id"
              type="button"
              class="bond-choice"
              data-bond-intent-choice
              :data-bond-choice-id="r.id"
              :aria-label="intentChoiceLabel(r.label, r.preview)"
              @click="answerIntent(r.id)"
            >
              <span class="bond-choice__copy">
                <span class="bond-choice__label">{{ r.label }}</span>
                <span class="bond-choice__note">{{ intentPreviewNote(r.preview) }}</span>
              </span>
              <span class="bond-choice__read">
                <span
                  v-for="d in deltasOf(r.preview)"
                  :key="d.key"
                  class="bond-delta"
                  :class="d.tone"
                >
                  {{ d.label }} {{ d.value }}
                </span>
              </span>
            </button>
          </div>
        </section>

        <p
          v-if="lastEventText"
          ref="resultRegion"
          tabindex="-1"
          class="bond-result"
          role="status"
          aria-live="polite"
          data-bond-result
        >
          {{ lastEventText }}
        </p>

        <section
          v-if="pendingEvent && !bond.fallen && !bond.departed"
          class="bond-event"
          data-bond-event
        >
          <div class="bond-event__head">
            <p class="bond-event__title font-kai">{{ pendingEvent.title }}</p>
            <p class="bond-event__cause">因何而来 · {{ pendingEventTriggers }}</p>
          </div>
          <p class="bond-event__story">{{ pendingEvent.text }}</p>
          <div class="bond-event__brief">
            <p><span>她的诉求</span>{{ pendingEvent.herWish }}</p>
            <p><span>她的底线</span>{{ pendingEvent.herLimit }}</p>
          </div>
          <p v-if="herLine" class="bond-event__stance">{{ herLine }}</p>
          <div class="bond-choice-list">
            <button
              v-for="p in eventPreviews"
              :key="p.choice.id"
              type="button"
              class="bond-choice"
              :class="{
                'is-taboo': p.choice.crossesTaboo,
                'is-danger': p.preview?.perishes || p.preview?.leaves,
              }"
              data-bond-event-choice
              :data-bond-choice-id="p.choice.id"
              :disabled="!p.preview"
              :aria-label="eventChoiceLabel(p.choice.label, p.preview)"
              @click="pickChoice(p.choice.id)"
            >
              <span class="bond-choice__copy">
                <span class="bond-choice__label">{{ p.choice.label }}</span>
                <span v-if="eventFlags(p).length" class="bond-choice__flags">
                  <span
                    v-for="flag in eventFlags(p)"
                    :key="flag.label"
                    class="bond-flag"
                    :class="flag.tone"
                  >
                    {{ flag.label }}
                  </span>
                </span>
                <span v-if="p.preview?.perishes" class="bond-choice__warning">
                  共命之险 · 落定后信 {{ p.preview.after.trust }} / 契
                  {{ p.preview.after.accord }}， 门槛 {{ PERIL_SAFE_TRUST }} /
                  {{ PERIL_SAFE_ACCORD }}：她会殒落。
                </span>
                <span v-else-if="p.preview?.leaves" class="bond-choice__warning">
                  这一签落定后，她会就此离开。
                </span>
                <span v-else-if="p.preview?.perilSafe" class="bond-choice__assurance">
                  共命之险 · 此刻信契够深，二人可一同生还。
                </span>
              </span>
              <span v-if="p.preview" class="bond-choice__read">
                <span
                  v-for="d in deltasOf(p.preview.outcome)"
                  :key="d.key"
                  class="bond-delta"
                  :class="d.tone"
                >
                  {{ d.label }} {{ d.value }}
                </span>
              </span>
            </button>
          </div>
        </section>
      </section>

      <section v-else class="bond-quiet" data-bond-quiet>
        <span class="bond-quiet__seal font-kai" aria-hidden="true">宁</span>
        <div>
          <p class="bond-quiet__title">
            {{ bond.fallen ? "此世同行已止" : bond.departed ? "此世已分道" : "此刻没有未了之言" }}
          </p>
          <p class="bond-quiet__copy">
            {{
              bond.fallen
                ? "人不随转世回来，历世同行仍留在卷末。"
                : bond.departed
                  ? "关系停在此处，走远的人不会再追问。"
                  : "多走几处地界，新的相遇会自己找上来。"
            }}
          </p>
        </div>
      </section>

      <div class="bond-detail-grid">
        <section class="bond-person" data-bond-person>
          <p class="bond-panel-title">其人</p>
          <dl class="bond-person__rows">
            <div>
              <dt>她所求</dt>
              <dd>{{ bondDef.pursuit }}</dd>
            </div>
            <div>
              <dt>她不越的线</dt>
              <dd>{{ bondDef.taboo }}</dd>
            </div>
          </dl>
          <p class="bond-person__note">
            她开的口，你历次回应：{{ responseLine || "尚未回应过她。" }}
          </p>
        </section>

        <section
          class="bond-meters"
          data-bond-meters
          data-bond-next-gate
          :data-bond-next-stage="gateHint?.stage ?? ''"
        >
          <div class="bond-meters__head">
            <p class="bond-panel-title">三衡</p>
            <p v-if="gateHint" class="bond-meters__next">
              下一阶 · {{ STAGE_NAMES[gateHint.stage] }}
            </p>
            <p v-else class="bond-meters__next">已至此世最高阶</p>
          </div>
          <div class="bond-meter-list">
            <div
              v-for="m in bondMeterRows"
              :key="m.key"
              class="bond-meter"
              :data-bond-meter="m.key"
              :data-value="m.value"
            >
              <div class="bond-meter__head">
                <span>{{ m.label }}</span>
                <span class="tabular">
                  {{ m.value }}<small>/100</small>
                  <em v-if="gateHint && gateHint.shortfall[m.key] === 0" class="is-ready">已够</em>
                  <em v-else-if="gateHint">尚差 {{ gateHint.shortfall[m.key] }}</em>
                </span>
              </div>
              <div
                class="bond-meter__track"
                role="img"
                :aria-label="meterAria(m.label, m.value, m.key)"
              >
                <span class="bond-meter__fill" :style="{ width: `${m.value}%` }" />
                <span
                  v-if="gateHint"
                  class="bond-meter__goal"
                  :style="{ left: meterGoalPercent(m.key) }"
                  aria-hidden="true"
                />
              </div>
            </div>
          </div>
          <div class="bond-shared">
            <span>共历</span>
            <strong class="tabular">{{ bond.shared }} 次</strong>
            <em v-if="gateHint">
              {{
                gateHint.shortfall.shared > 0
                  ? `下一阶尚差 ${gateHint.shortfall.shared} 次`
                  : "次数已够"
              }}
            </em>
            <em v-else>此世已行至最高阶</em>
          </div>
        </section>
      </div>
    </article>

    <article v-else class="bond-empty stagger-in" data-bond-view="empty">
      <span class="bond-empty__seal font-kai" aria-hidden="true">缘</span>
      <div>
        <p class="bond-empty__eyebrow">缘法 · 此生</p>
        <h2 class="bond-empty__title">尚未遇见同行</h2>
        <p class="bond-empty__copy">
          人是在路上碰到的，不是从名单里挑出来的。多走几处地界，或许自有相逢。
        </p>
        <p v-if="pastBonds.length" class="bond-empty__history">
          此世仍空着，历世已有 {{ pastBonds.length }} 段同行留在卷末。
        </p>
        <RouterLink
          to="/adventure"
          class="btn-ghost tap-row mt-3 flex w-full items-center justify-center !text-body"
          data-bond-empty-action
          @click="emit('close')"
        >
          去 历 练
        </RouterLink>
      </div>
    </article>

    <section v-if="pastBonds.length" class="bond-history" data-bond-history>
      <div
        :data-bond-history-total="pastBondRows.length"
        :data-bond-history-shown="pastBondPage.shown"
        :data-bond-history-start="pastBondPage.start"
      >
        <div class="bond-history__head">
          <span class="bond-history__title font-kai">历世同行</span>
          <span class="bond-history__count tabular">共 {{ pastBondRows.length }} 段</span>
        </div>
        <div class="bond-history__rows scroll-pane">
          <p
            v-for="(r, i) in pastBondPage.visible"
            :key="`${r.daoluId}-${r.shared}-${r.ending}-${pastBondPage.start + i}`"
            :data-bond-history-row="r.name"
            tabindex="-1"
            class="bond-history__row"
          >
            <span class="bond-history__name">{{ r.name }}</span>
            <span class="bond-history__read">
              {{ STAGE_NAMES[r.stage] }} · {{ ENDING_NAMES[r.ending] }} · 共历 {{ r.shared }} 次
            </span>
          </p>
        </div>
        <div v-if="pastBondPage.start > 0 || pastBondPage.hidden > 0" class="bond-history__actions">
          <button
            v-if="pastBondPage.start > 0"
            type="button"
            data-bond-history-prev
            class="bond-history__action"
            :aria-label="previousPastBondText()"
            @click="showPreviousPastBonds"
          >
            {{ previousPastBondText() }}
          </button>
          <button
            v-if="pastBondPage.hidden > 0"
            type="button"
            data-bond-history-more
            class="bond-history__action is-accent"
            :aria-label="morePastBondText()"
            :data-promised="bondPromise"
            @click="showMorePastBonds"
          >
            {{ morePastBondText() }}
          </button>
        </div>
      </div>
    </section>

    <template #footer>
      <button type="button" class="btn-ghost tap-row w-full !text-body" @click="emit('close')">
        {{ bondDef && bond ? "收起同行帖" : "收起" }}
      </button>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { ENDING_NAMES, LEAN_NAMES, STAGE_NAMES, TEMPER_NAMES } from "@/data/daolu";
import {
  chooseBondEvent,
  herStance,
  nextGateHint,
  PERIL_SAFE_ACCORD,
  PERIL_SAFE_TRUST,
  previewBondChoice,
  respondIntent,
  type BondChoicePreview,
} from "@/core/daoluService";
import {
  RESPONSE_NAMES,
  SPARK_NAMES,
  respondTo,
  type IntentAftermath,
  type IntentResponse,
} from "@/data/bondIntent";
import { TRIGGER_NAMES, type BondChoice } from "@/data/bondEvents";
import {
  firstNewVisibleIndex,
  listWindow,
  nextListLimit,
  nextRevealCount,
  previousListLimit,
  previousListStep,
} from "@/core/listRender";
import { useBondOverview } from "@/composables/useBondOverview";
import BaseModal from "@/components/common/BaseModal.vue";
import InkScene from "@/components/common/InkScene.vue";
import { sceneTerrainOfAxis } from "@/ui/sceneTerrain";
import { clampPercent } from "@/utils/unitRatio";

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const { bond, bondDef, pastBonds, pendingEvent, herIntent } = useBondOverview();

/**
 * 她那片地 —— 取 `terrains` 的第一轴(相遇偏好的主地貌)。
 *
 * 只取第一轴而不是把两轴都画:这一帖是**一**个人的帖,两片天摞在一起会读成
 * 「她属于哪儿都行」;而 `terrains[0]` 正是她最常出现的那一片(见 data/daolu 的顺序)。
 * 空表(随处可遇)回 null,整块不出。
 */
const herTerrain = computed(() => sceneTerrainOfAxis(bondDef.value?.terrains[0]));

const modalTitle = computed(() => {
  if (bondDef.value) return `同行帖 · ${bondDef.value.name}`;
  return pastBonds.value.length ? "历世同行" : "缘法";
});

const pastBondRows = computed(() => [...pastBonds.value].reverse());
const BOND_HISTORY_RENDER_BATCH = 12;
const BOND_HISTORY_RENDER_WINDOW = BOND_HISTORY_RENDER_BATCH * 2;
const bondHistoryLimit = ref(BOND_HISTORY_RENDER_BATCH);
const pastBondPage = computed(() =>
  listWindow(pastBondRows.value, bondHistoryLimit.value, BOND_HISTORY_RENDER_WINDOW),
);
const resultRegion = ref<HTMLElement | null>(null);

/** 这一批真正放出多少件 —— 按钮文案与 data-promised 共用,不许各算一遍 */
const bondPromise = computed(() =>
  nextRevealCount(pastBondPage.value.hidden, BOND_HISTORY_RENDER_BATCH),
);
function morePastBondText(): string {
  const next = bondPromise.value;
  return `再看 ${next} 段 · 余 ${pastBondPage.value.hidden}`;
}

function previousPastBondText(): string {
  const step = previousListStep(
    pastBondPage.value.shown,
    pastBondRows.value.length,
    BOND_HISTORY_RENDER_BATCH,
  );
  return `前一批 ${step} 段`;
}

function focusPastBond(index = 0): void {
  void nextTick(() => {
    const rows = document.querySelectorAll<HTMLElement>("[data-bond-history-row]");
    rows[Math.min(Math.max(0, index), rows.length - 1)]?.focus();
  });
}

function showMorePastBonds(): void {
  const shownBefore = pastBondPage.value.shown;
  const shownAfter = nextListLimit(
    shownBefore,
    pastBondRows.value.length,
    BOND_HISTORY_RENDER_BATCH,
  );
  bondHistoryLimit.value = shownAfter;
  focusPastBond(firstNewVisibleIndex(shownBefore, shownAfter, BOND_HISTORY_RENDER_WINDOW));
}

function showPreviousPastBonds(): void {
  bondHistoryLimit.value = previousListLimit(
    pastBondPage.value.shown,
    pastBondRows.value.length,
    BOND_HISTORY_RENDER_BATCH,
  );
  focusPastBond();
}

const gateHint = computed(() => nextGateHint());
const pendingEventTriggers = computed(() =>
  (pendingEvent.value?.triggers ?? [])
    .map((t) => TRIGGER_NAMES[t])
    .filter(Boolean)
    .join("、"),
);
const herLine = computed(() => (pendingEvent.value ? herStance(pendingEvent.value) : null));
const lastEventText = ref("");

const bondMeterRows = computed(() => [
  { key: "fate" as const, label: "缘分", value: bond.value?.fate ?? 0 },
  { key: "trust" as const, label: "信任", value: bond.value?.trust ?? 0 },
  { key: "accord" as const, label: "契合", value: bond.value?.accord ?? 0 },
]);

const INTENT_CHOICES: ReadonlyArray<{ id: IntentResponse; label: string }> = [
  { id: "accept", label: "与她同去" },
  { id: "refuse", label: "婉言谢绝" },
  { id: "ignore", label: "不作声" },
];

const intentPreviews = computed(() => {
  const def = bondDef.value;
  const intent = herIntent.value;
  if (!def || !intent) return [];
  return INTENT_CHOICES.map((choice) => ({
    ...choice,
    preview: respondTo(def, intent, choice.id),
  }));
});

const eventPreviews = computed(() => {
  const event = pendingEvent.value;
  if (!event) return [];
  return event.choices.map((choice) => ({
    choice,
    preview: previewBondChoice(event.id, choice.id),
  }));
});

function signed(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

function deltaTone(value: number): string {
  if (value > 0) return "is-up";
  if (value < 0) return "is-down";
  return "is-flat";
}

function deltasOf(outcome: { fate: number; trust: number; accord: number }) {
  return [
    { key: "fate", label: "缘", value: signed(outcome.fate), tone: deltaTone(outcome.fate) },
    { key: "trust", label: "信", value: signed(outcome.trust), tone: deltaTone(outcome.trust) },
    { key: "accord", label: "契", value: signed(outcome.accord), tone: deltaTone(outcome.accord) },
  ];
}

function intentPreviewNote(preview: IntentAftermath): string {
  return preview.settled ? "这一回应会了结此事。" : "此事未了，她还会再提。";
}

function intentChoiceLabel(label: string, preview: IntentAftermath): string {
  return `${label}。缘分${signed(preview.fate)}，信任${signed(preview.trust)}，契合${signed(preview.accord)}。${intentPreviewNote(preview)}`;
}

function eventChoiceLabel(label: string, preview: BondChoicePreview | null): string {
  if (!preview) return `${label}。当前不可选。`;
  const outcomes = `缘分${signed(preview.outcome.fate)}，信任${signed(preview.outcome.trust)}，契合${signed(preview.outcome.accord)}`;
  if (preview.perishes) return `${label}。${outcomes}。共命之险，她会殒落。`;
  if (preview.leaves) return `${label}。${outcomes}。落定后她会离开。`;
  return `${label}。${outcomes}。`;
}

function eventFlags(p: { choice: BondChoice; preview: BondChoicePreview | null }) {
  const flags: Array<{ label: string; tone: string }> = [];
  if (p.choice.supportsHer) flags.push({ label: "站在她那边", tone: "is-qing" });
  if (p.choice.crossesTaboo) flags.push({ label: "触碰底线", tone: "is-danger" });
  if (p.choice.risky) flags.push({ label: "涉险", tone: "is-ink" });
  if (p.preview?.perishes) flags.push({ label: "她会殒落", tone: "is-danger" });
  else if (p.preview?.leaves) flags.push({ label: "她会离开", tone: "is-danger" });
  else if (p.preview?.perilSafe) flags.push({ label: "可同生", tone: "is-qing" });
  return flags;
}

function meterGoalPercent(key: "fate" | "trust" | "accord"): string {
  const target = gateHint.value?.target[key] ?? 100;
  return `${clampPercent(target)}%`;
}

function meterAria(label: string, value: number, key: "fate" | "trust" | "accord"): string {
  if (!gateHint.value) return `${label} ${value}，已至此世最高阶`;
  const shortfall = gateHint.value.shortfall[key];
  return shortfall
    ? `${label} ${value}，距下一阶尚差 ${shortfall}`
    : `${label} ${value}，已够下一阶`;
}

function reportResult(text: string): void {
  lastEventText.value = text;
  void nextTick(() => resultRegion.value?.focus());
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      lastEventText.value = "";
      bondHistoryLimit.value = BOND_HISTORY_RENDER_BATCH;
    }
  },
);

function pickChoice(choiceId: string): void {
  if (!pendingEvent.value) return;
  const result = chooseBondEvent(pendingEvent.value.id, choiceId);
  if (result) reportResult(result.text);
}

const herIntentSparks = computed(() => {
  const sparks = herIntent.value?.sparks ?? [];
  return [...new Set(sparks)].map((spark) => SPARK_NAMES[spark]).join("、");
});

const responseLine = computed(() => {
  const responses = bond.value?.intent?.responses ?? [];
  return responses.length ? responses.map((response) => RESPONSE_NAMES[response]).join(" · ") : "";
});

function answerIntent(response: IntentResponse): void {
  const result = respondIntent(response);
  if (result) reportResult(result.text);
}
</script>

<style scoped>
/*
 * 她那片地 —— 只在**卷首**那一条,不是整帖铺满。
 *
 * 先试过铺满(inset:0 + 0.5 的墨):真渲染出来山脊正横在「三衡」那三道刻度条上 ——
 * 缘分 / 信任 / 契合的长度是这一帖最要紧的读数,被一道坡切过去就没法读。
 *
 * 故收成卷首一条(7rem,盖住帖名与她那行身份),正文滚过去时从它上面经过:
 * 打开就看见她属于哪片地,读账时底下是干净的纸。
 *
 * 点景关掉(组件上 `:marks="false"`):这一条仍压着帖名与身份那两行,
 * 月与舟落在字上两边都读不清 —— 与地界志卷首、行旅图那两处同一条理由。
 */
.bond-scene {
  --ink-scene-h: 7rem;
  /*
   * 墨取 0.72:这一条底下只有帖名与身份两行(不是整篇文章),可以比铺满那版浓一档;
   * 再浓一档,「同行帖 · 厉孤」与「惜物 · 器道道」就和山脊抢。
   */
  --ink-scene-ink: 0.72;
  position: absolute;
  inset-inline: 0;
  top: 0;
  pointer-events: none;
}

.bond-folio,
.bond-empty,
.bond-history {
  --bond-line: rgb(var(--color-ink-rgb) / 0.14);
  --bond-paper: rgb(var(--color-paper-deep-rgb) / 0.34);
  min-width: 0;
}

/*
 * 卷首那一条画的锚 —— 只给有画的那一篇(在世同行)。
 * `isolation` 让画与正文各自的层级在本帖内结算,不去和浮层外面的东西比。
 */
.bond-folio {
  position: relative;
  isolation: isolate;
}
.bond-folio > :not(.bond-scene) {
  position: relative;
  z-index: 1;
}

.bond-head {
  display: grid;
  grid-template-columns: 3rem minmax(0, 1fr);
  align-items: start;
  gap: 0.72rem;
}

.bond-head__seal,
.bond-empty__seal {
  display: grid;
  width: 3rem;
  height: 3rem;
  place-items: center;
  border: 1px solid rgb(var(--color-qing-rgb) / 0.4);
  border-radius: 2px;
  background: rgb(var(--color-qing-rgb) / 0.04);
  color: rgb(var(--color-qing-rgb));
  font-size: var(--type-section);
  line-height: 1;
}

.bond-head__identity {
  min-width: 0;
}

.bond-head__eyebrow,
.bond-empty__eyebrow {
  color: rgb(var(--color-qing-rgb));
  font-size: var(--type-note);
  letter-spacing: 0.18em;
  line-height: 1.5;
}

.bond-head__title,
.bond-empty__title {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.12rem 0.56rem;
  margin-top: 0.08rem;
  color: rgb(var(--color-ink-rgb));
  font-family: var(--font-kai);
  font-size: var(--type-section);
  letter-spacing: 0.07em;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.bond-head__lean {
  color: rgb(var(--color-qing-rgb));
  font-size: var(--type-title);
}

.bond-head__brief,
.bond-empty__copy {
  margin-top: 0.18rem;
  color: rgb(var(--color-ink-soft-rgb));
  font-size: var(--type-body);
  line-height: 1.65;
}

.bond-head__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.22rem 0.48rem;
  margin-top: 0.28rem;
  color: rgb(var(--color-ink-faint-rgb));
  font-size: var(--type-note);
  line-height: 1.55;
}

.bond-head__state {
  padding: 0 0.24rem;
  border: 1px solid var(--bond-line);
  border-radius: 2px;
  color: rgb(var(--color-ink-soft-rgb));
  white-space: nowrap;
}

.bond-head__state.is-qing {
  border-color: rgb(var(--color-qing-rgb) / 0.28);
  color: rgb(var(--color-qing-rgb));
}

.bond-head__state.is-danger {
  border-color: rgb(var(--color-cinnabar-rgb) / 0.28);
  color: rgb(var(--color-cinnabar-rgb));
}

.bond-now {
  margin-top: 0.78rem;
  padding-top: 0.58rem;
  border-top: 1px solid var(--bond-line);
}

.bond-section-head {
  display: grid;
  grid-template-columns: 1.65rem minmax(0, 1fr);
  align-items: start;
  gap: 0.5rem;
}

.bond-section-head__mark {
  display: grid;
  width: 1.65rem;
  height: 1.65rem;
  place-items: center;
  border: 1px solid rgb(var(--color-cinnabar-rgb) / 0.36);
  border-radius: 2px;
  color: rgb(var(--color-cinnabar-rgb));
  font-size: var(--type-note);
  line-height: 1;
}

.bond-section-head__title {
  color: rgb(var(--color-ink-rgb));
  font-family: var(--font-kai);
  font-size: var(--type-title);
  letter-spacing: 0.06em;
  line-height: 1.45;
}

.bond-section-head__hint {
  margin-top: 0.06rem;
  color: rgb(var(--color-ink-faint-rgb));
  font-size: var(--type-note);
  line-height: 1.55;
}

.bond-intent,
.bond-event {
  margin-top: 0.46rem;
  padding: 0.58rem;
  border: 1px solid var(--bond-line);
  border-left: 2px solid rgb(var(--color-qing-rgb) / 0.58);
  border-radius: 2px;
  background:
    linear-gradient(105deg, rgb(var(--color-qing-rgb) / 0.025), transparent 52%), var(--bond-paper);
}

.bond-kicker {
  color: rgb(var(--color-qing-rgb));
  font-size: var(--type-note);
  letter-spacing: 0.12em;
  line-height: 1.5;
}

.bond-quote {
  margin-top: 0.2rem;
  padding: 0.38rem 0;
  border-bottom: 1px solid rgb(var(--color-ink-rgb) / 0.08);
  color: rgb(var(--color-ink-rgb));
  font-family: var(--font-kai);
  font-size: var(--type-title);
  line-height: 1.72;
  overflow-wrap: anywhere;
}

.bond-line {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: baseline;
  gap: 0.55rem;
  margin-top: 0.22rem;
  color: rgb(var(--color-ink-soft-rgb));
  font-size: var(--type-body);
  line-height: 1.6;
}

.bond-line > span {
  color: rgb(var(--color-qing-rgb));
  font-family: var(--font-kai);
  font-size: var(--type-note);
  white-space: nowrap;
}

.bond-line--faint {
  color: rgb(var(--color-ink-faint-rgb));
  font-size: var(--type-note);
}

.bond-choice-list {
  display: grid;
  gap: 0.38rem;
  margin-top: 0.48rem;
}

.bond-choice {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
  padding: 0.5rem 0.54rem;
  border: 1px solid var(--bond-line);
  border-left: 2px solid rgb(var(--color-qing-rgb) / 0.3);
  border-radius: 2px;
  background: rgb(var(--color-paper-rgb) / 0.62);
  color: rgb(var(--color-ink-soft-rgb));
  text-align: left;
  transition:
    border-color 0.14s ease,
    background-color 0.14s ease;
}

.bond-choice:hover {
  border-color: rgb(var(--color-qing-rgb) / 0.38);
  background: rgb(var(--color-qing-rgb) / 0.035);
}

.bond-choice:focus-visible {
  outline: 2px solid rgb(var(--color-cinnabar-rgb) / 0.68);
  outline-offset: 2px;
}

.bond-choice.is-taboo {
  border-left-color: rgb(var(--color-cinnabar-rgb) / 0.52);
}

.bond-choice.is-danger {
  border-color: rgb(var(--color-cinnabar-rgb) / 0.3);
  border-left-color: rgb(var(--color-cinnabar-rgb) / 0.76);
}

.bond-choice:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.bond-choice__copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.16rem;
}

.bond-choice__label {
  color: rgb(var(--color-ink-rgb));
  font-size: var(--type-body);
  line-height: 1.55;
  overflow-wrap: anywhere;
}

.bond-choice__note,
.bond-choice__warning,
.bond-choice__assurance {
  color: rgb(var(--color-ink-faint-rgb));
  font-size: var(--type-note);
  line-height: 1.55;
  overflow-wrap: anywhere;
}

.bond-choice__warning {
  color: rgb(var(--color-cinnabar-rgb));
}

.bond-choice__assurance {
  color: rgb(var(--color-qing-rgb));
}

.bond-choice__flags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.22rem;
}

.bond-flag {
  padding: 0 0.22rem;
  border: 1px solid var(--bond-line);
  border-radius: 2px;
  color: rgb(var(--color-ink-faint-rgb));
  font-size: var(--type-note);
  line-height: 1.5;
  white-space: nowrap;
}

.bond-flag.is-qing {
  border-color: rgb(var(--color-qing-rgb) / 0.26);
  color: rgb(var(--color-qing-rgb));
}

.bond-flag.is-danger {
  border-color: rgb(var(--color-cinnabar-rgb) / 0.28);
  color: rgb(var(--color-cinnabar-rgb));
}

.bond-choice__read {
  display: grid;
  grid-template-columns: repeat(3, auto);
  align-items: center;
  gap: 0.2rem;
}

.bond-delta {
  padding: 0 0.22rem;
  border: 1px solid var(--bond-line);
  border-radius: 2px;
  color: rgb(var(--color-ink-faint-rgb));
  font-size: var(--type-note);
  line-height: 1.55;
  white-space: nowrap;
}

.bond-delta.is-up {
  border-color: rgb(var(--color-qing-rgb) / 0.26);
  color: rgb(var(--color-qing-rgb));
}

.bond-delta.is-down {
  border-color: rgb(var(--color-cinnabar-rgb) / 0.28);
  color: rgb(var(--color-cinnabar-rgb));
}

.bond-result {
  margin-top: 0.42rem;
  padding: 0.48rem 0.56rem;
  border: 1px solid rgb(var(--color-cinnabar-rgb) / 0.2);
  border-left: 2px solid rgb(var(--color-cinnabar-rgb) / 0.62);
  border-radius: 2px;
  background: rgb(var(--color-cinnabar-rgb) / 0.035);
  color: rgb(var(--color-ink-soft-rgb));
  font-size: var(--type-body);
  line-height: 1.68;
  overflow-wrap: anywhere;
}

.bond-result:focus-visible {
  outline: 2px solid rgb(var(--color-cinnabar-rgb) / 0.64);
  outline-offset: 2px;
}

.bond-event {
  border-left-color: rgb(var(--color-cinnabar-rgb) / 0.58);
}

.bond-event__head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.14rem 0.6rem;
}

.bond-event__title {
  color: rgb(var(--color-ink-rgb));
  font-size: var(--type-title);
  letter-spacing: 0.1em;
  line-height: 1.45;
}

.bond-event__cause {
  color: rgb(var(--color-ink-faint-rgb));
  font-size: var(--type-note);
  line-height: 1.55;
}

.bond-event__story {
  margin-top: 0.24rem;
  color: rgb(var(--color-ink-soft-rgb));
  font-size: var(--type-body);
  line-height: 1.72;
  overflow-wrap: anywhere;
}

.bond-event__brief {
  display: grid;
  gap: 0.14rem;
  margin-top: 0.34rem;
  padding-left: 0.48rem;
  border-left: 2px solid rgb(var(--color-qing-rgb) / 0.4);
}

.bond-event__brief p {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: baseline;
  gap: 0.46rem;
  color: rgb(var(--color-ink-soft-rgb));
  font-size: var(--type-note);
  line-height: 1.6;
}

.bond-event__brief span {
  color: rgb(var(--color-qing-rgb));
  font-family: var(--font-kai);
  white-space: nowrap;
}

.bond-event__stance {
  margin-top: 0.28rem;
  color: rgb(var(--color-cinnabar-rgb));
  font-size: var(--type-body);
  line-height: 1.62;
}

.bond-quiet {
  display: grid;
  grid-template-columns: 2rem minmax(0, 1fr);
  align-items: start;
  gap: 0.54rem;
  margin-top: 0.72rem;
  padding: 0.54rem 0.58rem;
  border: 1px solid var(--bond-line);
  border-radius: 2px;
  background: var(--bond-paper);
}

.bond-quiet__seal {
  display: grid;
  width: 2rem;
  height: 2rem;
  place-items: center;
  border: 1px solid rgb(var(--color-qing-rgb) / 0.34);
  border-radius: 2px;
  color: rgb(var(--color-qing-rgb));
  font-size: var(--type-title);
  line-height: 1;
}

.bond-quiet__title {
  color: rgb(var(--color-ink-rgb));
  font-family: var(--font-kai);
  font-size: var(--type-title);
  line-height: 1.45;
}

.bond-quiet__copy {
  margin-top: 0.1rem;
  color: rgb(var(--color-ink-faint-rgb));
  font-size: var(--type-note);
  line-height: 1.6;
}

.bond-detail-grid {
  display: grid;
  gap: 0.62rem;
  margin-top: 0.66rem;
}

.bond-person,
.bond-meters {
  min-width: 0;
  padding-top: 0.5rem;
  border-top: 1px solid var(--bond-line);
}

.bond-panel-title {
  color: rgb(var(--color-ink-soft-rgb));
  font-family: var(--font-kai);
  font-size: var(--type-title);
  letter-spacing: 0.1em;
  line-height: 1.45;
}

.bond-person__rows {
  display: grid;
  gap: 0.34rem;
  margin-top: 0.3rem;
}

.bond-person__rows > div {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: baseline;
  gap: 0.48rem;
}

.bond-person__rows dt {
  color: rgb(var(--color-qing-rgb));
  font-size: var(--type-note);
  white-space: nowrap;
}

.bond-person__rows dd {
  color: rgb(var(--color-ink-soft-rgb));
  font-size: var(--type-body);
  line-height: 1.62;
  overflow-wrap: anywhere;
}

.bond-person__note {
  margin-top: 0.4rem;
  padding-top: 0.3rem;
  border-top: 1px solid rgb(var(--color-ink-rgb) / 0.08);
  color: rgb(var(--color-ink-faint-rgb));
  font-size: var(--type-note);
  line-height: 1.6;
}

.bond-meters__head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.14rem 0.48rem;
}

.bond-meters__next {
  color: rgb(var(--color-qing-rgb));
  font-size: var(--type-note);
  line-height: 1.55;
}

.bond-meter-list {
  display: grid;
  gap: 0.36rem;
  margin-top: 0.32rem;
}

.bond-meter__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.4rem;
  color: rgb(var(--color-ink-soft-rgb));
  font-size: var(--type-note);
  line-height: 1.55;
}

.bond-meter__head > span:last-child {
  color: rgb(var(--color-ink-rgb));
  white-space: nowrap;
}

.bond-meter__head small {
  color: rgb(var(--color-ink-faint-rgb));
  font-size: inherit;
}

.bond-meter__head em {
  margin-left: 0.28rem;
  color: rgb(var(--color-ink-faint-rgb));
  font-style: normal;
}

.bond-meter__head em.is-ready {
  color: rgb(var(--color-qing-rgb));
}

.bond-meter__track {
  position: relative;
  height: 4px;
  margin-top: 0.2rem;
  background: rgb(var(--color-ink-rgb) / 0.1);
}

.bond-meter__fill {
  position: absolute;
  inset: 0 auto 0 0;
  background: rgb(var(--color-qing-rgb));
}

.bond-meter__goal {
  position: absolute;
  top: -0.2rem;
  bottom: -0.2rem;
  width: 1px;
  background: rgb(var(--color-ink-rgb) / 0.38);
}

.bond-shared {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.12rem 0.42rem;
  margin-top: 0.38rem;
  padding-top: 0.32rem;
  border-top: 1px solid rgb(var(--color-ink-rgb) / 0.08);
  color: rgb(var(--color-ink-faint-rgb));
  font-size: var(--type-note);
  line-height: 1.55;
}

.bond-shared strong {
  color: rgb(var(--color-ink-soft-rgb));
  font-weight: 500;
}

.bond-shared em {
  color: rgb(var(--color-qing-rgb));
  font-style: normal;
}

.bond-empty {
  display: grid;
  grid-template-columns: 3rem minmax(0, 1fr);
  align-items: start;
  gap: 0.72rem;
  padding: 0.72rem;
  border: 1px solid var(--bond-line);
  border-radius: 2px;
  background: var(--bond-paper);
}

.bond-empty__history {
  margin-top: 0.3rem;
  color: rgb(var(--color-qing-rgb));
  font-size: var(--type-note);
  line-height: 1.6;
}

.bond-history {
  margin-top: 0.74rem;
  padding-top: 0.54rem;
  border-top: 1px solid var(--bond-line);
}

.bond-history__head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.12rem 0.48rem;
}

.bond-history__title {
  color: rgb(var(--color-ink-soft-rgb));
  font-size: var(--type-title);
  letter-spacing: 0.1em;
  line-height: 1.45;
}

.bond-history__count {
  color: rgb(var(--color-ink-faint-rgb));
  font-size: var(--type-note);
}

.bond-history__rows.scroll-pane {
  max-height: 10rem;
  margin-top: 0.3rem;
  overflow-y: auto;
  scrollbar-width: thin;
}

.bond-history__row {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.08rem 0.48rem;
  padding: 0.26rem 0;
  border-bottom: 1px solid rgb(var(--color-ink-rgb) / 0.07);
  font-size: var(--type-body);
  line-height: 1.55;
}

.bond-history__row:focus-visible {
  outline: 2px solid rgb(var(--color-cinnabar-rgb) / 0.58);
  outline-offset: 1px;
}

.bond-history__name {
  color: rgb(var(--color-ink-soft-rgb));
  white-space: nowrap;
}

.bond-history__read {
  color: rgb(var(--color-ink-faint-rgb));
  text-align: right;
  overflow-wrap: anywhere;
}

.bond-history__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.32rem;
  margin-top: 0.34rem;
}

.bond-history__action {
  min-height: 28px;
  padding: 0.18rem 0.36rem;
  border: 1px solid var(--bond-line);
  border-radius: 2px;
  background: transparent;
  color: rgb(var(--color-ink-soft-rgb));
  font-size: var(--type-note);
  line-height: 1.5;
  white-space: normal;
}

.bond-history__action.is-accent {
  border-color: rgb(var(--color-cinnabar-rgb) / 0.3);
  color: rgb(var(--color-cinnabar-rgb));
}

@media (min-width: 620px) {
  .bond-detail-grid {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 0.8rem;
  }

  .bond-person,
  .bond-meters {
    padding-top: 0.5rem;
  }
}

@media (max-width: 220px) {
  .bond-choice__read {
    grid-template-columns: minmax(0, 1fr);
    justify-items: start;
    width: 100%;
  }

  .bond-choice {
    grid-template-columns: minmax(0, 1fr);
    align-items: start;
  }

  .bond-head,
  .bond-empty,
  .bond-quiet {
    grid-template-columns: minmax(0, 1fr);
  }

  .bond-head__seal,
  .bond-empty__seal,
  .bond-quiet__seal {
    width: 2.35rem;
    height: 2.35rem;
  }

  .bond-line,
  .bond-event__brief p,
  .bond-person__rows > div {
    grid-template-columns: minmax(0, 1fr);
    gap: 0.06rem;
  }

  .bond-line > span,
  .bond-event__brief span,
  .bond-person__rows dt {
    white-space: normal;
  }

  .bond-meter__head {
    align-items: flex-start;
    flex-direction: column;
    gap: 0.06rem;
  }

  .bond-meter__head > span:last-child {
    white-space: normal;
  }

  .bond-history__read {
    text-align: left;
  }
}
</style>
