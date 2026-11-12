<template>
  <!-- 师承弹窗:未拜师时是四脉择师谱,定契后是师承帖。 -->
  <BaseModal
    :open="open"
    size="wide"
    :title="mentorVer ? `师承帖 · ${mentorVer.mentor?.name ?? ''}` : '择师谱'"
    :aria-label="
      mentorVer
        ? `${mentorVer.mentor?.name ?? ''}师承帖，师尊${mentorVer.mentor?.master ?? ''}`
        : '择师谱，四位师尊同谱比较，拜入前需再次确认'
    "
    @close="emit('close')"
  >
    <article
      v-if="mentorVer"
      class="mentor-dossier stagger-in"
      data-mentor-view="chosen"
      data-mentor-affinity
    >
      <!--
        这一脉的那片地 —— 与择师谱上是同一副长相。

        师承弹窗是同一件事的两段:谱上「择一而事之」,契后「已定师承 · 转世不失」。
        画的是同一片 —— 剑修立在山门,丹修在草木间,阵修守着格局,猎修望着路。
      -->
      <InkScene
        class="mentor-dossier__scene"
        variant="strip"
        :terrain="sceneTerrainOfMentor(mentorVer.mentor?.id)"
        aria-hidden="true"
      />

      <header class="mentor-dossier__head">
        <span class="mentor-dossier__seal font-kai" aria-hidden="true">{{ mentorSeal }}</span>
        <div class="mentor-dossier__identity">
          <p class="mentor-dossier__eyebrow">已定师承 · 转世不失</p>
          <h2 class="mentor-dossier__title">
            <span>{{ mentorVer.mentor?.name }}</span>
            <span class="mentor-dossier__line">{{ mentorVer.mentor?.title }}</span>
          </h2>
          <p class="mentor-dossier__master">师尊 · {{ mentorVer.mentor?.master }}</p>
        </div>
      </header>

      <blockquote class="mentor-dossier__quote">「{{ mentorVer.line }}」</blockquote>

      <section
        class="mentor-affinity"
        :class="{
          'is-qing': mentorVer.affinity > 0.2,
          'is-cinnabar': mentorVer.affinity < -0.2,
        }"
      >
        <div class="mentor-affinity__head">
          <span class="mentor-affinity__label">行为契合</span>
          <span class="mentor-affinity__read">
            <span class="mentor-affinity__value tabular">{{ mentorVer.affinity.toFixed(2) }}</span>
            <span class="mentor-affinity__band">{{ affinityBand }}</span>
          </span>
        </div>
        <div
          class="mentor-affinity__track"
          role="img"
          :aria-label="`契合度 ${mentorVer.affinity.toFixed(2)}，${affinityBand}`"
        >
          <span class="mentor-affinity__center" aria-hidden="true" />
          <span
            class="mentor-affinity__marker"
            :style="{ left: affinityPercent }"
            aria-hidden="true"
          />
        </div>
        <div class="mentor-affinity__axis" aria-hidden="true">
          <span>相悖</span>
          <span>中正</span>
          <span>相合</span>
        </div>
        <p class="mentor-affinity__note">此数只评言行，不施惩罚；与师门相合时，师尊自有嘉许。</p>
        <!--
          行为轴 —— 上面那个数是怎么来的。
          此前只印「行为契合 0.35」与一句师尊评价，玩家读到「剑意未纯」时
          看不出是自己丹药炼多了：权重表里那条 -0.6 只活在代码里。
          加分项玩家迟早会撞对，**减分项却是无声的** —— 他可能一直在做让师承
          更远的事，还以为是别的原因。故两侧都摊开。
        -->
        <dl v-if="axes" class="mentor-axes" data-mentor-axes>
          <div class="mentor-axes__row" data-mentor-axes-toward>
            <dt>相亲</dt>
            <dd>{{ axes.toward.join(" · ") }}</dd>
          </div>
          <div class="mentor-axes__row is-against" data-mentor-axes-against>
            <dt>相左</dt>
            <dd>{{ axes.against.join(" · ") }}</dd>
          </div>
        </dl>
      </section>

      <section class="mentor-mods">
        <p class="mentor-mods__head">
          <span>师承词条</span>
          <span>已并入终局属性</span>
        </p>
        <div class="mentor-mods__list">
          <span
            v-for="p in modsPills(mentorVer.mentor?.mods ?? {})"
            :key="p.name"
            class="chip-ink gap-1 border-qing/30 !py-0.5 text-note text-ink-soft"
            data-mentor-mod
          >
            {{ p.name }}
            <span class="tabular text-qing">{{ p.value }}</span>
          </span>
        </div>
      </section>

      <p class="mentor-dossier__oath">此门已随神魂，转世仍在此谱；<strong>不可改投</strong>。</p>
    </article>

    <article
      v-else
      class="mentor-ledger stagger-in"
      data-mentor-ledger
      data-mentor-view="selection"
    >
      <header class="mentor-ledger__head">
        <div>
          <p class="mentor-ledger__eyebrow">缘法 · 四脉传道</p>
          <h2 class="mentor-ledger__title">先横读门风，再择一师</h2>
        </div>
        <span class="mentor-ledger__stamp font-kai">一世一师</span>
      </header>

      <p class="mentor-ledger__intro">
        师承不是职业，只给一条方向性词条与一套行为评价；它不会封住任何流派或道途。
      </p>

      <section class="mentor-contract" data-mentor-permanent>
        <span class="mentor-contract__mark font-kai" aria-hidden="true">契</span>
        <div>
          <p class="mentor-contract__title">此择不是试学</p>
          <p class="mentor-contract__copy">拜入后永久保留，转世不失；<strong>不可改投</strong>。</p>
        </div>
      </section>

      <div class="mentor-ledger__rule">
        <span>四脉同列</span>
        <span>门风 · 师尊 · 入门词条</span>
      </div>

      <div class="mentor-ledger__choices">
        <button
          v-for="(m, index) in choices"
          :key="m.id"
          type="button"
          class="mentor-choice"
          data-mentor-choice
          :data-mentor-id="m.id"
          :data-hinted="hintMentor === m.id ? 'true' : undefined"
          :aria-pressed="pendingMentor?.id === m.id"
          :aria-label="mentorChoiceLabel(m)"
          @click="armMentor(m.id)"
        >
          <span class="mentor-choice__seal font-kai" aria-hidden="true">
            {{ m.name.slice(0, 1) }}
          </span>
          <span class="mentor-choice__body">
            <span class="mentor-choice__top">
              <span class="mentor-choice__ordinal">{{ cnNumber(index + 1) }}签</span>
              <span class="mentor-choice__name font-kai">{{ m.name }}</span>
              <span v-if="hintMentor === m.id" class="mentor-choice__hint">机缘引荐</span>
            </span>
            <span class="mentor-choice__title">
              <span>{{ m.title }}</span>
              <span class="mentor-choice__master">师尊 · {{ m.master }}</span>
            </span>
            <span class="mentor-choice__desc">{{ m.desc }}</span>
            <span class="mentor-choice__mods" data-mentor-mods>
              <span class="mentor-choice__mods-label">入门词条</span>
              <span class="mentor-choice__mods-list">
                <span v-for="p in modsPills(m.mods)" :key="p.name" class="mentor-choice__mod">
                  {{ p.name }}
                  <span class="tabular text-qing">{{ p.value }}</span>
                </span>
              </span>
            </span>
          </span>
          <!--
            这一脉的那片地 —— 落在**签内**,不是整谱一张底。

            四脉是四种完全不同的活法(剑=山门、丹=草木、阵=格局、猎=山河),
            而这一屏是「择一而事之」:四签并排比较,共用一张底就分不出谁是谁。
          -->
          <span class="mentor-choice__scene" aria-hidden="true">
            <InkScene
              variant="strip"
              :terrain="sceneTerrainOfMentor(m.id)"
              :world-id="player.world.id"
            />
          </span>
          <span class="mentor-choice__action font-kai" aria-hidden="true">
            {{ pendingMentor?.id === m.id ? "已择" : "择" }}
          </span>
        </button>
      </div>
    </article>

    <template #footer>
      <button
        v-if="mentorVer"
        ref="closeButton"
        type="button"
        class="btn-ghost tap-row w-full !text-body"
        @click="emit('close')"
      >
        收起师承帖
      </button>

      <section v-else-if="pendingMentor" class="mentor-oath" data-mentor-confirm>
        <div class="mentor-oath__copy" role="status" aria-live="polite" aria-atomic="true">
          <p class="mentor-oath__headline">
            <span class="mentor-oath__mark font-kai" aria-hidden="true">契</span>
            已择 <strong>{{ pendingMentor.name }}</strong> · {{ pendingMentor.title }}
          </p>
          <p class="mentor-oath__detail">
            师尊 {{ pendingMentor.master }} · {{ modsText(pendingMentor.mods) }}
          </p>
          <p class="mentor-oath__warning">
            落定后随神魂保留，
            <strong class="text-cinnabar">不可改投</strong>。
          </p>
        </div>
        <div class="mentor-oath__actions">
          <button type="button" class="btn-ghost tap-row !text-body" @click="cancelMentor">
            再想想
          </button>
          <button type="button" class="btn-seal tap-row !text-body" @click="confirmMentor">
            确认拜师
          </button>
        </div>
      </section>

      <div v-else class="mentor-ledger__footer">
        <p>先点一签细读；卷尾还要再确认一次。</p>
        <button type="button" class="btn-ghost tap-row !text-body" @click="emit('close')">
          暂不拜师
        </button>
      </div>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { usePlayerStore } from "@/stores/player";
import { useQuestsStore } from "@/stores/quests";
import { mentorChoices, mentorVerdict } from "@/core/mentorService";
import { mentorHint } from "@/core/fortuneChain";
import { modsPills, modsText } from "@/data/statNames";
import type { MentorDef, MentorId } from "@/data/mentors";
import { cnNumber, formatPercent } from "@/utils/format";
import BaseModal from "@/components/common/BaseModal.vue";
import InkScene from "@/components/common/InkScene.vue";
import { sceneTerrainOfMentor } from "@/ui/sceneTerrain";
import { mentorBehaviorAxes } from "@/ui/mentorBehaviorAxes";

/**
 * 四脉共用一张择师谱。
 *
 * 点签只把该脉收进卷尾待确认位,真正写 `player.mentor` 只发生在「确认拜师」。
 * 这条两段式不是多问一句,而是把跨世保留、不可改投的代价摊在落定动作前。
 */
const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const player = usePlayerStore();
const quests = useQuestsStore();
const mentorVer = computed(() => mentorVerdict(player.mentor, (k) => quests.counter(k as never)));
const hintMentor = computed(() => mentorHint(player.fortuneChoices));
const choices = computed(() => mentorChoices());
const closeButton = ref<HTMLButtonElement | null>(null);

const pendingMentorId = ref<MentorId | null>(null);
const pendingMentor = computed(
  () => choices.value.find((m) => m.id === pendingMentorId.value) ?? null,
);
const mentorSeal = computed(() => mentorVer.value?.mentor?.name.slice(0, 1) ?? "");

const affinityBand = computed(() => {
  const affinity = mentorVer.value?.affinity ?? 0;
  if (affinity > 0.2) return "相合";
  if (affinity < -0.2) return "相悖";
  return "平平";
});
const affinityPercent = computed(() => {
  const affinity = mentorVer.value?.affinity ?? 0;
  return formatPercent((affinity + 1) / 2, 0);
});

/**
 * 行为轴 —— 那个契合度由什么行为构成。
 *
 * 权重表只有 `core/mentorService` 一份，这一层只把键名翻成人话
 * （见 `ui/mentorBehaviorAxes`）。
 */
const axes = computed(() => mentorBehaviorAxes(player.mentor));

function mentorChoiceLabel(m: MentorDef): string {
  const hint = hintMentor.value === m.id ? "机缘引荐。" : "";
  const selected = pendingMentor.value?.id === m.id ? "已择，尚待确认。" : "择此师。";
  return `${m.name}，${m.title}，师尊${m.master}，${m.desc}。入门词条：${modsText(m.mods)}。${hint}${selected}`;
}

function armMentor(id: MentorId): void {
  if (mentorVer.value) return;
  pendingMentorId.value = id;
  void nextTick(() => {
    document
      .querySelector<HTMLElement>(`[data-mentor-choice][data-mentor-id="${id}"]`)
      ?.scrollIntoView({ block: "nearest" });
  });
}

function cancelMentor(): void {
  const id = pendingMentorId.value;
  pendingMentorId.value = null;
  if (!id) return;
  void nextTick(() => {
    document
      .querySelector<HTMLButtonElement>(`[data-mentor-choice][data-mentor-id="${id}"]`)
      ?.focus();
  });
}

function confirmMentor(): void {
  const selected = pendingMentor.value;
  if (!selected || player.mentor) return;
  pendingMentorId.value = null;
  player.adoptMentor(selected.id);
  void nextTick(() => closeButton.value?.focus());
}

watch(
  () => props.open,
  (open) => {
    if (!open) pendingMentorId.value = null;
  },
);
</script>

<style scoped>
.mentor-ledger,
.mentor-dossier {
  --mentor-line: rgb(var(--color-ink-rgb) / 0.14);
  --mentor-line-strong: rgb(var(--color-ink-rgb) / 0.22);
  --mentor-paper: rgb(var(--color-paper-deep-rgb) / 0.34);
  min-width: 0;
}

.mentor-ledger__head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: 0.65rem 0.8rem;
}

.mentor-ledger__eyebrow,
.mentor-dossier__eyebrow {
  color: rgb(var(--color-qing-rgb));
  font-size: var(--type-note);
  letter-spacing: 0.18em;
  line-height: 1.5;
}

.mentor-ledger__title,
.mentor-dossier__title {
  color: rgb(var(--color-ink-rgb));
  font-family: var(--font-kai);
  font-size: var(--type-section);
  letter-spacing: 0.08em;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.mentor-ledger__title {
  margin-top: 0.12rem;
}

.mentor-ledger__stamp {
  padding: 0.2rem 0.34rem;
  border: 1px solid rgb(var(--color-qing-rgb) / 0.34);
  border-radius: 2px;
  background: rgb(var(--color-qing-rgb) / 0.04);
  color: rgb(var(--color-qing-rgb));
  font-size: var(--type-note);
  letter-spacing: 0.1em;
  line-height: 1.5;
  white-space: nowrap;
}

.mentor-ledger__intro {
  margin-top: 0.55rem;
  color: rgb(var(--color-ink-soft-rgb));
  font-size: var(--type-body);
  line-height: 1.7;
}

.mentor-contract {
  display: grid;
  grid-template-columns: 2rem minmax(0, 1fr);
  align-items: start;
  gap: 0.52rem;
  margin-top: 0.7rem;
  padding: 0.52rem 0.58rem;
  border: 1px solid rgb(var(--color-cinnabar-rgb) / 0.22);
  border-left: 2px solid rgb(var(--color-cinnabar-rgb) / 0.7);
  border-radius: 2px;
  background: rgb(var(--color-cinnabar-rgb) / 0.04);
}

.mentor-contract__mark,
.mentor-oath__mark {
  display: grid;
  width: 2rem;
  height: 2rem;
  place-items: center;
  border: 1px solid rgb(var(--color-cinnabar-rgb) / 0.42);
  border-radius: 2px;
  color: rgb(var(--color-cinnabar-rgb));
  font-size: var(--type-title);
  line-height: 1;
}

.mentor-contract__title {
  color: rgb(var(--color-ink-rgb));
  font-family: var(--font-kai);
  font-size: var(--type-title);
  letter-spacing: 0.08em;
  line-height: 1.4;
}

.mentor-contract__copy {
  margin-top: 0.08rem;
  color: rgb(var(--color-ink-soft-rgb));
  font-size: var(--type-body);
  line-height: 1.65;
}

.mentor-contract__copy strong {
  color: rgb(var(--color-cinnabar-rgb));
  font-weight: 600;
}

.mentor-ledger__rule {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.12rem 0.6rem;
  margin-top: 0.6rem;
  padding: 0.34rem 0 0.3rem;
  border-top: 1px solid var(--mentor-line);
  color: rgb(var(--color-ink-faint-rgb));
  font-size: var(--type-note);
  line-height: 1.5;
}

.mentor-ledger__rule span:first-child {
  color: rgb(var(--color-ink-soft-rgb));
  font-family: var(--font-kai);
  letter-spacing: 0.12em;
}

.mentor-ledger__choices {
  display: grid;
  gap: 0.4rem;
  margin-top: 0.34rem;
}

/*
 * 一脉的那片地 —— 落在签内。
 *
 * 跨过整签三列(grid-column: 1 / -1)放在正文之下:签的正文是
 * 「门风 · 师尊 · 入门词条」三行读数,画不能挤在它们旁边(那一格只剩两栏,
 * 画会窄到读不出是什么);另起一行、整签宽,四签并排时仍看得出是哪片地。
 *
 * 高度按画自己的比例交给容器,不写死 rem —— 这一签在 390 宽里正文栏约 200px,
 * 写死 rem 会把顶部(月、雪点、云)裁掉,而那正是分辨四脉的东西。
 */
.mentor-choice__scene {
  /*
   * 占正文那一栏(第 2 列),与「择」并列 —— 不跨满整签。
   *
   * 跨满(`1 / -1`)试过:画把「择」挤到它下面一整行,四签每签高出一截,
   * 而那个「择」正是玩家要按的东西,反倒离正文最远。
   * 放在正文栏下方,画与「择」同行,签的节奏不变。
   */
  grid-column: 2 / 3;
  display: block;
  /*
   * 择师谱是 **Teleport 到 body** 的弹窗:`--world-mountain` 定义在
   * `.app-shell[data-world=…]` 上,弹窗不在那棵子树里,取不到值 ——
   * `InkScene` 那句 `fill: var(--world-mountain, currentColor)` 会退化成 currentColor。
   * 故在这一层自己给一个固定墨色(与同组件的dossier、突破结果、试炼档案一致)。
   */
  --world-mountain: rgb(var(--color-ink-rgb));
  --ink-scene-h: 100%;
  --ink-scene-ink: 1.2;
  /* 四脉各有各的天,不继承玩家脚下那一片的世界色 */
  --world-mountain: rgb(var(--color-ink-rgb));
  margin-top: 0.34rem;
  aspect-ratio: 420 / 160;
  overflow: hidden;
}

/*
 * 师承帖卷首那条 —— 与择师谱同一副长相。
 * 定高的一条排在帖首:契后这一帖正文是行为契合、师尊评价与词条,
 * 画占自己的高度就不会把读数推下去。
 */
.mentor-dossier__scene {
  --ink-scene-h: 5.4rem;
  --ink-scene-ink: 1.2;
  --world-mountain: rgb(var(--color-ink-rgb));
  margin-bottom: 0.6rem;
}

.mentor-choice {
  display: grid;
  grid-template-columns: 2.25rem minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.58rem;
  min-width: 0;
  padding: 0.6rem 0.64rem;
  border: 1px solid var(--mentor-line);
  border-left: 2px solid rgb(var(--color-qing-rgb) / 0.38);
  border-radius: 2px;
  background:
    linear-gradient(105deg, rgb(var(--color-qing-rgb) / 0.025), transparent 48%),
    var(--mentor-paper);
  text-align: left;
  transition:
    border-color 0.14s ease,
    background-color 0.14s ease;
}

.mentor-choice[data-hinted="true"] {
  border-left-color: rgb(var(--color-cinnabar-rgb) / 0.58);
}

.mentor-choice[aria-pressed="true"] {
  border-color: rgb(var(--color-cinnabar-rgb) / 0.38);
  border-left-color: rgb(var(--color-cinnabar-rgb) / 0.82);
  background:
    linear-gradient(105deg, rgb(var(--color-cinnabar-rgb) / 0.04), transparent 52%),
    var(--mentor-paper);
}

.mentor-choice:focus-visible {
  outline: 2px solid rgb(var(--color-cinnabar-rgb) / 0.7);
  outline-offset: 2px;
}

.mentor-choice__seal {
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  place-items: center;
  border: 1px solid rgb(var(--color-qing-rgb) / 0.4);
  border-radius: 2px;
  background: rgb(var(--color-qing-rgb) / 0.04);
  color: rgb(var(--color-qing-rgb));
  font-size: var(--type-section);
  line-height: 1;
}

.mentor-choice[aria-pressed="true"] .mentor-choice__seal {
  border-color: rgb(var(--color-cinnabar-rgb) / 0.48);
  background: rgb(var(--color-cinnabar-rgb) / 0.04);
  color: rgb(var(--color-cinnabar-rgb));
}

.mentor-choice__body {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.mentor-choice__top {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.18rem 0.45rem;
}

.mentor-choice__ordinal {
  color: rgb(var(--color-ink-faint-rgb));
  font-size: var(--type-note);
  letter-spacing: 0.08em;
  line-height: 1.5;
  white-space: nowrap;
}

.mentor-choice__name {
  color: rgb(var(--color-ink-rgb));
  font-size: var(--type-title);
  letter-spacing: 0.08em;
  line-height: 1.35;
}

.mentor-choice__hint {
  padding: 0 0.2rem;
  border: 1px solid rgb(var(--color-cinnabar-rgb) / 0.34);
  border-radius: 2px;
  color: rgb(var(--color-cinnabar-rgb));
  font-size: var(--type-note);
  letter-spacing: 0.06em;
  line-height: 1.5;
  white-space: nowrap;
}

.mentor-choice__title {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.1rem 0.48rem;
  margin-top: 0.08rem;
  color: rgb(var(--color-qing-rgb));
  font-size: var(--type-body);
  line-height: 1.55;
}

.mentor-choice__master {
  color: rgb(var(--color-ink-faint-rgb));
  font-size: var(--type-note);
  white-space: nowrap;
}

.mentor-choice__desc {
  margin-top: 0.1rem;
  color: rgb(var(--color-ink-faint-rgb));
  font-size: var(--type-note);
  line-height: 1.6;
  overflow-wrap: anywhere;
}

.mentor-choice__mods {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: baseline;
  gap: 0.28rem;
  margin-top: 0.26rem;
  padding-top: 0.24rem;
  border-top: 1px solid rgb(var(--color-ink-rgb) / 0.08);
}

.mentor-choice__mods-label {
  color: rgb(var(--color-qing-rgb));
  font-family: var(--font-kai);
  font-size: var(--type-note);
  letter-spacing: 0.08em;
  line-height: 1.55;
  white-space: nowrap;
}

.mentor-choice__mods-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.24rem;
}

.mentor-choice__mod {
  padding: 0 0.24rem;
  border: 1px solid rgb(var(--color-qing-rgb) / 0.24);
  border-radius: 2px;
  background: rgb(var(--color-qing-rgb) / 0.035);
  color: rgb(var(--color-ink-soft-rgb));
  font-size: var(--type-note);
  line-height: 1.55;
  white-space: nowrap;
}

.mentor-choice__action {
  display: grid;
  min-width: 1.65rem;
  height: 1.65rem;
  place-items: center;
  padding: 0 0.22rem;
  border: 1px solid rgb(var(--color-cinnabar-rgb) / 0.38);
  border-radius: 2px;
  color: rgb(var(--color-cinnabar-rgb));
  font-size: var(--type-note);
  line-height: 1;
}

.mentor-choice[aria-pressed="true"] .mentor-choice__action {
  background: rgb(var(--color-cinnabar-rgb) / 0.04);
}

.mentor-ledger__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.65rem;
}

.mentor-ledger__footer p {
  color: rgb(var(--color-ink-faint-rgb));
  font-size: var(--type-note);
  line-height: 1.55;
}

.mentor-oath {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.65rem;
}

.mentor-oath__copy {
  min-width: 0;
}

.mentor-oath__headline {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.18rem 0.36rem;
  color: rgb(var(--color-ink-rgb));
  font-family: var(--font-kai);
  font-size: var(--type-title);
  line-height: 1.45;
}

.mentor-oath__mark {
  width: 1.55rem;
  height: 1.55rem;
  font-size: var(--type-note);
}

.mentor-oath__headline strong {
  color: rgb(var(--color-cinnabar-rgb));
  font-weight: 600;
}

.mentor-oath__detail {
  margin-top: 0.1rem;
  color: rgb(var(--color-ink-soft-rgb));
  font-size: var(--type-note);
  line-height: 1.55;
}

.mentor-oath__warning {
  margin-top: 0.08rem;
  color: rgb(var(--color-ink-faint-rgb));
  font-size: var(--type-note);
  line-height: 1.55;
}

.mentor-oath__warning strong {
  font-weight: 600;
}

.mentor-oath__actions {
  display: flex;
  gap: 0.42rem;
}

.mentor-oath__actions button {
  white-space: nowrap;
}

.mentor-dossier__head {
  display: grid;
  grid-template-columns: 3rem minmax(0, 1fr);
  align-items: start;
  gap: 0.68rem;
}

.mentor-dossier__seal {
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

.mentor-dossier__identity {
  min-width: 0;
}

.mentor-dossier__title {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.15rem 0.58rem;
  margin-top: 0.08rem;
}

.mentor-dossier__line {
  color: rgb(var(--color-qing-rgb));
  font-size: var(--type-title);
}

.mentor-dossier__master {
  margin-top: 0.12rem;
  color: rgb(var(--color-ink-faint-rgb));
  font-size: var(--type-note);
  line-height: 1.55;
}

.mentor-dossier__quote {
  margin-top: 0.68rem;
  padding: 0.48rem 0.58rem;
  border-left: 2px solid rgb(var(--color-qing-rgb) / 0.46);
  background: var(--mentor-paper);
  color: rgb(var(--color-ink-soft-rgb));
  font-size: var(--type-body);
  line-height: 1.75;
}

.mentor-affinity {
  --affinity-tone: rgb(var(--color-ink-soft-rgb));
  margin-top: 0.68rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--mentor-line);
}

.mentor-affinity.is-qing {
  --affinity-tone: rgb(var(--color-qing-rgb));
}

.mentor-affinity.is-cinnabar {
  --affinity-tone: rgb(var(--color-cinnabar-rgb));
}

.mentor-affinity__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
}

.mentor-affinity__label {
  color: rgb(var(--color-ink-soft-rgb));
  font-size: var(--type-body);
}

.mentor-affinity__read {
  display: flex;
  align-items: baseline;
  gap: 0.38rem;
}

.mentor-affinity__value {
  color: var(--affinity-tone);
  font-family: var(--font-kai);
  font-size: var(--type-section);
  line-height: 1.2;
}

.mentor-affinity__band {
  color: var(--affinity-tone);
  font-size: var(--type-note);
}

.mentor-affinity__track {
  position: relative;
  height: 3px;
  margin-top: 0.35rem;
  background: rgb(var(--color-ink-rgb) / 0.1);
}

.mentor-affinity__center {
  position: absolute;
  top: -0.16rem;
  bottom: -0.16rem;
  left: 50%;
  width: 1px;
  background: var(--mentor-line-strong);
}

.mentor-affinity__marker {
  position: absolute;
  top: 50%;
  width: 0.46rem;
  height: 0.46rem;
  border: 1px solid rgb(var(--color-paper-rgb));
  background: var(--affinity-tone);
  transform: translate(-50%, -50%) rotate(45deg);
}

.mentor-affinity__axis {
  display: flex;
  justify-content: space-between;
  margin-top: 0.22rem;
  color: rgb(var(--color-ink-faint-rgb));
  font-size: var(--type-note);
  line-height: 1.5;
}

.mentor-affinity__note {
  margin-top: 0.18rem;
  color: rgb(var(--color-ink-faint-rgb));
  font-size: var(--type-note);
  line-height: 1.6;
}

/*
 * 行为轴 —— 上面那个契合度由什么行为构成。
 * 两行并列,「相亲」与「相左」各一句;相左那行用朱砂点一下,
 * 因为它是此前完全无声的那一半(加分项玩家迟早会撞对)。
 */
.mentor-axes {
  margin-top: 0.34rem;
  padding-top: 0.3rem;
  border-top: 1px solid var(--mentor-line);
}
.mentor-axes__row {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.1rem 0.44rem;
  padding: 0.14rem 0;
  font-size: var(--type-note);
  line-height: 1.5;
}
.mentor-axes__row dt {
  flex: none;
  color: var(--color-jade);
  font-family: var(--font-kai);
  letter-spacing: 0.06em;
}
.mentor-axes__row dd {
  min-width: 0;
  overflow-wrap: anywhere;
  color: rgb(var(--color-ink-soft-rgb));
}
.mentor-axes__row.is-against dt {
  color: rgb(var(--color-cinnabar-rgb));
}

.mentor-mods {
  margin-top: 0.62rem;
  padding-top: 0.46rem;
  border-top: 1px solid var(--mentor-line);
}

.mentor-mods__head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.15rem 0.5rem;
  color: rgb(var(--color-ink-soft-rgb));
  font-size: var(--type-body);
}

.mentor-mods__head span:last-child {
  color: rgb(var(--color-ink-faint-rgb));
  font-size: var(--type-note);
}

.mentor-mods__list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin-top: 0.32rem;
}

.mentor-dossier__oath {
  margin-top: 0.58rem;
  color: rgb(var(--color-ink-faint-rgb));
  font-size: var(--type-note);
  line-height: 1.6;
  text-align: right;
}

.mentor-dossier__oath strong {
  color: rgb(var(--color-cinnabar-rgb));
  font-weight: 600;
}

@media (max-width: 220px) {
  .mentor-oath__actions {
    flex-direction: column;
  }

  .mentor-oath__actions button {
    width: 100%;
  }

  .mentor-ledger__head,
  .mentor-oath {
    grid-template-columns: minmax(0, 1fr);
  }

  .mentor-ledger__stamp {
    justify-self: start;
  }

  .mentor-choice {
    grid-template-columns: 1.8rem minmax(0, 1fr);
    align-items: start;
    gap: 0.36rem 0.44rem;
    padding-inline: 0.48rem;
  }

  .mentor-choice__seal {
    width: 1.8rem;
    height: 1.8rem;
    grid-row: 1;
  }

  .mentor-choice__body {
    grid-column: 2;
  }

  .mentor-choice__master {
    white-space: normal;
  }

  .mentor-choice__mods {
    grid-template-columns: minmax(0, 1fr);
    gap: 0.12rem;
  }

  .mentor-choice__action {
    width: auto;
    height: auto;
    min-width: 2.2rem;
    grid-column: 2;
    justify-self: start;
    padding-inline: 0.34rem;
    line-height: 1.55;
  }

  .mentor-ledger__footer {
    align-items: stretch;
    flex-direction: column;
  }

  .mentor-ledger__footer button {
    width: 100%;
  }

  .mentor-dossier__head {
    grid-template-columns: 2.35rem minmax(0, 1fr);
    gap: 0.48rem;
  }

  .mentor-dossier__seal {
    width: 2.35rem;
    height: 2.35rem;
  }

  .mentor-affinity__head {
    align-items: flex-start;
    flex-direction: column;
    gap: 0.08rem;
  }
}
</style>
