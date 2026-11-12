/**
 * 审计里的地形要么稳定,要么标明它会变 —— 不许把随机结果当判据。
 *
 * ## 这是实测出来的
 *
 * `scripts/sceneAudit.json` 是 `ui/mastheadScene` 的判据输入,但它由真浏览器跑一遍生成。
 * 同一条命令连跑三次,`/world` 与 `/adventure` 的 `terrains` 分别是
 * `peaks` / `forest` / `ruin` —— 而那两条路由的取景读的是
 * `adventure.currentRegion?.icon`,会话没定下来时会退回「本世第一个地界」,
 * 也就是每次随机生成的世界里的第一处。于是:
 *   · 把 `sceneAudit.json` 提交进仓库,提交的是一个**随机快照**;
 *   · 下一个人重跑审计,总会看到一份「和仓库不一样」的 diff,却没人能说清哪份对;
 *   · 若哪天判据开始读 `terrains`,它读到的就是掷骰子的结果。
 *
 * ## 判据守什么
 *
 * 审计给每条路由记一个 `stable` 标记。不稳定的那几条,`terrains` 只作参考,
 * 判据不读;稳定的那几条才允许被读。这一条钉的是**产物本身如实**:
 * 凡标了 `stable: true` 的,`terrains` 必须非空且不含兜底值之外的随机痕迹。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

interface Row {
  route: string;
  scenes: number;
  terrains: string[];
  minH: number;
  stable?: boolean;
}

const rows = JSON.parse(readSource("scripts/sceneAudit.json")) as Row[];

describe("场景审计的产物要如实", () => {
  it("每条路由都标了稳定与否", () => {
    const unmarked = rows.filter((r) => typeof r.stable !== "boolean").map((r) => r.route);
    expect(
      unmarked,
      "这些路由没标 stable —— 「这条地形是确定的还是掷骰子的」必须写下来,不能让人猜",
    ).toEqual([]);
  });

  it("标了稳定的,地形必须非空", () => {
    const bad = rows.filter((r) => r.stable && r.terrains.length === 0).map((r) => r.route);
    expect(bad, "标了 stable 却量不到地形 —— 标记得撒谎").toEqual([]);
  });

  it("已知不稳的那两条,不许标成稳定", () => {
    /*
     * `/world` 与 `/adventure` 的取景读当前所在的地界(会话没定则取本世第一处),
     * 而那一处由世界生成决定 —— 实测连跑三次得到三种地形。
     * 这一条把它们钉成**必须**标 unstable:哪天有人顺手改成 true,
     * 判据要能问出「你凭什么说它稳定」。
     */
    const byRoute = new Map(rows.map((r) => [r.route, r]));
    for (const route of ["/world", "/adventure"]) {
      const row = byRoute.get(route);
      expect(row, `审计里没有 ${route}`).toBeTruthy();
      expect(row!.stable, `${route} 的地形随生成的世界变,不能标成稳定`).toBe(false);
    }
  });

  it("审计脚本把 stable 写进产物", () => {
    const src = readSource("scripts/audit-scenes.mjs");
    expect(src, "脚本要显式声明哪些路由稳定 —— 而不是把一切都当确定").toMatch(/stable/);
  });
});
