/**
 * 前尘山河的运行时夹具。
 *
 * 世界页默认只会凝成当前这一世,历史册在空档与后期档里都不会出现。
 * 这里直接用真实生成器造三世,让 320 与 195 宽下的历史行有可量对象;
 * 标题与段数也从同一套世界身份/路线数据取出,不手抄界面文案。
 */
import { generateMortalWorld } from "../../src/core/mortalWorldGen";
import { worldIdentity } from "../../src/core/mortalIdentity";

const HISTORY_SEEDS = [61_001, 62_002, 63_003] as const;
const CURRENT_SEED = 71_001;

export function makeWorldHistoryFixture() {
  const history = HISTORY_SEEDS.map((seed) => generateMortalWorld(seed));
  const current = generateMortalWorld(CURRENT_SEED);
  return {
    mortalWorld: current,
    mortalWorldHistory: history,
    mortalBiasHistory: [...history, current].map((world) => world.bias),
    expectedRows: [...history].reverse().map((world) => ({
      title: worldIdentity(world).name,
      stages: world.chain.length,
    })),
  };
}
