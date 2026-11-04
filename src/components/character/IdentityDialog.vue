<template>
  <BaseModal
    :open="open"
    size="wide"
    title="修行画像"
    :aria-label="`修行画像，此世称谓「${identity?.epithet ?? '玄枢散人'}」`"
    @close="emit('close')"
  >
    <article v-if="identity" class="identity-folio stagger-in" data-identity-folio>
      <header class="identity-head" data-identity-head>
        <span class="identity-head__seal font-kai" aria-hidden="true">
          {{ identity.epithet.slice(0, 1) }}
        </span>
        <div class="identity-head__copy">
          <p class="identity-head__eyebrow">此世称谓 · 由真实行迹归纳</p>
          <h2 class="identity-head__title font-kai">「{{ identity.epithet }}」</h2>
          <p class="identity-head__narrative">{{ identity.narrative }}</p>
          <div v-if="traitWords.length" class="identity-head__traits" data-identity-traits>
            <span v-for="word in traitWords" :key="word">{{ word }}</span>
          </div>
          <!--
            道龄 —— 「这一号人物,你陪他走了多久」(见 ui/companionTime)。
            读的是 game.totalPlaySec:那条被钉死语义的存档事实(缺席时段不进它,
            挂机一晚不白得八小时),此前全仓只有星宿对齐读过,界面上一个字都没有。
            放在画像而不是顶栏:顶栏是此刻的读数,道龄是累计事实。
          -->
          <p class="identity-head__companion" data-identity-companion>
            <span class="identity-head__companion-label">{{
              companionTimeLabel(game.totalPlaySec)
            }}</span>
            <span class="identity-head__companion-value tabular">{{
              companionTimeText(game.totalPlaySec)
            }}</span>
          </p>
        </div>
      </header>

      <section class="identity-chapter" data-identity-chapter="roots">
        <FolioChapterHead
          data-character-chapter-head
          index="壹"
          title="此身所历"
          hint="师承、道途、流派与悟道，合成了别人口中的你"
          :fact="`${rootFilledCount} / ${identityRoots.length} 项有记`"
        />
        <div class="identity-roots" data-identity-roots>
          <p
            v-for="row in identityRoots"
            :key="row.key"
            class="identity-root"
            :data-identity-root="row.key"
          >
            <span class="identity-root__label">{{ row.label }}</span>
            <span
              class="identity-root__value"
              :class="{ 'is-empty': !row.value }"
              :title="row.value || undefined"
            >
              {{ row.value || "未定" }}
            </span>
          </p>
        </div>

        <section class="identity-fortunes" data-identity-fortunes>
          <p class="identity-subhead">
            <span>机缘落印</span>
            <small>{{ identity.roots.fortunes.length ? "取过的路，留下印记" : "尚无" }}</small>
          </p>
          <div v-if="identity.roots.fortunes.length" class="identity-fortune-list">
            <article
              v-for="(fortune, index) in identity.roots.fortunes"
              :key="fortune.id"
              class="identity-fortune"
              data-identity-fortune
            >
              <span class="identity-fortune__mark font-kai" aria-hidden="true">
                {{ cnNumber(index + 1) }}
              </span>
              <div class="identity-fortune__copy">
                <p class="identity-fortune__title">{{ fortune.title }}</p>
                <p v-if="fortune.line" class="identity-fortune__line">{{ fortune.line }}</p>
              </div>
            </article>
          </div>
          <p v-else class="identity-empty">
            还没有取过机缘。画像会先记住你走过的师承、道途与流派。
          </p>
        </section>

        <section v-if="identity.roots.pet" class="identity-pet" data-identity-pet>
          <p class="identity-subhead">
            <span>相伴灵兽</span>
            <small>{{ identity.roots.pet.personalityName }}</small>
          </p>
          <div class="identity-pet__head">
            <p class="identity-pet__name font-kai">{{ identity.roots.pet.name }}</p>
            <span class="identity-pet__nature">{{ identity.roots.pet.personalityName }}</span>
          </div>
          <p class="identity-pet__brief">{{ identity.roots.pet.brief }}</p>
          <p class="identity-pet__line">{{ identity.roots.pet.personalityLine }}</p>
        </section>
        <p v-else class="identity-empty identity-pet__empty">此世尚未有灵兽相伴。</p>
      </section>

      <section class="identity-chapter" data-identity-chapter="traits">
        <FolioChapterHead
          data-character-chapter-head
          index="贰"
          title="行迹三数"
          hint="只看累计事实，不把一次偶然写成性情"
          :fact="`${formatNum(traitTotal)} 次`"
        />
        <div class="identity-traits" data-identity-traits>
          <div
            v-for="row in traitRows"
            :key="row.key"
            class="identity-trait"
            :data-identity-trait="row.key"
          >
            <span class="identity-trait__label">{{ row.label }}</span>
            <strong class="identity-trait__value font-kai tabular">{{ row.value }}</strong>
            <span class="identity-trait__hint">{{ row.hint }}</span>
          </div>
        </div>

        <div class="identity-risk" data-identity-risk>
          <span class="identity-risk__mark font-kai" aria-hidden="true">判</span>
          <p>
            <span class="identity-risk__label">行止判词</span>
            <span class="identity-risk__text">{{ riskLine }}</span>
          </p>
        </div>

        <p class="identity-note">
          <strong>只描述，不提供数值加成。</strong>
          画像不提供属性、资源或等级；你怎样走，它便怎样写。
        </p>
      </section>
    </article>

    <template #footer>
      <button type="button" class="btn-seal w-full" @click="emit('close')">收 卷</button>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { buildIdentity } from "@/core/identityService";
import BaseModal from "@/components/common/BaseModal.vue";
import FolioChapterHead from "@/components/common/FolioChapterHead.vue";
import { cnNumber, formatNum } from "@/utils/format";
import { useGameStore } from "@/stores/game";
import { companionTimeLabel, companionTimeText } from "@/ui/companionTime";

/**
 * 修行画像不再只是一段总结加四行字：它把 core 归纳出的三层事实按人物册续开。
 *
 * 卷一报根因（师承、道途、流派、悟道、机缘与灵兽），卷二才报由累计行迹得出的
 * 三数与风险判词。所有文案与名字都从 identityService 现读，视图不另认一次机缘名。
 */
const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const game = useGameStore();
const identity = computed(() => buildIdentity());

const identityRoots = computed(() => {
  const roots = identity.value?.roots;
  return [
    {
      key: "mentor",
      label: "师承",
      value: roots?.mentor ? `${roots.mentor.name} · ${roots.mentor.title}` : "",
    },
    { key: "dao", label: "道途", value: roots?.daoPath ?? "" },
    { key: "build", label: "流派", value: roots?.build ?? "" },
    { key: "branch", label: "悟道", value: roots?.branches.join("、") ?? "" },
  ];
});

const rootFilledCount = computed(
  () => identityRoots.value.filter((row) => row.value.length > 0).length,
);

const traitWords = computed(() => identity.value?.traits.adjectives ?? []);

const traitRows = computed(() => {
  const counters = identity.value?.traits.counters;
  return [
    { key: "kills", label: "杀伐", value: formatNum(counters?.kills ?? 0), hint: "累计击败" },
    {
      key: "explores",
      label: "历练",
      value: formatNum(counters?.explores ?? 0),
      hint: "累计出行",
    },
    {
      key: "breakthroughs",
      label: "破境",
      value: formatNum(counters?.breakthroughs ?? 0),
      hint: "累计升阶",
    },
  ];
});

const traitTotal = computed(
  () =>
    (identity.value?.traits.counters.kills ?? 0) +
    (identity.value?.traits.counters.explores ?? 0) +
    (identity.value?.traits.counters.breakthroughs ?? 0),
);

const riskLine = computed(() => {
  const risk = identity.value?.traits.riskBias;
  if (risk === "gamble") return "杀伐多于历练，此修士惯以险求胜。";
  if (risk === "steady") return "行止更偏循序渐进，少以性命试未知。";
  return "行迹尚浅，还不足以判读风险取向。";
});
</script>

<style scoped>
.identity-folio {
  --identity-line: rgb(var(--color-ink-rgb) / 0.13);
  --character-accent: var(--color-cinnabar);
  --character-accent-rgb: var(--color-cinnabar-rgb);
  --folio-chapter-accent: var(--character-accent);
  --folio-chapter-accent-rgb: var(--character-accent-rgb);
  min-width: 0;
}

.identity-head {
  display: grid;
  grid-template-columns: 3rem minmax(0, 1fr);
  align-items: start;
  gap: 0.72rem;
  padding-bottom: 0.78rem;
  border-bottom: 1px solid var(--identity-line);
}

.identity-head__seal {
  display: grid;
  width: 3rem;
  height: 3rem;
  place-items: center;
  border: 1px solid rgb(var(--color-qing-rgb) / 0.4);
  background: rgb(var(--color-qing-rgb) / 0.04);
  color: rgb(var(--color-qing-rgb));
  font-size: var(--type-section);
  line-height: 1;
}

.identity-head__copy {
  min-width: 0;
}

.identity-head__eyebrow {
  color: rgb(var(--color-qing-rgb));
  font-size: var(--type-note);
  letter-spacing: 0.18em;
  line-height: 1.5;
}

.identity-head__title {
  margin-top: 0.08rem;
  color: rgb(var(--color-ink-rgb));
  font-size: var(--type-section);
  font-weight: 400;
  letter-spacing: 0.12em;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.identity-head__narrative {
  margin-top: 0.24rem;
  color: rgb(var(--color-ink-soft-rgb));
  font-size: var(--type-body);
  line-height: 1.72;
  overflow-wrap: anywhere;
}

.identity-head__traits {
  display: flex;
  flex-wrap: wrap;
  gap: 0.18rem 0.44rem;
  margin-top: 0.34rem;
}

.identity-head__traits span {
  padding-left: 0.34rem;
  border-left: 2px solid rgb(var(--color-qing-rgb) / 0.46);
  color: rgb(var(--color-qing-rgb));
  font-size: var(--type-note);
  line-height: 1.55;
}

/*
 * 道龄 —— 累计事实,与上面那几个「词」同一处收尾。
 * 比 traits 再淡一档(ink-faint):它不是这一号人物的"特点",是你们之间的时间。
 * 数值用正文色,让读数本身仍是可读的主角。
 */
.identity-head__companion {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.18rem 0.44rem;
  margin-top: 0.4rem;
  padding-top: 0.34rem;
  border-top: 1px dashed rgb(var(--color-ink-rgb) / 0.1);
}

.identity-head__companion-label {
  color: var(--color-ink-faint);
  font-family: var(--font-kai);
  font-size: var(--type-note);
  letter-spacing: 0.14em;
  line-height: 1.55;
}

.identity-head__companion-value {
  min-width: 0;
  color: var(--color-ink-soft);
  font-family: var(--font-kai);
  font-size: var(--type-body);
  line-height: 1.55;
}

.identity-chapter {
  padding-top: 0.78rem;
}

.identity-chapter + .identity-chapter {
  margin-top: 0.9rem;
  border-top: 1px solid var(--identity-line);
}

.identity-roots {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  margin-top: 0.42rem;
}

.identity-root {
  display: grid;
  grid-template-columns: 4.25rem minmax(0, 1fr);
  align-items: baseline;
  gap: 0.5rem;
  padding: 0.34rem 0;
  border-bottom: 1px solid rgb(var(--color-ink-rgb) / 0.075);
}

.identity-root__label {
  color: rgb(var(--color-ink-faint-rgb));
  font-family: var(--font-kai);
  font-size: var(--type-note);
  letter-spacing: 0.08em;
  white-space: nowrap;
}

.identity-root__value {
  min-width: 0;
  color: rgb(var(--color-ink-soft-rgb));
  font-size: var(--type-body);
  line-height: 1.55;
  overflow-wrap: anywhere;
}

.identity-root__value.is-empty {
  color: rgb(var(--color-ink-faint-rgb));
}

.identity-fortunes,
.identity-pet {
  margin-top: 0.62rem;
}

.identity-subhead {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.12rem 0.48rem;
  padding-bottom: 0.28rem;
  border-bottom: 1px solid var(--identity-line);
}

.identity-subhead > span {
  color: rgb(var(--color-ink-rgb));
  font-family: var(--font-kai);
  font-size: var(--type-title);
  letter-spacing: 0.12em;
}

.identity-subhead small {
  color: rgb(var(--color-qing-rgb));
  font-size: var(--type-note);
  line-height: 1.5;
}

.identity-fortune-list {
  display: grid;
}

.identity-fortune {
  display: grid;
  grid-template-columns: 1.55rem minmax(0, 1fr);
  align-items: start;
  gap: 0.46rem;
  padding: 0.38rem 0;
  border-bottom: 1px solid rgb(var(--color-ink-rgb) / 0.075);
}

.identity-fortune__mark {
  display: grid;
  min-height: 1.35rem;
  place-items: center;
  border-left: 2px solid rgb(var(--color-cinnabar-rgb) / 0.56);
  color: rgb(var(--color-cinnabar-rgb));
  font-size: var(--type-note);
  line-height: 1;
}

.identity-fortune__copy {
  min-width: 0;
}

.identity-fortune__title {
  color: rgb(var(--color-ink-rgb));
  font-size: var(--type-body);
  line-height: 1.55;
}

.identity-fortune__line {
  margin-top: 0.08rem;
  color: rgb(var(--color-ink-faint-rgb));
  font-size: var(--type-note);
  line-height: 1.6;
  overflow-wrap: anywhere;
}

.identity-pet {
  padding-top: 0.52rem;
  border-top: 1px solid rgb(var(--color-ink-rgb) / 0.075);
}

.identity-pet__head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: baseline;
  gap: 0.4rem;
  padding-top: 0.36rem;
}

.identity-pet__name {
  color: rgb(var(--color-ink-rgb));
  font-size: var(--type-title);
  letter-spacing: 0.08em;
  line-height: 1.45;
}

.identity-pet__nature {
  padding-left: 0.36rem;
  border-left: 2px solid rgb(var(--color-qing-rgb) / 0.46);
  color: rgb(var(--color-qing-rgb));
  font-size: var(--type-note);
  white-space: nowrap;
}

.identity-pet__brief,
.identity-pet__line {
  margin-top: 0.16rem;
  color: rgb(var(--color-ink-soft-rgb));
  font-size: var(--type-note);
  line-height: 1.62;
}

.identity-pet__line {
  color: rgb(var(--color-ink-faint-rgb));
}

.identity-empty {
  padding: 0.42rem 0;
  border-bottom: 1px solid rgb(var(--color-ink-rgb) / 0.075);
  color: rgb(var(--color-ink-faint-rgb));
  font-size: var(--type-note);
  line-height: 1.62;
}

.identity-pet__empty {
  margin-top: 0.5rem;
}

.identity-traits {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-top: 0.44rem;
}

.identity-trait {
  min-width: 0;
  padding: 0.28rem 0.5rem;
  border-left: 1px solid rgb(var(--color-ink-rgb) / 0.12);
}

.identity-trait:first-child {
  padding-left: 0;
  border-left: 0;
}

.identity-trait__label,
.identity-trait__hint {
  display: block;
  color: rgb(var(--color-ink-faint-rgb));
  font-size: var(--type-note);
  line-height: 1.45;
}

.identity-trait__value {
  display: block;
  margin: 0.04rem 0;
  color: rgb(var(--color-qing-rgb));
  font-size: var(--type-section);
  font-weight: 400;
  line-height: 1.25;
}

.identity-risk {
  display: grid;
  grid-template-columns: 1.55rem minmax(0, 1fr);
  align-items: start;
  gap: 0.5rem;
  margin-top: 0.55rem;
  padding-top: 0.48rem;
  border-top: 1px solid var(--identity-line);
}

.identity-risk__mark {
  display: grid;
  min-height: 1.45rem;
  place-items: center;
  border: 1px solid rgb(var(--color-cinnabar-rgb) / 0.34);
  color: rgb(var(--color-cinnabar-rgb));
  font-size: var(--type-note);
  line-height: 1;
}

.identity-risk p {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: baseline;
  gap: 0.5rem;
}

.identity-risk__label {
  color: rgb(var(--color-ink-faint-rgb));
  font-family: var(--font-kai);
  font-size: var(--type-note);
  white-space: nowrap;
}

.identity-risk__text {
  color: rgb(var(--color-ink-soft-rgb));
  font-size: var(--type-body);
  line-height: 1.62;
}

.identity-note {
  margin-top: 0.58rem;
  padding-top: 0.46rem;
  border-top: 1px solid rgb(var(--color-ink-rgb) / 0.075);
  color: rgb(var(--color-ink-faint-rgb));
  font-size: var(--type-note);
  line-height: 1.62;
}

.identity-note strong {
  color: rgb(var(--color-ink-soft-rgb));
  font-weight: 500;
}

@media (min-width: 620px) {
  .identity-roots {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: 1rem;
  }
}

@media (max-width: 220px) {
  .identity-head {
    grid-template-columns: 2.2rem minmax(0, 1fr);
    gap: 0.5rem;
  }

  .identity-head__seal {
    width: 2.2rem;
    height: 2.2rem;
  }

  .identity-head__title {
    font-size: var(--type-section);
  }

  .identity-roots {
    grid-template-columns: minmax(0, 1fr);
  }

  .identity-root {
    grid-template-columns: minmax(0, 1fr);
    gap: 0.08rem;
  }

  .identity-pet__head {
    grid-template-columns: minmax(0, 1fr);
  }

  .identity-pet__nature {
    justify-self: start;
  }

  .identity-traits {
    grid-template-columns: minmax(0, 1fr);
  }

  .identity-trait {
    padding: 0.28rem 0;
    border-top: 1px solid rgb(var(--color-ink-rgb) / 0.075);
    border-left: 0;
  }

  .identity-trait:first-child {
    border-top: 0;
  }

  .identity-risk p {
    grid-template-columns: minmax(0, 1fr);
    gap: 0.08rem;
  }
}
</style>
