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

- [ ] Phase 3 DoD 通过，common 组件可在任意模块复用；world_links 为唯一关系写入路径，submodule kind/meta 可读写。
- [ ] `npm run gen:types` 已生成 WorldSubmodule.kind/meta、WorldLink、LinkTypeDef 等类型；政治模块可由 WorldbuildingView 创建。
- [ ] 旧数据盘点完成（worldview_configs 政治预设、politics 下 submodules/items 格式）。

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

- [ ] 权重三处成立：政权唯一大卡；组织卫星/独立势力带；人物头像条/任职带/紧凑行；条约缎带 + 次级条约簿；详情分级；LevelDef.rank 驱动尺寸与布局环。
- [ ] 无四个平级 Tab；figure 仅 characterId + 政治身份、任期在边、缔约方在边。
- [ ] 只用契约 §4 link_type 且 reverseLabel 一致；signatory_of 唯一写入、treaty_between 读取转换；LinkPanel 覆盖四类详情；@ 行内引用可用。
- [ ] 地图未接入隐藏入口；历史/经济/种族/体系为空不阻塞；3 分钟路径、拖拽建边/条约、聚焦降噪、名录编辑、沿革联动通过。
- [ ] TS/lint、pytest、迁移幂等、light/dark、无 emoji、Lucide 名、reduced-motion、超阈值降级通过。

---

## 8. 风险、兼容与回滚

- P1 未就绪阻塞 T1/T2：不建政治私有字段；treaty_between 旧数据读取去重、保存转 signatory_of，验收无新写入。
- 人物数据分叉：D4 后政治只引用 Character，旧政治人物标 legacy 只读；画布超大按 politics_ui_design §11.3 降级。
- 时间轴联动只做叠加与视口同步，不改 HistoryView；旧 generic 数据不可识别时保留只读并标警示，回填保留 legacy 原值、可重跑。
- 回滚：PoliticsView 用 feature flag 切回通用 ModuleSection。

---

## 9. 完成定义 DoD

- 后端：pytest 通过；迁移 upgrade/downgrade 幂等；world_links 唯一写入；submodule kind/meta 可写。
- 前端：TS/lint 通过；三视图、聚焦详情、LinkPanel 可用；light/dark；无 emoji。
- 数据与验收：旧数据可见可保存、新写入新结构；权重三处、无四 Tab、3 分钟路径、性能降级演练通过。

---

## 10. 明确不在本阶段做的事

- 不做地图/特殊；不做世界脉络、世界设置、模块配置面板（Phase 6）。
- 不做经济/种族/体系视图；不重构 HistoryView；不实现 world_links 与 kind/meta 地基（Phase 1）。
- 不新增契约 §4 之外的 link_type；不迁移旧预设；不做模板市场、AI、协同、合并、审批流与模拟；不预置内容、不写代码、不改设计文档与其他 plan。