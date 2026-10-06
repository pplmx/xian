/** 瞬态 UI 状态 —— Toast / 各类 Modal(不持久化) */
import { defineStore } from "pinia";
import { ref } from "vue";
import { setNotifier } from "@/core/notify";
import type {
  BreakthroughView,
  NumberDetailView,
  OfflineSummary,
  ReincarnationView,
  Toast,
} from "@/types";

let toastSeq = 1;

export const useUiStore = defineStore("ui", () => {
  const toasts = ref<Toast[]>([]);
  const offlineSummary = ref<OfflineSummary | null>(null);
  const breakthrough = ref<BreakthroughView | null>(null);
  const equipDetailUid = ref<string | null>(null);
  const artifactDetailId = ref<string | null>(null);
  const gongfaDetailId = ref<string | null>(null);
  const buffDetailId = ref<string | null>(null);
  /**
   * 数值详情浮层(点任意大数即可打开)。
   *
   * 为什么走全局:数值散落在修炼页/人物页/图鉴/战报各处,而"展开详情"不该改它们的排版
   * (窄屏加行必炸)。故只在被点的那个数上做个记号,详情统一由 App 挂的浮层呈现 ——
   * 与 buffDetailId / gongfaDetailId 同一套做法。
   */
  const numberDetail = ref<NumberDetailView | null>(null);
  const deathDialog = ref(false);
  const reincarnation = ref<ReincarnationView | null>(null);
  const corruptedNotice = ref<string[]>([]);
  /** 踏入仙途那一瞬要交接给首页宣读的起手句 —— 灵根鉴定定格播报(aria-live polite)
   *  定格后 400ms 就随路由跳转把弹窗页卸载,读屏可能当场切断;首页挂载时若带着
   *  这句,用自家 aria-live 补上,读完即清(只在创角→首页这一趟念)。 */
  const worldEnter = ref<string | null>(null);

  function toast(text: string, kind: Toast["kind"] = "info"): void {
    const id = toastSeq;
    toastSeq += 1;
    toasts.value = [...toasts.value.slice(-4), { id, text, kind }];
    const ttl = kind === "rare" ? 4200 : 2600;
    setTimeout(() => {
      toasts.value = toasts.value.filter((t) => t.id !== id);
    }, ttl);
  }

  /*
   * 把自己接上 core 的通知端口(见 core/notify.ts)。core 那二十几个模块从此只说
   * `notify(...)`,不再 import 本 store;换一套 UI(或测试里换 Pinia)只要 store
   * 被 setup 过一次,落点就切过来。
   *
   * 走 `useUiStore().toast(...)` 而不是直接闭包 `toast`:这样**测试里
   * `vi.spyOn(useUiStore(), "toast")` 仍然拦得住** core 发出的提示(现有一批
   * 对账用例就是这么截提示语的),落点也始终是当前 active 的那份 pinia。
   */
  setNotifier({ toast: (text, kind) => useUiStore().toast(text, kind) });

  /** 手动关闭某条提示(点按 toast 即收,不等超时) */
  function dismissToast(id: number): void {
    toasts.value = toasts.value.filter((t) => t.id !== id);
  }

  return {
    toasts,
    offlineSummary,
    breakthrough,
    equipDetailUid,
    artifactDetailId,
    gongfaDetailId,
    buffDetailId,
    numberDetail,
    deathDialog,
    reincarnation,
    corruptedNotice,
    worldEnter,
    toast,
    dismissToast,
  };
});
