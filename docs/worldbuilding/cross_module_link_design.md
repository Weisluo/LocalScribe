# 世界观跨模块关联系统与全局设计规范（WorldLink Contract）

> 本文档是 docs/worldbuilding/ 下所有模块设计文档的唯一共享契约。
> 各模块文档中出现的世界、模块、子模块、实体、关联、图标、复杂度等术语与数据模型，
> 必须与本文一致；如发现契约缺口，先修订本文，再改模块文档。

---

## 0. 本轮设计的总原则

1. 去除全部预置世界观模板：不再有仙侠 / 科幻 / 西幻 / 历史 / 末世等系统预设，
   不再有 WorldTemplate、is_system_template、is_public、模板实例（WorldInstance）等概念。
2. 世界即容器：World（世界）是唯一顶层容器，归属某个项目。新建世界 = 空白世界，
   七大模块默认全部为空，内容由用户按需生长。
3. 一切子模块可自定义：子模块的名称、描述、图标、颜色、排序、层级、语义类型（kind）、
   自定义字段、状态与等级定义，均可由用户配置；系统只提供能力，不提供预设内容。
4. 模块必须互联：所有跨模块引用统一走 WorldLink（世界关联），不再使用散落在
   content 里的 map:region_001 式字符串，不再有各模块自建的多套关联结构。
5. 重要程度不平均：各模块自行定义实体层级与视觉权重（例如政治中政权 > 组织 > 人物，
   条约是关系边而非同级实体），不得把不同类型做成等权重卡片标签页。
6. 简单与复杂统一：通过统一的复杂度分层（速写 / 结构 / 沙盘）渐进式披露，
   既允许三五个字段的简单设定，也允许关系网络、流量、时间维度的复杂设定。
7. 本轮不动地图与特殊界面：地图、特殊两个界面保持现状；WorldLink 对二者只做
   可选接入设计，未接入时相关入口隐藏，不阻塞其他模块。
8. 只做设计：本轮只修改 docs/worldbuilding/ 下的设计文档，不改动前后端代码。

---

## 1. 统一术语表

| 术语 | 字段 / 标识 | 定义 |
|------|-------------|------|
| 世界 | World / world_id | 顶层容器，取代原 WorldTemplate。一个项目可有多个世界。 |
| 模块 | WorldModule / module_type | 七个固定模块：map、history、politics、economy、races、systems、special。模块类型不可增删，展示名/图标/描述可改。 |
| 子模块 | WorldSubmodule / submodule | 用户自定义的分类 / 实体 / 节点。支持树形层级（建议最多 3 层）。 |
| 条目 | WorldModuleItem / item | 挂在子模块或模块下的内容块，content 为 JSON，承载字段组、列表、长文等。 |
| 实体 | WorldEntity | 对可被关联、可被寻址对象的统称：通常是一个子模块（如政权、种族、事件），也可能是模块下的条目（如条约条款、体系能力）。 |
| 实体类型 | kind | 实体的语义类型，如 polity、organization、figure、treaty、era、event、race、subrace、system、tier、ability、resource、good、industry、market、currency、actor。用户可在模块内自定义 kind。 |
| 关联 | WorldLink / link | 两个实体之间的一条跨模块或模块内关系。统一存储、统一面板、统一图谱。 |
| 关联类型 | LinkTypeDef / link_type | 关联语义（如效忠于、发生于、生产），含方向、允许的源/目标、颜色与图标。 |
| 引用 | EntityRef | 指向某个实体的稳定地址 {module, kind, id}；显示名按 id 实时解析。 |
| 角色 | Character / character | 应用级全局人物实体（characters 表）。政治中的人物/领袖与历史中的人物均为引用，不重复建人物数据。 |
| 自定义字段 | CustomFieldDef / customFields | 用户为某个 kind 定义的扩展字段。 |
| 状态 / 等级 | StatusDef / LevelDef | 模块级或 kind 级的自定义状态、等级定义，含标签、颜色、排序权重。 |
| 复杂度 | complexity | sketch（速写）/ structure（结构）/ sandbox（沙盘）三档渐进披露。 |
| 关联总览 | World Web / 世界脉络 | 全局只读关系图，展示所有已关联实体。 |

禁用词：模板（指预置世界观时）、WorldTemplate、系统预设、世界观类型选择器、
is_system_template、is_public、模板实例。导入导出统一改称世界备份 / 世界数据迁移。

---

## 2. 数据模型（设计层）

### 2.1 World（取代 WorldTemplate）

```typescript
interface World {
  id: string;
  project_id: string;              // 归属项目
  name: string;
  description?: string;
  cover_image?: string;
  tone?: WorldTone;                // 整体视觉基调，见 2.8
  settings: WorldSettings;         // 世界观自定义配置，见配置系统文档
  created_at: string;
  updated_at: string;
}

interface WorldSettings {
  terminology?: Record<string, string>;   // 术语替换，如 国家 -> 宗门
  calendar?: { name?: string; epochLabel?: string; format?: string };
  complexity?: ComplexityLevel;           // 全局默认复杂度
  moduleConfigs?: Record<ModuleType, ModuleConfig>;
}
```

- 删除字段：tags、is_public、is_system_template、created_by，以及与模板市场/公共模板
  相关的统计字段；保留必要的实体统计但改名（如 entity_count）。
- 世界列表 = 项目下的世界列表，不展示模板市场、推荐模板、从模板创建。
- 导入导出 = 当前世界的完整 JSON 备份与恢复，用于迁移和分享自己的世界，不是模板分发。

### 2.2 WorldModule（模块）

```typescript
type ModuleType = 'map' | 'history' | 'politics' | 'economy' | 'races' | 'systems' | 'special';

interface WorldModule {
  id: string;
  world_id: string;               // 取代 template_id
  module_type: ModuleType;        // 固定七选一
  name: string;                   // 默认 历史 / 政治 / ...，用户可改
  description?: string;
  icon?: string;                  // Lucide 图标名（kebab-case）
  order_index: number;
  config: ModuleConfig;           // 取代原来的 moduleConfig 条目
  is_collapsible: boolean;
  created_at: string;
  updated_at: string;
}
```

- 七个模块始终存在，不允许删除；空模块显示引导与 创建第一个…… 入口。
- 原以 WorldModuleItem(name = moduleConfig) 存配置的方式，迁移为 WorldModule.config。
- module_type 决定模块语义与可用的 kind / LinkType 集合；config 决定该模块的展示与自定义能力。

### 2.3 WorldSubmodule（子模块 / 实体）

```typescript
interface WorldSubmodule {
  id: string;
  module_id: string;
  parent_id?: string;
  kind: string;                   // 语义类型，替代原 color 字符串前缀 hack（如 era:）
  name: string;
  description?: string;
  icon?: string;                  // Lucide 图标名
  color?: string;                 // 调色板 token 或 hex
  order_index: number;
  meta: Record<string, unknown>;  // 基础字段：level / status / time / tags / customFields 等
  created_at: string;
  updated_at: string;
}
```

- 历史模块原来的 color 前缀编码（era:ochre、type:imperial:critical）废弃，
  改为显式 kind = era 或 event，主题/事件类型/级别放入 meta。
- meta 承载轻量基础字段；长文本、可重复列表、结构化数据继续放在 WorldModuleItem.content。

### 2.4 WorldEntityBase（所有模块共用的实体外形）

```typescript
interface WorldEntityBase {
  id: string;
  module: ModuleType;
  kind: string;
  name: string;
  description?: string;
  icon?: string;                  // Lucide 图标名，不使用 emoji
  color?: string;
  cover?: string;
  order_index: number;
  parentId?: string;              // 子模块树层级
  time?: {
    start?: string;               // 世界内时间文本或标准时间
    end?: string;
    display?: string;             // 自定义展示，如 第三纪元初
  };
  status?: string;                // StatusDef.id
  level?: string;                 // LevelDef.id，语义由模块自行定义
  tags?: string[];
  customFields?: Record<string, CustomFieldValue>;
}
```

- 各模块自行定义 level 的语义与视觉权重，不存在全局统一的四类实体。
- 模块内可自定义 kind；kind 映射到 EntityTypeDef，声明该类型的图标、颜色、默认字段。

### 2.5 WorldLink（世界关联）

```typescript
interface WorldLink {
  id: string;
  world_id: string;
  source: EntityRef;              // { module, kind, id }
  target: EntityRef;
  link_type: string;              // LinkTypeDef.id
  label?: string;                 // 覆盖默认标签（自定义关联必填）
  directed: boolean;              // 由 LinkTypeDef 决定，落库时冗余便于查询
  note?: string;
  meta?: Record<string, unknown>; // 如强度、流量、条款摘要
  time?: { start?: string; end?: string };
  created_at: string;
  updated_at: string;
}

interface EntityRef {
  module: ModuleType | 'character';
  kind: string;
  id: string;
}
```

存储与查询约定：

- 关联独立存表（world_links），不再写进 WorldModuleItem.content。
- 对称关联只存一条；查询反向关系时按 link_type.directed = false 双向匹配。
- 非对称关联存一条有向边；反向展示使用 reverseLabel（如 附庸于 对应 宗主）。
- 索引：(world_id, source.module, source.id)、(world_id, target.module, target.id)；
  列表页批量统计入/出链数量。
- 删除实体时默认级联删除其关联；删除确认框中列出将被影响的关联；可选保留失效引用，
  失效引用显示为警示 chip，并提供一键清理。
- 重命名实体不需要改关联记录；显示名按 id 解析，列表缓存惰性刷新。

---

### 2.6 ComplexityLevel（复杂度分层）

```typescript
type ComplexityLevel = 'sketch' | 'structure' | 'sandbox';
```

- sketch：速写。3-5 个字段即可完成设定，默认进入该模式。隐藏关系画布、数值、时间轴等重组件。
- structure：结构。启用实体分类、字段组、关联面板与关系视图（模块按自身形态选择画布/矩阵/树）。
- sandbox：沙盘。启用数值、流量、时间维度、统计图表、全局关联总览等。
- 复杂度滑杆只控制披露程度，不删除数据；降档隐藏，升档恢复。
- 模块可在 ModuleConfig.defaultComplexity 中设默认档，用户可随时切换。

### 2.7 模块配置（ModuleConfig）

```typescript
interface ModuleConfig {
  defaultComplexity?: ComplexityLevel;
  displayMode?: string;                    // 该模块默认视图，如 timeline / canvas / atlas
  entityTypes?: EntityTypeDef[];           // 自定义 kind 列表
  levels?: LevelDef[];                     // 自定义等级
  statuses?: StatusDef[];                  // 自定义状态
  fieldSchema?: Record<string, CustomFieldDef[]>; // kind -> 字段定义
  linkTypes?: CustomLinkTypeDef[];         // 用户自定义关联类型
  terminology?: Record<string, string>;    // 模块内术语替换
  palette?: { accent?: string; surface?: string };
}

interface EntityTypeDef {
  id: string;                              // = kind
  label: string;
  icon?: string;                           // Lucide 名
  color?: string;
  description?: string;
  parentKind?: string;
  defaultFields?: CustomFieldDef[];
}

interface LevelDef {
  id: string;
  label: string;                           // 如 超级大国、国家级
  rank: number;                            // 权重，决定视觉大小/排序
  color?: string;
  description?: string;
}

interface StatusDef {
  id: string;
  label: string;
  color?: string;
  isTerminal?: boolean;                    // 如 已灭亡、已失效
}

interface CustomFieldDef {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'select' | 'multiselect' | 'date' | 'entityRef' | 'image';
  required?: boolean;
  options?: { label: string; value: string }[];
  defaultValue?: unknown;
  placeholder?: string;
  entityRefFilter?: { module?: ModuleType | 'character'; kind?: string };
}

type CustomFieldValue = string | number | boolean | string[] | EntityRef | null;

interface CustomLinkTypeDef {
  id: string;
  label: string;
  reverseLabel?: string;
  directed: boolean;
  icon?: string;
  color?: string;
  source: { module: ModuleType; kind?: string };
  target: { module: ModuleType; kind?: string };
}
```

### 2.8 WorldTone（视觉基调）

```typescript
interface WorldTone {
  palette?: 'parchment' | 'ink' | 'slate' | 'custom'; // 基础纸张/底纹倾向
  accent?: string;        // 主强调色
  texture?: 'none' | 'paper' | 'grid' | 'starfield';
  radius?: 'sm' | 'md' | 'lg';
}
```

- 世界基调只影响整体观感，不代表任何玩法或世界观预设。
- 各模块在统一基调上有自己的领域强调色，保持一个世界、多张面孔。

---

## 3. 各模块的语义定义与关联职责

| module_type | 模块定位 | 主要 kind | 主要出链 | 主要入链 |
|-------------|----------|-----------|----------|----------|
| history | 时间轴与事件书卷 | era、event（事件条目为 item） | 发生于、涉及、导致 | 被引用为背景/起因 |
| politics | 权力版图 | polity、organization、figure、treaty | 控制领土、效忠、领导、缔约、同盟、敌对 | 历史事件涉及、经济受管制、种族/体系关联 |
| economy | 经济脉络 | 推荐 kind：resource、good、industry、market、currency、actor、institution，也可完全自定义 | 生产、消耗、流通、归属、受管制、位于 | 政治条约/政策、历史事件、种族特产、体系资源 |
| races | 种族图鉴 | race、subrace | 聚居、渊源、代表人物、体系亲和 | 人物种族归属、历史事件、经济物产 |
| systems | 体系进阶 | system、tier、ability、rule、cost | 进阶、前置、赋予、代价、修习 | 角色境界、种族亲和、历史突破、经济资源 |
| map | 地图（本轮不动） | 可选链接目标 region、location | 暂不接入 | 被各模块位于/控制/发生于引用，未接入时隐藏入口 |
| special | 特殊设定（本轮不动） | 任意 | 通用引用 | 通用引用 |
| character | 全局角色（应用级） | character | 效力、登场、拥有、种族、体系 | 被政治/历史/种族/体系引用，不在模块内复制人物数据 |

kind 命名：小写单数、英文；自定义 kind 使用用户语言的 label，id 用 custom_xxx。

---

## 4. 关联类型注册表（核心集）

> 视觉列：颜色以 Tailwind 色系描述，线型用于画布；图标为 Lucide 名。
> ↔ 表示对称关联（落库一条）；→ 表示有向，反向展示用 reverseLabel。

### 4.1 通用

| id | 标签 | reverseLabel | 源 → 目标 | 方向 | 图标 | 颜色 | 线型 |
|----|------|--------------|-----------|------|------|------|------|
| core.references | 引用 | 被引用 | 任意 → 任意 | → | link | slate | dotted |
| core.related_to | 相关 | 相关 | 任意 ↔ 任意 | ↔ | git-branch | slate | dotted |
| custom.link | 自定义关联 | 自定义关联 | 任意 → 任意 | → | link-2 | slate | dashed |

### 4.2 历史

| id | 标签 | reverseLabel | 源 → 目标 | 方向 | 图标 | 颜色 | 线型 |
|----|------|--------------|-----------|------|------|------|------|
| history.occurs_at | 发生于 | 发生事件 | history.event / history.era → 地点/政权/市场/聚居地 | → | map-pin | blue | solid |
| history.involves | 涉及 | 被涉及 | history.event / history.era → 政权/组织/人物/角色/种族/体系/经济实体 | → | users | amber | solid |
| history.causes | 导致 | 由该事件导致 | history.event → 事件/政权/组织/经济实体/体系节点 | → | arrow-right-circle | orange | solid |
| history.caused_by | 起因于 | 引发了 | history.event → 任意实体 | → | undo-2 | orange | dashed |
| history.milestone_of | 大事记 | 收录大事记 | history.event / history.era → 政权/种族/体系/组织 | → | flag | amber | solid |

补充约定：history.era 可作为 occurs_at / involves / milestone_of 的源，用于表达时代整体与
其他模块的关系；事件级因果（causes / caused_by）仍由 history.event 承担。时代与事件的
层级关系继续由 submodule.parent_id（era -> event）表达，不重复落 WorldLink。

### 4.3 政治

| id | 标签 | reverseLabel | 源 → 目标 | 方向 | 图标 | 颜色 | 线型 |
|----|------|--------------|-----------|------|------|------|------|
| politics.controls_region | 控制领土 | 被控制 | polity → 地图地区 | → | map | gold | solid |
| politics.capital_at | 首府位于 | 首府 | polity → 地图地区 | → | landmark | gold | solid |
| politics.member_of | 效忠/隶属 | 拥有成员 | figure/organization → polity/organization | → | users-round | red | solid |
| politics.leads | 领导 | 被领导 | figure → polity/organization/treaty | → | crown | red | solid |
| politics.founded_by | 建立者 | 建立 | polity/organization → figure/character | → | hammer | red | dashed |
| politics.subordinate_to | 下属于 | 下辖 | organization → organization/polity | → | corner-down-right | red | solid |
| politics.signatory_of | 签署/加入 | 签署方 | polity/organization → treaty | → | pen-line | green | solid |
| politics.includes_race | 民族/种族构成 | 构成 | polity → race/subrace | → | users | teal | dashed |
| politics.ally_of | 同盟 | 同盟 | polity/organization ↔ 同左 | ↔ | handshake | emerald | solid |
| politics.at_war_with | 敌对/战争 | 敌对/战争 | polity/organization ↔ 同左 | ↔ | swords | red | double |
| politics.vassal_of | 附庸于 | 宗主 | polity/organization → polity/organization | → | chevron-down | amber | dashed |
| politics.trades_with | 贸易往来 | 贸易往来 | polity/organization ↔ 同左 | ↔ | arrow-left-right | blue | solid |
| politics.marriage_tie | 联姻 | 联姻 | figure ↔ figure | ↔ | heart-handshake | pink | double |
| politics.succeeds | 继承 | 前任 | figure → figure | → | arrow-right | red | dashed |

### 4.4 经济

| id | 标签 | reverseLabel | 源 → 目标 | 方向 | 图标 | 颜色 | 线型 |
|----|------|--------------|-----------|------|------|------|------|
| economy.produces | 生产 | 被生产 | industry → good | → | factory | green | solid |
| economy.consumes | 消耗 | 被消耗 | industry → resource/good | → | package-minus | green | solid |
| economy.requires | 依赖 | 被依赖 | industry/good → resource/good | → | git-branch | teal | dashed |
| economy.traded_at | 交易于 | 交易于此 | good/resource → market | → | store | green | solid |
| economy.flows_to | 流通至 | 自该地流入 | market → market | → | route | cyan | solid（线宽 = 流量） |
| economy.currency_of | 流通货币 | 通行货币为 | currency → polity/market/organization/actor/institution | → | coins | yellow | solid |
| economy.owned_by | 归属/控制 | 拥有/控制 | industry/market/resource → polity/organization/character/actor/institution | → | key-round | lime | solid |
| economy.regulated_by | 受管制 | 管制 | 经济实体 → polity/treaty | → | gavel | amber | dashed |
| economy.taxed_by | 征税 | 征税于 | market/industry → polity | → | landmark | amber | dotted |
| economy.located_in | 位于 | 包含 | 经济实体 → 地图地区 | → | map-pin | blue | solid |
| economy.supplies | 供给 | 由该方供给 | market/industry/actor → polity/organization/market/industry/actor | → | truck | green | solid（线宽 = 流量） |
| economy.era_context | 对应时代 | 对应经济周期 | 经济实体（周期/危机）→ history.era/history.event | → | calendar-range | cyan | dashed |

### 4.5 种族

| id | 标签 | reverseLabel | 源 → 目标 | 方向 | 图标 | 颜色 | 线型 |
|----|------|--------------|-----------|------|------|------|------|
| races.inhabits | 聚居 | 有该族聚居 | race/subrace → 地图地区 | → | map-pin | teal | solid |
| races.origin_at | 起源于 | 是起源地 | race → 地图地区 | → | sprout | teal | dashed |
| races.related_to | 血缘/渊源 | 血缘/渊源 | race ↔ race | ↔ | git-merge | emerald | double |
| races.notable_figure | 代表人物 | 代表种族 | race → character | → | user-round | teal | solid |
| races.affinity_with | 体系亲和 | 亲和种族 | race → systems.system | → | sparkles | violet | dashed |
| races.specialty | 特产 | 特产于 | race/subrace → economy.resource/good | → | wheat | teal | dashed |
| races.prefers | 消费偏好 | 受偏好 | race/subrace → economy.good/market | → | shopping-basket | teal | dashed |
| character.belongs_to_race | 种族归属 | 拥有族裔 | character → race/subrace | → | user-round | teal | solid |

### 4.6 体系

| id | 标签 | reverseLabel | 源 → 目标 | 方向 | 图标 | 颜色 | 线型 |
|----|------|--------------|-----------|------|------|------|------|
| systems.advances_to | 进阶 | 前身 | tier → tier | → | arrow-up-right | violet | solid |
| systems.requires | 前置 | 后续 | tier/ability → tier/ability | → | lock | violet | dashed |
| systems.grants | 赋予 | 由该节点赋予 | tier/system → ability | → | gift | purple | solid |
| systems.costs | 代价 | 消耗于 | ability/tier → resource/good | → | flame | orange | dashed |
| systems.practiced_by | 修习/推行 | 修习者 | systems.system → race/organization/polity | → | users | violet | solid |
| systems.enables | 技术/能力赋能 | 受赋能 | systems.system/tier → economy.industry/good | → | sparkles | violet | dashed |
| systems.countered_by | 克制 | 被克制 | system/ability ↔ 同左 | ↔ | shield | rose | double |
| character.practices_system | 修习体系 | 修习者 | character → systems.system | → | sparkles | violet | solid |
| character.attained | 达到境界 | 境界达成者 | character → tier | → | chevrons-up | violet | solid |

### 4.7 角色（全局人物）

| id | 标签 | 源 → 目标 | 方向 | 图标 | 颜色 | 线型 |
|----|------|-----------|------|------|------|------|
| character.appears_in | 登场/参与 | character → history.event | → | book-open | slate | solid |
| character.serves | 效力于 | character → polity/organization | → | briefcase | red | solid |
| character.owns | 拥有/掌控 | character → 经济实体 | → | key-round | lime | solid |

约束：创建关联时校验源/目标 kind 是否匹配；不匹配时仅允许 core.references、
core.related_to、custom.link 三种通用类型。用户可在模块配置中新增自定义关联类型，
自定义类型必须声明方向、标签、源/目标 kind 范围。

补充约定：
1. politics.signatory_of 是条约参与方的唯一规范边（由参与方指向条约）；原 politics.treaty_between 废弃，旧数据导入时转换为 signatory_of，画布从 signatory_of 投影条约缎带，避免重复边。
2. 政治人物（figure）对全局 Character 的引用是身份映射，使用 meta.characterId 保存，不落 WorldLink；人物的种族、体系、登场等属性通过 character.* 关联与 Character 侧数据呈现。

---

## 5. 关联的 UI 规范

### 5.1 通用关联面板（LinkPanel）

所有实体详情页必须包含统一的关联区域，结构一致：

```
关联   [出链 12]  [入链 5]
┌────────────────────────────────────────────────────┐
│ 历史                                                │
│  [icon] 涉及    赤壁之战 · 关键事件       208 年     │
│  [icon] 起因于  黄巾起义 · 时代事件       184 年     │
│ 政治                                                │
│  [icon] 控制领土 荆州 · 地区               -        │
│ 角色                                                │
│  [icon] 登场    诸葛亮 · 角色              -        │
│ ...                                                 │
│                              [+ 添加关联]           │
└────────────────────────────────────────────────────┘
```

- 按目标模块分组，组内按关联类型排序；行内显示：类型标签（反向关系显示 reverseLabel）、
  目标名、目标 kind 徽章、时间范围、备注摘要。
- 行 hover 显示目标预览卡；点击跳转到目标实体，面包屑保留来源，支持返回。
- 入链区展示被谁引用，不可直接删除，可跳转到源实体修改。
- 每个模块的列表卡片 / 画布节点右上角显示关联计数徽章。

### 5.2 添加关联流程（通用实体选择器）

```
[+ 添加关联]
  → 步骤一：选择模块（历史 / 政治 / 经济 / 种族 / 体系 / 角色；地图·特殊未接入时隐藏）
  → 步骤二：搜索或筛选实体（支持 kind 过滤、最近使用、当前画布内实体）
  → 步骤三：选择关联类型（按源/目标 kind 自动过滤合法类型）
  → 步骤四（可选）：填写时间范围、备注、强度/流量等 meta
  → 保存
```

- 选择器为全局单例组件，各模块只传 source 与可选过滤条件。
- 支持多选批量创建同类型关联。

### 5.3 行内引用（Inline Reference）

- 任意描述/富文本输入框中输入 @ 打开通用实体选择器，插入 token：
  [[history:event:event_123|赤壁之战]]。
- 渲染为可点击 chip，hover 显示预览，点击跳转。
- token 只存 id，显示名实时解析；目标不存在时渲染为失效 chip（警示色 + 提示）。
- 富文本导出时，失效引用保留原文并标注。

### 5.4 世界脉络（World Web，全局关联总览）

- 入口：世界观设定头部 世界脉络 按钮；默认只在 sandbox 复杂度下显示，structure 可手动开启。
- 力导向图：节点按模块着色，节点大小 = 关联数量或实体等级权重，边按领域着色、按关联类型区分线型。
- 顶部筛选：模块、kind、关联类型、时间范围；默认隐藏孤立节点，可切换显示全部。
- 节点 hover 显示摘要，双击进入实体详情；图只读，不做图编辑。
- 当实体超过性能阈值（建议 800 节点）时，降级为模块矩阵 + 推荐关联列表视图。

### 5.5 复杂度与关联的关系

| 复杂度 | 关联能力 |
|--------|----------|
| sketch | 只显示关联计数与行内引用；添加关联使用简化流程（默认 core.related_to，标签可后改） |
| structure | 完整关联面板、出/入链分组、通用选择器、关联视图（画布或列表） |
| sandbox | 全部能力 + 时间维度有效性、流量/强度 meta、世界脉络、统计面板 |

---

## 6. 图标、颜色与文案规范

1. 禁止 emoji：界面默认配置、实体类型、事件类型、关系类型、状态、按钮、空状态、
   示例数据中一律不使用 emoji。设计文档的示意图与表格同样不使用 emoji。
2. 图标统一使用 Lucide 图标名（kebab-case），如 landmark、scroll-text、coins、
   users、git-branch、map-pin。icon 字段存图标名，不存 emoji 字符。
3. 例外：按需求，文档/界面标题区域允许少量标题符号；颜色选择区域使用真实色板
   （色块、渐变）表达，不使用 emoji 色块。除这两处外全部清理。
4. 等级与状态：使用文字徽章 + 色阶 / 分段进度条表达（如 超级大国、已灭亡）；
   不使用星号拼贴或 emoji 圆点。状态用 CSS 绘制的颜色圆点 + 文本。
5. 颜色 token：模块强调色在各模块文档中定义；同一语义在全世界观内保持一致。
   建议领域色：历史 = amber、政治 = red/gold、经济 = green/cyan、种族 = teal、
   体系 = violet、角色 = slate、地图 = blue、特殊 = neutral。
6. 暗色模式：所有颜色需给出 light/dark 两套值，正文对比度不低于 WCAG AA。
7. 动效：150-300ms，缓动统一；支持 prefers-reduced-motion；简单模式不播放复杂动画。

---

## 7. 文档结构规范

各模块设计文档（history / politics / economy / races / systems）必须包含以下章节，
标题可微调，但内容不得缺失：

1. 模块定位与在 WorldLink 中的角色
2. 信息架构与实体层级（说明重要程度的差异）
3. 数据模型（kind / meta / items / config 映射）
4. UI 设计（整体布局 + 关键区域 ASCII 原型 + 视觉规范）
5. 交互设计（创建、编辑、关联、跳转、筛选）
6. 与历史 / 政治 / 经济 / 种族 / 体系 / 角色 / 地图的关联设计
7. 自定义能力（子模块、字段、类型、等级、状态）
8. 复杂度分层（速写 / 结构 / 沙盘分别呈现什么）
9. 空状态与引导
10. 世界生成后的最小可用路径（3 分钟能完成什么）
11. 性能与实现建议
12. 本轮不做的事（边界）

全局文档（worldbuilding_ui_design.md / worldview_configuration_system.md）负责：
世界容器、七模块框架、创建/备份流程、模块配置系统、跨模块导航、世界脉络入口，
以及地图/特殊模块保持现状的说明。

---

## 8. 从旧设计迁移的映射（设计说明，不在本轮实现）

| 旧设计 | 新设计 |
|--------|--------|
| WorldTemplate / /worldbuilding/templates | World / /worldbuilding/worlds |
| WorldTemplate.is_system_template / is_public / tags | 删除；世界只属于项目 |
| WorldInstance | 概念取消 |
| 世界模板导入/导出 | 世界 JSON 备份 / 恢复 |
| WorldModule.template_id | WorldModule.world_id |
| WorldModuleItem(name = moduleConfig) | WorldModule.config |
| WorldSubmodule.color 前缀编码（era:ochre 等） | WorldSubmodule.kind + meta 显式字段 |
| 各模块自建的跨模块引用数组（CrossModuleReference[]） | WorldLink 表 + LinkPanel |
| 政治模块内复制人物数据 | 引用全局 Character，政治侧只存身份/职位/任期 |
| 预置世界观配置（仙侠/科幻/西幻/历史/末世） | 全部删除；世界自定义配置从空白开始 |
| emoji 作为实体/事件/关系图标 | Lucide 图标名 + 用户自定义颜色 |

迁移原则：旧数据可读，展示层做兼容转换；一旦升级，保存时写回新结构。
