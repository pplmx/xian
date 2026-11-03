/* oxlint-disable no-console -- 自检脚本的产出就是给人看的报告 */
/**
 * 排版自检 —— 手机尺寸下逐页量一遍「有没有横向溢出」
 *
 * 用法:
 *   bun run build
 *   bunx playwright install chromium  # playwright 已是 devDependency;浏览器缓存在 ~/.cache/ms-playwright
 *   bun scripts/layout-check.mjs      # 加 --shots 顺带存图到 /tmp/layout-shots
 *   bun scripts/layout-check.mjs --jobs 4   # 并发路数;也可用 LAYOUT_JOBS 环境变量
 *
 * 它是**并发**跑的:下面这批自检任务各自开自己的 context、各带自己的存档,互不等待,
 * 由 runPool 按 --jobs / LAYOUT_JOBS / 核数(上限 8)调度。从前它们是同一层里顺序排队的
 * 代码块,一段段等固定时长,一轮约七分钟;拆成任务后本地实测 ~90 秒,--jobs 1 退化回串行。
 * 任务之间只共享一个浏览器与失败清单(后者按固定任务顺序合并,报告与串行时一致)。
 * (这里刻意不写「N 个任务」:任务数每次加一条判据就变,写进注释就是第二个会漂的数。)
 *
 * 它同时在 CI 里跑(见 .github/workflows/deploy.yml 与 build.yml 的 ui-check job):
 * 每个 main 提交与每个发版 tag 都过这一关 —— 判据红则不发布。
 * playwright 写在 devDependencies 里(锁版本):它没有 postinstall,bun install 只带
 * JS 本体;真正占地的浏览器二进制由上面那句按需下,CI 另给它做缓存。
 *
 * 它做这些事:
 *   一 走完真实建号流程(同意隐私 → 命名 → 踏入仙途),拿到一份真存档;
 *   二 在 390×844 / 375×812 / 320×568 三个宽度下,逐页量 scrollWidth 与越界元素,
 *      并核对**外壳本身**没被滚偏(overflow-hidden 的盒子玩家滚不动,浏览器滚得动);
 *   三 把「底部导航五项」「无 pageerror / 无应用 console.error」「控件都有可访问名」「可点元素不小于 28px」也一并核对;
 *   四 把浏览器存储卡死(令 setItem 抛错),看设置页会不会把「写不进去」说出来 ——
 *      静默丢档是玩家看不见的事故,只能靠这一条端到端核。
 *   五 弹窗的 dialog 语义与焦点(进得去 / 困得住 / 关掉还给触发它的按钮);
 *   六 Tab 焦点看得见(全局 :focus-visible 是否有实际轮廓);
 *   七 浮出来的提示条点得掉 —— 它挂着 @click 关掉自己,不能被外框的
 *      pointer-events:none 继承掉(继承了就永远只能等超时)。
 *   八 引擎按概率触发的两扇弹窗(顿悟 / 洞府巡游):把概率钉成必中再量一遍 ——
 *      它们正常巡页碰不到,正是最容易悄悄退回「自己铺一层浮层」的角落。
 *   九 冷启动落在子页时,「返回」要回父页而不是退出游戏(书签 / deep link /
 *      PWA 恢复上次路由都会走到这个处境)。
 *   十 后期档复核:用夹具存档(神人境 + 装备/法宝/器魂/在途秘境 + 隔夜归来)
 *      再巡一遍 —— 空档量不出长数字与满屏内容,而归来卷轴那屏每几天就见一次。
 *   十一 渡劫突破真打一次:结果弹窗必须写清成败与雷数、成功要与页面境界对得上
 *      (每个玩家反复看的那一屏,此前从没被渲染过)。
 *   十二 走完一次转世(往生·辞世 → 往生·回照 → 往生·择生 → 新的一世):唯一会把存档
 *      推倒重来的仪式,此前一步都没被真浏览器走过。
 *   十三 挂机玩法真的在挂着跑:顶栏灵气只给 1 点,真等两轮看它自己涨不涨 ——
 *      「应用启动后引擎有没有跑起来」只有真浏览器能答。
 *   十四 存档往返:导出 → 投灵脉花掉灵石 → 导入回来,必须回到导出那一刻
 *      (最后一道保险,此前没人按过这两个按钮)。
 *   十五 后期档再走一遍 320 窄屏:「长数字 + 满屏内容 + 最窄屏」这个组合
 *      此前没量过(主巡页的 320 用的是刚建号的空档)。
 *   十六 坏档开局:坏掉一个分片也要进得去,并且说得出「哪一片坏了、原档在哪」。
 *   十七 导出失败也要说话:把浏览器的下载能力打断再点一次「导出存档」。
 *   十八 切后台/离开页面时,待刷的存档要立刻落盘(visibilitychange / pagehide)。
 *   十九 真打一场历练战斗:战报回放要出内容、结语要写清胜负、战斗分析点得开。
 *   二十 背包里的账目:强化写着扣多少尘就扣多少,分解说给多少尘就给多少。
 *   二十一 闭关期间不许历练:点出发要当场拦下(不开模式窗),换页回来闭关还在。
 *   二十二 减少动效真的减到了(并顺带在音效开着的情况下点一路按钮)。
 *   二十三 洞府营造的账目:卡片写多少石就扣多少石。
 *   二十四 法宝炼化的两笔账:按钮上两种代价都得写全,且两种都按所写扣。
 *   二十五 一键分解要「先勾后点」:勾品质只是标记,行囊里的东西须点「分 解」才化尘。
 *   二十六 智能收纳不替玩家扔「有投入的件」:练过/成套/近满的三件必须留下。
 *   二十七 顶栏底栏钉死:滚一遍窗口,两栏一步都不许动,文档层不许有纵向可滚余量。
 *      外加一条构建产物判据:外壳高度得认 dvh —— 无头浏览器的 100vh 恰好等于可视
 *      高度,把外壳换回 vh 它照样全绿,只有查产物这一条拦得住。
 *   二十八 页签栏吸顶:背包四册、图鉴、界域志、天界、坊市的页签栏,滚过之后要贴在
 *      内容区顶、且铺满内容区宽度(空档滚不动,判据自己往容器里垫占位造余量)。
 *   二十九 不是手机竖屏的两档:横屏 844×390 与桌面 1280×800 也各巡一遍全量路由 ——
 *      自适应断点(高度 short:、大屏的册页留白)就在这两档上现形。
 *   三十 顶栏不许折行:数字断行看着像乱码,顶栏还会从 46px 涨到 58px(320 宽复发过)。
 *   三十一 iOS 存档风险提示:该出现的平台出现(且关掉就真不再出现),不该出现的平台
 *      一个字都不说 —— 桌面/安卓用应用自己的存储,在那儿喊「iOS 会清掉存档」是胡说。
 *   三十二 楷体统一:构建产物里内置字体必须排在字体栈第一位(系统楷体留作兜底),
 *      并且真渲染时楷体文字确实由它画出来(字体文件坏了、404 了都在这儿现形)。
 *   三十三 地界卡不许挤压:名字必须单行,头部与操作块不许相交。夹具里备了镇压中、
 *      临期复聚、已取得资格三态 —— 从前夹具一个镇压区域都没有,于是「自动产出」
 *      把地界名压成竖排的事故全绿通过(横向溢出量不到挤压:卡片没溢出,只是挤)。
 *   三十四 四条通用挤压判据,全页面生效:①文字被挤成竖排(宽 < 40px 且折成 3 行以上);
 *      ②数字与量词被换行拆开(「2,798 石」不许变成「2,798 / 石」);③标点被折成孤字(见三十五);
 *      ④纯文字按钮的标签被折行(见四十四)。它们都是「卡片没溢出、只是挤」这一类,
 *      横向溢出永远查不出来。
 *   三十五 标点不许被折成孤字:模板里把标点另起一行写(HTML 会把换行折成空格),
 *      窄屏上句号就会独自占一行 —— 量的是渲染结果,比在源码里认标点准。
 *   三十六 敌人卡最挤的一档:名字最长 9 字 + 满标签(首领/宿敌/3 特性)+ 星级。
 *      巡页用的档里敌人名字都短、认知层为 0(特性根本不显示),这一档从前没被量过。
 *   三十七 新手第一步卡:刚建号的人落在首页时,这张卡要在、要指向历练、要够高 ——
 *      它把「目标 / 主线 / 每日」三块串成一条线,并递出第一个入口(见 core/firstStep)。
 *   三十八 妖气复聚那一行:旧主归来的旧地界要画出「妖气复聚」、要写清"再历一程即可复靖"、
 *      还要有「出发」(见 core/regionRevival)—— 它是这条世界节律唯一的可见面。
 *   三十九 主值行不许折行:带 `data-value-row` 的「标签 + 值」行,右边那一块必须一行放得下。
 *      起因是一次实测反馈:修炼页的灵气行把「积余 X / Y」这类**次要读数**留在主行里,
 *      窄屏后期档上整块被顶到第二行(卡片没溢出、字也没被挤成竖排,前面所有判据都量不出来)。
 *      次要读数该去哪儿:点开的详情里;主行只留「看得懂的那一位」。
 *   四十 正文字对比度 ≥AA:逐个带文本的元素,把祖先链上的背景层(含压在这块字下面的
 *      绝对定位层,如页签的墨块)按 alpha 合成出真实的底,再算 WCAG 比值 —— 大字 3:1、
 *      其余 4.5:1。**两套主题都量**:夜间主题的卡片比页面底色亮,浅色的字放上去最难。
 *      它与调色板本体那套算法(src/ui/palette.spec.ts)是互补的:那边管色号,这边管
 *      「半透明的字」与「带底色的方块」这两件只有真浏览器算得准的事。
 *   四十一 两百档字号(200% 缩放)不许横向溢出、主值行不许折:390 宽的机型按 200%
 *      放大后,布局视口只剩 195 CSS px —— 与五档视口是两回事(量的是缩放档,不是宽度档)。
 *      起因:此前只守 320 这一档,而 390 的真机放大到 200% 比 320 还窄 125px,修炼页的
 *      修为行就是在那一档被顶成两行的。量法与巡页共用 measurePage(同一把尺子)。
 *      空档之外还有一遍**后期档**(神人境的九位数灵石、成套装备、在途秘境):
 *      195 宽上最容易出事的是「长数字 + 满屏内容」,而主巡页那一遍量的是刚建号的空档。
 *      只在某一步出现的浮层(归来卷轴 / 渡劫结果 / 转世三步 / 引擎掷中的顿悟与巡游)
 *      另走 measureDialogZoom:巡页前的 clearOverlays 会把它们收掉,缩放档那一遍
 *      一页都碰不到 —— 归来卷轴就是这么一路绿着的。
 *   四十二 渐变/图片底上的正文对比度:上面那条只算得到**声明出来的色号** —— 法球、
 *      印章、纸纹、以及半透明的纸叠在深色天幕上,真实像素比色号暗一截,那条量不到。
 *      故这里直接采样屏幕像素:把文字临时藏起来拍一张,逐像素算「这枚字落在这一像素上
 *      读不读得出来」,读不出来的像素超过两成就报红。
 *      滚到中段时,页签栏会按设计盖住已经滚到它下面的标题;采样只取主滚动区里真正露出
 *      的那一截,不把被吸顶栏盖住的文字当成「屏幕上的字」。
 *   四十三 28px 触达下限的量法要确定:1280×800 的 /adventure 上报过一次「28px」的红,
 *      四舍五入后正好等于下限,实际是 27.6px 的子像素抖动,而那个按钮声明的是
 *      min-h-[28px]。一条会自己变红的门比没有门更糟,故四处量 28px 的地方统一:声明的
 *      min-height 到了 28 的给半像素容差,报数带一位小数(不再四舍五入到与下限同值)。
 *   四十四 按钮标签不许被折行:纯文字按钮(无子元素、2~18 字)的文字必须落在一行。
 *      实见界域志「问 卦(悟道点 2)」被右侧长注挤成「问 卦(悟道」/「点 2)」—— 门槛数字
 *      拦腰折断。根因又是一行不换行的 flex,横向溢出与前面几条挤压判据都量不出来。
 *   四十五 秘境卡「在境中」的窄屏一档:320 宽 + 本层预览(本层劫 / 胜算 / 战利)+ 三枚层点。
 *      这一行从前整段 nowrap,320 上必顶出卡片 —— 而巡页用的档里没有在途秘境,
 *      三十三 那份 320 夹具的 adventure 切片也没有 secretRealm,于是这一档从没被量过。
 *      夹具直接摆出「打到第二层」的状态,判据走通用那套(横向溢出 + 挤压)。
 *   四十六 开局前两页(欢迎 / 建号):它们是唯二**没有存档才看得见**的页面 ——
 *      路由守卫见存档已开就把 #/welcome、#/create 重定向回首页,所以巡页 ROUTES
 *      永远巡不到它们(硬塞进 ROUTES 只会把首页重复量一遍)。故另开一个无存档的
 *      context:先量欢迎页,再走「启封入山 → 署印入山」落到建号页量一遍。
 *      只查基础档(横向溢出 / 外壳偏移 / 越界元素 / 无名控件 / 可点过小 / 正文对比度),
 *      不查底部导航项数 —— 这两页本来就没有导航(开局前不该有)。
 *      两页也各过一遍 200% 缩放档:旧欢迎页曾在 195 宽下把主钮折成两行、
 *      把三枚底链压成 25px 宽的四字竖排 —— 而这是玩家看到的第一屏。
 *   四十七 浮层在 200% 缩放档:页面上点得开的那几扇(装备详情 / 丹房 / 器魂 / 灵脉)
 *      另起一个任务,在 195×422 里逐扇点开量一遍。巡页不会去点它们,缩放档那一遍
 *      自然也碰不到 —— 实测丹房方子卡三列并排时中间只剩 42px(代价折成六行),
 *      器魂详情的「收 起 / 卸 下」各剩 68px、在空格处断成两行。这两类都不是溢出,
 *      横向溢出与越界元素都量不出来。尺子与「只在某一步出现的浮层」共用一份。
 *   四十九 第二个标签页的只读态:多标签共用一份存档时,后来的那页不启引擎、不写盘
 *      (判据在 core/singleWriter 与 utils/storage 的单测里)。但「不写」对玩家是不可见的 ——
 *      数字不动、点了没反应,而解释只有一条三秒就消失的 toast。故这里另开一个 context
 *      开两页:先开的那页不许有横幅,后开的那页**必须有**一条常驻说明。横幅是朱砂 6% 的
 *      自底,故按四档量 —— 390 与 195(200% 缩放)× 日间 / 夜间:不裁字、不撑出横向溢出;
 *      另跑一次像素对比度(measureTextContrast 自己翻两套主题)。这页不巡游(它是另一条
 *      上下文里的第二页),巡页永远碰不到。
 *   四十八 底部导航的「当前位置」也要量:颜色与那枚朱砂短笔只对眼睛说话,读屏拿到的是
 *      RouterLink 按 exact-active 自己渲染的 aria-current=page —— 这一条先把「它真的在、
 *      且指向当前路由」量一遍:换手写 <a>、或哪个页签的 to 写歪,当场就红。
 *      判据逐页点一次 aria-current=page —— 恰有一枚、且指向当前路由;不在五个页签上时
 *      (market / settings 等)一枚都不许有。源码级那条在 uiLayering.spec 里先拦一道。
 *   五十 修行页的丹药速服只铺前四味。第五味起必须报「另有 N 味」,并能一键落到背包的
 *      丹药页签 —— 只截断不交代,玩家会以为丹匣里只剩四味;直达链接若落回装备页,
 *      这条入口也只是换了个地方继续藏。
 *   五十一 构筑对照不许只给最近八则道痕。余量要报数、可续开,续开后的焦点要送到
 *      新露出的第一则;第九则以前的旧构筑还要真能点开对照 —— 只多一行字、点不动
 *      仍是断头路。
 *   五十二 修仙录的历世履历与行迹录都要能回头。履历再长也只铺当前窗,续开与回翻都要
 *      把焦点送到新页首则;行迹录不再用「仅列最近八则」封死旧回响。两处都在 195 宽
 *      下量续开入口与整页排版。
 *   五十三 道侣弹窗的「历世同行」按最近一世在前分批铺开。履历没有上限,不能把整部
 *      旧缘一次塞进固定滚动框;续开、滑窗、回翻与焦点都要真走通,且 195 宽下能读。
 *   五十四 器魂页的两册(散置形意 / 凝炼台)同样没有数量上限。两册都按价值降序先摆
 *      一批,续开、滑窗、回翻与焦点走同一套长列表规则;195 宽下入口与整扇弹窗都要能读。
 *   五十五 名号与灵兽两册共 69 条也要分批回看。当前相伴必须压过品阶排在第一,
 *      不能藏在同品阶之后;续开、滑窗、回翻与焦点同上一套,195 宽下整页仍可读。
 *   五十六 部位候选按 12 件一批、最多留 24 件。300 件后期背包里同槽仍有几十件,
 *      续开与回翻必须真的可达;换装后佩戴件跳到顶部,窗口要回首批并把焦点送过去。
 *      195 宽下另把候选续到第二批,量分页读数、入口与候选行是否被挤坏。
 *   五十七 法宝全册共 45 条长账,按 6 件一批、最多留 12 件。195 宽下逐批翻到末页
 *      再回翻,随身 / 炼化改序后焦点仍要跟住同一件;整页不许被双按钮或代价行挤坏。
 *   五十八 开炉丹方共 54 张,按 6 张一批、最多留 12 张。搜索换词要重置窗口且不抢
 *      输入焦点;195 宽下逐批翻到末页再回翻,炼制耗料改序后焦点仍要跟住同一张方。
 *   五十九 词条转移的候选是整包装备的横切面:无部位限制的词条能落到全部藏品上。
 *      195 宽下按 12 件一批、最多留 24 件逐批翻到末页再回翻,续开焦点跟住新批;
 *      候选行、件数读数与两枚入口都不许把详情弹窗挤坏。
 *   六十 修行页主 / 辅 / 秘三册终局共 66 部。每门按 12 部一批、最多留 24 部,
 *      195 宽下逐门翻到末页再回翻;换门回首批、焦点留在页签,卸下辅修改序后
 *      详情关闭仍能把焦点还给同一部。批量进修还要在按下前摊开本轮实际层数、
 *      总耗与止点,回执里的数与那块预算同账。
 *   六十一 天界道痕满卷 60 则。道途册与道痕册必须互斥,marks 深链要真的落到履历;
 *      每 12 则一批、最多留 24 则,195 宽下逐批翻到末页再回翻,焦点跟住新批首则。
 *      每行的忆战 / 重写 / 旧纪入口也受 28px 触控下限约束。
 *   六十二 前尘山河三世同册:世界页默认只有当前世界,历史册在空档与后期档里
 *      都不会出现。夹具另造三世旧世界,在 320 与 195(200% 缩放档)下量历史行:
 *      三世都在、顺序由近及远、世界名/段数来自同一份世界视图,标题不截断、行不越界。
 *   六十三 历练首屏的主线优先:未入秘境时整张秘境卡只露一行,「历练」标题先于
 *      支线;390 首屏里第一处地界的「出发」要完整露出,不能被支线卡推到折线以下。
 *   六十四 洞府首屏的营造优先:营造排在山门续账之前,七作各成一条账行,只露
 *      当前首项、下一级首项与主升级键;390 首屏里第一枚可用的升级/建造键要在
 *      底栏以上,完整效果与连升账由 aria-expanded 详情展开。
 *   六十五 界域志首屏的此刻优先:当前境、全路序号与前后境要先落在折线内;
 *      四界卷目默认只开当前界,其余收口,点开后要真的铺出该界境界。
 *   六十六 成就谱首屏的眼下可追:卷首先列最近三枚并写明条件/进度;方向卷目
 *      默认只开最近一路,点最近一枚或换一路时要真的展开目标卷。
 *   六十七 藏珍双阁的九柜换屉:功名榜先列最近三策、方向收成榜牌并只开一路;
 *      藏珍阁的九柜排成三列,柜面报新得/余量,点另一柜时旧屉要合上且只留一屉正文。
 *   六十八 背包先报新得与可换槽位:三章必须按「今日检点 / 九佩 / 藏品」续排,
 *      九席齐全且不再套九张同权卡;检点主行动不宽于账行 72%,容量只报一次。
 *      「只看新得」只铺新件,一键按钮报的可动槽数必须与逐槽入口一致,点下去
 *      正好全部换完。195 宽下整册续卷、分页入口与候选弹窗都不许被挤坏。
 *   六十九 门庭先报今日:在途 / 闲置 / 最近归期来自同一份弟子汇总;在途差事
 *      要有可见进度与读屏进度值。一键派发后卷首与按钮必须同步换口。
 *   七十 道侣的同行帖先答此刻:她主动提的事与共同事件都排在关系刻度之前,
 *      每个选项先摊三项代价,殒落与离开要在落定前说穿;下一阶缺口读同一份门槛真值。
 *      390 与 195(200% 缩放)下选项正文、关系读数与三衡都不许横溢或挤成竖排。
 *   七十一 兵解往生先核门槛与底账:道果、天赋、留折散计数与主要损失先于
 *      去留全账;全账只读轮回结算的同一份继承表,功法回一层与法宝归尘说在落子前。
 *      390 与 195(200% 缩放)下门槛、摘要与主按钮都不许横溢或挤成竖排。
 *   七十二 天界试炼收成一册四章:今日天道、变数、八场试炼与挑战书沿同一卷面续排。
 *      八场试炼先收成一张八门印谱,点印或方向键只换下方一份证道帖;挑战书按
 *      择界 / 叠变数 / 立契 / 命名四程收成立契约台,当前只摊一程、约文与验约常驻。
 *      390 八门四列两行、四程两列两行,960px 起八门同排、四程在左,200% 缩放档
 *      分别退两列与单列,整章只留一枚应试主键。
 *   七十三 三生录的画像、四册册口与当前正文同住一册:册口先报各册真值,
 *      手机 2×2、620px 起四列、220px 以下单列;方向键 / Home / End 要联动焦点、
 *      选中态、地址与唯一 tabpanel。1280 宽才把两本账并读,避免三案主账被压窄。
 *   七十四 设置六章共用一张开口续卷:声息、观照、行止、存续、留痕、卷末按序续排,
 *      章首不得重叠或横向溢出,章内不得重新套四边卡;1280 宽量存续占左、留痕与
 *      卷末叠右的并读几何,195 宽量章态与动作退行后仍无挤压。
 *   七十五 藏珍两章同住一册:总印落在行动章之首,章首统一章号、题名、读法与章内真值;
 *      390 / 620 单列续读,1280 才让行动章与卷目章左右并读,195 把章内读数退到章名下方。
 *   七十六 名号与灵兽各收成一册两章:此刻章与全谱章共用章号、读法与章内真值,
 *      390 / 195 单列续读,960 宽起左右并读;运行时门核对章序、章号、真值与非空章首。
 *   七十七 界域志六册共用章首:卷次、题名、读法与章内真值逐册齐全,390 / 195
 *      先让真值落到题名下方,620 起回到右侧;1280 再核章内真值与正文并读。
 *   七十八 天界内层三册同用开口续卷:道途两章、远征两章与道痕一册的章序、
 *      章内真值和卡壳归零;390 单列,960 起门径与世界账行两两并读,195 读数不竖排。
 *   七十九 坊市兵刃可先验货:本件战力、当前同槽战力、三围增减、词条与固有
 *      都要在同一账线内展开;390 / 195 / 1280 三档核对展开宽度、单列退让与收起。
 *
 * 判据是「横向溢出」这一类——它正是窄屏上最常见的排版事故。
 * 说明:这是无头 Chromium 的视口模拟,不是真机;字体渲染与安全区(刘海/手势条)
 * 仍需真机确认,故本脚本过绿不等于真机过绿。
 *
 * 并发不是「把等待摞在一起」:所有量测都把固定 waitForTimeout 换成了确定性等待
 * (等动画收敛 settleVisuals、等弹窗出现/撤下、巡页前 clearOverlays 钉死随机事件),
 * 否则机器一忙,「等了 300ms」就不再等于「已经就位」,门会在真回归之外自己变红。
 */
import { chromium } from "playwright";
import { createServer as createViteServer } from "vite";
import { blockExternal, watchPageErrors } from "./lib/pageErrors.mjs";
import {
  decryptSlice,
  encryptSlice,
  FULL_MARKS_COUNT,
  lateSlices,
  makeFullMarks,
  seedSave,
  showcaseSlices,
} from "./lib/saveFixture.mjs";
import { SAVE_PREFIX } from "../src/utils/storage.ts";
import { TITLES } from "../src/data/titles.ts";
import { PETS } from "../src/data/pets.ts";
import { PET_VOWS } from "../src/data/petVows.ts";
import { EQUIPMENT_TEMPLATES } from "../src/data/equipment.ts";
import { EVENTS } from "../src/data/events.ts";
import { GONGFA } from "../src/data/gongfa.ts";
import { branchesFor } from "../src/data/gongfaBranches.ts";
import { ACHIEVEMENTS } from "../src/data/achievements.ts";
import { qualityDef } from "../src/data/qualities.ts";
import { REALMS } from "../src/data/realms.ts";
import { QUALITY_VERDICTS, qualityVerdict } from "../src/data/qualityVerdicts.ts";
import { COMPREHEND_PAGE_COST } from "../src/data/constants.ts";
import { NAVIGATION_ENTRIES, NAVIGATION_SECTIONS } from "../src/ui/navigation.ts";
import { folioLayoutOf } from "../src/ui/folioSpread.ts";
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { cpus } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const INDEX = `file://${join(ROOT, "dist/index.html")}`;
const SHOTS_DIR = "/tmp/layout-shots";
const SHOTS = process.argv.includes("--shots");

const VIEWPORTS = [
  // 390×844 = iPhone 12/13/14/15 的标称宽度,当下最常见的一档;
  // 375/320 是旧机型与极窄档。三档一起量,免得只守住了其中一档。
  // dpr 只影响截图栅格化(1px 边框、字体抗锯齿),不影响 CSS 布局与判据 ——
  // 但 --shots 存下来的图因此更接近真机看到的密度,便于人眼复核。
  { width: 390, height: 844, tag: "390", dpr: 3 },
  { width: 375, height: 812, tag: "375", dpr: 3 },
  { width: 320, height: 568, tag: "320", dpr: 2 },
  // 五档「不是手机竖屏」的设备。它们各自暴露过一类毛病,故各占一档:
  //   横屏 844×390 —— 上下两栏吃掉 22% 的高度(改前 26%),而宽度只用掉一半;
  //   平板 620×900 —— 刚进入宽叶,检查页边、底栏与书脊边界;
  //   平板 768×1024 —— 620~959 应铺成宽单叶,不能一边触发多栏、一边锁死 430px;
  //   平板 959×1024 —— 宽叶上限,不能让桌面书脊或双页提前一像素出现;
  //   桌面 1280×800 —— 游戏态展开成书桌:四册双页、首页自成指挥台、多栏案卷放宽、设置仍按读卷居中。
  // 安卓壳与桌面客户端都能转到这五档;PWA manifest 锁了竖屏,浏览器里随意缩窗。
  { width: 620, height: 900, tag: "620x900", dpr: 2 },
  { width: 844, height: 390, tag: "844x390", dpr: 2 },
  { width: 768, height: 1024, tag: "768x1024", dpr: 1 },
  { width: 959, height: 1024, tag: "959x1024", dpr: 1 },
  { width: 1280, height: 800, tag: "1280x800", dpr: 1 },
];
/**
 * 全量路由 —— 从前只巡八页,于是设置页与收藏页的排版与选中态从未被量过。
 * 页面各有各的布局风险,漏一页等于那一页没有守卫(加进来只多几秒)。
 *
 * 没有列 /welcome 与 /create:这两页是**开局前**的状态,路由守卫见存档已开就把它们
 * 重定向回首页(router/index.ts 的 beforeEach)—— 巡页带着真存档,导航过去量到的
 * 只会是首页,硬塞进来等于空转。它们由「开局前两页」任务(四十六)守着:
 * 那边开一个无存档的新 context,这两页才真的被渲染出来。
 */
const ROUTES = [
  "/",
  "/cultivation",
  "/adventure",
  "/inventory",
  "/character",
  "/codex",
  "/souls",
  "/titles",
  "/settings",
  "/build",
  "/collection",
  "/legacy",
  "/dongfu",
  "/world",
  "/celestial",
  "/market",
  "/apprentice",
];

const browser = await chromium.launch({
  args: ["--allow-file-access-from-files", "--disable-web-security"],
});

/**
 * 建"我们自己的"上下文 —— **外域请求一律拦掉**。
 *
 * 为什么放在 context 层:逐个建页点去挂是漏得起的活 —— 实测漏一处就够让门在 CI 里红。
 * 那一次红在"坏档也能进游戏"那个场景:它的页面由 `ctx.newPage()` 建出来,没被拦住,
 * 于是 CI 有网时它真的去加载,`goto(waitUntil: 'load')` 等它等到 30 秒超时。
 * 现在那个脚本已经删掉(不接入任何第三方),这条拦截反过来成了「零外部请求」的量尺。
 * 挂在 context 上,该上下文里**所有**页面(含后续新建的)自动覆盖。
 */
const blockedGetters = [];
async function auditContext(options) {
  const ctx = await browser.newContext(options);
  blockedGetters.push(await blockExternal(ctx));
  return ctx;
}
const blockedTotal = () => blockedGetters.reduce((n, get) => n + get(), 0);
/** 全局失败与计数:各任务跑完按固定顺序并进来(每个任务内部另有自己的同名影子变量) */
const failures = [];
let checked = 0;
/** 量到过多少个 data-value-row —— 用来防这条判据"空转"(契约被删掉后依然全绿)。 */
let valueRowsSeen = 0;
/** 「按钮语义宿主」扫到过几枚 —— 控件套控件那条判据的活信号(0 = 空转) */
let controlHostsSeen = 0;
/** 200% 缩放档量过几页、采样像素量过几处字 —— 同样防判据空转 */
let zoomSeen = 0;
let pixelTextsSeen = 0;
/** 封卷页在 390 / 320 / 195 三档各量过几次 —— 0 表示门径账探针空转 */
let unopenedFolioSeen = 0;
/** 1280 桌面档逐页核过多少次书桌 / 单叶 / 双页几何 */
let desktopFolioSeen = 0;
/** 1280 桌面档逐页核过多少次书脊、当前册与底栏退场 */
let desktopSpineSeen = 0;
/** 844×390 横屏档逐页核过多少次卷首收缩与正文露头 */
let landscapeMastheadSeen = 0;
/** 620 / 768 / 844 / 959 四档宽叶逐页核过多少次铺满、底栏保留与书脊未提前出现 */
let tabletLeafSeen = 0;
const TABLET_LEAF_TAGS = new Set(["620x900", "768x1024", "844x390", "959x1024"]);
/** 四档宽叶逐页核过多少次底栏书脚索引收束与居中 */
let tabletDockSeen = 0;
/** 拦掉的外域请求数 —— 打印出来,顺带证明这条拦截是活的 */
// 外域请求拦截:计数在 context 层累积,收尾打印(见 auditContext)

/**
 * 弹窗**里面**的控件也要过页面上那两条尺子:有可访问名、不小于 28px。
 *
 * 逐页巡的那一遍只量得到页面上摆着的东西 —— 弹窗没打开就不存在,于是这两条
 * 判据一直没有覆盖弹窗内部。实测漏掉的有:共享的关闭键(一枚图标、无名、
 * 内外边距加起来 26px,每个弹窗都有它)、纯文字按钮「立契」(18px)、
 * 行内链接(命中区只有字体那 14px)。故这里量弹窗自己。
 */
async function auditModalControls(page, selector = ".modal-panel") {
  return page.evaluate((rootSelector) => {
    // 测量标准化与 measurePage 同一口径:弹窗的入场过渡(page-fade/modal 过渡)
    // 进行中量几何,量到的是动画中间帧 —— 「进入前请确认」弹窗里的《隐私政策》
    // 按钮(块级 flex + min-h 28px)曾在 1280×800 档被量出 26.3px,三档视口反复
    // 假红;600ms 墙钟等待只压得住 390 档,桌面档的过渡调度仍会撞上中间帧。
    // 注入动画禁令后量的是稳态布局,与截图口径一致。
    const st = document.createElement("style");
    st.textContent = "*,*::before,*::after{animation:none!important;transition:none!important}";
    document.head.appendChild(st);
    const target = [...document.querySelectorAll(rootSelector)].at(-1);
    const panel = target?.matches(".modal-panel") ? target : target?.closest(".modal-panel");
    if (!panel) return null;
    const rows = [...panel.querySelectorAll("button, a, [role=button]")]
      .map((el) => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        const num = (v) => (Number.isFinite(parseFloat(v)) ? parseFloat(v) : 0);
        const minH = num(cs.minHeight);
        const minW = num(cs.minWidth);
        return {
          name: (el.getAttribute("aria-label") || el.textContent || "")
            .trim()
            .replace(/\s+/g, " ")
            .slice(0, 14),
          w: Math.round(r.width * 10) / 10,
          h: Math.round(r.height * 10) / 10,
          cls: (el.className || "").toString().slice(0, 70),
          // 与巡页那条同一把尺子(28×28 两个轴,声明了 min-* 的给半像素容差)
          ok:
            (r.width >= 28 || (minW >= 28 && r.width >= 27.5)) &&
            (r.height >= 28 || (minH >= 28 && r.height >= 27.5)),
        };
      })
      .filter((r) => r.w > 0 && r.h > 0);
    return {
      count: rows.length,
      // 对话框自己也得有个名字:读屏遇到 role=dialog 要念得出是哪一扇
      label: (
        panel.getAttribute("aria-label") ||
        panel.querySelector("h3")?.textContent ||
        ""
      ).trim(),
      unnamed: rows.filter((r) => !r.name).map((r) => `${r.w}×${r.h}px`),
      small: rows
        .filter((r) => !r.ok)
        .map((r) => `${r.w}×${r.h}px«${r.name || "无名"}» [${r.cls}]`),
    };
  }, selector);
}

/**
 * 把取景收拾干净:收掉提示条、钉死随机事件、关掉已经浮上来的弹窗。
 *
 * 由来:弹窗焦点场景三次偶发假红,真凶每次都是引擎随机浮上来的「悟道顿悟」——
 * 它是一整层遮罩,点它盖着的入口自然点不动。只钉 Math.random 不够:
 * 引擎每秒一拍,从「踏入仙途」到这条场景动手之间已经够它掷出一次了。
 */
async function clearOverlays(page) {
  await page.evaluate(() => {
    for (const b of document.querySelectorAll(".pointer-events-none.fixed button")) b.click();
    Math.random = () => 1;
  });
  /*
   * 关掉**已经浮起来**的浮层,并且等够一轮。
   *
   * 坑在这里:引擎掷出顿悟(每秒一拍)与弹窗自己每秒一次的轮询是两个独立定时器,
   * 事件已经产生、窗还没画出来 —— 这时数 .modal-panel 是 0,当场就收工,
   * 一秒后那扇窗才浮上来,正好盖住要点的入口。故这里固定转六圈(≈2.1 秒):
   * 有窗就收掉,没窗就等着 —— 反正随机源已钉死,等到的只会是**之前那一扇**。
   * 机缘卷刻意不吃 Esc,收它必须点卷尾的显式舍签动作;否则遮罩会一直留着,
   * 后面的按钮全被挡住(冷启动返回场景就是这么假红过一次)。
   */
  for (let i = 0; i < 6; i += 1) {
    if ((await page.locator(".modal-panel").count()) > 0) {
      const leave = page.locator(".modal-panel").last().locator("[data-opportunity-leave]");
      if ((await leave.count()) > 0) await leave.click({ timeout: 1500 }).catch(() => {});
      else await page.keyboard.press("Escape");
    }
    await page.waitForTimeout(350);
  }
  return page.evaluate(() =>
    [...document.querySelectorAll(".modal-panel")].map((p) =>
      (
        p.querySelector("[data-opportunity-title]")?.textContent ||
        p.querySelector("h3")?.textContent ||
        p.getAttribute("aria-label") ||
        "?"
      ).trim(),
    ),
  );
}

/** 把 formatGN 渲染出来的文本还原成数值(万/亿/兆…按 10^4 递进) */
async function readFormatted(page, title) {
  return page.evaluate((t) => {
    const detailKey = t === "灵石" ? "stone" : t === "灵气" ? "qi" : "";
    const el =
      document.querySelector(`[title="${t}"]`) ||
      (detailKey ? document.querySelector(`[data-resource-detail="${detailKey}"]`) : null);
    if (!el) return { text: `(找不到 ${t})`, value: null };
    const text = (el.textContent || "").trim().replace(/,/g, "");
    const UNITS = ["万", "亿", "兆", "京", "垓", "秭", "穰", "沟", "涧", "正", "载", "极"];
    const m = /([\d][\d]*(?:\.\d+)?)\s*(万|亿|兆|京|垓|秭|穰|沟|涧|正|载|极)?/.exec(text);
    if (!m) return { text, value: null };
    const unit = m[2] ? Math.pow(10, 4 * (UNITS.indexOf(m[2]) + 1)) : 1;
    return { text, value: parseFloat(m[1]) * unit };
  }, title);
}

/**
 * 一页一量:横向溢出、外壳偏移、越界元素、无名控件、按不动的假按钮、过小可点元素、选择组选中态、底部导航项数。
 *
 * 抽成函数是为了让**后期档**那一遍复用同一把尺子 —— 空档量不出长数字与满屏内容,
 * 而两遍若各写一份判据,迟早会分叉成两套标准。
 */
/**
 * 等这一页的视觉安定下来:两帧 + 所有「有限」动画/过渡跑到终点。
 *
 * 自检读的是「此刻的渲染」,而页面带入场动画(stagger-in / page-fade)与主题色过渡 ——
 * 从前靠固定的 200~700ms 等待顶着,串行时够用;并发之后机器一忙,那几百毫秒就不再
 * 等于「动画跑完」,量到的是半途的帧:页签吸顶偏 1~2px、夜间对比度量到过渡中的色。
 * 这里不再赌时长,直接等动画本身收敛。只等有限动画 —— 云雾那类 infinite 的永不停,
 * 等它等于挂死(它们的位置由截图时的 animations:"disabled" 冻结,与这里各管一段)。
 */
async function settleVisuals(page) {
  await page.evaluate(async () => {
    // 先让这一帧的样式变更落地,过渡才会被 getAnimations 看见
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const runs = document.getAnimations().filter((a) => {
      const t = a.effect?.getComputedTiming?.();
      return !t || t.iterations !== Infinity;
    });
    await Promise.all(runs.map((a) => a.finished.catch(() => {})));
  });
}

/**
 * 主题探针期间冻结 CSS 过渡。
 *
 * 量对比度要的是「换肤之后」的稳定态,而 transition-colors 会让前景与背景在半途
 * 同时向对方靠拢 —— 中间那几帧两边都灰,量出来必然是假红(实测:并发/截图负载下,
 * 无论固定等 260ms 还是等 settle,夜间导航都读到过 2.5:1)。
 * 冻住之后换肤瞬时完成,读到的一直是端点态。探针跑完即摘,不留痕迹。
 */
const FREEZE_TRANSITION_CSS = "*, *::before, *::after { transition: none !important; }";
async function freezeTransitions(page) {
  await page.evaluate((css) => {
    const s = document.createElement("style");
    s.dataset.lcFreeze = "1";
    s.textContent = css;
    document.head.appendChild(s);
  }, FREEZE_TRANSITION_CSS);
}
async function unfreezeTransitions(page) {
  await page.evaluate(() => {
    for (const s of document.querySelectorAll("style[data-lc-freeze]")) s.remove();
  });
}

/**
 * 量对比度前把浮层清干净。
 *
 * 引擎事件弹窗的遮罩(墨 45%)与成就提示条都压在被量的字上面 —— 遮罩会改写整页的底,
 * 提示条会盖住页眉那一行,量出来全是假红。巡页前虽然钉了随机源(clearOverlays),
 * 但**成就**是按状态判定的:切到某一页正好达成一条,照样弹,与随机无关。
 * 故每次量之前现清一遍:点掉提示条、Esc 收掉弹窗,直到两样都没有(最多转四圈)。
 */
async function quiesceOverlays(page) {
  for (let i = 0; i < 4; i += 1) {
    const left = await page.evaluate(() => {
      const toasts = [...document.querySelectorAll(".pointer-events-none.fixed button")];
      for (const b of toasts) b.click();
      return { toasts: toasts.length, modal: document.querySelectorAll(".modal-panel").length };
    });
    if (left.modal > 0) await page.keyboard.press("Escape");
    if (left.toasts === 0 && left.modal === 0) return;
    await page.waitForTimeout(150);
  }
}

async function measurePage(page) {
  return page.evaluate(() => {
    // 测量标准化:入场动画(stagger-in 的位移、breathe 的缩放)进行中量几何,
    // 量到的是动画中间帧 —— /create 的灵根圆环曾在 stagger 中段被量出左右各越 5px。
    // 截图有 animations:"disabled",测量也必须同一口径:测的是稳态布局,不是中间帧。
    // (减动效自检在独立 ctx 按 duration/iteration 量,不受这条注入影响。)
    const st = document.createElement("style");
    st.textContent = "*,*::before,*::after{animation:none!important;transition:none!important}";
    document.head.appendChild(st);
    const vw = window.innerWidth;
    const overflows = [...document.querySelectorAll("body *")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        // 越界=右缘冲出右界 或 左缘冲出左界(r.left < -1)。之前只查右缘:
        // 一个被推离**左**缘的块(负 left / -mx-*)只要右缘仍落在视口内,
        // scrollWidth 不涨、r.right 也不超,横向溢出判据整条失灵。
        const rightOver = r.right > vw + 2;
        const leftOver = r.left < -1;
        if (r.width <= 0 || (!rightOver && !leftOver)) return false;
        /*
         * 纯装饰层(墨爆 / 传送门 / 法球的三层旋转环)故意越过视口边缘,且不吃事件,不算排版事故。
         *
         * 判据看的是**计算后的 pointer-events**,不是类名 —— 组件里关掉事件用的是自定义类
         * (如 `.ring-layer`),按类名找 `.pointer-events-none` 会漏掉它们;而旋转中的方形盒子
         * 其 `getBoundingClientRect()` 会随动画相位涨到 √2 倍,于是同一处装饰一会儿过、一会儿不过
         * —— 那是量法在抖,不是排版在坏(曾让 v1.34.0 的发版流水线红在 375px 首页上)。
         */
        for (let node = el; node; node = node.parentElement) {
          if (getComputedStyle(node).pointerEvents === "none") return false;
        }
        /*
         * 横向滚动轨里的内容**本来就该**超出取景 —— 容器自己负责滚,玩家滚得到。
         * 320-late 的坊市寄售候选行(overflow-x-auto + shrink-0 的候选牌)第一次把
         * 这一族带进判据:牌在轨内越界是设计,不是排版事故。只豁免 auto/scroll,
         * 不豁免 overflow-hidden(外壳那层 hidden 恰恰是「玩家滚不动」的事故层)。
         */
        for (let node = el.parentElement; node; node = node.parentElement) {
          const s = getComputedStyle(node);
          if (s.overflowX === "auto" || s.overflowX === "scroll") return false;
        }
        return true;
      })
      .slice(0, 4)
      .map((el) => {
        const r = el.getBoundingClientRect();
        const side = r.left < -1 ? "L" : r.right > vw + 2 ? "R" : "?";
        return `${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]}@${side}${Math.round(r.left)}..${Math.round(r.right)}`;
      });
    return {
      hash: location.hash,
      /** 这一页上有几个"主值行"(显式契约 data-value-row)—— 用于防空转 */
      valueRowCount: document.querySelectorAll("[data-value-row]").length,
      /**
       * 首屏里被念了不止一遍的可见短句。
       *
       * 这一类冗余没有任何门会红:排版门量溢出与触控面,快照门量像素对比度,
       * 冒烟门点按钮 —— 而「同一个数在同一眼里出现两遍」既没溢出也没错字,
       * 只是让一屏能说清的事占了两行的位置。实测一口气抓出七处:
       * 修炼页「此刻行速」、界域志「第 15–18 境」、宿慧阶梯的阶段名、
       * 铸道「契合 N%」、设置「乐静 · 音静」、界域志的 status 与总述。
       *
       * 判据只认**同一屏内、可见、纯文本叶子节点**里逐字相同的短句:
       *   · 只取 body 主区内、非导航/非顶栏的元素(那些是跨页常驻的索引,本就该重复);
       *   · 只取 6~40 字的短句(长句重复多半是排版巧合,短句重复通常是同一个读数)。
       *     下限从 8 降到 6 是因为实测那些真重复只有 7 字:「契合 100%」。
       *     再低就会把「第 15 境」这类列表项也算进来,噪声压不住;
       *   · 排除 aria-label / title / 隐藏元素(读屏文本与视觉不冲突);
       *   · 相邻两行文字相同不算(那多半是列表里两条同名数据)。
       * 它不判断「该留哪一个」—— 那要人看。它只负责让新出现的一处当场红。
       */
      repeatedShortLines: (() => {
        const vh = window.innerHeight;
        const main = document.querySelector("[data-folio-main]");
        if (!main) return [];
        const seen = new Map();
        const repeats = [];
        for (const el of main.querySelectorAll("*")) {
          if (el.children.length > 0) continue;
          const text = (el.textContent || "").trim().replace(/\s+/g, " ");
          if (text.length < 6 || text.length > 40) continue;
          // 隐藏的、或被 display:none 的祖先藏起来的都不算
          if (!el.offsetParent) continue;
          const cs = getComputedStyle(el);
          if (cs.visibility === "hidden" || cs.opacity === "0") continue;
          const box = el.getBoundingClientRect();
          if (box.top < 0 || box.bottom > vh || box.width <= 0) continue;
          // 导航与顶栏是跨页常驻的索引,不在「同一页说两遍」的范围里
          if (el.closest("[data-folio-dock], [data-folio-head], [data-folio-spine]")) continue;
          /*
           * 相同文案只有在**同一块**里才算重复。
           *
           * 「尚差 21%」在铸道页出现两次:卷首 meta 说的是离最近流派还差多少,
           * 核心词条那一行说的是该词条自己还差多少 —— 两处恰好同值,但不是同一个
           * 读数,分开是对的。用最近的可辨识祖先(data-* 或语义区块)当身份,
           * 两个不同区块里的同值不算复读。
           */
          const blockOf = (node) => {
            const host = node.closest(
              "[data-cultivation-meters], [data-build-core], [data-market-shelf], [data-market-pulse]",
            );
            return (
              host ?? node.closest("section, article, header, li, footer") ?? node.parentElement
            );
          };
          const key = text;
          if (seen.has(key)) {
            const { top, block } = seen.get(key);
            // 竖直方向紧挨着的同名行多半是列表数据,不算;不同区块里的同值也不算
            if (Math.abs(box.top - top) > 8 && block === blockOf(el)) repeats.push(text);
          } else {
            seen.set(key, { top: box.top, block: blockOf(el) });
          }
        }
        return [...new Set(repeats)];
      })(),
      horizontalOverflow: document.documentElement.scrollWidth > vw + 1,
      /**
       * 外壳(#app 的第一层)不能被滚偏,也不该有可滚的横向余量。
       *
       * 它是 overflow-hidden 的:玩家滚不动,但**浏览器滚得动**。
       * 云雾装饰故意越界画出盒子(左上 -64px、右下 -96px),曾把外壳撑到
       * scrollWidth 516 vs clientWidth 390;建号结束时浏览器顺手把 scrollLeft
       * 设成 24,此后整个界面永久左移 24px —— 顶栏名字被切掉左半边、底部
       * 第一栏「洞府」只剩半个字。而「查 documentElement 有没有横向溢出」查不出
       * 这件事:overflow-hidden 把子元素的溢出挡在外壳以内,量在最外层永远是绿的。
       * 故这里直接量外壳自己:scrollLeft 必须为 0,且不该有横向可滚区间。
       */
      shellShift: (() => {
        const shell = document.getElementById("app")?.firstElementChild;
        if (!shell) return null;
        return {
          scrollLeft: Math.round(shell.scrollLeft),
          overflowX: Math.round(shell.scrollWidth - shell.clientWidth),
        };
      })(),
      /**
       * 主内容区自己的横向余量。
       *
       * main 是 overflow-x-hidden:被 nowrap 撑宽的子元素仍可能把滚动区的 scrollWidth
       * 撑大,而它自己的盒子与子元素矩形都还在视口内,横向溢出与越界元素量不出来。
       * 直到 focus() 把 scrollLeft 推走,整页才突然左移。修行页的闭关按钮就是这么
       * 一路绿到功法详情打开:按钮 127px、内容 214px,main.scrollLeft 随即变成 17px。
       */
      contentShift: (() => {
        const main = document.querySelector("main");
        if (!main) return null;
        return {
          scrollLeft: Math.round(main.scrollLeft),
          scrollWidth: Math.round(main.scrollWidth),
          clientWidth: Math.round(main.clientWidth),
          overflowX: Math.round(main.scrollWidth - main.clientWidth),
        };
      })(),
      overflows,
      navItems: document.querySelectorAll("[data-folio-dock] button, [data-folio-dock] a").length,
      /**
       * 底栏标出来的「当前在哪一页」—— 读屏靠 aria-current,不靠颜色与那枚朱砂短笔。
       * 取的是 href 而不是文字:文字可以重名(以后多一枚「洞府」入口也不会误判)。
       */
      navCurrent: [...document.querySelectorAll("[data-folio-dock] [aria-current='page']")].map(
        (el) => String(el.getAttribute("href") || "").replace(/^#/, ""),
      ),
      /**
       * 只有图标的控件必须自带可访问名(aria-label / 可见文字)。
       * 没有名字,读屏只会念「按钮」「链接」,自动化也无从按名字点它。
       */
      unnamed: [...document.querySelectorAll("button, a, [role=button]")]
        .filter((el) => {
          const name = (el.getAttribute("aria-label") || el.textContent || "").trim();
          if (name) return false;
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        })
        .slice(0, 3)
        .map((el) => el.outerHTML.slice(0, 80).replace(/\s+/g, " ")),
      /**
       * 声明了按钮语义、却按不动的控件 —— 「念出来是个按钮,按下去没反应」。
       *
       * 由来:器魂页的空槽位无论有没有器魂都挂着 role=button,tabindex 却给到
       * 空槽 -1,aria-label 写着「空」。读屏于是播报一个按钮,而点它只是把
       * soulDetail 赋成 null —— 弹窗连开都不开。声明了 affordance 却不给操作,
       * 比不声明更坏:人会以为自己漏做了什么。
       *
       * 判据(逐条排除误报):
       *   role=tab 不判 —— roving tabindex(选中 0、其余 -1)是规范要求的模式;
       *   原生 <button disabled> / aria-disabled=true 不判 —— 那是「置灰」,
       *     读屏会念出禁用原因,不是假按钮(置灰要列差量另有判据在别处守);
       *   <a href> 只在 tabindex=-1 时判 —— 链接不挂 tabindex 本就可达;
       *   [role=button] 与自绘 <button> 缺 tabindex(=null)或 -1 都判 ——
       *     div 上的 role=button 没有 tabindex 就是键盘进不去、也进不了 Tab 序。
       * 只管**看得见**的(零盒子不算),截图外的东西读屏也念不到。
       */
      deadControls: [...document.querySelectorAll("button, [role=button], a[href]")]
        .filter((el) => {
          if (el.getAttribute("role") === "tab") return false;
          if (el.hasAttribute("disabled")) return false;
          if (el.getAttribute("aria-disabled") === "true") return false;
          const r = el.getBoundingClientRect();
          if (r.width <= 0 || r.height <= 0) return false;
          const ti = el.getAttribute("tabindex");
          if (el.tagName === "A") return ti === "-1";
          if (el.getAttribute("role") === "button") return ti === null || ti === "-1";
          if (el.tagName === "BUTTON") return ti === "-1";
          return false;
        })
        .slice(0, 3)
        .map(
          (el) =>
            `${el.tagName.toLowerCase()}${el.getAttribute("role") ? `[role=${el.getAttribute("role")}]` : ""}` +
            ` tabindex=${el.getAttribute("tabindex") ?? "—"} ` +
            `«${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 12)}» ` +
            `[${(el.className || "").toString().slice(0, 40)}]`,
        ),
      /**
       * 控件里套控件 —— 读屏听到的「一个按钮」与手上按得动的「两个按钮」对不上。
       *
       * 由来:器魂槽位整卡是 role=button 的 div,里面又嵌着「卸下」<button>。
       * CDP 读出的无障碍树真把它画成 button ⊃ button。ARIA 里 button 带
       * **Children Presentational: True**(WAI-ARIA 1.3 的角色模型;ACT 规则 307n5z
       * 「presentational children 的元件不许有可聚焦内容」)—— 读屏本应把里面的内容
       * 压平成一段文字,那个「卸下」在 VoiceOver / TalkBack 上就可能根本不可达,
       * 而本作是移动端优先的放置游戏。Chrome 肯把它露出来不等于别的读屏也肯。
       *
       * 判据只查**同一条可聚焦链**上的两层:宿主是按钮语义(button / [role=button] /
       * [role=link] / a[href]),里面还有可见的可聚焦件(真按钮、链接、表单件、
       * [role=button|link|checkbox]、非 -1 的 tabindex)。role=tab / checkbox /
       * switch 不判 —— 它们是组合控件,规范本身就允许里面挂子件(本库 InkTabs 的
       * tablist、GongfaSection 的分类签都在这一类,一并被宿主选择器排除在外)。
       *
       * hosts 计数是**活信号**:扫到过几枚按钮语义宿主。0 就等于这条判据空转
       * (与 data-value-row / 200% 档 / 像素采样同一套防法)—— 判据若从没量到过东西,
       * 绿得毫无信息。
       */
      nestedControls: (() => {
        const FOCUSABLE =
          "button, a[href], input, select, textarea, [role=button], [role=link], [role=checkbox], [role=radio], [role=switch], [role=combobox], [tabindex]";
        const hosts = [...document.querySelectorAll("button, [role=button], a[href]")].filter(
          (el) => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0;
          },
        );
        const bad = [];
        for (const host of hosts) {
          const inner = [...host.querySelectorAll(FOCUSABLE)].filter((el) => {
            if (el === host) return false;
            if (el.getAttribute("tabindex") === "-1") return false;
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0;
          });
          if (!inner.length) continue;
          const label = (el) =>
            `${el.tagName.toLowerCase()}${el.getAttribute("role") ? `[role=${el.getAttribute("role")}]` : ""}`;
          bad.push(
            `${label(host)}«${(host.getAttribute("aria-label") || host.textContent || "").trim().slice(0, 12)}」` +
              ` 里套着 ${inner.length} 个可聚焦件(${inner.slice(0, 2).map(label).join(", ")})`,
          );
        }
        return { items: bad.slice(0, 3), hosts: hosts.length };
      })(),
      /**
       * 可点元素的高度下限 28px —— 拇指点得着的最起码尺寸。
       * 实测(带装备的后期档,375/320 两档):修前有 47 个不足 24px、26 个不足 28px,
       * 大多是把文字行直接当按钮(属性来源行、返回链接、设置里的胶囊按钮)。
       *
       * 量法本身要确定(第四十三条,原 HYP-112):1280×800 的 /adventure 上报过一次
       * 「28px」的红 —— 打印出来四舍五入正好等于下限,实际是 27.6px 的子像素抖动,
       * 而那个按钮自己声明的是 `min-h-[28px]`。一条会自己变红的门比没有门更糟,故:
       *   一 声明的 min-height 到了 28px 的,盒子在 27.5px 以上就不判(那是渲染精度);
       *   二 报数带一位小数,不再四舍五入到与被测下限同值。
       */
      smallTargets: [...document.querySelectorAll("button, a, [role=button]")]
        .map((el) => {
          const r = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          const num = (v) => {
            const n = parseFloat(v);
            return Number.isFinite(n) ? n : 0;
          };
          return {
            el,
            r,
            minH: num(cs.minHeight),
            minW: num(cs.minWidth),
          };
        })
        .filter(({ r, minH, minW }) => {
          if (r.width <= 0 || r.height <= 0) return false;
          /*
           * 28px 是触控下限的**两个轴**,不是一个。
           *
           * 这条原先只量高度:高度给足了,宽度可以窄到 7px 也算过。实测「修为 5.7」
           * 那枚可点数只有 17.5px 宽、「▸来路」25px —— 拇指按不到这么窄的一条,
           * 而它们的高度都在 30~32px,判据一路绿灯。横向同样按 28 判,容差与高度一致:
           * 自己声明了 min-width ≥28 的,盒子到 27.5 以上就不判(亚像素)。
           */
          const tooNarrow = r.width < 28 && !(minW >= 28 && r.width >= 27.5);
          const tooShort = r.height < 28 && !(minH >= 28 && r.height >= 27.5);
          return tooNarrow || tooShort;
        })
        .slice(0, 4)
        .map(({ el, r, minH, minW }) => {
          /*
           * 报错要带类名 —— 只报「26.3px «《隐私政策》»」时,读者无从知道
           * 量到的是哪一枚(同一个文案可能在弹窗与页面上各有一份)。
           * 类名一摆出来,"量错了元素"与"真没给够高度/宽度"一眼可分。
           */
          const size = `${r.width.toFixed(1)}×${r.height.toFixed(1)}px`;
          const declared = `声明 ${minW || "—"}×${minH || "—"}px`;
          const axis = r.width < 28 ? "宽" : "高";
          return `${size}(${declared},${axis}不足)«${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 12)}» [${(el.className || "").toString().slice(0, 60)}]`;
        }),
      /**
       * 禁用态的字也得读得出来 —— **全库所有 :disabled**,不再只认两个手写类名。
       *
       * 禁用态往往正是「为什么不让我点」那句(「修为未至圆满」「灵石不足」「尚差 N 道源」),
       * 那是玩家最需要读到的一句。此前这条判据只扫 `.btn-seal:disabled, .btn-ghost:disabled`
       * —— 手写清单等于「扫到什么就守什么」:chip-ink、card-ink 当按钮、`aria-disabled`
       * 的自绘行、以及**整块压 opacity** 的那批,一处都没进过门。实测这批逃逸者的读数:
       * 「入 炉」1.76:1、「尚差 3 道源」1.90:1、逆旅契卡 2.31:1 —— 全都低于 3:1。
       *
       * 量的是**合成之后**的前景/背景,两处都不能只看声明的色号:
       *   底 —— 祖先链上层层半透明底色按 alpha 合成(.btn-ghost:disabled 的底是
       *        rgb(ink / 0.04),只看这一层会当成纯黑,算出 2.46:1 的假红);
       *   字 —— 祖先链上的 `opacity` 也要逐层乘进去。整块压透明度正是漏得最狠的那种:
       *        声明里字色明明够深,乘上 0.4 之后只剩 2.31:1,而 `getComputedStyle().color`
       *        读到的仍是压之前的值。
       */
      dimDisabled: (() => {
        const lum = (c) => {
          if (!c) return null;
          const f = (v) => {
            const s = v / 255;
            return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
          };
          return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
        };
        const parse = (c) => {
          const m = /rgba?\(([^)]+)\)/.exec(c);
          if (!m) return null;
          const p = m[1]
            .split(/[,\s/]+/)
            .filter(Boolean)
            .map(Number);
          if (p.length < 3) return null;
          return { rgb: p.slice(0, 3), a: p.length > 3 ? p[3] : 1 };
        };
        /** 祖先链上的背景层 + 累计 opacity(元素自身的 opacity 也乘进去) */
        const paintOf = (start) => {
          const layers = [];
          let cum = 1;
          let n = start;
          while (n) {
            const cs = getComputedStyle(n);
            const c = parse(cs.backgroundColor);
            if (c && c.a > 0) layers.push({ rgb: c.rgb, a: c.a * cum });
            cum *= Number(cs.opacity);
            n = n.parentElement;
          }
          let base = [255, 255, 255];
          for (let i = layers.length - 1; i >= 0; i -= 1) {
            const { rgb, a } = layers[i];
            base = [0, 1, 2].map((k) => rgb[k] * a + base[k] * (1 - a));
          }
          return { base, cum };
        };
        const out = [];
        for (const el of document.querySelectorAll(":disabled, [aria-disabled=true]")) {
          if (!el.offsetParent) continue;
          const text = (el.textContent || "").trim();
          if (!text) continue;
          /** 取第一个真有字的节点的色 —— 按钮里常有一串次级 span,取按钮自己的色会量错 */
          const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
          let target = el;
          for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            if (node.textContent.trim()) {
              target = node.parentElement ?? el;
              break;
            }
          }
          const { base, cum } = paintOf(el);
          const raw = parse(getComputedStyle(target).color)?.rgb;
          if (!raw) continue;
          // 字也吃祖先链的 opacity:压到 40% 的白字,实际是「40% 的白 + 60% 的底」
          let fgCum = 1;
          for (let n = target; n; n = n.parentElement) fgCum *= Number(getComputedStyle(n).opacity);
          const fg = [0, 1, 2].map((k) => raw[k] * fgCum + base[k] * (1 - fgCum));
          const lf = lum(fg);
          const lb = lum(base);
          if (lf === null || lb === null) continue;
          const ratio = (Math.max(lf, lb) + 0.05) / (Math.min(lf, lb) + 0.05);
          if (ratio < 3)
            out.push({ ratio: Math.round(ratio * 100) / 100, text: text.slice(0, 14), cum });
        }
        return out
          .sort((a, b) => a.ratio - b.ratio)
          .slice(0, 4)
          .map(
            (x) =>
              `${x.ratio}:1 «${x.text}»${x.cum < 0.999 ? `(整块 opacity ${x.cum.toFixed(2)})` : ""}`,
          );
      })(),
      /**
       * 顶栏里的字都只能占一行。
       *
       * 320 宽时曾把「3000/1000 亿载」「9 兆」「25.33 亿」折成两行 —— 数字一断行
       * 看着就像乱码,顶栏还从 46px 涨到 58px。故逐格量高:超过一行(≈24px)就是又折了。
       */
      headerTall: (() => {
        const header = document.querySelector("header");
        if (!header) return [];
        return [...header.querySelectorAll("span, p")]
          .filter((el) => el.getBoundingClientRect().height > 24)
          .slice(0, 3)
          .map(
            (el) =>
              `${Math.round(el.getBoundingClientRect().height)}px «${(el.textContent || "").trim().slice(0, 10)}»`,
          );
      })(),
      /**
       * 第三十九道:**主值行不许折行**(显式契约:`data-value-row`)。
       *
       * 起因是一次实测反馈:修炼页的灵气行把「积余 X / Y」这类**次要读数**留在主行里,
       * 窄屏上右边整块被顶到第二行 —— 卡片没溢出、文字也没被挤成竖排,前面所有判据都量不出来,
       * 可人一眼就看出"排面不齐"。同类的还有修为行的「(积 +X)」。
       *
       * 判据用**显式契约**而不是"所有 flex 行":哪些行是"标签 + 一个值"由模板说了算
       * (与 data-region-card 同一套做法),不然整页散文里的正常换行都会被卷进来。
       * 量法:取这一行**最后一个有文字的块**,数它占了几条行盒(inline 元素按 getClientRects
       * 去重 top;块元素按高 ÷ 行高)—— 超过一行就是"次要读数把主行挤折了"。
       */
      valueRows: (() => {
        const out = [];
        for (const row of document.querySelectorAll("[data-value-row]")) {
          const blocks = [...row.children].filter((el) => (el.textContent || "").trim().length > 0);
          const last = blocks[blocks.length - 1];
          if (!last) continue;
          const style = getComputedStyle(last);
          const lineHeight = parseFloat(style.lineHeight) || 16;
          const rects = [...last.getClientRects()];
          const lines =
            style.display === "inline" || style.display === "inline-block"
              ? new Set(rects.map((r) => Math.round(r.top))).size
              : Math.max(1, Math.round(last.getBoundingClientRect().height / lineHeight));
          if (lines > 1) {
            out.push(`${lines} 行 «${(last.textContent || "").trim().slice(0, 14)}»`);
          }
        }
        return out.slice(0, 3);
      })(),
      /**
       * 地界卡不许把名字挤成竖排,也不许让操作块压到名字那一行。
       *
       * 「横向溢出」量不出这类事故:卡片并没有溢出,只是右侧那一列把左边的名字压到只剩一个字宽,
       * 「青云山麓」当场变成一字一行,标签还会盖到产出字上 —— 玩家先看见,脚本量不到。
       * 故直接量两块元素的位置关系(名字高度 + 头部与操作块是否相交)。
       */
      regionCards: (() => {
        const tall = [];
        const overlap = [];
        for (const card of document.querySelectorAll("[data-region-card]")) {
          const name = card.querySelector("[data-region-name]");
          const label = (name?.textContent || "").trim();
          if (name) {
            const h = Math.round(name.getBoundingClientRect().height);
            // 15px 楷体单行约 22px;超过 30px 就是折行了(竖排四行能到 88px)
            if (h > 30) tall.push(`${h}px «${label}»`);
          }
          const head = card.querySelector("[data-region-head]");
          if (!head) continue;
          const a = head.getBoundingClientRect();
          for (const act of card.querySelectorAll("[data-region-action]")) {
            const b = act.getBoundingClientRect();
            if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) {
              overlap.push(`«${label}» 与操作块重叠`);
            }
          }
        }
        return { tall: tall.slice(0, 3), overlap: overlap.slice(0, 3) };
      })(),
      /**
       * 通用挤压判据之一:**被挤成竖排的文字**。
       *
       * 一行 flex 里塞了「长文字 + shrink-0 的右列」时,左列会被压到只剩一个字宽,
       * 于是「青云山麓」一字一行 —— 卡片并没有溢出,横向溢出查不出来。
       * 判据取「宽度 < 40px 且折成 3 行以上」:正常的排版不会出现这种盒子。
       */
      verticalTexts: [...document.querySelectorAll("span, p, div, h1, h2, h3, button")]
        .filter((el) => {
          const text = (el.textContent || "").trim();
          if (text.length < 3) return false;
          if (el.querySelector("span, p, div, button, a")) return false; // 只看最内层文字
          const r = el.getBoundingClientRect();
          if (r.width <= 0 || r.width >= 40) return false;
          const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 16;
          return r.height > lineHeight * 2.5;
        })
        .slice(0, 3)
        .map(
          (el) =>
            `${Math.round(el.getBoundingClientRect().width)}px 宽 «${(el.textContent || "").trim().slice(0, 10)}»`,
        ),
      /**
       * 通用挤压判据之二:**数字与量词分家**。
       *
       * 「升级 · 2,798石 50铁」在 320 宽上会断成「升级 · 2,798 / 石 50铁」——
       * 数与单位跨行看着像两个数。用 Range 逐字取矩形,量出「数字|量词」是否被换行拆开。
       */
      unitBreaks: (() => {
        const UNITS = "石铁尘株张载年次件层场阶枚缕时日";
        const rectAt = (node, i) => {
          const r = document.createRange();
          r.setStart(node, i);
          r.setEnd(node, i + 1);
          const box = r.getBoundingClientRect();
          return box.width > 0 || box.height > 0 ? box : null;
        };
        const out = [];
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let node = walker.nextNode();
        while (node && out.length < 3) {
          const t = node.nodeValue || "";
          if (!/[\d,.][\s]*[石铁尘株张载年次件层场阶枚缕]/.test(t)) {
            node = walker.nextNode();
            continue;
          }
          // 只量**标签/代价**这类短文本(≤24 字):长句子里的正常换行不算事故,
          // 否则整页散文都会被卷进来,判据就没人看了
          if (t.trim().length > 24) {
            node = walker.nextNode();
            continue;
          }
          for (let i = 1; i < t.length; i += 1) {
            const ch = t[i];
            if (!UNITS.includes(ch)) continue;
            let j = i - 1;
            while (j >= 0 && /\s/.test(t[j])) j -= 1;
            if (j < 0 || !/[\d,.]/.test(t[j])) continue;
            const a = rectAt(node, j);
            const b = rectAt(node, i);
            if (a && b && Math.abs(a.top - b.top) > 4) {
              out.push(`«${t.trim().slice(0, 14)}»`);
              break;
            }
          }
          node = walker.nextNode();
        }
        return out;
      })(),
      /**
       * 通用挤压判据之三:**孤零零的标点**。
       *
       * 「……仍受益的财富」换行 + 后面单独一个「。」时,句号会被推到下一行独自站着
       * (模板里把标点另起一行写的必然结果)。判据:某段只含标点的文字,
       * 与同一父节点里其余文字不在同一行。
       */
      orphanPunctuation: (() => {
        const out = [];
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let node = walker.nextNode();
        while (node && out.length < 3) {
          const t = node.nodeValue || "";
          const trimmed = t.trim();
          // 只认中文标点:半角「?」这类是占位符(未知装备就写着「?」),不是折行事故
          if (!/^[。、,]{1,2}$/.test(trimmed)) {
            node = walker.nextNode();
            continue;
          }
          const parent = node.parentElement;
          if (!parent) {
            node = walker.nextNode();
            continue;
          }
          // 父节点里必须还有别的文字 —— 整块内容只有标点(装饰)不算孤字
          const siblings = [...parent.childNodes].filter(
            (n) => n !== node && n.nodeType === Node.TEXT_NODE && (n.nodeValue || "").trim(),
          );
          if (siblings.length === 0) {
            node = walker.nextNode();
            continue;
          }
          const r = document.createRange();
          r.setStart(node, 0);
          r.setEnd(node, t.length);
          const box = r.getBoundingClientRect();
          if (box.width <= 0 && box.height <= 0) {
            node = walker.nextNode();
            continue;
          }
          // 同一父节点里,有没有别的文字落在同一行(±4px)
          const alone = siblings.every((sn) => {
            const sr = document.createRange();
            sr.setStart(sn, 0);
            sr.setEnd(sn, (sn.nodeValue || "").length);
            const sb = sr.getBoundingClientRect();
            return Math.abs(sb.top - box.top) > 4;
          });
          if (alone) out.push(`«${(parent.textContent || "").trim().slice(0, 16)}»`);
          node = walker.nextNode();
        }
        return out;
      })(),
      /**
       * 通用挤压判据之四:**按钮标签被折行**。
       *
       * 按钮里的字是动作的名字(「问 卦(悟道点 2)」「升级 · 3,861 石」),它被折成两行
       * 不只是难看 —— 门槛数字会被拦腰折断(实见「问 卦(悟道」/「点 2)」)。根因又是一行
       * 不换行的 flex:按钮自己没设 shrink,被右侧长注挤扁后文字只好折行。卡片没溢出、
       * 字也没被挤成竖排,横向溢出与上面几条都量不出来。
       *
       * 只量**纯文字按钮**(无子元素、文字 2~18 字),图标 + 文字的按钮由子元素自己撑,
       * 不在这里管;超过 18 字的多是整段叙述型按钮(如设置页的说明长句),折行属正常。
       */
      wrappedButtonLabels: (() => {
        const out = [];
        for (const el of document.querySelectorAll("button")) {
          if (el.closest("[data-toast]")) continue; // toast 明确允许多行,不是动作标签
          if (el.children.length > 0) continue; // 只看纯文字按钮
          const text = (el.textContent || "").trim();
          if (text.length < 2 || text.length > 18) continue;
          const r = el.getBoundingClientRect();
          if (r.width <= 0 || r.height <= 0) continue;
          const range = document.createRange();
          range.selectNodeContents(el);
          const lines = new Set([...range.getClientRects()].map((x) => Math.round(x.top))).size;
          if (lines >= 2) out.push(`«${text.slice(0, 16)}»`);
          if (out.length >= 3) break;
        }
        return out;
      })(),
      /**
       * 折行的按钮里哪些是**禁用态的原因句**。
       *
       * 「修为未至圆满」正好 6 字,`btn-seal w-full` 在 195 档折成两行 —— 但它是
       * 「为什么按不得」的说明,不是动作词,折行不影响理解。缩放档那条判据按语义
       * 排除它们(看 disabled),而不是把字数阈值往上抬 —— 抬阈值会连真正的四字
       * 动作词一起放过。
       */
      disabledButtonLabels: [...document.querySelectorAll("button[disabled]")]
        .filter((el) => el.children.length === 0)
        .map((el) => {
          const r = el.getBoundingClientRect();
          if (r.width <= 0 || r.height <= 0) return null;
          const range = document.createRange();
          range.selectNodeContents(el);
          const lines = new Set([...range.getClientRects()].map((x) => Math.round(x.top))).size;
          return lines >= 2 ? (el.textContent || "").trim().slice(0, 16) : null;
        })
        .filter((x) => x !== null),
      /**
       * 选择型控件的选中态要对机器可读,且**每组恰有一个**。
       *
       * 此前主题/战报速度/页签的选中全靠边色,读屏用户与自动化都看不出选了哪个
       * (上一轮补了 aria-label/aria-pressed,这里把「恰好一个」钉住)。
       */
      badGroups: (() => {
        const out = [];
        for (const attr of ["aria-pressed", "aria-selected"]) {
          const byParent = new Map();
          for (const el of document.querySelectorAll(`[${attr}]`)) {
            const parent = el.parentElement;
            if (!parent) continue;
            byParent.set(parent, [...(byParent.get(parent) ?? []), el]);
          }
          for (const [, els] of byParent) {
            if (els.length < 2) continue;
            const on = els.filter((e) => e.getAttribute(attr) === "true").length;
            if (on !== 1) out.push(`${attr} 组(${els.length} 项)里有 ${on} 个选中`);
          }
        }
        // 页签:每一组(同一父容器下 ≥2 个 role=tab)恰有一个 aria-selected=true
        const tabsByParent = new Map();
        for (const el of document.querySelectorAll("[role=tab]")) {
          const parent = el.parentElement;
          if (!parent) continue;
          tabsByParent.set(parent, [...(tabsByParent.get(parent) ?? []), el]);
        }
        for (const [, els] of tabsByParent) {
          if (els.length < 2) continue;
          const on = els.filter((e) => e.getAttribute("aria-selected") === "true").length;
          if (on !== 1) out.push(`页签组(${els.length} 项)里有 ${on} 个选中`);
        }
        // 设置页六组选择(声息×2、观照×2、行止×2)是明文约定:少了哪一组这里就红
        if (location.hash.startsWith("#/settings")) {
          const pressed = document.querySelectorAll("[aria-pressed]").length;
          if (pressed < 14)
            out.push(`设置页的选择控件只有 ${pressed} 个带 aria-pressed(六组共 14 项)`);
        }
        return out.slice(0, 3);
      })(),
      /**
       * 顶栏与底栏必须钉死 —— 滚一遍,两栏一步都不许动。
       *
       * 结构上两栏是滚动宿主的**兄弟**(内容在 main 里滚),按理动不了。可一旦
       * **外壳比可视区高**,文档层就攒出纵向可滚余量,玩家一拖窗口两栏就跟着走,
       * 看着就是「没固定」。手机浏览器的 100vh 正是大视口(地址栏收起时的高度),
       * 所以这条 bug 只在手机浏览器里现形 —— 桌面与无头浏览器量不出差值,
       * 只能量它的**机制**:文档层有可滚余量,且滚窗口时两栏真的位移了。
       */
      railDrift: (() => {
        const main = document.querySelector("main");
        const header = document.querySelector("header");
        const nav = document.querySelector("[data-folio-dock]");
        if (!main || !header || !nav) return null;
        const doc = document.documentElement;
        const windowOverflow = Math.round(doc.scrollHeight - doc.clientHeight);
        const at = () => ({
          top: Math.round(header.getBoundingClientRect().top),
          bottom: Math.round(nav.getBoundingClientRect().bottom),
        });
        const before = at();
        const back = window.scrollY;
        window.scrollTo(0, windowOverflow + 4000);
        const after = at();
        const moved = Math.round(window.scrollY - back);
        window.scrollTo(0, back);
        return {
          windowOverflow,
          moved,
          drift: Math.max(Math.abs(before.top - after.top), Math.abs(before.bottom - after.bottom)),
        };
      })(),
    };
  });
}

/**
 * 正文对比度 —— 量的是**合成之后**的颜色,不是配置里的色号
 *
 * 调色板本体按「纸 / 纸深 / 卡片」三张底算过一遍(src/ui/palette.spec.ts),但真界面上
 * 还有两件它算不到的事:一是**半透明的字**(text-cinnabar/80 这种,实际颜色是字色与底
 * 混出来的),二是**带底色的方块**(品阶方块是「底色 = 它自己 6% 的墨」)。这一条把这些
 * 一并量掉,顺带守住以后新写的小字。
 *
 * 量法:逐个带直接文本的元素,把祖先链上所有背景层(含同层压在这块字下面的绝对定位层,
 * 比如页签那个滑动的墨块)按 alpha 合成出真实的底,再与字色算 WCAG 比值。
 * 阈值按字号分档:≥24px(或加粗 ≥18.66px)算大字 3:1,其余 4.5:1;
 * 禁用态、aria-hidden、渐变底跳过(禁用态另有专门的 3:1 判据)。
 * 两套主题都量:同一个页面上切 data-theme,不重新导航 —— 夜间主题的卡片比页面底色亮,
 * 浅色的字放上去才是最难的那一档,只量日间会漏。
 */
async function measureTextContrast(page) {
  await freezeTransitions(page);
  const measure = async (theme) => {
    await page.evaluate((t) => {
      document.documentElement.dataset.theme = t;
    }, theme);
    await settleVisuals(page); // 等 transition-colors 走完再量
    return page.evaluate(() => {
      const parse = (c) => {
        const m = /rgba?\(([^)]+)\)/.exec(c);
        if (!m) return null;
        const p = m[1]
          .split(/[,\s/]+/)
          .filter(Boolean)
          .map(Number);
        if (p.length < 3) return null;
        return { rgb: p.slice(0, 3), a: p.length > 3 ? p[3] : 1 };
      };
      const f = (v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      };
      const lum = (c) =>
        c === null ? null : 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
      const over = (fg, bg) => [0, 1, 2].map((i) => fg.rgb[i] * fg.a + bg[i] * (1 - fg.a));
      /** 这块字底下真正被涂的是什么颜色:自身向上合成,外加覆盖它的绝对定位层 */
      const paintUnder = (el, rect) => {
        const layers = [];
        let node = el;
        while (node) {
          for (const sib of node.parentElement?.children ?? []) {
            if (sib === node) continue;
            const scs = getComputedStyle(sib);
            if ((scs.position !== "absolute" && scs.position !== "fixed") || scs.display === "none")
              continue;
            const b = parse(scs.backgroundColor);
            if (!b || b.a <= 0) continue;
            const r = sib.getBoundingClientRect();
            if (
              r.left <= rect.left + 1 &&
              r.right >= rect.right - 1 &&
              r.top <= rect.top + 1 &&
              r.bottom >= rect.bottom - 1
            )
              layers.push(b);
          }
          const bg = parse(getComputedStyle(node).backgroundColor);
          if (bg && bg.a > 0) {
            layers.push(bg);
            if (bg.a >= 0.999) break;
          }
          node = node.parentElement;
        }
        let base = [255, 255, 255];
        for (let i = layers.length - 1; i >= 0; i -= 1) {
          const { rgb, a } = layers[i];
          base = [0, 1, 2].map((k) => rgb[k] * a + base[k] * (1 - a));
        }
        return base;
      };
      const out = [];
      for (const el of document.querySelectorAll("body *")) {
        if (el.matches(":disabled") || el.closest('[aria-hidden="true"]')) continue;
        if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1))
          continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === "hidden" || cs.display === "none") continue;
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) continue;
        const fgRaw = parse(cs.color);
        if (!fgRaw) continue;
        const base = paintUnder(el, r);
        const fg = over(fgRaw, base);
        const [hi, lo] = [lum(fg), lum(base)].sort((a, b) => b - a);
        const ratio = (hi + 0.05) / (lo + 0.05);
        const size = parseFloat(cs.fontSize);
        const need = size >= 24 || (Number(cs.fontWeight) >= 700 && size >= 18.66) ? 3 : 4.5;
        if (ratio < need) {
          out.push({
            ratio: Math.round(ratio * 100) / 100,
            need,
            size,
            text: (el.textContent || "").trim().slice(0, 14),
            color: cs.color,
            cls: String(el.className).slice(0, 32),
          });
        }
      }
      return out.slice(0, 4);
    });
  };
  const light = await measure("light");
  const dark = await measure("dark");
  await page.evaluate(() => {
    delete document.documentElement.dataset.theme;
  });
  await settleVisuals(page);
  await unfreezeTransitions(page);
  return [
    ...light.map((x) => ({ theme: "日间", ...x })),
    ...dark.map((x) => ({ theme: "夜间", ...x })),
  ];
}

/**
 * 封卷页的门径账不是一张静态空态:它要同时量到三格事实、逐重境齿、
 * 当前与门限的唯一落点,以及极窄档有没有把齿列或动作裁进 overflow:hidden。
 */
async function probeUnopenedFolio(page) {
  return page.evaluate(() => {
    const folio = document.querySelector("[data-unopened-folio]");
    if (!folio) return null;
    const gate = folio.querySelector("[data-unopened-gate]");
    const ledger = folio.querySelector("[data-unopened-ledger]");
    const progress = folio.querySelector("[data-unopened-progress]");
    const notches = folio.querySelector("[data-unopened-notches]");
    const notchRows = notches ? [...notches.querySelectorAll(".unopened-folio__notch")] : [];
    const gateBox = gate?.getBoundingClientRect();
    const folioBox = folio.getBoundingClientRect();
    const important = [
      folio.querySelector(".unopened-folio__heading-copy"),
      ledger,
      notches,
      ...folio.querySelectorAll(".unopened-folio__actions a"),
    ].filter(Boolean);
    const clipped = important
      .map((el) => {
        const box = el.getBoundingClientRect();
        const outside =
          box.left < folioBox.left - 1 ||
          box.right > folioBox.right + 1 ||
          box.bottom > folioBox.bottom + 1;
        if (!outside) return null;
        return `${el.className || el.tagName}@${Math.round(box.left)}..${Math.round(box.right)}/${Math.round(folioBox.left)}..${Math.round(folioBox.right)}`;
      })
      .filter(Boolean)
      .slice(0, 3);
    const gateMajor = Number(notches?.dataset.unopenedGateMajor);
    return {
      gate: Boolean(gate),
      notches: Boolean(notches),
      progress: Boolean(progress),
      ledgerRows: ledger?.querySelectorAll(":scope > p").length ?? 0,
      notchCount: notchRows.length,
      expectedNotchCount: Number.isFinite(gateMajor) ? gateMajor + 1 : -1,
      currentCount: notchRows.filter((el) => el.classList.contains("is-current")).length,
      gateCount: notchRows.filter((el) => el.classList.contains("is-gate")).length,
      role: notches?.getAttribute("role") || "",
      ariaNow: notches?.getAttribute("aria-valuenow") || "",
      ariaMax: notches?.getAttribute("aria-valuemax") || "",
      notchOverflow: notches ? notches.scrollWidth > notches.clientWidth + 1 : true,
      gateVisible: gateBox
        ? gateBox.bottom > 0 && gateBox.top < document.documentElement.clientHeight
        : false,
      clipped,
      cultivation: folio.querySelector('a[href="#/cultivation"]')?.textContent?.trim() || "",
      codex: folio.querySelector('a[href="#/codex"]')?.textContent?.trim() || "",
      ledgerText: (ledger?.textContent || "").replace(/\s+/g, " ").trim(),
    };
  });
}

function unopenedFolioProblems(sealed, label, { firstScreen = false } = {}) {
  if (!sealed) return [`${label} 封卷页没有渲染出来`];
  const problems = [];
  if (!sealed.gate) problems.push("缺门径账落点");
  if (!sealed.notches) problems.push("缺行迹齿列");
  if (!sealed.progress) problems.push("缺行迹段落");
  if (sealed.ledgerRows !== 3) problems.push(`门限账应有 3 行,实见 ${sealed.ledgerRows}`);
  for (const label of ["当前", "门限", "尚隔"]) {
    if (!sealed.ledgerText.includes(label)) problems.push(`门限账缺「${label}」`);
  }
  if (sealed.expectedNotchCount < 1 || sealed.notchCount !== sealed.expectedNotchCount) {
    problems.push(`重境齿应 ${sealed.expectedNotchCount} 枚,实见 ${sealed.notchCount}`);
  }
  if (sealed.currentCount !== 1) problems.push(`当前齿应唯一,实见 ${sealed.currentCount}`);
  if (sealed.gateCount !== 1) problems.push(`门限齿应唯一,实见 ${sealed.gateCount}`);
  if (sealed.role !== "progressbar" || !sealed.ariaNow || !sealed.ariaMax) {
    problems.push("齿列没有完整进度语义");
  }
  if (sealed.notchOverflow) problems.push("齿列横向溢出");
  if (sealed.clipped.length) problems.push(`封卷内容被裁切:${sealed.clipped.join(", ")}`);
  if (firstScreen && !sealed.gateVisible) problems.push("门径账不在首屏");
  if (!sealed.cultivation.includes("回修炼")) problems.push("缺「回修炼」去路");
  if (!sealed.codex.includes("看境界谱")) problems.push("缺「看境界谱」去路");
  return problems;
}

/**
 * 两百档缩放(200%)—— 390 宽的机型放大到 200% 后,布局视口只剩 195 CSS px。
 *
 * 量法与巡页**共用同一把尺子**(measurePage):横向溢出、外壳被滚偏、越界元素、主值行折行。
 * 与那五档视口的区别是「缩放档」不是「宽度档」:320 档量的是小屏真机,这一档量的是
 * 常用机型上把字放大一倍之后的样子 —— 390÷2 = 195,比 320 还窄 125px。
 *
 * 量完把视口还原(后面的巡页与 --shots 都按原尺寸走)。
 */
async function measureZoomScale(page, vp, shotRoute = null) {
  const width = Math.round(vp.width / 2);
  const height = Math.round(vp.height / 2);
  await page.setViewportSize({ width, height });
  await page.waitForTimeout(420); // 让断点与 transition 走完再量
  const info = await measurePage(page);
  const unopened = await probeUnopenedFolio(page);
  if (SHOTS && shotRoute && unopened) {
    mkdirSync(SHOTS_DIR, { recursive: true });
    // 195×422 只能看到门径账的上半页；截图时只加高取景，不改宽度与任何断点。
    await page.setViewportSize({ width, height: 1400 });
    await page.waitForTimeout(120);
    await page.locator("[data-unopened-folio]").screenshot({
      path: join(SHOTS_DIR, `195-unopened-folio${shotRoute.replace(/\//g, "_")}.png`),
    });
  }
  const innerWidth = await page.evaluate(() => window.innerWidth);
  await page.setViewportSize({ width: vp.width, height: vp.height });
  await page.waitForTimeout(260);
  return { ...info, innerWidth, unopened };
}

/** 缩放档的读数 → 失败清单(只判:溢出、外壳被滚偏、越界元素、主值行折行) */
function zoomProblems(info, tag) {
  const problems = [];
  if (info.innerWidth !== undefined && Math.abs(info.innerWidth * 2 - Number(tag)) > 2) {
    problems.push(`缩放档没量在 200% 上(布局视口 ${info.innerWidth}px)`);
  }
  if (info.horizontalOverflow) problems.push(`横向溢出(scrollWidth ${info.hash})`);
  if (info.shellShift && (info.shellShift.scrollLeft !== 0 || info.shellShift.overflowX > 1)) {
    problems.push(
      `外壳被滚偏(scrollLeft ${info.shellShift.scrollLeft} / 横向可滚 ${info.shellShift.overflowX}px)`,
    );
  }
  if (info.contentShift && info.contentShift.scrollLeft !== 0) {
    problems.push(`主内容区被滚偏(scrollLeft ${info.contentShift.scrollLeft}px)`);
  }
  if (info.contentShift && info.contentShift.overflowX > 1) {
    problems.push(
      `主内容区横向可滚(${info.contentShift.scrollWidth}>${info.contentShift.clientWidth},余 ${info.contentShift.overflowX}px)`,
    );
  }
  if (info.overflows.length) problems.push(`越界元素:${info.overflows.join(", ")}`);
  if (info.valueRows?.length) problems.push(`主值行在 200% 下折行:${info.valueRows.join(" | ")}`);
  /*
   * 这一档此前只判上面四条。竖排与按钮折行两条一直没接 —— 195 CSS px 是最容易把
   * 「一行几块横排」挤成一条的档位,而它恰恰是 AGENTS 明写要防的那一档
   * (按 390px 与 200% 缩放防折行)。缺口的代价实测过:14 个页面在这一档把标题、
   * 属性名、动作键压成一字一行,门一路全绿。
   *
   * 先逐页修完再收口(见 TASK-458):一把放开就是十几处同时红,逼人削判据。
   * 现在全库竖排已清零,只剩 4 处「整宽长文案按钮」的合理折行 —— 那些是**读得出来**的
   * 正常换行(一句 12 字的动作说明),故按钮折行这条只报「短标签」:与 problemsOf 里
   * 那条同一把尺子,但只算 6 字以内的动作词。
   */
  if (info.verticalTexts?.length)
    problems.push(`文字被挤成竖排(200%):${info.verticalTexts.join(" | ")}`);
  /*
   * 只算**短动作标签**。两条排除都是踩过的:
   *   一 整宽长文案按钮(「散尽修为,重入轮回(清空存档)」)折行是读得出来的正常换行;
   *   二 禁用态的**原因句**(「修为未至圆满」正好 6 字,`btn-seal w-full` 在 195 档
   *      折成两行)—— 那是「为什么按不得」的说明,不是动作词,折行不影响理解。
   *      排除按语义(看 disabled)而不抬阈值:抬到 5 字会把真正的四字动作词也放过去。
   */
  const shortWrapped = (info.wrappedButtonLabels ?? []).filter((t) => {
    const text = /«([^»]*)»/.exec(t)?.[1] ?? "";
    return Array.from(text).length <= 6;
  });
  const disabledReasons = new Set(info.disabledButtonLabels ?? []);
  const actionableWrapped = shortWrapped.filter(
    (t) => !disabledReasons.has(/«([^»]*)»/.exec(t)?.[1] ?? ""),
  );
  if (actionableWrapped.length)
    problems.push(`短动作标签被折行(200%):${actionableWrapped.join(" | ")}`);
  return problems;
}

/**
 * 弹窗在 200% 缩放档上的读数 —— 越界 / 竖排 / 短标签折行 / 数值被挤折。
 *
 * 与页面上那一套是同一条口径,但**只量弹窗面板里的东西**:遮罩下的页面在弹窗开着时
 * 本来就被压暗、也不该点,量它只会得到假红。这四条此前只对「页面上摆着的东西」生效 ——
 * 而本作有整整一族**只在某个时刻弹一次**的浮层(归来卷轴、渡劫结果、转世三步、
 * 洞府巡游、突破成功):主巡页与缩放档那一遍都碰不到它们,于是它们的 200% 版面
 * 从来没被量过。归来卷轴就是这么被量出来的(见 docs/design.md 第四十一条)。
 */
function dialogZoomProblems(info) {
  const problems = [];
  if (!info) return ["弹窗不见了 —— 判据没量到东西"];
  if (info.wide.length) problems.push(`顶出面板:${info.wide.join(" | ")}`);
  if (info.vertical.length) problems.push(`文字被挤成竖排:${info.vertical.join(" | ")}`);
  if (info.wrapped.length) problems.push(`短动作标签被折行:${info.wrapped.join(" | ")}`);
  if (info.folded.length) problems.push(`数值被标签挤折:${info.folded.join(" | ")}`);
  return problems;
}

/** 把视口压到 195 量一扇正开着的弹窗,量完还原(量法与 dialogZoomProblems 同源) */
async function measureDialogZoom(page, vp, selector = ".modal-panel") {
  const before = { width: vp.width, height: vp.height };
  await page.setViewportSize({
    width: Math.round(before.width / 2),
    height: Math.round(before.height / 2),
  });
  await page.waitForTimeout(420);
  const info = await page.evaluate((rootSelector) => {
    const target = [...document.querySelectorAll(rootSelector)].at(-1);
    const panel = target?.matches(".modal-panel") ? target : target?.closest(".modal-panel");
    if (!panel) return null;
    const pr = panel.getBoundingClientRect();
    /** 与 measurePage 的越界口径同源:纯装饰层(不吃事件)不算事故 */
    const wide = [...panel.querySelectorAll("*")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        if (r.width <= 0) return false;
        if (!(r.right > pr.right + 2 || r.left < pr.left - 2)) return false;
        for (let n = el; n; n = n.parentElement) {
          if (getComputedStyle(n).pointerEvents === "none") return false;
        }
        return true;
      })
      .slice(0, 3)
      .map((el) => `«${(el.textContent || "").trim().slice(0, 12)}»`);
    const vertical = [...panel.querySelectorAll("span, p, li, div, button")]
      .filter((el) => {
        const text = (el.textContent || "").trim();
        if (text.length < 3) return false;
        if (el.querySelector("span, p, div, li, button")) return false;
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.width >= 40) return false;
        const lh = parseFloat(getComputedStyle(el).lineHeight) || 16;
        return r.height > lh * 2.5;
      })
      .slice(0, 3)
      .map(
        (el) =>
          `${Math.round(el.getBoundingClientRect().width)}px «${(el.textContent || "").trim().slice(0, 10)}»`,
      );
    const wrapped = [];
    for (const el of panel.querySelectorAll("button")) {
      if (el.children.length > 0) continue; // 只看纯文字按钮(与页面上那条同源)
      const text = (el.textContent || "").trim();
      if (text.length < 2 || text.length > 18) continue;
      if (el.hasAttribute("disabled")) continue; // 禁用态是原因句,折行不影响理解
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      const range = document.createRange();
      range.selectNodeContents(el);
      const lines = new Set([...range.getClientRects()].map((x) => Math.round(x.top))).size;
      if (lines >= 2) wrapped.push(`«${text.slice(0, 14)}»`);
    }
    /*
     * 「标签 + 数值」那一类行:数值的自然宽度**放得下**这一行却仍折了,才算被标签挤的
     * (与归来卷轴那条同一把尺子 —— 自然宽度就超出的折行是正常换行)。
     */
    const folded = [];
    for (const li of panel.querySelectorAll("li, [data-value-row]")) {
      const [label, value] = [...li.children];
      if (label?.tagName !== "SPAN" || !value) continue;
      if (!(value.textContent || "").trim()) continue;
      const cs = getComputedStyle(li);
      const avail =
        li.clientWidth - parseFloat(cs.paddingLeft || "0") - parseFloat(cs.paddingRight || "0");
      const prev = value.style.whiteSpace;
      value.style.whiteSpace = "nowrap";
      const need = value.getBoundingClientRect().width;
      value.style.whiteSpace = prev;
      const lh = parseFloat(getComputedStyle(value).lineHeight) || 16;
      const lines = Math.max(1, Math.round(value.getBoundingClientRect().height / lh));
      if (lines > 1 && need <= avail + 1)
        folded.push(`${lines} 行 «${(value.textContent || "").trim().slice(0, 12)}»`);
    }
    return { wide, vertical, wrapped, folded, w: Math.round(pr.width) };
  }, selector);
  await page.setViewportSize(before);
  await page.waitForTimeout(300);
  return info;
}

/**
 * 渐变/图片底上的正文对比度 —— 采样真实像素,不看声明出来的色号。
 *
 * measureTextContrast 把祖先链上**声明出来**的背景色按 alpha 合成,那套算法对纯色卡片
 * 是准的;一旦底是渐变、纹理或图片,它要么按最外层的默认白算,要么把半透明的纸当成不透明
 * 的纸 —— 法球、印章、纸纹那几处,以及「半透明的纸叠在深色天幕上」这一整类,都是它量不到的。
 * 这里改用屏幕像素:
 *
 *   一 只挑那些**真实的底沾了渐变/图片**的字(一路向上找不到不透明色层,或中途撞上
 *      background-image):纯色卡片上的字交给上一条,不重复量;
 *   二 把这一屏里这些字的文本节点临时包进 visibility:hidden 的 span,拍一张 ——
 *      画面里剩下的就是「字底下到底是什么颜色」;
 *   三 逐像素算对比度(半透明的字按它自己那一像素的底合成),报**读不出来的像素占多少**。
 *      用比例而不是最差那一像素:一道装饰描边正好压在这块字的框里,不该把整块字判红;
 *      底是渐变的则大片像素读不出来,照样红。
 */
async function measurePixelContrast(page, sampler, dpr) {
  /*
   * 先等「字」与「图」都落定再量 —— 楷体按需分片后走 font-display: swap,
   * 配图各自异步解码,这两样在不同机器上落定时间不同:冷缓存 CI 采样时字体
   * 可能还在交换(量到的 glyph 是兜底字形)、图还没解码(量的底是占位色),
   * 而本地热缓存已经落定。贴着 4.5 阈值的字就被这个采样时机的差值推到两侧
   * —— 就是 CI 连红 6 次(跨 4 个没动渲染的提交)而本地恒绿的原因。
   * 等到字体与图片都 ready 再量,两边量到的都是同一个「安定态」,判据才有
   * 确定性(动画本身由截图的 animations: "disabled" 冻结,不在此列)。
   */
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      [...document.images]
        .filter((img) => !(img.complete && img.naturalWidth > 0))
        .map((img) => (img.decode ? img.decode().catch(() => {}) : Promise.resolve())),
    );
  });
  const targets = await page.evaluate(() => {
    const mainBox = document.querySelector("main")?.getBoundingClientRect();
    const rail = document.querySelector(".tab-rail");
    const railBox = rail?.getBoundingClientRect();
    const colorCanvas = document.createElement("canvas");
    colorCanvas.width = 1;
    colorCanvas.height = 1;
    const colorCtx = colorCanvas.getContext("2d", { willReadFrequently: true });
    const parse = (c) => {
      if (!colorCtx) return null;
      /*
       * `color-mix()` 的计算值在 Chromium 里可能是 `color(srgb 0.62 0.71 0.62)`,
       * 不是 `rgb(160 183 158)`. 若只按 0–255 的 rgba 正则取数字,会把它读成
       * 0.62 / 0.71 / 0.62 三颗「近黑」通道,查出 1.78:1 的假红。交给 1×1
       * canvas 归一成 sRGB RGBA,既覆盖 `color()`,也覆盖 `oklch()` / `lab()`.
       */
      colorCtx.clearRect(0, 0, 1, 1);
      colorCtx.fillStyle = c;
      colorCtx.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = colorCtx.getImageData(0, 0, 1, 1).data;
      return { rgb: [r, g, b], a: a / 255 };
    };
    /**
     * 这块字的底沾没沾渐变/图片 —— 一路向上,直到撞上不透明的色层。
     *
     * 三种都算:自己或祖先身上有 background-image(渐变、纸纹);
     * 祖先的伪元素上挂了图(`.paper-grain::after` 那层宣纸颗粒就是);
     * 以及压在这块字下面的绝对定位装饰层里有图(与 measureTextContrast 同一套判据)。
     * 只要中途没有一层不透明的**色**把底盖死,声明色那套算法就看不到下面是渐变,
     * 这一条就得靠像素。
     */
    const gradientBase = (el, rect) => {
      for (let node = el; node; node = node.parentElement) {
        const cs = getComputedStyle(node);
        for (const pseudo of ["::before", "::after"]) {
          const ps = getComputedStyle(node, pseudo);
          if (ps.content !== "none" && ps.backgroundImage && ps.backgroundImage !== "none")
            return true;
        }
        if (cs.backgroundImage && cs.backgroundImage !== "none") return true;
        for (const sibling of node.parentElement?.children ?? []) {
          if (sibling === node) continue;
          const scs = getComputedStyle(sibling);
          if (scs.position !== "absolute" && scs.position !== "fixed") continue;
          if (scs.display === "none" || !scs.backgroundImage || scs.backgroundImage === "none")
            continue;
          const box = sibling.getBoundingClientRect();
          if (
            box.left <= rect.left + 1 &&
            box.right >= rect.right - 1 &&
            box.top <= rect.top + 1 &&
            box.bottom >= rect.bottom - 1
          )
            return true;
        }
        const bg = parse(cs.backgroundColor);
        if (bg && bg.a >= 0.999) return false;
      }
      return true; // 一路到根都没有不透明的底 —— 真实的底是天幕那张渐变
    };
    const out = [];
    for (const el of document.querySelectorAll("body *")) {
      if (el.matches(":disabled") || el.closest('[aria-hidden="true"]')) continue;
      const texts = [...el.childNodes].filter(
        (n) => n.nodeType === 3 && n.textContent.trim().length > 1,
      );
      if (!texts.length) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none" || parseFloat(cs.opacity) < 0.1)
        continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      if (!gradientBase(el, r)) continue;
      const inMain = Boolean(el.closest("main"));
      const range = document.createRange();
      const rects = [];
      for (const node of texts) {
        range.selectNodeContents(node);
        for (const box of range.getClientRects()) {
          const clip =
            inMain && mainBox
              ? mainBox
              : { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
          const left = Math.max(box.left, clip.left);
          const right = Math.min(box.right, clip.right);
          let top = Math.max(box.top, clip.top);
          const bottom = Math.min(box.bottom, clip.bottom);
          /*
           * 吸顶页签栏是内容滚动时故意压在上面的固定层。页签自己的字仍要量;
           * 正文滚到栏下则只留下栏底以下那截,整块都被盖住时直接跳过。
           */
          if (
            rail &&
            !rail.contains(el) &&
            railBox &&
            left < railBox.right &&
            right > railBox.left &&
            top < railBox.bottom &&
            bottom > railBox.top
          ) {
            top = Math.max(top, railBox.bottom);
          }
          /*
           * 滚动井边缘会把一行只切出两三像素。那不是一段能读的正文，下一帧继续滚动
           * 就会离开边缘；拿这点残片去算底色只会随机撞上边框或装饰线。故只量至少露出
           * 半行高的文字块；真正贴着吸顶栏、但仍完整可见的字仍照常量。
           */
          const visibleHeightRatio = (bottom - top) / Math.max(1, box.height);
          if (
            right - left > 1 &&
            bottom - top > 1 &&
            visibleHeightRatio >= 0.5 &&
            top >= 0 &&
            bottom <= innerHeight &&
            left >= 0 &&
            right <= innerWidth
          ) {
            rects.push([left, top, right - left, bottom - top]);
          }
        }
      }
      if (!rects.length) continue;
      const size = parseFloat(cs.fontSize);
      const rgba = parse(cs.color);
      if (!rgba) continue;
      out.push({
        rects,
        rgba: [...rgba.rgb, rgba.a],
        size,
        need: size >= 24 || (Number(cs.fontWeight) >= 700 && size >= 18.66) ? 3 : 4.5,
        text: (el.textContent || "").trim().slice(0, 14),
        cls: String(el.className).slice(0, 28),
      });
    }
    return out;
  });
  if (!targets.length) return [];
  /*
   * 把字藏起来再拍:剩下的像素就是字底下的底色。
   *
   * 这里不能替换文本节点,也不能只靠元素上的 data 标记 —— 坊市倒计时、历练地界
   * 每秒都会触发 Vue 更新;节点一旦被换掉,标记就没了,截图里字会重新出现。
   * 改用全局 -webkit-text-fill-color 只抹掉字形:color 不变,SVG 图标与 currentColor
   * 装饰仍照原样参与采样,重建的文本节点也无处逃。
   */
  const hidden = await page.evaluate(() => {
    let n = 0;
    for (const el of document.querySelectorAll("body *")) {
      const texts = [...el.childNodes].filter(
        (x) => x.nodeType === 3 && x.textContent.trim().length > 1,
      );
      if (!texts.length) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none") continue;
      n += 1;
    }
    if (n > 0) {
      const style = document.createElement("style");
      style.dataset.pixelProbeStyle = "1";
      style.textContent =
        "body *, body *::before, body *::after { -webkit-text-fill-color: transparent !important; text-shadow: none !important; }";
      document.head.appendChild(style);
    }
    return n;
  });
  /*
   * `animations: 'disabled'`:两团云雾是无限循环的 CSS 动画,位置随时相在变 ——
   * 不冻住的话,同一处字这次量到 4.31、下次量到 4.8,判据就成了掷骰子(实测正是
   * 这样在 /inventory 上红过一次)。冻住之后每一次量到的都是同一帧。
   */
  const shot = await page.screenshot({ animations: "disabled", caret: "hide" });
  await page.evaluate(() => {
    document.querySelector("style[data-pixel-probe-style]")?.remove();
  });
  if (!hidden) return [];
  const stats = await sampler.evaluate(
    async ({ png, list, scale }) => {
      const img = new Image();
      await new Promise((res, rej) => {
        img.onload = res;
        img.onerror = rej;
        img.src = "data:image/png;base64," + png;
      });
      const canvas = document.getElementById("c");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const f = (v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      };
      const lum = (p) => 0.2126 * f(p[0]) + 0.7152 * f(p[1]) + 0.0722 * f(p[2]);
      const out = [];
      for (const t of list) {
        const rgba = t.rgba;
        if (!Array.isArray(rgba) || rgba.length < 4) {
          out.push(null);
          continue;
        }
        const [fgR, fgG, fgB, alpha] = rgba;
        const ratios = [];
        for (const [x, y, w, h] of t.rects) {
          const px = Math.max(0, Math.floor(x * scale));
          const py = Math.max(0, Math.floor(y * scale));
          const pw = Math.min(canvas.width - px, Math.max(1, Math.ceil(w * scale)));
          const ph = Math.min(canvas.height - py, Math.max(1, Math.ceil(h * scale)));
          if (pw <= 0 || ph <= 0) continue;
          const data = ctx.getImageData(px, py, pw, ph).data;
          for (let k = 0; k < data.length; k += 4) {
            const bg = [data[k], data[k + 1], data[k + 2]];
            const fg = [fgR, fgG, fgB].map((v, i) => v * alpha + bg[i] * (1 - alpha));
            const [hi, lo] = [lum(fg), lum(bg)].sort((a, b) => b - a);
            ratios.push((hi + 0.05) / (lo + 0.05));
          }
        }
        if (!ratios.length) {
          out.push(null);
          continue;
        }
        ratios.sort((a, b) => a - b);
        const bad = ratios.filter((r) => r < t.need).length;
        out.push({
          badPct: Math.round((bad / ratios.length) * 100),
          p05: Math.round(ratios[Math.floor(ratios.length * 0.05)] * 100) / 100,
          pixels: ratios.length,
        });
      }
      return out;
    },
    { png: shot.toString("base64"), list: targets, scale: dpr },
  );
  const bad = [];
  targets.forEach((t, i) => {
    const s = stats[i];
    if (!s) return;
    pixelTextsSeen += 1;
    if (s.badPct >= 20) bad.push({ ...t, ...s });
  });
  return bad;
}

/**
 * 像素采样用的那张「画布页」—— 与受测页同一个 context:把截图喂给它解码取值。
 *
 * 每个 context 各一张(WeakMap 记账)。从前是一个全局单例,自检串行时够用;
 * 改成并发后,两个视口同时在它身上 evaluate,一个还在 img.onload 里等着,
 * 另一个已经把 canvas 尺寸改掉了 —— 采样会掷骰子。跟着 context 走最省心:
 * context 关掉,这张页与它的画布一起回收。
 */
const samplers = new WeakMap();
async function pixelSampler(ctx) {
  let smp = samplers.get(ctx);
  if (!smp) {
    smp = await ctx.newPage();
    await smp.setContent('<canvas id="c"></canvas>');
    samplers.set(ctx, smp);
  }
  return smp;
}

/**
 * 一页的像素法对比度:两套主题 × 三档滚动位置(顶 / 中 / 底)。
 *
 * 为什么要滚:一屏只装得下眼前这些字,而渐变底的那几处(法球在首页、印章在结果弹窗上、
 * 纸纹铺满卡片)分布在不同高度;只量首屏等于没量。三档够覆盖一屏多一点的内容,
 * 再多就只是把同一批字量第二遍。
 */
async function pixelContrastOf(page, sampler) {
  await freezeTransitions(page);
  const out = [];
  const dpr = 3;
  for (const theme of ["light", "dark"]) {
    await page.evaluate((t) => {
      document.documentElement.dataset.theme = t;
    }, theme);
    await settleVisuals(page);
    for (const fraction of [0, 0.5, 1]) {
      await page.evaluate((f) => {
        const main = document.querySelector("main");
        if (main) main.scrollTop = Math.max(0, (main.scrollHeight - main.clientHeight) * f);
      }, fraction);
      await settleVisuals(page);
      /*
       * 弹窗盖上来的时候不量:BaseModal 的遮罩是「墨 45% + 2px 模糊」铺满整屏,
       * 那一刻屏幕上的像素全都不是底色的像素 —— 量出来的会把整页报成假红(实测吃过一次)。
       * 引擎每秒掷一次事件,弹窗随时可能出现,故每一步都现查一次。
       */
      for (let i = 0; i < 2 && (await page.locator(".modal-panel").count()) > 0; i += 1) {
        await page.keyboard.press("Escape");
        await page.waitForTimeout(200);
      }
      if ((await page.locator(".modal-panel").count()) > 0) continue;
      for (const bad of await measurePixelContrast(page, sampler, dpr))
        out.push({ theme: theme === "dark" ? "夜间" : "日间", ...bad });
    }
    await page.evaluate(() => {
      const main = document.querySelector("main");
      if (main) main.scrollTop = 0;
    });
  }
  await page.evaluate(() => {
    delete document.documentElement.dataset.theme;
  });
  await settleVisuals(page);
  await unfreezeTransitions(page);
  return out;
}

/**
 * 页签栏(InkTabs 的外壳 .tab-rail)要吸顶 —— 内容滚下去,它钉在内容区顶上。
 *
 * 这几册(背包四册、图鉴、界域志、天界、坊市)都是越往下越长的列表,页签跟着滚走
 * 就得先滚回顶才能换一册。判据两条:滚过之后它还贴在内容区顶;盒子铺满**当前页叶**宽度
 * (两侧留缝的话,内容会从缝里明晃晃地穿过去)。桌面单叶居中后,不能拿整块书桌去比 ——
 * 那会把设计好的页边误报成缝。
 *
 * 造余量那一段是有讲究的:空档的背包只有几件东西,页面根本滚不动,吸顶无从量起。
 * 于是往**视图根节点里**垫一块 1200px 的占位 —— 必须垫在容器里面:吸顶盒的活动
 * 范围是它的容器,容器到底了它就该跟着走;垫在容器外面等于没垫(第一版探针就是
 * 这么把背包页报成假红的)。
 */
async function measureTabRail(page) {
  await settleVisuals(page);
  return page.evaluate(() => {
    const main = document.querySelector("main");
    const rail = document.querySelector(".tab-rail");
    const root = main?.querySelector(".stagger-in") ?? main?.firstElementChild;
    if (!main || !rail || !root) return null;
    const spacer = document.createElement("div");
    spacer.style.height = "1200px";
    root.appendChild(spacer);
    const mainTop = main.getBoundingClientRect().top;
    const rootBox = root.getBoundingClientRect();
    /*
     * 600px 只是造余量的下限，不是「页签一定已经到顶」的保证。
     * 后期档天界在页签前还有卷首与今日总账，页签天然起点会越过 600；
     * 若仍按 600 量，会把「尚未滚到吸顶阈值」误判成「吸顶坏了」。
     * 先读页签的天然起点，再越过它一段，才量的是 sticky 真正生效后的位置。
     */
    const railStart = Math.max(0, Math.round(rail.getBoundingClientRect().top - mainTop));
    const scrollTarget = Math.max(600, railStart + 120);
    main.scrollTop = scrollTarget;
    const box = rail.getBoundingClientRect();
    const out = {
      scrolled: Math.round(main.scrollTop),
      drift: Math.round(box.top - main.getBoundingClientRect().top),
      bleed: Math.round(box.left - rootBox.left) + Math.round(rootBox.right - box.right),
    };
    main.scrollTop = 0;
    spacer.remove();
    return out;
  });
}

/** 页签吸顶读数 → 失败清单(null = 这一页没有页签栏,不判) */
function railProblems(rail) {
  const out = [];
  if (!rail) return out;
  if (rail.scrolled < 500)
    out.push(`页签吸顶没量到:内容只滚了 ${rail.scrolled}px(占位没垫进容器?)`);
  if (rail.drift !== 0)
    out.push(`页签栏没吸顶:滚 ${rail.scrolled}px 后偏离内容区顶 ${rail.drift}px`);
  if (rail.bleed > 0)
    out.push(`页签栏没铺满内容区宽度,两侧共留 ${rail.bleed}px 缝(内容会从缝里穿过去)`);
  return out;
}

/** 一页量出来的读数 → 失败清单(两遍巡页共用同一套判据) */
/**
 * 打开一个路由,并等到「这一页真的画出来了」。
 *
 * 路由组件是懒加载分包:固定等 600~700ms 在机器忙时可能读到一张**空 main** ——
 * 那一刻 measurePage / measureZoomScale 的每条判据都在量空页,于是全绿,而玩家
 * 看到的其实还没渲染出来。假绿比假红更坏:它让「巡过这一页」变成一句没有证据的话。
 * 故这里等 main 里真有字再交回去,并把「读到几个字」返回给调用方记失败。
 *
 * 固定等待**保留在**就绪探测之后:有些判据量的是「过了这么久之后的稳定态」
 * (动画收敛、引擎跑过几拍),换成就绪即测会改掉它们量的东西。
 */
async function openRoute(page, route, settleMs) {
  await page.goto(INDEX + "#" + route, { waitUntil: "load" });
  await page
    .waitForFunction(() => (document.querySelector("main")?.innerText ?? "").trim().length > 0, {
      timeout: 15000,
    })
    .catch(() => undefined);
  if (settleMs > 0) await page.waitForTimeout(settleMs);
  /*
   * 并发跑时，固定等待偶尔仍会撞上翻卷入场的 16px 位移：320 后期档的
   * /inventory 曾因此被量成 337px 宽。等到主视图真正回到 opacity 1 / 无位移，
   * 再交给 measurePage；稳态页面这一等通常只花一帧。
   */
  await page
    .waitForFunction(
      () => {
        const view = document.querySelector("main > :first-child");
        if (!view) return true;
        const style = getComputedStyle(view);
        return (
          style.opacity === "1" &&
          (style.transform === "none" || style.transform === "matrix(1, 0, 0, 1, 0, 0)")
        );
      },
      /*
       * 并发 + --shots 时一帧可能被主线程拖到几百毫秒;1.5s 曾把 959×1024 的
       * /cultivation 量在翻卷入场中段:页面右移 20px、禁用态透明度还是 0。
       * 翻卷本身只有 240ms,这里留到 5s 是防量尺误红,不是放宽版面判据。
       */
      { timeout: 5000 },
    )
    .catch(() => undefined);
  /*
   * 量之前等两帧:路由切换的入场过渡是**内联样式**(Vue 的 Transition 直接改
   * style.opacity),而这里注入了 transition:none —— transitionend 因此永远不会来,
   * 视图会停在 opacity:0。禁用态对比度那条判据会把祖先链的 opacity 乘进去,
   * 于是整页的字都被算成「1:1,整块 opacity 0.00」而误红。
   * (真出现这类误红的是一次新增按钮:320-late 的 /world 是巡游里第一个带禁用控件的页。)
   */
  await page.evaluate(
    () =>
      new Promise((r) => {
        requestAnimationFrame(() => requestAnimationFrame(() => r(null)));
      }),
  );
  return page.evaluate(() => (document.querySelector("main")?.innerText ?? "").trim().length);
}

function problemsOf(info) {
  const problems = [];
  if (info.horizontalOverflow) problems.push(`横向溢出(scrollWidth ${info.hash})`);
  if (info.shellShift && (info.shellShift.scrollLeft !== 0 || info.shellShift.overflowX > 1)) {
    problems.push(
      `外壳被滚偏(scrollLeft ${info.shellShift.scrollLeft} / 横向可滚 ${info.shellShift.overflowX}px)`,
    );
  }
  if (info.contentShift && info.contentShift.scrollLeft !== 0) {
    problems.push(`主内容区被滚偏(scrollLeft ${info.contentShift.scrollLeft}px)`);
  }
  if (info.contentShift && info.contentShift.overflowX > 1) {
    problems.push(
      `主内容区横向可滚(${info.contentShift.scrollWidth}>${info.contentShift.clientWidth},余 ${info.contentShift.overflowX}px)`,
    );
  }
  if (info.overflows.length) problems.push(`越界元素:${info.overflows.join(", ")}`);
  if (info.unnamed.length) problems.push(`无名控件:${info.unnamed.join(" | ")}`);
  if (info.smallTargets.length)
    problems.push(`可点元素过小(触控下限 28×28):${info.smallTargets.join(" | ")}`);
  if (info.dimDisabled.length)
    problems.push(`禁用态的字读不出来(合成后对比度 <3:1):${info.dimDisabled.join(" | ")}`);
  if (info.deadControls.length)
    problems.push(`念出来是按钮却按不动:${info.deadControls.join(" | ")}`);
  if (info.nestedControls?.items.length)
    problems.push(`控件里套着控件(读屏只念一个按钮):${info.nestedControls.items.join(" | ")}`);
  if (info.badGroups.length) problems.push(`选择组没选中态:${info.badGroups.join(" | ")}`);
  if (info.headerTall?.length)
    problems.push(`顶栏折行(数字断行看着像乱码):${info.headerTall.join(" | ")}`);
  if (info.valueRows?.length) problems.push(`主值行被次要读数挤折行:${info.valueRows.join(" | ")}`);
  if (info.regionCards?.tall.length)
    problems.push(`地界名被挤成竖排:${info.regionCards.tall.join(" | ")}`);
  if (info.regionCards?.overlap.length)
    problems.push(`地界卡文字互相压住:${info.regionCards.overlap.join(" | ")}`);
  if (info.verticalTexts?.length) problems.push(`文字被挤成竖排:${info.verticalTexts.join(" | ")}`);
  if (info.unitBreaks?.length) problems.push(`数字与量词被换行拆开:${info.unitBreaks.join(" | ")}`);
  if (info.orphanPunctuation?.length)
    problems.push(`标点被折成孤字:${info.orphanPunctuation.join(" | ")}`);
  if (info.wrappedButtonLabels?.length)
    problems.push(`按钮标签被折行:${info.wrappedButtonLabels.join(" | ")}`);
  if (info.navItems !== 5) problems.push(`底部导航 ${info.navItems} 项(应为 5)`);
  /*
   * 底部导航的「当前位置」:读屏用户拿到的必须是状态,不是两处视觉提示(变色 + 朱砂短笔)。
   * 五个页签上恰有一枚 aria-current=page 且指向当前路由;不在页签上(market / settings /
   * codex 等)时一枚都不许有 —— 否则读屏会被告知一个并不存在的当前页签。
   */
  if (info.navItems === 5) {
    const TAB_PATHS = ["/", "/cultivation", "/adventure", "/inventory", "/character"];
    const here =
      String(info.hash || "")
        .replace(/^#/, "")
        .split("?")[0] || "/";
    const marked = info.navCurrent || [];
    if (TAB_PATHS.includes(here)) {
      if (marked.length !== 1) {
        problems.push(`底部导航标了 ${marked.length} 个当前项(页签页上应恰为 1):${here}`);
      } else if (marked[0] !== here) {
        problems.push(`底部导航标的当前项是 ${marked[0]},而路由在 ${here}`);
      }
    } else if (marked.length > 0) {
      problems.push(`不在五个页签上,底部导航却标了当前项:${marked.join(", ")}(路由 ${here})`);
    }
  }
  if (info.railDrift && (info.railDrift.windowOverflow > 1 || info.railDrift.drift > 1)) {
    problems.push(
      `文档层可滚 ${info.railDrift.windowOverflow}px、滚窗后两栏位移 ${info.railDrift.drift}px(顶栏底栏没钉住)`,
    );
  }
  return problems;
}

/* ==========================================================================
 * 自检任务 —— 每个任务各攒各的账,由下面的调度池并发跑。
 * 从前它们是同一层里的 25 个顺序代码块,一轮要排七分钟;拆成任务后互不等待,
 * 谁都不再为别人的等待买单(每块用的都是自己的 context 与自己的存档,天然独立)。
 * 合并时按数组固定顺序拼接,输出的失败清单与串行时代完全一致。
 * ========================================================================== */

/** 巡页:一档视口一个任务,六个视口并行(每一档都用独立 context 与自己的存档)。 */
async function measureTabletDock(page) {
  return page.evaluate(() => {
    const shell = document.querySelector(".app-shell");
    const rail = document.querySelector(".bottom-dock-rail");
    if (!rail || !shell) return null;
    const shellWidth = Math.round(shell.getBoundingClientRect().width);
    const expected = Math.min(640, shellWidth - 18);
    const rect = rail.getBoundingClientRect();
    return {
      width: Math.round(rect.width),
      left: Math.round(rect.left),
      right: Math.round(innerWidth - rect.right),
      expected,
    };
  });
}

function tabletDockProblems(dock) {
  if (!dock) return ["平板底栏书脚索引没量到"];
  const problems = [];
  if (Math.abs(dock.width - dock.expected) > 2) {
    problems.push(
      `平板底栏书脚索引没有按 40rem 上限与可用宽度收束(${dock.width}px / 应 ${dock.expected}px)`,
    );
  }
  if (Math.abs(dock.left - dock.right) > 2) {
    problems.push(`平板底栏书脚索引没有居中(${dock.left} / ${dock.right})`);
  }
  return problems;
}

async function taskPageTour(vp) {
  const failures = [];
  let checked = 0;
  const contrastFails = [];
  const pixelContrastFails = [];
  const zoomFails = [];
  const auditCtx = await auditContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.dpr,
  });
  const page = await auditCtx.newPage();
  const pageErrors = [];
  watchPageErrors(page, pageErrors);

  await page.goto(INDEX, { waitUntil: "load" });
  // 建号:同意隐私 → 传送门(约 2.5s)→ 命名 → 踏入仙途
  await page
    .getByRole("button", { name: /启封入山/ })
    .first()
    .click();
  /*
   * 等弹窗动画落定再量 —— 这一处缺了一整个弹窗生命周期:
   * 点完立刻量,量到的是入场动画的中间态(实测这个按钮恒为 26.3px,
   * 而它自己声明了 min-height:28px)。于是它读起来像"按钮没给够高度",
   * 实际是"判据量在了半路上",而且极其稳定(每一档视口都是同一个数),
   * 让人误以为是布局问题、反复去改那个按钮。
   * 反向验证:去掉这一行立刻复现,加回去即绿。
   */
  await page.waitForTimeout(600);
  // 隐私弹窗也是弹窗:它的控件同样要过那两条尺子(页面上巡不到它)
  {
    const audit = await auditModalControls(page);
    checked += 1;
    if (!audit || audit.count === 0)
      failures.push(`[${vp.tag}] 隐私弹窗里一个控件都没数到,判据没跑到东西`);
    if (audit && !audit.label)
      failures.push(`[${vp.tag}] 隐私弹窗没有可访问名(读屏只会念「对话框」)`);
    if (audit?.unnamed.length)
      failures.push(`[${vp.tag}] 隐私弹窗里有 ${audit.unnamed.length} 个无名控件`);
    if (audit?.small.length)
      failures.push(`[${vp.tag}] 隐私弹窗里可点元素过小:${audit.small.join(" | ")}`);
  }
  await page.locator("input[type=checkbox]").first().check();
  await page
    .getByRole("button", { name: /署印入山/ })
    .first()
    .click();
  await page.waitForTimeout(3200);
  await page.locator("input:not([type=file]):not([type=checkbox])").first().fill("排版自检");
  await page
    .getByRole("button", { name: /踏\s*入\s*仙\s*途/ })
    .first()
    .click();
  await page.waitForTimeout(1200);

  /**
   * 新手第一步卡(见 core/firstStep)——「三块引导并列,却没人说先点哪儿」那个洞的补丁。
   *
   * 只在这一处核:卡由存档推出来(历练过一次 / 第一条主线达成即收卡),那些分支由
   * firstStep.spec 逐条钉死;这里只问真浏览器一句 —— 刚建好号的首页上,它在不在、
   * 指的方向对不对。**故意不点它**:点下去会跳进历练页,把那一页的随机际遇带进
   * 这一轮巡页的取景(从前假红的老路数)。
   *
   * 先整页重载一次:建号结束停在哪个 hash 取决于灵根鉴定动画放完没有,判据不该赌它;
   * 重载后 beforeEach 见存档已开,直接落在首页 —— 这才是"新玩家进游戏第一眼"。
   */
  await page.goto(INDEX, { waitUntil: "load" });
  await page.waitForTimeout(700);
  {
    /*
     * 阅读字阶不是「源码里写了变量」就算数:Tailwind 不生成类、变量只定义在错误的
     * 作用域、或桌面断点没命中,计算字号都会静默退回浏览器默认值。这里在真页面上
     * 读四枚代表元素 —— 位置签(note)、说明(body)、章节题(section)、卷首题(display),
     * 手机与桌面各核一遍。
     */
    const type = await page.evaluate(() => {
      const px = (selector) => {
        const el = document.querySelector(selector);
        return el ? Number.parseFloat(getComputedStyle(el).fontSize) : null;
      };
      const shell = document.querySelector(".app-shell");
      const style = shell ? getComputedStyle(shell) : getComputedStyle(document.documentElement);
      const vars = Object.fromEntries(
        ["note", "body", "title", "section", "heading", "display"].map((tier) => [
          tier,
          Number.parseFloat(style.getPropertyValue(`--type-${tier}`)),
        ]),
      );
      const here = location.hash.replace(/^#/, "").split("?")[0] || "/";
      return {
        vars,
        note: px("[data-folio-position]") ?? px(".home-deck__eyebrow"),
        body: px(".t-body") ?? px(".home-card__copy"),
        section: px(".home-card__head h2"),
        display: px(".folio-masthead h1"),
        homeDisplay: here === "/" ? px(".home-deck__identity h1") : null,
      };
    });
    checked += 1;
    const desktop = vp.width >= 960;
    const expected =
      vp.width >= 1100
        ? { note: 12, body: 14, title: 16, section: 18, heading: 24, display: 34 }
        : desktop
          ? { note: 11, body: 12, title: 15, section: 16, heading: 20, display: 28 }
          : { note: 10, body: 11, title: 14, section: 15, heading: 18, display: 24 };
    for (const [tier, want] of Object.entries(expected)) {
      if (type.vars[tier] !== want) {
        failures.push(`[${vp.tag}] 阅读字阶 --type-${tier} 是 ${type.vars[tier]},应为 ${want}px`);
      }
    }
    for (const [name, got, want] of [
      ["位置签", type.note, expected.note],
      ["正文说明", type.body, expected.body],
      ["章节题", type.section, expected.section],
      ["卷首题", type.display, expected.display],
    ]) {
      if (name === "卷首题" && type.homeDisplay !== null) continue;
      if (got !== want) {
        failures.push(`[${vp.tag}] ${name}计算字号是 ${got},应为 ${want}px`);
      }
    }
    if (type.homeDisplay !== null) {
      if (type.homeDisplay < expected.display || type.homeDisplay > expected.display * 1.55) {
        failures.push(
          `[${vp.tag}] 首页主标题计算字号是 ${type.homeDisplay}px,` +
            `应落在 ${expected.display}~${(expected.display * 1.55).toFixed(1)}px`,
        );
      }
    }
  }
  {
    const step = await page.evaluate(() => {
      const a = [...document.querySelectorAll("a")].find((el) =>
        (el.textContent || "").includes("第一步"),
      );
      if (!a) return null;
      const r = a.getBoundingClientRect();
      const declared = parseFloat(getComputedStyle(a).minHeight);
      return {
        href: a.getAttribute("href") || "",
        height: Math.round(r.height * 10) / 10,
        // 与巡页那条同一把尺子(见第四十三条)
        ok: r.height >= 28 || (declared >= 28 && r.height >= 27.5),
      };
    });
    checked += 1;
    if (!step) {
      failures.push(`[${vp.tag}] 开局首页没有「第一步」卡 —— 新玩家只能自己猜先点哪儿`);
    } else {
      if (step.href !== "#/adventure")
        failures.push(`[${vp.tag}] 「第一步」卡指向 ${step.href},开局该先指历练(#/adventure)`);
      if (!step.ok)
        failures.push(`[${vp.tag}] 「第一步」卡只有 ${step.height}px 高,低于 28px 触达下限`);
    }
  }

  /*
   * 巡页前先把随机源钉死(Math.random = 1)并收掉已经浮上来的浮层。
   *
   * 引擎每秒掷一次事件,中了就弹窗 + 铺一层墨色遮罩 —— 遮罩会用 --color-ink 混一层在
   * 整页之上,压在字底下。对比度探针量到的底就成了遮罩色,前后景一起向对方靠,量出
   * 1.6~2.5:1 的假红。它什么时候弹是随机的:串行时偶发,并发截图负载下几分钟一轮
   * 必中(实测)。后期档那一遍早就这么钉了(见它开头的 clearOverlays),主巡页这一遍
   * 从前没钉,是这一族假红的根。
   */
  await clearOverlays(page);
  for (const route of ROUTES) {
    const rendered = await openRoute(page, route, 700);
    const info = await measurePage(page);
    checked += 1;
    if (rendered === 0) {
      failures.push(`[${vp.tag}] ${route} 页面没渲染出来(分包没就绪)—— 这一页其实没量到`);
    }
    valueRowsSeen += info.valueRowCount ?? 0;
    controlHostsSeen += info.nestedControls?.hosts ?? 0;
    const problems = problemsOf(info);
    if (problems.length) failures.push(`[${vp.tag}] ${route} → ${problems.join(" / ")}`);
    /*
     * 首屏重复:同一个读数在同一眼里说了两遍。允许清单只放**确实该重复**的条目 ——
     * 每一条都要写清楚为什么留,否则这张表迟早变成「红了就加一行」。
     */
    const allowedRepeats = new Set([
      // 首页日课与主线各有自己的赏格行,同一句「得 悟道点×N」出现在两条不同的任务上
      "得 悟道点",
    ]);
    /*
     * 覆盖面(实测,不是推测):这一遍巡页逐页都走到了 —— 它先建号、再整页重载,
     * 此后直接落在各页,没有任何一页报「没渲染出来」。
     *
     * 但它跑的是**刚建号**的存档,不是 showcase 那份满档。同一页在新号与满档下
     * 的首屏内容并不相同:用 showcase 存档测过,注入的重复句与「第 10 / 21 境」
     * 都在首屏被这条判据抓到;而巡页这一遍因存档较浅,那些行还没进入首屏。
     * 故它拦得住「有人在常驻首屏塞第二遍」,拦不住「只在深档下才出现的重复」。
     */
    for (const line of info.repeatedShortLines ?? []) {
      if ([...allowedRepeats].some((a) => line.startsWith(a))) continue;
      failures.push(
        `[${vp.tag}] ${route} 首屏把同一句说了两遍:«${line}» —— 该合并,或加进允许清单并写明理由`,
      );
    }
    if (vp.tag === "844x390") {
      const landscape = await page.evaluate(() => {
        const here = location.hash.replace(/^#/, "").split("?")[0] || "/";
        const head =
          here === "/"
            ? document.querySelector("[data-home-hero]")
            : document.querySelector("[data-folio-masthead]");
        if (!head) return null;
        const visual = head.querySelector(".folio-masthead__visual");
        const next =
          here === "/" ? head.querySelector("[data-home-focus]") : head.nextElementSibling;
        const dock = document.querySelector(".bottom-dock-rail");
        const headBox = head.getBoundingClientRect();
        const nextBox = next?.getBoundingClientRect();
        const dockBox = dock?.getBoundingClientRect();
        return {
          height: Math.round(headBox.height),
          visual: visual ? getComputedStyle(visual).display : null,
          hasDefault: !!head.querySelector("[data-folio-default]"),
          commandDeck: here === "/",
          nextTop: nextBox ? Math.round(nextBox.top) : null,
          dockTop: dockBox ? Math.round(dockBox.top) : null,
        };
      });
      landscapeMastheadSeen += 1;
      checked += 1;
      if (!landscape) {
        failures.push(`[${vp.tag}] ${route} 横屏卷首没量到,判据空转`);
      } else {
        if (!landscape.commandDeck && !landscape.hasDefault && landscape.height > 310) {
          failures.push(`[${vp.tag}] ${route} 矮横屏卷首高 ${landscape.height}px,超过 310px 上限`);
        }
        if (!landscape.commandDeck && landscape.visual && landscape.visual !== "none") {
          failures.push(`[${vp.tag}] ${route} 矮横屏还在卷首重复铺主视觉`);
        }
        if (
          (!landscape.commandDeck ? !landscape.hasDefault : true) &&
          landscape.nextTop !== null &&
          landscape.dockTop !== null &&
          landscape.nextTop > landscape.dockTop - 40
        ) {
          failures.push(
            `[${vp.tag}] ${route} 横屏首屏挡住下一步:` +
              `下一段在 ${landscape.nextTop}px,底栏在 ${landscape.dockTop}px`,
          );
        }
      }
    }
    if (TABLET_LEAF_TAGS.has(vp.tag)) {
      const dock = await measureTabletDock(page);
      tabletDockSeen += 1;
      checked += 1;
      for (const problem of tabletDockProblems(dock)) {
        failures.push(`[${vp.tag}] ${route} ${problem}`);
      }
    }
    if (TABLET_LEAF_TAGS.has(vp.tag)) {
      const leaf = await page.evaluate(() => {
        const shell = document.querySelector(".app-shell");
        const dock = document.querySelector("[data-folio-dock]");
        const spine = document.querySelector("[data-desktop-spine]");
        if (!shell) return null;
        const rect = shell.getBoundingClientRect();
        return {
          width: Math.round(rect.width),
          left: Math.round(rect.left),
          right: Math.round(innerWidth - rect.right),
          dock: dock ? getComputedStyle(dock).display : null,
          spine: spine ? getComputedStyle(spine).display : null,
        };
      });
      tabletLeafSeen += 1;
      checked += 1;
      const expectedWidth = Math.min(vp.width - 32, 960);
      if (!leaf) {
        failures.push(`[${vp.tag}] ${route} 平板宽叶外壳没量到`);
      } else {
        if (leaf.width < expectedWidth - 2) {
          failures.push(
            `[${vp.tag}] ${route} 平板宽叶仍收成手机窄栏(${leaf.width}px / 应约 ${expectedWidth}px)`,
          );
        }
        if (Math.abs(leaf.left - leaf.right) > 2) {
          failures.push(`[${vp.tag}] ${route} 平板宽叶没有居中(${leaf.left} / ${leaf.right})`);
        }
        if (!leaf.dock || leaf.dock === "none") {
          failures.push(`[${vp.tag}] ${route} 平板宽叶把底栏换掉了(${leaf.dock ?? "未找到"})`);
        }
        if (leaf.spine && leaf.spine !== "none") {
          failures.push(`[${vp.tag}] ${route} 平板宽叶提前挂出了桌面书脊`);
        }
      }
    }
    const bottomPagers = await page.locator("[data-folio-turner]").count();
    checked += 1;
    if (bottomPagers > 0) {
      failures.push(`[${vp.tag}] ${route} 页面底部仍有册末翻页签(${bottomPagers} 处)`);
    }
    if (route === "/adventure") {
      const adventureDesk = await page.evaluate(() => {
        const register = document.querySelector("[data-adventure-register]");
        const folio = document.querySelector("[data-adventure-folio]");
        const consoleDesk = document.querySelector("[data-adventure-console]");
        if (!register) return null;
        const registerStyle = getComputedStyle(register);
        const chapters = [...document.querySelectorAll("[data-adventure-chapter]")];
        const chapterRows = chapters.map((chapter) => {
          const style = getComputedStyle(chapter);
          const head = chapter.querySelector(".adventure-register__head");
          const identity = head?.querySelector(".adventure-register__identity");
          const state = head?.querySelector(".adventure-register__state");
          const headRect = head?.getBoundingClientRect();
          const identityRect = identity?.getBoundingClientRect();
          const stateRect = state?.getBoundingClientRect();
          return {
            key: chapter.getAttribute("data-adventure-chapter") || "",
            title: chapter.querySelector(".adventure-register__title")?.textContent?.trim() || "",
            hasHead: Boolean(head),
            headOverflow: head ? head.scrollWidth > head.clientWidth + 1 : true,
            identityStateOverlap:
              identityRect && stateRect
                ? Math.min(identityRect.right, stateRect.right) >
                    Math.max(identityRect.left, stateRect.left) + 1 &&
                  Math.min(identityRect.bottom, stateRect.bottom) >
                    Math.max(identityRect.top, stateRect.top) + 1
                : false,
            headInside:
              headRect && identityRect && stateRect
                ? identityRect.left >= headRect.left - 1 &&
                  identityRect.right <= headRect.right + 1 &&
                  stateRect.left >= headRect.left - 1 &&
                  stateRect.right <= headRect.right + 1
                : false,
            borders: [
              style.borderTopWidth,
              style.borderRightWidth,
              style.borderBottomWidth,
              style.borderLeftWidth,
            ].map((width) => Number.parseFloat(width)),
            radius: Number.parseFloat(style.borderTopLeftRadius),
            shadow: style.boxShadow,
            background: style.backgroundColor,
          };
        });
        return {
          register: {
            sameNode: register === folio && register === consoleDesk,
            borderTop: Number.parseFloat(registerStyle.borderTopWidth),
            borderRight: Number.parseFloat(registerStyle.borderRightWidth),
            borderBottom: Number.parseFloat(registerStyle.borderBottomWidth),
            borderLeft: Number.parseFloat(registerStyle.borderLeftWidth),
            radius: Number.parseFloat(registerStyle.borderTopLeftRadius),
            shadow: registerStyle.boxShadow,
            background: registerStyle.backgroundColor,
          },
          chapters: chapterRows,
          cardShells: register.querySelectorAll(".card-ink").length,
          embeddedSecret: Boolean(
            register.querySelector("[data-adventure-secret] [data-secret-realm-embedded]"),
          ),
        };
      });
      checked += 1;
      if (
        !adventureDesk ||
        !adventureDesk.register.sameNode ||
        adventureDesk.register.borderTop < 1 ||
        adventureDesk.register.borderBottom < 1 ||
        adventureDesk.register.borderLeft !== 0 ||
        adventureDesk.register.borderRight !== 0 ||
        adventureDesk.register.radius !== 0 ||
        adventureDesk.register.shadow !== "none"
      ) {
        failures.push(
          `[${vp.tag}] /adventure 没有收成一张连续行旅续卷:${JSON.stringify(adventureDesk?.register ?? null)}`,
        );
      }
      if (adventureDesk) {
        if (
          adventureDesk.chapters.map((chapter) => chapter.key).join(",") !==
          "briefing,regions,secret,rules"
        ) {
          failures.push(
            `[${vp.tag}] /adventure 四章顺序不对:${adventureDesk.chapters
              .map((chapter) => chapter.key)
              .join(" / ")}`,
          );
        }
        if (
          adventureDesk.chapters.map((chapter) => chapter.title).join(",") !==
          "今日行旅,眼下可往,秘境,行旅之则"
        ) {
          failures.push(
            `[${vp.tag}] /adventure 四章章名不对:${adventureDesk.chapters
              .map((chapter) => chapter.title)
              .join(" / ")}`,
          );
        }
        const brokenChapters = adventureDesk.chapters.filter(
          (chapter) =>
            !chapter.hasHead ||
            chapter.headOverflow ||
            chapter.identityStateOverlap ||
            !chapter.headInside ||
            chapter.radius !== 0 ||
            chapter.shadow !== "none" ||
            chapter.background !== "rgba(0, 0, 0, 0)" ||
            chapter.borders.every((width) => width > 0) ||
            (vp.width < 620 && chapter.borders.slice(1).some((width) => width !== 0)),
        );
        if (brokenChapters.length) {
          failures.push(
            `[${vp.tag}] /adventure 续卷里有章首挤压或重新套壳:${JSON.stringify(brokenChapters)}`,
          );
        }
        if (adventureDesk.cardShells > 0) {
          failures.push(
            `[${vp.tag}] /adventure 续卷里又套了 ${adventureDesk.cardShells} 张 card-ink`,
          );
        }
        if (!adventureDesk.embeddedSecret) {
          failures.push(`[${vp.tag}] /adventure 秘境没有接进同一续卷`);
        }
      }
    }
    if (route === "/settings") {
      const settingsDesk = await page.evaluate(() => {
        const current = document.querySelector("[data-settings-current]");
        const consoleDesk = document.querySelector("[data-settings-console]");
        const register = document.querySelector("[data-settings-register]");
        const folio = document.querySelector("[data-settings-folio]");
        const afterword = document.querySelector("[data-settings-afterword]");
        const registerStyle = register ? getComputedStyle(register) : null;
        const chapters = [...document.querySelectorAll("[data-settings-chapter]")];
        const chapterRows = chapters.map((chapter) => {
          const style = getComputedStyle(chapter);
          const head = chapter.querySelector(".settings-register__head");
          const identity = head?.querySelector(".settings-register__identity");
          const state = head?.querySelector(".settings-register__state");
          const headRect = head?.getBoundingClientRect();
          const identityRect = identity?.getBoundingClientRect();
          const stateRect = state?.getBoundingClientRect();
          return {
            key: chapter.getAttribute("data-settings-chapter") || "",
            title: chapter.querySelector(".settings-register__title")?.textContent?.trim() || "",
            hasHead: Boolean(head),
            headOverflow: head ? head.scrollWidth > head.clientWidth + 1 : true,
            identityStateOverlap:
              identityRect && stateRect
                ? Math.min(identityRect.right, stateRect.right) >
                    Math.max(identityRect.left, stateRect.left) + 1 &&
                  Math.min(identityRect.bottom, stateRect.bottom) >
                    Math.max(identityRect.top, stateRect.top) + 1
                : false,
            headInside:
              headRect && identityRect && stateRect
                ? identityRect.left >= headRect.left - 1 &&
                  identityRect.right <= headRect.right + 1 &&
                  stateRect.left >= headRect.left - 1 &&
                  stateRect.right <= headRect.right + 1
                : false,
            borders: [
              style.borderTopWidth,
              style.borderRightWidth,
              style.borderBottomWidth,
              style.borderLeftWidth,
            ].map((width) => Number.parseFloat(width)),
            radius: Number.parseFloat(style.borderTopLeftRadius),
            shadow: style.boxShadow,
            background: style.backgroundColor,
          };
        });
        return {
          current: (current?.textContent || "").replace(/\s+/g, " ").trim(),
          console: !!consoleDesk,
          register: registerStyle
            ? {
                sameNode: register === folio && register === consoleDesk,
                borderTop: Number.parseFloat(registerStyle.borderTopWidth),
                borderRight: Number.parseFloat(registerStyle.borderRightWidth),
                borderBottom: Number.parseFloat(registerStyle.borderBottomWidth),
                borderLeft: Number.parseFloat(registerStyle.borderLeftWidth),
                radius: Number.parseFloat(registerStyle.borderTopLeftRadius),
                shadow: registerStyle.boxShadow,
                background: registerStyle.backgroundColor,
                afterwordInside: Boolean(register?.querySelector("[data-settings-afterword]")),
                afterwordDisplay: afterword ? getComputedStyle(afterword).display : null,
              }
            : null,
          chapters: chapterRows,
          groups: [...document.querySelectorAll("[data-settings-group]")].map(
            (el) => el.getAttribute("data-settings-group") || "",
          ),
          archive: !!document.querySelector("[data-settings-archive]"),
          trail: !!document.querySelector("[data-settings-trail]"),
          index: !!document.querySelector("[data-settings-index]"),
          compass: !!document.querySelector("[data-settings-compass]"),
          choices: [...document.querySelectorAll("[data-ink-choice]")].map((group) => {
            const buttons = [...group.querySelectorAll("button")];
            const rect = group.getBoundingClientRect();
            return {
              name: group.getAttribute("data-ink-choice") || "",
              count: buttons.length,
              pressed: buttons.filter((button) => button.getAttribute("aria-pressed") === "true")
                .length,
              minHeight: buttons.length
                ? Math.min(...buttons.map((button) => button.getBoundingClientRect().height))
                : 0,
              overflow: group.scrollWidth > group.clientWidth + 1 || rect.width <= 0,
            };
          }),
          checkboxes: document.querySelectorAll('input[type="checkbox"]').length,
        };
      });
      checked += 1;
      if (!settingsDesk.current || !settingsDesk.console) {
        failures.push(`[${vp.tag}] /settings 天机匣没有渲染出来(卷首与续卷都没报此刻)`);
      }
      if (settingsDesk.groups.join(",") !== "sound,sight,conduct") {
        failures.push(
          `[${vp.tag}] /settings 三案顺序不对:${settingsDesk.groups.join(" / ") || "无"}`,
        );
      }
      if (
        settingsDesk.chapters.map((chapter) => chapter.key).join(",") !==
        "sound,sight,conduct,archive,trail,index"
      ) {
        failures.push(
          `[${vp.tag}] /settings 六章顺序不对:${settingsDesk.chapters
            .map((chapter) => chapter.key)
            .join(" / ")}`,
        );
      }
      if (
        settingsDesk.chapters.map((chapter) => chapter.title).join(",") !==
        "声息,观照,行止,存续,留痕,卷末"
      ) {
        failures.push(
          `[${vp.tag}] /settings 六章章名不对:${settingsDesk.chapters
            .map((chapter) => chapter.title)
            .join(" / ")}`,
        );
      }
      if (!settingsDesk.archive || !settingsDesk.trail || !settingsDesk.index) {
        failures.push(`[${vp.tag}] /settings 存续、留痕或卷末缺了一章`);
      }
      if (settingsDesk.checkboxes > 0) {
        failures.push(`[${vp.tag}] /settings 又出现 ${settingsDesk.checkboxes} 个原生 checkbox`);
      }
      if (
        settingsDesk.choices.map((group) => group.name).join(",") !==
        "music,sfx,theme,battle-speed,motion,dnd"
      ) {
        failures.push(
          `[${vp.tag}] /settings 六组账签顺序不对:${settingsDesk.choices
            .map((group) => group.name)
            .join(" / ")}`,
        );
      }
      const brokenChoices = settingsDesk.choices.filter(
        (group) =>
          group.count < 2 || group.pressed !== 1 || group.minHeight < 39.5 || group.overflow,
      );
      if (brokenChoices.length) {
        failures.push(
          `[${vp.tag}] /settings 账签没有一枚选中、40px 触达或出现横向溢出:${JSON.stringify(
            brokenChoices,
          )}`,
        );
      }
      if (
        !settingsDesk.register ||
        !settingsDesk.register.sameNode ||
        !settingsDesk.register.afterwordInside ||
        settingsDesk.register.afterwordDisplay !== "contents" ||
        settingsDesk.register.borderTop < 1 ||
        settingsDesk.register.borderBottom < 1 ||
        settingsDesk.register.borderLeft !== 0 ||
        settingsDesk.register.borderRight !== 0 ||
        settingsDesk.register.radius !== 0 ||
        settingsDesk.register.shadow !== "none"
      ) {
        failures.push(
          `[${vp.tag}] /settings 没有收成一张连续账页:${JSON.stringify(settingsDesk.register)}`,
        );
      }
      if (settingsDesk.chapters.length !== 6) {
        failures.push(`[${vp.tag}] /settings 续卷实见 ${settingsDesk.chapters.length} 章(应为 6)`);
      }
      const brokenChapters = settingsDesk.chapters.filter(
        (chapter) =>
          !chapter.hasHead ||
          chapter.headOverflow ||
          chapter.identityStateOverlap ||
          !chapter.headInside ||
          chapter.radius !== 0 ||
          chapter.shadow !== "none" ||
          chapter.background !== "rgba(0, 0, 0, 0)" ||
          chapter.borders.every((width) => width > 0) ||
          (vp.width < 620 && chapter.borders.slice(1).some((width) => width !== 0)),
      );
      if (brokenChapters.length) {
        failures.push(
          `[${vp.tag}] /settings 续卷里有章首挤压或重新套壳:${JSON.stringify(brokenChapters)}`,
        );
      }
      if (vp.width >= 360 && !settingsDesk.compass) {
        failures.push(`[${vp.tag}] /settings 天机盘没有随卷首渲染`);
      }
      if (!/乐|静/.test(settingsDesk.current) || !/备份/.test(settingsDesk.current)) {
        failures.push(`[${vp.tag}] /settings 卷首没有同报声息与存续:«${settingsDesk.current}»`);
      }
    }
    if (route === "/legacy") {
      const legacyDesk = await page.evaluate(() => {
        const current = document.querySelector("[data-legacy-current]");
        return {
          current: (current?.textContent || "").replace(/\s+/g, " ").trim(),
          profile: !!document.querySelector("[data-legacy-profile]"),
          samsara: !!document.querySelector("[data-legacy-samsara]"),
          stage: !!document.querySelector("[data-legacy-stage]"),
          lore: !!document.querySelector("[data-legacy-lore]"),
          vow: !!document.querySelector("[data-legacy-vow]"),
          wheel: !!document.querySelector("[data-legacy-wheel]"),
          tabs: document.querySelectorAll("[data-legacy-tab]").length,
        };
      });
      checked += 1;
      if (!legacyDesk.current || !legacyDesk.samsara) {
        failures.push(`[${vp.tag}] /legacy 三生总案没有渲染出来(卷首与正文都没报此刻)`);
      }
      if (!legacyDesk.profile) {
        failures.push(`[${vp.tag}] /legacy 修行画像没有常驻在页签之前`);
      }
      if (!legacyDesk.stage || !legacyDesk.lore || !legacyDesk.vow) {
        failures.push(`[${vp.tag}] /legacy 本世总案缺了宿慧、随身所知或此世命题`);
      }
      if (legacyDesk.tabs !== 1) {
        failures.push(`[${vp.tag}] /legacy 当前册应只铺一个 tabpanel,实见 ${legacyDesk.tabs}`);
      }
      if (vp.width >= 360 && !legacyDesk.wheel) {
        failures.push(`[${vp.tag}] /legacy 三生盘没有随卷首渲染`);
      }
      if (!/第\s*\d+\s*世/.test(legacyDesk.current) || !/宿慧/.test(legacyDesk.current)) {
        failures.push(`[${vp.tag}] /legacy 卷首没有同报世数与宿慧:«${legacyDesk.current}»`);
      }
    }
    if ((vp.tag === "390" || vp.tag === "320") && (route === "/celestial" || route === "/souls")) {
      const sealed = await probeUnopenedFolio(page);
      unopenedFolioSeen += 1;
      checked += 1;
      const sealedBad = unopenedFolioProblems(sealed, `[${vp.tag}] ${route}`, {
        firstScreen: vp.tag === "390",
      });
      if (sealedBad.length) failures.push(sealedBad.join(" / "));
    }
    /*
     * 桌面不是「放大的手机」:960px 以上游戏外壳应展开成书桌,修炼 / 行囊 /
     * 道躯 / 藏珍四册走双页网格;首页在自己的宽案内排指挥台,多栏案卷放宽到
     * 60rem,设置仍是一张 48rem 读卷。
     * 源码契约在 folioSpread.spec 里,这里量真实布局 —— 只改断点不改 App 数据属性、
     * 网格被页框压回单列,或案卷仍挤在单叶宽度里,都该红。
     */
    if (vp.tag === "1280x800") {
      const desk = await page.evaluate(() => {
        const shell = document.querySelector(".app-shell");
        const page = document.querySelector(".folio-page");
        const spine = document.querySelector("[data-desktop-spine]");
        const dock = document.querySelector("[data-folio-dock]");
        if (!shell || !page) return null;
        const pageStyle = getComputedStyle(page);
        const gutter = getComputedStyle(page, "::before");
        const spineStyle = spine ? getComputedStyle(spine) : null;
        const masthead = document.querySelector("[data-folio-masthead]");
        const mastheadStyle = masthead ? getComputedStyle(masthead) : null;
        const mastheadSignature = masthead ? getComputedStyle(masthead, "::after") : null;
        const mastheadOrdinal = masthead?.querySelector(".folio-masthead__ordinal");
        const head = document.querySelector("[data-folio-head]");
        const ledger = document.querySelector("[data-desktop-ledger]");
        const spineNav = spine?.querySelector('nav[aria-label="全站册目"]');
        const spineNavRect = spineNav?.getBoundingClientRect();
        const spineLinks = spineNav ? [...spineNav.querySelectorAll("a[href]")] : [];
        const spineSections = spineNav
          ? [...spineNav.querySelectorAll("[data-spine-section]")]
          : [];
        const cultivationLedger = document.querySelector("[data-cultivation-ledger]");
        const cultivationNext = document.querySelector("[data-cultivation-next]");
        const ledgerRect = cultivationLedger?.getBoundingClientRect();
        const nextRect = cultivationNext?.getBoundingClientRect();
        const settingsRegister = document.querySelector("[data-settings-register]");
        const settingsArchive = document.querySelector(".settings-register__chapter--archive");
        const settingsTrail = document.querySelector(".settings-register__chapter--trail");
        const settingsIndex = document.querySelector(".settings-register__chapter--index");
        const settingsStyle = settingsRegister ? getComputedStyle(settingsRegister) : null;
        const archiveRect = settingsArchive?.getBoundingClientRect();
        const trailRect = settingsTrail?.getBoundingClientRect();
        const indexRect = settingsIndex?.getBoundingClientRect();
        const characterCatalog = document.querySelector("[data-character-catalog]");
        const catalogStyle = characterCatalog ? getComputedStyle(characterCatalog) : null;
        const catalogGroups = characterCatalog
          ? [...characterCatalog.querySelectorAll("[data-character-index]")]
          : [];
        const catalogRects = catalogGroups.map((group) => group.getBoundingClientRect());
        const inventoryEquipment = document.querySelector("[data-inventory-equipment]");
        const inventoryCollection = document.querySelector(
          ".inventory-collection[data-inventory-total]",
        );
        const inventoryRegister = document.querySelector("[data-inventory-register]");
        const inventoryChapters = inventoryRegister
          ? [...inventoryRegister.querySelectorAll("[data-inventory-chapter]")]
          : [];
        const inventoryRegisterStyle = inventoryRegister
          ? getComputedStyle(inventoryRegister)
          : null;
        const inventoryChapterShells = inventoryChapters.filter((chapter) => {
          const chapterStyle = getComputedStyle(chapter);
          return (
            Number.parseFloat(chapterStyle.borderRadius) !== 0 ||
            chapterStyle.boxShadow !== "none" ||
            chapterStyle.backgroundColor !== "rgba(0, 0, 0, 0)"
          );
        });
        const equipmentRect = inventoryEquipment?.getBoundingClientRect();
        const collectionRect = inventoryCollection?.getBoundingClientRect();
        const achievementBriefing = document.querySelector("[data-achievement-hero]");
        const achievementVolumes = document.querySelector("[data-achievement-volumes]");
        const achievementRect = achievementBriefing?.getBoundingClientRect();
        const achievementVolumesRect = achievementVolumes?.getBoundingClientRect();
        return {
          layout: shell.getAttribute("data-folio-layout"),
          shellWidth: Math.round(shell.getBoundingClientRect().width),
          pageWidth: Math.round(page.getBoundingClientRect().width),
          masthead: mastheadStyle
            ? {
                immersive: masthead.classList.contains("cultivation-masthead"),
                borderTop: Number.parseFloat(mastheadStyle.borderTopWidth),
                borderRight: Number.parseFloat(mastheadStyle.borderRightWidth),
                borderBottom: Number.parseFloat(mastheadStyle.borderBottomWidth),
                borderLeft: Number.parseFloat(mastheadStyle.borderLeftWidth),
                shadow: mastheadStyle.boxShadow,
                signature: mastheadSignature
                  ? {
                      width: Number.parseFloat(mastheadSignature.width),
                      height: Number.parseFloat(mastheadSignature.height),
                      backgroundImage: mastheadSignature.backgroundImage,
                      backgroundColor: mastheadSignature.backgroundColor,
                    }
                  : null,
                ordinal: mastheadOrdinal
                  ? {
                      display: getComputedStyle(mastheadOrdinal).display,
                      text: mastheadOrdinal.textContent?.trim() ?? "",
                    }
                  : null,
              }
            : null,
          display: pageStyle.display,
          columns: pageStyle.gridTemplateColumns.split(/\s+/).filter(Boolean).length,
          gutter: gutter.backgroundImage,
          spine: spine
            ? {
                display: spineStyle.display,
                width: Math.round(spine.getBoundingClientRect().width),
                entries: spine.querySelectorAll('nav[aria-label="全站册目"] a[href]').length,
                current: spine.querySelectorAll("[data-spine-current]").length,
                currentHref: spine.querySelector("[data-spine-current]")?.getAttribute("href"),
                head: head ? getComputedStyle(head).display : null,
                ledger: ledger ? getComputedStyle(ledger).display : null,
                linksInView:
                  spineNavRect === undefined
                    ? 0
                    : spineLinks.filter((link) => {
                        const rect = link.getBoundingClientRect();
                        return (
                          rect.top >= spineNavRect.top - 1 && rect.bottom <= spineNavRect.bottom + 1
                        );
                      }).length,
                sectionsInView:
                  spineNavRect === undefined
                    ? 0
                    : spineSections.filter((section) => {
                        const rect = section.getBoundingClientRect();
                        return (
                          rect.top >= spineNavRect.top - 1 && rect.bottom <= spineNavRect.bottom + 1
                        );
                      }).length,
                navScrolls: spineNav ? spineNav.scrollHeight > spineNav.clientHeight + 1 : null,
              }
            : null,
          dock: dock ? getComputedStyle(dock).display : null,
          cultivationPair:
            ledgerRect && nextRect
              ? {
                  sameRow: Math.abs(ledgerRect.top - nextRect.top) <= 2,
                  nextOnRight: nextRect.left >= ledgerRect.right - 1,
                  nextWidth: Math.round(nextRect.width),
                }
              : null,
          settingsPair: settingsRegister
            ? {
                columns: settingsStyle.gridTemplateColumns.split(/\s+/).filter(Boolean).length,
                sameRow:
                  archiveRect && trailRect ? Math.abs(archiveRect.top - trailRect.top) <= 2 : false,
                indexBelow: trailRect && indexRect ? indexRect.top >= trailRect.bottom - 2 : false,
                indexSameColumn:
                  trailRect && indexRect
                    ? Math.abs(indexRect.left - trailRect.left) <= 2 &&
                      Math.abs(indexRect.width - trailRect.width) <= 2
                    : false,
                archiveWidth: archiveRect ? Math.round(archiveRect.width) : 0,
                trailWidth: trailRect ? Math.round(trailRect.width) : 0,
              }
            : null,
          characterCatalog:
            characterCatalog && catalogStyle
              ? {
                  columns: catalogStyle.gridTemplateColumns.split(/\s+/).filter(Boolean).length,
                  groups: catalogGroups.length,
                  entries: characterCatalog.querySelectorAll(".character-index__row").length,
                  sameRow:
                    catalogRects.length === 3 &&
                    catalogRects.every((rect) => Math.abs(rect.top - catalogRects[0].top) <= 2),
                  narrowest: Math.round(Math.min(...catalogRects.map((rect) => rect.width))),
                }
              : null,
          inventoryPair:
            equipmentRect && collectionRect
              ? {
                  sameRow: Math.abs(equipmentRect.top - collectionRect.top) <= 2,
                  collectionOnRight: collectionRect.left >= equipmentRect.right - 1,
                  equipmentWidth: Math.round(equipmentRect.width),
                  collectionWidth: Math.round(collectionRect.width),
                }
              : null,
          inventoryRegister: inventoryRegister
            ? {
                chapters: inventoryChapters.map((chapter) =>
                  chapter.getAttribute("data-inventory-chapter"),
                ),
                seats: inventoryRegister.querySelectorAll("[data-equip-slot]").length,
                collectionRows: inventoryRegister.querySelectorAll("[data-uid]").length,
                cardClasses: inventoryRegister.querySelectorAll(".card-ink").length,
                chapterShells: inventoryChapterShells.length,
                radius: inventoryRegisterStyle
                  ? Number.parseFloat(inventoryRegisterStyle.borderRadius)
                  : null,
                shadow: inventoryRegisterStyle?.boxShadow ?? null,
              }
            : null,
          collectionPair:
            achievementRect && achievementVolumesRect
              ? {
                  sameRow: Math.abs(achievementRect.top - achievementVolumesRect.top) <= 2,
                  volumesOnRight: achievementVolumesRect.left >= achievementRect.right - 1,
                  briefingWidth: Math.round(achievementRect.width),
                  volumesWidth: Math.round(achievementVolumesRect.width),
                }
              : null,
        };
      });
      desktopFolioSeen += 1;
      desktopSpineSeen += 1;
      if (!desk) {
        failures.push(`[${vp.tag}] ${route} 桌面册页几何没量到`);
      } else {
        if (!desk.spine || desk.spine.display === "none" || desk.spine.width < 60) {
          failures.push(`[${vp.tag}] ${route} 桌面书脊没有出现`);
        } else {
          if (desk.spine.entries !== NAVIGATION_ENTRIES.length) {
            failures.push(
              `[${vp.tag}] ${route} 桌面书脊册目不全(${desk.spine.entries}/${NAVIGATION_ENTRIES.length})`,
            );
          }
          if (desk.spine.current !== 1 || desk.spine.currentHref !== `#${route}`) {
            failures.push(
              `[${vp.tag}] ${route} 桌面书脊当前册标记为 ${desk.spine.current} 处 / ${desk.spine.currentHref}`,
            );
          }
          if (desk.spine.head !== "none") {
            failures.push(`[${vp.tag}] ${route} 展开书脊后顶栏仍在重复报位置`);
          }
          if (desk.spine.ledger === "none" || desk.spine.ledger === null) {
            failures.push(`[${vp.tag}] ${route} 桌面书脊随身账没有出现`);
          }
          if (
            desk.spine.linksInView !== NAVIGATION_ENTRIES.length ||
            desk.spine.sectionsInView !== NAVIGATION_SECTIONS.length ||
            desk.spine.navScrolls
          ) {
            failures.push(
              `[${vp.tag}] ${route} 桌面书脊还有册目藏在滚动区外(${desk.spine.linksInView} 册 / ${desk.spine.sectionsInView} 卷,滚动=${desk.spine.navScrolls})`,
            );
          }
        }
        if (desk.dock !== "none") {
          failures.push(`[${vp.tag}] ${route} 桌面仍留着手机底栏(${desk.dock ?? "未找到"})`);
        }
        if (desk.shellWidth < 1000) {
          failures.push(
            `[${vp.tag}] ${route} 游戏态外壳只有 ${desk.shellWidth}px —— 桌面仍是一条手机屏`,
          );
        }
        const expectedLayout = folioLayoutOf(route === "/" ? "home" : route.slice(1));
        if (desk.layout !== expectedLayout) {
          failures.push(
            `[${vp.tag}] ${route} 桌面版式应为 ${expectedLayout},实际为 ${desk.layout}`,
          );
        }
        if (expectedLayout === "spread") {
          if (desk.display !== "grid" || desk.columns < 2) {
            failures.push(
              `[${vp.tag}] ${route} 双页册没有真的展开(${desk.layout} / ${desk.display} / ${desk.columns} 栏)`,
            );
          }
          if (desk.pageWidth < 1000) {
            failures.push(
              `[${vp.tag}] ${route} 双页正文只有 ${desk.pageWidth}px —— 没有用上书桌宽度`,
            );
          }
          if (!desk.masthead) {
            failures.push(`[${vp.tag}] ${route} 桌面卷首没量到`);
          } else if (desk.masthead.immersive) {
            /*
             * 修炼卷首是一整块暗场主舞台,不是纸面题签:它不该留任何卡片外框,
             * 也不该为「底缘 + 落款线」硬加一道线。只看它是否真的铺满、无框、无影。
             */
            if (
              desk.masthead.borderTop !== 0 ||
              desk.masthead.borderRight !== 0 ||
              desk.masthead.borderBottom !== 0 ||
              desk.masthead.borderLeft !== 0 ||
              desk.masthead.shadow !== "none"
            ) {
              failures.push(`[${vp.tag}] ${route} 暗场卷首又长回了纸卡外框`);
            }
          } else if (
            desk.masthead.borderTop !== 0 ||
            desk.masthead.borderRight !== 0 ||
            desk.masthead.borderLeft !== 0 ||
            Math.abs(desk.masthead.borderBottom - 1) > 0.25 ||
            desk.masthead.shadow !== "none" ||
            !desk.masthead.signature ||
            desk.masthead.signature.width <= 0 ||
            desk.masthead.signature.height > 1.5 ||
            (desk.masthead.signature.backgroundImage === "none" &&
              desk.masthead.signature.backgroundColor === "rgba(0, 0, 0, 0)")
          ) {
            failures.push(`[${vp.tag}] ${route} 桌面卷首没有收成「底缘 + 世界色落款线」`);
          }
          if (
            !desk.masthead?.ordinal ||
            desk.masthead.ordinal.display === "none" ||
            !/^\d{2}$/.test(desk.masthead.ordinal.text)
          ) {
            failures.push(`[${vp.tag}] ${route} 桌面卷首册次水印没有落出来`);
          }
          if (!desk.gutter.includes("linear-gradient")) {
            failures.push(`[${vp.tag}] ${route} 双页中缝没有画出来`);
          }
          if (
            route === "/cultivation" &&
            (!desk.cultivationPair ||
              !desk.cultivationPair.sameRow ||
              !desk.cultivationPair.nextOnRight ||
              desk.cultivationPair.nextWidth < 320)
          ) {
            failures.push(
              `[${vp.tag}] /cultivation 行功账与下一步没有在双页上并读(${JSON.stringify(
                desk.cultivationPair,
              )})`,
            );
          }
          if (
            route === "/inventory" &&
            (!desk.inventoryPair ||
              !desk.inventoryPair.sameRow ||
              !desk.inventoryPair.collectionOnRight ||
              desk.inventoryPair.equipmentWidth < 360 ||
              desk.inventoryPair.collectionWidth < 320)
          ) {
            failures.push(
              `[${vp.tag}] /inventory 行囊九佩与藏品没有并读(${JSON.stringify(
                desk.inventoryPair,
              )})`,
            );
          }
          if (
            route === "/inventory" &&
            (!desk.inventoryRegister ||
              desk.inventoryRegister.chapters.join(",") !== "briefing,seats,collection" ||
              desk.inventoryRegister.seats !== 9 ||
              desk.inventoryRegister.cardClasses !== 0 ||
              desk.inventoryRegister.chapterShells !== 0 ||
              desk.inventoryRegister.radius !== 0 ||
              desk.inventoryRegister.shadow !== "none")
          ) {
            failures.push(
              `[${vp.tag}] /inventory 行囊没有收成一册三章续卷(${JSON.stringify(
                desk.inventoryRegister,
              )})`,
            );
          }
          if (
            route === "/collection" &&
            (!desk.collectionPair ||
              !desk.collectionPair.sameRow ||
              !desk.collectionPair.volumesOnRight ||
              desk.collectionPair.briefingWidth < 360 ||
              desk.collectionPair.volumesWidth < 320)
          ) {
            failures.push(
              `[${vp.tag}] /collection 藏珍总谱与卷目没有并读(${JSON.stringify(
                desk.collectionPair,
              )})`,
            );
          }
        } else if (expectedLayout === "wide") {
          if (desk.display === "grid") {
            failures.push(`[${vp.tag}] ${route} 宽案不该冒充双页网格(${desk.display})`);
          }
          if (desk.pageWidth < 840) {
            failures.push(`[${vp.tag}] ${route} 案卷没有铺开(${desk.pageWidth}px,应至少 840px)`);
          }
        } else {
          if (desk.display === "grid") {
            failures.push(`[${vp.tag}] ${route} 读卷不该铺成网格(${desk.display})`);
          }
          if (desk.pageWidth > 800) {
            failures.push(
              `[${vp.tag}] ${route} 读卷册在桌面上拉得过宽(${desk.pageWidth}px,应不超过 800px)`,
            );
          }
        }
        if (
          route === "/settings" &&
          (!desk.settingsPair ||
            desk.settingsPair.columns < 12 ||
            !desk.settingsPair.sameRow ||
            !desk.settingsPair.indexBelow ||
            !desk.settingsPair.indexSameColumn ||
            desk.settingsPair.archiveWidth < 300 ||
            desk.settingsPair.trailWidth < 260)
        ) {
          failures.push(
            `[${vp.tag}] /settings 存续、留痕与卷末没有在桌面上并读(${JSON.stringify(
              desk.settingsPair,
            )})`,
          );
        }
        if (
          route === "/character" &&
          (!desk.characterCatalog ||
            desk.characterCatalog.columns < 3 ||
            desk.characterCatalog.groups !== 3 ||
            desk.characterCatalog.entries !== 9 ||
            !desk.characterCatalog.sameRow ||
            desk.characterCatalog.narrowest < 250)
        ) {
          failures.push(
            `[${vp.tag}] /character 卷末目录没有三组并读(${JSON.stringify(desk.characterCatalog)})`,
          );
        }
        if (route === "/inventory") {
          await page.getByRole("tab", { name: "丹药" }).click();
          await settleVisuals(page);
          const pillPair = await page.evaluate(() => {
            const workshop = document.querySelector("[data-inventory-workshop]");
            const cabinet = document.querySelector("[data-inventory-pill-cabinet]");
            if (!workshop || !cabinet) return null;
            const workshopRect = workshop.getBoundingClientRect();
            const cabinetRect = cabinet.getBoundingClientRect();
            return {
              sameRow: Math.abs(workshopRect.top - cabinetRect.top) <= 2,
              cabinetOnRight: cabinetRect.left >= workshopRect.right - 1,
              workshopWidth: Math.round(workshopRect.width),
              cabinetWidth: Math.round(cabinetRect.width),
            };
          });
          if (
            !pillPair ||
            !pillPair.sameRow ||
            !pillPair.cabinetOnRight ||
            pillPair.workshopWidth < 360 ||
            pillPair.cabinetWidth < 320
          ) {
            failures.push(`[${vp.tag}] /inventory 行囊丹药册没有并读(${JSON.stringify(pillPair)})`);
          }
          await page.getByRole("tab", { name: "装备" }).click();
          await settleVisuals(page);
        }
        if (route === "/collection") {
          await page.getByRole("tab", { name: "收藏" }).click();
          await settleVisuals(page);
          const shelfPair = await page.evaluate(() => {
            const briefing = document.querySelector("[data-collection-hero]");
            const shelves = document.querySelector("[data-collection-shelves]");
            if (!briefing || !shelves) return null;
            const briefingRect = briefing.getBoundingClientRect();
            const shelvesRect = shelves.getBoundingClientRect();
            return {
              sameRow: Math.abs(briefingRect.top - shelvesRect.top) <= 2,
              shelvesOnRight: shelvesRect.left >= briefingRect.right - 1,
              briefingWidth: Math.round(briefingRect.width),
              shelvesWidth: Math.round(shelvesRect.width),
            };
          });
          if (
            !shelfPair ||
            !shelfPair.sameRow ||
            !shelfPair.shelvesOnRight ||
            shelfPair.briefingWidth < 360 ||
            shelfPair.shelvesWidth < 320
          ) {
            failures.push(
              `[${vp.tag}] /collection 藏珍谱与九册没有并读(${JSON.stringify(shelfPair)})`,
            );
          }
          await page.getByRole("tab", { name: "成就" }).click();
          await settleVisuals(page);
        }
      }
    }
    /*
     * 正文对比度只在最常用那一档视口上量(390):它与视口宽度无关,五档各量一遍只是把
     * 巡页时间乘以五。两套主题都量,见 measureTextContrast。
     */
    if (vp.tag === "390") {
      // 先清浮层再量:题条盖住页眉、弹窗遮罩压暗整页,都会把对比度量成假红
      await quiesceOverlays(page);
      await settleVisuals(page);
      for (const bad of await measureTextContrast(page)) {
        contrastFails.push(
          `[${vp.tag}] ${route} ${bad.theme} ${bad.ratio}:1(需 ${bad.need})${bad.size}px «${bad.text}»`,
        );
      }
      /*
       * 渐变/图片底那几处,上一条量不到(它只算得到声明出来的色号),这里采样真实像素。
       * 弹窗盖着页面时不量:遮罩会把整页压暗,量出来的全会是假红(实测 /codex 上吃过一次)。
       */
      for (let i = 0; i < 3 && (await page.locator(".modal-panel").count()) > 0; i += 1) {
        await page.keyboard.press("Escape");
        await page.waitForTimeout(200);
      }
      await quiesceOverlays(page);
      if ((await page.locator(".modal-panel").count()) === 0) {
        for (const bad of await pixelContrastOf(page, await pixelSampler(auditCtx))) {
          pixelContrastFails.push(
            `[${vp.tag}] ${route} ${bad.theme} 5% 分位 ${bad.p05}:1 · 读不出来 ${bad.badPct}%(需 ${bad.need})${bad.size}px «${bad.text}» ${bad.cls}`,
          );
        }
      }
    }
    const rail = await measureTabRail(page);
    const railFails = railProblems(rail);
    if (rail) checked += 1;
    if (railFails.length) failures.push(`[${vp.tag}] ${route} → ${railFails.join(" / ")}`);
    /*
     * 两百档字号(200% 缩放)—— 放在这一页的最后:它要改视口,量完再还原,
     * 免得把前面那些按原尺寸量的读数带偏。
     */
    if (vp.tag === "390") {
      const zoom = await measureZoomScale(page, vp, route);
      zoomSeen += 1;
      const zoomBad = zoomProblems(zoom, vp.tag);
      if (zoomBad.length) zoomFails.push(`[${vp.tag}] ${route} → ${zoomBad.join(" / ")}`);
      if (route === "/celestial" || route === "/souls") {
        unopenedFolioSeen += 1;
        checked += 1;
        const sealedBad = unopenedFolioProblems(zoom.unopened, `[195] ${route}`);
        if (sealedBad.length) zoomFails.push(sealedBad.join(" / "));
      }
    }
    if (SHOTS) {
      mkdirSync(SHOTS_DIR, { recursive: true });
      await page.screenshot({
        path: join(SHOTS_DIR, `${vp.tag}${route.replace(/\//g, "_")}.png`),
        fullPage: true,
      });
      if (
        (vp.tag === "390" || vp.tag === "320") &&
        (route === "/celestial" || route === "/souls")
      ) {
        await page.locator("[data-unopened-folio]").screenshot({
          path: join(SHOTS_DIR, `${vp.tag}-unopened-folio${route.replace(/\//g, "_")}.png`),
        });
      }
    }
  }
  if (pageErrors.length)
    failures.push(`[${vp.tag}] 页面异常:${[...new Set(pageErrors)].join(" | ")}`);
  // 外域请求一律拦掉:一是量尺(应当恒为 0),二是别让别人的服务器决定我们的门要不要绿
  await page.close();

  if (contrastFails.length) failures.push(`正文对比度不足 AA:${contrastFails.join(" | ")}`);
  if (pixelContrastFails.length)
    failures.push(`渐变/图片底上的字读不出来(采样真实像素):${pixelContrastFails.join(" | ")}`);
  if (zoomFails.length) failures.push(`200% 缩放档上版面坏了:${zoomFails.join(" | ")}`);
  return { failures, checked, contrastFails, pixelContrastFails, zoomFails };
}

/** 存档写不进去 · 设置页必须说话 */
async function taskSaveUnwritable() {
  const failures = [];
  let checked = 0;
  const contrastFails = [];
  const pixelContrastFails = [];
  const zoomFails = [];
  // ---- 第四件事:存档写不进去时,设置页必须说话 ----
  {
    const auditCtx = await auditContext({ viewport: { width: 375, height: 812 } });
    const page = await auditCtx.newPage();
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    await page.goto(INDEX, { waitUntil: "load" });
    await page
      .getByRole("button", { name: /启封入山/ })
      .first()
      .click();
    await page.locator("input[type=checkbox]").first().check();
    await page
      .getByRole("button", { name: /署印入山/ })
      .first()
      .click();
    await page.waitForTimeout(3200);
    await page.locator("input:not([type=file]):not([type=checkbox])").first().fill("存档自检");
    await page
      .getByRole("button", { name: /踏\s*入\s*仙\s*途/ })
      .first()
      .click();
    await page.waitForTimeout(1200);

    // 卡死存储:此后任何写盘都抛配额错误(引擎每秒仍在改状态,故几秒内必然撞上一次刷盘)
    await page.evaluate(() => {
      Storage.prototype.setItem = function () {
        throw new DOMException("quota", "QuotaExceededError");
      };
    });
    await page.waitForTimeout(6500);
    await page.evaluate(() => {
      location.hash = "#/settings";
    });
    await page.waitForTimeout(800);
    const warned = await page.evaluate(() => document.body.innerText.includes("上次写入存档失败"));
    checked += 1;
    if (!warned) failures.push("[375] /settings → 存档写失败时设置页没有提示(静默丢档)");
    if (pageErrors.length)
      failures.push(`[375] 存档失败场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
    await page.close();
  }

  return { failures, checked, contrastFails, pixelContrastFails, zoomFails };
}

/** 弹窗的键盘与焦点 */
async function taskModalFocus() {
  const failures = [];
  let checked = 0;
  const contrastFails = [];
  const pixelContrastFails = [];
  const zoomFails = [];
  // ---- 第五件事:弹窗的键盘与焦点 ----
  {
    const auditCtx = await auditContext({ viewport: { width: 375, height: 812 } });
    const page = await auditCtx.newPage();
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    await page.goto(INDEX, { waitUntil: "load" });
    await page
      .getByRole("button", { name: /启封入山/ })
      .first()
      .click();
    await page.locator("input[type=checkbox]").first().check();
    await page
      .getByRole("button", { name: /署印入山/ })
      .first()
      .click();
    await page.waitForTimeout(3200);
    await page.locator("input:not([type=file]):not([type=checkbox])").first().fill("焦点自检");
    await page
      .getByRole("button", { name: /踏\s*入\s*仙\s*途/ })
      .first()
      .click();
    await page.waitForTimeout(1200);
    await page.evaluate(() => {
      location.hash = "#/settings";
    });
    await page.waitForTimeout(700);

    /*
     * 先把浮出来的提示条收掉再点「关于」。
     *
     * 提示条是浮在顶上的一层(而且现在真的可点),建号后的成就提示会停留两三秒;
     * 它与设置页入口若落在同一区域,这条判据就会被一条无干的提示挡住而假红
     * (实测偶发:waitFor 过了、click 超时)。要测的是弹窗焦点,不是提示条 ——
     * 提示条自己那条判据在下面单独跑。
     */
    const stillOpen = await clearOverlays(page);
    if (stillOpen.length)
      failures.push(
        `[375] 弹窗焦点场景:动手前还开着浮层 —— ${stillOpen.join("、")}(取景没收拾干净)`,
      );

    const trigger = page.getByRole("button", { name: /关于/ }).first();
    // 先等它真的画出来:懒加载的分包 + 页面淡入都要时间,直接点会得到
    // 「点了没反应」的假红(实测偶发),而这条判据要抓的是真问题,不是抢跑
    try {
      await trigger.waitFor({ state: "visible", timeout: 10000 });
      await trigger.click({ timeout: 5000 });
    } catch (err) {
      // 把真实原因与**挡路的是谁**一起写进报告 —— 「页面没就绪?」这种猜测曾让人白跑两趟,
      // 第二次才发现挡路的是一层随机浮上来的浮盖。抓不到线索的判据等于没有判据。
      const blocked = await page.evaluate(() => {
        const b = [...document.querySelectorAll("button")].find((x) =>
          (x.textContent || "").includes("关于"),
        );
        if (!b) return "(页面上找不到「关于」)";
        const r = b.getBoundingClientRect();
        const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        const modals = [...document.querySelectorAll(".modal-panel")].map((p) =>
          (p.querySelector("h3")?.textContent || "(无标题)").trim(),
        );
        return `挡路:${at ? `${at.tagName.toLowerCase()}.${String(at.className).slice(0, 40)}` : "无"} / 开着的弹窗:${modals.join("、") || "无"}`;
      });
      failures.push(
        `[375] 弹窗焦点场景:「关于」入口点不开(${String(err).split("\n")[0]?.slice(0, 80)};${blocked})`,
      );
    }
    // 等弹窗真画出来再断言:并发之后机器更忙,固定 350ms 不再等于「弹窗已就位」
    await page
      .locator(".modal-panel")
      .first()
      .waitFor({ state: "visible", timeout: 8000 })
      .catch(() => {});
    await settleVisuals(page);
    const opened = await page.evaluate(() => {
      const panel = document.querySelector(".modal-panel");
      const active = document.activeElement;
      return {
        role: panel?.getAttribute("role"),
        modal: panel?.getAttribute("aria-modal"),
        inside: !!(panel && active && panel.contains(active)),
      };
    });
    checked += 1;
    if (opened.role !== "dialog" || opened.modal !== "true")
      failures.push("[375] 弹窗没有 dialog 语义(role/aria-modal)");
    if (!opened.inside) failures.push("[375] 弹窗打开后焦点没进去 —— 键盘用户不知道弹窗开了");

    const inModal = await auditModalControls(page);
    checked += 1;
    if (!inModal || inModal.count === 0)
      failures.push("[375] 弹窗场景:面板里一个控件都没数到,判据没跑到东西");
    if (inModal && !inModal.label)
      failures.push("[375] 弹窗场景:对话框没有可访问名(读屏只会念「对话框」)");
    if (inModal?.unnamed.length)
      failures.push(
        `[375] 弹窗场景:面板里有 ${inModal.unnamed.length} 个无名控件(读屏只会念「按钮」)`,
      );
    if (inModal?.small.length)
      failures.push(`[375] 弹窗场景:面板里可点元素过小:${inModal.small.join(" | ")}`);

    // 连按六次 Tab:焦点必须一直在弹窗里(此前会一路跑到页面与底部导航)
    let escaped = false;
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press("Tab");
      const inside = await page.evaluate(() => {
        const panel = document.querySelector(".modal-panel");
        const active = document.activeElement;
        return !!(panel && active && panel.contains(active));
      });
      if (!inside) escaped = true;
    }
    if (escaped) failures.push("[375] 弹窗里按 Tab 会跑到背后的页面(焦点没有被困住)");

    await page.keyboard.press("Escape");
    // 关掉是带退场过渡的:等它真的从 DOM 里撤掉,而不是赌 300ms 够不够
    await page
      .locator(".modal-panel")
      .first()
      .waitFor({ state: "detached", timeout: 8000 })
      .catch(() => {});
    await settleVisuals(page);
    const afterEsc = await page.evaluate(() => ({
      stillOpen: !!document.querySelector(".modal-panel"),
      backOnTrigger: (document.activeElement?.textContent || "").includes("关于"),
    }));
    if (afterEsc.stillOpen) failures.push("[375] Esc 没能关掉弹窗");
    if (!afterEsc.backOnTrigger) failures.push("[375] 关掉弹窗后焦点没还给打开它的那个按钮");

    if (pageErrors.length)
      failures.push(`[375] 弹窗焦点场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
    await page.close();
  }

  return { failures, checked, contrastFails, pixelContrastFails, zoomFails };
}

/** Tab 焦点看得见 */
async function taskTabFocus() {
  const failures = [];
  let checked = 0;
  const contrastFails = [];
  const pixelContrastFails = [];
  const zoomFails = [];
  // ---- 第六件事:Tab 焦点看得见吗 ----
  {
    const auditCtx = await auditContext({ viewport: { width: 375, height: 812 } });
    const page = await auditCtx.newPage();
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    await page.goto(INDEX, { waitUntil: "load" });
    await page
      .getByRole("button", { name: /启封入山/ })
      .first()
      .click();
    await page.locator("input[type=checkbox]").first().check();
    await page
      .getByRole("button", { name: /署印入山/ })
      .first()
      .click();
    await page.waitForTimeout(3200);
    await page.locator("input:not([type=file]):not([type=checkbox])").first().fill("焦点可见自检");
    await page
      .getByRole("button", { name: /踏\s*入\s*仙\s*途/ })
      .first()
      .click();
    /*
     * 灵根定格演出约 2.6 秒,路由随后才交回首页。只等 1.2 秒会在建号页上数
     * Tab —— 那时跳读链接还没挂载,失败原因会被误读成「链接没展开」。
     * 先等入口真的出现,再收掉首拍随机浮出的引擎弹窗,最后从 body 重新起数。
     */
    await page.waitForSelector("[data-folio-skip-link]", { timeout: 5000 });
    await clearOverlays(page);
    await page.evaluate(() => document.body.focus());

    /*
     * 第一次 Tab 不该先掉进玄枢图、书脊或底栏。跳读链接展开后按回车，
     * 焦点必须落到正文滚动宿主，且 hash 路由不能因为 href="#folio-main"
     * 被带离当前册。三件事缺一，键盘用户仍在十七册目录里绕路。
     */
    await page.keyboard.press("Tab");
    const skipVisible = await page
      .waitForFunction(
        () => {
          const link = document.activeElement;
          if (!link?.matches("[data-folio-skip-link]")) return false;
          const style = getComputedStyle(link);
          const rect = link.getBoundingClientRect();
          return (
            Number.parseFloat(style.opacity) > 0.99 &&
            rect.top >= -1 &&
            rect.left >= -1 &&
            rect.bottom <= innerHeight + 1
          );
        },
        { timeout: 1200 },
      )
      .then(() => true)
      .catch(() => false);
    checked += 1;
    if (!skipVisible) {
      const skipState = await page.evaluate(() => {
        const active = document.activeElement;
        const link = document.querySelector("[data-folio-skip-link]");
        const style = link ? getComputedStyle(link) : null;
        const rect = link?.getBoundingClientRect();
        return {
          active: active
            ? `${active.tagName.toLowerCase()}.${String(active.className || "").slice(0, 48)}`
            : "(none)",
          focusVisible: active?.matches(":focus-visible") ?? false,
          opacity: style?.opacity ?? "(missing)",
          rect: rect
            ? `${Math.round(rect.left)},${Math.round(rect.top)} ${Math.round(rect.width)}×${Math.round(rect.height)}`
            : "(missing)",
          modals: document.querySelectorAll(".modal-panel").length,
        };
      });
      failures.push(
        `[375] 第一次 Tab 没有展开「直入正文」，或入口落在视口外:${JSON.stringify(skipState)}`,
      );
    }
    const beforeSkipHash = await page.evaluate(() => location.hash);
    await page.keyboard.press("Enter");
    const skipLanded = await page.evaluate(
      () => document.activeElement?.matches("#folio-main") ?? false,
    );
    checked += 1;
    if (!skipLanded) {
      const landedState = await page.evaluate(() => ({
        active: document.activeElement
          ? `${document.activeElement.tagName.toLowerCase()}.${String(document.activeElement.className || "").slice(0, 48)}`
          : "(none)",
        main: document.querySelector("#folio-main")?.tabIndex,
      }));
      failures.push(`[375] 按「直入正文」后焦点没有落到正文:${JSON.stringify(landedState)}`);
    }
    if ((await page.evaluate(() => location.hash)) !== beforeSkipHash) {
      failures.push("[375] 「直入正文」误改了 hash 路由地址");
    }
    checked += 1;

    for (const route of ["/cultivation", "/settings"]) {
      await page.evaluate((r) => {
        location.hash = `#${r}`;
      }, route);
      await page.waitForTimeout(650);
      // 从「没有焦点」的干净状态开始数 Tab,免得把上一页残留的焦点算进来
      await page.evaluate(() => document.activeElement?.blur());
      const seen = [];
      for (let i = 0; i < 6; i++) {
        await page.keyboard.press("Tab");
        const info = await page.evaluate(() => {
          const el = document.activeElement;
          if (!el || el === document.body || el === document.documentElement)
            return { blind: null, label: "(body)" };
          const cs = getComputedStyle(el);
          // 透明的轮廓等于没有 —— 只看「有没有一圈线」会把 outline:transparent 也算通过
          const hiddenOutline =
            cs.outlineColor === "transparent" || /rgba\([^)]*,\s*0\)$/.test(cs.outlineColor);
          const ring =
            (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0 && !hiddenOutline) ||
            cs.boxShadow !== "none";
          const label = `${el.tagName.toLowerCase()} «${(el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 12)}»`;
          return { blind: ring ? null : label, label };
        });
        seen.push(info.label);
        if (info.blind)
          failures.push(`[375] ${route} 第 ${i + 1} 个 Tab 落点看不见焦点:${info.blind}`);
      }
      // 落点一个没数到 = 这段判据没跑到东西,也要红
      if (seen.filter((s) => s !== "(body)").length === 0)
        failures.push(`[375] ${route} 的 Tab 落点一个都没数到`);
      const arrival = (await page.locator("[data-folio-arrival]").textContent()) ?? "";
      checked += 1;
      if (
        !arrival.includes(route === "/cultivation" ? "修炼" : "设置") ||
        !arrival.includes("已翻至")
      ) {
        failures.push(`[375] ${route} 翻页后读屏落点没有更新:${arrival.trim()}`);
      }
    }
    if (pageErrors.length)
      failures.push(`[375] 焦点可见场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
    await page.close();
  }

  return { failures, checked, contrastFails, pixelContrastFails, zoomFails };
}

/** 浮出的提示条点得掉 */
async function taskToastDismiss() {
  const failures = [];
  let checked = 0;
  const contrastFails = [];
  const pixelContrastFails = [];
  const zoomFails = [];
  // ---- 第七件事:浮出来的提示条能不能点掉 ----
  {
    const auditCtx = await auditContext({ viewport: { width: 375, height: 812 } });
    const page = await auditCtx.newPage();
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    await page.goto(INDEX, { waitUntil: "load" });
    await page
      .getByRole("button", { name: /启封入山/ })
      .first()
      .click();
    await page.locator("input[type=checkbox]").first().check();
    await page
      .getByRole("button", { name: /署印入山/ })
      .first()
      .click();
    await page.waitForTimeout(3200);
    await page.locator("input:not([type=file]):not([type=checkbox])").first().fill("浮层自检");
    await page
      .getByRole("button", { name: /踏\s*入\s*仙\s*途/ })
      .first()
      .click();
    await page.waitForTimeout(1200);
    const hostSel = ".pointer-events-none.fixed";
    const before = await page.evaluate((sel) => {
      const buttons = [...document.querySelectorAll(`${sel} button`)];
      return {
        count: buttons.length,
        // 判据是**计算出来的** pointer-events:外框写 none 时按钮会继承成 none,
        // 于是 @click 挂在那儿却永远收不到事件 —— 写了不生效,等于没写
        blocked: buttons.filter((b) => getComputedStyle(b).pointerEvents === "none").length,
      };
    }, hostSel);
    checked += 1;
    if (before.count === 0) failures.push("[375] 浮层场景:一条提示都没浮出来,这条判据没跑到东西");
    if (before.blocked > 0)
      failures.push(
        `[375] 浮层场景:${before.blocked} 条提示条点了没反应(pointer-events 被外框的 none 继承)`,
      );
    if (before.count > 0 && before.blocked === 0) {
      const first = page.locator(`${hostSel} button`).first();
      const text = ((await first.textContent()) ?? "").trim();
      await first.click({ timeout: 3000 });
      /*
       * 「点了要收」还得看它**多快**收:提示条带 glow-pulse 无限动画时,过渡探测
       * 会把 2.4 秒当成离场时长,点掉之后原地杵两秒才没(实测 460ms 仍在原地)。
       * 故给一个 1 秒的窗口 —— 它短于最短的提示寿命(2.6 秒),不会把「自己超时消失」错认成点掉了。
       */
      let gone = false;
      for (let i = 0; i < 20 && !gone; i += 1) {
        await page.waitForTimeout(50);
        gone = (await page.locator(`${hostSel} button`, { hasText: text }).count()) === 0;
      }
      if (!gone)
        failures.push(`[375] 浮层场景:点了「${text.slice(0, 12)}」1 秒内没消失(还挂在屏幕上)`);
    }
    if (pageErrors.length)
      failures.push(`[375] 浮层场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
    await page.close();
  }

  return { failures, checked, contrastFails, pixelContrastFails, zoomFails };
}

/** 引擎概率弹窗 · 顿悟/洞府巡游 */
async function taskEngineModals() {
  const failures = [];
  let checked = 0;
  const contrastFails = [];
  const pixelContrastFails = [];
  const zoomFails = [];
  // ---- 第八件事:引擎按概率触发的两扇弹窗(顿悟 / 洞府巡游) ----
  /*
   * 这两扇由引擎自己掷概率弹出(顿悟 8% × 境界存在感、巡游每日一次),
   * 正常巡页永远碰不到;而它们此前是自己铺的 fixed inset-0,没有 dialog 语义、
   * 没有焦点管理。故这里把 Math.random 钉成 0 让那一掷必中 —— 下一次引擎心跳
   * 就会摆上来,然后按弹窗那套尺子量一遍。夹具只作用于测试页,不动生产代码
   * (注意 RandomService 在构造时就抓住了 Math.random 的函数引用,故引擎其余部分
   * 的随机数不受影响)。
   */
  {
    const auditCtx = await auditContext({ viewport: { width: 375, height: 812 } });
    const page = await auditCtx.newPage();
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    await page.goto(INDEX, { waitUntil: "load" });
    await page
      .getByRole("button", { name: /启封入山/ })
      .first()
      .click();
    await page.locator("input[type=checkbox]").first().check();
    await page
      .getByRole("button", { name: /署印入山/ })
      .first()
      .click();
    await page.waitForTimeout(3200);
    await page.locator("input:not([type=file]):not([type=checkbox])").first().fill("引擎事件自检");
    await page
      .getByRole("button", { name: /踏\s*入\s*仙\s*途/ })
      .first()
      .click();
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      for (const b of document.querySelectorAll(".pointer-events-none.fixed button")) b.click();
      Math.random = () => 0;
    });
    const seen = new Map();
    const requiredKinds = new Set(["enlightenment", "cave"]);
    /*
     * 洞府巡游挂在引擎 30 秒周期检查上,而这条夹具从 load 到此处只过了数秒。
     * 旧上限 20 / 40 秒都在并发满载时误报过「触发接线断了」:渲染任务会把首轮
     * 周期挤晚。给足 80 秒,同时按 kind 精确找卷,避免另一扇机缘先出现时
     * `.modal-panel:last()` 把要量的事件顶掉。
     */
    for (let i = 0; i < 160 && [...requiredKinds].some((kind) => !seen.has(kind)); i += 1) {
      await page.waitForTimeout(500);
      const info = await page.evaluate(
        (seenKinds) => {
          const seen = new Set(seenKinds);
          const scroll = [...document.querySelectorAll("[data-opportunity-scroll]")]
            .reverse()
            .find((candidate) => {
              const kind = candidate.getAttribute("data-opportunity-kind");
              return kind && !seen.has(kind);
            });
          const panel = scroll?.closest(".modal-panel");
          if (!scroll || !panel) return null;
          return {
            kind: scroll.getAttribute("data-opportunity-kind"),
            title:
              (panel.querySelector("[data-opportunity-title]")?.textContent || "").trim() ||
              "(无标题)",
            label: panel.getAttribute("aria-label"),
            role: panel.getAttribute("role"),
            scrollCount: panel.querySelectorAll("[data-opportunity-scroll]").length,
            choiceCount: panel.querySelectorAll("[data-opportunity-choice]").length,
            effectCount: panel.querySelectorAll("[data-opportunity-effect]").length,
            timer: (panel.querySelector("[data-opportunity-timer]")?.textContent || "").trim(),
            hasLeave: !!panel.querySelector("[data-opportunity-leave]"),
            controls: [...panel.querySelectorAll("button, a, [role=button]")]
              .map((el) => {
                const r = el.getBoundingClientRect();
                const declared = parseFloat(getComputedStyle(el).minHeight);
                return {
                  name: (el.getAttribute("aria-label") || el.textContent || "")
                    .trim()
                    .replace(/\s+/g, " ")
                    .slice(0, 14),
                  h: Math.round(r.height * 10) / 10,
                  // 与巡页那条同一把尺子(见第四十三条)
                  ok: r.height >= 28 || (declared >= 28 && r.height >= 27.5),
                };
              })
              .filter((c) => c.h > 0),
          };
        },
        [...seen.keys()],
      );
      if (info?.kind && !seen.has(info.kind)) {
        seen.set(info.kind, info);
        const eventScroll = page.locator(
          `[data-opportunity-scroll][data-opportunity-kind="${info.kind}"]`,
        );
        /*
         * 顿悟与洞府巡游也只在概率掷中时出现 —— 巡页与缩放档都碰不到它们。
         * 洞府巡游里那几行选项与代价正是 195 宽上最容易折的,故在收卷之前量一遍。
         */
        zoomSeen += 1;
        const evZoom = dialogZoomProblems(
          await measureDialogZoom(
            page,
            { width: 375, height: 812 },
            `[data-opportunity-scroll][data-opportunity-kind="${info.kind}"]`,
          ),
        );
        if (evZoom.length)
          failures.push(`[375] 「${info.title}」在 200% 下坏了:${evZoom.join(" / ")}`);
        /*
         * 机缘卷刻意不响应 Esc/背板:舍签必须由卷尾写明后果的动作落定。
         * 这里先按一次 Esc,证明卷不会被静默收走,再点「舍此机缘/离开」。
         */
        await page.keyboard.press("Escape");
        await page.waitForTimeout(250);
        const stillOpen = await eventScroll.isVisible().catch(() => false);
        if (!stillOpen)
          failures.push(`[375] 「${info.title}」被 Esc 静默收走 —— 舍签必须是显式动作`);
        await eventScroll
          .locator("[data-opportunity-leave]")
          .click({ timeout: 3000 })
          .catch(() => {});
        await eventScroll.waitFor({ state: "detached", timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(400);
      }
    }
    checked += 1;
    const missingKinds = [...requiredKinds].filter((kind) => !seen.has(kind));
    if (missingKinds.length)
      failures.push(
        `[375] 引擎事件场景:概率钉成必中之后,缺少 ${missingKinds.join(" / ")} 两类机缘(触发接线断了?)`,
      );
    for (const info of seen.values()) {
      const title = info.title;
      if (info.role !== "dialog")
        failures.push(`[375] 「${title}」没有 dialog 语义(role=${info.role})`);
      if (!info.label) failures.push(`[375] 「${title}」没有可访问名`);
      if (info.scrollCount !== 1)
        failures.push(`[375] 「${title}」应恰好有一张机缘卷,实得 ${info.scrollCount}`);
      if (info.choiceCount !== 3)
        failures.push(`[375] 「${title}」应摊开 3 签,实得 ${info.choiceCount}`);
      if (info.effectCount !== 3)
        failures.push(`[375] 「${title}」应逐签写明得失,实得 ${info.effectCount}`);
      if (!info.timer) failures.push(`[375] 「${title}」没有剩余时机读数`);
      if (!info.hasLeave) failures.push(`[375] 「${title}」没有显式舍签动作`);
      const bad = info.controls.filter((c) => !c.name || !c.ok);
      if (bad.length)
        failures.push(
          `[375] 「${title}」里有 ${bad.length} 个控件不合格:${bad.map((c) => `${c.h}px «${c.name || "无名"}»`).join(" | ")}`,
        );
    }
    if (pageErrors.length)
      failures.push(`[375] 引擎事件场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
    await page.close();
  }

  return { failures, checked, contrastFails, pixelContrastFails, zoomFails };
}

/** 冷启动落在子页的返回 */
async function taskColdStartBack() {
  const failures = [];
  let checked = 0;
  const contrastFails = [];
  const pixelContrastFails = [];
  const zoomFails = [];
  // ---- 第九件事:冷启动落在子页时,「返回」不该把人送出游戏 ----
  /*
   * 书签、外部 deep link、PWA 冷启动恢复上次路由,都会让**第一次**导航就落在
   * 子页上;此时站内没有上一页,裸 router.back() 会退到 about:blank ——
   * 实测整个界面连同这一局的上下文一起消失,而玩家只觉得「点了一下返回,游戏没了」。
   * 复现要用同一 context 里新开的一页:它共享存档(localStorage),但历史是全新的。
   */
  {
    const ctx = await auditContext({ viewport: { width: 375, height: 812 } });
    const boot = await ctx.newPage();
    await boot.goto(INDEX, { waitUntil: "load" });
    await boot
      .getByRole("button", { name: /启封入山/ })
      .first()
      .click();
    await boot.locator("input[type=checkbox]").first().check();
    await boot
      .getByRole("button", { name: /署印入山/ })
      .first()
      .click();
    await boot.waitForTimeout(3200);
    await boot.locator("input:not([type=file]):not([type=checkbox])").first().fill("返回自检");
    await boot
      .getByRole("button", { name: /踏\s*入\s*仙\s*途/ })
      .first()
      .click();
    await boot.waitForTimeout(1200);
    await boot.close();

    const page = await ctx.newPage();
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    // 这一页的第一次导航就是子页 —— 正是冷启动的处境
    await page.goto(INDEX + "#/dongfu", { waitUntil: "load" });
    await page.waitForTimeout(1800);
    // 同上:别让随机浮上来的引擎事件挡住「返回」
    await clearOverlays(page);
    checked += 1;
    const coldBack = await page.evaluate(() => ({
      back: (window.history.state || {}).back ?? null,
      hasBack: !!document.querySelector("main button"),
    }));
    if (coldBack.back)
      failures.push(
        `[375] 冷启动场景:第一次导航就落在子页,history.state.back 竟是 ${coldBack.back}(复现条件没搭对)`,
      );
    const backBtn = page.locator("main button", { hasText: /返\s*回/ }).first();
    if ((await backBtn.count()) === 0) {
      failures.push("[375] 冷启动场景:子页上没有「返回」入口,判据没跑到东西");
    } else {
      await backBtn.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(900);
      const after = await page.evaluate(() => ({
        hash: location.hash,
        alive: !!document.querySelector("#app")?.firstElementChild,
      }));
      if (!after.alive) failures.push("[375] 冷启动场景:点「返回」把游戏退出了(界面没了,退到站外)");
      else if (after.hash !== "#/" && after.hash !== "")
        failures.push(`[375] 冷启动场景:点「返回」落在 ${after.hash},父页应是 #/`);
    }
    if (pageErrors.length)
      failures.push(`[375] 冷启动场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
    await ctx.close();
  }

  return { failures, checked, contrastFails, pixelContrastFails, zoomFails };
}

/** 后期档逐页复核 */
async function taskLateTour() {
  const failures = [];
  let checked = 0;
  const contrastFails = [];
  const pixelContrastFails = [];
  const zoomFails = [];
  // ---- 第十件事:后期档的逐页复核(空档量不出长数字与满屏内容) ----
  /*
   * 前面九件事量的是「刚建号」那一份空档。可同一个页面在神人境是另一副样子:
   * 数字长到九位数、法宝两件、器魂、在途秘境、以及隔夜归来时的「归来卷轴」。
   * 那一屏玩家每隔几天就会见一次,却从来没有被无头浏览器画出来过。
   * 故这里用一份自检夹具(存档密钥就写在包里,见 utils/crypto 的注释:并非安全边界),
   * 走一遍后期档:先核归来卷轴,再逐页过同一把尺子。
   */
  {
    const ctx = await auditContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    });
    const enc = encryptSlice;
    const gn = (m, e) => ({ m, e });
    const slices = {
      game: {
        started: true,
        saveVersion: 2,
        createdAt: Date.now() - 86400000 * 30,
        lastActiveAt: Date.now() - 9 * 3600000,
        totalPlaySec: 0,
        createRerolls: 8,
        createProfile: null,
      },
      player: {
        major: 14,
        sub: 0,
        exp: gn(3, 9),
        age: 3000,
        lifespanBonusYears: 0,
        dead: false,
        reincarnation: {
          count: 2,
          daoFruit: 12,
          talents: [],
          insight: 400,
          lives: [],
          vow: null,
          trial: null,
          bonds: [],
        },
        /*
         * 五系杂灵根:灵根行最挤的一档(名字 + 五个圆环 + ×倍率)。
         * 空档抽到「双灵根」时不挤,「杂灵根」被压成竖排的事故就靠运气才撞得到 ——
         * 这里钉死最挤的一份,让那个人物页状态每次都被量。
         */
        linggen: {
          roots: [
            { element: "fire", aptitude: 42 },
            { element: "water", aptitude: 38 },
            { element: "wood", aptitude: 51 },
            { element: "metal", aptitude: 33 },
            { element: "earth", aptitude: 29 },
          ],
          gradeName: "杂灵根",
          growthMult: 0.85,
        },
        /*
         * 镇压三态都要在夹具里出现 —— 此前夹具一个镇压区域都没有,
         * 于是「自动产出」那条长信息把地界名挤成竖排的事故,这脚本从来没量过(玩家先看到的)。
         * qingyun 守了 7 小时(稳定)、wanyao 守到 71 小时(倒计时转红)、guzhanchang 守满一日(繁盛)。
         */
        suppressedRegions: ["qingyun", "wanyao", "guzhanchang"],
        suppressQualified: ["qingyun", "wanyao", "guzhanchang", "heifeng"],
        suppressedSince: {
          qingyun: Date.now() - 7 * 3600000,
          wanyao: Date.now() - 71 * 3600000,
          guzhanchang: Date.now() - 30 * 3600000,
        },
        regionStats: {
          qingyun: {
            totalFights: 40,
            avgRounds: 2.1,
            avgDamageTakenPct: 0.05,
            consecutiveWins: 9,
            lastUpdateAt: Date.now() - 3600000,
          },
          wanyao: {
            totalFights: 60,
            avgRounds: 2.4,
            avgDamageTakenPct: 0.06,
            consecutiveWins: 4,
            lastUpdateAt: Date.now() - 3600000,
          },
          guzhanchang: {
            totalFights: 55,
            avgRounds: 2.8,
            avgDamageTakenPct: 0.09,
            consecutiveWins: 3,
            lastUpdateAt: Date.now() - 3600000,
          },
          // 黑风林:已取得镇压资格但当前仍在历练态(「转为镇压收益」那条要画出来)
          heifeng: {
            totalFights: 14,
            avgRounds: 3.9,
            avgDamageTakenPct: 0.18,
            consecutiveWins: 2,
            lastUpdateAt: Date.now() - 600000,
          },
        },
        // 在途秘境:归来卷轴要说「原样留着」,历练页也要画出「在境中」那一版
        secretRealm: {
          realmId: "sr_kurong",
          enteredAt: Date.now() - 600000,
          layer: 2,
          wins: 1,
          losses: 0,
          spoils: ["灵石少许"],
          rules: ["治疗减半"],
          carriedHpPct: 0.7,
          finished: false,
        },
      },
      resources: {
        spiritStone: gn(9, 12),
        qi: 5000,
        wudao: 800,
        herb: 900,
        ore: 900,
        page: 300,
        dust: 500,
      },
      inventory: {
        items: [
          {
            uid: "late_w",
            templateId: "w_zidian",
            quality: "heaven",
            tier: 20,
            level: 0,
            affixes: [{ id: "bs3", roll: 1 }],
          },
          {
            uid: "late_a",
            templateId: "b_xingluo",
            quality: "heaven",
            tier: 20,
            level: 0,
            affixes: [{ id: "low2", roll: 1 }],
          },
        ],
        equipped: { weapon: "late_w", body: "late_a" },
        pills: { p_jvqidan: 5, p_huichun: 3 },
        artifacts: [
          { defId: "af_qinglian", level: 3 },
          { defId: "af_wuxiangzhu", level: 2 },
        ],
        equippedArtifacts: ["af_qinglian", "af_wuxiangzhu"],
      },
      endgame: {
        daoPath: "sword",
        daoSource: 1200,
        /*
         * 两缕只装一缕 —— 空槽那枚「装配」入口要在**有闲置形意**时才画得出来。
         * 夹具若把两缕都装上,它在 188 页 × 视口那一遍里一次都不存在,判据量不到
         * 就等于没量(与 data-value-row 的活信号同一道理)。
         */
        souls: [
          { uid: "late_s1", type: "fengmang", grade: 1, fromName: "旧剑" },
          { uid: "late_s2", type: "beishui", grade: 3, fromName: "残戟" },
        ],
        equippedSouls: ["late_s1"],
        // 在途远征:归来卷轴要说「原样留着」,天界页也要画出「走到第二重」那一版
        worldRun: {
          worldId: "chiyan",
          pactId: null,
          gateId: null,
          layer: 1,
          bonus: 12,
          rows: [{ foeName: "焰魄", win: true, rounds: 7, hpLeftPct: 0.62 }],
          carriedHpPct: 0.62,
          totalRounds: 7,
          winStacks: 1,
        },
      },
      // 地界表:解锁到黑风林一带,好让「镇压中 / 已取得资格」两种卡片都渲染出来
      adventure: {
        unlocked: ["qingyun", "luoxia", "heifeng", "wanyao", "cangwu", "guzhanchang"],
        // luoxia 不在 cleared 里 —— 它已「妖气复聚」,旧主归来(见下一行的 revived)
        cleared: ["qingyun", "heifeng", "wanyao"],
        /*
         * 妖气复聚那一行(见 core/regionRevival):旧主归来、此地处不再「已靖」。
         * 它要进夹具,是因为它是这条设计唯一的可见面 —— 而「名字 + 已靖/复聚标签 +
         * 简介 + 该怎么办」正是这一行最挤的一档,窄屏上最容易把字挤成竖排。
         */
        revived: ["luoxia"],
        mortalCleared: [],
        /*
         * 留一程只有一分钟、且带待决际遇的历练:离线结算会在归零前把它自动收掉，
         * 让归来卷轴真画出新增的「际遇结果」块 —— 只写 session:null 的话，这块永远量不到。
         */
        session: {
          regionId: "qingyun",
          mode: "normal",
          startedAt: Date.now() - 9 * 3600000,
          endsAt: Date.now() - 9 * 3600000 + 60000,
          nextBattleAt: Date.now() - 9 * 3600000 + 12000,
          wins: 0,
          losses: 0,
          events: 0,
          stoneGain: gn(0, 0),
          expGain: gn(0, 0),
          itemGain: 0,
          wudaoGain: 0,
        },
        pendingEventId: "ev_rescue_disciple",
        pendingEventSince: Date.now() - 9 * 3600000,
        seenOnceEvents: [],
        lastBattle: null,
        eventMemories: {},
      },
      /*
       * 洞府等级:升级按钮上的代价是「数 + 量词」(2,798 石 · 50 铁),
       * 空档只有「200 石 20 铁」这种短数字,量不出「数字与量词被换行拆开」那条判据。
       */
      dongfu: {
        levels: { mansion: 4, field: 5, alchemy: 5, forge: 4, library: 4 },
        offlineCapHours: 24,
      },
      settings: {
        privacyAccepted: true,
        sfxOn: false,
        musicOn: false,
        musicVol: 0,
        sfxVol: 0,
        reduceMotion: true,
        battleSpeed: 4,
        decomposeRanks: [],
        smartKeep: { enabled: true, minQuality: 3, keepCoreAffix: true, keepComboPiece: true },
        theme: "dark",
      },
    };
    // 夹具 payload 只做一次,后面 320 那一遍复用;播种加闸(见第十四件事的坑)
    const latePayload = Object.fromEntries(
      Object.entries(slices).map(([k, v]) => [`${SAVE_PREFIX}${k}`, enc(v)]),
    );
    await ctx.addInitScript((decisivePayload) => {
      /*
       * 事件后果也是随机掷的。这里必须赶在应用模块初始化前钉死:
       * RandomService 构造时已经把 Math.random 的函数引用收走,页面起来后再改
       * 不影响它。否则「遇袭的弟子」有 35% 落到重伤分支,丹药回执这条判据会偶发假红。
       */
      Math.random = () => 0;
      if (localStorage.getItem("__layoutSeeded")) return;
      for (const [k, v] of Object.entries(decisivePayload)) localStorage.setItem(k, v);
      localStorage.setItem("__layoutSeeded", "1");
    }, latePayload);
    const page = await ctx.newPage();
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    await page.goto(INDEX, { waitUntil: "load" });
    await page.waitForTimeout(2600);

    // (一)隔夜归来第一眼:数字不许漏 NaN,收下之后要真的关掉
    checked += 1;
    const offline = await page.evaluate(() => {
      const panel = document.querySelector(".modal-panel");
      if (!panel) return null;
      const text = panel.innerText || "";
      return {
        label: panel.getAttribute("aria-label"),
        text: text.slice(0, 200),
        leaks: /NaN|undefined|Infinity/.test(text),
        rows: text.split("\n").filter((l) => l.includes("+")).length,
        hasEventReceipts: text.includes("际遇结果"),
        hasPillReceipt: /丹药「.+」×2/.test(text),
      };
    });
    if (!offline) {
      failures.push("[390] 后期档:隔夜 9 小时开局,「归来卷轴」没有弹出来");
    } else {
      if (!offline.label) failures.push("[390] 后期档:归来卷轴没有可访问名");
      if (offline.leaks)
        failures.push(`[390] 后期档:归来卷轴漏出占位符 —— ${offline.text.slice(0, 60)}`);
      if (offline.rows === 0) failures.push("[390] 后期档:归来卷轴一条收益都没列");
      if (!offline.hasEventReceipts)
        failures.push("[390] 后期档:自动际遇结算了,归来卷轴却没有「际遇结果」");
      if (!offline.hasPillReceipt)
        failures.push("[390] 后期档:际遇给了丹药,归来卷轴却认不出得了什么");
      /*
       * 卷轴本身也要过 200% 那一档。
       *
       * 它是**玩家每几天就见一次**的那一屏,而它只在开局弹一次 —— 主巡页与缩放档
       * 那一遍都碰不到它(巡页前先 clearOverlays 收掉了)。390 上量到的读数一分不代表
       * 195:实测面板内宽只剩 113px,「修为」与「+46.39兆」并排时各自折成两行。
       * 故在收下之前把视口压到 195 量一遍,量完还原。
       */
      zoomSeen += 1;
      const scrollZoom = dialogZoomProblems(
        await measureDialogZoom(page, { width: 390, height: 844 }),
      );
      if (scrollZoom.length)
        failures.push(`[390-late] 归来卷轴在 200% 下坏了:${scrollZoom.join(" / ")}`);
      const take = page.locator(".modal-panel button", { hasText: /收\s*下/ }).first();
      if ((await take.count()) === 0) failures.push("[390] 后期档:归来卷轴没有「收下」");
      else {
        await take.click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(700);
        if (await page.locator(".modal-panel").count())
          failures.push("[390] 后期档:点了「收下」归来卷轴没关掉");
      }
    }

    // (二)后期档逐页:与空档同一把尺子
    await page.evaluate(() => {
      for (const b of document.querySelectorAll(".pointer-events-none.fixed button")) b.click();
      Math.random = () => 1;
    });
    await page.waitForTimeout(400);
    for (const route of [
      "/",
      "/cultivation",
      "/adventure",
      "/inventory",
      "/character",
      "/celestial",
      "/souls",
      "/collection",
      "/build",
      "/dongfu",
    ]) {
      const rendered = await openRoute(page, route, 700);
      const info = await measurePage(page);
      checked += 1;
      if (rendered === 0) {
        failures.push(`[390-late] ${route} 页面没渲染出来 —— 这一页其实没量到`);
      }
      const problems = problemsOf(info);
      if (problems.length) failures.push(`[390-late] ${route} → ${problems.join(" / ")}`);
      /*
       * 首屏重复也要在**深档**这一遍判:巡页那一遍跑的是刚建号的档,首屏内容浅,
       * 好几处只在满档下才进首屏。这一遍用的是 showcase 存档 —— 实测「第 10 / 21 境」
       * 在修炼页首屏出现三处(top 176 / 270 / 461),那一遍量到、巡页那遍量不到。
       */
      /*
       * 允许清单为空是**结果**,不是遗漏:判据跑通后,深档这一遍的首屏重复已被清零
       * (周天盘内圈那枚界序号与卷首 meta 重复,已删)。将来若某处确实该重复,
       * 在这里加一行并写明理由 —— 理由比条目重要。
       */
      const lateRepeats = new Set();
      for (const line of info.repeatedShortLines ?? []) {
        if (lateRepeats.has(line)) continue;
        failures.push(
          `[390-late] ${route} 首屏把同一句说了两遍:«${line}» —— 该合并,或加进允许清单并写明理由`,
        );
      }
      const rail = await measureTabRail(page);
      const railFails = railProblems(rail);
      if (rail) checked += 1;
      if (railFails.length) failures.push(`[390-late] ${route} → ${railFails.join(" / ")}`);
      if (SHOTS) {
        await clearOverlays(page);
        const acknowledgment = page
          .locator(".modal-panel button")
          .filter({ hasText: /^知道了$/ })
          .last();
        if ((await acknowledgment.count()) > 0) {
          await acknowledgment.click({ timeout: 1500 }).catch(() => {});
          await settleVisuals(page);
        }
        mkdirSync(SHOTS_DIR, { recursive: true });
        await page.screenshot({
          path: join(SHOTS_DIR, `390-late${route.replace(/\//g, "_")}.png`),
          fullPage: true,
        });
      }
    }

    /*
     * 妖气复聚那一行得真画出来,而且得说清"该怎么办"。
     *
     * 夹具里备着一处复聚的旧地界(luoxia)。这条判据存在的理由与「已靖」不同:
     * 已靖是安静的状态,复聚是**要玩家动手的状态** —— 只写「妖气复聚」而不写
     * 「再历一程即可复靖」,玩家看到的就是一处忽然变回锁着的地界(实测过同类抱怨)。
     */
    await page.goto(INDEX + "#/adventure", { waitUntil: "load" });
    await page.waitForTimeout(700);
    checked += 1;
    const reviveCard = await page.evaluate(() => {
      const card = [...document.querySelectorAll("[data-region-card]")].find((c) =>
        (c.innerText || "").includes("妖气复聚"),
      );
      return { found: Boolean(card), text: (card?.innerText || "").replace(/\s+/g, " ") };
    });
    if (!reviveCard.found) {
      failures.push("[390-late] 历练页:夹具里那处妖气复聚的旧地界没画出「妖气复聚」");
    } else {
      if (!reviveCard.text.includes("再历一程即可复靖")) {
        failures.push(
          "[390-late] 历练页:复聚那一行只说了「妖气复聚」,没说该怎么办(再历一程即可复靖)",
        );
      }
      if (!/出发/.test(reviveCard.text))
        failures.push("[390-late] 历练页:复聚的地界没有「出发」入口 —— 旧主回来却进不去");
    }

    /*
     * (三)在途秘境要真的推得动。
     *
     * 秘境这一整套此前只在单元用例里跑过 —— 界面上「再入一层」按下去会怎样,
     * 从没有人看过:点了没反应、刷不出战报、数字漏 NaN,都会静静留在这里。
     * 夹具身上带着一趟打到第二层的秘境,故这里真点一次:要么浮出战报,
     * 要么卡片状态前移(层数/败次/探尽),两者必有其一。
     */
    await page.goto(INDEX + "#" + "/adventure", { waitUntil: "load" });
    await page.waitForTimeout(800);
    checked += 1;
    const beforeText = await page.evaluate(() => document.querySelector("main")?.innerText || "");
    const fightAgain = page.locator("main button", { hasText: /再\s*入\s*一\s*层/ }).first();
    if ((await fightAgain.count()) === 0) {
      failures.push("[390-late] 历练页:在途秘境没有「再入一层」入口 —— 夹具的秘境没被读出来?");
    } else {
      await fightAgain.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(900);
      const after = await page.evaluate(() => ({
        text: document.querySelector("main")?.innerText || "",
        toasts: [...document.querySelectorAll(".pointer-events-none.fixed button")].map((b) =>
          (b.textContent || "").trim(),
        ),
      }));
      if (after.toasts.length === 0 && after.text === beforeText) {
        failures.push("[390-late] 历练页:点了「再入一层」既没战报也没变化(点了没反应)");
      }
      if (/NaN|undefined/.test(after.text + after.toasts.join(" ")))
        failures.push("[390-late] 历练页:秘境推进后漏出占位符");
      console.log(
        `  在途秘境推进一步:${after.toasts.length ? `战报「${after.toasts[0]?.slice(0, 26)}」` : "卡片状态前移"}` +
          `${after.toasts.length > 1 ? ` 等 ${after.toasts.length} 条` : ""}`,
      );
    }
    if (pageErrors.length)
      failures.push(`[390] 后期档页面异常:${[...new Set(pageErrors)].join(" | ")}`);

    /*
     * (四)在途远征也要真的走得动。
     *
     * 与秘境同理:远征这一套只在单元用例里跑过,界面上「第 N 重择路」按下去会怎样,
     * 从没有人看过。夹具身上带着一趟打到第二重的赤炎天远征(天界页会直接开在远征册上),
     * 故这里真点一次择路:要么浮出战报、要么行程点列前移,并查占位符与页面异常。
     */
    await page.goto(INDEX + "#" + "/celestial", { waitUntil: "load" });
    await page.waitForTimeout(900);
    checked += 1;
    const runBefore = await page.evaluate(() => document.querySelector("main")?.innerText || "");
    /*
     * 入口怎么认:两条路各自的按钮上写着「道源 +N」(层号那行是独立的文本,不在按钮里);
     * 若这一趟已经走到界主,入口换成「决战」。两者必有其一 —— 都找不到就是真没入口。
     */
    const pickNode = page.locator("main button", { hasText: /道源 \+\d+/ }).first();
    const runEntry =
      (await pickNode.count()) > 0
        ? pickNode
        : page.locator("main button", { hasText: /决\s*战/ }).first();
    const runShown = await page.evaluate(() => {
      const chapter = document.querySelector("[data-celestial-run]");
      const fact = chapter?.querySelector(".folio-chapter-head__fact");
      return {
        found: Boolean(chapter),
        empty: Boolean(chapter?.querySelector("[data-celestial-run-empty]")),
        fact: (fact?.textContent || "").trim(),
      };
    });
    if (!runShown.found || runShown.empty || !runShown.fact.includes("赤炎天")) {
      failures.push(`[390-late] 天界页:在途远征没有按章首真值渲染:${JSON.stringify(runShown)}`);
    } else if ((await runEntry.count()) === 0) {
      failures.push("[390-late] 天界页:在途远征没有可推进一步的入口(既无择路也无决战)");
    } else {
      const clicked = ((await runEntry.textContent()) || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 18);
      await runEntry.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(900);
      const after = await page.evaluate(() => ({
        text: document.querySelector("main")?.innerText || "",
        toasts: [...document.querySelectorAll(".pointer-events-none.fixed button")].map((b) =>
          (b.textContent || "").trim(),
        ),
        // 打输会开战报弹窗(赢了只是行程点列前移,不开弹窗)
        report: (document.querySelector(".modal-panel h3")?.textContent || "").trim(),
      }));
      if (!after.report && after.toasts.length === 0 && after.text === runBefore) {
        failures.push("[390-late] 天界页:点了远征的推进入口既没战报也没变化(点了没反应)");
      }
      /*
       * 开出来的战报必须**叫得出这一界**:标题得在动手前取。
       * 从前先打后读 runWorld,而收尾那一场会把 worldRun 清空,标题就退成「远征」。
       */
      if (after.report && after.report !== "赤炎天") {
        failures.push(
          `[390-late] 天界页:远征战报弹窗标题是「${after.report}」,应为这一界的名字(赤炎天)`,
        );
      }
      if (/NaN|undefined/.test(after.text + after.toasts.join(" ") + after.report))
        failures.push("[390-late] 天界页:远征推进一步后漏出占位符");
      console.log(
        `  在途远征推进一步(点了「${clicked}」):` +
          (after.report
            ? `战报弹窗「${after.report}」`
            : after.toasts.length
              ? `战报「${after.toasts[0]?.slice(0, 24)}」`
              : "行程点列前移"),
      );
    }
    if (pageErrors.length)
      failures.push(`[390] 后期档页面异常(远征):${[...new Set(pageErrors)].join(" | ")}`);

    /*
     * (四续)天道试炼:第三条终局产线,同样只在单元用例里跑过。
     * 切到「试炼」册,真按一次应试,要求开出战报、且写清止步/功成与赏格、不漏占位符。
     */
    await page.goto(INDEX + "#" + "/celestial", { waitUntil: "load" });
    await page.waitForTimeout(900);
    // 上一步的远征战报还开着(它是一层遮罩),先收掉再切册 —— 否则点不动、还查不出原因
    const leftover = await clearOverlays(page);
    if (leftover.length)
      failures.push(`[390-late] 天界页:切试炼册前还开着浮层 —— ${leftover.join("、")}`);
    const trialTab = page.getByRole("tab", { name: /试\s*炼/ }).first();
    if ((await trialTab.count()) === 0) failures.push("[390-late] 天界页:找不到「试炼」册");
    else {
      await trialTab.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(500);
      checked += 1;
      const trialBtn = page.locator("main button", { hasText: /应\s*试/ }).first();
      if ((await trialBtn.count()) === 0)
        failures.push("[390-late] 试炼册里没有「应试」入口(判据没跑到东西)");
      else {
        const trialName = ((await trialBtn.textContent()) || "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 20);
        await trialBtn.click({ timeout: 4000 }).catch(() => {});
        await page.waitForTimeout(2200);
        const after = await page.evaluate(() => {
          const panel = document.querySelector(".modal-panel");
          const text = panel?.innerText || "";
          return {
            title: (panel?.querySelector("h3")?.textContent || "").trim(),
            text: text.replace(/\n+/g, " ").slice(0, 90),
            rows: panel ? panel.querySelectorAll("p, li").length : 0,
            leaks: /NaN|undefined|Infinity/.test(text),
          };
        });
        if (!after.title) failures.push(`[390-late] 试炼:点了「${trialName}」没有开出战报`);
        else {
          // 战报的两种口径:全捷(打通)或止步第 N 战
          if (!/全捷|止步第/.test(after.text))
            failures.push(`[390-late] 试炼:战报没写清结果 —— ${after.text}`);
          if (after.leaks) failures.push("[390-late] 试炼:战报漏出占位符");
          console.log(
            `  天道试炼(点了「${trialName}」):战报「${after.title}」· ${after.text.slice(0, 34)}…`,
          );
          await page.keyboard.press("Escape");
          await page.waitForTimeout(400);
        }
      }
    }
    if (pageErrors.length)
      failures.push(`[390] 后期档页面异常(试炼):${[...new Set(pageErrors)].join(" | ")}`);
    await ctx.close();

    /*
     * (五)同一份后期档在 320 窄屏再过一遍。
     *
     * 主巡页在 320 量的是刚建号的空档(数字短、内容少);「长数字 + 满屏内容 + 最窄屏」
     * 这个组合此前没量过,而这正是最容易撑破的地方(实测当前全绿,故这一条是防回归)。
     */
    {
      const narrow = await auditContext({
        viewport: { width: 320, height: 568 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      });
      await narrow.addInitScript((decisivePayload) => {
        if (localStorage.getItem("__layoutSeeded")) return;
        for (const [k, v] of Object.entries(decisivePayload)) localStorage.setItem(k, v);
        localStorage.setItem("__layoutSeeded", "1");
      }, latePayload);
      const p = await narrow.newPage();
      const errs = [];
      watchPageErrors(p, errs);
      await p.goto(INDEX, { waitUntil: "load" });
      await p.waitForTimeout(2400);
      await clearOverlays(p);
      /*
       * 归来卷轴是 :closable="false" 的 —— clearOverlays 按 Esc 关不掉它。
       *
       * 这份夹具的 lastActiveAt 在 9 小时前,所以**每个**新 context 一开都会弹它。
       * 390 那一遍在开头点了「收下」,320 这一遍从前没点:于是整轮巡页都隔着一层
       * 遮罩在量,量到的是卷轴自己(它的行在 195 宽下把「回收化尘」挤成竖排),
       * 页面本体一次都没被量到。判据绿得毫无信息,比红更糟。
       */
      const dismiss = p.locator(".modal-panel button", { hasText: /收\s*下/ }).first();
      if ((await dismiss.count()) > 0) {
        await dismiss.click({ timeout: 3000 }).catch(() => {});
        await p.waitForTimeout(500);
      }
      if ((await p.locator(".modal-panel").count()) > 0) {
        const title = await p.evaluate(
          () => document.querySelector(".modal-panel")?.getAttribute("aria-label") ?? "?",
        );
        failures.push(`[320-late] 开局浮层没关掉(「${title}」)—— 这一轮量的不是页面本体`);
      }
      for (const route of ROUTES) {
        const rendered = await openRoute(p, route, 600);
        const info = await measurePage(p);
        checked += 1;
        if (rendered === 0) {
          failures.push(`[320-late] ${route} 页面没渲染出来 —— 这一页其实没量到`);
        }
        const problems = problemsOf(info);
        if (problems.length) failures.push(`[320-late] ${route} → ${problems.join(" / ")}`);
      }
      if (errs.length) failures.push(`[320] 后期档页面异常:${[...new Set(errs)].join(" | ")}`);
      /*
       * 同一份后期档再过一遍 200% 缩放档。
       *
       * 主巡页那一遍量的是**空档**:数字短、内容少。而 195 CSS px 上最容易出事的是
       * 「长数字 + 满屏内容」—— 神人境的九位数灵石、成套装备、在途秘境,全挤在
       * 195 宽里。这与 320 那一遍是同一个理由(空档量不出满屏内容),只是那一遍的
       * 视口还没窄到 195。两遍共用同一把尺子(measurePage + zoomProblems)。
       *
       * 放在 320 那一遍之后:这一遍会把视口改成 390 再折半(195),量完 context 即关。
       */
      for (const route of ROUTES) {
        const rendered = await openRoute(p, route, 600);
        const zoom = await measureZoomScale(p, { width: 390, height: 844 });
        zoomSeen += 1;
        if (rendered === 0) {
          zoomFails.push(`[390-late] ${route} → 页面没渲染出来,缩放档其实没量到`);
        }
        const zoomBad = zoomProblems(zoom, "390");
        if (zoomBad.length) zoomFails.push(`[390-late] ${route} → ${zoomBad.join(" / ")}`);
      }
      await narrow.close();
    }
  }

  if (zoomFails.length) failures.push(`200% 缩放档上版面坏了(后期档):${zoomFails.join(" | ")}`);
  return { failures, checked, contrastFails, pixelContrastFails, zoomFails };
}

/** 渡劫突破真打一次 */
async function taskTribulation() {
  const failures = [];
  let checked = 0;
  const contrastFails = [];
  const pixelContrastFails = [];
  const zoomFails = [];
  // ---- 第十一件事:渡劫突破真打一次(一局里最要紧的那一屏,此前没人画过) ----
  /*
   * 突破结果弹窗(成功/失败、渡劫雷数与「寿元增至」那一行)是每个玩家都会反复看的屏,
   * 而它从来没被无头浏览器渲染过 —— 空档修为不满,按钮是灰的;后期档又未必卡在大关上。
   * 故另起一份「炼气圆满」的夹具:修为与灵气给足、寿元留够,点「引 劫 突 破」真打一次。
   * 渡劫成不成是随机的,故判据只看**形状**:必须开出结果弹窗,写清成败与境界去向,
   * 失败不许漏占位符,成功要与页面上的境界对得上。
   */
  {
    const ctx = await auditContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    });
    const enc = encryptSlice;
    const gn = (m, e) => ({ m, e });
    const slices = {
      game: {
        started: true,
        saveVersion: 2,
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
        totalPlaySec: 0,
        createRerolls: 8,
        createProfile: null,
      },
      // 炼气·圆满(大关)+ 修为灵气给足 + 寿元留够(寿元已尽会被「寿元将尽」截住)
      player: {
        major: 0,
        sub: 9,
        exp: gn(9, 30),
        age: 16,
        lifespanBonusYears: 0,
        dead: false,
        reincarnation: {
          count: 0,
          daoFruit: 0,
          talents: [],
          insight: 30,
          lives: [],
          vow: null,
          trial: null,
          bonds: [],
        },
        linggen: {
          roots: [{ element: "fire", aptitude: 90 }],
          gradeName: "单灵根",
          growthMult: 1.2,
        },
      },
      resources: {
        spiritStone: gn(3, 6),
        qi: 9999999,
        wudao: 300,
        herb: 400,
        ore: 400,
        page: 90,
        dust: 120,
      },
      inventory: { items: [], equipped: {}, pills: {}, artifacts: [], equippedArtifacts: [] },
      endgame: { daoPath: null, daoSource: 0, souls: [], equippedSouls: [] },
      settings: {
        privacyAccepted: true,
        sfxOn: false,
        musicOn: false,
        musicVol: 0,
        sfxVol: 0,
        reduceMotion: true,
        battleSpeed: 4,
        decomposeRanks: [],
        smartKeep: { enabled: true, minQuality: 3, keepCoreAffix: true, keepComboPiece: true },
        theme: "light",
      },
    };
    await ctx.addInitScript(
      (data) => {
        for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
      },
      Object.fromEntries(Object.entries(slices).map(([k, v]) => [`${SAVE_PREFIX}${k}`, enc(v)])),
    );
    const page = await ctx.newPage();
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    await page.goto(INDEX + "#" + "/cultivation", { waitUntil: "load" });
    await page.waitForTimeout(2200);
    await clearOverlays(page);
    checked += 1;
    const tribBtn = page.locator("main button", { hasText: /引\s*劫\s*突\s*破/ }).first();
    if ((await tribBtn.count()) === 0) {
      failures.push(
        "[390] 渡劫场景:修为灵气给足、卡在炼气圆满,却没出现「引劫突破」(判据没跑到东西)",
      );
    } else {
      await tribBtn.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(1600);
      const view = await page.evaluate(() => {
        // 只认**突破结果**那一扇:屏幕上可能同时浮着别的(顿悟/巡游),拿错扇就诊断错人
        const panels = [...document.querySelectorAll(".modal-panel")];
        const panel = panels.find((p) => /突破成功|突破失败/.test(p.innerText || "")) ?? null;
        const text = panel?.innerText || "";
        return {
          found: !!panel,
          // 没开出来时,把「此刻开着的到底是谁」写进报告 —— 上一次注入就是靠这句才能一眼看懂
          others: panels
            .map((p) =>
              (
                p.querySelector("h3")?.textContent ||
                p.getAttribute("aria-label") ||
                "无标题"
              ).trim(),
            )
            .join("、"),
          text,
          label: panel?.getAttribute("aria-label") ?? null,
          outcome: /突破成功/.test(text) ? "成功" : /突破失败/.test(text) ? "失败" : null,
          hasWave: /共\s*\d+\s*道/.test(text),
          // 页面上当前境界(成功之后应当已经换名)
          realm: (document.body.innerText.match(/炼气|筑基/) || [""])[0],
        };
      });
      if (!view.found)
        failures.push(
          `[390] 渡劫场景:点了「引劫突破」没有开出结果弹窗(此刻开着的是:${view.others || "无"})`,
        );
      if (view.found) {
        if (!view.outcome)
          failures.push(`[390] 渡劫场景:结果弹窗没写清成败 —— ${view.text.slice(0, 40)}`);
        if (!view.hasWave) failures.push("[390] 渡劫场景:渡劫结果里没有雷数(「共 N 道」)");
        if (/NaN|undefined|Infinity/.test(view.text))
          failures.push("[390] 渡劫场景:结果弹窗漏出占位符");
        if (view.outcome === "成功" && view.realm !== "筑基") {
          failures.push(`[390] 渡劫场景:弹窗说成功,页面上的境界却还是「${view.realm}」`);
        }
        /*
         * 这一屏也要过 200% 那一档:它只在渡劫那一刻出现,主巡页与缩放档都碰不到。
         * 突破结果里最长的是「共 N 道」那一段与逐道天雷的记述 —— 正是 195 宽上
         * 最容易折成一字一行的那一类。
         */
        zoomSeen += 1;
        const tribZoom = dialogZoomProblems(
          await measureDialogZoom(page, { width: 390, height: 844 }),
        );
        if (tribZoom.length) failures.push(`[390] 渡劫结果在 200% 下坏了:${tribZoom.join(" / ")}`);
        const close = page.locator(".modal-panel button", { hasText: /继续问道|收拾心情/ }).first();
        if ((await close.count()) === 0) failures.push("[390] 渡劫场景:结果弹窗没有收尾按钮");
        else {
          await close.click({ timeout: 3000 }).catch(() => {});
          await page.waitForTimeout(600);
          if (await page.locator(".modal-panel").count())
            failures.push("[390] 渡劫场景:点了收尾按钮弹窗没关掉");
        }
      }
      console.log(
        `\n渡劫突破:${view.outcome ?? "(没写成败)"} · 雷数${view.hasWave ? "有" : "缺"} · 页面境界 ${view.realm}`,
      );
    }
    if (pageErrors.length)
      failures.push(`[390] 渡劫场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
    await ctx.close();
  }

  return { failures, checked, contrastFails, pixelContrastFails, zoomFails };
}

/** 走完一次转世 */
async function taskReincarnation() {
  const failures = [];
  let checked = 0;
  const contrastFails = [];
  const pixelContrastFails = [];
  const zoomFails = [];
  // ---- 第十二件事:走完一次转世(往生·辞世 → 往生·回照 → 往生·择生 → 新的一世) ----
  /*
   * 转世是每一世收官的那套仪式,也是**唯一会把存档推倒重来**的流程 ——
   * 三程弹窗 + 择姿立题 + 新的一世:先辞世、再回照去留全账,末程才落子。
   * 此前一步都没被真浏览器走过。
   * 夹具把寿元写尽(一读档引擎就判定身故),然后一路点下去。
   */
  {
    const ctx = await auditContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    });
    const enc = encryptSlice;
    const gn = (m, e) => ({ m, e });
    const slices = {
      game: {
        started: true,
        saveVersion: 2,
        createdAt: Date.now() - 86400000 * 60,
        lastActiveAt: Date.now(),
        totalPlaySec: 0,
        createRerolls: 8,
        createProfile: null,
      },
      player: {
        major: 5,
        sub: 3,
        exp: gn(2, 7),
        age: 99999,
        lifespanBonusYears: 0,
        dead: false,
        reincarnation: {
          count: 1,
          daoFruit: 9,
          talents: [],
          insight: 120,
          lives: [],
          vow: null,
          trial: null,
          bonds: [],
        },
        linggen: {
          roots: [{ element: "fire", aptitude: 90 }],
          gradeName: "单灵根",
          growthMult: 1.2,
        },
      },
      resources: {
        spiritStone: gn(4, 6),
        qi: 4000,
        wudao: 500,
        herb: 300,
        ore: 300,
        page: 60,
        dust: 80,
      },
      inventory: { items: [], equipped: {}, pills: {}, artifacts: [], equippedArtifacts: [] },
      endgame: { daoPath: null, daoSource: 0, souls: [], equippedSouls: [] },
      settings: {
        privacyAccepted: true,
        sfxOn: false,
        musicOn: false,
        musicVol: 0,
        sfxVol: 0,
        reduceMotion: true,
        battleSpeed: 4,
        decomposeRanks: [],
        smartKeep: { enabled: true, minQuality: 3, keepCoreAffix: true, keepComboPiece: true },
        theme: "light",
      },
    };
    await ctx.addInitScript(
      (data) => {
        for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
      },
      Object.fromEntries(Object.entries(slices).map(([k, v]) => [`${SAVE_PREFIX}${k}`, enc(v)])),
    );
    const page = await ctx.newPage();
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    await page.goto(INDEX, { waitUntil: "load" });
    await page.waitForTimeout(2600);
    /*
     * 钉死随机源、收掉提示条 —— 但**不要**去关弹窗:这一屏正开着「往生 · 辞世」,
     * 它就是本场景的起点(而且它故意不可关)。钉随机的用意是免得引擎在转世途中
     * 掷出一个顿悟/巡游浮层,把「关没关干净」的判据搅红(实测偶发)。
     */
    await page.evaluate(() => {
      for (const b of document.querySelectorAll(".pointer-events-none.fixed button")) b.click();
      Math.random = () => 1;
    });
    await page.waitForTimeout(400);

    /** 读一扇弹窗的形状:标题、正文、按钮、有没有漏占位符 */
    const readPanel = () =>
      page.evaluate(() => {
        const p = document.querySelector(".modal-panel");
        if (!p) return null;
        return {
          title: (p.querySelector("h3")?.textContent || p.getAttribute("aria-label") || "").trim(),
          text: (p.innerText || "").replace(/\n+/g, " "),
          buttons: [...p.querySelectorAll("button")].map((b) => (b.textContent || "").trim()),
          stage: p
            .querySelector("[data-reincarnation-stage]")
            ?.getAttribute("data-reincarnation-stage"),
          stages: [...p.querySelectorAll("[data-reincarnation-stage-state]")].map((el) =>
            el.getAttribute("data-reincarnation-stage-state"),
          ),
          stageNoteLines: [...p.querySelectorAll(".reincarnation-stage__copy small")].map((el) => {
            const range = document.createRange();
            range.selectNodeContents(el);
            return new Set([...range.getClientRects()].map((rect) => Math.round(rect.top))).size;
          }),
          chapterHeads: p.querySelectorAll("[data-reincarnation-stage] .folio-chapter-head").length,
          chapterTitles: [...p.querySelectorAll(".folio-chapter-head__title")].map((el) =>
            (el.textContent || "").replace(/\s+/g, " ").trim(),
          ),
          chapterHeadDisplay: (() => {
            const head = p.querySelector("[data-reincarnation-stage] .folio-chapter-head");
            return head ? getComputedStyle(head).display : "";
          })(),
          chapterHeadColumns: (() => {
            const head = p.querySelector("[data-reincarnation-stage] .folio-chapter-head");
            return head ? getComputedStyle(head).gridTemplateColumns : "";
          })(),
          nestedShells: [
            ...p.querySelectorAll(
              [
                "[data-reincarnation-stage] .reincarnation-chapter",
                "[data-reincarnation-stage] .reincarnation-sheet",
                "[data-reincarnation-stage] .reincarnation-read-panel",
                "[data-reincarnation-stage] .reincarnation-talent-choice",
                "[data-reincarnation-stage] .reincarnation-theme-choice",
              ].join(","),
            ),
          ].map((el) => {
            const style = getComputedStyle(el);
            return {
              className: String(el.className),
              fullBorder: ["Top", "Right", "Bottom", "Left"].every(
                (side) => parseFloat(style[`border${side}Width`]) > 0,
              ),
            };
          }),
          balanceRows: p.querySelectorAll(
            "[data-reincarnation-balance] .reincarnation-balance__row",
          ).length,
          criticalRows: [...p.querySelectorAll("[data-reincarnation-critical-row]")].map((el) =>
            el.getAttribute("data-reincarnation-critical-row"),
          ),
          ledgerGroups: p.querySelectorAll("[data-reincarnation-heritage-group]").length,
          ledgerRows: p.querySelectorAll("[data-reincarnation-heritage-row]").length,
          talentChoices: p.querySelectorAll("[data-reincarnation-talent-choice]").length,
          ledgerOpen:
            p
              .querySelector("[data-reincarnation-heritage-toggle]")
              ?.getAttribute("aria-expanded") === "true",
          detailText: (p.querySelector(".reincarnation-ledger-row__detail")?.textContent || "")
            .replace(/\s+/g, " ")
            .trim(),
          confirmState: p
            .querySelector("[data-reincarnation-confirm-gate]")
            ?.getAttribute("data-reincarnation-confirm-state"),
          confirmDisabled: !!p
            .querySelector("[data-reincarnation-confirm]")
            ?.hasAttribute("disabled"),
          actionsColumns: (() => {
            const actions = p.querySelector(".reincarnation-actions");
            return actions ? getComputedStyle(actions).gridTemplateColumns : "";
          })(),
          actionButtonStacked: (() => {
            const button = p.querySelector(".reincarnation-actions__button");
            const label = button?.querySelector("span")?.getBoundingClientRect();
            const hint = button?.querySelector("small")?.getBoundingClientRect();
            return !!label && !!hint && hint.top >= label.bottom - 1;
          })(),
          panelOverflow: p.scrollWidth > p.clientWidth + 1,
        };
      });
    const step = async (label, expect) => {
      checked += 1;
      const p = await readPanel();
      if (!p) {
        failures.push(`[390] 转世场景:${label}没有弹出对应的窗`);
        return null;
      }
      if (!expect.test(p.title))
        failures.push(`[390] 转世场景:${label}的窗标题是「${p.title}」,不是预期的${expect}`);
      if (/NaN|undefined|Infinity/.test(p.text))
        failures.push(`[390] 转世场景:${label}漏出占位符 —— ${p.text.slice(0, 50)}`);
      if (p.panelOverflow) failures.push(`[390] 转世场景:${label}的弹窗内容横向溢出`);
      if (p.stageNoteLines.some((lines) => lines !== 1))
        failures.push(`[390] 转世场景:${label}的三程路签被挤折行(${p.stageNoteLines.join("/")})`);
      if (p.chapterHeads > 0 && p.chapterHeadDisplay !== "grid")
        failures.push(
          `[390] 转世场景:${label}的章首退成了 ${p.chapterHeadDisplay || "无样式"},不是双栏账头`,
        );
      if (p.chapterHeads > 0 && p.chapterHeadColumns.split(/\s+/).filter(Boolean).length !== 2)
        failures.push(`[390] 转世场景:${label}的章首没有摊成双栏(${p.chapterHeadColumns || "无"})`);
      if (p.nestedShells.some((shell) => shell.fullBorder))
        failures.push(
          `[390] 转世场景:${label}的续卷里又叠了四边框卡壳 —— ` +
            p.nestedShells
              .filter((shell) => shell.fullBorder)
              .map((shell) => shell.className)
              .join(","),
        );
      if (p.actionsColumns.split(/\s+/).filter(Boolean).length !== 1)
        failures.push(
          `[390] 转世场景:${label}的动作区没有在手机上收成上下段(${p.actionsColumns || "无"})`,
        );
      if (p.actionsColumns && !p.actionButtonStacked)
        failures.push(`[390] 转世场景:${label}的主按钮说明没有落到动作名下一行`);
      /*
       * 三步都要过 200% 那一档:转世是**唯一会把存档推倒重来**的仪式,而这三扇窗
       * 只在这条流程里出现 —— 主巡页与缩放档都碰不到,版面坏了也不会有人知道。
       */
      zoomSeen += 1;
      const stepZoom = dialogZoomProblems(
        await measureDialogZoom(page, { width: 390, height: 844 }),
      );
      if (stepZoom.length)
        failures.push(`[390] 转世「${label}」在 200% 下坏了:${stepZoom.join(" / ")}`);
      return p;
    };

    const death = await step("读档后(辞世)", /往生 · 辞世/);
    if (death) {
      checked += 1;
      if (
        death.stage !== "death" ||
        death.stages.join(",") !== "current,upcoming,upcoming" ||
        death.chapterHeads !== 1 ||
        death.chapterTitles[0] !== "此生止步" ||
        !death.text.includes("这不是清档，是开卷") ||
        !death.text.includes("尚未写入轮回") ||
        !/兵解转世/.test(death.buttons.join(" "))
      ) {
        failures.push(
          `[390] 转世场景:辞世屏没有先开卷再落子:` +
            `阶段 ${death.stage}/${death.stages.join(",")} / ` +
            `章首 ${death.chapterHeads}/${death.chapterTitles.join(" | ")} / ` +
            `按钮 «${death.buttons.join(" | ")}»`,
        );
      }
    }
    if (SHOTS) {
      mkdirSync(SHOTS_DIR, { recursive: true });
      await page.screenshot({ path: join(SHOTS_DIR, "reincarnation-death-390.png") });
    }
    await page
      .locator("[data-reincarnation-begin]")
      .click({ timeout: 3000 })
      .catch(() => {});
    await page.waitForTimeout(900);

    const review = await step("兵解后(回照)", /往生 · 回照/);
    if (review) {
      const critical = new Set(review.criticalRows);
      checked += 1;
      if (
        review.stage !== "review" ||
        review.stages.join(",") !== "done,current,upcoming" ||
        review.chapterHeads !== 3 ||
        !["随魂所积", "此世交割"].every((title) => review.chapterTitles.includes(title)) ||
        !/宿慧/.test(review.text) ||
        review.balanceRows !== 3 ||
        !critical.has("gongfa") ||
        !critical.has("artifacts") ||
        !critical.has("realm") ||
        !critical.has("linggen") ||
        review.ledgerOpen ||
        review.ledgerGroups !== 0 ||
        review.ledgerRows !== 0
      ) {
        failures.push(
          `[390] 转世场景:回照没有先摊三账与主要损失:` +
            `阶段 ${review.stage}/${review.stages.join(",")} / ` +
            `章首 ${review.chapterHeads}/${review.chapterTitles.join(" | ")} / ` +
            `三账 ${review.balanceRows} / 主损 ${review.criticalRows.join(",")} / ` +
            `全账 ${review.ledgerGroups} 组 ${review.ledgerRows} 项`,
        );
      }
    }
    if (SHOTS) await page.screenshot({ path: join(SHOTS_DIR, "reincarnation-review-390.png") });

    const ledgerToggle = page.locator("[data-reincarnation-heritage-toggle]");
    if ((await ledgerToggle.count()) === 0) {
      failures.push("[390] 转世场景:回照没有去留全账入口");
    } else {
      await ledgerToggle.click({ timeout: 3000 }).catch(() => {});
      await page
        .locator('[data-reincarnation-heritage-row="gongfa"]')
        .waitFor({ state: "attached", timeout: 3000 })
        .catch(() => {});
      const expanded = await readPanel();
      checked += 1;
      if (!expanded?.ledgerOpen || expanded.ledgerGroups !== 3 || expanded.ledgerRows !== 36) {
        failures.push(
          `[390] 转世场景:去留全账没有铺开同一份 36 项继承表:` +
            `展开 ${expanded?.ledgerOpen ?? false} / ${expanded?.ledgerGroups ?? 0} 组 / ` +
            `${expanded?.ledgerRows ?? 0} 项`,
        );
      }

      const gongfaRow = page.locator('[data-reincarnation-heritage-row="gongfa"]');
      if ((await gongfaRow.count()) === 0) {
        failures.push("[390] 转世场景:去留全账里没有功法那条");
      } else {
        await gongfaRow.click({ timeout: 3000 }).catch(() => {});
        const detail = await readPanel();
        checked += 1;
        if (
          (await gongfaRow.getAttribute("aria-expanded")) !== "true" ||
          !detail?.detailText.includes("归零回一层")
        ) {
          failures.push(
            `[390] 转世场景:功法交割说明没有摊开:` +
              `aria=${await gongfaRow.getAttribute("aria-expanded")} / «${detail?.detailText || "无"}»`,
          );
        }

        zoomSeen += 1;
        const ledgerZoom = dialogZoomProblems(
          await measureDialogZoom(page, { width: 390, height: 844 }),
        );
        if (ledgerZoom.length)
          failures.push(`[390] 转世「回照 · 去留全账」在 200% 下坏了:${ledgerZoom.join(" / ")}`);
        if (SHOTS) await page.screenshot({ path: join(SHOTS_DIR, "reincarnation-ledger-390.png") });
      }
    }

    await page
      .locator("[data-reincarnation-review-next]")
      .click({ timeout: 3000 })
      .catch(() => {});
    await page.waitForTimeout(800);

    const next = await step("往生后(择生)", /往生 · 择生/);
    if (next) {
      checked += 1;
      if (
        next.stage !== "choice" ||
        next.stages.join(",") !== "done,done,current" ||
        next.chapterHeads < 5 ||
        !["来世根骨", "新一世的道号", "择一先天之姿", "这一世要做什么", "落印之前"].every((title) =>
          next.chapterTitles.includes(title),
        ) ||
        !/道果/.test(next.text) ||
        !next.text.includes("不可撤回") ||
        (next.talentChoices > 0 && (!next.confirmDisabled || next.confirmState !== "blocked"))
      ) {
        failures.push(
          `[390] 转世场景:择生屏没有把末次落子说清:` +
            `阶段 ${next.stage}/${next.stages.join(",")} / ` +
            `章首 ${next.chapterHeads}/${next.chapterTitles.join(" | ")} / ` +
            `天姿 ${next.talentChoices} / ` +
            `确认 ${next.confirmState}/${next.confirmDisabled ? "灰" : "亮"}`,
        );
      }
    }
    if (SHOTS) await page.screenshot({ path: join(SHOTS_DIR, "reincarnation-choice-390.png") });

    // 有先天之姿就先择一个(不择则「踏入轮回」是灰的)。用稳定的数据契约,
    // 不按按钮文案猜:道号重拟、命题与天赋都会出现在同一扇窗里。
    const talentChoice = page.locator("[data-reincarnation-talent-choice]").first();
    const hasTalentChoices = (await talentChoice.count()) > 0;
    if (hasTalentChoices) {
      await talentChoice.click({ timeout: 3000 }).catch(() => {});
      const chosenGate = await readPanel();
      checked += 1;
      if (chosenGate?.confirmState !== "ready" || chosenGate.confirmDisabled) {
        failures.push(
          `[390] 转世场景:择定先天之姿后确认门仍没放行:` +
            `${chosenGate?.confirmState}/${chosenGate?.confirmDisabled ? "灰" : "亮"}`,
        );
      }
    }
    const confirm = page.locator(".modal-panel button", { hasText: /踏\s*入\s*轮\s*回/ }).first();
    if ((await confirm.count()) === 0) failures.push("[390] 转世场景:轮回那程没有「踏入轮回」");
    else {
      if (await confirm.isDisabled())
        failures.push("[390] 转世场景:择了先天之姿,「踏入轮回」仍是灰的");
      await confirm.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(1800);
      const after = await page.evaluate(() => ({
        // 判据是「转世那几扇窗关干净了」,不是「一扇窗都没有」——新的一世里
        // 引擎随时可能浮出顿悟/巡游,那是正常玩法,不该被算作转世没走完
        rebirthStillOpen: [...document.querySelectorAll(".modal-panel")]
          .map((p) =>
            (p.querySelector("h3")?.textContent || p.getAttribute("aria-label") || "").trim(),
          )
          .filter((t) => /往生\s*·\s*(辞世|回照|择生)/.test(t)),
        text: (document.querySelector("main")?.innerText || "").replace(/\n+/g, " ").slice(0, 200),
      }));
      if (after.rebirthStillOpen.length)
        failures.push(
          `[390] 转世场景:点「踏入轮回」之后还留着转世的窗 —— ${after.rebirthStillOpen.join("、")}`,
        );
      if (/炼虚|99999/.test(after.text))
        failures.push("[390] 转世场景:转世之后页面上还写着上一世的境界/寿数");
      console.log(
        `\n转世:${[death?.title, review?.title, next?.title].filter(Boolean).join(" → ")} → 新的一世(${after.text.slice(0, 24)}…)`,
      );
    }
    if (pageErrors.length)
      failures.push(`[390] 转世场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
    await ctx.close();
  }

  return { failures, checked, contrastFails, pixelContrastFails, zoomFails };
}

/** 挂机真的在挂着跑 */
async function taskIdleTick() {
  const failures = [];
  let checked = 0;
  const contrastFails = [];
  const pixelContrastFails = [];
  const zoomFails = [];
  // ---- 第十三件事:挂机游戏真的在挂着跑(页面上的数自己在涨) ----
  /*
   * 引擎每秒推进修为、灵气与洞府产出 —— 这是放置玩法的根,可此前没有被端到端看过一眼:
   * 单元用例直接调引擎,而「应用启动之后引擎到底跑起来没有」只有真浏览器能答。
   * 若哪天 engine.start() 被条件挡住、或 tick 被谁掐了,界面会安静地冻在那里,
   * 而所有单测照样全绿。故这里真等两轮:灵气只给 1 点,看它自己涨不涨。
   */
  {
    const ctx = await auditContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    });
    const enc = encryptSlice;
    const gn = (m, e) => ({ m, e });
    const slices = {
      game: {
        started: true,
        saveVersion: 2,
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
        totalPlaySec: 0,
        createRerolls: 8,
        createProfile: null,
      },
      player: {
        major: 5,
        sub: 3,
        exp: gn(1, 2),
        age: 40,
        lifespanBonusYears: 0,
        dead: false,
        reincarnation: {
          count: 0,
          daoFruit: 0,
          talents: [],
          insight: 0,
          lives: [],
          vow: null,
          trial: null,
          bonds: [],
        },
        linggen: {
          roots: [{ element: "wood", aptitude: 70 }],
          gradeName: "单灵根",
          growthMult: 1.1,
        },
      },
      resources: { spiritStone: gn(1, 5), qi: 1, wudao: 10, herb: 5, ore: 5, page: 2, dust: 2 },
      inventory: { items: [], equipped: {}, pills: {}, artifacts: [], equippedArtifacts: [] },
      endgame: { daoPath: null, daoSource: 0, souls: [], equippedSouls: [] },
      settings: {
        privacyAccepted: true,
        sfxOn: false,
        musicOn: false,
        musicVol: 0,
        sfxVol: 0,
        reduceMotion: true,
        battleSpeed: 4,
        decomposeRanks: [],
        smartKeep: { enabled: true, minQuality: 3, keepCoreAffix: true, keepComboPiece: true },
        theme: "light",
      },
    };
    await ctx.addInitScript(
      (data) => {
        for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
      },
      Object.fromEntries(Object.entries(slices).map(([k, v]) => [`${SAVE_PREFIX}${k}`, enc(v)])),
    );
    const page = await ctx.newPage();
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    await page.goto(INDEX, { waitUntil: "load" });
    await page.waitForTimeout(2200);
    await clearOverlays(page);
    checked += 1;
    /** 读顶栏灵气:文本按 formatGN 的档位(万/亿/兆…)还原成数值 */
    const readQi = () => readFormatted(page, "灵气");
    const first = await readQi();
    await page.waitForTimeout(3200);
    const second = await readQi();
    await page.waitForTimeout(3200);
    const third = await readQi();
    const nums = [first.value, second.value, third.value];
    if (nums.some((v) => v === null || !Number.isFinite(v))) {
      failures.push(
        `[390] 挂机场景:顶栏灵气读数解析不出来 —— ${[first, second, third].map((x) => x.text).join(" / ")}`,
      );
    } else if (!(nums[2] > nums[0] && nums[0] <= nums[1] && nums[1] <= nums[2])) {
      // 判据是「一直在涨、至少涨了一截」——不要求每步都严格变大:灵气涨到上限会平下来
      failures.push(
        `[390] 挂机场景:灵气没有在涨(页面上的数冻住了 —— 引擎没跑?) ${nums.join(" → ")}`,
      );
    } else {
      console.log(
        `\n挂机 6 秒:灵气 ${first.text} → ${second.text} → ${third.text}(页面上的数自己在涨)`,
      );
    }
    if (pageErrors.length)
      failures.push(`[390] 挂机场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
    await ctx.close();
  }

  return { failures, checked, contrastFails, pixelContrastFails, zoomFails };
}

/** 存档导出/导入往返 */
async function taskSaveRoundTrip() {
  const failures = [];
  let checked = 0;
  const contrastFails = [];
  const pixelContrastFails = [];
  const zoomFails = [];
  // ---- 第十四件事:导出 → 改动 → 导入回来(存档备份这条路真的走得通吗) ----
  /*
   * 「存档只在本地」是这个游戏反复向玩家交代的一条(设置页也这么写),故「导出备份、
   * 事后导入救回来」是最后一道保险。单元用例测过 payload 的形状,却没人真按过这两个按钮:
   * 下载走的是 Blob + a[download],导入走 FileReader + 校验 + 写盘 + 重载,
   * 任何一环断了,玩家都要等到真丢档那天才知道。
   *
   * 判据用**不会自己变的数**(灵石;夹具里没有洞府产出):
   *   导出时的灵石 S0 → 投一点灵脉把灵石花掉(S1 < S0)→ 导入 → 必须回到 S0。
   *
   * 坑记一笔:这种会触发重载的场景,夹具**必须只种一次**
   * (addInitScript 每次导航都会跑,不加闸就会在重载时把刚导入的存档盖回夹具 —— 实测踩过)。
   */
  {
    const ctx = await auditContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      acceptDownloads: true,
    });
    const enc = encryptSlice;
    const gn = (m, e) => ({ m, e });
    const slices = {
      game: {
        started: true,
        saveVersion: 2,
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
        totalPlaySec: 0,
        createRerolls: 8,
        createProfile: null,
      },
      player: {
        name: "存读自检",
        major: 5,
        sub: 3,
        exp: gn(1, 2),
        age: 40,
        lifespanBonusYears: 0,
        dead: false,
        reincarnation: {
          count: 0,
          daoFruit: 0,
          talents: [],
          insight: 0,
          lives: [],
          vow: null,
          trial: null,
          bonds: [],
        },
        linggen: {
          roots: [{ element: "wood", aptitude: 70 }],
          gradeName: "单灵根",
          growthMult: 1.1,
        },
      },
      resources: { spiritStone: gn(1, 6), qi: 1000, wudao: 10, herb: 5, ore: 5, page: 2, dust: 2 },
      inventory: { items: [], equipped: {}, pills: {}, artifacts: [], equippedArtifacts: [] },
      endgame: { daoPath: null, daoSource: 0, souls: [], equippedSouls: [] },
      settings: {
        privacyAccepted: true,
        sfxOn: false,
        musicOn: false,
        musicVol: 0,
        sfxVol: 0,
        reduceMotion: true,
        battleSpeed: 4,
        decomposeRanks: [],
        smartKeep: { enabled: true, minQuality: 3, keepCoreAffix: true, keepComboPiece: true },
        theme: "light",
      },
    };
    await ctx.addInitScript(
      (data) => {
        if (localStorage.getItem("__layoutSeeded")) return;
        for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
        localStorage.setItem("__layoutSeeded", "1");
      },
      Object.fromEntries(Object.entries(slices).map(([k, v]) => [`${SAVE_PREFIX}${k}`, enc(v)])),
    );
    const page = await ctx.newPage();
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    const savePath = "/tmp/layout-roundtrip.save";
    /** 磁盘上那一份灵石(解密 resources 分片;GNum 是 m×10^e) */
    const storedStone = async () => {
      const cipher = await page.evaluate(
        (prefix) => localStorage.getItem(`${prefix}resources`) || "",
        SAVE_PREFIX,
      );
      if (!cipher) return null;
      const plain = decryptSlice(cipher);
      if (!plain) return null;
      const v = JSON.parse(plain).spiritStone;
      return typeof v === "number" ? v : v.m * Math.pow(10, v.e);
    };
    await page.goto(INDEX + "#" + "/settings", { waitUntil: "load" });
    await page.waitForTimeout(2200);
    await clearOverlays(page);
    checked += 1;
    const s0 = await readFormatted(page, "灵石");
    let downloaded = "";
    try {
      const [download] = await Promise.all([
        page.waitForEvent("download", { timeout: 8000 }),
        page
          .getByRole("button", { name: /导出存档/ })
          .first()
          .click(),
      ]);
      downloaded = download.suggestedFilename();
      await download.saveAs(savePath);
    } catch (err) {
      failures.push(
        `[390] 存读场景:点「导出存档」没有拿到下载(${String(err).split("\n")[0]?.slice(0, 60)})`,
      );
    }
    if (downloaded && !downloaded.endsWith(".save"))
      failures.push(`[390] 存读场景:导出的文件名不像存档(${downloaded})`);

    // 动一下不会自己变的数:投一点灵脉,把灵石花掉
    await page.goto(INDEX + "#" + "/dongfu", { waitUntil: "load" });
    await page.waitForTimeout(900);
    await page
      .getByRole("button", { name: /灵脉投资/ })
      .first()
      .click({ timeout: 3000 })
      .catch(() => {});
    await page.waitForTimeout(400);
    const invest = page.locator(".modal-panel button.btn-ghost:not([disabled])").first();
    let spent = null;
    if ((await invest.count()) === 0)
      failures.push("[390] 存读场景:灵脉弹窗里没有可投的脉(判据没跑到东西)");
    else {
      await invest.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(700);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
      spent = await readFormatted(page, "灵石");
      if (!(spent.value < s0.value)) {
        failures.push(
          `[390] 存读场景:投了灵脉灵石却没少(${s0.text} → ${spent.text}),后面的导入就证明不了什么`,
        );
      }
      /*
       * 关键一步:等节流把这次改动**真写进磁盘**再导入。
       * 否则「导入后回到 S0」与「压根没写进去」在读数上分不出来 —— 注入验证时正是这么骗过判据的
       * (跳掉导入落盘,状态照样显示 100万,因为那次投入还躺在待刷队列里)。
       */
      await page.waitForTimeout(5600);
      const onDisk = await storedStone();
      if (
        spent.value !== null &&
        (onDisk === null || Math.abs(onDisk - spent.value) > spent.value * 0.01)
      ) {
        failures.push(
          `[390] 存读场景:投入之后磁盘上的灵石是 ${onDisk},页面上是 ${spent.text} —— 改动没落盘,这条判据没搭对`,
        );
      }
    }

    // 导入回来:应当回到导出那一刻(灵石回到 S0)
    await page.goto(INDEX + "#" + "/settings", { waitUntil: "load" });
    await page.waitForTimeout(1000);
    await page.evaluate(() => {
      window.__beforeImport = "alive";
      window.name = "";
      const captureToasts = () => {
        const text = [...document.querySelectorAll(".pointer-events-none.fixed button")]
          .map((button) => (button.textContent || "").trim())
          .filter(Boolean)
          .join("|");
        if (text) window.name = `__layoutImportToasts:${text}`;
      };
      new MutationObserver(captureToasts).observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
      });
      captureToasts();
    });
    await page.locator("input[type=file]").first().setInputFiles(savePath);
    await page.waitForTimeout(500);
    // 导入是「整体替换本机进度」的不可逆操作 —— 与重置同纪律,先弹确认,点「用这份替换」才落库。
    // 判据仍盯着原来的事(成功提示 + 重新入定 + 灵石回到导出那一刻),只是要穿过这扇确认门。
    await page.getByRole("button", { name: /用这份替换/ }).click();
    await page.waitForTimeout(3000);
    /*
     * 成功提示只活到 800ms 后的 reload;并发一忙,固定等 700ms 再回读时页面
     * 可能已经重载,提示随旧文档一起没了。导入成功又刚好会调用 sealStorageWrites()
     * 封掉 Storage.prototype.setItem,故记录放 window.name —— 跨导航留得住,
     * 也不受封存影响,验的仍是玩家真看见过的那一句。
     */
    const toast = await page.evaluate(() => {
      const prefix = "__layoutImportToasts:";
      return window.name.startsWith(prefix) ? window.name.slice(prefix.length) : "";
    });
    const after = await readFormatted(page, "灵石");
    const reloaded = await page.evaluate(() => window.__beforeImport === undefined);
    if (!/导入成功/.test(toast))
      failures.push(`[390] 存读场景:导入没有成功提示(${toast || "无提示"})`);
    if (!reloaded)
      failures.push("[390] 存读场景:导入之后没有重新入定(页面没重载,内存里还是旧的一世)");
    if (spent && after.value !== null && Math.abs(after.value - s0.value) > s0.value * 0.001) {
      failures.push(`[390] 存读场景:导入后灵石 ${after.text},导出时是 ${s0.text}(存档没救回来)`);
    }
    const diskAfter = await storedStone();
    if (spent && diskAfter !== null && Math.abs(diskAfter - s0.value) > s0.value * 0.001) {
      failures.push(
        `[390] 存读场景:导入后磁盘上的灵石是 ${diskAfter},导出时是 ${s0.value}(写盘那份没换回来)`,
      );
    }
    if (pageErrors.length)
      failures.push(`[390] 存读场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
    console.log(
      `\n存读往返:导出时 ${s0.text} → 投脉后 ${spent?.text ?? "(没投成)"} → 导入后 ${after.text}`,
    );
    rmSync(savePath, { force: true });
    await ctx.close();
  }

  return { failures, checked, contrastFails, pixelContrastFails, zoomFails };
}

/** 智能收纳不扔有投入的件 */
async function taskSmartKeep() {
  const failures = [];
  let checked = 0;
  const contrastFails = [];
  const pixelContrastFails = [];
  const zoomFails = [];
  // ---- 第二十六件事:智能收纳不替玩家扔「有投入的件」 ----
  /*
   * 智能收纳卖的是「替你分辨值得留的」,而它此前只认品质/流派核心词条/组合技部件 ——
   * 于是三类明明该留的件会被当垃圾:练过的(+N / 重铸 / 封存)、成套共鸣件、词条近满件。
   * 「一键清理行囊」更狠:一按就把它们全化尘,连一次确认都只报个总数,玩家事后才知道少了什么。
   * 判据按玩家真按的两个按钮核:
   *   一 清理确认框写的件数 = 该清的件数(夹具 5 件里只有 2 件是废物);
   *   二 点下去之后,留下的正好是那 3 件有投入的(行囊 5 → 3),且练过那件的「+3」还在。
   */
  {
    const ctx = await auditContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    });
    const enc = encryptSlice;
    const gn = (m, e) => ({ m, e });
    const slices = {
      game: {
        started: true,
        saveVersion: 2,
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
        totalPlaySec: 0,
        createRerolls: 8,
        createProfile: null,
      },
      player: {
        name: "收纳自检",
        major: 5,
        sub: 3,
        exp: gn(1, 2),
        age: 40,
        lifespanBonusYears: 0,
        dead: false,
        reincarnation: {
          count: 0,
          daoFruit: 0,
          talents: [],
          insight: 0,
          lives: [],
          vow: null,
          trial: null,
          bonds: [],
        },
        linggen: {
          roots: [{ element: "wood", aptitude: 70 }],
          gradeName: "单灵根",
          growthMult: 1.1,
        },
      },
      resources: { spiritStone: gn(1, 6), qi: 1000, wudao: 10, herb: 5, ore: 5, page: 2, dust: 0 },
      inventory: {
        items: [
          // 两件该走的:凡品、不带套、没词条 / 或词条拉胯
          { uid: "j1", templateId: "b_qingyun", quality: "mortal", tier: 3, level: 0, affixes: [] },
          {
            uid: "j2",
            templateId: "b_qingyun",
            quality: "mortal",
            tier: 3,
            level: 0,
            affixes: [{ id: "atk1", roll: 0.12 }],
          },
          // 三件该留的:练过(有投入)/ 成套共鸣 / 词条条条近满
          {
            uid: "k_lv",
            templateId: "b_qingyun",
            quality: "mortal",
            tier: 3,
            level: 3,
            affixes: [],
            invested: { dust: 40, stone: gn(2, 3) },
          },
          {
            uid: "k_set",
            templateId: "w_xuantie",
            quality: "mortal",
            tier: 3,
            level: 0,
            affixes: [],
          },
          {
            uid: "k_roll",
            templateId: "h_muzan",
            quality: "mortal",
            tier: 3,
            level: 0,
            affixes: [
              { id: "atk1", roll: 0.95 },
              { id: "def1", roll: 0.9 },
            ],
          },
        ],
        equipped: {},
        pills: {},
        artifacts: [],
        equippedArtifacts: [],
      },
      endgame: { daoPath: null, daoSource: 0, souls: [], equippedSouls: [] },
      settings: {
        privacyAccepted: true,
        sfxOn: false,
        musicOn: false,
        musicVol: 0,
        sfxVol: 0,
        reduceMotion: true,
        battleSpeed: 4,
        decomposeRanks: [],
        smartKeep: {
          enabled: true,
          minQuality: 3,
          keepCoreAffix: true,
          keepComboPiece: true,
          keepPerfectRolls: true,
          keepSetPiece: true,
        },
        theme: "light",
      },
    };
    await ctx.addInitScript(
      (data) => {
        if (localStorage.getItem("__layoutSeeded")) return;
        for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
        localStorage.setItem("__layoutSeeded", "1");
      },
      Object.fromEntries(Object.entries(slices).map(([k, v]) => [`${SAVE_PREFIX}${k}`, enc(v)])),
    );
    const page = await ctx.newPage();
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    await page.goto(INDEX + "#" + "/inventory", { waitUntil: "load" });
    await page.waitForTimeout(2400);
    await clearOverlays(page);
    checked += 1;
    const bagCount = () =>
      page.evaluate(() => {
        const raw = document
          .querySelector("[data-inventory-bag-count]")
          ?.getAttribute("data-inventory-bag-count");
        return raw === null || raw === undefined ? null : Number(raw);
      });
    const opened = await page
      .locator("main button", { hasText: /收纳/ })
      .first()
      .click({ timeout: 3000 })
      .then(() => true)
      .catch(() => false);
    if (!opened) failures.push("[390] 收纳场景:行囊页找不到「收纳」入口");
    else {
      await page.waitForTimeout(400);
      const before = await bagCount();
      if (before !== 5) failures.push(`[390] 收纳场景:夹具没铺好 —— 开局行囊 ${before} 件(应为 5)`);
      const armed = await page
        .locator(".modal-panel button", { hasText: /依此规则清理行囊/ })
        .first()
        .click({ timeout: 3000 })
        .then(() => true)
        .catch(() => false);
      if (!armed) failures.push("[390] 收纳场景:找不到「依此规则清理行囊」按钮");
      await page.waitForTimeout(300);
      const warn = await page.evaluate(() =>
        (document.querySelector(".modal-panel")?.innerText || "").replace(/\n+/g, " "),
      );
      const promisedCount = Number((/共\s*(\d+)\s*件/.exec(warn) || [])[1] ?? NaN);
      if (promisedCount !== 2) {
        failures.push(
          `[390] 收纳场景:该清的只有 2 件废物,确认框写的是 ${promisedCount} 件 —— 练过/成套/近满的件被算进了清理名单(${warn.slice(0, 90)})`,
        );
      }
      await page
        .locator(".modal-panel button", { hasText: /清理化尘/ })
        .first()
        .click({ timeout: 3000 })
        .catch(() => {});
      await page.waitForTimeout(900);
      const after = await bagCount();
      const body = await page.evaluate(() =>
        (document.querySelector("main")?.innerText || "").replace(/\n+/g, " "),
      );
      const toast = await page.evaluate(() =>
        [...document.querySelectorAll(".pointer-events-none.fixed button")]
          .map((b) => (b.textContent || "").trim())
          .join("|"),
      );
      if (after !== 3)
        failures.push(`[390] 收纳场景:清理后行囊剩 ${after} 件(应为 3 —— 那 3 件有投入的必须留下)`);
      if (!/收纳毕:2 件/.test(toast))
        failures.push(`[390] 收纳场景:清理后的交代不对(${toast || "无提示"})`);
      for (const [uid, name] of [
        ["k_set", "玄铁重剑"],
        ["k_roll", "桃木簪"],
      ]) {
        if (!body.includes(name)) failures.push(`[390] 收纳场景:${name}(${uid})被自动清理了`);
      }
      if (!/\+3/.test(body)) failures.push("[390] 收纳场景:练过的那件(+3)被自动清理了");
      if (after === 3 && promisedCount === 2) {
        console.log(
          `\n智能收纳:行囊 5 件 → 确认框「共 ${promisedCount} 件」→ 清理后 ${after} 件(练过/成套/近满三件都留下)`,
        );
      }
    }
    if (pageErrors.length)
      failures.push(`[390] 收纳场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
    await ctx.close();
  }

  return { failures, checked, contrastFails, pixelContrastFails, zoomFails };
}

/** 背包先报本次新得与真正会动的换装槽位 */
async function taskInventoryAttention() {
  const failures = [];
  let checked = 0;
  const contrastFails = [];
  const pixelContrastFails = [];
  const zoomFails = [];
  const ctx = await auditContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  try {
    const slices = showcaseSlices("light");
    const newUids = ["attention_w", "shot_w", "bag_r", "bag_n", "bag_bo"];
    const items = [
      ...slices.inventory.items,
      {
        uid: "attention_w",
        templateId: "w_xuantie",
        quality: "divine",
        tier: 20,
        level: 0,
        affixes: [],
      },
    ];
    const { head: _emptyHead, ...equipped } = slices.inventory.equipped;
    slices.inventory = {
      ...slices.inventory,
      items,
      equipped,
      // 五件新得压过旧藏;佩戴中的新武器也保留「新」,与底导读数同源。
      seenUids: items.filter((it) => !newUids.includes(it.uid)).map((it) => it.uid),
      seenSeeded: true,
    };
    await seedSave(ctx, slices, "__inventoryAttentionFixture");

    const page = await ctx.newPage();
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    const textLength = await openRoute(page, "/inventory", 800);
    if (textLength === 0) failures.push("[390] 背包新得场景:页面没有渲染出来");
    await clearOverlays(page);

    const read = () =>
      page.evaluate(() => {
        const overview = document.querySelector("[data-inventory-overview]");
        const list = document.querySelector("[data-inventory-scope]");
        const cards = [...document.querySelectorAll("main button[data-uid]")];
        const oneClick = [...document.querySelectorAll("main button")].find((button) =>
          /一键 ·|已无可换之器/.test(button.textContent || ""),
        );
        const register = document.querySelector("[data-inventory-register]");
        const chapters = register
          ? [...register.querySelectorAll("[data-inventory-chapter]")].map((chapter) =>
              chapter.getAttribute("data-inventory-chapter"),
            )
          : [];
        const chapterShells = register
          ? [...register.querySelectorAll("[data-inventory-chapter]")].filter((chapter) => {
              const style = getComputedStyle(chapter);
              return (
                Number.parseFloat(style.borderRadius) !== 0 ||
                style.boxShadow !== "none" ||
                style.backgroundColor !== "rgba(0, 0, 0, 0)"
              );
            }).length
          : 0;
        const registerStyle = register ? getComputedStyle(register) : null;
        const decision = oneClick?.closest(".inventory-briefing__decision");
        const oneClickRect = oneClick?.getBoundingClientRect();
        const decisionRect = decision?.getBoundingClientRect();
        const reliquary = document.querySelector("[data-inventory-reliquary]");
        const upgradeSlots = [...document.querySelectorAll("[data-inventory-upgrade-slot]")]
          .map((button) => button.getAttribute("data-inventory-upgrade-slot"))
          .filter((slot) => !!slot)
          .sort((a, b) => a.localeCompare(b));
        const markedSlots = [...document.querySelectorAll("[data-equip-upgrade]")]
          .map((button) => button.getAttribute("data-equip-upgrade"))
          .filter((slot) => !!slot)
          .sort((a, b) => a.localeCompare(b));
        return {
          newCount: Number(overview?.getAttribute("data-inventory-new-count")),
          upgradeCount: Number(overview?.getAttribute("data-inventory-upgrade-count")),
          scope: list?.getAttribute("data-inventory-scope") ?? null,
          visibleTotal: Number(list?.getAttribute("data-inventory-total")),
          cards: cards.map((card) => card.getAttribute("data-uid")),
          newCards: cards
            .filter((card) => card.getAttribute("data-equipment-new") === "true")
            .map((card) => card.getAttribute("data-uid")),
          upgradeSlots,
          markedSlots,
          oneClick: {
            disabled: oneClick?.hasAttribute("disabled") ?? true,
            text: (oneClick?.textContent || "").replace(/\s+/g, " ").trim(),
            widthRatio:
              oneClickRect && decisionRect && decisionRect.width > 0
                ? oneClickRect.width / decisionRect.width
                : null,
          },
          register: register
            ? {
                chapters,
                seats: register.querySelectorAll("[data-equip-slot]").length,
                capacityReadouts: register.querySelectorAll("[data-inventory-capacity]").length,
                reliquaryHasDuplicateCount: /\d+\s*\/\s*\d+/.test(reliquary?.textContent || ""),
                chapterShells,
                cardClasses: register.querySelectorAll(".card-ink").length,
                radius: registerStyle ? Number.parseFloat(registerStyle.borderRadius) : null,
                shadow: registerStyle?.boxShadow ?? null,
              }
            : null,
        };
      });

    const initial = await read();
    const expectedFirst = ["attention_w", "shot_w", "bag_r", "bag_n", "bag_bo"];
    checked += 1;
    if (
      !initial.register ||
      initial.register.chapters.join(",") !== "briefing,seats,collection" ||
      initial.register.seats !== 9 ||
      initial.register.capacityReadouts !== 1 ||
      initial.register.reliquaryHasDuplicateCount ||
      initial.register.chapterShells !== 0 ||
      initial.register.cardClasses !== 0 ||
      initial.register.radius !== 0 ||
      initial.register.shadow !== "none"
    ) {
      failures.push(`[390] 背包续卷没有收成一册三章(${JSON.stringify(initial.register)})`);
    }
    if (initial.oneClick.widthRatio === null || initial.oneClick.widthRatio > 0.72) {
      failures.push(
        `[390] 背包主行动宽度为 ${initial.oneClick.widthRatio ?? "未量到"} —— 应不超过检点账行 72%`,
      );
    }
    if (initial.newCount !== newUids.length) {
      failures.push(
        `[390] 背包新得场景:卷首应报 ${newUids.length} 件新得,实见 ${initial.newCount}`,
      );
    }
    if (
      initial.scope !== "all" ||
      initial.visibleTotal !== items.length ||
      initial.cards.length === 0
    ) {
      failures.push(
        `[390] 背包新得场景:全部藏品范围不对(scope ${initial.scope} / ` +
          `total ${initial.visibleTotal} / cards ${initial.cards.length},应 ${items.length})`,
      );
    }
    if (initial.cards.slice(0, expectedFirst.length).join(",") !== expectedFirst.join(",")) {
      failures.push(
        `[390] 背包新得场景:新得没有整体置顶 —— 首批 ${initial.cards
          .slice(0, expectedFirst.length)
          .join(",")}(应 ${expectedFirst.join(",")})`,
      );
    }
    if (initial.newCards.length !== newUids.length) {
      failures.push(
        `[390] 背包新得场景:卡片「新」角标 ${initial.newCards.length} 件,卷首报 ${initial.newCount} 件`,
      );
    }
    if (
      initial.upgradeCount < 2 ||
      initial.upgradeSlots.length !== initial.upgradeCount ||
      initial.markedSlots.join(",") !== initial.upgradeSlots.join(",")
    ) {
      failures.push(
        `[390] 背包换装场景:卷首报价 ${initial.upgradeCount} 槽 / 逐槽入口 ` +
          `${initial.upgradeSlots.join(",") || "无"} / 槽位标记 ${initial.markedSlots.join(",") || "无"}`,
      );
    }
    if (!initial.oneClick.text.includes(`换上 ${initial.upgradeCount} 槽最强`)) {
      failures.push(
        `[390] 背包换装场景:一键按钮没有报出 ${initial.upgradeCount} 槽(«${initial.oneClick.text}»`,
      );
    }

    await page.locator("[data-inventory-new-toggle]").click({ timeout: 3000 });
    await page.waitForFunction(
      () =>
        document.querySelector("[data-inventory-scope]")?.getAttribute("data-inventory-scope") ===
        "new",
      { timeout: 3000 },
    );
    await settleVisuals(page);
    const filtered = await read();
    checked += 1;
    if (
      filtered.visibleTotal !== newUids.length ||
      filtered.cards.length !== newUids.length ||
      filtered.newCards.length !== newUids.length
    ) {
      failures.push(
        `[195] 只看新得应只铺 ${newUids.length} 件,实见 total ${filtered.visibleTotal} / ` +
          `cards ${filtered.cards.length} / 带新角标 ${filtered.newCards.length}`,
      );
    }

    await page.locator("[data-inventory-new-toggle]").click({ timeout: 3000 });
    await page.waitForFunction(
      () =>
        document.querySelector("[data-inventory-scope]")?.getAttribute("data-inventory-scope") ===
        "all",
      { timeout: 3000 },
    );
    await settleVisuals(page);
    zoomSeen += 1;
    const zoom = await measureZoomScale(page, { width: 390, height: 844 });
    const zoomBad = zoomProblems(zoom, "390");
    if (zoomBad.length) failures.push(`[195] 背包新得卷首与藏品册 → ${zoomBad.join(" / ")}`);

    const firstUpgrade = page.locator("[data-inventory-upgrade-slot]").first();
    const firstUpgradeSlot = await firstUpgrade.getAttribute("data-inventory-upgrade-slot");
    if (!firstUpgradeSlot) {
      failures.push("[195] 背包换装场景:卷首没有可动槽入口 —— 判据没量到东西");
    } else {
      await firstUpgrade.click({ timeout: 3000 });
      await page
        .locator("[data-slot-candidate-total]")
        .first()
        .waitFor({ state: "visible", timeout: 3000 });
      checked += 1;
      const dialogBad = dialogZoomProblems(
        await measureDialogZoom(page, { width: 390, height: 844 }),
      );
      if (dialogBad.length) {
        failures.push(`[195] ${firstUpgradeSlot} 候选弹窗 → ${dialogBad.join(" / ")}`);
      }
      await page.keyboard.press("Escape");
      await page
        .locator("[data-slot-candidate-total]")
        .first()
        .waitFor({ state: "detached", timeout: 3000 });
    }

    const beforeApply = await read();
    await page
      .locator("main button", { hasText: /一键 · 换上 \d+ 槽最强/ })
      .first()
      .click({ timeout: 3000 });
    await page.waitForFunction(
      () =>
        document
          .querySelector("[data-inventory-overview]")
          ?.getAttribute("data-inventory-upgrade-count") === "0",
      { timeout: 3000 },
    );
    await settleVisuals(page);
    const applied = await read();
    const toast = await page.evaluate(() =>
      [...document.querySelectorAll(".pointer-events-none.fixed button")]
        .map((button) => (button.textContent || "").replace(/\s+/g, " ").trim())
        .join("|"),
    );
    checked += 1;
    if (
      applied.upgradeCount !== 0 ||
      applied.upgradeSlots.length !== 0 ||
      applied.markedSlots.length !== 0 ||
      !applied.oneClick.disabled ||
      applied.oneClick.text !== "已无可换之器"
    ) {
      failures.push(
        `[390] 一键换装后仍有残留:报价 ${applied.upgradeCount} / 入口 ` +
          `${applied.upgradeSlots.join(",") || "无"} / 标记 ${applied.markedSlots.join(",") || "无"} / ` +
          `按钮«${applied.oneClick.text}»(${applied.oneClick.disabled ? "已禁用" : "仍可点"})`,
      );
    }
    if (!toast.includes(`换上 ${beforeApply.upgradeCount} 件`)) {
      failures.push(
        `[390] 背包换装场景:报价 ${beforeApply.upgradeCount} 槽,落库提示却是 «${toast || "无提示"}»`,
      );
    }

    if (pageErrors.length)
      failures.push(`[390] 背包新得场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
    console.log(
      `\n背包新得:${newUids.length} 件先列 · 只看新得 ${filtered.cards.length} 件 · ` +
        `可动 ${beforeApply.upgradeCount} 槽 → 一键换装后 ${applied.upgradeCount} 槽`,
    );
  } finally {
    await ctx.close();
  }
  return { failures, checked, contrastFails, pixelContrastFails, zoomFails };
}

/**
 * 行囊四签续卷 —— 装备、丹药、材料与法宝共用同一张开口账页。
 *
 * 390 核对四签各自的章序、章号、题名与章内真值,丹房/丹匣、炉材/账材
 * 在单列下依次续读;1280 才让两章左右并读;195(200% 缩放)要求章内读数
 * 退到章名下方、整页不横向溢出。四签都不许退回通用节题、旧分组小标题或
 * 四边卡壳。
 */
async function taskInventoryTabRegisters() {
  const failures = [];
  let checked = 0;
  const ctx = await auditContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  try {
    await seedSave(ctx, showcaseSlices("light"), "__inventoryTabRegisters");
    const page = await ctx.newPage();
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    const rendered = await openRoute(page, "/inventory", 700);
    checked += 1;
    if (!rendered) {
      failures.push("[390] 行囊四签续卷:页面没有渲染出来");
      return { failures, checked, contrastFails: [], pixelContrastFails: [], zoomFails: [] };
    }
    await clearOverlays(page);

    const read = () =>
      page.evaluate(() => {
        const box = (el) => {
          if (!el) return null;
          const rect = el.getBoundingClientRect();
          return {
            top: Math.round(rect.top),
            right: Math.round(rect.right),
            bottom: Math.round(rect.bottom),
            left: Math.round(rect.left),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            scrollWidth: el.scrollWidth,
            clientWidth: el.clientWidth,
          };
        };
        const register = document.querySelector("[data-inventory-register]");
        const registerStyle = register ? getComputedStyle(register) : null;
        const chapters = register
          ? [...register.querySelectorAll("[data-inventory-chapter]")].map((chapter) => {
              const style = getComputedStyle(chapter);
              const head = chapter.querySelector("[data-folio-chapter-head]");
              const title = head?.querySelector(".folio-chapter-head__title");
              const fact = head?.querySelector(".folio-chapter-head__fact");
              return {
                key: chapter.getAttribute("data-inventory-chapter") || "",
                index: head?.querySelector(".folio-chapter-head__index")?.textContent?.trim() || "",
                title: (title?.textContent || "").trim(),
                fact: (fact?.textContent || "").replace(/\s+/g, " ").trim(),
                hasHead: Boolean(head),
                titleTop: title ? Math.round(title.getBoundingClientRect().top) : null,
                factTop: fact ? Math.round(fact.getBoundingClientRect().top) : null,
                radius: Number.parseFloat(style.borderTopLeftRadius),
                shadow: style.boxShadow,
                background: style.backgroundColor,
                borderWidths: [
                  style.borderTopWidth,
                  style.borderRightWidth,
                  style.borderBottomWidth,
                  style.borderLeftWidth,
                ].map((width) => Number.parseFloat(width)),
                rect: box(chapter),
              };
            })
          : [];
        const lowerChapters = register
          ? [
              ...register.querySelectorAll(
                ":scope > .inventory-register__lower > .inventory-register__chapter",
              ),
            ]
          : [];
        const artifactHost = register?.querySelector("[data-inventory-artifacts]");
        const artifactRegister = register?.querySelector("[data-artifact-register]");
        const artifactSeats = artifactRegister
          ? [...artifactRegister.querySelectorAll("[data-artifact-seat]")]
          : [];
        return {
          tab: register?.getAttribute("data-inventory-register-tab") || "",
          register: registerStyle
            ? {
                borderTop: Number.parseFloat(registerStyle.borderTopWidth),
                borderRight: Number.parseFloat(registerStyle.borderRightWidth),
                borderBottom: Number.parseFloat(registerStyle.borderBottomWidth),
                borderLeft: Number.parseFloat(registerStyle.borderLeftWidth),
                radius: Number.parseFloat(registerStyle.borderTopLeftRadius),
                shadow: registerStyle.boxShadow,
                background: registerStyle.backgroundColor,
                rect: box(register),
                legacyChapterHeads: register.querySelectorAll(
                  ".section-title, [data-folio-section-mark]",
                ).length,
                oldShells: register.querySelectorAll(
                  ".inventory-workshop__card, .inventory-materials__groups, .inventory-material-group__head",
                ).length,
                workshopEntries: register.querySelectorAll("[data-inventory-workshop-entry]")
                  .length,
                ledgerCells: register.querySelectorAll(".inventory-cell--ledger").length,
                artifactPanel: Boolean(register.querySelector("[data-artifact-overview]")),
              }
            : null,
          artifactSurface: artifactHost
            ? {
                register: Boolean(artifactRegister),
                emptyMarker: Boolean(artifactRegister?.hasAttribute("data-artifact-empty")),
                emptyTextCount: ((artifactHost.innerText || "").match(/尚无法宝随身/g) || [])
                  .length,
                seats: artifactSeats.length,
                boxedSeats: artifactSeats.filter((seat) => {
                  const style = getComputedStyle(seat);
                  const widths = [
                    style.borderTopWidth,
                    style.borderRightWidth,
                    style.borderBottomWidth,
                    style.borderLeftWidth,
                  ].map((width) => Number.parseFloat(width) || 0);
                  return (
                    widths.every((width) => width > 0) ||
                    (Number.parseFloat(style.borderTopLeftRadius) || 0) > 0 ||
                    style.backgroundColor !== "rgba(0, 0, 0, 0)"
                  );
                }).length,
              }
            : null,
          chapters,
          lower: lowerChapters.map((chapter) => box(chapter)),
          viewport: { width: window.innerWidth, height: window.innerHeight },
          documentOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        };
      });

    const assertRegister = async (label, expected) => {
      const layout = await read();
      checked += 1;
      const keys = layout.chapters.map((chapter) => chapter.key);
      const indices = layout.chapters.map((chapter) => chapter.index);
      const titles = layout.chapters.map((chapter) => chapter.title);
      const facts = layout.chapters.map((chapter) => chapter.fact);
      const brokenChapters = layout.chapters.filter(
        (chapter) =>
          !chapter.hasHead ||
          chapter.radius !== 0 ||
          chapter.shadow !== "none" ||
          chapter.background !== "rgba(0, 0, 0, 0)" ||
          chapter.borderWidths.every((width) => width > 0),
      );
      const registerOk =
        layout.register &&
        layout.register.borderTop >= 1 &&
        layout.register.borderBottom >= 1 &&
        layout.register.borderLeft === 0 &&
        layout.register.borderRight === 0 &&
        layout.register.radius === 0 &&
        layout.register.shadow === "none" &&
        layout.register.background === "rgba(0, 0, 0, 0)" &&
        layout.register.legacyChapterHeads === 0 &&
        layout.register.oldShells === 0 &&
        layout.register.rect?.scrollWidth <= layout.register.rect?.clientWidth + 1;
      const factsOk = expected.facts.every((pattern, index) => pattern.test(facts[index] || ""));
      const stacked =
        layout.lower.length <= 1 ||
        layout.lower.every(
          (rect, index) => index === 0 || layout.lower[index - 1].bottom <= rect.top + 1,
        );
      if (
        layout.tab !== expected.tab ||
        keys.join(",") !== expected.keys.join(",") ||
        indices.join(",") !== expected.indices.join(",") ||
        titles.join(",") !== expected.titles.join(",") ||
        !factsOk ||
        !registerOk ||
        brokenChapters.length > 0 ||
        layout.documentOverflow ||
        (expected.stacked && !stacked)
      ) {
        failures.push(
          `[${label}] 行囊四签没有收成同一册:` +
            `页签=${layout.tab} / 章=${keys.join(",")} / 章号=${indices.join(",")} / ` +
            `章名=${JSON.stringify(titles)} / 章内真值=${JSON.stringify(facts)} / ` +
            `续排=${stacked} / 散章=${JSON.stringify(brokenChapters)} / ` +
            `账页=${JSON.stringify(layout.register)}`,
        );
      }
      return layout;
    };

    const equip = await assertRegister("390-装备", {
      tab: "equip",
      keys: ["briefing", "seats", "collection"],
      indices: ["壹", "贰", "叁"],
      titles: ["今日检点", "九佩", "藏品"],
      facts: [/^$/, /^\d+ \/ 9 已佩$/, /^$/],
      stacked: true,
    });
    if (equip.register?.ledgerCells !== 0 || equip.register?.artifactPanel) {
      failures.push("[390-装备] 行囊装备签混进了丹药/材料格或法宝面板");
    }

    await page.getByRole("tab", { name: "丹药" }).click({ timeout: 3000 });
    await settleVisuals(page);
    const pill = await assertRegister("390-丹药", {
      tab: "pill",
      keys: ["workshop", "cabinet"],
      indices: ["壹", "贰"],
      titles: ["丹房", "丹匣"],
      facts: [/^\d+ 方 · .+灵草 \d+$/, /^\d+ 味 · \d+ 枚$/],
      stacked: true,
    });
    if (pill.register?.workshopEntries !== 2 || pill.register?.ledgerCells < 1) {
      failures.push(`[390-丹药] 丹房入口或丹匣账格没有落齐(${JSON.stringify(pill.register)})`);
    }
    if (SHOTS) {
      mkdirSync(SHOTS_DIR, { recursive: true });
      await page.screenshot({ path: join(SHOTS_DIR, "390-inventory-pill-register.png") });
    }

    await page.getByRole("tab", { name: "材料" }).click({ timeout: 3000 });
    await settleVisuals(page);
    const material = await assertRegister("390-材料", {
      tab: "material",
      keys: ["craft", "stock"],
      indices: ["壹", "贰"],
      titles: ["炉材", "账材"],
      facts: [/^\d+ 类$/, /^\d+ 类$/],
      stacked: true,
    });
    if (material.register?.ledgerCells !== 6) {
      failures.push(`[390-材料] 材簿应摊开 6 类,实见 ${material.register?.ledgerCells} 格`);
    }
    if (SHOTS) {
      await page.screenshot({ path: join(SHOTS_DIR, "390-inventory-material-register.png") });
    }

    await page.getByRole("tab", { name: "法宝" }).click({ timeout: 3000 });
    await settleVisuals(page);
    const artifact = await assertRegister("390-法宝", {
      tab: "artifact",
      keys: ["artifact"],
      indices: ["壹"],
      titles: ["法宝"],
      facts: [/^\d+ 件 · \d+ 随身$/],
      stacked: true,
    });
    if (!artifact.register?.artifactPanel) {
      failures.push("[390-法宝] 法宝章节里没有法宝阵账面板");
    }
    checked += 1;
    if (
      !artifact.artifactSurface?.register ||
      !artifact.artifactSurface.emptyMarker ||
      artifact.artifactSurface.emptyTextCount !== 1 ||
      artifact.artifactSurface.seats !== 2 ||
      artifact.artifactSurface.boxedSeats !== 0
    ) {
      failures.push(
        `[390-法宝] 空册没有收成一页阵位长账:` + JSON.stringify(artifact.artifactSurface),
      );
    }
    if (SHOTS) {
      await page.screenshot({ path: join(SHOTS_DIR, "390-inventory-artifact-register.png") });
    }

    await page.setViewportSize({ width: 1280, height: 900 });
    for (const [name, label] of [
      ["丹药", "pill"],
      ["材料", "material"],
    ]) {
      await page.getByRole("tab", { name }).click({ timeout: 3000 });
      await settleVisuals(page);
      const pair = await read();
      checked += 1;
      const sameRow =
        pair.lower.length === 2 &&
        Math.abs(pair.lower[0].top - pair.lower[1].top) <= 2 &&
        pair.lower[1].left >= pair.lower[0].right - 1;
      if (!sameRow || pair.documentOverflow) {
        failures.push(`[1280-${label}] 行囊两章没有左右并读(${JSON.stringify(pair.lower)})`);
      }
    }
    if (SHOTS) {
      await page.getByRole("tab", { name: "丹药" }).click({ timeout: 3000 });
      await settleVisuals(page);
      await page.screenshot({ path: join(SHOTS_DIR, "1280-inventory-pill-register.png") });
    }

    await page.setViewportSize({ width: 195, height: 422 });
    for (const [name, label] of [
      ["装备", "equip"],
      ["丹药", "pill"],
      ["材料", "material"],
      ["法宝", "artifact"],
    ]) {
      await page.getByRole("tab", { name }).click({ timeout: 3000 });
      await settleVisuals(page);
      const narrow = await read();
      checked += 1;
      const factsBelow = narrow.chapters
        .filter((chapter) => chapter.fact)
        .every(
          (chapter) =>
            chapter.titleTop !== null &&
            chapter.factTop !== null &&
            chapter.factTop >= chapter.titleTop,
        );
      const chapterProblems = [...(await Promise.resolve(problemsOf(await measurePage(page))))];
      if (narrow.documentOverflow || !factsBelow || chapterProblems.length > 0) {
        failures.push(
          `[195-${label}] 行囊续卷的章内读数或窄屏排版不合格:` +
            `横向溢出=${narrow.documentOverflow} / 真值下移=${factsBelow} / ` +
            `页面=${chapterProblems.join(" / ") || "无"}`,
        );
      }
      if (SHOTS) {
        await page.screenshot({ path: join(SHOTS_DIR, `195-inventory-${label}-register.png`) });
      }
    }

    if (pageErrors.length) {
      failures.push(`[行囊四签] 页面异常:${[...new Set(pageErrors)].join(" | ")}`);
    }
  } finally {
    await ctx.close();
  }
  return { failures, checked, contrastFails: [], pixelContrastFails: [], zoomFails: [] };
}

/** 门庭先报今日:四门存底、选签确认、在途进度与一令齐发 */
async function taskApprenticePulse() {
  const failures = [];
  let checked = 0;
  const contrastFails = [];
  const pixelContrastFails = [];
  const zoomFails = [];
  const ctx = await auditContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  try {
    const now = Date.now();
    const slices = showcaseSlices("light");
    slices.apprentice = {
      apprentices: [
        { uid: "pulse_idle", archId: "ap_luanniao", level: 2, bond: 4, task: null },
        { uid: "pulse_idle_2", archId: "ap_daotong", level: 1, bond: 0, task: null },
        {
          uid: "pulse_away",
          archId: "ap_kuangtou",
          level: 3,
          bond: 12,
          task: {
            spec: "herb",
            startAt: now - 15 * 60_000,
            finishAt: now + 15 * 60_000,
            rewardMajor: 9,
          },
        },
      ],
      rebirthKarma: 0,
    };
    await seedSave(ctx, slices, "__apprenticePulseFixture");

    const page = await ctx.newPage();
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    const textLength = await openRoute(page, "/apprentice", 800);
    if (textLength === 0) failures.push("[390] 门庭场景:页面没有渲染出来");
    await clearOverlays(page);

    const read = () =>
      page.evaluate(() => {
        const pulse = document.querySelector("[data-apprentice-pulse]");
        const order = pulse?.querySelector("[data-apprentice-order]");
        const depot = pulse?.querySelector("[data-apprentice-depot]");
        const dispatch = pulse?.querySelector("[data-apprentice-dispatch-all]");
        const taskRows = [...document.querySelectorAll("[data-apprentice-task-progress]")];
        const bars = [...document.querySelectorAll('[role="progressbar"]')];
        const rect = (el) => {
          const box = el?.getBoundingClientRect();
          return box
            ? {
                top: Math.round(box.top),
                bottom: Math.round(box.bottom),
                left: Math.round(box.left),
                right: Math.round(box.right),
                width: Math.round(box.width),
                height: Math.round(box.height),
              }
            : null;
        };
        const orderRect = rect(order);
        const depotRect = rect(depot);
        const dispatchRect = rect(dispatch);
        const dockTop = document.querySelector("[data-folio-dock]")?.getBoundingClientRect().top;
        const foldBottom = Math.min(window.innerHeight, dockTop ?? window.innerHeight);
        const needs = [...document.querySelectorAll("[data-apprentice-need]")].map((row) => ({
          spec: row.getAttribute("data-apprentice-need"),
          name: (row.querySelector(".apprentice-depot__name")?.textContent || "")
            .replace(/\s+/g, " ")
            .trim(),
          value: (row.querySelector(".apprentice-depot__value")?.textContent || "")
            .replace(/\s+/g, " ")
            .trim(),
          target: row.hasAttribute("data-dispatch-target"),
          tied: row.hasAttribute("data-dispatch-tied"),
        }));
        return {
          total: Number(pulse?.getAttribute("data-apprentice-total")),
          idle: Number(pulse?.getAttribute("data-apprentice-idle")),
          away: Number(pulse?.getAttribute("data-apprentice-away")),
          next: (pulse?.querySelector("[data-apprentice-next-return]")?.textContent || "")
            .replace(/\s+/g, " ")
            .trim(),
          progress: taskRows.map((row) =>
            Number(row.getAttribute("data-apprentice-task-progress")),
          ),
          aria: bars.map((bar) => Number(bar.getAttribute("aria-valuenow"))),
          dispatchDisabled: dispatch?.hasAttribute("disabled") ?? true,
          dispatchText: (dispatch?.textContent || "").replace(/\s+/g, " ").trim(),
          dispatchAria: (dispatch?.getAttribute("aria-label") || "").trim(),
          orderTitle: (order?.querySelector(".apprentice-order__title-full")?.textContent || "")
            .replace(/\s+/g, " ")
            .trim(),
          orderNote: (order?.querySelector(".apprentice-order__note")?.textContent || "")
            .replace(/\s+/g, " ")
            .trim(),
          order: orderRect,
          dispatchRect,
          depotTop: depotRect?.top ?? null,
          orderBeforeDepot:
            Boolean(orderRect && depotRect) && orderRect.bottom <= depotRect.top + 1,
          actionInFold:
            Boolean(dispatchRect) && dispatchRect.top >= 0 && dispatchRect.bottom <= foldBottom + 1,
          needs,
        };
      });

    const initial = await read();
    checked += 1;
    if (initial.total !== 3 || initial.idle !== 2 || initial.away !== 1) {
      failures.push(
        `[390] 门庭场景:卷首应为 3 名 / 在途 1 / 闲置 2,实见 ` +
          `${initial.total} / ${initial.away} / ${initial.idle}`,
      );
    }
    if (!initial.next.includes("采灵药")) {
      failures.push(`[390] 门庭场景:最近归期没有指向在途的采灵药(«${initial.next}»)`);
    }
    if (
      initial.progress.length !== 1 ||
      !(initial.progress[0] > 0.35 && initial.progress[0] < 0.65)
    ) {
      failures.push(
        `[390] 门庭场景:在途差事进度应接近一半,实见 ${initial.progress.join(",") || "无"}`,
      );
    }
    if (initial.aria.length !== 1 || Math.abs(initial.aria[0] - initial.progress[0] * 100) > 1) {
      failures.push(
        `[390] 门庭场景:进度条读屏值 ${initial.aria.join(",") || "无"} ` +
          `与可视进度 ${initial.progress.join(",") || "无"} 不同源`,
      );
    }
    if (initial.needs.length !== 4) {
      failures.push(`[390] 门庭场景:四门存底应列 4 门,实见 ${initial.needs.length} 门`);
    }
    const targetNeeds = initial.needs.filter((row) => row.target);
    const tiedNeeds = initial.needs.filter((row) => row.tied);
    if (targetNeeds.length === 0 && tiedNeeds.length < 2) {
      failures.push("[390] 门庭场景:四门既没有唯一目标,也没有至少两门同分");
    }
    if (targetNeeds.length > 0 && !initial.orderTitle.includes(targetNeeds[0].name)) {
      failures.push(
        `[390] 门庭场景:存底目标 «${targetNeeds[0].name}» 与案头令 «${initial.orderTitle}» 不同源`,
      );
    }
    if (
      initial.dispatchDisabled ||
      !initial.orderTitle.includes("派闲置 2 人") ||
      !initial.dispatchAria.includes("派闲置 2 人")
    ) {
      failures.push(
        `[390] 门庭场景:案头令没有报出这次会派走 2 人` +
          `(«${initial.orderTitle}» / «${initial.dispatchAria}» / «${initial.dispatchText}» )`,
      );
    }
    if (!initial.orderNote.includes("灵石兜底") && !initial.orderNote.includes("四门缺度最高")) {
      failures.push(`[390] 门庭场景:案头令没有摊开择门依据(«${initial.orderNote}»)`);
    }
    checked += 1;
    if (
      !initial.order ||
      !initial.dispatchRect ||
      !initial.orderBeforeDepot ||
      !initial.actionInFold ||
      initial.dispatchRect.width > initial.order.width * 0.6
    ) {
      failures.push(
        `[390] 门庭场景:案头令没有先于存底出现在首屏,或动作签又拉成整行:` +
          `${JSON.stringify({
            order: initial.order,
            dispatch: initial.dispatchRect,
            depotTop: initial.depotTop,
            orderBeforeDepot: initial.orderBeforeDepot,
            actionInFold: initial.actionInFold,
          })}`,
      );
    }

    const readRegister = () =>
      page.evaluate(() => {
        const register = document.querySelector("[data-apprentice-register]");
        const pulse = register?.querySelector("[data-apprentice-pulse]");
        const roster = register?.querySelector("[data-apprentice-roster]");
        const rules = register?.querySelector(".apprentice-rules");
        const order = register?.querySelector("[data-apprentice-order]");
        const dispatch = register?.querySelector("[data-apprentice-dispatch-all]");
        const chapters = [...(register?.querySelectorAll("[data-apprentice-chapter]") ?? [])];
        const chapterHeads = [...(register?.querySelectorAll("[data-folio-chapter-head]") ?? [])];
        const choiceGrid = roster?.querySelector(".apprentice-task-choice-grid");
        const choices = [...(register?.querySelectorAll(".apprentice-task-choice") ?? [])];
        const depot = register?.querySelector(".apprentice-depot__rows");
        const depotAccent = register?.querySelector(
          ".apprentice-depot__row.is-target, .apprentice-depot__row.is-tied",
        );
        const columnsOf = (el) =>
          el ? getComputedStyle(el).gridTemplateColumns.split(/\s+/).filter(Boolean).length : 0;
        const chrome = (el) => {
          const style = el ? getComputedStyle(el) : null;
          return style
            ? {
                borders: [
                  style.borderTopWidth,
                  style.borderRightWidth,
                  style.borderBottomWidth,
                  style.borderLeftWidth,
                ],
                background: style.backgroundColor,
                image: style.backgroundImage,
                shadow: style.boxShadow,
                radius: style.borderTopLeftRadius,
              }
            : null;
        };
        return {
          found: Boolean(register && pulse && roster && rules),
          chapters: chapters.map((chapter) => {
            const rect = chapter.getBoundingClientRect();
            return {
              id: chapter.getAttribute("data-apprentice-chapter"),
              top: Math.round(rect.top),
              bottom: Math.round(rect.bottom),
              left: Math.round(rect.left),
              right: Math.round(rect.right),
              borderTop: getComputedStyle(chapter).borderTopWidth,
            };
          }),
          heads: chapterHeads.map((head) => ({
            chapter: head
              .closest("[data-apprentice-chapter]")
              ?.getAttribute("data-apprentice-chapter"),
            index: (head.querySelector(".folio-chapter-head__index")?.textContent || "").trim(),
            title: (head.querySelector(".folio-chapter-head__title")?.textContent || "").trim(),
            fact: (head.querySelector(".folio-chapter-head__fact")?.textContent || "").trim(),
          })),
          pulseHasLedgerHead: Boolean(pulse?.querySelector("[data-folio-ledger-head]")),
          legacyChapterHeads:
            register?.querySelectorAll(".section-title, [data-folio-section-mark]").length ?? -1,
          register: chrome(register),
          order: chrome(order),
          orderRect: order
            ? {
                top: Math.round(order.getBoundingClientRect().top),
                bottom: Math.round(order.getBoundingClientRect().bottom),
                width: Math.round(order.getBoundingClientRect().width),
              }
            : null,
          orderBeforeDepot: Boolean(
            order &&
            depot &&
            order.getBoundingClientRect().bottom <= depot.getBoundingClientRect().top + 1,
          ),
          actionRect: dispatch
            ? {
                top: Math.round(dispatch.getBoundingClientRect().top),
                bottom: Math.round(dispatch.getBoundingClientRect().bottom),
                width: Math.round(dispatch.getBoundingClientRect().width),
              }
            : null,
          registerWidth: register ? Math.round(register.getBoundingClientRect().width) : 0,
          roster: chrome(roster),
          rules: chrome(rules),
          depot: chrome(depot),
          depotAccent: chrome(depotAccent),
          choice: choices[0]
            ? {
                ...chrome(choices[0]),
                count: choices.length,
                selected: choices.filter((choice) =>
                  choice.hasAttribute("data-apprentice-selected"),
                ).length,
              }
            : null,
          columns: {
            depot: columnsOf(depot),
            choices: columnsOf(choiceGrid),
            rules: columnsOf(rules),
          },
        };
      });

    const fold = await readRegister();
    const width = (value) => parseFloat(value);
    checked += 1;
    if (
      !fold.found ||
      fold.chapters.map((chapter) => chapter.id).join(",") !== "pulse,roster,rules" ||
      fold.chapters.some(
        (chapter, index) => index > 0 && chapter.top <= fold.chapters[index - 1].top,
      ) ||
      width(fold.chapters[0]?.borderTop) !== 0 ||
      fold.chapters.slice(1).some((chapter) => width(chapter.borderTop) < 1)
    ) {
      failures.push(`[390] 门庭续卷没有按总账、值日簿、门规三章续排:${JSON.stringify(fold)}`);
    }
    checked += 1;
    if (
      fold.heads.map((head) => head.chapter).join(",") !== "pulse,roster,rules" ||
      fold.heads.map((head) => head.index).join(",") !== "壹,贰,叁" ||
      fold.heads.map((head) => head.title).join(",") !== "案头一令,值日簿,门规" ||
      fold.heads.some((head) => head.fact.length === 0) ||
      fold.pulseHasLedgerHead ||
      fold.legacyChapterHeads !== 0
    ) {
      failures.push(`[390] 门庭三章没有共用专用章首:${JSON.stringify(fold.heads)}`);
    }
    checked += 1;
    if (
      !fold.register ||
      width(fold.register.borders[0]) < 1 ||
      width(fold.register.borders[2]) < 1 ||
      width(fold.register.borders[1]) !== 0 ||
      width(fold.register.borders[3]) !== 0 ||
      fold.register.background !== "rgba(0, 0, 0, 0)" ||
      fold.register.shadow !== "none" ||
      !fold.roster ||
      fold.roster.borders.some((value) => width(value) !== 0) ||
      fold.roster.background !== "rgba(0, 0, 0, 0)" ||
      fold.roster.shadow !== "none" ||
      !fold.rules ||
      fold.rules.borders.some((value) => width(value) !== 0) ||
      fold.rules.background !== "rgba(0, 0, 0, 0)" ||
      fold.rules.shadow !== "none"
    ) {
      failures.push(`[390] 门庭续卷又套回了卡壳:${JSON.stringify(fold)}`);
    }
    checked += 1;
    if (
      !fold.depot ||
      width(fold.depot.borders[0]) < 1 ||
      width(fold.depot.borders[2]) < 1 ||
      width(fold.depot.borders[1]) !== 0 ||
      width(fold.depot.borders[3]) !== 0 ||
      fold.depot.background !== "rgba(0, 0, 0, 0)" ||
      fold.depot.shadow !== "none" ||
      fold.depot.radius !== "0px" ||
      !fold.depotAccent ||
      width(fold.depotAccent.borders[1]) !== 0 ||
      fold.depotAccent.background !== "rgba(0, 0, 0, 0)" ||
      !fold.depotAccent.shadow.includes("2px 0px 0px 0px inset") ||
      fold.depotAccent.shadow.includes("0px 0px 0px 1px inset")
    ) {
      failures.push(`[390] 四门存底又套回四边表:${JSON.stringify(fold)}`);
    }
    checked += 1;
    if (
      !fold.order ||
      width(fold.order.borders[0]) < 1 ||
      width(fold.order.borders[2]) < 1 ||
      width(fold.order.borders[1]) !== 0 ||
      width(fold.order.borders[3]) !== 0 ||
      !fold.order.image.includes("linear-gradient") ||
      fold.order.shadow !== "none" ||
      !fold.orderRect ||
      !fold.actionRect ||
      !fold.orderBeforeDepot ||
      fold.actionRect.width > fold.orderRect.width * 0.6
    ) {
      failures.push(`[390] 案头令又退回整宽红条或落到存底之后:${JSON.stringify(fold)}`);
    }
    checked += 1;
    if (
      !fold.choice ||
      fold.choice.count !== 10 ||
      fold.choice.radius !== "0px" ||
      fold.choice.borders.some((value) => width(value) !== 0) ||
      fold.choice.background !== "rgba(0, 0, 0, 0)" ||
      fold.choice.shadow !== "none" ||
      fold.choice.selected !== 0
    ) {
      failures.push(`[390] 候差差事签没有收成连续账行:${JSON.stringify(fold.choice)}`);
    }

    await page.setViewportSize({ width: 195, height: 422 });
    await settleVisuals(page);
    const zoom = await readRegister();
    checked += 1;
    if (zoom.columns.depot !== 1 || zoom.columns.choices !== 1 || zoom.columns.rules !== 1) {
      failures.push(`[195] 门庭续卷没有退成单列:${JSON.stringify({ columns: zoom.columns })}`);
    }
    const zoomProblems = problemsOf(await measurePage(page));
    checked += 1;
    if (zoomProblems.length) failures.push(`[195] 门庭续卷 → ${zoomProblems.join(" / ")}`);

    await page.setViewportSize({ width: 1280, height: 800 });
    await settleVisuals(page);
    const wide = await readRegister();
    checked += 1;
    if (wide.columns.depot !== 4 || wide.columns.choices !== 3 || wide.columns.rules !== 1) {
      failures.push(`[1280] 门庭续卷没有按桌面档并读:${JSON.stringify({ columns: wide.columns })}`);
    }
    checked += 1;
    if (
      !wide.orderBeforeDepot ||
      !wide.orderRect ||
      !wide.actionRect ||
      wide.actionRect.width > wide.orderRect.width * 0.28 ||
      wide.actionRect.width > wide.registerWidth * 0.3
    ) {
      failures.push(
        `[1280] 案头令没有收成窄动作签:${JSON.stringify({
          order: wide.orderRect,
          action: wide.actionRect,
          registerWidth: wide.registerWidth,
          orderBeforeDepot: wide.orderBeforeDepot,
        })}`,
      );
    }
    checked += 1;
    const [widePulse, wideRoster, wideRules] = wide.chapters;
    if (
      !widePulse ||
      !wideRoster ||
      !wideRules ||
      Math.abs(wideRoster.top - wideRules.top) > 2 ||
      wideRoster.right > wideRules.left ||
      widePulse.left > wideRoster.left ||
      widePulse.right < wideRules.right
    ) {
      failures.push(
        `[1280] 门庭续卷没有摊成“首章通栏、正文与门规左右并读”:` +
          `${JSON.stringify(wide.chapters)}`,
      );
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await settleVisuals(page);
    await page
      .locator('[data-apprentice-task-choice="pulse_idle_2:seek"]')
      .click({ timeout: 3000 });
    await settleVisuals(page);
    const picked = await read();
    const ticketText = ((await page.locator("[data-apprentice-task-ticket]").textContent()) || "")
      .replace(/\s+/g, " ")
      .trim();
    if (picked.progress.length !== 1 || picked.idle !== 2) {
      failures.push(
        `[390] 门庭场景:只选差事签就改变了在途人数(进度 ${picked.progress.length} / 候差 ${picked.idle})`,
      );
    }
    if (
      !ticketText.includes("寻机缘") ||
      !ticketText.includes("锁 60 分") ||
      !ticketText.includes("归来可得")
    ) {
      failures.push(`[390] 门庭场景:差事票面没有摊开名称、时长与所得(«${ticketText}»)`);
    }

    await page.locator("[data-apprentice-dispatch-confirm]").click({ timeout: 3000 });
    await page.waitForFunction(
      () =>
        document.querySelector("[data-apprentice-pulse]")?.getAttribute("data-apprentice-idle") ===
        "1",
      { timeout: 3000 },
    );
    await settleVisuals(page);
    const afterManual = await read();
    checked += 1;
    if (afterManual.total !== 3 || afterManual.idle !== 1 || afterManual.away !== 2) {
      failures.push(
        `[390] 门庭场景:确认单签后应为在途 2 / 闲置 1,实见 ` +
          `${afterManual.away} / ${afterManual.idle}`,
      );
    }
    if (
      afterManual.progress.length !== 2 ||
      !afterManual.progress.some((value) => value > 0 && value < 1)
    ) {
      failures.push(
        `[390] 门庭场景:确认单签后应有 2 条在途进度,实见 ${afterManual.progress.join(",")}`,
      );
    }

    await page.locator("[data-apprentice-dispatch-all]").click({ timeout: 3000 });
    await page.waitForFunction(
      () =>
        document.querySelector("[data-apprentice-pulse]")?.getAttribute("data-apprentice-idle") ===
        "0",
      { timeout: 3000 },
    );
    await settleVisuals(page);
    const after = await read();
    checked += 1;
    if (after.total !== 3 || after.idle !== 0 || after.away !== 3) {
      failures.push(
        `[390] 门庭场景:一键派发后应为在途 3 / 闲置 0,实见 ` + `${after.away} / ${after.idle}`,
      );
    }
    if (
      !after.dispatchDisabled ||
      !after.orderTitle.includes("弟子都在路上") ||
      after.progress.length !== 3 ||
      after.aria.length !== 3
    ) {
      failures.push(
        `[390] 门庭场景:派完后案头令«${after.orderTitle}» / 动作«${after.dispatchText}» / ` +
          `进度 ${after.progress.length} 条,应与卷首一起换口`,
      );
    }

    if (pageErrors.length)
      failures.push(`[390] 门庭场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
    console.log(
      `\n门庭今日:在途 ${initial.away} / 闲置 ${initial.idle} · 最近 ${initial.next} · ` +
        `四门 ${initial.needs.map((row) => `${row.name} ${row.value}`).join(" / ")} · ` +
        `单签确认后 ${afterManual.away} / ${afterManual.idle} · ` +
        `一键派发后 ${after.away} / ${after.idle}`,
    );
  } finally {
    await ctx.close();
  }
  return { failures, checked, contrastFails, pixelContrastFails, zoomFails };
}

/** 一键分解先勾后点 */
async function taskDecompose() {
  const failures = [];
  let checked = 0;
  const contrastFails = [];
  const pixelContrastFails = [];
  const zoomFails = [];
  // ---- 第二十五件事:一键分解要「先勾后点」,勾品质不许当场把东西烧了 ----
  /*
   * 勾选框的语义是**标记**,不是**执行** —— 玩家勾「精品」是想说「精品算废料」,
   * 不是想让行囊里的精品立刻消失。此前 toggleRank 在勾上的一瞬间就调了
   * decomposeByRanks,于是「勾一下就没了」,勾错了没得后悔,也看不到会拆掉几件。
   * 判据按玩家的动作顺序核两拍:
   *   一 勾上「精品」之后 —— 行囊件数一件不能少,也不能出现「化作器灵尘」的交代;
   *   二 再点下方「分 解(2 件)」 —— 这才能少,而且要少出个交代来。
   * 顺带核第二笔账:练过的那件拆了要按八成退强化投入。夹具里一件 0 级、一件 +4
   * (记账投入尘 100 / 灵石 8000),故返还 = 底材4 + (底材4 + 八成尘80) = 88 尘 + 灵石 6400,
   * 并且提示里写的数必须与器灵尘那一栏真涨的数对得上(所见即所得)。
   * (勾选仍然会被记住,并继续管着「此后拾取自动回收」;那条是不占行囊的入包裁决,与本题无关。)
   */
  {
    const ctx = await auditContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    });
    const enc = encryptSlice;
    const gn = (m, e) => ({ m, e });
    const slices = {
      game: {
        started: true,
        saveVersion: 2,
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
        totalPlaySec: 0,
        createRerolls: 8,
        createProfile: null,
      },
      player: {
        name: "分解自检",
        major: 5,
        sub: 3,
        exp: gn(1, 2),
        age: 40,
        lifespanBonusYears: 0,
        dead: false,
        reincarnation: {
          count: 0,
          daoFruit: 0,
          talents: [],
          insight: 0,
          lives: [],
          vow: null,
          trial: null,
          bonds: [],
        },
        linggen: {
          roots: [{ element: "wood", aptitude: 70 }],
          gradeName: "单灵根",
          growthMult: 1.1,
        },
      },
      resources: { spiritStone: gn(1, 6), qi: 1000, wudao: 10, herb: 5, ore: 5, page: 2, dust: 0 },
      inventory: {
        items: [
          {
            uid: "b_1",
            templateId: "b_qingyun",
            quality: "excellent",
            tier: 3,
            level: 0,
            affixes: [],
          },
          {
            uid: "b_2",
            templateId: "b_qingyun",
            quality: "excellent",
            tier: 3,
            level: 4,
            affixes: [],
            invested: { dust: 100, stone: gn(8, 3) },
          },
        ],
        equipped: {},
        pills: {},
        artifacts: [],
        equippedArtifacts: [],
      },
      endgame: { daoPath: null, daoSource: 0, souls: [], equippedSouls: [] },
      settings: {
        privacyAccepted: true,
        sfxOn: false,
        musicOn: false,
        musicVol: 0,
        sfxVol: 0,
        reduceMotion: true,
        battleSpeed: 4,
        decomposeRanks: [],
        smartKeep: { enabled: true, minQuality: 3, keepCoreAffix: true, keepComboPiece: true },
        theme: "light",
      },
    };
    await ctx.addInitScript(
      (data) => {
        if (localStorage.getItem("__layoutSeeded")) return;
        for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
        localStorage.setItem("__layoutSeeded", "1");
      },
      Object.fromEntries(Object.entries(slices).map(([k, v]) => [`${SAVE_PREFIX}${k}`, enc(v)])),
    );
    const page = await ctx.newPage();
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    await page.goto(INDEX + "#" + "/inventory", { waitUntil: "load" });
    await page.waitForTimeout(2400);
    await clearOverlays(page);
    checked += 1;
    /** 行囊件数(只读 main;弹窗 Teleport 到 body,不在这棵子树里) */
    const bagCount = () =>
      page.evaluate(() => {
        const raw = document
          .querySelector("[data-inventory-bag-count]")
          ?.getAttribute("data-inventory-bag-count");
        return raw === null || raw === undefined ? null : Number(raw);
      });
    /** 背包页顶上那栏「器灵尘 N」 */
    const dustCount = () =>
      page.evaluate(() => {
        const m = /器灵尘\s*([\d,]+)/.exec(document.querySelector("main")?.innerText || "");
        return m ? Number(m[1].replace(/,/g, "")) : null;
      });
    const toasts = () =>
      page.evaluate(() =>
        [...document.querySelectorAll(".pointer-events-none.fixed button")]
          .map((b) => (b.textContent || "").trim())
          .join("|"),
      );
    const opened = await page
      .locator("main")
      .getByRole("button", { name: "批量分解装备" })
      .click({ timeout: 3000 })
      .then(() => true)
      .catch(() => false);
    if (!opened) failures.push("[390] 分解场景:行囊页找不到「分解」入口");
    else {
      await page.waitForTimeout(400);
      const before = await bagCount();
      if (before !== 2) failures.push(`[390] 分解场景:夹具没铺好 —— 开局行囊 ${before} 件(应为 2)`);
      const box = page
        .locator(".modal-panel label", { hasText: "精品" })
        .locator("input[type=checkbox]")
        .first();
      const ticked = await box
        .click({ timeout: 3000 })
        .then(() => true)
        .catch(() => false);
      if (!ticked) failures.push("[390] 分解场景:弹窗里找不到「精品」的勾选框");
      await page.waitForTimeout(900);
      const marked = await bagCount();
      const markedToast = await toasts();
      if (marked !== 2)
        failures.push(
          `[390] 分解场景:只勾了「精品」,行囊就从 ${before} 件变成 ${marked} 件 —— 勾选把东西当场烧了(应先标记、等「分 解」)`,
        );
      if (/化作器灵尘/.test(markedToast))
        failures.push(
          `[390] 分解场景:勾选品质就弹了销毁交代(${markedToast})—— 玩家还没点「分 解」`,
        );
      const footLabel = (
        (await page
          .locator(".modal-panel footer button")
          .first()
          .textContent()
          .catch(() => "")) || ""
      )
        .replace(/\s+/g, " ")
        .trim();
      if (!/分\s*解\s*\(2\s*件\)/.test(footLabel)) {
        failures.push(`[390] 分解场景:勾选后按钮没写出「会拆几件」——「${footLabel}」`);
      }
      if (marked === 2) {
        const dustBefore = await dustCount();
        await page
          .locator(".modal-panel footer button")
          .first()
          .click({ timeout: 3000 })
          .catch(() => {});
        await page.waitForTimeout(900);
        const after = await bagCount();
        const afterToast = await toasts();
        if (after !== 0)
          failures.push(`[390] 分解场景:点了「分 解」行囊还剩 ${after} 件(两件精品都该拆掉)`);
        if (!/已分解\s*2\s*件/.test(afterToast))
          failures.push(`[390] 分解场景:点「分 解」之后没有交代(${afterToast || "无提示"})`);
        const promised = Number((/得器灵尘×(\d+)/.exec(afterToast) || [])[1] ?? NaN);
        const dustAfter = await dustCount();
        if (promised !== 88) {
          failures.push(
            `[390] 分解场景:两件精品(其中一件 +4,记账投入尘 100)该退 88 尘,提示写的是 ${promised}`,
          );
        }
        if (!/退灵石\s*6,400/.test(afterToast))
          failures.push(`[390] 分解场景:练过的件没退灵石(记了 8000,该退 6400)—— ${afterToast}`);
        if (dustBefore === null || dustAfter === null || dustAfter - dustBefore !== promised) {
          failures.push(
            `[390] 分解场景:提示说给 ${promised} 尘,器灵尘那一栏 ${dustBefore} → ${dustAfter}(所见非所得)`,
          );
        }
        if (promised === 88 && dustAfter - dustBefore === 88) {
          console.log(
            `\n一键分解:勾「精品」行囊仍是 ${marked} 件(未烧) · 「${footLabel}」→ 行囊 ${after} 件 · 得尘 ${promised}(对上,含强化八成)· 退灵石 6,400`,
          );
        }
      }
    }
    if (pageErrors.length)
      failures.push(`[390] 分解场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
    await ctx.close();
  }

  return { failures, checked, contrastFails, pixelContrastFails, zoomFails };
}

/** 法宝炼化的两笔账 */
async function taskArtifactRefine() {
  const failures = [];
  let checked = 0;
  const contrastFails = [];
  const pixelContrastFails = [];
  const zoomFails = [];
  // ---- 第二十四件事:法宝「炼化」的两笔账,一笔都不能少写 ----
  /*
   * 炼化既扣悟道点、也扣灵石(见 forge.artifactUpCost),而按钮此前只写「悟道 N」——
   * 玩家按标签算账,回头发现灵石也少了一大截。判据两件:
   *   一 按钮上必须把两种代价都写出来;
   *   二 两种都按所写扣(读数取磁盘精确值,并等开局奖励落定)。
   */
  {
    const ctx = await auditContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    });
    const enc = encryptSlice;
    const gn = (m, e) => ({ m, e });
    const slices = {
      game: {
        started: true,
        saveVersion: 2,
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
        totalPlaySec: 0,
        createRerolls: 8,
        createProfile: null,
      },
      player: {
        name: "炼化自检",
        major: 5,
        sub: 3,
        exp: gn(1, 2),
        age: 40,
        lifespanBonusYears: 0,
        dead: false,
        reincarnation: {
          count: 0,
          daoFruit: 0,
          talents: [],
          insight: 0,
          lives: [],
          vow: null,
          trial: null,
          bonds: [],
        },
        linggen: {
          roots: [{ element: "wood", aptitude: 70 }],
          gradeName: "单灵根",
          growthMult: 1.1,
        },
      },
      resources: {
        spiritStone: gn(1, 7),
        qi: 1000,
        wudao: 5000,
        herb: 5,
        ore: 5,
        page: 2,
        dust: 2,
      },
      inventory: {
        items: [],
        equipped: {},
        pills: {},
        artifacts: [
          { defId: "af_lihuo", level: 0 },
          { defId: "af_hundun", level: 8 },
        ],
        equippedArtifacts: [],
      },
      endgame: { daoPath: null, daoSource: 0, souls: [], equippedSouls: [] },
      settings: {
        privacyAccepted: true,
        sfxOn: false,
        musicOn: false,
        musicVol: 0,
        sfxVol: 0,
        reduceMotion: true,
        battleSpeed: 4,
        decomposeRanks: [],
        smartKeep: { enabled: true, minQuality: 3, keepCoreAffix: true, keepComboPiece: true },
        theme: "light",
      },
    };
    await ctx.addInitScript(
      (data) => {
        if (localStorage.getItem("__layoutSeeded")) return;
        for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
        localStorage.setItem("__layoutSeeded", "1");
      },
      Object.fromEntries(Object.entries(slices).map(([k, v]) => [`${SAVE_PREFIX}${k}`, enc(v)])),
    );
    const page = await ctx.newPage();
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    await page.goto(INDEX, { waitUntil: "load" });
    await page.waitForTimeout(2400);
    await clearOverlays(page);
    checked += 1;
    /** 磁盘上的悟道点/灵石(等节流落盘,取精确值) */
    const readWal = async () => {
      await page.waitForTimeout(5600);
      const cipher = await page.evaluate(
        (prefix) => localStorage.getItem(`${prefix}resources`) || "",
        SAVE_PREFIX,
      );
      if (!cipher) return null;
      const plain = decryptSlice(cipher);
      if (!plain) return null;
      const r = JSON.parse(plain);
      const num = (v) => (typeof v === "number" ? v : v.m * Math.pow(10, v.e));
      return { wudao: r.wudao, stone: num(r.spiritStone) };
    };
    await page.goto(INDEX + "#" + "/inventory", { waitUntil: "load" });
    await page.waitForTimeout(900);
    await page
      .getByRole("tab", { name: /法\s*宝/ })
      .first()
      .click({ timeout: 3000 })
      .catch(() => {});
    await page.waitForTimeout(400);
    const shortfallRow = page.locator('[data-artifact-row="af_hundun"]');
    await shortfallRow.waitFor({ state: "visible", timeout: 5000 });

    async function readShortfallFit() {
      await shortfallRow
        .locator(".artifact-row__decision")
        .evaluate((el) => el.scrollIntoView({ block: "center" }));
      await settleVisuals(page);
      return shortfallRow.evaluate((row) => {
        const box = (el) => {
          if (!el) return null;
          const rect = el.getBoundingClientRect();
          return {
            left: rect.left,
            right: rect.right,
            top: rect.top,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height,
          };
        };
        const rowBox = box(row);
        const refine = [...row.querySelectorAll("button")].find((button) =>
          /炼\s*化/.test(button.textContent || ""),
        );
        const shortfall = row.querySelector("[data-artifact-shortfall]");
        const segments = (selector) =>
          [...row.querySelectorAll(selector)].map((segment) => ({
            text: (segment.textContent || "").replace(/\s+/g, " ").trim(),
            box: box(segment),
            scrollWidth: segment.scrollWidth,
            clientWidth: segment.clientWidth,
          }));
        return {
          row: rowBox,
          refine: box(refine),
          refineDisabled: refine?.hasAttribute("disabled") ?? false,
          shortfall: box(shortfall),
          shortfallText: (shortfall?.textContent || "").replace(/\s+/g, " ").trim(),
          costSegments: segments(".artifact-row__cost-segment"),
          shortfallSegments: segments(".artifact-row__shortfall-segment"),
          viewport: { width: window.innerWidth, height: window.innerHeight },
        };
      });
    }

    const shortfall390 = await readShortfallFit();
    checked += 1;
    if (
      !shortfall390.row ||
      !shortfall390.refine ||
      !shortfall390.refineDisabled ||
      !shortfall390.shortfall ||
      !shortfall390.shortfallText.includes("尚差") ||
      shortfall390.refine.left < shortfall390.row.left - 1 ||
      shortfall390.refine.right > shortfall390.row.right + 1 ||
      shortfall390.shortfall.left < shortfall390.row.left - 1 ||
      shortfall390.shortfall.right > shortfall390.row.right + 1 ||
      shortfall390.refine.top < -1 ||
      shortfall390.refine.bottom > shortfall390.viewport.height + 1 ||
      shortfall390.shortfall.top < -1 ||
      shortfall390.shortfall.bottom > shortfall390.viewport.height + 1 ||
      shortfall390.costSegments.length !== 2 ||
      shortfall390.costSegments.some(
        (segment) =>
          segment.scrollWidth > segment.clientWidth + 1 || !segment.box || segment.box.height > 26,
      ) ||
      shortfall390.shortfallSegments.length !== 2 ||
      shortfall390.shortfallSegments.some(
        (segment) =>
          segment.scrollWidth > segment.clientWidth + 1 || !segment.box || segment.box.height > 26,
      )
    ) {
      failures.push(`[390] 法宝欠料账没有把动作与差额锁在同一行:${JSON.stringify(shortfall390)}`);
    }
    if (SHOTS) {
      await page.screenshot({ path: join(SHOTS_DIR, "390_artifact-shortfall.png") });
    }

    const cheapRow = page.locator('[data-artifact-row="af_lihuo"]');
    const btn = cheapRow.locator("button", { hasText: /炼\s*化/ }).first();
    if ((await btn.count()) === 0) failures.push("[390] 炼化场景:背包「法宝」页找不到「炼化」入口");
    else {
      const label = ((await btn.textContent()) || "").replace(/\s+/g, " ").trim();
      const wantWudao = Number(
        (/悟道点?\s*([\d,]+)/.exec(label.replace(/,/g, "")) || [])[1] ?? NaN,
      );
      const stoneText = (/灵石\s*([\d,.]+)\s*(万|亿|兆)?/.exec(label) || [])[0] ?? "";
      const sm = /([\d,.]+)\s*(万|亿|兆)?/.exec(stoneText);
      const unit = sm?.[2] === "万" ? 1e4 : sm?.[2] === "亿" ? 1e8 : sm?.[2] === "兆" ? 1e12 : 1;
      const wantStone = sm ? parseFloat(sm[1].replace(/,/g, "")) * unit : NaN;
      if (!/灵石/.test(label)) {
        failures.push(`[390] 炼化场景:按钮只写了悟道、没写灵石 —— 实际两种都要扣(「${label}」)`);
      }
      const before = await readWal();
      await btn.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(400);
      const after = await readWal();
      if (before && after) {
        if (before.wudao - after.wudao !== wantWudao) {
          failures.push(
            `[390] 炼化场景:按钮写悟道 ${wantWudao},实际 ${before.wudao} → ${after.wudao}`,
          );
        }
        // 灵石是浮点(stoneByTier 会乘倍率),比较留一点容差
        if (!(Math.abs(before.stone - after.stone - wantStone) < 0.01)) {
          failures.push(
            `[390] 炼化场景:按钮写灵石 ${wantStone},实际 ${before.stone} → ${after.stone}`,
          );
        }
        console.log(
          `\n法宝炼化:「${label}」→ 悟道 ${before.wudao} → ${after.wudao} · 灵石 ${before.stone} → ${after.stone}`,
        );
      } else {
        failures.push("[390] 炼化场景:读不到资源分片(判据没跑到东西)");
      }
    }

    await page.setViewportSize({ width: 195, height: 422 });
    const shortfall195 = await readShortfallFit();
    checked += 1;
    if (
      !shortfall195.row ||
      !shortfall195.refine ||
      !shortfall195.refineDisabled ||
      !shortfall195.shortfall ||
      !shortfall195.shortfallText.includes("尚差") ||
      shortfall195.refine.left < shortfall195.row.left - 1 ||
      shortfall195.refine.right > shortfall195.row.right + 1 ||
      shortfall195.shortfall.left < shortfall195.row.left - 1 ||
      shortfall195.shortfall.right > shortfall195.row.right + 1 ||
      shortfall195.shortfall.top < shortfall195.refine.top - 1 ||
      shortfall195.refine.top < -1 ||
      shortfall195.refine.bottom > shortfall195.viewport.height + 1 ||
      shortfall195.shortfall.top < -1 ||
      shortfall195.shortfall.bottom > shortfall195.viewport.height + 1 ||
      shortfall195.costSegments.length !== 2 ||
      shortfall195.costSegments.some(
        (segment) =>
          segment.scrollWidth > segment.clientWidth + 1 || !segment.box || segment.box.height > 26,
      ) ||
      shortfall195.shortfallSegments.length !== 2 ||
      shortfall195.shortfallSegments.some(
        (segment) =>
          segment.scrollWidth > segment.clientWidth + 1 || !segment.box || segment.box.height > 26,
      )
    ) {
      failures.push(`[195] 法宝欠料账把动作或差额裁掉了:${JSON.stringify(shortfall195)}`);
    }
    if (SHOTS) {
      await page.screenshot({ path: join(SHOTS_DIR, "195_artifact-shortfall.png") });
    }
    if (pageErrors.length)
      failures.push(`[390] 炼化场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
    await ctx.close();
  }

  return { failures, checked, contrastFails, pixelContrastFails, zoomFails };
}

/** 洞府营造的账目 */
async function taskDongfuBuild() {
  const failures = [];
  let checked = 0;
  const contrastFails = [];
  const pixelContrastFails = [];
  const zoomFails = [];
  // ---- 第二十三件事:洞府营造的账目 —— 卡上写多少料,就扣多少料 ----
  /*
   * 洞府是中期最主要的一处灵石去处,卡上写着「建造 · 60石 6铁」。
   * 判据核的是**玄铁**那一半:灵石同一时间会被任务/成就奖励搅动(实测开局那一下
   * 就发了三十多万,差被冲得看不出来),而玄铁除了营造没人动它,差一分就是错。
   * 读数取自背包「材料」页(界面上的数),不去解密分片 —— 写盘是节流的,磁盘会落后。
   */
  {
    const ctx = await auditContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    });
    const enc = encryptSlice;
    const gn = (m, e) => ({ m, e });
    const slices = {
      game: {
        started: true,
        saveVersion: 2,
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
        totalPlaySec: 0,
        createRerolls: 8,
        createProfile: null,
      },
      player: {
        name: "营造自检",
        major: 5,
        sub: 3,
        exp: gn(1, 2),
        age: 40,
        lifespanBonusYears: 0,
        dead: false,
        reincarnation: {
          count: 0,
          daoFruit: 0,
          talents: [],
          insight: 0,
          lives: [],
          vow: null,
          trial: null,
          bonds: [],
        },
        linggen: {
          roots: [{ element: "wood", aptitude: 70 }],
          gradeName: "单灵根",
          growthMult: 1.1,
        },
      },
      resources: {
        spiritStone: gn(1, 7),
        qi: 1000,
        wudao: 10,
        herb: 5,
        ore: 90000,
        page: 2,
        dust: 2,
      },
      inventory: { items: [], equipped: {}, pills: {}, artifacts: [], equippedArtifacts: [] },
      endgame: { daoPath: null, daoSource: 0, souls: [], equippedSouls: [] },
      /*
       * 洞府给个≥1 的档位:首级免玄铁(ISS-303)让「建造」(0→1)不涉铁,
       * 测试对象得是「升级」才有铁账可对(第一枚按钮是洞府,优先升它)。
       */
      dongfu: { levels: { mansion: 1 }, offlineCapHours: 8 },
      settings: {
        privacyAccepted: true,
        sfxOn: false,
        musicOn: false,
        musicVol: 0,
        sfxVol: 0,
        reduceMotion: true,
        battleSpeed: 4,
        decomposeRanks: [],
        smartKeep: { enabled: true, minQuality: 3, keepCoreAffix: true, keepComboPiece: true },
        theme: "light",
      },
    };
    await ctx.addInitScript(
      (data) => {
        if (localStorage.getItem("__layoutSeeded")) return;
        for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
        localStorage.setItem("__layoutSeeded", "1");
      },
      Object.fromEntries(Object.entries(slices).map(([k, v]) => [`${SAVE_PREFIX}${k}`, enc(v)])),
    );
    const page = await ctx.newPage();
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    checked += 1;
    /**
     * 玄铁余额:**磁盘那一份**(精确到个位)。
     *
     * 界面上的分片只有万位三位小数(9万 → 8.998万),一位数的漂移会被四舍五入吃掉 ——
     * 实测把造价 +1 的注入就这样混过去了。故这里等节流落盘后解密比对,不取显示值。
     */
    const readOre = async () => {
      await page.waitForTimeout(5600);
      const cipher = await page.evaluate(
        (prefix) => localStorage.getItem(`${prefix}resources`) || "",
        SAVE_PREFIX,
      );
      if (!cipher) return { text: "(无分片)", value: null };
      const plain = decryptSlice(cipher);
      if (!plain) return { text: "(解不开)", value: null };
      const v = JSON.parse(plain).ore;
      const n = typeof v === "number" ? v : v.m * Math.pow(10, v.e);
      return { text: String(n), value: n };
    };
    // 先落到页面上:任何 localStorage 读数都要有 document 在(localStorage 才能读)
    await page.goto(INDEX, { waitUntil: "load" });
    await page.waitForTimeout(2400);
    await clearOverlays(page);
    const oreBefore = await readOre();
    await page.goto(INDEX + "#" + "/dongfu", { waitUntil: "load" });
    await page.waitForTimeout(900);
    // 账行的现效、主键与代价各自成段;按稳定指纹找第一枚真可动的营造键,
    // 不再依赖按钮文案里某个分隔符的排版。
    const buildBtn = page.locator("main [data-building-action]:not([disabled])").first();
    if ((await buildBtn.count()) === 0) {
      failures.push("[390] 营造场景:洞府页没有可动工的建筑(判据没跑到东西)");
    } else {
      const label = ((await buildBtn.textContent()) || "").replace(/\s+/g, " ").trim();
      // 资源名 7f91a90 起统一为「玄铁」,卡片代价是「· 40 玄铁」;此前只认「铁」,
      // 读「40 玄铁」解析成 NaN,营造账目判据永远红。给「玄」留可选位,兼容新旧两种写法。
      const oreCost = Number((/([\d,]+)\s*玄?铁/.exec(label.replace(/,/g, "")) || [])[1] ?? NaN);
      await buildBtn.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(800);
      const toast = await page.evaluate(() =>
        [...document.querySelectorAll(".pointer-events-none.fixed button")]
          .map((b) => (b.textContent || "").trim())
          .join("|"),
      );
      const oreAfter = await readOre();
      if (!Number.isFinite(oreCost))
        failures.push(`[390] 营造场景:读不出卡片上的玄铁价(「${label}」)`);
      else if (
        oreBefore.value === null ||
        oreAfter.value === null ||
        oreBefore.value - oreAfter.value !== oreCost
      ) {
        failures.push(
          `[390] 营造场景:卡片写「${label}」,玄铁实际 ${oreBefore.text} → ${oreAfter.text}(所见非所付)`,
        );
      }
      if (!/升至|落成|建造/.test(toast))
        failures.push(`[390] 营造场景:动工之后没有任何交代(${toast || "无提示"})`);
      console.log(
        `\n洞府营造:${label} → 玄铁 ${oreBefore.text} → ${oreAfter.text}(应扣 ${Number.isFinite(oreCost) ? oreCost : "?"})`,
      );
    }
    if (pageErrors.length)
      failures.push(`[390] 营造场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
    await ctx.close();
  }

  return { failures, checked, contrastFails, pixelContrastFails, zoomFails };
}

/** 减少动效真的减到了 */
async function taskReduceMotion() {
  const failures = [];
  let checked = 0;
  const contrastFails = [];
  const pixelContrastFails = [];
  const zoomFails = [];
  // ---- 第二十二件事:减少动效真的减到了(顺带在音效开着的情况下点一路按钮) ----
  /*
   * 「减少动效」是个容易摆设的开关:加个类名、忘了写 CSS,界面上谁也看不出来
   * (动效仍然在动,而这条设置一般是给晕动/省电的人用的)。
   * 判据按「还会不会动」来量:animation-name 仍在不算,要看 duration 与 iteration ——
   * 减动效的做法是把时长压到 0.01ms 且只跑一次。
   * 同一场里音效与音乐都开着:每次点击都会走 unlockAudio + playSfx,这条路径
   * 冒烟夹具一律关掉声音,此前没走过。
   */
  {
    const ctx = await auditContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    });
    const enc = encryptSlice;
    const gn = (m, e) => ({ m, e });
    const slices = {
      game: {
        started: true,
        saveVersion: 2,
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
        totalPlaySec: 0,
        createRerolls: 8,
        createProfile: null,
      },
      player: {
        name: "音画自检",
        major: 5,
        sub: 3,
        exp: gn(1, 2),
        age: 40,
        lifespanBonusYears: 0,
        dead: false,
        reincarnation: {
          count: 0,
          daoFruit: 0,
          talents: [],
          insight: 0,
          lives: [],
          vow: null,
          trial: null,
          bonds: [],
        },
        linggen: {
          roots: [{ element: "wood", aptitude: 70 }],
          gradeName: "单灵根",
          growthMult: 1.1,
        },
      },
      resources: { spiritStone: gn(1, 6), qi: 1000, wudao: 10, herb: 5, ore: 5, page: 2, dust: 2 },
      inventory: { items: [], equipped: {}, pills: {}, artifacts: [], equippedArtifacts: [] },
      endgame: { daoPath: null, daoSource: 0, souls: [], equippedSouls: [] },
      settings: {
        privacyAccepted: true,
        sfxOn: true,
        musicOn: true,
        musicVol: 60,
        sfxVol: 60,
        reduceMotion: false,
        battleSpeed: 4,
        decomposeRanks: [],
        smartKeep: { enabled: true, minQuality: 3, keepCoreAffix: true, keepComboPiece: true },
        theme: "light",
      },
    };
    await ctx.addInitScript(
      (data) => {
        if (localStorage.getItem("__layoutSeeded")) return;
        for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
        localStorage.setItem("__layoutSeeded", "1");
      },
      Object.fromEntries(Object.entries(slices).map(([k, v]) => [`${SAVE_PREFIX}${k}`, enc(v)])),
    );
    const page = await ctx.newPage();
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    await page.goto(INDEX, { waitUntil: "load" });
    await page.waitForTimeout(2400);
    await clearOverlays(page);
    checked += 1;
    /** 还会动的元素:名字在不算,要看时长与次数 */
    const movingCount = () =>
      page.evaluate(
        () =>
          [...document.querySelectorAll("body *")].filter((el) => {
            const cs = getComputedStyle(el);
            if (cs.animationName === "none") return false;
            const dur = cs.animationDuration.split(",").map((d) => parseFloat(d));
            const iter = cs.animationIterationCount.split(",");
            return dur.some((d) => d > 0.05) || iter.some((i) => i === "infinite");
          }).length,
      );
    const before = await movingCount();
    if (before === 0)
      failures.push("[390] 减动效场景:默认设置下界面本来就不动,这条判据证明不了什么");
    // 音效开着,一路点点按钮(每次点击都会走 unlockAudio + playSfx)
    for (const b of [0, 1, 2]) {
      await page
        .locator("main button")
        .nth(b)
        .click({ timeout: 2000 })
        .catch(() => {});
      await page.waitForTimeout(150);
    }
    await page.goto(INDEX + "#" + "/settings", { waitUntil: "load" });
    await page.waitForTimeout(700);
    const motionChoice = page.locator('[data-ink-choice="motion"]');
    const reduceMotion = motionChoice.getByRole("button", { name: "减少" });
    const fullMotion = motionChoice.getByRole("button", { name: "照常" });
    if ((await reduceMotion.count()) === 0)
      failures.push("[390] 减动效场景:设置页找不到「减少」账签");
    else {
      await reduceMotion.click({ timeout: 2500 }).catch(() => {});
      await page.waitForTimeout(400);
      const off = await movingCount();
      if (off !== 0)
        failures.push(`[390] 减动效场景:开了「减少动效」仍有 ${off} 个元素在动(开关是摆设)`);
      await fullMotion.click({ timeout: 2500 }).catch(() => {});
      await page.waitForTimeout(400);
      const back = await movingCount();
      if (back === 0)
        failures.push("[390] 减动效场景:关掉「减少动效」之后界面也一动不动(判据两向都得立得住)");
      console.log(
        `\n减动效:默认 ${before} 个在动 → 打开开关 ${off} 个 → 关回 ${back} 个(音效开着点了一路,无异常)`,
      );
    }
    const stone = page.locator('[data-resource-detail="stone"]');
    if ((await stone.count()) === 0) {
      failures.push("[390] 页眉灵石没有做成精确值入口");
    } else {
      await stone.click({ timeout: 2500 });
      const detail = page.getByRole("dialog", { name: "灵石" });
      await detail.waitFor({ state: "visible", timeout: 2500 }).catch(() => {});
      const body = (await detail.textContent().catch(() => "")) || "";
      if (!body.includes("精确值") || !/\d{1,3}(?:,\d{3})+(?:\.\d+)?/.test(body)) {
        failures.push(`[390] 页眉灵石没有展开精确值:«${body.slice(0, 80)}»`);
      }
      /*
       * 内容窗不许横向撑破。浮层的行是 flex,长文案若带 shrink-0 就会把整行
       * 顶出去 —— 实测「用途:建造与升级、强化封存、炼丹、坊市购货」在 320 下
       * 撑出 34px、195 下 135px,而上面那条「有精确值」照样绿。
       */
      await page.keyboard.press("Escape");
      /*
       * 三档都量一遍:390 下装得下不代表 320/195 也装得下 —— 长文案是在窄档
       * 才露馅的(实测 320 撑出 34px、195 撑出 135px,而 390 一直是 0)。
       */
      for (const width of [320, 195]) {
        await page.setViewportSize({ width, height: 844 });
        await stone.click({ timeout: 2500 }).catch(() => {});
        const dialogOpen = await page
          .getByRole("dialog", { name: "灵石" })
          .waitFor({ state: "visible", timeout: 2500 })
          .then(() => true)
          .catch(() => false);
        if (!dialogOpen) {
          failures.push(`[窄档 ${width}] 灵石精确值打不开了`);
        } else {
          const over = await page.evaluate(() => {
            const pane = document.querySelector("[data-folio-modal] .scroll-pane");
            return pane ? Math.max(0, pane.scrollWidth - pane.clientWidth) : 0;
          });
          if (over > 0) {
            failures.push(`[窄档 ${width}] 灵石精确值浮层的行撑出了内容窗 ${over}px`);
          }
        }
        await page.keyboard.press("Escape");
        await page.waitForTimeout(150);
      }
      await page.setViewportSize({ width: 390, height: 844 });
    }
    if (pageErrors.length)
      failures.push(`[390] 减动效场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
    await ctx.close();
  }

  return { failures, checked, contrastFails, pixelContrastFails, zoomFails };
}

/** 闭关的跨页承诺 */
async function taskRetreat() {
  const failures = [];
  let checked = 0;
  const contrastFails = [];
  const pixelContrastFails = [];
  const zoomFails = [];
  // ---- 第二十一件事:闭关的跨页承诺 —— 闭关中不许历练,而且当场就说 ----
  /*
   * 「静坐一炷香,修炼速度 +150%;闭关期间无法外出历练」是修行页明写的一条。
   * 这条承诺跨两个页面,此前也没人真走过:去历练页点出发,模式窗照开,三选一之后
   * 才被告知「你正在闭关静修」——话是对的,但让人先白走一步。
   * 判据三件:闭关真的起效(有倒计时)、出发当场被拦且不开模式窗、回修行页闭关还在。
   */
  {
    const ctx = await auditContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    });
    const enc = encryptSlice;
    const gn = (m, e) => ({ m, e });
    const slices = {
      game: {
        started: true,
        saveVersion: 2,
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
        totalPlaySec: 0,
        createRerolls: 8,
        createProfile: null,
      },
      player: {
        name: "闭关自检",
        major: 5,
        sub: 3,
        exp: gn(1, 2),
        age: 40,
        lifespanBonusYears: 0,
        dead: false,
        reincarnation: {
          count: 0,
          daoFruit: 0,
          talents: [],
          insight: 0,
          lives: [],
          vow: null,
          trial: null,
          bonds: [],
        },
        linggen: {
          roots: [{ element: "wood", aptitude: 70 }],
          gradeName: "单灵根",
          growthMult: 1.1,
        },
      },
      resources: { spiritStone: gn(1, 6), qi: 1000, wudao: 10, herb: 5, ore: 5, page: 2, dust: 2 },
      inventory: { items: [], equipped: {}, pills: {}, artifacts: [], equippedArtifacts: [] },
      endgame: { daoPath: null, daoSource: 0, souls: [], equippedSouls: [] },
      settings: {
        privacyAccepted: true,
        sfxOn: false,
        musicOn: false,
        musicVol: 0,
        sfxVol: 0,
        reduceMotion: true,
        battleSpeed: 4,
        decomposeRanks: [],
        smartKeep: { enabled: true, minQuality: 3, keepCoreAffix: true, keepComboPiece: true },
        theme: "light",
      },
    };
    await ctx.addInitScript(
      (data) => {
        if (localStorage.getItem("__layoutSeeded")) return;
        for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
        localStorage.setItem("__layoutSeeded", "1");
      },
      Object.fromEntries(Object.entries(slices).map(([k, v]) => [`${SAVE_PREFIX}${k}`, enc(v)])),
    );
    const page = await ctx.newPage();
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    await page.goto(INDEX + "#" + "/cultivation", { waitUntil: "load" });
    await page.waitForTimeout(2400);
    await clearOverlays(page);
    checked += 1;
    const retreatBtn = page.locator("main button", { hasText: /闭\s*关/ }).first();
    if ((await retreatBtn.count()) === 0) failures.push("[390] 闭关场景:修行页找不到「闭关」入口");
    else {
      await retreatBtn.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(800);
      const started = await page.evaluate(() => ({
        toast: [...document.querySelectorAll(".pointer-events-none.fixed button")]
          .map((b) => (b.textContent || "").trim())
          .join("|"),
        countdown: /闭关中 · /.test(document.querySelector("main")?.innerText || ""),
      }));
      if (!started.countdown)
        failures.push("[390] 闭关场景:点了闭关,修行页没有出现「闭关中」的倒计时");
      if (!/闭关/.test(started.toast))
        failures.push(`[390] 闭关场景:闭关没有任何交代(${started.toast || "无提示"})`);
      // 去历练页点出发:应当当场被拦,且不开模式窗
      await page.goto(INDEX + "#" + "/adventure", { waitUntil: "load" });
      await page.waitForTimeout(900);
      await page
        .locator("main button", { hasText: /出\s*发/ })
        .first()
        .click({ timeout: 3000 })
        .catch(() => {});
      await page.waitForTimeout(600);
      const blocked = await page.evaluate(() => ({
        toast: [...document.querySelectorAll(".pointer-events-none.fixed button")]
          .map((b) => (b.textContent || "").trim())
          .join("|"),
        modal: !!document.querySelector(".modal-panel"),
        running: /余 \d+分\d+秒/.test(document.querySelector("main")?.innerText || ""),
      }));
      if (!/闭关/.test(blocked.toast))
        failures.push(
          `[390] 闭关场景:闭关期间点出发,出面没有说「正在闭关」(${blocked.toast || "无提示"})`,
        );
      if (blocked.modal)
        failures.push("[390] 闭关场景:闭关期间点出发,还开出了模式窗(该当场拦下,不让玩家白走一步)");
      if (blocked.running) failures.push("[390] 闭关场景:闭关期间居然真的出发了");
      // 回修行页:闭关还在
      await page.goto(INDEX + "#" + "/cultivation", { waitUntil: "load" });
      await page.waitForTimeout(800);
      const back = await page.evaluate(() => {
        const text = document.querySelector("main")?.innerText || "";
        return {
          still: /闭关中 · /.test(text),
          line: (text.match(/闭关中 · [^\r\n]*/) || [""])[0],
        };
      });
      if (!back.still) failures.push("[390] 闭关场景:换页回来闭关状态就丢了");
      console.log(`\n闭关:起效「${back.line}」 · 历练当场被拦(未开模式窗) · 换页仍在`);
    }
    if (pageErrors.length)
      failures.push(`[390] 闭关场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
    await ctx.close();
  }

  return { failures, checked, contrastFails, pixelContrastFails, zoomFails };
}

/** 背包里的账目 */
async function taskInventoryAccounting() {
  const failures = [];
  let checked = 0;
  const contrastFails = [];
  const pixelContrastFails = [];
  const zoomFails = [];
  // ---- 第二十件事:背包里的账目 —— 显示多少就扣/给多少 ----
  /*
   * 强化与分解是玩家天天用的两个资源动作,而它们各自都有一处**手写数字**:
   *   强化弹窗写着「器灵尘×N · 灵石 M」;
   *   分解完弹一条「分解得器灵尘×K」。
   * 这些数字若与服务实际扣/给的对不上,玩家不会知道该信哪个。
   * 判据就一件事:拿界面上的数对界面自己的变化(器灵尘那一栏)。
   * 灵石不在判据里 —— 同一段时间里任务/成就也会发灵石,拿它做差会被别处的收益搅乱。
   */
  {
    const ctx = await auditContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    });
    const enc = encryptSlice;
    const gn = (m, e) => ({ m, e });
    const slices = {
      game: {
        started: true,
        saveVersion: 2,
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
        totalPlaySec: 0,
        createRerolls: 8,
        createProfile: null,
      },
      player: {
        name: "锻造自检",
        major: 5,
        sub: 3,
        exp: gn(1, 2),
        age: 40,
        lifespanBonusYears: 0,
        dead: false,
        reincarnation: {
          count: 0,
          daoFruit: 0,
          talents: [],
          insight: 0,
          lives: [],
          vow: null,
          trial: null,
          bonds: [],
        },
        linggen: {
          roots: [{ element: "wood", aptitude: 70 }],
          gradeName: "单灵根",
          growthMult: 1.1,
        },
      },
      resources: {
        spiritStone: gn(1, 6),
        qi: 1000,
        wudao: 10,
        herb: 5,
        ore: 5,
        page: 2,
        dust: 5000,
      },
      inventory: {
        items: [
          {
            uid: "p_w",
            templateId: "w_zidian",
            quality: "heaven",
            tier: 20,
            level: 4,
            affixes: [],
          },
          {
            uid: "b_1",
            templateId: "b_qingyun",
            quality: "excellent",
            tier: 3,
            level: 0,
            affixes: [],
          },
        ],
        equipped: { weapon: "p_w" },
        pills: {},
        artifacts: [],
        equippedArtifacts: [],
      },
      endgame: { daoPath: null, daoSource: 0, souls: [], equippedSouls: [] },
      settings: {
        privacyAccepted: true,
        sfxOn: false,
        musicOn: false,
        musicVol: 0,
        sfxVol: 0,
        reduceMotion: true,
        battleSpeed: 4,
        decomposeRanks: [],
        smartKeep: { enabled: true, minQuality: 3, keepCoreAffix: true, keepComboPiece: true },
        theme: "light",
      },
    };
    await ctx.addInitScript(
      (data) => {
        if (localStorage.getItem("__layoutSeeded")) return;
        for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
        localStorage.setItem("__layoutSeeded", "1");
      },
      Object.fromEntries(Object.entries(slices).map(([k, v]) => [`${SAVE_PREFIX}${k}`, enc(v)])),
    );
    const page = await ctx.newPage();
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    await page.goto(INDEX + "#" + "/inventory", { waitUntil: "load" });
    await page.waitForTimeout(2400);
    await clearOverlays(page);
    checked += 1;
    /** 背包页顶上那栏「器灵尘 N」 */
    const readDust = () =>
      page.evaluate(() => {
        const m = /器灵尘\s*([\d,]+)/.exec(document.querySelector("main")?.innerText || "");
        return m ? Number(m[1].replace(/,/g, "")) : null;
      });
    /**
     * 打开背包里那件(未装备、未锁定)——按 **uid** 找,不按名字找。
     *
     * 从前这里写死了「青云道袍」:内容一改名(这件后来按地界改成「风林道袍」),
     * 点击就静默落空,场景报的是「判据没跑到东西」,而真相只是名字变了。
     * 装备卡带上 data-uid(见 EquipmentCard),这一处从此与命名无关。
     */
    const BAG_UID = "b_1";
    await page.locator(`main button[data-uid="${BAG_UID}"]`).first().click({ timeout: 3000 });
    await page.waitForTimeout(500);
    const equipBatchPlan = await page.evaluate(() => {
      const holder = document.querySelector("[data-equip-batch-plan]");
      return {
        count: Number(holder?.getAttribute("data-equip-batch-count")),
        from: Number(holder?.getAttribute("data-equip-batch-from")),
        to: Number(holder?.getAttribute("data-equip-batch-to")),
        ended: holder?.getAttribute("data-equip-batch-ended"),
        text: (holder?.textContent || "").replace(/\s+/g, " ").trim(),
      };
    });
    checked += 1;
    if (
      equipBatchPlan.count <= 0 ||
      equipBatchPlan.to <= equipBatchPlan.from ||
      equipBatchPlan.ended !== "max" ||
      !equipBatchPlan.text.includes("可至满级")
    ) {
      failures.push(
        `[390] 锻造场景:连强预告没有摊开本轮档数与止点 —— ` +
          `${equipBatchPlan.from}→${equipBatchPlan.to} ${equipBatchPlan.count} 档/` +
          `${equipBatchPlan.ended} «${equipBatchPlan.text}»`,
      );
    }
    const costLine = await page.evaluate(() => {
      const p = document.querySelector(".modal-panel");
      const m = /器灵尘×(\d+)/.exec(p?.innerText || "");
      return m ? Number(m[1]) : null;
    });
    if (costLine === null)
      failures.push("[390] 锻造场景:详情里没写出强化的器灵尘价(判据没跑到东西)");
    else {
      const before = await readDust();
      await page
        .locator(".modal-panel button", { hasText: /强\s*化/ })
        .first()
        .click({ timeout: 3000 })
        .catch(() => {});
      await page.waitForTimeout(600);
      const after = await readDust();
      if (before === null || after === null || before - after !== costLine) {
        failures.push(
          `[390] 锻造场景:强化写着扣 ${costLine} 尘,实际 ${before} → ${after}(所见非所付)`,
        );
      }
      // 接着分解同一件:提示里说给多少尘,就该给多少 —— 而且这件要从包里消失
      const dustBeforeSplit = await readDust();
      // 分解是**二步确认**:先点「分解这件装备」(图标钮,以 aria-label 命名),再点「确认分解」。
      // 这里曾经点「空文本 footer 按钮」+「文本含分解? 的按钮」—— 对应更早的**单步版**;
      // 两步版下那两下都点不中,分解没发生、提示没出来 → 误报「没交代」(实测真流程出「分解得器灵尘×4」)。
      await page
        .locator('.modal-panel button[aria-label="分解这件装备"]')
        .click({ timeout: 3000 })
        .catch(() => {});
      await page.waitForTimeout(300);
      await page
        .locator(".modal-panel button", { hasText: /确认分解/ })
        .first()
        .click({ timeout: 3000 })
        .catch(() => {});
      await page.waitForTimeout(700);
      const toast = await page.evaluate(() =>
        [...document.querySelectorAll(".pointer-events-none.fixed button")]
          .map((b) => (b.textContent || "").trim())
          .join("|"),
      );
      const promised = Number((/分解得器灵尘×(\d+)/.exec(toast) || [])[1] ?? NaN);
      const dustAfterSplit = await readDust();
      const stillInBag = await page.evaluate(
        (uid) => !!document.querySelector(`main button[data-uid="${uid}"]`),
        BAG_UID,
      );
      if (Number.isFinite(promised)) {
        if (
          dustBeforeSplit === null ||
          dustAfterSplit === null ||
          dustAfterSplit - dustBeforeSplit !== promised
        ) {
          failures.push(
            `[390] 锻造场景:分解说给 ${promised} 尘,实际 ${dustBeforeSplit} → ${dustAfterSplit}`,
          );
        }
        if (stillInBag) failures.push("[390] 锻造场景:分解之后那件还留在背包里");
        console.log(
          `\n背包账目:强化扣尘 ${costLine}(对上) · 分解得尘 ${promised}(对上,且件已出包)`,
        );
      } else {
        failures.push(`[390] 锻造场景:分解没有给出「分解得器灵尘×N」的交代(${toast || "无提示"})`);
      }
    }
    if (pageErrors.length)
      failures.push(`[390] 锻造场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
    await ctx.close();
  }

  return { failures, checked, contrastFails, pixelContrastFails, zoomFails };
}

/** 际遇帖:门限与去向必须真的铺得开,结算后焦点不能掉回页面 */
async function taskEventSlip() {
  const failures = [];
  let checked = 0;
  const ctx = await auditContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  try {
    const slices = showcaseSlices("light");
    // 游方商人的买路恰好多分支；清空灵石后第一项必须置灰并报出缺口。
    slices.resources = { ...slices.resources, spiritStone: { m: 0, e: 0 } };
    slices.adventure = {
      pendingEventId: "ev_merchant",
      pendingEventSince: Date.now(),
    };
    await seedSave(ctx, slices, "__eventSlip");

    const page = await ctx.newPage();
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    await openRoute(page, "/adventure", 650);
    await page.locator("[data-event-slip]").waitFor({ state: "visible", timeout: 5000 });
    await settleVisuals(page);

    const readSlip = () =>
      page.evaluate(() => {
        const slip = document.querySelector("[data-event-slip]");
        const panel = slip?.closest(".modal-panel");
        if (!slip || !panel) return null;
        const p = panel.getBoundingClientRect();
        const s = slip.getBoundingClientRect();
        const choices = [...slip.querySelectorAll("[data-event-choice]")].map((el) => {
          const r = el.getBoundingClientRect();
          return {
            disabled: el.hasAttribute("disabled"),
            width: r.width,
            scrollWidth: el.scrollWidth,
            clientWidth: el.clientWidth,
          };
        });
        return {
          panel: {
            left: p.left,
            right: p.right,
            width: p.width,
            scrollWidth: panel.scrollWidth,
            clientWidth: panel.clientWidth,
          },
          slip: {
            left: s.left,
            right: s.right,
            width: s.width,
            scrollWidth: slip.scrollWidth,
            clientWidth: slip.clientWidth,
          },
          viewport: innerWidth,
          choices,
          outcomes: slip.querySelectorAll("[data-event-outcome]").length,
          chanceText: [...slip.querySelectorAll(".event-outcome__chance")]
            .map((el) => (el.textContent || "").trim())
            .join("|"),
          shortfall: (slip.querySelector("[data-event-shortfall]")?.textContent || "")
            .replace(/\s+/g, " ")
            .trim(),
          auto: (slip.querySelector("[data-event-auto]")?.textContent || "")
            .replace(/\s+/g, " ")
            .trim(),
        };
      });

    const assertBox = (label, info) => {
      checked += 1;
      if (!info) {
        failures.push(`${label} 际遇帖没有出现`);
        return;
      }
      if (
        info.panel.left < -1 ||
        info.panel.right > info.viewport + 1 ||
        info.panel.scrollWidth > info.panel.clientWidth + 1 ||
        info.slip.scrollWidth > info.slip.clientWidth + 1 ||
        info.choices.some((row) => row.scrollWidth > row.clientWidth + 1)
      ) {
        failures.push(
          `${label} 际遇帖横向挤出:` +
            `面板 ${info.panel.scrollWidth}>${info.panel.clientWidth},` +
            `帖 ${info.slip.scrollWidth}>${info.slip.clientWidth},` +
            `选项 ${info.choices.map((row) => `${Math.round(row.scrollWidth)}>${Math.round(row.clientWidth)}`).join("/")}`,
        );
      }
    };

    const base = await readSlip();
    assertBox("[390]", base);
    checked += 1;
    if (
      !base ||
      base.choices.length !== 2 ||
      !base.choices[0]?.disabled ||
      base.choices[1]?.disabled ||
      base.outcomes !== 4 ||
      base.chanceText !== "40%|35%|25%" ||
      !base.shortfall.includes("尚差") ||
      !base.auto.includes("逾时默选")
    ) {
      failures.push(
        `[390] 际遇帖没有把「缺口 + 多分支概率」铺开:` +
          `选项 ${base?.choices.length ?? 0} 条 / 去向 ${base?.outcomes ?? 0} 行 / ` +
          `概率 ${base?.chanceText || "无"} / 缺口 ${base?.shortfall || "无"} / 逾时 ${base?.auto || "无"}`,
      );
    }

    if (SHOTS) {
      mkdirSync(SHOTS_DIR, { recursive: true });
      await page.screenshot({ path: join(SHOTS_DIR, "event-choice-390.png") });
    }

    const zoom = await measureDialogZoom(page, { width: 390, height: 844 });
    const zoomProblems = dialogZoomProblems(zoom);
    checked += 1;
    if (zoomProblems.length) failures.push(`[195] 际遇帖 → ${zoomProblems.join(" / ")}`);

    if (SHOTS) {
      await page.setViewportSize({ width: 195, height: 422 });
      await settleVisuals(page);
      assertBox("[195]", await readSlip());
      await page.screenshot({ path: join(SHOTS_DIR, "event-choice-195.png") });
      await page.setViewportSize({ width: 390, height: 844 });
      await settleVisuals(page);
    }

    await page.setViewportSize({ width: 320, height: 568 });
    await settleVisuals(page);
    assertBox("[320]", await readSlip());
    if (SHOTS) await page.screenshot({ path: join(SHOTS_DIR, "event-choice-320.png") });
    await page.setViewportSize({ width: 390, height: 844 });
    await settleVisuals(page);

    await page.locator("[data-event-choice]:not([disabled])").first().click({ timeout: 3000 });
    await page.locator("[data-event-result]").waitFor({ state: "visible", timeout: 3000 });
    await settleVisuals(page);
    const result = await page.evaluate(() => {
      const slip = document.querySelector("[data-event-result]");
      const panel = slip?.closest(".modal-panel");
      return {
        text: (slip?.textContent || "").replace(/\s+/g, " ").trim(),
        focused: document.activeElement === slip,
        scrollWidth: panel?.scrollWidth ?? 0,
        clientWidth: panel?.clientWidth ?? 0,
      };
    });
    checked += 1;
    if (
      !result.text.includes("你择「婉拒」") ||
      !result.focused ||
      result.scrollWidth > result.clientWidth + 1
    ) {
      failures.push(
        `[390] 际遇结算卷不合格:选择回执=${result.text.includes("你择「婉拒」")} / ` +
          `焦点=${result.focused} / 溢出 ${result.scrollWidth}>${result.clientWidth}`,
      );
    }
    if (SHOTS) {
      await page.screenshot({ path: join(SHOTS_DIR, "event-result-390.png") });
    }
    if (pageErrors.length)
      failures.push(`[390] 际遇帖场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
  } finally {
    await ctx.close();
  }
  return { failures, checked, contrastFails: [], pixelContrastFails: [], zoomFails: [] };
}

/** 择师谱:四脉同谱、点签只武装、确认才落定,并真量 390 与 195 两档。 */
async function taskMentorLedger() {
  const failures = [];
  let checked = 0;
  const ctx = await auditContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  try {
    await seedSave(ctx, showcaseSlices("light"), "__mentorLedger");

    const page = await ctx.newPage();
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    const rendered = await openRoute(page, "/character", 650);
    if (!rendered) failures.push("[390] 择师谱场景:/character 没有渲染出来");
    await clearOverlays(page);

    const entry = page.locator("main button", { hasText: /师\s*承/ }).first();
    const openMentor = async () => {
      if ((await entry.count()) === 0) return false;
      await entry.click({ timeout: 3000 }).catch(() => {});
      const opened = await page
        .locator("[data-mentor-ledger], [data-mentor-view='chosen']")
        .last()
        .waitFor({ state: "visible", timeout: 4000 })
        .then(() => true)
        .catch(() => false);
      if (opened) await settleVisuals(page);
      return opened;
    };

    const readMentor = () =>
      page.evaluate(() => {
        const root = document.querySelector("[data-mentor-view]");
        const panel = root?.closest(".modal-panel");
        if (!root || !panel) return null;
        const choices = [...root.querySelectorAll("[data-mentor-choice]")].map((el) => {
          const choice = el.getBoundingClientRect();
          const body = el.querySelector(".mentor-choice__body")?.getBoundingClientRect();
          const action = el.querySelector(".mentor-choice__action")?.getBoundingClientRect();
          return {
            id: el.getAttribute("data-mentor-id"),
            pressed: el.getAttribute("aria-pressed"),
            label: (el.getAttribute("aria-label") || "").trim(),
            mods: el.querySelectorAll("[data-mentor-mods] .mentor-choice__mod").length,
            width: choice.width,
            scrollWidth: el.scrollWidth,
            clientWidth: el.clientWidth,
            actionBelowBody: body && action ? action.top >= body.bottom - 1 : null,
          };
        });
        const oathActions = root.closest(".modal-panel")?.querySelector(".mentor-oath__actions");
        return {
          view: root.getAttribute("data-mentor-view"),
          text: (root.textContent || "").replace(/\s+/g, " ").trim(),
          choices,
          pressed: choices.filter((c) => c.pressed === "true").map((c) => c.id),
          confirm: !!panel.querySelector("[data-mentor-confirm]"),
          confirmText: (panel.querySelector("[data-mentor-confirm]")?.textContent || "")
            .replace(/\s+/g, " ")
            .trim(),
          panelWidth: panel.clientWidth,
          panelScrollWidth: panel.scrollWidth,
          footerDirection: oathActions ? getComputedStyle(oathActions).flexDirection : "",
          mods: root.querySelectorAll("[data-mentor-mod]").length,
        };
      });

    if (!(await openMentor())) {
      failures.push("[390] 择师谱场景:点「师承」入口后没有打开择师谱");
    } else {
      const base = await readMentor();
      checked += 1;
      if (
        !base ||
        base.view !== "selection" ||
        base.choices.length !== 4 ||
        base.confirm ||
        base.pressed.length !== 0 ||
        !base.text.includes("不可改投") ||
        base.choices.some(
          (choice) =>
            !choice.id ||
            choice.mods !== 2 ||
            !choice.label.includes("入门词条") ||
            choice.scrollWidth > choice.clientWidth + 1,
        )
      ) {
        failures.push(
          `[390] 择师谱没有把四脉、永久代价与同源词条一次摊开:` +
            `四脉 ${base?.choices.length ?? 0} / 已择 ${base?.pressed.length ?? 0} / ` +
            `确认 ${base?.confirm ?? false} / 词条 ${base?.choices.map((c) => c.mods).join("/") || "无"}`,
        );
      }

      const controls = await auditModalControls(page);
      checked += 1;
      if (!controls || controls.count === 0 || controls.unnamed.length || controls.small.length) {
        failures.push(
          `[390] 择师谱控件不合格:` +
            `${controls?.count ?? 0} 枚 / 无名 ${controls?.unnamed.join(" | ") || "无"} / ` +
            `过小 ${controls?.small.join(" | ") || "无"}`,
        );
      }

      if (SHOTS) {
        mkdirSync(SHOTS_DIR, { recursive: true });
        await page.screenshot({ path: join(SHOTS_DIR, "mentor-ledger-390.png") });
      }

      await page.locator("[data-mentor-choice]").first().click({ timeout: 3000 });
      await page
        .locator("[data-mentor-confirm]")
        .waitFor({ state: "visible", timeout: 3000 })
        .catch(() => {});
      await settleVisuals(page);
      const armed = await readMentor();
      checked += 1;
      if (
        !armed ||
        armed.view !== "selection" ||
        armed.pressed.join(",") !== "swordsman" ||
        !armed.confirm ||
        !armed.confirmText.includes("剑修") ||
        !armed.confirmText.includes("不可改投")
      ) {
        failures.push(
          `[390] 点签没有停在待确认态:` +
            `视图 ${armed?.view || "无"} / 已择 ${armed?.pressed.join(",") || "无"} / ` +
            `确认 ${armed?.confirm ?? false} «${armed?.confirmText || "无"}»`,
        );
      }

      zoomSeen += 1;
      const zoomProblems = dialogZoomProblems(
        await measureDialogZoom(page, { width: 390, height: 844 }),
      );
      checked += 1;
      if (zoomProblems.length) failures.push(`[195] 择师谱 → ${zoomProblems.join(" / ")}`);

      await page.setViewportSize({ width: 195, height: 422 });
      await settleVisuals(page);
      const narrow = await readMentor();
      checked += 1;
      if (
        !narrow ||
        narrow.panelScrollWidth > narrow.panelWidth + 1 ||
        narrow.choices.some(
          (choice) =>
            choice.scrollWidth > choice.clientWidth + 1 || choice.actionBelowBody !== true,
        ) ||
        narrow.footerDirection !== "column"
      ) {
        failures.push(
          `[195] 择师谱签身或确认动作没有收成上下两段:` +
            `面板 ${narrow?.panelScrollWidth ?? 0}>${narrow?.panelWidth ?? 0} / ` +
            `签身 ${narrow?.choices.map((c) => `${c.actionBelowBody}`).join("/") || "无"} / ` +
            `确认 ${narrow?.footerDirection || "无"}`,
        );
      }
      if (SHOTS) await page.screenshot({ path: join(SHOTS_DIR, "mentor-ledger-195.png") });
      await page.setViewportSize({ width: 390, height: 844 });
      await settleVisuals(page);

      await page.keyboard.press("Escape");
      await page
        .locator("[data-mentor-ledger]")
        .waitFor({ state: "detached", timeout: 3000 })
        .catch(() => {});
      if (!(await openMentor())) {
        failures.push("[390] 择师谱场景:关闭后无法重新打开");
      } else {
        const reopened = await readMentor();
        checked += 1;
        if (
          !reopened ||
          reopened.view !== "selection" ||
          reopened.confirm ||
          reopened.pressed.length !== 0
        ) {
          failures.push("[390] 只点选未确认就被写进存档,重开不再出示四脉");
        }

        await page.locator("[data-mentor-choice]").first().click({ timeout: 3000 });
        await page
          .locator("[data-mentor-confirm] button", { hasText: /确认拜师/ })
          .click({ timeout: 3000 });
        const chosen = await page
          .locator("[data-mentor-view='chosen']")
          .waitFor({ state: "visible", timeout: 3000 })
          .then(() => true)
          .catch(() => false);
        const chosenInfo = await readMentor();
        const focusAfterConfirm = await page.evaluate(() => {
          const active = document.activeElement;
          const panel = active?.closest(".modal-panel");
          return {
            inside: !!panel,
            text: (active?.textContent || "").replace(/\s+/g, " ").trim(),
          };
        });
        checked += 1;
        if (
          !chosen ||
          !chosenInfo ||
          chosenInfo.view !== "chosen" ||
          chosenInfo.mods !== 2 ||
          !chosenInfo.text.includes("行为契合") ||
          !chosenInfo.text.includes("不可改投") ||
          !focusAfterConfirm.inside
        ) {
          failures.push(
            `[390] 确认拜师后没有落成师承帖:` +
              `师承帖 ${chosen} / 词条 ${chosenInfo?.mods ?? 0} / ` +
              `焦点 ${focusAfterConfirm.inside ? `«${focusAfterConfirm.text}»` : "掉出弹窗"} / ` +
              `«${chosenInfo?.text.slice(0, 50) || "无"}»`,
          );
        }
        if (SHOTS) {
          await page.screenshot({ path: join(SHOTS_DIR, "mentor-dossier-390.png") });
        }

        await page
          .locator(".modal-panel button", { hasText: /收起师承帖/ })
          .click({ timeout: 3000 })
          .catch(() => {});
        if (await openMentor()) {
          const persisted = await readMentor();
          checked += 1;
          if (!persisted || persisted.view !== "chosen" || persisted.confirm) {
            failures.push("[390] 已落定的师承重开后没有回到师承帖");
          }
        } else {
          failures.push("[390] 落定后关闭师承帖,无法重新打开");
        }
      }
    }

    if (pageErrors.length)
      failures.push(`[390] 择师谱场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
  } finally {
    await ctx.close();
  }
  return { failures, checked, contrastFails: [], pixelContrastFails: [], zoomFails: [] };
}

/** 同行帖:此刻先答、代价先摊、下一阶缺口同源,并真量 390 与 195 两档。 */
async function taskBondFolio() {
  const failures = [];
  let checked = 0;
  const ctx = await auditContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  try {
    const slices = showcaseSlices("light");
    slices.player = {
      ...slices.player,
      bond: {
        daoluId: "dl_qingli",
        stage: "confidant",
        fate: 58,
        trust: 20,
        accord: 16,
        shared: 2,
        metAt: Date.now() - 86400000,
        fallen: false,
        departed: false,
        doneEvents: ["be_lead", "be_spare"],
        pendingEventId: "be_jie",
        opportunities: 12,
        nextEventAt: 18,
        lastKind: "risk",
        intent: {
          daoluId: "dl_qingli",
          wish: "寻找十年前失踪的师尊",
          line: "她忽然停下:「往北那条路……我想去看看。」",
          ripeness: 1,
          sparks: ["shared", "supported"],
          raised: 1,
          responses: ["ignore"],
          settled: false,
        },
        intentPending: true,
      },
    };
    await seedSave(ctx, slices, "__bondFolioFixture");

    const page = await ctx.newPage();
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    const rendered = await openRoute(page, "/character", 650);
    if (!rendered) failures.push("[390] 同行帖场景:/character 没有渲染出来");
    await clearOverlays(page);

    const entry = page.locator("main button", { hasText: /道\s*侣/ }).first();
    checked += 1;
    if ((await entry.count()) === 0) {
      failures.push("[390] 同行帖场景:人物页找不到「道侣」入口");
    } else {
      await entry.click({ timeout: 4000 }).catch(() => {});
      const opened = await page
        .locator("[data-bond-view='active']")
        .waitFor({ state: "visible", timeout: 5000 })
        .then(() => true)
        .catch(() => false);
      if (!opened) failures.push("[390] 点「道侣」后没有打开同行的那一扇帖");
      if (opened) await settleVisuals(page);
    }

    const readBondFolio = () =>
      page.evaluate(() => {
        const root = document.querySelector("[data-bond-view='active']");
        const panel = root?.closest(".modal-panel");
        if (!root || !panel) return null;
        const readChoices = (selector) =>
          [...root.querySelectorAll(selector)].map((el) => {
            const box = el.getBoundingClientRect();
            const copy = el.querySelector(".bond-choice__copy")?.getBoundingClientRect();
            const read = el.querySelector(".bond-choice__read");
            const readBox = read?.getBoundingClientRect();
            const warning = el.querySelector(".bond-choice__warning");
            return {
              id: el.getAttribute("data-bond-choice-id"),
              label: (el.getAttribute("aria-label") || "").trim(),
              text: (el.textContent || "").replace(/\s+/g, " ").trim(),
              deltas: el.querySelectorAll(".bond-delta").length,
              overflow: el.scrollWidth > el.clientWidth + 1,
              readInside:
                !readBox || (readBox.left >= box.left - 1 && readBox.right <= box.right + 1),
              readBelowCopy: !readBox || !copy || readBox.top >= copy.bottom - 1,
              warning: (warning?.textContent || "").replace(/\s+/g, " ").trim(),
            };
          });
        const now = root.querySelector("[data-bond-now]")?.getBoundingClientRect();
        const meters = root.querySelector("[data-bond-meters]")?.getBoundingClientRect();
        const gate = root.querySelector("[data-bond-next-gate]");
        const meterRows = Object.fromEntries(
          [...root.querySelectorAll("[data-bond-meter]")].map((el) => [
            el.getAttribute("data-bond-meter"),
            {
              text: (el.textContent || "").replace(/\s+/g, " ").trim(),
              overflow: el.scrollWidth > el.clientWidth + 1,
              headDirection: getComputedStyle(el.querySelector(".bond-meter__head") || el)
                .flexDirection,
            },
          ]),
        );
        return {
          text: (root.textContent || "").replace(/\s+/g, " ").trim(),
          nowBeforeMeters: !!now && !!meters && now.top < meters.top,
          intentChoices: readChoices("[data-bond-intent-choice]"),
          eventChoices: readChoices("[data-bond-event-choice]"),
          nextStage: gate?.getAttribute("data-bond-next-stage"),
          gateText: (gate?.textContent || "").replace(/\s+/g, " ").trim(),
          meterRows,
          panelWidth: panel.clientWidth,
          panelScrollWidth: panel.scrollWidth,
        };
      });

    if (await page.locator("[data-bond-view='active']").count()) {
      const folio = await readBondFolio();
      const share = folio?.eventChoices.find((c) => c.id === "share");
      const send = folio?.eventChoices.find((c) => c.id === "send");
      checked += 1;
      if (
        !folio ||
        !folio.nowBeforeMeters ||
        !folio.text.includes("此刻要答的事") ||
        folio.intentChoices.length !== 3 ||
        folio.eventChoices.length !== 3 ||
        [...folio.intentChoices, ...folio.eventChoices].some(
          (choice) => choice.deltas !== 3 || choice.overflow || !choice.readInside,
        ) ||
        !share?.warning.includes("她会殒落") ||
        !send?.warning.includes("她会就此离开") ||
        !share.label.includes("缘分+8") ||
        !share.label.includes("信任+10") ||
        !share.label.includes("契合+8")
      ) {
        failures.push(
          `[390] 同行帖没有先摊此刻与逐项代价:` +
            `此刻先于三衡 ${folio?.nowBeforeMeters ?? false} / ` +
            `主动提议 ${folio?.intentChoices.length ?? 0} 项 / 共同事件 ${folio?.eventChoices.length ?? 0} 项 / ` +
            `殒落预告 ${share?.warning.includes("她会殒落") ?? false} / ` +
            `离开预告 ${send?.warning.includes("她会就此离开") ?? false} / ` +
            `代价 ${share?.label || "无"}`,
        );
      }
      checked += 1;
      if (
        folio?.nextStage !== "pledged" ||
        !folio.gateText.includes("下一阶 · 结契") ||
        !folio.meterRows.fate?.text.includes("尚差 7") ||
        !folio.meterRows.trust?.text.includes("尚差 40") ||
        !folio.meterRows.accord?.text.includes("尚差 39") ||
        !folio.gateText.includes("下一阶尚差 1 次")
      ) {
        failures.push(
          `[390] 同行帖的下一阶缺口没有读同一份门槛真值:` +
            `阶 ${folio?.nextStage || "无"} / ` +
            `缘 ${folio?.meterRows.fate?.text || "无"} / ` +
            `信 ${folio?.meterRows.trust?.text || "无"} / ` +
            `契 ${folio?.meterRows.accord?.text || "无"} / ` +
            `共历 ${folio?.gateText.slice(-40) || "无"}`,
        );
      }

      const controls = await auditModalControls(page);
      checked += 1;
      if (!controls || controls.count === 0 || controls.unnamed.length || controls.small.length) {
        failures.push(
          `[390] 同行帖控件不合格:` +
            `${controls?.count ?? 0} 枚 / 无名 ${controls?.unnamed.join(" | ") || "无"} / ` +
            `过小 ${controls?.small.join(" | ") || "无"}`,
        );
      }

      if (SHOTS) {
        mkdirSync(SHOTS_DIR, { recursive: true });
        await page.screenshot({ path: join(SHOTS_DIR, "bond-folio-390.png") });
      }

      zoomSeen += 1;
      const zoomProblems = dialogZoomProblems(
        await measureDialogZoom(page, { width: 390, height: 844 }),
      );
      checked += 1;
      if (zoomProblems.length) failures.push(`[195] 同行帖 → ${zoomProblems.join(" / ")}`);

      await page.setViewportSize({ width: 195, height: 422 });
      await settleVisuals(page);
      const narrow = await readBondFolio();
      checked += 1;
      if (
        !narrow ||
        narrow.panelScrollWidth > narrow.panelWidth + 1 ||
        [...narrow.intentChoices, ...narrow.eventChoices].some(
          (choice) => choice.overflow || !choice.readInside || !choice.readBelowCopy,
        ) ||
        Object.values(narrow.meterRows).some(
          (row) => row.overflow || row.headDirection !== "column",
        )
      ) {
        failures.push(
          `[195] 同行帖选项与关系读数没有上下收住:` +
            `面板 ${narrow?.panelScrollWidth ?? 0}>${narrow?.panelWidth ?? 0} / ` +
            `选项 ${
              [...(narrow?.intentChoices ?? []), ...(narrow?.eventChoices ?? [])]
                .map((c) => `${c.id}:${c.overflow ? "溢" : "收"}/${c.readBelowCopy ? "下" : "并"}`)
                .join(" ") || "无"
            } / ` +
            `三衡 ${
              Object.entries(narrow?.meterRows ?? {})
                .map(([key, row]) => `${key}:${row.overflow ? "溢" : "收"}/${row.headDirection}`)
                .join(" ") || "无"
            }`,
        );
      }
      if (SHOTS) await page.screenshot({ path: join(SHOTS_DIR, "bond-folio-195.png") });
    }

    if (pageErrors.length)
      failures.push(`[390] 同行帖场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
  } finally {
    await ctx.close();
  }
  return { failures, checked, contrastFails: [], pixelContrastFails: [], zoomFails: [] };
}

/** 往生帖:门槛、道果、留折散与全账同源,并真量 390 与 195 两档。 */
async function taskRebirthFolio() {
  const failures = [];
  let checked = 0;
  const ctx = await auditContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  try {
    const slices = showcaseSlices("light");
    slices.player = {
      ...slices.player,
      reincarnation: {
        ...slices.player.reincarnation,
        talents: ["t_daogu", "t_jianxin", "t_hongyun"],
      },
    };
    await seedSave(ctx, slices, "__rebirthFolioFixture");

    const page = await ctx.newPage();
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    const rendered = await openRoute(page, "/character", 650);
    if (!rendered) failures.push("[390] 往生帖场景:/character 没有渲染出来");
    await clearOverlays(page);

    const entry = page.locator("main button", { hasText: /轮\s*回/ }).first();
    checked += 1;
    if ((await entry.count()) === 0) {
      failures.push("[390] 往生帖场景:人物页找不到「轮回」入口");
    } else {
      await entry.click({ timeout: 4000 }).catch(() => {});
      const opened = await page
        .locator("[data-rebirth-folio]")
        .waitFor({ state: "visible", timeout: 5000 })
        .then(() => true)
        .catch(() => false);
      if (!opened) failures.push("[390] 点「轮回」后没有打开往生帖");
      if (opened) await settleVisuals(page);
    }

    const readRebirthFolio = () =>
      page.evaluate(() => {
        const root = document.querySelector("[data-rebirth-folio]");
        const panel = root?.closest(".modal-panel");
        if (!root || !panel) return null;
        const summary = [...root.querySelectorAll("[data-rebirth-summary] .rebirth-balance__row")];
        const critical = [...root.querySelectorAll("[data-rebirth-critical-row]")].map((el) => {
          const name = el.querySelector(".rebirth-critical__name")?.getBoundingClientRect();
          const group = el.querySelector(".rebirth-critical__group")?.getBoundingClientRect();
          return {
            id: el.getAttribute("data-rebirth-critical-row"),
            text: (el.textContent || "").replace(/\s+/g, " ").trim(),
            overflow: el.scrollWidth > el.clientWidth + 1,
            groupBelowName: !!name && !!group && group.top >= name.bottom - 1,
          };
        });
        const rows = [...root.querySelectorAll("[data-rebirth-ledger-row]")];
        const enter = panel.querySelector("[data-rebirth-enter]");
        const summaryBox = root.querySelector("[data-rebirth-summary]");
        const actions = panel.querySelector(".rebirth-actions");
        const detail = root.querySelector(".rebirth-ledger-row__detail");
        const nestedShells = [
          ...root.querySelectorAll(
            "[data-rebirth-now], [data-rebirth-dao-fruit], [data-rebirth-talents], [data-rebirth-ledger], [data-rebirth-trial], .rebirth-departure",
          ),
        ].map((el) => {
          const style = getComputedStyle(el);
          return {
            className: String(el.className),
            fullBorder: ["Top", "Right", "Bottom", "Left"].every(
              (side) => parseFloat(style[`border${side}Width`]) > 0,
            ),
          };
        });
        return {
          text: (root.textContent || "").replace(/\s+/g, " ").trim(),
          gateState: root
            .querySelector("[data-rebirth-gate]")
            ?.getAttribute("data-rebirth-gate-state"),
          gateText: (root.querySelector("[data-rebirth-gate]")?.textContent || "")
            .replace(/\s+/g, " ")
            .trim(),
          summary: summary.map((el) => ({
            text: (el.textContent || "").replace(/\s+/g, " ").trim(),
            overflow: el.scrollWidth > el.clientWidth + 1,
          })),
          summaryColumns: summaryBox ? getComputedStyle(summaryBox).gridTemplateColumns : "",
          critical,
          daoText: (root.querySelector("[data-rebirth-dao-fruit]")?.textContent || "")
            .replace(/\s+/g, " ")
            .trim(),
          talentChips: root.querySelectorAll(".rebirth-talent").length,
          trialText: (root.querySelector("[data-rebirth-trial]")?.textContent || "")
            .replace(/\s+/g, " ")
            .trim(),
          groups: root.querySelectorAll("[data-rebirth-group]").length,
          rows: rows.length,
          rowOverflow: rows.some((el) => el.scrollWidth > el.clientWidth + 1),
          rowNameWidths: rows.map(
            (el) =>
              el.querySelector(".rebirth-ledger-row__name")?.getBoundingClientRect().width ?? 0,
          ),
          detailText: (detail?.textContent || "").replace(/\s+/g, " ").trim(),
          toggleExpanded:
            root.querySelector("[data-rebirth-heritage-toggle]")?.getAttribute("aria-expanded") ===
            "true",
          enterDisabled: !!enter?.hasAttribute("disabled"),
          enterText: (enter?.textContent || "").replace(/\s+/g, " ").trim(),
          actionsColumns: actions ? getComputedStyle(actions).gridTemplateColumns : "",
          chapterHeads: root.querySelectorAll(".folio-chapter-head").length,
          nestedShells,
          panelWidth: panel.clientWidth,
          panelScrollWidth: panel.scrollWidth,
        };
      });

    if (await page.locator("[data-rebirth-folio]").count()) {
      const folio = await readRebirthFolio();
      const criticalIds = new Set(folio?.critical.map((row) => row.id));
      checked += 1;
      if (
        !folio ||
        folio.gateState !== "open" ||
        !folio.gateText.includes("金丹门槛已过") ||
        folio.summary.length !== 3 ||
        !folio.text.includes("此刻要决定的事") ||
        !folio.text.includes("先看这些") ||
        !folio.text.includes("功法回一层") ||
        !folio.text.includes("法宝归尘") ||
        folio.chapterHeads < 4 ||
        folio.nestedShells.some((shell) => shell.fullBorder) ||
        !criticalIds.has("gongfa") ||
        !criticalIds.has("artifacts") ||
        !criticalIds.has("linggen") ||
        folio.talentChips !== 3 ||
        !folio.daoText.includes("道果") ||
        !folio.trialText.includes("逆旅契") ||
        folio.enterDisabled ||
        !folio.enterText.includes("兵解转世") ||
        folio.groups !== 0 ||
        folio.rows !== 0
      ) {
        failures.push(
          `[390] 往生帖没有先摊门槛、留折散与主要损失:` +
            `门槛 ${folio?.gateState || "无"}/«${folio?.gateText || "无"}» / ` +
            `摘要 ${folio?.summary.map((row) => row.text).join(" | ") || "无"} / ` +
            `主要损失 ${folio?.critical.map((row) => row.id).join(",") || "无"} / ` +
            `章首 ${folio?.chapterHeads ?? 0} / ` +
            `内层卡壳 ${
              folio?.nestedShells
                .filter((shell) => shell.fullBorder)
                .map((shell) => shell.className)
                .join(",") || "无"
            } / ` +
            `天赋 ${folio?.talentChips ?? 0} / 道果 «${folio?.daoText.slice(0, 32) || "无"}» / ` +
            `主按钮 «${folio?.enterText || "无"}»`,
        );
      }
      checked += 1;
      if (
        folio?.summary.some((row) => row.overflow) ||
        folio?.critical.some((row) => row.overflow) ||
        folio?.panelScrollWidth > folio?.panelWidth + 1
      ) {
        failures.push(
          `[390] 往生帖卷首横向溢出:` +
            `面板 ${folio?.panelScrollWidth ?? 0}>${folio?.panelWidth ?? 0} / ` +
            `摘要 ${folio?.summary.map((row) => row.overflow).join("/") || "无"} / ` +
            `主要损失 ${folio?.critical.map((row) => row.overflow).join("/") || "无"}`,
        );
      }

      const controls = await auditModalControls(page);
      checked += 1;
      if (!controls || controls.count === 0 || controls.unnamed.length || controls.small.length) {
        failures.push(
          `[390] 往生帖控件不合格:` +
            `${controls?.count ?? 0} 枚 / 无名 ${controls?.unnamed.join(" | ") || "无"} / ` +
            `过小 ${controls?.small.join(" | ") || "无"}`,
        );
      }

      if (SHOTS) {
        mkdirSync(SHOTS_DIR, { recursive: true });
        await page.screenshot({ path: join(SHOTS_DIR, "rebirth-folio-390.png") });
      }

      await page.locator("[data-rebirth-heritage-toggle]").click({ timeout: 4000 });
      await page
        .locator("[data-rebirth-group='full']")
        .waitFor({ state: "visible", timeout: 4000 })
        .catch(() => {});
      const expanded = await readRebirthFolio();
      checked += 1;
      if (
        !expanded?.toggleExpanded ||
        expanded.groups !== 3 ||
        expanded.rows !== 36 ||
        expanded.rowOverflow ||
        expanded.panelScrollWidth > expanded.panelWidth + 1
      ) {
        failures.push(
          `[390] 往生帖全账没有按同一份继承表铺开:` +
            `展开 ${expanded?.toggleExpanded ?? false} / ${expanded?.groups ?? 0} 组 / ` +
            `${expanded?.rows ?? 0} 项 / 行横溢 ${expanded?.rowOverflow ?? false}`,
        );
      }

      const gongfa = page.locator("[data-rebirth-ledger-row='gongfa']");
      await gongfa.click({ timeout: 4000 });
      const detail = await readRebirthFolio();
      checked += 1;
      if (
        (await gongfa.getAttribute("aria-expanded")) !== "true" ||
        !detail?.detailText.includes("归零回一层")
      ) {
        failures.push(
          `[390] 往生帖条目没有把真实交割说明摊开:` +
            `aria=${await gongfa.getAttribute("aria-expanded")} / «${detail?.detailText || "无"}»`,
        );
      }
      await gongfa.click({ timeout: 4000 });

      zoomSeen += 1;
      const zoomProblems = dialogZoomProblems(
        await measureDialogZoom(page, { width: 390, height: 844 }),
      );
      checked += 1;
      if (zoomProblems.length) failures.push(`[195] 往生帖 → ${zoomProblems.join(" / ")}`);

      await page.setViewportSize({ width: 195, height: 422 });
      await settleVisuals(page);
      const narrow = await readRebirthFolio();
      checked += 1;
      if (
        !narrow ||
        narrow.panelScrollWidth > narrow.panelWidth + 1 ||
        narrow.summaryColumns.split(" ").length !== 1 ||
        narrow.actionsColumns.split(" ").length !== 1 ||
        narrow.critical.some((row) => row.overflow || !row.groupBelowName) ||
        narrow.rowOverflow ||
        narrow.rowNameWidths.some((width) => width < 60)
      ) {
        failures.push(
          `[195] 往生帖摘要、门槛或全账没有收成上下两段:` +
            `面板 ${narrow?.panelScrollWidth ?? 0}>${narrow?.panelWidth ?? 0} / ` +
            `摘要列 ${narrow?.summaryColumns || "无"} / 动作列 ${narrow?.actionsColumns || "无"} / ` +
            `账目名宽 ${narrow?.rowNameWidths.map((width) => Math.round(width)).join(",") || "无"} / ` +
            `主要损失 ${
              narrow?.critical
                .map(
                  (row) =>
                    `${row.id}:${row.overflow ? "溢" : "收"}/${row.groupBelowName ? "下" : "并"}`,
                )
                .join(" ") || "无"
            }`,
        );
      }
      if (SHOTS) await page.screenshot({ path: join(SHOTS_DIR, "rebirth-folio-195.png") });
    }

    if (pageErrors.length)
      failures.push(`[390] 往生帖场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
  } finally {
    await ctx.close();
  }
  return { failures, checked, contrastFails: [], pixelContrastFails: [], zoomFails: [] };
}

/**
 * 历世足迹 —— 转世把这一世折回起点,界域志仍说得出「你到过哪里」。
 *
 * 这条判据守的是一个**只有转世之后才现形**的窟窿:新一世从炼气重来,谱上真仙那一行
 * 照旧写「未至」,而玩家上个月刚从那里转世下来 —— 历世履历里明明记着。
 *
 * 判据三件:
 *   一 这一世在起点、历世到过第五境时,卷首报一句「此身曾至」,谱上中间那几行读「曾至」;
 *   二 此刻即历世最高时,那句话**不出**(否则与「此刻在此」同屏说两遍);
 *   三 整页重载之后仍在 —— 它进的是存档,不是一次性的界面状态。
 */
async function taskPeakRealm() {
  const failures = [];
  let checked = 0;
  const ctx = await auditContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  try {
    const PEAK = 5;
    const slices = showcaseSlices("light");
    slices.player = {
      ...slices.player,
      major: 0,
      sub: 0,
      reincarnation: { ...slices.player.reincarnation, count: 3, peakMajor: PEAK },
    };
    await seedSave(ctx, slices, "__peakRealmFixture");
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      Math.random = () => 1;
    });
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    await openRoute(page, "/codex", 900);
    await clearOverlays(page);

    const read = () =>
      page.evaluate(() => {
        const peak = document.querySelector("[data-realm-peak]");
        const rows = [...document.querySelectorAll("[data-realm-state]")].map((el) => ({
          id: el.id.replace("realm-", ""),
          state: el.getAttribute("data-realm-state") ?? "",
          text: (el.textContent || "").replace(/\s+/g, " ").trim(),
        }));
        return {
          peak: peak ? (peak.textContent || "").replace(/\s+/g, " ").trim() : "",
          reached: rows.filter((r) => r.state === "reached"),
          current: rows.filter((r) => r.state === "current").map((r) => r.id),
        };
      });

    checked += 1;
    const first = await read();
    const peakName = REALMS[PEAK]?.name ?? "";
    if (!first.peak) {
      failures.push(`[390] 历世足迹:这一世在起点、历世到过${peakName},卷首却没有「此身曾至」`);
    } else if (!first.peak.includes(peakName) || !first.peak.includes("曾至")) {
      failures.push(`[390] 历世足迹:卷首那一句不对 «${first.peak}»(该报${peakName})`);
    }
    if (first.reached.length === 0) {
      failures.push("[390] 历世足迹:谱上一行「曾至」都没有 —— 中间那几境被读成了未至");
    } else {
      // 此刻之上、历世最高及以下的境都该是「曾至」,且每行都写着那两个字
      const want = PEAK; // major=0,故 1..PEAK 共 PEAK 行
      if (first.reached.length !== want) {
        failures.push(`[390] 历世足迹:该有 ${want} 行「曾至」,实见 ${first.reached.length} 行`);
      }
      for (const row of first.reached) {
        if (!row.text.includes("曾至")) {
          failures.push(`[390] 历世足迹:${row.id} 那行标了 reached,却没有写出「曾至」`);
        }
      }
      if (first.current.length !== 1) {
        failures.push(`[390] 历世足迹:当前境该正好一行,实见 ${first.current.length}`);
      }
    }

    // 整页重载:它进的是存档
    checked += 1;
    await page.reload({ waitUntil: "load" });
    await page.waitForTimeout(900);
    await openRoute(page, "/codex", 900);
    await clearOverlays(page);
    const second = await read();
    if (second.peak !== first.peak || second.reached.length !== first.reached.length) {
      failures.push(
        `[390] 历世足迹:重载之后变了 «${first.peak}»/${first.reached.length} → «${second.peak}»/${second.reached.length}`,
      );
    }

    // 此刻即历世最高:那句话整行不出
    checked += 1;
    const sameCtx = showcaseSlices("light");
    sameCtx.player = {
      ...sameCtx.player,
      major: PEAK,
      sub: 0,
      reincarnation: { ...sameCtx.player.reincarnation, count: 1, peakMajor: PEAK },
    };
    await seedSave(ctx, sameCtx, "__peakRealmSameFixture");
    await page.reload({ waitUntil: "load" });
    await page.waitForTimeout(900);
    await openRoute(page, "/codex", 900);
    await clearOverlays(page);
    const same = await read();
    if (same.peak) {
      failures.push(`[390] 历世足迹:此刻即最高,却还说「此身曾至»(${same.peak})`);
    }
    if (same.reached.length !== 0) {
      failures.push(`[390] 历世足迹:此刻即最高,却多出 ${same.reached.length} 行「曾至」`);
    }

    if (pageErrors.length) {
      failures.push(`[390] 历世足迹页面异常:${[...new Set(pageErrors)].join(" | ")}`);
    }
    if (failures.length === 0) {
      console.log(
        `\n历世足迹:转世后卷首报「${first.peak}」,谱上 ${first.reached.length} 行「曾至」且重载不改`,
      );
    }
  } finally {
    await ctx.close();
  }
  return { failures, checked, contrastFails: [], pixelContrastFails: [], zoomFails: [] };
}

/**
 * 品阶印 —— 高品之物落地时,那一条提示自己带着这一档的印。
 *
 * 「拾得一件天品」与「灵石 +3」此前长得一模一样:一句灰字、两秒、消失。
 * 玩家得到好东西的那一刻,屏幕上没有任何东西比得上这件事的分量。
 *
 * 为什么必须在真浏览器里量:印是从 `data/qualities` 取色、从提示条的载荷取档,
 * 两处各写一半 —— 源码判据只能说「两边都提到了品质表」,量不到「屏幕上那枚印
 * 真的是这一档的字、真的是这一档的色」。而写坏的档位必须整枚不出:
 * 半枚印(有框没字)比不盖更糟。
 *
 * 走真路径:在藏经阁真点一次「参悟」,提示由 core 的 notify 发出,
 * 与玩家点下去走的是同一条链。
 */
async function taskToastSeal() {
  const failures = [];
  let checked = 0;
  const ctx = await auditContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  try {
    const slices = showcaseSlices("light");
    /*
     * 只留**一档**未习得:池里唯一的那一部会被参悟到,提示里那一档因此是确定的。
     * 取品质最高的那部 —— 印在最高档上最有说服力。
     */
    const pool = GONGFA.filter((g) => g.minRealm <= slices.player.major + 1);
    const target = pool.reduce((best, g) =>
      qualityDef(g.quality).rank > qualityDef(best.quality).rank ? g : best,
    );
    slices.cultivation = {
      ...slices.cultivation,
      learned: {},
      mainGongfa: null,
      subGongfa: [],
      gongfaBranch: {},
      daoNotes: {},
    };
    slices.resources = { ...slices.resources, page: COMPREHEND_PAGE_COST * 2 };
    // 池里只留一部:其余同境界功法先记成已习得,参悟便只会撞上 target
    slices.cultivation.learned = Object.fromEntries(
      pool.filter((g) => g.id !== target.id).map((g) => [g.id, 1]),
    );
    await seedSave(ctx, slices, "__toastSealFixture");

    const page = await ctx.newPage();
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    await openRoute(page, "/cultivation", 900);
    await clearOverlays(page);

    checked += 1;
    const button = page.locator("button.cultivation-gongfa__comprehend").first();
    if ((await button.count()) === 0) {
      failures.push("[390] 品阶印场景:藏经阁的「参悟」入口不见了");
    } else if (await button.isDisabled()) {
      // 置灰时不该点 —— 连带说明夹具没备够(残页/池)
      failures.push("[390] 品阶印场景:「参悟」是置灰的,夹具没备够残页或池已空");
    } else {
      await button.click({ timeout: 4000 });
      await page.waitForTimeout(500);
      checked += 1;
      const seal = await page.evaluate(() => {
        const nodes = [...document.querySelectorAll("[data-toast]")];
        const hit = nodes.filter((n) => n.getAttribute("data-toast-seal")).at(-1);
        if (!hit) return null;
        const stamp = hit.querySelector("span[aria-hidden='true']");
        if (!stamp) return { text: hit.textContent || "", stamp: null };
        const style = getComputedStyle(stamp);
        const rect = stamp.getBoundingClientRect();
        return {
          text: (hit.textContent || "").replace(/\s+/g, " ").trim(),
          stamp: {
            char: (stamp.textContent || "").trim(),
            color: style.color,
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          },
        };
      });
      const want = qualityDef(target.quality);
      if (!seal) {
        failures.push(`[390] 品阶印场景:参悟出「${target.name}」(${want.name})却没有印`);
      } else if (!seal.stamp) {
        failures.push("[390] 品阶印场景:印的位置是空的(有 toast 却没有印)");
      } else {
        if (seal.stamp.char !== want.name.charAt(0)) {
          failures.push(
            `[390] 品阶印场景:印上的字是「${seal.stamp.char}」,${want.name}该是「${want.name.charAt(0)}」`,
          );
        }
        // 色必须来自品质表本档,而不是别的档位或兜底色
        const expected = await page.evaluate((token) => {
          const probe = document.createElement("span");
          probe.style.color = token;
          document.body.append(probe);
          const got = getComputedStyle(probe).color;
          probe.remove();
          return got;
        }, want.color);
        if (seal.stamp.color !== expected) {
          failures.push(
            `[390] 品阶印场景:印的色「${seal.stamp.color}」不是${want.name}那一档「${expected}」`,
          );
        }
        if (seal.stamp.width < 14 || seal.stamp.height < 14) {
          failures.push(`[390] 品阶印场景:印被压扁了(${seal.stamp.width}×${seal.stamp.height})`);
        }
        if (!seal.text.includes(target.name)) {
          failures.push(`[390] 品阶印场景:提示里没报功法名「${seal.text}」`);
        }
      }
    }

    // 不带印的提示里一枚印都没有 —— 绝大多数提示不该因为这项改动多出个空格
    checked += 1;
    const plainStamped = await page.evaluate(() => {
      const nodes = [...document.querySelectorAll("[data-toast]")];
      return {
        total: nodes.length,
        stamped: nodes.filter((n) => n.getAttribute("data-toast-seal")).length,
        ghosts: nodes.filter(
          (n) => !n.getAttribute("data-toast-seal") && n.querySelector("span[aria-hidden='true']"),
        ).length,
      };
    });
    if (plainStamped.ghosts > 0) {
      failures.push(`[390] 品阶印场景:${plainStamped.ghosts} 条普通提示里冒出了印`);
    }

    if (pageErrors.length) {
      failures.push(`[390] 品阶印场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
    }
    if (failures.length === 0) {
      console.log(
        `\n品阶印:参悟出「${target.name}」时提示条自带${qualityDef(target.quality).name}印,普通提示无印`,
      );
    }
  } finally {
    await ctx.close();
  }
  return { failures, checked, contrastFails: [], pixelContrastFails: [], zoomFails: [] };
}

/**
 * 品评 —— 九档各一句「这一档凭什么」,四处读同一份,且放得进一行。
 *
 * 必须真浏览器量的两件事:
 *   一 它是**一行**。品评排在器评帖的眉题行里(与品阶名、器类、阶数同一行),
 *      写长一点就会把首行折成两行 —— 源码判据量不到这件事;
 *   二 九档都要有,不能只有贵的那几档有话说。
 *
 * 判据:
 *   一 天品与神品的器评帖上都出现品评,且与 data/qualityVerdicts 逐字相同;
 *   二 品评那一段在首页首行之内(顶不会低到把眉题折行);
 *   三 藏珍详情里对得上品质的条目也带同一句;对不上品质的册子不带。
 */
async function taskQualityVerdict() {
  const failures = [];
  let checked = 0;
  const ctx = await auditContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  const items = [
    { uid: "qv_heaven", templateId: "h_miwu", quality: "heaven" },
    { uid: "qv_divine", templateId: "w_xuantie", quality: "divine" },
  ].map((row) => ({
    ...row,
    tier: 20,
    level: 0,
    affixes: [{ id: "hp3", roll: 0.5 }],
  }));
  try {
    if (items.some((it) => !qualityVerdict(it.quality))) {
      throw new Error("品评夹具:没有可用的品评");
    }
    const slices = showcaseSlices("light");
    slices.inventory = {
      ...slices.inventory,
      items: [...items, ...slices.inventory.items],
      equipped: {},
      seenUids: items.map((it) => it.uid),
      seenSeeded: true,
    };
    /*
     * 藏珍默认落在「功名榜」,而空档的九柜一件未收 —— 要核品评得先有收录。
     * 装备册按**模板 id** 记(id 不是实例 uid,见 ui/codex 的 equipStage)。
     */
    slices.quests = {
      ...slices.quests,
      collections: {
        ...slices.quests.collections,
        equip: items.map((it) => it.templateId),
      },
    };
    /*
     * 装备条目的品阶来自**见闻**(lore.equipLore:见过的最好一件),
     * 不是模板自带的 —— 没记过见闻就没有档,品评也就无从谈起。
     */
    slices.lore = {
      ...slices.lore,
      equipLore: Object.fromEntries(
        items.map((it) => [it.templateId, { q: qualityDef(it.quality).rank, t: it.tier, u: 1 }]),
      ),
    };
    await seedSave(ctx, slices, "__qualityVerdictFixture");

    const page = await ctx.newPage();
    await page.addInitScript(() => {
      Math.random = () => 1;
    });
    const pageErrors = [];
    watchPageErrors(page, pageErrors);

    for (const item of items) {
      const want = qualityVerdict(item.quality);
      await openRoute(page, "/inventory", 900);
      await clearOverlays(page);
      await page.locator(`main button[data-uid="${item.uid}"]`).first().click({ timeout: 4000 });
      await page.waitForTimeout(450);
      checked += 1;
      const got = await page.evaluate(() => {
        const line = document.querySelector("[data-equipment-verdict-line]");
        const eyebrow = document.querySelector(".equip-dossier__eyebrow");
        const qualityEl = document.querySelector(".equip-dossier__quality");
        if (!line) return { present: false };
        const rect = line.getBoundingClientRect();
        return {
          present: true,
          text: (line.textContent || "").replace(/\s+/g, " ").trim(),
          // 与品阶名是否同一条基线(相差不超过一行高的一半就算同一行)
          sameLine: qualityEl
            ? Math.abs(rect.top - qualityEl.getBoundingClientRect().top) <= rect.height * 0.6
            : false,
          overflow: eyebrow ? eyebrow.scrollWidth - eyebrow.clientWidth : 0,
        };
      });
      if (!got.present) {
        failures.push(`[390] 品评场景:${item.quality} 的器评帖上没有品评`);
      } else {
        if (got.text !== want)
          failures.push(`[390] 品评场景:${item.quality} 的品评与表不一致「${got.text}」`);
        if (!got.sameLine)
          failures.push(`[390] 品评场景:${item.quality} 的品评被挤到眉题之外的另一行`);
        if (got.overflow > 1)
          failures.push(`[390] 品评场景:${item.quality} 的眉题横向溢出 ${got.overflow}px`);
      }
      for (let i = 0; i < 3 && (await page.locator(".modal-panel").count()) > 0; i += 1) {
        await page.keyboard.press("Escape").catch(() => {});
        await page.waitForTimeout(200);
      }
    }

    // 藏珍详情:对得上品质的条目带同一句。
    // ① 藏珍默认在「功名榜」,要先切到「藏珍阁」;② 一次只展开一柜,再点开「装备」柜。
    await openRoute(page, "/collection?tab=collection", 900);
    await clearOverlays(page);
    checked += 1;
    const openedShelf = await page.evaluate(() => {
      const toggle = document.querySelector('[data-collection-category-toggle="equip"]');
      if (toggle) toggle.click();
      return Boolean(toggle);
    });
    if (!openedShelf) {
      failures.push("[390] 品评场景:藏珍里找不到「装备」柜的展开签");
    } else {
      await page.waitForTimeout(400);
    }
    const codex = await page.evaluate(() => {
      const token = document.querySelector('[data-codex-entry="equip"]');
      if (!token) return { found: false };
      token.click();
      return { found: true };
    });
    if (!codex.found) {
      failures.push("[390] 品评场景:装备柜展开后仍没有已收录条目(夹具的装备册是空的?)");
    } else {
      await page.waitForTimeout(450);
      const detail = await page.evaluate(() => {
        const el = document.querySelector("[data-codex-verdict]");
        return {
          present: Boolean(el),
          text: (el?.textContent ?? "").replace(/\s+/g, " ").trim(),
        };
      });
      if (!detail.present) {
        failures.push("[390] 品评场景:藏珍详情没有品评");
      } else if (!Object.values(QUALITY_VERDICTS).includes(detail.text)) {
        failures.push(`[390] 品评场景:藏珍详情的品评不是九句里的任何一句「${detail.text}」`);
      }
    }

    if (pageErrors.length) {
      failures.push(`[390] 品评场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
    }
    if (failures.length === 0) {
      console.log(`\n品评:天品/神品各在眉题同一行说出自己的分量(${qualityVerdict("divine")})`);
    }
  } finally {
    await ctx.close();
  }
  return { failures, checked, contrastFails: [], pixelContrastFails: [], zoomFails: [] };
}

/**
 * 道记 —— 择道那一刻的落款要在真渲染里说得出来,并随存档往返。
 *
 * 为什么必须真浏览器量:
 *   一 落款是**择道之后才有**的一行,它挂在二步确认之后的分支面板里 ——
 *      源码判据只能證明那个类名写过,量不到「择完之后那一行真的出现了」;
 *   二 它记的是当时的年岁与境界,那是**存档里的数**,导出导入之后还在才算真的落了盘。
 *
 * 判据:
 *   一 未择道时不出现落款;择完之后出现,且含年岁、境界与舍掉的路;
 *   二 再关再开,同一行一字不改(落款是数据,不是每次重算);
 *   三 整页重载之后仍在 —— 它真进了存档。
 */
async function taskDaoNote() {
  const failures = [];
  let checked = 0;
  const ctx = await auditContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  try {
    // 一门满级、尚未择道的功法:太玄引气诀(3 条分支)
    const target = GONGFA.find((g) => g.maxLevel === 9 && branchesFor(g.id).length >= 3);
    if (!target) throw new Error("道记夹具:找不到满级且有三条分支的功法");
    const branches = branchesFor(target.id);
    const picked = branches[0];
    const slices = showcaseSlices("light");
    slices.cultivation = {
      ...slices.cultivation,
      learned: { [target.id]: target.maxLevel },
      mainGongfa: target.id,
      subGongfa: [],
      gongfaBranch: {},
      daoNotes: {},
    };
    await seedSave(ctx, slices, "__daoNoteFixture");

    const page = await ctx.newPage();
    await page.addInitScript(() => {
      Math.random = () => 1;
    });
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    await openRoute(page, "/cultivation", 900);
    await clearOverlays(page);

    const openTarget = async () => {
      await page
        .locator("main button", { hasText: new RegExp(target.name) })
        .first()
        .click({ timeout: 4000 });
      await page.waitForTimeout(400);
    };
    const readNote = () =>
      page.evaluate(() => {
        const el = document.querySelector("[data-gongfa-dao-note]");
        return el ? (el.textContent || "").replace(/\s+/g, " ").trim() : "";
      });
    const closeDialog = async () => {
      for (let i = 0; i < 3 && (await page.locator(".modal-panel").count()) > 0; i += 1) {
        await page.keyboard.press("Escape").catch(() => {});
        await page.waitForTimeout(200);
      }
    };

    // 未择道:没有落款
    await openTarget();
    checked += 1;
    if (await readNote()) failures.push("[390] 道记场景:还没择道就已经有落款了");

    // 择道(二步确认):落款出现,且含年岁与舍掉的分支名
    checked += 1;
    const pickButton = page
      .locator(".modal-panel button", { hasText: new RegExp(`^${picked.name}`) })
      .first();
    if ((await pickButton.count()) === 0) {
      failures.push(`[390] 道记场景:分支「${picked.name}」的入口找不到`);
    } else {
      await pickButton.click({ timeout: 3000 });
      const confirm = page.locator(".modal-panel button", { hasText: /确认择道/ }).first();
      if ((await confirm.count()) === 0) {
        failures.push("[390] 道记场景:二步确认不见了 —— 终身不改的抉择不该一下就了结");
      } else {
        await confirm.click({ timeout: 3000 });
        await page.waitForTimeout(500);
      }
    }
    const first = await readNote();
    if (!first) {
      failures.push("[390] 道记场景:择完道却没有落款");
    } else {
      if (!/岁/.test(first)) failures.push(`[390] 道记场景:落款里没有年岁(${first})`);
      if (!/择此道/.test(first)) failures.push(`[390] 道记场景:落款没有说这是择道那一刻(${first})`);
      for (const other of branches.slice(1)) {
        if (!first.includes(other.name))
          failures.push(`[390] 道记场景:舍掉的「${other.name}」没写进落款(${first})`);
      }
      if (first.includes(picked.name) && !/舍/.test(first))
        failures.push(`[390] 道记场景:落款把选中的那条也列成了舍掉的(${first})`);
    }
    await closeDialog();

    // 关掉再开:一字不改
    checked += 1;
    await openTarget();
    const second = await readNote();
    if (second !== first) {
      failures.push(`[390] 道记场景:再开一次就改了口「${first}」→「${second}」`);
    }
    await closeDialog();

    // 整页重载:它真进了存档
    checked += 1;
    await page.reload({ waitUntil: "load" });
    await page.waitForTimeout(900);
    await openRoute(page, "/cultivation", 900);
    await clearOverlays(page);
    await openTarget();
    const third = await readNote();
    if (third !== first) {
      failures.push(`[390] 道记场景:重载之后落款没了或改了「${first}」→「${third}」`);
    }
    await closeDialog();

    if (pageErrors.length) {
      failures.push(`[390] 道记场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
    }
    if (failures.length === 0) {
      console.log(`\n道记:择道后落一句、重开与重载都不改口(「${target.name}」${first})`);
    }
  } finally {
    await ctx.close();
  }
  return { failures, checked, contrastFails: [], pixelContrastFails: [], zoomFails: [] };
}

/**
 * 灵兽契语 —— 只在「相伴」处出声,唤伴那一下真的说得出来。
 *
 * 为什么必须真浏览器量:
 *   一 契语只该出现在相伴面板与图鉴条目,**灵兽谱的逐行不许铺** —— 这条靠源码判据
 *      只能證明「那个字符串没写在某个切片里」,真正的样子得看渲染后的行里有没有它;
 *   二 唤伴是一个动作,提示条是它的回声 —— 表里有这一句而按钮不响,等于没有。
 *
 * 判据:
 *   一 相伴面板上有契语,且与 `data/petVows` 里这一只的那句逐字相同;
 *   二 灵兽谱逐行里不出现任何契语(整册四十句并排就不再是契语);
 *   三 点「唤来」之后,提示条里出现这一只的名字与它的契语。
 */
async function taskPetVow() {
  const failures = [];
  let checked = 0;
  const ctx = await auditContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  try {
    if (PETS.filter((p) => PET_VOWS[p.id]).length !== PETS.length) {
      throw new Error("灵兽契语夹具:有灵兽没有契语,这一条判据会量到空");
    }
    const slices = showcaseSlices("light");
    slices.player = { ...slices.player, petId: null };
    slices.quests = {
      ...slices.quests,
      collections: { ...slices.quests.collections, pet: PETS.map((p) => p.id) },
      // 刻意为空:唤伴要能真的记档(见 quests.recordPetCompanion)
      petCompanions: [],
    };
    await seedSave(ctx, slices, "__petVowFixture");

    const page = await ctx.newPage();
    await page.addInitScript((vows) => {
      Math.random = () => 1;
      // 契语全表投进页面:谱上泄漏任何一句都能被认出来,不必只知道被点名的那一只
      window.ALL_VOWS = vows;
    }, Object.values(PET_VOWS));
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    await openRoute(page, "/titles", 900);
    await clearOverlays(page);

    const petTab = page.getByRole("tab", { name: /灵兽/ }).first();
    if ((await petTab.count()) === 0) throw new Error("灵兽页签找不到");
    await petTab.click({ timeout: 3000 });
    await page.waitForTimeout(400);

    // 唤来之前:面板上没有契语(此刻无伴),逐行里也不该有
    checked += 1;
    const before = await page.evaluate(() => {
      const rows = [...document.querySelectorAll("[data-pet-row]")];
      return {
        hasVow: Boolean(document.querySelector("[data-pet-vow]")),
        // 谱上任何一句契语都算漏 —— 四十句并排就成了文案表
        leaked: (window.ALL_VOWS || []).filter((vow) =>
          rows.some((r) => (r.textContent ?? "").includes(vow)),
        ),
        rows: rows.length,
        first: rows[0]?.getAttribute("data-pet-row") ?? "",
      };
    });
    if (before.hasVow) failures.push("[390] 契语场景:还没有相伴面板就已有契语");
    if (before.rows === 0) failures.push("[390] 契语场景:灵兽谱一行都没渲染出来");
    if (before.leaked.length > 0)
      failures.push(`[390] 契语场景:灵兽谱逐行里铺了契语 —— 那是文案墙(${before.leaked[0]})`);
    const target = PETS.find((p) => p.id === before.first);
    if (!target) throw new Error(`灵兽契语夹具:首行 ${before.first} 不在灵兽表里`);
    const vow = PET_VOWS[target.id];

    // 唤来那一只:提示条要说它的名与它的契语
    checked += 1;
    const row = page.locator(`[data-pet-row="${target.id}"]`);
    if ((await row.count()) === 0) {
      failures.push(`[390] 契语场景:灵兽谱里找不到 ${target.name}(夹具未收录?)`);
    } else {
      await row.getByRole("button", { name: "唤来" }).click({ timeout: 3000 });
      await page.waitForTimeout(450);
      const toast = await page.evaluate(() =>
        [...document.querySelectorAll("[data-toast]")]
          .map((b) => (b.textContent || "").trim())
          .join(" | "),
      );
      if (!toast.includes(target.name))
        failures.push(`[390] 契语场景:唤伴提示里没有它的名字(${toast || "无提示"})`);
      if (!toast.includes(vow)) failures.push(`[390] 契语场景:唤伴提示里没有它的契语(${toast})`);
    }

    // 唤来之后:相伴面板上要有这一句,且逐行里仍然没有
    checked += 1;
    await page.waitForTimeout(300);
    const after = await page.evaluate((vowText) => {
      const block = document.querySelector("[data-pet-vow]");
      const rows = [...document.querySelectorAll("[data-pet-row]")];
      return {
        text: (block?.textContent ?? "").replace(/\s+/g, " ").trim(),
        inRows: rows.some((r) => (r.textContent ?? "").includes(vowText)),
        overflow: block ? block.scrollWidth - block.clientWidth : 0,
      };
    }, vow);
    if (after.text !== vow)
      failures.push(`[390] 契语场景:相伴面板上的契语与表里不一致「${after.text}」`);
    if (after.inRows) failures.push("[390] 契语场景:唤伴之后灵兽谱逐行里也铺上了契语");
    if (after.overflow > 1) failures.push(`[390] 契语场景:契语行横向溢出 ${after.overflow}px`);

    if (pageErrors.length) {
      failures.push(`[390] 契语场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
    }
    if (failures.length === 0) {
      console.log(
        `\n灵兽契语:谱上不铺、相伴面板与唤伴提示各说一遍(「${target.name}」:${vow.slice(0, 12)}…)`,
      );
    }
  } finally {
    await ctx.close();
  }
  return { failures, checked, contrastFails: [], pixelContrastFails: [], zoomFails: [] };
}

/**
 * 器铭 —— 「这一件」的出身要在真渲染里说得出来,并且**重复打开与重载之后一字不改**。
 *
 * 为什么不在这里现算一份来对:铭由 uid 决定,而 Node 侧解析不了 `@/` 别名(见
 * `scripts/lib/saveFixture` 的说明),照搬一份算法就变成第二本账 —— 那正是要防的。
 * 这里量的是**只有真渲染才看得见**的三件事:
 *   一 天品的器首真有器铭,铭名 / 铭文 / 成色三项齐全,且 0~100;
 *   二 关掉再开、整页重载之后**逐字相同**(铭只由 uid 定,不许随渲染重掷);
 *   三 精品件不出现器铭 —— 人人有铭等于人人无铭。
 * 核心那一侧(铭与件相配、成色单调、铭库不重复)由 `core/inscription.spec` 守。
 */
async function taskInscription() {
  const failures = [];
  let checked = 0;
  const ctx = await auditContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  const rareItem = {
    uid: "insc_rare",
    templateId: "h_miwu",
    quality: "heaven",
    tier: 16,
    level: 0,
    affixes: [
      { id: "hp3", roll: 0.4 },
      { id: "bs3", roll: 0.8 },
    ],
  };
  const twinItem = { ...rareItem, uid: "insc_twin" };
  const commonItem = {
    uid: "insc_common",
    templateId: "h_muzan",
    quality: "excellent",
    tier: 1,
    level: 0,
    affixes: [{ id: "def1", roll: 1 }],
  };
  try {
    const slices = showcaseSlices("light");
    slices.inventory = {
      ...slices.inventory,
      items: [rareItem, twinItem, commonItem, ...slices.inventory.items],
      equipped: {},
      seenUids: [rareItem.uid, twinItem.uid, commonItem.uid],
      seenSeeded: true,
    };
    await seedSave(ctx, slices, "__inscriptionFixture");

    const page = await ctx.newPage();
    const pageErrors = [];
    watchPageErrors(page, pageErrors);

    const readDossier = () =>
      page.evaluate(() => {
        const root = document.querySelector("[data-equipment-dossier]");
        if (!root) return null;
        const block = root.querySelector("[data-equipment-inscription]");
        const overflow = root.scrollWidth - root.clientWidth;
        if (!block) return { present: false, overflow };
        const text = (sel) =>
          (block.querySelector(sel)?.textContent ?? "").replace(/\s+/g, " ").trim();
        const temperRaw = (
          block.querySelector("[data-equipment-inscription-temper] strong")?.textContent ?? ""
        ).replace(/[^0-9.-]/g, "");
        return {
          present: true,
          overflow,
          title: text(".equip-dossier__inscription-title"),
          verse: text(".equip-dossier__inscription-verse"),
          temper: Number(temperRaw),
          full: (block.textContent ?? "").replace(/\s+/g, " ").trim(),
        };
      });

    const openItem = async (uid) => {
      await openRoute(page, "/inventory", 900);
      await clearOverlays(page);
      await page.locator(`main button[data-uid="${uid}"]`).first().click({ timeout: 4000 });
      await page.waitForTimeout(450);
    };
    const closeDialog = async () => {
      for (let i = 0; i < 3 && (await page.locator(".modal-panel").count()) > 0; i += 1) {
        await page.keyboard.press("Escape").catch(() => {});
        await page.waitForTimeout(200);
      }
    };

    const seen = new Map();
    for (const item of [rareItem, twinItem]) {
      await openItem(item.uid);
      const got = await readDossier();
      checked += 1;
      if (!got) {
        failures.push(`[390] 器铭场景:${item.uid} 的器评帖没渲染出来`);
      } else if (!got.present) {
        failures.push(`[390] 器铭场景:${item.uid}(天品)的器首没有器铭 —— 高级别的出身没露出来`);
      } else {
        if (!got.title) failures.push(`[390] 器铭场景:${item.uid} 没有铭名`);
        if (!got.verse) failures.push(`[390] 器铭场景:${item.uid} 没有铭文`);
        if (!(got.temper >= 0 && got.temper <= 100))
          failures.push(`[390] 器铭场景:${item.uid} 的成色读数越出 0~100(${got.temper})`);
        if (got.overflow > 1)
          failures.push(`[390] 器铭场景:${item.uid} 的器铭行横向溢出 ${got.overflow}px`);
        seen.set(item.uid, got.full);
      }
      await closeDialog();
    }

    // 重载 + 重开同一件:铭是出身,不许随渲染重掷
    if (seen.size > 0) {
      const uid = rareItem.uid;
      await page.reload({ waitUntil: "load" });
      await page.waitForTimeout(800);
      await openItem(uid);
      const again = await readDossier();
      checked += 1;
      if (!again?.present) {
        failures.push(`[390] 器铭场景:重载之后 ${uid} 的器铭不见了`);
      } else if (again.full !== seen.get(uid)) {
        failures.push(
          `[390] 器铭场景:${uid} 的铭在重载后改了口 ——「${seen.get(uid)}」→「${again.full}」`,
        );
      }
      await closeDialog();
      if (seen.size === 2) {
        const [a, b] = [seen.get(rareItem.uid), seen.get(twinItem.uid)];
        if (a && b && a === b) {
          failures.push(
            `[390] 器铭场景:同模板同品质的两件取到了同一枚铭 —— 逐件不同才是「这一件的出身」(${a})`,
          );
        }
      }
    }

    await openItem(commonItem.uid);
    checked += 1;
    const commonGot = await readDossier();
    if (commonGot?.present) {
      failures.push("[390] 器铭场景:精品件也刻了铭 —— 灵品以下不该有铭,人人有铭等于人人无铭");
    }
    await closeDialog();

    if (pageErrors.length) {
      failures.push(`[390] 器铭场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
    }
    if (failures.length === 0) {
      console.log("\n器铭:天品两件各有其铭、重载后一字不改、成色在 0~100、精品件无铭");
    }
  } finally {
    await ctx.close();
  }
  return { failures, checked, contrastFails: [], pixelContrastFails: [], zoomFails: [] };
}

/** 真打一场历练战斗 */
async function taskCombatReplay() {
  const failures = [];
  let checked = 0;
  const contrastFails = [];
  const pixelContrastFails = [];
  const zoomFails = [];
  // ---- 第十九件事:真打一场历练战斗,看战报回放与战斗分析 ----
  /*
   * 战报是这游戏里**看得最多**的一屏:出发 → 模式 → 等一场 → 逐行回放 → 结语,
   * 而这条链只在单元用例里跑过引擎、从没在真浏览器里走完过。
   * 判据只要四件事:探索真的开起来了、战报回放出了行、结语写清回合与胜负、
   * 战斗分析点得开且给得出数据面板(总输出/总承伤那一组)。
   */
  {
    const ctx = await auditContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    });
    const enc = encryptSlice;
    const gn = (m, e) => ({ m, e });
    const slices = {
      game: {
        started: true,
        saveVersion: 2,
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
        totalPlaySec: 0,
        createRerolls: 8,
        createProfile: null,
      },
      player: {
        name: "战斗自检",
        major: 5,
        sub: 3,
        exp: gn(1, 2),
        age: 40,
        lifespanBonusYears: 0,
        dead: false,
        reincarnation: {
          count: 0,
          daoFruit: 0,
          talents: [],
          insight: 0,
          lives: [],
          vow: null,
          trial: null,
          bonds: [],
        },
        linggen: {
          roots: [{ element: "wood", aptitude: 70 }],
          gradeName: "单灵根",
          growthMult: 1.1,
        },
      },
      resources: { spiritStone: gn(1, 6), qi: 1000, wudao: 10, herb: 5, ore: 5, page: 2, dust: 2 },
      // 一件高 Tier 的武器:让首战打得赢、回放短,判据才不至于看运气
      inventory: {
        items: [
          {
            uid: "p_w",
            templateId: "w_zidian",
            quality: "heaven",
            tier: 20,
            level: 4,
            affixes: [],
          },
        ],
        equipped: { weapon: "p_w" },
        pills: {},
        artifacts: [],
        equippedArtifacts: [],
      },
      endgame: { daoPath: null, daoSource: 0, souls: [], equippedSouls: [] },
      settings: {
        privacyAccepted: true,
        sfxOn: false,
        musicOn: false,
        musicVol: 0,
        sfxVol: 0,
        reduceMotion: true,
        battleSpeed: 4,
        decomposeRanks: [],
        smartKeep: { enabled: true, minQuality: 3, keepCoreAffix: true, keepComboPiece: true },
        theme: "light",
      },
    };
    await ctx.addInitScript(
      (data) => {
        if (localStorage.getItem("__layoutSeeded")) return;
        for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
        localStorage.setItem("__layoutSeeded", "1");
      },
      Object.fromEntries(Object.entries(slices).map(([k, v]) => [`${SAVE_PREFIX}${k}`, enc(v)])),
    );
    const page = await ctx.newPage();
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    await page.goto(INDEX + "#" + "/adventure", { waitUntil: "load" });
    await page.waitForTimeout(2400);
    await clearOverlays(page);
    checked += 1;
    await page
      .locator("main button", { hasText: /出\s*发/ })
      .first()
      .click({ timeout: 3000 })
      .catch(() => {});
    await page.waitForTimeout(600);
    // 「出发」先开模式窗:此行欲作何打算
    await page
      .locator(".modal-panel button", { hasText: /寻常游历/ })
      .first()
      .click({ timeout: 3000 })
      .catch(() => {});
    /*
     * 把这一页拉到前台:后台页面的定时器会被浏览器节流(setInterval 从 1 秒拖到 1 分钟),
     * 而引擎的心跳正是 1 秒一拍 —— 实测不拉前台时,45 秒里一场都没打(「胜 0 场」)。
     */
    await page.bringToFront();
    // 首战间隔 12 秒 ÷ 历练速度,故最多等 30 秒
    let summary = "";
    let logLines = 0;
    let lastTail = "";
    // 停下来的条件要带上「战报有行」:回放是逐行画出来的,结语先出现、行随后才铺满 ——
    // 只看结语就收工,会偶发地在那一瞬数出 0 行(实测撞到过一次),把好代码判成坏代码
    for (let i = 0; i < 60 && !(summary && logLines > 0); i += 1) {
      await page.waitForTimeout(1000);
      /*
       * 历练的第一步未必是战斗:引擎每个战斗槽位都会先掷一次「际遇」,中了就弹事件窗,
       * 而事件窗挡着战斗(超时才会自动按默认选项处理)—— 实测这就是「等了 45 秒 0 场」的原因。
       * 故这里遇到事件窗就当场选第一个选项把它了结,让历练继续往下走。
       */
      const modalChoice = page.locator(".modal-panel button").nth(0);
      if ((await page.locator(".modal-panel").count()) > 0 && (await modalChoice.count()) > 0) {
        const evTitle = await page.evaluate(() =>
          (document.querySelector(".modal-panel h3")?.textContent || "").trim(),
        );
        await modalChoice.click({ timeout: 2000 }).catch(() => {});
        console.log(`  (历练中遇到际遇「${evTitle}」,已按第一个选项了结,继续等战斗)`);
        await page.waitForTimeout(600);
        continue;
      }
      const info = await page.evaluate(() => {
        const text = document.querySelector("main")?.innerText || "";
        return {
          running: document.querySelector("[data-combat-session]") !== null,
          /*
           * 战报行直接数回放框里的 <p>,不再拿关键词去猜文本。
           * 原来数的是 击中|施展|避开|打断|气血逆涌 五个词 —— 而暴击那行写的是
           * 「会心一击!…受创甚重」,五个词一个不沾;一击暴击定胜负的战斗(实测碰到过,
           * 战后气血 100%)于是被误判成「回放没出内容」,红得毫无道理。
           */
          lines: document.querySelectorAll("[data-battle-log]").length,
          summary: (text.match(/此战 \d+ 回合[^\r\n]*/) || [""])[0],
          tail: text.replace(/\s+/g, " ").slice(-80),
        };
      });
      logLines = Math.max(logLines, info.lines);
      summary = info.summary;
      lastTail = info.tail;
      if (i === 0 && !info.running)
        failures.push("[390] 战斗场景:点了「出发」并择了模式,历练却没跑起来");
    }
    // 兜底再等一拍:真的没有战报行时,这里仍然是 0,断言照旧会红
    if (summary && logLines === 0) {
      await page.waitForTimeout(1500);
      logLines = await page.evaluate(() => document.querySelectorAll("[data-battle-log]").length);
    }
    // 首战间隔 12 秒 ÷ 历练速度;45 秒还没等到,就把当前页面写进报告(「搜寻猎物中」还是「胜 N 场」一看便知)
    if (!summary)
      failures.push(
        `[390] 战斗场景:等了 60 秒也没等到一场的结语(战报回放没走完?) 当前页面:${lastTail}`,
      );
    else {
      if (logLines === 0) failures.push("[390] 战斗场景:有结语却没有战报行(回放没出内容)");
      if (!/胜|负/.test(summary)) failures.push(`[390] 战斗场景:结语没写清胜负 —— ${summary}`);
      // 战斗分析:点开要看得到数据面板
      const analysisBtn = page.locator("main button", { hasText: /战斗分析/ }).first();
      if ((await analysisBtn.count()) === 0) failures.push("[390] 战斗场景:找不到「战斗分析」入口");
      else {
        await analysisBtn.click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(400);
        const analysisText = await page.evaluate(
          () => document.querySelector("main")?.innerText || "",
        );
        if (!/总输出|总承伤/.test(analysisText))
          failures.push("[390] 战斗场景:点开战斗分析也没看到数据面板(总输出/总承伤)");
        else console.log(`\n战斗回放:${summary} · 战报 ${logLines} 行 · 分析面板可开`);
      }
    }
    if (
      /NaN|undefined|Infinity/.test(
        await page.evaluate(() => document.querySelector("main")?.innerText || ""),
      )
    ) {
      failures.push("[390] 战斗场景:战报里漏出占位符");
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await quiesceOverlays(page);
    await settleVisuals(page);
    if (SHOTS) {
      mkdirSync(SHOTS_DIR, { recursive: true });
      await page.screenshot({
        path: join(SHOTS_DIR, "390_battle.png"),
        fullPage: true,
        animations: "disabled",
      });
    }
    for (const bad of await measureTextContrast(page)) {
      contrastFails.push(
        `[390] /adventure 战斗 ${bad.theme} ${bad.ratio}:1(需 ${bad.need})${bad.size}px «${bad.text}»`,
      );
    }
    const sampler = await pixelSampler(ctx);
    for (const bad of await pixelContrastOf(page, sampler)) {
      pixelContrastFails.push(
        `[390] /adventure 战斗 ${bad.theme} 5% 分位 ${bad.p05}:1 · 读不出来 ${bad.badPct}%(需 ${bad.need})${bad.size}px «${bad.text}» ${bad.cls}`,
      );
    }
    if (pageErrors.length)
      failures.push(`[390] 战斗场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
    await ctx.close();
  }

  return { failures, checked, contrastFails, pixelContrastFails, zoomFails };
}

/** 敌人卡最挤的一档 */
async function taskEnemyCard() {
  const failures = [];
  let checked = 0;
  const contrastFails = [];
  const pixelContrastFails = [];
  const zoomFails = [];
  // ---- 第三十六件事:敌人卡的最挤一档(长名字 + 满标签) ----
  /*
   * 敌人名字最长 9 字(残魂·堕落冰魄仙子),标签最多 5 枚(首领 / 宿敌 + 3 个路数特性),
   * 再叠上适配星级。从前这些全挤在一行 nowrap 的 flex 里,320 宽下名字被折成两行、
   * 标签压在一起 —— 而巡页用的档里敌人名字都短、认知层也是 0(特性根本不显示),
   * 这一档从来没有被量过:夹具缺什么,判据就瞎什么。
   *
   * 夹具直接摆出这一档:认知层 2(知其路数 → 特性显示)、宿敌记录(→ 宿敌标签)、
   * 首领身份(→ 首领标签)、真仙境的敌人(→ 名字最长的那个)。
   */
  {
    const ctx = await auditContext({
      viewport: { width: 320, height: 568 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    const enc = encryptSlice;
    const gn = (m, e) => ({ m, e });
    const now = Date.now();
    const slices = {
      game: {
        started: true,
        saveVersion: 2,
        createdAt: now - 86400000,
        lastActiveAt: now,
        totalPlaySec: 600,
        createRerolls: 8,
        createProfile: null,
      },
      player: {
        name: "战斗卡自检",
        major: 12,
        sub: 3,
        exp: gn(1, 3),
        age: 300,
        dead: false,
        nemeses: [
          {
            enemyId: "e_icefairy",
            enemyName: "堕落冰魄仙子",
            regionId: "leichi",
            lossCount: 3,
            lastLossAt: now,
          },
        ],
        reincarnation: {
          count: 1,
          daoFruit: 3,
          talents: [],
          insight: 50,
          lives: [],
          vow: null,
          trial: null,
          bonds: [],
        },
        linggen: {
          roots: [{ element: "ice", aptitude: 90 }],
          gradeName: "单灵根",
          growthMult: 1.2,
        },
      },
      resources: {
        spiritStone: gn(8, 7),
        qi: 5000,
        wudao: 200,
        herb: 100,
        ore: 100,
        page: 20,
        dust: 40,
      },
      inventory: {
        items: [
          {
            uid: "w1",
            templateId: "w_zidian",
            quality: "heaven",
            tier: 12,
            level: 2,
            affixes: [
              { id: "bs3", roll: 1 },
              { id: "low2", roll: 1 },
            ],
          },
        ],
        equipped: { weapon: "w1" },
        pills: {},
        artifacts: [],
        equippedArtifacts: [],
      },
      cultivation: {
        learned: { g_qingyun: 6 },
        mainGongfa: "g_qingyun",
        subGongfa: [],
        buffs: [],
        gongfaBranch: {},
      },
      lore: {
        materialLore: {},
        materialSeen: {},
        recipeLore: {},
        blueprintLore: {},
        skillExp: {},
        enemyLore: { e_icefairy: 2 }, // 知其路数 → 特性标签会显示
        enemySeen: { e_icefairy: 6 },
        studyFrac: 0,
        seeded: true,
      },
      adventure: {
        unlocked: ["qingyun", "luoxia", "heifeng", "leichi"],
        cleared: ["qingyun", "luoxia"],
        mortalCleared: [],
        session: {
          regionId: "leichi",
          mode: "risky",
          startedAt: now - 60000,
          endsAt: now + 3600000,
          nextBattleAt: now + 12000,
          wins: 4,
          losses: 1,
          events: 1,
          stoneGain: gn(1.2, 6),
          expGain: gn(3.4, 6),
          itemGain: 3,
        },
        pendingEventId: null,
        pendingEventSince: 0,
        seenOnceEvents: [],
        lastBattle: {
          enemyName: "残魂·堕落冰魄仙子",
          enemyIcon: "snowflake",
          enemyId: "e_icefairy",
          isBoss: true,
          result: {
            win: true,
            rounds: 7,
            playerHpPct: 0.62,
            firstMove: { playerFirst: true, playerSpeed: 1.07, enemySpeed: 0.7 },
            stats: {
              player: {
                dealt: gn(2.6, 6),
                taken: gn(8.2, 5),
                pierceTaken: gn(1.1, 5),
                biggestHitTaken: gn(2.4, 5),
                healed: gn(0, 0),
                shieldAbsorbed: gn(0, 0),
                dodges: 1,
                missedHits: 2,
                hitsLanded: 9,
                counters: 0,
                combos: 2,
                crits: 3,
                skillCasts: 1,
                artifactProcs: 0,
                stunnedTurns: 0,
              },
              enemy: {
                dealt: gn(8.2, 5),
                taken: gn(2.6, 6),
                pierceTaken: gn(0, 0),
                biggestHitTaken: gn(2.6, 6),
                healed: gn(0, 0),
                shieldAbsorbed: gn(0, 0),
                dodges: 0,
                missedHits: 0,
                hitsLanded: 6,
                counters: 1,
                combos: 0,
                crits: 1,
                skillCasts: 2,
                artifactProcs: 0,
                stunnedTurns: 0,
              },
            },
            log: [
              { t: "atk", side: "p", text: "你挥剑直取,", php: 1, ehp: 0.8 },
              { t: "crit", side: "p", text: "会心一击!", dmg: "12", php: 1, ehp: 0.4 },
              { t: "win", side: "sys", text: "你胜了。", php: 0.62, ehp: 0 },
            ],
          },
          at: now - 3000,
          loot: ["功法残页×2", "玄冰剑"],
        },
        eventMemories: {},
      },
      settings: {
        privacyAccepted: true,
        sfxOn: false,
        musicOn: false,
        musicVol: 0,
        sfxVol: 0,
        reduceMotion: true,
        battleSpeed: 4,
        decomposeRanks: [],
        smartKeep: { enabled: true, minQuality: 3, keepCoreAffix: true, keepComboPiece: true },
        theme: "dark",
      },
    };
    await ctx.addInitScript(
      (data) => {
        for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
      },
      Object.fromEntries(Object.entries(slices).map(([k, v]) => [`${SAVE_PREFIX}${k}`, enc(v)])),
    );
    const page = await ctx.newPage();
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    await page.goto(INDEX + "#/adventure", { waitUntil: "load" });
    /**
     * 等敌人卡出现,而不是固定等 2200ms 再读一次。
     *
     * 装备表涨到 288 件之后,冷启动到首帧的时间开始浮动 —— 单次定时读会偶发读空,
     * 于是这条判据报的是「夹具没读出来」,而真相只是「还没画到」。判据本身不变:
     * 卡必须出现,名字必须单行,标签必须够四枚。只是把「读一次」改成「等到出现为止」。
     */
    await page.waitForSelector("[data-foe-name]", { timeout: 8000 }).catch(() => undefined);
    await page.evaluate(() => {
      Math.random = () => 1;
    });
    const foe = await page.evaluate(() => {
      const name = document.querySelector("[data-foe-name]");
      if (!name) return { found: false };
      const r = name.getBoundingClientRect();
      const chips = [...document.querySelectorAll(".chip-ink")].filter((el) =>
        (el.textContent || "").trim(),
      );
      return {
        found: true,
        label: (name.textContent || "").trim(),
        height: Math.round(r.height),
        lineHeight: parseFloat(getComputedStyle(name).lineHeight) || 16,
        chips: chips.length,
      };
    });
    checked += 1;
    if (!foe.found) {
      failures.push("[320-battle] 敌人卡场景:战斗面板没渲染出来(夹具没被读出来?)");
    } else {
      const lines = Math.round(foe.height / foe.lineHeight);
      if (lines > 1)
        failures.push(`[320-battle] 敌人名字被折成 ${lines} 行:«${foe.label}»(${foe.height}px)`);
      if (foe.chips < 4)
        failures.push(
          `[320-battle] 敌人卡场景:标签只有 ${foe.chips} 枚(夹具该摆出首领+宿敌+3 特性)`,
        );
      const info = await measurePage(page);
      for (const p of problemsOf(info)) failures.push(`[320-battle] /adventure → ${p}`);
      /*
       * 战局谱收成一册连续战卷。这里不再只量「数字有没有被裁」:
       * 外账若重新长出四边框、战绩又缩回四分格、战报或分析重新套内框,
       * 都要在真浏览器里当场现形。390 另核战报在首屏探出,195 核三格仍横排。
       */
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(180);
      const analysisButton = page.locator("main button", { hasText: /战斗分析/ }).first();
      const analysisOpened = (await analysisButton.count()) > 0;
      if (!analysisOpened) {
        failures.push("[390-battle] 战卷场景:找不到战斗分析入口,无法核展开账页");
      } else {
        await analysisButton.click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(260);
      }
      for (const vp of [
        { width: 390, height: 844, tag: "390" },
        { width: 320, height: 568, tag: "320" },
        { width: 195, height: 422, tag: "195" },
      ]) {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.waitForTimeout(180);
        const ledger = await page.evaluate(() => {
          const style = (el) => {
            if (!el) return null;
            const s = getComputedStyle(el);
            return {
              top: parseFloat(s.borderTopWidth) || 0,
              right: parseFloat(s.borderRightWidth) || 0,
              bottom: parseFloat(s.borderBottomWidth) || 0,
              left: parseFloat(s.borderLeftWidth) || 0,
              radius: parseFloat(s.borderTopLeftRadius) || 0,
              background: s.backgroundColor,
              shadow: s.boxShadow,
            };
          };
          const box = (el) => {
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return { top: r.top, right: r.right, bottom: r.bottom, left: r.left, width: r.width };
          };
          const stats = [...document.querySelectorAll("[data-combat-stat]")].map((el) => {
            const strong = el.querySelector("strong");
            return {
              id: el.getAttribute("data-combat-stat") || "?",
              box: box(el),
              cellClip: el.scrollWidth > el.clientWidth + 1,
              textClip: !!strong && strong.scrollWidth > strong.clientWidth + 1,
              text: (strong?.textContent || "").trim(),
            };
          });
          const ledgerEl = document.querySelector("[data-combat-ledger]");
          const report = document.querySelector(".combat-report__scroll");
          const paper = document.querySelector(".combat-intel__paper");
          const ledgerBox = box(ledgerEl);
          const logs = [...document.querySelectorAll("[data-battle-log]")].map((el) => ({
            clip: el.scrollWidth > el.clientWidth + 1,
            outside:
              !!ledgerBox &&
              (el.getBoundingClientRect().left < ledgerBox.left - 1 ||
                el.getBoundingClientRect().right > ledgerBox.right + 1),
            text: (el.textContent || "").trim(),
          }));
          const dataRows = [...document.querySelectorAll(".combat-intel__data-row")].map((el) => ({
            clip: el.scrollWidth > el.clientWidth + 1,
            text: (el.textContent || "").replace(/\s+/g, " ").trim(),
          }));
          return {
            found: !!ledgerEl,
            ledger: style(ledgerEl),
            session: style(document.querySelector("[data-combat-session]")),
            arena: style(document.querySelector("[data-combat-arena]")),
            report: style(report),
            paper: style(paper),
            reportBox: box(report),
            stats,
            logs,
            dataRows,
            viewportHeight: window.innerHeight,
          };
        });
        checked += 1;
        const transparent = (color) =>
          color === "transparent" || color === "rgba(0, 0, 0, 0)" || color === "";
        if (!ledger.found) {
          failures.push(`[${vp.tag}-battle] 战卷稳定落点 [data-combat-ledger] 不存在`);
        } else {
          if (
            !ledger.ledger ||
            ledger.ledger.top < 0.9 ||
            ledger.ledger.bottom < 0.9 ||
            ledger.ledger.left > 0.1 ||
            ledger.ledger.right > 0.1 ||
            ledger.ledger.radius > 0.1
          ) {
            failures.push(
              `[${vp.tag}-battle] 战卷不是只留上下账线:` +
                `边框 ${ledger.ledger?.top}/${ledger.ledger?.right}/${ledger.ledger?.bottom}/${ledger.ledger?.left}px` +
                ` · 圆角 ${ledger.ledger?.radius}px`,
            );
          }
          if (
            !ledger.session ||
            ledger.session.top > 0.1 ||
            ledger.session.right > 0.1 ||
            ledger.session.bottom > 0.1 ||
            ledger.session.left > 0.1 ||
            ledger.session.radius > 0.1 ||
            !transparent(ledger.session.background) ||
            ledger.session.shadow !== "none"
          ) {
            failures.push(
              `[${vp.tag}-battle] 征途簿又自成一张纸卡:${JSON.stringify(ledger.session)}`,
            );
          }
          if (
            !ledger.arena ||
            ledger.arena.right > 0.1 ||
            ledger.arena.bottom > 0.1 ||
            ledger.arena.left > 0.1 ||
            ledger.arena.radius > 0.1 ||
            !transparent(ledger.arena.background) ||
            ledger.arena.shadow !== "none"
          ) {
            failures.push(`[${vp.tag}-battle] 战局又自成一张纸卡:${JSON.stringify(ledger.arena)}`);
          }
          if (
            !ledger.report ||
            ledger.report.top > 0.1 ||
            ledger.report.right > 0.1 ||
            ledger.report.bottom > 0.1 ||
            ledger.report.left > 0.1 ||
            !transparent(ledger.report.background)
          ) {
            failures.push(
              `[${vp.tag}-battle] 战报框没有退成透明账页:${JSON.stringify(ledger.report)}`,
            );
          }

          const record = ledger.stats.find((row) => row.id === "record");
          const sideStats = ledger.stats.filter((row) => row.id !== "record");
          const clipped = ledger.stats.filter((row) => row.cellClip || row.textClip);
          if (clipped.length) {
            failures.push(
              `[${vp.tag}-battle] 征途簿读数被盒内裁切:` +
                clipped
                  .map(
                    (row) =>
                      `${row.id} ${row.cellClip ? "格" : ""}${row.textClip ? "字" : ""} «${row.text}»`,
                  )
                  .join(" | "),
            );
          }
          if (
            !record?.box ||
            sideStats.length !== 3 ||
            !sideStats.every((row) => row.box) ||
            record.box.bottom > Math.min(...sideStats.map((row) => row.box.top)) + 1
          ) {
            failures.push(
              `[${vp.tag}-battle] 战绩没有独占整行:` +
                `战绩底 ${record?.box?.bottom ?? "无"} / 三格顶 ${sideStats.map((row) => row.box?.top ?? "无").join(",")}`,
            );
          }
          const sideTops = sideStats.map((row) => row.box?.top ?? -1);
          if (Math.max(...sideTops) - Math.min(...sideTops) > 1) {
            failures.push(`[${vp.tag}-battle] 际遇 / 拾获 / 悟道没有并读:${sideTops.join(",")}`);
          }
          if (
            vp.tag === "390" &&
            (!ledger.reportBox || ledger.reportBox.top >= ledger.viewportHeight - 76)
          ) {
            failures.push(
              `[390-battle] 战报没有进入首屏:战报顶 ${ledger.reportBox?.top ?? "无"} / 屏高 ${ledger.viewportHeight}`,
            );
          }
          if (ledger.logs.length === 0) {
            failures.push(`[${vp.tag}-battle] 战报账行没有落进战卷`);
          } else {
            const badLogs = ledger.logs.filter((row) => row.clip || row.outside);
            if (badLogs.length) {
              failures.push(
                `[${vp.tag}-battle] 战报行越出账页或被裁:${badLogs.map((row) => row.text).join(" | ")}`,
              );
            }
          }
          if (analysisOpened) {
            if (
              !ledger.paper ||
              ledger.paper.top < 0.9 ||
              ledger.paper.right > 0.1 ||
              ledger.paper.bottom > 0.1 ||
              ledger.paper.left > 0.1 ||
              ledger.paper.radius > 0.1 ||
              !transparent(ledger.paper.background)
            ) {
              failures.push(
                `[${vp.tag}-battle] 战斗分析重新套了内层纸卡:${JSON.stringify(ledger.paper)}`,
              );
            }
            if (ledger.dataRows.length === 0) {
              failures.push(`[${vp.tag}-battle] 战斗分析展开后没有数据行`);
            } else if (ledger.dataRows.some((row) => row.clip)) {
              failures.push(
                `[${vp.tag}-battle] 战斗分析读数被盒内裁切:` +
                  ledger.dataRows
                    .filter((row) => row.clip)
                    .map((row) => row.text)
                    .join(" | "),
              );
            }
          }
        }
        for (const p of problemsOf(await measurePage(page))) {
          failures.push(`[${vp.tag}-battle] /adventure → ${p}`);
        }
        if (SHOTS) {
          await quiesceOverlays(page);
          await settleVisuals(page);
          await page.screenshot({
            path: join(SHOTS_DIR, `${vp.tag}-combat-ledger.png`),
            fullPage: true,
            animations: "disabled",
          });
        }
      }
    }
    if (pageErrors.length)
      failures.push(`[320-battle] 敌人卡场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
    await ctx.close();
  }

  return { failures, checked, contrastFails, pixelContrastFails, zoomFails };
}

/** 秘境卡「在境中」的最窄一档 */
async function taskSecretRealm320() {
  const failures = [];
  let checked = 0;
  const contrastFails = [];
  const pixelContrastFails = [];
  const zoomFails = [];
  // ---- 第四十五件事:秘境卡「在境中」的窄屏一档 ----
  /*
   * 在境中的秘境卡有一行本层预览：本层劫 / 胜算 · 战利。它从前整段 whitespace-nowrap,
   * 320 宽上必然顶出卡片 —— 但巡页的档里没有在途秘境,三十三那份 320 地界夹具的
   * adventure 切片也没有 secretRealm,于是这一档从来没被量过:夹具缺什么,判据就瞎什么。
   *
   * 夹具摆出「打到第二层、带着战利、付过门票」的那一版,并把敌人名字给到最长的那类,
   * 让两个 nowrap 组都撑到最满。
   */
  {
    const ctx = await auditContext({
      viewport: { width: 320, height: 568 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    const enc = encryptSlice;
    const gn = (m, e) => ({ m, e });
    const now = Date.now();
    const slices = {
      game: {
        started: true,
        saveVersion: 2,
        createdAt: now - 86400000,
        lastActiveAt: now,
        totalPlaySec: 600,
        createRerolls: 8,
        createProfile: null,
      },
      player: {
        name: "秘境卡自检",
        major: 12,
        sub: 3,
        exp: gn(1, 3),
        age: 300,
        dead: false,
        reincarnation: {
          count: 1,
          daoFruit: 3,
          talents: [],
          insight: 50,
          lives: [],
          vow: null,
          trial: null,
          bonds: [],
        },
        linggen: {
          roots: [{ element: "ice", aptitude: 90 }],
          gradeName: "单灵根",
          growthMult: 1.2,
        },
        // 在境中:第二层、带着一份战利、已掷定本层敌人(预览与实战同源的那一份)
        secretRealm: {
          realmId: "sr_kurong",
          enteredAt: now - 600000,
          layer: 2,
          wins: 1,
          losses: 1,
          spoils: ["灵石少许", "枯荣草一株"],
          rules: ["治疗减半"],
          carriedHpPct: 0.7,
          finished: false,
          foe: {
            name: "残魂·堕落冰魄仙子",
            icon: "snowflake",
            isPlayer: false,
            attack: gn(2, 5),
            defense: gn(1, 4),
            maxHp: gn(3, 6),
            speed: 1.1,
            mods: {},
            skills: [],
          },
        },
      },
      resources: {
        spiritStone: gn(8, 7),
        qi: 5000,
        wudao: 200,
        herb: 100,
        ore: 100,
        page: 20,
        dust: 40,
      },
      inventory: {
        items: [
          {
            uid: "w1",
            templateId: "w_zidian",
            quality: "heaven",
            tier: 12,
            level: 2,
            affixes: [
              { id: "bs3", roll: 1 },
              { id: "low2", roll: 1 },
            ],
          },
        ],
        equipped: { weapon: "w1" },
        pills: {},
        artifacts: [],
        equippedArtifacts: [],
      },
      cultivation: {
        learned: { g_qingyun: 6 },
        mainGongfa: "g_qingyun",
        subGongfa: [],
        buffs: [],
        gongfaBranch: {},
      },
      lore: {
        materialLore: {},
        materialSeen: {},
        recipeLore: {},
        blueprintLore: {},
        skillExp: {},
        enemyLore: {},
        enemySeen: {},
        studyFrac: 0,
        seeded: true,
      },
      // 没有在途历练:这一屏要画的是择地界 + 秘境卡(在境中那一版),不是战斗面板
      adventure: {
        unlocked: ["qingyun", "luoxia", "heifeng", "leichi"],
        cleared: ["qingyun"],
        mortalCleared: [],
        session: null,
        pendingEventId: null,
        pendingEventSince: 0,
        seenOnceEvents: [],
        lastBattle: null,
        eventMemories: {},
      },
      settings: {
        privacyAccepted: true,
        sfxOn: false,
        musicOn: false,
        musicVol: 0,
        sfxVol: 0,
        reduceMotion: true,
        battleSpeed: 4,
        decomposeRanks: [],
        smartKeep: { enabled: true, minQuality: 3, keepCoreAffix: true, keepComboPiece: true },
        theme: "dark",
      },
    };
    await ctx.addInitScript(
      (data) => {
        for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
      },
      Object.fromEntries(Object.entries(slices).map(([k, v]) => [`${SAVE_PREFIX}${k}`, enc(v)])),
    );
    const page = await ctx.newPage();
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    await page.goto(INDEX + "#/adventure", { waitUntil: "load" });
    // 等秘境卡画出来(「再 入 一 层」是在境中那一版唯一的入口),而不是定时空读
    await page
      .waitForFunction(
        () =>
          [...document.querySelectorAll("button")].some((b) =>
            (b.textContent || "").replace(/\s+/g, "").includes("再入一层"),
          ),
        { timeout: 8000 },
      )
      .catch(() => undefined);
    const card = await page.evaluate(() => {
      const btn = [...document.querySelectorAll("button")].find((b) =>
        (b.textContent || "").replace(/\s+/g, "").includes("再入一层"),
      );
      const section = btn?.closest("section") ?? null;
      if (!section) return { found: false };
      const text = (section.textContent || "").replace(/\s+/g, " ").trim();
      // 层点:三枚 6px 的圆点,当前层是朱砂 —— 数字不删,点只是把层数变成可数的
      const dots = [...section.querySelectorAll("span")].filter((el) => {
        const r = el.getBoundingClientRect();
        return Math.round(r.width) === 6 && Math.round(r.height) === 6;
      }).length;
      return {
        found: true,
        text: text.slice(0, 80),
        dots,
        layerText: /第\s*2\s*\/\s*3\s*层/.test(text),
        overflow: section.scrollWidth - section.clientWidth,
      };
    });
    checked += 1;
    if (!card.found) {
      failures.push("[320-secret] 秘境卡在境中场景:卡片没渲染出来(夹具没被读出来?)");
    } else {
      if (!card.layerText)
        failures.push(`[320-secret] 秘境卡没画「第 2/3 层」:«${card.text}»(夹具或模板?)`);
      if (card.dots !== 3)
        failures.push(`[320-secret] 秘境卡的层点有 ${card.dots} 枚(应为 3):«${card.text}»`);
      if (card.overflow > 1)
        failures.push(`[320-secret] 秘境卡横向溢出 ${card.overflow}px:«${card.text}»`);
      const info = await measurePage(page);
      for (const p of problemsOf(info)) failures.push(`[320-secret] /adventure → ${p}`);
    }
    if (pageErrors.length)
      failures.push(
        `[320-secret] 秘境卡在境中场景页面异常:${[...new Set(pageErrors)].join(" | ")}`,
      );
    await ctx.close();
  }

  return { failures, checked, contrastFails, pixelContrastFails, zoomFails };
}

/** 历练首屏的主线优先:秘境支线默认收口,首个地界行动要在首屏里看得见 */
async function taskAdventureFold() {
  const failures = [];
  let checked = 0;
  const ctx = await auditContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  try {
    await seedSave(ctx, showcaseSlices("light"), "__adventureFold");
    const page = await ctx.newPage();
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    const rendered = await openRoute(page, "/adventure", 700);
    checked += 1;
    if (rendered === 0) {
      failures.push("[390-adventure] 历练页没渲染出来,首屏判据没量到东西");
    } else {
      const fold = await page.evaluate(() => {
        const nav = document.querySelector("[data-folio-dock]")?.getBoundingClientRect();
        const title = [...document.querySelectorAll("h1, h2")].find(
          (el) => (el.textContent || "").trim() === "历练",
        );
        const secret = document.querySelector("[data-secret-realm-card]");
        const toggle = secret?.querySelector("[data-secret-realm-card-toggle]");
        const action = [
          ...document.querySelectorAll("[data-adventure-regions] [data-region-action]"),
        ].find((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        });
        const titleRect = title?.getBoundingClientRect();
        const secretRect = secret?.getBoundingClientRect();
        const actionRect = action?.getBoundingClientRect();
        return {
          navTop: nav?.top ?? innerHeight,
          titleTop: titleRect?.top ?? null,
          actionTop: actionRect?.top ?? null,
          actionBottom: actionRect?.bottom ?? null,
          secretHeight: secretRect?.height ?? null,
          cardExpanded: toggle?.getAttribute("aria-expanded") ?? null,
          hasBody: Boolean(document.querySelector("#secret-realm-body")),
        };
      });
      checked += 1;
      if (fold.cardExpanded !== "false") {
        failures.push(
          `[390-adventure] 未入秘境时支线卡没有默认收口(aria-expanded=${fold.cardExpanded})`,
        );
      }
      if (fold.secretHeight === null || fold.secretHeight > 80) {
        failures.push(`[390-adventure] 秘境支线收口后仍占 ${fold.secretHeight ?? "?"}px,超过 80px`);
      }
      if (fold.actionTop === null || fold.actionBottom === null) {
        failures.push("[390-adventure] 首屏找不到任何地界行动入口");
      } else {
        if (fold.titleTop === null || fold.titleTop > fold.actionTop) {
          failures.push("[390-adventure] 「历练」标题没有排在地界行动之前");
        }
        if (fold.actionBottom > fold.navTop + 1) {
          failures.push(
            `[390-adventure] 首处地界的行动入口被推到折线以下(action bottom ${Math.round(fold.actionBottom)} / nav top ${Math.round(fold.navTop)})`,
          );
        }
      }
      const toggle = page.locator("[data-secret-realm-card-toggle]").first();
      if ((await toggle.count()) === 0) {
        failures.push("[390-adventure] 收口后的秘境卡没有展开入口");
      } else {
        await toggle.click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(120);
        checked += 1;
        const opened = await page.evaluate(() => ({
          expanded:
            document
              .querySelector("[data-secret-realm-card-toggle]")
              ?.getAttribute("aria-expanded") ?? null,
          hasBody: (() => {
            const body = document.querySelector("#secret-realm-body");
            if (!body) return false;
            return (
              getComputedStyle(body).display !== "none" && body.getBoundingClientRect().height > 0
            );
          })(),
        }));
        if (opened.expanded !== "true" || !opened.hasBody) {
          failures.push("[390-adventure] 秘境卡点「展开」后没有真正铺出名录");
        }
      }
    }
    if (pageErrors.length)
      failures.push(`[390-adventure] 历练首屏页面异常:${[...new Set(pageErrors)].join(" | ")}`);
  } finally {
    await ctx.close();
  }
  return {
    failures,
    checked,
    contrastFails: [],
    pixelContrastFails: [],
    zoomFails: [],
  };
}

/** 洞府首屏的营造优先:七作收成一条续账,主升级键要在底栏以上,完整账要点得开 */
async function taskDongfuFold() {
  const failures = [];
  let checked = 0;
  const ctx = await auditContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  try {
    await seedSave(ctx, showcaseSlices("light"), "__dongfuFold");
    const page = await ctx.newPage();
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    const rendered = await openRoute(page, "/dongfu", 700);
    checked += 1;
    if (rendered === 0) {
      failures.push("[390-dongfu] 洞府页没渲染出来,首屏判据没量到东西");
    } else {
      const fold = await page.evaluate(() => {
        const nav = document.querySelector("[data-folio-dock]")?.getBoundingClientRect();
        const ledgerRegister = document.querySelector("[data-dongfu-ledger-register]");
        const ledgerChapters = [
          ...(ledgerRegister?.querySelectorAll("[data-dongfu-ledger-chapter]") ?? []),
        ];
        const summaryChapter = ledgerRegister?.querySelector(
          '[data-dongfu-ledger-chapter="summary"]',
        );
        const registerChapter = ledgerRegister?.querySelector(
          '[data-dongfu-ledger-chapter="register"]',
        );
        const ledgerHeads = [
          ...(ledgerRegister?.querySelectorAll("[data-folio-chapter-head]") ?? []),
        ].map((head) => ({
          chapter: head
            .closest("[data-dongfu-ledger-chapter]")
            ?.getAttribute("data-dongfu-ledger-chapter"),
          index: (head.querySelector(".folio-chapter-head__index")?.textContent || "").trim(),
          title: (head.querySelector(".folio-chapter-head__title")?.textContent || "").trim(),
          fact: (head.querySelector(".folio-chapter-head__fact")?.textContent || "").trim(),
        }));
        const register = document.querySelector("[data-dongfu-register]");
        const registerChapters = register?.querySelectorAll("[data-dongfu-chapter]") ?? [];
        const buildingRows = register?.querySelectorAll("[data-dongfu-building-row]") ?? [];
        const offline = document.querySelector("[data-dongfu-offline]");
        const offlineLadder = offline?.querySelector(".dongfu-ledger__ladder");
        const offlineSteps = [...(offline?.querySelectorAll("[data-offline-tier-state]") ?? [])];
        const offlineCurrent = offlineSteps.find(
          (step) => step.getAttribute("data-offline-tier-state") === "current",
        );
        const offlineCurrentHours = offline?.querySelector("[data-dongfu-offline-current]");
        const action =
          document.querySelector("[data-dongfu-quick-build]:not([disabled])") ??
          [...document.querySelectorAll("[data-building-action]:not([disabled])")].find((el) => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0;
          });
        const toggle = document.querySelector("[data-building-detail-toggle]");
        const detailId = toggle?.getAttribute("aria-controls") || "";
        const detail = detailId ? document.getElementById(detailId) : null;
        const actionRect = action?.getBoundingClientRect();
        const actions = [...buildingRows].map((row) => {
          const button = row.querySelector("[data-building-action]");
          const rowRect = row.getBoundingClientRect();
          const buttonRect = button?.getBoundingClientRect();
          return {
            id: row.getAttribute("data-dongfu-building-row"),
            ratio: buttonRect && rowRect.width > 0 ? buttonRect.width / rowRect.width : 1,
            rowBackground: getComputedStyle(row).backgroundImage,
          };
        });
        const probe = document.createElement("span");
        probe.style.color = "rgb(var(--color-qing-rgb))";
        document.body.append(probe);
        const qing = getComputedStyle(probe).color;
        probe.remove();
        return {
          navTop: nav?.top ?? innerHeight,
          hasLedgerRegister: Boolean(ledgerRegister),
          ledgerChapters: ledgerChapters.map((chapter) => ({
            id: chapter.getAttribute("data-dongfu-ledger-chapter"),
            top: Math.round(chapter.getBoundingClientRect().top),
          })),
          ledgerHeads,
          pulseHasLedgerHead: Boolean(summaryChapter?.querySelector("[data-folio-ledger-head]")),
          legacyChapterHeads:
            ledgerRegister?.querySelectorAll(".section-title, [data-folio-section-mark]").length ??
            -1,
          buildTitleTop: summaryChapter?.getBoundingClientRect().top ?? null,
          registerTop: registerChapter?.getBoundingClientRect().top ?? null,
          registerChapters: registerChapters.length,
          buildingRows: buildingRows.length,
          rowWidths: [...buildingRows].map((el) => el.getBoundingClientRect().width),
          cardShells: register?.querySelectorAll(".card-ink").length ?? -1,
          actions,
          offlineTag: offlineLadder?.tagName ?? "",
          offlineSteps: offlineSteps.map((step) => {
            const style = getComputedStyle(step);
            return {
              state: step.getAttribute("data-offline-tier-state"),
              current: step.getAttribute("aria-current"),
              text: (step.querySelector(".dongfu-ledger__step-hours")?.textContent || "").trim(),
              backgroundColor: style.backgroundColor,
              backgroundImage: style.backgroundImage,
            };
          }),
          offlineCurrentColor: offlineCurrent
            ? getComputedStyle(offlineCurrent.querySelector(".dongfu-ledger__step-hours")).color
            : null,
          offlineCurrentHours: (offlineCurrentHours?.textContent || "").replace(/\s+/g, " ").trim(),
          offlineCurrentMarker: offlineCurrent
            ? getComputedStyle(offlineCurrent, "::after").backgroundColor
            : null,
          offlineButtons: offline?.querySelectorAll("button").length ?? -1,
          offlineOverflow: offline ? offline.scrollWidth - offline.clientWidth : null,
          levelColors: [...buildingRows].map((row) => {
            const level = row.querySelector(".dongfu-building__level");
            return level ? getComputedStyle(level).color : "missing";
          }),
          chapterCountColors: [...(register?.querySelectorAll("[data-dongfu-chapter]") ?? [])].map(
            (chapter) => {
              const count = chapter.querySelector(".dongfu-register__chapter-count");
              return count ? getComputedStyle(count).color : "missing";
            },
          ),
          qing,
          actionTop: actionRect?.top ?? null,
          actionBottom: actionRect?.bottom ?? null,
          toggleExpanded: toggle?.getAttribute("aria-expanded") ?? null,
          detailVisible: Boolean(
            detail &&
            getComputedStyle(detail).display !== "none" &&
            detail.getBoundingClientRect().height > 0,
          ),
        };
      });
      checked += 1;
      if (!fold.hasLedgerRegister || fold.buildTitleTop === null || fold.registerTop === null) {
        failures.push("[390-dongfu] 首屏找不到洞府一册两章");
      } else if (fold.buildTitleTop >= fold.registerTop) {
        failures.push("[390-dongfu] 营造总账没有排在山门续账之前");
      }
      checked += 1;
      if (
        fold.ledgerChapters.length !== 2 ||
        fold.ledgerChapters.map((chapter) => chapter.id).join(",") !== "summary,register" ||
        fold.ledgerChapters[1].top <= fold.ledgerChapters[0].top
      ) {
        failures.push(
          `[390-dongfu] 洞府没有沿总账、续账两章续排:${JSON.stringify(fold.ledgerChapters)}`,
        );
      }
      checked += 1;
      if (
        fold.ledgerHeads.length !== 2 ||
        fold.ledgerHeads.map((head) => head.chapter).join(",") !== "summary,register" ||
        fold.ledgerHeads.map((head) => head.index).join(",") !== "壹,贰" ||
        fold.ledgerHeads.map((head) => head.title).join(",") !== "七作营造,山门续账" ||
        !/^已营 \d+\/7$/.test(fold.ledgerHeads[0]?.fact || "") ||
        !/^\d+\/7 已营 · \d+ 时离线$/.test(fold.ledgerHeads[1]?.fact || "") ||
        fold.pulseHasLedgerHead ||
        fold.legacyChapterHeads !== 0
      ) {
        failures.push(`[390-dongfu] 洞府两章没有共用专用章首:${JSON.stringify(fold.ledgerHeads)}`);
      }
      if (fold.registerChapters < 5) {
        failures.push(
          `[390-dongfu] 山门续账章节不足(读到 ${fold.registerChapters} 章;七作四章 + 家业至少五章)`,
        );
      }
      if (fold.buildingRows !== 7) {
        failures.push(`[390-dongfu] 七作账行应为 7 条,实读 ${fold.buildingRows} 条`);
      }
      if (fold.rowWidths.some((width) => !(width > 0))) {
        failures.push(`[390-dongfu] 七作有账行没铺开:${fold.rowWidths.join(" / ")}`);
      }
      if (fold.cardShells !== 0) {
        failures.push(`[390-dongfu] 山门续账里仍套着 ${fold.cardShells} 张 card-ink`);
      }
      checked += 1;
      const currentOffline = fold.offlineSteps.filter((step) => step.state === "current");
      if (
        fold.offlineTag !== "OL" ||
        fold.offlineSteps.length !== 5 ||
        currentOffline.length !== 1 ||
        currentOffline[0]?.current !== "step" ||
        fold.offlineButtons !== 0
      ) {
        failures.push(
          `[390-dongfu] 离线档位没有收成唯一现档的连续刻度:${JSON.stringify(fold.offlineSteps)}`,
        );
      }
      if (
        fold.offlineCurrentColor !== fold.qing ||
        fold.offlineCurrentMarker !== fold.qing ||
        !/^现档 · \d+ 时$/.test(fold.offlineCurrentHours || "")
      ) {
        failures.push(
          `[390-dongfu] 离线现档没有归石青信息层:${fold.offlineCurrentHours} / ${fold.offlineCurrentColor} / ${fold.offlineCurrentMarker}`,
        );
      }
      const filledOfflineSteps = fold.offlineSteps.filter(
        (step) => step.backgroundColor !== "rgba(0, 0, 0, 0)" || step.backgroundImage !== "none",
      );
      if (filledOfflineSteps.length) {
        failures.push(
          `[390-dongfu] 离线刻度仍被铺成实心档块:${filledOfflineSteps
            .map((step) => step.text)
            .join(" / ")}`,
        );
      }
      if (fold.offlineOverflow === null || fold.offlineOverflow > 1) {
        failures.push(`[390-dongfu] 离线刻度横向溢出:${fold.offlineOverflow ?? "missing"}px`);
      }
      const wideActions = fold.actions.filter((entry) => entry.ratio > 0.72);
      if (wideActions.length) {
        failures.push(
          `[390-dongfu] 主升级键又铺回整行账带:${wideActions
            .map((entry) => `${entry.id} ${Math.round(entry.ratio * 100)}%`)
            .join(" / ")}`,
        );
      }
      const tintedRows = fold.actions.filter((entry) => entry.rowBackground !== "none");
      if (tintedRows.length) {
        failures.push(
          `[390-dongfu] 可升建筑行仍在整行铺底:${tintedRows.map((entry) => entry.id).join(" / ")}`,
        );
      }
      if (fold.levelColors.some((color) => color !== fold.qing)) {
        failures.push(`[390-dongfu] 建筑等级没有回到石青:${fold.levelColors.join(" / ")}`);
      }
      if (fold.chapterCountColors.some((color) => color !== fold.qing)) {
        failures.push(
          `[390-dongfu] 章内已营进度没有回到石青:${fold.chapterCountColors.join(" / ")}`,
        );
      }
      if (fold.actionTop === null || fold.actionBottom === null) {
        failures.push("[390-dongfu] 首屏找不到任何可用的建筑升级/建造键");
      } else if (fold.actionBottom > fold.navTop + 1) {
        failures.push(
          `[390-dongfu] 首枚可用营造键被推到折线以下(action bottom ${Math.round(fold.actionBottom)} / nav top ${Math.round(fold.navTop)})`,
        );
      }
      if (fold.toggleExpanded !== "false" || fold.detailVisible) {
        failures.push(
          `[390-dongfu] 建筑卡详情没有默认收口(aria-expanded=${fold.toggleExpanded}, visible=${fold.detailVisible})`,
        );
      }
      if (SHOTS) {
        await page.setViewportSize({ width: 390, height: 1600 });
        await page.waitForTimeout(120);
        await page
          .locator("[data-dongfu-ledger-register]")
          .screenshot({ path: join(SHOTS_DIR, "390-dongfu-register.png") });
      }

      const toggle = page.locator("[data-building-detail-toggle]").first();
      if ((await toggle.count()) === 0) {
        failures.push("[390-dongfu] 建筑卡没有详情开关");
      } else {
        await toggle.click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(120);
        checked += 1;
        const opened = await page.evaluate(() => {
          const toggle = document.querySelector("[data-building-detail-toggle]");
          const detailId = toggle?.getAttribute("aria-controls") || "";
          const detail = detailId ? document.getElementById(detailId) : null;
          return {
            expanded: toggle?.getAttribute("aria-expanded") ?? null,
            visible: Boolean(
              detail &&
              getComputedStyle(detail).display !== "none" &&
              detail.getBoundingClientRect().height > 0,
            ),
            text: (detail?.textContent || "").replace(/\s+/g, " ").trim(),
          };
        });
        if (opened.expanded !== "true" || !opened.visible || !/当前效果/.test(opened.text)) {
          failures.push("[390-dongfu] 建筑卡点开详情后没有铺出完整效果");
        }
      }

      await page.setViewportSize({ width: 195, height: 844 });
      await page.waitForTimeout(120);
      checked += 1;
      const compactOffline = await page.evaluate(() => {
        const offline = document.querySelector("[data-dongfu-offline]");
        const steps = [...(offline?.querySelectorAll("[data-offline-tier-state]") ?? [])];
        const second = steps[1];
        const offlineBox = offline?.getBoundingClientRect();
        return {
          overflow: offline ? offline.scrollWidth - offline.clientWidth : null,
          display: second ? getComputedStyle(second).display : "",
          railWidth: second ? getComputedStyle(second, "::before").width : "",
          railHeight: second ? getComputedStyle(second, "::before").height : "",
          currentCount: steps.filter(
            (step) => step.getAttribute("data-offline-tier-state") === "current",
          ).length,
          outside: steps.filter((step) => {
            const box = step.getBoundingClientRect();
            return (
              !offlineBox || box.left < offlineBox.left - 1 || box.right > offlineBox.right + 1
            );
          }).length,
        };
      });
      if (
        compactOffline.overflow === null ||
        compactOffline.overflow > 1 ||
        compactOffline.display !== "flex" ||
        compactOffline.currentCount !== 1 ||
        compactOffline.outside !== 0 ||
        parseFloat(compactOffline.railWidth) > 1.5 ||
        parseFloat(compactOffline.railHeight) < 8
      ) {
        failures.push(`[195-dongfu] 离线刻度没有退成单列纵轨:${JSON.stringify(compactOffline)}`);
      }
    }
    if (pageErrors.length)
      failures.push(`[390-dongfu] 洞府首屏页面异常:${[...new Set(pageErrors)].join(" | ")}`);
  } finally {
    await ctx.close();
  }
  return {
    failures,
    checked,
    contrastFails: [],
    pixelContrastFails: [],
    zoomFails: [],
  };
}

/** 修行续卷的四章与行动层:零卡壳、信息归石青、行动归朱砂短笔 */
async function taskCultivationFold() {
  const failures = [];
  let checked = 0;
  const ctx = await auditContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  try {
    await seedSave(ctx, showcaseSlices("light"), "__cultivationFold");
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      Math.random = () => 1;
    });
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    const rendered = await openRoute(page, "/cultivation", 700);
    checked += 1;
    if (rendered === 0) {
      failures.push("[390-cultivation] 修行页没渲染出来,续卷判据没量到东西");
    } else {
      const fold = await page.evaluate(() => {
        const register = document.querySelector("[data-cultivation-register]");
        const chapters = [...(register?.querySelectorAll("[data-cultivation-chapter]") ?? [])];
        const heads = [...(register?.querySelectorAll(".folio-chapter-head") ?? [])];
        const chapterTitles = heads.map((head) =>
          (head.querySelector(".folio-chapter-head__title")?.textContent || "").trim(),
        );
        const chapterFactColors = heads.map((head) => {
          const fact = head.querySelector(".folio-chapter-head__fact");
          return fact ? getComputedStyle(fact).color : "missing";
        });
        const actionRows = [...(register?.querySelectorAll("[data-cultivation-action]") ?? [])];
        const actionIds = actionRows.map((row) => row.getAttribute("data-cultivation-action"));
        const primaryActions = [
          ...(register?.querySelectorAll("[data-cultivation-primary-action]") ?? []),
        ];
        const actionMetrics = primaryActions.map((button) => {
          const actionRect = button.getBoundingClientRect();
          const rowRect = button.closest("[data-cultivation-action]")?.getBoundingClientRect();
          const active = !button.hasAttribute("disabled");
          return {
            id: button.getAttribute("data-cultivation-primary-action"),
            ratio: rowRect?.width ? actionRect.width / rowRect.width : 1,
            color: getComputedStyle(button).color,
            active,
          };
        });
        const rowBackgrounds = actionRows.map((row) => getComputedStyle(row).backgroundImage);
        const progress = register?.querySelector("[data-cultivation-primary] .bar-fill");
        const probe = document.createElement("span");
        probe.style.color = "rgb(var(--color-qing-rgb))";
        document.body.append(probe);
        const qing = getComputedStyle(probe).color;
        probe.style.color = "rgb(var(--color-cinnabar-rgb))";
        const cinnabar = getComputedStyle(probe).color;
        probe.remove();
        return {
          chapters: chapters.length,
          chapterKeys: chapters.map((chapter) => chapter.getAttribute("data-cultivation-chapter")),
          heads: heads.length,
          chapterTitles,
          chapterFactColors,
          cardShells: register?.querySelectorAll(".card-ink").length ?? -1,
          actionIds,
          actionRows: actionRows.length,
          actionMetrics,
          rowBackgrounds,
          progressColor: progress ? getComputedStyle(progress).backgroundColor : "missing",
          qing,
          cinnabar,
        };
      });

      checked += 1;
      if (fold.chapters !== 4 || fold.heads !== 4) {
        failures.push(
          `[390-cultivation] 行功续卷应恰有四章四个章首,实见 ${fold.chapters} / ${fold.heads}`,
        );
      }
      if (
        fold.chapterKeys.join("|") !== "practice|next|support|gongfa" ||
        fold.chapterTitles.join("|") !== "修 行|下一步|随身|功法"
      ) {
        failures.push(
          `[390-cultivation] 四章顺序或章名漂了:${fold.chapterKeys.join(" / ")} · ` +
            fold.chapterTitles.join(" / "),
        );
      }
      if (fold.cardShells !== 0) {
        failures.push(`[390-cultivation] 行功续卷里仍套着 ${fold.cardShells} 张 card-ink`);
      }
      if (fold.actionRows !== 2 || fold.actionIds.join("|") !== "breakthrough|retreat") {
        failures.push(
          `[390-cultivation] 破境与闭关没有收成两条行动账:${fold.actionIds.join(" / ")}`,
        );
      }
      const wideActions = fold.actionMetrics.filter((entry) => entry.ratio > 0.72);
      if (wideActions.length) {
        failures.push(
          `[390-cultivation] 主行动又铺回整行账带:${wideActions
            .map((entry) => `${entry.id} ${Math.round(entry.ratio * 100)}%`)
            .join(" / ")}`,
        );
      }
      const tintedRows = fold.rowBackgrounds.filter((background) => background !== "none");
      if (tintedRows.length) {
        failures.push("[390-cultivation] 修行行动仍在整行铺底");
      }
      if (fold.chapterFactColors.some((color) => color !== fold.qing)) {
        failures.push(
          `[390-cultivation] 章内读数没有回到石青:${fold.chapterFactColors.join(" / ")}`,
        );
      }
      if (fold.progressColor !== fold.qing) {
        failures.push(`[390-cultivation] 修为进度没有归石青:${fold.progressColor}`);
      }
      const enabled = fold.actionMetrics.filter((entry) => entry.active);
      if (!enabled.length || enabled.some((entry) => entry.color !== fold.cinnabar)) {
        failures.push(
          `[390-cultivation] 可点行动没有统一落朱砂:${enabled
            .map((entry) => `${entry.id} ${entry.color}`)
            .join(" / ")}`,
        );
      }

      if (SHOTS) {
        await page.setViewportSize({ width: 390, height: 2200 });
        await settleVisuals(page);
        await page
          .locator("[data-cultivation-register]")
          .screenshot({ path: join(SHOTS_DIR, "390-cultivation-register.png") });
      }
    }
    if (pageErrors.length)
      failures.push(`[390-cultivation] 修行续卷页面异常:${[...new Set(pageErrors)].join(" | ")}`);
  } finally {
    await ctx.close();
  }
  return {
    failures,
    checked,
    contrastFails: [],
    pixelContrastFails: [],
    zoomFails: [],
  };
}

/**
 * 晨昏纸面 —— 洞府卷首、当前道途与修行内观台必须跟主题一起换纸。
 *
 * 这条门只看真渲染后的计算色:三个舞台都先对主题 token,再要求日间是亮纸、
 * 夜间是暗纸,正文在两边都保持 AA。单看源码里的变量名拦不住「窗口里又写回
 * 固定书口色」或某层继承覆盖,故在同一份存档上原地切 `data-theme` 量。
 */
async function taskThemeStageSurfaces() {
  const failures = [];
  let checked = 0;
  const ctx = await auditContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  try {
    await seedSave(ctx, showcaseSlices("light"), "__themeStageSurfaces");
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      Math.random = () => 1;
    });
    const pageErrors = [];
    watchPageErrors(page, pageErrors);

    const readThemes = async (selector) => {
      await freezeTransitions(page);
      const themes = {};
      for (const theme of ["light", "dark"]) {
        await page.evaluate((value) => {
          document.documentElement.dataset.theme = value;
        }, theme);
        await settleVisuals(page);
        themes[theme] = await page.evaluate((targetSelector) => {
          const el = document.querySelector(targetSelector);
          if (!el) return null;
          const style = getComputedStyle(el);
          const rootStyle = getComputedStyle(document.documentElement);
          const channels = (value) => {
            const match = /rgba?\(([^)]+)\)/.exec(value);
            if (!match) return null;
            const parts = match[1]
              .split(/[,\s/]+/)
              .filter(Boolean)
              .map(Number);
            return parts.length >= 3 ? parts.slice(0, 3) : null;
          };
          const token = (name) => {
            const parts = rootStyle
              .getPropertyValue(name)
              .trim()
              .split(/\s+/)
              .filter(Boolean)
              .map(Number);
            return parts.length === 3 && parts.every(Number.isFinite) ? parts : null;
          };
          const luminance = (rgb) => {
            if (!rgb) return null;
            const [r, g, b] = rgb.map((value) => {
              const channel = value / 255;
              return channel <= 0.03928
                ? channel / 12.92
                : Math.pow((channel + 0.055) / 1.055, 2.4);
            });
            return 0.2126 * r + 0.7152 * g + 0.0722 * b;
          };
          const same = (left, right) =>
            Boolean(left && right && left.every((value, index) => value === right[index]));
          const background = channels(style.backgroundColor);
          const foreground = channels(style.color);
          const paper = token(
            targetSelector === "[data-home-goal]" ? "--color-paper-rgb" : "--color-paper-deep-rgb",
          );
          const ink = token("--color-ink-rgb");
          const backgroundLum = luminance(background);
          const foregroundLum = luminance(foreground);
          const contrast =
            backgroundLum === null || foregroundLum === null
              ? null
              : (Math.max(backgroundLum, foregroundLum) + 0.05) /
                (Math.min(backgroundLum, foregroundLum) + 0.05);
          return {
            theme: document.documentElement.dataset.theme,
            background: style.backgroundColor,
            backgroundImage: style.backgroundImage,
            color: style.color,
            backgroundLum,
            foregroundLum,
            contrast,
            usesThemePaper: same(background, paper),
            usesThemeInk: same(foreground, ink),
          };
        }, selector);
      }
      await page.evaluate(() => {
        document.documentElement.dataset.theme = "light";
      });
      await unfreezeTransitions(page);
      return themes;
    };

    const verify = (label, themes) => {
      checked += 1;
      const { light, dark } = themes;
      if (!light || !dark) {
        failures.push(`[390-theme] ${label}没量到,晨昏纸面判据空转`);
        return;
      }
      if (
        light.theme !== "light" ||
        dark.theme !== "dark" ||
        !light.usesThemePaper ||
        !dark.usesThemePaper
      ) {
        failures.push(
          `[390-theme] ${label}没有读主题纸色:${JSON.stringify({
            light: [light.theme, light.background, light.usesThemePaper],
            dark: [dark.theme, dark.background, dark.usesThemePaper],
          })}`,
        );
      }
      checked += 1;
      if (
        light.backgroundLum === null ||
        dark.backgroundLum === null ||
        light.backgroundLum < 0.55 ||
        dark.backgroundLum > 0.18 ||
        light.backgroundLum - dark.backgroundLum < 0.45
      ) {
        failures.push(
          `[390-theme] ${label}没有随晨昏翻转:${JSON.stringify({
            light: light.backgroundLum,
            dark: dark.backgroundLum,
            colors: [light.background, dark.background],
          })}`,
        );
      }
      checked += 1;
      if (
        !light.usesThemeInk ||
        !dark.usesThemeInk ||
        light.contrast === null ||
        dark.contrast === null ||
        light.contrast < 4.5 ||
        dark.contrast < 4.5
      ) {
        failures.push(
          `[390-theme] ${label}正文没有随纸面保持 AA:${JSON.stringify({
            light: [light.color, light.contrast, light.usesThemeInk],
            dark: [dark.color, dark.contrast, dark.usesThemeInk],
          })}`,
        );
      }
    };

    const homeRendered = await openRoute(page, "/", 700);
    checked += 1;
    if (homeRendered === 0) {
      failures.push("[390-theme] 洞府页没渲染出来,晨昏纸面判据没量到东西");
    } else {
      await clearOverlays(page);
      const hero = await readThemes("[data-home-hero]");
      const goal = await readThemes("[data-home-goal]");
      verify("洞府卷首", hero);
      verify("当前道途", goal);

      const goalLink = await page.locator("[data-home-goal]").evaluate((el) => ({
        tag: el.tagName,
        href: el.getAttribute("href") ?? "",
        text: (el.textContent ?? "").replace(/\s+/g, " ").trim(),
      }));
      checked += 1;
      if (
        goalLink.tag !== "A" ||
        !goalLink.href ||
        !/去(?:修炼|构筑|历练|行囊)/.test(goalLink.text)
      ) {
        failures.push(`[390-theme] 当前道途没有可抵达的目的册:${JSON.stringify(goalLink)}`);
      }
    }

    const cultivationRendered = await openRoute(page, "/cultivation", 700);
    checked += 1;
    if (cultivationRendered === 0) {
      failures.push("[390-theme] 修行页没渲染出来,内观台纸面判据没量到东西");
    } else {
      await clearOverlays(page);
      const stage = await readThemes("[data-cultivation-stage]");
      verify("修行内观台", stage);
    }

    if (pageErrors.length) {
      failures.push(`[390-theme] 晨昏纸面页面异常:${[...new Set(pageErrors)].join(" | ")}`);
    }
  } finally {
    await ctx.close();
  }
  return {
    failures,
    checked,
    contrastFails: [],
    pixelContrastFails: [],
    zoomFails: [],
  };
}

/** 道躯三章:总案、四类行藏与卷末云笈同住一册,来源拆卷可开可合 */
async function taskCharacterFold() {
  const failures = [];
  let checked = 0;
  /** 窄屏下的拆卷浮层:不许横向撑破、关闭键必须够得着 */
  const failedIfNarrow = (n) => {
    checked += 1;
    if (n.overflowX > 0) {
      failures.push(`[窄档-character] 拆卷内容窗横向撑破 ${n.overflowX}px(视口 ${n.viewportW})`);
    }
    if (n.panelBeyond > 0) {
      failures.push(
        `[窄档-character] 拆卷面板右缘越出浮层 ${n.panelBeyond}px(视口 ${n.viewportW})`,
      );
    }
    if (!n.closeInView) {
      failures.push(`[窄档-character] 拆卷关闭键不在视口里(视口 ${n.viewportW})`);
    }
    if (n.sources === 0) {
      failures.push(`[窄档-character] 拆卷在窄屏里一条来源都没渲染(视口 ${n.viewportW})`);
    }
    if (n.modalLeft !== null && n.modalLeft < 0 && n.viewportW > 200) {
      failures.push(`[窄档-character] 拆卷浮层左缘越界 ${n.modalLeft}(视口 ${n.viewportW})`);
    }
  };
  const ctx = await auditContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  try {
    await seedSave(ctx, showcaseSlices("light"), "__characterFold");
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      Math.random = () => 1;
    });
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    const rendered = await openRoute(page, "/character", 700);
    checked += 1;
    if (rendered === 0) {
      failures.push("[390-character] 道躯页没渲染出来,三章判据没量到东西");
    } else {
      const fold = await page.evaluate(() => {
        const register = document.querySelector("[data-character-register]");
        const chapters = [...(register?.querySelectorAll("[data-character-chapter]") ?? [])];
        const heads = [...(register?.querySelectorAll(".folio-chapter-head") ?? [])];
        const groups = [...(register?.querySelectorAll("[data-character-modifier-group]") ?? [])];
        const rows = [...(register?.querySelectorAll("[data-character-modifier]") ?? [])];
        const detail = register?.querySelector("[data-character-modifier-detail]");
        return {
          chapters: chapters.length,
          chapterKeys: chapters.map((chapter) => chapter.getAttribute("data-character-chapter")),
          heads: heads.length,
          chapterTitles: heads.map((head) =>
            (head.querySelector(".folio-chapter-head__title")?.textContent || "").trim(),
          ),
          cardShells: register?.querySelectorAll(".card-ink").length ?? -1,
          groups: groups.length,
          groupKeys: groups.map((group) => group.getAttribute("data-character-modifier-group")),
          rows: rows.length,
          detailBefore: Boolean(detail),
          groupTops: groups.map((group) => Math.round(group.getBoundingClientRect().top)),
        };
      });

      checked += 1;
      if (fold.chapters !== 3 || fold.heads !== 3) {
        failures.push(
          `[390-character] 道躯续卷应恰有三章三个章首,实见 ${fold.chapters} / ${fold.heads}`,
        );
      }
      if (
        fold.chapterKeys.join("|") !== "foundation|modifiers|catalog" ||
        fold.chapterTitles.join("|") !== "道躯总案|行藏周天|卷末云笈"
      ) {
        failures.push(
          `[390-character] 三章顺序或章名漂了:${fold.chapterKeys.join(" / ")} · ` +
            fold.chapterTitles.join(" / "),
        );
      }
      if (fold.cardShells !== 0) {
        failures.push(`[390-character] 道躯续卷里仍套着 ${fold.cardShells} 张 card-ink`);
      }
      if (fold.groups !== 4 || fold.groupKeys.join("|") !== "practice|journey|combat|craft") {
        failures.push(
          `[390-character] 行藏没有分成修行、历练、斗法、百艺四组:${fold.groupKeys.join(" / ")}`,
        );
      }
      if (fold.rows < 8) {
        failures.push(`[390-character] 行藏账只铺出 ${fold.rows} 项,来源拆解失去入口`);
      }
      if (fold.detailBefore) {
        failures.push("[390-character] 未点行时就摊开了来源拆卷");
      }
      if (fold.groupTops.some((top, index) => index > 0 && top <= fold.groupTops[index - 1])) {
        failures.push(`[390-character] 手机四组行藏没有按序单列:${fold.groupTops.join(" / ")}`);
      }

      const probe = page.locator('[data-character-modifier="cultivationSpeed"]').first();
      checked += 1;
      if ((await probe.count()) === 0) {
        failures.push("[390-character] 修炼速度行没找到,来源拆卷判据空转");
      } else {
        await probe.click();
        const opened = await page
          .waitForSelector("[data-character-modifier-detail]", { timeout: 2000 })
          .then(() => true)
          .catch(() => false);
        const detail = await page.evaluate(() => {
          const row = document.querySelector('[data-character-modifier="cultivationSpeed"]');
          const panel = document.querySelector("[data-character-modifier-detail]");
          const rect = panel?.getBoundingClientRect();
          return {
            expanded: row?.getAttribute("aria-expanded"),
            active: row?.classList.contains("is-active"),
            key: panel?.getAttribute("data-character-modifier-detail-key"),
            sources: panel?.querySelectorAll("[data-character-modifier-source]").length ?? 0,
            text: (panel?.textContent || "").replace(/\s+/g, " ").trim(),
            /*
             * 看得见才算打开。此前它是铺在四组行藏之后的内联面板:
             * 滚动之后点第一组的行,面板落在 top=1158(视口 844),
             * 所有「开没开」的判据全绿,而玩家什么都没看到。
             */
            inViewport: rect
              ? rect.top < window.innerHeight && rect.bottom > 0 && rect.width > 0
              : false,
            top: rect ? Math.round(rect.top) : null,
            viewportH: window.innerHeight,
          };
        });
        if (
          !opened ||
          detail.expanded !== "true" ||
          !detail.active ||
          detail.key !== "cultivationSpeed" ||
          detail.sources < 2 ||
          !/来源明细/.test(detail.text)
        ) {
          failures.push(`[390-character] 修炼速度来源没有完整摊开:${JSON.stringify(detail)}`);
        }
        if (!detail.inViewport) {
          failures.push(
            `[390-character] 来源拆卷开了却不在视口里(top=${detail.top} / 视口 ${detail.viewportH})—— 点了等于没点`,
          );
        }

        await page.locator("[data-character-modifier-close]").click();
        const closed = await page
          .waitForFunction(
            () =>
              !document.querySelector("[data-character-modifier-detail]") &&
              document
                .querySelector('[data-character-modifier="cultivationSpeed"]')
                ?.getAttribute("aria-expanded") === "false",
            { timeout: 2000 },
          )
          .then(() => true)
          .catch(() => false);
        if (!closed) failures.push("[390-character] 来源拆卷合上后没有收回原行");

        /*
         * 极窄档再验一次:拆卷现在是浮层,320 下若标题/来源行把面板撑破,
         * 玩家看到的是被裁掉的明细。「能开」不等于「在窄屏里也装得下」。
         */
        for (const width of [320, 195]) {
          await page.setViewportSize({ width, height: 844 });
          await probe.click();
          await page.waitForTimeout(300);
          const narrow = await page.evaluate(() => {
            const modal = document.querySelector("[data-folio-modal]");
            const panel = document.querySelector("[data-character-modifier-detail]");
            const close = document.querySelector("[data-character-modifier-close]");
            const mr = modal?.getBoundingClientRect();
            const pr = panel?.getBoundingClientRect();
            const cr = close?.getBoundingClientRect();
            const pane = modal?.querySelector(".scroll-pane");
            return {
              /*
               * 溢出要看**内容窗**(.scroll-pane)与面板自身的右缘:
               * modal 自己写着 overflow-hidden,它的 scrollWidth 永远是 clientWidth ——
               * 拿它量溢出等于常返回 0,注入一个 min-width:600px 的破版都抓不到。
               */
              overflowX: pane ? Math.max(0, pane.scrollWidth - pane.clientWidth) : 0,
              panelBeyond: pr && mr ? Math.max(0, Math.round(pr.right - mr.right)) : 0,
              closeInView: cr ? cr.top >= 0 && cr.bottom <= window.innerHeight : false,
              sources: panel?.querySelectorAll("[data-character-modifier-source]").length ?? 0,
              modalLeft: mr ? Math.round(mr.left) : null,
              modalRight: mr ? Math.round(mr.right) : null,
              viewportW: window.innerWidth,
            };
          });
          failedIfNarrow(narrow);
          await page.locator("[data-character-modifier-close]").click();
          await page.waitForTimeout(200);
        }
      }

      await page.setViewportSize({ width: 1280, height: 800 });
      await settleVisuals(page);
      const desktopGroups = await page.evaluate(() => {
        const groups = [...document.querySelectorAll("[data-character-modifier-group]")].slice(
          0,
          2,
        );
        return groups.map((group) => {
          const rect = group.getBoundingClientRect();
          return {
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            top: Math.round(rect.top),
          };
        });
      });
      checked += 1;
      if (
        desktopGroups.length !== 2 ||
        Math.abs(desktopGroups[0].top - desktopGroups[1].top) > 2 ||
        desktopGroups[0].right > desktopGroups[1].left
      ) {
        failures.push(`[1280-character] 行藏四组没有铺成双栏:${JSON.stringify(desktopGroups)}`);
      }

      if (SHOTS) {
        await page.setViewportSize({ width: 390, height: 3000 });
        await settleVisuals(page);
        await page
          .locator("[data-character-register]")
          .screenshot({ path: join(SHOTS_DIR, "390-character-register.png") });
      }
    }
    if (pageErrors.length)
      failures.push(`[390-character] 道躯续卷页面异常:${[...new Set(pageErrors)].join(" | ")}`);
  } finally {
    await ctx.close();
  }
  return {
    failures,
    checked,
    contrastFails: [],
    pixelContrastFails: [],
    zoomFails: [],
  };
}

/**
 * 修行画像:称谓、根因、机缘、灵兽与行迹三数收成一册两章。
 *
 * 真浏览器必须同时证明两件事:内容真的从 core 归纳结果现读;弹窗在 390 与
 * 200% 缩放档都不靠内层纸卡或横向滚动撑开。fixture 特意放进多种机缘与一灵兽,
 * 否则「机缘只读事件表」「灵兽不再只写随行」两条会空转。
 */
async function taskIdentityFolio() {
  const failures = [];
  let checked = 0;
  const ctx = await auditContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  try {
    const slices = showcaseSlices("light");
    slices.player.mentor = "swordsman";
    slices.player.fortuneChoices = {
      ft_sword_remnant: "take",
      ft_beast_pledge: "take",
      ft_meteor_iron: "take",
    };
    slices.player.petId = "pet_qingyu";
    slices.quests.counters = { kills: 214, explores: 38, breakthroughs: 9 };
    await seedSave(ctx, slices, "__identityFolio");

    const page = await ctx.newPage();
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    const rendered = await openRoute(page, "/character", 700);
    checked += 1;
    if (rendered === 0) failures.push("[390-identity] 道躯页没有渲染出来,画像判据没量到东西");
    await clearOverlays(page);

    const entry = page.locator("main button", { hasText: /修行画像/ }).first();
    const opened = await entry
      .click({ timeout: 3000 })
      .then(() =>
        page.locator("[data-identity-folio]").waitFor({ state: "visible", timeout: 4000 }),
      )
      .then(() => true)
      .catch(() => false);
    if (opened) await settleVisuals(page);

    checked += 1;
    if (!opened) {
      failures.push("[390-identity] 点「修行画像」后没有打开画像册");
    } else {
      const readIdentity = () =>
        page.evaluate(() => {
          const root = document.querySelector("[data-identity-folio]");
          const panel = root?.closest(".modal-panel");
          const scroll = panel?.querySelector("[data-folio-modal-scroll]");
          const chapters = [...(root?.querySelectorAll("[data-identity-chapter]") ?? [])];
          const heads = [...(root?.querySelectorAll(".folio-chapter-head") ?? [])];
          const textOf = (el) => (el?.textContent || "").replace(/\s+/g, " ").trim();
          const rowsOf = (selector) => [...(root?.querySelectorAll(selector) ?? [])];
          const styleOf = (el) => (el ? getComputedStyle(el) : null);
          const columns = (el) => {
            const style = styleOf(el);
            return style ? style.gridTemplateColumns.trim().split(/\s+/).filter(Boolean).length : 0;
          };
          return {
            text: textOf(root),
            chapterKeys: chapters.map((chapter) => chapter.getAttribute("data-identity-chapter")),
            chapterTitles: heads.map((head) =>
              textOf(head.querySelector(".folio-chapter-head__title")),
            ),
            chapterCount: chapters.length,
            headCount: heads.length,
            chapterChrome: chapters.map((chapter) => {
              const style = styleOf(chapter);
              return {
                borders: style
                  ? [
                      style.borderTopWidth,
                      style.borderRightWidth,
                      style.borderBottomWidth,
                      style.borderLeftWidth,
                    ]
                  : [],
                radius: style ? Number.parseFloat(style.borderRadius) : null,
                shadow: style?.boxShadow ?? "",
                background: style?.backgroundColor ?? "",
              };
            }),
            roots: rowsOf("[data-identity-root]").map((row) => ({
              key: row.getAttribute("data-identity-root"),
              label: textOf(row.querySelector(".identity-root__label")),
              value: textOf(row.querySelector(".identity-root__value")),
            })),
            fortunes: rowsOf("[data-identity-fortune]").map((row) => ({
              title: textOf(row.querySelector(".identity-fortune__title")),
              line: textOf(row.querySelector(".identity-fortune__line")),
            })),
            pet: {
              name: textOf(root?.querySelector(".identity-pet__name")),
              nature: textOf(root?.querySelector(".identity-pet__nature")),
              brief: textOf(root?.querySelector(".identity-pet__brief")),
              line: textOf(root?.querySelector(".identity-pet__line")),
            },
            traits: rowsOf("[data-identity-trait]").map((row) => ({
              key: row.getAttribute("data-identity-trait"),
              value: textOf(row.querySelector(".identity-trait__value")),
            })),
            risk: textOf(root?.querySelector("[data-identity-risk]")),
            cardShells: root?.querySelectorAll(".card-ink").length ?? -1,
            eventCardShells:
              root?.querySelectorAll(
                ".identity-chapter.card-ink, .identity-chapter + .identity-chapter.card-ink",
              ).length ?? -1,
            panelWidth: panel?.clientWidth ?? 0,
            panelScrollWidth: panel?.scrollWidth ?? 0,
            scrollOverflow: scroll?.scrollWidth > scroll?.clientWidth + 1,
            traitColumns: columns(root?.querySelector(".identity-traits")),
            rootColumns: columns(root?.querySelector(".identity-roots")),
            petHeadColumns: columns(root?.querySelector(".identity-pet__head")),
          };
        });

      const mobile = await readIdentity();
      checked += 1;
      if (
        mobile.chapterCount !== 2 ||
        mobile.headCount !== 2 ||
        mobile.chapterKeys.join("|") !== "roots|traits" ||
        mobile.chapterTitles.join("|") !== "此身所历|行迹三数"
      ) {
        failures.push(
          `[390-identity] 画像章序或章名漂了:${JSON.stringify({
            chapters: mobile.chapterKeys,
            titles: mobile.chapterTitles,
            heads: mobile.headCount,
          })}`,
        );
      }
      checked += 1;
      if (
        mobile.roots.length !== 4 ||
        mobile.roots[0]?.value !== "剑修 · 一剑破万法" ||
        mobile.roots[1]?.value !== "剑道" ||
        !mobile.roots[2]?.value.includes("背水") ||
        mobile.roots[3]?.value !== "未定"
      ) {
        failures.push(`[390-identity] 此身所历没有读同一份根因:${JSON.stringify(mobile.roots)}`);
      }
      checked += 1;
      if (
        mobile.fortunes.length !== 3 ||
        mobile.fortunes.map((row) => row.title).join("|") !== "上古剑痕|妖兽认主|天外陨铁" ||
        mobile.fortunes.some((row) => !row.line)
      ) {
        failures.push(`[390-identity] 机缘没有从事件表现读:${JSON.stringify(mobile.fortunes)}`);
      }
      checked += 1;
      if (
        mobile.pet.name !== "青羽灵狐" ||
        mobile.pet.nature !== "贪宝" ||
        !mobile.pet.brief.includes("善寻机缘") ||
        !mobile.pet.line.includes("稀有之物")
      ) {
        failures.push(`[390-identity] 灵兽仍只报随行,没有姓名与性格:${JSON.stringify(mobile.pet)}`);
      }
      checked += 1;
      if (
        mobile.traits.map((row) => `${row.key}:${row.value}`).join("|") !==
          "kills:214|explores:38|breakthroughs:9" ||
        !mobile.risk.includes("以险求胜") ||
        !mobile.text.includes("不提供数值加成")
      ) {
        failures.push(`[390-identity] 行迹三数或判词没有同源:${JSON.stringify(mobile)}`);
      }
      checked += 1;
      if (
        mobile.cardShells !== 0 ||
        mobile.eventCardShells !== 0 ||
        mobile.chapterChrome.some(
          (style) =>
            style.radius !== 0 ||
            style.shadow !== "none" ||
            style.background !== "rgba(0, 0, 0, 0)" ||
            style.borders.every((width) => Number.parseFloat(width) > 0),
        )
      ) {
        failures.push(`[390-identity] 画像内层又套回纸卡:${JSON.stringify(mobile.chapterChrome)}`);
      }
      checked += 1;
      if (
        mobile.panelScrollWidth > mobile.panelWidth + 1 ||
        mobile.scrollOverflow ||
        mobile.traitColumns !== 3
      ) {
        failures.push(
          `[390-identity] 画像横向溢出或三数没有并读:${JSON.stringify({
            panel: [mobile.panelScrollWidth, mobile.panelWidth],
            scroll: mobile.scrollOverflow,
            traits: mobile.traitColumns,
          })}`,
        );
      }

      const controls = await auditModalControls(page);
      checked += 1;
      if (!controls || controls.count === 0 || controls.unnamed.length || controls.small.length) {
        failures.push(
          `[390-identity] 画像控件不合格:${controls?.count ?? 0} 枚 / ` +
            `无名 ${controls?.unnamed.join(" | ") || "无"} / ` +
            `过小 ${controls?.small.join(" | ") || "无"}`,
        );
      }

      zoomSeen += 1;
      const zoomProblems = dialogZoomProblems(
        await measureDialogZoom(page, { width: 390, height: 844 }),
      );
      checked += 1;
      if (zoomProblems.length)
        failures.push(`[195-identity] 修行画像 → ${zoomProblems.join(" / ")}`);

      await page.setViewportSize({ width: 195, height: 422 });
      await settleVisuals(page);
      const narrow = await readIdentity();
      checked += 1;
      if (
        narrow.scrollOverflow ||
        narrow.rootColumns !== 1 ||
        narrow.traitColumns !== 1 ||
        narrow.petHeadColumns !== 1 ||
        narrow.roots.some((row) => row.value.includes("· ·"))
      ) {
        failures.push(
          `[195-identity] 画像窄档没有收成上下段:${JSON.stringify({
            scroll: narrow.scrollOverflow,
            roots: narrow.rootColumns,
            traits: narrow.traitColumns,
            pet: narrow.petHeadColumns,
            rootValues: narrow.roots.map((row) => row.value),
          })}`,
        );
      }
      if (SHOTS) {
        mkdirSync(SHOTS_DIR, { recursive: true });
        await page.screenshot({ path: join(SHOTS_DIR, "identity-folio-195.png") });
        await page.setViewportSize({ width: 390, height: 844 });
        await settleVisuals(page);
        await page.screenshot({ path: join(SHOTS_DIR, "identity-folio-390.png") });
      }
    }

    if (pageErrors.length)
      failures.push(`[390-identity] 修行画像页面异常:${[...new Set(pageErrors)].join(" | ")}`);
  } finally {
    await ctx.close();
  }
  return { failures, checked, contrastFails: [], pixelContrastFails: [], zoomFails: [] };
}

/** 天界试炼续卷:四章、八门印谱、单份证道帖、四程立契约台与三档印阵 */
async function taskCelestialTrialFold() {
  const failures = [];
  let checked = 0;
  const ctx = await auditContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  try {
    const slices = showcaseSlices("light");
    slices.endgame = {
      ...slices.endgame,
      endgameTutorialSeen: true,
      resourceDialogSeen: true,
    };
    await seedSave(ctx, slices, "__celestialTrialFold");
    const page = await ctx.newPage();
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    const rendered = await openRoute(page, "/celestial?tab=trial", 900);
    checked += 1;
    if (rendered === 0) {
      failures.push("[390-trial] 天界试炼册没渲染出来,续卷判据没量到东西");
    } else {
      const tutorialClose = page.getByRole("button", { name: "知道了" }).first();
      if ((await tutorialClose.count()) > 0) await tutorialClose.click().catch(() => {});
      const leftover = await clearOverlays(page);
      if (leftover.length) {
        failures.push(`[390-trial] 量试炼续卷前还开着浮层:${leftover.join("、")}`);
      }
      const readFold = () =>
        page.evaluate(() => {
          const ledger = document.querySelector("[data-celestial-trial-ledger]");
          const chapters = [...(ledger?.querySelectorAll("[data-celestial-trial-chapter]") ?? [])];
          const heads = [...(ledger?.querySelectorAll(".folio-chapter-head") ?? [])];
          const roster = ledger?.querySelector(".celestial-trial-roster");
          const seals = [...(roster?.querySelectorAll("[data-celestial-trial-seal]") ?? [])];
          const detail = ledger?.querySelector("[data-celestial-trial-detail]");
          const action = detail?.querySelector("[data-celestial-trial-action]");
          const detailRect = detail?.getBoundingClientRect();
          const actionRect = action?.getBoundingClientRect();
          const options = [...(ledger?.querySelectorAll(".celestial-challenge-option") ?? [])];
          const challengeSteps = [
            ...(ledger?.querySelectorAll("[data-celestial-challenge-step]") ?? []),
          ];
          const challengeStepsGrid = ledger?.querySelector(".celestial-challenge-steps");
          const challengeWorkbench = ledger?.querySelector("[data-celestial-challenge-workbench]");
          const challengePanel = ledger?.querySelector("[data-celestial-challenge-panel]");
          const challengePanelRect = challengePanel?.getBoundingClientRect();
          const challengeActions = ledger?.querySelector("[data-celestial-challenge-actions]");
          const challengeActionsRect = challengeActions?.getBoundingClientRect();
          const challengeContract = ledger?.querySelector("[data-celestial-challenge-contract]");
          const challengeTabRows = challengeSteps.map((tab) => {
            const rect = tab.getBoundingClientRect();
            const style = getComputedStyle(tab);
            return {
              id: tab.getAttribute("data-celestial-challenge-step"),
              selected: tab.getAttribute("aria-selected") === "true",
              tabIndex: tab.getAttribute("tabindex"),
              top: Math.round(rect.top),
              radius: Number.parseFloat(style.borderRadius),
              shadow: style.boxShadow,
              background: style.backgroundColor,
            };
          });
          const selectedChallengeStep = challengeTabRows.find((tab) => tab.selected);
          const sealRows = seals.map((seal) => {
            const rect = seal.getBoundingClientRect();
            const style = getComputedStyle(seal);
            return {
              id: seal.getAttribute("data-celestial-trial"),
              name: (seal.querySelector(".celestial-trial-seal__name")?.textContent || "").trim(),
              pressed: seal.getAttribute("aria-pressed") === "true",
              tabIndex: seal.getAttribute("tabindex"),
              top: Math.round(rect.top),
              width: rect.width,
              radius: Number.parseFloat(style.borderRadius),
              shadow: style.boxShadow,
              background: style.backgroundColor,
            };
          });
          const selected = sealRows.find((seal) => seal.pressed);
          const probe = document.createElement("span");
          probe.style.color = "rgb(var(--color-qing-rgb))";
          document.body.append(probe);
          const qing = getComputedStyle(probe).color;
          probe.style.color = "rgb(var(--color-cinnabar-rgb))";
          const cinnabar = getComputedStyle(probe).color;
          probe.remove();
          return {
            chapterKeys: chapters.map((chapter) =>
              chapter.getAttribute("data-celestial-trial-chapter"),
            ),
            chapterTitles: heads.map((head) =>
              (head.querySelector(".folio-chapter-head__title")?.textContent || "").trim(),
            ),
            chapterFactColors: heads.map((head) => {
              const fact = head.querySelector(".folio-chapter-head__fact");
              return fact ? getComputedStyle(fact).color : "missing";
            }),
            cardShells:
              ledger?.querySelectorAll(
                ".celestial-trial-chapter.card-ink, .celestial-trial-roster .card-ink",
              ).length ?? -1,
            seals: sealRows.length,
            sealIds: sealRows.map((seal) => seal.id),
            pressedCount: sealRows.filter((seal) => seal.pressed).length,
            selectedId: selected?.id ?? null,
            selectedName: selected?.name ?? "",
            selectedTabIndex: selected?.tabIndex ?? null,
            sealTops: sealRows.map((seal) => seal.top),
            sealRadius: sealRows.map((seal) => seal.radius),
            sealShadows: sealRows.map((seal) => seal.shadow),
            unselectedBackgrounds: sealRows
              .filter((seal) => !seal.pressed)
              .map((seal) => seal.background),
            detailId: detail?.getAttribute("data-celestial-trial-detail") ?? null,
            detailName: (
              detail?.querySelector(".celestial-trial-dossier__name")?.textContent || ""
            ).trim(),
            actionCount: detail?.querySelectorAll("[data-celestial-trial-action]").length ?? 0,
            actionRatio:
              actionRect && detailRect && detailRect.width > 0
                ? actionRect.width / detailRect.width
                : null,
            actionColor: action ? getComputedStyle(action).color : "missing",
            actionDisabled: action?.hasAttribute("disabled") ?? true,
            activeId:
              document.activeElement?.getAttribute("data-celestial-trial") ??
              document.activeElement
                ?.closest?.("[data-celestial-trial]")
                ?.getAttribute("data-celestial-trial") ??
              null,
            challengeSteps: challengeTabRows.length,
            challengeTabIds: challengeTabRows.map((tab) => tab.id),
            challengeSelected: selectedChallengeStep?.id ?? null,
            challengeSelectedTabIndex: selectedChallengeStep?.tabIndex ?? null,
            challengeTabSelected: challengeTabRows.map((tab) => tab.selected),
            challengeTabTops: challengeTabRows.map((tab) => tab.top),
            challengeTabRadius: challengeTabRows.map((tab) => tab.radius),
            challengeTabShadows: challengeTabRows.map((tab) => tab.shadow),
            challengeTabBackgrounds: challengeTabRows.map((tab) => tab.background),
            challengeStepColumns: challengeStepsGrid
              ? getComputedStyle(challengeStepsGrid).gridTemplateColumns.trim().split(/\s+/).length
              : -1,
            challengeWorkbenchColumns: challengeWorkbench
              ? getComputedStyle(challengeWorkbench).gridTemplateColumns.trim().split(/\s+/).length
              : -1,
            challengePanel: challengePanel?.getAttribute("data-celestial-challenge-panel") ?? null,
            challengePanelTitle: (
              challengePanel?.querySelector(".celestial-challenge-step__head h3")?.textContent || ""
            ).trim(),
            challengePanelRight: challengePanelRect?.right ?? null,
            challengeActionsRight: challengeActionsRect?.right ?? null,
            challengeContractText: (challengeContract?.textContent || "")
              .replace(/\s+/g, " ")
              .trim(),
            challengeOptions: options.length,
            optionPills: options.filter((option) => {
              const style = getComputedStyle(option);
              return (
                Number.parseFloat(style.borderRadius) !== 0 ||
                Number.parseFloat(style.borderTopWidth) > 0
              );
            }).length,
            challengeActiveId:
              document.activeElement?.getAttribute("data-celestial-challenge-step") ??
              document.activeElement
                ?.closest?.("[data-celestial-challenge-step]")
                ?.getAttribute("data-celestial-challenge-step") ??
              null,
            columns: roster
              ? getComputedStyle(roster).gridTemplateColumns.trim().split(/\s+/).length
              : -1,
            detailRight: detailRect?.right ?? null,
            viewportWidth: window.innerWidth,
            qing,
            cinnabar,
          };
        });

      const mobile = await readFold();
      checked += 1;
      if (
        mobile.chapterKeys.join("|") !== "daily|mutation|trials|challenge" ||
        mobile.chapterTitles.join("|") !== "今日天道|天道变数|天道试炼|天道挑战书"
      ) {
        failures.push(
          `[390-trial] 四章顺序或章名漂了:${mobile.chapterKeys.join(" / ")} · ` +
            mobile.chapterTitles.join(" / "),
        );
      }
      if (mobile.seals !== 8 || new Set(mobile.sealIds).size !== 8) {
        failures.push(
          `[390-trial] 应恰有八枚互异试炼门印,实见 ${mobile.seals} 枚 / ${new Set(mobile.sealIds).size} 个 id`,
        );
      }
      if (
        mobile.pressedCount !== 1 ||
        mobile.selectedTabIndex !== "0" ||
        mobile.detailId !== mobile.selectedId ||
        mobile.detailName !== mobile.selectedName
      ) {
        failures.push(
          `[390-trial] 八门单选与证道帖脱节:${JSON.stringify({
            pressed: mobile.pressedCount,
            selected: mobile.selectedId,
            tabIndex: mobile.selectedTabIndex,
            detail: mobile.detailId,
            detailName: mobile.detailName,
            selectedName: mobile.selectedName,
          })}`,
        );
      }
      if (
        mobile.columns !== 4 ||
        mobile.sealTops.length !== 8 ||
        mobile.sealTops[1] !== mobile.sealTops[0] ||
        mobile.sealTops[4] <= mobile.sealTops[0]
      ) {
        failures.push(
          `[390-trial] 手机八门没有铺成四列两行:${JSON.stringify({
            columns: mobile.columns,
            tops: mobile.sealTops,
          })}`,
        );
      }
      if (mobile.cardShells !== 0) {
        failures.push(`[390-trial] 试炼续卷里仍套着 ${mobile.cardShells} 张同权卡纸`);
      }
      if (
        mobile.sealRadius.some((radius) => radius !== 0) ||
        mobile.sealShadows.some((shadow) => shadow !== "none") ||
        mobile.unselectedBackgrounds.some((background) => background !== "rgba(0, 0, 0, 0)")
      ) {
        failures.push(
          `[390-trial] 试炼门印又长出卡壳:${JSON.stringify({
            radius: mobile.sealRadius,
            shadow: mobile.sealShadows,
            background: mobile.unselectedBackgrounds,
          })}`,
        );
      }
      if (
        mobile.actionCount !== 1 ||
        mobile.actionRatio === null ||
        mobile.actionRatio > 0.72 ||
        mobile.actionColor !== mobile.cinnabar ||
        mobile.actionDisabled
      ) {
        failures.push(
          `[390-trial] 证道帖主键没有收成唯一朱砂短笔:${JSON.stringify({
            count: mobile.actionCount,
            ratio: mobile.actionRatio,
            color: mobile.actionColor,
            disabled: mobile.actionDisabled,
          })}`,
        );
      }
      if (
        mobile.challengeSteps !== 4 ||
        new Set(mobile.challengeTabIds).size !== 4 ||
        mobile.challengeSelected !== "world" ||
        mobile.challengeSelectedTabIndex !== "0" ||
        mobile.challengePanel !== "world" ||
        mobile.challengePanelTitle !== "择界" ||
        mobile.challengeOptions === 0 ||
        mobile.optionPills !== 0
      ) {
        failures.push(
          `[390-trial] 挑战书四程与当前程脱节:${JSON.stringify({
            steps: mobile.challengeSteps,
            ids: mobile.challengeTabIds,
            selected: mobile.challengeSelected,
            tabIndex: mobile.challengeSelectedTabIndex,
            panel: mobile.challengePanel,
            title: mobile.challengePanelTitle,
            options: mobile.challengeOptions,
            pills: mobile.optionPills,
          })}`,
        );
      }
      if (
        mobile.challengeStepColumns !== 2 ||
        mobile.challengeTabTops.length !== 4 ||
        mobile.challengeTabTops[0] !== mobile.challengeTabTops[1] ||
        mobile.challengeTabTops[2] <= mobile.challengeTabTops[0]
      ) {
        failures.push(
          `[390-trial] 挑战书四程没有铺成两列两行:${JSON.stringify({
            columns: mobile.challengeStepColumns,
            tops: mobile.challengeTabTops,
          })}`,
        );
      }
      if (
        mobile.challengeTabRadius.some((radius) => radius !== 0) ||
        mobile.challengeTabShadows
          .filter((shadow, index) => !mobile.challengeTabSelected[index])
          .some((shadow) => shadow !== "none") ||
        mobile.challengeTabBackgrounds
          .filter((background, index) => !mobile.challengeTabSelected[index])
          .some((background) => background !== "rgba(0, 0, 0, 0)")
      ) {
        failures.push(
          `[390-trial] 挑战书四程又长出卡壳:${JSON.stringify({
            radius: mobile.challengeTabRadius,
            shadows: mobile.challengeTabShadows,
            backgrounds: mobile.challengeTabBackgrounds,
          })}`,
        );
      }
      if (mobile.chapterFactColors.some((color) => color !== mobile.qing)) {
        failures.push(`[390-trial] 章内读数没有回到石青:${mobile.chapterFactColors.join(" / ")}`);
      }

      const secondSeal = page.locator("[data-celestial-trial-seal]").nth(1);
      const secondId = await secondSeal.getAttribute("data-celestial-trial");
      await secondSeal.click();
      await settleVisuals(page);
      const switched = await readFold();
      checked += 1;
      if (switched.selectedId !== secondId || switched.detailId !== secondId) {
        failures.push(
          `[390-trial] 点第二枚门印没有换到对应证道帖:${JSON.stringify({
            clicked: secondId,
            selected: switched.selectedId,
            detail: switched.detailId,
          })}`,
        );
      }
      await page.locator('[data-celestial-trial-seal][aria-pressed="true"]').focus();
      await page.keyboard.press("ArrowRight");
      await settleVisuals(page);
      const keyboard = await readFold();
      const expectedThirdId = keyboard.sealIds[2];
      if (keyboard.selectedId !== expectedThirdId || keyboard.activeId !== expectedThirdId) {
        failures.push(
          `[390-trial] 方向键没有把门印、焦点与证道帖一起前移:${JSON.stringify({
            expected: expectedThirdId,
            selected: keyboard.selectedId,
            focused: keyboard.activeId,
          })}`,
        );
      }

      await page.locator('[data-celestial-challenge-step="mutators"]').click();
      await settleVisuals(page);
      const challengeStepClicked = await readFold();
      const firstMutator = page.locator(".celestial-challenge-option").first();
      const firstMutatorName = ((await firstMutator.textContent()) || "").trim();
      await firstMutator.click();
      await settleVisuals(page);
      const challengeFilled = await readFold();
      if (
        challengeStepClicked.challengeSelected !== "mutators" ||
        challengeStepClicked.challengePanel !== "mutators" ||
        challengeFilled.challengeContractText.includes(firstMutatorName) === false
      ) {
        failures.push(
          `[390-trial] 挑战书点击第二程或选取变数后约文没有同步:${JSON.stringify({
            selected: challengeStepClicked.challengeSelected,
            panel: challengeStepClicked.challengePanel,
            picked: firstMutatorName,
            contract: challengeFilled.challengeContractText,
          })}`,
        );
      }
      await page.locator('[data-celestial-challenge-step][aria-selected="true"]').focus();
      await page.keyboard.press("ArrowRight");
      await settleVisuals(page);
      const challengeKeyboard = await readFold();
      if (
        challengeKeyboard.challengeSelected !== "pact" ||
        challengeKeyboard.challengePanel !== "pact" ||
        challengeKeyboard.challengeActiveId !== "pact"
      ) {
        failures.push(
          `[390-trial] 挑战书方向键没有把当前程、焦点与题头一起前移:${JSON.stringify({
            selected: challengeKeyboard.challengeSelected,
            panel: challengeKeyboard.challengePanel,
            focused: challengeKeyboard.challengeActiveId,
          })}`,
        );
      }

      await page.setViewportSize({ width: 1280, height: 900 });
      await settleVisuals(page);
      const desktop = await readFold();
      checked += 1;
      if (desktop.columns !== 8) {
        failures.push(`[1280-trial] 桌面档八门应并成一排,实见 ${desktop.columns} 列`);
      }
      if (desktop.sealTops.length !== 8 || new Set(desktop.sealTops).size !== 1) {
        failures.push(`[1280-trial] 八门没有同排并读:${desktop.sealTops.join(" / ")}`);
      }
      if (
        desktop.challengeWorkbenchColumns !== 2 ||
        desktop.challengeStepColumns !== 1 ||
        new Set(desktop.challengeTabTops).size !== 4
      ) {
        failures.push(
          `[1280-trial] 挑战书没有收成左四程、右一程:${JSON.stringify({
            workbench: desktop.challengeWorkbenchColumns,
            steps: desktop.challengeStepColumns,
            tops: desktop.challengeTabTops,
          })}`,
        );
      }

      await page.setViewportSize({ width: 195, height: 900 });
      await settleVisuals(page);
      const compact = await readFold();
      checked += 1;
      if (
        compact.columns !== 2 ||
        compact.sealTops.length !== 8 ||
        compact.sealTops[2] <= compact.sealTops[0]
      ) {
        failures.push(
          `[195-trial] 200% 档八门应退两列续排:${JSON.stringify({
            columns: compact.columns,
            tops: compact.sealTops,
          })}`,
        );
      }
      if (
        compact.detailRight === null ||
        compact.detailRight > compact.viewportWidth + 1 ||
        compact.actionRatio === null ||
        compact.actionRatio > 1
      ) {
        failures.push(
          `[195-trial] 证道帖或应试键越出纸面:${JSON.stringify({
            detailRight: compact.detailRight,
            viewport: compact.viewportWidth,
            actionRatio: compact.actionRatio,
          })}`,
        );
      }
      if (
        compact.challengeStepColumns !== 1 ||
        compact.challengePanelRight === null ||
        compact.challengePanelRight > compact.viewportWidth + 1 ||
        compact.challengeActionsRight === null ||
        compact.challengeActionsRight > compact.viewportWidth + 1
      ) {
        failures.push(
          `[195-trial] 挑战书四程或约文动作越出纸面:${JSON.stringify({
            stepColumns: compact.challengeStepColumns,
            panelRight: compact.challengePanelRight,
            actionsRight: compact.challengeActionsRight,
            viewport: compact.viewportWidth,
          })}`,
        );
      }

      if (SHOTS) {
        await page.setViewportSize({ width: 1280, height: 900 });
        await settleVisuals(page);
        await page
          .locator("[data-celestial-trial-ledger]")
          .screenshot({ path: join(SHOTS_DIR, "1280-celestial-trial-register.png") });
        await page.setViewportSize({ width: 390, height: 2600 });
        await settleVisuals(page);
        await page
          .locator("[data-celestial-trial-ledger]")
          .screenshot({ path: join(SHOTS_DIR, "390-celestial-trial-register.png") });
      }
    }
    if (pageErrors.length) {
      failures.push(`[390-trial] 试炼续卷页面异常:${[...new Set(pageErrors)].join(" | ")}`);
    }
  } finally {
    await ctx.close();
  }
  return {
    failures,
    checked,
    contrastFails: [],
    pixelContrastFails: [],
    zoomFails: [],
  };
}

/**
 * 天界证道战卷:战果、战局、逐场与判词同住一册。
 *
 * 用七杀试炼真打一场,在 390 / 960 / 195 三档核四章顺序、卷身卡壳归零、
 * 场签 roving tablist、方向键 / Home / End 与战局焦点同步,以及日志不越出账页。
 * 夹具关动效,让回放直接落满,量的不是播放中途的半页。
 */
async function taskCelestialBattleScroll() {
  const failures = [];
  let checked = 0;
  const ctx = await auditContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  try {
    const slices = showcaseSlices("light");
    slices.endgame = {
      ...slices.endgame,
      endgameTutorialSeen: true,
      resourceDialogSeen: true,
    };
    slices.settings = {
      ...slices.settings,
      reduceMotion: true,
      battleSpeed: 4,
    };
    await seedSave(ctx, slices, "__celestialBattleScroll");
    const page = await ctx.newPage();
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    const rendered = await openRoute(page, "/celestial?tab=trial", 900);
    checked += 1;
    if (rendered === 0) {
      failures.push("[390-report] 天界试炼册没渲染出来,证道战卷没打开");
    } else {
      const tutorialClose = page.getByRole("button", { name: "知道了" }).first();
      if ((await tutorialClose.count()) > 0) await tutorialClose.click().catch(() => {});
      const leftover = await clearOverlays(page);
      if (leftover.length) {
        failures.push(`[390-report] 开战报前还开着浮层:${leftover.join("、")}`);
      }

      const trialAction = page.locator("[data-celestial-trial-action]").first();
      if ((await trialAction.count()) === 0) {
        failures.push("[390-report] 找不到试炼应试入口,证道战卷没打开");
      } else {
        await trialAction.click({ timeout: 3000 }).catch(() => {});
        await page
          .waitForSelector("[data-celestial-report-ledger]", { timeout: 6000 })
          .catch(() => undefined);
      }

      const readReport = () =>
        page.evaluate(() => {
          const ledger = document.querySelector("[data-celestial-report-ledger]");
          const modal = ledger?.closest("[data-folio-modal]");
          const modalScroll = modal?.querySelector("[data-folio-modal-scroll]");
          const station = ledger?.querySelector(".celestial-gauntlet__station");
          const tabsRoot = ledger?.querySelector(".celestial-fight-tabs");
          const log = ledger?.querySelector("[data-celestial-fight-log]");
          const playback = ledger?.querySelector(".celestial-gauntlet__playback");
          const box = (el) => {
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return {
              top: r.top,
              right: r.right,
              bottom: r.bottom,
              left: r.left,
              width: r.width,
              height: r.height,
            };
          };
          const style = (el) => {
            if (!el) return null;
            const s = getComputedStyle(el);
            return {
              top: Number.parseFloat(s.borderTopWidth) || 0,
              right: Number.parseFloat(s.borderRightWidth) || 0,
              bottom: Number.parseFloat(s.borderBottomWidth) || 0,
              left: Number.parseFloat(s.borderLeftWidth) || 0,
              radius: Number.parseFloat(s.borderTopLeftRadius) || 0,
              background: s.backgroundColor,
              shadow: s.boxShadow,
            };
          };
          const chapters = [...(ledger?.querySelectorAll("[data-celestial-report-chapter]") ?? [])];
          const tabs = [...(ledger?.querySelectorAll("[data-celestial-fight-tab]") ?? [])];
          const rows = [...(ledger?.querySelectorAll("[data-celestial-report-fight]") ?? [])];
          const ledgerBox = box(ledger);
          const tabRows = tabs.map((tab, index) => {
            const tabBox = box(tab);
            const tabStyle = style(tab);
            return {
              index,
              role: tab.getAttribute("role"),
              selected: tab.getAttribute("aria-selected") === "true",
              tabIndex: tab.getAttribute("tabindex"),
              label: tab.getAttribute("aria-label") || "",
              foe: (tab.querySelector(".celestial-fight-tab__foe")?.textContent || "").trim(),
              top: Math.round(tabBox?.top ?? -1),
              right: tabBox?.right ?? null,
              radius: tabStyle?.radius ?? -1,
              background: tabStyle?.background ?? "",
              shadow: tabStyle?.shadow ?? "",
            };
          });
          const selectedIndex = tabRows.findIndex((tab) => tab.selected);
          const logLines = [...(log?.querySelectorAll(".celestial-gauntlet__line") ?? [])].map(
            (line) => {
              const lineBox = box(line);
              return {
                text: (line.textContent || "").replace(/\s+/g, " ").trim(),
                clip: line.scrollWidth > line.clientWidth + 1,
                outside:
                  !!ledgerBox &&
                  !!lineBox &&
                  (lineBox.left < ledgerBox.left - 1 || lineBox.right > ledgerBox.right + 1),
              };
            },
          );
          return {
            found: !!ledger,
            chapterKeys: chapters.map((chapter) =>
              chapter.getAttribute("data-celestial-report-chapter"),
            ),
            chapterTitles: chapters.map((chapter) =>
              (chapter.querySelector(".folio-chapter-head__title")?.textContent || "").trim(),
            ),
            chapterHeads: ledger?.querySelectorAll(".folio-chapter-head").length ?? -1,
            cardShells: ledger?.querySelectorAll(".card-ink").length ?? -1,
            ledger: style(ledger),
            ledgerBox,
            modalBox: box(modal),
            modalScrollBox: box(modalScroll),
            modalScrollClip: modalScroll
              ? modalScroll.scrollWidth > modalScroll.clientWidth + 1
              : true,
            station: style(station),
            stationBox: box(station),
            stationCurrent: Number(station?.getAttribute("data-celestial-fight-current") ?? -1),
            stationRole: station?.getAttribute("role") ?? null,
            stationFoe: (
              station?.querySelector(".celestial-gauntlet__foe")?.textContent || ""
            ).trim(),
            tabsRootRole: tabsRoot?.getAttribute("role") ?? null,
            tabColumns: tabsRoot
              ? getComputedStyle(tabsRoot).gridTemplateColumns.trim().split(/\s+/).length
              : -1,
            stationColumns: station
              ? getComputedStyle(station).gridTemplateColumns.trim().split(/\s+/).length
              : -1,
            tabs: tabRows,
            tabCount: tabRows.length,
            selectedCount: tabRows.filter((tab) => tab.selected).length,
            selectedIndex,
            selectedTabIndex: tabRows[selectedIndex]?.tabIndex ?? null,
            activeIndex: tabs.findIndex((tab) => tab === document.activeElement),
            rowCount: rows.length,
            currentRows: rows
              .map((row, index) => ({ index, current: row.hasAttribute("data-current") }))
              .filter((row) => row.current)
              .map((row) => row.index),
            rowRadii: rows.map((row) => style(row)?.radius ?? -1),
            log: style(log),
            logLines,
            logRole: log?.getAttribute("role") ?? null,
            playbackLabel: (playback?.textContent || "").trim(),
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
          };
        });

      await settleVisuals(page);
      const mobile = await readReport();
      checked += 1;
      if (!mobile.found) {
        failures.push("[390-report] 证道战卷没有渲染,整组判据落空");
      } else {
        if (
          mobile.chapterKeys.join("|") !== "result|field|fights|judgement" ||
          mobile.chapterTitles.join("|") !== "战果|战局|逐场|此战之判" ||
          mobile.chapterHeads !== 4
        ) {
          failures.push(
            `[390-report] 战卷四章顺序或章首漂了:${JSON.stringify({
              keys: mobile.chapterKeys,
              titles: mobile.chapterTitles,
              heads: mobile.chapterHeads,
            })}`,
          );
        }
        if (
          !mobile.ledger ||
          mobile.ledger.top < 0.9 ||
          mobile.ledger.bottom < 0.9 ||
          mobile.ledger.left > 0.1 ||
          mobile.ledger.right > 0.1 ||
          mobile.ledger.radius > 0.1 ||
          mobile.ledger.background !== "rgba(0, 0, 0, 0)" ||
          mobile.ledger.shadow !== "none"
        ) {
          failures.push(`[390-report] 战卷没有只留上下账线:${JSON.stringify(mobile.ledger)}`);
        }
        if (mobile.cardShells !== 0) {
          failures.push(`[390-report] 战卷正文仍套着 ${mobile.cardShells} 张同权卡纸`);
        }
        if (
          mobile.tabsRootRole !== "tablist" ||
          mobile.tabCount < 2 ||
          mobile.selectedCount !== 1 ||
          mobile.selectedTabIndex !== "0" ||
          mobile.stationRole !== "tabpanel" ||
          mobile.stationCurrent !== mobile.selectedIndex ||
          mobile.rowCount !== mobile.tabCount ||
          mobile.currentRows.join(",") !== String(mobile.selectedIndex)
        ) {
          failures.push(
            `[390-report] 场签、战局与逐场没有同报当前场:${JSON.stringify({
              role: mobile.tabsRootRole,
              tabs: mobile.tabCount,
              selectedCount: mobile.selectedCount,
              selectedIndex: mobile.selectedIndex,
              selectedTabIndex: mobile.selectedTabIndex,
              stationRole: mobile.stationRole,
              stationCurrent: mobile.stationCurrent,
              rows: mobile.rowCount,
              currentRows: mobile.currentRows,
            })}`,
          );
        }
        if (mobile.tabColumns < 2) {
          failures.push(`[390-report] 手机场签只铺成 ${mobile.tabColumns} 列,没成组可扫`);
        }
        const badTabs = mobile.tabs.filter(
          (tab) =>
            tab.role !== "tab" ||
            tab.radius !== 0 ||
            (!tab.selected && (tab.background !== "rgba(0, 0, 0, 0)" || tab.shadow !== "none")),
        );
        if (badTabs.length) {
          failures.push(
            `[390-report] 场签又长成卡壳:${JSON.stringify(
              badTabs.map((tab) => ({
                label: tab.label,
                radius: tab.radius,
                background: tab.background,
                shadow: tab.shadow,
              })),
            )}`,
          );
        }
        if (
          !mobile.station ||
          mobile.station.top > 0.1 ||
          mobile.station.right > 0.1 ||
          mobile.station.bottom > 0.1 ||
          mobile.station.left > 0.1 ||
          mobile.station.radius > 0.1 ||
          mobile.station.background !== "rgba(0, 0, 0, 0)" ||
          mobile.station.shadow !== "none"
        ) {
          failures.push(`[390-report] 战局又自成一张纸卡:${JSON.stringify(mobile.station)}`);
        }
        if (
          !mobile.log ||
          mobile.log.top > 0.1 ||
          mobile.log.right > 0.1 ||
          mobile.log.bottom > 0.1 ||
          mobile.log.left > 0.1 ||
          mobile.log.radius > 0.1 ||
          mobile.log.background !== "rgba(0, 0, 0, 0)" ||
          mobile.logRole !== "log"
        ) {
          failures.push(`[390-report] 战报没有退成透明账页:${JSON.stringify(mobile.log)}`);
        }
        if (mobile.logLines.length === 0) {
          failures.push("[390-report] 关动效后战报仍没有直给结果");
        } else if (mobile.logLines.some((line) => line.clip || line.outside)) {
          failures.push(
            `[390-report] 战报行被裁或越出账页:${mobile.logLines
              .filter((line) => line.clip || line.outside)
              .map((line) => line.text)
              .join(" | ")}`,
          );
        }
        if (mobile.playbackLabel !== "重播") {
          failures.push(
            `[390-report] 关动效没有把回放直接落满,播放键仍是「${mobile.playbackLabel || "无"}」`,
          );
        }
        if (!mobile.rowRadii.every((radius) => radius === 0)) {
          failures.push(`[390-report] 逐场账行又长出圆角:${mobile.rowRadii.join(",")}`);
        }
        if (
          !mobile.modalBox ||
          !mobile.ledgerBox ||
          mobile.modalBox.left < -1 ||
          mobile.modalBox.right > mobile.viewportWidth + 1 ||
          mobile.ledgerBox.left < -1 ||
          mobile.ledgerBox.right > mobile.viewportWidth + 1 ||
          mobile.modalScrollClip
        ) {
          failures.push(
            `[390-report] 战卷越出视口:${JSON.stringify({
              modal: mobile.modalBox,
              modalScroll: mobile.modalScrollBox,
              ledger: mobile.ledgerBox,
              viewport: mobile.viewportWidth,
            })}`,
          );
        }
      }

      await page.locator('[data-celestial-fight-tab][aria-selected="true"]').focus();
      await page.keyboard.press("ArrowRight");
      await settleVisuals(page);
      const keyRight = await readReport();
      checked += 1;
      if (
        keyRight.selectedIndex !== 1 ||
        keyRight.activeIndex !== 1 ||
        keyRight.stationCurrent !== 1 ||
        keyRight.stationFoe !== keyRight.tabs[1]?.foe ||
        keyRight.currentRows.join(",") !== "1"
      ) {
        failures.push(
          `[390-report] 方向键没有让场签、焦点、战局与逐场同步前移:${JSON.stringify({
            selected: keyRight.selectedIndex,
            active: keyRight.activeIndex,
            station: keyRight.stationCurrent,
            stationFoe: keyRight.stationFoe,
            tabFoe: keyRight.tabs[1]?.foe,
            currentRows: keyRight.currentRows,
          })}`,
        );
      }

      await page.locator('[data-celestial-fight-tab][aria-selected="true"]').focus();
      await page.keyboard.press("End");
      await settleVisuals(page);
      const keyEnd = await readReport();
      if (
        keyEnd.selectedIndex !== keyEnd.tabCount - 1 ||
        keyEnd.activeIndex !== keyEnd.tabCount - 1 ||
        keyEnd.stationCurrent !== keyEnd.tabCount - 1
      ) {
        failures.push(
          `[390-report] End 没有落到末场:${JSON.stringify({
            selected: keyEnd.selectedIndex,
            active: keyEnd.activeIndex,
            station: keyEnd.stationCurrent,
            tabs: keyEnd.tabCount,
          })}`,
        );
      }

      await page.locator('[data-celestial-fight-tab][aria-selected="true"]').focus();
      await page.keyboard.press("Home");
      await settleVisuals(page);
      const keyHome = await readReport();
      if (
        keyHome.selectedIndex !== 0 ||
        keyHome.activeIndex !== 0 ||
        keyHome.stationCurrent !== 0
      ) {
        failures.push(
          `[390-report] Home 没有回到首场:${JSON.stringify({
            selected: keyHome.selectedIndex,
            active: keyHome.activeIndex,
            station: keyHome.stationCurrent,
          })}`,
        );
      }

      await page.setViewportSize({ width: 960, height: 900 });
      await settleVisuals(page);
      const desktop = await readReport();
      checked += 1;
      if (desktop.tabColumns < desktop.tabCount) {
        failures.push(
          `[960-report] 桌面场签没有并成一排:${desktop.tabColumns} 列 / ${desktop.tabCount} 场`,
        );
      }
      if (new Set(desktop.tabs.map((tab) => tab.top)).size !== 1) {
        failures.push(
          `[960-report] 桌面场签没有同排:${desktop.tabs.map((tab) => tab.top).join(" / ")}`,
        );
      }
      if (desktop.stationColumns !== 2) {
        failures.push(`[960-report] 战局没有收成对阵左、战报右:${desktop.stationColumns} 列`);
      }
      if (
        !desktop.ledgerBox ||
        !desktop.modalBox ||
        desktop.ledgerBox.left < -1 ||
        desktop.ledgerBox.right > desktop.viewportWidth + 1 ||
        desktop.modalBox.left < -1 ||
        desktop.modalBox.right > desktop.viewportWidth + 1 ||
        desktop.modalScrollClip ||
        desktop.tabs.some((tab) => tab.right !== null && tab.right > desktop.viewportWidth + 1) ||
        desktop.logLines.some((line) => line.clip || line.outside)
      ) {
        failures.push(
          `[960-report] 战卷、场签或日志越出纸面:${JSON.stringify({
            viewport: desktop.viewportWidth,
            modal: desktop.modalBox,
            modalScroll: desktop.modalScrollBox,
            ledger: desktop.ledgerBox,
            tabs: desktop.tabs.map((tab) => tab.right),
            badLines: desktop.logLines
              .filter((line) => line.clip || line.outside)
              .map((line) => line.text),
          })}`,
        );
      }

      await page.setViewportSize({ width: 195, height: 900 });
      await settleVisuals(page);
      const compact = await readReport();
      checked += 1;
      if (compact.tabColumns !== 1) {
        failures.push(`[195-report] 200% 档场签应退单列,实见 ${compact.tabColumns} 列`);
      }
      if (
        !compact.ledgerBox ||
        !compact.modalBox ||
        compact.ledgerBox.right > compact.viewportWidth + 1 ||
        compact.modalBox.left < -1 ||
        compact.modalBox.right > compact.viewportWidth + 1 ||
        compact.modalScrollClip ||
        compact.tabs.some((tab) => tab.right !== null && tab.right > compact.viewportWidth + 1) ||
        compact.logLines.some((line) => line.clip || line.outside)
      ) {
        failures.push(
          `[195-report] 战卷、场签或日志越出纸面:${JSON.stringify({
            viewport: compact.viewportWidth,
            modal: compact.modalBox,
            modalScroll: compact.modalScrollBox,
            ledger: compact.ledgerBox,
            tabs: compact.tabs.map((tab) => tab.right),
            badLines: compact.logLines
              .filter((line) => line.clip || line.outside)
              .map((line) => line.text),
          })}`,
        );
      }
      /*
       * 这里不调 measurePage:它会把 BaseModal 背后那组故意 tabindex=-1 的 roving
       * 试炼门印当成「念出来是按钮却按不动」。战卷自己已有浮层宽度、滚动余量、
       * 场签、日志逐行越界判据,量的是浮层内真实可见的那一册。
       */
      for (const check of [
        { tag: "390", state: mobile },
        { tag: "960", state: desktop },
        { tag: "195", state: compact },
      ]) {
        if (!check.state.found) failures.push(`[${check.tag}-report] 战卷在切档后消失`);
      }

      if (SHOTS) {
        await page.setViewportSize({ width: 960, height: 1100 });
        await settleVisuals(page);
        await page
          .locator("[data-celestial-report-ledger]")
          .screenshot({ path: join(SHOTS_DIR, "960-celestial-report-scroll.png") });
        await page.setViewportSize({ width: 390, height: 2600 });
        await settleVisuals(page);
        await page
          .locator("[data-celestial-report-ledger]")
          .screenshot({ path: join(SHOTS_DIR, "390-celestial-report-scroll.png") });
      }
    }
    if (pageErrors.length) {
      failures.push(`[390-report] 证道战卷页面异常:${[...new Set(pageErrors)].join(" | ")}`);
    }
  } finally {
    await ctx.close();
  }
  return {
    failures,
    checked,
    contrastFails: [],
    pixelContrastFails: [],
    zoomFails: [],
  };
}

/**
 * 天界内层三册:道途两章、远征两章与道痕一册都沿同一套开口续卷语法。
 *
 * 390 核对章序、章首真值与单列账行；1280 核对门径与世界账行两两并读；
 * 195(200% 缩放)核对章内读数退到题名下方但不挤成竖排，整页仍无横向可滚。
 */
async function taskCelestialInnerVolumes() {
  const failures = [];
  let checked = 0;
  const ctx = await auditContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  try {
    const slices = showcaseSlices("light");
    slices.endgame = {
      ...slices.endgame,
      endgameTutorialSeen: true,
      resourceDialogSeen: true,
      marks: makeFullMarks().slice(0, 7),
    };
    await seedSave(ctx, slices, "__celestialInnerVolumes");
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      Math.random = () => 1;
    });
    const pageErrors = [];
    watchPageErrors(page, pageErrors);

    async function openCelestial(tab) {
      await page.setViewportSize({ width: 390, height: 844 });
      const rendered = await openRoute(page, `/celestial?tab=${tab}`, 700);
      checked += 1;
      if (rendered === 0) {
        failures.push(`[390-${tab}] 天界内层册没渲染出来,续卷判据没量到东西`);
        return false;
      }
      const tutorialClose = page.getByRole("button", { name: "知道了" }).first();
      if ((await tutorialClose.count()) > 0) await tutorialClose.click().catch(() => {});
      const leftover = await clearOverlays(page);
      if (leftover.length) {
        failures.push(`[390-${tab}] 量内层续卷前还开着浮层:${leftover.join("、")}`);
      }
      return true;
    }

    async function readLedger(ledgerSelector) {
      return page.evaluate((selector) => {
        const ledger = document.querySelector(selector);
        const chapters = ledger
          ? [
              ...(ledger.matches("[data-celestial-chapter]") ? [ledger] : []),
              ...ledger.querySelectorAll("[data-celestial-chapter]"),
            ]
          : [];
        const heads = [...(ledger?.querySelectorAll(".folio-chapter-head") ?? [])];
        const overlaps = (a, b) =>
          Boolean(
            a &&
            b &&
            Math.min(a.right, b.right) > Math.max(a.left, b.left) + 1 &&
            Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top) + 1,
          );
        const style = ledger ? getComputedStyle(ledger) : null;
        return {
          found: Boolean(ledger),
          chapterKeys: chapters.map((chapter) => chapter.getAttribute("data-celestial-chapter")),
          chapterTitles: heads.map((head) =>
            (head.querySelector(".folio-chapter-head__title")?.textContent || "").trim(),
          ),
          chapterFacts: heads.map((head) =>
            (head.querySelector(".folio-chapter-head__fact")?.textContent || "").trim(),
          ),
          cardShells: ledger?.querySelectorAll(".card-ink").length ?? -1,
          ledgerChrome: {
            sideBorders: style ? [style.borderLeftWidth, style.borderRightWidth] : [],
            radius: style ? Number.parseFloat(style.borderRadius) : null,
            background: style?.backgroundColor ?? "missing",
            shadow: style?.boxShadow ?? "missing",
          },
          heads: heads.map((head) => {
            const headRect = head.getBoundingClientRect();
            const copy = head.querySelector(".folio-chapter-head__copy");
            const fact = head.querySelector(".folio-chapter-head__fact");
            const copyRect = copy?.getBoundingClientRect();
            const factRect = fact?.getBoundingClientRect();
            const lineHeight = fact
              ? Number.parseFloat(getComputedStyle(fact).lineHeight) ||
                Number.parseFloat(getComputedStyle(fact).fontSize) ||
                1
              : 1;
            return {
              overflow: head.scrollWidth > head.clientWidth + 1,
              factInside: factRect
                ? factRect.left >= headRect.left - 2 &&
                  factRect.right <= headRect.right + 2 &&
                  factRect.top >= headRect.top - 2 &&
                  factRect.bottom <= headRect.bottom + 2
                : true,
              copyFactOverlap: overlaps(copyRect, factRect),
              factLineRatio: factRect ? factRect.height / lineHeight : 0,
            };
          }),
        };
      }, ledgerSelector);
    }

    async function gridColumns(selector) {
      return page.evaluate((target) => {
        const el = document.querySelector(target);
        return el
          ? getComputedStyle(el).gridTemplateColumns.split(/\s+/).filter(Boolean).length
          : -1;
      }, selector);
    }

    function auditLedgerChrome(label, ledger) {
      if (!ledger.found) {
        failures.push(`[${label}] 续卷外壳没量到,判据空转`);
        return;
      }
      if (ledger.cardShells !== 0) {
        failures.push(`[${label}] 续卷正文仍套着 ${ledger.cardShells} 张同权卡纸`);
      }
      if (
        ledger.ledgerChrome.sideBorders.some((width) => Number.parseFloat(width) !== 0) ||
        ledger.ledgerChrome.radius !== 0 ||
        ledger.ledgerChrome.background !== "rgba(0, 0, 0, 0)" ||
        ledger.ledgerChrome.shadow !== "none"
      ) {
        failures.push(`[${label}] 续卷外壳又长出卡壳:${JSON.stringify(ledger.ledgerChrome)}`);
      }
      if (ledger.heads.some((head) => head.overflow || !head.factInside || head.copyFactOverlap)) {
        failures.push(`[${label}] 章首与章内读数互相挤压:${JSON.stringify(ledger.heads)}`);
      }
    }

    async function auditZoom(label, ledgerSelector) {
      await page.setViewportSize({ width: 195, height: 422 });
      await settleVisuals(page);
      checked += 1;
      const problems = problemsOf(await measurePage(page));
      if (problems.length) failures.push(`[195-${label}] → ${problems.join(" / ")}`);
      const ledger = await readLedger(ledgerSelector);
      if (
        ledger.heads.some(
          (head) =>
            head.overflow || !head.factInside || head.copyFactOverlap || head.factLineRatio > 2.2,
        )
      ) {
        failures.push(
          `[195-${label}] 章内读数被挤成竖排或越出章首:${JSON.stringify(ledger.heads)}`,
        );
      }
    }

    async function snapLedger(name, ledgerSelector) {
      if (!SHOTS) return;
      await page.setViewportSize({ width: 1280, height: 900 });
      await settleVisuals(page);
      await page
        .locator(ledgerSelector)
        .screenshot({ path: join(SHOTS_DIR, `1280-celestial-${name}.png`) });
      await page.setViewportSize({ width: 390, height: 2600 });
      await settleVisuals(page);
      await page
        .locator(ledgerSelector)
        .screenshot({ path: join(SHOTS_DIR, `390-celestial-${name}.png`) });
    }

    if (await openCelestial("dao")) {
      const dao = await readLedger("[data-celestial-dao-ledger]");
      checked += 1;
      if (
        dao.chapterKeys.join("|") !== "dao|gateways" ||
        dao.chapterTitles.join("|") !== "道途与门径|两处门径"
      ) {
        failures.push(
          `[390-dao] 两章顺序或章名漂了:${dao.chapterKeys.join(" / ")} · ` +
            dao.chapterTitles.join(" / "),
        );
      }
      const daoFacts = await page.evaluate(() => {
        const name = document
          .querySelector('[data-celestial-chapter="dao"] .celestial-dao__name p')
          ?.textContent?.trim();
        const soulNote = document.querySelector(
          "[data-celestial-gateways] .celestial-gateway:nth-child(2) .celestial-gateway__note",
        );
        const pair = (soulNote?.textContent || "").match(/已凝\s*(\d+)\/(\d+)/);
        return { name: name || "", soulPair: pair ? `${pair[1]}/${pair[2]}` : "" };
      });
      if (!daoFacts.name) {
        failures.push("[390-dao] 道途真值没量到,章首同源判据空转");
      } else if (
        !dao.chapterFacts[0].includes(daoFacts.name) ||
        !dao.chapterFacts[0].includes("已定")
      ) {
        failures.push(`[390-dao] 道途章首没有报道途真值:${dao.chapterFacts[0]}`);
      }
      if (!daoFacts.soulPair) {
        failures.push("[390-dao] 器魂槽位真值没量到,章首同源判据空转");
      } else if (!dao.chapterFacts[1].includes(daoFacts.soulPair)) {
        failures.push(
          `[390-dao] 门径章首 ${dao.chapterFacts[1]} 没有读到器魂槽位 ${daoFacts.soulPair}`,
        );
      }
      auditLedgerChrome("390-dao", dao);
      const mobileGatewayColumns = await gridColumns(".celestial-gateway-rows");
      checked += 1;
      if (mobileGatewayColumns !== 1) {
        failures.push(`[390-dao] 两处门径应为单列,实见 ${mobileGatewayColumns} 列`);
      }

      await page.setViewportSize({ width: 1280, height: 900 });
      await settleVisuals(page);
      const desktopGatewayColumns = await gridColumns(".celestial-gateway-rows");
      checked += 1;
      if (desktopGatewayColumns !== 2) {
        failures.push(`[1280-dao] 两处门径应并读为两列,实见 ${desktopGatewayColumns} 列`);
      }

      await snapLedger("dao-ledger", "[data-celestial-dao-ledger]");
      await auditZoom("dao", "[data-celestial-dao-ledger]");
    }

    if (await openCelestial("exped")) {
      const expedition = await readLedger("[data-celestial-expedition-ledger]");
      checked += 1;
      if (
        expedition.chapterKeys.join("|") !== "run|worlds" ||
        expedition.chapterTitles.join("|") !== "在途远征|特殊规则世界"
      ) {
        failures.push(
          `[390-exped] 两章顺序或章名漂了:${expedition.chapterKeys.join(" / ")} · ` +
            expedition.chapterTitles.join(" / "),
        );
      }
      const worldState = await page.evaluate(() => {
        const worlds = [
          ...document.querySelectorAll("[data-celestial-worlds] .celestial-world-row"),
        ];
        const regular = worlds.filter(
          (row) => !row.classList.contains("celestial-world-row--void"),
        );
        const voidRow = worlds.find((row) => row.classList.contains("celestial-world-row--void"));
        return {
          emptyVisible: Boolean(document.querySelector("[data-celestial-run-empty]")),
          regularCount: regular.length,
          hasVoidWorld: Boolean(voidRow?.querySelector(".btn-seal")),
          rows: worlds.map((row) => {
            const style = getComputedStyle(row);
            return {
              top: Math.round(row.getBoundingClientRect().top),
              radius: Number.parseFloat(style.borderRadius),
              shadow: style.boxShadow,
              background: style.backgroundColor,
            };
          }),
        };
      });
      const expectedWorlds = worldState.regularCount + (worldState.hasVoidWorld ? 1 : 0);
      const expectedVoidText = worldState.hasVoidWorld ? "虚门可窥" : "虚门待窥";
      if (!worldState.emptyVisible) {
        failures.push("[390-exped] 没有在途远征时首章空态没露出来");
      }
      if (expedition.chapterFacts[1] !== `${expectedWorlds} 界 · ${expectedVoidText}`) {
        failures.push(
          `[390-exped] 世界章首 ${expedition.chapterFacts[1]} 与真实世界数 ` +
            `${expectedWorlds} / ${expectedVoidText} 不同源`,
        );
      }
      if (
        worldState.rows.some(
          (row) =>
            row.radius !== 0 || row.shadow !== "none" || row.background !== "rgba(0, 0, 0, 0)",
        )
      ) {
        failures.push(`[390-exped] 世界账行又长出卡壳:${JSON.stringify(worldState.rows)}`);
      }
      auditLedgerChrome("390-exped", expedition);
      const mobileWorldColumns = await gridColumns(".celestial-world-ledger");
      checked += 1;
      if (mobileWorldColumns !== 1) {
        failures.push(`[390-exped] 世界账行应为单列,实见 ${mobileWorldColumns} 列`);
      }

      await page.setViewportSize({ width: 1280, height: 900 });
      await settleVisuals(page);
      const desktopWorld = await page.evaluate(() => {
        const grid = document.querySelector(".celestial-world-ledger");
        const rows = [...document.querySelectorAll("[data-celestial-worlds] .celestial-world-row")];
        return {
          columns: grid
            ? getComputedStyle(grid).gridTemplateColumns.split(/\s+/).filter(Boolean).length
            : -1,
          tops: rows.map((row) => Math.round(row.getBoundingClientRect().top)),
        };
      });
      checked += 1;
      if (desktopWorld.columns !== 2) {
        failures.push(`[1280-exped] 世界账行应并读为两列,实见 ${desktopWorld.columns} 列`);
      }
      if (
        desktopWorld.tops.length < 2 ||
        desktopWorld.tops[0] !== desktopWorld.tops[1] ||
        (desktopWorld.tops[2] !== undefined && desktopWorld.tops[2] <= desktopWorld.tops[0])
      ) {
        failures.push(`[1280-exped] 世界账行没有两两并读:${desktopWorld.tops.join(" / ")}`);
      }

      await snapLedger("expedition-ledger", "[data-celestial-expedition-ledger]");
      await auditZoom("exped", "[data-celestial-expedition-ledger]");
    }

    if (await openCelestial("marks")) {
      const marks = await readLedger("[data-celestial-marks-ledger]");
      checked += 1;
      if (marks.chapterKeys.join("|") !== "marks" || marks.chapterTitles.join("|") !== "道痕") {
        failures.push(
          `[390-marks] 道痕章序或章名漂了:${marks.chapterKeys.join(" / ")} · ` +
            marks.chapterTitles.join(" / "),
        );
      }
      const markState = await page.evaluate(() => {
        const holder = document.querySelector("[data-marks-total]");
        return {
          total: Number(holder?.getAttribute("data-marks-total")),
          shown: Number(holder?.getAttribute("data-marks-shown")),
          rows: document.querySelectorAll("[data-mark-row]").length,
        };
      });
      if (
        !Number.isFinite(markState.total) ||
        markState.total <= 0 ||
        !marks.chapterFacts[0].startsWith(`${markState.total} / `) ||
        !marks.chapterFacts[0].endsWith(" 则")
      ) {
        failures.push(
          `[390-marks] 章首 ${marks.chapterFacts[0]} 没有读到卷内 ${markState.total} 则`,
        );
      }
      if (markState.shown !== markState.total || markState.rows !== markState.total) {
        failures.push(`[390-marks] 卷内真值与可见行不一致:${JSON.stringify(markState)}`);
      }
      auditLedgerChrome("390-marks", marks);

      await page.setViewportSize({ width: 1280, height: 900 });
      await settleVisuals(page);
      const desktopMarks = await readLedger("[data-celestial-marks-ledger]");
      auditLedgerChrome("1280-marks", desktopMarks);

      await snapLedger("marks-ledger", "[data-celestial-marks-ledger]");
      await auditZoom("marks", "[data-celestial-marks-ledger]");
    }

    if (pageErrors.length) {
      failures.push(`[390-celestial] 内层续卷页面异常:${[...new Set(pageErrors)].join(" | ")}`);
    }
  } finally {
    await ctx.close();
  }
  return {
    failures,
    checked,
    contrastFails: [],
    pixelContrastFails: [],
    zoomFails: [],
  };
}

/** 界域志首屏的此刻优先;六册共用章首、卷次与章内真值 */
async function taskCodexFold() {
  const failures = [];
  let checked = 0;
  const ctx = await auditContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  try {
    await seedSave(ctx, showcaseSlices("light"), "__codexFold");
    const page = await ctx.newPage();
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    const rendered = await openRoute(page, "/codex", 700);
    async function realmCodexDeskSpread() {
      const layout = await page.evaluate(() => {
        const desk = document.querySelector("[data-realm-codex-desk]");
        const lead = desk?.querySelector(".realm-codex-desk__lead");
        const volumes = desk?.querySelector(".realm-codex-desk__volumes");
        if (!desk || !lead || !volumes) return null;
        const deskStyle = getComputedStyle(desk);
        const leadBox = lead.getBoundingClientRect();
        const volumesBox = volumes.getBoundingClientRect();
        return {
          display: deskStyle.display,
          columns: deskStyle.gridTemplateColumns.split(" ").filter(Boolean),
          lead: {
            left: leadBox.left,
            right: leadBox.right,
            top: leadBox.top,
            width: leadBox.width,
          },
          volumes: {
            left: volumesBox.left,
            right: volumesBox.right,
            top: volumesBox.top,
            width: volumesBox.width,
          },
          viewport: window.innerWidth,
        };
      });
      checked += 1;
      if (
        !layout ||
        layout.display !== "grid" ||
        layout.columns.length !== 2 ||
        Math.abs(layout.lead.top - layout.volumes.top) > 2 ||
        layout.lead.right + 8 > layout.volumes.left ||
        layout.lead.width < 300 ||
        layout.volumes.width < 390 ||
        layout.lead.left < -1 ||
        layout.volumes.right > layout.viewport + 1
      ) {
        failures.push(
          `[1280] 界域志当前卷与境界谱没有摊成左右两页:` +
            (layout
              ? `display=${layout.display} / columns=${layout.columns.join(" | ")} / ` +
                `左 ${Math.round(layout.lead.left)}..${Math.round(layout.lead.right)} ` +
                `(${Math.round(layout.lead.width)}) / ` +
                `右 ${Math.round(layout.volumes.left)}..${Math.round(layout.volumes.right)} ` +
                `(${Math.round(layout.volumes.width)}) / ` +
                `顶差 ${Math.round(Math.abs(layout.lead.top - layout.volumes.top))}`
              : "取不到左页或右页"),
        );
      }
    }

    async function realmCodexChapterSheets(width) {
      const chapters = [
        ["realm", "界域", "壹", /\d+\s*界\s*·\s*\d+\s*境\s*·\s*\d+\/\d+\s*已渡/],
        ["classics", "典籍", "贰", /\d+\s*部原典/],
        ["yi", "周易", "叁", /\d+\s*卦为体\s*·\s*\d+\s*卦为用\s*·\s*(?:在身|无卦)/],
        ["ziwei", "紫微", "肆", /\d+\s*宫\s*·\s*\d+\s*主星\s*·\s*命格之力/],
        ["xiang", "星象", "伍", /\d+\s*宿\s*·\s*今日利\s*.+\s*\+\d+%/],
        ["qimen", "奇门", "陆", /\d+\s*门\s*·\s*洛书\s*\d+\s*宫/],
      ];
      const disclosures = {
        yi: "hexagrams",
        xiang: "mansions",
      };
      const height = width <= 220 ? 422 : 844;
      await page.setViewportSize({ width, height });

      for (const [chapter, label, index, factPattern] of chapters) {
        await openRoute(page, chapter === "realm" ? "/codex" : `/codex?tab=${chapter}`, 120);
        await page
          .waitForSelector(`[data-realm-codex-folio][data-chapter="${chapter}"]`, {
            timeout: 5000,
          })
          .catch(() => undefined);

        const current = await page.evaluate((chapterId) => {
          const folio = document.querySelector("[data-realm-codex-folio]");
          const chapterEl = folio?.querySelector(`[data-realm-codex-chapter="${chapterId}"]`);
          const head = chapterEl?.querySelector("[data-folio-chapter-head]");
          const headCopy = head?.querySelector(".folio-chapter-head__copy");
          const headFact = head?.querySelector(".folio-chapter-head__fact");
          const style = folio ? getComputedStyle(folio) : null;
          const headStyle = head ? getComputedStyle(head) : null;
          const headRect = head?.getBoundingClientRect();
          const copyRect = headCopy?.getBoundingClientRect();
          const factRect = headFact?.getBoundingClientRect();
          const readText = (el) => (el?.textContent || "").replace(/\s+/g, " ").trim();
          const sections = [...(folio?.querySelectorAll(".realm-codex-section") ?? [])];
          const rows = [
            ...(folio?.querySelectorAll(
              ".realm-classic, .realm-trigram-row, .realm-fate-row, .realm-hexagram-row, .realm-mansion-row, .realm-qimen-row",
            ) ?? []),
          ].filter((row) => row.getClientRects().length > 0);
          return {
            chapter: folio?.getAttribute("data-chapter") ?? null,
            label: readText(head?.querySelector(".folio-chapter-head__title")),
            headIndex: readText(head?.querySelector(".folio-chapter-head__index")),
            headHint: readText(head?.querySelector(".folio-chapter-head__hint")),
            headFact: readText(headFact),
            head: headRect
              ? {
                  count: chapterEl?.querySelectorAll("[data-folio-chapter-head]").length,
                  chapter: head?.getAttribute("data-chapter") ?? null,
                  first: chapterEl?.firstElementChild === head,
                  legacyChapterHeads:
                    chapterEl?.querySelectorAll(".section-title, [data-folio-section-mark]")
                      .length ?? -1,
                  columns: headStyle?.gridTemplateColumns.split(" ").filter(Boolean) ?? [],
                  factBelowCopy: copyRect && factRect ? factRect.top >= copyRect.bottom - 1 : false,
                  factRightOfCopy:
                    copyRect && factRect ? factRect.left >= copyRect.right - 1 : false,
                  boxOverflow:
                    headRect && factRect
                      ? factRect.left < headRect.left - 1 || factRect.right > headRect.right + 1
                      : true,
                }
              : null,
            chapterVisible:
              Boolean(chapterEl?.getClientRects().length) &&
              (chapterEl?.getBoundingClientRect().height ?? 0) > 0,
            folio: style
              ? {
                  borderTop: Number.parseFloat(style.borderTopWidth),
                  borderRight: Number.parseFloat(style.borderRightWidth),
                  borderBottom: Number.parseFloat(style.borderBottomWidth),
                  borderLeft: Number.parseFloat(style.borderLeftWidth),
                  radius: Number.parseFloat(style.borderTopLeftRadius),
                  shadow: style.boxShadow,
                }
              : null,
            cardInk: folio?.querySelectorAll(".card-ink").length ?? -1,
            sectionBorders: sections.map((section) => {
              const sectionStyle = getComputedStyle(section);
              return {
                left: Number.parseFloat(sectionStyle.borderLeftWidth),
                right: Number.parseFloat(sectionStyle.borderRightWidth),
                radius: Number.parseFloat(sectionStyle.borderTopLeftRadius),
                shadow: sectionStyle.boxShadow,
              };
            }),
            sectionOverflow: sections
              .map((section) => section.getBoundingClientRect())
              .filter((rect) => rect.left < -1 || rect.right > innerWidth + 1).length,
            rowOverflow: rows
              .map((row) => row.getBoundingClientRect())
              .filter((rect) => rect.left < -1 || rect.right > innerWidth + 1).length,
            horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
            viewport: innerWidth,
          };
        }, chapter);

        checked += 1;
        if (
          current.chapter !== chapter ||
          current.label !== label ||
          current.headIndex !== index ||
          !current.headHint ||
          !factPattern.test(current.headFact) ||
          !current.head ||
          current.head.count !== 1 ||
          current.head.chapter !== chapter ||
          !current.head.first ||
          current.head.legacyChapterHeads !== 0 ||
          current.head.columns.length !== (width >= 620 ? 3 : 2) ||
          current.head.boxOverflow ||
          (width >= 620 ? !current.head.factRightOfCopy : !current.head.factBelowCopy) ||
          !current.chapterVisible ||
          !current.folio ||
          current.folio.borderTop < 1 ||
          current.folio.borderBottom < 1 ||
          current.folio.borderLeft !== 0 ||
          current.folio.borderRight !== 0 ||
          current.folio.radius !== 0 ||
          current.folio.shadow !== "none"
        ) {
          failures.push(
            `[${width}-codex-${chapter}] 章首或开口长账没有统一落位:${JSON.stringify(current)}`,
          );
        }
        if (
          current.cardInk !== 0 ||
          current.sectionBorders.some(
            (section) =>
              section.left !== 0 ||
              section.right !== 0 ||
              section.radius !== 0 ||
              section.shadow !== "none",
          ) ||
          current.sectionOverflow !== 0 ||
          current.rowOverflow !== 0 ||
          current.horizontalOverflow
        ) {
          failures.push(
            `[${width}-codex-${chapter}] 账段或重复行又套回纸卡 / 挤出视口:${JSON.stringify(current)}`,
          );
        }

        const disclosure = disclosures[chapter];
        if (disclosure) {
          const button = page.locator(`[data-realm-disclosure="${disclosure}"]`).first();
          checked += 1;
          if ((await button.count()) === 0) {
            failures.push(`[${width}-codex-${chapter}] 展开键没有落位`);
          } else {
            const alreadyOpen = await button.getAttribute("aria-expanded");
            if (alreadyOpen !== "true") {
              await button.click({ timeout: 3000 }).catch(() => {});
            }
            await page.waitForTimeout(100);
            const expanded = await page.evaluate(() => {
              const rows = [
                ...document.querySelectorAll(
                  ".realm-hexagram-row, .realm-mansion-row, .realm-codex-disclosure",
                ),
              ].filter((row) => row.getClientRects().length > 0);
              return {
                expanded:
                  rows
                    .find((row) => row.matches(".realm-codex-disclosure"))
                    ?.getAttribute("aria-expanded") ?? null,
                rowOverflow: rows
                  .map((row) => row.getBoundingClientRect())
                  .filter((rect) => rect.left < -1 || rect.right > innerWidth + 1).length,
                horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
              };
            });
            if (
              expanded.expanded !== "true" ||
              expanded.rowOverflow !== 0 ||
              expanded.horizontalOverflow
            ) {
              failures.push(
                `[${width}-codex-${chapter}] 展开长表后挤出视口:${JSON.stringify(expanded)}`,
              );
            }
          }
        }

        if (SHOTS && (width === 390 || width === 1280)) {
          await page.evaluate(() => {
            window.scrollTo(0, 0);
            document.querySelector("main")?.scrollTo(0, 0);
          });
          await settleVisuals(page);
          await page.screenshot({
            path: join(SHOTS_DIR, `${width}-codex-${chapter}-chapter.png`),
          });
        }

        const problems = problemsOf(await measurePage(page));
        checked += 1;
        for (const problem of problems) {
          failures.push(`[${width}-codex-${chapter}] ${problem}`);
        }
      }
    }

    checked += 1;
    if (rendered === 0) {
      failures.push("[390-codex] 界域志没渲染出来,首屏判据没量到东西");
    } else {
      const fold = await page.evaluate(() => {
        const nav = document.querySelector("[data-folio-dock]")?.getBoundingClientRect();
        const hero = document.querySelector("[data-realm-current]");
        const heroRect = hero?.getBoundingClientRect();
        const name = (hero?.querySelector("[data-current-realm-name]")?.textContent || "")
          .replace(/\s+/g, " ")
          .trim();
        const worldPos = (hero?.querySelector("[data-current-world-position]")?.textContent || "")
          .replace(/\s+/g, " ")
          .trim();
        const toggles = [...document.querySelectorAll("[data-world-toggle]")];
        const readToggle = (btn) => {
          const bodyId = btn?.getAttribute("aria-controls") || "";
          const body = bodyId ? document.getElementById(bodyId) : null;
          return {
            state: btn?.getAttribute("data-world-state") ?? null,
            expanded: btn?.getAttribute("aria-expanded") ?? null,
            bodyVisible: Boolean(
              body &&
              getComputedStyle(body).display !== "none" &&
              body.getBoundingClientRect().height > 0,
            ),
            text: (body?.textContent || "").replace(/\s+/g, " ").trim(),
          };
        };
        const current = toggles.find((btn) => btn.getAttribute("data-world-state") === "current");
        const nonCurrent = toggles
          .filter((btn) => btn.getAttribute("data-world-state") !== "current")
          .map(readToggle);
        return {
          navTop: nav?.top ?? innerHeight,
          heroTop: heroRect?.top ?? null,
          heroBottom: heroRect?.bottom ?? null,
          name,
          worldPos,
          current: readToggle(current),
          nonCurrentOpen: nonCurrent.some((row) => row.expanded === "true" || row.bodyVisible),
        };
      });
      checked += 1;
      if (fold.heroTop === null || fold.heroBottom === null) {
        failures.push("[390-codex] 界域志首屏没有当前境卷首");
      } else if (fold.heroBottom > fold.navTop + 1) {
        failures.push(
          `[390-codex] 当前境卷首被推到折线以下(hero bottom ${Math.round(fold.heroBottom)} / nav top ${Math.round(fold.navTop)})`,
        );
      }
      if (!fold.name.includes("真仙") || !fold.worldPos.includes("仙界 1/5")) {
        failures.push(
          `[390-codex] 卷首没有报出当前境与界内序号(境「${fold.name}」/ 位置「${fold.worldPos}」)`,
        );
      }
      if (fold.current.expanded !== "true" || !fold.current.bodyVisible) {
        failures.push(
          `[390-codex] 当前界没有默认展开(aria-expanded=${fold.current.expanded}, visible=${fold.current.bodyVisible})`,
        );
      }
      if (fold.nonCurrentOpen) {
        failures.push("[390-codex] 非当前界默认没有收口,卷首又被长列表顶走");
      }

      const currentToggle = page.locator('[data-world-toggle][data-world-state="current"]').first();
      if ((await currentToggle.count()) === 0) {
        failures.push("[390-codex] 当前界没有卷目开关");
      } else {
        await currentToggle.click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(120);
        checked += 1;
        const collapsed = await page.evaluate(() => {
          const btn = document.querySelector('[data-world-toggle][data-world-state="current"]');
          const bodyId = btn?.getAttribute("aria-controls") || "";
          const body = bodyId ? document.getElementById(bodyId) : null;
          return {
            expanded: btn?.getAttribute("aria-expanded") ?? null,
            visible: Boolean(
              body &&
              getComputedStyle(body).display !== "none" &&
              body.getBoundingClientRect().height > 0,
            ),
          };
        });
        if (collapsed.expanded !== "false" || collapsed.visible) {
          failures.push(
            `[390-codex] 点当前界题头没有收卷(aria-expanded=${collapsed.expanded}, visible=${collapsed.visible})`,
          );
        }
      }

      const futureToggle = page.locator('[data-world-toggle][data-world-state="future"]').first();
      if ((await futureToggle.count()) === 0) {
        failures.push("[390-codex] 没有未至界可供展开");
      } else {
        await futureToggle.click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(120);
        checked += 1;
        const opened = await page.evaluate(() => {
          const btn = document.querySelector('[data-world-toggle][data-world-state="future"]');
          const bodyId = btn?.getAttribute("aria-controls") || "";
          const body = bodyId ? document.getElementById(bodyId) : null;
          return {
            expanded: btn?.getAttribute("aria-expanded") ?? null,
            visible: Boolean(
              body &&
              getComputedStyle(body).display !== "none" &&
              body.getBoundingClientRect().height > 0,
            ),
            text: (body?.textContent || "").replace(/\s+/g, " ").trim(),
          };
        });
        if (
          opened.expanded !== "true" ||
          !opened.visible ||
          !/神人/.test(opened.text) ||
          !/神帝/.test(opened.text)
        ) {
          failures.push("[390-codex] 未至界点开后没有铺出该界境界");
        }
      }

      await page.setViewportSize({ width: 1280, height: 800 });
      await settleVisuals(page);
      await realmCodexDeskSpread();
      await realmCodexChapterSheets(390);
      await realmCodexChapterSheets(195);
      await realmCodexChapterSheets(1280);
    }
    if (pageErrors.length)
      failures.push(`[390-codex] 界域志首屏页面异常:${[...new Set(pageErrors)].join(" | ")}`);
  } finally {
    await ctx.close();
  }
  return {
    failures,
    checked,
    contrastFails: [],
    pixelContrastFails: [],
    zoomFails: [],
  };
}

/** 成就谱首屏的眼下可追:先列最近三枚,方向卷目按需展开 */
async function taskAchievementFold() {
  const failures = [];
  let checked = 0;
  const ctx = await auditContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  try {
    const slices = showcaseSlices("light");
    slices.quests.counters = { kills: 48, explores: 9 };
    slices.quests.achieved = [
      "a_r0",
      "a_r1",
      "a_r2",
      "a_r3",
      "a_r4",
      "a_r5",
      "a_r6",
      "a_r7",
      "a_r8",
      "a_r9",
      "a_q4",
      "a_q6",
      "a_q7",
    ];
    await seedSave(ctx, slices, "__achievementFold");

    const page = await ctx.newPage();
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    const rendered = await openRoute(page, "/collection", 700);
    checked += 1;
    if (rendered === 0) {
      failures.push("[390-achievement] 藏珍与成就没渲染出来,首屏判据没量到东西");
    } else {
      const readGroups = () =>
        page.evaluate(() => {
          const nav = document.querySelector("[data-folio-dock]")?.getBoundingClientRect();
          const hero = document.querySelector("[data-achievement-hero]");
          const heroRect = hero?.getBoundingClientRect();
          const gates = document.querySelector(".collection-gates")?.getBoundingClientRect();
          const wall = document.querySelector(".achievement-wall");
          const wallRect = wall?.getBoundingClientRect();
          const volumesFact = (
            document.querySelector("[data-achievement-volumes] .folio-chapter-head__fact")
              ?.textContent ?? ""
          )
            .replace(/\s+/g, " ")
            .trim();
          const plaques = [
            ...(wall?.querySelectorAll("[data-achievement-group-toggle]") ?? []),
          ].map((btn) => {
            const rect = btn.getBoundingClientRect();
            return {
              text: (btn.textContent || "").replace(/\s+/g, " ").trim(),
              expanded: btn.getAttribute("aria-expanded") ?? null,
              top: Math.round(rect.top),
              left: Math.round(rect.left),
            };
          });
          const jumps = [...document.querySelectorAll("[data-achievement-jump]")].map((btn) => ({
            id: btn.getAttribute("data-achievement-jump") ?? "",
            direction: btn.getAttribute("data-achievement-jump-direction") ?? "",
            text: (btn.textContent || "").replace(/\s+/g, " ").trim(),
          }));
          const toggles = [...document.querySelectorAll("[data-achievement-group-toggle]")].map(
            (btn) => {
              const bodyId = btn.getAttribute("aria-controls") || "";
              const body = bodyId ? document.getElementById(bodyId) : null;
              return {
                direction: btn.getAttribute("data-achievement-group-toggle") ?? "",
                expanded: btn.getAttribute("aria-expanded") ?? null,
                bodyVisible: Boolean(
                  body &&
                  getComputedStyle(body).display !== "none" &&
                  body.getBoundingClientRect().height > 0,
                ),
                bodyText: (body?.textContent || "").replace(/\s+/g, " ").trim(),
                bodyIds: [...(body?.querySelectorAll("[data-achievement-id]") ?? [])].map(
                  (row) => row.getAttribute("data-achievement-id") ?? "",
                ),
              };
            },
          );
          const open = toggles.filter((row) => row.expanded === "true");
          return {
            navTop: nav?.top ?? innerHeight,
            heroTop: heroRect?.top ?? null,
            heroBottom: heroRect?.bottom ?? null,
            gatesTop: gates?.top ?? null,
            gatesBottom: gates?.bottom ?? null,
            wallTop: wallRect?.top ?? null,
            wallBottom: wallRect?.bottom ?? null,
            wallText: (wall?.textContent || "").replace(/\s+/g, " ").trim(),
            volumesFact,
            plaques,
            heroText: (hero?.textContent || "").replace(/\s+/g, " ").trim(),
            jumps,
            toggles,
            open,
          };
        });

      const fold = await readGroups();
      checked += 1;
      if (fold.heroTop === null || fold.heroBottom === null) {
        failures.push("[390-achievement] 首屏没有成就谱卷首");
      } else if (fold.heroBottom > fold.navTop + 1) {
        failures.push(
          `[390-achievement] 成就谱卷首被推到折线以下(hero bottom ${Math.round(fold.heroBottom)} / nav top ${Math.round(fold.navTop)})`,
        );
      }
      if (fold.gatesBottom === null || fold.gatesBottom > fold.heroTop + 1) {
        failures.push("[390-achievement] 双阁门没有接在功名状卷首之前");
      }
      if (
        fold.plaques.length < 10 ||
        new Set(fold.plaques.map((row) => row.text)).size !== fold.plaques.length ||
        fold.plaques.some((row) => !/\d+\s*\/\s*\d+/.test(row.text)) ||
        !fold.volumesFact.includes(`/${ACHIEVEMENTS.length}`)
      ) {
        failures.push(
          `[390-achievement] 方向没有收成可读榜牌(«${fold.wallText}» / ${fold.plaques.length} 枚)`,
        );
      }
      if (fold.jumps.length !== 3) {
        failures.push(`[390-achievement] 眼下可追应列 3 枚,实见 ${fold.jumps.length} 枚`);
      }
      if (!fold.heroText.includes("初试锋芒") || !fold.heroText.includes("48 / 50")) {
        failures.push("[390-achievement] 卷首没有把最近成就的名称与真实进度摊开");
      }
      if (fold.open.length !== 1 || !fold.open[0]?.bodyVisible) {
        failures.push(
          `[390-achievement] 方向卷目应默认只开一路(open=${fold.open.length}, visible=${fold.open[0]?.bodyVisible})`,
        );
      }
      if (
        !fold.open[0]?.bodyText.includes("击败 50 个敌人") ||
        fold.open[0]?.bodyText.includes("???")
      ) {
        failures.push("[390-achievement] 默认展开的成就行没有直接写明条件,仍在用「???」遮名");
      }

      const currentDirection = fold.open[0]?.direction ?? "";
      const jump = fold.jumps.find((row) => row.direction && row.direction !== currentDirection);
      if (!jump) {
        failures.push("[390-achievement] 眼下可追没有跨方向的目标可供验证");
      } else {
        await page
          .locator(`[data-achievement-jump="${jump.id}"]`)
          .click({ timeout: 3000 })
          .catch(() => {});
        await page.waitForTimeout(350);
        checked += 1;
        const jumped = await readGroups();
        const open = jumped.open[0];
        if (
          jumped.open.length !== 1 ||
          open?.direction !== jump.direction ||
          !open?.bodyVisible ||
          !open.bodyIds.includes(jump.id)
        ) {
          failures.push(
            `[390-achievement] 点「${jump.id}」没有展开目标方向卷目` +
              `(期望 ${jump.direction},实见 ${open?.direction ?? "无"})`,
          );
        }
      }

      const openToggle = page
        .locator('[data-achievement-group-toggle][aria-expanded="true"]')
        .first();
      if ((await openToggle.count()) === 0) {
        failures.push("[390-achievement] 当前没有可收起的成就卷目");
      } else {
        await openToggle.click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(120);
        checked += 1;
        const collapsed = await readGroups();
        if (collapsed.open.length !== 0) {
          failures.push("[390-achievement] 点开着的方向题头没有收卷");
        }
      }

      const closedToggle = page
        .locator('[data-achievement-group-toggle][aria-expanded="false"]')
        .first();
      if ((await closedToggle.count()) === 0) {
        failures.push("[390-achievement] 没有收着的方向卷目可供换开");
      } else {
        await closedToggle.click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(120);
        checked += 1;
        const reopened = await readGroups();
        if (reopened.open.length !== 1 || !reopened.open[0]?.bodyVisible) {
          failures.push("[390-achievement] 点收着的方向题头没有铺出该方向成就");
        }
      }
    }
    if (pageErrors.length)
      failures.push(`[390-achievement] 成就谱首屏页面异常:${[...new Set(pageErrors)].join(" | ")}`);
  } finally {
    await ctx.close();
  }
  return {
    failures,
    checked,
    contrastFails: [],
    pixelContrastFails: [],
    zoomFails: [],
  };
}

/** 藏珍双阁的换柜与换榜:只开当前一屉,柜面读数与目标正文同步换口 */
async function taskCollectionFold() {
  const failures = [];
  let checked = 0;
  const ctx = await auditContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  try {
    const slices = showcaseSlices("light");
    // 展品档丹匣里的药会在启动时补收进丹方录;本判据自己造四册新得,
    // 故清空丹匣并标认知已播种,避免启动自愈再造出第五册。
    slices.inventory.pills = {};
    slices.lore = { seeded: true };
    const now = Date.now();
    const equip = [EQUIPMENT_TEMPLATES[0].id];
    const gongfa = [GONGFA[0].id, GONGFA[1].id];
    const pet = [PETS[0].id];
    const event = [EVENTS[0].id];
    const freshEntryText = new Map([
      ["equip", EQUIPMENT_TEMPLATES[0].name],
      ["gongfa", GONGFA[0].name],
      ["pet", PETS[0].name],
      ["event", EVENTS[0].title],
    ]);
    slices.quests.lastCollectionViewAt = now - 60_000;
    slices.quests.collections = {
      ...slices.quests.collections,
      equip,
      gongfa,
      pet,
      event,
    };
    slices.quests.collectedAt = {
      [`equip:${equip[0]}`]: now,
      [`gongfa:${gongfa[0]}`]: now,
      [`gongfa:${gongfa[1]}`]: now,
      [`pet:${pet[0]}`]: now,
      [`event:${event[0]}`]: now,
    };
    await seedSave(ctx, slices, "__collectionFold");

    const page = await ctx.newPage();
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    const rendered = await openRoute(page, "/collection", 700);
    checked += 1;
    if (rendered === 0) {
      failures.push("[390-collection] 藏珍与成就没渲染出来,首屏判据没量到东西");
    } else {
      const tab = page.getByRole("tab", { name: "收藏" });
      if ((await tab.count()) === 0) {
        failures.push("[390-collection] 收藏页签不存在");
      } else {
        await tab.click({ timeout: 3000 });
        await page.waitForTimeout(250);
      }

      const read = () =>
        page.evaluate(() => {
          const nav = document.querySelector("[data-folio-dock]")?.getBoundingClientRect();
          const hero = document.querySelector("[data-collection-hero]");
          const heroRect = hero?.getBoundingClientRect();
          const gates = document.querySelector(".collection-gates")?.getBoundingClientRect();
          const cabinet = document.querySelector("[data-collection-cabinet]");
          const cabinetRect = cabinet?.getBoundingClientRect();
          const cabinetCells = [
            ...(cabinet?.querySelectorAll(".collection-cabinet__drawer") ?? []),
          ].map((cell) => {
            const rect = cell.getBoundingClientRect();
            return {
              text: (cell.textContent || "").replace(/\s+/g, " ").trim(),
              top: Math.round(rect.top),
              left: Math.round(rect.left),
            };
          });
          const toggles = [...document.querySelectorAll("[data-collection-category-toggle]")].map(
            (btn) => {
              const key = btn.getAttribute("data-collection-category-toggle") ?? "";
              const bodyId = btn.getAttribute("aria-controls") || "";
              const body = bodyId ? document.getElementById(bodyId) : null;
              return {
                key,
                expanded: btn.getAttribute("aria-expanded") ?? null,
                bodyExists: Boolean(body),
                bodyVisible: Boolean(
                  body &&
                  getComputedStyle(body).display !== "none" &&
                  body.getBoundingClientRect().height > 0,
                ),
                bodyText: (body?.textContent || "").replace(/\s+/g, " ").trim(),
              };
            },
          );
          return {
            navTop: nav?.top ?? innerHeight,
            heroTop: heroRect?.top ?? null,
            heroBottom: heroRect?.bottom ?? null,
            gatesBottom: gates?.bottom ?? null,
            cabinetTop: cabinetRect?.top ?? null,
            cabinetBottom: cabinetRect?.bottom ?? null,
            cabinetInHero: Boolean(cabinet && hero?.contains(cabinet)),
            cabinetText: (cabinet?.textContent || "").replace(/\s+/g, " ").trim(),
            cabinetCells,
            heroText: (hero?.textContent || "").replace(/\s+/g, " ").trim(),
            toggles,
          };
        });

      const fold = await read();
      checked += 1;
      if (fold.heroTop === null || fold.heroBottom === null) {
        failures.push("[390-collection] 首屏没有藏珍谱卷首");
      } else if (fold.heroBottom > fold.navTop + 1) {
        failures.push(
          `[390-collection] 藏珍谱卷首被推到折线以下(hero bottom ${Math.round(fold.heroBottom)} / nav top ${Math.round(fold.navTop)})`,
        );
      }
      if (
        fold.cabinetTop === null ||
        fold.cabinetBottom === null ||
        fold.gatesBottom === null ||
        fold.cabinetTop < fold.gatesBottom - 1 ||
        !fold.cabinetInHero ||
        fold.cabinetBottom > fold.navTop + 1
      ) {
        failures.push("[390-collection] 九柜没有紧随双阁门并完整落在首屏");
      }
      if (
        fold.cabinetCells.length !== 9 ||
        new Set(fold.cabinetCells.map((cell) => cell.top)).size !== 3 ||
        !/珍\s*\d+\s*\/\s*\d+/.test(fold.cabinetText)
      ) {
        failures.push(
          `[390-collection] 九柜没有排成三列柜架(«${fold.cabinetText}» / ${fold.cabinetCells.length} 格)`,
        );
      }
      if (
        !fold.heroText.includes("藏珍阁") ||
        !fold.heroText.includes("眼下新得") ||
        !fold.heroText.includes("4 柜有新得") ||
        !fold.heroText.includes("5 枚待看")
      ) {
        failures.push(`[390-collection] 卷首没有把整体进度与新得数摊开(«${fold.heroText}»)`);
      }
      if (fold.toggles.length !== 9) {
        failures.push(`[390-collection] 应列九册,实见 ${fold.toggles.length} 册`);
      }
      if (fold.toggles.some((row) => !row.bodyExists)) {
        failures.push("[390-collection] 册目的 aria-controls 指向了不存在的区域");
      }
      const openRows = fold.toggles.filter((row) => row.expanded === "true");
      if (openRows.length !== 1 || fold.toggles.filter((row) => row.bodyVisible).length !== 1) {
        failures.push(
          `[390-collection] 九柜应只抽开一屉(open=${openRows.map((row) => row.key).join(",") || "无"})`,
        );
      }
      const defaultOpen = openRows[0];
      if (
        !defaultOpen ||
        !defaultOpen.bodyText.includes(freshEntryText.get(defaultOpen.key) ?? "")
      ) {
        failures.push("[390-collection] 默认柜屉没有铺出新得最多的那一册");
      }
      if (!fold.cabinetText.includes("新 2")) {
        failures.push(`[390-collection] 柜面没有报出新得数(«${fold.cabinetText}»)`);
      }

      await page
        .locator('[data-collection-category-toggle="pet"]')
        .click({ timeout: 3000 })
        .catch(() => {});
      await page.waitForTimeout(180);
      checked += 1;
      const petFold = await read();
      const petToggle = petFold.toggles.find((row) => row.key === "pet");
      if (
        petToggle?.expanded !== "true" ||
        !petToggle.bodyVisible ||
        petFold.toggles.filter((row) => row.bodyVisible).length !== 1 ||
        !petToggle.bodyText.includes(PETS[0].name)
      ) {
        failures.push("[390-collection] 点另一柜没有换开对应柜屉");
      }

      await page
        .locator('[data-collection-category-toggle="equip"]')
        .click({ timeout: 3000 })
        .catch(() => {});
      await page.waitForTimeout(180);
      checked += 1;
      const reopened = await read();
      const equipToggle = reopened.toggles.find((row) => row.key === "equip");
      if (
        equipToggle?.expanded !== "true" ||
        !equipToggle.bodyVisible ||
        reopened.toggles.find((row) => row.key === "pet")?.bodyVisible
      ) {
        failures.push("[390-collection] 换柜后旧抽屉没有合上");
      }
    }
    if (pageErrors.length)
      failures.push(`[390-collection] 藏珍谱首屏页面异常:${[...new Set(pageErrors)].join(" | ")}`);
  } finally {
    await ctx.close();
  }
  return {
    failures,
    checked,
    contrastFails: [],
    pixelContrastFails: [],
    zoomFails: [],
  };
}

/**
 * 藏珍两章续卷 —— 总印、行动章与卷目章同住一张开口纸面。
 *
 * 390 与 620 单列续读，1280 才让行动章与卷目章左右并读，195（200% 缩放）
 * 把章内读数退到章名下方。两页签都要量同一套章号、章名、事实源与册目落点。
 */
async function taskCollectionRegister() {
  const failures = [];
  let checked = 0;
  const ctx = await auditContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  try {
    const slices = showcaseSlices("light");
    slices.quests.counters = { kills: 48, explores: 9 };
    await seedSave(ctx, slices, "__collectionRegister");

    const page = await ctx.newPage();
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    const rendered = await openRoute(page, "/collection", 700);
    checked += 1;
    if (rendered === 0) {
      failures.push("[collection-register] 藏珍页没有渲染，两章续卷无从量起");
      return {
        failures,
        checked,
        contrastFails: [],
        pixelContrastFails: [],
        zoomFails: [],
      };
    }

    const read = () =>
      page.evaluate(() => {
        const box = (el) => {
          if (!el) return null;
          const rect = el.getBoundingClientRect();
          return {
            top: Math.round(rect.top),
            right: Math.round(rect.right),
            bottom: Math.round(rect.bottom),
            left: Math.round(rect.left),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            scrollWidth: el.scrollWidth,
            clientWidth: el.clientWidth,
          };
        };
        const register = document.querySelector("[data-collection-register]");
        const registerStyle = register ? getComputedStyle(register) : null;
        const chapters = [...document.querySelectorAll("[data-collection-chapter]")].map(
          (chapter) => {
            const style = getComputedStyle(chapter);
            const head = chapter.querySelector("[data-folio-chapter-head]");
            return {
              key: chapter.getAttribute("data-collection-chapter") || "",
              title: head?.querySelector(".folio-chapter-head__title")?.textContent?.trim() || "",
              index: head?.querySelector(".folio-chapter-head__index")?.textContent?.trim() || "",
              fact: head?.querySelector(".folio-chapter-head__fact")?.textContent?.trim() || "",
              hasHead: Boolean(head),
              borderWidths: [
                style.borderTopWidth,
                style.borderRightWidth,
                style.borderBottomWidth,
                style.borderLeftWidth,
              ].map((width) => Number.parseFloat(width)),
              radius: Number.parseFloat(style.borderTopLeftRadius),
              shadow: style.boxShadow,
              background: style.backgroundColor,
              rect: box(chapter),
            };
          },
        );
        const firstHead = chapters[0]
          ? document.querySelectorAll("[data-folio-chapter-head]")[0]
          : null;
        const firstTitle = firstHead?.querySelector(".folio-chapter-head__title");
        const firstFact = firstHead?.querySelector(".folio-chapter-head__fact");
        const firstTail = firstFact?.closest(".folio-chapter-head__tail");
        const targets = document.querySelector(".achievement-briefing__targets");
        return {
          viewport: { width: window.innerWidth, height: window.innerHeight },
          register: registerStyle
            ? {
                borderTop: Number.parseFloat(registerStyle.borderTopWidth),
                borderRight: Number.parseFloat(registerStyle.borderRightWidth),
                borderBottom: Number.parseFloat(registerStyle.borderBottomWidth),
                borderLeft: Number.parseFloat(registerStyle.borderLeftWidth),
                radius: Number.parseFloat(registerStyle.borderTopLeftRadius),
                shadow: registerStyle.boxShadow,
                columns: registerStyle.gridTemplateColumns.split(/\s+/).filter(Boolean).length,
                rect: box(register),
                cardShells: register?.querySelectorAll(".card-ink").length ?? 0,
              }
            : null,
          chapters,
          cabinetInLead: Boolean(
            document
              .querySelector('[data-collection-chapter="lead"]')
              ?.contains(document.querySelector("[data-collection-cabinet]")),
          ),
          categories: document.querySelectorAll("[data-collection-category]").length,
          targetColumns: targets
            ? getComputedStyle(targets).gridTemplateColumns.split(/\s+/).filter(Boolean).length
            : 0,
          factColumn: firstTail ? getComputedStyle(firstTail).gridColumnStart : "",
          titleTop: firstTitle ? Math.round(firstTitle.getBoundingClientRect().top) : null,
          factTop: firstFact ? Math.round(firstFact.getBoundingClientRect().top) : null,
          documentOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        };
      });

    const assertRegister = async (label, expected) => {
      const layout = await read();
      checked += 1;
      const chapterKeys = layout.chapters.map((chapter) => chapter.key).join(",");
      const chapterIndices = layout.chapters.map((chapter) => chapter.index).join(",");
      const brokenChapters = layout.chapters.filter(
        (chapter) =>
          !chapter.hasHead ||
          chapter.radius !== 0 ||
          chapter.shadow !== "none" ||
          chapter.background !== "rgba(0, 0, 0, 0)" ||
          chapter.borderWidths.every((width) => width > 0),
      );
      const registerOk =
        layout.register &&
        layout.register.borderTop >= 1 &&
        layout.register.borderBottom >= 1 &&
        layout.register.borderLeft === 0 &&
        layout.register.borderRight === 0 &&
        layout.register.radius === 0 &&
        layout.register.shadow === "none" &&
        layout.register.cardShells === 0 &&
        layout.register.rect.left >= -1 &&
        layout.register.rect.right <= layout.viewport.width + 1 &&
        layout.register.rect.scrollWidth <= layout.register.rect.clientWidth + 1;
      const oneColumn =
        layout.chapters.length === 2 &&
        layout.chapters[0].rect.bottom <= layout.chapters[1].rect.top + 1;
      const twoColumns =
        layout.chapters.length === 2 &&
        Math.abs(layout.chapters[0].rect.top - layout.chapters[1].rect.top) <= 2 &&
        layout.chapters[0].rect.right <= layout.chapters[1].rect.left + 1;
      const columnOk = expected.columns === 2 ? twoColumns : oneColumn;
      const leadTitleOk = Array.isArray(expected.leadTitle)
        ? expected.leadTitle.includes(layout.chapters[0]?.title)
        : layout.chapters[0]?.title === expected.leadTitle;
      const volumesTitleOk = Array.isArray(expected.volumesTitle)
        ? expected.volumesTitle.includes(layout.chapters[1]?.title)
        : layout.chapters[1]?.title === expected.volumesTitle;
      const titlesOk =
        leadTitleOk &&
        volumesTitleOk &&
        chapterIndices === "壹,贰" &&
        layout.chapters.every((chapter) => chapter.fact);
      const cabinetOk = layout.cabinetInLead === (expected.cabinetInLead ?? true);
      const factOk =
        expected.factBelowTitle !== true ||
        (layout.titleTop !== null &&
          layout.factTop !== null &&
          layout.factTop >= layout.titleTop &&
          layout.factColumn === "2");
      if (
        chapterKeys !== "lead,volumes" ||
        !cabinetOk ||
        !titlesOk ||
        !columnOk ||
        !registerOk ||
        brokenChapters.length > 0 ||
        layout.documentOverflow ||
        !factOk
      ) {
        failures.push(
          `[${label}] 藏珍两章没有收成一册:` +
            `章=${chapterKeys} / 章号=${chapterIndices} / ` +
            `章名=${JSON.stringify(layout.chapters.map((chapter) => chapter.title))} / ` +
            `总印在行动章=${layout.cabinetInLead} / 列=${layout.register?.columns ?? "-"} ` +
            `期望 ${expected.columns} / 单列=${oneColumn} / 双列=${twoColumns} / ` +
            `章内读数下移=${factOk} / 横向溢出=${layout.documentOverflow} / ` +
            `散章=${JSON.stringify(brokenChapters)} / 续卷=${JSON.stringify(layout.register)}`,
        );
      }
      return layout;
    };

    await page.setViewportSize({ width: 390, height: 844 });
    await settleVisuals(page);
    const fold = await assertRegister("390", {
      columns: 1,
      leadTitle: "眼下可追",
      volumesTitle: "功名榜",
      cabinetInLead: false,
    });
    checked += 1;
    if (fold.targetColumns !== 1) {
      failures.push(`[390] 眼下可追应单列,实见 ${fold.targetColumns} 列`);
    }
    if (SHOTS) {
      mkdirSync(SHOTS_DIR, { recursive: true });
      await page.screenshot({
        path: join(SHOTS_DIR, "390_collection-register.png"),
        fullPage: true,
      });
    }

    await page.getByRole("tab", { name: "收藏" }).click({ timeout: 3000 });
    await settleVisuals(page);
    const collectionFold = await assertRegister("390-收藏", {
      columns: 1,
      leadTitle: ["眼下新得", "将满之册", "九册尽收", "九册待启"],
      volumesTitle: [
        "装备图鉴",
        "功法阁",
        "悟道录",
        "丹方录",
        "灵材谱",
        "法宝谱",
        "灵兽册",
        "见闻志",
        "天赋鉴",
      ],
      cabinetInLead: true,
    });
    checked += 1;
    if (collectionFold.categories !== 9) {
      failures.push(`[390-收藏] 九册藏珍应列 9 册,实见 ${collectionFold.categories} 册`);
    }
    if (SHOTS) {
      await page.screenshot({
        path: join(SHOTS_DIR, "390_collection-register-collection.png"),
        fullPage: true,
      });
    }

    await page.getByRole("tab", { name: "成就" }).click({ timeout: 3000 });
    await settleVisuals(page);
    await page.setViewportSize({ width: 620, height: 900 });
    await settleVisuals(page);
    const tablet = await assertRegister("620", {
      columns: 1,
      leadTitle: "眼下可追",
      volumesTitle: "功名榜",
      cabinetInLead: false,
    });
    checked += 1;
    if (tablet.targetColumns !== 3) {
      failures.push(`[620] 眼下可追应三枚并读,实见 ${tablet.targetColumns} 列`);
    }
    if (SHOTS) {
      await page.screenshot({
        path: join(SHOTS_DIR, "620_collection-register.png"),
        fullPage: true,
      });
    }

    await page.setViewportSize({ width: 1280, height: 900 });
    await settleVisuals(page);
    await assertRegister("1280", {
      columns: 2,
      leadTitle: "眼下可追",
      volumesTitle: "功名榜",
      cabinetInLead: false,
    });
    if (SHOTS) {
      await page.screenshot({
        path: join(SHOTS_DIR, "1280_collection-register.png"),
        fullPage: true,
      });
    }

    await page.setViewportSize({ width: 195, height: 422 });
    await settleVisuals(page);
    await assertRegister("195", {
      columns: 1,
      leadTitle: "眼下可追",
      volumesTitle: "功名榜",
      cabinetInLead: false,
      factBelowTitle: true,
    });
    if (SHOTS) {
      await page.screenshot({
        path: join(SHOTS_DIR, "195_collection-register.png"),
        fullPage: true,
      });
    }

    if (pageErrors.length) {
      failures.push(
        `[collection-register] 藏珍两章场景页面异常:${[...new Set(pageErrors)].join(" | ")}`,
      );
    }
  } finally {
    await ctx.close();
  }
  return {
    failures,
    checked,
    contrastFails: [],
    pixelContrastFails: [],
    zoomFails: [],
  };
}

/**
 * 前尘山河 —— 跨世历史在 320 与 195 宽下必须真的画得出来。
 *
 * 空档与后期档都只有当前这一世,`data-world-history` 永远不会出现;历史行里的
 * 世界名、段数、摘要与三条气象又比普通列表长,最容易在 195 宽被挤成竖排或截断。
 * 夹具用真实生成器造三世旧世界,再从近到远核对顺序与字段,最后把整页交给
 * measurePage —— 历史册不许成为一块“只在 390 截图中看过”的孤岛。
 */
async function taskWorldHistory() {
  const failures = [];
  let checked = 0;
  const ctx = await auditContext({
    viewport: { width: 320, height: 568 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  let vite = null;
  try {
    vite = await createViteServer({
      root: ROOT,
      server: { middlewareMode: true },
      appType: "custom",
      logLevel: "silent",
    });
    const fixtureModule = await vite.ssrLoadModule("/scripts/lib/worldHistoryFixture.ts");
    const fixture = fixtureModule.makeWorldHistoryFixture();
    const slices = showcaseSlices("light");
    slices.adventure = {
      mortalWorld: fixture.mortalWorld,
      mortalWorldHistory: fixture.mortalWorldHistory,
      mortalBiasHistory: fixture.mortalBiasHistory,
      // 旧链全开的老存档:世界页的出发钮必须与历练守卫同源,不能把中段只画成锁。
      unlocked: fixture.mortalWorld.chain.map((place) => place.fromId),
    };
    await seedSave(ctx, slices, "__worldHistoryFixture");

    const page = await ctx.newPage();
    await page.addInitScript(() => {
      Math.random = () => 1;
    });
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    const rendered = await openRoute(page, "/world", 700);
    checked += 1;
    if (rendered === 0) {
      failures.push("[320] 前尘山河场景:世界页没渲染出来");
    }
    const routeAccess = await page.evaluate(() => {
      const rows = [...document.querySelectorAll("[data-stage-can-depart]")];
      return {
        total: rows.length,
        departable: rows.filter((row) => row.getAttribute("data-stage-can-depart") === "true")
          .length,
        oldRoad: rows.some((row) => (row.textContent || "").includes("旧路可往")),
      };
    });
    checked += 1;
    if (routeAccess.total !== fixture.mortalWorld.chain.length) {
      failures.push(
        `[320] 本世地界应有 ${fixture.mortalWorld.chain.length} 段,实见 ${routeAccess.total} 段`,
      );
    }
    if (routeAccess.departable !== fixture.mortalWorld.chain.length) {
      failures.push(
        `[320] 旧链全开时本世地界应有 ${fixture.mortalWorld.chain.length} 段可出发,` +
          `实见 ${routeAccess.departable} 段`,
      );
    }
    if (!routeAccess.oldRoad) {
      failures.push("[320] 旧链已开的中段没有标出「旧路可往」");
    }
    const historyReady = await page
      .locator("[data-world-history]")
      .waitFor({ state: "visible", timeout: 10000 })
      .then(() => true)
      .catch(() => false);
    checked += 1;
    if (!historyReady) {
      failures.push("[320] 前尘山河场景:历史册没出现(夹具的三世旧世界没被读出来?)");
    } else {
      for (const [width, height, tag] of [
        [320, 568, "320"],
        [195, 422, "195·200%"],
      ]) {
        await page.setViewportSize({ width, height });
        await settleVisuals(page);
        const info = await measurePage(page);
        checked += 1;
        const problems = problemsOf(info);
        if (problems.length) failures.push(`[${tag}] /world → ${problems.join(" / ")}`);

        const history = await page.evaluate(() => {
          const box = document.querySelector("[data-world-history]");
          if (!box) return null;
          const rows = [...box.querySelectorAll("[data-world-history-row]")];
          const boxRect = box.getBoundingClientRect();
          return {
            count: rows.length,
            box: {
              left: boxRect.left,
              right: boxRect.right,
              width: boxRect.width,
              scrollWidth: box.scrollWidth,
              clientWidth: box.clientWidth,
            },
            rows: rows.map((row) => {
              const rect = row.getBoundingClientRect();
              const label = row.querySelector("[data-world-history-label]");
              const title = row.querySelector("[data-world-history-title]");
              const stages = row.querySelector("[data-world-history-stages]");
              const titleRect = title?.getBoundingClientRect();
              return {
                label: (label?.textContent || "").trim(),
                title: (title?.textContent || "").trim(),
                stages: (stages?.textContent || "").trim(),
                text: (row.innerText || "").replace(/\s+/g, " ").trim(),
                left: rect.left,
                right: rect.right,
                width: rect.width,
                scrollWidth: row.scrollWidth,
                clientWidth: row.clientWidth,
                titleWidth: titleRect?.width ?? 0,
                titleScrollWidth: title?.scrollWidth ?? 0,
                titleClientWidth: title?.clientWidth ?? 0,
              };
            }),
          };
        });
        checked += 1;
        if (!history) {
          failures.push(`[${tag}] 前尘山河场景:历史册在量测时消失了`);
          continue;
        }
        if (history.count !== fixture.expectedRows.length) {
          failures.push(
            `[${tag}] 前尘山河应有 ${fixture.expectedRows.length} 世,实见 ${history.count} 世`,
          );
        }
        if (history.box.scrollWidth > history.box.clientWidth + 1) {
          failures.push(
            `[${tag}] 前尘山河册横向裁切:${history.box.scrollWidth}>${history.box.clientWidth}`,
          );
        }
        for (let i = 0; i < Math.min(history.rows.length, fixture.expectedRows.length); i += 1) {
          const row = history.rows[i];
          const expected = fixture.expectedRows[i];
          const expectedLabel = `前${["一", "二", "三"][i]}世`;
          if (row.label !== expectedLabel) {
            failures.push(
              `[${tag}] 前尘山河第 ${i + 1} 行世序是「${row.label}」,应为「${expectedLabel}」`,
            );
          }
          if (row.title !== expected.title) {
            failures.push(
              `[${tag}] 前尘山河第 ${i + 1} 行世界名「${row.title}」,应为「${expected.title}」`,
            );
          }
          if (row.stages !== `${expected.stages} 段`) {
            failures.push(
              `[${tag}] 前尘山河第 ${i + 1} 行段数是「${row.stages}」,应为 ${expected.stages} 段`,
            );
          }
          if (
            row.left < history.box.left - 1 ||
            row.right > history.box.right + 1 ||
            row.scrollWidth > row.clientWidth + 1
          ) {
            failures.push(
              `[${tag}] 前尘山河第 ${i + 1} 行越出册面:` +
                `${Math.round(row.left)}..${Math.round(row.right)} / ` +
                `册 ${Math.round(history.box.left)}..${Math.round(history.box.right)} / ` +
                `内容 ${row.scrollWidth}>${row.clientWidth}`,
            );
          }
          if (
            row.titleWidth < 40 ||
            row.titleScrollWidth > row.titleClientWidth + 1 ||
            !row.text ||
            /NaN|undefined/.test(row.text)
          ) {
            failures.push(
              `[${tag}] 前尘山河第 ${i + 1} 行文字被挤坏:` +
                `标题 ${Math.round(row.titleWidth)}px / 内容 ${row.titleScrollWidth}>` +
                `${row.titleClientWidth} / «${row.text.slice(0, 48)}»`,
            );
          }
        }
      }
    }
    if (pageErrors.length)
      failures.push(`[320] 前尘山河场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
  } finally {
    await ctx.close();
    await vite?.close();
  }
  return { failures, checked, contrastFails: [], pixelContrastFails: [], zoomFails: [] };
}

/**
 * 本世山河案 —— 卷首世界身份、全图与路线账必须是一张连续的账。
 *
 * 旧页的卷首三格、行旅图、地界卡与前尘册各自成卡，首屏几乎只剩世界名和地图。
 * 这里用普通展品档核对卷首山图、三项总账、换界说明与路线行是否同时落位，
 * 再把 390 / 320 / 195（200% 缩放）三档交给同一把排版尺子。
 */
async function taskWorldDesk() {
  const failures = [];
  const zoomFails = [];
  let checked = 0;
  const ctx = await auditContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  try {
    await seedSave(ctx, showcaseSlices("light"), "__worldDeskFixture");

    const page = await ctx.newPage();
    await page.addInitScript(() => {
      Math.random = () => 1;
    });
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    const rendered = await openRoute(page, "/world", 700);
    checked += 1;
    if (rendered === 0) {
      failures.push("[390] /world 本世山河案没渲染出来,首屏判据没量到东西");
    }

    const deskVisible = await page
      .locator("[data-world-desk]")
      .waitFor({ state: "visible", timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    checked += 1;
    if (!deskVisible) {
      failures.push("[390] /world 本世山河案没有渲染出来");
    } else {
      const desk = await page.evaluate(() => {
        const text = (selector) =>
          (document.querySelector(selector)?.innerText || "").replace(/\s+/g, " ").trim();
        const root = document.querySelector("[data-world-desk]");
        const current = document.querySelector("[data-world-current]");
        const currentRect = current?.getBoundingClientRect();
        const rootStyle = root ? getComputedStyle(root) : null;
        const rootBefore = root ? getComputedStyle(root, "::before") : null;
        const routeMap = document.querySelector("[data-world-route-map]");
        const routeMapBefore = routeMap ? getComputedStyle(routeMap, "::before") : null;
        return {
          shapeRows: document.querySelectorAll("[data-world-shape] > span").length,
          atlasHidden: document.querySelector("[data-world-atlas]")?.getAttribute("aria-hidden"),
          routeMap: !!routeMap,
          stages: document.querySelectorAll("[data-stage-index]").length,
          currentRows: document.querySelectorAll("[data-world-current]").length,
          currentText: (current?.innerText || "").replace(/\s+/g, " ").trim(),
          currentTop: currentRect?.top ?? 0,
          reroll: text("[data-world-reroll]"),
          rerollNote: text(".world-masthead__reroll p"),
          body: (root?.innerText || "").replace(/\s+/g, " ").trim(),
          viewportHeight: window.innerHeight,
          chrome: rootStyle
            ? {
                borderTop: Number.parseFloat(rootStyle.borderTopWidth),
                borderRight: Number.parseFloat(rootStyle.borderRightWidth),
                borderBottom: Number.parseFloat(rootStyle.borderBottomWidth),
                borderLeft: Number.parseFloat(rootStyle.borderLeftWidth),
                radius: Number.parseFloat(rootStyle.borderTopLeftRadius),
                shadow: rootStyle.boxShadow,
                background: rootStyle.backgroundColor,
                beforeContent: rootBefore?.content ?? "",
                beforeBorderTop: Number.parseFloat(rootBefore?.borderTopWidth ?? "0"),
                mapBeforeContent: routeMapBefore?.content ?? "",
                mapBeforeBorderTop: Number.parseFloat(routeMapBefore?.borderTopWidth ?? "0"),
              }
            : null,
        };
      });

      if (desk.shapeRows !== 3) {
        failures.push(`[390] 本世山河案卷首应有地界 / 层级 / 已行三项,实见 ${desk.shapeRows} 项`);
      }
      if (desk.atlasHidden !== "true") {
        failures.push("[390] 本世山河案的卷首山图没有对读屏隐藏");
      }
      if (!desk.routeMap) {
        failures.push("[390] 本世山河案缺少行旅全图");
      }
      if (desk.stages <= 0) {
        failures.push("[390] 本世山河案没有列出任何地界");
      }
      if (desk.currentRows !== 1) {
        failures.push(`[390] 本世山河案应恰有 1 段眼下路线,实见 ${desk.currentRows} 段`);
      }
      if (!desk.currentText.includes("眼下可往")) {
        failures.push(`[390] 眼下路线没有标出「眼下可往」:«${desk.currentText}»`);
      }
      if (!desk.reroll.includes("道果") || !desk.rerollNote.includes("换界即换路")) {
        failures.push("[390] 换界按钮或换路代价说明不齐");
      }
      if (/NaN|undefined|Infinity/.test(desk.body)) {
        failures.push(`[390] 本世山河案漏出占位符:«${desk.body.slice(0, 120)}»`);
      }
      if (desk.currentTop <= 0 || desk.currentTop >= desk.viewportHeight) {
        failures.push(
          `[390] 眼下路线首屏不可见:top ${Math.round(desk.currentTop)} / viewport ${desk.viewportHeight}`,
        );
      }
      if (
        !desk.chrome ||
        desk.chrome.borderTop < 1 ||
        desk.chrome.borderBottom < 1 ||
        desk.chrome.borderLeft !== 0 ||
        desk.chrome.borderRight !== 0 ||
        desk.chrome.radius !== 0 ||
        desk.chrome.shadow !== "none" ||
        desk.chrome.background !== "rgba(0, 0, 0, 0)" ||
        desk.chrome.beforeContent !== "none" ||
        desk.chrome.beforeBorderTop !== 0 ||
        desk.chrome.mapBeforeContent !== "none" ||
        desk.chrome.mapBeforeBorderTop !== 0
      ) {
        failures.push(`[390] 本世山河案又套回四边卡或内框:${JSON.stringify(desk.chrome)}`);
      }
    }

    await clearOverlays(page);
    for (const [width, height, tag] of [
      [390, 844, "390"],
      [320, 568, "320"],
      [195, 422, "195·200%"],
    ]) {
      await page.setViewportSize({ width, height });
      await settleVisuals(page);
      const problems = problemsOf(await measurePage(page));
      checked += 1;
      if (problems.length) failures.push(`[${tag}] /world 本世山河案 → ${problems.join(" / ")}`);
    }

    if (pageErrors.length) {
      failures.push(`[390] 本世山河案场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
    }
  } finally {
    await ctx.close();
  }
  return { failures, checked, contrastFails: [], pixelContrastFails: [], zoomFails };
}

/** 切后台立即落盘 */
async function taskPersistTiming() {
  const failures = [];
  let checked = 0;
  const contrastFails = [];
  const pixelContrastFails = [];
  const zoomFails = [];
  // ---- 第十八件事:切后台/离开页面时,待刷的存档要立刻落盘 ----
  /*
   * 写盘是节流的(省电,见 savePersistence.spec),于是「刚做的改动」可能还躺在队列里;
   * 手机上的保命时机就是切后台/离开页面 —— `visibilitychange → hidden` 与 `pagehide`。
   * 单元用例测过 flushSaveWrites 本身,却没人测过这两个监听究竟接上没有:
   * 接不上,玩家切出去接个电话、回来时这一段时间就没了,而且是无声无息地没。
   */
  {
    const ctx = await auditContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    });
    const enc = encryptSlice;
    const gn = (m, e) => ({ m, e });
    const slices = {
      game: {
        started: true,
        saveVersion: 2,
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
        totalPlaySec: 0,
        createRerolls: 8,
        createProfile: null,
      },
      player: {
        name: "落盘自检",
        major: 5,
        sub: 3,
        exp: gn(1, 2),
        age: 40,
        lifespanBonusYears: 0,
        dead: false,
        reincarnation: {
          count: 0,
          daoFruit: 0,
          talents: [],
          insight: 0,
          lives: [],
          vow: null,
          trial: null,
          bonds: [],
        },
        linggen: {
          roots: [{ element: "wood", aptitude: 70 }],
          gradeName: "单灵根",
          growthMult: 1.1,
        },
      },
      resources: { spiritStone: gn(1, 6), qi: 1000, wudao: 10, herb: 5, ore: 5, page: 2, dust: 2 },
      inventory: { items: [], equipped: {}, pills: {}, artifacts: [], equippedArtifacts: [] },
      endgame: { daoPath: null, daoSource: 0, souls: [], equippedSouls: [] },
      settings: {
        privacyAccepted: true,
        sfxOn: false,
        musicOn: false,
        musicVol: 0,
        sfxVol: 0,
        reduceMotion: true,
        battleSpeed: 4,
        decomposeRanks: [],
        smartKeep: { enabled: true, minQuality: 3, keepCoreAffix: true, keepComboPiece: true },
        theme: "light",
      },
    };
    await ctx.addInitScript(
      (data) => {
        if (localStorage.getItem("__layoutSeeded")) return;
        for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
        localStorage.setItem("__layoutSeeded", "1");
      },
      Object.fromEntries(Object.entries(slices).map(([k, v]) => [`${SAVE_PREFIX}${k}`, enc(v)])),
    );
    const page = await ctx.newPage();
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    await page.goto(INDEX + "#/dongfu", { waitUntil: "load" });
    await page.waitForTimeout(2400);
    await page.evaluate(() => {
      for (const b of document.querySelectorAll(".pointer-events-none.fixed button")) b.click();
      Math.random = () => 1;
    });
    await page.waitForTimeout(500);
    /** 磁盘上那一份灵石(解密 resources 分片) */
    const diskStone = async () => {
      const cipher = await page.evaluate(
        (prefix) => localStorage.getItem(`${prefix}resources`) || "",
        SAVE_PREFIX,
      );
      if (!cipher) return null;
      const plain = decryptSlice(cipher);
      if (!plain) return null;
      const v = JSON.parse(plain).spiritStone;
      return typeof v === "number" ? v : v.m * Math.pow(10, v.e);
    };
    const investOnce = async () => {
      await page
        .getByRole("button", { name: /灵脉投资/ })
        .first()
        .click({ timeout: 3000 })
        .catch(() => {});
      await page.waitForTimeout(400);
      await page
        .locator(".modal-panel button.btn-ghost:not([disabled])")
        .first()
        .click({ timeout: 3000 })
        .catch(() => {});
      await page.waitForTimeout(500);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
      return readFormatted(page, "灵石");
    };
    checked += 1;
    /**
     * 先自己落一次盘,再投入 —— 否则这条判据是在跟别人的定时器赛跑。
     *
     * 引擎每秒都在改状态(修为/灵气),待写队列因此**每 6 秒必刷一次**,
     * 与「什么时候投入」毫无关系(探针实测:25 秒里无人投入也刷 4 次,
     * 时刻 2.0s / 8.1s / 14.1s / 20.0s,间隔 6.0 / 6.1 / 5.9 秒)。
     * 旧写法是等满一个窗口(5800ms)再投入,以为「此刻没有待写的队列了」——
     * 可等待结束后 5 秒内照样有别人的刷新:投入若正好跨在刷新上,磁盘读到的
     * 已经是新值,判据反过来报「节流没起作用」。CI 上偶发红就是这么来的
     * (探针按旧写法跑 8 次,误报 2 次 —— 投入那 1.5 秒落在 6 秒一拍的刷新点上)。
     *
     * 改法:自己派一次 pagehide 把盘落干净(顺带证明这条监听真的接上了),
     * 下一次刷新至少 5 秒之后 —— 投入与读数都在这个安静窗口里,读数才由判据说了算。
     * 顺带补两条前提:盘上得真是投入前的数、这笔投入得真花了钱 —— 少了它们,
     * 读数不成立(比如页面值没读出来)时判据会静默空过,看着绿其实什么都没证。
     */
    await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
    await page.waitForTimeout(300);
    const start = await readFormatted(page, "灵石");
    const startDisk = await diskStone();
    // 前提:盘上得真是投入前的数。这一条不成立,后面「没立刻变」什么都证明不了
    if (
      startDisk === null ||
      start.value === null ||
      Math.abs(startDisk - start.value) > start.value * 0.001
    ) {
      failures.push(
        `[390] 落盘场景:派发 pagehide 之后磁盘还是 ${startDisk},页面已是 ${start.text} —— 待刷存档没落盘`,
      );
    }
    const afterInvest = await investOnce();
    const onDiskBefore = await diskStone();
    // 这一笔得真的花掉了钱 —— 否则「盘上没有跟着变」只是因为什么都没发生
    if (
      start.value !== null &&
      afterInvest.value !== null &&
      Math.abs(afterInvest.value - start.value) < start.value * 0.001
    ) {
      failures.push(
        "[390] 落盘场景:投脉之后页面上的灵石没变 —— 这一步没真花掉钱,后面两条判据都不作数",
      );
    }
    // 节流在起作用:投入之后这一瞬,盘上还该停在投入前的数(而不是跟着页面一起变)
    if (
      startDisk === null ||
      onDiskBefore === null ||
      Math.abs(onDiskBefore - startDisk) > startDisk * 0.001
    ) {
      failures.push(
        `[390] 落盘场景:投入之后磁盘立刻从 ${startDisk} 变成 ${onDiskBefore} —— 节流没起作用(这笔投入本该还躺在待刷队列里)`,
      );
    }
    // ① 切后台
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForTimeout(400);
    const afterHidden = await diskStone();
    if (
      afterInvest.value !== null &&
      (afterHidden === null || Math.abs(afterHidden - afterInvest.value) > afterInvest.value * 0.01)
    ) {
      failures.push(
        `[390] 落盘场景:切后台(visibilitychange→hidden)之后磁盘还是 ${afterHidden},页面已是 ${afterInvest.text} —— 待刷存档没落盘`,
      );
    }
    // ② 离开页面(pagehide)
    const second = await investOnce();
    if (
      afterInvest.value !== null &&
      second.value !== null &&
      Math.abs(second.value - afterInvest.value) < afterInvest.value * 0.001
    ) {
      failures.push("[390] 落盘场景:第二次投脉之后页面上的灵石没变 —— 这一条同样不作数");
    }
    await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
    await page.waitForTimeout(400);
    const afterHide = await diskStone();
    if (
      second.value !== null &&
      (afterHide === null || Math.abs(afterHide - second.value) > second.value * 0.01)
    ) {
      failures.push(
        `[390] 落盘场景:pagehide 之后磁盘还是 ${afterHide},页面已是 ${second.text} —— 待刷存档没落盘`,
      );
    }
    if (pageErrors.length)
      failures.push(`[390] 落盘场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
    console.log(
      `\n落盘时机:开局 ${start.text}(盘上 ${startDisk})→ 投脉后页面 ${afterInvest.text}` +
        `(盘上仍 ${onDiskBefore},节流中)→ 切后台落盘 ${afterHidden} · 再投一次 ${second.text} → pagehide 落盘 ${afterHide}`,
    );
    await ctx.close();
  }

  return { failures, checked, contrastFails, pixelContrastFails, zoomFails };
}

/** 导出失败也说话 */
async function taskExportFailure() {
  const failures = [];
  let checked = 0;
  const contrastFails = [];
  const pixelContrastFails = [];
  const zoomFails = [];
  // ---- 第十七件事:导出失败必须说出来(打断浏览器的下载能力再点一次) ----
  /*
   * 「导出存档」是玩家丢档前唯一的保险。而 Web 这条路靠 `saveAs`(Blob + a[download])——
   * 受限 WebView、部分应用内浏览器里 `URL.createObjectURL` 直接不可用,于是它抛错。
   * 调用方是 `void exportSaveToDevice()`,既不看返回值也不接异常,结果就是:
   * 点下去既没文件、也没提示。故这里把下载能力打断,要求界面**说得出这句话**。
   */
  {
    const ctx = await auditContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      acceptDownloads: true,
    });
    const enc = encryptSlice;
    const gn = (m, e) => ({ m, e });
    const slices = {
      game: {
        started: true,
        saveVersion: 2,
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
        totalPlaySec: 0,
        createRerolls: 8,
        createProfile: null,
      },
      player: {
        name: "导出自检",
        major: 5,
        sub: 3,
        exp: gn(1, 2),
        age: 40,
        lifespanBonusYears: 0,
        dead: false,
        reincarnation: {
          count: 0,
          daoFruit: 0,
          talents: [],
          insight: 0,
          lives: [],
          vow: null,
          trial: null,
          bonds: [],
        },
        linggen: {
          roots: [{ element: "wood", aptitude: 70 }],
          gradeName: "单灵根",
          growthMult: 1.1,
        },
      },
      resources: { spiritStone: gn(1, 6), qi: 1000, wudao: 10, herb: 5, ore: 5, page: 2, dust: 2 },
      inventory: { items: [], equipped: {}, pills: {}, artifacts: [], equippedArtifacts: [] },
      endgame: { daoPath: null, daoSource: 0, souls: [], equippedSouls: [] },
      settings: {
        privacyAccepted: true,
        sfxOn: false,
        musicOn: false,
        musicVol: 0,
        sfxVol: 0,
        reduceMotion: true,
        battleSpeed: 4,
        decomposeRanks: [],
        smartKeep: { enabled: true, minQuality: 3, keepCoreAffix: true, keepComboPiece: true },
        theme: "light",
      },
    };
    await ctx.addInitScript(
      (data) => {
        if (localStorage.getItem("__layoutSeeded")) return;
        for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
        localStorage.setItem("__layoutSeeded", "1");
      },
      Object.fromEntries(Object.entries(slices).map(([k, v]) => [`${SAVE_PREFIX}${k}`, enc(v)])),
    );
    const page = await ctx.newPage();
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    await page.goto(INDEX + "#" + "/settings", { waitUntil: "load" });
    await page.waitForTimeout(2200);
    await clearOverlays(page);
    checked += 1;
    // 把下载这条路打断 —— 受限 WebView / 应用内浏览器正是这样
    await page.evaluate(() => {
      URL.createObjectURL = () => {
        throw new Error("createObjectURL is not available");
      };
    });
    await page
      .getByRole("button", { name: /导出存档/ })
      .first()
      .click();
    await page.waitForTimeout(1500);
    const said = await page.evaluate(() =>
      [...document.querySelectorAll(".pointer-events-none.fixed button")]
        .map((b) => (b.textContent || "").trim())
        .join("|"),
    );
    if (!/导出|下载/.test(said))
      failures.push(
        `[390] 导出失败场景:下载能力不可用时点了「导出存档」,界面一声不响(${said || "无提示"})`,
      );
    else console.log(`\n导出失败也说话:「${said.split("|")[0]}」`);
    if (pageErrors.length)
      failures.push(`[390] 导出失败场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
    await ctx.close();
  }

  return { failures, checked, contrastFails, pixelContrastFails, zoomFails };
}

/** 坏档也能进游戏 */
async function taskBadSave() {
  const failures = [];
  let checked = 0;
  const contrastFails = [];
  const pixelContrastFails = [];
  const zoomFails = [];
  // ---- 第十六件事:坏档也能进游戏,而且要说得清哪一片坏了 ----
  /*
   * 分片损坏是最容易变成「白屏」或「我的东西怎么没了」的一种事故:
   * 启动前的 preflightScan 会把读不出来的分片挪到备份键、其余照常开局。
   * 这条判据查三件事:① 照样进得去(不白屏);② 启动时说了话;
   * ③ 设置页常驻一条说得出「哪一片坏了、原档还在哪」——坏档只弹一条两秒的提示是不够的,
   *    玩家多半是先发现「灵石怎么归零了」,再回来找原因。
   */
  {
    const ctx = await auditContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    });
    const enc = encryptSlice;
    const gn = (m, e) => ({ m, e });
    const slices = {
      game: {
        started: true,
        saveVersion: 2,
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
        totalPlaySec: 0,
        createRerolls: 8,
        createProfile: null,
      },
      player: {
        name: "坏档自检",
        major: 5,
        sub: 3,
        exp: gn(1, 2),
        age: 40,
        lifespanBonusYears: 0,
        dead: false,
        reincarnation: {
          count: 0,
          daoFruit: 0,
          talents: [],
          insight: 0,
          lives: [],
          vow: null,
          trial: null,
          bonds: [],
        },
        linggen: {
          roots: [{ element: "wood", aptitude: 70 }],
          gradeName: "单灵根",
          growthMult: 1.1,
        },
      },
      resources: { spiritStone: gn(1, 6), qi: 1000, wudao: 10, herb: 5, ore: 5, page: 2, dust: 2 },
      inventory: { items: [], equipped: {}, pills: {}, artifacts: [], equippedArtifacts: [] },
      endgame: { daoPath: null, daoSource: 0, souls: [], equippedSouls: [] },
      settings: {
        privacyAccepted: true,
        sfxOn: false,
        musicOn: false,
        musicVol: 0,
        sfxVol: 0,
        reduceMotion: true,
        battleSpeed: 4,
        decomposeRanks: [],
        smartKeep: { enabled: true, minQuality: 3, keepCoreAffix: true, keepComboPiece: true },
        theme: "light",
      },
    };
    await ctx.addInitScript(
      (data) => {
        if (localStorage.getItem("__layoutSeeded")) return;
        for (const [k, v] of Object.entries(data)) {
          // 故意写坏一个分片(既不是本游戏密文,也不是合法 JSON)
          localStorage.setItem(k, k.endsWith(".resources") ? "这不是存档" : v);
        }
        localStorage.setItem("__layoutSeeded", "1");
      },
      Object.fromEntries(Object.entries(slices).map(([k, v]) => [`${SAVE_PREFIX}${k}`, enc(v)])),
    );
    const page = await ctx.newPage();
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    await page.goto(INDEX, { waitUntil: "load" });
    checked += 1;
    /**
     * 启动提示只活两秒多,而冷启动到首帧的耗时是浮动的 —— 固定读一次会偶发读空
     * (实测同一份产物两次跑,一次读到、一次读到空串)。故轮询到它出现为止:
     * 判据不变(提示文本必须含「损坏/异常/隔离」),只是不再拿运气当判据。
     */
    await page
      .waitForFunction(() => /损坏|异常|隔离/.test(document.body.innerText), { timeout: 20000 })
      .catch(() => undefined);
    const boot = await page.evaluate(() => ({
      alive: !!document.querySelector("#app")?.firstElementChild,
      hash: location.hash,
      toasts: [...document.querySelectorAll(".pointer-events-none.fixed button")]
        .map((b) => (b.textContent || "").trim())
        .join("|"),
      backedUp: Object.keys(localStorage).some((k) => k.startsWith("corrupt.")),
    }));
    if (!boot.alive) failures.push("[390] 坏档场景:坏掉一个分片之后界面都没起来(白屏)");
    if (!/损坏|异常|隔离/.test(boot.toasts))
      failures.push(`[390] 坏档场景:启动时没有交代坏档(${boot.toasts || "无提示"})`);
    if (!boot.backedUp) failures.push("[390] 坏档场景:坏掉的分片没有被隔离备份(原档直接丢了)");
    /*
     * 冷启动时 app.mount 会早于 router 的首轮导航落定。若这时立刻把 hash 改成
     * /settings,首轮导航的尾帧仍可能把它写回 / —— 下面的 20 秒便只是在等一个
     * 已经被覆盖的目标(全量并发跑时实测当前页停在 #/,单跑却过)。
     * 先等首轮导航真的落在 /,再改 hash;这里不碰判据,只消除启动竞态。
     */
    const bootRouteSettled = await page
      .waitForFunction(() => location.hash === "#/", { timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    if (!bootRouteSettled)
      failures.push(
        `[390] 坏档场景:首轮导航未落在首页(当前页:${
          (await page.evaluate(() => location.hash)) || "?"
        })`,
      );
    /**
     * 等那张卡真的画出来 —— 不要固定 900ms。
     *
     * 设置页是路由分包,忙时首帧浮动:本轮实测(加了只读页对比度采样之后)同一份产物
     * 偶发三条假红 —— 卡还没渲染,读到的 notice 是空串,于是「没有常驻交代 / 没说出
     * 哪一片 / 没说出备份位置」三条一起亮,而截图里它明明在。判据不变,只把等待换成
     * 确定性:等到含「存档版本」的卡片出现为止(启动提示那条也是这么改的)。
     */
    /**
     * 并发跑到 8 路时,设置页是路由分包里的最后一个冷 chunk;更糟的是首轮路由尾帧
     * 仍可能把刚写进去的 #/settings 覆盖回 #/。故每次重写 hash 后再等 6 秒,最多
     * 试三次(总预算仍约 20 秒)。超时也不再只是留个空串:把整页正文的头一段带进
     * 失败信息,下次能一眼分清「卡没画出来」与「卡画出来了但没写那三件事」。
     */
    let cardShown = false;
    for (let attempt = 0; attempt < 3 && !cardShown; attempt += 1) {
      await page.evaluate(() => {
        location.hash = "#/settings";
      });
      cardShown = await page
        .waitForFunction(
          () =>
            [...document.querySelectorAll("[data-settings-archive]")].some((c) =>
              (c.textContent || "").includes("存档版本"),
            ),
          { timeout: 6000 },
        )
        .then(() => true)
        .catch(() => false);
    }
    const notice = await page.evaluate(() => {
      const card = [...document.querySelectorAll("[data-settings-archive]")].find((c) =>
        (c.textContent || "").includes("存档版本"),
      );
      return (card?.innerText || "").replace(/\n+/g, " ");
    });
    if (!cardShown) {
      const where = await page.evaluate(() =>
        document.body.innerText.replace(/\s+/g, " ").slice(0, 120),
      );
      failures.push(
        `[390] 坏档场景:设置页的「存档版本」卡片 20 秒内没画出来(当前页:${
          (await page.evaluate(() => location.hash)) || "?"
        } · 正文:${where || "空"})`,
      );
    } else if (!/分片损坏/.test(notice))
      failures.push("[390] 坏档场景:设置页没有常驻交代(只说一次两秒的提示,玩家回头找不到原因)");
    // 卡片没画出来时只报一条(上一条已经说了)—— 否则同一件事会亮三条假红
    if (cardShown && !/资源/.test(notice))
      failures.push(`[390] 坏档场景:设置页没说出坏的是哪一片 —— ${notice.slice(0, 80)}`);
    if (cardShown && !/corrupt\./.test(notice))
      failures.push("[390] 坏档场景:设置页没说出原档备份在哪(玩家/帮他的人找不回来)");
    if (pageErrors.length)
      failures.push(`[390] 坏档场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
    console.log(`
坏档开局:界面照常起来 · 启动提示「${boot.toasts.split("|")[0] ?? "无"}」 · 设置页「${notice.slice(0, 46)}…」`);
    await ctx.close();
  }

  return { failures, checked, contrastFails, pixelContrastFails, zoomFails };
}

/** iOS 存档风险提示 */
async function taskIosNotice() {
  const failures = [];
  let checked = 0;
  const contrastFails = [];
  const pixelContrastFails = [];
  const zoomFails = [];
  // ---- 第三十一件事:iOS 的存档风险提示,该说的说、不该说的一个字不说 ----
  /*
   * 由来:WebKit 会把**七天没被打开过**的站点的脚本可写存储整个清掉 —— localStorage 里
   * 那份存档与 Service Worker 缓存一起没。而这是个放置游戏,「隔几天回来」正是常态。
   * 唯一真管用的办法是让游戏成为已安装的 Web App(添加到主屏幕),故 iOS 未安装时提示一次。
   *
   * 判据两头都要钉,因为**说错话的代价**比不说更大:
   *   一 iOS 未安装:主页要出现,且「知道了」之后重载不再出现(写盘真落了),设置页常驻一份可回查
   *   二 iOS 已装到主屏幕:不再劝(它已经不吃那条规则了)
   *   三 桌面/安卓:一个字都不许说 —— 它们用应用自己的存储,在那儿喊「iOS 会清存档」是胡说
   */
  {
    const UA_IOS =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
    const UA_DESKTOP =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
    const enc = encryptSlice;
    const gn = (m, e) => ({ m, e });
    const save = Object.fromEntries(
      Object.entries({
        game: {
          started: true,
          saveVersion: 2,
          createdAt: Date.now() - 40 * 86400000,
          lastActiveAt: Date.now(),
          totalPlaySec: 0,
          createRerolls: 8,
          createProfile: null,
        },
        player: {
          name: "iOS 自检",
          major: 5,
          sub: 3,
          exp: gn(1, 2),
          age: 40,
          lifespanBonusYears: 0,
          dead: false,
          reincarnation: {
            count: 0,
            daoFruit: 0,
            talents: [],
            insight: 0,
            lives: [],
            vow: null,
            trial: null,
            bonds: [],
          },
          linggen: {
            roots: [{ element: "wood", aptitude: 70 }],
            gradeName: "单灵根",
            growthMult: 1.1,
          },
        },
        resources: {
          spiritStone: gn(1, 6),
          qi: 1000,
          wudao: 10,
          herb: 5,
          ore: 5,
          page: 2,
          dust: 2,
        },
        inventory: { items: [], equipped: {}, pills: {}, artifacts: [], equippedArtifacts: [] },
        endgame: { daoPath: null, daoSource: 0, souls: [], equippedSouls: [] },
        settings: {
          privacyAccepted: true,
          sfxOn: false,
          musicOn: false,
          musicVol: 0,
          sfxVol: 0,
          reduceMotion: true,
          battleSpeed: 4,
          decomposeRanks: [],
          smartKeep: { enabled: true, minQuality: 3, keepCoreAffix: true, keepComboPiece: true },
          theme: "light",
        },
      }).map(([k, v]) => [`${SAVE_PREFIX}${k}`, enc(v)]),
    );
    const openWith = async (userAgent, standalone = false) => {
      const ctx = await auditContext({ viewport: { width: 390, height: 844 }, userAgent });
      await ctx.addInitScript(
        ([data, sa]) => {
          if (!localStorage.getItem("__layoutSeeded")) {
            for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
            localStorage.setItem("__layoutSeeded", "1");
          }
          if (sa) Object.defineProperty(navigator, "standalone", { get: () => true });
        },
        [save, standalone],
      );
      const page = await ctx.newPage();
      return { ctx, page };
    };
    /** 提示卡的标题就是它唯一的文案锚点 */
    const cardCount = (page) => page.locator("text=把游戏「添加到主屏幕」").count();

    {
      const { ctx, page } = await openWith(UA_IOS);
      await page.goto(INDEX, { waitUntil: "load" });
      await page.waitForTimeout(1500);

      /*
       * 同一条已开局的页面,顺手把「楷体由谁画」也量了(再开一套存档不值当)。
       * 查的是运行时那一半:产物里的次序对,不代表字体真加载成功 —— 文件坏了、因 base
       * 变形而 404,都会安静地回退到系统字体,界面看着只是「有点不一样」,没人报错。
       */
      checked += 1;
      const kaiFonts = await (async () => {
        const cdp = await ctx.newCDPSession(page);
        await cdp.send("DOM.enable");
        await cdp.send("CSS.enable");
        const { root } = await cdp.send("DOM.getDocument");
        const { nodeId } = await cdp.send("DOM.querySelector", {
          nodeId: root.nodeId,
          selector: "header .font-kai",
        });
        if (!nodeId) return null;
        const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
        await cdp.detach();
        return fonts.map((f) => f.familyName);
      })();
      if (!kaiFonts) failures.push("[楷体] 顶栏里找不到 font-kai 的元素,判据没量到东西");
      // 只认前缀:字形分支可能换(原版 / GB / 屏幕阅读版),但「用的是我们内置那一支」不许变
      else if (!kaiFonts.some((f) => f.startsWith("LXGW WenKai"))) {
        failures.push(
          `[楷体] 楷体文字不是内置字体画的(实际 ${kaiFonts.join(" + ")})—— 字体没加载成功?`,
        );
      } else {
        console.log(`\n楷体统一:顶栏名字由 ${kaiFonts.join(" + ")} 渲染`);
      }

      checked += 1;
      const onHome = await cardCount(page);
      if (onHome === 0)
        failures.push(
          "[iOS] 未安装时主页没有出现「添加到主屏幕」提示 —— 七天不打开就会被清档,而玩家不会知道",
        );
      const dismiss = page.locator("button", { hasText: "知道了" }).first();
      if ((await dismiss.count()) === 0)
        failures.push("[iOS] 提示卡没有「知道了」—— 劝一次就得能关掉,不能变成常驻横幅");
      else {
        await dismiss.click();
        await page.waitForTimeout(200);
      }
      if ((await cardCount(page)) !== 0) failures.push("[iOS] 点了「知道了」之后提示还在");
      await page.reload({ waitUntil: "load" });
      await page.waitForTimeout(1500);
      if ((await cardCount(page)) !== 0)
        failures.push("[iOS] 关掉之后重载又冒出来了(关掉这个动作没落盘)");
      await page.goto(INDEX + "#/settings", { waitUntil: "load" });
      await page.waitForTimeout(700);
      if ((await cardCount(page)) !== 1)
        failures.push("[iOS] 设置页没有常驻那一份 —— 玩家回头想装时找不到那两步");
      const backup = await page.evaluate(() => {
        const el = document.querySelector('[data-settings-save-stat="export"]');
        return (el?.innerText || "").replace(/\s+/g, " ");
      });
      if (!/上次导出备份/.test(backup)) failures.push("[iOS] 设置页没有「上次导出备份」那一行");
      else if (!/从未导出|天前|今天/.test(backup))
        failures.push(`[iOS] 备份那一行读不出时间:「${backup}」`);
      console.log(
        `\niOS 存档提示:主页出现一次并可关闭、关掉后重载不再出现、设置页常驻 · 备份行「${backup.slice(0, 28)}…」`,
      );
      await ctx.close();
    }
    {
      const { ctx, page } = await openWith(UA_IOS, true);
      await page.goto(INDEX, { waitUntil: "load" });
      await page.waitForTimeout(1500);
      checked += 1;
      if ((await cardCount(page)) !== 0)
        failures.push("[iOS] 已经是主屏幕应用了还在劝安装 —— 它早就不吃那条清存储规则");
      await ctx.close();
    }
    {
      const { ctx, page } = await openWith(UA_DESKTOP);
      await page.goto(INDEX, { waitUntil: "load" });
      await page.waitForTimeout(1500);
      const onHome = await cardCount(page);
      await page.goto(INDEX + "#/settings", { waitUntil: "load" });
      await page.waitForTimeout(700);
      const onSettings = await cardCount(page);
      checked += 1;
      if (onHome + onSettings !== 0) {
        failures.push(
          "[桌面] 非 iOS 上出现了「iOS 会清掉存档」的提示 —— 那是胡说,玩家会当成游戏出错",
        );
      }
      await ctx.close();
    }
  }

  return { failures, checked, contrastFails, pixelContrastFails, zoomFails };
}

/**
 * 浮层在 200% 缩放档:页面上点得开的那些弹窗(装备详情 / 丹房 / 灵草坊 / 器魂 / 灵脉 /
 * 人物读数详情 / 一键分解 / 关于此作 / 隐私政策)。
 *
 * 与「只在某一步出现的浮层」不同,这些是**点得开**的 —— 但巡页不会去点它们,
 * 缩放档那一遍自然也碰不到。实测 195 宽下面板只有 171px:丹房的方子卡三列并排
 * 时中间只剩 42px(代价折成六行、成品折成四行),器魂详情的「收 起 / 卸 下」
 * 两枚各剩 68px、在空格处断成两行。这两类都不是「溢出」,横向溢出与越界元素都量不出来。
 *
 * 判据用与浮层那一族同一把尺子(measureDialogZoom + dialogZoomProblems),
 * 每开一扇量一次;开不出来就报红 —— 判据没量到东西时不许静默变绿。
 */
async function taskDialogZoom() {
  const failures = [];
  let checked = 0;
  const enc = encryptSlice;
  const gn = (m, e) => ({ m, e });
  const zoomWeaponTemplates = EQUIPMENT_TEMPLATES.filter(
    (tpl) => tpl.slot === "weapon" && !["w_zidian", "w_hanfeng"].includes(tpl.id),
  );
  if (zoomWeaponTemplates.length < 13) {
    throw new Error("200% 浮层夹具需要至少 13 个真实武器模板");
  }
  const extraWeaponCandidates = zoomWeaponTemplates.slice(0, 13).map((tpl, i) => ({
    uid: `dlg_candidate_${i}`,
    templateId: tpl.id,
    quality: "mortal",
    tier: 20,
    level: 0,
    affixes: [],
  }));
  const slices = {
    game: {
      started: true,
      saveVersion: 2,
      createdAt: Date.now() - 86400000 * 30,
      lastActiveAt: Date.now(),
      totalPlaySec: 0,
      createRerolls: 8,
      createProfile: null,
    },
    player: {
      major: 14,
      sub: 0,
      exp: gn(3, 9),
      age: 3000,
      lifespanBonusYears: 0,
      dead: false,
      reincarnation: {
        count: 2,
        daoFruit: 12,
        talents: [],
        insight: 400,
        lives: [],
        vow: null,
        trial: null,
        bonds: [],
      },
      linggen: {
        roots: [{ element: "fire", aptitude: 42 }],
        gradeName: "杂灵根",
        growthMult: 0.85,
      },
    },
    resources: {
      spiritStone: gn(9, 12),
      qi: 5000,
      wudao: 800,
      herb: 900,
      ore: 900,
      page: 300,
      dust: 500,
    },
    inventory: {
      items: [
        {
          uid: "dlg_w",
          templateId: "w_zidian",
          quality: "heaven",
          tier: 20,
          level: 3,
          affixes: [
            { id: "bs3", roll: 1 },
            { id: "low2", roll: 0.6 },
          ],
        },
        {
          uid: "dlg_w2",
          templateId: "w_hanfeng",
          quality: "immortal",
          tier: 20,
          level: 3,
          affixes: [{ id: "low2", roll: 0.6 }],
        },
        ...extraWeaponCandidates,
      ],
      equipped: { weapon: "dlg_w" },
      pills: { p_jvqidan: 5 },
      artifacts: [{ defId: "af_qinglian", level: 3 }],
      equippedArtifacts: ["af_qinglian"],
    },
    endgame: {
      daoPath: "sword",
      daoSource: 1200,
      souls: [{ uid: "dlg_s1", type: "fengmang", grade: 1, fromName: "旧剑" }],
      equippedSouls: ["dlg_s1"],
      marks: makeFullMarks().slice(0, 7),
      endgameTutorialSeen: true,
      resourceDialogSeen: true,
    },
    dongfu: {
      levels: { mansion: 4, field: 5, alchemy: 5, forge: 4, library: 4 },
      offlineCapHours: 24,
    },
    settings: {
      privacyAccepted: true,
      sfxOn: false,
      musicOn: false,
      musicVol: 0,
      sfxVol: 0,
      reduceMotion: true,
      battleSpeed: 4,
      decomposeRanks: [],
      smartKeep: { enabled: true, minQuality: 3, keepCoreAffix: true, keepComboPiece: true },
      theme: "dark",
    },
  };
  const ctx = await auditContext({
    viewport: { width: 195, height: 422 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  await ctx.addInitScript(
    (data) => {
      for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
    },
    Object.fromEntries(Object.entries(slices).map(([k, v]) => [`${SAVE_PREFIX}${k}`, enc(v)])),
  );
  const page = await ctx.newPage();
  const pageErrors = [];
  watchPageErrors(page, pageErrors);

  const readEquipmentFrames = () =>
    page.evaluate(() => {
      const root = document.querySelector("[data-equipment-dossier]");
      const hero = root?.querySelector(".equip-dossier__hero");
      const sectionClasses = new Set([
        "equip-dossier__hero",
        "equip-dossier__power",
        "equip-dossier__sheet",
        "equip-dossier__line-ledger",
        "equip-dossier__workshop",
      ]);
      return {
        found: Boolean(root && hero),
        heroAfter: hero ? getComputedStyle(hero, "::after").content : "",
        frames: root
          ? [...root.children]
              .filter((el) => [...el.classList].some((name) => sectionClasses.has(name)))
              .map((el) => {
                const style = getComputedStyle(el);
                return {
                  classes: [...el.classList],
                  borders: [
                    style.borderTopWidth,
                    style.borderRightWidth,
                    style.borderBottomWidth,
                    style.borderLeftWidth,
                  ].map((value) => Number.parseFloat(value)),
                  background: style.backgroundColor,
                };
              })
          : [],
      };
    });

  const readOpenLedger = (selector) =>
    page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const style = getComputedStyle(el);
      return {
        borderTop: Number.parseFloat(style.borderTopWidth),
        borderRight: Number.parseFloat(style.borderRightWidth),
        borderBottom: Number.parseFloat(style.borderBottomWidth),
        borderLeft: Number.parseFloat(style.borderLeftWidth),
        radius: Number.parseFloat(style.borderRadius),
        background: style.backgroundColor,
      };
    }, selector);

  const assertLedgerWithoutCard = async (label, selector, bordered = true) => {
    checked += 1;
    const ledger = await readOpenLedger(selector);
    const blockOk = bordered
      ? ledger?.borderTop === 1 && ledger?.borderBottom === 1
      : ledger?.borderTop === 0 && ledger?.borderBottom === 0;
    if (
      !ledger ||
      !blockOk ||
      ledger.borderRight !== 0 ||
      ledger.borderLeft !== 0 ||
      ledger.radius !== 0 ||
      ledger.background !== "rgba(0, 0, 0, 0)"
    ) {
      failures.push(`[195] ${label}又套回内层卡壳:${JSON.stringify(ledger)}`);
    }
  };

  const readEquipmentFigureLines = () =>
    page.evaluate(() => {
      const figures = [
        ...document.querySelectorAll(
          "[data-equipment-compare-value], [data-equipment-salvage-cost] [data-value-nowrap]",
        ),
      ].map((el) => {
        const rect = el.getBoundingClientRect();
        const lineHeight = Number.parseFloat(getComputedStyle(el).lineHeight) || 16;
        return {
          kind: el.matches("[data-equipment-compare-value]") ? "compare" : "cost",
          text: (el.textContent || "").replace(/\s+/g, " ").trim(),
          height: Math.round(rect.height * 10) / 10,
          lineHeight: Math.round(lineHeight * 10) / 10,
          lines: Math.round(rect.height / lineHeight),
        };
      });
      return {
        count: figures.length,
        compare: figures.filter((row) => row.kind === "compare").length,
        cost: figures.filter((row) => row.kind === "cost").length,
        figures,
      };
    });

  const readVeinRows = () =>
    page.evaluate(() => ({
      costs: [...document.querySelectorAll("[data-vein-cost]")].map((el) => {
        const range = document.createRange();
        range.selectNodeContents(el);
        return {
          text: (el.textContent || "").replace(/\s+/g, " ").trim(),
          lines: new Set([...range.getClientRects()].map((rect) => Math.round(rect.top))).size,
        };
      }),
      names: [...document.querySelectorAll("[data-vein-name]")].map((el) => ({
        text: el.textContent,
        clipped: el.scrollWidth > el.clientWidth + 1,
      })),
    }));

  const readEraLedger = () =>
    page.evaluate(() => {
      const ledger = document.querySelector("[data-era-ledger]");
      const panel = ledger?.closest(".modal-panel");
      const panelRect = panel?.getBoundingClientRect();
      const ledgerRect = ledger?.getBoundingClientRect();
      return {
        found: Boolean(ledger),
        entries: ledger?.querySelectorAll(":scope > div").length ?? 0,
        cards: ledger?.querySelectorAll(".card-ink").length ?? -1,
        text: (ledger?.textContent || "").replace(/\s+/g, " ").trim(),
        insidePanel: Boolean(
          panelRect &&
          ledgerRect &&
          ledgerRect.left >= panelRect.left - 2 &&
          ledgerRect.right <= panelRect.right + 2,
        ),
      };
    });

  const readHerbShopLedger = () =>
    page.evaluate(() => {
      const ledger = document.querySelector("[data-herb-shop-ledger]");
      if (!ledger) return null;
      const panel = ledger.closest(".modal-panel");
      const panelRect = panel?.getBoundingClientRect();
      const panelInner = panel?.querySelector("[data-folio-modal-scroll]");
      const panelInnerRect = panelInner?.getBoundingClientRect();
      const ledgerStyle = getComputedStyle(ledger);
      const lineCount = (el) => {
        const range = document.createRange();
        range.selectNodeContents(el);
        return new Set([...range.getClientRects()].map((rect) => Math.round(rect.top))).size;
      };
      const rows = [...ledger.querySelectorAll("[data-herb-shop-row]")].map((row) => {
        const rowRect = row.getBoundingClientRect();
        const rowStyle = getComputedStyle(row);
        const name = row.querySelector("[data-herb-shop-name]");
        const nameRect = name?.getBoundingClientRect();
        const facts = row.querySelector("[data-herb-shop-facts]");
        const factsRect = facts?.getBoundingClientRect();
        const actions = row.querySelector("[data-herb-shop-actions]");
        const actionsRect = actions?.getBoundingClientRect();
        return {
          grade: row.getAttribute("data-herb-shop-row"),
          width: rowRect.width,
          height: rowRect.height,
          background: rowStyle.backgroundColor,
          radius: Number.parseFloat(rowStyle.borderRadius),
          borderTop: Number.parseFloat(rowStyle.borderTopWidth),
          borderRight: Number.parseFloat(rowStyle.borderRightWidth),
          borderLeft: Number.parseFloat(rowStyle.borderLeftWidth),
          name: name
            ? {
                text: (name.textContent || "").replace(/\s+/g, " ").trim(),
                width: nameRect.width,
                lines: lineCount(name),
                clipped: name.scrollWidth > name.clientWidth + 1,
              }
            : null,
          facts: facts
            ? {
                bottom: factsRect.bottom,
                figures: [
                  ...facts.querySelectorAll("[data-herb-shop-held], [data-herb-shop-price]"),
                ].map((el) => ({
                  text: (el.textContent || "").replace(/\s+/g, " ").trim(),
                  top: el.getBoundingClientRect().top,
                  lines: lineCount(el),
                  clipped: el.scrollWidth > el.clientWidth + 1,
                })),
              }
            : null,
          actions: actionsRect
            ? {
                top: actionsRect.top,
                left: actionsRect.left,
                right: actionsRect.right,
              }
            : null,
          buttons: actions
            ? [...actions.querySelectorAll("button")].map((button) => {
                const rect = button.getBoundingClientRect();
                return {
                  text: (button.textContent || "").replace(/\s+/g, " ").trim(),
                  lines: lineCount(button),
                  clipped: button.scrollWidth > button.clientWidth + 1,
                  left: rect.left,
                  right: rect.right,
                  height: rect.height,
                };
              })
            : [],
        };
      });
      return {
        found: Boolean(ledger),
        panelLeft: panelRect?.left ?? 0,
        panelRight: panelRect?.right ?? 0,
        panelWidth: panelRect?.width ?? 0,
        innerWidth: panelInnerRect?.width ?? 0,
        borderTop: Number.parseFloat(ledgerStyle.borderTopWidth),
        borderRight: Number.parseFloat(ledgerStyle.borderRightWidth),
        borderBottom: Number.parseFloat(ledgerStyle.borderBottomWidth),
        borderLeft: Number.parseFloat(ledgerStyle.borderLeftWidth),
        radius: Number.parseFloat(ledgerStyle.borderRadius),
        background: ledgerStyle.backgroundColor,
        cards: ledger.querySelectorAll('.card-ink, [class~="bg-paper-deep/70"]').length,
        rows,
        separators: rows.slice(1).filter((row) => row.borderTop === 1).length,
      };
    });

  const readSlotCandidateLedger = () =>
    page.evaluate(() => {
      const ledger = document.querySelector("[data-slot-candidate-ledger]");
      if (!ledger) return null;
      const panel = ledger.closest(".modal-panel");
      const panelRect = panel?.getBoundingClientRect();
      const panelInner = panel?.querySelector("[data-folio-modal-scroll]");
      const panelInnerRect = panelInner?.getBoundingClientRect();
      const ledgerStyle = getComputedStyle(ledger);
      const lineCount = (el) => {
        const range = document.createRange();
        range.selectNodeContents(el);
        return new Set([...range.getClientRects()].map((rect) => Math.round(rect.top))).size;
      };
      const rectOf = (el) => {
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right };
      };
      const rows = [...ledger.querySelectorAll("[data-slot-candidate]")].map((row) => {
        const rowRect = row.getBoundingClientRect();
        const rowStyle = getComputedStyle(row);
        const body = row.querySelector(".slot-candidate-row__body");
        const name = row.querySelector("[data-slot-candidate-name]");
        const decision = row.querySelector("[data-slot-candidate-decision]");
        const delta = row.querySelector(".slot-candidate-row__delta");
        const action = row.querySelector(".slot-candidate-row__action");
        const rowBox = rectOf(row);
        const bodyBox = rectOf(body);
        const nameBox = rectOf(name);
        const decisionBox = rectOf(decision);
        const deltaBox = rectOf(delta);
        const actionBox = rectOf(action);
        return {
          text: (row.textContent || "").replace(/\s+/g, " ").trim(),
          equipped: row.hasAttribute("data-slot-candidate-equipped"),
          paperCard:
            row.classList.contains("bg-paper-deep/70") || row.classList.contains("card-ink"),
          height: rowRect.height,
          background: rowStyle.backgroundColor,
          radius: Number.parseFloat(rowStyle.borderRadius),
          borderTop: Number.parseFloat(rowStyle.borderTopWidth),
          borderRight: Number.parseFloat(rowStyle.borderRightWidth),
          borderLeft: Number.parseFloat(rowStyle.borderLeftWidth),
          row: rowBox,
          body: bodyBox,
          name:
            name && nameBox
              ? {
                  text: (name.textContent || "").replace(/\s+/g, " ").trim(),
                  width: nameBox.right - nameBox.left,
                  lines: lineCount(name),
                  clipped: name.scrollWidth > name.clientWidth + 1,
                }
              : null,
          decision: decisionBox,
          delta:
            delta && deltaBox
              ? {
                  text: (delta.textContent || "").replace(/\s+/g, " ").trim(),
                  lines: lineCount(delta),
                  clipped: delta.scrollWidth > delta.clientWidth + 1,
                  ...deltaBox,
                }
              : null,
          action:
            action && actionBox
              ? {
                  text: (action.textContent || "").replace(/\s+/g, " ").trim(),
                  lines: lineCount(action),
                  clipped: action.scrollWidth > action.clientWidth + 1,
                  height: actionBox.bottom - actionBox.top,
                  insideInner: Boolean(
                    panelInnerRect &&
                    actionBox.left >= panelInnerRect.left - 2 &&
                    actionBox.right <= panelInnerRect.right + 2,
                  ),
                  ...actionBox,
                }
              : null,
          decisionDeltaActionSameRow: Boolean(
            deltaBox &&
            actionBox &&
            Math.max(deltaBox.top, actionBox.top) <=
              Math.min(deltaBox.bottom, actionBox.bottom) + 1,
          ),
        };
      });
      return {
        found: true,
        panel: panelRect
          ? {
              left: panelRect.left,
              right: panelRect.right,
              width: panelRect.width,
            }
          : null,
        inner: panelInnerRect
          ? {
              left: panelInnerRect.left,
              right: panelInnerRect.right,
              width: panelInnerRect.width,
            }
          : null,
        borderTop: Number.parseFloat(ledgerStyle.borderTopWidth),
        borderRight: Number.parseFloat(ledgerStyle.borderRightWidth),
        borderBottom: Number.parseFloat(ledgerStyle.borderBottomWidth),
        borderLeft: Number.parseFloat(ledgerStyle.borderLeftWidth),
        radius: Number.parseFloat(ledgerStyle.borderRadius),
        background: ledgerStyle.backgroundColor,
        cards: [...ledger.querySelectorAll("*")].filter(
          (el) => el.classList.contains("card-ink") || el.classList.contains("bg-paper-deep/70"),
        ).length,
        rows,
        separators: rows.slice(1).filter((row) => row.borderTop === 1).length,
      };
    });

  /** 一扇弹窗:点开 → 量 → 关掉。点不开直接报红(判据没量到东西) */
  const probe = async (label, route, click) => {
    await page.goto(INDEX + "#" + route, { waitUntil: "load" });
    await page.waitForTimeout(1100);
    await page.evaluate(() => {
      Math.random = () => 1;
      for (const b of document.querySelectorAll(".pointer-events-none.fixed button")) b.click();
    });
    try {
      await click();
    } catch (e) {
      failures.push(`[195] 浮层「${label}」点不开(${String(e).slice(0, 60)})—— 判据没量到东西`);
      return;
    }
    await page.waitForTimeout(700);
    checked += 1;
    zoomSeen += 1;
    if (label === "装备详情") {
      checked += 1;
      const dossier = await readEquipmentFrames();
      const seen = new Set(dossier.frames.flatMap((frame) => frame.classes));
      const required = [
        "equip-dossier__hero",
        "equip-dossier__power",
        "equip-dossier__sheet",
        "equip-dossier__workshop",
      ];
      if (
        !dossier.found ||
        dossier.heroAfter !== "none" ||
        required.some((name) => !seen.has(name)) ||
        dossier.frames.some((frame) => frame.borders[1] !== 0)
      ) {
        failures.push(`[195] 器评帖又逐段套回四边框:${JSON.stringify(dossier)}`);
      }
      checked += 1;
      const batch = await readOpenLedger(".batch-spend-ledger");
      if (!batch || batch.borderRight !== 0 || batch.radius !== 0) {
        failures.push(`[195] 连强预算又长回四边卡:${JSON.stringify(batch)}`);
      }
    }
    if (label === "装备详情 · 自动重铸") {
      checked += 1;
      const auto = await readOpenLedger("[data-equipment-auto-reforge]");
      if (
        !auto ||
        auto.borderTop !== 1 ||
        auto.borderRight !== 0 ||
        auto.borderBottom !== 0 ||
        auto.borderLeft !== 0 ||
        auto.radius !== 0 ||
        auto.background !== "rgba(0, 0, 0, 0)"
      ) {
        failures.push(`[195] 自动重铸又套回内层卡壳:${JSON.stringify(auto)}`);
      }
      checked += 1;
      const sealPrice = await readOpenLedger("[data-equipment-seal-price]");
      if (
        !sealPrice ||
        sealPrice.borderRight !== 0 ||
        sealPrice.radius !== 0 ||
        sealPrice.background !== "rgba(0, 0, 0, 0)"
      ) {
        failures.push(`[195] 封存价签又长回按钮样:${JSON.stringify(sealPrice)}`);
      }
    }
    if (label === "装备详情 · 同槽对比") {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.waitForTimeout(420);
      checked += 1;
      const figures = await readEquipmentFigureLines();
      if (
        figures.compare !== 1 ||
        figures.cost < 2 ||
        figures.figures.some((row) => row.lines > 1)
      ) {
        failures.push(`[1280] 器评帖的换装对比或分解代价被拆行:${JSON.stringify(figures)}`);
      }
      await page.setViewportSize({ width: 195, height: 422 });
      await page.waitForTimeout(300);
    }
    if (label === "灵脉投资") {
      await assertLedgerWithoutCard("灵脉浮层", "[data-vein-ledger]", false);
      checked += 1;
      const rows = await readVeinRows();
      if (
        !rows.costs.length ||
        rows.costs.some((row) => row.lines > 1) ||
        rows.names.some((row) => row.clipped)
      ) {
        failures.push(`[195] 灵脉投资行被拆行或截名:${JSON.stringify(rows)}`);
      }
    }
    if (label === "天道熔炉") {
      await assertLedgerWithoutCard("天道熔炉", "[data-furnace-ledger]");
    }
    if (label === "关于此作") {
      await assertLedgerWithoutCard("关于浮层外框", "[data-about-surface]", false);
      await assertLedgerWithoutCard("关于浮层账线", "[data-about-ledger]");
    }
    if (label === "数值体系") {
      await assertLedgerWithoutCard("数值体系外框", "[data-progression-surface]", false);
      await assertLedgerWithoutCard("数值体系账线", "[data-progression-ledger]");
    }
    if (label === "道痕纪元变迁") {
      await assertLedgerWithoutCard("道痕纪元变迁", "[data-era-ledger]");
      checked += 1;
      const mobileEra = await readEraLedger();
      if (
        !mobileEra.found ||
        mobileEra.entries < 1 ||
        mobileEra.cards !== 0 ||
        !mobileEra.text.includes("纪元 19.0") ||
        !mobileEra.insidePanel
      ) {
        failures.push(`[195] 道痕纪元变迁账没读全或又套回卡壳:${JSON.stringify(mobileEra)}`);
      }
      if (SHOTS) {
        mkdirSync(SHOTS_DIR, { recursive: true });
        await page.screenshot({ path: join(SHOTS_DIR, "195-celestial-era-ledger.png") });
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await settleVisuals(page);
      checked += 1;
      const wideEra = await readEraLedger();
      if (!wideEra.found || wideEra.entries < 1 || wideEra.cards !== 0 || !wideEra.insidePanel) {
        failures.push(`[390] 道痕纪元变迁账没有沿卷身续排:${JSON.stringify(wideEra)}`);
      }
      if (SHOTS) {
        await page.screenshot({ path: join(SHOTS_DIR, "390-celestial-era-ledger.png") });
      }
    }
    if (label === "灵草坊") {
      const checkHerbShop = async (tag, maxRowHeight) => {
        checked += 1;
        const shop = await readHerbShopLedger();
        const insidePanel = (button) =>
          button.left >= (shop?.panelLeft ?? 0) - 2 && button.right <= (shop?.panelRight ?? 0) + 2;
        if (
          !shop ||
          shop.borderTop !== 1 ||
          shop.borderBottom !== 1 ||
          shop.borderRight !== 0 ||
          shop.borderLeft !== 0 ||
          shop.radius !== 0 ||
          shop.background !== "rgba(0, 0, 0, 0)" ||
          shop.cards !== 0 ||
          shop.rows.length !== 5 ||
          shop.separators !== 4
        ) {
          failures.push(`[${tag}] 灵草坊又套回逐行纸卡或账线没续满:${JSON.stringify(shop)}`);
        }
        const badRows = shop?.rows.filter(
          (row) =>
            row.background !== "rgba(0, 0, 0, 0)" ||
            row.radius !== 0 ||
            row.borderRight !== 0 ||
            row.borderLeft !== 0 ||
            row.height > maxRowHeight ||
            !row.name ||
            row.name.lines !== 1 ||
            row.name.clipped ||
            row.name.width < 40 ||
            !row.facts ||
            row.facts.figures.length !== 2 ||
            row.facts.figures.some((figure) => figure.lines !== 1 || figure.clipped) ||
            (tag === "195" &&
              new Set(row.facts.figures.map((figure) => Math.round(figure.top))).size !== 2) ||
            !row.actions ||
            row.buttons.length !== 2 ||
            row.buttons.some(
              (button) =>
                button.lines !== 1 ||
                button.clipped ||
                button.height < 27.5 ||
                !insidePanel(button),
            ) ||
            (tag === "195" && row.actions.top < row.facts.bottom - 1),
        );
        if (badRows?.length) {
          failures.push(`[${tag}] 灵草坊账行仍被挤成竖排、越界或折字:${JSON.stringify(badRows)}`);
        }
      };

      await page.setViewportSize({ width: 195, height: 422 });
      await settleVisuals(page);
      await checkHerbShop("195", 240);
      if (SHOTS) {
        mkdirSync(SHOTS_DIR, { recursive: true });
        await page.screenshot({ path: join(SHOTS_DIR, "195-xian-herb-shop-ledger.png") });
      }

      await page.setViewportSize({ width: 390, height: 844 });
      await settleVisuals(page);
      await checkHerbShop("390", 190);
      if (SHOTS) {
        await page.screenshot({ path: join(SHOTS_DIR, "390-xian-herb-shop-ledger.png") });
      }
    }
    if (label === "部位候选 · 第二批") {
      // 续批会聚焦第 13 件并把账卷带下去;复核图先回到账首,整册仍留在 DOM 里量。
      await page.evaluate(() => {
        const scroller = document.querySelector("[data-folio-modal-scroll]");
        if (scroller) scroller.scrollTop = 0;
      });
      await settleVisuals(page);

      const checkSlotCandidateLedger = async (tag, maxRowHeight) => {
        checked += 1;
        const slot = await readSlotCandidateLedger();
        const transparent = "rgba(0, 0, 0, 0)";
        const insideInner = (box) =>
          Boolean(
            slot?.inner &&
            box &&
            box.left >= slot.inner.left - 2 &&
            box.right <= slot.inner.right + 2,
          );
        if (
          !slot ||
          slot.borderTop !== 1 ||
          slot.borderBottom !== 1 ||
          slot.borderRight !== 0 ||
          slot.borderLeft !== 0 ||
          slot.radius !== 0 ||
          slot.background !== transparent ||
          slot.cards !== 0 ||
          slot.rows.length < 13 ||
          slot.separators !== slot.rows.length - 1 ||
          slot.rows.filter((row) => row.equipped).length !== 1
        ) {
          failures.push(`[${tag}] 部位候选又套回逐行纸卡或长账没续满:${JSON.stringify(slot)}`);
        }
        const badRows = slot?.rows.filter(
          (row) =>
            row.paperCard ||
            row.height > maxRowHeight ||
            row.radius !== 0 ||
            row.borderRight !== 0 ||
            row.borderLeft !== 0 ||
            (!row.equipped && row.background !== transparent) ||
            !row.body ||
            row.body.right - row.body.left < 100 ||
            !row.name ||
            row.name.lines !== 1 ||
            row.name.clipped ||
            row.name.width < 40 ||
            !row.decision ||
            !insideInner(row.decision) ||
            !row.action ||
            row.action.lines !== 1 ||
            row.action.clipped ||
            row.action.height < 27.5 ||
            row.action.right - row.action.left < 40 ||
            !row.action.insideInner ||
            (!row.equipped && !row.decisionDeltaActionSameRow) ||
            (tag === "195" &&
              (!row.row ||
                row.decision.left > row.row.left + 2 ||
                row.decision.right < row.row.right - 2 ||
                !row.body ||
                row.decision.top < row.body.bottom - 1 ||
                row.action.right < row.decision.right - 2)),
        );
        if (badRows?.length) {
          failures.push(
            `[${tag}] 部位候选被挤成竖排、越界、截名或战差与动作分行:${JSON.stringify(badRows)}`,
          );
        }
      };

      await page.setViewportSize({ width: 195, height: 422 });
      await settleVisuals(page);
      await checkSlotCandidateLedger("195", 96);
      if (SHOTS) {
        mkdirSync(SHOTS_DIR, { recursive: true });
        await page.screenshot({ path: join(SHOTS_DIR, "195-xian-slot-candidate-ledger.png") });
      }

      await page.setViewportSize({ width: 390, height: 844 });
      await settleVisuals(page);
      await checkSlotCandidateLedger("390", 64);
      if (SHOTS) {
        await page.screenshot({ path: join(SHOTS_DIR, "390-xian-slot-candidate-ledger.png") });
      }
    }
    if (label === "装备详情 · 词条转移落位") {
      checked += 1;
      const transfer = await readOpenLedger("[data-equipment-affix-transfer]");
      if (
        !transfer ||
        transfer.borderTop !== 1 ||
        transfer.borderRight !== 0 ||
        transfer.borderBottom !== 0 ||
        transfer.borderLeft !== 0 ||
        transfer.radius !== 0 ||
        transfer.background !== "rgba(0, 0, 0, 0)"
      ) {
        failures.push(`[195] 词条转移又套回内层卡壳:${JSON.stringify(transfer)}`);
      }
    }
    const problems = dialogZoomProblems(await measureDialogZoom(page, { width: 390, height: 844 }));
    if (problems.length)
      failures.push(`[195] 浮层「${label}」在 200% 下坏了:${problems.join(" / ")}`);
    // 新探针会叠开两层装备详情;Escape 只收最上层,故逐层关到没有浮层为止。
    for (let i = 0; i < 3 && (await page.locator(".modal-panel").count()) > 0; i += 1) {
      await page.keyboard.press("Escape").catch(() => {});
      await page.waitForTimeout(200);
    }
    await page.waitForTimeout(200);
  };

  // 点的是藏品卡(带 data-uid),不是上面的槽位行;槽位行打开的是候选册。
  await probe("装备详情", "/inventory", async () => {
    await page.locator("main button[data-uid]").first().click({ timeout: 3000 });
  });
  await probe("装备详情 · 同槽对比", "/inventory", async () => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(INDEX + "#/inventory", { waitUntil: "load" });
    await page.waitForTimeout(1100);
    await page.locator('main button[data-uid="dlg_w2"]').first().click({ timeout: 3000 });
  });
  /*
   * 部位候选在大行囊里也会长到几十条。195px 下既要能读分页读数与两枚入口,
   * 续到第二批后也不能把候选行、战差与「换上」挤成竖排。
   */
  await probe("部位候选 · 第二批", "/inventory", async () => {
    await page.locator('[data-equip-slot="weapon"]').first().click({ timeout: 3000 });
    await page.locator("[data-slot-candidate-more]").first().click({ timeout: 3000 });
  });
  /*
   * 自动重铸此前只量到装备详情外壳,展开后的阈值滑杆 / 预算行从未进过 200% 档。
   * 195 CSS px 下实测滑杆与「开 洗」会顶出面板右侧;这条把「展开后再量」也钉住。
   */
  await probe("装备详情 · 自动重铸", "/inventory", async () => {
    await page
      .locator("main button", { hasText: /雾隐长枪/ })
      .first()
      .click({ timeout: 3000 });
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /雾隐长枪/ })
      .click({ timeout: 3000 });
    await page.getByRole("button", { name: /自动重铸/ }).click({ timeout: 3000 });
    await page
      .getByRole("button", { name: /约 .* 次/ })
      .first()
      .click({ timeout: 3000 });
  });
  /*
   * 转移面板的标题、长说明与「收起」共享一行;195px 下标题会被挤成 12px 竖排。
   * 一路点到候选与落位,把标题之后的单据行也纳入同一扇弹窗。
   */
  await probe("装备详情 · 词条转移落位", "/inventory", async () => {
    await page
      .locator("main button", { hasText: /雾隐长枪/ })
      .first()
      .click({ timeout: 3000 });
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /雾隐长枪/ })
      .click({ timeout: 3000 });
    await page.getByRole("button", { name: /词条转移/ }).click({ timeout: 3000 });
    const detail = page.locator(".modal-panel").filter({ hasText: /重铸词条|自动重铸/ });
    await detail.getByRole("button", { name: "绝境道心", exact: true }).click({ timeout: 3000 });
    await detail
      .locator("button")
      .filter({ hasText: /→.*仙品/ })
      .first()
      .click({ timeout: 3000 });
    await detail.getByRole("button", { name: /新增一条/ }).click({ timeout: 3000 });
  });
  await probe("开炉炼丹", "/inventory", async () => {
    const tab = page.getByRole("tab", { name: /丹/ }).first();
    if (await tab.count()) await tab.click();
    await page.waitForTimeout(400);
    await page
      .locator("main button", { hasText: /开炉炼丹/ })
      .first()
      .click({ timeout: 3000 });
  });
  await probe("灵草坊", "/inventory", async () => {
    const tab = page.getByRole("tab", { name: /丹/ }).first();
    if (await tab.count()) await tab.click();
    await page.waitForTimeout(400);
    await page
      .locator('main [data-inventory-workshop-entry="shop"]')
      .first()
      .click({ timeout: 3000 });
  });
  await probe("器魂详情", "/souls", async () => {
    await page
      .locator("main button", { hasText: /锋芒|形意/ })
      .first()
      .click({ timeout: 3000 });
  });
  await probe("灵脉投资", "/dongfu", async () => {
    await page
      .locator("main button", { hasText: /灵脉投资/ })
      .first()
      .click({ timeout: 3000 });
  });
  await probe("天道熔炉", "/celestial", async () => {
    for (let i = 0; i < 3 && (await page.locator(".modal-panel").count()) > 0; i += 1) {
      const know = page.getByRole("button", { name: "知道了" }).last();
      if (await know.count()) await know.click();
      else await page.keyboard.press("Escape");
      await page.waitForTimeout(250);
    }
    await page
      .locator("main button", { hasText: /天道熔炉/ })
      .first()
      .click({ timeout: 3000 });
  });
  // 人物页的详情浮层(点第一枚读数卡)与设置页的两份长文 —— 长文是 195 宽下最挤的一类
  await probe("人物读数详情", "/character", async () => {
    await page.locator("main button").first().click({ timeout: 3000 });
  });
  await probe("一键分解", "/inventory", async () => {
    await page
      .locator("main button", { hasText: /分\s*解/ })
      .first()
      .click({ timeout: 3000 });
  });
  await probe("关于此作", "/settings", async () => {
    await page
      .locator("main button", { hasText: /关于/ })
      .first()
      .click({ timeout: 3000 });
  });
  await probe("数值体系", "/settings", async () => {
    await page.locator("[data-settings-progression]").click({ timeout: 3000 });
  });
  await probe("道痕纪元变迁", "/celestial?tab=marks", async () => {
    await page.getByRole("button", { name: /纪元变迁史/ }).click({ timeout: 3000 });
  });
  await probe("隐私政策", "/settings", async () => {
    await page
      .locator("main button", { hasText: /隐私/ })
      .first()
      .click({ timeout: 3000 });
  });

  if (pageErrors.length)
    failures.push(`[195] 浮层场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
  await ctx.close();
  return { failures, checked, contrastFails: [], pixelContrastFails: [], zoomFails: [] };
}

/** 构建产物 · dvh/字体栈 */
async function taskBuildArtifacts() {
  const failures = [];
  let checked = 0;
  const contrastFails = [];
  const pixelContrastFails = [];
  const zoomFails = [];
  // ---- 第二十七件事:外壳高度认 dvh,不认 vh ----
  /*
   * 上面「两栏钉死」那条量的是**机制**,可无头浏览器的 100vh 恰好等于可视高度 ——
   * 把外壳换回 vh,它照样全绿。差别只在手机浏览器里出现:地址栏挂着时 vh 是大视口,
   * 底栏被压在工具栏底下。所以这条退一步查**构建产物**:外壳高度得写成 dvh。
   */
  {
    checked += 1;
    const dir = join(ROOT, "dist/assets");
    const css = readdirSync(dir)
      .filter((f) => f.endsWith(".css"))
      .map((f) => readFileSync(join(dir, f), "utf8"))
      .join("\n");
    // 认这个高度的选择器要凑齐四层 —— 少一层,那点差值就成了文档层的可滚余量
    // (压缩器会把连着的选择器并进一条规则,所以这里是按选择器查,不是按声明数数)
    const covered = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter(([, , body]) => body.includes("height:var(--app-shell-height)"))
      .flatMap(([, sel]) => sel.split(",").map((s) => s.trim()));
    const missing = ["html", "body", "#app", ".app-shell"].filter((s) => !covered.includes(s));
    if (missing.length)
      failures.push(`外壳高度没铺满四层,缺 ${missing.join(" / ")}(少一层就攒出可滚余量)`);
    if (!css.includes("100dvh")) {
      failures.push("外壳高度没走 dvh(手机浏览器地址栏挂在外面时,底栏会被压住)");
    }
    /*
     * 样式表要先于模块预载排队。
     *
     * Vite 默认把入口 CSS 放在几十条 modulepreload 后面,4G 冷启动时预载 JS
     * 会先把连接池占满,FCP 只能等样式最后一个到。插件只调换标签顺序;这条
     * 直接查构建产物,避免以后换构建器或插件顺序时静默退回。
     */
    checked += 1;
    const indexHtml = readFileSync(join(ROOT, "dist/index.html"), "utf8");
    const stylesheetAt = indexHtml.search(/<link\b[^>]*\brel="stylesheet"/);
    const moduleAt = indexHtml.search(
      /<(?:script\b[^>]*\btype="module"|link\b[^>]*\brel="modulepreload")/,
    );
    if (stylesheetAt < 0) {
      failures.push("构建产物没有入口样式表");
    } else if (moduleAt >= 0 && stylesheetAt > moduleAt) {
      failures.push("入口样式表仍排在模块预载之后 —— 冷启动首帧会先等几十个 JS 请求");
    }
    /*
     * 楷体栈:内置那份必须**排第一**。
     *
     * 这条只能查产物,查运行时没有意义:无头容器里没有系统楷体,排在第四位也一样会被
     * 选中 —— 绿得毫无信息。而真机上的差别恰恰全在次序里(iOS 会命中华文楷体、Windows
     * 会命中楷体,三端于是三种字形)。谁要是「顺手优化」把次序换回系统优先,只有这条拦得住。
     */
    const kaiRule = /--font-kai:([^;}]*)/.exec(css);
    if (!kaiRule) {
      failures.push("构建产物里找不到 --font-kai(字体栈的唯一事实源在 src/style.css)");
    } else if (!/^\s*"?LXGW WenKai"?/.test(kaiRule[1])) {
      failures.push(
        `楷体栈第一位不是内置字体(现在是${kaiRule[1].slice(0, 40)}…)—— 三端会各用各的系统楷体`,
      );
    } else if (!/Kaiti SC|KaiTi/.test(kaiRule[1])) {
      failures.push("楷体栈里没了系统楷体兜底 —— 子集外的生僻字会直接掉到衬线");
    }

    /*
     * JS 单块上限与加密库分包。
     *
     * 此前 player 组 504KB,构建器每次都在报告末尾发「chunk >500KB」警告,但没有任何
     * 门会因此失败 —— 警告看久了就等同于不存在。crypto-js 稳定、独立,拆成 vendor-crypto
     * 后 player 降到约 486KB、首屏总字节几乎不变;这里把两件事一起钉住:
     *   ① 任一块 JS 超过 500,000 字节即红(与构建器警告同一条线);
     *   ② vendor-crypto 必须真在产物里,否则配置被删了、警告也会悄悄回来。
     */
    checked += 1;
    const jsChunks = readdirSync(dir)
      .filter((f) => f.endsWith(".js"))
      .map((f) => ({ name: f, bytes: statSync(join(dir, f)).size }));
    const oversized = jsChunks.filter((chunk) => chunk.bytes > 500_000);
    if (oversized.length) {
      failures.push(
        `构建产物有 ${oversized.length} 个 JS 块超过 500KB:${oversized
          .sort((a, b) => b.bytes - a.bytes)
          .map((chunk) => `${chunk.name} ${(chunk.bytes / 1024).toFixed(1)}KB`)
          .join(" / ")}`,
      );
    }
    if (!jsChunks.some((chunk) => /^vendor-crypto-.*\.js$/.test(chunk.name))) {
      failures.push("构建产物里没有 vendor-crypto —— crypto-js 又被并回 player,500KB 警告会回来");
    }
  }

  return { failures, checked, contrastFails, pixelContrastFails, zoomFails };
}

/**
 * 开局前两页(见第四十六件事)。
 *
 * /welcome 与 /create 是「没有存档才看得见」的页面:路由守卫见存档已开就把它们
 * 重定向回首页,巡页 ROUTES 永远巡不到 —— 此前这两页从未被量过,而它们恰是
 * 每个新玩家的第一屏(字体最大的一屏、表单页)。这里开一个**无存档**的 context:
 * 直接落在欢迎页量一遍,再走「启封入山 → 署印入山」落到建号页量一遍。
 *
 * 判据只取基础档,且是 measurePage 的**子集**:底部导航项数、顶栏折行、页签栏
 * 这些判据以「游戏内页面」为前提,开局前两页没有导航与顶栏,硬套只会量出假红。
 */
async function taskPreGameTour() {
  const failures = [];
  let checked = 0;
  const contrastFails = [];
  const ctx = await auditContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  const pageErrors = [];
  watchPageErrors(page, pageErrors);

  /** 基础档量尺:measurePage 的开局前子集(排版事故 + 控件名 + 触达下限) */
  const measureBasic = () =>
    page.evaluate(() => {
      // 与 measurePage 同一条口径:测量前禁动画 —— stagger-in 入场位移的
      // 中间帧不该被当成排版事故(开局页的灵根圆环曾在此被量出假越界)。
      const st = document.createElement("style");
      st.textContent = "*,*::before,*::after{animation:none!important;transition:none!important}";
      document.head.appendChild(st);
      const vw = window.innerWidth;
      const overflows = [...document.querySelectorAll("body *")]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          const rightOver = r.right > vw + 2;
          const leftOver = r.left < -1;
          if (r.width <= 0 || (!rightOver && !leftOver)) return false;
          // 纯装饰层(不吃事件)不算排版事故 —— 与 measurePage 同一条口径
          for (let node = el; node; node = node.parentElement) {
            if (getComputedStyle(node).pointerEvents === "none") return false;
          }
          return true;
        })
        .slice(0, 4)
        .map((el) => {
          const r = el.getBoundingClientRect();
          const side = r.left < -1 ? "L" : r.right > vw + 2 ? "R" : "?";
          return `${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]}@${side}${Math.round(r.left)}..${Math.round(r.right)}`;
        });
      return {
        hash: location.hash,
        horizontalOverflow: document.documentElement.scrollWidth > vw + 1,
        shellShift: (() => {
          const shell = document.getElementById("app")?.firstElementChild;
          if (!shell) return null;
          return {
            scrollLeft: Math.round(shell.scrollLeft),
            overflowX: Math.round(shell.scrollWidth - shell.clientWidth),
          };
        })(),
        contentShift: (() => {
          const main = document.querySelector("main");
          if (!main) return null;
          return {
            scrollLeft: Math.round(main.scrollLeft),
            scrollWidth: Math.round(main.scrollWidth),
            clientWidth: Math.round(main.clientWidth),
            overflowX: Math.round(main.scrollWidth - main.clientWidth),
          };
        })(),
        overflows,
        unnamed: [...document.querySelectorAll("button, a, [role=button]")]
          .filter((el) => {
            const name = (el.getAttribute("aria-label") || el.textContent || "").trim();
            if (name) return false;
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0;
          })
          .slice(0, 3)
          .map((el) => el.outerHTML.slice(0, 80).replace(/\s+/g, " ")),
        smallTargets: [...document.querySelectorAll("button, a, [role=button]")]
          .map((el) => {
            const r = el.getBoundingClientRect();
            const declared = parseFloat(getComputedStyle(el).minHeight);
            return { el, r, declared: Number.isFinite(declared) ? declared : 0 };
          })
          .filter(
            ({ r, declared }) =>
              r.width > 0 && r.height > 0 && r.height < 28 && !(declared >= 28 && r.height >= 27.5),
          )
          .slice(0, 3)
          .map(
            ({ el, r, declared }) =>
              `${r.height.toFixed(1)}px(声明 ${declared || "—"}px)«${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 12)}» [${(el.className || "").toString().slice(0, 60)}]`,
          ),
        firstScreenAction: (() => {
          const el = document.querySelector("[data-opening-enter], [data-opening-reroll]");
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return {
            name: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 16),
            top: Math.round(r.top),
            bottom: Math.round(r.bottom),
            viewport: window.innerHeight,
          };
        })(),
      };
    });

  const problemsOfBasic = (info) => {
    const problems = [];
    if (info.horizontalOverflow) problems.push(`横向溢出(scrollWidth ${info.hash})`);
    if (info.shellShift && (info.shellShift.scrollLeft !== 0 || info.shellShift.overflowX > 1))
      problems.push(
        `外壳被滚偏(scrollLeft ${info.shellShift.scrollLeft} / 横向可滚 ${info.shellShift.overflowX}px)`,
      );
    if (info.contentShift && info.contentShift.scrollLeft !== 0)
      problems.push(`主内容区被滚偏(scrollLeft ${info.contentShift.scrollLeft}px)`);
    if (info.contentShift && info.contentShift.overflowX > 1)
      problems.push(
        `主内容区横向可滚(${info.contentShift.scrollWidth}>${info.contentShift.clientWidth},余 ${info.contentShift.overflowX}px)`,
      );
    if (info.overflows.length) problems.push(`越界元素:${info.overflows.join(", ")}`);
    if (info.unnamed.length) problems.push(`无名控件:${info.unnamed.join(" | ")}`);
    if (info.smallTargets.length)
      problems.push(`可点元素过小(触控下限 28×28):${info.smallTargets.join(" | ")}`);
    return problems;
  };

  /**
   * 开局两页同读一枚章首：这里量 DOM 里真实出现的章序、章首文字与卡壳，
   * 不靠源码字符串猜。`register` 自己可以留上下账线，但章与章不该再各包四边。
   */
  const chapterAudit = (selector) =>
    page.evaluate((rootSelector) => {
      const register = document.querySelector(rootSelector);
      const chapters = [...(register?.querySelectorAll(":scope > [data-opening-chapter]") ?? [])];
      const borderSides = (el) => {
        const style = getComputedStyle(el);
        return [
          style.borderTopWidth,
          style.borderRightWidth,
          style.borderBottomWidth,
          style.borderLeftWidth,
        ]
          .map((value) => parseFloat(value) || 0)
          .filter((value) => value > 0).length;
      };
      return {
        ids: chapters.map((el) => el.getAttribute("data-opening-chapter")),
        heads: chapters.map((chapter) => ({
          id: chapter.getAttribute("data-opening-chapter"),
          index: (chapter.querySelector(".folio-chapter-head__index")?.textContent || "").trim(),
          eyebrow: (
            chapter.querySelector(".folio-chapter-head__eyebrow")?.textContent || ""
          ).trim(),
          title: (chapter.querySelector(".folio-chapter-head__title")?.textContent || "").trim(),
          hint: (chapter.querySelector(".folio-chapter-head__hint")?.textContent || "").trim(),
          fact: (chapter.querySelector(".folio-chapter-head__fact")?.textContent || "").trim(),
          borderSides: borderSides(chapter),
          radius: getComputedStyle(chapter).borderRadius,
          shadow: getComputedStyle(chapter).boxShadow,
        })),
        registerBorderSides: register ? borderSides(register) : -1,
      };
    }, selector);

  // ---- 欢迎页:无存档冷启动就该落在这里 ----
  await page.goto(INDEX, { waitUntil: "load" });
  await page.waitForTimeout(900);
  await settleVisuals(page);
  {
    if (SHOTS) {
      mkdirSync(SHOTS_DIR, { recursive: true });
      await page.screenshot({ path: join(SHOTS_DIR, "390_welcome.png"), fullPage: true });
    }
    const info = await measureBasic();
    checked += 1;
    if (!info.hash.includes("welcome"))
      failures.push(`[开局前] 无存档冷启动落在 ${info.hash},应落在欢迎页`);
    const problems = problemsOfBasic(info);
    if (problems.length) failures.push(`[开局前] /welcome → ${problems.join(" / ")}`);
    if (!info.firstScreenAction) {
      failures.push("[开局前] /welcome 首屏没有「启封入山」主入口");
    } else if (info.firstScreenAction.bottom > info.firstScreenAction.viewport - 8) {
      failures.push(
        `[开局前] /welcome 首屏主入口被推到折线以下(${info.firstScreenAction.top}..${info.firstScreenAction.bottom} / ${info.firstScreenAction.viewport})`,
      );
    }
    const gate = await chapterAudit("[data-opening-gate-register]");
    if (gate.ids.join("|") !== "gate|rules") {
      failures.push(`[开局前] /welcome 章序不是山门 → 三则:${gate.ids.join(" → ")}`);
    }
    if (
      gate.heads.length !== 2 ||
      gate.heads.some(
        (head) => !head.index || !head.eyebrow || !head.title || !head.hint || !head.fact,
      )
    ) {
      failures.push(`[开局前] /welcome 章首读数缺项:${JSON.stringify(gate.heads)}`);
    }
    const gateFramed = gate.heads.filter(
      (head) => head.borderSides >= 4 || head.radius !== "0px" || head.shadow !== "none",
    );
    if (gateFramed.length) {
      failures.push(`[开局前] /welcome 山门与三则又套回了卡壳:${JSON.stringify(gateFramed)}`);
    }
    const gateCta = await page
      .locator('[data-opening-chapter="gate"] [data-opening-enter]')
      .count();
    if (gateCta !== 1) failures.push("[开局前] /welcome 主入口没有留在山门章内");
    await quiesceOverlays(page);
    for (const bad of await measureTextContrast(page)) {
      contrastFails.push(
        `[开局前] /welcome ${bad.theme} ${bad.ratio}:1(需 ${bad.need})${bad.size}px «${bad.text}»`,
      );
    }
    /*
     * 开局前两页也要过 200% 那一档。
     *
     * 它们是唯二**没有存档才看得见**的页面(路由守卫见存档已开就重定向),主巡页
     * 的缩放档那一遍永远巡不到。旧欢迎页曾在这一档把主钮折成两行、
     * 把三枚底链各压成 25px 宽的四字竖排 —— 而这是玩家看到的第一屏。
     */
    zoomSeen += 1;
    const welcomeZoom = zoomProblems(
      await measureZoomScale(page, { width: 390, height: 844 }),
      "390",
    );
    if (welcomeZoom.length)
      failures.push(`[开局前] /welcome 在 200% 下坏了:${welcomeZoom.join(" / ")}`);
  }

  // ---- 入山契:未勾选不可署印,取消后重开必须回到未勾选 ----
  await page
    .getByRole("button", { name: /启封入山/ })
    .first()
    .click();
  await page.waitForTimeout(600);
  {
    const pact = page.locator("[data-opening-pact]");
    const agree = page.locator("[data-opening-pact-agree]");
    const seal = page.getByRole("button", { name: /署印入山/ }).first();
    if (!(await pact.isVisible())) failures.push("[开局前] 启封入山后没有摊开入山契");
    if (!(await seal.isDisabled())) failures.push("[开局前] 入山契尚未勾选,署印键却已可用");

    await page
      .getByRole("button", { name: /《隐私政策》/ })
      .first()
      .click();
    await page.waitForTimeout(450);
    if (!(await page.locator("[data-privacy-ledger]").isVisible()))
      failures.push("[开局前] 入山契里的《隐私政策》没有摊开隐私总账");
    const privacyAudit = await auditModalControls(page, "[data-privacy-ledger]");
    if (!privacyAudit || privacyAudit.count === 0)
      failures.push("[开局前] 隐私总账里一个控件都没数到,判据没跑到东西");
    if (privacyAudit?.unnamed.length)
      failures.push(`[开局前] 隐私总账里有 ${privacyAudit.unnamed.length} 个无名控件`);
    if (privacyAudit?.small.length)
      failures.push(`[开局前] 隐私总账里可点元素过小:${privacyAudit.small.join(" | ")}`);
    if (SHOTS) {
      mkdirSync(SHOTS_DIR, { recursive: true });
      await page.screenshot({ path: join(SHOTS_DIR, "390_privacy_ledger.png"), fullPage: true });
    }
    zoomSeen += 1;
    const privacyZoom = dialogZoomProblems(
      await measureDialogZoom(page, { width: 390, height: 844 }, "[data-privacy-ledger]"),
    );
    if (privacyZoom.length)
      failures.push(`[开局前] 隐私总账在 200% 下坏了:${privacyZoom.join(" / ")}`);
    await page.getByRole("button", { name: /知道了/ }).click();
    await page.waitForTimeout(450);
    if (!(await pact.isVisible())) failures.push("[开局前] 合上隐私总账后没有回到入山契");
    checked += 1;

    await agree.check();
    if (await seal.isDisabled()) failures.push("[开局前] 已勾选入山契,署印键仍不可用");
    const modalAudit = await auditModalControls(page);
    if (!modalAudit || modalAudit.count === 0)
      failures.push("[开局前] 入山契里一个控件都没数到,判据没跑到东西");
    if (modalAudit?.unnamed.length)
      failures.push(`[开局前] 入山契里有 ${modalAudit.unnamed.length} 个无名控件`);
    if (modalAudit?.small.length)
      failures.push(`[开局前] 入山契里可点元素过小:${modalAudit.small.join(" | ")}`);
    if (SHOTS) {
      mkdirSync(SHOTS_DIR, { recursive: true });
      await page.screenshot({ path: join(SHOTS_DIR, "390_welcome_pact.png"), fullPage: true });
    }
    zoomSeen += 1;
    const pactZoom = dialogZoomProblems(await measureDialogZoom(page, { width: 390, height: 844 }));
    if (pactZoom.length) failures.push(`[开局前] 入山契在 200% 下坏了:${pactZoom.join(" / ")}`);
    await page.getByRole("button", { name: /再想想/ }).click();
    await page.waitForTimeout(350);
    await page
      .getByRole("button", { name: /启封入山/ })
      .first()
      .click();
    await page.waitForTimeout(600);
    if (await agree.isChecked()) failures.push("[开局前] 取消入山契后再次开契,上次勾选仍残留");
    if (!(await seal.isDisabled())) failures.push("[开局前] 重开入山契后未勾选,署印键却已可用");
    checked += 1;
  }

  // ---- 建号页:署印后由欢迎页进来(传送门约 2.5s) ----
  await page.locator("[data-opening-pact-agree]").check();
  await page
    .getByRole("button", { name: /署印入山/ })
    .first()
    .click();
  await page.waitForTimeout(3200);
  await settleVisuals(page);
  {
    if (SHOTS) {
      mkdirSync(SHOTS_DIR, { recursive: true });
      await page.screenshot({ path: join(SHOTS_DIR, "390_create.png"), fullPage: true });
    }
    const info = await measureBasic();
    checked += 1;
    if (!info.hash.includes("create"))
      failures.push(`[开局前] 同意隐私后落在 ${info.hash},应落在建号页`);
    const problems = problemsOfBasic(info);
    if (problems.length) failures.push(`[开局前] /create → ${problems.join(" / ")}`);
    if (!info.firstScreenAction) {
      failures.push("[开局前] /create 首屏没有「逆天改命」入口");
    } else if (info.firstScreenAction.bottom > info.firstScreenAction.viewport - 8) {
      failures.push(
        `[开局前] /create 首屏重掷入口被推到折线以下(${info.firstScreenAction.top}..${info.firstScreenAction.bottom} / ${info.firstScreenAction.viewport})`,
      );
    }
    const create = await chapterAudit("[data-opening-create-register]");
    if (create.ids.join("|") !== "name|roots|vow") {
      failures.push(`[开局前] /create 章序不是留名 → 验根 → 定卷:${create.ids.join(" → ")}`);
    }
    if (
      create.heads.length !== 3 ||
      create.heads.some(
        (head) => !head.index || !head.eyebrow || !head.title || !head.hint || !head.fact,
      )
    ) {
      failures.push(`[开局前] /create 章首读数缺项:${JSON.stringify(create.heads)}`);
    }
    const createFramed = create.heads.filter(
      (head) => head.borderSides >= 4 || head.radius !== "0px" || head.shadow !== "none",
    );
    if (createFramed.length) {
      failures.push(`[开局前] /create 三章又套回了卡壳:${JSON.stringify(createFramed)}`);
    }
    if (create.registerBorderSides > 2) {
      failures.push(`[开局前] /create 命书外层又成四面框(${create.registerBorderSides} 边)`);
    }
    if (!(await page.locator('[data-opening-chapter="roots"][data-opening-roots]').count())) {
      failures.push("[开局前] /create 验根章里没有真实灵根盘");
    }
    await quiesceOverlays(page);
    for (const bad of await measureTextContrast(page)) {
      contrastFails.push(
        `[开局前] /create ${bad.theme} ${bad.ratio}:1(需 ${bad.need})${bad.size}px «${bad.text}»`,
      );
    }
    zoomSeen += 1;
    const createZoom = zoomProblems(
      await measureZoomScale(page, { width: 390, height: 844 }),
      "390",
    );
    if (createZoom.length)
      failures.push(`[开局前] /create 在 200% 下坏了:${createZoom.join(" / ")}`);
  }

  /*
   * 桌面开局页不是放大的手机单列:欢迎页的「山门 / 三则」与建号页的
   * 「留名 / 验根」都应在宽屏并读。这里仍用无存档 context,免得主巡页
   * 因路由守卫根本看不到这两页。
   */
  await page.setViewportSize({ width: 768, height: 1024 });
  await settleVisuals(page);
  {
    const leaf = await page.locator(".app-shell").evaluate((shell) => {
      const rect = shell.getBoundingClientRect();
      return {
        width: Math.round(rect.width),
        left: Math.round(rect.left),
        right: Math.round(innerWidth - rect.right),
      };
    });
    if (leaf.width < 700) {
      failures.push(`[开局前] 开局宽叶仍收成手机窄栏(${leaf.width}px / 应约 736px)`);
    }
    if (Math.abs(leaf.left - leaf.right) > 2) {
      failures.push(`[开局前] 开局宽叶没有居中(${leaf.left} / ${leaf.right})`);
    }
    const problems = problemsOfBasic(await measureBasic());
    if (problems.length) failures.push(`[开局前] /create 平板 → ${problems.join(" / ")}`);
    checked += 1;
  }

  await page.setViewportSize({ width: 1280, height: 800 });
  await settleVisuals(page);
  {
    const columns = await page.locator("[data-opening-create-register]").evaluate((el) => {
      const value = getComputedStyle(el).gridTemplateColumns;
      return value.split(/\s+/).filter(Boolean).length;
    });
    if (columns !== 3)
      failures.push(`[开局前] /create 宽桌面没有并读留名 / 验根 / 定卷(${columns} 列)`);
    const createColumns = await page
      .locator("[data-opening-create-register] > [data-opening-chapter]")
      .evaluateAll((chapters) =>
        chapters.map((chapter) => ({
          id: chapter.getAttribute("data-opening-chapter"),
          left: Math.round(chapter.getBoundingClientRect().left),
          width: Math.round(chapter.getBoundingClientRect().width),
        })),
      );
    const nameColumn = createColumns.find((chapter) => chapter.id === "name");
    const rootsColumn = createColumns.find((chapter) => chapter.id === "roots");
    const vowColumn = createColumns.find((chapter) => chapter.id === "vow");
    if (
      !nameColumn ||
      !rootsColumn ||
      !vowColumn ||
      !(nameColumn.left < rootsColumn.left && rootsColumn.left < vowColumn.left)
    ) {
      failures.push(`[开局前] /create 宽桌面三章没有按留名 → 验根 → 定卷并读`);
    }
    if (!(await page.locator('[data-opening-chapter="vow"] .opening-create__begin').isVisible())) {
      failures.push("[开局前] /create 宽桌面首屏看不见定卷主入口");
    }
    const problems = problemsOfBasic(await measureBasic());
    if (problems.length) failures.push(`[开局前] /create 桌面 → ${problems.join(" / ")}`);
    if (SHOTS) {
      await page.screenshot({ path: join(SHOTS_DIR, "1280x800_create.png"), fullPage: true });
    }
    checked += 1;
  }

  await page
    .getByRole("link", { name: /欢迎/ })
    .first()
    .click();
  await page.waitForTimeout(500);
  await settleVisuals(page);
  {
    const columns = await page.locator("[data-opening-gate-register]").evaluate((el) => {
      const value = getComputedStyle(el).gridTemplateColumns;
      return value.split(/\s+/).filter(Boolean).length;
    });
    if (columns < 2) failures.push(`[开局前] /welcome 桌面上没有并读山门与三则(${columns} 列)`);
    const problems = problemsOfBasic(await measureBasic());
    if (problems.length) failures.push(`[开局前] /welcome 桌面 → ${problems.join(" / ")}`);
    if (SHOTS) {
      await page.screenshot({ path: join(SHOTS_DIR, "1280x800_welcome.png"), fullPage: true });
    }
    checked += 1;
  }

  if (pageErrors.length) failures.push(`[开局前] 页面异常:${[...new Set(pageErrors)].join(" | ")}`);
  await page.close();
  return { failures, checked, contrastFails, pixelContrastFails: [], zoomFails: [] };
}

/* ==========================================================================
 * 并发调度 —— 任务之间互不等待,谁都不再替别人的等待买单
 * ========================================================================== */
function makeReport() {
  return { failures: [], checked: 0, contrastFails: [], pixelContrastFails: [], zoomFails: [] };
}

/** 并发路数:`--jobs N` > `LAYOUT_JOBS` > 按核数自适应(CI 少核也不会把内存打爆) */
const JOBS = (() => {
  const i = process.argv.indexOf("--jobs");
  if (i > 0) {
    const n = Number(process.argv[i + 1]);
    if (Number.isFinite(n) && n >= 1) return Math.floor(n);
  }
  const env = Number(process.env.LAYOUT_JOBS);
  if (Number.isFinite(env) && env >= 1) return Math.floor(env);
  return Math.max(2, Math.min(8, (cpus().length || 4) - 1));
})();

/**
 * 修行页只铺四味速服丹;余量要报数,并提供能真正落到丹匣的直达入口。
 *
 * 展品档恰好有五味可速服丹药:前四味进快捷栏,第五味只该在「另有 1 味」里出现。
 * 判据走玩家真实路径:320 窄屏看余量 → 195(200% 档的有效宽度)看入口不挤 →
 * 点进背包后「丹药」页签必须已选中且丹匣内容在场。
 */
async function taskQuickPillOverflow() {
  const failures = [];
  let checked = 0;
  const ctx = await auditContext({
    viewport: { width: 320, height: 568 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  try {
    await seedSave(ctx, showcaseSlices("light"), "__quickPillFixture");
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      Math.random = () => 1;
    });
    const pageErrors = [];
    watchPageErrors(page, pageErrors);

    await page.goto(INDEX + "#/cultivation", { waitUntil: "load" });
    const cards = page.locator("[data-quick-pill]");
    await cards.first().waitFor({ state: "visible", timeout: 10000 });
    const instanceCount = await cards.count();
    const hidden = page.locator("[data-quick-pills-hidden]").first();
    const hiddenCount = await hidden.count();
    const hiddenText = hiddenCount
      ? ((await hidden.textContent()) || "").replace(/\s+/g, " ").trim()
      : "";
    const hiddenLabel = hiddenCount ? ((await hidden.getAttribute("aria-label")) || "").trim() : "";
    checked += 1;
    if (instanceCount !== 4) {
      failures.push(`[320] 修行速服应只铺前四味,实见 ${instanceCount} 味`);
    }
    if (hiddenCount === 0) {
      failures.push("[320] 第五味丹药被静默截掉了 —— 没有「另有 N 味」入口");
    } else {
      if (!/另有\s*1\s*味/.test(hiddenText) || !/去丹匣/.test(hiddenText)) {
        failures.push(`[320] 余量入口没把数与去处说全:«${hiddenText}»`);
      }
      if (!/另有\s*1\s*味可服丹药.*前往丹匣查看/.test(hiddenLabel)) {
        failures.push(`[320] 余量入口的可访问名说不清:«${hiddenLabel}»`);
      }
    }

    if (hiddenCount > 0) {
      await page.setViewportSize({ width: 195, height: 422 });
      await settleVisuals(page);
      const fit = await hidden.evaluate((el) => {
        const row = el.getBoundingClientRect();
        const kids = [...el.querySelectorAll("span")].map((span) => {
          const r = span.getBoundingClientRect();
          return { left: r.left, right: r.right, width: r.width };
        });
        return {
          left: row.left,
          right: row.right,
          width: row.width,
          height: row.height,
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
          viewport: window.innerWidth,
          kids,
        };
      });
      checked += 1;
      const outside =
        fit.left < -1 ||
        fit.right > fit.viewport + 1 ||
        fit.kids.some((r) => r.right > fit.right + 1);
      const clipped = fit.scrollWidth > fit.clientWidth + 1;
      if (outside || clipped) {
        failures.push(
          `[195] 余量入口被挤坏:盒 ${Math.round(fit.left)}..${Math.round(fit.right)} / ` +
            `内容 ${fit.scrollWidth}>${fit.clientWidth} / 视口 ${fit.viewport}`,
        );
      }
      if (fit.height < 27.5) {
        failures.push(
          `[195] 余量入口只有 ${Math.round(fit.height * 10) / 10}px 高,低于 28px 触达下限`,
        );
      }

      await page.setViewportSize({ width: 320, height: 568 });
      await settleVisuals(page);
      await hidden.click({ timeout: 5000 });
      const arrived = await page
        .waitForFunction(
          () =>
            location.hash === "#/inventory?tab=pill" &&
            document.body.innerText.includes("开炉炼丹"),
          { timeout: 10000 },
        )
        .then(() => true)
        .catch(() => false);
      checked += 1;
      if (!arrived) {
        failures.push("[320] 点「去丹匣」没有落到背包丹药页 —— 余量入口仍是断头路");
      } else {
        const selected = await page
          .getByRole("tab", { name: /丹药/ })
          .first()
          .getAttribute("aria-selected");
        checked += 1;
        if (selected !== "true") {
          failures.push("[320] 已到 /inventory?tab=pill,但「丹药」页签没有选中");
        }
      }
    }

    if (pageErrors.length)
      failures.push(`[320] 速服余量场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
  } finally {
    await ctx.close();
  }
  return { failures, checked, contrastFails: [], pixelContrastFails: [], zoomFails: [] };
}

/**
 * 修行页三册功法 —— 终局 66 部,外层 max-h-72 只裁视觉不裁 DOM。
 *
 * 用全习得夹具逐门走完:每门首批 12、最多留 24、末页可回翻;换门回首批且焦点
 * 留在页签。辅修卸下后该部会从置顶落到低品位置,窗口要重开到它所在批,关闭详情
 * 后 BaseModal 仍能把焦点还给同一部 —— 否则玩家刚操作完就被抛回页顶。
 */
async function taskGongfaListOverflow() {
  const failures = [];
  let checked = 0;
  const ctx = await auditContext({
    viewport: { width: 320, height: 568 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  try {
    const counts = {
      main: GONGFA.filter((gongfa) => gongfa.type === "main").length,
      sub: GONGFA.filter((gongfa) => gongfa.type === "sub").length,
      secret: GONGFA.filter((gongfa) => gongfa.type === "secret").length,
    };
    const seededSub =
      GONGFA.find((gongfa) => gongfa.type === "sub" && gongfa.quality === "mortal") ??
      GONGFA.find((gongfa) => gongfa.type === "sub");
    const batchMain = GONGFA.find((gongfa) => gongfa.type === "main" && gongfa.maxLevel > 2);
    if (!seededSub || !batchMain || counts.main === 0 || counts.sub === 0 || counts.secret === 0) {
      throw new Error("功法全习得夹具取不到三册内容");
    }
    const batchFrom = batchMain.maxLevel - 2;

    const slices = showcaseSlices("light");
    const learned = Object.fromEntries(GONGFA.map((gongfa) => [gongfa.id, gongfa.maxLevel]));
    learned[batchMain.id] = batchFrom;
    slices.resources = {
      ...slices.resources,
      wudao: 1_000_000,
      page: 1_000_000,
    };
    slices.cultivation = {
      learned,
      mainGongfa: batchMain.id,
      subGongfa: [seededSub.id],
      buffs: [],
      gongfaBranch: {},
    };
    await seedSave(ctx, slices, "__gongfaListFixture");

    const page = await ctx.newPage();
    await page.addInitScript(() => {
      Math.random = () => 1;
    });
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    await page.goto(INDEX + "#/cultivation", { waitUntil: "load" });
    await page.locator("[data-gongfa-total]").waitFor({ state: "visible", timeout: 10000 });
    await page.setViewportSize({ width: 195, height: 422 });
    await settleVisuals(page);

    async function readList() {
      return page.evaluate(() => {
        const holder = document.querySelector("[data-gongfa-total]");
        const rows = [...document.querySelectorAll("[data-gongfa-row]")];
        return {
          total: Number(holder?.getAttribute("data-gongfa-total")),
          shown: Number(holder?.getAttribute("data-gongfa-shown")),
          start: Number(holder?.getAttribute("data-gongfa-start")),
          count: rows.length,
          ids: rows.map((row) => row.getAttribute("data-gongfa-row")),
          focusRow: document.activeElement?.getAttribute("data-gongfa-row"),
          focusCat: document.activeElement?.getAttribute("data-gongfa-cat"),
        };
      });
    }

    async function waitForList(total, shown) {
      await page.waitForFunction(
        ({ wantedTotal, wantedShown }) => {
          const holder = document.querySelector("[data-gongfa-total]");
          return (
            holder?.getAttribute("data-gongfa-total") === String(wantedTotal) &&
            holder?.getAttribute("data-gongfa-shown") === String(wantedShown)
          );
        },
        { wantedTotal: total, wantedShown: shown },
        { timeout: 5000 },
      );
    }

    async function waitForFocus(id) {
      await page
        .waitForFunction(
          (rowId) => document.activeElement?.getAttribute("data-gongfa-row") === rowId,
          id,
          { timeout: 3000 },
        )
        .catch(() => {});
    }

    async function checkPagerFit(label) {
      for (const selector of ["[data-gongfa-more]", "[data-gongfa-prev]"]) {
        const control = page.locator(selector).first();
        if ((await control.count()) === 0) continue;
        const fit = await control.evaluate((el) => {
          const box = el.getBoundingClientRect();
          return {
            left: box.left,
            right: box.right,
            height: box.height,
            scrollWidth: el.scrollWidth,
            clientWidth: el.clientWidth,
            viewport: window.innerWidth,
          };
        });
        checked += 1;
        if (
          fit.left < -1 ||
          fit.right > fit.viewport + 1 ||
          fit.scrollWidth > fit.clientWidth + 1 ||
          fit.height < 27.5
        ) {
          failures.push(
            `[195] ${label}分页入口被挤坏:` +
              `盒 ${Math.round(fit.left)}..${Math.round(fit.right)} / ` +
              `内容 ${fit.scrollWidth}>${fit.clientWidth} / ` +
              `高 ${Math.round(fit.height * 10) / 10}px`,
          );
        }
      }
    }

    async function exerciseDoor(cat, label, total) {
      await page.locator(`[data-gongfa-cat="${cat}"]`).click({ timeout: 5000 });
      await waitForList(total, 12);
      const initial = await readList();
      const more = page.locator("[data-gongfa-more]").first();
      const moreText = ((await more.textContent()) || "").replace(/\s+/g, " ").trim();
      const morePromised = Math.min(12, total - 12);
      checked += 1;
      if (
        initial.total !== total ||
        initial.shown !== 12 ||
        initial.start !== 0 ||
        initial.count !== 12 ||
        initial.focusCat !== cat ||
        !new RegExp(`再看\\s*${morePromised}\\s*部\\s*·\\s*余\\s*${total - 12}`).test(moreText)
      ) {
        failures.push(
          `[195] ${label}首批应 12/${total} 且焦点留在页签,` +
            `实见 ${initial.count} 行 / start ${initial.start} / ` +
            `焦点 ${initial.focusCat ?? initial.focusRow ?? "无"} «${moreText}»`,
        );
      }
      await checkPagerFit(label);

      await more.click({ timeout: 5000 });
      const secondShown = Math.min(24, total);
      await waitForList(total, secondShown);
      const second = await readList();
      await waitForFocus(second.ids[12]);
      const secondFocused = await readList();
      checked += 1;
      if (
        second.shown !== secondShown ||
        second.start !== 0 ||
        second.count !== secondShown ||
        secondFocused.focusRow !== second.ids[12]
      ) {
        failures.push(
          `[195] ${label}续开首批后应铺 ${secondShown} 部、焦点落第 13 部,` +
            `实见 ${second.count} 部 / start ${second.start} / ` +
            `焦点 ${secondFocused.focusRow ?? "无"}`,
        );
      }

      let current = secondFocused;
      while (current.shown < total) {
        const before = current;
        const shownAfter = Math.min(total, before.shown + 12);
        await page.locator("[data-gongfa-more]").first().click({ timeout: 5000 });
        await waitForList(total, shownAfter);
        const after = await readList();
        const beforeSet = new Set(before.ids);
        const firstFresh = after.ids.find((id) => !beforeSet.has(id));
        await waitForFocus(firstFresh);
        const focused = await readList();
        const expectedStart = Math.max(0, shownAfter - 24);
        checked += 1;
        if (
          after.shown !== shownAfter ||
          after.start !== expectedStart ||
          after.count !== shownAfter - expectedStart ||
          !firstFresh ||
          focused.focusRow !== firstFresh
        ) {
          failures.push(
            `[195] ${label}续开到第 ${shownAfter} 部时窗口不对:` +
              `应 ${shownAfter - expectedStart} 行 / start ${expectedStart} / ` +
              `焦点 ${firstFresh ?? "无"},实见 ${after.count} 行 / start ${after.start} / ` +
              `焦点 ${focused.focusRow ?? "无"}(shown ${after.shown})`,
          );
        }
        current = focused;
      }

      const expectedStart = Math.max(0, total - 24);
      const expectedCount = total - expectedStart;
      const previous = page.locator("[data-gongfa-prev]").first();
      checked += 1;
      if (
        current.start !== expectedStart ||
        current.count !== expectedCount ||
        (await page.locator("[data-gongfa-more]").count()) > 0
      ) {
        failures.push(
          `[195] ${label}末批应铺 ${expectedCount}/${total}、从第 ${expectedStart + 1} 部起,` +
            `实见 ${current.count} 部 / start ${current.start}`,
        );
      }
      if (expectedStart > 0) {
        const before = current;
        await previous.click({ timeout: 5000 });
        await page.waitForFunction(
          (shown) =>
            Number(
              document.querySelector("[data-gongfa-total]")?.getAttribute("data-gongfa-shown"),
            ) < shown,
          before.shown,
          { timeout: 5000 },
        );
        const back = await readList();
        await waitForFocus(back.ids[0]);
        const backFocused = await readList();
        checked += 1;
        if (back.start >= before.start || backFocused.focusRow !== back.ids[0]) {
          failures.push(
            `[195] ${label}回翻没有回到上一页:` +
              `start ${before.start} → ${back.start} / 焦点 ${backFocused.focusRow ?? "无"}`,
          );
        }
      }
    }

    await exerciseDoor("main", "主修册", counts.main);
    await exerciseDoor("sub", "辅修册", counts.sub);
    await exerciseDoor("secret", "秘术册", counts.secret);

    await page.locator('[data-gongfa-cat="main"]').click({ timeout: 5000 });
    await waitForList(counts.main, 12);
    const resetMain = await readList();
    checked += 1;
    if (resetMain.start !== 0 || resetMain.count !== 12 || resetMain.focusCat !== "main") {
      failures.push(
        `[195] 换回主修册没有回首批并守住页签焦点:` +
          `${resetMain.count} 部 / start ${resetMain.start} / 焦点 ${resetMain.focusCat ?? "无"}`,
      );
    }

    await page.locator('[data-gongfa-cat="sub"]').click({ timeout: 5000 });
    await waitForList(counts.sub, 12);
    const beforeRemove = await readList();
    checked += 1;
    if (!beforeRemove.ids.includes(seededSub.id)) {
      failures.push(`[195] 当前辅修 ${seededSub.id} 没有按装配置顶,改序后无法验证焦点`);
    }
    await page.locator(`[data-gongfa-row="${seededSub.id}"]`).click({ timeout: 5000 });
    await page.getByRole("button", { name: "卸下辅修", exact: true }).click({ timeout: 5000 });
    await page.keyboard.press("Escape");
    await waitForFocus(seededSub.id);
    await page
      .locator(".modal-panel")
      .waitFor({ state: "detached", timeout: 3000 })
      .catch(() => {});
    const afterRemove = await readList();
    checked += 1;
    if (
      !afterRemove.ids.includes(seededSub.id) ||
      afterRemove.focusRow !== seededSub.id ||
      afterRemove.shown <= 12
    ) {
      failures.push(
        `[195] 卸下辅修后没有按新位置重开窗口并归还焦点:` +
          `目标${afterRemove.ids.includes(seededSub.id) ? "在" : "不在"}窗内 / ` +
          `shown ${afterRemove.shown} / 焦点 ${afterRemove.focusRow ?? "无"}`,
      );
    }

    await page.locator('[data-gongfa-cat="main"]').click({ timeout: 5000 });
    await waitForList(counts.main, 12);
    await page.locator(`[data-gongfa-row="${batchMain.id}"]`).click({ timeout: 5000 });
    await page.locator("[data-gongfa-batch-plan]").waitFor({ state: "visible", timeout: 5000 });
    const batchPlan = await page.evaluate(() => {
      const holder = document.querySelector("[data-gongfa-batch-plan]");
      const box = holder?.getBoundingClientRect();
      return {
        count: Number(holder?.getAttribute("data-gongfa-batch-count")),
        from: Number(holder?.getAttribute("data-gongfa-batch-from")),
        to: Number(holder?.getAttribute("data-gongfa-batch-to")),
        wudao: Number(holder?.getAttribute("data-gongfa-batch-wudao")),
        page: Number(holder?.getAttribute("data-gongfa-batch-page")),
        ended: holder?.getAttribute("data-gongfa-batch-ended"),
        text: (holder?.textContent || "").replace(/\s+/g, " ").trim(),
        left: box?.left ?? -1,
        right: box?.right ?? -1,
      };
    });
    checked += 1;
    if (
      batchPlan.count !== 2 ||
      batchPlan.from !== batchFrom ||
      batchPlan.to !== batchMain.maxLevel ||
      batchPlan.ended !== "max" ||
      batchPlan.wudao <= 0 ||
      batchPlan.page <= 0 ||
      !batchPlan.text.includes("可至圆满") ||
      batchPlan.left < -1 ||
      batchPlan.right > 196
    ) {
      failures.push(
        `[195] 批量进修预告不对:应 ${batchFrom}→${batchMain.maxLevel} 共 2 层/可至圆满,` +
          `实见 ${batchPlan.from}→${batchPlan.to} 共 ${batchPlan.count} 层/${batchPlan.ended} · ` +
          `耗 ${batchPlan.wudao} 悟道点 ${batchPlan.page} 残页 · 盒 ${batchPlan.left}..${batchPlan.right}`,
      );
    }
    const batchDialogProblems = dialogZoomProblems(
      await measureDialogZoom(page, { width: 390, height: 844 }),
    );
    checked += 1;
    if (batchDialogProblems.length) {
      failures.push(`[195] 批量进修总账在 200% 下坏了:${batchDialogProblems.join(" / ")}`);
    }
    await page.getByRole("button", { name: /修到顶/ }).click({ timeout: 5000 });
    const batchToast = await page.locator("[data-toast]").last().textContent({ timeout: 5000 });
    checked += 1;
    if (
      !batchToast?.includes(`第 ${batchMain.maxLevel} 层`) ||
      !batchToast.includes(`耗 ${batchPlan.wudao} 悟道点 · ${batchPlan.page} 残页`)
    ) {
      failures.push(
        `[195] 批量进修回执与预算不同账:预算 ${batchPlan.count} 层/` +
          `${batchPlan.wudao} 悟道点 ${batchPlan.page} 残页,回执 «${batchToast || "无"}»`,
      );
    }
    await page.keyboard.press("Escape");
    await page
      .locator(".modal-panel")
      .waitFor({ state: "detached", timeout: 3000 })
      .catch(() => {});

    checked += 1;
    const layoutProblems = problemsOf(await measurePage(page));
    if (layoutProblems.length) failures.push(`[195] 修行功法三册 → ${layoutProblems.join(" / ")}`);

    if (pageErrors.length)
      failures.push(`[195] 修行功法三册场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
  } finally {
    await ctx.close();
  }
  return { failures, checked, contrastFails: [], pixelContrastFails: [], zoomFails: [] };
}

/**
 * 道痕满卷 60 则 —— 整卷每行都带忆战/重写动作,max-h-64 只裁视觉、不裁 DOM。
 *
 * 同时守住页签归属:道途册只答道途,marks 册才挂道痕。此前面板条件写成 dao,
 * 结果是道途页混进整卷履历、点道痕反而空白;这条从深层链接落册开始测。
 */
async function taskMarksListOverflow() {
  const failures = [];
  let checked = 0;
  const ctx = await auditContext({
    viewport: { width: 320, height: 568 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  try {
    const slices = showcaseSlices("light");
    slices.endgame = {
      ...slices.endgame,
      marks: makeFullMarks(),
      endgameTutorialSeen: true,
      resourceDialogSeen: true,
    };
    await seedSave(ctx, slices, "__marksListFixture");

    const page = await ctx.newPage();
    await page.addInitScript(() => {
      Math.random = () => 1;
    });
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    await page.goto(INDEX + "#/celestial?tab=marks", { waitUntil: "load" });
    await page.locator("[data-marks-total]").waitFor({ state: "visible", timeout: 10000 });
    await page.setViewportSize({ width: 195, height: 422 });
    await settleVisuals(page);

    async function readList() {
      return page.evaluate(() => {
        const holder = document.querySelector("[data-marks-total]");
        const rows = [...document.querySelectorAll("[data-mark-row]")];
        return {
          total: Number(holder?.getAttribute("data-marks-total")),
          shown: Number(holder?.getAttribute("data-marks-shown")),
          start: Number(holder?.getAttribute("data-marks-start")),
          count: rows.length,
          ids: rows.map((row) => row.getAttribute("data-mark-row")),
          focusRow: document.activeElement?.getAttribute("data-mark-row"),
          marksTab: document
            .querySelector('[role="tab"][aria-selected="true"]')
            ?.textContent?.replace(/\s+/g, "")
            .trim(),
        };
      });
    }

    async function waitForList(total, shown) {
      await page.waitForFunction(
        ({ wantedTotal, wantedShown }) => {
          const holder = document.querySelector("[data-marks-total]");
          return (
            holder?.getAttribute("data-marks-total") === String(wantedTotal) &&
            holder?.getAttribute("data-marks-shown") === String(wantedShown)
          );
        },
        { wantedTotal: total, wantedShown: shown },
        { timeout: 5000 },
      );
    }

    async function waitForFocus(id) {
      await page
        .waitForFunction(
          (rowId) => document.activeElement?.getAttribute("data-mark-row") === rowId,
          id,
          { timeout: 3000 },
        )
        .catch(() => {});
    }

    async function checkPagerFit(label) {
      for (const selector of ["[data-marks-more]", "[data-marks-prev]"]) {
        const control = page.locator(selector).first();
        if ((await control.count()) === 0) continue;
        const fit = await control.evaluate((el) => {
          const box = el.getBoundingClientRect();
          return {
            left: box.left,
            right: box.right,
            height: box.height,
            scrollWidth: el.scrollWidth,
            clientWidth: el.clientWidth,
            viewport: window.innerWidth,
          };
        });
        checked += 1;
        if (
          fit.left < -1 ||
          fit.right > fit.viewport + 1 ||
          fit.scrollWidth > fit.clientWidth + 1 ||
          fit.height < 27.5
        ) {
          failures.push(
            `[195] ${label}分页入口被挤坏:` +
              `盒 ${Math.round(fit.left)}..${Math.round(fit.right)} / ` +
              `内容 ${fit.scrollWidth}>${fit.clientWidth} / ` +
              `高 ${Math.round(fit.height * 10) / 10}px`,
          );
        }
      }
    }

    const initial = await readList();
    const moreText = ((await page.locator("[data-marks-more]").textContent()) || "")
      .replace(/\s+/g, " ")
      .trim();
    checked += 1;
    if (
      initial.total !== FULL_MARKS_COUNT ||
      initial.shown !== 12 ||
      initial.start !== 0 ||
      initial.count !== 12 ||
      initial.marksTab !== "道痕" ||
      !new RegExp(`再看\\s*12\\s*则\\s*·\\s*余\\s*48`).test(moreText)
    ) {
      failures.push(
        `[195] 道痕首批应 12/60 且只落在道痕册,` +
          `实见 ${initial.count} 行 / shown ${initial.shown} / start ${initial.start} / ` +
          `页签 ${initial.marksTab ?? "无"} «${moreText}»`,
      );
    }
    await checkPagerFit("道痕");

    await page.locator("[data-marks-more]").click({ timeout: 5000 });
    await waitForList(FULL_MARKS_COUNT, 24);
    const second = await readList();
    await waitForFocus(second.ids[12]);
    const secondFocused = await readList();
    checked += 1;
    if (second.count !== 24 || second.start !== 0 || secondFocused.focusRow !== second.ids[12]) {
      failures.push(
        `[195] 道痕续开首批后应铺 24 则、焦点落第 13 则,` +
          `实见 ${second.count} 则 / start ${second.start} / ` +
          `焦点 ${secondFocused.focusRow ?? "无"}`,
      );
    }

    const seen = new Set(initial.ids);
    for (const id of second.ids) seen.add(id);
    let current = secondFocused;
    while (current.shown < FULL_MARKS_COUNT) {
      const before = current;
      const shownAfter = Math.min(FULL_MARKS_COUNT, before.shown + 12);
      await page.locator("[data-marks-more]").click({ timeout: 5000 });
      await waitForList(FULL_MARKS_COUNT, shownAfter);
      const after = await readList();
      const beforeSet = new Set(before.ids);
      const firstFresh = after.ids.find((id) => !beforeSet.has(id));
      await waitForFocus(firstFresh);
      const focused = await readList();
      const expectedStart = Math.max(0, shownAfter - 24);
      checked += 1;
      if (
        after.start !== expectedStart ||
        after.count !== Math.min(24, shownAfter) ||
        focused.focusRow !== firstFresh
      ) {
        failures.push(
          `[195] 道痕续开到 ${shownAfter}/${FULL_MARKS_COUNT} 时窗口不对:` +
            `start ${after.start}(应 ${expectedStart}) / ${after.count} 行 / ` +
            `焦点 ${focused.focusRow ?? "无"} / 新首则 ${firstFresh ?? "无"}`,
        );
      }
      for (const id of after.ids) seen.add(id);
      current = focused;
    }

    checked += 1;
    if (seen.size !== FULL_MARKS_COUNT) {
      failures.push(`[195] 道痕只可达 ${seen.size}/${FULL_MARKS_COUNT} 则 —— 后半卷被静默截断`);
    }

    const beforeBack = await readList();
    await page.locator("[data-marks-prev]").click({ timeout: 5000 });
    await page.waitForFunction(
      (shown) =>
        Number(document.querySelector("[data-marks-total]")?.getAttribute("data-marks-shown")) <
        shown,
      beforeBack.shown,
      { timeout: 5000 },
    );
    const back = await readList();
    await waitForFocus(back.ids[0]);
    const backFocused = await readList();
    checked += 1;
    if (
      back.shown !== 48 ||
      back.start !== 24 ||
      back.start >= beforeBack.start ||
      backFocused.focusRow !== back.ids[0]
    ) {
      failures.push(
        `[195] 道痕回翻没有回到上一页:` +
          `shown ${beforeBack.shown}→${back.shown} / ` +
          `start ${beforeBack.start}→${back.start} / 焦点 ${backFocused.focusRow ?? "无"}`,
      );
    }

    await page.getByRole("tab", { name: "道途", exact: true }).click({ timeout: 5000 });
    await page.waitForTimeout(120);
    const dao = await page.evaluate(() => ({
      marks: document.querySelectorAll("[data-marks-total]").length,
      text: document.body.innerText,
    }));
    checked += 1;
    if (dao.marks !== 0 || !dao.text.includes("此生一诺")) {
      failures.push("[195] 道途册仍混入道痕,或道途正文没有出现 —— 页签内容没有互斥");
    }

    await page.getByRole("tab", { name: "道痕", exact: true }).click({ timeout: 5000 });
    await waitForList(FULL_MARKS_COUNT, 12);
    const returned = await readList();
    checked += 1;
    if (returned.count !== 12 || returned.start !== 0 || returned.marksTab !== "道痕") {
      failures.push(
        `[195] 回到道痕册没有重新落首批:` +
          `${returned.count} 行 / start ${returned.start} / 页签 ${returned.marksTab ?? "无"}`,
      );
    }

    checked += 1;
    const layoutProblems = problemsOf(await measurePage(page));
    if (layoutProblems.length) failures.push(`[195] 道痕满卷 → ${layoutProblems.join(" / ")}`);

    if (pageErrors.length)
      failures.push(`[195] 道痕满卷场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
  } finally {
    await ctx.close();
  }
  return { failures, checked, contrastFails: [], pixelContrastFails: [], zoomFails: [] };
}

/**
 * 构筑对照的道痕很多时,只摆最近八则就是静默截断。
 *
 * 这里造十则带忆战快照的道痕:首批只该有八则和「再看 2 则 · 余 2」;在 195 宽
 * (200% 缩放档)入口仍要够大、不裁字。续开后十条都在,焦点落到第九则,再真点
 * 这一则旧构筑,对照结果必须出来。
 */
async function taskBuildCompareOverflow() {
  const failures = [];
  let checked = 0;
  const ctx = await auditContext({
    viewport: { width: 320, height: 568 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  try {
    const now = Date.now();
    const marks = Array.from({ length: 10 }, (_, i) => {
      const life = 12 - i;
      return {
        life,
        daoPathId: "sword",
        targetId: "chiyan",
        targetName: "赤炎天",
        cleared: true,
        rounds: 30 + i,
        buildName: `旧构筑${life}`,
        powerText: "1万",
        at: now - i * 1000,
        replay: {
          mods: {},
          attack: { m: 1200 + i * 80, e: 0 },
          defense: { m: 700 + i * 40, e: 0 },
          maxHp: { m: 22000 + i * 600, e: 0 },
          speed: 2,
          skills: [],
          artifacts: [],
          pactId: null,
        },
      };
    });
    const slices = showcaseSlices("light");
    slices.endgame = { ...slices.endgame, marks };
    await seedSave(ctx, slices, "__buildCompareFixture");

    const page = await ctx.newPage();
    await page.addInitScript(() => {
      Math.random = () => 1;
    });
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    await page.goto(INDEX + "#/build", { waitUntil: "load" });

    const candidates = page.locator("[data-compare-candidate]");
    await candidates.first().waitFor({ state: "visible", timeout: 10000 });
    const more = page.locator("[data-compare-more]").first();
    const initial = await page.evaluate(() => {
      const holder = document.querySelector("[data-compare-total]");
      return {
        total: Number(holder?.getAttribute("data-compare-total")),
        shown: Number(holder?.getAttribute("data-compare-shown")),
        count: document.querySelectorAll("[data-compare-candidate]").length,
      };
    });
    const moreCount = await more.count();
    const moreText = moreCount
      ? ((await more.textContent()) || "").replace(/\s+/g, " ").trim()
      : "";
    checked += 1;
    if (initial.total !== 10 || initial.shown !== 8 || initial.count !== 8) {
      failures.push(
        `[320] 构筑对照首批应 8/10 则,实见 ${initial.count}/${initial.total}(shown ${initial.shown})`,
      );
    }
    if (moreCount === 0) {
      failures.push("[320] 后两则道痕被静默截掉了 —— 没有续开入口");
    } else if (!/再看\s*2\s*则\s*·\s*余\s*2/.test(moreText)) {
      failures.push(`[320] 续开入口没报清余量:«${moreText}»`);
    }

    if (moreCount > 0) {
      await page.setViewportSize({ width: 195, height: 422 });
      await settleVisuals(page);
      const fit = await more.evaluate((el) => {
        const box = el.getBoundingClientRect();
        return {
          left: box.left,
          right: box.right,
          width: box.width,
          height: box.height,
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
          viewport: window.innerWidth,
        };
      });
      checked += 1;
      if (fit.left < -1 || fit.right > fit.viewport + 1 || fit.scrollWidth > fit.clientWidth + 1) {
        failures.push(
          `[195] 续开入口被挤坏:盒 ${Math.round(fit.left)}..${Math.round(fit.right)} / ` +
            `内容 ${fit.scrollWidth}>${fit.clientWidth} / 视口 ${fit.viewport}`,
        );
      }
      if (fit.height < 27.5) {
        failures.push(
          `[195] 续开入口只有 ${Math.round(fit.height * 10) / 10}px 高,低于 28px 触达下限`,
        );
      }

      const ninth = marks[8];
      await more.click({ timeout: 5000 });
      const expanded = await page
        .waitForFunction(
          () => {
            const holder = document.querySelector("[data-compare-total]");
            return (
              document.querySelectorAll("[data-compare-candidate]").length === 10 &&
              holder?.getAttribute("data-compare-shown") === "10"
            );
          },
          { timeout: 5000 },
        )
        .then(() => true)
        .catch(() => false);
      checked += 1;
      if (!expanded) {
        failures.push(`[195] 点续开后没有放出全部十则,实见 ${await candidates.count()} 则`);
      } else {
        if ((await page.locator("[data-compare-more]").count()) !== 0) {
          failures.push("[195] 十则已全部展开,续开入口却还在");
        }
        const focused = await page.evaluate(() => ({
          at: document.activeElement?.getAttribute("data-compare-candidate"),
          text: (document.activeElement?.textContent || "").replace(/\s+/g, " ").trim(),
        }));
        checked += 1;
        if (focused.at !== String(ninth.at)) {
          failures.push(
            `[195] 续开后焦点没送到第九则:落在 «${focused.text || "无"}»(${focused.at ?? "非候选"})`,
          );
        }

        const oldCandidate = page.locator(`[data-compare-candidate="${ninth.at}"]`).first();
        await oldCandidate.click({ timeout: 5000 });
        const result = page.locator(`[data-compare-result="${ninth.at}"]`).first();
        const opened = await result
          .waitFor({ state: "visible", timeout: 5000 })
          .then(() => true)
          .catch(() => false);
        checked += 1;
        if (!opened) {
          failures.push(`[195] 第九则旧构筑「${ninth.buildName}」点不开对照`);
        } else {
          const report = await result.evaluate((el) => ({
            text: (el.innerText || "").replace(/\s+/g, " ").trim(),
            pressed: el.parentElement
              ?.querySelector(
                `[data-compare-candidate="${el.getAttribute("data-compare-result")}"]`,
              )
              ?.getAttribute("aria-pressed"),
          }));
          if (!/今\s/.test(report.text) || !/彼\s/.test(report.text)) {
            failures.push(`[195] 旧构筑对照结果没有今昔两列:«${report.text.slice(0, 80)}»`);
          }
          if (report.pressed !== "true") {
            failures.push("[195] 点开旧构筑后,候选没有标成当前对照");
          }
          if (/NaN|undefined|Infinity/.test(report.text)) {
            failures.push(`[195] 旧构筑对照漏出占位符:«${report.text.slice(0, 80)}»`);
          }
        }
      }
    }

    if (pageErrors.length)
      failures.push(`[320] 构筑对照场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
  } finally {
    await ctx.close();
  }
  return { failures, checked, contrastFails: [], pixelContrastFails: [], zoomFails: [] };
}

/**
 * 道途未成时,流派页不是一句占位话,而是六路实时发现账。
 *
 * 巡页的新号会在加载后留下零星核心词条,不能稳定命中空态;这里用展品档清空
 * 装备 / 法宝 / 法宝槽,只保留其它生活数据,单独验证六路契合、雏形缺口、
 * 四条当前读数与两条真实入口。390、320 与 195(200% 缩放)三档同量。
 */
async function taskBuildDiscovery() {
  const failures = [];
  const zoomFails = [];
  let checked = 0;
  const ctx = await auditContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  try {
    const slices = showcaseSlices("light");
    slices.inventory = {
      ...slices.inventory,
      items: [],
      equipped: {},
      artifacts: [],
      equippedArtifacts: [],
    };
    await seedSave(ctx, slices, "__buildDiscoveryFixture");

    const page = await ctx.newPage();
    await page.addInitScript(() => {
      Math.random = () => 1;
    });
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    const rendered = await openRoute(page, "/build", 700);
    checked += 1;
    if (rendered === 0) {
      failures.push("[390] /build 道途发现页没渲染出来,首屏判据没量到东西");
    }

    const discoveryVisible = await page
      .locator("[data-build-discovery]")
      .waitFor({ state: "visible", timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    const discovery = discoveryVisible
      ? await page.evaluate(() => {
          const root = document.querySelector("[data-build-discovery]");
          if (!root) return null;
          const rootStyle = getComputedStyle(root);
          const rootBefore = getComputedStyle(root, "::before");
          const pathStyles = [...root.querySelectorAll("[data-build-path]")].map((path) => {
            const style = getComputedStyle(path);
            return {
              borderTop: Number.parseFloat(style.borderTopWidth),
              borderRight: Number.parseFloat(style.borderRightWidth),
              borderBottom: Number.parseFloat(style.borderBottomWidth),
              borderLeft: Number.parseFloat(style.borderLeftWidth),
              radius: Number.parseFloat(style.borderTopLeftRadius),
              background: style.backgroundColor,
            };
          });
          return {
            declaredPaths: Number(root.getAttribute("data-build-path-count")),
            paths: root.querySelectorAll("[data-build-path]").length,
            ledgerRows: root.querySelectorAll("[data-build-ledger] > p").length,
            progress: root.querySelectorAll('[role="progressbar"]').length,
            headSeal: root.querySelector(".folio-ledger-head__seal")?.textContent?.trim() || "",
            wheelCount: root.querySelectorAll(".build-discovery__wheel").length,
            atlasHidden: document.querySelector("[data-build-atlas]")?.getAttribute("aria-hidden"),
            cultivation: root.querySelector('a[href="#/cultivation"]')?.textContent?.trim() || "",
            inventory: root.querySelector('a[href="#/inventory"]')?.textContent?.trim() || "",
            chrome: {
              borderTop: Number.parseFloat(rootStyle.borderTopWidth),
              borderRight: Number.parseFloat(rootStyle.borderRightWidth),
              borderBottom: Number.parseFloat(rootStyle.borderBottomWidth),
              borderLeft: Number.parseFloat(rootStyle.borderLeftWidth),
              radius: Number.parseFloat(rootStyle.borderTopLeftRadius),
              shadow: rootStyle.boxShadow,
              background: rootStyle.backgroundColor,
              beforeContent: rootBefore.content,
              beforeBorderTop: Number.parseFloat(rootBefore.borderTopWidth),
            },
            pathStyles,
          };
        })
      : null;
    checked += 1;
    if (!discovery) {
      failures.push("[390] /build 道途发现页没有渲染出来");
    } else {
      if (
        discovery.declaredPaths <= 0 ||
        discovery.paths !== discovery.declaredPaths ||
        discovery.progress !== discovery.declaredPaths
      ) {
        failures.push(
          `[390] /build 道途发现页的路数不齐(${discovery.paths}/${discovery.declaredPaths},进度 ${discovery.progress})`,
        );
      }
      if (discovery.ledgerRows !== 4) {
        failures.push("[390] /build 道途发现页的当前读数不是四格");
      }
      if (discovery.headSeal !== "未") {
        failures.push("[390] /build 道途发现页的卷首印不是「未」");
      }
      if (discovery.wheelCount !== 0) {
        failures.push("[390] /build 道途发现页又长回了装饰轮盘");
      }
      if (discovery.atlasHidden !== "true") {
        failures.push("[390] /build 道途发现页的卷首铸道盘没有对读屏隐藏");
      }
      if (!discovery.cultivation.includes("去修行") || !discovery.inventory.includes("看行囊")) {
        failures.push("[390] /build 道途发现页的两条真实入口不齐");
      }
      if (
        discovery.chrome.borderTop < 1 ||
        discovery.chrome.borderBottom < 1 ||
        discovery.chrome.borderLeft !== 0 ||
        discovery.chrome.borderRight !== 0 ||
        discovery.chrome.radius !== 0 ||
        discovery.chrome.shadow !== "none" ||
        discovery.chrome.background !== "rgba(0, 0, 0, 0)" ||
        discovery.chrome.beforeContent !== "none" ||
        discovery.chrome.beforeBorderTop !== 0
      ) {
        failures.push(
          `[390] /build 道途发现页又套回四边卡或内框:${JSON.stringify(discovery.chrome)}`,
        );
      }
      if (
        discovery.pathStyles.some(
          (path) =>
            path.borderRight !== 0 ||
            path.borderBottom !== 0 ||
            path.borderLeft !== 0 ||
            path.radius !== 0 ||
            path.background !== "rgba(0, 0, 0, 0)",
        )
      ) {
        failures.push(`[390] /build 六路又分别套回纸卡:${JSON.stringify(discovery.pathStyles)}`);
      }
    }

    await clearOverlays(page);
    for (const [width, height, tag] of [
      [390, 844, "390"],
      [320, 568, "320"],
    ]) {
      await page.setViewportSize({ width, height });
      await settleVisuals(page);
      const problems = problemsOf(await measurePage(page));
      checked += 1;
      if (problems.length) {
        failures.push(`[${tag}] /build 道途发现页 → ${problems.join(" / ")}`);
      }
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await settleVisuals(page);
    const zoom = await measureZoomScale(page, { width: 390, height: 844 });
    zoomSeen += 1;
    const zoomBad = zoomProblems(zoom, "390");
    checked += 1;
    if (zoomBad.length) {
      zoomFails.push(`[390] /build 道途发现页 → ${zoomBad.join(" / ")}`);
    }

    if (pageErrors.length) {
      failures.push(`[390] 道途发现页场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
    }
  } finally {
    await ctx.close();
  }
  return { failures, checked, contrastFails: [], pixelContrastFails: [], zoomFails };
}

/**
 * 成路后的流派页不是一串同权卡片,而是一册「铸道续卷」。
 *
 * 用后期档稳定造出背水成形路:卷首铸道盘必须与当前路同报,正文沿
 * 道途阶梯 / 下一步 / 五维形状 / 实战 / 快照 / 旧筑续排,不再逐段套四边卡。
 * 390 量章序与首屏下一步,1280 量前三章并读和实战整行,195 量极窄档章态。
 */
async function taskBuildFormed() {
  const failures = [];
  const zoomFails = [];
  let checked = 0;
  const ctx = await auditContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  try {
    await seedSave(ctx, lateSlices("light"), "__buildFormedFixture");

    const page = await ctx.newPage();
    await page.addInitScript(() => {
      Math.random = () => 1;
    });
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    const rendered = await openRoute(page, "/build", 700);
    checked += 1;
    if (rendered === 0) {
      failures.push("[390] /build 成路总案没渲染出来,首屏判据没量到东西");
    }

    const formedVisible = await page
      .locator("[data-build-formed]")
      .waitFor({ state: "visible", timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    checked += 1;
    if (!formedVisible) {
      failures.push("[390] /build 成路总案没有渲染出来");
    } else {
      const formed = await page.evaluate(() => {
        const text = (selector) =>
          (document.querySelector(selector)?.innerText || "").replace(/\s+/g, " ").trim();
        const root = document.querySelector("[data-build-formed]");
        const rectOf = (el) => {
          if (!el) return null;
          const rect = el.getBoundingClientRect();
          return {
            top: Math.round(rect.top),
            right: Math.round(rect.right),
            bottom: Math.round(rect.bottom),
            left: Math.round(rect.left),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          };
        };
        const register = document.querySelector("[data-build-register]");
        const registerStyle = register ? getComputedStyle(register) : null;
        const topOf = (selector) => {
          const el = document.querySelector(selector);
          return el ? Math.round(el.getBoundingClientRect().top) : null;
        };
        const chapters = [...(root?.querySelectorAll("[data-build-chapter]") ?? [])].map(
          (chapter) => {
            const style = getComputedStyle(chapter);
            const head = chapter.querySelector("[data-folio-chapter-head]");
            return {
              key: chapter.getAttribute("data-build-chapter") || "",
              title: chapter.querySelector(".folio-chapter-head__title")?.textContent?.trim() || "",
              hasHead: Boolean(head),
              fact: chapter.querySelector(".folio-chapter-head__fact")?.textContent?.trim() || "",
              borderWidths: [
                style.borderTopWidth,
                style.borderRightWidth,
                style.borderBottomWidth,
                style.borderLeftWidth,
              ].map((width) => Number.parseFloat(width)),
              radius: Number.parseFloat(style.borderTopLeftRadius),
              shadow: style.boxShadow,
              background: style.backgroundColor,
              rect: rectOf(chapter),
            };
          },
        );
        return {
          current: text("[data-build-current]"),
          atlasHidden: document.querySelector("[data-build-atlas]")?.getAttribute("aria-hidden"),
          stage: !!document.querySelector("[data-build-stage]"),
          shape: !!document.querySelector("[data-build-shape]"),
          next: !!document.querySelector("[data-build-next]"),
          battle: !!document.querySelector("[data-build-battle]"),
          loadouts: !!document.querySelector("[data-build-loadouts]"),
          compare: !!document.querySelector("[data-build-compare]"),
          shapeRows:
            document.querySelector("[data-build-shape]")?.querySelectorAll(".build-rating__row")
              .length ?? 0,
          matchupRows:
            document.querySelector("[data-build-battle]")?.querySelectorAll("[data-build-matchup]")
              .length ?? 0,
          register: registerStyle
            ? {
                borderTop: Number.parseFloat(registerStyle.borderTopWidth),
                borderRight: Number.parseFloat(registerStyle.borderRightWidth),
                borderBottom: Number.parseFloat(registerStyle.borderBottomWidth),
                borderLeft: Number.parseFloat(registerStyle.borderLeftWidth),
                radius: Number.parseFloat(registerStyle.borderTopLeftRadius),
                shadow: registerStyle.boxShadow,
              }
            : null,
          cardShells: root?.querySelectorAll(".card-ink").length ?? 0,
          chapters,
          nextTop: topOf("[data-build-next]"),
          shapeTop: topOf("[data-build-shape]"),
          viewportBottom: innerHeight,
          body: (root?.innerText || "").replace(/\s+/g, " ").trim(),
        };
      });

      if (!/背水/.test(formed.current)) {
        failures.push(`[390] 成路总案卷首没有报出当前路:«${formed.current}»`);
      }
      if (!/(大成|成形|雏形)/.test(formed.current)) {
        failures.push(`[390] 成路总案卷首没有报出当前阶段:«${formed.current}»`);
      }
      if (formed.atlasHidden !== "true") {
        failures.push("[390] 成路总案的卷首铸道盘没有对读屏隐藏");
      }
      if (
        !formed.register ||
        formed.register.borderTop < 1 ||
        formed.register.borderBottom < 1 ||
        formed.register.borderLeft !== 0 ||
        formed.register.borderRight !== 0 ||
        formed.register.radius !== 0 ||
        formed.register.shadow !== "none"
      ) {
        failures.push(`[390] 成路总案没有收成一册开口续卷:${JSON.stringify(formed.register)}`);
      }
      const expectedChapters = ["stage", "next", "shape", "battle", "loadouts"];
      const actualChapters = formed.chapters.map((chapter) => chapter.key);
      if (
        actualChapters.slice(0, expectedChapters.length).join(",") !== expectedChapters.join(",") ||
        actualChapters.some((key, index) => key !== expectedChapters[index] && key !== "compare")
      ) {
        failures.push(`[390] 成路总案章序不对:${actualChapters.join(" / ")}`);
      }
      const expectedTitles = ["道途阶梯", "下一步", "五维形状", "短板与第二套答案", "构筑快照"];
      if (
        formed.chapters
          .slice(0, expectedTitles.length)
          .map((chapter) => chapter.title)
          .join(",") !== expectedTitles.join(",")
      ) {
        failures.push(
          `[390] 成路总案章名不对:${formed.chapters.map((chapter) => chapter.title).join(" / ")}`,
        );
      }
      const brokenChapters = formed.chapters.filter(
        (chapter) =>
          !chapter.hasHead ||
          !chapter.fact ||
          chapter.radius !== 0 ||
          chapter.shadow !== "none" ||
          chapter.background !== "rgba(0, 0, 0, 0)" ||
          chapter.borderWidths.every((width) => width > 0),
      );
      if (brokenChapters.length) {
        failures.push(`[390] 成路续卷里有章首缺字或重新套壳:${JSON.stringify(brokenChapters)}`);
      }
      if (formed.cardShells > 0) {
        failures.push(`[390] 成路续卷里又套了 ${formed.cardShells} 张 card-ink`);
      }
      for (const [key, label] of [
        ["stage", "道途阶梯"],
        ["shape", "五维形状"],
        ["next", "下一步"],
        ["battle", "实战短板"],
        ["loadouts", "构筑快照"],
      ]) {
        if (!formed[key]) failures.push(`[390] 成路总案缺少${label}账位`);
      }
      if (formed.shapeRows !== 5) {
        failures.push(`[390] 成路总案的五维形状应恰有 5 行,实见 ${formed.shapeRows}`);
      }
      if (formed.matchupRows <= 0) {
        failures.push("[390] 成路总案的实战短板没有列出任何对局");
      }
      if (formed.nextTop === null || formed.shapeTop === null) {
        failures.push("[390] 成路总案的下一步 / 五维位置没量到");
      } else {
        if (formed.nextTop >= formed.shapeTop) {
          failures.push("[390] 成路总案仍把五维展开挡在下一步之前");
        }
        if (formed.nextTop + 44 > formed.viewportBottom) {
          failures.push(`[390] 成路总案的下一步不在首屏内(top=${formed.nextTop})`);
        }
      }
      if (/NaN|undefined|Infinity/.test(formed.body)) {
        failures.push(`[390] 成路总案漏出占位符:«${formed.body.slice(0, 120)}»`);
      }
      // 对照账只在道痕里有旧构筑时出现；后期档没有道痕，不把缺席误判成回归。
      if (formed.compare) checked += 1;
    }

    await clearOverlays(page);
    for (const [width, height, tag] of [
      [390, 844, "390"],
      [320, 568, "320"],
    ]) {
      await page.setViewportSize({ width, height });
      await settleVisuals(page);
      const problems = problemsOf(await measurePage(page));
      checked += 1;
      if (problems.length) {
        failures.push(`[${tag}] /build 成路总案 → ${problems.join(" / ")}`);
      }
    }

    await page.setViewportSize({ width: 1280, height: 900 });
    await settleVisuals(page);
    const wide = await page.evaluate(() => {
      const rectOf = (selector) => {
        const el = document.querySelector(selector);
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        return {
          top: Math.round(rect.top),
          right: Math.round(rect.right),
          bottom: Math.round(rect.bottom),
          left: Math.round(rect.left),
          width: Math.round(rect.width),
        };
      };
      const register = rectOf("[data-build-register]");
      const borderTopOf = (selector) => {
        const el = document.querySelector(selector);
        return el ? Number.parseFloat(getComputedStyle(el).borderTopWidth) : null;
      };
      return {
        register,
        stage: rectOf("[data-build-stage]"),
        next: rectOf("[data-build-next]"),
        shape: rectOf("[data-build-shape]"),
        battle: rectOf("[data-build-battle]"),
        nextBorderTop: borderTopOf("[data-build-next]"),
        shapeBorderTop: borderTopOf("[data-build-shape]"),
      };
    });
    checked += 1;
    if (
      !wide.register ||
      !wide.stage ||
      !wide.next ||
      !wide.shape ||
      !wide.battle ||
      Math.max(Math.abs(wide.stage.top - wide.next.top), Math.abs(wide.next.top - wide.shape.top)) >
        2 ||
      !(wide.stage.left < wide.next.left && wide.next.left < wide.shape.left) ||
      wide.nextBorderTop !== 0 ||
      wide.shapeBorderTop !== 0 ||
      wide.battle.top < Math.max(wide.stage.bottom, wide.next.bottom, wide.shape.bottom) - 2 ||
      wide.battle.left > wide.register.left + 2 ||
      wide.battle.right < wide.register.right - 2
    ) {
      failures.push(`[1280] 成路续卷前三章没有并读或实战面没有整行接续:${JSON.stringify(wide)}`);
    }
    const wideProblems = problemsOf(await measurePage(page));
    checked += 1;
    if (wideProblems.length) {
      failures.push(`[1280] /build 成路总案 → ${wideProblems.join(" / ")}`);
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await settleVisuals(page);
    const zoom = await measureZoomScale(page, { width: 390, height: 844 });
    zoomSeen += 1;
    const zoomBad = zoomProblems(zoom, "390");
    checked += 1;
    if (zoomBad.length) {
      zoomFails.push(`[390] /build 成路总案 → ${zoomBad.join(" / ")}`);
    }

    if (SHOTS) {
      await page.setViewportSize({ width: 195, height: 422 });
      await settleVisuals(page);
      mkdirSync(SHOTS_DIR, { recursive: true });
      await page.screenshot({
        path: join(SHOTS_DIR, "195_build-formed.png"),
        fullPage: true,
      });
      await page.setViewportSize({ width: 390, height: 844 });
    }

    if (pageErrors.length) {
      failures.push(`[390] 成路总案场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
    }
  } finally {
    await ctx.close();
  }
  return { failures, checked, contrastFails: [], pixelContrastFails: [], zoomFails };
}

/**
 * 坊市今日行市、三摊册口与当前摊面同住一册。
 *
 * 390 量三摊并读、册口真值与当前正文同源；195 量册口退成单列且整页不挤压；
 * 1280 再量三摊并读和货架两列。方向键、Home 与 End 要同步移动焦点、选中态与
 * 唯一 tabpanel；外层只留上下账线，正文不再另套卡壳。兵刃摊签还要真的展开
 * 验货帖，核对战力、当前对照、三围与词条/固有都在同一账线内。
 */
async function taskMarketRegisterFold() {
  const failures = [];
  let checked = 0;
  const ctx = await auditContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  try {
    await seedSave(ctx, showcaseSlices("light"), "__marketRegisterFold");
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      Math.random = () => 1;
    });
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    const rendered = await openRoute(page, "/market", 700);
    checked += 1;
    if (rendered === 0) {
      failures.push("[390-market] 坊市没有渲染出来,续卷判据没量到东西");
    }

    async function readFold() {
      return page.evaluate(() => {
        const register = document.querySelector("[data-market-register]");
        const pulse = register?.querySelector("[data-market-pulse]");
        const rail = register?.querySelector("[data-market-chapter-rail]");
        const tabsRoot = rail?.querySelector('[role="tablist"]');
        const panel = register?.querySelector('[role="tabpanel"]');
        const head = panel?.querySelector("[data-market-book-head]");
        const headIdentity = head?.querySelector(".folio-ledger-head__identity");
        const headScore = head?.querySelector(".folio-ledger-head__score");
        const headMeta = head?.querySelector(".folio-ledger-head__meta");
        const body = panel?.querySelector("[data-market-book-body]");
        const tabs = [...(tabsRoot?.querySelectorAll('[role="tab"]') ?? [])];
        const textOf = (el) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
        const rectOf = (el) => {
          if (!el) return null;
          const rect = el.getBoundingClientRect();
          return {
            top: Math.round(rect.top),
            right: Math.round(rect.right),
            bottom: Math.round(rect.bottom),
            left: Math.round(rect.left),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          };
        };
        const registerRect = rectOf(register);
        const pulseRect = rectOf(pulse);
        const railRect = rectOf(rail);
        const panelRect = rectOf(panel);
        const parts = [pulseRect, railRect, panelRect].filter(Boolean);
        const scoreStyle = headScore ? getComputedStyle(headScore) : null;
        const metaStyle = headMeta ? getComputedStyle(headMeta) : null;
        const within =
          registerRect &&
          pulseRect &&
          panelRect &&
          [pulseRect, panelRect].every(
            (rect) =>
              rect.left >= registerRect.left - 2 &&
              rect.right <= registerRect.right + 2 &&
              rect.top >= registerRect.top - 2 &&
              rect.bottom <= registerRect.bottom + 2,
          ) &&
          railRect?.left <= registerRect.left + 2 &&
          railRect?.right >= registerRect.right - 2;
        const registerStyle = register ? getComputedStyle(register) : null;
        const panelStyle = panel ? getComputedStyle(panel) : null;
        const goods = panel?.querySelector(".market-goods");
        return {
          found: Boolean(register && pulse && rail && tabsRoot && panel),
          within,
          parts,
          panelCount: register?.querySelectorAll('[role="tabpanel"]').length ?? 0,
          panelId: panel?.id ?? "",
          panelLabelledby: panel?.getAttribute("aria-labelledby") ?? "",
          tabColumns: tabsRoot
            ? getComputedStyle(tabsRoot).gridTemplateColumns.split(/\s+/).filter(Boolean).length
            : 0,
          tabs: tabs.map((tab) => ({
            id: tab.getAttribute("data-market-chapter-tab"),
            top: rectOf(tab)?.top ?? null,
            left: rectOf(tab)?.left ?? null,
            width: rectOf(tab)?.width ?? null,
            selected: tab.getAttribute("aria-selected"),
            controls: tab.getAttribute("aria-controls"),
            value: tab.getAttribute("data-market-chapter-value") ?? "",
            total: tab.getAttribute("data-market-chapter-total") ?? "",
            fact: (tab.getAttribute("data-market-chapter-fact") ?? "").trim(),
          })),
          active: tabs
            .filter((tab) => tab.getAttribute("aria-selected") === "true")
            .map((tab) => tab.getAttribute("data-market-chapter-tab")),
          head: head
            ? {
                id: head.getAttribute("data-market-book-head") ?? "",
                eyebrow: textOf(head.querySelector(".folio-ledger-head__eyebrow")),
                title: textOf(head.querySelector(".folio-ledger-head__title")),
                description: textOf(head.querySelector(".folio-ledger-head__description")),
                score: textOf(headScore),
                meta: textOf(headMeta),
                value: head.getAttribute("data-market-book-value") ?? "",
                total: head.getAttribute("data-market-book-total") ?? "",
                count: panel?.querySelectorAll("[data-market-book-head]").length ?? 0,
                legacyChapterHeadCount:
                  register?.querySelectorAll(".section-title, [data-folio-section-mark]").length ??
                  0,
                cardInkCount: register?.querySelectorAll(".card-ink").length ?? 0,
                rect: rectOf(head),
                identityRect: rectOf(headIdentity),
                scoreRect: rectOf(headScore),
                bodyRect: rectOf(body),
                headScrollWidth: head.scrollWidth,
                headClientWidth: head.clientWidth,
                scoreScrollWidth: headScore?.scrollWidth ?? 0,
                scoreClientWidth: headScore?.clientWidth ?? 0,
                scoreWhiteSpace: scoreStyle?.whiteSpace ?? "",
                metaWhiteSpace: metaStyle?.whiteSpace ?? "",
              }
            : null,
          goodsColumns:
            goods === null || goods === undefined
              ? 0
              : getComputedStyle(goods).gridTemplateColumns.split(/\s+/).filter(Boolean).length,
          chrome: {
            registerBorders: registerStyle
              ? [registerStyle.borderTopWidth, registerStyle.borderBottomWidth]
              : [],
            registerSideBorders: registerStyle
              ? [registerStyle.borderLeftWidth, registerStyle.borderRightWidth]
              : [],
            registerBackground: registerStyle?.backgroundColor ?? "",
            registerShadow: registerStyle?.boxShadow ?? "",
            panelBorders: panelStyle
              ? [
                  panelStyle.borderTopWidth,
                  panelStyle.borderRightWidth,
                  panelStyle.borderBottomWidth,
                  panelStyle.borderLeftWidth,
                ]
              : [],
            panelBackground: panelStyle?.backgroundColor ?? "",
            panelShadow: panelStyle?.boxShadow ?? "",
          },
        };
      });
    }

    const mobile = await readFold();
    checked += 1;
    if (
      !mobile.found ||
      !mobile.within ||
      mobile.panelCount !== 1 ||
      mobile.panelId !== "market-panel-shelf" ||
      mobile.panelLabelledby !== "market-tab-shelf"
    ) {
      failures.push(
        `[390-market] 今日行市、三摊册口与正文没有收进同一册:${JSON.stringify(mobile)}`,
      );
    }
    checked += 1;
    if (
      mobile.parts.length !== 3 ||
      mobile.parts[0].bottom > mobile.parts[1].top + 1 ||
      mobile.parts[1].bottom > mobile.parts[2].top + 1
    ) {
      failures.push(`[390-market] 行市、册口与正文没有按序续排:${JSON.stringify(mobile.parts)}`);
    }
    checked += 1;
    if (
      !mobile.head ||
      mobile.head.id !== "shelf" ||
      mobile.head.eyebrow !== "第壹册 · 换货" ||
      mobile.head.title !== "本架货目" ||
      !mobile.head.description ||
      !/^换货\s+\S+/.test(mobile.head.meta) ||
      mobile.head.value !== mobile.tabs[0]?.value ||
      mobile.head.total !== mobile.tabs[0]?.total ||
      mobile.head.count !== 1 ||
      mobile.head.legacyChapterHeadCount !== 0 ||
      mobile.head.cardInkCount !== 0 ||
      !mobile.head.rect ||
      !mobile.head.bodyRect ||
      mobile.head.rect.top < mobile.parts[2].top - 1 ||
      mobile.head.bodyRect.top < mobile.head.rect.bottom - 1
    ) {
      failures.push(`[390-market] 货架章首没有续在册口与正文之间:${JSON.stringify(mobile.head)}`);
    }
    checked += 1;
    if (
      mobile.tabColumns !== 3 ||
      mobile.tabs.length !== 3 ||
      mobile.tabs.some((tab) => tab.top !== mobile.tabs[0].top) ||
      mobile.tabs.some((tab) => !tab.value || !tab.fact)
    ) {
      failures.push(
        `[390-market] 三摊册口没有并排报出真值:${JSON.stringify({
          columns: mobile.tabColumns,
          tabs: mobile.tabs,
        })}`,
      );
    }
    checked += 1;
    if (
      mobile.chrome.registerBorders.some((width) => parseFloat(width) < 1) ||
      mobile.chrome.registerSideBorders.some((width) => parseFloat(width) !== 0) ||
      mobile.chrome.registerBackground !== "rgba(0, 0, 0, 0)" ||
      mobile.chrome.registerShadow !== "none" ||
      mobile.chrome.panelBorders.some((width) => parseFloat(width) !== 0) ||
      mobile.chrome.panelBackground !== "rgba(0, 0, 0, 0)" ||
      mobile.chrome.panelShadow !== "none"
    ) {
      failures.push(`[390-market] 坊市续卷又套回了卡壳:${JSON.stringify(mobile.chrome)}`);
    }

    async function readEquipmentInspection() {
      return page.evaluate(() => {
        const toggle = document.querySelector("[data-market-equipment-toggle]");
        const preview = document.querySelector("[data-market-equipment-preview]");
        const article = preview?.closest(".market-good");
        const panel = preview?.closest("[role=tabpanel]");
        const head = preview?.querySelector(".market-good__inspection-head");
        const flats = preview?.querySelector("[data-market-equipment-flats]");
        const power = preview?.querySelector("[data-market-equipment-power]");
        const compare =
          preview?.querySelector("[data-market-equipment-preview-compare]") ??
          toggle?.querySelector("[data-market-equipment-compare]");
        const rectOf = (el) => {
          if (!el) return null;
          const rect = el.getBoundingClientRect();
          return {
            top: Math.round(rect.top),
            right: Math.round(rect.right),
            bottom: Math.round(rect.bottom),
            left: Math.round(rect.left),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          };
        };
        const textOf = (el) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
        const articleRect = rectOf(article);
        const previewRect = rectOf(preview);
        const panelRect = rectOf(panel);
        return {
          expanded: toggle?.getAttribute("aria-expanded") ?? "",
          controls: toggle?.getAttribute("aria-controls") ?? "",
          previewId: preview?.id ?? "",
          articleRect,
          previewRect,
          panelRect,
          withinArticle:
            articleRect && previewRect
              ? previewRect.left >= articleRect.left - 1 &&
                previewRect.right <= articleRect.right + 1 &&
                previewRect.top >= articleRect.top - 1 &&
                previewRect.bottom <= articleRect.bottom + 1
              : false,
          withinPanel:
            panelRect && previewRect
              ? previewRect.left >= panelRect.left - 1 && previewRect.right <= panelRect.right + 1
              : false,
          headColumns: head
            ? getComputedStyle(head).gridTemplateColumns.split(/\s+/).filter(Boolean).length
            : 0,
          flatColumns: flats
            ? getComputedStyle(flats).gridTemplateColumns.split(/\s+/).filter(Boolean).length
            : 0,
          flatRows: preview?.querySelectorAll("[data-market-equipment-flats] > li").length ?? 0,
          power: textOf(power),
          compare: textOf(compare),
          previewScrollWidth: preview?.scrollWidth ?? 0,
          previewClientWidth: preview?.clientWidth ?? 0,
        };
      });
    }

    const equipmentToggle = page.locator("[data-market-equipment-toggle]").first();
    checked += 1;
    if ((await equipmentToggle.count()) === 0) {
      failures.push("[390-market] 货架上没有可展开验货的兵刃，验货判据空转");
    } else {
      await equipmentToggle.click();
      await page.waitForSelector("[data-market-equipment-preview]", { timeout: 3000 });
      await settleVisuals(page);
      const inspection = await readEquipmentInspection();
      checked += 1;
      if (
        inspection.expanded !== "true" ||
        inspection.controls !== inspection.previewId ||
        !inspection.previewId ||
        !inspection.withinArticle ||
        !inspection.withinPanel ||
        inspection.flatRows === 0 ||
        !inspection.power.includes("本件战力") ||
        !inspection.compare ||
        inspection.previewScrollWidth > inspection.previewClientWidth + 1
      ) {
        failures.push(`[390-market] 兵刃验货没有在同一账线内摊开:${JSON.stringify(inspection)}`);
      }

      await equipmentToggle.click();
      await page.waitForSelector("[data-market-equipment-preview]", {
        state: "detached",
        timeout: 3000,
      });
      const collapsed = await equipmentToggle.getAttribute("aria-expanded");
      checked += 1;
      if (collapsed !== "false") {
        failures.push(`[390-market] 再按验货没有收起:aria-expanded=${collapsed}`);
      }
      await equipmentToggle.click();
      await page.waitForSelector("[data-market-equipment-preview]", { timeout: 3000 });
    }

    const marketChapterCopy = {
      shelf: {
        eyebrow: "第壹册 · 换货",
        title: "本架货目",
        scoreLabel: "可买",
        meta: /^换货\s+\S+/,
      },
      bounty: {
        eyebrow: "第贰册 · 收榜",
        title: "本期赏单",
        scoreLabel: "可交",
        meta: /^换榜\s+\S+/,
      },
      sell: {
        eyebrow: "第叁册 · 归账",
        title: "寄卖与即时柜",
        scoreLabel: "寄卖",
        meta: /^(?:暂无寄卖|最近 .+ 后入账)$/,
      },
    };

    async function readTabTruth(id) {
      return page.evaluate((tabId) => {
        const tab = document.querySelector(`[data-market-chapter-tab="${tabId}"]`);
        const panel = document.querySelector(`#market-panel-${tabId}`);
        const head = panel?.querySelector("[data-market-book-head]");
        const textOf = (el) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
        let actual = 0;
        let totalActual = 0;
        if (tabId === "shelf") {
          actual = panel?.querySelectorAll(".market-good:not(.is-sold)").length ?? 0;
          totalActual = panel?.querySelectorAll(".market-good").length ?? 0;
        } else if (tabId === "bounty") {
          actual = panel?.querySelectorAll(".market-bounty.is-ready").length ?? 0;
          totalActual = panel?.querySelectorAll(".market-bounty").length ?? 0;
        } else {
          actual = panel?.querySelectorAll(".market-consign__row").length ?? 0;
          totalActual = Number(panel?.getAttribute("data-market-consign-slots") ?? 0);
        }
        return {
          value: tab?.getAttribute("data-market-chapter-value") ?? "",
          total: tab?.getAttribute("data-market-chapter-total") ?? "",
          actual,
          totalActual,
          selected: tab?.getAttribute("aria-selected"),
          controls: tab?.getAttribute("aria-controls"),
          panelCount: document.querySelectorAll("[data-market-register] [role=tabpanel]").length,
          panelLabelledby: panel?.getAttribute("aria-labelledby"),
          head: {
            id: head?.getAttribute("data-market-book-head") ?? "",
            eyebrow: textOf(head?.querySelector(".folio-ledger-head__eyebrow")),
            title: textOf(head?.querySelector(".folio-ledger-head__title")),
            description: textOf(head?.querySelector(".folio-ledger-head__description")),
            score: textOf(head?.querySelector(".folio-ledger-head__score")),
            meta: textOf(head?.querySelector(".folio-ledger-head__meta")),
            value: head?.getAttribute("data-market-book-value") ?? "",
            total: head?.getAttribute("data-market-book-total") ?? "",
            body: Boolean(panel?.querySelector("[data-market-book-body]")),
            legacyChapterHeadCount:
              panel?.querySelectorAll(".section-title, [data-folio-section-mark]").length ?? 0,
            cardInkCount: panel?.querySelectorAll(".card-ink").length ?? 0,
          },
        };
      }, id);
    }

    for (const id of ["shelf", "bounty", "sell"]) {
      await page.locator(`[data-market-chapter-tab="${id}"]`).click();
      await page.waitForSelector(`#market-panel-${id}`, { timeout: 3000 });
      await settleVisuals(page);
      const truth = await readTabTruth(id);
      const copy = marketChapterCopy[id];
      checked += 1;
      if (
        truth.value !== String(truth.actual) ||
        truth.total !== String(truth.totalActual) ||
        truth.head.value !== truth.value ||
        truth.head.total !== truth.total ||
        truth.selected !== "true" ||
        truth.controls !== `market-panel-${id}` ||
        truth.panelCount !== 1 ||
        truth.panelLabelledby !== `market-tab-${id}` ||
        truth.head.id !== id ||
        truth.head.eyebrow !== copy.eyebrow ||
        truth.head.title !== copy.title ||
        !truth.head.description ||
        !truth.head.score.includes(copy.scoreLabel) ||
        !truth.head.score.includes(String(truth.actual)) ||
        !truth.head.score.includes(String(truth.totalActual)) ||
        !copy.meta.test(truth.head.meta) ||
        !truth.head.body ||
        truth.head.legacyChapterHeadCount !== 0 ||
        truth.head.cardInkCount !== 0
      ) {
        failures.push(`[390-market] ${id} 册口、章首与当前摊面不同源:${JSON.stringify(truth)}`);
      }
    }

    await page.locator('[data-market-chapter-tab="shelf"]').click();
    await page.waitForSelector("#market-panel-shelf", { timeout: 3000 });
    await settleVisuals(page);
    await page.locator('[data-market-chapter-tab="shelf"]').focus();
    async function pressRailKey(key, expected) {
      await page.keyboard.press(key);
      await page.waitForFunction(
        (tabId) =>
          document.activeElement?.getAttribute("data-market-chapter-tab") === tabId &&
          document
            .querySelector(`[data-market-chapter-tab="${tabId}"]`)
            ?.getAttribute("aria-selected") === "true" &&
          Boolean(document.querySelector(`#market-panel-${tabId}`)),
        expected,
        { timeout: 3000 },
      );
      return page.evaluate(() => ({
        focus: document.activeElement?.getAttribute("data-market-chapter-tab") ?? "",
        selected: document
          .querySelector('[data-market-chapter-tab][aria-selected="true"]')
          ?.getAttribute("data-market-chapter-tab"),
        panel: document.querySelector("[data-market-register] [role=tabpanel]")?.id ?? "",
      }));
    }

    for (const [key, expected] of [
      ["ArrowRight", "bounty"],
      ["ArrowLeft", "shelf"],
      ["End", "sell"],
      ["Home", "shelf"],
      ["ArrowLeft", "sell"],
    ]) {
      const moved = await pressRailKey(key, expected);
      checked += 1;
      if (
        moved.focus !== expected ||
        moved.selected !== expected ||
        moved.panel !== `market-panel-${expected}`
      ) {
        failures.push(
          `[390-market] ${key} 没有同步册口焦点、选中态与正文:${JSON.stringify(moved)}`,
        );
      }
    }

    await page.locator('[data-market-chapter-tab="shelf"]').click();
    await page.setViewportSize({ width: 195, height: 422 });
    await settleVisuals(page);
    if ((await page.locator("[data-market-equipment-preview]").count()) === 0) {
      const toggle = page.locator("[data-market-equipment-toggle]").first();
      if ((await toggle.count()) > 0) {
        await toggle.click();
        await page.waitForSelector("[data-market-equipment-preview]", { timeout: 3000 });
      }
    }
    const zoomInspection = await readEquipmentInspection();
    checked += 1;
    if (
      zoomInspection.expanded !== "true" ||
      zoomInspection.headColumns !== 1 ||
      zoomInspection.flatColumns !== 1 ||
      !zoomInspection.withinArticle ||
      !zoomInspection.withinPanel ||
      zoomInspection.previewScrollWidth > zoomInspection.previewClientWidth + 1
    ) {
      failures.push(
        `[195-market] 200% 缩放档兵刃验货没有退成单列:${JSON.stringify(zoomInspection)}`,
      );
    }
    const zoom = await readFold();
    checked += 1;
    if (
      zoom.tabColumns !== 1 ||
      zoom.tabs.length !== 3 ||
      zoom.tabs.some((tab, index) => index > 0 && tab.top <= zoom.tabs[index - 1].top)
    ) {
      failures.push(
        `[195-market] 200% 缩放档册口没有退成单列:${JSON.stringify({
          columns: zoom.tabColumns,
          tabs: zoom.tabs,
        })}`,
      );
    }
    checked += 1;
    if (
      !zoom.head ||
      zoom.head.title !== "本架货目" ||
      zoom.head.scoreWhiteSpace !== "nowrap" ||
      zoom.head.metaWhiteSpace !== "nowrap" ||
      zoom.head.scoreScrollWidth > zoom.head.scoreClientWidth + 1 ||
      zoom.head.headScrollWidth > zoom.head.headClientWidth + 1 ||
      !zoom.head.scoreRect ||
      zoom.head.scoreRect.height > 48
    ) {
      failures.push(
        `[195-market] 200% 缩放档章首真值被挤成竖排或横向溢出:${JSON.stringify(zoom.head)}`,
      );
    }
    const zoomProblems = problemsOf(await measurePage(page));
    checked += 1;
    if (zoomProblems.length) {
      failures.push(`[195-market] 坊市续卷 → ${zoomProblems.join(" / ")}`);
    }

    await page.setViewportSize({ width: 1280, height: 800 });
    await settleVisuals(page);
    const desktopInspection = await readEquipmentInspection();
    checked += 1;
    if (
      desktopInspection.expanded !== "true" ||
      desktopInspection.headColumns !== 2 ||
      desktopInspection.flatColumns < 1 ||
      !desktopInspection.withinArticle ||
      !desktopInspection.withinPanel ||
      desktopInspection.previewScrollWidth > desktopInspection.previewClientWidth + 1
    ) {
      failures.push(
        `[1280-market] 桌面兵刃验货没有与摊签并读:${JSON.stringify(desktopInspection)}`,
      );
    }
    const desktop = await readFold();
    checked += 1;
    if (
      desktop.tabColumns !== 3 ||
      desktop.tabs.length !== 3 ||
      desktop.tabs.some((tab) => tab.top !== desktop.tabs[0].top) ||
      desktop.goodsColumns !== 2
    ) {
      failures.push(
        `[1280-market] 桌面三摊册口或货架两列没有并读:${JSON.stringify({
          columns: desktop.tabColumns,
          goodsColumns: desktop.goodsColumns,
          tabs: desktop.tabs,
        })}`,
      );
    }
    checked += 1;
    if (
      !desktop.head ||
      desktop.head.title !== "本架货目" ||
      desktop.head.legacyChapterHeadCount !== 0 ||
      desktop.head.cardInkCount !== 0 ||
      !desktop.head.identityRect ||
      !desktop.head.scoreRect ||
      !desktop.head.rect ||
      !desktop.head.bodyRect ||
      desktop.head.bodyRect.top < desktop.head.rect.bottom - 1 ||
      desktop.head.scoreRect.left < desktop.head.identityRect.left ||
      desktop.head.headScrollWidth > desktop.head.headClientWidth + 1
    ) {
      failures.push(`[1280-market] 桌面章首真值没有与正文并读:${JSON.stringify(desktop.head)}`);
    }

    if (SHOTS) {
      mkdirSync(SHOTS_DIR, { recursive: true });
      await page
        .locator("[data-market-register]")
        .screenshot({ path: join(SHOTS_DIR, "1280-market-register.png") });
      await page.setViewportSize({ width: 390, height: 1800 });
      await settleVisuals(page);
      await page
        .locator("[data-market-register]")
        .screenshot({ path: join(SHOTS_DIR, "390-market-register.png") });
    }

    if (pageErrors.length) {
      failures.push(`[market-register] 坊市续卷页面异常:${[...new Set(pageErrors)].join(" | ")}`);
    }
  } finally {
    await ctx.close();
  }
  return { failures, checked, contrastFails: [], pixelContrastFails: [], zoomFails: [] };
}

/**
 * 三生录的册口与当前正文同住一册。
 *
 * 390 量 2×2、195 量单列、1280 量四列与双账并读；四处册口报出的真值必须与
 * 本页账首 / 卷首一致。方向键、Home、End 要同时移动选中态、焦点和唯一 tabpanel。
 */
async function taskLegacyRegisterFold() {
  const failures = [];
  let checked = 0;
  const ctx = await auditContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  try {
    await seedSave(ctx, showcaseSlices("light"), "__legacyRegisterFold");
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      Math.random = () => 1;
    });
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    const rendered = await openRoute(page, "/legacy", 700);
    checked += 1;
    if (rendered === 0) {
      failures.push("[390-legacy] 三生录没有渲染出来,续卷判据没量到东西");
    }

    async function readFold() {
      return page.evaluate(() => {
        const register = document.querySelector("[data-legacy-register]");
        const profile = register?.querySelector("[data-legacy-profile]");
        const rail = register?.querySelector(".legacy-chapter-rail");
        const tabsRoot = rail?.querySelector(".legacy-chapter-rail__tabs");
        const panel = document.querySelector("[data-legacy-tab]");
        const tabs = [...(tabsRoot?.querySelectorAll('[role="tab"]') ?? [])];
        const rectOf = (el) => {
          if (!el) return null;
          const rect = el.getBoundingClientRect();
          return {
            top: Math.round(rect.top),
            right: Math.round(rect.right),
            bottom: Math.round(rect.bottom),
            left: Math.round(rect.left),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          };
        };
        const registerRect = rectOf(register);
        const profileRect = rectOf(profile);
        const railRect = rectOf(rail);
        const panelRect = rectOf(panel);
        const within =
          registerRect &&
          profileRect &&
          railRect &&
          panelRect &&
          [profileRect, railRect, panelRect].every(
            (rect) =>
              rect.left >= registerRect.left - 2 &&
              rect.right <= registerRect.right + 2 &&
              rect.top >= registerRect.top - 2 &&
              rect.bottom <= registerRect.bottom + 2,
          );
        const ledgers = [...(panel?.querySelectorAll(":scope > .legacy-ledger") ?? [])].map(rectOf);
        const registerStyle = register ? getComputedStyle(register) : null;
        const profileStyle = profile ? getComputedStyle(profile) : null;
        const ledger = panel?.querySelector(".legacy-ledger");
        const ledgerStyle = ledger ? getComputedStyle(ledger) : null;
        return {
          found: Boolean(register && profile && rail && tabsRoot && panel),
          within,
          ordered: Boolean(profileRect && railRect && panelRect),
          order: [profileRect, railRect, panelRect].filter(Boolean),
          panelCount: document.querySelectorAll("[data-legacy-tab]").length,
          panelId: panel?.id ?? "",
          panelLabelledby: panel?.getAttribute("aria-labelledby") ?? "",
          tabColumns: tabsRoot
            ? getComputedStyle(tabsRoot).gridTemplateColumns.split(/\s+/).filter(Boolean).length
            : 0,
          tabs: tabs.map((tab) => ({
            id: tab.getAttribute("data-legacy-rail-tab"),
            top: rectOf(tab)?.top ?? null,
            left: rectOf(tab)?.left ?? null,
            width: rectOf(tab)?.width ?? null,
            selected: tab.getAttribute("aria-selected"),
            controls: tab.getAttribute("aria-controls"),
            fact: (tab.querySelector("[data-legacy-rail-fact]")?.textContent || "")
              .replace(/\s+/g, " ")
              .trim(),
          })),
          active: tabs
            .filter((tab) => tab.getAttribute("aria-selected") === "true")
            .map((tab) => tab.getAttribute("data-legacy-rail-tab")),
          ledgers,
          chrome: {
            registerBorders: registerStyle
              ? [registerStyle.borderTopWidth, registerStyle.borderBottomWidth]
              : [],
            registerSideBorders: registerStyle
              ? [registerStyle.borderLeftWidth, registerStyle.borderRightWidth]
              : [],
            registerBackground: registerStyle?.backgroundColor ?? "",
            registerShadow: registerStyle?.boxShadow ?? "",
            profileBorder: profileStyle?.borderTopWidth ?? "",
            profileBackground: profileStyle?.backgroundColor ?? "",
            ledgerBorder: ledgerStyle?.borderTopWidth ?? "",
            ledgerBackground: ledgerStyle?.backgroundColor ?? "",
          },
        };
      });
    }

    const mobile = await readFold();
    checked += 1;
    if (
      !mobile.found ||
      !mobile.within ||
      mobile.panelCount !== 1 ||
      mobile.panelId !== "legacy-panel-samsara" ||
      mobile.panelLabelledby !== "legacy-tab-samsara"
    ) {
      failures.push(`[390-legacy] 画像、册口与正文没有收进同一册:${JSON.stringify(mobile)}`);
    }
    checked += 1;
    if (
      mobile.order.length !== 3 ||
      mobile.order[0].bottom > mobile.order[1].top + 1 ||
      mobile.order[1].bottom > mobile.order[2].top + 1
    ) {
      failures.push(`[390-legacy] 画像、册口与正文没有按序续排:${JSON.stringify(mobile.order)}`);
    }
    checked += 1;
    if (
      mobile.tabColumns !== 2 ||
      mobile.tabs.length !== 4 ||
      mobile.tabs[0].top !== mobile.tabs[1].top ||
      mobile.tabs[2].top <= mobile.tabs[0].top ||
      mobile.tabs[0].left !== mobile.tabs[2].left
    ) {
      failures.push(
        `[390-legacy] 四册册口没有铺成 2×2:${JSON.stringify({
          columns: mobile.tabColumns,
          tabs: mobile.tabs,
        })}`,
      );
    }
    checked += 1;
    if (mobile.ledgers.length !== 2 || mobile.ledgers[1].top < mobile.ledgers[0].bottom - 2) {
      failures.push(`[390-legacy] 轮回两本账在手机上应上下续排:${JSON.stringify(mobile.ledgers)}`);
    }
    checked += 1;
    if (
      mobile.chrome.registerBorders.some((width) => parseFloat(width) < 1) ||
      mobile.chrome.registerSideBorders.some((width) => parseFloat(width) !== 0) ||
      mobile.chrome.registerBackground !== "rgba(0, 0, 0, 0)" ||
      mobile.chrome.registerShadow !== "none" ||
      mobile.chrome.profileBorder !== "0px" ||
      mobile.chrome.profileBackground !== "rgba(0, 0, 0, 0)" ||
      mobile.chrome.ledgerBorder !== "0px" ||
      mobile.chrome.ledgerBackground !== "rgba(0, 0, 0, 0)"
    ) {
      failures.push(`[390-legacy] 三生续卷又套回了卡壳:${JSON.stringify(mobile.chrome)}`);
    }

    async function readTabTruth(id) {
      return page.evaluate((tabId) => {
        const tab = document.querySelector(`[data-legacy-rail-tab="${tabId}"]`);
        const panel = document.querySelector(`#legacy-panel-${tabId}`);
        const fact = (tab?.querySelector("[data-legacy-rail-fact]")?.textContent || "")
          .replace(/\s+/g, " ")
          .trim();
        const score = (
          panel?.querySelector(".folio-ledger-head__score")?.textContent || ""
        ).replace(/\s+/g, " ");
        const current = (
          document.querySelector("[data-legacy-current]")?.textContent || ""
        ).replace(/\s+/g, " ");
        let expected = "";
        if (tabId === "samsara") {
          const life = /第\s*(\d+)\s*世/.exec(current);
          expected = life ? `第 ${life[1]} 世` : "";
        } else if (tabId === "fate") {
          const count = /(\d+)\s*条/.exec(score);
          expected = count ? `${count[1]} 未了` : "";
        } else {
          const pair = /(\d+)\s*\/\s*(\d+)/.exec(score);
          expected = pair ? `${pair[1]}/${pair[2]}` : "";
        }
        return {
          fact,
          expected,
          selected: tab?.getAttribute("aria-selected"),
          controls: tab?.getAttribute("aria-controls"),
          panelCount: document.querySelectorAll("[data-legacy-tab]").length,
          panelLabelledby: panel?.getAttribute("aria-labelledby"),
          score,
        };
      }, id);
    }

    for (const id of ["samsara", "journey", "fate", "record"]) {
      await page.locator(`[data-legacy-rail-tab="${id}"]`).click();
      await page.waitForSelector(`#legacy-panel-${id}`, { timeout: 3000 });
      await settleVisuals(page);
      const truth = await readTabTruth(id);
      checked += 1;
      if (
        !truth.expected ||
        truth.fact !== truth.expected ||
        truth.selected !== "true" ||
        truth.controls !== `legacy-panel-${id}` ||
        truth.panelCount !== 1 ||
        truth.panelLabelledby !== `legacy-tab-${id}`
      ) {
        failures.push(`[390-legacy] ${id} 册口与当前正文不同源:${JSON.stringify(truth)}`);
      }
    }

    await page.locator('[data-legacy-rail-tab="samsara"]').click();
    await page.waitForSelector("#legacy-panel-samsara", { timeout: 3000 });
    await settleVisuals(page);
    await page.locator('[data-legacy-rail-tab="samsara"]').focus();
    async function pressRailKey(key, expected) {
      await page.keyboard.press(key);
      await page.waitForFunction(
        (tabId) =>
          document.activeElement?.getAttribute("data-legacy-rail-tab") === tabId &&
          document
            .querySelector(`[data-legacy-rail-tab="${tabId}"]`)
            ?.getAttribute("aria-selected") === "true" &&
          Boolean(document.querySelector(`#legacy-panel-${tabId}`)),
        expected,
        { timeout: 3000 },
      );
      return page.evaluate(() => ({
        focus: document.activeElement?.getAttribute("data-legacy-rail-tab") ?? "",
        selected: document
          .querySelector('[data-legacy-rail-tab][aria-selected="true"]')
          ?.getAttribute("data-legacy-rail-tab"),
        panel: document.querySelector("[data-legacy-tab]")?.id ?? "",
      }));
    }

    for (const [key, expected] of [
      ["ArrowRight", "journey"],
      ["ArrowLeft", "samsara"],
      ["End", "record"],
      ["Home", "samsara"],
      ["ArrowLeft", "record"],
    ]) {
      const moved = await pressRailKey(key, expected);
      checked += 1;
      if (
        moved.focus !== expected ||
        moved.selected !== expected ||
        moved.panel !== `legacy-panel-${expected}`
      ) {
        failures.push(
          `[390-legacy] ${key} 没有同步册口焦点、选中态与正文:${JSON.stringify(moved)}`,
        );
      }
    }

    await page.locator('[data-legacy-rail-tab="samsara"]').click();
    await page.setViewportSize({ width: 195, height: 422 });
    await settleVisuals(page);
    const zoom = await readFold();
    checked += 1;
    if (
      zoom.tabColumns !== 1 ||
      zoom.tabs.length !== 4 ||
      zoom.tabs.some((tab, index) => index > 0 && tab.top <= zoom.tabs[index - 1].top)
    ) {
      failures.push(
        `[195-legacy] 200% 缩放档册口没有退成单列:${JSON.stringify({
          columns: zoom.tabColumns,
          tabs: zoom.tabs,
        })}`,
      );
    }
    const zoomProblems = problemsOf(await measurePage(page));
    checked += 1;
    if (zoomProblems.length) {
      failures.push(`[195-legacy] 三生续卷 → ${zoomProblems.join(" / ")}`);
    }

    await page.setViewportSize({ width: 1280, height: 800 });
    await settleVisuals(page);
    const desktop = await readFold();
    checked += 1;
    if (
      desktop.tabColumns !== 4 ||
      desktop.tabs.length !== 4 ||
      desktop.tabs.some((tab) => tab.top !== desktop.tabs[0].top)
    ) {
      failures.push(
        `[1280-legacy] 桌面四册册口没有并读:${JSON.stringify({
          columns: desktop.tabColumns,
          tabs: desktop.tabs,
        })}`,
      );
    }
    checked += 1;
    if (
      desktop.ledgers.length !== 2 ||
      Math.abs(desktop.ledgers[0].top - desktop.ledgers[1].top) > 2 ||
      desktop.ledgers[1].left < desktop.ledgers[0].right - 2
    ) {
      failures.push(
        `[1280-legacy] 轮回的两本账没有并读,主账仍被压窄:${JSON.stringify(desktop.ledgers)}`,
      );
    }

    if (SHOTS) {
      mkdirSync(SHOTS_DIR, { recursive: true });
      await page
        .locator("[data-legacy-register]")
        .screenshot({ path: join(SHOTS_DIR, "1280-legacy-register.png") });
      await page.setViewportSize({ width: 390, height: 2400 });
      await settleVisuals(page);
      await page
        .locator("[data-legacy-register]")
        .screenshot({ path: join(SHOTS_DIR, "390-legacy-register.png") });
    }

    if (pageErrors.length) {
      failures.push(`[legacy-register] 三生续卷页面异常:${[...new Set(pageErrors)].join(" | ")}`);
    }
  } finally {
    await ctx.close();
  }
  return { failures, checked, contrastFails: [], pixelContrastFails: [], zoomFails: [] };
}

/**
 * 修仙录的两部历史:历世履历与行迹录。
 *
 * 30 世验证履历按 12 世一批、同时只留 24 行 DOM,最后一批会滑窗,回翻能回首批;
 * 12 条旧回响验证行迹录从 8 则起可开完,而不是只剩「仅列最近 8 则」一句。
 * 续开后焦点必须交给新页首则,否则按掉入口的键盘用户会失去落点。
 */
async function taskLegacyHistoryOverflow() {
  const failures = [];
  let checked = 0;
  const ctx = await auditContext({
    viewport: { width: 320, height: 568 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  try {
    const now = Date.now();
    const lives = Array.from({ length: 30 }, (_, i) => {
      const index = i + 1;
      return {
        index,
        major: 3 + (i % 6),
        realmLabel: `旧境${index}`,
        age: 80 + i,
        themeId: null,
        themeResult: null,
        insight: 17 + i,
        trialId: null,
        bond: null,
        at: now - (30 - i) * 86400000,
      };
    });
    const eventMemories = Object.fromEntries(
      Array.from({ length: 20 }, (_, i) => {
        const id = `memory_${String(i + 1).padStart(2, "0")}`;
        return [
          id,
          {
            eventId: id,
            times: 2 + (i % 3),
            lastAt: now - i * 1000,
            lastChoiceIdx: 0,
          },
        ];
      }),
    );
    const slices = showcaseSlices("light");
    slices.player = {
      ...slices.player,
      reincarnation: {
        ...slices.player.reincarnation,
        count: lives.length,
        lives,
      },
    };
    slices.adventure = { ...slices.adventure, eventMemories };
    await seedSave(ctx, slices, "__legacyHistoryFixture");

    const page = await ctx.newPage();
    await page.addInitScript(() => {
      Math.random = () => 1;
    });
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    await page.goto(INDEX + "#/legacy", { waitUntil: "load" });

    const lifeRows = page.locator("[data-life-row]");
    await lifeRows.first().waitFor({ state: "visible", timeout: 10000 });
    const lifeInitial = await page.evaluate(() => {
      const holder = document.querySelector("[data-life-total]");
      return {
        total: Number(holder?.getAttribute("data-life-total")),
        shown: Number(holder?.getAttribute("data-life-shown")),
        start: Number(holder?.getAttribute("data-life-start")),
        count: document.querySelectorAll("[data-life-row]").length,
      };
    });
    const lifeMore = page.locator("[data-life-more]").first();
    const lifeMoreCount = await lifeMore.count();
    const lifeMoreText = lifeMoreCount
      ? ((await lifeMore.textContent()) || "").replace(/\s+/g, " ").trim()
      : "";
    checked += 1;
    if (
      lifeInitial.total !== 30 ||
      lifeInitial.shown !== 12 ||
      lifeInitial.start !== 0 ||
      lifeInitial.count !== 12
    ) {
      failures.push(
        `[320] 历世首批应 12/30 世,实见 ${lifeInitial.count}/${lifeInitial.total}(shown ${lifeInitial.shown}/start ${lifeInitial.start})`,
      );
    }
    if (lifeMoreCount === 0) {
      failures.push("[320] 后十八世被一次铺完或藏掉了 —— 没有履历续开入口");
    } else if (!/再看\s*12\s*世\s*·\s*余\s*18/.test(lifeMoreText)) {
      failures.push(`[320] 履历续开入口没报清余量:«${lifeMoreText}»`);
    }

    async function checkZoomControl(label, control) {
      if ((await control.count()) === 0) return;
      const fit = await control.evaluate((el) => {
        const box = el.getBoundingClientRect();
        return {
          left: box.left,
          right: box.right,
          height: box.height,
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
          viewport: window.innerWidth,
        };
      });
      checked += 1;
      if (fit.left < -1 || fit.right > fit.viewport + 1 || fit.scrollWidth > fit.clientWidth + 1) {
        failures.push(
          `[195] ${label}被挤坏:盒 ${Math.round(fit.left)}..${Math.round(fit.right)} / ` +
            `内容 ${fit.scrollWidth}>${fit.clientWidth} / 视口 ${fit.viewport}`,
        );
      }
      if (fit.height < 27.5) {
        failures.push(
          `[195] ${label}只有 ${Math.round(fit.height * 10) / 10}px 高,低于 28px 触达下限`,
        );
      }
    }

    await page.setViewportSize({ width: 195, height: 422 });
    await settleVisuals(page);
    await checkZoomControl("履历续开入口", lifeMore);
    const lifeZoomProblems = problemsOf(await measurePage(page));
    checked += 1;
    if (lifeZoomProblems.length) {
      failures.push(`[195] 轮回页(履历展开前)→ ${lifeZoomProblems.join(" / ")}`);
    }

    if (lifeMoreCount > 0) {
      await lifeMore.click({ timeout: 5000 });
      await page.waitForFunction(
        () => document.querySelector("[data-life-shown]")?.getAttribute("data-life-shown") === "24",
        { timeout: 5000 },
      );
      const second = await page.evaluate(() => ({
        count: document.querySelectorAll("[data-life-row]").length,
        focus: document.activeElement?.getAttribute("data-life-row"),
      }));
      checked += 1;
      if (second.count !== 24 || second.focus !== "18") {
        failures.push(
          `[195] 履历续开第一批后应铺 24 世、焦点落第 18 世,实见 ${second.count} 世 / 焦点 ${second.focus ?? "无"}`,
        );
      }

      await page.locator("[data-life-more]").first().click({ timeout: 5000 });
      await page.waitForFunction(
        () => document.querySelector("[data-life-shown]")?.getAttribute("data-life-shown") === "30",
        { timeout: 5000 },
      );
      const last = await page.evaluate(() => ({
        count: document.querySelectorAll("[data-life-row]").length,
        start: Number(document.querySelector("[data-life-total]")?.getAttribute("data-life-start")),
        focus: document.activeElement?.getAttribute("data-life-row"),
        hasNewest: !!document.querySelector('[data-life-row="30"]'),
        hasOldest: !!document.querySelector('[data-life-row="1"]'),
        hasPrev: !!document.querySelector("[data-life-prev]"),
      }));
      checked += 1;
      if (
        last.count !== 24 ||
        last.start !== 6 ||
        last.focus !== "6" ||
        last.hasNewest ||
        !last.hasOldest ||
        !last.hasPrev
      ) {
        failures.push(
          `[195] 履历末批应滑窗为 24/30、从第 6 行起、焦点第 6 世并可回翻,` +
            `实见 ${last.count} 行 / start ${last.start} / 焦点 ${last.focus ?? "无"} / ` +
            `最新世 ${last.hasNewest ? "仍在" : "已滑走"} / 最旧世 ${last.hasOldest ? "在" : "缺失"} / ` +
            `回翻 ${last.hasPrev ? "在" : "缺失"}`,
        );
      }
      await page.locator("[data-life-prev]").first().click({ timeout: 5000 });
      await page.waitForFunction(
        () => document.querySelector("[data-life-shown]")?.getAttribute("data-life-shown") === "24",
        { timeout: 5000 },
      );
      const back = await page.evaluate(() => ({
        focus: document.activeElement?.getAttribute("data-life-row"),
        hasNewest: !!document.querySelector('[data-life-row="30"]'),
      }));
      checked += 1;
      if (back.focus !== "30" || !back.hasNewest) {
        failures.push(
          `[195] 履历回翻没有回到首批:焦点 ${back.focus ?? "无"} / 最新世 ${back.hasNewest ? "在" : "缺失"}`,
        );
      }
    }

    const fateTab = page.getByRole("tab", { name: /缘\s*迹/ }).first();
    if ((await fateTab.count()) === 0) {
      failures.push("[195] 修仙录找不到「缘迹」页签");
    } else {
      await fateTab.click({ timeout: 5000 });
      const lossRows = page.locator("[data-loss-row]");
      await lossRows.first().waitFor({ state: "visible", timeout: 5000 });
      const lossInitial = await page.evaluate(() => {
        const holder = document.querySelector("[data-loss-total]");
        return {
          total: Number(holder?.getAttribute("data-loss-total")),
          shown: Number(holder?.getAttribute("data-loss-shown")),
          count: document.querySelectorAll("[data-loss-row]").length,
        };
      });
      const lossMore = page.locator("[data-loss-more]").first();
      const lossMoreCount = await lossMore.count();
      const lossMoreText = lossMoreCount
        ? ((await lossMore.textContent()) || "").replace(/\s+/g, " ").trim()
        : "";
      checked += 1;
      if (
        lossInitial.total !== 20 ||
        lossInitial.shown !== 8 ||
        lossInitial.count !== 8 ||
        lossMoreCount === 0 ||
        !/再看\s*8\s*则\s*·\s*余\s*12/.test(lossMoreText)
      ) {
        failures.push(
          `[195] 行迹首批应 8/20 则并可再看 8 则,` +
            `实见 ${lossInitial.count}/${lossInitial.total}(shown ${lossInitial.shown}) «${lossMoreText}»`,
        );
      }
      await checkZoomControl("行迹续开入口", lossMore);

      if (lossMoreCount > 0) {
        await lossMore.click({ timeout: 5000 });
        await page.waitForFunction(
          () =>
            document.querySelector("[data-loss-shown]")?.getAttribute("data-loss-shown") === "16",
          { timeout: 5000 },
        );
        const lossSecond = await page.evaluate(() => ({
          count: document.querySelectorAll("[data-loss-row]").length,
          focus: document.activeElement?.getAttribute("data-loss-row"),
        }));
        checked += 1;
        if (lossSecond.count !== 16 || lossSecond.focus !== "memory_09") {
          failures.push(
            `[195] 行迹续开第一批后应铺 16 则、焦点 memory_09,` +
              `实见 ${lossSecond.count} 则 / 焦点 ${lossSecond.focus ?? "无"}`,
          );
        }
        await page.locator("[data-loss-more]").first().click({ timeout: 5000 });
        await page.waitForFunction(
          () =>
            document.querySelector("[data-loss-shown]")?.getAttribute("data-loss-shown") === "20",
          { timeout: 5000 },
        );
        const lossLast = await page.evaluate(() => ({
          count: document.querySelectorAll("[data-loss-row]").length,
          start: Number(
            document.querySelector("[data-loss-total]")?.getAttribute("data-loss-start"),
          ),
          focus: document.activeElement?.getAttribute("data-loss-row"),
          hasNewest: !!document.querySelector('[data-loss-row="memory_01"]'),
          hasOldest: !!document.querySelector('[data-loss-row="memory_20"]'),
          stillMore: !!document.querySelector("[data-loss-more]"),
          hasPrev: !!document.querySelector("[data-loss-prev]"),
        }));
        checked += 1;
        if (
          lossLast.count !== 16 ||
          lossLast.start !== 4 ||
          lossLast.focus !== "memory_17" ||
          lossLast.hasNewest ||
          !lossLast.hasOldest ||
          lossLast.stillMore ||
          !lossLast.hasPrev
        ) {
          failures.push(
            `[195] 行迹末批应滑窗为 16/20、从第 5 则起、焦点 memory_17 并可回翻,` +
              `实见 ${lossLast.count} 则 / start ${lossLast.start} / 焦点 ${lossLast.focus ?? "无"} / ` +
              `最新迹 ${lossLast.hasNewest ? "仍在" : "已滑走"} / ` +
              `最旧迹 ${lossLast.hasOldest ? "在" : "缺失"} / ` +
              `续开 ${lossLast.stillMore ? "仍在" : "已收"} / 回翻 ${lossLast.hasPrev ? "在" : "缺失"}`,
          );
        }
      }
      const lossZoomProblems = problemsOf(await measurePage(page));
      checked += 1;
      if (lossZoomProblems.length) {
        failures.push(`[195] 缘迹页(行迹展开后)→ ${lossZoomProblems.join(" / ")}`);
      }
    }

    if (pageErrors.length)
      failures.push(`[320] 修仙录历史场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
  } finally {
    await ctx.close();
  }
  return { failures, checked, contrastFails: [], pixelContrastFails: [], zoomFails: [] };
}

/**
 * 道侣弹窗的历世同行 —— 每一世追加一笔,没有上限。
 *
 * 30 段旧缘验证:最近一段排在最前,首批 12 段;续开至 24 段后焦点落到新页第一段;
 * 再过一批到 30 段时只保留 24 行 DOM,最早的一批滑出、最旧的一段仍可达;回翻回到
 * 首批并聚焦最近一段。弹窗在 195 宽下另过 dialogZoomProblems,续开入口守住 28px。
 */
async function taskBondHistoryOverflow() {
  const failures = [];
  let checked = 0;
  const ctx = await auditContext({
    viewport: { width: 320, height: 568 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  try {
    const slices = showcaseSlices("light");
    const bonds = Array.from({ length: 30 }, (_, i) => ({
      daoluId: `history_${i + 1}`,
      name: `旧缘${String(i + 1).padStart(2, "0")}`,
      stage: "pledged",
      ending: i % 2 === 0 ? "accompanied" : "parted",
      shared: i + 1,
    }));
    slices.player = {
      ...slices.player,
      reincarnation: {
        ...slices.player.reincarnation,
        count: bonds.length,
        bonds,
      },
    };
    await seedSave(ctx, slices, "__bondHistoryFixture");

    const page = await ctx.newPage();
    await page.addInitScript(() => {
      Math.random = () => 1;
    });
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    await page.goto(INDEX + "#/character", { waitUntil: "load" });

    const bondCard = page
      .locator("main button")
      .filter({ hasText: /道\s*侣/ })
      .first();
    await bondCard.waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
    checked += 1;
    if ((await bondCard.count()) === 0) {
      failures.push("[320] 人物页找不到「道侣」入口 —— 历世同行没有量到");
    } else {
      await bondCard.click({ timeout: 5000 });
      await page.getByRole("dialog").waitFor({ state: "visible", timeout: 5000 });
      await page.locator("[data-bond-history-total]").waitFor({ state: "visible", timeout: 5000 });
    }

    const initial = await page.evaluate(() => {
      const holder = document.querySelector("[data-bond-history-total]");
      const rows = [...document.querySelectorAll("[data-bond-history-row]")];
      return {
        total: Number(holder?.getAttribute("data-bond-history-total")),
        shown: Number(holder?.getAttribute("data-bond-history-shown")),
        start: Number(holder?.getAttribute("data-bond-history-start")),
        count: rows.length,
        first: rows[0]?.getAttribute("data-bond-history-row"),
        last: rows.at(-1)?.getAttribute("data-bond-history-row"),
      };
    });
    const historyMore = page.locator("[data-bond-history-more]").first();
    const historyMoreCount = await historyMore.count();
    const historyMoreText = historyMoreCount
      ? ((await historyMore.textContent()) || "").replace(/\s+/g, " ").trim()
      : "";
    checked += 1;
    if (
      initial.total !== 30 ||
      initial.shown !== 12 ||
      initial.start !== 0 ||
      initial.count !== 12 ||
      initial.first !== "旧缘30" ||
      initial.last !== "旧缘19" ||
      historyMoreCount === 0 ||
      !/再看\s*12\s*段\s*·\s*余\s*18/.test(historyMoreText)
    ) {
      failures.push(
        `[320] 历世同行首批应最近 12/30 段(旧缘30 → 旧缘19)并可再看 12 段,` +
          `实见 ${initial.first ?? "无"} → ${initial.last ?? "无"} / ${initial.count} 行` +
          `(shown ${initial.shown} / total ${initial.total}) «${historyMoreText}»`,
      );
    }

    await page.setViewportSize({ width: 195, height: 422 });
    await settleVisuals(page);
    if (historyMoreCount > 0) {
      await historyMore.scrollIntoViewIfNeeded();
      const fit = await historyMore.evaluate((el) => {
        const box = el.getBoundingClientRect();
        return {
          left: box.left,
          right: box.right,
          height: box.height,
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
          viewport: window.innerWidth,
        };
      });
      checked += 1;
      if (
        fit.left < -1 ||
        fit.right > fit.viewport + 1 ||
        fit.scrollWidth > fit.clientWidth + 1 ||
        fit.height < 27.5
      ) {
        failures.push(
          `[195] 历世同行续开入口被挤坏:盒 ${Math.round(fit.left)}..${Math.round(fit.right)} / ` +
            `内容 ${fit.scrollWidth}>${fit.clientWidth} / 高 ${Math.round(fit.height * 10) / 10}px / ` +
            `视口 ${fit.viewport}`,
        );
      }
    }

    checked += 1;
    const dialogProblems = dialogZoomProblems(
      await measureDialogZoom(page, { width: 390, height: 844 }),
    );
    if (dialogProblems.length) {
      failures.push(`[195] 道侣弹窗 · 历世同行 → ${dialogProblems.join(" / ")}`);
    }

    await page.setViewportSize({ width: 195, height: 422 });
    await settleVisuals(page);
    if (historyMoreCount > 0) {
      await page.locator("[data-bond-history-more]").first().click({ timeout: 5000 });
      await page.waitForFunction(
        () =>
          document
            .querySelector("[data-bond-history-shown]")
            ?.getAttribute("data-bond-history-shown") === "24",
        { timeout: 5000 },
      );
      const second = await page.evaluate(() => ({
        count: document.querySelectorAll("[data-bond-history-row]").length,
        focus: document.activeElement?.getAttribute("data-bond-history-row"),
      }));
      checked += 1;
      if (second.count !== 24 || second.focus !== "旧缘18") {
        failures.push(
          `[195] 历世同行续开第一批后应铺 24 段、焦点落旧缘18,` +
            `实见 ${second.count} 段 / 焦点 ${second.focus ?? "无"}`,
        );
      }

      await page.locator("[data-bond-history-more]").first().click({ timeout: 5000 });
      await page.waitForFunction(
        () =>
          document
            .querySelector("[data-bond-history-shown]")
            ?.getAttribute("data-bond-history-shown") === "30",
        { timeout: 5000 },
      );
      const last = await page.evaluate(() => ({
        count: document.querySelectorAll("[data-bond-history-row]").length,
        start: Number(
          document
            .querySelector("[data-bond-history-total]")
            ?.getAttribute("data-bond-history-start"),
        ),
        focus: document.activeElement?.getAttribute("data-bond-history-row"),
        hasNewest: !!document.querySelector('[data-bond-history-row="旧缘30"]'),
        hasOldest: !!document.querySelector('[data-bond-history-row="旧缘01"]'),
        hasPrev: !!document.querySelector("[data-bond-history-prev]"),
      }));
      checked += 1;
      if (
        last.count !== 24 ||
        last.start !== 6 ||
        last.focus !== "旧缘06" ||
        last.hasNewest ||
        !last.hasOldest ||
        !last.hasPrev
      ) {
        failures.push(
          `[195] 历世同行末批应滑窗为 24/30、从第 7 行起、焦点旧缘06 并可回翻,` +
            `实见 ${last.count} 行 / start ${last.start} / 焦点 ${last.focus ?? "无"} / ` +
            `最近段 ${last.hasNewest ? "仍在" : "已滑走"} / ` +
            `最旧段 ${last.hasOldest ? "在" : "缺失"} / 回翻 ${last.hasPrev ? "在" : "缺失"}`,
        );
      }

      await page.locator("[data-bond-history-prev]").first().click({ timeout: 5000 });
      await page.waitForFunction(
        () =>
          document
            .querySelector("[data-bond-history-shown]")
            ?.getAttribute("data-bond-history-shown") === "24",
        { timeout: 5000 },
      );
      const back = await page.evaluate(() => ({
        focus: document.activeElement?.getAttribute("data-bond-history-row"),
        hasNewest: !!document.querySelector('[data-bond-history-row="旧缘30"]'),
      }));
      checked += 1;
      if (back.focus !== "旧缘30" || !back.hasNewest) {
        failures.push(
          `[195] 历世同行回翻没有回到首批:焦点 ${back.focus ?? "无"} / ` +
            `最近段 ${back.hasNewest ? "在" : "缺失"}`,
        );
      }
    }

    if (pageErrors.length)
      failures.push(`[320] 道侣历世同行场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
  } finally {
    await ctx.close();
  }
  return { failures, checked, contrastFails: [], pixelContrastFails: [], zoomFails: [] };
}

/**
 * 器魂两册 —— 散置形意与可凝法器都没有数量上限。
 *
 * 30 条夹具分别验证:价值高者先见、首批 12 条、续开至 24 条后焦点落到新页首条;
 * 再续一批只保留 24 行 DOM,旧批滑出、最末一条仍可达;回翻回首批并聚焦首条。
 * 两扇弹窗都要在 195 宽下量续开入口与整扇版面。
 */
async function taskSoulListOverflow() {
  const failures = [];
  let checked = 0;
  const ctx = await auditContext({
    viewport: { width: 320, height: 568 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  try {
    const pad = (n) => String(n).padStart(2, "0");
    const souls = [
      {
        uid: "soul_high",
        type: "gangdun",
        grade: 5,
        fromName: "化真古盾",
      },
      ...Array.from({ length: 29 }, (_, i) => ({
        uid: `soul_${pad(i + 1)}`,
        type: "fengmang",
        grade: 0,
        fromName: `旧器${pad(i + 1)}`,
      })),
    ];
    const forgeItems = Array.from({ length: 30 }, (_, i) => ({
      uid: `forge_${pad(i + 1)}`,
      templateId: "w_zidian",
      quality: "mortal",
      tier: i + 1,
      level: 0,
      affixes: [{ id: "crit1", roll: 1 }],
    }));
    const slices = showcaseSlices("light");
    slices.endgame = { ...slices.endgame, souls, equippedSouls: [] };
    slices.inventory = { ...slices.inventory, items: forgeItems, equipped: {} };
    await seedSave(ctx, slices, "__soulListFixture");

    const page = await ctx.newPage();
    await page.addInitScript(() => {
      Math.random = () => 1;
    });
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    await page.goto(INDEX + "#/souls", { waitUntil: "load" });

    async function readList(kind) {
      return page.evaluate((key) => {
        const holder = document.querySelector(`[data-soul-${key}-total]`);
        const rows = [...document.querySelectorAll(`[data-soul-${key}-row]`)];
        const ledger = document.querySelector(`[data-soul-${key}-ledger]`);
        const ledgerStyle = ledger ? getComputedStyle(ledger) : null;
        return {
          total: Number(holder?.getAttribute(`data-soul-${key}-total`)),
          shown: Number(holder?.getAttribute(`data-soul-${key}-shown`)),
          start: Number(holder?.getAttribute(`data-soul-${key}-start`)),
          count: rows.length,
          ids: rows.map((row) => row.getAttribute(`data-soul-${key}-row`)),
          focus: document.activeElement?.getAttribute(`data-soul-${key}-row`),
          ledger: ledgerStyle
            ? {
                borderTop: Number.parseFloat(ledgerStyle.borderTopWidth),
                borderRight: Number.parseFloat(ledgerStyle.borderRightWidth),
                borderBottom: Number.parseFloat(ledgerStyle.borderBottomWidth),
                borderLeft: Number.parseFloat(ledgerStyle.borderLeftWidth),
                radius: Number.parseFloat(ledgerStyle.borderRadius),
                background: ledgerStyle.backgroundColor,
                cards: ledger.querySelectorAll(".card-ink").length,
              }
            : null,
        };
      }, kind);
    }

    async function checkSoulArrayOverview(label, expectedColumns) {
      const layout = await page.evaluate(() => {
        const box = (el) => {
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return {
            top: r.top,
            bottom: r.bottom,
            left: r.left,
            right: r.right,
            width: r.width,
            height: r.height,
            scrollWidth: el.scrollWidth,
            clientWidth: el.clientWidth,
          };
        };
        const masthead = document.querySelector("[data-folio-masthead]");
        const pulse = document.querySelector("[data-soul-pulse]");
        const seats = [...document.querySelectorAll("[data-soul-seat-index]")];
        const identity = pulse?.querySelector(".folio-ledger-head__identity");
        const action = pulse?.querySelector(".folio-ledger-pulse__action");
        const register = document.querySelector("[data-soul-register]");
        const chapters = [...document.querySelectorAll("[data-soul-chapter]")].map((chapter) => {
          const style = getComputedStyle(chapter);
          const head = chapter.querySelector("[data-folio-chapter-head], [data-folio-ledger-head]");
          return {
            key: chapter.getAttribute("data-soul-chapter") || "",
            title:
              chapter
                .querySelector(".folio-chapter-head__title, .folio-ledger-head__title")
                ?.textContent?.trim() || "",
            index:
              chapter
                .querySelector(".folio-chapter-head__index, .folio-ledger-head__seal")
                ?.textContent?.trim() || "",
            fact: chapter.querySelector(".folio-chapter-head__fact")?.textContent?.trim() || "",
            hasHead: Boolean(head),
            borderWidths: [
              style.borderTopWidth,
              style.borderRightWidth,
              style.borderBottomWidth,
              style.borderLeftWidth,
            ].map((width) => Number.parseFloat(width)),
            radius: Number.parseFloat(style.borderTopLeftRadius),
            shadow: style.boxShadow,
            background: style.backgroundColor,
            rect: box(chapter),
          };
        });
        const registerStyle = register ? getComputedStyle(register) : null;
        const dock = document.querySelector("[data-folio-dock]");
        const dockBox = dock?.getBoundingClientRect();
        const seatGrid = document.querySelector("[data-soul-slots]");
        return {
          viewport: { width: window.innerWidth, height: window.innerHeight },
          masthead: box(masthead),
          pulse: box(pulse),
          identity: box(identity),
          action: box(action),
          seats: seats.map(box),
          gridColumns: seatGrid
            ? getComputedStyle(seatGrid).gridTemplateColumns.split(" ").filter(Boolean)
            : [],
          reserveButtons: document.querySelectorAll("[data-soul-reserve] button").length,
          legacyMap: !!document.querySelector("[data-soul-forge-map]"),
          register: registerStyle
            ? {
                borderTop: Number.parseFloat(registerStyle.borderTopWidth),
                borderRight: Number.parseFloat(registerStyle.borderRightWidth),
                borderBottom: Number.parseFloat(registerStyle.borderBottomWidth),
                borderLeft: Number.parseFloat(registerStyle.borderLeftWidth),
                radius: Number.parseFloat(registerStyle.borderTopLeftRadius),
                shadow: registerStyle.boxShadow,
                rect: box(register),
                cardShells: register?.querySelectorAll(".card-ink").length ?? 0,
              }
            : null,
          chapters,
          dockTop:
            dockBox &&
            dockBox.width > 0 &&
            dockBox.height > 0 &&
            dockBox.top > window.innerHeight / 2
              ? dockBox.top
              : window.innerHeight,
          documentOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        };
      });
      checked += 1;
      const followsMasthead =
        layout.masthead &&
        layout.pulse &&
        layout.pulse.top >= layout.masthead.bottom - 1 &&
        layout.pulse.top - layout.masthead.bottom <= 24;
      const sameRow =
        layout.seats.length === 3 &&
        new Set(layout.seats.map((seat) => Math.round(seat?.top ?? -1))).size === 1;
      const twoColumnRows =
        layout.seats.length === 3 &&
        Math.abs(layout.seats[0].top - layout.seats[1].top) <= 1 &&
        layout.seats[2].top >= layout.seats[0].bottom - 1;
      const oneColumnRows =
        layout.seats.length === 3 &&
        layout.seats[0].top < layout.seats[1].top &&
        layout.seats[1].top < layout.seats[2].top;
      const columnsOk =
        expectedColumns === 3 ? sameRow : expectedColumns === 2 ? twoColumnRows : oneColumnRows;
      const actionStacked =
        label !== "320" ||
        (layout.action && layout.identity && layout.action.top >= layout.identity.bottom - 1);
      const firstScreen =
        label !== "390" ||
        (layout.pulse?.bottom <= layout.dockTop + 1 &&
          layout.action?.bottom <= layout.dockTop + 1 &&
          layout.seats[0]?.top < layout.dockTop);
      const fits =
        layout.pulse &&
        layout.pulse.left >= -1 &&
        layout.pulse.right <= layout.viewport.width + 1 &&
        layout.pulse.scrollWidth <= layout.pulse.clientWidth + 1 &&
        layout.seats.every(
          (seat) =>
            seat &&
            seat.left >= -1 &&
            seat.right <= layout.viewport.width + 1 &&
            seat.scrollWidth <= seat.clientWidth + 1 &&
            seat.width >= (expectedColumns === 3 ? 78 : 68),
        ) &&
        layout.gridColumns.length === expectedColumns;
      const chapterTitles = layout.chapters.map((chapter) => chapter.title);
      const brokenChapters = layout.chapters.filter(
        (chapter) =>
          !chapter.hasHead ||
          chapter.radius !== 0 ||
          chapter.shadow !== "none" ||
          chapter.background !== "rgba(0, 0, 0, 0)" ||
          chapter.borderWidths.every((width) => width > 0),
      );
      const registerOk =
        layout.register &&
        layout.register.borderTop >= 1 &&
        layout.register.borderBottom >= 1 &&
        layout.register.borderLeft === 0 &&
        layout.register.borderRight === 0 &&
        layout.register.radius === 0 &&
        layout.register.shadow === "none" &&
        layout.register.cardShells === 0 &&
        layout.register.rect.left >= -1 &&
        layout.register.rect.right <= layout.viewport.width + 1 &&
        layout.register.rect.scrollWidth <= layout.register.rect.clientWidth + 1;
      if (
        !followsMasthead ||
        !columnsOk ||
        !actionStacked ||
        !firstScreen ||
        !fits ||
        layout.chapters.map((chapter) => chapter.key).join(",") !== "array,gateways,principle" ||
        !chapterTitles[0] ||
        chapterTitles[1] !== "两处门径" ||
        chapterTitles[2] !== "器魂章法" ||
        layout.chapters.map((chapter) => chapter.index).join(",") !== "壹,贰,叁" ||
        !layout.chapters[1]?.fact ||
        !layout.chapters[2]?.fact ||
        brokenChapters.length > 0 ||
        !registerOk ||
        layout.reserveButtons !== 0 ||
        layout.legacyMap ||
        layout.documentOverflow
      ) {
        failures.push(
          `[${label}] 器魂阵账没有把题签、三席与先手同时收好:` +
            `紧随卷首=${followsMasthead} / 列=${expectedColumns} 实见 ${layout.gridColumns.length} ` +
            `${
              sameRow
                ? "(三席并排)"
                : twoColumnRows
                  ? "(两席一行)"
                  : oneColumnRows
                    ? "(三席三行)"
                    : "(不正)"
            } / ` +
            `先手另起=${actionStacked} / 首屏=${firstScreen} / ` +
            `账盒=${layout.pulse?.left ?? "-"}..${layout.pulse?.right ?? "-"} / ` +
            `席宽=${layout.seats.map((seat) => Math.round(seat?.width ?? 0)).join("|")} / ` +
            `卷首动作键=${layout.reserveButtons} / 旧阵图=${layout.legacyMap} / ` +
            `横向溢出=${layout.documentOverflow} / ` +
            `章=${JSON.stringify(layout.chapters)} / 散章=${JSON.stringify(brokenChapters)} / ` +
            `续卷=${JSON.stringify(layout.register)}`,
        );
      }
    }

    async function checkSoulRegisterSpread(width, height, label) {
      await page.setViewportSize({ width, height });
      await settleVisuals(page);
      const spread = await page.evaluate(() => {
        const rectOf = (selector) => {
          const el = document.querySelector(selector);
          if (!el) return null;
          const rect = el.getBoundingClientRect();
          return {
            top: Math.round(rect.top),
            right: Math.round(rect.right),
            bottom: Math.round(rect.bottom),
            left: Math.round(rect.left),
            width: Math.round(rect.width),
          };
        };
        const styleOf = (selector) => {
          const el = document.querySelector(selector);
          if (!el) return null;
          const style = getComputedStyle(el);
          return {
            columns: style.gridTemplateColumns.split(/\s+/).filter(Boolean).length,
            borderTop: Number.parseFloat(style.borderTopWidth),
            borderLeft: Number.parseFloat(style.borderLeftWidth),
          };
        };
        return {
          register: rectOf("[data-soul-register]"),
          array: rectOf('[data-soul-chapter="array"]'),
          gateways: rectOf('[data-soul-chapter="gateways"]'),
          principle: rectOf('[data-soul-chapter="principle"]'),
          registerStyle: styleOf("[data-soul-register]"),
          gatewayGridStyle: styleOf(".soul-gateway-grid"),
          principleStyle: styleOf('[data-soul-chapter="principle"]'),
        };
      });
      checked += 1;
      const problems = problemsOf(await measurePage(page));
      checked += 1;
      if (problems.length) {
        failures.push(`[${label}] /souls 器魂续卷 → ${problems.join(" / ")}`);
      }
      if (SHOTS) {
        mkdirSync(SHOTS_DIR, { recursive: true });
        await page.screenshot({
          path: join(SHOTS_DIR, `${label}_soul-register.png`),
          fullPage: true,
        });
      }
      if (
        !spread.register ||
        !spread.array ||
        !spread.gateways ||
        !spread.principle ||
        !spread.registerStyle ||
        !spread.gatewayGridStyle ||
        !spread.principleStyle
      ) {
        failures.push(`[${label}] 器魂续卷的章位没有量全:${JSON.stringify(spread)}`);
        return;
      }
      if (width < 960) {
        const gatewaysOk =
          spread.registerStyle.columns === 1 &&
          spread.gatewayGridStyle.columns === 2 &&
          spread.gateways.top >= spread.array.bottom - 1 &&
          spread.principle.top >= spread.gateways.bottom - 1;
        if (!gatewaysOk) {
          failures.push(
            `[${label}] 器魂续卷在宽桌前仍应单列、门径两行并读:${JSON.stringify(spread)}`,
          );
        }
        return;
      }
      const spreadOk =
        spread.registerStyle.columns === 2 &&
        spread.gatewayGridStyle.columns === 1 &&
        spread.array.left <= spread.register.left + 2 &&
        spread.array.right >= spread.register.right - 2 &&
        Math.abs(spread.gateways.top - spread.principle.top) <= 2 &&
        spread.gateways.right <= spread.principle.left + 1 &&
        spread.principleStyle.borderTop === 0 &&
        spread.principleStyle.borderLeft >= 1;
      if (!spreadOk) {
        failures.push(`[${label}] 器魂门径与章法没有左右并读:${JSON.stringify(spread)}`);
      }
    }

    async function exerciseList({
      kind,
      unit,
      firstId,
      initialLastId,
      secondFocus,
      finalFocus,
      oldestId,
    }) {
      const more = page.locator(`[data-soul-${kind}-more]`).first();
      const moreCount = await more.count();
      const moreText = moreCount
        ? ((await more.textContent()) || "").replace(/\s+/g, " ").trim()
        : "";
      const initial = await readList(kind);
      const ledgerOk =
        initial.ledger &&
        initial.ledger.borderTop === 1 &&
        initial.ledger.borderBottom === 1 &&
        initial.ledger.borderLeft === 0 &&
        initial.ledger.borderRight === 0 &&
        initial.ledger.radius === 0 &&
        initial.ledger.background === "rgba(0, 0, 0, 0)" &&
        initial.ledger.cards === 0;
      checked += 1;
      if (
        initial.total !== 30 ||
        initial.shown !== 12 ||
        initial.start !== 0 ||
        initial.count !== 12 ||
        initial.ids[0] !== firstId ||
        initial.ids.at(-1) !== initialLastId ||
        !ledgerOk ||
        moreCount === 0 ||
        !new RegExp(`再看\\s*12\\s*${unit}\\s*·\\s*余\\s*18`).test(moreText)
      ) {
        failures.push(
          `[320] 器魂${kind === "idle" ? "散置形意" : "凝炼台"}首批应 12/30 ` +
            `(${firstId} → ${initialLastId})并可再看 12 ${unit},` +
            `实见 ${initial.ids[0] ?? "无"} → ${initial.ids.at(-1) ?? "无"} / ${initial.count} 行` +
            `(shown ${initial.shown} / total ${initial.total}) «${moreText}» / ` +
            `浮层账=${JSON.stringify(initial.ledger)}`,
        );
      }

      await page.setViewportSize({ width: 195, height: 422 });
      await settleVisuals(page);
      if (moreCount > 0) {
        await more.scrollIntoViewIfNeeded();
        const fit = await more.evaluate((el) => {
          const box = el.getBoundingClientRect();
          return {
            left: box.left,
            right: box.right,
            height: box.height,
            scrollWidth: el.scrollWidth,
            clientWidth: el.clientWidth,
            viewport: window.innerWidth,
          };
        });
        checked += 1;
        if (
          fit.left < -1 ||
          fit.right > fit.viewport + 1 ||
          fit.scrollWidth > fit.clientWidth + 1 ||
          fit.height < 27.5
        ) {
          failures.push(
            `[195] 器魂${kind === "idle" ? "散置形意" : "凝炼台"}续开入口被挤坏:` +
              `盒 ${Math.round(fit.left)}..${Math.round(fit.right)} / ` +
              `内容 ${fit.scrollWidth}>${fit.clientWidth} / ` +
              `高 ${Math.round(fit.height * 10) / 10}px / 视口 ${fit.viewport}`,
          );
        }
      }

      checked += 1;
      const dialogProblems = dialogZoomProblems(
        await measureDialogZoom(page, { width: 390, height: 844 }),
      );
      if (dialogProblems.length) {
        failures.push(
          `[195] 器魂${kind === "idle" ? "散置形意" : "凝炼台"} → ${dialogProblems.join(" / ")}`,
        );
      }

      await page.setViewportSize({ width: 195, height: 422 });
      await settleVisuals(page);
      if (moreCount > 0) {
        await page.locator(`[data-soul-${kind}-more]`).first().click({ timeout: 5000 });
        await page.waitForFunction(
          (key) =>
            document
              .querySelector(`[data-soul-${key}-total]`)
              ?.getAttribute(`data-soul-${key}-shown`) === "24",
          kind,
          { timeout: 5000 },
        );
        const second = await readList(kind);
        checked += 1;
        if (second.count !== 24 || second.focus !== secondFocus) {
          failures.push(
            `[195] 器魂${kind === "idle" ? "散置形意" : "凝炼台"}续开第一批后应铺 24 条、` +
              `焦点落 ${secondFocus},实见 ${second.count} 条 / 焦点 ${second.focus ?? "无"}`,
          );
        }

        await page.locator(`[data-soul-${kind}-more]`).first().click({ timeout: 5000 });
        await page.waitForFunction(
          (key) =>
            document
              .querySelector(`[data-soul-${key}-total]`)
              ?.getAttribute(`data-soul-${key}-shown`) === "30",
          kind,
          { timeout: 5000 },
        );
        const last = await readList(kind);
        checked += 1;
        if (
          last.count !== 24 ||
          last.start !== 6 ||
          last.focus !== finalFocus ||
          last.ids.includes(firstId) ||
          !last.ids.includes(oldestId) ||
          (await page.locator(`[data-soul-${kind}-prev]`).count()) === 0
        ) {
          failures.push(
            `[195] 器魂${kind === "idle" ? "散置形意" : "凝炼台"}末批应滑窗为 24/30、` +
              `从第 7 行起、焦点 ${finalFocus} 并可回翻,` +
              `实见 ${last.count} 行 / start ${last.start} / 焦点 ${last.focus ?? "无"} / ` +
              `首批 ${last.ids.includes(firstId) ? "仍在" : "已滑走"} / ` +
              `最末 ${last.ids.includes(oldestId) ? "在" : "缺失"}`,
          );
        }

        await page.locator(`[data-soul-${kind}-prev]`).first().click({ timeout: 5000 });
        await page.waitForFunction(
          (key) =>
            document
              .querySelector(`[data-soul-${key}-total]`)
              ?.getAttribute(`data-soul-${key}-shown`) === "24",
          kind,
          { timeout: 5000 },
        );
        const back = await readList(kind);
        checked += 1;
        if (back.focus !== firstId || !back.ids.includes(firstId)) {
          failures.push(
            `[195] 器魂${kind === "idle" ? "散置形意" : "凝炼台"}回翻没有回到首批:` +
              `焦点 ${back.focus ?? "无"} / 首批 ${back.ids.includes(firstId) ? "在" : "缺失"}`,
          );
        }
      }
    }

    const idleEntry = page
      .locator("main button")
      .filter({ hasText: /散置形意/ })
      .first();
    await idleEntry.waitFor({ state: "visible", timeout: 10000 }).catch(() => {});

    await page.locator("[data-soul-pulse]").waitFor({ state: "visible", timeout: 10000 });
    await page.setViewportSize({ width: 390, height: 844 });
    await settleVisuals(page);
    await checkSoulArrayOverview("390", 3);
    if (SHOTS) {
      mkdirSync(SHOTS_DIR, { recursive: true });
      await page.screenshot({
        path: join(SHOTS_DIR, "390_soul-register.png"),
        fullPage: true,
      });
    }

    await checkSoulRegisterSpread(620, 844, "620");
    await checkSoulRegisterSpread(1280, 900, "1280");

    await page.setViewportSize({ width: 320, height: 568 });
    await settleVisuals(page);
    await checkSoulArrayOverview("320", 3);

    await page.setViewportSize({ width: 195, height: 422 });
    await settleVisuals(page);
    await checkSoulArrayOverview("195", 1);
    if (SHOTS) {
      mkdirSync(SHOTS_DIR, { recursive: true });
      await page.screenshot({
        path: join(SHOTS_DIR, "195_soul-register.png"),
        fullPage: true,
      });
    }

    checked += 1;
    if ((await idleEntry.count()) === 0) {
      failures.push("[320] 器魂页找不到「散置形意」入口 —— 闲置两册没有量到");
    } else {
      await idleEntry.click({ timeout: 5000 });
      await page.locator("[data-soul-idle-total]").waitFor({ state: "visible", timeout: 5000 });
      await exerciseList({
        kind: "idle",
        unit: "缕",
        firstId: "soul_high",
        initialLastId: "soul_11",
        secondFocus: "soul_12",
        finalFocus: "soul_24",
        oldestId: "soul_29",
      });
      await page.keyboard.press("Escape");
      await page.locator("[data-soul-idle-total]").waitFor({ state: "hidden", timeout: 5000 });

      const forgeEntry = page
        .locator("main button")
        .filter({ hasText: /凝炼台/ })
        .first();
      await forgeEntry.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
      checked += 1;
      if ((await forgeEntry.count()) === 0) {
        failures.push("[320] 器魂页找不到「凝炼台」入口 —— 可凝册没有量到");
      } else {
        await forgeEntry.click({ timeout: 5000 });
        await page.locator("[data-soul-forge-total]").waitFor({ state: "visible", timeout: 5000 });
        await exerciseList({
          kind: "forge",
          unit: "件",
          firstId: "forge_30",
          initialLastId: "forge_19",
          secondFocus: "forge_18",
          finalFocus: "forge_06",
          oldestId: "forge_01",
        });
      }
    }

    if (pageErrors.length)
      failures.push(`[320] 器魂两册场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
  } finally {
    await ctx.close();
  }
  return { failures, checked, contrastFails: [], pixelContrastFails: [], zoomFails: [] };
}

/**
 * 名号 / 灵兽全册 —— 69 条终局清单的两册回看。
 *
 * 两册此前都整份铺进 DOM,而名号页永远同时拥有全部称号、灵兽页也会随着收集
 * 长到四十只。更隐蔽的一处是「相伴中」只排在品阶之后:低品阶的当前伙伴会被
 * 高品阶旧收藏压到后面。这里用全拥有夹具把两件事一起量到底。
 */
async function taskTitlePetOverflow() {
  const failures = [];
  let checked = 0;
  const ctx = await auditContext({
    viewport: { width: 320, height: 568 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  try {
    const activePet = PETS[0];
    const wornTitle = TITLES.at(-1);
    if (!activePet || !wornTitle) throw new Error("名号 / 灵兽夹具取不到首尾条目");
    const activePetId = activePet.id;
    const wornTitleId = wornTitle.id;
    const petSorted = [...PETS].sort(
      (a, b) =>
        Number(b.id === activePetId) - Number(a.id === activePetId) ||
        qualityDef(b.quality).rank - qualityDef(a.quality).rank,
    );
    const titleSorted = [wornTitle, ...TITLES.filter((title) => title.id !== wornTitleId)];
    const slices = showcaseSlices("light");
    slices.player = {
      ...slices.player,
      titleId: wornTitleId,
      petId: activePetId,
    };
    slices.quests = {
      ...slices.quests,
      titlesOwned: TITLES.map((title) => title.id),
      collections: {
        ...slices.quests.collections,
        pet: PETS.map((pet) => pet.id),
      },
      petCompanions: PETS.map((pet) => pet.id),
    };
    await seedSave(ctx, slices, "__titlePetFixture");

    const page = await ctx.newPage();
    await page.addInitScript(() => {
      Math.random = () => 1;
    });
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    await page.goto(INDEX + "#/titles", { waitUntil: "load" });
    const titleTab = page.getByRole("tab", { name: /名号/ }).first();
    const petTab = page.getByRole("tab", { name: /灵兽/ }).first();

    async function readList(kind) {
      return page.evaluate((key) => {
        const holder = document.querySelector(`[data-${key}-total]`);
        const rows = [...document.querySelectorAll(`[data-${key}-row]`)];
        return {
          total: Number(holder?.getAttribute(`data-${key}-total`)),
          shown: Number(holder?.getAttribute(`data-${key}-shown`)),
          start: Number(holder?.getAttribute(`data-${key}-start`)),
          count: rows.length,
          ids: rows.map((row) => row.getAttribute(`data-${key}-row`)),
          focus: document.activeElement?.getAttribute(`data-${key}-row`),
        };
      }, kind);
    }

    async function waitForShown(kind, shown) {
      await page.waitForFunction(
        ({ key, wanted }) =>
          document.querySelector(`[data-${key}-total]`)?.getAttribute(`data-${key}-shown`) ===
          String(wanted),
        { key: kind, wanted: shown },
        { timeout: 5000 },
      );
    }

    async function waitForFocus(kind, id) {
      await page
        .waitForFunction(
          ({ key, rowId }) => document.activeElement?.getAttribute(`data-${key}-row`) === rowId,
          { key: kind, rowId: id },
          { timeout: 2000 },
        )
        .catch(() => {});
    }

    async function checkMoreFit(kind, label) {
      const more = page.locator(`[data-${kind}-more]`).first();
      if ((await more.count()) === 0) return;
      await more.scrollIntoViewIfNeeded();
      const fit = await more.evaluate((el) => {
        const box = el.getBoundingClientRect();
        return {
          left: box.left,
          right: box.right,
          height: box.height,
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
          viewport: window.innerWidth,
        };
      });
      checked += 1;
      if (
        fit.left < -1 ||
        fit.right > fit.viewport + 1 ||
        fit.scrollWidth > fit.clientWidth + 1 ||
        fit.height < 27.5
      ) {
        failures.push(
          `[195] ${label}续开入口被挤坏:` +
            `盒 ${Math.round(fit.left)}..${Math.round(fit.right)} / ` +
            `内容 ${fit.scrollWidth}>${fit.clientWidth} / ` +
            `高 ${Math.round(fit.height * 10) / 10}px / 视口 ${fit.viewport}`,
        );
      }
    }

    async function nameBeastDeskSpread(kind, label) {
      const layout = await page.evaluate((key) => {
        const summary = document.querySelector(`[data-${key}-ledger]`);
        const index = document.querySelector(`[data-${key}-total]`);
        const tab = summary?.closest(".name-beast-tab");
        if (!summary || !index || !tab) return null;
        const summaryBox = summary.getBoundingClientRect();
        const indexBox = index.getBoundingClientRect();
        const tabStyle = getComputedStyle(tab);
        return {
          display: tabStyle.display,
          columns: tabStyle.gridTemplateColumns.split(" ").filter(Boolean),
          summary: {
            left: summaryBox.left,
            right: summaryBox.right,
            top: summaryBox.top,
            width: summaryBox.width,
          },
          index: {
            left: indexBox.left,
            right: indexBox.right,
            top: indexBox.top,
            width: indexBox.width,
          },
          viewport: window.innerWidth,
        };
      }, kind);
      checked += 1;
      if (
        !layout ||
        layout.display !== "grid" ||
        layout.columns.length !== 2 ||
        Math.abs(layout.summary.top - layout.index.top) > 2 ||
        layout.summary.right > layout.index.left + 1 ||
        layout.summary.width < 270 ||
        layout.index.width < 390 ||
        layout.summary.left < -1 ||
        layout.index.right > layout.viewport + 1
      ) {
        failures.push(
          `[1280] 名兽案总案与全谱没有摊成左右两页:${label} ` +
            (layout
              ? `display=${layout.display} / columns=${layout.columns.join(" | ")} / ` +
                `左 ${Math.round(layout.summary.left)}..${Math.round(layout.summary.right)} ` +
                `(${Math.round(layout.summary.width)}) / ` +
                `右 ${Math.round(layout.index.left)}..${Math.round(layout.index.right)} ` +
                `(${Math.round(layout.index.width)}) / ` +
                `顶差 ${Math.round(Math.abs(layout.summary.top - layout.index.top))}`
              : "取不到总案或全谱"),
        );
      }
    }

    async function checkNameBeastRegister(label, expectedLayout) {
      const layout = await page.evaluate(() => {
        const box = (el) => {
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return {
            left: r.left,
            right: r.right,
            top: r.top,
            bottom: r.bottom,
            width: r.width,
            height: r.height,
            scrollWidth: el.scrollWidth,
            clientWidth: el.clientWidth,
          };
        };
        const register = document.querySelector("[data-name-beast-register]");
        const panel = [...document.querySelectorAll(".name-beast-tab")].find(
          (el) => getComputedStyle(el).display !== "none",
        );
        const chapters = panel
          ? [...panel.querySelectorAll(":scope > [data-name-beast-chapter]")]
          : [];
        const registerStyle = register ? getComputedStyle(register) : null;
        return {
          viewport: { width: window.innerWidth, height: window.innerHeight },
          register: box(register),
          registerBorderTop: registerStyle?.borderTopWidth ?? "0px",
          registerBorderBottom: registerStyle?.borderBottomWidth ?? "0px",
          chapters: chapters.map((chapter) => {
            const head = chapter.querySelector("[data-folio-chapter-head]");
            return {
              key: chapter.getAttribute("data-name-beast-chapter"),
              box: box(chapter),
              head: {
                box: box(head),
                index: (head?.querySelector(".folio-chapter-head__index")?.textContent || "")
                  .replace(/\s+/g, "")
                  .trim(),
                title: (head?.querySelector(".folio-chapter-head__title")?.textContent || "")
                  .replace(/\s+/g, " ")
                  .trim(),
                hint: (head?.querySelector(".folio-chapter-head__hint")?.textContent || "")
                  .replace(/\s+/g, " ")
                  .trim(),
                fact: (head?.querySelector(".folio-chapter-head__fact")?.textContent || "")
                  .replace(/\s+/g, " ")
                  .trim(),
              },
            };
          }),
        };
      });
      checked += 1;
      const [first, second] = layout.chapters;
      const sameRow =
        first &&
        second &&
        Math.abs(first.box.top - second.box.top) <= 2 &&
        first.box.right <= second.box.left + 1;
      const stacked =
        first && second && second.box.top >= first.box.bottom - 2 && second.box.top > first.box.top;
      const arranged = expectedLayout === "columns" ? sameRow : stacked;
      const chapterOrder =
        first?.key === "focus" &&
        second?.key === "index" &&
        first.head.index === "壹" &&
        second.head.index === "贰";
      const headsReadable =
        layout.chapters.length === 2 &&
        layout.chapters.every(
          (chapter) =>
            chapter.head.box &&
            chapter.head.box.width > 0 &&
            chapter.head.box.scrollWidth <= chapter.head.box.clientWidth + 1 &&
            chapter.head.title.length > 0 &&
            chapter.head.hint.length > 0 &&
            chapter.head.fact.length > 0,
        );
      const insideRegister =
        layout.register &&
        layout.chapters.length === 2 &&
        layout.chapters.every(
          (chapter) =>
            chapter.box.left >= layout.register.left - 1 &&
            chapter.box.right <= layout.register.right + 1,
        ) &&
        layout.registerBorderTop !== "0px" &&
        layout.registerBorderBottom !== "0px";
      if (
        !arranged ||
        !chapterOrder ||
        !headsReadable ||
        !insideRegister ||
        layout.register.scrollWidth > layout.register.clientWidth + 1
      ) {
        failures.push(
          `[${label}] 名兽续卷没有按两章收好:` +
            `排布=${expectedLayout} 实见 ${sameRow ? "左右" : stacked ? "上下" : "不正"} / ` +
            `章序=${layout.chapters.map((chapter) => chapter.key || "无").join("→") || "无"} / ` +
            `章号=${layout.chapters.map((chapter) => chapter.head.index || "无").join("→") || "无"} / ` +
            `章首=${layout.chapters
              .map((chapter) => `«${chapter.head.title || "无"}»/${chapter.head.fact || "无真值"}`)
              .join(" | ")} / ` +
            `续卷=${layout.register?.left ?? "-"}..${layout.register?.right ?? "-"} / ` +
            `上下账线=${layout.registerBorderTop}/${layout.registerBorderBottom} / ` +
            `内容 ${layout.register?.scrollWidth ?? 0}>${layout.register?.clientWidth ?? 0}`,
        );
      }
    }

    async function checkNameBeastOverview(label, expectedColumns) {
      const layout = await page.evaluate(() => {
        const box = (el) => {
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return {
            left: r.left,
            right: r.right,
            top: r.top,
            bottom: r.bottom,
            width: r.width,
            height: r.height,
            scrollWidth: el.scrollWidth,
            clientWidth: el.clientWidth,
          };
        };
        const masthead = document.querySelector("[data-folio-masthead]");
        const switcher = document.querySelector("[data-name-beast-switch]");
        const tabs = [...document.querySelectorAll("[data-name-beast-tab]")];
        const dock = document.querySelector("[data-folio-dock]");
        const dockBox = dock?.getBoundingClientRect();
        const dockTop =
          dockBox && dockBox.width > 0 && dockBox.height > 0 && dockBox.top > window.innerHeight / 2
            ? dockBox.top
            : window.innerHeight;
        return {
          viewport: { width: window.innerWidth, height: window.innerHeight },
          masthead: box(masthead),
          switcher: box(switcher),
          tabs: tabs.map((tab) => ({
            box: box(tab),
            kind: tab.getAttribute("data-kind"),
            selected: tab.getAttribute("aria-selected") === "true",
            text: (tab.textContent || "").replace(/\s+/g, " ").trim(),
          })),
          current: box(document.querySelector("[data-title-current]")),
          guide: box(document.querySelector("[data-title-guide]")),
          firstAction: box(document.querySelector("[data-title-row] button")),
          dockTop,
          documentOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        };
      });
      checked += 1;
      const sameRow =
        layout.tabs.length === 2 && Math.abs(layout.tabs[0].box.top - layout.tabs[1].box.top) <= 2;
      const stacked =
        layout.tabs.length === 2 && layout.tabs[1].box.top >= layout.tabs[0].box.bottom - 1;
      const tabFits = layout.tabs.every(
        ({ box }) =>
          box.left >= -1 &&
          box.right <= layout.viewport.width + 1 &&
          box.scrollWidth <= box.clientWidth + 1 &&
          box.width >= 100,
      );
      const columnsOk = expectedColumns === 2 ? sameRow : stacked;
      const followsMasthead =
        layout.masthead &&
        layout.switcher &&
        layout.switcher.top >= layout.masthead.bottom - 1 &&
        layout.switcher.top - layout.masthead.bottom <= 24;
      const overviewFits =
        layout.switcher &&
        layout.switcher.left >= -1 &&
        layout.switcher.right <= layout.viewport.width + 1 &&
        layout.switcher.scrollWidth <= layout.switcher.clientWidth + 1;
      const firstScreen =
        expectedColumns !== 2 ||
        layout.viewport.width < 390 ||
        (layout.switcher?.bottom <= layout.viewport.height + 1 &&
          layout.current?.bottom <= layout.dockTop + 1 &&
          layout.guide?.bottom <= layout.dockTop + 1 &&
          layout.firstAction?.top < layout.dockTop);
      const readable =
        layout.tabs.some(
          (tab) =>
            tab.kind === "title" &&
            tab.text.includes(`${TITLES.length}/${TITLES.length}`) &&
            tab.text.includes("名号尽收"),
        ) &&
        layout.tabs.some(
          (tab) =>
            tab.kind === "pet" &&
            tab.text.includes(`${PETS.length}/${PETS.length}`) &&
            tab.text.includes("灵兽尽收"),
        );
      if (
        !columnsOk ||
        !tabFits ||
        !followsMasthead ||
        !overviewFits ||
        !firstScreen ||
        !readable ||
        layout.documentOverflow
      ) {
        failures.push(
          `[${label}] 双契总览没有把两册、首屏与极窄档同时收好:` +
            `列=${expectedColumns} 实见 ${sameRow ? "并排" : stacked ? "上下" : "不正"} / ` +
            `卷首间距=${Math.round((layout.switcher?.top ?? 0) - (layout.masthead?.bottom ?? 0))}px / ` +
            `总览=${layout.switcher?.left ?? "-"}..${layout.switcher?.right ?? "-"} / ` +
            `当前底=${Math.round(layout.current?.bottom ?? -1)} ` +
            `下一印底=${Math.round(layout.guide?.bottom ?? -1)} ` +
            `首行动作顶=${Math.round(layout.firstAction?.top ?? -1)} ` +
            `底栏顶=${Math.round(layout.dockTop)} / ` +
            `读数=${layout.tabs.map((tab) => `«${tab.text}»`).join(" | ") || "无"} / ` +
            `文档横向溢出=${layout.documentOverflow}`,
        );
      }
    }

    async function exerciseList({ kind, label, unit, total, sortedIds }) {
      const initial = await readList(kind);
      const more = page.locator(`[data-${kind}-more]`).first();
      const moreText = ((await more.textContent()) || "").replace(/\s+/g, " ").trim();
      const remaining = total - 12;
      checked += 1;
      if (
        initial.total !== total ||
        initial.shown !== 12 ||
        initial.start !== 0 ||
        initial.count !== 12 ||
        initial.ids[0] !== sortedIds[0] ||
        initial.ids.at(-1) !== sortedIds[11] ||
        !new RegExp(`再看\\s*12\\s*${unit}\\s*·\\s*余\\s*${remaining}`).test(moreText)
      ) {
        failures.push(
          `[320] ${label}首批应 12/${total}(${sortedIds[0]} → ${sortedIds[11]}),` +
            `实见 ${initial.ids[0] ?? "无"} → ${initial.ids.at(-1) ?? "无"} / ${initial.count} 行 ` +
            `(shown ${initial.shown} / total ${initial.total}) «${moreText}»`,
        );
      }

      await checkMoreFit(kind, label);
      checked += 1;
      const zoomProblems = problemsOf(await measurePage(page));
      if (zoomProblems.length) {
        failures.push(`[195] ${label} → ${zoomProblems.join(" / ")}`);
      }

      await page.locator(`[data-${kind}-more]`).first().click({ timeout: 5000 });
      await waitForShown(kind, 24);
      await waitForFocus(kind, sortedIds[12]);
      const second = await readList(kind);
      checked += 1;
      if (
        second.shown !== 24 ||
        second.start !== 0 ||
        second.count !== 24 ||
        second.focus !== sortedIds[12]
      ) {
        failures.push(
          `[195] ${label}续开第一批后应铺 24 条、焦点落 ${sortedIds[12]},` +
            `实见 ${second.count} 条 / start ${second.start} / 焦点 ${second.focus ?? "无"}`,
        );
      }

      let last = second;
      let shownBefore = second.shown;
      let finalFocus = sortedIds[12];
      while (shownBefore < total) {
        const shownAfter = Math.min(total, shownBefore + 12);
        const focusId = sortedIds[shownBefore];
        await page.locator(`[data-${kind}-more]`).first().click({ timeout: 5000 });
        await waitForShown(kind, shownAfter);
        await waitForFocus(kind, focusId);
        last = await readList(kind);
        const expectedStart = Math.max(0, shownAfter - 24);
        const expectedCount = shownAfter - expectedStart;
        checked += 1;
        if (
          last.shown !== shownAfter ||
          last.start !== expectedStart ||
          last.count !== expectedCount ||
          last.focus !== focusId
        ) {
          failures.push(
            `[195] ${label}续开到第 ${shownAfter} 条时窗口不对:` +
              `应 ${expectedCount} 行 / start ${expectedStart} / ` +
              `焦点 ${focusId},实见 ${last.count} 行 / start ${last.start} / ` +
              `焦点 ${last.focus ?? "无"}(shown ${last.shown})`,
          );
        }
        finalFocus = focusId;
        shownBefore = shownAfter;
      }
      const expectedStart = total - 24;
      checked += 1;
      if (
        last.count !== 24 ||
        last.start !== expectedStart ||
        last.focus !== finalFocus ||
        last.ids.includes(sortedIds[0]) ||
        !last.ids.includes(sortedIds.at(-1)) ||
        (await page.locator(`[data-${kind}-more]`).count()) > 0 ||
        (await page.locator(`[data-${kind}-prev]`).count()) === 0
      ) {
        failures.push(
          `[195] ${label}末批应滑窗为 24/${total}、从第 ${expectedStart + 1} 行起、` +
            `焦点 ${finalFocus} 并可回翻,` +
            `实见 ${last.count} 行 / start ${last.start} / 焦点 ${last.focus ?? "无"} / ` +
            `首批 ${last.ids.includes(sortedIds[0]) ? "仍在" : "已滑走"} / ` +
            `末件 ${last.ids.includes(sortedIds.at(-1)) ? "在" : "缺失"}`,
        );
      }

      const backShown = Math.max(12, Math.floor((total - 1) / 12) * 12);
      const backStart = backShown - 24;
      await page.locator(`[data-${kind}-prev]`).first().click({ timeout: 5000 });
      await waitForShown(kind, backShown);
      await waitForFocus(kind, sortedIds[backStart]);
      const back = await readList(kind);
      checked += 1;
      if (
        back.start !== backStart ||
        back.count !== 24 ||
        back.focus !== sortedIds[backStart] ||
        !back.ids.includes(sortedIds[backStart])
      ) {
        failures.push(
          `[195] ${label}回翻没有回到上一页:` +
            `应 start ${backStart} / 24 行 / 焦点 ${sortedIds[backStart]},` +
            `实见 start ${back.start} / ${back.count} 行 / 焦点 ${back.focus ?? "无"}`,
        );
      }

      const selectedId = sortedIds[backStart + 12];
      await page.locator(`[data-${kind}-row="${selectedId}"] button`).first().click({
        timeout: 5000,
      });
      await waitForShown(kind, 12);
      await waitForFocus(kind, selectedId);
      const selected = await readList(kind);
      checked += 1;
      if (
        selected.shown !== 12 ||
        selected.start !== 0 ||
        selected.count !== 12 ||
        selected.ids[0] !== selectedId ||
        selected.focus !== selectedId
      ) {
        failures.push(
          `[195] ${label}换选后没有回到首批并露出新选:` +
            `应 ${selectedId} 在首行 / 12 行 / 焦点同项,` +
            `实见首行 ${selected.ids[0] ?? "无"} / ${selected.count} 行 / ` +
            `焦点 ${selected.focus ?? "无"}(shown ${selected.shown})`,
        );
      }
    }

    await page.locator("[data-title-total]").waitFor({ state: "visible", timeout: 10000 });
    const titleCurrentText =
      (await page.locator("[data-title-current]").first().textContent())?.replace(/\s+/g, " ") ??
      "";
    checked += 1;
    if (!titleCurrentText.includes(wornTitle.name)) {
      failures.push(
        `[320] 名号卷首没有报出当前佩印「${wornTitle.name}」:${titleCurrentText || "空白"}`,
      );
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await settleVisuals(page);
    await checkNameBeastOverview("390", 2);
    await checkNameBeastRegister("390", "stacked");

    const titleSwitchTab = page.locator('[data-name-beast-tab][data-kind="title"]');
    await titleSwitchTab.focus();
    await page.keyboard.press("ArrowRight");
    await page.locator("#pet-panel").waitFor({ state: "visible", timeout: 3000 });
    const petByArrow = await page.evaluate(() => ({
      focused: document.activeElement?.getAttribute("data-kind"),
      selected: document
        .querySelector('[data-name-beast-tab][data-kind="pet"]')
        ?.getAttribute("aria-selected"),
    }));
    checked += 1;
    if (petByArrow.focused !== "pet" || petByArrow.selected !== "true") {
      failures.push(
        `[390] 双契总览右方向键没有把焦点与选中一起移到灵兽:` +
          `焦点=${petByArrow.focused ?? "无"} / aria-selected=${petByArrow.selected ?? "无"}`,
      );
    }
    await page.keyboard.press("Home");
    await page.locator("#title-panel").waitFor({ state: "visible", timeout: 3000 });
    const titleByHome = await page.evaluate(() => ({
      focused: document.activeElement?.getAttribute("data-kind"),
      selected: document
        .querySelector('[data-name-beast-tab][data-kind="title"]')
        ?.getAttribute("aria-selected"),
    }));
    checked += 1;
    if (titleByHome.focused !== "title" || titleByHome.selected !== "true") {
      failures.push(
        `[390] 双契总览 Home 没有回到名号:` +
          `焦点=${titleByHome.focused ?? "无"} / aria-selected=${titleByHome.selected ?? "无"}`,
      );
    }

    await page.setViewportSize({ width: 320, height: 568 });
    await settleVisuals(page);
    await checkNameBeastOverview("320", 2);

    await page.setViewportSize({ width: 1280, height: 800 });
    await settleVisuals(page);
    await checkNameBeastOverview("1280", 2);
    await checkNameBeastRegister("1280", "columns");
    await nameBeastDeskSpread("title", "名号册");

    await petTab.click({ timeout: 5000 });
    await page.locator("[data-pet-total]").waitFor({ state: "visible", timeout: 5000 });
    await settleVisuals(page);
    await nameBeastDeskSpread("pet", "灵兽册");

    await page.setViewportSize({ width: 195, height: 422 });
    await titleTab.click({ timeout: 5000 });
    await page.locator("[data-title-total]").waitFor({ state: "visible", timeout: 5000 });
    await settleVisuals(page);
    await checkNameBeastRegister("195", "stacked");
    await exerciseList({
      kind: "title",
      label: "名号册",
      unit: "顶",
      total: TITLES.length,
      sortedIds: titleSorted.map((title) => title.id),
    });

    await petTab.click({ timeout: 5000 });
    await page.locator("[data-pet-total]").waitFor({ state: "visible", timeout: 5000 });
    const petCurrentText =
      (await page.locator("[data-pet-current]").first().textContent())?.replace(/\s+/g, " ") ?? "";
    checked += 1;
    if (!petCurrentText.includes(activePet.name)) {
      failures.push(
        `[320] 灵兽卷首没有报出当前相伴「${activePet.name}」:${petCurrentText || "空白"}`,
      );
    }
    await settleVisuals(page);
    await exerciseList({
      kind: "pet",
      label: "灵兽册",
      unit: "只",
      total: PETS.length,
      sortedIds: petSorted.map((pet) => pet.id),
    });

    if (pageErrors.length)
      failures.push(`[320] 名号 / 灵兽两册场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
  } finally {
    await ctx.close();
  }
  return { failures, checked, contrastFails: [], pixelContrastFails: [], zoomFails: [] };
}

/**
 * 法宝全册 —— 45 条名/描述/被动/神通/代价/双按钮长账,不许整册铺进页面。
 *
 * 这里补齐三件运行时事实:六件首批、十二件滑窗、195 宽下双按钮与代价行不变形;
 * 逐批翻到末页再回翻,既证全册可达,也证焦点跟着新批走。最后真按「随身」与
 * 「炼化」:前者不改排序但焦点要留在原卡,后者会按祭炼等级改序,卡若越过窗口
 * 必须按新位置所在批次重开窗,仍把焦点送回同一件。
 */
async function taskArtifactListOverflow() {
  const failures = [];
  let checked = 0;
  const ctx = await auditContext({
    viewport: { width: 320, height: 568 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  let vite = null;
  try {
    // 法宝内容表走 Vite 解析 @/ 别名,不手抄 id,也不要求 Bun 直接理解应用别名。
    vite = await createViteServer({
      root: ROOT,
      server: { middlewareMode: true },
      appType: "custom",
      logLevel: "silent",
    });
    const artifactFixture = await vite.ssrLoadModule("/scripts/lib/fullArtifactFixture.ts");
    const artifactRows = artifactFixture.fullArtifactRows();
    const sortedIds = artifactRows.map((artifact) => artifact.defId);
    const equippedIds = sortedIds.slice(0, 2);
    const total = artifactRows.length;

    const slices = showcaseSlices("light");
    slices.resources = {
      ...slices.resources,
      spiritStone: { m: 9, e: 30 },
      wudao: 500000,
    };
    slices.inventory = {
      ...slices.inventory,
      items: [],
      equipped: {},
      artifacts: artifactRows.map(({ defId, level }) => ({ defId, level })),
      equippedArtifacts: equippedIds,
    };
    await seedSave(ctx, slices, "__artifactListFixture");

    const page = await ctx.newPage();
    await page.addInitScript(() => {
      Math.random = () => 1;
    });
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    await page.goto(INDEX + "#/inventory", { waitUntil: "load" });
    await page
      .getByRole("tab", { name: /法\s*宝/ })
      .first()
      .click({ timeout: 5000 });
    await page.locator("[data-artifact-overview]").waitFor({ state: "visible", timeout: 10000 });
    await page.locator("[data-artifact-total]").waitFor({ state: "visible", timeout: 10000 });
    const overview = await page.evaluate(() => {
      const holder = document.querySelector("[data-artifact-overview]");
      const seats = [...document.querySelectorAll("[data-artifact-seat]")];
      const values = Object.fromEntries(
        [...document.querySelectorAll("[data-artifact-summary]")].map((node) => [
          node.getAttribute("data-artifact-summary"),
          Number(node.querySelector("strong")?.textContent),
        ]),
      );
      const register = document.querySelector("[data-artifact-register]");
      const rows = [...document.querySelectorAll("[data-artifact-row]")];
      return {
        owned: Number(holder?.getAttribute("data-artifact-owned")),
        carried: Number(holder?.getAttribute("data-artifact-carried")),
        slots: Number(holder?.getAttribute("data-artifact-slots-count")),
        ready: Number(holder?.getAttribute("data-artifact-ready")),
        short: Number(holder?.getAttribute("data-artifact-short")),
        maxed: Number(holder?.getAttribute("data-artifact-maxed")),
        seats: seats.length,
        filled: seats.filter((seat) => seat.getAttribute("data-artifact-seat-filled") === "true")
          .length,
        values,
        register: Boolean(register),
        emptyMarker: Boolean(register?.hasAttribute("data-artifact-empty")),
        cardInk: register?.querySelectorAll(".card-ink").length ?? -1,
        boxedRows: rows.filter((row) => {
          const style = getComputedStyle(row);
          const widths = [
            style.borderTopWidth,
            style.borderRightWidth,
            style.borderBottomWidth,
            style.borderLeftWidth,
          ].map((width) => Number.parseFloat(width) || 0);
          return (
            widths.every((width) => width > 0) ||
            (Number.parseFloat(style.borderTopLeftRadius) || 0) > 0 ||
            style.backgroundColor !== "rgba(0, 0, 0, 0)"
          );
        }).length,
      };
    });
    checked += 1;
    if (
      overview.owned !== total ||
      overview.carried !== equippedIds.length ||
      overview.slots !== 2 ||
      overview.seats !== 2 ||
      overview.filled !== equippedIds.length ||
      overview.ready !== overview.values.ready ||
      overview.short !== overview.values.short ||
      overview.maxed !== overview.values.maxed ||
      overview.ready + overview.short + overview.maxed !== total ||
      !overview.register ||
      overview.emptyMarker ||
      overview.cardInk !== 0 ||
      overview.boxedRows !== 0
    ) {
      failures.push(
        `[320] 法宝阵账与全册不同源:` +
          `应 ${total} 件 / 随身 ${equippedIds.length} / 2 位 / 3 项读数合计 ${total},` +
          `实见 ${overview.owned} 件 / 随身 ${overview.carried} / ${overview.slots} 位 / ` +
          `席位 ${overview.filled}/${overview.seats} / ` +
          `可炼 ${overview.ready} · 欠料 ${overview.short} · 满重 ${overview.maxed} / ` +
          `长账 ${overview.register} / 空标记 ${overview.emptyMarker} / ` +
          `card-ink ${overview.cardInk} / 四边行 ${overview.boxedRows}`,
      );
    }
    await settleVisuals(page);
    if (SHOTS) {
      await page.screenshot({ path: join(SHOTS_DIR, "320_artifact.png") });
      await page.locator("[data-artifact-row]").first().scrollIntoViewIfNeeded();
      await settleVisuals(page);
      await page.screenshot({ path: join(SHOTS_DIR, "320_artifact-row.png") });
      await page.locator("[data-artifact-overview]").scrollIntoViewIfNeeded();
    }
    await page.setViewportSize({ width: 195, height: 422 });
    await page.locator("[data-artifact-overview]").scrollIntoViewIfNeeded();
    await settleVisuals(page);
    if (SHOTS) {
      await page.screenshot({ path: join(SHOTS_DIR, "195_artifact.png") });
      await page.locator("[data-artifact-row]").first().scrollIntoViewIfNeeded();
      await settleVisuals(page);
      await page.screenshot({ path: join(SHOTS_DIR, "195_artifact-row.png") });
    }

    async function readList() {
      return page.evaluate(() => {
        const holder = document.querySelector("[data-artifact-total]");
        const rows = [...document.querySelectorAll("[data-artifact-row]")];
        return {
          total: Number(holder?.getAttribute("data-artifact-total")),
          shown: Number(holder?.getAttribute("data-artifact-shown")),
          start: Number(holder?.getAttribute("data-artifact-start")),
          seats: [...document.querySelectorAll("[data-artifact-seat-id]")].map((seat) =>
            seat.getAttribute("data-artifact-seat-id"),
          ),
          count: rows.length,
          ids: rows.map((row) => row.getAttribute("data-artifact-row")),
          focus: document.activeElement?.getAttribute("data-artifact-row"),
        };
      });
    }

    async function waitForShown(shown) {
      await page.waitForFunction(
        (wanted) =>
          document.querySelector("[data-artifact-total]")?.getAttribute("data-artifact-shown") ===
          String(wanted),
        shown,
        { timeout: 5000 },
      );
    }

    async function waitForFocus(id) {
      await page
        .waitForFunction(
          (rowId) => document.activeElement?.getAttribute("data-artifact-row") === rowId,
          id,
          { timeout: 2000 },
        )
        .catch(() => {});
    }

    const initial = await readList();
    const more = page.locator("[data-artifact-more]").first();
    const moreText = ((await more.textContent()) || "").replace(/\s+/g, " ").trim();
    checked += 1;
    if (
      initial.total !== total ||
      initial.shown !== 6 ||
      initial.start !== 0 ||
      initial.count !== 6 ||
      initial.ids[0] !== sortedIds[0] ||
      initial.ids.at(-1) !== sortedIds[5] ||
      !new RegExp(`再看\\s*6\\s*件\\s*·\\s*余\\s*${total - 6}`).test(moreText)
    ) {
      failures.push(
        `[320] 法宝册首批应 6/${total}(${sortedIds[0]} → ${sortedIds[5]}),` +
          `实见 ${initial.ids[0] ?? "无"} → ${initial.ids.at(-1) ?? "无"} / ${initial.count} 行 ` +
          `(shown ${initial.shown} / total ${initial.total}) «${moreText}»`,
      );
    }

    checked += 1;
    const actionFit = await page.evaluate(() => {
      return [...document.querySelectorAll("[data-artifact-row]")].flatMap((row) => {
        const rowBox = row.getBoundingClientRect();
        return [...row.querySelectorAll("button")].map((button) => {
          const box = button.getBoundingClientRect();
          return {
            row: row.getAttribute("data-artifact-row"),
            text: (button.textContent || "").replace(/\s+/g, " ").trim().slice(0, 18),
            left: box.left,
            right: box.right,
            height: box.height,
            rowLeft: rowBox.left,
            rowRight: rowBox.right,
            scrollWidth: button.scrollWidth,
            clientWidth: button.clientWidth,
            viewport: window.innerWidth,
          };
        });
      });
    });
    const clippedAction = actionFit.find(
      (button) =>
        button.left < button.rowLeft - 1 ||
        button.right > button.rowRight + 1 ||
        button.right > button.viewport + 1 ||
        button.scrollWidth > button.clientWidth + 1 ||
        button.height < 27.5,
    );
    if (!actionFit.length || clippedAction) {
      failures.push(
        `[195] 法宝账行动作被裁:` +
          (clippedAction
            ? `${clippedAction.row}«${clippedAction.text}» ` +
              `${Math.round(clippedAction.left)}..${Math.round(clippedAction.right)} / ` +
              `行 ${Math.round(clippedAction.rowLeft)}..${Math.round(clippedAction.rowRight)} / ` +
              `内容 ${clippedAction.scrollWidth}>${clippedAction.clientWidth} / ` +
              `高 ${Math.round(clippedAction.height * 10) / 10}`
            : "一件动作都没量到"),
      );
    }

    const fit = await more.evaluate((el) => {
      const box = el.getBoundingClientRect();
      return {
        left: box.left,
        right: box.right,
        height: box.height,
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        viewport: window.innerWidth,
      };
    });
    checked += 1;
    if (
      fit.left < -1 ||
      fit.right > fit.viewport + 1 ||
      fit.scrollWidth > fit.clientWidth + 1 ||
      fit.height < 27.5
    ) {
      failures.push(
        `[195] 法宝册续开入口被挤坏:` +
          `盒 ${Math.round(fit.left)}..${Math.round(fit.right)} / ` +
          `内容 ${fit.scrollWidth}>${fit.clientWidth} / ` +
          `高 ${Math.round(fit.height * 10) / 10}px / 视口 ${fit.viewport}`,
      );
    }
    checked += 1;
    const layoutProblems = problemsOf(await measurePage(page));
    if (layoutProblems.length) failures.push(`[195] 法宝册 → ${layoutProblems.join(" / ")}`);

    await more.click({ timeout: 5000 });
    await waitForShown(12);
    await waitForFocus(sortedIds[6]);
    const second = await readList();
    checked += 1;
    if (
      second.shown !== 12 ||
      second.start !== 0 ||
      second.count !== 12 ||
      second.focus !== sortedIds[6]
    ) {
      failures.push(
        `[195] 法宝册续开首批后应铺 12 件、焦点落 ${sortedIds[6]},` +
          `实见 ${second.count} 件 / start ${second.start} / 焦点 ${second.focus ?? "无"}`,
      );
    }

    let last = second;
    let shownBefore = second.shown;
    let finalFocus = sortedIds[6];
    while (shownBefore < total) {
      const shownAfter = Math.min(total, shownBefore + 6);
      const focusId = sortedIds[shownBefore];
      await page.locator("[data-artifact-more]").first().click({ timeout: 5000 });
      await waitForShown(shownAfter);
      await waitForFocus(focusId);
      last = await readList();
      const expectedStart = Math.max(0, shownAfter - 12);
      const expectedCount = shownAfter - expectedStart;
      checked += 1;
      if (
        last.shown !== shownAfter ||
        last.start !== expectedStart ||
        last.count !== expectedCount ||
        last.focus !== focusId
      ) {
        failures.push(
          `[195] 法宝册续开到第 ${shownAfter} 件时窗口不对:` +
            `应 ${expectedCount} 行 / start ${expectedStart} / 焦点 ${focusId},` +
            `实见 ${last.count} 行 / start ${last.start} / ` +
            `焦点 ${last.focus ?? "无"}(shown ${last.shown})`,
        );
      }
      finalFocus = focusId;
      shownBefore = shownAfter;
    }
    const lastStart = total - 12;
    checked += 1;
    if (
      last.count !== 12 ||
      last.start !== lastStart ||
      last.focus !== finalFocus ||
      last.ids.includes(sortedIds[0]) ||
      !last.ids.includes(sortedIds.at(-1)) ||
      (await page.locator("[data-artifact-more]").count()) > 0 ||
      (await page.locator("[data-artifact-prev]").count()) === 0
    ) {
      failures.push(
        `[195] 法宝册末批应滑窗为 12/${total}、从第 ${lastStart + 1} 件起、` +
          `焦点 ${finalFocus} 并可回翻,` +
          `实见 ${last.count} 件 / start ${last.start} / 焦点 ${last.focus ?? "无"} / ` +
          `首批 ${last.ids.includes(sortedIds[0]) ? "仍在" : "已滑走"} / ` +
          `末件 ${last.ids.includes(sortedIds.at(-1)) ? "在" : "缺失"}`,
      );
    }

    await page.locator("[data-artifact-prev]").first().click({ timeout: 5000 });
    const backShown = Math.floor((total - 1) / 6) * 6;
    const backStart = backShown - 12;
    await waitForShown(backShown);
    await waitForFocus(sortedIds[backStart]);
    const back = await readList();
    checked += 1;
    if (
      back.start !== backStart ||
      back.count !== 12 ||
      back.focus !== sortedIds[backStart] ||
      !back.ids.includes(sortedIds[backStart])
    ) {
      failures.push(
        `[195] 法宝册回翻没有回到上一页:` +
          `应 start ${backStart} / 12 件 / 焦点 ${sortedIds[backStart]},` +
          `实见 start ${back.start} / ${back.count} 件 / 焦点 ${back.focus ?? "无"}`,
      );
    }

    const toggledId = back.ids[0];
    if (toggledId) {
      const displaced = artifactRows.find((artifact) => artifact.defId === equippedIds[0]);
      const swapText = (
        (await page
          .locator(`[data-artifact-row="${toggledId}"] [data-artifact-swap]`)
          .textContent()) || ""
      )
        .replace(/\s+/g, " ")
        .trim();
      checked += 1;
      if (!displaced?.name || !swapText.includes(displaced.name)) {
        failures.push(
          `[195] 法宝满位换入前没点名将替下的法 1:` +
            `应「${displaced?.name ?? "无"}」,实见 «${swapText}»`,
        );
      }
      await page.locator(`[data-artifact-row="${toggledId}"] button`).first().click({
        timeout: 5000,
      });
      await waitForFocus(toggledId);
      const toggled = await readList();
      const toast = ((await page.locator("[data-toast]").last().textContent()) || "")
        .replace(/\s+/g, " ")
        .trim();
      checked += 1;
      if (
        toggled.focus !== toggledId ||
        !toggled.ids.includes(toggledId) ||
        toggled.seats[0] !== equippedIds[1] ||
        toggled.seats[1] !== toggledId ||
        !displaced?.name ||
        !toast.includes(displaced.name)
      ) {
        failures.push(
          `[195] 法宝满位换入没有按法 1 让位:` +
            `应法 1 ${equippedIds[1]} / 法 2 ${toggledId}、焦点留在原卡并点名替下「${displaced?.name ?? "无"}」,` +
            `实见席位 ${toggled.seats.join(",")} / 焦点 ${toggled.focus ?? "无"} / 回执 «${toast}»`,
        );
      }
    }

    // 夹具把回翻窗首卡排成「炼化后会越过窗界」的那一件,焦点判据才不是空转。
    const upgradeId = back.ids[0];
    if (!upgradeId) {
      failures.push("[195] 法宝册找不到可炼化的卡 —— 改序焦点判据没有对象");
    } else {
      const row = page.locator(`[data-artifact-row="${upgradeId}"]`);
      const upgrade = row
        .locator("button")
        .filter({ hasText: /炼\s*化/ })
        .first();
      if ((await upgrade.count()) === 0 || !(await upgrade.isEnabled())) {
        failures.push(`[195] 法宝册跨窗焦点判据的 ${upgradeId} 不可炼化 —— 夹具或代价算错了`);
      } else {
        await upgrade.click({ timeout: 5000 });
        await waitForFocus(upgradeId);
        const refined = await readList();
        checked += 1;
        if (
          refined.focus !== upgradeId ||
          !refined.ids.includes(upgradeId) ||
          refined.shown !== backStart ||
          refined.start !== backStart - 12 ||
          refined.count !== 12
        ) {
          failures.push(
            `[195] 法宝炼化越过窗界后没有按新位置重开窗:` +
              `应 12 件 / start ${backStart - 12} / shown ${backStart} / 焦点 ${upgradeId},` +
              `实见焦点 ${refined.focus ?? "无"} / shown ${refined.shown} / ` +
              `start ${refined.start} / ${refined.count} 件`,
          );
        }
      }
    }

    if (pageErrors.length)
      failures.push(`[320] 法宝全册场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
  } finally {
    await ctx.close();
    await vite?.close();
  }
  return { failures, checked, contrastFails: [], pixelContrastFails: [], zoomFails: [] };
}

/**
 * 开炉丹方 —— 54 张方子每张都摊代价、成品、把握、双成、存货与两枚动作。
 *
 * max-h-64 只限制眼睛看到的滚动框,不限制 DOM;这里验证 6 张一批、12 张滑窗,
 * 搜索换词时窗口回到首批且不抢输入焦点,逐批翻到末页仍覆盖全部方子。最后在
 * 195 宽下真炼一炉,确认耗料改序后焦点仍跟住同一张方,而不是落到被销毁的节点。
 */
async function taskRecipeListOverflow() {
  const failures = [];
  let checked = 0;
  const ctx = await auditContext({
    viewport: { width: 320, height: 568 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  let vite = null;
  try {
    vite = await createViteServer({
      root: ROOT,
      server: { middlewareMode: true },
      appType: "custom",
      logLevel: "silent",
    });
    const recipeFixture = await vite.ssrLoadModule("/scripts/lib/fullRecipeFixture.ts");
    const recipeState = recipeFixture.fullRecipeSlices();
    const total = Number(recipeFixture.FULL_RECIPE_COUNT);
    const searchName = String(recipeFixture.FULL_RECIPE_SEARCH_NAME);
    const slices = showcaseSlices("light");
    slices.lore = { ...slices.lore, ...recipeState.lore };
    slices.resources = { ...slices.resources, ...recipeState.resources };
    await seedSave(ctx, slices, "__recipeListFixture");

    const page = await ctx.newPage();
    await page.addInitScript(() => {
      Math.random = () => 1;
    });
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    await page.goto(INDEX + "#/inventory", { waitUntil: "load" });
    await page.getByRole("tab", { name: /丹/ }).first().click({ timeout: 5000 });
    await page
      .locator("main button", { hasText: /开炉炼丹/ })
      .first()
      .click({ timeout: 5000 });
    await page.locator("[data-recipe-total]").first().waitFor({ state: "visible", timeout: 10000 });
    await page.setViewportSize({ width: 390, height: 844 });
    await settleVisuals(page);
    await checkRecipeLedger("390");
    await page.setViewportSize({ width: 195, height: 422 });
    await settleVisuals(page);

    async function readList() {
      return page.evaluate(() => {
        const holder = document.querySelector("[data-recipe-total]");
        const rows = [...document.querySelectorAll("[data-recipe-row]")];
        return {
          total: Number(holder?.getAttribute("data-recipe-total")),
          shown: Number(holder?.getAttribute("data-recipe-shown")),
          start: Number(holder?.getAttribute("data-recipe-start")),
          count: rows.length,
          ids: rows.map((row) => row.getAttribute("data-recipe-row")),
          focus: document.activeElement?.getAttribute("data-recipe-row"),
          searchFocused: document.activeElement?.getAttribute("aria-label") === "搜方名",
        };
      });
    }

    async function readRecipeLedger() {
      return page.evaluate(() => {
        const ledger = document.querySelector("[data-recipe-ledger]");
        if (!ledger) return null;
        const style = getComputedStyle(ledger);
        const rows = [...ledger.querySelectorAll("[data-recipe-row]")];
        const tries = rows
          .map((row) => {
            const el = row.querySelector("[data-recipe-tries]");
            if (!el) return null;
            const range = document.createRange();
            range.selectNodeContents(el);
            return {
              text: (el.textContent || "").replace(/\s+/g, " ").trim(),
              lines: new Set([...range.getClientRects()].map((rect) => Math.round(rect.top))).size,
              clipped: el.scrollWidth > el.clientWidth + 1,
            };
          })
          .filter(Boolean);
        return {
          borderTop: Number.parseFloat(style.borderTopWidth),
          borderRight: Number.parseFloat(style.borderRightWidth),
          borderBottom: Number.parseFloat(style.borderBottomWidth),
          borderLeft: Number.parseFloat(style.borderLeftWidth),
          radius: Number.parseFloat(style.borderRadius),
          background: style.backgroundColor,
          cards: ledger.querySelectorAll(".card-ink").length,
          rows: rows.length,
          tries,
        };
      });
    }

    async function checkRecipeLedger(tag) {
      checked += 1;
      const ledger = await readRecipeLedger();
      if (
        !ledger ||
        ledger.borderTop !== 1 ||
        ledger.borderBottom !== 1 ||
        ledger.borderRight !== 0 ||
        ledger.borderLeft !== 0 ||
        ledger.radius !== 0 ||
        ledger.background !== "rgba(0, 0, 0, 0)" ||
        ledger.cards !== 0 ||
        ledger.rows < 1
      ) {
        failures.push(`[${tag}] 丹方册又套回内层卡壳:${JSON.stringify(ledger)}`);
      }
      if (!ledger?.tries.length || ledger.tries.some((row) => row.lines > 1 || row.clipped)) {
        failures.push(`[${tag}] 丹方平均炉数没有完整落在单行:${JSON.stringify(ledger?.tries)}`);
      }
    }

    async function waitForShown(shown) {
      await page.waitForFunction(
        (wanted) =>
          document.querySelector("[data-recipe-total]")?.getAttribute("data-recipe-shown") ===
          String(wanted),
        shown,
        { timeout: 5000 },
      );
    }

    async function waitForTotal(count) {
      await page.waitForFunction(
        (wanted) =>
          document.querySelector("[data-recipe-total]")?.getAttribute("data-recipe-total") ===
          String(wanted),
        count,
        { timeout: 5000 },
      );
    }

    async function waitForFocus(id) {
      await page
        .waitForFunction(
          (rowId) => document.activeElement?.getAttribute("data-recipe-row") === rowId,
          id,
          { timeout: 2000 },
        )
        .catch(() => {});
    }

    const initial = await readList();
    const more = page.locator("[data-recipe-more]").first();
    const moreText = ((await more.textContent()) || "").replace(/\s+/g, " ").trim();
    checked += 1;
    if (
      initial.total !== total ||
      initial.shown !== 6 ||
      initial.start !== 0 ||
      initial.count !== 6 ||
      !new RegExp(`再看\\s*6\\s*张\\s*·\\s*余\\s*${total - 6}`).test(moreText)
    ) {
      failures.push(
        `[195] 丹方首批应 6/${total},实见 ${initial.count} 行 ` +
          `(shown ${initial.shown} / total ${initial.total}) «${moreText}»`,
      );
    }

    const fit = await more.evaluate((el) => {
      const box = el.getBoundingClientRect();
      return {
        left: box.left,
        right: box.right,
        height: box.height,
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        viewport: window.innerWidth,
      };
    });
    checked += 1;
    if (
      fit.left < -1 ||
      fit.right > fit.viewport + 1 ||
      fit.scrollWidth > fit.clientWidth + 1 ||
      fit.height < 27.5
    ) {
      failures.push(
        `[195] 丹方续开入口被挤坏:盒 ${Math.round(fit.left)}..${Math.round(fit.right)} / ` +
          `内容 ${fit.scrollWidth}>${fit.clientWidth} / 高 ${Math.round(fit.height * 10) / 10}px`,
      );
    }
    const panelOverflow = await page.locator(".modal-panel").evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }));
    checked += 1;
    if (panelOverflow.scrollWidth > panelOverflow.clientWidth + 1) {
      failures.push(
        `[195] 丹方弹窗横向溢出:${panelOverflow.scrollWidth}>${panelOverflow.clientWidth}`,
      );
    }
    checked += 1;
    const layoutProblems = problemsOf(await measurePage(page));
    if (layoutProblems.length) failures.push(`[195] 丹方册 → ${layoutProblems.join(" / ")}`);
    await checkRecipeLedger("195");

    await more.click({ timeout: 5000 });
    await waitForShown(12);
    await waitForFocus((await readList()).ids[6]);
    const second = await readList();
    checked += 1;
    if (
      second.shown !== 12 ||
      second.start !== 0 ||
      second.count !== 12 ||
      second.focus !== second.ids[6]
    ) {
      failures.push(
        `[195] 丹方续开首批后应铺 12 张、焦点落第 7 张,` +
          `实见 ${second.count} 张 / start ${second.start} / 焦点 ${second.focus ?? "无"}`,
      );
    }

    let last = second;
    while (last.shown < total) {
      const shownBefore = last.shown;
      const shownAfter = Math.min(total, shownBefore + 6);
      await page.locator("[data-recipe-more]").first().click({ timeout: 5000 });
      await waitForShown(shownAfter);
      last = await readList();
      const expectedStart = Math.max(0, shownAfter - 12);
      const newCount = shownAfter - shownBefore;
      const focusId = last.ids[12 - newCount];
      await waitForFocus(focusId);
      const focused = await readList();
      checked += 1;
      if (
        last.shown !== shownAfter ||
        last.start !== expectedStart ||
        last.count !== shownAfter - expectedStart ||
        focused.focus !== focusId
      ) {
        failures.push(
          `[195] 丹方续开到第 ${shownAfter} 张时窗口不对:` +
            `应 ${shownAfter - expectedStart} 行 / start ${expectedStart} / 焦点 ${focusId},` +
            `实见 ${last.count} 行 / start ${last.start} / ` +
            `焦点 ${focused.focus ?? "无"}(shown ${last.shown})`,
        );
      }
    }
    const lastStart = total - 12;
    checked += 1;
    if (
      last.count !== 12 ||
      last.start !== lastStart ||
      (await page.locator("[data-recipe-more]").count()) > 0 ||
      (await page.locator("[data-recipe-prev]").count()) === 0
    ) {
      failures.push(
        `[195] 丹方末批应滑窗为 12/${total}、从第 ${lastStart + 1} 张起并可回翻,` +
          `实见 ${last.count} 张 / start ${last.start}`,
      );
    }

    await page.locator("[data-recipe-prev]").first().click({ timeout: 5000 });
    const backShown = Math.floor((total - 1) / 6) * 6;
    const backStart = Math.max(0, backShown - 12);
    await waitForShown(backShown);
    const back = await readList();
    await waitForFocus(back.ids[0]);
    const backFocused = await readList();
    checked += 1;
    if (back.start !== backStart || back.count !== 12 || backFocused.focus !== back.ids[0]) {
      failures.push(
        `[195] 丹方回翻没有回到上一页:应 start ${backStart} / 12 张 / 焦点页首,` +
          `实见 start ${back.start} / ${back.count} 张 / 焦点 ${backFocused.focus ?? "无"}`,
      );
    }

    const search = page.locator('input[aria-label="搜方名"]').first();
    await search.fill(searchName);
    await waitForTotal(1);
    await waitForShown(1);
    const searched = await readList();
    checked += 1;
    if (
      searched.total !== 1 ||
      searched.shown !== 1 ||
      searched.start !== 0 ||
      searched.count !== 1 ||
      !searched.searchFocused
    ) {
      failures.push(
        `[195] 搜方名后窗口应重置为 1/1 且焦点留在输入框,` +
          `实见 ${searched.count}/${searched.total} / start ${searched.start} / ` +
          `输入框 ${searched.searchFocused ? "有焦点" : "失焦"}`,
      );
    }

    await search.fill("");
    await waitForTotal(total);
    await waitForShown(6);
    const cleared = await readList();
    checked += 1;
    if (
      cleared.shown !== 6 ||
      cleared.start !== 0 ||
      cleared.count !== 6 ||
      !cleared.searchFocused
    ) {
      failures.push(
        `[195] 清空搜索后应回首批 6 张且焦点仍留输入框,` +
          `实见 ${cleared.count} 张 / start ${cleared.start} / ` +
          `输入框 ${cleared.searchFocused ? "有焦点" : "失焦"}`,
      );
    }

    await page.locator("[data-recipe-more]").first().click({ timeout: 5000 });
    await waitForShown(12);
    const craftList = await readList();
    const craftId = craftList.ids[6];
    const craftRow = page.locator(`[data-recipe-row="${craftId}"]`);
    const craftButton = craftRow.locator("button").first();
    if ((await craftButton.count()) === 0 || !(await craftButton.isEnabled())) {
      failures.push(`[195] 丹方焦点探针的 ${craftId} 不可炼制 —— 夹具算错了`);
    } else {
      await craftButton.click({ timeout: 5000 });
      await waitForFocus(craftId);
      const crafted = await readList();
      checked += 1;
      if (crafted.focus !== craftId || !crafted.ids.includes(craftId)) {
        failures.push(
          `[195] 炼制耗料后焦点没有留在原方:应 ${craftId},` +
            `实见 ${crafted.focus ?? "无"} / 当前窗 ${crafted.ids.join(",")}`,
        );
      }
    }

    if (pageErrors.length)
      failures.push(`[320] 丹方全册场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
  } finally {
    await ctx.close();
    await vite?.close();
  }
  return { failures, checked, contrastFails: [], pixelContrastFails: [], zoomFails: [] };
}

/**
 * 词条转移候选 —— 无部位限制的词条能落到整包藏品上,max-h-24 只裁视觉不裁 DOM。
 *
 * 夹具用满 120 格行囊,源件是佩戴中的天品武器、挂一条无门槛词条,其余 119 件全是候选。
 * 从天品置顶的全藏品卡直接开详情,避免把部位候选弹窗叠在下面量进无干读数。
 * 195 宽下验证 12 件首批、24 件滑窗、逐批到末页再回翻,焦点跟住新露出第一件;
 * 候选行与件数读数、续开/回翻入口也不许把装备详情弹窗挤坏。
 */
async function taskAffixTransferOverflow() {
  const failures = [];
  let checked = 0;
  const ctx = await auditContext({
    viewport: { width: 320, height: 568 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  let vite = null;
  try {
    vite = await createViteServer({
      root: ROOT,
      server: { middlewareMode: true },
      appType: "custom",
      logLevel: "silent",
    });
    const fixtureModule = await vite.ssrLoadModule("/scripts/lib/bigBagFixture.ts");
    const fixture = fixtureModule.makeAffixTransferBag(120);
    const total = Number(fixture.candidateCount);
    const slices = showcaseSlices("light");
    slices.inventory = {
      ...slices.inventory,
      items: fixture.items,
      equipped: { [fixture.sourceSlot]: fixture.sourceUid },
      artifacts: [],
      equippedArtifacts: [],
    };
    await seedSave(ctx, slices, "__affixTransferFixture");

    const page = await ctx.newPage();
    await page.addInitScript(() => {
      Math.random = () => 1;
    });
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    await page.goto(INDEX + "#/inventory", { waitUntil: "load" });
    const sourceCard = page.locator(`main button[data-uid="${fixture.sourceUid}"]`);
    await sourceCard.waitFor({ state: "visible", timeout: 10000 });
    await sourceCard.click({ timeout: 5000 });
    await page
      .getByRole("button", { name: /词条转移 · 移至别件/ })
      .first()
      .click({ timeout: 5000 });
    await page
      .getByRole("button", { name: fixture.affixName, exact: true })
      .first()
      .click({ timeout: 5000 });
    await page
      .locator("[data-affix-candidate-total]")
      .first()
      .waitFor({ state: "visible", timeout: 5000 });
    await page.setViewportSize({ width: 195, height: 422 });
    await settleVisuals(page);

    async function readList() {
      return page.evaluate(() => {
        const holder = document.querySelector("[data-affix-candidate-total]");
        const rows = [...document.querySelectorAll("[data-affix-candidate]")];
        return {
          total: Number(holder?.getAttribute("data-affix-candidate-total")),
          shown: Number(holder?.getAttribute("data-affix-candidate-shown")),
          start: Number(holder?.getAttribute("data-affix-candidate-start")),
          count: rows.length,
          ids: rows.map((row) => row.getAttribute("data-affix-candidate")),
          focus: document.activeElement?.getAttribute("data-affix-candidate"),
        };
      });
    }

    async function waitForShown(shown) {
      await page.waitForFunction(
        (wanted) =>
          document
            .querySelector("[data-affix-candidate-total]")
            ?.getAttribute("data-affix-candidate-shown") === String(wanted),
        shown,
        { timeout: 5000 },
      );
    }

    async function waitForFocus(id) {
      await page
        .waitForFunction(
          (rowId) => document.activeElement?.getAttribute("data-affix-candidate") === rowId,
          id,
          { timeout: 2000 },
        )
        .catch(() => {});
    }

    const initial = await readList();
    const more = page.locator("[data-affix-candidate-more]").first();
    const moreText = ((await more.textContent()) || "").replace(/\s+/g, " ").trim();
    checked += 1;
    if (
      initial.total !== total ||
      initial.shown !== 12 ||
      initial.start !== 0 ||
      initial.count !== 12 ||
      !new RegExp(`再看\\s*12\\s*件\\s*·\\s*余\\s*${total - 12}`).test(moreText)
    ) {
      failures.push(
        `[195] 词条转移候选首批应 12/${total},实见 ${initial.count} 行 ` +
          `(shown ${initial.shown} / total ${initial.total}) «${moreText}»`,
      );
    }

    const fit = await more.evaluate((el) => {
      const box = el.getBoundingClientRect();
      return {
        left: box.left,
        right: box.right,
        height: box.height,
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        viewport: window.innerWidth,
      };
    });
    checked += 1;
    if (
      fit.left < -1 ||
      fit.right > fit.viewport + 1 ||
      fit.scrollWidth > fit.clientWidth + 1 ||
      fit.height < 27.5
    ) {
      failures.push(
        `[195] 词条转移续开入口被挤坏:盒 ${Math.round(fit.left)}..${Math.round(fit.right)} / ` +
          `内容 ${fit.scrollWidth}>${fit.clientWidth} / 高 ${Math.round(fit.height * 10) / 10}px`,
      );
    }
    const panelOverflow = await page
      .locator("[data-affix-candidate-total]")
      .first()
      .evaluate((el) => {
        const panel = el.closest(".modal-panel");
        return {
          scrollWidth: panel?.scrollWidth ?? 0,
          clientWidth: panel?.clientWidth ?? 0,
        };
      });
    checked += 1;
    if (panelOverflow.scrollWidth > panelOverflow.clientWidth + 1) {
      failures.push(
        `[195] 词条转移弹窗横向溢出:${panelOverflow.scrollWidth}>${panelOverflow.clientWidth}`,
      );
    }
    checked += 1;
    const layoutProblems = problemsOf(await measurePage(page));
    if (layoutProblems.length)
      failures.push(`[195] 词条转移候选册 → ${layoutProblems.join(" / ")}`);

    await more.click({ timeout: 5000 });
    await waitForShown(24);
    const second = await readList();
    await waitForFocus(second.ids[12]);
    const secondFocused = await readList();
    checked += 1;
    if (
      second.shown !== 24 ||
      second.start !== 0 ||
      second.count !== 24 ||
      secondFocused.focus !== second.ids[12]
    ) {
      failures.push(
        `[195] 词条转移续开首批后应铺 24 件、焦点落第 13 件,` +
          `实见 ${second.count} 件 / start ${second.start} / 焦点 ${secondFocused.focus ?? "无"}`,
      );
    }

    let last = secondFocused;
    while (last.shown < total) {
      const shownBefore = last.shown;
      const shownAfter = Math.min(total, shownBefore + 12);
      await page.locator("[data-affix-candidate-more]").first().click({ timeout: 5000 });
      await waitForShown(shownAfter);
      const shown = await readList();
      const expectedStart = Math.max(0, shownAfter - 24);
      const focusIndex = shownBefore - expectedStart;
      await waitForFocus(shown.ids[focusIndex]);
      const focused = await readList();
      checked += 1;
      if (
        shown.shown !== shownAfter ||
        shown.start !== expectedStart ||
        shown.count !== shownAfter - expectedStart ||
        focused.focus !== shown.ids[focusIndex]
      ) {
        failures.push(
          `[195] 词条转移续开到第 ${shownAfter} 件时窗口不对:` +
            `应 ${shownAfter - expectedStart} 行 / start ${expectedStart} / ` +
            `焦点 ${shown.ids[focusIndex]},实见 ${shown.count} 行 / start ${shown.start} / ` +
            `焦点 ${focused.focus ?? "无"}(shown ${shown.shown})`,
        );
      }
      last = shown;
    }

    const lastStart = total - 24;
    const previous = page.locator("[data-affix-candidate-prev]").first();
    const previousText = ((await previous.textContent()) || "").replace(/\s+/g, " ").trim();
    checked += 1;
    if (
      last.count !== 24 ||
      last.start !== lastStart ||
      (await page.locator("[data-affix-candidate-more]").count()) > 0 ||
      !new RegExp(`前一批\\s*11\\s*件`).test(previousText)
    ) {
      failures.push(
        `[195] 词条转移末批应滑窗为 24/${total}、从第 ${lastStart + 1} 件起,` +
          `回翻入口报「前一批 11 件」,实见 ${last.count} 件 / start ${last.start} / «${previousText}»`,
      );
    }

    await previous.click({ timeout: 5000 });
    await waitForShown(108);
    const back = await readList();
    await waitForFocus(back.ids[0]);
    const backFocused = await readList();
    checked += 1;
    if (back.start !== 84 || back.count !== 24 || backFocused.focus !== back.ids[0]) {
      failures.push(
        `[195] 词条转移回翻没有回到上一页:应 start 84 / 24 件 / 焦点页首,` +
          `实见 start ${back.start} / ${back.count} 件 / 焦点 ${backFocused.focus ?? "无"}`,
      );
    }

    if (pageErrors.length)
      failures.push(`[320] 词条转移候选场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
  } finally {
    await ctx.close();
    await vite?.close();
  }
  return { failures, checked, contrastFails: [], pixelContrastFails: [], zoomFails: [] };
}

/**
 * 只读页(第二个标签页)—— 必须把「为什么不动」常驻说出来。
 *
 * 多标签共用一份存档时,后来的那页由 core/singleWriter 判成只读:不启引擎、存储层合闸。
 * 这套行为有单测,但玩家侧只剩「数字不动」—— 三秒的 toast 消失后就没有任何解释。
 * 判据:同一 context 开两页,先开的那页不许有横幅,后开的那页必须有,且不裁字、不溢出。
 *
 * 四种形态都要量:390 / 195(200% 缩放)× 日间 / 夜间。这一页不巡游,巡页那几遍
 * 永远碰不到它 —— 横幅是朱砂 6% 的自底,正是「窄到只剩 195」与「夜间换肤」最容易
 * 出事的两档。
 */
async function taskReadOnlyTab() {
  const failures = [];
  let checked = 0;
  const contrastFails = [];
  const pixelContrastFails = [];
  const zoomFails = [];
  const ctx = await auditContext({ viewport: { width: 390, height: 844 } });
  try {
    const writer = await ctx.newPage();
    await writer.goto(INDEX + "#/", { waitUntil: "load" });
    /*
     * 并发负载下，900ms 墙钟不保证写者已经拿到 Web Lock；读者若抢在前面，
     * 两个页面都会是写者，这条只读判据便整组假红。先等锁真的在写者手里，
     * 再开第二个标签页 —— 判据不变，只把「先到」这件事变成确定事实。
     *
     * 锁名这里写字面量而不 import SAVE_WRITER_LOCK:下面三段都跑在
     * page.evaluate / waitForFunction 里 —— 那是浏览器上下文,拿不到 Node 侧的
     * import。键名若有天要改,singleWriter.ts 的注释与这条一起改
     * (src/core/singleWriter.spec 钉着源码里的那处)。
     */
    const writerHeld = await writer
      .waitForFunction(
        async () => {
          const state = await navigator.locks.query();
          return (state.held || []).some((l) => l.name === "xuanshu.save-writer");
        },
        { timeout: 12000 },
      )
      .then(() => true)
      .catch(() => false);
    checked += 1;
    if (!writerHeld) {
      failures.push("[390] 只读页场景:写者页没拿到 Web Lock,后面的双标签判据没有立足点");
    }
    const reader = await ctx.newPage();
    await reader.goto(INDEX + "#/", { waitUntil: "load" });
    await reader
      .waitForFunction(() => !!document.querySelector("[data-save-reader]"), { timeout: 12000 })
      .catch(() => undefined);

    checked += 1;
    const writerHas = await writer.evaluate(() => !!document.querySelector("[data-save-reader]"));
    if (writerHas) failures.push("[390] 写者页不该出现只读横幅");

    /** 量一次当前形态;标签带上视口档与配色,失败时才知道是哪一档 */
    const measure = async (tag) => {
      checked += 1;
      const banner = await reader.evaluate(() => {
        const el = document.querySelector("[data-save-reader]");
        if (!el) return null;
        const shell = document.getElementById("app")?.firstElementChild;
        const r = el.getBoundingClientRect();
        return {
          text: (el.textContent || "").replace(/\s+/g, " ").trim(),
          height: Math.round(r.height),
          // 溢出/裁字:文字自己滚得动或盒子装不下,都算这行没把话说全
          clipped: el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2,
          overflowX: shell ? Math.round(shell.scrollWidth - shell.clientWidth) : 0,
        };
      });
      if (!banner) {
        failures.push(
          `[${tag}] 第二个标签页没有常驻只读说明 —— 只有一次性 toast,玩家会以为游戏坏了`,
        );
        return;
      }
      if (!/只读/.test(banner.text))
        failures.push(`[${tag}] 只读横幅没把话说清楚:«${banner.text}»`);
      if (banner.height < 20)
        failures.push(`[${tag}] 只读横幅只有 ${banner.height}px 高,读不清也点不着`);
      if (banner.clipped) failures.push(`[${tag}] 只读横幅文字被裁掉:«${banner.text}»`);
      if (banner.overflowX > 1)
        failures.push(`[${tag}] 只读横幅撑出横向溢出 ${banner.overflowX}px`);
    };

    for (const scheme of ["light", "dark"]) {
      await reader.emulateMedia({ colorScheme: scheme });
      for (const [width, height, tier] of [
        [390, 844, "390"],
        [195, 422, "195·200%"],
      ]) {
        await reader.setViewportSize({ width, height });
        await reader.waitForTimeout(350);
        await measure(`${tier} ${scheme === "dark" ? "夜间" : "日间"}`);
      }
    }

    /*
     * 横幅的像素对比度也要量:它不是巡游页,`taskPageTour` 那遍永远采不到它。
     * measureTextContrast 自己会把主题翻两遍并逐像素合成,故这里只跑一次。
     */
    await reader.emulateMedia({ colorScheme: "light" });
    await reader.setViewportSize({ width: 390, height: 844 });
    await reader.waitForTimeout(350);
    for (const bad of await measureTextContrast(reader)) {
      contrastFails.push(
        `[只读页] ${bad.theme} ${bad.ratio}:1(需 ${bad.need})${bad.size}px «${bad.text}»`,
      );
    }

    /*
     * 恢复路径:另一处关掉之后,这一页必须自己说出「刷新就能回来」。
     *
     * 只读页的心跳早就不跑了,锁释放这件事**没有任何事件**能推到它 —— 不主动探,
     * 横幅会永远写着「已在另一处打开」,玩家只能猜(或干脆重开浏览器)。
     * 判据走完整条路:关掉写者 → 横幅换成可刷新的形态 → 点它 → 横幅消失且锁回到手里。
     */
    await reader.emulateMedia({ colorScheme: "light" });
    await reader.setViewportSize({ width: 390, height: 844 });
    await reader.waitForTimeout(300);
    await writer.close();
    const freed = await reader
      .waitForFunction(
        () => document.querySelector("[data-save-reader]")?.hasAttribute("data-save-reader-freed"),
        { timeout: 12000 },
      )
      .then(() => true)
      .catch(() => false);
    checked += 1;
    if (!freed) {
      failures.push("[只读页 · 恢复] 另一处关掉之后,横幅没有换成「刷新即可继续」—— 玩家只能猜");
    } else {
      /*
       * 点「刷新本页」。这一下会导航到新文档,而 Playwright 的 click 在导航
       * 期间可能抛「execution context destroyed」—— 那恰恰说明刷新**成功了**,
       * 不是失败。故只 catch 掉它,再把「横幅消失」当作刷新的证据去等。
       */
      await reader
        .evaluate(() => {
          document.querySelector("[data-save-reader] button")?.click();
        })
        .catch(() => undefined);
      const recovered = await reader
        .waitForFunction(() => !document.querySelector("[data-save-reader]"), { timeout: 12000 })
        .then(() => true)
        .catch(() => false);
      checked += 1;
      if (!recovered)
        failures.push("[只读页 · 恢复] 按了「刷新本页」之后横幅还在 —— 没真正回到写者态");
      // 刷新后新文档会先短暂没有横幅,main.ts 仍在申请 Web Lock;
      // 必须等外壳回来且锁真的落手,不能拿这一瞬间的空窗当“已恢复”。
      /*
       * 等锁落手。超时要留够:刷新之后新文档要先跑到 main.ts 的
       * acquireSaveWriterRole,而它自己就允许 500ms 的探测超时才 fail-open;
       * 机器忙时(这套门是并发跑的)整条链要几秒。
       *
       * 失败时把**此刻的现场**一起打出来,而不是只报一句「锁持有者 0」——
       * 上一版只数 0/1,于是「页面还没起来」「起来了但判成只读」「浏览器慢」
       * 三种完全不同的原因长成同一条红,查起来只能靠猜。
       */
      /*
       * 「等」与「量」必须是**同一次**求值。
       *
       * 上一版先 waitForFunction 等锁到手,再单独 evaluate 数一次 —— 两次调用
       * 之间文档可能又换了一茬(实测刷新后接连发生两次导航:1818ms 与 1951ms,
       * 相隔 133ms;hash 初始化与路由守卫各一次)。新文档刚起来时外壳未挂载、
       * 顶层 await 的单写者判定还没跑完,于是量到 held=0 而 wait 明明已经成功过。
       * 现场快照里 shell:false / held:[] / readyState:complete 正是这个中间态。
       *
       * 现在把条件与读数收进一次求值:返回持有数,不为 1 就让 waitForFunction
       * 继续轮询 —— 短暂的空窗不再被当成结论。
       */
      /*
       * 而且要**连续两次**求值都成立才算落定。
       *
       * 单看一次不够:现场快照出现过 readyState:"interactive" —— 那一刻新文档
       * 正在解析,外壳还没挂上,锁也还没申请。刷新会接连触发两次导航(hash
       * 初始化与路由守卫各一次),中间这段空窗若恰好被采样,就会把
       * 「正在重建」误判成「刷新拿不到写权」。
       *
       * 判据要问的是**稳定态**:外壳在、锁在,且隔一拍再问一次仍然如此。
       */
      const settledHandle = await reader
        .waitForFunction(
          async () => {
            const probe = async () => {
              if (!document.querySelector("[data-game-shell]")) return 0;
              const state = await navigator.locks.query();
              return (state.held || []).filter((l) => l.name === "xuanshu.save-writer").length;
            };
            if ((await probe()) !== 1) return false;
            await new Promise((r) => setTimeout(r, 250));
            return (await probe()) === 1 ? 1 : false;
          },
          { timeout: 20000 },
        )
        .catch(() => null);
      const settled = settledHandle !== null;
      const held = settled ? Number(await settledHandle.jsonValue()) : 0;
      checked += 1;
      if (held !== 1) {
        const snapshot = await reader.evaluate(async () => {
          const state = await navigator.locks.query();
          return {
            shell: Boolean(document.querySelector("[data-game-shell]")),
            banner: Boolean(document.querySelector("[data-save-reader]")),
            held: (state.held || []).map((l) => l.name),
            pending: (state.pending || []).map((l) => l.name),
            readyState: document.readyState,
            // 页面被浏览器回收(后台标签页内存压力)时会整页重建:锁自然没了,
            // 而外壳也会短暂不存在 —— 那是环境噪声,不是本作的 bug
            wasDiscarded: document.wasDiscarded ?? null,
            // 同一份现场里再看一眼:锁是不是根本没被申请过
            hasLocks: typeof navigator.locks?.query === "function",
          };
        });
        failures.push(
          `[只读页 · 恢复] 刷新后没拿到写权(锁持有者 ${held},等锁${settled ? "已成功" : "超时"})—— 刷新也只是白刷;` +
            `现场 ${JSON.stringify(snapshot)}`,
        );
      }
    }
  } finally {
    await ctx.close();
  }
  return { failures, checked, contrastFails, pixelContrastFails, zoomFails };
}

/**
 * 玄枢图:顶栏那枚「玄」印是全站册目的唯一入口。
 *
 * 底栏只有五册,而洞府营造、坊市、器魂、天界等页面都从这枚印进入。这里不只数
 * 入口数量:在 390 与 200% 缩放档(195)各开一次,量五卷快引、十七册卷宗有没有
 * 把页面撑坏;390 档还要真的点「天机」快引翻到末卷,再点一册跳到对应路由。
 * 1280 档逐卷核对当前册页确实铺满案台、册次只在桌面出现;册目是新壳层的高频
 * 入口,不能只在源码里有 17 条数据。
 */
async function taskAtlasNavigation() {
  const failures = [];
  let checked = 0;
  const contrastFails = [];
  const pixelContrastFails = [];
  const zoomFails = [];
  const cases = [
    { width: 1280, height: 800, dpr: 1, tag: "1280", mobile: false },
    { width: 390, height: 844, dpr: 3, tag: "390", mobile: true },
    { width: 195, height: 422, dpr: 1, tag: "195", mobile: true },
  ];

  for (const vp of cases) {
    const ctx = await auditContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.dpr,
      isMobile: vp.mobile,
      hasTouch: vp.mobile,
    });
    try {
      const fixture = showcaseSlices("light");
      const worn = new Set(Object.values(fixture.inventory.equipped).filter(Boolean));
      fixture.inventory.seenUids = fixture.inventory.items
        .filter((item) => worn.has(item.uid))
        .map((item) => item.uid);
      fixture.inventory.seenSeeded = true;
      await seedSave(ctx, fixture);
      const page = await ctx.newPage();
      const pageErrors = [];
      watchPageErrors(page, pageErrors);
      const textLength = await openRoute(page, "/", 500);
      if (textLength === 0) failures.push(`[${vp.tag}] 玄枢图场景:首页没有渲染出来`);
      await clearOverlays(page);

      if (vp.tag === "1280") {
        await page.locator("[data-spine-atlas-trigger]").click();
      } else if (vp.tag === "195") {
        await page.keyboard.press("Control+K");
      } else {
        await page.locator("[data-atlas-trigger]").click();
      }
      await page.waitForSelector("[data-nav-atlas]", { timeout: 3000 }).catch(() => undefined);
      const state = await page.evaluate(() => {
        const atlas = document.querySelector("[data-nav-atlas]");
        const entries = [...document.querySelectorAll("[data-atlas-entry]")];
        const volumes = [...document.querySelectorAll("[data-atlas-volume]")];
        const current = document.querySelector("[data-atlas-location]");
        const visibleSections = [...document.querySelectorAll("[data-atlas-section]")].filter(
          (el) => el.offsetParent !== null,
        );
        const visibleSection = visibleSections[0];
        const index = document.querySelector(".atlas-index");
        const ordinal = visibleSection?.querySelector(".atlas-entry__ordinal");
        return {
          present: !!atlas,
          entries: entries.length,
          volumes: volumes.length,
          activeVolumes: volumes.filter(
            (el) => el.getAttribute("data-atlas-volume-active") !== null,
          ).length,
          currentVolumes: volumes.filter(
            (el) => el.getAttribute("data-atlas-volume-current") !== null,
          ).length,
          searchFocused: document.activeElement?.matches("[data-atlas-search]") ?? false,
          volumeFocused:
            document.activeElement?.matches('[data-atlas-volume][aria-selected="true"]') ?? false,
          current: (current?.textContent || "").replace(/\s+/g, " ").trim(),
          active: entries.filter((el) => el.getAttribute("aria-current") === "page").length,
          visibleSections: visibleSections.length,
          indexWidth: index?.getBoundingClientRect().width ?? 0,
          sectionWidth: visibleSection?.getBoundingClientRect().width ?? 0,
          ordinalVisible: !!ordinal && ordinal.offsetParent !== null,
          bagVolumeCue:
            volumes
              .find((el) => el.getAttribute("data-atlas-volume") === "belongings")
              ?.getAttribute("aria-label") ?? "",
          bagEntryCue:
            entries
              .find((el) => el.getAttribute("href") === "#/inventory")
              ?.querySelector("[data-atlas-entry-cue]")
              ?.textContent?.trim() ?? "",
          shortcutVisible: (() => {
            const key = document.querySelector(".atlas-search__key");
            return !!key && key.offsetParent !== null;
          })(),
        };
      });
      checked += 1;
      if (!state.present) failures.push(`[${vp.tag}] 玄枢图没有打开`);
      if (state.entries !== 17) {
        failures.push(`[${vp.tag}] 玄枢图册目 ${state.entries} 条(应为 17)`);
      }
      if (state.volumes !== 5) {
        failures.push(`[${vp.tag}] 玄枢图五卷快引 ${state.volumes} 条(应为 5)`);
      }
      if (state.activeVolumes !== 1) {
        failures.push(`[${vp.tag}] 玄枢图当前快引标了 ${state.activeVolumes} 次(应恰为 1)`);
      }
      if (state.currentVolumes !== 1) {
        failures.push(`[${vp.tag}] 玄枢图当前落卷标了 ${state.currentVolumes} 次(应恰为 1)`);
      }
      if (vp.tag === "1280" && !state.searchFocused) {
        failures.push(`[${vp.tag}] 玄枢图打开后焦点没有落到寻册口`);
      }
      if (vp.tag !== "1280" && !state.volumeFocused) {
        failures.push(`[${vp.tag}] 触屏玄枢图打开后焦点没有留在当前卷签(会弹软键盘)`);
      }
      if (!state.current.includes("修行") || !state.current.includes("洞府总览")) {
        failures.push(`[${vp.tag}] 玄枢图卷首没有报出当前落点:${state.current}`);
      }
      if (state.active !== 1) {
        failures.push(`[${vp.tag}] 玄枢图当前册标了 ${state.active} 次(应恰为 1)`);
      }
      if (state.visibleSections !== 1) {
        failures.push(`[${vp.tag}] 玄枢图同时展开了 ${state.visibleSections} 卷(应只展开当前一卷)`);
      }
      if (vp.tag === "1280") {
        if (state.sectionWidth < state.indexWidth - 1) {
          failures.push(
            `[${vp.tag}] 玄枢图册目只铺了 ${state.sectionWidth.toFixed(1)} / ${state.indexWidth.toFixed(1)}px，右侧留出旧版双栏空位`,
          );
        }
        if (!state.ordinalVisible) {
          failures.push(`[${vp.tag}] 玄枢图桌面册目没有显示本卷册次`);
        }
      } else if (state.ordinalVisible) {
        failures.push(`[${vp.tag}] 玄枢图窄屏多出了桌面册次`);
      }
      if (!state.bagVolumeCue.includes("6 件新物")) {
        failures.push(
          `[${vp.tag}] 玄枢图身外卷签没有汇总行囊新货:${state.bagVolumeCue || "无提醒"}`,
        );
      }
      if (!state.bagEntryCue.includes("6 新")) {
        failures.push(`[${vp.tag}] 玄枢图行囊册没有落新货章:${state.bagEntryCue || "无章"}`);
      }
      if (vp.tag === "1280" ? !state.shortcutVisible : state.shortcutVisible) {
        failures.push(
          `[${vp.tag}] 玄枢图快捷键提示与输入方式不符(visible=${state.shortcutVisible})`,
        );
      }

      const problems = problemsOf(await measurePage(page));
      checked += 1;
      for (const problem of problems) failures.push(`[${vp.tag}] 玄枢图:${problem}`);

      if (vp.tag === "1280") {
        for (const volumeId of ["practice", "estate", "journey", "belongings", "fate"]) {
          await page.locator(`[data-atlas-volume="${volumeId}"]`).click();
          await page
            .waitForFunction(
              (id) => {
                const section = document.querySelector(`[data-atlas-section="${id}"]`);
                return !!section && section.offsetParent !== null;
              },
              volumeId,
              { timeout: 2000 },
            )
            .catch(() => undefined);
          const geometry = await page.evaluate((id) => {
            const index = document.querySelector(".atlas-index");
            const section = document.querySelector(`[data-atlas-section="${id}"]`);
            const ordinals = [...(section?.querySelectorAll(".atlas-entry__ordinal") ?? [])].filter(
              (el) => el.offsetParent !== null,
            );
            return {
              indexWidth: index?.getBoundingClientRect().width ?? 0,
              sectionWidth: section?.getBoundingClientRect().width ?? 0,
              entries: section?.querySelectorAll("[data-atlas-entry]").length ?? 0,
              ordinals: ordinals.length,
            };
          }, volumeId);
          checked += 1;
          if (geometry.sectionWidth < geometry.indexWidth - 1) {
            failures.push(
              `[1280] 玄枢图 ${volumeId} 卷册目只铺了 ${geometry.sectionWidth.toFixed(1)} / ${geometry.indexWidth.toFixed(1)}px`,
            );
          }
          if (geometry.ordinals !== geometry.entries || geometry.entries === 0) {
            failures.push(
              `[1280] 玄枢图 ${volumeId} 卷册次 ${geometry.ordinals} / ${geometry.entries} 条`,
            );
          }
        }
      }

      if (vp.tag === "390") {
        await page.locator("[data-atlas-search]").fill("天机");
        await page.locator("[data-atlas-search]").press("ArrowDown");
        const announced = await page.locator("#atlas-search-status").innerText();
        checked += 1;
        if (!announced.includes("第 2/5 处") || !announced.includes("构筑")) {
          failures.push(`[390] 玄枢图方向键没有把当前搜索结果报给读屏:${announced}`);
        }
        await page.locator("[data-atlas-search]").fill("人物");
        const search = await page.locator("[data-atlas-result]").evaluateAll((rows) =>
          rows.map((row) => ({
            href: row.getAttribute("href"),
            active: row.hasAttribute("data-atlas-result-active"),
          })),
        );
        checked += 1;
        if (search.length !== 1 || search[0]?.href !== "#/character" || !search[0]?.active) {
          failures.push(`[390] 玄枢图按「人物」寻册不对:实见 ${JSON.stringify(search)}`);
        }
        await page.locator("[data-atlas-search]").press("Enter");
        const searchJumped = await page
          .waitForFunction(() => location.hash === "#/character", { timeout: 4000 })
          .then(() => true)
          .catch(() => false);
        checked += 1;
        if (!searchJumped) failures.push("[390] 玄枢图寻到「人物」后回车没有跳转");
        const searchClosed = await page
          .waitForFunction(() => !document.querySelector("[data-nav-atlas]"), { timeout: 2000 })
          .then(() => true)
          .catch(() => false);
        if (!searchClosed) failures.push("[390] 玄枢图寻册跳转后没有收起");

        await page.locator("[data-atlas-trigger]").click();
        await page.waitForSelector("[data-nav-atlas]", { timeout: 3000 }).catch(() => undefined);
        await page.locator("[data-atlas-search]").fill("周易");
        const chapterSearch = await page.locator("[data-atlas-result]").evaluateAll((rows) =>
          rows.map((row) => ({
            href: row.getAttribute("href"),
            text: (row.textContent || "").replace(/\s+/g, " ").trim(),
          })),
        );
        checked += 1;
        if (
          chapterSearch.length !== 1 ||
          chapterSearch[0]?.href !== "#/codex?tab=yi" ||
          !chapterSearch[0]?.text.includes("周易")
        ) {
          failures.push(`[390] 玄枢图按「周易」寻分册不对:实见 ${JSON.stringify(chapterSearch)}`);
        }
        await page.locator("[data-atlas-search]").press("Enter");
        const chapterJumped = await page
          .waitForFunction(
            () => {
              const selected = document.querySelector(
                '[data-folio-tabs] [role="tab"][aria-selected="true"]',
              );
              return location.hash === "#/codex?tab=yi" && selected?.textContent?.includes("周易");
            },
            { timeout: 4000 },
          )
          .then(() => true)
          .catch(() => false);
        checked += 1;
        if (!chapterJumped) failures.push("[390] 玄枢图寻到「周易」后没有落到对应分册");
        await page.getByRole("tab", { name: "紫微" }).click();
        const tabWroteQuery = await page
          .waitForFunction(() => location.hash === "#/codex?tab=ziwei", { timeout: 3000 })
          .then(() => true)
          .catch(() => false);
        checked += 1;
        if (!tabWroteQuery) failures.push("[390] 上界域志换到「紫微」后地址没有跟着换册");

        await page.locator("[data-atlas-trigger]").click();
        await page.waitForSelector("[data-nav-atlas]", { timeout: 3000 }).catch(() => undefined);
        await page.locator('[data-atlas-volume="fate"]').click();
        const volumeJumped = await page
          .waitForFunction(
            () => {
              const scroller = document.querySelector("[data-folio-modal-scroll]");
              const target = document.querySelector('[data-atlas-section="fate"]');
              if (!scroller || !target) return false;
              const selected =
                document
                  .querySelector('[data-atlas-volume="fate"]')
                  ?.getAttribute("aria-selected") === "true";
              const visible = [...document.querySelectorAll("[data-atlas-section]")].filter(
                (el) => el.offsetParent !== null,
              );
              const search = document.querySelector("[data-atlas-search]");
              const compass = document.querySelector("[data-atlas-compass]");
              const viewport = scroller.getBoundingClientRect();
              const section = target.getBoundingClientRect();
              const searchBox = search?.getBoundingClientRect();
              const compassBox = compass?.getBoundingClientRect();
              return (
                selected &&
                visible.length === 1 &&
                visible[0] === target &&
                !!searchBox &&
                searchBox.top >= viewport.top - 1 &&
                searchBox.bottom <= viewport.bottom + 1 &&
                !!compassBox &&
                compassBox.top >= viewport.top - 1 &&
                compassBox.bottom <= viewport.bottom + 1 &&
                section.top >= viewport.top - 1 &&
                section.top < viewport.bottom
              );
            },
            { timeout: 3000 },
          )
          .then(() => true)
          .catch(() => false);
        checked += 1;
        if (!volumeJumped) failures.push("[390] 玄枢图点「天机」快引没有翻到末卷");

        await page.locator('[data-atlas-volume="belongings"]').click();
        const souls = page.locator('[data-atlas-entry][href="#/souls"]');
        await souls.click();
        const jumped = await page
          .waitForFunction(() => location.hash === "#/souls", { timeout: 4000 })
          .then(() => true)
          .catch(() => false);
        checked += 1;
        if (!jumped) failures.push("[390] 玄枢图点「器魂」没有跳到 /souls");
        /*
         * 路由 hash 先变，册目随后才走收起动画并卸载。点完立刻 count() 量到的是
         * 收起动画中的旧 DOM，在并发负载下会偶发假红；这里等它真的离场，仍以
         * 「最终 DOM 里没有册目」为判据，不是放宽到只要路由变了就算。
         */
        const atlasClosed = await page
          .waitForFunction(() => !document.querySelector("[data-nav-atlas]"), { timeout: 2000 })
          .then(() => true)
          .catch(() => false);
        if (!atlasClosed) {
          failures.push("[390] 玄枢图点选后没有收起");
        }
      }
      if (vp.tag === "1280") {
        await page.keyboard.press("Escape");
        const firstClosed = await page
          .waitForFunction(() => !document.querySelector("[data-nav-atlas]"), { timeout: 2000 })
          .then(() => true)
          .catch(() => false);
        if (!firstClosed) failures.push("[1280] 玄枢图按 Esc 没有收起");
        await page.keyboard.press("Control+K");
        const shortcutOpened = await page
          .waitForSelector("[data-nav-atlas]", { timeout: 3000 })
          .then(() => true)
          .catch(() => false);
        checked += 1;
        if (!shortcutOpened) failures.push("[1280] Ctrl+K 没有打开玄枢图");
      }
      if (pageErrors.length) {
        failures.push(`[${vp.tag}] 玄枢图场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
      }
    } finally {
      await ctx.close();
    }
  }
  return { failures, checked, contrastFails, pixelContrastFails, zoomFails };
}

/** 任务的顺序就是报告里失败清单的顺序 —— 与串行时代逐块打印的顺序一致 */
const TASKS = [
  ...VIEWPORTS.map((vp) => [`页面巡游[${vp.tag}]`, () => taskPageTour(vp)]),
  ["存档写不进去 · 设置页必须说话", taskSaveUnwritable],
  ["弹窗的键盘与焦点", taskModalFocus],
  ["Tab 焦点看得见", taskTabFocus],
  ["浮出的提示条点得掉", taskToastDismiss],
  ["引擎概率弹窗(顿悟 / 洞府巡游)", taskEngineModals],
  ["冷启动落在子页的返回", taskColdStartBack],
  ["后期档逐页复核", taskLateTour],
  ["渡劫突破真打一次", taskTribulation],
  ["走完一次转世", taskReincarnation],
  ["挂机真的在挂着跑", taskIdleTick],
  ["存档导出 / 导入往返", taskSaveRoundTrip],
  ["智能收纳不扔有投入的件", taskSmartKeep],
  ["背包先报新得与可换槽位", taskInventoryAttention],
  ["器铭的出身与逐件不同", taskInscription],
  ["灵兽契语只在相伴处出声", taskPetVow],
  ["道记留得住择道那一刻", taskDaoNote],
  ["品评说得出一档的分量", taskQualityVerdict],
  ["品阶印跟着高品落地", taskToastSeal],
  ["历世足迹留得住到过的地方", taskPeakRealm],
  ["背包四签同住一册续卷", taskInventoryTabRegisters],
  ["门庭先报今日", taskApprenticePulse],
  ["一键分解先勾后点", taskDecompose],
  ["法宝炼化的两笔账", taskArtifactRefine],
  ["洞府营造的账目", taskDongfuBuild],
  ["洞府首屏的营造优先", taskDongfuFold],
  ["修行续卷的四章与行动层", taskCultivationFold],
  ["洞府与修行的晨昏纸面", taskThemeStageSurfaces],
  ["道躯三章与行藏拆卷", taskCharacterFold],
  ["修行画像的两章与根因", taskIdentityFolio],
  ["天界试炼续卷的四章、八门与四程", taskCelestialTrialFold],
  ["天界证道战卷的四章与场次键盘", taskCelestialBattleScroll],
  ["天界内层三册的章节与并读", taskCelestialInnerVolumes],
  ["界域志首屏的此刻优先", taskCodexFold],
  ["成就谱首屏的眼下可追", taskAchievementFold],
  ["藏珍双阁的九柜换屉", taskCollectionFold],
  ["藏珍两章续卷与桌面并读", taskCollectionRegister],
  ["减少动效真的减到了", taskReduceMotion],
  ["闭关的跨页承诺", taskRetreat],
  ["背包里的账目", taskInventoryAccounting],
  ["际遇帖的门限与去向", taskEventSlip],
  ["择师谱的两步定契", taskMentorLedger],
  ["同行帖的此刻与后果", taskBondFolio],
  ["往生帖的门槛与去留", taskRebirthFolio],
  ["真打一场历练战斗", taskCombatReplay],
  ["敌人卡最挤的一档", taskEnemyCard],
  ["秘境卡在境中的窄屏一档", taskSecretRealm320],
  ["历练首屏主线优先", taskAdventureFold],
  ["前尘山河三世同册", taskWorldHistory],
  ["本世山河案首屏", taskWorldDesk],
  ["切后台立即落盘", taskPersistTiming],
  ["导出失败也说话", taskExportFailure],
  ["坏档也能进游戏", taskBadSave],
  ["iOS 存档风险提示", taskIosNotice],
  ["修行速服丹药的余量入口", taskQuickPillOverflow],
  ["修行功法三册的分批回看", taskGongfaListOverflow],
  ["天界道痕满卷的分批回看", taskMarksListOverflow],
  ["构筑对照的道痕余量入口", taskBuildCompareOverflow],
  ["道途未成的逐路发现账", taskBuildDiscovery],
  ["成路后的铸道总案", taskBuildFormed],
  ["坊市三摊与当前正文同册", taskMarketRegisterFold],
  ["三生录的册口与当前正文同册", taskLegacyRegisterFold],
  ["修仙录的历世与行迹回看", taskLegacyHistoryOverflow],
  ["道侣的历世同行回看", taskBondHistoryOverflow],
  ["器魂两册的分批回看", taskSoulListOverflow],
  ["名号与灵兽两册的分批回看", taskTitlePetOverflow],
  ["法宝全册的分批回看", taskArtifactListOverflow],
  ["开炉丹方的分批回看", taskRecipeListOverflow],
  ["词条转移候选的分批回看", taskAffixTransferOverflow],
  ["只读页(第二个标签页)的常驻说明", taskReadOnlyTab],
  ["开局前两页(欢迎 / 建号)", taskPreGameTour],
  ["玄枢图与全站册目", taskAtlasNavigation],
  ["浮层在 200% 缩放档(点得开的那几扇)", taskDialogZoom],
  ["构建产物 · dvh / 字体栈", taskBuildArtifacts],
];

/**
 * 固定上限的并发池:先到先跑,谁空出来谁接下一个。
 * 单个任务抛异常只把这条计入失败,不拖垮整轮 —— 从前一个未捕获的异常会让
 * 后面所有判据连不上、报告里只剩一句堆栈,分不清是环境问题还是真回归。
 */
async function runPool(tasks, limit) {
  const out = Array.from({ length: tasks.length });
  let next = 0;
  const worker = async () => {
    for (;;) {
      const i = next++;
      if (i >= tasks.length) return;
      try {
        out[i] = await tasks[i][1]();
      } catch (e) {
        out[i] = makeReport();
        out[i].failures.push(`[${tasks[i][0]}] 任务自身抛异常:${e?.stack ?? e}`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return out;
}

const results = await runPool(TASKS, JOBS);
await browser.close();
for (const r of results) {
  checked += r.checked;
  for (const f of r.failures) failures.push(f);
}

// 主值行那条判据是"显式契约"式的:契约被删光(没人再写 data-value-row)时它会静默空转
if (valueRowsSeen === 0) {
  failures.push("data-value-row 一个都没量到 —— 主值行折行那条判据空转了(模板里的契约被删了?)");
}
if (controlHostsSeen === 0) {
  failures.push("一枚按钮语义宿主都没扫到 —— 控件套控件那条判据空转了(全库不再有待查形状?)");
}
// 这两条同理:量不到东西时不许静默变绿
if (zoomSeen === 0) {
  failures.push("200% 缩放档一页都没量到 —— 那条判据空转了");
}
if (unopenedFolioSeen < 6) {
  failures.push(
    `封卷门径账只量了 ${unopenedFolioSeen}/6 次 —— 390 / 320 / 195 的天界与器魂没覆盖全`,
  );
}
if (pixelTextsSeen === 0) {
  failures.push("渐变/图片底上的字一处都没采到 —— 那条判据空转了(采样半径或底色判定写错了?)");
}
if (desktopFolioSeen < ROUTES.length) {
  failures.push(
    `桌面书桌只量了 ${desktopFolioSeen}/${ROUTES.length} 页 —— 1280 巡页没把新版式全部覆盖`,
  );
}
if (desktopSpineSeen < ROUTES.length) {
  failures.push(
    `桌面书脊只量了 ${desktopSpineSeen}/${ROUTES.length} 页 —— 1280 巡页没把新导航全部覆盖`,
  );
}
if (landscapeMastheadSeen < ROUTES.length) {
  failures.push(
    `矮横屏卷首只量了 ${landscapeMastheadSeen}/${ROUTES.length} 页 —— 844×390 巡页没覆盖全量路由`,
  );
}
if (tabletLeafSeen < ROUTES.length * TABLET_LEAF_TAGS.size) {
  failures.push(
    `平板宽叶只量了 ${tabletLeafSeen}/${ROUTES.length * TABLET_LEAF_TAGS.size} 页 —— 四档边界巡页没覆盖全量路由`,
  );
}
if (tabletDockSeen < ROUTES.length * TABLET_LEAF_TAGS.size) {
  failures.push(
    `平板底栏书脚索引只量了 ${tabletDockSeen}/${ROUTES.length * TABLET_LEAF_TAGS.size} 页 —— 四档边界巡页没覆盖全量路由`,
  );
}

/**
 * 产物层静态判据:**首页不许引用任何外链**。
 *
 * 上面那条量的是"跑起来时真的没发外部请求";这条补的是"就算不发,也不许把外链写进产物" ——
 * 例如 `<link rel="preconnect">`、预加载、条件加载的外部脚本,运行时量不到,但它们同样是
 * 对第三方的依赖(隐私声明第六节写着"零外部请求",这条替那句话守门)。
 */
{
  const html = readFileSync(join(ROOT, "dist/index.html"), "utf8");
  const external = [...html.matchAll(/(?:src|href)\s*=\s*["'](https?:\/\/[^"']+)["']/g)].map(
    (m) => m[1],
  );
  if (external.length > 0) {
    failures.push(
      `首页引用了 ${external.length} 个外链 —— 本站的决定是"零外部请求":${external.slice(0, 3).join("、")}`,
    );
  }
}

console.log(`\n排版自检:${checked} 个页面 × 视口组合`);
if (blockedTotal() !== 0) {
  failures.push(
    `这 ${checked} 次页面加载里发起了 ${blockedTotal()} 个外域请求 —— 本站的决定是「零外部请求」(见 index.html 与隐私声明第六节)`,
  );
}
if (failures.length === 0) {
  console.log(
    "✓ 无横向溢出、无越界元素、底部导航五项齐全、控件有名且不小于 28px、选择项有选中态、没有「念出来是按钮却按不动」的假控件、没有套在按钮里的控件",
  );
  console.log("✓ 顶栏底栏钉死(文档层没有可滚余量,滚窗两栏不动),外壳高度认 dvh");
  console.log("✓ 五处页签栏吸顶(背包四册 / 图鉴 / 界域志 / 天界 / 坊市),且铺满内容区宽度");
  console.log("✓ 顶栏一格一行(320 窄屏与横屏、桌面都不折行)");
  console.log(`✓ 桌面书桌(${desktopFolioSeen} 页:四册双页、十二册宽案、设置读卷)`);
  console.log(`✓ 桌面书脊(${desktopSpineSeen} 页:十七册齐全、当前册唯一、手机底栏退场)`);
  console.log(`✓ 矮横屏卷首(${landscapeMastheadSeen} 页:重复主视觉收起、正文探出导航)`);
  console.log(`✓ 宽叶四界(${tabletLeafSeen} 页:铺满余宽、底栏保留、书脊未提前挂出)`);
  console.log(`✓ 宽叶书脚索引(${tabletDockSeen} 页:40rem 收束、居中)`);
  console.log("✓ 桌面名兽案(名号 / 灵兽)总案与全谱并读");
  console.log("✓ 桌面界域志当前卷与境界谱并读,六册章号与真值同源");
  console.log(`✓ 主值行一格一行(${valueRowsSeen} 处带 data-value-row 的行没被次要读数挤折)`);
  console.log(`✓ 两百档字号(${zoomSeen} 页在 200% 缩放下不溢出、主值行不折)`);
  console.log(`✓ 封卷门径账(${unopenedFolioSeen} 次:390 / 320 / 195 齿数与去路齐全)`);
  console.log(`✓ 渐变与图片底上的字(${pixelTextsSeen} 处按屏幕像素采过,没有成片读不出来的)`);
  console.log("✓ iOS 存档风险提示只在该出现的平台出现,关一次就不再唠叨");
  console.log("✓ 楷体三端统一(内置排栈首,系统楷体留作兜底),且真由内置字体渲染");
  console.log("✓ 提示条点得掉、弹窗焦点与外壳偏移正常、引擎事件弹窗也过同一套尺子");
  if (SHOTS) console.log(`  截图已存 ${SHOTS_DIR}`);
} else {
  for (const f of failures) console.log(`✗ ${f}`);
  process.exitCode = 1;
}
