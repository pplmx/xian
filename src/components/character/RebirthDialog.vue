<template>
  <!-- 兵解往生:先把此世门槛、能带走什么与会失去什么摊开,再进入三步往生。 -->
  <BaseModal :open="open" size="wide" title="兵解往生" @close="emit('close')">
    <article v-if="open" class="rebirth-folio stagger-in" data-rebirth-folio>
      <!--
        一世止步的那片天地 —— 与往生三程同一副长相、同一个身份。

        它们是同一件事的两段:这一帖说「此世收官」,三程说「辞世 / 回照 / 择生」;
        画的都是「这一世停在哪一界」(`worldOf(player.major)`)。若入口有画而正文没有,
        或两处画成两片天,读起来就是两份底稿。

        落法也照三程:定高的一条,排在卷首之前 —— 底下没有字,点景照画。
      -->
      <InkScene
        class="rebirth-scene"
        variant="strip"
        :world-id="player.world.id"
        aria-hidden="true"
      />

      <header class="rebirth-head">
        <span class="rebirth-head__seal font-kai" aria-hidden="true">轮</span>
        <div class="rebirth-head__identity">
          <p class="rebirth-head__eyebrow">
            第 {{ currentLife }} 世 · 此世收官
            <span v-if="signedTrial">· 逆旅契在身</span>
          </p>
          <h2 class="rebirth-head__title">
            {{ player.name }}
            <span>{{ player.realmName }}</span>
          </h2>
          <p class="rebirth-head__brief">
            行世
            {{ yearsShown(player.age) }}
            载。兵解不是清档:先回顾此生,再择来世的先天之姿与命题,三程走完才会落定。
          </p>
        </div>
        <p
          class="rebirth-head__gate"
          data-rebirth-gate
          :data-rebirth-gate-state="canRebirth ? 'open' : 'locked'"
        >
          {{ canRebirth ? `${gateRealm.name}门槛已过` : `尚差 ${gateGap} 境` }}
        </p>
      </header>

      <section class="rebirth-chapter rebirth-now" data-rebirth-now>
        <FolioChapterHead
          data-character-chapter-head
          index="壹"
          title="此刻要决定的事"
          hint="这不是一次普通确认。先把底账核对清楚,再进往生三程。"
          fact="尚未登账"
        />

        <p class="rebirth-now__contract">
          下一屏只作回顾;真正不可撤回的落子,是末程的「踏入轮回」。此前都还来得及回到这一页。
        </p>

        <div class="rebirth-balance" data-rebirth-summary>
          <p class="rebirth-balance__row is-keep">
            <span>随魂</span>
            <strong class="tabular">{{ keepCount }}</strong>
            <small>项留下</small>
          </p>
          <p class="rebirth-balance__row is-partial">
            <span>折损</span>
            <strong class="tabular">{{ partialCount }}</strong>
            <small>项只留一部分</small>
          </p>
          <p class="rebirth-balance__row is-reset">
            <span>归尘</span>
            <strong class="tabular">{{ resetCount }}</strong>
            <small>项随皮囊散去</small>
          </p>
        </div>
      </section>

      <section class="rebirth-chapter rebirth-heritage">
        <FolioChapterHead
          data-character-chapter-head
          index="贰"
          title="随魂所积"
          hint="道果与先天之姿跨世留下,来世仍可调用。"
          fact="随魂不灭"
        />

        <div class="rebirth-detail-grid">
          <section class="rebirth-panel rebirth-dao" data-rebirth-dao-fruit>
            <header class="rebirth-panel__head">
              <div>
                <p class="rebirth-panel__eyebrow">永久积累</p>
                <p class="rebirth-panel__title">道果</p>
              </div>
              <p class="rebirth-dao__total tabular">
                {{ formatNum(player.reincarnation.daoFruit) }}<small>枚</small>
              </p>
            </header>
            <dl class="rebirth-dao__rows">
              <div>
                <dt>当前有效收益</dt>
                <dd>{{ fruitInfo.effectiveText }} 枚</dd>
              </div>
              <div>
                <dt>修行加成</dt>
                <dd>{{ fruitInfo.cultBonusText }}</dd>
              </div>
              <div>
                <!--
                  `deltaPct` 是**有效道果的增长率**,不是修行加成的增幅 ——
                  它与上面那行「修行加成 +28.1%」是两个量纲,而原先两者上下并排、
                  都带 `+`、都以 `%` 收尾,读者几乎必然读成「修行加成再加 7.47%」。
                  实际上再加一枚后修行加成从 +28.1% 涨到约 +30.2%(28.1 × 1.0747)。

                  这是玩家决定要不要继续攒道果的那一格,而道果是跨世唯一的永久积累。
                  故把量纲写在数前面。
                -->
                <dt>再凝一枚</dt>
                <dd>
                  有效 {{ fruitInfo.nextEffectiveText }} 枚
                  <span class="tabular">· 道果 +{{ fruitInfo.deltaPct }}%</span>
                </dd>
              </div>
            </dl>
            <p class="rebirth-panel__note">
              每枚名义:修行 +{{ formatPercent(DAO_FRUIT_CULT_BONUS, 0) }},道躯 +{{
                formatPercent(DAO_FRUIT_COMBAT_BONUS, 0)
              }}。
            </p>
            <p class="rebirth-panel__note">{{ softCapText }}</p>
          </section>

          <section class="rebirth-panel rebirth-talents" data-rebirth-talents>
            <header class="rebirth-panel__head">
              <div>
                <p class="rebirth-panel__eyebrow">随魂不灭</p>
                <p class="rebirth-panel__title">先天之姿</p>
              </div>
              <p class="rebirth-talents__total tabular">
                {{ ownedTalents.length }}<small>项</small>
              </p>
            </header>
            <div v-if="ownedTalents.length" class="rebirth-talents__list">
              <button
                v-for="t in ownedTalents"
                :key="t.id"
                type="button"
                class="rebirth-talent"
                :style="{ color: TALENT_GRADE_COLORS[t.grade] }"
                :aria-expanded="talentTap === t.id"
                :aria-label="`${t.name}，${TALENT_GRADE_NAMES[t.grade]}，展开效果`"
                @click="talentTap = talentTap === t.id ? null : t.id"
              >
                <span class="rebirth-talent__name">{{ t.name }}</span>
                <span class="rebirth-talent__grade">{{ TALENT_GRADE_NAMES[t.grade] }}</span>
              </button>
            </div>
            <p v-else class="rebirth-panel__empty">转世之后,才会觉醒第一项先天之姿。</p>
            <div v-if="tappedTalent" class="rebirth-talent__detail" data-rebirth-talent-detail>
              <p>
                <span :style="{ color: TALENT_GRADE_COLORS[tappedTalent.grade] }">{{
                  tappedTalent.name
                }}</span>
                · {{ tappedTalent.desc }}
              </p>
              <p v-if="modsText(tappedTalent.mods)" class="is-qing">
                {{ modsText(tappedTalent.mods) }}
              </p>
            </div>
          </section>
        </div>
      </section>

      <section class="rebirth-chapter rebirth-ledger" data-rebirth-ledger>
        <FolioChapterHead
          data-character-chapter-head
          index="叁"
          title="此世交割"
          hint="条目直接取轮回结算的同一份继承表。先看影响最大的几笔,再展开全账。"
          :fact="`${totalCount} 项`"
        />

        <div class="rebirth-critical" data-rebirth-critical>
          <p class="rebirth-critical__caption">先看这些</p>
          <div class="rebirth-critical__grid">
            <p
              v-for="row in criticalRows"
              :key="row.id"
              class="rebirth-critical__row"
              :class="row.tone"
              :data-rebirth-critical-row="row.id"
            >
              <span class="rebirth-critical__mark font-kai" aria-hidden="true">{{ row.mark }}</span>
              <span class="rebirth-critical__name">{{ row.name }}</span>
              <span class="rebirth-critical__group">{{ row.groupTitle }}</span>
            </p>
          </div>
        </div>

        <button
          type="button"
          class="rebirth-ledger__toggle"
          data-rebirth-heritage-toggle
          :aria-expanded="heritageOpen"
          @click="heritageOpen = !heritageOpen"
        >
          <span>{{ heritageOpen ? "收起去留全账" : `展开去留全账(${totalCount} 项)` }}</span>
          <span aria-hidden="true">{{ heritageOpen ? "▾" : "▸" }}</span>
        </button>

        <div v-if="heritageOpen" class="scroll-fade rebirth-ledger__fold">
          <div class="scroll-pane max-h-64 overflow-y-auto rebirth-ledger__scroll">
            <section
              v-for="group in heritageLedger"
              :key="group.mode"
              class="rebirth-group"
              :class="group.tone"
              :data-rebirth-group="group.mode"
            >
              <header class="rebirth-group__head">
                <span class="rebirth-group__mark font-kai" aria-hidden="true">{{
                  group.mark
                }}</span>
                <p>{{ group.title }}</p>
                <span class="tabular">{{ group.count }} 项</span>
              </header>
              <div class="rebirth-group__rows">
                <button
                  v-for="row in group.rows"
                  :key="row.id"
                  type="button"
                  class="rebirth-ledger-row"
                  :data-rebirth-ledger-row="row.id"
                  :data-rebirth-ledger-mode="row.mode"
                  :aria-expanded="heritageTap === row.id"
                  :aria-label="`${row.name}，${group.title}，${heritageTap === row.id ? '收起说明' : '展开说明'}`"
                  @click="heritageTap = heritageTap === row.id ? null : row.id"
                >
                  <span class="rebirth-ledger-row__name">{{ row.name }}</span>
                  <span class="rebirth-ledger-row__state">{{ group.title }}</span>
                  <span class="rebirth-ledger-row__mark" aria-hidden="true">{{
                    heritageTap === row.id ? "−" : "+"
                  }}</span>
                  <span v-if="heritageTap === row.id" class="rebirth-ledger-row__detail">
                    {{ row.detail }}
                  </span>
                </button>
              </div>
            </section>
          </div>
        </div>
      </section>

      <section class="rebirth-chapter rebirth-last-call">
        <FolioChapterHead
          data-character-chapter-head
          index="肆"
          title="本世最后一笔"
          hint="可补立逆旅契；真正落子仍在往生末程。"
          :fact="signedTrial ? '已立契' : '可补契'"
        />

        <div class="rebirth-trial" data-rebirth-trial>
          <div class="rebirth-trial__head">
            <p class="rebirth-trial__title">逆旅契</p>
            <span v-if="signedTrial" class="rebirth-trial__seal font-kai" aria-hidden="true">{{
              signedTrial.seal
            }}</span>
            <button v-else type="button" class="rebirth-trial__open" @click="trialOpen = true">
              立一契
            </button>
          </div>
          <p v-if="signedTrial" class="rebirth-trial__copy">
            此生已立「{{ signedTrial.name }}」。{{ signedTrial.ruleText }}
          </p>
          <p v-else class="rebirth-trial__copy">
            仍可花道果押下一世逆境。契只留履历,不添属性;转世时随皮囊散去。
          </p>
        </div>

        <div class="rebirth-departure">
          <p class="rebirth-departure__mark font-kai" aria-hidden="true">诀</p>
          <div>
            <p class="rebirth-departure__title">此刻按下的,只是开卷</p>
            <p class="rebirth-departure__copy">
              先看清此生带得走什么、放得下什么：功法回一层,法宝归尘,余者随皮囊散去。往生三程里仍可停步,最后一步才会真正落定。
            </p>
          </div>
        </div>
      </section>
    </article>

    <template #footer>
      <div class="rebirth-actions">
        <p class="rebirth-actions__gate" :class="{ 'is-open': canRebirth }">
          <template v-if="canRebirth">
            {{ gateRealm.name }}门槛已过。下一步先回顾此生,不会立刻清空外物。
          </template>
          <template v-else> {{ gateRealm.name }}境方可自行兵解,尚差 {{ gateGap }} 境。 </template>
        </p>
        <button
          type="button"
          class="btn-seal rebirth-actions__button"
          data-rebirth-enter
          :disabled="!canRebirth"
          @click="rebirth"
        >
          <span>{{ canRebirth ? "兵解转世" : `尚差 ${gateGap} 境` }}</span>
          <small>{{
            canRebirth ? "先回顾此生,再定来世" : `${gateRealm.name}境方可自行兵解`
          }}</small>
        </button>
      </div>
    </template>
  </BaseModal>

  <!-- 逆旅契:一世一份,只加难度,不添属性;与往生帖同一宿主,免得立契入口失散。 -->
  <BaseModal :open="trialOpen" title="逆旅契" @close="trialOpen = false">
    <article class="rebirth-trial-folio" data-rebirth-trial-folio>
      <p class="rebirth-trial-folio__intro">
        道果本是历世所积,却一向只堆在身上。立一份契,把它押在这一世的逆境里——
        契不予你分毫气力,只把路走窄。走完了,它会留在你的履历上。
      </p>
      <div class="rebirth-trial-folio__list">
        <button
          v-for="t in LIFE_TRIALS"
          :key="t.id"
          type="button"
          class="rebirth-trial-choice active:scale-99"
          :data-rebirth-trial-choice="t.id"
          :disabled="!canSignLifeTrial(t.id)"
          @click="signTrial(t.id)"
        >
          <span class="rebirth-trial-choice__head">
            <span class="rebirth-trial-choice__name">
              <span class="font-kai" aria-hidden="true">{{ t.seal }}</span>
              {{ t.name }}
            </span>
            <span class="rebirth-trial-choice__cost tabular">{{ trialCostText(t) }}</span>
          </span>
          <span class="rebirth-trial-choice__desc">{{ t.desc }}</span>
          <span class="rebirth-trial-choice__rule">{{ t.ruleText }}</span>
        </button>
      </div>
      <p class="rebirth-trial-folio__foot">
        一世只可立一契,立下不可解。转世时契随皮囊散去,履历长存。
      </p>
    </article>
    <template #footer>
      <button type="button" class="btn-ghost w-full" @click="trialOpen = false">再想想</button>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { usePlayerStore } from "@/stores/player";
import { useUiStore } from "@/stores/ui";
import { LIFE_TRIALS } from "@/data/lifeTrials";
import { activeLifeTrial, canSignLifeTrial, signLifeTrial } from "@/core/lifeTrialService";
import { talentDef, TALENT_GRADE_COLORS, TALENT_GRADE_NAMES } from "@/data/talents";
import { REALMS } from "@/data/realms";
import { prepareReincarnation, MANUAL_REBIRTH_MIN_MAJOR } from "@/core/reincarnation";
import { heritageGroups } from "@/core/samsaraAudit";
import { DAO_FRUIT_COMBAT_BONUS, DAO_FRUIT_CULT_BONUS } from "@/data/constants";
import { fruitMarginalInfo, fruitSoftCapText } from "@/core/resourceGuidance";
import { formatNum, formatPercent, yearsShown } from "@/utils/format";
import { modsText } from "@/data/statNames";
import { criticalSamsaraRows, samsaraBalance, samsaraLedger } from "@/ui/reincarnationDesk";
import BaseModal from "@/components/common/BaseModal.vue";
import InkScene from "@/components/common/InkScene.vue";
import FolioChapterHead from "@/components/common/FolioChapterHead.vue";

/**
 * 兵解前的最后一张账。
 *
 * 这不是"确认清档"那么一句话:道果与天赋仍在累积,功法只折层数,而境界、装备、
 * 法宝、灵根等会随皮囊散去。页面按 core/samsaraAudit 的同一份继承表分组,
 * 不另抄第二份去留口径。
 */
const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const player = usePlayerStore();
const ui = useUiStore();

const currentLife = computed(() => player.reincarnation.count + 1);
const canRebirth = computed(() => player.major >= MANUAL_REBIRTH_MIN_MAJOR);
const gateGap = computed(() => Math.max(0, MANUAL_REBIRTH_MIN_MAJOR - player.major));
const gateRealm = computed(
  () => REALMS[MANUAL_REBIRTH_MIN_MAJOR] ?? { name: "金丹", short: "金丹" },
);

const heritageLedger = computed(() => samsaraLedger(heritageGroups()));
const heritageBalance = computed(() => samsaraBalance(heritageLedger.value));
const totalCount = computed(() => heritageBalance.value.total);
const keepCount = computed(() => heritageBalance.value.keep);
const partialCount = computed(() => heritageBalance.value.partial);
const resetCount = computed(() => heritageBalance.value.reset);
const criticalRows = computed(() => criticalSamsaraRows(heritageLedger.value));

/** 天赋展开:手机没有 hover,点一下就在帖内说明,关卷即复位。 */
const talentTap = ref<string | null>(null);
const ownedTalents = computed(() =>
  player.reincarnation.talents
    .map((id) => talentDef(id))
    .filter((t): t is NonNullable<ReturnType<typeof talentDef>> => t !== undefined),
);
const tappedTalent = computed(() => (talentTap.value ? talentDef(talentTap.value) : undefined));

/** 去留全账里点开的那一条;与天赋展开分开,免得两种说明抢同一行。 */
const heritageOpen = ref(false);
const heritageTap = ref<string | null>(null);

/** 逆旅契是本世最后一笔,仍在转世前可补签。 */
const signedTrial = computed(() => activeLifeTrial());
const trialOpen = ref(false);

watch(
  () => props.open,
  (open) => {
    if (!open) {
      talentTap.value = null;
      heritageOpen.value = false;
      heritageTap.value = null;
      trialOpen.value = false;
    }
  },
);

function trialCostText(t: (typeof LIFE_TRIALS)[number]): string {
  if (signedTrial.value) return "此生已签";
  return t.cost > player.reincarnation.daoFruit
    ? `尚差 ${t.cost - player.reincarnation.daoFruit} 道果`
    : `${t.cost} 道果`;
}

function signTrial(id: string): void {
  if (signLifeTrial(id)) trialOpen.value = false;
}

const fruitInfo = computed(() => fruitMarginalInfo());
const softCapText = computed(() => fruitSoftCapText(fruitInfo.value.total));

function rebirth(): void {
  if (!canRebirth.value) {
    ui.toast(`尚差 ${gateGap.value} 境 · ${gateRealm.value.name}境方可自行兵解`, "warn");
    return;
  }
  emit("close");
  prepareReincarnation();
}
</script>

<style scoped>
/*
 * 路签下面那条天地 —— 与往生三程同一条落法(理由见那一处的长注释):
 * 定高的一条,排在卷首之前。底下没有字,故点景照画 —— 四界之间的分别
 * (山岳 / 星野 / 宫阙 / 虚空)全靠它们读出来。
 *
 * 墨取 0.62,与三程同一档:两处是同一件事的两段,浓淡也该一致。
 */
.rebirth-scene {
  --ink-scene-h: 5.4rem;
  --ink-scene-ink: 0.62;
  margin-block: 0 0.6rem;
}

.rebirth-folio,
.rebirth-trial-folio {
  --rebirth-line: rgb(var(--color-ink-rgb) / 0.14);
  --rebirth-line-strong: rgb(var(--color-ink-rgb) / 0.22);
  min-width: 0;
}

.rebirth-folio {
  --character-accent: var(--color-cinnabar);
  --character-accent-rgb: var(--color-cinnabar-rgb);
  --folio-chapter-accent: var(--character-accent);
  --folio-chapter-accent-rgb: var(--character-accent-rgb);
  display: grid;
}

.rebirth-chapter {
  min-width: 0;
  margin-top: 0.82rem;
  border-top: 1px solid var(--rebirth-line);
  padding-top: 0.82rem;
}

.rebirth-head + .rebirth-chapter {
  margin-top: 0.72rem;
  border-top: 0;
  padding-top: 0;
}

.rebirth-chapter > .folio-chapter-head {
  margin-bottom: 0.56rem;
}

.rebirth-head {
  display: grid;
  grid-template-columns: 2.45rem minmax(0, 1fr) auto;
  align-items: start;
  gap: 0.6rem 0.72rem;
  border-bottom: 1px solid var(--rebirth-line);
  padding-bottom: 0.8rem;
}

.rebirth-head__seal {
  display: grid;
  width: 2.45rem;
  height: 2.45rem;
  place-items: center;
  border: 1px solid rgb(var(--color-cinnabar-rgb) / 0.44);
  border-radius: 2px;
  color: var(--color-cinnabar);
  font-size: var(--type-title);
  line-height: 1;
}

.rebirth-head__identity {
  min-width: 0;
}

.rebirth-head__eyebrow {
  color: var(--color-qing);
  font-size: var(--type-note);
  letter-spacing: 0.15em;
  line-height: 1.5;
}

.rebirth-head__title {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.2rem 0.62rem;
  margin-top: 0.12rem;
  color: var(--color-ink);
  font-family: var(--font-kai);
  font-size: var(--type-section);
  font-weight: 400;
  letter-spacing: 0.08em;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.rebirth-head__title span {
  color: var(--color-ink-soft);
  font-size: var(--type-body);
  letter-spacing: 0.1em;
}

.rebirth-head__brief {
  margin-top: 0.42rem;
  color: var(--color-ink-soft);
  font-size: var(--type-body);
  line-height: 1.65;
}

.rebirth-head__gate {
  align-self: start;
  border: 1px solid rgb(var(--color-qing-rgb) / 0.3);
  border-radius: 2px;
  background: rgb(var(--color-qing-rgb) / 0.04);
  padding: 0.2rem 0.42rem;
  color: var(--color-qing);
  font-size: var(--type-note);
  letter-spacing: 0.08em;
  line-height: 1.5;
  white-space: nowrap;
}

.rebirth-head__gate[data-rebirth-gate-state="locked"] {
  border-color: rgb(var(--color-amber-ink-rgb) / 0.34);
  background: rgb(var(--color-amber-ink-rgb) / 0.04);
  color: var(--color-amber-ink);
}

.rebirth-now__contract {
  margin-top: 0.16rem;
  border-left: 2px solid rgb(var(--color-cinnabar-rgb) / 0.6);
  padding-left: 0.55rem;
  color: var(--color-ink-soft);
  font-size: var(--type-body);
  line-height: 1.65;
}

.rebirth-balance {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0;
  margin-top: 0.58rem;
  border-block: 1px solid var(--rebirth-line);
}

.rebirth-balance__row {
  display: grid;
  min-width: 0;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: baseline;
  gap: 0.05rem 0.3rem;
  border-left: 1px dashed var(--rebirth-line);
  padding: 0.44rem 0.55rem;
}

.rebirth-balance__row span {
  color: var(--color-ink-soft);
  font-size: var(--type-note);
  letter-spacing: 0.1em;
}

.rebirth-balance__row strong {
  color: var(--color-ink);
  font-family: var(--font-kai);
  font-size: var(--type-title);
  font-weight: 400;
  line-height: 1;
}

.rebirth-balance__row small {
  grid-column: 1 / -1;
  color: var(--color-ink-faint);
  font-size: var(--type-note);
  line-height: 1.45;
}

.rebirth-balance__row.is-keep {
  border-left: 2px solid rgb(var(--color-jade-rgb) / 0.58);
}

.rebirth-balance__row.is-keep strong {
  color: var(--color-jade);
}

.rebirth-balance__row.is-partial {
  border-left: 2px solid rgb(var(--color-gold-ink-rgb) / 0.58);
}

.rebirth-balance__row.is-partial strong {
  color: var(--color-gold-ink);
}

.rebirth-balance__row.is-reset {
  border-left: 2px solid rgb(var(--color-ink-rgb) / 0.28);
}

.rebirth-balance__row.is-reset strong {
  color: var(--color-ink-faint);
}

.rebirth-detail-grid {
  display: grid;
  min-width: 0;
  grid-template-columns: minmax(0, 1fr);
  gap: 0;
}

.rebirth-panel {
  min-width: 0;
  padding: 0 0 0.68rem;
}

.rebirth-panel + .rebirth-panel {
  margin-top: 0.58rem;
  border-top: 1px solid var(--rebirth-line);
  padding-top: 0.58rem;
  padding-bottom: 0;
}

.rebirth-dao .rebirth-panel__title {
  color: var(--color-violet-ink);
}

.rebirth-talents .rebirth-panel__title {
  color: var(--color-gold-ink);
}

.rebirth-panel__head,
.rebirth-trial__head {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.65rem;
}

.rebirth-panel__eyebrow {
  color: var(--color-ink-faint);
  font-size: var(--type-note);
  letter-spacing: 0.14em;
  line-height: 1.45;
}

.rebirth-panel__title {
  margin-top: 0.08rem;
  color: var(--color-ink);
  font-family: var(--font-kai);
  font-size: var(--type-title);
  letter-spacing: 0.08em;
  line-height: 1.35;
}

.rebirth-dao__total,
.rebirth-talents__total {
  flex: none;
  color: var(--color-cinnabar);
  font-family: var(--font-kai);
  font-size: var(--type-title);
  line-height: 1;
}

.rebirth-talents__total {
  color: var(--color-gold-ink);
}

.rebirth-dao__total small,
.rebirth-talents__total small {
  margin-left: 0.16rem;
  color: var(--color-ink-faint);
  font-family: inherit;
  font-size: var(--type-note);
}

.rebirth-dao__rows {
  margin-top: 0.55rem;
  border-top: 1px solid var(--rebirth-line);
}

.rebirth-dao__rows > div {
  display: grid;
  grid-template-columns: minmax(0, 0.82fr) minmax(0, 1.18fr);
  gap: 0.55rem;
  border-bottom: 1px solid var(--rebirth-line);
  padding: 0.34rem 0;
}

.rebirth-dao__rows dt {
  color: var(--color-ink-faint);
  font-size: var(--type-note);
}

.rebirth-dao__rows dd {
  color: var(--color-ink-soft);
  font-size: var(--type-body);
  line-height: 1.5;
  text-align: right;
}

.rebirth-dao__rows dd span {
  color: var(--color-ink-faint);
}

.rebirth-panel__note,
.rebirth-panel__empty {
  margin-top: 0.46rem;
  color: var(--color-ink-faint);
  font-size: var(--type-note);
  line-height: 1.6;
}

.rebirth-panel__empty {
  border-top: 1px solid var(--rebirth-line);
  padding-top: 0.5rem;
}

.rebirth-talents__list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.28rem;
  margin-top: 0.55rem;
  border-top: 1px solid var(--rebirth-line);
  padding-top: 0.55rem;
}

.rebirth-talent {
  display: inline-flex;
  min-height: 1.8rem;
  align-items: baseline;
  gap: 0.28rem;
  border: 1px solid currentColor;
  border-radius: 2px;
  background: transparent;
  padding: 0.2rem 0.36rem;
  text-align: left;
}

.rebirth-talent__name {
  font-family: var(--font-kai);
  font-size: var(--type-body);
  line-height: 1.35;
}

.rebirth-talent__grade {
  color: var(--color-ink-faint);
  font-size: var(--type-note);
  line-height: 1.35;
}

.rebirth-talent__detail {
  margin-top: 0.5rem;
  border-left: 2px solid rgb(var(--color-gold-ink-rgb) / 0.52);
  padding-left: 0.5rem;
  color: var(--color-ink-faint);
  font-size: var(--type-note);
  line-height: 1.6;
}

.rebirth-talent__detail .is-qing {
  color: var(--color-qing);
}

.rebirth-critical {
  margin-top: 0;
  border-top: 1px solid var(--rebirth-line);
  padding-top: 0.5rem;
}

.rebirth-critical__caption {
  color: var(--color-ink-faint);
  font-size: var(--type-note);
  letter-spacing: 0.12em;
}

.rebirth-critical__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.24rem;
  margin-top: 0.32rem;
}

.rebirth-critical__row {
  display: grid;
  min-width: 0;
  grid-template-columns: 1.28rem minmax(0, 1fr) auto;
  align-items: baseline;
  gap: 0.35rem;
  border-bottom: 1px solid var(--rebirth-line);
  padding: 0.26rem 0;
}

.rebirth-critical__mark {
  display: grid;
  width: 1.28rem;
  height: 1.28rem;
  place-items: center;
  border: 1px solid currentColor;
  border-radius: 2px;
  font-size: var(--type-note);
  line-height: 1;
}

.rebirth-critical__name {
  min-width: 0;
  color: var(--color-ink-soft);
  font-size: var(--type-body);
  overflow-wrap: anywhere;
}

.rebirth-critical__group {
  color: var(--color-ink-faint);
  font-size: var(--type-note);
  line-height: 1.45;
  text-align: right;
}

.rebirth-critical__row.is-partial .rebirth-critical__mark {
  color: var(--color-gold-ink);
}

.rebirth-critical__row.is-reset .rebirth-critical__mark {
  color: var(--color-cinnabar);
}

.rebirth-ledger__toggle {
  display: flex;
  width: 100%;
  min-height: 2rem;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  margin-top: 0.52rem;
  border-block: 1px dashed var(--rebirth-line);
  padding: 0.42rem 0;
  color: var(--color-qing);
  font-size: var(--type-body);
  text-align: left;
}

.rebirth-ledger__toggle span:last-child {
  flex: none;
  color: var(--color-ink-faint);
  font-size: var(--type-note);
}

.rebirth-ledger__fold {
  margin-top: 0.4rem;
}

.rebirth-ledger__scroll {
  padding: 0.42rem 0;
}

.rebirth-group + .rebirth-group {
  margin-top: 0.58rem;
  border-top: 1px solid var(--rebirth-line);
  padding-top: 0.5rem;
}

.rebirth-group__head {
  display: grid;
  grid-template-columns: 1.2rem minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.3rem;
}

.rebirth-group__mark {
  display: grid;
  width: 1.2rem;
  height: 1.2rem;
  place-items: center;
  border: 1px solid currentColor;
  border-radius: 2px;
  font-size: var(--type-note);
  line-height: 1;
}

.rebirth-group__head p {
  color: var(--color-ink-soft);
  font-size: var(--type-note);
  letter-spacing: 0.08em;
}

.rebirth-group__head > span:last-child {
  color: var(--color-ink-faint);
  font-size: var(--type-note);
}

.rebirth-group.is-full .rebirth-group__mark {
  color: var(--color-jade);
}

.rebirth-group.is-partial .rebirth-group__mark {
  color: var(--color-gold-ink);
}

.rebirth-group.is-reset .rebirth-group__mark {
  color: var(--color-ink-faint);
}

.rebirth-group__rows {
  margin-top: 0.26rem;
}

.rebirth-ledger-row {
  display: grid;
  width: 100%;
  min-height: 1.8rem;
  grid-template-columns: minmax(0, 1fr) auto 1rem;
  gap: 0.28rem;
  align-items: baseline;
  border-bottom: 1px solid var(--rebirth-line);
  padding: 0.22rem 0.16rem;
  text-align: left;
}

.rebirth-ledger-row__name {
  min-width: 0;
  color: var(--color-ink-soft);
  font-size: var(--type-note);
  overflow-wrap: anywhere;
}

.rebirth-ledger-row__state {
  color: var(--color-ink-faint);
  font-size: var(--type-note);
  line-height: 1.4;
  text-align: right;
}

.rebirth-ledger-row__mark {
  color: var(--color-qing);
  font-size: var(--type-note);
  line-height: 1;
  text-align: right;
}

.rebirth-ledger-row__detail {
  grid-column: 1 / -1;
  margin-top: 0.18rem;
  border-left: 2px solid rgb(var(--color-qing-rgb) / 0.42);
  padding-left: 0.42rem;
  color: var(--color-ink-faint);
  font-size: var(--type-note);
  line-height: 1.6;
}

.rebirth-last-call {
  display: grid;
  min-width: 0;
  grid-template-columns: minmax(0, 1fr);
  gap: 0;
}

.rebirth-last-call > .folio-chapter-head {
  grid-column: 1 / -1;
}

.rebirth-trial {
  min-width: 0;
  padding: 0 0 0.58rem;
}

.rebirth-trial__title {
  color: var(--color-ink);
  font-family: var(--font-kai);
  font-size: var(--type-title);
  letter-spacing: 0.08em;
  line-height: 1.35;
}

.rebirth-trial__seal {
  display: grid;
  width: 2rem;
  height: 2rem;
  place-items: center;
  border: 1px solid rgb(var(--color-cinnabar-rgb) / 0.38);
  border-radius: 2px;
  color: var(--color-cinnabar);
  font-size: var(--type-title);
  line-height: 1;
}

.rebirth-trial__open {
  min-height: 1.8rem;
  flex: none;
  border-bottom: 1px solid currentColor;
  color: var(--color-gold-ink);
  font-size: var(--type-body);
}

.rebirth-trial__copy {
  margin-top: 0.42rem;
  color: var(--color-ink-faint);
  font-size: var(--type-note);
  line-height: 1.65;
}

.rebirth-departure {
  display: grid;
  min-width: 0;
  grid-template-columns: 2rem minmax(0, 1fr);
  align-items: start;
  gap: 0.55rem;
  border-top: 1px solid var(--rebirth-line);
  padding: 0.58rem 0 0;
}

.rebirth-departure__mark {
  display: grid;
  width: 2rem;
  height: 2rem;
  place-items: center;
  border: 1px solid rgb(var(--color-ink-rgb) / 0.2);
  border-radius: 2px;
  color: var(--color-ink-soft);
  font-size: var(--type-title);
  line-height: 1;
}

.rebirth-departure__title {
  color: var(--color-ink);
  font-family: var(--font-kai);
  font-size: var(--type-body);
  letter-spacing: 0.06em;
  line-height: 1.45;
}

.rebirth-departure__copy {
  margin-top: 0.14rem;
  color: var(--color-ink-faint);
  font-size: var(--type-note);
  line-height: 1.65;
}

.rebirth-actions {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(11rem, auto);
  align-items: stretch;
  gap: 0.5rem;
}

.rebirth-actions__gate {
  align-self: center;
  color: var(--color-amber-ink);
  font-size: var(--type-note);
  line-height: 1.55;
}

.rebirth-actions__gate.is-open {
  color: var(--color-ink-faint);
}

.rebirth-actions__button {
  display: grid;
  min-height: 2.75rem;
  align-content: center;
  gap: 0.08rem;
  padding: 0.38rem 0.7rem;
}

.rebirth-actions__button span {
  font-family: var(--font-kai);
  font-size: var(--type-body);
  letter-spacing: 0.12em;
}

.rebirth-actions__button small {
  color: inherit;
  font-size: var(--type-note);
  letter-spacing: 0.04em;
  line-height: 1.4;
}

.rebirth-trial-folio {
  min-width: 0;
}

.rebirth-trial-folio__intro {
  color: var(--color-ink-soft);
  font-size: var(--type-body);
  line-height: 1.7;
}

.rebirth-trial-folio__list {
  display: grid;
  gap: 0.35rem;
  margin-top: 0.72rem;
}

.rebirth-trial-choice {
  display: grid;
  width: 100%;
  min-height: 2.8rem;
  gap: 0.18rem;
  border: 0;
  border-bottom: 1px solid var(--rebirth-line);
  border-left: 2px solid rgb(var(--color-gold-ink-rgb) / 0.54);
  padding: 0.48rem 0 0.48rem 0.56rem;
  text-align: left;
}

.rebirth-trial-choice:disabled {
  border-left-color: var(--rebirth-line-strong);
  background: rgb(var(--color-ink-rgb) / 0.025);
}

.rebirth-trial-choice__head {
  display: flex;
  min-width: 0;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
}

.rebirth-trial-choice__name {
  min-width: 0;
  color: var(--color-ink);
  font-size: var(--type-body);
  overflow-wrap: anywhere;
}

.rebirth-trial-choice__cost {
  flex: none;
  color: var(--color-cinnabar);
  font-size: var(--type-note);
  line-height: 1.45;
}

.rebirth-trial-choice:disabled .rebirth-trial-choice__cost {
  color: var(--color-ink-faint);
}

.rebirth-trial-choice__desc,
.rebirth-trial-choice__rule {
  color: var(--color-ink-soft);
  font-size: var(--type-note);
  line-height: 1.55;
}

.rebirth-trial-choice__rule {
  color: var(--color-ink-faint);
}

.rebirth-trial-folio__foot {
  margin-top: 0.65rem;
  border-top: 1px solid var(--rebirth-line);
  padding-top: 0.5rem;
  color: var(--color-ink-faint);
  font-size: var(--type-note);
  line-height: 1.6;
}

@media (min-width: 620px) {
  .rebirth-detail-grid {
    grid-template-columns: minmax(0, 1.06fr) minmax(0, 0.94fr);
  }

  .rebirth-panel {
    padding: 0 0.78rem 0 0;
  }

  .rebirth-panel + .rebirth-panel {
    margin-top: 0;
    border-top: 0;
    border-left: 1px solid var(--rebirth-line);
    padding: 0 0 0 0.78rem;
  }

  .rebirth-critical__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: 0.8rem;
  }

  .rebirth-last-call {
    grid-template-columns: minmax(0, 0.82fr) minmax(0, 1.18fr);
  }

  .rebirth-trial {
    padding: 0 0.78rem 0 0;
  }

  .rebirth-departure {
    border-top: 0;
    border-left: 1px solid var(--rebirth-line);
    padding: 0 0 0 0.78rem;
  }
}

@media (max-width: 260px) {
  .rebirth-head {
    grid-template-columns: 2.1rem minmax(0, 1fr);
  }

  .rebirth-head__seal {
    width: 2.1rem;
    height: 2.1rem;
  }

  .rebirth-head__gate {
    grid-column: 2;
    justify-self: start;
    white-space: normal;
  }

  .rebirth-balance {
    grid-template-columns: minmax(0, 1fr);
  }

  .rebirth-balance__row {
    padding-inline: 0;
  }

  .rebirth-balance__row + .rebirth-balance__row {
    border-top: 1px dashed var(--rebirth-line);
  }

  .rebirth-critical__row {
    grid-template-columns: 1.28rem minmax(0, 1fr);
  }

  .rebirth-critical__group {
    grid-column: 2;
    text-align: left;
  }

  .rebirth-ledger-row {
    grid-template-columns: minmax(0, 1fr) 1rem;
  }

  .rebirth-ledger-row__state {
    grid-column: 1;
    text-align: left;
  }

  .rebirth-ledger-row__mark {
    grid-column: 2;
    grid-row: 1;
  }

  .rebirth-ledger-row__detail {
    grid-column: 1 / -1;
  }

  .rebirth-actions {
    grid-template-columns: minmax(0, 1fr);
  }

  .rebirth-actions__button {
    width: 100%;
  }
}
</style>
