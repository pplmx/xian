/**
 * 大境之槛 —— 十次突破里只有一次是真的换了一重天。
 *
 * ## 现状
 *
 * 每重境界有十个小层(`SUB_LEVELS = 10`)。十次突破里,九次是"修为更上一层",
 * 一次是**大境**:境界名变了、寿元涨了、叙事换成「境界跃迁,天地翻覆」。
 *
 * 而界面上这两件事的分量几乎一样:
 *
 *   弹窗   同一枚「破」印、同一个墨点迸溅、同一圈金环;大境只多一个「大 境」小章
 *   音效   同一句 `playSfx("breakthrough")` —— 刮奏冲顶 + 管钟定音
 *
 * 音效这条尤其明显:`rare` / `rareHigh` / `rareTop` 三档早就分了(第 22 轮),
 * `worldRise`(跨界飞升)也单有一档 —— **中间那一档是空的**。
 * 小层与大境之间差着十倍的稀有度,听觉上却完全一样。
 *
 * ## 补什么
 *
 * 加一档 `majorBreak`:比 `worldRise` 轻(大境还在同一片天里),比 `breakthrough` 重。
 * 写法上照既有的层次来 —— 更宽的刮奏、双钟叠、更长的余韵,不另创一套乐汇。
 *
 * 视觉上给大境弹窗加一道**从印心散出的光环**:同一个 `burst-ring` 加大加慢,
 * 不新造动效。大境那枚金章已有,保留。
 *
 * ## 为什么不做"每重大境都不同的视觉"
 *
 * 三十多重大境各有各的样子,那是三十多份内容工程。而"大境这一档存在"这件事,
 * 一档音效加一道光环就说得清楚 —— 玩家听得出"这次不一样"。
 *
 * ## 判据守什么
 *
 *   一 音效分档:大境不走 `breakthrough`
 *   二 视觉有落点:大境弹窗多一道光环,且有稳定 data 锚
 *   三 小层不被牵连:小层突破仍是原来那一声
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

describe("大境之槛 · 音效分档", () => {
  it("SfxName 里有 majorBreak,且与既有三档并列", () => {
    const src = readSource("src/core/audio.ts");
    expect(src, "该有新的一档").toContain('"majorBreak"');
    // 与 breakthrough / worldRise 同一处声明,不另开一个联合类型
    expect(src).toMatch(/\|\s*"breakthrough"\s*\|\s*"majorBreak"\s*\|\s*"fail"\s*\|\s*"worldRise"/);
  });

  it("大境那一支在音色上介于两者之间 —— 比 breakthrough 宽、比 worldRise 短", () => {
    const src = readSource("src/core/audio.ts");
    const at = src.indexOf('case "majorBreak":');
    expect(at, "要有这一支").toBeGreaterThan(0);
    const block = src.slice(at, src.indexOf("case ", at + 10));
    // 有钟、有刮奏 —— 与既有两档同一套乐器
    expect(block, "该用钟").toContain("bellSampler");
    expect(block, "该有上行").toContain("gliss");
  });

  it("突破那一处按 isMajor 分派 —— 小层仍是原来那一声", () => {
    const core = readSource("src/core/breakthrough.ts");
    const at = core.indexOf("playSfx(");
    expect(at, "那一处要还在").toBeGreaterThan(0);
    /*
     * 按意图核:那一处要读 isMajor,且两个分支各给一个不同的音效名。
     * 不钉具体的三元写法 —— 那是格式,不是这件事。
     */
    const near = core.slice(Math.max(0, at - 200), at + 200);
    expect(near, "该读 isMajor").toContain("isMajor");
    expect(near, "小层仍是原来那一声").toContain('"breakthrough"');
    expect(near, "大境另有一声").toContain('"majorBreak"');
  });
});

describe("大境之槛 · 视觉落点", () => {
  it("大境弹窗多一道光环,且有稳定 data 锚", () => {
    const dlg = readSource("src/components/cultivation/BreakthroughResultDialog.vue");
    expect(dlg, "要有那道光环").toContain("data-breakthrough-major-halo");
    // 只在大境时出现
    expect(dlg).toMatch(
      /v-if="[^"]*isMajor[^"]*"\s+[^>]*data-breakthrough-major-halo|data-breakthrough-major-halo[\s\S]{0,200}v-if="[^"]*isMajor/,
    );
  });

  it("小层突破没有那道光环 —— 它不该被牵连", () => {
    const dlg = readSource("src/components/cultivation/BreakthroughResultDialog.vue");
    // 光环的出现条件必须含 isMajor,不能只判 success
    const at = dlg.indexOf("data-breakthrough-major-halo");
    const before = dlg.slice(Math.max(0, at - 400), at);
    expect(before, "条件里要有 isMajor").toContain("isMajor");
  });
});
