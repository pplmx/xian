/**
 * 历练页的「三处断线」—— 数据都在,界面却没接上。
 *
 * 这一作的常见缺陷形态是**数据有、界面没用**(见 docs/design.md 的「这一类的形状」)。
 * 下面三条同属一类,而且都发生在玩家最常看的那两屏上:
 *
 * 1. **上一趟的战报挂在新一趟上** —— `lastBattle` 是全局一份,起新一程时没人清,
 *    于是刚出发、一场未打的面板上写着「胜 0 场」,却配着另一只敌人的完整战报、
 *    胜败结论与「本战所得」。会话账(全 0)与战局(有敌人、有胜果)同屏互相矛盾。
 *
 * 2. **「下一战还要多久」有六个写入点、零个读取点** —— 屏上只有「搜寻猎物中」
 *    加三点省略号,分不出「正在等」与「卡住了」。首战固定 12 秒,四小时档等一千多次。
 *
 * 3. **镇压资格的两本账** —— 卡面那三行读 `regionStats`(随神魂不灭),
 *    按钮读 `suppressQualified`(转世清空)。新一世会看到「20/20 胜 · 均 2.5 回合 ·
 *    均受伤 5%」三项全绿却没有「转为镇压收益」,而没有任何一个字解释为什么。
 *
 * 判据都读源码文本 —— 这三处坏掉时类型、编译、行为单测**全绿**,
 * 只有「界面有没有把这件事说出来」这一层看得见(见 core/singleSourceAudit 的同一条理由)。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

const source = readSource;

describe("起新一程前,上一趟的战报要清掉", () => {
  it("startExploration 落 session 时顺手清 lastBattle", () => {
    const core = source("src/core/exploration.ts");
    const at = core.indexOf("export function startExploration");
    expect(at, "startExploration 找不到").toBeGreaterThan(-1);
    // 到下一个顶层 export 为止,就是这一程的起手区间
    const nextExport = core.indexOf("\nexport ", at + 10);
    const body = core.slice(at, nextExport === -1 ? core.length : nextExport);
    expect(body, "起新一程却没有把上一趟的战报清掉 —— 面板会挂着另一只敌人的胜负").toContain(
      "recordBattle(null)",
    );
  });

  it("recordBattle 接受 null(「这一程还没交过手」是一个合法状态)", () => {
    const store = source("src/stores/adventure.ts");
    expect(store, "标记要能表达「本程尚无交手」").toMatch(
      /function recordBattle\(view: LastBattleView \| null\)/,
    );
  });

  it("战报仍是打到一场才写的 —— 清了之后不能又被清一次盖掉战果", () => {
    const core = source("src/core/exploration.ts");
    const run = core.indexOf("function runBattle");
    const body = core.slice(run);
    expect(body, "真打过一场仍要照常记战报").toContain("adventure.recordBattle(view)");
  });
});

describe("「下一战还要多久」必须有人读 nextBattleAt", () => {
  it("会话里存的是绝对时间戳(界面与引擎读同一份)", () => {
    const types = source("src/types/index.ts");
    const at = types.indexOf("export interface AdventureSession");
    const block = types.slice(at, types.indexOf("}", at) + 1);
    expect(block, "会话要记「下一场什么时候」").toMatch(/nextBattleAt:\s*number/);
  });

  it("战局面板读它并倒着走体验", () => {
    const panel = source("src/components/adventure/CombatPanel.vue");
    expect(panel, "面板要读会话的 nextBattleAt").toContain("nextBattleAt");
    expect(panel, "要有稳定落点供真浏览器复核").toContain("data-combat-next");
    expect(panel, "读数走 formatCountdown 定宽(秒针顺走,行宽不变)").toContain(
      "formatCountdown(nextBattleIn)",
    );
    expect(panel, "到点就整句收起,不闪一个 0 秒").toMatch(/v-if="nextBattleIn > 0"/);
  });

  it("秒级倒计时挂得上心跳 —— 与整趟倒计时同一个 now", () => {
    const panel = source("src/components/adventure/CombatPanel.vue");
    expect(panel, "读数依赖每秒一跳的 now,不是只 import 了它").toMatch(
      /const nextBattleIn = computed\(\(\) => \{[\s\S]{0,400}now\.value/,
    );
  });
});

describe("镇压资格的两本账要在界面上说清", () => {
  it("三条判据达标却还没资格令时,要有一句解释", () => {
    const view = source("src/views/AdventureView.vue");
    expect(view, "这一句要有稳定落点").toContain("data-suppress-relearn");
    expect(view, "它只在三条判据全过、而按钮没出现时说话").toMatch(
      /v-if="row\.progress\.qualified"[\s\S]{0,200}本世尚未取得资格令/,
    );
    expect(view, "还要说清前世的战绩仍记着 —— 否则玩家以为自己白打了").toContain(
      "前世战绩仍记于此",
    );
  });

  it("「资格永久」这句要被转世拆穿 —— 规则注里必须写「本世」", () => {
    const view = source("src/views/AdventureView.vue");
    const at = view.indexOf('name="adventure-rules"');
    const block = view.slice(at, view.indexOf("</FolioNote>", at));
    expect(block, "资格令只在**本世**永久,文案不许跨世承诺").toContain("本世永久");
    expect(block, "转世重证要写明").toContain("转世重证");
    expect(block, "老那句「资格永久」是会把玩家骗过一世的说法").not.toContain("资格永久,");
  });

  it("清空资格令的机制没被为了让文案成真而拆掉(它是防数值爆炸的那一道)", () => {
    const player = source("src/stores/player.ts");
    const at = player.indexOf("function rebirth(newLinggen");
    expect(at, "rebirth() 找不到 —— 这条判据会空转").toBeGreaterThan(-1);
    const nextFn = player.indexOf("\n    /** 存档修复 */", at);
    const block = player.slice(at, nextFn === -1 ? at + 4000 : nextFn);
    expect(block, "资格令仍随世清空:旧世压下的远境跨世会让新世数值爆炸").toContain(
      "suppressQualified.value = []",
    );
  });
});

describe("地界卡不许同时说「已镇压」和「还没踏足」", () => {
  it("路锁理由要排除镇压收益态 —— 镇压过就必然踏足过", () => {
    /*
     * 镇压只发生在胜利分支里(runBattle 的 result.win / offline 的胜利路径),
     * 故正常流程走不到「已镇压 + 进不去」。但坏档能构造出来:一份夹具同时摆
     * suppressedRegions 与空的 unlocked,屏上就出现
     * 「已镇压 · 自动产出 376灵石/时」配「需先击败青云山麓之主,方可踏足此地」。
     * 两句话直接打架,而玩家没有别的线索判断哪个是真的。
     */
    const view = source("src/views/AdventureView.vue");
    const at = view.indexOf("需先击败{{ prevRegionName(row.def) }}之主");
    expect(at, "路锁理由那句话找不到 —— 判据会空转").toBeGreaterThan(-1);
    // 取它所在的整段 <p ...> 开标签
    const tagStart = view.lastIndexOf("<p", at);
    const tag = view.slice(tagStart, at);
    expect(tag, "路锁理由必须排除镇压收益态").toContain("!row.suppressed");
  });

  it("镇压态本身仍要照常显示产出与停取入口(排除的是那句话,不是这张卡)", () => {
    const view = source("src/views/AdventureView.vue");
    expect(view, "镇压中的产出条仍在").toContain("data-suppress-info");
    expect(view, "「停取收益,改去历练」仍在").toContain("停取收益,改去历练");
  });
});
