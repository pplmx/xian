/**
 * 天时 · 今天该去做什么 —— 效果行报了数，却没报「所以去哪儿」
 *
 * ## 由来
 *
 * 首页的定位在 `docs/development.md` 里写着:
 *
 * > **主页的定位是"指挥台"不是"操作台"** —— 它回答「现在该做什么」，然后把玩家送到那一页。
 *
 * 天时那一块目前长这样:
 *
 * ```text
 *   今日天时 · 月蚀        尚需修行 3 时 12 分
 *   月华暗涌，气运偏移。
 *   气运 +5% · 掉落率 +5%
 * ```
 *
 * 它把**效果**说全了（这一块做得很干净，`modsText` 同源、渡劫倍率带单位），
 * 却没有说**这件事意味着今天该去做什么**。而「气运 / 掉落率」这两个词对新手
 * 完全不可行动 —— 它们只在**打怪结算**里生效（`core/loot` 的
 * `dropEntriesFor` / `luck`），而打怪在历练页。
 *
 * 同一屏上的「今日日课」恰好有这个问题并且已经修过（见 `ui/dailyRoutes`）:
 * 「今日击败 15 个敌人」原先也是八个不可点的 `<li>`，玩家知道要做什么、
 * 不知道去哪儿做。天时这一块是同一屏上**剩下那一处**同型缺失。
 *
 * ## 为什么这不是「多此一举」
 *
 * 天时每天换一次，而它每换一次都在暗示一件不同的事:
 *
 * ```text
 *   灵雨 / 仙雨 / 混沌潮   修炼速度 + 灵气恢复   → 该修行（闭关、静坐）
 *   赤阳 / 神辉 / 本源涌动  攻击 + 伤害增幅        → 该去历练
 *   月蚀 / 紫气东来        气运 + 掉落率          → 该去历练（打掉落）
 *   霞光                  战斗修为 + 气运        → 该去历练
 *   罡风                  先手 + 闪避           → 该去历练
 *   凝霜 / 天朗 / 法则潮    防御 / 气血 / 灵气    → 该修行
 *   雷鸣 / 仙劫日 / 神威日  攻击 + 御劫下降        → 该攒准备，别急着渡劫
 *   清和                 无效果                → 照常
 * ```
 *
 * 这些推论**每一句都对**，但一句都没写在屏上。玩家要靠背 18 条天时才知道。
 *
 * ## 判据守什么
 *
 * 一 **每一条天时都有去向**（表是满的）—— 新加一条天时而忘了补表，当场红；
 * 二 **去向与它真正的效果对得上** —— 这是最要紧的一条。若哪天有人把
 *    「掉落率」的天时标成「去修行」，玩家照着走一趟，什么也没多拿。
 *    判据查的是**词条与去处的对应关系**，不是手抄一份表。
 * 三 那一行真的渲染在首页上（不是只有函数没人调）。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { weatherRouteOf, WEATHER_ROUTES } from "./weatherRoutes";
import { WEATHERS, WORLD_WEATHERS } from "@/core/weather";
import type { StatMods } from "@/types";

const ROOT = resolve(__dirname, "../..");
const ALL_WEATHERS = [...WEATHERS, ...Object.values(WORLD_WEATHERS).flat()];

describe("天时 · 今天该去做什么", () => {
  it("每一条天时都有去处 —— 表必须是满的", () => {
    /*
     * 这一条挡住「新加一条天时而忘了补表」。没有它的后果不是"少一个链接":
     * 那条天时永远只报数、不报路，与修之前一模一样。
     */
    const missing = ALL_WEATHERS.filter((w) => !weatherRouteOf(w)).map((w) => `${w.name}(${w.id})`);
    expect(
      missing,
      `这些天时没有去处 —— 玩家读到效果却不知道该去哪儿:\n${missing.join("\n")}`,
    ).toEqual([]);
  });

  it("凡带战斗向词条的天时,去处都是历练 —— 效果与路必须对得上", () => {
    /*
     * 这是整件事的地基。天时那几行字之所以"不可行动"，正因为
     * 「气运 +5%」本身不指向任何页面；而它在结算里只影响**打怪的掉落**
     * （见 `core/loot` 的 `dropEntriesFor` / `luck`）。
     *
     * 判据按**词条**推去处，不手抄名单:哪天有人改了某条天时的 mods，
     * 这一条会自己跟上（或当场红，如果表没跟着改）。
     *
     * ## 哪些词条算「战斗向」—— 这里窄过一次，值得记
     *
     * 第一版把 `defensePct` / `maxHpPct` 也算进来，于是凝霜（防御 +6% ·
     * 灵气恢复 +8%）、天朗（灵气恢复 +10% · 气血上限 +4%）、法则潮
     * （防御 +8% · 伤害减免 +6%）全被判成"该去历练"。
     *
     * 那三条**判据是对的、我的表是错的** —— 但更准确地说，是**分类**错了:
     * 防御与气血上限是**被动**属性（引擎每拍算进面板，玩家不需要去任何页面
     * 才能吃到），它们不构成"今天该去哪"的理由。真正让某个页面变划算的，
     * 是那些**只在该页面的动作里结算**的词条。
     *
     * 故这份名单只收"出手才吃到"的那几条:
     *
     * ```text
     *   attackPct / damageBonus / speed / dodgeRate / firstStrike
     *                              → 只在 core/combat 的回合里吃到
     *   luck / dropRate            → 只在 core/loot 的掉落结算里吃到
     *   expGain                    → 只在打怪的修为入账里吃到
     * ```
     *
     * 而 `qiRegen` 恰恰相反:它由 `core/engine` 每秒自动回复，是**被动**的
     * （灵气只用于突破与疗伤），故它归"修炼向"那一侧 —— 与
     * `cultivationSpeed` 一起指向修行页。
     */
    const COMBAT_MODS = [
      "attackPct",
      "damageBonus",
      "speed",
      "dodgeRate",
      "firstStrike",
      "luck",
      "dropRate",
      "expGain",
    ] as const;
    const offenders: string[] = [];
    for (const w of ALL_WEATHERS) {
      const mods = (w.mods ?? {}) as StatMods;
      const hasCombat = COMBAT_MODS.some((k) => (mods[k] ?? 0) !== 0);
      if (!hasCombat) continue;
      const hint = weatherRouteOf(w);
      if (!hint) continue; // 上一条已经在管"表不满"
      if (hint.route !== "/adventure") {
        offenders.push(`${w.name}:带战斗向词条,却指向 ${hint.route}（${hint.label}）`);
      }
    }
    expect(
      offenders,
      "这些天时的去处与它真正的效果对不上 —— 玩家照着走一趟,什么也不会多拿:\n" +
        offenders.join("\n"),
    ).toEqual([]);
  });

  it("只带修炼向词条的天时,去处是修行 —— 同理", () => {
    /*
     * 「**只**带」这三个字是判据的关键，也是它第二次修对的地方。
     *
     * `breakthroughRate` 与 `luck` 两样都能推进阶成功率（见 `core/breakthrough`
     * 的 `modOf(mods, "breakthroughRate")` 与 `modOf(mods, "luck") * BT_LUCK_TO_RATE`），
     * 于是「道音」（气运 +10% · 掉落率 +10% · 进阶成功率 +3%）三条词条里
     * 两条只在打的时候吃到、一条推进阶 —— 它指向哪一边都对了一半。
     *
     * 第一版判据只要"带修炼向词条"就要求指向修行，于是道音被点名。
     * 而那一句真正的意思是:**这条天时的主要收益在哪边**。
     * 故判据改成「只带修炼向、不带任何战斗向」才算"该去修行" ——
     * 两边都沾的那几条由人判断，判据不去猜。
     */
    const CULT_MODS = ["cultivationSpeed", "qiRegen", "breakthroughRate"] as const;
    const COMBAT_MODS = [
      "attackPct",
      "damageBonus",
      "speed",
      "dodgeRate",
      "firstStrike",
      "luck",
      "dropRate",
      "expGain",
    ] as const;
    const offenders: string[] = [];
    for (const w of ALL_WEATHERS) {
      const mods = (w.mods ?? {}) as StatMods;
      const hasCult = CULT_MODS.some((k) => (mods[k] ?? 0) !== 0);
      const hasCombat = COMBAT_MODS.some((k) => (mods[k] ?? 0) !== 0);
      // 两边都沾的不归这条判据管（见上面那段）
      if (!hasCult || hasCombat) continue;
      const hint = weatherRouteOf(w);
      if (!hint) continue;
      if (hint.route !== "/cultivation") {
        offenders.push(`${w.name}:只带修炼向词条,却指向 ${hint.route}（${hint.label}）`);
      }
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("渡劫更险的那几条,不许只说「去修行」—— 要说清是攒准备", () => {
    /*
     * 雷鸣 / 仙劫日 / 神威日 的 `tribulationMult > 1`，它们同时带攻击词条
     * （所以按上一条会指向历练）。但玩家在那些日子里最该知道的不是"去打怪"，
     * 而是"别急着渡劫"。故这几条的文案要单独说这件事 —— 它不是一条路由，
     * 是一句提醒，故用一个独立字段承载。
     */
    const risky = ALL_WEATHERS.filter((w) => w.tribulationMult > 1);
    expect(risky.length, "一条更险的天时都没有 —— 这个判据失去了对象").toBeGreaterThan(0);
    for (const w of risky) {
      const hint = weatherRouteOf(w)!;
      expect(
        hint.caution,
        `「${w.name}」渡劫更险（×${w.tribulationMult}），去处却没提这件事`,
      ).toBeTruthy();
    }
  });

  it("没有效果的天时（清和）也有一条去处 —— 说「照常」而不是空着", () => {
    /*
     * 清和是唯一 mods 为空的一条。若它的去处是 null，那一行会在
     * 每三个游戏日里有一天突然消失 —— 玩家的第一反应是"坏了"。
     * 故它也要有一条，说的是"今天没什么特别"。
     */
    const calm = ALL_WEATHERS.filter((w) => Object.keys(w.mods ?? {}).length === 0);
    expect(calm.length, "一条无效果天时都没有 —— 这个判据失去了对象").toBeGreaterThan(0);
    for (const w of calm) {
      expect(weatherRouteOf(w), `「${w.name}」没有去处 —— 那一行会突然消失`).toBeTruthy();
    }
  });

  it("首页真的把它渲染出来了 —— 不是只有函数没人调", () => {
    const home = readFileSync(join(ROOT, "src/views/HomeView.vue"), "utf8");
    expect(home, "首页没有接「今天该去做什么」").toContain("weatherRouteOf");
  });

  it("表里的每条路由都是真路由 —— 指到不存在的页面等于没指", () => {
    const router = readFileSync(join(ROOT, "src/router/index.ts"), "utf8");
    for (const [id, hint] of Object.entries(WEATHER_ROUTES)) {
      expect(hint.route.startsWith("/"), `「${id}」的去处不是一条绝对路由`).toBe(true);
      // 取第一段（去掉 query）
      const seg = hint.route.split("?")[0]!;
      if (seg === "/") continue;
      expect(
        router.includes(`"${seg}"`) || router.includes(`'${seg}'`),
        `路由表里没有 ${seg}`,
      ).toBe(true);
    }
  });
});
