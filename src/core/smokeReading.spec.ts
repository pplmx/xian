/**
 * 界面冒烟的**读数口径**(ui-smoke 只在 check:ui 与 CI 里跑,读数失准没有别的信号)。
 *
 * 这个脚本最容易坏的地方不是"点不到按钮",而是**量到的不是要量的事** ——
 * 它报出来的两张表(慢步骤 / 点了没反应)是给人当线索用的,一旦常驻噪声,
 * 真事故就没人看。两次实测都是这个病:
 *
 *   ① 慢步骤:外层 `step("…弹窗内逐枚…")` 把最多 6 个弹窗按钮的固定
 *      `waitForTimeout(160)` 全算进自己,于是 /inventory 恒报 1.2–1.7s。
 *      那四条读数在报告里看着像"点开收纳真慢",实际上没有一行在量游戏。
 *   ② 点了没反应:主题/战报速度这类 `aria-pressed` 组,循环逐个点一遍,
 *      点到**当前已选**那一档时页面本就不该动,却被记成"没反应"。
 *
 * 静态判据钉住这两条口径 —— 谁把它们改回去,下面当场红,不必等五分钟的浏览器门
 * 再跑一轮才在报告里看见一行噪声。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SCRIPT = readFileSync(resolve(__dirname, "../../scripts/ui-smoke.mjs"), "utf-8");

describe("冒烟读数口径", () => {
  it("慢步骤只记叶子 —— 容器步骤把内层的固定等待加起来,不是游戏慢", () => {
    // 帧标记:谁有子步骤,谁就不记账(见 step() 的注释)
    expect(SCRIPT, "要有子步骤标记").toContain("hadChild");
    expect(SCRIPT, "进下一层时要把上一层标成有子步骤").toMatch(
      /stepFrames\[stepFrames\.length - 1\]\.hadChild = true/,
    );
    expect(SCRIPT, "记账前必须判叶子").toMatch(/if \(!frame\.hadChild && ms > 1000\)/);
    // 退回旧写法(无条件 push)会让 /inventory 那四条噪声立刻回来
    expect(SCRIPT).not.toMatch(/if \(ms > 1000\) slowSteps\.push/);
  });

  it("已按下的 aria-pressed 按钮点下去不变,不算「点了没反应」", () => {
    expect(SCRIPT, "要先读按下态").toContain("alreadyPressed");
    expect(SCRIPT, "按下态取自 aria-pressed").toMatch(/getAttribute\("aria-pressed"\) === "true"/);
    expect(SCRIPT, "记 silent 前要排除已按下").toMatch(/else if \(!alreadyPressed\) \{/);
  });

  it("导航类点击不许被当成「没反应」—— 指纹要含路由,且不变时再复检一次", () => {
    /*
     * 实测常驻噪声:/dongfu 与 /apprentice 的「← 返回」。goBack 真的换了页,
     * 但路由是懒加载分包 + 页面淡入,160ms 那一次采样时新页还没画出来,指纹自然没变。
     * 这张表是给人当线索用的:躺着两条"看着像事故、其实是采样太早"的行,
     * 真事故就会被当噪声忽略(与本文件 aria-pressed / 叶子步骤那两条同一个病)。
     *
     * 两个口径一起钉:一 路由进指纹(换页本身就是反应);二 首采样没变化时再等一次
     * 复检,仍一字不动才记 —— 只多一次 evaluate,且只在"看起来没反应"时才花。
     */
    expect(SCRIPT, "指纹要带上 location.hash").toMatch(/return `\$\{location\.hash\}\|/);
    // 首采样没变化时再等一次复检再记 —— 断言写成跨行容忍的形式:
    // 一条会因为格式化器换个行就误红的门,比没有门更糟(见第四十三条那句同样的话)
    expect(SCRIPT, "首采样没变化时必须复检,复检仍不动才记 silent").toMatch(
      /if \(after === beforeFp\) \{[\s\S]{0,120}waitForTimeout\(400\)[\s\S]{0,120}=== beforeFp[\s\S]{0,40}silent\.push/,
    );
  });

  it("点了没反应的判据仍认「不体现在文字上的变化」—— 别退回只看正文", () => {
    // 主题与战报速度改的是 CSS 变量与 aria-pressed,正文一个字都不变:
    // 指纹里少了这两样,它们每一轮都会被报成没反应(那次教训写进了 fingerprint 注释)
    expect(SCRIPT, "指纹要算 aria-pressed").toContain('querySelectorAll("[aria-pressed=true]")');
    expect(SCRIPT, "指纹要算 data-theme").toContain("data-theme");
    // 全文哈希,不只首尾 —— 变化发生在中段时首尾都不动
    expect(SCRIPT).toContain("const full = document.body.innerText");
  });

  it("报告里两张读数表都明写「不判失败」—— 它们是线索,不是门槛", () => {
    // 口径写在输出里,读报告的人才不会把读数当红看;若哪天它们真成了门槛,
    // 连同这两句与 check:ui 的接线一起改
    expect(SCRIPT).toContain("单步 >1s 的等待 ${slow.length} 处(读数,不判失败)");
    expect(SCRIPT).toContain("点了没反应 ${silent.length} 处(读数,不判失败)");
  });
});
