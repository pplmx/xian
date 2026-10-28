/**
 * Electron 壳层的 URL 判据。
 *
 * 主进程把两类边界分开处理：
 *   · 游戏窗口只能停在打包后的本地入口，hash 路由仍算同一页；
 *   · 明确的 http(s) 外链交给系统浏览器，不让 Electron 自己创建窗口。
 *
 * 判据放在可单测的纯函数里，而不是让 `new URL` 与协议白名单散落在事件回调中。
 */

/**
 * webRequest 先接住全部请求，再按协议放行：file/blob/data 等本地资源通过，
 * http(s)/ws(s)/ftp 一律取消。比逐个写 URL pattern 更不容易漏掉 WebSocket。
 */
export const REMOTE_REQUEST_URL_FILTERS = ["<all_urls>"] as const;

export function isRemoteRequestUrl(rawUrl: string): boolean {
  try {
    const protocol = new URL(rawUrl).protocol;
    return (
      protocol === "http:" ||
      protocol === "https:" ||
      protocol === "ws:" ||
      protocol === "wss:" ||
      protocol === "ftp:"
    );
  } catch {
    return false;
  }
}

/** 只有 http(s) 能交给系统浏览器；file、data、javascript 等协议不得外抛。 */
export function isExternalWebUrl(rawUrl: string): boolean {
  try {
    const protocol = new URL(rawUrl).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

/** 允许本地入口本身及其 hash 路由；其他文件、查询参数与远端导航全部拒绝。 */
export function isAppEntryUrl(rawUrl: string, entryUrl: string): boolean {
  try {
    const candidate = new URL(rawUrl);
    const entry = new URL(entryUrl);
    return (
      candidate.protocol === "file:" &&
      entry.protocol === "file:" &&
      candidate.host === entry.host &&
      candidate.pathname === entry.pathname &&
      candidate.search === entry.search
    );
  } catch {
    return false;
  }
}
