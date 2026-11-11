/**
 * 画在矮条里不该被裁掉天 —— 一道跨 20 个页面的老伤。
 *
 * ## 现象(真浏览器量到)
 *
 * `InkScene` 的画布按 420×160 定比例、贴容器**下缘**。容器比 420/160 矮时,
 * 多出来的那一段在容器上方,正好是**天**(月、日、雀、云、雪)。
 * 实测修行页卷首那一条:容器 116px,画 149px —— 天空点景 5 枚里**裁掉 2 枚**
 * (月与一只雀),而那两枚恰恰是「修行页今天是什么天」的唯一那点画面。
 *
 * 首页 150px 正好不裁,于是这条伤只在矮条上现形 —— 加画的那几轮里,
 * 每次都是「这一屏量了、那一屏没量」。
 *
 * ## 修法
 *
 * 容器矮于 420/160 时,**按高度反推宽度**、让画整体等比缩小并居中,
 * 而不是把天裁掉:宁可在左右留一点空白(本来也是淡墨),也要留住「天」。
 *
 * 判据钉在**几何**上,不钉具体页面 —— 免得下一处矮条又漏:
 *   一 画布高度不超过容器(不纵向溢出);
 *   二 画布宽高比保持 420/160(不拉伸);
 *   三 容器矮于比例时,画布仍贴下缘(山脚对齐地面)。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

const SCENE = "src/components/common/InkScene.vue";

describe("山水画在矮条里的适配", () => {
  it("画布不纵向溢出容器", () => {
    const css = readSource(SCENE);
    const rule = css.match(/\.ink-scene__draw\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(rule, "定位不到 .ink-scene__draw —— 判据会空转").not.toBe("");
    /*
     * 原来是 `height: auto` + `aspect-ratio` —— 定宽之后高度被比例推出来,
     * 容器矮时它比容器高,于是天被裁。要钉的是「高度不超过容器」。
     *
     * 只查 `max-height: 100%` 出现过不够:第一次写成 `toMatch(/max-height:/)`,
     * 把那一行**删掉**判据照样绿(它匹配的是别处的字面)。故先取 `max-height`
     * 的值,再逐字比对 —— 删了取不到值,改了值比不上,两种都会被抓住。
     */
    /*
     * 先去注释再取声明 —— 这一条规则里那段长注释也写着 `max-height: 100%`,
     * 不去注释就会取到**注释里**那一句,于是「把声明删掉」反而能让判据变绿
     * (实测:第一版就是这么漏的)。声明与注释必须分开读。
     */
    const decls = rule.replace(/\/\*[\s\S]*?\*\//g, "");
    const maxH = decls.match(/max-height:\s*([^;]+);/)?.[1]?.trim();
    expect(maxH, "画布高度不能超过容器 —— 超过就是把天裁掉(实测修行页 5 枚点景裁掉 2 枚)").toBe(
      "100%",
    );
    expect(rule, "比例要守住 420/160").toMatch(/aspect-ratio:\s*420\s*\/\s*160/);
  });

  it("矮条里画布贴下缘,不浮在半空", () => {
    const css = readSource(SCENE);
    const rule = css.match(/\.ink-scene__draw\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(rule, "山脚要贴地面").toMatch(/bottom:\s*0/);
    expect(rule, "左右要能自己让出空白").toMatch(/(left|inset-inline):\s*(0|auto)/);
  });
});
