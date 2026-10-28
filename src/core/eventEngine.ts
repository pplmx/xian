/**
 * 事件引擎 —— 挑选事件 / 结算选项 / 应用效果
 */
import type { EventChoice, EventDef, EventEffect, RegionDef } from "@/types";
import { RandomService, rng } from "@/utils/random";
import { formatGN, formatNum, formatPercent, formatYears } from "@/utils/format";
import { EVENTS, FORTUNE_EVENTS, eventDef } from "@/data/events";
import { CHAINS, CHAIN_EVENTS, chainOfEvent } from "@/data/chains";
import { realmDef } from "@/data/realms";
// 三档触发概率是同一份数据(见 data/constants 那段注释):际遇在 exploration 掷,
// 奇缘与机缘在这里从上一步的结果里再掷一次。数字不在本文件另写一遍 ——
// core/eventTier 要把这条乘法链讲给玩家听,两边各写一份就会互相撒谎。
import {
  CHAIN_STAGE_CHANCE,
  FORTUNE_CHANCE,
  FORTUNE_RECIPE_FALLBACK_PAGE,
  FORTUNE_RECIPE_FALLBACK_WUDAO,
  FORTUNE_RECIPE_MASTERY,
  INSTANT_EXP_LAYER_CAP,
} from "@/data/constants";
import { pillDef, PILLS } from "@/data/pills";
import { buffDef } from "@/data/buffs";
import { PETS, petDef } from "@/data/pets";
import { qualityDef } from "@/data/qualities";
import { expFromSecs, stoneByTier } from "./formulas";
import { generateEquipment } from "./equipGen";
import { acquireArtifact, acquireEquipment, randomDropArtifact } from "./loot";
import { learnRandomGongfa } from "./gongfaService";
import { discoverRecipe } from "./loreService";
import { fortuneAffinity, rootElements } from "./linggenAffinity";
import { acquirePill, collect, track } from "./progress";
import { recordEvent } from "./worldMemory";
import { recordFortuneChoice } from "./fortuneChain";
import { modOf } from "./statsCalc";
import { deckPool, drawFrom, inBand } from "wanxiang-engine";
import { createChoiceSystem, type ChoiceDef } from "wanxiang-engine";
import { usePlayerStore } from "@/stores/player";
import { useResourcesStore } from "@/stores/resources";
import { useCultivationStore } from "@/stores/cultivation";
import { useAdventureStore } from "@/stores/adventure";
import { useQuestsStore } from "@/stores/quests";
import { RESOURCE_LABELS } from "@/data/resourceNames";

/**
 * 境界带 —— 这条事件在**这一境**还说不说得通。
 *
 * 判据只有一条,全部事件池都读它:minRealm ≤ 当前境界 ≤ maxRealm。
 * 从前只有 minRealm(而且只有普通事件读),于是两个方向都会漏:
 *   漏下去 —— 人间界的乡野小事躺在 'general' 标签里,一路漏到混沌海
 *             (元婴修士被一窝蚂蚁咬成重伤,就是这么来的);
 *   漏上来 —— 机缘(ft_)根本不看境界,只按区域标签选,而神界/混沌海的区域
 *             同样带 'general',于是人间界的丹方/幼兽也漏进道祖的池子。
 * 所以这里是**唯一入口**:谁要挑事件,谁就得先过这道门,不许自己写
 * `ev.minRealm !== undefined && …` 之类的半套判据。
 */
export function eventInRealmBand(
  ev: Pick<EventDef, "minRealm" | "maxRealm">,
  major: number,
): boolean {
  // 区间判定由公共库给(见 packages/engine 的 deck.inBand):两端可省、含端点
  return inBand(major, { min: ev.minRealm, max: ev.maxRealm });
}

/**
 * 事件表 → 牌堆条目(**模块级构建一次**)。
 *
 * 牌堆要的四件事在这里对上库的字段名:等级区间 min/max、场所标签 tags、
 * 一次性 once、权重 weight;奇缘阶段不属于随机池,故在构建时就排除。
 */
const EVENT_DECK = EVENTS.filter((ev) => !chainOfEvent(ev.id)).map((ev) => ({
  def: ev,
  id: ev.id,
  tags: ev.tags,
  weight: ev.weight,
  once: ev.once,
  min: ev.minRealm,
  max: ev.maxRealm,
}));

/** 机缘同样是牌堆(带元素倾向的加权) —— 与普通事件共用库里的那套筛池与抽取 */
const FORTUNE_DECK = FORTUNE_EVENTS.map((ev) => ({
  def: ev,
  id: ev.id,
  tags: ev.tags,
  weight: ev.weight,
  min: ev.minRealm,
  max: ev.maxRealm,
}));

/** 此刻该走的那几程(链条未结、境界够、尚未抽到过) */
export function pendingChainStages(
  major: number,
): { chainId: string; stage: number; event: EventDef }[] {
  const player = usePlayerStore();
  const out: { chainId: string; stage: number; event: EventDef }[] = [];
  for (const chain of CHAINS) {
    const done = player.eventChains[chain.id] ?? 0;
    const eventId = chain.stages[done];
    if (!eventId) continue; // 这条缘已了
    const def = eventDef(eventId);
    if (!def) continue;
    if (!eventInRealmBand(def, major)) continue;
    out.push({ chainId: chain.id, stage: done, event: def });
  }
  return out;
}

/** 从当前该走的几程里掷一程(缘分不分先后,几条链可以并行) */
export function pickChainStageEvent(major: number, rand: RandomService = rng): EventDef | null {
  const pending = pendingChainStages(major);
  if (pending.length === 0) return null;
  return rand.pick(pending).event;
}

/** 奇缘录:已起了头的缘(未起的不列,免得把往后的路先说破) */
export interface ChainProgress {
  id: string;
  name: string;
  hint: string;
  stage: number;
  total: number;
  finished: boolean;
  broken: boolean;
}

export function chainProgressRows(): ChainProgress[] {
  const player = usePlayerStore();
  return CHAINS.map((chain) => {
    const stage = player.eventChains[chain.id] ?? 0;
    return {
      id: chain.id,
      name: chain.name,
      hint: chain.hint,
      stage,
      total: chain.stages.length,
      // 断缘记的是负哨兵:finished 只看正档位,broken 只看负;两者都不是「未起(0)」
      finished: stage >= chain.stages.length,
      broken: stage < 0,
    };
  }).filter((c) => c.stage !== 0);
}

/**
 * 区域事件池 —— **不含奇缘阶段**。
 *
 * 奇缘不属于任何地界:它按链条推进,不按区域标签出现。
 * 抽出来单独成函数,既是为了让"奇缘不漏进随机池"这条契约可测,
 * 也是为了提醒后来者:往池子里加东西之前,先想清楚它属于哪一类。
 */
export function regionEventPoolFor(region: RegionDef): EventDef[] {
  const player = usePlayerStore();
  const adventure = useAdventureStore();
  // 三件事(区间 / 场所标签 / 一次性)由库的牌堆一次筛清;这里只把本作的计数与
  // 已见表递过去。池子保持事件表原序,判据仍能直接问"池子里有谁"。
  return deckPool(EVENT_DECK, {
    level: player.major,
    tags: region.eventTags,
    seen: adventure.seenOnceEvents,
  }).map((e) => e.def);
}

/**
 * 一个事件的悟道点期望 —— 按**实际会走的那条路**算,供经济审计建模用。
 *
 * 为什么需要它:economySim 从前只把藏经阁算作悟道点收入,而悟道点**没有**
 * 战斗或灵田产线 —— 际遇才是它的主源(实测 0~5 境约 20~31/h,藏经阁只有 4~18/h)。
 * 少算这一条会让审计读出「前期缺口 20 倍」这种并不存在的失衡。
 *
 * 口径对齐 `autoResolveEvent`:离线与自动结算走的是**默认项**(没有默认项则第一条),
 * 故这里也只算那一项,不去平均所有选项 —— 否则会高估三倍(实测 0.414 vs 1.35)。
 * 项内按 outcome 的 weight 加权。
 */
export function eventWudaoExpectation(def: EventDef): number {
  const choice = def.choices.find((c) => c.isDefault) ?? def.choices[0];
  if (!choice) return 0;
  const total = choice.outcomes.reduce((s, o) => s + o.weight, 0);
  if (total <= 0) return 0;
  let sum = 0;
  for (const outcome of choice.outcomes) {
    for (const effect of outcome.effects) {
      if (effect.type === "material" && effect.id === "wudao") {
        sum += outcome.weight * effect.amount;
      }
    }
  }
  return sum / total;
}

/**
 * 一趟际遇的悟道点期望 —— 三层概率链都算进去:
 * 奇缘(CHAIN_STAGE_CHANCE)→ 机缘(FORTUNE_CHANCE)→ 普通事件池。
 *
 * 与 `pickEventFor` 的三条分支一一对应;池子按区域标签 + 境界带筛,
 * 不另写一份"哪些事件会出"的判据。奇缘那一路按"该境界全部链事件"取均值 ——
 * 真实选择还看链条进度,那是玩家状态,模型取不到也不该假装取到。
 */
export function eventWudaoPerEncounter(major: number, tags: readonly string[]): number {
  const ctx = { level: major, tags };
  const mean = (pool: EventDef[]): number =>
    pool.length === 0 ? 0 : pool.reduce((s, ev) => s + eventWudaoExpectation(ev), 0) / pool.length;
  const chain = mean(CHAIN_EVENTS.filter((ev) => eventInRealmBand(ev, major)));
  const fortune = mean(deckPool(FORTUNE_DECK, ctx).map((e) => e.def));
  const normal = mean(deckPool(EVENT_DECK, ctx).map((e) => e.def));
  const rest = FORTUNE_CHANCE * fortune + (1 - FORTUNE_CHANCE) * normal;
  return CHAIN_STAGE_CHANCE * chain + (1 - CHAIN_STAGE_CHANCE) * rest;
}

/** 为区域挑选一个事件(rand 可注入,便于测试与模拟) */
export function pickEventFor(region: RegionDef, rand: RandomService = rng): EventDef | null {
  const player = usePlayerStore();
  const adventure = useAdventureStore();
  // Phase 34.2 奇缘:上一程结在哪里,下一程才从哪里起
  if (rand.chance(CHAIN_STAGE_CHANCE)) {
    const chainEvent = pickChainStageEvent(player.major, rand);
    if (chainEvent) return chainEvent;
  }
  // Phase 31 S2:极小概率先判机缘事件(带代价选择)
  if (rand.chance(FORTUNE_CHANCE)) {
    // 机缘同样过境界带:人间界的机缘(丹方/幼兽/剑痕)不该被道祖撞见,
    // 界外的机缘(仙门古琴/神域王座)也不该落进凡界路线 —— 后者在凡界世界生成
    // 的标签池里已经堵住(见 mortalWorldGen),这里再按玩家当前境界收一道。
    // Phase 32.2:同源机缘更容易撞见——灵根在此接入"机缘 → 师承 → 流派"的因果链起点。
    // 非同源机缘权重不变(仍是 ev.weight),没有一条路被灵根关掉。
    const elements = rootElements(player.linggen?.roots);
    const fortune = drawFrom(FORTUNE_DECK, { level: player.major, tags: region.eventTags }, rand, {
      // 「倾向而非门槛」:同源加权,非同源不动 —— 没有一条路被灵根关掉
      weightMultiplier: (entry) => fortuneAffinity(entry.def.element, elements),
    });
    if (fortune) return fortune.def;
  }
  // 抽牌也交给库(权重、全 0 退回均匀等口径在库内);奇缘/机缘两条分支是本作的叙事结构,留在上面
  const drawn = drawFrom(
    EVENT_DECK,
    { level: player.major, tags: region.eventTags, seen: adventure.seenOnceEvents },
    rand,
  );
  return drawn?.def ?? null;
}

/** 选项条件校验 */
export function choiceAvailable(choice: EventChoice, tier: number): boolean {
  const cond = choice.cond;
  if (!cond) return true;
  const player = usePlayerStore();
  const resources = useResourcesStore();
  switch (cond.type) {
    case "realm":
      return player.major >= cond.min;
    case "stone":
      return resources.hasStone(stoneByTier(tier, cond.tierAmount));
    case "element":
      return player.linggen?.roots.some((r) => r.element === cond.el) ?? false;
  }
}

function applyEffect(effect: EventEffect, tier: number): string | null {
  const player = usePlayerStore();
  const resources = useResourcesStore();
  const cultivation = useCultivationStore();
  switch (effect.type) {
    case "stone": {
      const v = stoneByTier(tier, Math.abs(effect.tierAmount));
      if (effect.tierAmount >= 0) {
        resources.addStone(v);
        return `灵石 +${formatGN(v)}`;
      }
      // 入不敷出就拒绝,不「把整份余额奉上」——传余额拷贝会让 gte 恒真、清零收场
      if (!resources.spendStone(v)) return null;
      return `灵石 -${formatGN(v)}`;
    }
    case "exp": {
      // 与丹药、一场遭遇同一把尺子:等效闭关时长,封顶不满一层(见 formulas.expFromSecs)
      const v = expFromSecs(player.expReq, effect.secs, player.cultPerSec, INSTANT_EXP_LAYER_CAP);
      player.gainExp(v);
      return `修为 +${formatGN(v)}`;
    }
    case "material":
      resources.addSmall(effect.id, effect.amount);
      return `${RESOURCE_LABELS[effect.id]} +${effect.amount}`;
    case "equipment": {
      const inst = generateEquipment(Math.max(tier, 1), rng, {
        luck: modOf(player.finalStats.mods, "luck"),
        minQualityRank: effect.minQualityRank,
      });
      return `获得 ${acquireEquipment(inst).line}`;
    }
    case "pill": {
      const id = effect.id ?? randomEventPill(player.major);
      if (!id) return null;
      const def = pillDef(id);
      if (!def) return null;
      acquirePill(id, effect.count);
      return `丹药「${def.name}」×${effect.count}`;
    }
    case "recipe": {
      const found = discoverRecipe(FORTUNE_RECIPE_MASTERY);
      if (found) {
        return `丹方「${found.name}」· 掌握 +${formatPercent(FORTUNE_RECIPE_MASTERY, 0)}`;
      }
      resources.addSmall("wudao", FORTUNE_RECIPE_FALLBACK_WUDAO);
      resources.addSmall("page", FORTUNE_RECIPE_FALLBACK_PAGE);
      return `已识尽可学丹方 · 悟道 +${formatNum(
        FORTUNE_RECIPE_FALLBACK_WUDAO,
      )} · 残页 +${formatNum(FORTUNE_RECIPE_FALLBACK_PAGE)}`;
    }
    case "gongfa": {
      const learnt = learnRandomGongfa(effect.id);
      if (learnt) return `习得功法《${learnt}》`;
      resources.addSmall("page", 10);
      return "功法残页 +10(已尽览此道)";
    }
    case "artifact": {
      const id = effect.id ?? randomDropArtifact(tier);
      if (!id) return null;
      return `获得 ${acquireArtifact(id)}`;
    }
    case "buff": {
      const def = buffDef(effect.id);
      if (!def) return null;
      cultivation.addBuff(effect.id, Date.now());
      return def.kind === "injury" ? `陷入「${def.name}」状态` : `获得「${def.name}」加持`;
    }
    case "lifespan": {
      // 界外一律写比例:金仙的寿元是一亿载,「延寿八百载」那点绝对年数在界外
      // 连零头都算不上,写死数字的文案与账目都会变成谎话(见 EventEffect 注释)。
      const years =
        effect.pct !== undefined
          ? Math.round(realmDef(player.major).lifespanYears * effect.pct)
          : (effect.years ?? 0);
      if (years <= 0) return null;
      player.addLifespan(years);
      return `寿元 +${formatYears(years)}`;
    }
    case "pet": {
      const quests = useQuestsStore();
      const owned = new Set(quests.collections.pet);
      // 随机入账只给无门墙的入门灵兽:仙/神品神兽由高界区域事件**指名**发放
      // (见 data/pets.ts「仙界及以上神兽,仅由高界区域事件发放」),人间界事件不许从全池
      // 白送 —— 否则炼气层就能开出应龙/麒麟,与 contentGate「神兽须行至神界,无绕过路径」相左。
      const pool = PETS.filter(
        (p) => !owned.has(p.id) && p.quality !== "immortal" && p.quality !== "divine",
      );
      const id = effect.id ?? (pool.length ? rng.pick(pool).id : null);
      if (!id || owned.has(id)) {
        resources.addSmall("herb", 10);
        return "灵草 +10";
      }
      collect("pet", id);
      if (!player.petId) player.setPet(id);
      const def = petDef(id);
      return `灵兽「${def?.name ?? ""}」愿意追随于你`;
    }
    case "nothing":
      return null;
  }
}

function randomEventPill(major: number): string | null {
  const pool = PILLS.filter((p) => p.minRealm <= major);
  if (pool.length === 0) return null;
  return rng.weighted(pool, (p) => 100 / (1 + qualityDef(p.quality).rank * 2)).id;
}

export interface EventResolution {
  outcomeText: string;
  lines: string[];
}

/**
 * 事件结算走库的抉择层(见 packages/engine 的 choices):加权掷后果、逐条解释效果、
 * 回执照收;效果怎么解释仍是本作的事(下面那个 `interpret`)。
 */
export const CHOICES = createChoiceSystem<EventEffect, number>({
  interpret: (effect, tier) => applyEffect(effect, tier),
});

/** 本作的选项 → 库认的形状(只差一个"能不能选"的包装) */
export function asChoice(choice: EventChoice, tier: number): ChoiceDef<EventEffect> {
  return {
    label: choice.label,
    hint: choice.hint,
    isDefault: choice.isDefault,
    available: () => choiceAvailable(choice, tier),
    outcomes: choice.outcomes,
  };
}

/** 结算某个选项 */
export function resolveEventChoice(
  def: EventDef,
  choiceIdx: number,
  tier: number,
): EventResolution {
  const adventure = useAdventureStore();
  const resources = useResourcesStore();
  const choice = def.choices[choiceIdx] ?? def.choices[0]!;
  // 会话账:际遇给的悟道(含重复法宝折化)逐次写进这一趟 —— 结束总结才报得出数,离线早用同口径
  const wudaoBefore = resources.wudao;
  const receipt = CHOICES.resolve(asChoice(choice, tier), tier, rng);
  const session = adventure.session;
  const gained = resources.wudao - wudaoBefore;
  if (session && gained > 0) {
    adventure.setSession({ ...session, wudaoGain: session.wudaoGain + gained });
  }
  if (def.once) adventure.markEventSeen(def.id);
  collect("event", def.id);
  track("events");

  // Phase 34.2 奇缘:解了哪一程,就把那条链往前推一程;断了缘,直接记到尽头
  const chain = chainOfEvent(def.id);
  if (chain) {
    const ended = def.choices[choiceIdx]?.endsChain ?? false;
    usePlayerStore().setEventChain(
      chain.chain.id,
      // 断缘记负哨兵,与「走完」区分:奇缘录据此标「缘断」而非「已了」
      ended ? -chain.chain.stages.length : chain.stage + 1,
    );
  }

  // Phase 30.9 S3:记录事件记忆(完成的余波后,未来再遇时有机会触发余波文本)
  adventure.eventMemories = recordEvent(adventure.eventMemories, def.id, choiceIdx, Date.now());
  // Phase 31.1 机缘链:机缘选择记入世界记忆(取/弃,影响未来)
  if (def.id.startsWith("ft_")) {
    const isDefault = def.choices[choiceIdx]?.isDefault ?? false;
    recordFortuneChoice(def.id, isDefault ? "leave" : "take");
  }
  return { outcomeText: receipt.text, lines: receipt.lines };
}

/** 离线/超时自动按默认选项结算 */
export function autoResolveEvent(eventId: string, tier: number): EventResolution | null {
  const def = eventDef(eventId);
  if (!def) return null;
  // 三级兜底(默认且可选 → 第一条可选 → 第一条)由库回答,免得界面与离线各写一遍
  const idx = CHOICES.defaultIndex(
    def.choices.map((c) => asChoice(c, tier)),
    tier,
  );
  return resolveEventChoice(def, idx, tier);
}
