<template>
  <BaseModal :open="open" title="玄枢图" wide @close="emit('close')">
    <div data-nav-atlas class="space-y-4">
      <!-- 当前落点:先回答「我在哪一册」,再展开全部入口。 -->
      <div
        class="atlas-current relative overflow-hidden border border-ink/15 bg-paper-deep/60 px-3 py-3"
      >
        <span
          class="pointer-events-none absolute -right-5 -top-6 h-20 w-20 rounded-full border border-cinnabar/10 bg-cinnabar/6"
          aria-hidden="true"
        />
        <div class="relative">
          <p class="text-[10px] tracking-[0.3em] text-cinnabar">此刻在册</p>
          <p class="mt-1 font-kai text-[15px] tracking-[0.18em] text-ink">
            {{ current?.sectionLabel ?? "玄枢" }} · {{ current?.label ?? "未名之页" }}
          </p>
          <p class="mt-1 text-[10px] text-ink-faint">
            {{ player.name }} · {{ player.realmName }} · {{ player.worldName }}
          </p>
        </div>
      </div>

      <section v-for="group in NAVIGATION_SECTIONS" :key="group.id">
        <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span class="font-kai text-[14px] tracking-[0.25em] text-ink">{{ group.label }}</span>
          <span class="text-[10px] text-ink-faint">{{ group.hint }}</span>
          <span class="h-px min-w-1 flex-1 bg-gradient-to-r from-ink/15 to-transparent" />
        </div>

        <div class="mt-2 grid grid-cols-2 gap-2 tinylens:grid-cols-1">
          <RouterLink
            v-for="entry in group.entries"
            :key="entry.name"
            :to="entry.to"
            data-atlas-entry
            class="atlas-entry group relative flex min-h-[58px] items-start gap-2.5 border border-ink/15 bg-paper/70 px-2.5 py-2.5 text-left transition-[transform,background-color,border-color] active:scale-98"
            :class="
              route.name === entry.name
                ? 'border-cinnabar/45 bg-cinnabar/6'
                : 'hoverable:hover:border-ink/25 hoverable:hover:bg-paper-deep/70'
            "
            @click="emit('close')"
          >
            <span
              class="mt-0.5 grid h-7 w-7 shrink-0 place-items-center border"
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
              class="mt-0.5 shrink-0 font-kai text-[10px] text-cinnabar"
              aria-hidden="true"
              >在</span
            >
          </RouterLink>
        </div>
      </section>

      <p class="border-t border-ink/10 pt-2 text-center text-[10px] text-ink-faint">
        {{ NAVIGATION_SECTIONS.length }} 卷 {{ NAVIGATION_ENTRIES.length }} 册 · 点一册即可前往
      </p>
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
</script>
