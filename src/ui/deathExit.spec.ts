/**
 * 已殁之身 —— 这一世结束了,玩家得走得下去。
 *
 * ## 抓到的死局
 *
 * `checkDeath` 的第一行是 `if (player.dead || age < lifespanMax) return` ——
 * 它只在「寿元刚够」的那一瞬负责判死并开卷。而 `deathAnnounced`(引擎私有字段)
 * 与 `ui.deathDialog` 都是**内存态,不落盘**。
 *
 * 于是有一条谁也走不出去的路径:玩家寿终的那一刻没关页面 → 正常;
 * 但若那一刻之前就关掉(或崩溃、或换了设备),下次读档 `player.dead` 已经是 true,
 * `checkDeath` 直接返回,`deathAnnounced` 也还是 false 却永远轮不到它。
 *
 * 实测(390×844,存档 `player.dead = true`):
 *
 * ```text
 * 首页顶栏写着「陨落」,而全页 [role="dialog"] 为空,
 * 也没有任何「往生 / 转世」入口 —— 这一世已经结束,玩家既不能继续也不能重开。
 * ```
 *
 * 这是彻底的死局,而它只在「关过页面」之后才出现 —— 开发时一路连着不关,
 * 永远撞不到。
 *
 * ## 第二处:已殁还能按「出发」
 *
 * 同一份存档下,历练页仍有可点的出发键。点下去模式窗照开,选完一档什么都不发生:
 * 不进军、不报错、弹窗也不关 —— 因为 `startExploration` 把 `!region || player.dead`
 * 并成了一句静默 `return false`,而它下面几行正写着
 * 「拒绝必须让玩家看见 —— 静默 return false 在界面上等同于『点了没反应』」。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

const source = readSource;

describe("读入已死存档时,往生那一关要补开", () => {
  it("启动链路里补一次 —— 判死只在「寿元刚够」那一瞬发生", () => {
    const engine = source("src/core/engine.ts");
    // 前提:checkDeath 确实对「已经死了」直接返回
    const at = engine.indexOf("private checkDeath()");
    expect(at, "checkDeath 找不到 —— 判据会空转").toBeGreaterThan(-1);
    const body = engine.slice(at, engine.indexOf("\n  }", at));
    expect(body, "前提:已死时 checkDeath 直接返回,故它不会再开卷").toMatch(
      /if \(player\.dead \|\| player\.age < player\.lifespanMax\)/,
    );

    /*
     * 补口必须在 start() 里,且条件要「已死 + 还没宣布过」:
     * 只看 dead 会在每次转世后被上一次的 true 挡住,只看 announced 又会在
     * 「本来就死了」的档上永远不触发。
     */
    expect(engine, "启动时要补开往生卷").toMatch(
      /if \(game\.started && usePlayerStore\(\)\.dead && !this\.deathAnnounced\)/,
    );
    expect(engine, "补开时要真的把弹窗立起来").toContain("setDeathDialog(true)");
  });

  it("死亡提示不落盘,所以只能靠读档时补 —— 这一条守着那个前提", () => {
    const ui = source("src/stores/ui.ts");
    const at = ui.indexOf("deathDialog");
    expect(at, "ui store 里找不到 deathDialog").toBeGreaterThan(-1);
    // 它是内存 ref,不进 persist 白名单
    expect(ui, "deathDialog 不该被持久化(它是「这一次会话还没看过」)").not.toMatch(
      /persist[\s\S]{0,300}deathDialog/,
    );
  });
});

describe("已殁之身不该再出门 —— 拒绝要让玩家看见", () => {
  it("startExploration 的死亡分支要报一句,不许静默 return", () => {
    const core = source("src/core/exploration.ts");
    const at = core.indexOf("export function startExploration");
    expect(at, "startExploration 找不到").toBeGreaterThan(-1);
    const nextExport = core.indexOf("\nexport ", at + 10);
    const body = core.slice(at, nextExport === -1 ? at + 4000 : nextExport);
    // 老写法:与 !region 并在一起的静默拒绝
    expect(body, "已死不该与「地界不存在」并成一句静默 return").not.toContain(
      "if (!region || player.dead) return false;",
    );
    expect(body, "已死的拒绝要说出话来").toMatch(/if \(player\.dead\) \{[\s\S]{0,120}notify\(/);
  });

  it("历练页干脆不摆那枚按不动的「出发」", () => {
    const view = source("src/views/AdventureView.vue");
    const at = view.indexOf("data-region-action");
    expect(at, "出发键找不到").toBeGreaterThan(-1);
    const tagStart = view.lastIndexOf("<button", at);
    const tag = view.slice(tagStart, at + 200);
    expect(tag, "出发键的显示条件要排除已殁").toContain("!player.dead");
  });

  it("章首那个「N 处可出发」跟着一起收 —— 否则同屏两本账", () => {
    const view = source("src/views/AdventureView.vue");
    expect(view, "可出发计数要认死亡状态").toMatch(
      /actionableCount = computed\([\s\S]{0,300}!player\.dead/,
    );
  });
});
