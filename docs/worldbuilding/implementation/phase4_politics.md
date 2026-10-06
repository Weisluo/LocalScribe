# Phase 4 · 政治 实施计划

> 上游计划：phase3_races_systems.md（Phase 3 DoD 通过后进入）。
> 设计依据：politics_ui_design.md 全文；cross_module_link_design.md §3/§4/§5；worldbuilding_ui_design.md §4/§6；worldview_configuration_system.md §4；00_overview.md §3-§6、§7、§8、§10。
> 范围：只写实施计划，不写代码。实施中发现设计冲突时，先改 cross_module_link_design.md，再同步本 plan。

---

## 1. 阶段目标与范围（做/不做）

做：新建 PoliticsView 三视图（版图/名录/沿革）+ 聚焦详情 + LinkPanel + 3 分钟路径；落地四 kind 的 meta/items/ModuleConfig；落地 politics.* 边与 signatory_of 唯一规范、figure.meta.characterId；用 LevelDef.rank 驱动权重，实现组织卫星/独立势力带、人物头像条/任职带、条约缎带 + 次级条约簿；关系层筛选、聚焦降噪、三档复杂度、性能降级、旧数据回填兼容。

不做：不改地图/特殊；不新增契约 §4 之外的 link_type；不做世界脉络、世界设置、模块配置面板（Phase 6）；不建经济/种族/体系视图；不迁移旧政治预设（D5 只读）；不做四平级 Tab、同构卡片与预置内容；不写代码、不改设计文档。

---

## 2. 前置依赖与进入条件

上游依赖：P0-T1..T4（D1/D3/D4/D5 结论）；P1-T2（config/kind+meta）、P1-T3（world_links）、P1-T4（registry）、P1-T5/T6（links service/API/counts）、P1-T7（worlds CRUD/导出导入）；P2-T1（API/hooks/gen:types）、P2-T2..T5（EntityBadge/EntityPicker/LinkPanel/ComplexitySwitcher）、P2-T7（导航返回栈）、P2-T9/T10（History 接入 WorldLink 可作参照）；P3-T7/T8（种族/体系实体、字段与详情组件复用）。

进入条件：

- [x] Phase 3 DoD 通过，common 组件可在任意模块复用；world_links 为唯一关系写入路径，submodule kind/meta 可读写。
- [x] `npm run gen:types` 已生成 WorldSubmodule.kind/meta、WorldLink、LinkTypeDef 等类型；政治模块可由 WorldbuildingView 创建。
- [x] 旧数据盘点完成，见 `phase4_inventory_report.md`（worldview_configs 0 行、politics 5 行全部 kind=polity、`treaty_between` 残留 0 行）。

---

## 3. 指导文档（精确到章节）

| 文档 | 章节 | 用途 |
|---|---|---|
| politics_ui_design.md | §2-§12 | 权重、数据、UI、交互、关联、复杂度、空状态、3 分钟、性能、边界 |
| cross_module_link_design.md | §3、§4、§5 | politics 职责、politics.* 唯一边、LinkPanel/选择器/复杂度 |
| worldbuilding_ui_design.md | §4、§6.3、§6.8 | 模块框架与卡片规范、政治总览、关联通道 |
| worldview_configuration_system.md | §4 | kind、等级、状态、字段、自定义关联 |
| 00_overview.md + AGENTS.md | 全文/工程纪律 | 命名、模板、DoD、基线、D1-D7；迁移与 lint 纪律 |

---

## 4. 现状与改动面（真实代码路径）

- `frontend/src/components/Worldbuilding/WorldbuildingView.tsx`：TAB_CONFIG 已有 politics，但渲染落到通用 ModuleSection；增加 politics 分支渲染 PoliticsView，透传导航回调。
- `frontend/src/components/Worldbuilding/PoliticsView.tsx` + `PoliticsView/`（新建）：三视图壳与 types/config/hooks/PowerAtlas/Roster/Chronicle/TreatyBook/FocusPanel/modals。
- `frontend/src/components/common/`（P2）：复用 EntityPicker/LinkPanel/EntityBadge/ComplexitySwitcher，不建政治专属面板。
- `frontend/src/services/worldbuildingApi.ts` + `frontend/src/types/api.ts`：接入 P1/P2 worlds/links 客户端与 gen:types；政治 hooks 就近模块目录。
- `backend/app/models/worldbuilding.py` + `backend/app/schemas/worldbuilding.py`：P1 补 kind/meta/config；旧 PoliticsModuleConfig 只读（D5）。
- `backend/app/models/relation.py` + `backend/app/services/relation_service.py` + `backend/app/api/v1/relations.py`：P0 D1 后停写，Phase 6 删除；政治只走 world_links。
- `backend/app/api/v1/worldbuilding.py` + `backend/migrations/versions/`：P1 扩展 submodule kind/meta 并新增迁移；P4 回填迁移基于当前 head，不新增政治专属 router。

---

## 5. 任务分解表：Task ID、任务、产出、依赖、规模、建议顺序

按行顺序为建议顺序；上游 Task ID 以对应 phase plan 为准。

| Task ID | 任务 | 产出/改动点 | 依赖 | 规模 |
|---|---|---|---|---|
| P4-T1 | 政治类型与配置映射 | PoliticsView/types.ts、config.ts：四 kind、meta、items 组、ModuleConfig | P1 kind+meta、P2 gen:types | S |
| P4-T2 | 政治查询 hooks | PoliticsView/hooks/：按 kind 取子模块、link counts、缎带投影、任职带 | P4-T1、P1 links API | M |
| P4-T3 | 权力版图画布骨架 | PowerAtlas/AtlasCanvas.tsx、PoliticsView.tsx 三视图壳 | P4-T2、P2 common | L |
| P4-T4 | 政权节点 + 组织卫星 | PolityNode.tsx、OrganizationCluster.tsx、IndependentLane.tsx：rank 尺寸、scope 计算、跨政权吸附 | P4-T3、P1 | M |
| P4-T5 | 人物头像条与任职带 | FigureStrip.tsx：characterId 解析、member_of/leads 的 time+meta、EntityPicker | P4-T4、P2、D4 | M |
| P4-T6 | 条约缎带与条约簿 | TreatyRibbonLayer.tsx、TreatyBook.tsx：signatory_of 投影、单方旌旗、条款浮层 | P4-T3、P1 links | M |
| P4-T7 | 关系层与筛选 | RelationEdgeLayer.tsx、RelationFilterPanel.tsx：politics.* 线型箭头、聚焦降噪、边卡 | P4-T3、P4-T6 | M |
| P4-T8 | 聚焦详情 + LinkPanel | FocusDrawer.tsx 四类分面板；挂 common/LinkPanel；节点/名录计数徽章 | P4-T4..T6、P2 LinkPanel | M |
| P4-T9 | 名录视图 | Roster/RosterView.tsx：主行/子行/独立势力/条约折叠、内联编辑、拖拽归属 | P4-T2、P4-T4 | M |
| P4-T10 | 沿革视图 | Chronicle/ChronicleView.tsx：政权泳道、items.chronicle、history 叠加、条约有效期 | P4-T2、P2 history、P1 links | M |
| P4-T11 | 交互闭环 + 复杂度降级 | modals/、EmptyState.tsx：3 分钟创建、拖拽建边/条约、删除三选项；ComplexitySwitcher + LOD/边聚合/矩阵降级 | P4-T2、P4-T4..T10 | L |
| P4-T12 | 旧数据回填与验收收口 | P1 回填脚本扩展（kind/meta 识别、legacy 标记）；tests 与验收；权重/无四 Tab/3 分钟/降级演练 | P0 D3/D5、P1 迁移、P4-T1..T11 | M |

---

## 6. 数据 / API / 组件变更清单

- 数据：kind = polity/organization/figure/treaty（+custom_*）；meta 通用 level/status/time/tags/customFields，分 kind 加 scope、characterId、treatyTypeId、effectiveAt/expiresAt、breachState；items 字段组 government、chronicle、demographics、economy_base、org_*、figure_identity、treaty_*、custom。
- 关联：只用契约 §4。politics 侧 politics.controls_region、capital_at、member_of、leads、founded_by、subordinate_to、signatory_of、includes_race、ally_of、at_war_with、vassal_of、trades_with、marriage_tie、succeeds；跨模块仅 history.milestone_of/occurs_at/involves、economy.regulated_by/taxed_by/supplies/owned_by/currency_of、systems.practiced_by、character.belongs_to_race/practices_system/attained/serves/owns/appears_in、races.notable_figure。signatory_of 为缔约唯一规范边，treaty_between 不写；figure.meta.characterId 不落 WorldLink。
- ModuleConfig：entityTypes、levels、statuses、fieldSchema、linkTypes、terminology、palette、displayMode=atlas、defaultComplexity=sketch，默认空、不预置。
- API/组件：复用 P1 的 links/submodule kind+meta/module config 资源与 gen:types，不新增政治专属后端 router；新建 PoliticsView.tsx 与 PoliticsView/（types、config、hooks、PowerAtlas、Roster、Chronicle、TreatyBook、modals），复用 common/{LinkPanel, EntityPicker, EntityBadge, ComplexitySwitcher}；不建同构卡片，不新建政治专属 LinkPanel。

---

## 7. 测试与验收清单（可勾选）

- [x] 权重三处成立：政权唯一大卡（kind 口径，§2.1）；组织卫星/独立势力带；人物头像条/任职带/紧凑行；条约缎带 + 次级条约簿；详情分级；LevelDef.rank 驱动尺寸与布局环。
      （`phase4.spec.ts` harness 断言 `atlasSizeTier/atlasRingOf` 由 rank 分档、Roster 行高与 FocusPanel 分段按 kind 分化；`atlasLayout` 的环半径按卡片宽度与槽位数计算，环内不重叠）
- [x] 无四个平级 Tab；figure 仅 characterId + 政治身份、任期在边、缔约方在边。
      （`POLITICS_VIEWS` 恰为三个；`FigureMeta` 无姓名字段；`tenureBandsOf` 只读 member_of/leads 边的 meta+time）
- [x] 只用契约 §4 link_type 且 reverseLabel 一致；`signatory_of` 是唯一写入的缔约边，旧 `treaty_between` 只做读取侧等价转换；LinkPanel 覆盖四类详情。
      （关系层文案唯一来源是 `POLITICS_RELATION_LAYERS`（label/reverseLabel 与契约 §4.3 逐字一致）；`projectSignatories` 把一端为条约的旧边等价并入缔约方并标 `legacy`，两端均非条约的旧边由 `pendingLegacyTreatyEdges` 回报；phase4 spec 断言代码两侧 link_type 清单与契约一致）
- [x] 地图未接入隐藏入口；历史/经济/种族/体系为空不阻塞；3 分钟路径、聚焦降噪、名录编辑、沿革联动、组织树归属通过。
      （领土层与首府新建入口整块不渲染；历史为空时沿革只画政治侧锚点；`subordinate_to` 组织链上溯到政权才判 `intra_polity`，成环与超三层在写入路径被拒）
- [x] 政权「统治者」全链路契约合法：写 `figure -> polity` 的 `leads` 边（figure 以 `meta.characterId` 关联全局角色），职位 / 任期 / 是否主要 的修改会更新既有边。
- [x] 编辑保存一次 PUT 合并通用字段与 kind 专属 meta，不再发生「第二次写用旧快照回滚第一次写」的数据丢失。
- [x] TS/lint、pytest、迁移幂等与精确回滚、light/dark、无 emoji、Lucide 名、reduced-motion、超阈值降级通过。

### 7.1 验收实测（2026-10-07，修复轮后重跑）

| 项 | 命令 | 结果 |
|---|---|---|
| 前端类型 | `tsc --noEmit -p tsconfig.json` | 0 错误 |
| 前端 lint | `eslint src --ext ts,tsx` | 0 error（12 个既有 warning，均在 Phase 4 之外的既有文件） |
| 前端构建 | `vite build` | 成功 |
| 前端回归 | `node node_modules/@playwright/test/cli.js test` | **21 passed**（export 1 + phase2 6 + phase3 6 + phase4 8） |
| 浏览器侧断言 | phase4 harness | **267 条检查全过**，0 页面错误（floor 已是精确值） |
| 后端回归 | `pytest -q` | **127 passed**（基线 117 + P4 新增 10） |
| 迁移链 | `alembic heads` | 单一 head `c1f7a4b9e2d3` |
| 迁移幂等 | 开发库副本 upgrade×2 → downgrade → upgrade | 快照逐表一致（IDENTICAL）；`meta='{}'` 不被改写成 NULL |
| 回滚精度 | 合成旧库 upgrade → 手工改 kind/scope/characterId → downgrade | 用户改过的值全部保留；只有本次写入的值被撤销（`test_downgrade_preserves_user_edits`） |
| 只读复核 | 开发库只读扫描 | worldview_configs 0 行；politics 5 行全 `kind=polity`；`treaty_between` 0 行 |
| 交互复核 | 真实浏览器鼠标（Edge） | 版图节点 / 边卡 / 关系层勾选可点（pointer capture 只在空白起点或位移超阈值后生效） |

### 7.2 明确未实现（已从验收勾选中移除，转交 Phase 5/6 或单独立项）

- 沙盘档的**时间滑杆 / 时点快照 / 区间对比 / 沿革播放**（§5.6、§8.4）未实现；沿革的时间范围筛选已可用，但未与 HistoryView 做缩放平移双向同步。
- **画布拖拽建边 / 批量建边（多选 + R）**（§5.1.5、§5.3）未实现：画布只做 pan / 框选（框选只高亮与计数），建边统一走详情页与 LinkPanel 的选择器。
- **命令面板 `Ctrl/Cmd+K`**（§5.1.3）未实现；条约簿入口保留在顶栏与关系层图例。
- 名录里的**跨模块引用改写**入口未提供（引用改写统一走聚焦详情的选择器）。
- 政权的「+ 组织 / + 人物 / + 条约」采用「创建后补写归属边」，未在表单内预填（`PoliticsFormModalProps` 无 preset 参数）。
- 表单内的 `@` 行内引用未开启（只读备注与边卡已支持）：共享 Modal 的 Esc 监听会连带关闭嵌套选择器，需要在表单内先落地捕获阶段拦截再开启。
- `ModuleConfig` 无「条约类型 / 政体」注册表键，二者目前是用户自由文本；共享面板的 status 不写 `isTerminal`（政治表单内的内联新建会写）。
- 组织树以 `subordinate_to` 边为唯一真源；`parent_id` 仍被读取侧兼容（`children`）但政治写路径不写它，导入数据里的 `parent_id` 子树只读展示。
- 历史 / 经济 / 种族 / 体系模块为空时政治侧只显示「无引用」，不做跨模块聚合统计。

---

## 8. 风险、兼容与回滚

- P1 未就绪阻塞 T1/T2：不建政治私有字段；旧 `treaty_between` 数据在展示层等价转换为 `signatory_of`（一端为条约时并入缔约方，两端均为政权/组织时由条约簿提示待转换），政治侧不产生新写入。
- 人物数据分叉：D4 后政治只引用 Character；RulerEditor 与 `setRuler` 统一按 `figure.meta.characterId` + `figure -> polity` leads 边落库，不再写 `polity -> character` 这种契约外端点。
- 迁移写入的 `meta.legacy = true` 在读取侧标「旧数据」并作为只读信号；`downgrade` 只在「现值仍等于本次迁移写入的值」时回滚，用户改过的 kind / scope / characterId / legacy 一律保留。
- 画布降级按 §11.3 阈值触发（>200 政权或 >2000 边直接矩阵档，>60 政权或 >300 边折叠档），矩阵档不再计算版图聚合。
- 回滚路径：**没有 feature flag**（§8 旧稿的表述已更正）。回滚 = revert `WorldbuildingView.tsx` 的 politics 渲染分支并可删除 `PoliticsView/` 目录；迁移侧回滚 = `alembic downgrade 8a5f26a774e3`（只撤销本次写入）。

---

## 9. 完成定义 DoD

- 后端：pytest 通过；迁移 upgrade/downgrade 幂等且精确回滚；world_links 唯一写入；submodule kind/meta 可写。
      → 127 passed；`c1f7a4b9e2d3` 单一 head；upgrade×2 / downgrade / 再 upgrade 逐表一致；合成库里「用户改值后再 downgrade」保留用户值；政治只经 world_links 写边（`signatory_of` 为缔约唯一规范边）。
- 前端：TS/lint 通过；三视图、聚焦详情、LinkPanel 可用；light/dark；无 emoji。
      → `tsc --noEmit` 0 错误、eslint 0 error、`vite build` 成功；三视图 + FocusDrawer + LinkPanel 均有 DOM 断言；emoji 扫描 0 命中；Lucide 名与 light/dark 值由静态检查覆盖。
- 数据与验收：旧数据可见/可转换、新写入新结构；权重三处、无四 Tab、3 分钟路径、性能降级演练通过。
      → 267 条浏览器侧断言覆盖权重与派生；主视图恰为三个；空世界走 3 分钟路径；`atlasDegradeMode` 三档阈值与矩阵档跳过聚合均有断言；组织与人物不再有「哪里都看不到」的静默丢失路径。

---

## 10. 明确不在本阶段做的事

- 不做地图/特殊；不做世界脉络、世界设置、模块配置面板（Phase 6）。
- 不做经济/种族/体系视图；不重构 HistoryView；不实现 world_links 与 kind/meta 地基（Phase 1）。
- 不新增契约 §4 之外的 link_type；不迁移旧预设；不做模板市场、AI、协同、合并、审批流与模拟；不预置内容。
- 本轮修复不改设计文档的语义，只把 §7 中与实现不符的勾选改为真实状态，并把画布拖拽建边、命令面板等未实现项登记进 §7.2。