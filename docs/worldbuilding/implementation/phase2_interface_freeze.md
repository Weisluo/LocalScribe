# Phase 2 共用件接口冻结记录（P2-T1/T2/T5 产出）

> 依 phase2_frontend_history.md §6 与 cross_module_link_design.md §4/§5。
> 冻结后 P3-P5 可并行开发，改动接口必须先改本文件。
> 冻结版本：v1（Phase 2 实施期）。落点见各节文件路径。

---

## 1. 类型口径（P2-T1）

- 契约类型全部来自 OpenAPI 生成（`npm run gen:types`），落点 `frontend/src/services/worldbuildingApi.ts`：
  `World`、`WorldWithModules`、`WorldCreatePayload`、`WorldUpdatePayload`、`WorldExportPayload`、
  `WorldImportPayload`、`WorldModuleDetail`、`WorldLink`、`WorldLinkCreate`、`WorldLinkUpdate`、
  `WorldLinkCounts`、`LinkTypeDef`、`EntityRef`、`WorldModuleV2`、`SubmoduleV2`、`ModuleItemV2`。
- 三个字段名口径（契约名 vs API 名，以 API 为准）：

  | 契约文档 | OpenAPI/响应字段 | 前端使用 |
  |---|---|---|
  | `reverseLabel` | `reverse_label` | `reverse_label` |
  | `WorldLink.time` | `time` (`LinkTimeRange`) | `time` |
  | `WorldModule.world_id` | `world_id`（另有兼容别名 `template_id`） | `world_id` |

- `ComplexityLevel = 'sketch' | 'structure' | 'sandbox'` 按契约手写：OpenAPI 里同名 schema 是
  旧模板时代的三档枚举（simple/complex/highly_complex），与契约 §2.6 无关，故不复用生成类型。
- 遗留问题 L3 口径：`LinkTypeDef.source/target` 是 `EntityRef[]` 且 `id` 恒为 `"*"`，
  仅用于表达 `(module, kind)` 约束。**前端一律忽略 `id`**，只读 `module`/`kind`。
- 遗留问题 L4 口径：`WorldImport.world` 复用响应模型（`created_at/updated_at` 必填）。
  前端只回传本应用导出的**完整**备份文件（`WorldExport` 结构），不裁剪、不手写。
- 领域类型与纯函数落点 `frontend/src/components/Worldbuilding/types.ts`：
  `refKey`、`sameRef`、`submoduleToRef`、`characterToRef`、`splitLinks`、`linkDisplayLabel`、
  `linkCounterpart`、`groupLinksByModule`、`parseInlineTokens`、`buildInlineToken`、
  `isMigrationContainer`、`moduleLabel`、`kindLabel`、`moduleBadgeClass`、`INVALID_BADGE_CLASS`、
  `SKETCH_DEFAULT_LINK_TYPE`。

## 2. queryKey 与 hooks（P2-T1）

统一形状 `['worldbuilding', 资源, 作用域]`，落点 `Worldbuilding/hooks/worldQueryKeys.ts`：

```ts
worldbuildingKeys.worlds(projectId?)            // ['worldbuilding','worlds', projectId|'all']
worldbuildingKeys.world(worldId?, includeItems = true)
                                                // ['worldbuilding','world', worldId|'none', includeItems]
worldbuildingKeys.worldRoot                     // ['worldbuilding','world'] 失效前缀（不关心 includeItems）
worldbuildingKeys.entities(worldId?)            // ['worldbuilding','entities', worldId]
worldbuildingKeys.linkRegistry()                // ['worldbuilding','link-registry']
worldbuildingKeys.links(worldId?, scope?)       // ['worldbuilding','links', worldId, scopeKey]
worldbuildingKeys.linkCounts(worldId?)          // ['worldbuilding','links','counts', worldId]
worldbuildingKeys.migrationContainer(projectId?)// ['worldbuilding','migration-container', projectId]
worldbuildingKeys.submodules(moduleId?)         // 旧接口兼容，保持原状
worldbuildingKeys.items(moduleId?, submoduleId?) // 旧三段形状 ['worldbuilding','items',moduleId]，
                                                // 仅显式给 submoduleId 时才追加第四段
```

`LinkQueryScope`（TS 侧）用 camelCase（`module/entityId/linkType/targetModule/skip/limit`），
`useWorldLinks` 内部映射成后端 snake_case 查询参数；**不要把 scope 原样透传**，否则 FastAPI 会忽略未知参数、过滤静默失效。

hooks 落点与签名（`Worldbuilding/hooks/`）：

```ts
// useWorldData.ts
useWorlds(projectId?)                                   => UseQueryResult<World[]>
useWorld(worldId?, { includeItems = true, enabled = true }) => UseQueryResult<WorldWithModules>
useLinkRegistry()                                       => UseQueryResult<LinkTypeDef[]>
toRegistryMap(definitions?)                             => Map<string, LinkTypeDef>
useCreateWorld() / useUpdateWorld(worldId?) / useDeleteWorld() / useImportWorld()
useWorldBackup() => { downloadBackup(worldId, filename?), restoreBackup(file, projectId?), isImporting }

// useLinks.ts
useWorldLinks(worldId?, scope?: LinkQueryScope)         => UseQueryResult<WorldLink[]>
useEntityLinks(worldId?, entity?: EntityRef, { enabled?, linkType? })
  => { links, outgoing, incoming, isLoading, isError }
useLinkCounts(worldId?)                                 => UseQueryResult<WorldLinkCounts[]>
invalidateLinkData(queryClient, worldId?)
useCreateWorldLink(worldId?) / useCreateWorldLinks(worldId?)
useUpdateWorldLink(worldId?) / useDeleteWorldLink(worldId?)

// useEntityRefs.ts  （T2）
useEntityRefs(worldId?, projectId?) => {
  lookup(ref?) => EntityIndexEntry | undefined;
  resolveName(ref?) => string;          // 未命中回退 id 短号
  isInvalid(ref?) => boolean;
  byModule: Map<string, EntityIndexEntry[]>;
  entries: EntityIndexEntry[];
  isLoading: boolean;
}
useEntityIndex = useEntityRefs          // 兼容别名
EntityIndexEntry = { ref, name, module, kind, moduleName, parentId? }
shortRefId(id) => string
```

- 计数与关联：`counts` 与 `links` 共用 `'worldbuilding','links'` 前缀，整批失效；
  **禁止逐卡请求**（phase2 §6）。因此 LinkPanel / CharacterReference / `useEntityLinkCounts` 一律读
  **世界级共享列表** `useWorldLinks(worldId)`（key 的 scope 为 `'all'`），再用 `splitLinks` /
  link_type 过滤在本地归并；禁止为单个实体新建 query（`useEntityLinks` 仍导出，供 P3-P5 单实体场景使用）。
- mutation 只失效相关 key；`invalidateLinkData` 统一失效 links 全 scope + counts +
  `worlds` 列表 + `worldRoot`（世界列表/详情里的 `link_count` 徽章依赖后两者）。
- 旧接口 key（`submodules`/`items`）保持原形状，历史模块读取路径不变（回归保护）。

## 3. 共用件冻结接口（P2-T2/T3/T4/T5/T8）

落点 `frontend/src/components/common/`，共 5 个：`EntityBadge`、`EntityPicker`、`LinkPanel`、
`ComplexitySwitcher`、`InlineReference`，均为**目录 + index.ts**（与 `common/CardCarousel/` 同构）。

### 3.1 ComplexitySwitcher（已实现）

```ts
ComplexityLevel = 'sketch' | 'structure' | 'sandbox'
ComplexityCapabilities = {
  linkCounts; inlineReference; linkPanel; linkPicker; simpleLinkAdd;
  linkTimeline; linkMeta; canvas; worldWeb: boolean
}
COMPLEXITY_CAPABILITIES: Record<ComplexityLevel, ComplexityCapabilities>
normalizeComplexity(value?: string | null): ComplexityLevel

<ComplexityProvider defaultLevel?={World.settings.complexity} value? onChange?>
useComplexity(): { level, setLevel, capabilities, can(feature) }   // 无 Provider 退化为 sketch

<ComplexitySwitcher value onChange capabilities? className? disabled? />
```

能力矩阵（契约 §5.5）：sketch = linkCounts + inlineReference + simpleLinkAdd；
structure 追加 linkPanel + linkPicker + canvas；sandbox 追加 linkTimeline + linkMeta + worldWeb。
**只控制披露，不删除数据。**

### 3.2 EntityBadge（已实现）

```ts
<EntityBadge
  entityRef: EntityRef          // 契约写作 `ref`；React 18 中 ref 为保留 prop，冻结为 entityRef
  name?: string                 // 已解析显示名；缺省显示 id 短号（复用 useEntityRefs.shortRefId）
  size?: 'sm' | 'md'            // 默认 sm
  showKind?: boolean            // 默认 true
  showModule?: boolean          // 默认 false
  invalid?: boolean             // 失效引用：警示样式 + 提示
  onClick?: (ref: EntityRef) => void
  className? title?
/>
```
纯展示组件，**不自带数据请求**：名称与失效态由父组件用 `useEntityRefs` 解析后传入。

### 3.3 EntityPicker（P2-T3 实现）

```ts
EntityPickerSelection = {
  targets: EntityRef[];
  linkType: string;             // 只允许契约 §4 的 id
  label?: string;
  note?: string;
  time?: { start?: string; end?: string };
  meta?: Record<string, unknown>;
}

<EntityPicker
  open: boolean
  worldId: string
  source: EntityRef             // 关联源；用于排除自身与过滤合法 link_type
  presetModule?: string         // 步骤一默认模块
  kindFilter?: string[]         // 步骤二 kind 过滤
  multi?: boolean               // 多选批量创建同类型关联
  excludeRefs?: EntityRef[]     // 已存在的对端，避免重复
  simpleMode?: boolean          // sketch 简化流程：跳过类型选择，默认 SKETCH_DEFAULT_LINK_TYPE
  onClose: () => void
  onConfirm: (selection: EntityPickerSelection) => void
  isSubmitting?: boolean
/>
```
流程：模块 → 实体（搜索/kind 过滤）→ 关联类型（按源/目标 kind 过滤 registry）→ 可选 meta/time → 保存。
键盘可用（Esc 关闭、方向上/下移动、Enter 选中），地图/特殊未接入时隐藏。
键盘事件统一挂在**步骤容器**上（搜索框自动聚焦，与 `listbox` 是兄弟节点），
选项按钮同时用 `onFocus` 同步高亮，保证「方向键 + Enter」与焦点一致。

### 3.4 LinkPanel（P2-T4 实现）

```ts
<LinkPanel
  worldId: string
  entity: EntityRef
  complexity?: ComplexityLevel        // 缺省读 useComplexity()
  onNavigate?: (ref: EntityRef) => void
  title?: string                      // 默认「关联」
  defaultCollapsed?: boolean
  className?: string
/>
```
- 顶部「关联 / 出链 n / 入链 n」；按对端模块分组（`groupLinksByModule`），组内按 link_type 排序。
- 行显示：类型标签（入链用 `reverse_label`）、对端名、kind 徽章、`time` 范围、`note` 摘要。
- 出链可删可改（`label`/`note`/`time`/`meta`），入链**只读**，可跳转到源实体。
- 失效引用渲染失效 chip，并提供一键清理（删除该 link）。
- 添加关联走 EntityPicker；sketch 档用 `simpleMode` + `SKETCH_DEFAULT_LINK_TYPE`。
- 自身请求：世界级共享 `useWorldLinks(worldId)` + `useLinkRegistry` + `useEntityRefs`；
  出/入链用 `splitLinks` 在本地归并（**不为单个实体新建 query**），计数不用额外请求；
  折叠态仍显示出/入链计数（折叠只控制披露）。
- 批量创建部分失败时只累计失败项、不抛出：已成功的关联照常失效缓存，选择器保留便于重试。

### 3.5 InlineReference（P2-T8 实现）

```ts
<InlineReference
  value: string                     // 正文，token 形态 [[module:kind:id|显示名]]
  onChange?: (value: string) => void
  worldId?: string
  projectId?: string
  readOnly?: boolean                // 渲染模式：chip 只读
  multiline?: boolean               // 默认 true（textarea）
  onNavigate?: (ref: EntityRef) => void
  placeholder?: string
  className?: string
/>
```
- 输入 `@` 打开 EntityPicker；插入 token 只存 id，显示名实时解析。
- chip 可点击跳转、hover 预览；目标不存在 → 失效 chip（警示色 + 提示），仅渲染不阻塞保存。
- 不占关联类型、不计计数、不进世界脉络（契约 §5.3）。
- 解析/构造用 `parseInlineTokens` / `buildInlineToken`。

### 3.6 集成期裁决（实现约定，签名不变）

1. **sketch 档 LinkPanel 默认收起**：`collapsed = defaultCollapsed ?? !capabilities.linkPanel`。
   契约 §5.5 规定 sketch 只显示关联计数与行内引用，因此 sketch 下默认收起，但
   「添加关联」入口必须仍然可见可点；structure/sandbox 默认展开。
2. **projectId 派生**：LinkPanel / EntityPicker / InlineReference 的冻结签名不含 `projectId`，
   组件内用 `useWorld(worldId).data?.project_id` 取得后传给 `useEntityRefs`。
   这与 `useEntityRefs` 内部是**同一个** queryKey（`worldbuildingKeys.world(worldId)`），
   不产生额外请求；否则角色实体会被误判为失效引用。
3. **InlineReference 复用 EntityPicker 的哨兵 source**：冻结 §3.5 无 `source` 而 §3.3 必填，
   故用哨兵 `{ module: 'special', kind: 'custom', id: '__inline_reference__' }` + `simpleMode`。
   行内引用不落 WorldLink，哨兵不会被写入任何数据；后续如需调整应先改本节。
4. **P2 不做的收尾**：`EntityPickerSelection.meta` 只有类型、无 UI（强度/流量属 sandbox，
   冻结签名未传 complexity）；`time` 仅在非 simpleMode 下显示。
5. **失效引用的双向清理**：有效入链保持只读（契约 §5.1），但**失效**入链允许「清理」（删除该 link），
   否则失效数据没有出口；实现落点 `LinkPanel.renderRow` 的 `editable || invalid`。
6. **`isInvalid` 与加载态**：`useEntityRefs.isInvalid` 在索引未就绪（world/characters 查询中）时返回
   `false`，且 LinkPanel 的分组渲染同时 gate `linksLoading || entityRefs.isLoading`，
   避免冷缓存下把有效对端渲染成「已失效」并给出删除入口。

## 4. 历史纵切接口（P2-T9/T10，owner: history 流）
```ts
// HistoryView/types.ts
HistoryViewProps = {
  moduleId: string;
  projectId: string;
  worldId?: string;                            // 新增：WorldLink 作用域
  highlightRef?: EntityRef | null;             // 新增：统一导航落点（自动切所属时代并高亮）
  onNavigateToCharacter?: (characterId: string) => void;
  onNavigateToEntity?: (ref: EntityRef) => void;  // 新增：统一导航
}

EventCardProps        += { worldId?: string; isHighlighted?: boolean;
                           onNavigateToEntity?: (ref: EntityRef) => void }
EraContentPanelProps  += { worldId?: string; highlightedEventId?: string;
                           onNavigateToEntity?: (ref: EntityRef) => void }
CharacterReferenceProps = {
  eventId: string;                 // event/era submodule id
  eventKind: 'event' | 'era';      // 新增：决定 WorldLink source.kind
  worldId: string;                 // 新增
  projectId: string;
  isHovered?: boolean;
  onNavigateToCharacter?: (characterId: string) => void;
  // 旧 _char_ref 只读展示所需（双读窗口），不再有写入回调；moduleId 已移除（组件不再使用）
  eventItems?: EventItem[];
}
```

- 人物关联读写全部切到 `history.involves`：
  `source = { module: 'history', kind: eventKind, id: eventId }`，
  `target = { module: 'character', kind: 'character', id: charId }`，
  顺序写 `meta.order`，备注写 `meta.note`（或 link.note）。
- 展示顺序（"顺序不丢"的实现口径）：P1-MIG-06 回填链带 `meta.legacyItemId`，先按该 id 在
  `eventItems` 中的下标排序；其余按 `meta.order`；再用 `created_at`/`id` 兜底；旧 `_char_ref`
  独有的人选追加在末尾。**不要只按 `meta.order` 排序**——回填链没有该键，会退化成按 uuid 排序。
- 旧 `_char_ref` / `_char_link` 只读展示、顺序不丢，**不再新写**（phase2 §7/§8）。
- 数据源同样是世界级共享列表：`useWorldLinks(worldId)` 后按 `link_type === 'history.involves'`
  本地过滤 + `splitLinks`（禁止逐卡请求）。
- EventCard / EraContentPanel 接入 `<LinkPanel>` 与 `useEntityLinkCounts` 计数徽章。
- 插入位：`EventCard.tsx`（items 区之后、`z-10` 包裹内，即现有 CharacterReference 槽位）；
  `EraContentPanel.tsx`（时间轴+事件行之后、staggerChildren 容器之外）。
- 高亮落点：`EventCard` 根节点带 `data-event-id`，命中 `highlightRef` 时加高亮环；
  HistoryView 自动把 `activeEraId` 切到目标事件所属时代并滚动定位。历史分支有自己的滚动容器，
  WorldbuildingView 通用模块分支的 scrollTop 恢复不适用于历史 tab。

## 5. 世界视图与迁移容器接口（P2-T6/T7/T13，owner: world 流）

```ts
// WorldbuildingView 对外 props 保持不变（EditorPage 零改动）
WorldbuildingView = ({ onNavigateToCharacter }: { onNavigateToCharacter?: (characterId: string) => void })
```

- 世界列表/创建走 `useWorlds` / `useCreateWorld`（`POST /worlds` 服务端已补齐七模块），
  **删除** `TAB_ORDER.map(createModule)` 的手工建模块代码（phase2 §11.1 L1）。
- 模块读取走 `useWorld(worldId)`（一次拿到 submodules+items），旧 `/modules/*` 写路径不变。
- 列表徽章复用响应里的 `module_count` / `link_count` + `useLinkCounts(worldId)`，不逐卡请求。
- 头部注入 `ComplexityProvider` + `ComplexitySwitcher`；缺省档取 `World.settings.complexity`。
- 返回栈：`Worldbuilding/navigation/backStack.ts`（纯函数栈，可单测）+
  `onNavigateToEntity(ref)` 统一入口；角色仍走 `onNavigateToCharacter`（EditorPage 回调）。
- `Worldbuilding/hooks/useMigrationLinks.ts`：

```ts
useMigrationLinks(projectId?) => {
  container?: World;               // settings.migrationContainer === true
  containerLinks: WorldLink[];     // GET /worlds/{container.id}/links
  linkCount: number;               // max(容器 link_count, 容器内 links 条数)：入口与数字同一口径
  hasEntryPoint: boolean;          // 容器存在且 linkCount > 0（P2-T13 入口条件）
  isLoading: boolean;
}
useMoveWorldLink()   // POST /links/{id}/move
useMoveWorldLinks()  // POST /worlds/{id}/links/move
```
queryKey 固定 `['worldbuilding','migration-container', projectId]`；容器世界列表与容器 links 同一 key 派生。

```ts
<MigrationContainerPanel
  worldId: string          // 容器世界 id
  projectId: string
  onNavigate?: (ref: EntityRef) => void
  onResolved?: () => void  // 归位后回调（失效缓存/收起面板）
/>
```

- 409 必须按 `code` 分流：只有 `duplicate_link`（目标世界已有等价边）才展示
  「改用已有边并删除容器边」；`endpoint_world_conflict`（两端分属不同世界）没有替代边，
  只能提示「在顶部指定目标世界」，**不得**给出删除动作（否则丢数据）。
- 批量 `invalid` 按 `code` 分档提示（`not_in_world` / `already_in_target` /
  `endpoint_world_conflict` / `unresolvable_endpoint` / `character_world_ambiguous`），
  不再统一说成「端点已失效」。

## 6. 后端新增接口（P2-T12，owner: backend 流）

- `POST /api/v1/worldbuilding/links/{link_id}/move`，body `{ "world_id"?: string }`
  → `WorldLinkResponse`；省略 `world_id` 时按端点所属世界推导（`source/target_id -> module_id -> world_id`，
  另含 `characters`：角色按 project 唯一世界解析，多世界则要求显式指定）；
  跨项目 400；端点分属不同世界且未显式指定 409（detail 为
  `{"code":"endpoint_world_conflict","message":...}`）；目标世界已有等价边 409
  （detail 为 `{"code":"duplicate_link","message":...,"existing_id":...}`）；
  成功时改 `world_id`、`meta` 保留并追加 `reclassifiedFrom` / `reclassifiedAt`
  （非 dict 的原 `meta` 保留到 `meta.legacyMeta`，不丢数据）。
- `POST /api/v1/worldbuilding/worlds/{world_id}/links/move`，
  body `{ "link_ids": string[], "target_world_id"?: string }`
  → `{ "moved": n, "conflicts": [...], "invalid": [...] }`，单事务，冲突项不阻塞其余项：
  - `link_ids` 入口**保序去重**；每次成功归位后 `db.flush()`，保证同批次新产生的等价边
    也能被 `find_duplicate` 看见（`database.py` 是 `autoflush=False`，不 flush 会写出重复边）。
  - `conflicts` 元素：`{"link_id","code":"duplicate_link","existing_id"}`。
  - `invalid` 元素：`{"link_id","code","reason"}`，code 取值
    `not_in_world` / `already_in_target` / `endpoint_world_conflict` /
    `unresolvable_endpoint` / `character_world_ambiguous`。
  - 契约外 `link_type` 仍是请求级 400（整体拒绝、无部分写入），但 detail 为
    `{"code":"foreign_link_type","message":...,"link_ids":[...]}`，便于前端指出具体行。
- 两个端点复用 link registry 校验与对称边去重；不写旧表；
  **不新增 GET**（容器识别复用 `GET /worlds?project_id=`，容器内列表复用 `GET /worlds/{id}/links`）。

---

## 7. 冻结纪律

1. 本文件 v1 之后的接口变更，必须先在 phase2_frontend_history.md §6 与本文件同步，再改代码。
2. 共用件只依赖 `Worldbuilding/hooks/` 与 `Worldbuilding/types.ts`，不反向依赖模块视图。
3. 不使用 `any`；不使用 emoji；图标一律 Lucide 名。
4. 新增 `link_type` 必须先在 cross_module_link_design.md §4 登记（本阶段不新增）。
