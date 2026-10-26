<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="props.open"
        class="fixed inset-0 flex items-center justify-center bg-ink/45 backdrop-blur-[2px] px-5 tinylens:px-3"
        :class="props.top ? 'z-60' : 'z-50'"
        @click.self="onBackdrop"
      >
        <div
          ref="panelRef"
          role="dialog"
          aria-modal="true"
          :aria-label="props.ariaLabel || props.title || undefined"
          tabindex="-1"
          class="modal-panel paper-grain relative w-full max-h-[82vh] flex flex-col overflow-hidden rounded-xl border border-ink/20 bg-paper shadow-2xl outline-none"
          :class="props.wide ? 'max-w-100' : 'max-w-90'"
          @keydown="onPanelKeydown"
        >
          <!-- 卷轴上缘 -->
          <header
            v-if="props.title || props.closable"
            class="relative z-10 flex items-center justify-between px-5 pt-4 pb-1 shrink-0 tinylens:px-3"
          >
            <!--
              弹窗标题此前是悬空一行楷体:页面每节都有世界色笔杆(brush-bar)当家,
              弹窗是全库复用的浮层原语,标题却没有这根杆 —— 全库所有弹窗统一补上。
            -->
            <h3 class="flex items-center gap-2 font-kai text-lg tracking-[0.2em] text-ink">
              <span
                v-if="props.title"
                class="brush-bar h-3 w-0.75 rounded bg-[var(--world-bar)]"
                aria-hidden="true"
              />
              {{ props.title }}
            </h3>
            <!--
              关闭键此前只有一枚图标:读屏只念「按钮」(没有可访问名),
              而且连内外边距只有 26px —— 拇指够得着的那条线是 28px。
              补 aria-label 与 30px 触面(负外边距抵消,视觉位置不动)。
            -->
            <button
              v-if="props.closable"
              class="p-1.5 -m-1.5 text-ink-faint active:scale-90"
              aria-label="关闭"
              @click="emit('close')"
            >
              <GameIcon name="x" :size="18" />
            </button>
          </header>
          <!--
            引首那道线 —— 题头与卷身之间的一笔。

            没有它的时候,标题下面直接就是内容,弹窗读作一个「带标题的盒子」;
            添上这一道,同一块面板才像摊开的卷轴:题签在上,卷身在下,中间是那道
            压过纸的折痕。与顶栏底栏同一个画法(.ink-divider),两处收口一致。

            只在真有题头时画 —— 无题弹窗(自带大标题卡的那几个)画了就是一道悬空的线。
          -->
          <div
            v-if="props.title || props.closable"
            class="ink-divider mx-5 shrink-0"
            aria-hidden="true"
          />
          <div class="scroll-pane relative z-10 overflow-y-auto px-5 py-3 grow tinylens:px-3">
            <slot />
          </div>
          <footer v-if="$slots.footer" class="relative z-10 px-5 pb-5 pt-2 shrink-0 tinylens:px-3">
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script lang="ts">
/**
 * Esc 关闭 —— 只让最上面一层可关弹窗响应。
 *
 * 这段必须在**模块 scope** 的普通 <script> 里,不能放进 <script setup>:
 * <script setup> 顶层代码每实例跑一遍,放那里 = 每个 BaseModal 都挂一份自己的
 * window keydown 监听。那会有两个毛病:
 *   · 路由来回切几次,window 上堆一走廊永不回收的死监听(BaseModal 是大量视图
 *     复用的浮层原语,导航进出一次就多一份);
 *   · 各实例只看得到自己,叠放时(详情盖列表)按一次 Esc 所有实例的监听都判定
 *     "自己是顶层"→ 整摞弹窗一层层全关,与"只退最上层"相悖。
 * 监听收敛到模块级一份,栈本身挪去了 `@/ui/modalStack` —— 安卓实体返回键
 * (ExitConfirmDialog)也要问同一句「上面还有一层吗」,栈不能再是这里的私有变量。
 */
import { closeTopModal, pushModal, removeModal, type ModalEntry } from "@/ui/modalStack";

function onWindowKey(e: KeyboardEvent): void {
  if (e.key !== "Escape") return;
  // 栈空、或顶层不可关(必须作答的结果框)时把 Esc 让回浏览器,不吞这一下
  if (closeTopModal()) e.preventDefault();
}
if (typeof window !== "undefined") window.addEventListener("keydown", onWindowKey);
</script>

<script setup lang="ts">
import { nextTick, onUnmounted, useTemplateRef, watch } from "vue";
import GameIcon from "./GameIcon.vue";

const props = withDefaults(
  defineProps<{
    open: boolean;
    title?: string;
    closable?: boolean;
    wide?: boolean;
    /**
     * 无标题弹窗的可访问名。
     *
     * 有的弹窗自带一张大标题卡(归来 / 寿元将尽 / 突破结果 / 灵脉),
     * 再让 BaseModal 画一遍标题就是重复。但**对话框自己**总得有个名字 ——
     * 不给的话 role=dialog 读出来就是光秃秃一句「对话框」。
     */
    ariaLabel?: string;
    /** 顶层弹窗:叠在普通弹窗(z-50)之上,用于详情盖列表等场景 */
    top?: boolean;
  }>(),
  { title: "", closable: true, wide: false, top: false, ariaLabel: "" },
);

const emit = defineEmits<{ close: [] }>();

/**
 * 焦点管理 —— 弹窗打开时,键盘焦点必须跟着进去,且不许跑出去。
 *
 * 此前弹窗只管 Esc:打开后焦点仍留在背后的按钮上,按 Tab 会一路跑到页面与底部导航
 * (实测连按六次,六次全在弹窗外),读屏用户甚至不知道有个弹窗开了。故:
 *   · 打开时记住是谁打开的,把焦点移进面板(role=dialog + aria-modal);
 *   · Tab/Shift+Tab 在面板内循环,首尾相接;
 *   · 关闭后把焦点还给打开它的那个元素。
 */
const panelRef = useTemplateRef<HTMLElement>("panelRef");
let lastFocused: HTMLElement | null = null;

function focusablesIn(root: HTMLElement): HTMLElement[] {
  return [
    ...root.querySelectorAll<HTMLElement>(
      'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    ),
  ].filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null);
}

function onPanelKeydown(e: KeyboardEvent): void {
  if (e.key !== "Tab") return;
  const panel = panelRef.value;
  if (!panel) return;
  const items = focusablesIn(panel);
  if (items.length === 0) {
    e.preventDefault();
    panel.focus();
    return;
  }
  const first = items[0]!;
  const last = items[items.length - 1]!;
  const active = document.activeElement as HTMLElement | null;
  const outside = !active || !panel.contains(active);
  if (e.shiftKey) {
    if (outside || active === first) {
      e.preventDefault();
      last.focus();
    }
  } else if (outside || active === last) {
    e.preventDefault();
    first.focus();
  }
}

function onBackdrop(): void {
  if (props.closable) emit("close");
}

// ---- Esc / 返回键共用同一座栈:压栈在这里,消费在 BaseModal 的监听与 ExitConfirmDialog ----
const entry: ModalEntry = { closable: props.closable, close: () => emit("close") };
watch(
  () => props.open,
  (open) => {
    if (open) {
      pushModal(entry);
      // 记住是谁打开的,关闭后把焦点还回去(键盘用户不会"掉到页面顶端")
      lastFocused = document.activeElement as HTMLElement | null;
      void nextTick(() => panelRef.value?.focus());
    } else {
      removeModal(entry);
      const back = lastFocused;
      lastFocused = null;
      void nextTick(() => {
        if (back && back.isConnected) back.focus();
      });
    }
  },
  { immediate: true },
);
watch(
  () => props.closable,
  (c) => {
    entry.closable = c;
  },
);
onUnmounted(() => removeModal(entry));
</script>
