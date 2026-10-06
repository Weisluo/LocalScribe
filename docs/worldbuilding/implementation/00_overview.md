# 世界观设定实现计划 · 总览与公共约定

> 本目录把实施拆成 7 个阶段（Phase 0-6），每个阶段一份独立 plan 文档。
> 设计依据：docs/worldbuilding/ 下 8 份设计文档；工程依据：AGENTS.md。
> 本目录只写实施计划，不写代码；实施时若发现设计冲突，先改 cross_module_link_design.md，再更新对应 plan。

---

## 1. 阶段地图

| 阶段 | 目标 | 主要产出 | 规模 | 前置依赖 | 计划文档 |
|------|------|----------|------|----------|----------|
| Phase 0 | 拍板关键决策与迁移策略 | ADR、迁移编号规划、兼容窗口、测试矩阵 | S | 设计文档定稿 | phase0_decisions_and_migration.md |
| Phase 1 | 数据地基 | worlds / world_modules / world_submodules / world_links、Link registry、links API | L | Phase 0 | phase1_data_foundation.md |
| Phase 2 | 前端地基 + 历史纵切 | 类型/hooks、EntityPicker、LinkPanel、HistoryView 接入 WorldLink、迁移容器归位入口 | M | Phase 1 | phase2_frontend_history.md |
| Phase 3 | 种族 + 体系 | 两个轻量模块完整 UI、自定义 kind/字段验证 | M | Phase 2 | phase3_races_systems.md |
| Phase 4 | 政治 | 权力版图、层级权重、条约边、沿革 | L | Phase 3 | phase4_politics.md |
| Phase 5 | 经济 | 三档复杂度、线路图/账册/沙盘、流量与时间 | L | Phase 4 | phase5_economy.md |
| Phase 6 | 全局配置与收尾 | 子模块/字段/模块配置、世界设置、搜索、世界脉络、旧接口下线 | L | Phase 5 | phase6_global_config_and_cleanup.md |

规模为相对估算：S 约 1-3 天，M 约 1-2 周，L 约 2-4 周，实际以任务拆分为准。

## 2. 依赖关系

```
Phase 0 决策与迁移设计
   |
   v
Phase 1 数据地基 --------------------+
   |                                  |
   v                                  v
Phase 2 前端地基 + 历史纵切      兼容层与回填脚本
   |
   v
Phase 3 种族 + 体系
   |
   v
Phase 4 政治
   |
   v
Phase 5 经济
   |
   v
Phase 6 全局配置与收尾（含旧接口/旧表下线）
```

关键路径：Phase 0 -> Phase 1 -> Phase 2 -> Phase 3 -> Phase 4 -> Phase 5 -> Phase 6。
Phase 3 与 Phase 4 之间没有强绑定，但政治需要复用种族/体系沉淀的详情抽屉与字段渲染，故排在其后。
Phase 6 的部分配置 UI 可与 Phase 3-5 并行做，但旧接口下线必须等所有模块切换完成。

## 3. 公共命名约定

### 3.1 数据库

- 表名：worlds、world_modules、world_submodules、world_module_items、world_links。
- 外键：world_modules.world_id、world_submodules.module_id、world_module_items.module_id。
- 配置：World.settings JSON、WorldModule.config JSON、WorldSubmodule.meta JSON。
- 关联：world_links 使用 source_module / source_kind / source_id 与 target_module / target_kind / target_id，
  另含 world_id、link_type、directed、label、note、meta JSON、time JSON。
- 旧表 world_templates、world_instances、worldview_configs、bidirectional_relations 按 Phase 0 的迁移策略处理。

### 3.2 API

- 统一前缀：/api/v1/worldbuilding。
- 世界：/worlds、/worlds/{world_id}、/worlds/{world_id}/export、/worlds/import。
- 模块：/worlds/{world_id}/modules、/modules/{module_id}。
- 子模块：/modules/{module_id}/submodules、/submodules/{submodule_id}。
- 条目：/modules/{module_id}/items、/items/{item_id}。
- 关联：/worlds/{world_id}/links、/links/{link_id}、/worlds/{world_id}/links/counts。
- 旧 /templates、/instances、/worldviews 仅作兼容层，Phase 6 删除。
- 前端类型来自 OpenAPI：npm run gen:types；禁止手写与后端不一致的重复类型。

### 3.3 前端

- 入口：frontend/src/components/Worldbuilding/。
- 通用件：components/common/ 下放 EntityPicker、LinkPanel、EntityBadge、ComplexitySwitcher。
- 模块目录：HistoryView/、PoliticsView/、EconomyView/、RacesView/、SystemsView/。
- API 客户端：frontend/src/services/worldbuildingApi.ts；React Query hooks 就近放在各模块 hooks/。
- 导航：统一 onNavigateToEntity(ref)，返回栈与面包屑由 WorldbuildingView 维护。

### 3.4 设计术语

- 严格使用契约术语：World、WorldModule、WorldSubmodule、kind、meta、WorldLink、EntityRef、LinkPanel、
  sketch/structure/sandbox、Lucide 图标名。
- 不得新增契约第 4 节之外的 link_type；确需新增时先更新契约并同步所有 plan。
- 地图与特殊界面本轮保持现状，只保留可选关联目标接入位。

---

## 4. 每份阶段 plan 的统一结构

1. 阶段目标与范围（做 / 不做）
2. 前置依赖与进入条件
3. 指导文档（精确到章节）
4. 现状与改动面（真实代码路径）
5. 任务分解表：Task ID、任务、产出、依赖、规模、建议顺序
6. 数据 / API / 组件变更清单
7. 测试与验收清单（可勾选）
8. 风险、兼容与回滚
9. 完成定义 DoD
10. 明确不在本阶段做的事

Task ID 规则：Phase 0-6 分别用 P0-T1、P1-T3 这类编号；跨阶段依赖必须写清上游 Task ID。
任务表可用独立的建议顺序列，也可用行序表达，同一阶段内保持一致即可。

---

## 5. 通用完成定义 DoD

- 后端：相关 pytest 通过；迁移可 upgrade/downgrade 且幂等；旧接口兼容测试通过。
- 前端：TypeScript 编译与 lint 通过；相关页面在 light/dark 下可用；无 emoji；图标均为 Lucide 名。
- 数据：老数据可见、可保存；新写入使用新结构；回填脚本可重复执行。
- 关联：link_type 不超出契约第 4 节；反向标签与契约 reverseLabel 一致。
- 边界：地图与特殊界面未被改动；未新增世界观预设内容。
- 文档：设计文档若需变更，先更新 cross_module_link_design.md，再同步本目录 plan。

---

## 6. 工程纪律（来自 AGENTS.md）

- 迁移必须用 batch_alter_table；新增列/表要做存在性检查，保证幂等。
- 不修改已发布的迁移；新增迁移基于当前 head，保持线性历史。
- 最小改动，不做未要求的重构；改动必须能追溯到阶段任务。
- 后端格式化 black/isort，lint flake8，类型 mypy；前端 eslint。
- 数据库文件不提交；测试不依赖真实 PDF 浏览器。

---

## 7. 现状基线（2026-05 代码核对）

### 7.1 后端

- models/worldbuilding.py（7.3KB）：WorldTemplate、WorldModule、WorldSubmodule、WorldModuleItem、WorldInstance、CustomWorldviewConfig。
- api/v1/worldbuilding.py（102.7KB / 2749 行）：templates、modules、submodules、items、instances、worldviews、export/import、batch 路由。
- schemas/worldbuilding.py（15.8KB）：与上述模型对应的 Pydantic 模型。
- models/relation.py（3.7KB）：BidirectionalRelation，表 bidirectional_relations，project_id 维度，source/target 各含 module/entity_type/entity_id/entity_name。
- services/relation_service.py（26.8KB）与 api/v1/relations.py（10.8KB）：已有创建、批量、按项目/实体查询、发现、统计、删除能力，路由挂在 /api/v1/relations。
- migrations/versions/ 相关迁移：c92273cf3784（worldbuilding 表）、25676bc12c35（bidirectional_relations）、063d2b67b83b（submodule parent_id）、1ab95b05f309（template project_id）、52d22dce2a59（worldview_configs）、b0ec4e485448（world 外键修复）；当前 head 为 a8f3e9c2b1d4。
- 当前没有 worldbuilding/relation 的 pytest 测试文件。

### 7.2 前端

- WorldbuildingView.tsx（55.2KB）：TAB_CONFIG 七模块、activeTab、按 module_type 创建七个模块；目前只有 history 与 economy 两个内容分支。
- HistoryView.tsx（32.3KB）及子目录：EventCard 29KB、ConfigModal 35.8KB、EraTimeline 17.5KB、config.ts 16KB、modals 完整；人物引用当前写 item.content 的 _char_ref/_char_link。
- EconomyView.tsx（36.4KB）及子目录：旧的四类实体 + 卡片 + 星级方案，需要整体替换。
- services/worldbuildingApi.ts：模板、模块、子模块、条目、实例、导入导出；无 link API，无 politics/races/systems 视图。
- 无 worldbuilding 专属 store；页面内用 React Query。

---

## 8. 全局风险与兼容策略

1. 关系系统分叉：不要同时保留 bidirectional_relations 与 world_links 两套写入路径；Phase 0 必须拍板。
2. World 重命名影响面：projects.world_templates 关系、前端 worldbuildingApi、Character/导出等；采用新旧 API 双挂一个版本。
3. 历史前缀编码：HistoryView 大量依赖 color/icon 解析；先回填 kind/meta，再逐步替换组件，期间双读。
4. 经济旧实现：不要大爆炸替换；新 EconomyView 走 feature flag，结构模式稳定后切换。
5. 102KB 的 worldbuilding API：新资源（worlds/links）拆新 router 文件，不强行重构旧文件；Phase 6 再清理。
6. 人物数据重复：统一引用全局 Character；旧政治人物数据标记为历史数据，只在迁移期兼容。
7. SQLite 迁移限制：全部 batch_alter_table + 存在性检查；回填脚本要可在空库与旧库重复执行。
8. 测试基线为零：Phase 1 先搭 pytest 夹具与迁移测试，后续阶段才有回归网。

---

## 9. 使用方式

- 实施前按顺序读：本总览 -> 对应阶段 plan -> 该阶段指导的设计文档章节 -> 相关代码现状。
- 每个实现 PR/任务在标题或描述中引用 plan 的 Task ID；完成后在 plan 中勾选验收项。
- 阶段范围变化时先改 plan，再动代码；设计冲突先改 cross_module_link_design.md。
- 阶段未通过 DoD 不进入下一阶段；Phase 3-5 可在 Phase 2 完成后做有限并行，但共用件的改动需先合并。

---

## 10. 开放决策登记（Phase 0 输出结论）

| 编号 | 决策点 | 推荐方案 | 影响阶段 | 状态 |
|------|--------|----------|----------|------|
| D1 | WorldLink 存储 | 升级 bidirectional_relations 为 world_links，复用现有 service 查询与名称缓存 | P1/P6 | 已采纳 |
| D2 | WorldTemplate -> World | 表重命名 + /worlds 新 API + 旧接口兼容一个版本 | P1/P6 | 已采纳 |
| D3 | kind/meta 与旧编码 | 迁移回填 + 双读窗口，先数据后 UI | P1/P2 | 已采纳 |
| D4 | 人物统一 | 全局 Character 为唯一数据源，政治/历史只存引用与身份 | P2/P4 | 已采纳 |
| D5 | 实例/旧世界观处置 | 只保留只读迁移入口，不迁移系统预设，Phase 6 删表 | P1/P6 | 已采纳 |
| D6 | 经济切换 | 新 EconomyView 走 feature flag，结构模式稳定后删旧组件 | P5 | 已采纳 |
| D7 | worldbuilding API 拆分 | 新增 worlds/links router 文件，旧文件只加兼容转发 | P1/P6 | 已采纳 |

Phase 0 结论（2026-10-06）：D1-D7 全部采纳，无待拍板项；ADR、迁移冻结、兼容窗口与回滚见
`phase0_decisions_and_migration.md` §5/§6/§8，旧数据盘点见 `phase0_inventory_report.md`。

---

阶段 plan 文件：

- phase0_decisions_and_migration.md
- phase1_data_foundation.md
- phase2_frontend_history.md
- phase3_races_systems.md
- phase4_politics.md
- phase5_economy.md
- phase6_global_config_and_cleanup.md

Phase 0 产出（非阶段 plan）：

- phase0_inventory_report.md
