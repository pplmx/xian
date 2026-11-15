/**
 * 面壁破执：破得早，所得纯 —— 而不是永远面壁
 *
 * ## 上一轮引入的问题（这一轮量出来的）
 *
 * 第 373 轮加了「面壁破执」这条路：付灵气、清心魔、得一段道心通明。
 * 当时只钉了「面壁必须比静养贵」，没量**面壁相对"继续扛着"划不划算**。
 *
 * 量出来是这样:
 *
 * ```text
 *   心魔 600s × −30%  = 损 180 等效秒（扛满全程）
 *   道心通明 300s × +35% = 得 105 等效秒
 *
 *   剩 600s 面壁  避免 180 + 得 105 = +285
 *   剩 400s 面壁  避免 120 + 得 105 = +225
 *   剩 200s 面壁  避免  60 + 得 105 = +165
 *   剩  60s 面壁  避免  18 + 得 105 = +123
 * ```
 *
 * **每一档都是正收益。** 也就是说:只要身上有心魔，面壁永远是最优解 ——
 * 没有判断，只有一个显而易见的按钮。那叫按钮，不叫取舍。
 *
 * 灵气并不是有效的制衡:m0 灵气回满 111 秒，面壁多付 21% 容量约合 23 秒，
 * 而收益是 123~285 等效秒。
 *
 * ## 这一轮的改法:让所得与"执念深浅"挂钩
 *
 * 修仙题材里，「破执」这件事本来就有早晚之分 —— 心魔初起时一念清明就能勘破，
 * 拖久了执念深种，纵然破了也只余残悟。数据里正好有**两档**现成的:
 *
 * ```text
 *   enlighten_cult_strong  道心通明  300s × +35%  = 105 等效秒
 *   enlighten_cult         静心凝神  600s × +20%  = 120 等效秒（长但缓）
 * ```
 *
 * 故:心魔**剩得多**（执念浅）给 strong，**剩得少**（执念深）给 normal。
 *
 * ```text
 *   刚染上就面壁  避免 180 + 得 105 = +285   ← 最划算
 *   拖到剩 120s   避免  36 + 得 120 = +156   ← 仍不亏，但明显少
 * ```
 *
 * 判据钉的不是"哪一档更划算"，而是**两档确实会随剩余时长切换** ——
 * 只要这一点成立，玩家就有"什么时候面壁"这个判断要做。
 *
 * ## 为什么不用第三种新 buff
 *
 * 两档现成的，语义也分得开（澄澈 / 沉静）。再造一档就是三个名字说同一件事 ——
 * 那正是本仓反复修的那种分叉。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { buffDef } from "@/data/buffs";
import {
  FACEWALL_REWARD_BUFF,
  FACEWALL_REWARD_BUFF_LATE,
  FACE_WALL_SHALLOW_RATIO,
  faceWallRewardFor,
} from "./faceWall";

describe("面壁破执 · 破得早所得纯", () => {
  it("两档报酬都是已有的 buff，且不是同一个", () => {
    expect(FACEWALL_REWARD_BUFF, "浅执那一档换了 id").toBe("enlighten_cult_strong");
    expect(FACEWALL_REWARD_BUFF_LATE, "深执那一档换了 id").toBe("enlighten_cult");
    expect(FACEWALL_REWARD_BUFF, "两档用了同一个 buff —— 那就没有早晚之分").not.toBe(
      FACEWALL_REWARD_BUFF_LATE,
    );
    expect(buffDef(FACEWALL_REWARD_BUFF)?.name).toBe("道心通明");
    expect(buffDef(FACEWALL_REWARD_BUFF_LATE)?.name).toBe("静心凝神");
  });

  it("剩余比例跨过阈值时，报酬会切换 —— 这一条是全部判断的来源", () => {
    /*
     * 若两档永远只出其中一档，玩家就没有"什么时候面壁"这个判断，
     * 那条路又退回成一个显而易见的按钮。
     */
    const fresh = faceWallRewardFor({ remainSec: 600, totalSec: 600 });
    const stale = faceWallRewardFor({ remainSec: 60, totalSec: 600 });
    expect(fresh, "刚染上就面壁，给的却不是强档").toBe(FACEWALL_REWARD_BUFF);
    expect(stale, "拖到快散了，给的却还是强档 —— 早晚没有区别").toBe(FACEWALL_REWARD_BUFF_LATE);
  });

  it("阈值落在中间 —— 太靠边会让其中一档几乎不出现", () => {
    expect(FACE_WALL_SHALLOW_RATIO, "阈值太低，强档几乎拿不到").toBeGreaterThan(0.25);
    expect(FACE_WALL_SHALLOW_RATIO, "阈值太高，弱档几乎拿不到").toBeLessThan(0.75);
  });

  it("边界不会崩：剩余比总量还多、或已经归零", () => {
    /*
     * 这两种输入现实里不该出现（剩余时长取自 buff 的 endsAt），
     * 但读数函数若在坏输入上算出 NaN，界面会印出「NaN%」。
     */
    expect(() => faceWallRewardFor({ remainSec: 999, totalSec: 600 })).not.toThrow();
    expect(faceWallRewardFor({ remainSec: 0, totalSec: 600 })).toBe(FACEWALL_REWARD_BUFF_LATE);
    expect(faceWallRewardFor({ remainSec: NaN, totalSec: 600 }), "坏输入给了强档").toBe(
      FACEWALL_REWARD_BUFF_LATE,
    );
  });

  it("界面读的是这个函数，而不是写死一档", () => {
    /*
     * 与 `deadExportAudit` 同一条:一个只有判据在调的函数就是骨架空转。
     * 同时钉住「不许在视图里自己判一次剩余比例」—— 那会变成第二份口径。
     */
    const view = readSource("src/views/CultivationView.vue");
    expect(view, "修行页没有读 faceWallRewardFor —— 早晚之分玩家看不到").toContain(
      "faceWallRewardFor",
    );
  });
});
