<template>
  <BaseModal :open="summary !== null" :closable="false" aria-label="离线归来结算">
    <div v-if="summary" class="text-center">
      <!-- 归来印信:此行结清盖一枚石绿「归」印 —— 突破是里程碑盖朱砂,归总是完成态盖石绿 -->
      <div class="relative mx-auto mt-1 h-16 w-16" aria-hidden="true">
        <div
          class="grid h-16 w-16 place-items-center rounded-full border-2 border-jade bg-jade/5 font-kai text-3xl text-jade animate-ink-pop animate-seal-breathe"
        >
          归
        </div>
      </div>
      <p class="mt-2 text-body text-ink-faint">
        此去
        <span class="font-kai text-title text-ink">{{ formatDuration(summary.seconds) }}</span>
        <!--
          两条账分开报:被动修行(修为/灵气)不限时、全额;产出与派遣受洞府上限。
          从前只写一句"收益按 X 结算",玩家看到的是"挂了一周没怎么变",却不知道哪一条被砍了。
        -->
        <template v-if="summary.capped"
          >(修为与灵气全额入账;产出与历练按
          {{ formatDuration(summary.cappedSeconds) }} 结算)</template
        >
      </p>
      <!--
        这一夜是在**哪儿**过的 —— 归来卷轴是玩家隔夜/出差/一周没开之后的第一眼,
        而这一作的历练是「在某一片地上挂一程」:雪山砍狼、江边打鲛、古战场掘剑。
        卷轴上的账一向够细,唯独没有地点:只有「在路上」三个字,抬头也没有东西可看。

        取景按**这一趟历练所在的地界**(`summary.region.icon`),不是按玩家的世界:
        同一个「仙界」里有星野也有江海,而这一夜只发生在其中一处。

        没有在途历练时整块不出 —— 那一夜只是闭关,不在任何一片地上;
        给闭关也配一张地景,等于替玩家编一段他没走过的路。

        画法是卷尾一条(与「突破结果」那一屏同一个落法):它有自己的高度、不压字,
        故点景照画 —— 地界之间的分别全靠点景(水滴 / 火舌 / 断塔)读出来。
      -->
      <template v-if="summary.region">
        <div class="offline-region" data-offline-region>
          <InkScene
            class="offline-region__scene"
            :icon="summary.region.icon"
            :world-id="player.world.id"
          />
          <p class="offline-region__caption">
            <span class="offline-region__label">那一夜在</span>
            <strong class="offline-region__name font-kai">{{ summary.region.name }}</strong>
          </p>
        </div>
      </template>
      <!--
        收益分两本账,不再是均质的一张流水:
          入账 —— 带回洞府的资源,数值是这张卡的主角(14px 楷体,与印信同一笔意);
          路上 —— 发生在外面的事(寿元在走、打过架、遇过人、捡过装备),
        它们不是「收获」,排在收获后面另起一段,寿元尤其不该与修为长得一样。
        组标用宽排楷体小字,与页签同款「留白当分隔」的水墨口气。
      -->
      <template v-if="gainRows.length">
        <div class="ink-divider my-3" />
        <SectionMark text="入 账" />
        <ul class="stagger-in space-y-2 text-left">
          <li
            v-for="row in gainRows"
            :key="row.label"
            class="flex items-center justify-between rounded-[2px] bg-paper-deep/70 px-3 py-2 tinylens:flex-col tinylens:items-start tinylens:gap-0.5"
          >
            <span class="flex items-center gap-2 text-title text-ink-soft">
              <GameIcon :name="row.icon" :size="15" class="text-ink-faint" />
              {{ row.label }}
            </span>
            <span class="font-kai tabular text-title text-ink">{{ row.value }}</span>
          </li>
        </ul>
      </template>
      <template v-if="roadRows.length">
        <div class="ink-divider my-3" />
        <SectionMark text="路 上" />
        <ul class="stagger-in space-y-2 text-left">
          <li
            v-for="row in roadRows"
            :key="row.label"
            class="flex items-center justify-between rounded-[2px] bg-paper-deep/70 px-3 py-2 tinylens:flex-col tinylens:items-start tinylens:gap-0.5"
          >
            <span class="flex items-center gap-2 text-title" :class="row.cls">
              <GameIcon :name="row.icon" :size="15" class="text-ink-faint" />
              {{ row.label }}
            </span>
            <span class="tabular text-title" :class="row.cls">{{ row.value }}</span>
          </li>
          <li v-if="savedEquipment.length" class="rounded-[2px] bg-paper-deep/70 px-3 py-2">
            <p class="mb-1 flex items-center gap-2 text-title text-ink-soft">
              <GameIcon name="backpack" :size="15" class="text-ink-faint" />
              拾得装备 ×{{ savedEquipment.length }}
            </p>
            <!--
              每一件都盖品阶章 —— 这一块原先只把品阶体现为文字颜色。
              而全集其余每一处都盖 QualitySeal,它的理由写在那个组件头上:
              良品(jade)与精品(qing)同属青绿系、纸面上几乎难分,色弱玩家更是
              一条色带都读不出档;章是不靠颜色单打的**形状线索**。

              离线归来恰恰最该有它:玩家离开几小时再回来,「拾得装备」是这一屏里
              唯一可能出现高品阶的段落,而它们是一串平铺的名字 —— 挂着机捡到一件
              神品的那一瞬间,不该只剩一行稍深一点的枣红色字。
            -->
            <p class="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span
                v-for="(eq, i) in savedEquipment"
                :key="i"
                class="inline-flex items-center gap-1 font-kai text-body"
                :style="{ color: qualityDef(eq.quality).color }"
              >
                <QualitySeal :quality="eq.quality" :size="14" />
                <span
                  >{{ qualityDef(eq.quality).name }}·{{ eq.name
                  }}<template v-if="eq.inscription"> · 铭「{{ eq.inscription }}」</template></span
                >
              </span>
            </p>
          </li>
          <li v-if="eventReceipts.length" class="rounded-[2px] bg-paper-deep/70 px-3 py-2">
            <p class="mb-1.5 flex items-center gap-2 text-title text-ink-soft">
              <GameIcon name="star" :size="15" class="text-ink-faint" />
              际遇结果
            </p>
            <ul class="space-y-2">
              <li v-for="(receipt, i) in eventReceipts" :key="i">
                <p class="flex items-baseline justify-between gap-2 text-body">
                  <span class="flex items-baseline gap-1.5 min-w-0">
                    <span class="font-kai text-ink-soft">{{ receipt.title }}</span>
                    <!--
                      档位印 —— 三档稀度差着量级(约每 9 / 20 / 450 程一次),而离线归来
                      这一屏原先把三档塌成了一档:一次千载难逢的机缘与一次路边小事并排
                      摆着、长得一样。玩家不在时发生的一切,只有这一屏能告诉他。

                      形制沿用「墨字 + 淡底」,不加第三个强色(见 docs/design 的配色契约);
                      色取 eventTierDef 的 color,与历练页上那三档同源。
                    -->
                    <span
                      class="shrink-0 rounded-[2px] border px-1 py-px text-note leading-none"
                      :style="{
                        color: eventTierDef(receipt.tier).color,
                        borderColor: eventTierDef(receipt.tier).color,
                      }"
                      :data-offline-event-tier="receipt.tier"
                      >{{ eventTierDef(receipt.tier).name }}</span
                    >
                  </span>
                  <span v-if="receipt.count > 1" class="tabular text-ink-faint">
                    ×{{ receipt.count }}
                  </span>
                </p>
                <p v-for="(line, j) in receipt.lines" :key="j" class="mt-0.5 t-body text-ink">
                  {{ line }}
                </p>
              </li>
            </ul>
          </li>
        </ul>
      </template>
      <p v-for="(note, i) in summary.notes" :key="i" class="mt-2 text-body text-ink-faint">
        {{ note }}
      </p>
    </div>
    <template #footer>
      <button class="btn-seal w-full" @click="close">收 下</button>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed, watch } from "vue";
import { useUiStore } from "@/stores/ui";
import { usePlayerStore } from "@/stores/player";
import { formatDuration, formatGN, formatNum, formatPercent } from "@/utils/format";
import { toNum } from "@/utils/gnum";
import { qualityDef } from "@/data/qualities";
import { eventTierDef } from "@/core/eventTier";
import { playSfx } from "@/core/audio";
import BaseModal from "@/components/common/BaseModal.vue";
import GameIcon from "@/components/common/GameIcon.vue";
import InkScene from "@/components/common/InkScene.vue";
import QualitySeal from "@/components/common/QualitySeal.vue";
import SectionMark from "@/components/common/SectionMark.vue";

const ui = useUiStore();
const player = usePlayerStore();

const summary = computed(() => ui.offlineSummary);

// 归来一声钟磬,与收益清点同起
watch(summary, (nv, ov) => {
  if (nv && !ov) playSfx("success");
});

interface RewardRow {
  icon: string;
  label: string;
  value: string;
  /** true=带回家的资源(入账组) false=发生在外面的事(路上组) */
  gain: boolean;
  /** 路上组的行级色调:寿元在走不是收获,归尘是折算 —— 都不该长得像进账 */
  cls?: string;
}

const rows = computed<RewardRow[]>(() => {
  const s = summary.value;
  if (!s) return [];
  const list: RewardRow[] = [];
  if (s.exp.m > 0) {
    /*
     * 修为那一行要带上「本境推进」——「+42亿」只是个抽象大数:它可能是一个时辰的量,
     * 也可能是一天一夜的量,玩家没有参照。醒来真正想问的是「那我推到哪儿了」。
     *
     * 分母读 player.expReq(与修行页进度条同一份),现算不另存。
     * 修为本来按真实离线时长全额入账(见 core/offline 那段注释),这里只补展示。
     */
    /*
     * 修为是 GNum(大数结构),不能直接做算术 —— 走 gnum 的 ratio 取比值。
     *
     * 只在**真有意义时**才报:本境需求从炼气 92 涨到混沌海 2e19(跨 17 个数量级),
     * 而离线收益大致按时间线性长。于是在高境界,一次通宵挂机可能只占本境需求的
     * 万分之几 —— 写成「本境 0%」等于没说,反而占了一行宽度。
     * 故:推得动一层就报层数;不足一层的,过 1% 才报百分比;再小就不占字。
     */
    /*
     * 不用 utils/gnum 的 ratio:它把指数差钳在 ±15(那是给血量百分比 / 胜率估算用的),
     * 「离线修为 / 本境所需」在极端量级下会被它截断,算出假的层数。
     * toNum 是精确展开,再相除即可。
     */
    const reqNum = toNum(player.expReq);
    const layers = reqNum > 0 ? toNum(s.exp) / reqNum : 0;
    const push =
      layers >= 1
        ? ` · 本境推 ${layers.toFixed(layers >= 10 ? 0 : 1)} 层`
        : layers >= 0.01
          ? ` · 本境 ${formatPercent(layers, 0)}`
          : "";
    list.push({ icon: "flame", label: "修为", value: `+${formatGN(s.exp)}${push}`, gain: true });
  }
  /*
   * 熔真所得 —— 满级之后修为不进 `exp`(那条线走熔真),故这一行必须单独列。
   * 没有它,满级玩家挂一夜回来看到的是「修为 +0」,账上什么也没有:
   * 明明有产出,却因为没有一处说它,等于没有。
   */
  if (s.daoSource > 0)
    list.push({
      // 道源是天界的道之气,不是修为那种「火候」—— flame 与上面「修为」那行撞了图标
      icon: "sparkles",
      label: "道源",
      value: `+${formatGN(s.daoSource)} · 余修炼作`,
      gain: true,
    });
  if (s.stone.m > 0)
    list.push({ icon: "gem", label: "灵石", value: `+${formatGN(s.stone)}`, gain: true });
  if (s.qi > 0)
    list.push({ icon: "wind", label: "灵气", value: `+${formatNum(s.qi)}`, gain: true });
  if (s.herb > 0)
    list.push({ icon: "leaf", label: "灵草", value: `+${formatNum(s.herb)}`, gain: true });
  if (s.ore > 0)
    list.push({ icon: "mountain", label: "玄铁", value: `+${formatNum(s.ore)}`, gain: true });
  if (s.page > 0)
    list.push({ icon: "scroll", label: "功法残页", value: `+${formatNum(s.page)}`, gain: true });
  if (s.wudao > 0)
    list.push({ icon: "book", label: "悟道点", value: `+${formatNum(s.wudao)}`, gain: true });
  if (s.dust > 0)
    list.push({ icon: "sparkles", label: "器灵尘", value: `+${formatNum(s.dust)}`, gain: true });
  // 化尘总额已经单列一行动账;这里只交代有多少件没进包,避免把同一笔尘报两遍。
  if (s.recycledDust > 0 || s.recycledEquipment > 0) {
    list.push({
      icon: "sparkles",
      label: "回收装备",
      value: `${s.recycledEquipment} 件 · 已折入器灵尘`,
      gain: false,
      cls: "text-ink-faint",
    });
  }
  // 寿元在走:不是收获,弱化 —— 从前它与修为同款同色,「你老了」和「你赚了」长得一样
  if (s.ageYears > 0)
    list.push({
      icon: "sunset",
      label: "寿元流逝",
      value: `${s.ageYears} 载`,
      gain: false,
      cls: "text-ink-faint",
    });
  if (s.battles > 0)
    list.push({
      icon: "swords",
      label: "寻常历练",
      value: `${s.wins} 胜 / ${s.battles} 战`,
      gain: false,
    });
  if (s.bossBattles > 0)
    list.push({
      icon: "crown",
      label: "区域之主",
      value: `${s.bossWins} 胜 / ${s.bossBattles} 战`,
      gain: false,
    });
  if (s.events > 0)
    list.push({ icon: "star", label: "路遇际会", value: `${s.events} 次`, gain: false });
  return list;
});

/** 入账组:带回家的资源,这张卡的主角 */
const gainRows = computed(() => rows.value.filter((r) => r.gain));
/** 路上组:发生在外面的事,排在收获后面另起一段 */
const roadRows = computed(() => rows.value.filter((r) => !r.gain));

/** 真正入行囊的装备(回收件已并入"回收化尘"行,不在此重复列出) */
const savedEquipment = computed(() => summary.value?.equipment.filter((e) => !e.recycled) ?? []);
/** 资源总差额看不出的际遇所得:丹药、法宝、功法、丹方、灵兽与增益 */
const eventReceipts = computed(() => summary.value?.eventReceipts ?? []);

function close(): void {
  ui.offlineSummary = null;
}
</script>

<style scoped>
/*
 * 那一夜所在的那片地 —— 卷尾一条画。
 *
 * ## 为什么是卷尾一条,不是铺满压字
 *
 * 突破结果那一屏同一个落法(见 styles/pages/cultivation.css 的长注释)。这一窗的
 * 正文是**账**:入账 / 路上两组读数、拾得装备、际遇回执、离线上限那一段说明 ——
 * 每一行都要读得清。把画垫在它们底下,山脊就会横穿某几行。
 *
 * 故给画留出自己的高度(`padding-bottom` 让出这一条),画落在卷尾、地名压在画上缘:
 * 上是这一段带回了什么,下是这一夜站在哪里。
 *
 * ## 为什么在这里兜世界色
 *
 * `InkScene` 的山骨读 `--world-mountain`,而这扇弹窗是 `Teleport to="body"` 的 ——
 * 那一层在 `.app-shell` 之外,世界色继承不过去。故按**玩家此刻所处的界**自己兜一档:
 * 与首页、修行卷首那一档同源(那两处也是「此刻所处的界」)。
 */
.offline-region {
  position: relative;
  isolation: isolate;
  margin-top: 1.1rem;
  padding-top: 0.2rem;
  padding-bottom: 5.4rem;
  border-top: 1px solid rgb(var(--color-ink-rgb) / 0.08);
}
.offline-region__scene {
  --ink-scene-h: 6rem;
  /*
   * 浓淡按卷尾一条调:这一条底下没有字,不必像 veil 那样让墨。
   * 取 1.3 —— 与「突破结果」那一屏同一个档位(1.35),理由同:
   * 再淡一档,山骨与点景(水滴 / 火舌 / 断塔)就只剩一条灰带,
   * 而「这一夜在哪片地上」全靠它们读出来。
   */
  --ink-scene-ink: 1.3;
  position: absolute;
  inset-inline: 0;
  bottom: 0;
  pointer-events: none;
}
.offline-region__caption {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 0.4rem;
  color: rgb(var(--color-ink-faint-rgb));
  font-size: var(--type-note);
}
.offline-region__name {
  color: rgb(var(--color-ink-soft-rgb));
  font-size: var(--type-body);
  letter-spacing: 0.14em;
}
</style>
