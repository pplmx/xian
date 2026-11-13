/**
 * 大道熔真 —— 引擎侧接线。
 *
 * ## 为什么单独一个文件
 *
 * `core/` 有一条分层纪律:core 模块对 store 的依赖要逐一点名,且**只许减**
 * (`core/layeringAudit.spec` 守着)。熔真的**算法**是纯的(折算率、余数累积、
 * 多久出一枚),不该为了读两个 store 就把一个新名字加进那份名单。
 *
 * 故拆成两半:
 *   · `core/apexCultivation` —— 纯函数,不 import 任何 store,可直接测;
 *   · 本文件 —— 唯一一处把「这一拍修为」接到「哪个 store 收钱」上的地方。
 *
 * 这也让三处调用点(在线心跳、离线折算、逐场历练)只认一个入口,不必各自
 * 判断满级 —— 判断只在这里做一次。
 */
import { usePlayerStore } from "@/stores/player";
import { useEndgameStore } from "@/stores/endgame";
import { notify } from "@/core/notify";
import { apexCultivationTick } from "@/core/apexCultivation";
import { formatGN } from "@/utils/format";
import { toNum } from "@/utils/gnum";
import type { GNum } from "@/types";

/**
 * 引擎侧入口:满级就让这一拍修为走熔炉,否则照常涨。
 *
 * 与 `player.gainExp` 是**二选一**:同一笔修为要么进 `exp`(未满级),
 * 要么进道源(已满级),不会两边都记 —— 否则一份修为换两份产出。
 *
 * 入参是 GNum(与 `gainExp` 同一个形状),三处调用点(在线心跳、离线折算、
 * 逐场历练)都直接换掉 `player.gainExp(...)` 即可,不必各自判断满级。
 */
export function routeCultGain(gained: GNum): void {
  const player = usePlayerStore();
  if (!player.atMaxRealm) {
    player.gainExp(gained);
    return;
  }
  // 满级之后:这一拍修为就地入炉。定标用当前境界的修为需求(与进度条同一份)
  const expReq = toNum(player.expReq);
  const daoSource = apexCultivationTick(toNum(gained), expReq);
  if (daoSource <= 0) return;
  useEndgameStore().addDaoSource(daoSource);
  /*
   * 通报走 formatGN,并且**只在真的熔出一枚时说** —— 每秒弹一次提示会把
   * 整个屏幕糊住。这里 22 天才一枚,频率天然够低。
   */
  notify(`大道熔真:这一炉余修炼作道源 +${formatGN(daoSource)}`, "success");
}
