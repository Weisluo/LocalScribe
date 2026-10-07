# Phase 5 经济模块实施计划

> 依据：economy_ui_design.md；契约：cross_module_link_design.md；公共约定：00_overview.md。
> 本阶段复用 P1 的 worlds / world_modules / world_submodules / world_module_items / world_links，不新增表。
> 只写实施计划，不含代码。

## 1. 阶段目标与范围

**做**

- 数据：推荐 kind 骨架、EconomyModuleConfig、economy.overview / cycle / metrics、economy.* 与 era_context、流量与时间 meta，复用 P1 结构。
- 迁移：旧 color 前缀、moduleConfig、relations 字符串、customFields、emoji 图标。
- EconomyViewV2 三档（sketch 速写卡 / structure 线路图 + 账册 / sandbox 规模、流量、盈余赤字、时间刷、统计）、feature flag、1 实体 / 1 条边退化、800 降级、测试验收。

**不做**

- 不新增表、不新增契约第 4 节之外的 link_type、不写预置世界观内容；不做仿真、汇率换算、复式记账、AI 生成。
- 不动地图与特殊模块；不删旧 EconomyView（P6）；不做全局配置、世界脉络、世界列表（P6）。

## 2. 前置依赖与进入条件

- P0：P0-T1（D3 双读、D6 flag 结论）、P0-T2（迁移编号与兼容窗口）、P0-T3（旧数据盘点与测试矩阵）。
- P1：P1-T2（config/kind+meta）、P1-T3（world_links）、P1-T4（registry）、P1-T5、P1-T6（links service/API/counts）、P1-T9（pytest 夹具）。
- P2：P2-T1（API/hooks、gen:types）、P2-T2 EntityBadge、P2-T3 EntityPicker、P2-T4 LinkPanel、P2-T5 ComplexitySwitcher、P2-T7 导航与返回栈、P2-T8 InlineReference；接口以 P2-T11 验收冻结。
- P4：polity / organization / treaty 外站可跳转。

进入条件：空白世界可建经济模块；legacy 数据盘点完成；flag 默认关闭；`npm run gen:types` 可用。
P1/P2 上游 Task ID 已按 phase1 / phase2 plan 精确引用；P4 为阶段整体依赖。

## 3. 指导文档

- cross_module_link_design.md：§2.2-2.7、§3 economy、§4.1/4.4、§5.1-5.5、§6、§8。
- economy_ui_design.md：§3、§4.3-4.6、§5-§8、§9-§10、§11。
- worldbuilding_ui_design.md：§4.1/4.4/4.6/4.7、§5、§6.4、§7.3、§8、§10；worldview_configuration_system.md：§4.1-4.5、§7。
- 00_overview.md：§3-§6、§8；AGENTS.md。

## 4. 现状与改动面

简写：B=backend/app，M=migrations/versions，T=tests；前端均在 components/Worldbuilding/ 下，S=services，U=utils。

后端：

- B/models/worldbuilding.py → P1 已改，P5 只读，不新增表。
- B/schemas/economy.py（新建）→ Overview/Chip、MetricDef、Cycle、LinkMeta；__init__.py 挂载。
- B/services/economy_service.py（新建）→ 图聚合、计数、流量归一、时间线、统计、legacy 投影。
- B/api/v1/economy.py（新建）→ 只读 router；__init__.py 注册。
- M/ 新 revision → backfill_economy_kind_meta_links，batch_alter_table + 幂等；T/ 新建三份经济测试 + conftest 扩展。

前端：

- 旧 EconomyView.tsx 及 EconomicCard、RelationGraph、ConfigModal 等子组件保留（flag 关闭用，P6 删）；新建 EconomyViewV2/（P6 改名 EconomyView/）；WorldbuildingView.tsx 第 1440 行按 flag 选择。
- S/worldbuildingApi.ts 增加 economy graph/summary/timeline/metrics；frontend/src/types/api.ts 重生成；U/featureFlags.ts 新建（env + localStorage）。
- frontend/tests/economy/economy.spec.ts 新建 Playwright 冒烟；components/common/ 复用 P2 四件。
## 5. 任务分解表

F = frontend/src/components/Worldbuilding/EconomyViewV2；B、M、T、S、U 同 §4。

| Task ID | 任务 | 产出 | 上游 | 规模 |
|---------|------|------|------|------|
| P5-T1 | 经济 schema 与校验 | B/schemas/economy.py、B/schemas/__init__.py | P1-T2 | S |
| P5-T2 | 经济聚合服务 | B/services/economy_service.py | T1、P1-T5 | L |
| P5-T3 | 经济只读 API | B/api/v1/economy.py、B/api/v1/__init__.py | T2 | M |
| P5-T4 | 旧数据迁移回填 | M/新 revision | P0-T2、P1-T2、P1-T3、P1-T4、P1-T8 | M |
| P5-T5 | 过渡期 legacy 投影 | B/services/economy_service.py | T2 / T4 | S |
| P5-T6 | 后端测试 | T/test_economy_schema / graph_api / migration + conftest | T1-T5、P1-T9 | M |
| P5-T7 | 客户端与类型 | S/worldbuildingApi.ts、frontend/src/types/api.ts | T3、P2-T1 | S |
| P5-T8 | 档位骨架 | F/EconomyView.tsx、config.ts、types.ts、hooks/useEconomyViewState.ts | P2-T5、T7 | M |
| P5-T9 | sketch 速写卡 | F/components/SketchLedger.tsx、ChipList.tsx、modals/PromoteChipModal.tsx | T8 | M |
| P5-T10 | 线路图 | F/components/FlowCanvas.tsx、GraphNode.tsx、GraphEdge.tsx、graph/layout.ts | P2-T5/T7、T8 | L |
| P5-T11 | 账册与检查器 | F/components/LedgerList.tsx、InspectorPanel.tsx | P2-T4、P2-T8、T10 | M |
| P5-T12 | 沙盘叠加 | F/components/SandboxOverlay.tsx、StatsPanel.tsx、LayerRail.tsx、graph/normalize.ts | T10、T7 | L |
| P5-T13 | 时间刷与周期带 | F/components/TimeBrush.tsx、hooks/useTimeline.ts | T12、T7 | L |
| P5-T14 | 退化形态与 800 降级 | F/components/DegradeLedgerMatrix.tsx、EmptyState.tsx、graph/guards.ts | T10 / T11 | M |
| P5-T15 | flag 与回归 | WorldbuildingView.tsx、U/featureFlags.ts、frontend/tests/economy/economy.spec.ts | T9-T14 | M |

## 6. 数据 / API / 组件变更清单

**数据（不新增表）**

- kind：推荐 resource / good / industry / market / currency / actor / institution + custom_xxx；骨架常量放 `F/config.ts`，用户点击后才写入 ModuleConfig.entityTypes，不入库预置。
- items：economy.overview（module 级速写卡，3-5 槽）、economy.cycle（module 级，一条一周期，kind = custom_cycle）、economy.metrics（submodule 级）；其余条目沿用。
- meta：level、status、stage、unit、scale、timeOrder、cyclePhaseId、stub、tags、customFields。
- links：仅契约 §4.4：economy.produces / economy.consumes / economy.requires / economy.traded_at / economy.flows_to / economy.currency_of / economy.owned_by / economy.regulated_by / economy.taxed_by / economy.located_in / economy.supplies / economy.era_context；meta 用 flow、unit、flowSeries、intensity、surplus、priceBand、confidence、routeNote，time 存有效期。
- config：defaultComplexity、displayMode、entityTypes、stages、sketchFields、metrics、layers、defaultFlowUnit；首次打开懒创建。
- 迁移：color `type:<old>:<level>` → kind + LevelDef（去星级，六类旧类型依次映射 currency/good/resource/industry/market/custom_route）；moduleConfig → WorldModule.config；relations 字符串 → world_links（命中 registry 用对应 economy.*，否则 core.references 或 core.related_to，原名放 label/meta）；customFields → meta；legacy 保留到 P6。

**API（module 级只读；写复用 P1 通用接口）**

- GET `/api/v1/worldbuilding/modules/{module_id}/economy/graph`，参数 complexity、kinds、stages、windowStart、windowEnd。
- GET `.../economy/summary`、`.../timeline`、`.../metrics`。
- 写入：`/api/v1/worldbuilding/worlds/{world_id}/links`、`/modules/{module_id}/submodules`、`/modules/{module_id}/items`（P1）。

**组件**

- 复用 P2-T5 ComplexitySwitcher、P2-T4 LinkPanel、P2-T3 EntityPicker、P2-T2 EntityBadge。
- 新增 `EconomyViewV2/`：档位骨架、三档组件、graph/{layout,normalize,guards}、hooks/{useEconomyViewState,useTimeline}；文件清单见 P5-T8..T14。
- WorldbuildingView 按 flag 分支；无新增图形依赖，布局自研。

## 7. 测试与验收清单

数据 / 后端：

- [x] 迁移空库 / 旧库 upgrade、downgrade、重复执行幂等，legacy 不丢。
      （P5 迁移无任何 DDL；空库 upgrade 报告全 0；旧库实测 kind_backfilled 6 / level_backfilled 5 /
      levels_added 3 / levels_destarred 1 / config_keys_written 2 / custom_fields_backfilled 1 /
      icons_mapped 1 / relations_links_created 1；重复 upgrade 快照逐字段相等（零写入）；
      downgrade 后 kind 回 commodity、icon 回 emoji、config 回 NULL、本次新建边删除、旧 item 3 条原样保留）
- [x] graph API 节点 / 边 / 计数与筛选正确（含 1 实体 1 边）；流量 0 与缺省可区分，单值边绝对模式。
      （`test_economy_graph_api.py` 15 条；harness 断言 `scale` 四态 none/intensity/absolute/relative、
      `flow=0` → 细实线标 `0`、缺省 → 虚线标 `—`、单边有值固定中等线宽 + 直接标数值）
- [x] timeline 周期带、era_context 时代 / 事件与窗口过滤；多单位提示。
      （周期带 + history.era/event 标记名称解析；`unanchored` 无锚点不猜时间；`units` 去重 + `multiUnit`）
- [x] metrics schema 校验；缺采样不补 0；pytest 全过。
      （`normalize_metric_value` 丢非法值；窗口内无采样进 `emptyEntities`，不补 0 点）

前端：

- [x] tsc / eslint / build 通过，gen:types 无漂移。
- [x] sketch 3 项可完成、无复杂术语、chip 展开保持同一 id。
      （速写档全文不含 实体/关联/流量/指标/周期/节点；chip 展开用 chip.id 建实体 + `meta.stub`）
- [x] structure 阶段 / 类型泳道与账册 / 分栏同步；LinkPanel 反向文案一致。
      （画布与账册共享选中与筛选；画布工具条与顶栏共用同一份视图状态；检查器嵌入 common/LinkPanel）
- [x] sandbox 规模 / 流量 / 盈余赤字、单边绝对模式、时间刷、统计、图层。
- [x] 1 实体 0 边、1 实体 1 边、N 实体 0 边均可用。
- [x] 800 节点 fixture 自动降级账册矩阵 + 推荐关联。
- [x] flag 开关与回滚可复现，旧 UI 不受影响。
- [x] light/dark、键盘、无 emoji、Lucide、green/cyan；Playwright 冒烟通过。
      （领域色 light/dark 两套 hex 由 harness 断言；emoji 0、icon 全部为 lucide-react 真实导出名；
      画布键盘 Tab/方向键/Enter/Esc 与 1/2/3、L、F 由组件实现并有离线 SSR 自检）
- [x] link_type 仅契约 §4（校验测试通过）。

### 7.1 验收实测（2026-10-07）

| 项 | 命令 | 结果 |
|---|---|---|
| 后端回归 | `cd backend && venv\Scripts\python.exe -m pytest -q` | **213 passed**（基线 127 + P5 新增 86，其中复核轮新增 21）；`test_pdf_export.py` 的 2 条打印用例在浏览器争用时偶发 `Page.printToPDF 'Printing is not available'`，立即重跑即通过（与 P5 无交集，见 §7.2） |
| 迁移链 | `alembic heads` | 单一 head `d4e8b1c7a206`（`down_revision = c1f7a4b9e2d3`） |
| 迁移幂等 / 回滚 | 空库 + 合成旧库 upgrade×2 → downgrade → upgrade | 幂等（快照逐字段相等，零写入）；downgrade 精确还原本次写入值，用户改动保留（link 快照比对 / levels 原文 / customFields 原值 / legacyIcon 三项均有用例） |
| 前端类型 | `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` | 0 error |
| 前端 lint | `node node_modules/eslint/bin/eslint.js src --ext ts,tsx` | 0 error / 15 warning（12 条既有 + 3 条 P5 新增，见 §7.2） |
| 前端构建 | tsc + `vite build` | 成功（Worldbuilding chunk 940.49 kB） |
| OpenAPI 漂移 | `app.openapi()` 导出 → `openapi-typescript` 重生成 `src/types/api.ts` | 与提交文件**逐字节相同**；相对 P4 仅新增 868 行、既有 schema 零漂移；`phase5.spec.ts` 另有逐字段漂移守卫（改名与缺失都会失败） |
| 前端回归 | `node node_modules/@playwright/test/cli.js test` | **29 passed**（export 1 + phase2 6 + phase3 6 + phase4 8 + **phase5 8**） |
| 浏览器侧断言 | phase5 harness（`tests/worldbuilding/harness5.tsx`） | **131 条检查全过**，0 页面错误（floor 即精确值 131） |
| 契约白名单 | `phase5.spec.ts` | 经济代码 0 条契约外 link_type；注册表仍 54 条、经济自有边恰为 §4.4 的 12 条 |
| 边界 | `phase5.spec.ts` | 无新增表 / 无 `add_column`；经济 API 恰 4 个只读 GET，无写路径；未引入图库 |
| 领域色 | `phase5.spec.ts` | 绘制代码 0 处 `emerald-*`；`ECONOMY_PALETTE` 与 §4.7.1 表格逐值相等（含 `green` 色名 → `green-600`） |
| 旧 UI 保留 | `git status` + `phase5.spec.ts` | 旧 `EconomyView/` 未删；`WorldbuildingView` 仅 14 行新增（flag 二选一） |

### 7.2 明确未实现（已从验收勾选中移出，登记 P6 或单独立项）

- **账册「最近更新」列恒为「—」**：`EconomyNode` 载荷没有 `updated_at`，前端不回退读世界详情。
- **一键细化会换 id**：`WorldLinkUpdate` 不支持改 `link_type`，`refineRawLink` 采用「先建 economy.* 再删
  core.related_to」并写 `meta.refinedFrom`（设计期望保留关联 id，需后端放开 PATCH link_type）。
- **沙盘播放不驱动叠加**：`Space` 由外壳消费，但 `SandboxOverlay` 内部持有播放定时器，键位不穿透；
  时间刷无窗口内指标插值动画（只做窗口过滤与匀速前进），节点不按锚点重排。
- **画布交互**：缩放 / 平移、拖拽建边、批量多选、画布内就地改名（双击=打开实体）未做。
- **hover 预览真名解析**：跨模块对端名称的回退链已实现，但端到端断言需要真实浏览器 `pointerenter`。
- **§9.2 空状态备选按钮**（先放着 / 先不写数值 / 先用流量线宽 / 先看单年快照 / 保存为视图）未提供回调，
  只渲染一个主按钮 + 最多一个备选；`empty-window` 两个按钮共用「放宽窗口」。
- **暗色模式**只做 token 级断言（`ECONOMY_PALETTE` 两套 hex），未逐屏截图核对。
- **3 条新增 eslint warning**：`SandboxOverlay.tsx` 导出的 CSV helper 触发
  `react-refresh/only-export-components`（HMR 层提示，非错误）。
- **测试落位**：计划 §4 写的是 `frontend/tests/economy/economy.spec.ts`，实际按仓库既有分阶段布局落在
  `frontend/tests/worldbuilding/phase5.spec.ts` + `harness5.tsx`（`npm test` 直接跑到，与 phase2/3/4 同构）。
- **P1 侧既有断言随新 head / 新词表更新**（`test_worldbuilding_backfill.py` 2 处、`test_worldbuilding_migrations.py`
  1 处）：economy config 多出 `levels`/`_p5Legacy`、`EN2 commodity → good`、head 上移到 `d4e8b1c7a206`；
  复核轮又按 M7 修正了 `target_kind` 一处失真的夹具（P1 旧词表实际写 `commodity`，P5 同步后才变 `good`）。
- **`conftest.py` 会话库双重导入陷阱修复**（P5 新增测试文件按字母序排到 `test_export_api.py` 之前才暴露）：
  会话库路径写入带进程号的 `LOCALSCRIBE_TEST_DB_<pid>`，同进程重复导入复用同一路径，
  并行 pytest 进程与外部预设的同名变量都不会串库。
- **300-800 节点的分层 canvas 未实现**：`FlowCanvas` 只做 SVG 标签简化（`renderModeOf` 已作为唯一
  真源接入，不再有只被测试调用的死代码），超过 800 仍走账册矩阵；按 §8 风险表的 canvas 渲染留 P6。
- **降级态只有 `kinds` / `stages` 能在服务端生效**：矩阵要反映筛选必须回到服务端，而 graph 契约
  只开放这两个筛选参数（等级 / 状态 / 搜索 / 有无指标只在有节点明细时由前端过滤）。
- **自建 kind（`custom_*`）不写入 `config.entityTypes`**：推荐骨架在用户实际用到后会落库（计划 §6），
  但自建 kind 没有可推断的 `parentKind`，不猜，留给 P6 的类型配置面板。
- **未完全定位的抖动（建议 P6 留意）**：`tests/test_pdf_export.py` 的两条真打印用例依赖本机 Edge/Chrome 的
  printToPDF，全量跑时偶发 `{'code': -32000, 'message': 'Printing is not available'}`，而单跑 / 立即重跑均通过。
  观测记录：无 P5 测试文件的对照运行一轮未复现（127 passed）；`test_economy_graph_api.py + test_pdf_export.py`
  组合首次失败、15 分钟后同组合连跑 3 次通过；全量另有一次 191 passed + 1 failed、随后再跑通过。
  P5 未触碰任何 PDF 代码（改动面只有 economy 的 schema / service / router / 迁移 / 测试与前端经济视图），
  倾向浏览器打印子系统在并发实例下的抖动；若 P6 再现，优先排查并行浏览器实例与打印服务，而不是经济模块。

### 7.3 复核修复轮（2026-10-08）

外部复核对本轮的 13 项缺陷逐条实测复现后，全部在 P5 内修掉（不推迟到 P6）；每条都补了会因缺陷回归
而失败的测试，并做了「把修复还原成缺陷 → 测试变红」的反向验证：

| # | 缺陷（复核结论） | 修法 | 验证 |
|---|---|---|---|
| 1 | **800 节点降级端到端不可达**：后端降级时 `nodes=[]`，前端却按 `filteredNodes.length` 重算降级 → 恒 false，且空状态分支先返回，900 实体世界显示「空世界」 | 降级改以后端 `graph.degraded` 为准；`degradeStateOf` 收 `serverDegraded/serverReason/serverNodeCount`；降级分支提到空状态之前 | harness 降级用例改为**后端真实载荷形状**（`nodes: []` + `degraded`），断言矩阵渲染、无空状态、无画布；`degradeStateOf` 边界 800/801 直测 |
| 2 | **降级矩阵没有数据源**（明细不返回，矩阵却按节点渲染） | `EconomyGraphCounts.byKindStage`（`kind\|stage` 交叉计数）新增并在任何档位返回；矩阵优先用 `counts` 渲染，实体清单在无明细时改为一句说明 | 后端新用例断言交叉计数与 `byKind` 同口径、降级载荷里非空；前端 SSR 16/16 断言单元格计数 |
| 3 | **`PUT /modules/{id}` 恒 500**（`WorldModuleUpdate` 缺 `module_type`，端点直接读该属性），而 P5 的 `saveConfig` 正走这条路径 | `WorldModuleUpdate` 补 `module_type` 字段 | `test_module_update_accepts_partial_payloads`：只带 config / 只带 name 均 200，重复 `module_type` 仍 400 |
| 4 | **两条 500 崩溃路径**：`meta.time` 与 `windowStart` 超 100 字符触发 `LinkTimeRange` 校验异常 | 新增共用 `_safe_time_range()`，三处构造（节点时间 / 边时间 / `appliedWindow` 回显）统一截断到 100 字符 | 超长与恰好 100 字符边界用例；修复还原后 500 复现 |
| 5 | **meta 形状未防御**：`customFields` 非 dict → 500；`tags` 为字符串被拆成字符数组 | isinstance 守卫，非契约形状取空，不猜测、不崩 | 用例断言 200 且 `customFields={}` / `tags=[]` |
| 6 | **筛选后残留孤儿外站节点**（边被丢弃，外站节点仍进 `nodes` 与计数） | 只把被**实际保留的边**引用的外站节点并入输出与计数 | 用例断言 `kinds=resource` 时 `nodes/edges/externalNodes` 全 0，并有未筛选对照 |
| 7 | **沙盘「按窗口取数」未实现**（timeline / metrics 不带窗口参数） | 窗口纳入 timeline / metrics 的 queryKey 与 params；graph 仍客户端淡出（注释说明差异） | harness 断言窗口变化触发换 key；后端窗口切片已有用例 |
| 8 | **全局键盘双重处理**（画布 / 切换器已 `preventDefault`，外壳再处理一次） | window handler 首行 `if (event.defaultPrevented) return` | harness 新增键盘用例：切换器方向键只切档、不改选中、不弹检查器 |
| 9 | **领域色与设计不符**：绘制代码用 `emerald-*`（#059669），设计要求 eco-green-600（#16A34A）；`green` 色名在画布线色表里也指向 emerald | 全部改 `green-*`（含 `TONE_STROKE/TONE_FILL` 的 `green`），`ECONOMY_PALETTE` 逐值与 §4.7.1 对齐 | 静态护栏：绘制代码 0 处 `emerald-`，palette 逐值相等，`#059669` 出现即失败 |
| 10 | **「导出当前窗口 CSV」不按窗口过滤**，而正确的窗口版 helper 是死代码 | 先按窗口过滤再导出，空窗口给提示，文件名与内容一致 | 用例断言导出内容随窗口变化 |
| 11 | **`[` / `]` 微调丢精度、可塌成零宽、未限档位** | 解析改 `anchorOf`、生成改新增的 `formatAnchor`（保留两位小数），只在 sandbox 生效 | `formatAnchor` 精度用例；键盘用例覆盖档位门禁 |
| 12 | **视图状态跨世界泄漏**（URL key 是全局的） | 新增 `economyScope` 作用域键，只认作用域匹配的一组参数，作用域变化即清理 | 纯函数 `economyUrlScopeMatches` 用例 + harness 断言 |
| 13 | **验收护栏空心化**：漂移守卫在字段改名时静默过滤、阈值断言测的是生产无调用者的函数、降级断言可被文案短路 | 漂移守卫两段式（schema 侧缺失即失败）；阈值断言改测生产函数；删掉文案短路断言 | 人为改坏（改名字段 / 改 emerald / 改 palette hex）均确认变红 |

**迁移精度（同轮修复，均有反向用例）**：`downgrade` 不再无条件删本次新建的边（补列快照逐字段比对后再删）、
`config.levels` 非 list 原文可回滚、`customFields` 非 dict 原值可还原、用户改过的 `legacyIcon` 不再被弹掉、
非法 JSON 不再让整条 downgrade 失败、回落 link_type 与 P1-MIG-05 口径一致（有向 `core.references` /
对称 `core.related_to`）、kind 归一化同步 `world_links.source_kind/target_kind` 并升级本可命中的
`economy_relations` 边（旧值记账，downgrade 精确回滚）。


## 8. 风险、兼容与回滚

| 风险 | 缓解 |
|------|------|
| 新旧并存 | legacy 保留 + P5-T5 投影，P6 清理 |
| 迁移误伤 | 只回填不删；downgrade 只撤 P5 回填 |
| 画布性能 | 300 内 SVG、300-800 canvas、超过 800 降级 |
| 自由文本时间 | meta.timeOrder；缺锚点不猜 |
| 多单位 | 不换算，分别标单位 |

回滚：关闭 flag 回旧 UI；迁移 downgrade 撤销回填；用户创建的 metrics / cycle 条目保留但不展示，不删数据。

## 9. 完成定义 DoD

- 00_overview §5 通用 DoD 全部满足。
- 三档共用一套数据；1 实体 / 1 条边可用；800 节点降级生效。
- 仅使用契约 §4 link_type；无 emoji，图标 Lucide，领域色 green / cyan。
- 迁移幂等；pytest、tsc、eslint、Playwright 冒烟通过；flag 可开可关。
- 向 P6 交接旧组件、legacy 投影、feature flag 的删除清单（见下）。

**P5 交付面（供 P6 接手）**

新增后端：`app/schemas/economy.py`、`app/services/economy_service.py`、`app/api/v1/economy.py`、
`migrations/versions/d4e8b1c7a206_wbl_p5_01_backfill_economy.py`、
`tests/test_economy_{schema,graph_api,migration}.py`；改动：`schemas/__init__.py`、`api/v1/__init__.py`、
`tests/conftest.py`（会话库幂等）、`tests/test_worldbuilding_backfill.py` 与 `test_worldbuilding_migrations.py`（head 上移）。

新增前端：`components/Worldbuilding/EconomyViewV2/`（24 个文件：`EconomyView.tsx` / `index.ts` / `config.ts` /
`types.ts` / 3 个 graph 纯函数 / 3 个 hooks / 13 个 components / 1 个 modal）、`utils/featureFlags.ts`、
`tests/worldbuilding/harness5.tsx`、`tests/worldbuilding/phase5.spec.ts`；改动：`services/worldbuildingApi.ts`
（4 个 economy 只读方法）、`types/api.ts`（重生成）、`WorldbuildingView.tsx`（14 行 flag 分支）、
`tests/worldbuilding/bundle.mjs`（harness 入口）。

**P6 删除清单（交接）**

1. 旧经济 UI：`components/Worldbuilding/EconomyView.tsx` 与 `EconomyView/`（含 EconomicCard /
   RelationGraph / ConfigModal 等子组件）——flag 关闭时的回退路径，P6 全量切换后删除。
2. Feature flag：`utils/featureFlags.ts` 的 `isEconomyViewV2Enabled` / `setEconomyViewV2Enabled` /
   `FEATURE_FLAG_KEYS` 与 `WorldbuildingView.tsx` 的二选一分支，以及 `VITE_WORLD_ECONOMY_VIEW_V2`
   env 与 `localscribe.featureFlag.worldEconomyViewV2` localStorage 键。
3. legacy 读取侧投影：`EconomyService.project_legacy_config / project_legacy_submodule /
   project_legacy_links`，以及旧 `color = type:<old>:<level>` 前缀、emoji 图标、name 为
   `moduleConfig` / `relations` / `customFields` 的旧条目兼容分支（P5 迁移已回填，仅作双读窗口）。
4. 目录改名：`EconomyViewV2/` → `EconomyView/`（P6 按计划重命名，导出名一并去掉 V2 后缀）。
5. 未实现项：见 §7.2（账册更新时间列、一键细化保 id、沙盘播放穿透、画布缩放/拖拽/批量、§9.2 备选按钮、
   暗色逐屏核对）；其中「一键细化保 id」若要做，应先放开 `PATCH /links/{id}` 的 `link_type`。


## 10. 明确不在本阶段做的事

- 不新建表，不改契约与设计文档，不新增世界观预设内容。
- 不做世界脉络、全局配置、搜索、列表与备份（P6）。
- 不删除旧 EconomyView、legacy 字段与投影、feature flag（P6）。
- 不做仿真 / 汇率 / 复式记账 / AI / 外部数据导入；不动地图与特殊模块。
- 不为超过 800 节点做真实渲染优化，降级是唯一路径。
