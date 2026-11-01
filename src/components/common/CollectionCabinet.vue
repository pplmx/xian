<template>
  <!--
    九册总印是页签后的第一张总账：左边九枚册印，右边功名与藏珍总进度。
    390px 下九册压成一行；更窄时先收起格内读数，195px 再退回三列。
  -->
  <section class="collection-cabinet" data-collection-cabinet aria-label="九册总印">
    <div class="collection-cabinet__head">
      <span class="collection-cabinet__title">九册总印</span>
      <div class="collection-cabinet__totals">
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

    <div class="collection-cabinet__grid" role="list" aria-label="九册收录进度">
      <span
        v-for="cell in cells"
        :key="cell.key"
        class="collection-cabinet__cell"
        :class="{
          'is-lit': cell.known > 0,
          'is-complete': cell.complete,
          'is-new': cell.newCount > 0,
        }"
        role="listitem"
      >
        <span class="sr-only">{{ cell.name }}</span>
        <span class="collection-cabinet__cell-copy">
          <span class="collection-cabinet__mark" aria-hidden="true">{{ cell.mark }}</span>
          <span class="collection-cabinet__reading tabular">{{ cell.known }}/{{ cell.total }}</span>
        </span>
        <span class="collection-cabinet__track" aria-hidden="true">
          <span :style="{ width: `${cell.ratio * 100}%` }" />
        </span>
        <span v-if="cell.newCount > 0" class="collection-cabinet__spark" aria-hidden="true" />
      </span>
    </div>
  </section>
</template>

<script setup lang="ts">
interface CabinetCell {
  key: string;
  name: string;
  mark: string;
  known: number;
  total: number;
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
  width: 100%;
  min-width: 0;
  grid-template-rows: auto auto;
  gap: 0.34rem;
  border: 0;
  border-block: 1px solid rgb(var(--color-ink-rgb) / 0.1);
  background: transparent;
  padding: 0.46rem 0 0.52rem;
}

.collection-cabinet__head {
  position: relative;
  z-index: 1;
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.16rem 0.7rem;
}

.collection-cabinet__title {
  color: rgb(var(--color-ink-soft-rgb));
  font-family: var(--font-kai);
  font-size: var(--type-note);
  letter-spacing: 0.16em;
  line-height: 1.35;
}

.collection-cabinet__totals {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.18rem 0.55rem;
  color: rgb(var(--color-ink-faint-rgb));
  font-size: var(--type-note);
  line-height: 1.35;
}

.collection-cabinet__totals > span {
  white-space: nowrap;
}

.collection-cabinet__totals strong {
  color: rgb(var(--color-ink-rgb));
  font-family: var(--font-kai);
  font-weight: 500;
}

.collection-cabinet__grid {
  position: relative;
  z-index: 1;
  display: grid;
  min-width: 0;
  grid-template-columns: repeat(9, minmax(0, 1fr));
  gap: 0;
}

.collection-cabinet__cell {
  position: relative;
  display: grid;
  min-width: 0;
  min-height: 2.7rem;
  grid-template-rows: 1fr 1px;
  align-items: center;
  gap: 0.2rem;
  overflow: hidden;
  border: 0;
  border-left: 1px solid rgb(var(--color-ink-rgb) / 0.085);
  background: transparent;
  padding: 0.24rem 0.08rem 0.2rem;
}

.collection-cabinet__cell:first-child {
  border-left: 0;
}

.collection-cabinet__cell.is-lit {
  border-left-color: rgb(var(--color-qing-rgb) / 0.24);
}

.collection-cabinet__cell.is-complete {
  border-left-color: rgb(var(--color-jade-rgb) / 0.32);
}

.collection-cabinet__cell.is-new {
  border-left-color: rgb(var(--color-cinnabar-rgb) / 0.34);
}

.collection-cabinet__cell-copy {
  display: grid;
  min-width: 0;
  place-items: center;
  gap: 0.08rem;
}

.collection-cabinet__mark {
  color: rgb(var(--color-ink-faint-rgb));
  font-family: var(--font-kai);
  font-size: var(--type-body);
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

.collection-cabinet__reading {
  max-width: 100%;
  overflow: hidden;
  color: rgb(var(--color-ink-faint-rgb));
  font-size: var(--type-note);
  line-height: 1.15;
  text-overflow: clip;
  white-space: nowrap;
}

.collection-cabinet__cell.is-complete .collection-cabinet__reading {
  color: rgb(var(--color-jade-rgb));
}

.collection-cabinet__cell.is-new .collection-cabinet__reading {
  color: rgb(var(--color-cinnabar-rgb));
}

.collection-cabinet__track {
  width: 100%;
  height: 1px;
  overflow: hidden;
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
  top: 0.16rem;
  right: 0.16rem;
  width: 0.2rem;
  height: 0.2rem;
  border-radius: 50%;
  background: rgb(var(--color-cinnabar-rgb) / 0.78);
}

@media (max-width: 360px) {
  .collection-cabinet__cell {
    min-height: 1.9rem;
  }

  .collection-cabinet__reading {
    display: none;
  }
}

@media (max-width: 220px) {
  .collection-cabinet {
    padding-inline: 0;
  }

  .collection-cabinet__head {
    align-items: flex-start;
    flex-direction: column;
  }

  .collection-cabinet__totals {
    width: 100%;
    justify-content: space-between;
  }

  .collection-cabinet__grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .collection-cabinet__cell {
    min-height: 2.35rem;
    border-top: 1px solid rgb(var(--color-ink-rgb) / 0.085);
  }

  .collection-cabinet__cell:nth-child(-n + 3) {
    border-top: 0;
  }

  .collection-cabinet__cell:nth-child(3n + 1) {
    border-left: 0;
  }

  .collection-cabinet__reading {
    display: block;
  }
}
</style>
