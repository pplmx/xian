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
import { DAO_PATHS } from "@/data/endgame";
import { MAX_COMBAT_ROUNDS } from "@/data/constants";
import { SWORD_PURITY_MAX_LAYERS } from "@/core/daoDepth";

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
