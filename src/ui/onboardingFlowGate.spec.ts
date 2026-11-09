/**
 * 开局三步 —— 从零到能玩，这条路必须自己走得通
 *
 * ## 缺口:开局两页有版面判据,没有**流程**判据
 *
 * `scripts/layout-check.mjs` 的 `taskPreGameTour` 量的是 `/welcome` 与 `/create`
 * 的**版面**(溢出、控件触达、对比度),可它从不点下去 —— 也就是说,
 * 「从空存档点进游戏」这条路**从来没有被判据走过一遍**。
 *
 * 而巡页的 ROUTES 里明确不含这两页(路由守卫见存档已开就把它们重定向回首页),
 * 于是别的任务也到不了。结果:开局三步的**串联**完全没被守过 ——
 * 只要有一处按钮点了没反应、或某个 `setTimeout` 断了,全绿的门看不出来,
 * 而这是**每个新玩家必经**的唯一入口。
 *
 * ## 这条路有三道坎,每道都能单独断
 *
 * ```text
 *   欢迎页「启封入山」→ 入山契弹窗(须勾选同意,否则署印键 disabled)
 *                     → 署印入山(warp 动画 2.5 秒后 push #/create)
 *                     → 建号页「踏入仙途」→ 首页
 * ```
 *
 * 三处都是**带条件的异步**:弹窗不勾选就点不动、warp 未结束路由还没换。
 * 判据要按玩家的真实节奏等,不能点完立刻断言 —— 否则只会得到假红。
 *
 * ## 这一份测的是什么、不测什么
 *
 * 测:三段是否真的推进、每段是否出现该出现的东西、结束后是否真的进了首页。
 * 不测:文案好坏、版面美丑(那是 taskPreGameTour 的事)。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

const gate = () => readSource("scripts/layout-check.mjs");

describe("开局三步 · 门禁要真的走一遍", () => {
  it("门里有一条「从空存档走完开局」的任务", () => {
    const src = gate();
    expect(src, "要有一个专门走开局的判据").toContain("taskOnboardingFlow");
    expect(src, "它要挂进任务表").toMatch(/taskOnboardingFlow\b[\s\S]{0,80}(runTask|await|tasks)/);
  });

  it("三道坎各走一遍 —— 不是只量版面", () => {
    const src = gate();
    const at = src.indexOf("async function taskOnboardingFlow");
    expect(at, "找不到这个任务 —— 判据会空转").toBeGreaterThan(0);
    const body = src.slice(at, at + 8000);
    // 一:欢迎页的启封键
    expect(body, "要真点「启封入山」").toContain("[data-opening-enter]");
    // 二:入山契的勾选与署印
    expect(body, "要真勾选入山契").toMatch(/checkbox/);
    expect(body, "要真点署印入山").toMatch(/署印入山/);
    // 三:建号页的踏入仙途
    expect(body, "要真点踏入仙途").toMatch(/踏入仙途|踏\s*入\s*仙\s*途/);
  });

  it("按真实节奏等路由,不点完立刻断言", () => {
    /*
     * 署印之后有个 2.5 秒的 warp 动画才 `router.push("/create")`。
     * 点完立刻读 location.hash 只会读到 #/welcome —— 假红。
     * 判据必须**等路由真的变了**(waitForFunction),而不是 `sleep` 一个魔法数。
     */
    const src = gate();
    const at = src.indexOf("async function taskOnboardingFlow");
    const body = src.slice(at, at + 8000);
    expect(body, "要等路由真的变,不用固定 sleep 猜").toMatch(/waitForFunction|waitForURL/);
  });

  it("结束时要断言真的进了首页 —— 不是「没报错就算过」", () => {
    const src = gate();
    const at = src.indexOf("async function taskOnboardingFlow");
    const body = src.slice(at, at + 8000);
    expect(body, "要核最终落在首页").toMatch(/#\/(home)?['"`]|location\.hash/);
    expect(body, "要核首页真有内容").toMatch(/innerText|textContent/);
  });

  it("空存档要真从零起 —— 不许借展品档蒙混", () => {
    /*
     * 这条路的全部价值在于「新玩家第一次打开」。若夹具里有存档,
     * 路由守卫会把 /welcome 重定向回首页,这条路根本走不到 ——
     * 判据会一路绿着而没有信息。
     */
    const src = gate();
    const at = src.indexOf("async function taskOnboardingFlow");
    const body = src.slice(at, at + 8000);
    expect(body, "开局任务不许 seedSave").not.toMatch(/seedSave\(/);
  });
});
