/**
 * 大境突破 —— 跨过一道门,不该只比「五层→一层」多一枚小章。
 *
 * ## 复现:一世几十次小突破,几次大突破,两屏几乎同一张脸
 *
 * `BreakthroughResultDialog` 里,大境与小层的差别目前只有三样:
 *
 *   · 光环粗一点(`burst-ring--major`,与普通光环同一个动效加大加慢)
 *   · 一枚「大 境」金章(px-2 py-0.5,与一行小字同高)
 *   · 有劫雷记录(小境本来也没有劫)
 *
 * 而正中间那枚**「破」印、标题「突破成功」、箭头那一行、按钮「继续问道」,
 * 两者一模一样**。
 *
 * ## 为什么这一处值得单独做
 *
 * 数量关系是决定性的:一层一小境、九层一大境,而全作二十一道境界 ——
 * **小突破一世几十次,大境十几次**。前者是个节拍器,后者是一次里程碑。
 *
 * 而里程碑最该说的是「你**跨过了哪道门**」:真仙·圆满 → 玄仙·一层不是
 * 「五层变一层」,是**从真仙这一重天跨进了玄仙这一重天**。当前这一屏把它
 * 压成了同一行箭头字,只用颜色区分。
 *
 * ## 做什么
 *
 * 大境成功时,把那枚「破」印换成**新境界的名**:
 *
 * ```text
 * 小层:  (破)  突破成功   真仙·四层 → 真仙·五层
 * 大境:  (玄仙) 大境 · 破   真仙·圆满 → 玄仙·一层
 * ```
 *
 * 印里那两个字就是玩家刚挣到的那一境 —— 这是这一屏唯一能把这个时刻与
 * 其余几十次分开的东西。印本身不新造:同一枚圆印、同一套朱砂,只换里面的字。
 *
 * ## 判据守什么
 *
 * 两条:
 *   一 大境成功时,印里印的是**境界名**(从 `toLabel` 取,不许手写);
 *   二 小层仍印「破」—— 不许把节拍器也改成境界名(那会让每一次都像里程碑)。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

const DLG = "src/components/cultivation/BreakthroughResultDialog.vue";

describe("大境突破 · 印里该是跨过的那道门", () => {
  it("大境成功时印里印境界名,不是「破」", () => {
    const src = readSource(DLG);
    /*
     * 印里那个字符当前是三目:
     *   {{ view.success ? "破" : "滞" }}
     * 大境要插一档,且取的是新境界名 —— 从 toLabel 派生,不手写。
     */
    expect(src, "大境要另有一档印面文字").toMatch(
      /isMajor[\s\S]{0,200}?toLabel|toLabel[\s\S]{0,200}?isMajor/,
    );
    expect(src, "大境印面要从读数派生,不许手写境界名").toMatch(/majorSealText|majorSeal/);
  });

  it("小层仍印「破」—— 节拍器不许也变成里程碑", () => {
    const src = readSource(DLG);
    expect(src, "小层那一档仍是「破」").toContain('"破"');
    expect(src, "失败那一档仍是「滞」").toContain('"滞"');
  });

  it("印面文字的实际取值只来自 toLabel,不另存一份境界表", () => {
    /*
     * 境界名的事实源是 data/realms(经 core 的 realmDef)。若这里 import 一张
     * 境界名表来给印面用,就又成了两本账 —— 读数是 toLabel 给的,印面却另取一份,
     * 两者迟早对不上。故判据盯:印面文字的来源必须是 view 上的读数。
     */
    const src = readSource(DLG);
    expect(src, "不许在这里 import 境界表").not.toMatch(/from ["']@\/data\/realms["']/);
  });

  it("大境的标题要说「跨入哪一境」,不只写「突破成功」", () => {
    /*
     * 印里已经印着境界名了,标题再写一句「突破成功」就与印重复 ——
     * 而这一屏要说的其实是「你跨过了哪道门」。大境换成「跨入玄仙」,
     * 小层仍写「突破成功」(那本来就只是成功,没有门可跨)。
     */
    const src = readSource(DLG);
    expect(src, "大境标题要带境界名").toMatch(/跨入/);
    expect(src, "小层标题仍是「突破成功」").toContain("突破成功");
  });

  it("反空转:大境原有那三样仍在", () => {
    const src = readSource(DLG);
    expect(src, "大境光环仍要走 burst-ring--major").toContain("burst-ring--major");
    expect(src, "大境金章仍要直说「大境」").toContain("大 境");
    expect(src, "劫雷记录仍要渲染").toContain("tribulationLog");
  });
});
