/**
 * 突破服务 —— 成功率计算 / 天劫 / 结算
 */
import { mulberry32, rng } from "@/utils/random";
import { formatDuration, formatPercent } from "@/utils/format";
import { buffDef } from "@/data/buffs";
import { modsText } from "@/data/statNames";
import { realmDef, realmLabel, worldOf, isWorldEntry } from "@/data/realms";
import {
  BT_FAIL_EXP_LOSS,
  BT_LUCK_TO_RATE,
  BT_QI_COST_RATIO,
  VEIN_UNLOCK_MAJOR,
} from "@/data/constants";
import { ARTIFACT_SLOT_UNLOCK_MAJOR } from "@/data/artifacts";
import { breakthroughBaseRate, clampRate } from "./formulas";
import { modOf } from "./statsCalc";
import {
  rollTribulation,
  sustainScore,
  guardScore,
  waveDamage,
  tribulationWaves,
  currentTribulationRelief,
  currentStatGuard,
  NO_STAT_GUARD,
  type TribStatGuard,
} from "./tribulationDecision";
import { todayWeather } from "./weather";
import { tribulationDef, TRIBULATIONS, type TribulationKind } from "@/data/tribulations";
import { NO_RELIEF, type TribulationRelief } from "@/data/linggenAffinity";
import { reliefFelt } from "./linggenAffinity";
import { track, trackRealm, checkStateAchievements } from "./progress";
import { recordMilestone } from "./identity";
import { usePlayerStore } from "@/stores/player";
import { useResourcesStore } from "@/stores/resources";
import { useCultivationStore } from "@/stores/cultivation";
import type { BreakthroughView, StatMods } from "@/types";
import { playSfx } from "./audio";
import { notify } from "./notify";
import { showBreakthrough } from "./uiPort";
// Phase 28 突破准备:静坐/服丹的一次性加成(见 earlyGameService;仅无劫突破受益)
import {
  breakthroughPrepState,
  consumeBreakthroughPrep,
  type BreakthroughPrepView,
} from "./earlyGameService";

/**
 * 首次跨入某大境时的新系统解锁通告。门槛读常量(VEIN_UNLOCK_MAJOR / ARTIFACT_SLOT_UNLOCK_MAJOR,
 * 与各解锁谓词同源)、境界名由 major 现取(realmDef 不手写)。自带「跨过才触发」:
 * from < 门槛 && to >= 门槛 才算首开 —— 同境内逐层突破 from==to 返回 null,不重复轰炸。
 */
/**
 * 渡劫失败时的修为退返比例 —— 从词条/天赋取,并**封顶 80%**。
 *
 * 上限的意义:退返越高,失败代价越小;若叠到 100%,失败就变成零代价,整个渡劫的
 * 取舍(揣着修为赌一把 vs 稳妥攒材料)随之失去意义。当前数据最高只到
 * 天赋 0.1 + 单件词条 0.2,离 0.8 很远 —— 这是**防御性上限**,防的是以后有人
 * 把 breakRefund 的数据往上调。故它必须可测:抽成纯函数,由 `breakRefund.spec` 直接钉。
 */
export function breakRefundOf(mods: Parameters<typeof modOf>[0]): number {
  return Math.min(0.8, modOf(mods, "breakRefund"));
}

export function firstUnlockAnnouncement(fromMajor: number, toMajor: number): string | null {
  const toName = realmDef(toMajor).name;
  if (fromMajor < VEIN_UNLOCK_MAJOR && toMajor >= VEIN_UNLOCK_MAJOR)
    return `${toName}既成,洞府深处灵脉初醒 —— 投点可定主脉、聚灵增产`;
  // 凡境秘境与法宝第二槽同拍(门槛同为元婴):合并成一条,一次突破只出一次声
  if (fromMajor < ARTIFACT_SLOT_UNLOCK_MAJOR && toMajor >= ARTIFACT_SLOT_UNLOCK_MAJOR)
    return `${toName}既成,凡境秘境之门开启,法宝位亦添一席 —— 一处灵石换一趟,出则散,慎入`;
  return null;
}

export interface BreakthroughInfo {
  ready: boolean;
  reason: string;
  /** 修炼突破的基础成功率(未计天劫) */
  rate: number;
  rateText: string;
  qiCost: number;
  isMajor: boolean;
  needTribulation: boolean;
  targetLabel: string;
  /** 突破准备状态(就绪时 rate 已并入加成,见 AN 接线) */
  prep: BreakthroughPrepView;
}

/**
 * 蒙特卡洛采样次数。渡劫波次少(4~15),单次推演很便宜。
 *
 * **但"毫秒级"这三个字容易低估**:不传 `kind` 时函数会对**全部五种劫型**各采一遍,
 * 实测 2026-11-09 —— 单劫型 5.0ms、全五型 **23.0ms**。23ms 已经接近长任务阈值的一半,
 * 说"毫秒级"读者会以为是四五毫秒。
 *
 * 影响面:这个函数**只在 spec 与平衡审计里用**,运行时零调用(玩家看到的是
 * 「劫型 + 四维准备度 + 风险」,不是单一成功率)。所以 23ms 不进帧预算,
 * 但它确实记在测试耗时里 —— 改采样数前先看这条。
 */
const TRIB_SAMPLE = 4000;

/**
 * 按玩家词条推演渡劫成功率(审计口径,非 UI 展示口径)。
 *
 * Phase 32.0 起,玩家看到的是"劫型 + 四维准备度 + 风险",不再是单一成功率数字;
 * 本函数只服务于平衡审计与回归测试。不传 kind 时取五种劫型的平均,
 * 代表"不挑天时的长期基线",不代表任何一次具体渡劫。
 *
 * 数学主干与实际结算 runTribulation 共用 tribulationDecision 的度量函数。
 */
export function tribulationSuccessRate(
  targetMajor: number,
  mods: StatMods,
  kind?: TribulationKind,
  relief: TribulationRelief = NO_RELIEF,
  /** 三维折算(防御→抗性 / 气血→水位);审计口径默认不传 = 只看词条,读数偏保守 */
  stat: TribStatGuard = NO_STAT_GUARD,
): number {
  const kinds = kind ? [tribulationDef(kind)] : TRIBULATIONS;
  const rand = mulberry32(0x5eed);
  const waves = tribulationWaves(targetMajor);
  let survived = 0;
  let total = 0;
  for (const def of kinds) {
    const regen = sustainScore(mods, def, relief);
    for (let s = 0; s < TRIB_SAMPLE; s += 1) {
      let hpLeft = 1 + guardScore(mods, def, relief) + stat.guard;
      for (let w = 1; w <= waves; w += 1) {
        hpLeft =
          hpLeft -
          waveDamage(def, mods, targetMajor, w, hpLeft, relief, 1, stat) * (0.85 + rand() * 0.3) +
          regen;
        if (hpLeft <= 0) break;
      }
      if (hpLeft > 0) survived += 1;
      total += 1;
    }
  }
  return survived / total;
}

export function breakthroughInfo(): BreakthroughInfo {
  const player = usePlayerStore();
  const resources = useResourcesStore();
  const isMajor = player.isMajorStep;
  const nextMajor = isMajor ? player.major + 1 : player.major;
  const nextSub = isMajor ? 0 : player.sub + 1;
  /**
   * 大关皆劫 —— 这张表里不再有"无劫大关"。
   *
   * 从前境界数据上挂着一枚 `tribulation` 开关,真仙是唯一的 false(旧设计当它是
   * 飞升之赏)。那条例外让三件事说不清:进阶成功率的作用域、三个跨界入口
   * (真仙/神人/混沌真灵)的规矩不一样、"大关未必渡劫"这条规则玩家猜不到。
   * 现在只剩一条规则:小进阶掷点,大关渡劫 —— 想要无劫的路,得先有本事免劫。
   */
  const needTribulation = isMajor;
  const qiCost = Math.floor(player.qiCapValue * BT_QI_COST_RATIO);
  const mods = player.finalStats.mods;
  // Phase 28 突破准备:就绪的静坐/丹药加成并入展示率(消费在 attemptBreakthrough,一次性)
  const prep = breakthroughPrepState();
  const rate = clampRate(
    breakthroughBaseRate(player.major, player.sub) +
      modOf(mods, "breakthroughRate") +
      modOf(mods, "luck") * BT_LUCK_TO_RATE +
      (prep.ready ? prep.bonus : 0),
  );
  let ready = true;
  let reason = "";
  if (player.atMaxRealm) {
    ready = false;
    reason = "已至大道尽头";
  } else if (!player.expFull) {
    ready = false;
    reason = "修为未至圆满";
  } else if (resources.qi < qiCost) {
    ready = false;
    reason = "灵气不足";
  }
  return {
    ready,
    reason,
    rate,
    rateText: formatPercent(rate, 0),
    qiCost,
    isMajor,
    needTribulation,
    targetLabel: realmLabel(nextMajor, nextSub),
    prep,
  };
}

/** 模拟渡劫:返回(是否渡过, 战报)
 * Phase 32.1:与 tribulationDecision 共用度量函数,预览与结算不可能分叉
 * Phase 32.2:灵根解法通道同样经 currentTribulationRelief 取,与预览同源
 * 渡劫难度随天时:与预览 currentTribulationPlan 同一乘数(雷鸣日+8%) */
function runTribulation(targetMajor: number): {
  survived: boolean;
  log: string[];
  /**
   * 这一场掷中的劫型 —— 一并交回去,而不是让调用方再 `rollTribulation` 一次。
   *
   * 劫型是确定性派生的,重算一遍**今天**恰好等于同一个值;但那是巧合级的一致:
   * 只要派生规则跟着天时/境界改一次,或者跨过午夜那一拍,结果屏与决斗屏就会
   * 指着两种不同的劫。掷一次、交回去,是这里唯一不会分叉的写法。
   */
  kind: TribulationKind;
} {
  const player = usePlayerStore();
  const mods = player.finalStats.mods;
  const waves = tribulationWaves(targetMajor);
  const kind = rollTribulation(targetMajor);
  const tDef = tribulationDef(kind);
  const relief = currentTribulationRelief(player, kind);
  /*
   * **用 targetMajor,不是 player.major。**
   *
   * 预览侧 `currentTribulationPlan` 用的是 `nextMajor`(见 tribulationDecision),
   * 注释写着"与结算同源,预览与实算不可能分叉"。而这里原先读 `player.major`
   * (Round 35 改传参时照搬了旧行为,当时两者恰好等价)——
   * 大境界突破时 `player.major` 与 `player.major + 1` 会落在**不同的世界**
   * (`worldOf` 按界域分池),于是预览按新界报"雷鸣日 +8%",结算却按旧界取天时,
   * 两边的乘数可能不同。
   *
   * 跨界的三处:major 8 / 13 / 17 各是所在界域的最后一境。
   */
  const weatherMult = todayWeather(targetMajor).tribulationMult;
  // 三维折算与预览同源(currentTribulationPlan 走同一个 helper):血厚防高者硬抗一部分
  const stat = currentStatGuard(player);
  const regen = sustainScore(mods, tDef, relief);
  let hpLeft = 1 + guardScore(mods, tDef, relief) + stat.guard;
  const log: string[] = [
    `乌云压顶,${realmDef(targetMajor).name}劫将至——${tDef.name}之劫,共 ${waves} 道!`,
  ];
  if (reliefFelt(relief)) log.push("你体内灵根与此劫气机隐隐相应,自有一线生路。");
  for (let w = 1; w <= waves; w += 1) {
    hpLeft =
      hpLeft -
      waveDamage(tDef, mods, targetMajor, w, hpLeft, relief, weatherMult, stat) *
        rng.float(0.85, 1.15) +
      regen;
    if (hpLeft <= 0) {
      log.push(`第 ${w} 道天雷轰然落下,你护体灵光崩碎,重伤坠地……`);
      return { survived: false, log, kind };
    }
    const pct = Math.max(1, Math.round(hpLeft * 100));
    log.push(`第 ${w} 道天雷落下,你咬牙硬撼,气血余 ${Math.min(999, pct)}%。`);
  }
  log.push("雷云散尽,天光重开。你于劫灰中缓缓立起——渡劫,成了!");
  return { survived: true, log, kind };
}

/** 尝试突破,返回展示数据(由 UI 弹窗呈现) */
export function attemptBreakthrough(): BreakthroughView | null {
  const player = usePlayerStore();
  const resources = useResourcesStore();
  const cultivation = useCultivationStore();
  const info = breakthroughInfo();
  if (!info.ready) {
    notify(info.reason, "warn");
    return null;
  }
  const fromLabel = player.realmName;
  resources.setQi(resources.qi - info.qiCost, player.qiCapValue);

  let success: boolean;
  let tribulationLog: string[] = [];
  /**
   * 这一场渡劫掷中的劫型 —— 小境界突破没有劫,给空串。
   *
   * 结果弹窗的劫相由它取景(见 ui/sceneTerrain 的 sceneTerrainOfTribulation),
   * 故必须一路带到 view 上;弹窗自己不再掷一次(理由见 runTribulation 的返回注释)。
   */
  let tribulationKind = "";
  if (info.needTribulation) {
    const result = runTribulation(player.major + 1);
    success = result.survived;
    tribulationLog = result.log;
    tribulationKind = result.kind;
    // 「渡过」才算渡过:失败不计数(否则连败三次自动解锁 a_trib3 劫后余生)
    if (success) track("tribulations");
  } else {
    // 无劫突破消费掉就绪的准备加成(info.rate 已并入,见 breakthroughInfo peek)
    consumeBreakthroughPrep();
    success = rng.chance(info.rate);
  }

  let view: BreakthroughView;
  if (success) {
    const prevMajor = player.major; // advanceRealm 之前:进金丹前是 1,进元婴前是 2
    player.advanceRealm();
    // 首次跨入门槛:新系统第一次开张要有声。文案走 firstUnlockAnnouncement(门槛读常量、
    // 境界名现取),自带「跨过才触发」—— 同境内逐层突破(from==to)不会重复轰炸。
    const announcement = firstUnlockAnnouncement(prevMajor, player.major);
    if (announcement) notify(announcement, "rare");
    cultivation.clearNegativeBuffs();
    track("breakthroughs");
    trackRealm();
    checkStateAchievements();
    // 大境之槛另有一声:十次突破里只有一次真换了重天(见 core/audio 的 majorBreak)
    playSfx(info.isMajor ? "majorBreak" : "breakthrough");
    const realm = player.realm;
    // 跨界飞升:渡劫→真仙入仙界,大罗→神人入神界,神帝→混沌真灵入混沌海。
    // 这三步是全流程仅有的「换一片天」,给独立叙事与跨世节点(人间界入口不算)
    const crossedWorld = info.isMajor && player.major > 0 && isWorldEntry(player.major);
    const world = crossedWorld ? worldOf(player.major) : null;
    if (world) recordMilestone(`first_${world.id}`);
    const baseMessage = `境界跃迁,天地翻覆。${realm.desc}。寿元增至 ${player.lifespanMax} 载。`;
    // 大关进阶时附上这一境的出处(可解释性:境界名不是随手堆的字)
    const loreLine = `——「${realm.basis}」${realm.lore}`;
    view = {
      success: true,
      fromLabel,
      toLabel: player.realmName,
      isMajor: info.isMajor,
      toRealmName: realm.name,
      toRealmLore: realm.lore ?? "",
      kind: tribulationKind,
      tribulationLog,
      message: !info.isMajor
        ? "灵台清明,经脉拓宽,修为更上一层。"
        : world
          ? `天地改换,山河重立。你踏入${world.name}——${world.desc}。${realm.desc},寿元增至 ${player.lifespanMax} 载。${loreLine}`
          : `${baseMessage}${loreLine}`,
    };
  } else {
    const mods = player.finalStats.mods;
    const refund = breakRefundOf(mods);
    /*
     * 渡劫跬步(宿命传承):本世首次渡劫失败,修为不散。
     * `consumeHeritageUse` 返回 true 表示「这一次被免掉了」—— 要记下来,
     * 因为失败弹窗那一行下一步得说「此番未损修为」而不是「修为已折」。
     */
    const sparedByHeritage = player.consumeHeritageUse("dubu");
    if (!sparedByHeritage) player.loseExpPct(BT_FAIL_EXP_LOSS * (1 - refund));
    cultivation.addBuff("injury", Date.now());
    track("breakthroughFails");
    playSfx("fail");
    /*
     * 失败之后那一步 —— 从结算里取,不手写。
     *
     * 三件事在刚才那一瞬同时发生了:准备加成被 consumeBreakthroughPrep() 取走
     * (失败也不退)、挂上了伤势、修为掉了一截。而这是一扇全屏弹窗,
     * 玩家在这一屏看不到修行页上那些「静坐调息 / 聚气丹」按钮。
     * 故这一行要按**实际发生了什么**来说。
     *
     * 准备状态一定已是空的(判定时取走了),所以照实说「要再准备一次」——
     * 若哪天结算改成失败返还,这条会自己变得不再成立,判据与代码一起提醒。
     */
    const prepUsed = !breakthroughPrepState().ready;
    const parts: string[] = [];
    if (sparedByHeritage) {
      parts.push("渡劫跬步护住了这一身修为");
    } else {
      parts.push(`修为折损 ${formatPercent(BT_FAIL_EXP_LOSS * (1 - refund))}`);
    }
    /*
     * 伤势这一句要摊开 —— 「要先调息」是形容词,玩家读不出代价。
     *
     * 实际是 150 秒里修炼速度砍半、攻防各降两成(buffDef 的数据),而这一屏是全屏
     * 弹窗,正盖在修行页那些「静坐调息 / 聚气丹」按钮上,玩家在这里看不到 buff 列表
     * (见 AGENTS.md「决策信息完整」:代价、生效时长都要摊开,不能只给定性形容词)。
     *
     * 时长取 buffDef 的 durationSec、效果取它的 mods 交给 modsText —— 两样都不手抄,
     * 该常数一改,这一句自己跟着变。
     */
    const injury = buffDef("injury");
    parts.push(
      injury
        ? `伤势 ${formatDuration(injury.durationSec)} —— ${modsText(injury.mods)}`
        : "伤势要先调息",
    );
    if (prepUsed) parts.push("下一次突破仍需重新准备");
    view = {
      success: false,
      fromLabel,
      toLabel: info.targetLabel,
      isMajor: info.isMajor,
      // 失败时印面走「滞」,不用它;类型要求完整故照实给(仍是当前那一境)
      toRealmName: player.realm.name,
      toRealmLore: player.realm.lore ?? "",
      kind: tribulationKind,
      tribulationLog,
      message: info.needTribulation
        ? "天威难测,此番渡劫失利。所幸道基未毁,来日再战。"
        : "灵气逆冲,功亏一篑。你吐出一口淤血,盘膝疗伤。",
      nextStep: parts.join(" · "),
    };
  }
  showBreakthrough(view);
  return view;
}

/**
 * 期望尝试次数 = 1 / 成功率 —— 界面上「平均约 1.4 次」那行用。
 *
 * 为什么值得摆出来:成功率 71% 读起来"还行",但它的期望是 1.4 次、且有一成长尾要试三次以上。
 * 概率本身不直观,期望次数直观 —— 与 realms.sim 打出来的读数同一口径。
 *
 * @returns 成功率 ≤0 或 ≥1 时给 null(必成不必说「平均」,必败没有意义)
 */
export function expectedTries(rate: number): number | null {
  if (!Number.isFinite(rate) || rate <= 0 || rate >= 1) return null;
  return Math.round((1 / rate) * 10) / 10;
}
