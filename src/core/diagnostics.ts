/**
 * 运行诊断端口 —— core 只上报，不依赖 Pinia / 设置页。
 *
 * 心跳异常在 core 内被 catch 后不会进全局 Vue errorHandler。这里把「留档」
 * 收成一个最小接口：核心层给出来源与摘要，store 在 setup 时接上持久化落点。
 * 与 notify 端口同构，诊断落点不存在时静默丢弃。
 */

/** 单条摘要长度上限 */
export const DIAG_MESSAGE_MAX = 200;

export interface RuntimeDiagnostic {
  /** 来源，如 engine.tick / engine.offline */
  info: string;
  /** 已压缩成单行的摘要 */
  message: string;
  /** 发生时的路由 hash */
  route?: string;
  /** 发生时刻；不填由 store 取当前时间 */
  at?: number;
}

export type RuntimeDiagnosticSink = (input: RuntimeDiagnostic) => void;

let sink: RuntimeDiagnosticSink | null = null;

/** 上层接上 / 摘掉诊断落点 */
export function setRuntimeDiagnosticSink(next: RuntimeDiagnosticSink | null): void {
  sink = next;
}

/** 把任意异常值压成一行摘要（不记调用栈，不留原始对象） */
export function summarizeError(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`.slice(0, DIAG_MESSAGE_MAX);
  if (typeof err === "string") return err.slice(0, DIAG_MESSAGE_MAX);
  try {
    return JSON.stringify(err).slice(0, DIAG_MESSAGE_MAX);
  } catch {
    return String(err).slice(0, DIAG_MESSAGE_MAX);
  }
}

/** 上报一条运行期诊断；诊断自身绝不许再抛 */
export function recordRuntimeDiagnostic(input: RuntimeDiagnostic): void {
  try {
    sink?.(input);
  } catch {
    /* 留档失败不能变成第二个故障源 */
  }
}
