<template>
  <div class="opening-page opening-page--create stagger-in" data-opening-create>
    <OpeningBackdrop variant="create" />

    <div class="opening-page__inner">
      <header class="opening-create__nav">
        <RouterLink
          to="/welcome"
          class="-my-1.5 py-1.5 text-body text-ink-faint active:text-ink-soft"
        >
          ← 欢迎
        </RouterLink>
        <p>卷一 · 立命 <span class="tabular">02 / 03</span></p>
      </header>

      <header class="opening-create__masthead">
        <div>
          <p class="opening-create__eyebrow">玄枢录 · 灵根既定，道号自书</p>
          <h1 class="font-kai text-[42px] leading-none text-ink">问 心 立 道</h1>
          <p class="opening-create__lead">
            这一页只定两件事：此后别人如何称你，以及你带着怎样一副根骨入世。
          </p>
        </div>
        <div class="opening-create__stamp compact:!hidden" aria-hidden="true">命</div>
      </header>

      <div class="opening-create__sheet">
        <section class="opening-create__identity">
          <header class="opening-create__section-head">
            <span class="opening-create__ordinal tabular">一</span>
            <div>
              <p>留名</p>
              <h2>道号</h2>
            </div>
          </header>
          <div class="opening-create__name-row">
            <input
              v-model="name"
              maxlength="8"
              aria-label="道号"
              class="opening-create__name-input text-[16px]"
              placeholder="取一个道号"
            />
            <button
              class="btn-ghost opening-create__name-roll"
              aria-label="随机取一个道号"
              @click="randomName"
            >
              <GameIcon name="refresh" :size="15" />
            </button>
          </div>
          <p class="opening-create__note">最多八字。留白不填，便以「无名散修」入卷。</p>
        </section>

        <section class="opening-create__roots" data-opening-roots>
          <header class="opening-create__section-head">
            <span class="opening-create__ordinal tabular">二</span>
            <div>
              <p>验根</p>
              <h2>灵根</h2>
            </div>
            <strong class="opening-create__grade">{{ profile.gradeName }}</strong>
          </header>

          <div :key="rollSeq" class="opening-create__root-stage stagger-in">
            <span class="opening-create__root-vein" aria-hidden="true" />
            <div v-for="root in profile.roots" :key="root.element" class="opening-create__root">
              <span
                class="opening-create__root-disc grid place-items-center font-kai text-[26px] animate-breathe"
                :style="{
                  borderColor: ELEMENTS[root.element].color,
                  color: ELEMENTS[root.element].color,
                }"
              >
                {{ ELEMENTS[root.element].char }}
              </span>
              <span class="opening-create__root-name">{{ ELEMENTS[root.element].name }}</span>
              <span class="opening-create__aptitude tabular">资质 {{ root.aptitude }}</span>
            </div>
          </div>

          <div data-value-row class="opening-create__growth">
            <span>修行倍率</span>
            <strong
              :key="rollSeq"
              class="font-kai text-heading leading-none text-cinnabar tabular animate-ink-pop"
            >
              ×{{ profile.growthMult.toFixed(2) }}
            </strong>
          </div>

          <div
            v-if="tendencies.length"
            :key="`tend-${rollSeq}`"
            class="opening-create__tendencies stagger-in"
          >
            <p class="opening-create__subhead">天然牌面</p>
            <p v-for="t in tendencies" :key="t.element" class="opening-create__tendency t-body">
              <span class="font-kai" :style="{ color: ELEMENTS[t.element].color }">{{
                ELEMENTS[t.element].char
              }}</span>
              <span>{{ t.text }}</span>
            </p>
          </div>

          <p aria-live="polite" class="sr-only">{{ rerollAnnounce }}</p>

          <div class="opening-create__reroll-row">
            <button
              class="btn-ghost opening-create__reroll"
              :disabled="starting"
              data-opening-reroll
              @click="reroll"
            >
              {{ rerollLabel }}
            </button>
            <p v-if="unlimitedReroll">不满意就一直改，改到掷中你认的那副牌为止</p>
          </div>
        </section>

        <section class="opening-create__vow">
          <div>
            <p>定卷</p>
            <h2>按下之后，灵根将就此定格</h2>
            <span>这一世的修行之路，由它决定。</span>
          </div>
          <button
            class="btn-seal opening-create__begin text-[16px]"
            :disabled="starting"
            @click="begin"
          >
            {{ starting ? "灵 根 鉴 定 中……" : "踏 入 仙 途" }}
          </button>
        </section>
      </div>
    </div>

    <SpiritRootReveal ref="revealRef" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from "vue";
import { useRouter } from "vue-router";
import { rng } from "@/utils/random";
import { rollLinggen } from "@/core/linggenGen";
import { rootElements, tendencyLines } from "@/core/linggenAffinity";
import { randomDaoName } from "@/data/names";
import { ELEMENTS } from "@/data/linggen";
import { generateEquipment } from "@/core/equipGen";
import { acquireEquipment } from "@/core/loot";
import { acquirePill, trackRealm } from "@/core/progress";
import { learnGongfa } from "@/core/gongfaService";
import { seedLoreIfNeeded } from "@/core/loreService";
import { equipmentTemplate } from "@/data/equipment";
import { useGameStore } from "@/stores/game";
import { usePlayerStore } from "@/stores/player";
import { useCultivationStore } from "@/stores/cultivation";
import { useInventoryStore } from "@/stores/inventory";
import { useUiStore } from "@/stores/ui";
import GameIcon from "@/components/common/GameIcon.vue";
import SpiritRootReveal from "@/components/common/SpiritRootReveal.vue";
import OpeningBackdrop from "@/components/opening/OpeningBackdrop.vue";

const router = useRouter();
const game = useGameStore();
const player = usePlayerStore();
const cultivation = useCultivationStore();
const inventory = useInventoryStore();
const ui = useUiStore();

const name = ref(randomDaoName(rng));
if (!game.createProfile) game.setCreateProfile(rollLinggen(rng));
const profile = computed(() => game.createProfile!);
const rerollsLeft = computed(() => game.createRerolls);
const unlimitedReroll = computed(() => rerollsLeft.value === null);
const rerollLabel = computed(() =>
  rerollsLeft.value === null ? "逆天改命" : `逆天改命(余 ${rerollsLeft.value} 次)`,
);

const rollSeq = ref(0);
const rerollAnnounce = ref("");
watch(rollSeq, () => {
  const p = profile.value;
  const rootsText = p.roots.map((r) => `${ELEMENTS[r.element].name}${r.aptitude}`).join("、");
  rerollAnnounce.value = `重掷得「${p.gradeName}」,${rootsText},修行倍率 ×${p.growthMult.toFixed(2)}`;
});

const revealRef = useTemplateRef<InstanceType<typeof SpiritRootReveal>>("revealRef");
const starting = ref(false);
const tendencies = computed(() => tendencyLines(rootElements(profile.value.roots)));

function reroll(): void {
  if (starting.value) return;
  if (!game.spendCreateReroll()) return;
  game.setCreateProfile(rollLinggen(rng));
  rollSeq.value += 1;
}

function randomName(): void {
  name.value = randomDaoName(rng);
}

function begin(): void {
  if (starting.value) return;
  starting.value = true;
  const finalName = name.value.trim().slice(0, 8) || "无名散修";
  player.initCharacter(finalName, profile.value);
  learnGongfa("m_taixuan");
  cultivation.equipMain("m_taixuan");
  const starter = generateEquipment(1, rng, { slot: "weapon" });
  acquireEquipment(starter, { quiet: true, forceKeep: true });
  const tpl = equipmentTemplate(starter.templateId);
  if (tpl) inventory.equip(starter.uid, tpl.slot);
  acquirePill("p_jvqisan", 3);
  seedLoreIfNeeded();
  game.markStarted();
  trackRealm();
  ui.toast("云深不知处,仙路自此始", "rare");
  ui.worldEnter = `你已入此世 —— 灵根「${profile.value.gradeName}」,修行倍率 ×${profile.value.growthMult.toFixed(2)}`;
  revealRef.value?.show(profile.value.gradeName, () => {
    void router.push("/");
  });
}
</script>

<style scoped>
.opening-page {
  position: relative;
  min-height: 100%;
  isolation: isolate;
  overflow: hidden;
  padding: clamp(1.15rem, 4vw, 3.4rem);
}

.opening-page__inner {
  position: relative;
  z-index: 1;
  width: min(100%, 58rem);
  margin-inline: auto;
}

.opening-create__nav {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.35rem 1rem;
  border-bottom: 1px solid rgb(var(--color-ink-rgb) / 0.12);
  padding-bottom: 0.65rem;
  color: var(--color-ink-faint);
  font-size: var(--type-note);
}

.opening-create__nav p {
  letter-spacing: 0.12em;
}

.opening-create__nav p span {
  margin-left: 0.4rem;
  color: var(--color-qing);
}

.opening-create__masthead {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: 1rem;
  padding-block: 1.15rem 1rem;
}

.opening-create__eyebrow {
  color: var(--color-ink-faint);
  font-size: var(--type-note);
  letter-spacing: 0.14em;
}

.opening-create__masthead h1 {
  margin-top: 0.46rem;
  letter-spacing: 0.16em;
}

.opening-create__lead {
  max-width: 34rem;
  margin-top: 0.55rem;
  color: var(--color-ink-soft);
  font-size: var(--type-body);
  line-height: 1.75;
}

.opening-create__stamp {
  display: grid;
  width: 3.7rem;
  height: 3.7rem;
  place-items: center;
  border: 1px solid rgb(var(--color-cinnabar-rgb) / 0.38);
  color: var(--color-cinnabar);
  font-family: var(--font-kai);
  font-size: var(--type-section);
  line-height: 1;
}

.opening-create__sheet {
  display: grid;
  min-width: 0;
  grid-template-columns: minmax(0, 1fr);
  border: 1px solid rgb(var(--color-ink-rgb) / 0.14);
  border-top: 2px solid var(--color-qing);
  background:
    linear-gradient(132deg, rgb(var(--color-qing-rgb) / 0.04), transparent 48%),
    rgb(var(--color-paper-lifted-rgb) / 0.76);
  box-shadow: 0.3rem 0.3rem 0 rgb(var(--color-ink-rgb) / 0.025);
}

.opening-create__identity,
.opening-create__roots {
  min-width: 0;
  padding: 0.9rem 0.92rem 1rem;
}

.opening-create__identity {
  border-bottom: 1px solid rgb(var(--color-ink-rgb) / 0.09);
}

.opening-create__section-head {
  display: grid;
  grid-template-columns: 2rem minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.55rem;
}

.opening-create__ordinal {
  display: grid;
  width: 1.65rem;
  height: 1.65rem;
  place-items: center;
  border: 1px solid rgb(var(--color-qing-rgb) / 0.34);
  color: var(--color-qing);
  font-family: var(--font-kai);
  font-size: var(--type-note);
}

.opening-create__section-head p {
  color: var(--color-ink-faint);
  font-size: var(--type-note);
  letter-spacing: 0.12em;
}

.opening-create__section-head h2 {
  color: var(--color-ink);
  font-family: var(--font-kai);
  font-size: var(--type-title);
  font-weight: 400;
  letter-spacing: 0.12em;
  line-height: 1.35;
}

.opening-create__grade {
  justify-self: end;
  color: var(--color-cinnabar);
  font-family: var(--font-kai);
  font-size: var(--type-title);
  font-weight: 400;
  letter-spacing: 0.08em;
  text-align: right;
}

.opening-create__name-row {
  display: flex;
  min-width: 0;
  align-items: stretch;
  gap: 0.5rem;
  margin-top: 0.8rem;
}

.opening-create__name-input {
  width: 100%;
  min-width: 0;
  min-height: 2.8rem;
  border: 1px solid rgb(var(--color-ink-rgb) / 0.2);
  border-radius: 0;
  background: rgb(var(--color-paper-rgb) / 0.5);
  padding: 0.55rem 0.7rem;
  color: var(--color-ink);
  font-family: var(--font-kai);
  font-size: 16px;
  letter-spacing: 0.16em;
  outline: none;
}

.opening-create__name-input:focus {
  border-color: rgb(var(--color-cinnabar-rgb) / 0.58);
}

.opening-create__name-roll {
  flex: none;
  min-width: 2.8rem;
  min-height: 2.8rem;
  padding: 0.4rem;
}

.opening-create__note {
  margin-top: 0.42rem;
  color: var(--color-ink-faint);
  font-size: var(--type-note);
  line-height: 1.55;
}

.opening-create__root-stage {
  position: relative;
  display: grid;
  min-width: 0;
  grid-template-columns: repeat(auto-fit, minmax(2.75rem, 1fr));
  align-items: flex-start;
  justify-content: center;
  gap: 0.45rem 0.35rem;
  margin-top: 0.9rem;
  padding: 0.6rem 0 0.35rem;
}

.opening-create__root-vein {
  position: absolute;
  top: 2.4rem;
  right: 10%;
  left: 10%;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgb(var(--color-ink-rgb) / 0.12), transparent);
}

.opening-create__root {
  position: relative;
  display: grid;
  min-width: 0;
  justify-items: center;
  gap: 0.18rem;
}

.opening-create__root-disc {
  position: relative;
  z-index: 1;
  width: clamp(2.8rem, 14vw, 3.4rem);
  aspect-ratio: 1;
  border: 2px solid currentColor;
  border-radius: 50%;
  background:
    radial-gradient(circle at 44% 38%, rgb(var(--color-paper-rgb) / 0.94), transparent 48%),
    rgb(var(--color-paper-lifted-rgb) / 0.86);
  box-shadow: 0 0 0 0.28rem rgb(var(--color-paper-rgb) / 0.48);
}

.opening-create__root-name {
  color: var(--color-ink);
  font-family: var(--font-kai);
  font-size: var(--type-body);
  letter-spacing: 0.08em;
}

.opening-create__aptitude {
  color: var(--color-ink-faint);
  font-size: var(--type-note);
}

.opening-create__growth {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.65rem;
  margin-top: 0.65rem;
  border-block: 1px solid rgb(var(--color-ink-rgb) / 0.09);
  padding: 0.5rem 0.12rem;
  color: var(--color-ink-faint);
  font-size: var(--type-note);
}

.opening-create__tendencies {
  margin-top: 0.62rem;
}

.opening-create__subhead {
  color: var(--color-ink-faint);
  font-size: var(--type-note);
  letter-spacing: 0.14em;
}

.opening-create__tendency {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.28rem;
  color: var(--color-ink-soft);
  line-height: 1.65;
}

.opening-create__tendency > span:first-child {
  flex: none;
}

.opening-create__reroll-row {
  margin-top: 0.72rem;
  border-top: 1px solid rgb(var(--color-ink-rgb) / 0.09);
  padding-top: 0.65rem;
}

.opening-create__reroll {
  width: 100%;
  min-height: 2.65rem;
  padding-block: 0.55rem;
  font-family: var(--font-kai);
  font-size: var(--type-body);
  letter-spacing: 0.18em;
  white-space: nowrap;
}

.opening-create__reroll-row p {
  margin-top: 0.42rem;
  color: var(--color-ink-faint);
  font-size: var(--type-note);
  line-height: 1.55;
  text-align: center;
}

.opening-create__vow {
  display: grid;
  min-width: 0;
  grid-template-columns: minmax(0, 1fr);
  align-items: center;
  gap: 0.8rem;
  border-top: 1px solid rgb(var(--color-ink-rgb) / 0.12);
  padding: 0.9rem 0.92rem 1rem;
  background: rgb(var(--color-paper-rgb) / 0.16);
}

.opening-create__vow p {
  color: var(--color-cinnabar);
  font-size: var(--type-note);
  letter-spacing: 0.14em;
}

.opening-create__vow h2 {
  margin-top: 0.16rem;
  color: var(--color-ink);
  font-family: var(--font-kai);
  font-size: var(--type-title);
  font-weight: 400;
  letter-spacing: 0.08em;
  line-height: 1.4;
}

.opening-create__vow span {
  display: block;
  margin-top: 0.16rem;
  color: var(--color-ink-faint);
  font-size: var(--type-note);
  line-height: 1.55;
}

.opening-create__begin {
  width: 100%;
  min-height: 2.9rem;
  padding-block: 0.62rem;
  white-space: nowrap;
}

@media (max-width: 759px) {
  .opening-page {
    padding-block: 0.9rem;
  }

  .opening-create__nav {
    padding-bottom: 0.5rem;
  }

  .opening-create__masthead {
    padding-block: 0.85rem 0.7rem;
  }

  .opening-create__lead {
    margin-top: 0.38rem;
    line-height: 1.55;
  }

  .opening-create__identity {
    padding-block: 0.72rem 0.78rem;
  }

  .opening-create__name-row {
    margin-top: 0.62rem;
  }

  .opening-create__root-stage {
    margin-top: 0.65rem;
    padding-block: 0.42rem 0.24rem;
  }

  .opening-create__growth {
    margin-top: 0.45rem;
    padding-block: 0.4rem;
  }

  .opening-create__tendency {
    line-height: 1.52;
  }

  .opening-create__reroll-row {
    margin-top: 0.55rem;
    padding-top: 0.5rem;
  }
}

@media (min-width: 760px) {
  .opening-create__sheet {
    grid-template-columns: minmax(15rem, 0.74fr) minmax(0, 1.26fr);
  }

  .opening-create__identity {
    border-right: 1px solid rgb(var(--color-ink-rgb) / 0.09);
    border-bottom: 0;
  }

  .opening-create__vow {
    grid-column: 1 / -1;
    grid-template-columns: minmax(0, 1fr) minmax(13rem, 0.46fr);
  }
}

@media (max-width: 220px) {
  .opening-page {
    padding-inline: 0.62rem;
  }

  .opening-create__masthead {
    gap: 0.55rem;
  }

  .opening-create__stamp {
    width: 2.8rem;
    height: 2.8rem;
  }

  .opening-create__masthead h1 {
    letter-spacing: 0.04em;
  }

  .opening-create__identity,
  .opening-create__roots,
  .opening-create__vow {
    padding-inline: 0.62rem;
  }

  .opening-create__section-head {
    grid-template-columns: 1.65rem minmax(0, 1fr);
  }

  .opening-create__grade {
    grid-column: 2;
    justify-self: start;
    text-align: left;
  }
}
</style>
