<template>
  <div class="stagger-in space-y-4 px-4 pb-6 pt-4">
    <!--
      卷首行 —— 世界名、匾额、这一境的名与注:它们回答的是「我在哪一界、走到第几境」,
      是一页的书名,不是一件可以操作的东西。故不铺卡、不压影,只在结尾落一道分隔线;
      卡从下面的「修行」开始。一道 430 行的大卡会把书名与读数拉成同一档。
    -->
    <div class="pb-2 text-center">
      <!-- 世界名带它的信标色(仙界=石青/神界=紫/混沌=幽蓝):修炼页是平时最常开的面,「这是哪一界」一眼可见 -->
      <p class="world-label font-kai text-[11px] tracking-[0.5em]">{{ player.worldName }}</p>
      <!--
        境界名是这一页的主角字 —— 两侧衬两条世界色短横,像匾额两端的框墨。
        只在宽裕的视口出现(min-360px):200% 缩放档有效视口只有 ~195px,
        横杆会让名字折成竖排反而挤 —— 窄了就让名字独行,回归原样。
      -->
      <p class="mt-1 flex items-center justify-center gap-2.5">
        <span
          class="hidden h-px w-8 shrink-0 bg-[var(--world-bar)] min-[360px]:inline"
          aria-hidden="true"
        />
        <span class="font-kai text-[30px] tracking-[0.3em] text-ink">{{ player.realm.name }}</span>
        <span
          class="hidden h-px w-8 shrink-0 bg-[var(--world-bar)] min-[360px]:inline"
          aria-hidden="true"
        />
      </p>
      <p class="mt-0.5 font-kai text-[14px] tracking-[0.4em] text-cinnabar">{{ player.subName }}</p>
      <p class="mt-1 text-[11px] text-ink-faint">{{ player.realm.desc }}</p>
      <!-- 可解释性:这一境取自何处、因何承接(典籍 / 网文常用 / 道家本源) -->
      <p class="mt-1 text-[10px] leading-relaxed text-ink-faint">
        「{{ player.realm.basis }}」{{ player.realm.lore }}
      </p>
    </div>
    <div class="ink-divider" aria-hidden="true" />

    <!--
      修行卡 —— 这一页的主卡,左侧一道世界色竖封条把它与下面的破境卡分开。
      卡名右侧是「第 N / 21 境」:境数读 REALMS.length,不手写(改境界表不撒谎)。
    -->
    <div class="card-ink border-l-2 border-l-[var(--world-bar)] px-4 py-3">
      <div class="flex items-baseline justify-between">
        <span class="font-kai text-[14px] tracking-[0.2em] text-ink">修 行</span>
        <span class="text-[11px] text-ink-faint tabular">
          第 {{ player.major + 1 }} / {{ REALMS.length }} 境
        </span>
      </div>
      <!-- 仙路 21 境全景:已至/当前/未至一眼可辨,界门立界,四界分列 -->
      <div class="mx-auto mt-3 max-w-xs">
        <RealmLadder :major="player.major" />
      </div>
      <div class="mt-4">
        <!--
          修为读数成组:标签行(修为 + 下一步)→ 条 → 尾行(还剩多少 / 来路)。
          从前「修为 +x/秒 ▸来路」与「现值 / 所需」挤在同一行、而「下一步」被一道分隔线
          隔到另一段里去 —— 同一个量拆成两处,读的人得来回找。
          主行的 flex-wrap 保留:200% 字号(布局视口 195px)下「下一步 → X」会换到
          第二行,值那一块本身仍是一行(主值行折行 = 判据红)。
        -->
        <div
          data-value-row
          class="mb-1 flex flex-wrap justify-between text-[11px] text-ink-soft tabular"
        >
          <span class="flex items-baseline gap-1">
            <span class="text-ink-faint">修为</span>
            <!--
              修为数可点:缩写照旧(排版不动),点开看精确值。
              详情里按玩家的建议分两行(现有 / 所需),并补上**还需**与**预计耗时** ——
              大数字看不出变化时,"还差多远、还要多久"才是真正被感知的那个量。
            -->
            <!--
              这里**永远显示真实修为**。从前写的是 `expFull ? expReq : exp` ——
              圆满之后那行就锁死在「所需」上,玩家盯着一个不动的数,得出的结论自然是
              「修为不涨」(实测反馈)。圆满该由后面的标记说明,不该拿假的现值去表达。
            -->
            <TapNumber
              :value="player.exp"
              title="修为"
              :rows="expDetailRows"
              :note="expDetailNote"
            />
            <span class="text-ink-faint">/ {{ formatGN(player.expReq) }}</span>
            <!--
              积余不进这一行:它是"次要读数",挤在主行上会把这一行顶成两行(窄屏尤其明显)——
              点开修为那个数就能看到精确的积余与它的去路(突破时随境界带走)。
              主行只留状态词(圆满),它短、而且解释"为什么这个数不再变"。
            -->
            <span v-if="player.expFull" class="text-jade">· 圆满</span>
          </span>
          <span class="text-ink-soft">下一步 → {{ btInfo.targetLabel }}</span>
        </div>
        <div :class="player.expFull ? 'bar-charged' : ''">
          <ProgressBar :value="player.expProgress" color="var(--color-cinnabar)" :height="10" />
        </div>
        <!--
          尾行两件事:还剩多远(百分比 + 现成 ETA 文案,都在别处算过,这里只读)与
          「来路」—— 修为速度的来路由它摊开,故它落在这一行而不是主行。
        -->
        <div class="mt-1 flex flex-wrap items-baseline justify-between gap-x-2 text-[11px]">
          <span class="text-ink-soft tabular">
            还剩 {{ formatPercent(1 - player.expProgress, 0) }} · {{ expEtaText }}
          </span>
          <!--
            「▸来路」实测只有 25px 宽 —— 高度给了 32 也没用,拇指按不到这么窄的一条。
            补到 28 用横向负外边距抵掉(`-mx-1.5 px-1.5`),视觉位置一分不动。
          -->
          <button
            class="tap-row -mx-1.5 -my-1 min-w-[28px] justify-center px-1.5 py-1.5 text-center text-[10px] text-ink-faint active:opacity-60"
            :aria-expanded="showCultBreakdown"
            @click="showCultBreakdown = !showCultBreakdown"
          >
            {{ showCultBreakdown ? "▾" : "▸" }}来路
          </button>
        </div>
        <!--
          长 ETA 的解释:一天以上的等待单凭一个日期说明不了什么,旁边得有一句
          「怎么让它变快」。见 longEtaHint 的注释。
        -->
        <p v-if="longEtaHint" class="mt-1 text-[10px] leading-relaxed text-ink-faint">
          {{ longEtaHint }}
        </p>
        <!-- 修炼速度是玩家最常盯的数,故在它自己那一行就地摊开:基础 × (1 + 各来源) -->
        <div
          v-if="showCultBreakdown"
          class="mt-2 rounded-md bg-paper-deep/60 px-2.5 py-2 text-[10px]"
        >
          <p class="text-ink-soft">
            基础 {{ formatRate(cultBase) }}({{ player.realm.name }}{{ player.subName
            }}{{ player.linggen ? `·${player.linggen.gradeName}` : "" }}) × (1 +
            <span class="tabular text-qing">{{ formatPercent(cultMultiplier) }}</span
            >) = <span class="tabular text-cinnabar">{{ formatRate(player.cultPerSec) }}</span>
          </p>
          <p v-for="row in cultSources" :key="row.name" class="mt-0.5 flex justify-between">
            <span class="text-ink-faint">{{ row.name }}</span>
            <span class="tabular" :class="row.value > 0 ? 'text-qing' : 'text-cinnabar'">
              {{ row.value > 0 ? "+" : "" }}{{ formatPercent(row.value) }}
            </span>
          </p>
          <p class="mt-1 text-[10px] leading-relaxed text-ink-faint">
            这些都是修炼速度的百分比加成,相加后乘在基础上 —— 与人物页属性明细同源。
          </p>
        </div>
      </div>
      <div class="ink-divider my-3" aria-hidden="true" />
      <div class="mt-3">
        <div data-value-row class="mb-1 flex justify-between text-[11px] text-ink-soft tabular">
          <span>灵气 +{{ formatRate(player.qiRegenPerSec) }}</span>
          <span>
            <TapNumber
              :value="Math.floor(resources.qi)"
              title="灵气"
              :rows="qiDetailRows"
              :note="qiDetailNote"
            >
              <!--
                行内照旧只给"看得懂的那一位":到标称容量就封顶(进度条也走这条线),
                超出的部分用一个小「+」提示"还有积余",精确值点开看 —— 免得主行被顶成两行。
              -->
              <span :class="qiOverCap ? 'text-qing' : ''">
                {{ formatNum(Math.min(Math.floor(resources.qi), player.qiCapValue))
                }}<template v-if="qiOverCap">+</template>
              </span>
            </TapNumber>
            / {{ formatNum(player.qiCapValue) }}
            <!--
              灵气积到银行上限就不再涨 —— 不说明的话,玩家只会以为它坏了。
              词收短到三字("已积至上限"在 320 宽后期档会把这一行顶折,自检当场量到过);
              完整的口径(上限值、不会再涨、怎么花)在点开的详情里。
            -->
            <span v-if="resources.qi >= player.qiBankCapValue" class="text-amber-ink"
              >· 已封顶</span
            >
          </span>
        </div>
        <ProgressBar
          :value="Math.min(1, resources.qi / Math.max(1, player.qiCapValue))"
          color="var(--color-qing)"
          :height="8"
        />
        <!--
          灵气充盈:灵气 ≥ 标称容量 QI_RICH_THRESHOLD_RATIO → 修炼 +QI_RICH_BONUS。
          off 态藏着不说是欺瞒 —— 玩家每日最常盯的就是修炼,这个加成答得上
          「我灵气满了该怎么花」。阈值与结算同读 QI_RICH_THRESHOLD_RATIO(见
          player.qirich),括号里的比率不许手写「一半」—— 改常数就撒谎。
        -->
        <p class="mt-1 text-[10px]" :class="qiRichInfo.on ? 'text-qing' : 'text-ink-faint'">
          <template v-if="qiRichInfo.on"
            >灵气充盈 —— 修炼速度 +{{ formatPercent(QI_RICH_BONUS) }}</template
          >
          <template v-else>
            距灵气充盈尚差 {{ formatNum(qiRichInfo.gap) }} 灵气(灵气 ≥
            {{ formatNum(qiRichInfo.threshold) }}(容量
            {{ formatPercent(QI_RICH_THRESHOLD_RATIO) }})→ 修炼 +{{ formatPercent(QI_RICH_BONUS) }})
          </template>
        </p>
        <!--
          以灵气疗伤(修复):灵气积余的用途,代价随境界指数增长。
          它是「顺手做的一件小事」,不是这一页的主行动 —— 故走 chip-ink,把唯一的
          btn-seal 留给突破钮(chip-ink 自带 nowrap,长文案在窄屏改为可折行)。
        -->
        <button
          v-if="repair.injured"
          type="button"
          class="chip-ink mt-2 w-full !py-2 !whitespace-normal text-[11px] justify-center"
          :disabled="!repair.affordable"
          @click="repairWithQi()"
        >
          {{
            repair.affordable
              ? `引气静养 · 平复伤势心魔 · 耗灵气 ${formatNum(repair.cost)}`
              : `灵气不足(需 ${formatNum(repair.cost)})`
          }}
        </button>
        <!-- 灵气不足只报四字,拦下的却是「还差多少、回够要多久」 —— 补齐直显,与突破钮 btQiBlock 同款 -->
        <p
          v-if="repairBlock"
          class="mt-1 text-center text-[10px] leading-relaxed text-cinnabar tabular"
        >
          尚差 {{ repairBlock.short }} 灵气,按当前回复{{ repairBlock.eta }}
        </p>
      </div>
    </div>

    <!--
      破境卡(下一步要不要做)→ BreakthroughCard:卡本体/准备选项/破境增益/劫势瓦片/
      代价行/短差行随本体迁入 —— 拆分第五轮 · 一。
    -->
    <BreakthroughCard />

    <!-- 闭关卡(Phase 28)→ RetreatCard:卡本体/前瞻折算/card-flash 随本体迁入 -->
    <RetreatCard />

    <!--
      主区(修行/破境/闭关)与辅区(状态/丹药/功法)之间落一枚花饰分隔:
      往下不再是「今天要做的事」,是「随身带着的家当」。
    -->
    <div class="ink-divider-mark my-4" aria-hidden="true" />

    <!-- 状态 -->
    <section v-if="activeBuffs.length">
      <SectionTitle title="状态" />
      <div class="mt-2 flex flex-wrap gap-2">
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
            class="text-[10px]"
            :aria-label="`${b.def!.name} 与 ${b.stack - 1} 味状态同刻叠加`"
            >×{{ b.stack }}</span
          >
          <span class="countdown-slot">{{ formatCountdown(b.remain) }}</span>
        </button>
      </div>
    </section>

    <!-- 丹药速服 -->
    <section v-if="quickPills.length">
      <SectionTitle title="以药辅道" />
      <!-- 极窄档(≤220 CSS px):两列时每张卡只有 78px,「存 5 · 修为 +」被压成 11px
           宽、9 行 —— 放开成单列,中间那块回到整行宽。320 / 390 两档不动。 -->
      <div class="mt-2 grid grid-cols-2 gap-2 tinylens:grid-cols-1">
        <button
          v-for="p in quickPills"
          :key="p.def!.id"
          class="card-ink flex items-center gap-2 px-3 py-2 text-left active:scale-98"
          :disabled="p.overflow === 'full'"
          @click="usePill(p.def!.id)"
        >
          <GameIcon
            :name="p.def!.icon"
            :size="16"
            :style="{ color: qualityDef(p.def!.quality).color }"
          />
          <span class="min-w-0 grow">
            <span class="block truncate font-kai text-[11px] text-ink">{{ p.def!.name }}</span>
            <span class="block text-[10px] text-ink-faint tabular">
              存 {{ p.count
              }}<template v-if="quickPillBrief(p.def!)"> · {{ quickPillBrief(p.def!) }}</template>
            </span>
          </span>
          <!-- 顶满=白费,禁用并改口;续时=只剩尾巴可续,照吃但把话说清 -->
          <span
            class="shrink-0 text-[11px]"
            :class="
              p.overflow === 'full'
                ? 'text-ink-faint'
                : p.overflow === 'partial'
                  ? 'text-amber-ink'
                  : 'text-jade'
            "
          >
            {{ p.overflow === "full" ? "已顶" : p.overflow === "partial" ? "续时" : "服用" }}
          </span>
        </button>
      </div>
    </section>

    <!-- 功法区(主修卡/一门一册书目/参悟)→ GongfaSection,整块随本体迁入 -->
    <GongfaSection />

    <GongfaDialog />
    <BuffDialog />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { usePlayerStore } from "@/stores/player";
import { useResourcesStore } from "@/stores/resources";
import { useCultivationStore } from "@/stores/cultivation";
import { useInventoryStore } from "@/stores/inventory";
import { useUiStore } from "@/stores/ui";
import { buffOverflowOf, buffStackSize } from "@/core/engineBuffs";
import { breakthroughInfo } from "@/core/breakthrough";
import { subClamp, toNum } from "@/utils/gnum";
import { baseCultPerSec } from "@/core/formulas";
import { modOf } from "@/core/statsCalc";
import { usePill } from "@/core/pillService";
import { qiRepairView, repairWithQi } from "@/core/qiRepair";
import { useNow } from "@/composables/useNow";
import { useProgressEta } from "@/composables/useProgressEta";
import { REALMS } from "@/data/realms";
import { buffDef } from "@/data/buffs";
import { pillDef } from "@/data/pills";
import type { PillDef } from "@/types";
import { QI_BANK_MULT, QI_RICH_BONUS, QI_RICH_THRESHOLD_RATIO } from "@/data/constants";
import {
  formatCountdown,
  formatDuration,
  formatGN,
  formatNum,
  formatPercent,
  formatRate,
} from "@/utils/format";
import TapNumber from "@/components/common/TapNumber.vue";
import { qualityDef } from "@/data/qualities";
import SectionTitle from "@/components/common/SectionTitle.vue";
import ProgressBar from "@/components/common/ProgressBar.vue";
import GameIcon from "@/components/common/GameIcon.vue";
import GongfaDialog from "@/components/cultivation/GongfaDialog.vue";
import BuffDialog from "@/components/cultivation/BuffDialog.vue";
import RealmLadder from "@/components/cultivation/RealmLadder.vue";
import GongfaSection from "@/components/cultivation/GongfaSection.vue";
import BreakthroughCard from "@/components/cultivation/BreakthroughCard.vue";
import RetreatCard from "@/components/cultivation/RetreatCard.vue";

const player = usePlayerStore();
const resources = useResourcesStore();

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
  /** 修为见满还需多久(已满/无速率时说人话,不给假时长) */
  fullText: "已满 —— 下一步是突破",
  almostText: "就要满了",
  rateEmptyText: "当前无修为进项",
  formatEta: (sec) => `约 ${formatDuration(sec)}`,
  note: () => {
    if (player.expFull) return "修为已满 —— 下一步是突破,不是再攒。";
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
  if (repair.value.affordable) return null;
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

/** 修行相关丹药快捷栏:按品质降序,越珍稀的越靠前(原为插入序,先拿到什么显什么) */
const quickPills = computed(() =>
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
    .sort((a, b) => qualityDef(b.def!.quality).rank - qualityDef(a.def!.quality).rank)
    .slice(0, 4),
);
</script>
