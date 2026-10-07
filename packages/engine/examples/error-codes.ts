/* eslint-disable no-console -- 示例程序就是要打印给人看 */
/**
 * 错误码示例 —— 配置写错时,怎么**按 `code` 分支**,而不是拿中文文案去匹配。
 *
 * 运行:`bun packages/engine/examples/error-codes.ts`
 *
 * 引擎的每条运行时报错都是 `EngineError(code, message)`:`message` 给人看(可读、可改),
 * `code` 给程序看(稳定、可按它分支)。这份示例把常见的两类各触发一次,按 code 给出处置 ——
 * "补内容表 / 退档 / 拦住发布",具体怎么接由你定。
 */
import { EngineError, createEquipmentSystem, createRng, defineGame } from "../src/index.js";
import { DEMO } from "../src/presets/demo.js";

/** 触发一次,把它变成一行人话 —— 关键是**按 `error.code` 分支**,不是匹配 `error.message` */
const attempt = (label: string, run: () => unknown): void => {
  try {
    run();
    console.log(`  ${label}:没有报错`);
  } catch (error) {
    if (!(error instanceof EngineError)) throw error; // 不是引擎的错,别吞掉
    switch (error.code) {
      case "GAME_CONFIG_INVALID":
        console.log(`  ${label} → [${error.code}] 配置里有对不上的引用,逐条修(见上面几行)`);
        break;
      case "EQUIP_TIER_EMPTY":
        console.log(`  ${label} → [${error.code}] 这一层没有装备模板:补表,或退档到有内容的层`);
        break;
      default:
        console.log(`  ${label} → [${error.code}] ${error.message}`);
    }
  }
};

console.log("—— 按 code 分支,不靠文案 ——");

attempt("整份配置里有个槽位名字写错了", () => {
  const broken = structuredClone(DEMO) as typeof DEMO;
  broken.equipment!.templates[0]!.slot = "nope";
  defineGame(broken);
});

attempt("一层装备都没有,却还想抽一件", () => {
  const noTemplates = { ...structuredClone(DEMO.equipment)!, templates: [] };
  createEquipmentSystem(noTemplates).generate(createRng("错误码示例"), { tier: 1 });
});

console.log("  两类都被拦下,而且给出的是稳定的 code —— 分支逻辑不会随文案改而失效。");
