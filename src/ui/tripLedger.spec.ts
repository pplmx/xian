/**
 * 收兵与结账 —— 这一趟算不算数,必须在按下之前说得出。
 *
 * ## 三件事
 *
 * 1. **「完成一次历练」有个玩家看不见的门槛。** `track("explores")` 只在
 *    `wins + losses >= 3` 时走,而它供着成就「行万里路 / 踏遍山河」(10 / 50 次)、
 *    日课「每日历练」、人生主题(60 次)。这个 3 从前是 `stopExploration` 里
 *    一个手写字面量 —— 于是没有任何地方能把「这一趟算不算」说出来。
 *
 * 2. **「收兵回府」是本作唯一会退出历练的动作,却是一键即走。** 同仓别的不可逆动作
 *    都做了二段式并摊开后果(远征「确认中道而返」、秘境「确认弃境」),只有这个
 *    最高频的没有。
 *
 * 3. **一趟历练的全部总结只在屏上停 2.6 秒。** 它还常跟成就、日课、任务挤在一起。
 *    四小时「长线云游」的全部结果就那样飘过去,而「这一趟值不值再来」正是要回看的。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { EXPLORE_TRIP_MIN_BATTLES } from "@/data/constants";

const source = readSource;

describe("「完成一次历练」的门槛只有一个住处", () => {
  it("结算里读常量,不再手写 3", () => {
    const core = source("src/core/exploration.ts");
    expect(core, "门槛要读唯一常量").toContain("EXPLORE_TRIP_MIN_BATTLES");
    expect(core, "又冒回一个手写的 `>= 3`").not.toMatch(/wins \+ s\.losses >= 3\b/);
  });

  it("界面上写门槛的那两处也读同一个常量,不手写数字", () => {
    const view = source("src/views/AdventureView.vue");
    const panel = source("src/components/adventure/CombatPanel.vue");
    expect(view, "「上一程」那一格要读常量").toContain("EXPLORE_TRIP_MIN_BATTLES");
    expect(panel, "收兵确认行要读常量").toContain("EXPLORE_TRIP_MIN_BATTLES");
    // 文案里手写的裸「3 场」会在改常数那天变成假话
    expect(panel, "确认行不许写死 3 场").not.toMatch(/未满 3 场/);
    expect(view, "「上一程」不许写死 3 场").not.toMatch(/未满 3 场/);
  });

  it("常量本身就是那个门槛(判据不许空转)", () => {
    expect(EXPLORE_TRIP_MIN_BATTLES).toBeGreaterThan(0);
    expect(EXPLORE_TRIP_MIN_BATTLES).toBeLessThan(10);
  });
});

describe("收兵回府要二段确认,并把这一趟算不算摊开", () => {
  it("未武装时不直接退出 —— 按下先只进入武装态", () => {
    const panel = source("src/components/adventure/CombatPanel.vue");
    expect(panel, "要有武装态字段").toContain("const leaveArmed = ref(false)");
    // 老写法是直接 @click="stopExploration('manual')"
    expect(panel, "收兵钮不许还是一键即走").not.toMatch(
      /combat-actions__stop[^>]*@click="stopExploration\('manual'\)"/,
    );
    expect(panel, "未武装那一支只进入武装态").toMatch(
      /v-if="!leaveArmed"[\s\S]{0,240}leaveArmed = true/,
    );
  });

  it("武装之后摊开「本趟几场 · 算不算」,两个键是「再想想 / 确认收兵」", () => {
    const panel = source("src/components/adventure/CombatPanel.vue");
    expect(panel, "确认行要有稳定落点").toContain("data-combat-leave-ask");
    expect(panel, "确认钮要有稳定落点").toContain("data-combat-leave-confirm");
    expect(panel, "取消词与全站一致").toContain("再想想");
    expect(panel, "确认词是「确认 + 动词」").toContain("确认收兵");
    expect(panel, "问句只说一句,由 leaveAskText 现算").toContain("{{ leaveAskText }}");
  });

  it("问句读的是与收尾播报同一份战绩文案,不另拼一遍", () => {
    const panel = source("src/components/adventure/CombatPanel.vue");
    expect(panel, "战绩走 ui/adventureText 的同一份实现").toContain("sessionRecordText(s)");
    expect(panel, "要说出「已足 N 场,计为一次历练」").toContain("计为一次历练");
    expect(panel, "要说出「未满 N 场,不计」").toContain("不计为一次历练");
  });
});

describe("上一程的结账回执留得住", () => {
  it("收兵时把这一份小结落盘 —— 会话下一行就被清空了", () => {
    const core = source("src/core/exploration.ts");
    const at = core.indexOf("export function stopExploration");
    expect(at, "stopExploration 找不到 —— 判据会空转").toBeGreaterThan(-1);
    const body = core.slice(at, core.indexOf("\n}\n", at));
    expect(body, "要写 lastTrip").toContain("adventure.setLastTrip(");
    // 这份账必须在 setSession(null) 之后仍然成立 —— 它记的是结账那一刻的事实
    expect(body, "记的是会话里的真数").toContain("s.wins + s.losses");
  });

  it("回执记下「算不算」与「何时」,不是事后再猜", () => {
    const types = source("src/types/index.ts");
    const at = types.indexOf("export interface TripSummary");
    expect(at, "TripSummary 类型找不到").toBeGreaterThan(-1);
    const block = types.slice(at, types.indexOf("}", at) + 1);
    for (const field of ["regionName", "reason", "at", "battles", "record", "haul", "counted"]) {
      expect(block, `回执要记 ${field}`).toContain(field);
    }
  });

  it("历练页把它摆出来,并明说算不算一次历练", () => {
    const view = source("src/views/AdventureView.vue");
    /*
     * 光断言「源码里有这个字符串」是假绿:把 v-if 改成 false、把整块挪进注释,
     * 字符串仍在。故这里按**元素**取,并要求它的可见条件是 lastTrip 本身。
     */
    const aside = view.match(/<aside[\s\S]{0,320}?data-adventure-lasttrip[\s\S]{0,1200}?<\/aside>/);
    expect(aside, "上一程那一栏找不到").not.toBeNull();
    const block = aside![0];
    expect(block, "可见条件必须是「有上一程」,不是被停用的条件").toMatch(/v-if="lastTrip"/);
    expect(block, "算不算要有可供断言的状态").toContain("data-last-trip-counted");
    expect(block, "计入与未计入各说各的话").toContain("已计一次历练");
    expect(block, "未计入那一侧也要说得出原因").toContain("未计历练");
    // 这一栏排在正文之前:它是「刚才那一趟」,不该被地界表压到页尾
    const asideAt = view.indexOf("data-adventure-lasttrip");
    const registerAt = view.indexOf("data-adventure-register");
    expect(asideAt, "上一程要排在历练正文之前").toBeLessThan(registerAt);
  });

  it("旧档没有这一栏时不当成坏档 —— 只是「还没有上一程」", () => {
    const store = source("src/stores/adventure.ts");
    // 找「把修好的形状写回去」那一处,不依赖局部变量叫什么名字
    const at = store.indexOf("lastTrip.value = tripRaw");
    expect(at, "sanitize 里没有修这一栏").toBeGreaterThan(-1);
    const block = store.slice(Math.max(0, at - 500), at + 900);
    expect(block, "空值要退回 null,而不是留一份形状可疑的对象").toContain(": null");
    expect(block, "坏 shape 的 reason 要落回安全默认").toContain('"manual" as const');
  });
});

describe("际遇帖要说得出「你还在哪一趟里」", () => {
  it("弹窗不可关、最多压 120 秒 —— 那两分钟里战局面板被整个盖住", () => {
    const dialog = source("src/components/adventure/EventDialog.vue");
    // 前提判据:这个弹窗确实不可关(否则这一行没有存在的必要)
    expect(dialog, "际遇帖不可关:必须作答").toContain(':closable="false"');
    expect(dialog, "它确实压得住整屏").toContain('size="wide"');
  });

  it("题签之后补一行「地界 · 档位 · 这一程还剩 N」", () => {
    const dialog = source("src/components/adventure/EventDialog.vue");
    expect(dialog, "要有稳定落点供真浏览器复核").toContain("data-event-trip");
    expect(dialog, "只在历练途中说 —— 洞府巡游那类同组件弹窗不在这一趟里").toMatch(
      /v-if="tripLine"/,
    );
    expect(dialog, "余时取自会话的 endsAt,与战局的整趟倒计时同源").toMatch(
      /const tripLine = computed\(\(\) => \{[\s\S]{0,400}s\.endsAt/,
    );
    expect(dialog, "档名取唯一那一份档位表,不另写").toContain("EXPLORE_MODES[s.mode].name");
  });
});
