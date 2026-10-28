/**
 * 本世之界的存档修形。
 *
 * 世界不是一串纯展示字段:路线决定准入,节点决定敌人与事件。只检查
 * 「mortalWorld 是对象」会把空链、重复节点和坏层级原样带进渲染与战斗。
 * 这里按生成器的不变量重建一份可用的世界:
 *
 * - 静态素材(区域名、敌人、规则、骨架名)从当前数据表重新取,存档只提供选择;
 * - 任一引用已不存在、id 重复或数值越界,整界作废 —— 半截世界比没有世界更难救;
 * - 完整世界经 JSON 往返后必须逐字段等价,不能因为修形悄悄换掉玩家的路线。
 */
import type { MortalPlace, MortalWorld } from "./mortalWorldGen";
import { RHYTHM_ARCHETYPES, ROUTE_SHAPES } from "./mortalRouteShapes";
import { BIAS_POOL } from "./mortalBias";
import { MORTAL_REGIONS, MORTAL_TIER_MAX } from "@/data/regions";
import { enemyDef } from "@/data/enemies";
import { mutatorDef } from "@/data/mutators";

const MAX_CHAIN = 32;
const MAX_ITEMS_PER_NODE = 16;

function record(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function stringList(v: unknown, max = MAX_ITEMS_PER_NODE): string[] | null {
  if (!Array.isArray(v) || v.length === 0 || v.length > max) return null;
  if (!v.every((x) => typeof x === "string" && x.length > 0)) return null;
  const out = v as string[];
  return new Set(out).size === out.length ? [...out] : null;
}

function integerIn(v: unknown, min: number, max: number): number | null {
  return Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max
    ? (v as number)
    : null;
}

const REGION_BY_ID = new Map(MORTAL_REGIONS.map((r) => [r.id, r]));
const EVENT_TAGS = new Set(MORTAL_REGIONS.flatMap((r) => r.eventTags));

/** 把存档里的一棵世界树修成生成器能保证的形状;救不回来就返回 null。 */
export function restoreMortalWorld(raw: unknown): MortalWorld | null {
  const o = record(raw);
  if (!o) return null;

  const seed = integerIn(o.seed, 0, Number.MAX_SAFE_INTEGER);
  const shape = ROUTE_SHAPES.find((x) => x.id === o.shapeId);
  const rhythm = RHYTHM_ARCHETYPES.find((x) => x.id === o.rhythmId);
  const rule = typeof o.ruleId === "string" ? mutatorDef(o.ruleId) : undefined;
  const bias =
    typeof o.bias === "string" && BIAS_POOL.includes(o.bias as (typeof BIAS_POOL)[number])
      ? o.bias
      : null;
  if (
    seed === null ||
    !shape ||
    !rhythm ||
    !rule ||
    bias === null ||
    !Array.isArray(o.chain) ||
    o.chain.length === 0 ||
    o.chain.length > MAX_CHAIN
  ) {
    return null;
  }

  const nodeIds = new Set<string>();
  const regionIds = new Set<string>();
  const chain: MortalPlace[] = [];
  for (const rawPlace of o.chain) {
    const p = record(rawPlace);
    if (!p) return null;

    const nodeId =
      typeof p.nodeId === "string" && p.nodeId.length > 0 && p.nodeId.length <= 100
        ? p.nodeId
        : null;
    const region = typeof p.fromId === "string" ? REGION_BY_ID.get(p.fromId) : undefined;
    const tier = integerIn(p.tier, 1, MORTAL_TIER_MAX);
    const enemies = stringList(p.enemies);
    const tags = stringList(p.eventTags);
    const boss = typeof p.boss === "string" ? enemyDef(p.boss) : undefined;
    if (
      nodeId === null ||
      !region ||
      tier === null ||
      !enemies ||
      !tags ||
      !boss ||
      boss.archetype === undefined ||
      nodeIds.has(nodeId) ||
      regionIds.has(region.id) ||
      !enemies.every((id) => {
        const def = enemyDef(id);
        return def !== undefined && def.archetype === undefined;
      }) ||
      !tags.every((tag) => EVENT_TAGS.has(tag))
    ) {
      return null;
    }

    nodeIds.add(nodeId);
    regionIds.add(region.id);
    chain.push({
      nodeId,
      fromId: region.id,
      name: region.name,
      tier,
      enemies,
      boss: boss.id,
      archetype: boss.archetype,
      eventTags: tags,
    });
  }

  const fallbacks = Array.isArray(o.bossFallbackAt)
    ? o.bossFallbackAt.filter(
        (i): i is number => Number.isSafeInteger(i) && i >= 0 && i < chain.length,
      )
    : [];

  return {
    seed,
    chain,
    shapeId: shape.id,
    shapeName: shape.name,
    rhythmId: rhythm.id,
    rhythmName: rhythm.name,
    ruleId: rule.id,
    ruleName: rule.name,
    rules: rule.rules,
    bias,
    bossFallbackAt: [...new Set(fallbacks)],
  };
}
