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
import { apexCultivationTick, apexQiTick } from "@/core/apexCultivation";
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

/**
 * 满级之后:灵气**存满溢出**的那部分也入炉。
 *
 * 为什么只在存满时算:未满级时灵气是给突破与疗伤用的资源,把它算成产出等于
 * 凭空多给一份 —— 同一笔灵气会既付掉突破、又换成道源。只有满级之后、
 * `qiBankCap` 已经顶住,新回的那些灵气才是**真的没有去处**。
 *
 * 入参是「这一拍本来回了多少」,不是前后差值 —— 存满之后 `setQi` 会把值
 * 钳在同一个数上,差值恒为 0(第一版就是这么写的,于是**永远产不出**,
 * 而单测如果只验「没存满时不产」还会全绿)。
 *
 * 与修为那条同一个入口(引擎心跳),不另起计时线。
 *
 * @param before 这一拍之前的灵气
 * @param regen  这一拍本该回多少
 */
export function routeQiGain(before: number, regen: number): void {
  const player = usePlayerStore();
  if (!player.atMaxRealm) return;
  if (!Number.isFinite(regen) || regen <= 0) return;
  const bankCap = player.qiBankCapValue;
  // 只有「已经存满」时,新回的这部分才是溢出 —— 否则它还有用(疗伤)
  if (before < bankCap) return;
  // 分母取 `qiBankCap`(灵气真正的天花板),不是标称容量 —— 后者差一个数量级
  const daoSource = apexQiTick(regen, bankCap);
  if (daoSource <= 0) return;
  useEndgameStore().addDaoSource(daoSource);
  notify(`大道熔真:灵气满溢炼作道源 +${formatGN(daoSource)}`, "success");
}
