# 政治模块界面设计：权力版图

> 适用模块：`politics`（政治）
> 共享契约：`docs/worldbuilding/cross_module_link_design.md`（WorldLink Contract）。本文所有术语、模块、kind、关联类型、图标、复杂度与数据结构均以契约为准；本文只设计政治模块的实体形态、界面与交互。
> 版本：v3.0（整页重写，取代旧版「四类平级 Tab + 同构卡片」方案）。
> 空白世界原则：政治模块不内置任何世界观预设内容——没有预置等级标签、状态标签、政体枚举、组织子类型、条约类型、派系或示例数据。文中出现的名称一律是占位符，或对「用户可自行输入什么」的说明，不是默认值。

---

## 1. 模块定位与在 WorldLink 中的角色

### 1.1 一句话定位

政治模块是世界的**权力版图**，回答四个问题：

1. **谁在统治**：政权（polity）是版图的主干与容器。
2. **谁在支持或对抗**：组织（organization）是政权的卫星集群，也允许跨国与独立势力。
3. **谁在位置上**：人物（figure）不是政治数据的所有者，而是全局 Character 在政治中的身份、职位、任期与派系。
4. **谁和谁怎么了**：条约（treaty）不是第四类实体，而是政权（或组织）之间的一条边；同盟、敌对、附庸、贸易、联姻同样是边。

政治模块产出的是「权力结构」，不是「人物百科」「经济台账」「历史书卷」或「种族图鉴」。后四者分别由角色、经济、历史、种族模块拥有，政治只持有指向它们的 WorldLink 与聚合视图。

### 1.2 设计公理（逐条回应用户反馈）

| 编号 | 公理 | 被推翻的旧做法 |
|------|------|----------------|
| A1 | 政权是唯一的第一层级大卡片，其余政治内容都围绕它组织 | 国家 / 组织 / 人物 / 条约四个平级 Tab |
| A2 | 组织默认嵌在所属政权卡片内；跨国与独立势力汇入单独一条势力带 | 组织与政权做同尺寸卡片并列 |
| A3 | 人物以紧凑行、头像条、任职带出现，并引用全局 Character，不复制人物数据 | 人物大卡片，政治侧重复存出生地、生平、种族等 |
| A4 | 条约是边：缔约方是节点，条约是连接带；列表形态只作为次级的「条约簿」 | 条约作为第四类实体卡片 |
| A5 | 所有跨模块引用统一走 WorldLink，所有实体详情共用统一 LinkPanel | 各模块自建 CrossModuleReference[]、自己画跳转 |
| A6 | 等级、状态、政体、组织子类型、派系、条约类型、关联类型全部由用户配置 | 内置固定枚举、预置世界观模板与示例数据 |
| A7 | 复杂度三档渐进披露：速写能成立，结构能维护，沙盘能推演 | 一上来就铺满关系画布与全部字段 |

### 1.3 模块职责边界

| 政治模块负责 | 政治模块不负责（属于其他模块或应用级） |
|--------------|----------------------------------------|
| 政权、组织、人物政治身份、条约的实体形态与列表/画布呈现 | 角色生平、头像、种族、体系境界等人物档案（全局 Character） |
| 领土控制、首府、效忠、领导、缔结、同盟、敌对、附庸、贸易、联姻等关系边 | 地图地区本身（地图模块，本轮不动） |
| 政体、合法性、继承方式、机构描述、沿革锚点、条约条款等文字与结构化设定 | 经济数值与流量（经济模块）；政治只显示受管制/征税/供给等关联 |
| 对历史、经济、种族、体系、地图、角色的引用与聚合视图 | 历史事件、时代本身；种族定义；体系规则；经济实体 |
| 按等级 rank 决定的版图视觉权重 | 全世界观统一的实体权重规则（各模块自定，见契约第 0 节第 5 条） |

### 1.4 契约关联类型使用清单

政治模块只使用契约注册表中的关联类型；需要新语义时走 `ModuleConfig.linkTypes` 自定义类型，或用契约允许的通用三型（`core.references` / `core.related_to` / `custom.link`）兜底。不新造平行关联结构。

**政治注册表（契约 4.3）**

| 关联类型 | 政治侧用途 | 出现位置 |
|----------|------------|----------|
| `politics.controls_region` | 政权控制领土 | 版图领土层、政权详情「领土」、LinkPanel |
| `politics.capital_at` | 首府位于某地区 | 政权卡片首府徽章、详情概览、LinkPanel |
| `politics.member_of` | 人物效忠 / 组织隶属 | 人物任职带、组织成员、LinkPanel |
| `politics.leads` | 人物领导政权 / 组织 / 条约 | 统治者头像条、机构负责人、LinkPanel |
| `politics.founded_by` | 政权 / 组织由谁建立 | 沿革起点、详情「建立者」、LinkPanel |
| `politics.subordinate_to` | 组织下属于组织 / 政权 | 卫星归属、组织层级、LinkPanel |
| `politics.signatory_of` | 政权 / 组织签署或加入条约 | 条约缎带的唯一来源、条约详情、LinkPanel |
| `politics.includes_race` | 政权的民族 / 种族构成 | 人口构成、版图人口提示、LinkPanel |
| `politics.ally_of` | 同盟边（对称） | 关系层、详情关系区 |
| `politics.at_war_with` | 敌对 / 战争边（对称） | 关系层、详情关系区 |
| `politics.vassal_of` | 附庸于（有向，反向显示宗主） | 关系层、版图层级提示 |
| `politics.trades_with` | 贸易往来边（对称） | 关系层 |
| `politics.marriage_tie` | 联姻边（对称） | 人物关系层（聚焦 / 沙盘） |
| `politics.succeeds` | 继承边（有向） | 统治者任职带、沿革 |

条约边规范：`politics.signatory_of` 是缔约方的唯一规范边。`politics.treaty_between` 已废弃，本设计不创建、不查询、不渲染；导入旧数据时在展示层等价转换为 `signatory_of` 后保存。画布上的条约缎带一律由 `signatory_of` 的缔约方集合投影生成，不重复写边。**跨模块注册表（契约 4.2 / 4.4 / 4.5 / 4.6 / 4.7）**

| 关联类型 | 政治侧用途 | 出现位置 |
|----------|------------|----------|
| `history.milestone_of` | 历史事件 / 时代收录为政权或组织的大事记 | 沿革视图、详情「沿革」、LinkPanel |
| `history.occurs_at` | 历史事件 / 时代发生于政权 | 沿革视图、政权时间条、LinkPanel |
| `history.involves` | 历史事件 / 时代涉及政权 / 组织 / 人物 | 沿革视图、详情关系区、LinkPanel |
| `history.causes` / `history.caused_by` | 事件因果链 | 沿革二级信息、LinkPanel |
| `economy.regulated_by` | 经济实体受政权或条约管制 | 政权详情「经济基础」、条约详情、LinkPanel |
| `economy.taxed_by` | 市场 / 产业向政权纳税 | 政权详情「经济基础」、LinkPanel |
| `economy.supplies` | 市场 / 产业供给政权或组织 | 政权 / 组织详情、LinkPanel |
| `economy.owned_by` | 经济实体归属于政权 / 组织 / 角色 | 政权 / 组织详情、LinkPanel |
| `economy.currency_of` | 货币流通于政权 | 政权详情「经济基础」、LinkPanel |
| `politics.includes_race` | 政权人口中的民族 / 种族构成 | 人口构成、版图人口提示、LinkPanel |
| `systems.practiced_by` | 体系在政权 / 组织中被修习或推行 | 政权 / 组织详情「体系」、LinkPanel |
| `character.belongs_to_race` | 人物种族归属，聚合为政权人口参考 | 人物身份卡、人口构成佐证 |
| `character.practices_system` / `character.attained` | 人物修习体系 / 达到境界，聚合为政权体系分布 | 人物身份卡、政权「体系」聚合 |
| `character.serves` / `character.owns` / `character.appears_in` | 角色反向效力 / 掌控 / 登场 | 全局角色页；政治详情只读引用 |
| `races.notable_figure` | 种族代表人物 | 人物身份卡的反向引用 |
| `politics.controls_region` / `politics.capital_at` | 领土与首府 | 地图接入时显示；未接入时新建入口隐藏 |

历史时代与事件的层级关系由 `history` 模块的 `parent_id`（era → event）表达；政治模块只消费 `era` / `event` 作为关联源，不重复建立时代—事件层级。

### 1.5 政治模块在七大模块中的位置

```text
                       ┌──────────────────────────────┐
                       │   World / 世界（唯一容器）    │
                       └───────────────┬──────────────┘
        ┌──────────────┬───────────────┼───────────────┬──────────────┐
        │              │               │               │              │
    ┌───v───┐      ┌───v───┐      ┌────v────┐     ┌────v────┐    ┌────v────┐
    │ 历史  │      │ 政治  │      │  经济   │     │  种族   │    │  体系   │
    │ 时代  │<────>│ 权力  │<────>│  脉络   │     │  图鉴   │    │  进阶   │
    │ 事件  │      │ 版图  │      │         │     │         │    │         │
    └───────┘      └───┬───┘      └─────────┘     └─────────┘    └─────────┘
                       │
             ┌─────────┴─────────┐
             │ 领土/首府 → 地图   │（地图未接入时入口隐藏）
             │ 身份/生平 → 角色   │（应用级 Character，只引用不复制）
             │ 特殊 → 通用引用   │（本轮不动特殊界面）
             └───────────────────┘
```
---

## 2. 信息架构与实体层级

政治模块的四类内容不是兄弟，而是「主干—卫星—点缀—边」。权重差异必须同时成立在**信息架构、布局、数据**三处，缺一不可。

### 2.1 权重总表

| 维度 | polity 政权 | organization 组织 | figure 人物 | treaty 条约 |
|------|-------------|-------------------|-------------|-------------|
| 架构角色 | 第一层级：版图主干与容器 | 第二层级：卫星集群；跨国 / 独立时单列 | 第三层级：全局 Character 的政治投影 | 关系层：边；另有次级「条约簿」 |
| 数据载体 | `WorldSubmodule(kind=polity)`，meta 完整，四组 items | `WorldSubmodule(kind=organization)`，meta 含 scope，两组 items | `WorldSubmodule(kind=figure)`，meta 只存 characterId 与政治身份；职位任期为边 | `WorldSubmodule(kind=treaty)` 作边载荷；缔约方是 `signatory_of` 边；条款为 items |
| 版图布局 | 画布主干，按 level.rank 决定尺寸与位置 | 政权卡片内的卫星簇；独立势力带 | 政权卡上的头像条 + 任职带 | 节点之间的缎带，可中点展开条款 |
| 卡片面积 | 最大：L3 卡约 320-420px 宽，可原地展开 | 小：卫星 chip 或 160px 紧凑卡 | 最小：24-32px 头像、32px 行高 | 无卡片：缎带宽 24-40px，展开浮层 |
| 名录布局 | 主行，高行距，可内联展开卫星与人物 | 次级行，缩进在所属政权下 | 紧凑子行（头像 + 职位 + 任期） | 默认折叠的次级区块「条约簿」 |
| 详情面板 | 全尺寸右抽屉，六段：概览 / 机构 / 人物 / 关系 / 条约 / 沿革 | 中抽屉，三段：概览 / 成员 / 关联 | 轻量侧栏：身份卡 + 任职带 + LinkPanel | 中点浮层或抽屉：缔约方 / 条款 / 履行 |
| 默认可见复杂度 | sketch | structure | structure | structure |
| 计数徽章 | 出链 / 入链、卫星数、人物数 | 成员数、上级数 | 任职数、关联数 | 缔约方数、条款数 |

补充规则：

1. **等级 rank 是唯一的尺寸变量**。政权卡片按 `LevelDef.rank` 映射到尺寸档与布局环，rank 越高越大、越靠画布中心；不按 kind 给固定尺寸。
2. **status 是唯一的降噪变量**。`StatusDef.isTerminal = true` 的政权 / 组织在画布降为低饱和幽灵节点，但不消失；沿革与名录保持完整可见。
3. **kind 决定形态，level / scope 决定位置**。不要用颜色深浅同时表达 kind 与 level，避免语义打架。
4. **条约永不参与政权排序**。条约没有 level 与尺寸，只有线型、带宽和状态色。

### 2.2 层级结构（信息架构概念图）

```text
权力版图的信息架构
│
├─ 第 0 层：世界容器与模块导航（全局负责，本模块不重复实现）
│
├─ 第 1 层：政权层（polity）—— 版图主干
│   ├─ 节点本体：名称 / 等级 rank / 状态 / 政体 / 首府 / 人口 / 经济基础 / 沿革
│   ├─ 节点权重：由 level.rank 决定尺寸档（大 / 中 / 小）与布局环
│   ├─ 容器内容（默认嵌在卡片内，或聚焦详情展开）
│   │   ├─ 组织卫星（organization, scope=intra_polity）
│   │   ├─ 核心人物条（figure，按 leads / isPrimary / 任期排序）
│   │   └─ 沿革锚点（items.chronicle + 历史关联）
│   └─ 对外边（进入第 3 层统一绘制）
│
├─ 第 2 层：势力层
│   ├─ 卫星簇：政权内组织，默认不离开所属政权卡片
│   ├─ 独立势力带：scope=independent 的组织，横排在画布下方
│   └─ 跨国势力：scope=cross_polity 的组织，吸附在多个政权之间的中点
│
├─ 第 3 层：关系与边层
│   ├─ 政治关系边：同盟 / 敌对 / 附庸 / 贸易 / 联姻 / 自定义
│   └─ 条约缎带：由 politics.signatory_of 投影，可展开条款
│
└─ 第 4 层：人物点缀
    ├─ 头像条：政权卡默认最多 5 个 + 溢出计数
    ├─ 任职带：卡片下方横向任期条
    └─ 人物间边（继承 / 联姻）：只在聚焦模式或沙盘展开
```

### 2.3 导航结构：三主视图 + 两个次级入口（没有四个平级 Tab）

```text
政治模块导航
├─ 视图切换（分段控件，仅三项）
│   ├─ 版图 atlas     默认：分层画布，权力结构总览
│   ├─ 名录 roster    维护：政权主行，组织 / 人物内嵌，条约折叠
│   └─ 沿革 chronicle 时间：政权兴亡线，与历史时间轴联动
│
├─ 次级入口（不是主视图，不占 Tab）
│   ├─ 条约簿 treatybook  从关系层图例、政权详情「条约」段、命令面板打开
│   └─ 独立势力带          版图内可折叠带，可放大为筛选列表
│
└─ 上下文抽屉
    ├─ 聚焦详情 FocusDrawer
    └─ 统一 LinkPanel
```

视图切换只表达「同一批权力数据的三种读法」，不表达实体分类。用户不会看到「国家 / 组织 / 人物 / 条约」四个并列按钮。想按类型检索时，使用左侧层级导航（全部 / 政权 / 组织 / 人物 / 条约）——它是过滤器，不是四个页面；过滤结果仍然保留各自的权重形态。

### 2.4 权重差异在三处成立（验收对照）

| 权重落点 | polity | organization | figure | treaty |
|----------|--------|--------------|--------|--------|
| 信息架构 | 主干、容器、默认展开 | 依附于政权；独立时单列 | 附着的紧凑条目 | 边，或次级列表 |
| 布局 | 唯一大节点；尺寸随 rank 放大；中心位 | 卫星 chip / 紧凑卡；缩进层级 | 头像条、紧凑行、任职带 | 连接带、缎带、中点浮层 |
| 数据 | meta 全字段 + 四组 items + 多类边 | meta 含 scope + 两组 items + 归属边 | meta 仅身份键与政治身份；任期在边 | meta 仅条约摘要；缔约方在边；条款在 items |

任何新页面或新组件都不得把四类重新拉平成同构卡片；新增政治实体种类时，必须说明它附着在哪一层，而不是再开一个平级 Tab。
---

## 3. 数据模型（kind / meta / items / config 映射）

### 3.1 四层映射总表

| 层级 | 契约载体 | 政治模块放什么 | 不放什么 |
|------|----------|----------------|----------|
| 实体外形 | `WorldSubmodule` | id、name、kind、icon、color、order_index、parent_id、meta | 面向世界的长文、可重复列表 |
| 轻量字段 | `WorldSubmodule.meta` | level、status、time、tags、kind 专属标量（scope、characterId、treatyTypeId 等） | 条款句子、成员名单、关系数组 |
| 字段组 | `WorldModuleItem`（`name` 为字段组名，`content` 为 JSON） | 政府体制、沿革、人口、经济基础、组织架构、人物身份、条约条款、修订 | 跨模块引用（不写 `map:region_001` 式字符串） |
| 配置 | `WorldModule.config: ModuleConfig` | entityTypes、levels、statuses、fieldSchema、linkTypes、terminology、palette、displayMode、defaultComplexity | 具体世界观内容 |
| 关系 | `WorldLink` | 领土、首府、效忠、领导、隶属、缔约、同盟、敌对、附庸、贸易、联姻、继承，以及历史 / 经济 / 种族 / 体系 / 角色引用 | 自建关系数组、复制到 content 的双向记录 |

唯一的身份例外：`figure` 与全局 `Character` 的 1:1 引用使用 `FigureMeta.characterId`（必填身份键），不落 WorldLink；种族、体系等人物属性通过全局角色身上的 `character.*` 关联呈现。该约定已与契约确认。

### 3.2 kind 与枚举

```typescript
/** 内置四种 kind；自定义 kind 使用 custom_xxx（契约 kind 命名约定）。 */
export type PoliticsKind = 'polity' | 'organization' | 'figure' | 'treaty' | `custom_${string}`;

/** 组织在三层版图中的位置，由归属边推导并显式存于 meta，便于查询与降级渲染。 */
export type PoliticsScope = 'intra_polity' | 'cross_polity' | 'independent';

/** 政治模块的 items 字段组名，与 WorldModuleItem.name 对应。 */
export type PoliticsItemGroup =
  | 'government'        // polity：政府体制与权力结构
  | 'chronicle'         // polity / organization：沿革锚点
  | 'demographics'      // polity：人口与构成
  | 'economy_base'      // polity：经济基础摘要
  | 'org_doctrine'      // organization：宗旨、招募、纪律
  | 'org_structure'     // organization：内部架构与职衔
  | 'figure_identity'   // figure：政治身份与公众形象
  | 'treaty_terms'      // treaty：条款
  | 'treaty_amendments' // treaty：修订、补充与违约记录
  | 'custom';           // 任意 kind 的用户自定义字段组
```

### 3.3 meta：基础字段与分 kind 扩展

```typescript
import type {
  WorldSubmodule, WorldModuleItem, ModuleConfig, EntityRef, CustomFieldValue, CustomLinkTypeDef,
} from './worldbuilding-contract';

/** 四类共用的轻量基础字段，来自契约 WorldSubmodule.meta / WorldEntityBase。 */
export interface PoliticsMetaBase {
  level?: string;                 // LevelDef.id；rank 决定版图尺寸与位置权重
  status?: string;                // StatusDef.id；isTerminal 状态在画布淡出、在沿革保留
  time?: {                        // 存续时间；自定义写法放 display
    start?: string;
    end?: string;
    display?: string;
  };
  tags?: string[];
  customFields?: Record<string, CustomFieldValue>;
  note?: string;                  // 卡片副标题 / 一句话摘要，不是长文
}
/** 政权：版图主干。领土与首府不存 id，统一由 politics.controls_region / politics.capital_at 表达。 */
export interface PolityMeta extends PoliticsMetaBase {
  governmentFormId?: string;      // 指向 items.government.formId 的展示缓存
  governmentFormLabel?: string;   // 展示缓存；权威值在 items.government
  capitalLabel?: string;          // 展示缓存；权威值在 politics.capital_at 的目标实体
  population?: number;            // 汇总值；明细在 items.demographics
  populationYear?: string;
}

/** 组织：政权卫星 / 跨国势力 / 独立势力。归属关系在边上，meta 只存 scope 与类型。 */
export interface OrganizationMeta extends PoliticsMetaBase {
  scope: PoliticsScope;           // 必填：决定嵌在政权卡内、吸附多点、还是进独立势力带
  orgSubtypeId?: string;          // 用户自定义组织子类型
  baseLabel?: string;             // 总部或主要活动范围文本；位置本身走地图关联
  influenceNote?: string;         // 影响力一句话
}
/** 人物：全局 Character 的政治投影。不存姓名、头像、种族、生平。 */
export interface FigureMeta extends PoliticsMetaBase {
  characterId: string;            // 必填：应用级 Character 的 1:1 身份键
  identityLabel?: string;         // 政治身份（用户自由文本）
  primaryOfficeLabel?: string;    // 主职位展示缓存；权威值在任职边 meta.officeTitle
  courtRank?: string;             // 官阶 / 品阶，用户自由文本
  factionLabel?: string;          // 派系标签；派系若升级为组织，则补 politics.member_of 边
}

/** 条约：作为边载荷存在的实体。缔约方是 signatory_of 边，条款是 items。 */
export interface TreatyMeta extends PoliticsMetaBase {
  treatyTypeId?: string;          // 用户自定义条约类型
  effectiveAt?: string;           // 生效时间；可与 time.start 不同（如批准后生效）
  expiresAt?: string;             // 到期时间
  breachState?: string;           // 违约 / 中止 / 修订中等，用户自定义值
  visibility?: string;            // 公开程度，用户自定义 select；UI 只做展示与筛选
  summary?: string;               // 一句话摘要
}
```

### 3.4 items：字段组 content 定义

```typescript
/** polity.items.government：政府体制。取代旧 GovernmentType 枚举；政体名由用户定义。 */
export interface GovernmentContent {
  formId?: string;                // 用户自定义政体 id
  formLabel?: string;             // 政体显示名
  legitimacy?: string;            // 合法性来源：血统、选举、神授、武力、契约……由用户书写
  succession?: string;            // 继承 / 更替方式
  decisionProcess?: string;       // 决策流程与关键机构（机构本身建成 organization 卫星）
  checks?: string;                // 制衡、派系与潜在裂痕
  notes?: string;
}

/** polity / organization 共用：沿革条目。历史事件通过 WorldLink 挂接，不写事件 id。 */
export interface ChronicleEntry {
  id: string;
  order: number;
  title: string;
  summary?: string;
  time?: { start?: string; end?: string; display?: string };
  kindId?: string;                // 用户自定义沿革类型
}
export interface ChronicleContent { entries: ChronicleEntry[]; }
/** polity.items.demographics：人口与构成。种族明细走 politics.includes_race，不在此硬编码种族 id。 */
export interface DemographicsContent {
  population?: number;
  year?: string;
  censusRows?: {                  // 用户自定义统计口径（阶层、职业、地域……）
    id: string;
    label: string;
    value?: number;
    unit?: string;
    note?: string;
  }[];
  compositionNote?: string;       // 文字补充；种族构成见 6.4
}

/** polity.items.economy_base：经济基础摘要。经济实体只引用，不复制数值。 */
export interface EconomyBaseContent {
  summary?: string;
  sectorLabels?: string[];        // 仅文本标签；对应经济实体走 WorldLink
  treasuryNote?: string;
  taxationNote?: string;
}
/** organization.items.org_doctrine：宗旨与运行方式。 */
export interface OrgDoctrineContent {
  creed?: string;
  recruitment?: string;
  discipline?: string;
  resourceNote?: string;
}

/** organization.items.org_structure：内部架构与职衔体系。 */
export interface OrgStructureEntry {
  id: string;
  order: number;
  title: string;
  tierLabel?: string;
  seats?: number;
  note?: string;
}
export interface OrgStructureContent { entries: OrgStructureEntry[]; }

/** figure.items.figure_identity：政治身份与公众形象。人物档案本身不在这里。 */
export interface FigureIdentityContent {
  publicStanding?: string;        // 政治立场 / 公众形象，用户自定义
  factionNote?: string;
  privateNote?: string;           // 政治侧备注，不代替角色生平
  aliases?: string[];             // 仅用于政治搜索的别名，不写回 Character
}
/** treaty.items.treaty_terms：条款。id / order / title 沿用旧 TreatyTerm，并新增条款属性。 */
export interface TreatyTerm {
  id: string;
  order: number;
  title: string;
  content?: string;
  categoryId?: string;            // 用户自定义条款分类
  binding?: boolean;              // 是否强制条款
  secret?: boolean;               // 是否秘密条款
}
export interface TreatyTermsContent { terms: TreatyTerm[]; }

/** treaty.items.treaty_amendments：修订、补充与违约记录。 */
export interface TreatyAmendment {
  id: string;
  order: number;
  title: string;
  content?: string;
  time?: { start?: string; end?: string; display?: string };
  kindId?: string;                // 修订 / 补充 / 违约 / 退出……用户自定义
}
export interface TreatyAmendmentsContent { amendments: TreatyAmendment[]; }
/** 字段组名到 content 类型的映射。 */
export interface PoliticsItemContentMap {
  government: GovernmentContent;
  chronicle: ChronicleContent;
  demographics: DemographicsContent;
  economy_base: EconomyBaseContent;
  org_doctrine: OrgDoctrineContent;
  org_structure: OrgStructureContent;
  figure_identity: FigureIdentityContent;
  treaty_terms: TreatyTermsContent;
  treaty_amendments: TreatyAmendmentsContent;
  custom: Record<string, CustomFieldValue>;
}

/** 政治条目：契约 WorldModuleItem 的政治特化。 */
export type PoliticsItem = {
  [K in keyof PoliticsItemContentMap]: Omit<WorldModuleItem, 'name' | 'content'> & {
    name: K;
    content: PoliticsItemContentMap[K];
  };
}[keyof PoliticsItemContentMap];

/** 字段组按 kind 的归属；界面据此决定详情分段与默认折叠。 */
export const POLITICS_ITEM_GROUPS: Record<
  'polity' | 'organization' | 'figure' | 'treaty',
  PoliticsItemGroup[]
> = {
  polity: ['government', 'chronicle', 'demographics', 'economy_base', 'custom'],
  organization: ['org_doctrine', 'org_structure', 'chronicle', 'custom'],
  figure: ['figure_identity', 'custom'],
  treaty: ['treaty_terms', 'treaty_amendments', 'custom'],
};
```

### 3.5 实体联合类型与版图聚合视图

```typescript
/** 把契约的 WorldSubmodule 特化为某 kind + 对应 meta。 */
export type PoliticsSubmodule<K extends string, M> =
  Omit<WorldSubmodule, 'kind' | 'meta'> & { kind: K; meta: M };

export type PolityEntity       = PoliticsSubmodule<'polity', PolityMeta>;
export type OrganizationEntity = PoliticsSubmodule<'organization', OrganizationMeta>;
export type FigureEntity       = PoliticsSubmodule<'figure', FigureMeta>;
export type TreatyEntity       = PoliticsSubmodule<'treaty', TreatyMeta>;
export type PoliticsEntity     = PolityEntity | OrganizationEntity | FigureEntity | TreatyEntity;

/** 版图渲染用的聚合视图，不是持久化结构。 */
export interface PolityAtlasNode {
  polity: PolityEntity;
  weight: number;                       // 来自 LevelDef.rank；决定尺寸档与布局环
  satellites: OrganizationEntity[];     // scope = intra_polity
  coreFigures: FigureEntity[];          // leads / member_of 中 isPrimary 或职位最高者
  tenureBands: FigureTenureBand[];      // 任职带
  treatyRibbons: TreatyRibbonView[];    // 由 signatory_of 入边投影得到
  relationCount: { out: number; in: number };
}

export interface FigureTenureBand {
  figureId: string;
  officeTitle: string;
  start?: string;
  end?: string;
  isPrimary: boolean;
  edgeId: string;                       // 指向 WorldLink；编辑任期即编辑边
}
export interface TreatyRibbonView {
  treaty: TreatyEntity;
  parties: { ref: EntityRef; label: string; role?: string; signedAt?: string }[];
  anchorA: string;                      // 缔约方节点 id
  anchorB?: string;                     // 单方条约时为 undefined，改画节点旌旗
  line: 'double';
  color: 'green';
  status: 'active' | 'expired' | 'suspended' | 'unknown';
}
```

### 3.6 旧字段迁移映射（保留、重写、删除）

| 旧设计字段 / 结构 | 新落点 | 处理 |
|-------------------|--------|------|
| `PoliticalEntityType = nation \| organization \| leader \| treaty` | `WorldSubmodule.kind = polity \| organization \| figure \| treaty` | 重命名：nation → polity、leader → figure |
| `PoliticalEntityBase`（四类同构基类） | 契约 `WorldSubmodule` + `meta` + `items` 分层 | 删除同构基类 |
| `EntityLevel` 固定四级枚举 | `LevelDef { id, label, rank, color }`，默认空，用户自建 | 枚举删除；`rank` 决定节点尺寸与位置 |
| `EntityStatus` 固定三级枚举 | `StatusDef { id, label, isTerminal }`，默认空，用户自建 | 枚举删除；终端状态淡出画布、保留沿革 |
| `PoliticalAlignment` 九宫格 | `figure.items.figure_identity.publicStanding` 自定义字段 | 删除内置枚举与默认选项 |
| `GovernmentType` 八种枚举 | `polity.items.government.formId / formLabel` | 枚举删除；政体描述重写为可配置文本 |
| `RelationType` / `RelationTypeConfig` / 颜色与 emoji 图标 | 契约 LinkTypeDef 注册表（`politics.*`）+ `ModuleConfig.linkTypes` 自定义 | 删除模块内关系注册表与 emoji |
| `CrossModuleReference[]` 一组数组 | `WorldLink` 独立表 + 统一 LinkPanel | 删除 content 内引用数组 |
| `PoliticalRelation` 模块内关系数组 | `WorldLink`（对称存一条；有向边反向显示 reverseLabel） | 删除模块内关系数组 |
| `Affiliation.entityId` | `WorldLink.target`（`politics.member_of` 或 `politics.leads`） | 用边承载归属 |
| `Affiliation.role` | 边 `meta.officeTitle` | 保留语义，换载体 |
| `Affiliation.startDate / endDate` | 边 `time.start / time.end` | 保留语义（任职时间） |
| `Affiliation.isPrimary` | 边 `meta.isPrimary` | 保留，用于头像条与任职带排序 |
| `Affiliation.entityName` | 不存；按 target id 实时解析 | 删除冗余展示名 |
| `LeaderEntity` 的出生地、生平、种族等 | 全局 Character 属性；政治侧不存 | 删除复制数据 |
| `TreatyParticipant.*` | `politics.signatory_of` 边；`role / signedAt / withdrewAt` 放边 `meta` 与 `time` | 保留语义，换载体 |
| `TreatyTerm { id, order, title, content }` | `treaty.items.treaty_terms`（新增 categoryId / binding / secret） | 保留并扩展 |
| `TreatyEntity.isExpired / isBroken` | `StatusDef` + `TreatyMeta.breachState` + `time` | 拆为可配置状态与修订记录 |
| `WorldviewTemplate` / `PRESET_TEMPLATES` / 模板切换 | 无对应物 | 全部删除；禁止预置世界观内容 |
| `color: "type:nation:superpower:active"` 前缀编码 | `kind` + `meta.level` + `meta.status` 显式字段 | 删除字符串 hack |
| `icon: "alignment:..."` 前缀编码 | `EntityTypeDef.icon` + 自定义字段图标；不编码语义 | 删除字符串 hack |
| `description: JSON.stringify({...})` | `meta`（标量）+ `items`（结构化） | 删除 JSON 长串 |
| 四个平级 Tab（国家 / 组织 / 领袖 / 条约） | 三主视图（版图 / 名录 / 沿革）+ 次级条约簿 | 删除 Tab 结构 |
| `EntityCard` 与四个同构卡片组件 | `PolityNode` / `OrganizationCluster` / `FigureStrip` / `TreatyRibbonLayer` | 删除同构卡片组件族 |

保留并重写的旧语义：政府体制（成为 `items.government`，字段可配置）、条约条款（成为 `items.treaty_terms`）、任职时间（成为 `WorldLink.time` + `meta.officeTitle`）、参与者角色（成为 `signatory_of` 边 `meta.role`）。

### 3.7 ModuleConfig 映射

```typescript
export const POLITICS_MODULE_CONFIG: ModuleConfig = {
  defaultComplexity: 'sketch',
  displayMode: 'atlas',                       // 默认打开权力版图
  entityTypes: [
    { id: 'polity',       label: '政权', icon: 'landmark',    color: 'gold',  description: '版图主干与容器' },
    { id: 'organization', label: '组织', icon: 'shield',      color: 'red',   description: '政权卫星、跨国或独立势力；scope 在 meta' },
    { id: 'figure',       label: '人物', icon: 'user-round',  color: 'slate', description: '全局 Character 的政治身份' },
    { id: 'treaty',       label: '条约', icon: 'scroll-text', color: 'green', description: '缔约方之间的边与条款' },
  ],
  levels: [],                                 // 空白：用户定义 label / rank / color；rank 越大节点越大、越靠中心
  statuses: [],                               // 空白：用户定义；建议至少一个 isTerminal 状态用于画布淡出
  fieldSchema: {
    polity: [], organization: [], figure: [], treaty: [],
  },                                          // 空白：用户按 kind 追加自定义字段
  linkTypes: [],                              // 空白：需要新语义时添加自定义关联类型
  terminology: {},                            // 空白：用户可替换「政权 / 组织 / 人物 / 条约」等模块内术语
  palette: {
    accent: '#b45309',                        // 政治领域强调色：红金体系
    surface: 'rgba(180, 83, 9, 0.08)',
  },
};
```
```typescript
/** 用户需要契约核心集之外的新语义时，按此形态手动添加；模块不预置任何 linkTypes。 */
export const USER_CUSTOM_LINK_EXAMPLE: CustomLinkTypeDef = {
  id: 'custom.link_example',
  label: '（用户填写）',
  reverseLabel: '（用户填写）',
  directed: true,
  icon: 'link-2',
  color: 'slate',
  source: { module: 'politics', kind: 'polity' },
  target: { module: 'politics', kind: 'polity' },
};
```

| ModuleConfig 字段 | 政治模块用法 | 默认值 |
|-------------------|--------------|--------|
| `defaultComplexity` | 新政治模块默认进入速写，先立主干 | `'sketch'` |
| `displayMode` | 默认视图标识，画布渲染器读 `'atlas'` | `'atlas'` |
| `entityTypes` | 四种内置 kind 的 label / icon / color；自定义 kind 也在此注册 | 四个内置 kind，label 术语可改 |
| `levels` | 政权与组织的等级；`rank` 驱动卡片尺寸与布局环 | 空 |
| `statuses` | 政权 / 组织 / 条约状态；`isTerminal` 驱动画布淡出 | 空 |
| `fieldSchema` | 仅放用户自定义字段（`CustomFieldDef[]`），按 kind 分组；内置字段组不放这里 | 四个空数组 |
| `linkTypes` | 用户自定义关联；内置关联走契约注册表，不入 config | 空 |
| `terminology` | 模块内术语替换，如把「政权」替换为用户世界的词 | 空 |
| `palette` | 政治领域红金强调色；light/dark 由主题层展开 | 红金 token |

边界：`items` 里的字段组是模块能力，不写进 `fieldSchema`；`fieldSchema` 只承载用户新增字段。两级字段在 UI 上合并展示：先内置字段组，再自定义字段组。

### 3.8 政治边的落库规则

1. **条约边**：`politics.signatory_of` 是缔约方的唯一规范边（源 = 政权 / 组织，目标 = 条约）。缎带 = 同一 treaty 的 signatory 集合两两投影；单缔约方画节点旌旗，三方及以上画多段缎带并在中点聚合。`politics.treaty_between` 已废弃，不创建、不查询、不渲染；旧数据在展示层转换为 `signatory_of` 后保存。
2. **任职边**：人物职位与任期不在 meta 复制，而是 `politics.member_of`（一般成员）或 `politics.leads`（最高领导 / 机构首长）边；`meta = { officeTitle, isPrimary, courtRank? }`，`time = { start, end }`。同一人物可有多条边，任职带按时间铺开。
3. **组织归属**：`politics.subordinate_to` 表达组织 → 组织 / 政权；`politics.member_of` 表达组织 → 政权（无上级组织时的直挂）。`OrganizationMeta.scope` 是渲染缓存，规则为：只挂一个政权 → `intra_polity`；挂多个政权或跨政权网络 → `cross_polity`；无政权归属且用户标记独立 → `independent`。归属边变化时重算 scope。
4. **层级边界**：`parent_id` 只用于组织树（最多 3 层，契约约定）。政权不建父级：政权之间的上下位用 `politics.vassal_of` 边表达；人物与条约 `parent_id` 恒为 null；沿革、条款等不是实体，不入树。
5. **人物身份**：`FigureMeta.characterId` 必填；`WorldSubmodule.name` 仅作搜索缓存，展示名与头像从全局 Character 实时解析，角色改名后政治侧自动刷新。角色缺失时领域内显示「未绑定角色」修补入口，不阻塞其他政权。
6. **对称与有向**：同盟、敌对、贸易、联姻为对称边，只落一条；附庸、继承、领导、隶属、缔约、领土、管制为有向边，反向展示用契约的 reverseLabel，不写反向记录。
7. **失效引用**：删除目标实体时按契约级联或保留失效引用；政治画布把失效边画为警示虚线 chip，提供一键清理，不静默丢失。

### 3.9 查询、索引与缓存约定

| 场景 | 查询策略 | 说明 |
|------|----------|------|
| 版图首屏 | 先取政权列表与每政权 link 计数，再按视口取可见节点的卫星 / 核心人物 / 缎带 | 不做 N+1；聚合视图 `PolityAtlasNode` 由前端组装 |
| 名录 | 分页 + 虚拟滚动；组织与人物按父政权批量取，条约簿单独一页 | 大世界建议每页 100-200 行 |
| 详情 LinkPanel | 进入详情时按模块分组懒加载，先出链后入链 | 契约索引 `(world_id, source.module, source.id)` 与 `(world_id, target.module, target.id)` |
| 政权人口构成 | 直接查 `politics.includes_race` 入链；人物种族用 `character.belongs_to_race` 做佐证 | 两者都无数据时显示空状态，不伪造 |
| 政权体系 | 查 `systems.practiced_by` 的入链（目标含 polity），再用 `character.practices_system` 聚合人物分布 | 同一体系在政权与组织上出现时去重展示 |
| 沿革 | `history.milestone_of` / `history.occurs_at` / `history.involves` 按政权批量取，与 `items.chronicle` 按时间合并 | 历史未接入时只显示政治侧沿革锚点 |
| 时间过滤 | 由 WorldLink.time 与实体 meta.time 下推 | 只影响展示，不删除数据 |
| 失效引用 | 依赖契约的失效引用机制；政治侧只在画布与 LinkPanel 标记 | 不自动删除用户数据 |

性能前置：`WorldLink` 的出入链计数在列表页批量查询并缓存；实体重命名不影响关联记录；画布只渲染视口内节点与边；详情面板关闭后释放重型派生结果。
---

## 4. UI 设计

### 4.1 设计语言与视觉规范

政治领域色沿用契约建议的红金体系：政权用金色、组织用红色、人物用石板蓝、条约用绿色。所有颜色给出 light / dark 两套值，正文对比度不低于 WCAG AA；不使用 emoji，图标一律 Lucide 名。

| 语义 | Light | Dark | 用途 |
|------|-------|------|------|
| 领域强调 accent | `#b45309` | `#f59e0b` | 选中态、聚焦描边、关键按钮 |
| 领域表面 surface | `#fdf6ec` | `#2a1c0d` | 版图底色、聚焦面板标题条 |
| 政权 gold | `#a16207` | `#e0b84c` | 政权节点边框、等级徽章、领土层 |
| 组织 red | `#b91c1c` | `#f87171` | 卫星芯片、组织层级边 |
| 人物 slate | `#475569` | `#94a3b8` | 头像描边、任职带 |
| 条约 green | `#15803d` | `#4ade80` | 缎带、缔约方锚点 |
| 中性文字 | `#1f2937` | `#e5e7eb` | 名称与正文 |
| 降噪文字 | `#6b7280` | `#9ca3af` | 次要字段、时间 |

**线型与箭头规范**（画布边层，颜色随契约 LinkTypeDef，线型按语义固定）：

| 语义 | 线型 | 箭头 | 颜色 | 图标（Lucide） |
|------|------|------|------|----------------|
| 同盟 | 实线 | 无（对称） | emerald | `handshake` |
| 敌对 / 战争 | 双线 | 无（对称） | red | `swords` |
| 附庸于 | 虚线 | 指向附庸 | amber | `chevron-down` |
| 贸易往来 | 实线 | 无（对称） | blue | `arrow-left-right` |
| 联姻 | 双线 | 无（对称） | pink | `heart-handshake` |
| 领导 / 隶属 | 实线 | 指向被领导者 | red | `crown` / `users-round` |
| 缔约 | 缎带（宽双线） | 指向条约中点 | green | `pen-line` |
| 历史 / 经济 / 种族 / 体系引用 | 点线 | 按类型 | 领域色 | 按契约 |

**尺寸与层级**（rank 来自用户 `LevelDef`，模块只规定映射规则）：

| 元素 | 尺寸档 | 说明 |
|------|--------|------|
| 政权节点 rank 高 | 320-420px 宽，可原地展开 | 布局在中心环，常驻显示卫星与头像条 |
| 政权节点 rank 中 | 200-280px 宽 | 布局在中层环，显示头像条，卫星折叠为计数 |
| 政权节点 rank 低 | 140-180px 宽 | 布局在外围，只显示名称、等级、状态 |
| 组织卫星 chip | 高 28-32px | 政权卡内横排，溢出显示 `+N` |
| 人物头像 | 24px / 28px / 32px | 政权卡、任职带、名录三级密度 |
| 条约缎带 | 宽 24-40px | 展开时高度 160-240px |
| 详情抽屉 | 420-560px | 宽度可拖拽，窄屏变为全屏 sheet |

### 4.2 主视图「权力版图」：分层画布

```text
┌ 政治 · 权力版图 ────────────────────────────────────────────── [搜索] [筛选] [关系层] [+ 新建]
│ [ 版图 | 名录 | 沿革 ]                                   复杂度 速写 v
│
├─ 层级 ────────┬─ 权力版图 ─────────────────────── 图例:  ── 同盟  ══ 敌对  ┄> 附庸  ═══ 条约
│ [x] 全部      │
│ ( ) 政权  12  │       ╔══════════════════════════╗
│ ( ) 组织  38  │       ║ [landmark] 政权甲        ║═══ 条约缎带 ═══>  ╔═══════════════════╗
│ ( ) 人物  96  │       ║ L3 · 存续 · 政体A        ║                    ║ [landmark] 政权乙 ║
│ ( ) 条约   7  │       ║ 首府 城A [map-pin]       ║                    ║ L2 · 存续 · 政体B ║
│               │       ║ [shield]甲 [shield]乙 +2 ║                    ║ [丁][戊] +3       ║
│ 关系层         │       ║ [甲][乙][丙] +6           ║                    ╚═══════════════════╝
│ [x] 同盟      │       ║ 任职带 甲────乙──丙       ║
│ [x] 敌对      │       ╚══════════════════════════╝
│ [x] 附庸      │                    ║
│ [x] 贸易      │                    v  ┄┄> 附庸
│ [ ] 联姻      │       ╔══════════════════════════╗
│ [x] 条约      │       ║ [landmark] 政权丙        ║
│ [ ] 自定义    │       ║ L1 · 流亡 · 政体C        ║
│               │       ╚══════════════════════════╝
│ 条约簿 7 >    │
│               │   ┌ 独立势力 / 跨国组织 ────────────────────────────┐
│               │   │ [shield] 独立组织 L2  [shield] 跨国组织 L1 [+新建]│
│               │   └──────────────────────────────────────────────────┘
└───────────────┴──────────────────────────────────────────────────────────────────────────
```

分层与聚焦规则：

1. **底层**：地图接入时铺领土底纹与地区锚点；未接入时该层整层隐藏，不显示占位入口。
2. **政权层**：唯一主干。节点尺寸随 `level.rank`，rank 高靠中心；默认显示名称、等级、状态、政体、首府、卫星计数、人物头像条、任职带。
3. **卫星层**：`scope=intra_polity` 的组织在政权卡内横排；超出显示 `+N`，点击展开卫星簇浮层。`scope=cross_polity` 吸附在多个政权之间；`scope=independent` 进入下方独立势力带。
4. **边层**：关系边与条约缎带都画在节点之上；默认只显示与当前选中 / 悬停节点相关的边，其余降噪到 15% 透明度。关系层开关可逐类筛选。
5. **人物层**：默认不画人物间边，只在政权卡上出头像条与任职带；聚焦政权后展开核心人物的继承 / 联姻边（沙盘档位默认展开）。
6. **聚焦**：单击政权进入聚焦，画布其余节点降至 20% 透明度并停止动画；再次单击或按 Esc 返回全局。悬停显示摘要卡，不改变聚焦状态。

### 4.3 聚焦详情面板（上下文模式）

```text
┌ 聚焦 · 政权甲 ──────────────────────────────────────────────────── [固定] [关闭] ┐
│ [landmark] 政权甲        [L3] [存续]   存续 ...        关联 出 14 / 入 9         │
│ 概览 · 机构 · 人物 · 关系 · 条约 · 沿革     详情内部锚点，不是四类平级 Tab       │
├──────────────────────────────────────────────────────────────────────────────────┤
│ 概览                                                                             │
│  政体       政体A · 继承方式由用户书写                            [编辑]         │
│  首府       城A [map-pin]（地图未接入时整行隐藏）                                 │
│  统治者     [甲] 甲 · 君主 · 任期 ...                             [更换]         │
│  人口       [sprout] 种族A 60% · 种族B 25% · 其他                 [打开种族]     │
│  经济基础   [gavel] 受管制 3 · [landmark] 征税 2 · [truck] 供给 1 [打开经济]     │
│  沿革       [flag] 3 个历史里程碑 · 5 条政治沿革                  [打开历史]     │
├──────────────────────────────────────────────────────────────────────────────────┤
│ 机构（4）  政权内 organization，scope = intra_polity                             │
│  [shield] 组织甲   机构   负责人 [丙]   下辖 2                          [打开]   │
│  [shield] 组织乙   军团   负责人 [丁]                                   [打开]   │
├──────────────────────────────────────────────────────────────────────────────────┤
│ 人物（9）  紧凑行 + 任职带，不出现大卡片                                          │
│  [甲] 甲   君主   任期一                                           [主要]        │
│  [乙] 乙   摄政   任期二                                                        │
├──────────────────────────────────────────────────────────────────────────────────┤
│ 条约（3）  缔约方集合由 signatory_of 投影，不重复存                             │
│  ═══ 条约X   与 政权乙   生效 ...   状态 存续     [展开条款] [打开条约簿]         │
├──────────────────────────────────────────────────────────────────────────────────┤
│ 关联  [出链 14] [入链 9]   统一 LinkPanel                                        │
│  历史  [flag] 大事记     事件甲 · 事件类型 ...                                   │
│  经济  [gavel] 受管制    市场甲 ...                                              │
│  角色  [user-round] 效力于  角色甲 ...                                           │
│                                                    [+ 添加关联]                   │
└──────────────────────────────────────────────────────────────────────────────────┘
```

详情面板按实体权重自适应，不复制同一套六段：

| 实体 | 面板结构 | 默认宽度 | 关键行为 |
|------|----------|----------|----------|
| 政权 | 概览 / 机构 / 人物 / 关系 / 条约 / 沿革 | 520px | `固定` 后画布可继续浏览，面板不关闭 |
| 组织 | 概览 / 成员 / 关联 | 420px | 独立势力可从势力带直接打开；跨国组织额外显示关联政权 |
| 人物 | 身份卡 / 任职带 / 关联 | 380px | 身份卡第一行跳全局角色档案；任职行点击编辑边 |
| 条约 | 缔约方 / 条款 / 修订与履行 / 关联 | 480px | 默认从缎带中点浮层打开，可升级为固定抽屉 |

面板打开时画布进入上下文降噪；按 Esc 先收起浮层，再取消聚焦；`固定` 与聚焦互不阻塞。

### 4.4 名录视图（批量维护）

```text
名录                    [政权为主行 v] [全部等级] [全部状态] [搜索]      [列设置] [+ 新建]
┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│ v 政权（12）                                                                                    │
│  名称              等级 状态 存续     政体   首府  卫星  人物    关系      更新                 │
│  [landmark] 政权甲  L3  存续 ...      政体A  城A   4     9       出14/入9  ...      [打开]     │
│    ├ [shield] 组织甲   机构  存续 ... 负责人 丙   2                                 [打开]     │
│    ├ [shield] 组织乙   军团  存续 ...                                               [打开]     │
│    ├ [甲] 甲  君主  任期一                                                         [打开角色]  │
│    └ [乙] 乙  摄政  任期二                                                         [打开角色]  │
│  [landmark] 政权乙  L2  存续 ...      政体B  城B   2     4       出6/入5   ...      [打开]     │
│                                                                                                │
│ v 独立 / 跨国组织（6）                                                                          │
│  [shield] 独立组织  L2  存续 ...      scope 独立   成员 5                          [打开]     │
│                                                                                                │
│ > 人物（96）      紧凑列表，默认折叠；展开后为 头像 + 政治身份 + 当前任职                     │
│ > 条约簿（7）     次级区块，默认折叠；展开后进入条约簿表，不抢政权主行                         │
└────────────────────────────────────────────────────────────────────────────────────────────────┘
行高：政权 56px / 组织 40px / 人物 32px / 条约 36px
```

名录的权重落地方式：

1. **政权是主行**：高行距、字段最全、可原地展开；组织与人物作为子行缩进在所属政权下，不另开类型页。
2. **人物是紧凑行**：只有头像、政治身份与当前任职；点击行打开轻量侧栏，不进入大卡片。
3. **条约是折叠区块**：默认收在底部；展开后是「条约簿」表（名称 / 类型 / 缔约方 / 生效 / 状态 / 条款数）。
4. **独立势力单独分组**：不与政权混排，强调它们不依附于任何政权。
5. **批量维护**：支持多选、字段批量填写、时间批量平移；政权行可拖拽调整 order_index，组织可在政权间拖拽改归属边。
6. **内联编辑**：名称、等级、状态、时间可在行内直接改；跨模块引用仍走统一选择器，不提供裸 id 输入。

### 4.5 沿革视图（与历史时间轴联动）

```text
沿革    [全部等级 v] [全部状态 v]   时间 [====|====]   [叠加历史里程碑] [显示条约有效期]
          T1         T2          T3          T4          T5
政权甲    ├──────────┤
          [建立]     [扩张]      [内战]      [灭亡]
政权乙               ├───────────────────────────────> 存续
                          [缔结]            [背离]
组织甲                        ├────────┤ 独立
条约X                        ═══════════════════════════ 有效期缎带
历史                          + 事件甲        + 事件乙        + 事件丙
```

规则与联动：

1. **主泳道是政权**：泳道高度随 `level.rank`；有向左右为世界时间，`meta.time` 决定起止；终端状态泳道变灰但保留可读性。
2. **沿革锚点来自两处**：`items.chronicle` 提供政治侧事件；`history.milestone_of` / `history.occurs_at` / `history.involves` 提供历史事件 / 时代。两者按时间合并，历史事件用 `flag` 标记，点击跳转历史事件详情；历史模块为空时只显示政治侧锚点，不报错。
3. **条约有效期缎带**：由 `TreatyMeta.effectiveAt / expiresAt` 与 `time` 绘制；到期或违约用状态色分段，点击缎带打开条约详情。
4. **组织与人物可选叠加**：组织存续期以细线显示；核心人物任职带可切换显示，继承边在任职交接处画短箭头。
5. **时间轴联动**：从历史模块进入时共享缩放与平移范围；面包屑保留来源，支持返回历史事件。历史时代的 `parent_id` 层级只影响历史侧的分组，政治沿革不重复建层级。
6. **筛选**：等级、状态、时间范围、是否显示已灭亡；筛选只影响可见泳道，不改变数据。

### 4.6 条约缎带与「条约簿」

```text
         政权甲 o══════════════════════════════════o 政权乙
               ║ 条约X        生效 ... - 失效 ...  ║
               ║ 类型 用户自定义     状态 存续      ║
               ╚═══════════════╦════════════════════╝
                               v 点击缎带中点展开
               ┌ 条款 ───────────────────────────────┐
               │ 1  条款标题    内容摘要      [编辑]  │
               │ 2  条款标题    内容摘要      [编辑]  │
               │ + 添加条款                           │
               └──────────────────────────────────────┘

条约簿（次级抽屉，不是主视图）
[类型 v] [状态 v] [缔约方 v] [搜索]                          [+ 新建条约]
┌──────────────────────────────────────────────────────────────────────────────┐
│ 名称     类型      缔约方              生效      状态   条款  修订  关联  操作│
│ 条约X    用户定义  政权甲, 政权乙      ...       存续   5     1     出3  [打开]│
│ 条约Y    用户定义  政权甲, 组织甲      ...       失效   3     0     出2  [打开]│
└──────────────────────────────────────────────────────────────────────────────┘
```

条约呈现规则：

1. **画布上不出现条约卡片**。缎带由同一条约的 `politics.signatory_of` 集合投影：单缔约方画节点旌旗；双方画直连缎带；三方及以上画多段缎带并在公共中点聚合展开。
2. **缔约方是节点、条约是边**。缎带两端吸附政权 / 组织节点，选中缎带同时高亮所有缔约方。
3. **条款就地展开**。点击缎带中点先出轻量条款浮层，列表只显示标题与摘要；需要编辑时升级为固定抽屉。
4. **条约簿只做检索与批量维护**。入口在关系层图例、政权详情「条约」段、命令面板；打开后不改变画布状态，也不与三主视图并列。
5. **有效性表达**：生效中为完整缎带；到期 / 失效为半透明并在中点显示状态；违约状态加警示描边与 `breachState` 文本，不用颜色单独承载语义。
6. **旧数据兼容**：历史 `treaty_between` 数据在展示层合并到缔约方集合；保存时写回 `signatory_of`。

### 4.7 关系层开关与图例

```text
关系层
┌───────────────────────────────────────────────┐
│ [x] 同盟      ─────   handshake               │
│ [x] 敌对      ═════   swords                  │
│ [x] 附庸      ┄┄┄>    chevron-down            │
│ [x] 贸易      ─────   arrow-left-right        │
│ [ ] 联姻      ═════   heart-handshake         │
│ [x] 条约      ═══ 缎带 pen-line               │
│ [ ] 自定义    ·····   link-2                  │
│ 仅看与选中节点相关  [开]                       │
└───────────────────────────────────────────────┘
```

1. **类型筛选**：每个 `politics.*` 关系类型一行；勾选控制画布边层与沿革叠加，不影响数据。
2. **条约与关系线区分**：条约是宽缎带（双线 + 缔约方锚点）；一般关系是细线（实线 / 虚线 / 双线 + 箭头）。两者不共用同一图层，避免误读。
3. **方向**：有向边画箭头并使用 reverseLabel 展示反向；对称边不画箭头，命中一条只渲染一次。
4. **悬停与点击**：悬停边显示摘要（两端、类型、时间、备注）；点击打开边卡，可直接编辑时间、备注、强度（沙盘）。
5. **聚焦降噪**：聚焦某政权时，默认只保留与它直接相连的边；其余边降到 10% 透明度，可通过「仅看与选中节点相关」的开关关闭降噪。
6. **自定义边**：`ModuleConfig.linkTypes` 注册的自定义类型出现在列表末尾，默认不勾选，避免首屏噪声。

### 4.8 统一 LinkPanel（四类实体详情的公共区域）

```text
关联   [出链 14]  [入链 9]                         [按模块分组 v]
┌──────────────────────────────────────────────────────────────────────┐
│ 历史                                                                 │
│  [flag]      大事记    事件甲 · 事件        ...            [跳转]    │
│  [map-pin]   发生于    政权甲 · 政权        ...            [跳转]    │
│ 经济                                                                 │
│  [gavel]     受管制    市场甲 · 市场        ...            [跳转]    │
│ 政治                                                                 │
│  [handshake] 同盟      政权乙 · 政权                                │
│  [pen-line]  签署方    条约X · 条约                                │
│ 角色                                                                 │
│  [user-round] 效力于   角色甲 · 角色                                │
│                                                    [+ 添加关联]      │
└──────────────────────────────────────────────────────────────────────┘
```

1. **位置统一**：政权、组织、人物、条约四类详情底部都挂同一个 LinkPanel 组件；组织与人物是紧凑面板，条约可折叠条款后仍保留关联区。
2. **分组规则**：按目标模块分组（历史 / 经济 / 政治 / 种族 / 体系 / 角色 / 地图），组内按注册表顺序排序；反向关系显示 reverseLabel（如 `附庸于` 的反向是 `宗主`）。
3. **行内容**：类型图标 + 类型标签 + 目标名 + 目标 kind 徽章 + 时间范围 + 备注摘要；目标名按 id 实时解析，失效引用显示警示 chip。
4. **跳转**：点击行进入目标实体详情，面包屑保留来源，返回时恢复筛选与画布视口；hover 显示目标预览卡，不触发跳转。
5. **入链处理**：入链区展示「被谁引用」，不提供直接的删除按钮，点击跳到源实体修改；出链行 hover 出现解除操作并二次确认。
6. **添加关联**：走契约 5.2 的通用实体选择器：选模块 → 搜索 / 筛选实体（支持 kind 过滤、最近使用、当前画布内实体）→ 选关联类型（按源 / 目标 kind 自动过滤合法类型）→ 可选填时间 / 备注 / 强度 → 保存；支持多选批量建同类型边。
7. **行内引用**：描述与备注输入框支持 `@` 打开选择器，插入 `[[politics:polity:id|名称]]` 形式的 token；渲染为可点击 chip，失效时保留原文并标注。
8. **计数徽章**：画布节点与名录行右上角显示关联计数，进入详情后展开出 / 入链；sketch 档位只显示计数与行内引用。

### 4.9 响应式、暗色与动效

| 断点 | 布局 | 降级策略 |
|------|------|----------|
| 宽屏 >= 1440px | 左导航 + 画布 + 右详情三栏 | 全功能：关系层、卫星、任务条、条约缎带 |
| 中屏 1024-1439px | 画布 + 可覆盖右详情 | 独立势力带折叠；头像条最多 3 个；缎带悬停展开 |
| 窄屏 768-1023px | 画布全宽，详情为底部 sheet | 关系层收进筛选面板；名录优先；画布只保留政权层 |
| 移动 < 768px | 名录优先，画布为只读缩略 | 不提供画布编辑；详情全屏；条约簿变为列表页 |

- **暗色模式**：领域色、状态色、边色都给 light / dark 两套值；画布底纹在暗色下降低纹理对比度，避免噪点。正文对比度不低于 WCAG AA。
- **动效**：聚焦 / 展开 150-300ms，统一缓动；条约缎带只在首次出现时绘制生长动画；`prefers-reduced-motion` 下关闭所有非必要动画，聚焦改为直接切换。
- **可访问性**：画布节点支持键盘 Tab 遍历与 Enter 打开；边可用关系列表替代访问；颜色不单独承载语义，状态始终伴随文字标签；图标按钮必须有 `aria-label`。
- **图标**：全部使用 Lucide 名，存图标名而不是字符；实体图标由 `EntityTypeDef.icon` 决定，关系图标由 LinkTypeDef 决定。
---

## 5. 交互设计

### 5.1 视图切换与全局操作

1. **三视图切换**：顶部分段控件「版图 / 名录 / 沿革」，键盘 `1` / `2` / `3`；切换写入 URL query，保留当前筛选与聚焦对象。
2. **层级导航**：左侧「全部 / 政权 / 组织 / 人物 / 条约」是过滤器，选中后三视图同步过滤，不改变形态与权重。
3. **命令面板**：`Ctrl/Cmd + K` 打开，可搜索实体、切换视图、打开条约簿、新建政治实体。
4. **快捷键**：`/` 搜索，`N` 新建，`F` 聚焦选中项，`P` 固定详情面板，`L` 开关关系层，`Esc` 逐级返回（边卡 → 详情 → 聚焦 → 全局），`Delete` 删除选中实体。
5. **画布导航**：滚轮缩放，拖拽平移，`Shift + 拖拽` 框选；双击空白处快速新建政权；双击节点进入聚焦。

### 5.2 创建政权与组织（最短路径）

```text
[+ 新建政权]
┌──────────────────────────────────────────────┐
│ 名称    [____________________]  必填         │
│ 等级    [选择或新建等级 v]      必填         │
│ 统治者  [选择全局角色 v]        可选         │
│         （可直接快速新建角色，政治侧只建引用）│
│ 其余字段（政体 / 时间 / 描述）创建后补充      │
│                          [取消] [创建并聚焦] │
└──────────────────────────────────────────────┘
```

- **创建政权**：以上三项即可保存。等级为空时提供「新建等级」内联入口（label + rank + color），不预置任何等级名。
- **创建组织**：两个入口——政权卡的「+ 组织」预填 `scope=intra_polity` 并自动建 `politics.subordinate_to` 边；独立势力带的「+ 新建」预填 `scope=independent`。必填只有名称与组织子类型，子类型可现场新建。
- **创建人物**：从政权卡「+ 人物」或名录人物区「+ 关联人物」进入。先选全局 Character（支持搜索、最近使用、快速新建），再填政治身份、职位与任期、是否主要；保存时写 `politics.member_of` 或 `politics.leads` 边。同一 Character 在同一世界默认只建一个 figure 记录，重复选择时复用并合并任职。
- **创建沿革条目**：在政权详情的「沿革」段内联添加；标题 + 时间即可，历史事件通过后续「添加关联」挂接。

### 5.3 创建条约与关系边

```text
从政权甲节点拖出，落到政权乙节点
┌ 新建条约 ──────────────────────────────────────┐
│ 缔约方    [政权甲] [政权乙]  [+ 添加缔约方]     │
│ 名称      [____________________]  必填          │
│ 类型      [选择或新建类型 v]                    │
│ 生效/到期 [________] - [________]               │
│ 条款      创建后在缎带中点添加                  │
│                            [取消] [创建缎带]    │
└─────────────────────────────────────────────────┘
```

- **条约创建**：三个入口——关系层「+ 条约」、从节点拖边到另一节点、政权详情「条约」段的「+ 新建」。保存时创建 treaty 记录与多条 `politics.signatory_of` 边；缔约方 ≥ 2 才画缎带，单缔约方画旌旗。条款、修订创建后补充。
- **关系边创建**：从节点 A 拖到节点 B，弹出类型选择器，只列出源 / 目标 kind 合法的 `politics.*` 类型；有向边询问方向（默认 A → B）；可填时间、备注、强度（沙盘）；对称边只落一条。
- **批量建边**：多选节点后按 `R`，统一选择关系类型，两两建立同类型边（适合同盟 / 贸易网络）。
- **边卡**：点击任意边打开；显示两端、关联类型、时间、备注、强度；行内可改时间与备注；删除需二次确认并列出影响范围。
- **归属变更**：把组织卫星从政权甲拖到政权乙 = 改 `politics.subordinate_to` 边，不重建组织；确认框说明会影响的 scope 与统计。

### 5.4 编辑、删除与撤销

1. **就地编辑**：画布卡与名录行支持双击改名称、等级、状态、时间；政体、沿革、条款等长内容在详情面板编辑。
2. **等级变更即时反映权重**：改 rank 后节点尺寸与布局环 150-300ms 过渡到新位置；不改变 kind 与其他数据。
3. **删除政权**：确认框列出受影响的卫星组织、人物任职边、条约缔约边、跨模块关联；提供三种处理：级联删除关联（默认）、把卫星组织提升为独立势力、保留失效引用。删除确认必须逐项列出，不静默级联。
4. **删除组织 / 人物 / 条约**：组织删除后其成员边与下辖组织按同样的三选项处理；人物删除只删政治身份与任职边，不删全局角色；条约删除同时解除 `signatory_of` 边。
5. **撤销**：删除边、改变归属、批量改等级提供 5 秒撤销 toast；跨实体删除不进撤销栈，走确认流程。

### 5.5 聚焦、跳转与筛选

1. **聚焦**：单击政权进入聚焦；画布高亮其领土（地图接入时）、组织卫星、核心人物与全部对外边，其余内容降噪。聚焦不是独立页面，URL query 记录 `focus=politics:polity:id`，可分享。
2. **固定**：详情面板的「固定」让面板在画布继续操作时不关闭，适合对照多个政权；同时固定多个时以堆叠抽屉呈现，最多 3 个。
3. **跨模块跳转**：LinkPanel、卡片上的计数徽章、详情段落标题都可跳转目标模块；面包屑保留来源，返回时恢复筛选、缩放与视口。
4. **搜索**：覆盖名称、政治别名、kind、等级、状态、时间范围、关联类型、标签、自定义字段值；支持 `kind:`、`level:`、`status:`、`has:treaty`、`linked:history` 等前缀。人物搜索同时命中全局 Character 名称，但结果仍是政治身份。
5. **筛选**：左侧层级导航 + 顶栏筛选器；筛选条件在三个视图之间共享；独立势力带可单独折叠。
6. **悬停预览**：节点、缎带、LinkPanel 行都支持 hover 预览卡；预览卡只读，不改变焦点。

### 5.6 时间维度交互（沙盘）

1. **时间滑杆**：版图底部出现世界时间滑杆，拖动时按 `meta.time` 与 `WorldLink.time` 过滤可见实体与边；不删除数据。
2. **时点快照**：滑杆停在某时点时，条约只有生效区间覆盖该时点才画缎带，人物只在任职区间出现在头像条与任职带，终端状态实体按状态规则淡出。
3. **区间对比**：可拖出 A / B 两个时点做前后对照，差异只做高亮，不生成新数据。
4. **沿革联动**：沿革视图的缩放 / 平移与时间滑杆双向同步；从历史事件跳入时自动定位到事件时间。

### 5.7 校验规则

| 级别 | 规则 |
|------|------|
| 阻断 | 政权必填名称与等级；组织必填名称与 scope；人物必填 characterId；条约必填名称 |
| 阻断 | 有向边不得自环；组织树不得成环；对称边重复创建时合并为一条 |
| 阻断 | 边类型必须匹配源 / 目标 kind；不匹配只能使用通用三型 |
| 警告 | 人物任职时间早于角色出生或晚于角色离世（角色数据只读，仅提示） |
| 警告 | 条约到期早于生效；沿革条目时间落在政权存续区间之外 |
| 警告 | 政权 / 组织时间区间与 `politics.vassal_of` 关系时间不一致 |
| 提示 | 条约没有缔约方或条款；政权没有统治者；组织没有归属边；人物没有任职 |
---

## 6. 与历史 / 政治 / 经济 / 种族 / 体系 / 角色 / 地图的关联设计

### 6.1 关联落地总表

| 目标模块 | 使用关联类型 | 政治侧落点 | 目标侧反向呈现 |
|----------|--------------|------------|----------------|
| 历史 | `history.milestone_of`、`history.occurs_at`、`history.involves`、`history.causes` / `history.caused_by` | 沿革视图、政权 / 组织详情「沿革」、LinkPanel | 事件 / 时代详情列出相关政权、组织、人物 |
| 经济 | `economy.regulated_by`、`economy.taxed_by`、`economy.supplies`、`economy.owned_by`、`economy.currency_of` | 政权详情「经济基础」、条约详情、组织详情、LinkPanel | 经济实体详情显示受哪个政权管制 / 归谁所有 |
| 种族 | `politics.includes_race` | 政权详情「人口构成」、版图人口提示、LinkPanel | 种族详情显示构成于哪些政权 |
| 种族（人物佐证） | `character.belongs_to_race`、`races.notable_figure` | 人物身份卡、人口构成佐证 | 种族详情列出代表人物 |
| 体系 | `systems.practiced_by` | 政权 / 组织详情「体系」、LinkPanel | 体系详情列出推行政权与组织 |
| 体系（人物佐证） | `character.practices_system`、`character.attained` | 人物身份卡、政权体系分布 | 体系 / 境界详情列出相关角色 |
| 角色 | `character.serves`、`character.owns`、`character.appears_in` | 人物身份卡跳全局角色；政权详情聚合成员 | 全局角色页显示效力、掌控、登场 |
| 地图 | `politics.controls_region`、`politics.capital_at` | 版图领土层、政权详情「领土 / 首府」 | 地图地区详情显示控制政权（地图接入后） |
| 政治（模块内） | `politics.ally_of`、`politics.at_war_with`、`politics.vassal_of`、`politics.trades_with`、`politics.marriage_tie`、`politics.succeeds` | 关系层、详情「关系」段、任职带 | 对端节点显示同一关系 |
| 特殊 | `core.references` / `custom.link` | LinkPanel 通用区 | 本轮不动特殊界面 |

### 6.2 与历史

1. **沿革的双来源**：政权详情的「沿革」段把 `items.chronicle` 的政治侧锚点与入链 `history.milestone_of` / `history.occurs_at` / `history.involves` 按时间合并。历史事件用 `flag` 标记；点击跳转历史事件详情并保留面包屑。
2. **时代直接参与**：契约允许 `history.era` 作为 `occurs_at` / `involves` / `milestone_of` 的源，政治侧把时代作为一条跨时间段的背景带叠加在沿革视图顶部，不重复建时代—事件层级。
3. **事件因果**：`history.causes` / `history.caused_by` 只做二级信息，出现在沿革条目展开区与 LinkPanel；政治不修改因果关系。
4. **反向呈现**：历史事件详情的 LinkPanel 列出涉及的政权、组织、人物；点击回到政治聚焦。
5. **空历史不阻塞**：历史模块为空时，沿革视图只画政权 `meta.time` 与政治侧条目；不显示错误或伪造事件。
6. **跳转语义**：历史 → 政治使用「涉及 / 发生于 / 大事记」的正向关系；政治 → 历史使用 reverseLabel 展示（发生于 ↔ 发生事件、大事记 ↔ 收录大事记）。

### 6.3 与经济

1. **政权详情「经济基础」**按关系类型分组，不复制经济数值：
   - 受管制 `economy.regulated_by`：经济实体 → 政权 / 条约；显示「经济实体名 · 类型」并可跳转。
   - 征税 `economy.taxed_by`：市场 / 产业 → 政权。
   - 供给 `economy.supplies`：市场 / 产业 → 政权 / 组织。
   - 归属 `economy.owned_by`：经济实体 → 政权 / 组织 / 角色。
   - 货币 `economy.currency_of`：货币 → 政权。
2. **条约也是管制来源**：`economy.regulated_by` 的目标可以是 treaty，条约详情显示「本条约管制的经济实体」，并从条款中引用相关经济实体（通过关联，不写 id）。
3. **组织经济**：组织详情用同一组关系显示其掌控的市场 / 产业 / 资源；组织可以在经济模块被建模为 actor / institution 时由经济侧引用。
4. **呈现方式**：速写只显示计数与分组标题；结构显示前若干行与「查看全部」；沙盘可叠加经济模块提供的流量线宽，但政治侧不计算流量。
5. **跳转**：每行跳经济实体详情；经济实体详情反向显示所属 / 受管制的政权与条约。
6. **空经济不阻塞**：经济模块为空时，「经济基础」只显示 `items.economy_base` 摘要与「去经济模块创建实体」入口；不显示空图表。

### 6.4 与种族

1. **规范关联**：`politics.includes_race`（政权 → 种族 / 亚种；反向 `构成`，teal 虚线）是人口构成的唯一规范边。边的 `meta` 可存 `{ share?: number, note?: string }` 表达占比与备注；占比是可选补充，不强制。
2. **人口构成区**：政权详情「人口」段显示构成条与列表（种族名、占比、备注、跳转）。构成条用色阶表达比例，旁边始终有文本标签与百分比，颜色不单独承载语义。
3. **人物佐证**：人物的 `character.belongs_to_race` 关联可聚合出「统治集团 / 核心人物中的种族分布」，作为人口构成的佐证信息展示，并明确标注来源。`races.notable_figure` 反向出现在人物身份卡。
4. **图谱入口**：从种族详情点击「构成于」回到政权；从政权点击种族 chip 跳到种族图鉴。
5. **空状态**：没有 `includes_race` 边时，显示「添加种族构成」入口；种族模块为空时同时提供「去种族模块创建第一个种族」。
6. **旧数据迁移**：旧 `racialComposition` 数组在展示层转换为 `includes_race` 边；保存时写回新结构。

### 6.5 与体系

1. **规范关联**：`systems.practiced_by`（体系 → 种族 / 组织 / 政权；标签「修习 / 推行」）是政权与组织层面的唯一规范边。政权详情「体系」段显示哪些体系在本政权被推行或修习；组织详情显示本组织修习的体系。
2. **人物佐证**：`character.practices_system`、`character.attained` 聚合核心人物与统治集团的体系分布，标注「个人」来源；沙盘档位显示境界分布条。
3. **反向呈现**：体系详情的 LinkPanel 列出推行 / 修习它的政权与组织；从政权 chip 跳体系进阶图。
4. **只读边界**：体系的进阶、前置、代价、克制关系由体系模块维护；政治侧只引用名称与跳转，不复制规则。
5. **空状态**：没有关联时显示「关联体系」入口；体系模块为空时提供跳转创建。

### 6.6 与全局角色

1. **身份引用**：`FigureMeta.characterId` 是必填 1:1 身份键；政治侧不复制姓名、头像、种族、生平、体系境界。展示名与头像从全局 Character 实时解析，角色改名自动刷新。
2. **人物身份卡**：第一行是全局角色档案入口（头像 + 解析名 + 种族 / 体系摘要），下方才是政治身份、职位、任期、派系。点击头像跳角色档案，面包屑保留政治来源。
3. **双向呈现**：全局角色页展示 `character.serves` / `character.owns` / `character.appears_in` / `character.belongs_to_race` / `character.practices_system`；政治详情只显示与自己相关的角色切片。
4. **人物创建**：政治侧选择器可快速新建全局 Character（只填名称即可），随后创建 figure 记录与任职边；同一世界同一 Character 只建一个 figure，重复选择时复用并合并任职。
5. **失效处理**：角色不存在时 figure 显示「未绑定角色」警示与重新绑定入口；不影响政权、组织、条约的其余展示。

### 6.7 与地图（可选接入，本轮不动）

1. **接入检测**：以地图模块是否可用为准。未接入时，领土 / 首府的新建入口、画布领土层、首府徽章整块隐藏，不显示占位按钮；已有链接以只读行保留，点击提示地图未接入。
2. **接入后**：`politics.controls_region` 在画布上以领土色块叠加，`politics.capital_at` 绘制首府锚点；政权卡显示首府徽章。点击地区跳地图模块。
3. **不阻塞**：地图不是政治模块的前置条件；速写路径完全不依赖地图。
4. **边界**：本轮不改地图模块、不做领土绘制编辑器；地图侧如何呈现控制政权由地图模块设计。

### 6.8 关联一致性

- 所有关联独立存 `WorldLink`，政治侧不在 `content` 内写实体 id。
- 创建时按契约校验源 / 目标 kind；不匹配只能使用通用三型。
- 列表页批量统计出入链数量并缓存；详情 LinkPanel 按模块分组懒加载。
- 删除实体时按契约处理级联或失效引用；失效边以警示 chip 展示，提供一键清理。

### 6.9 模块内政治关系

1. 同盟、敌对、贸易、联姻是对称边，只存一条；附庸、继承、领导、隶属、缔约是有向边，反向展示用 reverseLabel。
2. 政权之间的边画在版图；人物之间的继承 / 联姻边在聚焦或沙盘显示；条约是特殊边，由 signatory_of 投影为缎带。
3. 关系可带 time 与 meta（强度、备注）；沙盘按强度映射线宽，结构档只显示文字。
4. 关系变化不改变实体归属；删除关系不回滚实体数据。
---

## 7. 自定义能力

### 7.1 kind 与子模块结构

1. **四个内置 kind**：polity、organization、figure、treaty，由 `ModuleConfig.entityTypes` 注册，label、icon、color、description 均可改。
2. **自定义 kind**：用户可以添加 `custom_xxx` kind（派系、教团、军阀、委员会……名称由用户输入，模块不预置）。自定义 kind 必须声明它附着在哪一层：附着政权（像 organization 一样嵌在卡片内）、独立势力（进独立势力带）或关系记录（像 treaty 一样作为边载荷）；禁止新增平级主视图。
3. **组织树**：`parent_id` 只用于 `organization`，最多 3 层；跨政权组织不建树，用归属边与 scope 表达。
4. **政权无父级**：政权不建 `parent_id` 层级；上下位关系用 `politics.vassal_of` 边；`figure` 与 `treaty` 的 `parent_id` 恒为 null。
5. **kind 决定形态**：自定义 kind 继承其附着层的卡片形态与交互，不复制一套新 Tab。

### 7.2 等级与状态

| 配置 | 作用 | 默认 |
|------|------|------|
| `LevelDef.label` | 用户自己的等级名（例如用户可能输入「超级大国 / 王国 / 城邦」，这些只是可能输入，不是模块内置） | 空 |
| `LevelDef.rank` | 权重：rank 越高节点越大、越靠中心、详情默认展开越多 | 空 |
| `LevelDef.color` | 等级徽章色 | 空 |
| `StatusDef.label` | 用户自己的状态名（例如「存续 / 已灭亡 / 流亡」是可能的输入，不是内置选项） | 空 |
| `StatusDef.isTerminal` | 终端状态：画布降为幽灵节点、沿革保留、名录可筛选 | 空 |
| `StatusDef.color` | 状态色；必须同时显示文字，不单独用颜色 | 空 |

- 等级用于政权与组织；人物不使用等级尺寸，避免与政权争视觉权重。
- 状态可用于政权、组织、条约；人物政治状态由自定义字段或任职边表达。
- 允许同一等级体系内 rank 相同；相同 rank 用 order_index 与名称排序，布局环内不重叠。

### 7.3 自定义字段

1. `ModuleConfig.fieldSchema[kind]` 存放 `CustomFieldDef[]`；内置字段组仍来自 `items`，两者在详情页合并展示，先内置后自定义。
2. 字段类型使用契约定义：text / textarea / number / select / multiselect / date / entityRef / image。
3. `entityRef` 字段通过 `entityRefFilter` 限制目标模块与 kind，选择器仍走统一实体选择器；字段值保存 `EntityRef`，不保存裸 id 字符串。
4. 自定义字段可用于政权的社会结构、组织的入会条件、人物的头衔体系、条约的批准程序等任意用户语义。
5. 删除自定义字段时保留历史值到导出备份，但界面不再展示；不做静默数据清洗。

### 7.4 自定义关联

1. 入口：`ModuleConfig.linkTypes` 添加 `CustomLinkTypeDef`；必须声明 id、label、reverseLabel（有向时）、directed、icon（Lucide 名）、color、source / target 模块与 kind 范围。
2. 自定义关联与契约核心类型使用同一套 LinkPanel、边层与选择器；创建时做同样的 kind 校验。
3. 自定义关联默认不在关系层勾选显示，用户打开后记住偏好；边卡中标注「自定义」来源。
4. 自定义关联不能覆盖或修改契约核心类型；需要调整核心语义时回到契约层评审，不在模块内私改。
5. 自定义关联同样遵守对称只存一条、有向存一条、删除级联与失效引用的规则。

### 7.5 术语、配色与图标

| 能力 | 载体 | 说明 |
|------|------|------|
| 术语替换 | `ModuleConfig.terminology` | 可把「政权 / 组织 / 人物 / 条约」替换为用户世界的词；仅影响展示 |
| 领域配色 | `ModuleConfig.palette` | 红金默认 token；用户可改 accent / surface，需保证对比度 |
| 实体图标 | `EntityTypeDef.icon` | 四个内置 kind 默认 landmark / shield / user-round / scroll-text，均可改 |
| 等级 / 状态色 | `LevelDef.color` / `StatusDef.color` | 同时提供 light / dark 两套值 |
| 关系图标 | LinkTypeDef.icon | 核心类型随契约；自定义类型由用户指定 Lucide 名 |

全部图标使用 Lucide 名（kebab-case），文档与界面都不使用 emoji。

### 7.6 空白世界声明

- 新建世界的政治模块默认只有空状态与引导，不包含任何政权、组织、人物、条约、等级、状态、政体、派系或示例数据。
- 本文 ASCII 原型中的「政权甲 / 组织甲 / 种族A」等全部是占位符，不是预置内容。
- 用户可通过世界备份 / 数据迁移导入自己的世界，但政治模块不提供模板市场、推荐模板或世界观类型选择器。
- 3 分钟最小路径在空白世界上直接可用，不要求先配置模块。
---

## 8. 复杂度分层（速写 / 结构 / 沙盘）

### 8.1 三档总表

| 能力 | sketch 速写 | structure 结构 | sandbox 沙盘 |
|------|-------------|----------------|--------------|
| 版图 | 只画政权节点、统治者头像条 | 全部图层：政权 / 组织卫星 / 独立势力 / 人物条 / 关系边 / 条约缎带 | 结构全部能力 + 时间滑杆 + 流量叠加 + 统计 |
| 政权详情 | 概览 + 统治者 | 六段全开 + 完整 LinkPanel | 六段 + 时间有效性 + 派生分布 + 图谱入口 |
| 组织 | 只显示计数 | 卫星 chip、成员、归属 | 成员网络、跨政权分布 |
| 人物 | 头像条 | 任职带 + 紧凑行 | 人物关系边、继承 / 联姻、体系分布 |
| 条约 | 只显示数量 | 缎带 + 条款展开 + 条约簿 | 有效期动画、违约高亮、时点快照 |
| 沿革 | 政权时间条 | 兴亡线 + 条约有效期 + 沿革条目 | 叠加历史事件、区间对比、播放 |
| 关联 | 计数 + 行内引用 | LinkPanel + 通用选择器 | 时间 / 强度 / 流向、世界脉络入口 |

### 8.2 sketch（默认档）

- **目标**：3 分钟立起主干。打开政治模块先看到空状态引导，创建第一个政权后立刻出现节点。
- **可见**：政权节点（名称、等级、状态、政体、首府、统治者头像条）；节点尺寸按 rank。
- **隐藏**：组织卫星、人物层边、条约缎带、关系画布、沿革细节、地图领土层（地图未接入时本来也隐藏）。
- **保留入口**：详情里的「升级到结构」提示、关联计数徽章、行内引用。
- **不丢数据**：从结构降档只隐藏，不删除；再次升档恢复。

### 8.3 structure

- **版图完整**：政权层 + 卫星簇 + 独立势力带 + 头像条 + 任职带 + 关系边 + 条约缎带；关系层可逐类筛选。
- **详情六段**：概览 / 机构 / 人物 / 关系 / 条约 / 沿革；LinkPanel 完整出 / 入链分组与通用选择器。
- **名录可用**：政权主行展开组织与人物；条约簿可打开；独立势力单独分组。
- **沿革可用**：政权兴亡线 + 条约有效期 + 政治侧沿革条目；历史模块有数据时叠加事件标记。
- **适用**：世界已有主干，需要维护组织、人物与关系；日常使用的主要档位。

### 8.4 sandbox

- **时间维度**：底部时间滑杆、时点快照、区间对比；实体与边按 `meta.time` / `WorldLink.time` 过滤。
- **数值与流向**：关系强度映射线宽；经济模块提供流量时叠加供给 / 流通线宽；政权统计面板显示组织数、人物数、条约数、关系密度。
- **派生分布**：人口种族分布、核心人物体系分布、统治集团构成；全部标注来源与是否完整。
- **世界脉络入口**：按契约 5.4，世界脉络默认只在 sandbox 显示，structure 可手动开启；入口属于全局界面，不重复实现在政治模块内。
- **沿革播放**：沿革视图可按时间播放政权兴亡与条约更替；`prefers-reduced-motion` 下改为逐帧跳转。

### 8.5 升降档行为

1. 降档只隐藏组件，不删除数据；隐藏前给出一次性提示，可用「不再提示」记忆。
2. 升档后恢复全部字段与视图；此前在低档创建的数据按默认值补齐展示。
3. 复杂度是模块级默认（`ModuleConfig.defaultComplexity`），用户可在政治模块顶栏随时切换；单个世界可有不同模块的档位。
4. 复杂度的判断依据是「用户当下要做什么」：立主干用速写，维护结构用结构，推演关系用沙盘；不得因档位不同产生不同的数据语义。
---

## 9. 空状态与引导

### 9.1 模块空状态

```text
┌────────────────────────────────────────────────────────────┐
│ [landmark]                                                 │
│ 政治模块还是空白                                           │
│ 先立主干，再挂卫星，最后连边。                             │
│                                                            │
│ [ 创建第一个政权 ]      [ 了解权力版图 ]                   │
│                                                            │
│ 三步得到一张会生长的版图：                                 │
│  1  政权：名称 + 等级 + 一位统治者                         │
│  2  组织：从政权卡内添加卫星                               │
│  3  关系：拖出边，或从节点发起条约缎带                     │
└────────────────────────────────────────────────────────────┘
```

### 9.2 局部空状态

| 场景 | 文案 | 动作 |
|------|------|------|
| 版图无政权 | 政治模块还是空白 | 创建第一个政权 / 查看引导 |
| 筛选后无结果 | 没有符合条件的政权 | 清除筛选 / 放宽等级或状态 |
| 名录为空 | 还没有可维护的政治实体 | 新建政权；或从版图引导进入 |
| 政权无组织 | 还没有组织卫星 | 添加组织 / 标记为独立势力 |
| 政权无人物 | 还没有人物任职 | 关联全局角色 |
| 政权无条约 | 还没有缔约记录 | 发起条约 |
| 沿革无历史 | 历史模块还没有可关联的事件 | 添加政治沿革条目 / 去历史模块 |
| 条约簿为空 | 还没有条约 | 发起第一个条约 |
| LinkPanel 为空 | 还没有关联 | 添加关联；输入 @ 插入行内引用 |
| 地图未接入 | 不显示空状态；领土 / 首府入口整体隐藏 | 无 |
| 人物未绑定角色 | 该政治人物尚未绑定全局角色 | 绑定角色 / 创建角色 |
| 组织无归属 | 该组织不属于任何政权 | 归入政权 / 保留为独立势力 |
| 等级或状态为空 | 还没有等级定义 | 内联新建等级 / 状态 |

### 9.3 引导策略

1. **三步引导卡**：空白世界显示「政权 → 组织 → 关系」三步；完成一步打勾收起，不重复弹出。
2. **引导不预填**：所有示例只是文案，不向表单写入任何默认等级、政体、状态或名称。
3. **渐进提示**：只在相关位置出现，如政权卡首次展开时提示「可以添加组织卫星」，不铺满整个界面。
4. **可跳过**：引导可一键关闭，并可在设置中重新打开；不影响任何功能可用性。
---

## 10. 世界生成后的最小可用路径（3 分钟）

### 10.1 路径

```text
0:00  新建政权
      └─ 名称（必填）
      └─ 等级（必填；可内联新建第一个等级）
      └─ 一位统治者（全局角色选择器；可只填名称快速新建角色）
          │
0:40  保存并聚焦
      └─ 版图出现政权节点，尺寸按 rank
      └─ 右侧详情打开，统治者任职带生成
          │
1:10  可选：添加一个组织卫星
      └─ 政权卡内「+ 组织」，预填 scope=intra_polity 与下属于边
          │
1:40  可选：拖出一条关系边
      └─ 同盟 / 敌对 / 附庸 / 贸易，类型选择器自动过滤合法项
          │
2:10  可选：发起一条条约缎带
      └─ 从节点拖到另一节点，填名称与缔约方，条款稍后补
          │
2:40  可选：添加一条沿革
      └─ 标题 + 时间即可；历史事件之后通过「添加关联」挂接
          │
3:00  得到：1 个政权 + 1 位统治者 + 可选组织 / 关系 / 条约
      其余留白，不阻塞后续生长
```

### 10.2 完成后具备什么

1. 版图上有一个按等级确定尺寸与位置的政权节点。
2. 政权卡上有统治者头像与任职带；详情「概览」显示名称、等级、状态、统治者。
3. 名录中出现政权主行，关联计数徽章可打开空 LinkPanel 并添加关联。
4. 沿革视图至少画出 `meta.time`（若填写）或一个默认起点；未填时间不报错。
5. 组织、条约、历史、经济、种族、体系、地图全部可以为空，不出现阻断式报错。

### 10.3 不阻塞原则

- 必填只有政权名称、等级、一位统治者（统治者可跳过）；其余字段创建后随时补充。
- 不要求先配置等级体系、政体、状态、地图或任何其他模块。
- 快速新建角色只要求名称；种族、体系、生平留到角色模块补充，政治侧不复制。
- 创建过程自动保存草稿；中途关闭再进入可继续，不丢失已填内容。
---

## 11. 性能与实现建议

### 11.1 渲染

1. **DOM 与画布分层**：政权卡、卫星、人物条用 DOM 渲染，保证可访问性与就地编辑；关系边、条约缎带、领土底纹用 SVG / Canvas 图层，减少 DOM 节点数。
2. **视口裁剪**：只渲染视口内节点与边；缩放级别做 LOD——拉远只画政权节点与主干边，拉近才画卫星、人物条与全部边。
3. **边聚合**：人物间边默认不画；同一对节点的多条同类边聚合为一条并在边卡内展开。条约缎带按 treaty 缓存投影结果，缔约方集合变化时才重算。
4. **动画预算**：聚焦降噪、展开面板、缎带绘制使用 150-300ms 动画；同一帧只允许一个布局动画；`prefers-reduced-motion` 下全部改为即时切换。
5. **列表虚拟化**：名录超过 200 行启用虚拟滚动；详情内成员列表分页加载。

### 11.2 数据与查询

1. 列表页批量查询出入链计数并缓存；进入详情才按模块分组懒加载 LinkPanel。
2. 版图首屏一次取政权列表与计数，再按视口分页取卫星 / 核心人物 / 缎带，避免 N+1。
3. 派生结果（人口分布、体系分布、任职带）按实体版本号缓存；实体或关联变更时失效。
4. 时间过滤条件下推查询，不只在前端过滤；但任何档位都不因过滤写回数据。
5. 条约缎带缓存键 = treaty id + 缔约方集合版本；失效引用只做标记，不阻塞渲染。

### 11.3 降级阈值

| 规模 | 策略 |
|------|------|
| 政权 <= 60，边 <= 300 | 完整版图，全部图层 |
| 政权 61-200，边 <= 1200 | 低 rank 节点折叠为聚合块；默认只显示与选中节点相关的边 |
| 政权 > 200 或边 > 2000 | 版图降级为「按等级分组的矩阵 + 关系列表」；沿革与名录仍可用 |
| 名录 > 2000 行 | 强制分页 + 服务端筛选 |
| 单选实体出入链 > 200 | LinkPanel 分组折叠，先显示计数与前 20 条 |

### 11.4 组件划分建议

```text
PoliticsView/
├── index.tsx                    模块入口与复杂度 / 视图状态
├── types.ts                     第 3 节类型定义
├── config.ts                    ModuleConfig、图标、色板、线型表
├── PowerAtlas/
│   ├── AtlasCanvas.tsx          分层画布容器（缩放、平移、视口裁剪）
│   ├── PolityNode.tsx           第一层级唯一大卡片
│   ├── OrganizationCluster.tsx  政权内卫星簇
│   ├── IndependentLane.tsx      独立 / 跨国势力带
│   ├── FigureStrip.tsx          头像条 + 任职带
│   ├── TreatyRibbonLayer.tsx    signatory_of 投影的条约缎带
│   └── RelationEdgeLayer.tsx    政治关系边层
├── FocusPanel/
│   ├── FocusDrawer.tsx          上下文抽屉（固定 / 关闭）
│   ├── PolitySections.tsx       概览 / 机构 / 人物 / 关系 / 条约 / 沿革
│   ├── OrganizationPanel.tsx
│   ├── FigurePanel.tsx
│   └── TreatyPanel.tsx
├── Roster/                      名录（政权主行 + 内嵌卫星 / 人物）
├── Chronicle/                   沿革视图
├── TreatyBook/                  次级条约簿抽屉
├── LinkPanel/                   统一关联面板（全局复用）
└── selectors/                   角色选择器、实体选择器、等级 / 状态编辑器
```

删除旧组件族：`EntityCard`、`NationCard`、`OrganizationCard`、`LeaderCard`、`TreatyCard`、`TemplateSelectorModal`，以及 `templates.ts` 世界观模板文件。

### 11.5 设计验收自检清单

- [ ] 四类权重在信息架构、布局、数据三处同时成立，且没有四个平级 Tab。
- [ ] 政权是唯一大卡片；组织以卫星 / 独立势力带出现；人物以头像条、紧凑行、任职带出现；条约以缎带与次级条约簿出现。
- [ ] 条约缎带由 `politics.signatory_of` 投影；无 `treaty_between` 新写入。
- [ ] 人物只存 `characterId` 与政治身份；姓名、头像、种族、体系均从全局 Character 解析。
- [ ] 政权、组织、人物、条约详情都包含统一 LinkPanel。
- [ ] 关联类型、reverseLabel、图标、颜色、线型与契约一致。
- [ ] 全文无 emoji，图标一律 Lucide 名。
- [ ] 空白世界没有任何预置等级、状态、政体、派系、示例数据或世界观模板。
- [ ] 地图未接入时领土 / 首府入口隐藏；历史 / 经济 / 种族 / 体系为空时显示空状态且不阻塞。
- [ ] 速写 / 结构 / 沙盘可切换，降档不删除数据。
- [ ] 3 分钟最小路径可只填「政权名 + 等级 + 一位统治者」完成。
---

## 12. 本轮不做的事（边界）

### 12.1 实现边界

- 只修改设计文档，不改前后端代码、数据库结构、API 或路由。
- 不实现旧数据迁移、兼容转换与校验逻辑；第 3.6 节只给设计层映射。
- 不写组件、不做构建、不跑测试、不做联调；本文的组件划分是建议，不是实现承诺。

### 12.2 范围边界

- 地图与特殊模块保持现状：地图只做「接入 / 未接入」的可选设计，不做地图编辑、不绘制领土、不改地图文档。
- 不预置任何世界观内容：没有模板、等级、状态、政体、组织子类型、派系、条约类型、示例数据。
- 不设计模板市场、推荐模板、世界观类型选择器或公共模板分发。
- 世界脉络（World Web）属于全局界面，政治模块只使用其入口与筛选约定，不实现全局图谱。
- 世界备份 / 数据迁移由全局文档负责，本文不定义导入导出格式。

### 12.3 功能不做

- 不做政治实体合并、拆分、批量重命名之外的数据清洗。
- 不做条约审批流、条款版本 diff、自动续签提醒、违约判定。
- 不做王位继承模拟、人口变化模拟、经济数值计算；政治只表达结构。
- 不做画布力导向编辑器、自由绘线、手动画布钉位；节点位置由 rank 与关系决定。
- 不做跨世界引用、跨项目同步、多人协同编辑冲突处理。
- 不做 AI 自动生成政权、人物或条约。
- 不做移动端完整编辑；移动端只保留名录浏览与画布只读缩略。
- 不做时间轴动画脚本编辑；沙盘只提供播放与区间对比。
- 不做多语言与术语翻译，`terminology` 仅做模块内展示词替换。

以上边界与本轮设计目标一致：只交付政治模块的信息架构、数据形态、UI 与关联设计。
