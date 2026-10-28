/**
 * 法宝全册规模夹具 —— 运行时门需要终局真实体量,而不是后期档里空空的法宝页。
 *
 * 45 件每张都是名/描述/被动/神通/代价/双按钮的密卡;这里直接从内容表造持有状态,
 * 不手抄 id、也不另写一份件数。只用于自检,不参与游戏运行。
 */
import { ARTIFACTS, ARTIFACT_MAX_LEVEL } from "../../src/data/artifacts";
import { qualityDef } from "../../src/data/qualities";

export const FULL_ARTIFACT_COUNT = ARTIFACTS.length;

export function fullArtifactRows() {
  return ARTIFACTS.map((artifact, index) => ({
    defId: artifact.id,
    name: artifact.name,
    quality: qualityDef(artifact.quality).rank,
    // 同品阶内故意拉开祭炼等级,让「品质降序 → 祭炼高低 → 名」的真排序进场;
    // 偏移一圈让回翻窗首卡炼化后恰好越过窗界,焦点回补才有真对象。
    level: (index + 4) % (ARTIFACT_MAX_LEVEL + 1),
  })).sort((a, b) => b.quality - a.quality || b.level - a.level || a.name.localeCompare(b.name));
}

export function fullArtifactSlices() {
  return {
    inventory: {
      items: [],
      equipped: {},
      pills: {},
      artifacts: fullArtifactRows().map(({ defId, level }) => ({ defId, level })),
      equippedArtifacts: [],
    },
  };
}
