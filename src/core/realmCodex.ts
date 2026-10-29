import { MAX_MAJOR, REALMS, WORLDS, realmDef, worldOf } from "@/data/realms";
import type { WorldDef } from "@/data/realms";
import type { RealmDef } from "@/types";

export type RealmWorldState = "past" | "current" | "future";

export interface RealmCodexWorldRow {
  world: WorldDef;
  realms: { def: RealmDef; index: number }[];
  state: RealmWorldState;
  /** 此界已行至第几境(未至为 0,已渡为总境数) */
  entered: number;
  total: number;
}

export interface RealmCodexLink {
  index: number;
  def: RealmDef;
}

export interface RealmCodexCurrent {
  index: number;
  def: RealmDef;
  world: WorldDef;
  /** 全仙路第几境(1 起) */
  globalPosition: number;
  /** 本界第几境(1 起) */
  worldPosition: number;
  worldTotal: number;
  previous: RealmCodexLink | null;
  next: RealmCodexLink | null;
}

function clampMajor(major: number): number {
  if (!Number.isFinite(major)) return 0;
  return Math.max(0, Math.min(MAX_MAJOR, Math.trunc(major)));
}

/** 四界卷目:每界带上「已渡 / 当前 / 未至」与已行境数,全部从 REALMS / WORLDS 推出来。 */
export function realmCodexWorldRows(major: number): RealmCodexWorldRow[] {
  const current = clampMajor(major);
  return WORLDS.map((world) => {
    const realms = REALMS.map((def, index) => ({ def, index })).filter(
      (cell) => cell.index >= world.start && cell.index <= world.end,
    );
    const total = world.end - world.start + 1;
    const entered =
      current < world.start ? 0 : current > world.end ? total : current - world.start + 1;
    const state: RealmWorldState =
      current < world.start ? "future" : current > world.end ? "past" : "current";
    return { world, realms, state, entered, total };
  });
}

/** 卷首只报此刻:当前境、所在界、全路序号与前/后两境。 */
export function realmCodexCurrent(major: number): RealmCodexCurrent {
  const index = clampMajor(major);
  const world = worldOf(index);
  return {
    index,
    def: realmDef(index),
    world,
    globalPosition: index + 1,
    worldPosition: index - world.start + 1,
    worldTotal: world.end - world.start + 1,
    previous: index > 0 ? { index: index - 1, def: REALMS[index - 1]! } : null,
    next: index < MAX_MAJOR ? { index: index + 1, def: REALMS[index + 1]! } : null,
  };
}

/** 卷目标签:已渡报整卷,当前报行至几境,未至只报未至。 */
export function realmCodexWorldStatus(row: RealmCodexWorldRow): string {
  if (row.state === "past") return `已渡 ${row.total}/${row.total}`;
  if (row.state === "future") return "未至";
  return `行至 ${row.entered}/${row.total}`;
}

/** 初次展开只开当前界;其余三卷收着,让卷首与眼下这一卷先落到首屏。 */
export function realmCodexInitialWorld(major: number): string {
  return worldOf(clampMajor(major)).id;
}
