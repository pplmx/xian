/**
 * 宿慧阶的收益 —— 玩家看得见门槛，看不见换来什么
 *
 * ## 缺口（量出来的）
 *
 * 修仙录「宿慧阶梯」只有阶名、描述、「尚差 N 宿慧入『某阶』」。
 * 而 `SamsaraStageDef` 有五个收益字段:
 *
 * ```text
 *   knownMaterialRank   睁眼即识的灵材阶位上限
 *   enemyInsight        战前看得见交手过敌人的机制
 *   heavenInsight       天劫与终局规则的细节提前可见
 *   themeFreeChoice     命题不再是抽三取一,而是全部已开的里挑
 *   keepOneGongfa       转世时可留一门功法层数不折半
 * ```
 *
 * 界面上一个都没显示。「尚差 307 宿慧入熟知天界」这句话只说了一半:
 * 差多少查得到,换来什么查不到。
 *
 * 而 `heavenInsight` 更彻底:全仓没有任何产品代码读它 —— 写了但没接线。
 * 这一层补上文案之后，它才算真的「可见」。
 *
 * ## 三条口径
 *
 *   · **文案由字段现生**，不手写对照表。改 `SAMSARA_STAGES` 时界面跟着变
 *     （「改常数就撒谎」）。
 *   · **每条都说清是什么**。玩家看到「天数可窥」不知道窥什么 —— 它指
 *     天劫的风险维度与终局规则。字段名不印给玩家。
 *   · **首阶无收益返回空数组**，调用方据此整段不出 —— 与其它空态同一纪律。
 *
 * ## 这一层只算，不读 store
 */
import type { SamsaraStageDef } from "@/data/samsara";

/**
 * 这一阶开着的收益，一条一句。
 *
 * 顺序沿数据结构里字段的书写顺序（灵材 → 敌人 → 天劫 → 命题 → 功法），
 * 与他处列举这些能力时的次序一致。
 */
export function stageBenefitLines(stage: SamsaraStageDef): string[] {
  const lines: string[] = [];
  if (stage.knownMaterialRank > 0) {
    /*
     * 这一句与「随身所知」那行的注脚（「睁眼即识 N 阶以下」）说的是同一件事，
     * 但两处的读者不同:那行在解释灵材计数，这一句在解释**这一阶给了什么**。
     * 数字都读 `knownMaterialRank`，不各写一份。
     */
    lines.push(`睁眼即识 ${stage.knownMaterialRank} 阶以下的灵材`);
  }
  if (stage.enemyInsight) {
    lines.push("交手过的敌手，战前就能读到它的路数");
  }
  if (stage.heavenInsight) {
    /*
     * 「天数可窥」四个字看不出窥什么。它是两件具体的事:
     * 天劫的风险维度（`TribulationPanel` 里那几句 desc / risks / advice
     * 本来是决意前才给的）与终局规则的细节。
     */
    lines.push("天劫的风险与终局规则，提前看得见细节");
  }
  if (stage.themeFreeChoice) {
    lines.push("转世立题不再抽三取一，从已开的命题里自己挑");
  }
  if (stage.keepOneGongfa) {
    lines.push("转世时可留一门功法的层数不折半");
  }
  return lines;
}
