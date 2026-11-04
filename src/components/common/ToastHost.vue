<template>
  <!--
    提示条必须挂在 body 顶层。

    书壳用 isolation:isolate 收住自己的书口层，弹窗又 Teleport 到 body；若 toast
    仍留在书壳里，它的 z-70 只是层内最高，整层依旧会被 z-50 的弹窗盖住。
    玩家会看见一条读得到、却点不到的动作回执。Teleport 后它与弹窗同一层竞争，
    z-70 才真正代表「提示始终压在浮层上」。
  -->
  <Teleport to="body">
    <!--
      稀有天降:全屏一闪。
      光的分量按品阶分层(见 ui/flashTier):神品比灵品停得更久、用的是那一档的色。
      没有品阶印的提示(转世/突破/里程碑)读 CSS 的默认值 —— 一个像素都不变。
      rgb 由界面在这里求:品质表里是调色板 token,纯函数不该假装知道它的 RGB。
    -->
    <div
      v-if="flashId !== null"
      :key="flashId"
      class="rare-flash"
      :data-rare-flash-tier="flashPlan.tier"
      :data-rare-flash-sfx="flashPlan.sfx"
      :style="flashStyle"
    />
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
      :style="{ '--toast-anim': `${TOAST_ANIM_MS}ms` }"
    >
      <TransitionGroup name="toast-slide" :duration="TOAST_ANIM_MS">
        <button
          v-for="t in ui.toasts"
          :key="t.id"
          data-toast
          type="button"
          class="pointer-events-auto flex max-w-90 cursor-pointer items-start gap-2 rounded-sm border px-4 py-2 text-left text-body shadow-md font-kai tracking-wide active:opacity-60 whitespace-pre-line"
          :class="KIND_CLASS[t.kind]"
          :data-toast-seal="t.seal"
          :data-toast-target="t.target?.kind"
          @click="ui.openToastTarget(t.id)"
        >
          <!--
            品阶印 —— 高品之物落地时,这一条不再是一句灰字,而是带着这一档的印。
            阴文章的画法与 QualitySeal 一致(纸底 + 品阶色字 + 细边),尺寸取行高内,
            故不改提示条的高度;没有印的提示(绝大多数)布局与从前一字不差。
          -->
          <span
            v-if="t.seal"
            class="mt-px inline-grid size-5 shrink-0 place-items-center rounded-[3px] border font-kai text-note leading-none"
            :style="sealStyle(t.seal)"
            aria-hidden="true"
            >{{ qualityDef(t.seal).name.charAt(0) }}</span
          >
          <span class="min-w-0">{{ t.text }}</span>
          <!--
            去路 —— 有可看的东西时给一枚「看」字(见 ui/toastTarget)。
            没有去路的提示一字不多:绝大多数提示点一下只是收掉自己。
          -->
          <span
            v-if="t.target"
            class="ml-1 shrink-0 self-center text-note text-qing"
            aria-hidden="true"
            >看 ›</span
          >
        </button>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useUiStore } from "@/stores/ui";
import type { Toast } from "@/types";
import { playSfx, type SfxName } from "@/core/audio";
import { qualityDef } from "@/data/qualities";
import { FLASH_DEFAULT, flashPlanOf, type FlashPlan } from "@/ui/flashTier";
import { colorWithAlpha } from "@/ui/colorVar";
import type { QualityId } from "@/types";

/**
 * 那枚印的画法 —— 色与名目全取自品质表,调用方只说「哪一档」。
 * 与 QualitySeal 同一套阴阳文口径:纸底、品阶色字、细边。
 */
function sealStyle(quality: QualityId): Record<string, string> {
  const tone = qualityDef(quality).color;
  return {
    borderColor: colorWithAlpha(tone, 0.45),
    background: colorWithAlpha(tone, 0.12),
    color: tone,
  };
}

const ui = useUiStore();

/*
 * 字号走 text-body,不写死 13px。
 *
 * 写死之后它两头都不对:手机档正文是 11px,toast 反而更大(13);宽屏阅读档
 * 正文 14px,toast 又更小(13)—— 同一个提示条在两个档位里的分量是反的。
 * 实测确认改前 390 档 13 vs 11、1280 档 13 vs 14。
 *
 * 与正文**同号**而不是更高一档:toast 是一句短散文,它的分量靠边框、
 * 底色与浮在页面之上来表达,不靠字号压过正文。往上取一档就只能用 text-title,
 * 那是给标题留的语义,拿来装提示语是另一种失真。
 */

/**
 * 离场动画时长 —— 唯一的一处定义。
 *
 * 之所以要显式写死:稀有提示的柔辉是挂在 ::before 上的 2.4s 无限动画。
 * 离场不能依赖 transition 的自动探测去猜时长 —— 无限动画没有可用的
 * animationend,玩家点掉提示后还得在原地等两秒。写死时长让 Vue 到点就摘。
 *
 * 它同时通过 `--toast-anim` 写给 style.css 的 .toast-slide-*:
 * 从前 CSS 里另写了一个 0.25s,注释写着「必须与它对齐」—— 那就只是口头约定,
 * 改一处另一处无从得知。现在 CSS 读这一枚,两边自动同拍。
 */
const TOAST_ANIM_MS = 250;

const flashId = ref<number | null>(null);
/** 当前这一道光的分量(见 ui/flashTier)—— 随那一条提示的品阶印而定 */
const flashPlan = ref<FlashPlan>(FLASH_DEFAULT);

/**
 * 那道光的两枚变量:色与时长。
 *
 * 色取自品质表里的调色板 token,**必须在这里求值** —— 纯函数那侧只回答
 * 「哪一档、多久、色从哪儿取」,不假装知道 RGB(品质表里写的是 var(--color-*))。
 */
const flashStyle = computed(() => {
  const style: Record<string, string> = { "--flash-ms": `${flashPlan.value.seconds}s` };
  const token = flashPlan.value.colorToken;
  if (token) {
    const probe = document.createElement("span");
    probe.style.color = token;
    probe.style.display = "none";
    document.body.append(probe);
    const resolved = getComputedStyle(probe).color;
    probe.remove();
    const m = /rgba?\(([^)]+)\)/.exec(resolved);
    if (m) {
      const [r, g, b] = m[1]!.split(",").map((x) => Number(x.trim()));
      style["--flash-rgb"] = `${r} ${g} ${b}`;
    }
  }
  return style;
});

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
      /*
       * 稀有那一响按品阶分层(见 ui/rareSfx):灵/玄/地是原来那一响,
       * 天仙升一档、神品再升一档。视觉层早已分层(边框、全屏光、提示条上的印),
       * 声音层不该继续在说「都一样」。
       */
      if (t.kind === "rare") {
        // 这一道的分量跟着那一条的品阶印走(见 ui/flashTier)
        flashPlan.value = flashPlanOf(t.seal);
        // 声与光同一份判定:同一条提示不许光按神品闪、声按灵品响
        playSfx(flashPlan.value.sfx);
        flashId.value = t.id;
        setTimeout(
          () => {
            if (flashId.value === t.id) flashId.value = null;
          },
          // 摘得比动画晚一点:动画自己 forwards 收尾,提前摘会看见它闪回去
          Math.ceil(flashPlan.value.seconds * 1000) + 120,
        );
      } else {
        playSfx(KIND_SFX[t.kind]);
      }
      lastAnnouncedId = t.id;
    }
  },
);
</script>
