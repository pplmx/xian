<template>
  <!-- 稀有天降:全屏金光一闪 -->
  <div v-if="flashId !== null" :key="flashId" class="rare-flash" />
  <!--
    外框不吃事件(留出底下页面的点击),但**提示条本身要吃** ——
    它挂着 @click 关掉自己,也写着 cursor-pointer 与按下反馈。
    此前只有外框写了 pointer-events-none,按钮继承成 none:
    dismissToast 从来没有被触发过,提示条只能等超时自己消失。
  -->
  <!--
    aria-live=polite:toast 承载了几乎每一下动作的结果(得了什么/缺了什么/成了与否),
    它前面却没有任何 live region —— 视觉玩家有滑入音画,读屏玩家点完只听个静默。
    TransitionGroup + :key=id 保证新 toast 只新增一个节点,念出的就是新条;
    旧条移除不发声,不会成片重读。
  -->
  <div
    aria-live="polite"
    class="pointer-events-none fixed inset-x-0 top-[max(env(safe-area-inset-top),2.5rem)] z-70 flex flex-col items-center gap-1.5 px-6"
  >
    <TransitionGroup name="toast-slide" :duration="TOAST_ANIM_MS">
      <button
        v-for="t in ui.toasts"
        :key="t.id"
        type="button"
        class="pointer-events-auto max-w-90 cursor-pointer rounded-sm border px-4 py-2 text-left text-[13px] shadow-md font-kai tracking-wide active:opacity-60 whitespace-pre-line"
        :class="KIND_CLASS[t.kind]"
        @click="ui.dismissToast(t.id)"
      >
        {{ t.text }}
      </button>
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { useUiStore } from "@/stores/ui";
import type { Toast } from "@/types";
import { playSfx, type SfxName } from "@/core/audio";

const ui = useUiStore();

/**
 * 离场动画时长 —— 必须与 style.css 里 .toast-slide-* 的 0.25s 对齐。
 *
 * 之所以要显式写死:稀有提示的柔辉是挂在 ::before 上的 2.4s 无限动画。
 * 离场不能依赖 transition 的自动探测去猜时长 —— 无限动画没有可用的
 * animationend,玩家点掉提示后还得在原地等两秒。写死时长让 Vue 到点就摘。
 */
const TOAST_ANIM_MS = 250;

const flashId = ref<number | null>(null);

const KIND_CLASS: Record<Toast["kind"], string> = {
  info: "border-ink/25 text-ink-soft bg-paper",
  success: "border-jade/60 text-jade bg-paper",
  warn: "border-cinnabar/60 text-cinnabar bg-paper",
  rare: "border-gold-ink/70 text-gold-ink bg-paper animate-glow-pulse",
};

const KIND_SFX: Record<Toast["kind"], SfxName> = {
  info: "info",
  success: "success",
  warn: "warn",
  rare: "rare",
};

// 新 toast 落地时按类型配一声提示音;稀有品级另加全屏金光。
// 盯「最后一条」会导致同帧连续入队的 toast(如转世 一帧三连:rare·rare·info)
// 被 Vue 批处理后只对末条发声 —— 稀有转世的金光与稀有音效被末尾那条 info 吃掉。
// 改为盯「新增了哪些」:id 单调递增,凡是超过已播过最大 id 的新条都各有其类型声。
let lastAnnouncedId = -1;
watch(
  () => ui.toasts.map((t) => t.id),
  (ids) => {
    if (ids.length === 0) return;
    const newest = Math.max(...ids);
    if (newest <= lastAnnouncedId) return;
    for (const t of ui.toasts) {
      if (t.id <= lastAnnouncedId) continue;
      playSfx(KIND_SFX[t.kind]);
      if (t.kind === "rare") {
        flashId.value = t.id;
        setTimeout(() => {
          if (flashId.value === t.id) flashId.value = null;
        }, 1200);
      }
      lastAnnouncedId = t.id;
    }
  },
);
</script>
