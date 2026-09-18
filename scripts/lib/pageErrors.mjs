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
 * 断掉分析脚本的域名解析 —— 给「不该被第三方牵着走」的调用方用。
 *
 * 说明(实测,别照抄想当然的理由):本地一轮冒烟 5 分 03 秒 → 断掉后 5 分 31 秒,
 * **并不省时间** —— 那五分钟花在 67 次点击与每处的等待上,与网络无关(本地无网,
 * 那段脚本本来就加载不出来)。留着它的理由是**确定性**:CI 有网,统计脚本会真的
 * 加载并跑起来(它在钉死 Math.random 的环境里会自己抛 Invalid UUID,见
 * layout-check 的同源记录),门里不该混进第三方的可用性问题 ——
 * 异常分流是兜底,能不让它进来就别让它进来。
 */
export const ANALYTICS_BLOCKED_ARGS = ['--host-resolver-rules=MAP sdk.51.la ~NOTFOUND']
