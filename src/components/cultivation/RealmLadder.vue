<script setup lang="ts">
/**
 * 仙路 21 境刻度 —— 修炼页的一线全景:已至的点墨、当前境脉动、未至的虚待;
 * 界首立界门,四界名各钉在自己那段的正中央。
 */
import { computed } from "vue";
import { realmLadderPoints, realmLadderWorlds } from "@/core/realmLadder";

const props = defineProps<{ major: number }>();

const points = computed(() => realmLadderPoints(props.major));
const worlds = computed(() => realmLadderWorlds());
</script>

<template>
  <div>
    <!-- 21 境刻度:每格均布,界首处立一道界门 -->
    <div class="flex items-center" role="list" aria-label="仙路 21 境">
      <template v-for="(p, i) in points" :key="p.index">
        <span
          v-if="p.worldStart && i > 0"
          class="mx-0.5 h-3 w-px shrink-0 bg-ink/20"
          aria-hidden="true"
        />
        <span class="flex min-w-0 flex-1 justify-center">
          <span
            role="listitem"
            class="realm-dot"
            :class="
              p.state === 'done'
                ? 'bg-jade/70'
                : p.state === 'now'
                  ? 'animate-breathe bg-cinnabar ring-2 ring-cinnabar/25'
                  : 'border border-ink/25 bg-transparent'
            "
            :title="p.name"
            :aria-label="p.name"
          />
        </span>
      </template>
    </div>

    <!-- 界段名:各钉在自己那段的正中央 -->
    <p class="relative mt-1 h-3 text-[9px] leading-none text-ink-faint">
      <span
        v-for="w in worlds"
        :key="w.id"
        class="absolute -translate-x-1/2 whitespace-nowrap"
        :style="{ left: `${w.centerPct}%` }"
        >{{ w.name }}</span
      >
    </p>
  </div>
</template>

<style scoped>
/* 三态点共享的底座:固定 8px,不被 flex 拉伸 */
.realm-dot {
  height: 8px;
  width: 8px;
  border-radius: 999px;
  flex-shrink: 0;
  transition: background-color 0.3s ease;
}
</style>
