/**
 * `main.ts` 的装配顺序 —— 三步都不能颠倒。
 *
 * 这个文件只有 104 行,却是整个应用的启动入口。它做的每件事**改错了都不报错**:
 * 少接一根线,表现只是"某个功能静默不工作",而玩家与开发者都不一定当场发现。
 *
 * 已有一条守它:⑩ `core/startupOrder.spec` 管「先抢写者席位、再碰盘」。
 * 这里补另外两步。
 *
 * ## 一、诊断端口要先接上,再让引擎跑
 *
 * `useDiagStore()` 的 setup 里会 `setRuntimeDiagnosticSink(...)`。而
 * `recordRuntimeDiagnostic` 内部是 `sink?.(input)` —— **sink 还没接上时,
 * 异常会被静默丢掉**,没有任何报错。所以它必须排在 `app.mount()` 之前:
 * 挂载之后引擎就开始跑心跳,那之后的运行期异常才留得下来。
 *
 * ## 二、字体延迟挂载要在挂载之后
 *
 * `scheduleLateKaiFaces()` 把 21 条 `@font-face` 挪到浏览器空闲时注入,目的是让首屏
 * 只管第一片。排在 `app.mount()` 之前是没用的:那时正文还没渲染,浏览器没有"空闲",
 * 注入会跟首屏抢带宽 —— 正是它想避免的事。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");
const MAIN = readFileSync(join(ROOT, "src/main.ts"), "utf-8");
const CODE = MAIN.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** 某段第一次出现的位置;-1 = 没有 */
const at = (needle: string): number => CODE.indexOf(needle);

describe("main.ts 装配顺序", () => {
  it("三步都在 —— 判据的前提还在", () => {
    // 防空转:任何一个被改名/删掉,后面的位置比较会退化成 -1 比 -1,永远通过
    expect(at("useDiagStore()"), "main.ts 里找不到 useDiagStore()").toBeGreaterThan(0);
    expect(at('app.mount("#app")'), "main.ts 里找不到 app.mount").toBeGreaterThan(0);
    expect(at("scheduleLateKaiFaces()"), "main.ts 里找不到 scheduleLateKaiFaces()").toBeGreaterThan(
      0,
    );
  });

  it("诊断端口在挂载之前接上 —— 否则引擎跑起来后的异常会被静默丢掉", () => {
    /*
     * `recordRuntimeDiagnostic` 是 `sink?.(input)`:sink 为 null 时什么都不做、
     * 也不报错。晚接一拍,挂载到接上之间那段窗口里的异常就没了。
     */
    expect(
      at("useDiagStore()"),
      "useDiagStore() 排在了 app.mount 之后 —— 挂载后引擎立刻开跑," +
        "那之后的运行期异常会因为 sink 还没接上而静默丢失",
    ).toBeLessThan(at('app.mount("#app")'));
  });

  it("字体延迟挂载在挂载之后 —— 排在前面会跟首屏抢带宽", () => {
    expect(
      at("scheduleLateKaiFaces()"),
      "scheduleLateKaiFaces() 排在了 app.mount 之前 —— 那时正文还没渲染、" +
        "浏览器没有空闲,注入会与首屏抢带宽,正是它想避免的事",
    ).toBeGreaterThan(at('app.mount("#app")'));
  });

  it("pinia 装到 app 上之前不建 store —— 否则拿到的是另一个实例", () => {
    /*
     * `app.use(pinia)` 之前调 `useXxxStore()`,pinia 会自己造一个临时实例,
     * 之后再 mount 就换成了 app 上挂的那个 —— 两处状态从此各走各的。
     */
    const piniaAt = at("app.use(pinia)");
    expect(piniaAt, "找不到 app.use(pinia)").toBeGreaterThan(0);
    const firstStore = ["useDiagStore()", "useUiStore()", "useGameStore()"]
      .map((n) => at(n))
      .filter((i) => i > 0)
      .sort((a, b) => a - b)[0];
    expect(firstStore, "main.ts 里一个 store 都没建?").toBeDefined();
    expect(
      piniaAt,
      "pinia 还没装到 app 上就建了 store —— 会拿到一个临时实例,与挂载后的那个不是同一份状态",
    ).toBeLessThan(firstStore!);
  });
});
