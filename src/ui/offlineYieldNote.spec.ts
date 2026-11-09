/**
 * 洞府「每时藏收」· 要说清它是不是离线实际到手的那一份
 *
 * ## 缺口:页面上的速率是**全额**,离线结算是 **9 折**
 *
 * 洞府页的「每时藏收」由 `core/engineFacilities.hourlyYieldText` 给出,读的是
 * `buildingRates(levels)` —— **全额速率**,与实时 accrual 同源。
 *
 * 而离线结算(`core/offline`)对材料/钻研/历练恒有 `OFFLINE_EFFICIENCY = 0.9` 的挂机折扣。
 * `offline.ts` 的注释自己就点出了这件事:
 *
 * ```text
 *   挂机折扣是**恒有的**(每天离线都按 9 折折算材料/钻研/历练),不是封顶才发生的事;
 *   只在超限时提一句,绝大多数短离拿到 9 折产出却以为"少了点什么",就把机制藏起来了。
 * ```
 *
 * 也就是说:机制那边承认「藏起来了」,只在**超限**的归来卷轴上才提。可这一页就在
 * 玩家眼前摆着「每时藏收 灵草 30 株」,他乘 72 小时算出一个数,实际到手是 2160×0.9。
 * 而「离线能攒多久」「攒满是多少」正是这一页帮玩家做的决定。
 *
 * ## 补什么:一句限定,不重算一遍
 *
 * 不去改 `hourlyYieldText` 的数值(它是实时 accrual 的真值,离线的 9 折只在**离线**
 * 那一侧发生)。只在这一行后面加一句说明:在线/实时按全额,离线挂机按 N 折。
 * 折数读 `OFFLINE_EFFICIENCY` 那个常数,**不写死 9** —— 改常数时文案会自己跟上。
 *
 * ## 与归来卷轴不重复
 *
 * 归来卷轴说的是「**这一次**离府拿到了什么、有没有被上限截住」;这一句说的是
 * 「**这个数**在离线时是多少」—— 一个是事后回执,一个是事前口径。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { OFFLINE_EFFICIENCY } from "@/data/constants";
import { offlineYieldNote } from "./offlineYieldNote";

const view = () => readSource("src/views/DongfuView.vue");

describe("离线口径 · 纯函数", () => {
  it("折数读常量,不写死数字", () => {
    const note = offlineYieldNote();
    expect(note).toContain(String(OFFLINE_EFFICIENCY * 10));
  });

  it("说清两件事:实时按全额、离线按折", () => {
    const note = offlineYieldNote();
    expect(note, "要说清实时是全额").toMatch(/实时|在线/);
    expect(note, "要说清离线打折").toMatch(/离线/);
  });

  it("**不复述**下面「离线存续」那一格已经说过的话", () => {
    /*
     * 同一页的「离线存续」区已经写着「修为与灵气全额计入;材料、钻研与历练按 N 折挂机」。
     * 那一格管的是**上限**;这一句只该补「每时藏收」那个速率缺的半句 ——
     * 再写一遍同一句就是同一事实在同一页说两遍,正是本仓「不做两本账」要避免的。
     *
     * 故这一句里**不许**再出现「修为」「灵气」—— 那两样打不打折归下面那一格讲;
     * 但它必须把读者**指向**那一格,不能只说「会打折」就完。
     */
    const note = offlineYieldNote();
    expect(note, "别复述修为/灵气那半句 —— 下面那一格已经说了").not.toMatch(/修为|灵气/);
    expect(note, "要指向具体的去处,别只说「会打折」").toMatch(
      /离线存续|离线存续档位|下方|下面|下「/,
    );
  });

  it("措辞不吓人:它只是一个口径,不是损失警告", () => {
    const note = offlineYieldNote();
    for (const banned of ["损失", "扣减", "惩罚", "惩罚"]) {
      expect(note, `离线口径写成了损失警告(「${banned}」)`).not.toContain(banned);
    }
  });
});

describe("洞府页 · 把口径接在每时藏收旁边", () => {
  it("那一行旁边有口径说明,且给出稳定落点", () => {
    const src = view();
    const at = src.indexOf("每时藏收");
    expect(at, "找不到每时藏收 —— 判据会空转").toBeGreaterThan(0);
    const near = src.slice(Math.max(0, at - 600), at + 1600);
    expect(near, "每时藏收旁要说明离线口径").toContain("data-hourly-yield-note");
    expect(near, "要走那个纯函数").toContain("offlineYieldNote(");
  });

  it("折数不写死在视图里", () => {
    const src = view();
    const at = src.indexOf("data-hourly-yield-note");
    const near = src.slice(Math.max(0, at - 900), at + 900).replace(/<!--[\s\S]*?-->/g, "");
    // 视图里不许出现字面的「9 折」—— 那会在改常数时撒谎
    expect(near, "视图里不许写死「9 折」").not.toMatch(/9\s*折/);
  });
});
