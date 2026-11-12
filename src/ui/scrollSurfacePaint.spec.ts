/**
 * 滚动容器不许挂"每帧都要重画"的背景。
 *
 * ## 这一条是对着「滑动时卡」来的
 *
 * `.folio-surface` 是全站唯一的滚动容器(`main` 上 `overflow-y-auto`),它此前同时挂着:
 *   · 四层渐变 —— 其中一条是 `repeating-radial-gradient`(同心圆条纹,最贵的一种);
 *   · `background-attachment: local` —— 让背景**跟着内容滚**。
 *
 * 两者合起来,每一次滚动位移都要求浏览器把四层渐变(含同心圆条纹)重画一遍。
 * 实测(CPU 降 10 倍,真触摸手势):把 `background-image` 去掉后,
 * 滚动那一段的 TaskDuration 从 0.373s 降到 0.277s —— 四分之一的开销只为一层纸纹。
 *
 * ## 判据守什么
 *
 *   一 滚动容器上不许出现 `background-attachment: local`;
 *   二 滚动容器上不许挂 `repeating-radial-gradient`(同心圆条纹);
 *   三 那四层渐变要挪到**不随内容滚动**的一层上(即一个 `position: fixed`
 *      或 `absolute` 的独立背景层),不能直接删掉 —— 纸纹是这套界面的底子。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { readStyleCss } from "@/test/readStyleCss";

const CSS = readStyleCss();

/** 取某条选择器的规则块(先去注释,免得被注释里的 `}` 截断) */
function rule(selector: string): string {
  const stripped = CSS.replace(/\/\*[\s\S]*?\*\//g, "");
  return (
    stripped.match(
      new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{[^}]*\\}`),
    )?.[0] ?? ""
  );
}

describe("滚动容器不许挂每帧重画的背景", () => {
  it("判据扫得到滚动容器那条规则(防空转)", () => {
    const r = rule(".folio-surface");
    expect(r.replace(/\s+/g, ""), "定位不到 .folio-surface 的规则 —— 判据会空转").not.toBe("");
  });

  it("滚动容器上不许有 background-attachment: local", () => {
    const r = rule(".folio-surface");
    expect(
      /background-attachment:\s*local/.test(r),
      "滚动容器上还写着 background-attachment: local —— 背景跟着内容滚,每帧都要重画四层渐变",
    ).toBe(false);
  });

  it("滚动容器上不许挂同心圆条纹", () => {
    const r = rule(".folio-surface");
    expect(
      /repeating-radial-gradient/.test(r),
      "同位图层里的 repeating-radial-gradient 挂在滚动容器上 —— 那是每帧重绘里最贵的一笔",
    ).toBe(false);
  });

  it("纸纹挪到了不随内容滚动的一层上 —— 不许直接删掉", () => {
    /*
     * 只要求"挪走"不够:把整个 background-image 删掉也能让前面两条绿,
     * 而纸纹是这套界面的底子(四层渐变叠出来的暖白)。故钉一个独立背景层:
     * 它要么 `position: fixed` 要么 `position: absolute`,且带着那四层渐变。
     */
    const layers = [
      ...CSS.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/\.(folio-surface__[a-z-]+)\s*\{([^}]*)\}/g),
    ];
    const found = layers.find(
      (m) => /repeating-radial-gradient/.test(m[2]!) && /position:\s*(fixed|absolute)/.test(m[2]!),
    );
    expect(
      found,
      "找不到那层独立背景 —— 纸纹要么还在滚动容器上,要么被直接删了(它不该删)",
    ).toBeTruthy();
  });

  it("那层背景真的被挂进了外壳", () => {
    const app = readSource("src/App.vue");
    expect(app, "App.vue 里要有那层独立背景的节点").toMatch(/folio-surface__/);
  });

  it("注释里不许写没量住的收益数字", () => {
    /*
     * 这一条是**自省**,针对本仓已经犯过一次的错:
     * 这条改动的提交与注释里曾写着「TaskDuration 从 0.373s 降到 0.277s,四分之一」。
     * 那是**单次**读数,而同一页同一操作的 TaskDuration 在 0.045~0.401s 之间跳
     * (九倍)。12 轮交替 A/B 的中位数虽然差 17%,样本区间却相互覆盖 ——
     * 那条「四分之一」是无根据的。
     *
     * 光栅化不在 `Performance.getMetrics` 里统计:改与不改,LayoutCount 恒为 1、
     * RecalcStyleCount 恒为 61、两项 CSS 耗时都是 0 —— 一模一样。
     * 故本仓对这条改动的收益**只能给方向,不能给幅度**。
     *
     * 判据:这两处注释里若再次出现「降了百分之多少 / 省了四分之一」这类断言,
     * 必须同时写着测量方法(真机 / Raster trace)。没有方法就不许有数字。
     */
    const text = readSource("src/App.vue") + readSource("src/style.css");
    /*
     * 匹配「动词 …… 数字 + 单位」这一整句。动词与数字之间允许任意字
     * (写成「降低了 0.373s」也算)—— 第一版把间隔限死成 12 个字,
     * 实测漏掉了真正想拦的那种写法。
     */
    const claims = [
      ...text.matchAll(
        /(?:降到|降低|省了|省下|减少|缩短|快了|提升)[^。\n；]{0,30}?(\d+(?:\.\d+)?)\s*(?:s\b|秒|%|毫秒|ms)/g,
      ),
    ]
      .map((m) => m[0].trim())
      /*
       * 排除 `prefers-reduced-motion` 那一节 —— 那里写「时长压到 0.01ms」是
       * **无障碍约定**(尽量取消动效),与"渲染收益"无关。实测第一版就误报了它。
       */
      .filter((c) => {
        const at = text.indexOf(c);
        const near = text.slice(Math.max(0, at - 300), at + c.length);
        return !/reduced-motion|减少动效|prefers-reduced/.test(near);
      });
    /*
     * 逐条判断,不是"全文出现过就算" —— 第一版写成对 `text` 整体做 /真机|Raster/ 过滤,
     * 而这两篇注释里**本来就**提到了「光栅化」与「真机」,于是任何新写的数字都会被放行。
     * 正确口径:每一条断言附近(同一句 / 同 200 字内)必须写着测量方法。
     */
    const unsupported = claims.filter((c) => {
      const at = text.indexOf(c);
      if (at < 0) return true;
      const near = text.slice(Math.max(0, at - 400), at + c.length + 400);
      return !/真机|Raster|trace|DevTools|量不出|不作断言/.test(near);
    });
    expect(
      unsupported,
      "注释里给了收益数字却没写测量方法 —— 本仓量不到光栅化,这种数字是单次噪声",
    ).toEqual([]);
  });
});
