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
});
