# Phase 6 · 全局配置与收尾 实施计划

> 上游计划：phase5_economy.md（Phase 5 DoD 通过后进入）。设计依据：worldbuilding_ui_design.md §2/§3/§4/§10；worldview_configuration_system.md 全文；cross_module_link_design.md §5/§6/§8；00_overview.md §3-§6、§8、§10。
> 只写实施计划，不写代码；设计冲突先改契约，再同步本 plan。

---

## 1. 阶段目标与范围

做：世界列表 / 切换 / 空白创建、世界设置（基础、外观、术语、历法、默认复杂度、默认模块）、备份与恢复；子模块管理器、自定义字段编辑器、模块配置面板；全局搜索、返回栈与面包屑、世界脉络（含 800 节点降级）；emoji 与默认图标清理、Lucide 统一；旧接口 / 旧模型 / 旧表退场、最终迁移与 schema_version、发布检查清单。

不做：不新增模块业务能力；不改地图与特殊界面；不做协作、权限、分享、模板与配置市场、版本历史、回收站、AI 生成；不新增契约第 4 节之外的 link_type；不删除用户世界数据，只删被替代的系统旧表与旧接口。

---

## 2. 前置依赖与进入条件

上游：P0 的 D1（world_links 取代旧关系表）、D2（WorldTemplate 到 World）、D5（旧实例 / 旧世界观迁移与删表）、D7（worlds / links 独立 router）定论；P1 数据地基与 links、导出导入、schema_version；P2 容器、onNavigateToEntity、EntityPicker、LinkPanel、ComplexitySwitcher；P3-P5 五模块走新 API 与 LinkPanel，经济旧组件停写。

进入条件（全部满足才开工）：

- [ ] Phase 5 DoD 通过，经济旧组件不再写入。
- [ ] 前端不存在 /templates、/instances、/worldviews 调用。
- [ ] 导出导入完成一次真实数据演练。
- [ ] 关系写入只剩 world_links，bidirectional_relations 已停写。

---

## 3. 指导文档（精确到章节）

| 文档 | 章节 | 用途 |
|---|---|---|
| worldbuilding_ui_design.md | §2.1-§2.6、§3.1-§3.6 | 信息架构、全局搜索与跨模块导航、世界生命周期 |
| 同上 | §4.1-§4.7、§10.1-§10.4 | 子模块 / 字段 / 模块配置框架、前端与 API 结构、迁移边界 |
| worldview_configuration_system.md | 二至七 | 配置层级、世界级与模块级配置、界面与校验、存储备份 |
| cross_module_link_design.md | §5、§6、§8 | LinkPanel 与世界脉络、无 emoji 与 Lucide 规范、旧到新迁移映射 |
| 00_overview.md / AGENTS.md | §3-§6、§8、§10 / 工程纪律 | 命名、10 节模板、DoD、风险、D1-D7；迁移幂等与 lint |

---

## 4. 现状与改动面（真实代码路径）

| 路径 | 本阶段改动 |
|---|---|
| backend/app/models/worldbuilding.py | 删除 WorldTemplate、WorldInstance、CustomWorldviewConfig 与 template_id 残留，保留 World、WorldModule、WorldSubmodule、WorldModuleItem |
| backend/app/api/v1/worldbuilding.py | 删除 templates / instances / worldviews 旧路由与兼容转发；新资源已按 D7 拆至 worlds / links router |
| backend/app/schemas/worldbuilding.py | 删旧模板 / 实例 / 世界观 schema；导出导入增加 schema_version |
| backend/app/models/relation.py、services/relation_service.py、api/v1/relations.py | 按 D1 停写 bidirectional_relations，world_links 成为唯一关系来源，T11 删表 |
| backend/migrations/versions/ | 新增线性迁移删除旧表，不改已发布迁移，配校验脚本 |
| frontend/src/components/Worldbuilding/WorldbuildingView.tsx | 接入世界切换、设置 / 搜索 / 世界脉络入口、返回栈与面包屑、详情抽屉 |
| frontend/src/components/Worldbuilding/WorldSettingsPanel.tsx | 基础 / 外观 / 术语 / 历法 / 模块 / 备份六页 |
| frontend/src/components/Worldbuilding/config/（P6 专用配置组件，区别于 P2 的 components/common/ 跨模块通用件） | SubmoduleManager、FieldSchemaEditor、ModuleConfigPanel、GlobalSearch、WorldWeb |
| frontend/src/services/worldbuildingApi.ts | 删旧方法，接 worlds、links、export / import、search |
| frontend/src/components/Worldbuilding/HistoryView/modals/ConfigModal.tsx、frontend/src/components/Worldbuilding/EconomyView/modals/ConfigModal.tsx 与各模块 config / 空状态 | 收敛为 ModuleConfigPanel 入口；图标统一 Lucide kebab-case，无 emoji；旧弹窗 T9 后删除 |

---

## 5. 任务分解表

> 产出路径前缀：前端省略 frontend/src/components/Worldbuilding/，后端省略 backend/app/，完整路径见 §4。

| Task ID | 任务 | 产出 | 上游依赖 | 规模 | 顺序 |
|---|---|---|---|---|---|
| P6-T1 | 世界列表 / 切换 / 空白创建 + 世界设置面板 | WorldbuildingView.tsx、WorldSettingsPanel.tsx | P1 worlds API、P2 容器 | M | 1 |
| P6-T2 | 备份与恢复（导出、校验、两种恢复模式、导入报告） | WorldSettingsPanel 备份页、services/worldbuildingApi.ts | P6-T1、P1 export / import | M | 2 |
| P6-T3 | 子模块管理器（CRUD、拖拽、层级、kind、图标、颜色、删除影响） | common/SubmoduleManager.tsx | P1 submodule API、P2 通用件 | M | 2 |
| P6-T4 | 自定义字段编辑器（类型、属性、复杂度可见性、归档恢复） | common/FieldSchemaEditor.tsx | P6-T3 | M | 3 |
| P6-T5 | 模块配置面板（类型、等级、状态、关联类型、展示、术语） | common/ModuleConfigPanel.tsx | P6-T3、T4、P5 | L | 4 |
| P6-T6 | 全局搜索（Ctrl/Cmd + K、限定符、最近记录、跳详情） | common/GlobalSearch.tsx、services/worldbuildingApi.ts | P1 / P2、P6-T1 | M | 4 |
| P6-T7 | 跨模块返回栈与面包屑 | WorldbuildingView.tsx | P2 onNavigateToEntity | S | 3 |
| P6-T8 | 世界脉络只读图 + 800 节点降级 | common/WorldWeb.tsx | P6-T7、P1 links counts API | M | 5 |
| P6-T9 | emoji 与默认图标清理、Lucide 统一 | 两处 ConfigModal、各模块 config、空状态 | P3-P5、P6-T5 | M | 5 |
| P6-T10 | 旧接口 / 旧模型 / 旧表退场（冻结到删除） | 后端 models / api / schemas、services/worldbuildingApi.ts、新迁移 | 全模块切换、D1 / D2 / D5 / D7 | L | 6 |
| P6-T11 | 最终迁移与数据校验、schema_version | migrations/versions/、校验报告 | P6-T10 | M | 7 |
| P6-T12 | 设计文档一致性 + 发布检查清单 | 本 plan 勾选、契约 §8 对照记录 | P6-T1 至 P6-T11 | S | 8 |

说明：T9 依赖 T5，T10 最后启动。

---

## 6. 数据 / API / 组件变更清单

数据：World.settings 存 palette、accent、texture、radius、terminology、calendar、complexity、defaultModule；WorldModule.config 存 entityTypes、levels、statuses、fieldSchema、linkTypes、terminology、displayMode、defaultComplexity、palette；导出 JSON 增加 schema_version，导入按版本迁移且未知字段保留；T11 删除 world_templates、world_instances、worldview_configs，bidirectional_relations 按 D1 在 T10 停写、T11 删除；旧 emoji 图标映射为 Lucide，无法映射回退 `shapes`。

API：保留 /worlds、/worlds/{world_id}、/worlds/{world_id}/modules、/modules/{module_id}/submodules、/items/{item_id}、/worlds/{world_id}/links、/worlds/{world_id}/links/counts、/worlds/{world_id}/export、/worlds/import；兼容窗口内 /templates、/instances、/worldviews 只读，写请求 410，窗口结束删除；搜索 MVP 客户端过滤，超 5000 实体再评估后端搜索；OpenAPI 变更后执行 npm run gen:types。

组件：WorldbuildingView.tsx 承担头部、世界切换、设置 / 搜索 / 世界脉络入口、返回栈与面包屑、详情抽屉；Worldbuilding/config/ 新增 SubmoduleManager、FieldSchemaEditor、ModuleConfigPanel、GlobalSearch、WorldWeb，复用 EntityPicker、LinkPanel、ComplexitySwitcher；旧 ConfigModal 收敛后删除；跳转统一 onNavigateToEntity(EntityRef)，不新增契约外 link_type。

---

## 7. 测试与验收清单（可勾选）

后端：

- [ ] worlds CRUD / 切换 / 删除；导出导入往返、id 映射与失效引用报告正确。
- [ ] 兼容窗口旧接口只读、写 410，下架后 404；grep 无旧模型与旧路由残留。
- [ ] 迁移 upgrade / downgrade 幂等、旧表无外键残留；迁移前后实体与关联数对账，抽样 10 个世界，schema_version 正确。

前端：

- [ ] 世界列表 / 切换 / 空白创建 / 世界设置 / 备份恢复在 light 与 dark 下可用。
- [ ] 子模块管理器、字段编辑器、模块配置面板与术语替换可用；搜索限定符、返回栈状态恢复、世界脉络 800 节点降级到模块矩阵 + 推荐关联且只读。
- [ ] tsc 与 eslint 通过，无 emoji，图标全为 Lucide kebab-case。

文档与发布：

- [ ] 契约 §8 映射核对；发布检查清单归档；schema_version 写入发布说明。

---

## 8. 风险、兼容与回滚

- 删表不可逆：T11 前导出全量世界备份并保留数据库副本；回滚只能从备份恢复，downgrade 仅重建空表。
- 兼容窗口：旧 API 只读保留一个发布周期，以窗口内旧 API 调用为 0 作为下线门槛；/templates 写请求在 P2 完成后关闭，读转发保留至 T11。发现漏迁可继续回填，不提前删表。
- 关系与顺序：严禁同时写 bidirectional_relations 与 world_links，D1 未拍板不启动 T10；先前端 API 清理、后删后端路由，避免 gen:types 编译失败。
- 性能与基线：世界脉络超 800 节点自动降级且不可编辑；术语冲突模块级优先且不改 id；开工前先补冒烟测试再执行 T10/T11。

---

## 9. 完成定义 DoD

- 00_overview §5 通用 DoD 全部满足；P6-T1 至 P6-T12 完成并勾选。
- 旧接口 / 模型 / 表退场，grep 干净，world_links 唯一关系来源；空白创建到备份恢复全链路可重复。
- 无 emoji、图标 Lucide、link_type 不超契约第 4 节；地图与特殊未动；发布检查清单签署，schema_version 归档。

---

## 10. 明确不在本阶段做的事

1. 不新增模块业务能力，不重做 Phase 3-5 视图。
2. 不改地图与特殊界面的 UI 与数据。
3. 不做协作、权限、分享、模板 / 配置市场、跨世界配置同步、项目级配置模板与 AI 生成。
4. 不做世界版本历史、回收站与完整回滚（仅保留最近一次配置快照）；不重构应用级 Character。
5. 不新增契约第 4 节之外的 link_type。
6. 不删除用户世界数据，只删被替代的系统旧表与旧接口。
