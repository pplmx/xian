/**
 * 视图模型端口 —— core 里「该给界面看什么」不再直接够到 ui store。
 *
 * 与 `core/notify.ts` 同一套理由、同一个形状:core 只声明「要显示什么」,由上层决定
 * 「放进哪个 ref」。ui store 在 setup 时把自己接上,于是:
 *   · 应用里行为不变(还是那几个 ref;关闭 / 清空都在 store 那侧);
 *   · core 不再 import ui store,Pinia 不再是 core 的前置 —— 测一段突破 / 离线 / 轮回的
 *     纯逻辑,不必先起一套 UI;
 *   · 测试里 `useUiStore()` 一被调用落点就接上,断言 `ui.breakthrough` /
 *     `ui.reincarnation` 照旧(与 notify 走同一种转发)。
 *
 * 读也走这里:核心逻辑问「当前轮回视图是什么」,同样由上层回答 —— core 不自己
 * 去 store 里翻。没有落点时按「没人看」静默丢弃,纯逻辑不因「这会儿没接 UI」就跑不动。
 */
import type { BreakthroughView, OfflineSummary, ReincarnationView } from "@/types";

/** 上层(ui store)实现这几个落点:core 递过来,它决定放哪儿 */
export interface UiViewModelSink {
  /** 突破结果给界面看一眼(结算已算完,这里只负责递过去) */
  breakthrough(view: BreakthroughView): void;
  /** 生死对话开关(寿元耗尽时亮起,轮回后熄灭) */
  deathDialog(open: boolean): void;
  /** 本次离线结算的回执(归来时弹的那一屏) */
  offlineSummary(summary: OfflineSummary): void;
  /** 轮回视图:立起 / 收起 */
  reincarnation(view: ReincarnationView | null): void;
  /** core 读回当前轮回视图(确认轮回时要用) */
  readReincarnation(): ReincarnationView | null;
}

let sink: UiViewModelSink | null = null;

/** 上层接上 / 摘掉视图落点。ui store 每次 setup 都会接上(测试里换 Pinia 亦然)。 */
export function setUiViewModelSink(next: UiViewModelSink | null): void {
  sink = next;
}

/** 突破结果递过去 */
export function showBreakthrough(view: BreakthroughView): void {
  sink?.breakthrough(view);
}

/** 开关生死对话 */
export function setDeathDialog(open: boolean): void {
  sink?.deathDialog(open);
}

/** 离线回执递过去 */
export function showOfflineSummary(summary: OfflineSummary): void {
  sink?.offlineSummary(summary);
}

/** 立起 / 收起轮回视图 */
export function setReincarnationView(view: ReincarnationView | null): void {
  sink?.reincarnation(view);
}

/** 读回当前轮回视图(没接 UI 时视为没有) */
export function currentReincarnationView(): ReincarnationView | null {
  return sink?.readReincarnation() ?? null;
}
