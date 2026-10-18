/**
 * 文案数值对账 —— 「写了多少,就得给多少」
 *
 * 玩家最容易撞见的缺陷不是崩溃,而是**说明与实现不一致**:文案写「攻击 +20%」,
 * 数据里却是 0.15;或者规则改过一版,文案忘了跟。这类问题单元测试看不见
 * (两边各自都"对"),静态审计也看不见(类型不关心数字),只有把两者对起来才现形。
 *
 * 判据只钉**形状保证配对**的那几张表:条目自带说明文本、也自带数值负载
 * (变数、秘境随机规则、增益)。
 *
 * 顿悟 / 洞府巡游的选项曾因此被排除在外(「数值挂在 buffs 上,硬对只会误报」)——
 * 那份自陈就是一处审计盲区:选项文案手抄了「修炼速度 +20%」,真值在 buffs 的 mods 里,
 * 两本账各自都"对",改常数那一夜界面就开始撒谎。现在选项文案只剩风味,数字一律由
 * ui/earlyGameText 从 buffId / reward / penalty 现算,于是可以按 buffId、
 * `penalty.type → cave_penalty_*` **配对**审计(见文末那一节),不再误报。
 *
 * 编码有三种,都要认:
 *   x      —— 0.15 表示 +15%(概率、词条)
 *   1+x    —— 1.15 表示 +15%(敌方/治疗倍率)
 *   1-x    —— 0.25 与「-75%」同义(治疗压制)
 * 另有「降低/减少/下降」这类反向措辞,允许数值为负。
 */
import { describe, expect, it } from "vite-plus/test";
import { MUTATORS } from "@/data/mutators";
import { SECRET_RULES } from "@/data/secretRealms";
import { BUFFS, buffDef } from "@/data/buffs";
import { PILLS } from "@/data/pills";
import { AFFIXES } from "@/data/affixes";
import { ACHIEVEMENTS } from "@/data/achievements";
import { DAILY_TASKS, MAIN_QUESTS } from "@/data/quests";
import { STAT_NAMES } from "@/ui/statNames";
import {
  CAVE_EVENT_POOL,
  ENLIGHTENMENT_OPTIONS,
  BREAKTHROUGH_PREP_OPTIONS,
} from "@/data/earlyGame";
import { modernDuration } from "@/data/timeUnits";
import { caveOptionEffectText, durationText, enlightenmentEffectText } from "@/ui/earlyGameText";
import { PACTS } from "@/data/pacts";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { cnNumber, formatSignedPercent } from "@/utils/format";
import { REALMS, WORLDS, ascensionLeap } from "@/data/realms";
import { VEIN_MAIN_CAPACITY, VEIN_SIDE_CAP, VEIN_TOTAL_CAPACITY } from "@/data/constants";
import { VEINS } from "@/data/veins";
import { BUILD_PROFILES } from "@/core/buildSim";
import { HEXAGRAMS, TRIGRAMS } from "@/data/yijing";
import { PALACES, STARS } from "@/data/ziwei";
import { MANSIONS } from "@/data/xiangxiu";
import { GATES } from "@/data/qimen";
import { SECRET_LAYERS } from "@/data/secretRealms";
import { ARTIFACT_MAX_SLOTS, ARTIFACT_SLOT_UNLOCK_MAJOR } from "@/data/artifacts";
import { EXPEDITION_ROUTE_LAYERS } from "@/data/endgame";
import { MUTATION_FIGHTS } from "@/core/expedition";
import { PROFILE_MIN_MARKS } from "@/core/identity";
import type { CaveEvent } from "@/types";

/** 文案里的百分比是否能在同一条目的数值里找到对应 */
function percentBacked(percent: number, nums: number[]): boolean {
  const p = percent / 100;
  return nums.some((v) => {
    const candidates = [v, Math.abs(v)];
    for (const c of candidates) {
      if (Math.abs(c - p) < 1e-9) return true; // x
      if (Math.abs(c - 1 - p) < 1e-9) return true; // 1+x
      if (Math.abs(c - (1 - p)) < 1e-9) return true; // 1-x
      if (Math.abs(c - percent) < 1e-9) return true; // 直接写了百分数
    }
    return false;
  });
}

function percentsOf(text: string): number[] {
  return [...text.matchAll(/(\d+(?:\.\d+)?)\s*%/g)].map((m) => Number(m[1]!));
}

describe("文案数值对账 · 天道变数", () => {
  it("每条变数说明里的百分比,都能在它自己的 rules 里找到", () => {
    let checked = 0;
    for (const m of MUTATORS) {
      const nums = Object.values(m.rules).flatMap((v) =>
        typeof v === "number" ? [v] : typeof v === "object" && v !== null ? Object.values(v) : [],
      ) as number[];
      for (const pc of percentsOf(m.text)) {
        checked += 1;
        expect(
          percentBacked(pc, nums),
          `变数「${m.name}」文案写 ${pc}%,数值里对不上:${m.text} · [${nums.join(", ")}]`,
        ).toBe(true);
      }
    }
    expect(checked, "一条百分比都没扫到,断言形同虚设").toBeGreaterThanOrEqual(5);
  });
});

describe("文案数值对账 · 秘境随机规则", () => {
  it("每条规则的说明与它自己的 rules 一致", () => {
    let checked = 0;
    for (const r of SECRET_RULES) {
      const nums = Object.values(r.rules).flatMap((v) =>
        typeof v === "number" ? [v] : typeof v === "object" && v !== null ? Object.values(v) : [],
      ) as number[];
      for (const pc of percentsOf(r.text)) {
        checked += 1;
        expect(
          percentBacked(pc, nums),
          `秘境规则「${r.text}」的 ${pc}% 对不上:[${nums.join(", ")}]`,
        ).toBe(true);
      }
    }
    expect(checked).toBeGreaterThanOrEqual(3);
  });
});

describe("文案数值对账 · 增益(Buff)", () => {
  /**
   * 这一条从前是「说明里的百分比必须能在 mods 里对到」—— 它证明的是两本账
   * **暂时**一致,而两本账本身才是病根:改 mods 的那一夜界面开始撒谎,直到有人
   * 想起改文案。现在说明只剩风味(见 data/buffs.ts 文件头与文末「说明只说风味」一节),
   * 于是这条改成它本该守的东西:**每个增益都得有数值承载** —— 空了就等于
   * 「说有增益、其实什么也不加」,比写错更糟。
   */
  it("每个增益都有数值承载 —— 说明可以留白,mods 不能空", () => {
    for (const b of BUFFS) {
      const nums = Object.values(b.mods) as number[];
      expect(nums.length, `增益「${b.name}」的 mods 是空的:界面上它什么也不加`).toBeGreaterThan(0);
      // 全零同样等于空(引擎侧按值判定,零值不参与结算)
      expect(
        nums.some((v) => v !== 0),
        `增益「${b.name}」的 mods 全是零:[${nums.join(", ")}]`,
      ).toBe(true);
      expect(b.durationSec, `增益「${b.name}」没有时长,它永远不会过期`).toBeGreaterThan(0);
    }
    expect(BUFFS.length, "增益表空了,判据形同虚设").toBeGreaterThanOrEqual(38);
  });
});

describe("文案数值对账 · 天道契约", () => {
  /**
   * 契约的规则文案里有两类数字:
   *   ① 数值型 —— maxRounds / playerStartHpPct 等,写在 rules 里;
   *   ② 特殊约束 —— 如 `special: 'endHp80'`(每场战后气血须 ≥80%),
   *      数值就藏在特殊标记的名字里,故额外允许"百分比数字出现在 special 字符串里"。
   */
  it("每条契约的规则文案,数字都能在它自己的 rules / sourceMult / special 里找到", () => {
    let checked = 0;
    for (const p of PACTS) {
      const rules = p.rules ?? {};
      const nums = Object.values(rules).flatMap((v) =>
        typeof v === "number" ? [v] : typeof v === "object" && v !== null ? Object.values(v) : [],
      ) as number[];
      if (typeof p.sourceMult === "number") nums.push(p.sourceMult);
      for (const pc of percentsOf(p.ruleText)) {
        checked += 1;
        const inSpecial = typeof p.special === "string" && p.special.includes(String(pc));
        expect(
          inSpecial || percentBacked(pc, nums),
          `契约「${p.name}」文案写 ${pc}%,rules/特殊约束里对不上:${p.ruleText}`,
        ).toBe(true);
      }
    }
    expect(checked).toBeGreaterThanOrEqual(1);
  });

  it("契约文案里的**裸数字**也要对得上(「回合上限 25」这类不带宽高符号的写法)", () => {
    // 只扫 % 会漏掉契约最典型的写法:「回合上限 25」「道源 ×1.6」。
    // 契约文案是公式化的,故这里连裸数字一起对账(变数/增益的文案更散文,不适用)。
    let checked = 0;
    for (const p of PACTS) {
      const rules = p.rules ?? {};
      const nums = Object.values(rules).flatMap((v) =>
        typeof v === "number" ? [v] : typeof v === "object" && v !== null ? Object.values(v) : [],
      ) as number[];
      if (typeof p.sourceMult === "number") nums.push(p.sourceMult);
      for (const m of p.ruleText.matchAll(/(\d+(?:\.\d+)?)/g)) {
        const n = Number(m[1]);
        checked += 1;
        const inSpecial = typeof p.special === "string" && p.special.includes(String(n));
        expect(
          inSpecial || percentBacked(n, nums),
          `契约「${p.name}」文案里的 ${n} 对不上:${p.ruleText}`,
        ).toBe(true);
      }
    }
    expect(checked).toBeGreaterThanOrEqual(4);
  });
});

/**
 * 视图文案也要对账 —— 这一类更难自动核:模板里的数字可能是常量、也可能来自别的表。
 * 故只钉**已经确认过归属**的几处:它们曾经手抄过数字(注释还写着"唯一来源是 X",
 * 数字却是手打的),改常数就会撒谎。判据 = 引用来源 + 不再出现那个字面量。
 */
describe("文案数值对账 · 视图不手抄数字", () => {
  const src = (from: string): string =>
    readFileSync(resolve(__dirname, from), "utf8")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");

  it("人物页的道果说明与边际收益都取自 DAO_FRUIT_* 常数", () => {
    const view = src("../views/CharacterView.vue");
    expect(view, "道果每枚加成应读常数").toContain("DAO_FRUIT_CULT_BONUS");
    expect(view, "道躯加成应读常数").toContain("DAO_FRUIT_COMBAT_BONUS");
    // 手抄过的两处字面量必须消失(改了常数却忘了改文案,正是这条要拦的)
    expect(view).not.toContain("修行 +3%");
    expect(view).not.toContain("道躯 +1.5%");
    // formatPercent 自带 % 尾巴,第二项后面再补一个字面 % 就成了 +2%%(实测:
    // 「道躯 +2%%」)。不许在 formatPercent(道躯) 之后紧跟一个字面百分号。
    expect(view, "道躯 formatPercent 后不许再补字面 %").not.toMatch(
      /formatPercent\(DAO_FRUIT_COMBAT_BONUS[^{]*\}\}%/,
    );
    expect(view, "边际收益里的 ×3 也是手抄的,应改成常数").not.toMatch(/effective \* 3\b/);
    expect(view, "有效枚数 toFixed(0) 会把 7.94 写成 8").not.toContain("effective.toFixed(0)");
    expect(view).toContain("effectiveText");
    expect(view, "有效修行加成必须走 cultBonusText,不许再 Math.round 成整数%").toContain(
      "cultBonusText",
    );
    expect(view).not.toMatch(/Math\.round\(fruitInfo\.effective/);
    // 熔炉弹窗拆出后判据随本体走(components/celestial/FurnaceDialog.vue):
    // S3 链路行(有效/凝后枚数)整个搬进了 FurnaceDialog
    const celestial = src("../components/celestial/FurnaceDialog.vue");
    expect(celestial).not.toContain("effective.toFixed(0)");
    expect(celestial).not.toContain("nextEffective.toFixed(0)");
    expect(celestial).toContain("effectiveText");
    expect(celestial).toContain("nextEffectiveText");
  });

  it("修行页的闭关文案取自 buffs.ts 的 retreat 本体", () => {
    const view = src("../views/CultivationView.vue");
    expect(view, "闭关时长与加成应读 buff 定义").toContain('buffDef("retreat")');
    expect(view).not.toContain("5 分钟,修炼速度 +150%");
    expect(view).not.toContain("5分钟 修炼 +150%");
  });

  it("闭关的「后每秒/多收」估算只在未闭关头作前瞻 —— 闭关中现速率已含加成,再折算即重复叠加", () => {
    const view = src("../views/CultivationView.vue");
    // 前瞻行要挂在未闭关口:这正是它作为「决定要不要闭」的估值的意义
    expect(view, "闭关估算应 v-if 在未闭关时展示").toContain('v-if="!retreating"');
    // 预估要读 retreat 常量去折算,不许手写「×2.5」这类(改 buff 就会撒谎)
    expect(view, "闭关估算应折现倍率,不手抄倍率").toContain("retreatDef?.mods.cultivationSpeed");
  });

  it("突破幕亮出破境增益:谁在顶这一阶一眼见,文案走 buff→modsText;大关幕不亮", () => {
    const view = src("../views/CultivationView.vue");
    expect(view).toContain("breakthroughBuffRows");
    expect(view).toContain('k === "breakthroughRate"');
    expect(view).toContain("modsText");
    // 守卫必须跟在条本身旁边(±300 字符内),只 toContain 会被改名前那 6 处既有守卫穿透
    expect(view, "大关守卫必须与破境条同块 —— 删条上 v-if 立刻红").toMatch(
      /!btInfo\.needTribulation[\s\S]{0,300}breakthroughBuffRows\.length/,
    );
    // 四味都用 buff 全名 —— 第四味真名是「本源归一」,只写「本源」会把它缩成别名
    for (const pill of ["破境", "凝神", "定心", "本源归一"]) {
      expect(view, `${pill} 没接进突破幕的破境增益`).toContain(pill);
    }
  });

  it("突破失败的真代价要摊开:不只损修为,还必发重伤(修速减半/战力大减,需引气静养)", () => {
    const view = src("../views/CultivationView.vue");
    // 败后 addBuff("injury") 是确定会发生的(buff 定义在 buffs.ts);失败那行的账若不把
    // 重伤写进去,玩家只看到「损修为 X%」,以为成败只在修为上折 —— 界面就欠了半句
    expect(view, "失败行必须点名「重伤」").toContain("重伤");
    expect(view, "重伤要与 injury buff 的 desc 同源,不另手抄").toContain('buffDef("injury")');
    expect(view, "重伤时长应引 INJURY_DURATION").toContain("INJURY_DURATION");
    // 不许退回「成败都只在修为上折」那种把它说成唯一代价的旧话(实为撒谎)
    expect(view, "旧话把成败说成只损修为 —— 才是真的不完整账").not.toContain("成败都只在修为上折");
  });

  it("突破按钮的「灵气不足」要补缺:还差多少、回够要多久直显,不许只给四字灰", () => {
    const view = src("../views/CultivationView.vue");
    // reason 报「灵气不足」时,按钮下方必须有 btQiBlock 的短差与 ETA;删/收缩成四字立刻红
    expect(view).toContain('btInfo.value.reason !== "灵气不足"');
    expect(view).toContain('v-if="btQiBlock"');
    expect(view).toContain("尚差 {{ btQiBlock.short }}");
  });

  it("灵气「已封顶」用琥珀色 —— qing 会读成祥和安好,实则攒到天花板", () => {
    const view = src("../views/CultivationView.vue");
    expect(view).toMatch(/text-amber-ink[\s\S]{0,80}已封顶/);
  });

  it("同一味药的「两处数法」要分清:主屏 ×N 是同刻叠加份数,弹窗数的是服用颗数", () => {
    const chip = src("../views/CultivationView.vue");
    // 主屏胶囊挂角标算的是「同刻共享词条的状态数」(buffStackSize),不是本药吃了几颗
    expect(chip, "主屏叠加角标应引 buffStackSize 同族台账").toContain("buffStackSize(");
    // 除非同刻真在叠,不该挂角标 —— 不会把人误导成「这药吃了 N 颗」
    expect(chip).toContain('v-if="b.stack > 1"');
    // 角标要有把话说清的读屏文案,不许光一个 ×N 让人猜
    expect(chip, "×N 须带 aria-label 说明是「与 N-1 味同刻叠加」").toContain("同刻叠加");
    const dlg = src("../components/cultivation/BuffDialog.vue");
    // 弹窗「已服 N 颗」数的是连吃颗数(封顶倍数),与主屏的「叠」不是一回事
    expect(
      dlg,
      "弹窗的服用颗数不要借「已叠/ 份」'字面 —— 那正是主屏叠加份数的叫法,会撞口径",
    ).not.toContain("已叠");
    expect(dlg, "弹窗服用颗数该写「已服 … 颗」").toContain("已服");
    expect(dlg, "颗数引 buffStackCount(封顶在至多可攒倍数)").toContain("buffStackCount(");
    expect(dlg, "至多可攒该把倍数摊开").toContain("capMult");
  });

  it("灵脉投资/改立主脉付不起要置灰并列出尚差 —— 与其他消费点同族规", () => {
    const view = src("../components/dongfu/VeinInvestCard.vue");
    // 按钮置灰(listable)之外,按钮文字必须列「尚差 N 石」(AGENTS#2 决策信息完整)
    expect(view).toContain(':disabled="!canInvest(v.id)"');
    expect(view).toContain('v-else-if="stoneShort > 0"');
    expect(view).toContain("尚差 {{ formatGN(stoneShort) }} 石");
    expect(view).toContain(':disabled="!canSwitchTo(v.id)"');
    expect(view).toContain("`改立主脉 · 尚差 ${formatGN(switchStoneShort)} 石`");
    expect(view).toContain("switchStoneShort > 0");
  });

  it("构筑快照存满要置灰并说清,不许点到弹窗里才吃闭门羹", () => {
    const view = src("../views/BuildView.vue");
    // 快照满额时「+ 存当前构筑」该置灰(与全仓「满/付不起置灰+列差」同一纪律)
    expect(view, "快照满额应置灰存入口").toContain(':disabled="loadoutsFull"');
    expect(view, "满额入口文字要醒目改口").toContain('"快照已满"');
    expect(view, "满额判定读 MAX_LOADOUTS(与题头 N/M 同源)").toContain(
      "loadouts.list.length >= MAX_LOADOUTS",
    );
    expect(view, "弹窗里存满也要拦并提示删套再存").toContain("先删一套再存");
    expect(view, "不许把满额判定写死成 6").not.toMatch(/>= ?6\b/);
  });

  it("洞府的营造计数不手写 —— 「N 座建筑」要随 BUILDINGS.length 走", () => {
    const view = src("../views/DongfuView.vue");
    // 题头已营 N/M 读 BUILDINGS.length;「俱已至顶」那句也不许手写「七座」
    expect(view, "营造尽善那句该引建筑数").toContain("cnNumber(BUILDINGS.length)");
    expect(view, "手写「七座建筑」会在建筑集变更时与 N/M 打架").not.toContain("七座建筑");
    expect(view, "判定与题头同源读 BUILDINGS").toContain("BUILDINGS");
  });

  it("灵气充盈:off 态与阈值都摊开,且阈值/加成读常数不手抄(AGENTS「机制要露进界面」)", () => {
    const view = src("../views/CultivationView.vue");
    // 灵气 ≥ 标称容量一半即触发 +15% 修炼 —— off 态(尚差多少)与 on 态(在吃这个加成)
    // 都要直显;且 0.5 / 0.15 不许在视图里手抄,只能引 QI_RICH_THRESHOLD_RATIO / QI_RICH_BONUS
    expect(view).toContain("qiRichInfo.on");
    expect(view).toContain("距灵气充盈尚差");
    expect(view).toContain("灵气充盈 —— 修炼速度");
    expect(view).toContain("QI_RICH_THRESHOLD_RATIO");
    expect(view).toContain("QI_RICH_BONUS");
    expect(view).not.toContain("qiCapValue * 0.5");
  });
});

/**
 * 数量也要对账 —— 「四界二十一境」「六十四卦」「三层」这类写法,数字同样是手抄的。
 *
 * 与百分比不同:数量不会自己变,只有**内容增长**时才变 —— 那正是最容易漏的时刻
 * (加了界域、加了卦,没人会想起界面上还有一句写着旧数字)。故这里逐处钉:
 * 页面写的数量必须由来源表数出来,且原来的字面量必须消失。
 *
 * 判据同时钉住「值没变」:算法换了,玩家看到的还得是原来那句(四界二十一境、
 * 六十四卦、三层……),否则接线就成了改文案的借口。
 */
describe("文案数值对账 · 视图不手抄数量", () => {
  const src = (from: string): string =>
    readFileSync(resolve(__dirname, from), "utf8")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");

  it("接线换的是算法,不是玩家看到的数", () => {
    expect(`${cnNumber(WORLDS.length)}界${cnNumber(REALMS.length)}境`).toBe("四界二十一境");
    expect(cnNumber(TRIGRAMS.length)).toBe("八");
    expect(cnNumber(HEXAGRAMS.length)).toBe("六十四");
    expect(cnNumber(PALACES.length)).toBe("十二");
    expect(cnNumber(STARS.length)).toBe("十四");
    expect(cnNumber(MANSIONS.length)).toBe("二十八");
    expect(cnNumber(GATES.length)).toBe("八");
    expect(cnNumber(SECRET_LAYERS)).toBe("三");
    expect(cnNumber(EXPEDITION_ROUTE_LAYERS)).toBe("三");
    expect(cnNumber(MUTATION_FIGHTS)).toBe("六");
    expect(cnNumber(PROFILE_MIN_MARKS)).toBe("五");
    expect(cnNumber(ARTIFACT_MAX_SLOTS)).toBe("二");
    expect(
      REALMS[ARTIFACT_SLOT_UNLOCK_MAJOR]?.name,
      "法宝位门槛写的是第几个境界,名字得从境界表取",
    ).toBe("元婴");
  });

  it("洛书排布句是一张地图:八门各占一宫、中五无门", () => {
    // 视图把这句从 GATES 推出来;表里若出现两门同宫、或门落到中五,那句话就会说谎
    const palaces = GATES.map((g) => g.palace);
    expect(new Set(palaces).size, "两门同宫 —— 排布句会漏掉一门").toBe(GATES.length);
    expect(palaces.every((p) => p >= 1 && p <= 9)).toBe(true);
    expect(palaces.includes(5), "中五无门,不得有门占中宫").toBe(false);
  });

  it("界域志入口的数量取自 REALMS / WORLDS", () => {
    const view = src("../views/CharacterView.vue");
    expect(view).toContain("cnNumber(WORLDS.length)");
    expect(view).toContain("cnNumber(REALMS.length)");
    expect(view).not.toContain("四界二十一境");
  });

  it("战力明细要把三围的权重摊开 —— 战力是加权和,删权重玩家就看不出涨在哪一项", () => {
    const view = src("../views/CharacterView.vue");
    // 战力详情行必须引 POWER_WEIGHTS(与 powerScore 同一处),不许手写 ×3/×2/×0.15
    expect(view, "战力明细行应读权重常数,不手抄倍率").toContain("POWER_WEIGHTS.attack");
    expect(view, "防御权重同理").toContain("POWER_WEIGHTS.defense");
    expect(view, "血权重同理").toContain("POWER_WEIGHTS.maxHp");
    expect(view, "权重要在明细里说人话(×N 计入战力)").toContain("计入战力");
    // 手抄过的三倍率字面量不得改回来(改 POWER_WEIGHTS 常数,这条才该跟着动)
    expect(view, "手抄 ×0.15/×3/×2 会与常数打架").not.toContain("按 ×0.15 计入战力");
  });

  it("界域志各门的数量取自各自的表(易 / 紫微 / 星象 / 奇门)", () => {
    const view = src("../views/RealmCodexView.vue");
    for (const ref of [
      "TRIGRAMS.length",
      "HEXAGRAMS.length",
      "PALACES.length",
      "STARS.length",
      "MANSIONS.length",
      "GATES.length",
    ]) {
      expect(view, `界域志应读 ${ref}`).toContain(ref);
    }
    expect(view, "洛书排布句应由 GATES 推出").toContain("luoshuGatesText");
    expect(view, "四象配四界那句应由 IMAGES 推出").toContain("imageWorldMap");
    for (const hand of ["六十四卦", "十二宫所主", "十四主星", "二十八宿"]) {
      expect(view, `手抄的「${hand}」应改成从表里数`).not.toContain(hand);
    }
  });

  it("秘境层数取自 SECRET_LAYERS(凡境与天界共用一张卡)", () => {
    const card = src("../components/adventure/SecretRealmCard.vue");
    expect(card).toContain("cnNumber(SECRET_LAYERS)");
    expect(card).not.toContain("三层 · 出则散");
  });

  it("远征行程与变数连战数取自 EXPEDITION_* / MUTATION_FIGHTS", () => {
    // 远征域拆出后:行程/界主部分随本体走 ExpeditionPanel,
    // 变数连战数(markText)仍暂在主文件,随试炼块改道
    const view = src("../components/celestial/ExpeditionPanel.vue");
    expect(view).toContain("cnNumber(EXPEDITION_ROUTE_LAYERS)");
    expect(view, "界主层判定读常数,不写 3").toContain("EXPEDITION_GUARDIAN_LAYER");
    expect(view, "行程点列不该自己数一遍重数").not.toContain("'一重', '二重', '三重'");
    expect(view).not.toContain("三重已过");
    // 试炼域拆出后变数连战数随本体走 TrialPanel
    const cel = src("../components/celestial/TrialPanel.vue");
    expect(cel).toContain("cnNumber(MUTATION_FIGHTS)");
    expect(cel).not.toContain("六连战");
    // 变数全捷的战报冠词也读常数(不是把 6 再抄一遍):「六战全捷」随 MUTATION_FIGHTS 走
    expect(cel, "全捷战报的连战数要读 MUTATION_FIGHTS").toContain(
      "${cnNumber(MUTATION_FIGHTS)}战全捷",
    );
    expect(cel, "不许手写「六战全捷」当常数改了只顾一头").not.toContain("六战全捷");
  });

  it("中道而返是两段式确认,且披露此行的道源损失(误触不再赔整趟远征)", () => {
    // 远征域拆出后判据随本体走(components/celestial/ExpeditionPanel.vue)
    const view = src("../components/celestial/ExpeditionPanel.vue");
    // 不可逆的毁约/熔尽/重写在别处一律两段式;远征放弃落上同一待遇 —— 若有人把
    // v-if="abandonArmed" 这段摘掉改回一键,守卫会红(决策前摊数字契约)
    expect(view, "中道而返该先进入待确认态,不是立刻执行").toContain('@click="abandonArmed = true"');
    expect(view, "待确认态得能喊停").toContain("再想想");
    expect(view, "确认动作要把此行损失摊开").toContain("尽付东流");
    expect(view, "确认按钮不该与普通按钮同名(防误触)").toContain("确认中道而返");
  });

  it("远征启程的提交钮要点名入界成本与败北后果 —— 决策信息不能只在前一屏卡片上给", () => {
    // 远征域(prep 弹窗 + 虚界卡同域)拆出后判据随本体走 ExpeditionPanel
    const view = src("../components/celestial/ExpeditionPanel.vue");
    // prep 的「启 程」按钮是动手前最后一眼:成本与「败则尽付东流」若只露在入口卡或停战弧,
    // 站在提交钮上的人看不见 —— 与 AGENTS「下手前摊数字/后果」不符
    expect(view, "启程钮要引入界成本").toContain("启 程(入界 {{ prepWorld?.entryCost }} 道源)");
    expect(view, "提交点下方要摊开出界才发放与败北尽付东流").toContain("入界即花");
    expect(view, "败北/毁约后果要点名尽付东流").toContain("尽付东流");
    expect(view, "失败那面该说战果与纪录不保").toContain("战果与纪录不保");
    expect(view, "入界成本要读世界定义,不另写死数字").toContain("prepWorld.entryCost");
    // 虚界卡与普通天界同款边界行:虚界同样按锚点层次定标、同样有境界压制 —— 不许只埋在 prep
    // (模板被格式化后「此界宜」与 {{ REALMS… }} 分在两行,故用容忍空白的正则)
    expect(view, "虚界卡该有「此界宜」边界行").toMatch(
      /此界宜\s*\{\{ REALMS\[anchorMajorOf\(endgame\.voidWorld\.anchorTier\)\]/,
    );
    expect(view, "虚界未至此境也要点「受境界压制」").toContain("受境界压制");
  });

  it("法宝位与门槛取自 artifacts.ts,界面与切换构筑共用一份", () => {
    // 法宝面板拆出后判据随本体走(components/inventory/ArtifactPanel.vue)
    const view = src("../components/inventory/ArtifactPanel.vue");
    expect(view).toContain("artifactSlotsFor(player.major)");
    expect(view).toContain("ARTIFACT_SLOT_UNLOCK_MAJOR");
    expect(view).not.toContain("元婴境开启第二法宝位");
    expect(view, "法宝位规则不该在界面里再写一遍").not.toMatch(/major >= 3 \? 2 : 1/);
    const svc = src("./loadoutService.ts");
    expect(svc, "切换构筑的截断也读同一份规则").toContain("artifactSlotsFor(player.major)");
    expect(svc).not.toMatch(/major >= 3 \? 2 : 1/);
  });

  it("画像门槛与构筑维度取自各自模块", () => {
    const legacy = src("../views/LegacyView.vue");
    expect(legacy).toContain("cnNumber(PROFILE_MIN_MARKS)");
    expect(legacy).not.toContain("道痕未满五则");
    const build = src("../views/BuildView.vue");
    expect(build).toContain("cnNumber(powerRating.labels.length)");
    expect(build).not.toContain("五维评级 ——");
  });
});

/**
 * 手写的门槛与容量 —— 数字的另一种写法:阿拉伯数字 + 单位。
 *
 * 「主脉可投 70 点」「可行流派 3/6」这类句子里的数字同样是抄的,只是长得不像
 * 「二十一境」那样明显。它们抄的是**另一张表**(容量常数、构筑流派数),
 * 而这张表正是最常被调的东西 —— 调完数值,句子还在说旧数。
 */
describe("文案数值对账 · 手写的门槛与容量", () => {
  const src = (from: string): string =>
    readFileSync(resolve(__dirname, from), "utf8")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");

  it("灵脉卡的自陈数字取自 constants(接线换的是算法,不是玩家看到的数)", () => {
    expect(VEIN_MAIN_CAPACITY).toBe(70);
    expect(VEIN_SIDE_CAP).toBe(30);
    expect(VEIN_TOTAL_CAPACITY).toBe(100);
    const card = src("../components/dongfu/VeinInvestCard.vue");
    for (const ref of ["VEIN_MAIN_CAPACITY", "VEIN_SIDE_CAP", "VEIN_TOTAL_CAPACITY"]) {
      expect(card, `灵脉卡的自陈应读 ${ref}`).toContain(ref);
    }
    for (const hand of ["70 点", "30 点", "总容量 100"]) {
      expect(card, `手抄的「${hand}」应改成读常数`).not.toContain(hand);
    }
  });

  it("「不能全部点满」是算术事实:全部脉的上限之和确实超过总容量", () => {
    // 文案这么说,是因为投满所有脉需要的点数 > 总容量;若哪天不成立了,取舍就没了
    const allIn = VEIN_MAIN_CAPACITY + VEIN_SIDE_CAP * (VEINS.length - 1);
    expect(
      allIn,
      `共 ${VEINS.length} 条脉,投满需 ${allIn} 点,总容量 ${VEIN_TOTAL_CAPACITY}`,
    ).toBeGreaterThan(VEIN_TOTAL_CAPACITY);
  });

  it("「可行流派 x/N」的分母取自 BUILD_PROFILES(界面与生态健康度同源)", () => {
    expect(BUILD_PROFILES.length).toBe(6);
    // 天界拆分后分母在两处出现:今日天道/挑战书在 TrialPanel,prep 天道推演在
    // ExpeditionPanel —— 分文件各断一份,防同型两处命中假绿
    const trial = src("../components/celestial/TrialPanel.vue");
    expect(trial, "分母应读构筑流派数").toContain("BUILD_PROFILES.length");
    expect(trial, "界面里的分母不该手写").not.toMatch(/\}\}\s*\/6\b/);
    const exped = src("../components/celestial/ExpeditionPanel.vue");
    expect(exped, "分母应读构筑流派数(prep 推演)").toContain("BUILD_PROFILES.length");
    expect(exped, "界面里的分母不该手写").not.toMatch(/\}\}\s*\/6\b/);
    const health = src("./ecosystemHealth.ts");
    expect(health, "健康度的多样性分母也读构筑流派数").toContain("BUILD_PROFILES.length");
    expect(health).not.toMatch(/\/ ?6\b/);
  });

  it("「渡劫→真仙的大跃倍数」由寿元曲线推出(此前文案写 ×100,数据是 ×102)", () => {
    expect(ascensionLeap()).toBe(102);
    const dialog = src("../components/common/ProgressionDialog.vue");
    expect(dialog, "大跃倍数应读 ascensionLeap()").toContain("ascensionLeap()");
    expect(dialog, "手写的 约 ×100 与寿元表差了一档").not.toContain("约 ×100");
  });
});

/**
 * 术语一致性 —— 同一个东西只能有一个名字
 *
 * 起因:同一个"历练中偶遇的随机事件"在项目里有四个近义叫法——奇遇(词条名/成就文案)、
 * 际遇(成就名)、机缘(ft_ 取弃事件)、奇缘(我后来接的连锁)。它们各自是**不同机制**,
 * 但四个近义词并排出现时,玩家会把它们当成一件事(「奇遇概率」涨的是哪一类?)。
 *
 * 约定(写进判据,不再靠记性):
 *   际遇 = 历练中偶遇的随机事件(eventLuck 词条、经历计数)
 *   机缘 = 稀有的取/弃事件(ft_,界域志的机缘取弃)
 *   奇缘 = 阶段性连锁(奇缘录)
 * 另:vein 系统一律叫"灵脉"(不再混用"地脉")。
 */
describe("术语一致性 · 用户可见文本", () => {
  /** 数据里的字符串字面量 + 视图模板(即玩家真正读得到的那部分) */
  const userText = (): { file: string; text: string }[] => {
    const out: { file: string; text: string }[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(resolve(__dirname, dir))) {
        const rel = `${dir}/${entry}`;
        if (entry.endsWith(".spec.ts")) continue;
        const stat = statSync(resolve(__dirname, rel));
        if (stat.isDirectory()) {
          walk(rel);
          continue;
        }
        const src = readFileSync(resolve(__dirname, rel), "utf8");
        if (entry.endsWith(".vue")) {
          // 只取模板(去掉注释)
          out.push({ file: rel, text: src.split("</script>")[0]!.replace(/<!--[\s\S]*?-->/g, "") });
        } else if (entry.endsWith(".ts")) {
          const body = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
          out.push({
            file: rel,
            text: [...body.matchAll(/["']([^"'\\\n]{2,})["']/g)].map((m) => m[1]!).join("\n"),
          });
        }
      }
    };
    walk("../data");
    walk("../views");
    walk("../components");
    walk("../ui"); // 词条名表就在这儿(属性面板上的标签)
    walk("../core"); // toast 与区域事件文案也算玩家可见
    return out;
  };

  /** 允许保留的例外:这里的地脉说的是村子的风水脉,不是洞府灵脉系统 */
  const ALLOWED = ["须惊动山下一整座村子的地脉"];

  it("随机事件一律叫「际遇」:用户可见文本里不再出现「奇遇」", () => {
    const hits: string[] = [];
    for (const { file, text } of userText()) {
      for (const m of text.matchAll(/.{0,16}奇遇.{0,16}/g)) {
        if (ALLOWED.some((a) => m[0].includes(a))) continue;
        hits.push(`${file} 「${m[0]}」`);
      }
    }
    expect(
      hits,
      `「奇遇」应统一为「际遇」(奇缘=连锁、机缘=取弃事件,各留一名):\n${hits.join("\n")}`,
    ).toEqual([]);
  });

  it("洞府灵脉一律叫「灵脉」:用户可见文本里不再出现用作系统名的「地脉」", () => {
    const hits: string[] = [];
    for (const { file, text } of userText()) {
      for (const m of text.matchAll(/.{0,16}地脉.{0,16}/g)) {
        if (ALLOWED.some((a) => m[0].includes(a))) continue;
        hits.push(`${file} 「${m[0]}」`);
      }
    }
    expect(hits, `「地脉」应统一为「灵脉」:\n${hits.join("\n")}`).toEqual([]);
  });

  it("历练一律叫「历练」:用户可见文本里不再用「探索」指代这件活动", () => {
    const hits: string[] = [];
    for (const { file, text } of userText()) {
      for (const m of text.matchAll(/.{0,16}探索.{0,16}/g)) hits.push(`${file} 「${m[0]}」`);
    }
    expect(hits, `「探索」应统一为「历练」:\n${hits.join("\n")}`).toEqual([]);
  });

  it("三个词各指一件事:机缘/际遇/奇缘在用户可见文本里都真的在用", () => {
    const all = userText()
      .map((u) => u.text)
      .join("\n");
    for (const term of ["机缘", "际遇", "奇缘"]) {
      expect(all, `${term} 一个例子都没有 —— 术语约定与内容脱节了`).toContain(term);
    }
  });

  /**
   * 名与机制同形:先手判定(speed)那条**阈值**不许再叫「出手速度」。
   *
   * 「出手速度提升 6%」读起来是连续收益,真相是「1 + 修正 ≥ 对手速度」的开关:
   * 差一点就完全没有。术语不对,玩家对词条的理解就必然是错的 ——
   * 这条红线盯的是名字,战后分析(两数 + 差额)盯的是解释。
   */
  it("「出手速度」这个名字退休:它实际是阈值判定,一律叫「先手判定」", () => {
    const hits: string[] = [];
    for (const { file, text } of userText()) {
      for (const m of text.matchAll(/.{0,16}出手速度.{0,16}/g)) hits.push(`${file} 「${m[0]}」`);
    }
    expect(
      hits,
      `「出手速度」已改名「先手判定」(它是阈值不是连续收益):\n${hits.join("\n")}`,
    ).toEqual([]);
  });

  it("先手判定与首回合伤害各留一名,不许互相借名", () => {
    const all = userText()
      .map((u) => u.text)
      .join("\n");
    expect(all, "先手判定(speed)应当出现在用户可见文本里").toContain("先手判定");
    expect(all, "首回合伤害(firstStrike)应当出现在用户可见文本里").toContain("首回合伤害");
    expect(all, "「先手伤害」这个旧名会让两件事混为一谈").not.toContain("先手伤害");
  });
});

/**
 * 界面读同源函数,而不是各写一份。
 *
 * 这一条与上面「视图不手抄数字」同源,只是对象换成了**功能**:法宝的神通说明
 * 会随祭炼等级变(×1.72),装备详情要报共鸣件数,图鉴要讲功用 —— 这些都有
 * 现成的同源函数(artifactActiveText / setCounts / codex 的几个 FuncText)。
 * 界面若绕开它们自己拼,今夜是对的,改数值那一夜就开始撒谎。
 *
 * 故障注入:把 InventoryView 的神通行换回 `row.def.active.desc`,本文件立刻红。
 */
describe("文案数值对账 · 用具三类的界面读同源函数", () => {
  const src = (from: string): string =>
    readFileSync(resolve(__dirname, from), "utf8")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");

  it("法宝卡片的神通说明随祭炼走,等级也不叫「阶」", () => {
    // 法宝面板拆出后判据随本体走(components/inventory/ArtifactPanel.vue)
    const view = src("../components/inventory/ArtifactPanel.vue");
    expect(view, "神通说明应读 artifactActiveText(与战斗同一份数值)").toContain(
      "artifactActiveText(",
    );
    expect(view, "不许直接印 0 级文案").not.toMatch(/\.active\.desc/);
    expect(view, "等级说法应读 artifactLevelLabel(「重」,不是「阶」)").toContain(
      "artifactLevelLabel(",
    );
    // 祭炼给多少、至多重:取自 artifacts 的常数,不在界面里另写一份
    expect(view, "祭炼每重的增幅应读 ARTIFACT_LEVEL_BONUS").toContain("ARTIFACT_LEVEL_BONUS");
    expect(view, "祭炼上限应读 ARTIFACT_MAX_LEVEL").toContain("ARTIFACT_MAX_LEVEL");
  });

  it("装备详情写着共鸣与界域", () => {
    const view = src("../components/equipment/EquipmentDetailDialog.vue");
    expect(view, "共鸣状态应读 setCounts").toContain("setCounts(");
    expect(view, "界域应读 worldNameOfTier").toContain("worldNameOfTier(");
  });

  it("词条转移的「✓ 选中」是强调标记 —— 不许叠 opacity 把它压弱", () => {
    const view = src("../components/equipment/AffixTransferPanel.vue");
    // 选中确认字本应全色强调(text-accent);叠 opacity-70 语义倒置(选中反被弱化)。
    // <span v-else class="ml-auto"> 负责 ml 对齐,「✓ 选中」由 text-accent 全色承载
    expect(view, "✓ 选中该走 text-accent 全色,不叠 opacity").toMatch(
      /text-accent[\s\S]{0,20}✓ 选中/,
    );
    expect(view, "外层容器不再叠 opacity 压字").not.toContain('v-else class="ml-auto opacity-70"');
  });

  it("图鉴的用具三类取自 itemText 的功用函数", () => {
    // 装备/法宝/丹药三类已收进 codex 的派生视图,功用行在那里拼;
    // 功法阁仍是两态列表,由视图直接拼 —— 两边都得取同一份文案函数
    const codexSrc = src("../ui/codex.ts");
    for (const fn of [
      "equipFuncText",
      "equipMetaText",
      "artifactFuncText",
      "artifactMetaText",
      "pillFuncText",
      "pillMetaText",
    ]) {
      expect(codexSrc, `图鉴该用 ${fn} 讲功用与出处`).toContain(fn);
    }
    const view = src("../views/CollectionView.vue");
    for (const fn of ["gongfaFuncText", "gongfaMetaText"]) {
      expect(view, `功法阁该用 ${fn}`).toContain(fn);
    }
  });

  it("功法的神通把几率与威力一起写出来(读 gongfaSkillLine,与图鉴同一份)", () => {
    const dlg = src("../components/cultivation/GongfaDialog.vue");
    expect(dlg, "神通文案应读 gongfaSkillLine,不散落界面各处").toContain("gongfaSkillLine(");
    expect(dlg, "未习得也要给得出圆满账").toContain("previewRows");
    // 几率与威力收在 itemText 那一句里,「出手几回、威力多少」一次说清
    const itemText = src("../ui/itemText.ts");
    expect(itemText, "那一句该同时写几率,光说威力看不出多久出一次").toContain("skill.rate");
    expect(itemText, "那一句该同时写威力").toContain("skill.mult");
  });

  it("离线归来卷轴不写「闭关」——玩家是离开再回来,不是封洞修炼", () => {
    const dlg = src("../components/offline/OfflineRewardDialog.vue");
    expect(
      dlg,
      "离线归来走 settleOffline,写「闭关」会让人以为封洞了(或觉得闭关按钮没生效)",
    ).not.toContain("闭关");
    expect(dlg, "离开归来应写「此去」(与退出确认同款用词)").toContain("此去");
  });

  it("导入的备份太新时「用这份替换」不可行要置灰 —— 与付不起置灰同一纪律", () => {
    const view = src("../views/SettingsView.vue");
    // 备份版本高于当前就必然导入失败(storage 会拒);确认前已明示「无法导入」,
    // 确认钮却仍可点就没意义 —— 应与付不起一样置灰改口
    expect(view, "导入确认钮在版本过高时置灰").toContain(
      ':disabled="importInspect?.tooNew === true"',
    );
    expect(view, "不可行的确应改口").toContain('"无法导入(版本过高)"');
    expect(view, "版本过高与否取自 inspect(不另写死)").toContain("importInspect.tooNew");
  });

  it("登临导览里「天道熔炉」是可聚焦按钮,不是无 href 的 <a> —— 否则键盘用户点不到", () => {
    // 导览弹窗拆出后判据随本体走(components/celestial/TutorialDialog.vue)
    const view = src("../components/celestial/TutorialDialog.vue");
    // 原实现是无 href 的 <a @click>,不在 Tab 序列里,键盘用户根本走不到;
    // 且文字承诺「去熔炉」动作却只关导览 —— 改为真按钮(type=button)才可达
    expect(view, "天道熔炉该是真按钮(可聚焦)").toMatch(
      /<button\s+type="button"[\s\S]{0,200}天道熔炉\s*<\/button>/,
    );
    expect(view, "不该再有无 href 却挂 @click 的 <a>(键盘到不了的可交互元素)").not.toMatch(
      /<a[^>]*@click=[^>]*>[\s\S]{0,40}天道熔炉/,
    );
  });

  it("建号页未定格前有回到欢迎页的入口 —— 否则 web 端建号无退路可比", () => {
    const create = src("../views/CreateView.vue");
    // 路由守卫允许 create→welcome(未开始前);建号全程可逆(草稿持久化+无限重掷),
    // 但没有「上一步」控件时 web 端就只能卡在这一页(手机可借系统返回,桌面无处退)
    expect(create, "建号页该有回欢迎页的 RouterLink").toMatch(
      /<RouterLink[\s\S]{0,120}to="\/welcome"[\s\S]{0,240}欢迎/,
    );
  });

  it("首次凝道果教学弹窗的判定要采样在凝果之前 —— 否则 flag 次序让弹窗永不弹出", () => {
    // doCondense 随熔炉/道果弹窗搬进了 components/celestial/FurnaceDialog.vue
    const view = src("../components/celestial/FurnaceDialog.vue");
    // condenseDaoFruit 在首次成功时自己就置 daoFruitTutorialSeen(true),
    // 若 doCondense 在凝果后才查 shouldShowFruitTutorial(),判定恒为假 → 弹窗死代码.
    // 必须在凝果前先采样首次与否(firstFruit 先于 condenseDaoFruit).
    // 直接断言源码顺序,不抽函数体(函数体长短变化不更敏感).
    expect(
      view,
      "doCondense 该在凝果前先采样 shouldShowFruitTutorial(firstFruit 在其前)",
    ).toContain("const firstFruit = shouldShowFruitTutorial();");
  });

  it("离线挂机折扣是恒有的 —— 非超限的短离也要把「9 折」摊明,不能只在封顶时提", () => {
    const core = src("./offline.ts");
    // 0.9 的效率**每天离线都生效**(planIdle 的 effectiveMs = cappedMs × efficiency),
    // 只封顶时才提一句,短离玩家拿到 9 折产出却以为"少了点什么",机制就被藏起来了
    expect(core, "离线结算该引 OFFLINE_EFFICIENCY(同一常数)").toContain("OFFLINE_EFFICIENCY");
    // 非封顶分支(else)也要有折扣说明,不许只剩封顶那句
    expect(core, "折扣说明不应只挂在封顶分支").toMatch(/else\s*\{[\s\S]{0,160}折挂机折算/);
  });

  it("丹药详情与丹方清单说得出「服下去会怎样」", () => {
    // 开炉弹窗拆出后两处分居两文件:丹药详情弹窗在 InventoryView,方子清单在
    // BrewingDialog —— 各自都要有 pillFuncText(同一份纯函数,出处 ui/itemText)
    const view = src("../views/InventoryView.vue");
    const brew = src("../components/inventory/BrewingDialog.vue");
    expect(view, "丹药详情该写清效果(pillFuncText)").toContain("pillFuncText(");
    expect(brew, "方子清单该写清效果(pillFuncText)").toContain("pillFuncText(");
    expect(view, "丹方读到几分熟取自 lore.recipeMastery").toContain("recipeMastery(");
  });

  it("弟子的羁绊要摊「距下一档称谓还差几趟」,真传的跨世之缘达成前就该露", () => {
    const view = src("../views/ApprenticeView.vue");
    // 称谓梯只显「道童→…→真传」的方向,不显「离下一档还差几趟」—— 进度该露
    expect(view, "称谓应有距下一档的趟数进度").toContain("bondNext(");
    expect(view, "进度数要与称谓阈值同源").toContain("BOND_TITLES");
    // 真传那条跨世之缘(有实际转世收益)以前只在达成后才 v-if 出来 —— 冲它的人达成前
    // 根本不知道这机制存在;未到真传也要把门槛与收益点明
    expect(view, "未到真传也要露跨世之缘机制").toContain("抵达「真传」");
    expect(view, "门槛引常量,不手写 100").toContain("BOND_TRUECODE_MIN");
    // 派活产出是确定值(寻宝哈希、无随机),预览不该标「~」假装有波动 —— 与归来通报逐位相等
    expect(view, "派活预览不标「~」,给确切的数").not.toContain("灵草 ~");
    expect(view, "预览该与 apprenticeSpoils 同源(不另写死数)").toContain("apprenticeSpoils(");
  });

  it("智能收纳的清理确认要把收益摊开 —— 不只件数,还有会拿回的器灵尘/灵石", () => {
    // 分解+收纳两扇拆出后判据随本体走(components/inventory/DismantleDialog.vue)
    const view = src("../components/inventory/DismantleDialog.vue");
    // 与一键分解同族:分解 preview 在按下去前就把总账说了,化尘这步不可逆,更不该只报件数
    expect(view, "清理确认该用待清理预期收益的读数").toContain("cleanPlanned");
    expect(view, "清理确认要随收益(器灵尘/灵石)").toContain("batchYieldText(cleanPlanned)");
    expect(view, "化尘是整包报废,不能退回只显件数的旧样板").not.toContain(
      "共 {{ cleanCount }} 件——此举不可逆",
    );
  });

  it("装备的重铸/自动重铸都要两步确认 —— 误触不得直接洗掉这一身 roll", () => {
    // 拆分后:重铸与自动重铸整域在重铸子面板 —— 判据随本体走
    const view = src("../components/equipment/EquipReforgePanel.vue");
    // 重铸/自动重铸是「花器灵尘+灵石、把未封存词条尽数重掷」的高代价重掷,自动更
    // 能一次连洗 500 次 —— 与分解同族破坏性动作,必须「先武装、再确认」才真跑.
    expect(view, "重铸应有武装态,不一点即执行").toContain("armReforge");
    expect(view, "重铸确认后要卸武装态").toContain("disarmReforgeActions()");
    expect(view, "自动重铸同样要有两步确认").toContain("armAuto");
    expect(view, "界面该给「确认重铸」这一步").toContain("确认重铸");
    // 预算越界输入(手打 0/600)显示会与实跑脱节:提交时须夹到 [1,500],不许「至多洗
    // 0/600 次」而实跑 1/500 次 —— 预览与实发同口径.
    expect(view, "预算提交时按实跑口径夹取(clampAutoBudget)").toContain("clampAutoBudget");
    // 按钮等级:武装态「开 洗」是次钮(btn-ghost),「确认开洗」才是主钮(btn-seal),
    // 与重铸词条 ghost→确认重铸 seal 的升档同款 —— 未确认的一敲不该看着像已完成.
    expect(view, "「开洗」武装态该是次钮,确认开洗才是主钮").toContain(
      'class="btn-ghost ml-auto !px-3 !py-1 !text-[11px]"',
    );
  });

  it("炼丹方子双缺要并列报(草缺·灵石尚差),失败线要说明灵石不退", () => {
    // 拆分后:shortParts 的拼串在 composables/useBrewing.ts(方子行构造器),
    // 「灵石不退」的成本行展示在 BrewingDialog 模板 —— 各读各的。
    const brew = src("../composables/useBrewing.ts");
    const dialog = src("../components/inventory/BrewingDialog.vue");
    // 双缺只报第一个成立的,会让「买齐草才发现石也不够」的决策藏在付款后 —— 与同仓
    // GongfaDialog 双缺并列一脉。shortText 由 shortParts 拼,既有草缺也有石缺两句
    expect(brew, "草缺与石缺要各成一句、用空串拼在 shortParts 里").toContain("shortParts.push");
    expect(brew, "双缺用 · 粘连,不许三目只取第一项").toContain('shortParts.join(" · ")');
    // 失败那面的账只写「返草」会把灵石一炉全赔藏掉:成本行必须点名灵石不退
    expect(dialog, "失败线要亮「灵石不退」(石满赔是 engineCraft.spentOnFail 的常量行为)").toContain(
      "灵石不退",
    );
    expect(dialog, "灵石不退只在有石耗时才有意义(零石耗不摆空话)").toContain(
      "toNum(r.cost.stone) > 0",
    );
  });

  it("灵兽的性子带数,出处与结算同源", () => {
    const view = src("../views/TitlesView.vue");
    expect(view, "性子该读 petTraitText(与 core/petPersonality 同源)").toContain("petTraitText(");
    expect(view, "出战加成仍走同一份 modsText").toContain("modsText(");
  });

  it("图鉴的用具三类走带深度的派生视图,而不是就地拼两态", () => {
    const view = src("../views/CollectionView.vue");
    for (const fn of ["equipCodex()", "artifactCodex()", "pillCodex()"]) {
      expect(view, `图鉴该用 ${fn}(含收录深度)`).toContain(fn);
    }
    expect(view, "收录时刻的口径收在 codex,界面不再自己写一份").toContain("collectedTimeText(");
    expect(view, "界面里不该再出现日期格式化的第二份").not.toContain("toLocaleString(");
  });

  it("图鉴角标是文字,压暗走 token,不叠元素级 opacity", () => {
    const view = src("../views/CollectionView.vue");
    // 角标(「×N」「第X档」)是文字:叠 opacity-70 违反「文字不叠元素级 opacity」铁律,
    // 弱化该用 text-ink-faint token(与其余弱化位同款)
    expect(view, "角标弱化应走 token,不叠 opacity").not.toContain("opacity-70");
    expect(view, "角标应读 entry.badge(与条目状态同源)").toContain("entry.badge");
  });
});

/**
 * 顿悟 / 洞府巡游 —— 数值挂在 buff 与 reward 上,文案只许写风味
 *
 * 这两处是本文件长期的自陈盲区(见文件头)。手抄的代价已经发生过:选项写着
 * 「修炼速度 +20%」,真值在 buffs.ts 的 `{ cultivationSpeed: 0.2 }` 里 ——
 * 两本账各自都"对",改常数那一夜界面就开始撒谎,而没有任何一处会红。
 *
 * 现在改成现算:desc / effect 只剩风味,数字一律由 ui/earlyGameText 从
 * buffDef(buffId).mods、reward、penalty 派生。判据三条:
 *   一 文案里不许再出现数字与百分号(手抄只能从这一处回潮);
 *   二 派生行里的每个百分比都能在该选项**自己**的数据里找到(按 buffId、
 *      penalty.type → cave_penalty_* 配对,不做全表硬对,故不误报);
 *   三 锚定当下玩家看到的读数 —— 改 buffs.ts 的 0.2 为 0.25,本节立刻红。
 *
 * 「数字」不能只按 `\d` 认:中文有一整族数字写法,**成数**(一成…九成、半成)、
 * **倍数**(一倍/两倍/三倍)、**时间量词**(一盏茶/一炷香/一刻/半个时辰)、
 * **约量**(数倍/几成/少许)。把「修炼速度 +20%」改写成「修炼速度加两成」,
 * ASCII 数字和百分号一起消失,`/\d/` 判据就全绿 —— 而它承载的是**同一份手抄数字**。
 * 故这些词在风味文案里出现即视为"这句话在描述数值",一律禁。
 * 风味句不需要量;需要量的地方,现算行里有现代读数(见 ui/earlyGameText)。
 * (词表是字面词,不写正则:「一刻」误伤「这一刻」这类情形,改词表比改正则清楚。)
 */
const CN_NUMERALS = [
  // 成数
  "一成",
  "两成",
  "三成",
  "四成",
  "五成",
  "六成",
  "七成",
  "八成",
  "九成",
  "半成",
  // 倍数
  "一倍",
  "两倍",
  "三倍",
  // 时间量词:道门时制里的时长,同样是数值(现算行给现代分钟数)
  "一盏茶",
  "一炷香",
  "一刻",
  "半个时辰",
  // 约量:量说不清但仍在说量(「快上数倍」)
  "数倍",
  "几成",
  "少许",
];

/** 一段风味文案里出现了哪些"手抄数字"的写法 */
function numeralsIn(text: string): string[] {
  return CN_NUMERALS.filter((w) => text.includes(w));
}

describe("文案数值对账 · 顿悟/巡游的数值由 buff 与 reward 现算", () => {
  type CaveOption = CaveEvent["options"][number];
  const locations = Object.keys(CAVE_EVENT_POOL) as Array<keyof typeof CAVE_EVENT_POOL>;
  const caveOptions = (): CaveOption[] => {
    const out: CaveOption[] = [];
    for (const loc of locations) {
      for (const ev of CAVE_EVENT_POOL[loc]) {
        for (const o of ev.options) out.push(o);
      }
    }
    return out;
  };

  it("顿悟/突破准备的说明只剩风味:手抄的数字与百分号都不许回潮", () => {
    for (const opt of ENLIGHTENMENT_OPTIONS) {
      expect(opt.desc, `顿悟「${opt.label}」的说明又写了数字:${opt.desc}`).not.toMatch(/\d/);
      expect(opt.desc, `顿悟「${opt.label}」的说明又写了百分号:${opt.desc}`).not.toContain("%");
      // 中文数字同样是手抄:「加两成」与「+20%」是一回事,只认 `\d` 会被这一个写法绕过
      const hits = numeralsIn(opt.desc);
      expect(
        hits,
        `顿悟「${opt.label}」的说明用了中文数字「${hits.join("、")}」` +
          ` —— 数字该由 buff / reward 现算,文案只写风味:${opt.desc}`,
      ).toEqual([]);
    }
    expect(ENLIGHTENMENT_OPTIONS.length, "选项池空了,判据形同虚设").toBeGreaterThanOrEqual(5);
    // 突破准备是同一族的第三张表,而它连渲染点都没有(见 src/data/earlyGame.ts 的注释):
    // 它的 desc 曾手抄「耗时3分钟,进阶成功率 +8%」。既然没人显示它,就不该留一句待维护的
    // 说明 —— 故这里要的不是"只剩风味",而是**这个字段不存在**(死字段也是会撒谎的字段)。
    for (const opt of BREAKTHROUGH_PREP_OPTIONS) {
      expect(
        Object.keys(opt),
        `突破准备「${opt.label}」又长回了 desc —— 数值只有 bonusRate / duration / cost 三处真相源,` +
          "说明文字若真要用,请在视图里从这三样现算",
      ).not.toContain("desc");
    }
    expect(BREAKTHROUGH_PREP_OPTIONS.length, "选项池空了,判据形同虚设").toBeGreaterThanOrEqual(3);
  });

  it("顿悟的数值行读 buff 本体:每个百分比都能在它自己的 mods 里找到", () => {
    let checked = 0;
    for (const opt of ENLIGHTENMENT_OPTIONS) {
      if (opt.buffId) {
        const def = buffDef(opt.buffId);
        expect(def, `顿悟「${opt.label}」的 buff ${opt.buffId} 未注册`).toBeDefined();
        const text = enlightenmentEffectText(opt);
        const mods = Object.values(def?.mods ?? {}) as number[];
        const pcs = percentsOf(text);
        expect(pcs.length, `顿悟「${opt.label}」的数值行一个百分比都没有:${text}`).toBeGreaterThan(
          0,
        );
        for (const pc of pcs) {
          checked += 1;
          expect(
            percentBacked(pc, mods),
            `顿悟「${opt.label}」写 ${pc}%,buff 的 mods 里对不上:${text} · [${mods.join(", ")}]`,
          ).toBe(true);
        }
        // 时长同样要和 buff 本体一致:改了 durationSec 却没人改文案,这里就红
        expect(
          text,
          `顿悟「${opt.label}」的时长与 buff 的 ${def?.durationSec}s 不符:${text}`,
        ).toContain(modernDuration(def?.durationSec ?? 0));
      } else if (opt.reward) {
        expect(enlightenmentEffectText(opt), `顿悟「${opt.label}」没报出即时奖励`).toContain(
          String(opt.reward.value),
        );
      }
    }
    expect(checked, "扫到的百分比太少,判据覆盖不足").toBeGreaterThanOrEqual(6);
  });

  it("巡游选项的效果只剩风味 —— 数字一律从 reward / penalty 现算", () => {
    for (const opt of caveOptions()) {
      expect(opt.effect, `巡游「${opt.label}」的效果又写了数字:${opt.effect}`).not.toMatch(/\d/);
      expect(opt.effect, `巡游「${opt.label}」的效果又写了百分号:${opt.effect}`).not.toContain("%");
      // 与顿悟同规:中文数字/量词也是手抄数字的写法(「抵上一炷香的药力」就该红)
      const hits = numeralsIn(opt.effect);
      expect(
        hits,
        `巡游「${opt.label}」的效果用了中文数字「${hits.join("、")}」` +
          ` —— 数字该由 reward / penalty 现算:${opt.effect}`,
      ).toEqual([]);
    }
  });

  it("巡游的数值行:奖励读 reward 与 buff 本体,惩罚读 cave_penalty_* 的 mods", () => {
    let checked = 0;
    for (const opt of caveOptions()) {
      const text = caveOptionEffectText(opt);
      const nums: number[] = [];
      if (opt.reward) {
        if (opt.reward.type === "buff") {
          const def = buffDef(opt.reward.value as string);
          expect(def, `巡游「${opt.label}」的 buff ${opt.reward.value} 未注册`).toBeDefined();
          nums.push(...(Object.values(def?.mods ?? {}) as number[]));
          expect(
            text,
            `巡游「${opt.label}」的时长与 buff 的 ${def?.durationSec}s 不符:${text}`,
          ).toContain(modernDuration(def?.durationSec ?? 0));
        } else {
          const v = opt.reward.value as number;
          nums.push(v);
          if (v > 0) expect(text, `巡游「${opt.label}」没报出奖励数`).toContain(`+${v}`);
          else expect(text, `巡游「${opt.label}」零奖励该说「无事发生」`).toBe("无事发生");
        }
      } else {
        expect(text, `巡游「${opt.label}」既无奖励也无惩罚,却报了数`).toBe("无事发生");
      }
      if (opt.penalty) {
        const def = buffDef(`cave_penalty_${opt.penalty.type}`);
        expect(def, `巡游「${opt.label}」的惩罚 ${opt.penalty.type} 未注册`).toBeDefined();
        const mods = Object.values(def?.mods ?? {}) as number[];
        nums.push(...mods);
        expect(
          text,
          `巡游「${opt.label}」的惩罚时长与 ${def?.id} 的 ${def?.durationSec}s 不符:${text}`,
        ).toContain(modernDuration(def?.durationSec ?? 0));
        // 惩罚必须真的报出来:扣了什么、扣多少,不许只活在数据里
        for (const v of mods.filter((x) => x !== 0)) {
          expect(text, `巡游「${opt.label}」的惩罚项没报数:${text}`).toContain(
            formatSignedPercent(v),
          );
        }
      }
      for (const pc of percentsOf(text)) {
        checked += 1;
        expect(
          percentBacked(pc, nums),
          `巡游「${opt.label}」写 ${pc}%,该选项的数据里对不上:${text} · [${nums.join(", ")}]`,
        ).toBe(true);
      }
    }
    expect(checked, "扫到的百分比太少,判据覆盖不足").toBeGreaterThanOrEqual(4);
  });

  it("锚定当下读数:改 buffs.ts 的 0.2 为 0.25,本节的字面量立刻红", () => {
    const cult = ENLIGHTENMENT_OPTIONS.find((o) => o.buffId === "enlighten_cult");
    expect(cult, "「静心凝神」不见了").toBeDefined();
    expect(enlightenmentEffectText(cult!)).toBe("修炼速度 +20% · 一盏茶(10 分钟)");
    // 巡游那条 buff 奖励与顿悟共用「20%」这个真值 —— 两条必须一起动
    expect(caveOptionEffectText(CAVE_EVENT_POOL.furnace[0]!.options[1]!)).toBe(
      "修炼速度 +20% · 一盏茶(10 分钟)",
    );
    // 奖励 + 惩罚并列:奖多少、罚多久,一行读得完
    expect(caveOptionEffectText(CAVE_EVENT_POOL.field[0]!.options[1]!)).toBe(
      "修为 +120 · 修炼速度 -15% · 5 分钟",
    );
    // 时长口径自身:落不在道门时制表上的 5 分钟不许说成「将近一刻」
    expect(durationText(300)).toBe("5 分钟");
    expect(durationText(600)).toBe("一盏茶(10 分钟)");
    expect(durationText(1800)).toBe("一炷香(30 分钟)");
  });
});

/**
 * 增益与丹药的说明 —— 同一份数值不写两遍
 *
 * 这两张表的说明此前是「数值的第二个副本」:
 *   · 增益卡把 desc 与效果行并排播:desc 写「攻击提升 20%,防御提升 10%」,
 *     效果行由 mods 现算出「攻击 +20% / 防御 +10%」—— 同一件事两行字。
 *   · 丹药卡同样:desc 写「一炷香内修炼提速五成(30 分钟)」,
 *     效果行由 pillFuncText 写「修炼速度 +50%(持续 30 分钟)」。
 *
 * 更糟的是名字也分叉:desc 叫「战斗伤害」「造成伤害」「受伤降低」,效果行叫
 * 「伤害增幅」「伤害减免」—— 同一条词条在同一张卡上读起来像两样东西。
 * 根子在 STAT_NAMES 之外又手写了一套叫法(见 src/ui/statNames.ts 的取舍注释)。
 *
 * 所以判据是:说明里不许出现**任何**承载数值的写法,也不许出现旧词条别名。
 * 数值与名字各有唯一出口 —— mods 的键、STAT_NAMES 的值、pillFuncText 的现算。
 */
const STAT_ALIASES = [
  "战斗伤害",
  "造成伤害",
  "灵气回复",
  "受到伤害降低",
  "受伤降低",
  "生命上限",
  "战斗所得修为",
  "突破成功率",
  "出手速度",
  "炼器消耗",
];

/**
 * 连**正确**的词条名也不该出现在说明里。
 *
 * 只禁旧别名不够:desc 写「伤害增幅 +20%」与写「造成伤害提升 20%」是同一份手抄,
 * 只是抄的那一版刚好与 STAT_NAMES 同名。名字的唯一出口是效果行(modsText 读 STAT_NAMES)。
 * 单字/双字名(攻击、防御、气运、破甲…)放行 —— 它们在风味句里是寻常词,
 * 而且「气运加身」这种句子说的不是词条,是那个东西本身。
 */
const STAT_COMPOUND = Object.values(STAT_NAMES).filter((s) => s.length >= 3);

describe("文案数值对账 · 说明只说风味", () => {
  /** 一段说明里承载数值的写法 —— 阿拉伯数字、百分号、中文数词、旧词条别名 */
  const offenders = (text: string): string[] => {
    const hits: string[] = [];
    if (/\d/.test(text)) hits.push("阿拉伯数字");
    if (text.includes("%")) hits.push("百分号");
    hits.push(...numeralsIn(text).map((w) => `中文数词「${w}」`));
    hits.push(...STAT_ALIASES.filter((w) => text.includes(w)).map((w) => `旧词条名「${w}」`));
    hits.push(...STAT_COMPOUND.filter((w) => text.includes(w)).map((w) => `词条名「${w}」`));
    return hits;
  };

  it("增益的说明只剩风味:数值与词条名都归效果行", () => {
    for (const b of BUFFS) {
      const hits = offenders(b.desc);
      expect(hits, `增益「${b.name}」的说明又写上了${hits.join("、")}:${b.desc}`).toEqual([]);
    }
    expect(BUFFS.length, "增益表空了,判据形同虚设").toBeGreaterThanOrEqual(38);
  });

  it("丹药的说明只剩风味:服下去会怎样由 pillFuncText 说", () => {
    for (const d of PILLS) {
      const hits = offenders(d.desc);
      expect(hits, `丹药「${d.name}」的说明又写上了${hits.join("、")}:${d.desc}`).toEqual([]);
    }
    expect(PILLS.length, "丹药表空了,判据形同虚设").toBeGreaterThanOrEqual(60);
  });

  it("判据本身认得这些写法 —— 否则「全绿」只是没扫到", () => {
    // 自证:五种写法各自必须被认出(这类判据最容易写成「永远绿」)
    expect(offenders("攻击提升 20%")).toEqual(["阿拉伯数字", "百分号"]);
    expect(offenders("修炼提速五成")).toEqual(["中文数词「五成」"]);
    expect(offenders("灵气回复提升")).toEqual(["旧词条名「灵气回复」"]);
    expect(offenders("练了一炷香")).toEqual(["中文数词「一炷香」"]);
    // 名字抄对了也不行:抄的就是同一份数,只是抄的是新版
    expect(offenders("伤害增幅")).toEqual(["词条名「伤害增幅」"]);
    // 干净的风味句不许误报:这些字里没有量,只是文气
    expect(offenders("气血亏损,周天迟滞,战力大减")).toEqual([]);
    expect(offenders("一呼一吸皆有所得")).toEqual([]);
  });
});

/**
 * 装备词条的说明 —— 名字也只有一处
 *
 * 113 条词条的说明曾经逐条手打,而它们描述的是同一个 `key`:
 * 「造成伤害提升 {v}%」写的是 `damageBonus`,面板上同一条叫「伤害增幅」;
 * 「受到伤害降低 {v}%」是 `damageReduction`,面板叫「伤害减免」;
 * 「生命上限提升 {v}%」是 `maxHpPct`,面板叫「气血上限」。
 * 同一条词条在装备卡与状态弹窗上换三个名字,玩家没法把它们对上号。
 *
 * 现在 desc 由 STAT_NAMES 派生(见 data/affixes.ts 文件头),于是判据守的是性质而非实现:
 * 说明必须以**自己那个键**的名字开头、数值位恰好一个、不许夹带旧名。
 * 判据不比对字符串模板 —— 那样等于把实现抄一遍,实现改了判据跟着改,什么也守不住。
 */
describe("文案数值对账 · 词条说明的名字只有 STAT_NAMES 一处", () => {
  it("每条词条的说明以自己的名字开头,数值位恰好一个,且不夹带旧名", () => {
    let checked = 0;
    for (const def of AFFIXES) {
      const want = STAT_NAMES[def.key];
      const head = (def.desc.split("{v}")[0] ?? "").trim();
      expect(
        head.startsWith(want),
        `词条「${def.name}(${def.id})」的说明没用自己的名字(应为「${want}」):${def.desc}`,
      ).toBe(true);
      expect(
        (def.desc.match(/\{v\}/g) ?? []).length,
        `词条「${def.name}」的数值位不是恰好一个(引擎按它切 before/value/after):${def.desc}`,
      ).toBe(1);
      const hits = STAT_ALIASES.filter((w) => def.desc.includes(w));
      expect(hits, `词条「${def.name}」的说明用了旧名「${hits.join("、")}」:${def.desc}`).toEqual(
        [],
      );
      checked += 1;
    }
    expect(checked, "一条词条都没扫到 —— 判据形同虚设").toBeGreaterThanOrEqual(113);
  });

  it("这条判据认得出坏样本 —— 旧写法必须被判红", () => {
    const nameOf = (desc: string): string => (desc.split("{v}")[0] ?? "").trim();
    // 旧写法:名字不在 STAT_NAMES 里
    expect(nameOf("造成伤害提升 {v}%").startsWith(STAT_NAMES.damageBonus)).toBe(false);
    expect(nameOf("生命上限提升 {v}%").startsWith(STAT_NAMES.maxHpPct)).toBe(false);
    // 新写法:通过
    expect(nameOf("伤害增幅 +{v}%").startsWith(STAT_NAMES.damageBonus)).toBe(true);
  });
});

/**
 * 成就与任务的说明 —— 那个数就是条件本身,不能各写一遍
 *
 * 「击败 50 个敌人」这句话**就是** `counter("kills", 50)`,不是对它的注解。
 * 所以它不像 buff 的说明那样可以删掉 —— 删了玩家就不知道要做什么。
 * 但它同样是两本账:把 value 改成 100 而忘了改句子,界面会写着「击败 50 个敌人」
 * 却在 100 时发赏(进度行还会打出「已 100/100」,自相矛盾)。
 *
 * 做法照 test-report 的先例(文档例数 ↔ 本次运行实录):**不删句子,锁死两边**。
 * 判据 = 说明里出现的第一个数(阿拉伯或中文)必须恰好等于条件的数。
 * 只认第一个:这些句子都只有一个量,多出来的数字反而说明句子在说别的事。
 * realm / custom / quality 三类不在此列 —— 它们的说明承载风味与境界名,
 * 数字不在 cond 里(而是 realm 表或 evaluator 的常量),硬对只会误报。
 */
describe("文案数值对账 · 成就与任务说明里的数就是条件数", () => {
  /** 中文数字(只认这两张表里真的出现过的写法:一~十、十二、百/千/万 的组合) */
  const CN_DIGIT: Record<string, number> = {
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
  };
  const UNIT: Record<string, number> = { 十: 10, 百: 100, 千: 1000, 万: 10000 };

  /** 取出说明里第一个数:先阿拉伯,再中文(按出现位置取最早的那个) */
  function firstNumber(text: string): number | null {
    const arabic = /\d+(?:\.\d+)?/.exec(text);
    const cn = /[一二两三四五六七八九十百千万]+/.exec(text);
    if (!arabic && !cn) return null;
    if (arabic && (!cn || arabic.index < cn.index)) return Number(arabic[0]);
    return parseCn(cn![0]);
  }

  function parseCn(word: string): number | null {
    let total = 0;
    let section = 0;
    let digit = 0;
    for (const ch of word) {
      if (CN_DIGIT[ch] !== undefined) {
        digit = CN_DIGIT[ch]!;
      } else if (ch === "十") {
        section += (digit === 0 ? 1 : digit) * 10;
        digit = 0;
      } else if (ch === "百" || ch === "千") {
        section += (digit === 0 ? 1 : digit) * UNIT[ch]!;
        digit = 0;
      } else if (ch === "万") {
        total += (section + digit) * 10000;
        section = 0;
        digit = 0;
      }
    }
    return total + section + digit;
  }

  it("判据自己会认数 —— 中文写法与阿拉伯写法都要认对", () => {
    expect(firstNumber("累计斩落十二尊王级妖邪")).toBe(12);
    expect(firstNumber("完成第一次转世")).toBe(1);
    expect(firstNumber("完成三次转世")).toBe(3);
    expect(firstNumber("击败 50 个敌人")).toBe(50);
    expect(firstNumber("今日炼成 2 枚丹药")).toBe(2);
    expect(firstNumber("寿元上限超过一万载")).toBe(10000);
    // 位置优先:阿拉伯数字在前就取它,不被后面的中文数字抢走
    expect(firstNumber("服用 20 枚丹药,约三成火候")).toBe(20);
  });

  it("成就:计数器说明里的数等于 cond.value", () => {
    let checked = 0;
    for (const a of ACHIEVEMENTS) {
      if (a.cond.type !== "counter") continue;
      checked += 1;
      expect(
        firstNumber(a.desc),
        `成就「${a.name}」的说明与条件对不上:说明「${a.desc}」,条件 ${a.cond.key}=${a.cond.value}`,
      ).toBe(a.cond.value);
    }
    expect(checked, "一条计数成就都没扫到 —— 判据形同虚设").toBeGreaterThanOrEqual(30);
  });

  it("主线任务:计数器说明里的数等于 cond.value", () => {
    let checked = 0;
    for (const q of MAIN_QUESTS) {
      if (q.cond.type !== "counter") continue;
      checked += 1;
      expect(
        firstNumber(q.desc),
        `任务「${q.name}」的说明与条件对不上:说明「${q.desc}」,条件 ${q.cond.key}=${q.cond.value}`,
      ).toBe(q.cond.value);
    }
    expect(checked, "一条计数任务都没扫到").toBeGreaterThanOrEqual(8);
  });

  it("每日任务:说明里的数等于 target", () => {
    for (const d of DAILY_TASKS) {
      expect(
        firstNumber(d.desc),
        `日课「${d.name}」的说明与目标对不上:说明「${d.desc}」,目标 ${d.counterKey}=${d.target}`,
      ).toBe(d.target);
    }
    expect(DAILY_TASKS.length, "日课表空了,判据形同虚设").toBeGreaterThanOrEqual(8);
  });
});

describe("枚举 id 不许印到界面上 —— 玩家看的是名字,不是 key", () => {
  /*
   * 由来:坊市货架上印着「excellent·9 层」「profound·9 层」。
   *
   * 根因不是打错字,是**类型擦除**:货架预览字典写成 `Record<number, string>`,
   * 往里塞的是 `generateEquipment(...).quality` —— 品阶的 **id**。而 QualityId
   * 与 name 都是 string,TypeScript 看不出区别,编译器一路放行。
   *
   * 同一个错在同一页里还并存着正确写法(`qualityDef(it.quality).name`),
   * 于是它既没被类型拦住,也没被"看起来像英文"的直觉拦住 —— 那确实是英文,
   * 只是它在数据层是对的、在界面上是错的。
   *
   * 修法有两个层次:
   *   一 把字典改成结构化对象(EquipPreview),id 想混进名字字段就没那么容易;
   *   二 这条判据 —— 界面里不许直接插值这些"有中文名的枚举字段"。
   */
  // 路径相对 src/core(__dirname),与本文件里 src() 辅助函数同一口径
  const VUE = (rel: string): string => readFileSync(resolve(__dirname, rel), "utf-8");
  const UI_FILES = [
    "../views/MarketView.vue",
    "../views/InventoryView.vue",
    "../views/CharacterView.vue",
    "../views/CultivationView.vue",
    "../views/RealmCodexView.vue",
    "../components/equipment/AffixTransferPanel.vue",
    "../components/equipment/EquipmentDetailDialog.vue",
  ];

  /**
   * 这些字段在数据层是**英文 id**,在界面上一律要换成 .name。
   *
   * 只收确定的:quality / rarity。**grade 不收** —— 同名不同义:
   * 灵草档位的 grade 是数字 1~5(灵草坊格子里那枚印章大字就是它),
   * 而天赋等表的 grade 才是英文档位。一个判据按字段名去猜,只会逼人
   * 给数字也写一层多余映射。
   */
  const ENUM_FIELDS = ["quality", "rarity"];

  it("界面里不许直接插值品阶 id", () => {
    const bad: string[] = [];
    for (const rel of UI_FILES) {
      const text = VUE(rel);
      /*
       * 只在模板部分找(script 里出现这些字段是合法的:比较、查表、传参)。
       *
       * **不能**用 `slice(0, indexOf("<script"))` —— 本库有相当一批文件是
       * `<script setup>` 写在最前面、模板在后的(坊市就是),那样切出来是空串,
       * 判据等于什么都没查。写成「取 <template> 到 </template> 之间」才与
       * 文件里两块的先后无关。
       */
      const tpl = /<template>([\s\S]*)<\/template>/.exec(text)?.[1] ?? "";
      if (!tpl) throw new Error(`${rel}: 没切出模板 —— 判据会静默放过一切,先修它`);
      // 去注释:示例里常会把坏写法原样引一遍(「原先印的是 {{ x.quality }}」)
      const live = tpl.replace(/<!--[\s\S]*?-->/g, "");
      for (const field of ENUM_FIELDS) {
        // {{ x.field }} 或 {{ x.field }}  —— 直接插值,没有 .name / 函数包裹
        const re = new RegExp(`\\{\\{[^}]*\\.${field}\\s*\\}\\}`, "g");
        for (const m of live.matchAll(re)) {
          bad.push(`${rel}: ${m[0].trim()}`);
        }
      }
    }
    expect(
      bad,
      `这些地方直接把枚举 id 印给了玩家 —— 改走 qualityDef(...).name 之类:${bad.join(" | ")}`,
    ).toEqual([]);
  });

  it("货架品阶前缀要用中文名 —— 判据自证", () => {
    // 自证:上面那条正则真能认出坏样本
    const sample = "<span>{{ it.quality }}·{{ it.tier }}阶</span>";
    expect(/\{\{[^}]*\.quality\s*\}\}/.test(sample)).toBe(true);
    // 正确写法不该被认成坏样本(它是 qualityDef(it.quality).name)
    const good = "<span>{{ qualityDef(it.quality).name }}</span>";
    expect(/\{\{[^}]*\.quality\s*\}\}/.test(good)).toBe(false);
  });
});
