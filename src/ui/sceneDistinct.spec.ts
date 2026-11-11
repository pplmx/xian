/**
 * 九种地形在**实际显示尺寸**下要分得开 —— 接上画不等于画得出来。
 *
 * ## 为什么需要这一条
 *
 * 前 22 轮每加一处画都声称「按身份各取各景」,判据核的却是**取到没取到**
 * (分派函数返不返回、模板接没接上)。从没人量过:那九种地形在真正的条高里
 * (玄枢图卷签 55px、秘境名录 55px)**是不是真的看得出区别**。
 *
 * ## 量的是轮廓,不是路径文本
 *
 * 眼睛读一条山骨读的是**天际线**——每个横坐标上,山有多高。故判据把每条
 * 路径压平成折线(含贝塞尔细分),按 420 列求脊线高度,再比两条脊线的平均落差。
 *
 * 真浏览器实测(采样山骨填充)给出的同一结论:
 *
 *   forest vs palace —— **只差 0.9%**(两片坡在 55px 里读成同一片)
 *
 * 根因:山骨路径是近似复制,forest 与 palace 的点位只差 1~2 个单位。
 * 真正分开它们的是点景(松 vs 塔),而点景在 `:marks="false"` 与 55px 高的条里
 * 被压得看不见 —— 于是「两副长相」在真尺寸下退化成一副。
 *
 * ## 判据守什么
 *
 * 不假装九种两两都远(山骨本来就是同一类折线)。要钉的是**没有两对是近似复制**:
 * 任两条脊线的平均落差要够大,否则这两片山就是抄来的。
 */
import { describe, expect, it } from "vite-plus/test";
import { SCENE_TERRAINS, sceneOf, type SceneTerrain } from "@/ui/sceneTerrain";

type Pt = [number, number];

/** 把一条路径压平成折线:处理 M/L/C/Z(这份表里只用这三种) */
function flatten(d: string): Pt[] {
  const out: Pt[] = [];
  let cx = 0;
  let cy = 0;
  const tokens = d.match(/[MLCZ]|-?\d+(?:\.\d+)?/gi) ?? [];
  let i = 0;
  const num = (): number => Number(tokens[i++]!);
  while (i < tokens.length) {
    const cmd = tokens[i++]!;
    if (cmd === "M" || cmd === "L") {
      cx = num();
      cy = num();
      out.push([cx, cy]);
    } else if (cmd === "C") {
      const x1 = num();
      const y1 = num();
      const x2 = num();
      const y2 = num();
      const x = num();
      const y = num();
      /* 切 12 段就够:这条判据看的是天际线,不是抗锯齿 */
      for (let s = 1; s <= 12; s += 1) {
        const t = s / 12;
        const u = 1 - t;
        out.push([
          u * u * u * cx + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x,
          u * u * u * cy + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y,
        ]);
      }
      cx = x;
      cy = y;
    } else if (cmd === "Z") {
      /* 闭合回起点,轮廓取自 far 与 near 两条,不必补 */
    }
  }
  return out;
}

/**
 * 一种地形的天际线:420 列里,每一列最高的那一点(y 越小越高)。
 *
 * 只取 `far` —— 那是主山骨;`near` 是山脚的一道浅坡,九种几乎都一样,
 * 把它算进来会把差异摊薄(它本来就只是收边)。
 */
function skyline(terrain: SceneTerrain): number[] {
  const pts = flatten(sceneOf(terrain).far);
  const line = new Array(420).fill(160);
  for (const [x, y] of pts) {
    const col = Math.max(0, Math.min(419, Math.round(x)));
    if (y < line[col]!) line[col] = y;
  }
  /* 路径点稀疏处用相邻列线性补,免得把「没采到」当成「很高」 */
  for (let c = 1; c < 420; c += 1) {
    if (line[c] === 160 && line[c - 1] !== 160) line[c] = line[c - 1]!;
  }
  return line;
}

/** 两条天际线的平均落差(SVG 单位,160 是整幅高) */
function ridgeGap(a: SceneTerrain, b: SceneTerrain): number {
  const la = skyline(a);
  const lb = skyline(b);
  let sum = 0;
  for (let c = 0; c < 420; c += 1) sum += Math.abs(la[c]! - lb[c]!);
  return sum / 420;
}

describe("九种地形在实际显示尺寸下要分得开", () => {
  it("没有两对山骨是近似复制 —— 天际线平均落差有下限", () => {
    /*
     * 下限取 3 个 SVG 单位:整幅高 160,3 单位 ≈ 画高的 2%。
     * 低于这个数,两条脊线在 55px 的条里(≈ 每条单位 0.34px)差不到 1px ——
     * 玩家看到的是同一片坡。实测 forest/palace 落在 1 单位上下。
     */
    const tooClose: string[] = [];
    for (let i = 0; i < SCENE_TERRAINS.length; i += 1) {
      for (let j = i + 1; j < SCENE_TERRAINS.length; j += 1) {
        const a = SCENE_TERRAINS[i]!;
        const b = SCENE_TERRAINS[j]!;
        const gap = ridgeGap(a, b);
        if (gap < 3) tooClose.push(`${a}/${b} 天际线只差 ${gap.toFixed(2)} 单位`);
      }
    }
    expect(tooClose, "这几对山骨是近似的 —— 在 55px 的条高里(卷签、秘境名录)读成同一片坡").toEqual(
      [],
    );
  });
});
