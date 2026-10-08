<template>
  <!-- 秘境:一次性内容,出则散。凡境册元婴起(灵石),天界册真仙起(道源) -->
  <section v-if="unlocked" class="card-ink px-4 py-3">
    <p class="flex items-center gap-2">
      <span class="font-kai text-[14px] tracking-[0.2em] text-ink">秘境</span>
      <span class="chip-ink !text-[9px]"
        >{{ gate === "celestial" ? "天界秘境" : "凡境秘境" }} · {{ cnNumber(SECRET_LAYERS) }}层 ·
        出则散</span
      >
      <span v-if="state" class="ml-auto text-[10px] tabular text-gold-ink"
        >第 {{ state.layer }}/{{ SECRET_LAYERS }} 层</span
      >
    </p>

    <!-- 在境中 -->
    <template v-if="state">
      <p class="mt-1.5 text-[11px] leading-relaxed text-ink-soft">
        {{ def?.name }} · {{ def?.desc }}
      </p>
      <p class="mt-1 text-[10px] leading-relaxed text-violet-ink">
        此地规则:{{ state.rules.join(" · ") }}
      </p>
      <p
        v-if="state.spoils.length"
        class="mt-1 max-h-24 overflow-y-auto text-[10px] leading-relaxed text-ink-faint"
      >
        <span v-for="(s, i) in state.spoils" :key="i" class="block">· {{ s }}</span>
      </p>
      <!-- 战前预览:与实战同源 —— 敌人/胜算(secretLayerPreview)本层即准,「所见即所打」 -->
      <p v-if="preview" class="mt-1 whitespace-nowrap text-[10px] leading-relaxed text-ink-soft">
        <template v-if="preview.foe">
          本层劫:<span class="text-ink">{{ preview.foe.name }}</span>
          <span :class="preview.rate < 0.35 ? 'text-cinnabar' : 'text-ink'"
            >· {{ preview.winText }}</span
          >
        </template>
        <template v-else>本层劫:<span class="text-ink">莫测</span></template>
        · 战利:灵石 +{{ formatGN(preview.reward.stone) }} · 灵草 +{{ preview.reward.material }}
      </p>
      <div class="mt-2 flex gap-2">
        <button class="btn-seal flex-1 !py-1.5 !text-[12px]" @click="fight">再 入 一 层</button>
        <button class="btn-ghost flex-1 !py-1.5 !text-[12px]" @click="abandonRealm()">
          出 秘 境
        </button>
      </div>
    </template>

    <!-- 未入:择一处 -->
    <template v-else>
      <div class="mt-2 space-y-1.5">
        <button
          v-for="r in list"
          :key="r.id"
          class="w-full rounded-md bg-paper-deep/60 px-3 py-2 text-left active:scale-99"
          :class="{ 'disabled:opacity-40': !canPay(r) }"
          :disabled="!canPay(r)"
          @click="enter(r.id)"
        >
          <span class="flex items-baseline gap-2">
            <span class="font-kai text-[13px] text-ink">{{ r.name }}</span>
            <!-- 付不起就报差(与聚气丹/建筑/法宝同款):一盏灰灯不说差多少等于没说完 -->
            <span
              class="text-[10px] tabular"
              :class="canPay(r) ? 'text-ink-faint' : 'text-cinnabar'"
            >
              {{ payText(r) }}
            </span>
            <span class="ml-auto text-[10px] text-qing">入 境 →</span>
          </span>
          <span class="mt-0.5 block text-[10px] leading-relaxed text-ink-faint">{{ r.desc }}</span>
        </button>
        <p v-if="list.length === 0" class="text-[11px] text-ink-faint">
          {{
            gate === "celestial"
              ? "尚无天界秘境可探 ── 天界册真仙起,自有去处。"
              : "尚无凡境秘境可探 ── 凡境册元婴起,自有去处。"
          }}
        </p>
      </div>
    </template>
  </section>

  <!-- 未解锁:inert 占位(仿天界「未至真仙」)—— 灰注开启境界,不可点、不进焦点 -->
  <section
    v-else
    aria-hidden="true"
    class="card-ink pointer-events-none select-none px-4 py-3 opacity-60"
  >
    <p class="flex items-center gap-2">
      <span class="font-kai text-[14px] tracking-[0.2em] text-ink">秘境</span>
      <span class="chip-ink !text-[9px]">{{ gate === "celestial" ? "天界秘境" : "凡境秘境" }}</span>
    </p>
    <p class="mt-1.5 text-[11px] leading-relaxed text-ink-faint">
      {{ gate === "celestial" ? "天界册 · 真仙起(道源)" : "凡境册 · 元婴起(灵石)" }}
    </p>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { usePlayerStore } from "@/stores/player";
import { useResourcesStore } from "@/stores/resources";
import { useUiStore } from "@/stores/ui";
import { useEndgameStore } from "@/stores/endgame";
import { secretRealmDef, type SecretRealmDef } from "@/data/secretRealms";
import { cnNumber, formatGN } from "@/utils/format";
import { toNum } from "@/utils/gnum";
import {
  SECRET_LAYERS,
  abandonRealm,
  availableRealms,
  currentRealm,
  enterSecretRealm,
  entryCostOf,
  entryCostText,
  fightSecretLayer,
  realmUnlock,
  secretLayerPreview,
} from "@/core/secretRealm";

const player = usePlayerStore();
const resources = useResourcesStore();
const ui = useUiStore();

const props = withDefaults(defineProps<{ gate?: "mortal" | "celestial" }>(), { gate: "mortal" });
const endgame = useEndgameStore();

const unlocked = computed(() => realmUnlock(props.gate));
const state = computed(() => currentRealm());
const list = computed(() => availableRealms(props.gate));
const def = computed<SecretRealmDef | undefined>(() =>
  state.value ? secretRealmDef(state.value.realmId) : undefined,
);
/** 战前预览:本层敌人/胜算/战利(与实战同源,见 secretLayerPreview) */
const preview = computed(() => (state.value ? secretLayerPreview(state.value) : null));

function canPay(r: SecretRealmDef): boolean {
  const c = entryCostOf(r, player.major);
  return c.kind === "stone" ? resources.hasStone(c.stone) : endgame.daoSource >= c.daoSource;
}

/** 行内代价:买得起念全价,付不起换口「尚差 N」(与聚气丹/建筑/法宝同款句式) */
function payText(r: SecretRealmDef): string {
  const c = entryCostOf(r, player.major);
  if (canPay(r)) return entryCostText(r, player.major);
  return c.kind === "stone"
    ? `尚差 ${formatGN(Math.max(0, toNum(c.stone) - toNum(resources.spiritStone)))} 石`
    : `尚差 ${Math.max(0, c.daoSource - endgame.daoSource)} 道源`;
}

function enter(id: string): void {
  const out = enterSecretRealm(id);
  if (!out.ok) {
    ui.toast(out.reason ?? "不得其门而入", "warn");
    return;
  }
  ui.toast("你踏入秘境,身后的路随即合拢", "info");
}

function fight(): void {
  const r = fightSecretLayer();
  if (!r) return;
  // 战报合并为单条多行 toast:逐条 push 会被 toast 位(上限 5)把自己前面的行挤掉,长战报读不全
  if (r.lines.length) ui.toast(r.lines.join("\n"), r.win ? "info" : "warn");
}
</script>
