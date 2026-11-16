/**
 * 寻机缘的丹：等级只许把它抬高，不许把它扳回去。
 *
 * ## 缺口（本轮实测确认）
 *
 * `pickSeekPill` 原先取 `src[(level * 7) % src.length]` —— **在池长上循环取模**。
 * 池子是按强度大致递增排的，于是等级一涨，取到的位置就可能绕回池头：
 *
 * ```text
 *   境 10，弟子等级 1..20 依次拿到的丹
 *   Lv13 → 真仙丹   （minRealm 9，仙品）
 *   Lv14 → 定心丹   （minRealm 4，玄品）     ← 升了一级，丹退了三档
 *   Lv20 → 凝神丹   （minRealm 0，良品）     ← 又落回池头
 * ```
 *
 * 20 级里 **8 级是退步** —— 一个叫「升级」的动作有近一半的步子在往下走，
 * 而界面把等级当正数在报。
 *
 * ## 一份只改一半的修法（记下来，免得下一个人重犯）
 *
 * 第一次改的是「取模的分母从全池长换成候选区长」：
 *
 * ```ts
 * const capacity = Math.max(3, Math.min(ordered.length, 3 + level));
 * const idx = (level * 7) % capacity;
 * ```
 *
 * 退步从 8 次降到 3 次，而**它不可能降到 0**：`%` 的定义就是超过分母从头开始。
 * 只要分母有限，升级就必然有退步的那一级。
 *
 * 正解是不用取模：把等级**线性映射**到池子的后一段，`level` 单调则名次单调。
 *
 * ## 判据守什么
 *
 * ① 同一境界下，等级 1→20 拿到的丹品阶**单调不降**（这是本轮修的那件事）；
 * ② 等级真的抬得动它 —— 否则「不许降」用一条常数池也能满足，那是把机制删掉；
 * ③ 境界门不许破 —— 拾到的丹 `minRealm` 恒 ≤ 当前境界；
 * ④ 确定性 —— 同一 (境界, 等级) 两次问得同一味（预览与结算要逐位相等）。
 */
import { describe, expect, it } from "vite-plus/test";
import { apprenticeSpoils } from "./apprenticeService";
import { PILLS, pillDef } from "@/data/pills";
import { QUALITIES } from "@/data/qualities";
import { APPRENTICE_MAX_LEVEL } from "@/data/apprentices";
import { MAX_MAJOR } from "@/data/realms";

/** 品阶档位 —— 认不出的按最低档（与实现同一口径：宁可低估，不越界） */
function rankOf(quality: string | undefined): number {
  const i = QUALITIES.findIndex((q) => q.id === quality);
  return i < 0 ? 0 : i;
}

/** 某境界下，弟子等级 1..MAX 依次拿到的丹的品阶档 */
function ranksAt(
  major: number,
  archId = "ap_lingtong",
): { level: number; rank: number; id: string }[] {
  const out: { level: number; rank: number; id: string }[] = [];
  for (let level = 1; level <= APPRENTICE_MAX_LEVEL; level += 1) {
    const spoils = apprenticeSpoils(archId, "seek", major, level);
    const id = spoils.pillId!;
    out.push({ level, rank: rankOf(pillDef(id)?.quality), id });
  }
  return out;
}

describe("寻机缘 · 等级只许抬，不许降", () => {
  it("每个境界、1→满级，品阶单调不降", () => {
    /*
     * 取一串境界（含 0 与最高）：境界决定池子大小，而池子大小正是取模绕回幅度
     * 的来源 —— 只在某个境界上验会漏掉别的池长。
     */
    const majors = [0, 1, 3, 5, 8, 10, 12, 15, 18, MAX_MAJOR];
    for (const major of majors) {
      const rows = ranksAt(major);
      const drops: string[] = [];
      for (let i = 1; i < rows.length; i += 1) {
        if (rows[i]!.rank < rows[i - 1]!.rank) {
          drops.push(
            `Lv${rows[i - 1]!.level}(${pillDef(rows[i - 1]!.id)?.name}·档${rows[i - 1]!.rank}) → ` +
              `Lv${rows[i]!.level}(${pillDef(rows[i]!.id)?.name}·档${rows[i]!.rank})`,
          );
        }
      }
      expect(
        drops,
        `境 ${major}：弟子升一级而丹变差了 —— 而界面把等级当正数在报：${drops.join(" / ")}`,
      ).toEqual([]);
    }
  });

  it("等级真的抬得动它 —— 不许用一条常数池来满足上面那条", () => {
    /*
     * 「单调不降」有一个平凡的满足方式：永远给同一味丹。
     * 那等于把「练得越久，能摸到的东西越往后」这个机制删掉。
     * 故这里要求满级拿到的**确实比 1 级强**，且在至少多数境界上成立。
     */
    let improved = 0;
    const majors = [0, 3, 5, 8, 10, 12, 15, 18, MAX_MAJOR];
    for (const major of majors) {
      const rows = ranksAt(major);
      if (rows[rows.length - 1]!.rank > rows[0]!.rank) improved += 1;
    }
    expect(
      improved,
      `只有 ${improved}/${majors.length} 个境界上「满级比 1 级强」—— 等级对产出的作用被抹平了`,
    ).toBeGreaterThanOrEqual(majors.length - 1);
  });

  it("境界门不许破：拾到的丹 minRealm 恒 ≤ 当前境界", () => {
    /*
     * 这一条在改动前就成立（`pool` 已按 `minRealm <= major` 过滤），
     * 而本轮重写了取丹的位置 —— 凡是重写「从哪个池子里取」的改动，都要重新钉一次门。
     * 开局药童拾到高阶丹会把境界门槛抄了近路。
     */
    for (const major of [0, 1, 5, 10, 15, MAX_MAJOR]) {
      for (const row of ranksAt(major)) {
        const def = pillDef(row.id);
        expect(def, `境 ${major} Lv${row.level}：取到一枚不存在的丹 ${row.id}`).toBeDefined();
        expect(
          def!.minRealm,
          `境 ${major} Lv${row.level}：拾到了 minRealm ${def!.minRealm} 的「${def!.name}」—— 越过了境界门`,
        ).toBeLessThanOrEqual(major);
      }
    }
  });

  it("确定性：同一 (境界, 等级) 两次问得同一味", () => {
    /*
     * 预览与结算逐位相等是这一门的前提（界面那行标的是确定值，不标「~」）。
     * 若哪天有人把这条换成随机，预览会开始撒谎，而两处都能跑。
     */
    for (const major of [0, 7, 14, MAX_MAJOR]) {
      for (const level of [1, 5, 13, APPRENTICE_MAX_LEVEL]) {
        const a = apprenticeSpoils("ap_lingtong", "seek", major, level).pillId;
        const b = apprenticeSpoils("ap_lingtong", "seek", major, level).pillId;
        expect(a, `境 ${major} Lv${level} 两次取丹不一致`).toBe(b);
      }
    }
  });

  it("池子里的丹都是可炼的 —— 寻机缘不给丹方之外的丹", () => {
    // 与改动前的口径一致：只从有 `recipe.stoneBase` 的那批里取
    const craftable = new Set(PILLS.filter((p) => p.recipe?.stoneBase != null).map((p) => p.id));
    for (const major of [0, 10, MAX_MAJOR]) {
      for (const row of ranksAt(major)) {
        expect(craftable.has(row.id), `境 ${major} Lv${row.level}：取到不可炼的丹 ${row.id}`).toBe(
          true,
        );
      }
    }
  });
});
