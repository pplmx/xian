<template>
  <!-- 第一程:寿终辞世。此处只开卷,不改存档。 -->
  <BaseModal :open="ui.deathDialog && !view" size="wide" title="往生 · 辞世" :closable="false">
    <article
      class="reincarnation-folio reincarnation-folio--death stagger-in"
      data-reincarnation-stage="death"
    >
      <ReincarnationStageRail :step="1" />

      <!--
        一世止步的那片天地 —— 三程共一份。

        这是全作唯一会把存档推倒重来的仪式:玩家这一号人物的一世到此为止,
        而三屏加起来 2000 行模板里原先一个 `<svg>` 都没有(只有三枚楷体字:终 / 照 / 生)。

        画什么不用新立一套:`worldOf(player.major)` 给的正是**这一世止步在哪一界**,
        而行世那一句写的就是「行世 N 载,止步于某境」—— 同一条读数。四界四副长相
        (人间山岳 / 仙界星野 / 神界宫阙 / 混沌虚空)在 `ui/sceneTerrain` 里早就有。

        落法是**路签下面的一条**,不是铺满整册、也不是垫在卷首背后:
          · 铺满整册 —— 这一册会滚动(回照约 1140px、择生约 2180px),
            画会落到册底,玩家要滚到底才见得着;
          · 垫在卷首背后 —— 山脊正横在「先把此生的题、宿慧与交割账摊开」那一行上,
            一屏里唯一一处「好看」变成一处读不清。
        给它自己的一条高度,排在路签与卷首之间:打开就看得见,底下没有字。
      -->
      <InkScene
        class="reincarnation-scene"
        variant="strip"
        :world-id="player.world.id"
        aria-hidden="true"
      />

      <header class="reincarnation-head">
        <span class="reincarnation-head__seal font-kai" aria-hidden="true">终</span>
        <div class="reincarnation-head__identity">
          <p class="reincarnation-head__eyebrow">第 {{ currentLife }} 世 · 寿数已尽</p>
          <h2 class="reincarnation-head__title">{{ player.name }}</h2>
          <p class="reincarnation-head__brief">
            行世 {{ yearsShown(player.age) }} 载，止步于{{
              player.realmName
            }}。皮囊坐化，神魂仍可再启一程。
          </p>
          <!--
            道龄 —— 「你陪这一号人物走了多久」(见 ui/companionTime)。
            与上面那句是两件不同的量:上面「行世 N 载」是**这一世**的寿数(游戏内时间),
            这里读的是账号级的活跃游玩时长(缺席时段不进它,见 core/engine 的注释)。
            故文案必须带「至今」这类累计标记 —— 只说「伴道 45 天」,
            玩家会以为这一世玩了 45 天。
          -->
          <p class="reincarnation-head__companion tabular" data-reincarnation-companion>
            <span>{{ companionTimeLabel(game.totalPlaySec) }}</span>
            <strong>至今共 {{ companionTimeText(game.totalPlaySec) }}</strong>
          </p>
        </div>
        <p class="reincarnation-score tabular">
          <span>道果</span>
          <strong>{{ formatNum(player.reincarnation.daoFruit) }}</strong>
          <small>枚</small>
        </p>
      </header>

      <section class="reincarnation-chapter" data-reincarnation-chapter="death">
        <FolioChapterHead
          data-character-chapter-head
          index="壹"
          title="此生止步"
          hint="先核对此生终点与能带走什么，再进下一程。"
          fact="尚未落账"
        />

        <div class="reincarnation-callout" data-reincarnation-death-summary>
          <span class="reincarnation-callout__mark font-kai" aria-hidden="true">别</span>
          <div>
            <p class="reincarnation-callout__title">这不是清档，是开卷</p>
            <p class="reincarnation-callout__copy">
              下一屏只作回照，核对此生带得走什么、放得下什么；尚未写入轮回。真正不可撤回的落子，是三程末的「踏入轮回」。
            </p>
          </div>
        </div>

        <dl class="reincarnation-death-grid">
          <div>
            <dt>今生</dt>
            <dd>第 {{ currentLife }} 世</dd>
          </div>
          <div>
            <dt>止步</dt>
            <dd>{{ player.realmName }}</dd>
          </div>
          <div>
            <dt>随身先天之姿</dt>
            <dd>{{ ownedTalents.length }} 项</dd>
          </div>
        </dl>

        <p class="reincarnation-footnote">
          功法只折层数，道果、天赋与所知随神魂留下；境界、灵根、法宝与外物随皮囊散去。
        </p>
      </section>
    </article>

    <template #footer>
      <div class="reincarnation-actions">
        <p class="reincarnation-actions__gate" data-reincarnation-death-gate>
          <strong>下一屏只作回照</strong>
          <span>尚未登账，也还没有换掉这一世。</span>
        </p>
        <button
          type="button"
          class="btn-seal reincarnation-actions__button"
          data-reincarnation-begin
          @click="beginRebirth"
        >
          <span>兵解转世</span>
          <small>进入第二程 · 回照</small>
        </button>
      </div>
    </template>
  </BaseModal>

  <!-- 第二程:回顾此生与去留全账。此处仍只读。 -->
  <BaseModal
    :open="view !== null && step === 'review'"
    size="wide"
    title="往生 · 回照"
    :closable="false"
  >
    <article
      v-if="view"
      class="reincarnation-folio stagger-in"
      data-reincarnation-stage="review"
      data-reincarnation-review
    >
      <ReincarnationStageRail :step="2" />

      <!-- 一世止步的那片天地 —— 理由见第一篇程(第一程那一处注释) -->
      <InkScene
        class="reincarnation-scene"
        variant="strip"
        :world-id="player.world.id"
        aria-hidden="true"
      />

      <header class="reincarnation-head">
        <span class="reincarnation-head__seal font-kai" aria-hidden="true">照</span>
        <div class="reincarnation-head__identity">
          <p class="reincarnation-head__eyebrow">第二程 · 回照 · 第 {{ view.review.index }} 世</p>
          <!--
            这一世的名号 —— 回照说的是**刚过完的这一生**,故读 review 上的快照。
            确认页会让玩家改下一世的名字,若在这里读当下的玩家,回照就会印成新名。
            空名整行不出:旧档可能没有名字(save.ts 另有「无名散修」兜底)。
          -->
          <p
            v-if="view.review.name"
            class="reincarnation-head__name font-kai"
            data-reincarnation-name
          >
            {{ view.review.name }}
          </p>
          <h2 class="reincarnation-head__title">
            {{ view.review.realmLabel }}
            <span>{{ view.review.age }} 载</span>
          </h2>
          <p class="reincarnation-head__brief">
            先把此生的题、宿慧与交割账摊开。此程只读，不改动任何存档。
          </p>
        </div>
        <p class="reincarnation-score tabular">
          <span>宿慧</span>
          <strong>+{{ formatNum(view.review.insightGained) }}</strong>
          <small>此生</small>
        </p>
      </header>

      <div class="reincarnation-review__grid">
        <section class="reincarnation-chapter" data-reincarnation-theme>
          <FolioChapterHead
            data-character-chapter-head
            index="壹"
            :title="reviewTheme ? `「${reviewTheme.vow}」` : '此世未立命题'"
            hint="此生命题只判这一世，未竟或破戒都不倒扣。"
            :fact="reviewTheme ? RESULT_NAMES[view.review.themeResult ?? 'unfinished'] : '未立题'"
          />

          <template v-if="reviewTheme">
            <p class="reincarnation-copy">{{ reviewTheme.goal }}</p>
            <p v-if="view.review.themeResult === 'unfinished'" class="reincarnation-read tabular">
              {{ Math.floor(view.review.themeCur) }} / {{ view.review.themeNeed }} · 未竟不给宿慧
            </p>
            <p v-else-if="view.review.themeResult === 'done'" class="reincarnation-read is-gold">
              {{ reviewTheme.legacy }}
            </p>
            <p v-else class="reincarnation-read is-amber">
              此生破了「{{ TABOO_NAMES[reviewTheme.taboo ?? "pill"] }}」之戒，题的所得没有兑现。
            </p>
          </template>
          <p v-else class="reincarnation-copy">
            这一世没有立题，便没有命题宿慧；阅历所得仍会计入下一阶。
          </p>
        </section>

        <section class="reincarnation-chapter" data-reincarnation-insight>
          <FolioChapterHead
            data-character-chapter-head
            index="贰"
            title="随魂所积"
            hint="阅历与所知随神魂留下，下一阶仍从这份底账续起。"
            :fact="view.stageAdvanced ? '境地已迁' : view.stageName"
          />
          <p class="reincarnation-copy">{{ view.stageDesc }}</p>
          <dl class="reincarnation-insight-rows">
            <div>
              <dt>此生入账</dt>
              <dd class="tabular">+{{ formatNum(view.review.insightGained) }} 宿慧</dd>
            </div>
            <div>
              <dt>回照后共有</dt>
              <dd class="tabular">{{ formatNum(view.insightAfter) }} 宿慧</dd>
            </div>
            <div>
              <dt>下一阶</dt>
              <dd class="tabular">
                {{
                  view.toNextStage !== null
                    ? `尚差 ${formatNum(view.toNextStage)} 宿慧`
                    : "已至此阶尽头"
                }}
              </dd>
            </div>
          </dl>
        </section>
      </div>

      <section class="reincarnation-chapter reincarnation-ledger" data-reincarnation-ledger>
        <FolioChapterHead
          data-character-chapter-head
          index="叁"
          title="此世交割"
          hint="条目直接取轮回结算的同一份继承表；先看影响最大的几笔，再展开全账。"
          :fact="`${balance.total} 项`"
        />

        <div class="reincarnation-balance" data-reincarnation-balance>
          <p class="reincarnation-balance__row is-full">
            <span>随魂</span>
            <strong class="tabular">{{ balance.full }}</strong>
            <small>项完整留下</small>
          </p>
          <p class="reincarnation-balance__row is-partial">
            <span>折损</span>
            <strong class="tabular">{{ balance.partial }}</strong>
            <small>项只留一部分</small>
          </p>
          <p class="reincarnation-balance__row is-reset">
            <span>归尘</span>
            <strong class="tabular">{{ balance.reset }}</strong>
            <small>项随皮囊散去</small>
          </p>
        </div>

        <p class="reincarnation-ledger__caption">先看这些</p>
        <div class="reincarnation-critical">
          <p
            v-for="row in criticalRows"
            :key="row.id"
            class="reincarnation-critical__row"
            :class="row.tone"
            :data-reincarnation-critical-row="row.id"
          >
            <span class="reincarnation-critical__mark font-kai" aria-hidden="true">{{
              row.mark
            }}</span>
            <span class="reincarnation-critical__name">{{ row.name }}</span>
            <span class="reincarnation-critical__group">{{ row.groupTitle }}</span>
          </p>
        </div>

        <p v-if="view.gongfaKeep.total > 0" class="reincarnation-keep" data-gongfa-keep>
          <span class="reincarnation-keep__mark font-kai" aria-hidden="true">功</span>
          <span>
            功法 {{ view.gongfaKeep.total }} 部记得住，层数回到一层<template
              v-if="view.gongfaKeep.keepAll"
              >；大乘道统在身，已练的层数原样带走</template
            ><template v-else-if="view.gongfaKeep.keepOneId"
              >；唯有「{{ gongfaName(view.gongfaKeep.keepOneId) }}」保留
              {{ view.gongfaKeep.keepOneLevel }} 层</template
            >。
          </span>
        </p>

        <button
          type="button"
          class="reincarnation-ledger__toggle"
          data-reincarnation-heritage-toggle
          :aria-expanded="heritageOpen"
          @click="heritageOpen = !heritageOpen"
        >
          <span>{{ heritageOpen ? "收起去留全账" : `展开去留全账(${balance.total} 项)` }}</span>
          <span aria-hidden="true">{{ heritageOpen ? "▾" : "▸" }}</span>
        </button>

        <div v-if="heritageOpen" class="scroll-fade reincarnation-ledger__fold">
          <div class="scroll-pane max-h-64 overflow-y-auto reincarnation-ledger__scroll">
            <section
              v-for="group in ledger"
              :key="group.mode"
              class="reincarnation-ledger-group"
              :class="group.tone"
              :data-reincarnation-heritage-group="group.mode"
            >
              <header class="reincarnation-ledger-group__head">
                <span class="reincarnation-ledger-group__mark font-kai" aria-hidden="true">{{
                  group.mark
                }}</span>
                <p>{{ group.title }}</p>
                <span class="tabular">{{ group.count }} 项</span>
              </header>
              <div class="reincarnation-ledger-group__rows">
                <button
                  v-for="r in group.rows"
                  :key="r.id"
                  type="button"
                  class="reincarnation-ledger-row"
                  :data-reincarnation-heritage-row="r.id"
                  :aria-expanded="heritageTap === r.id"
                  :aria-label="`${r.name}，${group.title}，${heritageTap === r.id ? '收起说明' : '展开说明'}`"
                  @click="heritageTap = heritageTap === r.id ? null : r.id"
                >
                  <span class="reincarnation-ledger-row__name">{{ r.name }}</span>
                  <span class="reincarnation-ledger-row__state">{{ group.title }}</span>
                  <span class="reincarnation-ledger-row__mark" aria-hidden="true">{{
                    heritageTap === r.id ? "−" : "+"
                  }}</span>
                  <span v-if="heritageTap === r.id" class="reincarnation-ledger-row__detail">
                    {{ r.detail }}
                  </span>
                </button>
              </div>
            </section>
          </div>
        </div>
      </section>

      <p class="reincarnation-footnote">
        丹方、药性、铭纹、器谱与敌手路数都不随皮囊腐朽；来世睁眼即认得
        <span class="tabular">{{ view.knownMaterials }}</span> 味灵材。
      </p>
    </article>

    <template #footer>
      <div class="reincarnation-actions">
        <p class="reincarnation-actions__gate" data-reincarnation-review-gate>
          <strong>回照不落账</strong>
          <span>下一程才择道号、灵根与先天之姿。</span>
        </p>
        <button
          type="button"
          class="btn-seal reincarnation-actions__button"
          data-reincarnation-review-next
          @click="step = 'choice'"
        >
          <span>往生 · 择生</span>
          <small>进入第三程 · 尚未落子</small>
        </button>
      </div>
    </template>
  </BaseModal>

  <!-- 第三程:择来世底账。按下「踏入轮回」才真正不可撤回。 -->
  <BaseModal
    :open="view !== null && step === 'choice'"
    size="wide"
    title="往生 · 择生"
    :closable="false"
  >
    <article
      v-if="view"
      class="reincarnation-folio stagger-in"
      data-reincarnation-stage="choice"
      data-reincarnation-choice
    >
      <ReincarnationStageRail :step="3" />

      <!-- 一世止步的那片天地 —— 理由见第一篇程(第一程那一处注释) -->
      <InkScene
        class="reincarnation-scene"
        variant="strip"
        :world-id="player.world.id"
        aria-hidden="true"
      />

      <header class="reincarnation-head">
        <span class="reincarnation-head__seal font-kai" aria-hidden="true">生</span>
        <div class="reincarnation-head__identity">
          <p class="reincarnation-head__eyebrow">第三程 · 择生 · 落子前</p>
          <h2 class="reincarnation-head__title">为第 {{ view.review.index + 1 }} 世定底</h2>
          <p class="reincarnation-head__brief">
            道号与灵根所见即所得；先天之姿只取其一，命题可不立。此页仍可反复改选。
          </p>
        </div>
        <p class="reincarnation-score tabular">
          <span>道果</span>
          <strong>+{{ formatNum(view.daoFruitGained) }}</strong>
          <small>今生</small>
        </p>
      </header>

      <section class="reincarnation-chapter" data-reincarnation-chapter="choice-roots">
        <FolioChapterHead
          data-character-chapter-head
          index="壹"
          title="来世根骨"
          hint="灵根所见即所得；道果只入永世底账，不再回到本世皮囊。"
          :fact="`修行 ${multText(view.nextLinggen.growthMult)}`"
        />

        <div class="reincarnation-choice__grid">
          <section
            class="reincarnation-read-panel reincarnation-destiny"
            data-reincarnation-destiny
          >
            <header class="reincarnation-read-head">
              <span>来世灵根</span>
              <strong>{{ view.nextLinggen.gradeName }}</strong>
            </header>
            <div class="reincarnation-roots" aria-label="来世灵根资质">
              <span
                v-for="root in view.nextLinggen.roots"
                :key="root.element"
                class="reincarnation-root"
              >
                <strong class="font-kai">{{ ELEMENTS[root.element].name }}</strong>
                <span class="tabular">{{ root.aptitude }}</span>
              </span>
            </div>
            <!--
              资质地板 —— 上面那几枚资质**已经是垫过地板的数**（rollLinggen 里
              `aptitude = min(100, 掷点 + 地板)`）。弹窗此前只报结果不报来源：
              道果那条跨世通道有账，这条一分账都没有。
              数值全部读 aptitudeFloorBrief（与引擎同一份算法，读同一组常数）。
            -->
            <!--
              前世今生并排 —— 灵根是**重掷**的,玩家真正要权衡的是「我手里这副会不会被换掉」。
              上面只报了来世那一手;这里把本世摆到它旁边,同一个天平两边都看得见。
              这个弹窗只在寿元耗尽时出现,离上一次看人物页可能过了几天 ——
              恰好是记忆最不可靠、最需要摆在一起看的一刻。
            -->
            <dl v-if="linggenCmp" class="reincarnation-cmp" data-reincarnation-linggen-cmp>
              <div class="reincarnation-cmp__head">
                <dt>灵根对照</dt>
                <dd>本世 → 来世</dd>
              </div>
              <!--
                修行倍率排第一 —— 它才是「变好还是变差」的答案。
                根数越多倍率越**低**(单根 1.6 对五根 0.9),故下面那行「多 1 根」
                单独读起来会读成变好;把倍率摆在它上面,方向由数字自己说。
                读的是引擎算好的 growthMult(含混沌的 1.5 加成),不在这里重算。
              -->
              <div>
                <dt>修行倍率</dt>
                <dd class="tabular">
                  {{ multText(linggenCmp.from.mult) }} → {{ multText(linggenCmp.to.mult) }}
                  <small :class="linggenCmp.multDelta >= 0 ? 'is-up' : 'is-down'">{{
                    multDeltaText
                  }}</small>
                </dd>
              </div>
              <div>
                <dt>均资质</dt>
                <dd class="tabular">
                  {{ linggenCmp.from.average.toFixed(0) }} →
                  {{ linggenCmp.to.average.toFixed(0) }}
                  <small :class="linggenCmp.averageDelta >= 0 ? 'is-up' : 'is-down'"
                    >{{ linggenCmp.averageDelta >= 0 ? "+" : ""
                    }}{{ linggenCmp.averageDelta.toFixed(0) }}</small
                  >
                </dd>
              </div>
              <div>
                <dt>根数</dt>
                <dd class="tabular">
                  {{ linggenCmp.from.count }} → {{ linggenCmp.to.count }}
                  <small class="reincarnation-cmp__count-note">{{ linggenCmp.countNote }}</small>
                </dd>
              </div>
            </dl>

            <dl class="reincarnation-floor" data-reincarnation-floor>
              <div>
                <dt>资质地板</dt>
                <dd class="tabular">
                  +{{ floorBrief.floor }}
                  <small>{{ floorSourceText }}</small>
                </dd>
              </div>
              <!--
                裸掷 vs 垫了地板 —— 玩家真正想回答的是「这枚 99 是我运气好,
                还是攒出来的」。掷点是 40..100 的均匀分布（裸掷均值 70），
                地板整体平推上去;两个期望的差就是宿慧换来的东西。
              -->
              <div>
                <dt>一根资质的期望</dt>
                <dd class="tabular">
                  {{ floorBrief.expected.bare }} → {{ floorBrief.expected.withFloor }}
                  <small>裸掷 → 垫地板</small>
                </dd>
              </div>
              <div>
                <dt>离封顶</dt>
                <dd class="tabular">
                  {{ floorBrief.capped ? "已顶" : `尚差 ${floorBrief.toCap}` }}
                  <small>资质上限 {{ floorBrief.cap }}</small>
                </dd>
              </div>
              <!--
                地板到顶之后**不出这一行**：地板照样能涨，但掷点已经被
                `Math.min(100, …)` 顶死，涨地板换不来更高的资质 ——
                再写「抬一格」就是许诺一个不会兑现的结果（真浏览器截图撞出过）。
              -->
              <div v-if="floorBrief.raisesRoll">
                <dt>再攒 {{ floorBrief.insightToNext }} 宿慧</dt>
                <dd>资质地板抬一格</dd>
              </div>
            </dl>
          </section>

          <section class="reincarnation-read-panel" data-reincarnation-dao-fruit>
            <header class="reincarnation-read-head">
              <span>道果落账</span>
              <strong class="tabular">+{{ formatNum(view.daoFruitGained) }} 枚</strong>
            </header>
            <dl class="reincarnation-insight-rows">
              <div>
                <dt>今生凝得</dt>
                <dd class="tabular">{{ formatNum(view.daoFruitGained) }} 枚</dd>
              </div>
              <div>
                <dt>落账后共有</dt>
                <dd class="tabular">{{ formatNum(nextFruitTotal) }} 枚</dd>
              </div>
              <div>
                <dt>跨世用途</dt>
                <dd>修行与道躯的永久底账</dd>
              </div>
            </dl>
          </section>
        </div>
      </section>

      <section class="reincarnation-chapter reincarnation-name" data-reincarnation-name>
        <FolioChapterHead
          data-character-chapter-head
          index="贰"
          title="新一世的道号"
          hint="道号随这一副皮囊可重拟，最多八字；留白不填，便沿用旧号。"
          fact="可留白"
        />
        <div class="reincarnation-name__row">
          <input
            v-model="nameDraft"
            :maxlength="NAME_MAX"
            aria-label="新一世的道号"
            class="reincarnation-name__input text-[16px]"
            :placeholder="view.nameDraft"
          />
          <button
            type="button"
            class="btn-ghost reincarnation-name__reroll"
            data-reincarnation-name-reroll
            aria-label="随机取一个道号"
            @click="reRollName"
          >
            <GameIcon name="refresh" :size="15" />
            <span>另掷一号</span>
          </button>
        </div>
      </section>

      <section class="reincarnation-chapter reincarnation-talent-section">
        <FolioChapterHead
          data-character-chapter-head
          index="叁"
          title="择一先天之姿"
          hint="只取其一，余者本世无缘；具体数字与效果先摊在这里，不靠猜名字。"
          :fact="view.talentChoices.length ? (chosen ? '已择定' : '待择') : '池已尽'"
        />
        <p v-if="view.talentChoices.length === 0" class="reincarnation-empty">
          先天之姿已尽数为你所有，此番再无可择，可直取轮回。
        </p>
        <div v-else class="reincarnation-talent-grid">
          <button
            v-for="id in view.talentChoices"
            :key="id"
            type="button"
            class="reincarnation-talent-choice"
            :class="{ 'is-chosen': chosen === id }"
            :aria-pressed="chosen === id"
            :data-reincarnation-talent-choice="id"
            @click="chosen = id"
          >
            <span class="reincarnation-talent-choice__head">
              <span
                class="reincarnation-talent-choice__name font-kai"
                :style="{ color: TALENT_GRADE_COLORS[talentDef(id)?.grade ?? 1] }"
              >
                {{ talentDef(id)?.name ?? id }}
              </span>
              <span class="reincarnation-talent-choice__grade">
                {{ TALENT_GRADE_NAMES[talentDef(id)?.grade ?? 1] }}
              </span>
              <span class="reincarnation-talent-choice__mark" aria-hidden="true">{{
                chosen === id ? "已" : "择"
              }}</span>
            </span>
            <span class="reincarnation-talent-choice__desc">{{ talentDef(id)?.desc }}</span>
            <span
              v-if="modsText(talentDef(id)?.mods ?? {})"
              class="reincarnation-talent-choice__mods"
            >
              {{ modsText(talentDef(id)?.mods ?? {}) }}
            </span>
          </button>
        </div>
        <p v-if="view.extraTalents.length" class="reincarnation-extra">
          <span>另有先天之姿自开</span>
          <strong v-for="id in view.extraTalents" :key="id">
            {{ talentDef(id)?.name ?? id }}
          </strong>
        </p>
      </section>

      <section class="reincarnation-chapter reincarnation-theme-section">
        <FolioChapterHead
          data-character-chapter-head
          index="肆"
          title="这一世要做什么"
          hint="立题不给属性；走到底才得一份宿慧与来路。破戒或未竟都不会倒扣。"
          :fact="theme ? '已择题' : '可不立'"
        />
        <p v-if="view.themeFree" class="reincarnation-theme-free">
          百世老修，此阶可在已开命题中任取一题。
        </p>
        <div v-if="themeDefs.length" class="reincarnation-theme-list">
          <button
            v-for="t in themeDefs"
            :key="t.id"
            type="button"
            class="reincarnation-theme-choice"
            :class="{ 'is-chosen': theme === t.id }"
            :aria-pressed="theme === t.id"
            :data-reincarnation-theme-choice="t.id"
            @click="theme = theme === t.id ? null : t.id"
          >
            <span class="reincarnation-theme-choice__head">
              <span class="reincarnation-theme-choice__name font-kai">{{ t.name }}</span>
              <span class="reincarnation-theme-choice__gain tabular"
                >做到 +{{ t.insight }} 宿慧</span
              >
            </span>
            <span class="reincarnation-theme-choice__vow">{{ t.vow }}</span>
            <span class="reincarnation-theme-choice__goal">{{ t.goal }}</span>
            <!--
              做到之后你会记住什么 —— `legacy` 是这条命题的**回报**那一半。

              此前它只在达成后的回照里出现一次,立题那一刻看不到。而这是 17 条命题里
              写得最好的部分(「你记得结丹那一刻气机是怎么盘拢的——往后每一世都少走一段
              弯路」),把它放在**已经做完之后**才看得到的位置,等于最好的一句用在了最不
              需要它的地方。

              同一张卡上「忌:…」(代价)是显示了的,缺的正是回报这一半。
            -->
            <span v-if="t.legacy" class="reincarnation-theme-choice__legacy">
              {{ t.legacy }}
            </span>
            <span v-if="t.taboo" class="reincarnation-theme-choice__taboo">
              忌：{{ TABOO_NAMES[t.taboo] }} —— 一世守之，破之题废，无所得
            </span>
          </button>
        </div>
        <p v-else class="reincarnation-empty">此阶没有可立命题，不立题并不影响转世。</p>
        <p class="reincarnation-theme-skip">不选亦可 —— 无题的一世，只是少一份命题宿慧。</p>
      </section>

      <section
        v-if="view.heritageGained && heritageDef(view.heritageGained)"
        class="reincarnation-chapter reincarnation-heritage-gained"
        data-reincarnation-heritage-gained
      >
        <FolioChapterHead
          data-character-chapter-head
          index="伍"
          title="道统传承"
          hint="深修所悟随神魂不灭，来世仍能沿用这份道统。"
          :fact="heritageDef(view.heritageGained)!.name"
        />
        <p class="reincarnation-copy">{{ heritageDef(view.heritageGained)!.desc }}</p>
        <p class="reincarnation-heritage-gained__effect">
          效果：{{ heritageDef(view.heritageGained)!.effectDesc }}
        </p>
      </section>

      <section class="reincarnation-chapter reincarnation-final" data-reincarnation-final-warning>
        <FolioChapterHead
          data-character-chapter-head
          index="末"
          title="落印之前"
          hint="落印即刻归档此生：灵根、境界与天地换新；资源、装备、法宝与外物随皮囊散去。"
          fact="尚未落定"
        />
        <!--
          代价要**说全**。
          原先只写「资源、装备、法宝与外物散去」——「外物」一词把洞府与弟子也盖进去了,
          技术上不算撒谎,但玩家读到那三样时的想象,多半不包含**养了十世的弟子**
          与**升满级的洞府**。而 reincarnation.ts 实际会一并重置:洞府(及全部建筑)、
          灵脉、灵兽、弟子(只留一丝真传缘)、关系(历史留下人不留下)、道途、本世命题。
          这是本作最贵的一次不可逆操作,故把最意外的两样点出来 —— 其余仍在「外物」里,
          但那个词的边界由这两样划清。
        -->
        <p class="reincarnation-final__copy" data-reincarnation-final-losses>
          洞府与全部建筑、灵脉、灵兽、弟子皆随皮囊散去；弟子若教出过真传，只留一丝缘分到下一世。
        </p>
        <p class="reincarnation-final__copy">
          按下「踏入轮回」后，此前所有点选才真正落定；这已是最后一程。
        </p>
      </section>
    </article>

    <template #footer>
      <div class="reincarnation-actions">
        <p
          class="reincarnation-actions__gate"
          data-reincarnation-confirm-gate
          :data-reincarnation-confirm-state="confirmGate.state"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <strong>{{ confirmGate.short }}</strong>
          <span>{{ confirmGate.detail }}</span>
        </p>
        <button
          type="button"
          class="btn-seal reincarnation-actions__button"
          data-reincarnation-confirm
          :disabled="confirmGate.disabled"
          @click="confirm"
        >
          <span>踏入轮回</span>
          <small>{{ confirmGate.short }}</small>
        </button>
        <!--
          退路 —— 前两程各写着「尚未写入轮回……真正不可撤回的落子,是三程末的
          『踏入轮回』」。这句承诺此前**没有对应入口**:step 只有一条单向赋值
          (`step = 'choice'`),三程又都是 closable=false,于是玩家进了第三程
          就再也回不到回照 —— 想改天赋、想再看一眼账,只能一路按到底。

          退路放在这里(而不是第二程):第二程是纯回顾,第三程才是点选天赋 / 姓名 /
          命题的地方,想改主意也只会发生在这。
        -->
        <button
          type="button"
          class="btn-ghost reincarnation-actions__back"
          data-reincarnation-back
          @click="step = 'review'"
        >
          再看一眼回照
        </button>
      </div>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { multText } from "@/ui/multText";
import { linggenCompare } from "@/ui/linggenCompare";
import { useRouter } from "vue-router";
import { useUiStore } from "@/stores/ui";
import { usePlayerStore } from "@/stores/player";
import {
  prepareReincarnation,
  confirmReincarnation,
  rollReincarnateName,
} from "@/core/reincarnation";
import { talentDef, TALENT_GRADE_COLORS, TALENT_GRADE_NAMES } from "@/data/talents";
import { modsText } from "@/data/statNames";
import { heritageDef } from "@/data/heritage";
import { gongfaDef } from "@/data/gongfa";
import { lifeThemeDef, TABOO_NAMES } from "@/data/lifeThemes";
import { ELEMENTS } from "@/data/linggen";
import { heritageGroups } from "@/core/samsaraAudit";
import {
  aptitudeFloorBrief,
  criticalSamsaraRows,
  reincarnationConfirmGate,
  samsaraBalance,
  samsaraLedger,
} from "@/ui/reincarnationDesk";
import { engine } from "@/core/engine";
import { formatNum, yearsShown } from "@/utils/format";
import { useGameStore } from "@/stores/game";
import { companionTimeLabel, companionTimeText } from "@/ui/companionTime";
import BaseModal from "@/components/common/BaseModal.vue";
import InkScene from "@/components/common/InkScene.vue";
import GameIcon from "@/components/common/GameIcon.vue";
import FolioChapterHead from "@/components/common/FolioChapterHead.vue";
import ReincarnationStageRail from "@/components/character/ReincarnationStageRail.vue";
import { NAME_MAX } from "@/utils/nameLimit";

const ui = useUiStore();
const player = usePlayerStore();
const game = useGameStore();
const router = useRouter();

const RESULT_NAMES: Record<"done" | "unfinished" | "broken", string> = {
  done: "践行到底",
  unfinished: "未竟",
  broken: "已破",
};

const chosen = ref<string | null>(null);
const theme = ref<string | null>(null);
const nameDraft = ref("");
const step = ref<"review" | "choice">("review");
const heritageOpen = ref(false);
const heritageTap = ref<string | null>(null);

const view = computed(() => ui.reincarnation);
const currentLife = computed(() => player.reincarnation.count + 1);
const ownedTalents = computed(() =>
  player.reincarnation.talents
    .map((id) => talentDef(id))
    .filter((t): t is NonNullable<ReturnType<typeof talentDef>> => t !== undefined),
);
const reviewTheme = computed(() =>
  view.value?.review.themeId ? lifeThemeDef(view.value.review.themeId) : undefined,
);
const themeDefs = computed(() =>
  (view.value?.themeChoices ?? []).flatMap((id) => lifeThemeDef(id) ?? []),
);
const ledger = computed(() => samsaraLedger(heritageGroups()));
const balance = computed(() => samsaraBalance(ledger.value));
const criticalRows = computed(() => criticalSamsaraRows(ledger.value));
const confirmGate = computed(() =>
  reincarnationConfirmGate(view.value?.talentChoices.length ?? 0, chosen.value),
);
const nextFruitTotal = computed(
  () => player.reincarnation.daoFruit + (view.value?.daoFruitGained ?? 0),
);
/**
 * 资质地板简报 —— 输入取 prepare 那一刻的快照（`view.linggenFloor`），不现算。
 * 现算会读到已经加过 `review.insightGained` 的宿慧,多出一格 —— 与 `nextLinggen`
 * 同一条 WYSIWYG 纪律。
 */
/**
 * 本世与来世的灵根对照 —— 来世那一手已经在上面了,这里补上「换掉了什么」。
 *
 * 本世读 `player.linggen`(本世皮囊上的那一副),来世读 `view.nextLinggen`
 * (prepare 那一刻掷定的、所见即所得的那一副)。任一侧缺失时纯函数返回 null,
 * 整块不出 —— 老存档或异常数据下不印半张对照。
 */
const linggenCmp = computed(() => {
  const cmp = linggenCompare(player.linggen, view.value?.nextLinggen);
  if (!cmp) return null;
  /*
   * 根数差的说法要跟方向走 —— 「少一根是好事」(倍率更高),写死一个数字会把好事说成坏事。
   * 持平就不提,免得每个字都在说「没变化」。
   */
  const note =
    cmp.countDelta === 0
      ? "根数不变"
      : cmp.countDelta < 0
        ? `少 ${-cmp.countDelta} 根`
        : `多 ${cmp.countDelta} 根`;
  return { ...cmp, countNote: note };
});

/**
 * 倍率差的写法 —— 与 `multText` 同一口径(两位精度、削尾零),但**不带 × 前缀**
 * 且保留符号:`+0.66` / `-0.12`。差值不是倍数本身,故不套 `multText`;
 * 它也不是百分比(`formatPercent` 内部还要 ×100),故不走那一族。
 *
 * 削零用字符串处理而不乘 100 再除:这一步是**显示**的定小数位,不是百分比换算
 * —— 后者全库统走 `formatPercent`(见 `uiLayering.spec`)。
 */
const multDeltaText = computed(() => {
  const d = linggenCmp.value!.multDelta;
  if (!Number.isFinite(d)) return "—";
  const body = d.toFixed(2).replace(/\.?0+$/, "");
  // 「+0」不该写成「+」—— 削零后空串(-0.00 会削成 "-")要补回 0
  return `${d >= 0 ? "+" : ""}${body === "" || body === "-" ? "0" : body}`;
});

const floorBrief = computed(() =>
  aptitudeFloorBrief(view.value?.linggenFloor ?? { lives: 0, insight: 0 }),
);
/**
 * 地板是哪条口径在顶 —— 两条口径取较大者,故必须说清是「转世保底」还是「宿慧折算」,
 * 只报一个「+20」玩家会以为两种攒法等价。
 */
const floorSourceText = computed(() =>
  floorBrief.value.source === "insight" ? "宿慧折算" : "转世保底",
);

function gongfaName(id: string): string {
  return gongfaDef(id)?.name ?? id;
}

function beginRebirth(): void {
  prepareReincarnation();
}

function reRollName(): void {
  nameDraft.value = rollReincarnateName();
}

function confirm(): void {
  if (confirmGate.value.disabled) return;
  confirmReincarnation(chosen.value, theme.value, nameDraft.value);
  chosen.value = null;
  theme.value = null;
  nameDraft.value = "";
  heritageOpen.value = false;
  heritageTap.value = null;
  engine.resetDeathFlag();
  void router.push("/");
}

watch(view, (next) => {
  if (!next) return;
  step.value = "review";
  nameDraft.value = next.nameDraft;
  chosen.value = null;
  theme.value = null;
  heritageOpen.value = false;
  heritageTap.value = null;
});
</script>

<style scoped>
/*
 * 路签下面那条天地 —— 三程共一份。
 *
 * 落法试过三种,只有这一种对:
 *   · 铺满整册(veil + inset:0)—— 这一册会滚动(回照约 1140px、择生约 2180px),
 *     画落到册底,玩家要滚到底才见得着,等于没有;
 *   · 垫在卷首背后 —— 山脊正横在「先把此生的题、宿慧与交割账摊开」那一行上,
 *     一屏里唯一一处「好看」变成一处读不清;
 *   · 定高的一条(strip)—— 排在路签与卷首之间,打开就看得见,底下没有字。
 *
 * 故用 strip,高度自己定。点景照画:四界之间的分别(山岳 / 星野 / 宫阙 / 虚空)
 * 全靠它们读出来,只留山骨就又是同一片坡。
 *
 * 墨取 0.62:这一条上面紧挨着路签的朱砂底线与卷首的青色眉批,再浓一档就开始抢。
 */
.reincarnation-scene {
  --ink-scene-h: 5.4rem;
  --ink-scene-ink: 0.62;
  margin-block: 0.15rem 0.6rem;
}

.reincarnation-folio {
  --reincarnation-line: rgb(var(--color-ink-rgb) / 0.14);
  --reincarnation-line-strong: rgb(var(--color-ink-rgb) / 0.23);
  --character-accent: var(--color-cinnabar);
  --character-accent-rgb: var(--color-cinnabar-rgb);
  --folio-chapter-accent: var(--character-accent);
  --folio-chapter-accent-rgb: var(--character-accent-rgb);
  min-width: 0;
}

.reincarnation-head {
  display: grid;
  grid-template-columns: 2.45rem minmax(0, 1fr) auto;
  align-items: start;
  gap: 0.6rem 0.72rem;
  border-bottom: 1px solid var(--reincarnation-line);
  padding-bottom: 0.8rem;
}

/*
 * 这一世的名号 —— 碑上的名字。
 *
 * 字号在眉批与标题之间、用楷体、字距略宽:它比「第二程 · 回照」那句话重,
 * 比「元婴 · 八百六十载」轻 —— 人的名字该在境界之上先被念到,但不该压过一生的读数。
 * 颜色取正文墨(不用淡墨):这一行是**被称呼**,不是注解。
 */
.reincarnation-head__name {
  margin: 0.06rem 0 0;
  color: rgb(var(--color-ink-rgb));
  font-size: var(--type-title);
  letter-spacing: 0.1em;
  line-height: 1.25;
}

.reincarnation-head__seal {
  display: grid;
  width: 2.1rem;
  height: 2.45rem;
  place-items: center;
  border-left: 2px solid rgb(var(--color-cinnabar-rgb) / 0.72);
  color: var(--color-cinnabar);
  font-size: var(--type-title);
  line-height: 1;
}

.reincarnation-head__identity {
  min-width: 0;
}

.reincarnation-head__eyebrow {
  color: var(--color-qing);
  font-size: var(--type-note);
  letter-spacing: 0.15em;
  line-height: 1.5;
}

.reincarnation-head__title {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.2rem 0.62rem;
  margin-top: 0.12rem;
  overflow-wrap: anywhere;
  color: var(--color-ink);
  font-family: var(--font-kai);
  font-size: var(--type-section);
  font-weight: 400;
  letter-spacing: 0.08em;
  line-height: 1.35;
}

.reincarnation-head__title span {
  color: var(--color-ink-soft);
  font-size: var(--type-body);
  letter-spacing: 0.08em;
}

.reincarnation-head__brief {
  margin-top: 0.42rem;
  color: var(--color-ink-soft);
  font-size: var(--type-body);
  line-height: 1.65;
}

/*
 * 道龄 —— 比本世寿数那一句再淡一档:寿数是有结局的(止步于某境),
 * 陪伴是仍在继续的。故标签用 ink-faint、读数用 ink-soft,不加着色。
 */
.reincarnation-head__companion {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.3rem;
  margin-top: 0.3rem;
  color: var(--color-ink-soft);
  font-size: var(--type-note);
  line-height: 1.5;
}

.reincarnation-head__companion span {
  color: var(--color-ink-faint);
  font-family: var(--font-kai);
  letter-spacing: 0.14em;
}

.reincarnation-head__companion strong {
  font-family: var(--font-kai);
  font-weight: 400;
}

.reincarnation-score {
  display: grid;
  min-width: 3.8rem;
  justify-items: end;
  gap: 0.05rem;
  color: var(--color-ink-soft);
}

.reincarnation-score span,
.reincarnation-score small {
  font-size: var(--type-note);
}

.reincarnation-score strong {
  color: var(--color-cinnabar);
  font-family: var(--font-kai);
  font-size: var(--type-title);
  font-weight: 400;
  line-height: 1.1;
}

.reincarnation-chapter {
  min-width: 0;
  margin-top: 0.82rem;
  border-top: 1px solid var(--reincarnation-line);
  padding-top: 0.82rem;
}

.reincarnation-head + .reincarnation-chapter {
  margin-top: 0.72rem;
  border-top: 0;
  padding-top: 0.72rem;
}

.reincarnation-chapter > .folio-chapter-head {
  margin-bottom: 0.56rem;
}

.reincarnation-copy {
  overflow-wrap: anywhere;
  color: var(--color-ink-soft);
  font-size: var(--type-body);
  line-height: 1.65;
}

.reincarnation-read {
  margin-top: 0.45rem;
  overflow-wrap: anywhere;
  border-top: 1px solid var(--reincarnation-line);
  padding-top: 0.45rem;
  color: var(--color-ink-faint);
  font-size: var(--type-note);
  line-height: 1.65;
}

.reincarnation-read.is-gold {
  color: var(--color-gold-ink);
}

.reincarnation-read.is-amber {
  color: var(--color-amber-ink);
}

.reincarnation-callout {
  display: grid;
  grid-template-columns: 2.1rem minmax(0, 1fr);
  gap: 0.62rem;
  border-left: 2px solid rgb(var(--color-cinnabar-rgb) / 0.58);
  padding-left: 0.62rem;
}

.reincarnation-callout__mark {
  display: grid;
  width: 2.1rem;
  height: 2.1rem;
  place-items: center;
  color: var(--color-cinnabar);
  font-size: var(--type-title);
}

.reincarnation-callout__title {
  color: var(--color-ink);
  font-family: var(--font-kai);
  font-size: var(--type-title);
  letter-spacing: 0.06em;
}

.reincarnation-callout__copy {
  margin-top: 0.3rem;
  color: var(--color-ink-soft);
  font-size: var(--type-body);
  line-height: 1.7;
}

.reincarnation-death-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-top: 0.62rem;
  border-block: 1px solid var(--reincarnation-line);
}

.reincarnation-death-grid > div {
  min-width: 0;
  padding: 0.5rem 0.6rem;
}

.reincarnation-death-grid > div + div {
  border-left: 1px dashed var(--reincarnation-line);
}

.reincarnation-death-grid dt {
  color: var(--color-ink-faint);
  font-size: var(--type-note);
  line-height: 1.4;
}

.reincarnation-death-grid dd {
  margin-top: 0.22rem;
  overflow-wrap: anywhere;
  color: var(--color-ink);
  font-family: var(--font-kai);
  font-size: var(--type-title);
  line-height: 1.4;
}

.reincarnation-footnote {
  margin-top: 0.72rem;
  border-top: 1px solid var(--reincarnation-line);
  padding-top: 0.58rem;
  color: var(--color-ink-faint);
  font-size: var(--type-note);
  line-height: 1.65;
}

.reincarnation-actions {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: stretch;
  gap: 0.52rem;
}

/*
 * 第三程的退路 —— 「再看一眼回照」。
 *
 * 它是**次级**动作:主按钮是「踏入轮回」(朱砂实心),这一枚只给一条虚线般的
 * 细边与淡墨字,并压在按钮之下。不能让两枚看起来一样重 —— 那会稀释那个
 * 不可撤回的动作。
 */
.reincarnation-actions__back {
  justify-self: center;
  color: rgb(var(--color-ink-soft-rgb));
  font-family: var(--font-kai);
  font-size: var(--type-note);
  letter-spacing: 0.1em;
  text-decoration: underline;
  text-decoration-color: rgb(var(--color-ink-rgb) / 0.28);
  text-underline-offset: 0.28em;
}

.reincarnation-actions__gate {
  display: grid;
  min-width: 0;
  gap: 0.14rem;
  color: var(--color-ink-faint);
  font-size: var(--type-note);
  line-height: 1.5;
}

.reincarnation-actions__gate strong {
  overflow-wrap: anywhere;
  color: var(--color-ink-soft);
  font-size: var(--type-body);
  font-weight: 400;
}

.reincarnation-actions__gate span {
  overflow-wrap: anywhere;
}

.reincarnation-actions__gate[data-reincarnation-confirm-state="blocked"] strong {
  color: var(--color-cinnabar);
}

.reincarnation-actions__gate[data-reincarnation-confirm-state="ready"] strong {
  color: var(--color-qing);
}

.reincarnation-actions__button {
  display: grid;
  width: 100%;
  min-width: 0;
  justify-items: center;
  gap: 0.08rem;
}

.reincarnation-actions__button small {
  display: block;
  font-size: var(--type-note);
  font-weight: 400;
  line-height: 1.35;
}

.reincarnation-review__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  margin-top: 0.72rem;
}

.reincarnation-review__grid > .reincarnation-chapter {
  margin-top: 0;
  border-top: 0;
  padding-top: 0;
}

.reincarnation-review__grid > .reincarnation-chapter + .reincarnation-chapter {
  margin-top: 0.72rem;
  border-top: 1px solid var(--reincarnation-line);
  padding-top: 0.72rem;
}

.reincarnation-choice__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  margin-top: 0.58rem;
}

.reincarnation-read-panel {
  min-width: 0;
  padding: 0.52rem 0;
}

.reincarnation-read-panel + .reincarnation-read-panel {
  border-top: 1px solid var(--reincarnation-line);
}

.reincarnation-read-head {
  display: flex;
  min-width: 0;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.6rem;
  color: var(--color-ink-faint);
  font-size: var(--type-note);
}

.reincarnation-read-head strong {
  overflow-wrap: anywhere;
  color: var(--color-ink);
  font-family: var(--font-kai);
  font-size: var(--type-title);
  font-weight: 400;
  letter-spacing: 0.06em;
  text-align: right;
}

.reincarnation-read-panel .reincarnation-insight-rows {
  margin-top: 0.36rem;
}

.reincarnation-insight-rows {
  margin-top: 0.55rem;
  border-top: 1px solid var(--reincarnation-line);
}

/*
 * 资质地板那三格 —— 与「道果落账」那张账同形（同一枚 dl 节奏），
 * 但更短:它是**一行注**而不是一整张账。dt 用墨淡、dd 跟上读数,
 * 小字补口径（哪条在顶 / 上限多少）。
 */
/*
 * 前世今生并排 —— 与下面那条地板账同形(上缘细线 + 逐行分隔),
 * 只是它答的是「换掉了什么」,地板答的是「这一手是怎么来的」。
 * 故两块贴在一起、版式一致:读的时候是一条连续的账,不是两张卡。
 */
.reincarnation-cmp {
  margin-top: 0.5rem;
  border-top: 1px solid var(--reincarnation-line);
}

.reincarnation-cmp > div {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.28rem 0;
  border-bottom: 1px solid var(--reincarnation-line);
}

.reincarnation-cmp dt {
  flex: none;
  color: var(--color-ink-faint);
  font-size: var(--type-note);
}

.reincarnation-cmp dd {
  min-width: 0;
  color: var(--color-ink-soft);
  font-size: var(--type-note);
  text-align: right;
}

.reincarnation-cmp__head dd {
  color: var(--color-ink-faint);
}

.reincarnation-cmp dd small {
  margin-left: 0.24rem;
  font-size: var(--type-note);
}

/* 变好走石青、变差走琥珀 —— 与全站「涨跌」同一对色，不引入第三色 */
.reincarnation-cmp dd .is-up {
  color: var(--color-jade);
}

.reincarnation-cmp dd .is-down {
  color: var(--color-amber-ink);
}

.reincarnation-cmp__count-note {
  color: var(--color-ink-faint);
}

.reincarnation-floor {
  margin-top: 0.5rem;
  border-top: 1px solid var(--reincarnation-line);
}

.reincarnation-floor > div {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.28rem 0;
  border-bottom: 1px solid var(--reincarnation-line);
}

.reincarnation-floor dt {
  flex: 0 0 auto;
  color: var(--color-ink-faint);
  font-size: var(--type-note);
}

.reincarnation-floor dd {
  min-width: 0;
  overflow-wrap: anywhere;
  color: var(--color-ink-soft);
  font-size: var(--type-note);
  text-align: right;
}

.reincarnation-floor dd small {
  color: var(--color-ink-faint);
  font-size: var(--type-note);
}

.reincarnation-insight-rows > div {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.6rem;
  border-bottom: 1px solid var(--reincarnation-line);
  padding: 0.34rem 0;
}

.reincarnation-insight-rows dt {
  flex: 0 0 auto;
  color: var(--color-ink-faint);
  font-size: var(--type-note);
}

.reincarnation-insight-rows dd {
  min-width: 0;
  overflow-wrap: anywhere;
  color: var(--color-ink-soft);
  font-size: var(--type-body);
  text-align: right;
}

.reincarnation-ledger {
  min-width: 0;
}

.reincarnation-balance {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border-block: 1px solid var(--reincarnation-line);
}

.reincarnation-balance__row {
  display: grid;
  min-width: 0;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: baseline;
  gap: 0.12rem 0.4rem;
  padding: 0.48rem 0.55rem;
}

.reincarnation-balance__row + .reincarnation-balance__row {
  border-left: 1px dashed var(--reincarnation-line);
}

.reincarnation-balance__row span {
  color: var(--color-ink-soft);
  font-size: var(--type-body);
}

.reincarnation-balance__row strong {
  color: var(--color-ink);
  font-family: var(--font-kai);
  font-size: var(--type-title);
  font-weight: 400;
  line-height: 1;
}

.reincarnation-balance__row small {
  grid-column: 1 / -1;
  overflow-wrap: anywhere;
  color: var(--color-ink-faint);
  font-size: var(--type-note);
  line-height: 1.35;
}

.reincarnation-balance__row.is-full strong {
  color: var(--color-jade);
}

.reincarnation-balance__row.is-partial strong {
  color: var(--color-gold-ink);
}

.reincarnation-balance__row.is-reset strong {
  color: var(--color-ink-faint);
}

.reincarnation-ledger__caption {
  margin-top: 0.56rem;
  color: var(--color-ink-faint);
  font-size: var(--type-note);
  letter-spacing: 0.12em;
}

.reincarnation-critical {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.3rem;
  margin-top: 0.3rem;
}

.reincarnation-critical__row {
  display: grid;
  min-width: 0;
  grid-template-columns: 1.6rem minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.45rem;
  border-bottom: 1px solid var(--reincarnation-line);
  padding: 0.28rem 0;
}

.reincarnation-critical__mark {
  display: grid;
  width: 1.6rem;
  height: 1.6rem;
  place-items: center;
  border-left: 2px solid currentColor;
  font-size: var(--type-note);
  line-height: 1;
}

.reincarnation-critical__row.is-partial {
  color: var(--color-gold-ink);
}

.reincarnation-critical__row.is-reset {
  color: var(--color-ink-faint);
}

.reincarnation-critical__name {
  min-width: 0;
  overflow-wrap: anywhere;
  color: var(--color-ink-soft);
  font-size: var(--type-body);
}

.reincarnation-critical__group {
  max-width: 7.2rem;
  overflow-wrap: anywhere;
  color: var(--color-ink-faint);
  font-size: var(--type-note);
  line-height: 1.35;
  text-align: right;
}

.reincarnation-keep {
  display: grid;
  grid-template-columns: 1.6rem minmax(0, 1fr);
  gap: 0.45rem;
  margin-top: 0.55rem;
  border-top: 1px solid var(--reincarnation-line);
  padding-top: 0.5rem;
  color: var(--color-ink-faint);
  font-size: var(--type-note);
  line-height: 1.65;
}

.reincarnation-keep__mark {
  display: grid;
  width: 1.6rem;
  height: 1.6rem;
  place-items: center;
  border-left: 2px solid rgb(var(--color-gold-rgb) / 0.58);
  color: var(--color-gold-ink);
}

.reincarnation-ledger__toggle {
  display: flex;
  width: 100%;
  min-height: 2rem;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-top: 0.55rem;
  border-top: 1px solid var(--reincarnation-line);
  padding: 0.45rem 0 0;
  color: var(--color-qing);
  font-size: var(--type-body);
  text-align: left;
}

.reincarnation-ledger__fold {
  margin-top: 0.45rem;
}

.reincarnation-ledger__scroll {
  padding-right: 0.15rem;
}

.reincarnation-ledger-group {
  padding: 0.42rem 0;
}

.reincarnation-ledger-group + .reincarnation-ledger-group {
  border-top: 1px solid var(--reincarnation-line);
}

.reincarnation-ledger-group__head {
  display: grid;
  grid-template-columns: 1.45rem minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.4rem;
  border-bottom: 1px solid var(--reincarnation-line);
  padding-bottom: 0.32rem;
}

.reincarnation-ledger-group__mark {
  display: grid;
  width: 1.45rem;
  height: 1.45rem;
  place-items: center;
  border-left: 2px solid currentColor;
  font-size: var(--type-note);
  line-height: 1;
}

.reincarnation-ledger-group.is-full {
  color: var(--color-jade);
}

.reincarnation-ledger-group.is-partial {
  color: var(--color-gold-ink);
}

.reincarnation-ledger-group.is-reset {
  color: var(--color-ink-faint);
}

.reincarnation-ledger-group__head p {
  min-width: 0;
  overflow-wrap: anywhere;
  color: var(--color-ink-soft);
  font-size: var(--type-body);
}

.reincarnation-ledger-group__head > span:last-child {
  color: var(--color-ink-faint);
  font-size: var(--type-note);
}

.reincarnation-ledger-group__rows {
  margin-top: 0.18rem;
}

.reincarnation-ledger-row {
  display: grid;
  width: 100%;
  min-width: 0;
  grid-template-columns: minmax(0, 1fr) auto 1rem;
  align-items: center;
  gap: 0.35rem;
  border-bottom: 1px solid var(--reincarnation-line);
  padding: 0.32rem 0;
  color: var(--color-ink-soft);
  text-align: left;
}

.reincarnation-ledger-row__name {
  min-width: 0;
  overflow-wrap: anywhere;
  font-size: var(--type-body);
}

.reincarnation-ledger-row__state {
  color: var(--color-ink-faint);
  font-size: var(--type-note);
  text-align: right;
}

.reincarnation-ledger-row__mark {
  color: var(--color-ink-faint);
  font-size: var(--type-body);
  text-align: center;
}

.reincarnation-ledger-row__detail {
  grid-column: 1 / -1;
  overflow-wrap: anywhere;
  border-top: 1px dashed var(--reincarnation-line);
  padding-top: 0.28rem;
  color: var(--color-ink-faint);
  font-size: var(--type-note);
  line-height: 1.6;
}

.reincarnation-roots {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.55rem;
}

.reincarnation-root {
  display: inline-flex;
  min-width: 0;
  align-items: baseline;
  gap: 0.28rem;
  border-left: 1px solid rgb(var(--color-qing-rgb) / 0.42);
  padding: 0.2rem 0 0.2rem 0.42rem;
  color: var(--color-ink-soft);
}

.reincarnation-root strong {
  color: var(--color-qing);
  font-size: var(--type-title);
  font-weight: 400;
}

.reincarnation-root span {
  font-size: var(--type-note);
}

.reincarnation-name__row {
  display: flex;
  align-items: stretch;
  gap: 0.42rem;
  margin-top: 0.55rem;
}

.reincarnation-name__input {
  min-width: 0;
  flex: 1 1 auto;
  border: 1px solid rgb(var(--color-ink-rgb) / 0.22);
  border-radius: 2px;
  background: rgb(var(--color-paper-deep-rgb) / 0.58);
  padding: 0.48rem 0.6rem;
  color: var(--color-ink);
  font-family: var(--font-kai);
  font-size: var(--type-title);
  letter-spacing: 0.14em;
  outline: none;
}

.reincarnation-name__input:focus {
  border-color: rgb(var(--color-cinnabar-rgb) / 0.5);
}

.reincarnation-name__reroll {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 0.3rem;
  white-space: normal;
}

.reincarnation-empty {
  margin-top: 0.55rem;
  border-block: 1px dashed var(--reincarnation-line-strong);
  padding: 0.55rem 0;
  color: var(--color-ink-faint);
  font-size: var(--type-body);
  line-height: 1.6;
}

.reincarnation-talent-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0;
  margin-top: 0.55rem;
}

.reincarnation-talent-choice,
.reincarnation-theme-choice {
  display: grid;
  width: 100%;
  min-width: 0;
  gap: 0.35rem;
  border: 0;
  border-bottom: 1px solid var(--reincarnation-line);
  border-left: 2px solid transparent;
  background: transparent;
  padding: 0.55rem 0.58rem;
  text-align: left;
  transition:
    border-color 0.16s ease,
    background-color 0.16s ease,
    transform 0.12s ease;
}

.reincarnation-talent-choice:active,
.reincarnation-theme-choice:active {
  transform: scale(0.99);
}

.reincarnation-talent-choice.is-chosen,
.reincarnation-theme-choice.is-chosen {
  border-left-color: rgb(var(--color-cinnabar-rgb) / 0.72);
  background: rgb(var(--color-cinnabar-rgb) / 0.025);
}

.reincarnation-talent-choice__head,
.reincarnation-theme-choice__head {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.25rem 0.5rem;
}

.reincarnation-talent-choice__name,
.reincarnation-theme-choice__name {
  font-size: var(--type-title);
  line-height: 1.35;
}

.reincarnation-talent-choice__grade,
.reincarnation-theme-choice__gain {
  color: var(--color-ink-faint);
  font-size: var(--type-note);
}

.reincarnation-talent-choice__mark {
  margin-left: auto;
  color: var(--color-cinnabar);
  font-size: var(--type-note);
}

.reincarnation-talent-choice__desc,
.reincarnation-theme-choice__vow {
  overflow-wrap: anywhere;
  color: var(--color-ink-soft);
  font-size: var(--type-body);
  line-height: 1.55;
}

.reincarnation-talent-choice__mods {
  overflow-wrap: anywhere;
  border-top: 1px solid var(--reincarnation-line);
  padding-top: 0.28rem;
  color: var(--color-qing);
  font-size: var(--type-note);
  line-height: 1.55;
}

.reincarnation-extra {
  display: flex;
  flex-wrap: wrap;
  gap: 0.28rem 0.6rem;
  margin-top: 0.55rem;
  border-top: 1px solid var(--reincarnation-line);
  padding-top: 0.45rem;
  color: var(--color-ink-faint);
  font-size: var(--type-note);
}

.reincarnation-extra strong {
  color: var(--color-gold-ink);
  font-family: var(--font-kai);
  font-weight: 400;
}

.reincarnation-theme-free {
  margin-top: 0.45rem;
  color: var(--color-gold-ink);
  font-size: var(--type-note);
  line-height: 1.5;
}

.reincarnation-theme-list {
  display: grid;
  gap: 0;
  margin-top: 0.55rem;
}

.reincarnation-theme-choice__goal {
  overflow-wrap: anywhere;
  border-top: 1px solid var(--reincarnation-line);
  padding-top: 0.3rem;
  color: var(--color-ink-faint);
  font-size: var(--type-note);
  line-height: 1.6;
}

/*
 * 达成后的所得 —— 与「判据」那行分开:上面那行是**要做到什么**(硬性的、可验的),
 * 这一行是**做到之后你记住什么**(叙事)。两者都淡,但语气不同,故加一道极浅的分隔,
 * 不另起一块。
 */
.reincarnation-theme-choice__legacy {
  overflow-wrap: anywhere;
  color: var(--color-qing);
  font-family: var(--font-kai);
  font-size: var(--type-note);
  line-height: 1.65;
}

.reincarnation-theme-choice__taboo {
  overflow-wrap: anywhere;
  color: var(--color-amber-ink);
  font-size: var(--type-note);
  line-height: 1.55;
}

.reincarnation-theme-skip {
  margin-top: 0.45rem;
  color: var(--color-ink-faint);
  font-size: var(--type-note);
  line-height: 1.55;
}

.reincarnation-heritage-gained__effect {
  margin-top: 0.45rem;
  border-top: 1px solid var(--reincarnation-line);
  padding-top: 0.42rem;
  color: var(--color-gold-ink);
  font-size: var(--type-note);
  line-height: 1.6;
}

.reincarnation-final {
  border-left: 2px solid rgb(var(--color-cinnabar-rgb) / 0.58);
  padding-left: 0.62rem;
}

.reincarnation-final__copy {
  margin-top: 0.48rem;
  color: var(--color-ink-soft);
  font-size: var(--type-note);
  line-height: 1.65;
}

@media (min-width: 620px) {
  .reincarnation-actions {
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
  }

  .reincarnation-actions__button {
    width: auto;
    min-width: 9.2rem;
  }

  .reincarnation-review__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: 0.9rem;
  }

  .reincarnation-review__grid > .reincarnation-chapter + .reincarnation-chapter {
    margin-top: 0;
    border-top: 0;
    border-left: 1px solid var(--reincarnation-line);
    padding: 0 0 0 0.9rem;
  }

  .reincarnation-review__grid > .reincarnation-chapter > .folio-chapter-head {
    grid-template-columns: auto minmax(0, 1fr);
    align-items: start;
  }

  .reincarnation-review__grid
    > .reincarnation-chapter
    > .folio-chapter-head
    :deep(.folio-chapter-head__fact) {
    grid-column: 2;
    justify-self: start;
    text-align: left;
  }

  .reincarnation-choice__grid {
    grid-template-columns: minmax(0, 1.08fr) minmax(0, 0.92fr);
    column-gap: 0.9rem;
  }

  .reincarnation-read-panel + .reincarnation-read-panel {
    border-top: 0;
    border-left: 1px solid var(--reincarnation-line);
    padding-left: 0.9rem;
  }

  .reincarnation-critical {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: 0.55rem;
  }

  .reincarnation-talent-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 260px) {
  .reincarnation-head {
    grid-template-columns: 2.2rem minmax(0, 1fr);
  }

  .reincarnation-head__seal {
    width: 2.2rem;
    height: 2.2rem;
  }

  .reincarnation-score {
    grid-column: 2;
    justify-items: start;
  }

  .reincarnation-death-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .reincarnation-death-grid > div + div {
    border-top: 1px dashed var(--reincarnation-line);
    border-left: 0;
  }

  .reincarnation-balance {
    grid-template-columns: minmax(0, 1fr);
  }

  .reincarnation-balance__row + .reincarnation-balance__row {
    border-top: 1px dashed var(--reincarnation-line);
    border-left: 0;
  }

  .reincarnation-critical__row {
    grid-template-columns: 1.45rem minmax(0, 1fr);
  }

  .reincarnation-critical__group {
    grid-column: 2;
    max-width: none;
    text-align: left;
  }
}

@media (max-width: 220px) {
  .reincarnation-actions {
    grid-template-columns: minmax(0, 1fr);
  }

  .reincarnation-actions__button {
    width: 100%;
    min-width: 0;
  }

  .reincarnation-name__row {
    flex-direction: column;
  }

  .reincarnation-name__reroll {
    justify-content: center;
  }

  .reincarnation-ledger-row {
    grid-template-columns: minmax(0, 1fr) 1rem;
  }

  .reincarnation-ledger-row__state {
    grid-column: 1;
    text-align: left;
  }

  .reincarnation-ledger-row__mark {
    grid-column: 2;
    grid-row: 1;
  }
}
</style>
