<template>
  <div class="folio-page folio-page--stack stagger-in legacy-page-shell">
    <FolioPageHeader
      class="legacy-masthead"
      title="三生录"
      subtitle="一世一笔，所知与旧缘都从这里续写"
      back-to="character"
      back-label="人物"
      featured
    >
      <template #meta>
        <p class="legacy-masthead__meta" data-legacy-current>
          <span>{{ stage.name }}</span>
          <span>第 {{ currentLife }} 世</span>
          <span>宿慧 {{ insight }}</span>
        </p>
      </template>
      <template #visual>
        <LegacyWheel
          :life="currentLife"
          :stage-mark="stage.name.slice(0, 1)"
          :stage-ratio="stageMeter.ratio"
          :lore-ratio="loreCoverage.ratio"
          :fate-ratio="fateMeter.ratio"
        />
      </template>
    </FolioPageHeader>

    <article class="legacy-register folio-span-all" data-legacy-register>
      <section
        class="legacy-profile"
        data-legacy-profile
        :data-state="profile ? 'formed' : 'unformed'"
      >
        <span class="legacy-profile__seal" aria-hidden="true">{{ profile ? "象" : "待" }}</span>
        <div class="legacy-profile__identity">
          <p class="legacy-profile__eyebrow">修行画像 · {{ endgame.marks.length }} 则道痕</p>
          <template v-if="profile">
            <p class="legacy-profile__verdict">「{{ profile.verdict }}」</p>
            <div class="legacy-profile__traits">
              <span>风险 {{ profile.riskText }}</span>
              <span>{{ profile.buildTendency }}</span>
              <span>常用 {{ profile.favoriteBuild }}</span>
              <span v-if="profile.favoritePacts.length">
                常契 {{ profile.favoritePacts.join(" / ") }}
              </span>
              <span v-if="profile.bestWorld">擅长 {{ profile.bestWorld }}</span>
              <span v-if="profile.weakWorld">薄弱 {{ profile.weakWorld }}</span>
            </div>
          </template>
          <template v-else>
            <p class="legacy-profile__verdict">
              「道痕未满{{ cnNumber(PROFILE_MIN_MARKS) }}则，画像尚不成形。」
            </p>
            <p class="legacy-profile__copy">
              画像只从真实道痕归纳；再走几程，风险、流派与擅长世界自会显出轮廓。
            </p>
          </template>
        </div>
        <div v-if="profile" class="legacy-profile__shares" aria-label="道途分布">
          <p v-for="d in profile.daoShares" :key="d.name" class="legacy-profile__share">
            <span>{{ d.name }}</span>
            <span class="legacy-profile__track">
              <span :style="{ width: `${clampPercent(d.pct)}%` }" />
            </span>
            <strong class="tabular">{{ formatPercent(d.pct / 100) }}</strong>
          </p>
        </div>
      </section>

      <LegacyChapterRail v-model="tab" :tabs="legacyRailTabs" />

      <section
        v-if="tab === 'samsara'"
        id="legacy-panel-samsara"
        class="legacy-tab legacy-tab--split"
        role="tabpanel"
        aria-labelledby="legacy-tab-samsara"
        data-legacy-tab="samsara"
      >
        <section class="legacy-ledger" data-legacy-samsara>
          <LedgerHeader
            seal="轮"
            eyebrow="本世总案"
            title="宿慧与随身所知"
            description="轮回阶只开见识；灵材、丹方、器谱与敌手路数才是跨世不灭的底账。"
            score-label="第"
            :score-value="currentLife"
            score-suffix="世"
          />

          <div class="legacy-ledger__grid legacy-ledger__grid--three">
            <article class="legacy-panel" data-legacy-stage>
              <!--
                这两行此前各写一遍 stage.name(小字副标签与下面的加粗大标题),
                连读起来就是「熟知修仙界 / 熟知修仙界」。而「宿慧 423」又与卷首
                meta 里那一枚重复(实测 top 203 与 622,同在首屏)。
                现在:标签行末报**本阶进度**,主行报阶名与宿慧总额 —— 三行各说一件事。
              -->
              <p class="legacy-panel__label">
                宿慧阶梯
                <span class="tabular">{{ stageMeter.value }} / {{ stageMeter.total }}</span>
              </p>
              <p class="legacy-panel__line">
                <strong>{{ stage.name }}</strong>
              </p>
              <p class="legacy-panel__copy">{{ stage.desc }}</p>
              <ProgressBar
                class="mt-2"
                :value="stageMeter.ratio"
                color="var(--color-cinnabar)"
                :height="3"
              />
              <p v-if="nextStage" class="legacy-panel__gap tabular">
                尚差 {{ stageMeter.remaining }} 宿慧入「{{ nextStage.name }}」
              </p>
              <p v-else class="legacy-panel__complete">此道已至尽头，宿慧仍可继续累积。</p>
              <!--
                这一阶换来什么 —— 上面只有阶名、描述、门槛,而 `SamsaraStageDef`
                有五个收益字段,界面上此前一个都没显示。「尚差 N 宿慧入某阶」
                这句话只说了一半:差多少查得到,换来什么查不到。

                两侧都报:当前阶（此刻有哪些）+ 下一阶（正在攒的东西）。
                文案由字段现生,不手写对照表 —— 改 SAMSARA_STAGES 时界面跟着变。
              -->
              <dl
                v-if="stageBenefits.length || nextStageBenefits.length"
                class="legacy-stage-gains"
              >
                <template v-if="stageBenefits.length">
                  <dt>此阶已有</dt>
                  <dd v-for="(line, i) in stageBenefits" :key="`now-${i}`" data-stage-gain-now>
                    {{ line }}
                  </dd>
                </template>
                <template v-if="nextStageBenefits.length">
                  <dt>入「{{ nextStage?.name }}」后</dt>
                  <dd
                    v-for="(line, i) in nextStageBenefits"
                    :key="`next-${i}`"
                    data-stage-gain-next
                  >
                    {{ line }}
                  </dd>
                </template>
              </dl>
            </article>

            <article class="legacy-panel" data-legacy-lore>
              <p class="legacy-panel__label">
                随身所知
                <span>不随转世清零</span>
              </p>
              <div class="legacy-lore">
                <div
                  v-for="row in loreRows"
                  :key="row.key"
                  class="legacy-lore__row"
                  :data-legacy-lore-row="row.key"
                >
                  <span class="legacy-lore__mark" aria-hidden="true">{{ row.mark }}</span>
                  <span class="legacy-lore__name">{{ row.name }}</span>
                  <span class="legacy-lore__value tabular">
                    {{ row.value }} / {{ row.total }} {{ row.unit }}
                  </span>
                  <!--
                    这一行各折多少宿慧 —— 五行权重差 4 倍（丹方一张 4 点、器谱一张
                    1 点），而抬头长得一模一样。不报折算，玩家读「通晓丹方 8 / 54」
                    不会知道它折了 32 点。0 点写「—」不写「+0」：后者像一个不存在的档位。
                  -->
                  <span
                    class="legacy-lore__insight tabular"
                    :data-legacy-lore-insight="row.key"
                    :class="{ 'is-zero': row.insight <= 0 }"
                  >
                    {{ row.insight > 0 ? `宿慧 +${row.insight}` : "—" }}
                  </span>
                  <span class="legacy-lore__track">
                    <span :style="{ width: `${row.meter.ratio * 100}%` }" />
                  </span>
                </div>
              </div>
              <p class="legacy-panel__copy">
                睁眼即识 {{ stage.knownMaterialRank }} 阶以下 · 已辨识
                {{ lore.knownMaterialCount }} 味，通晓用法 {{ lore.masteredMaterialCount }} 味。
              </p>
              <!--
                敌手谱 —— 上面那一行只报「洞悉了 N / 140 种」,那只是**到顶那一阶**。
                而认知是四阶段的系统(未识 → 眼熟 → 知其路数 → 洞悉,门槛 1 / 5 / 14 次),
                玩家看到 0 / 140 既不知道自己差在哪几阶,也不知道下一步该去打谁。
                这一页别处(灵材、器谱、丹方)都有逐项清单 —— 唯独敌手只有一行数。

                只列**见过**的:未识的不点名(图鉴通用的 ??? 纪律),只报还有多少种没照过面。
                阶名与门槛读引擎那份(见 ui/enemyLoreLedger),首领走它自己那张表。
              -->
              <div
                v-if="enemyLedger.known > 0"
                class="legacy-enemy-ledger"
                data-legacy-enemy-ledger
              >
                <p class="legacy-enemy-ledger__head">
                  <span>敌手谱</span>
                  <span class="tabular" data-legacy-enemy-stages>{{ enemyStageText }}</span>
                </p>
                <ul class="legacy-enemy-ledger__rows">
                  <li
                    v-for="row in enemyPage.visible"
                    :key="row.id"
                    class="legacy-enemy-ledger__row"
                    :data-legacy-enemy="row.id"
                    :data-enemy-stage="row.stageIndex"
                  >
                    <span class="legacy-enemy-ledger__stage">{{ row.stageName }}</span>
                    <span class="legacy-enemy-ledger__seen tabular">{{ row.seen }} 次</span>
                    <!--
                      「再 0 次」不是人话 —— 0 次意味着门槛已够,只是还没被下一次战斗
                      推到(存档里的阶与门前次数可能暂时不同步)。那种情形说「已够门槛」,
                      不说一个让人以为还要再打的数。
                    -->
                    <span
                      v-if="row.toNext !== null && row.toNext > 0"
                      class="legacy-enemy-ledger__next tabular"
                      >再 {{ row.toNext }} 次 · {{ row.nextStageName }}</span
                    >
                    <span v-else-if="row.toNext === 0" class="legacy-enemy-ledger__next"
                      >门槛已够 · {{ row.nextStageName }}</span
                    >
                    <span v-else class="legacy-enemy-ledger__maxed">已洞悉</span>
                  </li>
                </ul>
                <!--
                  一百四十种敌手不能让 DOM 一次铺完,也不能用 slice 永久截断 ——
                  被切掉的那些等于没有(`uiLayering.spec` 专门守这一条)。
                  与履历、行迹同一把尺:走 `listWindow`,余量显式报出并可续开。
                -->
                <button
                  v-if="enemyPage.hidden > 0"
                  type="button"
                  class="legacy-enemy-ledger__more tap-row"
                  data-legacy-enemy-more
                  @click="enemyLimit += ENEMY_RENDER_BATCH"
                >
                  再看 {{ nextEnemyBatch }} 种 · 余 {{ enemyPage.hidden }}
                </button>
                <p v-if="enemyLedger.unknown !== null" class="legacy-enemy-ledger__unknown">
                  还有 {{ enemyLedger.unknown }} 种尚未照面 —— 名字留白，路要自己走出来。
                </p>
              </div>
              <!--
                器谱进度 —— 上面那行「读通器谱 N / 288 张」只报到顶那一档。而掌握度是
                0~1 的连续值(每成功重铸一次增一档),玩家读不出:哪些快读通了、下一锤该
                砸哪张、以及自己到底读到了几分(0.9 与 0.1 在「0/288」里长得一样)。
                与敌手谱同一个形状:一个连续系统,界面只报了终点。
              -->
              <div
                v-if="blueprintDesk.known > 0"
                class="legacy-blueprint-desk"
                data-legacy-blueprint-desk
              >
                <p class="legacy-blueprint-desk__head">
                  <span>器谱进度</span>
                  <span class="tabular" data-legacy-blueprint-summary>{{ blueprintSummary }}</span>
                </p>
                <ul class="legacy-blueprint-desk__rows">
                  <li
                    v-for="row in blueprintPage.visible"
                    :key="row.id"
                    class="legacy-blueprint-desk__row"
                    :data-legacy-blueprint="row.id"
                    :data-blueprint-percent="row.percent"
                  >
                    <span class="legacy-blueprint-desk__name">{{ row.name }}</span>
                    <span class="legacy-blueprint-desk__percent tabular">{{ row.percent }}%</span>
                    <span v-if="row.mastered" class="legacy-blueprint-desk__done">已读通</span>
                    <span v-else-if="row.stalled" class="legacy-blueprint-desk__stalled"
                      >此谱不再增长</span
                    >
                    <span v-else class="legacy-blueprint-desk__left tabular"
                      >再 {{ row.untilMastered }} 次</span
                    >
                  </li>
                </ul>
                <button
                  v-if="blueprintPage.hidden > 0"
                  type="button"
                  class="legacy-blueprint-desk__more tap-row"
                  data-legacy-blueprint-more
                  @click="blueprintLimit += BLUEPRINT_RENDER_BATCH"
                >
                  再看 {{ nextBlueprintBatch }} 张 · 余 {{ blueprintPage.hidden }}
                </button>
                <!--
                  宿慧折算的口径 —— 上面逐张报「读到几分」，而宿慧只认「读通」那一档
                  （samsaraService.loreInsight 对器谱用 isBlueprintMastered、对敌人用
                  >= ENEMY_LORE_MAX、对丹方用 >= 1，三者同一条纪律）。
                  90% 与 100% 在宿慧上是 0 与 1 的差别，不是「多一点少一点」；
                  不说清的话，玩家看着 90% 会以为攒了不少。
                -->
                <p class="legacy-blueprint-desk__rule" data-legacy-insight-rule>
                  {{ insightRulesNote() }}
                </p>
              </div>
              <!--
                技艺进度 —— 九项技艺折的宿慧是五项里**权重最大**的一项(熟练度之和
                ÷ 20，最高 45 点；对比读通一张器谱只 1 点)。而此前它在界面上只有两处
                局部显示：重铸面板报「铭纹」一项、装备详情顺带列几条 —— 玩家看不到
                「我这世练出了什么手艺」，也不知道它是宿慧的主要来源。

                报境地名不报裸数字（crafting.ts 的注释：用叙事分档代替裸数字，
                避免玩家把技艺读成「等级」）；报「折多少宿慧」不报「熟练度之和」；
                按 SKILLS 原序排 —— 技艺无强弱之分。
              -->
              <div
                v-if="skillDesk.activeCount > 0"
                class="legacy-skill-desk"
                data-legacy-skill-desk
              >
                <p class="legacy-skill-desk__head">
                  <span>技艺进度</span>
                  <span class="tabular" data-legacy-skill-summary>{{ skillSummary }}</span>
                </p>
                <ul class="legacy-skill-desk__rows">
                  <li
                    v-for="row in skillDesk.rows"
                    :key="row.id"
                    class="legacy-skill-desk__row"
                    :data-legacy-skill="row.id"
                  >
                    <span class="legacy-skill-desk__name">{{ row.name }}</span>
                    <!--
                      所属的道:同一份数据在炼丹界面已经报了(BrewingDialog 的 daoName 列),
                      而这一页只报技艺名 —— 两处对同一件事的呈现不一致。道名比技艺名更粗一档,
                      放在中间不抢境地的位置。
                    -->
                    <span class="legacy-skill-desk__dao">{{ row.daoName }}</span>
                    <span class="legacy-skill-desk__stage">{{ row.stage }}</span>
                    <span v-if="row.nextStage" class="legacy-skill-desk__next"
                      >离{{ row.nextStage }} {{ formatPercent(row.progress, 0) }}</span
                    >
                    <span v-else class="legacy-skill-desk__top">已至{{ row.stage }}</span>
                  </li>
                </ul>
              </div>
            </article>

            <article class="legacy-panel" data-legacy-vow>
              <p class="legacy-panel__label">
                此世命题
                <span v-if="vowTheme" :data-state="vowState">{{ vowStateLabel }}</span>
                <span v-else>未立</span>
              </p>
              <template v-if="vowTheme">
                <p class="legacy-panel__line">
                  <strong>「{{ vowTheme.vow }}」</strong>
                  <span>{{ vowStateLabel }}</span>
                </p>
                <p class="legacy-panel__copy">{{ vowTheme.goal }}</p>
                <ProgressBar
                  v-if="vowMeter"
                  class="mt-2"
                  :value="vowMeter.ratio"
                  :color="
                    vowBroken
                      ? 'var(--color-amber-ink)'
                      : vowDone
                        ? 'var(--color-jade)'
                        : 'var(--color-cinnabar)'
                  "
                  :height="3"
                />
                <p v-if="vowProg" class="legacy-panel__gap tabular">
                  {{ Math.floor(vowProg.cur) }} / {{ vowProg.need }}
                  <span v-if="vowMeter && !vowMeter.complete">
                    · 尚差 {{ Math.max(0, vowProg.need - Math.floor(vowProg.cur)) }}
                  </span>
                </p>
              </template>
              <template v-else>
                <p class="legacy-panel__line"><strong>这一世尚未立题</strong></p>
                <p class="legacy-panel__copy">
                  兵解转世时可择一题而行；命题只判这一世，不追认前尘。
                </p>
              </template>
            </article>
          </div>

          <footer class="legacy-ledger__foot">
            <p v-for="stat in overviewStats" :key="stat.key" class="legacy-stat">
              <span>{{ stat.label }}</span>
              <strong class="tabular">{{ stat.value }}</strong>
            </p>
          </footer>
        </section>

        <section
          class="legacy-ledger legacy-history"
          :data-life-total="lifeRows.length"
          :data-life-shown="lifePage.shown"
          :data-life-start="lifePage.start"
        >
          <LedgerHeader
            variant="index"
            eyebrow="旧世归档"
            title="历世履历"
            :meta="
              lifeRows.length
                ? `现看 ${lifePage.start + 1}–${lifePage.shown} · 共 ${lifeRows.length} 世`
                : '初世'
            "
          />

          <!--
            历世灵根横向对照 —— 逐行读十世要自己心算十次，而「我这一路抽到的根
            在变好吗」有现成答案：资质地板随宿慧上浮，每一世的期望资质单调上升。
            只算记过灵根的那几世（老档缺这一栏就不进对照），一世都没记时整块不出。
          -->
          <div
            v-if="linggenSpread.state !== 'none'"
            class="legacy-spread"
            data-life-linggen-spread
            :data-spread-state="linggenSpread.state"
          >
            <p class="legacy-spread__head">
              <span class="legacy-spread__label">历世灵根</span>
              <span v-if="linggenSpread.state === 'spread'" class="legacy-spread__delta tabular">
                第一世 {{ linggenSpread.first?.average.toFixed(0) }} → 这一路
                {{ linggenSpread.last?.average.toFixed(0) }}
                <strong :class="linggenSpread.delta! >= 0 ? 'is-up' : 'is-down'">
                  {{ linggenSpread.delta! >= 0 ? "+" : "" }}{{ linggenSpread.delta!.toFixed(0) }}
                </strong>
              </span>
              <span v-else class="legacy-spread__single">只记了一世，还谈不上变化。</span>
            </p>
            <ol v-if="linggenSpread.state === 'spread'" class="legacy-spread__rows">
              <li
                v-for="point in linggenSpread.points"
                :key="point.index"
                class="legacy-spread__row"
                :class="{ 'is-best': point.index === linggenSpread.best?.index }"
                :data-spread-life="point.index"
              >
                <span class="legacy-spread__life tabular">第{{ point.index }}世</span>
                <span class="legacy-spread__grade font-kai">{{ point.grade }}</span>
                <span class="legacy-spread__roots" aria-hidden="true">
                  <span
                    v-for="root in point.roots"
                    :key="root.element"
                    class="legacy-spread__mark font-kai"
                    :style="{ borderColor: root.color, color: root.color }"
                    >{{ root.char }}</span
                  >
                </span>
                <span class="legacy-spread__avg tabular">{{ point.average.toFixed(0) }}</span>
                <span v-if="point.index === linggenSpread.best?.index" class="legacy-spread__best"
                  >最佳</span
                >
              </li>
            </ol>
          </div>

          <!--
            历世足迹 —— 逐行履历是「每一世的账」,这一块答的是「这一路走到哪」:
            终点境界的走向、最高那一世、平均终寿、宿慧累计。

            只报事实,不给评价 —— 转世是主动选择,短命的一世可能是为了早点换一手
            灵根;本作没有「这一世打得不好」这种评分。读不出的世不进那一条统计
            (0 境 = 凡人、0 岁 = 没活过,两个都是会被误读的数)。
          -->
          <div
            v-if="footprint.state !== 'none'"
            class="legacy-footprint"
            data-life-footprint
            :data-footprint-state="footprint.state"
          >
            <p class="legacy-footprint__head">
              <span class="legacy-footprint__label">历世足迹</span>
              <span class="legacy-footprint__lives tabular">共 {{ footprint.lives }} 世</span>
              <span
                v-if="footprint.trend"
                class="legacy-footprint__trend tabular"
                :class="`is-${footprint.trend}`"
                data-footprint-trend
                >{{ footprint.trendText }}</span
              >
              <span v-else class="legacy-footprint__single">只此一世，还看不出走势。</span>
            </p>
            <dl class="legacy-footprint__facts">
              <div>
                <dt>走到最深</dt>
                <dd class="tabular">
                  <template v-if="footprint.best"
                    >第{{ footprint.best.index }}世 · {{ footprint.best.realmLabel }}</template
                  >
                  <template v-else>未记</template>
                </dd>
              </div>
              <div>
                <dt>平均终寿</dt>
                <dd class="tabular">
                  <template v-if="footprint.averageAge !== null">
                    {{ footprint.averageAge }} 载
                    <small>按 {{ footprint.ageSamples }} 世</small>
                  </template>
                  <template v-else>未记</template>
                </dd>
              </div>
              <div>
                <dt>宿慧累计</dt>
                <dd class="tabular">{{ footprint.insightTotal }}</dd>
              </div>
            </dl>
          </div>

          <div class="legacy-history__list">
            <template v-if="lifeRows.length">
              <article
                v-for="l in lifePage.visible"
                :key="l.index"
                :data-life-row="l.index"
                tabindex="-1"
                class="legacy-history__row"
              >
                <span class="legacy-history__index tabular">第{{ l.index }}世</span>
                <div class="legacy-history__copy">
                  <p class="legacy-history__line">
                    <strong>{{ l.realmLabel }}</strong>
                    <span>寿 {{ l.age }} 载</span>
                    <!--
                      道历 —— 同一页的长恨录早就印着归档日期,履历行此前一个字都没有。
                      十世回望时「上一次转世是几天前」是最自然的索引。
                      读不出时整条不出(见 ui/lifeDate 的注释)。
                    -->
                    <span v-if="l.dateText" class="legacy-history__date tabular" data-life-date>{{
                      l.dateText
                    }}</span>
                  </p>
                  <!--
                    那一世睁眼抽到的灵根 —— 转世弹窗在当次看得见，旧账里此前一个字都没留。
                    品阶名照说存档里的原话，五行只印徽记（单字 + 该系语义色，与人物页、
                    创角页、转世确认页同一份 data/linggen）。

                    圆章是**纯视觉**的：单字「水雷」连读不成话，色值读屏更念不出来。
                    故徽记整组 aria-hidden，另给一句读屏文本把「哪一系、资质多少」说全
                    （与人物页灵根牌的 title 同一口径，见 ui/lifeLinggen 的 spoken）。
                    老存档没有这一栏 → lifeLinggen 返回 null，整行不出。
                  -->
                  <p v-if="l.linggenRow" class="legacy-history__linggen" data-life-linggen>
                    <span class="legacy-history__linggen-grade">{{ l.linggenRow.grade }}</span>
                    <span class="legacy-history__linggen-marks" aria-hidden="true">
                      <span
                        v-for="root in l.linggenRow.roots"
                        :key="root.element"
                        class="legacy-history__linggen-mark font-kai"
                        :style="{ borderColor: root.color, color: root.color }"
                        :title="root.spoken"
                        >{{ root.char }}</span
                      >
                    </span>
                    <span class="sr-only">{{ linggenSpoken(l.linggenRow) }}</span>
                  </p>
                  <p v-if="l.themeName" class="legacy-history__theme" :class="l.resultColor">
                    {{ l.themeName }} · {{ l.resultText }}
                  </p>
                  <p v-else class="legacy-history__quiet">此世未立命题</p>
                  <!--
                    逆旅契:那一世你自己挑的逆境。契文只加难,故它不是成就而是行迹 ——
                    与命题那一行并排,各说一件事(一个是你立的题,一个是你签的契)。
                  -->
                  <p v-if="l.trial" class="legacy-history__trial" data-life-trial>
                    <span class="legacy-history__trial-seal font-kai" aria-hidden="true">{{
                      l.trial.seal
                    }}</span>
                    <span>{{ l.trial.name }}</span>
                  </p>
                </div>
                <span class="legacy-history__insight tabular">宿慧 +{{ l.insight }}</span>
              </article>
              <div v-if="lifePage.start > 0 || lifePage.hidden > 0" class="legacy-pager">
                <button
                  v-if="lifePage.start > 0"
                  type="button"
                  data-life-prev
                  class="chip-ink !whitespace-normal text-center t-note text-ink-soft active:scale-95"
                  :aria-label="previousLifeText()"
                  @click="showPreviousLives"
                >
                  {{ previousLifeText() }}
                </button>
                <button
                  v-if="lifePage.hidden > 0"
                  type="button"
                  data-life-more
                  class="chip-ink !whitespace-normal text-center t-note text-cinnabar active:scale-95"
                  :aria-label="moreLifeText()"
                  :data-promised="lifePromise"
                  @click="showMoreLives"
                >
                  {{ moreLifeText() }}
                </button>
              </div>
            </template>
            <p v-else class="legacy-empty">此为初世。你尚未死过一次，也就还没有什么可以回忆。</p>
          </div>
        </section>
      </section>

      <section
        v-else-if="tab === 'chronicle'"
        id="legacy-panel-chronicle"
        class="legacy-tab"
        role="tabpanel"
        aria-labelledby="legacy-tab-chronicle"
        data-legacy-tab="chronicle"
      >
        <section class="legacy-ledger" data-legacy-chronicle>
          <LedgerHeader
            seal="年"
            eyebrow="按年岁读的账"
            title="行年"
            description="图鉴、名号与灵兽三处各记了「何时得来的」，这里按世与岁排成一条年谱；旧世只有终局一笔。"
            score-label="此世"
            :score-value="chronicleHead.count"
            score-suffix="笔"
          />

          <!--
            卷首一句只报**此刻这一世**的账：别的世的笔数在下面的分卷里。
            报总数会读成「这一世做了 N 件事」。
          -->
          <p class="legacy-chronicle__headline" data-legacy-chronicle-headline>
            {{ chronicleHead.text }}
          </p>
          <p
            v-if="chronicleLegacy > 0"
            class="legacy-chronicle__legacy"
            data-legacy-chronicle-legacy
          >
            另有 {{ chronicleLegacy }} 笔早年的账未记道历，只能留在原来那几册里。
          </p>

          <div v-if="chronicleVolumes.length" class="legacy-chronicle__kinds" aria-label="笔数按类">
            <span v-for="k in chronicleKindRows" :key="k.kind" class="legacy-chronicle__kind">
              <span class="legacy-chronicle__kind-mark" aria-hidden="true">{{ k.mark }}</span>
              {{ k.name }}
              <strong class="tabular">{{ k.count }}</strong>
            </span>
          </div>

          <div v-if="chronicleVolumes.length" class="legacy-chronicle__volumes">
            <article
              v-for="volume in chroniclePage.visible"
              :key="volume.life"
              class="legacy-chronicle__volume"
              :data-state="volume.current ? 'current' : 'past'"
              :data-legacy-chronicle-volume="volume.life"
            >
              <p class="legacy-chronicle__volume-head">
                <span class="legacy-chronicle__volume-mark" aria-hidden="true">第</span>
                <strong class="tabular">{{ volume.life }}</strong>
                <span>世</span>
                <span v-if="volume.current" class="legacy-chronicle__here">此世</span>
                <!-- 报本卷**共有**几笔,不报这一帧铺了几行 —— 后者是个会随续开变动的实现细节 -->
                <span class="legacy-chronicle__volume-count tabular">{{ volume.total }} 笔</span>
              </p>
              <ol class="legacy-chronicle__rows">
                <li
                  v-for="row in chronicleRowsOf(volume).rows"
                  :key="row.id"
                  class="legacy-chronicle__row"
                  :data-legacy-chronicle-row="row.id"
                >
                  <span class="legacy-chronicle__mark" :data-kind="row.kind" aria-hidden="true">{{
                    row.kindLabel
                  }}</span>
                  <span class="legacy-chronicle__text">{{ chronicleRowText(row) }}</span>
                </li>
              </ol>
              <!--
                本卷还有没铺的行:说清余几笔,并给一个真正能续开的入口。
                后期此世光图鉴就两百多条,一帧全铺会让这一册比同页其余几册重一个量级。
              -->
              <button
                v-if="chronicleRowsOf(volume).hidden > 0"
                type="button"
                class="chip-ink legacy-chronicle__more !whitespace-normal text-center t-note text-cinnabar active:scale-95"
                :data-chronicle-row-more="volume.life"
                :data-promised="chronicleRowPromise(volume)"
                :aria-label="moreChronicleRowsText(volume)"
                @click="showMoreChronicleRows(volume.life)"
              >
                {{ moreChronicleRowsText(volume) }}
              </button>
            </article>

            <div v-if="chroniclePage.start > 0 || chroniclePage.hidden > 0" class="legacy-pager">
              <button
                v-if="chroniclePage.start > 0"
                type="button"
                data-chronicle-prev
                class="chip-ink !whitespace-normal text-center t-note text-ink-soft active:scale-95"
                :aria-label="previousChronicleText()"
                @click="showPreviousChronicle"
              >
                {{ previousChronicleText() }}
              </button>
              <button
                v-if="chroniclePage.hidden > 0"
                type="button"
                data-chronicle-more
                class="chip-ink !whitespace-normal text-center t-note text-cinnabar active:scale-95"
                :aria-label="moreChronicleText()"
                :data-promised="chroniclePromise"
                @click="showMoreChronicle"
              >
                {{ moreChronicleText() }}
              </button>
            </div>
          </div>
          <p v-else class="legacy-empty">年谱尚白。图鉴、名号与灵兽各自入册之日，这里自会起笔。</p>
        </section>
      </section>

      <section
        v-else-if="tab === 'journey'"
        id="legacy-panel-journey"
        class="legacy-tab"
        role="tabpanel"
        aria-labelledby="legacy-tab-journey"
        data-legacy-tab="journey"
      >
        <section class="legacy-ledger" data-legacy-journey>
          <LedgerHeader
            seal="程"
            eyebrow="跨世行迹"
            title="修行节点与宿敌"
            description="节点是首次破界留下的路标；宿敌只记败过三次以上的对手，雪耻后仍留名。"
            score-label="节点"
            :score-value="milestoneRows.length"
            :score-suffix="`/ ${MILESTONE_DEFS.length}`"
          />

          <div class="legacy-ledger__grid">
            <article class="legacy-panel">
              <p class="legacy-panel__label">
                修行节点
                <span>{{ milestoneRows.length }} / {{ MILESTONE_DEFS.length }}</span>
              </p>
              <div v-if="milestoneRows.length" class="legacy-timeline">
                <article
                  v-for="row in milestoneRows"
                  :key="row.id"
                  class="legacy-timeline__row"
                  :data-legacy-milestone="row.id"
                >
                  <span class="legacy-timeline__mark tabular">{{ row.life }}</span>
                  <div class="legacy-timeline__copy">
                    <p class="legacy-panel__line">
                      <strong>{{ row.name }}</strong>
                      <span>第 {{ row.life }} 世</span>
                    </p>
                    <p class="legacy-panel__copy">{{ row.desc }}</p>
                  </div>
                </article>
              </div>
              <p v-else class="legacy-empty">此录尚白。天界之行，自会留名。</p>
            </article>

            <article class="legacy-panel">
              <p class="legacy-panel__label">
                征战录
                <span>宿敌 {{ nemesisRows.length }} 位</span>
              </p>
              <div v-if="nemesisRows.length" class="legacy-duels">
                <article
                  v-for="n in nemesisRows"
                  :key="n.enemyId"
                  class="legacy-duel"
                  :data-state="n.avengedAt ? 'avenged' : 'active'"
                  :data-legacy-nemesis="n.enemyId"
                >
                  <span class="legacy-duel__mark" aria-hidden="true">
                    {{ n.avengedAt ? "雪" : "仇" }}
                  </span>
                  <div class="legacy-duel__copy">
                    <p class="legacy-panel__line">
                      <strong>{{ n.enemyName }}</strong>
                      <span>{{ n.regionName }} · 败我 {{ n.lossCount }} 次</span>
                    </p>
                    <p class="legacy-duel__state">
                      {{ n.avengedAt ? "已雪耻，旧名仍在册" : "尚为宿敌，下一战可雪耻" }}
                    </p>
                  </div>
                </article>
              </div>
              <p v-else class="legacy-empty">尚无宿敌。此录待你的血与道来填。</p>
            </article>
          </div>
        </section>
      </section>

      <section
        v-else-if="tab === 'fate'"
        id="legacy-panel-fate"
        class="legacy-tab legacy-tab--split"
        role="tabpanel"
        aria-labelledby="legacy-tab-fate"
        data-legacy-tab="fate"
      >
        <section class="legacy-ledger" data-legacy-fate>
          <LedgerHeader
            seal="缘"
            eyebrow="未了之缘"
            title="奇缘录"
            description="只有起了头的缘才在此露面；已了与缘断都留结局，不把旧选择一笔抹掉。"
            score-label="未了"
            :score-value="unfinishedChains"
            score-suffix="条"
          />

          <div v-if="chainRows.length" class="legacy-fate__list">
            <article
              v-for="c in chainRows"
              :key="c.id"
              class="legacy-fate__row"
              :data-state="c.broken ? 'broken' : c.finished ? 'finished' : 'open'"
            >
              <span class="legacy-fate__mark" aria-hidden="true">
                {{ c.broken ? "断" : c.finished ? "了" : "续" }}
              </span>
              <div class="legacy-fate__copy">
                <p class="legacy-panel__line">
                  <strong>{{ c.name }}</strong>
                  <span>
                    {{
                      c.broken ? "缘断" : c.finished ? "已了" : `第 ${c.stage + 1}/${c.total} 程`
                    }}
                  </span>
                </p>
                <p class="legacy-panel__copy">
                  {{ c.broken ? "缘断，不复再续" : c.hint }}
                </p>
              </div>
            </article>
          </div>
          <p v-else class="legacy-empty">尚无未了之缘。缘起于路上，不在名录里。</p>
        </section>

        <section
          class="legacy-ledger legacy-loss"
          :data-loss-total="lossTotal"
          :data-loss-shown="lossPage.shown"
          :data-loss-start="lossPage.start"
        >
          <LedgerHeader
            variant="index"
            eyebrow="世界回响"
            title="行迹录"
            :meta="
              lossTotal
                ? `现看 ${lossPage.start + 1}–${lossPage.shown} · 共 ${lossTotal} 则`
                : '尚无回响'
            "
          />

          <div class="legacy-loss__list">
            <template v-if="lossRows.length">
              <article
                v-for="l in lossPage.visible"
                :key="l.eventId + l.at"
                :data-loss-row="l.eventId"
                tabindex="-1"
                class="legacy-loss__row"
              >
                <span class="legacy-loss__date tabular">{{ formatDate(l.at) }}</span>
                <div class="legacy-loss__copy">
                  <p class="legacy-panel__line">
                    <strong>{{ l.eventName }}</strong>
                  </p>
                  <p class="legacy-panel__copy">{{ l.note }}</p>
                </div>
              </article>
              <div v-if="lossPage.start > 0 || lossPage.hidden > 0" class="legacy-pager">
                <button
                  v-if="lossPage.start > 0"
                  type="button"
                  data-loss-prev
                  class="chip-ink !whitespace-normal text-center t-note text-ink-soft active:scale-95"
                  :aria-label="previousLossText()"
                  @click="showPreviousLoss"
                >
                  {{ previousLossText() }}
                </button>
                <button
                  v-if="lossPage.hidden > 0"
                  type="button"
                  data-loss-more
                  class="chip-ink !whitespace-normal text-center t-note text-cinnabar active:scale-95"
                  :aria-label="moreLossText()"
                  :data-promised="lossPromise"
                  @click="showMoreLoss"
                >
                  {{ moreLossText() }}
                </button>
              </div>
            </template>
            <p v-else class="legacy-empty">
              世界尚未记住你的足迹。此录待你行过此世，自会留下回响。
            </p>
          </div>
        </section>
      </section>

      <section
        v-else
        id="legacy-panel-record"
        class="legacy-tab"
        role="tabpanel"
        aria-labelledby="legacy-tab-record"
        data-legacy-tab="record"
      >
        <section class="legacy-ledger" data-legacy-record>
          <LedgerHeader
            seal="极"
            eyebrow="只与过去的自己比"
            title="极境纪录"
            description="每一格都记破界那一刻的实值；未立不是零，只表示还没走到可比较的一战。"
            score-label="已立"
            :score-value="recordCount"
            :score-suffix="`/ ${RECORD_DEFS.length}`"
          />

          <div class="legacy-record__list">
            <article
              v-for="r in recordRows"
              :key="r.id"
              class="legacy-record__row"
              :data-state="r.record ? 'set' : 'empty'"
              :data-legacy-record-row="r.id"
            >
              <span class="legacy-record__mark" aria-hidden="true">{{
                r.record ? "极" : "待"
              }}</span>
              <div class="legacy-record__copy">
                <p class="legacy-panel__line">
                  <strong>{{ r.name }}</strong>
                  <span v-if="r.record">第{{ r.record.life }}世 · {{ r.record.note }}</span>
                  <span v-else>尚未立纪录</span>
                </p>
                <p class="legacy-panel__copy">
                  {{ r.record ? "此项已记入跨世极境，后续只接受更好的结果。" : r.emptyCopy }}
                </p>
              </div>
              <strong class="legacy-record__value tabular">{{ r.valueText }}</strong>
            </article>
          </div>
          <footer class="legacy-ledger__foot legacy-record__foot">
            <ProgressBar
              class="min-w-0 flex-1"
              :value="recordMeter.ratio"
              color="var(--color-gold-ink)"
              :height="3"
            />
            <p class="legacy-panel__copy">
              已立 {{ recordCount }} / {{ RECORD_DEFS.length }} 项；纪录只增不减，跨世保留。
            </p>
          </footer>
        </section>
      </section>
    </article>
  </div>
</template>

<script setup lang="ts">
import "@/styles/pages/legacy.css";
import { focusListRow } from "@/composables/useListFocus";
import { computed, ref } from "vue";
import { useEndgameStore } from "@/stores/endgame";
import { usePlayerStore } from "@/stores/player";
import { useAdventureStore } from "@/stores/adventure";
import { useLoreStore } from "@/stores/lore";
import { cnNumber, formatPercent } from "@/utils/format";
import {
  cultivatorProfile,
  MILESTONE_DEFS,
  milestoneDef,
  PROFILE_MIN_MARKS,
  RECORD_DEFS,
} from "@/core/identity";
import { currentStage, totalInsight, vowProgress, vowResult } from "@/core/samsaraService";
import { nextStageAfter } from "@/data/samsara";
import { lifeThemeDef } from "@/data/lifeThemes";
import { regionDef } from "@/data/regions";
import { eventDef } from "@/data/events";
import { MATERIALS } from "@/data/materials";
import { PILLS } from "@/data/pills";
import { EQUIPMENT_TEMPLATES } from "@/data/equipment";
import { ENEMIES } from "@/data/enemies";
import { isNemesis } from "@/core/worldMemory";
import { chainProgressRows } from "@/core/eventEngine";
import {
  firstNewVisibleIndex,
  listWindow,
  nextListLimit,
  nextRevealCount,
  previousListLimit,
  previousListStep,
} from "@/core/listRender";
import { legacyCoverage, legacyMeter, legacyStageMeter } from "@/ui/legacyDesk";
import { lifeTrialArchive } from "@/ui/lifeTrialArchive";
import { lifeLinggen, linggenSpoken } from "@/ui/lifeLinggen";
import { lifeLinggenSpread } from "@/ui/lifeLinggenSpread";
import { lifeFootprint } from "@/ui/lifeFootprint";
import { lifeDateText } from "@/ui/lifeDate";
import { enemyLoreLedger } from "@/ui/enemyLoreLedger";
import { blueprintProgress } from "@/ui/blueprintProgress";
import { insightRulesNote } from "@/ui/insightRulesNote";
import { skillInsightDesk } from "@/ui/skillInsightDesk";
import { loreInsightByKind } from "@/ui/loreInsightByKind";
import { stageBenefitLines } from "@/ui/stageBenefits";
import { formatDate } from "@/utils/time";
import FolioPageHeader from "@/components/common/FolioPageHeader.vue";
import LegacyWheel from "@/components/common/LegacyWheel.vue";
import LedgerHeader from "@/components/common/LedgerHeader.vue";
import ProgressBar from "@/components/common/ProgressBar.vue";
import LegacyChapterRail from "@/components/legacy/LegacyChapterRail.vue";
import { useRouteTab } from "@/composables/useRouteTab";
import { LEGACY_CHAPTERS } from "@/ui/navigation";
import { clampPercent } from "@/utils/unitRatio";
import { useQuestsStore } from "@/stores/quests";
import {
  buildLifeChronicle,
  chronicleHeadline,
  chronicleLegacyCount,
  chronicleRowText,
  countChronicleByKind,
  CHRONICLE_ROW_BATCH,
  groupChronicleByLife,
  renderChronicleRow,
  type ChronicleGroup,
} from "@/ui/lifeChronicle";

/** 长卷分册:轮回(本世与历世)/ 征程(节点与宿敌)/ 缘迹(奇缘与行迹)/ 行年 / 纪录 */
const tab = useRouteTab(LEGACY_CHAPTERS, "samsara");

const endgame = useEndgameStore();
const player = usePlayerStore();
const quests = useQuestsStore();
const adventure = useAdventureStore();
const lore = useLoreStore();
const RECIPE_TOTAL = PILLS.filter((pill) => pill.recipe).length;

const insight = computed(() => totalInsight());
const stage = computed(() => currentStage());
const currentLife = computed(() => player.reincarnation.count + 1);
const nextStage = computed(() => nextStageAfter(insight.value));
const stageMeter = computed(() =>
  legacyStageMeter(insight.value, stage.value.insight, nextStage.value?.insight ?? null),
);

const vowTheme = computed(() => {
  const vow = player.reincarnation.vow;
  return vow ? (lifeThemeDef(vow.themeId) ?? null) : null;
});
const vowProg = computed(() => vowProgress());
const vowMeter = computed(() =>
  vowProg.value ? legacyMeter(vowProg.value.cur, vowProg.value.need) : null,
);
const vowBroken = computed(() => vowResult() === "broken");
const vowDone = computed(() => vowResult() === "done");
const vowState = computed(() => (vowBroken.value ? "broken" : vowDone.value ? "done" : "open"));
const vowStateLabel = computed(() => (vowBroken.value ? "已破" : vowDone.value ? "已成" : "在途"));

const loreRows = computed(() =>
  [
    {
      key: "material",
      mark: "材",
      name: "认得灵材",
      insightKey: "material" as const,
      value: lore.knownMaterialCount,
      total: MATERIALS.length,
      unit: "味",
    },
    {
      key: "recipe",
      mark: "方",
      name: "通晓丹方",
      insightKey: "recipe" as const,
      value: lore.masteredRecipeCount,
      total: RECIPE_TOTAL,
      unit: "张",
    },
    {
      key: "blueprint",
      mark: "谱",
      name: "读通器谱",
      insightKey: "blueprint" as const,
      value: lore.masteredBlueprintCount,
      total: EQUIPMENT_TEMPLATES.length,
      unit: "张",
    },
    {
      key: "enemy",
      mark: "敌",
      name: "洞悉敌手",
      insightKey: "enemy" as const,
      value: lore.masteredEnemyCount,
      total: ENEMIES.length,
      unit: "种",
    },
  ].map((row) => ({
    ...row,
    meter: legacyMeter(row.value, row.total),
    /*
     * 五行各折多少宿慧 —— 键与 `loreInsightByKind` 的返回字段一一对应。
     * 技艺那一行不在这里（它在下面单列一块），故 `skill` 不参与本表。
     */
    insight: loreByKind.value[row.insightKey],
  })),
);
/** 分项宿慧 —— 与 `loreInsight` 同一份实现（见 ui/loreInsightByKind） */
const loreByKind = computed(() =>
  loreInsightByKind({
    materialLore: lore.materialLore,
    recipeLore: lore.recipeLore,
    blueprintLore: lore.blueprintLore,
    skillExp: lore.skillExp,
    enemyLore: lore.enemyLore,
  }),
);
const loreCoverage = computed(() => legacyCoverage(loreRows.value));

/**
 * 敌手谱 —— 认知是四阶段系统,而上面那一行只报到顶的「洞悉 N / 140」。
 *
 * 输入是两份存档字段:`enemySeen`(照面次数)与 `enemyLore`(已记的阶)——
 * 这一作的库走「计数归 store、判定归库」,阶段不是从次数现算的。
 */
const enemyLedger = computed(() =>
  enemyLoreLedger(lore.enemySeen, lore.enemyLore, { total: ENEMIES.length }),
);
/** 逐阶计数的一句话:「眼熟 3 · 知其路数 2 · 洞悉 1」 */
const enemyStageText = computed(() =>
  enemyLedger.value.stageCounts.map((row) => `${row.stage} ${row.count}`).join(" · "),
);

/*
 * 敌手谱的分批渲染 —— 与履历、行迹同一把尺(`listWindow`)。
 *
 * 一百四十种不能让 DOM 一次铺完;但也不能用 `slice` 永久截断:
 * 被切掉的那些等于没有(`uiLayering.spec` 专门守这一条)。故余量显式报出、
 * 可续开。
 */
const ENEMY_RENDER_BATCH = 8;
/** 只保留最近一批的窗口宽度 —— 与 lifePage 同法,续开时旧批滑走 */
const ENEMY_RENDER_WINDOW = ENEMY_RENDER_BATCH * 2;
const enemyLimit = ref(ENEMY_RENDER_BATCH);
const enemyPage = computed(() =>
  listWindow(enemyLedger.value.rows, enemyLimit.value, ENEMY_RENDER_WINDOW),
);
/** 下一次续开会放出几种 —— 按钮文案与 data 共用,不许两处各算一遍 */
const nextEnemyBatch = computed(() => nextRevealCount(enemyPage.value.hidden, ENEMY_RENDER_BATCH));

/*
 * 器谱进度 —— 掌握度是 0~1 的连续值(每成功重铸一次增一档),而上面那行
 * 「读通器谱 N / 288 张」只报到顶那一档。玩家读不出:哪些快读通了、
 * 下一锤该砸哪张、自己读到了几分(0.9 与 0.1 在「0/288」里长得一样)。
 *
 * 与敌手谱同一把尺:只列读过的、按「差几次」从少到多排(下一锤该砸哪张排第一)、
 * 分批渲染不用 slice 截断。
 */
const BLUEPRINT_RENDER_BATCH = 8;
const BLUEPRINT_RENDER_WINDOW = BLUEPRINT_RENDER_BATCH * 2;
const blueprintLimit = ref(BLUEPRINT_RENDER_BATCH);
const blueprintDesk = computed(() => blueprintProgress(lore.blueprintLore, EQUIPMENT_TEMPLATES));
const blueprintPage = computed(() =>
  listWindow(blueprintDesk.value.rows, blueprintLimit.value, BLUEPRINT_RENDER_WINDOW),
);
const nextBlueprintBatch = computed(() =>
  nextRevealCount(blueprintPage.value.hidden, BLUEPRINT_RENDER_BATCH),
);
/**
 * 技艺进度 —— 九项技艺折的宿慧是五项里权重最大的一项。
 *
 * 输入是 `lore.skillExp`（与 samsaraService 折算宿慧时读的同一份）。
 */
/** 当前宿慧阶开着的收益 —— 文案由 SamsaraStageDef 的字段现生（见 ui/stageBenefits） */
const stageBenefits = computed(() => stageBenefitLines(stage.value));
/** 下一阶的收益 —— 玩家正在攒的就是它 */
const nextStageBenefits = computed(() =>
  nextStage.value ? stageBenefitLines(nextStage.value) : [],
);

const skillDesk = computed(() => skillInsightDesk(lore.skillExp));
/** 一句汇总:「九项中动了 3 项 · 折宿慧 12」 */
const skillSummary = computed(
  () => `动了 ${skillDesk.value.activeCount} 项 · 折宿慧 ${skillDesk.value.insight}`,
);

/** 一句汇总:「读过 12 张 · 读通 3 张 · 近读通 2 张」 */
const blueprintSummary = computed(() => {
  const d = blueprintDesk.value;
  const near = d.nearlyDone > 0 ? ` · 近读通 ${d.nearlyDone} 张` : "";
  return `读过 ${d.known} 张 · 读通 ${d.mastered} 张${near}`;
});

const RESULT_TEXTS: Record<"done" | "unfinished" | "broken", string> = {
  done: "践行到底",
  unfinished: "未竟",
  broken: "已破",
};
const RESULT_COLORS: Record<"done" | "unfinished" | "broken", string> = {
  done: "text-cinnabar",
  unfinished: "text-ink-faint",
  broken: "text-amber-ink",
};

/** 历世履历:最近的一世排在最前 */
const lifeRows = computed(() =>
  [...player.reincarnation.lives]
    .sort((a, b) => b.index - a.index)
    .map((l) => {
      const result = l.themeResult ?? "unfinished";
      return {
        ...l,
        themeName: l.themeId ? (lifeThemeDef(l.themeId)?.name ?? null) : null,
        resultText: RESULT_TEXTS[result],
        resultColor: RESULT_COLORS[result],
        /*
         * 逆旅契 —— 这是这份契约**唯一**的回报:被记住(见 data/lifeTrials 文件头)。
         * 转世时 core/reincarnation 已把它写进 LifeRecord.trialId,而这一屏此前
         * 从头到尾没读过那一栏:玩家花道果买下一世的逆境,转世后翻履历,
         * 看到的与从没签过契的那一世一模一样。
         */
        trial: lifeTrialArchive(l.trialId),
        /*
         * 那一世的灵根 —— 转世归档时快照进 LifeRecord(见 core/reincarnation 的
         * recordLife 调用点)。老存档没有这一栏,lifeLinggen 返回 null,整行不出。
         */
        linggenRow: lifeLinggen(l.linggen),
        /*
         * 那一世的归档时刻。同一页的长恨录早就印着 `formatDate(l.at)`,而履历行
         * 一个字都没有 —— 十世回望时缺了最自然的索引。读不出(老档 0 / 缺失)时
         * 是空串,整条不出:0 会印成 1970 年,那是假日期。
         */
        dateText: lifeDateText(l.at),
      };
    }),
);
/**
 * 历世灵根横向对照 —— 只算记过灵根的那几世。
 *
 * 输入是整份归档(`player.reincarnation.lives`),过滤口径收在
 * `ui/lifeLinggenSpread` 里 —— 两处各滤一遍,迟早会分叉。
 */
const linggenSpread = computed(() => lifeLinggenSpread(player.reincarnation.lives));

/**
 * 历世足迹 —— 终点境界的走向、最高那一世、平均终寿、宿慧累计。
 *
 * 与上面那块灵根对照同源同层:都是「把已经记下的十世摆成一眼能读的形状」,
 * 过滤与取值口径收在 `ui/lifeFootprint` 里,视图只做接线。
 */
const footprint = computed(() => lifeFootprint(player.reincarnation.lives));

const LIFE_RENDER_BATCH = 12;
const LIFE_RENDER_WINDOW = LIFE_RENDER_BATCH * 2;
const lifeLimit = ref(LIFE_RENDER_BATCH);
const lifePage = computed(() => listWindow(lifeRows.value, lifeLimit.value, LIFE_RENDER_WINDOW));

function moreLifeText(): string {
  const next = lifePromise.value;
  return `再看 ${next} 世 · 余 ${lifePage.value.hidden}`;
}

function previousLifeText(): string {
  const step = previousListStep(lifePage.value.shown, lifeRows.value.length, LIFE_RENDER_BATCH);
  return `前一批 ${step} 世`;
}

function showMoreLives(): void {
  const shownBefore = lifePage.value.shown;
  const shownAfter = nextListLimit(shownBefore, lifeRows.value.length, LIFE_RENDER_BATCH);
  lifeLimit.value = shownAfter;
  focusListRow(
    "[data-life-row]",
    firstNewVisibleIndex(shownBefore, shownAfter, LIFE_RENDER_WINDOW),
  );
}

function showPreviousLives(): void {
  lifeLimit.value = previousListLimit(
    lifePage.value.shown,
    lifeRows.value.length,
    LIFE_RENDER_BATCH,
  );
  focusListRow("[data-life-row]");
}

/** 征战录:当前未雪耻/已雪耻的宿敌 */
const nemesisRows = computed(() =>
  player.nemeses
    .filter((n) => n.lossCount >= 3)
    .map((n) => ({
      ...n,
      regionName: regionDef(n.regionId)?.name ?? n.regionId,
      avengedAt: n.avengedAt,
      active: isNemesis(player.nemeses, n.enemyId),
    }))
    .sort((a, b) => (a.avengedAt ?? 0) - (b.avengedAt ?? 0)),
);
/** 这一批真正放出多少件 —— 按钮文案与 data-promised 共用,不许各算一遍 */
const lifePromise = computed(() => nextRevealCount(lifePage.value.hidden, LIFE_RENDER_BATCH));
const activeNemeses = computed(() => nemesisRows.value.filter((n) => !n.avengedAt).length);

/** 行迹录:事件余波(世界记忆的最近完成) */
const lossRows = computed(() =>
  Object.values(adventure.eventMemories)
    .filter((m) => m.times >= 2)
    .map((m) => ({
      eventId: m.eventId,
      at: m.lastAt,
      eventName: eventDef(m.eventId)?.title ?? m.eventId,
      note: `${m.times} 次际遇后，此地已别有风貌`,
    }))
    .sort((a, b) => b.at - a.at),
);
const lossTotal = computed(() => lossRows.value.length);
const LOSS_RENDER_BATCH = 8;
const LOSS_RENDER_WINDOW = LOSS_RENDER_BATCH * 2;
const lossLimit = ref(LOSS_RENDER_BATCH);
const lossPage = computed(() => listWindow(lossRows.value, lossLimit.value, LOSS_RENDER_WINDOW));

function moreLossText(): string {
  const next = lossPromise.value;
  return `再看 ${next} 则 · 余 ${lossPage.value.hidden}`;
}

function previousLossText(): string {
  const step = previousListStep(lossPage.value.shown, lossRows.value.length, LOSS_RENDER_BATCH);
  return `前一批 ${step} 则`;
}

function showMoreLoss(): void {
  const shownBefore = lossPage.value.shown;
  const shownAfter = nextListLimit(shownBefore, lossRows.value.length, LOSS_RENDER_BATCH);
  lossLimit.value = shownAfter;
  focusListRow(
    "[data-loss-row]",
    firstNewVisibleIndex(shownBefore, shownAfter, LOSS_RENDER_WINDOW),
  );
}

function showPreviousLoss(): void {
  lossLimit.value = previousListLimit(
    lossPage.value.shown,
    lossRows.value.length,
    LOSS_RENDER_BATCH,
  );
  focusListRow("[data-loss-row]");
}

/**
 * 行年 —— 三处道历(图鉴 / 称号 / 灵兽)加历世归档,排成一条按岁读的谱。
 *
 * 三张表各按自己那一册的规矩排是那三册的正事;合成一件"我这一世做了什么"的故事,
 * 是这一册的正事(见 ui/lifeChronicle)。这里只递数据、分页,不重排逻辑。
 */
const chronicleRows = computed(() =>
  buildLifeChronicle({
    collectionMoments: quests.collectedMoment,
    titleMoments: quests.titleMoments,
    petMoments: quests.petMoments,
    lives: player.reincarnation.lives,
    lifeNow: currentLife.value,
  }),
);
const chronicleHead = computed(() => chronicleHeadline(chronicleRows.value, currentLife.value));
const chronicleLegacy = computed(() =>
  chronicleLegacyCount({
    collectionMoments: quests.collectedMoment,
    titleMoments: quests.titleMoments,
    petMoments: quests.petMoments,
    lives: player.reincarnation.lives,
    lifeNow: currentLife.value,
  }),
);
const chronicleKindRows = computed(() => {
  const counts = countChronicleByKind(chronicleRows.value);
  return [
    { kind: "collection" as const, mark: "册", name: "图鉴", count: counts.collection },
    { kind: "title" as const, mark: "名", name: "名号", count: counts.title },
    { kind: "pet" as const, mark: "兽", name: "灵兽", count: counts.pet },
    { kind: "life" as const, mark: "世", name: "旧世", count: counts.life },
  ];
});
/** 一「卷」是一世 —— 分页按卷走,不把同一世拆到两段里 */
const chronicleVolumes = computed(() =>
  groupChronicleByLife(chronicleRows.value, currentLife.value),
);
const CHRONICLE_RENDER_BATCH = 3;
const CHRONICLE_RENDER_WINDOW = CHRONICLE_RENDER_BATCH * 2;
const chronicleLimit = ref(CHRONICLE_RENDER_BATCH);
const chroniclePage = computed(() =>
  listWindow(chronicleVolumes.value, chronicleLimit.value, CHRONICLE_RENDER_WINDOW),
);
/**
 * 卷内已铺到第几行:按世的键记一份,各卷互不影响。
 *
 * 全铺/续开都用 `listWindow` 那一族(见 ui/lifeChronicle 的 renderChronicleRow),
 * 这里只记住"这一卷开到了第几行"。
 */
const chronicleRowLimits = ref<Record<number, number>>({});

function chronicleRowsOf(volume: ChronicleGroup) {
  return renderChronicleRow(volume, chronicleRowLimits.value[volume.life] ?? CHRONICLE_ROW_BATCH);
}

function chronicleRowPromise(volume: ChronicleGroup): number {
  return nextRevealCount(chronicleRowsOf(volume).hidden, CHRONICLE_ROW_BATCH);
}

function moreChronicleRowsText(volume: ChronicleGroup): string {
  const page = chronicleRowsOf(volume);
  return `再看 ${nextRevealCount(page.hidden, CHRONICLE_ROW_BATCH)} 笔 · 余 ${page.hidden}`;
}

function showMoreChronicleRows(life: number): void {
  const volume = chronicleVolumes.value.find((item) => item.life === life);
  if (!volume) return;
  const current = chronicleRowsOf(volume).shown;
  chronicleRowLimits.value = {
    ...chronicleRowLimits.value,
    [life]: nextListLimit(current, volume.total, CHRONICLE_ROW_BATCH),
  };
}

/** 这一批真正放出多少卷 —— 按钮文案与 data-promised 共用,不许各算一遍 */
const chroniclePromise = computed(() =>
  nextRevealCount(chroniclePage.value.hidden, CHRONICLE_RENDER_BATCH),
);

function moreChronicleText(): string {
  return `再看 ${chroniclePromise.value} 世 · 余 ${chroniclePage.value.hidden}`;
}

function previousChronicleText(): string {
  const step = previousListStep(
    chroniclePage.value.shown,
    chronicleVolumes.value.length,
    CHRONICLE_RENDER_BATCH,
  );
  return `前一批 ${step} 世`;
}

function showMoreChronicle(): void {
  const shownBefore = chroniclePage.value.shown;
  const shownAfter = nextListLimit(
    shownBefore,
    chronicleVolumes.value.length,
    CHRONICLE_RENDER_BATCH,
  );
  chronicleLimit.value = shownAfter;
  focusListRow(
    "[data-legacy-chronicle-volume]",
    firstNewVisibleIndex(shownBefore, shownAfter, CHRONICLE_RENDER_WINDOW),
  );
}

function showPreviousChronicle(): void {
  chronicleLimit.value = previousListLimit(
    chroniclePage.value.shown,
    chronicleVolumes.value.length,
    CHRONICLE_RENDER_BATCH,
  );
  focusListRow("[data-legacy-chronicle-volume]");
}

const profile = computed(() => cultivatorProfile(endgame.marks));

/** 奇缘录:只有起了头的缘才露面(往后的路不说破) */
const chainRows = computed(() => chainProgressRows());
const unfinishedChains = computed(
  () => chainRows.value.filter((c) => !c.finished && !c.broken).length,
);
/** 这一批真正放出多少件 —— 按钮文案与 data-promised 共用,不许各算一遍 */
const lossPromise = computed(() => nextRevealCount(lossPage.value.hidden, LOSS_RENDER_BATCH));
const fateMeter = computed(() => legacyMeter(unfinishedChains.value, chainRows.value.length));

const milestoneRows = computed(() =>
  [...endgame.milestones]
    .sort((a, b) => a.at - b.at)
    .map((m) => {
      const def = milestoneDef(m.id);
      return { id: m.id, life: m.life, name: def?.name ?? m.id, desc: def?.desc ?? "" };
    }),
);

const recordRows = computed(() =>
  RECORD_DEFS.map((def) => {
    const record = endgame.records[def.id];
    return {
      id: def.id,
      name: def.name,
      record: record ?? null,
      valueText: record
        ? def.unit === "×"
          ? `×${record.value}`
          : `${record.value} ${def.unit}`
        : "未立",
      emptyCopy:
        def.id === "fastest_world"
          ? "首次破界后，会记下最短回合数。"
          : def.id === "highest_pact"
            ? "带着逆旅契破界后，会记下最高风险倍率。"
            : def.id === "biggest_reward"
              ? "首次拿到破界道源后，会记下单程最厚之赏。"
              : "完成挑战书并领赏后，会记下最高赏格。",
    };
  }),
);
const recordCount = computed(() => recordRows.value.filter((r) => r.record !== null).length);
const recordMeter = computed(() => legacyMeter(recordCount.value, RECORD_DEFS.length));

const overviewStats = computed(() => [
  { key: "lives", label: "旧世", value: lifeRows.value.length },
  { key: "insight", label: "宿慧", value: insight.value },
  { key: "nemesis", label: "宿敌", value: activeNemeses.value },
  { key: "chains", label: "未了缘", value: unfinishedChains.value },
]);

const LEGACY_RAIL_MARKS = ["轮", "程", "缘", "年", "极"] as const;
const legacyRailTabs = computed(() =>
  LEGACY_CHAPTERS.map((chapter, index) => ({
    ...chapter,
    mark: LEGACY_RAIL_MARKS[index] ?? chapter.label.slice(0, 1),
    fact:
      chapter.id === "samsara"
        ? `第 ${currentLife.value} 世`
        : chapter.id === "journey"
          ? `${milestoneRows.value.length}/${MILESTONE_DEFS.length}`
          : chapter.id === "fate"
            ? `${unfinishedChains.value} 未了`
            : chapter.id === "chronicle"
              ? `${chronicleHead.value.count} 笔`
              : `${recordCount.value}/${RECORD_DEFS.length}`,
  })),
);
</script>
