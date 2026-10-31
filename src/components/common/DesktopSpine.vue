<template>
  <aside data-desktop-spine class="desktop-spine" aria-label="玄枢书脊">
    <div class="desktop-spine__mast">
      <RouterLink to="/" class="desktop-spine__brand" aria-label="回到洞府总览">
        <span class="desktop-spine__seal" aria-hidden="true">
          <span>玄</span>
          <span>枢</span>
        </span>
        <span class="desktop-spine__wordmark">
          <span class="desktop-spine__title">玄枢录</span>
          <span class="desktop-spine__edition">万象归枢</span>
        </span>
      </RouterLink>

      <div class="desktop-spine__identity">
        <span class="desktop-spine__name">{{ player.name }}</span>
        <span class="desktop-spine__realm">{{ player.realmName }}</span>
        <span
          class="desktop-spine__lifespan"
          :class="player.lifespanRatio < LIFESPAN_WARN_RATIO ? 'text-cinnabar' : ''"
        >
          {{ lifespan.age }}/{{ lifespan.max }} 载
        </span>
      </div>

      <button
        type="button"
        data-spine-atlas-trigger
        class="desktop-spine__lookup"
        :aria-label="`打开玄枢图寻册（${shortcutHint}）`"
        aria-haspopup="dialog"
        @click="emit('openAtlas')"
      >
        <span class="desktop-spine__lookup-mark" aria-hidden="true">寻</span>
        <span class="desktop-spine__lookup-copy">
          <span>寻册</span>
          <span class="desktop-spine__lookup-key tabular">{{ shortcutHint }}</span>
        </span>
      </button>
    </div>

    <nav class="desktop-spine__index scroll-pane" aria-label="全站册目">
      <section
        v-for="(group, groupIndex) in NAVIGATION_SECTIONS"
        :key="group.id"
        class="desktop-spine__section"
        :data-spine-section="group.id"
      >
        <div class="desktop-spine__section-head">
          <span class="desktop-spine__section-number" aria-hidden="true">{{
            sectionNumber(groupIndex)
          }}</span>
          <span class="desktop-spine__copy">
            <span class="desktop-spine__section-label">{{ group.label }}</span>
            <span class="desktop-spine__section-hint">{{ group.hint }}</span>
          </span>
        </div>

        <RouterLink
          v-for="entry in group.entries"
          :key="entry.name"
          :to="entry.to"
          class="desktop-spine__entry"
          :data-spine-current="route.name === entry.name ? '' : undefined"
          :title="`${entry.label} · ${entry.description}`"
        >
          <span class="desktop-spine__entry-icon" aria-hidden="true">
            <GameIcon :name="entry.icon" :size="15" />
          </span>
          <span class="desktop-spine__entry-copy">
            <span class="desktop-spine__entry-label">{{ entry.label }}</span>
            <span class="desktop-spine__entry-description">{{ entry.description }}</span>
          </span>
          <span v-if="route.name === entry.name" class="desktop-spine__current" aria-hidden="true"
            >在</span
          >

          <span
            v-if="entry.name === 'inventory' && bagNewCount >= 2"
            class="desktop-spine__badge desktop-spine__badge--count"
            aria-hidden="true"
            >{{ bagNewCount > 9 ? "9+" : bagNewCount }}</span
          >
          <span
            v-else-if="entry.name === 'inventory' && bagNewCount === 1"
            class="desktop-spine__badge"
            aria-hidden="true"
          />
          <span
            v-if="entry.name === 'cultivation' && canBreakthrough"
            class="desktop-spine__badge desktop-spine__badge--ready"
            aria-hidden="true"
          />

          <span v-if="entry.name === 'inventory' && bagNewCount > 0" class="sr-only">
            ({{ bagNewCount }} 件新物)
          </span>
          <span v-if="entry.name === 'cultivation' && canBreakthrough" class="sr-only"
            >(可破境)</span
          >
        </RouterLink>
      </section>
    </nav>

    <footer class="desktop-spine__colophon">
      <span>{{ player.worldName }}</span>
      <span v-if="player.reincarnation.count > 0">{{ player.reincarnation.count }} 世</span>
      <span>{{ NAVIGATION_ENTRIES.length }} 册</span>
    </footer>
  </aside>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { useNavigationSignals } from "@/composables/useNavigationSignals";
import { LIFESPAN_WARN_RATIO } from "@/data/constants";
import { usePlayerStore } from "@/stores/player";
import { cnNumber, lifespanPair } from "@/utils/format";
import { atlasShortcutHintOf } from "@/ui/atlas";
import { NAVIGATION_ENTRIES, NAVIGATION_SECTIONS } from "@/ui/navigation";
import GameIcon from "./GameIcon.vue";

const emit = defineEmits<{ openAtlas: [] }>();
const route = useRoute();
const player = usePlayerStore();
const { bagNewCount, canBreakthrough } = useNavigationSignals();
const lifespan = computed(() => lifespanPair(player.age, player.lifespanMax));
const shortcutHint = atlasShortcutHintOf(
  typeof navigator === "undefined" ? "" : navigator.platform,
);
const sectionNumber = (index: number): string => cnNumber(index + 1);
</script>
