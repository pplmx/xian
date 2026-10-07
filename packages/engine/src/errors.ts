/**
 * 引擎错误 —— **每条运行时报错都带一个稳定的 `code`**。
 *
 * 为什么要有它:库此前对外抛的是一句中文文案,消费方想区分"是配置写错了"还是
 * "这一刻真的没有可用内容",只能拿字符串去匹配 —— 文案一改就断,而文案本来就该能改。
 * `code` 则是对外承诺:大写蛇形、按模块前缀(`ATTR_` / `EQUIP_` / `DUNGEON_` / `REALM_` …),
 * 不随文案漂移。`validateGame` 早就这么做了(它的 `ValidationIssue.code`);这里把
 * **运行时抛错**也统一到同一口径。
 *
 * 用法:
 *
 *   try {
 *     createEquipmentSystem(cfg).generate(rng, { tier: 1 })
 *   } catch (e) {
 *     if (e instanceof EngineError && e.code === "EQUIP_TIER_EMPTY") {
 *       // 这一层确实没内容 —— 退档、跳过、或提示内容作者补表,由调用方决定
 *     }
 *   }
 *
 * 约定:`message` 给人看(可读、可改、可本地化),`code` 给程序看(稳定、别改)。
 * 增删 `code` 属于对使用者有影响的变更,要写进 CHANGELOG。
 */
export class EngineError extends Error {
  /** 稳定的机器可读错误码(大写蛇形,模块前缀 + 具体原因) */
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "EngineError";
    this.code = code;
  }
}
