<template>
  <div
    class="cultivation-page folio-page folio-page--stack stagger-in"
    data-page-rhythm="inner-view"
    :style="skyStyle"
  >
    <FolioPageHeader
      class="cultivation-masthead"
      data-cultivation-stage
      :data-cultivation-phase="stage.key"
      :title="player.realm.name"
      :subtitle="player.realm.desc"
      featured
      compact
    >
      <template #backdrop>
        <div class="cultivation-masthead__backdrop" aria-hidden="true">
          <span
            v-for="i in 14"
            :key="i"
            class="cultivation-masthead__star"
            :style="{ '--star': i }"
          />
          <span class="cultivation-masthead__ring cultivation-masthead__ring--outer" />
          <span class="cultivation-masthead__ring cultivation-masthead__ring--inner" />
          <!--
            这一界的天与地 —— 山骨按所处界换(人间山岳 / 仙界星野 / 神界宫阙 / 混沌虚空),
            见 ui/sceneTerrain。与首页那片山**同一份画法**、同一份世界色,
            只是各自给高度:一处算、两处继承之后,再没有「一处变了另一处没变」。
          -->
          <div class="cultivation-masthead__scene">
            <InkScene :world-id="player.world.id" />
          </div>
        </div>
      </template>
      <template #meta>
        <div class="cultivation-masthead__meta">
          <span class="cultivation-masthead__world world-label"
            >{{ player.worldName }} · {{ player.subName }}</span
          >
          <span class="cultivation-masthead__phase" :data-phase="stage.key">
            <span aria-hidden="true" />
            {{ stage.label }}
          </span>
          <!--
            界序号（第 N / 21 境）只在章首右侧读数席出现一次 —— 那里是境界线的起点，
            也是玩家判断「还有多远」时真正会看的位置。卷首这一格让它退休：
            390×844 实测同一行读数曾在首屏说了两遍。
          -->
        </div>
        <details class="cultivation-masthead__lore">
          <summary>典籍所据 · {{ player.realm.basis }}</summary>
          <p>「{{ player.realm.basis }}」{{ player.realm.lore }}</p>
        </details>
      </template>
      <template #visual>
        <CultivationDial />
      </template>
      <div class="cultivation-masthead__readout" data-cultivation-stage-readout>
        <!--
          本境这一格只报**此刻站在哪一层**。百分比、还剩多少、约多久一律归正文那张
          行功账(它本来就是进度条 + 还剩 N% + 时长);同一眼里不许说两遍
          —— 与「此刻行速归内观台、正文不再复读」同一条纪律。
        -->
        <div class="cultivation-masthead__readout-cell">
          <span class="cultivation-masthead__readout-label">本境</span>
          <strong class="cultivation-masthead__readout-value">
            {{ player.expFull ? `${player.subName} · 圆满` : player.subName }}
          </strong>
          <span class="cultivation-masthead__readout-note">{{ stage.hint }}</span>
        </div>
        <div class="cultivation-masthead__readout-cell">
          <!--
            满级之后这一格换口。

            未满级时它报「此刻行速 XXX/秒」—— 那个数就是修为进账,有意义。
            而满级之后修为被 `subClamp` 夹死、涨不上去,同一个数却仍在跳:
            玩家看到每秒 5.7e13 的数字,底下进度条一动不动,没有一处说清
            「这些修为去哪了」。那正是终局主循环「看起来在转、其实断了」的样子。

            现在满级时这一格报**熔真产出**(见 core/apexCultivation):同一笔修为
            走的是另一条路,界面也如实改口 —— 数还在跳,但它有去处了。
          -->
          <span class="cultivation-masthead__readout-label">{{
            player.atMaxRealm ? "大道熔真" : "此刻行速"
          }}</span>
          <strong class="cultivation-masthead__readout-value tabular">{{
            formatRate(player.cultPerSec)
          }}</strong>
          <span class="cultivation-masthead__readout-note tabular">
            <template v-if="player.atMaxRealm">
              余修尽数入炉 · 约 {{ apexFurnaceEtaText }} 得 1 道源
            </template>
            <template v-else>
              基础 {{ formatRate(cultBase) }} · 加成 {{ formatPercent(cultMultiplier) }}
            </template>
          </span>
        </div>
        <div class="cultivation-masthead__readout-cell">
          <span class="cultivation-masthead__readout-label">灵气</span>
          <strong class="cultivation-masthead__readout-value tabular">{{
            formatPercent(qiFillRatio, 0)
          }}</strong>
          <!--
            这一格报「充盈之后拿到什么」,不再用一句指着下文的空话占位。
            原先那句一个数字都没有,只是指路 —— 而「还差多少」下面已经说了两遍
            (账首 hint 报时间、灵气条主行报数量),两条各答各的都该留,
            卷首这一行却只是占着位置指路。
            充盈后的加成是「值不值得等」的答案,那两处都没说,正好由这一格给。
          -->
          <!--
            满级之后这一格也换口:灵气充盈的「修炼 +15%」对满级玩家毫无意义
            (修为走熔真了,加成落在一条已经封顶的线上)。此时该说的是
            「存满之后溢出的那部分去了哪」——与修为那一格同一条口径。
          -->
          <span class="cultivation-masthead__readout-note tabular">
            <template v-if="player.atMaxRealm">
              <template v-if="qiAtBankCap">已存满 · 满溢炼作道源</template>
              <template v-else>未存满 · 存满后溢出入炉</template>
            </template>
            <template v-else>{{
              qiRichInfo.on ? "充盈 · 修炼加成" : `充盈后修炼 +${formatPercent(QI_RICH_BONUS)}`
            }}</template>
          </span>
        </div>
      </div>
    </FolioPageHeader>

    <!--
      行功续卷 —— 卷首之下只留一册连续长账:
      先报本境走到哪,再答下一步做什么,最后续上随身与功法。
      四章共用一条账线,不再让破境、闭关、状态、丹药与书目各套一层卡片。
    -->
    <article class="cultivation-register folio-span-all" data-cultivation-register>
      <div class="cultivation-register__main">
        <section
          class="cultivation-register__chapter cultivation-ledger"
          data-cultivation-chapter="practice"
          data-cultivation-ledger
        >
          <FolioChapterHead
            data-cultivation-chapter-head
            :index="practiceChapter.index"
            :title="practiceChapter.title"
            :hint="practiceChapter.hint"
            :fact="realmOrdinalText(player.major)"
          />

          <!-- 仙路 21 境全景:已至/当前/未至一眼可辨,界门立界,四界分列 -->
          <div class="cultivation-ledger__ladder" data-cultivation-route>
            <RealmLadder :major="player.major" />
          </div>

          <div class="cultivation-ledger__primary" data-cultivation-primary>
            <div class="cultivation-ledger__primary-head">
              <span>本境修为</span>
              <!-- 到顶就没有「下一步」:末境硬算会钳回末境自己,拼出「混沌道祖·一层」 -->
              <span v-if="btInfo.targetLabel" class="text-qing"
                >下一步 → {{ btInfo.targetLabel }}</span
              >
              <span v-else class="text-qing" data-cultivation-apex-note>已至大道尽头</span>
            </div>
            <div
              data-value-row
              class="text-ink-soft cultivation-ledger__value-row flex flex-wrap items-baseline gap-x-1 text-body tabular"
            >
              <span class="cultivation-ledger__value font-kai">
                <TapNumber
                  :value="player.exp"
                  title="修为"
                  :rows="expDetailRows"
                  :note="expDetailNote"
                />
              </span>
              <span class="text-ink-faint">/ {{ formatGN(player.expReq) }}</span>
              <span v-if="player.expFull" class="text-qing">· 圆满</span>
            </div>
            <div :class="player.expFull ? 'bar-charged' : ''">
              <ProgressBar :value="player.expProgress" color="var(--color-qing)" :height="10" />
            </div>
            <div class="cultivation-ledger__remainder">
              <!--
                报**已走**多少，不报「还剩」。
                原式 `formatPercent(1 - expProgress, 0)` 在刚起步时必然报满：
                `1 - 0.0017 = 0.9983` → 取整 100%。于是一条几乎为空的进度条旁
                写着「还剩 100%」，读起来像卡住了。方向本来就反了 ——
                玩家想知道的是「我走了这么多」。
                另见 ui/expProgressNote：两头都要收口（刚起步 / 将要圆满）。
              -->
              <span class="text-ink-soft tabular">{{
                expProgressNote(player.expProgress, expEtaText)
              }}</span>
              <button
                class="tap-row -mx-1.5 -my-1 min-w-[28px] justify-center px-1.5 py-1.5 text-center text-note text-ink-faint active:opacity-60"
                :aria-expanded="showCultBreakdown"
                @click="showCultBreakdown = !showCultBreakdown"
              >
                {{ showCultBreakdown ? "▾" : "▸" }}来路
              </button>
            </div>
            <p v-if="longEtaHint" class="cultivation-ledger__hint">
              {{ longEtaHint }}
            </p>
          </div>

          <div class="cultivation-ledger__meters" data-cultivation-meters>
            <!--
              「此刻行速」这一格曾经在这里,与卷首内观台那一格一字不差
              (同一个 formatRate(cultPerSec)、同一句「基础 N · 加成 M」)。
              390×844 实测两处都在首屏(top 332 与 676),玩家同一眼里读到
              两遍同一个数。行速归内观台(那里本就是「余程 / 行速 / 灵气」三格);
              这里只留灵气 —— 它有内观台没有的东西:充盈还差多少、引气静养的入口。
            -->

            <section class="cultivation-ledger__meter">
              <div class="cultivation-ledger__meter-head">
                <p class="cultivation-ledger__meter-label">灵气</p>
                <span class="text-note text-ink-faint"
                  >+{{ formatRate(player.qiRegenPerSec) }}</span
                >
              </div>
              <!--
                极窄档(195 CSS px)把「灵气 +X/秒」与「现值 · 已封顶」拆成上下两段,
                免得封顶标记被甩出主值行。
              -->
              <div
                data-value-row
                class="text-ink-soft cultivation-ledger__qi-row flex justify-between text-body tabular tinylens:flex-col tinylens:items-start tinylens:gap-y-0.5"
              >
                <span>
                  <TapNumber
                    :value="Math.floor(resources.qi)"
                    title="灵气"
                    :rows="qiDetailRows"
                    :note="qiDetailNote"
                  >
                    <span :class="qiOverCap ? 'text-qing' : ''">
                      {{ formatNum(Math.min(Math.floor(resources.qi), player.qiCapValue))
                      }}<template v-if="qiOverCap">+</template>
                    </span>
                  </TapNumber>
                  <span class="tinylens:hidden">/ {{ formatNum(player.qiCapValue) }}</span>
                  <span v-if="resources.qi >= player.qiBankCapValue" class="text-amber-ink"
                    >· 已封顶</span
                  >
                </span>
              </div>
              <ProgressBar :value="qiFillRatio" color="var(--color-qing)" :height="8" />
              <p
                class="cultivation-ledger__meter-copy"
                :class="qiRichInfo.on ? 'text-qing' : 'text-ink-faint'"
              >
                <template v-if="qiRichInfo.on"
                  >灵气充盈 —— 修炼速度 +{{ formatPercent(QI_RICH_BONUS) }}</template
                >
                <!--
                  空格分两句说,而不是原来那串三层括号:
                  「距灵气充盈尚差 N 灵气(灵气 ≥ M(容量 50%)→ 修炼 +15%)」
                  一条 44 字的句子,读者要在括号里再开一层括号才看得懂门槛。
                  主句先给「还差多少」(这是玩家真要的那个数),门槛与加成降为下一行。
                  数字全部照旧读常数与现算值,一个字都没手抄。
                -->
                <template v-else>
                  <span class="cultivation-ledger__meter-main"
                    >距灵气充盈尚差 {{ formatNum(qiRichInfo.gap) }}
                  </span>
                  <span class="cultivation-ledger__meter-sub tabular"
                    >门槛 {{ formatNum(qiRichInfo.threshold) }} ·
                    {{ formatPercent(QI_RICH_THRESHOLD_RATIO) }} 容量 · 修炼 +{{
                      formatPercent(QI_RICH_BONUS)
                    }}</span
                  >
                </template>
              </p>
              <button
                v-if="repair.injured"
                type="button"
                class="cultivation-ledger-action mt-2"
                :disabled="!repair.affordable"
                @click="repairWithQi()"
              >
                {{
                  repair.affordable
                    ? `引气静养 · 平复伤势心魔 · 耗灵气 ${formatNum(repair.cost)}`
                    : `灵气不足(需 ${formatNum(repair.cost)})`
                }}
              </button>
              <QiShortfallNote
                v-if="repairBlock"
                :short="repairBlock.short"
                :eta="repairBlock.eta"
              />
            </section>
          </div>

          <div v-if="showCultBreakdown" class="cultivation-ledger__sources">
            <p class="text-ink-soft">
              基础 {{ formatRate(cultBase) }}({{ player.realm.name }}{{ player.subName
              }}{{ player.linggen ? `·${player.linggen.gradeName}` : "" }}) × (1 +
              <span class="tabular text-qing">{{ formatPercent(cultMultiplier) }}</span
              >) = <span class="tabular text-qing">{{ formatRate(player.cultPerSec) }}</span>
            </p>
            <p v-for="row in cultSources" :key="row.name" class="flex justify-between">
              <span class="text-ink-faint">{{ row.name }}</span>
              <span class="tabular" :class="row.value > 0 ? 'text-qing' : 'text-cinnabar'">
                {{ row.value > 0 ? "+" : "" }}{{ formatPercent(row.value) }}
              </span>
            </p>
            <p class="cultivation-ledger__hint">
              这些都是修炼速度的百分比加成,相加后乘在基础上 —— 与人物页属性明细同源。
            </p>
          </div>
        </section>

        <!--
          修行账回答「现在走到哪」,下一步只回答「此刻做哪件事」。
          破境先于闭关:前者是这一境的出口,后者是留在原地的加速。

          **到顶之后整章换形**:不再有「下一步」这个说法 —— 破境不可能发生、
          闭关也不再是为了突破做准备。此时该报的是「这一世走到了哪里、还能去哪」,
          那是 `ApexSeal` 的活,不是破境卡的。闭关与观象仍在,但降为「尚可做的事」
          里的一件,不再占据「下一步」的位置。
        -->
        <section
          v-if="player.atMaxRealm"
          class="cultivation-register__chapter cultivation-apex-chapter"
          data-cultivation-chapter="apex"
          data-cultivation-apex
        >
          <FolioChapterHead
            data-cultivation-chapter-head
            index="贰"
            title="大道尽头"
            hint="一世之修行,到此为止"
            :fact="realmDef(MAX_MAJOR).name"
          />
          <ApexSeal />
          <!-- 闭关与观象仍可做,只是不再是「为突破做准备」 -->
          <div class="cultivation-next__rows cultivation-apex-chapter__rows">
            <RetreatCard />
          </div>
        </section>
        <section
          v-else
          class="cultivation-register__chapter cultivation-next"
          data-cultivation-chapter="next"
          data-cultivation-next
        >
          <FolioChapterHead
            data-cultivation-chapter-head
            :index="nextChapter.index"
            :title="nextChapter.title"
            :hint="nextChapter.hint"
            :fact="stage.label"
          />
          <div class="cultivation-next__rows">
            <BreakthroughCard />
            <RetreatCard />
          </div>
        </section>
      </div>

      <section
        v-if="activeBuffs.length || quickPills.length"
        class="cultivation-register__chapter cultivation-support"
        data-cultivation-chapter="support"
        data-cultivation-support
      >
        <FolioChapterHead
          data-cultivation-chapter-head
          :index="supportChapter.index"
          :title="supportChapter.title"
          :hint="supportChapter.hint"
          :fact="supportFact"
        />
        <div class="cultivation-support__grid">
          <!-- 状态 -->
          <section v-if="activeBuffs.length" class="cultivation-support__group">
            <h3 class="cultivation-support__title">状态</h3>
            <div class="cultivation-support__buffs">
              <!--
                状态胶囊每秒刷新一次,倒数文本必须定宽:formatCountdown 逐位补零,
                再给它一个固定宽度的槽位(文字右对齐)—— 否则「10分0秒 → 10分1秒」
                这一位的增减会把整排胶囊推来推去,看起来就是「状态一直在抖」。
              -->
              <button
                v-for="b in activeBuffs"
                :key="b.def!.id"
                type="button"
                class="chip-ink tabular transition-transform active:scale-95"
                :class="
                  b.def!.kind === 'injury'
                    ? 'border-cinnabar/60 text-cinnabar'
                    : 'border-jade/60 text-jade'
                "
                @click="ui.buffDetailId = b.def!.id"
              >
                <GameIcon :name="b.def!.icon" :size="11" />
                {{ b.def!.name }}
                <span
                  v-if="b.stack > 1"
                  class="text-note"
                  :aria-label="`${b.def!.name} 与 ${b.stack - 1} 味状态同刻叠加`"
                  >×{{ b.stack }}</span
                >
                <span class="countdown-slot">{{ formatCountdown(b.remain) }}</span>
              </button>
            </div>
          </section>

          <!-- 丹药速服 -->
          <section v-if="quickPills.length" class="cultivation-support__group">
            <h3 class="cultivation-support__title">以药辅道</h3>
            <div class="cultivation-pills">
              <button
                v-for="p in quickPills"
                :key="p.def!.id"
                data-quick-pill
                class="cultivation-pill-row"
                :disabled="p.overflow === 'full'"
                @click="usePill(p.def!.id)"
              >
                <GameIcon
                  :name="p.def!.icon"
                  :size="16"
                  :style="{ color: qualityDef(p.def!.quality).color }"
                />
                <span class="cultivation-pill-row__copy">
                  <!--
                    品名旁先报品阶 —— 这一行是全站最常点的地方(服丹 / 续药 / 看顶没顶),
                    原先品阶只由那枚 16px 图标的前景色承担。夹具里同一屏三行恰好是
                    大还丹(玄品) / 聚灵丹(精品) / 回灵丹(良品):良品与精品同属青绿系,
                    纸面上几乎难分(见 QualitySeal 文件头);而图标是丹药形状,颜色附着在
                    图形上是第二属性,扫读一串丹名时视线落在字上。

                    只在名称那一行加,不另起一段:这一行 46px 高、已装四样信息。
                  -->
                  <span class="cultivation-pill-row__name">
                    {{ p.def!.name }}
                    <span
                      class="cultivation-pill-row__quality"
                      :style="{ color: qualityDef(p.def!.quality).color }"
                      >{{ qualityDef(p.def!.quality).name }}</span
                    >
                  </span>
                  <span class="cultivation-pill-row__brief tabular">
                    存 {{ p.count
                    }}<template v-if="quickPillBrief(p.def!)"
                      >· {{ quickPillBrief(p.def!) }}</template
                    >
                  </span>
                </span>
                <!-- 顶满=白费,禁用并改口;续时=只剩尾巴可续,照吃但把话说清 -->
                <span
                  class="cultivation-pill-row__state"
                  :class="
                    p.overflow === 'full'
                      ? 'text-ink-faint'
                      : p.overflow === 'partial'
                        ? 'text-amber-ink'
                        : 'text-qing'
                  "
                >
                  {{ p.overflow === "full" ? "已顶" : p.overflow === "partial" ? "续时" : "服用" }}
                </span>
              </button>
            </div>
            <!-- 速服只铺前四味;余量不能静默消失,给出去丹匣逐味查看的直达入口 -->
            <RouterLink
              v-if="quickPillsHidden > 0"
              data-quick-pills-hidden
              :to="{ path: '/inventory', query: { tab: 'pill' } }"
              :aria-label="`另有 ${quickPillsHidden} 味可服丹药,前往丹匣查看`"
              class="cultivation-support__more"
            >
              <span>另有 {{ quickPillsHidden }} 味</span>
              <span class="text-qing">去丹匣 ›</span>
            </RouterLink>
          </section>
        </div>
      </section>

      <!-- 功法区(主修卡/一门一册书目/参悟)→ GongfaSection,整块随本体迁入 -->
      <GongfaSection
        class="cultivation-register__chapter cultivation-gongfa"
        data-cultivation-chapter="gongfa"
      />
    </article>

    <GongfaDialog />
    <BuffDialog />
  </div>
</template>

<script setup lang="ts">
import "@/styles/pages/cultivation.css";
import { realmOrdinalText } from "@/core/realmLadder";
import { apexFurnaceEta } from "@/core/apexCultivation";
import { MAX_MAJOR, realmDef } from "@/data/realms";
import { computed, ref } from "vue";
import { RouterLink } from "vue-router";
import { usePlayerStore } from "@/stores/player";
import { useResourcesStore } from "@/stores/resources";
import { useCultivationStore } from "@/stores/cultivation";
import { useInventoryStore } from "@/stores/inventory";
import { useUiStore } from "@/stores/ui";
import { buffOverflowOf, buffStackSize } from "@/core/engineBuffs";
import { breakthroughInfo } from "@/core/breakthrough";
import { cultivationStageOf } from "@/core/cultivationStage";
import { subClamp, toNum } from "@/utils/gnum";
import { baseCultPerSec } from "@/core/formulas";
import { modOf } from "@/core/statsCalc";
import { usePill } from "@/core/pillService";
import { qiRepairView, repairWithQi } from "@/core/qiRepair";
import { isRetreating } from "@/core/earlyGameService";
import { useNow } from "@/composables/useNow";
import { useProgressEta } from "@/composables/useProgressEta";
import { buffDef } from "@/data/buffs";
import { pillDef } from "@/data/pills";
import type { PillDef } from "@/types";
import { QI_BANK_MULT, QI_RICH_BONUS, QI_RICH_THRESHOLD_RATIO } from "@/data/constants";
import { expProgressNote } from "@/ui/expProgressNote";
import {
  formatCountdown,
  formatDuration,
  formatGN,
  formatNum,
  formatPercent,
  formatRate,
} from "@/utils/format";
import FolioPageHeader from "@/components/common/FolioPageHeader.vue";
import TapNumber from "@/components/common/TapNumber.vue";
import { qualityDef } from "@/data/qualities";
import ProgressBar from "@/components/common/ProgressBar.vue";
import GameIcon from "@/components/common/GameIcon.vue";
import GongfaDialog from "@/components/cultivation/GongfaDialog.vue";
import BuffDialog from "@/components/cultivation/BuffDialog.vue";
import RealmLadder from "@/components/cultivation/RealmLadder.vue";
import CultivationDial from "@/components/cultivation/CultivationDial.vue";
import InkScene from "@/components/common/InkScene.vue";
import FolioChapterHead from "@/components/common/FolioChapterHead.vue";
import GongfaSection from "@/components/cultivation/GongfaSection.vue";
import BreakthroughCard from "@/components/cultivation/BreakthroughCard.vue";
import ApexSeal from "@/components/cultivation/ApexSeal.vue";
import RetreatCard from "@/components/cultivation/RetreatCard.vue";
import QiShortfallNote from "@/components/cultivation/QiShortfallNote.vue";
import { cultivationChapter } from "@/ui/cultivationDesk";
import { skyOfWeather } from "@/ui/weatherSky";
import { todayWeather } from "@/core/weather";

const player = usePlayerStore();
const resources = useResourcesStore();
/**
 * 满级时「还差多久炼出一枚道源」。
 *
 * 与 `core/apexCultivation` 的折算同源(它读 `APEX_CULT_TO_DAO_RATIO`),
 * 不在这里另算一遍天数。未满级时返回空串,调用方那一格走原口径。
 */
/** 灵气是否已顶到存灵上限(满级之后判「满溢入炉」用) */
const qiAtBankCap = computed(() => resources.qi >= player.qiBankCapValue);

const apexFurnaceEtaText = computed(() =>
  player.atMaxRealm ? apexFurnaceEta(player.cultPerSec, toNum(player.expReq)) : "",
);

const practiceChapter = cultivationChapter("practice");
const nextChapter = cultivationChapter("next");
const supportChapter = cultivationChapter("support");

/**
 * 修炼速度的来路 —— 玩家最常盯的就是这一行,故就地摊开:
 *   基础(境界/层) × (1 + 各来源之和)
 * 来源取自 finalStats.breakdown,与人物页属性明细同源,不在界面里另算一遍。
 */
const showCultBreakdown = ref(false);
const cultBase = computed(() => baseCultPerSec(player.major, player.sub));
const cultSources = computed(() =>
  player.finalStats.breakdown
    .map((r) => ({ name: r.name, value: r.mods.cultivationSpeed ?? 0 }))
    .filter((r) => r.value !== 0),
);
const cultMultiplier = computed(() => modOf(player.finalStats.mods, "cultivationSpeed"));
const cultivation = useCultivationStore();
const inventory = useInventoryStore();
const ui = useUiStore();
const now = useNow();

/**
 * 突破卡的「下一步」标签读这里(目标境界名);卡的其余部分(成功率/劫势瓦片/
 * 破境增益/准备选项/突破钮/短差行)已随本体迁入 BreakthroughCard,不再两份。
 */
const btInfo = computed(() => breakthroughInfo());
/** 今日夜色 —— 与首页同一份(见 ui/weatherSky),挂在根上让那片星空继承 */
const sky = computed(() => skyOfWeather(todayWeather(player.major).id));
const skyStyle = computed(() => ({
  "--sky-star-rgb": `var(${sky.value.tint})`,
  "--sky-brightness": String(sky.value.brightness),
}));

const stage = computed(() =>
  cultivationStageOf({
    expFull: player.expFull,
    breakthroughReady: btInfo.value.ready,
    breakthroughReason: btInfo.value.reason,
    atMaxRealm: player.atMaxRealm,
    retreating: isRetreating(),
    injured: cultivation.hasBuff("injury"),
  }),
);

/**
 * 修为数值详情的两行 + 一句人话。
 *
 * 「还需」用 subClamp 算(不足则为 0),预计耗时 = 还需 ÷ 当前修为速度 ——
 * 到「京」这一档之后,绝对值本身看不出涨落,而这句"还需 3 天 2 时"每天都变,
 * 玩家据此判断自己是不是在前进。已圆满时不再报时间(那是在等突破,不是等修为)。
 *
 * 行骨架(上限→积余?→还需→预计 + ETA 三分支)与灵气详情同构,收进 useProgressEta
 * 一份实现;这里只喂口径与文案(GNum 大数折法、满态话术),不再自写行序。
 */
const {
  rows: expDetailRows,
  etaText: expEtaText,
  note: expDetailNote,
} = useProgressEta({
  cap: () => player.expReq,
  rate: () => player.cultPerSec,
  isFull: () => player.expFull,
  gap: () => toNum(subClamp(player.expReq, player.exp)),
  remain: () => subClamp(player.expReq, player.exp),
  capRow: { label: "所需", hint: "当前这一层的需求" },
  /**
   * 积余从主行挪进这里(玩家反馈:主行被它顶成两行)。
   * 它是**跨境界带走的那部分** —— 卡境期间继续攒,突破时只扣本境需求,
   * 所以这行不只是"多出来的数",还是一句"等待不白等"。
   */
  banked: {
    value: () => player.expOverflow,
    label: "积余",
    hint: "越过本境需求的部分;突破时随境界带走,不白攒",
  },
  remainRow: {
    label: "还需",
    hint: () => (player.expFull ? "已至圆满,可尝试突破" : `每秒 ${formatRate(player.cultPerSec)}`),
  },
  /**
   * 玩家点名要的那一行:绝对值到「京」以后看不出涨落,**"还要多久"才看得见变化** ——
   * 它每天都在动。故把它从脚注提成独立一行(用 text 走时长格式,没有精确值可展开)。
   */
  etaRow: { label: "预计", hint: "按当前修炼速度;未计战斗所得与丹药" },
  /**
   * 修为见满还需多久(已满/无速率时说人话,不给假时长)。
   *
   * 到顶之后没有「下一步是突破」—— 那一步不存在了。读到「已满 —— 下一步是突破」
   * 而人已经站在大道尽头,是把终点写成了中转站。
   */
  fullText: player.atMaxRealm ? "已满 —— 已是大道尽头" : "已满 —— 下一步是突破",
  almostText: "就要满了",
  rateEmptyText: "当前无修为进项",
  formatEta: (sec) => `约 ${formatDuration(sec)}`,
  note: () => {
    if (player.expFull) {
      return player.atMaxRealm
        ? "修为已满 —— 已是大道尽头,不必再攒。"
        : "修为已满 —— 下一步是突破,不是再攒。";
    }
    return undefined;
  },
});

/**
 * 「久等之时,还有更快的路」—— 只在 ETA 长到会让人以为卡住时才说一句。
 *
 * 真仙四层离圆满差二十多兆,按当前速度是三十八天。这个数字是对的(每秒八千五百万,
 * 确实是这个量级),但**孤零零一个「约 37天22小时」不解释任何事**:玩家看到的是
 * 「这游戏不动了」,而实际上旁边就写着一条现成的加速 —— 灵气充盈(+15%)只差两分半。
 *
 * 阈值取一天:一天之内的事,读 ETA 本身就有意义;超过一天,ETA 只是在报一个
 * 遥远的日期,这时该把「怎么变快」摆出来。
 */
const LONG_ETA_SEC = 86400;
const longEtaHint = computed(() => {
  if (player.expFull) return "";
  const remain = toNum(subClamp(player.expReq, player.exp));
  if (remain <= 0 || player.cultPerSec <= 0) return "";
  if (remain / player.cultPerSec < LONG_ETA_SEC) return "";
  // 充盈还没到 → 这是最近的一条加速;已经到了 → 指向「来路」摊开的那份明细
  if (qiRichInfo.value && !qiRichInfo.value.on && qiRichInfo.value.gap > 0) {
    const sec =
      player.qiRegenPerSec > 0
        ? Math.ceil(qiRichInfo.value.gap / player.qiRegenPerSec)
        : Number.POSITIVE_INFINITY;
    return Number.isFinite(sec)
      ? `久等 —— 灵气充盈后修炼快 ${formatPercent(QI_RICH_BONUS, 0)},充盈还差约 ${formatDuration(sec)}`
      : "久等 —— 灵气充盈后修炼更快,先让灵气回上去";
  }
  return "久等 —— 点「来路」看这一速由哪几处撑着,补一处就快一分";
});

/** 灵气同理:回满还要多久 —— 突破、疗伤、炼丹都在等这条线 */
const qiOverCap = computed(() => resources.qi > player.qiCapValue);
/** 灵气充盈(≥50% 标称容量 → 修炼 +QI_RICH_BONUS):把阈值与 off 态摊开,不让机制藏在结算里 */
const qiRichInfo = computed(() => {
  const threshold = player.qiCapValue * QI_RICH_THRESHOLD_RATIO;
  const on = player.qiRich;
  const gap = Math.max(0, threshold - resources.qi);
  return { on, threshold, gap };
});
const qiFillRatio = computed(() =>
  Math.max(0, Math.min(1, resources.qi / Math.max(1, player.qiCapValue))),
);
/** 标称容量之外还攒了多少 —— 主行只挂一个「+」,精确值在点开的详情里(行骨架走 useProgressEta) */
const { rows: qiDetailRows, note: qiDetailNote } = useProgressEta({
  cap: () => player.qiCapValue,
  rate: () => player.qiRegenPerSec,
  isFull: () => resources.qi >= player.qiCapValue,
  gap: () => player.qiCapValue - resources.qi,
  remain: () => Math.max(0, Math.floor(player.qiCapValue - resources.qi)),
  capRow: { label: "标称容量", hint: "进度条与上限判定走的这条线" },
  banked: {
    value: () => Math.max(0, Math.floor(resources.qi) - Math.floor(player.qiCapValue)),
    label: "积余",
    hint: () =>
      `容量之外还在攒的部分;可积到 ${formatNum(player.qiBankCapValue)}(容量的 ${QI_BANK_MULT} 倍)`,
  },
  remainRow: { label: "还差", hint: () => `每秒 ${formatRate(player.qiRegenPerSec)}` },
  etaRow: { label: "预计回满", hint: "按当前回复速度" },
  fullText: "已满",
  rateEmptyText: "当前无回复",
  formatEta: (sec) => `约 ${formatDuration(sec)}`,
  note: () => {
    if (resources.qi >= player.qiBankCapValue) {
      return `灵气已积到上限(${formatNum(player.qiBankCapValue)} = 容量的 ${QI_BANK_MULT} 倍)——不会再涨;突破、疗伤与炼丹会消耗它。`;
    }
    if (player.qiCapValue - resources.qi <= 0) return "灵气已满(标称容量),继续积余到上限为止。";
    return undefined;
  },
});

// Phase 28 闭关(状态/倒计时/前瞻折算/card-flash)已随本体迁入 components/cultivation/RetreatCard.vue
// 破境卡(btInfo 局部/btQiBlock/准备选项/破境增益/劫势瓦片/代价行/短差行)已随本体迁入
// components/cultivation/BreakthroughCard.vue —— 拆分第五轮 · 一。

/** 灵气疗伤(修复)状态:负伤时才出现入口,代价随灵气容量指数增长 */
const repair = computed(() => qiRepairView());
/**
 * 引气疗伤付不起时:短差与回够时长现算(与突破钮 btQiBlock 同款纪律)——
 * 灰钮不能只报「需 X」,站在钮前的人要知道差多少、等多久。
 */
const repairBlock = computed(() => {
  // 没有伤势时连疗伤入口都不存在,短差句也不该单独挂在卡里。
  if (!repair.value.injured || repair.value.affordable) return null;
  const short = Math.max(0, Math.ceil(repair.value.cost - resources.qi));
  const sec =
    player.qiRegenPerSec > 0 ? Math.ceil(short / player.qiRegenPerSec) : Number.POSITIVE_INFINITY;
  return { short, eta: Number.isFinite(sec) ? `约 ${formatDuration(sec)}` : "当前无回复" };
});

/**
 * 状态胶囊 —— 直接读 store 的"此刻真正生效"那一份(`activeBuffs`),与属性汇总、心跳剪枝
 * 共用库里的同一处判据:到期即散,不再出现"还剩 0 秒却还挂着"的一拍(见 ISS-231)。
 */
const activeBuffs = computed(() =>
  cultivation.activeBuffs.map((view) => ({
    def: view.def,
    remain: view.remainingSec,
    // 同刻的同类叠加份数(含自己):叠了才挂角标 —— 主屏一眼可见,与 BuffDialog「现效合计」同一台账
    stack: buffStackSize(
      view.def.mods,
      cultivation.activeBuffs.filter((v) => v !== view).map((v) => v.def.mods),
    ),
  })),
);

/**
 * 快捷栏一枚丹的一行药效 —— 「以药辅道」不只看名字猜,服下去会怎样就地给。
 * 读数取自 instant / buff 本体(与图鉴 itemText 同源,不另写一份)。
 */
function quickPillBrief(def: PillDef): string {
  const i = def.instant;
  if (def.kind === "buff" && def.buffId) {
    const b = buffDef(def.buffId);
    if (b) return `增益 ${Math.round(b.durationSec / 60)} 分钟`;
  }
  if (i) {
    if (i.expSecs) return `修为·约抵闭关 ${formatDuration(i.expSecs)}`;
    if (i.expFixed) return `修为 +${formatNum(i.expFixed)}`;
    if (i.qiPct) return `灵气 +上限${formatPercent(i.qiPct, 0)}`;
    if (i.lifespanYears) return `寿元 +${formatNum(i.lifespanYears)}`;
    if (i.wudao) return `悟道点 +${formatNum(i.wudao)}`;
  }
  return "";
}

const QUICK_PILL_LIMIT = 4;

/** 修行相关丹药快捷栏:按品质降序,越珍稀的越靠前(原为插入序,先拿到什么显什么) */
const quickPillRows = computed(() =>
  Object.entries(inventory.pills)
    .map(([id, count]) => ({ def: pillDef(id), count }))
    .filter((x) => x.def !== undefined && x.count > 0)
    .filter(
      (x) =>
        x.def!.kind === "buff" ||
        x.def!.instant?.expSecs ||
        x.def!.instant?.expFixed ||
        x.def!.instant?.qiPct,
    )
    .map((x) => ({
      ...x,
      // 状态丹顶满再吃 = 白费(usePill 在 full 也照吃):卡面先把「已顶/续时」标出,别等 toast 才明白
      overflow:
        x.def!.kind === "buff" && x.def!.buffId
          ? buffOverflowOf(cultivation.buffs, x.def!.buffId, now.value)
          : "none",
    }))
    .sort((a, b) => qualityDef(b.def!.quality).rank - qualityDef(a.def!.quality).rank),
);

const quickPills = computed(() => quickPillRows.value.slice(0, QUICK_PILL_LIMIT));
const quickPillsHidden = computed(() => quickPillRows.value.length - quickPills.value.length);
const supportFact = computed(() => {
  const parts = [];
  if (activeBuffs.value.length) parts.push(`${activeBuffs.value.length} 状态`);
  if (quickPillRows.value.length) parts.push(`${quickPillRows.value.length} 丹`);
  return parts.join(" · ");
});
</script>
