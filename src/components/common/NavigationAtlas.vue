<template>
  <BaseModal :open="open" title="玄枢图" wide @close="emit('close')">
    <div data-nav-atlas class="space-y-3">
      <!-- 当前落点:一枚「在」印压在册口,先回答「我在哪一册」。 -->
      <div
        class="atlas-current relative overflow-hidden border border-ink/15 bg-paper-deep/60 py-3 pl-14 pr-3"
      >
        <span
          class="atlas-current__seal absolute inset-y-3 left-3 grid w-8 place-items-center border border-cinnabar/45 bg-cinnabar/6 font-kai text-[14px] text-cinnabar"
          aria-hidden="true"
          >在</span
        >
        <span
          class="pointer-events-none absolute -right-5 -top-6 h-20 w-20 rounded-full border border-cinnabar/10 bg-cinnabar/6"
          aria-hidden="true"
        />
        <div class="relative min-w-0">
          <p class="text-[10px] tracking-[0.3em] text-cinnabar">此刻在册 · {{ currentOrdinal }}</p>
          <p class="mt-1 font-kai text-[15px] tracking-[0.18em] text-ink">
            {{ current?.sectionLabel ?? "玄枢" }} · {{ current?.label ?? "未名之页" }}
          </p>
          <p class="mt-1 text-[10px] text-ink-faint">
            {{ player.name }} · {{ player.realmName }} · {{ player.worldName }}
          </p>
        </div>
      </div>

      <div class="atlas-index">
        <section
          v-for="(group, groupIndex) in NAVIGATION_SECTIONS"
          :key="group.id"
          class="atlas-section"
          :data-atlas-section="group.id"
        >
          <div class="flex items-start gap-2">
            <span
              class="atlas-section__number grid h-6 w-6 shrink-0 place-items-center border border-ink/20 font-kai text-[11px] text-ink-soft"
              aria-hidden="true"
              >{{ sectionNumber(groupIndex) }}</span
            >
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span class="font-kai text-[14px] tracking-[0.25em] text-ink">{{
                  group.label
                }}</span>
                <span class="text-[10px] text-ink-faint">{{ group.hint }}</span>
              </div>
              <span
                class="mt-1 block h-px w-full bg-gradient-to-r from-ink/15 to-transparent"
                aria-hidden="true"
              />
            </div>
          </div>

          <div class="atlas-entry-list mt-1.5 border-t border-ink/10">
            <RouterLink
              v-for="entry in group.entries"
              :key="entry.name"
              :to="entry.to"
              data-atlas-entry
              class="atlas-entry group relative flex min-h-[48px] items-center gap-2.5 border-b border-ink/10 px-1.5 py-2 text-left transition-[transform,background-color,color] active:scale-99"
              :class="
                route.name === entry.name
                  ? 'bg-cinnabar/6 text-cinnabar'
                  : 'text-ink hoverable:hover:bg-paper-deep/55'
              "
              :data-atlas-current="route.name === entry.name ? '' : undefined"
              @click="emit('close')"
            >
              <span
                class="grid h-8 w-8 shrink-0 place-items-center border"
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
                  class="block font-kai text-[14px] tracking-[0.16em]"
                  :class="route.name === entry.name ? 'text-cinnabar' : 'text-ink'"
                  >{{ entry.label }}</span
                >
                <span class="mt-0.5 block text-[10px] leading-relaxed text-ink-faint">{{
                  entry.description
                }}</span>
              </span>
              <span
                v-if="route.name === entry.name"
                class="shrink-0 border border-cinnabar/40 px-1 py-0.5 font-kai text-[10px] leading-none text-cinnabar"
                aria-hidden="true"
                >在</span
              >
              <span v-else class="shrink-0 text-[11px] text-ink-faint" aria-hidden="true">›</span>
            </RouterLink>
          </div>
        </section>
      </div>

      <div class="flex items-center gap-2 border-t border-ink/10 pt-2">
        <span class="h-px min-w-1 flex-1 bg-gradient-to-r from-transparent to-ink/15" />
        <p class="shrink-0 text-center text-[10px] text-ink-faint">
          {{ NAVIGATION_SECTIONS.length }} 卷 {{ NAVIGATION_ENTRIES.length }} 册 · 点一册即可前往
        </p>
        <span class="h-px min-w-1 flex-1 bg-gradient-to-l from-transparent to-ink/15" />
      </div>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { usePlayerStore } from "@/stores/player";
import { NAVIGATION_ENTRIES, NAVIGATION_SECTIONS, navigationEntryOf } from "@/ui/navigation";
import BaseModal from "./BaseModal.vue";
import GameIcon from "./GameIcon.vue";

defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const route = useRoute();
const player = usePlayerStore();
const current = computed(() => navigationEntryOf(route.name));
const currentOrdinal = computed(() => {
  const i = NAVIGATION_ENTRIES.findIndex((entry) => entry.name === route.name);
  return i < 0 ? "未入册" : `第 ${String(i + 1).padStart(2, "0")} 册`;
});
const SECTION_NUMERALS = ["一", "二", "三", "四", "五"] as const;
const sectionNumber = (index: number): string => SECTION_NUMERALS[index] ?? String(index + 1);
</script>
