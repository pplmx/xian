<template>
  <BaseModal
    :open="open"
    title="玄枢图"
    size="max"
    initial-focus="[data-atlas-search]"
    @close="emit('close')"
  >
    <div ref="atlasRoot" data-nav-atlas class="space-y-3">
      <section class="atlas-search" aria-labelledby="atlas-search-label">
        <span class="atlas-search__seal" aria-hidden="true">寻</span>
        <div class="atlas-search__field">
          <label id="atlas-search-label" for="atlas-search-input" class="sr-only">
            按册名、分册、用途或旧叫法寻册
          </label>
          <input
            id="atlas-search-input"
            v-model="query"
            data-atlas-search
            class="atlas-search__input text-[16px]"
            type="text"
            autocomplete="off"
            spellcheck="false"
            placeholder="册名、分册或旧叫法，如「人物」「周易」「存档」"
            aria-describedby="atlas-search-status"
            @keydown="onSearchKeydown"
          />
          <p id="atlas-search-status" class="atlas-search__hint">
            <span v-if="searching" aria-live="polite">
              {{
                results.length > 0
                  ? `找到 ${results.length} 处 · ↑↓ 选择，回车前往`
                  : "没有这册 · 换个日常叫法试试"
              }}
            </span>
            <span v-else>旧叫法也能寻；「周易」「灵兽」可直达册内分册</span>
            <span class="atlas-search__key tabular">{{ shortcutHint }}</span>
          </p>
        </div>
        <button
          v-if="query"
          type="button"
          class="atlas-search__clear"
          aria-label="清空寻册条件"
          @click="query = ''"
        >
          清
        </button>
      </section>

      <!-- 当前落点:一枚「在」印压在册口,先回答「我在哪一册」。 -->
      <div
        v-if="!searching"
        class="atlas-current relative overflow-hidden border border-ink/15 bg-paper-deep/60 py-3 pl-14 pr-3"
      >
        <span
          class="atlas-current__seal absolute inset-y-3 left-3 grid w-8 place-items-center border border-cinnabar/45 bg-cinnabar/6 font-kai text-title text-cinnabar"
          aria-hidden="true"
          >在</span
        >
        <span
          class="pointer-events-none absolute -right-5 -top-6 h-20 w-20 rounded-full border border-cinnabar/10 bg-cinnabar/6"
          aria-hidden="true"
        />
        <div class="relative min-w-0">
          <p class="text-note tracking-[0.3em] text-cinnabar">此刻在册 · {{ currentOrdinal }}</p>
          <p class="mt-1 font-kai text-section tracking-[0.18em] text-ink">
            {{ current?.sectionLabel ?? "玄枢" }} · {{ current?.label ?? "未名之页" }}
          </p>
          <p class="mt-1 text-note text-ink-faint">
            {{ player.name }} · {{ player.realmName }} · {{ player.worldName }}
          </p>
        </div>
      </div>

      <!--
        五卷总目:先给一张全站方向图,再进入卷宗。

        十七册若从第一行一路排到末行,玩家得先滚完整座目录才知道「天机卷在哪」。
        这里把五卷压成一排快引,点哪卷就把下方卷宗卷到眼前;所有册目仍完整留在
        DOM 里,不靠隐藏页签省空间,读屏与键盘也能一次读到全站。
      -->
      <section v-if="!searching" class="atlas-compass-shell" aria-labelledby="atlas-compass-title">
        <div class="atlas-compass-head">
          <div class="min-w-0">
            <p id="atlas-compass-title" class="font-kai text-title tracking-[0.22em] text-ink">
              五卷总目
            </p>
            <p class="mt-0.5 text-note leading-relaxed text-ink-faint">点一卷，翻到该卷册页</p>
          </div>
          <span class="atlas-compass-count shrink-0 text-note tabular text-ink-faint">
            {{ NAVIGATION_SECTIONS.length }} 卷 · {{ NAVIGATION_ENTRIES.length }} 册
          </span>
        </div>
        <div data-atlas-compass class="atlas-compass" role="group" aria-label="五卷快引">
          <button
            v-for="(group, groupIndex) in NAVIGATION_SECTIONS"
            :key="group.id"
            type="button"
            class="atlas-volume"
            :data-atlas-volume="group.id"
            :data-atlas-volume-active="activeVolumeId === group.id ? '' : undefined"
            :data-atlas-volume-current="currentVolumeId === group.id ? '' : undefined"
            :aria-controls="`atlas-volume-${group.id}`"
            :aria-label="`翻到${group.label}卷，${group.entries.length}册`"
            @click="jumpToSection(group.id)"
            @keydown="onVolumeKeydown($event, groupIndex)"
          >
            <span class="atlas-volume__number" aria-hidden="true">{{
              sectionNumber(groupIndex)
            }}</span>
            <span
              class="atlas-volume__label tinylens:tracking-[0.06em]"
              :class="activeVolumeId === group.id ? 'text-cinnabar' : 'text-ink'"
              >{{ group.label }}</span
            >
            <span class="atlas-volume__count tabular">{{ group.entries.length }}册</span>
          </button>
        </div>
      </section>

      <div v-if="!searching" class="atlas-index">
        <section
          v-for="(group, groupIndex) in NAVIGATION_SECTIONS"
          :id="`atlas-volume-${group.id}`"
          :key="group.id"
          class="atlas-section"
          :data-atlas-section="group.id"
          :data-atlas-section-current="currentVolumeId === group.id ? '' : undefined"
        >
          <span class="atlas-section__watermark" aria-hidden="true">{{
            group.label.slice(0, 1)
          }}</span>
          <header class="atlas-section__head">
            <span class="atlas-section__number" aria-hidden="true">{{
              sectionNumber(groupIndex)
            }}</span>
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span class="atlas-section__title">{{ group.label }}卷</span>
                <span v-if="currentVolumeId === group.id" class="atlas-section__presence">
                  此刻在卷
                </span>
              </div>
              <p class="atlas-section__hint">{{ group.hint }}</p>
            </div>
            <span class="atlas-section__count shrink-0 tabular">{{ group.entries.length }}册</span>
          </header>

          <div class="atlas-entry-list">
            <RouterLink
              v-for="entry in group.entries"
              :key="entry.name"
              :to="entry.to"
              data-atlas-entry
              class="atlas-entry group relative flex min-h-[50px] items-center gap-2.5 border-b border-ink/10 px-2.5 py-2 text-left transition-[transform,background-color,color] active:scale-99 tinylens:gap-1.5 tinylens:px-1"
              :class="
                route.name === entry.name
                  ? 'bg-cinnabar/6 text-cinnabar'
                  : 'text-ink hoverable:hover:bg-paper-deep/55'
              "
              :data-atlas-current="route.name === entry.name ? '' : undefined"
              @click="emit('close')"
            >
              <span
                class="grid h-8 w-8 shrink-0 place-items-center border tinylens:h-7 tinylens:w-7"
                :class="
                  route.name === entry.name
                    ? 'border-cinnabar/40 text-cinnabar'
                    : 'border-ink/15 text-ink-soft'
                "
              >
                <GameIcon :name="entry.icon" :size="15" />
              </span>
              <span class="min-w-0 flex-1">
                <span
                  class="block font-kai text-title tracking-[0.16em] tinylens:tracking-[0.08em]"
                  :class="route.name === entry.name ? 'text-cinnabar' : 'text-ink'"
                  >{{ entry.label }}</span
                >
                <span class="mt-0.5 block text-note leading-relaxed text-ink-faint">{{
                  entry.description
                }}</span>
              </span>
              <span
                v-if="route.name === entry.name"
                class="shrink-0 border border-cinnabar/40 px-1 py-0.5 font-kai text-note leading-none text-cinnabar"
                aria-hidden="true"
                >在</span
              >
              <span v-else class="shrink-0 text-body text-ink-faint" aria-hidden="true">›</span>
            </RouterLink>
          </div>
        </section>
      </div>

      <section v-else class="atlas-results" aria-labelledby="atlas-results-title">
        <header class="atlas-results__head">
          <div class="min-w-0">
            <p class="text-note tracking-[0.24em] text-cinnabar">寻册所得</p>
            <h4 id="atlas-results-title" class="mt-0.5 font-kai text-title tracking-[0.16em]">
              「{{ query.trim() }}」{{ results.length }} 处
            </h4>
          </div>
          <span class="atlas-results__hint">按玄枢册序排列</span>
        </header>

        <div v-if="results.length" class="atlas-result-list">
          <RouterLink
            v-for="(result, index) in results"
            :key="result.key"
            :to="result.to"
            data-atlas-result
            class="atlas-result"
            :class="{
              'atlas-result--active': index === activeResultIndex,
              'atlas-result--current': isCurrentResult(result),
            }"
            :data-atlas-result-active="index === activeResultIndex ? '' : undefined"
            :data-atlas-result-current="isCurrentResult(result) ? '' : undefined"
            @mouseenter="activeResultIndex = index"
            @click="emit('close')"
          >
            <span class="atlas-result__icon" aria-hidden="true">
              <GameIcon :name="result.entry.icon" :size="15" />
            </span>
            <span class="atlas-result__copy">
              <span class="atlas-result__title">
                {{ result.label }}
                <small
                  >{{ result.entry.sectionLabel }}卷 · {{ result.entry.label
                  }}{{ result.chapter ? " · 分册" : "" }}</small
                >
              </span>
              <span class="atlas-result__description">{{ result.description }}</span>
            </span>
            <span v-if="isCurrentResult(result)" class="atlas-result__current">在</span>
            <span v-else class="atlas-result__arrow" aria-hidden="true">›</span>
          </RouterLink>
        </div>

        <div v-else data-atlas-empty class="atlas-results__empty">
          <span class="atlas-results__empty-mark" aria-hidden="true">空</span>
          <p>玄枢册里没有这个叫法。</p>
          <p>可试：人物、背包、存档；分册可寻「周易」「灵兽」。</p>
          <div class="atlas-results__suggestions" aria-label="寻册建议">
            <button
              v-for="term in SEARCH_SUGGESTIONS"
              :key="term"
              type="button"
              data-atlas-suggestion
              @click="query = term"
            >
              {{ term }}
            </button>
          </div>
        </div>
      </section>

      <div class="flex items-center gap-2 border-t border-ink/10 pt-2">
        <span class="h-px min-w-1 flex-1 bg-gradient-to-r from-transparent to-ink/15" />
        <p class="shrink-0 text-center text-note text-ink-faint">
          {{
            searching
              ? "只读同一份玄枢册目与分册，不另造去处"
              : `${NAVIGATION_SECTIONS.length} 卷 ${NAVIGATION_ENTRIES.length} 册 · 点一册即可前往`
          }}
        </p>
        <span class="h-px min-w-1 flex-1 bg-gradient-to-l from-transparent to-ink/15" />
      </div>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { usePlayerStore } from "@/stores/player";
import { useSettingsStore } from "@/stores/settings";
import { cnNumber } from "@/utils/format";
import {
  atlasJumpIndex,
  atlasSearchResults,
  atlasSectionIdForRoute,
  atlasShortcutHintOf,
  type AtlasSearchResult,
} from "@/ui/atlas";
import { NAVIGATION_ENTRIES, NAVIGATION_SECTIONS, navigationPositionOf } from "@/ui/navigation";
import BaseModal from "./BaseModal.vue";
import GameIcon from "./GameIcon.vue";

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const route = useRoute();
const router = useRouter();
const player = usePlayerStore();
const settings = useSettingsStore();
const atlasRoot = useTemplateRef<HTMLElement>("atlasRoot");
const activeVolumeId = ref(atlasSectionIdForRoute(route.name));
const query = ref("");
const activeResultIndex = ref(0);
const results = computed(() => atlasSearchResults(query.value));
const searching = computed(() => query.value.trim().length > 0);
const shortcutHint = atlasShortcutHintOf(
  typeof navigator === "undefined" ? "" : navigator.platform,
);
const SEARCH_SUGGESTIONS = ["人物", "背包", "存档", "周易", "灵兽", "天机"] as const;

const currentPosition = computed(() => navigationPositionOf(route.name));
const current = computed(() => currentPosition.value?.entry);
const currentVolumeId = computed(
  () => currentPosition.value?.section.id ?? NAVIGATION_SECTIONS[0]!.id,
);
const currentOrdinal = computed(() => {
  const position = currentPosition.value;
  return position
    ? `卷${cnNumber(position.sectionIndex + 1)} · 第 ${String(position.entryIndex + 1).padStart(2, "0")} 册`
    : "未入册";
});
const sectionNumber = (index: number): string => cnNumber(index + 1);

watch(
  () => props.open,
  (open) => {
    if (open) {
      activeVolumeId.value = atlasSectionIdForRoute(route.name);
      query.value = "";
      activeResultIndex.value = 0;
    }
  },
);
watch(
  () => route.name,
  () => {
    activeVolumeId.value = atlasSectionIdForRoute(route.name);
  },
);
watch(results, () => {
  activeResultIndex.value = 0;
});

function focusVolume(index: number): void {
  const buttons = atlasRoot.value?.querySelectorAll<HTMLButtonElement>("[data-atlas-volume]");
  buttons?.[index]?.focus();
}

function isCurrentResult(result: AtlasSearchResult): boolean {
  if (route.name !== result.entry.name) return false;
  if (!result.chapter) return true;
  return typeof route.query.tab === "string" && route.query.tab === result.chapter.id;
}

function onVolumeKeydown(event: KeyboardEvent, index: number): void {
  const next = atlasJumpIndex(index, event.key, NAVIGATION_SECTIONS.length);
  if (next === index) return;
  event.preventDefault();
  focusVolume(next);
}

function jumpToSection(id: string): void {
  activeVolumeId.value = id;
  void nextTick(() => {
    const root = atlasRoot.value;
    const scroller = root?.closest<HTMLElement>("[data-folio-modal-scroll]");
    const section = root?.querySelector<HTMLElement>(`[data-atlas-section="${id}"]`);
    if (!scroller || !section) return;
    const top =
      scroller.scrollTop +
      section.getBoundingClientRect().top -
      scroller.getBoundingClientRect().top -
      8;
    scroller.scrollTo({ top, behavior: settings.reduceMotion ? "auto" : "smooth" });
  });
}

async function moveSearchCursor(delta: number): Promise<void> {
  if (results.value.length === 0) return;
  const count = results.value.length;
  activeResultIndex.value = (activeResultIndex.value + delta + count) % count;
  await nextTick();
  atlasRoot.value
    ?.querySelector<HTMLElement>("[data-atlas-result-active]")
    ?.scrollIntoView({ block: "nearest" });
}

function onSearchKeydown(event: KeyboardEvent): void {
  // 中文输入法选字时的回车/方向键属于组合输入,不能拿来翻册。
  if (event.isComposing) return;
  if (event.key === "ArrowDown") {
    event.preventDefault();
    void moveSearchCursor(1);
    return;
  }
  if (event.key === "ArrowUp") {
    event.preventDefault();
    void moveSearchCursor(-1);
    return;
  }
  if (event.key !== "Enter" || !searching.value) return;
  const target = results.value[activeResultIndex.value];
  if (!target) return;
  event.preventDefault();
  void router.push(target.to);
  emit("close");
}
</script>
