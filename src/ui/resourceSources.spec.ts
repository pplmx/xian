/**
 * 资源来路表 · 与真实的入账点对账
 *
 * ## 这个判据要挡的那个病
 *
 * 上一轮给道源补了「怎么补」（`ui/daoSourceFill`）。顺着同一个形状查，发现
 * 「怎么补」的机制**只有道源那一处**，而全站「尚差」分布是:
 *
 * ```text
 *   道源 14 处   灵石 8 处   器灵尘 3 处   悟道点 2 处
 *   玄铁 / 灵草 / 道果 / 灵气 各 1~2 处
 * ```
 *
 * **同一件事只做了一处** —— 这正是本项目反复栽的那个形状（第 134~158 轮那五条
 * 「裸字符串键 + 静默兜底」判据，全是同一个病）。故这一层要的不是再补一处，
 * 而是**一张必须与代码对得上的表**。
 *
 * ## 判据守什么
 *
 * 一 **表是满的**:`core/economySim` 认得每一样资源，表里就得有一条。
 *    加一样新资源而忘了补表 → 红。这是"只做一处"那个病的疫苗。
 * 二 **说的与代码一致**:表里写某样资源「被动产（洞府按小时）」，那
 *    `core/engineFacilities` 里就得真有那条流；写「历练掉」，`core/loot`
 *    里就得真有入账。**这一条是整件事的地基** —— 若哪天有人改了产出，
 *    表会自己红，而不是安静地指错路。
 * 三 **路由真存在**（与 `weatherRoutes.spec` 同一条）。
 * 四 每一条都有一句 `how` —— 只说"去历练"而不说"历练里怎么来"，
 *    与修之前的「尚差 N」是同一种贫瘠。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { readSource } from "@/test/readSource";
import {
  AUDIT_RESOURCES,
  RESOURCE_SOURCES,
  resourceNameOf,
  resourceSourceOf,
} from "./resourceSources";

const ROOT = resolve(__dirname, "../..");

describe("资源来路表 · 与真实入账点对账", () => {
  it("表是满的 —— 审计认得的每一样资源都有来路", () => {
    /*
     * 这是"只做一处"那个病的疫苗:以后加一样资源（比如新的终局材料），
     * `AUDIT_RESOURCES` 会加，而这张表若没跟上就红。
     */
    const missing = AUDIT_RESOURCES.filter((r) => !resourceSourceOf(r));
    expect(
      missing,
      `这些资源没有来路 —— 玩家读到「尚差 N」时不知道去哪挣:\n${missing.join("\n")}`,
    ).toEqual([]);
  });

  it("被动来路必须真有那条流 —— 表说洞府产，engineFacilities 里就得有", () => {
    /*
     * 这一条是整件事的地基。表的每一条都是**断言**，而不是一份文案:
     * 「灵草被动产」这句话在代码里的依据是 `core/engineFacilities` 的
     * `field: (lv) => ({ herb: … })`。若哪天那条流被删了，表会自己红。
     */
    const facilities = readSource("src/core/engineFacilities.ts");
    const passive = AUDIT_RESOURCES.filter((r) => resourceSourceOf(r)?.mode === "passive");
    expect(passive.length, "一条被动来路都没有 —— 这个判据失去了对象").toBeGreaterThan(0);

    /** 洞里按小时产的那几样（`library` 产 wudao，`field` 产 herb/ore —— 见 HOUR_STREAMS） */
    const streams = (facilities.match(/HOUR_STREAMS\s*=\s*\[([^\]]*)\]/)?.[1] ?? "").replace(
      /"/g,
      "",
    );
    const offenders: string[] = [];
    for (const r of passive) {
      // 修为不靠洞府 —— 它走挂机与历练，故单独放行
      if (r === "exp") continue;
      if (!streams.includes(r)) {
        offenders.push(
          `${resourceNameOf(r)}(${r}):表说"被动产"，而 engineFacilities 的 HOUR_STREAMS 里没有它`,
        );
      }
    }
    expect(
      offenders,
      "这些资源被标成被动来路,而洞府里其实不产 —— 玩家会等一个等不到的东西:\n" +
        offenders.join("\n"),
    ).toEqual([]);
  });

  it("主动来路必须真有入账点 —— 表说历练掉，loot 里就得有", () => {
    /*
     * 「灵石只有历练掉」这句话的依据是 `core/loot` 的
     * `resources.addSmall("stone", …)`（或等价的入账）。若哪天灵石改成有被动产，
     * 这一条会红，提醒把表改对 —— 而不是让玩家照着表白等。
     */
    const loot = readSource("src/core/loot.ts");
    const active = AUDIT_RESOURCES.filter((r) => resourceSourceOf(r)?.mode === "active");
    expect(active.length, "一条主动来路都没有").toBeGreaterThan(0);
    /*
     * 入账写法在 `core/loot` 里有几种，且不统一:
     *   `resources.addSmall("page", n)`   小整数资源
     *   `resources.addStone(gain.stone)`  灵石走专用方法（GNum）
     *   `gain.stone` / `gain.dust`        先从结算里算好再入账
     *
     * 第一版判据只写了 `\b${r}\b` 这种"文中提过就算"的宽松匹配 ——
     * 故障注入时**没红**（把 wudao 标成 active 也照样通过），因为 `wudao`
     * 这个词在文件里到处都是。宽松到那个程度就不算判据了，等于给它发通行证。
     *
     * 故这里收成"必须是**入账调用**"，并允许 `addStone` 这条专用路径:
     */
    const incomeRe = (r: string): RegExp => {
      const camel = r.charAt(0).toUpperCase() + r.slice(1);
      return new RegExp(
        // addSmall("r" …) / addSmall('r' …)
        `addSmall\\(\\s*["']${r}["']` +
          // addStone( … ) 这类专用方法
          `|add${camel}\\(` +
          // gain.r 在入账行里出现（resources.add…(gain.r)）
          `|add\\w*\\(\\s*gain\\.${r}\\b`,
      );
    };
    const offenders: string[] = [];
    for (const r of active) {
      if (!incomeRe(r).test(loot)) {
        offenders.push(`${resourceNameOf(r)}(${r}):表说"历练掉"，而 core/loot 里没有它的入账调用`);
      }
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("每一条都有一句 how —— 只说「去历练」不算说清怎么挣", () => {
    /*
     * 与修之前的「尚差 N 道源」是同一种贫瘠:那句已经说了**差多少**，
     * 缺的正是"怎么来"。若 `how` 只是把 `label` 换个说法（「去历练」→「历练」），
     * 它没有增加任何信息。故这里要求 `how` 不能是 `label` 的子串，也不能太短。
     */
    const offenders: string[] = [];
    for (const [key, hint] of Object.entries(RESOURCE_SOURCES)) {
      if (hint.how.trim().length < 6) offenders.push(`${key}:how 太短「${hint.how}」`);
      if (hint.label.includes(hint.how) || hint.how.includes(hint.label)) {
        offenders.push(`${key}:how 只是 label 的复述「${hint.how}」`);
      }
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("与 economySim 的审计资源同集合 —— 两份清单不许漂", () => {
    /*
     * `ui/resourceSources` 独立声明了资源清单（理由见那边的注释:避免把纯审计导出
     * 拉进运行时可达集）。代价是两处要同步 —— 这一条就是那个钉子。
     */
    const sim = readSource("src/core/economySim.ts");
    const m = /type\s+AuditResource\s*=([^;]+);/.exec(sim);
    expect(m, "economySim 里找不到 AuditResource 的定义").toBeTruthy();
    const theirs = [...m![1]!.matchAll(/"([^"]+)"/g)].map((x) => x[1]).sort();
    const ours = [...AUDIT_RESOURCES].sort();
    expect(
      ours,
      `资源清单与 economySim 漂了:\n这里 ${ours.join(",")}\n那边 ${theirs.join(",")}`,
    ).toEqual(theirs);
  });

  it("表里的每条路由都是真路由 —— 指到不存在的页面等于没指", () => {
    const router = readSource("src/router/index.ts");
    for (const [key, hint] of Object.entries(RESOURCE_SOURCES)) {
      expect(hint.route.startsWith("/"), `「${key}」的去处不是一条绝对路由`).toBe(true);
      const seg = hint.route.split("?")[0]!;
      if (seg === "/") continue;
      expect(
        router.includes(`"${seg}"`) || router.includes(`'${seg}'`),
        `路由表里没有 ${seg}（${key}）`,
      ).toBe(true);
    }
  });

  it("资源名与 data 层不打架 —— 灵石/玄铁/灵草/残页/器灵尘/悟道点/道源", () => {
    /*
     * 这些名字在仓里已经有多处写法（`RESOURCE_LABELS`、`STAT_NAMES`、各面板）。
     * 这一层不另立一套，故判据要求它**与 `RESOURCE_LABELS` 对得上** ——
     * 同一个东西两个名字，玩家会以为是两样。`wudao` / `exp` 不在那张表里
     * （它们不是"掉落材料"），故单独放行。
     */
    const dataSrc = readFileSync(join(ROOT, "src/data/endgame.ts"), "utf8");
    const labels = /RESOURCE_LABELS[\s\S]{0,300}?}/.exec(dataSrc)?.[0] ?? "";
    const offenders: string[] = [];
    for (const key of Object.keys(RESOURCE_SOURCES)) {
      if (key === "wudao" || key === "exp" || key === "daoSource") continue;
      const m = new RegExp(`\\b${key}\\s*:\\s*"([^"]+)"`).exec(labels);
      if (!m) continue; // 这张表里没有它 —— 不归这条判据管
      if (m[1] !== resourceNameOf(key)) {
        offenders.push(`${key}:这里叫「${resourceNameOf(key)}」，data 层叫「${m[1]}」`);
      }
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});
