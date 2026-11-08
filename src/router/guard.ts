/**
 * 路由准入 —— **纯函数**,只看两个事实:有没有存档、隐私同意没同意。
 *
 * ## 为什么抽出来
 *
 * 这段原先直接写在 `router.beforeEach` 里,只能靠"起一个真浏览器点一遍"来验,
 * 而它守的是**能不能进游戏**这件事:改错一个分支,玩家会卡在欢迎页、或者没建号
 * 就进了主界面 —— 两种都不会报错,只是不对劲。
 *
 * 抽成纯函数之后,每个分支都能直接断言(见 `router/guard.spec`)。
 * 路由注册那一步仍然是薄接线:读两个 store,交给它。
 *
 * ## 三条规则
 *
 *   ① 已有存档 → 欢迎页 / 建号页都不再展示(否则玩家刷新会退回建号)
 *   ② 无存档 + 没同意隐私 → 一律回欢迎页(建号页也不给进)
 *   ③ 无存档 + 已同意隐私 → 建号页放行,但别的页面仍回欢迎页
 */
export function routeAdmit(
  toName: string | undefined,
  ctx: { started: boolean; privacyAccepted: boolean },
): true | { name: string } {
  if (ctx.started) {
    // ① 有档了还去欢迎/建号,是刷新或手改地址栏 —— 送回主界面
    if (toName === "welcome" || toName === "create") return { name: "home" };
    return true;
  }
  // ② 没存档时,除了欢迎页哪儿都去不了
  if (toName === "welcome") return true;
  // ③ 建号页要先同意隐私;其余页面(含未知路径)回欢迎页
  if (toName === "create" && ctx.privacyAccepted) return true;
  return { name: "welcome" };
}
