/**
 * 建号页的「02 / 03」—— 第三步不存在。
 *
 * ## 复现:承诺了三步,只走到两步
 *
 * 建号页(`CreateView`)顶上写着:
 *
 * ```text
 * 卷一 · 立命  02 / 03
 * ```
 *
 * 而全仓库搜 `01 / 03` 与 `03 / 03`,**一处都没有**。实际的开局路径是:
 *
 * ```text
 * /welcome   卷一 · 入世            ← 封面上没有编号
 * /create    卷一 · 立命 02 / 03    ← 编到第二步
 * /          直接进游戏             ← 没有第三步
 * ```
 *
 * 玩家会等一个「03」:是不是还有一页要选?是不是漏了什么?—— 而实际已经结束了。
 *
 * ## 为什么这一处值得修
 *
 * 它是**玩家见过的第一屏文字之一**。开局的分步标记有两种正当做法:
 *
 *   · 真有多步 —— 编号帮着定位「还要填几页」;
 *   · 只有一步 —— 干脆不写编号。
 *
 * 写「02 / 03」却只有两步,是第三种:给了个不存在的期待。新手期最不该让人
 * 怀疑「我是不是漏了」。
 *
 * ## 判据守什么
 *
 * 一条:开局路径上的分步编号,分母必须等于真实步数。
 *
 * 现在真实的分步是**两步**(入世 → 立命),故编号该是 `01 / 02` 与 `02 / 02`,
 * 或者干脆都不写。判据只钉「不许出现大于真实步数的分母」。
 */
import { describe, expect, it } from "vite-plus/test";
import { stripComments } from "@/test/stripComments";
import { readSource } from "@/test/readSource";

const CREATE = "src/views/CreateView.vue";
const WELCOME = "src/views/WelcomeView.vue";

/** 开局真实的分步:欢迎(入世)→ 建号(立命)。建号后直接进游戏。 */
const OPENING_STEPS = 2;

describe("开局分步 · 分母要是真实步数", () => {
  it("建号页的编号分母不超过真实步数", () => {
    // 只看模板,且剔除注释 —— 注释里为了讲清缘由会引用旧值
    const src = stripComments(readSource(CREATE));
    const m = src.match(/\b(\d{2})\s*\/\s*(\d{2})\b/);
    expect(m, "定位不到分步编号 —— 判据会空转").not.toBeNull();
    const total = Number(m![2]);
    expect(
      total,
      `建号页写着「${m![1]} / ${m![2]}」,而开局只有 ${OPENING_STEPS} 步(入世 → 立命)—— 第三步不存在,玩家会等一个不会来的 03`,
    ).toBeLessThanOrEqual(OPENING_STEPS);
  });

  it("分母写 02 时,分子也得在 01~02 之内", () => {
    const src = stripComments(readSource(CREATE));
    const m = src.match(/\b(\d{2})\s*\/\s*(\d{2})\b/);
    if (!m) return;
    const [cur, total] = [Number(m[1]), Number(m[2])];
    expect(cur, "分子不许超过分母").toBeLessThanOrEqual(total);
    expect(cur, "分子至少要 01").toBeGreaterThanOrEqual(1);
  });

  it("欢迎页与建号页不各说一套 —— 要么都编号,要么只在一处编", () => {
    /*
     * 欢迎页现在没有编号、建号页有。这种不对称本身不算错(封面不参与计数是常见做法),
     * 但它让「02」失去了参照 —— 玩家没见过「01」。判据只要求:若两页都编号,
     * 分母必须一致。
     */
    // 只认「两位数字 / 两位数字」这种分步编号,别把 text-[40px] 里的 40 当成分子
    const STEP = /\b(\d{2})\s*\/\s*(\d{2})\b/;
    const create = stripComments(readSource(CREATE)).match(STEP);
    const welcome = stripComments(readSource(WELCOME)).match(STEP);
    if (welcome && create) {
      expect(welcome[2], "两页的分母要一致").toBe(create[2]);
    }
  });

  it("反空转:开局仍要两步 —— 欢迎页与建号页都还在", () => {
    expect(readSource(WELCOME), "欢迎页要在").toContain("data-opening-enter");
    expect(readSource(CREATE), "建号页要在").toContain("data-opening-create");
  });
});
