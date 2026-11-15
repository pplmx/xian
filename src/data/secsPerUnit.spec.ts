/**
 * 时间单位 · 只许一处 —— 86400 / 3600 的算术换算
 *
 * ## 与 `data/timeUnits.spec` 的分工（两个文件，两件事）
 *
 * ```text
 *   data/timeUnits.spec    **文案时制对账** —— 「一炷香」写 30 分钟就必须真是 1800 秒
 *                          它管的是"古语与现代时长对得上"
 *   data/secsPerUnit.spec  **算术换算唯一** —— 一天多少秒、一小时多少秒只许一处
 *                          它管的是"别在两个文件里各写一份 86400"
 * ```
 *
 * ## 起因（量出来的）
 *
 * ```text
 *   86400 在运行时代码里出现 12 处
 *     其中 2 处自己定义了 `const DAY_SEC = 86400`
 *       core/weather.ts:214        天时翻页
 *       ui/companionTime.ts:34     相伴时长
 *     其余 10 处裸写（format / astronomy / apexCultivation / apexEta / saveBackup …）
 *   另有一处 `const LONG_ETA_SEC = 86400`（CultivationView）
 * ```
 *
 * 三份局部常量、十处裸写 —— 而其中两处**都在界面上出读数**。哪天这个数要变
 * （时间加速、日历改写），改的人会找到一处、改掉，其余继续按旧的走。
 *
 * 这正是 `AGENTS.md` 那条「界面上出现的每个数字都与结算同源」要管的事。
 * 86400 恰恰是那种"看起来谁都认识、于是谁都不去查"的常数。
 *
 * ## 边界（判据写窄了三次才对）
 *
 * 第一版按名字认（`\w*SEC\w*`），误伤了 `SECRET_REALM_PREVIEW` /
 * `SECONDARY_MIN_AFFINITY` / `OFFLINE_CAP_HOURS`。
 * 第二版按值认但把 `60` 也算上，误伤了 `STAR_COUNT = 60` / `TYPICAL_EVENT_EXP_SECS = 60`。
 * 第三版才对:只认 86400 / 3600，且只认**换算语境**（除 / 乘 / 取模）——
 * `data/pills.ts` 的 `expSecs: 3600`、`data/apprentices.ts` 的 `seconds: 3600`
 * 是**数据**不是换算，它们本来就该一眼看见。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource, walkFiles, isTypeScriptOrVue } from "@/test/readSource";
import { SECS_PER_DAY, SECS_PER_HOUR, SECS_PER_MINUTE } from "@/data/constants";

function codeOf(src: string): string {
  return src
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

describe("时间单位 · 只许一处", () => {
  it("三个换算值互相自洽", () => {
    expect(SECS_PER_MINUTE).toBe(60);
    expect(SECS_PER_HOUR).toBe(SECS_PER_MINUTE * 60);
    expect(SECS_PER_DAY).toBe(SECS_PER_HOUR * 24);
  });

  it("运行时代码里不再有第二份 86400 / 3600 换算", () => {
    const offenders: string[] = [];
    for (const file of walkFiles("src", isTypeScriptOrVue)) {
      if (file.includes(".spec.")) continue;
      /*
       * 三处豁免，各自理由不同:
       *
       * `data/constants.ts`  常量本体就在这里
       * `data/timeUnits.ts`  文案时制表:那里「一时 = 半小时辰」的那枚 3600 是
       *                      「一时就是半小时辰」一句古语的定义，不是算术换算
       * `data/pills.ts` / `data/apprentices.ts` 里的 3600 是数据值，
       *                      由下面的"换算语境"规则自然放行，不必列在这里
       */
      if (file.endsWith("data/constants.ts") || file.endsWith("data/timeUnits.ts")) continue;
      const code = codeOf(readSource(file));
      const short = file.replace(/^.*\/src\//, "src/");

      // 自己又定义一份秒换算
      if (/const\s+\w+\s*=\s*(?:86400|3600)\b\s*;/.test(code)) {
        offenders.push(`${short}（又定义了一份秒换算）`);
        continue;
      }
      // 或者在换算语境里裸写
      const dayHits = [...code.matchAll(/(?:[*/%]\s*86400\b|\b86400\s*[*/%])/g)].length;
      const hourHits = [...code.matchAll(/(?:[*/%]\s*3600\b|\b3600\s*[*/%])/g)].length;
      if (dayHits + hourHits > 0) {
        offenders.push(
          `${short}（裸写 ${dayHits ? `86400×${dayHits}` : ""}${
            dayHits && hourHits ? "、" : ""
          }${hourHits ? `3600×${hourHits}` : ""}）`,
        );
      }
    }
    expect(
      offenders,
      "这些文件各自写了一份秒/天换算 —— 改了一处不会改到另一处:\n" + offenders.join("\n"),
    ).toEqual([]);
  });

  it("毫秒那一族不受这条判据管，数据值也不受管 —— 判据边界写清", () => {
    /*
     * `86400000` 是 JS 时间戳的毫秒/天换算（Date.now() 那一族），
     * 与「游戏内一局多少秒」不是同一个概念;`expSecs: 3600` 是数据。
     * 两段自证:构造这样的片段，判据应当放行。
     */
    const msOnly = "const d = Math.floor((now - t) / 86400000);";
    expect([...codeOf(msOnly).matchAll(/(?:[*/%]\s*86400\b|\b86400\s*[*/%])/g)].length).toBe(0);

    const dataOnly = "instant: { expSecs: 3600 },";
    expect([...codeOf(dataOnly).matchAll(/(?:[*/%]\s*3600\b|\b3600\s*[*/%])/g)].length).toBe(0);
  });

  it("那份唯一的换算真的叫得动 —— 三处旧常量都换过来了", () => {
    /*
     * 判据不只要求"别处不再写"，也要求"原来那几处真的换过来了"。
     * 否则删掉旧的、也没接新的，判据照样绿。
     */
    const rewired: [string, string][] = [
      ["src/core/weather.ts", "SECS_PER_DAY"],
      ["src/ui/companionTime.ts", "SECS_PER_DAY"],
      ["src/views/CultivationView.vue", "SECS_PER_DAY"],
      ["src/utils/format.ts", "SECS_PER_HOUR"],
      ["src/core/engine.ts", "SECS_PER_HOUR"],
    ];
    for (const [file, name] of rewired) {
      expect(readSource(file), `${file} 没有改用共享的时间单位`).toContain(name);
    }
  });
});
