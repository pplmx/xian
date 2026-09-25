<template>
  <div class="stagger-in space-y-4 px-4 pb-6 pt-4">
    <!-- 境界与突破(修为圆满时整卡蓄势充能) -->
    <div class="card-ink px-4 py-4" :class="player.expFull ? 'card-charged' : ''">
      <div class="text-center">
        <p class="font-kai text-[11px] tracking-[0.5em] text-ink-faint">{{ player.worldName }}</p>
        <p class="font-kai text-[30px] tracking-[0.3em] text-ink">{{ player.realm.name }}</p>
        <p class="mt-0.5 font-kai text-[14px] tracking-[0.4em] text-cinnabar">{{ player.subName }}</p>
        <p class="mt-1 text-[11px] text-ink-faint">{{ player.realm.desc }}</p>
        <!-- 可解释性:这一境取自何处、因何承接(典籍 / 网文常用 / 道家本源) -->
        <p class="mt-1 text-[10px] leading-relaxed text-ink-faint">
          「{{ player.realm.basis }}」{{ player.realm.lore }}
        </p>
      </div>
      <div class="mt-4">
        <!--
          flex-wrap 只在这一行:200% 字号(布局视口 195px)下,「修为 +x/秒 ▸来路」与
          「现值 / 所需」加起来比这一行宽 —— 与其把右边的值折断(主值行折行 = 判据红),
          不如让值整块落到第二行:值本身仍是一行,一个字都不少。
        -->
        <div data-value-row class="mb-1 flex flex-wrap justify-between text-[11px] text-ink-faint tabular">
          <button class="-my-1 py-1.5 text-left active:opacity-60" @click="showCultBreakdown = !showCultBreakdown">
            修为 +{{ formatRate(player.cultPerSec) }}
            <span class="ml-0.5 text-[9px] text-ink-faint">{{ showCultBreakdown ? '▾' : '▸' }}来路</span>
          </button>
          <!--
            修为数可点:缩写照旧(排版不动),点开看精确值。
            详情里按玩家的建议分两行(现有 / 所需),并补上**还需**与**预计耗时** ——
            大数字看不出变化时,"还差多远、还要多久"才是真正被感知的那个量。
          -->
          <span>
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
            / {{ formatGN(player.expReq) }}
            <!--
              积余不进这一行:它是"次要读数",挤在主行上会把这一行顶成两行(窄屏尤其明显)——
              点开修为那个数就能看到精确的积余与它的去路(突破时随境界带走)。
              主行只留状态词(圆满),它短、而且解释"为什么这个数不再变"。
            -->
            <span v-if="player.expFull" class="text-jade">· 圆满</span>
          </span>
        </div>
        <div :class="player.expFull ? 'bar-charged' : ''">
        <ProgressBar :value="player.expProgress" color="var(--color-cinnabar)" :height="8" />
      </div>
      <!-- 修行速度是玩家最常盯的数,故在它自己那一行就地摊开:基础 × (1 + 各来源) -->
      <div v-if="showCultBreakdown" class="mt-2 rounded-md bg-paper-deep/60 px-2.5 py-2 text-[10px]">
        <p class="text-ink-soft">
          基础 {{ formatRate(cultBase) }}({{ player.realm.name }}{{ player.subName }}{{ player.linggen ? `·${player.linggen.gradeName}` : '' }})
          × (1 + <span class="tabular text-qing">{{ formatPercent(cultMultiplier) }}</span>)
          = <span class="tabular text-cinnabar">{{ formatRate(player.cultPerSec) }}</span>
        </p>
        <p v-for="row in cultSources" :key="row.name" class="mt-0.5 flex justify-between">
          <span class="text-ink-faint">{{ row.name }}</span>
          <span class="tabular" :class="row.value > 0 ? 'text-qing' : 'text-cinnabar'">
            {{ row.value > 0 ? '+' : '' }}{{ formatPercent(row.value) }}
          </span>
        </p>
        <p class="mt-1 text-[9px] leading-relaxed text-ink-faint">
          这些都是修行速度的百分比加成,相加后乘在基础上 —— 与人物页属性明细同源。
        </p>
      </div>
      </div>
      <div class="mt-3">
        <div data-value-row class="mb-1 flex justify-between text-[11px] text-ink-faint tabular">
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
                {{ formatNum(Math.min(Math.floor(resources.qi), player.qiCapValue)) }}<template v-if="qiOverCap">+</template>
              </span>
            </TapNumber>
            / {{ formatNum(player.qiCapValue) }}
            <!--
              灵气积到银行上限就不再涨 —— 不说明的话,玩家只会以为它坏了。
              词收短到三字("已积至上限"在 320 宽后期档会把这一行顶折,自检当场量到过);
              完整的口径(上限值、不会再涨、怎么花)在点开的详情里。
            -->
            <span v-if="resources.qi >= player.qiBankCapValue" class="text-qing">· 已封顶</span>
          </span>
        </div>
        <ProgressBar
          :value="Math.min(1, resources.qi / Math.max(1, player.qiCapValue))"
          color="var(--color-qing)"
          :height="8"
        />
        <!-- 以灵气疗伤(修复):灵气积余的用途,代价随境界指数增长 -->
        <button
          v-if="repair.injured"
          type="button"
          class="btn-seal mt-2 w-full !py-2 !text-[12px]"
          :disabled="!repair.affordable"
          @click="repairWithQi()"
        >
          {{ repair.affordable ? `引气疗伤 · 耗灵气 ${formatNum(repair.cost)}` : `灵气不足(需 ${formatNum(repair.cost)})` }}
        </button>
      </div>

      <div class="ink-divider my-4" />
      <div class="flex items-center justify-between text-[12px] text-ink-soft">
        <span>下一步:{{ btInfo.targetLabel }}</span>
      </div>
      <!--
        天劫步不显示「突破成功率」:那条路根本不掷这个骰子(见 breakthrough.attemptBreakthrough,
        渡劫走 runTribulation 的逐波推演),摆出来只会让人以为还有一个可以堆的概率。
      -->
      <div class="mt-2 grid gap-2" :class="btInfo.needTribulation ? 'grid-cols-1' : 'grid-cols-2'">
        <div v-if="!btInfo.needTribulation" class="rounded-md bg-paper-deep/60 px-2.5 py-1.5">
          <p class="text-[10px] text-ink-faint">进阶成功率(小进阶)</p>
          <p class="tabular text-[16px] font-kai leading-tight" :class="btInfo.rate >= 0.7 ? 'text-jade' : 'text-cinnabar'">
            {{ btInfo.rateText }}
          </p>
        </div>
        <div class="rounded-md bg-paper-deep/60 px-2.5 py-1.5">
          <p class="text-[10px] text-ink-faint">{{ btInfo.needTribulation ? '此劫' : '渡劫' }}</p>
          <template v-if="tribPlan">
            <p class="tabular text-[16px] font-kai leading-tight" :class="PLAN_COLOR[tribPlan.verdict]">
              {{ tribPlan.title }}
            </p>
            <p class="text-[10px] text-ink-faint">
              劫势:{{ verdictLabel(tribPlan.verdict) }}
              <template v-if="tribPlan.risks.length"> · {{ tribPlan.risks[0] }}</template>
            </p>
          </template>
          <p v-else class="text-[16px] font-kai leading-tight text-ink-faint">非大关</p>
        </div>
      </div>

      <!-- Phase 32.0 劫势详情(决意前评估:风险维度 + 建议,信息给足,决定留给玩家) -->
      <div v-if="tribPlan" class="mt-2 rounded-md border border-violet-ink/25 bg-violet-ink/5 px-3 py-2">
        <p class="text-[11px] text-violet-ink">{{ tribPlan.desc }}</p>
        <p class="mt-1.5 text-[10px] text-ink-faint tabular">
          准备:
          <span class="text-ink-soft">{{ PREP_NAMES.guard }} {{ PREP_STARS[tribPlan.prep.guard] }}</span>
          · {{ PREP_NAMES.sustain }} {{ PREP_STARS[tribPlan.prep.sustain] }}
          · {{ PREP_NAMES.resist }} {{ PREP_STARS[tribPlan.prep.resist] }}
          · {{ PREP_NAMES.burst }} {{ PREP_STARS[tribPlan.prep.burst] }}
        </p>
        <!--
          天劫是**按最大生命百分比**扣血的(见 core/formulas.tribulationWaveDamage),
          攻伐不进公式;防御与气血只能按「本境裸修为」折算成抗性与开劫水位,且两条都有上限。
          摊开读数是因为玩家最容易在这里误判:一身厚血厚防站在劫前,却不知道自己缺什么。
        -->
        <p class="mt-1 text-[10px] text-ink-faint tabular">
          此劫只认百分比 —— 天劫抗性 {{ formatPercent(tribLedger?.resist ?? 0, 0) }}(防御折算
          {{ formatPercent(tribLedger?.statResist ?? 0, 0) }})· 减伤 {{ formatPercent(tribLedger?.reduction ?? 0, 0) }} · 每波恢复
          {{ formatPercent(tribLedger?.sustain ?? 0, 1) }} · 开劫护持 {{ formatPercent(tribLedger?.guard ?? 0, 0) }}(气血折算
          {{ formatPercent(tribLedger?.statGuard ?? 0, 0) }})
        </p>
        <p class="mt-0.5 text-[10px] text-ink-faint">
          攻伐不进天劫公式;防御与气血按本境裸修为折算成上面的抗性与护持,各有上限 —— 血再厚也只能硬抗一部分,剩下的仍要抗性/减伤/恢复来补。进阶成功率与突破准备也只作用于小进阶,大关不看它们。
        </p>
        <!--
          界膜之劫:这一版对跨界那一关的规则加难(见 data/constants 的
          TRIB_WORLD_STEP_STAT_FOLD)。必须**在决意之前**说清楚 ——
          上一版玩家吃过"护持明明写着有,过劫时却像没有"的亏,
          那种误会不该靠失败去发现。
        -->
        <div v-if="worldStep" class="mt-2 rounded-md border border-cinnabar/30 bg-cinnabar/5 px-2.5 py-2">
          <p class="text-[10px] leading-relaxed text-cinnabar">
            界膜之劫:跨界这一关血肉之厚一概不算 —— 防御与气血折算出的抗性、开劫护持在此作废,只认词条与准备。
          </p>
        </div>
        <!-- 天威本身的长相:道数随境界涨、单波逐道加重,摊出来才知道护持该留到哪一段 -->
        <p v-if="tribWave" class="mt-0.5 text-[10px] text-ink-faint tabular">
          共 {{ tribWave.waves }} 道,单波 {{ formatPercent(tribWave.min, 0) }}–{{ formatPercent(tribWave.max, 0) }} 最大生命(合计约
          {{ formatPercent(tribWave.total, 0) }}),
          {{ tribPlan.def.waveShape === 'frontLoaded' ? '起手两道最重' : '逐道加重' }}
        </p>
        <p class="mt-1 text-[10px] text-ink-soft">主要风险:<span class="text-cinnabar">{{ tribPlan.risks.join('; ') }}</span></p>
        <p class="mt-1 text-[10px] text-ink-faint">{{ tribPlan.advice }}</p>
        <!-- Phase 32.2:灵根解开的那条路——说明这道劫为何对你不太一样(留一线,不是免死) -->
        <p v-if="reliefRoots.length" class="mt-1 text-[10px] text-jade">
          灵根相应:{{ reliefRoots.map(e => ELEMENTS[e].name).join('、') }}——此劫为你留了一线,能走到哪一步仍看自身准备
        </p>
      </div>
      <p data-value-row class="mt-1 text-[11px] text-ink-faint tabular">
        耗灵气 {{ formatNum(btInfo.qiCost) }}
        <template v-if="btInfo.needTribulation">
          ·
          <span class="text-violet-ink">此乃大关,需渡天劫</span>
        </template>
        <template v-else-if="btInfo.isMajor">· 大境界之槛</template>
      </p>

      <!-- Phase 28 突破准备:静坐调息 / 服聚气丹(无劫突破时,一次性加成) -->
      <div v-if="!btInfo.needTribulation" class="mt-2 rounded-md border border-ink/10 bg-paper-deep/50 px-2.5 py-2">
        <div class="flex items-center justify-between text-[10px] text-ink-faint">
          <span>突破准备(一次有效)</span>
          <!--
            倒计时一律走 formatCountdown(定宽),不用 formatDuration:
            后者每秒都可能改宽度,这枚胶囊一涨一缩,同一行的其余内容会跟着跳。
          -->
          <span v-if="btInfo.prep.sitting" class="text-amber-ink tabular">
            调息中 · <span class="countdown-slot">{{ formatCountdown(btInfo.prep.remainingSec) }}</span>
          </span>
          <span v-else-if="btInfo.prep.ready" class="text-jade">加成 +{{ Math.round(btInfo.prep.bonus * 100) }}% 就绪</span>
        </div>
        <!--
          两个准备选项并排,但 chip-ink 是 nowrap 的胶囊,320px 窄屏放不下两枚
          (实测第二枚右缘到 331px,越界 11px)。故允许换行:宽屏并排、窄屏上下。
        -->
        <div v-if="!btInfo.prep.sitting && !btInfo.prep.ready" class="mt-1.5 flex flex-wrap gap-1.5">
          <button type="button" class="chip-ink !py-1.5 text-[10px]" @click="startPrep('meditate')">
            {{ prepMeditate.label }} · {{ Math.round(prepMeditate.duration / 60) }}分钟
            +{{ Math.round(prepMeditate.bonusRate * 100) }}%
          </button>
          <button type="button" class="chip-ink !py-1.5 text-[10px]" :disabled="!prepCanPill" @click="startPrep('pill')">
            {{ prepPill.label }} · {{ prepPillCost }}灵石 +{{ Math.round(prepPill.bonusRate * 100) }}%
          </button>
        </div>
      </div>
      <button
        class="btn-seal mt-3 w-full !py-3"
        :class="{ 'animate-glow-pulse pulse-ready': btInfo.ready }"
        :disabled="!btInfo.ready"
        @click="attemptBreakthrough()"
      >
        {{ btInfo.ready ? (btInfo.needTribulation ? '引 劫 突 破' : '尝 试 突 破') : btInfo.reason }}
      </button>
    </div>

    <!-- Phase 28 闭关:5 分钟 +150% 修炼,期间禁止历练(数值唯一来源 = buffs.ts retreat + earlyGameService) -->
    <div class="card-ink px-4 py-3">
      <div class="flex items-center justify-between">
        <span class="text-[11px] text-ink-soft">闭关参悟</span>
        <span v-if="retreating" class="text-[10px] text-amber-ink tabular">
          闭关中 · <span class="countdown-slot">{{ formatCountdown(retreatRemaining) }}</span>
        </span>
      </div>
      <p class="mt-0.5 text-[10px] text-ink-faint">
        <!--
          文案里的时制要与真实时长对得上:闭关只有 5 分钟,一炷香却是 30 分钟 ——
          拿"一炷香"说 5 分钟,玩家按古语理解会以为半小时,那就成了撒谎。
        -->
        静坐片刻({{ retreatMinutes }} 分钟),修炼速度 +{{ retreatPct }}%;闭关期间无法外出历练。
      </p>
      <button v-if="!retreating" type="button" class="chip-ink mt-2 w-full !py-1.5 text-[11px]" @click="beginRetreat">
        闭关 · {{ retreatMinutes }}分钟 修炼 +{{ retreatPct }}%(期间无法历练)
      </button>
    </div>

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
          :class="b.def!.kind === 'injury' ? 'border-cinnabar/60 text-cinnabar' : 'border-jade/60 text-jade'"
          @click="ui.buffDetailId = b.def!.id"
        >
          <GameIcon :name="b.def!.icon" :size="11" />
          {{ b.def!.name }}
          <span class="countdown-slot">{{ formatCountdown(b.remain) }}</span>
        </button>
      </div>
    </section>

    <!-- 丹药速服 -->
    <section v-if="quickPills.length">
      <SectionTitle title="以药辅道" />
      <div class="mt-2 grid grid-cols-2 gap-2">
        <button
          v-for="p in quickPills"
          :key="p.def!.id"
          class="card-ink flex items-center gap-2 px-3 py-2 text-left active:scale-98"
          @click="usePill(p.def!.id)"
        >
          <GameIcon :name="p.def!.icon" :size="16" :style="{ color: qualityDef(p.def!.quality).color }" />
          <span class="min-w-0 grow">
            <span class="block truncate font-kai text-[12px] text-ink">{{ p.def!.name }}</span>
            <span class="block text-[10px] text-ink-faint">存 {{ p.count }}</span>
          </span>
          <span class="text-[11px] text-jade">服用</span>
        </button>
      </div>
    </section>

    <!-- 功法 -->
    <section>
      <SectionTitle title="功法" :hint="`残页 ${resources.page}`" />
      <div class="mt-2 space-y-2">
        <!-- 主修 -->
        <button
          v-if="mainDef"
          class="card-ink flex w-full items-center gap-3 px-3.5 py-3 text-left active:scale-99"
          @click="ui.gongfaDetailId = mainDef.id"
        >
          <span class="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-cinnabar/6 font-kai text-cinnabar">主</span>
          <span class="min-w-0 grow">
            <span class="block truncate font-kai text-[14px] text-ink">{{ mainDef.name }}</span>
            <span class="block text-[11px] text-ink-faint">
              第 {{ cultivation.learned[mainDef.id] }} 层 · {{ qualityDef(mainDef.quality).name }}
            </span>
          </span>
          <GameIcon name="flame" :size="15" class="text-cinnabar" />
        </button>

        <!-- 已习得列表(限高滚动,功法过多不撑爆页面) -->
        <div class="card-ink max-h-64 divide-y divide-ink/7 overflow-y-auto px-1">
          <button
            v-for="def in learnedList"
            :key="def!.id"
            class="flex w-full items-center gap-3 px-2.5 py-2.5 text-left active:bg-ink/4"
            @click="ui.gongfaDetailId = def!.id"
          >
            <span class="font-kai text-[13px]" :style="{ color: qualityDef(def!.quality).color }">{{ def!.name }}</span>
            <span class="text-[10px] text-ink-faint">{{ cultivation.learned[def!.id] }} 层</span>
            <!-- Phase 31 A3:已选分支显示道名;确有歧路可择时才招手,否则只报「圆满」 -->
            <span v-if="branchName(def!.id)" class="text-[10px] text-gold-ink">
              {{ branchName(def!.id) }}
            </span>
            <span v-else-if="canEnlighten(def!.id)" class="text-[10px] text-qing">待悟道 →</span>
            <span v-else-if="isFull(def!.id)" class="text-[10px] text-ink-faint">圆满</span>
            <span class="ml-auto text-[10px]" :class="equipStateOf(def!.id) ? 'text-jade' : 'text-ink-faint'">
              {{ equipStateOf(def!.id) || '未装配' }}
            </span>
          </button>
        </div>

        <!--
          参悟池还剩几部也报出来:藏经阁是「花残页赌一部没见过的」,
          玩家看不到池子还有多大,就无从判断这一注值不值。
        -->
        <button class="btn-ghost w-full" @click="comprehendGongfa()">
          于藏经阁参悟功法(残页×{{ COMPREHEND_PAGE_COST }})
          <span v-if="comprehendLeft > 0" class="ml-1 text-[10px] text-ink-faint">· 池中尚有 {{ comprehendLeft }} 部未参</span>
          <span v-else class="ml-1 text-[10px] text-ink-faint">· 此境功法已尽数参悟</span>
        </button>
      </div>
    </section>

    <GongfaDialog />
    <BuffDialog />
  </div>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { usePlayerStore } from '@/stores/player'
  import { useResourcesStore } from '@/stores/resources'
  import { useCultivationStore } from '@/stores/cultivation'
  import { useInventoryStore } from '@/stores/inventory'
  import { useUiStore } from '@/stores/ui'
  import { attemptBreakthrough, breakthroughInfo } from '@/core/breakthrough'
  import { prepareBreakthrough, startRetreat, isRetreating, getRetreatRemainingSec } from '@/core/earlyGameService'
  import { subClamp, toNum } from '@/utils/gnum'
  import { baseCultPerSec } from '@/core/formulas'
  import { modOf } from '@/core/statsCalc'
  import {
    currentStatGuard,
    currentTribulationPlan,
    currentTribulationRelief,
    guardScore,
    settlementResist,
    statFoldAt,
    sustainScore,
    tribulationWaveSpan,
    verdictLabel,
    type TribulationPlan
  } from '@/core/tribulationDecision'
  import { reliefElements, rootElements } from '@/core/linggenAffinity'
  import { comprehendGongfa } from '@/core/gongfaService'
  import { usePill } from '@/core/pillService'
  import { qiRepairView, repairWithQi } from '@/core/qiRepair'
  import { useNow } from '@/composables/useNow'
  import { BREAKTHROUGH_PREP_OPTIONS } from '@/data/earlyGame'
  import { GONGFA, gongfaDef } from '@/data/gongfa'
  import { ELEMENTS } from '@/data/linggen'
  import { canEnlighten as canEnlightenGongfa, gongfaBranchDef } from '@/data/gongfaBranches'
  import { buffDef } from '@/data/buffs'
  import { pillDef } from '@/data/pills'
  import { COMPREHEND_PAGE_COST, QI_BANK_MULT } from '@/data/constants'
  import { formatCountdown, formatDuration, formatGN, formatNum, formatPercent, formatRate } from '@/utils/format'
  import TapNumber from '@/components/common/TapNumber.vue'
  import { qualityDef } from '@/data/qualities'
  import SectionTitle from '@/components/common/SectionTitle.vue'
  import ProgressBar from '@/components/common/ProgressBar.vue'
  import GameIcon from '@/components/common/GameIcon.vue'
  import GongfaDialog from '@/components/cultivation/GongfaDialog.vue'
  import BuffDialog from '@/components/cultivation/BuffDialog.vue'

  const player = usePlayerStore()
  const resources = useResourcesStore()

  /**
   * 修行速度的来路 —— 玩家最常盯的就是这一行,故就地摊开:
   *   基础(境界/层) × (1 + 各来源之和)
   * 来源取自 finalStats.breakdown,与人物页属性明细同源,不在界面里另算一遍。
   */
  const showCultBreakdown = ref(false)
  const cultBase = computed(() => baseCultPerSec(player.major, player.sub))
  const cultSources = computed(() =>
    player.finalStats.breakdown
      .map(r => ({ name: r.name, value: r.mods.cultivationSpeed ?? 0 }))
      .filter(r => r.value !== 0)
  )
  const cultMultiplier = computed(() => modOf(player.finalStats.mods, 'cultivationSpeed'))
  const cultivation = useCultivationStore()
  const inventory = useInventoryStore()
  const ui = useUiStore()
  const now = useNow()

  const btInfo = computed(() => breakthroughInfo())

  /**
   * 修为数值详情的两行 + 一句人话。
   *
   * 「还需」用 subClamp 算(不足则为 0),预计耗时 = 还需 ÷ 当前修为速度 ——
   * 到「京」这一档之后,绝对值本身看不出涨落,而这句"还需 3 天 2 时"每天都变,
   * 玩家据此判断自己是不是在前进。已圆满时不再报时间(那是在等突破,不是等修为)。
   */
  const expDetailRows = computed(() => [
    { label: '所需', value: player.expReq, hint: '当前这一层的需求' },
    {
      label: '还需',
      value: subClamp(player.expReq, player.exp),
      hint: player.expFull ? '已至圆满,可尝试突破' : `每秒 ${formatRate(player.cultPerSec)}`
    },
    /**
     * 积余从主行挪进这里(玩家反馈:主行被它顶成两行)。
     * 它是**跨境界带走的那部分** —— 卡境期间继续攒,突破时只扣本境需求,
     * 所以这行不只是"多出来的数",还是一句"等待不白等"。
     */
    ...(toNum(player.expOverflow) > 0
      ? [{ label: '积余', value: player.expOverflow, hint: '越过本境需求的部分;突破时随境界带走,不白攒' }]
      : []),
    /**
     * 玩家点名要的那一行:绝对值到「京」以后看不出涨落,**"还要多久"才看得见变化** ——
     * 它每天都在动。故把它从脚注提成独立一行(用 text 走时长格式,没有精确值可展开)。
     */
    { label: '预计', text: expEtaText.value, hint: '按当前修为速率;未计战斗所得与丹药' }
  ])
  /** 修为见满还需多久(已满/无速率时说人话,不给假时长) */
  const expEtaText = computed(() => {
    if (player.expFull) return '已满 —— 下一步是突破'
    const remain = toNum(subClamp(player.expReq, player.exp))
    if (remain <= 0) return '就要满了'
    if (player.cultPerSec <= 0) return '当前无修为进项'
    return `约 ${formatDuration(remain / player.cultPerSec)}`
  })
  const expDetailNote = computed(() => {
    if (player.expFull) return '修为已满 —— 下一步是突破,不是再攒。'
    return undefined
  })

  /** 灵气同理:回满还要多久 —— 突破、疗伤、炼丹都在等这条线 */
  const qiOverCap = computed(() => resources.qi > player.qiCapValue)
  /** 标称容量之外还攒了多少 —— 主行只挂一个「+」,精确值在点开的详情里 */
  const qiBanked = computed(() => Math.max(0, Math.floor(resources.qi) - Math.floor(player.qiCapValue)))
  const qiDetailRows = computed(() => [
    { label: '标称容量', value: player.qiCapValue, hint: '进度条与上限判定走的这条线' },
    ...(qiBanked.value > 0
      ? [
          {
            label: '积余',
            value: qiBanked.value,
            hint: `容量之外还在攒的部分;可积到 ${formatNum(player.qiBankCapValue)}(容量的 ${QI_BANK_MULT} 倍)`
          }
        ]
      : []),
    {
      label: '还差',
      value: Math.max(0, Math.floor(player.qiCapValue - resources.qi)),
      hint: `每秒 ${formatRate(player.qiRegenPerSec)}`
    },
    { label: '预计回满', text: qiEtaText.value, hint: '按当前回复速度' }
  ])
  const qiEtaText = computed(() => {
    const gap = player.qiCapValue - resources.qi
    if (gap <= 0) return '已满'
    if (player.qiRegenPerSec <= 0) return '当前无回复'
    return `约 ${formatDuration(gap / player.qiRegenPerSec)}`
  })
  const qiDetailNote = computed(() => {
    if (resources.qi >= player.qiBankCapValue) {
      return `灵气已积到上限(${formatNum(player.qiBankCapValue)} = 容量的 10 倍)——不会再涨;突破、疗伤与炼丹会消耗它。`
    }
    if (player.qiCapValue - resources.qi <= 0) return '灵气已满(标称容量),继续积余到上限为止。'
    return undefined
  })

  // Phase 28 突破准备:按钮文案/耗时/药价全部来自 BREAKTHROUGH_PREP_OPTIONS,不再在视图里写第二份
  const prepMeditate = BREAKTHROUGH_PREP_OPTIONS.find(o => o.id === 'meditate')!
  const prepPill = BREAKTHROUGH_PREP_OPTIONS.find(o => o.id === 'pill')!
  const prepPillCost = prepPill.cost?.stone ?? 0
  const prepCanPill = computed(() => toNum(resources.spiritStone) >= prepPillCost)

  function startPrep(option: 'meditate' | 'pill'): void {
    if (prepareBreakthrough(option)) {
      ui.toast(option === 'meditate' ? '你盘膝入定,静待调息完成' : '丹药入腹,气机已然蓄足', 'info')
    } else {
      ui.toast('灵石不足,无以备药', 'warn')
    }
  }

  // Phase 28 闭关:状态与倒计时接 earlyGameService(buff 为真相源,重载后依旧可信)
  const retreating = computed(() => isRetreating())
  const retreatRemaining = computed(() => getRetreatRemainingSec(now.value)) // now 每秒刷新,倒计时走动
  /**
   * 闭关的时长与加成取自 buffs.ts 的 retreat 本体(不在这里手抄 5 分钟 / +150%)。
   * 之前注释写着"数值唯一来源 = buffs.ts",但文案里的数字是手打的 —— 改常数就会撒谎。
   */
  const retreatDef = buffDef('retreat')
  const retreatMinutes = Math.round((retreatDef?.durationSec ?? 0) / 60)
  const retreatPct = Math.round((retreatDef?.mods.cultivationSpeed ?? 0) * 100)
  function beginRetreat(): void {
    if (startRetreat()) {
      ui.toast('你封洞闭关,心不外骛', 'info')
    }
  }

  // Phase 32.0 天劫决策:劫型 + 准备度(仅大关天劫时)
  const PLAN_COLOR: Record<TribulationPlan['verdict'], string> = {
    danger: 'text-cinnabar',
    hard: 'text-amber-ink',
    ok: 'text-qing',
    easy: 'text-jade'
  }
  const PREP_NAMES = { guard: '护持', sustain: '恢复', resist: '抗性', burst: '爆发' } as const
  const PREP_STARS = ['·', '✧', '✧✧', '✧✧✧'] as const
  const tribPlan = computed(() => (btInfo.value.needTribulation ? currentTribulationPlan() : null))

  /**
   * 这一劫是不是「界膜」那一关(人间→仙界 / 仙界→神界 / 神界→混沌海)。
   *
   * 判据取自 tribulationDecision.statFoldAt(三维折算的折扣):
   * 界面与结算读的必须是同一个数,否则又会出现"显示有护持、结算没有"。
   */
  const tribTargetMajor = computed(() => (player.isMajorStep ? player.major + 1 : player.major))
  const worldStep = computed(() => statFoldAt(tribTargetMajor.value) < 1)

  /**
   * 渡劫账上的四项实际读数 —— 只摊天劫真的会读的那些,恢复/护持/抗性直接调
   * 结算的同一批函数(sustainScore / guardScore / settlementResist),界面不抄
   * 第二份系数。曾抄过:0.3/0.8 字面量与 easeDiscount 折叠全对不上(逆流劫
   * 界面报 30% 实际只有 19.5%),注释还写着「同源」—— 审计抓出来后根治。
   * 玩家按这个数决定补词条、换灵根,看到的就是结算的。
   */
  const tribLedger = computed(() => {
    if (!tribPlan.value) return null
    const mods = player.finalStats.mods
    const stat = currentStatGuard()
    const def = tribPlan.value.def
    const relief = currentTribulationRelief(tribPlan.value.kind)
    return {
      resist: settlementResist(mods, relief, stat),
      statResist: stat.resist,
      // 减伤同受结算的 0.6 上限:显示"此劫真的会读的"值,不拿全局裸减伤充数
      reduction: Math.min(0.6, modOf(mods, 'damageReduction')),
      sustain: sustainScore(mods, def, relief),
      guard: guardScore(mods, def, relief) + stat.guard,
      statGuard: stat.guard
    }
  })

  /** 天威本身的长相(道数 + 单波区间):与结算同一批函数,不在界面里另算一遍 */
  const tribWave = computed(() =>
    tribPlan.value
      ? tribulationWaveSpan(tribPlan.value.def, player.isMajorStep ? player.major + 1 : player.major)
      : null
  )

  /** 灵气疗伤(修复)状态:负伤时才出现入口,代价随灵气容量指数增长 */
  const repair = computed(() => qiRepairView())

  /** Phase 32.2 与此劫气机相应的灵根:判据取自 tribulationRelief,界面说的与结算做的同源 */
  const reliefRoots = computed(() =>
    tribPlan.value ? reliefElements(rootElements(player.linggen?.roots), tribPlan.value.kind) : []
  )

  /**
   * 状态胶囊 —— 直接读 store 的"此刻真正生效"那一份(`activeBuffs`),与属性汇总、心跳剪枝
   * 共用库里的同一处判据:到期即散,不再出现"还剩 0 秒却还挂着"的一拍(见 ISS-231)。
   */
  const activeBuffs = computed(() =>
    cultivation.activeBuffs.map(view => ({ def: view.def, remain: view.remainingSec }))
  )

  const learnedList = computed(() =>
    Object.keys(cultivation.learned)
      .map(id => gongfaDef(id))
      .filter(d => d !== undefined)
      .sort((a, b) => qualityDef(b!.quality).rank - qualityDef(a!.quality).rank)
  )

  const mainDef = computed(() => (cultivation.mainGongfa ? gongfaDef(cultivation.mainGongfa) : undefined))

  /** 参悟池里还剩几部 —— 与 comprehendGongfa 的池条件同源(minRealm ≤ 当前 + 1 且未习得) */
  const comprehendLeft = computed(
    () => GONGFA.filter(g => g.minRealm <= player.major + 1 && !cultivation.learned[g.id]).length
  )

  /** 修行相关丹药快捷栏:按品质降序,越珍稀的越靠前(原为插入序,先拿到什么显什么) */
  const quickPills = computed(() =>
    Object.entries(inventory.pills)
      .map(([id, count]) => ({ def: pillDef(id), count }))
      .filter(x => x.def !== undefined && x.count > 0)
      .filter(x => x.def!.kind === 'buff' || x.def!.instant?.expSecs || x.def!.instant?.expFixed || x.def!.instant?.qiPct)
      .sort((a, b) => qualityDef(b.def!.quality).rank - qualityDef(a.def!.quality).rank)
      .slice(0, 4)
  )

  function equipStateOf(id: string): string {
    if (cultivation.mainGongfa === id) return '主修'
    if (cultivation.subGongfa.includes(id)) return '辅修'
    return ''
  }

  /** 功行是否已至顶层 */
  function isFull(id: string): boolean {
    return (cultivation.learned[id] ?? 0) >= (gongfaDef(id)?.maxLevel ?? 9)
  }

  /** 是否真能悟道(判据取自 gongfaBranches,界面提示与实际可选项同源) */
  function canEnlighten(id: string): boolean {
    return canEnlightenGongfa(id, cultivation.learned[id] ?? 0)
  }

  /** 已择分支的道名;未择、或旧存档留着一个已下线的分支 id,都算没有 */
  function branchName(id: string): string | undefined {
    const branchId = cultivation.gongfaBranch[id]
    return branchId ? gongfaBranchDef(branchId)?.name : undefined
  }
</script>
