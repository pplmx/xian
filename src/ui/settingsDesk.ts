/**
 * 设置页的展示装配。
 *
 * 设置事实仍来自 settings / saveBackup / diag；这里只把「两条声道现在是哪一档」
 * 「备份旧不旧」「留痕满没满」翻成卷首天机盘与三案共用的读数，避免模板里各拼一套。
 */

import { backupAdvice, formatLastExport, type BackupAdvice } from "@/core/saveBackup";

export type SettingsTheme = "auto" | "light" | "dark";

export interface SoundDesk {
  music: number;
  sfx: number;
  active: number;
  level: number;
  quiet: boolean;
  label: string;
}

export interface ThemeDesk {
  label: string;
  mark: string;
  level: number;
}

export interface BackupDesk {
  state: BackupAdvice;
  mark: string;
  label: string;
  detail: string;
  level: number;
}

export interface DiagDesk {
  state: "clear" | "recorded";
  count: number;
  mark: string;
  label: string;
  level: number;
}

/** 音量来自持久化档，坏值不许一路渗到卷首变成 NaN%。 */
export function settingVolume(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

/** 两条声道分开报：关掉的那条写「静」，不拿旧音量冒充正在播放。 */
export function soundDesk(
  musicOn: boolean,
  musicVol: number,
  sfxOn: boolean,
  sfxVol: number,
): SoundDesk {
  const music = settingVolume(musicVol);
  const sfx = settingVolume(sfxVol);
  const active = Number(musicOn) + Number(sfxOn);
  return {
    music,
    sfx,
    active,
    level: (musicOn ? music : 0) / 200 + (sfxOn ? sfx : 0) / 200,
    quiet: active === 0,
    label: `${musicOn ? `乐 ${music}` : "乐静"} · ${sfxOn ? `音 ${sfx}` : "音静"}`,
  };
}

export function themeDesk(theme: SettingsTheme): ThemeDesk {
  if (theme === "light") return { label: "日间", mark: "日", level: 1 };
  if (theme === "dark") return { label: "夜间", mark: "夜", level: 1 };
  return { label: "跟随系统", mark: "随", level: 0.55 };
}

export function backupDesk(lastExportAt: number, now: number): BackupDesk {
  const state = backupAdvice(lastExportAt, now);
  const detail = formatLastExport(lastExportAt, now);
  if (state === "never") {
    return { state, mark: "未", label: "尚未备份", detail, level: 0 };
  }
  if (state === "stale") {
    return { state, mark: "旧", label: "备份已旧", detail, level: 0.45 };
  }
  return { state, mark: "安", label: "备份尚新", detail, level: 1 };
}

export function diagDesk(count: number, max: number): DiagDesk {
  const safeMax = Number.isFinite(max) ? Math.max(0, Math.trunc(max)) : 0;
  const safeCount = Number.isFinite(count) ? Math.min(safeMax, Math.max(0, Math.trunc(count))) : 0;
  return safeCount === 0
    ? {
        state: "clear",
        count: 0,
        mark: "净",
        label: "未留痕",
        level: 0,
      }
    : {
        state: "recorded",
        count: safeCount,
        mark: "录",
        label: `留痕 ${safeCount} 条`,
        level: safeMax > 0 ? safeCount / safeMax : 0,
      };
}
