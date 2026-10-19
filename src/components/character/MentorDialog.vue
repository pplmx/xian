<template>
  <!-- 师承弹窗:拜师 / 师尊评价
      (Phase 31 S1:四种师承理念,拜后不改,转世保留,纯叙事反馈)
      —— 自 CharacterView 迁入 -->
  <BaseModal
    :open="open"
    :title="mentorVer ? `师承 · ${mentorVer.mentor?.name ?? ''}` : '拜师'"
    @close="emit('close')"
  >
    <div v-if="mentorVer" class="space-y-3">
      <p class="font-kai text-[14px] text-ink">{{ mentorVer.mentor?.master }}</p>
      <p class="t-body text-ink-soft">「{{ mentorVer.line }}」</p>
      <!--
        契合度:已拜视图里唯一的动态量。从前是 11px 小字里夹一个数 —— 玩家行为变了,
        这一屏唯一会变的东西却排在引文下面当注脚。提成独立一行:数值放大 + 档位词,
        让「现在我合不合师门」一眼可读(档位阈值与染色同源,不许第二把尺)。
      -->
      <div class="flex items-baseline justify-between rounded-md bg-paper-deep/60 px-3 py-2">
        <span class="text-[11px] text-ink-soft">契合度</span>
        <span class="flex items-baseline gap-1.5">
          <span
            class="font-kai text-[15px] tabular"
            :class="
              mentorVer.affinity > 0.2
                ? 'text-jade'
                : mentorVer.affinity < -0.2
                  ? 'text-cinnabar'
                  : 'text-ink-soft'
            "
          >
            {{ mentorVer.affinity.toFixed(2) }}
          </span>
          <span
            class="text-[10px]"
            :class="
              mentorVer.affinity > 0.2
                ? 'text-jade'
                : mentorVer.affinity < -0.2
                  ? 'text-cinnabar'
                  : 'text-ink-faint'
            "
          >
            {{ mentorVer.affinity > 0.2 ? "相合" : mentorVer.affinity < -0.2 ? "相悖" : "平平" }}
          </span>
        </span>
      </div>
      <p class="t-body text-ink-faint">
        师承词条(并入终局属性):{{ modsText(mentorVer.mentor?.mods ?? {}) || "—" }}
      </p>
    </div>
    <div v-else class="space-y-2.5">
      <p class="t-body text-ink-faint">
        师承是凡界修行者给你的"额外成长思想"。拜入师门,获一条方向性词条;行为与师承相合,师尊自有嘉许,不设惩罚。
      </p>
      <!--
        四张拜师卡要能**并着读**。

        拜师是跨世保留的永久抉择(按下之后不改),而这四张卡的门道全在词条上。
        原先每张只剩一句「攻击 +15% · 气血 +10%」—— 四个师门的项数与字面长短都不同,
        四句话在卡里各落各的位置,想比「谁加攻击多」得来回扫两遍。

        改成:名号行 → 一句门风 → **词条逐项成芯片、同项同序**。项数多的卡自然长一点,
        但第一项永远在第一行,眼睛可以直着往下比。
      -->
      <button
        v-for="m in mentorChoices()"
        :key="m!.id"
        class="w-full rounded-lg border px-3 py-2.5 text-left transition-[transform,background-color] active:scale-98"
        :class="hintMentor === m!.id ? 'border-cinnabar/60 bg-cinnabar/5' : 'border-ink/20'"
        @click="player.adoptMentor(m!.id)"
      >
        <p class="flex items-baseline gap-2">
          <span class="font-kai text-[14px] text-ink">{{ m!.name }}</span>
          <span class="text-[11px] text-qing">{{ m!.title }}</span>
          <span
            v-if="hintMentor === m!.id"
            class="chip-ink border-cinnabar/50 text-[10px] text-cinnabar"
            >机缘引荐</span
          >
          <span class="ml-auto text-[10px] text-ink-faint">{{ m!.master }}</span>
        </p>
        <p class="mt-0.5 t-body text-ink-faint">{{ m!.desc }}</p>
        <!-- 词条逐项成芯片:数额在右、等宽数字,同一项在四张卡里总在同一列 -->
        <div class="mt-1.5 flex flex-wrap gap-1">
          <span
            v-for="p in modsPills(m!.mods)"
            :key="p.name"
            class="chip-ink gap-1 border-qing/40 !py-0.5 text-[10px] text-ink-soft"
          >
            {{ p.name }}
            <span class="tabular text-qing">{{ p.value }}</span>
          </span>
        </div>
      </button>
    </div>
    <template #footer>
      <button class="btn-seal w-full" @click="emit('close')">知道了</button>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { usePlayerStore } from "@/stores/player";
import { mentorVerdict, mentorChoices } from "@/core/mentorService";
import { mentorHint } from "@/core/fortuneChain";
import { modsPills, modsText } from "@/data/statNames";
import BaseModal from "@/components/common/BaseModal.vue";

/**
 * 师承弹窗(自 CharacterView 迁入)。
 *
 * mentorVer 在宿主与本组件各算一份:它是对 mentorVerdict(player.mentor)的
 * 一行纯投影(宿主入口卡的「求教/拜师」与副行要读它,弹窗正文也要读),
 * 调用同一个 core 函数,无逻辑漂移面。hintMentor(机缘引荐)只有弹窗用,
 * 随迁。
 */
const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const player = usePlayerStore();
const mentorVer = computed(() => mentorVerdict(player.mentor));
// Phase 31.1 机缘链:机缘取/弃记忆 → 师承推荐
const hintMentor = computed(() => mentorHint());
</script>
