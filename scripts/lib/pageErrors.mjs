/* eslint-disable no-console -- 这里输出的是报告里的一句话注记 */
/**
 * 页面异常分流 —— 三条浏览器自检(排版 / 冒烟 / 离线)共用的一把尺子。
 *
 * 为什么要有这一处:第三方统计脚本(sdk.51.la)在**有网**的机器上会自己抛异常
 * (实测「Invalid UUID」)。它既不是我们的代码,也不影响界面契约,可它混在
 * pageerror 里足以把一条判据染红 —— 而这种假红最难查:本地断网根本复现不出来。
 *
 * 从前三条自检各写了一份 pageerror 收集,口径已经开始漂:只有排版自检做了分流,
 * 另两条是裸收。冒烟要接进 CI(有网)之前,先把这件事收成一处。
 */

/**
 * 挂上 pageerror 分流:
 *   · 出处带 sdk.51.la 的 —— 只提示一次,**不进 sink**(不计入失败);
 *   · 其余一律进 sink,由调用方判失败。
 */
export function watchPageErrors(page, sink) {
  // sink 既可以是数组(多数调用方),也可以是回调(冒烟脚本还要给异常配一处出处)
  const report = typeof sink === 'function' ? sink : msg => sink.push(msg)
  let thirdPartyNoted = false
  page.on('pageerror', e => {
    const stack = String(e.stack || e.message || '')
    if (/sdk\.51\.la/.test(stack)) {
      // 逐页重载会把它重复抛出来,同一处只提一次,免得报告被噪声淹没
      if (!thirdPartyNoted) {
        thirdPartyNoted = true
        console.log(`  (第三方统计脚本异常,不计入失败:${String(e.message).slice(0, 60)})`)
      }
      return
    }
    report(String(e).slice(0, 160))
  })
}

/**
 * 拦掉外域请求 —— 三条浏览器自检共用。
 *
 * 为什么单立一条:页面里挂着第三方统计(`sdk.51.la`)。它挂在 `watchPageErrors` 那一层
 * 已经被分流了(它的异常不计入失败),但它**卡住请求**这件事分流不了 ——
 * `goto(..., { waitUntil: 'load' })` 要等 `defer` 脚本执行完,对方服务器慢一点(或 CI 出口被墙),
 * 整条门就会以"30 秒超时"红掉。实测红过一次:排版自检跑到最后一段,页面 30 秒没到 load,
 * 日志里满屏"第三方统计脚本异常" —— 那是别人的服务器在决定我们的门要不要绿。
 *
 * 这道门量的是**我们自己的排版与交互**,所以一律拦掉外域请求;真要放行的(比如离线自检的
 * 本地 http 服务)用 `allow` 传前缀进来。
 *
 * 为什么不用"按域名断解析"(`--host-resolver-rules`)那套(冒烟从前用的就是它):
 * ① 它只挡得住你**已经知道**的那个域名 —— 新接一个第三方,门又变脆;
 * ② 实测断掉它并**不省时间**(本地一轮冒烟 5 分 03 秒 → 5 分 31 秒,那五分钟花在 67 次点击上),
 *    留着它的理由从来是**确定性**,而不是快:
 *    CI 有网,统计脚本会真的加载并跑起来(在钉死 Math.random 的环境里它自己抛 Invalid UUID),
 *    门里不该混进第三方的可用性问题 —— 异常分流是兜底,能不让它进来就别让它进来。
 * 现在收成一处,并且把拦下的条数印出来(证明这条拦截是活的)。
 *
 * **但有一处例外,是实测出来的**:离线自检(有 Service Worker 的那条)不能用它 ——
 * 请求级拦截会**连 SW 自己发起的抓取一起截走**,被截过的响应不再是 `basic` 类型,
 * SW 里的 `cache.put` 会静默跳过,于是缓存空掉、断网重载落到 503 兜底页
 * (同一份代码:拦着跑 → 缓存 0 条;不拦 → 27 条)。那条门的处理方式是
 * "从它自己那份副本里摘掉统计外链" —— 它量的正是缓存,不该让第三方进来,也不该用会改变
 * 响应类型的手段。
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
