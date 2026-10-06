/**
 * 通知端口 —— core 里「说一句」不再直接够到 store
 *
 * 由来(分层审计里 ui 是最大的一处):core 有二十多个模块直接 `useUiStore().toast(...)`,
 * 只为弹一条提示。这层依赖让 core 的纯逻辑也必须活在 Pinia 里 —— 想测一个数值函数
 * 要先建一整套 store,想把这段逻辑搬去别处(库、脚本、引擎侧)也搬不动。
 *
 * 这里只留一个最小接口:core 说「该提示什么」,由上层决定「怎么提示」。
 * ui store 在 setup 时把自己接上(见 stores/ui.ts),于是:
 *   · 应用里行为不变(还是那条 toast,TTL / 上限 / 关闭都在 store 那侧);
 *   · core 不再 import 任何 store,Pinia 不再是 core 的前置;
 *   · 测试里调 `useUiStore()` 就自动接上,断言 `ui.toasts` 照旧。
 *
 * 不做「core 直接 import store、store 再回头 import core」那种环路 —— 端口只有
 * 这一个方向:core 定义接口,上层实现。
 */
export type NoticeKind = "info" | "success" | "warn" | "rare";

export interface Notifier {
  toast(text: string, kind: NoticeKind): void;
}

let sink: Notifier | null = null;

/** 上层接上 / 摘掉通知落点。ui store 每次 setup 都会接上(测试里换 Pinia 亦然)。 */
export function setNotifier(notifier: Notifier | null): void {
  sink = notifier;
}

/**
 * 说一句。没有落点时静默丢弃 —— 纯逻辑不该因为「这会儿没人听」就跑不动
 * (批量结算、脚本、库的调用方都可能不挂 UI)。
 */
export function notify(text: string, kind: NoticeKind = "info"): void {
  sink?.toast(text, kind);
}
