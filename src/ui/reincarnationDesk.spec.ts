import { describe, expect, it } from "vite-plus/test";
import { HERITAGE } from "@/core/samsaraAudit";
import {
  REINCARNATION_STAGES,
  criticalSamsaraRows,
  reincarnationConfirmGate,
  reincarnationStageState,
  samsaraBalance,
  samsaraLedger,
} from "./reincarnationDesk";

describe("往生三程 · 界面装配只读结算真值", () => {
  it("三程固定为辞世、回照、择生,且只允许一条当前程", () => {
    expect(REINCARNATION_STAGES.map((stage) => stage.name)).toEqual(["辞世", "回照", "择生"]);
    expect(REINCARNATION_STAGES.map((_, index) => reincarnationStageState(index + 1, 2))).toEqual([
      "done",
      "current",
      "upcoming",
    ]);
    expect(reincarnationStageState(1, 1)).toBe("current");
    expect(reincarnationStageState(3, 1)).toBe("upcoming");
  });

  it("留折散与全账都从 HERITAGE 现算,不另抄一份清单", () => {
    const ledger = samsaraLedger();
    const balance = samsaraBalance(ledger);
    const ids = ledger.flatMap((group) => group.rows.map((row) => row.id));

    expect(ledger.map((group) => group.mode)).toEqual(["full", "partial", "reset"]);
    expect(ids).toHaveLength(HERITAGE.length);
    expect(new Set(ids).size).toBe(HERITAGE.length);
    expect(balance.full).toBe(HERITAGE.filter((row) => row.mode === "full").length);
    expect(balance.partial).toBe(HERITAGE.filter((row) => row.mode === "partial").length);
    expect(balance.reset).toBe(HERITAGE.filter((row) => row.mode === "reset").length);
    expect(balance.keep).toBe(balance.full + balance.partial);
    expect(balance.total).toBe(HERITAGE.length);
  });

  it("主要损失取折损与高战力归尘项,并带结算明细", () => {
    const critical = criticalSamsaraRows();
    const ids = new Set(critical.map((row) => row.id));

    expect(ids).toContain("gongfa");
    expect(ids).toContain("artifacts");
    expect(ids).toContain("realm");
    expect(ids).toContain("linggen");
    expect(critical.every((row) => row.mode === "partial" || row.power === "high")).toBe(true);
    expect(critical.every((row) => row.detail.length > 0 && row.groupTitle.length > 0)).toBe(true);
  });

  it("先择先天之姿才放行;姿池抽空时仍能落子", () => {
    expect(reincarnationConfirmGate(3, null)).toMatchObject({
      disabled: true,
      state: "blocked",
    });
    expect(reincarnationConfirmGate(3, null).short).toContain("先择");
    expect(reincarnationConfirmGate(3, "t_jianxin")).toMatchObject({
      disabled: false,
      state: "ready",
    });
    expect(reincarnationConfirmGate(0, null)).toMatchObject({
      disabled: false,
      state: "empty",
    });
    expect(reincarnationConfirmGate(0, null).short).toContain("可直接落子");
  });
});
