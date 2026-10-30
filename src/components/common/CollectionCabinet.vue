<template>
  <!--
    藏珍格只报九册有没有开卷、哪册有新得，以及功名与藏珍两份总进度。
    册名、来源、条目与成就条件都在正文完整出现，故整图不重复进入读屏。
  -->
  <div class="collection-cabinet" data-collection-cabinet aria-hidden="true">
    <div class="collection-cabinet__head">
      <span class="collection-cabinet__title">藏珍格</span>
      <span class="collection-cabinet__edition tabular">九册</span>
    </div>

    <div class="collection-cabinet__grid">
      <span
        v-for="cell in cells"
        :key="cell.key"
        class="collection-cabinet__cell"
        :class="{
          'is-lit': cell.known > 0,
          'is-complete': cell.complete,
          'is-new': cell.newCount > 0,
        }"
      >
        <span class="collection-cabinet__mark">{{ cell.mark }}</span>
        <span class="collection-cabinet__track">
          <span :style="{ width: `${cell.ratio * 100}%` }" />
        </span>
        <span v-if="cell.newCount > 0" class="collection-cabinet__spark" />
      </span>
    </div>

    <div class="collection-cabinet__caption">
      <span class="tabular"
        >名 <strong>{{ achievementDone }}</strong
        >/{{ achievementTotal }}</span
      >
      <span class="tabular"
        >珍 <strong>{{ collectionKnown }}</strong
        >/{{ collectionTotal }}</span
      >
    </div>
  </div>
</template>

<script setup lang="ts">
interface CabinetCell {
  key: string;
  mark: string;
  known: number;
  ratio: number;
  complete: boolean;
  newCount: number;
}

defineProps<{
  cells: readonly CabinetCell[];
  achievementDone: number;
  achievementTotal: number;
  collectionKnown: number;
  collectionTotal: number;
}>();
</script>

<style scoped>
.collection-cabinet {
  position: relative;
  display: grid;
  width: 154px;
  height: 128px;
  grid-template-rows: auto 1fr auto;
  gap: 0.28rem;
  overflow: hidden;
  border: 1px solid rgb(var(--color-ink-rgb) / 0.12);
  background:
    linear-gradient(145deg, rgb(var(--color-paper-rgb) / 0.52), transparent 52%),
    radial-gradient(circle at 88% 10%, rgb(var(--color-gold-ink-rgb) / 0.05), transparent 48%),
    rgb(var(--color-paper-lifted-rgb) / 0.42);
  box-shadow:
    inset 0 0 0 3px rgb(var(--color-paper-rgb) / 0.24),
    2px 2px 0 rgb(var(--color-ink-rgb) / 0.025);
  padding: 0.42rem 0.48rem 0.38rem;
}

.collection-cabinet::before {
  position: absolute;
  inset: 0.25rem;
  border: 1px solid rgb(var(--color-ink-rgb) / 0.035);
  content: "";
  pointer-events: none;
}

.collection-cabinet__head,
.collection-cabinet__caption {
  position: relative;
  z-index: 1;
  display: flex;
  min-width: 0;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.35rem;
}

.collection-cabinet__title {
  color: rgb(var(--color-ink-soft-rgb));
  font-family: var(--font-kai);
  font-size: var(--type-note);
  letter-spacing: 0.16em;
}

.collection-cabinet__edition {
  color: rgb(var(--color-ink-faint-rgb));
  font-size: var(--type-note);
}

.collection-cabinet__grid {
  position: relative;
  z-index: 1;
  display: grid;
  min-height: 0;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.18rem;
  border-block: 1px solid rgb(var(--color-ink-rgb) / 0.07);
  padding-block: 0.28rem;
}

.collection-cabinet__cell {
  position: relative;
  display: grid;
  min-width: 0;
  place-items: center;
  overflow: hidden;
  border: 1px solid rgb(var(--color-ink-rgb) / 0.08);
  background: rgb(var(--color-paper-rgb) / 0.16);
}

.collection-cabinet__cell::before {
  position: absolute;
  inset-block: 0.18rem;
  left: 0.18rem;
  width: 1px;
  background: rgb(var(--color-ink-rgb) / 0.06);
  content: "";
}

.collection-cabinet__cell.is-lit {
  border-color: rgb(var(--color-qing-rgb) / 0.22);
  background: rgb(var(--color-qing-rgb) / 0.035);
}

.collection-cabinet__cell.is-complete {
  border-color: rgb(var(--color-jade-rgb) / 0.32);
  background: rgb(var(--color-jade-rgb) / 0.045);
}

.collection-cabinet__cell.is-new {
  border-color: rgb(var(--color-cinnabar-rgb) / 0.34);
  background: rgb(var(--color-cinnabar-rgb) / 0.04);
}

.collection-cabinet__mark {
  position: relative;
  z-index: 1;
  color: rgb(var(--color-ink-faint-rgb));
  font-family: var(--font-kai);
  font-size: var(--type-note);
  line-height: 1;
}

.collection-cabinet__cell.is-lit .collection-cabinet__mark {
  color: rgb(var(--color-ink-soft-rgb));
}

.collection-cabinet__cell.is-complete .collection-cabinet__mark {
  color: rgb(var(--color-jade-rgb));
}

.collection-cabinet__cell.is-new .collection-cabinet__mark {
  color: rgb(var(--color-cinnabar-rgb));
}

.collection-cabinet__track {
  position: absolute;
  right: 0.2rem;
  bottom: 0.15rem;
  left: 0.2rem;
  height: 1px;
  background: rgb(var(--color-ink-rgb) / 0.06);
}

.collection-cabinet__track > span {
  display: block;
  height: 100%;
  background: rgb(var(--color-qing-rgb) / 0.5);
}

.collection-cabinet__cell.is-complete .collection-cabinet__track > span {
  background: rgb(var(--color-jade-rgb) / 0.62);
}

.collection-cabinet__cell.is-new .collection-cabinet__track > span {
  background: rgb(var(--color-cinnabar-rgb) / 0.62);
}

.collection-cabinet__spark {
  position: absolute;
  top: 0.18rem;
  right: 0.18rem;
  width: 0.22rem;
  height: 0.22rem;
  border-radius: 50%;
  background: rgb(var(--color-cinnabar-rgb) / 0.78);
}

.collection-cabinet__caption {
  color: rgb(var(--color-ink-faint-rgb));
  font-size: var(--type-note);
  line-height: 1.25;
}

.collection-cabinet__caption strong {
  color: rgb(var(--color-cinnabar-rgb));
  font-family: var(--font-kai);
  font-weight: 500;
}
</style>
