/**
 * 点景的两半:天上那批压字,地上那批才是认得出的记号。
 *
 * ## 为什么需要中间档
 *
 * `:marks="false"` 的既定理由是「那一格底下压着别人的字,点景落在字上两边都读不清」。
 * 但点景其实分两半(实测 49 枚的 y 分布):
 *
 *   y ≤ 79   —— 30 枚(61%):月、日、云、鸟、雪、碎晶、火星(半空)
 *   y ≥ 100  —— 19 枚:松、塔、舟、水纹、断柱
 *
 * 压字的主要是**天上那批**(它们落在画的上半,而正文从上往下排);
 * 地上那批贴着山脚,几乎是画面最下缘,压不到字 —— 而恰恰是它们
 * (松 / 塔 / 舟 / 柱)把九个柜屉、五枚卷签分了开来。
 *
 * 前 23 轮里我只给了「全画」与「全不画」两档,于是 21 处调用点全用了关,
 * 那些地方的画退化成一道淡墨坡。实测九柜藏珍:九只屉的点景数**全是 0**,
 * 画在截图里就是同一片坡 —— 上一轮把天际线拉开补了一点,但那是补救,
 * 不是这一档该有的样子。
 *
 * ## 判据守什么
 *
 *   一 `marks="ground"` 只画地上那批,天空那批一枚不画;
 *   二 地上那批**确实非空**(否则等于第二档 false,白加一档);
 *   三 地面点景贴下缘 —— 它的 y 要落在画的下半,压不到自上而下的正文。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { SCENE_TERRAINS, sceneOf, sceneAccentInFront } from "@/ui/sceneTerrain";

const SCENE = "src/components/common/InkScene.vue";

describe("点景的中间档 —— 只画地上那批", () => {
  it("九种地形都有地面点景,且都在画的下半", () => {
    for (const terrain of SCENE_TERRAINS) {
      const ground = sceneOf(terrain).accents.filter((a) => sceneAccentInFront(a.kind));
      expect(ground.length, `${terrain} 一枚地面点景都没有 —— 中间档对它等于全关`).toBeGreaterThan(
        0,
      );
      for (const a of ground) {
        /*
         * 门槛落在**画的中线**(160/2 = 80)再往下一点:地面点景要压在山脚一带。
         * 取 84 而不是 96 —— 火星这类「飘着的」最高到 62,但它属于地面层
         * (它是火域唯一的记号,拉到山脚就读成篝火了);而正文压的是画的上半,
         * 84 已经在中线以下。
         */
        expect(
          a.y,
          `${terrain} 的 ${a.kind} 落在 y=${a.y} —— 那是画的上半,正文正压在那里`,
        ).toBeGreaterThanOrEqual(84);
      }
    }
  });

  it("天空那批与地上那批不重叠 —— 两半合起来才是全部", () => {
    for (const terrain of SCENE_TERRAINS) {
      const all = sceneOf(terrain).accents;
      const ground = all.filter((a) => sceneAccentInFront(a.kind));
      const sky = all.filter((a) => !sceneAccentInFront(a.kind));
      expect(ground.length + sky.length, `${terrain} 两半加起来不等于全部`).toBe(all.length);
      /*
       * 天空那批必须真的在上半 —— 否则「只关天空」这个档名就是假的。
       * 留 4 个单位的余量(画高 160,中点 80)。
       */
      for (const a of sky) {
        expect(a.y, `${terrain} 的 ${a.kind} 在 y=${a.y},不像「天上的」`).toBeLessThan(84);
      }
    }
  });

  it("组件认这一档,且不画天空那批", () => {
    const src = readSource(SCENE);
    /*
     * `marks` 要从 boolean 变成三档。钉的是:类型里出现 "ground",
     * 且两批点景各自按这一档过滤 —— 光加类型不接线等于白加。
     */
    expect(src, "marks 要有中间档").toMatch(/marks\?:\s*[^;\n]*"ground"/);
    /*
     * 两批的过滤条件可以就地写,也可以先抽成 `drawSky` / `drawGround` 两个开关
     * (实现里抽了)。故判据取**整段计算属性区块**,而不是某一个 const ——
     * 钉的是「天空那批读这一档、地面那批不读」。
     */
    const block =
      src.match(/const drawSky[\s\S]*?const groundAccents = computed\(\(\)[\s\S]*?\);/)?.[0] ??
      src.match(
        /const skyAccents = computed\(\(\)[\s\S]*?const groundAccents = computed\(\(\)[\s\S]*?\);/,
      )?.[0] ??
      "";
    expect(block, "定位不到点景过滤那一段 —— 判据会空转").not.toBe("");
    /*
     * 天空那批的开关里必须有 `"ground"` —— 那是本轮的档名;
     * 地面那批的开关里**不许**出现它(否则中间档与 false 就没区别了)。
     */
    /*
     * 切在 `drawGround` 那一行上,不是 `groundAccents`:`drawGround` 才是「地面那批判不判」
     * 的开关,而它写在 `groundAccents` 之前(先算开关再算数组)。
     */
    const cut = block.includes("const drawGround")
      ? block.indexOf("const drawGround")
      : block.indexOf("const groundAccents");
    const skyPart = block.slice(0, cut);
    const groundPart = block.slice(cut);
    expect(skyPart, "天空那批在中间档要关掉").toContain('"ground"');
    /*
     * 地面那批**不许**像天空那批那样按档位收窄 —— 只查「不含 ground」不够:
     * 把开关改成 `props.marks === true || props.marks === "both"`(即中间档不画地面),
     * 里面同样不含 "ground",判据绿着(实测漏掉的就是这一种)。
     *
     * 故钉的是**它的开条件**:地面那批只在 `marks === false` 时关,
     * 其余档位一律画 —— 字面就是 `!== false`。
     */
    expect(groundPart, "地面那批只在 false 时关,中间档要照画").toMatch(
      /props\.marks\s*!==\s*false/,
    );
  });
});
