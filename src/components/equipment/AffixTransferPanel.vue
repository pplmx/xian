<script setup lang="ts">
/**
 * 词条转移面板 —— 把当前这件(source)上的一条词条,移到行囊里另一件(target)上。
 *
 * 判据与价签一律来自 core/affixTransfer(planTransfer / transferLandings)与
 * composables/useAffixTransfer(transferCandidates / transferShort / transferAffix):
 * 界面不另写一套「接不接、多少钱」。落位「新增 / 顶替」也按 transferLandings 的
 * 展示序铺开(先常见低值的,可成的在前)。
 */
import { computed, ref, watch } from "vue";
import type { EquipmentInstance } from "@/types";
import { affixDef } from "@/data/affixes";
import { qualityDef } from "@/data/qualities";
import { formatGN } from "@/utils/format";
import { planTransfer, transferLandings, type TransferRequest } from "@/core/affixTransfer";
import { transferAffix, transferCandidates, transferShort } from "@/composables/useAffixTransfer";

const props = defineProps<{ source: EquipmentInstance | null }>();
const emit = defineEmits<{ close: [] }>();

// ---- 选择状态 ----
const affixId = ref<string | null>(null);
const targetUid = ref<string | null>(null);
const replaceId = ref<string | null>(null);
const seal = ref(false);
const done = ref(false);

watch(
  () => props.source?.uid,
  () => {
    affixId.value = null;
    targetUid.value = null;
    replaceId.value = null;
    seal.value = false;
    done.value = false;
  },
);

const source = computed(() => props.source);
const candidates = computed(() =>
  source.value && affixId.value ? transferCandidates(source.value, affixId.value) : [],
);
const target = computed(
  () => candidates.value.find((c) => c.item.uid === targetUid.value)?.item ?? null,
);
/** 落位:新增在最前,其后是目标词条按展示序倒排 */
const landings = computed(() =>
  source.value && target.value && affixId.value
    ? transferLandings(source.value, target.value, affixId.value)
    : [],
);
const plan = computed(() => {
  if (!source.value || !target.value || !affixId.value) return null;
  const r = planTransfer(source.value, target.value, affixId.value, replaceId.value, seal.value);
  return r.ok ? r.plan : null;
});
const short = computed(() => (plan.value ? transferShort(plan.value.cost) : null));
const affordable = computed(() => short.value === null && plan.value !== null);

function pick(id: string): void {
  affixId.value = id;
  targetUid.value = null;
  replaceId.value = null;
  seal.value = false;
}

function doTransfer(): void {
  if (!source.value || !target.value || !affixId.value || !plan.value) return;
  const req: TransferRequest = {
    sourceUid: source.value.uid,
    targetUid: target.value.uid,
    affixId: affixId.value,
    replaceId: replaceId.value,
    seal: seal.value,
  };
  if (transferAffix(req)) done.value = true;
}
</script>

<template>
  <div class="rounded-lg border border-ink/10 bg-paper-deep/60 p-3 text-[12px]">
    <div class="mb-2 flex items-center gap-2">
      <span class="font-medium text-ink">词条转移</span>
      <span class="text-[10px] text-ink-faint">抽走源件一条词条,落到另一件上;源件保留</span>
      <button class="btn-ghost ml-auto !px-2 !py-0.5 text-[11px]" @click="emit('close')">
        收起
      </button>
    </div>

    <p v-if="done" class="py-3 text-center text-ink-success">词条已易地而至</p>

    <template v-else-if="!source">
      <p class="text-ink-faint">这件装备已不在行囊,无法转移。</p>
    </template>

    <template v-else>
      <!-- 选源件词条 -->
      <div class="mb-2">
        <p class="mb-1 text-[10px] text-ink-faint">抽哪一条?点选源件词条</p>
        <div class="flex flex-wrap gap-1">
          <button
            v-for="a in source.affixes"
            :key="a.id"
            class="btn-ghost !px-2 text-[11px]"
            :class="affixId === a.id ? '!border-accent !text-accent' : ''"
            @click="pick(a.id)"
          >
            {{ affixDef(a.id)?.name ?? a.id }}
          </button>
        </div>
      </div>

      <!-- 选目标件 -->
      <div v-if="affixId" class="mb-2">
        <p class="mb-1 text-[10px] text-ink-faint">落到哪一件?</p>
        <div class="max-h-24 space-y-1 overflow-y-auto">
          <button
            v-for="c in candidates"
            :key="c.item.uid"
            class="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[11px]"
            :class="
              c.block
                ? 'cursor-not-allowed text-ink-faint'
                : targetUid === c.item.uid
                  ? 'bg-accent/10 text-accent'
                  : 'hover:bg-ink/5'
            "
            :disabled="c.block !== null"
            @click="
              targetUid = c.item.uid;
              replaceId = null;
            "
          >
            <span>{{ affixDef(affixId)?.name ?? affixId }} →</span>
            <span>{{ c.item.quality }}·{{ c.item.tier }} 阶</span>
            <span class="ml-auto">
              {{ c.worn ? "已装备" : "" }}
              {{ c.block === "dup" ? "已有更高" : c.block === "rank" ? "品质不够" : "" }}
            </span>
          </button>
        </div>
      </div>

      <!-- 选落位 -->
      <div v-if="target && landings.length" class="mb-2">
        <p class="mb-1 text-[10px] text-ink-faint">
          落在哪里?({{ target.affixes.length }} / {{ qualityDef(target.quality).affixes[1] }} 条)
        </p>
        <div class="space-y-1">
          <button
            v-for="l in landings"
            :key="l.replaceId ?? '__new__'"
            class="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[11px]"
            :class="l.check.ok ? 'hover:bg-ink/5' : 'cursor-not-allowed text-ink-faint'"
            :disabled="!l.check.ok"
            @click="
              replaceId = l.replaceId;
              seal = false;
            "
          >
            <span>{{
              l.replaceId === null
                ? "新增一条"
                : `顶替「${affixDef(l.replaceId!)?.name ?? l.replaceId}」`
            }}</span>
            <span v-if="!l.check.ok" class="ml-auto">{{ l.check.ok ? "" : "不可" }}</span>
            <span v-else class="ml-auto opacity-70">
              <template v-if="l.check.ok">
                <span v-if="replaceId === l.replaceId" class="text-accent">✓ 选中</span>
                <span v-else></span>
              </template>
            </span>
          </button>
        </div>
      </div>

      <!-- 同时封存 + 确认 -->
      <div v-if="plan" class="flex flex-wrap items-center gap-2 border-t border-ink/10 pt-2">
        <label class="flex items-center gap-1.5 text-[11px]">
          <input v-model="seal" type="checkbox" :disabled="!plan.canSeal" />
          同时封存(重铸不移)
        </label>
        <span class="ml-auto text-[11px]">
          <span v-if="affordable">
            器灵尘×{{ plan.cost.dust }} · 灵石
            {{ formatGN(plan.cost.stone) }}
            <span v-if="plan.cost.sealStone">(含封存 {{ formatGN(plan.cost.sealStone) }})</span>
          </span>
          <span v-else-if="short === 'stone'" class="text-ink-warn">灵石不足</span>
          <span v-else-if="short === 'dust'" class="text-ink-warn">器灵尘不足</span>
          <span v-else class="text-ink-faint">任选一处落位</span>
        </span>
        <button
          class="btn-seal !px-3 !py-1 text-[11px]"
          :disabled="!affordable"
          @click="doTransfer"
        >
          转移
        </button>
      </div>
    </template>
  </div>
</template>
