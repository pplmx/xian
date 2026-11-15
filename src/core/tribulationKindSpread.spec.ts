/**
 * 劫型派生 · 天时必须**整串**参与,不能只认首字母
 *
 * ## 这一轮量出来的两件事
 *
 * `rollTribulation` 的种子原来是:
 *
 * ```ts
 * const seed = targetMajor * 31 + (todayWeather(targetMajor).id.charCodeAt(0) - 96) * 7;
 * ```
 *
 * 只取天时 **id 的第一个字符**。而 id 是按拼音起的,于是三对天时的首字母相同:
 *
 * ```text
 *   人间界   lingyu / leiming          → 首字母 'l'
 *   仙界     xianyu / xianjie          → 首字母 'x'
 *   神界     shenhui / shenwei         → 首字母 's'
 * ```
 *
 * 「首字母相同」在这里不是"概率上接近",而是**逐位相同**:种子的第一项一模一样,
 * 后面的 `mulberry32` 拿到同一个种子就吐出同一串数,劫型**恒等**。
 * 实测全表 360 个天时对里有 79 对(21.9%)落成同一个劫型 —— 等于这几对天时在
 * 「渡劫撞什么劫」这件事上从来没有区别,而它们的 `desc` 写的是不同的事。
 *
 * 第二个后果更扎心:`todayWeather` 的池子现在每一条都抽得到(见 `weather.ts` 的
 * `pickMortalWeather`),于是「天时」本该给渡劫带来真实的择日空间 ——
 * 而首字母哈希把它削掉了一截。
 *
 * ## 判据为什么不能是「两个天时给不同劫型」
 *
 * 第一版这么写,修完仍红。原因是**鸽笼原理**:5 种劫型对 9 条天时,
 * 按均匀分布也必然有约 1/5 的撞车。那条判据要求的其实是「9 个桶装 5 个球还不撞」,
 * 永远不可能成立 —— 它红得对,但**不可能被修好**。
 *
 * 真正要守的是「首字母没有在偷懒」这件事,而它有两个可观测的后果:
 *
 * 一 **同首字母的一对天时,不能在所有境界上都撞**。旧实现在**每一境**都撞
 *    （逐位相同,没有任何随机余地）;新实现在 21 境里只在约 1/5 的境界上撞
 *    （与任意一对天时的期望一致）。判据取「撞的比例必须低于一半」。
 *
 * 二 **天时真的进了种子**:把天时换掉,劫型的**分布**要真的动。这条用
 *    「同一个境界上,不同天时给出的劫型种数」量 —— 它不依赖任何一对具体的天时。
 *
 * 两条都走 `tribulationKindFor`(纯函数,不读 store),故这个用例**不需要 Pinia**:
 * 它问的是"两个天时给不给同一个劫",与"今天到底是哪天"无关。
 */
import { describe, expect, it } from "vite-plus/test";
import { tribulationKindFor } from "./tribulationDecision";
import { WEATHERS, WORLD_WEATHERS, type WeatherId } from "./weather";
import { MAX_MAJOR, worldOf } from "@/data/realms";
import { TRIBULATIONS } from "@/data/tribulations";
import { readSource } from "@/test/readSource";

/** 某境界所在界域的天时池 —— 与 `weather.contextOf` 同一套分池规则 */
function poolOf(major: number): { id: WeatherId; name: string }[] {
  const world = worldOf(major);
  return world.id === "mortal" ? [...WEATHERS] : [...WORLD_WEATHERS[world.id]];
}

describe("劫型派生 · 天时整串参与", () => {
  it("同首字母的一对天时,不许在所有境界上都撞成同一个劫型", () => {
    /*
     * 这条是修复的**主判据**,也是唯一能区分「首字母哈希」与「整串哈希」的形状。
     *
     * 旧实现:首字母相同的两串,种子逐位相同 → 在**每一境**都撞。
     * 新实现:整串参与 → 撞的比例应当与任意一对天时无异(5 种劫型,约 1/5)。
     *
     * 阈值取 1/2 而不是更紧的数:1/5 是期望值,而小样本(界外池只有 3 条天时、
     * 只跑 4~5 个境界)的方差很大。守「不许全撞」这个质变,不守具体比例。
     */
    const PAIRS: { a: WeatherId; b: WeatherId; world: string }[] = [
      { a: "lingyu", b: "leiming", world: "人间界" },
      { a: "xianyu", b: "xianjie", world: "仙界" },
      { a: "shenhui", b: "shenwei", world: "神界" },
    ];
    const offenders: string[] = [];
    for (const { a, b, world } of PAIRS) {
      let same = 0;
      let total = 0;
      for (let major = 0; major <= MAX_MAJOR; major += 1) {
        if (worldOf(major).name !== world) continue;
        total += 1;
        if (tribulationKindFor(major, a) === tribulationKindFor(major, b)) same += 1;
      }
      if (total === 0) {
        offenders.push(`${world}「${a} / ${b}」取不到样本 —— 境界表或分池规则出了问题`);
        continue;
      }
      if (same / total >= 0.5) {
        offenders.push(
          `${world}「${a}」与「${b}」在 ${same}/${total} 个境界上撞成同一劫型` +
            `（首字母哈希的特征是**每一境**都撞）`,
        );
      }
    }
    expect(
      offenders,
      "天时没有完整参与劫型派生 —— 只认首字母时,同首字母的两条天时逐位相同:\n" +
        offenders.join("\n"),
    ).toEqual([]);
  });

  it("同一个境界上,换天时能改出多种劫型 —— 天时真的进了种子", () => {
    /*
     * 上一条只能挡「首字母」这一种偷懒。这一条挡另一种更坏的修法:
     * 把天时**整个**丢掉（`Math.imul(major, k)`）。那时上一条全绿 ——
     * 因为所有天时确实给同一个劫型,而"同一劫型"被判为撞车。
     *
     * 这里的口径是:只要池里有多条天时,该境界上就应该看见**不止一种**劫型。
     * 5 种劫型随机撒,2 条以上天时全撞的概率很低;界外池只有 3 条时,
     * 要求的门槛相应放宽到 2 种（"至少有两个不同答案"就是天时在起作用的最小证据）。
     */
    const offenders: string[] = [];
    for (let major = 0; major <= MAX_MAJOR; major += 1) {
      const pool = poolOf(major);
      if (pool.length < 2) continue;
      const kinds = new Set(pool.map((w) => tribulationKindFor(major, w.id)));
      if (kinds.size < 2) {
        offenders.push(
          `第 ${major} 境:${pool.length} 条天时只给出 ${kinds.size} 种劫型（${[...kinds].join(",")}）` +
            ` —— 天时没有进种子`,
        );
      }
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("确定性仍是地基:同一(境界, 天时)恒得同一劫型,且五种劫型都抽得到", () => {
    /*
     * 前两条只问"天时有没有参与"。这一条钉住**没被改坏的那一半**:
     * `heavenInsightPreview.spec` 与「预览 === 结算」那几条判据都建立在
     * 「派生是确定性的」之上 —— 一旦改成随机,那几条的地基就没了。
     *
     * 同时钉住"内容没被抽空":全表走过一遍,五种劫型都得出现。
     */
    const seen = new Set<string>();
    for (let major = 0; major <= MAX_MAJOR; major += 1) {
      for (const w of poolOf(major)) {
        const k = tribulationKindFor(major, w.id);
        seen.add(k);
        expect(
          tribulationKindFor(major, w.id),
          "同一(境界,天时)给出了不同的劫型 —— 确定性没了",
        ).toBe(k);
      }
    }
    const missing = TRIBULATIONS.map((t) => t.id).filter((id) => !seen.has(id));
    expect(missing, `全表从没派生出的劫型:${missing.join(",")} —— 五种内容被抽空了`).toEqual([]);
  });

  it("rollTribulation 就是对「今日天时」调一次纯派生 —— 两处不许各算一套", () => {
    /*
     * 拆分之后多了一条缝:`rollTribulation`（读 store）与 `tribulationKindFor`（纯）
     * 各自都能算劫型。若哪天有人只改了其中一处,预览与结算就会指着两种劫,
     * 而这正是 `tribulationWeatherParity.spec` 在守的那类事故。
     *
     * 这里用**源码**钉住「读 store 的那一个只是取一次天时再转发」——
     * 行为判据做不到这件事（两处对同一天必然一致),而改错的方向恰恰是
     * "在 rollTribulation 里另写一遍算式"。
     */
    const src = readSource("src/core/tribulationDecision.ts");
    const body = src.slice(src.indexOf("export function rollTribulation"));
    const head = body.slice(0, body.indexOf("\n}") + 2);
    expect(head, "rollTribulation 没有转发给 tribulationKindFor —— 又出现第二份派生").toContain(
      "tribulationKindFor(",
    );
    // 派生算式只许出现在纯函数里:读 store 的那一个里不该再有 major 算术
    expect(head, "rollTribulation 里又自己算了一遍种子").not.toMatch(/0x9e3779b1|charCodeAt/);
  });
});
