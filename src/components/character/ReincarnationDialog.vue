<template>
  <!-- 第一程:寿终辞世。此处只开卷,不改存档。 -->
  <BaseModal :open="ui.deathDialog && !view" size="wide" title="往生 · 辞世" :closable="false">
    <article
      class="reincarnation-folio reincarnation-folio--death stagger-in"
      data-reincarnation-stage="death"
    >
      <ReincarnationStageRail :step="1" />

      <header class="reincarnation-head">
        <span class="reincarnation-head__seal font-kai" aria-hidden="true">终</span>
        <div class="reincarnation-head__identity">
          <p class="reincarnation-head__eyebrow">第 {{ currentLife }} 世 · 寿数已尽</p>
          <h2 class="reincarnation-head__title">{{ player.name }}</h2>
          <p class="reincarnation-head__brief">
            行世 {{ yearsShown(player.age) }} 载，止步于{{
              player.realmName
            }}。皮囊坐化，神魂仍可再启一程。
          </p>
        </div>
        <p class="reincarnation-score tabular">
          <span>道果</span>
          <strong>{{ formatNum(player.reincarnation.daoFruit) }}</strong>
          <small>枚</small>
        </p>
      </header>

      <section class="reincarnation-chapter" data-reincarnation-chapter="death">
        <FolioChapterHead
          data-character-chapter-head
          index="壹"
          title="此生止步"
          hint="先核对此生终点与能带走什么，再进下一程。"
          fact="尚未落账"
        />

        <div class="reincarnation-callout" data-reincarnation-death-summary>
          <span class="reincarnation-callout__mark font-kai" aria-hidden="true">别</span>
          <div>
            <p class="reincarnation-callout__title">这不是清档，是开卷</p>
            <p class="reincarnation-callout__copy">
              下一屏只作回照，核对此生带得走什么、放得下什么；尚未写入轮回。真正不可撤回的落子，是三程末的「踏入轮回」。
            </p>
          </div>
        </div>

        <dl class="reincarnation-death-grid">
          <div>
            <dt>今生</dt>
            <dd>第 {{ currentLife }} 世</dd>
          </div>
          <div>
            <dt>止步</dt>
            <dd>{{ player.realmName }}</dd>
          </div>
          <div>
            <dt>随身先天之姿</dt>
            <dd>{{ ownedTalents.length }} 项</dd>
          </div>
        </dl>

        <p class="reincarnation-footnote">
          功法只折层数，道果、天赋与所知随神魂留下；境界、灵根、法宝与外物随皮囊散去。
        </p>
      </section>
    </article>

    <template #footer>
      <div class="reincarnation-actions">
        <p class="reincarnation-actions__gate" data-reincarnation-death-gate>
          <strong>下一屏只作回照</strong>
          <span>尚未登账，也还没有换掉这一世。</span>
        </p>
        <button
          type="button"
          class="btn-seal reincarnation-actions__button"
          data-reincarnation-begin
          @click="beginRebirth"
        >
          <span>兵解转世</span>
          <small>进入第二程 · 回照</small>
        </button>
      </div>
    </template>
  </BaseModal>

  <!-- 第二程:回顾此生与去留全账。此处仍只读。 -->
  <BaseModal
    :open="view !== null && step === 'review'"
    size="wide"
    title="往生 · 回照"
    :closable="false"
  >
    <article
      v-if="view"
      class="reincarnation-folio stagger-in"
      data-reincarnation-stage="review"
      data-reincarnation-review
    >
      <ReincarnationStageRail :step="2" />

      <header class="reincarnation-head">
        <span class="reincarnation-head__seal font-kai" aria-hidden="true">照</span>
        <div class="reincarnation-head__identity">
          <p class="reincarnation-head__eyebrow">第二程 · 回照 · 第 {{ view.review.index }} 世</p>
          <h2 class="reincarnation-head__title">
            {{ view.review.realmLabel }}
            <span>{{ view.review.age }} 载</span>
          </h2>
          <p class="reincarnation-head__brief">
            先把此生的题、宿慧与交割账摊开。此程只读，不改动任何存档。
          </p>
        </div>
        <p class="reincarnation-score tabular">
          <span>宿慧</span>
          <strong>+{{ formatNum(view.review.insightGained) }}</strong>
          <small>此生</small>
        </p>
      </header>

      <div class="reincarnation-review__grid">
        <section class="reincarnation-chapter" data-reincarnation-theme>
          <FolioChapterHead
            data-character-chapter-head
            index="壹"
            :title="reviewTheme ? `「${reviewTheme.vow}」` : '此世未立命题'"
            hint="此生命题只判这一世，未竟或破戒都不倒扣。"
            :fact="reviewTheme ? RESULT_NAMES[view.review.themeResult ?? 'unfinished'] : '未立题'"
          />

          <template v-if="reviewTheme">
            <p class="reincarnation-copy">{{ reviewTheme.goal }}</p>
            <p v-if="view.review.themeResult === 'unfinished'" class="reincarnation-read tabular">
              {{ Math.floor(view.review.themeCur) }} / {{ view.review.themeNeed }} · 未竟不给宿慧
            </p>
            <p v-else-if="view.review.themeResult === 'done'" class="reincarnation-read is-gold">
              {{ reviewTheme.legacy }}
            </p>
            <p v-else class="reincarnation-read is-amber">
              此生破了「{{ TABOO_NAMES[reviewTheme.taboo ?? "pill"] }}」之戒，题的所得没有兑现。
            </p>
          </template>
          <p v-else class="reincarnation-copy">
            这一世没有立题，便没有命题宿慧；阅历所得仍会计入下一阶。
          </p>
        </section>

        <section class="reincarnation-chapter" data-reincarnation-insight>
          <FolioChapterHead
            data-character-chapter-head
            index="贰"
            title="随魂所积"
            hint="阅历与所知随神魂留下，下一阶仍从这份底账续起。"
            :fact="view.stageAdvanced ? '境地已迁' : view.stageName"
          />
          <p class="reincarnation-copy">{{ view.stageDesc }}</p>
          <dl class="reincarnation-insight-rows">
            <div>
              <dt>此生入账</dt>
              <dd class="tabular">+{{ formatNum(view.review.insightGained) }} 宿慧</dd>
            </div>
            <div>
              <dt>回照后共有</dt>
              <dd class="tabular">{{ formatNum(view.insightAfter) }} 宿慧</dd>
            </div>
            <div>
              <dt>下一阶</dt>
              <dd class="tabular">
                {{
                  view.toNextStage !== null
                    ? `尚差 ${formatNum(view.toNextStage)} 宿慧`
                    : "已至此阶尽头"
                }}
              </dd>
            </div>
          </dl>
        </section>
      </div>

      <section class="reincarnation-chapter reincarnation-ledger" data-reincarnation-ledger>
        <FolioChapterHead
          data-character-chapter-head
          index="叁"
          title="此世交割"
          hint="条目直接取轮回结算的同一份继承表；先看影响最大的几笔，再展开全账。"
          :fact="`${balance.total} 项`"
        />

        <div class="reincarnation-balance" data-reincarnation-balance>
          <p class="reincarnation-balance__row is-full">
            <span>随魂</span>
            <strong class="tabular">{{ balance.full }}</strong>
            <small>项完整留下</small>
          </p>
          <p class="reincarnation-balance__row is-partial">
            <span>折损</span>
            <strong class="tabular">{{ balance.partial }}</strong>
            <small>项只留一部分</small>
          </p>
          <p class="reincarnation-balance__row is-reset">
            <span>归尘</span>
            <strong class="tabular">{{ balance.reset }}</strong>
            <small>项随皮囊散去</small>
          </p>
        </div>

        <p class="reincarnation-ledger__caption">先看这些</p>
        <div class="reincarnation-critical">
          <p
            v-for="row in criticalRows"
            :key="row.id"
            class="reincarnation-critical__row"
            :class="row.tone"
            :data-reincarnation-critical-row="row.id"
          >
            <span class="reincarnation-critical__mark font-kai" aria-hidden="true">{{
              row.mark
            }}</span>
            <span class="reincarnation-critical__name">{{ row.name }}</span>
            <span class="reincarnation-critical__group">{{ row.groupTitle }}</span>
          </p>
        </div>

        <p v-if="view.gongfaKeep.total > 0" class="reincarnation-keep" data-gongfa-keep>
          <span class="reincarnation-keep__mark font-kai" aria-hidden="true">功</span>
          <span>
            功法 {{ view.gongfaKeep.total }} 部记得住，层数回到一层<template
              v-if="view.gongfaKeep.keepAll"
              >；大乘道统在身，已练的层数原样带走</template
            ><template v-else-if="view.gongfaKeep.keepOneId"
              >；唯有「{{ gongfaName(view.gongfaKeep.keepOneId) }}」保留
              {{ view.gongfaKeep.keepOneLevel }} 层</template
            >。
          </span>
        </p>

        <button
          type="button"
          class="reincarnation-ledger__toggle"
          data-reincarnation-heritage-toggle
          :aria-expanded="heritageOpen"
          @click="heritageOpen = !heritageOpen"
        >
          <span>{{ heritageOpen ? "收起去留全账" : `展开去留全账（${balance.total} 项）` }}</span>
          <span aria-hidden="true">{{ heritageOpen ? "▾" : "▸" }}</span>
        </button>

        <div v-if="heritageOpen" class="scroll-fade reincarnation-ledger__fold">
          <div class="scroll-pane max-h-64 overflow-y-auto reincarnation-ledger__scroll">
            <section
              v-for="group in ledger"
              :key="group.mode"
              class="reincarnation-ledger-group"
              :class="group.tone"
              :data-reincarnation-heritage-group="group.mode"
            >
              <header class="reincarnation-ledger-group__head">
                <span class="reincarnation-ledger-group__mark font-kai" aria-hidden="true">{{
                  group.mark
                }}</span>
                <p>{{ group.title }}</p>
                <span class="tabular">{{ group.count }} 项</span>
              </header>
              <div class="reincarnation-ledger-group__rows">
                <button
                  v-for="r in group.rows"
                  :key="r.id"
                  type="button"
                  class="reincarnation-ledger-row"
                  :data-reincarnation-heritage-row="r.id"
                  :aria-expanded="heritageTap === r.id"
                  :aria-label="`${r.name}，${group.title}，${heritageTap === r.id ? '收起说明' : '展开说明'}`"
                  @click="heritageTap = heritageTap === r.id ? null : r.id"
                >
                  <span class="reincarnation-ledger-row__name">{{ r.name }}</span>
                  <span class="reincarnation-ledger-row__state">{{ group.title }}</span>
                  <span class="reincarnation-ledger-row__mark" aria-hidden="true">{{
                    heritageTap === r.id ? "−" : "+"
                  }}</span>
                  <span v-if="heritageTap === r.id" class="reincarnation-ledger-row__detail">
                    {{ r.detail }}
                  </span>
                </button>
              </div>
            </section>
          </div>
        </div>
      </section>

      <p class="reincarnation-footnote">
        丹方、药性、铭纹、器谱与敌手路数都不随皮囊腐朽；来世睁眼即认得
        <span class="tabular">{{ view.knownMaterials }}</span> 味灵材。
      </p>
    </article>

    <template #footer>
      <div class="reincarnation-actions">
        <p class="reincarnation-actions__gate" data-reincarnation-review-gate>
          <strong>回照不落账</strong>
          <span>下一程才择道号、灵根与先天之姿。</span>
        </p>
        <button
          type="button"
          class="btn-seal reincarnation-actions__button"
          data-reincarnation-review-next
          @click="step = 'choice'"
        >
          <span>往生 · 择生</span>
          <small>进入第三程 · 尚未落子</small>
        </button>
      </div>
    </template>
  </BaseModal>

  <!-- 第三程:择来世底账。按下「踏入轮回」才真正不可撤回。 -->
  <BaseModal
    :open="view !== null && step === 'choice'"
    size="wide"
    title="往生 · 择生"
    :closable="false"
  >
    <article
      v-if="view"
      class="reincarnation-folio stagger-in"
      data-reincarnation-stage="choice"
      data-reincarnation-choice
    >
      <ReincarnationStageRail :step="3" />

      <header class="reincarnation-head">
        <span class="reincarnation-head__seal font-kai" aria-hidden="true">生</span>
        <div class="reincarnation-head__identity">
          <p class="reincarnation-head__eyebrow">第三程 · 择生 · 落子前</p>
          <h2 class="reincarnation-head__title">为第 {{ view.review.index + 1 }} 世定底</h2>
          <p class="reincarnation-head__brief">
            道号与灵根所见即所得；先天之姿只取其一，命题可不立。此页仍可反复改选。
          </p>
        </div>
        <p class="reincarnation-score tabular">
          <span>道果</span>
          <strong>+{{ formatNum(view.daoFruitGained) }}</strong>
          <small>今生</small>
        </p>
      </header>

      <section class="reincarnation-chapter" data-reincarnation-chapter="choice-roots">
        <FolioChapterHead
          data-character-chapter-head
          index="壹"
          title="来世根骨"
          hint="灵根所见即所得；道果只入永世底账，不再回到本世皮囊。"
          :fact="`修行 ×${view.nextLinggen.growthMult}`"
        />

        <div class="reincarnation-choice__grid">
          <section
            class="reincarnation-read-panel reincarnation-destiny"
            data-reincarnation-destiny
          >
            <header class="reincarnation-read-head">
              <span>来世灵根</span>
              <strong>{{ view.nextLinggen.gradeName }}</strong>
            </header>
            <div class="reincarnation-roots" aria-label="来世灵根资质">
              <span
                v-for="root in view.nextLinggen.roots"
                :key="root.element"
                class="reincarnation-root"
              >
                <strong class="font-kai">{{ ELEMENTS[root.element].name }}</strong>
                <span class="tabular">{{ root.aptitude }}</span>
              </span>
            </div>
          </section>

          <section class="reincarnation-read-panel" data-reincarnation-dao-fruit>
            <header class="reincarnation-read-head">
              <span>道果落账</span>
              <strong class="tabular">+{{ formatNum(view.daoFruitGained) }} 枚</strong>
            </header>
            <dl class="reincarnation-insight-rows">
              <div>
                <dt>今生凝得</dt>
                <dd class="tabular">{{ formatNum(view.daoFruitGained) }} 枚</dd>
              </div>
              <div>
                <dt>落账后共有</dt>
                <dd class="tabular">{{ formatNum(nextFruitTotal) }} 枚</dd>
              </div>
              <div>
                <dt>跨世用途</dt>
                <dd>修行与道躯的永久底账</dd>
              </div>
            </dl>
          </section>
        </div>
      </section>

      <section class="reincarnation-chapter reincarnation-name" data-reincarnation-name>
        <FolioChapterHead
          data-character-chapter-head
          index="贰"
          title="新一世的道号"
          hint="道号随这一副皮囊可重拟，最多八字；留白不填，便沿用旧号。"
          fact="可留白"
        />
        <div class="reincarnation-name__row">
          <input
            v-model="nameDraft"
            maxlength="8"
            aria-label="新一世的道号"
            class="reincarnation-name__input text-[16px]"
            :placeholder="view.nameDraft"
          />
          <button
            type="button"
            class="btn-ghost reincarnation-name__reroll"
            data-reincarnation-name-reroll
            aria-label="随机取一个道号"
            @click="reRollName"
          >
            <GameIcon name="refresh" :size="15" />
            <span>另掷一号</span>
          </button>
        </div>
      </section>

      <section class="reincarnation-chapter reincarnation-talent-section">
        <FolioChapterHead
          data-character-chapter-head
          index="叁"
          title="择一先天之姿"
          hint="只取其一，余者本世无缘；具体数字与效果先摊在这里，不靠猜名字。"
          :fact="view.talentChoices.length ? (chosen ? '已择定' : '待择') : '池已尽'"
        />
        <p v-if="view.talentChoices.length === 0" class="reincarnation-empty">
          先天之姿已尽数为你所有，此番再无可择，可直取轮回。
        </p>
        <div v-else class="reincarnation-talent-grid">
          <button
            v-for="id in view.talentChoices"
            :key="id"
            type="button"
            class="reincarnation-talent-choice"
            :class="{ 'is-chosen': chosen === id }"
            :aria-pressed="chosen === id"
            :data-reincarnation-talent-choice="id"
            @click="chosen = id"
          >
            <span class="reincarnation-talent-choice__head">
              <span
                class="reincarnation-talent-choice__name font-kai"
                :style="{ color: TALENT_GRADE_COLORS[talentDef(id)?.grade ?? 1] }"
              >
                {{ talentDef(id)?.name ?? id }}
              </span>
              <span class="reincarnation-talent-choice__grade">
                {{ TALENT_GRADE_NAMES[talentDef(id)?.grade ?? 1] }}
              </span>
              <span class="reincarnation-talent-choice__mark" aria-hidden="true">{{
                chosen === id ? "已" : "择"
              }}</span>
            </span>
            <span class="reincarnation-talent-choice__desc">{{ talentDef(id)?.desc }}</span>
            <span
              v-if="modsText(talentDef(id)?.mods ?? {})"
              class="reincarnation-talent-choice__mods"
            >
              {{ modsText(talentDef(id)?.mods ?? {}) }}
            </span>
          </button>
        </div>
        <p v-if="view.extraTalents.length" class="reincarnation-extra">
          <span>另有先天之姿自开</span>
          <strong v-for="id in view.extraTalents" :key="id">
            {{ talentDef(id)?.name ?? id }}
          </strong>
        </p>
      </section>

      <section class="reincarnation-chapter reincarnation-theme-section">
        <FolioChapterHead
          data-character-chapter-head
          index="肆"
          title="这一世要做什么"
          hint="立题不给属性；走到底才得一份宿慧与来路。破戒或未竟都不会倒扣。"
          :fact="theme ? '已择题' : '可不立'"
        />
        <p v-if="view.themeFree" class="reincarnation-theme-free">
          百世老修，此阶可在已开命题中任取一题。
        </p>
        <div v-if="themeDefs.length" class="reincarnation-theme-list">
          <button
            v-for="t in themeDefs"
            :key="t.id"
            type="button"
            class="reincarnation-theme-choice"
            :class="{ 'is-chosen': theme === t.id }"
            :aria-pressed="theme === t.id"
            :data-reincarnation-theme-choice="t.id"
            @click="theme = theme === t.id ? null : t.id"
          >
            <span class="reincarnation-theme-choice__head">
              <span class="reincarnation-theme-choice__name font-kai">{{ t.name }}</span>
              <span class="reincarnation-theme-choice__gain tabular"
                >做到 +{{ t.insight }} 宿慧</span
              >
            </span>
            <span class="reincarnation-theme-choice__vow">{{ t.vow }}</span>
            <span class="reincarnation-theme-choice__goal">{{ t.goal }}</span>
            <span v-if="t.taboo" class="reincarnation-theme-choice__taboo">
              忌：{{ TABOO_NAMES[t.taboo] }} —— 一世守之，破之题废，无所得
            </span>
          </button>
        </div>
        <p v-else class="reincarnation-empty">此阶没有可立命题，不立题并不影响转世。</p>
        <p class="reincarnation-theme-skip">不选亦可 —— 无题的一世，只是少一份命题宿慧。</p>
      </section>

      <section
        v-if="view.heritageGained && heritageDef(view.heritageGained)"
        class="reincarnation-chapter reincarnation-heritage-gained"
        data-reincarnation-heritage-gained
      >
        <FolioChapterHead
          data-character-chapter-head
          index="伍"
          title="道统传承"
          hint="深修所悟随神魂不灭，来世仍能沿用这份道统。"
          :fact="heritageDef(view.heritageGained)!.name"
        />
        <p class="reincarnation-copy">{{ heritageDef(view.heritageGained)!.desc }}</p>
        <p class="reincarnation-heritage-gained__effect">
          效果：{{ heritageDef(view.heritageGained)!.effectDesc }}
        </p>
      </section>

      <section class="reincarnation-chapter reincarnation-final" data-reincarnation-final-warning>
        <FolioChapterHead
          data-character-chapter-head
          index="末"
          title="落印之前"
          hint="落印即刻归档此生：灵根、境界与天地换新；资源、装备、法宝与外物随皮囊散去。"
          fact="尚未落定"
        />
        <p class="reincarnation-final__copy">
          按下「踏入轮回」后，此前所有点选才真正落定；这已是最后一程。
        </p>
      </section>
    </article>

    <template #footer>
      <div class="reincarnation-actions">
        <p
          class="reincarnation-actions__gate"
          data-reincarnation-confirm-gate
          :data-reincarnation-confirm-state="confirmGate.state"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <strong>{{ confirmGate.short }}</strong>
          <span>{{ confirmGate.detail }}</span>
        </p>
        <button
          type="button"
          class="btn-seal reincarnation-actions__button"
          data-reincarnation-confirm
          :disabled="confirmGate.disabled"
          @click="confirm"
        >
          <span>踏入轮回</span>
          <small>{{ confirmGate.short }}</small>
        </button>
      </div>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useUiStore } from "@/stores/ui";
import { usePlayerStore } from "@/stores/player";
import {
  prepareReincarnation,
  confirmReincarnation,
  rollReincarnateName,
} from "@/core/reincarnation";
import { talentDef, TALENT_GRADE_COLORS, TALENT_GRADE_NAMES } from "@/data/talents";
import { modsText } from "@/data/statNames";
import { heritageDef } from "@/data/heritage";
import { gongfaDef } from "@/data/gongfa";
import { lifeThemeDef, TABOO_NAMES } from "@/data/lifeThemes";
import { ELEMENTS } from "@/data/linggen";
import { heritageGroups } from "@/core/samsaraAudit";
import {
  criticalSamsaraRows,
  reincarnationConfirmGate,
  samsaraBalance,
  samsaraLedger,
} from "@/ui/reincarnationDesk";
import { engine } from "@/core/engine";
import { formatNum, yearsShown } from "@/utils/format";
import BaseModal from "@/components/common/BaseModal.vue";
import GameIcon from "@/components/common/GameIcon.vue";
import FolioChapterHead from "@/components/common/FolioChapterHead.vue";
import ReincarnationStageRail from "@/components/character/ReincarnationStageRail.vue";

const ui = useUiStore();
const player = usePlayerStore();
const router = useRouter();

const RESULT_NAMES: Record<"done" | "unfinished" | "broken", string> = {
  done: "践行到底",
  unfinished: "未竟",
  broken: "已破",
};

const chosen = ref<string | null>(null);
const theme = ref<string | null>(null);
const nameDraft = ref("");
const step = ref<"review" | "choice">("review");
const heritageOpen = ref(false);
const heritageTap = ref<string | null>(null);

const view = computed(() => ui.reincarnation);
const currentLife = computed(() => player.reincarnation.count + 1);
const ownedTalents = computed(() =>
  player.reincarnation.talents
    .map((id) => talentDef(id))
    .filter((t): t is NonNullable<ReturnType<typeof talentDef>> => t !== undefined),
);
const reviewTheme = computed(() =>
  view.value?.review.themeId ? lifeThemeDef(view.value.review.themeId) : undefined,
);
const themeDefs = computed(() =>
  (view.value?.themeChoices ?? []).flatMap((id) => lifeThemeDef(id) ?? []),
);
const ledger = computed(() => samsaraLedger(heritageGroups()));
const balance = computed(() => samsaraBalance(ledger.value));
const criticalRows = computed(() => criticalSamsaraRows(ledger.value));
const confirmGate = computed(() =>
  reincarnationConfirmGate(view.value?.talentChoices.length ?? 0, chosen.value),
);
const nextFruitTotal = computed(
  () => player.reincarnation.daoFruit + (view.value?.daoFruitGained ?? 0),
);

function gongfaName(id: string): string {
  return gongfaDef(id)?.name ?? id;
}

function beginRebirth(): void {
  prepareReincarnation();
}

function reRollName(): void {
  nameDraft.value = rollReincarnateName();
}

function confirm(): void {
  if (confirmGate.value.disabled) return;
  confirmReincarnation(chosen.value, theme.value, nameDraft.value);
  chosen.value = null;
  theme.value = null;
  nameDraft.value = "";
  heritageOpen.value = false;
  heritageTap.value = null;
  engine.resetDeathFlag();
  void router.push("/");
}

watch(view, (next) => {
  if (!next) return;
  step.value = "review";
  nameDraft.value = next.nameDraft;
  chosen.value = null;
  theme.value = null;
  heritageOpen.value = false;
  heritageTap.value = null;
});
</script>

<style scoped>
.reincarnation-folio {
  --reincarnation-line: rgb(var(--color-ink-rgb) / 0.14);
  --reincarnation-line-strong: rgb(var(--color-ink-rgb) / 0.23);
  --character-accent: var(--color-cinnabar);
  --character-accent-rgb: var(--color-cinnabar-rgb);
  --folio-chapter-accent: var(--character-accent);
  --folio-chapter-accent-rgb: var(--character-accent-rgb);
  min-width: 0;
}

.reincarnation-head {
  display: grid;
  grid-template-columns: 2.45rem minmax(0, 1fr) auto;
  align-items: start;
  gap: 0.6rem 0.72rem;
  border-bottom: 1px solid var(--reincarnation-line);
  padding-bottom: 0.8rem;
}

.reincarnation-head__seal {
  display: grid;
  width: 2.1rem;
  height: 2.45rem;
  place-items: center;
  border-left: 2px solid rgb(var(--color-cinnabar-rgb) / 0.72);
  color: var(--color-cinnabar);
  font-size: var(--type-title);
  line-height: 1;
}

.reincarnation-head__identity {
  min-width: 0;
}

.reincarnation-head__eyebrow {
  color: var(--color-qing);
  font-size: var(--type-note);
  letter-spacing: 0.15em;
  line-height: 1.5;
}

.reincarnation-head__title {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.2rem 0.62rem;
  margin-top: 0.12rem;
  overflow-wrap: anywhere;
  color: var(--color-ink);
  font-family: var(--font-kai);
  font-size: var(--type-section);
  font-weight: 400;
  letter-spacing: 0.08em;
  line-height: 1.35;
}

.reincarnation-head__title span {
  color: var(--color-ink-soft);
  font-size: var(--type-body);
  letter-spacing: 0.08em;
}

.reincarnation-head__brief {
  margin-top: 0.42rem;
  color: var(--color-ink-soft);
  font-size: var(--type-body);
  line-height: 1.65;
}

.reincarnation-score {
  display: grid;
  min-width: 3.8rem;
  justify-items: end;
  gap: 0.05rem;
  color: var(--color-ink-soft);
}

.reincarnation-score span,
.reincarnation-score small {
  font-size: var(--type-note);
}

.reincarnation-score strong {
  color: var(--color-cinnabar);
  font-family: var(--font-kai);
  font-size: var(--type-title);
  font-weight: 400;
  line-height: 1.1;
}

.reincarnation-chapter {
  min-width: 0;
  margin-top: 0.82rem;
  border-top: 1px solid var(--reincarnation-line);
  padding-top: 0.82rem;
}

.reincarnation-head + .reincarnation-chapter {
  margin-top: 0.72rem;
  border-top: 0;
  padding-top: 0.72rem;
}

.reincarnation-chapter > .folio-chapter-head {
  margin-bottom: 0.56rem;
}

.reincarnation-copy {
  overflow-wrap: anywhere;
  color: var(--color-ink-soft);
  font-size: var(--type-body);
  line-height: 1.65;
}

.reincarnation-read {
  margin-top: 0.45rem;
  overflow-wrap: anywhere;
  border-top: 1px solid var(--reincarnation-line);
  padding-top: 0.45rem;
  color: var(--color-ink-faint);
  font-size: var(--type-note);
  line-height: 1.65;
}

.reincarnation-read.is-gold {
  color: var(--color-gold-ink);
}

.reincarnation-read.is-amber {
  color: var(--color-amber-ink);
}

.reincarnation-callout {
  display: grid;
  grid-template-columns: 2.1rem minmax(0, 1fr);
  gap: 0.62rem;
  border-left: 2px solid rgb(var(--color-cinnabar-rgb) / 0.58);
  padding-left: 0.62rem;
}

.reincarnation-callout__mark {
  display: grid;
  width: 2.1rem;
  height: 2.1rem;
  place-items: center;
  color: var(--color-cinnabar);
  font-size: var(--type-title);
}

.reincarnation-callout__title {
  color: var(--color-ink);
  font-family: var(--font-kai);
  font-size: var(--type-title);
  letter-spacing: 0.06em;
}

.reincarnation-callout__copy {
  margin-top: 0.3rem;
  color: var(--color-ink-soft);
  font-size: var(--type-body);
  line-height: 1.7;
}

.reincarnation-death-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-top: 0.62rem;
  border-block: 1px solid var(--reincarnation-line);
}

.reincarnation-death-grid > div {
  min-width: 0;
  padding: 0.5rem 0.6rem;
}

.reincarnation-death-grid > div + div {
  border-left: 1px dashed var(--reincarnation-line);
}

.reincarnation-death-grid dt {
  color: var(--color-ink-faint);
  font-size: var(--type-note);
  line-height: 1.4;
}

.reincarnation-death-grid dd {
  margin-top: 0.22rem;
  overflow-wrap: anywhere;
  color: var(--color-ink);
  font-family: var(--font-kai);
  font-size: var(--type-title);
  line-height: 1.4;
}

.reincarnation-footnote {
  margin-top: 0.72rem;
  border-top: 1px solid var(--reincarnation-line);
  padding-top: 0.58rem;
  color: var(--color-ink-faint);
  font-size: var(--type-note);
  line-height: 1.65;
}

.reincarnation-actions {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: stretch;
  gap: 0.52rem;
}

.reincarnation-actions__gate {
  display: grid;
  min-width: 0;
  gap: 0.14rem;
  color: var(--color-ink-faint);
  font-size: var(--type-note);
  line-height: 1.5;
}

.reincarnation-actions__gate strong {
  overflow-wrap: anywhere;
  color: var(--color-ink-soft);
  font-size: var(--type-body);
  font-weight: 400;
}

.reincarnation-actions__gate span {
  overflow-wrap: anywhere;
}

.reincarnation-actions__gate[data-reincarnation-confirm-state="blocked"] strong {
  color: var(--color-cinnabar);
}

.reincarnation-actions__gate[data-reincarnation-confirm-state="ready"] strong {
  color: var(--color-qing);
}

.reincarnation-actions__button {
  display: grid;
  width: 100%;
  min-width: 0;
  justify-items: center;
  gap: 0.08rem;
}

.reincarnation-actions__button small {
  display: block;
  font-size: var(--type-note);
  font-weight: 400;
  line-height: 1.35;
}

.reincarnation-review__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  margin-top: 0.72rem;
}

.reincarnation-review__grid > .reincarnation-chapter {
  margin-top: 0;
  border-top: 0;
  padding-top: 0;
}

.reincarnation-review__grid > .reincarnation-chapter + .reincarnation-chapter {
  margin-top: 0.72rem;
  border-top: 1px solid var(--reincarnation-line);
  padding-top: 0.72rem;
}

.reincarnation-choice__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  margin-top: 0.58rem;
}

.reincarnation-read-panel {
  min-width: 0;
  padding: 0.52rem 0;
}

.reincarnation-read-panel + .reincarnation-read-panel {
  border-top: 1px solid var(--reincarnation-line);
}

.reincarnation-read-head {
  display: flex;
  min-width: 0;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.6rem;
  color: var(--color-ink-faint);
  font-size: var(--type-note);
}

.reincarnation-read-head strong {
  overflow-wrap: anywhere;
  color: var(--color-ink);
  font-family: var(--font-kai);
  font-size: var(--type-title);
  font-weight: 400;
  letter-spacing: 0.06em;
  text-align: right;
}

.reincarnation-read-panel .reincarnation-insight-rows {
  margin-top: 0.36rem;
}

.reincarnation-insight-rows {
  margin-top: 0.55rem;
  border-top: 1px solid var(--reincarnation-line);
}

.reincarnation-insight-rows > div {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.6rem;
  border-bottom: 1px solid var(--reincarnation-line);
  padding: 0.34rem 0;
}

.reincarnation-insight-rows dt {
  flex: 0 0 auto;
  color: var(--color-ink-faint);
  font-size: var(--type-note);
}

.reincarnation-insight-rows dd {
  min-width: 0;
  overflow-wrap: anywhere;
  color: var(--color-ink-soft);
  font-size: var(--type-body);
  text-align: right;
}

.reincarnation-ledger {
  min-width: 0;
}

.reincarnation-balance {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border-block: 1px solid var(--reincarnation-line);
}

.reincarnation-balance__row {
  display: grid;
  min-width: 0;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: baseline;
  gap: 0.12rem 0.4rem;
  padding: 0.48rem 0.55rem;
}

.reincarnation-balance__row + .reincarnation-balance__row {
  border-left: 1px dashed var(--reincarnation-line);
}

.reincarnation-balance__row span {
  color: var(--color-ink-soft);
  font-size: var(--type-body);
}

.reincarnation-balance__row strong {
  color: var(--color-ink);
  font-family: var(--font-kai);
  font-size: var(--type-title);
  font-weight: 400;
  line-height: 1;
}

.reincarnation-balance__row small {
  grid-column: 1 / -1;
  overflow-wrap: anywhere;
  color: var(--color-ink-faint);
  font-size: var(--type-note);
  line-height: 1.35;
}

.reincarnation-balance__row.is-full strong {
  color: var(--color-jade);
}

.reincarnation-balance__row.is-partial strong {
  color: var(--color-gold-ink);
}

.reincarnation-balance__row.is-reset strong {
  color: var(--color-ink-faint);
}

.reincarnation-ledger__caption {
  margin-top: 0.56rem;
  color: var(--color-ink-faint);
  font-size: var(--type-note);
  letter-spacing: 0.12em;
}

.reincarnation-critical {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.3rem;
  margin-top: 0.3rem;
}

.reincarnation-critical__row {
  display: grid;
  min-width: 0;
  grid-template-columns: 1.6rem minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.45rem;
  border-bottom: 1px solid var(--reincarnation-line);
  padding: 0.28rem 0;
}

.reincarnation-critical__mark {
  display: grid;
  width: 1.6rem;
  height: 1.6rem;
  place-items: center;
  border-left: 2px solid currentColor;
  font-size: var(--type-note);
  line-height: 1;
}

.reincarnation-critical__row.is-partial {
  color: var(--color-gold-ink);
}

.reincarnation-critical__row.is-reset {
  color: var(--color-ink-faint);
}

.reincarnation-critical__name {
  min-width: 0;
  overflow-wrap: anywhere;
  color: var(--color-ink-soft);
  font-size: var(--type-body);
}

.reincarnation-critical__group {
  max-width: 7.2rem;
  overflow-wrap: anywhere;
  color: var(--color-ink-faint);
  font-size: var(--type-note);
  line-height: 1.35;
  text-align: right;
}

.reincarnation-keep {
  display: grid;
  grid-template-columns: 1.6rem minmax(0, 1fr);
  gap: 0.45rem;
  margin-top: 0.55rem;
  border-top: 1px solid var(--reincarnation-line);
  padding-top: 0.5rem;
  color: var(--color-ink-faint);
  font-size: var(--type-note);
  line-height: 1.65;
}

.reincarnation-keep__mark {
  display: grid;
  width: 1.6rem;
  height: 1.6rem;
  place-items: center;
  border-left: 2px solid rgb(var(--color-gold-rgb) / 0.58);
  color: var(--color-gold-ink);
}

.reincarnation-ledger__toggle {
  display: flex;
  width: 100%;
  min-height: 2rem;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-top: 0.55rem;
  border-top: 1px solid var(--reincarnation-line);
  padding: 0.45rem 0 0;
  color: var(--color-qing);
  font-size: var(--type-body);
  text-align: left;
}

.reincarnation-ledger__fold {
  margin-top: 0.45rem;
}

.reincarnation-ledger__scroll {
  padding-right: 0.15rem;
}

.reincarnation-ledger-group {
  padding: 0.42rem 0;
}

.reincarnation-ledger-group + .reincarnation-ledger-group {
  border-top: 1px solid var(--reincarnation-line);
}

.reincarnation-ledger-group__head {
  display: grid;
  grid-template-columns: 1.45rem minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.4rem;
  border-bottom: 1px solid var(--reincarnation-line);
  padding-bottom: 0.32rem;
}

.reincarnation-ledger-group__mark {
  display: grid;
  width: 1.45rem;
  height: 1.45rem;
  place-items: center;
  border-left: 2px solid currentColor;
  font-size: var(--type-note);
  line-height: 1;
}

.reincarnation-ledger-group.is-full {
  color: var(--color-jade);
}

.reincarnation-ledger-group.is-partial {
  color: var(--color-gold-ink);
}

.reincarnation-ledger-group.is-reset {
  color: var(--color-ink-faint);
}

.reincarnation-ledger-group__head p {
  min-width: 0;
  overflow-wrap: anywhere;
  color: var(--color-ink-soft);
  font-size: var(--type-body);
}

.reincarnation-ledger-group__head > span:last-child {
  color: var(--color-ink-faint);
  font-size: var(--type-note);
}

.reincarnation-ledger-group__rows {
  margin-top: 0.18rem;
}

.reincarnation-ledger-row {
  display: grid;
  width: 100%;
  min-width: 0;
  grid-template-columns: minmax(0, 1fr) auto 1rem;
  align-items: center;
  gap: 0.35rem;
  border-bottom: 1px solid var(--reincarnation-line);
  padding: 0.32rem 0;
  color: var(--color-ink-soft);
  text-align: left;
}

.reincarnation-ledger-row__name {
  min-width: 0;
  overflow-wrap: anywhere;
  font-size: var(--type-body);
}

.reincarnation-ledger-row__state {
  color: var(--color-ink-faint);
  font-size: var(--type-note);
  text-align: right;
}

.reincarnation-ledger-row__mark {
  color: var(--color-ink-faint);
  font-size: var(--type-body);
  text-align: center;
}

.reincarnation-ledger-row__detail {
  grid-column: 1 / -1;
  overflow-wrap: anywhere;
  border-top: 1px dashed var(--reincarnation-line);
  padding-top: 0.28rem;
  color: var(--color-ink-faint);
  font-size: var(--type-note);
  line-height: 1.6;
}

.reincarnation-roots {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.55rem;
}

.reincarnation-root {
  display: inline-flex;
  min-width: 0;
  align-items: baseline;
  gap: 0.28rem;
  border-left: 1px solid rgb(var(--color-qing-rgb) / 0.42);
  padding: 0.2rem 0 0.2rem 0.42rem;
  color: var(--color-ink-soft);
}

.reincarnation-root strong {
  color: var(--color-qing);
  font-size: var(--type-title);
  font-weight: 400;
}

.reincarnation-root span {
  font-size: var(--type-note);
}

.reincarnation-name__row {
  display: flex;
  align-items: stretch;
  gap: 0.42rem;
  margin-top: 0.55rem;
}

.reincarnation-name__input {
  min-width: 0;
  flex: 1 1 auto;
  border: 1px solid rgb(var(--color-ink-rgb) / 0.22);
  border-radius: 2px;
  background: rgb(var(--color-paper-deep-rgb) / 0.58);
  padding: 0.48rem 0.6rem;
  color: var(--color-ink);
  font-family: var(--font-kai);
  font-size: var(--type-title);
  letter-spacing: 0.14em;
  outline: none;
}

.reincarnation-name__input:focus {
  border-color: rgb(var(--color-cinnabar-rgb) / 0.5);
}

.reincarnation-name__reroll {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 0.3rem;
  white-space: normal;
}

.reincarnation-empty {
  margin-top: 0.55rem;
  border-block: 1px dashed var(--reincarnation-line-strong);
  padding: 0.55rem 0;
  color: var(--color-ink-faint);
  font-size: var(--type-body);
  line-height: 1.6;
}

.reincarnation-talent-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0;
  margin-top: 0.55rem;
}

.reincarnation-talent-choice,
.reincarnation-theme-choice {
  display: grid;
  width: 100%;
  min-width: 0;
  gap: 0.35rem;
  border: 0;
  border-bottom: 1px solid var(--reincarnation-line);
  border-left: 2px solid transparent;
  background: transparent;
  padding: 0.55rem 0.58rem;
  text-align: left;
  transition:
    border-color 160ms ease,
    background-color 160ms ease,
    transform 120ms ease;
}

.reincarnation-talent-choice:active,
.reincarnation-theme-choice:active {
  transform: scale(0.99);
}

.reincarnation-talent-choice.is-chosen,
.reincarnation-theme-choice.is-chosen {
  border-left-color: rgb(var(--color-cinnabar-rgb) / 0.72);
  background: rgb(var(--color-cinnabar-rgb) / 0.025);
}

.reincarnation-talent-choice__head,
.reincarnation-theme-choice__head {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.25rem 0.5rem;
}

.reincarnation-talent-choice__name,
.reincarnation-theme-choice__name {
  font-size: var(--type-title);
  line-height: 1.35;
}

.reincarnation-talent-choice__grade,
.reincarnation-theme-choice__gain {
  color: var(--color-ink-faint);
  font-size: var(--type-note);
}

.reincarnation-talent-choice__mark {
  margin-left: auto;
  color: var(--color-cinnabar);
  font-size: var(--type-note);
}

.reincarnation-talent-choice__desc,
.reincarnation-theme-choice__vow {
  overflow-wrap: anywhere;
  color: var(--color-ink-soft);
  font-size: var(--type-body);
  line-height: 1.55;
}

.reincarnation-talent-choice__mods {
  overflow-wrap: anywhere;
  border-top: 1px solid var(--reincarnation-line);
  padding-top: 0.28rem;
  color: var(--color-qing);
  font-size: var(--type-note);
  line-height: 1.55;
}

.reincarnation-extra {
  display: flex;
  flex-wrap: wrap;
  gap: 0.28rem 0.6rem;
  margin-top: 0.55rem;
  border-top: 1px solid var(--reincarnation-line);
  padding-top: 0.45rem;
  color: var(--color-ink-faint);
  font-size: var(--type-note);
}

.reincarnation-extra strong {
  color: var(--color-gold-ink);
  font-family: var(--font-kai);
  font-weight: 400;
}

.reincarnation-theme-free {
  margin-top: 0.45rem;
  color: var(--color-gold-ink);
  font-size: var(--type-note);
  line-height: 1.5;
}

.reincarnation-theme-list {
  display: grid;
  gap: 0;
  margin-top: 0.55rem;
}

.reincarnation-theme-choice__goal {
  overflow-wrap: anywhere;
  border-top: 1px solid var(--reincarnation-line);
  padding-top: 0.3rem;
  color: var(--color-ink-faint);
  font-size: var(--type-note);
  line-height: 1.6;
}

.reincarnation-theme-choice__taboo {
  overflow-wrap: anywhere;
  color: var(--color-amber-ink);
  font-size: var(--type-note);
  line-height: 1.55;
}

.reincarnation-theme-skip {
  margin-top: 0.45rem;
  color: var(--color-ink-faint);
  font-size: var(--type-note);
  line-height: 1.55;
}

.reincarnation-heritage-gained__effect {
  margin-top: 0.45rem;
  border-top: 1px solid var(--reincarnation-line);
  padding-top: 0.42rem;
  color: var(--color-gold-ink);
  font-size: var(--type-note);
  line-height: 1.6;
}

.reincarnation-final {
  border-left: 2px solid rgb(var(--color-cinnabar-rgb) / 0.58);
  padding-left: 0.62rem;
}

.reincarnation-final__copy {
  margin-top: 0.48rem;
  color: var(--color-ink-soft);
  font-size: var(--type-note);
  line-height: 1.65;
}

@media (min-width: 620px) {
  .reincarnation-actions {
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
  }

  .reincarnation-actions__button {
    width: auto;
    min-width: 9.2rem;
  }

  .reincarnation-review__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: 0.9rem;
  }

  .reincarnation-review__grid > .reincarnation-chapter + .reincarnation-chapter {
    margin-top: 0;
    border-top: 0;
    border-left: 1px solid var(--reincarnation-line);
    padding: 0 0 0 0.9rem;
  }

  .reincarnation-review__grid > .reincarnation-chapter > .folio-chapter-head {
    grid-template-columns: auto minmax(0, 1fr);
    align-items: start;
  }

  .reincarnation-review__grid
    > .reincarnation-chapter
    > .folio-chapter-head
    :deep(.folio-chapter-head__fact) {
    grid-column: 2;
    justify-self: start;
    text-align: left;
  }

  .reincarnation-choice__grid {
    grid-template-columns: minmax(0, 1.08fr) minmax(0, 0.92fr);
    column-gap: 0.9rem;
  }

  .reincarnation-read-panel + .reincarnation-read-panel {
    border-top: 0;
    border-left: 1px solid var(--reincarnation-line);
    padding-left: 0.9rem;
  }

  .reincarnation-critical {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: 0.55rem;
  }

  .reincarnation-talent-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 260px) {
  .reincarnation-head {
    grid-template-columns: 2.2rem minmax(0, 1fr);
  }

  .reincarnation-head__seal {
    width: 2.2rem;
    height: 2.2rem;
  }

  .reincarnation-score {
    grid-column: 2;
    justify-items: start;
  }

  .reincarnation-death-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .reincarnation-death-grid > div + div {
    border-top: 1px dashed var(--reincarnation-line);
    border-left: 0;
  }

  .reincarnation-balance {
    grid-template-columns: minmax(0, 1fr);
  }

  .reincarnation-balance__row + .reincarnation-balance__row {
    border-top: 1px dashed var(--reincarnation-line);
    border-left: 0;
  }

  .reincarnation-critical__row {
    grid-template-columns: 1.45rem minmax(0, 1fr);
  }

  .reincarnation-critical__group {
    grid-column: 2;
    max-width: none;
    text-align: left;
  }
}

@media (max-width: 220px) {
  .reincarnation-actions {
    grid-template-columns: minmax(0, 1fr);
  }

  .reincarnation-actions__button {
    width: 100%;
    min-width: 0;
  }

  .reincarnation-name__row {
    flex-direction: column;
  }

  .reincarnation-name__reroll {
    justify-content: center;
  }

  .reincarnation-ledger-row {
    grid-template-columns: minmax(0, 1fr) 1rem;
  }

  .reincarnation-ledger-row__state {
    grid-column: 1;
    text-align: left;
  }

  .reincarnation-ledger-row__mark {
    grid-column: 2;
    grid-row: 1;
  }
}
</style>
