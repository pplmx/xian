/**
 * 楷体「其余片」的 @font-face —— 在正文可读之后才挂上。
 *
 * ## 为什么要拆
 *
 * 楷体按用法频次切成 22 片,每片一条 `@font-face`(靠 `unicode-range` 让浏览器
 * 只取页面真用到的那些字)。原先 22 条**全部**写在 `kai-subset.css`,而它被
 * `style.css` 的 `@import` 拉进入口样式表 —— 于是 22 条的 `unicode-range`
 * (41.9KB 的码位数字表,5580 段区间)全压在**渲染阻塞**路径上。
 *
 * 而首屏真正需要的只有第一片:开卷页那几十个楷体字全在第一片里,判据在
 * `src/ui/kaiFontCoverage.spec.ts`。其余 21 条管的是日后才出现的生僻字,浏览器
 * 本来也要等到那些字上屏才会去取对应的 woff2 —— 声明早到晚到,对首屏没有区别。
 *
 * 实测(同一份 dist,只把其余 21 条从入口 CSS 里摘掉):
 *
 * ```text
 *   22 条全在:  FCP 1332ms · 入口 CSS 208KB
 *   只留第一片:FCP 1108ms · 入口 CSS 163KB   (省 224ms / 45KB)
 * ```
 *
 * ## 为什么是 <style> 而不是异步 <link>
 *
 * 一条后加的 `<link rel=stylesheet>` 在多数浏览器里仍会参与渲染阻塞判断(它到了
 * 之前不能保证样式完整),等于把阻塞挪了个位置。注入 `<style>` 不会:它已经是
 * 解析好的规则,挂上即生效,不产生新的网络往返。
 *
 * ## 什么时候挂
 *
 * `requestIdleCallback`(退化到 `requestAnimationFrame` + 定时器)。要的是「正文
 * 已经能读」这一刻之后 —— 早于它挂,就又变成和首屏抢主线程。
 *
 * ## 这份 CSS 为什么是**动态导入**
 *
 * 静态 `?inline` 会把这段 CSS 整段编进**入口 JS 分块**(实测 +48KB 到 `index-*.js`)
 * —— 那只是把 44.5KB 从「阻塞渲染的 CSS」挪到「首屏必下的 JS」,总字节一点没少。
 * 动态导入会把它落成独立分块,浏览器只在空闲时那一次才去取。
 *
 * 这段 CSS 由 `scripts/fonts/build-kai-font.py` 生成(与字体产物同一轮),**不要手改**。
 */
const lateFacesCss = (): Promise<string> =>
  import("@/assets/fonts/kai-subset-rest.css?inline").then((mod) => mod.default);

/** 已经挂过就不重复挂(热更新、多次调用都安全) */
let attached = false;

/** 挂上其余片的 @font-face;重复调用是空操作 */
export async function attachLateKaiFaces(): Promise<void> {
  if (attached || typeof document === "undefined") return;
  attached = true;
  const css = await lateFacesCss();
  const style = document.createElement("style");
  style.dataset.kaiLateFaces = "";
  style.textContent = css;
  document.head.appendChild(style);
}

/**
 * 排到浏览器空闲时挂 —— 入口只需调一次。
 *
 * 用 `requestIdleCallback` 的 timeout 兜底:某些浏览器(旧 Safari)没有这个 API,
 * 而只在 rAF 里挂也会撞上首帧合成,故两条路都留。
 */
export function scheduleLateKaiFaces(): void {
  if (attached || typeof window === "undefined") return;
  const run = (): void => void attachLateKaiFaces();
  const idle = (
    window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void }
  ).requestIdleCallback;
  if (typeof idle === "function") idle(run, { timeout: 2000 });
  else window.setTimeout(run, 1200);
}
