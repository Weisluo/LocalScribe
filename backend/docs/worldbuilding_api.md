# 世界观设定 API 文档

> 契约来源：`docs/worldbuilding/cross_module_link_design.md`（数据模型与术语）、
> `docs/worldbuilding/worldbuilding_ui_design.md` §10.2（路由建议）、
> `docs/worldbuilding/implementation/phase6_global_config_and_cleanup.md`（Phase 6 退场记录）。
> 本文只描述 **Phase 6 之后**的 API 面。旧的模板 / 实例 / 世界观配置 / 批量路由已在
> Phase 6（P6-T10/T11）下线，见文末「Phase 6 已下线接口」。
> 机器可读的完整定义以运行中的实例为准：`GET /openapi.json`；前端类型由
> `cd frontend && npm run gen:types` 生成到 `src/types/api.ts`，不得手写重复定义。

---

## 1. 基础信息

- 统一前缀：`/api/v1/worldbuilding`（跨模块关联兼容层在 `/api/v1/relations`）。
- 认证：与其它 API 相同（Bearer Token）。
- 数据格式：JSON（UTF-8）；错误响应为 `{"detail": "..."}`。

### 1.1 数据层级

```
World（世界，唯一顶层容器，归属项目）
 └─ WorldModule（七个固定 module_type，config 存模块级配置）
     ├─ WorldSubmodule（可树形嵌套，kind + meta）
     │   └─ WorldModuleItem（content JSON）
     └─ WorldModuleItem
WorldLink（跨模块关联，独立存表；world_links 是唯一关系来源）
Character（应用级全局角色，被各模块按 EntityRef 引用，不在世界内复制）
```

`module_type` 固定七种：`map` / `history` / `politics` / `economy` / `races` /
`systems` / `special`。世界的七个模块在创建世界时由服务端补齐，`module_type` 不可改。

---

## 2. 世界（Worlds）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/worlds` | 世界列表；`project_id` / `name` / `skip` / `limit` 过滤，返回含 `module_count`、`link_count` |
| POST | `/worlds` | **空白世界**创建（无任何预设内容），服务端同时补齐七个空模块 |
| GET | `/worlds/{world_id}` | 世界详情；`include_modules` / `include_items` 控制是否带模块树与条目 |
| PUT | `/worlds/{world_id}` | 更新名称 / 描述 / 封面 / `project_id` / `tone` / `settings` |
| DELETE | `/worlds/{world_id}` | 删除世界（级联删除其模块、子模块、条目与关联） |
| POST | `/worlds/{world_id}/modules` | 为缺模块的历史世界补齐一个模块；同 `module_type` 已存在时 400 |
| GET | `/worlds/{world_id}/export` | 世界备份导出（见 §5） |
| POST | `/worlds/import` | 世界备份恢复（见 §5） |

### 2.1 世界级配置（`World.settings` / `World.tone`）

`tone`（契约 §2.8）：`palette`（parchment/ink/slate/custom）、`accent`、`texture`
（none/paper/grid/starfield）、`radius`（sm/md/lg）。

`settings`（契约 §2.1）为自由 JSON，前端使用的键：

- `terminology`：`{ 默认术语: 世界内称呼 }`，只影响显示，不改变 `module_type` / `kind` / `link_type`。
- `calendar`：`{ eraName, epochLabel, timeFormat, unified }`，自然语言时间按原文存储。
- `complexity`：默认复杂度 `sketch` / `structure` / `sandbox`。
- `defaultModule`：进入世界时打开的模块（默认 `history`）。
- `unknownFields`：导入时保留的未知顶层字段（备份往返不丢数据）。

未识别的键一律原样保留；服务端不做白名单裁剪。

---

## 3. 模块 / 子模块 / 条目

| 方法 | 路径 | 说明 |
|------|------|------|
| PUT | `/modules/{module_id}` | 更新模块（名称、描述、图标、排序、`config`） |
| GET | `/modules/{module_id}/submodules` | 子模块列表 |
| POST | `/modules/{module_id}/submodules` | 新建子模块（`parent_id` 表达层级） |
| PUT | `/submodules/{submodule_id}` | 更新子模块（含 `kind` / `meta` / `color` / `icon` / `parent_id`） |
| DELETE | `/submodules/{submodule_id}` | 删除子模块（级联其子级与条目） |
| GET | `/modules/{module_id}/items` | 条目列表（`submodule_id` / `include_all` 过滤） |
| POST | `/modules/{module_id}/items` | 新建条目 |
| PUT | `/items/{item_id}` | 更新条目 |
| DELETE | `/items/{item_id}` | 删除条目 |

### 3.1 模块级配置（`WorldModule.config`，契约 §2.7）

`entityTypes`（`EntityTypeDef[]`，即 kind 定义）、`levels`（`LevelDef[]`）、
`statuses`（`StatusDef[]`）、`fieldSchema`（`kind -> CustomFieldDef[]`）、
`linkTypes`（`CustomLinkTypeDef[]`，用户自定义关联类型，**只存在于世界配置里**）、
`terminology`、`displayMode`、`defaultComplexity`、`palette`。

模块专属键按模块保留，例如 races 的 `relationKinds` / `emblemPalette` / `cardFields`、
systems 的 `tierTerm` / `rankStep` / `nodeStyles` / `costFields`。

### 3.2 子模块级（`WorldSubmodule.kind` / `meta`）

`kind` 是开放词表，由用户在模块配置里维护；`meta` 存字段值（`customFields` / `tags` /
`level` / `status` / `time` / `characterId` 等契约 §2.3/§2.4 字段），未知键保留。

---

## 4. 关联（WorldLinks）

`world_links` 是**唯一**的跨模块关系来源（Phase 6 起旧 `bidirectional_relations` 已删除）。

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/link-registry` | 契约 §4 的 54 条核心关联类型注册表（只读） |
| GET | `/worlds/{world_id}/links` | 关联列表；`module` / `entity_id` / `link_type` / `target_module` / `skip` / `limit` 过滤 |
| POST | `/worlds/{world_id}/links` | 新建关联；`directed` 由注册表决定，未知类型 400，对称边重复 409 |
| GET | `/worlds/{world_id}/links/counts` | 按模块聚合的出/入/总计数（列表页批量取数，不逐卡请求） |
| POST | `/worlds/{world_id}/links/move` | 批量把关联归位到另一个世界 |
| GET | `/links/{link_id}` | 单条关联 |
| PATCH | `/links/{link_id}` | 更新 label / note / meta / time |
| DELETE | `/links/{link_id}` | 删除关联 |
| POST | `/links/{link_id}/move` | 单条关联归位 |

约束：只允许契约 §4 的 `link_type`；对称关联只存一条；删除实体默认级联其关联。

---

## 5. 备份与恢复（导出 / 导入）

### 5.1 导出

`GET /worlds/{world_id}/export` 返回：

```json
{ "schema_version": 1, "world": { }, "modules": [], "links": [] }
```

`schema_version` 是备份格式版本（当前 `1`，见 `app/schemas/worldbuilding.py` 的
`WORLD_SCHEMA_VERSION`）。未知顶层字段原样保留。

### 5.2 恢复

`POST /worlds/import`，请求体在导出结构上增加：

| 字段 | 默认 | 说明 |
|------|------|------|
| `schema_version` | 省略视为最新 | 高于当前应用支持版本 -> 400，不做部分写入 |
| `mode` | `new` | `new` = 恢复为新世界；`overwrite` = 覆盖已有世界 |
| `target_world_id` | - | `overwrite` 必填 |
| `confirm_overwrite` | `false` | 覆盖**非空**世界必须显式确认，否则 409 |
| `keep_dangling` | `true` | 端点无法解析时保留为失效引用；`false` 则丢弃该关联 |
| `project_id` / `name` | - | 覆盖目标项目 / 名称 |

响应 `WorldImportReport`：

```json
{
  "world": { },
  "mode": "new",
  "schema_version": 1,
  "entity_count": 12,
  "link_count": 7,
  "merged_duplicates": 0,
  "skipped_links": 0,
  "id_map": { "旧 id": "新 id" },
  "dangling_refs": [
    { "role": "target", "module": "history", "kind": "event", "id": "x", "link_type": "core.related_to" }
  ],
  "unknown_kinds": ["systems.custom_x"],
  "unknown_link_types": ["legacy.made_up"],
  "warnings": ["..."]
}
```

约定：

- 实体 id 一律重新分配，关联端点按 `id_map` 重映射。
- 未注册的 `link_type` 回落为 `core.related_to` 并计入 `unknown_link_types`；
  已知类型但源/目标 kind 不匹配仍然整包 400。
- `kind` 是开放词表，**不做降级改写**（设计文档同时要求「保留 kind」），可疑项只在
  `unknown_kinds` 里报告。
- `dangling_refs` 是端点不在备份里的关联，`keep_dangling=true` 时原样保留为警示引用。

---

## 6. 经济只读视图

三档复杂度（`sketch` / `structure` / `sandbox`）共用一套数据，写入一律复用 §3 的通用接口：

| 方法 | 路径 |
|------|------|
| GET | `/modules/{module_id}/economy/summary` |
| GET | `/modules/{module_id}/economy/graph` |
| GET | `/modules/{module_id}/economy/timeline` |
| GET | `/modules/{module_id}/economy/metrics` |

---

## 7. 兼容层：`/api/v1/relations`

旧关系 API 保留为 `world_links` 适配层（Phase 1 D1）：全部读写都落到 `world_links`，
不再有第二套写入路径。路由：`POST /relations`、`POST /relations/batch`、
`GET /relations/project/{project_id}`、`GET /relations/entity/{entity_id}`、
`GET /relations/discover/{entity_id}`、`GET /relations/project/{project_id}/statistics`、
`PATCH /relations/{relation_id}`、`DELETE /relations/{relation_id}`。

---

## 8. Phase 6 已下线接口（P6-T10/T11）

以下路由在 Phase 6 删除，现在返回 404；对应的模型与数据表也已移除：

| 已删除 | 原用途 | 替代 |
|--------|--------|------|
| `POST\|GET /templates`、`POST /templates/search` | 世界模板 CRUD | `POST\|GET /worlds` |
| `GET\|PUT\|DELETE /templates/{id}` | 单个模板 | `GET\|PUT\|DELETE /worlds/{id}` |
| `GET\|POST /templates/{id}/modules` | 模板模块 | `GET /worlds/{id}`、`POST /worlds/{id}/modules` |
| `GET\|POST /templates/{id}/export`、`POST /templates/import` | 模板导入导出 | `GET /worlds/{id}/export`、`POST /worlds/import` |
| `POST\|GET\|PUT\|DELETE /instances*` | 世界实例（概念取消） | 直接使用 World |
| `GET\|POST\|PUT\|DELETE /worldviews*` | 预置世界观配置（全部删除） | `WorldModule.config` / `World.settings` |
| `POST /batch/delete`、`POST /batch/order` | 无调用者的批量接口 | 逐条调用 §3 的接口 |
| `DELETE /modules/{module_id}` | 无调用者 | 模块为世界骨架，不单独删除 |

已删除的数据表：`world_instances`、`worldview_configs`、`bidirectional_relations`
（迁移 `*_wbl_p6_01_drop_legacy_tables.py`，downgrade 只重建空表）。

---

## 9. 使用示例

### 9.1 空白创建世界

```bash
curl -X POST http://localhost:8000/api/v1/worldbuilding/worlds \
  -H 'Content-Type: application/json' \
  -d '{"name":"九州志","description":"一句话描述","project_id":"<project-id>",
       "tone":{"palette":"parchment","accent":"#8B5A2B"},
       "settings":{"complexity":"sketch","defaultModule":"history"}}'
```

### 9.2 在历史模块建一个时代与事件

```bash
# 1) 取模块 id（响应里的 modules[].id，module_type=history）
curl 'http://localhost:8000/api/v1/worldbuilding/worlds/<world-id>?include_modules=true'

# 2) 建时代（kind=era）
curl -X POST http://localhost:8000/api/v1/worldbuilding/modules/<module-id>/submodules \
  -H 'Content-Type: application/json' \
  -d '{"name":"第一纪元","kind":"era","meta":{"time":{"start":"1","end":"200"}}}'

# 3) 建事件（parent_id 指向时代）
curl -X POST http://localhost:8000/api/v1/worldbuilding/modules/<module-id>/submodules \
  -H 'Content-Type: application/json' \
  -d '{"name":"大战","kind":"event","parent_id":"<era-id>"}'
```

### 9.3 建一条跨模块关联

```bash
curl -X POST http://localhost:8000/api/v1/worldbuilding/worlds/<world-id>/links \
  -H 'Content-Type: application/json' \
  -d '{"source":{"module":"history","kind":"event","id":"<event-submodule-id>"},
       "target":{"module":"politics","kind":"polity","id":"<polity-id>"},
       "link_type":"history.leads_to","note":"起因"}'
```

### 9.4 备份与恢复

```bash
curl http://localhost:8000/api/v1/worldbuilding/worlds/<world-id>/export > backup.json
curl -X POST http://localhost:8000/api/v1/worldbuilding/worlds/import \
  -H 'Content-Type: application/json' \
  --data-binary @backup.json
```

---

## 10. 设计约束（不要违反）

1. 不提供任何世界观预设内容：没有模板、模板市场、系统预设类型、预置图标与示例数据。
2. 不新增契约 §4 之外的 `link_type`；用户自定义关联只存在 `WorldModule.config.linkTypes`。
3. 界面与默认配置不使用 emoji，`icon` 字段一律 Lucide kebab-case 图标名。
4. `world_links` 是唯一关系来源，不得重新引入第二套关系写入路径。
5. 配置随世界走（`World.settings` / `WorldModule.config` / `submodule.meta` /
   `item.content` / `WorldLink.meta`），不进入任何系统级共享库。
