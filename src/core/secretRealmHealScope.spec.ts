/**
 * 秘境的「禁疗」说的是**战内**，不能连层间回血一起否掉。
 *
 * ## 缺口（第 398 轮）
 *
 * `SecretRealmDef` 有两条互不相干的血量机制：
 *
 * ```text
 *   rules.healMult       战斗**之内**的每一口治疗都乘它（0.25 ~ 0.8）
 *   healBetweenPct       打完一层、进下一层之前的回血（0.15 ~ 0.5）
 * ```
 *
 * 而四个秘境的 `desc` 把第一条说成了整个秘境的性质：
 *
 * ```text
 *   苦海渡舟   「回气极慢,但彼岸的东西格外丰厚」      healMult 0.5  层间 +30%
 *   陨星荒原   「禁疗之地,唯快与甲可恃」              healMult 0.25 层间 +20%
 *   青冥古渡   「此渡疗愈见拙,唯以战养战者可渡」       healMult 0.8  层间 +20%
 *   冥河渡     「此渡禁疗」                          healMult 0.5  层间 +20%
 * ```
 *
 * 而卡片上**同时**印着「层间回血 20%」（`SecretRealmCard` 的
 * `preview.healBetweenPct > 0 ? "回血" : "损血"`）。于是同一张卡上两句话打架：
 *
 * ```text
 *   秘境 禁疗之地,唯快与甲可恃
 *   · 层间回血 20%
 * ```
 *
 * 「禁疗」是一句绝对话，读到它的人不会自己去猜「哦这是说战内」——
 * 而这条读数直接影响「这一层硬撑过去,下一层能不能缓过来」的判断。
 *
 * ## 判据守什么
 *
 * ① `desc` 里出现「禁疗 / 疗愈见拙 / 回气极慢」这类**战内治疗**的措辞时，
 *    必须同时点明它是战内的（含「战内」二字）；
 * ② 反过来：`healMult < 1` 的秘境，`desc` 不许一个字都不提这件事 ——
 *    那是一处会影响打法的机制，藏在 `rules` 里等于没写；
 * ③ `healBetweenPct > 0` 的秘境，`desc` 不许把整个秘境说成无治疗。
 *
 * 只钉**语义**不钉具体句子：措辞可以改，但「战内」这个限定词必须在。
 */
import { describe, expect, it } from "vite-plus/test";
import { SECRET_REALMS } from "@/data/secretRealms";

/** 会被误读成「整个秘境都不回血」的那些词 */
const ABSOLUTE_HEAL_WORDS = ["禁疗", "疗愈见拙", "回气极慢"];

/** 点明「这是战内」的限定词 —— 判据只要求它出现，不要求某个固定句式 */
const IN_BATTLE_QUALIFIERS = ["战内", "战中", "交手时", "每一场之内"];

describe("秘境 · 「禁疗」只否战内，不否层间", () => {
  it("说「禁疗」的秘境必须点明那是战内", () => {
    const offenders: string[] = [];
    for (const r of SECRET_REALMS) {
      const used = ABSOLUTE_HEAL_WORDS.filter((w) => r.desc.includes(w));
      if (used.length === 0) continue;
      if (!IN_BATTLE_QUALIFIERS.some((q) => r.desc.includes(q))) {
        offenders.push(
          `${r.name}:「${used.join("/")}」但没说清是战内（层间回血 ${(r.healBetweenPct * 100).toFixed(0)}%）`,
        );
      }
    }
    expect(
      offenders,
      "这些秘境的 desc 把「禁疗」说成了整个秘境的性质 —— 而卡片上同时印着「层间回血」：" +
        offenders.join(" / "),
    ).toEqual([]);
  });

  it("层间会回血的秘境，desc 不许把整处说成无治疗", () => {
    /*
     * 这一条与上一条**不是重复**:上一条查「有没有限定词」，这一条查
     * 「层间回血为正时，那句话会不会被读成对整个秘境成立」。
     *
     * 反例（本轮修之前）：陨星荒原 `healBetweenPct = 0.2`，而 desc 写着
     * 「禁疗之地」—— 没有限定词，读者自然按整处理解。
     */
    const offenders: string[] = [];
    for (const r of SECRET_REALMS) {
      if (r.healBetweenPct <= 0) continue;
      const used = ABSOLUTE_HEAL_WORDS.filter((w) => r.desc.includes(w));
      if (used.length === 0) continue;
      const qualified = IN_BATTLE_QUALIFIERS.some((q) => r.desc.includes(q));
      if (!qualified) {
        offenders.push(
          `${r.name}: 层间回血 ${(r.healBetweenPct * 100).toFixed(0)}% 却说「${used.join("/")}」`,
        );
      }
    }
    expect(offenders, offenders.join(" / ")).toEqual([]);
  });

  it("战内治疗被削的秘境，desc 要提到这件事", () => {
    /*
     * 反方向：`rules.healMult < 1` 是一处会影响打法的机制
     * （走续航流的玩家在这一境里要换思路）。藏在 rules 里等于没写。
     *
     * 只要求「提到了这一类词」，不要求具体是哪一个 —— 措辞是写作。
     */
    const HINT_WORDS = [...ABSOLUTE_HEAL_WORDS, "疗愈", "回气", "治疗"];
    const missing: string[] = [];
    for (const r of SECRET_REALMS) {
      const healMult = (r.rules as { healMult?: number }).healMult;
      if (typeof healMult !== "number" || healMult >= 1) continue;
      if (!HINT_WORDS.some((w) => r.desc.includes(w))) {
        missing.push(`${r.name}: healMult ${healMult} 但 desc 一字未提`);
      }
    }
    expect(missing, `这些秘境削了战内治疗，而 desc 没说：${missing.join(" / ")}`).toEqual([]);
    // 防空转：真的量到了有 healMult 的秘境
    const withHealMult = SECRET_REALMS.filter(
      (r) => typeof (r.rules as { healMult?: number }).healMult === "number",
    );
    expect(
      withHealMult.length,
      "一个带 healMult 的秘境都没有 —— 判据的前提不成立了",
    ).toBeGreaterThan(2);
  });

  it("两条血量机制都在数据里，且互不相干", () => {
    /*
     * 这条是给读者的:它把「为什么会有这个混淆」摊开 ——
     * 同一个秘境里 `healMult` 与 `healBetweenPct` 可以一个削一个给，
     * 而两者都对玩家的决策有影响。若哪天有人把它们合成一个字段，
     * 上面三条的判断前提就变了。
     */
    const both = SECRET_REALMS.filter(
      (r) =>
        typeof (r.rules as { healMult?: number }).healMult === "number" && r.healBetweenPct > 0,
    );
    expect(
      both.length,
      "没有秘境同时「削战内治疗」又「给层间回血」—— 本判据针对的那个混淆不存在了，可以重新审视",
    ).toBeGreaterThan(0);
  });
});
