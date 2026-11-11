<template>
  <!--
    九柜藏珍：每格都是能抽开的柜屉，不再只是卷首的一排只读总印。
    柜面先给册名、收录数、缺口与新得；真正的条目落在同页的柜屉里。
  -->
  <section class="collection-cabinet" data-collection-cabinet aria-label="九柜藏珍">
    <header class="collection-cabinet__head">
      <span class="collection-cabinet__title">九柜藏珍</span>
      <span class="collection-cabinet__hint">抽开一柜，来源与条目在下一页续读</span>
      <span class="collection-cabinet__totals tabular">
        <span
          >名 <strong>{{ achievementDone }}</strong
          >/{{ achievementTotal }}</span
        >
        <span
          >珍 <strong>{{ collectionKnown }}</strong
          >/{{ collectionTotal }}</span
        >
      </span>
    </header>

    <div class="collection-cabinet__wall" role="list" aria-label="九柜收录进度">
      <article
        v-for="cell in cells"
        :key="cell.key"
        class="collection-cabinet__drawer"
        :class="{
          'is-lit': cell.known > 0,
          'is-complete': cell.complete,
          'is-new': cell.newCount > 0,
          'is-open': selectedKey === cell.key,
        }"
        :data-collection-category="cell.key"
        :data-collection-start="cell.knownStart"
        :data-collection-shown="cell.knownShown"
        :data-collection-total="cell.knownTotal"
        role="listitem"
      >
        <!--
          这一柜收的是哪类物事 —— 按 `cell.key` 取景。

          `ui/collectionDesk` 把收藏收成九类(器 / 功 / 悟 / 丹 / 材 / 宝 / 兽 / 闻 / 赋),
          而柜面上九只屉长得一样,区别只有那一枚 6px 的单字印。
          九类对九种地形,故这里是一张**一对一**的表,不共用。

          落法是柜屉内的背景(绝对定位、不接指针):那一格是按钮,
          画占布局会把收录数挤走。点景关掉 —— 底下压着册名与收录数两行。
        -->
        <InkScene
          class="collection-cabinet__scene"
          :terrain="sceneTerrainOfCollection(cell.key)"
          :marks="false"
          aria-hidden="true"
        />
        <button
          type="button"
          class="collection-cabinet__button"
          :data-collection-category-toggle="cell.key"
          :aria-expanded="selectedKey === cell.key"
          :aria-controls="`collection-category-body-${cell.key}`"
          @click="emit('select', cell.key)"
        >
          <span class="collection-cabinet__handle" aria-hidden="true"><span /></span>
          <span class="collection-cabinet__line">
            <span class="collection-cabinet__mark" aria-hidden="true">{{ cell.mark }}</span>
            <span class="collection-cabinet__name">{{ cell.name }}</span>
            <span class="collection-cabinet__reading tabular"
              >{{ cell.known }}/{{ cell.total }}</span
            >
          </span>
          <span class="collection-cabinet__track" aria-hidden="true">
            <span :style="{ width: `${cell.ratio * 100}%` }" />
          </span>
          <span class="collection-cabinet__status tabular">
            <template v-if="cell.newCount > 0">新 {{ cell.newCount }}</template>
            <template v-else-if="cell.complete">尽收</template>
            <template v-else-if="cell.known === 0">未启</template>
            <template v-else>余 {{ cell.remaining }}</template>
          </span>
        </button>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import InkScene from "@/components/common/InkScene.vue";
import { sceneTerrainOfCollection } from "@/ui/sceneTerrain";

interface CabinetCell {
  key: string;
  name: string;
  mark: string;
  known: number;
  total: number;
  ratio: number;
  remaining: number;
  complete: boolean;
  newCount: number;
  knownStart: number;
  knownShown: number;
  knownTotal: number;
}

defineProps<{
  cells: readonly CabinetCell[];
  selectedKey: string | null;
  achievementDone: number;
  achievementTotal: number;
  collectionKnown: number;
  collectionTotal: number;
}>();

const emit = defineEmits<{
  select: [key: string];
}>();
</script>

<style scoped>
.collection-cabinet {
  position: relative;
  display: grid;
  width: 100%;
  min-width: 0;
  gap: 0.42rem;
  border: 0;
  border-block: 1px solid rgb(var(--color-ink-rgb) / 0.11);
  background: transparent;
  padding: 0.5rem 0 0.62rem;
}

.collection-cabinet__head {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.14rem 0.7rem;
}

.collection-cabinet__title {
  color: rgb(var(--color-ink-soft-rgb));
  font-family: var(--font-kai);
  font-size: var(--type-title);
  letter-spacing: 0.15em;
  line-height: 1.35;
}

.collection-cabinet__hint {
  order: 3;
  flex: 1 1 12rem;
  color: rgb(var(--color-ink-faint-rgb));
  font-size: var(--type-note);
  line-height: 1.5;
}

.collection-cabinet__totals {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.18rem 0.58rem;
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

.collection-cabinet__wall {
  display: grid;
  min-width: 0;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border-bottom: 1px solid rgb(var(--color-ink-rgb) / 0.07);
}

.collection-cabinet__drawer {
  min-width: 0;
  border: 0;
  border-top: 1px solid rgb(var(--color-ink-rgb) / 0.09);
  border-left: 1px solid rgb(var(--color-ink-rgb) / 0.09);
  background: transparent;
}

.collection-cabinet__drawer:nth-child(-n + 3) {
  border-top: 0;
}

.collection-cabinet__drawer:nth-child(3n + 1) {
  border-left: 0;
}

.collection-cabinet__drawer.is-open {
  background:
    linear-gradient(90deg, rgb(var(--color-cinnabar-rgb) / 0.045), transparent 44%),
    rgb(var(--color-paper-lifted-rgb) / 0.38);
  box-shadow: inset 0 -2px rgb(var(--color-cinnabar-rgb) / 0.5);
}

.collection-cabinet__button {
  display: grid;
  width: 100%;
  min-width: 0;
  min-height: 6.6rem;
  grid-template-rows: auto auto 1px auto;
  align-content: center;
  gap: 0.28rem;
  padding: 0.52rem 0.5rem 0.48rem;
  text-align: left;
  transition:
    background-color 0.15s ease,
    box-shadow 0.15s ease;
}

.collection-cabinet__handle {
  display: grid;
  width: 1.35rem;
  height: 0.48rem;
  place-items: center;
  border: 1px solid rgb(var(--color-ink-rgb) / 0.16);
  background: rgb(var(--color-paper-rgb) / 0.46);
}

.collection-cabinet__handle > span {
  width: 0.58rem;
  height: 1px;
  background: rgb(var(--color-ink-rgb) / 0.38);
}

.collection-cabinet__drawer.is-open .collection-cabinet__handle {
  border-color: rgb(var(--color-cinnabar-rgb) / 0.38);
}

.collection-cabinet__drawer.is-open .collection-cabinet__handle > span {
  background: rgb(var(--color-cinnabar-rgb) / 0.72);
}

.collection-cabinet__line {
  display: grid;
  min-width: 0;
  grid-template-columns: 1.55rem minmax(0, 1fr) auto;
  align-items: baseline;
  gap: 0.28rem;
}

.collection-cabinet__mark {
  color: rgb(var(--color-ink-faint-rgb));
  font-family: var(--font-kai);
  font-size: var(--type-title);
  line-height: 1;
}

.collection-cabinet__drawer.is-lit .collection-cabinet__mark {
  color: rgb(var(--color-qing-rgb));
}

.collection-cabinet__drawer.is-complete .collection-cabinet__mark {
  color: rgb(var(--color-jade-rgb));
}

.collection-cabinet__drawer.is-new .collection-cabinet__mark {
  color: rgb(var(--color-cinnabar-rgb));
}

.collection-cabinet__name {
  min-width: 0;
  overflow: hidden;
  color: rgb(var(--color-ink-rgb));
  font-family: var(--font-kai);
  font-size: var(--type-note);
  letter-spacing: 0.05em;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.collection-cabinet__reading {
  color: rgb(var(--color-ink-faint-rgb));
  font-size: var(--type-note);
  line-height: 1.2;
  white-space: nowrap;
}

.collection-cabinet__track {
  width: 100%;
  height: 1px;
  overflow: hidden;
  background: rgb(var(--color-ink-rgb) / 0.08);
}

.collection-cabinet__track > span {
  display: block;
  height: 100%;
  background: rgb(var(--color-qing-rgb) / 0.56);
}

.collection-cabinet__drawer.is-complete .collection-cabinet__track > span {
  background: rgb(var(--color-jade-rgb) / 0.68);
}

.collection-cabinet__drawer.is-new .collection-cabinet__track > span {
  background: rgb(var(--color-cinnabar-rgb) / 0.68);
}

.collection-cabinet__status {
  min-height: 1.1rem;
  color: rgb(var(--color-ink-faint-rgb));
  font-size: var(--type-note);
  line-height: 1.35;
}

.collection-cabinet__drawer.is-new .collection-cabinet__status {
  color: rgb(var(--color-cinnabar-rgb));
}

.collection-cabinet__drawer.is-complete .collection-cabinet__status {
  color: rgb(var(--color-jade-rgb));
}

.collection-cabinet__drawer.is-open .collection-cabinet__status {
  color: rgb(var(--color-cinnabar-rgb));
}

@media (max-width: 430px) {
  .collection-cabinet__line {
    grid-template-columns: 1.35rem minmax(0, 1fr);
  }

  .collection-cabinet__reading {
    grid-column: 2;
  }
}

@media (max-width: 240px) {
  .collection-cabinet__head {
    align-items: flex-start;
    flex-direction: column;
  }

  .collection-cabinet__totals {
    width: 100%;
    justify-content: space-between;
  }

  .collection-cabinet__wall {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .collection-cabinet__drawer {
    border-top: 1px solid rgb(var(--color-ink-rgb) / 0.09);
    border-left: 1px solid rgb(var(--color-ink-rgb) / 0.09);
  }

  .collection-cabinet__drawer:nth-child(2n + 1) {
    border-left: 0;
  }

  .collection-cabinet__drawer:nth-child(-n + 2) {
    border-top: 0;
  }

  .collection-cabinet__button {
    min-height: 5.8rem;
    padding-inline: 0.42rem;
  }

  .collection-cabinet__line {
    grid-template-columns: 1.35rem minmax(0, 1fr);
  }

  .collection-cabinet__reading {
    grid-column: 2;
  }
}
</style>
