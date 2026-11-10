/**
 * 六大构筑流派在终局都该有自己的道途 —— 护盾流没有。
 *
 * ## 现状:六个流派、七条道途,却对不上
 *
 * 构筑判定只认六种形状(`core/buildSim` 的 `BUILD_PROFILES`):
 *
 *   背水(lowHpDamage / lowHpReduction / executeDamage)
 *   罡盾(shieldOnStart / shieldPower / damageReduction)
 *   反震(counterRate / counterDamage)
 *   连击(comboRate / comboDamage / speed)
 *   沐泽(lifesteal / regenPerRound / overhealShield)
 *   锋芒(fullHpDamage / firstStrike / dodgeRate / critRate)
 *
 * 而终局有七条道途(`data/endgame` 的 `DAO_PATHS`),逐条对回去:
 *
 *   剑道   → 锋芒 ✓
 *   长生道 → 沐泽 ✓
 *   连珠道 → 连击 ✓
 *   借势道 → 反震 ✓
 *   血河道 → 背水 ✓
 *   天机道 → 不对应任何流派
 *   杀伐道 → 不对应任何流派
 *
 * **罡盾流一条也对不上。**剑道还带着 `damageReduction: -0.1` —— 对护盾流是反向的;
 * 长生道的 `shieldCapRatio` 只放宽护盾上限,不打护盾这张牌。
 *
 * 道途的定位写在界面里:「选方向」。那么一个走罡盾流到终局的玩家,道途七选一,
 * 没有一条是为他这条路准备的 —— 选哪条都等于把构筑的一半丢掉。
 *
 * ## 判据守什么
 *
 * 一条:**每个构筑流派都至少有一条道途在打它的核心词条**。
 *
 * 认「核心词条」而不是「流派名」:两边各有一套命名(流派叫罡盾、道途叫镇岳),
 * 名字对不上不能当判据,而词条键是同一个事实。判据取每个流派权重最高的
 * 那两项词条,要求某条道途的 `rules` 里含有其中至少一项。
 *
 * 它不规定道途该叫什么、该多强 —— 那是设计的事;它只钉住"这条路在终局有人接"。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DAO_PATHS } from "@/data/endgame";
import { MAX_COMBAT_ROUNDS } from "@/data/constants";
import { SWORD_PURITY_MAX_LAYERS } from "@/core/daoDepth";
import { mergeRules, runGauntlet, worldFoeSnap } from "@/core/gauntlet";
import { BUILD_PROFILES, buildSnap } from "@/core/buildSim";
import { CELESTIAL_WORLDS } from "@/data/endgame";
import { mulberry32, RandomService } from "@/utils/random";
import { SIM_REFERENCE } from "@/core/celestialSim";
import type { CombatantSnap } from "@/types";

describe("终局道途 · 护盾流有人接", () => {
  /**
   * 护盾流的核心词条 —— 见 core/buildSim 的罡盾流。
   *
   * 这些键是「打护盾这张牌」的全部说法:起手给盾、盾更厚、溢出成盾、盾的上限。
   * 判据问的是**七条道途里有没有一条的主加成落在这个集合里**。
   */
  const SHIELD_KEYS = ["shieldOnStart", "shieldPower", "overhealShield"] as const;

  /** 一条道途对它自己玩家那一侧的全部加成(含 playerExtraMods 一层) */
  function playerSide(path: (typeof DAO_PATHS)[number]): Record<string, number> {
    const out: Record<string, number> = {};
    const rules = path.rules as Record<string, unknown>;
    for (const [k, v] of Object.entries(rules)) {
      if (k === "playerExtraMods") {
        for (const [k2, v2] of Object.entries((v ?? {}) as Record<string, number>)) {
          if (typeof v2 === "number") out[k2] = v2;
        }
      } else if (typeof v === "number") {
        out[k] = v;
      }
    }
    return out;
  }

  it("至少有一条道途主打护盾 —— 七条里现在一条也没有", () => {
    const carriers = DAO_PATHS.filter((path) => {
      const own = playerSide(path);
      return SHIELD_KEYS.some((k) => (own[k] ?? 0) > 0);
    });
    expect(
      carriers.map((p) => p.name),
      "罡盾流走到终局没有自己的路 —— 道途是「选方向」,而这条路七选一都是丢掉构筑",
    ).not.toEqual([]);
  });

  it("护盾/护持类道途的文案说的是护盾", () => {
    const carriers = DAO_PATHS.filter((path) => {
      const own = playerSide(path);
      return SHIELD_KEYS.some((k) => (own[k] ?? 0) > 0);
    });
    for (const path of carriers) {
      expect(path.ruleText.join(""), `${path.name} 的文案该说到护盾/护持`).toMatch(/盾|护/);
    }
  });

  it("反空转:道长表非空,道途也有规则", () => {
    expect(DAO_PATHS.length).toBeGreaterThan(0);
    for (const p of DAO_PATHS) {
      expect(Object.keys(playerSide(p)).length, `${p.name} 玩家侧一个加成都没有`).toBeGreaterThan(
        0,
      );
    }
  });
});

/**
 * 道途的「章法」(deepText)是**承诺**,不是风味 —— 许诺的机制必须真的存在于代码里。
 *
 * ## 缺口
 *
 * 镇岳道的章法写着「岳意……至多四层,每层护盾强度 +6%、减伤 +2%」与
 * 「远征蓄势:每胜一场,岳势再添一层」。而查证下来:
 *
 *   · `core/daoDepth.ts` 只有剑道的 `SWORD_LAYER_MODS` 与 sword/slaughter 两套逐胜叠层;
 *   · `core/expedition.ts` 的 `perWinMods()` 对 zhenyue 返回 `undefined`;
 *   · `core/playerSnap.ts` 的纯度并入只认 `daoPath === "sword"`;
 *   · 补镇岳道那个提交(`1022f2b8`)的 `--stat` 只动了 `data/endgame.ts` 与 `types/index.ts`。
 *
 * 两套都没建。而道途**一世只能选一次**(`chooseDao` 见非空即拒),卡上那两行正是
 * 玩家据以做这次不可逆选择的依据。
 *
 * 更糟的是它连数都没对上:镇岳道自己只有 3 条纯度判据,却写「至多四层」——
 * 那是照抄剑道四条之后的残留。
 *
 * ## 为什么此前没有任何门红
 *
 * `rg -n "deepText" src --glob '*.spec.ts'` → **0 命中**:没有任何判据核过
 * 章法里的数字与实现是否对得上。浏览器门也只有 `daoPath: "sword"` 一个夹具。
 *
 * ## 判据守什么
 *
 * 章法里出现的每个百分数,必须能在**该道途自己的数值**里找到同源:
 * `rules` 里的数字 ×100,或该道途的专用常量。找不到就是「承诺了一个不存在的数」。
 *
 * 这条不判设计好坏,只判「说的数在不在」。它对未来任何新道途同样有效 ——
 * 想写「每层 +X%」,就得先真的有一个 +X% 的层数机制。
 */
describe("终局道途 · 章法里的数必须能在实现里找到", () => {
  /**
   * 一条道途自己的数字,折成「卡面可能怎么写它」的候选百分数。
   *
   * 三种口径,每种都把**换算规则写在这里**而不是在比对处临时凑:
   *   ① 加成型:0.15 → 「+15%」;
   *   ② 倍率型:1.2 → 「+20%」(乘数写成增幅是中文文案的常态,不折就会误报);
   *   ③ 回合上限:35 相对基础 50 → 「-30%」(它是从 MAX_COMBAT_ROUNDS 算出来的差)。
   *
   * 只认这三种 —— 放宽成「任何近似都算对」就守不住任何东西了。
   */
  function playerNumbers(path: (typeof DAO_PATHS)[number]): number[] {
    const out: number[] = [];
    const raw: number[] = [];
    const rules = path.rules as Record<string, unknown>;
    for (const [k, v] of Object.entries(rules)) {
      if (k === "playerExtraMods") {
        for (const v2 of Object.values((v ?? {}) as Record<string, number>)) {
          if (typeof v2 === "number") raw.push(v2);
        }
      } else if (typeof v === "number") raw.push(v);
      else if (v && typeof v === "object") {
        // perRounds 这类嵌套对象:里面每个数都算该道途自己的数
        for (const v2 of Object.values(v as Record<string, unknown>)) {
          if (typeof v2 === "number") raw.push(v2);
        }
      }
    }
    for (const v of raw) {
      out.push(Math.abs(v)); // ① 加成型
      if (v > 1) out.push(Math.abs(v - 1)); // ② 倍率型
    }
    // ③ 回合上限:相对基础回合数
    const mr = (path.rules as { maxRounds?: number }).maxRounds;
    if (typeof mr === "number") out.push(Math.abs(mr - MAX_COMBAT_ROUNDS) / MAX_COMBAT_ROUNDS);
    return out;
  }

  /**
   * 代码里**真实存在**的该道途专用常量。
   *
   * 只登记有实际消费点的那些 —— 剑道四层与逐胜叠层、杀伐逐胜与速战三档。
   * 新增这类常量时在这里登记一行,并在注释里写明消费点;
   * 反过来说,**没有消费点的常量不许登记**(登记了就等于给虚构的数开后门)。
   */
  const PATH_CONSTANTS: Record<string, number[]> = {
    sword: [
      0.04, // SWORD_LAYER_MODS.damageBonus / SWORD_PER_WIN.damageBonus
      0.02, // SWORD_LAYER_MODS.critRate / SWORD_PER_WIN.critRate
    ],
    slaughter: [
      0.05, // SLAUGHTER_PER_WIN.damageBonus
      0.08, // slaughterSpeedBonus 24 回合档
      0.15, // slaughterSpeedBonus 18 回合档
      0.25, // slaughterSpeedBonus 12 回合档
    ],
  };

  it("章法里每个百分数都能在该道途的数值或专用常量里找到", () => {
    const offenders: string[] = [];
    let checkedNumbers = 0;
    for (const path of DAO_PATHS) {
      const own = [
        ...playerNumbers(path),
        ...(PATH_CONSTANTS[path.id as keyof typeof PATH_CONSTANTS] ?? []),
      ];
      /*
       * 卡面 `ruleText` 与章法 `deepText` 都要核 —— 两处都是玩家据以选路的字。
       * 实测:\`ruleText\` 曾写「自身造成伤害 -12%」而 \`rules\` 是 -0.1,
       * 章法那半修好之后,这一半仍然撒谎。
       */
      for (const line of [...path.ruleText, ...path.deepText]) {
        // 百分数:6% / +12% / −12%(全角负号与半角都认)
        for (const m of line.matchAll(/(\d+(?:\.\d+)?)\s*%/g)) {
          const pct = Number(m[1]) / 100;
          checkedNumbers += 1;
          const hit = own.some((v) => Math.abs(v - pct) < 1e-9);
          if (!hit) offenders.push(`${path.name}:「${m[1]}%」出现在章法里,但实现中没有这个数`);
        }
      }
    }
    expect(
      offenders,
      "章法承诺了实现里不存在的数 —— 道途是一世只能选一次的不可逆选择:" + offenders.join("; "),
    ).toEqual([]);
    // 防空转:正则写错(比如全角百分号)会让上面永远通过
    expect(checkedNumbers, "一个百分数都没扫到 —— 判据会空转").toBeGreaterThan(4);
  });

  /**
   * 「至多四层」这类**中文数词**承诺也要核。
   *
   * 上一条只扫 `\d+%`,而镇岳道那句真正的错在「至多四层」——
   * 它当时只有 3 条纯度判据,「四层」是照抄剑道的残留。
   * 百分比那半能抓住 6%/2%,但抓不住这个数。
   *
   * 口径:章法里出现「至多 N 层 / N 层」时,N 必须等于**该道途真实存在的层数上限**;
   * 没有任何层数机制的道途,章法里根本不该出现「N 层」。
   * 现在只有剑道有层数机制(`SWORD_PURITY_MAX_LAYERS`),故其余道途一律不许写。
   */
  it("章法里的「N 层」必须与真实的层数上限一致", () => {
    const NUM = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8 } as Record<
      string,
      number
    >;
    /** 该道途真实的层数上限;没有层数机制的道途是 0 */
    const layerCap = (id: string): number => (id === "sword" ? SWORD_PURITY_MAX_LAYERS : 0);
    const offenders: string[] = [];
    let seen = 0;
    for (const path of DAO_PATHS) {
      const cap = layerCap(path.id);
      for (const line of path.deepText) {
        for (const m of line.matchAll(/([一二三四五六七八\d]+)\s*层/g)) {
          seen += 1;
          const n = NUM[m[1]!] ?? Number(m[1]);
          if (!Number.isFinite(n)) continue;
          if (cap === 0) {
            offenders.push(`${path.name}:章法写「${m[1]} 层」,但这一道没有层数机制`);
          } else if (n > cap) {
            offenders.push(`${path.name}:章法写「${m[1]} 层」,而上限只有 ${cap} 层`);
          }
        }
      }
    }
    expect(
      offenders,
      "章法承诺的层数与实现里的层数上限对不上 —— 数字错位比措辞错更危险:" + offenders.join("; "),
    ).toEqual([]);
    // 防空转:剑道那条「至多四层」必须被扫到,否则说明正则或数据都不对
    expect(seen, "一个「N 层」都没扫到 —— 判据会空转(剑道章法里本来就写着层数)").toBeGreaterThan(0);
  });

  it("章法里不许出现「必」这类绝对断言,除非该道途真有 100% 触发项", () => {
    /*
     * 借势道原文「凡敌攻我,**必**被我收势反掷」—— 而反击是 `rng.chance(counterRate)`
     * 的 20%。「必」与「有机会」在玩家的决策里是两个世界。
     */
    const offenders: string[] = [];
    for (const path of DAO_PATHS) {
      for (const line of path.deepText) {
        if (!/必/.test(line)) continue;
        const own = path.rules as { playerExtraMods?: Record<string, number> };
        const guaranteed = Object.values(own.playerExtraMods ?? {}).some((v) => Math.abs(v) >= 1);
        if (!guaranteed) offenders.push(`${path.name}:「${line.slice(0, 24)}…」`);
      }
    }
    expect(
      offenders,
      "章法用了「必」这种绝对断言,而该道途没有 100% 触发项 —— 与实现不符:" + offenders.join("; "),
    ).toEqual([]);
  });
});

/**
 * 道途的代价不许把收益吃干净 —— 「一世只能选一次」的路不该是陷阱。
 *
 * ## 缺口
 *
 * 八条道途里,五条把代价写在**敌人身上**(`enemyHpMult` / `enemyAtkMult`),
 * 三条无代价。此前没有任何判据量过「一条道途选下去到底是净赚还是净亏」——
 * `daoPathCoverage` 核的是**文案与实现一致**,`decisionAudit` 核的是
 * **契约/流派的最优解是否会塌缩**,两者都不覆盖道途的净收益。
 *
 * 实测(6 构筑 × 5 世界 × 4 局 = 120 组,与无道途基线比):
 *
 * ```text
 * 镇岳道 +29   借势道 +16   剑道 +14   杀伐道 +7   连珠道 +4   天机道 -2
 * 长生道 -23   血河道 -30          ← 净亏,而道途是**一世只能选一次**的
 * ```
 *
 * 两条净亏的道途各有原因,而且都是**代价打在自己的强项上**:
 * - 长生道靠「越拖越强」,敌血 +20% 恰好把慢热最需要的回合数吃掉;
 * - 血河道靠「把对手压到残血」,敌血 +22% 直接把那个临界点推远。
 *
 * 收到 +10% 后:长生道 +5、血河道 +8 —— 略赚,但远不如镇岳道那种直接加厚的路,
 * 仍是有取舍的选择。
 *
 * ## 判据
 *
 * 每条道途相对「无道途基线」的净胜场不许为负。这不要求八条等强
 * (强弱差是设计上的选择,`decisionAudit` 另有判据管塌缩),
 * 只要求**没有一条是纯亏** —— 不可逆的一次性选择不该让人选完就后悔。
 */
describe("终局道途 · 没有一条是净亏的陷阱", () => {
  /** 6 构筑 × 5 世界 × 4 局,与无道途基线比 */
  const winsOf = (rules: (typeof DAO_PATHS)[number]["rules"] | undefined): number => {
    let wins = 0;
    for (const profile of BUILD_PROFILES) {
      for (const world of CELESTIAL_WORLDS) {
        const snap = buildSnap(profile);
        const foes: CombatantSnap[] = [];
        for (let i = 0; i < world.fights - 1; i += 1) {
          foes.push(worldFoeSnap(world.foes[i % world.foes.length]!, SIM_REFERENCE));
        }
        foes.push(worldFoeSnap(world.guardian, SIM_REFERENCE));
        for (let s = 0; s < 4; s += 1) {
          const rng = new RandomService(mulberry32(8000 + s * 13));
          if (
            runGauntlet(snap, foes, mergeRules(world.rules, rules), world.healBetweenPct, rng)
              .cleared
          ) {
            wins += 1;
          }
        }
      }
    }
    return wins;
  };

  /**
   * 以信息换胜率的道途 —— 它们的报偿不在这条判据量得到的那一栏里。
   *
   * 天机道是唯一一条:`previewFight` 只对它开放(战前窥见敌人招式明细与胜算),
   * 而那正是「一世只能选一次」里最有分量的一种收益 —— 它改变的是**决策质量**,
   * 不是这一场的通过率。故它的净胜场略低于基线是**有意的交换**,不该判红。
   *
   * 这个豁免必须写出来,而不是把阈值放宽到 -10 之类 ——
   * 阈值会顺便放过别的真亏,例外名单只放过这一个说得出理由的。
   */
  const INFO_TRADE_DAOS = new Set<string>(["fate"]);

  it("每条道途的通过数都不低于无道途基线(以信息换胜率的一条除外)", () => {
    const baseline = winsOf(undefined);
    // 防空转:基线与样本规模都得是对的
    expect(baseline, "基线不通任何一场 —— 判据失去意义").toBeGreaterThan(20);
    expect(DAO_PATHS.length, "道途数不对").toBe(8);

    const losers: string[] = [];
    for (const dao of DAO_PATHS) {
      if (INFO_TRADE_DAOS.has(dao.id)) continue;
      const wins = winsOf(dao.rules);
      if (wins < baseline) losers.push(`${dao.name}(${wins} vs 基线 ${baseline})`);
    }
    expect(
      losers,
      "这些道途选下去**净亏** —— 而道途是一世只能选一次的不可逆选择,不该是陷阱:" +
        losers.join("、"),
    ).toEqual([]);
  });
});

/**
 * 道途确认弹窗要摊开「章法」—— 同一个决定,后一步的信息不许比前一步少。
 *
 * ## 缺口
 *
 * 道途是**一世只选一次**的不可逆选择。它的信息散在三处:
 *
 * - 选择列表(`celestial-dao__choice`):`desc` + `ruleText` + **`deepText`(章法)**;
 * - 确认弹窗(`pendingDao`):此前只有 `desc` + `ruleText` —— **没有章法**;
 * - 已定之后的展示(`currentDao`):`deepText` 又回来了。
 *
 * 于是玩家在列表里读到「长生印:每五回合得一印,恢复 4% 气血、凝 4% 护盾」,
 * 点进确认弹窗反而看不到它 —— 而弹窗才是**此世最后一次能读到它的地方**,
 * 点下去就锁到转世。
 *
 * 这是全仓反复出现的一个形状:**同一个决定,前一步的信息比后一步更全**。
 * 前几步给足、最后一步收窄,恰好收在玩家最需要确认的那一刻。
 *
 * ## 判据
 *
 * 确认弹窗必须渲染 `deepText`,且带一个可量到的落点
 * (`data-dao-confirm-deep`)—— 有了落点,浏览器门才能核它在真实 DOM 里出现。
 */
describe("道途 · 确认弹窗要摊开章法", () => {
  it("不可逆决定的最后一道确认里必须有章法", () => {
    const view = readFileSync(resolve(__dirname, "../views/CelestialView.vue"), "utf8");
    /*
     * 定位确认弹窗那一段(从 `pendingDao !== undefined` 到该 BaseModal 结束),
     * 只在这一段里查 —— 别处出现 deepText(选择列表、已定展示)不算数。
     */
    const start = view.indexOf('title="定下道途"');
    expect(start, "找不到道途确认弹窗").toBeGreaterThan(-1);
    const end = view.indexOf("</BaseModal>", start);
    expect(end, "确认弹窗没有正常闭合").toBeGreaterThan(start);
    const dialog = view.slice(start, end);
    expect(dialog, "确认弹窗里没有章法(deepText)—— 玩家在最后一步看到的信息反而更少").toContain(
      "pendingDao.deepText",
    );
    expect(dialog, "章法要有可量到的落点,否则浏览器门核不到它").toContain("data-dao-confirm-deep");
    // 防空转:这一段里确实有内容(标题与确认按钮都在)
    expect(dialog, "弹窗结构变了 —— 判据可能没切对区间").toContain("道心已定");
  });

  it("选择列表与确认弹窗读的是同一份章法,不许一处有、一处无", () => {
    /*
     * 「一处有、一处无」正是这次的缺陷形态。这条把两边一起核:
     * 列表读 `dao.deepText`,弹窗读 `pendingDao.deepText` ——
     * 两边都是同一个 `DaoPathDef.deepText`,谁也不许单独省略。
     */
    const view = readFileSync(resolve(__dirname, "../views/CelestialView.vue"), "utf8");
    expect(view, "选择列表该印章法").toMatch(/v-for="\(r, i\) in dao\.deepText"/);
    expect(view, "确认弹窗该印章法").toMatch(/v-for="\(r, i\) in pendingDao\.deepText"/);
  });
});
