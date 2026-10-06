# 经济界面设计：经济脉络与账册（三档复杂度共用一套数据）

> 上游契约：`docs/worldbuilding/cross_module_link_design.md`（WorldLink Contract）。
> 本文所有术语、数据外形、关联 id 均以契约为准；契约已有内容不复述，只写经济模块的落地设计。
> 领域强调色：green / cyan。图标一律使用 Lucide 图标名（kebab-case）。全文无 emoji。
> 文中出现的「物产甲」「营生甲」「集市甲」「通货甲」等名称全部是占位示意，出厂数据为空；
> 推荐 kind 骨架也需用户主动添加，系统不写入任何预设世界观内容。

**一句话设计：一张线路图，一本经济账。**
图上，市场是站点、产业是加工点、资源与商品是货、往来是线路；账上，每一行记名称、规模、
关系数与数字。速写、结构、沙盘三档不是三套功能，而是同一套数据的三层披露：
速写只打开账册扉页，结构翻开关系图，沙盘再加上数字与时间。

---

## 1. 模块定位与在 WorldLink 中的角色

### 1.1 定位

经济模块回答三个由浅入深的问题，复杂度档位与问题一一对应：

| 档位 | 回答的问题 | 用户得到的 |
|------|-----------|-----------|
| 速写 sketch | 这个世界「大概怎么转」？ | 一张 3-5 行的经济速写卡与几个关键词 |
| 结构 structure | 谁生产、谁消耗、在哪里交换、谁在管？ | 经济脉络图 + 账册列表 + 统一 LinkPanel |
| 沙盘 sandbox | 多少、多久、在什么周期里变化？ | 规模/流量/盈余叠加 + 指标 + 时间刷 + 统计 |

经济模块不是模拟器，也不是记账软件。它只做一件事：把「经济设定」表达成可生长、
可关联、可被其他模块引用的实体与关系；数量与时间是可选装饰，不是使用门槛。

### 1.2 在 WorldLink 中的职责

经济实体是跨模块引用的高频目标与来源。职责边界如下（模块间关系详见第 6 节）：

| 关系视角 | 关联 | 语义 |
|------|------|------|
| 经济 ← 政治影响 | economy.regulated_by / taxed_by / owned_by / currency_of | 受管制、征税、归属、流通货币 |
| 历史 ↔ 经济 | history.involves / history.causes / history.occurs_at / economy.era_context | 时代涉及、事件导致、发生于市场、周期对应时代 |
| 种族 → 经济 | races.specialty / races.prefers | 特产、消费偏好 |
| 体系 → 经济 | systems.costs / systems.enables | 资源消耗、技术赋能 |
| 角色 → 经济 | character.owns | 角色拥有经济实体 |
| 经济 → 地图 | economy.located_in | 位于某地区；地图本轮未接入时入口隐藏 |
| 经济 ↔ 经济 | economy.produces / consumes / requires / traded_at / flows_to / supplies | 生产、消耗、依赖、交易、流通、供给 |

经济模块内部没有第二套关联结构：所有边都落在 `world_links`，所有跨模块引用都走
`WorldLink` 或契约允许的 `EntityRef` 字段。

### 1.3 设计边界

- 不预置经济形态、货币、资源、产业、等级或指标；推荐 kind 只是「空骨架」。
- 不把经济类型做成同级 Tab；类型只是筛选维度，流转阶段才是主结构（见第 2 节）。
- 不把贸易路线、税收、管制、货币发行做成节点；它们默认是边。
- 不要求用户填完整张表；允许 1 个实体、1 条边、甚至只有速写卡片成立。
- 不做数值推演：指标是用户写下的设定值，不是仿真结果。

---

## 2. 信息架构与实体层级

### 2.1 主结构：流转阶段，而不是类型目录

经济类型之间不是平级关系，而是同一条链上的不同角色。默认组织方式为：

```
资源/物产  ──消耗──▶  产业/营生  ──生产──▶  商品/货物  ──交易于──▶  市场/集市
   ▲                     │                                              │
   └────────依赖─────────┘                                              │流通至
                                                                        ▼
   通货轨：货币（currency）  ──流通货币──▶  市场 / 政治势力 / 组织      市场/集市
   制度轨：制度（institution）──受管制/征税──▶  产业 / 市场 / 主体
   经营层：经济主体 actor（商帮、商行、承运者等，可选图层）
```

- 画布默认按阶段分泳道：上游 → 加工 → 交换 → 经营；通货与制度是横切轨道，不占一级泳道。
- 布局可切换为「按类型泳道」（resource / good / industry / market / currency / actor /
  institution / 自定义），这才是「类型」的正确位置：一种泳道排列与筛选维度。
- 顶部永远没有类型 Tab。类型筛选与等级、状态、关联数、指标覆盖一起放在左侧筛选轨道。

### 2.2 四级视觉权重

| 权重 | 成员 | 默认视觉 | 在图中的作用 |
|------|------|---------|-------------|
| 一级·枢纽 | market、industry | 大站点，名称常显，选中态有账页高亮 | 主干 |
| 二级·物料 | resource、good | 小站点，圆形/菱形，名称可缩略 | 货 |
| 横切·轨道 | currency、institution | 轨道带或底部横条，默认折叠成一行 | 媒介与规则 |
| 经营·主体 | actor | 中站点，默认关闭，可在图层中打开 | 承运与经营 |
| 关系 | economy.* | 线路、箭头、线宽 | 一切流转、税、管制、归属 |
| 时间 | custom_cycle、history.era | 时间带，默认不进节点层 | 周期与时代 |
| 路线 | flows_to、supplies | 边；默认不是实体 | 贸易路线 |

权重不是固定死的：`meta.level`（LevelDef.rank）与关联数共同参与节点大小与排序；
未填等级的实体默认二级视觉，不报错、不催填。

### 2.3 层级与「节点 / 边」的界线

- `parent_id` 只用于同类内部的分组（例如「市场」下挂「东市 / 西市」），
  **不代表流转层级**；流转层级一律由 WorldLink 表达。
- 以下对象默认是边，不是节点：
  - 贸易路线 = `economy.flows_to` / `economy.supplies`（线宽即流量）；
  - 税收 = `economy.taxed_by`；管制 = `economy.regulated_by`；
  - 货币流通 = `economy.currency_of`（货币本身是节点，流通是边）；
  - 归属 = `economy.owned_by`。
- 只有一种升级：当一条路线本身需要长文、历史、关税条款等独立内容时，用户可显式
  创建 `custom_route` 节点，用 `core.related_to` 连接两端市场，并把运输能力写进节点
  字段。系统不自动创建，也不把路线默认当节点。

### 2.4 重要程度差异（对旧方案的修正）

旧方案把若干经济类型做成平级 Tab、每类固定卡片、用星级等级控制卡片大小，已被判定
完全不适用。新架构的差异是：

1. **主轴是流转链，不是类型目录**：资源 → 产业 → 商品 → 市场 + 通货/制度横切。
2. **类型只是筛选维度**：可多选、可组合，不占顶部一级导航。
3. **边与节点不同权**：路线、税、管制、归属是边；条约式关系不配平级卡片。
4. **等级只做视觉权重**：用户自定义 LevelDef 的 label / rank / color，界面用文字徽章
   与分段条表达，不再使用星级。
5. **低细节实体被允许存在**：由速写关键词展开的 `stub` 实体带虚线光环与「待补全」提示，
   不阻塞视图成立。

---

## 3. 数据模型（kind / meta / items / config 映射）

### 3.1 数据结构总览

```
WorldModule(economy)
├─ config: EconomyModuleConfig                 ← kind 骨架、速写字段、指标定义、阶段、图层
├─ WorldModuleItem: economy.overview           ← 速写卡（EconomyOverview / EconomyChip[]）
├─ WorldModuleItem: economy.cycle              ← 每个周期一条，条目型实体，可被 WorldLink 寻址
├─ WorldSubmodule × N                          ← 经济实体 EconomyEntity（kind + meta）
│    └─ WorldModuleItem: economy.metrics       ← 该实体可选的时间序列（沙盘）
│    └─ WorldModuleItem: 用户命名条目           ← 长文、列表、条款等自由内容（结构+）
└─ WorldLink × M                               ← economy.* 关系；流量/时间/盈余放在 meta / time
```

三档复杂度共用上面这一张图，没有任何一档拥有专属表。

### 3.2 TypeScript 类型

```typescript
import type {
  WorldEntityBase, WorldLink, ModuleConfig, EntityTypeDef, LevelDef, StatusDef,
  CustomFieldDef, CustomFieldValue, ComplexityLevel, EntityRef,
} from './cross_module_link_design';

/** 推荐 kind 骨架；custom_xxx 为用户自定义 kind */
export type RecommendedEconomyKind =
  | 'resource' | 'good' | 'industry' | 'market'
  | 'currency' | 'actor' | 'institution';

export type EconomyKind = RecommendedEconomyKind | `custom_${string}`;

/** 流转阶段；'crosscut' 为通货/制度横切轨 */
export type EconomyStage = 'upstream' | 'transform' | 'exchange' | 'operator' | 'crosscut';

/** 经济实体：读取时是 WorldEntityBase，落库为 WorldSubmodule */
export interface EconomyEntity extends WorldEntityBase {
  module: 'economy';
  kind: EconomyKind;
  meta: EconomyMeta;
}

/** 落库位置：WorldSubmodule.meta；基础字段与 WorldEntityBase 同义，不存两份 */
export interface EconomyMeta {
  level?: string;                  // LevelDef.id，语义由用户定义，只作视觉权重
  status?: string;                 // StatusDef.id
  stage?: EconomyStage;            // 缺省由 kind 推导，可覆盖
  unit?: string;                   // 计量单位，如 袋 / 船 / 枚
  scale?: number;                  // 规模基数；缺省表示未知，不按 0 处理
  timeOrder?: number;              // 时间文本不可比较时的排序锚点
  cyclePhaseId?: string;           // 当前周期阶段（沙盘披露）
  stub?: boolean;                  // 由速写 chip 展开、尚未补全的低细节实体
  tags?: string[];
  customFields?: Record<string, CustomFieldValue>;
}

/** 速写关键词 chip；展开后 chip 与实体是一一对应的同一 id */
export interface EconomyChip {
  id: string;                      // 稳定 id，展开时直接作为新 WorldSubmodule.id
  label: string;
  kind: EconomyKind;               // 目标 kind，默认由所属速写字段决定
  entityRef?: EntityRef;           // 已展开则回填；未展开为空
}

/** 速写卡：落库为 WorldModuleItem(name='economy.overview')，模块级 */
export interface EconomyOverview {
  form?: string;                   // 经济形态
  currency?: EconomyChip;          // 通用货币
  resources: EconomyChip[];        // 主要资源
  industries: EconomyChip[];       // 主要产业
  distribution?: string;           // 贫富与分配特征
}

/** 指标定义：默认空数组；用户可添加，也可一键添加建议骨架 */
export interface EconomyMetricDef {
  id: string;                      // custom_metric_xxx
  label: string;
  unit?: string;
  valueType: 'number' | 'band';
  polarity?: 'higher-better' | 'neutral' | 'lower-better';
  stageFilter?: EconomyStage[];
  kindFilter?: EconomyKind[];
}

/** 指标采样：t 为世界内时间文本；无标准时间时配合 meta.timeOrder 排序 */
export interface EconomyMetricSample {
  t: string;
  value: number | [number, number];
  note?: string;
  sourceRef?: EntityRef;           // 数据来源事件等，可空
}

/** 落库为 WorldModuleItem(submodule_id=实体 id, name='economy.metrics') */
export interface EconomyMetricStore {
  values: Record<string, EconomyMetricSample[]>;   // metricId -> 采样序列
}

/** 经济周期：条目型实体；item.id 即周期 id，kind='custom_cycle' */
export interface EconomyCycle {
  name: string;
  phases: EconomyCyclePhase[];
  note?: string;
}

export interface EconomyCyclePhase {
  id: string;
  label: string;                   // 繁荣 / 衰退 / 复苏……由用户命名
  start?: string;
  end?: string;
}

/** link_type 为 economy.* 时，WorldLink.meta 的约定外形 */
export interface EconomyLinkMeta {
  flow?: number;                   // 标量流量，沙盘边宽
  unit?: string;                   // 缺省则按「相对强度」展示
  flowSeries?: { start?: string; end?: string; value: number; unit?: string }[];
  intensity?: 1 | 2 | 3 | 4 | 5;   // 结构档线宽；无单位时使用
  surplus?: 'surplus' | 'deficit' | 'balanced';   // 沙盘颜色
  surplusDerived?: boolean;        // true 表示由指标推定，界面须标注「推定」
  priceBand?: [number, number];
  confidence?: 'known' | 'rumored';
  routeNote?: string;              // 路线备注，常见于 flows_to / supplies
}

/** 速写字段定义：3-5 项，默认 5 项，可改名 / 调序 / 关闭到 3 项 */
export interface EconomySketchFieldDef {
  id: 'form' | 'currency' | 'resources' | 'industries' | 'distribution';
  label: string;
  type: 'text' | 'select' | 'chips';
  chipKind?: EconomyKind;          // type='chips' 时的目标 kind
  options?: string[];              // 仅作为输入建议，可自填；出厂为空
  maxItems?: number;               // 建议上限，不硬性拦截
}

export interface EconomyStageDef {
  id: EconomyStage;
  label: string;
  order: number;
  defaultKinds: EconomyKind[];
}

export interface EconomyLayerConfig {
  id: 'trunk' | 'flows' | 'balance' | 'currency' | 'institutions'
    | 'cycles' | 'history' | 'external';
  label: string;
  icon: string;                    // Lucide 名
  minComplexity: ComplexityLevel;  // 最早在哪一档出现
  defaultOn: boolean;
}

/** 经济模块配置：落在 WorldModule.config，扩展契约 ModuleConfig */
export interface EconomyModuleConfig extends ModuleConfig {
  defaultComplexity: ComplexityLevel;             // 默认 'sketch'
  displayMode: 'lanes' | 'network' | 'ledger' | 'split';  // 默认 'lanes'
  entityTypes: EntityTypeDef[];                   // 可为空；推荐骨架需用户添加
  stages: EconomyStageDef[];
  sketchFields: EconomySketchFieldDef[];          // 长度 3..5
  metrics: EconomyMetricDef[];                    // 可为空
  layers: EconomyLayerConfig[];
  defaultFlowUnit?: string;                       // 为空则显示「相对强度」
}
```

### 3.3 落库映射

| 设计对象 | 落库位置 | 说明 |
|---------|---------|------|
| EconomyEntity | `world_submodules`（module_id=经济模块） | `kind` 为语义类型；`EconomyMeta` 全量写入 `meta` |
| EconomyOverview | `world_module_items`，module 级，name=`economy.overview` | 唯一一条；速写卡不另建实体 |
| EconomyCycle | `world_module_items`，module 级，name=`economy.cycle` | 一条一个周期；`kind='custom_cycle'` 可在 EntityRef 中寻址 |
| EconomyMetricStore | `world_module_items`，submodule 级，name=`economy.metrics` | 指标值不写进实体 meta，避免膨胀 |
| 用户条目 | `world_module_items`，submodule 级，name 由用户命名 | content 为 JSON，承载长文/列表/条款 |
| 所有边 | `world_links` | economy.* 关联；`meta` 放流量等，`time` 放有效期 |
| 模块配置 | `world_modules.config` | 取代旧的 name='moduleConfig' 条目 |

### 3.4 推荐 kind 骨架（全部为可选项，默认不创建）

以下 kind 只是「添加类型」面板里的建议项：图标、颜色、阶段、默认字段为空壳；
用户添加后才成为模块的 EntityTypeDef，名称、图标、颜色、字段均可改，也可完全不用。

| kind | 建议标签 | Lucide 图标 | 默认阶段 | 视觉权重 | 默认字段建议（用户确认后写入 fieldSchema） |
|------|---------|------------|---------|---------|------------------------------------------|
| resource | 资源 | gem | upstream | 二级 | 形态、计量单位、规模 |
| good | 商品 | package | transform | 二级 | 规格、计量单位、价格区间 |
| industry | 产业 | factory | transform | 一级 | 产出物、产能、计量单位 |
| market | 市场 | store | exchange | 一级 | 市场形态、规模、主要货品 |
| currency | 货币 | coins | crosscut | 横切 | 材质、面额、通行范围 |
| actor | 经济主体 | briefcase | operator | 经营 | 主体形态、经营物、活动范围 |
| institution | 制度 | scroll-text | crosscut | 横切 | 规则领域、生效时间、执行者 |

`custom_cycle` 为系统预登记的条目型 kind（经济周期），默认不进节点层，但其寻址能力不可删除；
用户可改名、可设置图标颜色，但默认不进节点层，只出现在时间带与 LinkPanel 中。

### 3.5 与旧方案的切割

旧 `economy_ui_design.md` 的以下结构全部废弃：

- 固定的经济实体类型清单与顶部类型 Tab；
- 固定卡片 + `LevelConfig`（flexBasis / minHeight / 星级 label）驱动版式；
- emoji 图标与 emoji 色块；
- `color` 字段的 `type:currency:global` 前缀编码；
- name='relations' 的字符串拼接条目（`关系类型:目标ID:流量:开始:结束`）；
- name='customFields' 的独立条目存法。

保留且升级的只有一条：**kind 级自定义字段思路**，升级为契约 `CustomFieldDef` /
`CustomFieldValue`，由 `EconomyModuleConfig.fieldSchema` 按 kind 管理。


---

## 4. UI 设计

### 4.1 统一隐喻：线路图 + 账册

经济界面只用一个隐喻，两种面孔：

- **线路图**：市场是站点，产业是加工点，资源与商品是货，经济关联是线路，流量是货量；
- **账册**：同一批数据的可读面。速写卡是扉页，账册列表是账页，实体详情是分户账，
  页角有页码、数字用等宽、未填项留白为「—」。

为什么这个隐喻能同时撑住简单与复杂：

| 简单时 | 复杂时 |
|--------|--------|
| 一页速写卡，五行字 | 同一页下展开成整张线路图 |
| 关键词 chip 就是「货签」 | chip 展开为站点，保留同一个 id |
| 不需要连线，卡片自带完成感 | 线可以多到几百条，按图层与时间过滤 |
| 不出现数字 | 线宽、节点大小、颜色、曲线叠加在同一张图上 |

账册排版细节（统一视觉语法，不做装饰性炫技）：

| 隐喻部件 | UI 部件 | 具体做法 |
|---------|--------|---------|
| 站点 | 实体节点 | 形状与大小按权重和 kind；选中时出现账页高亮边 |
| 线路 | WorldLink 边 | 线型严格用契约注册表（solid / dashed / dotted / double） |
| 货流 | 边上的流量 | 沙盘线宽 + 单位标签；无线宽时用 intensity 的 5 级线宽 |
| 扉页 | 速写卡 | 5 行字段，行首竖线，行尾 chip |
| 账页 | 列表 / 详情 | 表头字距 0.08em，行分隔 1px 账线，数字 tabular-nums |
| 页角 | 卡片细节 | 「页 01」式编号、实体短 id 后四位 |
| 批注栏 | 右侧检查器 | 备注、来源、置信度、时间窗，竖排标签 |
| 印章 | 状态徽章 | CSS 方框 + 文字，轻微 rotate(-2deg)，不用星号或 emoji |
| 页码索引 | 阶段轨道 | 上游 / 加工 / 交换 / 经营 + 通货·制度横切 |

### 4.2 模块整体布局

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ 经济  Economy        [速写]━━●━━[结构]━━○━━[沙盘]      搜索 搜索   [世界脉络] [配置] │
│                       复杂度只改呈现，不删数据；当前：结构                         │
├──────────────┬─────────────────────────────────────────────────┬─────────────────┤
│ 阶段轨道      │ 主视图（随档位 morph，位置与选中保持不变）        │ 检查器           │
│ ● 上游    3   │  速写：经济速写卡                                │ 当前实体 / 关系  │
│ ○ 加工    2   │  结构：线路图 · 账册 · 分栏                       │ 概览 · 字段      │
│ ○ 交换    1   │  沙盘：线路图 + 指标叠加 + 统计 + 时间刷           │ 指标 · 关联       │
│ ○ 经营    0   │                                                 │ LinkPanel        │
│ ─ 通货    1   │                                                 │                  │
│ ─ 制度    0   │                                                 │                  │
│ 筛选 [类型▾]  │                                                 │                  │
│ [等级▾][状态▾]│                                                 │                  │
├──────────────┴─────────────────────────────────────────────────┴─────────────────┤
│ 沙盘专用时间刷：时代甲 ────── 时代乙 ────── 时代丙      312 年  ▸ 播放   [窗口]   │
└──────────────────────────────────────────────────────────────────────────────────┘
```

- 左侧阶段轨道与筛选只在 structure / sandbox 出现；sketch 下隐藏，避免简单模式出现目录感。
- 右侧检查器在 sketch 下折叠为可展开的小抽屉，默认关闭。
- 顶部没有类型 Tab；类型筛选在左轨最下方，与等级、状态并列。
- 时间刷只属于 sandbox，位于底部；升到沙盘时从底部滑入 200ms。

### 4.3 复杂度切换器

位置固定在模块标题右侧、搜索框左侧，是经济模块唯一的「深浅开关」。

```
       速写            结构            沙盘
        ●━━━━━━━━━━━━━○━━━━━━━━━━━━━○        拖动手柄 / 点击站点 / ← → 键
     当前：速写 · 已折叠 2 条往来与 6 个数值（数据未删除）
     hover 站点预览：结构＝脉络图、类型泳道、LinkPanel
```

交互规格：

| 行为 | 结果 |
|------|------|
| 点击某一档 | 就地 morph 到该档，不跳页、不重置滚动 |
| 拖动手柄 | 经过站点时吸附；松手后切换；不出现中间态 |
| 方向键 | 聚焦手柄后用 ← → 切换，Enter 确认 |
| 升档 | 当前选中实体保持选中；相机锚点保持；提示「已展开 N 项」 |
| 降档 | 数据不删；顶部出现「已折叠 N 条关联 / M 个数值」提示条 3 秒 |
| hover 站点 | 浮层列出该档将显示/隐藏的能力，文案不出现「节点」「流量」等下一档术语 |
| 默认值 | `WorldSettings.complexity` 提供全局默认；`EconomyModuleConfig.defaultComplexity` 可覆盖为 sketch/structure/sandbox |

复杂度只决定 `renderPlan`：sketch 只读速写卡与折叠计数，structure 读实体与关联，
sandbox 读指标与时间序列。三档共享同一批 id，切换不产生复制、不产生迁移。

### 4.4 速写档（sketch）：经济速写卡

默认档。目标：不出现关系图、不出现数值、不出现「实体 / 关联 / 流量 / 指标 / 周期」等术语。

```
┌─ 经济速写卡 ──────────────────────────────────────────────── 页 01 ─┐
│                                                                     │
│  这个世界靠什么换东西？                                              │
│  经济形态   [ 集市贸易 · 自填… ]                                     │
│                                                                     │
│  大家用什么当钱？                                                    │
│  通用货币   ( 通货甲 × )  [ + 写一个 ]                               │
│                                                                     │
│  出产什么？                                                          │
│  主要资源   ( 物产甲 × ) ( 物产乙 × )  [ + 写一个 ]                  │
│                                                                     │
│  靠什么营生？                                                        │
│  主要产业   ( 营生甲 × )  [ + 写一个 ]                               │
│                                                                     │
│  谁分得多，谁分得少？                                                │
│  分配特征   [ 少数集中 / 大致平均 / 两极分化 / 自填… ]               │
│                                                                     │
│  ───────────────────────────────────────────────────────────────     │
│  记下 3 项即可成立。当前已写 5 项。                                  │
│  另有 2 条往来、6 个数值已折叠：升级到结构可看往来，升级到沙盘可看数值。            │
│                                     [展开为脉络]   [就这样，先记着]  │
└─────────────────────────────────────────────────────────────────────┘
```

速写规则：

1. 字段数 3-5 项：默认 form / currency / resources / industries / distribution 五槽；
   用户可改名、调序、关闭槽位，但最少保留 3 项、最多 5 项（配置校验）。
2. `resources` / `industries` 是 chips 输入：Enter 或逗号分词，自动去重；支持中文与
   用户术语替换；每类建议不超过 6 个，超出只提示不拦截。
3. 不要求填满。填了「经济形态 + 通用货币 + 主要资源或主要产业」即视为速写完成。
4. 不出现任何数字化表达；数字即使已存在也只显示折叠条，不显示值。
5. 速写卡有自己的空状态与完成态，不依赖关系图。

**关键词 chip 的三种命运**（这是简单与复杂统一的最小机关）：

| 操作 | 结果 | 数据动作 |
|------|------|---------|
| 只留在卡上 | 一直是一个关键词 | 存于 `EconomyOverview`，不产生实体 |
| 点「展开为脉络」 | chip 变成脉络图里的一个站点，仍是同一个 id | 创建 `WorldSubmodule`，回填 `chip.entityRef`，`meta.stub=true` |
| 再次收起 | 站点仍存在，速写档只显示为 chip | 只改披露，不删实体 |

展开时不弹大表单，只问一句「它是什么？」，默认 kind 由 chip 所属字段决定
（资源字段→resource，产业字段→industry，货币→currency），其余字段可后补。

**速写动词到标准关联的映射**（速写里说人话；先落通用关联，结构档一键细化）：

| 速写里看到的词 | 可细化为此 link_type | 方向示例 |
|---------------|----------------|---------|
| 产 / 出 | economy.produces | 营生甲 → 商品甲 |
| 用 / 耗 | economy.consumes | 营生甲 → 物产甲 |
| 靠 | economy.requires | 营生甲 → 物产乙 |
| 卖 / 换 | economy.traded_at | 商品甲 → 集市甲 |
| 走 / 运到 | economy.flows_to 或 economy.supplies | 集市甲 → 集市乙 |
| 通行 / 用钱 | economy.currency_of | 通货甲 → 集市甲 |
| 属 | economy.owned_by | 集市甲 → 商行甲 |
| 管 | economy.regulated_by | 营生甲 → 某制度 / 条约 |
| 税 | economy.taxed_by | 集市甲 → 某政权 |
| 在 | economy.located_in | 集市甲 → 某地区 |
| 养 / 供 | economy.supplies | 营生甲 → 集市甲 |

速写档的连线入口只有一个：卡片底部的「连一句往来」。用户选两个 chip、选一个动词
（产 / 用 / 卖 / 走 / 管 / 税 / 属 / 在）。按契约 §5.5 的简化流程，先落一条
`core.related_to`，把动词写入 label；进入结构档后，这条边带「可细化」标记，可一键改为
上表对应的 economy.* 类型（保留关联 id、方向、时间与备注），也可以一直保持通用关联。
其余元数据（时间、流量、备注）在结构 / 沙盘里再补。没有连线时卡片不出现空端口，
不制造缺憾感。

### 4.5 结构档（structure）：脉络图 + 账册

#### 4.5.1 线路图画布（默认布局）

```
┌ 经济脉络图 ─────────────────────────────────── [线路图][网络图]  图层 [▾]  搜索 ┐
│  上游·物产            加工·营生              交换·集市            经营·主体    │
│  ┌─────────┐  消耗   ┌──────────┐   生产   ┌─────────┐  交易于  ┌─────────┐ │
│  │物产甲·资源│◀────────│营生甲·产业 │────────▶│商品甲·商品│────────▶│集市甲·市场│ │
│  └─────────┘         └─────┬────┘         └─────────┘         └────┬────┘ │
│        ▲                   │依赖                                   │归属    │
│        │                   ▼                                       ▼       │
│  ┌─────────┐         ┌──────────┐                          ┌─────────────┐│
│  │物产乙·资源│◀──消耗───│营生乙·产业 │                          │商行甲·经济主体││
│  └─────────┘         └──────────┘                          └─────────────┘│
│                                                                             │
│  ═ 通货轨 ═════════ [coins] 通货甲 ──流通货币──▶ 集市甲 / 营生甲              │
│  ═ 制度轨 ═════════ [scroll-text] 行会规章 ──受管制──▶ 营生甲                 │
│                                                                             │
│  选中：营生甲 · 产业 · 区域 · 待补全   出链 2 / 入链 1   [添加关联] [打开账页] │
│  图例：[外站]=跨模块只读  虚线=stub 待补全  线型遵循契约注册表                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

- 阶段泳道是默认排列；布局切换为「网络图」时改为自由力导向，用于非线性的复杂关系。
- 节点角标显示关联计数（出 / 入）；stub 节点虚线光环 + 「待补全」字样。
- 跨模块实体（政治 / 历史 / 种族 / 体系 / 角色）以「外站」出现：只读、取对方模块领域色、
  点击跳转，不在此画布上编辑。
- 通货与制度默认收成两条横切轨道；数据为空时轨道不出现，不显示空洞目录。
- 空画布只有一个「+ 添加第一个实体」与「先写速写卡」两个入口。

#### 4.5.2 类型泳道与画布规则

- 泳道模式二选一：**按阶段**（默认，上游 / 加工 / 交换 / 经营）或**按类型**
  （resource / good / industry / market / currency / actor / institution / 自定义）。
- 类型泳道是筛选维度的一种排列，不改变任何数据；切换时节点位置重排，选中保持。
- 边规则：
  - 线型、颜色、箭头默认取契约 §4.4 注册表；
  - `flows_to` / `supplies` 在结构档用 `meta.intensity`（1-5）表达相对强弱，
    没有 intensity 时统一细线，不显示 0；
  - 无向或对称关系（如未来自定义）用双线；方向由箭头表达。
- 节点规则：
  - 大小由 `LevelDef.rank`（若有）与关联数决定，两项都缺省时为标准小站点；
  - 形状按 kind 区分（见 4.7），不依赖颜色单独区分类型；
  - 同阶段内按 order_index 与创建时间排列，不自动排序成「重要度排行榜」。

#### 4.5.3 账册列表（画布的第二面孔）

```
┌ 经济账册 ────────────────────────────────────────── [图][账][分栏]  分组[阶段▾] ┐
│ 名称       类型   阶段  等级/规模  出链  入链  状态   指标       最近更新         │
│ 物产甲     资源   上游  地方       0     1     稳定   —          03-12           │
│ 物产乙     资源   上游  —          0     1     稳定   —          03-12           │
│ 营生甲     产业   加工  区域       2     1     扩张   产出 ↑      03-12           │
│ 营生乙     产业   加工  —          0     1     收缩   产出 ↓      03-11           │
│ 商品甲     商品   加工  地方       0     1     —      价格 —      03-11           │
│ 集市甲     市场   交换  区域       1     1     繁荣   成交量 ↑    03-12           │
│ 集市乙     市场   交换  地方       0     0     平稳   成交量 —    03-12           │
│ 通货甲     货币   横切  跨域       0     0     通行   —          03-10           │
│ 行会规章   制度   横切  区域       0     0     生效   —          03-08           │
│ ───────────────────────────────────────────────────────────────────────────     │
│ 分组[按阶段][按类型][按状态]   排序[关联数↓]   密度[紧凑][舒适]                  │
│ 「—」表示未填，不按 0 处理；stub 实体在名称后带「待补全」小字。                   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

- 列表与画布共用选中态：点行选中节点，点节点滚到对应行；分栏模式左右同时可见。
- 列可按 kind 的 `customFields` 扩展；列配置存入用户本地偏好，不改世界数据。
- 行 hover 显示目标预览卡（契约 5.1）；点击进入实体详情，面包屑保留来源。

#### 4.5.4 统一检查器与 LinkPanel

右侧检查器固定顺序：概览 → 字段 → 关联 → 条目；沙盘档在「字段」后插入「指标」页。
关联页直接嵌入契约通用 LinkPanel，不另造经济版本。

```
关联   [出链 3]  [入链 2]                                [+ 添加关联]
┌──────────────────────────────────────────────────────────────────┐
│ 经济                                                              │
│  [factory] 生产        商品甲 · 商品            —                  │
│  [package-minus] 消耗  物产甲 · 资源            —                  │
│  [truck] 供给          集市乙 · 市场            120 袋 / 季        │
│ 政治                                                              │
│  [gavel] 受管制        城邦条例 · 条约          —                  │
│  [landmark] 征税        某政权 · 政权            15%               │
│ 历史                                                              │
│  [users] 被涉及        大旱 · 事件              312 年             │
│  [calendar-range] 对应时代  第三期 · 时代        310 - 320 年      │
│ 种族 / 体系 / 角色 / 地图：有入链或出链时才显示分组，无则不占位     │
└──────────────────────────────────────────────────────────────────┘
```

- 行内显示：类型标签（入链用 reverseLabel）、目标名、kind 徽章、时间范围、备注摘要。
- 入链区不可直接删除；点击跳到源实体修改。出链行尾有删除与编辑入口。
- 行内引用：任意描述字段支持 `[[economy:market:market_123|集市甲]]` 形式 token，
  渲染为可点击 chip；失效引用显示警示 chip 与「清理」入口。
- 关联计数徽章同时出现在画布节点、账册行、卡片右上角。

### 4.6 沙盘档（sandbox）：数值与时间叠加

#### 4.6.1 沙盘总览

```
┌ 沙盘 ───────────────────────────────────────────── 时间：312 年 · 窗口 310 - 315 ┐
│ 图层 [主干][流量][盈余/赤字][通货][制度][周期][历史事件][外部站点]  单位 袋/季   │
│                                                                                 │
│   上游·物产              加工·营生               交换·集市            统计        │
│   ● 物产甲               ▣ 营生甲                ◎ 集市甲          ┌───────────┐ │
│   规模 2  ──120/季──▶    规模 3  ──200/季──▶     规模 3            │实体  12    │ │
│                                    ┃ 产出 +8%                       │关联  18    │ │
│   ○ 物产乙               ▣ 营生乙（赤字）         ◎ 集市乙          │总流量 420   │ │
│   规模 —（空心环）         流量 —（虚线）          160/季            │赤字 2 盈余 3│ │
│                                                                    │指标覆盖 58%│ │
│                                                                    └───────────┘ │
│  ┌ 时间刷 ────────────────────────────────────────────────────────────────┐      │
│  │ 时代甲────────────┐ 时代乙────────────────┐ 时代丙────────────           │      │
│  │ ░░░░░░░▒▒▒▒▒▒▒▒▒▒▒▓▓▓▓▓▓▓▓▓▓▓▓▓▒▒▒▒▒░░░░░░   周期：繁荣 → 衰退 → 复苏   │      │
│  │ [310]──────────────[312]──────────────[315]   拖动窗口过滤节点 / 边 / 指标│      │
│  └─────────────────────────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────────────────────┘
```

宽线的视觉方向表示货流（上游 → 下游）；hover 边时仍按契约注册表显示关联方向与类型，
流量数值始终属于对应的边，不因视觉方向改变。
图例：盈余 = green-600，平衡 = cyan-600，赤字 = amber-600 + 斜纹纹理；未知 = 空心环。
颜色永远配文字或纹理，不单独承载语义。

#### 4.6.2 叠加规则（防止视觉撒谎）

- **节点大小**：`size = 小站点 + (大站点 - 小站点) × (0.5 × 等级归一 + 0.5 × 规模归一)`。
  只填其中一项时按单项归一；两项都缺省为标准小站点 + 空心环 + 「规模未填」。
  `meta.scale` 为 0 是有效值，缺省才是未知；界面必须区分「0」与「—」。
- **边宽**：`w = w最小 + (w最大 - w最小) × sqrt(flow / flowMax)`，平方根压缩极端值。
  全图没有任何流量值时，统一用 `intensity` 线宽；只有一条边有值时进入**绝对模式**：
  线宽固定中等，边上直接标「120 袋 / 季」，不做 100% 归一，避免制造比较假象。
  `flow` 缺省与 `flow = 0` 不同：缺省画虚线并标「—」，0 画细实线并标「0」。
- **颜色**：优先读 `meta.surplus`；没有时若有可比指标可按指标正负**推定**，并加
  「推定」小字；没有依据时不猜，用中性描边。
- **时间外来数据**：节点 / 边的时间窗与当前刷选窗口无交集时，按图层规则淡出或隐藏；
  隐藏不等于删除，时间刷复位后全部恢复。
- **缺数据**：指标曲线遇到缺失采样画空心点并断线，不用 0 补点。

#### 4.6.3 时间刷与周期带

- 一条世界内时间轴，四类时间源叠加：
  1. 实体 `time`（存在期）；
  2. `WorldLink.time`（关系有效期）；
  3. `EconomyMetricSample.t`（指标采样）；
  4. `EconomyCyclePhase.start/end` 与历史时代带（通过 `economy.era_context` 对齐）。
- 历史时代由 `economy.era_context` 从经济实体或周期指向 `history.era` / `history.event`，
  沙盘读取这些关联绘制时代底带与事件标记；没有历史数据时只显示周期带与自由时间。
- 时间刷两个手柄：拖动过滤；双击时代 / 周期边界吸附；Shift + 拖动平移窗口；
  `[` `]` 微调；`空格` 播放，播放时窗口匀速前进，节点大小与线宽随窗口内指标插值变化。
- 窗口内没有任何采样时显示「此段无记录」，不显示 0。
- 自由文本时间无法比较时，用 `meta.timeOrder` 作排序锚点；没有锚点的实体排在同段末尾并标注「时间未锚定」。

#### 4.6.4 统计面板

只统计已填数据，不做推断：

```
┌ 统计 ────────────────┐
│ 实体     12           │
│ 关联     18           │
│ 总流量   420 袋/季     │
│ 盈余 3 / 平衡 4 / 赤字 2│
│ 指标覆盖 58%           │
│ 时间窗口 310 - 315     │
│ [导出当前窗口 CSV]     │
└───────────────────────┘
```

点击任一统计项进入对应的筛选结果（如点「赤字 2」只保留赤字节点）。

#### 4.6.5 图层开关

| 图层 | 内容 | 最早出现 | 沙盘默认 |
|------|------|---------|---------|
| 主干 trunk | 枢纽节点与主干边 | structure | 开 |
| 流量 flows | 边宽与流量标签 | sandbox | 开 |
| 盈余 / 赤字 balance | 节点与边的盈余色、斜纹 | sandbox | 开 |
| 通货 currency | 通货轨与 currency_of | structure（折叠轨道） | 开 |
| 制度 institutions | 制度轨与 regulated_by / taxed_by | structure（折叠轨道） | 开 |
| 周期 cycles | 周期带、阶段标签 | sandbox | 开 |
| 历史事件 history | 事件标记与时代底带 | sandbox | 关 |
| 外部站点 external | 政治 / 历史 / 种族 / 体系 / 角色节点 | structure | 关 |

图层开关只影响绘制，不改变筛选结果；关闭某层后统计面板仍按全量计算，
并在面板上标注「含已隐藏图层」。

#### 4.6.6 世界脉络入口

契约 5.4 的世界脉络入口在 sandbox 默认显示，structure 可手动开启。经济模块的入口按钮
位于模块标题右侧；点击打开全局只读关系图，当前经济模块高亮，经济节点取 green / cyan。
超过性能阈值时按契约降级为模块矩阵 + 推荐关联列表，经济模块不另造降级方案。

### 4.7 视觉规范

#### 4.7.1 颜色

模块领域色固定为 green / cyan；单条关联的颜色按契约 §4.4 注册表执行，两者不冲突：
领域色用于标题、选中、聚焦、空状态插画与时间刷，注册表色用于具体线色。

| token | light | dark | 用途 |
|-------|-------|------|------|
| eco-green-600 | #16A34A | #4ADE80 | 模块强调、生产 / 消耗 / 供给、盈余 |
| eco-green-500 | #22C55E | #86EFAC | 节点选中描边、进度段 |
| eco-cyan-600 | #0891B2 | #22D3EE | 流通、平衡、时间刷手柄、链接 hover |
| eco-cyan-400 | #22D3EE | #67E8F9 | 时间带、指标曲线、时代底纹 |
| eco-paper | #F7F8F5 | #0F1318 | 账页底 |
| eco-rule | #D8DDD6 | #26303A | 账册横线、表格分隔 |
| eco-ink | #111827 | #E5E7EB | 正文与数字 |
| eco-muted | #6B7280 | #9CA3AF | 批注、未填、stub |
| eco-deficit | #D97706 | #FBBF24 | 赤字语义，必须配文字 / 斜纹 |
| eco-external | 取对方模块领域色 | 同左 | 跨模块外站 |

#### 4.7.2 节点形状与图标

| kind | 画布形状 | Lucide 图标 | 说明 |
|------|---------|------------|------|
| resource | 圆点 | gem | 二级物料 |
| good | 菱形 | package | 二级物料 |
| industry | 圆角方 | factory | 一级枢纽 |
| market | 双环方 | store | 一级枢纽 |
| currency | 轨道端点 | coins | 横切 |
| actor | 六边形 | briefcase | 经营层 |
| institution | 轨道条 | scroll-text | 横切 |
| custom_cycle | 时间带 | refresh-cw | 条目型实体 |
| 自定义 kind | 缺省圆角方，可在 EntityTypeDef 覆盖 | shapes | 与内置同权 |

其他固定图标：复杂度 `sliders-horizontal`、画布 `network`、线路图 `route`、账册 `list`、
分栏 `columns-2`、时间刷 `move-horizontal`、图层 `layers`、统计 `sigma`、指标 `activity`、
添加关联 `link`、受管制 `gavel`、征税 `landmark`、归属 `key-round`、位于 `map-pin`。
全文与界面都不使用 emoji；图标字段只存 Lucide 名。

#### 4.7.3 排版与动效

- 账册数字一律 `font-variant-numeric: tabular-nums`；表头 `letter-spacing: 0.08em`，
  标签用小号大写感排版（中文用 12px + 字距，不强制英文大写）。
- 节点标签最多两行，超出省略；hover / 选中时显示完整名称与 kind 徽章。
- 动效 150-300ms；切换档位 200ms；`prefers-reduced-motion` 下直接切换。
- 简单档不播放复杂动画，不出现粒子、流光、跳动数字。
- 正文对比度不低于 WCAG AA；颜色语义必须配文字、形状或纹理。
- 画布提供「账册视图」作为键盘与读屏的等价路径；所有图操作都有列表替代。


---

## 5. 交互设计

### 5.1 创建与生长

三个入口，按复杂度递进，互不强制：

| 入口 | 位置 | 适合 | 产生的数据 |
|------|------|------|-----------|
| 写速写卡 | 空状态主按钮 / 速写档 | 从零开始 | EconomyOverview，可选 chips |
| 添加实体 | 画布空槽 / 账册底部 / 节点右键 | 已知道要建什么 | WorldSubmodule |
| 连一句往来 | 速写卡底部 / 节点端口拖拽 / LinkPanel | 已有一个关系想法 | WorldLink |

创建实体的表单只强制名称：

1. 选 kind：按阶段排序（上游 → 加工 → 交换 → 经营 → 横切），自定义 kind 置底；
   已用过的 kind 靠前。
2. 名称必填；描述、等级、状态、单位、规模全部可空。
3. 字段区按 `fieldSchema[kind]` 动态生成；没有字段定义时只显示名称与描述。
4. 保存后不跳页，直接在新节点/新行上进入行内命名状态。
5. 允许重复名称，id 才是身份；重名时名称旁显示短 id 后四位。

批量创建：在画布空白处粘贴一行一个名称的文本，可批量生成同类实体；
kind 由用户先选，生成后不自动连线，只按阶段落到对应泳道。

周期创建：沙盘时间层的「添加周期」创建 kind=custom_cycle 的条目型实体，填写阶段名与起止时间；
周期默认以时间带出现，不占节点层。

### 5.2 编辑

- 双击节点标签就地改名；其余字段在右侧检查器编辑，失焦即保存。
- 自动保存 800ms 防抖；本地撤销栈保留最近 20 步；撤销范围包含创建、字段、关联、
  时间窗与图层切换（不含视图缩放）。
- 多选（Shift 点选 / 框选）后可批量设置等级、状态、标签；批量删除前必须列出将受影响的
  关联数量，按契约级联删除规则执行。
- 条目：每个实体下可建任意条目（长文、列表、条款、备注），条目内容为 JSON；
  条目不参与关联，若要参与关联请升级为实体。
- 版本历史本轮不做；只做本地撤销。

### 5.3 关联

- 拖拽建边：从节点端口拖到目标节点，落点后弹出类型选择；类型列表按源 / 目标 kind
  自动过滤，不合法的类型置灰并给出原因（契约创建校验规则）。
- LinkPanel 建边：步骤依契约 5.2；默认只显示名称与类型，展开「更多」才能填时间、
  流量、备注，保证简单路径不被迫填表。
- 速写建边：用「产 / 用 / 卖 / 走 / 管 / 税 / 属 / 在」等动词，先落 core.related_to + label
  （契约 5.5 简化流程），进入结构档后可一键细化为 economy.*。
- 批量：多选源与目标后可一次创建同类型多条边。
- 边编辑：点击边显示轻量浮层，可改类型、时间窗、流量、备注、置信度；删除需确认。
- 入链不可直接删，只能跳到源实体修改（契约 5.1），避免「从被引用方拆掉别人的线」。

### 5.4 跳转与导航

- 节点单击选中，双击进入实体详情；详情以右侧检查器优先，按住 Alt 双击才开整页。
- 跨模块外站点击跳转到对方模块实体；面包屑保留来源，支持返回原经济视图。
- 行内引用 token 渲染为 chip，hover 预览，点击跳转；失效引用显示警示 chip 与清理入口。
- 视图状态（档位、布局、筛选、时间窗、选中实体）写入 URL 查询参数，可分享与刷新恢复；
  不写入世界数据。

### 5.5 筛选、搜索与视图

- 左轨筛选：阶段、kind（多选）、等级、状态、关联数区间、有无指标、时间范围。
- 搜索支持 `kind:market 集市` 形式；结果以账册列表呈现，画布同步高亮。
- 「类型」永远不是顶部 Tab：它只是左轨的一组复选筛选，与等级、状态同级。
- 保存视图：用户可命名一组筛选 + 布局 + 图层，存本地偏好；不写入世界备份。
- 画布 / 账册 / 分栏三种布局共享同一选中与筛选。

### 5.6 键盘与可访问性

| 按键 | 行为 |
|------|------|
| 1 / 2 / 3 | 切换速写 / 结构 / 沙盘 |
| L | 画布与账册互切 |
| F | 缩放适应画布 |
| Tab / Shift+Tab | 在节点间移动焦点，画布与账册同序 |
| 方向键 | 移动选中节点 |
| Enter | 打开选中实体 |
| Delete | 删除选中项（含确认） |
| [ / ] | 时间刷左 / 右微调（沙盘） |
| 空格 | 播放 / 暂停时间刷（沙盘） |
| Esc | 清空选择 / 关闭浮层 |

- 画布为 `role="application"`，节点可聚焦并有文本替代名；账册视图提供完整等价操作。
- 切换档位时读屏播报「已展开 N 项 / 已折叠 N 项」；简单档不播报专业术语。
- 焦点环使用 eco-cyan-600，与选中态区分；不使用仅靠颜色的状态表达。

### 5.7 边界与错误

| 情况 | 处理 |
|------|------|
| 关联类型与 kind 不匹配 | 置灰并说明原因；仅保留 core.references / core.related_to / custom.link 通用项 |
| 删除有入链的实体 | 确认框列出受影响关联；默认级联删除，支持改为保留失效引用 |
| 重复名称 | 允许，用短 id 区分；搜索同时匹配名称与 id |
| 流量单位不一致 | 不换算、不报错；图上分别标单位，统计面板提示「存在多单位」 |
| 时间文本不可比较 | 用 meta.timeOrder 排序；缺锚点排末尾并标注「时间未锚定」 |
| 指标缺采样 | 断线 + 空心点；禁止用 0 补 |
| 自定义图标非法 | 回退到 shapes，并在配置面板提示 |
| 地图未接入 | located_in 创建入口隐藏；已有数据以禁用 chip 显示并标注原因 |

---

## 6. 与历史 / 政治 / 经济 / 种族 / 体系 / 角色 / 地图的关联设计

### 6.1 经济关联清单（摘自契约 §4.4，模块直接使用）

| id | 标签 | 反向文案 | 源 → 目标 | 图标 | 颜色 | 线型 | 速写动词 | 数值叠加 |
|----|------|---------|-----------|------|------|------|---------|---------|
| economy.produces | 生产 | 被生产 | industry → good | factory | green | solid | 产 / 出 | 产量（边标签） |
| economy.consumes | 消耗 | 被消耗 | industry → resource/good | package-minus | green | solid | 用 / 耗 | 消耗量（边标签） |
| economy.requires | 依赖 | 被依赖 | industry/good → resource/good | git-branch | teal | dashed | 靠 | 依赖强度 |
| economy.traded_at | 交易于 | 交易于此 | good/resource → market | store | green | solid | 卖 / 换 | 交易量 |
| economy.flows_to | 流通至 | 自该地流入 | market → market | route | cyan | solid，线宽 = 流量 | 走 / 运到 | 流量（边宽） |
| economy.currency_of | 流通货币 | 通行货币为 | currency → polity/market/organization/actor/institution | coins | yellow | solid | 通行 / 用钱 | 无 |
| economy.owned_by | 归属 / 控制 | 拥有 / 控制 | industry/market/resource → polity/organization/character/actor/institution | key-round | lime | solid | 属 | 无 |
| economy.regulated_by | 受管制 | 管制 | 经济实体 → polity/treaty | gavel | amber | dashed | 管 | 管制强度 |
| economy.taxed_by | 征税 | 征税于 | market/industry → polity | landmark | amber | dotted | 税 | 税率 |
| economy.located_in | 位于 | 包含 | 经济实体 → 地图地区 | map-pin | blue | solid | 在 | 无 |
| economy.supplies | 供给 | 由该方供给 | market/industry/actor → polity/organization/market/industry/actor | truck | green | solid，线宽 = 流量 | 养 / 供 | 流量（边宽） |
| economy.era_context | 对应时代 | 对应经济周期 | 经济实体（周期 / 危机）→ history.era/history.event | calendar-range | cyan | dashed | 时间维度自动 | 无 |

### 6.2 跨模块关联矩阵

| 对方模块 | 关联 | 经济侧展示 | 对方侧展示 | 最早档位 |
|---------|------|-----------|-----------|---------|
| 政治 | economy.regulated_by | 出链「受管制」 | 入链「管制」 | structure |
| 政治 | economy.taxed_by | 出链「征税」 | 入链「征税于」 | structure |
| 政治 | economy.owned_by | 出链「归属 / 控制」 | 入链「拥有 / 控制」 | structure |
| 政治 | economy.currency_of | 出链「流通货币」 | 入链「通行货币为」 | structure |
| 历史 | economy.era_context | 出链「对应时代」 | 入链「对应经济周期」 | sandbox |
| 历史 | history.involves | 入链「被涉及」 | 出链「涉及」 | structure |
| 历史 | history.causes / caused_by | 入链「由该事件导致 / 引发了」 | 出链「导致 / 起因于」 | structure |
| 历史 | history.occurs_at | 入链（市场作为地点）「发生事件」 | 出链「发生于」 | structure |
| 种族 | races.specialty | 入链「特产于」 | 出链「特产」 | structure |
| 种族 | races.prefers | 入链「受偏好」 | 出链「消费偏好」 | structure |
| 体系 | systems.costs | 入链「消耗于」 | 出链「代价」 | structure |
| 体系 | systems.enables | 入链「受赋能」 | 出链「技术 / 能力赋能」 | structure |
| 角色 | character.owns | 入链「拥有 / 掌控」 | 出链「拥有 / 掌控」 | structure |
| 地图 | economy.located_in | 出链「位于」 | 地图侧本轮不展示 | 入口隐藏 |
| 经济 | economy.produces / consumes / requires / traded_at / flows_to / supplies | 双向均在 LinkPanel 与经济画布 | 同左 | structure |

### 6.3 政治

- 四种语义各自独立：管制（regulated_by）是规则约束，征税（taxed_by）是财政抽取，
  归属（owned_by）是产权或控制，货币（currency_of）是流通媒介；不合并成一条「政治影响」边。
- 经济实体详情按契约 LinkPanel 分组规则，把「政治」作为独立分组显示入链 / 出链；
  政治实体详情页会以 reverseLabel 显示反向行，双向可查。
- 沙盘可选把 `politics.trades_with` 叠加为政权之间的外部连线（只读、不复制到经济数据），
  默认关闭；该连线不属于经济关联，不参与经济统计。
- 一个经济实体可同时受多个政权管制或征税；多条边共存，不做唯一性约束。

### 6.4 历史

- **时代对齐**：经济周期或危机实体用 `economy.era_context` 指向 `history.era` 或
  `history.event`；反向在历史侧显示「对应经济周期」。沙盘时间轴据此绘制时代底带与
  事件标记，不需要读取历史模块内部结构。
- **时代整体涉及经济**：`history.involves` 允许 `history.era` 作为源，可直接指向经济
  实体；反向在经济实体详情显示「被涉及」。
- **危机事件**：`history.causes` / `history.caused_by` 连接 `history.event` 与经济实体，
  表达「事件导致经济变化」；`history.involves` 表达事件涉及哪些经济实体。
- 历史的时代 / 事件仍是历史模块的实体，经济模块只引用、不复制、不建影子条目。
- 时间轴上的优先级：时代底带 < 周期带 < 事件标记 < 当前刷选窗口；视觉层级依次升高。

### 6.5 种族

- `races.specialty`：种族 / 亚种 → 资源或商品，经济侧显示「特产于」，种族侧显示「特产」。
- `races.prefers`：种族 / 亚种 → 商品或市场，经济侧显示「受偏好」，种族侧显示「消费偏好」。
- 经济画布把种族作为「外站」显示（外部站点图层默认关闭）；沙盘可把偏好边设为极细虚线，
  不参与流量宽度计算，避免把偏好误读为贸易量。
- 一个种族可对多个商品有偏好；偏好强度写 `WorldLink.meta.intensity`，不新增字段。

### 6.6 体系

- `systems.costs`：体系能力 / 层级 → 资源或商品，表达资源消耗；经济侧入链显示「消耗于」，
  体系侧出链显示「代价」。
- `systems.enables`：体系 system / tier → 产业或商品，表达技术或能力对经济的赋能；
  经济侧入链显示「受赋能」，体系侧出链显示「技术 / 能力赋能」。
- 体系节点作为外站显示，默认只在 hover / 选中时展开其能力摘要；不在经济画布编辑体系。

### 6.7 角色

- `character.owns`：角色 → 经济实体，表达个人拥有或掌控；经济侧入链显示「拥有 / 掌控」。
- 经济模块的 `actor`（经济主体，如商帮、商行、承运者）与全局 `character` 严格区分：
  组织性的经营者用 actor，具体人物用 character；二者可同时存在，不互相替代。
- 政治人物、历史人物仍是全局 character 引用，经济侧不复制人物数据。

### 6.8 地图

- `economy.located_in`：经济实体 → 地图地区；地图模块本轮保持现状、未接入，
  因此创建入口隐藏，已有数据以禁用 chip 显示并标注「地图模块未接入」。
- 数据仍按契约存储，不迁移、不丢弃；地图接入后直接出现「位于」行，无需改结构。

### 6.9 双向可查的统一规则

1. 关联只存一条 `WorldLink`；反向查询使用 `link_type.directed = false` 或 reverseLabel。
2. 每个实体的 LinkPanel 都按目标模块分组；经济模块不维护私有引用数组。
3. 画布节点 / 账册行 / 卡片右上角显示关联计数徽章，数量来自批量聚合，不逐条 N+1 查询。
4. 行内引用统一使用 `[[module:kind:id|显示名]]` token，存 id 不存名称。
5. 删除实体默认级联删除其关联；确认框列出受影响关联；可选保留失效引用并一键清理。
6. 自定义关联类型必须声明方向、标签、源 / 目标 kind 范围，遵守契约创建校验；
   本模块不新增未登记的 economy.* id。

---

## 7. 自定义能力

### 7.1 实体类型（kind）

- 推荐骨架（resource / good / industry / market / currency / actor / institution）默认不创建；
  用户在「添加类型」面板中勾选后才写入 `EconomyModuleConfig.entityTypes`。
- 自定义 kind 使用 `custom_xxx` id、用户语言的 label；图标限 Lucide 名，颜色取领域色板或自定义。
- EntityTypeDef 支持 `parentKind`（例如自定义「港口」挂在 market 下），继承父类型默认字段。
- 删除 kind 前必须迁移或清空该类型实体；默认提供「转为另一个 kind」的迁移动作。

### 7.2 字段

- 按 kind 配置 `fieldSchema`：字段类型沿用契约 `CustomFieldDef`（text / textarea / number /
  select / multiselect / date / entityRef / image）。
- `entityRef` 字段可限定 module / kind，例如「主要买家」只允许指向政治组织或角色。
- 字段支持必填、默认值、占位文案、排序；必填只在实体保存时校验，不阻塞速写 chips。
- 长文与可重复列表建议放条目（WorldModuleItem），不塞进 meta。

### 7.3 速写字段

- `sketchFields` 固定 3-5 个槽位，默认五槽；可改名、调序、关闭，不可超过 5 个。
- chips 类型槽位绑定 chipKind；货币槽位是单值 chip，资源 / 产业是多值 chips。
- 术语替换（ModuleConfig.terminology）可把「资源」显示为「物产」、「产业」显示为「营生」，
  只改 UI 文案，不改 kind。

### 7.4 等级与状态

- 等级：LevelDef（id / label / rank / color / description），语义完全由用户定义，
  例如「跨域 / 区域 / 地方」或「大宗 / 常见 / 稀有」。
- 等级只做视觉权重与排序，不限制实体能建多少关联；界面用文字徽章 + 分段条，
  不使用星级，也不使用星号拼贴或色块圆点表达等级。
- 状态：StatusDef（id / label / color / isTerminal）。终态状态（如已废止）在图上以
  低饱和 + 虚线边框表示，不影响关联保留。

### 7.5 关联类型

- 用户可在 `EconomyModuleConfig.linkTypes` 中新增 `CustomLinkTypeDef`：声明 label、
  reverseLabel、directed、icon、color、源 / 目标 module 与 kind 范围。
- 自定义类型在速写档的动词菜单中以用户 label 出现（若未定义速写动词，则默认不出现在速写档）。
- 注册表中的 economy.* 不可被覆盖；扩展语义用 custom 前缀。
- 反向文案：经济关联的反向显示直接使用契约 §4.4 的 reverseLabel，模块不再维护副本。

### 7.6 指标

- `EconomyModuleConfig.metrics` 默认为空。用户可添加自定义指标，也可在指标面板中
  一键添加建议骨架（供给量 / 需求量 / 价格 / 贸易量），骨架同样为空值。
- 指标定义含单位、数值类型（number / band）、极性、适用阶段与 kind。
- 指标只在 sandbox 披露；structure 的账册只在用户显式开启「指标预览」列时显示摘要箭头。

### 7.7 阶段与图层

- `stages` 可改名、调序；kind 到阶段的默认映射可在类型配置中覆盖。
- 图层来自 `layers`，仅控制绘制；不提供任意新增图层，但自定义关联类型会归入
  「外部站点」或按其源模块领域色绘制，仍可被筛选。
- 主题色与账页质感跟随 WorldTone（parchment / ink / slate / custom），经济模块只在
  其上使用 green / cyan 领域强调色。

### 7.8 配置存储与迁移

- 全部配置存 `WorldModule.config`（EconomyModuleConfig），随世界 JSON 备份迁移。
- 旧数据迁移按契约 §8：`color` 前缀解析为 kind 与 meta.level / status；旧
  `relations` 条目转换为 WorldLink；emoji 图标映射为 Lucide 名；模块配置条目转为 config。
- 迁移只做一次读时兼容；保存后写回新结构。


---

## 8. 复杂度分层（速写 / 结构 / 沙盘）

### 8.1 三档对照

| 维度 | 速写 sketch | 结构 structure | 沙盘 sandbox |
|------|-------------|----------------|--------------|
| 默认 | 是 | 用户切换 | 用户切换 |
| 回答 | 大概怎么转 | 谁和谁有关 | 多少、何时、怎么变 |
| 主视图 | 经济速写卡 | 线路图 / 网络图 + 账册 + 分栏 | 线路图 + 指标叠加 + 统计 + 时间刷 |
| 可见数据 | overview、chips、折叠计数 | 实体、关联、条目、等级 / 状态 | 全部 + 流量、指标、周期、时代 |
| 隐藏 | 画布、数值、时间轴、关联类型 | 指标数值、时间刷、统计 | 无（图层可关，开关始终可见） |
| 界面术语 | 物产 / 营生 / 集市 / 通货 / 往来 / 展开 | 实体 / 类型 / 关联 / 线路 / 账册 | 加：流量 / 指标 / 周期 / 时代 / 窗口 |
| 关联能力 | 计数 + 行内引用 + 简化建边（core.related_to + label，可细化） | 完整 LinkPanel、出 / 入链、选择器、画布或列表 | 再加时间有效性、流量 meta、世界脉络、统计 |
| 每屏预算 | 一屏不滚动 | 画布 + 检查器；列表可滚动 | 画布 + 时间刷 + 统计；面板可折叠 |
| 读路径 | overview + 计数聚合 | + 实体 + 关联 | + 指标序列 + 周期 + 时代引用 |
| 空状态 | 速写引导 | 「添加第一个实体」 | 「添加第一组指标 / 周期」 |
| 视觉权重 | chips 等权，按字段分组 | 枢纽大、物料小、横切轨道 | 再加规模大小、流量线宽、盈余颜色 |

升档不是解锁新功能，而是把已经存在的数据从折叠状态展开；降档不是删除，而是把复杂表达
收回到速写卡与折叠提示条。

### 8.2 同一实体的三张面孔

以「集市甲」为例，三档看到的是同一个 id、同一条数据：

| 档位 | 看到的样子 | 用到的东西 | 数据动作 |
|------|-----------|-----------|---------|
| 速写 | 速写卡「主要产业」行里的一个 chip：`( 集市甲 × )` | EconomyChip.entityRef | 无 |
| 结构 | 线路图上的双环方节点 `◎ 集市甲`，带出 / 入链角标与 LinkPanel | WorldSubmodule + WorldLink | 无 |
| 沙盘 | 尺寸按规模的节点，入线 / 出线按流量加宽，盈余为绿、赤字为琥珀色斜纹；时间刷拖到某年时显示该年指标曲线 | + EconomyMetricStore + time | 无 |

用户从速写点「展开为脉络」，只是把 chip 的 `entityRef` 指到一个新建实体；从结构点
「收进速写卡」，只是把披露状态降档；从沙盘降回结构，数值不删、只是隐藏并在提示条里
显示「已折叠 6 个数值」。

### 8.3 复杂性—简洁性统一的七个机关

1. **单一数据模型**：只有 WorldSubmodule（实体）、WorldLink（关联）、WorldModuleItem
   （速写卡 / 指标 / 周期 / 条目）三类落库对象；没有任何一档拥有自己的表。
2. **披露而非删除**：复杂度只决定 `renderPlan`；降档隐藏数据但保留数据，并用折叠条
   显示「已折叠 N 条关联 / M 个数值 / K 个字段」，让用户知道复杂层仍然存在。
3. **就地 morph**：切换档位保持实体 id、选中、画布锚点与检查器位置；同一个对象从
   关键词长成站点，再从站点长出数值，不复制、不重填。
4. **术语门**：速写档用日常词（物产 / 营生 / 往来 / 展开），结构档才出现类型与关联，
   沙盘档才出现流量、指标、周期。已细化的 economy.* 在三档中始终不变，只是显示词不同；
   未细化的速写边保持 core.related_to，升级结构后一键细化。
5. **渐进字段**：实体只强制名称；速写最少 3 个字段；关联的流量、时间、备注全部可选；
   指标默认为空。任何一档都不出现「必填完整数据才能继续」。
6. **读路径分档**：sketch 不请求关联与指标序列，只取计数；structure 请求实体与关联；
   sandbox 才按时间窗口请求指标。认知负担与性能负担同步下降。
7. **双向晋升**：chip 可升为实体，实体可收回为 chip；速写边可从 core.related_to 一键
   细化为 economy.*，关联 id 不变；路线默认是边，需要独立内容时
   可显式升级为 `custom_route` 节点；周期默认是时间带，需要写背景时也可打开 LinkPanel。
   简单形态与复杂形态之间可以来回走，不设单行道。

### 8.4 退化形态：1 个实体、1 条边也成立

| 数据状态 | 速写档 | 结构档 | 沙盘档 |
|---------|--------|--------|--------|
| 0 实体 0 边 | 空白速写卡 + 引导 | 空画布 + 「添加第一个实体」 | 统计全为「—」+ 空指标槽 |
| 0 实体但有 chips | 正常速写卡 | 每条泳道显示「未展开的 chip」+ 一键展开 | 无实体可统计，显示「先把 chip 展开」 |
| 1 实体 0 边 | 一个 chip，或一行速写 | 单站点居中，四周显示「拖一条线」空端口 | 单点规模条 + 绝对指标卡；无流量着色，不显示 0 |
| 1 实体 1 边 | 一行「甲 供 乙」式往来 | 两点一线；LinkPanel 出链 1 / 入链 1 | 边宽进入绝对模式：中等线宽 + 实际数值与单位，不做相对归一 |
| N 实体 0 边 | N 个 chips | 各阶段泳道并列，不自动连线、不制造假边 | 节点按规模散开，流量层显示「无流量」虚环 |
| N 实体 M 边但无指标 | 只显示折叠条 | 正常脉络图 + 账册 | 流量宽度可用；指标面板显示空槽与「可后填」，覆盖率显示 0% |
| 只有 1 个指标采样 | 只显示折叠条 | 账册指标列显示单个值 | 单点空心标记 + 数值标签，不画趋势线 |

结论：经济模块的最小成立单位是「一个实体」或「一条边」；一张只有 3 行字段的速写卡
同样是完整设定，不需要用空关系图来暗示缺陷。

### 8.5 切换时的连续性

- 焦点与选中不丢：升档后原选中实体仍高亮，且检查器自动滚到对应字段。
- 相机不跳：画布锚点与缩放保持；从账册切回画布时滚到当前选中行对应节点。
- 提示不打扰：升档用一条 3 秒提示「已展开 N 项」；降档用常驻页脚折叠条，不弹模态。
- 读屏播报：切换时只播报数量变化，不播报下一档术语；用户进入结构档后才启用类型词汇。
- 用户偏好：档位选择存本地偏好；世界内只保存 `EconomyModuleConfig.defaultComplexity`
  作为新访客的初始档位。

---

## 9. 空状态与引导

### 9.1 全空状态

```
┌──────────────────────────────────────────────────────────────────┐
│                     经 济 账 册                                   │
│                                                                  │
│      这里还是空白。先记三件事就够了：                              │
│         用什么换东西 · 出产什么 · 谁靠什么营生                     │
│                                                                  │
│      [ 写一张经济速写 ]        [ 直接画脉络 ]                      │
│                                                                  │
│      不预置任何经济类型、货币、资源或指标；你写下的才会存在。       │
└──────────────────────────────────────────────────────────────────┘
```

### 9.2 分场景空状态

| 场景 | 文案 | 主行动 | 备选 |
|------|------|--------|------|
| 全空 | 先记三件事就够了 | 写速写卡 | 直接画脉络 |
| 有实体无关联 | 这些实体还没往来 | 拖一条线 | 先给实体补字段 |
| 有速写 chips 未展开 | 关键词可以长成线路图 | 一键展开 | 继续留在速写 |
| 有产业无资源 | 产业还不知道靠什么 | 补一个物产 | 先放着 |
| 有市场无货币 | 东西在换，还没写用什么换 | 加一种通货 | 先不写数值 |
| 沙盘无指标 | 还没有数字记录 | 添加指标骨架 | 先用流量线宽 |
| 沙盘无周期 | 还没有时间分段 | 添加一个周期 | 先看单年快照 |
| 时间窗内无记录 | 此段没有记录 | 放宽窗口 | 回到全时段 |
| 画布无结果（筛选后） | 当前筛选没有匹配 | 清除筛选 | 保存为视图 |

### 9.3 引导原则

- 每个空状态只有一个主按钮，最多一个备选；不并列四五个入口。
- 文案不出现下一档术语：全空状态不出现「节点」「关联」「流量」。
- 不自动创建任何实体或关联；推荐 kind 与指标骨架都必须用户点击后才存在。
- 不把「完整」当目标；任何一步停下，当前状态都算成立。
- 3 分钟路径提示卡可关闭，关闭后不再出现；不重复弹窗。

---

## 10. 世界生成后的最小可用路径（3 分钟）

### 10.1 简单路径（默认，验收路径）

| 时间 | 动作 | 结果 |
|------|------|------|
| 0:00 - 0:45 | 打开经济模块，默认在速写档；写「经济形态」 | 第一项完成 |
| 0:45 - 1:20 | 写「通用货币」与「主要资源」1-2 个 chip | 三到四项完成 |
| 1:20 - 2:00 | 写「主要产业」1 个 chip，填「分配特征」 | 速写卡完成，仍无任何连线 |
| 2:00 - 2:40（可选） | 点「连一句往来」，选资源 chip → 产业 chip，动词选「用 / 耗」 | 生成 1 条 core.related_to（label「用 / 耗」），结构档可细化为 economy.consumes |
| 2:40 - 3:00（可选） | 切到结构看一眼两点一线，再切回速写 | 数据不变，认知不变 |

3 分钟后的速写卡形态：

```
┌─ 经济速写卡 ──────────────────────────────────────────────── 页 01 ─┐
│ 经济形态   集市贸易                                                  │
│ 通用货币   ( 通货甲 × )                                             │
│ 主要资源   ( 物产甲 × ) ( 物产乙 × )                                  │
│ 主要产业   ( 营生甲 × )                                             │
│ 分配特征   少数集中                                                  │
│                                                                     │
│ 已连 1 条往来：营生甲 —用→ 物产甲        没有折叠的往来                 │
│ [展开为脉络]                              [就这样，先记着]           │
└─────────────────────────────────────────────────────────────────────┘
```

简单路径验收：

- 全程不出现「实体 / 关联 / 流量 / 指标 / 周期 / 节点」等术语；
- 不填数值、不画图也能保存并再次打开；
- 速写卡至少有 3 项内容，或至少 1 个实体 + 1 条边，即算完成。

### 10.2 复杂路径（同一套数据，3 分钟起步）

| 时间 | 动作 | 结果 |
|------|------|------|
| 0:00 - 1:00 | 在结构档连续创建 3 个实体：1 资源、1 产业、1 市场（可用批量粘贴） | 3 个节点落到对应泳道 |
| 1:00 - 2:00 | 连 2 条边：产业消耗资源、产业供给市场；类型由系统按 kind 过滤 | 两点两条线的小网络成立 |
| 2:00 - 2:40 | 给产业填一个流量数值与单位，切到沙盘 | 线宽出现、绝对模式生效 |
| 2:40 - 3:00 | 添加一个周期阶段，或指向一个历史时代 | 时间带上出现第一段周期 |

复杂路径验收：3 个节点、2 条边、1 个流量值、1 个时间分段；全部落在同一套
WorldSubmodule / WorldLink / WorldModuleItem 中。用户可以在任意一步停下，停下时的
状态仍然是合法状态。

### 10.3 完成定义

| 完成级别 | 条件 | 对应档位 |
|---------|------|---------|
| 速写完成 | 经济形态 + 通用货币 + 主要资源或主要产业 | sketch |
| 结构完成 | 至少 1 个实体 + 至少 1 条关联（细化后为 economy.*） | structure |
| 沙盘完成 | 至少 1 条关联带流量，或至少 1 个实体有 1 个指标采样 | sandbox |

三个级别不是关卡，不弹升级提示；完成状态只在模块标题旁用一行小字显示。

---

## 11. 性能与实现建议

### 11.1 分档加载

| 档位 | 请求 | 不请求 |
|------|------|--------|
| sketch | 模块 config、economy.overview、实体与关联计数聚合 | 实体列表、关联明细、指标 |
| structure | config、submodules、world_links（分页 / 虚拟化）、条目摘要 | 指标序列、时代数据 |
| sandbox | 上述全部 + 时间窗内指标采样、周期、era_context 目标摘要 | 窗口外指标原始序列 |

阈值建议：经济画布 300 节点以内 SVG；300-800 用分层 canvas 渲染并简化标签；
超过 800 节点自动降级为「账册矩阵 + 推荐关联列表」，与契约世界脉络的降级策略一致。

### 11.2 索引与聚合

- 按契约建立 `(world_id, source.module, source.id)` 与 `(world_id, target.module, target.id)`
  索引；关联计数徽章使用批量聚合接口，禁止逐节点查询。
- 画布只拉取当前筛选后的节点与两端都在结果集中的边；跨模块外站按需补充摘要。
- 指标按 `(submodule_id, metric_id, t)` 存储与查询；时间窗查询走范围条件。
- 计数与覆盖率可做短 TTL 缓存；实体改名不需要改关联记录，显示名实时解析。

### 11.3 渲染与交互

- 阶段泳道布局是确定性布局：stage → order_index → 创建时间，保证同一数据每次打开
  位置稳定；网络图的坐标缓存于本地偏好，不写入世界数据。
- 账册列表虚拟滚动；画布标签做碰撞避让与缩略。
- 时间刷拖动 16ms 节流；指标曲线按窗口宽度降采样（LTTB 或等距抽样）；
  缺失点不参与插值。
- 节点大小、边宽归一使用当前视图内已知数据；绝对模式与相对模式在状态中显式记录，
  避免筛选后宽度含义突变。
- 切换档位的 morph 动画只做透明度与尺寸过渡；`prefers-reduced-motion` 下直接切换。

### 11.4 状态管理（设计层建议）

```typescript
interface EconomyViewState {
  complexity: ComplexityLevel;              // sketch | structure | sandbox
  layout: 'lanes' | 'network' | 'ledger' | 'split';
  selectedId?: string;
  hoveredId?: string;
  filters: {
    stages: EconomyStage[];
    kinds: EconomyKind[];
    levels: string[];
    statuses: string[];
    linkCount?: { min?: number; max?: number };
    hasMetrics?: boolean;
  };
  layers: Record<EconomyLayerConfig['id'], boolean>;
  timeWindow: { start?: string; end?: string };
  folded: { links: number; metrics: number; fields: number };  // 降档提示条
}
```

- 世界数据只存 ModuleConfig 与三类落库对象；视图状态全部在本地。
- 关掉页面再打开时恢复上次档位与布局；分享链接时通过 URL 参数覆盖。

### 11.5 组件结构建议

```
EconomyView
├─ EconomyHeader          # 标题、复杂度滑杆、搜索、世界脉络、配置
├─ FilterRail             # 阶段、kind、等级、状态、关联数、指标覆盖
├─ SketchLedger           # 经济速写卡、ChipList、VerbLinkDialog
├─ FlowCanvas             # LaneLayout / ForceLayout、ExternalStations、EdgeLayer
├─ LedgerList             # 虚拟列表、分组、列配置
├─ Inspector              # EntityPanel / EntryList / LinkPanel / MetricPanel
├─ TimeBrush              # EraBands、CycleBands、EventMarkers、WindowHandles
├─ StatsPanel
└─ LayerRail
```

组件不按「实体类型」拆分页面；类型只影响节点形状、筛选与字段 schema。

### 11.6 迁移与兼容

- 读时兼容旧 `color` 前缀、旧 `relations` 条目、旧 `moduleConfig` 条目与 emoji 图标；
  写回时统一为新结构。
- emoji 图标迁移：无法识别时回退 `shapes`，并在配置面板列出待确认项。
- 迁移不自动补全用户没写过的字段；`stub` 实体保持 stub，不伪造描述。
- 迁移只影响当前世界；导入旧备份时先复制再转换，不修改原记录。

### 11.7 验收对照

| 验收点 | 本文落地位置 |
|--------|-------------|
| 三档复杂度共用一套数据 | 3.1、3.3、8.3 |
| 简单模式 3 分钟可用、不出现复杂术语 | 4.4、8.1、10.1 |
| 复杂模式支持多节点 / 多关系 / 流量 / 时间 | 3.2、4.5、4.6、10.2 |
| 1 个实体 / 1 条边也能成立 | 8.4 |
| 复杂性—简洁性统一有明确 UI 机制 | 4.3、4.4 chip 机制、8.2、8.3 |
| 统一 LinkPanel 与行内引用 | 4.5.4、6.9 |
| WorldLink 术语与契约一致 | 全文；6.1 直接引用契约 §4.4 |
| 无 emoji、Lucide 图标名、green / cyan 领域色 | 4.7、7 |
| 不内置具体世界观预设内容 | 3.4、7.1、9.1、7.6 |
| 文档结构对齐契约第 7 节 | 第 1-12 节；末节为「本轮不做的事」 |

### 11.8 已知风险

| 风险 | 缓解 |
|------|------|
| 节点过多导致画布不可读 | 阶段泳道 + 筛选 + 图层 + 800 节点自动降级账册矩阵 |
| 自由文本时间不可比较 | `meta.timeOrder` 锚点；缺锚点单独标注，不猜时间 |
| 流量单位混用 | 不换算；分别标单位；统计面板提示多单位 |
| 颜色语义被误读 | 色 + 纹理 + 文字三重表达；赤字明确标注 |
| 速写被复杂数据污染 | 速写档只读 overview 与计数；术语门与折叠条隔离 |
| 自定义 kind 过多 | 类型筛选 + 最近使用排序 + 建议骨架不自动创建 |

---

## 12. 本轮不做的事

1. 不改任何前后端代码，不建表、不写 API、不实现组件；本文只是设计。
2. 不动地图与特殊模块；地图未接入前隐藏 `economy.located_in` 创建入口。
3. 不做经济模拟：不计算供需平衡、不推演价格、不做动态市场。
4. 不做汇率换算与跨货币结算；多货币只做并列表达，不自动折算。
5. 不做复式记账、资产负债表、货币供应量等会计与宏观模型。
6. 不预置任何世界观内容：不预置经济形态、货币、资源、产业、等级、状态、指标或周期。
7. 不恢复旧方案的固定实体类型、固定卡片、星级等级、emoji 图标与字符串关系条目。
8. 不做 AI 自动生成经济设定，不做从文本批量抽取实体。
9. 不做跨世界关联；WorldLink 只在单个 World 内生效。
10. 不做世界脉络的图编辑；World Web 保持契约规定的只读总览。
11. 不做实时协作、评论、版本历史；只做本地撤销与自动保存。
12. 不做外部经济数据导入；沙盘只导出当前时间窗口的 CSV。
13. 不新增未登记的 economy.* 关联类型；自定义语义一律走 CustomLinkTypeDef 的 custom 前缀。
14. 不做移动端专属布局；窄屏以账册列表为主视图，画布横向滚动，时间刷折叠。
