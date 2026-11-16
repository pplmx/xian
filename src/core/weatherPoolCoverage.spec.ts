/**
 * 天时池：每个界域都要有，而配错时不许静默退回「清和」。
 *
 * ## 缺口（第 397 轮）
 *
 * `todayWeather` 原先这样写：
 *
 * ```ts
 * return (entry ? weatherDef(entry.id as WeatherId) : undefined) ?? WEATHERS[4]!;
 * ```
 *
 * `WEATHERS[4]` 是「清和」—— 而它的 `mods` 是**空对象**。于是三种完全不同的处境
 * 被压成同一个结果：
 *
 * ```text
 *   ① 周期还没到           entry 为 undefined       → 清和   （正常兜底，该留）
 *   ② 池名写错             entriesOf 返回 []        → 清和   （配错，该报）
 *   ③ 条目里的 id 认不出    weatherDef 返回 undefined → 清和   （配错，该报）
 * ```
 *
 * ②③ 的后果不是「少一件事」，而是**整个天时系统静默消失**：玩家在每个界域都看到
 * 同一句「风和日丽，四时清和」，所有天时加成为 0，而没有任何地方会红。
 *
 * 现实里它最可能这样发生：**加一个新界域**，`WORLDS` 加了、`WORLD_WEATHERS` 忘了补 ——
 * 那一界的玩家从此只有清和天。
 *
 * ## 为什么这条判据此前不存在
 *
 * `weather.spec` 有一条「池子里的每一条天时都抽得到」—— 它管的是「池里那条能不能抽到」，
 * 用的是 `weatherDef`。**它管不到「池在不在」**：池整个不存在时，那条判据
 * 一条数据都遍历不到，反而会绿着通过（它遍历的是 `WEATHERS`/`WORLD_WEATHERS`，
 * 不是「`WORLDS` 里每个界」）。
 *
 * ## 判据守什么（以及**不**守什么）
 *
 * 先记一件这一轮学到的:**前两条草稿是多余的**。
 *
 * ```text
 * ① 每个非人间界域都有天时池      → 类型系统保证
 *    WORLD_WEATHERS: Record<Exclude<WorldId, "mortal">, WeatherDef[]> —— 实测把
 *    `god:` 改成 `godtypo:` 时 vue-tsc 当场报 TS2353。加一条判据只是第二本账。
 *
 * ② 池里的每个条目 id 都认得出    → 结构上不可能发生
 *    池直接就是 WEATHERS / WORLD_WEATHERS 数组本身（`pools: { mortal: WEATHERS,
 *    ...WORLD_WEATHERS }`），条目对象自带 id，不存在「池引用了一个 id」这一层。
 * ```
 *
 * 故删掉那两条，只留真正在类型系统之外的三条：
 *
 * ③ 源码层：配置错误要抛，业务兜底（周期未到）才留 —— 这是本轮修的**分叉本身**；
 * ④ 兜底那个「清和」确实无效果 —— 它正是这个兜底危险的原因。
 *
 * ## 第三条草稿也删了（同样是「不该加」）
 *
 * 「全境界走一遍，每个 major 的天时都落在该界域的池里」本来是这条判据最有价值的
 * 一条 —— 它验的是 `contextOf` 那段 `world.id === "mortal" ? "mortal" : world.id`
 * 的映射。但它需要 Pinia（`todayWeather` 读 `game.totalPlaySec`），而
 * `layeringAudit.spec` 有一条基线：**需要 Pinia 的 core 用例只许减、不许增**
 * （那条基线的理由很实在 —— 每多一个，core 对 store 的依赖就更难拆）。
 *
 * 两条路都不好：
 *
 * ```text
 *   抬基线             为了自己方便而松动别人的约束
 *   给产品加纯入口导出   为了测试改产品；而那个导出若没人用，又会触发 deadExportAudit
 * ```
 *
 * 故这条不写。源码层那条已经能抓到本轮的分叉（故障注入验过：还原三层兜底 → 1 红）。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { WEATHERS, weatherDef, type WeatherId } from "./weather";

describe("天时池 · 配错不许静默退回「清和」", () => {
  it("源码层：配置错误要抛，业务兜底（周期未到）才留", () => {
    /*
     * 这一条钉的是**分叉本身**：`entry` 为空时仍可退回清和（周期未到是正常的），
     * 但「池不在」与「id 认不出」必须各有一个 throw。
     *
     * 为什么要在源码层钉:行为层难测到这两条 —— 要构造一个不存在的界域
     * 或一个坏 id,而 `WORLDS` 与 `WEATHERS` 都是真实数据,没有坏样本可用。
     * 故这里读源码,确认两个 throw 都在。
     */
    const src = readFileSync(resolve(__dirname, "./weather.ts"), "utf8");
    const fn = /export function todayWeather\([\s\S]*?\n}/.exec(src)?.[0] ?? "";
    expect(fn, "找不到 todayWeather —— 它改名了，这条判据要跟着改").not.toBe("");
    expect(fn, "池不存在时没有抛错 —— 仍会静默退回清和").toMatch(
      /if \(!hasPool\) \{[\s\S]*?throw new Error/,
    );
    expect(fn, "id 认不出时没有抛错 —— 仍会静默退回清和").toMatch(
      /if \(!def\) \{[\s\S]*?throw new Error/,
    );
    /*
     * 而业务兜底要留着:周期还没到的时候,给一个无效果的天时是对的。
     * 若哪天有人把它也改成 throw，玩家在新档第一天就会看到崩溃。
     */
    expect(fn, "「周期还没到」的兜底被删了 —— 新档第一天会崩").toMatch(
      /if \(!entry\) return WEATHERS\[4\]!/,
    );
  });

  it("兜底那个「清和」确实是无效果的 —— 这正是它危险的原因", () => {
    /*
     * 这条是给读者的:**兜底值本身是空 mods**，所以退回它时不会有任何
     * 「数值好像不太对」的迹象。若哪天清和被加了效果，这段注释与
     * 上面几条的判断前提都变了。
     */
    const qinghe = weatherDef("qinghe" as WeatherId);
    expect(qinghe, "找不到「清和」—— 兜底指向的那条天时变了").toBeDefined();
    expect(qinghe!.name).toBe("清和");
    expect(
      Object.keys(qinghe!.mods ?? {}).length,
      "「清和」现在有效果了 —— 那它作为兜底值就会悄悄改变数值，这条判据的前提要重读",
    ).toBe(0);
    // 且它确实是 WEATHERS[4] —— todayWeather 的兜底读的是这个下标
    expect(WEATHERS[4]!.id, "WEATHERS[4] 不再是清和 —— todayWeather 的兜底会指向别的天时").toBe(
      "qinghe",
    );
  });
});
