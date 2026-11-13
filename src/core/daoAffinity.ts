/**
 * 道途与打法 —— 择道之前,「这一条和我惯用的打法合不合」。
 *
 * ## 为什么需要这一层
 *
 * 道途**一世只能选一次**(`chooseDaoPath` 见非空即拒),是整世最重、最不可逆的
 * 一个决定。而界面原先只是八张卡并排摊开:玩家既不知道自己是什么打法,
 * 也无法一眼比出八条路的取舍 —— 只能凭 `desc` 那一句风味文字下注。
 *
 * 而「自己是什么打法」这件事早就有答案了:`core/buildSim` 的六种流派形状
 * 与 `core/identity` 的修行画像都在手上。这一层把两者接起来:
 *
 *   惯用打法(六派之一)→ 这条道途与它合不合、合在哪、冲在哪。
 *
 * ## 判据是「词条方向」,不是拍脑袋的分类
 *
 * 每条道途的 `rules.playerExtraMods` 是一份 `StatMods`;六种流派的核心词条也是
 * 一份 `StatMods`。两相比较:
 *
 *   · 同向为正 —— 道途把流派的长处再推一把(罡盾流的内核是 `shieldOnStart` /
 *     `shieldPower`,镇岳道的 `rules` 正好给这两项);
 *   · 反向为负 —— 道途拿走流派赖以立身的东西(剑道的 `damageReduction: -0.1`
 *     对罡盾流是反的)。
 *
 * 故这一层不手写「剑道适合爆发流」这种分类,它读**同一份 mods**。
 * 换一个流派、加一条道途,结论自己会跟着变。
 */
import type { StatMods } from "@/types";
import { DAO_PATHS } from "@/data/endgame";
import { BUILD_PROFILES } from "@/core/buildSim";

/** 一条道途与某个流派的相性 */
export interface DaoAffinity {
  /** 相性评级:合 / 中性 / 冲 */
  verdict: "fits" | "neutral" | "clashes";
  /** 「合在哪」或「冲在哪」—— 直接报词条名,不写「契合度 78%」这种编出来的数 */
  notes: string[];
}

/** mods 里参与对抗的键 —— 全是「越大越好」的正面词条 */
function positiveKeys(mods: StatMods): string[] {
  return Object.entries(mods)
    .filter(([, v]) => typeof v === "number" && (v as number) > 0)
    .map(([k]) => k);
}

/**
 * 某个流派的核心词条 → 这条道途是加强还是拿走。
 *
 * `buildMods` 是流派赖以立身的词条(见 `BUILD_PROFILES[i].mods`);
 * `daoMods` 是道途的 `rules.playerExtraMods`。
 */
export function daoAffinity(buildMods: StatMods, daoMods: StatMods | undefined): DaoAffinity {
  if (!daoMods) return { verdict: "neutral", notes: [] };
  const keys = positiveKeys(buildMods);
  const boosted: string[] = [];
  const taken: string[] = [];
  for (const k of keys) {
    const delta = daoMods[k as keyof StatMods];
    if (typeof delta !== "number") continue;
    if (delta > 0) boosted.push(k);
    /* 负数 = 道途拿走流派赖以立身的那一项(剑道对罡盾流就是这种关系) */
    if (delta < 0) taken.push(k);
  }
  /*
   * 评级只看「被拿走」优先:「拿走立身之本」比「没加成」严重得多 ——
   * 那意味着这条道途与你的打法方向相反,不是「可以试试」。
   */
  const verdict = taken.length > 0 ? "clashes" : boosted.length >= 2 ? "fits" : "neutral";
  return { verdict, notes: taken.length > 0 ? taken : boosted };
}

/** 读某条道途对某个流派(按 id)的相性 */
export function affinityFor(daoId: string, buildId: string): DaoAffinity {
  const dao = DAO_PATHS.find((d) => d.id === daoId);
  const build = BUILD_PROFILES.find((b) => b.id === buildId);
  if (!dao || !build) return { verdict: "neutral", notes: [] };
  return daoAffinity(build.mods, dao.rules.playerExtraMods);
}

/** 六种流派的 id —— 给界面遍历,不手写 */
export const BUILD_IDS = BUILD_PROFILES.map((b) => b.id);

/** 流派 id → 展示名(「罡盾流」),与构筑页同源 */
export function buildNameOf(buildId: string): string | null {
  return BUILD_PROFILES.find((b) => b.id === buildId)?.name ?? null;
}
