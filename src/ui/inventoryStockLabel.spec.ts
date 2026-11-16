import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

const RAW = readSource("src/views/InventoryView.vue");
/**
 * 抹掉注释再判 —— 这条改写留下的说明里**原样引用**了旧写法
 * （不引用就读不出它改了什么），若不抹，判据会抓住自己的记录。
 */
const VIEW = RAW.replace(/<!--[\s\S]*?-->/g, "");

/**
 * 「1 候」不是一个词 —— 它读屏念的却是「候选」
 *
 * 背包「九佩」每格右上角:
 *   视觉 `{{ row.stock }} 候`  ·  读屏 `…${row.stock} 件同席候选…`
 *
 * 三条问题:
 *   一 语法不成立  「1 候」在中文里没这个说法。「一候」是时间单位（五日一候），
 *                  要指候选就得说「1 件候选」。
 *   二 两本账      同一个数在视觉与读屏两条通道上叫两个名字。
 *   三 无解释      屏幕上没有一处告诉玩家「候」是什么，而它其实有用 ——
 *                  意思是「这一格还有 N 件同槽装备可换」。
 *
 * 查过 docs/design.md 里「候」共 40 处，全是「候选」「候差」这类正常用法，
 * 没有一处是「N 候」这种孤立写法 —— 故它不是术语，是省字省坏了。
 */
describe("背包九佩 · 候选件的标记", () => {
  it("不再出现「N 候」这种孤立写法", () => {
    expect(
      VIEW,
      "背包里仍写着「{{ row.stock }} 候」—— 那不是中文里的说法，读屏念的却是「候选」",
    ).not.toMatch(/row\.stock\s*\}\}\s*候(?!选)/);
  });

  it("视觉与读屏同称「候选」", () => {
    expect(RAW, "读屏那条本来就是对的，不该被改掉").toContain("件同席候选");
    expect(VIEW, "视觉那一枚没有改用「候选」").toContain("候选 {{ row.stock }}");
  });

  it("数还是那个数 —— 只动措辞，不动算法", () => {
    expect(VIEW, "候选件算法被顺手改了 —— 这一改只该动措辞").toMatch(
      /stock:\s*inventory\.bagItems\.filter/,
    );
  });
});
