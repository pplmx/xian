import { describe, expect, it } from "vite-plus/test";
import { noteBeats } from "./audio";

describe("音符时值 → 拍数(noteBeats)", () => {
  it("按 Tone 记法:拍数 = 4 / 分母,与作曲层注释('1n'=4 拍)一致", () => {
    expect(noteBeats("1n")).toBe(4);
    expect(noteBeats("2n")).toBe(2);
    expect(noteBeats("4n")).toBe(1);
  });

  it("多位数分母(16 分/8 分/32 分)不再被截首位", () => {
    expect(noteBeats("8n")).toBe(0.5);
    expect(noteBeats("16n")).toBe(0.25);
    expect(noteBeats("32n")).toBe(0.125);
  });

  it("带点 ×1.5", () => {
    expect(noteBeats("2n.")).toBe(3);
    expect(noteBeats("1n.")).toBe(6);
    expect(noteBeats("4n.")).toBe(1.5);
  });

  it("非法时值兜底 1 拍,不抛", () => {
    expect(noteBeats("n")).toBe(1);
    expect(noteBeats("")).toBe(1);
    expect(noteBeats("x")).toBe(1);
  });
});
