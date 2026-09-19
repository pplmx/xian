/**
 * 浏览器自检的共用尺子 —— 三条门(排版 / 冒烟 / 离线)共用这一处。
 *
 * 两件事:
 *   · `watchPageErrors(page, sink)` —— 收集页面异常(pageerror),交给调用方判失败;
 *   · `blockExternal(pageOrContext, allow)` —— 拦掉外域请求,把拦下的条数交回去。
 *
 * 这个仓库的决定是**不发任何外部请求**(页面不加载外部脚本、页面与产物里都没有外链;
 * 见 index.html 与隐私声明第六节),所以 `blockExternal` 首先是**量尺**:
 * 拦下的条数应当恒为 **0**(判据在 layout-check 与 ui-smoke 的收尾处)。
 * 其次它也是防线:万一将来有人顺手加了外链,门会在**这里**红 ——
 * 而不是让别人的服务器决定我们的门要不要绿(挂住一个外链脚本,`goto(..., { waitUntil: 'load' })`
 * 就会等它;实测过:页面 30 秒没到 load,而本地断网反而复现不出来)。
 *
 * 不用"按域名断解析"(`--host-resolver-rules`)那套:它只挡得住你**已经知道**的那个域名,
 * 多接一个外链门又变脆。
 *
 * **一处例外(实测出来的)**:离线自检有 Service Worker,不能用它 —— 请求级拦截会
 * **连 SW 自己发起的抓取一起截走**,被截过的响应不再是 `basic` 类型,SW 里的 `cache.put`
 * 会静默跳过,于是缓存空掉、断网重载落到 503 兜底页(同一份代码:拦着跑 → 缓存 0 条;不拦 → 27 条)。
 * 那条门因此不挂拦截:它量的正是缓存,而"零外部请求"这条承诺由另两条门与产物静态检查一起守着。
 */

export function watchPageErrors(page, sink) {
  // sink 既可以是数组(多数调用方),也可以是回调(冒烟脚本还要给异常配一处出处)
  const report = typeof sink === 'function' ? sink : msg => sink.push(msg)
  page.on('pageerror', e => report(String(e).slice(0, 160)))
}

/**
 * 拦掉外域请求 —— 三条浏览器自检共用。
 *
 * 为什么要有它:这个仓库的决定是**不发任何外部请求**(见 index.html 与隐私声明第六节),
 * 所以它首先是**量尺**:拦下的条数应当恒为 0。其次才是防线 —— 从前页面里挂着第三方统计
 * (一条 `defer` 的第三方脚本),`goto(..., { waitUntil: 'load' })` 要等它执行完,对方慢一点
 * (或 CI 出口被墙),整条门就会以"30 秒超时"红掉:实测红过一次,别人的服务器在决定我们的门要不要绿。
 *
 * 这道门量的是**我们自己的排版与交互**,所以一律拦掉外域请求;真要放行的(比如离线自检的
 * 本地 http 服务)用 `allow` 传前缀进来。
 *
 * 为什么不用"按域名断解析"(`--host-resolver-rules`)那套(冒烟从前用的就是它):
 * ① 它只挡得住你**已经知道**的那个域名 —— 多接一个第三方,门又变脆;
 * ② 实测断掉它并**不省时间**(本地一轮冒烟 5 分 03 秒 → 5 分 31 秒,那五分钟花在 67 次点击上),
 *    用它的理由从来是**确定性**,而不是快(那会儿 CI 有网,第三方脚本会真的加载并抛异常)。
 * 现在第三方脚本已经整个删掉,这两条都成了历史;留着 `blockExternal` 是因为它是**量尺**。
 *
 * **但有一处例外,是实测出来的**:离线自检(有 Service Worker 的那条)不能用它 ——
 * 请求级拦截会**连 SW 自己发起的抓取一起截走**,被截过的响应不再是 `basic` 类型,
 * SW 里的 `cache.put` 会静默跳过,于是缓存空掉、断网重载落到 503 兜底页
 * (同一份代码:拦着跑 → 缓存 0 条;不拦 → 27 条)。那条门因此**不挂拦截**:
 * 它量的正是缓存,而"零外部请求"这条承诺由另两条门与下面这条静态检查一起守着。
 *
 * @param pageOrContext playwright 的 Page 或 BrowserContext
 * @param allow 允许的前缀(如 `['http://127.0.0.1']`)
 */
export async function blockExternal(pageOrContext, allow = []) {
  let blocked = 0
  await pageOrContext.route('**/*', route => {
    const url = route.request().url()
    const allowed = /^(file|data|blob):/.test(url) || allow.some(prefix => url.startsWith(prefix))
    if (allowed) return route.continue()
    blocked += 1
    return route.abort()
  })
  return () => blocked
}
