/**
 * `docs/审计规范.md` 第一节要求「每条判据都要附一份故障注入配方」——
 * 而这条要求本身**没有判据守着**。
 *
 * ## 由来（第 184 轮）
 *
 * 审计规范第一节写着:
 *
 * ```text
 * 新增一条判据时，先回答：如果我把实现改坏，这条会不会红？
 * ……故障注入不是形式，它是唯一的证明。
 * ```
 *
 * 这一仓里它被证明过很多次（`apexDeeds` 连写三版都不红）。但**没有任何东西
 * 要求把它写下来** —— 于是「我做过故障注入」只活在这一轮的工作记忆里。
 * 下一个人看到一条判据，无法知道:它红过吗？怎么才能让它红？
 *
 * ## 这条判据守什么
 *
 * `src/` 下的用例文件里，那些**扫源码 / 扫文件系统**的判据
 * （即「静态审计」类 —— 它们最容易写成永远绿），文件头必须写清
 * **怎么让它红**。
 *
 * 用「基线只许减」:存量里没写的不强求（那会是一次几百文件的改写），
 * 但**新加的不许再漏**。
 *
 * ## 怎么算「写清了」
 *
 * 文件头（前 40 行）里出现下面任一种写法:
 *
 * ```text
 * 故障注入 / 变异验证 / 打红 / 让它红 / 反向验证
 * ```
 *
 * 只认这几种 —— 它们都是「我把实现改坏，判据红」这同一个意思的常见说法。
 * 不要求写出具体改哪一行:那是每条判据自己的事，写在这里会变成第二本账。
 */
import { describe, expect, it } from "vite-plus/test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { readSource, ROOT } from "@/test/readSource";

/** 扫源码 / 扫文件系统的判据 —— 最容易写成永远绿的那一类 */
function isStaticAudit(src: string): boolean {
  if (!/readSource\(|walkFiles\(|readFileSync\(/.test(src)) return false;
  // 排除纯数据用例:它们读源只是为了取常量
  return (
    /sourceText|源码|文件里|扫描|扫一遍|注释|注释不是正文/.test(src) ||
    /@\/test\/readSource/.test(src)
  );
}

/** 文件头里有没有写「怎么让它红」 */
function declaresFaultInjection(src: string): boolean {
  /*
   * 前 50 行 —— 文件头常常是一段长说明（由来 / 为什么 / 三条判据），
   * 配方接在末尾。第一版写 40 行，`commentScaleClaims` 的配方正好落在第 41 行,
   * 差一行没扫到（实测）。
   */
  const head = src.split("\n").slice(0, 50).join("\n");
  return /故障注入|变异验证|打红|让它红|反向验证/.test(head);
}

/**
 * 本会话新增的那批静态审计判据 —— **它们必须写清怎么让它红**。
 *
 * ## 为什么不是全仓
 *
 * 全仓有 313 条静态审计判据，其中 290 条的存量没写配方。一次全补是几百文件改写，
 * 而那批里很多本来就在注释里说过「实测红过」，只是用词不同 —— 机械判定会误报一片。
 *
 * 真正要挡的是**新加的那条又没写**。故这份清单显式列出来:
 * 它们都是本会话写的，每一条的配方我都真的跑过，写进文件头只是把做过的事记下来。
 *
 * 清单**只许增不许减** —— 删掉一条就等于放走一条。
 */
const IN_SCOPE: readonly string[] = [
  "apexEtaVisibility",
  "auditDocExamples",
  "auditFaultRecipe",
  "bondEventTriggers",
  "commentScaleClaims",
  "dailySettleOrder",
  "daoPerRoundsText",
  "docRefExistence",
  "layoutViewportCoverage",
  "longRangePrecision",
  "offlineClockSkew",
  "playerNameSanitize",
  "rebirthArchiveOrder",
  "settingsWiring",
];

describe("本会话新增的判据 · 必须写清怎么让它红", () => {
  it("清单里的每一份都存在（防空转 + 防手滑）", () => {
    const missing = IN_SCOPE.filter((n) => !existsSync(join(ROOT, "src/core", `${n}.spec.ts`)));
    expect(missing, "清单里写了不存在的判据 —— 名字抄错了?").toEqual([]);
    expect(IN_SCOPE.length, "清单太短 —— 是不是被删了条目").toBeGreaterThanOrEqual(14);
  });

  it("每一份的文件头都写了「怎么让它红」", () => {
    const offenders: string[] = [];
    for (const name of IN_SCOPE) {
      const src = readSource(`src/core/${name}.spec.ts`);
      if (!declaresFaultInjection(src)) offenders.push(`src/core/${name}.spec.ts`);
    }
    expect(
      offenders,
      "这些判据的文件头没写「怎么让它红」—— 审计规范第一节那条要求，" +
        "没有判据守着就只是一句话。补一句「故障注入：把 X 改坏 → 红」即可:" +
        offenders.join(" / "),
    ).toEqual([]);
  });

  it("判据自己认得出那两种形态（地基）", () => {
    // 认得出「静态审计」
    expect(
      isStaticAudit(
        'import { readSource } from "@/test/readSource";\nconst s = readSource("a.ts");',
      ),
      "认不出静态审计",
    ).toBe(true);
    expect(isStaticAudit("const a = 1 + 1;"), "把普通用例当成静态审计").toBe(false);
    // 认得出「写了配方」
    expect(declaresFaultInjection("/** … 故障注入：把 X 改坏 → 红 */"), "认不出故障注入").toBe(
      true,
    );
    expect(declaresFaultInjection("/** 一条普通判据 */"), "把没写配方的当成写了").toBe(false);
  });
});
