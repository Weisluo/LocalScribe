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

- [ ] 迁移空库 / 旧库 upgrade、downgrade、重复执行幂等，legacy 不丢。
- [ ] graph API 节点 / 边 / 计数与筛选正确（含 1 实体 1 边）；流量 0 与缺省可区分，单值边绝对模式。
- [ ] timeline 周期带、era_context 时代 / 事件与窗口过滤；多单位提示。
- [ ] metrics schema 校验；缺采样不补 0；pytest 全过。

前端：

- [ ] tsc / eslint / build 通过，gen:types 无漂移。
- [ ] sketch 3 项可完成、无复杂术语、chip 展开保持同一 id。
- [ ] structure 阶段 / 类型泳道与账册 / 分栏同步；LinkPanel 反向文案一致。
- [ ] sandbox 规模 / 流量 / 盈余赤字、单边绝对模式、时间刷、统计、图层。
- [ ] 1 实体 0 边、1 实体 1 边、N 实体 0 边均可用。
- [ ] 800 节点 fixture 自动降级账册矩阵 + 推荐关联。
- [ ] flag 开关与回滚可复现，旧 UI 不受影响。
- [ ] light/dark、键盘、无 emoji、Lucide、green/cyan；Playwright 冒烟通过。
- [ ] link_type 仅契约 §4（校验测试通过）。

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
- 向 P6 交接旧组件、legacy 投影、feature flag 的删除清单。

## 10. 明确不在本阶段做的事

- 不新建表，不改契约与设计文档，不新增世界观预设内容。
- 不做世界脉络、全局配置、搜索、列表与备份（P6）。
- 不删除旧 EconomyView、legacy 字段与投影、feature flag（P6）。
- 不做仿真 / 汇率 / 复式记账 / AI / 外部数据导入；不动地图与特殊模块。
- 不为超过 800 节点做真实渲染优化，降级是唯一路径。
