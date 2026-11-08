/**
 * 路由准入 —— 能不能进游戏,由三条规则决定。
 *
 * ## 为什么值得单测
 *
 * 这段逻辑原先写在 `router.beforeEach` 里,只能靠起真浏览器点一遍来验。
 * 而它改错时**不会报错**:玩家会卡在欢迎页出不来,或者没建号就进了主界面 ——
 * 两种都是"看起来不太对",而不是崩。抽成 `routeAdmit` 纯函数之后,每个分支
 * 都能直接断言。
 *
 * 三条规则:
 *   ① 已有存档 → 欢迎页 / 建号页都不再展示
 *   ② 无存档 + 没同意隐私 → 一律回欢迎页
 *   ③ 无存档 + 已同意隐私 → 建号页放行,别的页面仍回欢迎页
 */
import { describe, expect, it } from "vite-plus/test";
import { routeAdmit } from "./guard";

const STARTED = { started: true, privacyAccepted: false };
const FRESH_NO_PRIVACY = { started: false, privacyAccepted: false };
const FRESH_PRIVACY = { started: false, privacyAccepted: true };

describe("路由准入 · 有存档之后", () => {
  it("欢迎页与建号页都送回主界面 —— 刷新不该退回建号", () => {
    expect(routeAdmit("welcome", STARTED)).toEqual({ name: "home" });
    expect(routeAdmit("create", STARTED)).toEqual({ name: "home" });
  });

  it("其余页面一律放行", () => {
    for (const name of ["home", "cultivation", "inventory", "settings", undefined]) {
      expect(routeAdmit(name, STARTED), `${name} 该放行`).toBe(true);
    }
  });
});

describe("路由准入 · 还没有存档", () => {
  it("没同意隐私:除了欢迎页,哪儿都去不了", () => {
    expect(routeAdmit("welcome", FRESH_NO_PRIVACY)).toBe(true);
    for (const name of ["create", "home", "cultivation", undefined]) {
      expect(routeAdmit(name, FRESH_NO_PRIVACY), `${name} 该回欢迎页`).toEqual({
        name: "welcome",
      });
    }
  });

  it("同意隐私之后:建号页放行,但别的页面仍回欢迎页", () => {
    expect(routeAdmit("create", FRESH_PRIVACY)).toBe(true);
    // 这一条最容易被改漏:同意了隐私就顺手全部放行,于是可以绕过建号直接进游戏
    for (const name of ["home", "cultivation", undefined]) {
      expect(routeAdmit(name, FRESH_PRIVACY), `${name} 不该绕过建号`).toEqual({
        name: "welcome",
      });
    }
  });
});

describe("路由准入 · 两条规则的边界", () => {
  it("有存档时隐私同意与否都不影响 —— 存档比隐私设置更权威", () => {
    for (const privacyAccepted of [true, false]) {
      expect(routeAdmit("welcome", { started: true, privacyAccepted })).toEqual({ name: "home" });
      expect(routeAdmit("home", { started: true, privacyAccepted })).toBe(true);
    }
  });

  it("未知路径在无存档时也被挡住 —— 不能靠手改地址栏绕进游戏", () => {
    expect(routeAdmit("someUnknownRoute", FRESH_PRIVACY)).toEqual({ name: "welcome" });
    expect(routeAdmit("", FRESH_PRIVACY)).toEqual({ name: "welcome" });
  });
});
