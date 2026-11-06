<template>
  <!-- 突破成功:全屏墨色冲击波(与弹窗同现,荡开即散) -->
  <Teleport to="body">
    <div v-if="view?.success" class="ink-wave" />
  </Teleport>
  <BaseModal :open="view !== null" :closable="false" aria-label="突破结果">
    <div
      v-if="view"
      class="text-center"
      data-breakthrough-result
      :data-breakthrough-outcome="view.success ? (view.isMajor ? 'major' : 'success') : 'fail'"
    >
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
        <!--
          印面 —— 小层印「破」(一世几十次的节拍器),大境印**刚跨过的那一重天**。

          一层一小境、九层一大境,而全作二十一道境界:小突破是节拍器,大境是里程碑。
          里程碑最该说的是「你跨过了哪道门」—— 真仙·圆满 → 玄仙·一层不是
          「五层变一层」,是从真仙这一重天跨进玄仙这一重天。而原先这一屏把它压成了
          同一行箭头字,大境与小层只差一枚 px-2 的金章与一道更粗的光环。

          印不新造:同一枚圆印、同一套朱砂,只换里面的字。境界名从 view.toRealmName 读
          (由 core 造 view 时给),这里不切 toLabel、也不另 import 境界表。
          三字境名(如「太乙玄仙」这类)放不下 4xl,故按字数收一档。
        -->
        <div
          class="grid h-20 w-20 place-items-center rounded-full border-2 font-kai animate-ink-pop"
          :class="[
            view.success
              ? 'border-cinnabar text-cinnabar bg-cinnabar/5 animate-glow-pulse'
              : 'border-ink-faint text-ink-faint bg-ink/5',
            majorSealText.length > 2 ? 'text-title tracking-[0.06em]' : 'text-4xl',
          ]"
          :data-breakthrough-major-seal="view.success && view.isMajor ? majorSealText : undefined"
        >
          {{ majorSealText }}
        </div>
      </div>
      <!--
        标题 —— 小层写「突破成功」(那本来就只是成功,没有门可跨);
        大境写「跨入玄仙」:印里已经印着境界名了,标题再说一句「突破成功」就与印重复,
        而这一屏真正要说的是「你跨过了哪道门」。
      -->
      <p class="mt-3 font-kai text-section tracking-[0.3em] text-ink">
        {{ !view.success ? "突破失败" : view.isMajor ? `跨入${view.toRealmName}` : "突破成功" }}
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
      <!--
        这一重天的来历 —— 界域志里那句 lore,挪到**刚跨进去的这一刻**说。

        印里印着它是哪一境、章里说这是大境,而它「是什么」一直没被说出来。而 lore
        本来讲的就是这重天的出处(「承渡劫。《钟吕传道集》分仙为五等……」)——
        在界域志里读到,和在天劫刚渡完的那一瞬读到,分量完全不同。

        只在大境显示:小层推进是节拍器,不该每次都念一段出处。
      -->
      <p
        v-if="view.success && view.isMajor && view.toRealmLore"
        class="t-body mx-auto mt-2 max-w-[46ch] text-ink-soft"
        data-breakthrough-lore
      >
        {{ view.toRealmLore }}
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

/**
 * 印面文字。
 *
 *   成功 · 小层 —— 「破」,一世几十次的节拍器
 *   成功 · 大境 —— 刚跨过的那一境的**名**(「玄仙」),里程碑
 *   失败       —— 「滞」
 *
 * 大境那一档取 `view.toRealmName`,由 core 造 view 时从 `realm.name` 给出;
 * 这个组件不切 `toLabel` 的字符串,也不 import 境界表。
 */
const majorSealText = computed(() => {
  const v = view.value;
  if (!v) return "破";
  if (!v.success) return "滞";
  return v.isMajor ? v.toRealmName : "破";
});

function close(): void {
  ui.breakthrough = null;
}
</script>
