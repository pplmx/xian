<template>
  <!-- 突破成功:全屏墨色冲击波(与弹窗同现,荡开即散) -->
  <Teleport to="body">
    <div v-if="view?.success" class="ink-wave" />
  </Teleport>
  <BaseModal :open="view !== null" :closable="false" aria-label="突破结果">
    <div v-if="view" class="text-center">
      <!-- 印心:成功时朱砂墨点迸溅、金环荡开 -->
      <div class="relative mx-auto mt-2 h-20 w-20">
        <div v-if="view.success" class="ink-burst">
          <span v-for="i in 10" :key="i" />
        </div>
        <span v-if="view.success" class="burst-ring" />
        <!--
          大境之槛的那道光环 —— 同一个 burst-ring 加大加慢,不新造动效。
          十次突破里只有一次真换了重天;从前它与小层在视觉上几乎一样,
          只多一个「大 境」小章。金=里程碑赏,与那枚金章同一色。
        -->
        <span
          v-if="view.success && view.isMajor"
          class="burst-ring burst-ring--major"
          data-breakthrough-major-halo
        />
        <div
          class="grid h-20 w-20 place-items-center rounded-full border-2 font-kai text-4xl animate-ink-pop"
          :class="
            view.success
              ? 'border-cinnabar text-cinnabar bg-cinnabar/5 animate-glow-pulse'
              : 'border-ink-faint text-ink-faint bg-ink/5'
          "
        >
          {{ view.success ? "破" : "滞" }}
        </div>
      </div>
      <p class="mt-3 font-kai text-section tracking-[0.3em] text-ink">
        {{ view.success ? "突破成功" : "突破失败" }}
      </p>
      <!--
        大境之槛:一境一次的里程碑,与每层小推进共用同一枚「破」印还不够 ——
        天劫既渡,这声该更重。金色「大境」章钉在印下(金=里程碑赏,不动破印本体)。
      -->
      <p
        v-if="view.success && view.isMajor"
        class="mx-auto mt-1.5 w-fit animate-ink-pop rounded-[2px] border border-gold-ink/60 bg-gold-ink/6 px-2 py-0.5 font-kai text-body tracking-[0.3em] text-gold-ink"
      >
        大 境
      </p>
      <p class="mt-1 text-title text-ink-soft">
        {{ view.fromLabel }}
        <span class="mx-1 text-ink-faint">→</span>
        <span :class="view.success ? 'text-cinnabar font-kai' : 'text-ink-faint'">{{
          view.toLabel
        }}</span>
      </p>
      <div
        v-if="view.tribulationLog.length"
        class="scroll-pane mt-3 max-h-40 overflow-y-auto rounded-[2px] bg-ink/4 px-3 py-2 text-left"
      >
        <p v-for="(line, i) in view.tribulationLog" :key="i" class="py-0.5 t-body text-ink-soft">
          {{ line }}
        </p>
      </div>
      <p class="mt-3 t-body text-ink-faint">{{ view.message }}</p>
      <!--
        失败之后那一步(见 core/breakthrough 的 nextStep)。
        安慰话说完还不够 —— 那一刻有三件事同时变了:准备加成被消费掉、挂上伤势、
        修为掉一截,而这一屏是全屏的,遮住了修行页上那些准备按钮。
        用石青(信息色)而不是朱砂:它是"接下来怎么做",不是又一条警示。
      -->
      <p
        v-if="view.nextStep"
        class="breakthrough-next mt-2 t-body text-qing"
        data-breakthrough-next
      >
        {{ view.nextStep }}
      </p>
    </div>
    <template #footer>
      <button class="btn-seal w-full" @click="close">
        {{ view?.success ? "继续问道" : "收拾心情" }}
      </button>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useUiStore } from "@/stores/ui";
import BaseModal from "@/components/common/BaseModal.vue";

const ui = useUiStore();

const view = computed(() => ui.breakthrough);

function close(): void {
  ui.breakthrough = null;
}
</script>
