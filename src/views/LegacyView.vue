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
                  <span class="legacy-lore__track">
                    <span :style="{ width: `${row.meter.ratio * 100}%` }" />
                  </span>
                </div>
              </div>
              <p class="legacy-panel__copy">
                睁眼即识 {{ stage.knownMaterialRank }} 阶以下 · 已辨识
                {{ lore.knownMaterialCount }} 味，通晓用法 {{ lore.masteredMaterialCount }} 味。
              </p>
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
      value: lore.knownMaterialCount,
      total: MATERIALS.length,
      unit: "味",
    },
    {
      key: "recipe",
      mark: "方",
      name: "通晓丹方",
      value: lore.masteredRecipeCount,
      total: RECIPE_TOTAL,
      unit: "张",
    },
    {
      key: "blueprint",
      mark: "谱",
      name: "读通器谱",
      value: lore.masteredBlueprintCount,
      total: EQUIPMENT_TEMPLATES.length,
      unit: "张",
    },
    {
      key: "enemy",
      mark: "敌",
      name: "洞悉敌手",
      value: lore.masteredEnemyCount,
      total: ENEMIES.length,
      unit: "种",
    },
  ].map((row) => ({ ...row, meter: legacyMeter(row.value, row.total) })),
);
const loreCoverage = computed(() => legacyCoverage(loreRows.value));

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
      };
    }),
);
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
