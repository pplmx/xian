/**
 * 神通的节拍 —— 一件法宝多久出手一次,要写在它的说明里。
 *
 * 判据六组:
 *   一 三种说法:≤1 读「随身常在」、2 读「每 2 回合」、更大读「每 N 回合」;
 *   二 与数据同源:44 件法宝各自的节拍都读得出来,不另存一份表;
 *   三 随身常在的那件不许被写成「每 1 回合」(那是相反的意思);
 *   四 坏值按常在处理 —— 0 在战斗里是 `round % 0` 的 bug,不该被文案编成回合数;
 *   五 真接线:法宝谱把节拍摆出来;
 *   六 不重复:desc 已经说了「常在」的那件,节拍那半句该能省略。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { ARTIFACTS } from "@/data/artifacts";
import { artifactBeatIsAlways, artifactBeatText } from "./artifactBeat";

const withInterval = (interval: number) => ({ active: { interval } }) as never;

describe("神通的节拍 · 三种说法", () => {
  it("间隔 1 读「随身常在」,不读「每 1 回合」", () => {
    expect(artifactBeatText(withInterval(1))).toBe("随身常在");
    expect(artifactBeatText(withInterval(1))).not.toContain("每");
  });

  it("间隔 2 读「每 2 回合」", () => {
    expect(artifactBeatText(withInterval(2))).toBe("每 2 回合");
  });

  it("间隔更大时照实报那个数", () => {
    expect(artifactBeatText(withInterval(3))).toBe("每 3 回合");
    expect(artifactBeatText(withInterval(4))).toBe("每 4 回合");
    expect(artifactBeatText(withInterval(12))).toBe("每 12 回合");
  });

  it("小数向下取整 —— 回合数是整数", () => {
    expect(artifactBeatText(withInterval(3.9))).toBe("每 3 回合");
  });
});

describe("神通的节拍 · 坏值按常在", () => {
  it("0 / 负 / NaN 都读「随身常在」,不编一个回合数", () => {
    for (const bad of [0, -3, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(artifactBeatText(withInterval(bad)), `${bad} 被读成了节拍`).toBe("随身常在");
    }
  });

  it("缺字段也不抛", () => {
    expect(artifactBeatText({ active: {} } as never)).toBe("随身常在");
    expect(artifactBeatText({} as never)).toBe("随身常在");
  });
});

describe("神通的节拍 · 与数据同源", () => {
  it("44 件法宝各自的节拍都读得出来,且都是那三种说法之一", () => {
    expect(ARTIFACTS.length).toBeGreaterThan(40);
    for (const def of ARTIFACTS) {
      const text = artifactBeatText(def);
      expect(/^(随身常在|每 \d+ 回合)$/.test(text), `${def.name} 的节拍读成了 «${text}»`).toBe(
        true,
      );
    }
  });

  it("节拍分布是真实的:每 3 / 每 4 回合各占一批,随身常在只有一件", () => {
    const counts = new Map<string, number>();
    for (const def of ARTIFACTS) {
      const text = artifactBeatText(def);
      counts.set(text, (counts.get(text) ?? 0) + 1);
    }
    expect(counts.get("每 4 回合") ?? 0, "每 4 回合那一档不见了").toBeGreaterThan(10);
    expect(counts.get("每 3 回合") ?? 0, "每 3 回合那一档不见了").toBeGreaterThan(10);
    expect(counts.get("随身常在") ?? 0, "随身常在的那一件不见了").toBe(1);
  });

  it("谓词与文案同一份判定", () => {
    for (const def of ARTIFACTS) {
      expect(artifactBeatIsAlways(def)).toBe(artifactBeatText(def) === "随身常在");
    }
  });
});

describe("神通的节拍 · 真接线", () => {
  it("法宝谱把节拍摆出来", () => {
    const panel = readSource("src/components/inventory/ArtifactPanel.vue");
    expect(panel, "法宝谱要读节拍").toContain("artifactBeatText(");
    expect(panel, "要有稳定落点供真浏览器复核").toContain("data-artifact-beat");
  });

  it("法宝详情弹窗也读同一份 —— 图鉴与实物不各说一句", () => {
    const codex = readSource("src/ui/codex.ts");
    expect(codex, "图鉴条目也要报节拍").toContain("artifactBeatText(");
  });
});
