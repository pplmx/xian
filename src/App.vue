<template>
  <!-- 桌面端外框:居中手机区域 -->
  <div
    class="app-shell relative paper-grain"
    :class="{ 'reduce-motion': settings.reduceMotion }"
    :data-game-shell="game.started ? 'desk' : 'leaf'"
    :data-opening="!game.started"
    :data-folio-layout="folioLayout"
    :data-world="player.world.id"
  >
    <!--
      键盘跳读入口。

      hash 路由本身占用 #，故这里只管把焦点交给正文，不让浏览器把地址改成
      #folio-main；鼠标用户看不见它，第一次按 Tab 时才会从书页上缘展开。
    -->
    <a
      v-if="game.started && route.name !== 'create'"
      data-folio-skip-link
      class="folio-skip-link"
      href="#folio-main"
      @click.prevent="focusFolioMain"
      >直入正文</a
    >
    <p
      v-if="game.started && route.name !== 'create'"
      data-folio-arrival
      class="sr-only"
      aria-live="polite"
    >
      {{ routeAnnouncement }}
    </p>

    <!--
      云雾装饰 —— 必须关在自己的一层裁剪盒里。

      这两团雾是**故意越界**画的(左上 -64px、右下 -96px)才好看,但它们若直接挂在
      外壳上,就会把 overflow-hidden 的外壳撑出一段可以滚动的横向溢出(实测
      scrollWidth 516 vs clientWidth 390)。外壳本身是 overflow-hidden,玩家滚不动,
      可浏览器会——建号结束时焦点回到 body,浏览器顺手把它 scrollLeft 设成 24,
      此后整个界面**永久左移 24px**:顶栏的名字与「炼气·一层」被切掉左半边,
      底部第一栏的「洞府」只剩半个字。这不是理论,375/320/430 三档宽度都能复现。
      故装饰归装饰:外包一层 inset-0 overflow-hidden,越界部分在这里被裁掉,
      不再进入外壳的滚动区。
    -->
    <!-- 云雾的明度分主题给:「bg-white/40」在夜间会把底色抬亮到淡墨小字读不出来(见 style.css 的 .mist) -->
    <div class="pointer-events-none absolute inset-0 overflow-hidden">
      <div class="mist absolute -top-24 -left-16 h-64 w-96 rounded-full blur-3xl animate-mist" />
      <div
        class="mist-soft absolute top-1/3 -right-24 h-72 w-80 rounded-full blur-3xl animate-mist-slow"
      />
    </div>

    <DesktopSpine
      v-if="game.started && route.name !== 'create' && desktopSpineVisible"
      @open-atlas="atlasOpen = true"
    />
    <TopStatusBar v-if="game.started && route.name !== 'create'" @open-atlas="atlasOpen = true" />

    <!--
      只读页(多标签后来者)的常驻说明。

      为什么不是一条 toast:toast 三秒后自己消失,而这页**从打开到关闭都不会再写档** ——
      玩家看着数字不动、点了没反应,却没有任何东西留在屏幕上解释。这条横幅跟着页面一直在,
      role=status 让读屏在进入时念一次;文案只说两件事:为什么、以及进度不会保存。
    -->
    <div
      v-if="saveReader"
      data-save-reader
      :data-save-reader-freed="writerFreed ? '' : undefined"
      role="status"
      class="app-save-reader relative z-10 flex shrink-0 flex-wrap items-center justify-center gap-x-1 border-b border-cinnabar/40 bg-cinnabar/6 px-3 py-1 text-center font-kai text-body leading-relaxed text-cinnabar"
    >
      <template v-if="writerFreed">
        <span>另一处已关闭 ——</span>
        <button
          type="button"
          class="underline underline-offset-2 active:opacity-60"
          @click="reloadPage"
        >
          刷新本页
        </button>
        <span>即可继续游玩</span>
      </template>
      <template v-else>已在另一处打开 · 本页只读,进度不会保存</template>
    </div>

    <main
      ref="scrollHost"
      id="folio-main"
      data-folio-main
      tabindex="-1"
      aria-label="正文"
      class="folio-surface relative z-10 min-h-0 flex-1 overflow-y-auto overflow-x-hidden"
      :data-folio-turn="turnDirection"
    >
      <RouterView v-slot="{ Component }">
        <Transition :name="turnName" mode="out-in" @before-enter="resetScroll">
          <component :is="Component" />
        </Transition>
      </RouterView>
      <FolioTurner v-if="game.started" />
    </main>

    <BottomNavigation v-if="game.started && route.name !== 'create'" />

    <!-- 全局浮层 -->
    <UpdatePrompt :visible="updateReady" @refresh="swHandle?.reload()" />
    <ToastHost />
    <NavigationAtlas v-if="game.started" :open="atlasOpen" @close="atlasOpen = false" />
    <template v-if="overlaysReady">
      <OfflineRewardDialog />
      <BreakthroughResultDialog />
      <EventDialog v-if="game.started" />
      <ReincarnationDialog />
      <EquipmentDetailDialog />
      <NumberDetailDialog />
      <ExitConfirmDialog />
      <!-- 修炼中偶发事件浮层(引擎触发、组件轮询展示;挂在全局才不会漏掉窗口期) -->
      <EnlightenmentModal v-if="game.started" />
      <CaveEventModal v-if="game.started" />
    </template>
    <!-- 世界变迁宣告:人间→仙界→神界→混沌,越界那一瞬的仪式(判据见 core/worldRite) -->
    <WorldTransitionVeil />
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  defineAsyncComponent,
  onMounted,
  onUnmounted,
  ref,
  useTemplateRef,
  watch,
} from "vue";
import { useRoute, useRouter } from "vue-router";
import { useGameStore } from "@/stores/game";
import { usePlayerStore } from "@/stores/player";
import { useUiStore } from "@/stores/ui";
import { useSettingsStore } from "@/stores/settings";
import UpdatePrompt from "@/components/common/UpdatePrompt.vue";
import {
  useServiceWorkerUpdate,
  type ServiceWorkerUpdateHandle,
} from "@/composables/useServiceWorkerUpdate";
import { onBlockedSaveWrite, saveWriteFailure, subscribeSaveWriteFailure } from "@/utils/storage";
import { engine } from "@/core/engine";
import { saveReader, saveWriterFree } from "@/core/singleWriter";
import { settleReturn } from "@/composables/useReturnSettle";
import { notify } from "@/core/notify";
import { apprenticeReapText } from "@/core/apprenticeService";
import { applyTheme, initTheme } from "@/core/theme";
import { configureAudio, playSfx, stopBgm, unlockAudio } from "@/core/audio";
import { folioLayoutOf } from "@/ui/folioSpread";
import { folioTurnDirectionOf, type FolioTurnDirection } from "@/ui/folioTurn";
import { useMediaQuery } from "@/composables/useMediaQuery";
import DesktopSpine from "@/components/common/DesktopSpine.vue";
import TopStatusBar from "@/components/common/TopStatusBar.vue";
import BottomNavigation from "@/components/common/BottomNavigation.vue";
import FolioTurner from "@/components/common/FolioTurner.vue";
import NavigationAtlas from "@/components/common/NavigationAtlas.vue";
import ToastHost from "@/components/common/ToastHost.vue";
import WorldTransitionVeil from "@/components/common/WorldTransitionVeil.vue";
import { isAtlasShortcut } from "@/ui/atlas";
import { folioArrivalTextOf } from "@/ui/folioArrival";
import { hasOpenModal } from "@/ui/modalStack";

/*
 * 浮层按需装载。它们不参与首屏构图，却合计带着归来、战报、装备与转世的整条数据链；
 * 若随 App 静态导入，所有玩家打开首页都得先下完这些代码。这里先把它们拆出入口静态图，
 * 等正文与楷体落定后再由 overlaysReady 拉取分块；首屏关键路径只保留顶栏、正文与底栏。
 */
const OfflineRewardDialog = defineAsyncComponent(
  () => import("@/components/offline/OfflineRewardDialog.vue"),
);
const BreakthroughResultDialog = defineAsyncComponent(
  () => import("@/components/cultivation/BreakthroughResultDialog.vue"),
);
const EventDialog = defineAsyncComponent(() => import("@/components/adventure/EventDialog.vue"));
const ReincarnationDialog = defineAsyncComponent(
  () => import("@/components/character/ReincarnationDialog.vue"),
);
const EquipmentDetailDialog = defineAsyncComponent(
  () => import("@/components/equipment/EquipmentDetailDialog.vue"),
);
const NumberDetailDialog = defineAsyncComponent(
  () => import("@/components/common/NumberDetailDialog.vue"),
);
const ExitConfirmDialog = defineAsyncComponent(
  () => import("@/components/common/ExitConfirmDialog.vue"),
);
const EnlightenmentModal = defineAsyncComponent(
  () => import("@/components/cultivation/EnlightenmentModal.vue"),
);
const CaveEventModal = defineAsyncComponent(() => import("@/components/dongfu/CaveEventModal.vue"));

const game = useGameStore();
const player = usePlayerStore();
const ui = useUiStore();
const settings = useSettingsStore();
const updateReady = ref(false);
const atlasOpen = ref(false);
let swHandle: ServiceWorkerUpdateHandle | undefined;
const route = useRoute();
const router = useRouter();
const folioLayout = computed(() => folioLayoutOf(route.name));
const turnDirection = ref<FolioTurnDirection>("cross");
const turnName = computed(() => `folio-turn-${turnDirection.value}`);
const routeAnnouncement = ref(folioArrivalTextOf(route.name));
/**
 * 浮层等正文所用楷体落定后再开始下载。
 *
 * 异步组件本身不会进入入口静态图，但若一挂载就全部发起请求，慢网下仍会和首条路由、
 * 字体切片抢带宽。浮层状态都保存在 store 里，晚一拍挂载不会丢事件；先让玩家看见正文，
 * 再补齐这些“用到才出现”的册页。
 */
const overlaysReady = ref(false);
/** 书脊只属于桌面两列骨架；手机即便 CSS 已隐藏，也不该把整份十七册目录留在 DOM。 */
const desktopSpineVisible = useMediaQuery("(min-width: 960px)");
const stopAfterEach = router.afterEach((to, from) => {
  turnDirection.value = folioTurnDirectionOf(from.name, to.name);
  routeAnnouncement.value = folioArrivalTextOf(to.name);
  atlasOpen.value = false;
  /*
   * 建号页的「踏入仙途」被路由卸下后,浏览器的顺序焦点起点仍停在那枚旧按钮上。
   * 若只等 activeElement 自然回到 body,下一次 Tab 会从旧位置继续,越过书页
   * 最前面的「直入正文」。入卷完成后把起点明确交还 body;已有弹窗时让弹窗
   * 的焦点陷阱接管,不能把焦点抢回来。
   */
  if (from.name === "create" && to.name === "home") {
    requestAnimationFrame(() => {
      if (!hasOpenModal()) document.body.focus({ preventScroll: true });
    });
  }
});

/** 内容区滚动宿主(滚动条挂在这个常驻的 main 上,不是 window) */
const scrollHost = useTemplateRef<HTMLElement>("scrollHost");

/**
 * 切页时把内容区滚动位置归零。
 * main 是常驻元素,路由切换只替换它的子组件,它自身从不重建,scrollTop 会被
 * 下一个页面原样继承。router 的 scrollBehavior 在这里不顶用——那个 API 操作
 * 的是 window,而外层 .app-shell + overflow-hidden 让 window 根本不产生滚动。
 * 挂在 before-enter 而非 watch(route):out-in 模式下这一刻旧页面已完全离场,
 * 归零不会让正在播离场动画的旧页面突然跳回顶部。
 */
function resetScroll(): void {
  if (scrollHost.value) scrollHost.value.scrollTop = 0;
}

/** 跳读只移动焦点，不替玩家改动当前阅读位置。 */
function focusFolioMain(): void {
  scrollHost.value?.focus({ preventScroll: true });
}

let unsubscribeTheme: () => void = () => undefined;
let unsubscribeSaveFailure: () => void = () => undefined;
let unsubscribeBlockedWrite: () => void = () => undefined;

/** 浏览器要求首次交互后才可出声;顺带给所有按钮一个轻点击音 */
function onPointerDown(e: PointerEvent): void {
  unlockAudio();
  if ((e.target as HTMLElement | null)?.closest("button")) playSfx("click");
}

function isEditableTarget(target: EventTarget | null): boolean {
  const element = target instanceof HTMLElement ? target : null;
  return !!element?.closest("input, textarea, select, [contenteditable='true']");
}

/** 全站寻册:有别的浮层时让位,正在输入时不抢浏览器快捷键。 */
function onGlobalKeydown(event: KeyboardEvent): void {
  if (!isAtlasShortcut(event)) return;
  if (atlasOpen.value) {
    event.preventDefault();
    atlasOpen.value = false;
    return;
  }
  if (!game.started || hasOpenModal() || event.repeat || isEditableTarget(event.target)) return;
  event.preventDefault();
  atlasOpen.value = true;
}

// 音频偏好实时同步(音量 0~100 → 0~1)
watch(
  () => [settings.musicOn, settings.sfxOn, settings.musicVol, settings.sfxVol] as const,
  ([musicOn, sfxOn, musicVol, sfxVol]) => {
    configureAudio({ musicOn, sfxOn, musicVol: musicVol / 100, sfxVol: sfxVol / 100 });
  },
  { immediate: true },
);

// 主题:立即应用一次,此后跟随设置变化(auto 时系统切换也会实时跟随)
watch(
  () => settings.theme,
  (t) => applyTheme(t),
  { immediate: true },
);

/** 只读页每隔多久问一次「写者席位空出来没有」——3 秒够快,又不至于吵 */
const WRITER_WATCH_MS = 3000;
const writerFreed = ref(false);
let writerWatch: number | undefined;
/** 刷新交给玩家自己按:自动重载会让人以为页面崩了 */
const reloadPage = (): void => window.location.reload();

onMounted(() => {
  unsubscribeTheme = initTheme(() => settings.theme);
  /*
   * 存档写不进去必须让玩家知道:静默失败意味着从现在起的进度都不会进档,
   * 而他可能正玩得兴起。这里只说两件事 —— 出事了(并给出可做的事:导出备份),
   * 以及什么时候好了。反复失败不重复弹(订阅只在状态翻转时回调)。
   */
  const warnSaveFailure = (): void => {
    ui.toast("存档写入失败 —— 浏览器存储可能已满,建议先导出备份", "warn");
  };
  unsubscribeSaveFailure = subscribeSaveWriteFailure((failure) => {
    if (failure) warnSaveFailure();
    else ui.toast("存档已恢复写入", "info");
  });
  // 启动迁移可能在 App 订阅之前就已经写失败;别因错过那一次回调而静默带病运行。
  if (saveWriteFailure() !== null) warnSaveFailure();
  /*
   * 只读页的操作在内存里都「成功」,只是不落盘 —— 不吭声的话,玩家刷新后才发现白忙。
   * 拦下第一笔写入时当场说一声,别让他以为存上了。
   */
  unsubscribeBlockedWrite = onBlockedSaveWrite(() => {
    ui.toast("本页只读 —— 这一步没有保存,换到另一处继续吧", "warn");
  });
  // 归来一拍即收:寄卖自售、货架与悬赏换新、弟子归来 —— 全在 settleReturn 里,
  // 只读页整段跳过(见该模块注释:存储层的闸挡不住内存结算)
  const settled = settleReturn(Date.now());
  if (settled.sold.length) notify(`「${settled.sold.join("、")}」已自售,灵石到账`, "success");
  // 归来即报一声 —— 玩家回来不该只知道数变了。与收徒页同一条通报格式化。
  for (const r of settled.reaped) {
    notify(`「${r.name}」归来,带回 ${apprenticeReapText(r.spoils)}`, "success");
  }
  // PWA 版本更新:有新版就绪再亮「刷新」(注册在 main.ts;这里取回 registration 接管监听)
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .getRegistration()
      .then((reg) => {
        if (reg) swHandle = useServiceWorkerUpdate(reg, () => (updateReady.value = true));
      })
      .catch(() => {
        /* 拿不到 registration 则无更新提示,功能照常 */
      });
  }
  /*
   * 只读页(多标签的后来者)不启动心跳:它每拍都会改响应式状态,而存储层的闸只挡住
   * 落盘 —— 让引擎空转只会让这一页的数字慢慢跑到跟存档无关,玩家看到的是一份假读数。
   * 这一页仍可浏览(存档是打开那一刻的快照),但要写一句话说明为什么它不会保存。
   */
  // 只读页不启引擎;「为什么不动」交给顶部那条常驻横幅(模板里),它不会像 toast 一样消失
  if (!saveReader.value) engine.start();
  /*
   * 只读页要能看到「现在可以回来了」:另一处关掉之后,锁会自动释放,但这一页的心跳
   * 早就不跑了 —— 不主动探一下,横幅会一辈子写着「已在另一处打开」,玩家只能猜。
   * 探到就停表并换文案;不做自动重载:刷新是玩家的动作,自己跳走会让人以为页面崩了。
   */
  if (saveReader.value) {
    writerWatch = window.setInterval(() => {
      void saveWriterFree().then((free) => {
        if (!free) return;
        writerFreed.value = true;
        if (writerWatch !== undefined) window.clearInterval(writerWatch);
        ui.toast("另一处已关闭 —— 刷新本页即可继续游玩", "info");
      });
    }, WRITER_WATCH_MS);
  }
  window.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("keydown", onGlobalKeydown);
  const revealOverlays = (): void => {
    requestAnimationFrame(() => {
      overlaysReady.value = true;
    });
  };
  if (document.fonts?.ready) void document.fonts.ready.then(revealOverlays, revealOverlays);
  else revealOverlays();
});

onUnmounted(() => {
  stopAfterEach();
  if (writerWatch !== undefined) window.clearInterval(writerWatch);
  unsubscribeTheme();
  unsubscribeSaveFailure();
  unsubscribeBlockedWrite();
  swHandle?.stop();
  engine.stop();
  stopBgm();
  window.removeEventListener("pointerdown", onPointerDown);
  window.removeEventListener("keydown", onGlobalKeydown);
});
</script>
